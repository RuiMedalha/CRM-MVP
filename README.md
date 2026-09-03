# HotelEquip CRM OS

Sistema de gestão comercial proprietário para a **HotelEquip** — equipamentos HORECA, Gaeiras-Óbidos, Portugal.

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS + Directus v11  
**Deploy:** https://crm.hotelequip.pt  
**Branch activa:** `feat/modulo-propostas`

---

## O que é este projecto

O HotelEquip CRM OS é um CRM omnicanal desenvolvido de raiz para o processo comercial da HotelEquip. Inclui:

- 📊 **Dashboard** com leads em tempo real
- 👥 **Contactos e Pipeline** de vendas
- 🎯 **Propostas interactivas** — landing pages públicas com aprovação online
- 📋 **Orçamentos** — documentos formais PDF
- 💬 **Comunicações** — WhatsApp, Email, Instagram num só lugar
- 📧 **Newsletter** com códigos de desconto automáticos
- 🤖 **IA integrada** (Claude Haiku) para gerar textos comerciais

---

## Stack técnica

| Componente | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Backend/API | Directus v11 (PostgreSQL) |
| Automações | n8n (self-hosted) |
| WhatsApp | Evolution API (Baileys) + Meta Cloud API (WABA) |
| Email | Microsoft Graph API + Mautic |
| Pesquisa | Meilisearch |
| IA | Anthropic Claude (via proxy n8n) |
| Deploy | VPS Contabo 84.247.142.28 |

---

## Estrutura do repositório

```
src/
├── components/
│   ├── proposals/          # Módulo de propostas (8 passos + landing page)
│   │   ├── steps/          # StepClient, StepContent, StepMedia...
│   │   └── public/         # Landing page pública (cliente)
│   ├── layout/             # AppSidebar, AppLayout
│   └── ui/                 # Componentes shadcn/ui
├── contexts/
│   └── ProposalFormContext.tsx
├── integrations/
│   ├── directus/           # quotations.ts, quotationPublic.ts
│   ├── ai/                 # anthropicClient.ts
│   └── n8n/                # quotationWebhooks.ts
├── pages/
│   ├── Propostas.tsx       # Lista de propostas (PRP-)
│   ├── Orcamentos.tsx      # Lista de orçamentos (ORC-)
│   ├── ProposalDetail.tsx  # Detalhe de proposta
│   └── PublicQuotation.tsx # Landing page pública (/p/:token)
└── utils/
    └── generateProposalPDF.ts  # Geração PDF via jsPDF + html2canvas
```

---

## Variáveis de ambiente (.env.local)

```env
VITE_DIRECTUS_URL=https://api.hotelequip.pt
VITE_DIRECTUS_ADMIN_TOKEN=...
VITE_MEILISEARCH_URL=https://search.palamenta.com.pt
VITE_MEILISEARCH_SEARCH_KEY=...
VITE_MEILISEARCH_INDEX=products_palamenta
VITE_PROPOSALS_BASE_URL=https://proposta.hotelequip.pt
VITE_ANTHROPIC_API_KEY=...
```

---

## Deploy em produção

```bash
# No servidor (84.247.142.28)
cd /var/www/crm
git pull origin feat/modulo-propostas
npm install --legacy-peer-deps
npm run build
```

O nginx serve os ficheiros estáticos do `dist/` na porta 8888.  
O NPM (Nginx Proxy Manager) faz proxy de `crm.hotelequip.pt` e `proposta.hotelequip.pt` para essa porta.

---

## Módulo de Propostas

Fluxo completo:
1. Comercial cria proposta (8 passos no CRM)
2. Sistema gera link público único (`/p/:token`)
3. WhatsApp + Email enviados automaticamente via n8n
4. Cliente abre no telemóvel, vê landing page interactiva
5. Cliente aprova (com assinatura) ou recusa
6. n8n dispara workflows de follow-up automático
7. Equipa recebe alerta imediato

**Numeração:**
- Propostas: `PRP-YYYYMMDD-XXXX`
- Orçamentos: `ORC-YYYYMMDD-XXXX`

---

## Regras críticas para desenvolvimento

1. **NUNCA** criar ou alterar campos no Directus via código frontend
2. **NUNCA** chamar Meilisearch via proxy Directus — sempre directo
3. **NUNCA** expor chaves API no frontend — usar proxy n8n
4. **NUNCA** alterar ficheiros Telecof (módulo externo protegido)
5. Alterações de schema: usar `ALTER TABLE` directo no PostgreSQL via `docker exec db-hotelequip`
6. Limpar cache após alterações: `POST /utils/cache/clear`

---

## Equipa

| Pessoa | Papel |
|---|---|
| Rui Medalha | CEO / Product Owner |
| Henrique | Comercial |
| Regina | Vendas |
| Rui Jr. | Vendas |
| Mark (mainartmorettodev) | Developer externo |

---

## Links úteis

- **CRM:** https://crm.hotelequip.pt
- **API Directus:** https://api.hotelequip.pt
- **n8n:** https://n8n.hotelequip.pt
- **Propostas públicas:** https://proposta.hotelequip.pt/p/:token
- **Manual de utilizador:** Ver pasta do projecto no Google Drive

---

*HotelEquip — Equipamentos HORECA, Gaeiras-Óbidos, Portugal*  
*Repo privado — uso interno*
