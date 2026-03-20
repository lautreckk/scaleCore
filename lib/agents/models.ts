export interface CuratedModel {
  id: string;
  name: string;
  provider: string;
  creditsPerMessage: number;
  description?: string;
}

export const CURATED_MODELS: CuratedModel[] = [
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", creditsPerMessage: 3, description: "Melhor qualidade geral" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", creditsPerMessage: 1, description: "Rapido e economico" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", creditsPerMessage: 3, description: "Excelente para conversas" },
  { id: "anthropic/claude-haiku-3.5", name: "Claude Haiku 3.5", provider: "Anthropic", creditsPerMessage: 1, description: "Ultra rapido" },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", creditsPerMessage: 1, description: "Rapido, bom custo-beneficio" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", creditsPerMessage: 4, description: "Raciocinio avancado" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta", creditsPerMessage: 1, description: "Otimo open-source" },
  { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", provider: "DeepSeek", creditsPerMessage: 1, description: "Excelente custo-beneficio" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", creditsPerMessage: 2, description: "Raciocinio profundo" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", provider: "Qwen", creditsPerMessage: 1, description: "Forte em multilingual" },
];
