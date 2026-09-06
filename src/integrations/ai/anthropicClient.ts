/**
 * Anthropic AI client — calls Directus /ai-proxy endpoint.
 * The actual AI proxy token stays server-side; the browser never sees it.
 * The model is configurable in Definições → company_settings.ai_model
 */

const DEFAULT_MODEL = "claude-haiku-4-5";

export function isAIConfigured(): boolean {
  return true;
}

async function getAIModel(): Promise<string> {
  try {
    const r = await fetch(
      `${import.meta.env.VITE_DIRECTUS_URL}/items/company_settings/1?fields=ai_model`,
      { headers: { Authorization: `Bearer ${import.meta.env.VITE_DIRECTUS_ADMIN_TOKEN}` } }
    );
    const d = await r.json();
    return d?.data?.ai_model || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export async function generateWithAI(prompt: string): Promise<string> {
  // 1. Try unified AI router (MiniMax -> Claude -> Gemini -> GPT)
  try {
    const { aiRouter } = await import("@/services/ai/router");
    const result = await aiRouter.completeWithFallback(prompt, {
      maxTokens: 512,
    });
    if (result && result.text) {
      return result.text;
    }
  } catch (err) {
    console.warn("[generateWithAI] aiRouter failed, trying Directus /ai-proxy fallback", err);
  }

  // 2. Directus /ai-proxy endpoint fallback if router fails
  try {
    const model = await getAIModel();
    const { directusRequest } = await import("@/integrations/directus/client");
    const data = await directusRequest<{ content?: { type: string; text: string }[] }>("/ai-proxy", {
      method: "POST",
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const textBlock = data?.content?.find((b) => b.type === "text");
    return textBlock?.text || "";
  } catch (e) {
    console.error("[generateWithAI] Directus /ai-proxy also failed:", e);
    return "";
  }
}

// ─── Pre-built prompts ──────────────────────────────────────────────────────

export function promptTermsConditions(productNames: string[], depositPercent: number): string {
  const products = productNames.length > 0 ? productNames.join(", ") : "equipamentos HORECA";
  return `Gera termos e condições profissionais em português para uma proposta comercial de equipamentos HORECA incluindo: ${products}. Sinal de ${depositPercent}%. Máximo 150 palavras. Incluir: validade, pagamento, prazo entrega, garantia, instalação. Apenas o texto, sem título.`;
}

export function promptProductDescription(productName: string): string {
  return `Escreve uma descrição comercial em português em 2 frases para "${productName}" destinada a hotelaria/restauração. Apenas o texto, sem aspas.`;
}

export function promptWelcomeMessage(customerName: string, companyName: string, productNames: string[]): string {
  const products = productNames.length > 0 ? productNames.join(", ") : "os equipamentos solicitados";
  return `Escreve uma mensagem de boas-vindas personalizada em português para ${customerName} da empresa ${companyName} para uma proposta de ${products}. Tom: profissional e caloroso. Máximo 3 frases. Apenas o texto.`;
}

export function promptNextSteps(productNames: string[], depositPercent: number): string {
  const products = productNames.length > 0 ? productNames.join(", ") : "equipamentos";
  return `Sugere 3 próximos passos para um cliente que aceita uma proposta de ${products} com sinal de ${depositPercent}%. Formato JSON array: [{"icon":"payment","title":"...","description":"..."},{"icon":"phone","title":"...","description":"..."},{"icon":"calendar","title":"...","description":"..."}]. Apenas o JSON, sem markdown.`;
}

export function promptProposalDescription(productNames: string[], customerName?: string, customerCompany?: string): string {
  const products = productNames.length > 0 ? productNames.join(", ") : "equipamentos HORECA";
  const clientInfo = customerName ? `${customerName}${customerCompany ? ` de ${customerCompany}` : ""}` : "o cliente";
  return `Escreve uma descrição de proposta comercial em português em 2-3 frases para ${products} destinada a ${clientInfo}. Tom: profissional. Apenas o texto, sem título.`;
}

export function promptProductSpecificationQuestions(
  productName: string,
  reviewReason: string,
  candidates?: string
): string {
  return `Gera 3-5 perguntas de descoberta em português europeu para perceber o equipamento certo para este pedido.

Produto/pedido do cliente: ${productName}
Razão interna da dúvida: ${reviewReason}
${candidates ? `\nCandidatos de pesquisa apenas para contexto interno (NÃO os uses como opções nem assumas que são certos): ${candidates}` : ""}

Formato JSON array:
[
  { "question": "...", "type": "text|number|choice|photo", "choices": [...], "followUpQuestion": { "opção": "pergunta extra..." } }
]

Regras críticas:
- NUNCA presumas tipo, escala, capacidade, formato, potência, voltagem ou modelo a partir dos candidatos.
- NÃO perguntes "quer X ou Y?" usando modelos/capacidades dos candidatos encontrados.
- NÃO ancores as perguntas num tipo específico (ex: túnel, capota, bancada) antes de perguntar o uso.
- Não assumas grande nem pequeno: a ausência de sinais claros é motivo para perguntar, não para adivinhar.
- Primeiro pergunta sobre USO e contexto: o que vai lavar/produzir/servir, volume aproximado, se substitui equipamento existente ou é instalação nova, onde ficará, energia/voltagem/gás disponível.
- Se o pedido for de lavagem de loiça/copos, segue este espírito: tipo de lavagem (copos/loiça/misto), substituição ou nova instalação, bancada/debaixo do balcão vs independente, energia disponível.
- Se fizer sentido incluir choices, usa opções genéricas de descoberta (ex: "copos e chávenas", "loiça/pratos", "misto", "não sei"), nunca nomes de candidatos.
- Quando uma opção precisar de detalhe extra, inclui followUpQuestion.
- A chave de followUpQuestion tem de ser IDÊNTICA, carácter a carácter, a uma das opções em choices — copia o texto exacto, não resumas.
- Exemplo válido: choices=["Espaço reduzido (cozinha compacta/balcão)"]; followUpQuestion={"Espaço reduzido (cozinha compacta/balcão)":"Indique as medidas disponíveis (largura x profundidade x altura)."}.
- Para perguntas de espaço, inclui opções como "Espaço reduzido" quando fizer sentido e followUpQuestion para pedir medidas.
- Inclui pergunta de foto apenas quando ajuda a perceber espaço/instalação.
- Perguntas simples e directas (< 90 caracteres cada), sem vender nem orçamentar.

Devolve apenas o JSON válido, sem markdown.`;
}
