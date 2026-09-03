import { useMemo } from "react";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { calculatePersuasionScore } from "@/utils/persuasionScore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepPersuasion() {
  const { state, goToStep } = useProposalForm();

  const { score, suggestions } = useMemo(() => calculatePersuasionScore(state), [state]);

  const scoreColor =
    score >= 70 ? "text-green-500" : score >= 40 ? "text-orange-500" : "text-red-500";
  const scoreBg =
    score >= 70 ? "stroke-green-500" : score >= 40 ? "stroke-orange-500" : "stroke-red-500";

  // Map fields to steps for navigation
  const fieldToStep: Record<string, number> = {
    welcome_message: 1,
    voice_message_url: 1,
    reviews: 1,
    video_url: 1,
    next_steps: 1,
    urgency_discount_pct: 2,
    datasheet_url: 1,
    images: 1,
    terms_conditions: 2,
  };

  // Checklist items
  const checklist = [
    { label: "Nome do cliente", done: !!state.customer_name },
    { label: "Informações do serviço", done: state.items.length > 0 },
    { label: "Mensagem de boas-vindas", done: !!state.welcome_message?.trim() },
    { label: "Mensagem de voz", done: !!state.voice_message_url?.trim() },
    { label: "Avaliação do cliente", done: state.reviews.length > 0 },
    { label: "Vídeo", done: !!state.video_url?.trim() },
  ];

  return (
    <div className="space-y-6">
      {/* Score circle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/20"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(score / 100) * 314} 314`}
                  className={scoreBg}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-3xl font-bold", scoreColor)}>{score}</span>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Pontuação de Persuasão</h3>
              <p className="text-sm text-muted-foreground">
                {score >= 70
                  ? "Excelente! A proposta está muito completa."
                  : score >= 40
                  ? "Boa base. Adicione mais elementos para melhorar."
                  : "A proposta precisa de mais conteúdo para ser eficaz."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Sugestões de melhoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToStep(fieldToStep[suggestion.field] ?? 1)}
                className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">{suggestion.text}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">+{suggestion.points} pts</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Verificação de conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {checklist.map((item, index) => (
            <div key={index} className="flex items-center gap-2 py-1">
              <CheckCircle2
                className={cn(
                  "h-4 w-4",
                  item.done ? "text-green-500" : "text-muted-foreground/30"
                )}
              />
              <span
                className={cn(
                  "text-sm",
                  item.done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
