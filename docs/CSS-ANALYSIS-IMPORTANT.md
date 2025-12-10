# CSS !important Analysis

**Date:** 2025-01-23

## Summary

- Total !important declarations: 217

## Breakdown by Category

- **Animation/Transition**: 5 declarations
- **Header/Footer**: 22 declarations
- **Button**: 36 declarations
- **Link**: 7 declarations
- **Modal/Overlay**: 8 declarations
- **Form/Input**: 25 declarations
- **Image/Media**: 0 declarations
- **Other**: 114 declarations

## Detailed Analysis by Category

### Animation/Transition (5 declarations)

**Line 521**: `*::after`
- Property: `animation-duration`
- Value: `0.01ms`
- Full line: `animation-duration: 0.01ms !important;...`

**Line 522**: `*::after`
- Property: `animation-iteration-count`
- Value: `1`
- Full line: `animation-iteration-count: 1 !important;...`

**Line 523**: `*::after`
- Property: `transition-duration`
- Value: `0.01ms`
- Full line: `transition-duration: 0.01ms !important;...`

**Line 524**: `*::after`
- Property: `scroll-behavior`
- Value: `auto`
- Full line: `scroll-behavior: auto !important;...`

**Line 15809**: `.spec-card-square.active .spec-icon`
- Property: `animation`
- Value: `none`
- Full line: `animation: none !important;...`

---

### Header/Footer (22 declarations)

**Line 1528**: `.thematic-header`
- Property: `padding`
- Value: `10px 20px`
- Full line: `padding: 10px 20px !important;...`

**Line 1718**: `.thematic-header`
- Property: `padding`
- Value: `8px 12px`
- Full line: `padding: 8px 12px !important;...`

**Line 1772**: `.thematic-header`
- Property: `padding`
- Value: `8px 8px`
- Full line: `padding: 8px 8px !important;...`

**Line 1848**: `.footer-links button`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

**Line 1862**: `.footer-links button:hover`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

**Line 1898**: `.footer-social a`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

**Line 1910**: `.footer-social a:hover`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

**Line 6934**: `.chart-panel > div:not(header) canvas`
- Property: `width`
- Value: `100%`
- Full line: `width: 100% !important;...`

**Line 6935**: `.chart-panel > div:not(header) canvas`
- Property: `height`
- Value: `100%`
- Full line: `height: 100% !important;...`

**Line 6936**: `.chart-panel > div:not(header) canvas`
- Property: `max-height`
- Value: `100%`
- Full line: `max-height: 100% !important;...`

*... and 12 more*

---

### Button (36 declarations)

**Line 16322**: `.send-btn:disabled`
- Property: `background`
- Value: `#cccccc`
- Full line: `background: #cccccc !important;...`

**Line 16323**: `.send-btn:disabled`
- Property: `cursor`
- Value: `not-allowed`
- Full line: `cursor: not-allowed !important;...`

**Line 16328**: `.send-btn:disabled:hover`
- Property: `background`
- Value: `#cccccc`
- Full line: `background: #cccccc !important;...`

**Line 16329**: `.send-btn:disabled:hover`
- Property: `transform`
- Value: `none`
- Full line: `transform: none !important;...`

**Line 16333**: `.send-btn:disabled svg`
- Property: `transform`
- Value: `none`
- Full line: `transform: none !important;...`

**Line 19122**: `.admin-dashboard-btn`
- Property: `background`
- Value: `#17a2b8`
- Full line: `background: #17a2b8 !important;...`

**Line 19123**: `.admin-dashboard-btn`
- Property: `border`
- Value: `none`
- Full line: `border: none !important;...`

**Line 19124**: `.admin-dashboard-btn`
- Property: `color`
- Value: `white`
- Full line: `color: white !important;...`

**Line 19141**: `.admin-dashboard-btn:hover`
- Property: `background`
- Value: `#138496`
- Full line: `background: #138496 !important;...`

**Line 19151**: `.logout-btn-small`
- Property: `background`
- Value: `#dc3545`
- Full line: `background: #dc3545 !important;...`

*... and 26 more*

---

### Link (7 declarations)

**Line 1866**: `.contact-us-link`
- Property: `color`
- Value: `var(--text-color)`
- Full line: `color: var(--text-color) !important;...`

**Line 1867**: `.contact-us-link`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

**Line 1879**: `.contact-us-link:hover`
- Property: `color`
- Value: `var(--primary-color)`
- Full line: `color: var(--primary-color) !important;...`

**Line 1880**: `.contact-us-link:hover`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

**Line 16525**: `.tool-link`
- Property: `color`
- Value: `#fff`
- Full line: `color: #fff !important;...`

**Line 16536**: `.tool-link:hover`
- Property: `color`
- Value: `#fff`
- Full line: `color: #fff !important;...`

**Line 16537**: `.tool-link:hover`
- Property: `text-decoration`
- Value: `none`
- Full line: `text-decoration: none !important;...`

---

### Modal/Overlay (8 declarations)

**Line 3242**: `.live-brief-container`
- Property: `z-index`
- Value: `10`
- Full line: `z-index: 10 !important; /* Higher than hero-content z-index: 2 */...`

**Line 3246**: `.live-brief-container.fade-in`
- Property: `opacity`
- Value: `1`
- Full line: `opacity: 1 !important;...`

**Line 3247**: `.live-brief-container.fade-in`
- Property: `visibility`
- Value: `visible`
- Full line: `visibility: visible !important;...`

**Line 3251**: `.live-brief-container[style*="display: block"]`
- Property: `display`
- Value: `block`
- Full line: `display: block !important;...`

**Line 3252**: `.live-brief-container[style*="display: block"]`
- Property: `visibility`
- Value: `visible`
- Full line: `visibility: visible !important;...`

**Line 3253**: `.live-brief-container[style*="display: block"]`
- Property: `opacity`
- Value: `1`
- Full line: `opacity: 1 !important;...`

**Line 3258**: `.hero-content.fade-out .live-brief-container`
- Property: `opacity`
- Value: `1`
- Full line: `opacity: 1 !important;...`

**Line 3259**: `.hero-content.fade-out .live-brief-container`
- Property: `visibility`
- Value: `visible`
- Full line: `visibility: visible !important;...`

---

### Form/Input (25 declarations)

**Line 5067**: `.search-input`
- Property: `opacity`
- Value: `1`
- Full line: `opacity: 1 !important;...`

**Line 5068**: `.search-input`
- Property: `pointer-events`
- Value: `auto`
- Full line: `pointer-events: auto !important;...`

**Line 7781**: `input, textarea, select`
- Property: `font-size`
- Value: `16px`
- Full line: `font-size: 16px !important;...`

**Line 15909**: `.modern-input-container`
- Property: `position`
- Value: `relative`
- Full line: `position: relative !important;...`

**Line 15910**: `.modern-input-container`
- Property: `top`
- Value: `auto`
- Full line: `top: auto !important;...`

**Line 15911**: `.modern-input-container`
- Property: `left`
- Value: `auto`
- Full line: `left: auto !important;...`

**Line 15912**: `.modern-input-container`
- Property: `transform`
- Value: `none`
- Full line: `transform: none !important;...`

**Line 15913**: `.modern-input-container`
- Property: `margin`
- Value: `0 auto`
- Full line: `margin: 0 auto !important;...`

**Line 17809**: `.modern-input-container`
- Property: `position`
- Value: `relative`
- Full line: `position: relative !important;...`

**Line 17810**: `.modern-input-container`
- Property: `top`
- Value: `auto`
- Full line: `top: auto !important;...`

*... and 15 more*

---

### Other (114 declarations)

**Line 1572**: `.logo-text`
- Property: `font-size`
- Value: `1.2rem`
- Full line: `font-size: 1.2rem !important;...`

**Line 1668**: `.logo-text`
- Property: `font-size`
- Value: `1.2rem`
- Full line: `font-size: 1.2rem !important;...`

**Line 1722**: `.logo a`
- Property: `font-size`
- Value: `1.1rem`
- Full line: `font-size: 1.1rem !important;...`

**Line 1725**: `.logo-text`
- Property: `font-size`
- Value: `1.1rem`
- Full line: `font-size: 1.1rem !important;...`

**Line 1776**: `.logo a`
- Property: `font-size`
- Value: `1rem`
- Full line: `font-size: 1rem !important;...`

**Line 1779**: `.logo-text`
- Property: `font-size`
- Value: `1rem`
- Full line: `font-size: 1rem !important;...`

**Line 2219**: `.scroll-to-top`
- Property: `display`
- Value: `flex`
- Full line: `display: flex !important;...`

**Line 2584**: `.mermaid-error-message`
- Property: `display`
- Value: `none`
- Full line: `display: none !important;...`

**Line 3219**: `.table thead`
- Property: `background`
- Value: `#f5f5f5`
- Full line: `background: #f5f5f5 !important;...`

**Line 3222**: `.table tbody tr:hover`
- Property: `background`
- Value: `transparent`
- Full line: `background: transparent !important;...`

*... and 104 more*

---

## Recommendations

1. **Animation/Transition**: Review reduced-motion requirements
2. **Button/Link**: Improve specificity with better selectors
3. **Modal/Overlay**: Review z-index and visibility logic
4. **Form/Input**: Check for conflicting styles
5. **Image/Media**: Review responsive design approach

## Next Steps

1. Start with easy categories (Animation, Button, Link)
2. Test each change visually
3. Document any !important that must remain
