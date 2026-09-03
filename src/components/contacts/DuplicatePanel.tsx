/**
 * DuplicatePanel — scans contacts for potential duplicates and offers merge action.
 * Uses findDuplicateContact() pattern (NIF, phone ends_with, email exact match).
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Merge, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { directusRequest } from "@/integrations/directus/client";
import { patchContact } from "@/integrations/directus/contacts";
import { toast } from "@/hooks/use-toast";

interface ContactRow {
  id: number;
  company_name: string;
  nif: string;
  phone: string;
  mobile_phone: string;
  email: string;
  city: string;
  entity_status: string;
}

interface DuplicateGroup {
  criterion: "nif" | "phone" | "email";
  value: string;
  contacts: ContactRow[];
}

// Collections that reference contacts.id and need migration during merge
const RELATION_TABLES = [
  { collection: "deals", field: "customer_id" },
  { collection: "quotations", field: "customer_id" },
  { collection: "interactions", field: "contact_id" },
  { collection: "communication_events", field: "contact_int_id" },
  { collection: "follow_ups", field: "contact_id" },
  { collection: "email_threads", field: "contact_id" },
] as const;

export function DuplicatePanel() {
  const [scanning, setScanning] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [scanned, setScanned] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeDialog, setMergeDialog] = useState<{ group: DuplicateGroup; masterId: number } | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setGroups([]);
    try {
      // Fetch all active contacts with key fields
      const res = await directusRequest<{ data: ContactRow[] }>(
        "/items/contacts?filter[entity_status][_eq]=active&limit=-1&fields=id,company_name,nif,phone,mobile_phone,email,city,entity_status"
      );
      const contacts = res?.data ?? [];
      const found: DuplicateGroup[] = [];
      const usedIds = new Set<number>();

      // Group by NIF (strong match)
      const nifMap = new Map<string, ContactRow[]>();
      for (const c of contacts) {
        const nif = (c.nif || "").trim();
        if (nif.length >= 9) {
          const arr = nifMap.get(nif) || [];
          arr.push(c);
          nifMap.set(nif, arr);
        }
      }
      for (const [nif, arr] of nifMap) {
        if (arr.length > 1) {
          found.push({ criterion: "nif", value: nif, contacts: arr });
          arr.forEach((c) => usedIds.add(c.id));
        }
      }

      // Group by phone (ends_with last 9 digits — medium match)
      const phoneMap = new Map<string, ContactRow[]>();
      for (const c of contacts) {
        if (usedIds.has(c.id)) continue;
        const phone = (c.phone || c.mobile_phone || "").replace(/\D/g, "");
        const tail = phone.slice(-9);
        if (tail.length >= 9) {
          const arr = phoneMap.get(tail) || [];
          arr.push(c);
          phoneMap.set(tail, arr);
        }
      }
      for (const [phone, arr] of phoneMap) {
        if (arr.length > 1) {
          found.push({ criterion: "phone", value: phone, contacts: arr });
          arr.forEach((c) => usedIds.add(c.id));
        }
      }

      // Group by email (exact match — strong)
      const emailMap = new Map<string, ContactRow[]>();
      for (const c of contacts) {
        if (usedIds.has(c.id)) continue;
        const email = (c.email || "").trim().toLowerCase();
        if (email && email.includes("@")) {
          const arr = emailMap.get(email) || [];
          arr.push(c);
          emailMap.set(email, arr);
        }
      }
      for (const [email, arr] of emailMap) {
        if (arr.length > 1) {
          found.push({ criterion: "email", value: email, contacts: arr });
        }
      }

      setGroups(found);
      setScanned(true);
    } catch (err) {
      toast({ title: "Erro ao procurar duplicados", description: String(err), variant: "destructive" });
    }
    setScanning(false);
  }, []);

  const handleMerge = useCallback(async () => {
    if (!mergeDialog) return;
    const { group, masterId } = mergeDialog;
    const duplicateIds = group.contacts.filter((c) => c.id !== masterId).map((c) => c.id);
    setMerging(true);

    const migrationCounts: Record<string, number> = {};
    const errors: { collection: string; itemId: string | number; error: string }[] = [];
    let allMigrationsSucceeded = true;

    // Migrate relations from each duplicate to master
    for (const dupId of duplicateIds) {
      for (const rel of RELATION_TABLES) {
        // Find items pointing to the duplicate
        let items: { id: string | number }[] = [];
        try {
          const res = await directusRequest<{ data: { id: string | number }[] }>(
            `/items/${rel.collection}?filter[${rel.field}][_eq]=${dupId}&fields=id&limit=-1`
          );
          items = res?.data ?? [];
        } catch (err) {
          errors.push({ collection: rel.collection, itemId: "fetch", error: String(err) });
          allMigrationsSucceeded = false;
          continue;
        }

        // Update each to point to master
        for (const item of items) {
          try {
            await directusRequest(
              `/items/${rel.collection}/${item.id}`,
              { method: "PATCH", body: JSON.stringify({ [rel.field]: masterId }) }
            );
            migrationCounts[rel.collection] = (migrationCounts[rel.collection] || 0) + 1;
          } catch (err) {
            errors.push({ collection: rel.collection, itemId: item.id, error: String(err) });
            allMigrationsSucceeded = false;
          }
        }
      }
    }

    // Only archive duplicates if ALL migrations succeeded
    if (!allMigrationsSucceeded) {
      const errorDesc = errors.slice(0, 3).map((e) => `${e.collection}/${e.itemId}`).join(", ");
      toast({
        title: "Fusão incompleta — duplicado NÃO arquivado",
        description: `Erros em: ${errorDesc}${errors.length > 3 ? ` (+${errors.length - 3} mais)` : ""}. Corrige e tenta novamente.`,
        variant: "destructive",
      });
      setMerging(false);
      setMergeDialog(null);
      return;
    }

    // Archive duplicates
    for (const dupId of duplicateIds) {
      await patchContact(String(dupId), {
        entity_status: "archived",
        internal_notes: `[FUNDIDO] Contacto fundido com #${masterId} em ${new Date().toISOString().slice(0, 10)}`,
      });
    }

    // Add merge note to master
    const dupNames = group.contacts.filter((c) => c.id !== masterId).map((c) => `#${c.id} ${c.company_name}`).join(", ");
    await patchContact(String(masterId), {
      internal_notes: `[FUSÃO] Absorveu: ${dupNames} em ${new Date().toISOString().slice(0, 10)}`,
    });

    // Build summary of migrated records
    const summary = Object.entries(migrationCounts)
      .map(([col, count]) => `${count} ${col}`)
      .join(", ");

    toast({
      title: "Fusão concluída",
      description: summary
        ? `Contacto #${masterId} absorveu ${duplicateIds.length} duplicado(s). Migrados: ${summary}.`
        : `Contacto #${masterId} absorveu ${duplicateIds.length} duplicado(s) (sem registos a migrar).`,
    });

    // Remove merged group from list
    setGroups((prev) => prev.filter((g) => g !== group));
    setMerging(false);
    setMergeDialog(null);
  }, [mergeDialog]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Duplicados Potenciais</CardTitle>
          <Button size="sm" onClick={scan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            {scanning ? "A procurar..." : "Procurar duplicados"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!scanned && !scanning && (
          <p className="text-sm text-muted-foreground text-center py-4">Clica em "Procurar duplicados" para analisar a base de contactos.</p>
        )}

        {scanned && groups.length === 0 && (
          <p className="text-sm text-green-600 text-center py-4">✓ Nenhum duplicado encontrado.</p>
        )}

        {groups.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{groups.length} grupo(s) de duplicados encontrados:</p>
            {groups.map((group, gi) => (
              <div key={gi} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={group.criterion === "nif" || group.criterion === "email" ? "default" : "secondary"}>
                    {group.criterion === "nif" ? "NIF" : group.criterion === "phone" ? "Telefone" : "Email"}
                  </Badge>
                  <span className="text-sm font-mono">{group.value}</span>
                  <span className="text-xs text-muted-foreground">({group.contacts.length} contactos)</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 px-1">ID</th>
                      <th className="py-1 px-1">Nome</th>
                      <th className="py-1 px-1">Telefone</th>
                      <th className="py-1 px-1">Email</th>
                      <th className="py-1 px-1">Cidade</th>
                      <th className="py-1 px-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.contacts.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="py-1 px-1 font-mono">#{c.id}</td>
                        <td className="py-1 px-1">{c.company_name || "-"}</td>
                        <td className="py-1 px-1">{c.phone || c.mobile_phone || "-"}</td>
                        <td className="py-1 px-1">{c.email || "-"}</td>
                        <td className="py-1 px-1">{c.city || "-"}</td>
                        <td className="py-1 px-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2"
                            onClick={() => setMergeDialog({ group, masterId: c.id })}
                          >
                            <Merge className="h-3 w-3 mr-1" /> Manter este
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Merge confirmation dialog */}
        <AlertDialog open={!!mergeDialog} onOpenChange={(open) => !open && setMergeDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fundir contactos?</AlertDialogTitle>
              <AlertDialogDescription>
                {mergeDialog && (
                  <>
                    O contacto <strong>#{mergeDialog.masterId} ({mergeDialog.group.contacts.find((c) => c.id === mergeDialog.masterId)?.company_name})</strong> será mantido como principal.
                    <br /><br />
                    Os restantes {mergeDialog.group.contacts.length - 1} contacto(s) serão:
                    <ul className="list-disc ml-4 mt-1">
                      <li>Todas as propostas, negócios, interacções, comunicações, follow-ups e emails migrados para o principal</li>
                      <li>Marcados como arquivados (nunca eliminados)</li>
                    </ul>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleMerge} disabled={merging}>
                {merging ? "A fundir..." : "Sim, fundir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
