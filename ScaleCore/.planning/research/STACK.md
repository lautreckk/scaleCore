# Technology Stack

**Project:** ScaleCore AI Agents
**Researched:** 2026-03-19

## Recommended Stack

### LLM Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenRouter REST API (direct) | v1 | LLM chat completions | OpenAI-compatible endpoint. Use `fetch()` directly instead of `@openrouter/sdk` (beta, ESM-only, breaking changes between versions) or AI SDK (overkill for backend-only, no streaming to UI needed). Direct fetch gives full control over headers, retries, and multimodal payloads with zero dependency risk. The endpoint is stable: `POST https://openrouter.ai/api/v1/chat/completions`. | HIGH |

**Why NOT `@openrouter/sdk`:** Beta status, ESM-only (project uses CommonJS via Next.js 14), documented breaking changes between minor versions. Risk of churn for no benefit.

**Why NOT `ai` (Vercel AI SDK):** Now at v6 with breaking changes from v4/v5. Designed for streaming chat UIs -- ScaleCore agents are backend-only (webhook receives message, calls LLM, sends response via Evolution API). The SDK's `generateText()` adds abstraction without value here. Also, `@openrouter/ai-sdk-provider` is a community provider that must track both AI SDK and OpenRouter API changes -- double dependency risk.

**Why NOT `openai` SDK with base_url swap:** Viable alternative but adds a 2MB+ dependency for what amounts to a typed fetch wrapper. OpenRouter's API is simple enough that a thin utility function (~50 lines) handles all cases including multimodal content, retry logic, and error handling.

### Message Buffering

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @upstash/redis | ^1.37.0 | Message buffer + conversation lock | HTTP-based Redis client purpose-built for serverless. No persistent connections (critical for Next.js API routes which are ephemeral). Free tier: 10K commands/day. Supports `LPUSH`, `LRANGE`, `EXPIRE`, `SET NX` -- all primitives needed for the buffer pattern. | HIGH |

**Buffer pattern (replicating n8n behavior):**
1. Message arrives -> `LPUSH buffer:{phone}` with message content + type
2. `SET lock:{phone} 1 EX 10 NX` -- if key already exists, another invocation is waiting
3. If NX succeeds: wait 10s, then `LRANGE buffer:{phone} 0 -1` to get all messages, `DEL buffer:{phone}` + `DEL lock:{phone}`
4. If NX fails: return early (the waiting invocation will pick up this message)

**Why NOT `@upstash/queue`:** Message queuing is a different pattern. We need a time-window buffer (accumulate then flush), not a FIFO queue with consumers. Raw Redis commands are simpler and more explicit.

### Audio Transcription

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| groq-sdk | ^0.37.0 | Whisper audio transcription via Groq API | Groq runs `whisper-large-v3-turbo` at $0.04/hour (~$0.0007/min) -- 10x cheaper than OpenAI Whisper ($0.006/min) and significantly faster. OpenAI-compatible API. Supports mp3, mp4, m4a, wav, webm, ogg -- all WhatsApp audio formats. 25MB file limit (WhatsApp audios are typically <5MB). | HIGH |

**Why NOT OpenAI Whisper API directly:** 10x more expensive for equivalent quality. Groq's whisper-large-v3-turbo matches accuracy.

**Why NOT OpenRouter for audio:** OpenRouter supports audio input to chat models (e.g. GPT-4o-audio) but not dedicated transcription endpoints. Sending audio through a chat model for transcription is wasteful -- purpose-built Whisper endpoint is cheaper and more reliable.

**Why NOT self-hosted Whisper:** Requires GPU infrastructure. ScaleCore runs on EasyPanel with Docker. Adding GPU containers adds operational complexity and cost that Groq's API eliminates.

### PDF Text Extraction

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| unpdf | ^1.4.0 | Extract text from PDF documents | Modern, maintained by UnJS team. Works in all JS runtimes including Node.js. Async/await API. Built on pdf.js internally but provides cleaner extraction API. No native dependencies (critical for Docker/EasyPanel deployment). pdf-parse is more popular (~2M downloads) but unmaintained -- last meaningful update was years ago. | MEDIUM |

**Why NOT `pdf-parse`:** Unmaintained. Still works for basic extraction but `unpdf` is the modern replacement with active maintenance and better TypeScript support.

**Why NOT external API (e.g. Adobe PDF Services):** Adds external dependency and cost for what is fundamentally a text extraction task. Most WhatsApp PDFs are simple documents (invoices, contracts, forms) where local extraction is sufficient.

### Image Vision (Multimodal)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenRouter (via same chat completions endpoint) | v1 | Image analysis/vision | No additional library needed. OpenRouter supports multimodal messages with `image_url` content type (both base64 and URL). Send image as part of the user message content array alongside text. Use vision-capable models (GPT-4o, Claude, Gemini) already available through OpenRouter. | HIGH |

**Implementation:** Download image from Evolution API/Supabase Storage -> convert to base64 -> include in messages array as `{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }`. No extra library needed.

### Conversation Memory

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase (PostgreSQL) | existing | Persistent conversation history per lead/phone | Already in the stack. Store messages in a `ai_conversation_messages` table with `tenant_id`, `phone`, `role`, `content`, `created_at`. Query last N messages (50, matching n8n behavior) ordered by timestamp. RLS already handles multi-tenancy isolation. | HIGH |

**Why NOT Redis for memory:** Conversation memory needs persistence across days/weeks. Redis (especially Upstash free tier) is volatile and capacity-limited. PostgreSQL is the right tool for durable, queryable history.

**Why NOT a vector store / RAG:** v1 agents are conversational + media. No knowledge base or document corpus to search. Simple recent-message context (last 50 messages) is what the n8n agent uses successfully in production. Vector stores add complexity without value for this use case.

**Why NOT LangChain memory abstractions:** LangChain adds massive dependency footprint for a simple `SELECT * FROM messages WHERE phone = $1 ORDER BY created_at DESC LIMIT 50` query. The abstraction provides no value here.

### Encryption (API Keys)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js crypto (built-in) | N/A | AES-256-GCM encryption for API keys | Already exists in codebase. Encrypt tenant's OpenRouter API key at rest. No additional library needed. | HIGH |

### Response Splitting & Delivery

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Evolution API client (existing) | v2.3 | Send text, images, audio, documents | Already exists at `/lib/evolution/client.ts` (~812 lines). No new library needed. Implement response splitting (divide into sentences/paragraphs), media URL detection (regex), and delayed sending (setTimeout between messages) as utility functions. | HIGH |

## Full Stack Summary

```
Existing (no changes needed):
  - Next.js 14.2 (App Router, API Routes)
  - Supabase (PostgreSQL + Auth + Storage + RLS)
  - Evolution API client (WhatsApp messaging)
  - Node.js crypto (AES-256-GCM encryption)

New additions:
  - @upstash/redis ^1.37.0  (message buffering)
  - groq-sdk ^0.37.0        (audio transcription)
  - unpdf ^1.4.0             (PDF text extraction)
  - fetch (built-in)         (OpenRouter API calls)
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LLM API | OpenRouter direct fetch | `@openrouter/sdk` | Beta, ESM-only, breaking changes |
| LLM API | OpenRouter direct fetch | Vercel AI SDK + provider | Overkill for backend-only, double dependency risk |
| LLM API | OpenRouter direct fetch | `openai` SDK w/ base_url | Unnecessary 2MB dep for typed fetch |
| Buffering | @upstash/redis | @upstash/queue | Queue pattern != time-window buffer pattern |
| Buffering | @upstash/redis | BullMQ / Redis self-hosted | Requires persistent Redis server, not serverless |
| Audio | groq-sdk (Whisper) | OpenAI Whisper API | 10x more expensive |
| Audio | groq-sdk (Whisper) | OpenRouter audio input | No dedicated transcription endpoint, wasteful |
| Audio | groq-sdk (Whisper) | Self-hosted Whisper | Requires GPU infrastructure |
| PDF | unpdf | pdf-parse | Unmaintained |
| PDF | unpdf | Adobe PDF Services API | Unnecessary external dep + cost |
| Memory | Supabase PostgreSQL | Redis | Not durable, capacity-limited |
| Memory | Supabase PostgreSQL | Vector store / pgvector | No RAG use case in v1 |
| Memory | Supabase PostgreSQL | LangChain | Massive dep for a simple SELECT query |

## Installation

```bash
# New dependencies (only 3 packages)
npm install @upstash/redis groq-sdk unpdf
```

## Environment Variables (New)

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxx

# Groq (for Whisper transcription only)
GROQ_API_KEY=gsk_xxxx

# OpenRouter (system-level key for centralized billing)
OPENROUTER_API_KEY=sk-or-xxxx
```

Note: Tenant-level OpenRouter keys are stored encrypted in Supabase. The system-level key above is for the centralized wallet model where ScaleCore pays OpenRouter and charges tenants via the existing wallet/credit system.

## Cost Estimates Per Message Processed

| Component | Cost | Notes |
|-----------|------|-------|
| LLM (GPT-4o via OpenRouter) | ~$0.005-0.015 | Depends on context length, ~500-1500 tokens |
| LLM (Claude Haiku via OpenRouter) | ~$0.001-0.003 | Budget option |
| LLM (Llama 3.1 70B via OpenRouter) | ~$0.001-0.002 | Open source option |
| Whisper (Groq) | ~$0.0007/min | Typical WhatsApp audio: 15-60s |
| Vision (via OpenRouter) | ~$0.005-0.01 | Image tokens added to LLM cost |
| PDF extraction (unpdf) | $0.00 | Local processing, no API cost |
| Redis buffer (Upstash) | ~$0.000001 | Per command, negligible |
| **Total text-only** | **~$0.002-0.015** | Depends on model chosen |
| **Total with audio** | **~$0.003-0.016** | Adds Whisper transcription |

## Architecture Decision: Why Direct OpenRouter Fetch

The central architectural decision is using OpenRouter's REST API directly instead of any SDK or abstraction layer. Here is the rationale:

1. **Stability:** OpenRouter's `/api/v1/chat/completions` endpoint follows the OpenAI spec, which is the most stable LLM API in the industry. It won't break without major notice.

2. **Multimodal simplicity:** Sending images, text, and structured content is just JSON -- content arrays with `type: "text"` and `type: "image_url"`. No SDK method signatures to learn.

3. **Retry control:** WhatsApp is async. If OpenRouter is slow or errors, we control retry logic, timeout, and fallback directly. SDK abstractions can mask failures.

4. **Model switching:** The `model` field is a string. Switching from `openai/gpt-4o` to `anthropic/claude-3.5-sonnet` is a string change. No provider-specific code paths.

5. **Minimal dependency surface:** 3 new packages total (Redis, Groq, PDF). The LLM integration -- the core of the product -- has zero new dependencies.

A thin wrapper function (~50 lines) handles: request construction, API key injection, error handling, token usage tracking (for wallet billing), and response parsing.

## Sources

- [OpenRouter API Documentation](https://openrouter.ai/docs/api/reference/overview)
- [OpenRouter Multimodal/Images](https://openrouter.ai/docs/guides/overview/multimodal/images)
- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)
- [@openrouter/ai-sdk-provider on npm](https://www.npmjs.com/package/@openrouter/ai-sdk-provider) -- v2.3.1
- [@upstash/redis on npm](https://www.npmjs.com/package/@upstash/redis) -- v1.37.0
- [Upstash Redis Documentation](https://upstash.com/docs/redis/sdks/ts/getstarted)
- [Groq Speech-to-Text Documentation](https://console.groq.com/docs/speech-to-text)
- [groq-sdk on npm](https://www.npmjs.com/package/groq-sdk) -- v0.37.0
- [Groq Pricing](https://groq.com/pricing) -- Whisper Large v3 Turbo at $0.04/hr
- [unpdf on npm](https://www.npmjs.com/package/unpdf) -- v1.4.0
- [unpdf GitHub (UnJS)](https://github.com/unjs/unpdf)
- [Vercel AI SDK v6](https://vercel.com/blog/ai-sdk-6) -- evaluated and rejected
- [pdf-parse vs unpdf comparison](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026)
