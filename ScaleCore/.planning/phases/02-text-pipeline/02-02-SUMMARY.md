---
phase: 02-text-pipeline
plan: 02
subsystem: api, messaging
tags: [upstash, redis, whatsapp, evolution-api, buffer, splitter, typing-indicator]

# Dependency graph
requires:
  - phase: 01-agent-foundation
    provides: "CURATED_MODELS, agent schema, Evolution API client"
provides:
  - "Redis message buffer with 10s grouping window (addToBuffer, drainBuffer)"
  - "Response splitter with natural typing delay (splitResponse, sendSplitResponse)"
  - "@upstash/redis npm dependency"
affects: [02-03-pipeline-orchestrator]

# Tech tracking
tech-stack:
  added: ["@upstash/redis@1.37.0"]
  patterns: ["Redis RPUSH+TTL for serverless message buffering", "SETNX atomic lock for concurrent processing prevention", "Pipeline atomic drain (LRANGE+DEL)", "Paragraph-first response splitting with sentence fallback", "Typing indicator simulation with character-based delay"]

key-files:
  created:
    - lib/agents/buffer.ts
    - lib/agents/splitter.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Used EvolutionApiClient interface type import (not class instantiation) matching existing factory pattern"
  - "15s TTL on buffer keys (10s window + 5s safety margin) prevents orphan keys"
  - "SETNX lock with 30s auto-expire prevents duplicate processing across serverless pods"

patterns-established:
  - "Buffer key naming: agent-buf:{instanceId}:{remoteJid}"
  - "Lock key naming: agent-lock:{instanceId}:{remoteJid}"
  - "Response splitting: paragraphs first, sentences if single paragraph"

requirements-completed: [PIPE-02, PIPE-05, PIPE-06]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 02 Plan 02: Buffer & Splitter Summary

**Upstash Redis message buffer with 10s grouping and response splitter with typing indicators via Evolution API**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T12:11:37Z
- **Completed:** 2026-03-20T12:15:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed @upstash/redis and created buffer module with addToBuffer (RPUSH + TTL + length check) and drainBuffer (SETNX lock + pipeline LRANGE+DEL)
- Created response splitter with paragraph-first splitting, typing indicators, and natural character-based delay capped at 3 seconds
- Both modules export clean typed functions ready for pipeline.ts orchestrator consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @upstash/redis and create buffer module** - `f143fb6` (feat)
2. **Task 2: Response splitter with natural delay and typing indicators** - `43aab2a` (feat)

**Plan metadata:** `6cd4701` (docs: complete plan)

## Files Created/Modified
- `lib/agents/buffer.ts` - Redis buffer with addToBuffer (RPUSH+TTL) and drainBuffer (SETNX lock + pipeline drain)
- `lib/agents/splitter.ts` - Response splitting and natural-delay message sending via Evolution API
- `package.json` - Added @upstash/redis dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- Used `EvolutionApiClient` interface type import instead of class instantiation, matching the existing factory pattern (`createEvolutionClient()`)
- Buffer TTL set to 15s (10s window + 5s safety margin) to prevent orphan keys in Redis
- SETNX lock with 30s auto-expire prevents duplicate processing across concurrent serverless invocations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected EvolutionApiClient import pattern**
- **Found during:** Task 2 (splitter.ts creation)
- **Issue:** Plan specified `import { EvolutionApiClient } from "@/lib/evolution/client"` as a class, but the actual codebase uses an interface + factory function pattern
- **Fix:** Used `import type { EvolutionApiClient }` for type-only import, keeping the parameter typed as the interface
- **Files modified:** lib/agents/splitter.ts
- **Verification:** Import resolves correctly, types match sendText/sendPresence signatures
- **Committed in:** 43aab2a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary correction to match actual codebase patterns. No scope creep.

## Issues Encountered
None

## User Setup Required

**External services require manual configuration.** Upstash Redis is needed for the message buffer:
- `UPSTASH_REDIS_REST_URL` - from Upstash Console -> Create Redis Database -> REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - from Upstash Console -> Create Redis Database -> REST API Token

## Next Phase Readiness
- Buffer and splitter modules ready for pipeline orchestrator (Plan 03)
- Pipeline.ts will import addToBuffer/drainBuffer from buffer.ts and sendSplitResponse from splitter.ts
- Upstash Redis credentials must be configured in .env before runtime testing

---
*Phase: 02-text-pipeline*
*Completed: 2026-03-20*
