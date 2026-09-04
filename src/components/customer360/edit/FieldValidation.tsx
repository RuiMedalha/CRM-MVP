/**
 * FieldValidation — validação em tempo real de campos.
 * Não bloqueia escrita; mostra apenas mensagem de erro.
 *
 * Cobertura:
 *   • NIF PT — 9 dígitos + check digit módulo 11 (algoritmo AT).
 *     Para NIFs de outros países (intracomunitário), aceita-se formato livre.
 *   • NIF Intracomunitário — prefixo país (2 letras) + 9-12 dígitos.
 *   • IBAN PT — 25 chars (PT50 + 21 dígitos) + check digits ISO 13616 mod-97.
 *   • Email — RFC básico + bloqueio de typos comuns.
 *   • Telefone PT — 9 dígitos, com ou sem prefixo +351.
 *   • Website / Código Postal — validação genérica.
 */

export interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

/* ─── NIF PT (módulo 11) ──────────────────────────────────────────────── */

/**
 * Valida NIF português pelo algoritmo oficial (módulo 11, 9 dígitos).
 * Referência: AT — "NIPC — Número de Identificação Pessoa Colectiva".
 */
export function isValidNIF(nif: string): boolean {
  const clean = (nif || "").replace(/\s/g, "").trim();
  if (!/^\d{9}$/.test(clean)) return false;
  const digits = clean.split("").map(Number);
  // First 8 digits × [9,8,7,6,5,4,3,2]
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += digits[i] * weights[i];
  const mod11 = sum % 11;
  const checkDigit = mod11 < 2 ? 0 : 11 - mod11;
  return checkDigit === digits[8];
}

/* ─── IBAN mod-97 ────────────────────────────────────────────────────── */

/**
 * Validação IBAN por algoritmo ISO 13616 (mod-97).
 * Move primeiros 4 chars para o fim, converte letras para números (A=10..Z=35)
 * e calcula mod 97 — tem de ser 1.
 *
 * Funciona para qualquer país, não só PT.
 */
export function isValidIBAN(iban: string): boolean {
  const clean = (iban || "").replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(clean)) return false;
  // Reordenar: primeiros 4 chars para o fim
  const reordered = clean.slice(4) + clean.slice(0, 4);
  // Converter letras para números
  let numeric = "";
  for (const ch of reordered) {
    if (ch >= "0" && ch <= "9") numeric += ch;
    else if (ch >= "A" && ch <= "Z") numeric += String(ch.charCodeAt(0) - 55);
    else return false;
  }
  // Mod 97
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder === 1;
}

/* ─── Email ──────────────────────────────────────────────────────────── */

const COMMON_TYPOS = ["gmai.com", "hotmial.com", "yaho.com", "outloo.com", ".con", ".cmo"];

export function isValidEmail(email: string): boolean {
  const v = (email || "").trim().toLowerCase();
  if (!v) return true; // vazio é OK (campo opcional)
  // RFC básico
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(v)) return false;
  // Bloquear typos comuns
  for (const typo of COMMON_TYPOS) {
    if (v.endsWith("@" + typo) || v.includes("@" + typo)) return false;
  }
  return true;
}

/* ─── Telefone PT ────────────────────────────────────────────────────── */

export function isValidPhonePT(phone: string): boolean {
  const clean = (phone || "").replace(/[\s\-()]/g, "");
  if (!clean) return true;
  // +351 + 9 dígitos OU 9 dígitos OU + internacional 7-15 dígitos
  if (/^\+351\d{9}$/.test(clean)) return true;
  if (/^\d{9}$/.test(clean)) return true;
  if (/^\+\d{7,15}$/.test(clean)) return true;
  return false;
}

/* ─── Tabela de validadores por campo ────────────────────────────────── */

export const VALIDATORS: Record<string, ValidationRule[]> = {
  nif: [
    {
      test: (v) => !v || isValidNIF(v),
      message: "NIF inválido (verifique 9 dígitos + check digit)",
    },
  ],
  vat_intracomunitario: [
    {
      test: (v) => !v || /^[A-Z]{2}[A-Z0-9]{7,12}$/.test(v.toUpperCase()),
      message: "NIF intracomunitário: 2 letras país + 7-12 chars (ex: PT123456789)",
    },
  ],
  iban: [
    {
      test: (v) => !v || isValidIBAN(v),
      message: "IBAN inválido (verifique check digits ISO 13616)",
    },
  ],
  email: [
    { test: (v) => !v || isValidEmail(v), message: "Email inválido ou domínio com typo conhecido" },
  ],
  // Emails departamentais
  email_compras: [
    { test: (v) => !v || isValidEmail(v), message: "Email inválido ou domínio com typo conhecido" },
  ],
  email_financeiro: [
    { test: (v) => !v || isValidEmail(v), message: "Email inválido ou domínio com typo conhecido" },
  ],
  email_comercial: [
    { test: (v) => !v || isValidEmail(v), message: "Email inválido ou domínio com typo conhecido" },
  ],
  email_assistencia: [
    { test: (v) => !v || isValidEmail(v), message: "Email inválido ou domínio com typo conhecido" },
  ],
  website: [
    { test: (v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(v), message: "Website inválido" },
  ],
  phone: [
    { test: (v) => !v || isValidPhonePT(v), message: "Telefone inválido (esperado 9 dígitos, com/sem +351)" },
  ],
  mobile_phone: [
    { test: (v) => !v || isValidPhonePT(v), message: "Telemóvel inválido (esperado 9 dígitos, com/sem +351)" },
  ],
  whatsapp_number: [
    { test: (v) => !v || isValidPhonePT(v), message: "WhatsApp inválido (esperado 9 dígitos)" },
  ],
  postal_code: [
    { test: (v) => !v || /^\d{4}-?\d{3}$/.test(v.replace(/\s/g, "")), message: "Formato: 0000-000" },
  ],
};

/** Devolve a primeira mensagem de erro para um campo, ou null se OK. */
export function validateField(fieldKey: string, value: string): string | null {
  const rules = VALIDATORS[fieldKey];
  if (!rules) return null;
  for (const rule of rules) {
    if (!rule.test(value)) return rule.message;
  }
  return null;
}

/** Devolve todas as mensagens de erro para um campo (útil para mostrar várias). */
export function validateFieldAll(fieldKey: string, value: string): string[] {
  const rules = VALIDATORS[fieldKey];
  if (!rules) return [];
  const errors: string[] = [];
  for (const rule of rules) {
    if (!rule.test(value)) errors.push(rule.message);
  }
  return errors;
}
