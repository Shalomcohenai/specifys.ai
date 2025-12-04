/**
 * Design System Tokens
 * Centralized design tokens for Specifys.ai
 */

export const colors = {
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
};

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
};

export const typography = {
  fontFamily: {
    primary: 'var(--font-primary)',
    secondary: 'var(--font-secondary)',
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
};

export const borderRadius = {
  sm: '0.25rem',   // 4px
  md: '0.5rem',     // 8px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  full: '50%',
};

export const shadows = {
  sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 8px rgba(0, 0, 0, 0.2)',
  lg: '0 6px 16px rgba(0, 0, 0, 0.15)',
  xl: '0 8px 32px rgba(0, 0, 0, 0.3)',
};

export default {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
};


