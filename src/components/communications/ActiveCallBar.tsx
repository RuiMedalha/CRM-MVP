import { useNavigate } from "react-router-dom";
import { Phone, X, User, MessageCircle, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveCallStore } from "@/store/activeCallContext";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findContactByPhone } from "@/integrations/directus/contactLookup";

export function ActiveCallBar() {
  const navigate = useNavigate();
  const { context, clear } = useActiveCallStore();
  const [elapsed, setElapsed] = useState(0);
  const { data: phoneContactId } = useQuery({
    queryKey: ["active-call-contact-by-phone", context?.phone],
    queryFn: () => findContactByPhone(context!.phone),
    enabled: Boolean(context?.phone && !context.contactId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!context) return;
    const start = new Date(context.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [context?.startedAt]);

  if (!context) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const contactId = context.contactId ?? phoneContactId;
  const customerUrl = contactId
    ? `/customer360-shell/${encodeURIComponent(contactId)}`
    : `/customer360-shell/novo?phone=${encodeURIComponent(context.phone)}&name=${encodeURIComponent(context.name)}`;

  return (
    <div className="crm-active-call-bar flex items-center gap-3 border-b border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <Phone className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 truncate">
          {context.name}
        </span>
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {context.phone}
        </span>
        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
          {timeStr}
        </span>
      </div>

      {/* Quick actions */}
      <div className="crm-active-call-actions flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
          onClick={() => navigate(customerUrl)}
        >
          <User className="h-3 w-3" />
          {contactId ? "Ficha" : "Criar contacto"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
          onClick={() => navigate(`/comunicacoes?phone=${encodeURIComponent(context.phone)}`)}
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
          onClick={() => navigate(`/propostas/nova?customer_id=${context.contactId || ""}&notes=Chamada de ${context.name}`)}
        >
          <FileText className="h-3 w-3" />
          Proposta
        </Button>
      </div>

      {/* Dismiss */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-emerald-600 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900"
        onClick={clear}
        title="Terminar contexto"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
