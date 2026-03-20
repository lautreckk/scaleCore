---
phase: 4
slug: media
status: draft
nyquist_compliant: true
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
| 04-01-01 | 01 | 1 | MEDIA-01 | unit | `npx vitest run ScaleCore/tests/unit/media-processor.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | MEDIA-02 | unit | `npx vitest run ScaleCore/tests/unit/media-processor.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | MEDIA-03 | unit | `npx vitest run ScaleCore/tests/unit/media-processor.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | LIB-01 | manual | N/A (UI CRUD — see Manual-Only below) | N/A | ⬜ pending |
| 04-02-02 | 02 | 1 | LIB-02 | manual | N/A (UI metadata — see Manual-Only below) | N/A | ⬜ pending |
| 04-03-01 | 03 | 2 | LIB-03 | unit | `npx vitest run ScaleCore/tests/unit/media-library.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | LIB-04 | unit | `npx vitest run ScaleCore/tests/unit/media-library.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 2 | LIB-05 | unit | `npx vitest run ScaleCore/tests/unit/media-library.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ScaleCore/tests/unit/media-processor.test.ts` — stubs for MEDIA-01 (audio transcription), MEDIA-02 (image description), MEDIA-03 (PDF extraction)
- [ ] `ScaleCore/tests/unit/media-library.test.ts` — stubs for LIB-03 (prompt augmentation), LIB-04 (marker extraction), LIB-05 (marker stripping)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Media library CRUD UI | LIB-01 | Next.js API routes + Supabase integration; UI upload/list/delete requires browser | Open agent edit page, upload media, verify list, delete item |
| Media name/description editing | LIB-02 | UI inline edit with API PATCH; requires browser interaction | Edit media item name/description, save, verify persistence |
| Audio transcription accuracy | MEDIA-01 | Requires real audio file + LLM call | Send audio via WhatsApp, verify agent responds to content |
| Image description accuracy | MEDIA-02 | Requires real image + LLM call | Send image via WhatsApp, verify agent describes it |
| AI contextual media sending | LIB-04 | Requires LLM judgment | Chat with agent, verify it sends relevant library media |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies or documented manual-only
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
