import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/kanban/boards/[id]/stages - List stages for a board
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const boardId = params.id;

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
      .from("kanban_boards")
      .select("id")
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const { data: stages, error } = await supabase
      .from("kanban_stages")
      .select("*")
      .eq("board_id", boardId)
      .order("position", { ascending: true });

    if (error) throw error;

    return NextResponse.json(stages);
  } catch (error) {
    console.error("Error fetching stages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/kanban/boards/[id]/stages - Create a new stage
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const boardId = params.id;

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
      .from("kanban_boards")
      .select("id")
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, color, position } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get max position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const { data: maxStage } = await supabase
        .from("kanban_stages")
        .select("position")
        .eq("board_id", boardId)
        .order("position", { ascending: false })
        .limit(1)
        .single();

      finalPosition = (maxStage?.position ?? -1) + 1;
    }

    const { data: stage, error } = await supabase
      .from("kanban_stages")
      .insert({
        board_id: boardId,
        name,
        color: color || "#6366f1",
        position: finalPosition,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(stage);
  } catch (error) {
    console.error("Error creating stage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
