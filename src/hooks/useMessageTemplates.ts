import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAllMessageTemplates,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  type MessageTemplate,
} from "@/integrations/directus/messageTemplates";

export type { MessageTemplate };

export function useMessageTemplates() {
  return useQuery({
    queryKey: ["message-templates"],
    queryFn: listAllMessageTemplates,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createMessageTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<MessageTemplate> & { id: string }) =>
      updateMessageTemplate(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteMessageTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-templates"] }),
  });
}
