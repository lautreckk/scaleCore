import { SupabaseClient } from "@supabase/supabase-js";

export async function getConversationHistory(
  supabase: SupabaseClient,
  remoteJid: string,
  instanceId: string,
  limit = 50
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data } = await supabase
    .from("ai_conversation_messages")
    .select("role, content")
    .eq("remote_jid", remoteJid)
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Reverse to get chronological order (query returns newest first)
  return (data || []).reverse() as { role: "user" | "assistant"; content: string }[];
}

export async function saveConversationMessages(
  supabase: SupabaseClient,
  remoteJid: string,
  instanceId: string,
  agentId: string,
  userMessage: string,
  aiResponse: string
): Promise<void> {
  await supabase.from("ai_conversation_messages").insert([
    {
      remote_jid: remoteJid,
      instance_id: instanceId,
      agent_id: agentId,
      role: "user" as const,
      content: userMessage,
    },
    {
      remote_jid: remoteJid,
      instance_id: instanceId,
      agent_id: agentId,
      role: "assistant" as const,
      content: aiResponse,
    },
  ]);
}

export async function clearConversationHistory(
  supabase: SupabaseClient,
  remoteJid: string,
  instanceId: string
): Promise<void> {
  await supabase
    .from("ai_conversation_messages")
    .delete()
    .eq("remote_jid", remoteJid)
    .eq("instance_id", instanceId);
}
