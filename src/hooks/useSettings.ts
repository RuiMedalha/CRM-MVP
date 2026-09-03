import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCompanySettings,
  upsertCompanySettings,
  type CompanySettingsItem,
  type WebhookSettings,
  getWebhookSettings,
  saveWebhookSettings,
} from "@/integrations/directus/settings";

export type CompanySettings = CompanySettingsItem;

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      return await getCompanySettings();
    },
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<CompanySettingsItem>) => {
      return await upsertCompanySettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    },
  });
}

// Meilisearch settings now come from env vars directly:
// VITE_MEILISEARCH_URL, VITE_MEILISEARCH_SEARCH_KEY, VITE_MEILISEARCH_INDEX

export { getWebhookSettings, saveWebhookSettings, type WebhookSettings };

export { getMeilisearchSettings, saveMeilisearchSettings, type MeilisearchSettings } from '@/hooks/useMeilisearch';
