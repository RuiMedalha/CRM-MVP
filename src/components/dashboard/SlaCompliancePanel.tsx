import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { directusRequest } from "@/integrations/directus/client";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

export function SlaCompliancePanel() {
  const emailStatsQuery = useQuery({
    queryKey: ["dashboard-sla-stats"],
    queryFn: async () => {
      try {
        const threads = await directusRequest<any>("/items/email_threads?limit=500&filter[status][_neq]=closed");
        const messages = threads.data || [];

        const now = new Date().getTime();
        const fourHoursMs = 4 * 60 * 60 * 1000;

        let onTime = 0;
        let delayed = 0;
        let avgResponseTime = 0;

        messages.forEach((msg: any) => {
          const created = new Date(msg.date_created || "").getTime();
          const firstResponse = msg.date_first_response ? new Date(msg.date_first_response).getTime() : null;

          if (firstResponse) {
            const responseTime = firstResponse - created;
            avgResponseTime += responseTime;
            responseTime <= fourHoursMs ? onTime++ : delayed++;
          }
        });

        const total = onTime + delayed;
        const avgResponseHours = total > 0 ? (avgResponseTime / total / (60 * 60 * 1000)).toFixed(1) : "0";
        const compliance = total > 0 ? ((onTime / total) * 100).toFixed(0) : "0";

        return {
          onTime,
          delayed,
          total,
          compliance: Number(compliance),
          avgResponseHours: Number(avgResponseHours),
        };
      } catch (err) {
        return {
          onTime: 0,
          delayed: 0,
          total: 0,
          compliance: 0,
          avgResponseHours: 0,
        };
      }
    },
    refetchInterval: 60000,
  });

  const stats = emailStatsQuery.data || { onTime: 0, delayed: 0, total: 0, compliance: 0, avgResponseHours: 0 };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-3xl font-bold text-emerald-600">{stats.compliance}%</p>
        <p className="text-xs text-muted-foreground">Conformidade SLA (4h)</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">{stats.onTime}</p>
            <p className="text-xs text-muted-foreground">No prazo</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <div>
            <p className="text-sm font-medium">{stats.delayed}</p>
            <p className="text-xs text-muted-foreground">Atrasados</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Tempo médio</p>
          <p className="text-sm font-medium">{stats.avgResponseHours}h</p>
        </div>
      </div>
    </div>
  );
}
