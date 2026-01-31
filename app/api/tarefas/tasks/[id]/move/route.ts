import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/tarefas/tasks/[id]/move - Move a task to a different column/position
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
    const { column_id, position } = body;

    if (!column_id) {
      return NextResponse.json(
        { error: "column_id is required" },
        { status: 400 }
      );
    }

    // Verify task belongs to tenant
    const { data: task } = await supabase
      .from("tasks")
      .select("id, column_id, board_id, position")
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify column belongs to the same board
    const { data: column } = await supabase
      .from("task_columns")
      .select("id, board_id")
      .eq("id", column_id)
      .eq("board_id", task.board_id)
      .single();

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    // Determine new position
    let newPosition = position;
    if (newPosition === undefined) {
      // Get max position in target column
      const { data: maxPosData } = await supabase
        .from("tasks")
        .select("position")
        .eq("column_id", column_id)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      newPosition = (maxPosData?.position ?? -1) + 1;
    }

    // Update task
    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update({
        column_id,
        position: newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        assignee:assignee_id(id, name, email, avatar_url),
        department:department_id(id, name, color)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Error moving task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
