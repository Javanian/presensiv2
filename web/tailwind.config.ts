import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#6FB0CC',   // section backgrounds, icon fills, focus rings — NEVER text
          DEFAULT: '#1C7FAF', // nav, sidebar active, headings, links — safe on white (4.6:1)
          dark: '#15607F',    // hover on brand.DEFAULT
        },
        accent: '#F79A1B',    // CTA buttons only; use dark text (#1A1A1A) on this bg
        surface: '#F5F9FC',   // card/sidebar background
        divider: '#E9E9E9',   // borders, separators
        text: {
          primary: '#1A2B3C',
          secondary: '#5A7184',
          disabled: '#A0AEC0',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}

export default config
