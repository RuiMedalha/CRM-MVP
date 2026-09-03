import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { directusRequest } from "@/integrations/directus/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface EmployeeActivity {
  name: string;
  deals: number;
  emails: number;
  proposals: number;
  value: number;
}

export function EmployeeActivityPanel() {
  const activityQuery = useQuery({
    queryKey: ["dashboard-employee-activity"],
    queryFn: async () => {
      try {
        const [employees, deals, emails] = await Promise.all([
          directusRequest<any>("/items/employees?limit=100"),
          directusRequest<any>("/items/deals?limit=500"),
          directusRequest<any>("/items/email_threads?limit=500"),
        ]);

        const empList = employees.data || [];
        const dealsList = deals.data || [];
        const emailsList = emails.data || [];

        const activity: Record<string, EmployeeActivity> = {};

        empList.forEach((emp: any) => {
          activity[emp.id] = {
            name: emp.full_name || emp.name || "Unknown",
            deals: 0,
            emails: 0,
            proposals: 0,
            value: 0,
          };
        });

        dealsList.forEach((deal: any) => {
          const empId = deal.assigned_to || deal.owner_id;
          if (empId && activity[empId]) {
            activity[empId].deals++;
            activity[empId].value += Number(deal.total_amount || 0);
          }
        });

        emailsList.forEach((email: any) => {
          const empId = email.assigned_to;
          if (empId && activity[empId]) {
            activity[empId].emails++;
          }
        });

        return Object.values(activity)
          .filter((a) => a.deals > 0 || a.emails > 0)
          .sort((a, b) => b.deals + b.emails - (a.deals + a.emails))
          .slice(0, 5);
      } catch (err) {
        return [];
      }
    },
    refetchInterval: 60000,
  });

  const chartData = useMemo(() => {
    return (activityQuery.data || []).map((emp) => ({
      name: emp.name.split(" ")[0],
      Negócios: emp.deals,
      Emails: emp.emails,
    }));
  }, [activityQuery.data]);

  if (activityQuery.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!chartData.length) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sem dados
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData}>
        <XAxis dataKey="name" style={{ fontSize: "12px" }} />
        <YAxis style={{ fontSize: "12px" }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
          cursor={{ fill: "hsl(var(--muted))" }}
        />
        <Bar dataKey="Negócios" fill="hsl(var(--primary))" />
        <Bar dataKey="Emails" fill="hsl(var(--warning))" />
      </BarChart>
    </ResponsiveContainer>
  );
}
