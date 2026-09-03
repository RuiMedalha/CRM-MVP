import { ActivityFeedPopover } from "@/components/ActivityFeedPopover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="hidden md:flex items-center flex-1 gap-2">
        {/* Placeholder for search or breadcrumbs */}
      </div>
      <div className="flex items-center gap-2">
        <ActivityFeedPopover />
        <ThemeToggle />
      </div>
    </header>
  );
}
