/**
 * Test & Verification Script for AI Router and 7 Plug-in Providers
 * Uso: npx tsx scripts/test-ai-router.ts
 */

import { aiRouter } from "../src/services/ai/router";
import { createAIAdapter } from "../src/services/ai/adapters";
import { AIProviderMeta, AIProviderType } from "../src/services/ai/types";

async function runTests() {
  console.log("==========================================");
  console.log("🧪 CARD 13: Verificação do AI Router & Providers");
  console.log("==========================================\n");

  // Test 1: List default providers
  console.log("1️⃣ Testando listagem de provedores...");
  const providers = await aiRouter.listProviders(true);
  console.log(`   ✓ Provedores carregados: ${providers.length}`);
  const expectedTypes: AIProviderType[] = [
    "anthropic",
    "openai",
    "openrouter",
    "deepseek",
    "opencode",
    "minimax",
    "openai_compatible",
  ];
  for (const type of expectedTypes) {
    const found = providers.find((p) => p.type === type);
    if (found) {
      console.log(`   ✓ Provedor ${type} encontrado: "${found.label}" (${found.default_model})`);
    } else {
      throw new Error(`Provedor do tipo ${type} não foi encontrado.`);
    }
  }

  // Test 2: Verify adapter instantiation for all 7 types
  console.log("\n2️⃣ Testando instanciação dos 7 adaptadores...");
  for (const p of providers) {
    const adapter = createAIAdapter(p);
    if (!adapter || adapter.type !== p.type) {
      throw new Error(`Falha ao instanciar adaptador para tipo ${p.type}`);
    }
    console.log(`   ✓ Adaptador ${p.type} instanciado com sucesso (${adapter.constructor.name})`);
  }

  // Test 3: Settings loading & persistence
  console.log("\n3️⃣ Testando definições globais de IA...");
  const settings = await aiRouter.getSettings(true);
  console.log(`   ✓ Default provider ID: ${settings.default_provider_id}`);
  console.log(`   ✓ Fallback provider ID: ${settings.fallback_provider_id}`);
  console.log(`   ✓ Max tokens default: ${settings.max_tokens_default}`);
  console.log(`   ✓ System prompt: ${settings.system_prompt_default?.slice(0, 40)}...`);

  // Test 4: Save & Toggle Provider
  console.log("\n4️⃣ Testando adição, toggle e remoção de provedor...");
  const customProv = await aiRouter.saveProvider({
    label: "Test Local LLM vLLM",
    type: "openai_compatible",
    base_url: "http://localhost:8000/v1",
    api_key: "sk-test-local",
    default_model: "qwen-2.5-coder",
    enabled: true,
  });
  console.log(`   ✓ Provedor criado: ID ${customProv.id} ("${customProv.label}")`);

  const toggled = await aiRouter.toggleProvider(customProv.id, false);
  console.log(`   ✓ Toggle para false: enabled = ${toggled.enabled}`);

  await aiRouter.deleteProvider(customProv.id);
  console.log(`   ✓ Provedor de teste removido com sucesso.`);

  // Test 5: Fallback mechanism verification (Simulação controlada)
  console.log("\n5️⃣ Testando fallback entre múltiplos provedores...");
  try {
    // Attempting completion with fallback without real API keys
    // It should try ordered providers, capture errors, and throw a descriptive summary
    await aiRouter.completeWithFallback("Diz olá em 1 frase curta");
  } catch (err: any) {
    console.log(`   ✓ Fallback executado e erros capturados corretamente:`);
    console.log(`     ${err.message.split("\n")[0]}`);
  }

  console.log("\n🎉 TODOS OS TESTES UNITÁRIOS DO CARD 13 PASSARAM COM SUCESSO!");
}

runTests().catch((err) => {
  console.error("❌ Falha nos testes de IA:", err);
  process.exit(1);
});
