import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneIncoming, User, Briefcase, FileText, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { patchCommunicationEvent } from "@/integrations/directus/communicationEvents";
import { useIncomingTelecofCall } from "@/hooks/useTelecofCallsPolling";
import { useTelecofIdentification } from "@/hooks/useTelecofIdentification";
import { buildContactCreationUrl } from "@/lib/buildContactCreationUrl";
import { useActiveCallStore } from "@/store/activeCallContext";
import {
  WAVOIP_INCOMING_EVENT,
  type WavoipIncomingDetail,
} from "@/components/communications/WavoipWebphone";

// TODO 3CX: configurar webhook no 3CX Admin
// 3CX → n8n.hotelequip.pt/webhook/3cx-call-event
// n8n cria communication_event com channel="3cx" (event_type=call_inbound,
// phone=chamador, direction=inbound, status=new, agent_name=extensão 1371x)
// O banner já está preparado para receber (poll listNewIncomingCalls).

const AUTO_DISMISS_SECONDS = 45;

/** Origem do gatilho: poll Directus (patchable), Wavoip live (CustomEvent) ou simulação DEV. */
type BannerOrigin = "poll" | "wavoip-live" | "sim";

/** Chamada apresentada no banner. `channel` controla o label; `origin` controla o patch. */
type BannerCall = {
  id: string;
  phone: string;
  customerName?: string;
  company?: string;
  /** telecof | 3cx | wavoip */
  channel: string;
  agentName?: string;
  origin: BannerOrigin;
};

const MOCK_CALL: BannerCall = {
  id: "mock-telecof-1",
  phone: "+351 912 345 678",
  customerName: "Maria Santos",
  company: "Hotel Atlântico",
  channel: "telecof",
  origin: "sim",
};

export function TelecofBanner() {
  const navigate = useNavigate();
  const { incomingCall } = useIncomingTelecofCall();

  const [simulated, setSimulated] = useState<BannerCall | null>(null);
  const [wavoipCall, setWavoipCall] = useState<BannerCall | null>(null);
  const [handledIds, setHandledIds] = useState<Set<string>>(() => new Set());
  const [timeLeft, setTimeLeft] = useState(AUTO_DISMISS_SECONDS);
  const timerRef = useRef<number | null>(null);

  // Chamada Wavoip live (CustomEvent emitido por WavoipWebphone no offer:received).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onIncoming = (e: Event) => {
      const detail = (e as CustomEvent<WavoipIncomingDetail>).detail;
      const phone = detail?.phone?.trim();
      if (!phone) return;
      setWavoipCall({
        id: `wavoip-${Date.now()}`,
        phone,
        customerName: detail?.customerName,
        channel: "wavoip",
        origin: "wavoip-live",
      });
    };
    window.addEventListener(WAVOIP_INCOMING_EVENT, onIncoming);
    return () => window.removeEventListener(WAVOIP_INCOMING_EVENT, onIncoming);
  }, []);

  // Chamada real (não tratada) — telecof/3cx/wavoip via poll do Directus.
  const pollCall: BannerCall | null =
    incomingCall && !handledIds.has(incomingCall.id)
      ? {
          id: incomingCall.id,
          phone: incomingCall.phone,
          customerName: incomingCall.customer_name,
          company: undefined,
          channel: incomingCall.channel,
          agentName: incomingCall.agent_name,
          origin: "poll",
        }
      : null;

  // Prioridade: Wavoip (live) > poll Directus > simulação DEV.
  const call: BannerCall | null = wavoipCall ?? pollCall ?? simulated;

  // Enrich with contact identification
  const identification = useTelecofIdentification(call?.phone);

  const markHandled = (id: string) =>
    setHandledIds((prev) => new Set(prev).add(id));

  // Padrão de timer do LeadPopup360 (countdown + auto-dismiss aos 45s).
  useEffect(() => {
    if (!call) return;
    const active = call;
    setTimeLeft(AUTO_DISMISS_SECONDS);
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          if (active.origin === "poll") {
            void patchCommunicationEvent(active.id, { status: "missed" });
            markHandled(active.id);
          }
          setWavoipCall(null);
          setSimulated(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearActive = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setWavoipCall(null);
    setSimulated(null);
  };

  const answer = () => {
    if (!call) return;
    if (call.origin === "poll") {
      void patchCommunicationEvent(call.id, { status: "in_progress" });
      markHandled(call.id);
    }
    // Set persistent context bar
    const identName = (identification.kind === "contact" && identification.record)
      ? String(identification.record.company_name || identification.record.contact_name || "")
      : call.customerName || "";
    useActiveCallStore.getState().setContext({
      phone: call.phone,
      name: identName || call.phone,
      contactId: identification.kind === "contact" ? String(identification.record?.id || "") : undefined,
      startedAt: new Date().toISOString(),
      channel: call.channel,
    });
    clearActive();
    // Navigate to Customer360 — by ID if identified, or new with phone prefill
    if (identification.kind === "contact" && identification.record?.id) {
      navigate(`/customer360-shell/${identification.record.id}`);
    } else {
      const params = buildContactCreationUrl({
        contact_phone: call.phone,
        display_name: call.customerName || undefined,
        source: "telecof_call",
      });
      navigate(`/customer360-shell/novo?${params.toString()}`);
    }
  };

  const reject = () => {
    if (!call) return;
    if (call.origin === "poll") {
      void patchCommunicationEvent(call.id, { status: "treated" });
      markHandled(call.id);
    }
    clearActive();
  };

  // Sem chamada: em DEV mostra o gatilho de simulação; em produção não renderiza.
  if (!call) {
    if (!import.meta.env.DEV) return null;
    return (
      <div className="crm-telecof-banner crm-telecof-banner--sim flex justify-center border-b border-dashed border-amber-200 bg-amber-50/40 px-4 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-2 text-xs text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          onClick={() => setSimulated(MOCK_CALL)}
        >
          <PhoneIncoming className="h-3.5 w-3.5" />
          Simular chamada Telecof
        </Button>
      </div>
    );
  }

  const identifiedName = identification.kind === "contact" && identification.record
    ? String(identification.record.company_name || identification.record.contact_name || "")
    : undefined;
  const name = identifiedName || call.customerName || "Número desconhecido";
  const elapsed = AUTO_DISMISS_SECONDS - timeLeft;
  const sourceLabel =
    call.channel === "3cx"
      ? `3CX${call.agentName ? ` · Ext. ${call.agentName}` : ""}`
      : call.channel === "wavoip"
        ? "Wavoip"
        : "Telecof";
  const identifiedCity = identification.kind === "contact" && identification.record
    ? String(identification.record.city || identification.record.district || "")
    : "";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "crm-telecof-banner",
        "flex w-full items-center gap-3 border-b border-amber-200 px-4 py-2.5",
        "bg-[#fef3c7]",
      )}
    >
      {/* Ponto pulsante vermelho */}
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
      </span>

      {/* Ícone telefone laranja */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning text-white">
        <Phone className="h-4 w-4" />
      </span>

      {/* Texto: número + nome + contexto rico + "a tocar Xs" */}
      <div className="crm-telecof-banner-details min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
          Chamada {sourceLabel} a entrar
        </p>
        <p className="truncate text-sm text-amber-950">
          <span className="font-semibold">{call.phone}</span>
          <span className="mx-1.5 text-amber-500">·</span>
          <span className="font-medium">{name}</span>
          {identifiedCity ? (
            <>
              <span className="mx-1.5 text-amber-500">·</span>
              <span className="text-amber-800">{identifiedCity}</span>
            </>
          ) : null}
          <span className="mx-1.5 text-amber-500">·</span>
          <span className="text-amber-700">a tocar {elapsed}s</span>
        </p>
        {/* Enrichment badges */}
        {identification.kind === "contact" && !identification.loading && (
          <div className="crm-telecof-banner-badges flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800">
              <User className="h-2.5 w-2.5 mr-0.5" /> Cliente
            </Badge>
            {identification.openDeals > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                <Briefcase className="h-2.5 w-2.5 mr-0.5" /> {identification.openDeals} negócio{identification.openDeals > 1 ? "s" : ""}
              </Badge>
            )}
            {identification.pendingProposalsCount > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">
                <FileText className="h-2.5 w-2.5 mr-0.5" /> {identification.pendingProposalsCount} proposta{identification.pendingProposalsCount > 1 ? "s" : ""}
              </Badge>
            )}
            {identification.interactionCount > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-muted text-muted-foreground border-border">
                <Clock className="h-2.5 w-2.5 mr-0.5" /> {identification.interactionCount} interacção{identification.interactionCount > 1 ? "ões" : ""}
              </Badge>
            )}
          </div>
        )}
        {identification.kind === "lead" && !identification.loading && (
          <div className="crm-telecof-banner-badges flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200">
              Lead existente
            </Badge>
          </div>
        )}
        {identification.kind === "unknown" && !identification.loading && (
          <div className="crm-telecof-banner-badges flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-destructive/20">
              Novo — não identificado
            </Badge>
          </div>
        )}
      </div>

      {/* Countdown visível */}
      <span className="crm-telecof-banner-countdown shrink-0 text-xs font-medium tabular-nums text-amber-700">
        auto-dismiss {timeLeft}s
      </span>

      {/* Ações */}
      <div className="crm-telecof-banner-actions flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          aria-label="Atender chamada e abrir ficha"
          className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          onClick={answer}
        >
          <Phone className="h-4 w-4" />
          <span className="crm-telecof-banner-action-label">Atender + ficha</span>
        </Button>
        <Button type="button" size="sm" variant="destructive" aria-label="Rejeitar chamada" className="h-9" onClick={reject}>
          <span className="crm-telecof-banner-action-label">Rejeitar</span>
        </Button>
      </div>
    </div>
  );
}

export default TelecofBanner;
