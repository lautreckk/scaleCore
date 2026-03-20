# Phase 2: Text Pipeline - Research

**Researched:** 2026-03-20
**Domain:** WhatsApp AI agent text pipeline with message buffering, LLM integration, conversation memory, and billing
**Confidence:** HIGH

## Summary

This phase implements the core AI agent pipeline: receiving WhatsApp text messages via the existing Evolution API webhook, buffering rapid messages with Upstash Redis, routing to the correct agent by tag matching, generating responses via OpenRouter LLM API, splitting responses into natural-feeling separate messages, persisting conversation memory in Supabase, and debiting credits from the existing wallet system.

The existing codebase provides strong foundations: the webhook handler at `app/api/webhooks/evolution/route.ts` already processes MESSAGES_UPSERT events, extracts text content, manages chats and messages in Supabase, and handles instance lookup. The `chats.tags` column (string array) already stores tags including the agent's activation tag. The Evolution API client already has `sendText()`, `sendPresence()` (typing indicator), and all needed interfaces. The wallet system (`wallets` table + `deduct_wallet_balance` RPC) and credit model (`CURATED_MODELS` with `creditsPerMessage`) are both in place.

The primary technical challenge is the 10-second message buffer using Upstash Redis in a serverless environment, where each webhook invocation is stateless. The pattern from the n8n reference (push message -> wait 10s -> check if more arrived -> concatenate) translates well to Redis LPUSH + TTL + a delayed check mechanism.

**Primary recommendation:** Extend the existing webhook handler with an AI agent processing branch. Use `@upstash/redis` for the 10s buffer, direct `fetch()` to OpenRouter API (no SDK needed -- simpler, fewer dependencies), a new `ai_conversation_messages` Supabase table for persistent memory, and the existing `deduct_wallet_balance` RPC for billing.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | Webhook recebe mensagem de texto e roteia para o agente vinculado a instancia | Extend MESSAGES_UPSERT handler: query `ai_agent_instances` by `instance_id` to find agent, then check tag match |
| PIPE-02 | Buffer agrupa mensagens do mesmo lead em janela de 10s (Upstash Redis) | `@upstash/redis` LPUSH + EXPIRE(10s) + setTimeout/re-invocation pattern to collect messages |
| PIPE-03 | Agente ignora mensagens de leads que nao possuem a tag de ativacao | Check `chats.tags` array contains agent's `activation_tag` before processing |
| PIPE-04 | Agente ignora mensagens enviadas pelo proprio atendente (fromMe) | Skip AI processing when `messageData.key.fromMe === true` |
| PIPE-05 | Resposta da IA dividida em frases e enviada em mensagens separadas com delay natural | Split response by sentence boundaries, send each via `client.sendText()` with configurable delay |
| PIPE-06 | Typing indicator exibido enquanto IA processa | Use `client.sendPresence()` with `presence: "composing"` before and between messages |
| MEM-01 | Historico de conversa persistido por lead/telefone com sliding window de 50 mensagens | New `ai_conversation_messages` table keyed by `remote_jid` + `instance_id`, sliding window query |
| MEM-02 | Memoria foca nas mensagens mais recentes para evitar alucinacao | SELECT last 50 ordered by timestamp DESC, reverse for chronological order in prompt |
| MEM-03 | Usuario pode limpar historico via comando (#limpar) | Detect `#limpar` in message content, DELETE from conversation memory, send confirmation |
| BILL-01 | Creditos debitados do wallet por mensagem processada | Call existing `deduct_wallet_balance` RPC with `creditsPerMessage` from agent's model |
| BILL-02 | Custo por mensagem varia conforme modelo selecionado | Use `CURATED_MODELS.find(m => m.id === agent.model_id).creditsPerMessage` |
| BILL-03 | Agente para de responder se wallet insuficiente | Check wallet balance >= creditsPerMessage before processing, skip with log if insufficient |
</phase_requirements>

## Standard Stack

### Core (New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @upstash/redis | 1.37.0 | Serverless Redis for message buffer | HTTP-based, no persistent connections, designed for serverless. Free tier 10K req/day sufficient for development |

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.x | API routes for webhook processing | Already in use, webhook handler exists |
| @supabase/supabase-js | 2.45.x | Database queries, RPC calls | Already in use throughout |
| zod | 3.22.x | Validation | Already in use |

### NOT Using (Decision)
| Library | Reason |
|---------|--------|
| @openrouter/sdk (0.9.11) | Unnecessary abstraction. Direct `fetch()` to `https://openrouter.ai/api/v1/chat/completions` is simpler, has zero dependencies, and the API is just a standard OpenAI-compatible REST endpoint. The SDK is pre-1.0 and adds complexity without meaningful value for our use case. |
| openai SDK | Would work (OpenRouter is OpenAI-compatible) but adds a heavy dependency for a single fetch call |
| langchain | Massive overkill. We need one API call with message history -- no chains, tools, or agents needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @upstash/redis | Supabase table polling | Redis gives atomic LPUSH + TTL; Supabase polling would require complex locking and scheduled cleanup |
| Direct fetch to OpenRouter | @openrouter/sdk | SDK adds dependency for a single REST call; fetch is clearer and more debuggable |
| Supabase table for memory | Redis for memory | Supabase is better -- memory needs persistence across deploys, Redis is ephemeral and would lose history |

**Installation:**
```bash
npm install @upstash/redis
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  agents/
    models.ts         # existing -- CURATED_MODELS
    validation.ts     # existing -- agentFormSchema
    pipeline.ts       # NEW -- orchestrator: buffer -> tag check -> memory -> LLM -> send
    buffer.ts         # NEW -- Upstash Redis buffer logic
    memory.ts         # NEW -- conversation memory CRUD (Supabase)
    openrouter.ts     # NEW -- OpenRouter API client (fetch wrapper)
    billing.ts        # NEW -- wallet check + debit
    splitter.ts       # NEW -- response splitting + natural delay
app/
  api/
    webhooks/
      evolution/
        route.ts      # MODIFY -- add AI agent processing branch in MESSAGES_UPSERT
```

### Pattern 1: Webhook Extension (Not Replacement)
**What:** Add AI agent processing as a new branch inside the existing MESSAGES_UPSERT handler, after the message is saved to the database.
**When to use:** Always -- the existing webhook handler must continue working for non-AI messages.
**Example:**
```typescript
// Inside MESSAGES_UPSERT case, after message is saved to DB:
case "MESSAGES_UPSERT": {
  // ... existing code that saves message to DB ...

  // NEW: AI agent processing (non-blocking)
  if (!fromMe && messageType === "text" && content) {
    processAgentMessage({
      instanceId: instance.id,
      instanceName,
      remoteJid,
      content,
      tenantId,
      evolutionConfigId: instance.evolution_config_id,
      chatId: chat.id,
    }).catch(err => console.error("[AI Agent] Error:", err));
  }
  break;
}
```

### Pattern 2: Redis Buffer with TTL
**What:** Use Redis list + TTL to accumulate messages within a 10-second window before processing.
**When to use:** Every incoming text message that passes tag/fromMe checks.
**Example:**
```typescript
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

const bufferKey = `agent-buffer:${instanceId}:${remoteJid}`;

// Push message to buffer list
await redis.lpush(bufferKey, content);
// Reset TTL to 10 seconds from latest message
await redis.expire(bufferKey, 10);

// Check if this is the first message in the buffer
const listLen = await redis.llen(bufferKey);
if (listLen === 1) {
  // First message -- schedule processing after 10s
  // Option A: setTimeout in the same request (works for Node.js runtime, NOT edge)
  // Option B: Use a separate endpoint triggered after delay
  setTimeout(async () => {
    await processBufferedMessages(instanceId, remoteJid);
  }, 10_000);
}
```

### Pattern 3: Non-Streaming LLM Call
**What:** Use non-streaming OpenRouter API call, then split the response into sentences for natural delivery.
**When to use:** Always -- streaming would require maintaining a connection during delivery, which conflicts with the split-and-delay pattern.
**Example:**
```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL,
  },
  body: JSON.stringify({
    model: agent.model_id,  // e.g. "openai/gpt-4o"
    messages: [
      { role: "system", content: agent.system_prompt },
      ...conversationHistory,  // from memory
      { role: "user", content: bufferedMessage },
    ],
  }),
});

const data = await response.json();
const aiResponse = data.choices[0].message.content;
```

### Pattern 4: Response Splitting with Natural Delay
**What:** Split AI response into sentences/paragraphs and send each as a separate WhatsApp message with typing indicator and random delay.
**When to use:** Every AI response.
**Example:**
```typescript
function splitResponse(text: string): string[] {
  // Split by double newline (paragraphs) first
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length > 1) return paragraphs;

  // If single paragraph, split by sentence-ending punctuation
  // Keep the punctuation with the sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(Boolean);
}

async function sendSplitResponse(
  client: EvolutionApiClient,
  instanceName: string,
  remoteJid: string,
  response: string
) {
  const parts = splitResponse(response);
  const phoneNumber = remoteJid.replace("@s.whatsapp.net", "");

  for (let i = 0; i < parts.length; i++) {
    // Send typing indicator
    await client.sendPresence(instanceName, {
      number: phoneNumber,
      presence: "composing",
      delay: 1000 + Math.random() * 2000, // 1-3s typing
    });

    // Natural delay between messages (simulates typing speed)
    const charDelay = Math.min(parts[i].length * 30, 3000); // ~30ms per char, max 3s
    await new Promise(r => setTimeout(r, charDelay));

    // Send the message part
    await client.sendText(instanceName, {
      number: phoneNumber,
      text: parts[i],
    });

    // Small pause between messages
    if (i < parts.length - 1) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
    }
  }
}
```

### Pattern 5: Conversation Memory with Sliding Window
**What:** Store conversation messages in Supabase, retrieve last 50 for context.
**When to use:** Every AI processing cycle.
**Example:**
```typescript
// Retrieve last 50 messages for context
async function getConversationHistory(
  supabase: SupabaseClient,
  remoteJid: string,
  instanceId: string,
  limit = 50
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data } = await supabase
    .from("ai_conversation_messages")
    .select("role, content")
    .eq("remote_jid", remoteJid)
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Reverse to get chronological order
  return (data || []).reverse();
}

// Save both user message and AI response
async function saveConversationMessages(
  supabase: SupabaseClient,
  remoteJid: string,
  instanceId: string,
  agentId: string,
  userMessage: string,
  aiResponse: string
) {
  await supabase.from("ai_conversation_messages").insert([
    {
      remote_jid: remoteJid,
      instance_id: instanceId,
      agent_id: agentId,
      role: "user",
      content: userMessage,
    },
    {
      remote_jid: remoteJid,
      instance_id: instanceId,
      agent_id: agentId,
      role: "assistant",
      content: aiResponse,
    },
  ]);
}
```

### Anti-Patterns to Avoid
- **Processing AI in the webhook response path:** The webhook must return 200 quickly. AI processing (buffer wait + LLM call + sending) must be fire-and-forget or backgrounded.
- **Using streaming for split-message delivery:** Non-streaming is better because we need the full response to split intelligently. Streaming would send partial sentences.
- **Storing conversation memory in Redis:** Redis is ephemeral. Conversation memory needs persistence across deploys. Use Supabase.
- **Blocking on wallet check failure:** Don't throw errors -- silently skip AI processing and log the insufficient balance. The lead's message is still saved to the chat normally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message buffering in serverless | Custom DB polling with locks | @upstash/redis LPUSH + EXPIRE | Atomic operations, designed for this exact use case, TTL auto-cleanup |
| Wallet balance deduction | Manual UPDATE with race conditions | Existing `deduct_wallet_balance` RPC | Already handles atomicity, transaction logging, balance checks |
| Tag checking | Custom tag matching logic | Postgres array containment `@>` operator | `chats.tags @> ARRAY[activation_tag]` is atomic and indexed |
| Sentence splitting for Portuguese | Complex NLP | Regex-based splitting on `.!?` boundaries | Portuguese sentence structure follows same punctuation rules. NLP would be overkill |

**Key insight:** The existing codebase already solves the hard problems (wallet atomicity, tag management, Evolution API integration). This phase is primarily orchestration -- connecting existing pieces with new LLM and buffer logic.

## Common Pitfalls

### Pitfall 1: Race Condition in Buffer Processing
**What goes wrong:** Two messages arrive within 10s. Both trigger setTimeout. Buffer gets processed twice -- once with partial messages, once with all.
**Why it happens:** Serverless functions don't share state. Two webhook invocations can't coordinate via in-memory state.
**How to avoid:** Use Redis atomic operations. On buffer drain, use `GETDEL` pattern (LRANGE + DEL in a pipeline/transaction). Only the first invocation to successfully drain the buffer processes it.
**Warning signs:** Duplicate AI responses to the same lead.

### Pitfall 2: Webhook Timeout
**What goes wrong:** AI processing takes 10-30 seconds (buffer wait + LLM call). Webhook handler times out, Evolution API retries, causing duplicate processing.
**Why it happens:** Evolution API expects quick webhook responses. Next.js API routes have default timeouts.
**How to avoid:** Return 200 immediately from webhook. Fire-and-forget the AI processing with `processAgentMessage().catch(console.error)`. The processing runs in the background of the same Node.js process.
**Warning signs:** Duplicate messages, 504 errors in logs.

### Pitfall 3: Stale Buffer Key After Processing
**What goes wrong:** Buffer is processed at T+10s, but another message arrives at T+9.5s. The processing drains the buffer but the new message was just pushed, gets lost.
**Why it happens:** LPUSH and LRANGE+DEL are separate operations without proper atomicity.
**How to avoid:** Use Redis pipeline: LRANGE 0 -1 + DEL in a single pipeline. If a new message arrives between pipeline execution, it will start a new buffer cycle.
**Warning signs:** Messages getting "swallowed" -- lead sends but AI doesn't see all messages.

### Pitfall 4: Missing Agent for Instance
**What goes wrong:** Webhook receives message for an instance with no active agent bound. Code tries to access agent properties and throws.
**Why it happens:** Not all instances have agents. The AI pipeline should be optional.
**How to avoid:** Query `ai_agent_instances` for the instance. If no agent found, skip AI processing entirely (existing behavior continues as-is).
**Warning signs:** Null reference errors in logs for non-AI instances.

### Pitfall 5: Token/Context Window Limits
**What goes wrong:** 50 messages of conversation history exceeds model's context window, causing API errors or truncated responses.
**Why it happens:** System prompt + 50 messages + current message can be very long for smaller models.
**How to avoid:** The 50-message window is a reasonable default. For safety, truncate the oldest messages if total estimated tokens exceeds a threshold (rough: 4 chars = 1 token). Most models in the curated list support 128K+ context.
**Warning signs:** OpenRouter 400 errors with "context length exceeded" messages.

### Pitfall 6: Concurrent Buffer Processing Across Multiple Pods
**What goes wrong:** In serverless environments, the `setTimeout` fires in the same process that received the first message. If a second message arrives in a different process (different pod/instance), it may also try to schedule processing.
**How to avoid:** Use Redis SETNX as a processing lock: `SET agent-lock:{instanceId}:{remoteJid} 1 NX EX 30`. Only the process that acquires the lock processes the buffer. The lock auto-expires after 30s as safety.
**Warning signs:** Duplicate or partial responses.

## Code Examples

### Database Migration: ai_conversation_messages
```sql
-- Table: ai_conversation_messages (conversation memory for AI agents)
CREATE TABLE ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_jid TEXT NOT NULL,           -- lead's WhatsApp JID
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient sliding window queries
CREATE INDEX idx_ai_conv_msgs_lookup
  ON ai_conversation_messages(remote_jid, instance_id, created_at DESC);

CREATE INDEX idx_ai_conv_msgs_agent
  ON ai_conversation_messages(agent_id);

-- RLS: service role only (webhook handler uses service role client)
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;

-- No RLS policy needed for service_role (bypasses RLS by default)
-- But add policy for authenticated users who might need to view/clear history
CREATE POLICY "Tenant isolation via agent" ON ai_conversation_messages
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM ai_agents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );
```

### Environment Variables Required
```env
# Upstash Redis (for message buffer)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# OpenRouter (for LLM API)
OPENROUTER_API_KEY=sk-or-v1-xxxx
```

### OpenRouter Chat Completion (Non-Streaming)
```typescript
// lib/agents/openrouter.ts
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  modelId: string,
  messages: ChatMessage[]
): Promise<{ content: string; usage: OpenRouterResponse["usage"] }> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
        "X-OpenRouter-Title": "ScaleCore AI Agents",
      },
      body: JSON.stringify({
        model: modelId,
        messages,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}
```

### Agent Routing: Finding Agent for Instance + Tag Check
```typescript
// Query to find active agent for a given instance
async function findAgentForInstance(
  supabase: SupabaseClient,
  instanceId: string
): Promise<Agent | null> {
  const { data } = await supabase
    .from("ai_agent_instances")
    .select("agent_id, ai_agents(*)")
    .eq("instance_id", instanceId)
    .limit(10);  // Multiple agents can be bound to same instance

  if (!data || data.length === 0) return null;

  // Return only active agents (filter in memory since few per instance)
  const activeAgents = data
    .map(d => d.ai_agents)
    .filter(a => a && a.is_active);

  return activeAgents;  // Caller checks tag match
}

// Check if chat has the agent's activation tag
function chatHasActivationTag(
  chatTags: string[] | null,
  activationTag: string
): boolean {
  return (chatTags || []).includes(activationTag);
}
```

### Wallet Check Before Processing
```typescript
// lib/agents/billing.ts
import { CURATED_MODELS } from "./models";

export async function checkAndDebitWallet(
  supabase: SupabaseClient,
  tenantId: string,
  modelId: string,
  agentId: string
): Promise<{ allowed: boolean; cost: number }> {
  const model = CURATED_MODELS.find(m => m.id === modelId);
  const cost = model?.creditsPerMessage ?? 1;

  // Check balance first
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("tenant_id", tenantId)
    .single();

  if (!wallet || (wallet.balance ?? 0) < cost) {
    console.log(`[Billing] Insufficient balance for tenant ${tenantId}: ${wallet?.balance ?? 0} < ${cost}`);
    return { allowed: false, cost };
  }

  // Debit (atomic via RPC)
  const { data: success } = await supabase.rpc("deduct_wallet_balance", {
    p_tenant_id: tenantId,
    p_amount: cost,
    p_description: `AI Agent: mensagem processada (${model?.name || modelId})`,
  });

  return { allowed: success !== false, cost };
}
```

### Buffer Drain with Lock (Redis)
```typescript
// lib/agents/buffer.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function addToBuffer(
  instanceId: string,
  remoteJid: string,
  content: string
): Promise<{ isFirst: boolean }> {
  const bufferKey = `agent-buf:${instanceId}:${remoteJid}`;

  const pipeline = redis.pipeline();
  pipeline.rpush(bufferKey, content);
  pipeline.expire(bufferKey, 15); // 15s TTL (10s window + 5s safety)
  pipeline.llen(bufferKey);

  const results = await pipeline.exec();
  const listLen = results[2] as number;

  return { isFirst: listLen === 1 };
}

export async function drainBuffer(
  instanceId: string,
  remoteJid: string
): Promise<string | null> {
  const bufferKey = `agent-buf:${instanceId}:${remoteJid}`;
  const lockKey = `agent-lock:${instanceId}:${remoteJid}`;

  // Acquire lock (prevents double-processing)
  const acquired = await redis.set(lockKey, "1", { nx: true, ex: 30 });
  if (!acquired) return null; // Another process is handling this

  try {
    // Drain buffer atomically
    const pipeline = redis.pipeline();
    pipeline.lrange(bufferKey, 0, -1);
    pipeline.del(bufferKey);
    const results = await pipeline.exec();

    const messages = results[0] as string[];
    if (!messages || messages.length === 0) return null;

    // Join buffered messages with newline
    return messages.join("\n");
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| n8n workflow for AI agent | Native Next.js API route pipeline | This phase | Removes n8n dependency, full control, lower latency |
| n8n Redis node for buffer | @upstash/redis HTTP client | This phase | Serverless-compatible, no persistent Redis connection needed |
| n8n Postgres Chat Memory | Supabase table with sliding window | This phase | Same concept, native implementation with RLS |
| n8n AI Agent node | Direct OpenRouter fetch | This phase | Simpler, no abstraction layer, full control over prompts |

**Deprecated/outdated:**
- n8n workflow: Being replaced by this native implementation. The n8n reference JSON (`Agente IA max.json`) documents the existing flow for reference.

## Open Questions

1. **setTimeout in Serverless**
   - What we know: Next.js API routes on Node.js runtime support setTimeout. The buffer pattern needs a 10s delayed check.
   - What's unclear: On EasyPanel with Docker, the Node.js process should stay alive. But if the response has already been sent, does the process get killed?
   - Recommendation: Use setTimeout for the MVP. EasyPanel Docker deployment keeps the Node.js process running (unlike Vercel Edge Functions). If issues arise, fall back to a separate polling endpoint or QStash scheduled callback.

2. **Multiple Agents per Instance**
   - What we know: Multiple agents can bind to the same instance (different activation tags). A chat could have multiple agent tags.
   - What's unclear: Should a single message trigger multiple agents if a chat has multiple agent tags?
   - Recommendation: Process with the FIRST matching active agent only. If a chat has multiple agent tags, pick the first agent found. Document this as a known limitation.

3. **OpenRouter Error Handling**
   - What we know: OpenRouter can return rate limits (429), model unavailable, content policy violations.
   - What's unclear: What retry strategy is appropriate?
   - Recommendation: No retries for MVP. Log the error and skip the response. The lead's message is still saved in chat history. A more sophisticated retry/fallback can be added later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework configured in project |
| Config file | none -- Wave 0 required |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIPE-01 | Webhook routes text to correct agent by instance | integration | Manual test via Evolution API | N/A |
| PIPE-02 | Buffer groups messages in 10s window | unit | Test buffer.ts add/drain functions | Wave 0 |
| PIPE-03 | Ignores leads without activation tag | unit | Test tag check function | Wave 0 |
| PIPE-04 | Ignores fromMe messages | unit | Test skip logic | Wave 0 |
| PIPE-05 | Splits response into sentences with delay | unit | Test splitter.ts | Wave 0 |
| PIPE-06 | Typing indicator sent | integration | Manual test via WhatsApp | N/A |
| MEM-01 | Memory persisted with sliding window | integration | Test memory.ts with Supabase | Wave 0 |
| MEM-02 | Only last 50 messages loaded | unit | Test query limit | Wave 0 |
| MEM-03 | #limpar clears history | integration | Manual test | N/A |
| BILL-01 | Credits deducted per message | integration | Test billing.ts with wallet RPC | Wave 0 |
| BILL-02 | Cost varies by model | unit | Test cost lookup from CURATED_MODELS | Wave 0 |
| BILL-03 | Agent stops if wallet insufficient | unit | Test balance check logic | Wave 0 |

### Sampling Rate
- **Per task commit:** Manual WhatsApp test (send message, verify response)
- **Per wave merge:** Full flow test (buffer + memory + billing)
- **Phase gate:** End-to-end test covering all 5 success criteria

### Wave 0 Gaps
- [ ] No test framework configured in project (no jest, vitest, or playwright)
- [ ] Primary validation for this phase is manual/integration testing via real WhatsApp messages
- [ ] Unit tests for pure functions (splitter, tag check, cost lookup) can be added but require test framework setup first

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct reading of `app/api/webhooks/evolution/route.ts` (~1093 lines), `lib/evolution/client.ts` (~812 lines), `lib/agents/models.ts`, `types/database.ts`, `app/api/whatsapp/send/route.ts`, `app/api/admin/tenants/credits/route.ts`
- **Database types:** `types/database.ts` -- wallets, transactions, chats.tags, messages, ai_agents tables verified
- **RPC functions:** `deduct_wallet_balance` (args: p_amount, p_description, p_tenant_id; returns boolean), `add_wallet_credits` (args: p_amount, p_description, p_reference_id, p_tenant_id; returns boolean) -- verified in `lib/database.types.ts`

### Secondary (MEDIUM confidence)
- **OpenRouter API:** https://openrouter.ai/docs/quickstart -- endpoint, headers, request/response format verified
- **OpenRouter Streaming:** https://openrouter.ai/docs/api/reference/streaming -- SSE format, `[DONE]` marker, delta structure
- **@upstash/redis:** https://www.npmjs.com/package/@upstash/redis -- version 1.37.0 verified via `npm view`, supports LPUSH, LRANGE, EXPIRE, SET NX, pipeline

### Tertiary (LOW confidence)
- **setTimeout behavior in EasyPanel/Docker:** Based on general Node.js behavior, not verified for this specific deployment. May need adjustment.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries verified, versions confirmed, existing codebase patterns clear
- Architecture: HIGH - webhook extension pattern follows existing code, buffer pattern is well-established Redis pattern
- Pitfalls: HIGH - identified from real production experience (n8n reference) and serverless constraints
- OpenRouter integration: MEDIUM - API docs verified but not tested against production
- Buffer race conditions: MEDIUM - Redis patterns are standard but serverless timing nuances need production validation

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - stable stack, no fast-moving dependencies)
