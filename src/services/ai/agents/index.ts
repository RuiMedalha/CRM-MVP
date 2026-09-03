/**
 * Card 16 — barrel export para os agentes AI.
 *
 * Os tipos canónicos vivem em `./types`. Os ficheiros `./leadQualifier`,
 * `./emailDrafter`, `./followupScheduler` importam-nos — não reexportamos
 * para evitar colisões de nomes no barrel.
 */

export * from "./types";
export * from "./runRecorder";
export {
  listAwaitingHumanAiAgentRuns,
  listAiAgentRuns,
  updateAiAgentRun,
} from "@/integrations/directus/ai-agent-runs";

// Funções públicas (não colidem com nomes de tipo)
export { qualifyLead } from "./leadQualifier";
export { draftEmail } from "./emailDrafter";
export { scheduleFollowup } from "./followupScheduler";