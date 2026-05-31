import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        ui: ["Inter", "Arial Narrow", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "Roboto Mono", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
