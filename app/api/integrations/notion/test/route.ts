import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encryption";
import { NotionSyncClient } from "@/lib/notion/client";

// POST /api/integrations/notion/test — test connection to Notion database
export async function POST() {
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
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: config } = await supabase
      .from("notion_sync_config")
      .select("notion_api_key, notion_database_id")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!config) {
      return NextResponse.json(
        { error: "Notion not configured. Save your config first." },
        { status: 404 }
      );
    }

    const apiKey = decrypt(config.notion_api_key);

    const client = new NotionSyncClient({
      notion_api_key: apiKey,
      notion_database_id: config.notion_database_id,
      stage_mapping: {},
      field_mapping: {},
    });

    const info = await client.testConnection();

    return NextResponse.json({
      success: true,
      database_name: info.name,
      properties: info.properties,
    });
  } catch (error) {
    console.error("Notion test connection error:", error);
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
