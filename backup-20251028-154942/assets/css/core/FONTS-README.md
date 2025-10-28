# Typography System - Specifys.ai

## Overview
This document describes the comprehensive typography system for Specifys.ai, providing consistent and scalable font usage across the entire website.

## Font Families

### Primary Font - Montserrat
- **Usage**: Main brand font, headers, important text
- **Weights**: 300, 400, 500, 600, 700, 800
- **Best for**: Headlines, branding, emphasis

### Secondary Font - Inter
- **Usage**: Body text, UI elements, readable content
- **Weights**: 300, 400, 500, 600, 700
- **Best for**: Paragraphs, descriptions, general content

### UI Font - Roboto
- **Usage**: Buttons, forms, interface elements
- **Weights**: 300, 400, 500, 700
- **Best for**: Interactive elements, form labels, buttons

### Display Font - Poppins
- **Usage**: Large headings, hero text, display content
- **Weights**: 300, 400, 500, 600, 700
- **Best for**: Page titles, large headings, hero sections

### Monospace Font - SF Mono/Monaco
- **Usage**: Code, technical content, data
- **Best for**: Code blocks, technical documentation, data tables

## Font Scale

### Sizes
- `--font-size-xs`: 0.75rem (12px)
- `--font-size-sm`: 0.875rem (14px)
- `--font-size-base`: 1rem (16px)
- `--font-size-lg`: 1.125rem (18px)
- `--font-size-xl`: 1.25rem (20px)
- `--font-size-2xl`: 1.5rem (24px)
- `--font-size-3xl`: 1.875rem (30px)
- `--font-size-4xl`: 2.25rem (36px)
- `--font-size-5xl`: 3rem (48px)
- `--font-size-6xl`: 3.75rem (60px)
- `--font-size-7xl`: 4.5rem (72px)

### Weights
- `--font-weight-thin`: 100
- `--font-weight-extralight`: 200
- `--font-weight-light`: 300
- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700
- `--font-weight-extrabold`: 800
- `--font-weight-black`: 900

### Line Heights
- `--line-height-none`: 1
- `--line-height-tight`: 1.25
- `--line-height-snug`: 1.375
- `--line-height-normal`: 1.5
- `--line-height-relaxed`: 1.625
- `--line-height-loose`: 2

### Letter Spacing
- `--letter-spacing-tighter`: -0.05em
- `--letter-spacing-tight`: -0.025em
- `--letter-spacing-normal`: 0em
- `--letter-spacing-wide`: 0.025em
- `--letter-spacing-wider`: 0.05em
- `--letter-spacing-widest`: 0.1em

## Typography Classes

### Heading Classes
```css
.heading-1    /* Large display heading */
.heading-2    /* Main page heading */
.heading-3    /* Section heading */
.heading-4    /* Subsection heading */
.heading-5    /* Small heading */
.heading-6    /* Smallest heading */
```

### Body Text Classes
```css
.body-large   /* Large body text */
.body-base    /* Standard body text */
.body-small   /* Small body text */
.caption      /* Caption text */
```

### Specialized Classes
```css
.button-text  /* Button text styling */
.code-text    /* Code and technical text */
```

## Utility Classes

### Font Family
```css
.font-primary    /* Montserrat */
.font-secondary  /* Inter */
.font-ui         /* Roboto */
.font-display    /* Poppins */
.font-mono       /* Monospace */
```

### Font Size
```css
.text-xs, .text-sm, .text-base, .text-lg, .text-xl
.text-2xl, .text-3xl, .text-4xl, .text-5xl, .text-6xl, .text-7xl
```

### Font Weight
```css
.font-thin, .font-extralight, .font-light, .font-normal
.font-medium, .font-semibold, .font-bold, .font-extrabold, .font-black
```

### Line Height
```css
.leading-none, .leading-tight, .leading-snug, .leading-normal
.leading-relaxed, .leading-loose
```

### Letter Spacing
```css
.tracking-tighter, .tracking-tight, .tracking-normal
.tracking-wide, .tracking-wider, .tracking-widest
```

## Usage Examples

### Basic Typography
```html
<h1 class="heading-1">Main Page Title</h1>
<h2 class="heading-2">Section Title</h2>
<p class="body-base">Regular paragraph text</p>
<small class="caption">Caption text</small>
```

### Custom Combinations
```html
<div class="font-display text-4xl font-bold leading-tight">
    Custom Display Text
</div>

<p class="font-secondary text-lg leading-relaxed">
    Custom body text with specific styling
</p>

<code class="font-mono text-sm">
    console.log('Hello World');
</code>
```

### Button Text
```html
<button class="btn">
    <span class="button-text">Click Me</span>
</button>
```

## Responsive Typography

The typography system includes responsive adjustments:

- **Mobile (≤768px)**: Reduced font sizes for better readability
- **Small Mobile (≤480px)**: Further size reductions for small screens

## Best Practices

1. **Consistency**: Use the predefined classes instead of custom font styling
2. **Hierarchy**: Maintain clear visual hierarchy with appropriate heading classes
3. **Readability**: Choose appropriate line heights for different content types
4. **Accessibility**: Ensure sufficient contrast and readable font sizes
5. **Performance**: Fonts are loaded efficiently with `display=swap`

## Browser Support

- **Modern Browsers**: Full support for all font features
- **Fallbacks**: System fonts as fallbacks for older browsers
- **Loading**: Optimized font loading with `font-display: swap`

## File Structure

```
assets/css/core/
├── fonts.css          # Main typography system
├── variables.css      # CSS variables (references fonts.css)
└── FONTS-README.md   # This documentation
```

## Integration

The typography system is automatically loaded via `main.css`:

```css
@import url('./core/fonts.css');
```

All components and pages can use the typography classes without additional imports.
