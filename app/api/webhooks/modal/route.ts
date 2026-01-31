import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const WEBHOOK_SECRET = process.env.SCALECORE_WEBHOOK_SECRET;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, "public", any>;

interface ModalWebhookPayload {
  event: "campaign.completed" | "campaign.progress" | "campaign.error";
  data: {
    campaign_id: string;
    status: string;
    sent_count?: number;
    failed_count?: number;
    total_recipients?: number;
    error?: string;
    progress_percent?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get("X-Webhook-Secret");
      if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await request.json()) as ModalWebhookPayload;
    const { event, data } = body;

    if (!event || !data?.campaign_id) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    // Use service role client for webhook processing
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event) {
      case "campaign.completed":
        await handleCampaignCompleted(supabase, data);
        break;

      case "campaign.progress":
        await handleCampaignProgress(supabase, data);
        break;

      case "campaign.error":
        await handleCampaignError(supabase, data);
        break;

      default:
        console.log("Unknown webhook event:", event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing Modal webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleCampaignCompleted(
  supabase: AdminClient,
  data: ModalWebhookPayload["data"]
) {
  const { campaign_id, status, sent_count, failed_count, error } = data;

  const updateData: Record<string, unknown> = {
    modal_job_status: status === "completed" ? "completed" : status,
  };

  if (status === "completed") {
    updateData.status = "completed";
    updateData.completed_at = new Date().toISOString();
  } else if (status === "failed") {
    updateData.status = "failed";
    updateData.completed_at = new Date().toISOString();
  } else if (status === "paused") {
    updateData.status = "paused";
  }

  if (sent_count !== undefined) {
    updateData.sent_count = sent_count;
  }

  if (failed_count !== undefined) {
    updateData.failed_count = failed_count;
  }

  if (error) {
    // Append error to error_log
    await supabase.rpc("append_campaign_error", {
      p_campaign_id: campaign_id,
      p_error: error,
    });
  }

  await supabase
    .from("campaigns")
    .update(updateData)
    .eq("id", campaign_id);

  console.log(`Campaign ${campaign_id} completed with status: ${status}`);
}

async function handleCampaignProgress(
  supabase: AdminClient,
  data: ModalWebhookPayload["data"]
) {
  const { campaign_id, sent_count, failed_count, progress_percent } = data;

  const updateData: Record<string, unknown> = {};

  if (sent_count !== undefined) {
    updateData.sent_count = sent_count;
  }

  if (failed_count !== undefined) {
    updateData.failed_count = failed_count;
  }

  if (Object.keys(updateData).length > 0) {
    await supabase
      .from("campaigns")
      .update(updateData)
      .eq("id", campaign_id);
  }

  console.log(`Campaign ${campaign_id} progress: ${progress_percent}%`);
}

async function handleCampaignError(
  supabase: AdminClient,
  data: ModalWebhookPayload["data"]
) {
  const { campaign_id, error } = data;

  if (error) {
    await supabase.rpc("append_campaign_error", {
      p_campaign_id: campaign_id,
      p_error: error,
    });
  }

  await supabase
    .from("campaigns")
    .update({
      modal_job_status: "error",
    })
    .eq("id", campaign_id);

  console.log(`Campaign ${campaign_id} error: ${error}`);
}
