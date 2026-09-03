import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import {
  createWhatsAppConversation,
  findWhatsAppConversationByNumber,
  HUB_DEFAULT_AGENT,
  normalizeWhatsAppNumber,
  type WhatsAppInstance,
} from "@/integrations/directus/hubConversations"
import {
  listApprovedTemplatesViaWA913,
  type WA913ApprovedTemplate,
  type WA913TemplateComponent,
} from "@/integrations/directus/wa913"
import {
  checkNumberViaEvolution,
  type EvolutionNumberCheck,
} from "@/integrations/evolution/client"
import { sendAgentMessage, sendAgentTemplateMessage } from "@/services/whatsappOutboundMessage"
import { useConversationStore } from "@/store/conversationStore"

import type { Conversation } from "@/types/conversation"

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado"
}

interface MetaTemplateVariable {
  key: string
  componentType: "header" | "body"
  token: string
}

function getPlaceholderTokens(text: string): string[] {
  return [...text.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
}

function getMetaTemplateVariables(template: WA913ApprovedTemplate | null): MetaTemplateVariable[] {
  if (!template) return []
  return template.components.flatMap((component) => {
    const type = component.type.toLowerCase()
    if (type !== "header" && type !== "body") return []
    return getPlaceholderTokens(component.text ?? "").map((token) => ({
      key: `${type}:${token}`,
      componentType: type,
      token,
    }))
  })
}

function isSupportedMetaTemplate(template: WA913ApprovedTemplate): boolean {
  return template.components.every((component) => {
    const type = component.type.toUpperCase()
    if (type === "HEADER" && component.format && component.format.toUpperCase() !== "TEXT") return false
    if (type === "BUTTONS" && JSON.stringify(component).includes("{{")) return false
    return true
  })
}

function interpolateMetaText(
  component: WA913TemplateComponent,
  values: Record<string, string>,
): string {
  const type = component.type.toLowerCase()
  return (component.text ?? "").replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, token: string) =>
    values[`${type}:${token}`] || `{{${token}}}`,
  )
}

function buildMetaTemplatePreview(
  template: WA913ApprovedTemplate,
  values: Record<string, string>,
): string {
  const text = template.components
    .filter((component) => ["HEADER", "BODY", "FOOTER"].includes(component.type.toUpperCase()))
    .map((component) => interpolateMetaText(component, values))
    .filter(Boolean)
  const buttons = template.components
    .filter((component) => component.type.toUpperCase() === "BUTTONS")
    .flatMap((component) => component.buttons ?? [])
    .map((button) => button.text)
  return [...text, ...buttons].join("\n\n")
}

function buildMetaTemplateComponents(
  template: WA913ApprovedTemplate,
  values: Record<string, string>,
): object[] {
  return template.components.flatMap((component) => {
    const type = component.type.toLowerCase()
    if (type !== "header" && type !== "body") return []
    const tokens = getPlaceholderTokens(component.text ?? "")
    if (tokens.length === 0) return []
    return [{
      type,
      parameters: tokens.map((token) => ({
        type: "text",
        ...(/^\d+$/.test(token) ? {} : { parameter_name: token }),
        text: values[`${type}:${token}`],
      })),
    }]
  })
}

export function NewConversationDialog({ open, onOpenChange }: NewConversationDialogProps) {
  const { user } = useAuth()
  const { conversations, setConversations, selectConversation } = useConversationStore()
  const [rawNumber, setRawNumber] = useState("")
  const [instanceName, setInstanceName] = useState<WhatsAppInstance | "">("")
  const [customerName, setCustomerName] = useState("")
  const [message, setMessage] = useState("")
  const [checking, setChecking] = useState(false)
  const [starting, setStarting] = useState(false)
  const [numberCheck, setNumberCheck] = useState<EvolutionNumberCheck | null>(null)
  const [metaTemplates, setMetaTemplates] = useState<WA913ApprovedTemplate[] | null>(null)
  const [selectedTemplateName, setSelectedTemplateName] = useState("")
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({})
  const [existingConversation, setExistingConversation] = useState<Conversation | null>(null)
  const [createdConversation, setCreatedConversation] = useState<Conversation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const e164 = normalizeWhatsAppNumber(rawNumber)
  const isMeta = instanceName === "hotelequip-913"
  const supportedMetaTemplates = (metaTemplates ?? []).filter(isSupportedMetaTemplate)
  const selectedMetaTemplate = supportedMetaTemplates.find((template) =>
    `${template.name}:${template.language}` === selectedTemplateName,
  ) ?? null
  const metaVariables = getMetaTemplateVariables(selectedMetaTemplate)
  const templateValuesComplete = metaVariables.every((variable) => templateValues[variable.key]?.trim())
  const verified = isMeta
    ? Boolean(metaTemplates && metaTemplates.length > 0 && !existingConversation)
    : Boolean(numberCheck?.ok && numberCheck.exists && !existingConversation)

  function resetState() {
    setRawNumber("")
    setInstanceName("")
    setCustomerName("")
    setMessage("")
    setChecking(false)
    setStarting(false)
    setNumberCheck(null)
    setMetaTemplates(null)
    setSelectedTemplateName("")
    setTemplateValues({})
    setExistingConversation(null)
    setCreatedConversation(null)
    setError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  function resetVerification() {
    setNumberCheck(null)
    setMetaTemplates(null)
    setSelectedTemplateName("")
    setTemplateValues({})
    setExistingConversation(null)
    setCreatedConversation(null)
    setError(null)
  }

  async function handleCheckNumber() {
    if (!e164 || !instanceName) return

    setChecking(true)
    setNumberCheck(null)
    setMetaTemplates(null)
    setSelectedTemplateName("")
    setTemplateValues({})
    setExistingConversation(null)
    setCreatedConversation(null)
    setError(null)

    try {
      if (instanceName === "hotelequip-913") {
        const [templates, existing] = await Promise.all([
          listApprovedTemplatesViaWA913(),
          findWhatsAppConversationByNumber(e164, instanceName),
        ])
        setMetaTemplates(templates)
        setExistingConversation(existing)
        if (!existing && templates.length === 0) {
          setError("A conta Meta não tem templates aprovados disponíveis")
        } else if (!existing && templates.every((template) => !isSupportedMetaTemplate(template))) {
          setError("Os templates aprovados exigem media ou botões dinâmicos ainda não suportados")
        }
        return
      }

      const [check, existing] = await Promise.all([
        checkNumberViaEvolution(e164, instanceName),
        findWhatsAppConversationByNumber(e164, instanceName),
      ])
      setNumberCheck(check)
      setExistingConversation(existing)
      if (!existing && check.ok && check.exists && check.profileName && !customerName.trim()) {
        setCustomerName(check.profileName)
      }
      if (!existing && !check.ok) {
        setError("Não foi possível verificar o número no WhatsApp")
      }
    } catch (checkError) {
      setError(getErrorMessage(checkError))
    } finally {
      setChecking(false)
    }
  }

  function handleOpenConversation(conversation: Conversation) {
    selectConversation(conversation.id)
    handleOpenChange(false)
  }

  async function handleStartConversation() {
    const trimmedMessage = message.trim()
    if (!e164 || !instanceName || !verified) return
    if (isMeta && (!selectedMetaTemplate || !templateValuesComplete)) return
    if (!isMeta && !trimmedMessage) return

    setStarting(true)
    setError(null)
    let conversation: Conversation | null = null

    try {
      conversation = await createWhatsAppConversation({
        e164,
        customerName: customerName.trim(),
        instanceName,
      })
      setConversations([conversation, ...conversations])
      selectConversation(conversation.id)
      const result = isMeta && selectedMetaTemplate
        ? await sendAgentTemplateMessage(
            conversation,
            {
              name: selectedMetaTemplate.name,
              language: selectedMetaTemplate.language,
              components: buildMetaTemplateComponents(selectedMetaTemplate, templateValues),
              preview: buildMetaTemplatePreview(selectedMetaTemplate, templateValues),
            },
            user?.id ?? HUB_DEFAULT_AGENT,
          )
        : await sendAgentMessage(
            conversation,
            trimmedMessage,
            user?.id ?? HUB_DEFAULT_AGENT,
          )
      if (!result.evolution.ok && !result.evolution.skipped) {
        throw new Error(result.evolution.reason || "Falha ao enviar a primeira mensagem")
      }
      handleOpenChange(false)
    } catch (startError) {
      if (conversation) setCreatedConversation(conversation)
      setError(getErrorMessage(startError))
    } finally {
      setStarting(false)
    }
  }

  const conversationToOpen = existingConversation ?? createdConversation

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova conversa WhatsApp</DialogTitle>
          <DialogDescription>
            Verifique o número e escolha a linha antes de enviar a primeira mensagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-conversation-number">Número</Label>
            <Input
              id="new-conversation-number"
              type="text"
              inputMode="tel"
              placeholder="912 345 678"
              value={rawNumber}
              onChange={(event) => {
                setRawNumber(event.target.value)
                resetVerification()
              }}
            />
            <p className={`text-xs ${e164 ? "text-muted-foreground" : "text-destructive"}`}>
              {e164 ? `E.164: ${e164}` : "Número inválido"}
            </p>
          </div>

          <fieldset className="space-y-2" disabled={!e164}>
            <legend className="text-sm font-medium">Instância</legend>
            <div className="space-y-2">
              {([
                ["hotelequip-916", "916 · Comercial"],
                ["hotelequip-918", "918 · Apoio"],
                ["hotelequip-913", "913 · Oficial (WABA)"],
              ] as const).map(([value, label]) => (
                <Label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2"
                >
                  <input
                    type="radio"
                    name="whatsapp-instance"
                    value={value}
                    checked={instanceName === value}
                    onChange={() => {
                      setInstanceName(value)
                      resetVerification()
                    }}
                  />
                  <span>
                    <span className="block">{label}</span>
                    {value === "hotelequip-913" && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        Primeiro contacto apenas com template aprovado
                      </span>
                    )}
                  </span>
                </Label>
              ))}
            </div>
          </fieldset>

          {existingConversation && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Já existe uma conversa WhatsApp para este número nesta instância.
            </p>
          )}

          {!existingConversation && numberCheck?.ok && !numberCheck.exists && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              Este número não tem WhatsApp
            </p>
          )}

          {!existingConversation && numberCheck?.ok && numberCheck.exists && (
            <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
              Número verificado{numberCheck.profileName ? ` · ${numberCheck.profileName}` : ""}
            </p>
          )}

          {!existingConversation && isMeta && metaTemplates && metaTemplates.length > 0 && (
            <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
              {metaTemplates.length} template(s) aprovado(s) carregado(s) da Meta
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-conversation-name">Nome (opcional)</Label>
            <Input
              id="new-conversation-name"
              value={customerName}
              disabled={!e164}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>

          {isMeta ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-conversation-template">Template aprovado</Label>
                <select
                  id="new-conversation-template"
                  value={selectedTemplateName}
                  disabled={!metaTemplates || supportedMetaTemplates.length === 0}
                  onChange={(event) => {
                    setSelectedTemplateName(event.target.value)
                    setTemplateValues({})
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecionar template...</option>
                  {supportedMetaTemplates.map((template) => (
                    <option
                      key={`${template.name}:${template.language}`}
                      value={`${template.name}:${template.language}`}
                    >
                      {template.name} · {template.language} · {template.category}
                    </option>
                  ))}
                </select>
              </div>

              {metaVariables.map((variable) => (
                <div key={variable.key} className="space-y-2">
                  <Label htmlFor={`meta-variable-${variable.key}`}>
                    {variable.componentType === "header" ? "Cabeçalho" : "Mensagem"} · variável {variable.token.replace(/_/g, " ")}
                  </Label>
                  <Input
                    id={`meta-variable-${variable.key}`}
                    value={templateValues[variable.key] ?? ""}
                    onChange={(event) => setTemplateValues((current) => ({
                      ...current,
                      [variable.key]: event.target.value,
                    }))}
                  />
                </div>
              ))}

              {selectedMetaTemplate && (
                <div className="rounded-md border border-border bg-muted px-3 py-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização</p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {buildMetaTemplatePreview(selectedMetaTemplate, templateValues)}
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                A Meta não disponibiliza verificação prévia do número. O envio será confirmado pela resposta da Cloud API.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-conversation-message">Primeira mensagem</Label>
              <Textarea
                id="new-conversation-message"
                value={message}
                maxLength={1000}
                disabled={!e164}
                onChange={(event) => setMessage(event.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">{message.length}/1000</p>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          {conversationToOpen ? (
            <Button type="button" onClick={() => handleOpenConversation(conversationToOpen)}>
              {existingConversation ? "Abrir conversa existente" : "Abrir conversa criada"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={!e164 || !instanceName || checking || starting}
                onClick={() => { void handleCheckNumber() }}
              >
                {checking
                  ? (isMeta ? "A carregar..." : "A verificar...")
                  : (isMeta ? "Carregar templates" : "Verificar número")}
              </Button>
              <Button
                type="button"
                disabled={
                  !verified ||
                  checking ||
                  starting ||
                  (isMeta ? !selectedMetaTemplate || !templateValuesComplete : !message.trim())
                }
                onClick={() => { void handleStartConversation() }}
              >
                {starting ? "A iniciar..." : (isMeta ? "Iniciar com template" : "Iniciar conversa")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
