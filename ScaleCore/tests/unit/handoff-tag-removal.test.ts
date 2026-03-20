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
import { clearBuffer } from "@/lib/agents/buffer";

function createMockSupabase() {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn(() => ({ insert: insertFn })),
    _insertFn: insertFn,
  };
}

describe("handoff tag removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes tag from chat when fromMe message detected", async () => {
    const supabase = createMockSupabase();
    await performHandoff({
      chatId: "chat-123",
      activationTag: "vendas",
      instanceId: "inst-1",
      remoteJid: "5511999999999@s.whatsapp.net",
      supabase: supabase as any,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("remove_chat_tag", {
      p_chat_id: "chat-123",
      p_tag: "vendas",
    });
  });

  it("clears Redis buffer for the chat on handoff", async () => {
    const supabase = createMockSupabase();
    await performHandoff({
      chatId: "chat-123",
      activationTag: "vendas",
      instanceId: "inst-1",
      remoteJid: "5511999999999@s.whatsapp.net",
      supabase: supabase as any,
    });

    expect(clearBuffer).toHaveBeenCalledWith("inst-1", "5511999999999@s.whatsapp.net");
  });

  it("calls rpc before clearBuffer (tag removal stops AI first)", async () => {
    const callOrder: string[] = [];
    const supabase = createMockSupabase();
    supabase.rpc.mockImplementation(async () => {
      callOrder.push("rpc");
      return { error: null };
    });
    vi.mocked(clearBuffer).mockImplementation(async () => {
      callOrder.push("clearBuffer");
    });

    await performHandoff({
      chatId: "chat-123",
      activationTag: "vendas",
      instanceId: "inst-1",
      remoteJid: "5511999999999@s.whatsapp.net",
      supabase: supabase as any,
    });

    expect(callOrder).toEqual(["rpc", "clearBuffer"]);
  });
});
