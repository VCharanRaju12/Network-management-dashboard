/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B0E14",
        surface: "#131822",
        "surface-hover": "#1A2130",
        border: "#232938",
        muted: "#8892A6",
        ink: "#E6E9EF",
        signal: "#22D3EE",
        online: "#34D399",
        offline: "#F87171",
        degraded: "#FBBF24",
        unknown: "#64748B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
