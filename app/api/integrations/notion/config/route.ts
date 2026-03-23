import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt, maskApiKey } from "@/lib/encryption";

// GET /api/integrations/notion/config — return tenant config (key masked)
export async function GET() {
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
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!config) {
      return NextResponse.json({ config: null });
    }

    // Mask API key — decrypt first to get last 4 chars, then mask
    let apiKeyMasked = "****";
    try {
      const decrypted = decrypt(config.notion_api_key);
      apiKeyMasked = maskApiKey(decrypted);
    } catch {
      apiKeyMasked = "****";
    }

    return NextResponse.json({
      config: {
        ...config,
        notion_api_key: undefined,
        api_key_masked: apiKeyMasked,
      },
    });
  } catch (error) {
    console.error("Error fetching Notion config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/integrations/notion/config — create or update config
export async function PUT(request: NextRequest) {
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

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      notion_api_key,
      notion_database_id,
      sync_enabled,
      sync_direction,
      sync_interval_minutes,
      stage_mapping,
      field_mapping,
      default_operation,
      default_responsible,
    } = body;

    if (!notion_database_id) {
      return NextResponse.json(
        { error: "Database ID is required" },
        { status: 400 }
      );
    }

    // Check if config already exists
    const { data: existing } = await supabase
      .from("notion_sync_config")
      .select("id, notion_api_key")
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    // Build update payload
    const payload: Record<string, unknown> = {
      notion_database_id,
      sync_enabled: sync_enabled ?? false,
      sync_direction: sync_direction ?? "scalecore_to_notion",
      sync_interval_minutes: sync_interval_minutes ?? 360,
      stage_mapping: stage_mapping ?? {},
      field_mapping: field_mapping ?? {},
      default_operation: default_operation || null,
      default_responsible: default_responsible || null,
      updated_at: new Date().toISOString(),
    };

    // Only encrypt & set API key if a new one was provided
    if (notion_api_key) {
      payload.notion_api_key = encrypt(notion_api_key);
    }

    if (existing) {
      // Update
      if (!notion_api_key) {
        // Keep existing key
        delete payload.notion_api_key;
      }

      const { data: config, error } = await supabase
        .from("notion_sync_config")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        config: { ...config, notion_api_key: undefined },
      });
    } else {
      // Create — API key is required for new config
      if (!notion_api_key) {
        return NextResponse.json(
          { error: "API Key is required for initial setup" },
          { status: 400 }
        );
      }

      payload.tenant_id = tenantUser.tenant_id;

      const { data: config, error } = await supabase
        .from("notion_sync_config")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        config: { ...config, notion_api_key: undefined },
      });
    }
  } catch (error) {
    console.error("Error saving Notion config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
