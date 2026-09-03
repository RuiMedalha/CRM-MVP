# SPRINT FINAL — REGRAS ATIVAS (15/07/2026)

1. NEWSLETTER INTOCÁVEL: proibido qualquer operação (leitura para envio, escrita, teste) sobre a coleção newsletter_subscriptions e sobre os campos newsletter_*, coupon_*, consentimento e subscribed_at de contacts.
2. TESTES REAIS: emails de teste só para ruimedalha@hotelequip.pt; WhatsApp/SMS de teste só para 916542271. Nenhum outro destinatário/número, sem exceções.
3. Registos de teste levam prefixo [TESTE] e são listados no relatório para limpeza.
4. Schema Directus: alterações SEMPRE via docker exec db-hotelequip psql (nunca PATCH /fields), seguidas de POST /utils/cache/clear e 3 segundos de espera.
5. Meilisearch: https://search.palamenta.com.pt, índice products_palamenta, chamado DIRETAMENTE via fetch (nunca via proxy Directus). Campos: title, thumbnail, images[], brand, sku, ean, categories[], short_description, price, stock_status, url.
6. IA: sempre via proxy n8n https://n8n.hotelequip.pt/webhook/ai-proxy (token hotelequip-ai-2026). NUNCA chaves no frontend.
7. Entrega de cada tarefa: hash de commit real + push + outputs dos comandos de verificação. Sem evidências, a tarefa não está concluída.
8. Não refactorar código que funciona; não tocar em nada fora do âmbito do pedido.

---

# HotelEquip CRM OS — Claude Code Context

## Project Overview
CRM omnicanal para a HotelEquip (equipamento HORECA, B2B, Portugal).
React SPA + Directus v11 headless + n8n automação + Evolution API WhatsApp.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Directus v11 — https://api.hotelequip.pt
- **Automação**: n8n — https://n8n.hotelequip.pt
- **WhatsApp**: Evolution API — evolutionapp.profihotel.pt
- **Pesquisa**: Meilisearch — https://search.palamenta.com.pt (índice: products_palamenta)
- **IA**: Proxy n8n — https://n8n.hotelequip.pt/webhook/ai-proxy

## Branch activa
`feat/modulo-propostas`

## Deploy
```bash
cd /var/www/crm && git pull origin feat/modulo-propostas && npm run build && pm2 restart crm-hotelequip && pm2 restart crm-static
```

## Variáveis .env.local (ACTUAIS E CORRECTAS)
```
VITE_DIRECTUS_URL=https://api.hotelequip.pt
VITE_DIRECTUS_TOKEN=<REPLACED_WITH_NEW_TOKEN_FROM_ROTATION>
VITE_PROPOSALS_BASE_URL=https://proposta.hotelequip.pt
VITE_R2_PUBLIC_URL=https://files.hotelequip.pt
VITE_MEILISEARCH_URL=https://search.palamenta.com.pt
VITE_MEILISEARCH_SEARCH_KEY=ed7cabcddd7aeeed55e18972f4ec98dccd3c27bf78cb82962d04e1661778011e
VITE_MEILISEARCH_INDEX=products_palamenta
VITE_N8N_QUOTATION_SENT_WEBHOOK=https://n8n.hotelequip.pt/webhook/quotation-sent
VITE_N8N_QUOTATION_APPROVED_WEBHOOK=https://n8n.hotelequip.pt/webhook/quotation-approved
VITE_N8N_QUOTATION_REJECTED_WEBHOOK=https://n8n.hotelequip.pt/webhook/quotation-rejected
VITE_N8N_NEWSLETTER_WEBHOOK=https://n8n.hotelequip.pt/webhook/newsletter-subscribe
# SEM VITE_ANTHROPIC_API_KEY — IA passa sempre pelo proxy n8n
```

## ⚠️ TOKENS COMPROMETIDOS — NUNCA USAR
- `0TuAkkyjdFp8BZlKmOjc443mbQba0smF` — token Directus COMPROMETIDO/REVOGADO
- `sk-ant-api03-uwBf...` — chave Anthropic REVOGADA
- `products_stage` — índice Meilisearch ERRADO (usar `products_palamenta`)

## Regras Críticas
1. Directus devolve números como strings → usar helper `n()` de `src/components/proposals/public/utils.ts`
2. `comparison_specs` vem como JSON string → usar `parseSpecs()`
3. Meilisearch: chamar DIRECTAMENTE via fetch, NUNCA via proxy Directus
4. `getMeilisearchSettings/saveMeilisearchSettings` → importar de `@/hooks/useMeilisearch`
5. `publicFetch()` = sem token | `directusAdminFetch()` = com `VITE_DIRECTUS_ADMIN_TOKEN`
6. Imagens de produto: `objectFit: contain` (NUNCA cover)
7. PDF: Helvetica built-in, NUNCA `Font.register()` com URLs externas
8. IA/Anthropic: NUNCA colocar chaves no frontend → sempre via proxy n8n `/webhook/ai-proxy`
9. Schema Directus: alterações via `docker exec db-hotelequip psql` + `POST /utils/cache/clear`
10. Variáveis Directus: container só lê `.env` na criação → `sed` no `.env` não tem efeito

## Campos Meilisearch (índice products_palamenta)
```
id, title, url, thumbnail, images[],
brand, sku, ean, categories[],
short_description, full_description, faq,
price, regular_price, sale_price, on_sale,
stock_status, created_at
```

## Formulário Propostas — 8 Passos (ProposalStepper.tsx)
```
case 0: StepClient      — pesquisa contacto
case 1: StepContent     — produtos Meilisearch
case 2: StepMedia       — voz, vídeo, IA
case 3: StepServices    — serviços e extras
case 4: StepSettings    — validade, phone gate, termos
case 5: StepPersuasion  — score persuasão
case 6: StepPreview     — preview desktop/mobile
case 7: StepSend        — envio, QR code, WhatsApp
```

## Email Inbox
- Workflows n8n: `ZkaA5zquAFBfQuJR` (apoio.cliente@) e `LIGCJw1vKFKzMsB9` (geral@)
- Client Credentials Microsoft Graph (sem OAuth, sem MFA)
- Categorias: `EMAIL_CATEGORIES` array no topo de `src/pages/Email.tsx`
- Tabelas Directus: `email_threads`, `email_messages`, `email_attachments`

## Key Directories
```
src/
  pages/              — páginas/rotas
  components/
    ui/               — shadcn/ui
    proposals/        — módulo propostas (stepper + public)
    email/            — módulo email inbox
    layout/           — AppLayout, sidebar
  hooks/              — custom hooks
  integrations/
    directus/         — client, contacts, deals...
    ai/               — anthropicClient.ts (usa proxy n8n)
  types/              — TypeScript types
```

## Commands
```bash
npm run dev           # Dev server port 8080
npm run build         # Production build
npx tsc --noEmit      # Type-check
```
