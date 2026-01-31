import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/team/members/[id] - Get a specific member
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: member, error } = await supabase
      .from("tenant_users")
      .select(`
        *,
        user_departments(
          department:department_id(id, name, color)
        )
      `)
      .eq("id", params.id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/team/members/[id] - Update a member
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentUser || !["owner", "admin"].includes(currentUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { role, status, permissions, department_ids, max_concurrent_chats, name } = body;

    // Verify member belongs to tenant
    const { data: member } = await supabase
      .from("tenant_users")
      .select("id, role, user_id")
      .eq("id", params.id)
      .eq("tenant_id", currentUser.tenant_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot modify owner unless you are the owner
    if (member.role === "owner" && currentUser.role !== "owner") {
      return NextResponse.json(
        { error: "Não é possível modificar o proprietário" },
        { status: 403 }
      );
    }

    // Cannot change someone to owner
    if (role === "owner" && currentUser.role !== "owner") {
      return NextResponse.json(
        { error: "Apenas o proprietário pode transferir a propriedade" },
        { status: 403 }
      );
    }

    // Cannot modify yourself (for some fields)
    if (member.id === currentUser.id && (role || status)) {
      return NextResponse.json(
        { error: "Não é possível modificar sua própria função ou status" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (max_concurrent_chats !== undefined) updateData.max_concurrent_chats = max_concurrent_chats;
    if (name !== undefined) updateData.name = name;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("tenant_users")
        .update(updateData)
        .eq("id", params.id);

      if (updateError) throw updateError;
    }

    // Update department assignments
    if (department_ids !== undefined) {
      // Remove existing assignments
      await supabase
        .from("user_departments")
        .delete()
        .eq("tenant_user_id", params.id);

      // Add new assignments
      if (department_ids.length > 0) {
        const assignments = department_ids.map((deptId: string) => ({
          tenant_user_id: params.id,
          department_id: deptId,
        }));

        await supabase
          .from("user_departments")
          .insert(assignments);
      }

      // Update primary department_id
      await supabase
        .from("tenant_users")
        .update({ department_id: department_ids[0] || null })
        .eq("id", params.id);
    }

    // Fetch updated member
    const { data: updatedMember } = await supabase
      .from("tenant_users")
      .select(`
        *,
        user_departments(
          department:department_id(id, name, color)
        )
      `)
      .eq("id", params.id)
      .single();

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/team/members/[id] - Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentUser || !["owner", "admin"].includes(currentUser.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify member belongs to tenant
    const { data: member } = await supabase
      .from("tenant_users")
      .select("id, role, user_id")
      .eq("id", params.id)
      .eq("tenant_id", currentUser.tenant_id)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Cannot remove owner
    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Não é possível remover o proprietário" },
        { status: 403 }
      );
    }

    // Cannot remove yourself
    if (member.id === currentUser.id) {
      return NextResponse.json(
        { error: "Não é possível remover a si mesmo" },
        { status: 400 }
      );
    }

    // Remove department assignments first
    await supabase
      .from("user_departments")
      .delete()
      .eq("tenant_user_id", params.id);

    // Remove the member
    const { error } = await supabase
      .from("tenant_users")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
