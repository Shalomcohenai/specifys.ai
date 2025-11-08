# Site Optimization Status

## Completed ✅

### Phase 1: Vite Build System Setup
- ✅ Installed Vite and dependencies in package.json
- ✅ Created vite.config.js with proper Jekyll compatibility
- ✅ Created postcss.config.js with cssnano, autoprefixer, and PurgeCSS
- ✅ Added build scripts to package.json

### Phase 2: Conditional Loading System
- ✅ Created assets/js/lib-loader.js for dynamic CDN library imports
- ✅ Updated _includes/head.html to remove global library loads
- ✅ Added conditional loading logic based on page.requires_libs

### Phase 3: Font Optimization
- ✅ Updated _includes/head.html to only load Montserrat and Inter (weights 400,500,600,700)
- ✅ Updated assets/css/core/fonts.css to remove Poppins and Roboto references
- ✅ Updated index.html fonts

### Phase 4: CSS Bundles
- ✅ Created assets/css/bundles/critical.css (above-the-fold styles)
- ✅ Created assets/css/bundles/main.css (remaining styles)

### Phase 5: JavaScript Bundles
- ✅ Created assets/js/bundles/core.js
- ✅ Created assets/js/bundles/auth.js
- ✅ Created assets/js/bundles/admin.js
- ✅ Created assets/js/bundles/home.js
- ✅ Created assets/js/bundles/utils.js
- ✅ Created assets/js/bundles/post.js
- ✅ Created assets/js/bundles/blog.js

## Remaining Work 🔄

### Update Standalone HTML Pages
The following standalone pages need to be updated to use the library loader and optimized fonts:
- [ ] pages/spec-viewer.html - needs mermaid, marked
- [ ] pages/admin-dashboard.html - needs mermaid, marked, jspdf
- [ ] pages/legacy-viewer.html - needs mermaid, marked
- [ ] pages/profile.html - needs marked
- [ ] pages/auth.html - remove unnecessary libraries
- [ ] pages/about.html - remove unnecessary libraries
- [ ] pages/ToolPicker.html - remove unnecessary libraries
- [ ] pages/how.html - remove unnecessary libraries

### Phase 6: Image Optimization
- [ ] Add lazy loading to images
- [ ] Implement responsive images with srcset
- [ ] Add preload hints for critical resources

### Phase 7: Caching Strategy
- [ ] Create _headers file for caching rules
- [ ] Document service worker location (future)

### Phase 8: Testing and Verification
- [ ] Run `npm install` to install new dependencies
- [ ] Run `npm run build:vite` to test build
- [ ] Test library loading on pages that need them
- [ ] Run Lighthouse performance tests
- [ ] Verify all functionality works correctly

### Phase 9: Documentation
- [ ] Update README.md with new build process
- [ ] Create migration notes documenting all changes

## Notes

### Library Loader Usage
To use the library loader on a page, add this script after loading lib-loader.js:

```html
<script src="/assets/js/lib-loader.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Load required libraries
    window.LibraryLoader.loadLibraries(['mermaid', 'marked']).then(function() {
      // Libraries are now available
      console.log('Libraries loaded');
    }).catch(function(error) {
      console.error('Failed to load libraries:', error);
    });
  });
</script>
```

### Font Changes
- Removed: Poppins, Roboto
- Kept: Montserrat (for headings/display), Inter (for body/UI)
- Weight reduction: Only 400, 500, 600, 700 (removed 300)

### Next Steps
1. Run `npm install` to install Vite and dependencies
2. Update standalone HTML pages to use library loader
3. Test the build process
4. Update JavaScript files that use libraries to check availability before use

