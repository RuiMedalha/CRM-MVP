import { useState, useEffect } from "react";
import { tokens, fonts } from "./design-tokens";

interface Review {
  id: number;
  reviewer_name: string;
  rating: number;
  review_text: string;
  source?: string;
  date_created: string;
}

interface ReviewsSectionProps {
  quotationId: number | string;
}

const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL || "https://api.hotelequip.pt").replace(/\/$/, "");

export function ReviewsSection({ quotationId }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!quotationId) return;
    fetch(
      `${DIRECTUS_URL}/items/quotation_reviews?filter[quotation_id][_eq]=${quotationId}&sort=-date_created&limit=10`
    )
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setReviews(json?.data ?? []))
      .catch(() => {});
  }, [quotationId]);

  if (reviews.length === 0) return null;

  return (
    <div
      style={{
        background: tokens.tealSoft,
        borderRadius: 16,
        padding: "28px 24px",
        marginTop: 28,
      }}
    >
      <h3
        style={{
          fontFamily: fonts.serif,
          fontSize: 20,
          fontWeight: 700,
          color: tokens.text,
          margin: "0 0 20px",
          textAlign: "center",
        }}
      >
        O que dizem os nossos clientes
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {reviews.map((review) => (
          <div
            key={review.id}
            style={{
              background: tokens.card,
              borderRadius: 12,
              padding: "16px 20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.text,
                }}
              >
                {review.reviewer_name}
              </span>
              <span style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.amber }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i}>{i < review.rating ? "★" : "☆"}</span>
                ))}
              </span>
            </div>
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 13.5,
                color: tokens.muted,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {review.review_text}
            </p>
            {review.source && (
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  color: tokens.faint,
                  marginTop: 8,
                  display: "block",
                }}
              >
                via {review.source}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
