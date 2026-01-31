import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/tarefas/boards - List all task boards for the tenant
export async function GET() {
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

    const { data: boards, error } = await supabase
      .from("task_boards")
      .select(`
        *,
        task_columns(id, name, color, position),
        departments(id, name, color)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .order("position", { ascending: true });

    if (error) throw error;

    // Sort columns by position
    const boardsWithSortedColumns = (boards || []).map((board) => ({
      ...board,
      task_columns: (board.task_columns || []).sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      ),
    }));

    return NextResponse.json(boardsWithSortedColumns);
  } catch (error) {
    console.error("Error fetching task boards:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tarefas/boards - Create a new task board
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
    const { name, description, color, visibility, department_id, columns } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get max position
    const { data: maxPosData } = await supabase
      .from("task_boards")
      .select("position")
      .eq("tenant_id", tenantUser.tenant_id)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const newPosition = (maxPosData?.position ?? -1) + 1;

    // Create board
    const { data: board, error: boardError } = await supabase
      .from("task_boards")
      .insert({
        tenant_id: tenantUser.tenant_id,
        name,
        description: description || null,
        color: color || "#6366f1",
        position: newPosition,
        visibility: visibility || "team",
        department_id: department_id || null,
        created_by: tenantUser.id,
      })
      .select()
      .single();

    if (boardError) throw boardError;

    // Create default columns if not provided
    const columnsToCreate = columns || [
      { name: "A Fazer", color: "#6366f1", position: 0 },
      { name: "Em Progresso", color: "#f59e0b", position: 1 },
      { name: "Concluído", color: "#10b981", position: 2 },
    ];

    const { data: createdColumns, error: columnsError } = await supabase
      .from("task_columns")
      .insert(
        columnsToCreate.map((col: { name: string; color: string; position: number }, index: number) => ({
          board_id: board.id,
          name: col.name,
          color: col.color || "#6366f1",
          position: col.position ?? index,
        }))
      )
      .select();

    if (columnsError) throw columnsError;

    return NextResponse.json({
      ...board,
      task_columns: createdColumns,
    });
  } catch (error) {
    console.error("Error creating task board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
