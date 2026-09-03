import { useState, useEffect, useRef } from "react";
import { useProposalForm } from "@/contexts/ProposalFormContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Wrench, Plus, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { DIRECTUS_URL } from "@/integrations/directus/client";
import type { QuotationItem } from "@/types/quotation";

const DEFAULT_SERVICES: (Omit<QuotationItem, "line_total"> & { defaultActive: boolean })[]
 = [
  {
    item_type: "service",
    product_name: "Instalação e colocação em funcionamento",
    ai_description: "Instalação completa do equipamento no local",
    quantity: 1,
    unit_price: 0,
    defaultActive: true,
  },
  {
    item_type: "service",
    product_name: "Visita técnica de avaliação",
    ai_description: "Avaliação técnica no local antes da instalação",
    quantity: 1,
    unit_price: 50,
    defaultActive: true,
  },
  {
    item_type: "service",
    product_name: "Formação de utilização",
    ai_description: "Formação para a equipa sobre o uso do equipamento",
    quantity: 1,
    unit_price: 0,
    defaultActive: true,
  },
  {
    item_type: "service",
    product_name: "Transporte e entrega",
    ai_description: "Transporte e entrega no local indicado",
    quantity: 1,
    unit_price: 0,
    defaultActive: true,
  },
];

/** Upload de imagem simples para um serviço */
function ServiceImageUpload({ imageUrl, onUploaded }: { imageUrl?: string | null; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const resp = await fetch(`${DIRECTUS_URL}/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("directus_access_token") || ""}` },
        body: formData,
      });
      if (!resp.ok) throw new Error(`Upload ${resp.status}`);
      const data = await resp.json();
      const fileId = data?.data?.id;
      if (fileId) onUploaded(`${DIRECTUS_URL}/assets/${fileId}`);
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        <img src={imageUrl} alt="Serviço" className="h-10 w-10 rounded object-contain border bg-muted" />
      ) : (
        <div className="h-10 w-10 rounded border border-dashed border-border bg-muted flex items-center justify-center">
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="text-xs text-primary hover:underline disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : (imageUrl ? "Trocar imagem" : "Adicionar imagem")}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export function StepServices() {
  const { state, dispatch } = useProposalForm();
  const didInit = useRef(false);

  // Track which default services are active
  const [activeServices, setActiveServices] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    DEFAULT_SERVICES.forEach((s) => {
      const exists = state.additional_items.some(
        (item) => item.product_name === s.product_name && item.item_type === "service"
      );
      map[s.product_name] = exists;
    });
    return map;
  });

  // Auto-activate default services on first visit (if no services present)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const hasAnyService = state.additional_items.some((i) => i.item_type === "service");
    if (!hasAnyService) {
      DEFAULT_SERVICES.forEach((service) => {
        if (service.defaultActive) {
          const item: QuotationItem = {
            item_type: service.item_type,
            product_name: service.product_name,
            ai_description: service.ai_description,
            quantity: service.quantity,
            unit_price: service.unit_price,
            line_total: service.quantity * service.unit_price,
          };
          dispatch({ type: "ADD_ITEM", item, category: "additional" });
        }
      });
      const map: Record<string, boolean> = {};
      DEFAULT_SERVICES.forEach((s) => {
        map[s.product_name] = s.defaultActive;
      });
      setActiveServices(map);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleService = (service: Omit<QuotationItem, "line_total">, active: boolean) => {
    setActiveServices((prev) => ({ ...prev, [service.product_name]: active }));
    if (active) {
      const item: QuotationItem = {
        ...service,
        line_total: service.quantity * service.unit_price,
      };
      dispatch({ type: "ADD_ITEM", item, category: "additional" });
    } else {
      const idx = state.additional_items.findIndex(
        (i) => i.product_name === service.product_name && i.item_type === "service"
      );
      if (idx >= 0) dispatch({ type: "REMOVE_ITEM", index: idx, category: "additional" });
    }
  };

  const updateServicePrice = (name: string, price: number) => {
    const idx = state.additional_items.findIndex(
      (i) => i.product_name === name && i.item_type === "service"
    );
    if (idx >= 0) {
      const item = { ...state.additional_items[idx], unit_price: price, line_total: price * state.additional_items[idx].quantity };
      dispatch({ type: "UPDATE_ITEM", index: idx, item, category: "additional" });
    }
  };

  const updateServiceQty = (name: string, qty: number) => {
    const idx = state.additional_items.findIndex(
      (i) => i.product_name === name && i.item_type === "service"
    );
    if (idx >= 0) {
      const item = { ...state.additional_items[idx], quantity: qty, line_total: qty * state.additional_items[idx].unit_price };
      dispatch({ type: "UPDATE_ITEM", index: idx, item, category: "additional" });
    }
  };

  // Custom service form
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const addCustomService = () => {
    if (!customName.trim()) return;
    const price = Number(customPrice) || 0;
    const item: QuotationItem = {
      item_type: "service",
      product_name: customName.trim(),
      quantity: 1,
      unit_price: price,
      line_total: price,
    };
    dispatch({ type: "ADD_ITEM", item, category: "additional" });
    setCustomName("");
    setCustomPrice("");
  };

  const customServices = state.additional_items.filter(
    (i) => i.item_type === "service" && !DEFAULT_SERVICES.some((d) => d.product_name === i.product_name)
  );

  return (
    <div className="space-y-6">
      {/* Standard services */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DEFAULT_SERVICES.map((service) => {
            const isActive = activeServices[service.product_name] || false;
            const existingItem = state.additional_items.find(
              (i) => i.product_name === service.product_name && i.item_type === "service"
            );
            return (
              <div
                key={service.product_name}
                className={`p-3 border rounded-lg transition-opacity ${!isActive ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{service.product_name}</p>
                    <p className="text-xs text-muted-foreground">{service.ai_description}</p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => toggleService(service, checked)}
                  />
                </div>
                {isActive && existingItem && (
                  <div className="space-y-2 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-muted-foreground">Preço €</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={existingItem.unit_price}
                          onChange={(e) => updateServicePrice(service.product_name, Number(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-xs text-muted-foreground">Qtd</Label>
                        <Input
                          type="number"
                          min={1}
                          value={existingItem.quantity}
                          onChange={(e) => updateServiceQty(service.product_name, Number(e.target.value) || 1)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    {/* Imagem do serviço */}
                    <ServiceImageUpload
                      imageUrl={existingItem.image_url}
                      onUploaded={(url) => {
                        const idx = state.additional_items.findIndex(
                          (i) => i.product_name === service.product_name && i.item_type === "service"
                        );
                        if (idx >= 0) {
                          dispatch({ type: "UPDATE_ITEM", index: idx, item: { ...existingItem, image_url: url }, category: "additional" });
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Custom services */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Serviços personalizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {customServices.map((item, _idx) => {
            const realIdx = state.additional_items.indexOf(item);
            return (
              <div key={realIdx} className="flex items-center gap-2 p-2 border rounded-lg">
                <span className="flex-1 text-sm">{item.product_name}</span>
                <span className="text-sm font-medium">€{(item.line_total || 0).toFixed(2)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch({ type: "REMOVE_ITEM", index: realIdx, category: "additional" })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}

          <Separator />

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Nome do serviço</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ex: Consultoria especializada"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-xs">Preço €</Label>
              <Input
                type="number"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button onClick={addCustomService} disabled={!customName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            O cliente pode adicionar ou remover estes extras na proposta
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
