# CUSTOMER CORE ANALYSIS

Versao: 0.1  
Estado: Analise tecnica inicial  
Ultima atualizacao: 2026-07-02  
Responsavel: Codex  
Branch: feature/customer-core-foundation

## 1. Estado atual

Este documento analisa a fundacao Customer Core do Hotelequip OS no repositorio `crm-lab-directus`, sem alterar logica, UI, modelo Directus ou ficheiros existentes.

Customer Core, neste contexto, corresponde ao conjunto:

- Organization
- Contacts
- Communication Events
- Timeline

A analise foi feita a partir de:

- `AGENTS.md`
- `AUDITORIA_HOTELEQUIP_OS.md`
- `SECURITY_FINDINGS.md`
- codigo e schemas atualmente presentes no repositorio

### 1.1 Arquitetura observada

| Area | Estado observado | Observacoes |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite | Aplicacao SPA com rotas protegidas e componentes shadcn/ui. |
| Backend principal | Directus | Integracao atual em `src/integrations/directus/`. |
| Backend legado | Supabase | Ainda existem cliente, tipos e hooks/componentes com queries Supabase. |
| Comunicacoes | Parcial | Existe collection `interactions`, mas tambem existem fluxos legados de chamadas/inbox. |
| Pipeline | Parcial | `deals` existe em Directus e e usado pela pagina `Pipeline`. |
| Orcamentos | Parcial/legado | Componentes e hook de `quotations` existem, mas usam Supabase. |
| Propostas | Pendente de confirmacao | As auditorias referem propostas como modulo estrategico, mas a branch atual nao expoe rotas ou componentes de propostas. |
| Organizations | Ausente | Nao existe collection `organizations`; `company_name` em `contacts` funciona como substituto incompleto. |
| Timeline unica | Parcial | `interactions` pode servir de base, mas nao existe ainda timeline canonica consolidada. |

### 1.2 Rotas relevantes observadas

| Rota | Modulo | Observacoes |
| --- | --- | --- |
| `/` | Dashboard | Entrada principal da aplicacao. |
| `/contactos` | Contactos | Usa `ContactosDirectus`. |
| `/contactos/novo` | Dashboard360 | A rota de novo contacto aponta para Dashboard360. |
| `/dashboard360/:id` | Dashboard360 / Customer 360 | Vista 360 associada a contacto/lead. |
| `/dashboard360` | Dashboard360 / Customer 360 | Entrada sem id explicito. |
| `/leads360` | Leads 360 | Gestao de leads. |
| `/pipeline` | Pipeline | Deals e oportunidade comercial. |
| `/fornecedores` | Fornecedores | Fora do nucleo Customer Core, mas relacionado com pipeline/orcamentos. |
| `/integracoes` | Integracoes | Configuracoes e ligacoes externas. |
| `/definicoes` | Definicoes | Configuracao geral. |
| `/utilizadores` | Utilizadores | Usa `UtilizadoresDirectus`. |
| `/menu` | Menu Mobile | Navegacao mobile. |

## 2. Duplicacoes

### 2.1 Duplicacoes de entidades e nomes

| Conceito | Implementacoes ou nomes encontrados | Risco |
| --- | --- | --- |
| Contacto | `contacts`, `contactos`, `contact_id`, `customer_id` | Ambiguidade entre nome tecnico, nome UI e relacao comercial. |
| Empresa | `company_name` dentro de `contacts` | Empresa nao existe como entidade propria; risco de duplicacao de empresas por contacto. |
| Organization | Ausente | A entidade central definida no produto ainda nao existe no codigo/schemas atuais. |
| Lead | `leads`, fluxos `Inbox`, `CallPopup`, `LeadPopup360` | Entrada de leads pode estar repartida por fluxos novos e legados. |
| Comunicacao | `interactions`, chamadas, inbox, conversas/mensagens referidas nas auditorias | Falta uma definicao canonica unica de evento de comunicacao. |
| Orçamento | `quotations` em Supabase, componentes `Quotation*`, secao em `DealDialog` | Modulo comercial ainda nao esta alinhado com Directus. |
| Proposta | Referida em auditorias, nao confirmada no snapshot atual | Pendente de confirmacao antes de qualquer migracao. |
| Pipeline | `deals`, `deal_items`, pagina `Pipeline` | Parcialmente Directus, com dependencia de contactos. |

### 2.2 Duplicacoes de frontend

| Area | Ficheiros | Observacoes |
| --- | --- | --- |
| Contactos Directus | `src/pages/ContactosDirectus.tsx`, `src/hooks/useContacts.ts`, `src/integrations/directus/contacts.ts` | Caminho atual mais alinhado com Directus. |
| Contactos legados | `src/pages/Contactos.tsx`, `src/pages/ContactoNovo.tsx`, `src/pages/ContactoDetalhe.tsx` | Devem ser inventariados antes de remover ou migrar. |
| Leads/entrada | `src/pages/Leads360.tsx`, `src/pages/Inbox.tsx`, `src/components/CallPopup.tsx`, `src/components/LeadPopup360.tsx` | Existem multiplos pontos de entrada. |
| Pipeline/orcamentos | `src/pages/Pipeline.tsx`, `src/components/deals/DealDialog.tsx`, `src/components/deals/QuotationsSection.tsx`, `src/hooks/useQuotations.ts` | Pipeline em Directus; orcamentos ainda com Supabase. |

### 2.3 Duplicacoes tecnicas

| Tema | Evidencia | Risco |
| --- | --- | --- |
| Directus vs Supabase | `src/integrations/directus/` e `src/integrations/supabase/` coexistem | Escritas/leitura podem divergir entre fontes. |
| `contacts` vs `contactos` | Directus usa `contacts`; `scripts/purge-directus.js` refere `contactos` | Script pode apontar para collection inexistente ou antiga. |
| Comunicacoes | `interactions` em Directus; chamadas/inbox em fluxos legados | Historico do cliente pode ficar incompleto. |
| Configuracoes de integracoes | `company_settings` contem tokens/URLs de varios servicos | Deve ser validado contra riscos de exposicao no frontend. |

## 3. Collections envolvidas

### 3.1 Collections Directus presentes

| Collection | Ficheiro | Papel atual | Relacao com Customer Core |
| --- | --- | --- | --- |
| `contacts` | `directus/collections.crm-lab.json` | Contactos/clientes com dados comerciais e logisticos | Entidade principal atual para pessoas/empresas. |
| `leads` | `directus/collections.crm-lab.json` | Leads de entrada com origem, estado e payload | Entrada comercial antes de conversao para contacto. |
| `interactions` | `directus/collections.crm-interactions.json` | Eventos de interacao recebidos | Base possivel para Communication Events/Timeline. |
| `deals` | `directus/collections.crm-sales.json` | Oportunidades comerciais | Depende de `contacts` via `customer_id`. |
| `deal_items` | `directus/collections.crm-sales.json` | Linhas de oportunidade | Depende de `deals`. |
| `manufacturers` | `directus/collections.crm-sales.json` | Fabricantes/fornecedores comerciais | Relacionado com deals e orcamentos. |
| `employees` | `directus/collections.crm-sales.json` | Utilizadores/equipa | Suporte operacional. |
| `company_settings` | `directus/collections.crm-sales.json` | Configuracoes e credenciais de integracoes | Area sensivel de seguranca. |

### 3.2 Collections esperadas mas nao confirmadas no snapshot atual

| Collection/conceito | Estado | Observacoes |
| --- | --- | --- |
| `organizations` | Ausente | Entidade central definida no produto, ainda nao presente. |
| `communication_events` | Ausente | `interactions` e o equivalente mais proximo. |
| `conversations` | Ausente | Referido no contexto de comunicacoes, nao confirmado localmente. |
| `messages` | Ausente | Nao existe collection local confirmada. |
| `email_threads` | Ausente | Nao existe collection local confirmada. |
| `email_messages` | Ausente | Nao existe collection local confirmada. |
| `quotations` | Ausente em Directus local | Existe uso Supabase em hooks/componentes. |
| `proposals` | Pendente de confirmacao | Referido em auditorias, nao confirmado no snapshot atual. |

## 4. Ficheiros impactados

### 4.1 Customer Core direto

| Area | Ficheiros |
| --- | --- |
| Directus client | `src/integrations/directus/client.ts`, `src/integrations/directus/utils.ts` |
| Contactos Directus | `src/integrations/directus/contacts.ts`, `src/hooks/useContacts.ts`, `src/pages/ContactosDirectus.tsx` |
| Leads Directus | `src/integrations/directus/leads.ts`, `src/pages/Leads360.tsx`, `src/components/LeadPopup360.tsx`, `src/hooks/useLeadListener360.ts` |
| Dashboard360 / Customer 360 | `src/pages/Dashboard360.jsx` |
| Pipeline | `src/integrations/directus/deals.ts`, `src/hooks/useDeals.ts`, `src/pages/Pipeline.tsx`, `src/components/deals/DealDialog.tsx`, `src/components/deals/DealCard.tsx` |
| Directus schemas | `directus/collections.crm-lab.json`, `directus/collections.crm-interactions.json`, `directus/collections.crm-sales.json` |

### 4.2 Ficheiros legados ou em transicao

| Area | Ficheiros | Observacoes |
| --- | --- | --- |
| Supabase client/tipos | `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts` | Ainda presente e referenciado. |
| Contactos legados | `src/pages/Contactos.tsx`, `src/pages/ContactoNovo.tsx`, `src/pages/ContactoDetalhe.tsx` | Necessitam classificacao antes de qualquer remocao. |
| Inbox/chamadas | `src/pages/Inbox.tsx`, `src/hooks/useCalls.ts`, `src/hooks/useCallListener.ts`, `src/components/CallPopup.tsx`, `src/components/inbox/NewLeadDialog.tsx` | Podem representar entrada de comunicacoes fora do novo fluxo Directus. |
| Orcamentos | `src/hooks/useQuotations.ts`, `src/components/deals/QuotationsSection.tsx`, `src/components/quotations/QuotationCreator.tsx`, `src/components/quotations/QuotationPreview.tsx`, `src/components/quotations/QuotationSidebar.tsx` | Uso de `quotations` via Supabase. |
| Dashboard comercial | `src/components/dashboard/DashboardActionCenter.tsx` | Usa estado/queries relacionadas com `quotations`. |
| Scripts | `scripts/purge-directus.js` | Refere `contactos`, divergente de `contacts`. |

## 5. Dependencias entre modulos

| Modulo | Depende de | Observacoes |
| --- | --- | --- |
| Contactos | `contacts`, Directus client, tags/notas/morada/logistica | Hoje mistura pessoa, empresa, historico rapido e dados comerciais. |
| Leads 360 | `leads`, `contacts`, listeners/polling | Pode criar ou encaminhar para Dashboard360; depende de deduplicacao correta. |
| Comunicacoes | `interactions`, chamadas/inbox legados, integracoes externas | Ainda nao existe uma timeline unica confirmada. |
| Dashboard360 / Customer 360 | `contacts`, `leads` | Deve ser protegido contra perda de historico durante migracao. |
| Pipeline | `deals`, `contacts`, `deal_items`, `manufacturers` | `deals.customer_id` aponta para `contacts`. |
| Propostas | Pendente de confirmacao | Auditorias indicam modulo estrategico, mas snapshot atual nao confirma implementacao ativa. |
| Orcamentos | `quotations` em Supabase, `deals`, `contacts` | Dependencia comercial existe, mas nao esta alinhada com Directus. |
| Fornecedores | `manufacturers` | Relacionado com pipeline e orcamentos, mas fora do nucleo Customer Core. |

### 5.1 Fluxo funcional inferido a partir do codigo

1. Uma entrada pode surgir como lead ou interacao.
2. Leads podem ser analisadas em `Leads360` e encaminhadas para `Dashboard360`.
3. `Dashboard360` usa contacto/lead para construir a vista 360.
4. `Pipeline` cria ou gere `deals` associados a `contacts`.
5. Orcamentos podem ser associados a deals, mas o caminho atual usa Supabase.

Este fluxo deve ser confirmado com dados reais e com o inventario Directus antes de qualquer implementacao.

## 6. Riscos

| Prioridade | Risco | Impacto | Ficheiros/areas |
| --- | --- | --- | --- |
| P0 | Perda de contactos durante migracao | Contactos sao a base comercial; perda ou duplicacao afeta operacao | `contacts`, paginas de contactos, Dashboard360 |
| P0 | Perda de comunicacoes/historico | A timeline unica depende de preservar eventos existentes | `interactions`, inbox/chamadas, integracoes |
| P0 | Ausencia de Organization canonica | Empresas ficam embutidas em contactos, dificultando deduplicacao | `contacts.company_name`, `deals.customer_id` |
| P0 | Fontes de verdade concorrentes | Directus e Supabase coexistem em modulos centrais | `src/integrations/directus/`, `src/integrations/supabase/` |
| P1 | Relacoes fracas por `contact_id` string | Leads/interactions podem ficar sem integridade referencial | `leads.contact_id`, `interactions.contact_id` |
| P1 | Orcamentos fora de Directus | Pipeline e orcamentos podem divergir | `useQuotations.ts`, componentes `Quotation*` |
| P1 | Naming inconsistente `contacts/contactos/customer` | Scripts e UI podem apontar para conceitos diferentes | `scripts/purge-directus.js`, rotas/contactos |
| P1 | Polling/listeners multiplos | Risco de duplicar eventos, popups ou chamadas | `useLeadListener360.ts`, `useCallListener.ts`, `CallPopup.tsx` |
| P2 | Tipagem permissiva | Uso de `any` dificulta migracoes seguras | varios ficheiros em `src/` |
| P2 | Configuracoes sensiveis acessiveis pelo frontend | Tokens/segredos em settings podem ser expostos se lidos no cliente | `company_settings`, integracoes |

## 7. Plano de migracao proposto

Este plano e apenas uma proposta tecnica de preparacao. Nao deve ser executado sem nova aprovacao, inventario de dados e backups.

### Fase 0 - Inventario e congelamento de risco

| Acao | Objetivo |
| --- | --- |
| Confirmar collections reais em Directus producao | Evitar migrar com base apenas nos JSON locais. |
| Exportar contagens e amostras anonimizadas | Validar duplicados, campos usados e campos vazios. |
| Listar todos os pontos de escrita | Saber que modulos criam contactos, leads, interacoes, deals e orcamentos. |
| Confirmar estado de Supabase | Saber se ainda e fonte ativa ou apenas legado. |

### Fase 1 - Definir modelo canonico em documento

| Entidade canonica | Origem atual provavel | Decisao necessaria |
| --- | --- | --- |
| Organization | `contacts.company_name` | Definir regras de deduplicacao por nome, NIF, dominio e telefone. |
| Contact | `contacts.contact_name`, email, phone, whatsapp | Separar pessoa de empresa. |
| Communication Event | `interactions`, chamadas, inbox, mensagens | Escolher se `interactions` evolui ou se nasce `communication_events`. |
| Timeline Item | Eventos derivados de comunicacoes, leads, deals, orcamentos | Definir agregacao sem duplicar dados. |

### Fase 2 - Mapear dados sem alterar schema

| Acao | Resultado esperado |
| --- | --- |
| Criar matriz campo atual -> campo canonico | Permitir migracao auditavel. |
| Definir chaves de deduplicacao | Reduzir risco de duplicados de empresas/contactos. |
| Classificar dados legados Supabase | Separar ativo, historico e descartavel. |
| Identificar eventos nao representados em `interactions` | Garantir que comunicacoes nao se perdem. |

### Fase 3 - Preparar adaptadores antes da UI

| Acao | Resultado esperado |
| --- | --- |
| Especificar servico de leitura Customer Core | Evitar que UI dependa diretamente de nomes transitorios. |
| Especificar writers autorizados | Controlar onde nascem contactos, leads e eventos. |
| Definir contrato da timeline | Permitir Dashboard360 consistente. |

### Fase 4 - Migracao controlada

| Acao | Resultado esperado |
| --- | --- |
| Migrar primeiro em ambiente isolado | Validar contagens e relacoes. |
| Comparar antes/depois | Garantir zero perda de contactos e comunicacoes. |
| Ativar por modulos | Contactos e comunicacoes antes de pipeline/orcamentos. |

### Fase 5 - Pipeline, orcamentos e propostas

| Acao | Resultado esperado |
| --- | --- |
| Alinhar `deals.customer_id` com Organization/Contact | Evitar que deals fiquem presos a modelo antigo. |
| Decidir destino de `quotations` | Migrar ou manter temporariamente ate Customer Core estabilizar. |
| Definir Propostas Interativas | Tratar como modulo estrategico, nao como limpeza tecnica. |

## 8. O que nao deve ser alterado ainda

| Area | Motivo |
| --- | --- |
| Schema Directus | Ainda falta confirmar estado real, dados existentes e dependencias. |
| UI de Contactos/Dashboard360/Leads360/Pipeline | Alteracoes prematuras podem quebrar operacao. |
| Collections `contacts`, `leads`, `interactions`, `deals` | Sao pontos centrais; qualquer mudanca exige plano de migracao. |
| Nomes `contacts/contactos` | Primeiro deve existir matriz de compatibilidade e scripts verificados. |
| Fluxos Supabase legados | Nao devem ser apagados sem confirmar se ainda contem dados ou funcionalidades ativas. |
| Orcamentos/quotations | Dependem de pipeline e podem conter historico comercial. |
| Propostas | Modulo estrategico; nao deve ser absorvido por uma migracao tecnica sem especificacao. |
| n8n/integracoes | Nao ha diretorio local `n8n` no snapshot atual; fluxos reais devem ser inventariados fora do repositorio. |
| Credenciais/configuracoes | Devem ser tratadas em hardening separado, sem misturar com migracao de Customer Core. |

## 9. Pesquisas executadas

Foram pesquisados os termos:

- `contacts`
- `contactos`
- `contactsid`
- `companies`
- `organizations`
- `leads`
- `communication_events`
- `conversations`
- `messages`
- `email_threads`
- `email_messages`
- `deals`
- `quotations`
- `proposals`
- `orcamentos`
- `Dashboard360`
- `Customer 360`
- `Pipeline`
- `Propostas`
- `Orcamentos`

Tambem foram pesquisados sinais tecnicos:

- `directusRequest`
- `directusAdminFetch`
- `localStorage`
- `setInterval`
- `setTimeout`
- `any`
- `TODO`
- `FIXME`

Observacao: os diretorios `n8n` e `docs` nao existem no snapshot atual deste repositorio. As referencias a n8n e documentos de produto foram obtidas dos ficheiros de auditoria e contexto ja versionados no repositorio.

## 10. Recomendacoes

1. Nao iniciar implementacao de Organization antes de confirmar dados reais em Directus.
2. Tratar `contacts` como fonte operacional atual ate existir migracao aprovada.
3. Preservar integralmente `interactions` e fluxos legados de entrada ate a timeline unica estar validada.
4. Criar uma especificacao de Customer Core antes de escrever codigo.
5. Separar hardening de seguranca, migracao de dados e redesenho funcional em sprints diferentes.
6. Confirmar se Supabase ainda contem dados ativos antes de remover qualquer dependencia.
7. Confirmar se Propostas Interativas existem noutro branch/repositorio antes de decidir implementacao.
8. Fazer backup e ensaio de migracao antes de alterar collections centrais.
