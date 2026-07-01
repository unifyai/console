// tailwind.config.js
const { nextui } = require('@nextui-org/react');
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('@unity/brand/tailwind-preset')],
  theme: {
    container: {
      center: true,
      screens: {
        sm: '100%',
        md: '100%',
        lg: '1024px',
        xl: '1280px',
      },
    },
    extend: {
      backgroundImage: {
        searchbar:
          'linear-gradient(90deg, var(--searchbar-gradient-start) -0.53%, var(--searchbar-gradient-end) 100%)',
        'searchbar-light':
          'linear-gradient(91deg, var(--searchbar-light-start) 60.81%, var(--searchbar-light-end) 127.54%)',
        'button-gradient':
          'linear-gradient(108deg, var(--button-gradient-start) 6.9%, var(--button-gradient-end) 104.93%)',
        'green-grad-75':
          'linear-gradient(129deg, rgba(var(--green-grad-75-rgb), 0.75) -3.33%, rgba(var(--green-grad-75-middle-rgb), 0.75) 50.35%, rgba(var(--green-grad-75-rgb), 0.75) 114.95%)',
      },
      keyframes: {
        fadeAccent: {
          '0%': { backgroundColor: 'var(--accent)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'fade-accent': 'fadeAccent 3s ease-out',
      },
      colors: {
        // Standard semantic, role, and chart colors are provided by
        // @unity/brand/tailwind-preset. Console-specific colors live below.
        'card-2': 'var(--card-2)',
        'accent-soft': {
          DEFAULT: 'var(--accent-soft)',
          foreground: 'var(--accent-soft-ink)',
        },
        primary: {
          tint: {
            5: 'var(--primary-tint-5)',
            10: 'var(--primary-tint-10)',
            15: 'var(--primary-tint-15)',
            20: 'var(--primary-tint-20)',
            25: 'var(--primary-tint-25)',
            30: 'var(--primary-tint-30)',
            40: 'var(--primary-tint-40)',
            50: 'var(--primary-tint-50)',
            60: 'var(--primary-tint-60)',
            70: 'var(--primary-tint-70)',
            90: 'var(--primary-tint-90)',
          },
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        // lg/md/sm are provided by @unity/brand/tailwind-preset.
        xl: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        pop: '0 18px 44px -18px var(--shadow-pop)',
        'pop-lg': '0 24px 60px -20px var(--shadow-pop)',
        'primary-press': '0 2px 0 var(--primary-shadow)',
      },
      fontFamily: {
        // sans/mono/serif are provided by @unity/brand/tailwind-preset.
        display: [
          'var(--font-display)',
          'var(--font-space-grotesk)',
          'var(--font-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
    },
    data: {
      selected: 'selected~="true"',
    },
  },
  darkMode: 'class',
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};
