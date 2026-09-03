/**
 * Theme tokens — typed accessor over CSS custom properties in tokens.css.
 * Use when you need to read a value in JS (e.g. charts in recharts).
 *
 * For CSS classes, prefer the matching utility (e.g. `bg-brand-600`,
 * `text-success-500`, `shadow-brand-md`). Those are defined alongside the
 * tokens via tailwind.config.ts.
 */

export const brand = {
  50:  "rgb(238 242 255)",
  100: "rgb(224 231 255)",
  200: "rgb(199 210 254)",
  300: "rgb(165 180 252)",
  400: "rgb(129 140 248)",
  500: "rgb(99 102 241)",
  600: "rgb(79 70 229)",
  700: "rgb(67 56 202)",
  800: "rgb(55 48 163)",
  900: "rgb(49 46 129)",
  950: "rgb(30 27 75)",
} as const;

export const semantic = {
  success: { 500: "rgb(16 185 129)", 600: "rgb(5 150 105)" },
  warning: { 500: "rgb(245 158 11)", 600: "rgb(217 119 6)" },
  danger:  { 500: "rgb(244 63 94)",  600: "rgb(225 29 72)" },
  info:    { 500: "rgb(59 130 246)", 600: "rgb(37 99 235)" },
} as const;

export const surface = {
  0: "rgb(255 255 255)",
  1: "hsl(220 25% 98%)",
  2: "hsl(220 20% 95%)",
  3: "hsl(220 18% 92%)",
} as const;

export const surfaceDark = {
  0: "hsl(222 47% 8%)",
  1: "hsl(222 47% 6%)",
  2: "hsl(222 40% 12%)",
  3: "hsl(222 35% 16%)",
} as const;

export const typography = {
  family: {
    sans: "'Inter', 'Geist', system-ui, -apple-system, sans-serif",
    display: "'Inter', 'Geist', system-ui, sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
  },
  size: {
    display: 36,
    h1: 30,
    h2: 24,
    h3: 20,
    h4: 18,
    body: 15,
    small: 13,
    tiny: 11,
  },
  leading: { tight: 1.2, snug: 1.35, normal: 1.5, relaxed: 1.625 },
  tracking: { tight: "-0.02em", normal: "0", wide: "0.04em" },
} as const;

export const spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  pill: 9999,
} as const;

export const motion = {
  ease: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
} as const;

/**
 * Helper — pick the right palette when running in dark mode.
 * Pass `isDark = resolvedTheme === "dark"` from next-themes.
 */
export function pickSurface(isDark: boolean) {
  return isDark ? surfaceDark : surface;
}

/**
 * Helper — generate a soft tinted gradient for KPI cards / sparkline backgrounds.
 * Used by Sparkline.tsx and Dashboard KPI cards.
 */
export function brandTint(isDark: boolean) {
  return isDark
    ? {
        from: "rgba(99 102 241 / 0.30)",
        to:   "rgba(79 70 229 / 0.05)",
        stroke: brand[400],
      }
    : {
        from: "rgba(99 102 241 / 0.18)",
        to:   "rgba(79 70 229 / 0.02)",
        stroke: brand[600],
      };
}

export const theme = {
  brand,
  semantic,
  surface,
  surfaceDark,
  typography,
  spacing,
  radius,
  motion,
} as const;

export default theme;
