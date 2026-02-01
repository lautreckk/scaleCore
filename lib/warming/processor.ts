import { createClient as createAdminClient, SupabaseClient } from "@supabase/supabase-js";
import { createEvolutionClient, EvolutionApiClient } from "@/lib/evolution/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;
import {
  ActionType,
  selectActionByWeight,
  canExecuteAction,
  getCounterFieldForAction,
} from "./action-selector";
import {
  isWithinSchedule,
  getRandomDelay,
  getTypingDuration,
  getRecordingDuration,
  sleep,
  getRandomReaction,
  getRandomStatusColor,
} from "./natural-patterns";
import { generateMessage, generateStatusText } from "./message-generator";

type WarmingConfig = Database["public"]["Tables"]["warming_configs"]["Row"];
type WarmingSession = Database["public"]["Tables"]["warming_sessions"]["Row"];
type WhatsAppInstance = Database["public"]["Tables"]["whatsapp_instances"]["Row"];

interface ProcessResult {
  sessionsProcessed: number;
  actionsExecuted: number;
  errors: number;
}

interface InstanceWithConfig {
  id: string;
  instance_id: string;
  warming_config_id: string;
  is_active: boolean;
  messages_sent_today: number;
  audio_sent_today: number;
  media_sent_today: number;
  status_posted_today: number;
  reactions_sent_today: number;
  counters_reset_date: string;
  last_action_at: string | null;
  whatsapp_instance: WhatsAppInstance;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function processWarmingSessions(): Promise<ProcessResult> {
  const supabase = createAdminClient<Database>(supabaseUrl, supabaseServiceKey);

  const result: ProcessResult = {
    sessionsProcessed: 0,
    actionsExecuted: 0,
    errors: 0,
  };

  // Get sessions that are due for next action
  const now = new Date();
  const { data: sessions, error: sessionsError } = await supabase
    .from("warming_sessions")
    .select(`
      *,
      warming_configs (*)
    `)
    .eq("status", "running")
    .lte("next_action_at", now.toISOString())
    .limit(10) as { data: (WarmingSession & { warming_configs: WarmingConfig })[] | null; error: unknown };

  if (sessionsError) {
    console.error("Error fetching sessions:", sessionsError);
    return result;
  }

  if (!sessions || sessions.length === 0) {
    return result;
  }

  // Process each session
  for (const session of sessions) {
    try {
      await processSession(supabase, session, session.warming_configs);
      result.sessionsProcessed++;
      result.actionsExecuted++;
    } catch (error) {
      console.error(`Error processing session ${session.id}:`, error);
      result.errors++;

      // Update session with error
      await supabase
        .from("warming_sessions")
        .update({
          errors_count: session.errors_count + 1,
          last_error: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", session.id);
    }
  }

  return result;
}

async function processSession(
  supabase: SupabaseClient<Database>,
  session: WarmingSession,
  config: WarmingConfig
): Promise<void> {
  // Check if within schedule
  if (!isWithinSchedule(config)) {
    // Schedule next check
    const nextCheck = new Date(Date.now() + 60 * 1000); // Check again in 1 minute
    await supabase
      .from("warming_sessions")
      .update({ next_action_at: nextCheck.toISOString() })
      .eq("id", session.id);
    return;
  }

  // Reset daily counters if needed
  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("warming_config_instances")
    .update({
      messages_sent_today: 0,
      audio_sent_today: 0,
      media_sent_today: 0,
      status_posted_today: 0,
      reactions_sent_today: 0,
      counters_reset_date: today,
    })
    .eq("warming_config_id", config.id)
    .neq("counters_reset_date", today);

  // Get participating instances
  const { data: configInstances, error: instancesError } = await supabase
    .from("warming_config_instances")
    .select(`
      *,
      whatsapp_instance:instance_id (*)
    `)
    .eq("warming_config_id", config.id)
    .eq("is_active", true);

  if (instancesError || !configInstances || configInstances.length < 2) {
    throw new Error("Not enough active instances");
  }

  // Filter to only connected instances
  const connectedInstances = configInstances.filter(
    (ci) => (ci.whatsapp_instance as WhatsAppInstance)?.status === "connected"
  ) as unknown as InstanceWithConfig[];

  if (connectedInstances.length < 2) {
    throw new Error("Not enough connected instances");
  }

  // Select action type
  const actionType = selectActionByWeight(config);
  if (!actionType) {
    throw new Error("No available actions");
  }

  // Select sender and receiver instances
  const shuffled = [...connectedInstances].sort(() => Math.random() - 0.5);
  const senderInstance = shuffled[0];
  const receiverInstance = shuffled[1];

  // Check if sender can execute this action
  const canExecute = canExecuteAction(actionType, config, senderInstance);
  if (!canExecute.canExecute) {
    // Try with another instance or skip
    console.log(`Skipping action: ${canExecute.reason}`);
    await scheduleNextAction(supabase, session, config);
    return;
  }

  // Get Evolution API client for sender
  const evolutionClient = await getEvolutionClient(
    supabase,
    senderInstance.whatsapp_instance
  );

  if (!evolutionClient) {
    throw new Error("Could not create Evolution API client");
  }

  // Execute the action
  await executeAction(
    supabase,
    evolutionClient,
    session,
    config,
    actionType,
    senderInstance,
    receiverInstance
  );

  // Schedule next action
  await scheduleNextAction(supabase, session, config);
}

async function executeAction(
  supabase: SupabaseClient<Database>,
  evolutionClient: EvolutionApiClient,
  session: WarmingSession,
  config: WarmingConfig,
  actionType: ActionType,
  sender: InstanceWithConfig,
  receiver: InstanceWithConfig
): Promise<void> {
  const senderInstance = sender.whatsapp_instance;
  const receiverInstance = receiver.whatsapp_instance;
  const receiverNumber = receiverInstance.phone_number?.replace(/\D/g, "") || "";

  if (!receiverNumber) {
    throw new Error("Receiver has no phone number");
  }

  let content: string | null = null;
  let messageId: string | null = null;
  let aiGenerated = false;
  let aiTokensUsed: number | null = null;
  let aiCostCents: number | null = null;

  try {
    switch (actionType) {
      case "text_message": {
        // Fetch conversation history to provide context
        const conversationHistory = await getConversationHistory(
          evolutionClient,
          senderInstance.instance_name,
          receiverNumber
        );

        // Decide if we should start new conversation or continue
        const shouldStartNew = shouldStartNewConversation(conversationHistory);

        // Send typing presence
        await evolutionClient.sendPresence(senderInstance.instance_name, {
          number: receiverNumber,
          presence: "composing",
          delay: getTypingDuration(config.min_typing_duration, config.max_typing_duration) * 1000,
        });

        // Generate message with context
        const generated = await generateMessage({
          tenantId: config.tenant_id,
          useAI: config.use_ai_conversations,
          aiTopics: config.ai_topics,
          aiTone: config.ai_tone,
          aiLanguage: config.ai_language,
          isStartingConversation: shouldStartNew,
          previousMessages: conversationHistory,
        });

        content = generated.text;
        aiGenerated = generated.aiGenerated;
        aiTokensUsed = generated.tokensUsed || null;
        aiCostCents = generated.costCents || null;

        // Wait a bit for typing simulation
        await sleep(getTypingDuration(config.min_typing_duration, config.max_typing_duration) * 1000);

        // Send message
        const result = await evolutionClient.sendText(senderInstance.instance_name, {
          number: receiverNumber,
          text: content,
        });

        if (result.success && result.data) {
          messageId = result.data.key.id;
        }
        break;
      }

      case "audio_message": {
        // Get random audio from media library
        const audioMedia = await getRandomMedia(supabase, config.tenant_id, "audio");
        if (!audioMedia) {
          throw new Error("No audio files in media library");
        }

        // Send recording presence
        await evolutionClient.sendPresence(senderInstance.instance_name, {
          number: receiverNumber,
          presence: "recording",
          delay: getRecordingDuration(config.min_typing_duration, config.max_typing_duration) * 1000,
        });

        // Wait for recording simulation
        await sleep(getRecordingDuration(config.min_typing_duration, config.max_typing_duration) * 1000);

        // Send audio
        const audioResult = await evolutionClient.sendMedia(senderInstance.instance_name, {
          number: receiverNumber,
          mediatype: "audio",
          mimetype: audioMedia.mime_type || "audio/mpeg",
          media: audioMedia.file_url,
        });

        if (audioResult.success && audioResult.data) {
          messageId = audioResult.data.key?.id || null;
        }

        content = `Audio: ${audioMedia.name}`;

        // Update usage count
        await incrementMediaUsage(supabase, audioMedia.id);
        break;
      }

      case "status_post": {
        // Generate status text
        const statusGenerated = await generateStatusText({
          tenantId: config.tenant_id,
          useAI: config.use_ai_conversations,
          aiTopics: config.ai_topics,
          aiTone: config.ai_tone,
          aiLanguage: config.ai_language,
        });

        content = statusGenerated.text;
        aiGenerated = statusGenerated.aiGenerated;
        aiTokensUsed = statusGenerated.tokensUsed || null;
        aiCostCents = statusGenerated.costCents || null;

        await evolutionClient.sendStatus(senderInstance.instance_name, {
          type: "text",
          content,
          backgroundColor: getRandomStatusColor(),
          font: Math.ceil(Math.random() * 5) as 1 | 2 | 3 | 4 | 5,
          allContacts: true,
        });
        break;
      }

      case "status_view": {
        // View status of other instances
        const statusResult = await evolutionClient.findStatusMessages(
          senderInstance.instance_name,
          receiverNumber + "@s.whatsapp.net"
        );

        content = `Viewed ${statusResult.data?.length || 0} status messages`;
        break;
      }

      case "reaction": {
        // For reactions, we need a recent message to react to
        // Get recent messages from the receiver
        const messagesResult = await evolutionClient.findMessages(
          senderInstance.instance_name,
          {
            where: { key: { remoteJid: receiverNumber + "@s.whatsapp.net" } },
            page: 1,
            offset: 0,
          }
        );

        if (messagesResult.data && messagesResult.data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const recentMessage = messagesResult.data[0] as any;
          if (recentMessage.key) {
            const reaction = getRandomReaction();
            await evolutionClient.sendReaction(senderInstance.instance_name, {
              key: recentMessage.key,
              reaction,
            });
            content = reaction;
          }
        }
        break;
      }

      case "image_message": {
        // Get random image from media library
        const imageMedia = await getRandomMedia(supabase, config.tenant_id, "image");
        if (!imageMedia) {
          throw new Error("No image files in media library");
        }

        // Send typing presence briefly
        await evolutionClient.sendPresence(senderInstance.instance_name, {
          number: receiverNumber,
          presence: "composing",
          delay: 2000,
        });

        await sleep(2000);

        // Send image
        const imageResult = await evolutionClient.sendMedia(senderInstance.instance_name, {
          number: receiverNumber,
          mediatype: "image",
          mimetype: imageMedia.mime_type || "image/jpeg",
          media: imageMedia.file_url,
        });

        if (imageResult.success && imageResult.data) {
          messageId = imageResult.data.key?.id || null;
        }

        content = `Image: ${imageMedia.name}`;
        await incrementMediaUsage(supabase, imageMedia.id);
        break;
      }

      case "document_message": {
        // Get random document from media library
        const docMedia = await getRandomMedia(supabase, config.tenant_id, "document");
        if (!docMedia) {
          throw new Error("No document files in media library");
        }

        // Send document
        const docResult = await evolutionClient.sendMedia(senderInstance.instance_name, {
          number: receiverNumber,
          mediatype: "document",
          mimetype: docMedia.mime_type || "application/pdf",
          media: docMedia.file_url,
          fileName: docMedia.name,
        });

        if (docResult.success && docResult.data) {
          messageId = docResult.data.key?.id || null;
        }

        content = `Document: ${docMedia.name}`;
        await incrementMediaUsage(supabase, docMedia.id);
        break;
      }

      case "video_message": {
        // Get random video from media library
        const videoMedia = await getRandomMedia(supabase, config.tenant_id, "video");
        if (!videoMedia) {
          throw new Error("No video files in media library");
        }

        // Send typing presence
        await evolutionClient.sendPresence(senderInstance.instance_name, {
          number: receiverNumber,
          presence: "composing",
          delay: 3000,
        });

        await sleep(3000);

        // Send video
        const videoResult = await evolutionClient.sendMedia(senderInstance.instance_name, {
          number: receiverNumber,
          mediatype: "video",
          mimetype: videoMedia.mime_type || "video/mp4",
          media: videoMedia.file_url,
        });

        if (videoResult.success && videoResult.data) {
          messageId = videoResult.data.key?.id || null;
        }

        content = `Video: ${videoMedia.name}`;
        await incrementMediaUsage(supabase, videoMedia.id);
        break;
      }
    }

    // Log success
    await logAction(supabase, {
      warming_config_id: config.id,
      session_id: session.id,
      tenant_id: config.tenant_id,
      action_type: actionType,
      from_instance_id: senderInstance.id,
      to_instance_id: actionType === "status_post" || actionType === "status_view" ? null : receiverInstance.id,
      content,
      message_id: messageId,
      status: "success",
      ai_generated: aiGenerated,
      ai_tokens_used: aiTokensUsed,
      ai_cost_cents: aiCostCents,
    });

    // Update counters
    const counterField = getCounterFieldForAction(actionType);
    await supabase
      .from("warming_config_instances")
      .update({
        [counterField]: sender[counterField] + 1,
        last_action_at: new Date().toISOString(),
      })
      .eq("id", sender.id);

    // Update config stats
    await supabase
      .from("warming_configs")
      .update({
        total_actions_executed: config.total_actions_executed + 1,
        total_messages_sent:
          actionType === "text_message" || actionType === "audio_message"
            ? config.total_messages_sent + 1
            : config.total_messages_sent,
        last_action_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    // Update session stats
    await supabase
      .from("warming_sessions")
      .update({
        actions_executed: session.actions_executed + 1,
      })
      .eq("id", session.id);
  } catch (error) {
    // Log failure
    await logAction(supabase, {
      warming_config_id: config.id,
      session_id: session.id,
      tenant_id: config.tenant_id,
      action_type: actionType,
      from_instance_id: senderInstance.id,
      to_instance_id: receiverInstance.id,
      content,
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      ai_generated: aiGenerated,
      ai_tokens_used: aiTokensUsed,
      ai_cost_cents: aiCostCents,
    });

    throw error;
  }
}

async function scheduleNextAction(
  supabase: SupabaseClient<Database>,
  session: WarmingSession,
  config: WarmingConfig
): Promise<void> {
  const delay = getRandomDelay(
    config.min_delay_between_actions,
    config.max_delay_between_actions
  );
  const nextActionAt = new Date(Date.now() + delay * 1000);

  await supabase
    .from("warming_sessions")
    .update({
      next_action_at: nextActionAt.toISOString(),
    })
    .eq("id", session.id);
}

async function logAction(
  supabase: SupabaseClient<Database>,
  data: {
    warming_config_id: string;
    session_id: string | null;
    tenant_id: string;
    action_type: string;
    from_instance_id: string | null;
    to_instance_id: string | null;
    content: string | null;
    message_id?: string | null;
    status: "success" | "failed" | "pending";
    error_message?: string | null;
    ai_generated: boolean;
    ai_tokens_used: number | null;
    ai_cost_cents: number | null;
  }
): Promise<void> {
  await supabase.from("warming_action_logs").insert(data);
}

async function getEvolutionClient(
  supabase: SupabaseClient<Database>,
  instance: WhatsAppInstance
): Promise<EvolutionApiClient | null> {
  if (!instance.evolution_config_id) {
    return null;
  }

  const { data: evolutionConfig } = await supabase
    .from("evolution_api_configs")
    .select("url, api_key_encrypted")
    .eq("id", instance.evolution_config_id)
    .single();

  if (!evolutionConfig) {
    return null;
  }

  return createEvolutionClient({
    url: evolutionConfig.url,
    apiKey: evolutionConfig.api_key_encrypted, // In production, decrypt this
  });
}

interface WarmingMedia {
  id: string;
  type: string;
  name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  duration_seconds: number | null;
}

async function getRandomMedia(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  type: "audio" | "image" | "document" | "video"
): Promise<WarmingMedia | null> {
  const { data: media, error } = await supabase
    .from("warming_media")
    .select("id, type, name, file_url, file_size, mime_type, duration_seconds")
    .eq("tenant_id", tenantId)
    .eq("type", type)
    .eq("is_active", true);

  if (error || !media || media.length === 0) {
    return null;
  }

  // Return random media
  const randomIndex = Math.floor(Math.random() * media.length);
  return media[randomIndex] as WarmingMedia;
}

async function incrementMediaUsage(
  supabase: SupabaseClient<Database>,
  mediaId: string
): Promise<void> {
  await supabase.rpc("increment_warming_media_usage", { media_id: mediaId });
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

async function getConversationHistory(
  evolutionClient: EvolutionApiClient,
  instanceName: string,
  remoteNumber: string
): Promise<ConversationMessage[]> {
  try {
    const remoteJid = remoteNumber + "@s.whatsapp.net";

    const result = await evolutionClient.findMessages(instanceName, {
      where: { key: { remoteJid } },
      page: 1,
      offset: 0,
    });

    if (!result.success || !result.data || result.data.length === 0) {
      return [];
    }

    // Parse messages and convert to conversation format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: ConversationMessage[] = result.data
      .slice(0, 10) // Last 10 messages
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((msg: any) => {
        const isFromMe = msg.key?.fromMe === true;
        const content =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          "";

        // Skip non-text messages
        if (!content) return null;

        return {
          role: isFromMe ? "assistant" : "user",
          content,
          timestamp: parseInt(msg.messageTimestamp) || 0,
        } as ConversationMessage;
      })
      .filter((msg): msg is ConversationMessage => msg !== null)
      .sort((a, b) => a.timestamp - b.timestamp); // Sort by time ascending

    return messages;
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    return [];
  }
}

function shouldStartNewConversation(history: ConversationMessage[]): boolean {
  // Start new if no history
  if (history.length === 0) {
    return true;
  }

  // Get last message timestamp
  const lastMessage = history[history.length - 1];
  const lastMessageTime = lastMessage.timestamp * 1000; // Convert to ms
  const now = Date.now();
  const hoursSinceLastMessage = (now - lastMessageTime) / (1000 * 60 * 60);

  // Start new conversation if last message was more than 6 hours ago
  if (hoursSinceLastMessage > 6) {
    return true;
  }

  // 20% chance to start new topic even if conversation is recent
  // This adds variety to the conversations
  if (Math.random() < 0.2) {
    return true;
  }

  // Continue existing conversation
  return false;
}
