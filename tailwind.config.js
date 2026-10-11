/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#141b2e",
          900: "#1b2440",
          700: "#2c3a63",
        },
        accent: {
          600: "#3d6fb4",
          500: "#4a7dc4",
        },
        canvas: "#f4f5f7",
      },
      fontFamily: {
        display: ["Manrope", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
