import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Users,
  Mail,
  FileText,
  CalendarClock,
  Inbox as InboxIcon,
  type LucideIcon,
} from "lucide-react";

type IllustrationKey =
  | "inbox"
  | "contacts"
  | "email"
  | "documents"
  | "calendar"
  | "generic";

const ILLUSTRATIONS: Record<IllustrationKey, LucideIcon> = {
  inbox: Inbox,
  contacts: Users,
  email: Mail,
  documents: FileText,
  calendar: CalendarClock,
  generic: InboxIcon,
};

interface EmptyStateProps {
  illustration?: IllustrationKey;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    href?: string;
  };
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
}

/**
 * EmptyState reutilizável — pictográfica + acção (padrão E1).
 * Usado em listas vazias, primeiras visitas, áreas sem dados.
 * Não confundir com `src/components/customer360/ui/EmptyState.tsx` (minimalista).
 */
export function EmptyState({
  illustration = "generic",
  title,
  description,
  primaryAction,
  secondaryHref,
  secondaryLabel,
  className,
}: EmptyStateProps) {
  const Icon = ILLUSTRATIONS[illustration];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 md:p-12",
        className,
      )}
    >
      <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-16 w-16 md:h-20 md:w-20 text-muted-foreground/30" />
      </div>
      <h3 className="text-lg font-semibold mt-6 text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
          {description}
        </p>
      )}
      {primaryAction && (
        <div className="mt-6">
          {primaryAction.href ? (
            <a href={primaryAction.href}>
              <Button>{primaryAction.label}</Button>
            </a>
          ) : (
            <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          )}
        </div>
      )}
      {secondaryHref && secondaryLabel && (
        <a
          href={secondaryHref}
          className="mt-2 text-xs text-primary hover:underline"
        >
          {secondaryLabel}
        </a>
      )}
    </div>
  );
}
