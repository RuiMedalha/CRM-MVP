import { useEffect, useMemo } from "react";
import type { UnifiedInboxItem } from "@/components/inbox/types";

export interface UseInboxKeyboardNavOptions {
  /** Lista filtrada e ordenada — sobre a qual navega J/K. */
  items: UnifiedInboxItem[];
  /** Item actualmente seleccionado (pode ser null). */
  selectedId: string | null;
  /** Pede para seleccionar outro item (recebe o item completo). */
  onSelect: (item: UnifiedInboxItem) => void;
  /** Pede para limpar a selecção (Esc volta à lista em mobile). */
  onEscape?: () => void;
  /** Activar/desactivar o handler (default true). */
  enabled?: boolean;
}

export interface UseInboxKeyboardNavResult {
  /** Índice 1-based do item seleccionado dentro da lista filtrada (ou null). */
  position: { index: number; total: number } | null;
  /** Item anterior (para o botão ←). */
  prev: UnifiedInboxItem | null;
  /** Item seguinte (para o botão →). */
  next: UnifiedInboxItem | null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Navegação por teclado para o Inbox Unificado.
 *   J → próximo item
 *   K → item anterior
 *   Enter → confirma selecção (passa o item corrente se houver)
 *   Esc → onEscape() (limpa selecção / fecha sheet)
 *
 * Ignora teclas quando o foco está num input/textarea/contentEditable.
 */
export function useInboxKeyboardNav({
  items,
  selectedId,
  onSelect,
  onEscape,
  enabled = true,
}: UseInboxKeyboardNavOptions): UseInboxKeyboardNavResult {
  const position = useMemo(() => {
    if (!selectedId) return null;
    const idx = items.findIndex((i) => i.id === selectedId);
    if (idx < 0) return null;
    return { index: idx + 1, total: items.length };
  }, [items, selectedId]);

  const prev = useMemo(() => {
    if (items.length === 0) return null;
    if (!selectedId) return items[items.length - 1] ?? null;
    const idx = items.findIndex((i) => i.id === selectedId);
    if (idx < 0) return null;
    return idx > 0 ? items[idx - 1] : null;
  }, [items, selectedId]);

  const next = useMemo(() => {
    if (items.length === 0) return null;
    if (!selectedId) return items[0] ?? null;
    const idx = items.findIndex((i) => i.id === selectedId);
    if (idx < 0) return null;
    return idx < items.length - 1 ? items[idx + 1] : null;
  }, [items, selectedId]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const key = e.key;
      // Ignora modificadores — não queremos pisar atalhos do browser.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (key === "j" || key === "J") {
        if (items.length === 0) return;
        e.preventDefault();
        if (!selectedId) {
          onSelect(items[0]);
          return;
        }
        const idx = items.findIndex((i) => i.id === selectedId);
        const target =
          idx < 0
            ? items[0]
            : idx < items.length - 1
              ? items[idx + 1]
              : items[idx];
        onSelect(target);
        return;
      }

      if (key === "k" || key === "K") {
        if (items.length === 0) return;
        e.preventDefault();
        if (!selectedId) {
          onSelect(items[items.length - 1]);
          return;
        }
        const idx = items.findIndex((i) => i.id === selectedId);
        const target =
          idx <= 0
            ? idx === 0
              ? items[0]
              : items[items.length - 1]
            : items[idx - 1];
        onSelect(target);
        return;
      }

      if (key === "Enter") {
        if (!selectedId && items.length > 0) {
          e.preventDefault();
          onSelect(items[0]);
        }
        return;
      }

      if (key === "Escape") {
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items, selectedId, onSelect, onEscape, enabled]);

  return { position, prev, next };
}
