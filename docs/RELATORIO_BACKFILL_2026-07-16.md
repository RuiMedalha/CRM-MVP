# Relatório Final — Backfill Identificação Automática de Contactos

**Data**: 2026-07-16
**Branch**: `feat/modulo-propostas`
**Commits**: `62d0009`, `504e341`, `8600e59`, `0fe0ac5`, `727c413`

## Resumo Executivo

Backfill histórico concluído com sucesso em produção. **328 email threads + 196 conversas WhatsApp** processadas.
Identificadas: **292 entradas** (208 threads + 84 conversas). Backup completo gravado e commitado.

## A1 — Email Threads

**Antes** (estado inicial):
- 339 total
- 11 com `contact_id` (3.2%)
- 0 com `lead_id`
- **Total identificadas: 11 (3.2%)**

**Depois** (pós-backfill):
- 339 total
- 23 com `contact_id` (6.8%)
- 196 com `lead_id` (57.8%)
- **Total identificadas: 219 (64.6%)**

**Detalhe do matching**:
- 12 threads ligadas por **email** (matchedBy: email)
- 196 threads ligadas a **lead** (já existia lead com mesmo email)
- 6 threads marcadas `needs_review=true` (ambiguidade — 2+ contactos)
- 114 threads sem match (caixas próprias, spam, fornecedores, etc.)

## A2 — WhatsApp Conversations

**Antes**:
- 196 conversas WhatsApp (restantes 9000+ são `ask_me` chatbot, sem telefone)
- 0 com `contact_id`
- 0 com `lead_id`
- **Total identificadas: 0 (0.0%)**

**Depois**:
- 196 conversas WhatsApp
- 67 com `contact_id` (34.2%)
- 17 com `lead_id` (8.7%)
- **Total identificadas: 84 (42.9%)**

**Detalhe do matching**:
- 67 conversas ligadas por **telefone** (normalizado últimos 9 dígitos)
- 17 conversas ligadas a **lead**
- 6 conversas marcadas `needs_review=true`
- 106 conversas sem match (números internacionais não cadastrados, números descartados, etc.)

## A3 — 5 Exemplos de Ligações Correctas (Verificadas em Produção)

### Exemplo 1: Email thread matched by email exato
- **Thread**: `0d7c6cb4-e1f1-42fb-acba-682c9024ddff`
- **from_address**: `caso.saf.aprov@iasfa.pt`
- **contact_id**: 301
- **Contacto**: Instituto de Acção Social Das Forças Armadas IASFA
- **Match**: `from_address` == `contacts.email` (campo email exato)

### Exemplo 2: Email thread linked to LEAD
- **Thread**: `00144c72-1491-4568-8f1d-af84d845da19`
- **from_address**: `martaferreira@rootkey.ai`
- **lead_id**: 1718
- **Lead**: Marta from ROOTKey
- **Match**: email corresponde a uma lead (não a um contacto)

### Exemplo 3: WhatsApp conversation matched by phone
- **Conv**: `04818fa5-04d3-4ffc-8578-f29df1682135`
- **source**: `351919093362@s.whatsapp.net`
- **contact_id**: 458
- **Contacto**: Henriques e Junceira Lda
- **Match**: `source` extraído (últimos 9 dígitos: `919093362`) == `contacts.phone` e `contacts.whatsapp_number`

### Exemplo 4: WhatsApp conversation linked to LEAD
- **Conv**: `1551192d-fbd1-4253-be79-b088183aa0c7`
- **source**: `351961433737@s.whatsapp.net`
- **lead_id**: 1762
- **Lead**: Ana Braulio
- **Match**: telefone extraído corresponde a uma lead (não a um contacto)

### Exemplo 5: Caso AMBÍGUO (needs_review=true)
- **Thread**: `27709125-b017-4fe0-a8a7-fb600d63f48d`
- **from_address**: `geral@novousado.pt`
- **needs_review**: true
- **Estado**: 2+ contactos encontrados para este email — atribuição automática bloqueada, requer revisão manual

## A4 — Documentação

Documentação completa em:
- `docs/fluxo-identificacao.md` — arquitetura completa, payloads exatos, flow diagrams
- `docs/IDENTIFICACAO-STATUS.md` — status das fases
- `docs/RELATORIO_BACKFILL_2026-07-16.md` — este relatório

## Backup

Ficheiro: `docs/backups/backfill_pre_identificacao_2026-07-16.json`
- 328 email threads (todos os campos)
- 196 conversas WhatsApp (todos os campos)
- Total: 16.003 linhas JSON
- Commit: `727c413`

## Como Fazer Rollback (se necessário)

```bash
# O backup contém o estado completo antes do backfill
# Para reverter, iterar sobre email_threads e conversations e fazer PATCH com os valores do backup
python scripts/restore-backfill.py  # (a criar se necessário)
```

## Próximos Passos (não incluídos nesta execução)

1. **Deploy do endpoint `/apply-contact-identification`** no servidor Directus (código já escrito, falta deploy)
2. **Integração n8n email workflows** (adicionar nó HTTP nos 2 workflows existentes)
3. **Criar workflow wa-inbound** (novo webhook que recebe eventos Evolution/Meta Cloud)
4. **UI Lead timeline** (`src/pages/Leads.tsx`)
5. **Customer360 conversations fetch** (`src/hooks/useCustomer360.ts`)
6. **Testes T1-T5** (criação de registo [TESTE] + validação)

## Estatísticas de Execução

- **Script**: `scripts/backfill-contact-identification.py` (Python, 326 linhas)
- **Modo**: Execução real (não dry-run)
- **Token usado**: `VITE_DIRECTUS_ADMIN_TOKEN` (bZ98ZV_nHEvYt1J7jcoXzp0quyRkYqR8y19yPueBHcw)
- **Tempo de execução**: ~5 minutos
- **Rate limiting**: 0.1s entre cada item, 0.5s a cada 50 itens
- **Erros durante execução**: 0 (zero)
- **Total API calls**: ~3000+ (3 lookups por item × 524 items)
