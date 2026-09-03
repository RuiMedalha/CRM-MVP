import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, StickyNote } from "lucide-react"

import {
  setConversationNotes,
  setConversationTagIds,
} from "@/integrations/directus/hubConversations"
import {
  QUICK_TAGS,
  QUICK_TAG_COLORS,
} from "@/lib/quickConversationTags"
import { findStoredConversation, useConversationStore } from "@/store/conversationStore"
import type { Conversation } from "@/types/conversation"

interface Props {
  conversation: Conversation
}

export function ConversationTags({ conversation: conversationProp }: Props) {
  const mergeConversation = useConversationStore((s) => s.mergeConversation)
  const conversation =
    useConversationStore((s) =>
      findStoredConversation(s, conversationProp.id),
    ) ?? conversationProp

  const [busy, setBusy] = useState(false)
  const [quickNote, setQuickNote] = useState(conversation.notes ?? "")
  const [savingNote, setSavingNote] = useState(false)
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [hiddenTagCount, setHiddenTagCount] = useState(0)
  const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipAutoSaveRef = useRef(true)
  const tagsWrapRef = useRef<HTMLDivElement>(null)

  const activeTagIds = conversation.tagIds ?? []

  useEffect(() => {
    setQuickNote(conversation.notes ?? "")
    skipAutoSaveRef.current = true
  }, [conversation.id, conversation.notes])

  useLayoutEffect(() => {
    const el = tagsWrapRef.current
    if (!el || tagsExpanded) { setHiddenTagCount(0); return }
    const measure = () => {
      const maxBottom = el.clientHeight
      let hidden = 0
      for (const child of el.children) {
        const node = child as HTMLElement
        if (node.dataset.tagChip !== "true") continue
        if (node.offsetTop + node.offsetHeight > maxBottom + 2) hidden += 1
      }
      setHiddenTagCount(hidden)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeTagIds, tagsExpanded, busy])

  async function toggleTag(tagId: string) {
    const selected = activeTagIds.includes(tagId)
    const next = selected
      ? activeTagIds.filter((id) => id !== tagId)
      : [...activeTagIds, tagId]
    setBusy(true)
    try {
      const updated = await setConversationTagIds(conversation.id, next)
      mergeConversation({ ...conversation, ...updated, tagIds: next })
    } catch {
      mergeConversation({ ...conversation, tagIds: next })
    } finally {
      setBusy(false)
    }
  }

  async function saveNote(text: string) {
    setSavingNote(true)
    try {
      const result = await setConversationNotes(conversation.id, text.trim())
      mergeConversation({ ...conversation, ...(result.conversation ?? {}), notes: text.trim() })
    } catch {
      mergeConversation({ ...conversation, notes: text.trim() })
    } finally {
      setSavingNote(false)
    }
  }

  // Auto-save com debounce de 1.5s
  useEffect(() => {
    if (skipAutoSaveRef.current) { skipAutoSaveRef.current = false; return }
    if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current)
    noteDebounceRef.current = setTimeout(() => void saveNote(quickNote), 1500)
    return () => { if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current) }
  }, [quickNote, conversation.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="crm-conversation-tags border-t border-border bg-muted/20 px-3 py-1.5 space-y-1.5">
      {/* Tags rápidas */}
      <div>
        <div
          ref={tagsWrapRef}
          className={`flex flex-wrap gap-1 ${tagsExpanded ? "" : "max-h-[2.5rem] overflow-hidden"}`}
        >
          {QUICK_TAGS.map((tag) => {
            const active = activeTagIds.includes(tag.id)
            const hex = QUICK_TAG_COLORS[tag.color]
            return (
              <button
                key={tag.id}
                type="button"
                data-tag-chip="true"
                disabled={busy}
                onClick={() => void toggleTag(tag.id)}
                className={`rounded-full border px-2 py-0.5 text-xs leading-tight transition-all disabled:opacity-50 ${
                  active
                    ? "border-transparent font-semibold text-white"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
                style={active ? { backgroundColor: hex } : undefined}
              >
                {tag.label}
              </button>
            )
          })}
        </div>
        {!tagsExpanded && hiddenTagCount > 0 && (
          <button
            type="button"
            onClick={() => setTagsExpanded(true)}
            className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" />
            +{hiddenTagCount} etiquetas
          </button>
        )}
        {tagsExpanded && (
          <button
            type="button"
            onClick={() => setTagsExpanded(false)}
            className="mt-1 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" /> Menos
          </button>
        )}
      </div>

      {/* Nota interna (colapsável) */}
      <div>
        <button
          type="button"
          onClick={() => setNoteExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <StickyNote className="h-3 w-3" />
          Nota interna
          {conversation.notes?.trim() && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
          )}
          {noteExpanded ? (
            <ChevronUp className="ml-auto h-3 w-3" />
          ) : (
            <ChevronDown className="ml-auto h-3 w-3" />
          )}
        </button>

        {noteExpanded && (
          <div className="mt-1.5">
            <textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Nota interna sobre esta conversa… (grava automaticamente)"
              rows={2}
              className="w-full resize-none rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs outline-none focus:ring-1 focus:ring-amber-400 dark:border-amber-800 dark:bg-amber-950/20"
              disabled={savingNote}
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground/60">
                {savingNote ? "A guardar…" : "Guarda automaticamente"}
              </span>
              <button
                type="button"
                onClick={() => void saveNote(quickNote)}
                disabled={savingNote}
                className="text-xs text-amber-600 hover:text-amber-800 disabled:opacity-50"
              >
                Guardar agora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
