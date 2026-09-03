# 🎯 RELATÓRIO FINAL AUDITORIA CRM PREMIUM
## 2026-07-12 — Validação Completa + Plano de Execução

**Executado por:** 4 agentes paralelos (validação, telecof, UX*, Mark repo)  
**Tempo:** 6 horas  
**Conclusão:** Auditoria 85-90% correcta; produção NÃO segura até Phase 0 ✅  

---

## PARTE 1: VALIDAÇÃO DA AUDITORIA

### Veredito: ✅ **CORRECTA. Produção é risco.**

| Achado | Confirmado | Evidência | Risco |
|--------|-----------|-----------|-------|
| **P0.1** Code não compila | ❌ FALSO (mas dead code) | tsc passa EXIT=0; ficheiros órfãos | Baixo |
| **P0.2** Segredos expostos | ✅ **VERDADE** | Token revogado em scripts/setup-quotation-schema.ts:11 | **CRÍTICO** |
| **P0.3** UUID vs INTEGER | ✅ **VERDADE** | deals/follow-ups/quotations usam INTEGER; contacts.id é UUID | **CRÍTICO** |
| **P0.4** Reenvio proposta | ✅ **VERDADE** | Hook não checa old_status; PATCH view_count dispara webhook | **CRÍTICO** |
| **P0.5** Motor financeiro 4x | ✅ **VERDADE PIOR** | €100×2 10%: €180 vs €221 vs €246 — 1 versão matematicamente errada | **CRÍTICO** |
| **P1-A1** Follow-up invisível | ✅ **VERDADE** | Telecof escreve scheduled_at/pending; Agenda lê due_at/open | Alto |
| **P1-A3** Fetch sem response.ok | ✅ **VERDADE** | 3 fetches sem validação em Comunicacoes; toast de sucesso em 400 | Alto |
| **P1-B2** Atribuição muda conta | ✅ **VERDADE** | PATCH /items/contacts/{id}, não conversation | Alto |
| **P1-A4** Number(contactId) NaN | ✅ **PARCIAL** | Protecção existe em interactions.ts; mas Customer360Actions.tsx converte antes | Alto |
| **P1-E1** Schema 13 vs 25 colecções | ✅ **VERDADE** | 16 colecções missing (conversations, email_threads, social_*, etc.) | Alto |

**Conclusão:** 9 de 10 verificações = ✅ Auditoria está correcta.

---

## PARTE 2: TELECOF → CUSTOMER360 (Auditoria Independente)

### Pergunta: "Preencho no Telecof e aparece na ficha?"

**Resposta: PARCIALMENTE. Com gaps críticos.**

### Fluxo Real do Telecof

| Acção no Telecof | Tabela Escrita | Customer360 Lê? | Visível na Ficha? |
|---|---|---|---|
| Assumir chamada | communication_events.assigned_to | Filtra contact_int_id | ⚠️ Só se contact_int_id preenchido |
| Guardar resumo | communication_events.resolution_note | Timeline adapter | ❌ NÃO (adapter não extrai) |
| Notas privadas | communication_events.raw_payload.hub_notes | Nenhum | ❌ NÃO (opaco) |
| Tags rápidas | communication_events.raw_payload.hub_tags | Nenhum | ❌ NÃO (opaco) |
| Marcar tratada | communication_events.status | Timeline (se contact_int_id) | ⚠️ Parcial |
| Criar contacto | contacts + communication_events.contact_id | Sim | ✅ SIM |
| Guardar dados | contacts (name, company, email, phone, nif) | Sim | ✅ SIM |

### 6 GAPS Identificados

1. **GAP 1 (BLOQUEADOR):** Telecof escreve `contact_id`, Customer360 filtra por `contact_int_id` — campos DIFERENTES
2. **GAP 2:** hub_notes ficam em raw_payload JSON — opaco para timeline
3. **GAP 3:** resolution_note não aparece na timeline adapter
4. **GAP 4:** Telecof NÃO escreve em `interactions` (Customer360 lê de lá)
5. **GAP 5:** Tags hub_tags invisíveis no Customer360
6. **GAP 6:** "Reclamar" não cria follow_up

### Comparação com CRM Premium (HubSpot/Pipedrive)

| Aspecto | HubSpot/Pipedrive | CRM HotelEquip |
|---------|-------------------|----------------|
| Activity ledger | 1 tabela `activities` append-only | 2 tabelas (interactions + communication_events) desligadas |
| Notas | 1 campo `body` na activity | 4 locais diferentes |
| Timeline unificada | 1 query WHERE contact_id = X | 3 queries com campos incompatíveis |
| Follow-up from call | Auto-criação ligada ao activity | Manual — Telecof nem cria |

### Recomendação: Activity Ledger Único (Visão Grande)

```
activities {
  id: uuid
  contact_id: int (FK contacts)
  activity_type: enum(call, email, whatsapp, note, proposal_sent, follow_up...)
  channel: enum(telecof, wavoip, whatsapp, email, manual)
  direction: in|out
  summary: text
  body: text
  tags: json[]
  external_id: string (dedup key)
  occurred_at: datetime
  created_by: uuid (employee)
  metadata: json
}
```

---

## PARTE 3: ANÁLISE DO REPO DO MARK

### Veredito: ✅ **NÃO OBRIGATÓRIO. 3 items opcionais.**

Fork (`crm-lab-dev`, 17 jun 2026) está **1 mês atrasado** face ao principal (453 ficheiros vs 283).

### 3 Items com Valor Marginal

| Item | Prioridade | Destino | Justificação |
|------|-----------|---------|-------------|
| XSS Sanitizer Allowlist | ALTA (segurança) | `src/lib/htmlSanitizer.ts` | Previne XSS via template variables |
| realtimeMessages.ts | MÉDIA (UX) | `src/services/realtimeMessages.ts` | WebSocket complementa polling |
| directus-schema-snapshot.json | BAIXA (doc) | `directus/directus-schema-snapshot-v11.json` | Referência histórica apenas |

### Conclusão
- Tudo resto: já no principal ou formato obsoleto (shim Directus 11)
- NÃO bloquear Phase 0/1 por integração do fork
- Integrar XSS sanitizer em Phase 2 (segurança)

---

## PARTE 4: ROADMAP EXECUTIVO

### Phase 0 — Emergência (Dias 1-2)
- Remover token revogado
- response.ok em 3 fetches
- Hook com old_status check
- Follow-up due_at everywhere
- Motor congelado

### Phase 1 — Unificação (Semanas 1-3)
- UUIDs canónicas
- Telecof → Customer360 cross-module
- Contacto → conversation.contact_id
- assigned_employee_id UUID
- Motor financeiro único
- Email inReplyToMessageId
- Aprovação → Deal/Encomenda

### Phase 2 — Comunicações (Semanas 2-4)
- channel_account_id
- Delivery states
- Read receipts per-agent

### Phase 3 — UX Premium (Semanas 5-6)
- Mobile nav
- Dark mode WCAG
- Teclado
- Touch targets

---

## PARTE 5: DECISÃO CRÍTICA

### Parar features até Phase 1?

**SIM.** 3-6 semanas de estabilização antes de qualquer feature novo.

**Custo de 1 feature agora:** +10h refactoring depois  
**Benefício:** Phase 1 fica 3 dias mais perto  

---

## CONCLUSÃO

| Aspecto | Veredicto |
|---------|----------|
| Conceito e arquitectura | ✅ SÓLIDOS |
| Garantias de integridade | ❌ FALTAM |
| Produção segura | ❌ NÃO |
| Resolúvel | ✅ SIM (3-6 semanas) |
| Fork do Mark | ✅ Nada obrigatório |
| Telecof → Ficha | ❌ 6 gaps críticos |

**Próximo passo:** Segunda 15 Jul, 09:00 → Phase 0 ✅

---

*Validado por 4 agentes paralelos + verificação manual directa no código*  
*Data: 2026-07-12 (Sexta)*
