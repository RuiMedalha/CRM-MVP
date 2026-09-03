export function normalizePhonePt(raw: string): string | null {
  let digits = raw.replace(/[\s+\-().]/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  if (!digits || !/^\d+$/.test(digits)) return null
  if (digits.length === 9 && digits.startsWith("9")) return `351${digits}`
  return digits
}

export function phoneSearchVariants(raw: string): string[] {
  const normalized = normalizePhonePt(raw)
  if (!normalized) return []
  const set = new Set<string>([normalized, raw.trim()])
  if (normalized.startsWith("351") && normalized.length > 3) {
    set.add(normalized.slice(3))
  }
  if (raw.trim().startsWith("+")) {
    set.add(raw.trim().replace(/\s/g, ""))
  }
  return [...set].filter(Boolean)
}
