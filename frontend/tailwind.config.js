/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0e0f12',
          900: '#121318',
          800: '#181920',
          700: '#23252c',
        }
      }
    },
  },
  plugins: [],
}
