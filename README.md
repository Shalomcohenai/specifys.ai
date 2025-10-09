# Specifys.ai - Jekyll Site

## 🔴 Status: Migration Complete!

**The entire site has been successfully migrated to Jekyll!**

All pages now use:
- ✅ Shared header/footer (edit once, update everywhere)
- ✅ Centralized CSS management
- ✅ Modular layouts and includes
- ✅ Firebase authentication (preserved)
- ✅ All original functionality

---

## 🚀 Quick Start

### Run the site locally:

```bash
bundle install
bundle exec jekyll serve
```

Open: http://localhost:4000

**Look for the 🔴 RED LOGO** - it indicates a Jekyll page!

---

## 📁 Site Structure

### Layouts
```
_layouts/
├── default.html    - Base layout with header/footer
├── page.html       - For static pages
├── post.html       - For blog posts
├── tool.html       - For tools and dynamic pages
└── dashboard.html  - For user dashboards
```

### Includes
```
_includes/
├── head.html           - Meta tags, CSS, fonts
├── header.html         - Site header (🔴 with red logo for now)
├── footer.html         - Site footer
├── analytics.html      - Google Analytics
├── firebase-init.html  - Firebase SDK initialization
├── firebase-auth.html  - Firebase auth functions
└── scroll-to-top.html  - Scroll to top button
```

### Pages
All main pages are in `pages/` directory with Jekyll Front Matter.

### Blog
Blog posts are in `_posts/` and use the `post` layout.

---

## 🔧 How To

### Add a New Page

Create a new file in `pages/`:

```yaml
---
layout: page
title: "My New Page"
description: "Page description"
permalink: /pages/my-new-page.html
---

<h2>Your content here</h2>
<p>More content...</p>
```

**That's it!** The page will automatically have header, footer, CSS, and Firebase auth.

### Change Header/Footer

Edit the include files:
- `_includes/header.html` - Changes apply to ALL pages
- `_includes/footer.html` - Changes apply to ALL pages

### Change Colors/Styles

Edit the CSS files:
- `assets/css/core/variables.css` - Change colors, fonts, spacing
- `assets/css/components/` - Component-specific styles

### Add a Blog Post

Create a new file in `_posts/` with format: `YYYY-MM-DD-title.md`

```yaml
---
layout: post
title: "My Post Title"
date: 2025-10-08
---

Your post content here...
```

---

## 🔄 Migration Process

If you haven't migrated yet, follow these steps:

### 1. Test Jekyll Versions
```bash
bundle exec jekyll serve
```

Check all pages have 🔴 RED LOGO

### 2. Run Migration Script
```bash
./migrate.sh
```

This will:
- Create backup
- Replace old files with Jekyll versions
- Guide you through testing

### 3. Cleanup Old Files
```bash
./cleanup-old-files.sh
```

Removes `*-OLD.html` files after verification.

### 4. Restore Original Logo Color (Optional)

Edit `_includes/header.html` and remove the red logo styles.

---

## 📚 Documentation

- **`START-HERE.md`** - Quick start guide
- **`COMPLETE.md`** - Migration completion summary
- **`FINAL-SUMMARY.md`** - Detailed summary
- `README-MIGRATION.md` - Full migration guide
- `FILES-CREATED.md` - List of all new files

---

## 🛠️ Development

### Prerequisites
- Ruby (for Jekyll)
- Bundler
- Jekyll

### Install Dependencies
```bash
bundle install
```

### Run Development Server
```bash
bundle exec jekyll serve
```

Site will be available at: http://localhost:4000

### Build for Production
```bash
bundle exec jekyll build
```

Output will be in `_site/` directory.

---

## 🔐 Firebase

Firebase Authentication is integrated and working:
- Configuration in `_includes/firebase-init.html`
- Auth functions in `_includes/firebase-auth.html`
- All user features preserved (login, profile, dashboards)

---

## 📱 Features

- ✅ Responsive design (mobile-first)
- ✅ User authentication (Firebase)
- ✅ Blog with dynamic post listing
- ✅ Market research tools
- ✅ App specification generator
- ✅ Vibe Coding Tools Map
- ✅ Tool Finder
- ✅ User profiles and dashboards
- ✅ SEO optimized
- ✅ Analytics integrated

---

## 🎨 Customization

### Change Primary Color
Edit `assets/css/core/variables.css`:
```css
:root {
  --primary-color: #YOUR_COLOR;
}
```

### Change Fonts
Edit `_includes/head.html` to change Google Fonts.

### Change Logo
Edit `_includes/header.html`:
```html
<div class="logo">
  <a href="{{ '/' | relative_url }}">Your Logo</a>
</div>
```

---

## 📞 Support

For issues or questions:
- Email: specifysai@gmail.com
- LinkedIn: [Specifys.ai](https://www.linkedin.com/company/specifys-ai/)

---

## 📄 License

© 2025 Specifys.ai. All rights reserved.

---

<p align="center">
  <strong>Built with Jekyll 🔴</strong><br>
  <em>Clean, Modular, Maintainable</em>
</p>

