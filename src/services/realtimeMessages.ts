import { DIRECTUS_URL, getDirectusTokenForRequest } from "@/integrations/directus/client"

/**
 * Real-time via Directus WebSocket subscriptions.
 *
 * ADITIVO ao polling: subscreve a coleção `messages` (create) e chama `onChange`
 * quando chega mensagem nova, para o CRM refazer o fetch das conversas de
 * imediato em vez de esperar pelo próximo tick de 3s. Se o WebSocket não
 * conseguir ligar/autenticar, não faz nada — o polling continua a ser o
 * mecanismo de base (degradação graciosa, nunca parte o chat).
 *
 * Protocolo: https://docs.directus.io/guides/real-time/subscriptions.html
 */

function wsUrlFromDirectus(): string | null {
  if (!DIRECTUS_URL) return null
  try {
    const u = new URL(DIRECTUS_URL)
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:"
    u.pathname = (u.pathname.replace(/\/+$/, "")) + "/websocket"
    return u.toString()
  } catch {
    return null
  }
}

export function startRealtimeMessages(onChange: () => void): () => void {
  const url = wsUrlFromDirectus()
  if (!url || typeof WebSocket === "undefined") {
    return () => {}
  }

  let stopped = false
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let retries = 0

  function scheduleReconnect() {
    if (stopped) return
    // backoff exponencial suave, teto 30s
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(retries, 5)))
    retries++
    reconnectTimer = setTimeout(connect, delay)
  }

  function connect() {
    if (stopped) return
    const token = getDirectusTokenForRequest()
    if (!token) {
      scheduleReconnect()
      return
    }
    try {
      ws = new WebSocket(url as string)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: "auth", access_token: token }))
    }

    ws.onmessage = (ev) => {
      let msg: any
      try { msg = JSON.parse(ev.data) } catch { return }
      if (!msg || typeof msg !== "object") return

      if (msg.type === "auth" && msg.status === "ok") {
        retries = 0
        // subscreve a criação de mensagens (só o id — só precisamos do "algo mudou")
        ws?.send(JSON.stringify({
          type: "subscribe",
          collection: "messages",
          event: "create",
          query: { fields: ["id"], limit: 1 },
        }))
        return
      }
      if (msg.type === "auth" && msg.status === "error") {
        // token inválido/expirado — fecha e deixa o reconnect apanhar token novo
        try { ws?.close() } catch { /* noop */ }
        return
      }
      if (msg.type === "ping") {
        ws?.send(JSON.stringify({ type: "pong" }))
        return
      }
      if (msg.type === "subscription" && (msg.event === "create" || msg.event === "init")) {
        if (msg.event === "create") onChange()
        return
      }
    }

    ws.onerror = () => {
      try { ws?.close() } catch { /* noop */ }
    }

    ws.onclose = () => {
      ws = null
      scheduleReconnect()
    }
  }

  connect()

  return () => {
    stopped = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    try { ws?.close() } catch { /* noop */ }
    ws = null
  }
}
