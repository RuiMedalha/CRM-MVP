import { useState } from "react";
import { tokens, fonts } from "./design-tokens";
import { eur } from "./utils";

interface PaymentSectionProps {
  depositAmount: number;
  depositPercent: number;
  company: {
    name?: string;
    iban?: string;
    multibanco_entity?: string;
    multibanco_reference?: string;
    mbway_phone?: string;
  };
}

type Tab = "iban" | "multibanco" | "mbway";

export function PaymentSection({ depositAmount, depositPercent, company }: PaymentSectionProps) {
  const hasIban = !!company.iban;
  const hasMb = !!company.multibanco_entity;
  const hasMbway = !!company.mbway_phone;

  const availableTabs: Tab[] = [];
  if (hasIban) availableTabs.push("iban");
  if (hasMb) availableTabs.push("multibanco");
  if (hasMbway) availableTabs.push("mbway");

  const [activeTab, setActiveTab] = useState<Tab>(availableTabs[0] || "iban");
  const [copied, setCopied] = useState<string | null>(null);

  if (availableTabs.length === 0) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const tabLabels: Record<Tab, { icon: string; label: string }> = {
    iban: { icon: "🏦", label: "Transferência" },
    multibanco: { icon: "🏧", label: "Multibanco" },
    mbway: { icon: "📱", label: "MBWay" },
  };

  return (
    <div
      style={{
        background: tokens.tealSoft,
        border: `1px solid ${tokens.teal}`,
        borderRadius: 14,
        padding: 24,
        marginTop: 24,
      }}
    >
      <h3
        style={{
          fontFamily: fonts.serif,
          fontSize: 18,
          fontWeight: 600,
          color: tokens.text,
          margin: "0 0 4px",
        }}
      >
        {depositPercent >= 100 ? "Dados para pagamento" : `Como pagar o sinal (${depositPercent}%: ${eur(depositAmount)})`}
      </h3>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 12,
          color: tokens.muted,
          margin: "0 0 16px",
        }}
      >
        Escolha o método de pagamento preferido
      </p>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
        }}
      >
        {availableTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 10,
              border: activeTab === tab ? `2px solid ${tokens.teal}` : `1px solid ${tokens.border}`,
              background: activeTab === tab ? tokens.card : "transparent",
              cursor: "pointer",
              fontFamily: fonts.sans,
              fontSize: 12,
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? tokens.teal : tokens.muted,
              transition: "all 0.2s",
            }}
          >
            <span style={{ display: "block", fontSize: 18, marginBottom: 2 }}>
              {tabLabels[tab].icon}
            </span>
            {tabLabels[tab].label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        style={{
          background: tokens.card,
          borderRadius: 12,
          padding: 18,
        }}
      >
        {activeTab === "iban" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow
              label="IBAN"
              value={company.iban || ""}
              onCopy={handleCopy}
              copied={copied}
            />
            <FieldRow
              label="Titular"
              value={company.name || ""}
              onCopy={handleCopy}
              copied={copied}
            />
            <FieldRow
              label="Valor"
              value={eur(depositAmount)}
              onCopy={handleCopy}
              copied={copied}
            />
          </div>
        )}

        {activeTab === "multibanco" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow
              label="Entidade"
              value={company.multibanco_entity || ""}
              onCopy={handleCopy}
              copied={copied}
            />
            <FieldRow
              label="Referência"
              value={company.multibanco_reference || ""}
              onCopy={handleCopy}
              copied={copied}
            />
            <FieldRow
              label="Valor"
              value={eur(depositAmount)}
              onCopy={handleCopy}
              copied={copied}
            />
          </div>
        )}

        {activeTab === "mbway" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <FieldRow
              label="Número"
              value={`+351 ${company.mbway_phone}`}
              onCopy={handleCopy}
              copied={copied}
            />
            <FieldRow
              label="Valor"
              value={eur(depositAmount)}
              onCopy={handleCopy}
              copied={copied}
            />
            <a
              href={`mbway://pay?phone=${company.mbway_phone}&amount=${depositAmount.toFixed(2)}`}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 0",
                background: tokens.teal,
                color: tokens.white,
                borderRadius: 10,
                fontFamily: fonts.sans,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Enviar pedido MBWay
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper component ──────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: (text: string, label: string) => void;
  copied: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div>
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: 11,
            color: tokens.faint,
            display: "block",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: 600,
            color: tokens.text,
          }}
        >
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onCopy(value, label)}
        style={{
          background: "transparent",
          border: `1px solid ${tokens.border}`,
          borderRadius: 6,
          padding: "4px 8px",
          cursor: "pointer",
          fontFamily: fonts.sans,
          fontSize: 11,
          color: copied === label ? tokens.success : tokens.muted,
          transition: "color 0.2s",
        }}
      >
        {copied === label ? "✓" : "Copiar"}
      </button>
    </div>
  );
}
