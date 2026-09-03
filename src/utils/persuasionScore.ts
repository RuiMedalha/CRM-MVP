/**
 * Persuasion Score — cálculo local (sem IA) da pontuação de persuasão.
 * Baseado em regras fixas: max 100 pontos.
 */

import type { PersuasionResult, PersuasionSuggestion } from "@/types/quotation";
import type { ProposalFormState } from "@/contexts/ProposalFormContext";

export function calculatePersuasionScore(state: ProposalFormState): PersuasionResult {
  const suggestions: PersuasionSuggestion[] = [];
  let score = 0;

  // welcome_message preenchida: +15
  if (state.welcome_message?.trim()) {
    score += 15;
  } else {
    suggestions.push({ text: "Adicionar mensagem de boas-vindas", points: 15, field: "welcome_message" });
  }

  // voice_message_url preenchida: +15
  if (state.voice_message_url?.trim()) {
    score += 15;
  } else {
    suggestions.push({ text: "Gravar mensagem de voz", points: 15, field: "voice_message_url" });
  }

  // reviews.length > 0: +15
  if (state.reviews.length > 0) {
    score += 15;
  } else {
    suggestions.push({ text: "Adicionar avaliação de cliente", points: 15, field: "reviews" });
  }

  // video_url preenchida: +10
  if (state.video_url?.trim()) {
    score += 10;
  } else {
    suggestions.push({ text: "Adicionar vídeo de apresentação", points: 10, field: "video_url" });
  }

  // next_steps.length > 0: +10
  if (state.next_steps.length > 0) {
    score += 10;
  } else {
    suggestions.push({ text: "Definir próximos passos", points: 10, field: "next_steps" });
  }

  // urgency_discount_pct > 0: +10
  if ((state.urgency_discount_pct || 0) > 0) {
    score += 10;
  } else {
    suggestions.push({ text: "Ativar desconto de urgência", points: 10, field: "urgency_discount_pct" });
  }

  // items com datasheet_url: +10
  const hasDatasheets = state.items.some((item) => item.datasheet_url?.trim());
  if (hasDatasheets) {
    score += 10;
  } else if (state.items.length > 0) {
    suggestions.push({ text: "Adicionar ficha técnica aos produtos", points: 10, field: "datasheet_url" });
  }

  // items com imagens: +10
  const hasImages = state.items.some((item) => item.image_url || (item.images && item.images.length > 0));
  if (hasImages) {
    score += 10;
  } else if (state.items.length > 0) {
    suggestions.push({ text: "Adicionar imagens aos produtos", points: 10, field: "images" });
  }

  // terms_conditions preenchidas: +5
  if (state.terms_conditions?.trim()) {
    score += 5;
  } else {
    suggestions.push({ text: "Adicionar termos e condições", points: 5, field: "terms_conditions" });
  }

  return { score: Math.min(score, 100), suggestions };
}
