import { useCallback, useMemo, useState } from "react";
import { Inbox as InboxIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useEmailThreads } from "@/hooks/useEmailThreads";
import type { EmailThread } from "@/hooks/useEmailThreads";
import { useConversationStore } from "@/store/conversationStore";
import { useTelecofCallStore } from "@/store/telecofCallStore";
import { useCurrentEmployee } from "@/hooks/useCurrentEmployee";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, Mail, MessageCircle, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { UnifiedInboxList } from "@/components/inbox/UnifiedInboxList";
import { UnifiedConversationFeed } from "@/components/inbox/UnifiedConversationFeed";
import { MiniCustomer360 } from "@/components/inbox/MiniCustomer360";
import type {
  InboxChannelKey,
  InboxStatusKey,
  UnifiedInboxItem,
} from "@/components/inbox/types";
import type { Conversation } from "@/types/conversation";
import type { TelecofCallEventRecord } from "@/types/telecof";
import { findContactByPhone } from "@/integrations/directus/contactLookup";
import { getContactById } from "@/integrations/directus/contacts";
import { patchDeal } from "@/integrations/directus/deals";
import { applyInboxFilters } from "@/components/inbox/inboxFilters";
import { useInboxKeyboardNav } from "@/hooks/useInboxKeyboardNav";

// ─── Adapter: existing unified items → UnifiedInboxItem ─────────────────────

function emailToUnified(t: EmailThread): UnifiedInboxItem {
  const status: UnifiedInboxItem["status"] =
    t.status === "closed"
      ? "closed"
      : t.status === "assigned" || t.status === "replied"
      ? "assigned"
      : "open";
  return {
    id: `email-${t.id}`,
    channel: "email",
    title: t.subject || "(sem assunto)",
    subtitle: t.ai_summary || "",
    contact: t.from_address || "",
    date: t.date_created,
    urgency: (t.urgency as UnifiedInboxItem["urgency"]) || "normal",
    status,
    assignedTo: t.assigned_to ?? null,
    slaAt: t.sla_due_at ?? null,
    unread: !t.assigned_to && status !== "closed",
    ownedByCurrentUser: (eid) => Boolean(eid && t.assigned_to && String(t.assigned_to) === String(eid)),
    raw: t,
  };
}

function conversationToUnified(c: Conversation): UnifiedInboxItem {
  const status: UnifiedInboxItem["status"] =
    c.status === "closed" || c.status === "archived"
      ? "closed"
      : c.assignedTo
      ? "assigned"
      : "open";
  return {
    id: `wa-${c.id}`,
    channel: "whatsapp",
    title: c.customerName || c.id,
    subtitle: c.lastMessage || "",
    contact: c.customerName || "",
    date: c.updatedAt,
    urgency: c.priority === "urgent" ? "high" : "normal",
    status,
    assignedTo: c.assignedTo ?? null,
    slaAt: null,
    unread: status === "open" && (c.unreadCount ?? 0) > 0,
    ownedByCurrentUser: (eid) =>
      Boolean(eid && c.assignedTo && String(c.assignedTo) === String(eid)),
    raw: c,
  };
}

function callToUnified(e: TelecofCallEventRecord): UnifiedInboxItem {
  const status: UnifiedInboxItem["status"] =
    e.resolvedAt || e.operationalStatus === "resolved"
      ? "closed"
      : e.assignedTo || e.claimedAt
      ? "assigned"
      : "open";
  return {
    id: `call-${e.id}`,
    channel: "call",
    title: e.customerName || e.phone,
    subtitle:
      e.shortMessage ||
      (e.direction === "missed"
        ? "Chamada perdida"
        : `Chamada ${e.direction || ""}`),
    contact: e.phone,
    date: e.createdAt,
    urgency: e.operationalStatus === "new" ? "high" : "normal",
    status,
    assignedTo: e.assignedTo ?? null,
    slaAt: null,
    unread: status === "open",
    ownedByCurrentUser: (eid) =>
      Boolean(eid && e.assignedTo && String(e.assignedTo) === String(eid)),
    raw: e,
  };
}

const CHANNELS: Array<{ key: InboxChannelKey | "all"; label: string }> = [
  { key: "all", label: "Tudo" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "call", label: "Chamadas" },
];

const CHANNEL_BADGE: Record<
  InboxChannelKey,
  { icon: typeof Mail; tint: string; label: string }
> = {
  whatsapp: { icon: MessageCircle, tint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "WhatsApp" },
  email: { icon: Mail, tint: "bg-blue-500/15 text-blue-700 dark:text-blue-300", label: "Email" },
  call: { icon: Phone, tint: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Chamada" },
};

export default function Inbox() {
  const { employee } = useCurrentEmployee();

  const [channelFilter, setChannelFilter] = useState<InboxChannelKey | "all">("all");
  const [statusFilter, setStatusFilter] = useState<InboxStatusKey>("all");
  const [selectedItem, setSelectedItem] = useState<UnifiedInboxItem | null>(null);
  // Lista filtrada/ordenada — calculada pelo UnifiedInboxList e usada pelo keyboard nav.
  const [filteredItems, setFilteredItems] = useState<UnifiedInboxItem[]>([]);

  const { data: emailThreads, isLoading: emailLoading } = useEmailThreads({
    status: "",
    mailbox: "",
    category: "",
    onlyUnassigned: false,
  });
  const conversations = useConversationStore((s) => s.conversations);
  const callEvents = useTelecofCallStore((s) => s.events);

  const items = useMemo<UnifiedInboxItem[]>(() => {
    const emails = (emailThreads ?? []).map(emailToUnified);
    const wa = conversations.map(conversationToUnified);
    const calls = callEvents.map(callToUnified);
    return [...emails, ...wa, ...calls];
  }, [emailThreads, conversations, callEvents]);

  const totalPending = items.filter((i) => i.status !== "closed").length;

  // Quando o pai muda canal ou filtro, o filho recalcula — mas se a prop
  // não chegar a tempo, recalculamos aqui também como fallback.
  const filteredFallback = useMemo(
    () =>
      applyInboxFilters(items, {
        channel: channelFilter,
        status: statusFilter,
        currentEmployeeId: employee?.id ?? null,
      }),
    [items, channelFilter, statusFilter, employee?.id],
  );
  const effectiveFiltered = filteredItems.length > 0 ? filteredItems : filteredFallback;

  // Shortcuts de teclado: J / K / Enter / Esc.
  useInboxKeyboardNav({
    items: effectiveFiltered,
    selectedId: selectedItem?.id ?? null,
    onSelect: setSelectedItem,
    onEscape: () => setSelectedItem(null),
    enabled: true,
  });

  // Cards de atalho do empty state.
  const shortcutCounts = useMemo(() => {
    const now = Date.now();
    let unread = 0;
    let sla = 0;
    let mine = 0;
    for (const i of items) {
      if (i.unread) unread++;
      if (i.slaAt && new Date(i.slaAt).getTime() < now) sla++;
      if (employee?.id && i.ownedByCurrentUser(employee.id)) mine++;
    }
    return { unread, sla, mine };
  }, [items, employee?.id]);

  const goPrev = useCallback(() => {
    const idx = effectiveFiltered.findIndex((i) => i.id === selectedItem?.id);
    if (idx > 0) setSelectedItem(effectiveFiltered[idx - 1]);
  }, [effectiveFiltered, selectedItem]);

  const goNext = useCallback(() => {
    const idx = effectiveFiltered.findIndex((i) => i.id === selectedItem?.id);
    if (idx >= 0 && idx < effectiveFiltered.length - 1) {
      setSelectedItem(effectiveFiltered[idx + 1]);
    }
  }, [effectiveFiltered, selectedItem]);

  const position = useMemo(() => {
    if (!selectedItem) return null;
    const idx = effectiveFiltered.findIndex((i) => i.id === selectedItem.id);
    if (idx < 0) return null;
    return { index: idx + 1, total: effectiveFiltered.length };
  }, [effectiveFiltered, selectedItem]);

  return (
    <AppLayout fullHeight>
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Inbox Unificado</h1>
              <Badge variant="secondary" className="text-xs">
                {totalPending} pendentes
              </Badge>
              {effectiveFiltered.length > 0 && effectiveFiltered.length !== items.length ? (
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                  {effectiveFiltered.length} filtrados
                </Badge>
              ) : null}
            </div>
            {/* Channel quick-filter (kept at top for the GHL look) */}
            <div className="hidden items-center gap-1 sm:flex">
              {CHANNELS.map((ch) => {
                const active = ch.key === channelFilter;
                return (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => setChannelFilter(ch.key)}
                    className={
                      "h-8 rounded-full border px-3 text-xs font-medium transition-colors " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted")
                    }
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3-column grid: list · feed · mini-360 (hidden < md) */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)_320px]">
          {/* Column 1: unified list */}
          <aside
            aria-label="Lista unificada"
            className="min-h-0 overflow-hidden border-b border-border md:border-b-0 md:border-r"
          >
            <UnifiedInboxList
              items={items}
              selectedId={selectedItem?.id ?? null}
              onSelect={setSelectedItem}
              channel={channelFilter}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              currentEmployeeId={employee?.id ?? null}
              onFilteredChange={setFilteredItems}
            />
          </aside>

          {/* Column 2: conversation feed — centralizada como ponto focal */}
          <main
            aria-label="Conversa seleccionada"
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
              <FeedHeader
                item={selectedItem}
                position={position}
                onPrev={goPrev}
                onNext={goNext}
                hasPrev={
                  !!selectedItem &&
                  effectiveFiltered.findIndex((i) => i.id === selectedItem.id) > 0
                }
                hasNext={
                  !!selectedItem &&
                  effectiveFiltered.findIndex((i) => i.id === selectedItem.id) >=
                    0 &&
                  effectiveFiltered.findIndex((i) => i.id === selectedItem.id) <
                    effectiveFiltered.length - 1
                }
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                {selectedItem ? (
                  <UnifiedConversationFeed item={selectedItem} />
                ) : (
                  <EmptyInbox
                    unread={shortcutCounts.unread}
                    sla={shortcutCounts.sla}
                    mine={shortcutCounts.mine}
                    onPickStatus={(s) => setStatusFilter(s)}
                  />
                )}
              </div>
            </div>
          </main>

          {/* Column 3: mini Customer 360 (hidden < md) */}
          <aside
            aria-label="Mini ficha 360"
            className="hidden min-h-0 overflow-hidden md:block"
          >
            <RightPane item={selectedItem} />
          </aside>
        </div>

        {/* Mobile bottom-sheet for selected conversation */}
        <Sheet
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
        >
          <SheetContent
            side="bottom"
            className="max-h-[85vh] rounded-t-xl px-0 pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Voltar à lista"
                  className="h-10 w-10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <SheetTitle className="text-base">Conversa</SheetTitle>
                <div className="w-10" />
              </div>
            </SheetHeader>
            <div className="max-h-[calc(85vh-3.5rem)] overflow-hidden">
              <UnifiedConversationFeed item={selectedItem} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}

// ─── Central column header (sticky w/ backdrop blur + nav arrows) ────────────

function FeedHeader({
  item,
  position,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  item: UnifiedInboxItem | null;
  position: { index: number; total: number } | null;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const meta = item ? CHANNEL_BADGE[item.channel] : null;
  const Icon = meta?.icon ?? MessageCircle;
  const slaText = item?.slaAt
    ? new Date(item.slaAt).toLocaleString("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const slaOverdue =
    item?.slaAt && new Date(item.slaAt).getTime() < Date.now();

  return (
    <div
      className={
        "sticky top-0 z-10 shrink-0 border-b border-border bg-background/80 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 " +
        "shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
      }
    >
      <div className="flex items-center gap-2">
        {/* ← Anterior */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Conversa anterior (K)"
          onClick={onPrev}
          disabled={!hasPrev}
          className="h-9 w-9 shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {item ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
                (meta?.tint ?? "bg-muted text-muted-foreground")
              }
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">
                {item.title || meta?.label || "Conversa"}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{item.contact || meta?.label}</span>
                {slaText ? (
                  <>
                    <span aria-hidden>•</span>
                    <span
                      className={
                        "inline-flex items-center gap-1 " +
                        (slaOverdue ? "font-semibold text-destructive" : "")
                      }
                    >
                      SLA {slaText}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">Nenhuma conversa seleccionada</span>
          </div>
        )}

        {/* Posição "3 de 27" */}
        <div className="hidden shrink-0 items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground sm:flex">
          {position ? (
            <>
              <span className="text-foreground">{position.index}</span>
              <span>de</span>
              <span className="text-foreground">{position.total}</span>
            </>
          ) : (
            <span>—</span>
          )}
        </div>

        {/* Próximo → */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Próxima conversa (J)"
          onClick={onNext}
          disabled={!hasNext}
          className="h-9 w-9 shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Empty state (centralizado, com atalhos J/K + 3 cards) ───────────────────

function EmptyInbox({
  unread,
  sla,
  mine,
  onPickStatus,
}: {
  unread: number;
  sla: number;
  mine: number;
  onPickStatus: (s: InboxStatusKey) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-muted/20 px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <InboxIcon className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-medium text-foreground">
          📬 Selecciona uma conversa para começar
        </p>
        <p className="text-sm text-muted-foreground">
          ou usa <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px]">J</kbd> / <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px]">K</kbd> para navegar
        </p>
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onPickStatus("unread")}
          className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Não lidos
          </span>
          <span className="text-2xl font-bold text-foreground">{unread}</span>
        </button>
        <button
          type="button"
          onClick={() => onPickStatus("sla_breached")}
          className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive">
            SLA vencido
          </span>
          <span className="text-2xl font-bold text-foreground">{sla}</span>
        </button>
        <button
          type="button"
          onClick={() => onPickStatus("mine")}
          className="flex flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Meus
          </span>
          <span className="text-2xl font-bold text-foreground">{mine}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Right column (mini Customer 360 + active deal card) ────────────────────

function RightPane({ item }: { item: UnifiedInboxItem | null }) {
  const phone =
    item?.channel === "call"
      ? (item.raw as TelecofCallEventRecord).phone || ""
      : item?.channel === "whatsapp"
      ? (item.raw as Conversation).customerName || ""
      : item?.contact || "";

  // Best-effort lookup of a contact id for this item.
  const { data: contactIdByPhone } = useQuery({
    queryKey: ["mini-360-phone-lookup", phone],
    queryFn: () => findContactByPhone(phone),
    enabled:
      !!item &&
      !!phone &&
      (item.channel === "whatsapp" || item.channel === "call"),
    staleTime: 60_000,
  });

  const fallbackCustomerId =
    item?.channel === "email"
      ? null
      : item?.channel === "whatsapp"
      ? ((item.raw as Conversation).contactId ?? null)
      : null;

  const effectiveCustomerId = contactIdByPhone ?? fallbackCustomerId ?? null;

  const { data: contact = null, isLoading: contactLoading } = useQuery({
    queryKey: ["mini-360-contact", String(effectiveCustomerId ?? "")],
    queryFn: () => getContactById(String(effectiveCustomerId ?? "")),
    enabled: !!effectiveCustomerId,
    staleTime: 60_000,
  });

  const handleCreateQuotation = (_customerId: string | number) => {
    // Navigate to the quotation builder with the customer pre-selected.
    window.location.assign(`/propostas?customerId=${_customerId}`);
  };

  const handleChangeStage = async (
    deal: { id: string; status?: string | null },
    nextStatus: string,
  ) => {
    try {
      await patchDeal(deal.id, { status: nextStatus });
    } catch {
      // swallow — caller will retry on next click
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-card/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Mini 360
      </div>
      {item ? (
        <MiniCustomer360
          contact={contact ?? null}
          loading={contactLoading}
          customerId={effectiveCustomerId}
          onCreateQuotation={handleCreateQuotation}
          onChangeStage={handleChangeStage}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-xs text-muted-foreground">
          {phone ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Selecione uma conversa para ver o cliente."
          )}
        </div>
      )}
    </div>
  );
}
