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
// Hidden on desktop (>768px) via lg:hidden; uses env(safe-area-inset-bottom).
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

/**
 * Card 17 — pill indicator animado (CSS var --pill-x).
 * A pill desliza entre items com cubic-bezier spring.
 */
export function BottomNav({ items = navItems }: BottomNavProps) {
  const location = useLocation();
  const unread = useNotificationStore((s) => s.badgeCounts.unreadCount);
  const fresh = useNotificationStore((s) => s.badgeCounts.newCount);

  const badgeValue = (key?: "unread" | "new") => {
    if (!key) return 0;
    return key === "unread" ? unread : fresh;
  };

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => location.pathname.startsWith(item.path)),
  );

  return (
    <nav
      aria-label="Navegação inferior"
      className="crm-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-brand-100/70 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px-12px_rgba(79,70,229,0.08)] backdrop-blur lg:hidden dark:bg-card/90 dark:border-brand-800/40"
    >
      <div
        className="crm-bottom-nav-items relative grid h-16 px-2"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="bottom-nav-pill"
          style={
            {
              ["--pill-x" as any]: `calc(${activeIndex} * ((100% - ${(items.length - 1) * 8}px) / ${items.length}) + 4px)`,
              width: `calc((100% - ${(items.length - 1) * 8}px) / ${items.length} - 8px)`,
            } as React.CSSProperties
          }
        />
        {items.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          const count = badgeValue(item.badgeKey);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "crm-bottom-nav-link relative z-10 flex min-h-[44px] flex-col items-center justify-center py-2 transition-colors duration-200",
                isActive
                  ? "text-brand-700 dark:text-brand-200"
                  : "text-foreground/60 dark:text-foreground/70 hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110",
                  )}
                />
                {count > 0 && (
                  <span
                    aria-label={`${count} não lidas`}
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-br from-[rgb(244,63,94)] to-[rgb(225,29,72)] px-1 text-[10px] font-bold text-white shadow-sm"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "mt-1 text-[11px] transition-all duration-200",
                  isActive ? "font-semibold" : "font-medium",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;