import { useState, useEffect } from "react";
import { tokens, fonts } from "./design-tokens";
import { n } from "./utils";

interface UrgencyBannerProps {
  quotation: { urgency_discount_pct?: any; urgency_hours?: any; urgency_expires_at?: string | null };
}

export function UrgencyBanner({ quotation }: UrgencyBannerProps) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  const discountPct = n(quotation.urgency_discount_pct);
  const hours = n(quotation.urgency_hours);
  const expiresAt = quotation.urgency_expires_at;

  useEffect(() => {
    if (!expiresAt) {
      setExpired(true);
      return;
    }

    const update = () => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setExpired(true);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ hours: h, minutes: m, seconds: s });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (expired || !expiresAt) return null;

  const pad = (v: number) => v.toString().padStart(2, "0");
  const countdown = `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`;

  return (
    <div
      style={{
        background: tokens.amberSoft,
        borderLeft: `4px solid ${tokens.amber}`,
        borderRadius: 12,
        padding: "16px 20px",
        marginTop: 20,
      }}
    >
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          fontWeight: 700,
          color: tokens.amber,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: "0 0 8px",
        }}
      >
        ⏱ OFERTA POR TEMPO LIMITADO
      </p>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 15,
          color: tokens.text,
          margin: "0 0 12px",
        }}
      >
        Aceite nas próximas {hours}h e poupe {discountPct}%
      </p>
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 24,
          fontWeight: 700,
          color: tokens.amber,
          margin: 0,
        }}
      >
        {countdown}
      </p>
    </div>
  );
}
