/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#ecfdf7", 100: "#d1faec", 200: "#a7f3da", 300: "#6ee7c2", 400: "#34d3a6",
          500: "#10b98f", 600: "#059674", 700: "#047860", 800: "#065f4d", 900: "#064e40",
        },
        ink: { DEFAULT: "#0f172a", soft: "#334155", muted: "#64748b" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 12px 32px -16px rgba(15,23,42,.14)",
        lift: "0 2px 4px rgba(15,23,42,.06), 0 24px 48px -20px rgba(15,23,42,.28)",
        glow: "0 0 0 6px rgba(16,185,143,.15), 0 16px 40px -12px rgba(5,150,116,.55)",
      },
      keyframes: {
        "fade-up": { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "none" } },
        "pop-in": { "0%": { opacity: 0, transform: "scale(.85)" }, "70%": { transform: "scale(1.04)" }, "100%": { opacity: 1, transform: "none" } },
        "slide-in": { from: { opacity: 0, transform: "translateY(16px) scale(.98)" }, to: { opacity: 1, transform: "none" } },
        "streak-land": {
          "0%": { opacity: 0, transform: "translate(var(--from-x, 0), var(--from-y, 40px)) scale(2.4) rotate(-12deg)" },
          "55%": { opacity: 1, transform: "translate(0, -6px) scale(1.15) rotate(4deg)" },
          "75%": { transform: "translate(0, 2px) scale(.96) rotate(-1deg)" },
          "100%": { opacity: 1, transform: "none" },
        },
        burst: {
          "0%": { opacity: 0, transform: "translate(-50%, -50%) scale(.3)" },
          "15%": { opacity: 1 },
          "100%": { opacity: 0, transform: "translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(var(--s, 1)) rotate(var(--r, 0deg))" },
        },
        flicker: {
          "0%,100%": { transform: "scale(1) rotate(-2deg)" },
          "50%": { transform: "scale(1.08) rotate(2deg)" },
        },
        wave: { "0%,60%,100%": { transform: "rotate(0)" }, "10%,30%": { transform: "rotate(14deg)" }, "20%": { transform: "rotate(-8deg)" }, "40%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(10deg)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        "ping-soft": { "0%": { transform: "scale(1)", opacity: .55 }, "100%": { transform: "scale(1.7)", opacity: 0 } },
        blob: {
          "0%,100%": { transform: "translate(0,0) scale(1)" },
          "33%": { transform: "translate(30px,-40px) scale(1.08)" },
          "66%": { transform: "translate(-20px,20px) scale(.95)" },
        },
      },
      animation: {
        "fade-up": "fade-up .45s cubic-bezier(.2,.8,.2,1) both",
        "pop-in": "pop-in .35s cubic-bezier(.2,.8,.2,1) both",
        "slide-in": "slide-in .3s cubic-bezier(.2,.8,.2,1) both",
        "streak-land": "streak-land 1.1s cubic-bezier(.2,.8,.2,1) both",
        burst: "burst 1.1s cubic-bezier(.1,.7,.3,1) forwards",
        flicker: "flicker 1.6s ease-in-out infinite",
        wave: "wave 2s ease-in-out 2",
        shimmer: "shimmer 1.6s linear infinite",
        "ping-soft": "ping-soft 1.8s cubic-bezier(0,0,.2,1) infinite",
        blob: "blob 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
