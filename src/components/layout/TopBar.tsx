import { useEffect, useState } from "react";
import { Menu, Search, Bell, ChevronDown, LogOut, User, Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

import { ActivityFeedPopover } from "@/components/ActivityFeedPopover";
import { useGlobalSearchStore } from "@/store/globalSearchStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Painel",
  "/comunicacoes": "Comunicações",
  "/telecof": "Telecof",
  "/inbox": "Inbox",
  "/contactos": "Contactos",
  "/leads": "Leads",
  "/propostas": "Propostas",
  "/agenda": "Agenda",
  "/pipeline": "Pipeline",
  "/email": "Email",
  "/definicoes": "Definições",
};

function initialsOf(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function useSafeTheme() {
  const ctx = useTheme();
  return ctx ?? ({ resolvedTheme: undefined, setTheme: () => {} } as any);
}

export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const openSearch = useGlobalSearchStore((s) => s.open);
  const unread = useNotificationStore((s) => s.badgeCounts.unreadCount);
  const toggleSidebar = () => window.dispatchEvent(new Event("crm:toggle-sidebar"));
  const { resolvedTheme, setTheme } = useSafeTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pageTitle = PAGE_TITLES[pathname] ?? "CRM";
  const userName =
    (user as any)?.first_name ||
    (user as any)?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Utilizador";
  const initials = initialsOf(userName);

  return (
    <div className="crm-topbar topbar-brand-gradient sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 px-2 sm:px-4 md:px-6">
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={toggleSidebar}
        className="crm-topbar-menu flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <span className="crm-topbar-title hidden min-w-0 truncate text-sm font-semibold text-foreground">
        {pageTitle}
      </span>

      <button
        type="button"
        onClick={openSearch}
        aria-label="Pesquisar globalmente"
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:h-9 md:max-w-sm"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Pesquisar contactos, negócios…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="crm-topbar-actions ml-auto flex shrink-0 items-center gap-0.5">
        <ActivityFeedPopover />
        <NotificationBell />

        <Link
          to="/definicoes"
          aria-label="Notificações"
          className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted md:hidden"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Menu do utilizador"
              className={cn(
                "flex h-10 items-center gap-1 rounded-full px-1.5 pr-2 text-foreground transition-colors hover:bg-muted",
              )}
            >
              <Avatar className="h-7 w-7 border border-border">
                <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">{userName}</span>
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-semibold">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email ?? "—"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/customer360-shell")}>
              <User className="mr-2 h-4 w-4" />
              Meu perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/definicoes")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              Definições
            </DropdownMenuItem>
            {mounted && (
              <DropdownMenuItem
                onSelect={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                try {
                  await signOut();
                  navigate("/auth");
                } catch {
                  navigate("/auth");
                }
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default TopBar;