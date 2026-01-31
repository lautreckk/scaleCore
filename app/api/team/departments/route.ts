import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/team/departments - List all departments
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
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: departments, error } = await supabase
      .from("departments")
      .select("*")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("name");

    if (error) throw error;

    return NextResponse.json(departments || []);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/team/departments - Create a new department
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

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, color, is_default } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from("departments")
        .update({ is_default: false })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("is_default", true);
    }

    const { data: department, error } = await supabase
      .from("departments")
      .insert({
        tenant_id: tenantUser.tenant_id,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || "#3b82f6",
        is_default: is_default || false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe um departamento com este nome" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/team/departments - Update a department
export async function PATCH(request: NextRequest) {
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

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, color, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify department belongs to tenant
    const { data: existingDept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from("departments")
        .update({ is_default: false })
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("is_default", true)
        .neq("id", id);
    }

    const { data: department, error } = await supabase
      .from("departments")
      .update({
        name: name?.trim(),
        description: description?.trim() || null,
        color: color || "#3b82f6",
        is_default: is_default || false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe um departamento com este nome" },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error updating department:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/team/departments - Delete a department
export async function DELETE(request: NextRequest) {
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

    if (!tenantUser || !["owner", "admin"].includes(tenantUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    // Verify department belongs to tenant
    const { data: existingDept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingDept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting department:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
