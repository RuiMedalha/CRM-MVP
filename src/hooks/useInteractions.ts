import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createInteraction, listInteractions, type InteractionRow } from "@/integrations/directus/interactions";

export function useInteractions(
  params?: Parameters<typeof listInteractions>[0],
  options?: { enabled?: boolean }
) {
  const isExplicitlyDisabled = options?.enabled === false;
  const isParamFiltered = params
    ? Boolean(params.contactId || params.email || params.phone || params.search || params.channel || params.type)
    : true;
  const shouldEnable = options?.enabled !== undefined ? options.enabled : (params === undefined || isParamFiltered);

  return useQuery({
    queryKey: ["interactions", params || {}],
    queryFn: async () => (shouldEnable ? await listInteractions(params) : []),
    enabled: shouldEnable,
    retry: false,
    throwOnError: false,
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<InteractionRow>) => await createInteraction(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions"] });
    },
  });
}

