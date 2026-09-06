import { useState } from "react";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { useMeilisearch, type MeilisearchProduct } from "@/hooks/useMeilisearch";
import { generateWelcomeMessage } from "@/integrations/ai/quotationAI";
import { generateWithAI, promptProposalDescription, promptProductDescription, isAIConfigured } from "@/integrations/ai/anthropicClient";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Package,
  Plus,
  Trash2,
  Search,
  Star,
  Sparkles,
  FileText,
  ChevronDown,
  Loader2,
  GitCompareArrows,
} from "lucide-react";
import type { QuotationItem } from "@/types/quotation";

const WELCOME_TEMPLATES = {
  formal: `Olá {nome_cliente},\n\nÉ com prazer que lhe apresentamos a nossa proposta comercial. Após análise das suas necessidades, preparámos uma solução à medida para o seu estabelecimento.\n\nEstamos à disposição para qualquer esclarecimento.`,
  friendly: `Olá {nome_cliente}!\n\nObrigado pelo seu interesse nos nossos equipamentos. Preparámos esta proposta com muito cuidado, pensando nas necessidades do seu negócio.\n\nQualquer dúvida, não hesite em contactar-nos!`,
  followup: `Olá {nome_cliente},\n\nConforme conversámos, segue a nossa proposta formalizada com os equipamentos e condições que discutimos.\n\nFicamos a aguardar o seu feedback.`,
};

export function StepContent() {
  const { state, dispatch, updateField } = useProposalForm();
  const { search, results, isSearching } = useMeilisearch();
  const [productQuery, setProductQuery] = useState("");
  const [showProductResults, setShowProductResults] = useState(false);
  const [isGeneratingWelcome, setIsGeneratingWelcome] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  // Manual item form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState("1");

  // ─── Welcome message AI ────────────────────────────────────────────────
  const handleGenerateWelcome = async () => {
    setIsGeneratingWelcome(true);
    try {
      const products = state.items.map((i) => i.product_name).filter(Boolean);
      const text = await generateWelcomeMessage(
        state.customer_name || "Cliente",
        products,
        "formal",
        state.customer_company
      );
      updateField("welcome_message", text);
    } catch {
      // fallback
    } finally {
      setIsGeneratingWelcome(false);
    }
  };

  // ─── Proposal description AI ───────────────────────────────────────────
  const handleGenerateProposalDescription = async () => {
    if (!isAIConfigured()) {
      toast({ title: "Configuração de IA necessária", description: "Defina VITE_ANTHROPIC_API_KEY no .env.local", variant: "destructive" });
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const productNames = state.items.map((i) => i.product_name).filter(Boolean);
      const text = await generateWithAI(promptProposalDescription(productNames, state.customer_name, state.customer_company));
      if (text) updateField("proposal_description", text);
    } catch (err: any) {
      toast({ title: "Erro IA", description: err.message || "Falha ao gerar", variant: "destructive" });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleUseTemplate = (key: keyof typeof WELCOME_TEMPLATES) => {
    updateField("welcome_message", WELCOME_TEMPLATES[key]);
  };

  // ─── Product search ────────────────────────────────────────────────────
  const handleProductSearch = async (query: string) => {
    setProductQuery(query);
    if (query.length >= 2) {
      await search(query);
      setShowProductResults(true);
    } else {
      setShowProductResults(false);
    }
  };

  const addProduct = (product: MeilisearchProduct, category: "main" | "additional" = "main") => {
    const imageUrl = product.thumbnail || product.image_url || product.featured_media_url || undefined;
    const rawDesc = product.short_description || product.description || "";
    // Strip HTML from description
    const strippedDesc = rawDesc.replace(/<[^>]*>/g, "").trim() || undefined;
    const sku = product.sku || "";
    const item: QuotationItem = {
      item_type: category === "additional" ? "additional" : "product",
      product_id: product.id,
      product_name: product.name || product.title || "",
      sku,
      quantity: 1,
      unit_price: product.price || 0,
      line_total: product.price || 0,
      image_url: imageUrl,
      product_url: product.link || undefined,
      ai_description: strippedDesc,
      datasheet_url: sku ? `https://hotelequip.palamenta.com.pt/wp-json/heq/v1/product-pdf/${sku}` : undefined,
    };
    dispatch({ type: "ADD_ITEM", item, category });
    setShowProductResults(false);
    setProductQuery("");
  };

  const addManualItem = () => {
    if (!manualName.trim()) return;
    const price = Number(manualPrice) || 0;
    const qty = Number(manualQty) || 1;
    const item: QuotationItem = {
      item_type: "product",
      product_name: manualName.trim(),
      ai_description: manualDesc.trim() || undefined,
      quantity: qty,
      unit_price: price,
      line_total: price * qty,
      manual_entry: true,
    };
    dispatch({ type: "ADD_ITEM", item, category: "main" });
    setManualName("");
    setManualDesc("");
    setManualPrice("");
    setManualQty("1");
    setShowManualForm(false);
  };

  const removeItem = (index: number, category: "main" | "additional" = "main") => {
    dispatch({ type: "REMOVE_ITEM", index, category });
  };

  const updateItemField = (index: number, field: keyof QuotationItem, value: unknown, category: "main" | "additional" = "main") => {
    const items = category === "additional" ? state.additional_items : state.items;
    const item = { ...items[index], [field]: value };
    if (field === "quantity" || field === "unit_price" || field === "discount_percent") {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const disc = Number(item.discount_percent || 0);
      item.line_total = qty * price * (1 - disc / 100);
    }
    dispatch({ type: "UPDATE_ITEM", index, item, category });
  };


  // ─── Render item list ──────────────────────────────────────────────────
  const renderItemList = (items: QuotationItem[], category: "main" | "additional") => (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="p-3 border rounded-lg bg-card space-y-2">
          <div className="flex items-center gap-2">
            {item.image_url && (
              <img src={item.image_url} alt="" className="w-10 h-10 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.product_name}</div>
              {item.sku && <div className="text-xs text-muted-foreground">SKU: {item.sku}</div>}
            </div>
            <span className="text-sm font-semibold">
              €{(item.line_total || 0).toFixed(2)}
            </span>
            <Button variant="ghost" size="icon" onClick={() => removeItem(index, category)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {/* Editable fields row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">Qtd</Label>
              <Input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => updateItemField(index, "quantity", Number(e.target.value), category)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">Preço unit.</Label>
              <Input
                type="number"
                step="0.01"
                value={item.unit_price}
                onChange={(e) => updateItemField(index, "unit_price", Number(e.target.value), category)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">Desconto %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={item.discount_percent || 0}
                onChange={(e) => updateItemField(index, "discount_percent", Number(e.target.value), category)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs text-muted-foreground">Ficha técnica</Label>
              <Input
                value={item.datasheet_url || ""}
                onChange={(e) => updateItemField(index, "datasheet_url", e.target.value, category)}
                placeholder="URL do PDF..."
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* AI Description */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-0.5">
              <Label className="text-xs text-muted-foreground">Descrição / Notas</Label>
              <Input
                value={item.ai_description || ""}
                onChange={(e) => updateItemField(index, "ai_description", e.target.value, category)}
                placeholder="Descrição comercial do produto..."
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title={isAIConfigured() ? "Gerar descrição com IA" : "IA não configurada"}
              disabled={!isAIConfigured()}
              onClick={async () => {
                if (!isAIConfigured()) {
                  toast({ title: "Configuração de IA necessária", description: "Defina VITE_ANTHROPIC_API_KEY no .env.local", variant: "destructive" });
                  return;
                }
                try {
                  const text = await generateWithAI(promptProductDescription(item.product_name));
                  if (text) updateItemField(index, "ai_description", text, category);
                } catch (err: any) {
                  toast({ title: "Erro IA", description: err.message || "Falha ao gerar", variant: "destructive" });
                }
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Comparison group (only for main items) */}
          {category === "main" && (
            <div className="border-t pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  Incluir em comparação
                </Label>
                <Switch
                  checked={!!item.comparison_group}
                  onCheckedChange={(checked) =>
                    updateItemField(index, "comparison_group", checked ? "A" : undefined, category)
                  }
                />
              </div>
              {item.comparison_group && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-1">
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Grupo</Label>
                    <Select
                      value={item.comparison_group}
                      onValueChange={(v) => updateItemField(index, "comparison_group", v, category)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["A", "B", "C"].map((g) => (
                          <SelectItem key={g} value={g}>Grupo {g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-0.5 flex flex-col justify-end">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3" /> Recomendado
                    </Label>
                    <Switch
                      checked={!!item.is_recommended}
                      onCheckedChange={(checked) =>
                        updateItemField(index, "is_recommended", checked, category)
                      }
                    />
                  </div>
                </div>
              )}
              {item.comparison_group && (
                <div className="space-y-1.5 pl-1">
                  <Label className="text-xs text-muted-foreground">Specs para comparação</Label>
                  {(item.comparison_specs || []).map((spec, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <Input
                        value={spec.label}
                        onChange={(e) => {
                          const specs = [...(item.comparison_specs || [])];
                          specs[si] = { ...specs[si], label: e.target.value };
                          updateItemField(index, "comparison_specs", specs, category);
                        }}
                        placeholder="Ex: Capacidade"
                        className="h-7 text-xs flex-1"
                      />
                      <Input
                        value={spec.value}
                        onChange={(e) => {
                          const specs = [...(item.comparison_specs || [])];
                          specs[si] = { ...specs[si], value: e.target.value };
                          updateItemField(index, "comparison_specs", specs, category);
                        }}
                        placeholder="Ex: 10L"
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          const specs = (item.comparison_specs || []).filter((_, i) => i !== si);
                          updateItemField(index, "comparison_specs", specs, category);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      const specs = [...(item.comparison_specs || []), { label: "", value: "" }];
                      updateItemField(index, "comparison_specs", specs, category);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar spec
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum item adicionado.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Products (Primary focus of step) */}
      <Card className="border-primary/20 shadow-xs">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Produtos / Equipamentos
            </span>
            {state.items.length > 0 && (
              <Badge variant="secondary" className="font-semibold">
                {state.items.length} {state.items.length === 1 ? "artigo" : "artigos"} · €{state.items.reduce((sum, i) => sum + (i.line_total || 0), 0).toFixed(2)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar catálogo de produtos (Meilisearch) por nome, modelo ou SKU..."
                value={productQuery}
                onChange={(e) => handleProductSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
                autoFocus={state.items.length === 0}
              />
            </div>
            {showProductResults && (
              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {isSearching && <div className="p-3 text-sm text-muted-foreground">A procurar no catálogo...</div>}
                {!isSearching && results.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado para "{productQuery}".</div>
                )}
                {results.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b last:border-b-0 flex items-center gap-3"
                    onClick={() => addProduct(product)}
                  >
                    {(product.thumbnail || product.image_url || product.featured_media_url) ? (
                      <img src={product.thumbnail || product.image_url || product.featured_media_url} alt="" className="w-10 h-10 rounded object-cover border" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground"><Package className="h-5 w-5" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{product.name || product.title}</div>
                      <div className="text-xs text-muted-foreground">{product.sku && `SKU: ${product.sku} · `}€{Number(product.price || 0).toFixed(2)}</div>
                    </div>
                    <Button size="sm" variant="secondary" className="shrink-0 h-7 text-xs font-semibold">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Escolher
                    </Button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual item button + form */}
          {!showManualForm ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowManualForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar linha manual
            </Button>
          ) : (
            <div className="p-3 border rounded-lg border-dashed space-y-3 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nome do produto/serviço" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} placeholder="Descrição breve" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Preço unitário (€)</Label>
                  <Input type="number" step="0.01" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" min={1} value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={addManualItem} disabled={!manualName.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowManualForm(false)}>Cancelar</Button>
              </div>
            </div>
          )}

          {renderItemList(state.items, "main")}

          {state.items.length > 0 && (
            <div className="flex justify-end pt-2 border-t">
              <span className="text-base font-bold text-foreground">
                Subtotal: €{state.items.reduce((sum, i) => sum + (i.line_total || 0), 0).toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Welcome message (Optional) */}
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            Mensagem de boas-vindas (opcional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Textarea
            value={state.welcome_message || ""}
            onChange={(e) => updateField("welcome_message", e.target.value)}
            placeholder="Olá {nome_cliente}, é com prazer que lhe apresentamos a nossa proposta..."
            rows={3}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateWelcome}
              disabled={isGeneratingWelcome}
            >
              {isGeneratingWelcome ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Gerar com IA
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  Usar template
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleUseTemplate("formal")}>Formal</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUseTemplate("friendly")}>Amigável</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleUseTemplate("followup")}>Seguimento de reunião</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-muted-foreground">
            Use <Badge variant="secondary" className="text-xs">{"{nome_cliente}"}</Badge> para inserir o nome do cliente automaticamente.
          </p>
        </CardContent>
      </Card>

      {/* Proposal description (Optional) */}
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            Descrição / Contexto adicional da proposta (opcional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Textarea
            value={state.proposal_description || ""}
            onChange={(e) => updateField("proposal_description", e.target.value)}
            placeholder="Contexto adicional antes dos produtos (opcional)..."
            rows={2}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateProposalDescription}
              disabled={isGeneratingDescription}
            >
              {isGeneratingDescription ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Gerar com IA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comparison recommendation text (shown when comparison groups exist) */}
      {state.items.some((i) => i.comparison_group) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5" />
              Justificação da recomendação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={state.comparison_recommendation_text || ""}
              onChange={(e) => updateField("comparison_recommendation_text", e.target.value)}
              placeholder="Ex: Recomendamos o Produto A pela sua maior capacidade e eficiência energética superior, tornando-o mais rentável a longo prazo para o volume do seu estabelecimento."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Este texto aparece abaixo da tabela de comparação na proposta do cliente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Additional services */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Serviços adicionais (opcional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Adicione serviços opcionais de upsell.</p>
          {renderItemList(state.additional_items, "additional")}
        </CardContent>
      </Card>

    </div>
  );
}
