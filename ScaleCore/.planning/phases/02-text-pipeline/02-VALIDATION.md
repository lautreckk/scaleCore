---
phase: 2
slug: text-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework configured — Wave 0 required |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | N/A — Wave 0 sets up |
| **Full suite command** | N/A — Wave 0 sets up |
| **Estimated runtime** | ~10 seconds (unit tests only) |

---

## Sampling Rate

- **After every task commit:** Manual WhatsApp test (send message, verify response)
- **After every plan wave:** Full flow test (buffer + memory + billing)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PIPE-01 | integration | Manual test via Evolution API | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | PIPE-02 | unit | Test buffer.ts add/drain functions | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | PIPE-03 | unit | Test tag check function | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | PIPE-04 | unit | Test skip logic | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | PIPE-05 | unit | Test splitter.ts | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 1 | PIPE-06 | integration | Manual test via WhatsApp | N/A | ⬜ pending |
| 02-02-01 | 02 | 1 | MEM-01 | integration | Test memory.ts with Supabase | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | MEM-02 | unit | Test query limit | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | MEM-03 | integration | Manual test | N/A | ⬜ pending |
| 02-03-01 | 03 | 1 | BILL-01 | integration | Test billing.ts with wallet RPC | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | BILL-02 | unit | Test cost lookup from CURATED_MODELS | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 1 | BILL-03 | unit | Test balance check logic | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install test framework (vitest recommended for Next.js projects)
- [ ] `tests/unit/buffer.test.ts` — stubs for PIPE-02
- [ ] `tests/unit/tag-check.test.ts` — stubs for PIPE-03
- [ ] `tests/unit/from-me-filter.test.ts` — stubs for PIPE-04
- [ ] `tests/unit/splitter.test.ts` — stubs for PIPE-05
- [ ] `tests/unit/memory-window.test.ts` — stubs for MEM-02
- [ ] `tests/unit/cost-lookup.test.ts` — stubs for BILL-02
- [ ] `tests/unit/balance-check.test.ts` — stubs for BILL-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Webhook routes to correct agent | PIPE-01 | Requires real Evolution API webhook | Send WhatsApp message, verify agent receives it |
| Typing indicator displayed | PIPE-06 | Requires WhatsApp client observation | Send message, observe typing indicator in WhatsApp |
| #limpar clears history | MEM-03 | End-to-end flow with DB | Send "#limpar", verify response and DB cleared |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
