/** @type {import('tailwindcss').Config} */
// SWISS DATA POP — tasarım jetonları (bkz. src/index.css :root)
module.exports = {
  darkMode: 'class',
  content: [
  "./src/**/*.{js,jsx,ts,tsx}",
],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        sans: ['Inter', '"Inter Tight"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--c-canvas)',
        ink: 'var(--c-ink)',
        surface: 'var(--c-surface)',
        elevated: 'var(--c-elevated)',
        muted: 'var(--c-muted)',
        line: 'var(--c-border)',
        gridline: 'var(--c-gridline)',
        accent: {
          DEFAULT: 'var(--c-accent)',
          hover: 'var(--c-accent-hover)',
          soft: 'var(--c-accent-soft)',
          text: 'var(--c-accent-text)',
        },
        // Tailwind'in hazır `orange` rampası tek vurgu rengine (vermilyon)
        // bağlandı: modüllerdeki mevcut `*-orange-*` sınıfları tek noktadan
        // Swiss Data Pop vurgusuna döner. 700/800 tonları, açık zeminlerde
        // WCAG AA (4.5:1) sağlayan koyu vurgu metni içindir.
        orange: {
          50: '#FFF4F0',
          100: '#FFE3D9',
          200: '#FFC7B3',
          300: '#FF9B78',
          400: '#FD6336',
          500: '#F43B04',
          600: '#F43B04',
          700: '#A32A00',
          800: '#8A2300',
          900: '#6B1B00',
        },
      },
      borderRadius: {
        slab: '8px',
        pop: '12px',
        card: '18px',
        bento: '28px',
        hero: '40px',
      },
      letterSpacing: {
        display: '-0.035em',
        hero: '-0.055em',
      },
      transitionTimingFunction: {
        pop: 'cubic-bezier(.22,1,.36,1)',
      },
      transitionDuration: {
        120: '120ms',
        200: '200ms',
        320: '320ms',
      },
    },
  },
  plugins: [],
}
