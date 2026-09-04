import { ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react"

import {
  isOperationallyUnhandled,
  operationalStatusLabel,
  operationalStatusTone,
} from "@/lib/telecofQueue"

import { useContactNameForPhone } from "@/services/contactIdentification"

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
  selected?: boolean
  onSelect?: () => void
}

function isPhoneLike(value?: string | null): boolean {
  if (!value) return false
  const stripped = value.replace(/[\s\-\+\(\)]/g, "")
  return /^\d{7,15}$/.test(stripped)
}

export function TelecofCallCard({ event, selected, onSelect }: Props) {
  const tone = operationalStatusTone(event)
  const unhandled = isOperationallyUnhandled(event)
  const DirIcon = event.direction === "outbound" ? ArrowUpRight : ArrowDownLeft
  const phone = event.phone || event.normalizedPhone
  const isNamePhone = !event.customerName || isPhoneLike(event.customerName)
  const resolved = useContactNameForPhone(isNamePhone ? phone : undefined)
  const displayName = (!isNamePhone ? event.customerName?.trim() : null) || resolved.name || event.customerName?.trim() || "Sem nome"

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
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASS[tone]}`}
        >
          {operationalStatusLabel(event)}
        </span>
      </span>

      {phone ? (
        <a
          href={`tel:${phone}`}
          className="crm-telecof-phone text-sm font-bold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
          title={`Ligar ${phone}`}
        >
          {phone}
        </a>
      ) : (
        <span className="text-sm text-muted-foreground">sem número</span>
      )}

      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <DirIcon className="h-3.5 w-3.5 shrink-0" />
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{formatWhen(event.startedAt ?? event.createdAt)}</span>
        {event.assignedTo ? <span className="truncate"> · {event.assignedTo}</span> : null}
      </span>
    </button>
  )
}
