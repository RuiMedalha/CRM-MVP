import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Building2, FileText, Kanban, MessagesSquare, Search, X } from "lucide-react"

import { useGlobalSearchStore } from "@/store/globalSearchStore"
import { useConversationStore } from "@/store/conversationStore"
import { useContacts } from "@/hooks/useContacts"
import { useDeals } from "@/hooks/useDeals"

type ResultKind = "contact" | "deal" | "conversation"

interface SearchResult {
  id: string
  kind: ResultKind
  primary: string
  secondary: string
  href: string
}

function ResultIcon({ kind }: { kind: ResultKind }) {
  switch (kind) {
    case "contact": return <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
    case "deal": return <Kanban className="h-4 w-4 shrink-0 text-muted-foreground" />
    case "conversation": return <MessagesSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
  }
}

function kindLabel(kind: ResultKind): string {
  switch (kind) {
    case "contact": return "Contacto"
    case "deal": return "Negócio"
    case "conversation": return "Conversa"
  }
}

export function GlobalSearch() {
  const { isOpen, close } = useGlobalSearchStore()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { data: contacts } = useContacts()
  const { data: deals } = useDeals()
  const storeConversations = useConversationStore((s) => s.conversations)
  const storeGroupConversations = useConversationStore((s) => s.groupConversations)

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        useGlobalSearchStore.getState().toggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.length < 2) return []

    // Normalize phone: strip spaces, dashes, parens, +, country prefix
    const normalizePhone = (p: string) => p.replace(/[\s\-().+]/g, "").replace(/^(00)?351/, "");
    const qNorm = normalizePhone(q);
    const isPhoneQuery = /^\d{3,}$/.test(qNorm);

    const out: SearchResult[] = []

    for (const c of contacts ?? []) {
      const name = String((c as any).company_name || (c as any).contact_name || "")
      const phone = String((c as any).phone || "")
      const mobile = String((c as any).mobile_phone || "")
      const email = String((c as any).email || "")
      const phoneMatch = isPhoneQuery && (
        normalizePhone(phone).includes(qNorm) ||
        normalizePhone(mobile).includes(qNorm)
      );
      if (
        name.toLowerCase().includes(q) ||
        phoneMatch ||
        email.toLowerCase().includes(q)
      ) {
        out.push({
          id: String((c as any).id),
          kind: "contact",
          primary: name || "Sem nome",
          secondary: phone || email || "—",
          href: `/customer360-shell/${String((c as any).id)}`,
        })
        if (out.length >= 12) break
      }
    }

    for (const d of deals ?? []) {
      const title = String(d.title || "")
      if (title.toLowerCase().includes(q)) {
        out.push({
          id: String(d.id),
          kind: "deal",
          primary: title || "Sem título",
          secondary: `€ ${(d.total_amount || 0).toLocaleString("pt-PT")}`,
          href: `/pipeline?dealId=${d.id}`,
        })
        if (out.length >= 18) break
      }
    }

    for (const conv of [...storeConversations, ...storeGroupConversations]) {
      const name = String(conv.customerName || "")
      if (name.toLowerCase().includes(q)) {
        out.push({
          id: conv.id,
          kind: "conversation",
          primary: name || "Visitante",
          secondary: conv.channel ?? "—",
          href: `/comunicacoes`,
        })
        if (out.length >= 24) break
      }
    }

    return out.slice(0, 12)
  }, [query, contacts, deals, storeConversations, storeGroupConversations])

  useEffect(() => { setActiveIndex(0) }, [results])

  function handleSelect(result: SearchResult) {
    close()
    if (result.kind === "conversation") {
      useConversationStore.getState().selectConversation(result.id)
    }
    navigate(result.href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); return }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return }
    if (e.key === "Enter" && results[activeIndex]) { handleSelect(results[activeIndex]); return }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal
        aria-label="Pesquisa global"
        className="fixed left-1/2 top-[15%] z-[301] w-full max-w-lg -translate-x-1/2 rounded-2xl border border-border bg-card shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar contactos, negócios, conversas…"
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1">
          {query.length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Escre­ve pelo menos 2 carac­teres para pesquisar
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sem resultados para "{query}"
            </p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.id + r.kind}
                type="button"
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === activeIndex ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <ResultIcon kind={r.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.primary}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.secondary}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {kindLabel(r.kind)}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex gap-4 text-xs text-muted-foreground/60">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      </div>
    </>
  )
}
