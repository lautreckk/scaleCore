# Project Research Summary

**Project:** ScaleCore AI Agents
**Domain:** AI WhatsApp Agent Platform (embedded in existing multi-tenant CRM)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

ScaleCore AI Agents replaces an external n8n workflow with a native, multi-tenant AI agent system embedded directly into the existing CRM. The system receives WhatsApp messages via Evolution API webhooks, buffers rapid-fire messages using Redis, processes text and media (audio, images, PDFs), sends assembled prompts to LLM providers via OpenRouter, and delivers human-like split responses back through WhatsApp. The existing codebase already provides the webhook handler, Evolution API client, Supabase multi-tenant infrastructure, wallet/credit system, and tag-based chat management -- so the AI agent system is primarily an additive pipeline that hooks into proven infrastructure rather than a greenfield build.

The recommended approach is a minimal-dependency stack: direct OpenRouter REST API calls (no SDK), Upstash Redis for serverless message buffering, Groq Whisper for audio transcription, and unpdf for PDF extraction -- only 3 new npm packages total. The architecture follows a sequential pipeline pattern (Tag Gate -> Media Processor -> Message Buffer -> Prompt Assembler -> LLM Router -> Response Dispatcher -> Wallet Debit) orchestrated from a single entry point in `lib/agents/index.ts`. This keeps the webhook handler thin (10-15 lines added) and the AI logic self-contained. The build order is dependency-driven: database schema and CRUD first, then webhook integration and buffering, then LLM integration, then media processing, then polish features like handoff and analytics.

The critical risks are: (1) message buffer race conditions in serverless causing duplicate AI responses -- mitigated with Redis distributed locks; (2) WhatsApp number bans from bot-like sending patterns -- mitigated with human-like delays, typing indicators, and rate limiting; (3) context window overflow on smaller LLM models silently degrading response quality -- mitigated with token counting and per-model context budgets; and (4) "zombie agent" states where the AI responds after a human has taken over -- mitigated with a double-check pattern (verify tag before sending, not just before processing). All four risks have clear prevention strategies that must be built into the architecture from Phase 1, not bolted on later.

## Key Findings

### Recommended Stack

The stack leverages the existing Next.js 14 / Supabase / Evolution API foundation and adds only three new dependencies. The central decision is using OpenRouter's REST API directly via `fetch()` instead of any SDK -- this eliminates dependency churn risk while giving full control over multimodal payloads, retries, and model switching (a string change from `openai/gpt-4o` to `anthropic/claude-3.5-sonnet`). See [STACK.md](./STACK.md) for full rationale and alternatives considered.

**Core technologies:**
- **OpenRouter direct fetch**: LLM chat completions -- stable OpenAI-compatible endpoint, zero new dependencies, full multimodal support
- **@upstash/redis**: Message buffering and distributed locks -- HTTP-based, serverless-native, no persistent connections needed
- **groq-sdk**: Whisper audio transcription -- 10x cheaper than OpenAI ($0.04/hr), same quality, supports all WhatsApp audio formats
- **unpdf**: PDF text extraction -- modern, maintained by UnJS, no native dependencies for Docker deployment
- **Supabase PostgreSQL**: Conversation memory -- already in stack, simple sliding window query, RLS handles multi-tenancy
- **Node.js crypto (built-in)**: API key encryption -- AES-256-GCM already exists in codebase

**Cost per AI message: $0.002-0.016** depending on model choice and media processing.

### Expected Features

The MVP must achieve parity with the production n8n workflow while adding multi-tenancy and a management UI. See [FEATURES.md](./FEATURES.md) for full prioritization matrix and competitor analysis.

**Must have (table stakes -- P1):**
- Agent CRUD with model selection and activation tag configuration
- Agent-to-instance binding (many-to-many)
- Text message processing pipeline (webhook -> buffer -> LLM -> respond)
- Message buffering (10s Redis window, proven pattern)
- Conversation memory (50-message sliding window)
- Human handoff via tag system (compliance requirement)
- Response splitting with delays and typing indicator
- Wallet credit deduction per AI message

**Should have (differentiators -- P2):**
- Audio processing via Whisper (voice notes are extremely common in Brazilian WhatsApp)
- Image processing via vision models
- Uploadable media library per agent with AI-decided sending
- PDF/document text extraction
- Conversation summary at handoff

**Defer (v2+):**
- Agent analytics dashboard, prompt templates, multi-agent routing per instance
- Tool calling / function execution, knowledge base / RAG
- Visual flow builder (anti-feature -- conflicts with LLM-first approach)
- User-provided API keys (breaks centralized wallet model)

### Architecture Approach

The architecture is a sequential pipeline that hooks into the existing webhook handler as a post-save fire-and-forget call. All agent logic lives in `lib/agents/` with one file per pipeline stage. The webhook returns 200 immediately; AI processing runs asynchronously in the same Next.js process. A separate conversation memory table (not the existing messages table) stores simplified role/content pairs optimized for LLM context. See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete data flow diagrams and database schema.

**Major components:**
1. **Tag Gate** -- checks activation tag on chat, skips AI if not tagged or human has taken over
2. **Message Buffer** -- aggregates rapid-fire messages via Upstash Redis with 10s window and distributed lock
3. **Media Processor** -- converts images (vision), audio (Whisper), PDFs (text extraction) to text
4. **Prompt Assembler** -- builds full LLM prompt: system prompt + media catalog + conversation history + buffered messages
5. **LLM Router** -- sends to OpenRouter, handles retries, tracks token usage for billing
6. **Response Dispatcher** -- splits response into sentences, detects media URLs, sends with delays via Evolution API
7. **Wallet Integration** -- debits credits after successful send (not after LLM call)

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for full analysis with warning signs and recovery strategies.

1. **Buffer race conditions** -- use Redis `SET NX` distributed lock so only one invocation processes the buffer per phone number. Test with 10 rapid messages from same number.
2. **WhatsApp number bans** -- implement human-like delays (2-5s before responding, 1-3s between split messages), typing indicators, and per-instance rate limiting. Non-negotiable for platform survival.
3. **Context window overflow** -- implement token counting per model, set safe thresholds at 80% of max context, use sliding window with summarization for long conversations. Different models have wildly different limits.
4. **Zombie agent on handoff** -- check activation tag TWICE (before processing AND before sending). Use a Redis flag cleared instantly when human sends a message.
5. **Media cost explosion** -- check wallet balance BEFORE processing media, enforce size limits (audio 2min/5MB, images downscaled, PDFs 5 pages max), rate-limit media per lead.
6. **fromMe infinite loop** -- filter outgoing messages in webhook handler to prevent AI from responding to its own messages.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Database + Agent CRUD + Webhook Hook)
**Rationale:** Everything depends on agents existing in the database and the webhook knowing about them. This is the zero-dependency starting point.
**Delivers:** Agent management UI, database schema (agents, agent_instances, agent_media, agent_conversation_memory tables with RLS), webhook handler extension that detects agent-linked instances.
**Addresses:** Agent CRUD, model selection, agent-to-instance binding, per-agent activation tag
**Avoids:** Cross-tenant data leak (RLS from day one), fromMe infinite loop (filter in webhook extension)

### Phase 2: Core Text Pipeline (Buffer + LLM + Response)
**Rationale:** This is the minimum viable AI -- receive text, buffer it, send to LLM, respond naturally. Must be rock-solid before adding media or handoff.
**Delivers:** Working text-only AI agent that responds to WhatsApp messages with human-like pacing.
**Uses:** @upstash/redis (buffer), OpenRouter direct fetch (LLM), Evolution API client (sending)
**Implements:** Tag Gate, Message Buffer (with distributed lock), LLM Router, Prompt Assembler (basic), Response Dispatcher (split + delays + typing indicator)
**Avoids:** Buffer race conditions (distributed lock), number bans (human-like delays built in from start), webhook blocking (fire-and-forget pattern)

### Phase 3: Conversation Memory + Wallet
**Rationale:** Memory makes the AI coherent across turns; wallet enables monetization. Both are simple additions once the core pipeline works.
**Delivers:** Persistent conversation context (50-message window), per-message credit deduction, cost tracking.
**Addresses:** Conversation memory, wallet deduction
**Avoids:** Context window overflow (implement token counting here, before media adds more tokens), wallet deduction on failed send (debit after successful Evolution API send)

### Phase 4: Human Handoff
**Rationale:** Critical for compliance and user trust. Depends on the tag gate (Phase 2) and benefits from the Redis infrastructure already in place.
**Delivers:** Automatic AI deactivation when human responds, double-check before sending, clean handoff experience.
**Addresses:** Human handoff via tag removal, zombie agent prevention
**Avoids:** Zombie agent state (Redis flag + double-check pattern)

### Phase 5: Media Processing (Audio + Image + PDF)
**Rationale:** Additive capability on top of working text pipeline. Each media type is independent and can be shipped incrementally. Audio first (most common in Brazilian WhatsApp).
**Delivers:** Voice note transcription, image understanding, PDF text extraction.
**Uses:** groq-sdk (Whisper), OpenRouter vision (multimodal messages), unpdf
**Avoids:** Media cost explosion (size limits + wallet pre-check), audio format mismatch (OGG/Opus handling)

### Phase 6: Media Library + AI-Decided Sending
**Rationale:** Requires both the CRUD system (Phase 1) and the response dispatcher (Phase 2). High-value differentiator but not blocking.
**Delivers:** Per-agent uploadable media catalog, AI contextually decides when to send product photos/documents.
**Implements:** Prompt Assembly with Media Asset Injection pattern, media-aware Response Dispatcher
**Addresses:** Uploadable media library, AI-decided media sending

### Phase Ordering Rationale

- **Phases 1-2 are the critical path:** Without CRUD and the text pipeline, nothing else can be tested or demonstrated. These two phases produce a working (if basic) AI agent.
- **Phase 3 before Phase 4:** Memory makes the AI useful enough that handoff matters. Without memory, conversations are stateless and handoff is less critical.
- **Phase 4 before Phase 5:** Handoff is a compliance requirement and simpler to implement than media processing. Get it right before adding complexity.
- **Phase 5 before Phase 6:** Inbound media processing (understanding what the user sent) is more valuable than outbound media sending (AI deciding to share assets).
- **Each phase is independently testable and shippable.** Phase 2 alone delivers a functional text-only agent that surpasses many competitors.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Buffer):** The distributed lock pattern with Upstash Redis Lua scripting needs careful implementation research. The compare-after-wait vs. lock-based approaches have tradeoffs that should be validated with load testing.
- **Phase 5 (Media):** Audio format conversion (OGG/Opus to Whisper-compatible format), image downscaling, and PDF OCR fallback are implementation details that need API-level research during planning.

Phases with standard patterns (skip research-phase):
- **Phase 1 (CRUD):** Standard Next.js API routes + Supabase tables + React forms. Well-documented, established patterns throughout the existing codebase.
- **Phase 3 (Memory + Wallet):** Simple database queries and existing wallet integration. The codebase already has wallet deduction patterns.
- **Phase 4 (Handoff):** Tag management already exists in the codebase. The new logic is a Redis flag check -- straightforward.
- **Phase 6 (Media Library):** Supabase Storage upload + prompt injection. Standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs. Only 3 new deps. OpenRouter API is stable (OpenAI-compatible spec). Groq Whisper pricing confirmed. |
| Features | HIGH | Feature set validated against 6+ competitor platforms and the production n8n workflow. Meta 2026 compliance requirements researched. Clear anti-feature boundaries. |
| Architecture | HIGH | Pipeline pattern proven in production n8n workflow (2524-line workflow running live). Database schema fits existing Supabase/RLS patterns. Build order derived from dependency analysis. |
| Pitfalls | MEDIUM-HIGH | Race conditions and handoff issues identified from community reports and architectural analysis. Number ban risk documented in Evolution API GitHub issues. Some pitfalls (e.g., exact Upstash free tier limits under load) need validation during implementation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Upstash Redis free tier limits under real load:** 10K commands/day should cover MVP but needs monitoring. Plan for paid tier ($0.2/100K commands) at scale.
- **Next.js fire-and-forget reliability on EasyPanel:** The assumption that the Node.js process stays alive after returning 200 needs verification in the deployment environment. If it does not, `waitUntil()` or a separate processing endpoint is needed.
- **Audio format conversion:** WhatsApp sends OGG/Opus audio. Groq Whisper supports this format (per docs), but end-to-end testing with real WhatsApp voice messages is needed to confirm no conversion step is required.
- **Token counting accuracy:** Using `tiktoken` for OpenAI models is reliable, but token counting for non-OpenAI models (Claude, Llama) via OpenRouter may require approximation. Need to validate approach during Phase 3.
- **Scanned PDF handling:** `unpdf` extracts text from text-based PDFs but returns empty for scanned/image PDFs. Decide during Phase 5 whether to add OCR fallback or return a graceful "cannot read this PDF" message.

## Sources

### Primary (HIGH confidence)
- [OpenRouter API Documentation](https://openrouter.ai/docs/api/reference/overview) -- API spec, multimodal support, error handling
- [Groq Speech-to-Text Documentation](https://console.groq.com/docs/speech-to-text) -- Whisper pricing, format support
- [Upstash Redis Documentation](https://upstash.com/docs/redis/sdks/ts/getstarted) -- serverless Redis patterns
- [Evolution API GitHub Issues](https://github.com/EvolutionAPI/evolution-api/issues/2228) -- number ban risk, restrictions
- [WhatsApp 2026 AI Policy](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban) -- compliance requirements
- Production n8n workflow (`Agente IA max.json`, 2524 lines) -- validated patterns for buffer, memory, response splitting
- Existing codebase: webhook handler (1093 lines), Evolution client (812 lines), wallet system, tag management

### Secondary (MEDIUM confidence)
- [Redis AI Agent Architecture Blog](https://redis.io/blog/ai-agent-architecture/) -- state management patterns
- [Context Window Overflow Strategies](https://redis.io/blog/context-window-overflow/) -- summarization approaches
- [GPT-4o Vision Token Costs](https://community.openai.com/t/cost-of-vision-using-gpt-4o/775002) -- vision pricing estimates
- [unpdf vs pdf-parse comparison](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) -- PDF library selection
- Competitor analysis: Botpress, Manychat, Wati, Respond.io feature matrices

### Tertiary (LOW confidence)
- WhatsApp unofficial rate limits (~60 messages/hour threshold) -- community-reported, not officially documented
- Upstash free tier performance under concurrent buffer operations -- needs validation

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
