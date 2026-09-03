import { useState, useEffect } from "react";
import { tokens, fonts } from "./design-tokens";

interface ValidityCountdownProps {
  until: string;
}

export function ValidityCountdown({ until }: ValidityCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  const parsedDate = new Date(until);
  const isValidDate = until && !isNaN(parsedDate.getTime());

  useEffect(() => {
    if (!isValidDate) return;

    const update = () => {
      const diff = parsedDate.getTime() - Date.now();
      if (diff <= 0) {
        setExpired(true);
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);

  if (!isValidDate) return null;

  if (expired) {
    return (
      <div
        style={{
          background: tokens.card,
          padding: 20,
          borderRadius: 14,
          textAlign: "center",
          marginTop: 24,
        }}
      >
        <p style={{ fontFamily: fonts.sans, color: "#dc2626", fontSize: 14, margin: 0 }}>
          Esta proposta expirou. Contacte-nos para receber uma proposta actualizada.
        </p>
      </div>
    );
  }

  const blocks = [
    { value: timeLeft.days, label: "dias" },
    { value: timeLeft.hours, label: "horas" },
    { value: timeLeft.minutes, label: "min" },
    { value: timeLeft.seconds, label: "seg", highlight: true },
  ];

  return (
    <div
      style={{
        background: tokens.card,
        padding: 24,
        borderRadius: 14,
        marginTop: 24,
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          color: tokens.faint,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        PROPOSTA VÁLIDA POR
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        {blocks.map((block) => (
          <div key={block.label} style={{ textAlign: "center" }}>
            <div
              style={{
                background: tokens.card,
                border: `1px solid ${tokens.border}`,
                borderRadius: 10,
                padding: "12px 16px",
                minWidth: 54,
              }}
            >
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 25,
                  fontWeight: 700,
                  color: block.highlight ? tokens.amber : tokens.text,
                }}
              >
                {block.value.toString().padStart(2, "0")}
              </span>
            </div>
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 10,
                color: tokens.faint,
                margin: "6px 0 0",
              }}
            >
              {block.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
