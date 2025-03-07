import typography from '@tailwindcss/typography';

const config = {
  content: [
    './pages/**/*.{ts,tsx,mdx}',
    './icons/**/*.{ts,tsx,mdx}',
    './css/**/*.css',
    './theme.config.tsx',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        primary: '#e10098',
        'conf-black': '#0e031c',
        black: '#1b1b1b',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        scroll:
          'scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite',
      },
      keyframes: {
        scroll: {
          to: {
            transform: 'translate(calc(-50% - .5rem))',
          },
        },
      },
    },
  },
  plugins: [typography],
  darkMode: ['class', 'html[class~="dark"]'],
};

export default config;
