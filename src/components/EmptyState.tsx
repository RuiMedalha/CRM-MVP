import * as React from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Card 17 redesign — EmptyState com SVG inline + texto contextual.
 * Cada ilustração embute um SVG vectorial único com tints brand,
 * garantindo coerência visual sem depender de ficheiros externos.
 */

type IllustrationKey =
  | "inbox"
  | "contacts"
  | "leads"
  | "email"
  | "documents"
  | "calendar"
  | "pipeline"
  | "proposals"
  | "search"
  | "conversations"
  | "generic";

interface IllustrationProps {
  className?: string;
}

const IllustrationInbox: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <defs>
      <linearGradient id="bg-inbox" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgb(99 102 241 / 0.18)" />
        <stop offset="100%" stopColor="rgb(99 102 241 / 0.02)" />
      </linearGradient>
    </defs>
    <rect x="20" y="30" width="160" height="110" rx="14" fill="url(#bg-inbox)" />
    <path d="M20 90 L60 90 L72 110 L128 110 L140 90 L180 90" stroke="rgb(79 70 229)" strokeWidth="2" fill="none" strokeLinejoin="round" />
    <rect x="40" y="50" width="120" height="6" rx="3" fill="rgb(99 102 241 / 0.35)" />
    <rect x="40" y="62" width="80" height="6" rx="3" fill="rgb(99 102 241 / 0.20)" />
    <circle cx="155" cy="40" r="14" fill="white" stroke="rgb(244 63 94)" strokeWidth="2" />
    <path d="M155 34 V46 M148 40 H162" stroke="rgb(244 63 94)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const IllustrationContacts: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="20" y="30" width="160" height="110" rx="14" fill="rgb(99 102 241 / 0.10)" />
    <circle cx="80" cy="80" r="22" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <path d="M58 110 Q58 96 80 96 Q102 96 102 110" stroke="rgb(79 70 229)" strokeWidth="2" fill="none" />
    <circle cx="128" cy="74" r="18" fill="white" stroke="rgb(99 102 241)" strokeWidth="2" />
    <path d="M110 102 Q110 90 128 90 Q146 90 146 102" stroke="rgb(99 102 241)" strokeWidth="2" fill="none" />
    <rect x="38" y="118" width="124" height="6" rx="3" fill="rgb(99 102 241 / 0.25)" />
  </svg>
);

const IllustrationLeads: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <defs>
      <linearGradient id="bg-leads" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgb(16 185 129 / 0.20)" />
        <stop offset="100%" stopColor="rgb(16 185 129 / 0.02)" />
      </linearGradient>
    </defs>
    <rect x="20" y="30" width="160" height="110" rx="14" fill="url(#bg-leads)" />
    <path d="M100 50 L100 110 M70 80 L130 80" stroke="rgb(5 150 105)" strokeWidth="3" strokeLinecap="round" />
    <circle cx="100" cy="80" r="28" fill="white" stroke="rgb(16 185 129)" strokeWidth="2.5" />
    <path d="M90 80 L97 88 L112 70" stroke="rgb(16 185 129)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const IllustrationEmail: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="20" y="40" width="160" height="100" rx="12" fill="rgb(99 102 241 / 0.10)" />
    <rect x="36" y="56" width="128" height="68" rx="6" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <path d="M36 56 L100 100 L164 56" stroke="rgb(79 70 229)" strokeWidth="2" fill="none" />
    <rect x="46" y="76" width="60" height="4" rx="2" fill="rgb(99 102 241 / 0.30)" />
    <rect x="46" y="86" width="40" height="4" rx="2" fill="rgb(99 102 241 / 0.20)" />
  </svg>
);

const IllustrationDocuments: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="60" y="34" width="80" height="110" rx="6" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <path d="M132 34 L132 56 L154 56" fill="rgb(99 102 241 / 0.20)" stroke="rgb(79 70 229)" strokeWidth="2" />
    <rect x="70" y="70" width="60" height="4" rx="2" fill="rgb(99 102 241 / 0.35)" />
    <rect x="70" y="80" width="50" height="4" rx="2" fill="rgb(99 102 241 / 0.25)" />
    <rect x="70" y="90" width="55" height="4" rx="2" fill="rgb(99 102 241 / 0.20)" />
    <rect x="70" y="110" width="30" height="14" rx="4" fill="rgb(16 185 129)" />
    <path d="M76 117 L80 121 L86 113" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>
);

const IllustrationCalendar: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="30" y="42" width="140" height="100" rx="10" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <rect x="30" y="42" width="140" height="22" rx="10" fill="rgb(79 70 229)" />
    <path d="M60 30 V52 M140 30 V52" stroke="rgb(79 70 229)" strokeWidth="3" strokeLinecap="round" />
    <g fill="rgb(99 102 241 / 0.30)">
      <circle cx="55" cy="80" r="3" /><circle cx="80" cy="80" r="3" />
      <circle cx="105" cy="80" r="3" /><circle cx="130" cy="80" r="3" />
      <circle cx="155" cy="80" r="3" />
      <circle cx="55" cy="100" r="3" /><circle cx="80" cy="100" r="3" />
      <circle cx="130" cy="100" r="3" /><circle cx="155" cy="100" r="3" />
      <circle cx="55" cy="120" r="3" /><circle cx="80" cy="120" r="3" />
      <circle cx="105" cy="120" r="3" />
    </g>
    <circle cx="105" cy="100" r="8" fill="rgb(16 185 129)" />
    <path d="M101 100 L104 103 L110 97" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IllustrationPipeline: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="20" y="30" width="40" height="110" rx="8" fill="rgb(99 102 241 / 0.20)" />
    <rect x="68" y="30" width="40" height="110" rx="8" fill="rgb(99 102 241 / 0.30)" />
    <rect x="116" y="30" width="40" height="110" rx="8" fill="rgb(99 102 241 / 0.40)" />
    <rect x="164" y="30" width="20" height="110" rx="8" fill="rgb(99 102 241 / 0.10)" />
    <rect x="28" y="44" width="24" height="14" rx="3" fill="white" />
    <rect x="28" y="64" width="24" height="14" rx="3" fill="white" />
    <rect x="76" y="50" width="24" height="14" rx="3" fill="white" />
    <rect x="76" y="70" width="24" height="14" rx="3" fill="white" />
    <rect x="124" y="56" width="24" height="14" rx="3" fill="white" />
    <path d="M148 70 Q160 70 164 76 L164 110 Q164 116 158 116" stroke="rgb(79 70 229)" strokeWidth="2" fill="none" strokeDasharray="3 4" />
  </svg>
);

const IllustrationProposals: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="30" y="40" width="100" height="110" rx="8" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <rect x="50" y="20" width="100" height="110" rx="8" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <rect x="60" y="36" width="80" height="6" rx="3" fill="rgb(79 70 229)" />
    <rect x="60" y="50" width="60" height="4" rx="2" fill="rgb(99 102 241 / 0.30)" />
    <rect x="60" y="60" width="70" height="4" rx="2" fill="rgb(99 102 241 / 0.30)" />
    <rect x="60" y="70" width="50" height="4" rx="2" fill="rgb(99 102 241 / 0.30)" />
    <rect x="60" y="90" width="80" height="20" rx="4" fill="rgb(16 185 129)" />
    <path d="M68 100 L74 106 L86 92" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IllustrationSearch: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <circle cx="84" cy="76" r="32" fill="white" stroke="rgb(79 70 229)" strokeWidth="3" />
    <path d="M108 100 L140 132" stroke="rgb(79 70 229)" strokeWidth="4" strokeLinecap="round" />
    <circle cx="84" cy="76" r="14" stroke="rgb(99 102 241 / 0.50)" strokeWidth="2" fill="none" />
  </svg>
);

const IllustrationConversations: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <rect x="30" y="40" width="120" height="36" rx="14" fill="rgb(99 102 241 / 0.18)" />
    <rect x="50" y="82" width="120" height="36" rx="14" fill="rgb(16 185 129 / 0.20)" />
    <circle cx="22" cy="58" r="12" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <circle cx="178" cy="100" r="12" fill="white" stroke="rgb(5 150 105)" strokeWidth="2" />
  </svg>
);

const IllustrationGeneric: React.FC<IllustrationProps> = ({ className }) => (
  <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden>
    <circle cx="100" cy="80" r="44" fill="rgb(99 102 241 / 0.10)" />
    <circle cx="100" cy="80" r="28" fill="white" stroke="rgb(79 70 229)" strokeWidth="2" />
    <path d="M88 80 L97 89 L114 70" stroke="rgb(79 70 229)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <g fill="rgb(99 102 241 / 0.30)">
      <circle cx="40" cy="60" r="3" /><circle cx="170" cy="50" r="4" />
      <circle cx="50" cy="120" r="3" /><circle cx="160" cy="130" r="3" />
    </g>
  </svg>
);

const ILLUSTRATIONS: Record<IllustrationKey, React.FC<IllustrationProps>> = {
  inbox: IllustrationInbox,
  contacts: IllustrationContacts,
  leads: IllustrationLeads,
  email: IllustrationEmail,
  documents: IllustrationDocuments,
  calendar: IllustrationCalendar,
  pipeline: IllustrationPipeline,
  proposals: IllustrationProposals,
  search: IllustrationSearch,
  conversations: IllustrationConversations,
  generic: IllustrationGeneric,
};

interface EmptyStateProps {
  illustration?: IllustrationKey;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

/**
 * EmptyState reutilizável — Card 17.
 * SVG inline (vector) com tint brand; aceita acção primária + secundária.
 */
export function EmptyState({
  illustration = "generic",
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const Illustration = ILLUSTRATIONS[illustration];
  const PrimaryIcon = primaryAction?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-10 md:py-14 px-6",
        className,
      )}
    >
      <div className="w-full max-w-[240px] mb-6">
        <Illustration className="w-full h-auto" />
      </div>
      <h3 className="text-lg font-semibold text-foreground leading-snug">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-normal">
          {description}
        </p>
      ) : null}
      {primaryAction ? (
        <div className="mt-6">
          {primaryAction.href ? (
            <Button asChild>
              <Link to={primaryAction.href}>
                {PrimaryIcon ? <PrimaryIcon className="h-4 w-4" /> : null}
                {primaryAction.label}
              </Link>
            </Button>
          ) : (
            <Button onClick={primaryAction.onClick}>
              {PrimaryIcon ? <PrimaryIcon className="h-4 w-4" /> : null}
              {primaryAction.label}
            </Button>
          )}
        </div>
      ) : null}
      {secondaryAction ? (
        <div className="mt-3">
          {secondaryAction.href ? (
            <Link
              to={secondaryAction.href}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              {secondaryAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
