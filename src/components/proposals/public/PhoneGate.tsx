import { useState, useRef, useEffect } from "react";

interface PhoneGateProps {
  onVerify: (digits: string) => Promise<boolean>;
  companyLogo?: string;
  companyName?: string;
}

export function PhoneGate({ onVerify, companyLogo, companyName }: PhoneGateProps) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError(false);

    // Auto-advance
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (value && index === 3) {
      const code = newDigits.join("");
      if (code.length === 4) {
        handleSubmit(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      const newDigits = pasted.split("");
      setDigits(newDigits);
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (code: string) => {
    setLoading(true);
    try {
      const ok = await onVerify(code);
      if (!ok) {
        setError(true);
        setDigits(["", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="proposal-public min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--he-cream)" }}
    >
      <div className="w-full max-w-sm text-center space-y-8 he-fade-in">
        {/* Logo */}
        {companyLogo ? (
          <img
            src={companyLogo}
            alt={companyName || ""}
            crossOrigin="anonymous"
            className="h-12 mx-auto object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith("/logo-fallback.svg")) {
                target.src = "/logo-fallback.svg";
              }
            }}
          />
        ) : companyName ? (
          <p className="text-lg font-semibold" style={{ color: "var(--he-teal)" }}>{companyName}</p>
        ) : null}

        {/* Dots */}
        <div className="he-dots max-w-[120px] mx-auto" aria-hidden="true" />

        {/* Instruction */}
        <div className="space-y-2">
          <h1 className="he-title text-2xl">Aceda à sua proposta</h1>
          <p className="text-sm" style={{ color: "var(--he-text-muted)" }}>
            Confirme os últimos 4 dígitos do seu número de telefone
          </p>
        </div>

        {/* Inputs */}
        <div className="flex items-center justify-center gap-3" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              aria-label={`Dígito ${i + 1}`}
              className="w-14 h-16 text-center text-2xl font-mono font-bold rounded-xl border-2 outline-none transition-all"
              style={{
                borderColor: error ? "#dc2626" : digit ? "var(--he-teal)" : "var(--he-border)",
                backgroundColor: "var(--he-white)",
                color: "var(--he-text)",
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm" style={{ color: "#dc2626" }}>
            Código incorrecto. Tente novamente.
          </p>
        )}

        {/* Loading */}
        {loading && (
          <p className="text-sm" style={{ color: "var(--he-text-muted)" }}>
            A verificar...
          </p>
        )}
      </div>
    </div>
  );
}
