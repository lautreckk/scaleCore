import { SupabaseClient } from "@supabase/supabase-js";
import type { EvolutionApiClient } from "@/lib/evolution/client";
import { addToBuffer, drainBuffer } from "./buffer";
import { chatCompletion, ChatMessage } from "./openrouter";
import type { ContentPart } from "./openrouter";
import {
  getConversationHistory,
  saveConversationMessages,
  clearConversationHistory,
} from "./memory";
import { checkAndDebitWallet } from "./billing";
import { sendSplitResponse } from "./splitter";
import { performHandoff } from "./handoff";
import { processInboundMedia, isMultimodalModel } from "./media-processor";
import {
  buildSystemPromptWithMedia,
  extractMediaMarkers,
  stripMediaMarkers,
  sendMediaFromLibrary,
} from "./media-library";

/**
 * Check if message content matches any escalation keyword.
 * Case-insensitive, substring matching.
 */
export function isEscalationMatch(content: string, keywords: string[]): boolean {
  if (keywords.length === 0) return false;
  const lowerContent = content.trim().toLowerCase();
  return keywords.some((kw) => lowerContent.includes(kw.toLowerCase()));
}

interface ProcessMessageParams {
  instanceId: string;
  instanceName: string;
  remoteJid: string;
  content: string;
  tenantId: string;
  chatTags: string[] | null;
  supabase: SupabaseClient;
  evolutionClient: EvolutionApiClient;
  messageType?: "text" | "image" | "audio" | "document";
  mediaUrl?: string | null;
}

export async function processAgentMessage(
  params: ProcessMessageParams
): Promise<void> {
  const {
    instanceId,
    instanceName,
    remoteJid,
    content,
    tenantId,
    chatTags,
    supabase,
    evolutionClient,
    messageType,
    mediaUrl,
  } = params;

  // 1. Find active agents bound to this instance
  const { data: bindings } = await supabase
    .from("ai_agent_instances")
    .select("agent_id, ai_agents(*)")
    .eq("instance_id", instanceId);

  if (!bindings || bindings.length === 0) return;

  // Filter to active agents only
  const activeAgents = bindings
    .map((b: any) => b.ai_agents)
    .filter((a: any) => a && a.is_active);

  if (activeAgents.length === 0) return;

  // 2. Tag gate: find first agent whose activation_tag is in chat's tags
  const agent = activeAgents.find((a: any) =>
    (chatTags || []).includes(a.activation_tag)
  );

  if (!agent) return; // No matching tag — skip AI processing

  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "");

  // 3. Handle #limpar command (clear conversation history)
  if (content.trim().toLowerCase() === "#limpar") {
    await clearConversationHistory(supabase, remoteJid, instanceId);
    await evolutionClient.sendText(instanceName, {
      number: phoneNumber,
      text: "Historico de conversa limpo com sucesso.",
    });
    console.log(`[AI Agent] Conversation history cleared for ${remoteJid}`);
    return;
  }

  // 3.2. Handle media content description for escalation check
  let effectiveContent = content;
  if (messageType && messageType !== "text" && mediaUrl) {
    // For media messages, use a descriptive placeholder for buffer
    // The actual media processing happens in processBufferedMessages
    effectiveContent = content || `[${messageType}]`;
  }

  // 3.5. HAND-03: Escalation keyword detection
  const escalationKeywords: string[] = agent.escalation_keywords || [];
  if (isEscalationMatch(effectiveContent, escalationKeywords)) {
    // Find chat ID for this conversation
    const { data: chatData } = await supabase
      .from("chats")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("remote_jid", remoteJid)
      .or("status.is.null,status.eq.open")
      .single();

    if (chatData) {
      await performHandoff({
        chatId: chatData.id,
        activationTag: agent.activation_tag,
        instanceId,
        remoteJid,
        supabase,
      });
    }

    console.log(`[AI Agent] Escalation keyword detected for ${remoteJid}: "${content.substring(0, 50)}"`);
    return; // Stop AI processing -- human takes over
  }

  // 4. Add to buffer and wait for grouping window
  const { isFirst } = await addToBuffer(instanceId, remoteJid, effectiveContent);

  if (!isFirst) {
    // Another invocation is already waiting — this message was added to the buffer
    console.log(`[AI Agent] Message buffered (not first), skipping processing for ${remoteJid}`);
    return;
  }

  // Wait 3s for additional messages to arrive (buffer grouping window)
  await new Promise((resolve) => setTimeout(resolve, 3_000));

  // Process all buffered messages
  await processBufferedMessages({
    instanceId,
    instanceName,
    remoteJid,
    tenantId,
    agentId: agent.id,
    agentModelId: agent.model_id,
    agentSystemPrompt: agent.system_prompt,
    supabase,
    evolutionClient,
    messageType,
    mediaUrl,
  });
}

interface ProcessBufferedParams {
  instanceId: string;
  instanceName: string;
  remoteJid: string;
  tenantId: string;
  agentId: string;
  agentModelId: string;
  agentSystemPrompt: string;
  supabase: SupabaseClient;
  evolutionClient: EvolutionApiClient;
  messageType?: "text" | "image" | "audio" | "document";
  mediaUrl?: string | null;
}

async function processBufferedMessages(
  params: ProcessBufferedParams
): Promise<void> {
  const {
    instanceId,
    instanceName,
    remoteJid,
    tenantId,
    agentId,
    agentModelId,
    agentSystemPrompt,
    supabase,
    evolutionClient,
    messageType,
    mediaUrl,
  } = params;

  // 5. Drain buffer (acquires lock, returns concatenated messages)
  const bufferedContent = await drainBuffer(instanceId, remoteJid);
  if (!bufferedContent) return; // Lock not acquired or buffer empty

  // 6. Billing check — debit wallet before processing
  const { allowed } = await checkAndDebitWallet(supabase, tenantId, agentModelId);
  if (!allowed) {
    console.log(
      `[AI Agent] Skipping response — insufficient wallet balance for tenant ${tenantId}`
    );
    return;
  }

  // 7. Load conversation history (last 50 messages, sliding window)
  const history = await getConversationHistory(supabase, remoteJid, instanceId);

  // 7.5. Fetch agent's media library for prompt injection
  const { data: mediaItems } = await supabase
    .from("ai_agent_media")
    .select("*")
    .eq("agent_id", agentId)
    .eq("is_active", true);

  // 8. Build messages array and call LLM
  const systemPrompt = buildSystemPromptWithMedia(
    agentSystemPrompt,
    mediaItems || []
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  // Handle media messages — build multimodal content for last user message
  if (messageType && messageType !== "text" && mediaUrl) {
    const { contentParts, fallbackText } = await processInboundMedia(
      messageType as "audio" | "image" | "document",
      mediaUrl,
      bufferedContent !== `[${messageType}]` ? bufferedContent : undefined
    );

    if (isMultimodalModel(agentModelId)) {
      // Use multimodal content parts directly
      messages.push({ role: "user", content: contentParts });
    } else {
      // Fallback: use text description for non-multimodal models
      if (fallbackText) {
        messages.push({ role: "user", content: fallbackText });
      } else {
        // Need to get text description from multimodal model first
        const { content: description } = await chatCompletion(
          "openai/gpt-4o-mini",
          [{ role: "user", content: contentParts }]
        );
        messages.push({ role: "user", content: description });
      }
    }
  } else {
    messages.push({ role: "user", content: bufferedContent });
  }

  const { content: aiResponse } = await chatCompletion(agentModelId, messages);

  if (!aiResponse) {
    console.error("[AI Agent] Empty response from LLM");
    return;
  }

  // 9.5. Extract and send media from library if AI included markers
  const mediaMarkerIds = extractMediaMarkers(aiResponse);
  const cleanResponse = stripMediaMarkers(aiResponse);

  // 9. Save clean response (without markers) to conversation memory
  await saveConversationMessages(
    supabase,
    remoteJid,
    instanceId,
    agentId,
    bufferedContent,
    cleanResponse
  );

  // 10. Send text response (clean, no markers)
  await sendSplitResponse(evolutionClient, instanceName, remoteJid, cleanResponse);

  // 10.5. Send media files after text
  if (mediaMarkerIds.length > 0) {
    const phoneNumber = remoteJid.replace("@s.whatsapp.net", "");
    await sendMediaFromLibrary(
      mediaMarkerIds,
      agentId,
      supabase,
      evolutionClient,
      instanceName,
      phoneNumber
    );
  }

  // 11. Record AI response in messages table so it appears in the frontend
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("remote_jid", remoteJid)
    .or("status.is.null,status.eq.open")
    .single();

  if (chat) {
    await supabase.from("messages").insert({
      chat_id: chat.id,
      message_id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_me: true,
      remote_jid: remoteJid,
      message_type: "text",
      content: cleanResponse,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    await supabase
      .from("chats")
      .update({
        last_message: cleanResponse.substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_from_me: true,
        last_message_type: "text",
        unread_count: 0,
      })
      .eq("id", chat.id);
  }

  console.log(`[AI Agent] Response sent to ${remoteJid} via ${instanceName}`);
}
