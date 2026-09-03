/**
 * Barrel export — reexporta todos os tipos de domínio do CRM.
 *
 * Uso:
 *   import type { LeadItem, Employee, Quotation, Customer360Data } from "@/types";
 */

// ─── Domínio principal ───────────────────────────────────────────────────
export * from "./lead";
export * from "./employee";
export * from "./quotation";
export * from "./customer360";

// ─── Comunicações ─────────────────────────────────────────────────────────
export * from "./communication";
export * from "./conversation";
export * from "./message";

// ─── Directus (tipos crus do schema) ──────────────────────────────────────
export * from "./directus";

// ─── Operacional / eventos ───────────────────────────────────────────────
export * from "./operationalEvent";
export * from "./telecof";
