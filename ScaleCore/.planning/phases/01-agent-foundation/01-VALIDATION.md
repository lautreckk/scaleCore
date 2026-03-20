---
phase: 1
slug: agent-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Structural verification (grep/ls commands) |
| **Config file** | N/A — no test framework for Phase 1 |
| **Quick run command** | Per-task grep/ls commands in `<automated>` tags |
| **Full suite command** | Run all task `<automated>` verify commands sequentially |
| **Estimated runtime** | ~5 seconds |

**Rationale:** Phase 1 is a CRUD-heavy UI phase with no complex business logic. The project has no existing test framework. Per RESEARCH.md recommendation, automated tests are deferred to Phase 2 (pipeline logic with testable I/O). Phase 1 uses structural verification (file existence, export presence, pattern matching) for automated checks and human-verify checkpoint for functional validation.

---

## Sampling Rate

- **After every task commit:** Run task's `<automated>` verify command
- **After every plan wave:** Run all verify commands for that wave's tasks
- **Before `/gsd:verify-work`:** All structural checks green + human checkpoint approved
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 01-01-01 | 01 | 1 | TENANT-01, TENANT-02 | structural | `grep -c "CREATE TABLE ai_agents" supabase/migrations/001_ai_agents.sql && grep -c "ENABLE ROW LEVEL SECURITY" supabase/migrations/001_ai_agents.sql` | pending |
| 01-01-02 | 01 | 1 | AGENT-03 | structural | `grep -c "CURATED_MODELS" lib/agents/models.ts && grep -c "agentFormSchema" lib/agents/validation.ts` | pending |
| 01-01-03 | 01 | 1 | — | structural | `grep -c "Agentes IA" components/tenant/layout/sidebar.tsx && ls components/ui/radio-group.tsx` | pending |
| 01-02-01 | 02 | 2 | AGENT-01, AGENT-02 | structural | `grep -c "export async function" app/api/agents/route.ts && grep -c "export async function" app/api/agents/\[id\]/route.ts` | pending |
| 01-02-02a | 02 | 2 | AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07 | structural | `ls components/agents/agent-form.tsx components/agents/model-selector.tsx components/agents/tag-input.tsx components/agents/bulk-tag-dialog.tsx` | pending |
| 01-02-02b | 02 | 2 | AGENT-01, AGENT-02 | structural | `ls app/\(tenant\)/agentes/page.tsx app/\(tenant\)/agentes/novo/page.tsx app/\(tenant\)/agentes/\[id\]/page.tsx` | pending |
| 01-02-03 | 02 | 2 | ALL | human-verify | Human checkpoint — 15-step functional walkthrough | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed for Phase 1.

- Structural verification via grep/ls is sufficient for CRUD + UI file creation
- Functional verification handled by human-verify checkpoint (Task 3 in Plan 02)
- Test framework (vitest) will be introduced in Phase 2 when pipeline logic requires automated unit/integration tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent cards render correctly with model, tag, status | AGENT-01, AGENT-03 | Visual layout verification | Open /agentes, verify card grid renders with correct data |
| Model dropdown shows 10 models with prices | AGENT-03 | Visual verification | Open agent form, verify dropdown content |
| Tag slug preview updates in real-time | AGENT-06 | Interactive behavior | Type in tag field, verify Badge preview updates |
| Bulk tag dialog shows correct count | AGENT-07 | End-to-end flow | Select "all existing", save, verify dialog count |
| Instance checkbox list with status dots | AGENT-04, AGENT-05 | Visual verification | Open agent form, verify instance list |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (structural checks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 not needed — structural verification requires no setup
- [x] No watch-mode flags
- [x] Feedback latency < 15s (structural checks run in ~5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
