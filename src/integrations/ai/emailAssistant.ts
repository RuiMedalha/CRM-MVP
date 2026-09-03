import { generateWithAI } from "./anthropicClient";
import { directusRequest } from "@/integrations/directus/client";

/**
 * Assistente de IA para email — usa o proxy n8n (nunca a API directamente).
 * Todas as funções DEVOLVEM texto para o rascunho; NUNCA enviam nada.
 * O comercial revê e decide sempre (princípio: IA propõe, humano dispõe).
 */

/** Cached custom prompts from company_settings */
let cachedPrompts: Record<string, string> | null = null;
let promptsFetchedAt = 0;

async function getCustomPrompts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedPrompts && now - promptsFetchedAt < 300_000) return cachedPrompts;
  try {
    const res = await directusRequest<{ data: { ai_email_prompts: Record<string, string> | null } }>(
      "/items/company_settings/1?fields=ai_email_prompts"
    );
    cachedPrompts = res?.data?.ai_email_prompts || {};
    promptsFetchedAt = now;
    return cachedPrompts;
  } catch {
    return {};
  }
}

export interface EmailContext {
  /** Assunto do email a que se responde (opcional). */
  subject?: string;
  /** Corpo recebido do cliente / thread (opcional). */
  incoming?: string;
  /** Rascunho actual do comercial (para melhorar/traduzir). */
  draft?: string;
  /** Nome do remetente, para personalizar. */
  customerName?: string;
  /** Categoria do email (ex: fornecedor_sourcing, pedido_orcamento) */
  category?: string;
}

const BASE_INSTRUCTIONS =
  `Escreve em português de Portugal, tom profissional e cordial, próprio de uma empresa de equipamento de hotelaria (HotelEquip) com 30 anos.
Não inventes preços, prazos, números de conta, referências de pagamento, nem informações que não estejam no email original.
Se o email original é de um FORNECEDOR (ex: confirmação de encomenda, pedido de pagamento), responde como COMPRADOR (nós somos o cliente deles).
Se o email é de um CLIENTE nosso, responde como vendedor/assistência.
Devolve APENAS o corpo do email, sem assunto, sem saudação inicial tipo "Exmo. Sr.", sem assinatura (a assinatura é adicionada automaticamente depois).`;

/** Sugere uma resposta ao email recebido. */
export async function aiSuggestReply(ctx: EmailContext): Promise<string> {
  const customPrompts = await getCustomPrompts();
  const roleHint = ctx.category?.includes("fornecedor")
    ? "Este email é de um FORNECEDOR nosso. Nós somos o comprador/cliente."
    : ctx.category
      ? `Categoria: ${ctx.category}.`
      : "";
  const customInstructions = customPrompts.suggest || "";
  const prompt = [
    customInstructions || "Redige uma resposta adequada a este email recebido.",
    roleHint,
    ctx.customerName ? `Remetente: ${ctx.customerName}.` : "",
    ctx.subject ? `Assunto: ${ctx.subject}.` : "",
    ctx.incoming ? `Email recebido:\n\"\"\"${ctx.incoming}\"\"\"` : "",
    BASE_INSTRUCTIONS,
  ]
    .filter(Boolean)
    .join("\n");
  return (await generateWithAI(prompt)).trim();
}

/** Melhora o rascunho actual (clareza, gramática, tom) mantendo o sentido. */
export async function aiImprove(ctx: EmailContext): Promise<string> {
  const prompt = [
    "Melhora este rascunho de email (clareza, gramática, cordialidade), mantendo o sentido e as informações.",
    `Rascunho:\n\"\"\"${ctx.draft ?? ""}\"\"\"`,
    BASE_INSTRUCTIONS,
  ].join("\n");
  return (await generateWithAI(prompt)).trim();
}

/** Traduz o rascunho para outro idioma (default inglês). */
export async function aiTranslate(
  ctx: EmailContext,
  target = "inglês",
): Promise<string> {
  const prompt = [
    `Traduz este email para ${target}, mantendo o tom profissional e a formatação.`,
    `Texto:\n"""${ctx.draft ?? ""}"""`,
    "Devolve APENAS a tradução.",
  ].join("\n");
  return (await generateWithAI(prompt)).trim();
}

/** Resume uma thread longa em 2-3 linhas, para contexto rápido. */
export async function aiSummarizeThread(threadText: string): Promise<string> {
  const prompt = [
    "Resume esta troca de emails em 2-3 linhas, destacando o que o cliente pede e o que ficou pendente.",
    `Thread:\n"""${threadText}"""`,
    "Escreve em português de Portugal. Devolve apenas o resumo.",
  ].join("\n");
  return (await generateWithAI(prompt)).trim();
}
