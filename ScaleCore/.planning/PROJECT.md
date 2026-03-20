# ScaleCore AI Agents

## What This Is

Sistema nativo de agentes IA dentro do ScaleCore que substitui o n8n para automacao de respostas via WhatsApp. Usuarios da plataforma criam agentes com prompts customizados, vinculam a numeros WhatsApp conectados, e a IA responde leads automaticamente com suporte a texto, imagem, audio, video e documentos. Voltado para empresas que usam WhatsApp como canal de vendas/suporte.

## Core Value

Usuarios criam e configuram agentes IA que respondem leads no WhatsApp de forma autonoma, com controle total via tags customizaveis e desativacao automatica quando um atendente humano assume.

## Requirements

### Validated

- ✓ Evolution API integrada com envio de texto, imagem, video, audio, documentos — existing
- ✓ Webhook handler recebe e processa mensagens da Evolution API — existing
- ✓ Multi-tenancy com RLS no Supabase (tenant_id) — existing
- ✓ Sistema de tags em chats e leads — existing
- ✓ Instancias WhatsApp gerenciadas com QR code e status — existing
- ✓ Sistema de wallet com creditos e cobranca por mensagem — existing
- ✓ Supabase Storage para upload de midias — existing
- ✓ Criptografia AES-256-GCM para chaves de API — existing

### Active

- [x] CRUD de agentes IA (nome, prompt, modelo, configuracoes) — Validated in Phase 01: agent-foundation
- [x] Vinculacao de agente a 1+ instancias WhatsApp — Validated in Phase 01: agent-foundation
- [x] Upload de midias (imagens, videos, links) que o agente pode disparar — Validated in Phase 04: media
- [ ] Buffer de mensagens com Redis (Upstash) — agrupa mensagens em janela de 10s
- [x] Processamento de midia recebida (vision para imagem, whisper para audio, extracao de PDF) — Validated in Phase 04: media
- [x] Controle por tag customizavel por agente — so responde leads com a tag configurada — Validated in Phase 01: agent-foundation
- [x] Desativacao automatica — atendente responder remove a tag e IA para — Validated in Phase 03: human-handoff
- [ ] Memoria de conversa persistente por lead/telefone
- [ ] Envio inteligente — divide resposta em partes, detecta midia na resposta, envia com delay
- [x] Lista curada de modelos OpenRouter (GPT-4o, Claude, Llama, etc) com preco estimado — Validated in Phase 01: agent-foundation
- [ ] Cobranca via wallet centralizada por mensagem processada pela IA
- [x] IA decide quando enviar midias uploadadas (recebe lista no prompt do sistema) — Validated in Phase 04: media

### Out of Scope

- n8n ou qualquer ferramenta de automacao externa — substituido por sistema nativo
- API key propria do usuario para OpenRouter — sistema usa wallet centralizada
- Supabase Edge Functions — processamento fica nas API routes do Next.js
- Treinamento/fine-tuning de modelos — usa modelos prontos do OpenRouter
- Agentes com multiplas tools/funcoes customizadas — v1 foca em conversacao + midia
- Modal workers para processamento de agentes — reservado para campanhas

## Context

### Sistema Atual (n8n)
O agente n8n atual implementa o fluxo completo:
1. Webhook recebe mensagem → extrai variaveis globais (telefone, nome, tipo, instance)
2. Switch por tipo de mensagem: texto, imagem (GPT-4o-mini vision), audio (Whisper), PDF (extracao)
3. Buffer Redis: push mensagem → wait 10s → compara se parou de digitar → junta todas
4. Verifica status "I.A" no lead — so processa se ativo
5. AI Agent com OpenRouter + Postgres Chat Memory (50 mensagens contexto por telefone)
6. Divide resposta em frases, detecta URLs de midia, envia via Evolution API com delay
7. Salva historico no Supabase

### Infraestrutura Existente
- **Next.js 14.2** com App Router — API routes processam webhooks
- **Supabase** — banco PostgreSQL com RLS, auth, storage
- **Evolution API v2.3** — cliente completo em `/lib/evolution/client.ts` (~812 linhas)
- **Webhook handler** — `/app/api/webhooks/evolution/route.ts` (~1093 linhas)
- **EasyPanel** — hospedagem com Docker (ja roda Evolution API, n8n)
- **Warming module** — `/lib/warming/` ja usa Anthropic Claude para gerar mensagens

### Dados Relevantes do Webhook
O webhook da Evolution API envia: `event`, `instance`, `data.key.remoteJid`, `data.pushName`, `data.message`, `data.messageType`, `data.key.fromMe`, `server_url`, `apikey`.

## Constraints

- **Tech Stack**: Next.js API Routes (sem infra adicional) + Upstash Redis (buffer) + Supabase (banco/storage)
- **LLM Provider**: OpenRouter exclusivamente — lista curada de modelos com precos
- **Buffer**: 10 segundos de janela para agrupar mensagens antes de enviar pra IA
- **Custo**: Cobranca via wallet existente — debitar creditos por mensagem de IA processada
- **Multi-tenancy**: Todo dado isolado por tenant_id com RLS — agentes, midias, historico
- **Compatibilidade**: Webhook handler existente deve ser estendido, nao substituido

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Upstash Redis para buffer | Serverless, free tier 10K req/dia, sem servidor 24h | — Pending |
| Next.js API Routes (nao Edge Functions) | Ja existe, webhook ja aponta pra la, zero custo extra | — Pending |
| Wallet centralizada (nao API key do usuario) | Simplifica UX, monetizacao integrada, controle de custos | — Pending |
| Tag customizavel por agente (nao campo status) | Flexibilidade — cada agente pode ter sua propria tag de ativacao | — Pending |
| Lista curada de modelos OpenRouter | Evita confusao com 100+ modelos, mostra precos estimados | — Pending |
| IA decide envio de midia (nao gatilhos manuais) | Mais natural, IA recebe lista de midias no prompt e decide contexto | — Pending |
| Buffer de 10s fixo | Mesmo comportamento do n8n atual, comprovado em producao | — Pending |

---
*Last updated: 2026-03-20 after Phase 04 (media) complete — all milestone phases done*
