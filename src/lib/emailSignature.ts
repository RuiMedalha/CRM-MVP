/**
 * Default email signature for HotelEquip.
 * Used when company_settings.email_signature_html is empty or corrupted.
 */

export const DEFAULT_EMAIL_SIGNATURE = `
<p>Atentamente,</p>
<p><strong>Equipa HotelEquip</strong><br>
Equipamentos Hoteleiros Novos e Usados<br>
Assistência Técnica</p>
<p>Rua Empresarial Nº 8 A<br>
Zona Industrial Ponte Seca - Gaeiras<br>
2510-752 Gaeiras - Óbidos</p>
<p>Telemóvel: 916 542 271<br>
Email: geral@hotelequip.pt<br>
Web: www.hotelequip.pt<br>
NIF: 515 208 566</p>
`.trim();

/** Check if a signature string is valid (not corrupted with ?) */
export function isSignatureValid(sig: string | null | undefined): boolean {
  if (!sig || sig.length < 20) return false;
  // Corrupted signatures contain replacement characters
  if (sig.includes("�") || sig.includes("?") && sig.includes("ncia")) return false;
  return true;
}

/**
 * Get email signature — priority: employee personal > company global > default.
 * @param fromEmployee - Employee's personal signature (if set)
 * @param fromSettings - Company-wide signature from company_settings
 */
export function getEmailSignature(fromEmployee?: string | null, fromSettings?: string | null): string {
  if (isSignatureValid(fromEmployee)) return fromEmployee!;
  if (isSignatureValid(fromSettings)) return fromSettings!;
  return DEFAULT_EMAIL_SIGNATURE;
}
