/**
 * Painel 360 lateral do Telecof — replica o comportamento do HubChat:
 * - CHAMADA: dados da chamada + tags
 * - CONTACTO CRM: lookup automático pelo telefone (read-only)
 * - DADOS DO CLIENTE: campos editáveis + Guardar / Criar contacto
 * - NOTAS: histórico + textarea para nova nota
 * - AÇÕES: Marcar tratada, Abrir CRM, etc.
 */
import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Link as LinkIcon, Loader2, Save } from "lucide-react"
import { Link } from "react-router-dom"

import { DIRECTUS_URL } from "@/integrations/directus/client"
import { patchHubCommunicationEvent } from "@/integrations/directus/hubCommunicationEvents"
import { crmDashboard360UrlForCall } from "@/lib/crmUrls"
import { getTelecofHubNotes, getTelecofHubTags, type TelecofAttendanceTag } from "@/lib/telecofHubData"
import { operationalStatusLabel } from "@/lib/telecofQueue"

import { listContacts, createContact, getContactById, patchContact } from "@/integrations/directus/contacts"
import { createFollowUp } from "@/integrations/directus/follow-ups"
import type { ContactItem } from "@/integrations/directus/contacts"

import { useTelecofCallStore } from "@/store/telecofCallStore"
import { TelecofHubTags, TelecofTagPicker } from "./TelecofHubTags"

import type { TelecofCallEventRecord } from "@/types/telecof"

function InfoRow({
  label,
  value,
  children,
}: {
  label: string
  value?: string | number | null
  children?: React.ReactNode
}) {
  const display =
    children ?? (value === undefined || value === null || value === "" ? "—" : String(value))
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="break-all text-right text-foreground">{display}</span>
    </div>
  )
}

function EditField({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
      />
    </div>
  )
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })
}

interface Props {
  event: TelecofCallEventRecord
  variant?: "sidebar" | "sheet" | "inline"
}

export function TelecofCustomerPanel({ event: eventProp, variant = "sidebar" }: Props) {
  const event =
    useTelecofCallStore((s) => s.events.find((e) => e.id === eventProp.id)) ?? eventProp
  const mergeEvent = useTelecofCallStore((s) => s.mergeEvent)
  const qc = useQueryClient()

  const [attendanceNote, setAttendanceNote] = useState("")
  const [hubTags, setHubTags] = useState<TelecofAttendanceTag[]>(() => getTelecofHubTags(event))
  const [saving, setSaving] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpNote, setFollowUpNote] = useState("")
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const loadedRef = useRef<string | undefined>(undefined)

  // Form DADOS DO CLIENTE
  const [form, setForm] = useState({
    contact_name: "",
    company_name: "",
    email: "",
    phone: "",
    nif: "",
    classification: "cliente",
    call_reason: "",
  })
  const [formDirty, setFormDirty] = useState(false)

  function setField(k: keyof typeof form, v: string) {
    setForm((p) => ({ ...p, [k]: v }))
    setFormDirty(true)
  }

  // Lookup contacto CRM pelo telefone
  const phone = event.normalizedPhone || event.phone
  const { data: crmContactById = null } = useQuery({
    queryKey: ["telecof-contact-id", event.contactId],
    queryFn: () => getContactById(event.contactId!),
    enabled: Boolean(event.contactId),
    staleTime: 60_000,
  })
  const { data: crmContacts = [] } = useQuery({
    queryKey: ["telecof-contact-lookup", phone],
    queryFn: () => listContacts({ search: phone, limit: 1 }),
    enabled: Boolean(phone && !event.contactId),
    staleTime: 60_000,
  })
  const crmContact: ContactItem | null = crmContactById ?? crmContacts[0] ?? null

  // Sincronizar form com contacto CRM encontrado
  useEffect(() => {
    if (loadedRef.current === event.id) return
    loadedRef.current = event.id
    setHubTags(getTelecofHubTags(event))
    setAttendanceNote("")
    setFeedback(null)
    setFormDirty(false)
  }, [event.id])

  useEffect(() => {
    setHubTags(getTelecofHubTags(event))
  }, [event.rawPayload])

  useEffect(() => {
    if (crmContact) {
      setForm({
        contact_name: crmContact.contact_name ?? "",
        company_name: crmContact.company_name ?? "",
        email: crmContact.email ?? "",
        phone: crmContact.phone ?? phone ?? "",
        nif: crmContact.nif ?? "",
        classification: (Array.isArray((crmContact as Record<string, unknown>).roles) ? ((crmContact as Record<string, unknown>).roles as string[])[0] : "cliente") || "cliente",
      })
      setFormDirty(false)
    } else {
      // Pré-preencher com dados da chamada
      const auto = event.customerName?.trim()
      const nameIsPhone = auto === phone || /^\+?\d[\d\s\-]{6,}$/.test(auto || "")
      setForm({
        contact_name: nameIsPhone ? "" : (auto ?? ""),
        company_name: "",
        email: "",
        phone: phone ?? "",
        nif: "",
        classification: "cliente",
      })
      setFormDirty(false)
    }
  }, [crmContact?.id, phone, event.customerName])

  function showFeedback(type: "success" | "error", message: string) {
    setFeedback({ type, message })
    window.setTimeout(() => setFeedback(null), 3500)
  }

  async function handleSaveNote() {
    const text = attendanceNote.trim()
    if (!text || !DIRECTUS_URL) return
    setSaving(true)
    try {
      const existingNotes = getTelecofHubNotes(event)
      const newNote = {
        id: crypto.randomUUID(),
        text,
        at: new Date().toISOString(),
        by: "Agente",
      }
      const nextPayload = { ...(event.rawPayload ?? {}), hub_notes: [...existingNotes, newNote] }
      const updated = await patchHubCommunicationEvent(event.id, { raw_payload: nextPayload })
      mergeEvent(updated)
      setAttendanceNote("")
      showFeedback("success", "Nota guardada.")
    } catch {
      showFeedback("error", "Não foi possível guardar a nota.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleTag(tag: TelecofAttendanceTag) {
    if (!DIRECTUS_URL) return
    const next = hubTags.includes(tag) ? hubTags.filter((t) => t !== tag) : [...hubTags, tag]
    setHubTags(next)
    try {
      const nextPayload = { ...(event.rawPayload ?? {}), hub_tags: next }
      const updated = await patchHubCommunicationEvent(event.id, { raw_payload: nextPayload, customer_name: event.customerName })
      mergeEvent(updated)
    } catch {
      setHubTags(getTelecofHubTags(event))
      showFeedback("error", "Não foi possível atualizar tag.")
    }
  }

  async function handleMarkResolved() {
    if (!DIRECTUS_URL) return
    setSaving(true)
    try {
      const updated = await patchHubCommunicationEvent(event.id, {
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      mergeEvent(updated)
      showFeedback("success", "Chamada marcada como tratada.")
    } catch {
      showFeedback("error", "Não foi possível marcar como tratada.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveContact() {
    setSavingContact(true)
    try {
      if (crmContact) {
        await patchContact(String(crmContact.id), {
          contact_name: form.contact_name || undefined,
          company_name: form.company_name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          nif: form.nif || undefined,
        } as any)
        // Associar contacto ao evento se ainda não estiver
        if (!event.contactId) {
          // Preencher ambos contact_id (UUID) e contact_int_id (legacy integer)
          // para que a Customer360 Timeline encontre o evento.
          const intId = parseInt(String(crmContact.id).replace(/\D/g, ""), 10);
          const updated = await patchHubCommunicationEvent(event.id, {
            contact_id: String(crmContact.id),
            ...(Number.isFinite(intId) && intId > 0 ? { contact_int_id: intId } : {}),
          });
          mergeEvent(updated)
        }
        showFeedback("success", "Dados guardados.")
      } else {
        const newContact = await createContact({
          contact_name: form.contact_name || undefined,
          company_name: form.company_name || `Telecof — ${phone?.slice(-4)}`,
          email: form.email || undefined,
          phone: form.phone || phone,
          nif: form.nif || undefined,
          source: "telecof",
          roles: [form.classification || "cliente"],
        })
        // Preencher ambos contact_id (UUID) e contact_int_id (legacy integer)
        const newIntId = parseInt(String(newContact.id).replace(/\D/g, ""), 10);
        const updated = await patchHubCommunicationEvent(event.id, {
          contact_id: String(newContact.id),
          ...(Number.isFinite(newIntId) && newIntId > 0 ? { contact_int_id: newIntId } : {}),
        });
        mergeEvent(updated)
        showFeedback("success", "Contacto criado e associado.")
      }
      qc.invalidateQueries({ queryKey: ["telecof-contact-lookup", phone] })
      setFormDirty(false)
    } catch {
      showFeedback("error", "Erro ao guardar dados.")
    } finally {
      setSavingContact(false)
    }
  }

  async function handleSaveFollowUp() {
    if (!followUpDate) return
    setSavingFollowUp(true)
    try {
      const contactId = event.contactId || (crmContact ? String(crmContact.id) : undefined)
      await createFollowUp({
        contact_id: contactId || undefined,
        type: "call",
        status: "open",
        due_at: new Date(followUpDate).toISOString(),
        title: `Rechamar ${event.customerName || event.phone || "cliente"}`,
        notes: followUpNote || undefined,
      })
      setFollowUpDate("")
      setFollowUpNote("")
      showFeedback("success", "Follow-up agendado na Agenda.")
    } catch {
      showFeedback("error", "Erro ao agendar follow-up.")
    } finally {
      setSavingFollowUp(false)
    }
  }

  async function handleAssociateExisting() {
    // Abre o Dashboard360 para o utilizador associar manualmente
    window.open(crmDashboard360UrlForCall({ phone }), "_blank", "noopener,noreferrer")
  }

  function openCrm() {
    window.open(crmDashboard360UrlForCall({ phone: event.normalizedPhone || event.phone }), "_blank", "noopener,noreferrer")
  }

  const hubNotes = getTelecofHubNotes(event)

  const rootClass =
    variant === "sheet"
      ? "flex w-full flex-col overflow-y-auto bg-card"
      : variant === "inline"
        ? "flex w-full flex-col bg-card border-t border-border"
        : "hidden min-w-[18rem] max-w-[26rem] flex-[0_0_26%] shrink-0 flex-col overflow-y-auto border-l border-border bg-card md:flex"

  const contactUrl = crmContact ? `/customer360-shell/${encodeURIComponent(String(crmContact.id))}` : null

  return (
    <aside className={rootClass}>
      {/* Cabeçalho — oculto em inline (já existe no Workspace acima) */}
      {variant !== "inline" && (
        <div className="border-b border-primary/10 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Cliente 360 · Telecof</h2>
            {contactUrl && (
              <Link
                to={contactUrl}
                className="flex items-center gap-1 rounded-md border border-primary/20 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                title="Abrir CRM completo"
              >
                <ExternalLink className="h-3 w-3" />
                CRM
              </Link>
            )}
          </div>
          <p className="mt-0.5 text-xs text-primary">{operationalStatusLabel(event)}</p>
        </div>
      )}

      {/* Feedback toast (sempre visível) */}
      {feedback && (
        <div className="px-4 pt-3">
          <p className={`rounded-lg px-3 py-1.5 text-xs ${feedback.type === "success" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
            {feedback.message}
          </p>
        </div>
      )}

      {/* CHAMADA — oculto em inline (duplica Workspace) */}
      {variant !== "inline" && (
        <section className="space-y-2 border-b border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Chamada</h3>
            <TelecofHubTags event={{ ...event, rawPayload: { hub_tags: hubTags } }} />
          </div>
          <InfoRow label="Telefone" value={event.phone} />
          <InfoRow label="Agente" value={event.assignedTo} />
          <InfoRow label="Contacto associado">
            {crmContact ? (
              <Link
                to={`/customer360-shell/${encodeURIComponent(String(crmContact.id))}`}
                className="font-medium text-primary hover:underline"
              >
                {crmContact.company_name ?? crmContact.contact_name ?? String(crmContact.id)}
              </Link>
            ) : (
              <span className="text-muted-foreground text-xs italic">Sem contacto</span>
            )}
          </InfoRow>
          <InfoRow label="Data" value={formatDateTime(event.startedAt ?? event.createdAt)} />
          <InfoRow label="Estado" value={operationalStatusLabel(event)} />
        </section>
      )}

      {/* CONTACTO CRM — lookup read-only */}
      {crmContact && (
        <section className="space-y-2 border-b border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacto CRM</h3>
          <InfoRow label="Nome" value={crmContact.contact_name} />
          <InfoRow label="Email" value={crmContact.email} />
          <InfoRow label="Telefone" value={crmContact.phone} />
        </section>
      )}

      {/* DADOS DO CLIENTE — editáveis */}
      <section className="space-y-3 border-b border-border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dados do cliente
        </h3>
        <EditField label="Nome" id="tc-name" value={form.contact_name} onChange={(v) => setField("contact_name", v)} placeholder="Nome da pessoa" />
        <EditField label="Empresa" id="tc-company" value={form.company_name} onChange={(v) => setField("company_name", v)} placeholder="Nome da empresa" />
        <EditField label="Email" id="tc-email" type="email" value={form.email} onChange={(v) => setField("email", v)} placeholder="email@empresa.pt" />
        <EditField label="Telefone" id="tc-phone" value={form.phone} onChange={(v) => setField("phone", v)} placeholder="+351..." />
        <EditField label="NIF" id="tc-nif" value={form.nif} onChange={(v) => setField("nif", v)} placeholder="123456789" />

        {/* Motivo da chamada */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-muted-foreground">Motivo da chamada</label>
          <textarea
            rows={3}
            value={(form as Record<string, string>).call_reason || ""}
            onChange={(e) => setField("call_reason" as keyof typeof form, e.target.value)}
            placeholder="O que o cliente pretende? (orçamento, assistência, informação...)"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
        </div>

        {/* Acções rápidas */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button type="button" onClick={() => { if (form.phone || form.contact_name) window.location.href = `/propostas/nova?customer_id=&notes=${encodeURIComponent((form as Record<string, string>).call_reason || "Chamada")}&name=${encodeURIComponent(form.contact_name || form.company_name)}&phone=${encodeURIComponent(form.phone)}`; }} className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition">📄 Criar Proposta</button>
          <button type="button" onClick={() => { if (form.phone) window.location.href = `/comunicacoes?phone=${encodeURIComponent(form.phone)}`; }} className="rounded-md bg-green-50 border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition">💬 WhatsApp</button>
          <button type="button" onClick={() => { if (form.email) window.location.href = `mailto:${form.email}`; }} className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition">✉️ Email</button>
        </div>

        {/* Classificação */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Classificação</label>
          <div className="flex flex-wrap gap-1">
            {["cliente", "lead", "fornecedor", "assistencia"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setField("classification", role)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition ${
                  (form as Record<string, string>).classification === role
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {role === "cliente" ? "Cliente" : role === "lead" ? "Lead" : role === "fornecedor" ? "Fornecedor" : "Assistência"}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveContact()}
          disabled={savingContact || (!formDirty && !!crmContact)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          {savingContact ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {crmContact ? "Guardar dados" : "Criar contacto"}
        </button>

        {!crmContact && (
          <button
            type="button"
            onClick={() => void handleAssociateExisting()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <LinkIcon className="h-4 w-4" />
            Associar contacto existente
          </button>
        )}
      </section>

      {/* TAGS */}
      <section className="space-y-3 border-b border-border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags de atendimento</h3>
        <TelecofTagPicker activeTags={hubTags} disabled={saving} onToggle={(tag) => void handleToggleTag(tag)} />
      </section>

      {/* NOTAS */}
      <section className="space-y-3 border-b border-border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas do atendimento</h3>
        {hubNotes.length > 0 ? (
          <ul className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted p-2">
            {hubNotes.map((note) => (
              <li key={note.id} className="text-xs text-foreground">
                <p className="whitespace-pre-wrap">{note.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(note.at)}{note.by ? ` · ${note.by}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sem notas ainda.</p>
        )}
        <textarea
          value={attendanceNote}
          onChange={(e) => setAttendanceNote(e.target.value)}
          rows={3}
          placeholder="Nota interna deste atendimento…"
          className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          disabled={saving || !attendanceNote.trim()}
          onClick={() => void handleSaveNote()}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {saving ? "A guardar…" : "Guardar nota"}
        </button>
      </section>

      {/* FOLLOW-UP — Phase 3: secção visível por defeito no Telecof */}
      <section className="space-y-3 border-b border-border p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agendar follow-up</h3>
        <input
          type="datetime-local"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <textarea
          value={followUpNote}
          onChange={(e) => setFollowUpNote(e.target.value)}
          rows={2}
          placeholder="Nota do follow-up (opcional)…"
          className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          disabled={savingFollowUp || !followUpDate}
          onClick={() => void handleSaveFollowUp()}
          className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {savingFollowUp ? "A agendar…" : "📅 Agendar follow-up"}
        </button>
      </section>

      {/* AÇÕES */}
      <section className="space-y-2 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações</h3>
        {event.operationalStatus !== "resolved" && event.operationalStatus !== "treated" && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleMarkResolved()}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            Marcar como tratada
          </button>
        )}
        <button
          type="button"
          onClick={openCrm}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir CRM completo
        </button>
      </section>
    </aside>
  )
}
