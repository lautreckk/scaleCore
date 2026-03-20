import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createEvolutionClient } from "@/lib/evolution/client";
import { decrypt } from "@/lib/encryption";
import { processAgentMessage } from "@/lib/agents/pipeline";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to format phone number for display
function formatPhoneForDisplay(phone: string): string {
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");

  // Brazilian phone: 55 + DDD (2) + number (8-9)
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  // International format
  if (digits.length > 10) {
    return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  }

  return phone;
}

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

// Helper function to get base64 from Evolution API and upload to storage
async function getMediaBase64AndUpload(
  evolutionConfigId: string,
  instanceName: string,
  messageId: string,
  mimetype: string,
  tenantId: string
): Promise<string | null> {
  try {
    console.log(`[Media Base64] Fetching base64 for message ${messageId}`);

    // Get evolution config
    const { data: config } = await supabase
      .from("evolution_api_configs")
      .select("url, api_key_encrypted")
      .eq("id", evolutionConfigId)
      .single();

    if (!config) {
      console.log("[Media Base64] Evolution config not found");
      return null;
    }

    // Create Evolution client
    const apiKey = decrypt(config.api_key_encrypted);
    const evolutionClient = createEvolutionClient({
      url: config.url,
      apiKey,
    });

    // Get base64 from Evolution API
    console.log(`[Media Base64] Calling Evolution API: ${config.url}/chat/getBase64FromMediaMessage/${instanceName}`);
    console.log(`[Media Base64] Request body: { message: { key: { id: "${messageId}" } } }`);

    const result = await evolutionClient.getBase64FromMediaMessage(instanceName, messageId);

    console.log(`[Media Base64] Response success: ${result.success}`);
    if (!result.success || !result.data?.base64) {
      console.error("[Media Base64] Failed to get base64:", JSON.stringify(result, null, 2));
      return null;
    }

    console.log(`[Media Base64] Got base64, length: ${result.data.base64.length}, mimetype: ${result.data.mimetype || mimetype}`);

    // Use mimetype from response if available
    const finalMimetype = result.data.mimetype || mimetype;

    // Upload to storage
    const uploadedUrl = await uploadMediaToStorage(
      result.data.base64,
      finalMimetype,
      messageId,
      tenantId
    );

    if (uploadedUrl) {
      console.log(`[Media Base64] Uploaded to storage: ${uploadedUrl}`);
    }

    return uploadedUrl;
  } catch (error) {
    console.error("[Media Base64] Error:", error);
    return null;
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
    participant?: string; // JID of sender in group chats
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
    // Clean mimetype - remove codec info like "; codecs=opus"
    const cleanMimetype = mimetype.split(";")[0].trim();
    const extension = EXTENSION_MAP[cleanMimetype] || cleanMimetype.split("/")[1] || "bin";
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

        const updateData: Record<string, unknown> = {
          status,
          qrcode: status === "connected" ? null : instance.qrcode,
          last_connected_at: status === "connected" ? new Date().toISOString() : instance.last_connected_at,
        };

        // When connected, try to fetch the phone number
        if (status === "connected" && instance.evolution_config_id) {
          try {
            const { data: config } = await supabase
              .from("evolution_api_configs")
              .select("url, api_key_encrypted")
              .eq("id", instance.evolution_config_id)
              .single();

            if (config) {
              const apiKey = decrypt(config.api_key_encrypted);
              const evolutionClient = createEvolutionClient({
                url: config.url,
                apiKey,
              });

              // Fetch instance profile to get phone number
              const profileResult = await evolutionClient.fetchProfile(instanceName);
              console.log(`[CONNECTION_UPDATE] Profile result for ${instanceName}:`, JSON.stringify(profileResult, null, 2));

              if (profileResult.success && profileResult.data) {
                // wuid format is typically "5511999999999@s.whatsapp.net"
                const wuid = profileResult.data.wuid;
                if (wuid) {
                  const phoneNumber = wuid.replace("@s.whatsapp.net", "").replace("@c.us", "");
                  updateData.phone_number = phoneNumber;
                  console.log(`[CONNECTION_UPDATE] Saved phone number for ${instanceName}: ${phoneNumber}`);
                }
              }
            }
          } catch (error) {
            console.error(`[CONNECTION_UPDATE] Error fetching profile for ${instanceName}:`, error);
          }
        }

        await supabase
          .from("whatsapp_instances")
          .update(updateData)
          .eq("id", instance.id);
        break;
      }

      case "MESSAGES_UPSERT": {
        const messageData = data as MessageData;
        const key = messageData.key;
        const remoteJid = key.remoteJid;
        const fromMe = key.fromMe;
        const messageId = key.id;

        // For group messages, extract participant info
        const isGroup = remoteJid.endsWith("@g.us");

        // Skip group messages - we don't want groups in the chat
        if (isGroup) {
          console.log(`[WEBHOOK] Skipping group message from: ${remoteJid}`);
          break;
        }

        const participantJid = isGroup ? key.participant : null;
        const participantName = isGroup && !fromMe ? messageData.pushName : null;

        // Log message data for debugging
        console.log("[WEBHOOK DEBUG] messageData keys:", Object.keys(messageData));
        console.log("[WEBHOOK DEBUG] Full messageData.message:", JSON.stringify(messageData.message, null, 2));
        if (messageData.message) {
          console.log("[WEBHOOK DEBUG] Message object keys:", Object.keys(messageData.message));
        }

        // Extract message content
        let content = "";
        let messageType = "text";
        let mediaUrl: string | null = null;

        // Map of media type to preview text
        const MEDIA_PREVIEW_MAP: Record<string, string> = {
          image: "[Imagem]",
          video: "[Video]",
          audio: "[Audio]",
          document: "[Documento]",
          sticker: "[Sticker]",
        };

        // Helper to get preview text for last_message
        const getLastMessagePreview = (type: string, text: string): string => {
          if (text && text.trim()) return text.trim().substring(0, 100);
          const preview = MEDIA_PREVIEW_MAP[type] || "";
          console.log(`[Preview] type=${type}, text="${text}", preview="${preview}"`);
          return preview;
        };

        if (messageData.message?.conversation) {
          console.log("[MESSAGE TYPE] conversation");
          content = messageData.message.conversation;
        } else if (messageData.message?.extendedTextMessage?.text) {
          console.log("[MESSAGE TYPE] extendedTextMessage");
          content = messageData.message.extendedTextMessage.text;
        } else if (messageData.message?.imageMessage) {
          console.log("[MESSAGE TYPE] imageMessage");
          console.log("[IMAGE] Keys in imageMessage:", Object.keys(messageData.message.imageMessage));
          console.log("[IMAGE] Has base64:", !!messageData.message.imageMessage.base64);
          console.log("[IMAGE] Has url:", !!messageData.message.imageMessage.url);
          if (messageData.message.imageMessage.base64) {
            console.log("[IMAGE] base64 length:", messageData.message.imageMessage.base64.length);
          }
          messageType = "image";
          content = messageData.message.imageMessage.caption || "";
          const imgMimetype = messageData.message.imageMessage.mimetype || "image/jpeg";

          // Try base64 first, then fetch via Evolution API
          if (messageData.message.imageMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.imageMessage.base64,
              imgMimetype,
              messageId,
              tenantId
            );
          } else if (instance.evolution_config_id) {
            // Fetch base64 via Evolution API (URLs from WhatsApp are encrypted)
            mediaUrl = await getMediaBase64AndUpload(
              instance.evolution_config_id,
              instanceName,
              messageId,
              imgMimetype,
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
          } else if (instance.evolution_config_id) {
            mediaUrl = await getMediaBase64AndUpload(
              instance.evolution_config_id,
              instanceName,
              messageId,
              vidMimetype,
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
          } else if (instance.evolution_config_id) {
            mediaUrl = await getMediaBase64AndUpload(
              instance.evolution_config_id,
              instanceName,
              messageId,
              audMimetype,
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
          } else if (instance.evolution_config_id) {
            mediaUrl = await getMediaBase64AndUpload(
              instance.evolution_config_id,
              instanceName,
              messageId,
              docMimetype,
              tenantId
            );
          }
        } else if (messageData.message?.stickerMessage) {
          console.log("[MESSAGE TYPE] stickerMessage");
          messageType = "sticker";
          const stickerMimetype = messageData.message.stickerMessage.mimetype || "image/webp";

          if (messageData.message.stickerMessage.base64) {
            mediaUrl = await uploadMediaToStorage(
              messageData.message.stickerMessage.base64,
              stickerMimetype,
              messageId,
              tenantId
            );
          } else if (instance.evolution_config_id) {
            mediaUrl = await getMediaBase64AndUpload(
              instance.evolution_config_id,
              instanceName,
              messageId,
              stickerMimetype,
              tenantId
            );
          }
        } else {
          console.log("[MESSAGE TYPE] UNKNOWN - no matching message type found");
          console.log("[MESSAGE TYPE] Full message object:", JSON.stringify(messageData.message, null, 2));
          // Skip unknown message types (protocol messages, reactions, etc.)
          // Don't create/update chat for these
          break;
        }

        // Skip status messages
        if (remoteJid === "status@broadcast") {
          break;
        }

        // Find open chat (protocol system: only look for non-closed chats)
        let { data: chat } = await supabase
          .from("chats")
          .select("id, status, lead_id, tags")
          .eq("tenant_id", tenantId)
          .eq("instance_id", instance.id)
          .eq("remote_jid", remoteJid)
          .or("status.is.null,status.eq.open")
          .single();

        // If message is from us (fromMe) and no open chat, try to reopen most recent
        if (!chat && fromMe) {
          const { data: recentChat } = await supabase
            .from("chats")
            .select("id, status, lead_id, tags")
            .eq("tenant_id", tenantId)
            .eq("instance_id", instance.id)
            .eq("remote_jid", remoteJid)
            .order("last_message_at", { ascending: false })
            .limit(1)
            .single();

          if (recentChat) {
            // Reopen if was closed
            if (recentChat.status === "closed") {
              await supabase
                .from("chats")
                .update({ status: "open" })
                .eq("id", recentChat.id);
              console.log(`[Chat Reopen] Reopened chat ${recentChat.id} for outgoing message`);
            }
            chat = recentChat;
          }
        }

        if (!chat) {
          // Check if there's a closed chat to reuse the lead_id
          let existingLeadId: string | null = null;
          const { data: closedChat } = await supabase
            .from("chats")
            .select("lead_id")
            .eq("tenant_id", tenantId)
            .eq("instance_id", instance.id)
            .eq("remote_jid", remoteJid)
            .eq("status", "closed")
            .order("last_message_at", { ascending: false })
            .limit(1)
            .single();

          if (closedChat?.lead_id) {
            existingLeadId = closedChat.lead_id;
            console.log(`[Protocol System] Found closed chat with lead_id ${existingLeadId}, will reuse for new chat`);
          }

          // Try to find a lead with this phone number (or use existing from closed chat)
          const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
          let leadId = existingLeadId;

          if (!leadId) {
            const { data: foundLead } = await supabase
              .from("leads")
              .select("id")
              .eq("tenant_id", tenantId)
              .or(`phone.ilike.%${phoneNumber}%,phone.ilike.%${phoneNumber.slice(-9)}%`)
              .limit(1)
              .single();

            if (foundLead) {
              leadId = foundLead.id;
            }
          }

          // If no lead found, create one automatically
          if (!leadId) {
            const contactName = messageData.pushName || formatPhoneForDisplay(phoneNumber);
            const instanceTag = instance.name || instanceName;

            console.log(`[Lead Auto-Create] Creating lead for phone ${phoneNumber}, name: ${contactName}`);

            // Get default board and first stage for leads
            let leadBoardId: string | null = null;
            let leadStageId: string | null = null;

            const { data: leadBoard } = await supabase
              .from("kanban_boards")
              .select(`
                id,
                kanban_stages(id, position)
              `)
              .eq("tenant_id", tenantId)
              .eq("is_default", true)
              .in("entity_type", ["leads", "both"])
              .limit(1)
              .single();

            if (leadBoard) {
              leadBoardId = leadBoard.id;
              const stages = leadBoard.kanban_stages as Array<{ id: string; position: number }>;
              if (stages && stages.length > 0) {
                const sortedStages = stages.sort((a, b) => a.position - b.position);
                leadStageId = sortedStages[0].id;
              }
            }

            const { data: newLead, error: leadError } = await supabase
              .from("leads")
              .insert({
                tenant_id: tenantId,
                name: contactName,
                phone: phoneNumber,
                status: "new",
                source: "whatsapp",
                tags: ["whatsapp", instanceTag],
                board_id: leadBoardId,
                stage_id: leadStageId,
              })
              .select("id")
              .single();

            if (leadError) {
              console.error("[Lead Auto-Create] Error:", leadError);
            } else if (newLead) {
              leadId = newLead.id;
              console.log(`[Lead Auto-Create] Success, id=${newLead.id}`);
            }
          }

          // Get default board and first stage for this tenant (for chats)
          let defaultBoardId: string | null = null;
          let defaultStageId: string | null = null;

          const { data: defaultBoard } = await supabase
            .from("kanban_boards")
            .select(`
              id,
              kanban_stages(id, position)
            `)
            .eq("tenant_id", tenantId)
            .eq("is_default", true)
            .in("entity_type", ["chats", "both"])
            .limit(1)
            .single();

          if (defaultBoard) {
            defaultBoardId = defaultBoard.id;
            // Get first stage (position = 0)
            const stages = defaultBoard.kanban_stages as Array<{ id: string; position: number }>;
            if (stages && stages.length > 0) {
              const sortedStages = stages.sort((a, b) => a.position - b.position);
              defaultStageId = sortedStages[0].id;
            }
          }

          let insertPreview = getLastMessagePreview(messageType, content);
          // Fallback: if preview is still empty for a known media type, use map directly
          if (!insertPreview && MEDIA_PREVIEW_MAP[messageType]) {
            insertPreview = MEDIA_PREVIEW_MAP[messageType];
          }
          console.log(`[Chat Insert] preview="${insertPreview}", messageType=${messageType}`);

          const { data: newChat, error: chatError } = await supabase
            .from("chats")
            .insert({
              tenant_id: tenantId,
              instance_id: instance.id,
              remote_jid: remoteJid,
              // Only use pushName for contact_name if message is FROM the contact
              // When fromMe=true, pushName is OUR name, not the contact's
              contact_name: !fromMe ? (messageData.pushName || null) : null,
              lead_id: leadId || null,
              last_message: insertPreview,
              last_message_type: messageType,
              last_message_from_me: fromMe,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : 1,
              board_id: defaultBoardId,
              stage_id: defaultStageId,
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
          console.log(`[BEFORE PREVIEW] messageType=${messageType}, content="${content}", mediaUrl=${mediaUrl}`);
          let previewText = getLastMessagePreview(messageType, content);
          // Fallback: if preview is still empty for a known media type, use map directly
          if (!previewText && MEDIA_PREVIEW_MAP[messageType]) {
            previewText = MEDIA_PREVIEW_MAP[messageType];
          }
          console.log(`[Chat Update] chatId=${chat.id}, messageType=${messageType}, content="${content}", preview="${previewText}", fromMe=${fromMe}`);

          // Build update object
          const updateData: Record<string, unknown> = {
            last_message_at: new Date().toISOString(),
            last_message_from_me: fromMe,
            last_message_type: messageType,
          };

          // Only update last_message if we have a valid preview (not empty)
          if (previewText) {
            updateData.last_message = previewText;
          } else {
            console.log(`[Chat Update] Skipping last_message update - preview is empty`);
          }

          // Only update contact_name if message is FROM the contact (not from us)
          // pushName when fromMe=true is OUR name, not the contact's name
          if (messageData.pushName && !fromMe) {
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
            // Increment unread_count for incoming messages
            console.log(`[Direct Update] chatId=${chat.id}, previewText="${previewText}"`);

            const { data: currentChat } = await supabase
              .from("chats")
              .select("unread_count")
              .eq("id", chat.id)
              .single();

            const newUnreadCount = (currentChat?.unread_count || 0) + 1;
            updateData.unread_count = newUnreadCount;

            if (messageData.pushName) {
              updateData.contact_name = messageData.pushName;
            }

            console.log(`[Direct Update] payload:`, JSON.stringify(updateData));

            const { error: updateError, data: updateResult } = await supabase
              .from("chats")
              .update(updateData)
              .eq("id", chat.id)
              .select("id, last_message, last_message_at, unread_count");

            if (updateError) {
              console.error("[Chat Update] Error:", updateError);
            } else {
              console.log("[Chat Update] Success, returned:", JSON.stringify(updateResult));
              if (updateResult && updateResult[0]) {
                const saved = updateResult[0];
                if (saved.last_message !== previewText && previewText) {
                  console.error(`[Chat Update] MISMATCH! Expected "${previewText}" but got "${saved.last_message}"`);
                }
              }
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

        // Insert message (check if already exists to avoid duplicates)
        if (!chat) break;

        const { data: existingMessage } = await supabase
          .from("messages")
          .select("id")
          .eq("message_id", messageId)
          .single();

        if (!existingMessage) {
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
            // Group message participant info
            participant_jid: participantJid,
            participant_name: participantName,
          });
        } else {
          // Update existing message if needed (e.g., media_url wasn't set)
          if (mediaUrl) {
            await supabase
              .from("messages")
              .update({ media_url: mediaUrl, status: fromMe ? "sent" : "received" })
              .eq("id", existingMessage.id);
          }
        }

        // Update instance message count
        if (fromMe) {
          await supabase
            .from("whatsapp_instances")
            .update({
              total_messages_sent: (instance.total_messages_sent || 0) + 1,
            })
            .eq("id", instance.id);
        }

        // AI Agent processing (fire-and-forget — does not block webhook response)
        // Skip: fromMe messages (PIPE-04), non-text messages, empty content
        if (!fromMe && messageType === "text" && content && instance.evolution_config_id) {
          try {
            const { data: evoConfig } = await supabase
              .from("evolution_api_configs")
              .select("url, api_key_encrypted")
              .eq("id", instance.evolution_config_id)
              .single();

            if (evoConfig) {
              const evoApiKey = decrypt(evoConfig.api_key_encrypted);
              const aiEvolutionClient = createEvolutionClient({
                url: evoConfig.url,
                apiKey: evoApiKey,
              });

              processAgentMessage({
                instanceId: instance.id,
                instanceName: instanceName,
                remoteJid: remoteJid,
                content: content,
                tenantId: tenantId,
                chatTags: (chat as any)?.tags || null,
                supabase: supabase,
                evolutionClient: aiEvolutionClient,
              }).catch((err) => console.error("[AI Agent] Pipeline error:", err));
            }
          } catch (err) {
            console.error("[AI Agent] Failed to initialize pipeline:", err);
          }
        }
        break;
      }

      case "MESSAGES_UPDATE": {
        console.log("[MESSAGES_UPDATE] Raw data:", JSON.stringify(data, null, 2));

        // Handle both array and single object formats
        const updates = Array.isArray(data) ? data : [data];

        for (const update of updates) {
          // Evolution API v2.3 uses different field names
          // keyId is the WhatsApp message ID (3EB0...) - this is what we save when sending
          // messageId is Evolution's internal ID - different from what we save
          // Priority: keyId (WhatsApp ID) first, then key.id, then messageId as fallback
          const messageId = update?.keyId || update?.key?.id || update?.messageId || update?.id;
          // Status can be in different places depending on Evolution API version
          const status = update?.status || update?.update?.status || update?.ack;

          console.log(`[MESSAGES_UPDATE] keyId=${update?.keyId}, messageId=${update?.messageId}, using=${messageId}, status=${status}`);

          if (messageId && status !== undefined) {
            const statusMap: Record<string, string> = {
              // Numeric statuses
              "0": "error",
              "1": "pending",
              "2": "sent",
              "3": "delivered",
              "4": "read",
              "5": "played",
              // String statuses
              "PENDING": "pending",
              "SENT": "sent",
              "DELIVERED": "delivered",
              "READ": "read",
              "PLAYED": "played",
              "ERROR": "error",
              // ACK values (Baileys)
              "SERVER_ACK": "sent",
              "DELIVERY_ACK": "delivered",
              "READ_ACK": "read",
              "PLAYED_ACK": "played",
            };

            const statusKey = String(status).toUpperCase();
            const newStatus = statusMap[String(status)] || statusMap[statusKey] || "sent";

            console.log(`[MESSAGES_UPDATE] Updating message ${messageId} to status: ${newStatus}`);

            const { error } = await supabase
              .from("messages")
              .update({ status: newStatus })
              .eq("message_id", messageId);

            if (error) {
              console.error(`[MESSAGES_UPDATE] Error updating:`, error);
            }
          }
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
