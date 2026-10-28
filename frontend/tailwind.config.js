/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        elevated: token('elevated'),
        hover: token('hover'),
        line: token('line'),
        'line-strong': token('line-strong'),
        fg: token('fg'),
        muted: token('muted'),
        faint: token('faint'),
        accent: token('accent'),
        'accent-fg': token('accent-fg'),
        success: token('success'),
        danger: token('danger'),
        warning: token('warning'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        popover: '0 10px 30px -10px rgb(0 0 0 / 0.45), 0 2px 6px -2px rgb(0 0 0 / 0.2)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(-2px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-right': { from: { transform: 'translateX(16px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        // Motion system (entrance only; `backwards` fill leaves no lingering transform).
        'page-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'toast-out': { from: { opacity: '1', transform: 'none' }, to: { opacity: '0', transform: 'translateX(12px)' } },
        'status-pop': { from: { transform: 'scale(0.5)', opacity: '0.3' }, to: { transform: 'scale(1)', opacity: '1' } },
        shimmer: { from: { backgroundPosition: '150% 0' }, to: { backgroundPosition: '-50% 0' } },
        'menu-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-up': 'fade-up 500ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 140ms ease-out',
        'slide-in-right': 'slide-in-right 180ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'page-in': 'page-in 220ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        rise: 'rise 340ms cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'toast-out': 'toast-out 160ms ease-in forwards',
        'status-pop': 'status-pop 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        'menu-in': 'menu-in 160ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
