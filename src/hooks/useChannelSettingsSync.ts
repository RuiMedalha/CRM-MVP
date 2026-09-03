/**
 * useChannelSettingsSync — loads channel settings from Directus integrations
 * collection and syncs them into the in-memory channelRegistry.
 * Should be called once near the top of the app (App.tsx or a provider).
 */

import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { setChannelSettingsRegistry } from "@/lib/channelRegistry";
import type { ChannelSettings } from "@/types/communication";

interface IntegrationRow {
  id: number;
  key: string;
  label: string;
  provider: string;
  color: string;
  icon: string;
  badge_label: string;
  priority: number;
  notify: boolean;
  inbox_visible: boolean;
  sort: number;
  active: boolean;
}

function mapIntegrationToChannelSettings(row: IntegrationRow): ChannelSettings {
  return {
    id: row.key,
    key: row.key,
    name: row.label || row.key,
    provider: row.provider as ChannelSettings["provider"],
    enabled: row.active,
    color: row.color || "#64748b",
    icon: row.icon || "message-circle",
    badgeLabel: row.badge_label || undefined,
    priority: row.priority ?? 99,
    notify: row.notify ?? false,
    inboxVisible: row.inbox_visible ?? true,
    sortOrder: row.sort ?? 99,
    autoTags: [],
  };
}

export function useChannelSettingsSync(): void {
  useQuery({
    queryKey: ["channel-settings-sync"],
    queryFn: async () => {
      const res = await directusRequest<{ data: IntegrationRow[] }>(
        "/items/integrations?filter[active][_eq]=true&limit=-1&sort=sort&fields=id,key,label,provider,color,icon,badge_label,priority,notify,inbox_visible,sort,active"
      );
      const rows = res?.data ?? [];
      if (rows.length > 0) {
        const settings = rows.map(mapIntegrationToChannelSettings);
        setChannelSettingsRegistry(settings);
      }
      return rows;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
