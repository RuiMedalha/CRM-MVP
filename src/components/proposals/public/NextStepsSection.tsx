import { tokens, fonts } from "./design-tokens";
import type { NextStep, NextStepIcon } from "@/types/quotation";

interface NextStepsSectionProps {
  steps: NextStep[];
}

const ICON_MAP: Record<NextStepIcon, string> = {
  payment: "💳",
  phone: "📞",
  calendar: "🚚",
  email: "📧",
  custom: "✨",
};

export function NextStepsSection({ steps }: NextStepsSectionProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <h2
        style={{
          fontFamily: fonts.serif,
          fontSize: "1.2rem",
          color: tokens.text,
          margin: "0 0 20px",
        }}
      >
        O que acontece a seguir?
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {steps.map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "16px 18px",
              background: tokens.card,
              borderRadius: 12,
              border: `1px solid ${tokens.border}`,
            }}
          >
            {/* Number circle */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: tokens.tealSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: 16,
              }}
            >
              {ICON_MAP[step.icon] || `${i + 1}`}
            </div>
            <div>
              <p
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.text,
                  margin: "0 0 2px",
                }}
              >
                {step.title}
              </p>
              <p
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: tokens.muted,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
