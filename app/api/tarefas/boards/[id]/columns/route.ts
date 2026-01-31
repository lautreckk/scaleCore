import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/tarefas/boards/[id]/columns - Create a new column
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
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

    // Verify board belongs to tenant
    const { data: board } = await supabase
      .from("task_boards")
      .select("id")
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get max position
    const { data: maxPosData } = await supabase
      .from("task_columns")
      .select("position")
      .eq("board_id", boardId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const newPosition = (maxPosData?.position ?? -1) + 1;

    const { data: column, error } = await supabase
      .from("task_columns")
      .insert({
        board_id: boardId,
        name,
        color: color || "#6366f1",
        position: newPosition,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(column);
  } catch (error) {
    console.error("Error creating column:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/tarefas/boards/[id]/columns - Reorder columns
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: boardId } = await params;
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

    // Verify board belongs to tenant
    const { data: board } = await supabase
      .from("task_boards")
      .select("id")
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const body = await request.json();
    const { columns } = body; // Array of { id, position }

    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json({ error: "Columns array is required" }, { status: 400 });
    }

    // Update each column position
    for (const col of columns) {
      await supabase
        .from("task_columns")
        .update({ position: col.position })
        .eq("id", col.id)
        .eq("board_id", boardId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering columns:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
