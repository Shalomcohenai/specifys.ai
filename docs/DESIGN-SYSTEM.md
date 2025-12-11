# 🎨 Design System - Specifys.ai

**תאריך עדכון:** 2025-01-27  
**גרסה:** 2.0  
**מצב:** ✅ פעיל ומעודכן

---

## 📋 תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [Design Tokens](#design-tokens)
4. [Components](#components)
5. [Layout](#layout)
6. [Utilities](#utilities)
7. [שימוש נכון](#שימוש-נכון)
8. [Best Practices](#best-practices)
9. [תהליך עבודה](#תהליך-עבודה)

---

## 📊 סקירה כללית

Design System של Specifys.ai מגדיר את כל הכללים, הקומפוננטות והכלים לעיצוב האתר. המערכת מבוססת על:

- **SCSS מודולרי** - מבנה מאורגן ונוח לתחזוקה
- **CSS Variables** - Design tokens דינמיים
- **Tailwind CSS** - Utility classes לפרוטוטייפים מהירים
- **Components** - קומפוננטות מוכנות לשימוש

### עקרונות עיצוב

1. **עקביות** - כל הקומפוננטות משתמשות באותם Design Tokens
2. **מודולריות** - כל קומפוננטה עצמאית וניתנת לשימוש חוזר
3. **נגישות** - תמיכה ב-WCAG 2.1 Level AA
4. **ביצועים** - CSS מינימלי ומותאם
5. **תחזוקה** - קוד נקי ומתועד

---

## 🏗️ ארכיטקטורה

### מבנה קבצים

```
assets/css/
├── core/                    # בסיס (חייב להיות ראשון)
│   ├── _variables.scss      # Design tokens (צבעים, spacing, typography)
│   ├── _reset.scss          # CSS reset
│   ├── _fonts.scss          # הגדרות פונטים
│   └── _base.scss           # בסיס
│
├── layout/                  # פריסה
│   ├── _header.scss         # כותרת עליונה
│   ├── _footer.scss         # כותרת תחתונה
│   └── _containers.scss     # קונטיינרים
│
├── components/              # רכיבים
│   ├── buttons.scss         # כפתורים (1013 שורות)
│   ├── badges.scss         # תגיות
│   ├── mermaid.scss         # דיאגרמות Mermaid
│   ├── _forms.scss          # טפסים (245 שורות)
│   ├── _tables.scss         # טבלאות (448 שורות)
│   ├── _modals.scss         # חלונות מודאליים (1026 שורות)
│   ├── _cards.scss          # כרטיסים (866 שורות)
│   ├── _icons.scss          # אייקונים (233 שורות)
│   └── _live-brief.scss     # Live Brief (469 שורות)
│
├── pages/                   # עיצוב ספציפי לדפים
│   ├── _index.scss          # דף הבית (2,770 שורות)
│   ├── index.css            # דף הבית (override)
│   ├── spec-viewer.css      # צפייה ב-spec
│   ├── profile.css          # פרופיל
│   ├── pricing.css          # תמחור
│   └── ...                  # דפים נוספים
│
├── utilities/              # Utility classes
│   ├── display.scss/css     # display utilities
│   ├── spacing.scss/css     # margin/padding utilities
│   ├── text.scss/css        # text utilities
│   ├── _responsive.scss     # responsive utilities
│   ├── _flexbox.scss        # flexbox utilities
│   ├── _position.scss       # position utilities
│   ├── _width.scss          # width utilities
│   ├── _height.scss         # height utilities
│   ├── _border.scss         # border utilities
│   ├── _shadow.scss         # shadow utilities
│   └── _overflow.scss       # overflow utilities
│
├── main.scss                # קובץ SCSS ראשי (מקור)
└── main-compiled.css        # קובץ CSS מקומפל (9,196 שורות, 168KB)
```

### סדר קימפול

סדר ה-imports ב-`main.scss` הוא קריטי:

1. **Core** (חייב להיות ראשון)
   - `_variables.scss` - Design tokens
   - `_reset.scss` - CSS reset
   - `_fonts.scss` - פונטים
   - `_base.scss` - בסיס

2. **Layout**
   - `_header.scss`
   - `_footer.scss`
   - `_containers.scss`

3. **Components**
   - כל הקומפוננטות בסדר אלפביתי

4. **Utilities**
   - כל ה-utilities בסדר אלפביתי

5. **Pages** (לא נכלל ב-`main-compiled.css`)
   - נטען בנפרד דרך `extra_css` ב-Front Matter

---

## 🎨 Design Tokens

### צבעים (Colors)

#### Primary Colors
```css
--primary-color: #FF6B35;        /* צבע ראשי */
--primary-hover: #FF8551;       /* מצב hover */
--primary-light: #FFF4F0;       /* גרסה בהירה */
```

#### Secondary Colors
```css
--secondary-color: #6c757d;      /* צבע משני */
--secondary-hover: #5a6268;    /* מצב hover */
```

#### Semantic Colors
```css
--success-color: #28a745;       /* הצלחה */
--warning-color: #ffc107;       /* אזהרה */
--danger-color: #dc3545;        /* שגיאה/סכנה */
--info-color: #17a2b8;          /* מידע */
```

#### Background Colors
```css
--bg-color: #f5f5f5;            /* רקע דף */
--bg-primary: #ffffff;          /* רקע כרטיס/קונטיינר */
--bg-secondary: #f5f5f5;       /* רקע משני */
--light-gray: #e9ecef;         /* אפור בהיר */
```

#### Text Colors
```css
--text-color: #333;             /* טקסט ראשי */
--text-secondary: #666;         /* טקסט משני */
--text-muted: #999;             /* טקסט מושתק */
--text-white: #ffffff;          /* טקסט לבן */
```

#### Border Colors
```css
--border-color: #dee2e6;        /* צבע גבול */
--border-light: #e9ecef;        /* גבול בהיר */
```

### Spacing Scale

```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 3rem;     /* 48px */
```

### Typography

#### Font Families
```css
--font-family-primary: 'Montserrat', sans-serif;   /* כותרות, display */
--font-family-secondary: 'Inter', sans-serif;      /* טקסט גוף, UI */
```

#### Font Sizes
```css
--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
--font-size-3xl: 1.875rem;  /* 30px */
--font-size-4xl: 2.25rem;    /* 36px */
```

#### Font Weights
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Border Radius

```css
--border-radius-sm: 0.25rem;   /* 4px */
--border-radius-md: 0.5rem;   /* 8px */
--border-radius-lg: 1rem;     /* 16px */
--border-radius-xl: 1.5rem;   /* 24px */
--border-radius-full: 50%;     /* עגול מלא */
```

### Shadows

```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 6px 16px rgba(0, 0, 0, 0.15);
--shadow-xl: 0 8px 32px rgba(0, 0, 0, 0.3);
```

### Transitions

```css
--transition-fast: 0.15s ease;
--transition-normal: 0.3s ease;
--transition-slow: 0.5s ease;
```

### Z-Index Scale

```css
--z-header: 99999;      /* כותרת עליונה */
--z-dropdown: 1000;     /* תפריט נפתח */
--z-modal: 10000;       /* חלון מודאלי */
```

---

## 🧩 Components

### Buttons

**קובץ:** `assets/css/components/buttons.scss` (1013 שורות)

#### Base Button
```html
<button class="btn">Click me</button>
<a href="#" class="btn">Link Button</a>
```

#### Variants
```html
<button class="btn btn-primary">Primary</button>
<button class="btn btn-secondary">Secondary</button>
<button class="btn btn-success">Success</button>
<button class="btn btn-danger">Danger</button>
<button class="btn btn-warning">Warning</button>
<button class="btn btn-info">Info</button>
```

#### Sizes
```html
<button class="btn btn-sm">Small</button>
<button class="btn">Default</button>
<button class="btn btn-lg">Large</button>
```

#### States
```html
<button class="btn" disabled>Disabled</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
```

#### Modifiers
```html
<button class="btn btn-block">Full Width</button>
<button class="btn btn-icon">
  <i class="fas fa-heart"></i>
  With Icon
</button>
```

### Badges

**קובץ:** `assets/css/components/badges.scss`

```html
<span class="badge">Default</span>
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-danger">Danger</span>
<span class="badge badge-warning">Warning</span>
```

### Cards

**קובץ:** `assets/css/components/_cards.scss` (866 שורות)

```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

### Forms

**קובץ:** `assets/css/components/_forms.scss` (245 שורות)

```html
<form class="form">
  <div class="form-group">
    <label for="email">Email</label>
    <input type="email" id="email" class="form-control" placeholder="Enter email">
  </div>
  <div class="form-group">
    <label for="message">Message</label>
    <textarea id="message" class="form-control" rows="4"></textarea>
  </div>
  <button type="submit" class="btn btn-primary">Submit</button>
</form>
```

### Modals

**קובץ:** `assets/css/components/_modals.scss` (1026 שורות)

```html
<!-- Modal Trigger -->
<button class="btn btn-primary" data-modal="myModal">Open Modal</button>

<!-- Modal -->
<div id="myModal" class="modal">
  <div class="modal-content">
    <span class="modal-close">&times;</span>
    <h2>Modal Title</h2>
    <p>Modal content</p>
  </div>
</div>
```

### Tables

**קובץ:** `assets/css/components/_tables.scss` (448 שורות)

```html
<table class="table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>John Doe</td>
      <td>john@example.com</td>
      <td><span class="badge badge-success">Active</span></td>
    </tr>
  </tbody>
</table>
```

---

## 📐 Layout

### Header

**קובץ:** `assets/css/layout/_header.scss` (298 שורות)

הכותרת העליונה כוללת:
- לוגו
- תפריט ניווט
- כפתורי אימות (Login/Sign up או User menu)
- תמיכה ב-RTL

### Footer

**קובץ:** `assets/css/layout/_footer.scss` (110 שורות)

הכותרת התחתונה כוללת:
- קישורים חשובים
- מידע על החברה
- רשתות חברתיות
- זכויות יוצרים

### Containers

**קובץ:** `assets/css/layout/_containers.scss` (88 שורות)

```html
<div class="container">Default Container</div>
<div class="container-sm">Small Container</div>
<div class="container-md">Medium Container</div>
<div class="container-lg">Large Container</div>
<div class="container-xl">Extra Large Container</div>
```

---

## 🛠️ Utilities

### Display Utilities

**קובץ:** `assets/css/utilities/display.css`

```html
<div class="hidden">Hidden</div>
<div class="visible">Visible</div>
<div class="flex">Flex</div>
<div class="inline-flex">Inline Flex</div>
<div class="grid">Grid</div>
```

### Spacing Utilities

**קובץ:** `assets/css/utilities/spacing.css`

```html
<div class="m-0">No Margin</div>
<div class="p-4">Padding 4</div>
<div class="mt-2">Margin Top 2</div>
<div class="mb-3">Margin Bottom 3</div>
```

### Text Utilities

**קובץ:** `assets/css/utilities/text.css`

```html
<p class="text-center">Centered</p>
<p class="text-left">Left Aligned</p>
<p class="text-right">Right Aligned</p>
<p class="text-bold">Bold</p>
<p class="text-uppercase">Uppercase</p>
```

### Responsive Utilities

**קובץ:** `assets/css/utilities/_responsive.css`

```html
<div class="responsive-container">
  <!-- Responsive content -->
</div>
```

### Flexbox Utilities

**קובץ:** `assets/css/utilities/_flexbox.css`

```html
<div class="flex flex-row">Row</div>
<div class="flex flex-column">Column</div>
<div class="flex justify-center">Justify Center</div>
<div class="flex align-center">Align Center</div>
```

---

## 💡 שימוש נכון

### 1. שימוש ב-CSS Variables

**✅ נכון:**
```css
.my-component {
  color: var(--primary-color);
  padding: var(--spacing-md);
  font-family: var(--font-family-primary);
}
```

**❌ לא נכון:**
```css
.my-component {
  color: #FF6B35;  /* לא להשתמש בערכים קשיחים */
  padding: 16px;   /* לא להשתמש בערכים קשיחים */
}
```

### 2. שימוש ב-Components

**✅ נכון:**
```html
<button class="btn btn-primary">Click me</button>
```

**❌ לא נכון:**
```html
<button style="background: #FF6B35; padding: 10px 20px;">Click me</button>
```

### 3. שימוש ב-Utilities

**✅ נכון:**
```html
<div class="flex justify-center align-center p-4">
  Content
</div>
```

**❌ לא נכון:**
```html
<div style="display: flex; justify-content: center; align-items: center; padding: 1rem;">
  Content
</div>
```

### 4. יצירת קומפוננטה חדשה

**✅ נכון:**
```scss
// assets/css/components/_my-component.scss
.my-component {
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--border-radius-md);
  
  &__title {
    font-size: var(--font-size-xl);
    color: var(--text-color);
  }
}
```

**❌ לא נכון:**
```scss
// לא ליצור קומפוננטה ב-page-specific CSS
// לא להשתמש ב-!important
// לא ליצור inline styles
```

---

## ✅ Best Practices

### 1. עקביות

- **תמיד** להשתמש ב-Design Tokens (CSS Variables)
- **תמיד** להשתמש ב-Components קיימים לפני יצירת חדשים
- **תמיד** לבדוק אם יש utility class לפני כתיבת CSS חדש

### 2. מודולריות

- כל קומפוננטה בקובץ נפרד
- כל קומפוננטה עצמאית (לא תלויה בקומפוננטות אחרות)
- שימוש ב-BEM naming convention

### 3. נגישות

- תמיכה ב-keyboard navigation
- תמיכה ב-screen readers
- contrast ratios לפי WCAG 2.1
- תמיכה ב-reduced motion

### 4. ביצועים

- מינימום CSS
- שימוש ב-utilities במקום custom CSS
- הימנעות מ-!important (רק במקרים נדירים)
- הימנעות מ-inline styles

### 5. תחזוקה

- קוד נקי ומתועד
- שימוש ב-SCSS features (nesting, variables, mixins)
- ארגון לפי מבנה מודולרי
- תיעוד כל קומפוננטה

---

## 🔄 תהליך עבודה

### יצירת קומפוננטה חדשה

1. **בדיקה** - האם קיימת קומפוננטה דומה?
2. **תכנון** - מה הקומפוננטה צריכה לעשות?
3. **יצירה** - ליצור קובץ ב-`assets/css/components/`
4. **שימוש** - להשתמש ב-Design Tokens
5. **תיעוד** - לתעד את הקומפוננטה
6. **הוספה** - להוסיף ל-`main.scss` (אם צריך)
7. **קימפול** - לקמפל SCSS ל-CSS
8. **בדיקה** - לבדוק שהכל עובד

### עדכון Design Token

1. **זיהוי** - לזהות את ה-Token שצריך לעדכן
2. **עדכון** - לעדכן ב-`assets/css/core/_variables.scss`
3. **בדיקה** - לבדוק שכל הקומפוננטות עדיין עובדות
4. **תיעוד** - לעדכן את התיעוד

### הוספת Utility חדש

1. **בדיקה** - האם יש utility דומה?
2. **יצירה** - ליצור/להוסיף ל-`assets/css/utilities/`
3. **קימפול** - לקמפל SCSS ל-CSS
4. **תיעוד** - לתעד את ה-utility

---

## 📚 משאבים

### קבצים חשובים

- **Design Tokens:** `assets/css/core/_variables.scss`
- **Components:** `assets/css/components/`
- **Utilities:** `assets/css/utilities/`
- **Main SCSS:** `assets/css/main.scss`
- **Compiled CSS:** `assets/css/main-compiled.css`

### תיעוד נוסף

- [PAGE-CREATION-GUIDE.md](./PAGE-CREATION-GUIDE.md) - הוראות להקמת דפים חדשים
- [CSS-IMPROVEMENT-STATUS.md](./CSS-IMPROVEMENT-STATUS.md) - סטטוס שיפורי CSS
- [CSS-STATUS-OVERVIEW-HE.md](./CSS-STATUS-OVERVIEW-HE.md) - סקירת מצב CSS

### קישורים חיצוניים

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [SCSS Documentation](https://sass-lang.com/documentation)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 🔄 עדכונים

**2025-01-27:**
- עדכון Design System Documentation
- הוספת תהליך עבודה
- הוספת Best Practices
- עדכון מבנה קבצים

**2025-12-11:**
- השלמת קימפול SCSS
- העתקת כל ה-Utilities
- ניקוי כפילויות

---

**תאריך עדכון אחרון:** 2025-01-27  
**עודכן על ידי:** AI Assistant
