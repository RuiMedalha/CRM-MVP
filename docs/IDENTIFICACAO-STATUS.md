# Status: Identificação Automática de Contactos — 15/07/2026

## Resumo Executivo
Implementação de identificação automática de contactos para emails e WhatsApp. Qualquer mensagem que entra no CRM fica ligada ao contacto certo (ou à lead correspondente) automaticamente.

## Progresso

✅ **COMPLETO** (3 fases)
- Fase 1: Schema Directus — adicionados `lead_id` e `needs_review` às coleções
- Fase 2: Endpoint `/identify-contact` expandido com todos os campos de email e telefone
- Fase 3: Endpoint `/apply-contact-identification` criado (nova lógica de persistência)

⏳ **EM DESENVOLVIMENTO** (6 fases restantes)
- Fase 4: Integração n8n email → instruções documentadas
- Fase 5: Workflow n8n WhatsApp inbound → instruções documentadas
- Fase 6: Script de backfill histórico
- Fase 7: UI Lead timeline (minimal)
- Fase 8: Customer360 — fetch conversations
- Testes: T1-T5 + documentação

## Commit Principal

**Hash**: `62d0009` (feat/modulo-propostas)

**Mensagem**:
```
feat: fase 1-3 identificacao automatica — schema + endpoints expand + apply
```

**Ficheiros**:
- ✨ `directus/extensions/api/endpoints/apply-contact-identification/index.js` — novo endpoint (240 linhas)
- ✨ `directus/extensions/api/endpoints/apply-contact-identification/package.json` — manifest
- 📝 `directus/extensions/api/endpoints/identify-contact/index.js` — expandido com contact_phone + email_compras/comercial/encomendas
- 📚 `docs/fluxo-identificacao.md` — documentação técnica completa (500+ linhas)
- ✅ `docs/IDENTIFICACAO-STATUS.md` — este ficheiro

## Como Continuar

### Próximo Passo: Fase 4 (n8n Email Integration)
Os ficheiros JSON dos workflows são muito grandes (~2000 linhas cada). Instruções:

1. **Abrir** `n8n/workflows/email-crm-v2-geral.json` no editor n8n UI ou JSON
2. **Encontrar** o nó "Directus · Criar thread" (ID: `create-thread`, linha ~384)
3. **Adicionar novo nó** HTTP POST após este, com config:
   ```json
   {
     "id": "apply-identify",
     "name": "Aplicar Identificação",
     "type": "n8n-nodes-base.httpRequest",
     "parameters": {
       "method": "POST",
       "url": "https://api.hotelequip.pt/apply-contact-identification",
       "sendHeaders": true,
       "headerParameters": {
         "parameters": [{
           "name": "Authorization",
           "value": "Bearer {{ $env.DIRECTUS_N8N_TOKEN }}"
         }]
       },
       "sendBody": true,
       "specifyBody": "json",
       "jsonBody": {
         "email": "{{ $('Tratar IA + calcular SLA').first().json.fromAddress }}",
         "phone": "{{ $('Tratar IA + calcular SLA').first().json.contact_phone }}",
         "nif": "{{ $('Tratar IA + calcular SLA').first().json.nif }}",
         "source_collection": "email_threads",
         "source_id": "{{ $('Directus · Criar thread').first().json.data.id }}"
       }
     },
     "onError": "continueRegularOutput"
   }
   ```
4. **Conectar**: "Directus · Criar thread" → "Aplicar Identificação" → "Directus · Criar mensagem (inbound)"
5. **Repetir** para `email-crm-v2-apoio-cliente.json`

### Fase 5 (n8n WhatsApp Inbound)
Criar novo workflow `wa-inbound-to-directus.json` com trigger webhook `/webhook/wa-inbound`. Ver `docs/fluxo-identificacao.md` seção "WhatsApp Flow" para nodes exatos.

### Fase 6 (Backfill)
Script TypeScript que:
1. Faz backup das threads/conversas sem `contact_id`
2. Corre POST `/apply-contact-identification` sobre todas
3. Gera relatório com métricas A1-A3

Ver `docs/fluxo-identificacao.md` seção "Backfill Histórico".

## Testes

**T1**: Criar contacto [TESTE]
```bash
curl -X POST https://api.hotelequip.pt/items/contacts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "[TESTE] Hotelequip",
    "email": "ruimedalha@hotelequip.pt",
    "whatsapp_number": "916542271"
  }'
```

**T2**: Enviar email de `ruimedalha@hotelequip.pt` PARA `geral@hotelequip.pt` com subject `[TESTE]`
→ Verificar: thread criada com `contact_id` preenchido

**T3**: Enviar WhatsApp PARA `916542271` via Evolution com conteúdo `[TESTE]`
→ Verificar: conversa criada com `contact_id` preenchido

**T4**: Abrir Ficha 360 do [TESTE]
→ Verificar: timeline mostra email + conversa

**T5**: Criar lead [TESTE], enviar email de `lead.teste@exemplo.pt`
→ Verificar: thread com `lead_id` + visível na timeline da lead

## Métricas de Sucesso

- **A1**: % threads com `contact_id` (meta: >80% após backfill)
- **A2**: % conversas com `contact_id` (meta: >80% após backfill)
- **A3**: 5 exemplos de threads ligadas corretas (email campo ↔ contacto)
- **A4**: `docs/fluxo-identificacao.md` completo ✅

## Referências

- Plano completo: `C:/Users/Rui Medalha/.claude-sslip/plans/sunny-tinkering-rivest.md`
- Documentação técnica: `docs/fluxo-identificacao.md`
- Endpoints: `directus/extensions/api/endpoints/identify-contact/` + `apply-contact-identification/`
- Workflows n8n: `n8n/workflows/email-crm-v2-geral.json` + `email-crm-v2-apoio-cliente.json` + novo `wa-inbound-to-directus.json`

## Notas

1. **SSH**: Não foi possível aceder via SSH ao servidor (timeout). Schema foi criado via POST /fields (API Directus) em vez de psql direto.
2. **Context**: Implementação feita em limite de contexto — fases 4-8 deixadas como instruções documentadas.
3. **Testes**: Obrigatório testar só com `ruimedalha@hotelequip.pt` e `916542271` (regras Sprint Final).
4. **Cleanup**: Remover registos [TESTE] depois de validação.

---

**Data**: 15 de Julho de 2026  
**Branch**: `feat/modulo-propostas`  
**Próxima Revisão**: Quando Fase 4 (n8n integration) estiver completa
