# CRM HotelEquip — Estado Actual, Auditoria e Roadmap

**Data:** 10 Julho 2026  
**Branch:** `feat/modulo-propostas`  
**Última sessão:** ~60 commits, 3 dias intensivos de trabalho

---

## 1. O QUE JÁ FOI FEITO (esta sessão)

### Schema / Base de Dados
- ✅ 36+ campos criados na coleção contacts
- ✅ Schema fix uuid→integer (interactions, communication_events, leads)
- ✅ FK relations criadas (email_threads→contacts, follow_ups→contacts, leads→contacts)
- ✅ Directus actualizado para 12.1.1 com licença Open Innovation Grant
- ✅ 4 Directus endpoint extensions criadas e funcionais (/identify-contact, /wa-proxy, /ai-proxy, /email-send)

### Segurança
- ✅ Tokens WhatsApp/Meta/Evolution/AI removidos do frontend
- ✅ Proxies backend criados (tokens server-side)
- ✅ Autenticação obrigatória em todos os endpoints custom
- ✅ Admin token removido de URLs de assets

### Customer 360 (Ficha de Cliente)
- ✅ Hooks violation corrigida
- ✅ ConfigSection focus loss fix
- ✅ 69 campos editáveis no formulário (zero FutureField placeholders)
- ✅ Dropdowns dinâmicos (Distrito, País, Segmento, Tipo Negócio)
- ✅ Delivery addresses com toggle facturação/entrega
- ✅ Tags (TagSelector com add/remove)
- ✅ SKU History
- ✅ Notas inline editáveis (tab Geral)
- ✅ Notas comerciais + logística
- ✅ Newsletter Banner RGPD
- ✅ Follow-ups tab funcional (lista + criar + marcar concluído)
- ✅ 9 botões de acção todos ligados (Ligar, WhatsApp, Email, Nova proposta, etc.)
- ✅ Employee select real + "Atribuir a mim"
- ✅ Soft-delete (archive) com confirmação
- ✅ Propostas clicáveis (navega para detalhe)
- ✅ Timeline clicável (emails→/email, propostas→/propostas/:id)
- ✅ Timeline com filtros por tipo

### Contactos
- ✅ CRUD completo (criar, editar, arquivar)
- ✅ CSV Export/Import com detecção de duplicados
- ✅ Painel de duplicados + Fusão (6 tabelas migradas)
- ✅ Checkbox selection + 3 modos export
- ✅ Filtros alfabético + role + IA score
- ✅ Nome correcto na lista (fix field mapping)

### Email
- ✅ Endpoint /email-send real (Microsoft Graph API)
- ✅ HTML rendering com DOMPurify + quote collapsing
- ✅ Editor rico no reply (Bold, Italic, Underline, Lista, Link)
- ✅ IA contextual (fornecedor vs cliente)
- ✅ Assinatura preservada ao usar IA
- ✅ Assinatura editável nas Definições
- ✅ Assinatura por employee
- ✅ Anexos (upload + download autenticado)
- ✅ Botão "Criar Proposta" em emails de orçamento
- ✅ Meilisearch product suggestions + IA extraction
- ✅ Recategorizar emails (dropdown inline)
- ✅ Detecção de duplicados cross-mailbox
- ✅ Filtro "Enviados"
- ✅ Notificações de não-atribuídos (toast a cada 60s)
- ✅ Alertas urgentes persistentes (cada 15min)
- ✅ Emails na timeline Customer360

### Pipeline
- ✅ Kanban drag-and-drop fix (String(deal.id))

### WhatsApp / Comunicações
- ✅ Imagens recebidas fix (file field mapping)
- ✅ Conversation summary update após envio
- ✅ Channel registry unificado (integrations DB)
- ✅ instanceName mapping fix (918 routing correcto)
- ✅ Classificação inline (Cliente/Lead/Fornecedor/Assistência)
- ✅ Nome formatado na lista de conversas

### Telecof
- ✅ Motor de identificação central (identifyByPhoneOrEmail)
- ✅ Screen-pop enriquecido (badges: deals, propostas, interacções)
- ✅ Campos maiores e mais legíveis
- ✅ "Motivo da chamada" textarea
- ✅ Acções rápidas (Criar Proposta, WhatsApp, Email)
- ✅ Painel de contacto identificado no workspace

### Performance
- ✅ Code Splitting (-88% bundle: 3.2MB → 371KB)
- ✅ Error Boundary global

### n8n
- ✅ contact_id na criação de thread (email)
- ✅ Draft IA para TODAS as categorias
- ✅ Perspectiva de comprador para fornecedores

### Dashboard360 → Customer360Shell
- ✅ Migração completa (9/9 funcionalidades)
- ✅ Dashboard360.jsx eliminado do código
- ✅ Todas as referências actualizadas
- ✅ Menu renomeado para "Ficha de Cliente"

### Outros
- ✅ Follow-up notifications (hook com toast)
- ✅ Prompts IA editáveis (company_settings)
- ✅ AI model selector (Haiku/Sonnet/Opus)
- ✅ Templates link nas Definições
- ✅ Dashboard KPIs (emails + propostas)
- ✅ Fornecedores com export/import

---

## 2. AUDITORIA UX/DESIGN — O QUE PRECISA DE CORRIGIR

### 2.1 Tipografia (50+ items)

**Problema:** Textos de 9-10px espalhados por toda a interface. Para 8h de uso diário, o mínimo deveria ser 11px para labels e 12px para body text.

| Área | Ficheiros afectados | Acção |
|------|---------------------|-------|
| Labels de formulário | EditGeneralTab, CreateContactForm | Subir de text-[10px]/text-[11px] para text-xs (12px) |
| Badges/pills | EmailThreadCard, TelecofBanner, Pipeline | Subir text-[9px] para text-[10px] mínimo |
| KPI captions | KpiPanel, OrganizationHeader | Subir text-[9px] para text-[11px] |
| Navigation labels | AppSidebar, BottomNav | Subir text-[10px] para text-[11px] |
| Timestamps | ConversationItem, Timeline | Subir text-[10px] para text-[11px] |
| Section headings | SectionCard, all panels | Normalizar para text-[11px] uppercase |
| Font stack | tailwind.config.ts vs index.css | Alinhar: Geist primeiro em ambos |

### 2.2 Cores (120+ items)

**Problema:** Maioria dos componentes em communications/ e customer360/ usa cores hardcoded (bg-slate-50, text-slate-900). Dark mode quebrado em 90% da interface.

| Substituição | Ocorrências | De → Para |
|-------------|-------------|----------|
| Surfaces | ~60 | bg-white/bg-slate-50 → bg-card/bg-background |
| Text primary | ~30 | text-slate-900 → text-foreground |
| Text secondary | ~25 | text-slate-500/600 → text-muted-foreground |
| Borders | ~20 | border-slate-200/300 → border-border |
| Botões primários | ~10 | bg-blue-600/bg-violet-600 → bg-primary |
| Status badges | ~15 | Normalizar green/amber/red para tokens |

### 2.3 Layout / Componentes (17 items)

| Prioridade | Componente | Mudança |
|-----------|-----------|--------|
| 🔴 | Pipeline colunas | w-52→w-64, padding maior |
| 🔴 | C360 tabs | text-[11px]→text-xs, h-7→h-9, border-bottom indicator |
| 🔴 | C360 Actions | Primeiros 3 com cor (Phone=verde, WA=verde, Mail=azul) |
| 🔴 | Sidebar | Items h-8→h-9, cor nos 4 principais |
| 🔴 | Email | Split-pane em desktop (lista + detalhe lado a lado) |
| 🟡 | Dashboard grid | Fix 6 cards layout |
| 🟡 | Telecof cores | Substituir hardcoded por tokens CSS |
| 🟡 | Email sidebar | Alargar 175px→200px |
| 🟡 | A-Z filter | Substituir por dropdown |
| 🟡 | Pipeline DealCard | Indicador de idade (dias na etapa) |

### 2.4 Workflows / Fluxos (5 mapeados)

| Fluxo | Clicks Actuais | Ideal | Gap Principal |
|-------|---------------|-------|---------------|
| Lead → Deal | 9-13 | 4-5 | 3 páginas desconectadas |
| Email → Proposta | 9-14 | 5-8 | Navega away, perde contexto |
| Chamada → Resolução | 4-7 | 3-4 | Banner desaparece, contexto perdido |
| Triagem Diária | 3-5 por canal | 0 | Sem inbox unificado |
| Customer Lookup | 1-3 | 1-2 | Phone search não normaliza formatos |

---

## 3. GAPS FUNCIONAIS RESTANTES

### 3.1 Não depende de frontend (n8n/backend)
- Email body completo (bodyPreview→body.content) — documentado, precisa de fix nos workflows já activos
- Leads automáticos de email — implementado nos workflows v2
- Anexos de email inbound — download do Graph API → upload Directus

### 3.2 Depende de frontend
- Inbox unificado (email + WhatsApp + calls numa só vista)
- Email split-pane (lista + detalhe lado a lado)
- Proposta sem perder contexto (overlay em vez de navegação)
- Dashboard com funil visual do pipeline
- Actividade por comercial
- Vista calendário real na Agenda
- Integração Moloni (facturação)

---

## 4. SKILLS DISPONÍVEIS

### Skills instaladas (C:\Users\Rui Medalha\.claude\skills\)

| Skill | Uso para o CRM |
|-------|---------------|
| **interface-design** | Design de dashboards, painéis, formulários — Linear/Vercel/Stripe quality |
| **impeccable** | Auditoria completa de UI, detecção de anti-patterns, polish visual |
| **bencium-controlled-ux-designer** | UX rigoroso e controlado |
| **bencium-innovative-ux-designer** | UX inovador e criativo |
| **bencium-impact-designer** | Design com impacto — foco na acção |
| **ui-typography** | Tipografia profissional |
| **vercel-react-best-practices** | Best practices React (performance, patterns) |
| **vercel-composition-patterns** | Composition patterns (componentes reutilizáveis) |
| **vercel-optimize** | Optimização de performance |
| **web-design-guidelines** | Guidelines de design web |
| **writing-guidelines** | Tom de voz e UX writing |
| **human-architect-mindset** | Arquitectura centrada no humano |
| **renaissance-architecture** | Padrões arquitecturais elegantes |
| **negentropy-lens** | Simplificação e redução de complexidade |
| **vanity-engineering-review** | Detecta over-engineering |
| **adaptive-communication** | Comunicação adaptativa |
| **bencium-code-conventions** | Convenções de código |
| **agentic-ux-design-relationship-centric-interfaces** | UX centrado em relações (perfeito para CRM) |

### Skills que FALTAM (recomendações)

| Skill necessária | Porquê |
|-----------------|--------|
| **crm-workflow-patterns** | Padrões específicos de CRM (pipeline, lead scoring, activity feeds) |
| **email-client-ux** | Best practices de clientes de email (split-pane, threading, quick actions) |
| **data-table-design** | Design de tabelas de dados profissionais (sorting, filtering, pagination, inline editing) |
| **accessibility-wcag** | Conformidade WCAG para uso prolongado (contraste, focus, keyboard nav) |
| **mobile-first-responsive** | Patterns para mobile CRM (field workers, commercial teams on the go) |
| **real-time-notifications** | Patterns de notificações (toasts, badges, push, sound) |
| **search-and-filter-patterns** | UX de pesquisa avançada (faceted, fuzzy, saved filters) |
| **onboarding-and-empty-states** | First-run experience, empty states que guiam |
| **dark-mode-design-system** | Token architecture para dark mode consistente |
| **performance-monitoring** | Web Vitals, bundle analysis, runtime perf |

---

## 5. ROADMAP PRIORITIZADO

### Sprint 1 — Visual Consistency (1-2 dias)
Objectivo: O CRM parece profissional e consistente.

1. Fix tipografia global (batch replace text-[9px]→[10px], [10px]→[11px])
2. Fix cores global (bg-white→bg-card, text-slate→text-foreground)
3. Fix font stack (Geist primeiro)
4. Pipeline colunas + DealCard com idade
5. C360 tabs + actions com hierarquia visual
6. Sidebar com items maiores + badges visíveis

### Sprint 2 — Email Professional (2-3 dias)
Objectivo: O módulo de email funciona como um cliente real.

1. Split-pane (lista + detalhe lado a lado em desktop)
2. "Criar Proposta" disponível em TODOS os emails (não só pedido_orcamento)
3. Proposta abre em overlay/split (não navega away)
4. Fix deeplink Dashboard→Pipeline
5. Assinatura com preview visual
6. Templates CRUD inline

### Sprint 3 — Unified Inbox (3-5 dias)
Objectivo: Tudo num só sítio.

1. Página "Inbox" que merge email threads + WhatsApp conversations + missed calls
2. Ordenado por urgência/SLA
3. Filtros por canal, atribuição, status
4. Quick actions inline (responder, atribuir, snooze)
5. Badge no sidebar com total pendente

### Sprint 4 — Workflows Optimizados (2-3 dias)
Objectivo: Menos clicks, zero context loss.

1. Lead→Contact→Deal: converter com 1 click + inline deal creation
2. Phone normalisation no GlobalSearch
3. "Recentes" no Customer360Hub
4. Dashboard com items accionáveis (não só contadores)
5. Telecof: barra de contexto persistente após atender

### Sprint 5 — Analytics & Reporting (3-5 dias)
Objectivo: Gestão consegue medir tudo.

1. Funil visual do pipeline (valor por etapa)
2. Actividade por comercial (emails, chamadas, propostas)
3. Taxa de conversão (lead→deal→ganho)
4. SLA compliance (% respondidos no prazo)
5. Relatório exportável (PDF/Excel)

---

## 6. NOTAS TÉCNICAS

### Dependências adicionadas nesta sessão
- papaparse@5.4.1 (CSV parse)
- @types/papaparse@5.3.15
- dompurify@3 (já era sub-dep, agora explícito)
- @types/dompurify@3

### Dependências removidas
- embla-carousel-react (não usada)
- input-otp (não usada)
- react-resizable-panels (não usada)
- vaul (não usada)

### Código morto removido
- Dashboard360.jsx
- ConversationView.tsx (legacy Chatwoot)
- useConversations.ts / useMessages.ts (legacy)
- use-contact-by-id.ts / useResolvedContactId.ts
- NavLink.tsx
- productSearch.ts
- bun.lockb

### Endpoints Directus activos
- POST /identify-contact — identificação por telefone/email
- POST /wa-proxy — envio WhatsApp (Evolution + Meta)
- POST /ai-proxy — chamadas IA
- POST /email-send — envio email (Microsoft Graph)

### Variáveis de ambiente no Directus container
- EVOLUTION_API_KEY
- META_WHATSAPP_TOKEN
- META_PHONE_NUMBER_ID
- AI_PROXY_URL / AI_PROXY_TOKEN
- MS_GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET
- LICENSE_KEY (Directus 12)

---

*Documento gerado a 10 de Julho de 2026. Para deploy: `cd /var/www/crm && git pull origin feat/modulo-propostas && npm run build && pm2 restart crm-hotelequip && pm2 restart crm-static`*
