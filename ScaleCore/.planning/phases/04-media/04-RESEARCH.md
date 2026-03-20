# Phase 4: Media - Research

**Researched:** 2026-03-20
**Domain:** Media processing (inbound audio/image/PDF) + media library (outbound)
**Confidence:** HIGH

## Summary

Phase 4 adds two capabilities to the AI agent pipeline: (1) processing inbound media messages (audio transcription, image description, PDF text extraction) so the AI can respond to non-text content, and (2) a media library where users upload files that the AI can contextually send during conversations.

The existing codebase is very well-prepared for this phase. The webhook handler already parses all media types (audio, image, video, document) and uploads them to Supabase Storage with public URLs. The Evolution API client already has `sendMedia()` and `getBase64FromMediaMessage()` methods. The OpenRouter client is a thin fetch wrapper that can be extended for multimodal content (images use `image_url` content parts, audio uses `input_audio` content parts). The main work is: (a) extending the pipeline to accept media messages instead of filtering to text-only, (b) adding media processing modules (transcription, vision, PDF extraction), (c) creating the `ai_agent_media` table and CRUD, (d) injecting media library context into the system prompt, and (e) parsing media markers from AI responses to send via Evolution API.

**Primary recommendation:** Use OpenRouter's native multimodal API for both audio transcription and image description (no separate Whisper API needed). Use `pdf-parse` for PDF text extraction. Define a simple marker syntax like `[MEDIA:uuid]` that the AI includes in responses when it wants to send a library file.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MEDIA-01 | Lead envia audio e o agente transcreve via Whisper e processa como texto | OpenRouter `input_audio` content type supports audio transcription via chat completions API. Models like GPT-4o and Gemini support audio natively. |
| MEDIA-02 | Lead envia imagem e o agente descreve via Vision model e processa como texto | OpenRouter `image_url` content type with base64 data URIs. All curated models with vision (GPT-4o, Gemini, Claude) support this. |
| MEDIA-03 | Lead envia PDF e o agente extrai texto e processa como conteudo | `pdf-parse` v2.4.5 extracts text from PDF buffers. Webhook already uploads PDFs to Supabase Storage with public URLs. |
| LIB-01 | Usuario faz upload de imagens, videos e documentos na biblioteca de midia do agente | New `ai_agent_media` table + Supabase Storage upload. Existing `/api/upload/route.ts` pattern reusable. |
| LIB-02 | Usuario pode adicionar descricao e nome a cada midia uploadada | `ai_agent_media` table includes `name` and `description` columns. |
| LIB-03 | Lista de midias disponiveis e injetada no prompt do sistema para a IA decidir quando enviar | System prompt augmentation in pipeline: append media catalog as structured list before LLM call. |
| LIB-04 | IA decide contextualmente quando enviar midia baseado no prompt e na conversa | LLM receives media list in system prompt with instructions; AI includes `[MEDIA:uuid]` markers in response text. |
| LIB-05 | Sistema detecta marcadores de midia na resposta da IA e envia via Evolution API | Regex extraction of `[MEDIA:uuid]` from AI response, lookup in `ai_agent_media`, send via `evolutionClient.sendMedia()`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenRouter API | v1 | Audio transcription + image description via multimodal chat completions | Already in use. Supports `input_audio` and `image_url` content types natively. No separate API needed. |
| pdf-parse | 2.4.5 | Extract text from PDF files | Pure JS, zero native deps, works in serverless. Most used PDF text extraction in Node.js ecosystem. |
| @supabase/supabase-js | ^2.45.0 | Storage for media uploads + database for media library | Already installed. Supabase Storage bucket `chat-media` already exists. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit testing | Already installed. Test media processing modules. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenRouter audio | Direct OpenAI Whisper API | Separate API key + billing. OpenRouter wraps it via GPT-4o audio. Unnecessary complexity. |
| pdf-parse | pdf.js-extract | More features but heavier. pdf-parse is simpler for text-only extraction. |
| Marker-based media sending | Tool calling / function execution | Out of scope per PROJECT.md. Markers in text are simpler and sufficient for v1. |

**Installation:**
```bash
npm install pdf-parse
```

## Architecture Patterns

### Recommended Project Structure
```
lib/agents/
  pipeline.ts          # Extended: accept media messages, parse media markers from response
  openrouter.ts        # Extended: support multimodal messages (image_url, input_audio)
  media-processor.ts   # NEW: transcribe audio, describe image, extract PDF text
  media-library.ts     # NEW: inject media catalog into prompt, lookup media by ID
  splitter.ts          # Extended: strip media markers before splitting text

app/api/agents/[id]/media/
  route.ts             # NEW: CRUD for agent media library (GET list, POST upload)
  [mediaId]/route.ts   # NEW: DELETE, PATCH (update name/description)

components/agents/
  media-library.tsx    # NEW: Media library UI tab in agent form (upload, list, delete)

supabase/migrations/
  004_ai_agent_media.sql  # NEW: ai_agent_media table
```

### Pattern 1: Multimodal Message Construction
**What:** Extend `ChatMessage` type to support OpenRouter multimodal content parts
**When to use:** When building LLM request for audio or image messages
**Example:**
```typescript
// Source: https://openrouter.ai/docs/guides/overview/multimodal/images
// Source: https://openrouter.ai/docs/guides/overview/multimodal/audio
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

// Image: use data URI with base64
const imageMessage: ChatMessage = {
  role: "user",
  content: [
    { type: "text", text: "Descreva essa imagem e responda como parte da conversa." },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
  ]
};

// Audio: use input_audio format
const audioMessage: ChatMessage = {
  role: "user",
  content: [
    { type: "text", text: "Transcreva esse audio e responda como parte da conversa." },
    { type: "input_audio", input_audio: { data: base64Data, format: "ogg" } }
  ]
};
```

### Pattern 2: Media Marker Extraction
**What:** AI includes markers in text response; system extracts and sends media files
**When to use:** When AI wants to send a library file to the lead
**Example:**
```typescript
// AI response: "Aqui esta nosso catalogo de produtos [MEDIA:uuid-123] e a tabela de precos [MEDIA:uuid-456]"
const MEDIA_MARKER_REGEX = /\[MEDIA:([a-f0-9-]+)\]/gi;

function extractMediaMarkers(text: string): string[] {
  const matches = [...text.matchAll(MEDIA_MARKER_REGEX)];
  return matches.map(m => m[1]);
}

function stripMediaMarkers(text: string): string {
  return text.replace(MEDIA_MARKER_REGEX, "").replace(/\s{2,}/g, " ").trim();
}
```

### Pattern 3: Media Catalog Injection in System Prompt
**What:** Append available media list to agent's system prompt so AI knows what it can send
**When to use:** Before every LLM call, if agent has media in library
**Example:**
```typescript
function buildSystemPromptWithMedia(basePrompt: string, mediaItems: AgentMedia[]): string {
  if (mediaItems.length === 0) return basePrompt;

  const catalog = mediaItems.map(m =>
    `- [MEDIA:${m.id}] ${m.name}: ${m.description}`
  ).join("\n");

  return `${basePrompt}

---
MIDIAS DISPONIVEIS:
Quando for contextualmente apropriado, inclua o marcador [MEDIA:id] na sua resposta para enviar a midia ao lead.
${catalog}`;
}
```

### Pattern 4: Inbound Media Processing Flow
**What:** Webhook passes media URL + type to pipeline; pipeline fetches and processes before LLM call
**When to use:** When lead sends audio, image, or PDF
**Example:**
```typescript
// In pipeline.ts - extend ProcessMessageParams
interface ProcessMessageParams {
  // ... existing fields
  messageType: "text" | "image" | "audio" | "document";
  mediaUrl?: string | null;  // Supabase Storage public URL (already uploaded by webhook)
}

// In processAgentMessage:
// 1. If messageType is audio/image/document, process media
// 2. Convert to text representation for the LLM
// 3. Continue normal pipeline flow
```

### Anti-Patterns to Avoid
- **Calling external Whisper API separately:** OpenRouter's multimodal models handle audio transcription natively. No need for a separate API.
- **Storing base64 in database:** Media is already in Supabase Storage. Store URLs only. Fetch base64 from Storage URL when needed for LLM calls.
- **Complex tool calling for media:** Use simple text markers `[MEDIA:id]`. Tool calling is out of scope and adds massive complexity.
- **Processing media in webhook handler:** Keep webhook fast. Media processing (transcription, vision, PDF extraction) happens in the pipeline's fire-and-forget flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | `pdf-parse` | PDF format is complex with fonts, encodings, layouts. Library handles edge cases. |
| Audio transcription | Whisper self-hosted or separate API | OpenRouter `input_audio` content type | Already pay for OpenRouter. Multimodal models handle audio natively. |
| Image description | Separate vision API | OpenRouter `image_url` content type | Same LLM call, same API, same billing. |
| File upload to storage | Custom upload handler | Supabase Storage + existing `/api/upload` pattern | Existing pattern handles validation, tenant scoping, public URLs. |
| Media type detection | MIME type parsing | File extension + MIME from webhook data | Webhook already provides `mimetype` for all media types. |

**Key insight:** The n8n reference flow used 3 separate integrations (Whisper, GPT-4o Vision, PDF extraction). With OpenRouter multimodal, audio and image processing collapse into a single API call pattern. Only PDF needs a separate library.

## Common Pitfalls

### Pitfall 1: Audio Format Compatibility
**What goes wrong:** WhatsApp sends audio as `.ogg` with opus codec. Not all models support all formats.
**Why it happens:** Evolution API returns audio with mimetype like `audio/ogg; codecs=opus`. Format string needs cleaning.
**How to avoid:** Strip codec info from mimetype (already done in webhook). For OpenRouter, use `format: "ogg"`. GPT-4o and Gemini both support ogg.
**Warning signs:** Transcription returns empty or error.

### Pitfall 2: Base64 Size Limits
**What goes wrong:** Large audio/video files exceed API request size limits.
**Why it happens:** Base64 encoding increases size by ~33%. A 10MB audio becomes ~13MB base64.
**How to avoid:** Set reasonable file size limits. For audio transcription, 10MB is typical max. For images, compress or resize if needed. For PDFs, extract text server-side (no base64 to LLM needed).
**Warning signs:** 413 or timeout errors from OpenRouter.

### Pitfall 3: Media URL Expiration
**What goes wrong:** WhatsApp media URLs expire quickly. Cannot fetch media hours after receipt.
**Why it happens:** WhatsApp encrypts media and URLs expire.
**How to avoid:** The webhook ALREADY uploads to Supabase Storage immediately. Use the Storage URL (permanent), not the WhatsApp URL.
**Warning signs:** 404 when trying to fetch media from WhatsApp URL.

### Pitfall 4: Model Capability Mismatch
**What goes wrong:** Sending image/audio to a model that doesn't support multimodal input.
**Why it happens:** Not all curated models support vision/audio. Llama 3.3 70B, DeepSeek V3, Qwen 2.5 are text-only.
**How to avoid:** Use a dedicated multimodal model for media processing (e.g., GPT-4o-mini for cost efficiency). Fall back to text description if agent's model doesn't support media.
**Warning signs:** OpenRouter returns error about unsupported content type.

### Pitfall 5: System Prompt Bloat from Media Library
**What goes wrong:** Agent with 50+ media items creates a huge system prompt, increasing cost and potentially exceeding context limits.
**Why it happens:** Each media item adds ~100 chars to system prompt. 50 items = 5KB of catalog.
**How to avoid:** Limit media library items per agent (e.g., 20-30 max). Keep descriptions concise. Only include active media in prompt.
**Warning signs:** High token usage, increased latency, truncated context.

### Pitfall 6: Media Markers in Split Response
**What goes wrong:** Media marker `[MEDIA:uuid]` gets split across two message parts, or media sent in wrong order relative to text.
**How to avoid:** Extract and strip ALL media markers from AI response BEFORE splitting into message parts. Send text parts first, then media files in order. Or send media inline between relevant text parts.
**Warning signs:** Lead receives `[MEDIA:uuid` as raw text.

## Code Examples

### Fetching Media from Supabase Storage for LLM Processing
```typescript
// Source: Existing codebase pattern in webhook handler
async function fetchMediaAsBase64(mediaUrl: string): Promise<string> {
  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}
```

### PDF Text Extraction
```typescript
// Source: https://www.npmjs.com/package/pdf-parse
import pdfParse from "pdf-parse";

async function extractPdfText(mediaUrl: string): Promise<string> {
  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  const data = await pdfParse(buffer);
  // Truncate to avoid context overflow (e.g., 4000 chars)
  return data.text.substring(0, 4000);
}
```

### Sending Media via Evolution API
```typescript
// Source: Existing lib/evolution/client.ts sendMedia method
await evolutionClient.sendMedia(instanceName, {
  number: phoneNumber,
  mediatype: "image",     // "image" | "video" | "audio" | "document"
  mimetype: "image/jpeg",
  caption: "Nosso catalogo de produtos",
  media: publicUrl,       // URL or base64
  fileName: "catalogo.pdf",
});
```

### Database Schema for Media Library
```sql
-- Migration: 004_ai_agent_media.sql
CREATE TABLE ai_agent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_agent_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation via agent" ON ai_agent_media
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM ai_agents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX idx_ai_agent_media_agent ON ai_agent_media(agent_id);
CREATE INDEX idx_ai_agent_media_active ON ai_agent_media(agent_id, is_active) WHERE is_active = true;
```

## State of the Art

| Old Approach (n8n) | Current Approach | Impact |
|---------------------|------------------|--------|
| Separate Whisper API call for audio | OpenRouter `input_audio` content type | Single API, unified billing, same chat completions endpoint |
| Separate GPT-4o Vision API call for images | OpenRouter `image_url` content type | Same endpoint, models already in curated list |
| n8n Extract from File node for PDF | `pdf-parse` npm package | Pure JS, no n8n dependency |
| n8n media response nodes | `[MEDIA:uuid]` marker pattern + `sendMedia()` | Simpler, AI-driven contextual sending |

## Open Questions

1. **Which model to use for media processing?**
   - What we know: GPT-4o and GPT-4o-mini both support vision and audio. Gemini 2.0 Flash also supports both. Claude Sonnet 4 supports vision but audio support via OpenRouter is uncertain.
   - What's unclear: Should we use the agent's configured model or a dedicated model for media processing?
   - Recommendation: Use the agent's configured model if it supports multimodal. Fall back to `openai/gpt-4o-mini` (cheapest multimodal) for media description only, then pass the text description to the agent's model. This keeps costs low and works with all models.

2. **Media library size limit per agent**
   - What we know: Each media item adds ~100 chars to system prompt.
   - What's unclear: What's a reasonable limit?
   - Recommendation: Start with 20 items per agent. Can increase later. Enforce in API route.

3. **Storage bucket for agent media library**
   - What we know: `chat-media` bucket already exists for webhook media uploads.
   - What's unclear: Should agent library media use the same bucket or a separate one?
   - Recommendation: Use same `chat-media` bucket with path prefix `agent-media/{agent_id}/` for organization. Avoids creating new bucket.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.0 |
| Config file | `/Users/lautreck/Desktop/Trabalho/SenaWorks/vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEDIA-01 | Audio transcription builds correct multimodal message | unit | `npx vitest run ScaleCore/tests/unit/media-processor.test.ts -t "audio"` | Wave 0 |
| MEDIA-02 | Image description builds correct multimodal message | unit | `npx vitest run ScaleCore/tests/unit/media-processor.test.ts -t "image"` | Wave 0 |
| MEDIA-03 | PDF text extraction returns truncated text | unit | `npx vitest run ScaleCore/tests/unit/media-processor.test.ts -t "pdf"` | Wave 0 |
| LIB-01 | Media upload creates record in ai_agent_media | integration | manual (Supabase) | N/A |
| LIB-02 | Media name and description saved correctly | integration | manual (API test) | N/A |
| LIB-03 | System prompt includes media catalog | unit | `npx vitest run ScaleCore/tests/unit/media-library.test.ts -t "prompt"` | Wave 0 |
| LIB-04 | AI response with markers detected correctly | unit | `npx vitest run ScaleCore/tests/unit/media-library.test.ts -t "marker"` | Wave 0 |
| LIB-05 | Media markers extracted and stripped from response | unit | `npx vitest run ScaleCore/tests/unit/media-library.test.ts -t "strip"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `ScaleCore/tests/unit/media-processor.test.ts` -- covers MEDIA-01, MEDIA-02, MEDIA-03
- [ ] `ScaleCore/tests/unit/media-library.test.ts` -- covers LIB-03, LIB-04, LIB-05
- No new framework install needed (vitest already installed)

## Sources

### Primary (HIGH confidence)
- OpenRouter Multimodal Images Docs: https://openrouter.ai/docs/guides/overview/multimodal/images -- image_url content type format
- OpenRouter Multimodal Audio Docs: https://openrouter.ai/docs/guides/overview/multimodal/audio -- input_audio content type format
- Existing codebase: `lib/evolution/client.ts` -- sendMedia() and getBase64FromMediaMessage() already implemented
- Existing codebase: `app/api/webhooks/evolution/route.ts` -- all media types already parsed and uploaded to Storage
- Existing codebase: `lib/agents/pipeline.ts` -- current text-only pipeline, extension point at line 1052

### Secondary (MEDIUM confidence)
- pdf-parse npm: https://www.npmjs.com/package/pdf-parse -- v2.4.5, pure JS, widely used
- OpenRouter Vision Models Collection: https://openrouter.ai/collections/vision-models -- model capabilities

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenRouter multimodal is well-documented, pdf-parse is stable, all infrastructure exists
- Architecture: HIGH - Extending existing pipeline pattern, all integration points identified
- Pitfalls: HIGH - Based on actual codebase analysis (mimetype cleaning already done, Storage URLs already permanent)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable domain, no fast-moving dependencies)
