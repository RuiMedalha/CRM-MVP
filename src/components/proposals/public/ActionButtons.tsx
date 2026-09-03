import { useState } from "react";
import { tokens, fonts } from "./design-tokens";

interface ActionButtonsProps {
  quotation: { id: any; status?: string | null; customer_name?: string; deposit_type?: string; deposit_percent?: number; total_amount?: number };
  company?: { iban?: string; multibanco_entity?: string; multibanco_reference?: string; mbway_phone?: string; phone?: string };
  onApprove: (signature: string) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onDownloadPDF: () => Promise<void>;
}

export function ActionButtons({ quotation, company, onApprove, onReject, onDownloadPDF }: ActionButtonsProps) {
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [signature, setSignature] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const status = quotation.status;

  // Post-response: approved
  if (status === "approved" || showSuccess) {
    const depositAmount = quotation.deposit_type === "partial" && quotation.deposit_percent && quotation.total_amount
      ? (quotation.total_amount * quotation.deposit_percent) / 100
      : 0;
    const showPayment = quotation.deposit_type === "partial" && depositAmount > 0 && company;

    return (
      <div style={{ textAlign: "center", padding: "40px 24px", marginTop: 28 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 36,
            animation: "popIn 0.4s ease",
          }}
        >
          ✅
        </div>
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: 28,
            fontWeight: 700,
            color: tokens.teal,
            margin: "0 0 8px",
          }}
        >
          Proposta aprovada!
        </p>
        <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.muted, margin: "0 0 24px" }}>
          Obrigado{quotation.customer_name ? `, ${quotation.customer_name}` : ""}! Entraremos em contacto brevemente.
        </p>

        {showPayment && (
          <div
            style={{
              background: tokens.tealSoft,
              border: `1px solid ${tokens.teal}`,
              borderRadius: 14,
              padding: "20px 24px",
              textAlign: "left",
              marginBottom: 20,
            }}
          >
            <p style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: tokens.text, margin: "0 0 12px" }}>
              Para iniciar, pague o sinal de €{depositAmount.toFixed(2)}:
            </p>
            {company.iban && (
              <p style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.muted, margin: "0 0 6px" }}>
                IBAN: {company.iban}
              </p>
            )}
            {company.multibanco_entity && (
              <p style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.muted, margin: "0 0 6px" }}>
                MB: Entidade {company.multibanco_entity} | Ref {company.multibanco_reference}
              </p>
            )}
            {company.mbway_phone && (
              <p style={{ fontFamily: fonts.mono, fontSize: 13, color: tokens.muted, margin: 0 }}>
                MBWay: {company.mbway_phone}
              </p>
            )}
          </div>
        )}

        {company?.phone && (
          <a
            href={`https://wa.me/351${company.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: "#25d366",
              color: tokens.white,
              fontFamily: fonts.sans,
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 24px",
              borderRadius: 50,
              textDecoration: "none",
              marginTop: 8,
            }}
          >
            💬 Falar com a equipa
          </a>
        )}

        <style>{`@keyframes popIn { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }`}</style>
      </div>
    );
  }

  // Post-response: rejected
  if (status === "rejected") {
    return (
      <div style={{ textAlign: "center", padding: "40px 24px", marginTop: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>ℹ️</div>
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: 18,
            fontWeight: 600,
            color: tokens.muted,
            margin: "0 0 8px",
          }}
        >
          Proposta recusada.
        </p>
        <p style={{ fontFamily: fonts.sans, fontSize: 14, color: tokens.faint, margin: 0 }}>
          Se mudar de ideias ou quiser discutir alternativas, estamos disponíveis.
        </p>
      </div>
    );
  }

  const handleApproveConfirm = async () => {
    setApproveLoading(true);
    try {
      await onApprove(signature);
      setShowApproveModal(false);
      setShowSuccess(true);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectConfirm = async () => {
    setRejectLoading(true);
    try {
      await onReject(rejectReason || undefined);
    } finally {
      setRejectLoading(false);
      setShowRejectModal(false);
    }
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try { await onDownloadPDF(); } finally { setPdfLoading(false); }
  };

  const canConfirm = signature.trim().length > 0 && termsAccepted;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32 }}>
        {/* Approve */}
        <button
          type="button"
          onClick={() => setShowApproveModal(true)}
          style={{
            width: "100%",
            background: tokens.teal,
            color: tokens.white,
            borderRadius: 12,
            padding: 16,
            fontFamily: fonts.sans,
            fontWeight: 600,
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            boxShadow: `0 4px 16px rgba(26,107,124,0.3)`,
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.01)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          Aprovar Proposta
        </button>

        {/* Reject */}
        <button
          type="button"
          onClick={() => setShowRejectModal(true)}
          style={{
            width: "100%",
            background: "transparent",
            color: tokens.muted,
            borderRadius: 12,
            padding: 16,
            fontFamily: fonts.sans,
            fontWeight: 500,
            fontSize: 15,
            border: `1px solid ${tokens.border}`,
            cursor: "pointer",
          }}
        >
          Recusar Proposta
        </button>

        {/* PDF */}
        <button
          type="button"
          onClick={handlePDF}
          disabled={pdfLoading}
          style={{
            width: "100%",
            background: "transparent",
            color: tokens.teal,
            borderRadius: 12,
            padding: 16,
            fontFamily: fonts.sans,
            fontWeight: 500,
            fontSize: 15,
            border: `1px solid ${tokens.teal}`,
            cursor: "pointer",
          }}
        >
          {pdfLoading ? "⏳ A gerar PDF..." : "Descarregar PDF"}
        </button>
      </div>

      {/* Approve Modal */}
      {showApproveModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 9999,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowApproveModal(false)}
        >
          <div
            style={{
              background: tokens.card,
              borderRadius: "20px 20px 0 0",
              padding: "12px 24px 32px",
              maxWidth: 430,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grip handle */}
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: tokens.border,
                margin: "0 auto 20px",
              }}
            />

            <h3
              style={{
                fontFamily: fonts.serif,
                fontSize: 20,
                fontWeight: 700,
                color: tokens.text,
                margin: "0 0 20px",
              }}
            >
              Aprovar proposta
            </h3>

            {/* Signature */}
            <label
              style={{
                display: "block",
                fontFamily: fonts.sans,
                fontSize: 12,
                color: tokens.muted,
                marginBottom: 6,
              }}
            >
              Nome completo (assinatura digital) *
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="O seu nome completo"
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${tokens.border}`,
                fontFamily: fonts.sans,
                fontSize: 14,
                marginBottom: 16,
                boxSizing: "border-box",
              }}
            />

            {/* Terms checkbox */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontFamily: fonts.sans,
                fontSize: 13,
                color: tokens.muted,
                cursor: "pointer",
                marginBottom: 24,
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              Li e aceito os termos desta proposta comercial
            </label>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${tokens.border}`,
                  background: "transparent",
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  cursor: "pointer",
                  color: tokens.muted,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApproveConfirm}
                disabled={!canConfirm || approveLoading}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  border: "none",
                  background: canConfirm ? tokens.teal : tokens.border,
                  color: canConfirm ? tokens.white : tokens.faint,
                  fontFamily: fonts.sans,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: canConfirm ? "pointer" : "not-allowed",
                }}
              >
                {approveLoading ? "A confirmar..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowRejectModal(false)}
        >
          <div
            style={{
              background: tokens.card,
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontFamily: fonts.serif,
                fontSize: 18,
                fontWeight: 600,
                color: tokens.text,
                margin: "0 0 16px",
              }}
            >
              Recusar proposta
            </h3>
            <label
              style={{
                display: "block",
                fontFamily: fonts.sans,
                fontSize: 12,
                color: tokens.muted,
                marginBottom: 6,
              }}
            >
              Motivo (opcional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Indique o motivo, se desejar..."
              rows={3}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${tokens.border}`,
                fontFamily: fonts.sans,
                fontSize: 14,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${tokens.border}`,
                  background: "transparent",
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  cursor: "pointer",
                  color: tokens.muted,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                disabled={rejectLoading}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 10,
                  border: "none",
                  background: tokens.muted,
                  color: tokens.white,
                  fontFamily: fonts.sans,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {rejectLoading ? "A confirmar..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
