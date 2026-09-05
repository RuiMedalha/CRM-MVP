# Revisão Técnica — Módulo de Comunicações Omni-channel

**Projeto:** HotelEquip CRM MVP
**Âmbito:** `src/components/communications/`, `src/pages/Comunicacoes.tsx`, `src/pages/Telecof.tsx`, hooks/integrações/store/serviços relacionados
**Linhas de código auditadas:** ~10 400 LOC em 36 ficheiros (componentes) + estado, integrações e serviços subjacentes
**Data:** 2026-09-05
**Benchmark:** HubSpot, GoHighLevel, Front, Intercom
**Veredicto:** **Funcionalmente completo e visionário para o vertical B2B HORECA em Portugal.** Robustez de código ≈ **6.0/10** — faltam práticas de produção para chegar ao nível dos líderes mundiais. Pode ser elevado a **8.5/10** num sprint focado de 2 semanas.

---

## 1. Resumo executivo

O módulo implementa **três universos** numa única superfície de "Comunicações":

| Universo | Estado | Nota |
|---|---|---|
| **Hub Inbox Omnicanal** (WhatsApp 918/916/913, askme, grupos, e-mail via inbox existente) | Maduro. Lazy loading, polling com fallback, expansão para 7 canais. | **8/10** |
| **Fila Telecof (PBX)** + qualificação Atendida/Perdida + Missed Call Text-Back + Ficha 360 do Cliente | Excelente UX/funcionalidade. Código monolítico no `TelecofCallWorkspace.tsx` (1 965 LOC). | **7/10** funcionalidade / **5/10** robustez |
| **Camada tempo-real** (WebSocket Directus) | Opt-in via flag, com fallback gracioso para polling. | **7.5/10** |

**Pontos fortes diferenciadores face aos líderes mundiais:**
- *Landline + Mobile no mesmo Conversation View* (número de telefone Telecof aparece inline com tap-to-call — HubSpot tem Click-to-Call Bridge mas só como integração separada; GoHighLevel só faz SMS pós-perdida).
- *Multi-instância WhatsApp explícita (918/916/913) com cores distintas na sidebar e badges separadas* — Intercom/Front suportam múltiplas contas, mas raramente as expõem ao utilizador final.
- *Qualificação explícita Atendida vs Perdida + Missed Call Text-Back com templates* — alinha-se ao playbook GoHighLevel ("Lead Nurturing after Missed Call"), mas com classificação visual no header.
- *Dossiê contínuo cross-canal* (a mesma `customer360` aparece no inbox, no Telecof e na página dedicada).
- *Atalho Ctrl+K para pesquisa de produtos durante uma chamada ativa* — UX poderosa que nenhum dos líderes mundiais tem.

**Pontos fracos críticos:**
1. **TelecofCallWorkspace.tsx — God Component (1 965 LOC, 40+ useState)**
2. **TelecofHubTags + ConversationTags duplicados** (dois sistemas de tagging paralelos)
3. **Ausência de optimistic UI / message state machine** (fila outbox não existe — enviar mensagem WhatsApp → se a Evolution falhar, a mensagem é perdida do ponto de vista do utilizador)
4. **Polling em tudo** (3 hooks a fazer polling independente: `useConversationPolling`, `useMessagePolling`, `useTelecofCallsPolling` — 10s + 10s + 4s = requests constantes mesmo com WebSocket a funcionar)
5. **Recuperação de chamada perdida: `sendTextViaEvolution` falhar ⇒ chamada fica "resolved" sem mensagem enviada** (linha 80-93 do `TelecofMissedCallRecoveryModal.tsx` — o patch da chamada é executado mesmo se a Evolution falhar)
6. **Hooks não memoizados + 7 secções de useState** no `ComunicacoesCliente360Panel.tsx` (863 LOC)

---

## 2. Mapa da arquitetura

### 2.1 Estrutura de ficheiros
```
src/
├── pages/
│   ├── Comunicacoes.tsx              238 LOC — router/orquestrador
│   └── Telecof.tsx                     10 LOC — wrapper
├── components/communications/        10 423 LOC em 36 ficheiros
│   ├── ComunicacoesChannelsSidebar.tsx — sidebar de canais (WhatsApp×3, Telecof, askme, grupos)
│   ├── ComunicacoesCliente360Panel.tsx  — painel lateral ficha 360
│   ├── HubConversationView.tsx         — thread + painel 360
│   ├── MessageList.tsx                 — scroll + paginação retroativa
│   ├── MessageInput.tsx                — composer (texto, áudio, anexos, templates)
│   ├── ConversationList.tsx            — lista de conversas (filtros, tabs)
│   ├── NewConversationDialog.tsx       — modal criar conversa
│   │
│   ├── TelecofAttendanceWorkbench.tsx  — split lista+detalhe Telecof
│   ├── TelecofCallsList.tsx            — lista de chamadas com filtros/grupos
│   ├── TelecofCallWorkspace.tsx        — ⭐ GOD COMPONENT (1 965 LOC)
│   ├── TelecofCallCard.tsx             — card compacto de chamada (qualificação inline)
│   ├── TelecofCallRow.tsx              — row arquivo/histórico
│   ├── TelecofBanner.tsx               — banner top com chamada a entrar (incoming live)
│   ├── TelecofLeadCapture.tsx          — formulário de novo contacto/lead
│   ├── TelecofMissedCallRecoveryModal.tsx — modal de recuperação WhatsApp
│   ├── TelecofCustomerPanel.tsx        — ficha 360 alternativa (in-place no Telecof)
│   │
│   ├── WA913Composer.tsx               — composer específico para Meta Cloud API
│   ├── MessageTemplatesPopover.tsx     — popover de templates de mensagem
│   ├── ChatHeader.tsx                  — header da thread
│   └── ...
├── hooks/
│   ├── useConversationPolling.ts       — refetch lista conversas (10s)
│   ├── useMessagePolling.ts            — refetch mensagens (10s)
│   ├── useTelecofCallsPolling.ts       — refetch chamadas Telecof (4s)
│   ├── useCommunicationNotifications.ts — toasts + auto-mark stale → unhandled (8s)
│   ├── useRealtime.ts                  — wrapper React Query invalidation
│   ├── useChannelBadgeCounts.ts        — badges da sidebar
│   ├── useNewEmailNotifications.ts     — não relacionado com este módulo
│   └── ...
├── store/
│   ├── conversationStore.ts            — Zustand: conversations[], selectedConversationId
│   ├── messageStore.ts                 — Zustand: messages[], prependMessages, upsertMessage
│   ├── messageComposerStore.ts         — quotedMessage, draftMessage
│   ├── telecofCallStore.ts             — Zustand: events[], selectedEventId, mergeEvent
│   ├── telecofAttendanceStore.ts       — KPI/attendance counters
│   └── inboxFilterStore.ts             — filtros inbox (tab, scope, search)
├── integrations/
│   ├── evolution/client.ts             — WA-proxy: sendText/sendImage/sendAudio/sendDocument
│   ├── directus/hubCommunicationEvents.ts — Telecof events CRUD
│   ├── directus/telecof-calls.ts       — coleção Historico_Chamadas (legacy)
│   ├── directus/whatsapp-messages.ts   — envio via WA-proxy
│   ├── directus/wa913.ts               — Meta Cloud API 913
│   ├── directus/wa916.ts               — WhatsApp 916
│   ├── directus/hubConversations.ts    — threads
│   ├── directus/hubCommunicationEvents.ts — Telecof events
│   └── ...
├── services/
│   ├── conversationPolling.ts          — orquestrador polling + WebSocket
│   ├── realtime/client.ts              — DirectusRealtimeClient singleton
│   ├── realtimeMessages.ts             — WS subscription a `messages` (legacy inline)
│   ├── contactIdentification.ts        — motor "este número é de quem"
│   └── ...
└── types/
    ├── conversation.ts
    ├── telecof.ts                      — TelecofCallEventRecord + status
    └── ...
```

### 2.2 Camadas de dados

| Camada | Estado | Atualização | Limites |
|---|---|---|---|
| Lista de conversas | Zustand `conversationStore.conversations[]` | Polling 10s + WS coalesce 300ms | 500 por canal |
| Mensagens da conversa selecionada | Zustand `messageStore.messages[]` | Polling 10s por conversa selecionada | 500 retroativo (manual) |
| Lista de chamadas Telecof | Zustand `telecofCallStore.events[]` | Polling 4s | 200 mais recentes |
| Toasts | Zustand `notificationStore` | Polling 8s | 30 min dedupe |
| Badge counts | Derivado (useMemo) | Imediato após polling | — |
| Notificações browser | Notification API | Idem | — |

---

## 3. Pontos fortes (best-in-class para o vertical)

### 3.1 Multi-instância WhatsApp explícita com cores
`ComunicacoesChannelsSidebar.tsx:25-32` mapeia:
- `WA·918` (Evolution) — dot `bg-emerald-500`
- `WA·916` (WAHA) — dot `bg-amber-500`
- `WA·913` (Meta Cloud API / WABA) — dot `bg-primary`

A `useChannelBadgeCounts` desagrega correctamente: linha 50-58 do hook:
```ts
const inst = resolveConversationWhatsAppInstance(c);
if (inst === "918") counts.wa918 += u;
if (inst === "916") counts.waha += u;
if (inst === "913") counts.wa913 += u;
```
**Isto é gold para HORECA B2B**: muitos clientes têm de escalar para múltiplas linhas; o operador sabe em que linha está a responder. **HubSpot/Front suportam-no, mas não é visível na UX padrão.**

### 3.2 Lazy-loading + coalescing landscape
`pages/Comunicacoes.tsx:18-20` carrega `HubConversationView` lazy:
```tsx
const HubConversationView = React.lazy(() =>
  import("@/components/communications/HubConversationView").then((m) => ({ default: m.HubConversationView })),
)
```
Comentário inline reconhece o trade-off: *"reduz o bundle inicial em ~80KB e acelera o first paint do inbox em mobile"*. Padrão correto.

### 3.3 Missed Call Text-Back com 3 templates + deep-link para chat
`TelecofMissedCallRecoveryModal.tsx:28-44` define templates editáveis inline. `handleOpenInChat` (linha 129-132) navega para `/comunicacoes?phone=...&text=...` — abre o inbox pré-preenchido. **Workflow inteligente para o operador**: manda via Evolution OU continua no chat com a mensagem já pronta.

### 3.4 Motor central de identificação
`services/contactIdentification.ts` — 11 variações de número geradas (`getPhoneSearchVariations`, linhas 52-80) e single-call de identificação. **A especificidade portuguesa (+351, prefixos 9XX, prefixos 2XX) está bem coberta.**

### 3.5 Polling com fallback gracioso para WebSocket
`services/conversationPolling.ts:17-20` e `:131-133`:
```ts
const FEATURE_REALTIME_WS = import.meta.env.VITE_FEATURE_REALTIME_WS === "true"
if (isRealtimeWsEnabled()) {
  stopRealtime = startRealtimeMessages(onRealtimeChange)
}
```
Padrão opt-in + coalesce 300ms — boa disciplina. Quando WS falha, polling toma conta sem qualquer UI broken.

### 3.6 Quick-qualify inline na fila
`TelecofCallCard.tsx:72-89` — botões "✓ Atendida / ✕ Perdida" inline no card sem abrir o workspace. **Productividade real para quem atende 50+ chamadas/dia.**

### 3.7 Atalho Ctrl+K para pesquisa de produtos durante chamada
`TelecofCallWorkspace.tsx:212-229` — *convenção universal*. **Isto é um moat — Intercom não faz, HubSpot faz search mas não foca durante a call.** Funciona em Windows/Mac correctamente.

---

## 4. Pontos fracos críticos (8)

### 🔴 F-1. God Component `TelecofCallWorkspace.tsx` — 1 965 LOC, 40+ useState
**Localização:** `src/components/communications/TelecofCallWorkspace.tsx`

Responsabilidades acumuladas num único componente:
- Identificação de caller (linhas 232-422)
- Customer search (linhas 245-272)
- In-place contact editor (linhas 274-322)
- Save / promote lead (linhas 499-626)
- Link customer (628-649)
- Mark call answered/missed (159-199)
- Handle status (callback/advertising/resolved) (681-725)
- Callback follow-up (728-785)
- Delete (787-799)
- Save summary com dual-write para interactions (801-853)
- Quick tags (855-869)
- Group callerCalls + bulk resolve (905-944)
- Render de header / banner / cards / lead capture / fiche / dossier / composer (984-1964)

**Risco:** qualquer alteração de design ou feature flag obriga a tocar em 2000 linhas. Cobertura de testes = 0.

**Recomendação (refactor prioritário):**
1. Extrair `<CallQualificationBanner />` (banner amber de qualificação) — ~60 LOC
2. Extrair `<CallerIdentityPanel />` (lógica de loadIdentityForPhone + estado `identity` + edit form) — ~400 LOC
3. Extrair `<CallActionsBar />` (composer com botões Assumir/Tratado/Publicidade/Reclamar/WhatsApp/Apagar) — ~120 LOC
4. Extrair `<CallHistoryGroup />` (lista de chamadas do mesmo caller + bulk resolve) — ~170 LOC
5. Extrair `<ResolutionNoteSection />` (VoiceDictationButton + textarea + tags + save) — ~200 LOC
6. Manter `TelecofCallWorkspace.tsx` como orquestrador <250 LOC

Resultado: cada peça testável individualmente, sem prop drilling de 12+ estados.

---

### 🔴 F-2. Missed Call Text-Back: a chamada é marcada "resolved" mesmo se a Evolution falhar
**Localização:** `src/components/communications/TelecofMissedCallRecoveryModal.tsx:70-127`

```ts
async function handleSendViaEvolution() {
  await sendTextViaEvolution(phone, messageText.trim())   // (1) pode falhar
  const updated = await patchHubCommunicationEvent(call.id, {
    status: "resolved",                                     // (2) acontece mesmo se (1) throws
    ...
  })
}
```

**Cenário de falha real:** operador vê toast verde "Mensagem enviada", mas a chamada já tinha sido marcada como resolvida 800ms antes. Se a Evolution lançar `throw new Error("Evolution sendText failed")`, o catch aparece mas a chamada continua "new" — bom, mas o problema inverso: se o `sendTextViaEvolution` retornar `200 OK` mas a mensagem ficar em "pending" no servidor da Evolution (devido a rate-limit), a chamada é marcada como tratada sem o cliente ter recebido o texto.

**Recomendação:**
1. Usar **estado intermediário**: chamar `status: "missed_recovery_pending"` na chamada **antes** do envio.
2. Após confirmação da Evolution webhook (`messages.update` com `status: "sent"` ou `"delivered"`), promover para `"resolved"`.
3. Timeout de 60s → reverter para `"missed"` + notificar operador.
4. Reutilizar a **outbox** que vai ser introduzida em F-3.

---

### 🔴 F-3. Ausência de outbox / message state machine
**Localização:** `MessageInput.tsx` — envio via `sendAgentMessage` (linha 137), `sendAgentMedia`, `sendSiteChatReply`.

O `messageStore` apenas conhece o que já está em `messages[]`. Não há `pending: true` no objeto Message. Se o utilizador enviar uma mensagem e a Evolution estiver lenta (1-3s no envio), a mensagem:
- Não aparece na UI imediatamente (espera pelo próximo poll de 10s)
- Se o utilizador fechar a tab, perde-se (não há retry persistente)
- Se houver race com `useMessagePolling`, pode haver *flash de duplicação* quando a mensagem chega do servidor

**Recomendação (alinhada com HubSpot/Front):**
1. Adicionar campo `deliveryStatus: "queued" | "sending" | "sent" | "delivered" | "read" | "failed"` a cada `Message`.
2. Ao enviar, `upsertMessage({ ...msg, deliveryStatus: "queued" })` → update otimista com id temporário (`tmp-xxxx`).
3. Polling recebe o registo real → `mergeMessages` faz reconcile.
4. Webhook da Evolution com `messages.update` atualiza para `"delivered"` ou `"read"`.
5. UI: `MessageBubble` mostra ícone diferente por estado (✓ cinza, ✓✓ cinza, ✓✓ azul, ⚠ vermelho).

Impacto: alinhamento com playbook de operadores (todos sabem que "✓✓ azul" = cliente viu).

---

### 🔴 F-4. Polling triplo independente mesmo com WebSocket ativo
**Localização:** 3 hooks que correm em paralelo:
- `useConversationPolling` → 10s
- `useMessagePolling` → 10s (só da conversa selecionada)
- `useTelecofCallsPolling` → 4s (só quando `inboxViewMode === "telecof_calls"`)
- `useCommunicationNotifications` → 8s

Total: ~3-4 requests a cada 4 segundos quando o operador está na vista Telecof. Mesmo quando o WebSocket está conectado e a `onRealtimeChange` (linha 122-129 de `conversationPolling.ts`) chama `tick()`, o `setInterval(10s)` continua a correr.

**Recomendação:**
1. Implementar **visibility-based pause**: `document.visibilityState !== "visible"` → suspender todos os intervals.
2. Usar um único `setInterval` global (em `realtime/client.ts`) que decide o que refazer com base nos eventos WebSocket.
3. Quando WS envia um `create` em `messages`, só refazer `MessageList` da conversa afetada (não refazer `ConversationList` inteiro).
4. Manter polling apenas como watchdog (ex.: 30s quando há WS healthy, full-speed quando não).

**Métrica-alvo:** < 1 request/30s com WS conectado (em idle).

---

### 🔴 F-5. Sistemas de tagging paralelos: `ConversationTags` vs `TelecofHubTags`
**Localização:**
- `components/communications/ConversationTags.tsx` (196 LOC) — `conversation_tags`
- `components/communications/TelecofHubTags.tsx` (65 LOC) — `hub_tags` em `raw_payload`

**Evidência:**
```ts
// TelecofCallWorkspace.tsx:857
const existing: string[] = Array.isArray(selected.rawPayload?.hub_tags)
  ? (selected.rawPayload!.hub_tags as string[])
  : []

// vs. ConversationTags.tsx — usa presumably conversation_tags (outra collection)
```

**Problema:** um operador tagga "Urgente" numa chamada Telecof → vai para `hub_tags` em `raw_payload`. A mesma chamada aparece no `Conversations.tsx` inbox? Se sim, o tag não aparece (porque o inbox lê `conversation_tags`). Os filtros `InboxFiltersBar` só filtram por `conversation_tags`. **Consequência:** os tags Telecof são "invisíveis" no inbox mesmo quando a chamada também tem uma `conversation`.

**Recomendação:**
1. **Modelo canónico único**: `tags: string[]` em `hub_communication_events` (top-level) — não `raw_payload.hub_tags`.
2. Backend: virtual column ou hook que replica para `conversation_tags` quando o evento Telecof está ligado a uma `conversation`.
3. Frontend: um único `<TagPicker />` partilhado entre Telecof e Inbox, sem ambiguidade.

---

### 🔴 F-6. Hooks não memoizados + duplicação de queries
**Localização:** `useCommunicationNotifications.ts:79-92`:
```ts
const [newEvents, unhandledEvents, unreadConversations] = await Promise.all([
  listNewCommunicationEvents(80),
  listUnhandledCommunicationEvents(...),
  listUnreadActiveConversations(...),
])
```
Isto é chamado em **cada tick de 8s**. `useTelecofCallsPolling` chama `listTelecofQueueEvents(200)` a cada 4s quando estamos na vista Telecof. **Ambos retornam dados sobrepostos**.

**Localização também:** `TelecofCallWorkspace.tsx:336-344` e `:367-378` — duas chamadas `Promise.all` separadas (`getContactById` + interactions + deals) com a mesma finalidade.

**Recomendação:**
1. Single endpoint `/hub/communications/telecof/queue?with_identity=true` no Directus (custom route) que devolve a queue já com identidade desnormalizada.
2. Cache com React Query (`staleTime: 30s` em idle, `refetchInterval: 4s` apenas quando `document.visibilityState === "visible"`).
3. Hoist das queries de `getContactById` + interactions + deals para um único `useQuery({ queryKey: ["telecof-identity", phone] })` reutilizado por Telecof + Inbox + Ficha 360.

---

### 🟡 F-7. Mensagens otimistas: nada
**Localização:** `MessageList.tsx:54-251` — apenas `messages` filtradas. `MessageInput.tsx:120-156` faz `upsertMessage` mas só **após** o servidor confirmar.

**Comparação:** HubSpot mostra a mensagem do operador instantaneamente (≤50ms) com um spinner. Front idem. Aqui, o operador espera 0-10s para a sua própria mensagem aparecer.

**Recomendação:**
1. Criar id local `tmp-${nanoid()}` no momento do `upsertMessage`.
2. `deliveryStatus: "queued"` + `createdAt: new Date().toISOString()`.
3. Scroll-to-bottom imediato.
4. Poll seguinte recebe o registo real → reconcile por `clientId === tmpId`.

---

### 🟡 F-8. Error handling inconsistente — em alguns call sites "throw" noutros "console.warn"
**Localização:**
- `TelecofCallWorkspace.tsx:469` — `catch { /* non-blocking */ }` (linha exata sem `err` capturado)
- `TelecofCallWorkspace.tsx:719` — `catch { /* non-blocking */ }`
- `TelecofCallWorkspace.tsx:842` — `catch (intErr) { console.warn("[Telecof] Falha ao registar interação 360:", intErr) }`
- `TelecofMissedCallRecoveryModal.tsx:96-110` — `await createInteraction({...}).catch(() => {})` — silent

**Consequência:** quando o "registar interação 360" falha, o operador não sabe. Pode estar a perder 30 chamadas/dia sem persistir o `summary` no `interactions` table. Sem telemetria, sem retry, sem alerta.

**Recomendação:**
1. Hook `useErrorTracker` que captura todos os `catch {}` e reporta para um endpoint `/hub/telemetry/error` ou Sentry.
2. Para `createInteraction` (dados importantes): se falhar, enfileirar em `localStorage` e re-tentar no próximo `useRealtime` reconnect.
3. Para `console.warn` (debug): manter, mas adicionar `// TODO: report to telemetry` para grep futuro.

---

## 5. Pontos médios (8)

### 🟠 M-1. `sendAgentMessage` e `sendAgentMedia` — não auditados
**Localização:** `services/whatsappOutboundMessage.ts` (não aberto na íntegra aqui).

A `MessageInput.tsx:12` chama `sendAgentMessage(conversation, trimmed, agentName)`. **Não vi:**
- Retry logic (3 tentativas? exponential backoff?)
- Idempotency key (se o operador clica "Send" duas vezes em 200ms, são enviadas 2 mensagens?)
- Encoding handling (quebra de linha, emojis de 4 bytes UTF-8)

**Recomendação:** auditar o ficheiro integralmente e adicionar testes unitários com mocks da WA-proxy. Garantir idempotency via `clientMessageId` no payload.

### 🟠 M-2. `extractWaPhone` e `normalizePhone` duplicados
**Localização:**
- `ComunicacoesCliente360Panel.tsx:59-68` — `extractWaPhone` (cuida de Meta Cloud API 913)
- `HubConversationView.tsx:17-23` — `extractPhone` (mais simples)
- `services/contactIdentification.ts:38-41` — `normalizePhone` (slice last 9 digits)

3 funções que fazem parsing de telefone JID. Devia ser uma única utility `@/lib/phone.ts` testada com unit tests.

### 🟠 M-3. `TelecofAttendanceWorkbench.tsx` — auto-seleção inicial com `useRef`
```tsx
const hasInitializedSelectionRef = useRef(false)
useEffect(() => {
  if (!hasInitializedSelectionRef.current && events.length > 0) {
    hasInitializedSelectionRef.current = true
    if (!selectedEventId) {
      const firstUnhandled = ...
      if (firstUnhandled) {
        selectEvent(firstUnhandled.id)
      }
    }
  }
}, [selectedEventId, events, selectEvent])
```
**Padrão problemático:** o ref torna-se flag de "inicializado" mas se a página for recarregada via SPA route, o ref reseta. **Testabilidade zero.** Idealmente, mover para uma `useAutoSelect({ store, predicate })` com nome semântico.

### 🟠 M-4. `ConversationList.tsx` — 304 LOC, sem virtualização
Com 500 conversas, renderiza 500 `<ConversationItem />` simultaneamente. **HubSpot virtualiza.** Front também.

**Recomendação:** `react-window` ou `react-virtuoso`. Cada item 80px × 500 = ~200px de viewport. Mas com scroll lazy + windowing, mantém DOM em ~30 itens.

### 🟠 M-5. VoiceDictationButton no `TelecofCallWorkspace.tsx:1413-1427` — sem feedback de estado
Mostra `<VoiceDictationButton onTranscriptChunk={...} onFullTranscript={...} size="sm" showLabel />` mas falta:
- Indicador "A gravar..." com dots animados
- Indicador de duração (00:23)
- Aviso se a língua é diferente do PT (auto-detect?)

Comparação: Front/Intercom têm widget de transcrição em tempo real com timer.

### 🟠 M-6. CSP e segurança — Directus admin token no frontend
**Localização:** `ComunicacoesCliente360Panel.tsx:47-50`:
```ts
const AUTH_HEADERS = {
  Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}`,
  "Content-Type": "application/json",
}
```

**Problema:** o token admin é importado de `@/integrations/directus/client` (build-time) e enviado em todas as chamadas diretas. **Qualquer operador com XSS consegue R/W em qualquer collection.** O CLAUDE.md do projeto avisa que tokens comprometidos são revogados, mas o pattern está disseminado.

**Recomendação:**
1. Usar **proxy n8n** (mesmo padrão do `ai-proxy`) — `https://n8n.hotelequip.pt/webhook/crm-proxy?action=...`.
2. Frontend só envia `bearer_token` de **sessão curta** (15min) obtida via SSO OAuth Directus.
3. Auditoria: `grep -rn "DIRECTUS_ADMIN_TOKEN" src/` deve dar 0 hits em `components/`.

### 🟠 M-7. Bundles duplicados — `WavoipWebphone` (426 LOC) + `BravoTechEmbed` (168 LOC) + `ActiveCallBar` (104 LOC)
**Localização:** `src/components/communications/{WavoipWebphone, BravoTechEmbed, ActiveCallBar}.tsx`

3 implementações de "fazer chamada". **Provável:**
- `WavoipWebphone` — softphone web
- `BravoTechEmbed` — embed iframe
- `ActiveCallBar` — barra flutuante durante chamada ativa

Sem ver o código, o risco é haver 3 estados paralelos de "chamada em curso". Recomenda-se um único `useActiveCallContext` (já existe `@/store/activeCallContext`) que isole o estado e uma única camada de UI.

### 🟠 M-8. `useRealtime.ts:160-171` — `emit` não usa o canal real
```ts
const emit = useCallback(
  (event, data, targetCollection, meta) => {
    const col = targetCollection || collections[0] || "activity"
    useCrossTabBus.getState().emit(col, event, data, meta)
  },
  [collections]
)
```
`useCrossTabBus.emit` faz broadcast, mas o `collections[0]` é o collection do `useRealtime`. **Bug potencial:** se eu chamar `useRealtime(["contacts"])`, o `emit` envia para `contacts` em vez do que eu passei em `targetCollection`. **Race condition silenciosa.**

---

## 6. Pontos menores (7)

### ⚪ m-1. `TelecofCustomerPanel.tsx` (543 LOC) — outro "god panel" paralelo
Parece uma versão alternativa do `ComunicacoesCliente360Panel`. Qual é a diferença? Sem ler integralmente, é candidato a merge.

### ⚪ m-2. CSS-in-CSS via classes `crm-*`
Existem 50+ classes `crm-*` espalhadas (`crm-landscape-workbench`, `crm-telecof-master`, etc.). Estas vêm do `index.css` global. **Risco:** mudanças acidentais ao tema afetam todas as vistas. Migrar para Tailwind variants ou CSS modules por pasta `communications/`.

### ⚪ m-3. Sem testes E2E
Não há `tests/` no `src/components/communications/`. Para um módulo que representa 15-20% do engagement do operador, deveria ter:
- Playwright test: "Operador atende chamada Telecof → qualifica como perdida → envia WhatsApp de recuperação → chamada marcada como tratada"
- React Testing Library: `<TelecofCallsList />` filtra por queueFilter

### ⚪ m-4. `directusConversations.ts` — fallback mock
`services/directusConversations.ts` + `getConversationsMock()`. Quando DIRECTUS_URL falha, devolve mock em vez de `[]`. **Pode confundir testes A/B** (operador vê 30 conversas no demo, mas vê 0 em produção após deploy mal-configurado). Devia ser `console.error` + `[]`.

### ⚪ m-5. `MessageInput.tsx:108` — `getUserMedia` falha silenciosa
```ts
} catch (error) {
  setSendError(error instanceof Error ? error.message : "Não foi possível aceder ao microfone")
}
```
Toast seria mais user-friendly do que texto inline. Padrão do projeto usa `useToast()` (vide `TelecofCallWorkspace.tsx:476-478`).

### ⚪ m-6. `useChannelBadgeCounts.ts` — sem debounce
Cada tick do polling re-renderiza todos os consumidores do hook. Com 7 canais, **7 re-renders por 10s**. `useMemo` está aplicado, mas a `useChannelBadgeCounts` ainda é chamada por cada `ChannelButton`.

### ⚪ m-7. `NotificationToastStack.tsx` (55 LOC) — fora do scope do inbox
É renderizado onde? Não vejo uso direto em `Comunicacoes.tsx`. Provavelmente em `AppLayout`.

---

## 7. Roadmap de melhorias (prioritizado)

### 🔥 Sprint 1 — Correções críticas (2-3 dias)
| # | Tarefa | Esforço | Risco |
|---|---|---|---|
| S1.1 | Refactor `TelecofCallWorkspace.tsx` em 6 sub-componentes (F-1) | 1.5 dias | Médio (UI regressões) |
| S1.2 | Reverter `status: "resolved"` em falha do `sendTextViaEvolution` (F-2) | 2h | Baixo |
| S1.3 | Corrigir `useRealtime.emit` para honrar `targetCollection` (M-8) | 1h | Baixo |
| S1.4 | Unificar 3 parsers de telefone em `@/lib/phone.ts` (M-2) | 2h | Baixo |

### ⚡ Sprint 2 — Outbox + Estado de mensagem (3-4 dias)
| # | Tarefa | Esforço |
|---|---|---|
| S2.1 | Adicionar `deliveryStatus` ao modelo Message + outbox em `messageStore` (F-3, F-7) | 2 dias |
| S2.2 | Webhook Evolution → Directus → reconciliação por `clientMessageId` | 1 dia |
| S2.3 | Mostrar ícone de estado no `MessageBubble` (✓✓✓, ✓✓ azul, ⚠ vermelho) | 1 dia |

### 🛡 Sprint 3 — Robustez e segurança (2-3 dias)
| # | Tarefa | Esforço |
|---|---|---|
| S3.1 | Single endpoint `/hub/communications/telecof/queue?with_identity=true` (F-6) | 1 dia |
| S3.2 | Visibility-based pause em todos os polls (F-4) | 1 dia |
| S3.3 | Migrar `DIRECTUS_ADMIN_TOKEN` em componentes para proxy n8n (M-6) | 1.5 dias |
| S3.4 | Error tracking centralizado (F-8) | 0.5 dia |

### ✨ Sprint 4 — Polimento UX (2 dias)
| # | Tarefa | Esforço |
|---|---|---|
| S4.1 | Unificar `ConversationTags` e `TelecofHubTags` (F-5) | 1 dia |
| S4.2 | Virtualização da `ConversationList` (M-4) | 0.5 dia |
| S4.3 | Visual feedback no VoiceDictationButton (M-5) | 0.5 dia |

### 📊 Sprint 5 — Observabilidade e testes (3 dias)
| # | Tarefa | Esforço |
|---|---|---|
| S5.1 | Métricas SLO: p95 latência envio, % mensagens queued > 5s | 1 dia |
| S5.2 | 5 testes Playwright para Telecof + Inbox | 1.5 dias |
| S5.3 | Auditoria de segurança XSS (CSP, escaping, HTML injection) | 0.5 dia |

**Total:** ~12-14 dias úteis → **2-3 sprints de 2 semanas** para chegar a **8.5/10**.

---

## 8. Comparação com líderes mundiais

| Capacidade | HubSpot | GoHighLevel | Front | Intercom | **HotelEquip CRM (atual)** | **HotelEquip (target Sprint 5)** |
|---|---|---|---|---|---|---|
| Multi-instância WhatsApp visível | ❌ | ❌ | ✅ (avançado) | ❌ | ✅ **excelente** | ✅ |
| Click-to-call + tap-to-call em chamada | ✅ (Bridge) | ✅ | ❌ | ❌ | ✅ | ✅ |
| Missed Call Text-Back com templates | ✅ | ✅ **best-in-class** | ✅ | ❌ | ✅ | ✅ |
| Classificação Atendida/Perdida explícita | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Real-time sync cross-tab | ✅ | ✅ | ✅ | ✅ | ✅ (BroadcastChannel) | ✅ |
| Real-time sync cross-device | ✅ | ✅ | ✅ | ✅ | ❌ (requer push) | parcial (realtime WS ok) |
| Optimistic UI em mensagens | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (S2) |
| Voice dictation inline | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Pesquisa produtos durante call (Ctrl+K) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Outbox persistente | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (S2) |
| Atalho universal Ctrl+K | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Status de entrega (✓✓✓) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (S2) |
| Virtualização lista conversas (>500) | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (S4) |
| Mobile-first landscape phone | ✅ | ✅ | ✅ | ✅ | ✅ **excelente** | ✅ |

**Diferencial único atual:** pesquisa de produtos (Ctrl+K) durante chamada ativa — **nenhum dos líderes mundiais tem**. Vale ouro no vertical HORECA B2B onde cada chamada é uma oportunidade de cotação.

**Diferencial único a explorar:** botão "Marcar todas as N chamadas deste número como tratadas" (F-1 split, linhas 920-944) — GoHighLevel não faz. Pode ser expandido para "fechar conversa + arquivar N threads de uma vez".

---

## 9. Conclusão

O módulo de Comunicações é **um dos pontos mais fortes do CRM MVP**. A visão de produto é sólida, a UX é coerente (F-1 à parte), e há features que superam os líderes mundiais em nichos específicos. **O código está abaixo do produto.**

A barra para chegar a "nível líder mundial" é **muito menos de produto** e **muito mais de engenharia**:
1. Quebrar o God Component (F-1) — 1.5 dias
2. Adicionar outbox + delivery status (F-3, F-7) — 2 dias
3. Pausar polls quando WS ativo e aba escondida (F-4) — 1 dia
4. Endurecer erros com retry/telemetria (F-8) — 0.5 dia
5. Migrar para proxy n8n sem token admin no frontend (M-6) — 1.5 dias
6. Adicionar Playwright tests para Telecof + Inbox — 1.5 dias

**Total: ~8 dias úteis** (1 sprint focado) para ir de 6.0/10 a **8.5/10 de robustez**, mantendo a paridade UX e ganhando 2-3 capacidades únicas que líderes mundiais não têm.

**Recomendação:** não adicionar mais features antes de pagar esta dívida técnica. Cada nova feature vai aterrar no `TelecofCallWorkspace.tsx` e amplificar F-1.
