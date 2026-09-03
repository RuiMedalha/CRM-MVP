import { useQuery } from "@tanstack/react-query";
import { directusRequest } from "@/integrations/directus/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Employee {
  id: number;
  full_name: string;
  email: string;
}

export function useCurrentEmployee() {
  const { user } = useAuth();
  const email = user?.email;

  const query = useQuery({
    queryKey: ["current-employee", email],
    queryFn: async (): Promise<Employee | null> => {
      if (!email) return null;
      const res = await directusRequest<{ data: Employee[] }>(
        `/items/employees?filter[email][_eq]=${encodeURIComponent(email)}&limit=1&fields=id,full_name,email`
      );
      return res?.data?.[0] ?? null;
    },
    enabled: !!email,
    staleTime: 1000 * 60 * 30, // 30 min — employee mapping rarely changes
  });

  return {
    employee: query.data ?? null,
    isLoading: query.isLoading,
  };
}
