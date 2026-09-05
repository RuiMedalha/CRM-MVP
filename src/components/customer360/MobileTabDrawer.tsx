import { useState } from "react";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TabDescriptor {
  id: string;
  label: string;
  /** Pequeno ícone opcional — emoji ou character. */
  icon?: string;
}

interface MobileTabDrawerProps {
  tabs: TabDescriptor[];
  activeId: string;
  onChange: (id: string) => void;
}

/**
 * Navegação entre tabs que coexiste em 2 formas:
 *  • <lg (mobile/tablet): drawer lateral (Sheet) aberto por um botão ☰.
 *  • ≥lg (desktop): tab bar horizontal, sempre visível.
 *
 * Padrão HubSpot/Salesforce mobile-first.
 */
export function MobileTabDrawer({ tabs, activeId, onChange }: MobileTabDrawerProps) {
  const [open, setOpen] = useState(false);
  const activeTab = tabs.find((t) => t.id === activeId);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
      {/* Mobile trigger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden h-8 w-8 p-0 shrink-0"
            aria-label="Abrir navegação entre tabs"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="text-base">Navegação</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-0.5 p-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-left transition-colors",
                  activeId === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {t.icon && <span className="text-base">{t.icon}</span>}
                <span className="flex-1">{t.label}</span>
                {activeId === t.id && <span className="text-[10px]">●</span>}
              </button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Active tab label (mobile only — desktop mostra tab bar) */}
      <div className="lg:hidden text-sm font-medium text-foreground truncate flex-1">
        {activeTab?.icon && <span className="mr-1.5">{activeTab.icon}</span>}
        {activeTab?.label ?? ""}
      </div>

      {/* Desktop tab bar */}
      <div className="hidden lg:flex gap-1 overflow-x-auto -mb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "whitespace-nowrap px-3.5 py-2 text-sm font-medium transition-colors relative rounded-t-md",
              activeId === t.id
                ? "text-primary bg-primary/5 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {t.icon && <span className="mr-1">{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
