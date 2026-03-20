import { describe, it, expect, vi } from "vitest";
import {
  buildSystemPromptWithMedia,
  extractMediaMarkers,
  stripMediaMarkers,
  sendMediaFromLibrary,
} from "@/lib/agents/media-library";
import type { AiAgentMediaRow } from "@/types/database";

function makeMedia(overrides: Partial<AiAgentMediaRow> = {}): AiAgentMediaRow {
  return {
    id: "uuid-001",
    agent_id: "agent-1",
    name: "Catalogo",
    description: "PDF do catalogo de produtos",
    media_type: "document",
    file_url: "https://storage.example.com/catalogo.pdf",
    mime_type: "application/pdf",
    file_size: 1024,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("media-library", () => {
  describe("prompt injection (LIB-03)", () => {
    it("returns base prompt unchanged when no media items", () => {
      const result = buildSystemPromptWithMedia("Voce e um assistente.", []);
      expect(result).toBe("Voce e um assistente.");
    });

    it("appends media catalog to system prompt when agent has media items", () => {
      const media = [makeMedia()];
      const result = buildSystemPromptWithMedia("Voce e um assistente.", media);
      expect(result).toContain("MIDIAS DISPONIVEIS");
      expect(result).toContain("[MEDIA:uuid-001] Catalogo: PDF do catalogo de produtos");
      expect(result).toMatch(/^Voce e um assistente\./);
    });

    it("only includes active media items in catalog", () => {
      const media = [
        makeMedia({ id: "active-1", name: "Ativo", is_active: true }),
        makeMedia({ id: "inactive-1", name: "Inativo", is_active: false }),
      ];
      const result = buildSystemPromptWithMedia("prompt", media);
      expect(result).toContain("[MEDIA:active-1]");
      expect(result).not.toContain("[MEDIA:inactive-1]");
    });

    it("formats each item as [MEDIA:uuid] name: description", () => {
      const media = [
        makeMedia({ id: "aaa-111", name: "Foto", description: "Foto do produto" }),
        makeMedia({ id: "bbb-222", name: "Video", description: "Video demo" }),
      ];
      const result = buildSystemPromptWithMedia("prompt", media);
      expect(result).toContain("- [MEDIA:aaa-111] Foto: Foto do produto");
      expect(result).toContain("- [MEDIA:bbb-222] Video: Video demo");
    });
  });

  describe("marker extraction (LIB-04)", () => {
    it("extracts single MEDIA marker UUID from AI response text", () => {
      const ids = extractMediaMarkers("Aqui esta o catalogo [MEDIA:abc-def-123] para voce");
      expect(ids).toEqual(["abc-def-123"]);
    });

    it("extracts multiple MEDIA marker UUIDs from AI response text", () => {
      const ids = extractMediaMarkers("text [MEDIA:abc-123] more [MEDIA:def-456] end");
      expect(ids).toEqual(["abc-123", "def-456"]);
    });

    it("returns empty array when no markers present", () => {
      const ids = extractMediaMarkers("no markers here");
      expect(ids).toEqual([]);
    });
  });

  describe("marker stripping (LIB-05)", () => {
    it("strips all MEDIA markers from text leaving clean response", () => {
      const result = stripMediaMarkers("Aqui esta [MEDIA:abc-123] o catalogo");
      expect(result).toBe("Aqui esta o catalogo");
    });

    it("collapses multiple spaces after marker removal", () => {
      const result = stripMediaMarkers("Veja [MEDIA:aaa-111] e [MEDIA:bbb-222] aqui");
      expect(result).not.toMatch(/\s{2,}/);
    });

    it("trims leading and trailing whitespace after stripping", () => {
      const result = stripMediaMarkers("[MEDIA:abc-123] texto aqui [MEDIA:def-456]");
      expect(result).toBe("texto aqui");
    });
  });

  describe("sendMediaFromLibrary", () => {
    it("sends each media file via evolutionClient.sendMedia with correct params", async () => {
      const mockSendMedia = vi.fn().mockResolvedValue({ success: true });
      const mockEvolutionClient = { sendMedia: mockSendMedia } as any;

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    makeMedia({ id: "media-1", name: "Catalogo", media_type: "document", mime_type: "application/pdf", file_url: "https://storage.example.com/cat.pdf" }),
                  ],
                }),
              }),
            }),
          }),
        }),
      } as any;

      await sendMediaFromLibrary(
        ["media-1"],
        "agent-1",
        mockSupabase,
        mockEvolutionClient,
        "instance-1",
        "5511999999999"
      );

      expect(mockSendMedia).toHaveBeenCalledWith("instance-1", {
        number: "5511999999999",
        mediatype: "document",
        mimetype: "application/pdf",
        caption: "Catalogo",
        media: "https://storage.example.com/cat.pdf",
        fileName: "Catalogo",
      });
    });

    it("does nothing when mediaIds is empty", async () => {
      const mockEvolutionClient = { sendMedia: vi.fn() } as any;
      await sendMediaFromLibrary([], "agent-1", {} as any, mockEvolutionClient, "inst", "123");
      expect(mockEvolutionClient.sendMedia).not.toHaveBeenCalled();
    });
  });
});
