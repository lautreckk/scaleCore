import { describe, it } from "vitest";

describe("media-processor", () => {
  describe("audio transcription (MEDIA-01)", () => {
    it.todo("builds multimodal message with input_audio content part for ogg audio");
    it.todo("falls back to text-only model description when agent model does not support audio");
    it.todo("fetches base64 from Supabase Storage URL");
  });

  describe("image description (MEDIA-02)", () => {
    it.todo("builds multimodal message with image_url content part using data URI");
    it.todo("falls back to text-only model description when agent model does not support vision");
    it.todo("includes caption text alongside image when caption is present");
  });

  describe("PDF text extraction (MEDIA-03)", () => {
    it.todo("extracts text from PDF buffer and truncates to 4000 chars");
    it.todo("returns truncated text with ellipsis indicator for long PDFs");
    it.todo("handles empty PDF gracefully");
  });
});
