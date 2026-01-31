import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/kanban/boards/[id]/stages/[stageId] - Update stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const supabase = await createClient();
    const { id: boardId, stageId } = params;

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

    // Verify stage belongs to board
    const { data: existingStage } = await supabase
      .from("kanban_stages")
      .select("id")
      .eq("id", stageId)
      .eq("board_id", boardId)
      .single();

    if (!existingStage) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, color, position } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (position !== undefined) updateData.position = position;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: stage, error } = await supabase
      .from("kanban_stages")
      .update(updateData)
      .eq("id", stageId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(stage);
  } catch (error) {
    console.error("Error updating stage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/kanban/boards/[id]/stages/[stageId] - Delete stage
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  try {
    const supabase = await createClient();
    const { id: boardId, stageId } = params;

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

    // Count stages - don't allow deleting the last stage
    const { count } = await supabase
      .from("kanban_stages")
      .select("*", { count: "exact", head: true })
      .eq("board_id", boardId);

    if ((count || 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last stage" },
        { status: 400 }
      );
    }

    // Get the first stage to move items to
    const { data: firstStage } = await supabase
      .from("kanban_stages")
      .select("id")
      .eq("board_id", boardId)
      .neq("id", stageId)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    if (firstStage) {
      // Move chats from this stage to first stage
      await supabase
        .from("chats")
        .update({ stage_id: firstStage.id })
        .eq("stage_id", stageId);

      // Move leads from this stage to first stage
      await supabase
        .from("leads")
        .update({ stage_id: firstStage.id })
        .eq("stage_id", stageId);
    }

    // Delete the stage
    const { error } = await supabase
      .from("kanban_stages")
      .delete()
      .eq("id", stageId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting stage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
