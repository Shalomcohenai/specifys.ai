# CSS Duplicate Definitions Analysis

**Date:** 2025-01-23

## Summary

- Button definitions found: 147
- Form definitions found: 15
- Card definitions found: 16
- Modal definitions found: 96

## Button Definitions

Found 147 button-related CSS rules.

### Unique Button Selectors:

- `.btn` (25 definitions)
- `.btn i` (2 definitions)
- `.btn, .spec-card-actions .btn` (2 definitions)
- `.btn, button, a` (1 definitions)
- `.btn-back` (1 definitions)
- `.btn-back:hover` (1 definitions)
- `.btn-continue` (1 definitions)
- `.btn-continue:hover` (1 definitions)
- `.btn-danger` (2 definitions)
- `.btn-danger:active` (1 definitions)
- `.btn-danger:hover` (2 definitions)
- `.btn-ghost` (2 definitions)
- `.btn-ghost:active` (1 definitions)
- `.btn-ghost:hover` (2 definitions)
- `.btn-icon` (4 definitions)
- `.btn-icon i` (3 definitions)
- `.btn-icon i.fa-edit,
.btn-icon i.fa.fa-edit` (1 definitions)
- `.btn-icon.linked` (1 definitions)
- `.btn-icon.linked:hover` (1 definitions)
- `.btn-icon:active` (2 definitions)
- `.btn-icon:focus` (1 definitions)
- `.btn-icon:hover` (3 definitions)
- `.btn-label` (1 definitions)
- `.btn-lg` (3 definitions)
- `.btn-loading` (1 definitions)
- `.btn-loading::after` (1 definitions)
- `.btn-outline` (1 definitions)
- `.btn-outline-primary` (2 definitions)
- `.btn-outline-primary:hover` (2 definitions)
- `.btn-outline-secondary` (2 definitions)
- `.btn-outline-secondary:hover` (2 definitions)
- `.btn-outline:active` (1 definitions)
- `.btn-outline:hover` (1 definitions)
- `.btn-primary` (9 definitions)
- `.btn-primary:active` (1 definitions)
- `.btn-primary:focus` (1 definitions)
- `.btn-primary:hover` (9 definitions)
- `.btn-register` (1 definitions)
- `.btn-register:hover` (1 definitions)
- `.btn-secondary` (8 definitions)
- `.btn-secondary .fa,
.approval-actions .btn-secondary i` (1 definitions)
- `.btn-secondary:hover` (8 definitions)
- `.btn-sm` (4 definitions)
- `.btn-success` (3 definitions)
- `.btn-success .fa,
.approval-actions .btn-success i` (1 definitions)
- `.btn-success:hover` (3 definitions)
- `.btn-toggle-form` (1 definitions)
- `.btn-toggle-form i` (1 definitions)
- `.btn-toggle-form:hover` (1 definitions)
- `.btn-understand` (1 definitions)
- `.btn-understand:hover` (1 definitions)
- `.btn-warning` (2 definitions)
- `.btn-warning:hover` (2 definitions)
- `.btn-xl` (3 definitions)
- `.btn:disabled` (3 definitions)
- `.btn:focus` (1 definitions)
- `.btn:hover` (4 definitions)

## Analysis Notes

⚠️ **Note:** This is a preliminary analysis. Full comparison requires:
- Manual review of each definition
- Comparison of properties and values
- Understanding of context and usage

## Recommendations

1. Review button definitions for consolidation opportunities
2. Create base button class with modifier classes
3. Move button styles to `assets/css/components/buttons.css`
4. Remove duplicate definitions from `main-compiled.css`
