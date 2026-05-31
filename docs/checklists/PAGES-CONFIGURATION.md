# Page Configuration — Specifys.ai

**Last updated:** 2025-12-10  
**Status:** Documented and current

---

## Overview

Most site pages use the **Jekyll layout** `layout: default` (shared header/footer, CSS, Firebase, analytics). The **Auth** page is standalone HTML (no layout).

**Available layouts:** `_layouts/default.html`, `_layouts/dashboard.html`, `_layouts/post.html`, `_layouts/auth.html`, `_layouts/standalone.html`.

---

## Page list

### Pages with Jekyll layout (`layout: default`)

These pages use `_layouts/default.html` and automatically get header/footer, CSS, Firebase, and analytics.

| Page | Location | Notes |
|-----|-------|-------|
| **404** | `pages/404.html` | OK |
| **About** | `pages/about.html` | OK |
| **Articles** | `pages/articles.html` | OK |
| **Article** | `pages/article.html` | OK |
| **Contact** | `pages/contact.html` | OK |
| **Demo Spec** | `pages/demo-spec.html` | OK |
| **Dynamic Post** | `pages/dynamic-post.html` | OK |
| **How** | `pages/how.html` | OK |
| **Legacy Viewer** | `pages/legacy-viewer.html` | OK |
| **New Admin** | `pages/new-admin-dashboard.html` | OK |
| **Planning** | `pages/planning.html` | OK |
| **Pricing** | `pages/pricing.html` | OK |
| **Profile** | `pages/profile.html` | OK |
| **Privacy** | `pages/privacy.html` | OK |
| **Spec Viewer** | `pages/spec-viewer.html` | OK |
| **Terms** | `pages/terms.html` | OK |
| **Tool Picker** | `pages/ToolPicker.html` | OK |
| **Why** | `pages/why.html` | OK |
| **Unsubscribe** | `pages/unsubscribe.html` | OK |
| **Cursor/Windsurf** | `pages/cursor-windsurf-integration.html` | OK |
| **Academy** | `pages/academy/index.html`, `category.html`, `guide.html` | OK |

(Blog pages live under `blog/index.html` and `_posts/` with layout `post`.)

### Standalone pages (no Jekyll layout)

| Page | Location | Notes |
|-----|-------|-------|
| **Auth** | `pages/auth.html` | Full HTML, no layout front matter |

---

## Jekyll configuration (`_config.yml`)

### Include
```yaml
include:
  - _redirects
  - tools/
  - blog/  # Blog directory must be explicitly included
  # CSS files - must be explicitly listed
```

### Exclude
```yaml
exclude:
  - README.md
  - Gemfile
  - node_modules
  - backend
  - vendor
  - .sass-cache
  - .jekyll-cache
  - .jekyll-metadata
  - .gitignore
  - .git
  - .DS_Store
  - Thumbs.db
  - package.json
  - package-lock.json
  - create-post.js
  - create-post.sh
  - create-post.bat
  - config/
  - backup-*
  - assets/css/main.scss
```

---

## Resolved issues

### 1. Pages not copied to `_site`
**Problem:** `blog/`, `pages/academy/`, `pages/article.html` were not copied to `_site`  
**Fix:** 
- Added `blog/` to `include` in `_config.yml`
- Pages with `layout: default` compile automatically via `permalink`

### 2. Pages not compiling
**Problem:** Pages with `layout: default` failed to compile due to a build error  
**Fix:** 
- Removed `assets/css/style.scss` (empty file that caused the error)
- Updated `exclude` in `_config.yml`

### 3. CSS not loading
**Problem:** Static pages did not receive all CSS files  
**Fix:** 
- Updated all static pages to include required CSS:
  - `main-compiled.css`
  - `tailwind-base-compiled.css`
  - `buttons.css`
  - `display.css`
  - `text.css`
  - `spacing.css`

---

## CSS files included

### Pages with layout
These pages receive styles automatically via `_includes/head.html`:
- `main-compiled.css`
- `tailwind-base-compiled.css`
- `buttons.css`
- `display.css`
- `text.css`
- `spacing.css`
- `extra_css` (when set on the page)

### Static pages
These pages include all CSS directly in `<head>`:
- `main-compiled.css`
- `tailwind-base-compiled.css`
- `buttons.css`
- `display.css`
- `text.css`
- `spacing.css`
- Page-specific CSS (if any)

---

## Verification

### Pages with layout
- [x] `blog/index.html` — compiles to `_site/blog/index.html`
- [x] `pages/article.html` — compiles to `_site/article.html`
- [x] `pages/articles.html` — compiles to `_site/pages/articles.html`
- [x] `pages/academy/index.html` — compiles to `_site/academy.html`
- [x] `pages/academy/category.html` — compiles to `_site/academy/category.html`
- [x] `pages/academy/guide.html` — compiles to `_site/academy/guide.html`
- [x] `pages/dynamic-post.html` — compiles to `_site/dynamic-post/index.html`
- [x] `tools/map/vibe-coding-tools-map.html` — compiles to `_site/tools/map/vibe-coding-tools-map.html`

### Static pages
- [x] All static pages include required CSS files
- [x] All pages load correctly on the local server

---

## Build instructions

### Full build
```bash
bundle exec jekyll build
```

### Serve with skip initial build
```bash
bundle exec jekyll serve --skip-initial-build
```

**Note:** Use `--skip-initial-build` when build errors occur (e.g. `style.scss`).

---

## Important notes

1. **Pages with layout:** Must use `layout: default` to get full CSS and functionality.

2. **Static pages:** Must include all CSS files directly in `<head>`.

3. **Permalinks:** Ensure `permalink` is correct so the page is served at the intended URL.

4. **CSS files:** All CSS files must be listed under `include` in `_config.yml` so Jekyll copies them to `_site`.

---

## Future improvements

1. **Migrate to layout pages:** Consider converting remaining static pages to `layout: default` for easier maintenance.

2. **Modular CSS:** Consider splitting per-page CSS instead of bundling everything in `main-compiled.css`.

3. **Build process:** Improve the build to avoid recurring errors.

---

**Updated by:** AI Assistant  
**Date:** 2025-12-10
