import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuditedMutation } from "@/hooks/useAudit";
import {
  createDeal,
  createDealItem,
  deleteDealItem,
  getDealById,
  listDealItems,
  listDeals,
  patchDeal,
  type DealItemRow,
  type DealRow,
} from "@/integrations/directus/deals";
import { auditMutation } from "@/integrations/directus/audit";
import { useAuth } from "@/contexts/AuthContext";

export type Deal = DealRow & {
  customer?: { id: string; company_name?: string | null } | null;
  manufacturer?: { id: string; name?: string | null } | null;
  customer_id?: string | null;
  manufacturer_id?: string | null;
  items?: DealItemRow[];
};

export type DealInsert = Partial<Deal>;
export type DealUpdate = Partial<Deal>;

export type DealItem = DealItemRow;
export type DealItemInsert = Partial<DealItemRow>;

export const DEAL_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "qualificacao", label: "Qualificação" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
] as const;

export function useDeals() {
  return useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const rows = await listDeals({ limit: 500, page: 1 });
      return rows.map((d: any) => {
        const customerObj = d.customer_id && typeof d.customer_id === "object" ? d.customer_id : null;
        const manufacturerObj = d.manufacturer_id && typeof d.manufacturer_id === "object" ? d.manufacturer_id : null;
        return {
          ...d,
          total_amount: Number(d.total_amount || 0),
          customer: customerObj,
          manufacturer: manufacturerObj,
          customer_id: customerObj?.id ?? (typeof d.customer_id === "string" ? d.customer_id : null),
          manufacturer_id: manufacturerObj?.id ?? (typeof d.manufacturer_id === "string" ? d.manufacturer_id : null),
        } as Deal;
      });
    },
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      if (!id) return null;
      const base = await getDealById(id);
      if (!base) return null;
      const items = await listDealItems(id).catch(() => []);
      const customerObj = (base as any).customer_id && typeof (base as any).customer_id === "object" ? (base as any).customer_id : null;
      const manufacturerObj =
        (base as any).manufacturer_id && typeof (base as any).manufacturer_id === "object"
          ? (base as any).manufacturer_id
          : null;

      return {
        ...(base as any),
        items,
        total_amount: Number((base as any)?.total_amount || 0),
        customer: customerObj,
        manufacturer: manufacturerObj,
        customer_id: customerObj?.id ?? (typeof (base as any).customer_id === "string" ? (base as any).customer_id : null),
        manufacturer_id:
          manufacturerObj?.id ??
          (typeof (base as any).manufacturer_id === "string" ? (base as any).manufacturer_id : null),
      } as Deal;
    },
    enabled: !!id,
  });
}

export function useCreateDeal() {
  return useAuditedMutation({
    collection: "deals",
    action: "create",
    invalidateKeys: [["deals"]],
    mutationFn: async (deal: DealInsert) => {
      const { customer, manufacturer, items, ...payload } = deal as any;
      const result = await createDeal(payload);
      return result as any;
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...deal }: DealUpdate & { id: string }) => {
      const { customer, manufacturer, items, ...patch } = deal as any;
      const before = await getDealById(id).catch(() => null);
      const result = await patchDeal(id, patch);
      auditMutation("deals", "update", before, result, { user_id: user?.id ?? undefined, user_email: user?.email ?? undefined }).catch(() => {});
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal", data.id] });
    },
  });
}

export function useAddDealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: DealItemInsert) => {
      return await createDealItem(item);
    },
    onSuccess: (data) => {
      if (data?.deal_id) queryClient.invalidateQueries({ queryKey: ["deal", data.deal_id] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}

export function useRemoveDealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      await deleteDealItem(id);
      return dealId;
    },
    onSuccess: (dealId) => {
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });
}
