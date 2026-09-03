/**
 * FieldValidation — validação em tempo real de campos.
 * Não bloqueia escrita; mostra apenas mensagem de erro.
 */

export interface ValidationRule {
  test: (value: string) => boolean;
  message: string;
}

export const VALIDATORS: Record<string, ValidationRule[]> = {
  nif: [
    { test: (v) => !v || /^\d{9}$/.test(v.replace(/\s/g, "")), message: "NIF deve ter 9 dígitos" },
  ],
  email: [
    { test: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: "Email inválido" },
  ],
  website: [
    { test: (v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/.test(v), message: "Website inválido" },
  ],
  phone: [
    { test: (v) => !v || /^[+\d\s()-]{7,}$/.test(v), message: "Telefone inválido" },
  ],
  postal_code: [
    { test: (v) => !v || /^\d{4}-?\d{3}$/.test(v.replace(/\s/g, "")), message: "Formato: 0000-000" },
  ],
};

export function validateField(fieldKey: string, value: string): string | null {
  const rules = VALIDATORS[fieldKey];
  if (!rules) return null;
  for (const rule of rules) {
    if (!rule.test(value)) return rule.message;
  }
  return null;
}
