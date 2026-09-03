/**
 * Employee — tipos de domínio para colaboradores / agentes do CRM.
 *
 * Estes tipos modelam tanto utilizadores Directus (com campo `user`
 * opcional) como colaboradores internos (sales, admin, supervisor).
 */

export type EmployeeRole = "admin" | "supervisor" | "agent" | "manager";

export type EmployeeStatus = "active" | "inactive" | "away" | "offline";

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: EmployeeRole;
  status?: EmployeeStatus;
  /** Nome completo derivado (helper opcional). */
  name?: string;
  /** Telefone / extensão. */
  phone?: string | null;
  mobile_phone?: string | null;
  whatsapp_number?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  job_title?: string | null;
  manager_id?: string | null;
  /** Capacidades granulares para permissão checks. */
  capabilities?: string[];
  /** Channel preferido para atribuição automática. */
  preferred_channel?: string;
  /** Notification preferences. */
  notifications_enabled?: boolean;
  auto_assign_enabled?: boolean;

  /** Timestamps. */
  created_at?: string;
  updated_at?: string;
}
