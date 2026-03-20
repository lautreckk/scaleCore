import { describe, it, expect } from "vitest";

// Requirement: PIPE-02 (buffer add/drain)
describe("buffer", () => {
  it.todo("addToBuffer returns isFirst=true on first message");
  it.todo("addToBuffer returns isFirst=false on subsequent messages within window");
  it.todo("drainBuffer returns concatenated messages joined by newline");
  it.todo("drainBuffer returns null when lock not acquired");
  it.todo("drainBuffer returns null when buffer is empty");
});
