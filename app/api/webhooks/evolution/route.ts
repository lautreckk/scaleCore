import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WebhookForward {
  id: string;
  target_url: string;
  headers: Record<string, string> | null;
  events: string[] | null;
  is_active: boolean;
}

async function forwardWebhookToTargets(
  instanceId: string,
  event: string,
  payload: unknown
) {
  try {
    const { data: forwards } = await supabase
      .from("webhook_forwards")
      .select("id, target_url, headers, events, is_active")
      .eq("instance_id", instanceId)
      .eq("is_active", true);

    if (!forwards || forwards.length === 0) return;

    const forwardPromises = forwards.map(async (forward: WebhookForward) => {
      // Check if this forward should receive this event
      if (forward.events && forward.events.length > 0 && !forward.events.includes(event)) {
        return;
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(forward.headers || {}),
        };

        const response = await fetch(forward.target_url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await supabase
            .from("webhook_forwards")
            .update({ last_success_at: new Date().toISOString() })
            .eq("id", forward.id);
        } else {
          const errorText = await response.text().catch(() => "Unknown error");
          await supabase
            .from("webhook_forwards")
            .update({
              last_error_at: new Date().toISOString(),
              last_error_message: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
            })
            .eq("id", forward.id);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await supabase
          .from("webhook_forwards")
          .update({
            last_error_at: new Date().toISOString(),
            last_error_message: errorMessage.slice(0, 500),
          })
          .eq("id", forward.id);
      }
    });

    // Execute all forwards in parallel without waiting
    Promise.all(forwardPromises).catch(console.error);
  } catch (error) {
    console.error("Error forwarding webhooks:", error);
  }
}

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data?: unknown;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

interface MessageData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      url?: string;
      caption?: string;
    };
    videoMessage?: {
      url?: string;
      caption?: string;
    };
    audioMessage?: {
      url?: string;
    };
    documentMessage?: {
      url?: string;
      fileName?: string;
    };
  };
  messageType?: string;
  messageTimestamp?: number | string;
  status?: string;
}

interface ConnectionData {
  state: "open" | "close" | "connecting";
}

interface QRCodeData {
  code?: string;
  base64?: string;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    console.log("=== EVOLUTION WEBHOOK RECEIVED ===");
    console.log("Raw body:", rawBody.substring(0, 500));

    const payload: EvolutionWebhookPayload = JSON.parse(rawBody);
    const { event: rawEvent, instance: instanceName, data } = payload;

    // Normalize event name: Evolution API v2.3 uses "messages.upsert" format
    // Convert to uppercase with underscore format for consistency
    const event = rawEvent.toUpperCase().replace(/\./g, "_");

    console.log(`Evolution webhook: ${rawEvent} -> ${event} for ${instanceName}`);
    console.log("Payload keys:", Object.keys(payload));

    // Get instance from database
    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("*, tenants(*)")
      .eq("instance_name", instanceName)
      .single();

    if (instanceError || !instance) {
      console.error("Instance not found:", instanceName);
      return NextResponse.json({ success: true }); // Return success to avoid retries
    }

    const tenantId = instance.tenant_id;

    switch (event) {
      case "QRCODE_UPDATED": {
        const qrData = data as QRCodeData;
        await supabase
          .from("whatsapp_instances")
          .update({
            qrcode: qrData.base64 || qrData.code,
            status: "waiting_qr",
          })
          .eq("id", instance.id);
        break;
      }

      case "CONNECTION_UPDATE": {
        const connData = data as ConnectionData;
        const status = connData.state === "open" ? "connected" : "disconnected";

        await supabase
          .from("whatsapp_instances")
          .update({
            status,
            qrcode: status === "connected" ? null : instance.qrcode,
            last_connected_at: status === "connected" ? new Date().toISOString() : instance.last_connected_at,
          })
          .eq("id", instance.id);
        break;
      }

      case "MESSAGES_UPSERT": {
        const messageData = data as MessageData;
        const key = messageData.key;
        const remoteJid = key.remoteJid;
        const fromMe = key.fromMe;
        const messageId = key.id;

        // Extract message content
        let content = "";
        let messageType = "text";
        let mediaUrl: string | null = null;

        if (messageData.message?.conversation) {
          content = messageData.message.conversation;
        } else if (messageData.message?.extendedTextMessage?.text) {
          content = messageData.message.extendedTextMessage.text;
        } else if (messageData.message?.imageMessage) {
          messageType = "image";
          content = messageData.message.imageMessage.caption || "";
          mediaUrl = messageData.message.imageMessage.url || null;
        } else if (messageData.message?.videoMessage) {
          messageType = "video";
          content = messageData.message.videoMessage.caption || "";
          mediaUrl = messageData.message.videoMessage.url || null;
        } else if (messageData.message?.audioMessage) {
          messageType = "audio";
          mediaUrl = messageData.message.audioMessage.url || null;
        } else if (messageData.message?.documentMessage) {
          messageType = "document";
          content = messageData.message.documentMessage.fileName || "";
          mediaUrl = messageData.message.documentMessage.url || null;
        }

        // Skip status messages
        if (remoteJid === "status@broadcast") {
          break;
        }

        // Find or create chat
        let { data: chat } = await supabase
          .from("chats")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("instance_id", instance.id)
          .eq("remote_jid", remoteJid)
          .single();

        if (!chat) {
          // Try to find a lead with this phone number
          const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
          const { data: lead } = await supabase
            .from("leads")
            .select("id")
            .eq("tenant_id", tenantId)
            .or(`phone.ilike.%${phoneNumber}%,phone.ilike.%${phoneNumber.slice(-9)}%`)
            .limit(1)
            .single();

          const { data: newChat, error: chatError } = await supabase
            .from("chats")
            .insert({
              tenant_id: tenantId,
              instance_id: instance.id,
              remote_jid: remoteJid,
              contact_name: messageData.pushName || null,
              lead_id: lead?.id || null,
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : 1,
            })
            .select()
            .single();

          if (chatError) {
            console.error("Error creating chat:", chatError);
            break;
          }
          chat = newChat;
        } else {
          // Update existing chat
          await supabase
            .from("chats")
            .update({
              contact_name: messageData.pushName || undefined,
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : supabase.rpc("increment", { x: 1 }),
            })
            .eq("id", chat.id);
        }

        // Insert message
        if (!chat) break;
        await supabase.from("messages").insert({
          chat_id: chat.id,
          message_id: messageId,
          from_me: fromMe,
          remote_jid: remoteJid,
          message_type: messageType,
          content,
          media_url: mediaUrl,
          status: fromMe ? "sent" : "received",
          timestamp: messageData.messageTimestamp
            ? new Date(Number(messageData.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString(),
        });

        // Update instance message count
        if (fromMe) {
          await supabase
            .from("whatsapp_instances")
            .update({
              total_messages_sent: (instance.total_messages_sent || 0) + 1,
            })
            .eq("id", instance.id);
        }
        break;
      }

      case "MESSAGES_UPDATE": {
        const messageData = data as MessageData;
        const messageId = messageData.key?.id;
        const status = messageData.status;

        if (messageId && status) {
          const statusMap: Record<string, string> = {
            "2": "sent",
            "3": "delivered",
            "4": "read",
            DELIVERY_ACK: "delivered",
            READ: "read",
            PLAYED: "read",
          };

          const newStatus = statusMap[status] || status.toLowerCase();

          await supabase
            .from("messages")
            .update({ status: newStatus })
            .eq("message_id", messageId);
        }
        break;
      }

      case "SEND_MESSAGE": {
        // Message was sent successfully
        const messageData = data as MessageData;
        if (messageData.key?.id) {
          await supabase
            .from("messages")
            .update({ status: "sent" })
            .eq("message_id", messageData.key.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event}`);
    }

    // Forward webhook to configured targets (async, non-blocking)
    forwardWebhookToTargets(instance.id, event, payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Evolution webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
