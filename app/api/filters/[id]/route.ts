import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/filters/[id] - Delete a saved filter
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const filterId = params.id;

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

    // Verify filter belongs to tenant and user can delete it
    const { data: existingFilter } = await supabase
      .from("saved_filters")
      .select("id, user_id")
      .eq("id", filterId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingFilter) {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }

    // Only allow deleting own filters or global filters (if admin)
    if (existingFilter.user_id && existingFilter.user_id !== user.id) {
      return NextResponse.json({ error: "Cannot delete other user's filter" }, { status: 403 });
    }

    const { error } = await supabase
      .from("saved_filters")
      .delete()
      .eq("id", filterId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting filter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/filters/[id] - Update a saved filter
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const filterId = params.id;

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

    // Verify filter belongs to tenant
    const { data: existingFilter } = await supabase
      .from("saved_filters")
      .select("id, user_id, entity_type")
      .eq("id", filterId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingFilter) {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }

    // Only allow updating own filters or global filters
    if (existingFilter.user_id && existingFilter.user_id !== user.id) {
      return NextResponse.json({ error: "Cannot update other user's filter" }, { status: 403 });
    }

    const body = await request.json();
    const { name, filters, is_default } = body;

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from("saved_filters")
        .update({ is_default: false })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("entity_type", existingFilter.entity_type)
        .neq("id", filterId)
        .or(`user_id.is.null,user_id.eq.${user.id}`);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (filters !== undefined) updateData.filters = filters;
    if (is_default !== undefined) updateData.is_default = is_default;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: filter, error } = await supabase
      .from("saved_filters")
      .update(updateData)
      .eq("id", filterId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(filter);
  } catch (error) {
    console.error("Error updating filter:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
