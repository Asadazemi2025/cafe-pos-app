import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: rgb("--bg"),
        surface: rgb("--surface"),
        "surface-alt": rgb("--surface-alt"),
        "surface-bar": rgb("--surface-bar"),
        "surface-hover": rgb("--surface-hover"),
        border: rgb("--border"),
        "border-row": rgb("--border-row"),
        "border-strong": rgb("--border-strong"),
        ink: rgb("--ink"),
        "ink-2": rgb("--ink-2"),
        "ink-3": rgb("--ink-3"),
        "ink-muted": rgb("--ink-muted"),
        "ink-placeholder": rgb("--ink-placeholder"),
        dark: rgb("--dark"),
        "dark-hover": rgb("--dark-hover"),
        "dark-3": rgb("--dark-3"),
        accent: rgb("--accent"),
        "accent-deep": rgb("--accent-deep"),
        "accent-weak": rgb("--accent-weak"),
        "accent-weak-2": rgb("--accent-weak-2"),
        "accent-soft": rgb("--accent-soft"),
        warning: rgb("--warning"),
        alert: rgb("--alert"),
        "alert-deep": rgb("--alert-deep"),
        "alert-weak": rgb("--alert-weak"),
        "alert-border": rgb("--alert-border"),
        danger: rgb("--danger"),
        "danger-weak": rgb("--danger-weak"),
      },
      fontFamily: {
        sans: [
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Hiragino Kaku Gothic Pro",
          "sans-serif",
        ],
      },
      borderRadius: {
        DEFAULT: "12px",
        sm: "8px",
        md: "11px",
        lg: "14px",
        xl: "16px",
        "2xl": "18px",
        "3xl": "22px",
        "4xl": "24px",
      },
      boxShadow: {
        app: "var(--shadow-app)",
        modal: "var(--shadow-modal)",
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};

export default config;
