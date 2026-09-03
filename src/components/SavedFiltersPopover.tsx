import { useState } from "react";
import { Bookmark, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSavedFilters } from "@/hooks/useSavedFilters";
import { toast } from "@/hooks/use-toast";

interface SavedFiltersPopoverProps {
  page: "contacts" | "pipeline";
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
  hasActiveFilters: boolean;
}

export function SavedFiltersPopover({
  page,
  currentFilters,
  onApply,
  hasActiveFilters,
}: SavedFiltersPopoverProps) {
  const { filters, isLoading, save, isSaving, remove, isRemoving } = useSavedFilters(page);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await save({ page, name: trimmed, filters: currentFilters });
      setName("");
      toast({ title: "Filtro guardado", description: `"${trimmed}" guardado com sucesso.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível guardar o filtro.", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id);
      setConfirmDeleteId(null);
      toast({ title: "Filtro eliminado" });
    } catch {
      toast({ title: "Erro", description: "Não foi possível eliminar.", variant: "destructive" });
    }
  }

  function handleApply(filterData: Record<string, unknown>) {
    onApply(filterData);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filtros guardados</span>
          {filters.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
              {filters.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {/* Saved filters list */}
        <div className="max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">A carregar…</div>
          ) : filters.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">Sem filtros guardados</div>
          ) : (
            <ul className="py-1">
              {filters.map((f) => (
                <li key={f.id} className="group flex items-center gap-1 px-2 py-1">
                  {confirmDeleteId === f.id ? (
                    <div className="flex flex-1 items-center gap-1.5 text-xs">
                      <span className="text-destructive font-medium">Eliminar?</span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(f.id)}
                        disabled={isRemoving}
                        className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/80"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApply(f.filters)}
                        className="flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        {f.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(f.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Save current filter */}
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          <p className="text-xs text-muted-foreground">
            {hasActiveFilters ? "Guardar filtro actual:" : "Aplica filtros para poderes guardar."}
          </p>
          {hasActiveFilters && (
            <div className="flex gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do filtro…"
                className="h-7 text-xs"
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              />
              <Button
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => void handleSave()}
                disabled={isSaving || !name.trim()}
              >
                <Save className="h-3 w-3" />
                Guardar
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
