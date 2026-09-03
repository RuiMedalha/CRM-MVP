import { tokens, fonts } from "./design-tokens";

interface ContactSectionProps {
  company: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

export function ContactSection({ company }: ContactSectionProps) {
  if (!company.phone && !company.email) return null;

  return (
    <div
      style={{
        background: tokens.tealSoft,
        borderRadius: 14,
        padding: 28,
        textAlign: "center",
        marginTop: 28,
      }}
    >
      <h2
        style={{
          fontFamily: fonts.serif,
          fontSize: "1.2rem",
          color: tokens.text,
          margin: "0 0 8px",
        }}
      >
        Tem alguma questão?
      </h2>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: tokens.muted,
          margin: "0 0 20px",
        }}
      >
        A nossa equipa está disponível para esclarecer qualquer dúvida.
      </p>

      {/* WhatsApp button */}
      {company.phone && (
        <a
          href={`https://wa.me/${company.phone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            width: "100%",
            padding: "14px 0",
            background: tokens.whatsapp,
            color: tokens.white,
            borderRadius: 10,
            fontFamily: fonts.sans,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          💬 Contactar por WhatsApp
        </a>
      )}

      <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
        {company.phone && (
          <a
            href={`tel:${company.phone}`}
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              color: tokens.teal,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            📞 {company.phone}
          </a>
        )}
        {company.email && (
          <a
            href={`mailto:${company.email}`}
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              color: tokens.teal,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            📧 {company.email}
          </a>
        )}
      </div>
    </div>
  );
}
