import { directusRequest } from "./client"

export interface MessageTemplateButton {
  type: "quick_reply" | "url" | "phone_number"
  text: string
  url?: string
  phone?: string
}

export interface MessageTemplate {
  id: string
  key: string
  name: string
  channel: string
  content: string
  enabled: boolean
  /** Botões interativos (quick replies, URLs, telefone). */
  buttons?: MessageTemplateButton[]
  /** Nomes legíveis das variáveis, na ordem de substituição — variables[0] mapeia para {{1}} no content, variables[1] → {{2}}, etc. */
  variables?: string[]
}

function normalizeTemplate(raw: unknown): MessageTemplate {
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id ?? ""),
    key: String(r.key ?? ""),
    name: String(r.name ?? ""),
    channel: String(r.channel ?? "all"),
    content: String(r.content ?? ""),
    enabled: r.enabled !== false,
    buttons: Array.isArray(r.buttons) ? (r.buttons as MessageTemplateButton[]) : undefined,
    variables: Array.isArray(r.variables) ? (r.variables as string[]) : undefined,
  }
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  try {
    const json = await directusRequest<{ data: unknown[] }>(
      "/items/message_templates?filter[enabled][_eq]=true&sort=name&limit=200",
    )
    return (json.data ?? []).map(normalizeTemplate)
  } catch {
    console.warn("[Directus] message_templates indisponível")
    return []
  }
}

export async function listAllMessageTemplates(): Promise<MessageTemplate[]> {
  try {
    const json = await directusRequest<{ data: unknown[] }>(
      "/items/message_templates?sort=name&limit=200",
    )
    return (json.data ?? []).map(normalizeTemplate)
  } catch {
    console.warn("[Directus] message_templates indisponível")
    return []
  }
}

export async function createMessageTemplate(payload: Omit<MessageTemplate, "id">): Promise<MessageTemplate> {
  const json = await directusRequest<{ data: unknown }>("/items/message_templates", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return normalizeTemplate(json.data)
}

export async function updateMessageTemplate(id: string, payload: Partial<Omit<MessageTemplate, "id">>): Promise<MessageTemplate> {
  const json = await directusRequest<{ data: unknown }>(`/items/message_templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return normalizeTemplate(json.data)
}

export async function deleteMessageTemplate(id: string): Promise<void> {
  await directusRequest(`/items/message_templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
