import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/kanban/boards - List all boards for the tenant
export async function GET() {
  try {
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

    const { data: boards, error } = await supabase
      .from("kanban_boards")
      .select(`
        *,
        kanban_stages(id, name, color, position)
      `)
      .eq("tenant_id", tenantUser.tenant_id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Count items for each board
    const boardsWithCounts = await Promise.all(
      (boards || []).map(async (board) => {
        let itemCount = 0;

        if (board.entity_type === "chats" || board.entity_type === "both") {
          const { count } = await supabase
            .from("chats")
            .select("*", { count: "exact", head: true })
            .eq("board_id", board.id);
          itemCount += count || 0;
        }

        if (board.entity_type === "leads" || board.entity_type === "both") {
          const { count } = await supabase
            .from("leads")
            .select("*", { count: "exact", head: true })
            .eq("board_id", board.id);
          itemCount += count || 0;
        }

        return {
          ...board,
          item_count: itemCount,
          kanban_stages: (board.kanban_stages || []).sort(
            (a: { position: number }, b: { position: number }) => a.position - b.position
          ),
        };
      })
    );

    return NextResponse.json(boardsWithCounts);
  } catch (error) {
    console.error("Error fetching boards:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/kanban/boards - Create a new board
export async function POST(request: NextRequest) {
  try {
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
    const { name, description, entity_type, filters, is_default, stages } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // If this is set as default, unset other defaults of same entity_type
    if (is_default) {
      await supabase
        .from("kanban_boards")
        .update({ is_default: false })
        .eq("tenant_id", tenantUser.tenant_id)
        .in("entity_type", entity_type === "both" ? ["chats", "leads", "both"] : [entity_type, "both"]);
    }

    // Create board
    const { data: board, error: boardError } = await supabase
      .from("kanban_boards")
      .insert({
        tenant_id: tenantUser.tenant_id,
        name,
        description: description || null,
        entity_type: entity_type || "chats",
        filters: filters || {},
        is_default: is_default || false,
      })
      .select()
      .single();

    if (boardError) throw boardError;

    // Create default stages if provided, otherwise create defaults
    const stagesToCreate = stages || [
      { name: "Novo", color: "#3b82f6", position: 0 },
      { name: "Em Atendimento", color: "#f59e0b", position: 1 },
      { name: "Aguardando", color: "#8b5cf6", position: 2 },
      { name: "Finalizado", color: "#10b981", position: 3 },
    ];

    const { data: createdStages, error: stagesError } = await supabase
      .from("kanban_stages")
      .insert(
        stagesToCreate.map((stage: { name: string; color: string; position: number }, index: number) => ({
          board_id: board.id,
          name: stage.name,
          color: stage.color,
          position: stage.position ?? index,
        }))
      )
      .select();

    if (stagesError) throw stagesError;

    return NextResponse.json({
      ...board,
      kanban_stages: createdStages,
    });
  } catch (error) {
    console.error("Error creating board:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
