import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d2433",
        paper: "#f8f7f2",
        mint: "#4d9f86",
        coral: "#dc6b57",
        gold: "#c6952d",
        river: "#3e6f88"
      }
    }
  },
  plugins: []
};

export default config;
