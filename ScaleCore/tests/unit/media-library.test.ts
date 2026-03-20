import { describe, it } from "vitest";

describe("media-library", () => {
  describe("prompt injection (LIB-03)", () => {
    it.todo("appends media catalog to system prompt when agent has media items");
    it.todo("returns base prompt unchanged when no media items");
    it.todo("only includes active media items in catalog");
    it.todo("formats each item as [MEDIA:uuid] name: description");
  });

  describe("marker extraction (LIB-04)", () => {
    it.todo("extracts single MEDIA marker UUID from AI response text");
    it.todo("extracts multiple MEDIA marker UUIDs from AI response text");
    it.todo("returns empty array when no markers present");
  });

  describe("marker stripping (LIB-05)", () => {
    it.todo("strips all MEDIA markers from text leaving clean response");
    it.todo("collapses multiple spaces after marker removal");
    it.todo("trims leading and trailing whitespace after stripping");
  });
});
