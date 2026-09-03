import { useMemo, useState, useEffect, type CSSProperties } from "react";
import type { SpecAnswer, SpecQuestion } from "@/integrations/directus/productSpecifications";
import { tokens, fonts } from "./design-tokens";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Exported validation helper (used by multi-item parent) ─────────────────

function getFollowUpQuestion(question: SpecQuestion, choice?: string): string | undefined {
  const selected = String(choice || "").trim();
  if (!selected || !question.followUpQuestion) return undefined;

  for (const [key, value] of Object.entries(question.followUpQuestion)) {
    const normalizedKey = key.trim();
    if (selected === normalizedKey || selected.includes(normalizedKey) || normalizedKey.includes(selected)) {
      return value;
    }
  }

  return undefined;
}

export function validateSpecificationAnswers(
  questions: SpecQuestion[],
  answers: SpecAnswer[],
  hasPhotoQuestion: boolean,
  photoFile?: File,
  initialPhotoUrl?: string | null
): string | null {
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    const answer = answers[i] || {};
    if (question.type === "text" && !String(answer.answer_text || "").trim()) return `Responda à pergunta ${i + 1}.`;
    if (question.type === "number" && !Number.isFinite(Number(answer.answer_number))) return `Indique um número válido na pergunta ${i + 1}.`;
    if (question.type === "choice" && !String(answer.answer_choice || "").trim()) return `Escolha uma opção na pergunta ${i + 1}.`;
    const followUp = getFollowUpQuestion(question, answer.answer_choice);
    if (followUp && !String(answer.follow_up_answer || "").trim()) return `Responda ao detalhe adicional da pergunta ${i + 1}.`;
  }
  if (hasPhotoQuestion && !photoFile && !initialPhotoUrl) return "Adicione uma fotografia.";
  return null;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface SpecificationFormProps {
  questions: SpecQuestion[];
  initialAnswers?: SpecAnswer[];
  initialPhotoUrl?: string | null;
  submitting?: boolean;
  /** If false, hides internal submit button (parent handles submission). */
  showSubmit?: boolean;
  /** Called on every answer/photo change when showSubmit=false. */
  onChange?: (answers: SpecAnswer[], photoFile?: File) => void;
  onSubmit?: (answers: SpecAnswer[], photoFile?: File) => Promise<void>;
  /** Unique namespace for radio groups (needed when multiple forms coexist). */
  formId?: string;
}

export function SpecificationForm({
  questions,
  initialAnswers,
  initialPhotoUrl,
  submitting,
  showSubmit = true,
  onChange,
  onSubmit,
  formId = "spec",
}: SpecificationFormProps) {
  const [answers, setAnswers] = useState<SpecAnswer[]>(() =>
    questions.map((q, idx) => initialAnswers?.[idx] || emptyAnswerFor(q))
  );
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPhotoQuestion = useMemo(() => questions.some((q) => q.type === "photo"), [questions]);

  const setAnswer = (idx: number, patch: SpecAnswer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // Notify parent on changes when in controlled mode
  useEffect(() => {
    if (onChange) onChange(answers, photoFile);
  }, [answers, photoFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoto = (file?: File) => {
    setPhotoError(null);
    setPhotoFile(undefined);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("A fotografia deve ser uma imagem (JPG, PNG ou WebP).");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError("A fotografia não pode exceder 5 MB.");
      return;
    }
    setPhotoFile(file);
  };

  const submit = async () => {
    const validationError = validateSpecificationAnswers(questions, answers, hasPhotoQuestion, photoFile, initialPhotoUrl);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (onSubmit) await onSubmit(answers, photoFile);
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {questions.map((q, idx) => (
        <div
          key={`${formId}-${q.question}-${idx}`}
          style={{
            background: tokens.card,
            border: `1px solid ${tokens.border}`,
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 4px 18px rgba(0,0,0,0.04)",
          }}
        >
          <label style={{ display: "block", fontFamily: fonts.sans, fontWeight: 700, color: tokens.text, marginBottom: 10 }}>
            {idx + 1}. {q.question}
          </label>

          {q.type === "text" && (
            <input
              value={answers[idx]?.answer_text || ""}
              onChange={(e) => setAnswer(idx, { answer_text: e.target.value })}
              placeholder="Escreva a sua resposta..."
              style={inputStyle}
            />
          )}

          {q.type === "number" && (
            <input
              type="number"
              value={answers[idx]?.answer_number ?? ""}
              onChange={(e) => setAnswer(idx, { answer_number: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="0"
              style={inputStyle}
            />
          )}

          {q.type === "choice" && (
            <div style={{ display: "grid", gap: 8 }}>
              {(q.choices || []).map((choice) => (
                <label
                  key={choice}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 12,
                    cursor: "pointer",
                    background: answers[idx]?.answer_choice === choice ? tokens.tealSoft : tokens.white,
                  }}
                >
                  <input
                    type="radio"
                    name={`${formId}-question-${idx}`}
                    checked={answers[idx]?.answer_choice === choice}
                    onChange={() => setAnswer(idx, { answer_choice: choice, follow_up_answer: "" })}
                  />
                  <span style={{ color: tokens.text }}>{choice}</span>
                </label>
              ))}
              {getFollowUpQuestion(q, answers[idx]?.answer_choice) && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "block", color: tokens.muted, fontSize: 13, marginBottom: 6 }}>
                    {getFollowUpQuestion(q, answers[idx]?.answer_choice)}
                  </label>
                  <input
                    value={answers[idx]?.follow_up_answer || ""}
                    onChange={(e) => setAnswer(idx, { follow_up_answer: e.target.value })}
                    placeholder="Escreva o detalhe..."
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}

          {q.type === "photo" && (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
                style={inputStyle}
              />
              <p style={{ margin: "8px 0 0", color: tokens.muted, fontSize: 13 }}>
                JPG, PNG ou WebP. Máximo 5 MB. (Opcional)
              </p>
              {photoFile && <p style={{ margin: "8px 0 0", color: tokens.success, fontSize: 13 }}>✓ {photoFile.name}</p>}
              {initialPhotoUrl && !photoFile && (
                <p style={{ margin: "8px 0 0", color: tokens.success, fontSize: 13 }}>✓ Fotografia já enviada.</p>
              )}
              {photoError && <p style={{ margin: "8px 0 0", color: "#dc2626", fontSize: 13 }}>{photoError}</p>}
            </div>
          )}
        </div>
      ))}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 12, borderRadius: 12 }}>
          {error}
        </div>
      )}

      {showSubmit && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          style={{
            border: "none",
            borderRadius: 999,
            padding: "14px 22px",
            background: tokens.teal,
            color: tokens.white,
            fontWeight: 800,
            fontFamily: fonts.sans,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
            boxShadow: "0 8px 24px rgba(26,107,124,0.25)",
          }}
        >
          {submitting ? "A enviar..." : "Enviar respostas"}
        </button>
      )}
    </div>
  );
}

function emptyAnswerFor(question: SpecQuestion): SpecAnswer {
  if (question.type === "number") return { answer_number: undefined };
  if (question.type === "choice") return { answer_choice: "" };
  return { answer_text: "" };
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${tokens.border}`,
  fontSize: 15,
  fontFamily: fonts.sans,
  color: tokens.text,
  background: tokens.white,
  boxSizing: "border-box",
};
