import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}', '../../node_modules/@ship/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2f7fee',
          dark: '#0b1b2b',
        },
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          primary: '#2f7fee',
          'primary-content': '#ffffff',
          secondary: '#0b1b2b',
          'secondary-content': '#ffffff',
          neutral: '#0b1b2b',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#f3f4f6',
          'base-300': '#e5e7eb',
          'base-content': '#0b1b2b',
        },
      },
      'dark',
    ],
  },
};
