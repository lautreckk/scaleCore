import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MODAL_API_URL = process.env.MODAL_API_URL || "https://scalecore-campaign-worker--process-campaign.modal.run";
const MODAL_API_TOKEN = process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET
  ? `${process.env.MODAL_TOKEN_ID}:${process.env.MODAL_TOKEN_SECRET}`
  : null;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get campaign with instance and messages
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        whatsapp_instances(id, instance_name, status),
        campaign_messages(id)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["draft", "paused", "scheduled"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Campaign cannot be started" },
        { status: 400 }
      );
    }

    const instance = campaign.whatsapp_instances;
    if (!instance || instance.status !== "connected") {
      return NextResponse.json(
        { error: "WhatsApp instance not connected" },
        { status: 400 }
      );
    }

    // Check wallet balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    // Calculate cost based on messages per recipient
    const messagesCount = campaign.campaign_messages?.length || 1;
    const pendingCount = (campaign.total_recipients || 0) - (campaign.sent_count || 0);
    const estimatedCost = pendingCount * messagesCount * 0.12;

    if (!wallet || wallet.balance < estimatedCost) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          required: estimatedCost,
          available: wallet?.balance || 0
        },
        { status: 402 }
      );
    }

    // Update campaign status to running
    await supabase
      .from("campaigns")
      .update({
        status: "running",
        modal_job_status: "starting",
        started_at: campaign.started_at || new Date().toISOString(),
      })
      .eq("id", id);

    // Try to trigger Modal worker if configured
    if (MODAL_API_TOKEN) {
      try {
        const response = await fetch(MODAL_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${MODAL_API_TOKEN}`,
          },
          body: JSON.stringify({
            campaign_id: id,
            tenant_id: tenantUser.tenant_id,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          // Update with Modal job ID
          await supabase
            .from("campaigns")
            .update({
              modal_job_id: result.call_id || result.job_id,
              modal_job_status: "processing",
            })
            .eq("id", id);

          return NextResponse.json({
            success: true,
            message: "Campaign started with Modal worker",
            job_id: result.call_id || result.job_id,
          });
        } else {
          console.error("Modal API error:", await response.text());
          // Fall through to fallback processing
        }
      } catch (modalError) {
        console.error("Modal connection error:", modalError);
        // Fall through to fallback processing
      }
    }

    // Fallback: Process in-process (for development or when Modal is not configured)
    const { data: sends } = await supabase
      .from("campaign_sends")
      .select("id, phone, lead_id")
      .eq("campaign_id", id)
      .eq("status", "pending")
      .limit(100);

    if (!sends || sends.length === 0) {
      await supabase
        .from("campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          modal_job_status: "completed"
        })
        .eq("id", id);

      return NextResponse.json({ success: true, message: "No pending sends" });
    }

    // Start background processing (existing fallback logic)
    const delay = (campaign.settings as Record<string, number>)?.delay || campaign.delay_between_recipients || 5;

    processMessagesBackground(
      supabase,
      campaign,
      sends,
      delay,
      tenantUser.tenant_id
    );

    return NextResponse.json({
      success: true,
      message: `Processing ${sends.length} recipients (fallback mode)`,
    });
  } catch (error) {
    console.error("Error starting campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Fallback in-process message processing
async function processMessagesBackground(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaign: Record<string, unknown>,
  sends: Array<{ id: string; phone: string; lead_id: string | null }>,
  delaySeconds: number,
  tenantId: string
) {
  const { getEvolutionClientForInstance } = await import("@/lib/evolution/config");

  const campaignId = campaign.id as string;
  const instanceId = campaign.instance_id as string;

  // Get campaign messages
  const { data: messages } = await supabase
    .from("campaign_messages")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position");

  // Fall back to message_template if no messages
  const messageList = messages?.length ? messages : [{
    id: "legacy",
    message_type: "text",
    content: campaign.message_template as string,
    delay_after: 0,
  }];

  const evolutionClient = await getEvolutionClientForInstance(instanceId);
  if (!evolutionClient) {
    await supabase
      .from("campaigns")
      .update({ status: "failed", modal_job_status: "failed" })
      .eq("id", campaignId);
    return;
  }

  const { data: instance } = await supabase
    .from("whatsapp_instances")
    .select("instance_name")
    .eq("id", instanceId)
    .single();

  if (!instance) return;

  for (const send of sends) {
    try {
      // Check if campaign is still running
      const { data: campaignCheck } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (campaignCheck?.status !== "running") {
        break;
      }

      // Get lead data for personalization
      let leadData: { name?: string; company?: string; email?: string; custom_fields?: Record<string, unknown> } | null = null;
      if (send.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("name, company, email, custom_fields")
          .eq("id", send.lead_id)
          .single();
        leadData = lead;
      }

      let allMessagesSent = true;
      let lastMessageId: string | null = null;

      // Send all messages in sequence
      for (let i = 0; i < messageList.length; i++) {
        const msg = messageList[i];
        let content = msg.content || "";

        // Replace variables
        if (leadData) {
          content = content
            .replace(/\{\{nome\}\}/gi, leadData.name || "")
            .replace(/\{\{empresa\}\}/gi, leadData.company || "")
            .replace(/\{\{email\}\}/gi, leadData.email || "");

          // Replace custom fields
          if (leadData.custom_fields) {
            for (const [key, value] of Object.entries(leadData.custom_fields)) {
              const regex = new RegExp(`\\{\\{custom\\.${key}\\}\\}`, "gi");
              content = content.replace(regex, String(value || ""));
            }
          }
        }

        // Clean up any remaining variables
        content = content.replace(/\{\{[^}]+\}\}/g, "");

        const delayMs = i > 0 ? (campaign.delay_between_messages as number || 3) * 1000 : 1000;

        let result;
        if (msg.message_type === "text") {
          result = await evolutionClient.sendText(instance.instance_name, {
            number: send.phone,
            text: content,
            delay: delayMs,
          });
        } else if (msg.media_url) {
          result = await evolutionClient.sendMedia(instance.instance_name, {
            number: send.phone,
            mediatype: msg.message_type as "image" | "video" | "audio" | "document",
            mimetype: msg.media_mimetype || "application/octet-stream",
            caption: content || undefined,
            media: msg.media_url,
            fileName: msg.file_name,
          });
        }

        if (!result?.success) {
          allMessagesSent = false;
          break;
        }

        lastMessageId = result.data?.key?.id || null;

        // Record individual message
        await supabase.from("campaign_send_messages").insert({
          campaign_send_id: send.id,
          campaign_message_id: msg.id !== "legacy" ? msg.id : null,
          message_id: lastMessageId,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        // Deduct cost per message
        await supabase.rpc("deduct_wallet_balance", {
          p_tenant_id: tenantId,
          p_amount: 0.12,
          p_description: `Campanha: ${campaignId}`,
        });
      }

      if (allMessagesSent) {
        await supabase
          .from("campaign_sends")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message_id: lastMessageId,
            messages_sent: messageList.length,
            total_messages: messageList.length,
          })
          .eq("id", send.id);

        await supabase.rpc("increment_campaign_count", {
          campaign_id: campaignId,
          field_name: "sent_count",
        });
      } else {
        await supabase
          .from("campaign_sends")
          .update({
            status: "failed",
            error_message: "Failed to send all messages",
          })
          .eq("id", send.id);

        await supabase.rpc("increment_campaign_count", {
          campaign_id: campaignId,
          field_name: "failed_count",
        });
      }

      // Wait between recipients
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    } catch (error) {
      console.error("Error processing message:", error);

      await supabase
        .from("campaign_sends")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Processing error",
        })
        .eq("id", send.id);
    }
  }

  // Check if campaign is complete
  const { count: pendingCount } = await supabase
    .from("campaign_sends")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  if (pendingCount === 0) {
    await supabase
      .from("campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        modal_job_status: "completed"
      })
      .eq("id", campaignId);
  }
}
