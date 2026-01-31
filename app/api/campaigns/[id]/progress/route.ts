import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

    // Get campaign with counts
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select(`
        id,
        name,
        status,
        modal_job_id,
        modal_job_status,
        total_recipients,
        sent_count,
        delivered_count,
        read_count,
        failed_count,
        estimated_cost,
        actual_cost,
        delay_between_recipients,
        started_at,
        completed_at,
        error_log
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Calculate progress percentage
    const total = campaign.total_recipients || 0;
    const processed = (campaign.sent_count || 0) + (campaign.failed_count || 0);
    const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

    // Get recent sends for activity feed
    const { data: recentSends } = await supabase
      .from("campaign_sends")
      .select(`
        id,
        status,
        sent_at,
        error_message,
        leads(name, phone)
      `)
      .eq("campaign_id", id)
      .order("sent_at", { ascending: false })
      .limit(10);

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | null = null;
    if (campaign.status === "running" && campaign.started_at && processed > 0) {
      const elapsed = Date.now() - new Date(campaign.started_at).getTime();
      const avgTimePerRecipient = elapsed / processed;
      const remaining = total - processed;
      estimatedTimeRemaining = Math.round((remaining * avgTimePerRecipient) / 1000); // seconds
    }

    return NextResponse.json({
      campaign: {
        ...campaign,
        progress_percent: progressPercent,
        processed_count: processed,
        pending_count: total - processed,
        estimated_time_remaining: estimatedTimeRemaining,
      },
      recent_activity: recentSends?.map((send) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lead = send.leads as any;
        return {
          id: send.id,
          status: send.status,
          sent_at: send.sent_at,
          error_message: send.error_message,
          lead_name: lead?.name,
          lead_phone: lead?.phone,
        };
      }) || [],
    });
  } catch (error) {
    console.error("Error getting campaign progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
