/**
 * Settings > Lead Capture Forms
 *
 * UI shadcn para gerir Web-to-Lead embeddable forms:
 *   - Lista de forms (cards)
 *   - Wizard 4 steps (Novo form)
 *   - Tab Submissoes (leads por source)
 *   - Modal "Copiar embed"
 */
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clipboard,
  Code,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FormInput,
  Loader2,
  Plus,
  Power,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  listLeadCaptureForms,
  createLeadCaptureForm,
  updateLeadCaptureForm,
  deleteLeadCaptureForm,
  listLeadsBySource,
  type LeadCaptureFormRow,
  type CreateLeadCaptureFormInput,
} from "@/integrations/directus/leadCaptureForms";
import { buildEmbedSnippets } from "@/services/leadCapture/embedSnippets";
import type { LeadField, LeadFieldType } from "@/services/leadCapture/renderForm";

const FIELD_TYPES: { value: LeadFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Telefone" },
  { value: "number", label: "Numero" },
  { value: "textarea", label: "Texto longo" },
  { value: "select", label: "Lista" },
  { value: "url", label: "URL" },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

type WizardState = {
  step: 1 | 2 | 3 | 4;
  name: string;
  slug: string;
  source_label: string;
  description: string;
  fields: LeadField[];
  success_message: string;
  redirect_url: string;
  notification_email: string;
  webhook_url: string;
  assign_to_employee_id: string;
};

function emptyWizard(): WizardState {
  return {
    step: 1,
    name: "",
    slug: "",
    source_label: "Web Form",
    description: "",
    fields: [
      { name: "name", label: "Nome", type: "text", required: true, placeholder: "O seu nome" },
      { name: "email", label: "Email", type: "email", required: true, placeholder: "email@exemplo.pt" },
      { name: "phone", label: "Telefone", type: "tel", required: false, placeholder: "+351 ..." },
      { name: "message", label: "Mensagem", type: "textarea", required: false, placeholder: "Como podemos ajudar?" },
    ],
    success_message: "Obrigado! Entraremos em contacto em breve.",
    redirect_url: "",
    notification_email: "",
    webhook_url: "",
    assign_to_employee_id: "",
  };
}

export default function LeadCaptureFormsSettings() {
  const [forms, setForms] = useState<LeadCaptureFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"forms" | "submissions">("forms");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [w, setW] = useState<WizardState>(emptyWizard());
  const [submitting, setSubmitting] = useState(false);

  const [embedTarget, setEmbedTarget] = useState<LeadCaptureFormRow | null>(null);
  const [embedKind, setEmbedKind] = useState<"html" | "iframe">("html");

  const [submissions, setSubmissions] = useState<Array<{ id: string; display_name?: string | null; email?: string | null; phone?: string | null; date_created?: string | null }>>([]);
  const [submissionsSource, setSubmissionsSource] = useState<string | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function reload() {
    setLoading(true);
    try {
      const rows = await listLeadCaptureForms();
      setForms(rows);
    } catch (e: any) {
      toast({ title: "Erro a carregar forms", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function loadSubmissions(source: string) {
    setSubmissionsSource(source);
    setActiveTab("submissions");
    setSubmissionsLoading(true);
    try {
      const rows = await listLeadsBySource(source);
      setSubmissions(rows);
    } catch (e: any) {
      toast({ title: "Erro a carregar submissoes", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSubmissionsLoading(false);
    }
  }

  function openWizard() {
    setW(emptyWizard());
    setWizardOpen(true);
  }

  function setFieldAt(idx: number, patch: Partial<LeadField>) {
    setW((cur) => {
      const fields = cur.fields.slice();
      fields[idx] = { ...fields[idx], ...patch };
      return { ...cur, fields };
    });
  }

  function addField() {
    setW((cur) => ({
      ...cur,
      fields: [...cur.fields, { name: `field_${cur.fields.length + 1}`, label: "Novo campo", type: "text", required: false }],
    }));
  }

  function removeField(idx: number) {
    setW((cur) => ({ ...cur, fields: cur.fields.filter((_, i) => i !== idx) }));
  }

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    setW((cur) => {
      const fields = Array.from(cur.fields);
      const [moved] = fields.splice(r.source.index, 1);
      fields.splice(r.destination!.index, 0, moved);
      return { ...cur, fields };
    });
  }

  function validateStep(step: WizardState["step"]): string | null {
    if (step === 1) {
      if (!w.name.trim()) return "Nome obrigatorio";
      if (!w.slug.trim()) return "Slug obrigatorio";
      if (!w.source_label.trim()) return "source_label obrigatorio";
    }
    if (step === 2) {
      if (!w.fields.length) return "Adicione pelo menos 1 campo";
      const names = new Set<string>();
      for (const f of w.fields) {
        if (!f.name?.trim()) return "Todos os campos precisam de um `name`";
        if (names.has(f.name)) return `Nome duplicado: ${f.name}`;
        names.add(f.name);
      }
    }
    if (step === 3) {
      if (!w.success_message.trim()) return "Mensagem de sucesso obrigatoria";
    }
    return null;
  }

  async function saveWizard() {
    const err = validateStep(3);
    if (err) {
      toast({ title: "Verifique o formulario", description: err, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateLeadCaptureFormInput = {
        name: w.name.trim(),
        slug: w.slug.trim(),
        source_label: w.source_label.trim(),
        description: w.description.trim() || null,
        fields: w.fields,
        success_message: w.success_message.trim(),
        redirect_url: w.redirect_url.trim() || null,
        notification_email: w.notification_email.trim() || null,
        webhook_url: w.webhook_url.trim() || null,
        assign_to_employee_id: w.assign_to_employee_id.trim() || null,
        is_active: true,
      };
      const created = await createLeadCaptureForm(payload);

      const snippets = buildEmbedSnippets(
        {
          id: created.id,
          name: created.name,
          slug: created.slug,
          source_label: created.source_label,
          success_message: created.success_message,
          redirect_url: created.redirect_url,
          fields: created.fields,
          is_active: created.is_active ?? true,
        },
        { origin }
      );
      await updateLeadCaptureForm(created.id, {
        embed_code_html: snippets.html,
        embed_code_iframe: snippets.iframe,
      });

      toast({ title: "Form criado", description: `Slug: /c/${created.slug}` });
      setWizardOpen(false);
      await reload();
    } catch (e: any) {
      toast({ title: "Erro a guardar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: LeadCaptureFormRow) {
    try {
      await updateLeadCaptureForm(row.id, { is_active: !(row.is_active ?? true) });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    }
  }

  async function removeRow(row: LeadCaptureFormRow) {
    if (!confirm(`Apagar form "${row.name}"? Esta acao nao pode ser revertida.`)) return;
    try {
      await deleteLeadCaptureForm(row.id);
      toast({ title: "Form removido" });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || String(e), variant: "destructive" });
    }
  }

  const embedSnippets = useMemo(() => {
    if (!embedTarget) return null;
    return buildEmbedSnippets(
      {
        id: embedTarget.id,
        name: embedTarget.name,
        slug: embedTarget.slug,
        source_label: embedTarget.source_label,
        success_message: embedTarget.success_message,
        redirect_url: embedTarget.redirect_url,
        fields: embedTarget.fields,
        is_active: embedTarget.is_active ?? true,
      },
      { origin }
    );
  }, [embedTarget, origin]);

  function copyToClipboard(text: string, label: string) {
    try {
      navigator.clipboard.writeText(text);
      toast({ title: `${label} copiado` });
    } catch {
      toast({ title: "Nao foi possivel copiar", variant: "destructive" });
    }
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-3 sm:p-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FormInput className="h-6 w-6" /> Web-to-Lead
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Forms embeddable que criam leads automaticamente. Cada submissao gera um lead em /leads com o source do form.
            </p>
          </div>
          <Button onClick={openWizard} className="gap-2">
            <Plus className="h-4 w-4" /> Novo form
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="submissions">
              Submissoes{submissionsSource ? ` (${submissionsSource})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forms">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : forms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FormInput className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4 max-w-md">
                    Sem forms. Crie o seu primeiro form embeddable para captar leads directamente do seu site.
                  </p>
                  <Button onClick={openWizard} className="gap-2">
                    <Plus className="h-4 w-4" /> Criar primeiro form
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forms.map((row) => (
                  <Card key={row.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{row.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            slug: <code className="text-[11px]">/c/{row.slug}</code>
                          </CardDescription>
                        </div>
                        <Badge variant={row.is_active ? "default" : "secondary"}>
                          {row.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Source: <code>{row.source_label}</code></span>
                        <span>{row.submit_count ?? 0} submissoes</span>
                      </div>
                      {row.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{row.description}</p>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-wrap gap-2 pt-3">
                      <Button size="sm" variant="outline" asChild className="gap-1">
                        <a href={`/c/${row.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setEmbedTarget(row);
                          setEmbedKind("html");
                        }}
                      >
                        <Code className="h-3 w-3" /> Embed
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => loadSubmissions(row.source_label)}>
                        <Eye className="h-3 w-3" /> Submissoes
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => toggleActive(row)}>
                        <Power className="h-3 w-3" /> {row.is_active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1 text-red-600" onClick={() => removeRow(row)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Submissoes{submissionsSource ? <> para <code>{submissionsSource}</code></> : null}
                </CardTitle>
                <CardDescription>
                  Leads criados por este source_label. Clique em "Submissoes" num card de form para filtrar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submissionsLoading ? (
                  <div className="flex justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {submissionsSource ? "Ainda nao ha submissoes para este source." : "Selecione um form para ver as submissoes."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.display_name || "(sem nome)"}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.email || s.phone || "(sem contacto)"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.date_created ? new Date(s.date_created).toLocaleString("pt-PT") : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Wizard dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo form de captura</DialogTitle>
            <DialogDescription>
              Step {w.step} de 4
            </DialogDescription>
          </DialogHeader>

          {w.step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="w-name">Nome interno</Label>
                <Input
                  id="w-name"
                  value={w.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setW((cur) => ({ ...cur, name: v, slug: cur.slug || slugify(v) }));
                  }}
                  placeholder="Ex: Contacto Hotel"
                />
              </div>
              <div>
                <Label htmlFor="w-slug">Slug (URL publica)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">/c/</span>
                  <Input
                    id="w-slug"
                    value={w.slug}
                    onChange={(e) => setW((cur) => ({ ...cur, slug: slugify(e.target.value) }))}
                    placeholder="contacto-hotel"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas letras minusculas, numeros e hifens.
                </p>
              </div>
              <div>
                <Label htmlFor="w-source">source_label (vai para leads.source)</Label>
                <Input
                  id="w-source"
                  value={w.source_label}
                  onChange={(e) => setW((cur) => ({ ...cur, source_label: e.target.value }))}
                  placeholder="Ex: Web Chat, Landing Page X"
                />
              </div>
              <div>
                <Label htmlFor="w-desc">Descricao (opcional)</Label>
                <Textarea
                  id="w-desc"
                  value={w.description}
                  onChange={(e) => setW((cur) => ({ ...cur, description: e.target.value }))}
                  placeholder="Para que serve este form?"
                  rows={2}
                />
              </div>
            </div>
          )}

          {w.step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Arraste para reordenar. Os campos aparecem no form pela ordem definida.
                </p>
                <Button size="sm" variant="outline" onClick={addField} className="gap-1">
                  <Plus className="h-3 w-3" /> Campo
                </Button>
              </div>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="fields">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {w.fields.map((f, idx) => (
                        <Draggable key={`${idx}-${f.name}`} draggableId={`${idx}-${f.name}`} index={idx}>
                          {(prov) => (
                            <div ref={prov.innerRef} {...prov.draggableProps} className="border rounded-md p-3 bg-card flex flex-wrap items-center gap-2">
                              <div {...prov.dragHandleProps} className="cursor-grab text-muted-foreground text-xs select-none">
                                :::
                              </div>
                              <div className="flex-1 min-w-[140px]">
                                <Input
                                  value={f.name}
                                  onChange={(e) => setFieldAt(idx, { name: slugify(e.target.value) })}
                                  placeholder="name"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="flex-1 min-w-[160px]">
                                <Input
                                  value={f.label}
                                  onChange={(e) => setFieldAt(idx, { label: e.target.value })}
                                  placeholder="Label"
                                  className="h-8 text-xs"
                                />
                              </div>
                              <div className="w-[120px]">
                                <select
                                  className="h-8 text-xs rounded-md border bg-background px-2 w-full"
                                  value={f.type}
                                  onChange={(e) => setFieldAt(idx, { type: e.target.value as LeadFieldType })}
                                >
                                  {FIELD_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </div>
                              <label className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={!!f.required}
                                  onChange={(e) => setFieldAt(idx, { required: e.target.checked })}
                                />
                                Obrig.
                              </label>
                              <Button size="icon" variant="ghost" onClick={() => removeField(idx)} className="h-7 w-7">
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
              {f.type === "select" as any /* keep TS happy */ && null}
            </div>
          )}

          {w.step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="w-success">Mensagem de sucesso</Label>
                <Textarea
                  id="w-success"
                  rows={2}
                  value={w.success_message}
                  onChange={(e) => setW((cur) => ({ ...cur, success_message: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="w-redirect">Redirect URL (opcional)</Label>
                <Input
                  id="w-redirect"
                  type="url"
                  value={w.redirect_url}
                  onChange={(e) => setW((cur) => ({ ...cur, redirect_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="w-email">Email de notificacao (opcional)</Label>
                <Input
                  id="w-email"
                  type="email"
                  value={w.notification_email}
                  onChange={(e) => setW((cur) => ({ ...cur, notification_email: e.target.value }))}
                  placeholder="vendas@empresa.pt"
                />
              </div>
              <div>
                <Label htmlFor="w-webhook">Webhook URL (opcional)</Label>
                <Input
                  id="w-webhook"
                  type="url"
                  value={w.webhook_url}
                  onChange={(e) => setW((cur) => ({ ...cur, webhook_url: e.target.value }))}
                  placeholder="https://hooks.zapier.com/..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Disparamos um POST com {`{ event, lead_id, form, data, assigned_to }`}.
                </p>
              </div>
            </div>
          )}

          {w.step === 4 && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium mb-1">Tudo pronto.</p>
                <p className="text-muted-foreground text-xs">
                  Apos guardar, o form fica disponivel em <code>/c/{w.slug || "..."}</code> e os snippets de embed ficam guardados.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2">
            <Button variant="ghost" disabled={w.step === 1 || submitting} onClick={() => setW((c) => ({ ...c, step: (c.step - 1) as 1 | 2 | 3 | 4 }))}>
              <ArrowDown className="h-4 w-4 mr-1 rotate-90" /> Anterior
            </Button>
            <div className="flex items-center gap-2">
              {w.step < 4 ? (
                <Button
                  onClick={() => {
                    const err = validateStep(w.step);
                    if (err) {
                      toast({ title: "Verifique o formulario", description: err, variant: "destructive" });
                      return;
                    }
                    setW((c) => ({ ...c, step: (c.step + 1) as 1 | 2 | 3 | 4 }));
                  }}
                  className="gap-1"
                >
                  Proximo <ArrowUp className="h-4 w-4 ml-1 rotate-90" />
                </Button>
              ) : (
                <Button onClick={saveWizard} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embed modal */}
      <Dialog open={!!embedTarget} onOpenChange={(o) => !o && setEmbedTarget(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Embed de {embedTarget?.name}</DialogTitle>
            <DialogDescription>
              Escolha HTML inline ou iframe. Cole no seu site, WordPress, Wix, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button size="sm" variant={embedKind === "html" ? "default" : "outline"} onClick={() => setEmbedKind("html")}>
              HTML inline
            </Button>
            <Button size="sm" variant={embedKind === "iframe" ? "default" : "outline"} onClick={() => setEmbedKind("iframe")}>
              iframe
            </Button>
            {embedSnippets && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                onClick={() => copyToClipboard(embedKind === "html" ? embedSnippets.html : embedSnippets.iframe, "Embed")}
              >
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            )}
          </div>
          {embedSnippets && (
            <pre className="text-[11px] leading-snug bg-slate-950 text-slate-100 rounded-md p-3 overflow-x-auto max-h-[420px]">
              <code>{embedKind === "html" ? embedSnippets.html : embedSnippets.iframe}</code>
            </pre>
          )}
          {embedSnippets && (
            <div className="text-xs text-muted-foreground">
              URL publica: <code>{embedSnippets.publicUrl}</code>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
