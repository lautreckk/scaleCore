import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, maskApiKey } from "@/lib/encryption";
import { getEvolutionConfigs } from "@/lib/evolution/config";

// GET - List all Evolution API configs for the tenant
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await getEvolutionConfigs(tenantUser.tenant_id);

    // Mask API keys in response
    const maskedConfigs = configs.map((config) => ({
      ...config,
      api_key_masked: maskApiKey(config.api_key_encrypted),
      api_key_encrypted: undefined,
    }));

    return NextResponse.json({ configs: maskedConfigs });
  } catch (error) {
    console.error("Error fetching Evolution configs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new Evolution API config
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
    const { name, url, apiKey } = body;

    if (!name || !url || !apiKey) {
      return NextResponse.json(
        { error: "Name, URL, and API Key are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Normalize URL (remove trailing slash)
    const normalizedUrl = url.replace(/\/$/, "");

    // Check for duplicate name
    const { data: existingConfig } = await supabase
      .from("evolution_api_configs")
      .select("id")
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("name", name)
      .single();

    if (existingConfig) {
      return NextResponse.json(
        { error: "A server with this name already exists" },
        { status: 409 }
      );
    }

    // Encrypt the API key
    const encryptedApiKey = encrypt(apiKey);

    // Create the config
    const { data: config, error } = await supabase
      .from("evolution_api_configs")
      .insert({
        tenant_id: tenantUser.tenant_id,
        name,
        url: normalizedUrl,
        api_key_encrypted: encryptedApiKey,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating Evolution config:", error);
      return NextResponse.json(
        { error: "Failed to create configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        api_key_masked: maskApiKey(apiKey),
        api_key_encrypted: undefined,
      },
    });
  } catch (error) {
    console.error("Error creating Evolution config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
