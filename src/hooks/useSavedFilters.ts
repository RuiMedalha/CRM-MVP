import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
  type SavedFilterInsert,
} from "@/integrations/directus/saved-filters";

export function useSavedFilters(page: "contacts" | "pipeline") {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["saved-filters", page],
    queryFn: () => listSavedFilters(page),
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: (payload: SavedFilterInsert) => createSavedFilter(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters", page] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedFilter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters", page] });
    },
  });

  return {
    filters: query.data ?? [],
    isLoading: query.isLoading,
    save: createMutation.mutateAsync,
    isSaving: createMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
  };
}
