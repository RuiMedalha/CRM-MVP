import { useState } from "react";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Percent, Palette, FileText, Mail, RefreshCw, Loader2 } from "lucide-react";
import { generateWithAI, promptTermsConditions, promptNextSteps, isAIConfigured } from "@/integrations/ai/anthropicClient";
import { toast } from "@/hooks/use-toast";

export function StepSettings() {
  const { state, updateField, generateDiscountCode } = useProposalForm();
  const [generatingTerms, setGeneratingTerms] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState(false);

  const handleGenerateTermsAI = async () => {
    if (!isAIConfigured()) {
      toast({ title: "Configuração de IA necessária", description: "Defina VITE_ANTHROPIC_API_KEY no .env.local", variant: "destructive" });
      return;
    }
    setGeneratingTerms(true);
    try {
      const productNames = state.items.map((i) => i.product_name).filter(Boolean);
      const text = await generateWithAI(promptTermsConditions(productNames, state.deposit_percent));
      if (text) updateField("terms_conditions", text);
    } catch (err: any) {
      toast({ title: "Erro IA", description: err.message || "Falha ao gerar", variant: "destructive" });
    }
    setGeneratingTerms(false);
  };

  const handleGenerateNextStepsAI = async () => {
    if (!isAIConfigured()) {
      toast({ title: "Configuração de IA necessária", description: "Defina VITE_ANTHROPIC_API_KEY no .env.local", variant: "destructive" });
      return;
    }
    setGeneratingSteps(true);
    try {
      const productNames = state.items.map((i) => i.product_name).filter(Boolean);
      const text = await generateWithAI(promptNextSteps(productNames, state.deposit_percent));
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) updateField("next_steps", parsed);
        } catch { /* not valid JSON, ignore */ }
      }
    } catch (err: any) {
      toast({ title: "Erro IA", description: err.message || "Falha ao gerar", variant: "destructive" });
    }
    setGeneratingSteps(false);
  };

  // Calculate deposit amount from items subtotal
  const subtotal = state.items.reduce((sum, i) => sum + (i.line_total || 0), 0);
  const depositAmount = subtotal * ((state.deposit_percent || 50) / 100);

  return (
    <div className="space-y-6">
      {/* Validity period */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Período de validade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={state.valid_until ? "custom" : "2weeks"}
            onValueChange={(v) => {
              const now = new Date();
              switch (v) {
                case "1week":
                  now.setDate(now.getDate() + 7);
                  break;
                case "2weeks":
                  now.setDate(now.getDate() + 14);
                  break;
                case "1month":
                  now.setMonth(now.getMonth() + 1);
                  break;
                case "custom":
                  return; // user picks manually
              }
              updateField("valid_until", now.toISOString().split("T")[0]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1week">1 Semana</SelectItem>
              <SelectItem value="2weeks">2 Semanas</SelectItem>
              <SelectItem value="1month">1 Mês</SelectItem>
              <SelectItem value="custom">Data personalizada</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs">Data de expiração</Label>
            <Input
              type="date"
              value={state.valid_until || ""}
              onChange={(e) => updateField("valid_until", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Phone gate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Verificação por telefone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ativar phone gate</p>
              <p className="text-xs text-muted-foreground">
                O cliente confirma os últimos 4 dígitos do telefone para abrir a proposta
              </p>
            </div>
            <Switch
              checked={state.phone_gate_enabled}
              onCheckedChange={(v) => updateField("phone_gate_enabled", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Deposit / Payment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Pagamento / Sinal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={state.deposit_type === "partial" ? "default" : "outline"}
              size="sm"
              onClick={() => updateField("deposit_type", "partial")}
            >
              Sinal (parcial)
            </Button>
            <Button
              type="button"
              variant={state.deposit_type === "full" ? "default" : "outline"}
              size="sm"
              onClick={() => updateField("deposit_type", "full")}
            >
              Pagamento integral
            </Button>
          </div>

          {state.deposit_type === "partial" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Percentagem do sinal</Label>
                <Badge variant="secondary">{state.deposit_percent}%</Badge>
              </div>
              <Slider
                value={[state.deposit_percent]}
                onValueChange={([v]) => updateField("deposit_percent", v)}
                min={1}
                max={100}
                step={5}
              />
              <p className="text-sm text-muted-foreground">
                Sinal de {state.deposit_percent}%: <span className="font-semibold">€{depositAmount.toFixed(2)}</span>
              </p>
            </div>
          )}

          {state.deposit_type === "full" && (
            <p className="text-sm text-muted-foreground">
              Pagamento integral — o cliente paga o valor total
            </p>
          )}
        </CardContent>
      </Card>

      {/* Urgency discount */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Oferta por tempo limitado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ativar desconto de urgência</p>
              <p className="text-xs text-muted-foreground">
                Desconto se o cliente aceitar dentro de X horas
              </p>
            </div>
            <Switch
              checked={(state.urgency_discount_pct || 0) > 0}
              onCheckedChange={(v) => {
                if (!v) {
                  updateField("urgency_discount_pct", 0);
                  updateField("urgency_hours", undefined);
                } else {
                  updateField("urgency_discount_pct", 2);
                  updateField("urgency_hours", 24);
                }
              }}
            />
          </div>

          {(state.urgency_discount_pct || 0) > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">% de desconto</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={state.urgency_discount_pct || 2}
                  onChange={(e) => updateField("urgency_discount_pct", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Horas para aceitar</Label>
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={state.urgency_hours || 24}
                  onChange={(e) => updateField("urgency_hours", Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Tema da proposta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {([
              { value: "light", label: "Claro" },
              { value: "dark", label: "Escuro" },
              { value: "system", label: "Sistema" },
            ] as const).map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant={state.theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => updateField("theme", value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            O tema escolhido é aplicado na página pública da proposta.
          </p>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Termos e condições
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selector */}
          <Select
            value="custom"
            onValueChange={(v) => {
              switch (v) {
                case "standard":
                  updateField("terms_conditions", "Proposta válida pelo período indicado. Preços s/IVA. Pagamento conforme condições acordadas. Garantia de 2 anos nos equipamentos. Instalação sujeita a visita técnica prévia. A HotelEquip reserva-se o direito de ajustar preços caso haja alteração significativa nos custos de matéria-prima.");
                  break;
                case "30days":
                  updateField("terms_conditions", "Pagamento a 30 dias após emissão da fatura. Preços s/IVA. Em caso de atraso, serão aplicados juros de mora à taxa legal. Garantia de 2 anos nos equipamentos.");
                  break;
                case "installation":
                  updateField("terms_conditions", "Proposta inclui instalação no local indicado pelo cliente. O cliente deve garantir acesso ao local e condições técnicas (eletricidade, água, ventilação) conforme especificações. Prazo de instalação a combinar após confirmação da encomenda. Garantia de 2 anos.");
                  break;
                case "frio":
                  updateField("terms_conditions", "Equipamentos de frio sujeitos a condições especiais de instalação. Requer ponto de electricidade dedicado e ventilação adequada. Prazo de entrega: 10-15 dias úteis. Garantia de 2 anos no compressor e 1 ano nos restantes componentes. Instalação e primeira carga de gás incluídas. Manutenção preventiva recomendada a cada 6 meses.");
                  break;
                case "custom":
                  break;
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Usar template..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Condições standard HotelEquip</SelectItem>
              <SelectItem value="30days">Pagamento a 30 dias</SelectItem>
              <SelectItem value="installation">Com instalação incluída</SelectItem>
              <SelectItem value="frio">Equipamentos de frio</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            value={state.terms_conditions || ""}
            onChange={(e) => updateField("terms_conditions", e.target.value)}
            placeholder="Insira os termos e condições da proposta..."
            rows={4}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateTermsAI}
              disabled={generatingTerms}
            >
              {generatingTerms ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              ✨ Gerar com IA
            </Button>
            {!isAIConfigured() && (
              <span className="text-xs text-amber-600">IA não configurada</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mostrar na proposta</p>
              <p className="text-xs text-muted-foreground">
                Se ativo, os termos aparecem na página pública da proposta
              </p>
            </div>
            <Switch
              checked={state.show_terms}
              onCheckedChange={(v) => updateField("show_terms", v)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">URL termos completos (opcional)</Label>
            <Input
              value={(state as any).terms_url || ""}
              onChange={(e) => updateField("terms_url", e.target.value)}
              placeholder="https://hotelequip.pt/termos"
            />
          </div>
        </CardContent>
      </Card>

      {/* Newsletter discount */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Desconto newsletter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Oferecer desconto por subscrição</p>
              <p className="text-xs text-muted-foreground">
                O cliente recebe desconto ao subscrever a newsletter
              </p>
            </div>
            <Switch
              checked={state.newsletter_discount_enabled}
              onCheckedChange={(v) => updateField("newsletter_discount_enabled", v)}
            />
          </div>

          {state.newsletter_discount_enabled && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">% de desconto</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={state.newsletter_discount_percent}
                  onChange={(e) => updateField("newsletter_discount_percent", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Código de desconto</Label>
                <div className="flex gap-2">
                  <Input
                    value={state.newsletter_discount_code}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => updateField("newsletter_discount_code", generateDiscountCode())}
                    title="Gerar novo código"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Código gerado automaticamente. O cliente usa ao subscrever.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            🚀 O que acontece a seguir?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Estes passos aparecem na proposta pública para orientar o cliente.
          </p>
          {(state.next_steps.length === 0
            ? [
                { icon: "payment" as const, title: "Pagamento do sinal", description: `Pagamento de ${state.deposit_percent}% para iniciar` },
                { icon: "phone" as const, title: "Confirmação", description: "Entraremos em contacto em 24h" },
                { icon: "calendar" as const, title: "Entrega", description: "Instalação e entrega no local indicado" },
              ]
            : state.next_steps
          ).map((step, idx) => (
            <div key={idx} className="p-3 border rounded-lg space-y-2">
              <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
                <span className="text-2xl">
                  {step.icon === "payment" && "💳"}
                  {step.icon === "phone" && "📞"}
                  {step.icon === "calendar" && "🚚"}
                  {step.icon === "email" && "📧"}
                  {step.icon === "custom" && "✨"}
                </span>
                <div className="space-y-1">
                  <Input
                    value={step.title}
                    onChange={(e) => {
                      const steps = state.next_steps.length > 0
                        ? [...state.next_steps]
                        : [
                            { icon: "payment" as const, title: "Pagamento do sinal", description: `Pagamento de ${state.deposit_percent}% para iniciar` },
                            { icon: "phone" as const, title: "Confirmação", description: "Entraremos em contacto em 24h" },
                            { icon: "calendar" as const, title: "Entrega", description: "Instalação e entrega no local indicado" },
                          ];
                      steps[idx] = { ...steps[idx], title: e.target.value };
                      updateField("next_steps", steps);
                    }}
                    placeholder="Título do passo"
                    className="h-8 text-sm font-medium"
                  />
                  <Input
                    value={step.description}
                    onChange={(e) => {
                      const steps = state.next_steps.length > 0
                        ? [...state.next_steps]
                        : [
                            { icon: "payment" as const, title: "Pagamento do sinal", description: `Pagamento de ${state.deposit_percent}% para iniciar` },
                            { icon: "phone" as const, title: "Confirmação", description: "Entraremos em contacto em 24h" },
                            { icon: "calendar" as const, title: "Entrega", description: "Instalação e entrega no local indicado" },
                          ];
                      steps[idx] = { ...steps[idx], description: e.target.value };
                      updateField("next_steps", steps);
                    }}
                    placeholder="Descrição"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            {state.next_steps.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  updateField("next_steps", [
                    { icon: "payment", title: "Pagamento do sinal", description: `Pagamento de ${state.deposit_percent}% para iniciar` },
                    { icon: "phone", title: "Confirmação", description: "Entraremos em contacto em 24h" },
                    { icon: "calendar", title: "Entrega", description: "Instalação e entrega no local indicado" },
                  ]);
                }}
              >
                Guardar próximos passos
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateNextStepsAI}
              disabled={generatingSteps}
            >
              {generatingSteps ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              ✨ Sugerir com IA
            </Button>
            {!isAIConfigured() && (
              <span className="text-xs text-amber-600">IA não configurada</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
