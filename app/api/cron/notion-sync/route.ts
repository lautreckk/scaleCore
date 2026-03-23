import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { waitUntil } from "@vercel/functions";
import { executeSyncForTenant } from "@/lib/notion/sync";

// POST /api/cron/notion-sync — called by Vercel Cron every 6h
export async function GET(request: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminClient();

    // Fetch all tenants with sync enabled
    const { data: configs, error } = await supabase
      .from("notion_sync_config")
      .select("*")
      .eq("sync_enabled", true);

    if (error) throw error;
    if (!configs || configs.length === 0) {
      return NextResponse.json({ message: "No tenants to sync", count: 0 });
    }

    // Process each tenant in parallel via waitUntil
    let processed = 0;
    for (const config of configs) {
      // Create log entry
      const { data: log } = await supabase
        .from("notion_sync_log")
        .insert({
          tenant_id: config.tenant_id,
          sync_type: "incremental",
          status: "running",
        })
        .select()
        .single();

      if (log) {
        waitUntil(
          executeSyncForTenant(
            supabase,
            config.tenant_id,
            config,
            log.id,
            "incremental"
          )
        );
        processed++;
      }
    }

    return NextResponse.json({
      message: `Sync triggered for ${processed} tenants`,
      count: processed,
    });
  } catch (error) {
    console.error("Cron notion-sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
