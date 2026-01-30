import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

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

    // Get the Evolution client for this instance
    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found or no Evolution server configured" },
        { status: 404 }
      );
    }

    const { client, instance } = clientData;

    // Logout from Evolution API
    const result = await client.logout(instanceName);

    if (!result.success) {
      console.error("Failed to logout from Evolution API:", result.error);
    }

    // Update instance status
    await supabase
      .from("whatsapp_instances")
      .update({
        status: "disconnected",
        qrcode: null,
      })
      .eq("id", instance.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting WhatsApp instance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
