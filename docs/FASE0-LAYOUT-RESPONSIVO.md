# FASE 0 — Estratégia de Layout Responsivo (`/comunicacoes`)

Estratégia responsiva para o cockpit de comunicações do CRM, reaproveitando o
que já existe nos dois repos (`crm-lab-directus` e `hotelequip-communication-hub`).

## Base existente

**CRM (`crm-lab-directus`)**
- `AppLayout`: `flex min-h-screen` → `AppSidebar` (`hidden md:flex`) + `main` (`pb-16 md:pb-0`) + `BottomNav`. Tem modo `embed` (fullscreen sem sidebar).
- `BottomNav`: `fixed bottom-0 md:hidden`, 5 itens (Painel, Card 360, Leads, Contactos, **Mais** → `/menu`).
- `MenuMobile` (`/menu`): lista `md:hidden` com todos os itens, incl. Comunicações.
- `AppSidebar`: `hidden md:flex`, collapse 64px ↔ 256px.
- shadcn `Sheet`, `Drawer`, `Dialog` já disponíveis em `src/components/ui/`.

**Hub (`hotelequip-communication-hub`)** — padrões mobile a imitar (não portar código):
- `mobileInboxStore` (Zustand): `pane: "list" | "detail" | "customer"`.
- `MobileBackButton`, `MobileCustomerSheet` (bottom-sheet à mão), `MobileTelecofActions`.

## Breakpoints (Tailwind)

Dois pontos de corte: **`md` (768px)** e **`xl` (1280px)**. `lg` não é usado para colunas.

| Região        | Mobile `<md`            | Tablet `md`–`<xl`           | Desktop `xl`+              |
| ------------- | ----------------------- | --------------------------- | -------------------------- |
| Sidebar app   | escondida (BottomNav)   | **64px** (auto-collapse)    | **256px** (expandida)      |
| Inbox/Canais  | 1 coluna (pane=list)    | `w-[260px]`                 | `w-[280px]`                |
| Conversa      | 1 coluna (pane=detail)  | `flex-1`                    | `flex-1`                   |
| Cliente 360   | pane=customer (full)    | `Sheet side="right"`        | coluna `w-[260px]`         |
| Telecof       | banner full-width       | banner topo                 | banner/popup topo          |

Classes-chave:
- Canais: `hidden md:flex w-full md:w-[260px] xl:w-[280px]`
- Conversa: `flex-1 min-w-0`
- Cliente 360 (coluna): `hidden md:hidden xl:flex xl:w-[260px]`

## Decisões

- **Sidebar — Opção A**: auto-collapse abaixo de `xl` (1280px) em **todo** o CRM, via
  `matchMedia("(max-width: 1279px)")` no `AppSidebar` (mantém o toggle manual dentro do breakpoint).
- **BravoTech**: deixa de ocupar o centro. Mantém-se como **fallback** num componente
  separado (`BravoTechEmbed`), invocável quando necessário. O centro passa a ser a
  conversa nativa, com **estado vazio** ("Selecciona uma conversa") enquanto a
  integração de mensagens não está ligada.

## Estado "qual coluna visível" (mobile)

Estado **local à página** (sem dependência nova de Zustand no CRM), espelhando a
máquina do hub:

```ts
type Pane = "list" | "detail" | "customer";
```

- `md+`: as colunas existem sempre por CSS → `pane` é ignorado.
- `<md`: escolher canal → `pane="detail"`; "Voltar" → `pane="list"`; "Ver ficha" → `pane="customer"`.
- `contactId` (via `searchParams`) é transversal a todos os breakpoints.

## Cliente 360 — Sheet/Drawer

Usar os primitivos **shadcn do CRM** (não o `MobileCustomerSheet` do hub, que é
hard-coded em slate e não usa tokens):
- **Tablet (md–xl)**: `Sheet side="right"` aberto pelo botão "Ver ficha do cliente".
- **Mobile (<md)**: `pane="customer"` em ecrã inteiro com botão "Voltar".
- **Desktop (xl)**: coluna fixa de 260px, sempre visível.

> Nota: `ComunicacoesCliente360Panel` tem larguras presas (`lg:w-80 xl:w-96`); como
> não se toca no componente, o encaixe faz-se com override `w-full` no wrapper
> (via `twMerge`).

## Notas de integração

1. **Full-bleed**: cancelar o padding do `AppLayout` com `-mx-4 -mt-4 md:-mx-6 md:-mt-6`.
2. **Altura**: mobile `h-[calc(100dvh-4rem)]` (desconta `BottomNav` 4rem); `md:h-[100dvh]`.
3. **Telecof** (futuro): banner acima das colunas, full-width em mobile.
4. **Tokens**: bolhas/badges usam `channel-*` e `state-*` definidos na Parte 1.
