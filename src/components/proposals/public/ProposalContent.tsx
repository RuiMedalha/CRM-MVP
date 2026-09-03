import type { PublicQuotation } from "@/types/quotation";
import { ProposalHero } from "./ProposalHero";
import { UrgencyBanner } from "./UrgencyBanner";
import { ProductCard } from "./ProductCard";
import { ComparisonTable } from "./ComparisonTable";
import { FinancialSummary } from "./FinancialSummary";
import { ValidityCountdown } from "./ValidityCountdown";
import { MediaSection } from "./MediaSection";
import { NextStepsSection } from "./NextStepsSection";
import { ActionButtons } from "./ActionButtons";
import { ProposalFooter } from "./ProposalFooter";

interface CompanySettings {
  name: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  vat_number?: string;
  iban?: string;
}

interface ProposalContentProps {
  quotation: PublicQuotation;
  onApprove: () => void;
  onReject: () => void;
  onDownloadPDF: () => Promise<void>;
  showActions: boolean;
  respondedStatus?: "approved" | "rejected";
  company: CompanySettings;
}

export function ProposalContent({
  quotation,
  onApprove,
  onReject,
  onDownloadPDF,
  showActions,
  respondedStatus,
  company,
}: ProposalContentProps) {
  const items = quotation.items || [];
  const mainItems = items.filter((i) => i.item_type !== "additional");
  const hasUrgency =
    quotation.urgency_discount_pct &&
    quotation.urgency_discount_pct > 0 &&
    quotation.urgency_expires_at;

  // Group comparison items
  const comparisonGroups: Record<string, typeof items> = {};
  const regularItems: typeof items = [];

  mainItems.forEach((item) => {
    if (item.comparison_group) {
      if (!comparisonGroups[item.comparison_group]) {
        comparisonGroups[item.comparison_group] = [];
      }
      comparisonGroups[item.comparison_group].push(item);
    } else {
      regularItems.push(item);
    }
  });

  const hasComparison = Object.keys(comparisonGroups).length > 0;

  return (
    <div className="max-w-3xl mx-auto pb-0">
      {/* Hero */}
      <ProposalHero
        companyLogo={company.logo_url}
        companyName={company.name}
        customerCompany={quotation.customer_company}
        quotationNumber={quotation.quotation_number}
        dateCreated={quotation.date_created}
      />

      <div className="px-4 md:px-6 space-y-10">
        {/* Urgency Banner */}
        {hasUrgency && (
          <UrgencyBanner
            urgencyDiscountPct={Number(quotation.urgency_discount_pct) || 0}
            urgencyExpiresAt={quotation.urgency_expires_at!}
          />
        )}

        {/* Welcome message */}
        {quotation.welcome_message && (
          <div className="he-card p-6 md:p-8">
            <p className="text-base md:text-lg leading-relaxed" style={{ color: "var(--he-text)" }}>
              Olá {quotation.treatment || ""} {quotation.customer_name || ""},
            </p>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--he-text-muted)" }}>
              {quotation.welcome_message.replace("{nome_cliente}", quotation.customer_name || "Cliente")}
            </p>
          </div>
        )}

        {/* Proposal description */}
        {quotation.proposal_description && (
          <div className="text-base leading-relaxed" style={{ color: "var(--he-text-muted)" }}>
            {quotation.proposal_description}
          </div>
        )}

        {/* Regular Products */}
        {regularItems.length > 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="he-title text-2xl mb-2">Produtos & Serviços</h2>
              <div className="he-dots-wide max-w-[80px]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {regularItems.map((item, i) => (
                <ProductCard
                  key={item.id || i}
                  item={item}
                  hasDiscount={!!(hasUrgency && item.discount_percent && item.discount_percent > 0)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Comparison Tables */}
        {hasComparison &&
          Object.entries(comparisonGroups).map(([group, groupItems]) => (
            <ComparisonTable
              key={group}
              items={groupItems}
              companyName={company.name}
              recommendationText={quotation.comparison_recommendation_text}
            />
          ))}

        {/* Financial Summary */}
        <FinancialSummary quotation={quotation} />

        {/* Validity */}
        {quotation.valid_until && (
          <ValidityCountdown validUntil={quotation.valid_until} />
        )}

        {/* Media: video, voice, reviews */}
        <MediaSection
          videoUrl={quotation.video_url}
          voiceMessageUrl={quotation.voice_message_url}
          reviews={quotation.reviews}
        />

        {/* Next steps */}
        {quotation.next_steps && quotation.next_steps.length > 0 && (
          <NextStepsSection steps={quotation.next_steps} />
        )}

        {/* Action Buttons */}
        <ActionButtons
          showActions={showActions}
          respondedStatus={respondedStatus}
          onApprove={onApprove}
          onReject={onReject}
          onDownloadPDF={onDownloadPDF}
        />
      </div>

      {/* Footer */}
      <ProposalFooter
        companyName={company.name}
        companyLogo={company.logo_url}
        companyAddress={company.address}
        companyPhone={company.phone}
        companyEmail={company.email}
        companyVat={company.vat_number}
      />
    </div>
  );
}
