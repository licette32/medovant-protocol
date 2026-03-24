/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
      },
      boxShadow: {
        med: 'var(--shadow)',
      },
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        surface3: 'var(--surface3)',
        tpri: 'var(--text)',
        tsec: 'var(--text2)',
        tmuted: 'var(--text3)',
        accentg: 'var(--green)',
        accentc: 'var(--cyan)',
        accenta: 'var(--amber)',
        accentr: 'var(--red)',
        accentp: 'var(--purple)',
      },
      borderColor: {
        med: 'var(--border)',
        'med-accent': 'var(--border-accent)',
        'token-green': 'var(--green-b)',
        'token-cyan': 'var(--cyan-b)',
        'token-amber': 'var(--amber-b)',
        'token-red': 'var(--red-b)',
        'token-purple': 'var(--purple-b)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.2rem' }],
        sm: ['0.9375rem', { lineHeight: '1.35rem' }],
        base: ['1.0625rem', { lineHeight: '1.55rem' }],
      },
    },
  },
  plugins: [],
}
