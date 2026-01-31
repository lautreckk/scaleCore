import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generateWarmingMessage } from "./ai-service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface MessageGeneratorOptions {
  tenantId: string;
  useAI: boolean;
  aiTopics?: string[] | null;
  aiTone?: string;
  aiLanguage?: string;
  isStartingConversation: boolean;
  previousMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface GeneratedMessage {
  text: string;
  aiGenerated: boolean;
  tokensUsed?: number;
  costCents?: number;
}

export async function generateMessage(
  options: MessageGeneratorOptions
): Promise<GeneratedMessage> {
  // If AI is enabled and configured, try to generate with AI
  if (options.useAI && process.env.ANTHROPIC_API_KEY) {
    try {
      const aiResult = await generateWarmingMessage({
        previousMessages: options.previousMessages || [],
        topics: options.aiTopics || [],
        tone: options.aiTone || "casual",
        isStarting: options.isStartingConversation,
        language: options.aiLanguage || "pt-BR",
      });

      return {
        text: aiResult.text,
        aiGenerated: true,
        tokensUsed: aiResult.tokensUsed,
        costCents: aiResult.costCents,
      };
    } catch (error) {
      console.error("AI message generation failed, falling back to templates:", error);
      // Fall through to template-based generation
    }
  }

  // Use template-based generation
  const supabase = createAdminClient(supabaseUrl, supabaseServiceKey);

  // Determine category based on context
  let category: string;
  if (options.isStartingConversation) {
    category = "saudacao";
  } else if (options.previousMessages && options.previousMessages.length > 4) {
    // If conversation is long, chance of ending it
    if (Math.random() < 0.3) {
      category = "despedida";
    } else {
      category = Math.random() < 0.5 ? "resposta" : "geral";
    }
  } else {
    category = Math.random() < 0.5 ? "resposta" : "geral";
  }

  // Fetch templates
  const { data: templates, error } = await supabase
    .from("warming_message_templates")
    .select("id, content")
    .eq("category", category)
    .eq("is_active", true)
    .or(`tenant_id.is.null,tenant_id.eq.${options.tenantId}`);

  if (error || !templates || templates.length === 0) {
    // Fallback messages
    const fallbacks: Record<string, string[]> = {
      saudacao: ["E aí, tudo bem?", "Opa, beleza?", "Oi!"],
      resposta: ["Tudo certo!", "Beleza!", "De boa"],
      geral: ["Legal!", "Show!", "Entendi"],
      despedida: ["Falou!", "Até mais!", "Valeu!"],
    };

    const options_list = fallbacks[category] || fallbacks.geral;
    return {
      text: options_list[Math.floor(Math.random() * options_list.length)],
      aiGenerated: false,
    };
  }

  // Select random template
  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

  // Update usage count (fire and forget)
  supabase
    .from("warming_message_templates")
    .update({ usage_count: supabase.rpc("increment", { x: 1 }) })
    .eq("id", selectedTemplate.id)
    .then(() => {});

  return {
    text: selectedTemplate.content,
    aiGenerated: false,
  };
}

// Generate status text
export async function generateStatusText(
  options: Pick<MessageGeneratorOptions, "tenantId" | "useAI" | "aiTopics" | "aiTone" | "aiLanguage">
): Promise<GeneratedMessage> {
  // If AI is enabled
  if (options.useAI && process.env.ANTHROPIC_API_KEY) {
    try {
      const aiResult = await generateWarmingMessage({
        previousMessages: [],
        topics: options.aiTopics || [],
        tone: options.aiTone || "casual",
        isStarting: true,
        language: options.aiLanguage || "pt-BR",
        isStatus: true,
      });

      return {
        text: aiResult.text,
        aiGenerated: true,
        tokensUsed: aiResult.tokensUsed,
        costCents: aiResult.costCents,
      };
    } catch (error) {
      console.error("AI status generation failed:", error);
    }
  }

  // Fallback status texts
  const statusTexts = [
    "Bom dia! ☀️",
    "Mais um dia de trabalho 💪",
    "Foco no que importa 🎯",
    "Gratidão por hoje 🙏",
    "Vamos que vamos! 🚀",
    "Boa semana a todos! 👋",
    "Café e muito trabalho ☕",
    "Nunca desista dos seus sonhos 💫",
    "Cada dia uma conquista 🏆",
    "Positividade sempre! ✨",
  ];

  return {
    text: statusTexts[Math.floor(Math.random() * statusTexts.length)],
    aiGenerated: false,
  };
}
