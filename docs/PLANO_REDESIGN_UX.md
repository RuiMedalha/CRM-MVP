# Plano de Redesign UX — CRM Hotelequip

> **Objetivo:** dar ao CRM uma *lógica de uso* coerente e moderna, adaptada ao que ele já é, sem estragar o que funciona. Baseado nos padrões dos melhores CRMs (HubSpot, Pipedrive, Intercom, Respond.io) mas desenhado para o negócio real: equipamento hoteleiro, vendas por WhatsApp/Telecof, propostas.
>
> **Estado:** documento de decisão — a aprovar ANTES de mais código. Branch `redesign/ux-mobile-desktop`.

---

## 1. O que o CRM É hoje (mapa real)

35 páginas, agrupadas por função. Isto é o inventário do que existe:

| Área | Páginas | Papel |
|------|---------|-------|
| **Comunicação** | Inbox, Comunicações, Telecof, Email, Social, Newsletter | Falar com o cliente (omnicanal) |
| **Vendas** | Leads, Pipeline, Propostas, Orçamentos | Fechar negócio |
| **Loja/Encomendas** | Loja, Pedidos, Carrinhos, Canais | E-commerce + recuperação |
| **Cliente** | Contactos, Customer360, Ficha Cliente | Base de dados de quem compra |
| **Operação** | Dashboard, Agenda, Relatórios | Gerir o dia |
| **Config** | Definições, Integrações, Fornecedores, Utilizadores, Dev Tools | Administração |
| **Público** | /p/:token (proposta pública) | O que o cliente vê |

**Diagnóstico (dos 2 audits que fizemos):** o CRM é *funcional* mas é uma **soma de ecrãs administrativos** — cada página foi feita à parte, sem uma lógica de uso comum. Falta o "fio condutor" que faz o utilizador saber sempre onde está e o que fazer a seguir.

---

## 2. A LÓGICA que falta (o "fio condutor")

Os melhores CRMs partilham uma lógica que o teu ainda não tem de forma consistente. É isto que vamos aplicar:

### 2.1 Contact-centric (como HubSpot) — o contacto é o centro de tudo
Tudo o que acontece (conversa, proposta, encomenda, chamada) **liga-se a um contacto**. O Customer360 já existe — mas tem de ser o **destino natural** de qualquer coisa: clicas num contacto em qualquer lado → vais à ficha 360 dele → vês tudo (conversas, propostas, pedidos, timeline). Isto dá a "lógica" que pediste: uma vez que percebes que tudo gira à volta do contacto, percebes o sistema todo.

### 2.2 Glanceable (como Pipedrive) — ver sem clicar
Cartões e listas mostram o essencial num relance: valor, estado, se há ação pendente (vermelho=urgente, âmbar=à espera, verde=em atendimento — as cores de estado que já tens nos tokens). O utilizador **não clica para descobrir** — vê logo o que precisa de atenção.

### 2.3 Shared inbox com master-detail (como Intercom/Respond.io) — o coração do teu CRM
A comunicação (WhatsApp/Telecof/Email) é onde a tua equipa passa o dia. Padrão único:
- **Lista à esquerda** (conversas/chamadas, com estado glanceable)
- **Detalhe à direita** (a conversa aberta + contexto do cliente)
- **Desktop:** lado-a-lado. **Mobile:** lista → detalhe com voltar. **Landscape:** lado-a-lado (usa a largura).
- Um só sítio para todos os canais, com filtros por canal.

### 2.4 Uma tarefa de cada vez em mobile (best practice mobile)
No telemóvel: lista OU detalhe, nunca os dois espremidos. Voltar sempre explícito. Ações principais sempre alcançáveis (nunca tapadas por nav/teclado/FAB).

### 2.5 Progressive disclosure (todos) — do simples ao complexo
Mostra primeiro o que importa (o que precisa de ação hoje). Detalhe/configuração ficam a um clique, não à frente. Dashboard = o meu dia (SLA, follow-ups, urgentes), não um mar de gráficos.

---

## 3. Arquitetura de navegação (a "casa" do sistema)

Reorganizar as 35 páginas em **5 destinos primários** + resto acessível mas não a competir por atenção. Modelo: sidebar desktop / bottom-nav + more mobile (como HubSpot mantém navegação estável).

```
PRIMÁRIOS (sempre à mão — sidebar desktop, bottom-nav mobile):
  🏠 Início       → Dashboard (o meu dia: urgentes, follow-ups, SLA)
  💬 Conversas    → workspace unificado (Inbox+Comunicações+Telecof+Email)
  🤝 Vendas       → Pipeline + Leads + Propostas (hub de negócio)
  👥 Contactos    → base + Customer360 (o centro de tudo)
  ➕ Criar        → ação rápida (novo contacto/proposta/etc.)

SECUNDÁRIOS ("Mais" / secções da sidebar):
  Loja: Loja, Pedidos, Carrinhos, Canais
  Marketing: Social, Newsletter
  Operação: Agenda, Relatórios
  Config: Definições, Integrações, Fornecedores, Utilizadores
```

**Porquê:** hoje a nav tem "Operação/Vendas/Base" mas mistura tudo. Com 5 primários, o utilizador sabe sempre para onde ir. O resto está lá, mas não distrai.

---

## 4. Sistema de design (já temos base forte)

O blueprint confirmou: **os tokens já são bons** (cores de canal WhatsApp/Telecof, estados, dark mode WCAG). Não mexer nisso. O que falta é *disciplina de uso*:

- **Tipografia:** matar `text-[Npx]` ad-hoc (~20 ficheiros) → escala única
- **Primitives responsivos:** já criados (ResponsiveTable→cards, ResponsiveDialog→sheet, ResponsiveDetail master-detail, AsyncState, EmptyState, PageHeader) → **adotá-los em TODAS as páginas** (é isto que dá consistência)
- **Estados:** toda a lista/fetch mostra loading/vazio/erro de forma igual
- **Toque:** alvos ≥44px (já resolvido nos primitives)

---

## 5. O que NÃO mexer (proteger o que funciona)

Como pediste — "sem estragar o que está bem":
- ❌ Cores de canal/estado (load-bearing para o workflow)
- ❌ Dark mode do sidebar
- ❌ Envio de WhatsApp via /wa-proxy, Directus, n8n, Telecof — **lógica de negócio intocada**
- ❌ Página pública /p/:token (funciona, não é vulnerável)
- ❌ Produção — tudo continua na branch de teste

---

## 6. Plano de execução (por fases, com validação tua entre elas)

| Fase | O quê | Estado |
|------|-------|--------|
| **0. Análise** | Este documento — a lógica | ✅ agora |
| **1. Fundações** | Primitives + tokens + shell + comunicações workspace | ✅ feito (vaga P0) |
| **2. Nav canónica** | 5 destinos primários, reorganizar sidebar/bottom-nav | a fazer |
| **3. Contactos-centro** | Customer360 como hub; tudo liga ao contacto | a fazer |
| **4. Vendas** | Pipeline glanceable, Propostas/Leads com padrão de lista | a fazer |
| **5. Loja/Operação** | Pedidos/Carrinhos/Agenda/Relatórios com primitives | a fazer |
| **6. Polish** | Estados, motion, empty states, acessibilidade | a fazer |

**Regra:** cada fase é validada por ti no browser antes da seguinte. Nada de fazer tudo às cegas.

---

## 7. Adaptação ao TEU negócio (não copiar cego)

Os padrões vêm dos grandes CRMs, mas adaptados ao Hotelequip:
- **WhatsApp/Telecof no centro** (não é um extra como no HubSpot — é o principal) → Conversas é destino primário, não escondido
- **Propostas de equipamento hoteleiro** → wizard claro, proposta pública polida (já boa)
- **Recuperação de carrinhos** → ligada às Conversas (WhatsApp/email) — já importámos do DEV
- **Equipa pequena** → simplicidade tipo Pipedrive, não a complexidade enterprise do Salesforce

---

## Decisão pendente

Este é o plano pensado. **Antes de escrever mais código**, preciso que confirmes:
1. A lógica (contacto no centro + conversas como coração) faz sentido para como trabalhas?
2. Os 5 destinos primários são os certos, ou mudas algum?
3. Alguma área que queres primeiro (Conversas? Contactos? Vendas?)
