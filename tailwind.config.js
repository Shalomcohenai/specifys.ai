/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './pages/**/*.html',
    './_includes/**/*.html',
    './_layouts/**/*.html',
    './_posts/**/*.md',
    './assets/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B35',
          hover: '#FF8551',
          light: '#FFF4F0',
        },
        secondary: {
          DEFAULT: '#6c757d',
          hover: '#5a6268',
        },
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8',
        bg: {
          DEFAULT: '#f5f5f5',
          primary: '#ffffff',
          secondary: '#f5f5f5',
        },
        text: {
          DEFAULT: '#333',
          secondary: '#666',
          muted: '#999',
          white: '#ffffff',
        },
        border: {
          DEFAULT: '#dee2e6',
          light: '#e9ecef',
        },
      },
      spacing: {
        xs: '0.25rem',   // 4px
        sm: '0.5rem',    // 8px
        md: '1rem',      // 16px
        lg: '1.5rem',    // 24px
        xl: '2rem',      // 32px
        '2xl': '3rem',   // 48px
      },
      fontFamily: {
        primary: ['var(--font-primary)', 'sans-serif'],
        secondary: ['var(--font-secondary)', 'sans-serif'],
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
      },
      fontWeight: {
        normal: 'var(--font-weight-normal)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
      },
      lineHeight: {
        normal: 'var(--line-height-normal)',
        tight: 'var(--line-height-tight)',
      },
      borderRadius: {
        sm: '0.25rem',   // 4px
        md: '0.5rem',     // 8px
        lg: '1rem',       // 16px
        xl: '1.5rem',     // 24px
        full: '50%',
      },
      boxShadow: {
        sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
        md: '0 4px 8px rgba(0, 0, 0, 0.2)',
        lg: '0 6px 16px rgba(0, 0, 0, 0.15)',
        xl: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      transitionDuration: {
        fast: '0.15s',
        normal: '0.3s',
        slow: '0.5s',
      },
      zIndex: {
        header: '99999',
        dropdown: '1000',
        modal: '10000',
      },
      height: {
        header: '80px',
        footer: '60px',
      },
    },
  },
  plugins: [],
  // Preserve CSS variables and custom classes
  safelist: [
    /^fa-/,
    /^mermaid/,
    /^hljs/,
    /^theme-/,
    /data-theme/,
    /js-/,
    /is-/,
    /has-/,
    /active/,
    /loaded/,
    /error/,
    /success/,
    /warning/,
  ],
}


