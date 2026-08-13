/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: "rgba(15, 23, 42, 0.75)",
          border: "rgba(255, 255, 255, 0.12)",
          card: "rgba(30, 41, 59, 0.6)",
          accent: "#6366f1"
        }
      },
      boxShadow: {
        '3d-glass': '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        '3d-button': '0 6px 0 #3730a3, 0 12px 20px rgba(0,0,0,0.3)',
        '3d-button-active': '0 2px 0 #3730a3, 0 4px 10px rgba(0,0,0,0.3)',
        '3d-red': '0 10px 25px rgba(225, 29, 72, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
      }
    },
  },
  plugins: [],
}