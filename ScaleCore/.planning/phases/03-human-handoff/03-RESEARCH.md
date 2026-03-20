# Phase 3: Human Handoff - Research

**Researched:** 2026-03-20
**Domain:** Automatic AI deactivation on human takeover, escalation keywords, conversation summary, manual reactivation
**Confidence:** HIGH

## Summary

This phase implements the safe transition between AI agent and human attendant in WhatsApp conversations. The core mechanism already exists: the AI pipeline (Phase 2) only processes messages for chats that have the agent's `activation_tag` in the `chats.tags` array. The handoff system adds the inverse: automatically removing that tag when a human attendant intervenes (either by sending a message or when the lead types a configured escalation keyword), generating a conversation summary via LLM, and allowing the attendant to reactivate by adding the tag back manually.

The existing codebase provides all necessary infrastructure. The webhook handler (`app/api/webhooks/evolution/route.ts`) already receives both `fromMe` and non-`fromMe` messages, the `chats.tags` column is a PostgreSQL string array managed via Supabase, the `chatCompletion` function in `lib/agents/openrouter.ts` can generate summaries, and the `messages` table supports custom `message_type` values for displaying notes inline in the chat UI. The `ai_agents` table needs one new column (`escalation_keywords`) and one new RPC function (`remove_chat_tag`) for atomic tag removal.

This is a focused phase with no new dependencies. All work uses existing libraries (`@supabase/supabase-js`, `lib/agents/openrouter.ts`, `lib/evolution/client.ts`). The complexity is in the webhook handler logic changes: detecting when to remove the tag, generating the summary without blocking the webhook, and handling edge cases (buffered messages in flight when handoff occurs, multiple agents on same instance).

**Primary recommendation:** Extend the webhook handler's `fromMe` branch and the pipeline's keyword detection to remove the activation tag and fire a background summary generation. Use a cheap/fast model (GPT-4o Mini or Claude Haiku) for summaries to minimize cost and latency. Insert the summary as a `message_type: "system_note"` in the `messages` table for inline display.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HAND-01 | Quando atendente responde manualmente no chat, tag de ativacao e removida automaticamente e IA para de responder | Extend webhook handler: when `fromMe=true` AND chat has an agent's activation tag, remove the tag via `remove_chat_tag` RPC. Since the AI pipeline checks `chatTags` on entry, removing the tag immediately stops AI processing. |
| HAND-02 | Resumo da conversa gerado via LLM quando humano assume (exibido como nota no chat) | Use existing `chatCompletion()` with a cheap model (GPT-4o Mini) + conversation history from `getConversationHistory()`. Insert result as `message_type: "system_note"` in the `messages` table. Fire-and-forget from webhook handler. |
| HAND-03 | Keywords de escalation configuraveis (ex: "falar com atendente") removem tag automaticamente | Add `escalation_keywords TEXT[] DEFAULT '{}'` column to `ai_agents` table. In the pipeline, before buffer, check if message content matches any keyword. If match, remove tag and generate summary. |
| HAND-04 | Atendente pode reativar a IA adicionando a tag de volta ao chat manualmente | Already supported by existing tag management UI. Attendant adds the activation tag back to the chat via the existing tag editing interface. No code changes needed -- the pipeline's tag gate will resume processing. |
</phase_requirements>

## Standard Stack

### Core (No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.45.x (existing) | Tag removal, summary insertion, schema migration | Already in stack, handles all DB operations |
| lib/agents/openrouter.ts | existing | Generate conversation summary via LLM | Already built, accepts any model ID |
| lib/agents/memory.ts | existing | Retrieve conversation history for summary | Already built, returns last N messages |

### NOT Adding
| Library | Reason |
|---------|--------|
| No new npm dependencies | This phase is pure logic changes to existing modules + one DB migration + one RPC function |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  agents/
    pipeline.ts        # MODIFY -- add escalation keyword check
    handoff.ts         # NEW -- tag removal + summary generation
    models.ts          # existing (SUMMARY_MODEL constant)
    memory.ts          # existing (getConversationHistory)
    openrouter.ts      # existing (chatCompletion)
app/
  api/
    webhooks/
      evolution/
        route.ts       # MODIFY -- add fromMe handoff branch
supabase/
  migrations/
    003_handoff.sql    # NEW -- escalation_keywords column + remove_chat_tag RPC
types/
  database.ts          # MODIFY -- add escalation_keywords to ai_agents type
```

### Pattern 1: fromMe Detection for Human Takeover (HAND-01)
**What:** When the webhook receives a `fromMe=true` message (attendant sent a message manually), check if the chat has any agent activation tags. If it does, remove the tag to deactivate the AI.
**When to use:** Every `fromMe=true` message in the MESSAGES_UPSERT handler.
**Critical detail:** The current webhook handler skips AI processing entirely when `fromMe=true` (line 1012: `if (!fromMe && ...)`). The handoff logic must run BEFORE this skip, in a separate branch that handles `fromMe=true` messages. It must NOT be inside the existing AI pipeline call.
**Example:**
```typescript
// In webhook handler, MESSAGES_UPSERT case, AFTER message is saved but BEFORE the AI branch:

// Human handoff: if attendant sends a message, deactivate AI for this chat
if (fromMe && chat?.tags?.length) {
  try {
    await handleHumanTakeover({
      chatId: chat.id,
      chatTags: chat.tags,
      instanceId: instance.id,
      remoteJid,
      tenantId,
      supabase,
    });
  } catch (err) {
    console.error("[Handoff] Error:", err);
  }
}
```

### Pattern 2: Escalation Keyword Detection (HAND-03)
**What:** Before the message enters the buffer, check if the lead's message matches any configured escalation keyword for the matched agent. If it matches, remove the tag and generate summary instead of buffering.
**When to use:** In the pipeline, after finding the matching agent but before adding to buffer.
**Important:** Keyword matching should be case-insensitive and support partial matching (the keyword appears anywhere in the message, not exact match only). This is because leads type naturally: "quero falar com atendente por favor" should match the keyword "falar com atendente".
**Example:**
```typescript
// In pipeline.ts, after finding the agent and before buffer:

// Check escalation keywords (HAND-03)
const keywords: string[] = agent.escalation_keywords || [];
const lowerContent = content.trim().toLowerCase();
const isEscalation = keywords.some(kw => lowerContent.includes(kw.toLowerCase()));

if (isEscalation) {
  await handleEscalation({
    chatId, instanceId, remoteJid, tenantId,
    agentActivationTag: agent.activation_tag,
    agentModelId: agent.model_id,
    supabase, evolutionClient,
  });
  return; // Stop processing -- human takes over
}
```

### Pattern 3: Conversation Summary as System Note (HAND-02)
**What:** Generate a brief summary of the conversation via LLM and insert it as a system note in the messages table. The note appears inline in the chat timeline, visible to the attendant who takes over.
**When to use:** Every time a handoff occurs (both fromMe takeover and escalation keyword).
**Model choice:** Use a fast, cheap model for summaries. GPT-4o Mini (`openai/gpt-4o-mini`) costs 1 credit and is fast enough. Do NOT use the agent's configured model -- the summary is a platform operation, not an agent response.
**Example:**
```typescript
// lib/agents/handoff.ts
const SUMMARY_MODEL = "openai/gpt-4o-mini";

const SUMMARY_PROMPT = `Voce e um assistente que resume conversas de WhatsApp para atendentes humanos.
Gere um resumo conciso (3-5 frases) da conversa abaixo, focando em:
- O que o lead quer/precisa
- Decisoes ja tomadas
- Proximos passos esperados
- Qualquer informacao importante mencionada (nome, produto, data, valor)

Responda APENAS com o resumo, sem prefixo ou formatacao especial.`;

async function generateHandoffSummary(
  history: { role: string; content: string }[]
): Promise<string> {
  if (history.length === 0) return "Sem historico de conversa.";

  const conversation = history
    .map(m => `${m.role === "user" ? "Lead" : "IA"}: ${m.content}`)
    .join("\n");

  const { content } = await chatCompletion(SUMMARY_MODEL, [
    { role: "system", content: SUMMARY_PROMPT },
    { role: "user", content: conversation },
  ]);

  return content;
}
```

### Pattern 4: Tag Removal via RPC (Atomic)
**What:** Remove a specific tag from the `chats.tags` array using a PostgreSQL RPC function. The Supabase JS client doesn't support `array_remove()` directly in `.update()` calls, so an RPC is required for atomic operation.
**When to use:** Every handoff event.
**Example (SQL):**
```sql
CREATE OR REPLACE FUNCTION remove_chat_tag(p_chat_id UUID, p_tag TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE chats
  SET tags = array_remove(COALESCE(tags, '{}'), p_tag)
  WHERE id = p_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
**Example (TypeScript):**
```typescript
await supabase.rpc("remove_chat_tag", {
  p_chat_id: chatId,
  p_tag: activationTag,
});
```

### Anti-Patterns to Avoid
- **Removing tag AFTER generating summary:** Remove the tag FIRST, then generate summary in background. If summary generation fails, the handoff still happened (tag removed). Never let a failed summary block the handoff.
- **Using the agent's model for summaries:** Summaries are a platform feature, not an agent response. Use a hardcoded cheap model. Don't charge the tenant for the summary (it's a utility, not a billed AI response).
- **Checking fromMe inside the pipeline:** The `fromMe` check for HAND-01 must happen in the webhook handler, not in `processAgentMessage()`. The pipeline already filters out `fromMe` messages (PIPE-04). Adding handoff logic inside the pipeline would never execute for `fromMe` messages.
- **Blocking webhook for summary generation:** Summary generation involves an LLM call (1-5 seconds). Use `waitUntil()` for fire-and-forget, same as the AI pipeline call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tag removal from PostgreSQL array | Client-side filter + full array rewrite | `array_remove()` in RPC function | Atomic, handles concurrency, no read-before-write |
| Conversation summary | Custom text extraction/heuristics | LLM via existing `chatCompletion()` | LLM produces natural, context-aware summaries. 50 messages of context fits easily in any model's window. |
| Keyword matching | Regex engine, NLP, fuzzy matching | Simple `string.includes()` with `.toLowerCase()` | Escalation keywords are exact phrases configured by the user. Case-insensitive substring matching handles natural typing ("quero falar com atendente por favor" matches "falar com atendente"). No NLP needed. |

**Key insight:** This phase adds no new dependencies because the hard parts (LLM calls, message sending, tag management infrastructure) already exist. The work is orchestration and edge case handling.

## Common Pitfalls

### Pitfall 1: Buffered Messages Processing After Handoff
**What goes wrong:** Lead sends "quero falar com atendente" (escalation keyword). The pipeline detects it and removes the tag. But previous messages from the same lead are already in the Redis buffer from the last 10 seconds. The buffer drain fires after the tag is removed and tries to process, but the tag is gone so it exits cleanly at the tag gate.
**Why it happens:** The buffer has a 10-second delay. Escalation can happen within that window.
**How to avoid:** This is actually handled correctly by the existing architecture. The `processBufferedMessages` function calls `drainBuffer` which checks a lock. If the escalation path has already drained/cleared the buffer, the delayed processing finds nothing and exits. If it hasn't, the tag gate in the pipeline will skip processing because the tag was already removed. No special handling needed.
**Warning signs:** AI responding after the lead requested a human.

### Pitfall 2: AI Messages Sent by Pipeline Trigger Handoff
**What goes wrong:** The AI sends a response via Evolution API. This message appears as `fromMe=true` in the next webhook event (SEND_MESSAGE or MESSAGES_UPSERT echo). The handoff logic incorrectly treats this as a human attendant message and removes the tag.
**Why it happens:** Evolution API echoes sent messages back through the webhook. The AI's own messages have `fromMe=true`.
**How to avoid:** Distinguish AI-sent messages from human-sent messages. The pipeline inserts messages with `message_id` starting with `ai-` prefix (e.g., `ai-1710936000000-abc123`). When a `fromMe=true` message arrives in the webhook, check if it was recently inserted by the AI pipeline (e.g., check `message_id` prefix or check if the message already exists in the DB with the AI prefix). Alternatively, the simplest approach: check if the message `message_id` already exists in the DB before triggering handoff -- if it does, it was the AI echo, not a human message.
**Warning signs:** AI deactivating itself immediately after sending a response.

### Pitfall 3: Summary Generation Fails Silently
**What goes wrong:** The LLM call for summary generation fails (rate limit, timeout, API error). No summary appears in the chat. The attendant takes over without context.
**Why it happens:** Summary generation is fire-and-forget. Errors are caught but not retried.
**How to avoid:** Wrap with try/catch and insert a fallback message: "Resumo indisponivel. Verifique o historico da conversa." This ensures the attendant always sees an indication that AI was active, even if the full summary failed.
**Warning signs:** Missing summary notes in chats where AI was active.

### Pitfall 4: Escalation Keywords Too Broad
**What goes wrong:** User configures "ajuda" (help) as an escalation keyword. Every message containing "ajuda" triggers handoff, including "obrigado pela ajuda" (thanks for the help) where the lead is satisfied and doesn't want a human.
**Why it happens:** Substring matching is too permissive for short/common words.
**How to avoid:** Document recommendation: use multi-word phrases ("falar com atendente", "quero uma pessoa", "chamar humano") rather than single common words. The UI should show a hint/helper text with this guidance. Application code uses `includes()` which is intentionally simple -- complexity should be in keyword selection, not matching logic.
**Warning signs:** High false-positive handoff rate.

### Pitfall 5: Race Between fromMe Handoff and Buffered Processing
**What goes wrong:** Lead sends a message at T=0 (enters buffer). Attendant sends a response at T=3 (triggers handoff, tag removed). Buffer fires at T=10, tag is gone, exits cleanly. But the Redis buffer still contains the lead's message. Next time the tag is re-added and a new message arrives, the old buffered message from the previous conversation may still be in Redis.
**Why it happens:** Buffer keys have a 15s TTL but if the buffer was never drained (because the lock was never acquired or processing was skipped), the key auto-expires. However, if handoff happens at T=3 and a new message arrives at T=14 (before the 15s TTL), the old message is still in the buffer.
**How to avoid:** When removing the tag (handoff), also delete the buffer key for that chat: `redis.del(agent-buf:${instanceId}:${remoteJid})`. This ensures a clean slate when AI is reactivated.
**Warning signs:** AI responding with context from a previous conversation session.

## Code Examples

### Database Migration: 003_handoff.sql
```sql
-- Add escalation keywords to ai_agents
ALTER TABLE ai_agents
  ADD COLUMN escalation_keywords TEXT[] NOT NULL DEFAULT '{}';

-- RPC: Remove a tag from a chat's tags array (atomic)
CREATE OR REPLACE FUNCTION remove_chat_tag(p_chat_id UUID, p_tag TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE chats
  SET tags = array_remove(COALESCE(tags, '{}'), p_tag)
  WHERE id = p_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Handoff Module: lib/agents/handoff.ts
```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import { chatCompletion, ChatMessage } from "./openrouter";
import { getConversationHistory } from "./memory";

const SUMMARY_MODEL = "openai/gpt-4o-mini";

const SUMMARY_SYSTEM_PROMPT = `Voce e um assistente que resume conversas de WhatsApp para atendentes humanos.
Gere um resumo conciso (3-5 frases) da conversa abaixo, focando em:
- O que o lead quer/precisa
- Decisoes ja tomadas
- Proximos passos esperados
- Informacoes importantes (nome, produto, data, valor)

Responda APENAS com o resumo, sem prefixo ou formatacao.`;

/**
 * Remove activation tag from chat and generate conversation summary.
 * Called on human takeover (fromMe) or escalation keyword.
 */
export async function performHandoff(params: {
  chatId: string;
  activationTag: string;
  instanceId: string;
  remoteJid: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { chatId, activationTag, instanceId, remoteJid, supabase } = params;

  // 1. Remove tag immediately (stops AI processing)
  await supabase.rpc("remove_chat_tag", {
    p_chat_id: chatId,
    p_tag: activationTag,
  });

  console.log(`[Handoff] Tag "${activationTag}" removed from chat ${chatId}`);

  // 2. Generate and insert summary (best-effort)
  try {
    const history = await getConversationHistory(supabase, remoteJid, instanceId);

    if (history.length > 0) {
      const conversation = history
        .map(m => `${m.role === "user" ? "Lead" : "IA"}: ${m.content}`)
        .join("\n");

      const { content: summary } = await chatCompletion(SUMMARY_MODEL, [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: conversation },
      ]);

      await supabase.from("messages").insert({
        chat_id: chatId,
        message_id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        from_me: true,
        remote_jid: remoteJid,
        message_type: "system_note",
        content: `[Resumo IA] ${summary}`,
        status: "sent",
        timestamp: new Date().toISOString(),
      });

      console.log(`[Handoff] Summary generated for chat ${chatId}`);
    }
  } catch (err) {
    // Fallback: insert note without summary
    console.error("[Handoff] Summary generation failed:", err);
    await supabase.from("messages").insert({
      chat_id: chatId,
      message_id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from_me: true,
      remote_jid: remoteJid,
      message_type: "system_note",
      content: "[Handoff IA] Atendente assumiu a conversa. Resumo indisponivel — verifique o historico.",
      status: "sent",
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Webhook Handler Extension (fromMe Branch)
```typescript
// In MESSAGES_UPSERT case, after saving message, BEFORE the AI processing branch:

// HAND-01: Human handoff — attendant sends message, remove AI tag
if (fromMe && chat?.tags?.length && instance.evolution_config_id) {
  // Check if this is a human-sent message, not an AI echo
  // AI pipeline inserts messages with message_id starting with "ai-"
  const { data: existingAiMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("chat_id", chat.id)
    .eq("message_id", messageData.key?.id)
    .single();

  // Only trigger handoff if message was NOT already in DB (i.e., not AI echo)
  if (!existingAiMsg) {
    // Find agents bound to this instance with matching tags
    const { data: bindings } = await supabase
      .from("ai_agent_instances")
      .select("ai_agents(activation_tag)")
      .eq("instance_id", instance.id);

    const matchingTags = (bindings || [])
      .map((b: any) => b.ai_agents?.activation_tag)
      .filter((tag: string) => tag && chat.tags.includes(tag));

    for (const tag of matchingTags) {
      waitUntil(
        performHandoff({
          chatId: chat.id,
          activationTag: tag,
          instanceId: instance.id,
          remoteJid,
          supabase,
        }).catch(err => console.error("[Handoff] Error:", err))
      );
    }
  }
}
```

### Pipeline Extension (Escalation Keywords)
```typescript
// In processAgentMessage(), after finding the agent and before #limpar check:

// HAND-03: Escalation keyword detection
const keywords: string[] = agent.escalation_keywords || [];
if (keywords.length > 0) {
  const lowerContent = content.trim().toLowerCase();
  const isEscalation = keywords.some((kw: string) =>
    lowerContent.includes(kw.toLowerCase())
  );

  if (isEscalation) {
    // Find chat ID for this conversation
    const { data: chatData } = await supabase
      .from("chats")
      .select("id")
      .eq("instance_id", instanceId)
      .eq("remote_jid", remoteJid)
      .or("status.is.null,status.eq.open")
      .single();

    if (chatData) {
      await performHandoff({
        chatId: chatData.id,
        activationTag: agent.activation_tag,
        instanceId,
        remoteJid,
        supabase,
      });
    }

    console.log(`[AI Agent] Escalation keyword detected for ${remoteJid}: "${content}"`);
    return; // Stop AI processing
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| n8n "Status IA" check on lead status field | Tag-based activation on `chats.tags` array | Phase 1 (this project) | More flexible, per-agent tags, no separate status field needed |
| Manual tag removal by attendant | Automatic removal on fromMe message | This phase | Zero-friction handoff, attendant just responds naturally |
| No escalation keywords | Configurable keyword list per agent | This phase | Leads can self-escalate without waiting |
| No handoff summary | LLM-generated summary as chat note | This phase | Attendant gets context without reading full history |

## Open Questions

1. **System Note Rendering in Frontend**
   - What we know: The `messages` table supports any `message_type` string. We'll use `"system_note"` for handoff summaries.
   - What's unclear: Does the frontend chat component already render non-standard `message_type` values? It likely shows only `text`, `image`, `audio`, etc.
   - Recommendation: The frontend may need a small update to render `system_note` messages with a distinct visual style (e.g., gray background, centered, smaller text). This is a UI-only change that can be added as a task if needed.

2. **Billing for Summary Generation**
   - What we know: Summary uses GPT-4o Mini (1 credit per message in the curated model list).
   - What's unclear: Should the tenant be charged for the summary? It's a platform utility, not an agent response the lead sees.
   - Recommendation: Do NOT charge for summaries. The summary is a handoff utility that benefits the attendant. Skip the `checkAndDebitWallet` call for summary generation.

3. **Buffer Cleanup on Handoff**
   - What we know: Redis buffer keys have 15s TTL. Handoff should clear them.
   - What's unclear: Should we import `@upstash/redis` into the handoff module, or use a shared cleanup function from `buffer.ts`?
   - Recommendation: Export a `clearBuffer(instanceId, remoteJid)` function from `buffer.ts` that deletes the buffer and lock keys. Call it from `performHandoff()`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x |
| Config file | `vitest.config.ts` at monorepo root (`/Users/lautreck/Desktop/Trabalho/SenaWorks/vitest.config.ts`) |
| Quick run command | `npx vitest run --reporter=verbose ScaleCore/tests/unit/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HAND-01 | fromMe message triggers tag removal from chat | unit | `npx vitest run ScaleCore/tests/unit/handoff-tag-removal.test.ts -t "removes tag"` | Wave 0 |
| HAND-01 | AI echo (message_id starts with "ai-") does NOT trigger handoff | unit | `npx vitest run ScaleCore/tests/unit/handoff-tag-removal.test.ts -t "skips AI echo"` | Wave 0 |
| HAND-02 | Conversation summary generated and inserted as system_note | unit | `npx vitest run ScaleCore/tests/unit/handoff-summary.test.ts -t "generates summary"` | Wave 0 |
| HAND-02 | Fallback note inserted when summary generation fails | unit | `npx vitest run ScaleCore/tests/unit/handoff-summary.test.ts -t "fallback"` | Wave 0 |
| HAND-03 | Escalation keyword in message triggers handoff | unit | `npx vitest run ScaleCore/tests/unit/escalation-keywords.test.ts -t "triggers handoff"` | Wave 0 |
| HAND-03 | Keyword matching is case-insensitive and substring-based | unit | `npx vitest run ScaleCore/tests/unit/escalation-keywords.test.ts -t "case insensitive"` | Wave 0 |
| HAND-04 | Re-adding tag reactivates AI processing | manual-only | Tag gate already tested in existing `tag-check.test.ts` | Existing |

### Sampling Rate
- **Per task commit:** Run `npx vitest run ScaleCore/tests/unit/` for quick validation
- **Per wave merge:** Full suite `npx vitest run`
- **Phase gate:** Full suite green + manual WhatsApp verification (send message as attendant, verify AI stops, verify summary appears)

### Wave 0 Gaps
- [ ] `ScaleCore/tests/unit/handoff-tag-removal.test.ts` -- covers HAND-01 (tag removal on fromMe, AI echo detection)
- [ ] `ScaleCore/tests/unit/handoff-summary.test.ts` -- covers HAND-02 (summary generation, fallback)
- [ ] `ScaleCore/tests/unit/escalation-keywords.test.ts` -- covers HAND-03 (keyword detection, matching logic)

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Direct reading of `lib/agents/pipeline.ts`, `app/api/webhooks/evolution/route.ts`, `lib/agents/openrouter.ts`, `lib/agents/memory.ts`, `lib/agents/buffer.ts`, `types/database.ts`, `supabase/migrations/001_ai_agents.sql`, `lib/agents/validation.ts`, `lib/agents/models.ts`
- **Phase 2 summaries:** 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md -- established patterns for pipeline extension, fire-and-forget, buffer management
- **Architecture research:** `.planning/research/ARCHITECTURE.md` -- Pattern 4 (Human Takeover via Tag Removal) describes the approach

### Secondary (MEDIUM confidence)
- [Supabase array_remove discussion](https://github.com/orgs/supabase/discussions/2016) -- confirms RPC needed for array element removal in Supabase JS client
- [PostgreSQL array_remove function](https://www.w3resource.com/PostgreSQL/postgresql_array_remove-function.php) -- function signature and behavior

### Tertiary (LOW confidence)
- Frontend rendering of `system_note` message type -- needs validation, may require UI changes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing modules
- Architecture: HIGH - patterns directly extend Phase 2 pipeline, webhook handler understood thoroughly
- Pitfalls: HIGH - identified from production-relevant race conditions (buffer + handoff timing, AI echo detection)
- Summary generation: HIGH - uses existing `chatCompletion()` with known model
- Frontend display: LOW - `system_note` message_type rendering not verified

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days - stable stack, no external dependencies)
