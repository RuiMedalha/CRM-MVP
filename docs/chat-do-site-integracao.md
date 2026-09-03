# Chat do Site (AskMe) — Integração

> Documento técnico da ligação do canal "Chat do site" ao CRM.

---

## Arquitectura

```
Visitante (WordPress)  →  WP Flow (IA do chat)  →  Bridge WP  →  Directus (conversations/messages)
                                                                        ↕
                                                                  CRM Frontend
                                                                        ↕
                                                              campaign-sender.js
                                                                        ↕
                                                              WP Flow Admin API
```

### Fluxo de entrada (visitante → CRM)

1. Visitante escreve no chat do site (WordPress).
2. O plugin WP Flow gere a conversa com IA e faz bridge para o Directus:
   - Cria/atualiza `conversations` com `channel: "askme"` e `source: <session_id>`.
   - Cria `messages` com o conteúdo.
3. O CRM polling já busca conversas `channel=askme` (em `conversationPolling.ts`).
4. O operador vê a conversa na aba "Chat do site" das Comunicações.

### Fluxo de saída (CRM → visitante)

1. O operador escreve no MessageInput (canal askme).
2. O CRM envia `POST /campaign-api/chat-reply` com `{ session_id, text, agent_name }`.
3. O `campaign-sender.js` reencaminha para `POST /wp-json/wp-flow/v1/admin/sessions/{id}/reply`.
4. O visitante vê a resposta no chat do site.

### Takeover / Release

- **Assumir conversa**: botão "Assumir conversa" → Directus status `human_active` + `POST /campaign-api/chat-takeover`
  - O WP Flow pausa a IA para esta sessão.
- **Devolver à IA**: botão "Reativar IA" → Directus status `ai_active` + `POST /campaign-api/chat-release`
  - O WP Flow retoma o bot.

---

## Ficheiros relevantes

| Ficheiro | Papel |
|---|---|
| `src/integrations/directus/siteChat.ts` | Client-side: `sendSiteChatReply`, `siteChatTakeover`, `siteChatRelease` |
| `deploy/campaign-sender.js` | Servidor: proxy para WP Flow, campanhas email, envio transacional |
| `deploy/campaign-sender.config.example.json` | Configuração exemplo (sem segredos) |
| `src/components/communications/MessageInput.tsx` | Envio de mensagens (routing askme vs WhatsApp) |
| `src/hooks/useConversationOperations.ts` | Operações assume/reactivate com takeover/release WP Flow |
| `src/services/conversationPolling.ts` | Polling que já busca `channel=askme` |
| `src/lib/channelRegistry.ts` | Registry onde askme está registado |
| `src/components/communications/ComunicacoesChannelsSidebar.tsx` | Sidebar com aba "Chat do site" |

---

## Configuração (deploy)

### campaign-sender

O micro-serviço corre em `127.0.0.1:8097` na VPS, atrás de nginx em `/campaign-api/`.

Configuração: `/opt/crm-campaign-sender/config.json` (ver `deploy/campaign-sender.config.example.json`).

Campos essenciais para o chat do site:

```json
{
  "wpflowBase": "https://hotelequip.palamenta.com.pt",
  "wpflowToken": "<token da API admin do WP Flow>"
}
```

### SMTP

Nota: o SMTP (`smtp.*` no config) ainda **não está configurado** — campanhas e emails transacionais dependem disso. O chat do site funciona sem SMTP (usa apenas a API REST do WP Flow).

---

## O que funciona já

- ✅ Conversas askme aparecem na aba "Chat do site"
- ✅ Polling busca conversas com `channel=askme` e `last_message` não nulo
- ✅ MessageInput routing para askme (envia via `/campaign-api/chat-reply`)
- ✅ Assumir conversa faz takeover no WP Flow
- ✅ Reativar IA faz release no WP Flow
- ✅ Envio de ficheiros bloqueado para askme (só texto suportado)

## O que NÃO está feito (fora de âmbito)

- ❌ Schema Directus (já existe, não mexemos)
- ❌ SMTP real (precisa de configuração na VPS)
- ❌ Lado WordPress (plugin WP Flow já existe e já faz bridge)
- ❌ Notificações push para novas mensagens askme (usa polling existente)

---

## Segurança

- O token WP Flow fica **apenas no servidor** (campaign-sender), nunca no frontend.
- O frontend usa o token admin Directus como credencial para o campaign-sender (`x-directus-token`).
- O campaign-sender valida esse token antes de reencaminhar.
- Sem chaves de IA no frontend.
