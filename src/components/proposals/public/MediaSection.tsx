import { useSlideUp } from "@/hooks/useIntersectionAnimation";
import { Star } from "lucide-react";
import { getVideoEmbedUrl } from "@/lib/videoEmbed";
import type { QuotationReview } from "@/types/quotation";

interface MediaSectionProps {
  videoUrl?: string;
  voiceMessageUrl?: string;
  reviews?: QuotationReview[];
}

export function MediaSection({ videoUrl, voiceMessageUrl, reviews }: MediaSectionProps) {
  const { ref, className } = useSlideUp<HTMLDivElement>();
  const hasContent = videoUrl || voiceMessageUrl || (reviews && reviews.length > 0);

  if (!hasContent) return null;

  return (
    <div ref={ref} className={`space-y-8 ${className}`}>
      {/* Video */}
      {videoUrl && (() => {
        const embedUrl = getVideoEmbedUrl(videoUrl);
        if (!embedUrl) return null;
        return (
          <div className="space-y-3">
            <h2 className="he-title text-xl">Vídeo</h2>
            <div className="he-card overflow-hidden aspect-video">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                title="Vídeo da proposta"
              />
            </div>
          </div>
        );
      })()}

      {/* Voice message */}
      {voiceMessageUrl && (
        <div className="space-y-3">
          <h2 className="he-title text-xl">Mensagem de Voz</h2>
          <div className="he-card p-4">
            <audio controls className="w-full" preload="metadata">
              <source src={voiceMessageUrl} type="audio/webm" />
              <source src={voiceMessageUrl} type="audio/mpeg" />
              O seu navegador não suporta áudio.
            </audio>
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews && reviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="he-title text-xl">O que dizem os nossos clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((review, i) => (
              <div key={i} className="he-card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                    style={{ backgroundColor: "var(--he-teal)" }}
                  >
                    {review.reviewer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{review.reviewer_name}</p>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className="h-3.5 w-3.5"
                          style={{
                            fill: j < review.rating ? "var(--he-amber)" : "transparent",
                            color: j < review.rating ? "var(--he-amber)" : "var(--he-border)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {review.review_text && (
                  <p className="text-sm leading-relaxed" style={{ color: "var(--he-text-muted)" }}>
                    "{review.review_text}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
