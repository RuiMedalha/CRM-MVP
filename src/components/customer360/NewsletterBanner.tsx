/**
 * NewsletterBanner — shows newsletter subscription status with quick actions.
 * RGPD-compliant: shows consent date and source.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, MailX, Check } from "lucide-react";
import { patchContact } from "@/integrations/directus/contacts";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface NewsletterBannerProps {
  contactId: string;
  acceptNewsletter?: boolean;
  consentAt?: string;
  consentSource?: string;
  unsubscribedAt?: string;
  email?: string;
}

export function NewsletterBanner({ contactId, acceptNewsletter, consentAt, consentSource, unsubscribedAt, email }: NewsletterBannerProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const isSubscribed = !!acceptNewsletter && !unsubscribedAt;

  const handleSubscribe = useCallback(async () => {
    if (!email) {
      toast({ title: "Sem email", description: "O contacto não tem email definido.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await patchContact(contactId, {
        accept_newsletter: true,
        newsletter_consent_at: new Date().toISOString(),
        newsletter_consent_source: "crm_manual",
        newsletter_unsubscribed_at: null,
      });
      toast({ title: "Subscrito à newsletter" });
      queryClient.refetchQueries({ queryKey: ["customer360", contactId] });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
    setSaving(false);
  }, [contactId, email, queryClient]);

  const handleUnsubscribe = useCallback(async () => {
    setSaving(true);
    try {
      await patchContact(contactId, {
        accept_newsletter: false,
        newsletter_unsubscribed_at: new Date().toISOString(),
      });
      toast({ title: "Removido da newsletter" });
      queryClient.refetchQueries({ queryKey: ["customer360", contactId] });
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
    setSaving(false);
  }, [contactId, queryClient]);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Newsletter</span>
        </div>
        <Badge variant="outline" className={isSubscribed ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}>
          {isSubscribed ? "Subscrito" : "Não subscrito"}
        </Badge>
      </div>

      {isSubscribed && consentAt && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Consentimento: {new Date(consentAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}</p>
          {consentSource && <p>Origem: {consentSource}</p>}
        </div>
      )}

      {unsubscribedAt && (
        <p className="text-xs text-red-600">
          Removido em: {new Date(unsubscribedAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}

      <div className="flex gap-2">
        {!isSubscribed ? (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={handleSubscribe} disabled={saving || !email}>
            <Check className="h-3 w-3 mr-1" />
            Subscrever
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-6 text-xs text-red-600 hover:text-red-700" onClick={handleUnsubscribe} disabled={saving}>
            <MailX className="h-3 w-3 mr-1" />
            Remover subscrição
          </Button>
        )}
      </div>
    </div>
  );
}
