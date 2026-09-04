import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useMeilisearch, getMeilisearchSettings, type MeilisearchProduct } from "@/hooks/useMeilisearch";
import { useQuotationBuilderOptional } from "@/contexts/QuotationBuilderContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ExternalLink, Copy, Package, MessageCircle, Send, Plus, Check, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/useSettings";

interface ProductSearchTabProps {
  clientPhone?: string | null;
  showAddToQuotation?: boolean;
  /** Atalho de teclado para focar o input. Default "mod+k" (Ctrl+K no Windows/Linux). */
  shortcut?: string;
  /** Mostrar dica do atalho à direita do input. Default true se `shortcut` definido. */
  showShortcutHint?: boolean;
}

/**
 * Ref público: { focus(), select() }.
 * Permite que o pai (TelecofCallWorkspace) capture Ctrl+K e faça focus + select.
 */
export interface ProductSearchTabHandle {
  focus: () => void;
  select: () => void;
}

export const ProductSearchTab = forwardRef<ProductSearchTabHandle, ProductSearchTabProps>(
  function ProductSearchTab(
    { clientPhone, showAddToQuotation = false, shortcut = "mod+k", showShortcutHint },
    ref,
  ) {
  const [query, setQuery] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [showManualInput, setShowManualInput] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const { search, results, isSearching, error, clearResults } = useMeilisearch();
  const { data: settings } = useCompanySettings();
  const wooUrl = (settings as any)?.woo_url || "";
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Expõe focus/select ao pai (TelecofCallWorkspace usa para Ctrl+K)
  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      select: () => inputRef.current?.select(),
    }),
    [],
  );

  // Pode ser usado fora do provider (ex: tab Comercial na ficha)
  const quotationBuilder = useQuotationBuilderOptional();

  const meilisearchSettings = getMeilisearchSettings();
  const isConfigured = !!meilisearchSettings.meilisearch_host;

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.trim().length >= 2) {
        search(query);
      } else {
        clearResults();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, search, clearResults]);

  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku);
    toast({ title: "SKU copiado!" });
  };

  const getProductUrl = (product: MeilisearchProduct) => {
    if (product.link) {
      return product.link;
    }
    if (wooUrl && product.sku) {
      return `${wooUrl}/produto/${product.sku}`;
    }
    return null;
  };

  const getProductImage = (product: MeilisearchProduct) => {
    const p: any = product as any;
    return (
      p.featured_media_url ||
      p.image_url ||
      p.media_url ||
      p.thumbnail ||
      p.thumb ||
      (Array.isArray(p.images) ? p.images?.[0]?.src || p.images?.[0]?.url : null) ||
      (p.image ? p.image.src || p.image.url : null) ||
      (p.featured_media ? p.featured_media.src || p.featured_media.url : null) ||
      null
    );
  };

  const getProductName = (product: MeilisearchProduct) => {
    return product.title || product.name;
  };

  const getProductDescription = (product: MeilisearchProduct) => {
    return product.content || product.description || null;
  };

  const handleSendWhatsApp = (product: MeilisearchProduct, customUrl?: string) => {
    const productUrl = customUrl || getProductUrl(product);
    if (!productUrl) {
      setShowManualInput(product.id);
      return;
    }

    const phone = clientPhone?.replace(/\D/g, '') || '';
    const message = encodeURIComponent(`Olá! Veja este produto: ${getProductName(product)}\n${productUrl}`);
    
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    } else {
      navigator.clipboard.writeText(productUrl);
      toast({ title: "Link copiado! Cole no WhatsApp." });
    }
    setShowManualInput(null);
    setManualUrl("");
  };

  const handleSendManualUrl = (product: MeilisearchProduct) => {
    if (!manualUrl.trim()) {
      toast({ title: "Cole o URL do produto", variant: "destructive" });
      return;
    }
    handleSendWhatsApp(product, manualUrl.trim());
  };

  const handleAddToQuotation = (product: MeilisearchProduct) => {
    if (showAddToQuotation && quotationBuilder) {
      quotationBuilder.addItem(product);
      setAddedItems(prev => new Set(prev).add(product.id));
      toast({ title: `${product.title || product.name} adicionado ao orçamento` });
      
      // Reset visual feedback after 2 seconds
      setTimeout(() => {
        setAddedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
        });
      }, 2000);
    }
  };

  if (!isConfigured) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Meilisearch não configurado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Configure nas Definições para pesquisar produtos
        </p>
      </div>
    );
  }

  const showHint = showShortcutHint ?? Boolean(shortcut);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Pesquisa de Produtos</h3>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Pesquisar por nome, SKU ou categoria..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={showHint ? "pl-10 pr-16 h-9 text-sm" : "pl-10 h-9 text-sm"}
        />
        {showHint && (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {shortcutLabel(shortcut)}
          </kbd>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {isSearching ? (
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : results.length === 0 && query.length >= 2 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhum produto encontrado
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-[450px] overflow-y-auto">
          {results.map((product) => {
            const productUrl = getProductUrl(product);
            const imageUrl = getProductImage(product);
            const description = getProductDescription(product);
            
            return (
              <div
                key={product.id}
                className="flex flex-col p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                {/* Product Image */}
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={getProductName(product)}
                    className="w-full h-24 object-contain bg-muted rounded-md mb-2"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-24 bg-muted rounded-md flex items-center justify-center mb-2">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium line-clamp-2 leading-tight">
                    {getProductName(product)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {product.sku}
                    </Badge>
                  </div>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {description.replace(/<[^>]*>/g, '').slice(0, 80)}...
                    </p>
                  )}
                  {product.category && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {product.category}
                    </p>
                  )}
                </div>

                {/* Price & Actions */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className="text-sm font-bold text-primary">
                    {product.price?.toFixed(2)}€
                  </span>
                  <div className="flex items-center gap-0.5">
                    {showAddToQuotation && (
                      <Button
                        variant={addedItems.has(product.id) ? "default" : "ghost"}
                        size="icon"
                        className={`h-6 w-6 ${addedItems.has(product.id) ? "bg-success hover:bg-success text-success-foreground" : "text-primary hover:text-primary hover:bg-primary/10"}`}
                        onClick={() => handleAddToQuotation(product)}
                        title="Adicionar ao Orçamento"
                      >
                        {addedItems.has(product.id) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopySku(product.sku)}
                      title="Copiar SKU"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {/* Secção 5: Botão ficha técnica — aparece se o índice tiver datasheet_url */}
                    {product.datasheet_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        asChild
                        title="Ficha Técnica (PDF)"
                      >
                        <a href={product.datasheet_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleSendWhatsApp(product)}
                      title="Enviar por WhatsApp"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </Button>
                    {productUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        asChild
                      >
                        <a
                          href={productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver no site"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Manual URL Input */}
                {showManualInput === product.id && (
                  <div className="mt-2 pt-2 border-t space-y-2">
                    <p className="text-xs text-muted-foreground">URL não disponível. Cole manualmente:</p>
                    <div className="flex gap-1">
                      <Input
                        placeholder="https://..."
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className="h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleSendManualUrl(product)}
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  });

/**
 * Renderiza um atalho como string amigável.
 * "mod+k" -> "⌘K" no Mac, "Ctrl+K" no resto.
 * Útil para mostrar a dica visualmente no input.
 */
export function shortcutLabel(shortcut: string): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || "");
  return shortcut
    .split("+")
    .map((part) => {
      const lower = part.trim().toLowerCase();
      if (lower === "mod") return isMac ? "⌘" : "Ctrl";
      if (lower === "cmd" || lower === "meta") return "⌘";
      if (lower === "ctrl" || lower === "control") return isMac ? "⌃" : "Ctrl";
      if (lower === "shift") return isMac ? "⇧" : "Shift";
      if (lower === "alt" || lower === "option") return isMac ? "⌥" : "Alt";
      if (lower === "enter") return "↵";
      if (lower === "esc" || lower === "escape") return "Esc";
      if (lower === "space") return "Space";
      if (lower === "up") return "↑";
      if (lower === "down") return "↓";
      if (lower === "left") return "←";
      if (lower === "right") return "→";
      return part.toUpperCase();
    })
    .join("+");
}

/**
 * Helper para parsear um shortcut tipo "mod+k" num Set<EventKey> boolean testável.
 */
export function matchesShortcut(
  event: KeyboardEvent,
  shortcut: string,
  isMac: boolean,
): boolean {
  const parts = shortcut.split("+").map((p) => p.trim().toLowerCase());
  const key = parts[parts.length - 1];
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt") || parts.includes("option");
  const wantCtrl = parts.includes("ctrl") || parts.includes("control");

  const eventKey = event.key.toLowerCase();
  if (eventKey !== key.toLowerCase()) return false;

  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  if (wantMod && !modPressed) return false;
  if (!wantMod && modPressed) return false;
  if (wantShift !== event.shiftKey) return false;
  if (wantAlt !== event.altKey) return false;
  if (wantCtrl) {
    if (isMac ? !event.ctrlKey : !event.ctrlKey) return false;
  }
  return true;
}