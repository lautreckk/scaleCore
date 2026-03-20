import { describe, it, expect } from "vitest";
import { isEscalationMatch } from "@/lib/agents/pipeline";

describe("escalation keywords", () => {
  it("triggers handoff when message contains escalation keyword", () => {
    expect(
      isEscalationMatch("quero falar com atendente", ["falar com atendente"])
    ).toBe(true);
  });

  it("case insensitive matching", () => {
    expect(
      isEscalationMatch("FALAR COM ATENDENTE", ["falar com atendente"])
    ).toBe(true);
    expect(
      isEscalationMatch("falar com atendente", ["FALAR COM ATENDENTE"])
    ).toBe(true);
  });

  it("substring matching (keyword anywhere in message)", () => {
    expect(
      isEscalationMatch("por favor quero falar com atendente agora", [
        "falar com atendente",
      ])
    ).toBe(true);
  });

  it("no match when keywords array is empty", () => {
    expect(isEscalationMatch("qualquer coisa", [])).toBe(false);
  });

  it("no match when message does not contain any keyword", () => {
    expect(
      isEscalationMatch("obrigado pelo atendimento", [
        "falar com atendente",
        "cancelar",
      ])
    ).toBe(false);
  });

  it("matches any keyword in the array", () => {
    expect(
      isEscalationMatch("quero cancelar", [
        "falar com atendente",
        "cancelar",
        "reclamar",
      ])
    ).toBe(true);
  });

  it("trims whitespace from content before matching", () => {
    expect(
      isEscalationMatch("  falar com atendente  ", ["falar com atendente"])
    ).toBe(true);
  });
});
