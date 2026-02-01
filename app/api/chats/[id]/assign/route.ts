import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/chats/[id]/assign - List assignments for a chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify chat belongs to tenant
    const { data: chat } = await supabase
      .from("chats")
      .select("id, tenant_id")
      .eq("id", chatId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get assignments with user details
    const { data: assignments, error } = await supabase
      .from("chat_assignments")
      .select(`
        id,
        tenant_user_id,
        assigned_at,
        assigned_by,
        tenant_users!chat_assignments_tenant_user_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .eq("chat_id", chatId)
      .order("assigned_at", { ascending: true });

    if (error) {
      console.error("Error fetching assignments:", error);
      return NextResponse.json(
        { error: "Failed to fetch assignments" },
        { status: 500 }
      );
    }

    // Format response
    const formattedAssignments = (assignments || []).map((a: any) => ({
      id: a.id,
      tenant_user_id: a.tenant_user_id,
      user_name: a.tenant_users?.name || "Unknown",
      avatar_url: a.tenant_users?.avatar_url || null,
      assigned_at: a.assigned_at,
    }));

    return NextResponse.json({ assignments: formattedAssignments });
  } catch (error) {
    console.error("Error in GET /api/chats/[id]/assign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/chats/[id]/assign - Assign current user to chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id, name")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify chat belongs to tenant
    const { data: chat } = await supabase
      .from("chats")
      .select("id, tenant_id")
      .eq("id", chatId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Check current assignment count (max 3)
    const { count } = await supabase
      .from("chat_assignments")
      .select("*", { count: "exact", head: true })
      .eq("chat_id", chatId);

    if (count !== null && count >= 3) {
      return NextResponse.json(
        { error: "Maximum of 3 attendants reached" },
        { status: 400 }
      );
    }

    // Check if already assigned
    const { data: existingAssignment } = await supabase
      .from("chat_assignments")
      .select("id")
      .eq("chat_id", chatId)
      .eq("tenant_user_id", tenantUser.id)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: "Already assigned to this chat" },
        { status: 400 }
      );
    }

    // Create assignment
    const { data: assignment, error: assignError } = await supabase
      .from("chat_assignments")
      .insert({
        chat_id: chatId,
        tenant_user_id: tenantUser.id,
        assigned_by: tenantUser.id,
      })
      .select()
      .single();

    if (assignError) {
      console.error("Error creating assignment:", assignError);
      return NextResponse.json(
        { error: "Failed to create assignment" },
        { status: 500 }
      );
    }

    // Insert system message
    const { data: chatForMessage } = await supabase
      .from("chats")
      .select("remote_jid")
      .eq("id", chatId)
      .single();

    if (chatForMessage) {
      await supabase.from("messages").insert({
        chat_id: chatId,
        message_id: `system-${Date.now()}`,
        from_me: true,
        remote_jid: chatForMessage.remote_jid,
        message_type: "system",
        content: `${tenantUser.name} começou a atender`,
        status: "system",
        timestamp: new Date().toISOString(),
      });
    }

    // Get updated assignments list
    const { data: assignments } = await supabase
      .from("chat_assignments")
      .select(`
        id,
        tenant_user_id,
        assigned_at,
        tenant_users!chat_assignments_tenant_user_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .eq("chat_id", chatId)
      .order("assigned_at", { ascending: true });

    const formattedAssignments = (assignments || []).map((a: any) => ({
      id: a.id,
      tenant_user_id: a.tenant_user_id,
      user_name: a.tenant_users?.name || "Unknown",
      avatar_url: a.tenant_users?.avatar_url || null,
      assigned_at: a.assigned_at,
    }));

    return NextResponse.json({
      success: true,
      assignment,
      assignments: formattedAssignments,
    });
  } catch (error) {
    console.error("Error in POST /api/chats/[id]/assign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/chats/[id]/assign - Remove assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id, id, name, role")
      .eq("user_id", user.id)
      .single();

    if (!tenantUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get optional userId from body (for admin removing others)
    let targetUserId = tenantUser.id;
    try {
      const body = await request.json();
      if (body.userId && (tenantUser.role === "admin" || tenantUser.role === "owner")) {
        targetUserId = body.userId;
      }
    } catch {
      // No body provided, use current user
    }

    // Verify chat belongs to tenant
    const { data: chat } = await supabase
      .from("chats")
      .select("id, tenant_id, remote_jid")
      .eq("id", chatId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // Get assignment to delete
    const { data: assignment } = await supabase
      .from("chat_assignments")
      .select(`
        id,
        tenant_user_id,
        tenant_users!chat_assignments_tenant_user_id_fkey (
          name
        )
      `)
      .eq("chat_id", chatId)
      .eq("tenant_user_id", targetUserId)
      .single();

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Check permission: must be assigned user or admin
    const isAdmin = tenantUser.role === "admin" || tenantUser.role === "owner";
    const isAssignedUser = assignment.tenant_user_id === tenantUser.id;

    if (!isAdmin && !isAssignedUser) {
      return NextResponse.json(
        { error: "Not authorized to remove this assignment" },
        { status: 403 }
      );
    }

    // Delete assignment
    const { error: deleteError } = await supabase
      .from("chat_assignments")
      .delete()
      .eq("id", assignment.id);

    if (deleteError) {
      console.error("Error deleting assignment:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete assignment" },
        { status: 500 }
      );
    }

    // Insert system message
    const removedUserName = (assignment as any).tenant_users?.name || "Usuário";
    await supabase.from("messages").insert({
      chat_id: chatId,
      message_id: `system-${Date.now()}`,
      from_me: true,
      remote_jid: chat.remote_jid,
      message_type: "system",
      content: `${removedUserName} saiu do atendimento`,
      status: "system",
      timestamp: new Date().toISOString(),
    });

    // Get updated assignments list
    const { data: assignments } = await supabase
      .from("chat_assignments")
      .select(`
        id,
        tenant_user_id,
        assigned_at,
        tenant_users!chat_assignments_tenant_user_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .eq("chat_id", chatId)
      .order("assigned_at", { ascending: true });

    const formattedAssignments = (assignments || []).map((a: any) => ({
      id: a.id,
      tenant_user_id: a.tenant_user_id,
      user_name: a.tenant_users?.name || "Unknown",
      avatar_url: a.tenant_users?.avatar_url || null,
      assigned_at: a.assigned_at,
    }));

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments,
    });
  } catch (error) {
    console.error("Error in DELETE /api/chats/[id]/assign:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
