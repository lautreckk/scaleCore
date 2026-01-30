import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientForConfig } from "@/lib/evolution/config";

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
    const { name, evolutionConfigId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Instance name is required" },
        { status: 400 }
      );
    }

    if (!evolutionConfigId) {
      return NextResponse.json(
        { error: "Evolution server is required" },
        { status: 400 }
      );
    }

    // Verify the evolution config belongs to the tenant
    const { data: evolutionConfig } = await supabase
      .from("evolution_api_configs")
      .select("id")
      .eq("id", evolutionConfigId)
      .eq("tenant_id", tenantUser.tenant_id)
      .eq("is_active", true)
      .single();

    if (!evolutionConfig) {
      return NextResponse.json(
        { error: "Invalid Evolution server" },
        { status: 400 }
      );
    }

    // Get the Evolution API client for this config
    const evolutionClient = await getEvolutionClientForConfig(evolutionConfigId);

    if (!evolutionClient) {
      return NextResponse.json(
        { error: "Failed to connect to Evolution server" },
        { status: 500 }
      );
    }

    // Generate a unique instance name
    const instanceName = `${tenantUser.tenant_id.slice(0, 8)}-${name}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");

    // Create instance in Evolution API
    const result = await evolutionClient.createInstance({
      instanceName,
      token: crypto.randomUUID(),
      qrcode: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to create instance" },
        { status: 500 }
      );
    }

    // Configure webhook
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin")}/api/webhooks/evolution`;
    await evolutionClient.setWebhook(instanceName, {
      url: webhookUrl,
      webhook_by_events: false,
      webhook_base64: true,
      events: [
        "QRCODE_UPDATED",
        "CONNECTION_UPDATE",
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "SEND_MESSAGE",
      ],
    });

    // Save to database
    const { error: dbError } = await supabase.from("whatsapp_instances").insert({
      tenant_id: tenantUser.tenant_id,
      name,
      instance_name: instanceName,
      instance_token: crypto.randomUUID(),
      evolution_config_id: evolutionConfigId,
      status: "disconnected",
    });

    if (dbError) {
      console.error("Error saving instance to database:", dbError);
      // Try to delete the instance from Evolution API
      await evolutionClient.deleteInstance(instanceName);
      return NextResponse.json(
        { error: "Failed to save instance" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      instanceName,
      data: result.data,
    });
  } catch (error) {
    console.error("Error creating WhatsApp instance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: instances, error } = await supabase
      .from("whatsapp_instances")
      .select(`
        *,
        evolution_config:evolution_api_configs(id, name)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ instances });
  } catch (error) {
    console.error("Error fetching WhatsApp instances:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
