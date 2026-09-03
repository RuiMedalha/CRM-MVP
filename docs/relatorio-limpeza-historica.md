# Relatório — Limpeza Histórica de Leads (15/07/2026)

## Resumo

- **46 leads** marcadas como `status=rejected` com note `triagem automática: <categoria>`
- **0 leads** eliminadas
- **Backup**: `docs/backups/leads_pre_limpeza_2026-07-15.json` (46 registos, todos os campos)
- **Commit do backup**: `8e2cb8a` (commitado ANTES de qualquer PATCH)

## Critérios de selecção

Leads com `source ∈ {email, email_inbound}` cuja thread correspondente
(match por `from_address` + proximidade temporal ±1h) tem uma das seguintes
categorias que **não devem gerar lead**:

| Categoria | Qtd |
|---|---|
| `spam` | 15 |
| `tabela_precos_fornecedor` | 8 |
| `fatura_administrativo` | 7 |
| `fornecedor_sourcing` | 6 |
| `compra_fornecedor` | 5 |
| `outro` (notificações automáticas/genéricas) | 5 |
| **Total** | **46** |

## Leads intocadas (decisão manual)

- **8 NO_MATCH** (sem thread correspondente): não marcadas por falta de evidência.
- **#1796** (lati.pt, contratação pública): mantida — possível pedido real.
- **#1724, #1733** (followup_cliente): mantidas — actividade legítima.

## Tabela de confirmação (5 amostras)

| lead_id | email | status_antes | status_depois | note |
|---|---|---|---|---|
| 1716 | ventas@eutron.es | new | rejected | triagem automática: compra_fornecedor |
| 1728 | apoio@moloni.pt | new | rejected | triagem automática: fatura_administrativo |
| 1769 | giorgia.evaristo@corbyofwindsor.com | new | rejected | triagem automática: fornecedor_sourcing |
| 1778 | advertise-noreply@global.metamail.com | new | rejected | triagem automática: spam |
| 1790 | rafael@climainox.com | new | rejected | triagem automática: tabela_precos_fornecedor |

## 4 Confirmações finais

```
C1 (46 rejected com note): PASS — 46/46 OK
C2 (backup == 46 registos): PASS
C3 (exatamente 46 rejected hoje): PASS — nenhuma lead fora da lista tocada
C4 (9 intocadas — 8 NO_MATCH + #1796): PASS — 9/9 continuam com status original
```

## NO_MATCH — leads para revisão manual futura

| lead_id | email | display_name | Nota |
|---|---|---|---|
| 1715 | janaina@palaphita.com | Janaina Milward | Sem thread |
| 1723 | apoio.cliente@hotelequip.pt | Apoio ao Cliente HotelEquip | **Bug: caixa própria a gerar lead de si mesma** — corrigir separadamente |
| 1731 | mlacerda@gruposousa.pt | Mara Lacerda - Logislink | Sem thread |
| 1739 | sonia.teixeira@luber.pt | Sónia Teixeira - LUBER | Sem thread |
| 1771 | gm.lisba@safestay.com | Safestay hostels and hotels | Sem thread |
| 1775 | telmasilva@ctn.tecnico.ulisboa.pt | IST Campus Tecnológico e Nuclear | Sem thread (duplicado de #1776) |
| 1776 | telmasilva@ctn.tecnico.ulisboa.pt | IST Campus Tecnológico e Nuclear | Sem thread (duplicado de #1775) |
| 1783 | npereira@gruposousa.pt | Nádia Pereira - Logislink | Sem thread |

> **Nota sobre apoio.cliente@hotelequip.pt** (lead #1723): a própria mailbox
> da empresa está listada como lead. Provável bug no nó "Check/Create Lead"
> do n8n que não filtra emails enviados de/para si própria. A corrigir no
> patch do n8n, não aqui.

## Threads

**Não alteradas.** Conforme decisão do sprint, a thread mantém-se no status
que o n8n lhe pôs. A convergência de status (sourcing/arquivado/administrativo)
fica para tarefa separada após confirmação do patch n8n.
