import { MessagesSquare, Phone, X } from "lucide-react"
import { useNotificationStore } from "@/store/notificationStore"
import type { NotificationToastItem } from "@/types/operationalEvent"

function ToastIcon({ kind }: { kind: NotificationToastItem["kind"] }) {
  if (kind === "event") return <Phone className="h-4 w-4 shrink-0 text-amber-600" />
  return <MessagesSquare className="h-4 w-4 shrink-0 text-primary" />
}

function NotificationToast({ toast }: { toast: NotificationToastItem }) {
  const dismiss = useNotificationStore((s) => s.dismissToast)

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-border bg-card shadow-lg px-4 py-3 text-sm w-80 max-w-full pointer-events-auto animate-in slide-in-from-bottom-2 duration-300"
    >
      <ToastIcon kind={toast.kind} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground truncate">{toast.title}</p>
        <p className="text-muted-foreground text-xs truncate">{toast.subtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.key)}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Fechar notificação"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/**
 * Stack de toasts de notificação para o inbox omnicanal.
 * Montar fora do router, dentro do AppLayout.
 */
export function NotificationToastStack() {
  const toasts = useNotificationStore((s) => s.activeToasts)

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notificações"
      className="pointer-events-none fixed bottom-20 right-4 z-[200] flex flex-col gap-2 md:bottom-6 md:right-6"
    >
      {toasts.map((t) => (
        <NotificationToast key={t.key} toast={t} />
      ))}
    </div>
  )
}
