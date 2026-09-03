# Fluxo Email → Lead (investigação 15/07/2026)

> Estado actual do pipeline de ingestão de email e proposta de gate de
> encaminhamento por categoria. Este documento é o resultado da investigação
> pedida na tarefa #1 do sprint final; **não foi escrito código de produção
> ainda** — primeiro confirmámos o cenário para depois decidir onde mexer.

## TL;DR

- O pipeline **não tem gate de encaminhamento**: qualquer email classificado
  vira lead com `source=email_inbound`, incluindo fornecedores, spam e
  facturas.
- O ponto de saída é **cenário (a)**: o workflow n8n faz HTTP POST directo a
  `/items/leads` logo a seguir à classificação. **Não** chama um endpoint
  nosso intermédio.
- As 13 leads `email_inbound` confirmadas em produção estão assim
  distribuídas por categoria da thread correspondente:
  `fornecedor_sourcing: 4`, `spam: 2`, `tabela_precos_fornecedor: 2`,
  `pedido_orcamento: 2`, `compra_cliente: 1`, `reclamacao: 1`,
  `sem_match: 1`. **8 das 12 com categoria matched (67%) não deviam ter
  virado lead.**
- O classificador **já** devolve `category` e `ai_summary` correctamente
  (verificado por query directa a `email_threads`). Falta apenas
  `fornecedor_novidade` (distinção entre novidade de fornecedor conhecido
  e venda fria).
- Toda a extracção de dados do email (contact_person, telefone, cidade,
  NIF, website, produtos, urgência) **não existe na ingestão** — todas as
  leads `email_inbound` actuais têm esses campos a `null`.

## 1. Como o email entra no Directus

### 1.1 Workflows n8n activos (servidor, não versionados)

| Mailbox              | Workflow n8n ID    | Operador        |
|----------------------|--------------------|-----------------|
| apoio.cliente@       | `ZkaA5zquAFBfQuJR` | Claude (noutro canal) |
| geral@               | `LIGCJw1vKFKzMsB9` | Claude (noutro canal) |

Estes são os IDs referidos em `docs/EMAIL_CHANNEL_FIX.md` e confirmados pelo
utilizador em 15/07/2026. Os workflows não estão exportados para
`n8n/workflows/` no repo — o único ficheiro com esse nome
(`n8n/workflows/email-inbound-to-directus.json`) é um stub `active: false`
que só cria `interactions`, **não cria leads**.

### 1.2 Sequência observada (por evidência, não por leitura do workflow)

Cadeia inferida a partir de timestamps e dos campos preenchidos:

```
Microsoft Graph (poll)
        │
        ▼
[Classificador IA]   ──► email_threads.category, ai_summary
        │
        ▼
[Código "Check/Create Lead"]   ──► POST /items/leads   ◄── PONTO DE SAÍDA
        │                                  │
        │                                  └─► source: "email_inbound"
        │                                      status: "new"
        │                                      email, display_name, phone
        │                                      (só estes — o resto fica null)
        ▼
[Follow-ups, atribuição, etc.]
```

### 1.3 Evidência de que é cenário (a)

- `lead#1791` (Douglas Ribeiro, reclamacao) tem `date_created =
  2026-07-15T13:09:18.669Z`. A thread correspondente (mesmo `from_address`
  e mesma janela temporal) tem `date_created = 2026-07-15T13:09:18.904Z`.
  Delta ≈ 235 ms — consistente com um POST HTTP directo, não com um
  pipeline assíncrono com etapa intermédia visível.
- O schema `leads` tem `source_event_id: null` em todas as 13 leads
  `email_inbound`. Se houvesse um endpoint nosso, era natural que ele
  tivesse escrito um identificador próprio (ex.: UUID do job). Não há.
- O OAS do Directus (`/server/specs/oas`, 444 KB, 153 paths) não tem
  nenhum endpoint custom fora dos paths padrão do Directus. Procurámos:
  `/versions`, `/comments` aparecem, mas não há `/crm/*`, `/triage/*`,
  `/email/*` nem semelhante. Conclusão: **não há hook/endpoint nosso
  exposto** que receba o evento depois de classificar.

### 1.4 Conclusão

O gate tem de viver **antes** do POST `/items/leads` — ou seja, dentro do
nó "Check/Create Lead" dos dois workflows n8n. A decisão de implementação
é do operador que edita o n8n (Claude noutro canal); este documento
limita-se a descrever o estado actual e a propor a alteração.

## 2. Regras de encaminhamento propostas

| Categoria                 | Cria lead? | Tag/Prioridade          | Status da thread |
|---------------------------|------------|-------------------------|------------------|
| `pedido_orcamento`        | Sim        | (sem tag)               | `queued` (mantém) |
| `compra_cliente`          | Sim        | (sem tag)               | `queued` (mantém) |
| `reclamacao`              | Sim        | tag `pos-venda`, urgência alta | `replied` (mantém) |
| `tabela_precos_fornecedor`| **Não**    | —                       | `sourcing`       |
| `fornecedor_sourcing`     | **Não**    | —                       | `sourcing`       |
| `fornecedor_novidade` *(novo)* | **Não** | —                  | `novidade`       |
| `spam`                    | **Não**    | —                       | `arquivado`      |
| `fatura_administrativo`   | **Não**    | —                       | `administrativo` |

> **Princípio:** nenhum email de fornecedor, factura ou spam volta a criar
> lead. Reclamação é o único caso especial (cria, mas como pós-venda).

## 3. Nova categoria: `fornecedor_novidade`

A categoria **não existe hoje** (verificado: valores presentes em
`email_threads.category` são `pedido_orcamento`, `reclamacao`,
`fatura_administrativo`, `tabela_precos_fornecedor`, `fornecedor_sourcing`,
`compra_cliente`, `spam`).

### 3.1 Sugestão de patch ao prompt classificador (a aplicar pelo operador n8n)

Adicionar ao System Prompt do nó classificador o seguinte bloco **antes**
da lista de categorias existentes:

```
Nova categoria: fornecedor_novidade.

Diferença crítica vs fornecedor_sourcing:
- fornecedor_novidade = email de um fornecedor JÁ CONHECIDO que apenas
  comunica informação / novidades de produto (newsletter, anúncio de gama,
  promoção sazonal, atualização de catálogo). NÃO quer vender nada a nós
  nesta mensagem; está a informar.
- fornecedor_sourcing = tentativa activa de vender à HotelEquip (cold
  outreach, prospecção, pedido de reunião comercial, oferta de serviços
  não solicitados).

Distinção prática:
- Tem CTAs comerciais (pedir demo, agendar reunião, ligar)?
  → fornecedor_sourcing
- É newsletter / comunicado / "acabou de sair" / "nova gama" / "vejam o
  nosso catálogo"?
  → fornecedor_novidade

Exemplos:
1. "Lançamento: nova gama de fornos convectivos GN 1/1 com controlo
   digital. Veja o catálogo em anexo. — Equipa Edenox Portugal"
   → fornecedor_novidade (informação de produto, sem CTA comercial directo)

2. "Olá, somos a X novos representantes em Portugal de câmaras frigoríficas.
   Podemos agendar uma reunião esta semana para vos apresentar a gama?"
   → fornecedor_sourcing (cold outreach, CTA comercial directo)
```

Não é necessário alterar o schema `email_threads.category` — é uma string
livre. O Directus aceita o valor sem migração.

## 4. Povoamento da lead (design, ainda não implementado)

Quando a categoria **manda criar lead**, o nó "Check/Create Lead" deve
extrair via proxy n8n (https://n8n.hotelequip.pt/webhook/ai-proxy) os
campos abaixo e gravar nos campos próprios da lead:

| Campo do email                          | Campo da lead `leads`        |
|-----------------------------------------|------------------------------|
| Nome da pessoa (assinatura/From)        | `contact_person`             |
| Empresa (assinatura)                    | (futuro `company_name`)      |
| Email do remetente                      | `contact_email` + `email`    |
| Telefone (assinatura/corpo)             | `contact_phone` + `phone`    |
| NIF (assinatura)                        | `nif`                        |
| Cidade (assinatura/corpo)               | `city`                       |
| Código postal (assinatura/corpo)        | `postal_code`                |
| Website (assinatura/corpo)              | `website`                    |
| Nome para mostrar (empresa + pessoa)    | `display_name`               |
| Produtos mencionados no corpo           | `lead_data.itens` + `sku_history` |
| Urgência / prazo indicado               | `commercial_notes`           |

> A extracção já existente **no frontend** (ao abrir a lead) mantém-se como
> fallback. Para evitar duplicar leads quando ambos os lados escrevem, o
> nó n8n deve usar `dedupe_key = phone:<9dígitos>` ou `email:<addr>`
> (já implementado em `src/integrations/directus/leads.ts:79`). A
> extracção ao abrir verifica primeiro a presença do `dedupe_key`; se já
> existe, não cria segunda lead.

### Esquema JSON sugerido para `lead_data.itens`

```json
{
  "itens": [
    {
      "texto_bruto": "vitrina refrigerada 700L",
      "sku": null,
      "quantidade": 2,
      "confianca": 0.7
    },
    {
      "texto_bruto": "forno de convecção a gás",
      "sku": null,
      "quantidade": 1,
      "confianca": 0.6
    }
  ],
  "urgencia": "prazo 2 semanas",
  "prazo": "2026-08-01"
}
```

O campo `confianca` (0–1) é o score que o proxy n8n devolve — facilita
filtrar extracções duvidosas no UI.

## 5. O que falta fazer (alinhado com tarefas #2–#5 do sprint final)

| # | Dono                                  | Estado |
|---|---------------------------------------|--------|
| 1 | Documentar fluxo (este doc)           | ✅ |
| 2 | Patch do nó "Check/Create Lead" no n8n (gate + povoamento) | Pendente — operador n8n |
| 3 | Patch do System Prompt do classificador (categoria `fornecedor_novidade`) | Pendente — operador n8n |
| 4 | Limpeza histórica: leads existentes (backup + status=rejected) | Pendente — Claude (repo) |
| 5 | Testes reais T1-T3 | Pendente — Claude, **só após** confirmação de #2/#3 |

## 6. Anexo: queries de validação usadas

```bash
# Threads recentes com categoria
curl -sS -g "https://api.hotelequip.pt/items/email_threads?limit=500&filter%5Bdate_created%5D%5B_gte%5D=2026-06-01T00:00:00Z&fields=id,from_address,category,status,mailbox,date_created,subject" \
  -H "Authorization: Bearer $TOKEN" | python -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d['data']))"

# Leads email_inbound
curl -sS -g "https://api.hotelequip.pt/items/leads?limit=500&filter%5Bsource%5D%5B_eq%5D=email_inbound&fields=id,source,status,date_created,display_name,email" \
  -H "Authorization: Bearer $TOKEN" | python -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d['data']))"
```

Resultados 15/07/2026:
- Threads Jun-Jul: **331** (não 14 como estimado inicialmente — o filtro
  anterior tinha encoding errado).
- Leads `email_inbound`: **13** totais.