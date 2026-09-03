import type { ReactNode } from "react";

interface Customer360LayoutProps {
  header: ReactNode;
  toolbar: ReactNode;
  /** Left column: org details + contacts */
  left: ReactNode;
  /** Center: command center + timeline */
  center: ReactNode;
  /** Right: pipeline + proposals + comms + AI */
  right: ReactNode;
}

export function Customer360Layout({ header, toolbar, left, center, right }: Customer360LayoutProps) {
  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">
      {/* Header cockpit */}
      {header}

      {/* Action toolbar */}
      <div className="border-b border-border bg-card px-5 py-2">
        {toolbar}
      </div>

      {/* Main 3-column grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[28%_44%_28%] min-h-0">
        {/* LEFT */}
        <div className="border-r border-border overflow-y-auto p-3 space-y-3 bg-card/40">
          {left}
        </div>

        {/* CENTER */}
        <div className="overflow-y-auto p-3 space-y-3">
          {center}
        </div>

        {/* RIGHT */}
        <div className="border-l border-border overflow-y-auto p-3 space-y-3 bg-card/40">
          {right}
        </div>
      </div>
    </div>
  );
}
