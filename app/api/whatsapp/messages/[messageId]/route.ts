import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEvolutionClientByInstanceName } from "@/lib/evolution/config";

// DELETE /api/whatsapp/messages/[messageId]
// Delete a message for everyone
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
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

    const { searchParams } = new URL(request.url);
    const instanceName = searchParams.get("instanceName");

    if (!instanceName) {
      return NextResponse.json(
        { error: "Missing instanceName parameter" },
        { status: 400 }
      );
    }

    // Get message details
    const { data: message } = await supabase
      .from("messages")
      .select(`
        id,
        message_id,
        remote_jid,
        from_me,
        chats!inner(tenant_id)
      `)
      .eq("message_id", messageId)
      .single();

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Verify tenant access
    const chatData = message.chats as unknown as { tenant_id: string };
    if (chatData.tenant_id !== tenantUser.tenant_id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Only allow deleting own messages
    if (!message.from_me) {
      return NextResponse.json(
        { error: "Can only delete your own messages" },
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

    // Delete message in WhatsApp
    const result = await client.deleteMessageForEveryone(instanceName, {
      id: message.message_id,
      remoteJid: message.remote_jid,
      fromMe: message.from_me,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to delete message" },
        { status: 500 }
      );
    }

    // Update local database - mark as deleted
    await supabase
      .from("messages")
      .update({
        content: "[Mensagem apagada]",
        message_type: "deleted",
        media_url: null,
      })
      .eq("id", message.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/whatsapp/messages/[messageId]
// Edit a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
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
    const { instanceName, text } = body;

    if (!instanceName || !text) {
      return NextResponse.json(
        { error: "Missing required fields: instanceName, text" },
        { status: 400 }
      );
    }

    // Get message details
    const { data: message } = await supabase
      .from("messages")
      .select(`
        id,
        message_id,
        remote_jid,
        from_me,
        message_type,
        chats!inner(tenant_id)
      `)
      .eq("message_id", messageId)
      .single();

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Verify tenant access
    const chatData = message.chats as unknown as { tenant_id: string };
    if (chatData.tenant_id !== tenantUser.tenant_id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Only allow editing own text messages
    if (!message.from_me) {
      return NextResponse.json(
        { error: "Can only edit your own messages" },
        { status: 400 }
      );
    }

    if (message.message_type !== "text") {
      return NextResponse.json(
        { error: "Can only edit text messages" },
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
    const phoneNumber = message.remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // Edit message in WhatsApp
    const result = await client.updateMessage(instanceName, {
      number: phoneNumber,
      key: {
        remoteJid: message.remote_jid,
        fromMe: message.from_me,
        id: message.message_id,
      },
      text,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to edit message" },
        { status: 500 }
      );
    }

    // Update local database
    await supabase
      .from("messages")
      .update({ content: text })
      .eq("id", message.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error editing message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
