import { useEffect } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ContactItem } from "@/integrations/directus/contacts";
import { createCommunicationEvent } from "@/integrations/directus/communicationEvents";

/** Nome do CustomEvent global emitido quando entra uma chamada Wavoip. */
export const WAVOIP_INCOMING_EVENT = "wavoip:incoming";

export type WavoipIncomingDetail = {
  phone: string;
  customerName?: string;
};

/** Extrai o telefone do payload (formato não documentado) de forma defensiva. */
function extractWavoipPhone(args: unknown[]): string | null {
  const keys = ["phone", "number", "from", "caller", "tel", "msisdn", "callerId"];
  const pick = (o: Record<string, unknown>): string | null => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };
  for (const a of args) {
    if (typeof a === "string" && a.trim()) return a.trim();
    if (a && typeof a === "object") {
      const o = a as Record<string, unknown>;
      const direct = pick(o);
      if (direct) return direct;
      for (const nestedKey of ["call", "data", "detail", "offer", "payload"]) {
        const nested = o[nestedKey];
        if (nested && typeof nested === "object") {
          const v = pick(nested as Record<string, unknown>);
          if (v) return v;
        }
      }
    }
  }
  return null;
}

const WAVOIP_UMD_SRC =
  "https://cdn.jsdelivr.net/npm/@wavoip/wavoip-webphone/dist/index.umd.min.js";
const SCRIPT_EL_ID = "wavoip-webphone-umd";

/** Eventos públicos documentados — ver https://wavoip.gitbook.io/api/webphone/referencia/api-publica.md */
type WavoipUiEventName = "call:started" | "call:accepted" | "call:ended" | "offer:received";

declare global {
  interface Window {
    wavoipWebphone?: {
      render: (
        opts?: Record<string, unknown>,
        instance?: unknown,
      ) => void | Promise<{ widget?: { open?: () => void } } & Record<string, unknown>>;
    };
    wavoip?: {
      widget?: {
        open?: () => void;
      };
      on?: (
        event: WavoipUiEventName,
        handler: (...args: unknown[]) => void,
      ) => (() => void) | undefined;
    };
  }
}

let scriptInjectPromise: Promise<void> | null = null;
let renderOncePromise: Promise<void> | null = null;
/** Evita registar dois listeners duplicados (Strict Mode / duplo render). */
let callPopupSubscriptionsAttached = false;

function wavoipLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

/**
 * O SDK usa classes `wv:` compiladas e pode recriar o FAB a qualquer momento.
 * Estilos inline são aplicados depois da renderização e vencem essa folha de
 * estilos; o observer reaplica-os quando o SDK substitui ou altera o botão.
 */
const wavoipShadowRoots = new Set<ShadowRoot>()

/** O SDK encapsula o widget num shadow root fechado; tornamo-lo observável antes do render. */
function exposeWavoipShadowRoots(): void {
  if (typeof Element === "undefined") return
  const marker = "__wavoipOpenShadowPatched"
  const proto = Element.prototype as Element & { [marker]?: boolean }
  if (proto[marker]) return
  const attachShadow = Element.prototype.attachShadow
  Element.prototype.attachShadow = function (init) {
    const root = attachShadow.call(this, { ...init, mode: "open" })
    wavoipShadowRoots.add(root)
    return root
  }
  proto[marker] = true
}

function wavoipButtonsIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(
    'button[data-slot="button"][class*="wv:fixed"], button[data-slot="button"][class*="wv:bottom-6"]',
  )]
}

function positionWavoipFab(): void {
  if (typeof document === "undefined") return
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768
  const composer = document.querySelector<HTMLElement>(".crm-message-input")
  const composerRect = composer?.getBoundingClientRect()
  const composerIsVisible = Boolean(
    composerRect && composerRect.bottom > 0 && composerRect.top < window.innerHeight,
  )
  const isShortLandscape = window.matchMedia("(orientation: landscape) and (max-height: 500px)").matches
  const hasOpenDialog = Boolean(document.querySelector('[role="dialog"][data-state="open"]'))
  const hideFab = (isShortLandscape && composerIsVisible) || hasOpenDialog
  const bottom = isMobile
    ? "calc(4.5rem + env(safe-area-inset-bottom))"
    : "1.5rem"
  const right = isMobile ? "1rem" : "1.5rem"
  const buttons = [...wavoipButtonsIn(document), ...[...wavoipShadowRoots].flatMap(wavoipButtonsIn)]
  buttons.forEach((button) => {
    button.style.setProperty("bottom", bottom)
    button.style.setProperty("right", right)
    button.style.setProperty("z-index", "40")
    if (hideFab) {
      button.style.setProperty("display", "none")
      button.style.setProperty("pointer-events", "none")
    } else {
      button.style.removeProperty("display")
      button.style.removeProperty("pointer-events")
    }
  })
}

function observeWavoipFab(): () => void {
  if (typeof document === "undefined") return () => {}
  positionWavoipFab()
  const observer = new MutationObserver(() => positionWavoipFab())
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] })
  wavoipShadowRoots.forEach((root) => observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }))
  window.addEventListener("resize", positionWavoipFab)
  window.addEventListener("orientationchange", positionWavoipFab)
  return () => {
    observer.disconnect()
    window.removeEventListener("resize", positionWavoipFab)
    window.removeEventListener("orientationchange", positionWavoipFab)
  }
}

/** Carrega o UMD uma única vez; protege cargas concurrentes/double-mount. */
function injectWavoipScript(): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }

  if (!scriptInjectPromise) {
    scriptInjectPromise = new Promise((resolve, reject) => {
      wavoipLog("[Wavoip] loading");

      const finishLoaded = () => {
        wavoipLog("[Wavoip] loaded");
        resolve();
      };

      const fail = () => reject(new Error("[Wavoip] falha ao carregar UMD"));

      if (typeof window.wavoipWebphone?.render === "function") {
        queueMicrotask(finishLoaded);
        return;
      }

      let el = document.getElementById(SCRIPT_EL_ID) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement("script");
        el.id = SCRIPT_EL_ID;
        el.async = true;
        el.src = WAVOIP_UMD_SRC;
        document.head.appendChild(el);
      }

      el.addEventListener("load", finishLoaded, { once: true });
      el.addEventListener("error", fail, { once: true });

      queueMicrotask(() => {
        if (typeof window.wavoipWebphone?.render === "function") {
          el!.removeEventListener("load", finishLoaded);
          el!.removeEventListener("error", fail);
          finishLoaded();
        }
      });
    });
  }

  return scriptInjectPromise;
}

/**
 * Abre o painel/flutuante Wavoip quando há chamada — entrada (`offer:received`)
 * ou saída iniciada (`call:started`).
 * Docs: api-publica.md → `on` + `widget.open`.
 */
function attachWavoipAutoOpenPopupOnCalls(): void {
  if (callPopupSubscriptionsAttached) return;

  const wavoipApi = window.wavoip;
  const subscribe = wavoipApi?.on;

  if (typeof subscribe !== "function") {
    if (import.meta.env.DEV) {
      console.warn("[Wavoip] API .on indisponível — popup não abre automaticamente em chamadas.");
    }
    return;
  }

  const openPanelSafe = (_event: string) => {
    try {
      wavoipApi?.widget?.open?.();
      wavoipLog("[Wavoip] widget.open()", _event);
    } catch {
      /* noop — SDK já loga erros graves */
    }
  };

  const onOfferReceived = (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log("[Wavoip] offer:received payload", args);
    }
    openPanelSafe("offer:received");

    const phone = extractWavoipPhone(args);
    if (!phone) {
      if (import.meta.env.DEV) {
        console.warn("[Wavoip] offer:received sem telefone reconhecível — banner não aberto.");
      }
      return;
    }

    // Banner instantâneo (sem latência de poll) via CustomEvent local.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<WavoipIncomingDetail>(WAVOIP_INCOMING_EVENT, {
          detail: { phone },
        }),
      );
    }

    // Registo (fire-and-forget) em communication_events.
    void createCommunicationEvent({
      channel: "wavoip",
      event_type: "offer",
      phone,
      direction: "inbound",
      status: "new",
    });
  };

  subscribe("offer:received", onOfferReceived);
  subscribe("call:started", () => openPanelSafe("call:started"));

  callPopupSubscriptionsAttached = true;
}

/** Aguarda `window.wavoip.on` ficar disponível depois do `render()` (MiddlewareRoot pode montar logo a seguir). */
function scheduleAttachWavoipPopupListeners(): void {
  let tries = 0;
  const maxTries = 120;

  const tick = (): void => {
    if (callPopupSubscriptionsAttached) return;
    tries += 1;
    if (typeof window.wavoip?.on === "function") {
      attachWavoipAutoOpenPopupOnCalls();
      return;
    }
    if (tries >= maxTries) {
      if (import.meta.env.DEV) {
        console.warn("[Wavoip] Timeout: window.wavoip.on não disponível — popup automático não activo.");
      }
      return;
    }
    requestAnimationFrame(tick);
  };

  queueMicrotask(tick);
}

/** Render global único conforme SDK Wavoip. */
async function renderWavoipOnce(): Promise<void> {
  await injectWavoipScript();

  const api = window.wavoipWebphone;
  if (!api || typeof api.render !== "function") {
    throw new Error("[Wavoip] wavoipWebphone.render indisponível após load");
  }

  if (!renderOncePromise) {
    renderOncePromise = (async () => {
      await Promise.resolve(api.render());
      wavoipLog("[Wavoip] rendered");
      scheduleAttachWavoipPopupListeners();
    })();
  }

  return renderOncePromise;
}

export function resolveDialPhoneFromContact(contact: ContactItem | null): string | null {
  if (!contact) return null;
  const raw = String(contact.phone ?? contact.contact_phone ?? "").trim();
  return raw.length > 0 ? raw : null;
}

/**
 * Futuro click-to-call. Por agora só registo — sem postMessage nem iframe BravoTech.
 */
export function handleClickToCall(phone: string): void {
  console.log("[Wavoip] call", phone);
}

/** Abre o widget nativo do webphone no DOM principal. */
export function openWavoipWidget(): void {
  window.wavoip?.widget?.open?.();
}

/**
 * Injeta script e chama render() uma vez. Montar uma única vez (ex.: AppLayout).
 */
export default function WavoipWebphone() {
  useEffect(() => {
    let cancelled = false;

    exposeWavoipShadowRoots()

    renderWavoipOnce().catch((err) => {
      if (cancelled || !import.meta.env.DEV) return;
      console.warn(err);
    });

    // O SDK injeta o botão de forma assíncrona, portanto observar o body é
    // necessário mesmo depois de render() resolver.
    const stopFabObserver = observeWavoipFab()

    return () => {
      cancelled = true;
      stopFabObserver();
    };
  }, []);

  return null;
}

type WavoipDialButtonProps = {
  /** `contact_id` da URL — permite distinguir “sem seleção” de “contacto sem telefone”. */
  contactId?: string;
  phone: string | null;
  contact: ContactItem | null;
  /** Quando há `contact_id` mas o fetch está em curso. */
  contactLoading?: boolean;
  className?: string;
};

/**
 * Botão "Ligar" no header das Comunicações.
 * Mantém sempre um nó DOM visível (desativado se não há telefone).
 */
export function WavoipDialButton({
  contactId = "",
  phone,
  contact,
  contactLoading = false,
  className,
}: WavoipDialButtonProps) {
  const hasPhone = Boolean(phone && phone.trim());
  const hasSelection = Boolean(contactId.trim());

  let tooltipDisabled: string | undefined;
  if (!hasPhone) {
    tooltipDisabled =
      contactLoading && hasSelection ? "A carregar contacto..." : "Sem telefone disponível";
  }

  const onClick = () => {
    if (!hasPhone || !phone) return;
    openWavoipWidget();
    handleClickToCall(phone);
  };

  const button = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={!hasPhone}
      className={cn("relative z-[100] shrink-0", className)}
      onClick={onClick}
    >
      <Phone className="h-4 w-4" />
      Ligar
    </Button>
  );

  if (!hasPhone && tooltipDisabled) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="relative z-[100] inline-flex max-w-full cursor-not-allowed">
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="z-[9999]" sideOffset={8}>
            {tooltipDisabled}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span className="relative z-[100] inline-flex max-w-full">{button}</span>;
}
