import { useMemo } from "react";
import { useConversationStore } from "@/store/conversationStore";
import { useTelecofCallStore } from "@/store/telecofCallStore";
import { resolveConversationWhatsAppInstance } from "@/lib/whatsappConversation";

export interface ChannelBadgeCounts {
  whatsapp: number;
  wa918: number;
  waha: number;
  wa913: number;
  telecof: number;
  askme: number;
  grupos: number;
}

export function useChannelBadgeCounts(): ChannelBadgeCounts {
  const conversations = useConversationStore((s) => s.conversations);
  const groupConversations = useConversationStore((s) => s.groupConversations);
  const telecofEvents = useTelecofCallStore((s) => s.events);

  return useMemo(() => {
    const counts: ChannelBadgeCounts = {
      whatsapp: 0,
      wa918: 0,
      waha: 0,
      wa913: 0,
      telecof: 0,
      askme: 0,
      grupos: 0,
    };

    // Telecof open calls count
    counts.telecof = telecofEvents.filter(
      (e) => e.operationalStatus === "new" || e.operationalStatus === "unhandled",
    ).length;

    // Grupos unread count
    counts.grupos = groupConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

    // Individual conversations unread count
    for (const c of conversations) {
      const u = c.unreadCount || 0;
      if (u <= 0) continue;

      const ch = String(c.channel || "").toLowerCase();

      if (ch === "askme") {
        counts.askme += u;
      } else if (ch.startsWith("wa") || ch === "whatsapp" || ch === "whatsapp_meta" || ch === "waha") {
        counts.whatsapp += u;
        const inst = resolveConversationWhatsAppInstance(c);
        if (inst === "918") {
          counts.wa918 += u;
        } else if (inst === "916") {
          counts.waha += u;
        } else if (inst === "913") {
          counts.wa913 += u;
        }
      }
    }

    return counts;
  }, [conversations, groupConversations, telecofEvents]);
}
