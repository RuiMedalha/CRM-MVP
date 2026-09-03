# ENTITY MASTER PLAN — Ficha Mestre de Entidade

> Documento técnico para o redesenho completo da ficha de edição de entidade no Hotelequip OS.
> Aprovação necessária antes de qualquer implementação.

---

## 1. Modelo de Dados Recomendado

### Princípio fundamental
Uma entidade = uma empresa/pessoa real. Pode ter múltiplos papéis (cliente, fornecedor, parceiro, fabricante) sem duplicação.

### Estrutura proposta

```
organizations (= contacts actual, renomeado conceptualmente)
├── entity_type (tipo jurídico)
├── roles[] (papéis: cliente, fornecedor, etc.)
├── status (activo/inactivo/bloqueado)
├── general_data (nome, razão social, NIF, etc.)
├── fiscal_data (CAE, capital social, etc.)
├── commercial_data (segmento, responsável, etc.)
├── financial_data (condições pagamento, IBAN, etc.)
├── supplier_data (MOQ, incoterms, prazo — condicional)
├── addresses[] (múltiplas moradas tipadas)
├── contact_channels[] (múltiplos emails/telefones tipados)
└── integrations (IDs externos)

entity_contacts (pessoas associadas)
├── organization_id FK
├── nome, cargo, departamento
├── canais de contacto
└── flags (principal, newsletters, propostas, faturas)

entity_documents (ficheiros)
├── organization_id FK
├── tipo, nome, URL
└── metadata

entity_history (changelog automático)
├── organization_id FK
├── field, old_value, new_value
├── changed_by, changed_at
└── immutable
```

---

## 2. Separação: Tipo Jurídico vs Papéis

### Tipo Jurídico (campo único, obrigatório)
Descreve a ESTRUTURA da entidade:

| Valor | Campos visíveis |
|-------|----------------|
| `empresa` | NIF, CAE, Capital Social, Registo Comercial |
| `eni` (Empresário Nome Individual) | NIF, CAE |
| `particular` | NIF (pessoal), sem CAE/Capital |
| `administracao_publica` | NIF, Código SIBS |
| `associacao` | NIF, Estatutos |
| `outro` | NIF |

### Papéis (array de checkboxes, múltiplos)
Descreve a FUNÇÃO da entidade na relação com a Hotelequip:

| Papel | Tabs/campos condicionais |
|-------|-------------------------|
| `lead` | Score, Origem, Campanha |
| `cliente` | Tab Vendas, Tabela Preços, Desconto, Limite Crédito |
| `fornecedor` | Tab Fornecedor, Tab Compras, MOQ, Incoterms |
| `parceiro` | Comissão, Programa parceria |
| `fabricante` | Marcas, Catálogos |
| `distribuidor` | Território, Exclusividade |
| `transportadora` | Frota, Cobertura |
| `prestador_servicos` | Especialidade, Certificações |
| `instalador` | Zona, Certificações |
| `subcontratado` | Contrato, Validade |

---

## 3. Campos por Separador

### Tab 1: Dados Gerais
| Campo | Tipo | Existente? | Directus field |
|-------|------|-----------|----------------|
| Nome (company_name) | string | ✅ | `company_name` |
| Nome Comercial | string | ❌ | `trade_name` |
| Razão Social | string | ❌ | `legal_name` |
| Estado | enum | ❌ | `entity_status` (active/inactive/blocked) |
| Tipo Jurídico | enum | ❌ | `entity_type` |
| Papéis | json array | ❌ | `roles` |
| Logótipo | file | ❌ | `logo` (file relation) |
| Website | string | ✅ | `website` |
| Observações rápidas | text | ✅ | `quick_notes` |

### Tab 2: Dados Fiscais
| Campo | Tipo | Existente? | Directus field |
|-------|------|-----------|----------------|
| NIF | string | ✅ | `nif` |
| NIF Intracomunitário | string | ❌ | `vat_eu` |
| CAE | string | ❌ | `cae` |
| Capital Social | decimal | ❌ | `share_capital` |
| Data Constituição | date | ❌ | `incorporation_date` |
| Registo Comercial | string | ❌ | `commercial_registry` |

### Tab 3: Contactos (canais)
| Campo | Tipo | Existente? | Directus field |
|-------|------|-----------|----------------|
| Email Geral | string | ✅ | `email` |
| Email Compras | string | ❌ | `email_purchasing` |
| Email Financeiro | string | ❌ | `email_finance` |
| Email Comercial | string | ❌ | `email_commercial` |
| Email Assistência | string | ❌ | `email_support` |
| Telefone Geral | string | ✅ | `phone` |
| Telefone Comercial | string | ❌ | `phone_commercial` |
| Telemóvel | string | ❌ | `mobile` |
| WhatsApp | string | ✅ | `whatsapp_number` |
| LinkedIn | string | ❌ | `linkedin_url` |
| Facebook | string | ❌ | `facebook_url` |
| Instagram | string | ❌ | `instagram_url` |

### Tab 4: Moradas
Collection separada: `entity_addresses`

| Campo | Tipo | Notas |
|-------|------|-------|
| organization_id | FK | |
| type | enum | sede/entrega/faturacao/assistencia/armazem |
| street | string | |
| number | string | |
| postal_code | string | |
| city | string | |
| district | string | |
| country | string | default PT |
| gps_lat | decimal | |
| gps_lng | decimal | |
| is_default | boolean | |

### Tab 5: Comercial
| Campo | Tipo | Existente? | Directus field |
|-------|------|-----------|----------------|
| Responsável Comercial | relation | ✅ (parcial) | `assigned_employee_id` |
| Segmento | string | ❌ | `segment` |
| Subsegmento | string | ❌ | `subsegment` |
| Origem | string | ✅ | `source` |
| Campanha | string | ❌ | `campaign` |
| Score | integer | ❌ | `commercial_score` |
| Potencial Anual | decimal | ❌ | `annual_potential` |
| Nº Funcionários | integer | ❌ | `employee_count` |
| Tipo Negócio | string | ❌ | `business_type` |
| Concorrente Actual | string | ❌ | `current_competitor` |

### Tab 6: Financeiro
| Campo | Tipo | Existente? | Directus field |
|-------|------|-----------|----------------|
| Condição Pagamento | string | ❌ | `payment_terms` |
| Forma Pagamento | string | ❌ | `payment_method` |
| Moeda | string | ❌ | `currency` (default EUR) |
| Tabela Preços | string | ❌ | `price_list` |
| Limite Crédito | decimal | ❌ | `credit_limit` |
| Desconto Geral | decimal | ❌ | `general_discount` |
| IBAN | string | ❌ | `iban` |
| SWIFT | string | ❌ | `swift` |
| Seguro Crédito | boolean | ❌ | `credit_insurance` |

### Tab 7: Fornecedor (condicional: role inclui 'fornecedor')
| Campo | Tipo | Directus field |
|-------|------|----------------|
| Categoria | string | `supplier_category` |
| Representante | string | `supplier_rep_name` |
| Email Encomendas | string | `supplier_email_orders` |
| Email Pós-venda | string | `supplier_email_aftersales` |
| MOQ | string | `supplier_moq` |
| Prazo Entrega | string | `supplier_lead_time` |
| Incoterm | string | `supplier_incoterm` |
| Transportadora Pref. | string | `supplier_preferred_carrier` |
| Garantia | string | `supplier_warranty` |

### Tab 8: Vendas (condicional: role inclui 'cliente')
Dados calculados/derivados — não são campos editáveis:
| Campo | Fonte |
|-------|-------|
| Cliente Desde | `date_created` |
| Última Venda | derivado de `quotations` (approved) |
| Valor Total | agregação |
| Volume Anual | agregação |
| Ticket Médio | cálculo |
| Classificação ABC | cálculo |

### Tab 9: Contactos (pessoas)
Collection separada: `entity_contacts`

| Campo | Tipo |
|-------|------|
| organization_id | FK |
| name | string |
| job_title | string |
| department | string |
| phone | string |
| mobile | string |
| whatsapp | string |
| email | string |
| linkedin | string |
| is_primary | boolean |
| receives_newsletters | boolean |
| receives_proposals | boolean |
| receives_invoices | boolean |

### Tab 10: Documentos
Collection: `entity_documents`

### Tab 11: Integrações
| Campo | Directus field |
|-------|----------------|
| ERP ID | `ext_erp_id` |
| WooCommerce ID | `ext_woocommerce_id` |
| Moloni ID | `moloni_client_id` (✅ existe) |
| Chatwoot ID | `chatwoot_contact_id` (✅ existe) |
| Mautic ID | `mautic_contact_id` (✅ existe) |

### Tab 12: Observações
Campo rico: `notes` (✅ existe), `internal_notes` (✅ existe)

### Tab 13: Histórico
Collection: `entity_history` (changelog automático)

---

## 4. Campos Existentes vs Novos

### ✅ Campos que JÁ EXISTEM no Directus contacts (26)
```
id, company_name, contact_name, firstname, lastname, full_name,
nif, phone, email, whatsapp_number, whatsapp_opt_in,
contact_person, contact_phone, contact_email,
address, postal_code, city, website,
tags, quick_notes, sku_history, notes, internal_notes,
source, moloni_client_id, chatwoot_contact_id, mautic_contact_id,
assigned_employee_id, accept_newsletter, date_created
```

### ❌ Campos NOVOS necessários na collection contacts (~40)
```
trade_name, legal_name, entity_type, entity_status, roles,
logo, vat_eu, cae, share_capital, incorporation_date, commercial_registry,
email_purchasing, email_finance, email_commercial, email_support,
phone_commercial, mobile, linkedin_url, facebook_url, instagram_url,
segment, subsegment, campaign, commercial_score, annual_potential,
employee_count, business_type, current_competitor,
payment_terms, payment_method, currency, price_list, credit_limit,
general_discount, iban, swift, credit_insurance,
supplier_category, supplier_rep_name, supplier_email_orders,
supplier_email_aftersales, supplier_moq, supplier_lead_time,
supplier_incoterm, supplier_preferred_carrier, supplier_warranty
```

---

## 5. Novas Collections Necessárias

| Collection | Descrição | Relação |
|-----------|-----------|--------|
| `entity_addresses` | Moradas múltiplas tipadas | M:1 → contacts |
| `entity_contacts` | Pessoas associadas à organização | M:1 → contacts |
| `entity_documents` | Ficheiros/documentos | M:1 → contacts |
| `entity_history` | Changelog automático | M:1 → contacts |

Nota: Usamos a collection `contacts` existente como base (não renomear para não partir código). Conceptualmente = `organizations`.

---

## 6. Alterações ao Schema Directus

### Fase 1 — Campos core na collection `contacts`
```
entity_type (string, enum)
entity_status (string, enum: active/inactive/blocked)
roles (json)
trade_name (string)
legal_name (string)
segment (string)
business_type (string)
```

### Fase 2 — Campos fiscais e contactos
```
vat_eu, cae, share_capital, incorporation_date, commercial_registry
email_purchasing, email_finance, email_commercial, email_support
phone_commercial, mobile, linkedin_url, facebook_url, instagram_url
```

### Fase 3 — Campos comerciais e financeiros
```
subsegment, campaign, commercial_score, annual_potential
employee_count, current_competitor
payment_terms, payment_method, currency, price_list
credit_limit, general_discount, iban, swift, credit_insurance
```

### Fase 4 — Campos fornecedor
```
supplier_category, supplier_rep_name, supplier_email_orders
supplier_email_aftersales, supplier_moq, supplier_lead_time
supplier_incoterm, supplier_preferred_carrier, supplier_warranty
```

### Fase 5 — Collections novas
```
entity_addresses (nova collection)
entity_contacts (nova collection)
entity_documents (nova collection)
entity_history (nova collection + flow automático)
```

---

## 7. Plano de Migração (sem quebrar dados)

1. **Adicionar campos novos** — nunca remover campos existentes
2. **Campos existentes mantêm nome** — `company_name`, `nif`, `phone`, `email`, `address`, etc.
3. **Novo campo `roles`** — popular com `["cliente"]` para todos os registos existentes
4. **Novo campo `entity_type`** — popular com `"empresa"` para todos (NIF com 9 dígitos)
5. **Novo campo `entity_status`** — popular com `"active"` para todos
6. **Migrar `manufacturers`** — criar registos em `contacts` com `roles: ["fornecedor"]`, manter IDs originais num campo de mapping
7. **Migrar `leads`** — criar registos em `contacts` com `roles: ["lead"]` (ou manter tabela separada como staging)
8. **Collection `entity_addresses`** — migrar `address`+`postal_code`+`city` como morada sede
9. **Collection `entity_contacts`** — migrar `contact_person`+`contact_phone`+`contact_email` como 1º contacto

### Ordem de execução:
```
1. Criar campos novos no Directus (não obrigatórios)
2. Popular defaults via script
3. Criar collections novas
4. Migrar dados para collections novas
5. Actualizar UI (tab a tab)
6. Deprecar campos antigos (após confirmar)
```

---

## 8. Impacto no Customer360

| Componente | Impacto |
|-----------|--------|
| `OrganizationHeader` | Adicionar: logo, razão social, tipo jurídico, papéis como badges |
| `OrganizationSummary` | Reestruturar: mostrar campos por secção (fiscal, comercial, etc.) |
| `ContactListPanel` | Migrar para `entity_contacts` (quando existir) |
| `KpiPanel` | Derivar de dados reais (vendas, compras, timeline) |
| `EditGeneralTab` | Expandir para múltiplos tabs com campos condicionais |
| `useCustomerEditForm` | Expandir para suportar todos os campos novos |
| `customer360Adapter` | Mapear campos novos para `Customer360Organization` |
| `Customer360Organization` type | Expandir com todos os novos campos |

---

## 9. Fases de Implementação

| Fase | Conteúdo | Dependência |
|------|---------|-------------|
| **F1** | UI tabs (Dados Gerais + Fiscais + Contactos) usando campos existentes | Nenhuma |
| **F2** | Criar campos core no Directus (entity_type, entity_status, roles, segment, business_type) | Acesso admin Directus |
| **F3** | UI tab Comercial + Financeiro | F2 |
| **F4** | Collection `entity_addresses` + UI tab Moradas | Acesso admin Directus |
| **F5** | Collection `entity_contacts` + UI tab Pessoas | Acesso admin Directus |
| **F6** | Campos condicionais (fornecedor) + migração manufacturers | F2 |
| **F7** | Tab Vendas (calculado) + Tab Compras (calculado) | Dados existentes |
| **F8** | Tab Documentos + Tab Integrações | Collection nova |
| **F9** | Tab Histórico (changelog automático) | Flow Directus |
| **F10** | NIF lookup (VIES/API) + preenchimento automático | API externa |

---

## 10. Riscos Técnicos e Decisões Pendentes

| # | Risco/Decisão | Impacto | Resolução sugerida |
|---|--------------|---------|-------------------|
| 1 | **Schema lock**: Directus não permite renomear collections sem downtime | Alto | Manter `contacts` como nome, tratar conceptualmente como `organizations` |
| 2 | **Migração manufacturers**: IDs referenciados por products | Alto | Manter tabela, criar campo `organization_id` que aponta para contacts |
| 3 | **Migração leads**: tabela separada com lógica própria | Médio | Manter como staging; ao converter, criar em contacts com role "lead"→"cliente" |
| 4 | **~40 campos novos**: Directus com muitos campos fica lento na UI admin | Médio | Agrupar por JSON field ou usar interface custom |
| 5 | **Campos condicionais**: mostrar/esconder baseado em roles | Baixo | Lógica 100% no frontend, não no Directus |
| 6 | **Changelog automático**: requer Directus Flow ou trigger DB | Médio | Implementar como Flow que insere em entity_history |
| 7 | **NIF lookup**: API VIES é lenta e pode estar offline | Baixo | Timeout + fallback manual |
| 8 | **Permissões**: campos financeiros visíveis a todos? | Médio | Role-based no Directus (quando implementar) |
| 9 | **Performance**: ficha com 13 tabs pode ser pesada | Baixo | Lazy-load tabs, só buscar dados do tab activo |
| 10 | **Backward compatibility**: Dashboard360 usa campos antigos | Médio | Não renomear campos; apenas adicionar novos |

### Decisões pendentes (requerem aprovação):

- [ ] Renomear collection `contacts` → `organizations`? (recomendo: NÃO, manter como está)
- [ ] Campo `roles` como JSON array ou collection M:M? (recomendo: JSON array por simplicidade)
- [ ] Criar `entity_contacts` como collection nova ou reutilizar relação existente? (recomendo: nova)
- [ ] Migrar `manufacturers` para `contacts` ou manter separado com FK? (recomendo: FK bridge)
- [ ] Implementar changelog como Directus Flow ou trigger PostgreSQL? (recomendo: Flow)
- [ ] Tabs financeiros visíveis para todos os utilizadores? (recomendo: sim, read-only para não-admin)

---

## Próximo passo

Após aprovação deste plano:
1. Implementar **Fase F1** (UI tabs com campos existentes) — sem alterar Directus
2. Depois, criar campos core no Directus (**Fase F2**)
3. Iterar tab a tab
