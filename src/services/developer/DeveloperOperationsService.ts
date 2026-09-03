/**
 * DeveloperOperationsService — interface e stubs para operações administrativas.
 * Nenhuma operação está implementada. Tudo lança "Not implemented".
 */

export interface DeveloperOperation {
  id: string;
  label: string;
  description: string;
  status: "ready" | "running" | "success" | "error" | "disabled";
  lastRunAt?: string;
}

export async function syncProductionToTest(): Promise<void> {
  throw new Error("Not implemented: syncProductionToTest");
}

export async function backupProduction(): Promise<void> {
  throw new Error("Not implemented: backupProduction");
}

export async function restoreTest(): Promise<void> {
  throw new Error("Not implemented: restoreTest");
}

export async function resetTest(): Promise<void> {
  throw new Error("Not implemented: resetTest");
}

export async function seedDemoData(): Promise<void> {
  throw new Error("Not implemented: seedDemoData");
}

export async function clearCache(): Promise<void> {
  throw new Error("Not implemented: clearCache");
}

export async function reindexSearch(): Promise<void> {
  throw new Error("Not implemented: reindexSearch");
}
