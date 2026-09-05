import { ArrowDownLeft, ArrowUpRight, Clock, PhoneCall } from "lucide-react"

import {
  isOperationallyUnhandled,
  operationalStatusLabel,
  operationalStatusTone,
} from "@/lib/telecofQueue"

import { useContactNameForPhone } from "@/services/contactIdentification"
import { useTelecofCallStore } from "@/store/telecofCallStore"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"

import type { TelecofCallEventRecord } from "@/types/telecof"

/**
 * Redesign landscape — card compacto da fila activa.
 *
 * Alvo: 64px de altura, telefone SEMPRE visível numa linha própria.
 *   [avatar] nome ................................ estado
 *            telefone (tap-to-call)
 *            [dir] hora · agente
 *
 * O card inteiro é um alvo de toque >=64px (>=44px WCAG 2.5.5). Uma
 * barra amber à esquerda marca chamadas não tratadas.
 */

const TONE_CLASS: Record<ReturnType<typeof operationalStatusTone>, string> = {
  violet: "bg-primary/10 text-primary ring-primary/30",
  amber: "bg-amber-100 text-amber-900 ring-amber-300",
  blue: "bg-blue-500/10 text-blue-700 ring-blue-300 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-700 ring-emerald-300 dark:text-emerald-400",
  slate: "bg-muted text-foreground ring-border",
  orange: "bg-orange-100 text-orange-900 ring-orange-300",
  red: "bg-red-100 text-red-900 ring-red-300 dark:bg-red-950/30 dark:text-red-400",
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  event: TelecofCallEventRecord
  callCount?: number
  hasUnhandled?: boolean
  selected?: boolean
  onSelect?: () => void
}

function isPhoneLike(value?: string | null): boolean {
  if (!value) return false
  const stripped = value.replace(/[\s\-\+\(\)]/g, "")
  return /^\d{7,15}$/.test(stripped)
}

export function TelecofCallCard({ event, callCount = 1, hasUnhandled, selected, onSelect }: Props) {
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const tone = operationalStatusTone(event)
  const unhandled = hasUnhandled !== undefined ? hasUnhandled : isOperationallyUnhandled(event)
  const DirIcon = event.direction === "outbound" ? ArrowUpRight : ArrowDownLeft
  const phone = event.phone || event.normalizedPhone
  const isNamePhone = !event.customerName || isPhoneLike(event.customerName)
  const resolved = useContactNameForPhone(isNamePhone ? phone : undefined)
  const displayName = (!isNamePhone ? event.customerName?.trim() : null) || resolved.name || event.customerName?.trim() || "Sem nome"

  const isUnqual = !event.callStatus && (event.operationalStatus === "new" || event.operationalStatus === "unhandled")

  async function handleQuickQualify(e: React.MouseEvent, type: "answered" | "missed") {
    e.stopPropagation()
    try {
      const now = new Date().toISOString()
      const updated = await patchHubCommunicationEvent(event.id, {
        call_status: type,
        status: type === "answered" ? "in_progress" : "unhandled",
        raw_payload: {
          ...(event.rawPayload ?? {}),
          call_qualification: type,
          qualified_at: now,
        },
      })
      mergeEvent(updated)
    } catch {
      // non-blocking
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "crm-telecof-call-card flex min-h-[64px] w-full flex-col justify-center gap-0.5 rounded-lg border px-3 py-2 text-left transition",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/40",
        unhandled ? "border-l-4 border-l-amber-400" : "",
      ].join(" ")}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {displayName}
        </span>
        {callCount > 1 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30"
            title={`${callCount} chamadas deste número`}
          >
            <PhoneCall className="h-3 w-3" />
            {callCount}x
          </span>
        )}
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASS[tone]}`}
        >
          {operationalStatusLabel(event)}
        </span>
      </span>

      <div className="flex items-center justify-between gap-1">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="crm-telecof-phone text-sm font-bold text-primary hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
            title={`Ligar ${phone}`}
          >
            {phone}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">sem número</span>
        )}

        {isUnqual && (
          <span className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => void handleQuickQualify(e, "answered")}
              className="rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold transition-colors"
              title="Classificar como Atendida"
            >
              ✓ Atendida
            </button>
            <button
              type="button"
              onClick={(e) => void handleQuickQualify(e, "missed")}
              className="rounded bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-bold transition-colors"
              title="Classificar como Chamada Perdida / Não Atendida"
            >
              ✕ Perdida
            </button>
          </span>
        )}
      </div>

      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DirIcon className="h-3.5 w-3.5 shrink-0" />
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{formatWhen(event.startedAt ?? event.createdAt)}</span>
        {callCount > 1 ? (
          <span className="truncate font-medium text-amber-700 dark:text-amber-400">
            · {callCount} chamadas
          </span>
        ) : null}
        {event.assignedTo ? <span className="truncate"> · {event.assignedTo}</span> : null}
      </span>
    </button>
  )
}
