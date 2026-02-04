import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/tarefas/tasks/[id] - Get a single task with details
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

    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:assignee_id(id, name, email, avatar_url),
        department:department_id(id, name, color),
        created_by_user:created_by(id, name, email, avatar_url),
        task_checklists(id, title, is_completed, position),
        task_attachments(id, file_name, file_url, file_type, file_size, uploaded_by, created_at),
        task_comments(
          id,
          content,
          created_at,
          user:user_id(id, name, email, avatar_url)
        )
      `)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (error || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Sort checklists, attachments, and comments
    const sortedTask = {
      ...task,
      task_checklists: (task.task_checklists || []).sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      ),
      task_attachments: (task.task_attachments || []).sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
      task_comments: (task.task_comments || []).sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    };

    return NextResponse.json(sortedTask);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/tarefas/tasks/[id] - Update a task
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
    const {
      title,
      description,
      assignee_id,
      department_id,
      due_date,
      priority,
      labels,
      cover_color,
      completed_at,
    } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assignee_id !== undefined) updateData.assignee_id = assignee_id;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (priority !== undefined) updateData.priority = priority;
    if (labels !== undefined) updateData.labels = labels;
    if (cover_color !== undefined) updateData.cover_color = cover_color;
    if (completed_at !== undefined) updateData.completed_at = completed_at;

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id)
      .select(`
        *,
        assignee:assignee_id(id, name, email, avatar_url),
        department:department_id(id, name, color)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tarefas/tasks/[id] - Delete a task
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
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantUser.tenant_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
