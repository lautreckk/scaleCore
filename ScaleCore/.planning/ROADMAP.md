# Roadmap: ScaleCore AI Agents

## Overview

Substituir o workflow n8n externo por um sistema nativo de agentes IA dentro do ScaleCore. A jornada vai do CRUD de agentes e schema de banco (Phase 1), passando pelo pipeline completo de texto com buffer, memoria e cobranca (Phase 2), handoff humano para compliance (Phase 3), ate processamento e biblioteca de midia (Phase 4). Ao final, usuarios criam agentes que respondem leads no WhatsApp de forma autonoma com texto, imagem, audio e documentos.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Agent Foundation** - Database schema, CRUD de agentes, vinculacao a instancias WhatsApp e multi-tenancy
- [ ] **Phase 2: Text Pipeline** - Buffer Redis, processamento LLM via OpenRouter, memoria de conversa, resposta inteligente e cobranca por wallet
- [ ] **Phase 3: Human Handoff** - Desativacao automatica da IA quando humano assume, keywords de escalation e reativacao manual
- [ ] **Phase 4: Media** - Processamento de midia recebida (audio, imagem, PDF) e biblioteca de midia com envio decidido pela IA

## Phase Details

### Phase 1: Agent Foundation
**Goal**: Usuarios podem criar, configurar e gerenciar agentes IA vinculados a instancias WhatsApp, com isolamento completo por tenant
**Depends on**: Nothing (first phase)
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07, TENANT-01, TENANT-02
**Success Criteria** (what must be TRUE):
  1. Usuario cria um agente com nome, prompt e modelo LLM selecionado de uma lista curada com precos
  2. Usuario vincula e desvincula agentes de instancias WhatsApp sem afetar outros agentes
  3. Usuario configura tag de ativacao customizada por agente e escolhe se aplica em chats existentes ou apenas novos
  4. Usuario so ve e gerencia agentes do proprio tenant (dados isolados por RLS)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Text Pipeline
**Goal**: Agentes respondem mensagens de texto no WhatsApp de forma autonoma com buffer, memoria persistente e cobranca automatica via wallet
**Depends on**: Phase 1
**Requirements**: PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, MEM-01, MEM-02, MEM-03, BILL-01, BILL-02, BILL-03
**Success Criteria** (what must be TRUE):
  1. Lead envia texto no WhatsApp e recebe resposta da IA em mensagens separadas com delay natural e typing indicator
  2. Mensagens rapidas do mesmo lead sao agrupadas em janela de 10s antes de enviar para a IA
  3. Agente ignora leads sem a tag de ativacao e ignora mensagens do proprio atendente (fromMe)
  4. IA mantém contexto da conversa ao longo de multiplas interacoes (memoria de 50 mensagens com sliding window)
  5. Creditos sao debitados do wallet por mensagem processada, com custo variavel por modelo, e agente para se wallet insuficiente
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Human Handoff
**Goal**: Transicao segura entre IA e atendente humano com desativacao automatica e reativacao manual
**Depends on**: Phase 2
**Requirements**: HAND-01, HAND-02, HAND-03, HAND-04
**Success Criteria** (what must be TRUE):
  1. Quando atendente responde manualmente, tag de ativacao e removida e IA para de responder imediatamente
  2. Keywords de escalation configuradas pelo usuario removem tag automaticamente quando lead as digita
  3. Resumo da conversa gerado via LLM aparece como nota no chat quando humano assume
  4. Atendente pode reativar a IA adicionando a tag de volta ao chat manualmente
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Media
**Goal**: Agentes processam midia recebida (audio, imagem, PDF) e enviam midias da biblioteca quando contextualmente apropriado
**Depends on**: Phase 2
**Requirements**: MEDIA-01, MEDIA-02, MEDIA-03, LIB-01, LIB-02, LIB-03, LIB-04, LIB-05
**Success Criteria** (what must be TRUE):
  1. Lead envia audio e agente transcreve e responde ao conteudo; lead envia imagem e agente descreve e responde; lead envia PDF e agente extrai texto e responde
  2. Usuario faz upload de imagens, videos e documentos na biblioteca do agente com nome e descricao
  3. IA decide contextualmente quando enviar midias da biblioteca e o sistema detecta marcadores na resposta para enviar via Evolution API
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Agent Foundation | 0/2 | Not started | - |
| 2. Text Pipeline | 0/3 | Not started | - |
| 3. Human Handoff | 0/1 | Not started | - |
| 4. Media | 0/2 | Not started | - |
