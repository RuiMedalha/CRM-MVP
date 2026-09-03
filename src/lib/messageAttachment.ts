import type { MessageAttachment } from "@/types/communication"
import { DIRECTUS_URL } from "@/integrations/directus/client"

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
}

function extFromMime(mime?: string): string {
  if (!mime) return "bin"
  return MIME_EXT[mime] ?? mime.split("/")[1]?.split("+")[0] ?? "bin"
}

function attRecord(att: MessageAttachment): Record<string, unknown> {
  return att as MessageAttachment & Record<string, unknown>
}

export function getAttachmentDownloadUrl(
  attachment: MessageAttachment,
  messageId?: string,
): string | null {
  const record = attRecord(attachment)

  const direct =
    attachment.url?.trim() ||
    (typeof record.s3Url === "string" ? record.s3Url.trim() : "") ||
    (typeof record.mediaUrl === "string" ? record.mediaUrl.trim() : "") ||
    (typeof record.s3_url === "string" ? record.s3_url.trim() : "") ||
    (typeof record.media_url === "string" ? record.media_url.trim() : "")

  if (direct) return direct

  // Directus file ID (used by WhatsApp pipeline: attachment.file = UUID of uploaded asset)
  const fileId =
    attachment.file ||
    (typeof record.file === "string" ? record.file.trim() : undefined)
  if (fileId) {
    return `${DIRECTUS_URL}/assets/${fileId}`
  }

  const base64 =
    (typeof record.base64 === "string" ? record.base64 : undefined) ||
    (typeof record.data === "string" ? record.data : undefined)

  if (!base64) return null

  const mime =
    attachment.mimeType ||
    (typeof record.mimetype === "string" ? record.mimetype : undefined) ||
    "application/octet-stream"

  const payload = base64.startsWith("data:")
    ? base64
    : `data:${mime};base64,${base64.replace(/^base64,/, "")}`

  try {
    return payload
  } catch {
    if (messageId) console.warn("[media] base64 inválido", messageId)
    return null
  }
}

export function getAttachmentFilename(
  attachment: MessageAttachment,
  messageId: string,
  index = 0,
): string {
  if (attachment.filename?.trim()) return attachment.filename.trim()
  const ext = extFromMime(attachment.mimeType)
  return `whatsapp-media-${messageId}${index > 0 ? `-${index}` : ""}.${ext}`
}

export function blobUrlFromBase64DataUri(dataUri: string): string | null {
  try {
    const [header, data] = dataUri.split(",")
    if (!data) return null
    const mimeMatch = header?.match(/data:([^;]+)/)
    const mime = mimeMatch?.[1] ?? "application/octet-stream"
    const binary = atob(data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: mime })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

/** Append access token to Directus asset URLs for authenticated access. */
function appendAssetToken(url: string): string {
  if (!url.includes('/assets/')) return url
  if (url.includes('access_token')) return url
  const token = (import.meta.env.VITE_DIRECTUS_ADMIN_TOKEN as string || '').trim()
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}access_token=${token}`
}

export function resolveAttachmentMediaUrl(
  attachment: MessageAttachment,
  messageId: string,
): string | null {
  const url = getAttachmentDownloadUrl(attachment, messageId)
  if (!url) return null
  if (url.startsWith("data:")) return blobUrlFromBase64DataUri(url) ?? url
  return appendAssetToken(url)
}

export async function downloadAttachment(
  attachment: MessageAttachment,
  messageId: string,
  index = 0,
): Promise<void> {
  const url = getAttachmentDownloadUrl(attachment, messageId)
  if (!url) throw new Error("Media sem URL disponível para download")

  const filename = getAttachmentFilename(attachment, messageId, index)
  let blobUrl: string | null = null
  let href = url

  if (url.startsWith("data:")) {
    blobUrl = blobUrlFromBase64DataUri(url)
    if (!blobUrl) throw new Error("Não foi possível converter media base64")
    href = blobUrl
  }

  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.rel = "noopener"
  if (!url.startsWith("data:")) link.target = "_blank"
  document.body.appendChild(link)
  link.click()
  link.remove()

  if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl!), 5000)
}
