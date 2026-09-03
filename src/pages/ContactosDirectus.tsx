import { useCallback, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Eye, Phone, Mail, MessageCircle, FileText, Workflow, ChevronLeft, ChevronRight, Download, Upload, Tag, X, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listContacts, createContact, findDuplicateContact, patchContact } from "@/integrations/directus/contacts";
import Papa from "papaparse";
import { listNewsletterSubscriptions } from "@/integrations/directus/newsletter-subscriptions";
import { listActiveDealsByCustomerIds } from "@/integrations/directus/deals";
import { listActiveQuotationsByCustomerIds } from "@/integrations/directus/quotations";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DuplicatePanel } from "@/components/contacts/DuplicatePanel";
import { SavedFiltersPopover } from "@/components/SavedFiltersPopover";

type IaScoreFilter = "all" | "hot" | "warm" | "cold"

function getIaScoreFilter(score: number | null | undefined): IaScoreFilter {
  if (score == null) return "cold"
  if (score >= 70) return "hot"
  if (score >= 40) return "warm"
  return "cold"
}

function IaScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return null
  const tier = getIaScoreFilter(score)
  const cls =
    tier === "hot"
      ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300"
      : tier === "warm"
        ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
        : "bg-muted text-muted-foreground border-border"
  const label = tier === "hot" ? "Quente" : tier === "warm" ? "Morno" : "Frio"
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label} {score}
    </span>
  )
}

const PAGE_SIZE = 50;

export default function ContactosDirectus() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [iaFilter, setIaFilter] = useState<IaScoreFilter>("all");
  const [letterFilter, setLetterFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);

  // Selection state (persists across page changes)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkBusy, setBulkBusy] = useState<"" | "tag" | "export">("");

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((contacts: { id: unknown }[]) => {
    setSelectedIds((prev) => {
      const pageIds = contacts.map((c) => String(c.id));
      const allSelected = pageIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) { pageIds.forEach((id) => next.delete(id)); }
      else { pageIds.forEach((id) => next.add(id)); }
      return next;
    });
  }, []);

  // Import CSV state
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Record<string, string>[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRunning, setImportRunning] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  // ─── Import CSV ──────────────────────────────────────────────────────────
  const handleImportFile = useCallback((file: File) => {
    setImportFile(file);
    setImportResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setImportPreview(result.data as Record<string, string>[]);
      },
    });
  }, []);

  const handleImportRun = useCallback(async () => {
    if (!importPreview.length) return;
    setImportRunning(true);
    let created = 0, duplicates = 0, errors = 0;
    for (const row of importPreview) {
      try {
        const dup = await findDuplicateContact({
          nif: row.nif || "",
          phone: row.phone || row.mobile_phone || "",
          email: row.email || "",
        });
        if (dup) { duplicates++; continue; }
        await createContact({
          company_name: row.company_name || row.nome || "",
          nif: row.nif || undefined,
          phone: row.phone || undefined,
          mobile_phone: row.mobile_phone || undefined,
          whatsapp_number: row.whatsapp_number || undefined,
          email: row.email || undefined,
          address: row.address || undefined,
          postal_code: row.postal_code || undefined,
          city: row.city || undefined,
          district: row.district || undefined,
          segment: row.segment || undefined,
          business_type: row.business_type || undefined,
          source: "csv_import",
        });
        created++;
      } catch {
        errors++;
      }
    }
    setImportResult({ created, duplicates, errors });
    setImportRunning(false);
    if (created > 0) query.refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importPreview]);

  const renderTags = (raw: any) => {
    const list: string[] = Array.isArray(raw)
      ? raw.map((x) => String(x)).filter(Boolean)
      : typeof raw === "string"
        ? raw.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    return list.slice(0, 3);
  };

  const normalizeTags = (raw: unknown): string[] => {
    if (Array.isArray(raw)) return raw.map((tag) => String(tag).trim()).filter(Boolean);
    if (typeof raw === "string") return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
    return [];
  };

  const query = useQuery({
    queryKey: ["contacts-directus", searchTerm, page, showArchived],
    queryFn: async () => {
      return await listContacts({
        search: searchTerm,
        limit: PAGE_SIZE,
        page,
        entityStatus: showArchived ? undefined : "active",
      });
    },
  });

  const subsQuery = useQuery({
    queryKey: ["newsletter-subscriptions", "search", searchTerm],
    enabled: !!searchTerm.trim(),
    queryFn: async () => {
      return await listNewsletterSubscriptions({ search: searchTerm, limit: 50, page: 1 });
    },
  });

  const contacts = query.data || [];
  const isLoading = query.isLoading;
  const subs = subsQuery.data || [];

  const activeSummary = useQuery({
    queryKey: ["contacts-directus", "active-summary", contacts.map((c: any) => String(c?.id || "")).join(",")],
    enabled: contacts.length > 0,
    queryFn: async () => {
      const ids = contacts.map((c: any) => String(c.id));
      const [deals, quotations] = await Promise.all([
        listActiveDealsByCustomerIds(ids).catch(() => []),
        listActiveQuotationsByCustomerIds(ids).catch(() => []),
      ]);

      const dealsByCustomer: Record<string, { count: number; total: number }> = {};
      const firstDealIdByCustomer: Record<string, string> = {};
      for (const d of deals as any[]) {
        const cid = d?.customer_id?.id ? String(d.customer_id.id) : d?.customer_id ? String(d.customer_id) : "";
        if (!cid) continue;
        const prev = dealsByCustomer[cid] || { count: 0, total: 0 };
        dealsByCustomer[cid] = { count: prev.count + 1, total: prev.total + Number(d.total_amount || 0) };
        if (!firstDealIdByCustomer[cid] && d?.id) firstDealIdByCustomer[cid] = String(d.id);
      }

      const quotationsByCustomer: Record<string, { count: number; total: number }> = {};
      const firstQuotationIdByCustomer: Record<string, string> = {};
      for (const q of quotations as any[]) {
        const cid = q?.customer_id?.id ? String(q.customer_id.id) : q?.customer_id ? String(q.customer_id) : "";
        if (!cid) continue;
        const prev = quotationsByCustomer[cid] || { count: 0, total: 0 };
        quotationsByCustomer[cid] = { count: prev.count + 1, total: prev.total + Number(q.total_amount || 0) };
        if (!firstQuotationIdByCustomer[cid] && q?.id) firstQuotationIdByCustomer[cid] = String(q.id);
      }

      return { dealsByCustomer, quotationsByCustomer, firstDealIdByCustomer, firstQuotationIdByCustomer };
    },
  });

  const enrichedContacts = useMemo(() => {
    const dealsByCustomer = (activeSummary.data as any)?.dealsByCustomer || {};
    const quotationsByCustomer = (activeSummary.data as any)?.quotationsByCustomer || {};
    const firstDealIdByCustomer = (activeSummary.data as any)?.firstDealIdByCustomer || {};
    const firstQuotationIdByCustomer = (activeSummary.data as any)?.firstQuotationIdByCustomer || {};
    const withMeta = contacts.map((c: any) => {
      const id = String(c?.id || "");
      const d = dealsByCustomer[id] || { count: 0, total: 0 };
      const q = quotationsByCustomer[id] || { count: 0, total: 0 };
      const hasActive = (d.count || 0) > 0 || (q.count || 0) > 0;
      const activeScore = (d.total || 0) + (q.total || 0);
      return {
        ...c,
        __activeDeals: d,
        __activeQuotations: q,
        __hasActive: hasActive,
        __activeScore: activeScore,
        __firstDealId: firstDealIdByCustomer[id] || null,
        __firstQuotationId: firstQuotationIdByCustomer[id] || null,
      };
    });
    // Prioridade: quem tem em curso aparece primeiro; depois por valor total em curso; depois por nome
    return withMeta.sort((a: any, b: any) => {
      if (!!a.__hasActive !== !!b.__hasActive) return a.__hasActive ? -1 : 1;
      if ((b.__activeScore || 0) !== (a.__activeScore || 0)) return (b.__activeScore || 0) - (a.__activeScore || 0);
      return String(a.company_name || a.name || a.contact_name || "").localeCompare(String(b.company_name || b.name || b.contact_name || ""), "pt");
    });
  }, [contacts, activeSummary.data]);

  const filteredContacts = useMemo(() => {
    let result = enrichedContacts;
    // IA Score filter
    if (iaFilter !== "all") {
      result = result.filter((c: any) => getIaScoreFilter(c.ia_score) === iaFilter);
    }
    // Alphabetic filter
    if (letterFilter) {
      result = result.filter((c: any) => {
        const name = String(c.company_name || c.name || c.contact_name || "").trim();
        return name.toUpperCase().startsWith(letterFilter);
      });
    }
    // Role filter
    if (roleFilter) {
      result = result.filter((c: any) => {
        const roles = Array.isArray(c.roles) ? c.roles : [];
        return roles.some((r: string) => r.toLowerCase() === roleFilter);
      });
    }
    // Source/origin filter
    if (sourceFilter) {
      result = result.filter((c: any) => String(c.source || "").toLowerCase() === sourceFilter);
    }
    return result;
  }, [enrichedContacts, iaFilter, letterFilter, roleFilter, sourceFilter])

  // ─── Export CSV ──────────────────────────────────────────────────────────
  const CSV_FIELDS = ["company_name", "nif", "phone", "mobile_phone", "whatsapp_number", "email", "address", "postal_code", "city", "district", "segment", "business_type", "entity_status"];

  const downloadCsv = useCallback((rows: Record<string, unknown>[], suffix = "") => {
    const mapped = rows.map((c) =>
      CSV_FIELDS.reduce((acc, key) => ({ ...acc, [key]: c[key] ?? "" }), {} as Record<string, string>)
    );
    const csv = Papa.unparse(mapped, { columns: CSV_FIELDS });
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos${suffix}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportPage = useCallback(() => {
    downloadCsv(filteredContacts, "_pagina");
  }, [filteredContacts, downloadCsv]);

  const handleExportSelected = useCallback(async () => {
    const selected = filteredContacts.filter((c: Record<string, unknown>) => selectedIds.has(String(c.id)));
    if (!selected.length) return;
    setBulkBusy("export");
    try {
      const XLSX = await import("xlsx");
      const rows = selected.map((c: Record<string, unknown>) => ({
        Empresa: c.company_name || "",
        Nome: c.contact_name || c.name || "",
        NIF: c.nif || "",
        Email: c.email || "",
        Telefone: c.phone || "",
        WhatsApp: c.whatsapp_number || "",
        Cidade: c.city || "",
        Tags: normalizeTags(c.tags).join(", "),
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contactos");
      XLSX.writeFile(workbook, `contactos-selecionados-${rows.length}.xlsx`);
      if (selected.length < selectedIds.size) {
        toast({ title: "Exportação parcial", description: `Foram exportados ${selected.length} contactos visíveis dos ${selectedIds.size} seleccionados.` });
      }
    } finally {
      setBulkBusy("");
    }
  }, [filteredContacts, selectedIds, downloadCsv]);

  const handleApplyBulkTag = useCallback(async () => {
    const tag = bulkTag.trim();
    const selected = filteredContacts.filter((c: Record<string, unknown>) => selectedIds.has(String(c.id)));
    if (!tag || !selected.length) return;

    setBulkBusy("tag");
    let updated = 0;
    let failed = 0;
    try {
      for (const contact of selected) {
        const tags = normalizeTags(contact.tags);
        if (tags.some((currentTag) => currentTag.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
          updated++;
          continue;
        }
        try {
          await patchContact(String(contact.id), { tags: [...tags, tag] });
          updated++;
        } catch {
          failed++;
        }
      }
      setBulkTag("");
      await query.refetch();
      toast({
        title: `Tag \"${tag}\" aplicada`,
        description: `${updated} contacto(s)${failed ? `; ${failed} falha(s)` : ""}.`,
        variant: failed ? "destructive" : "default",
      });
    } finally {
      setBulkBusy("");
    }
  }, [bulkTag, filteredContacts, selectedIds, query]);

  const handleExportAll = useCallback(async () => {
    try {
      const all = await listContacts({ search: searchTerm, limit: 5000, page: 1, entityStatus: showArchived ? undefined : "active" });
      downloadCsv(all as unknown as Record<string, unknown>[], "_todos");
      toast({ title: "Exportação concluída", description: `${all.length} contactos exportados.` });
    } catch {
      toast({ title: "Erro", description: "Falha ao exportar todos os contactos.", variant: "destructive" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, showArchived, downloadCsv]);

  const count = useMemo(() => filteredContacts.length, [filteredContacts.length]);
  const hasNextPage = contacts.length === PAGE_SIZE;
  const hasPrevPage = page > 1;

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contactos</h1>
            <p className="text-muted-foreground">Base Directus (contactos)</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center sm:gap-3">
            <Badge variant="outline" className="text-base px-3 py-1 text-xs sm:text-base">
              {count} nesta página
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-xs sm:text-base">
              Pág. {page}
            </Badge>
            <div className="flex flex-wrap gap-1 sm:gap-1">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleExportSelected} title="Exportar seleccionados" className="text-xs sm:text-sm">
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> {selectedIds.size} sel.
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExportPage} title="Exportar página actual" className="text-xs sm:text-sm">
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Página
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportAll} title="Exportar todos" className="text-xs sm:text-sm">
                <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Tudo
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setImportOpen(true); setImportPreview([]); setImportFile(null); setImportResult(null); }} title="Importar CSV" className="text-xs sm:text-sm">
              <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Importar
            </Button>
            <Button
              onClick={() => navigate("/customer360-shell/novo")}
              title="Abrir Card 360 (novo)"
              size="sm"
              className="text-xs sm:text-sm"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Novo
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative max-w-md w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, NIF, telefone ou email…"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* IA Score filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "hot", "warm", "cold"] as IaScoreFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setIaFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  iaFilter === f
                    ? f === "hot"
                      ? "bg-red-100 border-red-300 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                      : f === "warm"
                        ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : f === "cold"
                          ? "bg-muted border-border text-muted-foreground"
                          : "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "all" ? "Todos" : f === "hot" ? "Quentes" : f === "warm" ? "Mornos" : "Frios"}
              </button>
            ))}
          </div>
          {/* Archived toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-2">
            <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(1); }} className="rounded border-border" />
            <span className="text-xs text-muted-foreground">Mostrar arquivados</span>
          </label>
        </div>

        {/* Role filter + Alphabetic filter */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Role filter */}
          <div className="flex gap-1 flex-wrap">
            {["", "cliente", "lead", "fornecedor"].map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  roleFilter === role
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {role === "" ? "Todos" : role === "cliente" ? "Clientes" : role === "lead" ? "Leads" : "Fornecedores"}
              </button>
            ))}
          </div>
          {/* Source/origin filter */}
          <Select value={sourceFilter || "all"} onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telecof">Telecof</SelectItem>
              <SelectItem value="site">Site</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="csv_import">CSV Import</SelectItem>
              <SelectItem value="bravo_legacy">BravoTech</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          {/* Alphabetic filter — dropdown */}
          <Select value={letterFilter || "all"} onValueChange={(v) => setLetterFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue placeholder="A-Z" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Saved filters */}
          <SavedFiltersPopover
            page="contacts"
            currentFilters={{ searchTerm, iaFilter, letterFilter, roleFilter, sourceFilter, showArchived }}
            onApply={(f) => {
              setSearchTerm((f.searchTerm as string) ?? "");
              setIaFilter((f.iaFilter as typeof iaFilter) ?? "all");
              setLetterFilter((f.letterFilter as string) ?? "");
              setRoleFilter((f.roleFilter as string) ?? "");
              setSourceFilter((f.sourceFilter as string) ?? "");
              setShowArchived((f.showArchived as boolean) ?? false);
              setPage(1);
            }}
            hasActiveFilters={!!(searchTerm || iaFilter !== "all" || letterFilter || roleFilter || sourceFilter || showArchived)}
          />
        </div>

        {query.isError && (
          <div className="text-sm text-destructive">
            Erro a carregar contactos:{" "}
            <button
              className="underline"
              onClick={() => {
                toast({ title: "A recarregar…" });
                query.refetch();
              }}
            >
              tentar novamente
            </button>
          </div>
        )}

        {/* Mobile: cards */}
        <div className="grid gap-3 md:hidden">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : contacts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum contacto encontrado
              </CardContent>
            </Card>
          ) : (
            filteredContacts.map((c: any) => (
              <Card
                key={String(c.id)}
                role="button"
                tabIndex={0}
                aria-label={`Abrir ficha de ${c.company_name || c.contact_name || c.phone || "contacto"}`}
                className={[
                  "w-full min-w-0 cursor-pointer hover:bg-muted/30 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  c.__hasActive ? "border-amber-500/40 bg-amber-500/5" : "",
                ].join(" ")}
                onClick={() => navigate(`/customer360-shell/${encodeURIComponent(String(c.id))}`)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/customer360-shell/${encodeURIComponent(String(c.id))}`); } }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {c.company_name || c.name || c.contact_name || c.email || c.phone || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                        {c.nif && <div>NIF: {c.nif}</div>}
                        {c.phone && <div className="font-mono">{c.phone}</div>}
                        {c.email && <div className="truncate">{c.email}</div>}
                        {c.city && <div className="truncate">{c.city}</div>}
                      </div>
                      {renderTags(c.tags).length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {renderTags(c.tags).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {c.ia_score != null && <IaScorePill score={c.ia_score} />}
                      {c.__hasActive ? (
                        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-700">
                          Em curso
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Contacto</Badge>
                      )}
                      {(c.__activeDeals?.count || 0) > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          Negócios: {c.__activeDeals.count}
                        </Badge>
                      ) : null}
                      {(c.__activeQuotations?.count || 0) > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          Orçamentos: {c.__activeQuotations.count}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    {c.__firstQuotationId ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/orcamentos?openId=${encodeURIComponent(String(c.__firstQuotationId))}`);
                        }}
                        title="Abrir orçamento ativo"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Orçamento
                      </Button>
                    ) : null}
                    {c.__firstDealId ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/pipeline?dealId=${encodeURIComponent(String(c.__firstDealId))}`);
                        }}
                        title="Abrir negócio em curso no pipeline"
                      >
                        <Workflow className="h-4 w-4 mr-2" />
                        Pipeline
                      </Button>
                    ) : null}
                    {c.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={`tel:${c.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Ligar
                        </a>
                      </Button>
                    )}
                    {c.whatsapp_number && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={`https://wa.me/${String(c.whatsapp_number).replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                    {c.email && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={`mailto:${c.email}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Newsletter-only matches (when searching) */}
        {searchTerm.trim() && subs.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Resultados na Newsletter (ainda não são contactos)
            </div>
            <div className="grid gap-3">
              {subs.map((s: any) => {
                const label = s.full_name || s.email || s.phone || String(s.id);
                const to = `/newsletter/${encodeURIComponent(String(s.id))}`;
                return (
                  <Card
                    key={String(s.id)}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(to)}
                  >
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{label}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                          {s.email ? <span>{String(s.email)}</span> : null}
                          {s.phone ? <span className="font-mono">{String(s.phone)}</span> : null}
                          {s.coupon_code ? <span>Cupão: {String(s.coupon_code)}</span> : <span>Sem cupão</span>}
                          {s.status ? <span>Estado: {String(s.status)}</span> : null}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">Newsletter</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop: table */}
        <div className="hidden md:block border rounded-lg overflow-hidden">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b text-sm">
              <span className="font-medium">{selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}</span>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-primary hover:underline">Limpar selecção</button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input type="checkbox" className="rounded border-border" checked={filteredContacts.length > 0 && filteredContacts.every((c: Record<string, unknown>) => selectedIds.has(String(c.id)))} onChange={() => toggleSelectAll(filteredContacts)} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden lg:table-cell">NIF</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Nenhum contacto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((c: any) => (
                  <TableRow
                    key={String(c.id)}
                    tabIndex={0}
                    aria-label={`Abrir ficha de ${c.company_name || c.contact_name || c.phone || "contacto"}`}
                    className={[
                      "cursor-pointer hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                      c.__hasActive ? "bg-amber-500/5" : "",
                      selectedIds.has(String(c.id)) ? "bg-primary/5" : "",
                    ].join(" ")}
                    onClick={() => navigate(`/customer360-shell/${encodeURIComponent(String(c.id))}`)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/customer360-shell/${encodeURIComponent(String(c.id))}`); } }}
                  >
                    <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-border" checked={selectedIds.has(String(c.id))} onChange={() => toggleSelect(String(c.id))} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.company_name || c.name || c.contact_name || c.email || c.phone || "-"}
                      {c.__hasActive ? (
                        <span className="ml-2 align-middle">
                          <Badge variant="outline" className="text-xs bg-amber-500/10 border-amber-500/30 text-amber-700">
                            Em curso • N:{c.__activeDeals?.count || 0} • O:{c.__activeQuotations?.count || 0}
                          </Badge>
                        </span>
                      ) : null}
                      {c.city ? (
                        <div className="text-xs text-muted-foreground mt-1 truncate">{String(c.city)}</div>
                      ) : null}
                      {renderTags(c.tags).length ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {renderTags(c.tags).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{c.nif || "-"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{c.phone || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{c.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {c.__firstQuotationId ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/orcamentos?openId=${encodeURIComponent(String(c.__firstQuotationId))}`);
                            }}
                            title="Abrir orçamento ativo"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {c.__firstDealId ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pipeline?dealId=${encodeURIComponent(String(c.__firstDealId))}`);
                            }}
                            title="Abrir negócio no pipeline"
                          >
                            <Workflow className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {c.phone && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                            <a href={`tel:${c.phone}`}>
                              <Phone className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {c.email && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                            <a href={`mailto:${c.email}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {c.whatsapp_number && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                            <a
                              href={`https://wa.me/${String(c.whatsapp_number).replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Badge variant="secondary" className="mr-1">Contacto</Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {(hasPrevPage || hasNextPage) && (
          <div className="flex items-center justify-center gap-3 py-4">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevPage || isLoading}
              onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage || isLoading}
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }) }}
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Duplicados */}
        <DuplicatePanel />
      </div>

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Contactos (CSV)</DialogTitle>
          </DialogHeader>

          {!importFile && !importResult && (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
              onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = ".csv"; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleImportFile(f); }; input.click(); }}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Arrasta um ficheiro CSV ou clica para selecionar</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Colunas esperadas: company_name, nif, phone, email, city, district...</p>
            </div>
          )}

          {importPreview.length > 0 && !importResult && (
            <div className="space-y-3">
              <p className="text-sm"><strong>{importPreview.length}</strong> linhas encontradas no ficheiro. Preview (primeiras 10):</p>
              <div className="max-h-[300px] overflow-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {Object.keys(importPreview[0]).slice(0, 6).map((k) => (
                        <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.keys(importPreview[0]).slice(0, 6).map((k) => (
                          <td key={k} className="px-2 py-1">{row[k] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-2 py-4">
              <p className="text-sm font-medium">Importação concluída:</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{importResult.created}</p>
                  <p className="text-xs text-green-600">Criados</p>
                </div>
                <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{importResult.duplicates}</p>
                  <p className="text-xs text-amber-600">Duplicados (ignorados)</p>
                </div>
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{importResult.errors}</p>
                  <p className="text-xs text-red-600">Erros</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {importPreview.length > 0 && !importResult && (
              <Button onClick={handleImportRun} disabled={importRunning}>
                {importRunning ? "A importar..." : `Importar ${importPreview.length} contactos`}
              </Button>
            )}
            {importResult && (
              <Button onClick={() => setImportOpen(false)}>Fechar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 md:bottom-4 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
            <span className="text-sm font-medium whitespace-nowrap">{selectedIds.size} seleccionado{selectedIds.size > 1 ? "s" : ""}</span>
            <div className="flex items-center gap-1.5">
              <Input
                value={bulkTag}
                onChange={(event) => setBulkTag(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void handleApplyBulkTag(); }}
                placeholder="Nova tag…"
                className="h-8 w-32"
              />
              <Button size="sm" variant="outline" onClick={() => void handleApplyBulkTag()} disabled={!bulkTag.trim() || bulkBusy !== ""}>
                {bulkBusy === "tag" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Tag className="h-3.5 w-3.5 mr-1" />}
                Aplicar tag
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => void handleExportSelected()} disabled={bulkBusy !== ""}>
              {bulkBusy === "export" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
              Exportar XLSX
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} title="Limpar selecção">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

