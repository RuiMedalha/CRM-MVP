import { Link, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import {
  Building2,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  IdCard,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  MessagesSquare,
  Search,
  SendHorizontal,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import { useEmailUnassignedCount } from "@/hooks/useEmailThreads"
import { useCompanySettings } from "@/hooks/useSettings"
import { cn } from "@/lib/utils"
import { useGlobalSearchStore } from "@/store/globalSearchStore"
import { useNotificationStore } from "@/store/notificationStore"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MoreSheet } from "./MoreSheet"

interface NavItem {
  icon: LucideIcon
  label: string
  path: string
}

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { icon: CalendarCheck2, label: "Hoje", path: "/" },
      { icon: LayoutDashboard, label: "Indicadores", path: "/painel" },
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: MessagesSquare, label: "Comunicações", path: "/comunicacoes" },
      { icon: MessagesSquare, label: "Telecof", path: "/comunicacoes?channel=telecof" },
      { icon: Mail, label: "Email", path: "/email" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { icon: UserCog, label: "Leads", path: "/leads" },
      { icon: Kanban, label: "Pipeline", path: "/pipeline" },
      { icon: SendHorizontal, label: "Propostas", path: "/propostas" },
    ],
  },
  {
    label: "Base",
    items: [
      { icon: IdCard, label: "Ficha de Cliente", path: "/customer360-shell" },
      { icon: Users, label: "Contactos", path: "/contactos" },
    ],
  },
  {
    label: "Definições",
    items: [
      { icon: Building2, label: "Definições", path: "/definicoes" },
    ],
  },
]

const SIDEBAR_COLLAPSED_KEY = "sidebar:v2:collapsed"

export function AppSidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  )
  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { signOut } = useAuth()
  const { data: settings } = useCompanySettings()
  const unreadCount = useNotificationStore((s) => s.badgeCounts.unreadCount)
  const { data: emailUnassignedCount } = useEmailUnassignedCount()
  const openSearch = useGlobalSearchStore((s) => s.open)
  const inboxTotal = (emailUnassignedCount ?? 0) + unreadCount
  const logoUrl = (settings as any)?.logo_url || "https://files.hotelequip.pt/public/logo.png"
  const companyName = (settings as any)?.name || "CRM Hotelequip"

  useEffect(() => {
    const toggle = () => setMobileOpen((open) => !open)
    window.addEventListener("crm:toggle-sidebar", toggle)
    return () => window.removeEventListener("crm:toggle-sidebar", toggle)
  }, [])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0")
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [])

  const currentPath = `${location.pathname}${location.search}`
  const isActive = (path: string) =>
    currentPath === path || (path !== "/dashboard" && !path.includes("?") && location.pathname.startsWith(path))

  const badgeFor = (path: string) => {
    if (path === "/inbox" && inboxTotal > 0) return inboxTotal
    if (path === "/comunicacoes" && unreadCount > 0) return unreadCount
    if (path === "/email" && (emailUnassignedCount ?? 0) > 0) return emailUnassignedCount
    return 0
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        aria-label="Navegação principal"
        className={cn(
          "fixed inset-y-0 left-0 z-[60] hidden h-[100dvh] shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:flex lg:h-screen lg:shadow-none",
          mobileOpen && "flex crm-sidebar-mobile-open",
          collapsed ? "w-[52px] lg:w-[52px]" : "w-[min(20rem,86vw)] lg:w-[220px]",
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-0" : "justify-between px-3")}>
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
            {collapsed ? (
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary">
                {logoUrl ? <img src={logoUrl} alt={companyName} className="h-5 w-5 object-contain" /> : <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />}
              </span>
            ) : (
              <img src={logoUrl} alt={companyName} className="h-7 w-auto max-w-[160px] object-contain" />
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-1.5 py-2 scrollbar-thin">
          {navSections.map((section, sectionIndex) => (
            <div key={section.label} className={cn(sectionIndex > 0 && "mt-2 border-t border-sidebar-border/60 pt-2")}>
              {!collapsed && <p className="sidebar-group-label px-2.5 pb-1.5 pt-1">{section.label}</p>}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const badge = badgeFor(item.path)
                  const active = isActive(item.path)
                  const link = (
                    <Link
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "relative flex items-center rounded-lg transition-colors",
                        collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 gap-2.5 px-2.5 text-sm",
                        active ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {Boolean(badge) && <span className={cn("flex items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground", collapsed ? "absolute right-0.5 top-0.5 h-3 min-w-3" : "h-5 min-w-5")}>{badge! > 99 ? "99+" : badge}</span>}
                    </Link>
                  )
                  return <li key={item.path}>{collapsed ? <Tooltip delayDuration={0}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip> : link}</li>
                })}
              </ul>
            </div>
          ))}
          <div className="mt-2 border-t border-sidebar-border/60 pt-2">
            <button type="button" onClick={() => setMoreOpen(true)} className={cn("flex items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground", collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm")}>
              <ChevronsRight className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Mais módulos</span>}
            </button>
          </div>
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-sidebar-border px-1.5 py-2">
          <button type="button" onClick={openSearch} className={cn("flex items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground", collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm")}>
            <Search className="h-4 w-4" />
            {!collapsed && <span>Pesquisar</span>}
          </button>
          <ThemeToggle collapsed={collapsed} />
          <button type="button" onClick={() => signOut()} className={cn("flex items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive", collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm")}>
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className={cn("hidden items-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex", collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm")}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Colapsar menu</span></>}
          </button>
        </div>
      </aside>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
