import { SupabaseClient } from "@supabase/supabase-js";
import { chatCompletion, ChatMessage } from "./openrouter";
import { getConversationHistory } from "./memory";
import { clearBuffer } from "./buffer";

const SUMMARY_MODEL = "openai/gpt-4o-mini";

const SUMMARY_SYSTEM_PROMPT = `Voce e um assistente que resume conversas de WhatsApp para atendentes humanos.
Gere um resumo conciso (3-5 frases) da conversa abaixo, focando em:
- O que o lead quer/precisa
- Decisoes ja tomadas
- Proximos passos esperados
- Informacoes importantes (nome, produto, data, valor)

Responda APENAS com o resumo, sem prefixo ou formatacao.`;

export async function performHandoff(params: {
  chatId: string;
  activationTag: string;
  instanceId: string;
  remoteJid: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { chatId, activationTag, instanceId, remoteJid, supabase } = params;

  // 1. Remove tag immediately (stops AI processing)
  await supabase.rpc("remove_chat_tag", {
    p_chat_id: chatId,
    p_tag: activationTag,
  });

  console.log(`[Handoff] Tag "${activationTag}" removed from chat ${chatId}`);

  // 2. Clear Redis buffer to prevent stale messages from processing
  await clearBuffer(instanceId, remoteJid);

  // 3. Generate and insert summary (best-effort)
  try {
    const history = await getConversationHistory(supabase, remoteJid, instanceId);

    let summaryText: string;

    if (history.length === 0) {
      summaryText = "Sem historico de conversa.";
    } else {
      const conversation = history
        .map((m) => `${m.role === "user" ? "Lead" : "IA"}: ${m.content}`)
        .join("\n");

      const { content } = await chatCompletion(SUMMARY_MODEL, [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: conversation },
      ]);

      summaryText = content;
    }

    await supabase.from("messages").insert({
      chat_id: chatId,
      message_id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_me: true,
      remote_jid: remoteJid,
      message_type: "system_note",
      content: `[Resumo IA] ${summaryText}`,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    console.log(`[Handoff] Summary generated for chat ${chatId}`);
  } catch (err) {
    console.error("[Handoff] Summary generation failed:", err);
    await supabase.from("messages").insert({
      chat_id: chatId,
      message_id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_me: true,
      remote_jid: remoteJid,
      message_type: "system_note",
      content: "[Handoff IA] Atendente assumiu a conversa. Resumo indisponivel -- verifique o historico.",
      status: "sent",
      timestamp: new Date().toISOString(),
    });
  }
}
