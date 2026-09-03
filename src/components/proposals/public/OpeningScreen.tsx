import { tokens, fonts } from "./design-tokens";

interface OpeningScreenProps {
  quotation: {
    quotation_number?: string | null;
    customer_name?: string;
    customer_company?: string;
    date_created?: string | null;
  };
  company: { name?: string; logo_url?: string };
  onEnter: () => void;
  onSkipToPrice: () => void;
}

export function OpeningScreen({ quotation, company, onEnter, onSkipToPrice }: OpeningScreenProps) {
  const year = quotation.date_created
    ? new Date(quotation.date_created).getFullYear()
    : new Date().getFullYear();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(160deg, ${tokens.tealDark} 0%, #0b4a56 50%, ${tokens.tealDark} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 22px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Geometric grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: "center", position: "relative" }}>
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name || ""}
            crossOrigin="anonymous"
            style={{ height: 44, objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "block";
            }}
          />
        ) : null}
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: "1.6rem",
            fontWeight: 700,
            color: tokens.white,
            margin: 0,
            display: company.logo_url ? "none" : "block",
          }}
        >
          {company.name || "HotelEquip"}
        </p>
      </div>

      {/* Tagline */}
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          color: tokens.faint,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          marginBottom: 28,
        }}
      >
        EQUIPAMENTOS HORECA · DESDE 2012
      </p>

      {/* Headline */}
      <h1
        style={{
          fontFamily: fonts.serif,
          fontSize: "2rem",
          fontWeight: 700,
          color: tokens.white,
          textAlign: "center",
          margin: "0 0 32px",
          lineHeight: 1.2,
        }}
      >
        Proposta Comercial Exclusiva
      </h1>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 36,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {[
          { value: "12+", label: "anos" },
          { value: "500+", label: "clientes" },
          { value: "48h", label: "resposta" },
        ].map(({ value, label }) => (
          <div
            key={label}
            style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
              borderRadius: 12,
              padding: "14px 20px",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 20,
                fontWeight: 700,
                color: tokens.amber,
              }}
            >
              {value}
            </div>
            <div style={{ fontFamily: fonts.sans, fontSize: 11, color: tokens.faint }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Customer card */}
      {(quotation.customer_name || quotation.customer_company) && (
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "16px 24px",
            marginBottom: 36,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: fonts.serif,
              fontSize: 18,
              fontWeight: 600,
              color: tokens.white,
              margin: 0,
            }}
          >
            {quotation.customer_name}
          </p>
          {quotation.customer_company && (
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: tokens.faint,
                margin: "4px 0 0",
              }}
            >
              {quotation.customer_company}
            </p>
          )}
        </div>
      )}

      {/* CTA Buttons */}
      <button
        type="button"
        onClick={onEnter}
        style={{
          background: tokens.amber,
          color: tokens.white,
          fontFamily: fonts.sans,
          fontSize: 15,
          fontWeight: 600,
          padding: "16px 36px",
          borderRadius: 50,
          border: "none",
          cursor: "pointer",
          marginBottom: 14,
          transition: "transform 0.2s, box-shadow 0.2s",
          boxShadow: `0 4px 20px rgba(212,146,10,0.35)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        Ver a minha proposta →
      </button>

      <button
        type="button"
        onClick={onSkipToPrice}
        style={{
          background: "transparent",
          color: "rgba(255,255,255,0.6)",
          fontFamily: fonts.sans,
          fontSize: 13,
          padding: "10px 20px",
          borderRadius: 50,
          border: "1px solid rgba(255,255,255,0.15)",
          cursor: "pointer",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "rgba(255,255,255,0.9)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "rgba(255,255,255,0.6)";
        }}
      >
        Ir directamente para os preços
      </button>

      {/* Ref number */}
      {quotation.quotation_number && (
        <p
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            color: tokens.faint,
            marginTop: 32,
            opacity: 0.7,
          }}
        >
          REF. {quotation.quotation_number} · {year}
        </p>
      )}
    </div>
  );
}
