import { SupabaseClient } from "@supabase/supabase-js";
import type { EvolutionApiClient } from "@/lib/evolution/client";
import { addToBuffer, drainBuffer } from "./buffer";
import { chatCompletion, ChatMessage } from "./openrouter";
import {
  getConversationHistory,
  saveConversationMessages,
  clearConversationHistory,
} from "./memory";
import { checkAndDebitWallet } from "./billing";
import { sendSplitResponse } from "./splitter";

interface ProcessMessageParams {
  instanceId: string;
  instanceName: string;
  remoteJid: string;
  content: string;
  tenantId: string;
  chatTags: string[] | null;
  supabase: SupabaseClient;
  evolutionClient: EvolutionApiClient;
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

  // 4. Add to buffer and wait for grouping window
  const { isFirst } = await addToBuffer(instanceId, remoteJid, content);

  if (!isFirst) {
    // Another invocation is already waiting — this message was added to the buffer
    console.log(`[AI Agent] Message buffered (not first), skipping processing for ${remoteJid}`);
    return;
  }

  // Wait 10s for additional messages to arrive (buffer grouping window)
  await new Promise((resolve) => setTimeout(resolve, 10_000));

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

  // 8. Build messages array and call LLM
  const messages: ChatMessage[] = [
    { role: "system", content: agentSystemPrompt },
    ...history,
    { role: "user", content: bufferedContent },
  ];

  const { content: aiResponse } = await chatCompletion(agentModelId, messages);

  if (!aiResponse) {
    console.error("[AI Agent] Empty response from LLM");
    return;
  }

  // 9. Save to conversation memory (both user message and AI response)
  await saveConversationMessages(
    supabase,
    remoteJid,
    instanceId,
    agentId,
    bufferedContent,
    aiResponse
  );

  // 10. Send split response with typing indicators
  await sendSplitResponse(evolutionClient, instanceName, remoteJid, aiResponse);

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
      content: aiResponse,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    await supabase
      .from("chats")
      .update({
        last_message: aiResponse.substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_from_me: true,
        last_message_type: "text",
        unread_count: 0,
      })
      .eq("id", chat.id);
  }

  console.log(`[AI Agent] Response sent to ${remoteJid} via ${instanceName}`);
}
