import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, ListChecks, ListTree, ArrowLeft, ChevronDown, ChevronRight, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getEntityFormConfig,
  getFieldOptions,
  updateFormConfigRow,
  createFieldOption,
  updateFieldOption,
  deleteFieldOption,
  distinctFieldKeys,
  distinctBlocks,
  upsertFieldConfig,
  type EntityFormConfigRow,
  type FieldOptionRow,
  type EntityConfigType,
} from "@/integrations/directus/entityFormConfig";

/** Campos reais (com input próprio no formulário) por bloco — espelha EditGeneralTab.tsx.
 *  Blocos sem entrada aqui só têm campos "Pendente de schema" (nada a ordenar). */
const REAL_FIELDS_BY_BLOCK: Record<string, { key: string; label: string }[]> = {
  "Dados Gerais": [
    { key: "company_name", label: "Nome / Nome da Empresa" },
    { key: "website", label: "Website" },
    { key: "source", label: "Origem" },
  ],
  "Dados Fiscais": [{ key: "nif", label: "NIF" }],
  "Contactos da Entidade": [
    { key: "phone", label: "Telefone" },
    { key: "email", label: "Email Geral" },
  ],
  "Moradas": [
    { key: "address", label: "Morada" },
    { key: "postal_code", label: "Código Postal" },
    { key: "city", label: "Cidade" },
    { key: "district", label: "Distrito" },
  ],
  "Comercial": [
    { key: "assigned_to", label: "Responsável Comercial" },
    { key: "segment", label: "Segmento" },
    { key: "business_type", label: "Tipo de Negócio" },
    { key: "source", label: "Origem" },
  ],
};

/**
 * Definições → Ficha de Cliente.
 * Editor visual da matriz de visibilidade (entity_form_config) e dos
 * dropdowns editáveis (field_options) que alimentam a Ficha e o drawer
 * de atendimento. Página nova e isolada — não altera Definicoes.tsx.
 */

const TYPES: { key: EntityConfigType; label: string }[] = [
  { key: "company_client", label: "Empresa · Cliente" },
  { key: "person_client", label: "Pessoa · Cliente" },
  { key: "supplier", label: "Fornecedor" },
  { key: "both", label: "Cliente + Fornecedor" },
  { key: "lead", label: "Lead" },
];

export default function FichaClienteConfig() {
  const [config, setConfig] = useState<EntityFormConfigRow[]>([]);
  const [options, setOptions] = useState<FieldOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<EntityConfigType>("company_client");

  const load = async () => {
    setLoading(true);
    const [c, o] = await Promise.all([getEntityFormConfig(), getFieldOptions()]);
    setConfig(c);
    setOptions(o);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const blocks = useMemo(() => distinctBlocks(config), [config]);

  const cell = (block: string, type: EntityConfigType) =>
    config.find((r) => r.block === block && r.entity_type === type);

  const toggleVisible = async (row: EntityFormConfigRow | undefined, block: string, type: EntityConfigType) => {
    if (!row) return; // linha não existe para esta combinação — não criamos aqui, evita inconsistência
    const key = `${block}-${type}-visible`;
    setSavingKey(key);
    const next = !row.visible;
    setConfig((prev) => prev.map((r) => (r.id === row.id ? { ...r, visible: next } : r)));
    try {
      await updateFormConfigRow(row.id, { visible: next });
    } catch {
      setConfig((prev) => prev.map((r) => (r.id === row.id ? { ...r, visible: !next } : r)));
      toast({ title: "Falha ao gravar", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const toggleRequired = async (row: EntityFormConfigRow | undefined) => {
    if (!row) return;
    const key = `${row.block}-${row.entity_type}-required`;
    setSavingKey(key);
    const next = !row.required;
    setConfig((prev) => prev.map((r) => (r.id === row.id ? { ...r, required: next } : r)));
    try {
      await updateFormConfigRow(row.id, { required: next });
    } catch {
      setConfig((prev) => prev.map((r) => (r.id === row.id ? { ...r, required: !next } : r)));
      toast({ title: "Falha ao gravar", variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-5 p-4">
        <header className="flex items-center gap-2">
          <Link to="/definicoes" className="rounded-md p-1.5 hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-semibold">Ficha de Cliente</h1>
        </header>
        <p className="text-sm text-muted-foreground">
          Escolhe que blocos aparecem em cada tipo de cliente e edita as opções dos dropdowns.
          As alterações aplicam-se de imediato na Ficha e no drawer de atendimento.
        </p>

        <Tabs defaultValue="campos">
          <TabsList>
            <TabsTrigger value="campos"><ListChecks className="mr-1.5 h-4 w-4" />Campos</TabsTrigger>
            <TabsTrigger value="dropdowns"><ListTree className="mr-1.5 h-4 w-4" />Dropdowns</TabsTrigger>
          </TabsList>

          {/* ── TAB CAMPOS: matriz bloco × tipo ─────────────────────────── */}
          <TabsContent value="campos">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Visibilidade por tipo de cliente</CardTitle>
                <CardDescription>✓ visível neste tipo · * obrigatório</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : blocks.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Sem configuração ainda. A Ficha mostra todos os campos por defeito (comportamento seguro).
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 pr-3 font-medium">Bloco</th>
                          {TYPES.map((t) => (
                            <th key={t.key} className="px-2 py-2 text-center font-medium">{t.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {blocks.map((block) => {
                          const hasRealFields = !!REAL_FIELDS_BY_BLOCK[block];
                          const isExpanded = expandedBlock === block;
                          return (
                          <>
                          <tr key={block} className="border-b border-border/60">
                            <td className="py-2 pr-3 font-medium">
                              {hasRealFields ? (
                                <button
                                  className="flex items-center gap-1 hover:text-primary"
                                  onClick={() => setExpandedBlock(isExpanded ? null : block)}
                                >
                                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  {block}
                                </button>
                              ) : block}
                            </td>
                            {TYPES.map((t) => {
                              const row = cell(block, t.key);
                              const busyV = savingKey === `${block}-${t.key}-visible`;
                              const busyR = savingKey === `${block}-${t.key}-required`;
                              return (
                                <td key={t.key} className="px-2 py-2 text-center">
                                  {!row ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Checkbox
                                        checked={row.visible}
                                        disabled={busyV}
                                        onCheckedChange={() => toggleVisible(row, block, t.key)}
                                        aria-label={`Visível em ${t.label}`}
                                      />
                                      <button
                                        className={`text-xs ${row.required ? "font-bold text-primary" : "text-muted-foreground"} disabled:opacity-40`}
                                        disabled={!row.visible || busyR}
                                        onClick={() => toggleRequired(row)}
                                        title="Obrigatório"
                                      >
                                        *
                                      </button>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                          {isExpanded && hasRealFields && (
                            <tr>
                              <td colSpan={TYPES.length + 1} className="bg-muted/20 px-3 py-3">
                                <FieldOrderEditor
                                  block={block}
                                  fields={REAL_FIELDS_BY_BLOCK[block]}
                                  config={config}
                                  activeType={expandedType}
                                  onTypeChange={setExpandedType}
                                  onChanged={load}
                                />
                              </td>
                            </tr>
                          )}
                          </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB DROPDOWNS ────────────────────────────────────────────── */}
          <TabsContent value="dropdowns">
            <DropdownsEditor options={options} loading={loading} onChanged={load} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function DropdownsEditor({
  options, loading, onChanged,
}: { options: FieldOptionRow[]; loading: boolean; onChanged: () => void }) {
  const keys = useMemo(() => distinctFieldKeys(options), [options]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);

  useEffect(() => { if (!activeKey && keys.length) setActiveKey(keys[0]); }, [keys, activeKey]);

  const rows = options
    .filter((o) => o.field_key === activeKey)
    .sort((a, b) => a.sort - b.sort);

  const slugify = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  /** Cria uma categoria de dropdown NOVA (field_key que ainda não existe),
   *  com uma primeira opção. Sem isto não há forma de sair das 8 categorias
   *  iniciais — é o próprio field_key que "existe" só por ter opções. */
  const createNewDropdown = async () => {
    const key = slugify(newKeyName);
    if (!key) {
      toast({ title: "Escreve um nome para o novo dropdown", variant: "destructive" });
      return;
    }
    if (keys.includes(key)) {
      toast({ title: "Já existe um dropdown com esse nome", variant: "destructive" });
      return;
    }
    setCreatingKey(true);
    try {
      await createFieldOption({
        field_key: key,
        value: "opcao_1",
        label: "Primeira opção (edita-me)",
        parent_value: null,
        sort: 0,
        active: true,
      });
      setNewKeyName("");
      setActiveKey(key);
      onChanged();
      toast({ title: `Dropdown "${key}" criado`, description: "Já podes editar/adicionar as opções dele." });
    } catch {
      toast({ title: "Falha ao criar dropdown", variant: "destructive" });
    } finally {
      setCreatingKey(false);
    }
  };

  const addOption = async () => {
    if (!newLabel.trim() || !activeKey) return;
    setBusy(true);
    try {
      await createFieldOption({
        field_key: activeKey,
        value: slugify(newLabel),
        label: newLabel.trim(),
        parent_value: null,
        sort: rows.length,
        active: true,
      });
      setNewLabel("");
      onChanged();
      toast({ title: "Opção adicionada" });
    } catch {
      toast({ title: "Falha ao adicionar", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row: FieldOptionRow) => {
    try {
      await updateFieldOption(row.id, { active: !row.active });
      onChanged();
    } catch {
      toast({ title: "Falha ao gravar", variant: "destructive" });
    }
  };

  const removeOption = async (row: FieldOptionRow) => {
    try {
      await deleteFieldOption(row.id);
      onChanged();
      toast({ title: "Opção removida" });
    } catch {
      toast({ title: "Falha ao remover", variant: "destructive" });
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Dropdowns</CardTitle></CardHeader>
        <CardContent className="space-y-1 p-2">
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => setActiveKey(k)}
              className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm ${activeKey === k ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}
            >
              {k}
            </button>
          ))}
          <div className="mt-2 space-y-1.5 border-t border-border pt-2">
            <p className="px-0.5 text-xs text-muted-foreground">Novo dropdown</p>
            <Input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="ex: urgencia_nivel"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && createNewDropdown()}
            />
            <Button size="sm" className="w-full" onClick={createNewDropdown} disabled={creatingKey || !newKeyName.trim()}>
              {creatingKey ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
              Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{activeKey || "—"}</CardTitle>
          <CardDescription>Opções deste dropdown, usadas na Ficha e no drawer de atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
              <Checkbox checked={row.active} onCheckedChange={() => toggleActive(row)} aria-label="Activo" />
              <span className={`flex-1 text-sm ${!row.active ? "text-muted-foreground line-through" : ""}`}>{row.label}</span>
              <span className="text-xs text-muted-foreground">{row.value}</span>
              <button onClick={() => removeOption(row)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {rows.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Sem opções ainda.</p>}

          <div className="flex gap-2 pt-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Nova opção…"
              onKeyDown={(e) => e.key === "Enter" && addOption()}
            />
            <Button size="sm" onClick={addOption} disabled={busy || !newLabel.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Editor de ordem/visibilidade dos campos REAIS de um bloco, por tipo de
 * cliente. Reutiliza entity_form_config (linhas com field != '_block').
 * Move para cima/baixo troca o `sort` com o vizinho; visível/invisível
 * é um PATCH directo. Fallback seguro: se uma linha ainda não existir
 * para (bloco, campo, tipo), cria-a ao primeiro toque (visível, sort 0).
 */
function FieldOrderEditor({
  block, fields, config, activeType, onTypeChange, onChanged,
}: {
  block: string;
  fields: { key: string; label: string }[];
  config: EntityFormConfigRow[];
  activeType: EntityConfigType;
  onTypeChange: (t: EntityConfigType) => void;
  onChanged: () => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rowFor = (fieldKey: string) =>
    config.find((r) => r.block === block && r.field === fieldKey && r.entity_type === activeType);

  const ordered = [...fields].sort((a, b) => {
    const ra = rowFor(a.key), rb = rowFor(b.key);
    return (ra?.sort ?? 999) - (rb?.sort ?? 999);
  });

  const toggleVisible = async (fieldKey: string) => {
    const row = rowFor(fieldKey);
    setBusyKey(fieldKey);
    try {
      await upsertFieldConfig(block, fieldKey, activeType, { visible: !(row?.visible ?? true) }, row?.id);
      onChanged();
    } catch {
      toast({ title: "Falha ao gravar", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = ordered[index + dir];
    const current = ordered[index];
    if (!other || !current) return;
    const rowCurrent = rowFor(current.key);
    const rowOther = rowFor(other.key);
    setBusyKey(current.key);
    try {
      await Promise.all([
        upsertFieldConfig(block, current.key, activeType, { sort: rowOther?.sort ?? index + dir }, rowCurrent?.id),
        upsertFieldConfig(block, other.key, activeType, { sort: rowCurrent?.sort ?? index }, rowOther?.id),
      ]);
      onChanged();
    } catch {
      toast({ title: "Falha ao reordenar", variant: "destructive" });
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => onTypeChange(t.key)}
            className={`rounded-md px-2 py-1 text-xs ${activeType === t.key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        {ordered.map((f, i) => {
          const row = rowFor(f.key);
          const visible = row?.visible ?? true;
          const busy = busyKey === f.key;
          return (
            <div key={f.key} className={`flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 ${!visible ? "opacity-50" : ""}`}>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="flex-1 text-sm">{f.label}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0 || busy} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => move(i, 1)} disabled={i === ordered.length - 1 || busy} className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <Checkbox checked={visible} disabled={busy} onCheckedChange={() => toggleVisible(f.key)} aria-label="Visível" />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Ordem e visibilidade específicas para "{TYPES.find((t) => t.key === activeType)?.label}". Muda de tipo acima para configurar os outros.
      </p>
    </div>
  );
}
