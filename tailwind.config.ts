import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#14100E',
        surface: '#1F1916',
        raised: '#2A2220',
        cream: '#EDE3D8',
        muted: '#9C8B7E',
        heat: '#F2A65A',
        good: '#7FB069',
        caution: '#F2C14E',
        alarm: '#E0574F',
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
