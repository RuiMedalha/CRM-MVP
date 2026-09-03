/**
 * Utilitário de retry para chamadas aos adaptadores de IA.
 * Executa a operação e, em caso de erro, repete 1 vez com delay.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 500
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) {
        throw err;
      }
      attempt++;
      console.warn(`[AI Adapter Retry] Tentativa ${attempt} falhou, repetindo em ${delayMs}ms...`, err);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}
