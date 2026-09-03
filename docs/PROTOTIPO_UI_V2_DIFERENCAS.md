# Protótipo UI v2 — Diferenças face à produção

**Branch:** `feat/prototipo-ui-v2` (isolada, sem deploy automático)
**Base:** `feat/modulo-propostas` (último commit produção `5b30f60`)
**Commit novo:** `d038b13` (+ correcções pt-PT pendentes)
**Data:** 06-08-2026

---

## 1. Como testar no PowerShell (Windows 11)

### Pré-requisitos
- **Node.js** 18+ (o projecto usa Vite 5.4)
- **npm** 9+ (vem com Node)
- **Git** para Windows (Git Bash ou PowerShell nativo serve)

### Passo 1 — Abrir o PowerShell certo
Abre o **PowerShell** (não o cmd). No Windows 11:
- `Win` → escreve `PowerShell` → abre "Windows PowerShell"
- Ou clica com botão direito numa pasta do explorador e escolhe "Abrir no Terminal"

### Passo 2 — Ir para a pasta do projecto

```powershell
cd "C:\Projetos\crm-lab-directus"
```

> Se der erro de path (espaços), mete o caminho entre aspas.

### Passo 3 — Garantir que estás na branch certa

```powershell
git branch
# esperado: * feat/prototipo-ui-v2

# Se não estiver, mudar:
git checkout feat/prototipo-ui-v2
```

### Passo 4 — Instalar dependências (só a 1ª vez, ou se houver diff no `package-lock.json`)

```powershell
npm install
```

> Se pedirem Legacy Peer Deps:
> ```powershell
> npm install --legacy-peer-deps
> ```

### Passo 5 — Correr o servidor de desenvolvimento

```powershell
npm run dev
```

Vai aparecer algo como:

```
  VITE v5.4.21  ready in 412 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
  ➜  press h + enter to show help
```

### Passo 6 — Abrir no browser
Vai a **http://localhost:5173/** (ou clica no link no terminal).

### Passo 7 — Parar o servidor
No terminal, `Ctrl+C`.

---

## 2. Resumo do que muda (visualmente)

### 2.1 Sidebar (Desktop ≥ 1280px)

**Antes** (`feat/modulo-propostas`):
- 24 itens em 3 grupos (CRM, Comunicações, Sistema)
- Auto-collapse abaixo de 1279px
- Muitos textos longos ("Encomendas do site", "Carrinhos abandonados")

**Agora** (`feat/prototipo-ui-v2`):
- **10 itens primários** sem grupos: Painel, Ficha de Cliente, Contactos, Leads, Pipeline, Inbox, Comunicações, **Chamadas (Telecof)**, Email, Propostas
- **Botão "Mais"** que abre drawer lateral-direito com 13 itens secundários agrupados (Vendas, Operação, Sistema)
- **Colapso manual** (botão no fundo da sidebar) — persiste em `localStorage` (chave `sidebar:v2:collapsed`)
- Sem auto-collapse — só quando clicas no botão

### 2.2 BottomNav (Mobile < 768px)

**Antes:**
- 5 itens: Painel, Inbox, Chat, Agenda, **Mais**
- "Mais" = drawer lateral com tudo

**Agora:**
- 5 itens: Painel, Inbox, Chat, **Propostas**, **CTA [+] central FAB**
- CTA central: botão circular `rounded-full bg-primary`, elevado acima da barra
- Tocar no CTA abre `CreateFabPopover` com 4 quick-actions (Nova Proposta, Novo Lead, Novo Cliente, Nova Tarefa)

### 2.3 Dashboard (`/`)

**Antes:**
- Header simples ("Painel", "Bem-vindo ao CRM Hotelequip")
- "Para fazer hoje" (lista de chips com alertas)
- Stats Grid (KPIs)
- Revenue Card, Contact Summary, Leads Analytics, Funnel, Conversion, SLA, Activity, Recent Deals

**Agora (D2 Operacional):**
- **Header com saudação dinâmica** ("Bom dia/Boa tarde/Boa noite, {nome}" + "Aqui está o resumo da tua actividade.")
- **NOVO: Inbox unificada** (3 chips WhatsApp / Email / Chamadas(Telecof) — no topo)
- **NOVO: Agenda de hoje** (5 follow-ups com horário, ou mensagem "Sem tarefas para hoje")
- **"Para fazer hoje"** com cap=2 + botão "Ver mais (N)" se houver mais
- **Stats Grid movido para o fundo** (métricas secundárias)
- **Restantes blocos** mantêm-se

### 2.4 MenuMobile (`/menu`)

**Antes:**
- 23 itens numa única grid
- 5 entradas duplicadas "Leads" (linhas 18-21)

**Agora:**
- 23 itens em **4 secções** (Vendas, Comunicações, Operação, Sistema)
- Duplicados removidos
- "Sair" fora dos grupos

### 2.5 EmptyState (NOVO componente)

Adicionado `src/components/EmptyState.tsx` — pictográfica + acção (estilo E1). Props:
- `illustration`: `inbox | contacts | email | documents | calendar | generic`
- `title`, `description`, `primaryAction`, `secondaryHref`, `secondaryLabel`

### 2.6 Tokens tipográficos

`src/index.css` agora tem um bloco de comentário a documentar a escala canónica Tailwind (text-xs a text-4xl). **Não há mudanças funcionais**, só documentação.

---

## 3. Diferenças técnicas (resumo)

| Item | Antes | Agora |
|---|---|---|
| Sidebar auto-collapse | Sim (≤1279px) | **Não** (só manual) |
| Persistência colapso | Não | Sim (`localStorage: sidebar:v2:collapsed`) |
| Itens sidebar primários | 24 (3 grupos) | 10 (sem grupos) + 13 em drawer "Mais" |
| Itens sidebar Mobile (BottomNav) | 5 (Painel/Inbox/Chat/Agenda/Mais) | 5 (Painel/Inbox/Chat/Propostas/CTA+) |
| CTA Mobile | Não havia | FAB circular com Popover (4 quick-actions) |
| Ordem Dashboard | KPIs primeiro | **Inbox primeiro** (operacional) |
| Saudação Dashboard | Estática | Dinâmica (hora do dia + nome) |
| Tokens documentados | Não | Sim (comentários em `index.css`) |
| Componente EmptyState | Só `customer360/ui/EmptyState.tsx` (minimalista) | **+ Novo** `components/EmptyState.tsx` (pictográfica) |

---

## 4. Ficheiros tocados

**Novos (3):**
- `src/components/EmptyState.tsx`
- `src/components/layout/MoreSheet.tsx`
- `src/components/layout/CreateFabPopover.tsx`

**Modificados (5):**
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/MenuMobile.tsx`
- `src/index.css`

---

## 5. Compatibilidade

- ✅ `npx tsc --noEmit` → EXIT 0
- ✅ `npm run build` → 7.69s, sem erros
- ✅ Ficheiros protegidos intactos (`Newsletter*`, `Telecof*` em `communications/`, páginas públicas)
- ✅ `package.json` sem novas dependências
- ✅ `git checkout feat/modulo-propostas` reverte sem warnings

---

## 6. Rollback (se algo correr mal)

```powershell
git checkout feat/modulo-propostas
git branch -D feat/prototipo-ui-v2   # só se quiseres apagar a branch local
```

Sem migrations, sem env changes — reversão trivial.

---

## 7. Próximo passo

- Validar visualmente (sidebar + bottomnav + dashboard + menu mobile)
- Aprovar ou pedir ajustes
- Se aprovado: merge em staging → Sprint 0 de Segurança P0
- Se ajustes: iterar no branch, validar de novo