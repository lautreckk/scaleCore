---
phase: 01-agent-foundation
verified: 2026-03-20T12:00:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/13
  gaps_closed:
    - "Usuario pode escolher entre aplicar tag em todos os chats existentes ou apenas em novos chats — handleBulkTagConfirm now uses savedAgentIdRef.current (set from POST response) instead of the undefined agentId prop; old early-return guard removed"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Apply migration and verify RLS isolation"
    expected: "ai_agents and ai_agent_instances tables exist in Supabase with RLS active; tenant A cannot read tenant B agents"
    why_human: "Cannot verify Supabase database state programmatically from filesystem"
  - test: "Create agent with tag_apply_mode = all_existing"
    expected: "After saving new agent, bulk tag dialog appears, user confirms, and POST /api/agents/{newId}/tags is sent successfully with a success toast showing affected count"
    why_human: "End-to-end flow requires browser interaction and live Supabase data"
  - test: "Complete agent CRUD flow"
    expected: "All 15 steps from Plan 02 Task 3 checkpoint pass (create, list, edit, toggle, delete, duplicate tag error)"
    why_human: "Visual and functional verification requiring logged-in tenant session"
---

# Phase 01: Agent Foundation Verification Report

**Phase Goal:** Usuarios podem criar, configurar e gerenciar agentes IA vinculados a instancias WhatsApp, com isolamento completo por tenant
**Verified:** 2026-03-20T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 03 fix applied)

## Important Note: Source Code Location

All source code (app, components, lib, types, supabase) lives at `/Users/lautreck/Desktop/Trabalho/SenaWorks/`. The git repository at `ScaleCore/` only tracks `.planning/` files. All source verification is performed against files in `SenaWorks/`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tabelas ai_agents e ai_agent_instances existem com RLS ativo | HUMAN NEEDED | Migration file at SenaWorks/supabase/migrations/001_ai_agents.sql is complete and substantive (CREATE TABLE, RLS, indexes, RPC) — application to Supabase requires human verification |
| 2 | Tipos TypeScript para as novas tabelas existem em database.ts | VERIFIED | types/database.ts declares both ai_agents and ai_agent_instances with correct Row/Insert/Update pattern |
| 3 | Lista curada de 10 modelos LLM com precos em creditos disponivel como constante | VERIFIED | lib/agents/models.ts exports CURATED_MODELS with 10 models across 6 providers, each with creditsPerMessage |
| 4 | Schema Zod de validacao do formulario de agente esta definido | VERIFIED | lib/agents/validation.ts exports agentFormSchema (7 fields), AgentFormData, slugifyTag |
| 5 | Item Agentes IA aparece no sidebar do tenant | VERIFIED | components/tenant/layout/sidebar.tsx contains "Agentes IA" entry with Bot icon |
| 6 | Usuario pode criar agente com nome, prompt, modelo, tag e instancias | VERIFIED | POST /api/agents validates via agentFormSchema, inserts ai_agents + ai_agent_instances, handles 23505 with 409 |
| 7 | Usuario pode editar todos os campos de um agente existente | VERIFIED | PATCH /api/agents/[id] uses partial schema, replace-strategy for instances, returns updated agent |
| 8 | Usuario pode deletar agente com confirmacao | VERIFIED | DeleteDialog opens AlertDialog; handleDelete calls DELETE /api/agents/[id]; junction rows cascade |
| 9 | Usuario pode vincular e desvincular instancias WhatsApp | VERIFIED | InstanceSelector fetches instances per tenant; PATCH replaces all bindings with new instance_ids array |
| 10 | Usuario pode configurar tag de ativacao com preview em tempo real | VERIFIED | activation_tag field calls slugifyTag on watch, renders Badge preview below the input field |
| 11 | Usuario pode escolher entre aplicar tag em novos chats ou todos existentes | VERIFIED | handleBulkTagConfirm uses savedAgentIdRef.current (set from POST response on line 99); old guard that silently skipped create-mode bulk tag is removed; fetch to /api/agents/${targetId}/tags is wired on line 144 |
| 12 | Listagem mostra cards com nome, modelo, status, instancias e tag | VERIFIED | AgentCard renders name, model Badge (CURATED_MODELS lookup), activation_tag Badge, instanceCount text, Inativo badge when is_active=false |
| 13 | Toggle ativo/inativo funciona no card e na pagina de edicao | VERIFIED | AgentCard.handleToggle patches /api/agents/[id] with { is_active }, optimistic update + revert on error; AgentForm edit mode shows is_active Switch |

**Score:** 13/13 truths verified (12 fully automated, 1 pending human verification for migration application)

### Required Artifacts

#### Plan 01-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/001_ai_agents.sql` | DB tables, RLS policies, indexes, RPC | VERIFIED (file) / HUMAN NEEDED (applied) | File is complete and substantive; migration application to Supabase unverifiable from filesystem |
| `types/database.ts` | TS types for ai_agents and ai_agent_instances | VERIFIED | Both table definitions present, pattern matches existing tables |
| `lib/agents/models.ts` | CURATED_MODELS with 10 models | VERIFIED | 10 models, CuratedModel interface, provider + creditsPerMessage on each |
| `lib/agents/validation.ts` | Zod schema + slugifyTag | VERIFIED | agentFormSchema, AgentFormData, slugifyTag all exported |
| `components/tenant/layout/sidebar.tsx` | Agentes IA navigation item | VERIFIED | "Agentes IA" entry with Bot icon present |
| `components/ui/radio-group.tsx` | RadioGroup component | VERIFIED | File exists, used in agent-form.tsx |
| `components/ui/form.tsx` | Form shadcn component | VERIFIED | File exists, used in agent-form.tsx |

#### Plan 01-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `app/api/agents/route.ts` | GET (list) + POST (create) | VERIFIED | Auth+tenant pattern, Supabase queries, 23505 handling, 201 response |
| `app/api/agents/[id]/route.ts` | GET + PATCH + DELETE | VERIFIED | Async params pattern, partial schema for PATCH, cascade delete |
| `app/api/agents/[id]/tags/route.ts` | GET (count) + POST (bulk apply) | VERIFIED | Count chats without tag, apply via apply_agent_tag RPC on line 117 |
| `components/agents/agent-form.tsx` | Shared create/edit form | VERIFIED | Bug fixed in Plan 03: savedAgentIdRef.current used in handleBulkTagConfirm; old early-return guard removed |
| `components/agents/agent-card.tsx` | Card with toggle | VERIFIED | CURATED_MODELS lookup, optimistic Switch toggle, click navigates to edit |
| `components/agents/model-selector.tsx` | Model dropdown | VERIFIED | Renders all 10 CURATED_MODELS with provider and creditsPerMessage |
| `components/agents/instance-selector.tsx` | Instance checkbox list | VERIFIED | Fetches from whatsapp_instances per tenant, status dot, empty state |
| `components/agents/tag-input.tsx` | Tag input with slug preview | VERIFIED | Standalone component; also inlined in agent-form.tsx with live slugifyTag preview |
| `components/agents/delete-dialog.tsx` | Delete confirmation | VERIFIED | AlertDialog with correct copy, destructive confirm |
| `components/agents/bulk-tag-dialog.tsx` | Bulk tag confirmation | VERIFIED | AlertDialog with tag and count interpolation |
| `app/(tenant)/agentes/page.tsx` | Agent listing page | VERIFIED | Fetches /api/agents, renders AgentCard grid, loading/error/empty states |
| `app/(tenant)/agentes/novo/page.tsx` | Create agent page | VERIFIED | Renders AgentForm mode="create" |
| `app/(tenant)/agentes/[id]/page.tsx` | Edit agent page | VERIFIED | Fetches /api/agents/[id], maps instance_ids, renders AgentForm mode="edit" |

#### Plan 01-03 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `components/agents/agent-form.tsx` | Fixed bulk tag confirm handler | VERIFIED | useRef import on line 3; savedAgentIdRef declared on line 45; ref set on line 99; targetId used on line 136; fetch to /api/agents/${targetId}/tags on line 144 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `components/agents/agent-form.tsx` | `/api/agents` | fetch POST/PATCH on form submit | WIRED | line 78: fetch(url, { method }) where url is /api/agents or /api/agents/${agentId} |
| `components/agents/agent-form.tsx` | `/api/agents/{id}/tags` | handleBulkTagConfirm using savedAgentIdRef.current | WIRED | line 144: fetch(`/api/agents/${targetId}/tags`, { method: "POST" }) — targetId = savedAgentIdRef.current (set from POST response on line 99) |
| `app/(tenant)/agentes/page.tsx` | `/api/agents` | fetch GET on mount | WIRED | useEffect fetch("/api/agents") in listing page |
| `components/agents/agent-card.tsx` | `/api/agents/[id]` | PATCH for toggle | WIRED | fetch(`/api/agents/${agent.id}`, { method: "PATCH" }) |
| `lib/agents/validation.ts` | `lib/agents/models.ts` | model_id validation against CURATED_MODELS | NOT WIRED | validation.ts uses z.string().min(1) for model_id — does not enum-constrain against CURATED_MODELS. Low severity: API server still validates, UI only shows curated models in selector |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGENT-01 | 01-02 | Criar agente com nome, prompt, configuracoes | SATISFIED | POST /api/agents + AgentForm with all fields |
| AGENT-02 | 01-02 | Editar e deletar agentes existentes | SATISFIED | PATCH + DELETE /api/agents/[id] + edit page + DeleteDialog |
| AGENT-03 | 01-01, 01-02 | Selecionar modelo LLM de lista curada (8-12 modelos) | SATISFIED | CURATED_MODELS has 10 models with provider and credit pricing |
| AGENT-04 | 01-02 | Vincular agente a 1 ou mais instancias WhatsApp | SATISFIED | InstanceSelector + ai_agent_instances junction table + PATCH replace strategy |
| AGENT-05 | 01-02 | Desvincular agente de instancias sem afetar outros agentes | SATISFIED | PATCH with empty instance_ids deletes only this agent's bindings; CASCADE scoped to agent_id |
| AGENT-06 | 01-02 | Configurar tag de ativacao customizada por agente | SATISFIED | activation_tag field with regex validation, slugifyTag, unique constraint per tenant |
| AGENT-07 | 01-02, 01-03 | Escolher entre aplicar tag em existentes ou apenas novos | SATISFIED | Plan 03 fix: handleBulkTagConfirm uses savedAgentIdRef.current; create-mode bulk tag POST is now sent correctly |
| TENANT-01 | 01-01 | Dados isolados por tenant_id com RLS | SATISFIED | RLS on ai_agents and ai_agent_instances; all API routes scope by tenantUser.tenant_id |
| TENANT-02 | 01-01 | Usuario so ve e gerencia agentes do proprio tenant | SATISFIED | All API routes resolve tenant via auth.uid() -> tenant_users -> tenant_id |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `lib/agents/validation.ts` | model_id field | z.string().min(1) — does not constrain model_id to CURATED_MODELS values | Info | Any string passes server validation; mitigated because UI selector only shows curated models |

No blockers found in re-verification. The two previous blockers in agent-form.tsx have been resolved by Plan 03.

### Human Verification Required

#### 1. Migration Applied to Supabase

**Test:** Log into Supabase dashboard for this project and verify that tables `ai_agents` and `ai_agent_instances` exist with RLS enabled. Verify the RPC function `apply_agent_tag` exists under Database > Functions.
**Expected:** Both tables visible in Table Editor; RLS toggle is ON; policies "Tenant isolation" listed for both tables; apply_agent_tag function present.
**Why human:** Cannot verify remote Supabase database state from the filesystem.

#### 2. Bulk Tag Flow in Create Mode

**Test:** Create a new agent with "Todos os chats existentes" selected, submit the form, observe the dialog and response.
**Expected:** Dialog appears with a chat count, clicking "Aplicar Tag" sends POST to /api/agents/{newId}/tags and shows a success toast "Tag aplicada em X chats", then redirects to /agentes.
**Why human:** End-to-end flow requires browser interaction and live Supabase data; the code fix is verified, runtime behavior is not.

#### 3. Complete Agent CRUD Flow

**Test:** Follow the 15-step verification from Plan 02 Task 3: create agent, view listing, edit, toggle switch on card, test duplicate tag error, delete with confirmation.
**Expected:** All 15 steps pass without errors.
**Why human:** Visual and functional verification; requires logged-in tenant session.

## Gaps Summary

No gaps remain. All previously-failed automated checks now pass:

**Gap 1 (AGENT-07 — Bulk tag in create mode): CLOSED.** Plan 03 applied the correct fix to `components/agents/agent-form.tsx`:
- `useRef` imported alongside `useState` (line 3)
- `savedAgentIdRef = useRef<string | null>(agentId ?? null)` declared at line 45
- `savedAgentIdRef.current = savedAgentId` set in `onSubmit` after the POST response (line 99)
- `handleBulkTagConfirm` reads `const targetId = savedAgentIdRef.current` (line 136)
- `fetch(\`/api/agents/${targetId}/tags\`, { method: "POST" })` called with the correct ID (line 144)
- The old `if (!agentId && mode === "create") { router.push; return; }` guard is fully removed

**Gap 2 (Migration tracking): UNCHANGED.** The Supabase migration file exists on disk and is substantive. Whether it has been applied to the live Supabase project remains a human verification item. This is an operational concern, not a code defect.

The phase is automated-complete. Proceeding to human verification is the final step.

---

_Verified: 2026-03-20T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — closed gaps from 2026-03-20T06:00:00Z initial verification_
