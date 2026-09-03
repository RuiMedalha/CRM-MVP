/**
 * NextAction — mostra a próxima acção/follow-up de uma Organization.
 * Reutilizável: Customer360, Pipeline cards, Listagens.
 * Se não existir follow-up: alerta visual.
 */

import { cn } from "@/lib/utils";
import { AlertTriangle, Clock } from "lucide-react";

export interface NextActionData {
  title: string;
  dueAt?: string;
  assignedTo?: string;
  type?: string;
  overdue?: boolean;
}

interface NextActionProps {
  action: NextActionData | null;
  compact?: boolean;
}

export function NextAction({ action, compact = false }: NextActionProps) {
  if (!action) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2",
        compact && "px-2 py-1.5"
      )}>
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-xs font-medium text-amber-700">Sem próxima acção definida</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2",
      action.overdue ? "border-red-200 bg-red-50" : "border-border bg-card",
      compact && "px-2 py-1.5"
    )}>
      <Clock className={cn("h-3.5 w-3.5 shrink-0", action.overdue ? "text-red-500" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <span className={cn("text-xs font-medium block truncate", action.overdue ? "text-red-700" : "text-foreground")}>
          {action.title}
        </span>
        {!compact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {action.dueAt && <span>{action.dueAt}</span>}
            {action.assignedTo && <span>· {action.assignedTo}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
