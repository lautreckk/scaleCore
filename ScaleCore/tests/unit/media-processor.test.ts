import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentPart } from "@/lib/agents/openrouter";

// Mock pdf-parse before importing the module
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "extracted text content" }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("media-processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module registry so each test gets fresh imports with mocks
    vi.resetModules();
    // Re-apply mocks after reset
    vi.mock("pdf-parse", () => ({
      default: vi.fn().mockResolvedValue({ text: "extracted text content" }),
    }));
    vi.stubGlobal("fetch", mockFetch);
    // Default fetch mock: returns a fake buffer
    mockFetch.mockResolvedValue({
      arrayBuffer: () =>
        Promise.resolve(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer),
    });
  });

  describe("processInboundMedia", () => {
    it("returns ContentPart[] with input_audio for audio messages", async () => {
      const { processInboundMedia } = await import(
        "@/lib/agents/media-processor"
      );
      const result = await processInboundMedia(
        "audio",
        "https://storage.example.com/audio.ogg"
      );
      expect(result.contentParts).toHaveLength(2);
      expect(result.contentParts[0]).toEqual({
        type: "text",
        text: expect.stringContaining("Transcreva"),
      });
      expect(result.contentParts[1]).toMatchObject({
        type: "input_audio",
        input_audio: { format: "ogg" },
      });
      expect(
        (result.contentParts[1] as Extract<ContentPart, { type: "input_audio" }>)
          .input_audio.data
      ).toBeTruthy();
    });

    it("returns ContentPart[] with image_url for image messages", async () => {
      const { processInboundMedia } = await import(
        "@/lib/agents/media-processor"
      );
      const result = await processInboundMedia(
        "image",
        "https://storage.example.com/photo.jpeg"
      );
      expect(result.contentParts).toHaveLength(2);
      expect(result.contentParts[0]).toEqual({
        type: "text",
        text: expect.stringContaining("imagem"),
      });
      const imgPart = result.contentParts[1] as Extract<
        ContentPart,
        { type: "image_url" }
      >;
      expect(imgPart.type).toBe("image_url");
      expect(imgPart.image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    });

    it("includes caption in text part for image with caption", async () => {
      const { processInboundMedia } = await import(
        "@/lib/agents/media-processor"
      );
      const result = await processInboundMedia(
        "image",
        "https://storage.example.com/photo.jpeg",
        "caption text"
      );
      expect(result.contentParts[0]).toEqual({
        type: "text",
        text: expect.stringContaining("caption text"),
      });
    });

    it("returns ContentPart[] with extracted text for PDF documents", async () => {
      const { processInboundMedia } = await import(
        "@/lib/agents/media-processor"
      );
      const result = await processInboundMedia(
        "document",
        "https://storage.example.com/file.pdf"
      );
      expect(result.contentParts).toHaveLength(1);
      expect(result.contentParts[0]).toEqual({
        type: "text",
        text: expect.stringContaining("extracted text content"),
      });
      expect(result.fallbackText).toContain("extracted text content");
    });
  });

  describe("isMultimodalModel", () => {
    it("returns true for openai/gpt-4o-mini", async () => {
      const { isMultimodalModel } = await import(
        "@/lib/agents/media-processor"
      );
      expect(isMultimodalModel("openai/gpt-4o-mini")).toBe(true);
    });

    it("returns false for deepseek/deepseek-chat", async () => {
      const { isMultimodalModel } = await import(
        "@/lib/agents/media-processor"
      );
      expect(isMultimodalModel("deepseek/deepseek-chat")).toBe(false);
    });
  });
});
