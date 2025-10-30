# Table Styles System - Specifys.ai

## Overview
This document describes the comprehensive table styling system for Specifys.ai, providing professional, responsive, and accessible table designs with multiple variants and features.

## Features

### ✅ Complete Table System
- **Responsive Design** - Horizontal scroll on mobile devices
- **Multiple Variants** - Striped, bordered, borderless options
- **Size Options** - Small, normal, and large table sizes
- **Status Indicators** - Color-coded status badges
- **Action Buttons** - Integrated action buttons in table cells
- **Pagination** - Built-in pagination controls
- **Sortable Headers** - Clickable column headers with sort indicators
- **Dark Theme Support** - Automatic theme adaptation
- **Loading States** - Visual feedback during data loading
- **Empty States** - User-friendly empty table messages
- **Print Support** - Optimized for printing

## File Structure

```
assets/css/components/
├── tables.css          # Main table styles
└── TABLES-README.md   # This documentation
```

## Usage

### Basic Table

```html
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>John Doe</td>
                <td>john@example.com</td>
                <td>Admin</td>
                <td><span class="table-status status-success">Active</span></td>
            </tr>
            <tr>
                <td>Jane Smith</td>
                <td>jane@example.com</td>
                <td>User</td>
                <td><span class="table-status status-warning">Pending</span></td>
            </tr>
        </tbody>
    </table>
</div>
```

### Table Variants

```html
<!-- Striped table -->
<table class="table table-striped">...</table>

<!-- Bordered table -->
<table class="table table-bordered">...</table>

<!-- Borderless table -->
<table class="table table-borderless">...</table>
```

### Table Sizes

```html
<!-- Small table -->
<table class="table table-sm">...</table>

<!-- Normal table (default) -->
<table class="table">...</table>

<!-- Large table -->
<table class="table table-lg">...</table>
```

### Status Indicators

```html
<span class="table-status status-success">Active</span>
<span class="table-status status-warning">Pending</span>
<span class="table-status status-danger">Inactive</span>
<span class="table-status status-info">Processing</span>
<span class="table-status status-secondary">Disabled</span>
```

### Badges

```html
<span class="table-badge badge-primary">Featured</span>
<span class="table-badge badge-success">In Stock</span>
<span class="table-badge badge-warning">Low Stock</span>
<span class="table-badge badge-danger">Out of Stock</span>
<span class="table-badge badge-info">New</span>
<span class="table-badge badge-secondary">Sale</span>
<span class="table-badge badge-light">Limited</span>
<span class="table-badge badge-dark">Premium</span>
```

### Action Buttons

```html
<td class="table-actions">
    <button class="table-action-btn btn-sm">Edit</button>
    <button class="table-action-btn btn-sm">Delete</button>
    <button class="table-action-btn btn-sm">View</button>
</td>
```

### Table with Images

```html
<td>
    <img src="avatar.jpg" alt="User" class="table-image">
</td>

<!-- Different image sizes -->
<img src="photo.jpg" alt="Photo" class="table-image-sm">  <!-- 30x30px -->
<img src="photo.jpg" alt="Photo" class="table-image">      <!-- 40x40px -->
<img src="photo.jpg" alt="Photo" class="table-image-lg">  <!-- 60x60px -->
```

### Sortable Headers

```html
<table class="table table-sortable">
    <thead>
        <tr>
            <th class="sort-asc">Name</th>  <!-- Ascending sort -->
            <th class="sort-desc">Date</th> <!-- Descending sort -->
            <th>Status</th>                 <!-- No sort -->
        </tr>
    </thead>
    <!-- ... -->
</table>
```

### Table with Pagination

```html
<table class="table">
    <!-- table content -->
    <tfoot>
        <tr>
            <td colspan="4">
                <div class="table-pagination">
                    <div class="table-pagination-info">
                        Showing 1-10 of 100 results
                    </div>
                    <div class="table-pagination-controls">
                        <button class="table-pagination-btn" disabled>Previous</button>
                        <button class="table-pagination-btn active">1</button>
                        <button class="table-pagination-btn">2</button>
                        <button class="table-pagination-btn">3</button>
                        <button class="table-pagination-btn">Next</button>
                    </div>
                </div>
            </td>
        </tr>
    </tfoot>
</table>
```

### Loading State

```html
<table class="table table-loading">
    <!-- table content -->
</table>
```

### Empty State

```html
<table class="table">
    <tbody>
        <tr>
            <td colspan="4" class="table-empty">
                <div class="table-empty-icon">📊</div>
                <div class="table-empty-title">No Data Available</div>
                <div class="table-empty-message">There are no records to display at this time.</div>
            </td>
        </tr>
    </tbody>
</table>
```

## CSS Classes

### Base Classes
```css
.table                    /* Base table styling */
.table-responsive         /* Responsive wrapper */
.table-loading            /* Loading state */
```

### Variant Classes
```css
.table-striped            /* Alternating row colors */
.table-bordered           /* All borders visible */
.table-borderless         /* No borders */
```

### Size Classes
```css
.table-sm                 /* Small padding and font */
.table-lg                 /* Large padding and font */
```

### Status Classes
```css
.table-status             /* Base status indicator */
.status-success           /* Green status */
.status-warning           /* Yellow status */
.status-danger            /* Red status */
.status-info              /* Blue status */
.status-secondary         /* Gray status */
```

### Badge Classes
```css
.table-badge              /* Base badge styling */
.badge-primary            /* Primary color badge */
.badge-secondary          /* Secondary color badge */
.badge-success            /* Success color badge */
.badge-warning            /* Warning color badge */
.badge-danger             /* Danger color badge */
.badge-info               /* Info color badge */
.badge-light              /* Light badge */
.badge-dark               /* Dark badge */
```

### Action Classes
```css
.table-actions            /* Action column styling */
.table-action-btn         /* Action button styling */
```

### Image Classes
```css
.table-image              /* Standard table image (40x40px) */
.table-image-sm           /* Small table image (30x30px) */
.table-image-lg           /* Large table image (60x60px) */
```

### Sortable Classes
```css
.table-sortable           /* Sortable table */
.sort-asc                 /* Ascending sort indicator */
.sort-desc                /* Descending sort indicator */
```

### Pagination Classes
```css
.table-pagination         /* Pagination container */
.table-pagination-info    /* Pagination info text */
.table-pagination-controls /* Pagination buttons */
.table-pagination-btn     /* Individual pagination button */
.table-pagination-btn.active /* Active page button */
```

### Empty State Classes
```css
.table-empty              /* Empty state container */
.table-empty-icon         /* Empty state icon */
.table-empty-title        /* Empty state title */
.table-empty-message      /* Empty state message */
```

## Responsive Design

### Desktop (≥768px)
- Full table display with all columns visible
- Hover effects on rows and buttons
- Complete pagination controls

### Tablet (≤768px)
- Reduced padding and font sizes
- Stacked pagination layout
- Maintained functionality

### Mobile (≤480px)
- Minimal padding for space efficiency
- Smaller images and buttons
- Horizontal scroll for wide tables

## Dark Theme Support

The table system automatically adapts to the site's theme:

```css
[data-theme="dark"] .table {
    background: var(--bg-primary);
    color: var(--text-primary);
}

[data-theme="dark"] .table thead {
    background: var(--bg-secondary);
}

[data-theme="dark"] .table tbody tr:hover {
    background: var(--bg-secondary);
}
```

## Accessibility Features

- **Semantic HTML** - Proper table structure with `<thead>`, `<tbody>`, `<tfoot>`
- **ARIA Labels** - Screen reader friendly
- **Keyboard Navigation** - Full keyboard support
- **High Contrast** - Sufficient color contrast ratios
- **Focus Indicators** - Clear focus states for interactive elements

## Best Practices

1. **Always Use Responsive Wrapper** - Wrap tables in `.table-responsive`
2. **Semantic Structure** - Use proper `<thead>`, `<tbody>`, `<tfoot>` elements
3. **Accessible Headers** - Provide meaningful column headers
4. **Consistent Spacing** - Use appropriate table sizes for content
5. **Status Indicators** - Use color-coded status for quick recognition
6. **Action Buttons** - Group related actions in the same column
7. **Pagination** - Implement pagination for large datasets
8. **Loading States** - Show loading indicators during data fetching
9. **Empty States** - Provide helpful messages when no data is available

## Performance Considerations

- **CSS Variables** - Efficient theme switching
- **Minimal DOM** - Clean HTML structure
- **Optimized Animations** - Smooth transitions without performance impact
- **Responsive Images** - Properly sized images for different screen sizes

## Browser Support

- **Modern Browsers** - Full support for all features
- **Mobile Browsers** - Optimized for touch interfaces
- **Print Support** - Clean printing without unnecessary elements
- **Fallbacks** - Graceful degradation for older browsers

## Integration Notes

- Tables automatically inherit the site's color scheme
- Theme changes are applied automatically
- All tables are responsive by default
- Print styles are included for documentation purposes
- The system works with any table content structure
