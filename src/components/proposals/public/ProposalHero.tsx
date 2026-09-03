import { useState } from "react";
import { tokens, fonts } from "./design-tokens";

interface ProposalHeroProps {
  company: { name?: string | null; logo_url?: string | null };
  quotation: {
    quotation_number?: string | null;
    date_created?: string | null;
    customer_name?: string;
    customer_company?: string;
  };
}

export function ProposalHero({ company, quotation }: ProposalHeroProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <header
      style={{
        background: tokens.card,
        borderRadius: 18,
        padding: "40px 24px",
        textAlign: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
        marginTop: 24,
      }}
    >
      {/* Teal bar */}
      <div
        style={{
          height: 4,
          background: tokens.teal,
          borderRadius: 2,
          width: 60,
          margin: "0 auto 28px",
        }}
      />

      {/* Logo */}
      {company.logo_url && !logoFailed ? (
        <img
          src={company.logo_url}
          alt={company.name || ""}
          crossOrigin="anonymous"
          style={{ height: 44, objectFit: "contain", marginBottom: 20 }}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: "1.5rem",
            fontWeight: 700,
            color: tokens.teal,
            margin: "0 0 20px",
          }}
        >
          {company.name}
        </p>
      )}

      {/* Amber dots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginBottom: 24,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: tokens.amber,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <h1
        style={{
          fontFamily: fonts.serif,
          fontSize: 33,
          fontWeight: 700,
          color: tokens.text,
          margin: "0 0 8px",
          lineHeight: 1.2,
        }}
      >
        Proposta Personalizada
      </h1>

      {/* Customer */}
      {(quotation.customer_company || quotation.customer_name) && (
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 15,
            fontWeight: 600,
            color: tokens.teal,
            margin: "0 0 12px",
          }}
        >
          Para {quotation.customer_company || quotation.customer_name}
        </p>
      )}

      {/* Quotation ref */}
      {quotation.quotation_number && (
        <p
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            color: tokens.faint,
            margin: 0,
            letterSpacing: "0.05em",
          }}
        >
          REF. {quotation.quotation_number}
        </p>
      )}
    </header>
  );
}
