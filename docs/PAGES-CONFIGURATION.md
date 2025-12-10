# 📄 תצורת דפים - Specifys.ai

**תאריך עדכון:** 2025-12-10  
**מצב:** ✅ מסודר ומתועד

---

## 📋 סיכום כללי

האתר מכיל **23 דפים** המחולקים ל-2 קטגוריות:
1. **דפים עם Jekyll Layout** (8 דפים) - משתמשים ב-`layout: default`
2. **דפים סטטיים** (15 דפים) - HTML מלא ללא layout

---

## 🗂️ רשימת דפים

### דפים עם Jekyll Layout (`layout: default`)

דפים אלה משתמשים ב-`_layouts/default.html` ומקבלים אוטומטית:
- Header/Footer משותפים
- כל קבצי ה-CSS דרך `_includes/head.html`
- Firebase authentication
- Analytics

| דף | מיקום | Permalink | Extra CSS | הערות |
|-----|-------|-----------|-----------|-------|
| **Blog** | `blog/index.html` | `/blog/` | `blog.css` | ✅ |
| **Article** | `pages/article.html` | `/article.html` | - | ✅ |
| **Articles** | `pages/articles.html` | `/pages/articles.html` | - | ✅ |
| **Academy** | `pages/academy/index.html` | `/academy.html` | `academy.css` | ✅ |
| **Academy Category** | `pages/academy/category.html` | `/academy/category.html` | `academy.css` | ✅ |
| **Academy Guide** | `pages/academy/guide.html` | `/academy/guide.html` | `academy.css` | ✅ |
| **Dynamic Post** | `pages/dynamic-post.html` | `/dynamic-post/` | - | ✅ |
| **Tools Map** | `tools/map/vibe-coding-tools-map.html` | `/tools/map/vibe-coding-tools-map.html` | `vibe-coding-tools-map.css` | ✅ |

### דפים סטטיים (Static HTML)

דפים אלה הם HTML מלא עם `<head>` משלהם. הם **לא** משתמשים ב-Jekyll layouts.

| דף | מיקום | URL | CSS | הערות |
|-----|-------|-----|-----|-------|
| **Homepage** | `index.html` | `/` | מלא | ✅ |
| **About** | `pages/about.html` | `/pages/about.html` | מלא | ✅ |
| **Pricing** | `pages/pricing.html` | `/pages/pricing.html` | מלא | ✅ |
| **Auth** | `pages/auth.html` | `/pages/auth.html` | מלא | ✅ |
| **Profile** | `pages/profile.html` | `/pages/profile.html` | מלא | ✅ |
| **Spec Viewer** | `pages/spec-viewer.html` | `/pages/spec-viewer.html` | מלא | ✅ |
| **Demo Spec** | `pages/demo-spec.html` | `/pages/demo-spec.html` | מלא | ✅ |
| **How It Works** | `pages/how.html` | `/pages/how.html` | מלא | ✅ |
| **Why** | `pages/why.html` | `/pages/why.html` | מלא | ✅ |
| **Tool Picker** | `pages/ToolPicker.html` | `/pages/ToolPicker.html` | מלא | ✅ |
| **404** | `pages/404.html` | `/pages/404.html` | מלא | ✅ |
| **Maintenance** | `pages/maintenance.html` | `/pages/maintenance.html` | מלא | ✅ |
| **Admin Dashboard** | `pages/admin-dashboard.html` | `/pages/admin-dashboard.html` | מלא | ✅ |
| **Legacy Viewer** | `pages/legacy-viewer.html` | `/pages/legacy-viewer.html` | מלא | ✅ |
| **Academy Admin** | `pages/admin/academy/index.html` | `/pages/admin/academy/index.html` | מלא | ✅ |

---

## ⚙️ תצורת Jekyll (`_config.yml`)

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

## 🔧 בעיות שנפתרו

### 1. דפים שלא הועתקו ל-`_site`
**בעיה:** `blog/`, `pages/academy/`, `pages/article.html` לא הועתקו ל-`_site`  
**פתרון:** 
- הוספתי `blog/` ל-`include` ב-`_config.yml`
- דפים עם `layout: default` מקומפלים אוטומטית לפי `permalink`

### 2. דפים שלא מקומפלים
**בעיה:** דפים עם `layout: default` לא מקומפלים בגלל שגיאת build  
**פתרון:** 
- הסרתי `assets/css/style.scss` (קובץ ריק שגרם לשגיאה)
- עדכנתי `exclude` ב-`_config.yml`

### 3. CSS לא נטען
**בעיה:** דפים סטטיים לא קיבלו את כל קבצי ה-CSS  
**פתרון:** 
- עדכנתי את כל הדפים הסטטיים לכלול את כל קבצי ה-CSS הנדרשים:
  - `main-compiled.css`
  - `tailwind-base-compiled.css`
  - `buttons.css`
  - `display.css`
  - `text.css`
  - `spacing.css`

---

## 📦 CSS Files Included

### דפים עם Layout
דפים אלה מקבלים אוטומטית דרך `_includes/head.html`:
- `main-compiled.css`
- `tailwind-base-compiled.css`
- `buttons.css`
- `display.css`
- `text.css`
- `spacing.css`
- `extra_css` (אם מוגדר בדף)

### דפים סטטיים
דפים אלה כוללים את כל קבצי ה-CSS ישירות ב-`<head>`:
- `main-compiled.css`
- `tailwind-base-compiled.css`
- `buttons.css`
- `display.css`
- `text.css`
- `spacing.css`
- CSS ספציפי לדף (אם קיים)

---

## ✅ בדיקות

### דפים עם Layout
- [x] `blog/index.html` - מקומפל ל-`_site/blog/index.html`
- [x] `pages/article.html` - מקומפל ל-`_site/article.html`
- [x] `pages/articles.html` - מקומפל ל-`_site/pages/articles.html`
- [x] `pages/academy/index.html` - מקומפל ל-`_site/academy.html`
- [x] `pages/academy/category.html` - מקומפל ל-`_site/academy/category.html`
- [x] `pages/academy/guide.html` - מקומפל ל-`_site/academy/guide.html`
- [x] `pages/dynamic-post.html` - מקומפל ל-`_site/dynamic-post/index.html`
- [x] `tools/map/vibe-coding-tools-map.html` - מקומפל ל-`_site/tools/map/vibe-coding-tools-map.html`

### דפים סטטיים
- [x] כל הדפים הסטטיים כוללים את כל קבצי ה-CSS הנדרשים
- [x] כל הדפים נטענים נכון בשרת המקומי

---

## 🚀 הוראות Build

### Build מלא
```bash
bundle exec jekyll build
```

### Server עם skip initial build
```bash
bundle exec jekyll serve --skip-initial-build
```

**הערה:** `--skip-initial-build` נדרש אם יש שגיאות build (כמו `style.scss`).

---

## 📝 הערות חשובות

1. **דפים עם Layout:** דפים אלה **חייבים** להיות עם `layout: default` כדי לקבל את כל ה-CSS והפונקציונליות.

2. **דפים סטטיים:** דפים אלה **חייבים** לכלול את כל קבצי ה-CSS ישירות ב-`<head>`.

3. **Permalinks:** חשוב לוודא שה-`permalink` נכון כדי שהדף יופיע במיקום הנכון.

4. **CSS Files:** כל קבצי ה-CSS **חייבים** להיות ב-`include` ב-`_config.yml` כדי ש-Jekyll יעתיק אותם ל-`_site`.

---

## 🔄 עדכונים עתידיים

### המלצות לשיפור:
1. **מיגרציה לדפים עם Layout:** לשקול להמיר את כל הדפים הסטטיים לדפים עם `layout: default` כדי לפשט את התחזוקה.

2. **CSS Modular:** לשקול להפריד את ה-CSS של כל דף לקובץ נפרד במקום לכלול הכל ב-`main-compiled.css`.

3. **Build Process:** לשפר את תהליך ה-build כדי למנוע שגיאות.

---

**עודכן על ידי:** AI Assistant  
**תאריך:** 2025-12-10
