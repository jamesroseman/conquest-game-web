import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: "#1e3a5f",
        "ocean-deep": "#0f1f33",
        parchment: "#f5e9c8",
      },
      fontFamily: {
        display: ["'Cinzel'", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
