# Requirements: ScaleCore AI Agents

**Defined:** 2026-03-19
**Core Value:** Usuarios criam agentes IA que respondem leads no WhatsApp de forma autonoma, com controle total via tags e desativacao automatica no handoff humano.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Agent Management

- [ ] **AGENT-01**: Usuario pode criar agente com nome, prompt do sistema e configuracoes
- [ ] **AGENT-02**: Usuario pode editar e deletar agentes existentes
- [ ] **AGENT-03**: Usuario pode selecionar modelo LLM de uma lista curada do OpenRouter (8-12 modelos com precos estimados)
- [ ] **AGENT-04**: Usuario pode vincular agente a 1 ou mais instancias WhatsApp conectadas
- [ ] **AGENT-05**: Usuario pode desvincular agente de instancias sem afetar outros agentes
- [ ] **AGENT-06**: Usuario pode configurar tag de ativacao customizada por agente (ex: "bot-vendas", "bot-suporte")
- [ ] **AGENT-07**: Usuario pode escolher entre aplicar tag em todos os chats existentes ou apenas em novos chats (todo chat novo ja recebe a tag automaticamente)

### Text Pipeline

- [ ] **PIPE-01**: Webhook recebe mensagem de texto e roteia para o agente vinculado a instancia
- [ ] **PIPE-02**: Buffer agrupa mensagens do mesmo lead em janela de 10 segundos antes de enviar para a IA (Upstash Redis)
- [ ] **PIPE-03**: Agente ignora mensagens de leads que nao possuem a tag de ativacao configurada
- [ ] **PIPE-04**: Agente ignora mensagens enviadas pelo proprio atendente (fromMe = true)
- [ ] **PIPE-05**: Resposta da IA e dividida em frases e enviada em mensagens separadas com delay natural entre elas
- [ ] **PIPE-06**: Typing indicator ("digitando...") exibido no WhatsApp enquanto a IA processa

### Conversation Memory

- [ ] **MEM-01**: Historico de conversa persistido por lead/telefone no Supabase com sliding window de 50 mensagens
- [ ] **MEM-02**: Memoria foca nas mensagens mais recentes para evitar alucinacao em contextos longos
- [ ] **MEM-03**: Usuario pode limpar historico de conversa de um lead via comando (ex: #limpar)

### Media Processing (Inbound)

- [ ] **MEDIA-01**: Lead envia audio e o agente transcreve via Whisper e processa como texto
- [ ] **MEDIA-02**: Lead envia imagem e o agente descreve via Vision model e processa como texto
- [ ] **MEDIA-03**: Lead envia PDF e o agente extrai texto e processa como conteudo

### Media Library (Outbound)

- [ ] **LIB-01**: Usuario pode fazer upload de imagens, videos e documentos na biblioteca de midia do agente
- [ ] **LIB-02**: Usuario pode adicionar descricao e nome a cada midia uploadada
- [ ] **LIB-03**: Lista de midias disponiveis e injetada no prompt do sistema para a IA decidir quando enviar
- [ ] **LIB-04**: IA decide contextualmente quando enviar midia baseado no prompt e na conversa
- [ ] **LIB-05**: Sistema detecta marcadores de midia na resposta da IA e envia via Evolution API (imagem, video, audio, documento)

### Human Handoff

- [ ] **HAND-01**: Quando atendente responde manualmente no chat, tag de ativacao e removida automaticamente e IA para de responder
- [ ] **HAND-02**: Resumo da conversa gerado via LLM quando humano assume (exibido como nota no chat)
- [ ] **HAND-03**: Keywords de escalation configuraveis (ex: "falar com atendente", "quero uma pessoa") removem tag automaticamente
- [ ] **HAND-04**: Atendente pode reativar a IA adicionando a tag de volta ao chat manualmente

### Billing

- [ ] **BILL-01**: Creditos debitados do wallet do tenant a cada mensagem processada pela IA
- [ ] **BILL-02**: Custo por mensagem varia conforme o modelo selecionado (modelos mais caros = mais creditos)
- [ ] **BILL-03**: Agente para de responder se wallet do tenant nao tem creditos suficientes

### Multi-tenancy

- [ ] **TENANT-01**: Todos os dados de agentes, midias, historico e configuracoes isolados por tenant_id com RLS
- [ ] **TENANT-02**: Usuario so ve e gerencia agentes do proprio tenant

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Cortex (Inteligencia de Lead)

- **CORTEX-01**: Resumir conversas em JSON estruturado com escolhas do cliente, preferencias, coisas que nao gostou
- **CORTEX-02**: Perfil comportamental do lead construido a partir do historico de conversas
- **CORTEX-03**: Cortex alimenta futuras conversas da IA com contexto rico sobre o lead

### Analytics

- **ANLY-01**: Dashboard com mensagens processadas, creditos consumidos, tempo medio de resposta
- **ANLY-02**: Metricas por agente (conversas, taxa de handoff, custo medio)

### Templates

- **TMPL-01**: Biblioteca de prompts pre-configurados para casos de uso comuns (vendas, suporte, agendamento)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Visual flow builder (drag-and-drop) | Conflita com abordagem LLM-first. Prompt IS the flow. Enorme esforco de engenharia |
| API key propria do usuario (BYO) | Quebra modelo de wallet centralizada. Pesadelo de suporte |
| Multi-channel (Instagram, Telegram) | Scope explosion. WhatsApp-first, multi-channel e v3+ |
| Tool calling / function execution | Transforma chatbot em plataforma de automacao. v2+ com pesquisa propria |
| Fine-tuning de modelos | Caro, lento, resultados piores que bom prompting. RAG-lite via prompt |
| Monitoramento real-time (live view) | Complexidade de WebSocket desnecessaria. Historico no chat existente |
| Sentiment-based auto-escalation | Deteccao de sentimento e pouco confiavel em portugues. Keywords sao mais confiaveis |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGENT-01 | Phase 1 | Pending |
| AGENT-02 | Phase 1 | Pending |
| AGENT-03 | Phase 1 | Pending |
| AGENT-04 | Phase 1 | Pending |
| AGENT-05 | Phase 1 | Pending |
| AGENT-06 | Phase 1 | Pending |
| AGENT-07 | Phase 1 | Pending |
| PIPE-01 | Phase 2 | Pending |
| PIPE-02 | Phase 2 | Pending |
| PIPE-03 | Phase 2 | Pending |
| PIPE-04 | Phase 2 | Pending |
| PIPE-05 | Phase 2 | Pending |
| PIPE-06 | Phase 2 | Pending |
| MEM-01 | Phase 2 | Pending |
| MEM-02 | Phase 2 | Pending |
| MEM-03 | Phase 2 | Pending |
| MEDIA-01 | Phase 4 | Pending |
| MEDIA-02 | Phase 4 | Pending |
| MEDIA-03 | Phase 4 | Pending |
| LIB-01 | Phase 4 | Pending |
| LIB-02 | Phase 4 | Pending |
| LIB-03 | Phase 4 | Pending |
| LIB-04 | Phase 4 | Pending |
| LIB-05 | Phase 4 | Pending |
| HAND-01 | Phase 3 | Pending |
| HAND-02 | Phase 3 | Pending |
| HAND-03 | Phase 3 | Pending |
| HAND-04 | Phase 3 | Pending |
| BILL-01 | Phase 2 | Pending |
| BILL-02 | Phase 2 | Pending |
| BILL-03 | Phase 2 | Pending |
| TENANT-01 | Phase 1 | Pending |
| TENANT-02 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
