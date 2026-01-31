import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/tarefas/columns/[id] - Update a column
export async function PATCH(
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

    // Verify column belongs to a board in tenant
    const { data: column } = await supabase
      .from("task_columns")
      .select(`
        id,
        board:board_id(id, tenant_id)
      `)
      .eq("id", id)
      .single();

    const boardData = column?.board as unknown as { tenant_id: string } | null;
    if (!column || !boardData || boardData.tenant_id !== tenantUser.tenant_id) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, color, position } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (position !== undefined) updateData.position = position;

    const { data: updatedColumn, error } = await supabase
      .from("task_columns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updatedColumn);
  } catch (error) {
    console.error("Error updating column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tarefas/columns/[id] - Delete a column
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

    // Verify column belongs to a board in tenant
    const { data: column } = await supabase
      .from("task_columns")
      .select(`
        id,
        board_id,
        board:board_id(id, tenant_id)
      `)
      .eq("id", id)
      .single();

    const boardData2 = column?.board as unknown as { tenant_id: string } | null;
    if (!column || !boardData2 || boardData2.tenant_id !== tenantUser.tenant_id) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    // Check if this is the only column
    const { count } = await supabase
      .from("task_columns")
      .select("*", { count: "exact", head: true })
      .eq("board_id", column.board_id);

    if (count === 1) {
      return NextResponse.json(
        { error: "Cannot delete the last column" },
        { status: 400 }
      );
    }

    // Get first column to move tasks to
    const { data: firstColumn } = await supabase
      .from("task_columns")
      .select("id")
      .eq("board_id", column.board_id)
      .neq("id", id)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    if (firstColumn) {
      // Move tasks to first column
      await supabase
        .from("tasks")
        .update({ column_id: firstColumn.id })
        .eq("column_id", id);
    }

    // Delete column
    const { error } = await supabase
      .from("task_columns")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
