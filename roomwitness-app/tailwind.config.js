/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#16243D',
        navy: '#101D33',
        cream: '#F3EEE4',
        'cream-edge': '#E2DBCC',
        card: '#FFFFFF',
        'card-border': '#E9E1D2',
        divider: '#F0EADC',
        muted: '#6B7283',
        'muted-2': '#5A6271',
        faint: '#9AA0AC',
        // Verdict tones — color = good-for-tenant, NOT severity. See lib/verdict.ts.
        recover: '#1C7A4B',
        'recover-soft': '#E7F1EA',
        'recover-border': '#C3E0CE',
        negotiate: '#A9750F',
        'negotiate-soft': '#F8F0DA',
        'negotiate-border': '#EAD9AC',
        valid: '#5A6271',
        'valid-soft': '#ECEAE3',
        'valid-border': '#DCD6C8',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      fontFamily: {
        display: ['IBMPlexSans_600SemiBold'],
        thai: ['IBMPlexSansThai_400Regular'],
        mono: ['IBMPlexMono_500Medium'],
        body: ['IBMPlexSans_400Regular'],
      },
    },
  },
  plugins: [],
};
