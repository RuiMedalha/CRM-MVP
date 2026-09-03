# Mobile-First Redesign — Card 10

> **Status:** ✅ Card 10 implementation — Inbox omnichannel as home + mobile-first redesign

This document captures the mobile-first redesign introduced in card 10 of the CRM MVP roadmap. The Inbox (WhatsApp + Email + Instagram) is the new "home" of the operator experience — every meaningful action starts there. Desktop gets the same content in a denser split layout.

---

## Goals

1. **One-handed operation** — operators triage and reply from a phone (375×667 → 414×896) without precision taps.
2. **Inbox-first** — `/inbox` is the default landing for everything except `/dashboard` (the only place where KPIs need screen real estate).
3. **Predictable density** — every primary action fits a 44×44 px tap target, every secondary action is reachable with one thumb.
4. **Works offline-first** — the inbox list degrades gracefully when Directus is slow; skeleton states never block the UI.
5. **Dark mode parity** — light + dark must look intentionally designed, not a CSS afterthought.

---

## Viewport targets

| Profile | Width × Height | DPR | Use case |
|---------|----------------|-----|----------|
| iPhone SE (3rd gen) | 375 × 667 | 2 | Worst-case budget — every pixel here is gold. |
| iPhone 13/14 mini | 375 × 812 | 3 | Notch device, default reference. |
| Pixel 5 | 393 × 851 | 2.75 | Android parity. |
| Galaxy A-series | 360 × 800 | 2 | Smallest Android. |
| iPad mini portrait | 768 × 1024 | 2 | Tablet — splits into two-column earlier. |
| iPhone landscape | 812 × 375 | 3 | Landscape phone — bottom-nav becomes top-tab. |

All viewports verified via Chrome DevTools device emulation + a physical iPhone 13 mini test pass.

---

## Component inventory

### `BottomNav.tsx` — mobile navigation
- 4 tabs: **Conversas · Leads · Hoje · Definições**
- Hidden on desktop (`>768px` via `lg:hidden`).
- Safe-area-aware — `pb-[env(safe-area-inset-bottom)]` for iOS notch/home indicator.
- Active tab uses `text-primary` + `aria-current="page"`.
- Unread badge wired to `notificationStore.badgeCounts.unreadCount` (omnichannel, not just email).
- Touch target ≥ 44px (full-width tap area per tab).

### `TopBar.tsx` — global chrome
- Sticky at top, `z-30`.
- Compact: hamburger (mobile only), title (desktop only), global search, activity feed, notification bell, avatar dropdown.
- Avatar dropdown contains profile · settings · theme toggle · sign-out.
- Theme toggle uses `next-themes` with the existing `class` strategy (Tailwind `darkMode: ["class"]`).
- Safe to render without `ThemeProvider` (falls back gracefully).

### `InboxOmnichannel.tsx` — unified inbox
- Channel chips: **Todos · WhatsApp · Email · IG** (pill style, min-height 36px).
- Status chips: **Todas · Não lidas · Com estrela · Arquivadas** (smaller pill).
- Search input (44px height) with debounce-free live filter.
- Swipe gestures (framer-motion `useMotionValue`):
  - **Swipe right (>100px)** → toggle starred (amber reveal).
  - **Swipe left (>100px)** → archive (slate reveal).
  - Drag constraints `[-120, 120]`, dragElastic 0.15.
- Inline quick reply (Enter to send, Esc to cancel).
- Quick actions: Reply, Call (WhatsApp only), Star, Archive.
- AnimatePresence for enter/exit (180ms).
- Empty state with friendly icon.

### `Dashboard.tsx` — split layout
- **Desktop (≥lg):** 50/50 grid.
  - Left: `InboxOmnichannel` with channel chips hidden (`compact` mode).
  - Right: 2×2 KPI tiles (Contactos, Activos, Ganhos, Pipeline €) + ForecastWidget + Pendentes (emails/proposals) cards.
  - Below-fold: Contactos summary, Agenda de hoje, Para fazer (urgencies).
- **Mobile (<lg):** Tabs (Conversas / Hoje) with unread badge on Conversas.
  - Conversas tab → `InboxOmnichannel` with `maxItems={8}`.
  - Hoje tab → KPI grid + Urgency pills + Agenda + Forecast.
- Animated entry via `framer-motion` (`y: -4 → 0`, 200ms).

---

## Touch & accessibility

- **Tap target ≥ 44×44 px** — every primary CTA (button, link-as-button, icon-only button).
- **`touch-action: pan-y`** on swipeable rows — vertical scroll still works during horizontal swipe.
- **`-webkit-tap-highlight-color: transparent`** via global CSS (already present in `index.css`).
- **Keyboard** — Tab order matches reading order, focus rings via `ring-ring`.
- **ARIA** — `aria-current="page"` on active tab, `aria-label` on icon buttons, `role="button"` on swipeable rows where needed.
- **Dark mode** — `dark:` variants for every color (`text-*`, `bg-*`, `border-*`); icons retain their channel colors (WhatsApp green, IG pink).

---

## Performance budget

- **Inbox list** — virtualised when >200 items; renders 25 per scroll viewport via `useMemo`.
- **First paint** — Dashboard skeleton shows within 200ms; KPIs stream in after.
- **Animations** — 180–220ms enter, 120ms exit; respect `prefers-reduced-motion` (Tailwind's `motion-safe:` prefix where applicable).
- **Bundle** — `framer-motion` adds ~30KB gzipped; justified by swipe + transition quality.

---

## Testing

### Manual smoke (must pass before merge)

1. **375×667** — bottom-nav visible, no horizontal scroll, KPI tiles fit 2-col.
2. **375×812** — bottom-nav respects safe-area, topbar fits under notch.
3. **360×800** — same as above; no overlap with system bars.
4. **812×375** (landscape) — bottom-nav still works; InboxOmnichannel list scrolls independently.
5. **1440×900** — split 50/50 visible, all KPIs readable, below-fold reachable by scroll.

### Accessibility smoke

- [ ] Tab through entire page — focus visible.
- [ ] VoiceOver/NVDA reads tab labels + active state.
- [ ] Swipe row with screen reader on — Star/Archive still announce.
- [ ] High-contrast mode — borders still visible, no contrast failures.
- [ ] Reduced-motion — animations disabled, content still readable.

### Automated (where available)

- Vitest unit tests on `InboxOmnichannel` filter logic (channel + status + search).
- Playwright mobile-emulation snapshot tests for the 4 viewports above.
- axe-core audit for color contrast.

---

## Rollout

- Card 10 ships as one PR (`feat/card-10-inbox-home`).
- Behind the scenes: `notificationStore.unreadCount` already drives the bottom-nav badge — no extra wiring.
- Migration: `BottomNav` items changed (removed Painel/Chat FAB). If you were navigating to `/dashboard` via FAB, use the new "Hoje" tab instead.
- The `MoreSheet` (sub-modules menu) was deliberately dropped in favour of an explicit "Definições" tab. Other modules (Loja, Pedidos, etc.) are reachable via `/menu` or by tapping the avatar → "Definições".

---

## Known follow-ups (not in card 10)

- **Swipe-to-call** (WhatsApp only) — already stubbed; needs `Wavoip` integration.
- **Pull-to-refresh** on inbox list — `react-pull-to-refresh` candidate.
- **Notification bell** mobile-specific sound — currently uses default OS toast.
- **Avatar dropdown** should open *up* on mobile (currently opens down by default).
- **Tablet** (md but <lg) — currently uses mobile tabs; needs a third "split" breakpoint with a sidebar collapse.

---

## References

- Tailwind config: `darkMode: ["class"]`
- `next-themes` ThemeProvider: `attribute="class"` (matches Tailwind).
- Apple HIG 44×44 minimum tap target.
- Material Design 3 — touch targets.
- WCAG 2.1 AA — color contrast (4.5:1).
