import { useMemo } from "react";
import { Globe, MessageCircle, Phone, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChannelBadgeCounts } from "@/hooks/useChannelBadgeCounts";

export type ComunicacoesChannelId =
  | "whatsapp"
  | "wa918"
  | "waha"
  | "wa913"
  | "telecof"
  | "askme"
  | "grupos";

const CHANNELS: Array<{
  id: ComunicacoesChannelId;
  label: string;
  description: string;
  icon: typeof MessageCircle;
  /** Cor do ponto de destaque (ex.: WA·916 via WAHA). */
  dotClass?: string;
}> = [
  { id: "whatsapp", label: "WhatsApp", description: "Todos os números unificados", icon: MessageCircle },
  { id: "wa918", label: "WA·918", description: "WhatsApp 918 346 615 (Evolution)", icon: MessageCircle, dotClass: "bg-emerald-500" },
  { id: "waha", label: "WA·916", description: "WhatsApp 916 542 271 (Evolution)", icon: MessageCircle, dotClass: "bg-amber-500" },
  { id: "wa913", label: "WA·913", description: "WhatsApp 913 866 565 (WABA)", icon: MessageCircle, dotClass: "bg-primary" },
  { id: "telecof", label: "Telecof", description: "Central telefónica", icon: Phone },
  { id: "askme", label: "Chat do site", description: "Mensagens do website", icon: Globe },
  { id: "grupos", label: "Grupos", description: "Grupos WhatsApp", icon: Users },
];

type Props = {
  contactId?: string;
  activeChannel?: ComunicacoesChannelId;
  onChannelChange?: (channel: ComunicacoesChannelId) => void;
  className?: string;
  layout?: "sidebar" | "horizontal";
};

export function ComunicacoesChannelsSidebar({
  activeChannel = "whatsapp",
  onChannelChange,
  className,
  layout = "sidebar",
}: Props) {
  const isHorizontal = layout === "horizontal";
  const channelUnreadCounts = useChannelBadgeCounts();

  return (
    <aside
      className={cn(
        "crm-channel-tabs-bar flex shrink-0 flex-col border-border bg-muted/20",
        isHorizontal
          ? "flex-row flex-wrap gap-2 border-b p-2"
          : "w-56 border-r",
        className,
      )}
    >
      {!isHorizontal ? (
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Canais / Inbox
          </p>
        </div>
      ) : null}

      <nav
        className={cn(
          "flex gap-1",
          isHorizontal ? "flex-row flex-wrap" : "flex-1 flex-col p-2",
        )}
        aria-label="Canais de comunicação"
      >
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const active = activeChannel === ch.id;
          const unread = channelUnreadCounts[ch.id] || 0;
          return (
            <Button
              key={ch.id}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size={isHorizontal ? "sm" : "default"}
              className={cn(
                isHorizontal ? "h-8" : "h-auto w-full justify-between py-2.5 px-3",
              )}
              onClick={() => onChannelChange?.(ch.id)}
              title={ch.description}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4" />
                  {ch.dotClass ? (
                    <span
                      className={cn(
                        "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-background",
                        ch.dotClass,
                      )}
                    />
                  ) : null}
                </span>
                <span className={cn(isHorizontal ? "" : "flex flex-col items-start text-left truncate")}>
                  <span className="text-sm font-medium">{ch.label}</span>
                  {!isHorizontal ? (
                    <span className="text-xs font-normal text-muted-foreground truncate">{ch.description}</span>
                  ) : null}
                </span>
              </div>
              {unread > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}
