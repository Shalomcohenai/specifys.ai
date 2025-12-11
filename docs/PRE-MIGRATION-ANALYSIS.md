# ניתוח לפני המרה - Header ו-Footer

**תאריך:** 2025-01-27

## הבדלים שנמצאו

### Header - הבדלים:

1. **credits-display:**
   - `_includes/header.html`: `style="display: none;"`
   - `pages/pricing.html`: `class="hidden"`
   - `pages/spec-viewer.html`: `class="hidden"`
   - `pages/profile.html`: אין credits-display
   - `pages/about.html`: אין credits-display
   - `pages/demo-spec.html`: `style="display: none;"`

2. **Scripts:**
   - `_includes/header.html`: כולל `credits-display.js`
   - standalone pages: חלק כוללים, חלק לא

### Footer - הבדלים:

1. **קישורים:**
   - `_includes/footer.html`: "Vibe Coding Tools Map"
   - `pages/pricing.html`: "Tools Map" (קצר יותר)
   - שאר הדפים: זהים ל-includes

2. **Scripts:**
   - `_includes/footer.html`: כולל `contact-us-modal.js`
   - standalone pages: חלק כוללים, חלק לא

### Scroll-to-top:

- `_includes/scroll-to-top.html`: קיים עם script
- standalone pages: יש להם scroll-to-top משוכפל עם script

### Scripts ספציפיים לדפים:

**pages/about.html:**
- `css-monitor.js`

**pages/pricing.html:**
- `css-monitor.js`
- `config.js`
- `analytics-tracker.js`
- Firebase SDK (inline)
- `credits-display.js`

**pages/spec-viewer.html:**
- `css-monitor.js`
- `lib-loader.js`
- `prompts.js`
- `mermaid.js`
- `spec-cache.js`
- `spec-error-handler.js`
- `spec-events.js`
- `config.js`
- `entitlements-cache.js`
- Firebase SDK (inline)
- `credits-display.js`

## רשימת דפים

### דפים עם layout: default (6):
1. `pages/article.html`
2. `pages/articles.html`
3. `pages/academy/index.html`
4. `pages/academy/category.html`
5. `pages/academy/guide.html`
6. `pages/dynamic-post.html`

### דפים standalone (17):
1. `index.html` - דף הבית
2. `pages/about.html` - אודות
3. `pages/how.html` - איך זה עובד
4. `pages/why.html` - למה
5. `pages/pricing.html` - תמחור
6. `pages/profile.html` - פרופיל
7. `pages/spec-viewer.html` - צפייה ב-spec
8. `pages/demo-spec.html` - demo
9. `pages/ToolPicker.html` - Tool Finder
10. `pages/404.html` - שגיאה 404
11. `pages/maintenance.html` - תחזוקה
12. `pages/legacy-viewer.html` - legacy viewer
13. `pages/admin-dashboard.html` - admin dashboard
14. `pages/admin/academy/index.html` - admin academy
15. `pages/admin/academy/new-category.html` - new category
16. `pages/admin/academy/new-guide.html` - new guide
17. `pages/admin/academy/edit-guide.html` - edit guide

### דף מיוחד:
- `pages/auth.html` - נשאר standalone (כפי שביקשת)

## החלטות

1. **credits-display:** שימוש ב-`class="hidden"` (יותר נקי מ-inline style)
2. **Footer:** שימוש ב-"Vibe Coding Tools Map" (הגרסה המלאה)
3. **Scroll-to-top:** הסרה מ-standalone pages (כבר קיים ב-includes)
4. **Scripts:** העברה ל-`extra_js` ב-Front Matter
