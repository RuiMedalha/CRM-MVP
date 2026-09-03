import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Mail, Save, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  getOrderTracking,
  updateWooOrderTracking,
  type SiteOrder,
} from "@/integrations/directus/site-orders";

interface Props {
  order: SiteOrder;
  onUpdated?: () => void | Promise<void>;
}

export function OrderTrackingEditor({ order, onUpdated }: Props) {
  const tracking = getOrderTracking(order);
  const [carrier, setCarrier] = useState("");
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "send">("");

  useEffect(() => {
    setCarrier(tracking.carrier || "");
    setCode(tracking.code || "");
    setUrl(tracking.url || "");
  }, [order.id, tracking.carrier, tracking.code, tracking.url]);

  async function submit(sendEmail: boolean) {
    if (!code.trim() && !url.trim()) {
      toast({ title: "Indique o código ou a URL de tracking", variant: "destructive" });
      return;
    }
    if (url.trim()) {
      try {
        const parsed = new URL(url.trim());
        if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      } catch {
        toast({ title: "URL de tracking inválida", variant: "destructive" });
        return;
      }
    }

    // Se não houver endpoint Woo configurado, o botão "Guardar e enviar email"
    // transforma-se em "Guardar" silenciosamente (tracking só fica no CRM).
    const wantsEmail = sendEmail && !!tracking.endpoint;
    setBusy(wantsEmail ? "send" : "save");
    try {
      const result = await updateWooOrderTracking(order, {
        carrier: carrier.trim(),
        tracking_code: code.trim(),
        tracking_url: url.trim(),
        send_email: wantsEmail,
      });
      if (sendEmail && !tracking.endpoint) {
        toast({
          title: "Tracking guardado (só no CRM)",
          description: "Webhook do WooCommerce não configurado nesta encomenda. Quando for activado, o email de expedição passará a ser enviado.",
        });
      } else if (wantsEmail && result.email_duplicate) {
        toast({ title: "Tracking já enviado", description: "O mesmo tracking não foi reenviado." });
      } else if (wantsEmail) {
        toast({
          title: result.email_sent ? "Tracking guardado e email enviado" : "Tracking guardado",
          description: result.email_sent
            ? order.customer_email
            : "O email de expedição está desativado no WooCommerce.",
        });
      } else if (result.woo_synced) {
        toast({ title: "Tracking guardado no CRM e WooCommerce" });
      } else {
        toast({ title: "Tracking guardado no CRM", description: result.reason });
      }
      await onUpdated?.();
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : String(error);
      toast({ title: "Erro ao guardar tracking", description, variant: "destructive" });
    } finally {
      setBusy("");
    }
  }

  // O botão "Guardar" fica SEMPRE activo (grava no CRM).
  // "Guardar e enviar email" só fica activo se o webhook Woo estiver configurado.
  const canSendEmail = !!tracking.endpoint && !!tracking.token;

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Truck className="h-4 w-4" /> Tracking da encomenda
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`tracking-carrier-${order.id}`}>Transportadora</Label>
          <Input id={`tracking-carrier-${order.id}`} value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="CTT, DHL, DPD..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tracking-code-${order.id}`}>Código</Label>
          <Input id={`tracking-code-${order.id}`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de tracking" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`tracking-url-${order.id}`}>URL de tracking</Label>
          <div className="flex gap-2">
            <Input id={`tracking-url-${order.id}`} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
            {url && (
              <Button variant="outline" size="icon" asChild title="Abrir tracking">
                <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            )}
          </div>
        </div>
      </div>
      {tracking.email_sent_at && <p className="text-xs text-muted-foreground">Email enviado em {new Date(tracking.email_sent_at).toLocaleString("pt-PT")}</p>}
      {!canSendEmail && (
        <p className="text-xs text-amber-700">
          Endpoint WooCommerce ainda não configurado nesta encomenda — o tracking fica registado no CRM (até o webhook do site enviar o endpoint/token).
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => submit(false)} disabled={!!busy}>
          {busy === "save" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Guardar
        </Button>
        <Button onClick={() => submit(true)} disabled={!canSendEmail || !!busy}>
          {busy === "send" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />} Guardar e enviar email
        </Button>
      </div>
    </div>
  );
}
