import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/tarefas/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      board_id,
      column_id,
      title,
      description,
      assignee_id,
      department_id,
      due_date,
      priority,
      labels,
      cover_color,
    } = body;

    if (!board_id || !column_id || !title) {
      return NextResponse.json(
        { error: "board_id, column_id and title are required" },
        { status: 400 }
      );
    }

    // Verify board and column belong to tenant
    const { data: board } = await supabase
      .from("task_boards")
      .select("id")
      .eq("id", board_id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const { data: column } = await supabase
      .from("task_columns")
      .select("id")
      .eq("id", column_id)
      .eq("board_id", board_id)
      .single();

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    // Get max position in column
    const { data: maxPosData } = await supabase
      .from("tasks")
      .select("position")
      .eq("column_id", column_id)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const newPosition = (maxPosData?.position ?? -1) + 1;

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        tenant_id: tenantUser.tenant_id,
        board_id,
        column_id,
        title,
        description: description || null,
        position: newPosition,
        assignee_id: assignee_id || null,
        department_id: department_id || null,
        due_date: due_date || null,
        priority: priority || "medium",
        labels: labels || [],
        cover_color: cover_color || null,
        created_by: tenantUser.id,
      })
      .select(`
        *,
        assignee:assignee_id(id, name, email, avatar_url),
        department:department_id(id, name, color)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
