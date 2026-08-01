import type { Config } from "tailwindcss";

/**
 * Every colour is driven by a runtime CSS variable holding SPACE-SEPARATED
 * RGB CHANNELS (e.g. `--c-indigo: 46 46 143`). Routing them through the
 * `<alpha-value>` placeholder is what keeps opacity modifiers working:
 *   bg-violet/10  ->  rgb(var(--c-violet) / 0.1)
 * The channel values themselves come from the `theme` row in site_settings
 * at runtime (see lib/theme/*). Never hardcode hex here.
 */
const channel = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1120px" },
    },
    extend: {
      colors: {
        /* ---- Brand palette (source of truth) ---- */
        ink: channel("--c-ink"),
        muted: {
          /* shadcn's subtle surface role; brand muted TEXT lives on
             `muted-foreground` so the two never collide. */
          DEFAULT: channel("--muted"),
          foreground: channel("--c-muted"),
        },
        faint: channel("--c-faint"),
        indigo: channel("--c-indigo"),
        "indigo-deep": channel("--c-indigo-deep"),
        violet: channel("--c-violet"),
        "violet-soft": channel("--c-violet-soft"),
        bg: channel("--c-bg"),
        card: {
          DEFAULT: channel("--c-card"),
          foreground: channel("--c-ink"),
        },
        border: channel("--c-border"),
        "border-strong": channel("--c-border-strong"),
        good: channel("--c-good"),
        "good-soft": channel("--c-good-soft"),
        warm: channel("--c-warm"),
        "warm-border": channel("--c-warm-border"),
        danger: channel("--c-danger"),
        "danger-soft": channel("--c-danger-soft"),
        "header-bg": channel("--c-header-bg"),
        "header-text": channel("--c-header-text"),

        /* ---- shadcn/ui semantic layer, mapped onto brand tokens ---- */
        background: channel("--background"),
        foreground: channel("--foreground"),
        primary: {
          DEFAULT: channel("--primary"),
          foreground: channel("--primary-foreground"),
        },
        secondary: {
          DEFAULT: channel("--secondary"),
          foreground: channel("--secondary-foreground"),
        },
        accent: {
          DEFAULT: channel("--accent"),
          foreground: channel("--accent-foreground"),
        },
        destructive: {
          DEFAULT: channel("--destructive"),
          foreground: channel("--destructive-foreground"),
        },
        popover: {
          DEFAULT: channel("--popover"),
          foreground: channel("--popover-foreground"),
        },
        input: channel("--input"),
        ring: channel("--ring"),
      },
      borderRadius: {
        xl: "var(--radius-card)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        sans: ["var(--font-body)"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--c-ink) / 0.05), 0 8px 24px -12px rgb(var(--c-indigo) / 0.18)",
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
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        rise: "rise 0.4s ease",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
