import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createEvolutionClient } from "@/lib/evolution/client";
import { decrypt } from "@/lib/encryption";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to fetch and save profile picture
async function fetchAndSaveProfilePicture(
  chatId: string,
  remoteJid: string,
  evolutionConfigId: string,
  instanceName: string
) {
  try {
    console.log(`[Profile Picture] Starting fetch for chat ${chatId}, JID: ${remoteJid}`);

    // Get evolution config
    const { data: config } = await supabase
      .from("evolution_api_configs")
      .select("url, api_key_encrypted")
      .eq("id", evolutionConfigId)
      .single();

    if (!config) {
      console.log("[Profile Picture] Evolution config not found");
      return;
    }

    console.log(`[Profile Picture] Using Evolution API: ${config.url}`);

    // Create Evolution client
    const apiKey = decrypt(config.api_key_encrypted);
    const evolutionClient = createEvolutionClient({
      url: config.url,
      apiKey,
    });

    // Extract phone number from JID
    const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    console.log(`[Profile Picture] Fetching for number: ${phoneNumber}, instance: ${instanceName}`);

    // Fetch profile picture
    const result = await evolutionClient.fetchProfilePictureUrl(instanceName, phoneNumber);
    console.log(`[Profile Picture] API Response:`, JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      // Try different response formats
      const data = result.data as Record<string, unknown>;
      const pictureUrl = data.profilePictureUrl || data.wpiUrl || data.url || data.pictureUrl || data.picture;
      console.log(`[Profile Picture] Extracted URL: ${pictureUrl}`);

      if (pictureUrl) {
        await supabase
          .from("chats")
          .update({ profile_picture_url: pictureUrl })
          .eq("id", chatId);

        console.log(`[Profile Picture] Saved for chat ${chatId}`);
      } else {
        console.log(`[Profile Picture] No URL found in response`);
      }
    } else {
      console.log(`[Profile Picture] API call failed or no data: ${result.error || 'no data'}`);
    }
  } catch (error) {
    console.error("[Profile Picture] Error:", error);
  }
}

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
      mimetype?: string;
      base64?: string;
    };
    videoMessage?: {
      url?: string;
      caption?: string;
      mimetype?: string;
      base64?: string;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      base64?: string;
      ptt?: boolean;
    };
    documentMessage?: {
      url?: string;
      fileName?: string;
      mimetype?: string;
      base64?: string;
    };
    stickerMessage?: {
      url?: string;
      mimetype?: string;
      base64?: string;
    };
  };
  messageType?: string;
  messageTimestamp?: number | string;
  status?: string;
}

// Mimetype to extension mapping
const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/opus": "opus",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

// Helper function to upload buffer to Supabase Storage
async function uploadBufferToStorage(
  buffer: Buffer,
  mimetype: string,
  messageId: string,
  tenantId: string
): Promise<string | null> {
  try {
    const extension = EXTENSION_MAP[mimetype] || mimetype.split("/")[1] || "bin";
    const fileName = `${tenantId}/${Date.now()}-${messageId}.${extension}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(fileName, buffer, {
        contentType: mimetype,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading media to storage:", error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("chat-media")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Error uploading buffer to storage:", error);
    return null;
  }
}

// Helper function to download media from URL and upload to Supabase Storage
async function downloadAndUploadMedia(
  url: string,
  mimetype: string,
  messageId: string,
  tenantId: string
): Promise<string | null> {
  try {
    console.log(`[Media] Downloading from URL: ${url.substring(0, 100)}...`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "WhatsApp/2.0",
      },
    });

    if (!response.ok) {
      console.error(`[Media] Failed to download: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Media] Downloaded ${buffer.length} bytes, uploading to storage...`);

    const uploadedUrl = await uploadBufferToStorage(buffer, mimetype, messageId, tenantId);

    if (uploadedUrl) {
      console.log(`[Media] Uploaded successfully: ${uploadedUrl}`);
    }

    return uploadedUrl;
  } catch (error) {
    console.error("[Media] Error downloading/uploading:", error);
    return null;
  }
}

// Helper function to upload base64 media to Supabase Storage
async function uploadMediaToStorage(
  base64Data: string,
  mimetype: string,
  messageId: string,
  tenantId: string
): Promise<string | null> {
  try {
    // Remove data URL prefix if present
    const base64Content = base64Data.replace(/^data:[^;]+;base64,/, "");

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, "base64");

    return await uploadBufferToStorage(buffer, mimetype, messageId, tenantId);
  } catch (error) {
    console.error("Error processing media upload:", error);
    return null;
  }
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

        // Log message data for debugging
        console.log("Message data keys:", Object.keys(messageData));
        if (messageData.message) {
          console.log("Message object keys:", Object.keys(messageData.message));
          // Check if base64 is present in any media message
          if (messageData.message.imageMessage) {
            console.log("imageMessage keys:", Object.keys(messageData.message.imageMessage));
            console.log("Has base64:", !!messageData.message.imageMessage.base64);
          }
          if (messageData.message.audioMessage) {
            console.log("audioMessage keys:", Object.keys(messageData.message.audioMessage));
            console.log("Has base64:", !!messageData.message.audioMessage.base64);
          }
        }

        // Extract message content
        let content = "";
        let messageType = "text";
        let mediaUrl: string | null = null;

        // Helper to get preview text for last_message
        const getLastMessagePreview = (type: string, text: string): string => {
          if (text && text.trim()) return text;
          const preview = (() => {
            switch (type) {
              case "image": return "📷 Imagem";
              case "video": return "🎬 Vídeo";
              case "audio": return "🎵 Áudio";
              case "document": return "📄 Documento";
              case "sticker": return "🎭 Sticker";
              default: return "";
            }
          })();
          console.log(`[Preview] type=${type}, text="${text}", preview="${preview}"`);
          return preview;
        };

        if (messageData.message?.conversation) {
          content = messageData.message.conversation;
        } else if (messageData.message?.extendedTextMessage?.text) {
          content = messageData.message.extendedTextMessage.text;
        } else if (messageData.message?.imageMessage) {
          messageType = "image";
          content = messageData.message.imageMessage.caption || "";
          const imgMimetype = messageData.message.imageMessage.mimetype || "image/jpeg";

          // Try base64 first, then download from URL
          if (messageData.message.imageMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.imageMessage.base64,
              imgMimetype,
              messageId,
              tenantId
            );
          } else if (messageData.message.imageMessage.url) {
            mediaUrl = await downloadAndUploadMedia(
              messageData.message.imageMessage.url,
              imgMimetype,
              messageId,
              tenantId
            );
          }
        } else if (messageData.message?.videoMessage) {
          messageType = "video";
          content = messageData.message.videoMessage.caption || "";
          const vidMimetype = messageData.message.videoMessage.mimetype || "video/mp4";

          if (messageData.message.videoMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.videoMessage.base64,
              vidMimetype,
              messageId,
              tenantId
            );
          } else if (messageData.message.videoMessage.url) {
            mediaUrl = await downloadAndUploadMedia(
              messageData.message.videoMessage.url,
              vidMimetype,
              messageId,
              tenantId
            );
          }
        } else if (messageData.message?.audioMessage) {
          messageType = "audio";
          // Clean mimetype - remove codec info like "; codecs=opus"
          let audMimetype = messageData.message.audioMessage.mimetype || "audio/ogg";
          audMimetype = audMimetype.split(";")[0].trim();

          if (messageData.message.audioMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.audioMessage.base64,
              audMimetype,
              messageId,
              tenantId
            );
          } else if (messageData.message.audioMessage.url) {
            mediaUrl = await downloadAndUploadMedia(
              messageData.message.audioMessage.url,
              audMimetype,
              messageId,
              tenantId
            );
          }
        } else if (messageData.message?.documentMessage) {
          messageType = "document";
          content = messageData.message.documentMessage.fileName || "";
          const docMimetype = messageData.message.documentMessage.mimetype || "application/octet-stream";

          if (messageData.message.documentMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.documentMessage.base64,
              docMimetype,
              messageId,
              tenantId
            );
          } else if (messageData.message.documentMessage.url) {
            mediaUrl = await downloadAndUploadMedia(
              messageData.message.documentMessage.url,
              docMimetype,
              messageId,
              tenantId
            );
          }
        } else if (messageData.message?.stickerMessage) {
          messageType = "sticker";
          const stickerMimetype = messageData.message.stickerMessage.mimetype || "image/webp";

          if (messageData.message.stickerMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.stickerMessage.base64,
              stickerMimetype,
              messageId,
              tenantId
            );
          } else if (messageData.message.stickerMessage.url) {
            mediaUrl = await downloadAndUploadMedia(
              messageData.message.stickerMessage.url,
              stickerMimetype,
              messageId,
              tenantId
            );
          }
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

          const insertPreview = getLastMessagePreview(messageType, content);
          console.log(`[Chat Insert] preview="${insertPreview}", messageType=${messageType}`);

          const { data: newChat, error: chatError } = await supabase
            .from("chats")
            .insert({
              tenant_id: tenantId,
              instance_id: instance.id,
              remote_jid: remoteJid,
              contact_name: messageData.pushName || null,
              lead_id: lead?.id || null,
              last_message: insertPreview,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : 1,
            })
            .select()
            .single();

          if (chatError) {
            console.error("[Chat Insert] Error:", chatError);
            break;
          }
          console.log(`[Chat Insert] Success, id=${newChat?.id}`);
          chat = newChat;

          // Fetch profile picture (wait for it to complete)
          if (newChat && instance.evolution_config_id) {
            await fetchAndSaveProfilePicture(
              newChat.id,
              remoteJid,
              instance.evolution_config_id,
              instanceName
            );
          }
        } else {
          // Update existing chat
          const previewText = getLastMessagePreview(messageType, content);
          console.log(`[Chat Update] chatId=${chat.id}, preview="${previewText}", fromMe=${fromMe}`);

          // Build update object
          const updateData: Record<string, unknown> = {
            last_message: previewText,
            last_message_at: new Date().toISOString(),
          };

          // Only update contact_name if we have one
          if (messageData.pushName) {
            updateData.contact_name = messageData.pushName;
          }

          // For unread_count, we need to handle increment separately
          if (fromMe) {
            updateData.unread_count = 0;
            const { error: updateError } = await supabase
              .from("chats")
              .update(updateData)
              .eq("id", chat.id);

            if (updateError) {
              console.error("[Chat Update] Error:", updateError);
            } else {
              console.log("[Chat Update] Success (fromMe=true)");
            }
          } else {
            // Use raw SQL to increment unread_count
            const { error: updateError } = await supabase.rpc("increment_unread_and_update_chat", {
              p_chat_id: chat.id,
              p_last_message: previewText,
              p_last_message_at: new Date().toISOString(),
              p_contact_name: messageData.pushName || null,
            });

            if (updateError) {
              console.error("[Chat Update] RPC Error:", updateError);
              // Fallback to simple update without increment
              const { error: fallbackError } = await supabase
                .from("chats")
                .update({
                  ...updateData,
                  unread_count: 1, // Just set to 1 as fallback
                })
                .eq("id", chat.id);

              if (fallbackError) {
                console.error("[Chat Update] Fallback Error:", fallbackError);
              } else {
                console.log("[Chat Update] Fallback Success");
              }
            } else {
              console.log("[Chat Update] RPC Success (fromMe=false)");
            }
          }

          // Fetch profile picture if not already set
          if (instance.evolution_config_id) {
            const { data: chatData } = await supabase
              .from("chats")
              .select("profile_picture_url")
              .eq("id", chat.id)
              .single();

            if (chatData && !chatData.profile_picture_url) {
              await fetchAndSaveProfilePicture(
                chat.id,
                remoteJid,
                instance.evolution_config_id,
                instanceName
              );
            }
          }
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
