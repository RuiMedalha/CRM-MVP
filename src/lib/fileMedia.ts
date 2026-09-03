import type { MessageAttachment } from "@/types/communication"

export type OutboundMediaType = MessageAttachment["type"]

export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Leitura do ficheiro falhou"))
        return
      }
      const base64 = result.includes(",") ? result.split(",")[1] ?? "" : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"))
    reader.readAsDataURL(file)
  })
}

export function inferMediaTypeFromFile(
  file: File | Blob,
  filename: string,
): OutboundMediaType {
  const mime = file.type.toLowerCase()
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"

  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image"
  if (["mp3", "ogg", "wav", "m4a", "webm", "opus"].includes(ext)) return "audio"
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video"

  return "file"
}

export function mediaTypeIconLabel(type: OutboundMediaType): string {
  switch (type) {
    case "image": return "Imagem"
    case "audio": return "Áudio"
    case "video": return "Vídeo"
    default: return "Ficheiro"
  }
}
