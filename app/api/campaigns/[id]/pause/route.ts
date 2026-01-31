import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Get campaign
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("id, status, modal_job_id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "running") {
      return NextResponse.json(
        { error: "Campaign is not running" },
        { status: 400 }
      );
    }

    // Update campaign status to paused
    await supabase
      .from("campaigns")
      .update({
        status: "paused",
        modal_job_status: "paused",
      })
      .eq("id", id);

    // Note: The Modal worker checks campaign status before each send
    // and will stop processing when it sees "paused" status

    return NextResponse.json({
      success: true,
      message: "Campaign paused",
    });
  } catch (error) {
    console.error("Error pausing campaign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
