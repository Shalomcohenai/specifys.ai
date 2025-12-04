# Design System - Specifys.ai

## Overview

This document describes the Design System for Specifys.ai, which combines Tailwind CSS with our existing SCSS architecture.

## Architecture

### Hybrid Approach

We use a **hybrid approach** that combines:
- **Tailwind CSS** - Utility-first CSS framework for rapid development
- **SCSS** - Existing styles and component-specific styles
- **CSS Variables** - Design tokens defined in `assets/css/core/variables.css`

### File Structure

```
assets/css/
├── core/
│   ├── variables.css    # Design tokens (colors, spacing, typography)
│   ├── fonts.css        # Font definitions
│   ├── reset.css        # CSS reset
│   ├── typography.css   # Typography styles
│   └── base.css         # Base styles
├── components/          # Component-specific SCSS
├── pages/               # Page-specific SCSS
├── main.scss            # Main SCSS entry point
├── main-compiled.css    # Compiled SCSS output
└── tailwind-base.css    # Tailwind CSS base (processed via PostCSS)
```

## Design Tokens

### Colors

#### Primary Colors
- **Primary**: `#FF6B35` - Main brand color
- **Primary Hover**: `#FF8551` - Hover state
- **Primary Light**: `#FFF4F0` - Light variant

#### Secondary Colors
- **Secondary**: `#6c757d` - Secondary actions
- **Secondary Hover**: `#5a6268` - Hover state

#### Semantic Colors
- **Success**: `#28a745` - Success states
- **Warning**: `#ffc107` - Warning states
- **Danger**: `#dc3545` - Error/danger states
- **Info**: `#17a2b8` - Informational states

#### Background Colors
- **Background**: `#f5f5f5` - Page background
- **Background Primary**: `#ffffff` - Card/container background
- **Background Secondary**: `#f5f5f5` - Secondary background
- **Light Gray**: `#e9ecef` - Light gray background

#### Text Colors
- **Text**: `#333` - Primary text
- **Text Secondary**: `#666` - Secondary text
- **Text Muted**: `#999` - Muted text
- **Text White**: `#ffffff` - White text

### Spacing Scale

- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **md**: `1rem` (16px)
- **lg**: `1.5rem` (24px)
- **xl**: `2rem` (32px)
- **2xl**: `3rem` (48px)

### Typography

#### Font Families
- **Primary**: Montserrat (headings, display)
- **Secondary**: Inter (body text, UI)

#### Font Sizes
- **xs**: `0.75rem` (12px)
- **sm**: `0.875rem` (14px)
- **base**: `1rem` (16px)
- **lg**: `1.125rem` (18px)
- **xl**: `1.25rem` (20px)
- **2xl**: `1.5rem` (24px)
- **3xl**: `1.875rem` (30px)
- **4xl**: `2.25rem` (36px)

#### Font Weights
- **normal**: 400
- **medium**: 500
- **semibold**: 600
- **bold**: 700

### Border Radius

- **sm**: `0.25rem` (4px)
- **md**: `0.5rem` (8px)
- **lg**: `1rem` (16px)
- **xl**: `1.5rem` (24px)
- **full**: `50%`

### Shadows

- **sm**: `0 2px 4px rgba(0, 0, 0, 0.1)`
- **md**: `0 4px 8px rgba(0, 0, 0, 0.2)`
- **lg**: `0 6px 16px rgba(0, 0, 0, 0.15)`
- **xl**: `0 8px 32px rgba(0, 0, 0, 0.3)`

### Transitions

- **fast**: `0.15s ease`
- **normal**: `0.3s ease`
- **slow**: `0.5s ease`

### Z-Index Scale

- **header**: `99999`
- **dropdown**: `1000`
- **modal**: `10000`

## Usage

### Tailwind CSS

Use Tailwind utility classes for rapid development:

```html
<!-- Button with Tailwind -->
<button class="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-hover">
  Click me
</button>

<!-- Card with Tailwind -->
<div class="bg-bg-primary rounded-lg shadow-md p-6">
  Card content
</div>
```

### Custom Tailwind Components

We've defined custom components in `tailwind-base.css`:

```html
<!-- Use custom button component -->
<button class="btn-primary">Click me</button>
<button class="btn-secondary">Cancel</button>

<!-- Use custom card component -->
<div class="card">Card content</div>

<!-- Use custom input component -->
<input type="text" class="input" placeholder="Enter text">
```

### SCSS

Continue using SCSS for component-specific styles:

```scss
// In components/my-component.scss
.my-component {
  // Component-specific styles
  padding: var(--spacing-md);
  background: var(--bg-primary);
}
```

### CSS Variables

Use CSS variables for design tokens:

```css
.my-element {
  color: var(--primary-color);
  padding: var(--spacing-md);
  font-family: var(--font-family-primary);
}
```

## Migration Strategy

### Phase 1: Setup (Completed)
- ✅ Added Tailwind CSS dependencies
- ✅ Created `tailwind.config.js` with design tokens
- ✅ Updated PostCSS configuration
- ✅ Created `tailwind-base.css`

### Phase 2: Integration (In Progress)
- ✅ Updated `main.scss` with Tailwind comments
- ✅ Updated `vite.config.js` to include Tailwind
- ✅ Updated `head.html` to load Tailwind CSS

### Phase 3: Gradual Migration (Future)
- Convert components to use Tailwind utilities
- Keep SCSS for complex component-specific styles
- Maintain backward compatibility

## Best Practices

1. **Use Tailwind for utilities**: Spacing, colors, typography, layout
2. **Use SCSS for components**: Complex component-specific styles
3. **Use CSS Variables**: For design tokens that need to be dynamic
4. **Maintain consistency**: Always use design tokens, never hardcode values
5. **Progressive enhancement**: Start with Tailwind, add SCSS only when needed

## Configuration

### Tailwind Config

The Tailwind configuration is in `tailwind.config.js` and includes:
- Custom colors mapped from CSS variables
- Custom spacing scale
- Custom typography settings
- Custom border radius values
- Custom shadows
- Safelist for dynamic classes

### PostCSS Config

PostCSS processes Tailwind CSS through:
1. `postcss-import` - Import CSS files
2. `tailwindcss` - Process Tailwind directives
3. `autoprefixer` - Add vendor prefixes
4. `cssnano` - Minify CSS (production only)
5. `@fullhuman/postcss-purgecss` - Remove unused CSS (production only)

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Design Tokens Reference](./assets/css/core/variables.css)
- [Component Examples](./assets/css/components/)


