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
        // Send typing presence
        await evolutionClient.sendPresence(senderInstance.instance_name, {
          number: receiverNumber,
          presence: "composing",
          delay: getTypingDuration(config.min_typing_duration, config.max_typing_duration) * 1000,
        });

        // Generate message
        const generated = await generateMessage({
          tenantId: config.tenant_id,
          useAI: config.use_ai_conversations,
          aiTopics: config.ai_topics,
          aiTone: config.ai_tone,
          aiLanguage: config.ai_language,
          isStartingConversation: true,
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
        // Send recording presence
        await evolutionClient.sendPresence(senderInstance.instance_name, {
          number: receiverNumber,
          presence: "recording",
          delay: getRecordingDuration(config.min_typing_duration, config.max_typing_duration) * 1000,
        });

        // For audio, we need a pre-recorded audio file
        // In a real implementation, you'd have a library of short audio clips
        // For now, we'll skip if no audio URLs are configured
        content = "[Audio message - requires audio library]";
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

      case "image_message":
      case "document_message":
      case "video_message": {
        // These require media files to be configured
        // Skip for now or implement with a media library
        content = `[${actionType} - requires media library]`;
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
