import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Inbox,
  MessagesSquare,
  Menu,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { CreateFabPopover } from "./CreateFabPopover";
import { MoreSheet } from "./MoreSheet";

interface BottomNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  isFab?: boolean;
}

// M1: 5 itens — 4 routes + 1 CTA central FAB.
// "Mais" abre /menu (MenuMobile), a única porta de entrada em telemóvel para os
// módulos que vivem na AppSidebar — essa é `hidden md:flex`, logo o MoreSheet que
// ela monta é inalcançável abaixo de 768px.
// /propostas continua acessível pelo FAB, pelo Dashboard e por /menu.
const navItems: BottomNavItem[] = [
  { icon: LayoutDashboard, label: "Painel", path: "/dashboard" },
  { icon: Inbox, label: "Inbox", path: "/inbox" },
  { icon: Plus, label: "", path: "__cta__", isFab: true },
  { icon: MessagesSquare, label: "Chat", path: "/comunicacoes" },
  { icon: Menu, label: "Mais", path: "__more__" },
];

export function BottomNav() {
  const location = useLocation();
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* O padding da safe-area vive no <nav> (estica a barra) e não no interior
          (comprimia os ícones dentro do h-16). Requer viewport-fit=cover no
          index.html, sem o qual o iOS resolve env(safe-area-inset-*) para 0px. */}
      <nav className="crm-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:shadow-[0_-1px_3px_rgba(0,0,0,0.4)] lg:hidden">
        <div className="crm-bottom-nav-items flex items-end justify-around h-16 px-1">
          {navItems.map((item) => {
            const isActive = !item.isFab && location.pathname === item.path;
            const Icon = item.icon;

            if (item.isFab) {
              return (
                <button
                  key="__cta__"
                  type="button"
                  onClick={() => setFabOpen(true)}
                  aria-label="Acção rápida"
                  className="crm-bottom-nav-fab relative flex items-center justify-center flex-[1.4] -mt-5"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card transition-transform active:scale-95">
                    <Icon className="h-6 w-6" />
                  </span>
                </button>
              );
            }

            if (item.path === "__more__") {
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  aria-label="Mais módulos"
                  className="crm-bottom-nav-link flex flex-1 flex-col items-center justify-center py-2 text-foreground/60 transition-colors hover:text-foreground dark:text-foreground/70"
                >
                  <Icon className="h-5 w-5" />
                  <span className="mt-1 text-xs font-medium">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "crm-bottom-nav-link flex flex-col items-center justify-center flex-1 py-2 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-foreground/60 dark:text-foreground/70 hover:text-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <CreateFabPopover open={fabOpen} onOpenChange={setFabOpen} />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
