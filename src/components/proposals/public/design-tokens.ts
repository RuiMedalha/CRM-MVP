/**
 * Design tokens for the public proposal page.
 * Extracted from Claude Design reference.
 */

export const tokens = {
  bg: "#f5f3ef",
  card: "#ffffff",
  text: "#0f1923",
  muted: "#56616e",
  faint: "#8a929c",
  teal: "#1a6b7c",
  tealDark: "#0d3d47",
  tealSoft: "rgba(26,107,124,0.08)",
  amber: "#d4920a",
  amberSoft: "rgba(212,146,10,0.12)",
  border: "#e7e3db",
  white: "#ffffff",
  success: "#16a34a",
  whatsapp: "#25d366",
} as const;

export const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

/** Dark theme overrides */
export const darkTokens = {
  bg: "#0a1628",
  card: "#111d2e",
  text: "#e8f0fe",
  muted: "#9ca8b8",
  faint: "#6b7a8d",
  border: "#1e2d42",
  tealSoft: "rgba(26,107,124,0.15)",
  amberSoft: "rgba(212,146,10,0.18)",
} as const;
