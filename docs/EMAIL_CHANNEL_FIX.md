# Email Channel — Correcções Necessárias

## Problema 1: Corpos Truncados a 255 chars

**Causa:** Os workflows n8n (IDs: ZkaA5zquAFBfQuJR e LIGCJw1vKFKzMsB9)
usam `bodyPreview` do Microsoft Graph API, que é limitado a 255 chars.

**Fix no n8n:**

No nó HTTP Request que busca os emails do Graph API, mudar a query para
pedir `body` em vez de `bodyPreview`:

```
GET https://graph.microsoft.com/v1.0/me/messages/{id}
?$select=subject,from,toRecipients,body,receivedDateTime,hasAttachments
```

Depois, no nó Set/Code que mapeia para o Directus:
```js
// ANTES (truncado):
body_text: item.bodyPreview

// DEPOIS (completo):
body_text: item.body?.content?.replace(/<[^>]*>/g, '') || '' // strip HTML para texto
body_html: item.body?.content || ''                          // HTML completo
```

## Problema 2: Anexos não Gravados

**Causa:** O workflow não busca attachments do Graph API.

**Fix no n8n:**

1. No Graph API, quando `hasAttachments === true`, fazer request adicional:
```
GET https://graph.microsoft.com/v1.0/me/messages/{id}/attachments
```

2. Para cada attachment com `@odata.type === "#microsoft.graph.fileAttachment"`:
   - Upload para Directus `/files` (multipart form-data)
   - Usar HTTP Request nativo (NÃO this.helpers.httpRequest)

3. Gravar no campo `attachments` do `email_messages` (JSON):
```json
[
  {
    "file": "<directus-file-uuid>",
    "filename": "fatura.pdf",
    "mimetype": "application/pdf",
    "size": 145000
  }
]
```

## Problema 3: Identificação do Remetente

**Fix no n8n (novo nó Code):**

```js
// Após receber o email, antes de gravar:
const fromEmail = item.from?.emailAddress?.address?.toLowerCase();

// 1. Buscar contacto por email
const contacts = await fetch(
  `${env.DIRECTUS_URL}/items/contacts?filter[email][_eq]=${encodeURIComponent(fromEmail)}&limit=1&fields=id`,
  { headers: { Authorization: `Bearer ${env.DIRECTUS_TOKEN}` } }
).then(r => r.json());

let contactId = contacts.data?.[0]?.id || null;

// 2. Se não encontrou, criar lead
if (!contactId) {
  const displayName = item.from?.emailAddress?.name || '';
  const lead = await fetch(
    `${env.DIRECTUS_URL}/items/leads`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DIRECTUS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'new',
        source: 'email_inbound',
        email: fromEmail,
        display_name: displayName,
        contact_name: displayName,
      })
    }
  ).then(r => r.json());
  // Lead criado — contactId fica null no thread
}

// 3. Ligar ao email_thread
if (contactId) {
  await fetch(
    `${env.DIRECTUS_URL}/items/email_threads/${threadId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId })
    }
  );
}
```

## Problema 4: Extracção de Dados da Assinatura

**Fix no n8n (nó Code, SÓ para remetentes desconhecidos):**

```js
// Só chama IA para remetentes NÃO identificados
if (!contactId) {
  const aiResponse = await fetch(
    'https://n8n.hotelequip.pt/webhook/ai-proxy',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-proxy-token': env.AI_PROXY_TOKEN
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        messages: [{
          role: 'user',
          content: `Extrai dados de contacto desta assinatura de email (JSON):
          Campos: phone, company, role, website
          Se não encontrares, devolve null para esse campo.
          Texto:\n${bodyText.slice(-500)}`
        }],
        max_tokens: 200
      })
    }
  ).then(r => r.json());
  
  // Parse e enriquecer o lead com os dados extraídos
  const extracted = JSON.parse(aiResponse.content?.[0]?.text || '{}');
  if (extracted.phone || extracted.company) {
    await fetch(`${env.DIRECTUS_URL}/items/leads/${leadId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${env.DIRECTUS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: extracted.phone || undefined,
        contact_name: extracted.company || undefined,
        notes: `Extraído da assinatura: ${JSON.stringify(extracted)}`
      })
    });
  }
}
```

## Schema Alterações Já Feitas (nesta sessão)

- ✅ `email_messages.attachments` (json) — campo criado
- ✅ `email_threads.contact_id` — FK para contacts criada
- ✅ `email_messages.body_text` — já é tipo `text` (sem limite), o truncamento é do n8n
- ✅ `email_messages.body_html` — já existe como `text`

## Frontend: Suporte a Anexos

O componente `EmailThreadDetail.tsx` já renderiza `body_text`. Para anexos:
1. Buscar campo `attachments` na query de mensagens
2. Para cada attachment, construir URL: `${DIRECTUS_URL}/assets/${att.file}`
3. Renderizar como link clicável (mesmo padrão do WhatsApp: `resolveAttachmentMediaUrl`)

## Prioridade de Implementação

1. 🔴 n8n: body.content em vez de bodyPreview (resolve truncamento)
2. 🔴 n8n: buscar e gravar attachments
3. 🟡 n8n: identificação de remetente + criação de lead
4. 🟡 n8n: extracção de assinatura com IA (só desconhecidos)
5. 🟢 Frontend: renderizar anexos (após n8n gravar)
