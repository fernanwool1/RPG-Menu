import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /**
       * Type scale, sized in px at a 16px root.
       *
       * Raised across the board so body copy sits at 18px rather than the
       * ~12.5px the first pass used. Every step is named, so nothing in the
       * app hard-codes a font size any more and the whole scale moves from
       * this one block.
       */
      fontSize: {
        '2xs': ['0.9375rem', { lineHeight: '1.35rem' }],  // 15px
        xs: ['1.0625rem', { lineHeight: '1.5rem' }],      // 17px  metadata
        sm: ['1.125rem', { lineHeight: '1.6rem' }],       // 18px  secondary body
        base: ['1.1875rem', { lineHeight: '1.7rem' }],    // 19px  body
        lg: ['1.3125rem', { lineHeight: '1.8rem' }],      // 21px  quest names
        xl: ['1.5rem', { lineHeight: '1.95rem' }],        // 24px  panel headings
        '2xl': ['1.75rem', { lineHeight: '2.15rem' }],    // 28px
        '3xl': ['2.125rem', { lineHeight: '2.5rem' }],    // 34px  page titles
        '4xl': ['2.5rem', { lineHeight: '2.85rem' }],     // 40px  big figures
        '5xl': ['3rem', { lineHeight: '3.3rem' }],        // 48px
      },
      height: {
        13: '3.25rem',
      },
      colors: {
        ink: {
          950: '#03050A',
          900: '#05070B',
          850: '#070B12',
          800: '#0A0F18',
          750: '#0C1520',
          700: '#101C29',
        },
        gold: {
          DEFAULT: '#C8A45C',
          bright: '#E6CB92',
          dim: '#8A6E3A',
          faint: '#4A3B22',
        },
        teal: {
          DEFAULT: '#5FD4CE',
          bright: '#8FE9E4',
          dim: '#2E8C88',
          faint: '#17494A',
        },
        ivory: {
          DEFAULT: '#EFE6D6',
          dim: '#B6AB98',
          faint: '#7C7466',
        },
        danger: {
          DEFAULT: '#D97556',
          dim: '#7A3B2B',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 12px 48px -18px rgba(0, 0, 0, 0.95)',
        glow: '0 0 18px -2px rgba(95, 212, 206, 0.35)',
        'glow-strong': '0 0 28px -4px rgba(95, 212, 206, 0.55)',
        'glow-gold': '0 0 20px -6px rgba(200, 164, 92, 0.5)',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
      letterSpacing: {
        wider2: '0.14em',
        wider3: '0.22em',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'rise-in': 'rise-in 220ms ease-out both',
        'scale-in': 'scale-in 180ms ease-out both',
        'pulse-soft': 'pulse-soft 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
