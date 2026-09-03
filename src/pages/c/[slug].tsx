/**
 * Public Lead Capture Form Page
 * Rota: /c/:slug
 * Renderiza o form embeddable sem autenticacao.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchLeadCaptureFormBySlug } from "@/integrations/directus/leadCaptureForms";
import { renderFormHtml, type LeadCaptureForm } from "@/services/leadCapture/renderForm";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicLeadCapturePage() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<LeadCaptureForm | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) { setForm(null); return; }
      try {
        const row = await fetchLeadCaptureFormBySlug(slug);
        if (cancelled) return;
        if (!row) { setForm(null); return; }
        if (row.is_active === false) { setForm(null); return; }
        setForm(row as LeadCaptureForm);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erro a carregar form");
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const html = useMemo(() => {
    if (!form) return null;
    return renderFormHtml(form, {
      actionUrl: `/api/public/lead-capture/${encodeURIComponent(form.slug)}`,
      theme: "auto",
      branding: form.name,
    });
  }, [form]);

  if (form === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">A carregar formulario...</p>
        </div>
      </div>
    );
  }

  if (form === null || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 shadow-sm text-center">
          <div className="flex justify-center mb-3">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-1">Formulario indisponivel</h1>
          <p className="text-sm text-slate-600 mb-4">
            {error || "O link que abriu nao corresponde a um formulario activo ou ja nao esta disponivel."}
          </p>
          <Button asChild variant="outline"><a href="/">Voltar</a></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-4">
      <div className="mx-auto" dangerouslySetInnerHTML={{ __html: html || "" }} />
    </div>
  );
}
