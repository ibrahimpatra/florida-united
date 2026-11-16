/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef3f6', 100: '#d9e4ea', 200: '#b5c9d4', 300: '#86a5b5', 400: '#547f95',
          500: '#2f5d78', 600: '#234b63', 700: '#1b3b4f', 800: '#152f3f', 900: '#0f2330', 950: '#0a1822',
        },
        // Safety yellow: the colour of hazard tape and tool handles. Always pair with dark text.
        accent: {
          50: '#fffbe6', 100: '#fff3b8', 200: '#ffe97a', 300: '#ffdc3d', 400: '#fbcb0a',
          500: '#f5b800', 600: '#d99a00', 700: '#a87400', 800: '#7c5600', 900: '#5a3f00',
        },
        concrete: '#f1f3f4',
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      borderRadius: { md: '0.25rem', lg: '0.3125rem', xl: '0.375rem', '2xl': '0.5rem', '3xl': '0.75rem' },
      boxShadow: {
        'soft': '0 1px 3px rgba(15, 35, 48, 0.08)',
        'card': '0 1px 0 rgba(15, 35, 48, 0.05)',
        'hover': '0 3px 0 0 #f5b800',
        'inner-sm': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'shimmer-gradient': 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      },
      screens: {
        'xs': '480px',
      },
    },
  },
  plugins: [],
};
