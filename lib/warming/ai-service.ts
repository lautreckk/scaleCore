import Anthropic from "@anthropic-ai/sdk";

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

interface GenerateMessageOptions {
  previousMessages: Array<{ role: "user" | "assistant"; content: string }>;
  topics: string[] | null;
  tone: string;
  isStarting: boolean;
  language?: string;
  isStatus?: boolean;
}

interface GenerateMessageResult {
  text: string;
  tokensUsed: number;
  costCents: number;
}

export async function generateWarmingMessage(
  options: GenerateMessageOptions
): Promise<GenerateMessageResult> {
  if (!client) {
    throw new Error("Anthropic client not configured");
  }

  const language = options.language || "pt-BR";
  const isPortuguese = language.startsWith("pt");

  let systemPrompt: string;

  if (options.isStatus) {
    systemPrompt = isPortuguese
      ? `Você está criando um texto curto para status do WhatsApp.
Escreva algo positivo, motivacional ou do dia a dia.
Máximo 1 frase curta. Pode usar 1-2 emojis.
Tom: ${options.tone}
${options.topics && options.topics.length > 0 ? `Tópicos possíveis: ${options.topics.join(", ")}` : ""}`
      : `You are creating a short WhatsApp status text.
Write something positive, motivational or about daily life.
Maximum 1 short sentence. Can use 1-2 emojis.
Tone: ${options.tone}
${options.topics && options.topics.length > 0 ? `Possible topics: ${options.topics.join(", ")}` : ""}`;
  } else {
    systemPrompt = isPortuguese
      ? `Você é um usuário brasileiro de WhatsApp tendo uma conversa casual.
Responda de forma natural, breve e informal.
Tom: ${options.tone}
${options.topics && options.topics.length > 0 ? `Tópicos possíveis: ${options.topics.join(", ")}` : ""}
Máximo 2 frases curtas. Use gírias e abreviações comuns brasileiras.
Não use formatação markdown. Apenas texto simples.`
      : `You are a WhatsApp user having a casual conversation.
Respond naturally, briefly and informally.
Tone: ${options.tone}
${options.topics && options.topics.length > 0 ? `Possible topics: ${options.topics.join(", ")}` : ""}
Maximum 2 short sentences. Use common slang and abbreviations.
Don't use markdown formatting. Plain text only.`;
  }

  const messages: Anthropic.MessageParam[] = options.isStarting
    ? [
        {
          role: "user",
          content: isPortuguese
            ? "Comece uma conversa casual de WhatsApp."
            : "Start a casual WhatsApp conversation.",
        },
      ]
    : options.previousMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

  // Add a prompt if continuing conversation
  if (!options.isStarting && messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "assistant") {
      messages.push({
        role: "user",
        content: isPortuguese
          ? "Continue a conversa de forma natural."
          : "Continue the conversation naturally.",
      });
    }
  }

  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 100,
    system: systemPrompt,
    messages,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Prices Claude Haiku: $0.25/1M input, $1.25/1M output
  const costUSD = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  // Convert to BRL cents (approximate rate)
  const costCents = costUSD * 100 * 5; // ~5 BRL per USD

  return {
    text: text.trim(),
    tokensUsed: inputTokens + outputTokens,
    costCents,
  };
}
