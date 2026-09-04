/**
 * ConvertActions — ações de conversão inline (Lead → Contacto, Contacto → Oportunidade).
 *
 * - "Promover a Contacto": visível só quando há Lead sem contact_id. Pede confirmação,
 *   chama useCustomerDossier().convertLeadToContact.
 *
 * - "Criar Oportunidade": visível só quando há Contacto. Abre Dialog shadcn com
 *   título obrigatório + valor opcional + pipeline stage. Chama createOpportunity
 *   do hook. Link "Abrir /propostas" para personalização avançada.
 *
 * Usado em CustomerDossierPanel; pode ser consumido diretamente.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightCircle,
  Briefcase,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCustomerDossier } from "@/hooks/useCustomerDossier";
import { DEAL_STATUSES } from "@/hooks/useDeals";
import type { DealStatus } from "@/integrations/directus/deals";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConvertActionsProps {
  contactId?: string | number | null;
  leadId?: string | number | null;
  contactName?: string | null;
  variant?: "telecof" | "hubchat" | "threec-sixty";
  onConverted?: (result: { kind: "lead" | "opportunity"; contactId: string }) => void;
}

export function ConvertActions({
  contactId,
  leadId,
  contactName,
  variant = "telecof",
  onConverted,
}: ConvertActionsProps) {
  const dossier = useCustomerDossier({ contactId, leadId });
  const [convertOpen, setConvertOpen] = useState(false);
  const [opportunityOpen, setOpportunityOpen] = useState(false);

  const [oppTitle, setOppTitle] = useState("");
  const [oppValue, setOppValue] = useState("");
  const [oppStage, setOppStage] = useState<DealStatus>("lead");
  const [submitting, setSubmitting] = useState(false);

  const cId = contactId ? String(contactId) : "";
  const lId = leadId ? String(leadId) : "";

  const leadNoContact = Boolean(lId) && !dossier.lead?.contact_id;
  const hasContact = Boolean(cId);
  const compact = variant === "hubchat";

  async function handleConvert() {
    setSubmitting(true);
    try {
      const result = await dossier.convertLeadToContact({
        company_name: contactName || dossier.lead?.display_name || undefined,
      });
      if (result?.contactId) {
        toast({
          title: "Lead promovido a Contacto",
          description: "Dossiê atualizado com timeline de conversão.",
        });
        onConverted?.({ kind: "lead", contactId: result.contactId });
        setConvertOpen(false);
      } else {
        toast({
          title: "Não foi possível promover a lead",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro a converter lead",
        description: String((err as Error)?.message || err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveOpportunity() {
    if (!oppTitle.trim()) {
      toast({ title: "Título é obrigatório", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const deal = await dossier.createOpportunity({
        title: oppTitle.trim(),
        value: oppValue ? Number(oppValue) : undefined,
        stage: oppStage,
      });
      if (deal?.id) {
        toast({
          title: "Oportunidade criada",
          description: `"${oppTitle.trim()}" adicionada ao pipeline.`,
        });
        onConverted?.({ kind: "opportunity", contactId: cId });
        setOppTitle("");
        setOppValue("");
        setOppStage("lead");
        setOpportunityOpen(false);
      } else {
        toast({
          title: "Não foi possível criar a oportunidade",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Erro a criar oportunidade",
        description: String((err as Error)?.message || err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!leadNoContact && !hasContact) {
    return null;
  }

  return (
    <>
      <section
        className={cn(
          "space-y-2",
          compact ? "" : "rounded-xl border border-border bg-card p-3",
        )}
      >
        {!compact && (
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ações de conversão
          </h3>
        )}

        <div className={cn("flex flex-wrap gap-1.5", compact && "flex-col")}>
          {leadNoContact && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConvertOpen(true)}
              disabled={submitting}
              className={cn(
                "font-semibold gap-1.5",
                compact ? "h-8 text-xs" : "h-9 text-sm",
                "border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40",
              )}
            >
              <ArrowRightCircle className="h-3.5 w-3.5" />
              Promover a Contacto
            </Button>
          )}

          {hasContact && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpportunityOpen(true)}
              disabled={submitting}
              className={cn(
                "font-semibold gap-1.5",
                compact ? "h-8 text-xs" : "h-9 text-sm",
                "border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/40",
              )}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Criar Oportunidade
            </Button>
          )}

          {hasContact && cId && (
            <Button
              type="button"
              variant="ghost"
              asChild
              className={cn(
                "font-semibold gap-1.5",
                compact ? "h-8 text-xs" : "h-9 text-sm",
              )}
            >
              <Link
                to={`/propostas/nova?customer_id=${encodeURIComponent(cId)}`}
                title="Abrir wizard de proposta com personalização avançada"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir /propostas
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Confirmação: Lead → Contacto */}
      <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promover Lead a Contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              {dossier.lead?.display_name
                ? `A lead "${dossier.lead.display_name}" será convertida num Contacto 360. O histórico e as notas ficam preservados na timeline do novo contacto.`
                : "Esta lead será convertida num Contacto 360. O histórico fica preservado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConvert();
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> A converter…
                </>
              ) : (
                "Promover a Contacto"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal mínimo: criar oportunidade */}
      <Dialog open={opportunityOpen} onOpenChange={setOpportunityOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova oportunidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título *</Label>
              <Input
                value={oppTitle}
                onChange={(e) => setOppTitle(e.target.value)}
                placeholder="Ex: Cozinha completa Hotel X"
                className="mt-1"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Etapa</Label>
                <Select value={oppStage} onValueChange={(v) => setOppStage(v as DealStatus)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (€)</Label>
                <Input
                  type="number"
                  value={oppValue}
                  onChange={(e) => setOppValue(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Cliente: {contactName || dossier.contact?.company_name || "—"}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpportunityOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleSaveOpportunity} disabled={submitting || !oppTitle.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> A criar…
                </>
              ) : (
                "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
