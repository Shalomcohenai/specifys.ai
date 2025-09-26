# CSS Variables Quick Reference

## Typography
```css
/* Font Families */
--font-family-primary: 'Montserrat', sans-serif;
--font-family-secondary: 'Inter', sans-serif;
--font-family-display: 'Poppins', sans-serif;
--font-family-mono: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;

/* Font Sizes */
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;    /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;   /* 30px */
--font-size-4xl: 2.25rem;    /* 36px */

/* Font Weights */
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

/* Line Heights */
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.625;
--line-height-loose: 2;
```

## Colors
```css
/* Primary Colors */
--primary-color: #0078d4;
--primary-hover: #005ea2;
--primary-light: #e3f2fd;

/* Semantic Colors */
--secondary-color: #6c757d;
--success-color: #28a745;
--warning-color: #ffc107;
--danger-color: #dc3545;
--info-color: #17a2b8;

/* Text Colors */
--text-primary: #212529;
--text-secondary: #6c757d;
--text-muted: #868e96;
--text-white: #ffffff;

/* Background Colors */
--bg-primary: #ffffff;
--bg-secondary: #f8f9fa;
--bg-tertiary: #e9ecef;
--bg-color: #f5f5f5;

/* Border Colors */
--border-color: #dee2e6;
--border-light: #e9ecef;
```

## Spacing
```css
--spacing-xs: 0.25rem;    /* 4px */
--spacing-sm: 0.5rem;     /* 8px */
--spacing-md: 1rem;       /* 16px */
--spacing-lg: 1.5rem;     /* 24px */
--spacing-xl: 2rem;       /* 32px */
--spacing-2xl: 3rem;      /* 48px */
--spacing-3xl: 4rem;      /* 64px */
```

## Border Radius
```css
--border-radius: 0.375rem;    /* 6px */
--border-radius-sm: 0.25rem;  /* 4px */
--border-radius-md: 0.5rem;   /* 8px */
--border-radius-lg: 0.75rem;  /* 12px */
--border-radius-xl: 1rem;     /* 16px */
--border-radius-full: 50%;    /* Full circle */
```

## Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.3);
```

## Transitions
```css
--transition-fast: 0.15s ease-in-out;
--transition-normal: 0.3s ease-in-out;
--transition-slow: 0.5s ease-in-out;
```

## Z-Index
```css
--z-header: 99999;
--z-dropdown: 1000;
--z-modal: 10000;
```

## Layout
```css
--header-height: 80px;
--footer-height: 60px;
```

## Usage Examples

### Button
```css
.button {
    background-color: var(--primary-color);
    color: var(--text-white);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    font-family: var(--font-family-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    transition: all var(--transition-fast);
}

.button:hover {
    background-color: var(--primary-hover);
}
```

### Card
```css
.card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-md);
    margin-bottom: var(--spacing-md);
}
```

### Typography
```css
.heading-1 {
    font-family: var(--font-family-display);
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    margin-bottom: var(--spacing-lg);
}

.body-text {
    font-family: var(--font-family-secondary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-normal);
    color: var(--text-primary);
    line-height: var(--line-height-relaxed);
    margin-bottom: var(--spacing-md);
}
```

## Dark Theme Variables
```css
@media (prefers-color-scheme: dark) {
    :root {
        --text-primary: #ffffff;
        --text-secondary: #a0a0a0;
        --text-muted: #808080;
        
        --bg-primary: #1a1a1a;
        --bg-secondary: #2d2d2d;
        --bg-tertiary: #404040;
        
        --border-color: #404040;
    }
}
```

## Best Practices

1. **Always use variables** instead of hardcoded values
2. **Follow the spacing scale** for consistent layouts
3. **Use semantic colors** based on meaning
4. **Maintain typography hierarchy** with the font scale
5. **Test dark theme** compatibility
6. **Document new variables** when adding them
7. **Provide fallbacks** for critical styles

---

*Keep this reference handy for quick lookups while coding.*
