import { useEffect, useRef } from "react";
import { useActivityFeedStore } from "@/store/activityFeedStore";
import { useQuery } from "@tanstack/react-query";
import { fetchRecentLeads, fetchMissedLeads } from "@/integrations/directus/leads";
import { useDeals } from "@/hooks/useDeals";
import { directusRequest } from "@/integrations/directus/client";

export function useActivityFeedMonitor() {
  const { addActivity } = useActivityFeedStore();
  const lastLeadCountRef = useRef(0);
  const lastEmailCountRef = useRef(0);
  const lastDealCountRef = useRef(0);
  const seenProposalIdsRef = useRef<Set<string>>(new Set());

  // Monitor recent leads
  const leadsQuery = useQuery({
    queryKey: ["monitor-leads"],
    queryFn: () => fetchRecentLeads(100),
    refetchInterval: 30000,
  });

  // Monitor deals
  const { data: deals } = useDeals();

  // Monitor emails
  const emailQuery = useQuery({
    queryKey: ["monitor-emails"],
    queryFn: async () => {
      try {
        const result = await directusRequest<any>("/items/email_threads?limit=50&sort=-date_created");
        return result.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Monitor proposals
  const proposalQuery = useQuery({
    queryKey: ["monitor-proposals"],
    queryFn: async () => {
      try {
        const result = await directusRequest<any>("/items/quotations?limit=50&sort=-date_created&filter[status][_in]=sent,viewed");
        return result.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  // Check for new leads
  useEffect(() => {
    if (leadsQuery.data) {
      const currentCount = leadsQuery.data.length;
      if (currentCount > lastLeadCountRef.current && lastLeadCountRef.current > 0) {
        const newLeads = leadsQuery.data.slice(0, currentCount - lastLeadCountRef.current);
        newLeads.forEach((lead: any) => {
          addActivity({
            type: "lead",
            title: `Lead: ${lead.display_name || "Desconhecido"}`,
            description: lead.contact_phone || lead.email || "Sem contacto",
            timestamp: new Date(lead.date_created || new Date()),
            actionUrl: "/leads",
          });
        });
      }
      lastLeadCountRef.current = currentCount;
    }
  }, [leadsQuery.data]);

  // Check for new emails
  useEffect(() => {
    if (emailQuery.data) {
      const currentCount = emailQuery.data.length;
      if (currentCount > lastEmailCountRef.current && lastEmailCountRef.current > 0) {
        const newEmails = emailQuery.data.slice(0, currentCount - lastEmailCountRef.current);
        newEmails.forEach((email: any) => {
          addActivity({
            type: "email",
            title: `Email: ${email.subject || "Sem assunto"}`,
            description: email.from || "Desconhecido",
            timestamp: new Date(email.date_received || new Date()),
            actionUrl: "/email",
          });
        });
      }
      lastEmailCountRef.current = currentCount;
    }
  }, [emailQuery.data]);

  // Check for new deals
  useEffect(() => {
    if (deals) {
      const currentCount = deals.length;
      if (currentCount > lastDealCountRef.current && lastDealCountRef.current > 0) {
        const newDeals = deals.slice(0, currentCount - lastDealCountRef.current);
        newDeals.forEach((deal: any) => {
          const isWon = deal.status === "ganho";
          addActivity({
            type: "deal",
            title: isWon ? `🎉 Negócio ganho: ${deal.title}` : `Negócio: ${deal.title || "Sem título"}`,
            description: `Status: ${deal.status}`,
            timestamp: new Date(deal.date_created || new Date()),
            actionUrl: "/pipeline",
          });
        });
      }
      lastDealCountRef.current = currentCount;
    }
  }, [deals]);

  // Check for proposals viewed
  useEffect(() => {
    if (proposalQuery.data) {
      proposalQuery.data.forEach((proposal: any) => {
        if (proposal.status === "viewed" && !seenProposalIdsRef.current.has(proposal.id)) {
          seenProposalIdsRef.current.add(proposal.id);
          addActivity({
            type: "proposal",
            title: `Proposta visualizada: ${proposal.title || "Sem título"}`,
            timestamp: new Date(proposal.date_viewed || new Date()),
            actionUrl: "/propostas",
          });
        }
      });
    }
  }, [proposalQuery.data]);
}
