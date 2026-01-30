import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// GET - Verificar configuração atual do webhook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> }
) {
  try {
    const { instanceName } = await params;
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

    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    const result = await clientData.client.getWebhook(instanceName);

    return NextResponse.json({
      success: true,
      webhook: result.data,
    });
  } catch (error) {
    console.error("Error getting webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Reconfigurar webhook para apontar para o sistema
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> }
) {
  try {
    const { instanceName } = await params;
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

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    // Configurar webhook para apontar para nossa API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin");
    const webhookUrl = `${appUrl}/api/webhooks/evolution`;

    console.log(`Configuring webhook for instance ${instanceName}`);
    console.log(`App URL: ${appUrl}`);
    console.log(`Webhook URL: ${webhookUrl}`);

    const result = await clientData.client.setWebhook(instanceName, {
      url: webhookUrl,
      enabled: true,
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

    console.log(`Webhook configuration result:`, result);

    if (!result.success) {
      console.error(`Failed to configure webhook: ${result.error}`);
      return NextResponse.json(
        { error: result.error || "Failed to configure webhook" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Webhook configurado com sucesso",
      webhookUrl,
    });
  } catch (error) {
    console.error("Error configuring webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
