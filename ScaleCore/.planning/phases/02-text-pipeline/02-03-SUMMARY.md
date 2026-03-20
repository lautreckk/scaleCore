---
phase: 02-text-pipeline
plan: 03
subsystem: api, messaging
tags: [pipeline, orchestrator, webhook, whatsapp, openrouter, buffer, memory, billing, splitter]

# Dependency graph
requires:
  - phase: 02-text-pipeline/02-01
    provides: "OpenRouter client, conversation memory, billing module"
  - phase: 02-text-pipeline/02-02
    provides: "Redis message buffer, response splitter with typing indicators"
provides:
  - "Pipeline orchestrator (processAgentMessage) wiring all agent modules end-to-end"
  - "Webhook integration for AI agent processing (fire-and-forget)"
  - "Tag gate filtering, #limpar command, buffer scheduling, billing check, LLM call, response delivery"
affects: [03-handoff, 04-media]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fire-and-forget async processing from webhook handler", "Serverless-compatible pipeline (no setTimeout, uses Vercel waitUntil pattern)", "Agent lookup via Supabase join query with tag gate filtering"]

key-files:
  created:
    - lib/agents/pipeline.ts
  modified:
    - app/api/webhooks/evolution/route.ts

key-decisions:
  - "Pipeline made serverless-compatible (removed setTimeout in favor of pattern that works with Vercel/EasyPanel)"
  - "AI responses recorded in messages table for frontend display consistency"

patterns-established:
  - "processAgentMessage as single entry point for all AI agent processing"
  - "Fire-and-forget call with .catch() from webhook handler"
  - "Tag gate pattern: query ai_agent_instances join ai_agents, filter by activation_tag in chat.tags"

requirements-completed: [PIPE-01, PIPE-03, PIPE-04, PIPE-06, MEM-03]

# Metrics
duration: ~15min
completed: 2026-03-20
---

# Phase 02 Plan 03: Pipeline Orchestrator Summary

**Pipeline orchestrator wiring buffer, memory, billing, LLM, and splitter modules into webhook-triggered WhatsApp AI agent responses**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4

## Accomplishments
- Created pipeline orchestrator (processAgentMessage) that wires all 5 agent modules into a single flow
- Integrated pipeline into existing webhook handler as fire-and-forget processing
- End-to-end WhatsApp verification passed: AI responds with split messages, buffer groups rapid messages, tag gate filters correctly, wallet debited, #limpar clears history
- Fixed serverless compatibility (removed setTimeout for Vercel/EasyPanel)
- Added AI response recording to messages table for frontend display

## Task Commits

Each task was committed atomically:

1. **Task 1: Pipeline orchestrator module** - `578abda` (feat)
2. **Task 2: Integrate pipeline into webhook handler** - `23f32d2` (feat)
3. **Task 3: End-to-end verification via WhatsApp** - human-verify checkpoint (approved)

Additional fix commits during execution:
- `403e501` - fix: make AI pipeline serverless-compatible
- `7d53c3d` - fix: record AI responses in messages table for frontend display

## Files Created/Modified
- `lib/agents/pipeline.ts` - Pipeline orchestrator: agent lookup, tag gate, #limpar, buffer, billing, memory, LLM, splitter
- `app/api/webhooks/evolution/route.ts` - Extended webhook with fire-and-forget AI agent processing branch

## Decisions Made
- Pipeline made serverless-compatible by removing setTimeout in favor of patterns that work with Vercel/EasyPanel serverless environments
- AI responses are recorded in the messages table so they appear in the frontend chat view

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made AI pipeline serverless-compatible**
- **Found during:** Task 2 (webhook integration)
- **Issue:** Original pipeline used setTimeout for 10s buffer delay, which does not work reliably in serverless environments
- **Fix:** Refactored to serverless-compatible pattern
- **Files modified:** lib/agents/pipeline.ts
- **Committed in:** `403e501`

**2. [Rule 2 - Missing Critical] Record AI responses in messages table**
- **Found during:** Task 2 (webhook integration)
- **Issue:** AI responses were sent via WhatsApp but not recorded in the messages table, making them invisible in the frontend chat view
- **Fix:** Added message recording to ensure AI responses appear in frontend
- **Files modified:** lib/agents/pipeline.ts
- **Committed in:** `7d53c3d`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes essential for production correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - environment variables (OPENROUTER_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) were configured in Plan 01 and 02.

## Next Phase Readiness
- Complete text pipeline operational end-to-end
- Phase 2 fully complete (all 4 plans done)
- Ready for Phase 3 (Human Handoff) and Phase 4 (Media) which both depend only on Phase 2
- No blockers or concerns

## Self-Check: PASSED

- Commits: 578abda, 23f32d2, 403e501, 7d53c3d all verified in git log
- Files: lib/agents/pipeline.ts and app/api/webhooks/evolution/route.ts exist in HEAD (git show confirms)

---
*Phase: 02-text-pipeline*
*Completed: 2026-03-20*
