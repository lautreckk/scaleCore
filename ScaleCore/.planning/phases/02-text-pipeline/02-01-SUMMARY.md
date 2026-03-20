---
phase: 02-text-pipeline
plan: 01
subsystem: api
tags: [openrouter, llm, supabase, billing, conversation-memory, rls]

# Dependency graph
requires:
  - phase: 01-agent-foundation
    provides: "CURATED_MODELS constant with creditsPerMessage, ai_agents table, Supabase client patterns"
provides:
  - "ai_conversation_messages table with RLS and sliding window indexes"
  - "OpenRouter chat completion client (chatCompletion, ChatMessage, OpenRouterResponse)"
  - "Conversation memory CRUD (getConversationHistory, saveConversationMessages, clearConversationHistory)"
  - "Wallet billing logic (checkAndDebitWallet)"
affects: [02-text-pipeline, 03-handoff, 04-media]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Dependency injection via SupabaseClient parameter for testability", "Native fetch for external API calls (no SDK)", "Sliding window query pattern (newest-first + reverse)"]

key-files:
  created:
    - supabase/migrations/002_ai_conversation_messages.sql
    - lib/agents/openrouter.ts
    - lib/agents/memory.ts
    - lib/agents/billing.ts
  modified:
    - types/database.ts

key-decisions:
  - "No new npm dependencies — all modules use existing @supabase/supabase-js + native fetch"
  - "Modules use dependency injection (SupabaseClient param) instead of importing createClient directly"

patterns-established:
  - "Agent lib modules accept SupabaseClient as parameter for caller flexibility"
  - "OpenRouter integration via native fetch with typed response interfaces"

requirements-completed: [MEM-01, MEM-02, BILL-01, BILL-02, BILL-03]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 02 Plan 01: Data Layer Summary

**Conversation memory table with RLS, OpenRouter LLM client, sliding-window memory CRUD, and credit-based wallet billing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T12:11:31Z
- **Completed:** 2026-03-20T12:14:35Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created ai_conversation_messages table with tenant-isolated RLS, role constraint, and optimized sliding window index
- Built OpenRouter chat completion client using native fetch with typed request/response
- Implemented conversation memory CRUD with 50-message sliding window (newest-first query + reverse for chronological order)
- Created wallet billing module that checks balance and debits atomically via existing deduct_wallet_balance RPC

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and TypeScript types** - `5240dfd` (feat)
2. **Task 2: OpenRouter client, memory, and billing modules** - `ced3e3c` (feat)

## Files Created/Modified
- `supabase/migrations/002_ai_conversation_messages.sql` - Conversation memory table with RLS, indexes, role check
- `types/database.ts` - Added ai_conversation_messages Row/Insert/Update types
- `lib/agents/openrouter.ts` - OpenRouter chat completion client with typed interfaces
- `lib/agents/memory.ts` - Conversation history CRUD with sliding window
- `lib/agents/billing.ts` - Wallet balance check and atomic debit via RPC

## Decisions Made
- No new npm dependencies added — all modules use existing @supabase/supabase-js and native fetch
- Modules use dependency injection (SupabaseClient parameter) rather than importing createClient directly, enabling caller flexibility and testability

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
- `OPENROUTER_API_KEY` environment variable required from OpenRouter dashboard
- `NEXT_PUBLIC_APP_URL` should already exist in the project environment

## Next Phase Readiness
- All data layer modules ready for pipeline orchestrator (Plan 02-03) to wire together
- Each module has clean typed exports consumable by the pipeline
- No blockers for subsequent plans

## Self-Check: PASSED

All 5 created files verified on disk. Both task commits (5240dfd, ced3e3c) verified in git log.

---
*Phase: 02-text-pipeline*
*Completed: 2026-03-20*
