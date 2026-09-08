# Diagnóstico 403 — Public Proposals em Directus

**Data:** 2026-09-08  
**URL testada:** https://proposta.hotelequip.pt/p/4r3m1l1a4t34593r  
**Endpoint API:** https://api.hotelequip.pt/items/quotations?filter[public_token][_eq]=4r3m1l1a4t34593r

---

## TL;DR

O problema **não é reproduzível hoje**. O endpoint público responde **200 OK** sem auth, sem Origin, com qualquer combinação de headers testada. A "policy pública" (`$t:public_label`) existe e está a funcionar. O 403 que apareceu em relatórios anteriores foi provavelmente de uma **mutação** (PATCH/POST/DELETE) na página de proposta (botão "aprovar"/"rejeitar") — não do GET inicial.

---

## 1. Matriz CORS (8 testes)

| # | Cenário | Esperado | Observado |
|---|---|---|---|
| 1 | `curl` sem headers, sem auth | 200 | **200** ✓ |
| 2 | `Origin: https://proposta.hotelequip.pt` | 200 | **200** ✓ |
| 3 | `Origin: http://localhost:5180` | 200 | **200** ✓ |
| 4 | `Origin: http://localhost:3000` | 200 | **200** ✓ |
| 5 | `Origin: null` | 200 | **200** ✓ |
| 6 | `Referer: https://proposta.hotelequip.pt/p/...` | 200 | **200** ✓ |
| 7 | UA browser + Origin válido | 200 | **200** ✓ |
| 8 | OPTIONS preflight | 204 | **204** ✓ |

**Preflight com `Origin: https://evil.example.com`** → `Access-Control-Allow-Origin: https://evil.example.com` (reflexivo).  
**Headers relevantes:** `Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS` + `Access-Control-Allow-Credentials: true`.  
**Vary: Origin, Cache-Control** — Cloudflare cacheia por origem.

### Diagnóstico CORS
✅ CORS está configurado em **modo reflexivo** (sem allowlist). Aceita QUALQUER Origin. Não há restrição de CORS a corrigir.

---

## 2. Inventário Directus (com admin token)

### Server
- Versão: **Directus 12.1.1**
- `public_registration: false`, `mcp_enabled: true`, `ai_enabled: true`
- `rateLimit: false`, `websocket: false`
- Cloudflare como proxy (`Server: cloudflare`, `cf-cache-status: DYNAMIC`)

### Roles (6)
| Role | Policies atribuídas |
|---|---|
| CRM | a3a600b2, 0a0175ba |
| crm_agent | f9166ef2 |
| crm_app | 6f069337, bd17a040 (filha de Administrator) |
| Administrator (parent) | a477400d, 49d83d3a, 2b00b955, 2b1cbaa8, 6fef9fe8 |
| n8n-automation | f241193d |
| wp_bridge | 2381820d |

### Policies (resumo)
| Policy | Tipo | Notas |
|---|---|---|
| **`$t:public_label` (abf8a154…)** | **Pública — read com filtro `public_token._nnull`** | Atribuída a 12 users, **0 roles** (Directus aplica quando user não tem role). **Esta é a que serve as proposals.** |
| `crm_app` (6ee32182…) | `admin_access: true`, full CRUD em todas as coleções | 10 users, 10 roles |
| `n8n-automation` (10a07d94…) | read+update em quotations | para o n8n |
| `CRM`, `wp_bridge_policy`, `MCP CRM Operations` | policies internas | |
| `crm1`, `Administrator` | admin-wide | |

### Permissions sobre `quotations` (resumo)
- **Perm `216`** — `action: read`, filter `{"public_token":{"_nnull":true}}`, fields com whitelist (sem `pdf_file_url` raw, com `customer_name`, `public_token`, `mb_*`, `payment_status`, etc.) → policy `abf8a154` (público).
- **Perm `267–269`** — read/create/update, fields `*` → policy `d8122fcc`
- **Perm `141–145`** — full CRUD, fields `*` → policy `crm_app` (admin/app)
- **Perm `234, 335, 383`** — n8n-automation
- **Perm `368–370`** — MCP CRM Operations (create/read/update)

### Diagnóstico Policy
✅ **A policy pública existe e está corretamente configurada.**  
⚠️ A whitelist de fields da Perm 216 **inclui `public_token` no output** — qualquer visitante vê o token de quem partilha. Recomendação: remover `public_token` do `fields` para não expor o identificador.

---

## 3. Configuração servidor

- `GET /` → 302 redirect para `/admin` (comportamento default do Directus).
- `GET /quotations/public/4r3m1l1a4t34593r` → **404** `Route ... doesn't exist`. **Não existe rota custom** — o frontend (`proposta.hotelequip.pt/p/:token`) usa o `/items/quotations?filter[public_token][_eq]=...` normal.

---

## 4. Mutações — onde o 403 provavelmente vem

| Método | Auth | Endpoint | Resultado |
|---|---|---|---|
| GET | nenhuma | `/items/quotations?filter[public_token]...` | **200** ✓ |
| POST | nenhuma | `/items/quotations` (body) | **403** "no permission" |
| PATCH | nenhuma | `/items/quotations/103` | **403** |
| DELETE | nenhuma | `/items/quotations/103` | **403** |
| POST | admin | `/items/quotations` (body) | **200** ✓ |
| DELETE | admin | `/items/quotations/104` (cleanup) | **204** ✓ |

**Conclusão**: o GET inicial está sempre a passar. O 403 que o utilizador reportou **tem de ser de uma ação subsequente** — provavelmente o botão "Aprovar / Rejeitar / Pedir telefone" da página `/p/:token`, que faz `PATCH /items/quotations/:id` sem token.

---

## 5. Recomendações

### ❌ Não fazer (são más ideias)
- **Solução 2 — "ajustar CORS em settings.yaml"**: o CORS já está reflexivo. Tightening só quebraria o cenário atual.
- **Solução 3 — "frontend fallback com token estático"**: vazaria tokens permanentes no bundle JS e daria acesso total a TODOS os quotations.

### ✅ Recomendação A — Política correta para o botão "aprovar"
A página `/p/:token` precisa de aprovar/rejeitar a quotation. Há duas vias limpas:

1. **Endpoint público específico de aprovação** (recomendado): criar uma rota custom Directus (`/items/quotations/:id/approve` por POST sem auth) que verifica `public_token` no body e só permite mudar o campo `status`. Implementar via Directus Endpoint custom ou hook `items.quotations.update` com bypass para `public_token` válido.

2. **Public policy read-only continua + PATCH público**: adicionar uma permissão PATCH na policy `abf8a154` com filtro `{"public_token":{"_nnull":true}}` e fields `["status","approved_at","rejected_at","view_count"]`. Cuidado: isso **expõe a capacidade de aprovar QUALQUER quotation apenas com o seu token** — aceitável porque o token já é partilhado, mas é um vetor de enumeração se o atacante adivinhar tokens.

### ✅ Recomendação B — Remover `public_token` da whitelist de fields (cosmético)
Hoje o GET público devolve o próprio `public_token` no payload. Não é grave (o token já está no URL), mas é leakage. Remover da Perm 216 `fields[]`.

### ✅ Recomendação C — Validar fluxo completo
1. `curl` GET → 200 ✓ (já confirmado)
2. `curl` PATCH com `status: approved` sem auth → **403** (esperado, é aqui que o botão falha)
3. Aplicar Recomendação A
4. Re-testar PATCH → esperado 200

---

## Comandos executados

```bash
# matriz CORS
curl "https://api.hotelequip.pt/items/quotations?filter[public_token][_eq]=4r3m1l1a4t34593r" -w "%{http_code}"
curl -H "Origin: https://proposta.hotelequip.pt" "..." -w "%{http_code}"
curl -X OPTIONS -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: GET" "..."

# inventário (com admin token)
curl -H "Authorization: Bearer $TOKEN" "https://api.hotelequip.pt/roles?limit=-1"
curl -H "Authorization: Bearer $TOKEN" "https://api.hotelequip.pt/policies?limit=-1"
curl -H "Authorization: Bearer $TOKEN" "https://api.hotelequip.pt/policies/abf8a154-5b1c-4a46-ac9c-7300570f4f17"
curl -H "Authorization: Bearer $TOKEN" "https://api.hotelequip.pt/permissions?filter[collection][_eq]=quotations"
curl -H "Authorization: Bearer $TOKEN" "https://api.hotelequip.pt/server/info"
curl -H "Authorization: Bearer $TOKEN" "https://api.hotelequip.pt/fields/quotations"

# mutações
curl -X POST "https://api.hotelequip.pt/items/quotations" -d '{}'           # 403
curl -X PATCH "https://api.hotelequip.pt/items/quotations/103" -d '{...}'   # 403
```
