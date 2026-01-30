import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt, maskApiKey } from "@/lib/encryption";

// GET - Get a specific Evolution API config
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

    const { data: config, error } = await supabase
      .from("evolution_api_configs")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Get instance count
    const { count } = await supabase
      .from("whatsapp_instances")
      .select("*", { count: "exact", head: true })
      .eq("evolution_config_id", config.id);

    return NextResponse.json({
      config: {
        ...config,
        api_key_masked: maskApiKey(decrypt(config.api_key_encrypted)),
        api_key_encrypted: undefined,
        instance_count: count || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching Evolution config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update a specific Evolution API config
export async function PUT(
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
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the config belongs to the tenant
    const { data: existingConfig } = await supabase
      .from("evolution_api_configs")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingConfig) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, url, apiKey, isActive } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      // Check for duplicate name (excluding current config)
      const { data: duplicateConfig } = await supabase
        .from("evolution_api_configs")
        .select("id")
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("name", name)
        .neq("id", id)
        .single();

      if (duplicateConfig) {
        return NextResponse.json(
          { error: "A server with this name already exists" },
          { status: 409 }
        );
      }
      updateData.name = name;
    }

    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 }
        );
      }
      updateData.url = url.replace(/\/$/, "");
    }

    if (apiKey !== undefined) {
      updateData.api_key_encrypted = encrypt(apiKey);
    }

    if (isActive !== undefined) {
      updateData.is_active = isActive;
    }

    const { data: config, error } = await supabase
      .from("evolution_api_configs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating Evolution config:", error);
      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        api_key_masked: maskApiKey(decrypt(config.api_key_encrypted)),
        api_key_encrypted: undefined,
      },
    });
  } catch (error) {
    console.error("Error updating Evolution config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific Evolution API config
export async function DELETE(
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
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the config belongs to the tenant
    const { data: existingConfig } = await supabase
      .from("evolution_api_configs")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingConfig) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    // Check if there are instances using this config
    const { count } = await supabase
      .from("whatsapp_instances")
      .select("*", { count: "exact", head: true })
      .eq("evolution_config_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete server with active instances",
          message: `This server has ${count} instance(s) connected. Please delete or reassign them first.`
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("evolution_api_configs")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting Evolution config:", error);
      return NextResponse.json(
        { error: "Failed to delete configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting Evolution config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
