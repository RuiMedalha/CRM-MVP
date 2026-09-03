# ✅ PHASE 0 CHECKLIST — Emergência (Dias 1-2)
## Verificar e marcar como DONE antes de qualquer feature nova

**Responsável:** RuiMedalha | **Prazo:** Terça 16 Jul, 18:00 | **CI/CD:** Bloqueio até ✅

---

## 🔐 Segurança: Token Revogado

- [ ] **Ficheiro:** `scripts/setup-quotation-schema.ts:11`
  ```typescript
  // ❌ REMOVER ISTO:
  const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN || "0TuAkkyjdFp8BZlKmOjc443mbQba0smF";
  
  // ✅ SUBSTITUIR POR:
  const ADMIN_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!ADMIN_TOKEN) throw new Error("DIRECTUS_ADMIN_TOKEN env var required");
  ```
- [ ] **Teste:** `npm run build` sem warnings sobre token hardcoded
- [ ] **Verificação:** `grep -r "0TuAkkyjdFp8BZlKmOjc443mbQba0smF" src/ scripts/` → zero results

---

## ✔️ Fetch Validation: Response OK

### P1-A3: ComunicacoesCliente360Panel.tsx

- [ ] **Linha 277** (handleSavePrivateNote):
  ```typescript
  // ❌ ANTES:
  await fetch(`${DIRECTUS_URL}/items/conversation_notes`, { ... });
  setPrivateNote("");
  toast({ title: "Nota guardada" });
  
  // ✅ DEPOIS:
  const resp = await fetch(`${DIRECTUS_URL}/items/conversation_notes`, { ... });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  setPrivateNote("");
  toast({ title: "Nota guardada" });
  ```

- [ ] **Linha 300** (handleSaveFollowUp): Adicionar `if (!resp.ok) throw...`
- [ ] **Linha 325** (handleAssignAgent): Adicionar `if (!resp.ok) throw...`
- [ ] **Teste:** Simular rejeição de permissão (403) → UI mostra erro, dados mantêm-se no formulário

---

## 🧮 Motor Financeiro: Congelado

- [ ] **Congelamento:** Adicionar flag `QUOTATIONS_FROZEN = true` em `.env.local`
  ```typescript
  // Em StepSend.tsx, linha 178:
  if (import.meta.env.VITE_QUOTATIONS_FROZEN === "true") {
    toast({ title: "Propostas congeladas para manutenção", variant: "destructive" });
    return;
  }
  ```

- [ ] **Teste:** Tentar enviar proposta → Bloqueado com mensagem clara
- [ ] **Documentação:** Adicionar nota no README: "Phase 0: Propostas desactivadas até 17 Jul (motor financeiro unificado)"

### Validação de Igualdade (para quando reabrimos)

- [ ] **Criar testes:** `src/lib/__tests__/financialEngine.test.ts`
  ```typescript
  test('€100 × 2 com 10% desconto = €180 em todos os canais', () => {
    const subtotal = 200;
    const discount = 20; // 10%
    const iva = 23; // %
    
    const result = calculateProposal({ subtotal, discount, iva });
    
    expect(result.editor).toBe(result.publicPage);
    expect(result.publicPage).toBe(result.pdf);
    expect(result.pdf).toBe(180); // esperado
  });
  ```

- [ ] **Correr testes:** `npm test -- financialEngine` → ✅ PASS

---

## 🔄 Hook Idempotência: old_status Check

- [ ] **Ficheiro:** `directus/extensions/hooks/orcamento-automation/index.js`
  ```javascript
  // ✅ ADICIONAR após linha 65 (const nextStatus = ...):
  
  // 🔑 NOVO: Não disparar se já está neste status (ex: view_count PATCH)
  const payload = meta.payload || {};
  if (!('status' in payload)) {
    // Update não alterou status — skip (ex: só view_count)
    continue;
  }
  ```

- [ ] **Teste:** 
  - Abrir proposta 2x → Webhook disparado 1x apenas
  - Incrementar view_count → Webhook NÃO dispara

---

## 📅 Follow-up Everywhere: due_at

### P1-A1: ComunicacoesCliente360Panel.tsx:306

- [ ] **Trocar campo:**
  ```typescript
  // ❌ ANTES (linha 303-309):
  body: JSON.stringify({
    contact_id: contactId || null,
    conversation_id: conversationId || null,
    scheduled_at: followUpDate,
    notes: followUpNote,
    status: "pending",
  }),
  
  // ✅ DEPOIS:
  body: JSON.stringify({
    contact_id: contactId || null,
    conversation_id: conversationId || null,
    due_at: followUpDate,
    notes: followUpNote,
    status: "open",
    assigned_employee_id: currentUser?.id || null,
  }),
  ```

- [ ] **Validação:** Campo `due_at` é obrigatório antes de guardar
- [ ] **Teste:**
  - Criar follow-up com data → Aparece na Agenda imediatamente
  - Criar sem data → Mostrar erro ou backlog "Sem data"

---

## 🧪 Testes Phase 0

### Manual

- [ ] **Segurança:** `npm run build` → Sem warnings
- [ ] **Fetch:** Desativar rede → Toast de erro aparece, formulário mantém dados
- [ ] **Motor:** Flag VITE_QUOTATIONS_FROZEN=true → Envio bloqueado
- [ ] **Hook:** POST proposta + PATCH view_count → 1 webhook apenas
- [ ] **Follow-up:** Criar em Comunicações → Aparece em Agenda 5 seg depois

### CI/CD

- [ ] **Type:** `npx tsc --noEmit` → Zero erros
- [ ] **Build:** `npm run build` → ✅ Sucesso
- [ ] **Commit message:** `feat: phase-0-emergencia - remove-token, validar-fetch, motor-congelado`

---

## ✅ Definition of Done

Todos os checkboxes acima = ✅ DONE

**Merge para:** `feat/modulo-propostas` → PR → main

**Deploy a:** Dev + Staging

**Anúncio:** "Phase 0 ✅ — Segurança, validação e congelamento de propostas implementados"

---

## 📋 Ordem Sugerida de Implementação

1. **09:00–09:30** — Token revogado (2 ficheiros, 2 min)
2. **09:30–10:30** — Fetch validation (3 funções, 30 min)
3. **10:30–11:30** — Hook old_status (1 ficheiro, 20 min)
4. **11:30–12:00** — Follow-up due_at (1 ficheiro, 15 min)
5. **12:00–14:00** — Pausa (teste + almoço)
6. **14:00–15:00** — Motor congelado (flag + testes)
7. **15:00–16:00** — CI/CD (tsc + build)
8. **16:00–16:30** — Commit + Push
9. **16:30–17:00** — Deploy + confirmação

**Total:** ~7 horas (inclui testes e pausa)
