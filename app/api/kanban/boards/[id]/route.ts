import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/kanban/boards/[id] - Get board details with stages and items
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

    // Get board with stages
    const { data: board, error: boardError } = await supabase
      .from("kanban_boards")
      .select(`
        *,
        kanban_stages(id, name, color, position)
      `)
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Sort stages by position
    const sortedStages = (board.kanban_stages || []).sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    );

    // Get items based on entity_type
    let chats: unknown[] = [];
    let leads: unknown[] = [];

    if (board.entity_type === "chats" || board.entity_type === "both") {
      const { data } = await supabase
        .from("chats")
        .select(`
          id,
          remote_jid,
          contact_name,
          profile_picture_url,
          last_message,
          last_message_at,
          unread_count,
          stage_id,
          tags,
          whatsapp_instances(id, name, color)
        `)
        .eq("board_id", boardId)
        .eq("tenant_id", tenantUser.tenant_id)
        .eq("archived", false)
        .order("last_message_at", { ascending: false });

      chats = (data || []).map((chat) => ({
        ...chat,
        type: "chat",
      }));
    }

    if (board.entity_type === "leads" || board.entity_type === "both") {
      const { data } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          email,
          phone,
          status,
          stage_id,
          tags,
          created_at
        `)
        .eq("board_id", boardId)
        .eq("tenant_id", tenantUser.tenant_id)
        .order("created_at", { ascending: false });

      leads = (data || []).map((lead) => ({
        ...lead,
        type: "lead",
      }));
    }

    // Group items by stage
    const stagesWithItems = sortedStages.map((stage: { id: string; name: string; color: string; position: number }) => {
      const stageChats = chats.filter((c: unknown) => (c as { stage_id: string }).stage_id === stage.id);
      const stageLeads = leads.filter((l: unknown) => (l as { stage_id: string }).stage_id === stage.id);

      return {
        ...stage,
        items: [...stageChats, ...stageLeads],
      };
    });

    // Items without stage go to first stage
    const unassignedChats = chats.filter((c: unknown) => !(c as { stage_id: string }).stage_id);
    const unassignedLeads = leads.filter((l: unknown) => !(l as { stage_id: string }).stage_id);

    if ((unassignedChats.length > 0 || unassignedLeads.length > 0) && stagesWithItems.length > 0) {
      stagesWithItems[0].items = [
        ...unassignedChats,
        ...unassignedLeads,
        ...stagesWithItems[0].items,
      ];
    }

    return NextResponse.json({
      ...board,
      kanban_stages: stagesWithItems,
    });
  } catch (error) {
    console.error("Error fetching board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/kanban/boards/[id] - Update board
export async function PATCH(
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

    const body = await request.json();
    const { name, description, entity_type, filters, is_default } = body;

    // Verify board belongs to tenant
    const { data: existingBoard } = await supabase
      .from("kanban_boards")
      .select("id, entity_type")
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingBoard) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      const targetEntityType = entity_type || existingBoard.entity_type;
      await supabase
        .from("kanban_boards")
        .update({ is_default: false })
        .eq("tenant_id", tenantUser.tenant_id)
        .neq("id", boardId)
        .in("entity_type", targetEntityType === "both" ? ["chats", "leads", "both"] : [targetEntityType, "both"]);
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (entity_type !== undefined) updateData.entity_type = entity_type;
    if (filters !== undefined) updateData.filters = filters;
    if (is_default !== undefined) updateData.is_default = is_default;

    const { data: board, error } = await supabase
      .from("kanban_boards")
      .update(updateData)
      .eq("id", boardId)
      .select(`
        *,
        kanban_stages(id, name, color, position)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      ...board,
      kanban_stages: (board.kanban_stages || []).sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      ),
    });
  } catch (error) {
    console.error("Error updating board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/kanban/boards/[id] - Delete board
export async function DELETE(
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
    const { data: existingBoard } = await supabase
      .from("kanban_boards")
      .select("id, is_default")
      .eq("id", boardId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!existingBoard) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Don't allow deleting the default board if it's the only one
    if (existingBoard.is_default) {
      const { count } = await supabase
        .from("kanban_boards")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantUser.tenant_id);

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the only board" },
          { status: 400 }
        );
      }
    }

    // Delete board (stages will cascade delete)
    const { error } = await supabase
      .from("kanban_boards")
      .delete()
      .eq("id", boardId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
