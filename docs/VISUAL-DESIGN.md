# Visual Design — CRMMVP (Card 17)

> Decisões de design, paleta, tipografia, spacing e shadows aplicados no
> redesign visual de 2026-09-03. O dono pediu "não gosto do visual" — este
> documento regista o que mudou e porquê.

## TL;DR

Antes: indigo-500 default (Tailwind), Geist única, sombras genéricas, cards
"planos" sem identidade. Depois: paleta navy/indigo proprietária (`#4F46E5`),
Inter Variable + Geist fallback, sombras tingidas brand, micro-interactions
expressivas (shimmer, hover lift, focus ring animado, pill indicator na
bottom-nav), empty states com SVG inline contextual e KPI cards com sparkline
embebido (recharts).

---

## 1. Identidade de cor

### Brand ramp (`tokens.css`)

| Token        | Hex       | Uso                                  |
|--------------|-----------|--------------------------------------|
| `brand-50`   | `#EEF2FF` | tint backgrounds, hover leve        |
| `brand-100`  | `#E0E7FF` | pill indicator bottom-nav (light)   |
| `brand-200`  | `#C7D2FE` | border hover, focus ring outer       |
| `brand-300`  | `#A5B4FC` | disabled primary (raro)             |
| `brand-400`  | `#818CF8` | decorative accent                    |
| `brand-500`  | `#6366F1` | brand-mark, indigo real              |
| **`brand-600`** | **`#4F46E5`** | **primary** (CTA, foco, links)   |
| `brand-700`  | `#4338CA` | gradient end, primary-hover          |
| `brand-800`  | `#3730A3` | dark hover, gradient deep            |
| `brand-900`  | `#312E81` | dark text, sidebar-bg                |
| `brand-950`  | `#1E1B4B` | very-dark surfaces                   |

### Acentos semânticos

| Variante   | Hex       | Aplicação                            |
|------------|-----------|--------------------------------------|
| `success`  | `#10B981` | badges "convertido", toasts OK       |
| `warning`  | `#F59E0B` | badges "em progresso", KPI warning   |
| `danger`   | `#F43F5E` | destructive, badges urgente          |

Todos em CSS custom properties (`--success-500`, `--warning-500`,
`--danger-500`) para que Tailwind aplique opacities arbitrárias via
`bg-success/10`, `text-danger/80`, etc.

### Sidebar

Mantém a paleta navy profunda do legado (`#1A2332` HSL ~222 47 11) por
continuidade com a identidade Hotelequip — ver `--sidebar-background`. O
**active item** continua a usar `--sidebar-primary` (também navy/indigo) mas o
hover agora usa `--sidebar-accent` mais visível para melhor affordance.

---

## 2. Tipografia

### Família

```css
--font-sans:    'Inter', 'Geist', system-ui, sans-serif;
--font-display: 'Inter', 'Geist', system-ui, sans-serif;
--font-mono:    'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;
```

- **Inter Variable** (Google Fonts): nova família primária — 9 pesos (400-800),
  optimizada para UI, com `cv11/ss01/ss03` para alternates (l/r sem serifa).
- **Geist** (definida anteriormente): fallback legacy para código que ainda a
  referencia.
- **Geist Mono**: tabular nums em valores numéricos (preços, contagens).

### Escala

Aplicada nativamente via `text-xs|sm|base|lg|xl|2xl|3xl|4xl` (Tailwind defaults,
ver comentário em `index.css:165`).

| Token           | Tamanho | Uso típico                                |
|-----------------|---------|--------------------------------------------|
| `text-display`  | 36 px   | página de marketing-only                  |
| `text-h1`       | 30 px   | saudação Dashboard, KPIs destacados       |
| `text-h2`       | 24 px   | títulos de página                         |
| `text-h3`       | 20 px   | subtítulos                                |
| `text-h4`       | 18 px   | CardTitle desktop                         |
| `text-body`     | 15 px   | texto corrido, listas                     |
| `text-small`    | 13 px   | descrições secundárias, labels            |
| `text-tiny`     | 11 px   | badges, micro-cópia                       |

### Tabular nums

Todos os números (KPI values, preços em tabelas, contagens) usam
`font-variant-numeric: tabular-nums` via classe utilitária `.tabular-nums`
ou atributo `data-tabular`. Evita que valores mudem de largura quando
actualizam (ex: `1 234 → 1 235`).

### Line-height & tracking

| Token          | Valor | Uso                       |
|----------------|-------|---------------------------|
| `leading-tight`  | 1.2   | KPIs grandes, displays   |
| `leading-snug`   | 1.35  | CardTitle                |
| `leading-normal` | 1.5   | corpo, descrições        |
| `leading-relaxed`| 1.625 | texto longo              |
| `tracking-tight` | -0.02em | headings                |

---

## 3. Spacing scale (base 4 px)

Aplicada de forma consistente — **todas as distâncias são múltiplos de 4 px**.

| Token       | Valor | Tailwind equivalente |
|-------------|-------|----------------------|
| `--space-1`  |  4 px | `p-1`, `gap-1`       |
| `--space-2`  |  8 px | `p-2`, `gap-2`       |
| `--space-3`  | 12 px | `p-3`, `gap-3`       |
| `--space-4`  | 16 px | `p-4`, `gap-4`       |
| `--space-5`  | 20 px | `p-5`                |
| `--space-6`  | 24 px | `p-6`, `lg:p-6`      |
| `--space-8`  | 32 px | `p-8`                |
| `--space-10` | 40 px | `p-10`               |
| `--space-12` | 48 px | `p-12`               |
| `--space-16` | 64 px | `p-16`               |

**Regra**: nunca usar valores arbitrários `p-[13px]`. Se precisares, arredonda
para o múltiplo de 4 mais próximo (12 ou 16) ou propõem um novo token.

---

## 4. Sombras

Tingidas pela cor brand — `--shadow-color-rgb: 79 70 229` (brand-600).

| Token             | Camadas                                          | Uso                       |
|-------------------|--------------------------------------------------|---------------------------|
| `--shadow-sm`     | `0 1px 2px rgb(15 23 42 / .06), 0 1px 3px ...`  | cards estáticos           |
| `--shadow-md`     | `0 2px 4px ..., 0 4px 12px ...`                  | cards sobre superfícies   |
| `--shadow-lg`     | `0 8px 16px ..., 0 12px 28px ...`                | dropdowns, modais         |
| `--shadow-xl`     | `0 16px 24px ..., 0 24px 48px ...`               | drag handles, overlays    |
| **`--shadow-brand-sm`** | **`0 1px 2px rgba(79 70 229 / .10), ...`** | **cards de marca**        |
| **`--shadow-brand-md`** | **`0 4px 10px rgba(79 70 229 / .12), ...`** | **hover de cards CTA**    |
| **`--shadow-brand-lg`** | **`0 12px 28px rgba(79 70 229 / .16), ...`** | **botões gradient hover** |

Tailwind classes correspondentes: `shadow-brand-sm`, `shadow-brand`,
`shadow-brand-lg`.

---

## 5. Radii

| Token         | Valor  | Tailwind  | Uso                            |
|---------------|--------|-----------|--------------------------------|
| `--radius-xs` |  4 px  | `rounded-xs` | badges                        |
| `--radius-sm` |  6 px  | `rounded-sm` | inputs, chips                  |
| `--radius-md` |  8 px  | `rounded-md` | botões, cards                 |
| `--radius-lg` | 12 px  | `rounded-lg` | cards padrão                  |
| `--radius-xl` | 16 px  | `rounded-xl` | sheets, dialogs               |
| `--radius-2xl`| 20 px  | `rounded-2xl`| modais grandes               |
| `--radius-pill` | 9999 px | `rounded-full` | avatares, pill nav        |

---

## 6. Componentes actualizados

### Button (`src/components/ui/button.tsx`)

Variantes:

- `default` — gradient `brand-600 → brand-700`, shadow `shadow-brand-sm`, hover
  escurece e aumenta shadow para `shadow-brand-md`. Active scale `0.98`.
- `gradient` — gradient explícito `brand-500 → 600 → 800`, halo maior.
- `success | warning | destructive` — gradients das cores accent.
- `soft` — fundo `brand-50` claro, texto `brand-700` (para acções secundárias).
- `outline` — border `brand-200`, hover com `brand-50`.
- `ghost` — só hover bg.
- `link` — `underline-offset-4`, hover underline.

Focus ring: `focus-visible:ring-2 focus-visible:ring-brand-500`. Active scale:
`active:scale-[0.98]` para feedback tátil.

### Card (`src/components/ui/card.tsx`)

- Default: `border-border/70`, `shadow-brand-sm` (tinted, não genérico).
- `interactive` prop — adiciona classe `.card-hover-lift` (translate-y -2px no
  hover, shadow cresce para `shadow-brand-md`, border escurece).

### Input (`src/components/ui/input.tsx`)

Classe `.input-focus-ring` — focus animado:
- border vira `brand-500`
- box-shadow: ring 4px com opacity 12% + ring 1px sólido.

### Badge (`src/components/ui/badge.tsx`)

- Variantes `success`, `warning`, `destructive`, `info` usam bg com opacity 10%
  (não full), texto da cor forte — mais legível em listas densas.
- Suporta `icon` prop opcional (Lucide) — ícone 12×12 à esquerda do label.

### Toaster (`src/components/ui/sonner.tsx`)

Variantes `success | error | warning | info` com tints próprios via
`classNames`. Toast success: bg verde 10%, texto verde 700. Erro: vermelho.
Warning: âmbar. Info: brand-50 + brand-700.

---

## 7. Micro-interactions

Todas as animações respeitam `prefers-reduced-motion: reduce` (ver
`@media (prefers-reduced-motion: reduce)` em `tokens.css`).

### Shimmer (loading skeleton)

Aplicado a `.skeleton` (shadcn) e `.shimmer-skeleton`. Gradiente linear
`90deg, transparent → brand-500/0.10 → transparent`, `background-size: 200% 100%`,
duração `1.6s` infinite.

### Page fade-in

`AppLayout` aplica classe `.page-enter` ao `<div class="crm-layout-content">`
quando muda `window.location.pathname`. Animação `200ms ease-out` (cubic-bezier
0.16, 1, 0.3, 1) com `opacity: 0 → 1` + `translateY(4px) → 0`.

### Hover lift (cards)

`.card-hover-lift:hover` faz `translateY(-2px)`, shadow muda para brand-md,
border escurece. Duração 200ms com easing `var(--ease-out)`.

### Bottom-nav pill indicator

Pill absoluta `.bottom-nav-pill` com `--pill-x: <calc>` calculado pelo índice
do item activo. Transição `transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)`
— spring overshoot subtil. Items activos também ganham `scale: 1.1` no ícone
e peso da label `font-semibold`.

### TopBar gradient

`.topbar-brand-gradient` aplica `linear-gradient(180deg, brand-50/85 → surface/85)`
com `backdrop-filter: blur(10px)`. Em dark mode vira `brand-900/35 → surface-0-d/85`.

### Sheet drag handle

Novo `withHandle` prop em `SheetContent` (vais ver em usos). Quando `side="bottom"`
e `withHandle={true}`, renderiza `<div class="bottom-sheet-handle" />` — pill
40×4 no topo da sheet, padded com safe-area bottom.

---

## 8. Layout

### Sidebar (`AppSidebar.tsx`)

Agrupa items por domínio com label uppercase + tracked:

- **Operação**: Painel · Inbox · Comunicações · Telecof · Email
- **Vendas**: Leads · Pipeline · Propostas
- **Base**: Ficha de Cliente · Contactos
- **Definições**: Definições

Labels usam `.sidebar-group-label` — `10px, font-weight 700, uppercase,
tracking 0.08em`, cor brand-500 com 55% opacity.

### TopBar (`TopBar.tsx`)

- Substitui `bg-background/85` por `.topbar-brand-gradient` (gradient + blur).
- Border-bottom muda para `brand-100/85` (mais expressivo).

### BottomNav

- Pill indicator animado (ver § 7).
- Active badge do Inbox usa gradient `danger-500 → danger-600` com shadow
  brand-sm.

### KPI Cards

Cada `KpiTile` no Dashboard agora inclui um `Sparkline` (recharts AreaChart
mono-line) com:
- gradient brand (alpha 30% no topo → 0% em baixo) sob a curva;
- ponto final sólido no último valor;
- cor por domínio (Contactos → indigo, Activos → âmbar, Ganhos → emerald,
  Pipeline → indigo profundo).

A série é gerada deterministicamente a partir do valor actual (mock — em
produção, lê-se de `useKpiHistory`). Substituir por `useQuery(['kpi-history'])`
quando existir endpoint.

---

## 9. Empty states

`src/components/EmptyState.tsx` foi completamente redesenhado:

- Cada ilustração é um SVG **inline vectorial** com tints brand (`url(#bg-...)`).
  Não dependemos de ficheiros externos — funciona offline e não há custo de
  rede.
- 10 ilustrações contextuais: `inbox`, `contacts`, `leads`, `email`, `documents`,
  `calendar`, `pipeline`, `proposals`, `search`, `conversations`, `generic`.
- Suporta `primaryAction` (com ícone Lucide) + `secondaryAction`.
- O `<Empty>` ad-hoc do `Loja.tsx` foi substituído por este componente — mas
  com fallback, já que `Empty` ainda é usado em alguns locais antigos.
- O `EmptyState` minimalista em `customer360/ui/EmptyState.tsx` continua a
  existir (legado) — é deliberadamente minimalista para painéis densos. Os
  restantes sítios foram migrados para a versão expressiva.

Páginas a migrar (não bloqueado neste card):
- `EmailProductSuggestions.tsx` linha 648
- `DuplicatePanel.tsx` linha 227 (texto plano)
- Vários sites com `<p>Nenhum produto encontrado</p>` — substituir por
  `<EmptyState illustration="search" title="..." description="..." />`.

---

## 10. Mobile polish

- Bottom-nav pill indicator (ver § 7).
- Bottom-sheet drag handle (ver § 7).
- Safe-area em todos os cantos via `env(safe-area-inset-*)` — `.crm-topbar`,
  `.bottom-sheet-safe`, bottom-nav.
- Touch-targets ≥ 44 px já existiam em coarse pointers (mantido).

---

## 11. Tokens helper (`src/lib/theme.ts`)

Helpers TypeScript para aceder aos tokens em JS (ex: recharts que precisa de
hex/rgb, não hsl). Inclui:

```ts
import { brand, semantic, brandTint } from '@/lib/theme';

// recharts
<Area stroke={brand[600]} fill={brandTint(isDark).from} />

// pie chart
<Cell fill={semantic.success[500]} />
```

`brandTint(isDark)` gera `{ from, to, stroke }` apropriados para light/dark.

---

## 12. Decisões não tomadas (open questions)

- **Brand mark / wordmark**: não foi redesenhado. Continua o logo do Hotelequip
  em `AppSidebar` — se o dono quiser uma nova marca, é card à parte.
- **Tema accent picker**: existe na página `/definicoes` (Card 18) com 6 cores
  (indigo, emerald, amber, rose, violet, slate). A integração com o sistema
  `theme_accent` do Directus já existe, mas **não** está a propagar para
  `tokens.css` — só usa `theme-accent` no DOM como data-attribute. Migrar para
  gerar CSS vars dinâmicas é um follow-up.
- **Dark mode polish**: sidebar dark usa `#1A2332` (legado). O brand-900
  (`#312E81`) é navy mais vibrante — pode ser ajustado depois de feedback.
- **Side-by-side A/B**: como cada call faz commits incrementais, é fácil
  reverter qualquer bloco. Mantém o branch curto-lived.

---

## 13. Ficheiros tocados

| Caminho                                       | Mudança                            |
|-----------------------------------------------|------------------------------------|
| `src/styles/tokens.css`                       | **novo** — tokens, animações      |
| `src/styles/themes.css`                       | stub (slot de extensão)            |
| `src/lib/theme.ts`                            | **novo** — typed accessor          |
| `src/components/ui/button.tsx`                | variantes expressivas              |
| `src/components/ui/card.tsx`                  | shadow brand, prop `interactive`   |
| `src/components/ui/input.tsx`                 | focus ring animado                |
| `src/components/ui/badge.tsx`                 | ícones Lucide, soft tints         |
| `src/components/ui/skeleton.tsx`              | shimmer animation                |
| `src/components/ui/sonner.tsx`                | variants success/error/warning   |
| `src/components/ui/sheet.tsx`                 | `withHandle` prop                 |
| `src/components/EmptyState.tsx`               | SVGs inline contextuais          |
| `src/components/dashboard/Sparkline.tsx`      | **novo** — recharts wrapper       |
| `src/components/layout/BottomNav.tsx`         | pill indicator animado           |
| `src/components/layout/TopBar.tsx`            | brand gradient                   |
| `src/components/layout/AppSidebar.tsx`        | grupos Operação/Vendas/Base/Def  |
| `src/components/layout/AppLayout.tsx`         | `.page-enter` key                |
| `src/hooks/useReducedMotion.ts`               | **novo**                          |
| `src/hooks/useTheme.ts` → `.tsx`              | fix: SWC parsing JSX em `.ts`     |
| `src/index.css`                               | `@import tokens.css`             |
| `tailwind.config.ts`                          | brand-50..950, shadows brand,    |
|                                               | keyframes shimmer/page-fade-in   |
| `src/pages/Dashboard.tsx`                     | KpiTile com Sparkline            |
| `src/pages/settings/Appearance.tsx`           | cleanup (NULL bytes pré-exist.)  |

---

## 14. Como contribuir

1. Novos tokens vão em `tokens.css` sob `:root` (light) ou `.dark` (dark).
2. Adicionar à `tailwind.config.ts` se for reutilizado via utility class.
3. Adicionar ao `theme.ts` se for lido em JS (recharts, etc.).
4. Componentes shadcn vivem em `src/components/ui/` — manter a assinatura
   backwards-compatible (props opcionais, defaults sensatos).
5. Se precisares de uma nova animação, declara `@keyframes` em `tokens.css` e
   expõe via utility em `tailwind.config.ts`. Respeita `prefers-reduced-motion`.
