# ✅ AUDITORIA CRM PREMIUM — RESUMO EXECUTIVO
## O que temos de fazer — Começar segunda-feira

**Data:** 2026-07-12 (Sexta) | **Status:** Validação 100% concluída | **Veredicto:** Produção **NÃO** segura até Phase 0 ✅

---

## 🎯 EM 1 PÁGINA: O Essencial

A auditoria **identifica correctamente os problemas**. São 5 bloqueadores P0 que impedem confiança premium:

### ❌ 5 Problemas Confirmados (em 4 horas de trabalho)

1. **Token revogado hardcoded** — scripts/setup-quotation-schema.ts:11
   - Risco: Se script roda em produção, usa credencial comprometida
   - Fix: 2 min — remover ou usar env var

2. **UUIDs vs Integers incompatíveis** — contacts.id é UUID, mas deals/follow-ups/quotations usam INTEGER FKs
   - Risco: Integrações e follow-ups ficam órfãs (NaN)
   - Fix: 2h — migração SQL + validação frontend

3. **Motor financeiro em 4 sítios diferentes** — €100×2 com 10% = €180 vs €221 vs €246
   - Risco: Proposta mostra montantes diferentes ao vendedor e cliente
   - Fix: 4h — centralizar em `financialEngine.ts`

4. **Hook reenvio sem proteção** — Abrir proposta pode reenviar email
   - Risco: Cliente recebe proposta 2x ou 3x
   - Fix: 1h — adicionar `old_status != sent` check + idempotency_key

5. **Follow-up invisível na Agenda** — Telecof escreve scheduled_at/pending, Agenda lê due_at/open
   - Risco: Compromissos com clientes desaparecem
   - Fix: 30 min — homogeneizar para `due_at` everywhere

---

## 🚀 ROADMAP: 3 Fases × 6 Semanas

### **FASE 0 — Emergência (Dias 1-2) ⏰**
Corrigir bloqueadores que impedem confiança:
- ✅ Remover token revogado + validar env vars
- ✅ Adicionar response.ok check em 3 fetches críticos
- ✅ Congelar envio de propostas até motor financeiro unificado
- ✅ Hook com old_status != sent check
- ✅ Follow-up with due_at em todos os paths

**Saída:** Sem segredos expostos; fetch com validação; propostas com totais iguais

---

### **FASE 1 — Unificação Núcleo (Semanas 1-3) 📐**
Garantir que cada acção escreve no sítio certo, persiste, é auditável:
- ✅ UUIDs: Homogeneizar contacts UUID em toda a app (sem Number())
- ✅ Cross-module: Telecof → Customer360 (contact_int_id preenchido)
- ✅ Contacto cria conversation.contact_id automaticamente
- ✅ Follow-up Telecof aparece na Agenda
- ✅ assigned_employee_id UUID em todos os módulos
- ✅ Email replies usam inReplyToMessageId (não fragmenta)
- ✅ Upload validado; nunca silencioso
- ✅ Motor financeiro único (4 implementações → 1)
- ✅ Aprovação proposta → Deal/Encomenda automático

**Saída:** Fluxos persistem após reload; dados aparecem em todos os módulos ligados

---

### **FASE 2 — Comunicações Confiáveis (Semanas 2-4) 💬**
(Paralelo a Fase 1.5)
- WhatsApp: channel_account_id obrigatório (evita trocar de conta)
- Delivery: estados persistem (sent/delivered/read/failed)
- Read receipts: per-agent (não marca tudo como lido)

**Saída:** Omnicanal sem risco de trocar de conta; entrega rastreável

---

### **FASE 3 — UX Premium (Semanas 5-6) 🎨**
(Depende de Fases 1-2 > 95%)
- Mobile nav completo (todos os módulos acessíveis)
- Dark mode: Contraste WCAG 4.5:1 mínimo
- Teclado: Sem rato necessário em contactos/inbox
- Touch: Alvos 44×44 px, sem hover dependencies

**Saída:** Premium UX; pronto para operação 8h+ diária

---

## 📊 Estado Actual vs Esperado

| Dimensão | Actual | Esperado (Fase 1) | Fase 3 |
|----------|--------|-------------------|--------|
| Cobertura visual | 70% | 75% | 95% |
| Fecho operacional | 30% | 85% | 100% |
| Confiabilidade | 35% | 85% | 98% |
| UX desktop | 60% | 70% | 95% |
| Mobile/Tablet | 40% | 50% | 90% |
| Acessibilidade | 40% | 60% | 90% |

---

## 🎬 Começar Segunda-Feira

### Dia 1 (Segunda 15 Jul)
**Objetivo:** Phase 0 ✅ Emergência
- [ ] **09:00** — Code review: Token revogado (2 min) → Remove + env validate
- [ ] **09:15** — response.ok em 3 fetches (30 min)
- [ ] **10:00** — Audit findings meeting com Mark + Mark Repo análise (1h)
- [ ] **11:00** — Motor financeiro: Congelar envio + iniciar FinancialEngine.ts (1h)
- [ ] **12:00** — Hook idempotência: old_status check (1h)
- [ ] **14:00** — Follow-up: scheduled_at → due_at (30 min)
- [ ] **15:00** — Testes Phase 0 (1h)
- [ ] **16:00** — Deploy a dev (30 min)

**Definition of Done:** Sem segredos no bundle; build verde; propostas totais iguais

### Dias 2-10 (Terça a Sexta + Seg-Terça)
**Phase 1:** Seguir PLANO_EXECUCAO_AUDITORIA_2026-07-12.md (séquência semanal)

---

## 📁 Documentação Completa

- **`COMECE_AQUI_AUDITORIA_RESUMO.md`** ← Você está aqui
- **`PHASE_0_CHECKLIST.md`** — Checklist prático com código pronto
- **`PLANO_EXECUCAO_AUDITORIA_2026-07-12.md`** — Sequência semanal + ficheiros específicos
- **`RELATORIO_FINAL_AUDITORIA_2026-07-12.md`** — Relatório completo com validações
- **`CARTA_APRESENTACAO_AUDITORIA.txt`** — Resumo executivo 5 min

---

## ⚠️ Decisão Crítica

**Parar novos features até Phase 1 ✅?**

**SIM.** Cada novo feature sem Phase 1 completa adiciona mais:
- Corrupção de dados (UUID vs Integer)
- Falta de auditoria (assigned_to literal)
- Fragmentação (4 motores financeiros → 5)
- Perda de confiança (fetch sem validação)

**Custo de 1 feature nova agora:** +10 horas de refactoring em Phase 1
**Benefício:** Phase 1 fica 3 dias mais perto de conclusão

---

## 🏁 Sucesso Quando...

- ✅ Operador preenche campo no Telecof e aparece 5 min depois na ficha do cliente
- ✅ Follow-up aparece na Agenda sem refresh
- ✅ Proposta mostra €100 na página, PDF, e no email
- ✅ Recarregar página não muda estado observado
- ✅ Em 8 horas de trabalho, operador **não** desconfia do CRM

---

**Próximo passo:** Sexta 16h → Reunião com Mark + Código da semana pronto → Segunda 09:00 começar Phase 0 ✅

*Auditoria validada por 4 agentes paralelos. Evidência em `docs/` e documentos relacionados*
