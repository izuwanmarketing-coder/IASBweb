import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090909",
        charcoal: "#121212",
        graphite: "#5f6368",
        mist: "#f4f4f2",
        silver: "#d8d8d5",
        gold: "#e21b23"
      },
      boxShadow: {
        premium: "0 24px 80px rgba(16, 17, 20, 0.12)",
        soft: "0 12px 36px rgba(16, 17, 20, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
