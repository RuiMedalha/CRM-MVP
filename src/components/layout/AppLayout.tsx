import { ReactNode, forwardRef, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { QuickActions } from "@/components/QuickActions";
import WavoipWebphone from "@/components/communications/WavoipWebphone";
import { TelecofBanner } from "@/components/communications/TelecofBanner";
import { ActiveCallBar } from "@/components/communications/ActiveCallBar";
import { NotificationToastStack } from "@/components/communications/NotificationToastStack";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { useActivityFeedMonitor } from "@/hooks/useActivityFeedMonitor";
import { useCommunicationNotifications } from "@/hooks/useCommunicationNotifications";

interface AppLayoutProps {
  children: ReactNode;
  /** Fullscreen sem sidebar — só com embed={true} explícito */
  embed?: boolean;
  /** Full height sem scroll — para páginas que gerem o seu próprio overflow (ex: inbox) */
  fullHeight?: boolean;
}

export const AppLayout = forwardRef<HTMLDivElement, AppLayoutProps>(function AppLayout(
  { children, embed = false, fullHeight = false },
  ref,
) {
  useActivityFeedMonitor();
  // Phase 2.F5: Notificações omnicanal montadas globalmente (não só em Comunicações)
  useCommunicationNotifications();
  if (embed) {
    return (
      <div ref={ref} className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="crm-layout-content flex min-h-0 flex-1 flex-col overflow-hidden p-0">{children}</div>
        </main>
      </div>
    );
  }

  if (fullHeight) {
    return (
      <div ref={ref} className="flex h-[100dvh] w-full overflow-hidden bg-background">
        <WavoipWebphone />
        <AppSidebar />
        <main className="crm-layout-main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <TopBar />
          <TelecofBanner />
          <ActiveCallBar />
          <div className="crm-layout-content flex min-h-0 flex-1 flex-col overflow-auto p-0">{children}</div>
        </main>
        <BottomNav />
        <QuickActions />
        <NotificationToastStack />
        <GlobalSearch />
      </div>
    );
  }

  return (
    <div ref={ref} className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <WavoipWebphone />
      <AppSidebar />
      <main className="crm-layout-main flex min-h-0 min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <TopBar />
        <TelecofBanner />
        <ActiveCallBar />
        {/* Reduzir padding em tablet (md+ mas <lg) — em iPad landscape 1024x600
            com sidebar 220px + card de lead com botão 'Promover' de 110px fica
            apertado e o botão sai do viewport. md:p-4 (16px) em vez de p-6. */}
        <div className="crm-layout-content flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-4 lg:p-6">{children}</div>
      </main>
      <BottomNav />
      <QuickActions />
      <NotificationToastStack />
      <GlobalSearch />
    </div>
  );
});
