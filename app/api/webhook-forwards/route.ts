import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all webhook forwards for the tenant
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: forwards, error } = await supabase
      .from("webhook_forwards")
      .select(`
        *,
        whatsapp_instances(id, name, instance_name)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching webhook forwards:", error);
      return NextResponse.json({ error: "Failed to fetch webhook forwards" }, { status: 500 });
    }

    return NextResponse.json({ forwards });
  } catch (error) {
    console.error("Error in GET /api/webhook-forwards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new webhook forward
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { instance_id, name, target_url, headers, events, is_active } = body;

    if (!instance_id || !name || !target_url) {
      return NextResponse.json(
        { error: "instance_id, name, and target_url are required" },
        { status: 400 }
      );
    }

    // Verify the instance belongs to this tenant
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("id", instance_id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Validate URL
    try {
      new URL(target_url);
    } catch {
      return NextResponse.json({ error: "Invalid target URL" }, { status: 400 });
    }

    const { data: forward, error } = await supabase
      .from("webhook_forwards")
      .insert({
        instance_id,
        tenant_id: tenantUser.tenant_id,
        name,
        target_url,
        headers: headers || {},
        events: events || ["MESSAGES_UPSERT", "MESSAGES_UPDATE"],
        is_active: is_active !== false,
      })
      .select(`
        *,
        whatsapp_instances(id, name, instance_name)
      `)
      .single();

    if (error) {
      console.error("Error creating webhook forward:", error);
      return NextResponse.json({ error: "Failed to create webhook forward" }, { status: 500 });
    }

    return NextResponse.json({ forward }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/webhook-forwards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
