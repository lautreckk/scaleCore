# Feature Research

**Domain:** AI WhatsApp Agent Platform (embedded in existing CRM)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Agent CRUD (name, prompt, model, config) | Every AI chatbot platform has a builder/config screen. Without it there is no product. | LOW | Simple form + DB table. Already scoped in PROJECT.md. |
| Agent-to-Instance binding | Users need to assign an agent to one or more WhatsApp numbers. This is the core activation mechanism. | LOW | Many-to-many junction table. UI is a multi-select. |
| Multi-model selection with pricing | Users expect to pick GPT-4o, Claude, Llama etc. and understand cost. OpenRouter makes this feasible. | MEDIUM | Curated list with estimated cost-per-message. Avoid exposing 200+ raw OpenRouter models -- curate 8-12. |
| Message buffering (multi-message aggregation) | Users send 2-5 messages in a row before expecting a reply. Without buffering, the AI responds to each fragment separately, creating chaos. | MEDIUM | 10s window with Upstash Redis. Already proven in n8n production flow. |
| Conversation memory | Users expect the AI to remember what was said earlier in the conversation. Stateless bots feel broken. | MEDIUM | Store last N messages per lead/phone in Supabase. 30-50 message window is standard. Sliding window, not full history. |
| Human handoff (automatic deactivation) | 80% of users will only use chatbots if they can reach a human. Mandatory for Meta compliance. | MEDIUM | Tag-based: agent only responds when tag present. Human reply removes tag, AI stops. Clear visual indicator in chat UI. |
| Text message processing and response | The absolute minimum: receive text, send to LLM, return text response. | LOW | Core pipeline: webhook -> buffer -> LLM -> Evolution API send. |
| Response splitting with delays | Sending one giant wall of text feels robotic. Users expect message-like delivery with natural pacing. | LOW | Split on sentence boundaries, send with 1-3s delays between chunks. Show typing indicator via Cloud API. |
| Wallet/credit deduction per AI message | Platform monetization. Users already understand credit-based billing from existing wallet system. | LOW | Debit on successful AI response. Show cost estimate before agent activation. |
| Typing indicator | Users see "typing..." while AI processes, reducing perceived wait time. Auto-dismissed by WhatsApp after 25s. | LOW | Single API call to Evolution API before processing. Trivial to implement. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Inbound media understanding (image/audio/PDF) | Most chatbot platforms only handle text. Understanding voice notes (Whisper), images (vision), and PDFs makes the agent actually useful for sales/support where customers send photos of products, voice messages, or documents. | HIGH | Three separate pipelines: (1) image -> vision model, (2) audio -> Whisper transcription, (3) PDF -> text extraction. Each adds latency and cost. Prioritize audio first -- voice notes are the most common non-text message in WhatsApp. |
| AI-decided media sending | Instead of rigid "if keyword then send image" rules, the AI receives a media catalog and decides contextually when to share product photos, videos, or documents. More natural than rule-based triggers. | MEDIUM | Inject media list into system prompt with IDs/descriptions. AI outputs structured markers (e.g., `[MEDIA:uuid]`). Post-processing detects and sends via Evolution API. |
| Per-agent custom activation tag | Each agent can use a different tag (not a hardcoded "I.A." status). Enables multiple agents on same instance for different purposes (sales agent, support agent) activated by different tags. | LOW | Simple config field per agent. Tag check in webhook handler. Unique to ScaleCore's tag system. |
| Uploadable media library per agent | Users upload images, videos, PDFs that the agent can reference and send. Organized per-agent, not globally. | MEDIUM | Supabase Storage with agent_id scoping. UI for upload/manage/describe media items. Descriptions are critical -- they go into the system prompt so the AI knows what to send. |
| Agent analytics dashboard | Track messages processed, credits consumed, response times, conversations handled. Helps users understand agent ROI. | MEDIUM | Aggregate from existing message/transaction logs. Charts for daily volume, cost, avg response time. |
| Conversation context summary | When human takes over from AI, provide a summary of what was discussed so the human doesn't need to read 50 messages. | MEDIUM | Generate summary via LLM when handoff occurs. Display as a pinned note in the chat. High value for sales teams. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Visual flow builder (drag-and-drop) | "I want to design conversation flows like Botpress/Typebot" | Massive engineering effort (months of work). Conflicts with the LLM-first approach -- the whole point is that the AI handles conversation flow via prompt, not rigid decision trees. Also, flow builders become unmaintainable at scale. | Good system prompt + media catalog. The prompt IS the flow. Provide prompt templates for common use cases (sales, support, booking). |
| User-provided API keys (BYO OpenRouter key) | "I want to use my own API key for cheaper access" | Breaks centralized billing/wallet model. Creates support nightmares (invalid keys, rate limits, billing disputes). Impossible to track costs accurately. Security risk storing user API keys. | Wallet with transparent per-message pricing. Show model costs upfront. Offer volume discounts. |
| Multi-channel beyond WhatsApp (Instagram, Telegram, SMS) | "I want one agent across all channels" | Scope explosion. Each channel has different APIs, rate limits, media formats, and policies. WhatsApp alone is complex enough. | Build WhatsApp-native and excellent. Multi-channel is a v3+ consideration after the core is solid. |
| Custom tool calling / function execution | "I want the AI to check inventory, create orders, query databases" | Requires sandboxed execution, error handling, security review, per-tenant API integrations. Turns a chatbot into an automation platform. Explicitly out of scope per PROJECT.md. | v1 is conversation + media only. Tool calling is a future milestone with its own research phase. |
| Fine-tuning / training on business data | "I want to train the model on my product catalog" | Fine-tuning is expensive, slow, and requires ML expertise. Results are often worse than good prompting with context injection. | RAG-lite approach: let users paste knowledge base content into the system prompt or upload reference documents that get injected as context. |
| Real-time conversation monitoring (live view) | "I want to watch AI conversations happening in real-time" | WebSocket infrastructure, significant frontend complexity, minimal actual value (users check conversations after the fact, not live). | Conversation history in existing chat view. Notification when AI handles a conversation. Review at your own pace. |
| Sentiment-based auto-escalation | "AI should detect frustration and auto-escalate" | Sentiment detection is unreliable, especially in Portuguese. False positives annoy users, false negatives miss real issues. Adds latency to every message. | Simple escalation: user says "falar com atendente" or similar keywords -> remove tag -> notify human. Keyword-based is more reliable than sentiment analysis. |

## Feature Dependencies

```
[Agent CRUD]
    |-- requires --> [Multi-model selection]
    |-- requires --> [Wallet integration]
    |
    |-- enables --> [Agent-to-Instance binding]
    |                   |
    |                   |-- enables --> [Webhook routing to agent]
    |                                      |
    |                                      |-- enables --> [Text processing pipeline]
    |                                      |                   |
    |                                      |                   |-- enables --> [Message buffering]
    |                                      |                   |-- enables --> [Conversation memory]
    |                                      |                   |-- enables --> [Response splitting]
    |                                      |                   |-- enables --> [Typing indicator]
    |                                      |
    |                                      |-- enables --> [Media processing (inbound)]
    |                                      |-- enables --> [Human handoff (tag removal)]
    |
    |-- enables --> [Media library (uploadable)]
                        |
                        |-- enables --> [AI-decided media sending]

[Conversation memory] -- enhances --> [Conversation context summary at handoff]

[Text processing pipeline] -- enables --> [Agent analytics]
[Wallet integration] -- enables --> [Agent analytics (cost tracking)]
```

### Dependency Notes

- **Agent CRUD requires Multi-model selection:** Can't create an agent without choosing a model. Model list must exist first.
- **Agent-to-Instance binding requires Agent CRUD:** Need agents before they can be bound to instances.
- **Webhook routing requires binding:** The webhook handler needs to know which agent handles which instance. This is the critical integration point with the existing webhook handler.
- **Message buffering requires text pipeline:** Buffer sits between webhook receipt and LLM call. Must have the basic pipeline before adding buffering.
- **AI-decided media sending requires Media library:** AI can only reference media that has been uploaded and described. Media library is the prerequisite.
- **Conversation summary requires Conversation memory:** Can't summarize what hasn't been stored.
- **Agent analytics requires pipeline + wallet:** Metrics come from processing logs and credit transactions.

## MVP Definition

### Launch With (v1)

Minimum viable product -- replicate the n8n agent natively with improvements.

- [x] Agent CRUD with model selection -- core entity, everything depends on this
- [x] Agent-to-Instance binding -- activation mechanism
- [x] Text message processing pipeline -- receive text, call LLM, respond
- [x] Message buffering (10s Redis window) -- proven pattern, prevents fragmented responses
- [x] Conversation memory (50 messages sliding window) -- essential for coherent conversations
- [x] Human handoff via tag system -- compliance requirement, user expectation
- [x] Response splitting with delays + typing indicator -- makes AI feel human
- [x] Wallet deduction per processed message -- monetization from day one
- [x] Per-agent activation tag -- leverages existing tag system

### Add After Validation (v1.x)

Features to add once core text pipeline is working and stable.

- [ ] Audio processing (Whisper) -- voice notes are extremely common in Brazilian WhatsApp usage. Add after text pipeline is stable.
- [ ] Image processing (vision) -- product photos, screenshots. Second most requested media type after audio.
- [ ] Media library with upload -- prerequisite for AI media sending.
- [ ] AI-decided media sending -- high-value differentiator once media library exists.
- [ ] PDF/document text extraction -- less common than audio/image but valuable for support use cases.
- [ ] Conversation summary at handoff -- quality-of-life for human agents taking over.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Agent analytics dashboard -- valuable but not blocking. Can use existing Supabase queries initially.
- [ ] Prompt templates library -- curated starting prompts for sales, support, booking scenarios.
- [ ] Multi-agent per instance (route by tag) -- advanced use case, needs careful UX design.
- [ ] Tool calling / function execution -- explicit v2+ per PROJECT.md constraints.
- [ ] Knowledge base / RAG integration -- alternative to fine-tuning, but requires vector infrastructure.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Agent CRUD + model selection | HIGH | LOW | P1 |
| Agent-to-Instance binding | HIGH | LOW | P1 |
| Text processing pipeline | HIGH | MEDIUM | P1 |
| Message buffering (Redis) | HIGH | MEDIUM | P1 |
| Conversation memory | HIGH | MEDIUM | P1 |
| Human handoff (tag-based) | HIGH | LOW | P1 |
| Response splitting + delays | MEDIUM | LOW | P1 |
| Wallet deduction | HIGH | LOW | P1 |
| Typing indicator | MEDIUM | LOW | P1 |
| Per-agent activation tag | MEDIUM | LOW | P1 |
| Audio processing (Whisper) | HIGH | MEDIUM | P2 |
| Image processing (Vision) | HIGH | MEDIUM | P2 |
| Media library + upload | MEDIUM | MEDIUM | P2 |
| AI-decided media sending | HIGH | MEDIUM | P2 |
| PDF extraction | MEDIUM | MEDIUM | P2 |
| Handoff conversation summary | MEDIUM | MEDIUM | P2 |
| Agent analytics dashboard | MEDIUM | MEDIUM | P3 |
| Prompt templates | LOW | LOW | P3 |
| Multi-agent routing | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (replaces n8n with parity + improvements)
- P2: Should have, add after text pipeline is stable (media capabilities)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Botpress | Manychat | Wati | Respond.io | ScaleCore Approach |
|---------|----------|----------|------|------------|-------------------|
| Agent builder | Visual flow builder | Visual flow builder | Template-based | Visual flow builder | Prompt-based (no flow builder). Simpler, faster, LLM-native. |
| LLM integration | Built-in, multi-model | Limited AI features | GPT integration | OpenAI integration | OpenRouter multi-model with curated list and pricing |
| Media understanding | Limited | Image/audio/video via AI | Basic | Basic | Vision + Whisper + PDF extraction (differentiator) |
| Media sending | Via flow triggers | Rule-based | Template-based | Template-based | AI-decided from uploaded catalog (differentiator) |
| Human handoff | Built-in escalation | Live chat transfer | Team inbox | Team inbox with routing | Tag-based activation/deactivation (native to CRM) |
| Message buffering | Not native | Not native | Not native | Not native | 10s Redis buffer (differentiator -- feels more natural) |
| Conversation memory | Session-based | Limited | Session-based | Cross-channel | Persistent per-lead with sliding window |
| Pricing model | Per-message + plan | Per-contact plan | Per-conversation | Per-contact | Per-AI-message via wallet (pay-as-you-go) |
| Multi-tenancy | Workspace-based | Account-based | Team-based | Workspace-based | Native RLS with tenant isolation |
| WhatsApp native | Channel adapter | Channel adapter | WhatsApp-first | Multi-channel | WhatsApp-first, built on Evolution API |

## Compliance Note: Meta WhatsApp AI Policy (January 2026)

As of January 15, 2026, Meta prohibits general-purpose AI chatbots on the WhatsApp Business Platform. ScaleCore's approach is compliant because:

1. **AI is auxiliary** to the CRM's primary business function (sales/support management)
2. **Agents are purpose-specific** -- configured with business-specific prompts for defined use cases
3. **Human handoff is always available** -- tag removal instantly stops the AI
4. **Not a standalone AI assistant** -- it's a feature within a business CRM tool

This should be documented clearly in onboarding materials to help users configure compliant agents.

## Sources

- [Kommunicate - 10 Best WhatsApp AI Chatbots 2026](https://www.kommunicate.io/blog/best-whatsapp-ai-chatbots/)
- [AeroChat - Best WhatsApp AI Chatbot Platforms 2026](https://aerochat.ai/blog/best-whatsapp-ai-chatbot)
- [Respond.io - WhatsApp 2026 AI Policy Explained](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)
- [Social Intents - AI Chatbot Human Handoff Guide 2026](https://www.socialintents.com/blog/ai-chatbot-with-human-handoff/)
- [TechCrunch - WhatsApp bars general-purpose chatbots](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)
- [Getmaxim - Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [BotSailor - Typing Indicators in WhatsApp Cloud API](https://botsailor.com/blog/new-typing-indicators-in-whatsapp-cloud-api)
- [n8n - AI WhatsApp Chatbot with Memory](https://n8n.io/workflows/3586-ai-powered-whatsapp-chatbot-for-text-voice-images-and-pdfs-with-memory/)
- [Typebot - Best WhatsApp Automation Tool 2026](https://typebot.io/blog/best-whatsapp-automation-tool)
- [TimelinesAI - WhatsApp Analytics Dashboards](https://timelines.ai/whatsapp-analytics-dashboards-key-metrics/)
- [Dev.to - Scalable Message Buffer for Natural AI Conversations](https://dev.to/einarcesar/implementing-a-scalable-message-buffer-for-natural-ai-conversations-in-n8n-poj)

---
*Feature research for: AI WhatsApp Agent Platform (ScaleCore)*
*Researched: 2026-03-19*
