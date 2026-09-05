/**
 * CustomerDossierPanel — vista base reutilizável do "dossier contínuo".
 *
 * Compoe:
 *   • Header com nome + telefone + badge (variante "telecof")
 *   • CompactTimeline (últimas 5 interações)
 *   • AddNoteInline (textarea para nova nota)
 *   • Inline datetime picker para agendar follow-up (sem modal — leve)
 *   • ConvertActions (Lead→Contacto, Contacto→Oportunidade)
 *   • CTA "Abrir ficha completa"
 *
 * Variantes:
 *   • telecof:  fundo branco/card, header completo, padding generoso
 *   • hubchat:  compacto (420px), sem header repetido (shell já tem)
 *   • threec-sixty: viewport 100%, sem header (shell 360 já tem)
 *
 * Quando contactId === null e leadId === null, renderiza empty state.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  ExternalLink,
  Inbox,
  Loader2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { CompactTimeline } from "./CompactTimeline";
import { AddNoteInline } from "./AddNoteInline";
import { ConvertActions } from "./ConvertActions";
import { useCustomerDossier } from "@/hooks/useCustomerDossier";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CustomerDossierPanelProps {
  contactId?: string | number | null;
  leadId?: string | number | null;
  variant?: "telecof" | "hubchat" | "threec-sixty";
  /** Origem padrão para notas (default = variant). */
  defaultSource?: string;
  /** callId para associar notas à chamada activa (Telecof). */
  callId?: string;
  /** Quick tags na textarea. */
  noteQuickTags?: string[];
  /** Esconder header (a shell 360 já tem o próprio). */
  hideHeader?: boolean;
  /** Permitir agendamento inline de follow-up. */
  allowFollowUp?: boolean;
  /** Mostrar botão "Criar Oportunidade" mesmo quando é só Lead? */
  showConversionOnLead?: boolean;
  /** Callback quando algo é criado (nota, follow-up, conversão). */
  onActivity?: (kind: "note" | "follow-up" | "conversion" | "opportunity") => void;
}

export function CustomerDossierPanel({
  contactId,
  leadId,
  variant = "telecof",
  defaultSource,
  callId,
  noteQuickTags,
  hideHeader = false,
  allowFollowUp = true,
  showConversionOnLead = false,
  onActivity,
}: CustomerDossierPanelProps) {
  const dossier = useCustomerDossier({ contactId, leadId });

  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);

  const compact = variant === "hubchat";
  const cId = contactId ? String(contactId) : "";
  const lId = leadId ? String(leadId) : "";
  const hasAny = Boolean(cId || lId);
  const source = defaultSource || (variant === "telecof" ? "telecof" : "crm");

  async function handleScheduleFollowUp() {
    if (!followUpAt) {
      toast({ title: "Escolhe data e hora", variant: "destructive" });
      return;
    }
    setSubmittingFollowUp(true);
    try {
      const result = await dossier.scheduleFollowUp({
        due_at: new Date(followUpAt).toISOString(),
        type: "call",
        notes: followUpNote.trim() || undefined,
        title: dossier.contact?.company_name
          ? `Rechamar ${dossier.contact.company_name}`
          : dossier.lead?.display_name
            ? `Rechamar ${dossier.lead.display_name}`
            : undefined,
      });
      if (result?.id) {
        toast({
          title: "Follow-up agendado",
          description: "Visível na Agenda.",
        });
        setFollowUpAt("");
        setFollowUpNote("");
        onActivity?.("follow-up");
      } else {
        toast({
          title: "Não foi possível agendar",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro a agendar follow-up",
        description: String((err as Error)?.message || err),
        variant: "destructive",
      });
    } finally {
      setSubmittingFollowUp(false);
    }
  }

  // Empty state: sem contactId nem leadId
  if (!hasAny) {
    return (
      <section
        className={cn(
          "rounded-xl border border-dashed border-border bg-card text-center",
          compact ? "p-4" : "p-6",
        )}
      >
        <Inbox className={cn("mx-auto text-muted-foreground", compact ? "h-6 w-6" : "h-8 w-8")} />
        <p
          className={cn(
            "mt-2 font-semibold text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          Dossiê do cliente
        </p>
        <p
          className={cn(
            "mt-1 text-muted-foreground",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          Crie ou associe uma ficha para começar a acumular histórico.
        </p>
      </section>
    );
  }

  const fullName =
    dossier.contact?.company_name ||
    dossier.contact?.contact_name ||
    dossier.lead?.display_name ||
    "Cliente";
  const phone = dossier.contact?.phone || dossier.lead?.phone || "";

  return (
    <div
      className={cn(
        "space-y-3",
        compact ? "" : "rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/10 p-3",
      )}
    >
      {/* Header */}
      {!hideHeader && (
        <header
          className={cn(
            "flex items-start justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/60",
            compact ? "pb-2" : "pb-3",
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shadow-sm",
                compact ? "h-7 w-7" : "h-9 w-9",
              )}
            >
              <Building2 className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    "truncate font-bold text-foreground",
                    compact ? "text-xs" : "text-sm",
                  )}
                >
                  {fullName}
                </h3>
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center rounded font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
                    compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
                  )}
                >
                  Cliente 360
                </span>
              </div>
              {!compact && phone && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {cId && (
              <Button asChild variant="outline" size="sm" className="h-7 text-xs border-emerald-400/60 bg-emerald-100/80 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200 font-semibold shadow-xs">
                <Link to={`/customer360-shell/${encodeURIComponent(cId)}`} title="Abrir página completa do Cliente 360">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Abrir 360
                </Link>
              </Button>
            )}
          </div>
        </header>
      )}

      {/* Quick facts (telecof only — hubchat/360 já mostram) */}
      {!compact && dossier.contact && (
        <div className="grid grid-cols-2 gap-2 text-[11px] bg-card/70 p-2.5 rounded-lg border border-border">
          {phone && (
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{phone}</span>
            </div>
          )}
          {dossier.contact.email && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{dossier.contact.email}</span>
            </div>
          )}
          {dossier.contact.nif && (
            <div className="flex items-center gap-1.5 truncate">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">NIF: {dossier.contact.nif}</span>
            </div>
          )}
          {dossier.contact.city && (
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{dossier.contact.city}</span>
            </div>
          )}
        </div>
      )}

      {/* Negócios abertos */}
      {dossier.openDealsCount > 0 && (
        <section
          className={cn(
            "space-y-1.5",
            compact
              ? ""
              : "rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 bg-card p-3",
          )}
        >
          {!compact && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Negócios abertos ({dossier.openDealsCount})
            </p>
          )}
          <div className="space-y-1">
            {dossier.openDeals.map((d) => (
              <div
                key={String(d.id)}
                className="flex items-center justify-between rounded-md bg-card/80 p-2 text-xs border border-border/60"
              >
                <span className="font-medium text-foreground truncate">{d.title || `Negócio #${d.id}`}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                  {Number(d.total_amount || 0).toLocaleString("pt-PT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <CompactTimeline
        interactions={dossier.recentInteractions}
        maxItems={5}
        variant={compact ? "hubchat" : "default"}
        emptyMessage="Primeira interação — adicione a primeira nota abaixo."
      />

      {/* Adicionar nota */}
      <AddNoteInline
        contactId={contactId}
        leadId={leadId}
        source={source}
        callId={callId}
        quickTags={noteQuickTags}
        variant={variant}
        onSaved={() => onActivity?.("note")}
      />

      {/* Agendar follow-up inline (Telecof only — HubChat já tem) */}
      {allowFollowUp && variant === "telecof" && (
        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Agendar follow-up
          </h3>
          <Input
            type="datetime-local"
            value={followUpAt}
            onChange={(e) => setFollowUpAt(e.target.value)}
            className="text-sm"
          />
          <Input
            type="text"
            value={followUpNote}
            onChange={(e) => setFollowUpNote(e.target.value)}
            placeholder="Nota do follow-up (opcional)"
            className="text-sm"
          />
          <Button
            type="button"
            onClick={handleScheduleFollowUp}
            disabled={!followUpAt || submittingFollowUp}
            className="w-full h-9 text-sm font-semibold"
          >
            {submittingFollowUp ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> A agendar…
              </>
            ) : (
              "📅 Agendar follow-up"
            )}
          </Button>
        </section>
      )}

      {/* Ações de conversão — sempre que houver contactId OU leadId.
          (Para lead, ConvertActions decide internamente se mostra 'Promover
          a Contacto' ou só 'Criar Oportunidade' consoante contact_id.) */}
      {(cId || lId) && (
        <ConvertActions
          contactId={contactId}
          leadId={leadId}
          contactName={dossier.contact?.company_name || dossier.contact?.contact_name}
          variant={variant}
          onConverted={(r) => onActivity?.(r.kind === "lead" ? "conversion" : "opportunity")}
        />
      )}
    </div>
  );
}
