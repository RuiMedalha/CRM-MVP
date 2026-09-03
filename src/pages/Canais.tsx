import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, X, Cable, Loader2 } from "lucide-react";
import * as Icons from "lucide-react";
import {
  listIntegrations, createIntegration, updateIntegration, deleteIntegration,
  STATUS_LABEL, STATUS_TINT, CATEGORY_LABEL,
  type IntegrationRow, type IntegrationStatus, type IntegrationCategory,
} from "@/integrations/directus/integrationsSystem";

/**
 * Sistema de Canais — página genérica.
 * Nenhum canal está escrito no código; tudo vem da coleção `integrations`.
 * Admin pode editar, criar ou remover canais aqui, sem deploy.
 */

const STATUSES: IntegrationStatus[] = ["connected", "configurable", "planned"];
const CATEGORIES: IntegrationCategory[] = ["mensagens", "redes_sociais", "outros"];

function DynIcon({ name }: { name: string | null }) {
  const Ic = (name && (Icons as any)[name]) || Cable;
  return <Ic className="h-5 w-5" />;
}

export default function Canais() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Partial<IntegrationRow>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setRows(await listIntegrations());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const g: Record<IntegrationCategory, IntegrationRow[]> = { mensagens: [], redes_sociais: [], outros: [] };
    for (const r of rows) (g[r.category] ?? g.outros).push(r);
    return g;
  }, [rows]);

  const startEdit = (row?: IntegrationRow) => {
    if (row) {
      setEditingId(row.id);
      setDraft(row);
    } else {
      setEditingId("new");
      setDraft({ category: "mensagens", status: "planned", active: true, sort: rows.length });
    }
  };

  const cancelEdit = () => { setEditingId(null); setDraft({}); };

  const save = async () => {
    if (!draft.key || !draft.label) {
      toast({ title: "Chave e nome são obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        await createIntegration(draft as Omit<IntegrationRow, "id">);
        toast({ title: "Canal criado" });
      } else if (typeof editingId === "number") {
        await updateIntegration(editingId, draft);
        toast({ title: "Canal actualizado" });
      }
      cancelEdit();
      await load();
    } catch {
      toast({ title: "Falha ao gravar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: IntegrationRow) => {
    if (!confirm(`Remover "${row.label}"?`)) return;
    try {
      await deleteIntegration(row.id);
      toast({ title: "Canal removido" });
      await load();
    } catch {
      toast({ title: "Falha ao remover", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cable className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Canais</h1>
          </div>
          <Button size="sm" onClick={() => startEdit()}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo canal
          </Button>
        </header>
        <p className="text-sm text-muted-foreground">
          Sistema de canais de comunicação — cada canal é um registo editável, não código fixo.
          Estados: <Badge variant="secondary" className={STATUS_TINT.connected}>Ligado</Badge>{" "}
          <Badge variant="secondary" className={STATUS_TINT.configurable}>Configurável</Badge>{" "}
          <Badge variant="secondary" className={STATUS_TINT.planned}>Planeado</Badge>
        </p>

        {editingId === "new" && (
          <EditCard draft={draft} setDraft={setDraft} onSave={save} onCancel={cancelEdit} saving={saving} isNew />
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : (
          CATEGORIES.map((cat) => grouped[cat]?.length ? (
            <div key={cat} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">{CATEGORY_LABEL[cat]}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {grouped[cat].map((row) =>
                  editingId === row.id ? (
                    <EditCard key={row.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancelEdit} saving={saving} />
                  ) : (
                    <Card key={row.id}>
                      <CardContent className="flex items-start justify-between gap-3 p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-primary/10 p-2 text-primary"><DynIcon name={row.icon} /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{row.label}</span>
                              <Badge variant="secondary" className={STATUS_TINT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                            </div>
                            {row.notes && <p className="mt-0.5 text-xs text-muted-foreground">{row.notes}</p>}
                            {row.health_note && <p className="mt-0.5 text-xs text-primary">{row.health_note}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(row)} className="rounded p-1 text-muted-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(row)} className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </div>
          ) : null)
        )}
      </div>
    </AppLayout>
  );
}

function EditCard({
  draft, setDraft, onSave, onCancel, saving, isNew,
}: {
  draft: Partial<IntegrationRow>;
  setDraft: (d: Partial<IntegrationRow>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const set = (k: keyof IntegrationRow, v: any) => setDraft({ ...draft, [k]: v });
  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="chave (ex: whatsapp_918)" value={draft.key ?? ""} onChange={(e) => set("key", e.target.value)} disabled={!isNew} />
          <Input placeholder="Nome" value={draft.label ?? ""} onChange={(e) => set("label", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select className="rounded-md border border-input px-2 py-1.5 text-sm" value={draft.category ?? "mensagens"} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <select className="rounded-md border border-input px-2 py-1.5 text-sm" value={draft.status ?? "planned"} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Input placeholder="ícone (lucide, ex: Mail)" value={draft.icon ?? ""} onChange={(e) => set("icon", e.target.value)} />
        </div>
        <Input placeholder="credencial n8n (ex: Directus n8n-automation)" value={draft.credential_ref ?? ""} onChange={(e) => set("credential_ref", e.target.value)} />
        <Input placeholder="webhook URL (opcional)" value={draft.webhook_url ?? ""} onChange={(e) => set("webhook_url", e.target.value)} />
        <Textarea placeholder="Notas" value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} />
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}><X className="mr-1 h-3.5 w-3.5" />Cancelar</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
