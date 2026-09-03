# Web-to-Lead Embeddable Forms (Card 9)

> Captacao de leads directamente do seu site, sem login, com submissao atomica
> via endpoint publico Directus.

## O que e

Cada form e uma entrada em `lead_capture_forms` (collection Directus) com:

- `slug` unico -> URL publica `/c/<slug>`
- `fields` (JSON array) -> define os inputs do form
- `source_label` -> vai para `leads.source`
- `assign_to_employee_id` ou `round_robin_pool` -> atribuicao
- `webhook_url` -> POST fire-and-forget apos cada submissao
- `success_message` / `redirect_url` -> UX de confirmacao

## Como criar um form

1. Em **Definicoes > Web-to-Lead**, clique em **+ Novo form**.
2. Wizard 4 passos:
   - Step 1: nome, slug, `source_label`, descricao
   - Step 2: campos (drag-to-reorder, name, label, type, required)
   - Step 3: success message, redirect URL, email de notificacao, webhook URL
   - Step 4: revisao e gravacao
3. Apos gravar, o form fica activo em `/c/<slug>`.
4. Card do form tem botao **Embed** com 2 snippets:
   - HTML inline (self-contained, depende apenas do endpoint)
   - iframe (auto-contido, mais seguro para sites externos)

## Como embedar

### Opcao A: HTML inline (recomendado para o seu proprio dominio)

```html
<!-- Cole este snippet na pagina onde quer o form -->
<div id="lead-capture"></div>
<script>
fetch('/api/public/lead-capture/contacto-hotel')
  .then(r => r.json())
  .then(meta => {
    document.getElementById('lead-capture').innerHTML = meta.html;
  });
</script>
```

Ou use diretamente o snippet HTML gerado pelo UI (botao **Embed > Copiar**).

### Opcao B: iframe (recomendado para sites externos)

```html
<iframe
  src="https://crm.seudominio.pt/c/contacto-hotel"
  width="100%"
  height="640"
  style="max-width:480px;width:100%;border:0;border-radius:12px"
  loading="lazy"
  title="Contacto Hotel"
></iframe>
```

### WordPress

1. Crie/Edite uma pagina ou post.
2. Adicione um bloco **HTML personalizado**.
3. Cole o snippet iframe (ou HTML inline).
4. Preview -> Publicar.

### Wix

1. Edite a pagina.
2. **Add > Embed > HTML iframe**.
3. Cole o snippet iframe.

### Webflow

1. Drag **Embed** component.
2. Cole o snippet iframe.

### Shopify

1. Edite uma pagina ou article.
2. Insira bloco **Custom HTML**.
3. Cole o snippet iframe.

## Como funciona a submissao

```
Browser  --POST /api/public/lead-capture/:slug-->  Directus endpoint
                                                       |
                                                       +-> ItemsService("lead_capture_forms").readByQuery (slug + is_active)
                                                       +-> validate required fields
                                                       +-> pick assignee (round-robin se nao fixo)
                                                       +-> ItemsService("leads").createOne (source=source_label, lead_data com payload)
                                                       +-> ItemsService("lead_capture_forms").updateOne (submit_count++, last_submitted_at)
                                                       +-> ItemsService("interactions").createOne (type=form_submit)
                                                       +-> fire-and-forget POST webhook_url
                                                       |
                                                       v
                                                  JSON { ok, lead_id, assigned_to, redirect_url, success_message }
```

No frontend, o script inline do snippet:

1. Recolhe `FormData` em JSON
2. `fetch(form.action, { method: POST, body: JSON })`
3. Em caso de `ok: true`:
   - Se `redirect_url` -> `window.location.href = redirect_url`
   - Caso contrario, substitui o form por painel de sucesso com `success_message`
4. Em caso de erro, mostra mensagem no `.lc-error`

## Round-robin

Se `assign_to_employee_id` for `null`, o endpoint percorre, por ordem:

1. `round_robin_pool` (array de employee_ids)
2. Se vazio, todos os employees ativos (`status=published` em `employees`)

A selecao e feita via contador in-process (`rrCounter`). Em deployments com varios
workers, isto distribui de forma aproximadamente uniforme (nao atomica). Se precisar
de coordenacao estrita, use um campo `round_robin_cursor` em `lead_capture_forms`
e `compare-and-swap` via Directus transaction.

## Webhook payload

O POST para `webhook_url` envia:

```json
{
  "event": "lead_capture.submitted",
  "lead_id": "uuid",
  "form": { "id": "uuid", "slug": "...", "name": "..." },
  "data": { "name": "...", "email": "...", "phone": "...", ... },
  "assigned_to": "uuid|null"
}
```

Use isto para:
- Integrar com Zapier / Make / n8n
- Slack notifications (`chat:write` channel)
- CRM secundario
- Mailing lists

## Mobile-first

O CSS dos snippets foi desenhado para 375px (iPhone SE) ate 768px+:

- Inputs com `width:100%`, `padding:0.5rem 0.75rem`
- Touch target minimo ~44px (botoes)
- Tema automatico via `prefers-color-scheme`
- Variaveis CSS para facil customizacao:
  - `--lc-bg`, `--lc-fg`, `--lc-muted`, `--lc-border`, `--lc-input`
  - `--lc-primary`, `--lc-primary-fg`, `--lc-radius`, `--lc-error`

Para customizar, copie o snippet e edite as CSS vars no topo.

## Seguranca

- Endpoint **publico** (sem auth) - rate-limit recomendado em reverse-proxy (nginx, Cloudflare)
- Validacao de required server-side
- `slug` tem unique index - nao ha colisao
- `is_active` desliga o form sem apagar
- Webhook fire-and-forget - falha no webhook NAO quebra a submissao
- Directus extension accountability:null em todas as chamadas

## Onboarding Wizard

A rota `/onboarding` apresenta um wizard 6 passos quando
`company_settings.onboarding_done !== true`:

1. Empresa (nome, NIF, logo URL) -> grava em `company_settings`
2. Utilizador admin -> cria `employees`
3. Primeiro pipeline -> cria um `deals` se nao existir nenhum
4. Primeiro lead demo -> cria um `leads` com source=`Onboarding Demo`
5. WhatsApp -> link para `/definicoes/whatsapp`
6. IA -> link para `/definicoes/ia-providers`

Auto-trigger: ao fazer login, se `onboarding_done` for false, redirecionar para
`/onboarding` ate `onboarding_done` ficar `true`.

Passos 5 e 6 podem ser saltados (links externos nao bloqueantes).

Progresso guardado em `company_settings.onboarding_step` (1..6).

## Schema

```sql
-- ver directus/migrations/20260903_card9_lead_capture.sql

CREATE TABLE lead_capture_forms (
  id UUID PRIMARY KEY,
  slug VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  source_label VARCHAR NOT NULL DEFAULT 'Web Form',
  fields JSONB NOT NULL,
  success_message TEXT NOT NULL,
  redirect_url TEXT,
  webhook_url TEXT,
  assign_to_employee_id UUID,
  round_robin_pool JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  embed_code_html TEXT,
  embed_code_iframe TEXT,
  submit_count INTEGER DEFAULT 0,
  last_submitted_at TIMESTAMP,
  ...
);

ALTER TABLE company_settings
  ADD COLUMN onboarding_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN onboarding_step INTEGER DEFAULT 0,
  ADD COLUMN onboarding_completed_at TIMESTAMP;
```

## Testes manuais (smoke)

1. Em **Definicoes > Web-to-Lead**, criar form "Contacto Hotel"
   - slug: `contacto-hotel`
   - source_label: `Landing Page Hotel`
   - 3 campos: nome (required), email (required), mensagem
2. Abrir `/c/contacto-hotel` (browser privado para garantir sem auth)
3. Submeter com dados reais
4. Verificar em `/leads` (filtro source=`Landing Page Hotel`) que aparece
5. No tab Submissoes da mesma definicao, contar `submit_count` incrementado

## Ficheiros

| Ficheiro | Funcao |
| --- | --- |
| `src/services/leadCapture/renderForm.ts` | Renderiza HTML standalone do form |
| `src/services/leadCapture/embedSnippets.ts` | Gera snippets HTML + iframe |
| `src/services/leadCapture/submit.ts` | Service helper (client-side) |
| `src/integrations/directus/leadCaptureForms.ts` | CRUD da collection |
| `src/integrations/directus/onboarding.ts` | Onboarding helpers |
| `src/pages/c/[slug].tsx` | Rota publica do form |
| `src/pages/onboarding.tsx` | Wizard 6 passos |
| `src/pages/settings/LeadCaptureForms.tsx` | UI de gestao |
| `directus/extensions/endpoints/lead-capture/index.js` | Endpoint POST publico |
| `directus/migrations/20260903_card9_lead_capture.sql` | Migração schema |
| `directus/collections.lead-capture.json` | Schema export Directus |
