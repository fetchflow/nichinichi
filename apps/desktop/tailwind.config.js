/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Entry type colors (from devlog-mvp.jsx)
        score: "#22c55e",
        solution: "#3b82f6",
        decision: "#a855f7",
        ai: "#f59e0b",
        reflection: "#ec4899",
        log: "#6b7280",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
