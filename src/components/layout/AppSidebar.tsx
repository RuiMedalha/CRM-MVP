import { Link, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import {
  Building2,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  IdCard,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  MessagesSquare,
  Phone,
  Search,
  SendHorizontal,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import { useEmailUnassignedCount } from "@/hooks/useEmailThreads"
import { useChannelBadgeCounts } from "@/hooks/useChannelBadgeCounts"
import { useCompanySettings } from "@/hooks/useSettings"
import { cn } from "@/lib/utils"
import { useGlobalSearchStore } from "@/store/globalSearchStore"
import { useNotificationStore } from "@/store/notificationStore"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { MoreSheet } from "./MoreSheet"

export interface SubNavItem {
  label: string
  path: string
  dotClass?: string
  badgeKey?: string
}

export interface NavItem {
  icon: LucideIcon
  label: string
  path: string
  badgeKey?: string
  children?: SubNavItem[]
}

const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operação",
    items: [
      { icon: CalendarCheck2, label: "Hoje", path: "/" },
      { icon: LayoutDashboard, label: "Indicadores", path: "/painel" },
    ],
  },
  {
    label: "Comunicações",
    items: [
      { icon: Inbox, label: "Inbox", path: "/inbox", badgeKey: "inbox" },
      {
        icon: MessageCircle,
        label: "WhatsApp",
        path: "/comunicacoes?channel=whatsapp",
        badgeKey: "whatsapp",
        children: [
          { label: "Todos os números", path: "/comunicacoes?channel=whatsapp", badgeKey: "whatsapp" },
          { label: "WA · 916 542 271", path: "/comunicacoes?channel=waha", dotClass: "bg-amber-500", badgeKey: "wa916" },
          { label: "WA · 918 346 615", path: "/comunicacoes?channel=wa918", dotClass: "bg-emerald-500", badgeKey: "wa918" },
          { label: "WA · 913 866 565", path: "/comunicacoes?channel=wa913", dotClass: "bg-primary", badgeKey: "wa913" },
          { label: "Grupos WA", path: "/comunicacoes?channel=grupos", dotClass: "bg-purple-500", badgeKey: "grupos" },
        ],
      },
      { icon: Phone, label: "Telecof", path: "/comunicacoes?channel=telecof", badgeKey: "telecof" },
      { icon: MessagesSquare, label: "Chat", path: "/comunicacoes?channel=askme", badgeKey: "askme" },
      {
        icon: Mail,
        label: "Emails",
        path: "/email",
        badgeKey: "email",
        children: [
          { label: "Todas as caixas", path: "/email", badgeKey: "email" },
          { label: "Geral", path: "/email?mailbox=geral@hotelequip.pt", dotClass: "bg-emerald-500" },
          { label: "Apoio ao Cliente", path: "/email?mailbox=apoio.cliente@hotelequip.pt", dotClass: "bg-blue-500" },
        ],
      },
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
const SIDEBAR_SECTIONS_STATE_KEY = "sidebar:v2:sections"
const SIDEBAR_SUBMENUS_STATE_KEY = "sidebar:v2:submenus"

export function AppSidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  )
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_SECTIONS_STATE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      "Operação": true,
      "Comunicações": true,
      "Vendas": true,
      "Base": true,
      "Definições": true,
    }
  })

  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_SUBMENUS_STATE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      WhatsApp: true,
      Emails: true,
    }
  })

  const [moreOpen, setMoreOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { signOut } = useAuth()
  const { data: settings } = useCompanySettings()
  const unreadCount = useNotificationStore((s) => s.badgeCounts.unreadCount)
  const { data: emailUnassignedCount } = useEmailUnassignedCount()
  const channelBadgeCounts = useChannelBadgeCounts()
  const openSearch = useGlobalSearchStore((s) => s.open)
  const inboxTotal = (emailUnassignedCount ?? 0) + unreadCount
  const logoUrl = (settings as any)?.logo_url || "https://files.hotelequip.pt/public/logo.png"
  const companyName = (settings as any)?.name || "CRM Hotelequip"

  const toggleSection = (label: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [label]: prev[label] === false ? true : false }
      try {
        localStorage.setItem(SIDEBAR_SECTIONS_STATE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const toggleSubmenu = (label: string) => {
    setOpenSubmenus((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try {
        localStorage.setItem(SIDEBAR_SUBMENUS_STATE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }

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
  const isActive = (path: string, exact: boolean = false) => {
    if (currentPath === path) return true
    if (path === "/" && (location.pathname === "/" || location.pathname === "/hoje")) return true
    if (path === "/customer360-shell" && (location.pathname.startsWith("/customer360") || location.pathname.startsWith("/clientes"))) return true
    if (path === "/comunicacoes?channel=whatsapp" && location.pathname === "/comunicacoes" && (!location.search || location.search === "?channel=whatsapp")) return true
    if (path === "/comunicacoes?channel=telecof" && (location.pathname === "/telecof" || (location.pathname === "/comunicacoes" && location.search === "?channel=telecof"))) return true
    if (path === "/email") {
      if (exact) {
        return location.pathname === "/email" && !location.search
      }
      return location.pathname === "/email"
    }
    if (!exact && !path.includes("?") && path !== "/" && location.pathname.startsWith(path)) return true
    return false
  }

  // Auto-expand section & submenu if active path is inside it
  useEffect(() => {
    for (const section of navSections) {
      const sectionHasActive = section.items.some(
        (it) => isActive(it.path) || it.children?.some((ch) => isActive(ch.path, true)),
      )
      if (sectionHasActive) {
        setOpenSections((prev) => {
          if (prev[section.label] !== false) return prev
          const next = { ...prev, [section.label]: true }
          try {
            localStorage.setItem(SIDEBAR_SECTIONS_STATE_KEY, JSON.stringify(next))
          } catch {}
          return next
        })
      }

      for (const item of section.items) {
        if (item.children?.some((ch) => isActive(ch.path, true))) {
          setOpenSubmenus((prev) => {
            if (prev[item.label]) return prev
            const next = { ...prev, [item.label]: true }
            try {
              localStorage.setItem(SIDEBAR_SUBMENUS_STATE_KEY, JSON.stringify(next))
            } catch {}
            return next
          })
        }
      }
    }
  }, [location.pathname, location.search])

  const badgeFor = (badgeKey?: string, path?: string) => {
    if (badgeKey === "inbox" || path === "/inbox") return inboxTotal
    if (badgeKey === "whatsapp" || path === "/comunicacoes?channel=whatsapp") return channelBadgeCounts.whatsapp || unreadCount
    if (badgeKey === "waha" || badgeKey === "wa916") return channelBadgeCounts.waha
    if (badgeKey === "wa918") return channelBadgeCounts.wa918
    if (badgeKey === "wa913") return channelBadgeCounts.wa913
    if (badgeKey === "grupos") return channelBadgeCounts.grupos
    if (badgeKey === "telecof" || path?.includes("telecof")) return channelBadgeCounts.telecof
    if (badgeKey === "askme" || path?.includes("askme")) return channelBadgeCounts.askme
    if (badgeKey === "email" || path === "/email") return emailUnassignedCount ?? 0
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
          {navSections.map((section, sectionIndex) => {
            const isOpen = openSections[section.label] !== false
            return (
              <div key={section.label} className={cn(sectionIndex > 0 && "mt-2 border-t border-sidebar-border/60 pt-2")}>
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="sidebar-group-label group flex w-full items-center justify-between px-2.5 pb-1.5 pt-1 text-left transition-colors hover:text-sidebar-foreground cursor-pointer select-none"
                  >
                    <span>{section.label}</span>
                    <span className="text-muted-foreground/50 transition-colors group-hover:text-sidebar-foreground">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </span>
                  </button>
                ) : null}

                {(collapsed || isOpen) && (
                  <ul className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const badge = badgeFor(item.badgeKey, item.path)
                      const hasChildren = Boolean(item.children && item.children.length > 0)
                      const isSubOpen = openSubmenus[item.label] !== false
                      const hasActiveChild = item.children?.some((ch) => isActive(ch.path, true))
                      const active = isActive(item.path) || hasActiveChild

                      if (collapsed) {
                        return (
                          <li key={item.path}>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <Link
                                  to={item.path}
                                  onClick={() => setMobileOpen(false)}
                                  className={cn(
                                    "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                                    active
                                      ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  {Boolean(badge) && (
                                    <span className="absolute right-0.5 top-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                      {badge! > 99 ? "99+" : badge}
                                    </span>
                                  )}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="right">{item.label}</TooltipContent>
                            </Tooltip>
                          </li>
                        )
                      }

                      return (
                        <li key={item.path} className="space-y-0.5">
                          <div className="flex items-center">
                            <Link
                              to={item.path}
                              onClick={() => {
                                setMobileOpen(false)
                                if (hasChildren) {
                                  setOpenSubmenus((prev) => ({ ...prev, [item.label]: true }))
                                }
                              }}
                              className={cn(
                                "relative flex h-10 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                                active && !hasActiveChild
                                  ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                                  : active
                                  ? "text-sidebar-foreground font-medium hover:bg-sidebar-accent"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              {Boolean(badge) && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                                  {badge! > 99 ? "99+" : badge}
                                </span>
                              )}
                            </Link>
                            {hasChildren && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  toggleSubmenu(item.label)
                                }}
                                aria-label={isSubOpen ? `Fechar ${item.label}` : `Abrir ${item.label}`}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors mr-1 cursor-pointer"
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-3.5 w-3.5 transition-transform duration-200",
                                    !isSubOpen && "-rotate-90",
                                  )}
                                />
                              </button>
                            )}
                          </div>

                          {hasChildren && isSubOpen && (
                            <ul className="ml-4 space-y-0.5 border-l border-sidebar-border/50 py-0.5 pl-2">
                              {item.children!.map((child) => {
                                const childActive = isActive(child.path, true)
                                const childBadge = badgeFor(child.badgeKey, child.path)
                                return (
                                  <li key={child.path}>
                                    <Link
                                      to={child.path}
                                      onClick={() => setMobileOpen(false)}
                                      className={cn(
                                        "group flex h-8 items-center gap-2 rounded-md px-2 text-xs transition-colors",
                                        childActive
                                          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                                      )}
                                    >
                                      {child.dotClass ? (
                                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", child.dotClass)} />
                                      ) : (
                                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-sidebar-border group-hover:bg-sidebar-foreground/50" />
                                      )}
                                      <span className="min-w-0 flex-1 truncate">{child.label}</span>
                                      {Boolean(childBadge) && (
                                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive/15 px-1 text-[9px] font-bold text-destructive">
                                          {childBadge > 99 ? "99+" : childBadge}
                                        </span>
                                      )}
                                    </Link>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
          <div className="mt-2 border-t border-sidebar-border/60 pt-2">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm",
              )}
            >
              <ChevronsRight className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Mais módulos</span>}
            </button>
          </div>
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-sidebar-border px-1.5 py-2">
          <button
            type="button"
            onClick={openSearch}
            className={cn(
              "flex items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm",
            )}
          >
            <Search className="h-4 w-4" />
            {!collapsed && <span>Pesquisar</span>}
          </button>
          <ThemeToggle collapsed={collapsed} />
          <button
            type="button"
            onClick={() => signOut()}
            className={cn(
              "flex items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive",
              collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm",
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "hidden items-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex",
              collapsed ? "mx-auto h-10 w-10 justify-center" : "h-10 w-full gap-2.5 px-2.5 text-sm",
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Colapsar menu</span></>}
          </button>
        </div>
      </aside>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
