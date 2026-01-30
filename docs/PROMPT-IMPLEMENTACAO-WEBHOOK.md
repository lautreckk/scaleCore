# PROMPT: Implementar Sistema de Webhooks para Integração Externa

## Contexto
Preciso que o sistema Banca Pantanal envie webhooks para o meu CRM (ScaleCore) quando eventos específicos ocorrerem. O ScaleCore já tem um endpoint pronto para receber os dados.

## O que precisa ser implementado

### 1. Serviço de Disparo de Webhooks

Criar um serviço que dispare HTTP POST para URLs configuradas quando eventos ocorrerem:

```typescript
// Exemplo de estrutura do serviço
interface WebhookConfig {
  id: string;
  name: string;
  url: string;           // Ex: https://api.scalecore.com/webhook/leads
  secret?: string;       // Chave para assinatura HMAC
  events: string[];      // Ex: ['lead.created', 'deposit.created']
  active: boolean;
  retries: number;       // Tentativas em caso de falha
  delay: number;         // Delay entre tentativas (segundos)
  timeout: number;       // Timeout da requisição (segundos)
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}
```

### 2. Assinatura HMAC-SHA256

O endpoint destino valida a autenticidade via header `x-signature`:

```typescript
import crypto from 'crypto';

function generateSignature(payload: object, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Ao enviar
const signature = generateSignature(payload, webhook.secret);
headers['x-signature'] = signature;
```

### 3. Eventos a Disparar

Mínimo necessário:
- **`lead.created`**: Quando um novo usuário se cadastra

Opcional (se aplicável):
- `lead.updated`: Quando dados do usuário são atualizados
- `deposit.created`: Quando um depósito é feito
- `withdrawal.created`: Quando um saque é solicitado

### 4. Formato do Payload

Para `lead.created`:
```json
{
  "event": "lead.created",
  "timestamp": "2026-01-30T15:30:00Z",
  "data": {
    "id": "12345",
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "5511999999999",
    "cpf": "12345678901",
    "created_at": "2026-01-30T15:30:00Z"
  }
}
```

**Campos obrigatórios em `data`:**
- `id` - ID único do usuário no sistema
- `nome` ou `name` - Nome completo

**Campos opcionais:**
- `email`
- `telefone`, `phone`, `whatsapp` ou `celular`
- `cpf`
- Qualquer campo adicional será salvo como metadata

### 5. Retry com Backoff Exponencial

Em caso de falha (timeout, erro 5xx), retentar com delay exponencial:

```typescript
async function sendWithRetry(webhook: WebhookConfig, payload: object) {
  let attempt = 0;

  while (attempt < webhook.retries) {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature': generateSignature(payload, webhook.secret)
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(webhook.timeout * 1000)
      });

      if (response.ok) {
        return { success: true, response: await response.json() };
      }

      // Se for erro 4xx (exceto 429), não retentar
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { success: false, error: await response.text() };
      }
    } catch (error) {
      // Timeout ou erro de rede
    }

    attempt++;
    if (attempt < webhook.retries) {
      // Delay exponencial: 60s, 120s, 240s...
      await sleep(webhook.delay * Math.pow(2, attempt - 1) * 1000);
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}
```

### 6. Tabela para Persistir Configurações

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255),
  events TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  retries INTEGER DEFAULT 3,
  delay_seconds INTEGER DEFAULT 60,
  timeout_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Log de envios para auditoria
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 1,
  success BOOLEAN,
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT NOW()
);
```

### 7. Integração nos Eventos do Sistema

Ao cadastrar novo usuário, disparar webhook:

```typescript
// Após criar usuário com sucesso
async function onUserCreated(user: User) {
  const webhooks = await getActiveWebhooks('lead.created');

  const payload = {
    event: 'lead.created',
    timestamp: new Date().toISOString(),
    data: {
      id: user.id.toString(),
      nome: user.name,
      email: user.email,
      telefone: user.phone,
      cpf: user.cpf,
      created_at: user.createdAt
    }
  };

  // Disparar de forma assíncrona (não bloquear o fluxo principal)
  for (const webhook of webhooks) {
    queueWebhookSend(webhook, payload);
  }
}
```

---

## Endpoint de Destino (ScaleCore)

**URL**: `https://app.scalecore.com.br/api/webhook/{source_id}`
**Método**: POST
**Content-Type**: application/json
**Header de Assinatura**: `x-signature`

### Resposta de Sucesso (200):
```json
{
  "success": true,
  "lead_id": "uuid-do-lead"
}
```

### Possíveis Erros:
- `404`: source_id inválido
- `401`: assinatura inválida
- `400`: fonte desativada

---

## Resumo

1. Criar tabela `webhooks` para configurações
2. Criar tabela `webhook_logs` para auditoria
3. Implementar serviço de disparo com HMAC e retry
4. Integrar no evento de cadastro de usuário
5. (Opcional) Criar UI para gerenciar webhooks

A interface de UI que você já tem na screenshot está perfeita, só precisa conectar ao backend.
