import { describe, it } from "vitest";

describe("handoff summary", () => {
  it.todo("generates summary from conversation history via LLM");
  it.todo("inserts summary as system_note message type");
  it.todo("uses SUMMARY_MODEL (openai/gpt-4o-mini), not agent model");
  it.todo("fallback note inserted when summary generation fails");
  it.todo("handles empty conversation history");
});
