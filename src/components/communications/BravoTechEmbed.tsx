import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, MessageSquareWarning } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Integração BravoTech — embed em https://crm.hotelequip.pt (frame-ancestors no servidor BravoTech). */

/**
 * URL do iframe: **só trocar com variável de ambiente** (build-time), sem editar este ficheiro.
 * - `VITE_BRAVOTECH_CHAT_URL` definida → usa esse valor.
 * - Vazia / omitida → usa `DEFAULT_BRAVOTECH_CHAT_URL` (temporariamente o host `chat.*` ligado em produção).
 * Para voltar ao domínio `hotelequip.*` validado: no `.env.production` ou CI, por ex.
 * `VITE_BRAVOTECH_CHAT_URL=https://hotelequip.teambravotech.com` e rebuild.
 */
const DEFAULT_BRAVOTECH_CHAT_URL = "https://chat.teambravotech.com";

const envBravoUrl = String(import.meta.env.VITE_BRAVOTECH_CHAT_URL ?? "").trim();

export const BRAVOTECH_CHAT_URL = (envBravoUrl || DEFAULT_BRAVOTECH_CHAT_URL).replace(/\/+$/, "");

const BRAVOTECH_ORIGIN = new URL(BRAVOTECH_CHAT_URL).origin;

/** Atributos do iframe conforme especificação validada BravoTech/Hotelequip. */
/** `notifications` no `allow=` do iframe gera aviso "Unrecognized feature" em Chromium; permissões ficam pelo fluxo BravoTech/OS. */
const BRAVOTECH_IFRAME_ALLOW =
  "microphone; camera; autoplay; clipboard-read; clipboard-write";

const BRAVOTECH_IFRAME_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  border: 0,
};

export function openBravoTechInNewTab(): void {
  window.open(BRAVOTECH_CHAT_URL, "_blank", "noopener,noreferrer");
}

type BravoTechEmbedProps = {
  /** Ocupa só a coluna central do módulo Comunicações (sem layout de página inteira). */
  embedded?: boolean;
};

export function BravoTechEmbed({ embedded = false }: BravoTechEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /** Só `onError` do iframe — evitar timeout: SPAs em iframe cross-origin muitas vezes não disparam `load` a tempo e o overlay escondia o chat. */
  const [iframeBlocked, setIframeBlocked] = useState(false);

  const markLoaded = useCallback(() => {
    setIframeBlocked(false);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== BRAVOTECH_ORIGIN) {
        return;
      }
      if (import.meta.env.DEV) {
        console.debug("[BravoTech postMessage]", event.data);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const iframeShared = (
    <iframe
      ref={iframeRef}
      src={BRAVOTECH_CHAT_URL}
      title="WA VoIP Hotelequip"
      style={BRAVOTECH_IFRAME_STYLE}
      allow={BRAVOTECH_IFRAME_ALLOW}
      className={cn("block min-h-0 min-w-0 flex-1")}
      onLoad={markLoaded}
      onError={() => setIframeBlocked(true)}
    />
  );

  if (embedded) {
    return (
      <section
        data-page="comunicacoes-bravotech-embed"
        data-embed-url={BRAVOTECH_CHAT_URL}
        className="flex min-h-[min(360px,65dvh)] flex-1 flex-col overflow-hidden bg-background"
      >
        <div className="flex h-9 shrink-0 items-center justify-end gap-2 border-b border-border px-2">
          <span className="mr-auto truncate text-xs text-muted-foreground">Conversa — BravoTech</span>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={openBravoTechInNewTab}>
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="text-xs">Nova aba</span>
          </Button>
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {iframeBlocked ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 p-4 text-center"
              role="alert"
            >
              <MessageSquareWarning className="h-8 w-8 text-amber-600" />
              <p className="max-w-sm text-xs text-foreground">
                Não foi possível embutir o painel. Abra em nova aba.
              </p>
              <Button type="button" size="sm" onClick={openBravoTechInNewTab}>
                Abrir BravoTech
              </Button>
            </div>
          ) : null}

          {iframeShared}
        </div>
      </section>
    );
  }

  return (
    <section
      data-page="comunicacoes-bravotech"
      data-embed-url={BRAVOTECH_CHAT_URL}
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden",
        "h-[calc(100dvh-6rem)] md:h-[calc(100dvh-3rem)]",
      )}
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">Atendimento BravoTech</h1>
          <p className="truncate text-xs text-muted-foreground">Comunicações omnichannel</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={openBravoTechInNewTab}>
          <ExternalLink className="h-4 w-4" />
          Abrir em nova aba
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-6 md:hidden">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          No telemóvel, o atendimento abre na aplicação BravoTech em ecrã completo.
        </p>
        <Button type="button" size="lg" onClick={openBravoTechInNewTab}>
          Abrir Atendimento
        </Button>
      </div>

      <div className="relative hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
        {iframeBlocked ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 text-center"
            role="alert"
          >
            <MessageSquareWarning className="h-10 w-10 text-amber-600" />
            <p className="max-w-md text-sm text-foreground">
              O painel BravoTech não pôde ser embutido. Use o botão abaixo para abrir em nova aba.
            </p>
            <Button type="button" onClick={openBravoTechInNewTab}>
              <ExternalLink className="h-4 w-4" />
              Abrir em nova aba
            </Button>
          </div>
        ) : null}

        {iframeShared}
      </div>
    </section>
  );
}
