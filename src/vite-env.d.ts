/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUBCHAT_URL?: string;
  /** URL do iframe BravoTech em `/comunicacoes` — override no build; ver `BravoTechEmbed.tsx`. */
  readonly VITE_BRAVOTECH_CHAT_URL?: string;
  readonly VITE_LEADS_POPUP_MAX_AGE_SECONDS?: string;
  readonly VITE_LEADS_INCOMING_POLL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
