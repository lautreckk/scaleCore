---
phase: 1
slug: agent-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already configured in project) |
| **Config file** | `vitest.config.ts` or "none — Wave 0 installs" |
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
| 01-01-01 | 01 | 1 | AGENT-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AGENT-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | TENANT-01 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | TENANT-02 | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | AGENT-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | AGENT-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | AGENT-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 2 | AGENT-06 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-05 | 02 | 2 | AGENT-07 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test framework setup (vitest config if not present)
- [ ] `__tests__/agents/` — test directory structure
- [ ] Supabase test client helper for RLS verification
- [ ] Shared fixtures for tenant isolation testing

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UI renders model list with prices | AGENT-02 | Visual verification | Open agent creation form, verify model cards show name + price |
| WhatsApp instance link/unlink UI | AGENT-04 | Visual verification | Open agent settings, verify instance picker works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
