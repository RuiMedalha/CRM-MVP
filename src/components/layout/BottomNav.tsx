import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  CalendarCheck2,
  Headset,
  Kanban,
  UsersRound,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { mobileSection } from "@/lib/workspace/navigation";

interface BottomNavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
  badgeKey?: "unread" | "new";
}

const navItems: BottomNavItem[] = [
  { id: "today", icon: CalendarCheck2, label: "Hoje", path: "/" },
  { id: "attend", icon: Headset, label: "Atender", path: "/comunicacoes?channel=telecof", badgeKey: "unread" },
  { id: "business", icon: Kanban, label: "Negócios", path: "/pipeline" },
  { id: "contacts", icon: UsersRound, label: "Contactos", path: "/customer360-shell" },
  { id: "more", icon: Menu, label: "Mais", path: "/menu" },
];

export interface BottomNavProps {
  /** Override default items; rarely needed outside tests. */
  items?: BottomNavItem[];
}

export function BottomNav({ items = navItems }: BottomNavProps) {
  const location = useLocation();
  const currentSection = mobileSection(location.pathname);
  const unread = useNotificationStore((s) => s.badgeCounts.unreadCount);
  const fresh = useNotificationStore((s) => s.badgeCounts.newCount);

  const badgeValue = (key?: "unread" | "new") => {
    if (!key) return 0;
    return key === "unread" ? unread : fresh;
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="crm-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.04)] lg:hidden"
    >
      <div className="crm-bottom-nav-items grid h-[4.5rem] grid-cols-5 items-stretch px-1">
        {items.map((item) => {
          const isSelected = item.id ? currentSection === item.id : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          const count = badgeValue(item.badgeKey);
          return (
            <Link
              key={item.id || item.path}
              to={item.path}
              className={cn(
                "crm-bottom-nav-link relative flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isSelected ? "page" : undefined}
            >
              <div className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", isSelected && "bg-primary/10")}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                {count > 0 && (
                  <span
                    aria-label={`${count} não lidas`}
                    className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>
              <span className="text-[11px] truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;