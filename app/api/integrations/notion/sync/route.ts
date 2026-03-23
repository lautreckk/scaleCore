import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeSyncForTenant } from "@/lib/notion/sync";
import { waitUntil } from "@vercel/functions";

// POST /api/integrations/notion/sync — trigger a sync (manual or incremental)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin", "manager"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const syncType: string = body.type === "full" ? "full" : "manual";

    const { data: config } = await supabase
      .from("notion_sync_config")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!config) {
      return NextResponse.json(
        { error: "Notion not configured" },
        { status: 404 }
      );
    }

    // Create log entry upfront
    const { data: log, error: logError } = await supabase
      .from("notion_sync_log")
      .insert({
        tenant_id: tenantUser.tenant_id,
        sync_type: syncType,
        status: "running",
      })
      .select()
      .single();

    if (logError) throw logError;

    // Return immediately, run sync in background
    waitUntil(
      executeSyncForTenant(supabase, tenantUser.tenant_id, config, log.id, syncType)
    );

    return NextResponse.json({
      success: true,
      message: "Sync started",
      log_id: log.id,
    });
  } catch (error) {
    console.error("Error starting Notion sync:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
