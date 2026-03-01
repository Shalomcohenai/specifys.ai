# 📄 תצורת דפים - Specifys.ai

**תאריך עדכון:** 2025-12-10  
**מצב:** ✅ מסודר ומתועד

---

## 📋 סיכום כללי

רוב הדפים באתר משתמשים ב-**Jekyll Layout** `layout: default` (header/footer משותפים, CSS, Firebase, Analytics). דף **Auth** הוא HTML עצמאי (ללא layout).

**Layouts קיימים:** `_layouts/default.html`, `_layouts/dashboard.html`, `_layouts/post.html`, `_layouts/auth.html`, `_layouts/standalone.html`.

---

## 🗂️ רשימת דפים

### דפים עם Jekyll Layout (`layout: default`)

דפים אלה משתמשים ב-`_layouts/default.html` ומקבלים אוטומטית Header/Footer, CSS, Firebase, Analytics.

| דף | מיקום | הערות |
|-----|-------|-------|
| **404** | `pages/404.html` | ✅ |
| **About** | `pages/about.html` | ✅ |
| **Articles** | `pages/articles.html` | ✅ |
| **Article** | `pages/article.html` | ✅ |
| **Contact** | `pages/contact.html` | ✅ |
| **Demo Spec** | `pages/demo-spec.html` | ✅ |
| **Dynamic Post** | `pages/dynamic-post.html` | ✅ |
| **How** | `pages/how.html` | ✅ |
| **Legacy Viewer** | `pages/legacy-viewer.html` | ✅ |
| **New Admin** | `pages/new-admin-dashboard.html` | ✅ |
| **Planning** | `pages/planning.html` | ✅ |
| **Pricing** | `pages/pricing.html` | ✅ |
| **Profile** | `pages/profile.html` | ✅ |
| **Privacy** | `pages/privacy.html` | ✅ |
| **Spec Viewer** | `pages/spec-viewer.html` | ✅ |
| **Terms** | `pages/terms.html` | ✅ |
| **Tool Picker** | `pages/ToolPicker.html` | ✅ |
| **Why** | `pages/why.html` | ✅ |
| **Unsubscribe** | `pages/unsubscribe.html` | ✅ |
| **Cursor/Windsurf** | `pages/cursor-windsurf-integration.html` | ✅ |
| **Academy** | `pages/academy/index.html`, `category.html`, `guide.html` | ✅ |

(דפי Blog ב-`blog/index.html` ו-`_posts/` עם layout `post`.)

### דפים עצמאיים (ללא Jekyll layout)

| דף | מיקום | הערות |
|-----|-------|-------|
| **Auth** | `pages/auth.html` | HTML מלא, ללא front matter layout |

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
