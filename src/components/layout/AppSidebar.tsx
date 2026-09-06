import { Link, useLocation } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import {
  BarChart3,
  Building2,
  Cable,
  CalendarCheck2,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Factory,
  FileText,
  IdCard,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  MessagesSquare,
  Package,
  Phone,
  Plug,
  Search,
  SendHorizontal,
  Settings,
  Share2,
  ShoppingBag,
  ShoppingCart,
  UserCog,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/contexts/AuthContext"
import { isSuperAdminEmail } from "@/lib/superadmin"
import { useEmailUnassignedCount } from "@/hooks/useEmailThreads"
import { useChannelBadgeCounts } from "@/hooks/useChannelBadgeCounts"
import { useCompanySettings } from "@/hooks/useSettings"
import { cn } from "@/lib/utils"
import { useGlobalSearchStore } from "@/store/globalSearchStore"
import { useNotificationStore } from "@/store/notificationStore"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

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
  superAdminOnly?: boolean
  children?: SubNavItem[]
}

export interface NavSectionColor {
  badgeBg: string
  badgeText: string
  badgeBorder: string
  activeBorder: string
  activeBg: string
  interiorBorder: string
  interiorBg: string
  dot: string
}

export interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  color: NavSectionColor
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    id: "comunicacoes",
    label: "Comunicações",
    icon: MessagesSquare,
    color: {
      badgeBg: "bg-emerald-500/15",
      badgeText: "text-emerald-400",
      badgeBorder: "border-emerald-500/30",
      activeBorder: "border-emerald-500",
      activeBg: "bg-emerald-950/25",
      interiorBorder: "border-emerald-500/40",
      interiorBg: "bg-emerald-500/[0.03]",
      dot: "bg-emerald-400",
    },
    items: [
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
      { icon: Inbox, label: "Inbox", path: "/inbox", badgeKey: "inbox" },
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
      { icon: MessagesSquare, label: "Chat", path: "/comunicacoes?channel=askme", badgeKey: "askme" },
    ],
  },
  {
    id: "clientes",
    label: "Clientes & Contactos",
    icon: Users,
    color: {
      badgeBg: "bg-sky-500/15",
      badgeText: "text-sky-400",
      badgeBorder: "border-sky-500/30",
      activeBorder: "border-sky-500",
      activeBg: "bg-sky-950/25",
      interiorBorder: "border-sky-500/40",
      interiorBg: "bg-sky-500/[0.03]",
      dot: "bg-sky-400",
    },
    items: [
      { icon: Users, label: "Contactos", path: "/contactos" },
      { icon: IdCard, label: "Ficha de Cliente", path: "/customer360-shell" },
    ],
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: Kanban,
    color: {
      badgeBg: "bg-purple-500/15",
      badgeText: "text-purple-400",
      badgeBorder: "border-purple-500/30",
      activeBorder: "border-purple-500",
      activeBg: "bg-purple-950/25",
      interiorBorder: "border-purple-500/40",
      interiorBg: "bg-purple-500/[0.03]",
      dot: "bg-purple-400",
    },
    items: [
      { icon: Kanban, label: "Pipeline", path: "/pipeline" },
      { icon: UserCog, label: "Leads", path: "/leads" },
      { icon: SendHorizontal, label: "Propostas", path: "/propostas" },
      { icon: FileText, label: "Orçamentos", path: "/orcamentos" },
      { icon: CalendarClock, label: "Agenda", path: "/agenda" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    icon: Package,
    color: {
      badgeBg: "bg-amber-500/15",
      badgeText: "text-amber-400",
      badgeBorder: "border-amber-500/30",
      activeBorder: "border-amber-500",
      activeBg: "bg-amber-950/25",
      interiorBorder: "border-amber-500/40",
      interiorBg: "bg-amber-500/[0.03]",
      dot: "bg-amber-400",
    },
    items: [
      { icon: CalendarCheck2, label: "Hoje", path: "/" },
      { icon: LayoutDashboard, label: "Indicadores", path: "/painel" },
      { icon: Package, label: "Encomendas", path: "/pedidos" },
      { icon: ShoppingCart, label: "Carrinhos", path: "/carrinhos" },
      { icon: ShoppingBag, label: "Loja", path: "/loja" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
      { icon: Factory, label: "Fornecedores", path: "/fornecedores" },
      { icon: Cable, label: "Canais", path: "/canais" },
      { icon: Share2, label: "Redes Sociais", path: "/social" },
      { icon: Mail, label: "Newsletter", path: "/newsletter" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    color: {
      badgeBg: "bg-slate-500/15",
      badgeText: "text-slate-300",
      badgeBorder: "border-slate-500/30",
      activeBorder: "border-slate-400",
      activeBg: "bg-slate-900/35",
      interiorBorder: "border-slate-500/40",
      interiorBg: "bg-slate-500/[0.03]",
      dot: "bg-slate-400",
    },
    items: [
      { icon: Settings, label: "Definições", path: "/definicoes" },
      { icon: Users, label: "Utilizadores", path: "/utilizadores" },
      { icon: Zap, label: "Workflows", path: "/definicoes/workflows" },
      { icon: Plug, label: "Integrações", path: "/integracoes", superAdminOnly: true },
      { icon: Wrench, label: "Dev Tools", path: "/developer-tools", superAdminOnly: true },
    ],
  },
]

const SIDEBAR_COLLAPSED_KEY = "sidebar:v2:collapsed"
const SIDEBAR_ACTIVE_SECTION_KEY = "sidebar:v2:active_section"
const SIDEBAR_SUBMENUS_STATE_KEY = "sidebar:v2:submenus"

export function AppSidebar() {
  const location = useLocation()
  const { signOut, user } = useAuth()
  const isSuperAdmin = isSuperAdminEmail(user?.email)

  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1",
  )

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

  // Identifica a secção correspondente à rota atual
  const findSectionForCurrentPath = (): string | null => {
    for (const section of navSections) {
      const match = section.items.some(
        (it) => isActive(it.path) || it.children?.some((ch) => isActive(ch.path, true)),
      )
      if (match) return section.label
    }
    return null
  }

  // Accordion Exclusivo: Apenas uma secção aberta de cada vez
  const [activeSection, setActiveSection] = useState<string | null>(() => {
    if (typeof window === "undefined") return "Comunicações"
    const current = findSectionForCurrentPath()
    if (current) return current
    const saved = localStorage.getItem(SIDEBAR_ACTIVE_SECTION_KEY)
    if (saved) return saved
    return "Comunicações"
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

  const [mobileOpen, setMobileOpen] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: settings } = useCompanySettings()
  const unreadCount = useNotificationStore((s) => s.badgeCounts.unreadCount)
  const { data: emailUnassignedCount } = useEmailUnassignedCount()
  const channelBadgeCounts = useChannelBadgeCounts()
  const openSearch = useGlobalSearchStore((s) => s.open)
  const inboxTotal = (emailUnassignedCount ?? 0) + unreadCount
  const logoUrl = (settings as any)?.logo_url || "https://files.hotelequip.pt/public/logo.png"
  const companyName = (settings as any)?.name || "CRM Hotelequip"

  // Gestão de abertura por clique (accordion exclusivo)
  const handleSectionClick = (label: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setActiveSection((current) => {
      const next = current === label ? null : label
      try {
        if (next) {
          localStorage.setItem(SIDEBAR_ACTIVE_SECTION_KEY, next)
        } else {
          localStorage.removeItem(SIDEBAR_ACTIVE_SECTION_KEY)
        }
      } catch {}
      return next
    })
  }

  // Gestão de abertura por hover (passar com o rato com debounce de 180ms)
  const handleSectionMouseEnter = (label: string) => {
    if (collapsed) return
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveSection(label)
      try {
        localStorage.setItem(SIDEBAR_ACTIVE_SECTION_KEY, label)
      } catch {}
    }, 180)
  }

  const handleSectionMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
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

  // Limpeza de timers no unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

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

  // Auto-expandir secção e submenu se a rota ativa mudar
  useEffect(() => {
    const currentSection = findSectionForCurrentPath()
    if (currentSection && activeSection !== currentSection) {
      setActiveSection(currentSection)
      try {
        localStorage.setItem(SIDEBAR_ACTIVE_SECTION_KEY, currentSection)
      } catch {}
    }

    for (const section of navSections) {
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
          collapsed ? "w-[60px] lg:w-[60px]" : "w-[min(20rem,86vw)] lg:w-[260px]",
        )}
      >
        <div className={cn("flex h-14 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-0" : "justify-between px-4")}>
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2" onClick={() => setMobileOpen(false)}>
            {collapsed ? (
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary">
                {logoUrl ? <img src={logoUrl} alt={companyName} className="h-5 w-5 object-contain" /> : <Settings className="h-4 w-4 text-sidebar-primary-foreground" />}
              </span>
            ) : (
              <img src={logoUrl} alt={companyName} className="h-7 w-auto max-w-[170px] object-contain" />
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-2.5 scrollbar-thin">
          {navSections.map((section, sectionIndex) => {
            const visibleItems = section.items.filter((it) => !it.superAdminOnly || isSuperAdmin)
            if (visibleItems.length === 0) return null

            const SectionIcon = section.icon
            const isOpen = activeSection === section.label
            const sectionHasActive = visibleItems.some(
              (it) => isActive(it.path) || it.children?.some((ch) => isActive(ch.path, true)),
            )
            const sectionBadgeTotal = visibleItems.reduce((acc, it) => acc + badgeFor(it.badgeKey, it.path), 0)

            return (
              <div
                key={section.label}
                className={cn(sectionIndex > 0 && "mt-2 border-t border-sidebar-border/40 pt-2")}
                onMouseLeave={handleSectionMouseLeave}
              >
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => handleSectionClick(section.label)}
                    onMouseEnter={() => handleSectionMouseEnter(section.label)}
                    className={cn(
                      "group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all duration-150 cursor-pointer select-none",
                      isOpen
                        ? cn("bg-sidebar-accent text-sidebar-foreground shadow-xs border-l-[3px]", section.color.activeBorder, section.color.activeBg)
                        : sectionHasActive
                        ? "text-sidebar-foreground/95 bg-sidebar-accent/35 hover:bg-sidebar-accent/55"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs transition-transform duration-150 group-hover:scale-105",
                          section.color.badgeBg,
                          section.color.badgeText,
                          section.color.badgeBorder,
                        )}
                      >
                        <SectionIcon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-semibold tracking-normal">
                        {section.label}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {Boolean(sectionBadgeTotal > 0) && (
                        <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground animate-pulse">
                          {sectionBadgeTotal > 99 ? "99+" : sectionBadgeTotal}
                        </span>
                      )}
                      {sectionHasActive && !isOpen && !sectionBadgeTotal && (
                        <span className={cn("h-2 w-2 rounded-full animate-pulse", section.color.dot)} />
                      )}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground/60 transition-transform duration-200 group-hover:text-sidebar-foreground",
                          !isOpen && "-rotate-90",
                        )}
                      />
                    </span>
                  </button>
                ) : (
                  <div className="flex justify-center py-1.5">
                    <span className={cn("h-1 w-5 rounded-full opacity-60", section.color.dot)} />
                  </div>
                )}

                {(collapsed || isOpen) && (
                  <div
                    className={cn(
                      !collapsed && cn(
                        "mt-1.5 ml-3 pl-2.5 py-1 border-l-2 space-y-1 animate-in fade-in-50 duration-150 rounded-r-lg",
                        section.color.interiorBorder,
                        section.color.interiorBg,
                      ),
                    )}
                  >
                    <ul className="space-y-1">
                      {visibleItems.map((item) => {
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
                                        ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-xs"
                                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                    )}
                                  >
                                    <Icon className="h-4.5 w-4.5 shrink-0" />
                                    {Boolean(badge) && (
                                      <span className="absolute right-0 top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                                        {badge! > 99 ? "99+" : badge}
                                      </span>
                                    )}
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="flex items-center gap-1.5 text-xs">
                                  <span className={cn("h-1.5 w-1.5 rounded-full", section.color.dot)} />
                                  <span className="font-semibold">{item.label}</span>
                                  <span className="text-[11px] text-muted-foreground">({section.label})</span>
                                </TooltipContent>
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
                                  "relative flex h-9.5 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                                  active && !hasActiveChild
                                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-xs"
                                    : active
                                    ? "text-sidebar-foreground font-semibold hover:bg-sidebar-accent"
                                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground font-medium",
                                )}
                              >
                                <Icon className="h-4.5 w-4.5 shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-[13.5px] leading-tight">{item.label}</span>
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
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors mr-1 cursor-pointer"
                                >
                                  <ChevronDown
                                    className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      !isSubOpen && "-rotate-90",
                                    )}
                                  />
                                </button>
                              )}
                            </div>

                            {hasChildren && isSubOpen && (
                              <ul className="ml-4 space-y-1 border-l border-sidebar-border/60 py-1 pl-2.5">
                                {item.children!.map((child) => {
                                  const childActive = isActive(child.path, true)
                                  const childBadge = badgeFor(child.badgeKey, child.path)
                                  return (
                                    <li key={child.path}>
                                      <Link
                                        to={child.path}
                                        onClick={() => setMobileOpen(false)}
                                        className={cn(
                                          "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-xs transition-colors",
                                          childActive
                                            ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                                        )}
                                      >
                                        {child.dotClass ? (
                                          <span className={cn("h-2 w-2 rounded-full shrink-0", child.dotClass)} />
                                        ) : (
                                          <span className="h-2 w-2 rounded-full shrink-0 bg-sidebar-border group-hover:bg-sidebar-foreground/50" />
                                        )}
                                        <span className="min-w-0 flex-1 truncate text-[12.5px]">{child.label}</span>
                                        {Boolean(childBadge) && (
                                          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-[9px] font-bold text-destructive">
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
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer Actions */}
        <div className="shrink-0 space-y-1 border-t border-sidebar-border px-2 py-2.5">
          <button
            type="button"
            onClick={openSearch}
            className={cn(
              "flex items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
              collapsed ? "mx-auto h-10 w-10 justify-center" : "h-9.5 w-full gap-2.5 px-2.5 text-sm font-medium",
            )}
          >
            <Search className="h-4.5 w-4.5" />
            {!collapsed && <span>Pesquisar</span>}
          </button>
          <ThemeToggle collapsed={collapsed} />
          <button
            type="button"
            onClick={() => signOut()}
            className={cn(
              "flex items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive transition-colors",
              collapsed ? "mx-auto h-10 w-10 justify-center" : "h-9.5 w-full gap-2.5 px-2.5 text-sm font-medium",
            )}
          >
            <LogOut className="h-4.5 w-4.5" />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "hidden items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors lg:flex",
              collapsed ? "mx-auto h-10 w-10 justify-center" : "h-9.5 w-full gap-2.5 px-2.5 text-sm font-medium",
            )}
          >
            {collapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <><ChevronLeft className="h-4.5 w-4.5" /><span>Colapsar menu</span></>}
          </button>
        </div>
      </aside>
    </>
  )
}
