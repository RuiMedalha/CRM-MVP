import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import {
  Kanban,
  Factory,
  Plug,
  Settings,
  UserCog,
  IdCard,
  LayoutDashboard,
  Users,
  LogOut,
  FileText,
  Mail,
  CalendarClock,
  MessagesSquare,
  Inbox,
  BarChart3,
  ShoppingCart,
  Phone,
  FileCheck,
  Share2,
  Cable,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { cn } from "@/lib/utils";

interface MenuItem {
  icon: LucideIcon;
  label: string;
  path: string;
  superAdminOnly?: boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const sections: MenuSection[] = [
  {
    label: "Vendas",
    items: [
      { icon: LayoutDashboard, label: "Painel", path: "/dashboard" },
      { icon: IdCard, label: "Ficha de Cliente", path: "/customer360-shell" },
      { icon: Users, label: "Contactos", path: "/contactos" },
      { icon: UserCog, label: "Leads", path: "/leads" },
      { icon: Kanban, label: "Pipeline", path: "/pipeline" },
      { icon: FileCheck, label: "Propostas", path: "/propostas" },
      { icon: FileText, label: "Orçamentos", path: "/orcamentos" },
      { icon: CalendarClock, label: "Agenda", path: "/agenda" },
    ],
  },
  {
    label: "Comunicações",
    items: [
      { icon: Inbox, label: "Inbox", path: "/inbox" },
      { icon: MessagesSquare, label: "Chat", path: "/comunicacoes" },
      { icon: Phone, label: "Telecof", path: "/comunicacoes?channel=telecof" },
      { icon: Mail, label: "Email", path: "/email" },
      { icon: Cable, label: "Canais", path: "/canais" },
      { icon: Share2, label: "Redes Sociais", path: "/social" },
      { icon: Mail, label: "Newsletter", path: "/newsletter" },
    ],
  },
  {
    label: "Operação",
    items: [
      { icon: ShoppingCart, label: "Pedidos", path: "/pedidos" },
      { icon: Factory, label: "Fornecedores", path: "/fornecedores" },
      { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { icon: Plug, label: "Integrações", path: "/integracoes", superAdminOnly: true },
      { icon: Settings, label: "Definições", path: "/definicoes" },
      { icon: UserCog, label: "Utilizadores", path: "/utilizadores" },
    ],
  },
];

export default function MenuMobile() {
  const { signOut, user } = useAuth();
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const location = useLocation();

  return (
    <AppLayout>
      <div className="space-y-6 md:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu</h1>
          <p className="text-muted-foreground">Acesso rápido (mobile)</p>
        </div>

        <div className="space-y-5">
          {sections.map((section) => {
            const visibleItems = section.items.filter(
              (it) => !it.superAdminOnly || isSuperAdmin,
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label}>
                <p className="px-1 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
                <div className="grid gap-2">
                  {visibleItems.map((it) => {
                    const Icon = it.icon;
                    const isActive = location.pathname === it.path;
                    return (
                      <Card key={`${section.label}-${it.path}`}>
                        <CardContent className="p-2">
                          <Button
                            asChild
                            variant="ghost"
                            className={cn(
                              "w-full justify-start h-auto py-3",
                              isActive && "bg-accent text-accent-foreground",
                            )}
                          >
                            <Link to={it.path} className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{it.label}</span>
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Card>
            <CardContent className="p-2">
              <Button
                variant="ghost"
                className="w-full justify-start h-auto py-3 text-destructive hover:text-destructive"
                onClick={() => signOut()}
              >
                <span className="flex items-center gap-3">
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Sair</span>
                </span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Desktop: hide this page */}
      <div className="hidden md:block text-sm text-muted-foreground">
        Este menu é apenas para mobile.
      </div>
    </AppLayout>
  );
}
