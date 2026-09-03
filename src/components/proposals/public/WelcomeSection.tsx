import { tokens, fonts } from "./design-tokens";

interface WelcomeSectionProps {
  quotation: {
    treatment?: string | null;
    customer_name?: string;
    welcome_message?: string | null;
    proposal_description?: string | null;
  };
}

export function WelcomeSection({ quotation }: WelcomeSectionProps) {
  if (!quotation.welcome_message) return null;

  return (
    <div
      style={{
        background: tokens.card,
        borderLeft: `3px solid ${tokens.teal}`,
        borderRadius: 14,
        padding: 24,
        marginTop: 24,
      }}
    >
      <p
        style={{
          fontFamily: fonts.serif,
          fontWeight: 600,
          fontSize: 18,
          color: tokens.text,
          margin: "0 0 12px",
        }}
      >
        Caro {quotation.treatment ? `${quotation.treatment} ` : ""}
        {quotation.customer_name},
      </p>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 14,
          color: tokens.muted,
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {quotation.welcome_message}
      </p>
      {quotation.proposal_description && (
        <>
          <hr
            style={{
              border: "none",
              borderTop: `1px solid ${tokens.border}`,
              margin: "16px 0",
            }}
          />
          <p
            style={{
              fontFamily: fonts.sans,
              fontStyle: "italic",
              fontSize: 14,
              color: tokens.muted,
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            {quotation.proposal_description}
          </p>
        </>
      )}
    </div>
  );
}
