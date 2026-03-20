import { describe, it, expect } from "vitest";

// Requirement: PIPE-03 (tag-based activation)
describe("tag-check", () => {
  it.todo("agent processes message when chat has matching activation_tag");
  it.todo("agent skips message when chat has no matching activation_tag");
  it.todo("agent skips message when chat.tags is null");
  it.todo("agent skips message when chat.tags is empty array");
});
