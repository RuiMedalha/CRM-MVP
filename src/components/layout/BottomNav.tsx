import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  MessagesSquare,
  Users,
  LayoutDashboard,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

interface BottomNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  badgeKey?: "unread" | "new";
}

// 4 tabs mobile-first per card-10: Conversas / Leads / Hoje / Definições.
// Hidden on desktop (>768px) via lg:hidden; uses env(safe-area-inset-bottom)
// for iOS notch devices. Unread badge comes from notificationStore (omnichannel).
const navItems: BottomNavItem[] = [
  { icon: MessagesSquare, label: "Conversas", path: "/inbox", badgeKey: "unread" },
  { icon: Users, label: "Leads", path: "/leads" },
  { icon: LayoutDashboard, label: "Hoje", path: "/dashboard" },
  { icon: SettingsIcon, label: "Definições", path: "/definicoes" },
];

export interface BottomNavProps {
  /** Override default items; rarely needed outside tests. */
  items?: BottomNavItem[];
}

export function BottomNav({ items = navItems }: BottomNavProps) {
  const location = useLocation();
  const unread = useNotificationStore((s) => s.badgeCounts.unreadCount);
  const fresh = useNotificationStore((s) => s.badgeCounts.newCount);

  const badgeValue = (key?: "unread" | "new") => {
    if (!key) return 0;
    return key === "unread" ? unread : fresh;
  };

  return (
    <nav
      aria-label="Navegação inferior"
      className="crm-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:shadow-[0_-1px_3px_rgba(0,0,0,0.4)] lg:hidden"
    >
      <div className="crm-bottom-nav-items flex items-end justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          const count = badgeValue(item.badgeKey);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "crm-bottom-nav-link relative flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-foreground/60 dark:text-foreground/70 hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {count > 0 && (
                  <span
                    aria-label={`${count} não lidas`}
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>
              <span className="mt-1 text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;