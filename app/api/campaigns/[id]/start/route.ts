import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evolutionApi } from "@/lib/evolution/client";

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

    // Get campaign with instance
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(`
        *,
        whatsapp_instances(id, instance_name, status)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["draft", "paused"].includes(campaign.status)) {
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

    const pendingCount = campaign.total_recipients - campaign.sent_count;
    const estimatedCost = pendingCount * 0.12;

    if (!wallet || wallet.balance < estimatedCost) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 402 }
      );
    }

    // Update campaign status
    await supabase
      .from("campaigns")
      .update({
        status: "running",
        started_at: campaign.started_at || new Date().toISOString(),
      })
      .eq("id", id);

    // Get pending sends
    const { data: sends } = await supabase
      .from("campaign_sends")
      .select("id, phone, lead_id")
      .eq("campaign_id", id)
      .eq("status", "pending")
      .limit(100);

    if (!sends || sends.length === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);

      return NextResponse.json({ success: true, message: "No pending sends" });
    }

    // Start sending messages in background
    // In production, this should be handled by a queue/worker
    const delay = (campaign.settings as Record<string, number>)?.delay || 5;

    processMessages(
      supabase,
      campaign.id,
      instance.instance_name,
      campaign.message_template,
      sends,
      delay,
      tenantUser.tenant_id
    );

    return NextResponse.json({
      success: true,
      message: `Processing ${sends.length} messages`,
    });
  } catch (error) {
    console.error("Error starting campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function processMessages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  instanceName: string,
  messageTemplate: string,
  sends: Array<{ id: string; phone: string; lead_id: string | null }>,
  delaySeconds: number,
  tenantId: string
) {
  for (const send of sends) {
    try {
      // Check if campaign is still running
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (campaign?.status !== "running") {
        console.log("Campaign stopped, exiting message processing");
        break;
      }

      // Get lead data for personalization
      let message = messageTemplate;
      if (send.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("name, company")
          .eq("id", send.lead_id)
          .single();

        if (lead) {
          message = message
            .replace(/\{\{nome\}\}/gi, lead.name || "")
            .replace(/\{\{empresa\}\}/gi, lead.company || "");
        }
      }

      // Send message
      const result = await evolutionApi.sendText(instanceName, {
        number: send.phone,
        text: message,
        delay: 1000,
      });

      if (result.success) {
        // Update send status
        await supabase
          .from("campaign_sends")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            message_id: result.data?.key?.id,
          })
          .eq("id", send.id);

        // Update campaign counts
        await supabase.rpc("increment_campaign_sent", { p_campaign_id: campaignId });

        // Deduct from wallet
        await supabase.rpc("deduct_wallet_balance", {
          p_tenant_id: tenantId,
          p_amount: 0.12,
          p_description: `Campanha: ${campaignId}`,
        });
      } else {
        // Mark as failed
        await supabase
          .from("campaign_sends")
          .update({
            status: "failed",
            error_message: result.error || "Unknown error",
          })
          .eq("id", send.id);

        // Update failed count
        await supabase.rpc("increment_campaign_failed", { p_campaign_id: campaignId });
      }

      // Wait before next message
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
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", campaignId);
  }
}
