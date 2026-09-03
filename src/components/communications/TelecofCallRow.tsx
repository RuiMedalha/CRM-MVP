import { ArrowDownLeft, ArrowUpRight } from "lucide-react"

import {
  operationalStatusLabel,
  operationalStatusTone,
} from "@/lib/telecofQueue"
import { TelecofHubTags } from "./TelecofHubTags"

import { useContactNameForPhone } from "@/services/contactIdentification"

import type { TelecofCallEventRecord } from "@/types/telecof"

/**
 * Redesign landscape — row compacta (variante arquivo/histórico).
 *
 * Estrutura de 64px de altura em duas linhas:
 *   linha 1: [dir] nome ............................. hora
 *   linha 2: telefone (sempre visível, tap-to-call) · estado
 *
 * O telefone NUNCA trunca: fica em linha própria com fonte legível
 * (>=15px em landscape via index.css). Toda a row é um alvo de toque
 * de 64px (>=44px WCAG 2.5.5).
 */

const TONE_CLASS: Record<ReturnType<typeof operationalStatusTone>, string> = {
  violet: "bg-primary/10 text-primary",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  slate: "bg-muted text-muted-foreground",
  orange: "bg-orange-100 text-orange-800",
}

function formatTime(iso: string): string {
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

export function TelecofCallRow({ event, selected, onSelect }: Props) {
  const tone = operationalStatusTone(event)
  const DirIcon = event.direction === "outbound" ? ArrowUpRight : ArrowDownLeft
  const phone = event.phone || event.normalizedPhone
  const resolved = useContactNameForPhone(!event.customerName ? phone : undefined)
  const displayName = event.customerName?.trim() || resolved.name || "Sem nome"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`crm-telecof-call-row flex min-h-[64px] w-full flex-col justify-center gap-1 rounded-lg border px-3 py-2 text-left transition ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/60"
      }`}
    >
      <span className="flex items-center gap-2">
        <DirIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {displayName}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTime(event.startedAt ?? event.createdAt)}
        </span>
      </span>

      <span className="flex items-center gap-2 pl-6">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="crm-telecof-phone shrink-0 text-sm font-bold text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
            title={`Ligar ${phone}`}
          >
            {phone}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">sem número</span>
        )}
        <span
          className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
        >
          {operationalStatusLabel(event)}
        </span>
      </span>

      <TelecofHubTags event={event} size="xs" />
    </button>
  )
}
