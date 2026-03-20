---
phase: 4
slug: media
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing project config) |
| **Config file** | `vitest.config.ts` or `vite.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | MEDIA-01 | integration | `npx vitest run src/__tests__/media-audio.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | MEDIA-02 | integration | `npx vitest run src/__tests__/media-image.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | MEDIA-03 | integration | `npx vitest run src/__tests__/media-pdf.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | LIB-01 | integration | `npx vitest run src/__tests__/media-library-crud.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | LIB-02 | unit | `npx vitest run src/__tests__/media-library-metadata.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | LIB-03 | integration | `npx vitest run src/__tests__/media-prompt-injection.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | LIB-04 | integration | `npx vitest run src/__tests__/media-marker-decision.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-05 | 02 | 2 | LIB-05 | integration | `npx vitest run src/__tests__/media-marker-send.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/media-audio.test.ts` — stubs for MEDIA-01 (audio transcription)
- [ ] `src/__tests__/media-image.test.ts` — stubs for MEDIA-02 (image description)
- [ ] `src/__tests__/media-pdf.test.ts` — stubs for MEDIA-03 (PDF extraction)
- [ ] `src/__tests__/media-library-crud.test.ts` — stubs for LIB-01 (CRUD upload)
- [ ] `src/__tests__/media-library-metadata.test.ts` — stubs for LIB-02 (name/description)
- [ ] `src/__tests__/media-prompt-injection.test.ts` — stubs for LIB-03 (prompt augmentation)
- [ ] `src/__tests__/media-marker-decision.test.ts` — stubs for LIB-04 (AI decision)
- [ ] `src/__tests__/media-marker-send.test.ts` — stubs for LIB-05 (marker extraction + send)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audio transcription accuracy | MEDIA-01 | Requires real audio file + LLM call | Send audio via WhatsApp, verify agent responds to content |
| Image description accuracy | MEDIA-02 | Requires real image + LLM call | Send image via WhatsApp, verify agent describes it |
| AI contextual media sending | LIB-04 | Requires LLM judgment | Chat with agent, verify it sends relevant library media |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
