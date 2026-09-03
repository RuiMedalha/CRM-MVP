import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FileText,
  Phone,
  CalendarClock,
  ShoppingBag,
  Cable,
  Package,
  ShoppingCart,
  Share2,
  Mail,
  BarChart3,
  Factory,
  Plug,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface MoreNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  superAdminOnly?: boolean;
}

interface MoreSection {
  label: string;
  items: MoreNavItem[];
}

const moreSections: MoreSection[] = [
  {
    label: "Vendas",
    items: [
      { icon: FileText, label: "Orçamentos", path: "/orcamentos" },
      { icon: CalendarClock, label: "Agenda", path: "/agenda" },
      { icon: ShoppingBag, label: "Loja", path: "/loja" },
      { icon: Cable, label: "Canais", path: "/canais" },
    ],
  },
  {
    label: "Operação",
    items: [
      { icon: Phone, label: "Telecof", path: "/comunicacoes?channel=telecof" },
      { icon: Package, label: "Encomendas", path: "/pedidos" },
      { icon: ShoppingCart, label: "Carrinhos", path: "/carrinhos" },
      { icon: Factory, label: "Fornecedores", path: "/fornecedores" },
      { icon: Mail, label: "Newsletter", path: "/newsletter" },
      { icon: Share2, label: "Redes Sociais", path: "/social" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Plug, label: "Integrações", path: "/integracoes", superAdminOnly: true },
      { icon: Settings, label: "Definições", path: "/definicoes" },
      { icon: Users, label: "Utilizadores", path: "/utilizadores" },
      { icon: Wrench, label: "Dev Tools", path: "/developer-tools", superAdminOnly: true },
    ],
  },
];

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * MoreSheet — drawer lateral-direito com os 14 módulos secundários do CRM.
 * Substitui o "Mais" tradicional. Fecha ao navegar.
 */
export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const location = useLocation();
  const { user } = useAuth();
  const isSuperAdmin = isSuperAdminEmail(user?.email);

  // Fecha ao mudar de rota
  useEffect(() => {
    if (open) onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Mais</SheetTitle>
          <SheetDescription>Todos os módulos do CRM.</SheetDescription>
        </SheetHeader>

        <nav className="mt-4">
          {moreSections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.superAdminOnly || isSuperAdmin,
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label} className="mb-5">
                <p className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
                <ul className="grid gap-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={cn(
                            "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-foreground/80 hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1">{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
