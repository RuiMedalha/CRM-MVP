/**
 * AI Integration — Geração de textos para propostas.
 * Chama Claude API directamente (Anthropic).
 * Fallback gracioso se indisponível.
 */

import type { NextStep } from "@/types/quotation";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `És um assistente de vendas da HotelEquip, empresa portuguesa de equipamentos HORECA. Escreve em português de Portugal.`;

async function callClaude(userPrompt: string): Promise<string | null> {
  // 1. Try unified AI router (MiniMax -> Claude -> Gemini -> GPT)
  try {
    const { aiRouter } = await import("@/services/ai/router");
    const result = await aiRouter.completeWithFallback(userPrompt, {
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 500,
    });
    if (result && result.text) {
      return result.text;
    }
  } catch (err) {
    console.warn("[quotationAI] aiRouter failed, trying direct Claude fallback", err);
  }

  // 2. Direct Anthropic API fallback if key is present
  if (!CLAUDE_API_KEY) return null;
  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text || null;
  } catch {
    return null;
  }
}

/**
 * Gerar mensagem de boas-vindas personalizada
 */
export async function generateWelcomeMessage(
  clientName: string,
  products: string[],
  tone: "formal" | "friendly" = "formal",
  clientCompany?: string
): Promise<string> {
  const productList = products.slice(0, 5).join(", ") || "equipamentos HORECA";

  const prompt = `Escreve uma mensagem de boas-vindas para proposta comercial para ${clientName}${clientCompany ? ` da empresa ${clientCompany}` : ""}. Produtos: ${productList}. Tom profissional mas próximo. Máximo 3 parágrafos. Sem assinatura.`;

  const result = await callClaude(prompt);
  return result || `Olá ${clientName}, é com prazer que lhe apresentamos a nossa proposta para os equipamentos que solicitou. Estamos à disposição para esclarecer qualquer dúvida.`;
}

/**
 * Gerar descrição de produto/serviço
 */
export async function generateItemDescription(
  productName: string,
  context?: string
): Promise<string> {
  const prompt = `Gera uma descrição curta (2-3 frases) para o seguinte produto/equipamento HORECA:
Produto: ${productName}
${context ? `Contexto: ${context}` : ""}
Foca nos benefícios práticos para restaurantes e hotéis.`;

  const result = await callClaude(prompt);
  return result || "";
}

/**
 * Gerar "O que acontece a seguir?" personalizado
 */
export async function generateNextSteps(): Promise<NextStep[]> {
  // Default HORECA steps (no AI needed for standard flow)
  return [
    {
      icon: "payment",
      title: "Confirmação do sinal",
      description: "Após aprovação, enviamos dados para pagamento do sinal.",
    },
    {
      icon: "phone",
      title: "Contacto do comercial",
      description: "O seu gestor de conta entra em contacto para confirmar detalhes.",
    },
    {
      icon: "calendar",
      title: "Entrega e instalação",
      description: "Agendamos a entrega e instalação no seu estabelecimento.",
    },
  ];
}

/**
 * Melhorar texto existente
 */
export async function improveText(text: string, instruction: string): Promise<string> {
  const prompt = `Melhora o seguinte texto segundo esta instrução: "${instruction}"

Texto original:
${text}

Mantém o mesmo comprimento aproximado. Responde apenas com o texto melhorado.`;

  const result = await callClaude(prompt);
  return result || text;
}
