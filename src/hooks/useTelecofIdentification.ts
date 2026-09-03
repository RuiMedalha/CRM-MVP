/**
 * useTelecofIdentification — enriches an incoming Telecof call with
 * contact/lead identification from the central identification service.
 * Returns rich data for the screen-pop banner and customer panel.
 */

import { useState, useEffect } from "react";
import { identifyByPhoneOrEmail, type IdentificationResult } from "@/services/contactIdentification";
import { directusRequest } from "@/integrations/directus/client";

export interface TelecofIdentification extends IdentificationResult {
  recentInteractions: { id: string; type: string; summary: string; date: string }[];
  pendingProposals: { id: number; number: string; amount: number; status: string }[];
  pendingProposalsCount: number;
  loading: boolean;
}

const EMPTY: TelecofIdentification = {
  kind: "unknown",
  record: null,
  matchedBy: null,
  interactionCount: 0,
  openDeals: 0,
  lastActivity: null,
  recentInteractions: [],
  pendingProposals: [],
  pendingProposalsCount: 0,
  loading: false,
};

export function useTelecofIdentification(phone: string | undefined): TelecofIdentification {
  const [result, setResult] = useState<TelecofIdentification>(EMPTY);

  useEffect(() => {
    if (!phone) {
      setResult(EMPTY);
      return;
    }

    let cancelled = false;
    setResult((prev) => ({ ...prev, loading: true }));

    (async () => {
      try {
        const identification = await identifyByPhoneOrEmail({ phone });
        if (cancelled) return;

        let recentInteractions: TelecofIdentification["recentInteractions"] = [];
        let pendingProposals: TelecofIdentification["pendingProposals"] = [];

        if (identification.kind === "contact" && identification.record) {
          const contactId = String(identification.record.id);

          // Fetch last 3 interactions
          try {
            const intRes = await directusRequest<{ data: Record<string, unknown>[] }>(
              `/items/interactions?filter[contact_id][_eq]=${contactId}&sort=-date_created&limit=3&fields=id,type,summary,date_created`
            );
            recentInteractions = (intRes.data || []).map((i) => ({
              id: String(i.id),
              type: String(i.type || "note"),
              summary: String(i.summary || ""),
              date: String(i.date_created || ""),
            }));
          } catch { /* ok */ }

          // Fetch pending proposals (list + count)
          let pendingProposalsCount = 0;
          try {
            const [propRes, propCount] = await Promise.all([
              directusRequest<{ data: Record<string, unknown>[] }>(
                `/items/quotations?filter[customer_id][_eq]=${contactId}&filter[status][_in]=draft,sent,viewed&limit=5&fields=id,quotation_number,total_amount,status`
              ),
              directusRequest<{ data: { count: { id: string } }[] }>(
                `/items/quotations?filter[customer_id][_eq]=${contactId}&filter[status][_in]=draft,sent,viewed&aggregate[count]=id`
              ).catch(() => ({ data: [{ count: { id: "0" } }] })),
            ]);
            pendingProposals = (propRes.data || []).map((p) => ({
              id: Number(p.id),
              number: String(p.quotation_number || ""),
              amount: Number(p.total_amount || 0),
              status: String(p.status || ""),
            }));
            pendingProposalsCount = Number(propCount.data?.[0]?.count?.id || 0);
          } catch { /* ok */ }
        }

        if (!cancelled) {
          setResult({
            ...identification,
            recentInteractions,
            pendingProposals,
            pendingProposalsCount,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setResult({ ...EMPTY, loading: false });
      }
    })();

    return () => { cancelled = true; };
  }, [phone]);

  return result;
}
