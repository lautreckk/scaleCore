import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// POST /api/whatsapp/chat/archive
// Archive or unarchive a chat in WhatsApp
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
    const { instanceName, chatId, archive } = body;

    if (!instanceName || !chatId || archive === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: instanceName, chatId, archive" },
        { status: 400 }
      );
    }

    // Get chat details
    const { data: chat } = await supabase
      .from("chats")
      .select("remote_jid")
      .eq("id", chatId)
      .eq("tenant_id", tenantUser.tenant_id)
      .single();

    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
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

    // Get the last message for the archive API
    const { data: lastMessage } = await supabase
      .from("messages")
      .select("message_id, remote_jid, from_me")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      const result = await client.archiveChat(instanceName, {
        lastMessage: {
          key: {
            remoteJid: lastMessage.remote_jid,
            fromMe: lastMessage.from_me,
            id: lastMessage.message_id,
          },
        },
        chat: chat.remote_jid,
        archive,
      });

      if (!result.success) {
        console.error("Failed to archive chat in WhatsApp:", result.error);
        // Continue to update local DB even if WhatsApp fails
      }
    }

    // Update local database
    await supabase
      .from("chats")
      .update({ archived: archive })
      .eq("id", chatId);

    return NextResponse.json({ success: true, archived: archive });
  } catch (error) {
    console.error("Error archiving chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
