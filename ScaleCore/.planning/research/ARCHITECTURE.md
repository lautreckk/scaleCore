# Architecture Research

**Domain:** AI WhatsApp Agent Platform (integrated into existing CRM)
**Researched:** 2026-03-19
**Confidence:** HIGH

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         WhatsApp Message Flow                           │
│                                                                         │
│  Evolution API ──webhook──> /api/webhooks/evolution/route.ts            │
│                                   │                                     │
│                          ┌────────┴────────┐                            │
│                          │ Message Router   │                            │
│                          │ (existing handler│                            │
│                          │  + new AI check) │                            │
│                          └───┬─────────┬───┘                            │
│                              │         │                                │
│                    ┌─────────┘         └──────────┐                     │
│                    ▼                              ▼                     │
│           Save to DB                     AI Agent Pipeline              │
│           (existing)                     (NEW - all below)              │
│                                               │                        │
├───────────────────────────────────────────────┼────────────────────────┤
│                     AI Agent Pipeline         │                        │
│                                               ▼                        │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐               │
│  │ Tag Gate     │───>│ Media        │───>│ Message     │               │
│  │ (should AI   │    │ Processor    │    │ Buffer      │               │
│  │  respond?)   │    │ (vision,     │    │ (Upstash    │               │
│  └─────────────┘    │  whisper,    │    │  Redis,     │               │
│                      │  PDF parse)  │    │  10s window)│               │
│                      └──────────────┘    └──────┬──────┘               │
│                                                  │                     │
│                                                  ▼                     │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐              │
│  │ Conversation │◄───│ LLM Router   │◄───│ Prompt       │              │
│  │ Memory       │    │ (OpenRouter)  │    │ Assembler    │              │
│  │ (Supabase)   │    └──────┬───────┘    │ (system +    │              │
│  └──────────────┘           │            │  media refs + │              │
│                              │            │  history)    │              │
│                              ▼            └─────────────┘              │
│                      ┌──────────────┐                                  │
│                      │ Response     │                                  │
│                      │ Dispatcher   │                                  │
│                      │ (split, delay│                                  │
│                      │  media detect│                                  │
│                      │  send via    │                                  │
│                      │  Evolution)  │                                  │
│                      └──────┬───────┘                                  │
│                              │                                         │
│                              ▼                                         │
│                      ┌──────────────┐                                  │
│                      │ Wallet       │                                  │
│                      │ (debit       │                                  │
│                      │  credits)    │                                  │
│                      └──────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Webhook Handler (existing)** | Receives Evolution API events, creates/updates chats and messages in Supabase | `app/api/webhooks/evolution/route.ts` -- extend, not replace |
| **Tag Gate** | Checks if incoming message's chat has the agent's activation tag; skips AI if not tagged or if human attendant has taken over | New function called from webhook handler after message save |
| **Media Processor** | Converts incoming media to text: images via vision model, audio via Whisper-compatible API, PDFs via text extraction | New module `lib/agents/media-processor.ts` |
| **Message Buffer** | Aggregates rapid-fire messages (10s window) using Redis LPUSH + TTL, deduplicates via compare-after-wait | New module `lib/agents/message-buffer.ts` using `@upstash/redis` |
| **Prompt Assembler** | Builds the full LLM prompt: system prompt from agent config + media asset list + buffered user messages + conversation history | New module `lib/agents/prompt-assembler.ts` |
| **Conversation Memory** | Stores and retrieves conversation history per phone number, capped at N messages (50 in current n8n) | Supabase table `agent_conversation_memory` |
| **LLM Router** | Sends assembled prompt to OpenRouter, handles model selection, streaming, error handling, retries | New module `lib/agents/llm-router.ts` |
| **Response Dispatcher** | Splits LLM response into sentences, detects media URLs, sends sequentially with delays via Evolution API | New module `lib/agents/response-dispatcher.ts` |
| **Wallet Integration** | Debits credits from tenant wallet per AI message processed | Calls existing wallet system after successful AI response |
| **Agent CRUD** | UI and API for creating/editing agents: name, prompt, model, linked instances, activation tag, uploaded media | New API routes `app/api/agents/` + UI components |

## Recommended Project Structure

```
lib/
├── agents/                    # AI agent core (NEW)
│   ├── index.ts               # Main pipeline orchestrator
│   ├── tag-gate.ts            # Tag-based activation check
│   ├── media-processor.ts     # Vision, Whisper, PDF extraction
│   ├── message-buffer.ts      # Upstash Redis buffer (10s window)
│   ├── prompt-assembler.ts    # Builds full LLM prompt
│   ├── llm-router.ts         # OpenRouter API client
│   ├── response-dispatcher.ts # Split, delay, send responses
│   ├── conversation-memory.ts # Supabase conversation history
│   ├── wallet.ts              # Credit debit per AI message
│   ├── models.ts              # Curated model list with prices
│   └── types.ts               # Shared types for agent system
├── evolution/                 # Existing Evolution API client
│   ├── client.ts
│   └── config.ts
├── warming/                   # Existing warming module
└── ...

app/
├── api/
│   ├── agents/                # Agent CRUD (NEW)
│   │   ├── route.ts           # GET (list), POST (create)
│   │   ├── [id]/
│   │   │   ├── route.ts       # GET, PUT, DELETE single agent
│   │   │   ├── instances/
│   │   │   │   └── route.ts   # Link/unlink instances
│   │   │   └── media/
│   │   │       └── route.ts   # Upload/manage agent media
│   │   └── models/
│   │       └── route.ts       # GET curated model list
│   └── webhooks/
│       └── evolution/
│           └── route.ts       # EXTEND existing handler
└── (dashboard)/
    └── agents/                # Agent management UI (NEW)
        ├── page.tsx           # List agents
        ├── [id]/
        │   └── page.tsx       # Edit agent
        └── new/
            └── page.tsx       # Create agent
```

### Structure Rationale

- **`lib/agents/`:** All agent logic lives in one directory because the pipeline is sequential and tightly coupled internally. Each file is a single-responsibility component that the orchestrator (`index.ts`) calls in order. This keeps the webhook handler thin -- it just calls `processAgentMessage()`.
- **Separate files per pipeline stage:** The media processor, buffer, prompt assembler, LLM router, and response dispatcher are distinct concerns with different dependencies. Splitting them makes testing each stage independently straightforward.
- **Extending `webhooks/evolution/route.ts`:** The existing webhook handler already does message parsing, chat creation, and media upload. The AI pipeline hooks in AFTER the message is saved to the database, not before. This means the webhook handler needs roughly 10-15 lines added to call the agent pipeline, not a rewrite.

## Architectural Patterns

### Pattern 1: Post-Save Hook (Webhook Extension)

**What:** After the existing webhook handler saves the incoming message to the database, it fires the AI agent pipeline as a background task. The webhook returns 200 immediately; AI processing happens asynchronously.

**When to use:** Always -- the Evolution API expects fast webhook responses. AI processing takes 2-15 seconds and must not block the webhook.

**Trade-offs:** The webhook responds fast (good), but errors in AI processing are harder to surface to the user (acceptable -- log and retry).

**Example:**
```typescript
// In webhooks/evolution/route.ts, after message is saved:

// Return 200 immediately, process AI in background
const response = NextResponse.json({ success: true });

// Fire-and-forget AI processing (don't await)
processAgentMessage({
  chatId: chat.id,
  messageContent: content,
  messageType,
  mediaUrl,
  remoteJid,
  instanceId: instance.id,
  tenantId,
  instanceName,
  evolutionConfigId: instance.evolution_config_id,
}).catch(err => console.error('[AI Agent] Pipeline error:', err));

return response;
```

**Important caveat:** Next.js API routes on Node.js runtime (not Edge) keep the process alive after response is sent, so fire-and-forget works. Verify this behavior in EasyPanel deployment. If the process terminates early, use `waitUntil()` or move to a separate endpoint that the webhook calls.

### Pattern 2: Redis Message Buffer with Compare-After-Wait

**What:** When a message arrives, push it to a Redis list keyed by phone number. Wait 10 seconds. After waiting, read the list again. If the list matches what you pushed (no new messages arrived), consume all messages and proceed. If new messages arrived, abort -- the newer invocation will handle them.

**When to use:** Always for the message buffer. This is the proven pattern from the n8n implementation.

**Trade-offs:** Adds 10s latency to every AI response (intentional -- groups messages). Risk of race conditions if two invocations both read at the same moment (mitigated by Redis atomic operations).

**Example:**
```typescript
// lib/agents/message-buffer.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function bufferMessage(
  phoneKey: string,
  message: string
): Promise<string[] | null> {
  const listKey = `agent:buffer:${phoneKey}`;

  // Push message to list
  await redis.lpush(listKey, message);
  await redis.expire(listKey, 60); // TTL safety net

  // Snapshot current count
  const countBefore = await redis.llen(listKey);

  // Wait 10 seconds
  await new Promise(resolve => setTimeout(resolve, 10_000));

  // Check if new messages arrived
  const countAfter = await redis.llen(listKey);

  if (countAfter !== countBefore) {
    // New messages arrived, let the newer invocation handle it
    return null;
  }

  // Consume all messages (oldest first)
  const messages = await redis.lrange<string>(listKey, 0, -1);
  await redis.del(listKey);

  return messages.reverse(); // Redis LPUSH stores newest first
}
```

### Pattern 3: Prompt Assembly with Media Asset Injection

**What:** The system prompt includes a list of uploaded media assets (images, videos, documents) with descriptions. The LLM decides when to reference them. Media URLs are injected into the system prompt, and the response dispatcher detects them in the output.

**When to use:** When agents have uploaded media they can send to leads.

**Trade-offs:** The LLM must be reliable at outputting exact URLs -- this works well with GPT-4o and Claude but may be less reliable with smaller models. Provide clear instructions in the system prompt about the expected format.

**Example:**
```typescript
// In prompt assembler
function buildSystemPrompt(agent: Agent, mediaAssets: MediaAsset[]): string {
  let prompt = agent.system_prompt;

  if (mediaAssets.length > 0) {
    prompt += '\n\n## Available Media\n';
    prompt += 'You can send media to the lead by including the URL on its own line.\n';
    prompt += 'Only send media when contextually relevant.\n\n';

    for (const asset of mediaAssets) {
      prompt += `- ${asset.description}: ${asset.url}\n`;
    }
  }

  return prompt;
}
```

### Pattern 4: Human Takeover via Tag Removal

**What:** Each agent is configured with an activation tag (e.g., "IA-Vendas"). The AI only responds to chats that have this tag. When a human attendant sends a message in the chat, the system automatically removes the tag, disabling the AI. To re-enable, the attendant adds the tag back.

**When to use:** Always -- this is the core control mechanism.

**Trade-offs:** Simple and battle-tested (from n8n implementation). The only risk is if tags are accidentally removed -- but that is an existing problem in the tag system, not new.

## Data Flow

### Incoming Message Flow (Happy Path)

```
Evolution API webhook
    |
    v
POST /api/webhooks/evolution
    |
    v
Parse message type (text/image/audio/video/document)
    |
    v
Save message to Supabase (existing logic, unchanged)
    |
    v
[NEW] Check: is there an agent linked to this instance?
    |-- NO --> return (normal chat, no AI)
    |
    v
[NEW] Check: does this chat have the agent's activation tag?
    |-- NO --> return (AI not active for this lead)
    |
    v
[NEW] Check: is message fromMe?
    |-- YES --> Human attendant sent message
    |           Remove activation tag from chat
    |           return (AI deactivated)
    |
    v
[NEW] Process media if applicable:
    |-- Image --> Send to vision model, get text description
    |-- Audio --> Send to Whisper, get transcription
    |-- PDF   --> Extract text content
    |-- Video --> Extract key frames (optional, v2)
    |
    v
[NEW] Push processed text to Redis buffer (keyed by phone)
    |
    v
[NEW] Wait 10 seconds
    |
    v
[NEW] Compare buffer: more messages arrived?
    |-- YES --> abort (newer invocation handles it)
    |
    v
[NEW] Consume all buffered messages, join into single text
    |
    v
[NEW] Assemble prompt:
    System prompt (from agent config)
    + Media asset list (uploaded by user)
    + Conversation history (last 50 messages from Supabase)
    + Buffered user messages
    |
    v
[NEW] Call OpenRouter API with selected model
    |
    v
[NEW] Save AI response to conversation memory (Supabase)
    |
    v
[NEW] Debit wallet credits
    |
    v
[NEW] Split response into sentences
    |
    v
[NEW] For each sentence:
    |-- Detect media URL? --> Send via Evolution sendMedia
    |-- Plain text?       --> Send via Evolution sendText
    |-- Wait 1-3 seconds between sends
    |
    v
[NEW] Save AI messages to messages table (as fromMe messages)
    |
    DONE
```

### Agent Configuration Flow

```
User creates agent (UI)
    |
    v
POST /api/agents
    |
    v
Save to Supabase: agents table
    (name, system_prompt, model_id, activation_tag, tenant_id)
    |
    v
User links agent to WhatsApp instance(s)
    |
    v
POST /api/agents/[id]/instances
    |
    v
Save to Supabase: agent_instances junction table
    |
    v
User uploads media assets
    |
    v
POST /api/agents/[id]/media
    |
    v
Upload to Supabase Storage, save reference to agent_media table
    |
    DONE (agent is now active for linked instances)
```

### Key Data Flows

1. **Webhook to AI pipeline:** Existing handler saves message, then fires agent pipeline asynchronously. The pipeline runs entirely in the same Next.js process (no external workers needed for v1).
2. **Buffer accumulation:** Multiple rapid messages from the same phone number are accumulated in Redis. Only the last invocation (after 10s of silence) processes all messages as one batch.
3. **AI to WhatsApp:** Response goes through Response Dispatcher, which breaks it into human-like message chunks and sends each via Evolution API with realistic delays.

## Database Schema (New Tables)

```sql
-- Agent definitions
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model_id TEXT NOT NULL,  -- OpenRouter model ID e.g. "openai/gpt-4o"
  activation_tag TEXT NOT NULL,  -- Tag name that activates this agent
  is_active BOOLEAN DEFAULT true,
  max_history_messages INT DEFAULT 50,
  buffer_window_seconds INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent-to-instance linking (many-to-many)
CREATE TABLE agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(agent_id, instance_id)
);

-- Media assets uploaded for agent use
CREATE TABLE agent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- image, video, document
  description TEXT,  -- Human description for LLM context
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation memory (separate from messages table)
CREATE TABLE agent_conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  phone_key TEXT NOT NULL,  -- remoteJid as key
  role TEXT NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_agent_memory_lookup
  ON agent_conversation_memory(agent_id, phone_key, created_at DESC);

-- All tables get RLS policies for tenant_id isolation
```

**Why separate conversation memory from the messages table?** The existing `messages` table stores raw WhatsApp messages with all metadata (media URLs, message IDs, etc.). The conversation memory table stores simplified role/content pairs optimized for LLM context windows. Keeping them separate avoids query complexity and allows different retention policies.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 agents, ~5K msgs/day | Current design works fine. All processing in Next.js API route. Single Upstash Redis instance (free tier: 10K commands/day covers this). |
| 500-2K agents, ~50K msgs/day | Upstash Redis needs paid plan. Consider conversation memory pruning (auto-delete messages older than 30 days). Monitor Next.js process memory under concurrent AI calls. |
| 2K+ agents, ~200K+ msgs/day | Move AI pipeline to dedicated worker (separate Next.js process or Modal). Webhook handler enqueues jobs; worker processes them. This decouples webhook response time from AI processing completely. |

### Scaling Priorities

1. **First bottleneck: OpenRouter API rate limits and latency.** Each AI response takes 2-10 seconds on OpenRouter. With many concurrent conversations, you hit API rate limits. Mitigation: OpenRouter handles this well with their provider routing, but monitor 429 responses and implement exponential backoff.
2. **Second bottleneck: Next.js process memory.** Each buffered message holds a 10-second `setTimeout`. With 100 concurrent conversations, that is 100 concurrent timers plus their closures. Not a problem until ~500+ concurrent conversations, at which point consider a queue-based approach.
3. **Third bottleneck: Conversation memory table growth.** At 50 messages per conversation and thousands of conversations, this table grows fast. Add a cleanup job or cap per-conversation memory with automatic pruning.

## Anti-Patterns

### Anti-Pattern 1: Processing AI Before Saving the Message

**What people do:** Intercept the webhook, run AI processing, then save both the incoming and AI messages together.
**Why it is wrong:** If AI processing fails (timeout, API error), the incoming message is lost. The user sees their message was never recorded.
**Do this instead:** Save the incoming message first (existing behavior), then trigger AI processing. If AI fails, the message is still in the database. Retry AI separately.

### Anti-Pattern 2: Blocking the Webhook Response

**What people do:** `await processAI()` inside the webhook handler before returning 200.
**Why it is wrong:** Evolution API has webhook timeout limits. AI processing takes 2-15 seconds. Webhook times out, Evolution retries, you process the same message twice.
**Do this instead:** Return 200 immediately, process AI in background. Use message deduplication (check if AI already responded to this message ID) as a safety net.

### Anti-Pattern 3: Using the Messages Table as Conversation Memory

**What people do:** Query the `messages` table to build LLM context, joining with chats and filtering by type.
**Why it is wrong:** The messages table has complex schema (media URLs, metadata, delivery status). Querying it for LLM context is slow, complex, and brittle. Media messages need different handling than text.
**Do this instead:** Maintain a separate `agent_conversation_memory` table with simple role/content pairs. Write to it when processing messages. Query it with a simple `ORDER BY created_at DESC LIMIT 50`.

### Anti-Pattern 4: One Agent Per Instance (Rigid)

**What people do:** Hardcode one agent per WhatsApp instance with no way to change.
**Why it is wrong:** Users may want to switch agents, or temporarily disable AI without removing the instance.
**Do this instead:** Use the junction table (`agent_instances`) with `is_active` flag. One instance can be linked to one active agent at a time (enforced in application logic, not DB constraint, because the same instance should be linkable to different agents over time).

### Anti-Pattern 5: Storing API Keys Per Agent

**What people do:** Let each agent have its own OpenRouter API key.
**Why it is wrong:** Per PROJECT.md, the system uses centralized wallet billing. Per-agent API keys break this model and create security/management overhead.
**Do this instead:** Single OpenRouter API key managed by the platform. All agents route through it. Bill tenants via wallet credits per message processed.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Evolution API** | REST client (`lib/evolution/client.ts`) | Already exists. Use for sending responses. No changes needed to the client. |
| **OpenRouter** | REST API (OpenAI-compatible) | New integration. Single POST to `https://openrouter.ai/api/v1/chat/completions`. Use `@upstash/redis` for caching if needed. |
| **Upstash Redis** | HTTP-based client (`@upstash/redis`) | New integration. Serverless, no connection management. Use for message buffer only. |
| **Supabase** | Existing service-role client | Extend with new tables. Use existing RLS patterns for tenant isolation. |
| **Whisper API** | Via OpenRouter or direct OpenAI | For audio transcription. Can route through OpenRouter if model is available, otherwise direct OpenAI call. |
| **Vision model** | Via OpenRouter | Send image as base64 in message content. GPT-4o and Claude support vision natively through OpenRouter. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Webhook handler -> Agent pipeline | Direct function call (fire-and-forget) | No queue needed for v1. The webhook handler calls `processAgentMessage()` without awaiting. |
| Agent pipeline -> Evolution API | Via existing `lib/evolution/client.ts` | Response dispatcher uses `sendText()` and `sendMedia()` methods already in the client. |
| Agent pipeline -> Supabase | Via existing service-role client | Memory reads/writes, agent config lookups, wallet debits. |
| Agent pipeline -> Upstash Redis | Via `@upstash/redis` HTTP client | Buffer operations only. No persistent state in Redis beyond the 60s TTL. |
| Agent CRUD API -> Supabase | Standard API route pattern | Same pattern as existing CRUD routes (kanban, warming, etc.) |

## Build Order (Dependencies)

Build order matters because each layer depends on the one before it.

| Phase | What to Build | Depends On | Rationale |
|-------|---------------|------------|-----------|
| **1** | Database schema + Agent CRUD API + basic UI | Nothing (greenfield) | Foundation. Cannot test anything without agents in the database. |
| **2** | Tag Gate + webhook handler extension | Phase 1 (agents exist in DB) | The "should AI respond?" check. Without this, the pipeline has no entry point. |
| **3** | Message Buffer (Upstash Redis) | Phase 2 (messages reach the pipeline) | Core debounce mechanism. Must work before LLM calls to avoid duplicate AI responses. |
| **4** | LLM Router (OpenRouter integration) + Prompt Assembler | Phase 3 (buffered messages ready) | The actual AI brain. Simple text-in, text-out first. No media, no memory. |
| **5** | Response Dispatcher (split + send via Evolution) | Phase 4 (AI generates responses) | Makes AI responses feel human. Without this, AI sends one giant message. |
| **6** | Conversation Memory | Phase 4 (LLM calls work) | Adds context to conversations. Without it, every message is a fresh conversation. |
| **7** | Media Processor (vision, whisper, PDF) | Phase 4 (LLM pipeline works) | Handles non-text input. Additive -- text-only AI works without this. |
| **8** | Agent Media Assets (upload + LLM injection) | Phase 5 + Phase 1 (CRUD + dispatcher) | Lets AI send images/videos. Requires both prompt injection and media-aware dispatching. |
| **9** | Wallet Integration | Phase 4 (LLM calls billable) | Billing. Can be added late because it is a simple debit call after processing. |
| **10** | Human Takeover (auto-remove tag on attendant reply) | Phase 2 (tag gate works) | Polish. The tag gate already checks; this adds automatic deactivation. |

**Why this order:** Phases 1-5 produce a working text-only AI agent. Phases 6-8 add richness (memory, media). Phases 9-10 add operational concerns (billing, handoff). Each phase is independently testable and delivers incremental value.

## Sources

- [Redis AI Agent Architecture](https://redis.io/blog/ai-agent-architecture/) -- patterns for agent state management
- [OpenRouter Provider Routing Documentation](https://openrouter.ai/docs/guides/routing/provider-selection) -- multi-provider request routing
- [OpenRouter Practical Guide](https://medium.com/@milesk_33/a-practical-guide-to-openrouter-unified-llm-apis-model-routing-and-real-world-use-d3c4c07ed170) -- real-world OpenRouter usage patterns
- [Upstash Redis for Next.js](https://upstash.com/docs/redis/tutorials/nextjs_with_redis) -- serverless Redis in Next.js API routes
- [WhatsApp AI Agent with LangGraph](https://github.com/lucasboscatti/Whatsapp-Langgraph-Agent-Integration) -- reference architecture for WhatsApp AI agents
- Existing codebase: `app/api/webhooks/evolution/route.ts` (1093 lines), `lib/evolution/client.ts`, `lib/warming/ai-service.ts`
- Existing n8n workflow: `ScaleCore/Agente IA max.json` (2524 lines) -- the current production agent being replaced

---
*Architecture research for: AI WhatsApp Agent Platform*
*Researched: 2026-03-19*
