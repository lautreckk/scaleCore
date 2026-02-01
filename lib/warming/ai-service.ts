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
  const hasHistory = options.previousMessages && options.previousMessages.length > 0;

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
  } else if (options.isStarting) {
    // Starting a new conversation
    systemPrompt = isPortuguese
      ? `Você é um brasileiro conversando no WhatsApp com um amigo.
Inicie uma conversa casual e natural.
Tom: ${options.tone}
${options.topics && options.topics.length > 0 ? `Assuntos que vocês costumam conversar: ${options.topics.join(", ")}` : ""}

Regras:
- Máximo 2 frases curtas
- Use gírias brasileiras naturais (eae, mano, blz, tmj, etc)
- Pode perguntar algo ou comentar sobre o dia
- NÃO use formatação markdown
- NÃO seja repetitivo com cumprimentos genéricos
- Varie entre: perguntar algo, comentar uma notícia, falar do dia, combinar algo`
      : `You are chatting on WhatsApp with a friend.
Start a casual, natural conversation.
Tone: ${options.tone}
${options.topics && options.topics.length > 0 ? `Topics you usually talk about: ${options.topics.join(", ")}` : ""}

Rules:
- Maximum 2 short sentences
- Use natural slang
- Can ask something or comment about the day
- NO markdown formatting
- DON'T be repetitive with generic greetings
- Vary between: asking something, commenting news, talking about the day, making plans`;
  } else {
    // Continuing an existing conversation
    systemPrompt = isPortuguese
      ? `Você é um brasileiro conversando no WhatsApp com um amigo.
Você está CONTINUANDO uma conversa existente.
Tom: ${options.tone}
${options.topics && options.topics.length > 0 ? `Assuntos que vocês costumam conversar: ${options.topics.join(", ")}` : ""}

Regras IMPORTANTES:
- Responda ao que a pessoa disse na última mensagem
- Máximo 2 frases curtas
- Use gírias brasileiras naturais
- NÃO cumprimente de novo (a conversa já começou!)
- NÃO pergunte "tudo bem?" ou similares
- Pode concordar, discordar, perguntar mais, ou mudar de assunto naturalmente
- Seja específico sobre o que foi dito
- NÃO use formatação markdown`
      : `You are chatting on WhatsApp with a friend.
You are CONTINUING an existing conversation.
Tone: ${options.tone}
${options.topics && options.topics.length > 0 ? `Topics you usually talk about: ${options.topics.join(", ")}` : ""}

IMPORTANT rules:
- Respond to what the person said in their last message
- Maximum 2 short sentences
- Use natural slang
- DON'T greet again (conversation already started!)
- DON'T ask "how are you?" or similar
- Can agree, disagree, ask more, or naturally change subject
- Be specific about what was said
- NO markdown formatting`;
  }

  // Build messages array
  let messages: Anthropic.MessageParam[] = [];

  if (options.isStarting || !hasHistory) {
    // New conversation - just ask to start
    messages = [
      {
        role: "user",
        content: isPortuguese
          ? "Mande uma mensagem iniciando conversa:"
          : "Send a message starting the conversation:",
      },
    ];
  } else {
    // Convert previous messages to Anthropic format
    // The history contains messages where:
    // - "assistant" = messages I (the sender) sent
    // - "user" = messages the other person sent
    // But for the AI, we want it to BE the sender, so we need to flip the roles

    const conversationContext = options.previousMessages
      .slice(-6) // Last 6 messages for context
      .map((m) => `${m.role === "assistant" ? "Eu" : "Amigo"}: ${m.content}`)
      .join("\n");

    messages = [
      {
        role: "user",
        content: isPortuguese
          ? `Histórico recente da conversa:\n${conversationContext}\n\nAgora responda como "Eu" continuando essa conversa:`
          : `Recent conversation history:\n${conversationContext}\n\nNow respond as "Me" continuing this conversation:`,
      },
    ];
  }

  const response = await client.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 150,
    system: systemPrompt,
    messages,
  });

  let text = response.content[0].type === "text" ? response.content[0].text : "";

  // Clean up the response
  text = text
    .replace(/^(Eu|Me|I):\s*/i, "") // Remove "Eu:" or "Me:" prefix if present
    .replace(/^["']|["']$/g, "") // Remove quotes
    .trim();

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  // Prices Claude Haiku: $0.25/1M input, $1.25/1M output
  const costUSD = (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  // Convert to BRL cents (approximate rate)
  const costCents = costUSD * 100 * 5; // ~5 BRL per USD

  return {
    text,
    tokensUsed: inputTokens + outputTokens,
    costCents,
  };
}
