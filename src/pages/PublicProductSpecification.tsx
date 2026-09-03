import { useEffect, useMemo, useState, useRef, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { getPublicCompanySettings, getQuotationByToken } from "@/integrations/directus/quotationPublic";
import {
  getSpecificationsByItemIds,
  submitSpecificationAnswers,
  uploadSpecificationPhoto,
  type ProductSpecification,
  type SpecAnswer,
} from "@/integrations/directus/productSpecifications";
import { validateSpecificationAnswers } from "@/components/proposals/public/SpecificationForm";
import type { PublicQuotation, PublicQuotationItem } from "@/types/quotation";
import { ProductCard } from "@/components/proposals/public/ProductCard";
import { SpecificationForm } from "@/components/proposals/public/SpecificationForm";
import { tokens, fonts } from "@/components/proposals/public/design-tokens";

interface CompanyData {
  name?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
}

interface SpecItem {
  item: PublicQuotationItem;
  spec: ProductSpecification;
}

export default function PublicProductSpecification() {
  const { token, itemId } = useParams<{ token: string; itemId?: string }>();
  const [quotation, setQuotation] = useState<PublicQuotation | null>(null);
  const [specItems, setSpecItems] = useState<SpecItem[]>([]);
  const [company, setCompany] = useState<CompanyData>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Track answers per spec id
  const answersRef = useRef<Record<string, { answers: SpecAnswer[]; photoFile?: File }>>({});
  const [clientNotes, setClientNotes] = useState("");
  const [extraPhotos, setExtraPhotos] = useState<File[]>([]);
  const [extraPhotoError, setExtraPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [quotationData, companyData] = await Promise.all([
          getQuotationByToken(token),
          getPublicCompanySettings(),
        ]);
        if (cancelled) return;

        if (!quotationData) {
          setError("Formulário não encontrado.");
          return;
        }

        if (quotationData.valid_until) {
          const expiry = new Date(quotationData.valid_until);
          if (expiry < new Date() && !quotationData.approved_at) {
            setError("Este formulário expirou. Contacte a HotelEquip para actualizar a proposta.");
            return;
          }
        }

        const items = quotationData.items || [];
        // If legacy single-item link, filter to that item
        const candidateItems = itemId
          ? items.filter((i) => String(i.id) === String(itemId))
          : items;

        if (!candidateItems.length) {
          setError("Formulário não encontrado.");
          return;
        }

        const itemIds = candidateItems.map((i) => i.id);
        const specs = await getSpecificationsByItemIds(itemIds);

        if (!specs.length) {
          setError("Ainda não existe formulário de especificação para esta proposta.");
          return;
        }

        // Join items with their specs
        const joined: SpecItem[] = [];
        for (const spec of specs) {
          const matchedItem = candidateItems.find((i) => String(i.id) === String(spec.quotation_item_id));
          if (matchedItem) joined.push({ item: matchedItem, spec });
        }

        if (!joined.length) {
          setError("Formulário não encontrado.");
          return;
        }

        setQuotation(quotationData);
        setSpecItems(joined);
        setCompany(companyData || {});
        setSubmitted(joined.every((si) => si.spec.status === "submitted"));
      } catch (err) {
        setError(String((err as Error)?.message || "Erro ao carregar formulário."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token, itemId]);

  const title = useMemo(() => {
    if (!quotation) return "Especificação de produto";
    return `Especificação ${quotation.quotation_number ? `— ${quotation.quotation_number}` : ""}`;
  }, [quotation]);

  const handleChange = (specId: string | number, answers: SpecAnswer[], photoFile?: File) => {
    answersRef.current[String(specId)] = { answers, photoFile };
  };

  const handleExtraPhotos = (files?: FileList | null) => {
    setExtraPhotoError(null);
    const selected = Array.from(files || []);
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        setExtraPhotoError("As fotografias extra devem ser imagens (JPG, PNG ou WebP).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setExtraPhotoError("Cada fotografia extra não pode exceder 5 MB.");
        return;
      }
    }
    setExtraPhotos(selected.slice(0, 5));
  };

  const handleSubmitAll = async () => {
    setSubmitError(null);
    // Validate all
    for (const { item, spec } of specItems) {
      const entry = answersRef.current[String(spec.id)];
      const answers = entry?.answers || spec.answers || [];
      const hasPhoto = (spec.questions || []).some((q) => q.type === "photo");
      const validationError = validateSpecificationAnswers(
        spec.questions || [],
        answers,
        hasPhoto,
        entry?.photoFile,
        spec.photo_url
      );
      if (validationError) {
        setSubmitError(`${item.product_name || "Produto"}: ${validationError}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const extraPhotoUrls: string[] = [];
      for (const file of extraPhotos) {
        extraPhotoUrls.push(await uploadSpecificationPhoto(file));
      }

      for (let idx = 0; idx < specItems.length; idx += 1) {
        const { spec } = specItems[idx];
        const entry = answersRef.current[String(spec.id)];
        const answers = [...(entry?.answers || spec.answers || [])];
        if (idx === 0 && (clientNotes.trim() || extraPhotoUrls.length)) {
          answers.push({
            meta_type: "client_notes",
            answer_text: clientNotes.trim(),
            extra_photo_urls: extraPhotoUrls,
          });
        }
        const photoUrl = entry?.photoFile
          ? await uploadSpecificationPhoto(entry.photoFile)
          : spec.photo_url;
        await submitSpecificationAnswers(spec.id, answers, photoUrl || null);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(String((err as Error)?.message || "Erro ao submeter."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Shell company={company}><StateMessage title="A carregar..." /></Shell>;
  if (error) return <Shell company={company}><StateMessage title="Não foi possível abrir" text={error} /></Shell>;
  if (!quotation || !specItems.length) return <Shell company={company}><StateMessage title="Formulário não encontrado" /></Shell>;

  return (
    <Shell company={company}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 18px 60px" }}>
        <header style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ color: tokens.teal, fontFamily: fonts.sans, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", fontSize: 12 }}>
            HotelEquip
          </div>
          <h1 style={{ margin: "8px 0 10px", fontFamily: fonts.serif, fontSize: 38, lineHeight: 1.1, color: tokens.text }}>
            {title}
          </h1>
          <p style={{ margin: 0, color: tokens.muted, fontSize: 16 }}>
            Obrigado pelo seu pedido! Ajude-nos a confirmar os requisitos dos produtos antes de finalizarmos a proposta.
          </p>
          {quotation.customer_name && (
            <p style={{ margin: "8px 0 0", color: tokens.faint, fontSize: 14 }}>
              Cliente: {quotation.customer_name}{quotation.customer_company ? ` · ${quotation.customer_company}` : ""}
            </p>
          )}
        </header>

        {submitted ? (
          <div style={{ background: tokens.card, borderRadius: 20, padding: 32, textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: "0 0 8px", color: tokens.text, fontFamily: fonts.serif }}>Respostas enviadas</h2>
            <p style={{ margin: 0, color: tokens.muted }}>
              Obrigado. A equipa HotelEquip irá rever as respostas e ajustar a proposta.
            </p>
          </div>
        ) : (
          <>
            {specItems.map(({ item, spec }, idx) => (
              <section key={String(spec.id)} style={{ marginBottom: 32 }}>
                <h2 style={sectionTitle}>
                  {specItems.length > 1 ? `${idx + 1}. ` : ""}Produto de referência
                </h2>
                <ProductCard item={{ ...item, notes: undefined }} />
                <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: tokens.amberSoft, color: tokens.text, fontSize: 14 }}>
                  Para lhe garantirmos a solução certa, precisamos de confirmar alguns detalhes sobre este equipamento.
                </div>
                <div style={{ marginTop: 18 }}>
                  <SpecificationForm
                    questions={spec.questions || []}
                    initialAnswers={spec.answers || []}
                    initialPhotoUrl={spec.photo_url}
                    submitting={submitting}
                    showSubmit={false}
                    onChange={(answers, photoFile) => handleChange(spec.id, answers, photoFile)}
                    formId={`spec-${spec.id}`}
                  />
                </div>
              </section>
            ))}

            <section style={{ marginBottom: 24, background: tokens.card, border: `1px solid ${tokens.border}`, borderRadius: 16, padding: 18 }}>
              <h2 style={{ ...sectionTitle, marginBottom: 8 }}>Alguma coisa mais que queira acrescentar?</h2>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Escreva aqui notas, medidas, restrições ou preferências adicionais..."
                style={{ width: "100%", minHeight: 90, padding: 12, borderRadius: 12, border: `1px solid ${tokens.border}`, fontFamily: fonts.sans, boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", color: tokens.muted, fontSize: 13, marginBottom: 6 }}>Fotografias extra (opcional, até 5 imagens, 5 MB cada)</label>
                <input type="file" accept="image/*" multiple onChange={(e) => handleExtraPhotos(e.target.files)} />
                {extraPhotos.length > 0 && <p style={{ color: tokens.success, fontSize: 13 }}>✓ {extraPhotos.length} fotografia(s) selecionada(s)</p>}
                {extraPhotoError && <p style={{ color: "#dc2626", fontSize: 13 }}>{extraPhotoError}</p>}
              </div>
            </section>

            {submitError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 12, marginBottom: 16 }}>
                {submitError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitAll}
              disabled={submitting}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "16px 28px",
                background: tokens.teal,
                color: tokens.white,
                fontWeight: 800,
                fontFamily: fonts.sans,
                fontSize: 16,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                boxShadow: "0 8px 24px rgba(26,107,124,0.25)",
                width: "100%",
              }}
            >
              {submitting ? "A enviar..." : "Enviar todas as respostas"}
            </button>
          </>
        )}

        <footer style={{ marginTop: 36, textAlign: "center", color: tokens.faint, fontSize: 13 }}>
          {company.phone || company.email ? (
            <span>
              Dúvidas? {company.phone && <span>{company.phone}</span>}{company.phone && company.email && " · "}{company.email && <span>{company.email}</span>}
            </span>
          ) : (
            <span>HotelEquip — equipamentos HORECA para profissionais.</span>
          )}
        </footer>
      </div>
    </Shell>
  );
}

function Shell({ children, company }: { children: ReactNode; company: CompanyData }) {
  return (
    <div style={{ minHeight: "100vh", background: tokens.bg, fontFamily: fonts.sans, color: tokens.text }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px 18px 0", display: "flex", alignItems: "center", gap: 12 }}>
        {company.logo_url ? (
          <img src={company.logo_url} alt={company.name || "HotelEquip"} style={{ maxHeight: 42, maxWidth: 160, objectFit: "contain" }} />
        ) : (
          <div style={{ fontWeight: 900, color: tokens.teal }}>HotelEquip</div>
        )}
      </div>
      {children}
    </div>
  );
}

function StateMessage({ title, text }: { title: string; text?: string }) {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontFamily: fonts.serif, color: tokens.text, margin: "0 0 12px" }}>{title}</h1>
      {text && <p style={{ color: tokens.muted, margin: 0 }}>{text}</p>}
    </div>
  );
}

const sectionTitle: CSSProperties = {
  fontFamily: fonts.serif,
  color: tokens.text,
  margin: "0 0 14px",
  fontSize: 24,
};
