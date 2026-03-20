---
phase: 04-media
verified: 2026-03-20T19:38:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Send an audio message to WhatsApp to a chat with the agent's activation tag"
    expected: "AI transcribes the audio and responds contextually in the conversation"
    why_human: "Requires live Evolution API webhook, OpenRouter multimodal call, and real WhatsApp session"
  - test: "Send an image to WhatsApp to a chat with the agent's activation tag"
    expected: "AI describes the image content and responds as part of the conversation"
    why_human: "Requires live webhook, image download, OpenRouter vision call"
  - test: "Send a PDF to WhatsApp to a chat with the agent's activation tag"
    expected: "AI extracts PDF text and responds based on document content"
    why_human: "Requires live webhook, PDF download from Supabase Storage, pdf-parse execution"
  - test: "Open agent edit page, verify Biblioteca de Midia section appears below escalation keywords"
    expected: "Media library section visible with upload button and empty state message"
    why_human: "Visual rendering and layout cannot be verified programmatically"
  - test: "Upload an image file in the media library UI"
    expected: "File appears in list with thumbnail, immediately enters edit mode for name/description"
    why_human: "Upload flow, inline edit trigger, and visual state require browser interaction"
  - test: "Chat with an agent whose library contains an image with a relevant description"
    expected: "AI includes [MEDIA:uuid] marker in response and the image is sent via WhatsApp after the text reply"
    why_human: "End-to-end contextual marker extraction and Evolution API media sending requires live system"
  - test: "Attempt to upload a 21st media item to an agent"
    expected: "API returns 400 with 'Limite de 20 midias atingido', upload button is disabled with tooltip"
    why_human: "Requires UI state check + API 400 response validation in browser"
---

# Phase 04: Media Verification Report

**Phase Goal:** Media processing and media library — enable AI agents to process inbound audio/image/PDF messages and send media files from a managed library during conversations.
**Verified:** 2026-03-20T19:38:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Audio messages can be converted to multimodal LLM content parts | VERIFIED | `processInboundMedia("audio", ...)` returns `ContentPart[]` with `input_audio` type — 1 passing test |
| 2  | Image messages can be converted to multimodal LLM content parts | VERIFIED | `processInboundMedia("image", ...)` returns `ContentPart[]` with `image_url` data URI — 2 passing tests (with and without caption) |
| 3  | PDF documents have their text extracted for LLM processing | VERIFIED | `processInboundMedia("document", ...)` returns `ContentPart[]` with extracted text, 4000-char cap — 1 passing test |
| 4  | OpenRouter client accepts multimodal content (not just string) | VERIFIED | `openrouter.ts` exports `ContentPart` union type; `ChatMessage.content` typed as `string \| ContentPart[]` |
| 5  | System prompt includes media catalog when agent has library items | VERIFIED | `buildSystemPromptWithMedia` appends "MIDIAS DISPONIVEIS" catalog — 4 passing tests (empty, non-empty, active-only, format) |
| 6  | AI response media markers are extracted and corresponding files sent via Evolution API | VERIFIED | `extractMediaMarkers` + `sendMediaFromLibrary` wired in `pipeline.ts`; 2 passing tests for `sendMediaFromLibrary` |
| 7  | Media markers are stripped from text before splitting into WhatsApp messages | VERIFIED | `stripMediaMarkers` called in `pipeline.ts` before `sendSplitResponse`; 3 passing tests |
| 8  | Webhook passes media messages (audio, image, document) to pipeline instead of filtering to text-only | VERIFIED | `AI_PROCESSABLE_TYPES = ["text", "image", "audio", "document"]` replaces old text-only guard at webhook line 1052–1079 |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ScaleCore/tests/unit/media-processor.test.ts` | Test stubs (Plan 00) then real tests (Plan 01) | VERIFIED | 6 real tests passing; no `it.todo` remaining |
| `ScaleCore/tests/unit/media-library.test.ts` | Test stubs (Plan 00) then real tests (Plan 03) | VERIFIED | 12 real tests passing; no `it.todo` remaining |
| `package.json` | Contains `pdf-parse` dependency | VERIFIED | `"pdf-parse": "^2.4.5"` present |
| `supabase/migrations/004_ai_agent_media.sql` | `ai_agent_media` table with RLS | VERIFIED | CREATE TABLE, RLS enabled, "Tenant isolation via agent" policy, partial index on `is_active` |
| `types/database.ts` | `AiAgentMediaRow`, `AiAgentMediaInsert`, `AiAgentMediaUpdate` | VERIFIED | All three interfaces present at lines 1898+ |
| `lib/agents/openrouter.ts` | `ContentPart` type; `ChatMessage.content: string \| ContentPart[]` | VERIFIED | Lines 1-8 export `ContentPart` union with `text`, `image_url`, `input_audio` variants |
| `lib/agents/media-processor.ts` | `processInboundMedia`, `isMultimodalModel`, `fetchMediaAsBase64`, `FALLBACK_MEDIA_MODEL`, `PDF_TEXT_LIMIT` | VERIFIED | All exports confirmed; `import pdfParse from "pdf-parse"` present |
| `app/api/agents/[id]/media/route.ts` | `GET` list + `POST` upload with 20-item limit | VERIFIED | Both handlers present; `count >= 20` guard; storage path `agent-media/${agentId}/`; 201 status on create |
| `app/api/agents/[id]/media/[mediaId]/route.ts` | `PATCH` update + `DELETE` with storage cleanup | VERIFIED | Both handlers present; `supabase.storage.from("chat-media").remove([...])` on delete |
| `components/agents/media-library.tsx` | `MediaLibrary` component with upload, list, edit, delete UI | VERIFIED | All required strings present: "Biblioteca de Midia", "/20 midias", "Adicionar midia", "Nenhuma midia adicionada", "Remover midia", delete AlertDialog, `max-h-[400px]` ScrollArea, `aria-label` attributes |
| `components/agents/agent-form.tsx` | Imports and renders `MediaLibrary` in edit mode; create mode notice | VERIFIED | Line 29: import; lines 430–442: `{mode === "edit" && agentId && <MediaLibrary>}` and create mode notice |
| `lib/agents/media-library.ts` | `buildSystemPromptWithMedia`, `extractMediaMarkers`, `stripMediaMarkers`, `sendMediaFromLibrary` | VERIFIED | All four functions exported; `MEDIA_MARKER_REGEX`, "MIDIAS DISPONIVEIS", `evolutionClient.sendMedia` present |
| `lib/agents/pipeline.ts` | Extended with `messageType?`, `mediaUrl?`, all media functions called | VERIFIED | Lines 14, 41-42, 168-169: imports and interface fields; lines 213, 225, 259-260, 278: all 5 media function calls |
| `app/api/webhooks/evolution/route.ts` | `AI_PROCESSABLE_TYPES` replaces text-only filter; passes `messageType` and `mediaUrl` | VERIFIED | Lines 1052-1079 confirmed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/agents/media-processor.ts` | `lib/agents/openrouter.ts` | imports `ContentPart` type | WIRED | Line 3: `import type { ContentPart } from "./openrouter"` |
| `lib/agents/media-processor.ts` | `pdf-parse` | PDF text extraction | WIRED | Line 1: `import pdfParse from "pdf-parse"` |
| `lib/agents/pipeline.ts` | `lib/agents/media-processor.ts` | imports `processInboundMedia` | WIRED | Line 14: `import { processInboundMedia, isMultimodalModel } from "./media-processor"` |
| `lib/agents/pipeline.ts` | `lib/agents/media-library.ts` | imports `buildSystemPromptWithMedia` + `sendMediaFromLibrary` | WIRED | Line 15: `import { buildSystemPromptWithMedia, extractMediaMarkers, stripMediaMarkers, sendMediaFromLibrary } from "./media-library"` |
| `app/api/webhooks/evolution/route.ts` | `lib/agents/pipeline.ts` | passes `messageType` and `mediaUrl` to `processAgentMessage` | WIRED | Lines 1078-1079: `messageType: messageType as ...`, `mediaUrl: mediaUrl` |
| `components/agents/media-library.tsx` | `/api/agents/[id]/media` | fetch calls for CRUD operations | WIRED | Lines 99 (GET), 140 (POST), 188 (PATCH), 222 (DELETE) |
| `components/agents/agent-form.tsx` | `components/agents/media-library.tsx` | imports and renders `MediaLibrary` | WIRED | Line 29: import; lines 430-434: render inside `mode === "edit" && agentId` guard |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MEDIA-01 | 04-00, 04-01, 04-03 | Lead envia audio e agente processa | SATISFIED | `processInboundMedia("audio", ...)` returns `input_audio` ContentPart; pipeline passes to OpenRouter; webhook routes audio messages |
| MEDIA-02 | 04-00, 04-01, 04-03 | Lead envia imagem e agente descreve | SATISFIED | `processInboundMedia("image", ...)` returns `image_url` ContentPart with data URI; caption support wired |
| MEDIA-03 | 04-00, 04-01, 04-03 | Lead envia PDF e agente extrai texto | SATISFIED | `processInboundMedia("document", ...)` uses `pdf-parse`; 4000-char cap with ellipsis; empty PDF gracefully handled |
| LIB-01 | 04-02 | Upload de imagens, videos, documentos | SATISFIED | POST `/api/agents/[id]/media` handles upload to Supabase Storage; UI upload button in `MediaLibrary` |
| LIB-02 | 04-02 | Nome e descricao para cada midia | SATISFIED | PATCH `/api/agents/[id]/media/[mediaId]` updates name/description; inline edit in MediaLibrary component |
| LIB-03 | 04-00, 04-03 | Lista de midias injetada no prompt | SATISFIED | `buildSystemPromptWithMedia` appends "MIDIAS DISPONIVEIS" catalog; called in `pipeline.ts` before LLM call |
| LIB-04 | 04-03 | IA decide contextualmente quando enviar midia | SATISFIED (needs human) | System prompt instructs AI: "Nao envie midia se nao for relevante para a conversa"; contextual decision delegated to LLM; end-to-end requires live test |
| LIB-05 | 04-00, 04-03 | Sistema detecta marcadores e envia via Evolution API | SATISFIED | `extractMediaMarkers` + `stripMediaMarkers` + `sendMediaFromLibrary` fully wired in pipeline; `evolutionClient.sendMedia` called per marker |

**No orphaned requirements found.** All 8 requirement IDs from plan frontmatter are present in REQUIREMENTS.md and accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ScaleCore/tests/unit/from-me-filter.test.ts` | 7 | `it.todo("skips processing when messageType is not text")` | Warning | This todo describes behavior that is now INCORRECT (webhook expanded to all AI_PROCESSABLE_TYPES). The test is skipped (not failing), but it is stale documentation that contradicts current behavior. Does not block any functionality. |
| `lib/agents/pipeline.ts` | 99 | `// For media messages, use a descriptive placeholder for buffer` — comment uses word "placeholder" | Info | Normal code comment, not a stub. Implementation is complete. |

---

### Human Verification Required

#### 1. Inbound Audio Processing

**Test:** Send an OGG audio message to a WhatsApp number connected to an agent with an activation tag assigned to the chat.
**Expected:** Agent receives the audio, `processInboundMedia("audio", ...)` builds an `input_audio` ContentPart, OpenRouter processes it, and the agent replies with a transcription-aware response.
**Why human:** Requires live Evolution API webhook delivery, Supabase Storage URL for media download, and a real OpenRouter call with an audio-capable model.

#### 2. Inbound Image Processing

**Test:** Send an image (with and without caption) to a WhatsApp chat handled by the agent.
**Expected:** Agent describes image content and responds contextually. Caption is included in the prompt when present.
**Why human:** Requires live webhook, image download from Supabase Storage, and OpenRouter vision model call.

#### 3. Inbound PDF Processing

**Test:** Send a PDF document (less than 4000 chars of text, and one exceeding it) to the agent.
**Expected:** Agent responds based on extracted text. Long PDF response includes "... [texto truncado]" indicator.
**Why human:** Requires live webhook, PDF download, and pdf-parse execution against a real document.

#### 4. Media Library UI — Visual Rendering

**Test:** Open an agent edit page in the browser. Scroll past the escalation keywords section.
**Expected:** "Biblioteca de Midia" heading appears with "0/20 midias" counter and an "Adicionar midia" button. Empty state shows "Nenhuma midia adicionada" with descriptive subtitle.
**Why human:** Visual layout, spacing, and component rendering cannot be verified programmatically.

#### 5. Media Upload and Inline Edit Flow

**Test:** Click "Adicionar midia", select an image file.
**Expected:** File uploads, new item appears in list with thumbnail, immediately enters inline edit mode with name pre-filled from filename. User fills description, clicks "Salvar", toast "Midia salva com sucesso" appears.
**Why human:** Upload flow, Supabase Storage write, and sequential UI state transitions require browser interaction.

#### 6. AI-Driven Media Sending (LIB-04 End-to-End)

**Test:** Configure an agent with a media item in its library (e.g., an image named "Catalogo de Produtos" with description "Envie quando o lead pedir informacoes sobre produtos"). Chat with the agent asking about products.
**Expected:** Agent's response includes a `[MEDIA:uuid]` marker internally; the sent message to WhatsApp is clean (marker stripped); the image is sent as a separate WhatsApp message after the text reply.
**Why human:** Requires live AI decision-making, marker detection, and Evolution API `sendMedia` call against a real WhatsApp session.

#### 7. 20-Item Limit Enforcement

**Test:** Add 20 media items to an agent. Attempt to add a 21st via the UI and directly via `POST /api/agents/{id}/media`.
**Expected:** UI button becomes disabled with tooltip "Limite de 20 midias atingido". API returns HTTP 400 with message "Limite de 20 midias atingido".
**Why human:** Requires populating 20 items (tedious manually) and verifying both UI disable state and API response.

---

### Stale Test Note

`ScaleCore/tests/unit/from-me-filter.test.ts` line 7 contains `it.todo("skips processing when messageType is not text")`. This is stale — the webhook was intentionally expanded to process `["text", "image", "audio", "document"]`. The todo test is skipped and does not cause test failures, but it should be updated to reflect current behavior (e.g., changed to "only skips processing for sticker and video messageTypes"). This is a warning-level finding, not a blocker.

---

### Gaps Summary

No gaps found. All 8/8 must-haves are verified. All key links are wired. All requirement IDs are satisfied with implementation evidence. The test suite runs 18 media-specific tests with 0 failures.

The `human_needed` status reflects that 7 items require live system testing (actual WhatsApp messages, real Supabase Storage, real OpenRouter API calls) that cannot be verified through static code analysis.

---

_Verified: 2026-03-20T19:38:00Z_
_Verifier: Claude (gsd-verifier)_
