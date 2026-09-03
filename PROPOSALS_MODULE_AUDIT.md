# PROPOSALS MODULE AUDIT

**Data:** 03/07/2026
**Branch:** feature/customer360-on-propostas
**Linhas de código:** ~10.300 (52 ficheiros)

---

## 1. Estado Actual

O módulo de propostas é o mais maduro do CRM. Cobre o ciclo completo desde a criação até à aprovação pelo cliente.

### Arquitectura

```
Páginas:
  /propostas .................. Lista (PRP-*)
  /orcamentos ................. Lista (ORC-*)
  /propostas/nova ............. Stepper 8 passos
  /propostas/:id .............. Editar (mesmo stepper)
  /propostas/:id/detalhe ...... KPIs + chart visualizações
  /p/:token ................... Página pública (cliente)

Componentes:
  steps/ (8) .................. StepClient → StepContent → StepMedia → StepServices → StepSettings → StepPersuasion → StepPreview → StepSend
  public/ (24) ................ Landing page interactiva
  quotations/ (3) ............. QuotationCreator + Preview + Sidebar (modo ORC antigo)

Contexto:
  ProposalFormContext ......... Estado centralizado (useReducer + localStorage)

Integrações:
  Directus (quotations + quotation_items)
  Meilisearch (pesquisa de produtos)
  n8n (webhook quotation-sent + cancel-followups)
  AI proxy (n8n → Anthropic para termos, welcome, descrições)
  jsPDF + html2canvas (PDF template HTML)
```

### Separação ORC/PRP
- `document_type: "proposal" | "quotation"`
- ORC (Orçamento) = documento simples, sem landing interactiva
- PRP (Proposta) = documento interactivo com landing page pública
- Mesma tabela Directus, mesmo stepper, filtro por document_type nas listas

---

## 2. Pontos Fortes

| Área | Razão |
|------|-------|
| **Stepper 8 passos** | Fluxo completo e lógico: Cliente → Conteúdo → Media → Serviços → Settings → Persuasão → Preview → Enviar |
| **Pesquisa Meilisearch** | Pesquisa directa com `short_description`, `full_description`, `faq`, `brand`, SKU |
| **Comparação de produtos** | Grupos A/B/C com specs comparáveis + recomendação |
| **Landing page pública** | 24 componentes: hero, urgência, countdown, payment tabs, newsletter discount, phone gate, signature |
| **Persuasion Score** | Cálculo local (max 100) com sugestões accionáveis |
| **IA integrada** | Gerar termos, welcome message, descrição produtos, next steps — via proxy n8n |
| **PDF template** | HTML 588 linhas, 5 páginas A4, com QR code e imagens base64 |
| **Follow-ups automáticos** | 3 follow-ups configuráveis (dias, canal, mensagem) enviados via n8n |
| **Theme support** | Light/Dark/System na landing pública |
| **Newsletter discount** | Código gerado, desconto aplicável na landing |
| **Urgency banner** | Countdown real (HH:MM:SS) com JetBrains Mono |
| **Phone gate** | Verificação últimos 4 dígitos antes de ver proposta |
| **Auto-save** | localStorage no stepper (manual save ao Directus) |

---

## 3. Pontos Fracos

| Área | Problema | Gravidade |
|------|----------|----------|
| **QuotationCreator (ORC)** | 956 linhas, monolítico, duplica lógica do stepper PRP | Média |
| **QuotationPreview** | 792 linhas, UI diferente da landing pública | Baixa |
| **Sem margens** | `cost_price` existe no tipo mas nunca é mostrado nem calculado na UI | Média |
| **Sem desconto global** | `discount_percent/amount` existem mas não há UI no stepper | Baixa |
| **PDF frágil** | html2canvas com CORS issues (resolvido com base64 mas lento) | Média |
| **Sem versionamento** | Editar uma proposta enviada não cria versão — sobrepõe | Alta |
| **Sem histórico de envios** | Só guarda `sent_at` (último). Não regista re-envios | Média |
| **StepContent muito longo** | 602 linhas com pesquisa + manual + items list + comparison | Média |
| **Follow-ups não verificáveis** | Disparados via n8n mas sem confirmação de entrega no CRM | Baixa |
| **Sem assinatura digital real** | Campo texto "nome completo" na aprovação, não assinatura legal | Baixa |

---

## 4. Funcionalidades Incompletas

| Feature | Estado | O que falta |
|---------|--------|-------------|
| **Editar proposta enviada** | Funciona | Sem aviso "esta proposta já foi enviada" |
| **Duplicar proposta** | Existe função | Sem botão na UI da lista |
| **Templates** | TemplateManager + TemplatePicker existem | Não ligados ao stepper |
| **Voice message** | Campo existe | Sem upload/gravação |
| **Video embed** | Campo existe | Só mostra se URL manual |
| **Attachments** | Array no state | Sem UI de upload |
| **Reviews/testemunhos** | Tipo existe, landing suporta | Sem UI de gestão no stepper |
| **IVA por linha** | Campo `iva_percent` existe | Sem cálculo global de IVA total |
| **Descontos de campanha** | Sem suporte | Seria útil para promoções |
| **Moeda** | Hardcoded EUR | Sem campo currency |

---

## 5. Débito Técnico

| Item | Ficheiro | Impacto |
|------|----------|--------|
| QuotationCreator monolítico | quotations/QuotationCreator.tsx (956L) | Difícil manter |
| document_type como string loose | quotations.ts | Deveria ser enum no Directus |
| `as any` scattered | StepSend, QuotationForm | Type safety reduzida |
| localStorage draft pode ficar stale | ProposalFormContext | Sem TTL/cleanup |
| PDF rendering blocking UI | generateProposalPDF.ts | Deveria ser web worker ou server-side |
| Public page token em URL | /p/:token | Scraping possível (mitigado por phone gate) |
| Admin token no browser | quotationPublic.ts (directusAdminFetch) | P0 segurança |
| cleanPayload repeated | StepSend + QuotationForm | Extrair para utility |

---

## 6. Fluxos Existentes

### Criação (stepper)
```
Cliente (seleccionar/pesquisar) → Conteúdo (produtos Meilisearch + manual) → Media (video/voice placeholder) → Serviços (default + custom) → Settings (validade, phone gate, deposit, urgency, theme, termos, newsletter) → Persuasion (score calculado) → Preview (pre-visualização) → Send (rascunho ou enviar)
```

### Envio
```
Build payload → POST/PATCH quotation → POST quotation_items → sendQuotation (gera token público, PATCH status=sent) → triggerQuotationSent (n8n webhook) → Success screen (QR + link + WhatsApp share)
```

### Página pública
```
Load by token → Phone gate (se enabled) → Opening screen (cover) → Proposta (hero, urgency, welcome, products, comparison, additionals, financial, newsletter, validity, next steps, terms, payment, contact, action buttons) → Approve (signature modal) / Reject (reason modal) → respondToQuotation (PATCH status)
```

### PDF
```
Fetch template HTML → buildHtml (placeholders) → imageToBase64 (product images) → iframe render → html2canvas → jsPDF → download
```

---

## 7. Fluxos em Falta

| Flow | Prioridade | Notas |
|------|-----------|-------|
| **Versionar proposta** (v1, v2, v3) | Alta | Evitar sobrepor proposta já vista |
| **Converter proposta → encomenda** | Alta | Após aprovação, criar Order |
| **Notificação de visualização** | Média | Push/toast quando cliente abre |
| **Re-enviar proposta** | Média | Com registo de cada envio |
| **Proposta a partir do Customer360** | Média | Botão no Customer360 → stepper com cliente preenchido |
| **Proposta a partir do Pipeline** | Baixa | Já existe `createQuotationFromDeal` |
| **Relatório de propostas** | Baixa | Dashboard com taxa conversão, valor médio, tempo resposta |
| **Expiração automática** | Baixa | n8n job que marca expired quando valid_until passa |
| **Email com proposta** | Baixa | Enviar link + resumo por email (via n8n) |

---

## 8. Avaliação por Área

| Área | Veredicto | Notas |
|------|-----------|-------|
| Arquitectura geral | ✔ manter | Stepper + Context + Directus + Public page é sólido |
| UX do stepper | ✔ manter | 8 passos claros, lógica progressiva |
| Pesquisa de produtos | ✔ manter | Meilisearch directo, bom UX |
| Linhas de produto | ✔ manter | Qty, preço, desconto, imagem, ficha técnica, IA |
| Comparação A/B | ✔ manter | Diferenciador vs concorrência |
| Serviços adicionais | ✔ manter | Default services + custom |
| Termos e condições | ✔ manter | Templates + IA + custom |
| Follow-ups | ✔ manter | 3 configuráveis, n8n |
| Landing pública | ✔ manter | Premium, mobile-first, design tokens |
| Phone gate | ✔ manter | Segurança sem login |
| Newsletter discount | ✔ manter | Inovador, marketing integrado |
| Urgency countdown | ✔ manter | Persuasão eficaz |
| PDF | ⚠ melhorar | Lento, CORS fragil, deveria ser server-side |
| Payment section | ⚠ melhorar | Falta integração real (MB/MBWay geração de referências) |
| Margens/custos | ⚠ melhorar | cost_price existe mas não é utilizado |
| Versionamento | ⚠ melhorar | Criar v2 em vez de sobrepor |
| QuotationCreator (ORC) | ⚠ melhorar | Consolidar com stepper PRP |
| Templates | ⚠ melhorar | Existem mas não estão ligados ao fluxo |
| Admin token público | ✖ remover | P0 segurança — usar role pública Directus |
| QuotationPreview (ORC) | ⚠ melhorar | Unificar visual com landing page |

---

## 9. Integração com outros módulos

| Módulo | Estado actual | Nota |
|--------|--------------|------|
| **Customer360** | ✔ Funciona | Propostas listadas no painel direito |
| **Timeline** | ⚠ Parcial | ProposalSent aparece; falta ProposalViewed/Approved na timeline |
| **Email** | ⚠ Parcial | Link enviado manualmente; falta envio automático com n8n |
| **WhatsApp** | ✔ Funciona | Botão "Enviar por WhatsApp" no success screen |
| **Directus** | ✔ Funciona | CRUD completo, campos alinhados |
| **Moloni** | ⚠ Webhook apenas | Botão dispara webhook; sem feedback |
| **WooCommerce** | ⚠ Webhook apenas | Checkout webhook configurável |
| **Pipeline** | ✔ Funciona | createQuotationFromDeal + listagem por deal |

---

## 10. Recomendações (por prioridade)

### Prioridade 1 — Segurança
- [ ] Remover admin token da página pública (usar role Public Directus com read-only nos campos seguros)

### Prioridade 2 — Valor comercial
- [ ] Versionamento de propostas (v1/v2/v3)
- [ ] Converter aprovação → Order (registo formal de encomenda)
- [ ] Margens visíveis para o comercial (cost_price vs unit_price)

### Prioridade 3 — UX
- [ ] Templates ligados ao stepper (usar templates existentes)
- [ ] Proposta a partir do Customer360 com 1 clique
- [ ] Notificação push quando cliente visualiza

### Prioridade 4 — Técnico
- [ ] PDF server-side (n8n + Puppeteer) em vez de html2canvas no browser
- [ ] Consolidar ORC creator no mesmo stepper que PRP
- [ ] Extrair `cleanPayload` para utility partilhado
- [ ] Limpar localStorage drafts com TTL

### Prioridade 5 — Futuro
- [ ] Multi-moeda
- [ ] Assinatura digital legal
- [ ] Dashboard de analytics de propostas
- [ ] Expiração automática via n8n

---

*Documento de auditoria. Nenhum código foi alterado.*
