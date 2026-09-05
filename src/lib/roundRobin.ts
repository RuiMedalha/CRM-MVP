/**
 * Round-robin Lead & Call Assignment Engine.
 * Garante a distribuicao equitativa de novos leads, chamadas Telecof e conversas de WhatsApp
 * entre os comerciais activos da equipa, tal como no HubSpot e GoHighLevel.
 */

export interface AssignableAgent {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  active?: boolean;
}

const STORAGE_KEY_PREFIX = "crm_round_robin_last_index_";

/**
 * Obtém o próximo comercial da lista pelo algoritmo Round-Robin.
 * @param queueKey Identificador da fila (ex: 'leads', 'telecof', 'whatsapp')
 * @param agents Lista de comerciais disponíveis
 */
export function getNextRoundRobinAgent<T extends { id: string }>(
  queueKey: string,
  agents: T[]
): T | null {
  if (!agents || agents.length === 0) return null;
  if (agents.length === 1) return agents[0];

  const storageKey = `${STORAGE_KEY_PREFIX}${queueKey}`;
  let lastIndex = -1;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      lastIndex = parseInt(raw, 10);
    }
  } catch {
    lastIndex = -1;
  }

  const nextIndex = (lastIndex + 1) % agents.length;

  try {
    localStorage.setItem(storageKey, String(nextIndex));
  } catch {
    // Ignore localStorage errors
  }

  return agents[nextIndex];
}

/**
 * Reset ao ponteiro de rotação da fila
 */
export function resetRoundRobin(queueKey: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${queueKey}`);
  } catch {
    // Ignore
  }
}
