import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function useDesktopDialog() {
  const [desktop, setDesktop] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** Controlled modal which uses a centered Dialog on desktop and a full-screen bottom Sheet on mobile. */
export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialog({ open, onOpenChange, title, description, children, className }: ResponsiveDialogProps) {
  const desktop = useDesktopDialog();
  if (desktop) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={className}><DialogHeader><DialogTitle>{title}</DialogTitle>{description ? <DialogDescription>{description}</DialogDescription> : null}</DialogHeader>{children}</DialogContent></Dialog>;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="bottom" className={cn("h-[100dvh] max-h-[100dvh] overflow-y-auto rounded-t-2xl", className)}><SheetHeader><SheetTitle>{title}</SheetTitle>{description ? <SheetDescription>{description}</SheetDescription> : null}</SheetHeader>{children}</SheetContent></Sheet>;
}
