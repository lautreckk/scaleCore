import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evolutionApi } from "@/lib/evolution/client";

export async function DELETE(
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
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role)) {
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

    // Delete from Evolution API
    const result = await evolutionApi.deleteInstance(instanceName);

    if (!result.success) {
      console.error("Failed to delete from Evolution API:", result.error);
    }

    // Delete from database
    await supabase
      .from("whatsapp_instances")
      .delete()
      .eq("id", instance.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting WhatsApp instance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
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

    const { data: instance, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Get connection state from Evolution API
    const stateResult = await evolutionApi.getConnectionState(instanceName);

    return NextResponse.json({
      instance,
      connectionState: stateResult.data?.instance?.state || "unknown",
    });
  } catch (error) {
    console.error("Error fetching WhatsApp instance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
