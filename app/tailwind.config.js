/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F0EDE8',
        surface: '#FFFFFF',
        surface2: '#F7F5F2',
        lavender: '#A78BFA',
        'lavender-light': '#EDE9FE',
        green: '#6EE7B7',
        'green-light': '#D1FAE5',
        warning: '#FCD34D',
        error: '#FCA5A5',
        navy: '#1A1A2E',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
