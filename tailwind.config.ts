import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      colors: {
        ink: {
          50: "#fafaf9",
          100: "#f4f4f2",
          400: "#737370",
          600: "#3a3a38",
          900: "#0e0e0d",
        },
      },
    },
  },
} satisfies Config;
