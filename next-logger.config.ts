import { nextui } from '@nextui-org/react';
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/*/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../apps/*/components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/**/*.{js,ts,jsx,tsx,mdx}',
    '../../node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
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
        searchbar: 'linear-gradient(90deg, #005C14 -0.53%, #0E1715 100%)',
        'searchbar-light': 'linear-gradient(91deg, #FFF 60.81%, #99E3A9 127.54%)',
        card: 'linear-gradient(121deg, #FFF 71.54%, #99E3A9 140.39%)',
        'card-border':
          'linear-gradient(90deg, rgba(122, 185, 138, 0.75) 2.01%, rgba(0, 174, 36, 0.75) 100.01%)',
        'button-gradient': 'linear-gradient(108deg, #66D47E 6.9%, #00A824 104.93%)',
        'green-grad-75':
          'linear-gradient(129deg, rgba(102, 212, 126, 0.75) -3.33%, rgba(0, 184, 40, 0.75) 50.35%, rgba(102, 212, 126, 0.75) 114.95%)',
      },
      colors: {
        accent: '#00a824',
        'branding-black': '#0A0C13',
        'branding-grey': '#606264',
        'lighter-grey': '#DADADA',
        'unify-green': '#00B828',
        'accent-1': '#3EB6DF',
        'accent-2': '#803EDF',
        'accent-3': '#DF3EBF',
        'accent-4': '#D03B40',
        'accent-5': '#DBCC44',
        'accent-6': '#DB7C4C',
        'accent-7': '#4454DB',
        'accent-8': '#843516',
      },
    },
    data: {
      selected: 'selected~="true"',
    },
  },
  darkMode: ['class', '[data-theme="dark"]'],
  plugins: [
    nextui({
      themes: {
        light: {
          colors: {
            primary: {
              DEFAULT: '#00A824',
              foreground: '#FFFFFF',
            },
          },
        },
        dark: {
          colors: {
            primary: {
              DEFAULT: '#00A824',
              foreground: '#FFFFFF',
            },
          },
        },
      },
    }),
  ],
};
export default config;
