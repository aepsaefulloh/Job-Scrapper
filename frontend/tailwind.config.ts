import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#FBFBF9',
          muted: '#F4F4F0',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8F8F6',
          border: '#EAEAE5',
        },
        sidebar: {
          DEFAULT: '#18181B',
          active: '#27272A',
          hover: '#222226',
          border: '#2E2E32',
          text: '#A1A1AA',
          'text-active': '#FFFFFF',
        },
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        card: '0 1px 4px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        compact: '0.375rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
