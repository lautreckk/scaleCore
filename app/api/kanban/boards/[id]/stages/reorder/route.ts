import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/kanban/boards/[id]/stages/reorder - Reorder stages
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
    const { stageIds } = body;

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return NextResponse.json(
        { error: "stageIds array is required" },
        { status: 400 }
      );
    }

    // Verify all stages belong to this board
    const { data: existingStages } = await supabase
      .from("kanban_stages")
      .select("id")
      .eq("board_id", boardId)
      .in("id", stageIds);

    if (!existingStages || existingStages.length !== stageIds.length) {
      return NextResponse.json(
        { error: "Some stages do not belong to this board" },
        { status: 400 }
      );
    }

    // Update positions for each stage
    const updatePromises = stageIds.map((stageId: string, index: number) =>
      supabase
        .from("kanban_stages")
        .update({ position: index })
        .eq("id", stageId)
    );

    await Promise.all(updatePromises);

    // Fetch updated stages
    const { data: stages, error } = await supabase
      .from("kanban_stages")
      .select("*")
      .eq("board_id", boardId)
      .order("position", { ascending: true });

    if (error) throw error;

    return NextResponse.json(stages);
  } catch (error) {
    console.error("Error reordering stages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
