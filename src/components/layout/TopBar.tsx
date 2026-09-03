import { Menu, Search } from "lucide-react"
import { useLocation } from "react-router-dom"

import { ActivityFeedPopover } from "@/components/ActivityFeedPopover"
import { useGlobalSearchStore } from "@/store/globalSearchStore"
import { NotificationBell } from "./NotificationBell"

/** Global app chrome: navigation, search and notification actions. */
export function TopBar() {
  const { pathname } = useLocation()
  const openSearch = useGlobalSearchStore((s) => s.open)
  const toggleSidebar = () => window.dispatchEvent(new Event("crm:toggle-sidebar"))
  const pageTitle = ({
    "/dashboard": "Painel", "/comunicacoes": "Comunicações", "/telecof": "Telecof",
    "/inbox": "Inbox", "/contactos": "Contactos", "/leads": "Leads",
    "/propostas": "Propostas", "/agenda": "Agenda",
  } as Record<string, string>)[pathname] ?? "CRM"

  return (
    <div className="crm-topbar sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b border-border/60 bg-background/85 px-2 backdrop-blur sm:px-4 md:px-6">
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
        aria-label="Pesquisar"
        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:h-8 md:max-w-xs"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Pesquisar</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="crm-topbar-actions ml-auto flex shrink-0 items-center gap-0.5">
        <ActivityFeedPopover />
        <NotificationBell />
      </div>
    </div>
  )
}
