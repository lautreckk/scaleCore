import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get a single webhook forward
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: forward, error } = await supabase
      .from("webhook_forwards")
      .select(`
        *,
        whatsapp_instances(id, name, instance_name)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !forward) {
      return NextResponse.json({ error: "Webhook forward not found" }, { status: 404 });
    }

    return NextResponse.json({ forward });
  } catch (error) {
    console.error("Error in GET /api/webhook-forwards/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update a webhook forward
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify the forward exists and belongs to this tenant
    const { data: existingForward } = await supabase
      .from("webhook_forwards")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingForward) {
      return NextResponse.json({ error: "Webhook forward not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, target_url, headers, events, is_active, instance_id } = body;

    // If changing instance, verify it belongs to this tenant
    if (instance_id) {
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("id", instance_id)
        .eq("tenant_id", tenantUser.tenant_id)
        .single();

      if (!instance) {
        return NextResponse.json({ error: "Instance not found" }, { status: 404 });
      }
    }

    // Validate URL if provided
    if (target_url) {
      try {
        new URL(target_url);
      } catch {
        return NextResponse.json({ error: "Invalid target URL" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (target_url !== undefined) updateData.target_url = target_url;
    if (headers !== undefined) updateData.headers = headers;
    if (events !== undefined) updateData.events = events;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (instance_id !== undefined) updateData.instance_id = instance_id;

    const { data: forward, error } = await supabase
      .from("webhook_forwards")
      .update(updateData)
      .eq("id", id)
      .select(`
        *,
        whatsapp_instances(id, name, instance_name)
      `)
      .single();

    if (error) {
      console.error("Error updating webhook forward:", error);
      return NextResponse.json({ error: "Failed to update webhook forward" }, { status: 500 });
    }

    return NextResponse.json({ forward });
  } catch (error) {
    console.error("Error in PUT /api/webhook-forwards/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a webhook forward
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("webhook_forwards")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id);

    if (error) {
      console.error("Error deleting webhook forward:", error);
      return NextResponse.json({ error: "Failed to delete webhook forward" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/webhook-forwards/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
