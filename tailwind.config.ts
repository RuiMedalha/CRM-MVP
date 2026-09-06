import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        /* Breakpoint custom para landscape phone (altura limitada).
           Activado em orientation:landscape + max-height:500px.
           Usado para esconder chrome ou comprimir layouts em iPhone/iPad
           landscape. */
        "landscape-short": { raw: "(orientation: landscape) and (max-height: 500px)" },
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        display: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
        channel: {
          wa1: "hsl(var(--ch-wa1))",
          wa2: "hsl(var(--ch-wa2))",
          tel: "hsl(var(--ch-tel))",
          ai: "hsl(var(--ch-ai))",
          ig: "hsl(var(--ch-ig))",
          fb: "hsl(var(--ch-fb))",
        },
        state: {
          atendimento: "hsl(var(--state-atendimento))",
          urgente: "hsl(var(--state-urgente))",
          ia: "hsl(var(--state-ia))",
          pendente: "hsl(var(--state-pendente))",
        },
        note: {
          DEFAULT: "hsl(var(--note-yellow))",
          border: "hsl(var(--note-yellow-bd))",
        },
        "ai-suggest": {
          DEFAULT: "hsl(var(--ai-suggest))",
          border: "hsl(var(--ai-suggest-bd))",
        },
        brand: {
          50: "rgb(var(--brand-50, 238 242 255) / <alpha-value>)",
          100: "rgb(var(--brand-100, 224 231 255) / <alpha-value>)",
          200: "rgb(var(--brand-200, 199 210 254) / <alpha-value>)",
          300: "rgb(var(--brand-300, 165 180 252) / <alpha-value>)",
          400: "rgb(var(--brand-400, 129 140 248) / <alpha-value>)",
          500: "rgb(var(--brand-500, 99 102 241) / <alpha-value>)",
          600: "rgb(var(--brand-600, 79 70 229) / <alpha-value>)",
          700: "rgb(var(--brand-700, 67 56 202) / <alpha-value>)",
          800: "rgb(var(--brand-800, 55 48 163) / <alpha-value>)",
          900: "rgb(var(--brand-900, 49 46 129) / <alpha-value>)",
          950: "rgb(var(--brand-950, 30 27 75) / <alpha-value>)",
        },
      },
      boxShadow: {
        "brand-sm": "var(--shadow-brand-sm, 0 1px 2px rgba(79, 70, 229, 0.10))",
        "brand-md": "var(--shadow-brand-md, 0 4px 10px rgba(79, 70, 229, 0.12))",
        "brand-lg": "var(--shadow-brand-lg, 0 12px 28px rgba(79, 70, 229, 0.16))",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "slide-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-right 0.3s ease-out",
        "slide-out-right": "slide-out-right 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-out": "fade-out 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
