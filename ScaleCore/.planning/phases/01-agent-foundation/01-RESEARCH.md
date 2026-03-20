# Phase 1: Agent Foundation - Research

**Researched:** 2026-03-20
**Domain:** CRUD de agentes IA com multi-tenancy, Supabase RLS, Next.js App Router
**Confidence:** HIGH

## Summary

This phase builds the agent management foundation: database schema, API routes, and UI for creating/editing/deleting AI agents linked to WhatsApp instances. The existing codebase (SenaWorks parent project) provides a complete reference implementation with established patterns for multi-tenant CRUD operations, Supabase client/server usage, sidebar navigation, and shadcn/ui components.

The technical risk is LOW because this phase involves no external API integrations at runtime (no OpenRouter calls, no Evolution API calls). It is purely database + UI + API routes, following patterns already proven in the codebase (warming configs, campaigns, automations all follow the same tenant-scoped CRUD pattern).

**Primary recommendation:** Follow the existing warming configs CRUD pattern exactly (API route auth flow, Supabase queries with tenant_id isolation, client-side data fetching with `createClient()`) and add new Supabase tables with RLS policies matching the existing multi-tenant pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Formulario unico em pagina dedicada (`/agentes/novo`) com todos os campos: nome, prompt do sistema, modelo, instancias, tag, aplicacao de tag
- "Agentes IA" como item de primeiro nivel no sidebar do tenant, com icone de bot/robo
- Listagem em cards grid mostrando: nome, modelo, status (ativo/inativo), numero de instancias vinculadas, tag de ativacao
- Clicar no card abre pagina de edicao (`/agentes/[id]`) com mesmo formulario preenchido + botao de deletar
- Toggle global ativo/inativo no card e na pagina de edicao
- Dropdown/combobox para modelo com nome, provider, preco estimado em creditos por mensagem
- Lista de modelos curada e hardcoded no codigo (8-12 modelos)
- Precos exibidos em creditos do wallet
- Checkbox list no formulario mostrando instancias conectadas do tenant
- Multiplos agentes podem ser vinculados a mesma instancia (roteamento por tag diferenciada)
- Auto-swap de tags: ao ativar um agente pra um lead, tags de outros agentes da mesma instancia sao removidas automaticamente
- Lead nao pode acionar dois agentes simultaneamente
- Tag de ativacao com nome livre + validacao automatica: sem espacos, lowercase, sem caracteres especiais. Preview mostra formatacao
- Escolha explicita via radio button: "Apenas novos chats" (default) ou "Todos os chats existentes"
- Aplicacao em massa requer dialog de confirmacao com contagem
- Todo chat novo nas instancias vinculadas recebe a tag automaticamente

### Claude's Discretion
- Schema do banco de dados (tabelas, colunas, indices, RLS policies)
- Layout exato do formulario e espacamento
- Componentes shadcn/ui especificos a usar
- Logica de validacao de formulario
- Loading states e error handling
- Paginacao ou scroll da listagem de agentes

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-01 | Usuario pode criar agente com nome, prompt do sistema e configuracoes | DB schema `ai_agents` + API POST route + form component with Zod validation |
| AGENT-02 | Usuario pode editar e deletar agentes existentes | API PATCH/DELETE routes + edit page at `/agentes/[id]` + delete confirmation dialog |
| AGENT-03 | Usuario pode selecionar modelo LLM de uma lista curada do OpenRouter (8-12 modelos com precos estimados) | Hardcoded `CURATED_MODELS` constant with model ID, name, provider, credit cost |
| AGENT-04 | Usuario pode vincular agente a 1 ou mais instancias WhatsApp conectadas | Junction table `ai_agent_instances` + checkbox list fetching from `whatsapp_instances` |
| AGENT-05 | Usuario pode desvincular agente de instancias sem afetar outros agentes | DELETE on junction table rows, independent of other agents' bindings |
| AGENT-06 | Usuario pode configurar tag de ativacao customizada por agente | `activation_tag` field with slug validation (lowercase, no spaces, no special chars) |
| AGENT-07 | Usuario pode escolher entre aplicar tag em todos os chats existentes ou apenas em novos chats | `tag_apply_mode` field ('new_only' / 'all_existing') + bulk update logic on `chats.tags` with confirmation dialog |
| TENANT-01 | Todos os dados de agentes isolados por tenant_id com RLS | RLS policies on `ai_agents` and `ai_agent_instances` matching existing pattern |
| TENANT-02 | Usuario so ve e gerencia agentes do proprio tenant | RLS + API route auth flow (getUser -> tenant_users -> tenant_id filter) |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14.2.x | App Router, API routes, pages | Already in use, all routing follows this |
| @supabase/ssr | 0.5.x | Server/client Supabase clients | Already configured in `lib/supabase/` |
| @supabase/supabase-js | 2.45.x | Supabase SDK | Already in use throughout |
| react-hook-form | 7.51.x | Form state management | Established pattern in project |
| @hookform/resolvers | 3.3.x | Zod resolver for RHF | Already in use |
| zod | 3.22.x | Schema validation | Already in use for form validation |
| sonner | 1.4.x | Toast notifications | Already integrated |
| lucide-react | 0.378.x | Icons | Already in use (Bot icon for agents) |
| tailwindcss | 3.4.x | Styling | Already configured |

### shadcn/ui Components Available
| Component | File Exists | Use For |
|-----------|-------------|---------|
| Card | Yes | Agent listing cards |
| Dialog / AlertDialog | Yes | Delete confirmation, bulk tag apply confirmation |
| Input | Yes | Agent name, tag input |
| Select | Yes | Model selection dropdown |
| Checkbox | Yes | Instance selection checkboxes |
| Switch | Yes | Active/inactive toggle |
| Label | Yes | Form labels |
| Badge | Yes | Status badges, tag preview |
| Skeleton | Yes | Loading states |
| Textarea | Yes (need to verify) | System prompt input |
| Button | Yes | Actions |
| ScrollArea | Yes | Long instance lists |
| Separator | Yes | Form sections |

### Missing shadcn/ui Components
| Component | Needed For | Action |
|-----------|------------|--------|
| RadioGroup | Tag apply mode selection ("new only" / "all existing") | Install via `npx shadcn-ui@latest add radio-group` |
| Form | RHF integration with shadcn | Install via `npx shadcn-ui@latest add form` -- check if already exists as part of hookform pattern |

**No new npm packages needed.** Everything required is already installed.

## Architecture Patterns

### Project Structure (Following Existing Convention)
```
app/(tenant)/
  agentes/
    page.tsx              # Agent listing (cards grid)
    novo/
      page.tsx            # Create agent form
    [id]/
      page.tsx            # Edit agent form
app/api/
  agents/
    route.ts              # GET (list), POST (create)
    [id]/
      route.ts            # GET (single), PATCH (update), DELETE
    [id]/tags/
      route.ts            # POST (bulk apply tags to chats)
components/
  agents/
    agent-card.tsx         # Card component for listing
    agent-form.tsx         # Shared form for create/edit
    model-selector.tsx     # Curated model dropdown
    instance-selector.tsx  # Checkbox list of instances
    tag-input.tsx          # Tag input with live preview
    delete-dialog.tsx      # Delete confirmation
    bulk-tag-dialog.tsx    # Bulk tag apply confirmation
lib/
  agents/
    models.ts             # CURATED_MODELS constant
    validation.ts         # Zod schemas
```

### Pattern 1: API Route Auth + Tenant Resolution
**What:** Every API route authenticates user, resolves tenant_id, then queries with tenant scope
**When to use:** Every API endpoint in this phase
**Example (from existing warming configs route):**
```typescript
// Source: app/api/warming/configs/route.ts (existing pattern)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Now query with tenant_id scope
  const { data, error } = await supabase
    .from("ai_agents")
    .select("*, ai_agent_instances(*, whatsapp_instances(id, name, phone_number, status))")
    .eq("tenant_id", tenantUser.tenant_id)
    .order("created_at", { ascending: false });

  // ...
}
```

### Pattern 2: Client-Side Data Fetching (Existing Pattern)
**What:** Pages are `"use client"` and fetch data via `createClient()` from `@/lib/supabase/client`
**When to use:** All tenant pages follow this pattern (aquecimento, leads, campaigns, etc.)
**Note:** The project does NOT use Server Components for data fetching in tenant pages. All tenant pages use `useEffect` + client-side Supabase. Follow this pattern, do not introduce RSC data fetching.

### Pattern 3: Sidebar Navigation
**What:** Static `navigation` array in `components/tenant/layout/sidebar.tsx`
**When to use:** Adding "Agentes IA" menu item
**Example:**
```typescript
// Add to navigation array in sidebar.tsx
{ name: "Agentes IA", href: "/agentes", icon: Bot },
```
The `Bot` icon from `lucide-react` is the appropriate choice.

### Anti-Patterns to Avoid
- **Server Components for tenant data:** The project uses client-side fetching exclusively for tenant pages. Do not introduce RSC patterns.
- **Direct Supabase calls without tenant resolution:** Always go through the auth -> tenant_users -> tenant_id flow. RLS provides defense-in-depth but the API route should also filter.
- **Creating a separate "models" table:** The curated model list is intentionally hardcoded. Do not create a database table for it.
- **Complex state management (Redux, Zustand):** The project uses simple `useState` + `useEffect`. Follow this pattern.

## Database Schema Design

### Table: `ai_agents`
```sql
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL,           -- OpenRouter model ID (e.g., "openai/gpt-4o")
  activation_tag TEXT NOT NULL,      -- Slug format: "bot-vendas"
  tag_apply_mode TEXT NOT NULL DEFAULT 'new_only', -- 'new_only' | 'all_existing'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_tag_per_tenant UNIQUE (tenant_id, activation_tag)
);

-- RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON ai_agents
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Index for tag lookups (used in Phase 2 pipeline)
CREATE INDEX idx_ai_agents_tenant_tag ON ai_agents(tenant_id, activation_tag);
CREATE INDEX idx_ai_agents_tenant_id ON ai_agents(tenant_id);
```

### Table: `ai_agent_instances` (Junction)
```sql
CREATE TABLE ai_agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_agent_instance UNIQUE (agent_id, instance_id)
);

-- RLS (through agent's tenant_id)
ALTER TABLE ai_agent_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON ai_agent_instances
  FOR ALL USING (
    agent_id IN (
      SELECT id FROM ai_agents WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX idx_ai_agent_instances_agent ON ai_agent_instances(agent_id);
CREATE INDEX idx_ai_agent_instances_instance ON ai_agent_instances(instance_id);
```

### Key Schema Decisions
- **`activation_tag` UNIQUE per tenant:** Prevents two agents from having the same tag in the same tenant (which would cause routing ambiguity in Phase 2)
- **`tag_apply_mode` stored on agent:** Controls whether the tag should be applied to existing chats when the agent is created/updated
- **No `model_name` or `model_provider` columns:** These are derived from the hardcoded `CURATED_MODELS` constant using `model_id` as the key. No data duplication.
- **`ON DELETE CASCADE` from tenants:** If a tenant is deleted, all agents and bindings are cleaned up
- **Separate junction table for instances:** Clean many-to-many relationship. Deleting agent removes all bindings. Deleting instance removes only that binding.

## Curated Models Constant

```typescript
// lib/agents/models.ts
export interface CuratedModel {
  id: string;              // OpenRouter model ID
  name: string;            // Display name
  provider: string;        // Provider name
  creditsPerMessage: number; // Estimated cost in wallet credits
  description?: string;    // Short capability note
}

export const CURATED_MODELS: CuratedModel[] = [
  // Frontier
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", creditsPerMessage: 3, description: "Melhor qualidade geral" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", creditsPerMessage: 1, description: "Rapido e economico" },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", creditsPerMessage: 3, description: "Excelente para conversas" },
  { id: "anthropic/claude-haiku-3.5", name: "Claude Haiku 3.5", provider: "Anthropic", creditsPerMessage: 1, description: "Ultra rapido" },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", creditsPerMessage: 1, description: "Rapido, bom custo-beneficio" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", creditsPerMessage: 4, description: "Raciocinio avancado" },
  // Open-source
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta", creditsPerMessage: 1, description: "Otimo open-source" },
  { id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", provider: "DeepSeek", creditsPerMessage: 1, description: "Excelente custo-beneficio" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", creditsPerMessage: 2, description: "Raciocinio profundo" },
  { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", provider: "Qwen", creditsPerMessage: 1, description: "Forte em multilingual" },
];
```

**Note:** The exact model IDs should be verified against the OpenRouter API (`GET https://openrouter.ai/api/v1/models`) before deployment. The credit values are placeholders -- the actual credit-to-USD conversion will be finalized in Phase 2 billing. For Phase 1, these are display-only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tag slug generation | Custom regex parser | Simple `.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')` | Edge cases with unicode, accents, multiple spaces |
| Form validation | Manual validation logic | Zod schema + react-hook-form resolver | Already established in project, handles all edge cases |
| Multi-tenant auth | Custom middleware | Existing tenant_users -> tenant_id lookup pattern | Proven pattern, RLS as defense-in-depth |
| Toast notifications | Custom notification system | Sonner (already installed) | Already integrated and styled |
| Confirmation dialogs | Custom modal | AlertDialog from shadcn/ui | Already installed, accessible, handles focus trapping |

## Common Pitfalls

### Pitfall 1: Tag Uniqueness Race Condition
**What goes wrong:** Two agents could be created with the same tag if requests arrive simultaneously
**Why it happens:** Application-level check before insert has a time-of-check/time-of-use gap
**How to avoid:** Use the `UNIQUE (tenant_id, activation_tag)` constraint in the database. Handle the unique violation error (Postgres error code `23505`) gracefully in the API route, returning a user-friendly message.
**Warning signs:** Duplicate tag errors in production logs

### Pitfall 2: Bulk Tag Application Performance
**What goes wrong:** Applying tags to all existing chats could be slow for tenants with thousands of chats
**Why it happens:** Updating `tags` array on each chat row individually
**How to avoid:** Use a single Supabase RPC or a bulk update query. The `chats.tags` field is `string[]` -- use Postgres array append: `tags = array_append(tags, 'new-tag')`. Filter by `instance_id IN (agent's instances)` and `NOT (tags @> ARRAY['new-tag'])` to avoid duplicates.
**Warning signs:** Timeout on bulk tag application for large tenants

### Pitfall 3: Orphaned Tags When Agent is Deleted
**What goes wrong:** Tags remain on chats after the agent that created them is deleted
**Why it happens:** No cleanup of chat tags when agent is deleted
**How to avoid:** This is actually INTENTIONAL behavior for Phase 1. Tags are data on chats, and removing them would stop the agent from responding (Phase 2). When an agent is deleted, its tags should remain on chats -- they become inert labels. Document this decision.

### Pitfall 4: RLS Policy on Junction Table
**What goes wrong:** Junction table queries fail silently (return empty) because RLS policy is too restrictive
**Why it happens:** RLS on `ai_agent_instances` needs to resolve through `ai_agents` to get `tenant_id`
**How to avoid:** Test the RLS policy with a real user token. The nested subquery `agent_id IN (SELECT id FROM ai_agents WHERE tenant_id IN (...))` must work correctly. Consider using Supabase's `.select("*, ai_agent_instances(*)")` join from the `ai_agents` table instead of querying junction table directly.

### Pitfall 5: Instance Status Stale Data
**What goes wrong:** User sees "connected" instances in the checkbox list but the instance is actually disconnected
**Why it happens:** Instance status is updated by Evolution API webhooks and may lag
**How to avoid:** Show the status from the database as-is but make it clear it's the last known status. Don't block agent creation based on instance status. An agent linked to a disconnected instance is valid (it will work when the instance reconnects).

## Code Examples

### Zod Schema for Agent Form
```typescript
// lib/agents/validation.ts
import { z } from "zod";

export const agentFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(100),
  system_prompt: z.string().min(1, "Prompt do sistema e obrigatorio").max(10000),
  model_id: z.string().min(1, "Selecione um modelo"),
  activation_tag: z.string()
    .min(1, "Tag de ativacao e obrigatoria")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Tag deve conter apenas letras minusculas, numeros e hifens"),
  tag_apply_mode: z.enum(["new_only", "all_existing"]).default("new_only"),
  instance_ids: z.array(z.string().uuid()).min(0),
  is_active: z.boolean().default(true),
});

export type AgentFormData = z.infer<typeof agentFormSchema>;
```

### Tag Slug Preview Logic
```typescript
// Helper for real-time tag preview in the form
export function slugifyTag(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

### Bulk Tag Application (Supabase RPC or direct query)
```typescript
// API route: POST /api/agents/[id]/tags
// Applies activation_tag to all existing chats on the agent's instances
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  // ... auth + tenant resolution ...

  // Get agent with its instances
  const { data: agent } = await supabase
    .from("ai_agents")
    .select("activation_tag, ai_agent_instances(instance_id)")
    .eq("id", params.id)
    .eq("tenant_id", tenantUser.tenant_id)
    .single();

  const instanceIds = agent.ai_agent_instances.map((ai: any) => ai.instance_id);

  // Count affected chats first (for confirmation dialog)
  const { count } = await supabase
    .from("chats")
    .select("id", { count: "exact", head: true })
    .in("instance_id", instanceIds)
    .not("tags", "cs", `{${agent.activation_tag}}`); // chats that DON'T already have the tag

  // Apply tag to all matching chats using Postgres array_append
  // Note: Supabase JS doesn't have array_append directly, use RPC or raw SQL
  // Recommended: Create a Supabase RPC function for this

  return NextResponse.json({ affected: count });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| n8n external workflows | Native Next.js agents | This project | Eliminates n8n dependency, reduces latency |
| Manual tag management | Automated tag assignment per agent | This project | Tags are the routing mechanism for AI agents |
| Single agent per instance | Multiple agents per instance (tag-routed) | This project | Enables "agent teams" (SDR, Closer, etc.) |

## Open Questions

1. **Supabase RPC for bulk tag operations**
   - What we know: Supabase JS client doesn't natively support `array_append` in updates
   - What's unclear: Whether to use `.rpc()` with a custom function or use the `supabase-js` workaround with raw filters
   - Recommendation: Create a simple Supabase RPC function `apply_agent_tag(instance_ids uuid[], tag text)` that does the bulk update in a single query. This is cleaner and more performant than client-side iteration.

2. **Auto-tag on new chats (webhook integration)**
   - What we know: AGENT-07 says "todo chat novo nas instancias vinculadas recebe a tag automaticamente"
   - What's unclear: This requires modifying the webhook handler, which is Phase 2 scope
   - Recommendation: In Phase 1, store the `tag_apply_mode` configuration. The automatic application on new chats will be implemented in Phase 2 when the webhook handler is extended. Phase 1 only handles the bulk retroactive application.

3. **Auto-swap tag logic (lead-level)**
   - What we know: "Ao ativar um agente pra um lead, tags de outros agentes da mesma instancia sao removidas automaticamente"
   - What's unclear: This is runtime behavior that occurs when a lead triggers an agent, which is Phase 2
   - Recommendation: Phase 1 does NOT implement auto-swap. It only stores the configuration. Auto-swap is Phase 2 pipeline logic.

4. **Updating `types/database.ts` with new tables**
   - What we know: The file is a TypeScript representation of the Supabase schema, likely auto-generated
   - What's unclear: Whether the team uses `supabase gen types` or manually maintains it
   - Recommendation: After creating the migration, manually add the new table types to `types/database.ts` following the exact same pattern as existing tables. If `supabase gen types` is available, use it instead.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test config, no test files, no test script in package.json |
| Config file | None -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Create agent with name, prompt, model | manual | Manual browser test: fill form, submit, verify in DB | N/A |
| AGENT-02 | Edit and delete agents | manual | Manual browser test: edit fields, save, delete | N/A |
| AGENT-03 | Select LLM from curated list | manual | Manual: verify dropdown shows all models with prices | N/A |
| AGENT-04 | Link agent to 1+ instances | manual | Manual: check instances in form, save, verify junction table | N/A |
| AGENT-05 | Unlink agent from instances | manual | Manual: uncheck instances, save, verify junction cleaned | N/A |
| AGENT-06 | Configure activation tag | manual | Manual: type tag, verify slug preview, save | N/A |
| AGENT-07 | Apply tag to existing vs new chats | manual | Manual: select "all existing", confirm dialog, verify chats.tags | N/A |
| TENANT-01 | RLS isolation | manual | Manual: log in as two different tenants, verify data isolation | N/A |
| TENANT-02 | Tenant-scoped visibility | manual | Manual: verify agent list only shows own agents | N/A |

### Sampling Rate
- **Per task commit:** Manual browser verification
- **Per wave merge:** Full manual walkthrough of all requirements
- **Phase gate:** All 9 requirements manually verified

### Wave 0 Gaps
- No test framework exists in the project
- Given the project uses no testing infrastructure and this is a CRUD-heavy UI phase, introducing a test framework would add significant overhead with low ROI
- Recommendation: Skip automated tests for Phase 1 (CRUD + UI), consider introducing Vitest for Phase 2 (pipeline logic with complex business rules that benefit from unit testing)

## Sources

### Primary (HIGH confidence)
- Existing codebase at `/Users/lautreck/Desktop/Trabalho/SenaWorks/` -- all patterns, stack, conventions verified by reading actual source code
- `types/database.ts` -- complete schema of existing tables (chats, leads, whatsapp_instances, wallets, etc.)
- `app/api/warming/configs/route.ts` -- reference CRUD API route pattern
- `components/tenant/layout/sidebar.tsx` -- navigation pattern and sidebar structure
- `app/(tenant)/layout.tsx` -- tenant layout with auth flow
- `lib/supabase/server.ts` and `lib/supabase/client.ts` -- Supabase client configuration

### Secondary (MEDIUM confidence)
- [OpenRouter Models API](https://openrouter.ai/docs/guides/overview/models) -- model listing endpoint and pricing structure verified via official docs
- [OpenRouter Models page](https://openrouter.ai/models) -- available models and pricing

### Tertiary (LOW confidence)
- Curated model list IDs and credit costs -- model IDs based on training knowledge of OpenRouter, should be verified against live API before deployment. Credit costs are placeholder values pending Phase 2 billing design.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use in the project, versions verified from package.json
- Architecture: HIGH -- follows existing patterns exactly (warming configs, campaigns, etc.)
- Database schema: HIGH -- follows existing multi-tenant pattern with RLS
- Pitfalls: MEDIUM -- based on general multi-tenant CRUD experience, not project-specific incidents
- Model list: LOW -- model IDs may have changed, credit costs are estimates

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- CRUD patterns don't change)
