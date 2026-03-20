---
phase: 3
slug: human-handoff
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` at monorepo root |
| **Quick run command** | `npx vitest run --reporter=verbose ScaleCore/tests/unit/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose ScaleCore/tests/unit/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | HAND-01 | unit | `npx vitest run ScaleCore/tests/unit/handoff-tag-removal.test.ts -t "removes tag"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | HAND-01 | unit | `npx vitest run ScaleCore/tests/unit/handoff-tag-removal.test.ts -t "skips AI echo"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | HAND-02 | unit | `npx vitest run ScaleCore/tests/unit/handoff-summary.test.ts -t "generates summary"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | HAND-02 | unit | `npx vitest run ScaleCore/tests/unit/handoff-summary.test.ts -t "fallback"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | HAND-03 | unit | `npx vitest run ScaleCore/tests/unit/escalation-keywords.test.ts -t "triggers handoff"` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 1 | HAND-03 | unit | `npx vitest run ScaleCore/tests/unit/escalation-keywords.test.ts -t "case insensitive"` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 1 | HAND-04 | manual | Tag gate already tested in existing tests | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ScaleCore/tests/unit/handoff-tag-removal.test.ts` — stubs for HAND-01 (tag removal on fromMe, AI echo detection)
- [ ] `ScaleCore/tests/unit/handoff-summary.test.ts` — stubs for HAND-02 (summary generation, fallback)
- [ ] `ScaleCore/tests/unit/escalation-keywords.test.ts` — stubs for HAND-03 (keyword detection, matching logic)

*Existing infrastructure (vitest) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Re-adding tag reactivates AI | HAND-04 | Requires UI interaction + Evolution API | 1. Remove tag via handoff 2. Add tag back in chat UI 3. Send message from lead 4. Verify AI responds |
| Summary appears in chat UI | HAND-02 | Requires frontend rendering of system_note | 1. Trigger handoff 2. Open chat in UI 3. Verify summary note visible with distinct style |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
