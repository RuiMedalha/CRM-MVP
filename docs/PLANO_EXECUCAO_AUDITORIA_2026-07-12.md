# PLANO DE EXECUÇÃO — Auditoria CRM Premium 2026-07-11
## Validação + Priorização + Sequência de Trabalho

**Data:** 2026-07-12
**Objetivo:** Ir de "sistema com cobertura visual" (70%) para "CRM fechado para Contactos + Comunicações" em 3-6 semanas

---

## FASE 0 — Emergência (dias 1-2)

### [CRÍTICO] Código morto com erros sintáticos
**Status:** ✅ CONFIRMADO E ENGANADOR
- `AppHeader.tsx:10` — comentário HTML em JSX (erro real)
- `useEmailSend.ts` — nenhum erro (auditoria incorrecta neste)
- **Realidade:** Ficheiros órfãos; tsc encontra erro mas build passa (Vite não os inclui)
- **Acção:** Corrigir ou apagar (5 min) — tornar tsc obrigatório em CI

### [BLOQUEADOR] Fetches sem validação de resposta
**Status:** ✅ CONFIRMADO
- 3 fetches em `ComunicacoesCliente360Panel.tsx` (linhas 277, 300, 325) sem `.ok` check
- Toast diz sucesso mesmo em 400/403/404
- **Acção:** Wrap com validação + throw em não-2xx (30 min)

### [BLOQUEADOR] Motor financeiro diverge matematicamente
**Status:** ✅ CONFIRMADO E ERRADO
- `generateProposalPDF.ts:61` calcula `ivaAmt = total - subtotal` (ERRADO quando há desconto)
- 3 outras implementações com fórmulas diferentes
- **Acção:** Congelar envio de propostas até validação; criar teste de igualdade (1h)

### [CRÍTICO] Follow-up com scheduled_at invisível na Agenda
**Status:** ✅ CONFIRMADO
- `ComunicacoesCliente360Panel.tsx:306` grava `scheduled_at`
- `Agenda.tsx:62` filtra por `due_at` (campos diferentes)
- **Acção:** Homogeneizar para `due_at` + validar (30 min)

---

## FASE 1 — Estabilização Núcleo (semanas 1-3)

### Bloco A — UUIDs e Contratos Canónicos

#### A1: contactId UUID não convertido com Number(...)
**Status:** ✅ CONFIRMADO EM MÚLTIPLOS LOCAIS
- `useTelecofIdentification.ts:52` → `Number(identification.record.id)`
- `Customer360Actions.tsx:49,55,70,110,128` → 5 ocorrências de `Number(contactId)`
- **GAP CRÍTICO:** Telecof escreve `contact_id` (string), Customer360 lê `contact_int_id` (integer)
- **Acção:**
  1. Homogeneizar todo o frontend para UUID string (2 horas)
  2. Preencher `contact_int_id` quando Telecof associa contacto (30 min)
  3. Testes de contrato UUID vs Integer (1 hora)

#### A2: assigned_to como nome literal em vez de employee_id
**Status:** ✅ CONFIRMADO
- `TelecofCallWorkspace.tsx:35,107` usa `agentName = user?.first_name ?? "Agente"`
- `ComunicacoesCliente360Panel.tsx:328` grava literal
- **Acção:**
  1. Usar `assigned_employee_id: user.id` UUID (2 horas)
  2. Criar evento de auditoria `assigned_at` + `assigned_by` (1 hora)
  3. Rollback em falha (1 hora)

#### A3: Schema follow-ups com contact_id integer vs UUID
**Status:** ✅ CONFIRMADO
- `follow-ups.ts:20` comenta `integer m2o`
- Mas `interactions.ts` já tem protecção
- **Acção:**
  1. Migração SQL: ALTER follow_ups contact_id → UUID (1 hora)
  2. Aplicar validação `normalizeContactId` como interactions.ts (30 min)
  3. Testes (1 hora)

---

### Bloco B — Telecof → Customer360 Cross-Module

#### B1: Telecof escreve communication_events, Customer360 não os vê
**Status:** ✅ BLOQUEADOR CRÍTICO (via auditoria Telecof)
- Telecof escreve em `communication_events` com `resolution_note`, `hub_notes`, `hub_tags`
- Customer360 Timeline filtra por `contact_int_id` (campo não preenchido pelo Telecof)
- **GAPS identificados:**
  - GAP 1: Filtro contact_id vs contact_int_id (campos DIFERENTES)
  - GAP 2: hub_notes ficam em raw_payload JSON (opaco para timeline)
  - GAP 3: resolution_note não aparece na timeline adapter
  - GAP 4: Telecof NÃO escreve em `interactions` (Customer360 lê de lá)
  - GAP 5: Tags hub_tags invisíveis no Customer360
  - GAP 6: Telecof "Reclamar" não cria follow_up
- **Acção:**
  1. Preencher `contact_int_id` quando Telecof associa contacto (30 min)
  2. Enriquecer timeline adapter para mostrar `resolution_note` + `hub_notes` (1 hora)
  3. Validar query pede `resolution_note,raw_payload` nos fields (15 min)

#### B2: Criar contacto não liga conversation.contact_id
**Status:** ✅ CONFIRMADO
- `ComunicacoesCliente360Panel.tsx:235,259` cria contacto mas não associa
- `EmailThreadDetail.tsx:266` idem
- **Acção:**
  1. Após criar contacto (POST), fazer PATCH na conversation/thread com `contact_id` (1 hora)
  2. Usar ID do `createContact` response, não inferir (30 min)
  3. Transactional ou error boundary (30 min)

#### B3: Follow-ups criadas no Telecof não aparecem na Agenda
**Status:** ✅ CONFIRMADO
- Telecof só muda status para `callback`, não cria follow_up
- Agenda filtra `follow_ups` table
- **Acção:**
  1. Quando Telecof "Reclamar", criar `follow_up` com `{type: "call", title: "Rechamar", due_at: now + 1h, status: "open", contact_id, assigned_employee_id}` (1 hora)
  2. Usar helper `createFollowUp()` canónico (30 min)

#### B4: Dual-write Telecof → interactions
**Status:** ⚠️ COMPLEXO MAS ESSENCIAL
- Quando Telecof guarda resumo ou marca "Tratado", criar interaction com `{type: "call", external_id: communication_event.id}` para desduplicação
- **Acção:** (3 horas — para semana 2)

---

### Bloco C — Estados e Máquina de Estados Canónica

#### C1: Lead status 'new' vs Leads 360 'missed'
**Status:** ✅ CONFIRMADO
- `CreateContactForm.tsx:107` cria `status: 'new'`
- `Leads360.tsx` filtra `status = 'missed'`
- **Acção:**
  1. Definir enum único: `['new', 'contacted', 'qualified', 'disqualified', 'converted']`
  2. Migração SQL + UI (1 hora)

#### C2: Pipeline português vs Customer360 English
**Status:** ✅ CONFIRMADO
- `useDeals.ts:33-34`: Pipeline usa `ganho/perdido` (PT)
- `PipelineKanban.tsx:18`: Kanban usa `closed_won` (EN)
- **Acção:**
  1. Enum único partilhado: `['open', 'won', 'lost']`
  2. Migração + labels de apresentação (1 hora)

---

### Bloco D — Email e Comunicações

#### D1: Responder fragmenta thread (sem inReplyToMessageId Graph)
**Status:** ✅ CONFIRMADO
- `EmailThreadDetail.tsx:562,575` envia `threadIdExt` mas não `inReplyToMessageId`
- Endpoint fallback para `sendMail` novo (fragmenta)
- **Acção:**
  1. Guardar `external_message_id` em cada inbound (1 hora)
  2. Usar `/messages/{id}/reply` em vez de `sendMail` (1 hora)

#### D2: Falhas de upload silenciosas
**Status:** ✅ CONFIRMADO
- `useEmailSend.ts:33-52` não bloqueia envio se upload falha
- **Acção:**
  1. Mostrar progresso por ficheiro (1 hora)
  2. Bloquear envio se anexo obrigatório falha (30 min)

---

### Bloco E — Propostas e Idempotência

#### E1: Abrir proposta pode reenviar email (sem idempotência)
**Status:** ✅ CONFIRMADO
- Hook `orcamento-automation/index.js:31` dispara em qualquer update com `status===sent`
- PATCH `view_count` pode disparar again
- **Acção:**
  1. Adicionar check `!('status' in payload)` → skip (15 min)
  2. Usar `event_id` + `idempotency_key` únicos (1 hora)

#### E2: Motor financeiro canónico
**Status:** ✅ CONFIRMADO DIVERGENTE
- 4 implementações diferentes; uma matematicamente errada
- **Acção:**
  1. Extrair `src/lib/money/proposalEngine.ts` (2 horas)
  2. Implementação única: IVA por linha, arredondamento half-even (2 horas)
  3. Testes de igualdade editor ↔ página ↔ PDF ↔ email (2 horas)
  4. Integração em StepSend, FinancialSummary, generateProposalPDF, pdf-service (2 horas)

#### E3: Aprovação não cria deal/encomenda
**Status:** ✅ CONFIRMADO
- Workflow `quotation-approved.json:39` está `active:false`
- **Acção:**
  1. Ativar workflow e validar (1 hora)
  2. Transactional: cria deal + copia linhas/preços (2 horas)
  3. Cancelar follow-ups automaticamente (1 hora)

---

## FASE 2 — Comunicações Confiáveis (semanas 2-4)

### Bloco F — WhatsApp, Email, Channel Account ID
- F1: channel_account_id obrigatório (1-2 dias)
- F2: Delivery states persistem com provider_message_id (2 dias)
- F3: Read receipts per-agent (1 dia)

---

## FASE 3 — UX Premium (semanas 5-6)

### Bloco H — Navegação, Dark Mode, Acessibilidade
- H1: Mobile nav completo (1-2 dias)
- H2: Dark mode WCAG 4.5:1 (1 dia)
- H3: Teclado operável (1-2 dias)
- H4: Touch targets 44×44 px (1 dia)

---

## SEQUÊNCIA SEMANAL RECOMENDADA

### Semana 1 (Dias 1-5)
- **Dia 1:** Phase 0 completo (token, fetches, hook, follow-up, motor)
- **Dia 2:** Phase 0 testes + deploy
- **Dia 3:** A1 (UUID homogeneização) + A2 (assigned_employee_id)
- **Dia 4:** A3 (follow-ups migration) + B1 (contact_int_id)
- **Dia 5:** B2 (contacto → conversation) + B3 (follow-up Telecof)

### Semana 2 (Dias 6-10)
- **Dia 6:** C1 (Lead states) + C2 (Pipeline EN)
- **Dia 7:** D1 (email inReplyToMessageId) + D2 (upload)
- **Dia 8:** E1 (idempotência) + E2 (motor canónico início)
- **Dia 9:** E2 (motor cont) + E3 (aprovação → deal)
- **Dia 10:** B4 (dual-write) + Testes Phase 1

### Semana 3 (Dias 11-15)
- **Dias 11-13:** F1 + F2 + F3 (comunicações)
- **Dias 14-15:** H1 + H2 (mobile + dark mode)

---

## MÉTRICAS DE SAÍDA

### Phase 0 (Dias 1-2)
- ✅ `npm run build` verde
- ✅ `npx tsc --noEmit` zero erros
- ✅ Fetch com `.ok` check em 3+ locais
- ✅ follow_ups.due_at preenchido em todos os paths
- ✅ Hook não dispara em PATCH view_count

### Phase 1 (Semanas 1-3)
- ✅ Todos os contactId UUID string (sem Number conversão)
- ✅ communication_events com contact_int_id preenchido
- ✅ conversation.contact_id ligado após criar contacto
- ✅ follow_ups criadas no Telecof aparecem na Agenda
- ✅ assigned_employee_id UUID em todos os módulos
- ✅ Email com inReplyToMessageId não fragmenta
- ✅ Motor financeiro 1x: valores iguais editor ↔ página ↔ PDF
- ✅ Aprovação cria deal

---

## Cenários de Teste de Saída (20 cenários)

1. Follow-up WhatsApp → Agendar + Agenda → Mesmo registo
2. Atribuir conversa → Dois utilizadores → Ownership atómico
3. Criar contacto pela conversa → Reabrir → contact_id persistido
4. Criar contacto pelo email → Reabrir → contact_id persistido
5. Chamar do Customer360 → Regressar → Interaction ligada UUID
6. Guardar como Lead → Abrir Leads → Visível
7. Ganhar deal → Pipeline + ficha → KPIs iguais
8. Responder email → Outlook → Mesma thread
9. Falha de anexo → Bloquear + enviar → Erro explícito
10. Novo email → CC/BCC/template → Autosave + assinatura
11. Proposta desconto → Comparar editor/página/PDF → Totais iguais
12. Abrir proposta 2x → 2 dispositivos → 1 envio apenas
13. Aprovar proposta → Pipeline → Deal criado 1x
14. Falha n8n → Simular 500 → Estado failed + retry
15. Deep link Inbox → Abrir URL → Item carregado
16. 2 WhatsApp linhas → Filtrar → Filas separadas
17. Dark mode → Todos módulos → Sem ilhas claras
18. Tablet touch → Triar → Sem hover; 44×44 px
19. Teclado → Contactos/inbox → Sem rato
20. Pesquisa histórica → Corpo antigo → Server-side

---

## REPO DO MARK: O Que Integrar

### 3 Items com Valor (opcionais)

1. **XSS Sanitizer Allowlist** (ALTA prioridade - segurança)
   - Destino: `src/lib/htmlSanitizer.ts`
   - Usar em: `PublicQuotation.tsx` para interpolações {nome_cliente}

2. **realtimeMessages.ts** (MÉDIA prioridade - UX)
   - Destino: `src/services/realtimeMessages.ts`
   - WebSocket Directus complementa polling 3s

3. **directus-schema-snapshot.json** (BAIXA - documentação)
   - Destino: `directus/directus-schema-snapshot-v11.json`
   - Referência apenas (Directus 11 → principal está em 12)

### Tudo resto: Já no principal ou obsoleto
