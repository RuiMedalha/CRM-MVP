import { useEffect, useRef, useState } from "react"
import { Copy, Download, Forward, Info, MoreVertical, Reply, Smile } from "lucide-react"

import { downloadAttachment } from "@/lib/messageAttachment"
import { stripHubMetaAttachments } from "@/lib/messageMetadata"

import type { Message } from "@/types/message"

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✅"]

interface MessageActionsMenuProps {
  message: Message
  onReply: () => void
  onForward?: () => void
  onReact: (emoji: string) => void
  onShowDetails?: () => void
  tone?: "light" | "dark"
}

export function MessageActionsMenu({
  message, onReply, onForward, onReact, onShowDetails, tone = "light",
}: MessageActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowReactions(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const media = stripHubMetaAttachments(message.attachments)?.[0]

  async function handleCopy() {
    if (message.content.trim()) await navigator.clipboard.writeText(message.content)
    setOpen(false)
  }

  async function handleSaveMedia() {
    if (!media) return
    try { await downloadAttachment(media, message.id, 0) } catch { /* ignore */ }
    setOpen(false)
  }

  const btnClass = tone === "dark" ? "text-white/80 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-lg p-1 opacity-70 transition hover:opacity-100 ${btnClass}`}
        aria-label="Acções da mensagem"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={`absolute z-20 min-w-[10rem] rounded-xl border py-1 shadow-lg ${
            tone === "dark"
              ? "right-0 top-full mt-1 border-blue-800 bg-blue-950"
              : "left-0 top-full mt-1 border-border bg-card"
          }`}
        >
          {showReactions ? (
            <div className="flex flex-wrap gap-1 px-2 py-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="rounded-lg px-2 py-1 text-lg hover:bg-muted"
                  onClick={() => { onReact(emoji); setOpen(false); setShowReactions(false) }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <>
              <MenuItem icon={Reply} label="Responder" tone={tone} onClick={() => { onReply(); setOpen(false) }} />
              {onForward && <MenuItem icon={Forward} label="Reencaminhar" tone={tone} onClick={() => { onForward(); setOpen(false) }} />}
              <MenuItem icon={Copy} label="Copiar texto" tone={tone} onClick={() => void handleCopy()} />
              {media && <MenuItem icon={Download} label="Guardar media" tone={tone} onClick={() => void handleSaveMedia()} />}
              <MenuItem icon={Smile} label="Reagir" tone={tone} onClick={() => setShowReactions(true)} />
              {onShowDetails && <MenuItem icon={Info} label="Ver detalhes" tone={tone} onClick={() => { onShowDetails(); setOpen(false) }} />}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, tone }: {
  icon: typeof Reply; label: string; onClick: () => void; tone: "light" | "dark"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
        tone === "dark" ? "text-blue-100 hover:bg-blue-900" : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  )
}
