import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evolutionApi } from "@/lib/evolution/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instanceName: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { instanceName } = await params;

    // Verify user has access to this instance
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_name", instanceName)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Get QR code from Evolution API
    const result = await evolutionApi.getQRCode(instanceName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to get QR code" },
        { status: 500 }
      );
    }

    // Update instance status
    await supabase
      .from("whatsapp_instances")
      .update({
        status: "waiting_qr",
        qrcode: result.data?.base64 || result.data?.code || null,
      })
      .eq("id", instance.id);

    return NextResponse.json({
      success: true,
      qrcode: result.data?.base64 || result.data?.code,
    });
  } catch (error) {
    console.error("Error connecting WhatsApp instance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
