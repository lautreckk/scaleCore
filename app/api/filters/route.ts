import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/filters - List saved filters
export async function GET(request: NextRequest) {
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

    const entityType = request.nextUrl.searchParams.get("entity_type");

    let query = supabase
      .from("saved_filters")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data: filters, error } = await query;

    if (error) throw error;

    return NextResponse.json(filters);
  } catch (error) {
    console.error("Error fetching filters:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/filters - Create a new saved filter
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
    const { name, entity_type, filters, is_default, is_global } = body;

    if (!name || !entity_type) {
      return NextResponse.json(
        { error: "Name and entity_type are required" },
        { status: 400 }
      );
    }

    if (!["leads", "chats"].includes(entity_type)) {
      return NextResponse.json(
        { error: "entity_type must be 'leads' or 'chats'" },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults for this user/entity_type
    if (is_default) {
      await supabase
        .from("saved_filters")
        .update({ is_default: false })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("entity_type", entity_type)
        .or(`user_id.is.null,user_id.eq.${user.id}`);
    }

    const { data: filter, error } = await supabase
      .from("saved_filters")
      .insert({
        tenant_id: tenantUser.tenant_id,
        user_id: is_global ? null : user.id,
        name,
        entity_type,
        filters: filters || {},
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(filter);
  } catch (error) {
    console.error("Error creating filter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
