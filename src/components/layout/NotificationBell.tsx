import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, MessagesSquare, ShoppingBag, ShoppingCart, CalendarClock, Check, Phone, Mail } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useNotificationStore } from "@/store/notificationStore"
import { listUnreadActiveConversations } from "@/integrations/directus/hubCommunicationEvents"
import { useRecentOrders, useAbandonedCarts } from "@/hooks/useActivityFeed"
import { useAuth } from "@/contexts/AuthContext"
import { getEmployeeByEmail } from "@/integrations/directus/employees"
import { listFollowUps, patchFollowUp, type FollowUpRow } from "@/integrations/directus/follow-ups"

const LAST_SEEN_KEY = "crm-bell-last-seen"

function getLastSeen(): number {
  const raw = localStorage.getItem(LAST_SEEN_KEY)
  const t = raw ? Number(raw) : 0
  return Number.isFinite(t) ? t : 0
}

function relTime(iso?: string): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ""
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return "agora"
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function fmtMoney(v?: number, currency = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(Number(v || 0))
}

interface BellRowProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  time: string
  isNew?: boolean
  onClick: () => void
}

function BellRow({ icon, title, subtitle, time, isNew, onClick }: BellRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          {isNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * Sino global de notificações: conversas não lidas + atividade do site
 * (encomendas e carrinhos abandonados), com deep-links. Badge combina os
 * contadores de comunicações (store, poll global) com a atividade nova do
 * site desde a última abertura (localStorage).
 */
export function NotificationBell() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [lastSeen, setLastSeen] = useState<number>(() => getLastSeen())
  const badgeCounts = useNotificationStore((s) => s.badgeCounts)

  // Atividade do site — hooks já usados no dashboard (poll 15s partilhado via queryKey)
  const { data: orders } = useRecentOrders(6)
  const { data: cartsData } = useAbandonedCarts(5)
  const carts = cartsData?.recent ?? []

  // Funcionário atual (para filtrar as tarefas às minhas)
  const { data: meEmp } = useQuery({
    queryKey: ["bell-me-employee", user?.email],
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    queryFn: () => getEmployeeByEmail(String(user!.email)),
  })

  // Tarefas devidas (atrasadas + hoje) — poll leve para o badge viver sempre.
  const endOfToday = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString()
  }, [])
  const { data: tasks } = useQuery({
    queryKey: ["bell-due-tasks", meEmp?.id, endOfToday],
    enabled: !!meEmp?.id,
    refetchInterval: 60000,
    retry: false, // se a relação assigned_employee_id estiver mal no Directus, não martelar
    queryFn: () => listFollowUps({ status: "open", assignedEmployeeId: meEmp!.id, dueBefore: endOfToday, limit: 50 }),
  })
  const dueTasks = useMemo(
    () => (tasks ?? []).slice().sort((a, b) => Date.parse(a.due_at || "") - Date.parse(b.due_at || "")),
    [tasks],
  )

  async function markTaskDone(id: string) {
    // Optimista: tira já da lista; se falhar, o refetch repõe.
    qc.setQueryData(["bell-due-tasks", meEmp?.id, endOfToday], (old: FollowUpRow[] | undefined) =>
      (old ?? []).filter((t) => t.id !== id))
    try {
      await patchFollowUp(id, { status: "done", completed_at: new Date().toISOString() })
    } finally {
      qc.invalidateQueries({ queryKey: ["bell-due-tasks"] })
      qc.invalidateQueries({ queryKey: ["follow-ups"] })
    }
  }

  // Conversas não lidas — só quando o popover abre
  const { data: unread } = useQuery({
    queryKey: ["bell-unread-conversations"],
    enabled: open,
    refetchInterval: open ? 8000 : false,
    queryFn: () => listUnreadActiveConversations(10),
  })

  const newOrders = useMemo(
    () => (orders ?? []).filter((o) => Date.parse(o.date_ordered || "") > lastSeen).length,
    [orders, lastSeen],
  )
  const newCarts = useMemo(
    () => carts.filter((c) => Date.parse(c.date_abandoned || "") > lastSeen).length,
    [carts, lastSeen],
  )

  const commTotal = badgeCounts.newCount + badgeCounts.unhandledCount + badgeCounts.unreadCount
  // Tarefas devidas entram sempre no badge (é o que o utilizador tem MESMO de fazer).
  const total = commTotal + newOrders + newCarts + dueTasks.length

  const markSeen = () => {
    const now = Date.now()
    localStorage.setItem(LAST_SEEN_KEY, String(now))
    setLastSeen(now)
  }

  const go = (url: string) => {
    setOpen(false)
    navigate(url)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) markSeen()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label={total > 0 ? `Notificações (${total})` : "Notificações"}
        >
          <Bell className="h-[18px] w-[18px]" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] max-w-[92vw] p-1.5">
        <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
          <p className="text-sm font-semibold text-foreground">Notificações</p>
          {total > 0 && (
            <button
              type="button"
              onClick={markSeen}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Marcar como visto
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {/* Tarefas devidas (topo — é o que o utilizador tem de fazer HOJE) */}
          {dueTasks.length > 0 && (
            <>
              <SectionLabel>As minhas tarefas</SectionLabel>
              {dueTasks.map((t) => {
                const overdue = t.due_at ? Date.parse(t.due_at) < Date.now() : false
                const contactId = t.contact_id?.id ?? t.contact_id
                const dealId = t.deal_id?.id ?? t.deal_id
                const href = contactId ? `/dashboard360/${contactId}` : dealId ? `/pipeline?dealId=${dealId}` : "/agenda"
                const TypeIcon = t.type === "call" ? Phone : t.type === "email" ? Mail : t.type === "whatsapp" ? MessagesSquare : CalendarClock
                const label = t.title || (t.contact_id?.company_name ? `${t.type} · ${t.contact_id.company_name}` : "Tarefa")
                return (
                  <div key={t.id} className="flex items-start gap-1 rounded-lg px-1 hover:bg-muted">
                    <button type="button" onClick={() => go(href)} className="flex min-w-0 flex-1 items-start gap-2.5 px-1.5 py-2 text-left">
                      <TypeIcon className={cn("mt-0.5 h-4 w-4 shrink-0", overdue ? "text-destructive" : "text-warning")} />
                      <span className="min-w-0 flex-1">
                        <span className="truncate text-sm font-medium text-foreground">{label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.contact_id?.company_name || t.deal_id?.title || "Sem ligação"}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-[10px] font-medium", overdue ? "text-destructive" : "text-muted-foreground")}>
                        {overdue ? "atrasada" : "hoje"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => markTaskDone(t.id)}
                      title="Marcar como feita"
                      className="mt-1.5 mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-success hover:bg-success hover:text-success-foreground"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </>
          )}

          {/* Conversas */}
          <SectionLabel>Conversas</SectionLabel>
          {(unread ?? []).length === 0 ? (
            <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">Sem mensagens por ler.</p>
          ) : (
            (unread ?? []).map((c) => (
              <BellRow
                key={c.id}
                icon={<MessagesSquare className="h-4 w-4 text-primary" />}
                title={c.customerName || "Visitante"}
                subtitle={`${c.unreadCount} mensagem(ns) não lida(s) · ${c.channel}`}
                time={relTime(c.updatedAt)}
                isNew
                onClick={() => go(`/comunicacoes?conversation=${c.id}`)}
              />
            ))
          )}

          {/* Encomendas do site */}
          <SectionLabel>Encomendas do site</SectionLabel>
          {(orders ?? []).length === 0 ? (
            <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">Sem encomendas recentes.</p>
          ) : (
            (orders ?? []).map((o) => (
              <BellRow
                key={o.id}
                icon={<ShoppingBag className="h-4 w-4 text-success" />}
                title={o.customer_name || `Encomenda ${o.order_number}`}
                subtitle={`#${o.order_number} · ${fmtMoney(o.total, o.currency || "EUR")}`}
                time={relTime(o.date_ordered)}
                isNew={Date.parse(o.date_ordered || "") > lastSeen}
                onClick={() => go(o.url)}
              />
            ))
          )}

          {/* Carrinhos abandonados */}
          <SectionLabel>Carrinhos abandonados</SectionLabel>
          {carts.length === 0 ? (
            <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">Sem carrinhos recentes.</p>
          ) : (
            carts.map((c) => (
              <BellRow
                key={c.id}
                icon={<ShoppingCart className="h-4 w-4 text-warning" />}
                title={c.customer_name || "Visitante"}
                subtitle={`${c.items_count || 0} artigo(s) · ${fmtMoney(c.cart_total, c.currency || "EUR")}`}
                time={relTime(c.date_abandoned)}
                isNew={Date.parse(c.date_abandoned || "") > lastSeen}
                onClick={() => go(c.url)}
              />
            ))
          )}
        </div>

        <div className={cn("border-t border-border pt-1", "mt-1")}>
          <button
            type="button"
            onClick={() => go("/comunicacoes")}
            className="w-full rounded-md px-2.5 py-1.5 text-center text-xs font-medium text-primary transition-colors hover:bg-muted"
          >
            Abrir Comunicações
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
