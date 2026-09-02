import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FFFBF5",
          100: "#FFF7ED",
          200: "#FFEDD5",
          300: "#FED7AA",
        },
        warm: {
          orange: "#F97316",
          amber: "#F59E0B",
          rose: "#FB7185",
          wood: "#92400E",
          soft: "#FEF3C7",
        },
        postit: {
          yellow: "#FEF08A",
          pink: "#FBCFE8",
          blue: "#BAE6FD",
          green: "#BBF7D0",
          orange: "#FED7AA",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        handwritten: ["var(--font-caveat)", "cursive"],
      },
      boxShadow: {
        postit: "2px 3px 8px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.1)",
        fridge: "inset 0 0 40px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;