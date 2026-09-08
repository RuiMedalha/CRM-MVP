import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Mail,
  MessageSquareText,
  Phone,
  SendHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { aiRouter } from "@/services/ai/router";
import {
  findStoredConversation,
  useConversationStore,
} from "@/store/conversationStore";
import { useMessageStore } from "@/store/messageStore";
import { useTelecofCallStore } from "@/store/telecofCallStore";
import { HubConversationView } from "@/components/communications/HubConversationView";
import { ConversationTags } from "@/components/communications/ConversationTags";
import { MessageInput } from "@/components/communications/MessageInput";
import { ChannelToggle, type ReplyChannelKey } from "./ChannelToggle";
import { AiSuggestPopover, type AiSuggestionOption } from "./AiSuggestPopover";
import type { UnifiedInboxItem } from "./types";

export interface UnifiedConversationFeedProps {
  item: UnifiedInboxItem | null;
  className?: string;
}

export function UnifiedConversationFeed({
  item,
  className,
}: UnifiedConversationFeedProps) {
  const navigate = useNavigate();
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const upsertMessage = useMessageStore((s) => s.upsertMessage);
  const allConversations = useConversationStore((s) => s.conversations);
  const callEvents = useTelecofCallStore((s) => s.events);

  const [replyChannel, setReplyChannel] = useState<ReplyChannelKey>("whatsapp_916");
  const [suggesting, setSuggesting] = useState(false);

  // Auto-select the WhatsApp conversation so legacy HubConversationView
  // (MessageList + MessageInput) re-uses the same store-driven flow.
  useEffect(() => {
    if (!item) {
      selectConversation(undefined);
      return;
    }
    if (item.channel === "whatsapp") {
      const rawId = item.id.replace(/^wa-/, "");
      if (rawId) selectConversation(rawId);
    }
  }, [item, selectConversation]);

  if (!item) {
    return (
      <div
        className={`flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/20 px-6 text-center ${className ?? ""}`}
      >
        <MessageSquareText className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">
          Selecione uma conversa
        </p>
        <p className="text-sm text-muted-foreground/70">
          Escolha um item da coluna à esquerda para ver o histórico completo.
        </p>
      </div>
    );
  }

  // ─── WhatsApp: re-use HubConversationView (already wraps MessageList + ChatHeader)
  if (item.channel === "whatsapp") {
    const waId = item.id.replace(/^wa-/, "");
    const conversation = findStoredConversation(
      { conversations: allConversations } as any,
      waId,
    );
    const handleSuggest = async (opt: AiSuggestionOption, customerName: string) => {
      setSuggesting(true);
      try {
        const res = await aiRouter.completeWithFallback(
          `${opt.prompt}\n\nCliente: ${customerName}\nÚltima mensagem: ${item?.subtitle ?? ""}`,
          { maxTokens: 220, temperature: 0.4 },
        );
        if (res.text) {
          try {
            await navigator.clipboard.writeText(res.text.trim());
            toast({
              title: "✨ Sugestão copiada",
              description: `Resposta ${opt.kind} (${res.providerLabel}) copiada para a área de transferência.`,
            });
          } catch {
            toast({
              title: "✨ Sugestão pronta",
              description: res.text.trim(),
            });
          }
          upsertMessage({
            id: `ai-suggest-${Date.now()}`,
            conversationId: waId,
            content: res.text.trim(),
            senderType: "agent",
            createdAt: new Date().toISOString(),
            deliveryStatus: "pending",
          } as any);
        }
      } catch (err: any) {
        toast({
          title: "Erro IA",
          description: err?.message ?? "Falha ao gerar sugestão",
          variant: "destructive",
        });
      } finally {
        setSuggesting(false);
      }
    };
    return (
      <div className={`flex h-full min-h-0 min-w-0 flex-1 flex-col ${className ?? ""}`}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <ChannelToggle
              value={replyChannel}
              onChange={setReplyChannel}
              disabled={!conversation}
            />
            <Badge variant="outline" className="text-[10px]">
              conversa ativa
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => navigate("/comunicacoes")}
            >
              Vista clássica <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <HubConversationView />
        </div>

        {conversation ? (
          <>
            <ConversationTags conversation={conversation} />
            <div className="border-t border-border bg-card/60 px-3 py-2">
              <AiSuggestPopover
                loading={suggesting}
                onSelect={(opt) => void handleSuggest(opt, item.title)}
              />
            </div>
            <MessageInput />
          </>
        ) : null}
      </div>
    );
  }

  // ─── Email: simple preview + CTA to the Email page
  if (item.channel === "email") {
    return (
      <div className={`flex h-full min-h-0 flex-col bg-card/40 ${className ?? ""}`}>
        <ChannelBar title={item.title} subtitle={item.contact} />
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {item.subtitle || "(sem conteúdo)"}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-card/60 px-3 py-2">
          <ChannelToggle
            value="email"
            onChange={() => undefined}
            disabled
          />
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1"
            onClick={() => navigate(`/email?thread=${item.id.replace(/^email-/, "")}`)}
          >
            <Mail className="h-3.5 w-3.5" /> Abrir no Email
          </Button>
        </div>
      </div>
    );
  }

  // ─── Call: simple preview + CTA
  if (item.channel === "call") {
    const eventId = item.id.replace(/^call-/, "");
    const event = callEvents.find((e) => e.id === eventId);
    return (
      <div className={`flex h-full min-h-0 flex-col bg-card/40 ${className ?? ""}`}>
        <ChannelBar title={item.title} subtitle={item.contact} />
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
            Detalhe da chamada
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Estado: </span>
              {event?.operationalStatus ?? "—"}
            </li>
            <li>
              <span className="text-muted-foreground">Direção: </span>
              {event?.direction ?? "—"}
            </li>
            <li>
              <span className="text-muted-foreground">Origem: </span>
              {item.subtitle || "—"}
            </li>
          </ul>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-card/60 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1"
            onClick={() =>
              navigate(`/comunicacoes?tab=telecof&call=${encodeURIComponent(eventId)}`)
            }
          >
            <Phone className="h-3.5 w-3.5" /> Abrir chamada
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1"
            onClick={() => {
              if (!event?.phone) {
                toast({ title: "Sem telefone associado", variant: "destructive" });
                return;
              }
              navigate(
                `/comunicacoes?tab=telecof&call=${encodeURIComponent(eventId)}`,
              );
            }}
          >
            <SendHorizontal className="h-3.5 w-3.5" /> Retorno via WhatsApp
          </Button>
        </div>
      </div>
    );
  }

  // Fallback (should not happen)
  return null;
}

function ChannelBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Mail className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
