import { useState } from "react";
import { tokens, fonts } from "./design-tokens";
import { n, eur, eurWithIva, stripHtml } from "./utils";
import type { PublicQuotationItem } from "@/types/quotation";

interface ProductCardProps {
  item: PublicQuotationItem;
  hasUrgency?: boolean;
  canRemove?: boolean;
  onRemove?: () => void;
}

export function ProductCard({ item, hasUrgency, canRemove, onRemove }: ProductCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const unitPrice = n(item.unit_price);
  const discount = n(item.discount_percent);
  const quantity = n(item.quantity);
  const lineTotal = n(item.line_total);
  const ivaPct = n((item as any).iva_percent);
  const sku = (item as any).sku as string | undefined;

  // Meilisearch fields (may be stored in item directly or in ai_description/notes for legacy)
  const shortDesc = item.short_description || item.ai_description || "";
  const fullDesc = item.full_description || item.notes || "";
  const faq = item.faq || "";
  const brand = item.brand || "";
  const onSale = item.on_sale ?? (discount > 0);
  const regularPrice = n(item.regular_price) || unitPrice;
  const salePrice = n(item.sale_price) || (onSale ? unitPrice * (1 - discount / 100) : 0);
  const stockStatus = item.stock_status || "";
  const productUrl = item.product_url || "";

  const finalPrice = onSale && salePrice > 0 ? salePrice : unitPrice;
  const imageUrl = item.image_url || item.images?.[0];
  const isService = item.item_type === "service";
  const showImage = imageUrl && !imgError;

  const hasExpandableContent = fullDesc || faq || (item.images && item.images.length > 1) || item.comparison_specs?.length || item.datasheet_url || productUrl || brand;

  return (
    <div
      style={{
        position: "relative",
        background: tokens.card,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Remove button */}
      {canRemove && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remover produto"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(220,38,38,0.85)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.5)"; }}
        >
          ✕
        </button>
      )}

      {/* Image area */}
      <div
        style={{
          position: "relative",
          height: 220,
          background: "#f0f0eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showImage ? (
          <img
            src={imageUrl}
            alt={item.product_name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 22 }}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <svg
            width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="#8a929c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          >
            {isService ? (
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            ) : (
              <>
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                <path d="m3.3 7 8.7 5 8.7-5" />
                <path d="M12 22V12" />
              </>
            )}
          </svg>
        )}

        {/* Badges */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
          {hasUrgency && (
            <div
              style={{
                background: tokens.amber,
                color: tokens.white,
                fontFamily: fonts.mono,
                fontSize: 10,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                letterSpacing: "0.05em",
              }}
            >
              OFERTA LIMITADA
            </div>
          )}
          {onSale && (
            <div
              style={{
                background: "#dc2626",
                color: tokens.white,
                fontFamily: fonts.mono,
                fontSize: 10,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                letterSpacing: "0.05em",
              }}
            >
              EM PROMOÇÃO
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 22 }}>
        {/* Name */}
        <h3
          style={{
            fontFamily: fonts.serif,
            fontSize: 23,
            fontWeight: 600,
            color: tokens.text,
            margin: "0 0 6px",
            lineHeight: 1.2,
          }}
        >
          {item.product_name}
        </h3>

        {/* Amber underline */}
        <div
          style={{
            width: 46,
            height: 3,
            background: tokens.amber,
            borderRadius: 2,
            marginBottom: 10,
          }}
        />

        {/* Brand + SKU */}
        {(brand || sku) && (
          <p
            style={{
              fontFamily: fonts.mono,
              fontSize: 11,
              color: tokens.faint,
              margin: "0 0 10px",
            }}
          >
            {brand}{brand && sku ? " · " : ""}{sku ? `REF: ${sku}` : ""}
          </p>
        )}

        {/* Short description — max 2 lines */}
        {shortDesc && (
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 13.5,
              color: tokens.muted,
              lineHeight: 1.6,
              margin: "0 0 16px",
              ...(!expanded ? {
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              } : {}),
            }}
          >
            {stripHtml(shortDesc)}
          </p>
        )}

        {/* Price */}
        <div style={{ marginBottom: 16 }}>
          {finalPrice === 0 ? (
            <span
              style={{
                fontFamily: fonts.sans,
                fontSize: 16,
                fontWeight: 600,
                color: tokens.teal,
              }}
            >
              Incluído
            </span>
          ) : (
            <>
              <p
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  color: tokens.faint,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  margin: "0 0 4px",
                }}
              >
                PREÇO CHAVE NA MÃO
              </p>
              {onSale && regularPrice > finalPrice && (
                <span
                  style={{
                    textDecoration: "line-through",
                    color: tokens.faint,
                    fontFamily: fonts.mono,
                    fontSize: 14,
                    marginRight: 8,
                  }}
                >
                  {eur(regularPrice)}
                </span>
              )}
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 30,
                  fontWeight: 700,
                  color: tokens.teal,
                }}
              >
                {eur(finalPrice)}
              </span>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: tokens.faint,
                  marginLeft: 4,
                }}
              >
                + IVA
              </span>
              {ivaPct > 0 && (
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    color: tokens.muted,
                    margin: "4px 0 0",
                  }}
                >
                  c/IVA ({ivaPct}%): {eurWithIva(finalPrice, ivaPct)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Quantity / Subtotal */}
        {lineTotal > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              fontSize: 13,
              fontFamily: fonts.sans,
              color: tokens.muted,
              marginBottom: 16,
            }}
          >
            <span>Quantidade: {quantity}</span>
            <span style={{ textAlign: "right" }}>Subtotal: {eur(lineTotal)}</span>
          </div>
        )}
        {lineTotal === 0 && <div style={{ marginBottom: 16 }} />}

        {/* Expand button — only if there's more content */}
        {hasExpandableContent && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%",
              padding: "10px 0",
              borderRadius: 50,
              border: `1px solid ${tokens.border}`,
              background: "transparent",
              fontFamily: fonts.sans,
              fontSize: 13,
              color: tokens.teal,
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = tokens.tealSoft; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {expanded ? "Menos informação ▲" : "Mais informação ▼"}
          </button>
        )}

        {/* Expanded content */}
        {expanded && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${tokens.border}` }}>
            {/* Full description */}
            {fullDesc && (
              <p
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  color: tokens.muted,
                  lineHeight: 1.7,
                  margin: "0 0 12px",
                  whiteSpace: "pre-wrap",
                }}
              >
                {stripHtml(fullDesc)}
              </p>
            )}

            {/* FAQ */}
            {faq && (
              <div style={{ marginBottom: 12 }}>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: tokens.text,
                    margin: "0 0 6px",
                  }}
                >
                  ❓ Perguntas frequentes
                </p>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: tokens.muted,
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {stripHtml(faq)}
                </p>
              </div>
            )}

            {/* Brand + SKU + Stock */}
            {(brand || stockStatus) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {brand && sku && (
                  <span style={{ fontFamily: fonts.mono, fontSize: 11, color: tokens.faint }}>
                    {brand} · {sku}
                  </span>
                )}
                {stockStatus === "instock" && (
                  <span style={{ fontFamily: fonts.sans, fontSize: 11, color: "#16a34a", fontWeight: 500 }}>
                    ✅ Em stock
                  </span>
                )}
                {stockStatus === "outofstock" && (
                  <span style={{ fontFamily: fonts.sans, fontSize: 11, color: "#dc2626", fontWeight: 500 }}>
                    ❌ Sem stock
                  </span>
                )}
              </div>
            )}

            {/* Image gallery */}
            {item.images && item.images.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                {item.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`${item.product_name} ${i + 1}`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "contain",
                      borderRadius: 8,
                      border: `1px solid ${tokens.border}`,
                      flexShrink: 0,
                      background: "#f8f8f6",
                      padding: 6,
                    }}
                    loading="lazy"
                  />
                ))}
              </div>
            )}

            {/* Comparison specs */}
            {item.comparison_specs && item.comparison_specs.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {item.comparison_specs.map((spec, i) => (
                  <div key={i}>
                    <span
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 11,
                        color: tokens.faint,
                        display: "block",
                      }}
                    >
                      {spec.label}
                    </span>
                    <span
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 13,
                        color: tokens.text,
                        fontWeight: 500,
                      }}
                    >
                      {spec.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Action links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {item.datasheet_url && (
                <a
                  href={item.datasheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    background: tokens.tealSoft,
                    border: `1px solid ${tokens.teal}`,
                    borderRadius: 10,
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: tokens.teal,
                    textDecoration: "none",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
                  📄 {item.datasheet_label || "Ver ficha técnica"}
                </a>
              )}
              {productUrl && (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 10,
                    fontFamily: fonts.sans,
                    fontSize: 13,
                    color: tokens.teal,
                    textDecoration: "none",
                    fontWeight: 500,
                    textAlign: "center",
                  }}
                >
                  🔗 Ver no site ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
