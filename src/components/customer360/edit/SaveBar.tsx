/**
 * SaveBar — barra sticky de gravação da Ficha Mestre.
 * Mostra contagem de alterações, estado, e botões.
 */

import { Button } from "@/components/ui/button";
import { Save, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

interface SaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  lastError: string | null;
  lastSuccess: boolean;
  changeCount?: number;
  lastSavedAt?: string;
  onSave: () => void;
  onCancel: () => void;
  onOpenCustomer360?: () => void;
  onNewProposal?: () => void;
  onNewQuotation?: () => void;
}

export function SaveBar({
  isDirty, isSaving, lastError, lastSuccess, changeCount = 0,
  lastSavedAt, onSave, onCancel, onOpenCustomer360,
  onNewProposal, onNewQuotation,
}: SaveBarProps) {
  return (
    <div className="flex items-center justify-between sticky top-0 z-10 bg-[#f8f9fb] border-b border-border py-2.5 px-1 -mx-1">
      <div className="flex items-center gap-3">
        {lastError && (
          <span className="flex items-center gap-1 text-xs text-destructive font-medium">
            <AlertCircle className="h-3.5 w-3.5" /> {lastError}
          </span>
        )}
        {lastSuccess && !isDirty && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Todas as alterações guardadas
            {lastSavedAt && <span className="text-muted-foreground ml-1">({lastSavedAt})</span>}
          </span>
        )}
        {isDirty && !lastError && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {changeCount > 0 ? `${changeCount} alteração${changeCount > 1 ? "es" : ""} por guardar` : "Alterações por guardar"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {onNewProposal && (
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            onClick={onNewProposal}
          >
            + Proposta
          </Button>
        )}
        {onNewQuotation && (
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs gap-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            onClick={onNewQuotation}
          >
            + Orçamento
          </Button>
        )}
        {onOpenCustomer360 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={onOpenCustomer360}>
            ← Voltar ao Customer360
          </Button>
        )}
        {isDirty && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
            <X className="h-3 w-3 mr-1" /> Cancelar
          </Button>
        )}
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onSave} disabled={!isDirty || isSaving}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {isSaving ? "A guardar..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
