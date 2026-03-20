# Phase 1: Agent Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Usuarios criam, configuram e gerenciam agentes IA vinculados a instancias WhatsApp, com isolamento completo por tenant. Inclui CRUD de agentes, selecao de modelo LLM, vinculacao a instancias, configuracao de tag de ativacao e multi-tenancy com RLS. Pipeline de mensagens, handoff humano e midia sao fases separadas.

</domain>

<decisions>
## Implementation Decisions

### Interface do agente
- Formulario unico em pagina dedicada (`/agentes/novo`) com todos os campos: nome, prompt do sistema, modelo, instancias, tag, aplicacao de tag
- "Agentes IA" como item de primeiro nivel no sidebar do tenant, com icone de bot/robo — feature core do produto
- Listagem em cards grid mostrando: nome, modelo, status (ativo/inativo), numero de instancias vinculadas, tag de ativacao
- Clicar no card abre pagina de edicao (`/agentes/[id]`) com mesmo formulario preenchido + botao de deletar
- Toggle global ativo/inativo no card e na pagina de edicao — quando inativo, nao processa mensagens mesmo com tags ativas

### Selecao de modelo LLM
- Dropdown/combobox onde cada opcao mostra: nome do modelo, provider, preco estimado em creditos por mensagem
- Lista de modelos curada e hardcoded no codigo (8-12 modelos) — atualizacao requer deploy mas e intencional
- Precos exibidos em creditos do wallet (ex: "~2 creditos/msg"), consistente com sistema de billing existente

### Vinculacao a instancias
- Checkbox list no formulario mostrando instancias conectadas do tenant: nome, numero, status (conectada/desconectada)
- Multiplos agentes podem ser vinculados a mesma instancia — roteamento por tag diferenciada (equipe de agentes: SDR, Closer, Financeiro, etc)
- Auto-swap de tags: ao ativar um agente pra um lead, tags de outros agentes da mesma instancia sao removidas automaticamente — so 1 agente ativo por lead por vez
- Lead nao pode acionar dois agentes simultaneamente — clean handoff entre agentes da equipe

### Comportamento de tags
- Tag de ativacao com nome livre + validacao automatica: sem espacos, lowercase, sem caracteres especiais. Preview mostra formatacao (ex: "Bot Vendas" → "bot-vendas")
- Escolha explicita no formulario via radio button: "Apenas novos chats" (default) ou "Todos os chats existentes"
- Aplicacao em massa requer dialog de confirmacao com contagem: "Aplicar tag 'bot-vendas' em X chats das instancias Y? Isso ativara o agente para todos esses leads."
- Todo chat novo nas instancias vinculadas recebe a tag automaticamente

### Claude's Discretion
- Schema do banco de dados (tabelas, colunas, indices, RLS policies)
- Layout exato do formulario e espacamento
- Componentes shadcn/ui especificos a usar
- Logica de validacao de formulario
- Loading states e error handling
- Paginacao ou scroll da listagem de agentes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements AGENT-01 a AGENT-07 e TENANT-01/02 definem o escopo exato desta fase

### Project context
- `.planning/PROJECT.md` — Constraints de stack (Next.js API Routes, Supabase, OpenRouter), decisoes de arquitetura, contexto do sistema n8n atual

### Reference docs
- `_referencia/0. PRD DEFINITIVO - SCALEFORCE v3.0.md` — PRD completo do ScaleForce com contexto de produto
- `_referencia/3. ESPECIFICACOES TECNICAS DA EVOLUTION API.md` — Specs da Evolution API para integracao com instancias

### Existing code
- `types/database.ts` — Schema atual do Supabase com todas as tabelas existentes (chats, leads, whatsapp_instances, wallets, etc)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui completo**: Buttons, Dialogs, Forms, Input, Select, Tabs, ScrollArea, Accordion — base pra todo o CRUD
- **React Hook Form + Zod**: Pattern de formulario ja estabelecido no projeto
- **Sonner**: Toast notifications ja integrado
- **Layout tenant**: Sidebar + Header com navegacao ja funcional — adicionar item "Agentes IA"

### Established Patterns
- **Multi-tenancy**: Todas as tabelas usam tenant_id com RLS — novo schema de agentes segue o mesmo padrao
- **CRUD pattern**: Paginas em `app/(tenant)/[feature]` com componentes em `components/[feature]/`
- **API routes**: Next.js App Router em `app/api/` — agentes seguem mesmo padrao
- **Tags**: Sistema de tags ja existe em `chats` e `leads` como string array — agentes usam o mesmo mecanismo
- **Supabase client**: Browser (`lib/supabase/client.ts`) e Server (`lib/supabase/server.ts`) ja configurados

### Integration Points
- **Sidebar navigation**: Adicionar "Agentes IA" ao menu do tenant
- **WhatsApp instances**: Tabela `whatsapp_instances` ja existe — vinculacao de agente referencia essa tabela
- **Tags em chats**: Campo `tags` em `chats` ja existe — tag de ativacao do agente usa esse campo
- **Wallet/billing**: Tabela `wallets` ja existe — fase 2 usara pra cobranca (nao nesta fase)
- **Webhook handler**: `app/api/webhooks/evolution/route.ts` sera estendido na fase 2 (nao nesta fase)

</code_context>

<specifics>
## Specific Ideas

- Usuario quer montar "equipe de agentes" — SDR, Closer, Financeiro, etc — todos na mesma instancia, roteados por tag. Essa e a visao central do produto.
- Auto-swap de tags garante handoff limpo entre agentes da equipe sem intervencao manual
- Cards na listagem devem ser visuais e faceis de escanear rapidamente

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-agent-foundation*
*Context gathered: 2026-03-20*
