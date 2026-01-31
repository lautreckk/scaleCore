# Sistema de Aquecimento de Chips WhatsApp

## Visao Geral

O sistema de aquecimento ("warming") e uma funcionalidade que simula uso natural das instancias WhatsApp para evitar bloqueios. Instancias do mesmo tenant conversam entre si automaticamente, trocando mensagens, audios, status e reacoes de forma humanizada.

### Por que usar o Aquecimento?

O WhatsApp monitora o comportamento dos usuarios e pode bloquear chips que:
- Ficam muito tempo inativos
- Enviam muitas mensagens comerciais sem interacao natural
- Nao tem conversas "reais" entre contatos

O aquecimento resolve isso criando atividade organica entre suas instancias.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERFACE (UI)                                  │
│  /aquecimento                                                                │
│  ├── ConfigCard (lista de configs com status e controles)                   │
│  ├── ConfigModal (criar/editar configs com 5 abas)                          │
│  ├── StatsCards (estatisticas hoje/semana/mes)                              │
│  └── ActivityLog (timeline de acoes recentes)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API ROUTES                                      │
│  /api/warming/                                                               │
│  ├── configs/           GET, POST (listar/criar configs)                    │
│  ├── configs/[id]/      GET, PUT, DELETE (gerenciar config)                 │
│  ├── configs/[id]/start POST (iniciar sessao)                               │
│  ├── configs/[id]/stop  POST (parar sessao)                                 │
│  ├── configs/[id]/pause POST (pausar/retomar)                               │
│  ├── execute/           POST (executado pelo cron a cada minuto)            │
│  ├── logs/              GET (historico de acoes)                            │
│  ├── stats/             GET (estatisticas)                                  │
│  └── templates/         GET, POST, DELETE (templates de mensagens)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WARMING PROCESSOR                                  │
│  /lib/warming/                                                               │
│  ├── processor.ts        Logica principal de processamento                  │
│  ├── action-selector.ts  Selecao de acao por peso + verificacao de limites  │
│  ├── natural-patterns.ts Delays humanizados, verificacao de horario         │
│  ├── message-generator.ts Geracao de mensagens (template ou IA)             │
│  └── ai-service.ts       Integracao com Claude Haiku                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVOLUTION API                                      │
│  /lib/evolution/client.ts                                                    │
│  ├── sendText()              Mensagens de texto                             │
│  ├── sendWhatsAppAudio()     Mensagens de voz                               │
│  ├── sendMedia()             Imagens, videos, documentos                    │
│  ├── sendStatus()            Postar status/stories                          │
│  ├── findStatusMessages()    Visualizar status de contatos                  │
│  ├── sendReaction()          Enviar reacoes (emojis)                        │
│  ├── sendPresence()          "Digitando...", "Gravando..."                  │
│  └── setInstancePresence()   Online/Offline                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE                                        │
│  Supabase PostgreSQL                                                         │
│  ├── warming_configs            Configuracoes de aquecimento                │
│  ├── warming_config_instances   Instancias participantes + contadores       │
│  ├── warming_sessions           Sessoes ativas/pausadas                     │
│  ├── warming_conversations      Threads de conversa (contexto IA)           │
│  ├── warming_action_logs        Log de todas as acoes                       │
│  └── warming_message_templates  Templates de mensagens                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Funcionamento

### 1. Criacao de Configuracao

O usuario cria uma configuracao definindo:

**Aba Geral:**
- Nome e descricao
- Selecao de instancias (minimo 2 conectadas)

**Aba Horarios:**
- Rodar 24h ou definir janela (ex: 08:00-22:00)
- Dias da semana ativos
- Fuso horario

**Aba Acoes:**
- Tipos de acao habilitados
- Peso de cada acao (define frequencia)
- Delay entre acoes (min/max em segundos)

**Aba Limites:**
- Limites diarios por instancia:
  - Mensagens: 50/dia
  - Audios: 10/dia
  - Midias: 10/dia
  - Status: 5/dia
  - Reacoes: 20/dia
- Duracao de "digitando" (min/max)

**Aba IA:**
- Habilitar geracao de mensagens com IA
- Topicos de conversa
- Tom (casual, formal, amigavel, profissional)

### 2. Inicio da Sessao

Quando o usuario clica em "Iniciar":

1. Verifica se ha pelo menos 2 instancias conectadas
2. Cria um registro em `warming_sessions` com status "running"
3. Calcula `next_action_at` baseado nos delays configurados
4. Reseta contadores diarios se necessario
5. Atualiza status da config para "active"

### 3. Processamento (Cron)

O endpoint `/api/warming/execute` e chamado a cada minuto:

```
Para cada sessao onde next_action_at <= agora:
  │
  ├── Verificar horario permitido (dias_of_week, start_time, end_time)
  │   └── Se fora do horario: reagendar para proximo minuto
  │
  ├── Resetar contadores diarios se nova data
  │
  ├── Buscar instancias conectadas
  │   └── Se < 2: erro
  │
  ├── Selecionar tipo de acao (baseado em pesos)
  │   └── Exemplo: text=50, audio=15, status=10
  │       Total: 75 → random(0-75) → cai em qual?
  │
  ├── Selecionar instancias (remetente e destinatario)
  │   └── Aleatoriamente entre as conectadas
  │
  ├── Verificar limites diarios do remetente
  │   └── Se atingiu limite: pular ou tentar outra instancia
  │
  ├── Executar acao
  │   ├── Enviar presenca ("digitando" ou "gravando")
  │   ├── Aguardar delay humanizado
  │   ├── Gerar conteudo (template ou IA)
  │   └── Executar via Evolution API
  │
  ├── Logar resultado em warming_action_logs
  │
  ├── Atualizar contadores da instancia
  │
  └── Agendar proxima acao (random entre min_delay e max_delay)
```

### 4. Tipos de Acao

| Tipo | Descricao | Presenca | Destino |
|------|-----------|----------|---------|
| `text_message` | Mensagem de texto | "composing" | Outra instancia |
| `audio_message` | Mensagem de voz | "recording" | Outra instancia |
| `image_message` | Envio de imagem | "composing" | Outra instancia |
| `video_message` | Envio de video | "composing" | Outra instancia |
| `document_message` | Envio de documento | - | Outra instancia |
| `status_post` | Postar status/story | - | Todos os contatos |
| `status_view` | Visualizar status | - | Contatos |
| `reaction` | Reagir a mensagem | - | Mensagem recente |

### 5. Geracao de Mensagens

**Modo Template (padrao):**
- Seleciona categoria baseada no contexto:
  - `saudacao` - Iniciar conversa
  - `resposta` - Responder saudacao
  - `geral` - Continuar conversa
  - `pergunta` - Fazer perguntas
  - `despedida` - Encerrar conversa
- Escolhe template aleatorio da categoria
- Templates pre-cadastrados em portugues brasileiro

**Modo IA (opcional):**
- Usa Claude Haiku (modelo rapido e barato)
- System prompt define:
  - Tom da conversa
  - Topicos permitidos
  - Limite de 2 frases
  - Girias e abreviacoes brasileiras
- Custo: ~R$0,01 por 100 mensagens

### 6. Humanizacao

O sistema simula comportamento humano:

- **Delay variavel**: Entre acoes (60-300s configuravel)
- **Digitando**: Antes de enviar texto (2-15s)
- **Gravando**: Antes de enviar audio (5-30s)
- **Horarios**: Respeita janela configurada
- **Dias**: Pode pausar fins de semana
- **Limites**: Nao exagera em quantidade

### 7. Controles de Sessao

- **Pausar**: Suspende temporariamente, mantem estado
- **Retomar**: Continua de onde parou
- **Parar**: Encerra sessao completamente

---

## Tabelas do Banco de Dados

### warming_configs
Principal tabela de configuracao.

```sql
- id, tenant_id, name, description, status
- Horarios: run_24h, start_time, end_time, days_of_week, timezone
- Acoes: *_enabled, *_weight (text, audio, image, document, video, status, reactions)
- Delays: min/max_delay_between_actions, min/max_typing_duration
- Limites: max_*_per_day (messages, audio, media, status, reactions)
- IA: use_ai_conversations, ai_topics, ai_tone, ai_language
- Stats: total_actions_executed, total_messages_sent, last_action_at
```

### warming_config_instances
Vincula instancias WhatsApp a uma config.

```sql
- id, warming_config_id, instance_id
- Contadores: messages_sent_today, audio_sent_today, media_sent_today,
              status_posted_today, reactions_sent_today
- counters_reset_date (para resetar diariamente)
- is_active, last_action_at
```

### warming_sessions
Sessoes de execucao (uma ativa por config).

```sql
- id, warming_config_id, tenant_id
- status: running | paused | completed | failed
- started_at, paused_at, completed_at
- next_action_at, next_action_type
- actions_executed, errors_count, last_error
```

### warming_conversations
Threads de conversa entre instancias (para contexto de IA).

```sql
- id, session_id, warming_config_id
- initiator_instance_id, receiver_instance_id
- status: active | completed
- topic, message_count, target_messages
- ai_context (JSONB com historico)
```

### warming_action_logs
Log completo de todas as acoes.

```sql
- id, warming_config_id, session_id, conversation_id, tenant_id
- action_type, from_instance_id, to_instance_id
- content, media_url, message_id
- status: success | failed | pending
- error_message
- ai_generated, ai_tokens_used, ai_cost_cents
- executed_at
```

### warming_message_templates
Templates de mensagens (globais ou por tenant).

```sql
- id, tenant_id (NULL = global)
- category: saudacao, resposta, geral, pergunta, despedida
- content, language
- can_start_conversation, can_continue_conversation
- is_active, usage_count
```

---

## API Endpoints

### Configuracoes

**GET /api/warming/configs**
Lista todas as configuracoes do tenant com instancias e sessao ativa.

**POST /api/warming/configs**
Cria nova configuracao.
```json
{
  "name": "Aquecimento Vendas",
  "description": "...",
  "instance_ids": ["uuid1", "uuid2"],
  "run_24h": true,
  "text_messages_enabled": true,
  "text_messages_weight": 50,
  ...
}
```

**GET /api/warming/configs/[id]**
Detalhes de uma configuracao.

**PUT /api/warming/configs/[id]**
Atualiza configuracao.

**DELETE /api/warming/configs/[id]**
Remove configuracao (para sessoes antes).

### Controle de Sessao

**POST /api/warming/configs/[id]/start**
Inicia nova sessao de aquecimento.

**POST /api/warming/configs/[id]/stop**
Para a sessao completamente.

**POST /api/warming/configs/[id]/pause**
Pausa ou retoma a sessao.

### Execucao (Cron)

**POST /api/warming/execute**
Processa sessoes pendentes. Chamado pelo cron a cada minuto.
- Header: `Authorization: Bearer {CRON_SECRET}`

### Logs e Estatisticas

**GET /api/warming/logs**
- Query: `config_id`, `session_id`, `limit`, `offset`

**GET /api/warming/stats**
- Query: `config_id`, `period` (today|week|month)

### Templates

**GET /api/warming/templates**
- Query: `category`

**POST /api/warming/templates**
```json
{
  "category": "saudacao",
  "content": "E ai, beleza?",
  "can_start_conversation": true
}
```

**DELETE /api/warming/templates?id={id}**
Remove template customizado (nao globais).

---

## Configuracao do Cron (pg_cron)

O sistema usa pg_cron + pg_net do Supabase para executar o processador a cada minuto.

### Habilitar Extensoes

No Supabase Dashboard > SQL Editor:

```sql
-- Habilitar extensoes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Funcao que chama o endpoint
CREATE OR REPLACE FUNCTION trigger_warming_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_url TEXT;
  cron_secret TEXT;
BEGIN
  app_url := current_setting('app.settings.app_url', true);
  cron_secret := current_setting('app.settings.cron_secret', true);

  PERFORM net.http_post(
    url := app_url || '/api/warming/execute',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Agendar para cada minuto
SELECT cron.schedule(
  'warming-processor',
  '* * * * *',
  'SELECT trigger_warming_processor()'
);

-- Configurar variaveis (executar uma vez)
ALTER DATABASE postgres SET app.settings.app_url = 'https://seu-app.vercel.app';
ALTER DATABASE postgres SET app.settings.cron_secret = 'seu-secret-seguro';
```

### Verificar Jobs

```sql
-- Ver jobs agendados
SELECT * FROM cron.job;

-- Ver ultimas execucoes
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Variaveis de Ambiente

### Obrigatorias para Aquecimento

```env
# Supabase (ja configuradas)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Evolution API (ja configurada)
EVOLUTION_API_URL=https://xxx
EVOLUTION_API_KEY=xxx

# Cron Secret (NOVA - para autenticar o cron)
CRON_SECRET=gerar-string-aleatoria-segura
```

### Opcionais

```env
# Anthropic API Key (para geracao de mensagens com IA)
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## Seguranca (RLS)

Todas as tabelas de aquecimento tem Row Level Security habilitado:

- **warming_configs**: Tenant pode gerenciar suas configs
- **warming_config_instances**: Baseado na config
- **warming_sessions**: Tenant pode ver suas sessoes
- **warming_conversations**: Baseado na config
- **warming_action_logs**: Tenant pode ver seus logs
- **warming_message_templates**:
  - Leitura: Templates globais (tenant_id IS NULL) + do tenant
  - Escrita: Apenas templates do tenant

---

## Boas Praticas

### Configuracao Recomendada

```
Instancias: 2-4 (mais instancias = mais natural)
Delay entre acoes: 60-300 segundos
Horario: 08:00-22:00 (horario comercial)
Dias: Segunda a Sexta

Pesos sugeridos:
- Mensagens de texto: 50
- Audios: 15
- Status: 10
- Reacoes: 5
- Imagens: 10
- Videos/Documentos: 5

Limites diarios:
- Mensagens: 30-50
- Audios: 5-10
- Midias: 5-10
- Status: 3-5
- Reacoes: 10-20
```

### Dicas

1. **Comece devagar**: Limites baixos no inicio, aumente gradualmente
2. **Varie o horario**: Nao use 24h, simule comportamento real
3. **Use IA com moderacao**: Mais natural, mas tem custo
4. **Monitore logs**: Verifique erros e ajuste
5. **Instancias novas**: Aqueca antes de campanhas em massa

---

## Troubleshooting

### "Not enough connected instances"
- Verifique se as instancias estao conectadas no WhatsApp
- Minimo 2 instancias conectadas para funcionar

### Sessao nao executa acoes
- Verifique se esta dentro do horario configurado
- Verifique se nao atingiu limites diarios
- Verifique logs de erro no Supabase

### Erro de autenticacao no cron
- Verifique se `CRON_SECRET` esta configurado
- Verifique configuracao `app.settings.cron_secret` no Supabase

### Mensagens nao naturais
- Habilite IA para conversas mais naturais
- Adicione templates customizados
- Configure topicos relevantes

---

## Custos

### Supabase
- Uso do banco de dados (dentro do plano)
- pg_cron disponivel no plano Pro+

### Anthropic (se usar IA)
- Claude Haiku: ~$0.25/1M tokens input, $1.25/1M output
- Estimativa: ~R$0,01 por 100 mensagens

### Evolution API
- Depende do seu hosting (self-hosted ou provider)
- Mensagens nao tem custo adicional
