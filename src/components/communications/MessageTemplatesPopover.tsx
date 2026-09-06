import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { FileText, Search, X, Zap, AlertTriangle } from "lucide-react"

import { listMessageTemplates, type MessageTemplate } from "@/integrations/directus/messageTemplates"
import { cn } from "@/lib/utils"

interface Props {
  channel?: string
  /** Instance name activa (e.g. hotelequip-916, hotelequip-913) para decidir formato de envio */
  instanceName?: string
  onSelect: (content: string) => void
}

/** Substitui {{1}}, {{2}} etc. pelos valores fornecidos */
function interpolateVariables(content: string, values: Record<string, string>, variableNames: string[]): string {
  let result = content
  variableNames.forEach((name, i) => {
    const placeholder = `{{${i + 1}}}`
    result = result.replaceAll(placeholder, values[name] || placeholder)
  })
  return result
}

/** Formata botões como texto numerado (fallback para Evolution/Baileys) */
function buttonsAsText(buttons: NonNullable<MessageTemplate["buttons"]>): string {
  if (buttons.length === 0) return ""
  const lines = buttons.map((b, i) => {
    const emoji = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][i] || `${i + 1}.`
    return `${emoji} ${b.text}`
  })
  return "\n\n" + lines.join("\n")
}

export const BUILT_IN_SNIPPETS: MessageTemplate[] = [
  {
    id: "builtin-triage",
    name: "👋 Acolhimento, Horário & Triagem (Automática)",
    content: "Olá! Obrigado pelo seu contacto com a HotelEquip. 👋\n\nRecebemos a sua mensagem. De momento a nossa equipa está em atendimento, mas responderemos com a máxima brevidade!\n\n🕒 O nosso horário de atendimento é de 2ª a 6ª feira, das 09h00 às 13h00 e das 14h00 às 18h00.\n\nPara o podermos encaminhar de imediato para o departamento responsável, indique-nos por favor o motivo do seu contacto:\n1️⃣ Avaria / Assistência Técnica (manutenção, peças ou reparação)\n2️⃣ Pedido de Orçamento (novos equipamentos ou projetos)\n3️⃣ Pedido de Informações (encomendas, faturas ou dúvidas gerais)\n\nPor favor, responda apenas com o número da sua opção (1, 2 ou 3).",
    channel: "all",
    enabled: true,
  },
  {
    id: "builtin-recovery",
    name: "📞 Recuperação de Chamada Não Atendida",
    content: "Olá! Vimos que nos tentou ligar há pouco para a nossa central, mas infelizmente não conseguimos atender a tempo. Em que podemos ajudar?",
    channel: "all",
    enabled: true,
  },
  {
    id: "builtin-iban",
    name: "💳 IBAN / Dados de Transferência",
    content: "Dados para Pagamento por Transferência Bancária:\nIBAN: [Inserir IBAN]\nTitular: Profihotel Lda\nPor favor envie o comprovativo por este canal para processarmos o seu pedido.",
    channel: "all",
    enabled: true,
  },
  {
    id: "builtin-billing",
    name: "📄 Pedido de Dados de Faturação",
    content: "Para podermos emitir a respetiva fatura / cotação, pode indicar-nos por favor:\n• Nome ou Razão Social:\n• NIF / NIPC:\n• Morada completa com Código Postal:\n• Email de faturação:",
    channel: "all",
    enabled: true,
  },
  {
    id: "builtin-schedule",
    name: "📍 Morada & Horário de Atendimento",
    content: "O nosso horário de funcionamento é de 2ª a 6ª feira, das 09:00 às 13:00 e das 14:00 às 18:00.\nEstamos à sua inteira disposição para qualquer questão adicional!",
    channel: "all",
    enabled: true,
  },
  {
    id: "builtin-shipping",
    name: "📦 Confirmação de Envio com Tracking",
    content: "A sua encomenda foi preparada e expedida via transportadora. A entrega está prevista dentro de 24h a 48h úteis. Se tiver alguma dúvida, estamos por aqui para ajudar!",
    channel: "all",
    enabled: true,
  },
]

export function MessageTemplatesPopover({ channel, instanceName, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"templates" | "quick">("templates")
  const containerRef = useRef<HTMLDivElement>(null)

  // Estado para template seleccionado com variáveis
  const [pendingTemplate, setPendingTemplate] = useState<MessageTemplate | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})

  const { data: allTemplates = [], isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: listMessageTemplates,
    staleTime: 5 * 60_000,
  })

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
        setPendingTemplate(null)
        setVariableValues({})
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const combinedTemplates = (allTemplates.length > 0 ? allTemplates : []).concat(
    BUILT_IN_SNIPPETS.filter((b) => !allTemplates.some((t) => t.id === b.id)),
  )

  const filtered = combinedTemplates.filter((t) => {
    if (!t.enabled) return false
    const matchChannel = !channel || t.channel === "all" || t.channel === channel
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
    return matchChannel && matchSearch
  })

  const isMeta913 = instanceName === "hotelequip-913" || channel === "whatsapp_meta"

  function handleSelect(t: MessageTemplate) {
    // Se tem variáveis, pedir valores antes de inserir
    if (t.variables && t.variables.length > 0) {
      setPendingTemplate(t)
      setVariableValues({})
      return
    }
    // Sem variáveis — inserir directamente
    insertTemplate(t, {})
  }

  function insertTemplate(t: MessageTemplate, values: Record<string, string>) {
    let finalContent = t.content

    // Substituir variáveis
    if (t.variables && t.variables.length > 0) {
      finalContent = interpolateVariables(finalContent, values, t.variables)
    }

    // Botões: para 916/918 (Evolution), adicionar como texto numerado
    // Para 913 (Meta), enviar como texto simples por agora (interactive não implementado no proxy)
    if (t.buttons && t.buttons.length > 0) {
      finalContent += buttonsAsText(t.buttons)
    }

    onSelect(finalContent)
    setOpen(false)
    setSearch("")
    setPendingTemplate(null)
    setVariableValues({})
  }

  function handleConfirmVariables() {
    if (!pendingTemplate) return
    insertTemplate(pendingTemplate, variableValues)
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
          open
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-muted",
        )}
        title="Templates e respostas rápidas"
        aria-label="Templates de mensagem"
      >
        <FileText className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 z-50 w-80 rounded-2xl border border-border bg-card shadow-2xl">
          {/* Formulário de variáveis (quando template seleccionado precisa de dados) */}
          {pendingTemplate ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-foreground">{pendingTemplate.name}</h3>
                <button type="button" onClick={() => setPendingTemplate(null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Inputs para cada variável */}
              {pendingTemplate.variables!.map((varName) => (
                <div key={varName} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground capitalize">{varName.replace(/_/g, " ")}</label>
                  <input
                    type="text"
                    value={variableValues[varName] || ""}
                    onChange={(e) => setVariableValues((v) => ({ ...v, [varName]: e.target.value }))}
                    placeholder={`Valor para ${varName}`}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              ))}

              {/* Preview do conteúdo interpolado */}
              <div className="rounded-lg bg-muted p-2.5">
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {interpolateVariables(pendingTemplate.content, variableValues, pendingTemplate.variables!)}
                </p>
                {/* Preview de botões */}
                {pendingTemplate.buttons && pendingTemplate.buttons.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Botões:</p>
                    {pendingTemplate.buttons.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md bg-card border border-border px-2 py-1 text-xs">
                        <span className="text-muted-foreground">{b.type === "url" ? "🔗" : b.type === "phone_number" ? "📞" : "💬"}</span>
                        <span className="text-foreground">{b.text}</span>
                      </div>
                    ))}
                    {/* Aviso 913: botões interativos não suportados ainda */}
                    {isMeta913 && (
                      <div className="flex items-start gap-1.5 mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Botões interativos no 913 ainda não estão ligados ao proxy — o template será enviado como texto simples com os botões listados.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmVariables}
                className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Inserir no compositor
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-1 border-b border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => setTab("templates")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition",
                    tab === "templates"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <FileText className="mr-1 inline h-3 w-3" />
                  Templates
                </button>
                <button
                  type="button"
                  onClick={() => setTab("quick")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition",
                    tab === "quick"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Zap className="mr-1 inline h-3 w-3" />
                  Rápidas
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setSearch("") }}
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar template…"
                  autoFocus
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Lista */}
              <div className="max-h-60 overflow-y-auto py-1">
                {isLoading ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">A carregar…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    {allTemplates.length === 0
                      ? "Sem templates. Cria em Admin → Templates."
                      : "Sem resultados para a pesquisa."}
                  </p>
                ) : (
                  filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelect(t)}
                      className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {t.name}
                        </span>
                        {t.channel !== "all" && (
                          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {t.channel}
                          </span>
                        )}
                        {t.buttons && t.buttons.length > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                            {t.buttons.length} botão{t.buttons.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{t.content}</p>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground/60">
                Clica para inserir no compositor
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
