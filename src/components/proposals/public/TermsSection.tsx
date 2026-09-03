interface TermsSectionProps {
  text: string;
}

export function TermsSection({ text }: TermsSectionProps) {
  if (!text) return null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <h2
        style={{
          fontFamily: "serif",
          fontSize: "1.125rem",
          color: "#1a1a2e",
          margin: "0 0 12px 0",
        }}
      >
        Termos e Condições
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "#4a5568",
          lineHeight: 1.7,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </p>
    </div>
  );
}
