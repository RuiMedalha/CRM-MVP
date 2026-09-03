import { useState } from "react";
import { Bell, X, Trash2, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActivityFeedStore, type ActivityItem } from "@/store/activityFeedStore";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  lead: { icon: "📞", color: "text-destructive", label: "Lead" },
  email: { icon: "📧", color: "text-orange-600", label: "Email" },
  deal: { icon: "🎯", color: "text-blue-600", label: "Negócio" },
  proposal: { icon: "📄", color: "text-purple-600", label: "Proposta" },
  contact: { icon: "👤", color: "text-primary", label: "Contacto" },
};

function ActivityItemRow({ activity, onRead }: { activity: ActivityItem; onRead: () => void }) {
  const config = ACTIVITY_CONFIG[activity.type];
  const timeAgo = getTimeAgo(activity.timestamp);

  const content = (
    <div className="flex gap-3 p-2 rounded-lg hover:bg-muted transition-colors group">
      <div className="text-lg flex-shrink-0">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{activity.title}</p>
        {activity.description && (
          <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>
      {!activity.read && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
      )}
    </div>
  );

  if (activity.actionUrl) {
    return (
      <Link to={activity.actionUrl} onClick={onRead}>
        {content}
      </Link>
    );
  }

  return <div onClick={onRead}>{content}</div>;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins}m`;
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${diffDays}d`;
}

export function ActivityFeedPopover() {
  const [open, setOpen] = useState(false);
  const { activities, markAsRead, clearAll, getUnreadCount } = useActivityFeedStore();
  const unreadCount = getUnreadCount();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-sm">Actividade</h2>
          {activities.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearAll()}
              className="h-6 px-2"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">Sem actividade recente</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {activities.map((activity) => (
                <ActivityItemRow
                  key={activity.id}
                  activity={activity}
                  onRead={() => {
                    markAsRead(activity.id);
                    if (activity.actionUrl) {
                      setOpen(false);
                    }
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
