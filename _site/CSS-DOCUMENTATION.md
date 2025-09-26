# CSS Variables & Design System Documentation

This document provides comprehensive documentation for the CSS variables and design system used in the Specifys.ai blog and website.

## Overview

The design system is built on CSS custom properties (variables) that provide consistency across all components. The system is modular and organized into logical groups for easy maintenance and updates.

## File Structure

```
assets/css/
├── core/
│   ├── variables.css      # Core design system variables
│   ├── fonts.css          # Typography system
│   ├── reset.css          # CSS reset
│   └── base.css           # Base styles
├── components/
│   ├── buttons.css        # Button components
│   ├── header.css         # Header styles
│   ├── footer.css         # Footer styles
│   ├── tables.css         # Table styles
│   └── mermaid.css        # Mermaid diagram styles
├── blog.css               # Blog-specific styles
├── main.css               # Main stylesheet
└── styles.css             # Additional styles
```

## Core Variables

### Typography Variables

#### Font Families
```css
--font-family-primary: 'Montserrat', sans-serif;     /* Main body text */
--font-family-secondary: 'Inter', sans-serif;        /* Secondary text */
--font-family-ui: 'Roboto', sans-serif;              /* UI elements */
--font-family-display: 'Poppins', sans-serif;        /* Headings */
--font-family-mono: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; /* Code */
```

#### Font Sizes
```css
--font-size-xs: 0.75rem;      /* 12px - Small labels */
--font-size-sm: 0.875rem;     /* 14px - Small text */
--font-size-base: 1rem;        /* 16px - Body text */
--font-size-lg: 1.125rem;     /* 18px - Large text */
--font-size-xl: 1.25rem;      /* 20px - Subheadings */
--font-size-2xl: 1.5rem;      /* 24px - Section headings */
--font-size-3xl: 1.875rem;    /* 30px - Page titles */
--font-size-4xl: 2.25rem;     /* 36px - Hero headings */
```

#### Font Weights
```css
--font-weight-light: 300;     /* Light text */
--font-weight-normal: 400;    /* Regular text */
--font-weight-medium: 500;   /* Medium emphasis */
--font-weight-semibold: 600;  /* Semi-bold headings */
--font-weight-bold: 700;      /* Bold headings */
```

#### Line Heights
```css
--line-height-tight: 1.25;    /* Tight spacing */
--line-height-normal: 1.5;    /* Normal spacing */
--line-height-relaxed: 1.625; /* Relaxed spacing */
--line-height-loose: 2;       /* Loose spacing */
```

### Color System

#### Primary Colors
```css
--primary-color: #0078d4;     /* Main brand color */
--primary-hover: #005ea2;     /* Hover state */
--primary-light: #e3f2fd;     /* Light background */
```

#### Semantic Colors
```css
--secondary-color: #6c757d;   /* Secondary elements */
--success-color: #28a745;      /* Success states */
--warning-color: #ffc107;      /* Warning states */
--danger-color: #dc3545;       /* Error states */
--info-color: #17a2b8;         /* Info states */
```

#### Text Colors
```css
--text-primary: #212529;      /* Main text */
--text-secondary: #6c757d;    /* Secondary text */
--text-muted: #868e96;        /* Muted text */
--text-white: #ffffff;        /* White text */
```

#### Background Colors
```css
--bg-primary: #ffffff;        /* Main background */
--bg-secondary: #f8f9fa;      /* Secondary background */
--bg-tertiary: #e9ecef;       /* Tertiary background */
--bg-color: #f5f5f5;          /* Page background */
```

#### Border Colors
```css
--border-color: #dee2e6;      /* Main borders */
--border-light: #e9ecef;      /* Light borders */
```

### Spacing System

```css
--spacing-xs: 0.25rem;        /* 4px - Micro spacing */
--spacing-sm: 0.5rem;         /* 8px - Small spacing */
--spacing-md: 1rem;           /* 16px - Medium spacing */
--spacing-lg: 1.5rem;         /* 24px - Large spacing */
--spacing-xl: 2rem;           /* 32px - Extra large spacing */
--spacing-2xl: 3rem;          /* 48px - Double extra large */
--spacing-3xl: 4rem;          /* 64px - Triple extra large */
```

### Border Radius

```css
--border-radius: 0.375rem;    /* 6px - Default radius */
--border-radius-sm: 0.25rem;  /* 4px - Small radius */
--border-radius-md: 0.5rem;   /* 8px - Medium radius */
--border-radius-lg: 0.75rem;  /* 12px - Large radius */
--border-radius-xl: 1rem;     /* 16px - Extra large radius */
--border-radius-full: 50%;    /* Full circle */
```

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);                    /* Subtle shadow */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); /* Medium shadow */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* Large shadow */
--shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.3);                     /* Extra large shadow */
```

### Transitions

```css
--transition-fast: 0.15s ease-in-out;    /* Fast transitions */
--transition-normal: 0.3s ease-in-out;   /* Normal transitions */
--transition-slow: 0.5s ease-in-out;     /* Slow transitions */
```

### Z-Index Scale

```css
--z-header: 99999;             /* Header layer */
--z-dropdown: 1000;           /* Dropdown menus */
--z-modal: 10000;             /* Modal dialogs */
```

### Layout Variables

```css
--header-height: 80px;        /* Header height */
--footer-height: 60px;        /* Footer height */
```

## Dark Theme Support

The system includes automatic dark theme support using `prefers-color-scheme`:

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

## Blog-Specific Variables

### Post Layout
```css
.post-content {
    max-width: 900px;
    margin: 80px auto 40px;
    padding: 30px;
    background: var(--bg-primary);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
}
```

### Post Typography
```css
.post-title {
    font-family: var(--font-family-display);
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
}
```

### Post Meta
```css
.post-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
}
```

## Usage Guidelines

### 1. Always Use Variables
Instead of hardcoded values, use CSS variables:
```css
/* ❌ Don't do this */
.button {
    background-color: #0078d4;
    padding: 16px;
    border-radius: 8px;
}

/* ✅ Do this */
.button {
    background-color: var(--primary-color);
    padding: var(--spacing-md);
    border-radius: var(--border-radius-md);
}
```

### 2. Follow the Spacing Scale
Use the predefined spacing variables for consistent spacing:
```css
.card {
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
}
```

### 3. Use Semantic Colors
Choose colors based on their semantic meaning:
```css
.success-message {
    color: var(--success-color);
    background: var(--bg-primary);
}

.error-message {
    color: var(--danger-color);
    background: var(--bg-primary);
}
```

### 4. Maintain Typography Hierarchy
Use the font size scale for consistent typography:
```css
.heading-1 { font-size: var(--font-size-3xl); }
.heading-2 { font-size: var(--font-size-2xl); }
.heading-3 { font-size: var(--font-size-xl); }
.body-text { font-size: var(--font-size-base); }
```

## Maintenance Procedures

### Adding New Variables

1. **Choose the Right Category**: Add variables to the appropriate section in `variables.css`
2. **Follow Naming Conventions**: Use descriptive names with consistent prefixes
3. **Document Changes**: Update this documentation when adding new variables
4. **Test Across Components**: Ensure new variables work with existing components

### Updating Existing Variables

1. **Check Dependencies**: Verify that changes don't break existing components
2. **Update Documentation**: Reflect changes in this documentation
3. **Test Dark Theme**: Ensure changes work in both light and dark themes
4. **Validate Accessibility**: Check color contrast and readability

### Component-Specific Variables

For component-specific variables, add them to the relevant component file:

```css
/* In components/buttons.css */
.button-primary {
    background-color: var(--primary-color);
    color: var(--text-white);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    transition: all var(--transition-fast);
}

.button-primary:hover {
    background-color: var(--primary-hover);
}
```

## Browser Support

The CSS variables system supports:
- ✅ Chrome 49+
- ✅ Firefox 31+
- ✅ Safari 9.1+
- ✅ Edge 15+

## Performance Considerations

1. **Variable Scope**: Use `:root` for global variables, component-specific scopes for local variables
2. **Fallback Values**: Always provide fallback values for critical styles
3. **Minification**: Variables are automatically optimized during build
4. **Caching**: Variables improve CSS caching efficiency

## Troubleshooting

### Common Issues

#### Variables Not Working
- Check variable name spelling
- Verify variable is defined in `:root`
- Ensure proper CSS syntax

#### Dark Theme Issues
- Check `prefers-color-scheme` support
- Verify dark theme variables are defined
- Test with browser dev tools

#### Performance Issues
- Avoid excessive variable nesting
- Use variables for repeated values only
- Consider CSS custom properties vs. preprocessor variables

## Future Enhancements

### Planned Features
- [ ] CSS Grid layout variables
- [ ] Animation timing variables
- [ ] Breakpoint variables
- [ ] Component-specific variable scopes
- [ ] Theme switching system

### Migration Path
When adding new features:
1. Define variables in `variables.css`
2. Update component styles to use variables
3. Test across all themes
4. Update documentation
5. Deploy with fallbacks

---

*This documentation is maintained alongside the design system. Please update it when making changes to CSS variables.*

