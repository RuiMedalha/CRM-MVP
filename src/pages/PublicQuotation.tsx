import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getQuotationByToken,
  getPublicCompanySettings,
  recordView,
  respondToQuotation,
  verifyPhoneGate,
} from "@/integrations/directus/quotationPublic";
import { generateProposalPDF } from "@/utils/generateProposalPDF";
import { n } from "@/components/proposals/public/utils";
import { tokens, fonts, darkTokens } from "@/components/proposals/public/design-tokens";
import type { PublicQuotation as PublicQuotationType, PublicQuotationItem } from "@/types/quotation";

import { OpeningScreen } from "@/components/proposals/public/OpeningScreen";
import { PhoneGate } from "@/components/proposals/public/PhoneGate";
import { ProposalHero } from "@/components/proposals/public/ProposalHero";
import { UrgencyBanner } from "@/components/proposals/public/UrgencyBanner";
import { WelcomeSection } from "@/components/proposals/public/WelcomeSection";
import { MediaSection } from "@/components/proposals/public/MediaSection";
import { ProductsSection } from "@/components/proposals/public/ProductsSection";
import { ComparisonSection } from "@/components/proposals/public/ComparisonSection";
import { AdditionalsSection } from "@/components/proposals/public/AdditionalsSection";
import { FinancialSummary } from "@/components/proposals/public/FinancialSummary";
import { ValidityCountdown } from "@/components/proposals/public/ValidityCountdown";
import { NextStepsSection } from "@/components/proposals/public/NextStepsSection";
import { TermsSection } from "@/components/proposals/public/TermsSection";
import { ContactSection } from "@/components/proposals/public/ContactSection";
import { PaymentSection } from "@/components/proposals/public/PaymentSection";
import { NewsletterDiscount } from "@/components/proposals/public/NewsletterDiscount";
import { ActionButtons } from "@/components/proposals/public/ActionButtons";
import { ReviewsSection } from "@/components/proposals/public/ReviewsSection";
import { ProposalFooter } from "@/components/proposals/public/ProposalFooter";

interface CompanyData {
  name: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  vat_number?: string;
  iban?: string;
  payment_instructions?: string;
  multibanco_entity?: string;
  multibanco_reference?: string;
  mbway_phone?: string;
}

type Screen = "cover" | "proposal" | "expired";

/**
 * Resolve the effective dark mode based on theme value.
 * - 'dark' -> true
 * - 'light' -> false
 * - 'system' -> use browser's prefers-color-scheme
 */
function useIsDark(theme?: string): boolean {
  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemDark; // system or undefined
}

export default function PublicQuotation() {
  const { token } = useParams<{ token: string }>();
  const [quotation, setQuotation] = useState<PublicQuotationType | null>(null);
  const [company, setCompany] = useState<CompanyData>({ name: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateVerified, setGateVerified] = useState(false);
  const [screen, setScreen] = useState<Screen>("cover");
  const financialRef = useRef<HTMLDivElement>(null);

  // ─── Load quotation and company on mount ─────────────────────────────────
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const [quotationData, companyData] = await Promise.all([
          getQuotationByToken(token),
          getPublicCompanySettings(),
        ]);

        if (cancelled) return;

        if (!quotationData) {
          setError("Proposta não encontrada.");
          return;
        }

        setQuotation(quotationData);

        if (companyData) {
          setCompany({
            name: companyData.name || "",
            logo_url: companyData.logo_url || undefined,
            phone: companyData.phone || undefined,
            email: companyData.email || undefined,
            address: companyData.address || undefined,
            postal_code: (companyData as any).postal_code || undefined,
            city: (companyData as any).city || undefined,
            vat_number: companyData.vat_number || undefined,
            iban: companyData.iban || undefined,
            payment_instructions: (companyData as any).payment_instructions || undefined,
            multibanco_entity: (companyData as any).multibanco_entity || undefined,
            multibanco_reference: (companyData as any).multibanco_reference || undefined,
            mbway_phone: (companyData as any).mbway_phone || undefined,
          });
        }

        // Skip phone gate if not enabled or already responded
        if (!quotationData.phone_gate_enabled) {
          setGateVerified(true);
        }
        if (quotationData.approved_at || quotationData.rejected_at) {
          setGateVerified(true);
          setScreen("proposal");
        }

        // Check if expired
        if (quotationData.valid_until) {
          const expiry = new Date(quotationData.valid_until);
          if (expiry < new Date() && !quotationData.approved_at) {
            setScreen("expired");
          }
        }

        // Record view (non-blocking)
        recordView(quotationData.id, (quotationData as any).view_count || 0).catch(() => {});
      } catch {
        if (!cancelled) setError("Erro ao carregar a proposta.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  // ─── Phone gate handler ──────────────────────────────────────────────────
  const handlePhoneVerify = async (digits: string): Promise<boolean> => {
    if (!token) return false;
    const ok = await verifyPhoneGate(token, digits);
    if (ok) setGateVerified(true);
    return ok;
  };

  // ─── Approve / Reject handlers ──────────────────────────────────────────
  const handleApprove = useCallback(async (signature: string) => {
    if (!quotation) return;
    await respondToQuotation(quotation.id, "approved", signature);
    setQuotation((prev) => prev ? { ...prev, approved_at: new Date().toISOString(), status: "approved" } : prev);
  }, [quotation]);

  const handleReject = useCallback(async (reason?: string) => {
    if (!quotation) return;
    await respondToQuotation(quotation.id, "rejected", undefined, reason);
    setQuotation((prev) => prev ? { ...prev, rejected_at: new Date().toISOString(), status: "rejected" } : prev);
  }, [quotation]);

  // ─── PDF download ────────────────────────────────────────────────────────
  const handleDownloadPDF = useCallback(async () => {
    if (!quotation) return;

    // If a pre-generated PDF file exists, download it directly
    if (quotation.pdf_file_url) {
      const a = document.createElement("a");
      a.href = quotation.pdf_file_url;
      a.download = `proposta-${quotation.quotation_number || quotation.id}.pdf`;
      a.target = "_blank";
      a.click();
      return;
    }

    // Generate PDF via HTML template + jsPDF
    await generateProposalPDF(quotation, company);
  }, [quotation, company]);

  // ─── Derived item splits ─────────────────────────────────────────────────
  const { mainItems, additionalItems, comparisonGroups, allItems } = useMemo(() => {
    const items: PublicQuotationItem[] = quotation?.items || [];
    const main: PublicQuotationItem[] = [];
    const additional: PublicQuotationItem[] = [];
    const groupMap: Record<string, PublicQuotationItem[]> = {};

    items.forEach((item) => {
      if (item.item_type === "additional") {
        additional.push(item);
      } else if (item.comparison_group) {
        if (!groupMap[item.comparison_group]) groupMap[item.comparison_group] = [];
        groupMap[item.comparison_group].push(item);
      } else {
        main.push(item);
      }
    });

    const groups = Object.entries(groupMap).map(([group, groupItems]) => ({ group, items: groupItems }));
    return { mainItems: main, additionalItems: additional, comparisonGroups: groups, allItems: items };
  }, [quotation?.items]);

  // ─── Theme ──────────────────────────────────────────────────────────────
  const isDark = useIsDark(quotation?.theme);
  const bg = isDark ? darkTokens.bg : tokens.bg;
  const textColor = isDark ? darkTokens.text : tokens.text;

  // ─── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{ background: tokens.bg, minHeight: "100vh" }}
        className="flex items-center justify-center"
      >
        <div className="text-center space-y-4">
          <div
            className="animate-spin mx-auto"
            style={{
              width: 40,
              height: 40,
              border: `3px solid ${tokens.border}`,
              borderTopColor: tokens.teal,
              borderRadius: "50%",
            }}
          />
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.muted }}>
            A carregar proposta...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────
  if (error || !quotation) {
    return (
      <div
        style={{ background: tokens.bg, minHeight: "100vh" }}
        className="flex items-center justify-center px-4"
      >
        <div className="text-center space-y-3">
          <p style={{ fontFamily: fonts.serif, fontSize: 20, fontWeight: 600, color: tokens.text }}>
            {error || "Proposta não encontrada"}
          </p>
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.muted }}>
            Verifique o link ou contacte-nos.
          </p>
          {company.phone && (
            <p style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 500, color: tokens.teal }}>
              Tel: {company.phone}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Expired state ──────────────────────────────────────────────────────
  if (screen === "expired") {
    return (
      <div
        style={{ background: tokens.bg, minHeight: "100vh" }}
        className="flex items-center justify-center px-4"
      >
        <div className="text-center space-y-4">
          <div style={{ fontSize: 96 }}>⌛</div>
          <p style={{ fontFamily: fonts.serif, fontSize: 24, fontWeight: 700, color: tokens.text }}>
            Esta proposta expirou
          </p>
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.muted }}>
            Contacte-nos para receber uma proposta actualizada.
          </p>
          {company.phone && (
            <p style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 500, color: tokens.teal }}>
              📞 {company.phone}
            </p>
          )}
          {company.email && (
            <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.teal }}>
              📧 {company.email}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Quotation (ORC) — no interactive page ────────────────────────────────
  if ((quotation as any).document_type === "quotation") {
    return (
      <div
        style={{ background: tokens.bg, minHeight: "100vh" }}
        className="flex items-center justify-center px-4"
      >
        <div className="text-center space-y-4" style={{ maxWidth: 400 }}>
          <div style={{ fontSize: 64 }}>📋</div>
          <p style={{ fontFamily: fonts.serif, fontSize: 20, fontWeight: 600, color: tokens.text }}>
            Este documento não tem versão interactiva
          </p>
          <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.muted }}>
            Para mais informações sobre este orçamento, contacte-nos directamente.
          </p>
          {company.phone && (
            <a
              href={`tel:${company.phone}`}
              style={{ fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, color: tokens.teal, textDecoration: "none" }}
            >
              📞 {company.phone}
            </a>
          )}
        </div>
      </div>
    );
  }

  // ─── Phone Gate ──────────────────────────────────────────────────────────
  if (!gateVerified && quotation.phone_gate_enabled) {
    return (
      <PhoneGate
        onVerify={handlePhoneVerify}
        companyLogo={company.logo_url}
        companyName={company.name}
      />
    );
  }

  // ─── Opening screen (cover) ─────────────────────────────────────────────
  if (screen === "cover") {
    return (
      <OpeningScreen
        quotation={quotation}
        company={company}
        onEnter={() => setScreen("proposal")}
        onSkipToPrice={() => {
          setScreen("proposal");
          setTimeout(() => {
            financialRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }}
      />
    );
  }

  // ─── Main proposal layout ───────────────────────────────────────────────
  return (
    <div style={{ background: bg, color: textColor, minHeight: "100vh" }}>
      {/* Teal bar */}
      <div style={{ height: 4, background: tokens.teal, width: "100%" }} />

      <div className="he-proposal-container">
        <ProposalHero company={company} quotation={quotation} />

        {n(quotation.urgency_discount_pct) > 0 && quotation.urgency_expires_at && (
          <UrgencyBanner quotation={quotation} />
        )}

        <WelcomeSection quotation={quotation} />

        {(quotation.voice_message_url || quotation.video_url) && (
          <MediaSection
            voiceMessageUrl={quotation.voice_message_url || undefined}
            videoUrl={quotation.video_url || undefined}
          />
        )}

        {mainItems.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <ProductsSection items={mainItems} quotation={quotation} />
          </div>
        )}

        {comparisonGroups.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <ComparisonSection groups={comparisonGroups} quotation={quotation} />
          </div>
        )}

        {additionalItems.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <AdditionalsSection items={additionalItems} />
          </div>
        )}

        <ReviewsSection quotationId={quotation.id} />

        <div ref={financialRef}>
          <FinancialSummary quotation={quotation} items={allItems} />
        </div>

        {/* Newsletter discount */}
        {(quotation as any).newsletter_discount_code && (
          <NewsletterDiscount
            quotationId={quotation.id}
            quotationNumber={quotation.quotation_number}
            discountCode={(quotation as any).newsletter_discount_code}
            discountPercent={(quotation as any).newsletter_discount_percent || 5}
            alreadyApplied={(quotation as any).newsletter_applied}
          />
        )}

        {quotation.valid_until && <ValidityCountdown until={quotation.valid_until} />}

        {quotation.next_steps && (quotation.next_steps as any[]).length > 0 && (
          <NextStepsSection steps={quotation.next_steps as any[]} />
        )}

        {quotation.terms_conditions && <TermsSection text={quotation.terms_conditions} />}

        {/* Payment methods — visível se há algum método de pagamento */}
        {(company.iban || company.multibanco_entity || company.mbway_phone) && (
          <PaymentSection
            depositAmount={
              quotation.deposit_type === "partial" && n(quotation.deposit_percent) > 0
                ? n(quotation.total_amount || 0) * n(quotation.deposit_percent) / 100
                : n(quotation.total_amount || 0)
            }
            depositPercent={
              quotation.deposit_type === "partial" && n(quotation.deposit_percent) > 0
                ? n(quotation.deposit_percent)
                : 100
            }
            company={company}
          />
        )}

        <ContactSection company={company} />

        <ActionButtons
          quotation={quotation}
          company={company}
          onApprove={handleApprove}
          onReject={handleReject}
          onDownloadPDF={handleDownloadPDF}
        />
      </div>

      <ProposalFooter company={company} quotationNumber={quotation.quotation_number} />

      {/* Global animation + responsive styles */}
      <style>{`
        .he-proposal-container {
          max-width: 430px;
          margin: 0 auto;
          padding: 0 22px;
        }
        @media (min-width: 768px) {
          .he-proposal-container {
            max-width: 860px;
            padding: 0 40px;
          }
        }
        .he-products-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .he-products-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
        }
        @keyframes revealUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .he-slide-up { opacity: 0; transform: translateY(18px); }
        .he-slide-up.he-visible { animation: revealUp 0.5s ease forwards; }
        @media (prefers-reduced-motion: reduce) {
          .he-slide-up { opacity: 1; transform: none; }
          .he-slide-up.he-visible { animation: none; }
        }
      `}</style>
    </div>
  );
}
