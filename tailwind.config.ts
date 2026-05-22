import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  corePlugins: {
    preflight: true,
  },
  theme: {
    // Hard-zero every radius so any stray rounded-* utility renders square.
    borderRadius: {
      DEFAULT: "0",
      none: "0",
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      full: "0",
    },
    extend: {
      colors: {
        cream: "#F5F0E6",
        paper: "#EDE6D6",
        ink: {
          DEFAULT: "#1A1A1A",
          soft: "#4A4540",
          muted: "#8B8479",
        },
        rust: {
          DEFAULT: "#B85C2A",
          deep: "#8B4513",
        },
        divider: "#C7BFAE",
        wine: "#8B2E2E",
        forest: "#2C5530",
      },
      fontFamily: {
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        meta: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.06em" }],
        small: ["0.875rem", { lineHeight: "1.55" }],
        body: ["1rem", { lineHeight: "1.65" }],
        lead: ["1.125rem", { lineHeight: "1.7" }],
        h3: ["1.5rem", { lineHeight: "1.25" }],
        h2: ["2rem", { lineHeight: "1.2" }],
        h1: ["3rem", { lineHeight: "1.15" }],
        display: ["4rem", { lineHeight: "1.0" }],
      },
      letterSpacing: {
        tracked: "0.08em",
        crisp: "-0.01em",
      },
      maxWidth: {
        shell: "980px",
        prose: "760px",
        wide: "1160px",
      },
      spacing: {
        section: "4rem",
      },
    },
  },
  plugins: [],
};

export default config;
