import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/kanban/items/[type]/[id]/move - Move item to another board/stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: { type: string; id: string } }
) {
  try {
    const supabase = await createClient();
    const { type, id: itemId } = params;

    if (type !== "chat" && type !== "lead") {
      return NextResponse.json(
        { error: "Type must be 'chat' or 'lead'" },
        { status: 400 }
      );
    }

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
    const { boardId, stageId } = body;

    if (!stageId) {
      return NextResponse.json(
        { error: "stageId is required" },
        { status: 400 }
      );
    }

    // Verify stage exists and get board info
    const { data: stage } = await supabase
      .from("kanban_stages")
      .select(`
        id,
        board_id,
        kanban_boards(id, tenant_id, entity_type)
      `)
      .eq("id", stageId)
      .single();

    if (!stage || !stage.kanban_boards) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    // kanban_boards is returned as a single object with .single() query
    const board = stage.kanban_boards as unknown as { id: string; tenant_id: string; entity_type: string };

    // Verify board belongs to tenant
    if (board.tenant_id !== tenantUser.tenant_id) {
      return NextResponse.json({ error: "Stage not found" }, { status: 404 });
    }

    // Verify entity type matches
    if (
      (type === "chat" && board.entity_type === "leads") ||
      (type === "lead" && board.entity_type === "chats")
    ) {
      return NextResponse.json(
        { error: `This board does not accept ${type}s` },
        { status: 400 }
      );
    }

    const tableName = type === "chat" ? "chats" : "leads";

    // Verify item exists and belongs to tenant
    const { data: existingItem } = await supabase
      .from(tableName)
      .select("id")
      .eq("id", itemId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Update item
    const { data: updatedItem, error } = await supabase
      .from(tableName)
      .update({
        board_id: boardId || stage.board_id,
        stage_id: stageId,
      })
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ...updatedItem,
      type,
    });
  } catch (error) {
    console.error("Error moving item:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
