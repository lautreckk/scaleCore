import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/tarefas/boards/[id] - Get a single board with columns and tasks
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

    // Get board
    const { data: board, error: boardError } = await supabase
      .from("task_boards")
      .select(`
        *,
        departments(id, name, color)
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Get columns
    const { data: columns } = await supabase
      .from("task_columns")
      .select("*")
      .eq("board_id", id)
      .order("position", { ascending: true });

    // Get tasks with relations
    const { data: tasks } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:assignee_id(id, name, email, avatar_url),
        department:department_id(id, name, color),
        task_checklists(id, title, is_completed, position)
      `)
      .eq("board_id", id)
      .order("position", { ascending: true });

    // Group tasks by column
    const columnsWithTasks = (columns || []).map((column) => ({
      ...column,
      tasks: (tasks || [])
        .filter((task) => task.column_id === column.id)
        .sort((a, b) => a.position - b.position),
    }));

    return NextResponse.json({
      ...board,
      task_columns: columnsWithTasks,
    });
  } catch (error) {
    console.error("Error fetching task board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/tarefas/boards/[id] - Update a board
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

    const body = await request.json();
    const { name, description, color, visibility, department_id, position } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (position !== undefined) updateData.position = position;

    const { data: board, error } = await supabase
      .from("task_boards")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(board);
  } catch (error) {
    console.error("Error updating task board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tarefas/boards/[id] - Delete a board
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
      .from("task_boards")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
