/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // map to CSS variables so dynamic palette switching works
        primary: 'var(--color-primary)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)'
      },
      fontFamily: {
        // Apple-like/system stack - SF Pro isn't distributable so we use system stack
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'apple-sm': '8px',
        'apple-md': '14px',
        'apple-lg': '20px'
      },
      boxShadow: {
        'apple-soft': '0 6px 22px rgba(15,23,42,0.08)',
        'apple-elev': '0 10px 40px rgba(15,23,42,0.10)'
      }
    },
  },
  plugins: [],
};
