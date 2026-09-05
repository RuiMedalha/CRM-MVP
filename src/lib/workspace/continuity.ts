export interface WorkRecord {
  id: string;
  title: string;
  kind: "task" | "proposal";
  state: "overdue" | "today" | "upcoming" | "unscheduled";
  dueAt?: string;
  contact: string;
  owner?: string;
  href: string;
  reason: string;
  amount?: number;
}

export function validTime(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function dueState(value: string | null | undefined, now: number): WorkRecord["state"] {
  const time = validTime(value);
  if (time === null) return "unscheduled";
  if (time < now) return "overdue";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" });
  return date.format(time) === date.format(now) ? "today" : "upcoming";
}

export function relationName(value: unknown, field: string, fallback: string): string {
  if (value && typeof value === "object" && field in value) {
    const name = (value as Record<string, unknown>)[field];
    if (typeof name === "string" && name.trim()) return name;
  }
  return fallback;
}

export function sortWork(items: WorkRecord[]): WorkRecord[] {
  const priority = { overdue: 0, today: 1, unscheduled: 2, upcoming: 3 };
  return [...items].sort((a, b) => priority[a.state] - priority[b.state] ||
    (validTime(a.dueAt) ?? Infinity) - (validTime(b.dueAt) ?? Infinity) || a.id.localeCompare(b.id));
}

export interface TaskInput {
  id: string; status?: string | null; completed_at?: string | null; title?: string | null;
  due_at?: string | null; contact_id?: unknown; assigned_employee_id?: unknown;
}
export function taskWork(rows: TaskInput[], now: number): WorkRecord[] {
  return rows.filter((r) => r.status === "open" && !r.completed_at).map((r) => ({
    id: `task:${r.id}`, title: r.title || "Seguimento sem título", kind: "task", state: dueState(r.due_at, now),
    dueAt: r.due_at || undefined, contact: relationName(r.contact_id, "company_name", "Contacto por associar"),
    owner: relationName(r.assigned_employee_id, "full_name", "Responsável por confirmar"),
    href: "/agenda", reason: validTime(r.due_at) !== null ? "Compromisso aberto na agenda" : "Falta definir o prazo deste compromisso",
  }));
}

export interface ProposalInput {
  id: string; quotation_number?: string | null; status?: string | null;
  follow_up_at?: string | null; customer_id?: unknown; total_amount?: number | string | null;
}
export function proposalWork(rows: ProposalInput[], now: number): WorkRecord[] {
  return rows.filter((r) => r.status === "sent" || r.status === "viewed").map((r) => {
    const amount = Number(r.total_amount);
    const state = dueState(r.follow_up_at, now);
    return {
      id: `proposal:${r.id}`, title: `Proposta ${r.quotation_number || r.id}`, kind: "proposal", state,
      dueAt: r.follow_up_at || undefined, contact: relationName(r.customer_id, "company_name", "Contacto por associar"),
      href: `/propostas/${encodeURIComponent(r.id)}`, reason: state === "unscheduled" ? "Falta marcar a próxima ação comercial" : "Seguimento comercial agendado",
      amount: r.total_amount != null && Number.isFinite(amount) ? amount : undefined,
    };
  });
}
