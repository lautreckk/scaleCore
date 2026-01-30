# Integração Webhook - Banca Pantanal → ScaleCore CRM

## Objetivo
Permitir que o sistema Banca Pantanal envie eventos (como cadastro de novos usuários/leads) para o ScaleCore CRM via webhook.

---

## Configuração no ScaleCore

Antes de configurar o webhook no Banca Pantanal, é necessário criar uma **Lead Source** no ScaleCore:

1. Acesse o ScaleCore
2. Vá em **Leads** > **Fontes de Lead**
3. Clique em **Nova Fonte**
4. Configure:
   - **Nome**: `Banca Pantanal`
   - **Tipo**: `Webhook`
   - **Webhook Secret** (opcional): Uma chave secreta para validar a autenticidade das requisições (ex: `sua-chave-secreta-aqui`)
5. Copie o **source_id** gerado (UUID)

A URL do webhook será: `https://app.scalecore.com.br/api/webhook/{source_id}`

---

## Configuração no Banca Pantanal

Na tela de Webhooks do Banca Pantanal, configure:

| Campo | Valor |
|-------|-------|
| **Nome** | ScaleCore Lead |
| **Descrição** | Envia novos cadastros para o ScaleCore CRM |
| **URL do Endpoint** | `https://app.scalecore.com.br/api/webhook/{source_id}` |
| **Eventos** | Lead Criado (ou equivalente) |
| **Retries** | 3 |
| **Delay (s)** | 60 |
| **Timeout (s)** | 30 |
| **Ativo** | Sim |

---

## Formato do Payload

O ScaleCore espera um payload JSON via **POST** com os seguintes campos:

### Campos Principais (mapeamento automático)

```json
{
  "id": "12345",
  "name": "João da Silva",
  "email": "joao@email.com",
  "phone": "5511999999999",
  "cpf": "12345678901"
}
```

### Campos Alternativos (também reconhecidos automaticamente)

| Campo ScaleCore | Alternativas aceitas |
|-----------------|---------------------|
| `name` | `nome`, `full_name` |
| `email` | `e_mail` |
| `phone` | `telefone`, `whatsapp`, `celular` |
| `external_id` | `id` |
| `cpf` | `cpf` |

### Exemplo de Payload Completo

```json
{
  "id": "user_12345",
  "nome": "Maria Santos",
  "email": "maria@exemplo.com",
  "telefone": "5511988887777",
  "cpf": "98765432100",
  "data_cadastro": "2026-01-30T15:30:00Z",
  "origem": "site",
  "plano": "premium",
  "valor_deposito": 100.00
}
```

> **Nota**: Campos não mapeados (como `data_cadastro`, `origem`, `plano`, `valor_deposito`) são automaticamente salvos em `custom_fields` no lead.

---

## Autenticação (Opcional mas Recomendado)

Para garantir que apenas o Banca Pantanal envie dados, configure a assinatura HMAC:

### Header de Assinatura
- **Nome do Header**: `x-signature` ou `x-webhook-signature`
- **Algoritmo**: HMAC-SHA256
- **Conteúdo assinado**: Body da requisição (JSON string)

### Implementação no Banca Pantanal

```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Ao enviar o webhook
const payload = {
  id: "12345",
  nome: "João Silva",
  email: "joao@email.com",
  telefone: "5511999999999"
};

const signature = generateSignature(payload, 'sua-chave-secreta-aqui');

// Headers da requisição
const headers = {
  'Content-Type': 'application/json',
  'x-signature': signature
};
```

### Implementação em PHP

```php
<?php
function generateSignature($payload, $secret) {
    return hash_hmac('sha256', json_encode($payload), $secret);
}

$payload = [
    'id' => '12345',
    'nome' => 'João Silva',
    'email' => 'joao@email.com',
    'telefone' => '5511999999999'
];

$signature = generateSignature($payload, 'sua-chave-secreta-aqui');

$headers = [
    'Content-Type: application/json',
    'x-signature: ' . $signature
];
```

---

## Resposta do Webhook

### Sucesso (HTTP 200)

```json
{
  "success": true,
  "lead_id": "uuid-do-lead-criado"
}
```

### Erros Possíveis

| HTTP Status | Erro | Descrição |
|-------------|------|-----------|
| 404 | `Lead source not found` | O source_id não existe no ScaleCore |
| 400 | `Lead source is inactive` | A fonte de lead está desativada |
| 401 | `Invalid signature` | A assinatura HMAC é inválida |
| 500 | `Internal server error` | Erro interno no ScaleCore |

---

## Eventos Sugeridos para Implementar

| Evento | Trigger | Descrição |
|--------|---------|-----------|
| `lead.created` | Novo cadastro | Quando um novo usuário se cadastra |
| `lead.updated` | Atualização de dados | Quando um usuário atualiza seu perfil |
| `deposit.created` | Novo depósito | Quando um usuário faz um depósito |
| `withdrawal.created` | Saque solicitado | Quando um usuário solicita saque |
| `bet.placed` | Aposta realizada | Quando um usuário faz uma aposta |

### Exemplo de Payload por Evento

#### lead.created
```json
{
  "event": "lead.created",
  "timestamp": "2026-01-30T15:30:00Z",
  "data": {
    "id": "user_12345",
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "5511999999999",
    "cpf": "12345678901",
    "created_at": "2026-01-30T15:30:00Z"
  }
}
```

#### deposit.created
```json
{
  "event": "deposit.created",
  "timestamp": "2026-01-30T16:00:00Z",
  "data": {
    "user_id": "user_12345",
    "amount": 100.00,
    "currency": "BRL",
    "method": "PIX",
    "status": "completed"
  }
}
```

---

## Mapeamento de Campos Personalizado

Se o payload do Banca Pantanal tiver estrutura diferente, configure o **field_mapping** na Lead Source do ScaleCore:

```json
{
  "name": "data.nome",
  "email": "data.email",
  "phone": "data.telefone",
  "external_id": "data.id",
  "cpf": "data.cpf"
}
```

Isso permite acessar campos aninhados usando notação de ponto (ex: `data.nome`).

---

## Checklist de Implementação

### No Banca Pantanal:
- [ ] Criar serviço de envio de webhooks
- [ ] Implementar retry com backoff exponencial
- [ ] Implementar assinatura HMAC-SHA256
- [ ] Adicionar logs de envio/erro
- [ ] Criar UI para gerenciar endpoints de webhook
- [ ] Permitir seleção de eventos por webhook

### No ScaleCore (já implementado):
- [x] Endpoint para receber webhooks (`/api/webhook/[source_id]`)
- [x] Verificação de assinatura HMAC
- [x] Mapeamento flexível de campos
- [x] Upsert de leads por external_id
- [x] Log de eventos de webhook
- [x] Registro de atividades do lead

---

## Teste da Integração

Use cURL para testar:

```bash
curl -X POST "https://app.scalecore.com.br/api/webhook/{source_id}" \
  -H "Content-Type: application/json" \
  -H "x-signature: {assinatura_hmac}" \
  -d '{
    "id": "test_001",
    "nome": "Teste Integração",
    "email": "teste@email.com",
    "telefone": "5511999999999",
    "cpf": "12345678901"
  }'
```

---

## Suporte

Em caso de dúvidas sobre a integração, entre em contato:
- Email: suporte@scalecore.com.br
- Documentação: https://docs.scalecore.com.br
