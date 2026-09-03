import { useState } from "react";
import { tokens, fonts } from "./design-tokens";

interface ProposalFooterProps {
  company: {
    name?: string | null;
    logo_url?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    postal_code?: string | null;
    city?: string | null;
    vat_number?: string | null;
    iban?: string | null;
  };
  quotationNumber?: string | null;
}

export function ProposalFooter({ company, quotationNumber }: ProposalFooterProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  const addressLine = [company.address, [company.postal_code, company.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <footer
      style={{
        background: tokens.tealDark,
        color: tokens.white,
        borderRadius: "18px 18px 0 0",
        padding: "40px 24px",
        marginTop: 40,
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 16 }}>
        {company.logo_url && !logoFailed ? (
          <img
            src={company.logo_url}
            alt={company.name || ""}
            crossOrigin="anonymous"
            style={{
              height: 36,
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
            }}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <p
            style={{
              fontFamily: fonts.serif,
              fontSize: 18,
              fontWeight: 700,
              color: tokens.white,
              margin: 0,
            }}
          >
            {company.name}
          </p>
        )}
      </div>

      {/* Tagline */}
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          color: tokens.faint,
          letterSpacing: "0.15em",
          margin: "0 0 20px",
        }}
      >
        EQUIPAMENTOS HORECA · DESDE 2012
      </p>

      {/* Company details */}
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: "rgba(255,255,255,0.8)",
          margin: "0 0 4px",
        }}
      >
        {company.name}
        {company.vat_number && <span> {" | NIF: "}{company.vat_number}</span>}
      </p>

      {addressLine && (
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            margin: "0 0 4px",
          }}
        >
          {addressLine}
        </p>
      )}

      {(company.phone || company.email) && (
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            margin: "0 0 12px",
          }}
        >
          {company.phone && <span>📞 {company.phone}</span>}
          {company.phone && company.email && " · "}
          {company.email && <span>📧 {company.email}</span>}
        </p>
      )}

      {/* IBAN */}
      {company.iban && (
        <div
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: "10px 16px",
            display: "inline-block",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            IBAN: {company.iban}
          </span>
        </div>
      )}

      {/* Separator + ref */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.15)",
          margin: "20px 0 16px",
        }}
      />
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          color: tokens.faint,
          margin: 0,
          opacity: 0.7,
        }}
      >
        {quotationNumber && <>REF. {quotationNumber} · </>}
        {new Date().getFullYear()}
      </p>
    </footer>
  );
}
