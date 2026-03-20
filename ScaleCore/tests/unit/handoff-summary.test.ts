import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing handoff module
vi.mock("@/lib/agents/openrouter", () => ({
  chatCompletion: vi.fn().mockResolvedValue({ content: "mock summary", usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }),
}));

vi.mock("@/lib/agents/memory", () => ({
  getConversationHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/agents/buffer", () => ({
  clearBuffer: vi.fn().mockResolvedValue(undefined),
}));

import { performHandoff } from "@/lib/agents/handoff";
import { chatCompletion } from "@/lib/agents/openrouter";
import { getConversationHistory } from "@/lib/agents/memory";

function createMockSupabase() {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn(() => ({ insert: insertFn })),
    _insertFn: insertFn,
  };
}

const defaultParams = {
  chatId: "chat-123",
  activationTag: "vendas",
  instanceId: "inst-1",
  remoteJid: "5511999999999@s.whatsapp.net",
};

describe("handoff summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates summary from conversation history via LLM", async () => {
    const supabase = createMockSupabase();
    vi.mocked(getConversationHistory).mockResolvedValue([
      { role: "user", content: "Oi, quero saber do produto X" },
      { role: "assistant", content: "Claro! O produto X custa R$100" },
    ]);
    vi.mocked(chatCompletion).mockResolvedValue({
      content: "Lead perguntou sobre produto X, preco R$100.",
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    await performHandoff({ ...defaultParams, supabase: supabase as any });

    expect(chatCompletion).toHaveBeenCalledWith(
      "openai/gpt-4o-mini",
      expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({ role: "user" }),
      ])
    );
  });

  it("inserts summary as system_note message type", async () => {
    const supabase = createMockSupabase();
    vi.mocked(getConversationHistory).mockResolvedValue([
      { role: "user", content: "Oi" },
    ]);
    vi.mocked(chatCompletion).mockResolvedValue({
      content: "Resumo da conversa.",
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    await performHandoff({ ...defaultParams, supabase: supabase as any });

    expect(supabase.from).toHaveBeenCalledWith("messages");
    expect(supabase._insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        chat_id: "chat-123",
        message_type: "system_note",
        content: expect.stringContaining("[Resumo IA]"),
      })
    );
  });

  it("uses SUMMARY_MODEL (openai/gpt-4o-mini), not agent model", async () => {
    const supabase = createMockSupabase();
    vi.mocked(getConversationHistory).mockResolvedValue([
      { role: "user", content: "Oi" },
    ]);

    await performHandoff({ ...defaultParams, supabase: supabase as any });

    expect(chatCompletion).toHaveBeenCalledWith(
      "openai/gpt-4o-mini",
      expect.any(Array)
    );
  });

  it("fallback note inserted when summary generation fails", async () => {
    const supabase = createMockSupabase();
    vi.mocked(getConversationHistory).mockResolvedValue([
      { role: "user", content: "Oi" },
    ]);
    vi.mocked(chatCompletion).mockRejectedValue(new Error("API down"));

    await performHandoff({ ...defaultParams, supabase: supabase as any });

    expect(supabase._insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message_type: "system_note",
        content: "[Handoff IA] Atendente assumiu a conversa. Resumo indisponivel -- verifique o historico.",
      })
    );
  });

  it("handles empty conversation history", async () => {
    const supabase = createMockSupabase();
    vi.mocked(getConversationHistory).mockResolvedValue([]);

    await performHandoff({ ...defaultParams, supabase: supabase as any });

    // Should NOT call chatCompletion when history is empty
    expect(chatCompletion).not.toHaveBeenCalled();
    // Should insert note with "Sem historico" text
    expect(supabase._insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        message_type: "system_note",
        content: expect.stringContaining("Sem historico de conversa."),
      })
    );
  });
});
