import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// POST /api/whatsapp/chat/read
// Mark messages as read in WhatsApp
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { instanceName, chatId, messages } = body;

    if (!instanceName || !chatId) {
      return NextResponse.json(
        { error: "Missing required fields: instanceName, chatId" },
        { status: 400 }
      );
    }

    const clientData = await getEvolutionClientByInstanceName(
      instanceName,
      tenantUser.tenant_id
    );

    if (!clientData) {
      return NextResponse.json(
        { error: "Instance not found" },
        { status: 404 }
      );
    }

    const { client } = clientData;

    // Get unread messages from the chat if not provided
    let messagesToMark = messages;
    if (!messagesToMark || messagesToMark.length === 0) {
      // Get the last unread messages
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("message_id, remote_jid, from_me")
        .eq("chat_id", chatId)
        .eq("from_me", false)
        .in("status", ["received", "delivered"])
        .order("timestamp", { ascending: false })
        .limit(50);

      if (unreadMessages && unreadMessages.length > 0) {
        messagesToMark = unreadMessages.map(m => ({
          remoteJid: m.remote_jid,
          fromMe: m.from_me,
          id: m.message_id,
        }));
      }
    }

    if (messagesToMark && messagesToMark.length > 0) {
      const result = await client.markMessageAsRead(instanceName, {
        readMessages: messagesToMark,
      });

      if (!result.success) {
        console.error("Failed to mark messages as read in WhatsApp:", result.error);
        // Don't fail - still update local DB
      }
    }

    // Update local database
    await supabase
      .from("chats")
      .update({ unread_count: 0 })
      .eq("id", chatId);

    // Update message statuses
    if (messagesToMark && messagesToMark.length > 0) {
      const messageIds = messagesToMark.map((m: { id: string }) => m.id);
      await supabase
        .from("messages")
        .update({ status: "read" })
        .in("message_id", messageIds);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
