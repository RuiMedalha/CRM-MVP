# CUSTOMER360 — ESPECIFICAÇÃO FUNCIONAL

**Data:** 03/07/2026
**Versão:** 1.0
**Estado:** Definitivo
**Papel:** Ponte entre Design (Lovable) e Implementação (CRM)

---

## 1. ENTITY MASTER — Comportamento funcional

### 1.1 Criar Entidade

| Aspecto | Comportamento |
|---------|---------------|
| **Trigger** | /customer360-shell/novo OU /customer360-shell?phone=X&name=Y |
| **Campos mínimos** | company_name + (phone OU email) |
| **Validação** | NIF: 9 dígitos. Email: formato válido. Phone: 7+ chars |
| **Tabela** | POST /items/contacts |
| **Defaults** | entity_type: "empresa", entity_status: "active", roles: ["cliente"] |
| **Após criar** | Navega para /customer360-shell/:newId |
| **Evento** | OrganizationCreated (timeline) |
| **Notificação** | Nenhuma (criação silenciosa) |
| **Prefill** | URL params: name, company_name, phone, email, source, nif, leadId |
| **Lead linking** | Se leadId presente: PATCH /items/leads/:leadId { contact_id, status: "processed" } |

### 1.2 Editar Entidade

| Aspecto | Comportamento |
|---------|---------------|
| **Trigger** | Tab "Editar ficha" no Customer360 OU clique em campo do Resumo |
| **Fonte** | GET /items/contacts/:id?fields=* |
| **Gravação** | PATCH /items/contacts/:id (apenas campos alterados) |
| **Validação pre-save** | company_name obrigatório. NIF formato. Email formato. |
| **Cache** | queryClient.refetchQueries(["customer360", id]) após save |
| **Feedback** | "Guardado" (verde) ou erro (vermelho) na SaveBar |
| **Cancelar** | Restaura valores do último fetch |
| **Evento** | Nenhum evento explícito hoje. LACUNA: deveria criar TimelineEvent de auditoria. |

### 1.3 Campos editáveis hoje

| Campo Directus | Secção | Tipo |
|----------------|--------|------|
| company_name | Dados Gerais | string |
| nif | Dados Fiscais | string |
| phone | Contactos | string |
| email | Contactos | string (email) |
| website | Dados Gerais / Redes | string (url) |
| address | Moradas | string |
| postal_code | Moradas | string |
| city | Moradas | string |
| district | Moradas | string |
| source | Comercial | string |
| segment | Comercial | string |
| business_type | Comercial | string |
| assigned_to | Comercial | string |
| entity_type | Classificação | enum |
| entity_status | Classificação | enum |
| roles | Classificação | json array |

### 1.4 Eliminar

| Aspecto | Comportamento |
|---------|---------------|
| **Implementado** | NÃO. Não existe botão de eliminação no Customer360. |
| **Razão** | DOMAIN_MODEL: "Nunca é apagada. A história preserva-se." |
| **Alternativa** | Mudar entity_status para "inactive" ou "blocked" |

### 1.5 Alterar Papéis

| Aspecto | Comportamento |
|---------|---------------|
| **UI** | Botões toggle na secção Classificação da Ficha Mestre |
| **Gravação** | PATCH /items/contacts/:id { roles: ["cliente", "fornecedor"] } |
| **Impacto no Customer360** | Badges actualizam imediatamente. Secções condicionais (Fornecedor) aparecem/desaparecem. |
| **Evento** | LACUNA: deveria criar OrganizationRoleAdded/Removed |

### 1.6 Alterar Estado

| Aspecto | Comportamento |
|---------|---------------|
| **UI** | Botões na secção Classificação (active/inactive/blocked) |
| **Gravação** | PATCH /items/contacts/:id { entity_status: "inactive" } |
| **Impacto** | Badge no header muda. |
| **Evento** | LACUNA: deveria criar OrganizationBecameInactive |

---

## 2. CUSTOMER360 — Comportamento funcional

### 2.1 Header

| Elemento | Fonte | Actualiza quando |
|----------|-------|------------------|
| Nome empresa | contacts.company_name | Após edit + refetch |
| Badges roles | contacts.roles (JSON) | Após edit |
| Badge status | contacts.entity_status | Após edit |
| NIF, cidade, telefone, email, website | contacts.* | Após edit |
| Responsável | contacts.assigned_to | Após edit |
| Último contacto | Calculado: max(communication_events.created_at, interactions.date_created) | Cada load |
| Cliente desde | contacts.date_created | Imutável |
| KPIs (valor, pipeline, ganhos, perdidos) | Calculados de deals + quotations | Cada load |
| Health Score | CustomerHealthService (5 factores) | Cada load |
| Pipeline Kanban | Stage da oportunidade activa mais avançada | Cada load |
| Próxima acção | CustomerNextActionService (4 regras) | Cada load |

### 2.2 Command Center (tab Geral)

| Painel | Dados | Fonte Directus |
|--------|-------|----------------|
| **Prioridades** | Calculadas (propostas sem resposta, WA pending, opp parada, sem contacto) | CustomerPriorityService sobre Customer360Data |
| **Acontecimentos recentes** | Últimos 6 eventos (timeline + proposals) merged e sorted | communication_events + interactions + quotations |
| **Comunicações** | Últimos 8 por canal | communication_events + interactions |
| **Organização** | 12 campos (NIF, morada, etc.) | contacts.* |
| **Contactos** | Lista de pessoas | contacts.* (hoje: 1 registo = 1 pessoa. Futuro: entity_people) |
| **KPIs** | Valor anual, potencial, propostas, taxa sucesso, dias s/ contacto | Calculados |
| **Oportunidades** | Lista activa | deals WHERE customer_id = :id |
| **Propostas** | Lista | quotations WHERE customer_id = :id |
| **Sugestões IA** | 4 regras baseadas em dados | CustomerRecommendationService |

### 2.3 Quick Actions

| Botão | Comportamento actual | Estado |
|-------|---------------------|--------|
| Ligar | Visual apenas | LACUNA: deveria abrir Wavoip click-to-call |
| WhatsApp | Visual apenas | LACUNA: deveria abrir wa.me/:phone |
| Email | Visual apenas | LACUNA: deveria abrir mailto: |
| Nova proposta | Visual apenas | LACUNA: deveria navegar /propostas/nova?customer_id=:id |
| Nova oportunidade | Visual apenas | LACUNA: deveria criar deal |
| Nova nota | Visual apenas | LACUNA: deveria abrir input na timeline |
| Nova tarefa | Visual apenas | LACUNA: deveria abrir modal follow-up |
| Agendar visita | Visual apenas | LACUNA |
| Assistência | Visual apenas | LACUNA (módulo futuro) |

### 2.4 Tabs

| Tab | Conteúdo | Implementado |
|-----|----------|-------------|
| Geral | Command Center (3 colunas) | SIM |
| Editar ficha | EntityMaster (14 secções) | SIM |
| Comunicações | TimelinePanel (full) | SIM |
| Propostas | ProposalPanel | SIM |
| Oportunidades | OpportunityPanel | SIM |
| Follow-ups | Placeholder (link Dashboard360) | PARCIAL |
| Histórico | TimelinePanel (full) | SIM |

---

## 3. COMMUNICATION WORKSPACE

### 3.1 WhatsApp

| Aspecto | Comportamento |
|---------|---------------|
| **Entrada** | n8n webhook recebe mensagem de Evolution (918) ou Meta Cloud API (913) → POST /items/messages + PATCH /items/conversations |
| **Polling** | conversationPolling.ts cada 10s (fetchConversationsWithFallback) |
| **Resolução identidade** | conversations.contact_id → contacts.id |
| **Envio** | resolveWhatsAppProvider(conv) → Evolution (918 default) ou Meta (913) |
| **Envio media** | uploadToDirectus → sendMediaViaWA913 ou sendImageViaEvolution |
| **PATCH mensagem** | Após envio: PATCH /items/messages/:id { attachments, delivery_status: "sent" } |
| **Timeline** | messages + conversations aparecem na timeline do Customer360 via communication_events |
| **Notificação** | useCommunicationNotifications poll 8s → pushToast se nova mensagem |

### 3.2 Email

| Aspecto | Comportamento |
|---------|---------------|
| **Entrada** | n8n workflow recebe email → POST /items/email_threads + POST /items/email_messages |
| **Classificação** | n8n classifica: categoria (pedido_orcamento, reclamacao, etc.) + urgência + ai_summary + ai_draft |
| **Polling** | useEmailThreads (React Query refetchInterval: 30s) |
| **Resolução identidade** | email_threads.contact_id ← lookup por from_address contra contacts.email |
| **Atribuição** | PATCH /items/email_threads/:id { assigned_to, assigned_at, status: "assigned" } |
| **Resposta** | Copy-to-clipboard do ai_draft → utilizador cola no Outlook |
| **Timeline** | LACUNA: email_threads NÃO aparecem ainda no Customer360 timeline (só communication_events) |
| **SLA** | Calculado localmente: sla_due_at - now(). Verde >4h, Amarelo 1-4h, Vermelho <1h |

### 3.3 Telefonia (Telecof/Wavoip)

| Aspecto | Comportamento |
|---------|---------------|
| **Entrada** | n8n cria communication_event com channel=telecof/wavoip, status=new |
| **Polling** | listNewIncomingCalls cada 10s (TelecofBanner) |
| **Resolução** | Procura contacts por phone normalizado |
| **Banner** | TelecofBanner aparece quando status=new |
| **Criar contacto** | TelecofCustomerPanel: createContact se não existir → navega Customer360 |
| **Wavoip live** | CustomEvent "wavoip:incoming" → banner com click-to-answer |
| **Timeline** | communication_events.contact_id aparece no Customer360 timeline |

### 3.4 Como comunicam entre si

```
WhatsApp/Email/Telefone
       ↓
n8n cria registo (messages / email_threads / communication_events)
       ↓
Polling detecta novo registo
       ↓
UI actualiza (Inbox list / TelecofBanner / Email list)
       ↓
Resolução de identidade (contact_id)
       ↓
Customer360 timeline actualiza (via useCustomer360 refetch)
```

---

## 4. DRAWERS

| Aspecto | Estado actual |
|---------|---------------|
| **Implementado** | NÃO. Drawers estão planeados (R7 do roadmap) mas não implementados. |
| **Comportamento futuro** | EntityMaster com renderMode="drawer" abre lateral direito sem fechar o contexto (inbox, pipeline, etc.) |
| **Fechar** | Esc fecha sem perder dados. Confirmação se dirty. |
| **Guardar** | Mesmo PATCH que modo full. Cache invalida. |
| **Comunicação** | useEntity(id) partilhado — qualquer save num drawer actualiza todos os consumidores. |

---

## 5. TIMELINE

### 5.1 Fontes de dados

| Fonte | Collection | Filtro | Campos usados |
|-------|-----------|--------|---------------|
| Chamadas/eventos | communication_events | contact_id = :id | id, channel, event_type, direction, agent_name, created_at |
| Interações | interactions | contact_id = :id | id, type, direction, phone, email, display_name, occurred_at |
| Propostas | quotations | customer_id = :id | id, quotation_number, status, total_amount, sent_at |
| Deals | deals | customer_id = :id | id, title, status, total_amount |

### 5.2 Eventos NOT yet in timeline

| Fonte | Deveria mostrar | Estado |
|-------|----------------|--------|
| email_threads | Emails recebidos/enviados | LACUNA |
| messages (WhatsApp) | Mensagens WA | LACUNA (via conversations.contact_id) |
| follow_ups | Tarefas agendadas/completas | LACUNA |
| quotation_views_log | Cliente visualizou proposta | LACUNA |

### 5.3 Filtros

| Filtro | Implementado |
|--------|-------------|
| Por tipo (email/WA/phone/note) | NÃO (timeline mostra tudo junto) |
| Por data | NÃO |
| Pesquisa texto | NÃO |

### 5.4 IA na timeline

| Feature | Implementado |
|---------|-------------|
| Resumo automático | NÃO (sugestões IA existem no painel, não na timeline) |
| Sugerir resposta | NÃO |
| Detectar sentimento | NÃO |

---

## 6. NOTIFICAÇÕES

| Tipo | Implementado | Comportamento |
|------|-------------|---------------|
| Nova chamada (banner) | SIM | TelecofBanner com countdown |
| Nova mensagem WA | SIM | Badge unreadCount no sidebar |
| Lead popup | SIM | LeadPopup360 com timer 18s |
| Push (browser) | SIM | Web Push via push_subscriptions + push-sw.js |
| Email urgente | SIM | Toast na página Email (urgency=high/critical) |
| Proposta vista | NÃO | LACUNA |
| Proposta aprovada | NÃO | LACUNA (n8n poderia disparar) |
| Follow-up vencido | NÃO | LACUNA |

---

## 7. IA

| Comportamento | Implementado | Trigger |
|---------------|-------------|--------|
| Gerar termos e condições | SIM | Botão no StepSettings |
| Gerar welcome message | SIM | Botão no StepContent |
| Gerar descrição produto | SIM | Botão inline por produto |
| Gerar next steps | SIM | Botão no StepSettings |
| Sugestões Customer360 | SIM (rules) | Calculado no load (CustomerRecommendationService) |
| Resumo email (ai_summary) | SIM | n8n no momento de ingestão do email |
| Rascunho resposta (ai_draft) | SIM | n8n no momento de ingestão do email |
| Health Score | SIM (rules) | Calculado no load (CustomerHealthService) |
| Sugerir follow-up | NÃO | LACUNA |
| Detectar risco de churn | NÃO | LACUNA |
| Auto-classificar lead | NÃO | LACUNA |

---

## 8. INTEGRAÇÕES

| Sistema | Entrada | Saída | Sincronização |
|---------|---------|-------|---------------|
| **Directus** | Todas as leituras/escritas | CRUD contacts, deals, quotations, messages, etc. | Tempo real (cada request) |
| **n8n** | Webhooks: quotation-sent, cancel-followups, newsletter-subscribe, evolution-send | Recebe emails, WA, chamadas, classifica | Event-driven |
| **Evolution API** | — | Envio WA via 918 | Por mensagem |
| **Meta Cloud API** | — | Envio WA via 913 | Por mensagem |
| **Meilisearch** | — | Pesquisa de produtos (propostas) | Read-only |
| **Wavoip** | Chamadas incoming (CustomEvent) | — | Live (WebRTC) |
| **WooCommerce** | — | Webhook checkout (configurável) | Webhook |
| **Moloni** | — | Webhook sync (configurável) | Webhook |
| **Mautic** | mautic_contact_id | — | Apenas ID guardado |
| **Outlook/Microsoft 365** | NÃO INTEGRADO | — | LACUNA (email via n8n IMAP) |
| **Google Calendar** | NÃO INTEGRADO | — | LACUNA |
| **Google Maps** | NÃO INTEGRADO | — | LACUNA |

---

## 9. PERMISSÕES

| Aspecto | Estado |
|---------|--------|
| Role-based access | NÃO (todos vêem tudo) |
| Admin token no browser | SIM (P0 segurança) |
| SuperAdmin check | Apenas para sidebar items (Integrações, Dev Tools) |
| Edição restrita | NÃO (qualquer logged-in user edita qualquer entidade) |

LACUNA CRÍTICA: O token admin (`VITE_DIRECTUS_ADMIN_TOKEN`) é usado no browser para escritas. Qualquer utilizador com DevTools pode extrair o token e ter acesso total ao Directus. Prioridade R9 do roadmap.

---

## 10. ESTADOS E TRANSIÇÕES

### Entity
| Estado | Transição |
|--------|----------|
| active | → inactive (sem actividade) |
| active | → blocked (decisão manual) |
| inactive | → active (nova actividade) |
| blocked | → active (decisão manual) |

### Proposal
| Estado | Transição |
|--------|----------|
| draft | → sent (enviar) |
| sent | → viewed (cliente abre /p/:token) |
| viewed | → approved (assinatura) |
| viewed | → rejected (recusa) |
| sent/viewed | → expired (valid_until passa) |

### Deal
| Estado | Transição |
|--------|----------|
| lead | → qualification → proposal → negotiation → closed_won/closed_lost |

---

## 11. LACUNAS FUNCIONAIS

| # | Lacuna | Impacto | Prioridade |
|---|--------|---------|------------|
| 1 | **Quick Actions sem lógica** | Botões decorativos, utilizador não pode agir | Alta |
| 2 | **Email threads não na timeline** | Histórico incompleto no Customer360 | Alta |
| 3 | **Mensagens WA não na timeline** | Idem | Alta |
| 4 | **Admin token no browser** | Segurança P0 | Crítica |
| 5 | **Sem filtros na timeline** | Impossível filtrar por canal/data | Média |
| 6 | **Sem nota inline na timeline** | UX aprovada requer, não existe | Média |
| 7 | **Follow-ups não no Customer360** | Apenas no Dashboard360 antigo | Média |
| 8 | **Proposta a partir do Customer360** | Botão existe mas sem lógica | Média |
| 9 | **Drawers não implementados** | Editar ficha sem sair do contexto | Média |
| 10 | **entity_people não existe** | Uma entidade = 1 pessoa (limitante) | Média |
| 11 | **entity_addresses não existe** | Uma morada apenas | Baixa |
| 12 | **Outlook não integrado** | Emails via IMAP/n8n apenas | Baixa |
| 13 | **Versionamento propostas** | Editar sobrepõe sem criar v2 | Média |
| 14 | **Histórico de alterações** | Sem audit trail no CRM | Média |

---

## 12. GRAU DE MATURIDADE FUNCIONAL

| Módulo | Maturidade |
|--------|------------|
| Entity Master (edição básica) | 75% |
| Customer360 (visualização) | 80% |
| Customer360 (acções) | 20% |
| Timeline | 50% |
| WhatsApp | 85% |
| Email Inbox | 70% |
| Telefonia | 75% |
| Propostas | 90% |
| Pipeline | 70% |
| Drawers | 0% |
| Notificações | 60% |
| IA | 40% |
| Permissões | 10% |
| Integrações externas | 30% |

**GLOBAL: 55%**

O sistema é funcional para operação básica mas não está completo para uso profissional autónomo.

---

## 13. RECOMENDAÇÕES (implementação)

### Sprint imediato (1 semana)
1. Ligar Quick Actions (wa.me, mailto:, /propostas/nova?customer_id)
2. Adicionar email_threads à timeline do Customer360
3. Adicionar nota inline na timeline

### Sprint seguinte (1 semana)
4. Follow-ups no Customer360 (migrar modal do Dashboard360)
5. Proposta a partir do Customer360 (pré-preencher cliente)
6. Filtros na timeline (por canal)

### Sprint de segurança (urgente, paralelo)
7. Remover admin token do browser
8. Configurar Directus Public role para leitura da página /p/:token
9. Role limitada para operadores

---

*Este documento é a especificação funcional definitiva. Toda a implementação deve seguir exclusivamente este documento.*
