import { fontFamily } from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e9fe',
          200: '#c8d7fd',
          300: '#a6bcfd',
          400: '#819cfc',
          500: '#627bf9',
          600: '#4c5ef7',
          700: '#3a4ae0',
          800: '#303ca6',
          900: '#1E3A8A', // Primary
          950: '#172554',
        },
        emergency: '#DC2626',
        success: '#10B981',
      },
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
        display: ['Inter', ...fontFamily.sans], // Bisa pakai font lain kalau mau
      },
      borderRadius: {
        'card': '16px',
        'sheet': '20px',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(0,0,0,0.08)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}