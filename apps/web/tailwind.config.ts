import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Noto Kufi Arabic", "Tahoma", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
