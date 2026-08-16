import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Still dark — this is used at 3am — but with real chroma in the
        // base rather than a flat brown-grey.
        ink: '#171019',
        surface: '#241925',
        raised: '#332334',
        cream: '#F8EDE4',
        muted: '#B49DA6',
        // Vivid accents. These only ever appear on chrome and controls, never
        // as a puppy's identity, so they don't compete with the collars.
        heat: '#FF9E44',
        berry: '#FF4D8D',
        iris: '#9B7BFF',
        mint: '#3DD9A0',
        good: '#3DD9A0',
        caution: '#FFCC33',
        alarm: '#FF5566',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      keyframes: {
        roll: {
          '0%': { transform: 'translateY(35%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseOnce: {
          '0%': { boxShadow: '0 0 0 0 rgba(224,87,79,0.55)' },
          '70%': { boxShadow: '0 0 0 12px rgba(224,87,79,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(224,87,79,0)' },
        },
      },
      animation: {
        roll: 'roll 220ms cubic-bezier(0.2,0.8,0.3,1)',
        'pulse-once': 'pulseOnce 900ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
