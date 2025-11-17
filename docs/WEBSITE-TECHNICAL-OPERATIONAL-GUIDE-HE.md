### מסמך טכני־תפעולי מקיף של האתר

המסמך מסביר את מבנה המערכת, הדפים, הזרימות העיקריות, שכבות ה-frontend וה-backend, הסכמות ב-Firestore, מנגנוני הרשאות/קרדיטים/תשלום, וכלים תפעוליים.

## 1) מבנה וסטאק
- **Frontend (Jekyll + Vanilla JS)**
  - דפים תחת `index.html`, `pages/*.html`, בלוג `_posts/` + `_layouts/post.html`.
  - Includes ו־Layouts: `_includes/*`, `_layouts/*`.
  - סקריפטים: `assets/js/*.js` (לוגיקת homepage/spec/credits/admin/mermaid וכו’).
  - סטיילינג: `assets/css/**/*`.
- **Backend (Node/Express)**
  - שרת: `backend/server/server.js`, ראוטרים לניהול משתמשים, קרדיטים, בלוג, בריאות המערכת.
  - אימות Firebase Admin, עדכוני entitlements, webhookים (לרכישות).
- **Data**
  - Firestore: `users`, `entitlements`, `specs`, ועוד לפי צורך.
- **אימות**
  - Firebase Auth בפרונט; אימות ID Token בבקאנד לכל endpoint רגיש.
- **תשלום/קרדיטים**
  - Lemon Squeezy (Checkout + webhookים), ניהול יתרות ב־`entitlements`.
- **Build/Deploy**
  - Jekyll לסטטי, Vite לבאנדלים, שרת Node מתארח (Render/VM), CDN לסטטי.

## 2) מפת דפים מרכזיים
- `index.html` – דף הבית: Hero, CTA Start, Demo, Pricing, תכונות, FAQ, ועוד.
- `pages/auth.html` – Login/Signup (Firebase UI מותאם).
- `pages/spec.html` – עורך יצירה (מצב עריכה/הרחבה קיים חלקית).
- `pages/spec-viewer.html` – צפייה/אישור Overview, יצירת Technical/Market/Design, Diagrams, Raw Data, AI Chat.
- `pages/profile.html` – פרופיל: רשימת Specs, סטטוסים, יתרות, קישורים ל-Viewer/Editor.
- `pages/pricing.html` – תמחור ורכישה (Single/3-Pack/Pro).
- `pages/admin-dashboard.html` – אדמין: ניהול משתמשים/Specs/בלוג/מדדים.
- `pages/how.html`, `pages/about.html`, `pages/demo-spec.html`, `pages/legacy-viewer.html`, `pages/ToolPicker.html`.
- בלוג: `/blog/` ו-`_posts/*` דרך `_layouts/post.html`.

## 3) זרימות משתמש עיקריות

### 3.1 הרשמה/התחברות
- משתמש לוחץ Start ב־`/index.html`.
- אם לא מחובר → Redirect ל־`/pages/auth.html`.
- לאחר התחברות:
  - קליינט: `onAuthStateChanged` יורה `ensure user` ל־`/api/users/ensure` עם Bearer Token.
  - שרת: מאמת טוקן, יוצר/מעדכן `users/{uid}`, ו־`entitlements/{uid}` עם ברירת־מחדל (תוכנית free, יתרות ראשוניות).
  - חזרה ל־Home או לזרימה שנדרשה.

### 3.2 יצירת Spec חדש (Question Flow)
- המשתמש עונה על שאלון קצר (Question Flow) שמוגדר ב־`assets/js/index.js` + `question-flow-*.js`.
- בדיקת זכאות/קרדיט:
  - אם אין זכאות: פרומפט לרכישה ב־`/pages/pricing.html`.
- יצירה:
  - `generateSpecification()` מריץ יצירה של Overview (ב-API/מודל), מציג טעינה, ומחזיר תוכן.
  - `saveSpecToFirebase(overview, answers)` יוצר מסמך `specs/{id}` עם:
    - `overview`, `answers`, `status.overview="ready"`, `technical/market/design=null`, `overviewApproved=false`, `userId`, `createdAt/updatedAt`.
- Redirect ל־`/pages/spec-viewer.html?id={id}`.

### 3.3 אישור Overview ויצירת מפרטים
- משתמש רואה Overview בלשונית Overview.
- משתמש PRO יכול לערוך Overview (שומר ל-Firestore). כל שמירה מאפסת היסטוריית Chat לרלוונטיות.
- לחיצה “Approve Overview”:
  - עדכון `overviewApproved=true`, `status.technical/market/design="generating"`.
  - הפעלת לשונית AI Chat מידית.
  - יצירה סדרתית:
    - Technical → Market → Design.
    - כל מודול נשמר בשדה נפרד במסמך, עם `status.*="ready"` או `"error"`.
  - Diagrams: יצירה/הצגה (Mermaid) בלשונית Diagrams.
  - Raw Data: חשיפת JSON גולמי לייצוא/בדיקה.

### 3.4 צפייה/שיתוף/עריכה
- הרשאות צפייה:
  - ציבורי (`isPublic=true`) או בעלים (`userId`) או אדמין.
- פעולות:
  - צפייה: Overview/Technical/Market/Design/Diagrams/Raw.
  - עריכה: PRO יכול לערוך Overview (ואפשרויות נוספות אם מופעלות).
  - העלאה ל־OpenAI Storage (אופציונלי) דרך API מאובטח לטובת המשך אינטראקציות בצד AI.

### 3.5 ניהול דרך Profile
- `pages/profile.html`: טבלת Specs של המשתמש, סטטוסים, תאריכים, יתרות קרדיטים/מנוי.
- קישורים מהירים ל־Viewer/Editor, ומעקב אחר רכישות/יתרות.

### 3.6 רכישה ומנויים
- Free: לפחות Spec אחד ראשוני.
- רכישות: Single/3-Pack/Pro ב־`pages/pricing.html` עם Lemon Squeezy.
- לאחר רכישה:
  - Webhookים בשרת מעדכנים `entitlements/{uid}`: `spec_credits`, `unlimited`, `can_edit`.
  - הקליינט מרענן תצוגת קרדיטים/אפשרויות.

## 4) שכבת ה-Frontend

- Scripts עיקריים:
  - `assets/js/index.js`: ה־CTA, Question Flow, יצירה/שמירה, Redirect ל-Viewer.
  - `assets/js/spec-formatter.js`: עזרה לעיבוד/רינדור טקסטואלי.
  - `assets/js/credits-display.js`, `assets/js/entitlements-cache.js`: הצגת יתרות/Cache.
  - `assets/js/mermaid.js`: טעינת דיאגרמות Mermaid.
  - `assets/js/admin-dashboard.js`: UI אדמין.
  - `assets/js/live-brief-modal.js`: UX מודאלי תומך.
- UI מותנה הרשאות:
  - הצגת כפתורי Edit/Approve/Share בהתאם ל־user state ו־entitlements.
- Includes/Layouts:
  - `_includes/firebase-init.html`, `_includes/firebase-auth.html`: אתחול/מצבי Auth.
  - `_layouts/*`: `default`, `dashboard`, `post`, `auth`, `standalone`.

## 5) שכבת ה-Backend

- אימות:
  - Middleware לאימות Firebase ID Token ב־Express לכל `/api/*` רגיש.
  - `requireAdmin` להגנת ראוטרי אדמין.
- Users/Entitlements:
  - `POST /api/users/ensure`: יצירה/עדכון `users/{uid}` + `entitlements/{uid}`.
  - עדכון יתרות במענה ל־webhookי תשלום.
- Credits:
  - `POST /api/credits/consume` – שריפת קרדיט ביצירה; `POST /api/credits/refund` – החזר במקרה כשל.
- Specs:
  - Endpoints ליצירה/עדכון/העלאה ל־OpenAI Storage.
  - אימות בעלות/הרשאות לפי `userId` ו־role.
- Blog/Admin:
  - ניהול פוסטים/תכנים (תחת הרשאות אדמין).
- Observability:
  - לוגינג/איסוף שגיאות ו־health routes.

## 6) סכמות נתונים (Firestore – עיקריות)

- `users/{uid}`
  - `email`, `displayName`, `emailVerified`, `createdAt`, `lastActive`, `plan`, `newsletterSubscription`, ועוד.
- `entitlements/{uid}`
  - `userId`, `spec_credits`, `unlimited` (Pro), `can_edit`, `updated_at`.
- `specs/{specId}`
  - `userId`, `title`, `overview`, `technical`, `market`, `design`, `diagrams?`
  - `answers` (תשובות השאלון)
  - `overviewApproved` (bool)
  - `status`: `{ overview, technical, market, design }`
  - `isPublic?` (שיתוף), `createdAt`, `updatedAt`.
- הערות:
  - שמירה/עדכון תמיד מעדכנים `updatedAt`.
  - בדיקות גודל תוכן (הגבלת ~1MB למסמך) לפני עדכון.

## 7) הרשאות ואבטחה

- פרונט:
  - Gate לפני פעולות יצירה/צפייה פרטיות; Redirect ל־Auth כשצריך.
  - הצגת UI בהתאם ל־auth role ו־entitlements.
- בקאנד:
  - אימות ID Token לכל endpoint רגיש; החזרת 401/403 ולוגינג.
  - `requireAdmin` להגנה על פעולות אדמין.
- Firestore Rules:
  - בעלות על מסמכים; מניעת כתיבה/קריאה לא מאושרת בצד קליינט.
- שיתוף:
  - `isPublic` מאפשר צפייה ללא בעלות מלאה; עדיין נהוג לדרוש auth עבור viewer כדי לאפשר תכונות מתקדמות (Chat/Actions).

## 8) תמחור, קרדיטים וגבייה

- תוכניות:
  - Free: לפחות Spec אחד.
  - Single: חבילת Spec בודד.
  - 3-Pack: 3 ספקס.
  - Pro: Unlimited + יכולות עריכה מתקדמות.
- תהליך:
  - Checkout ב־`/pages/pricing.html` (Lemon Squeezy).
  - שרת מקבל webhook → עדכון `entitlements`.
  - קליינט מרענן תצוגת יתרות ומאפשר יצירה/עריכה בהתאם.

## 9) ניהול אדמין

- `pages/admin-dashboard.html`:
  - ניהול משתמשים/entitlements.
  - עיון/פתיחה של Specs (Viewer/Editor).
  - ניהול בלוג ותכני מערכת.
- הרשאות:
  - `requireAdmin` על ה-API; UI מוסתר/נחסם בצד לקוח למשתמשים לא אדמינים.

## 10) בלוג ותוכן

- `_posts/*` עם `_layouts/post.html`.
- ניהול דרך אדמין או תהליכי build.
- SEO/Structured Data via includes.

## 11) תפעול, ניטור ותחזוקה

- Health checks: ראוטים ייעודיים בשרת.
- לוגים: צד שרת ואנליטיקות בצד לקוח (`_includes/analytics*.html`).
- ניהול תקלות:
  - החזר קרדיטים אוטומטי כששמירה נכשלה אחרי צריכה.
  - UI fallback (Question Flow controller → זרימה ישנה).
- Build:
  - Jekyll לבניית הסטטי, Vite לנכסים, קובצי manifest, פריסה לסביבת הייצור.
- אבטחת תוכן:
  - בדיקות גודל תוכן לפני כתיבה ל-Firestore.
  - ולידציה בסיסית בצד שרת למבנים/קלט.

## 12) תרשים רצף ליבה (תקצירי)

- יצירה:
  - Client (Start) → Auth gate → Question Flow → generateOverview → saveSpec (Firestore) → redirect Viewer.
- אישור ויצירה מלאה:
  - Client (Viewer Approve) → update spec (overviewApproved=true, statuses=generating) → generate Technical → save → generate Market → save → generate Design → save → statuses=ready.
- תשלום:
  - Client (Checkout) → Lemon Squeezy → Webhook to Server → update entitlements → Client refresh entitlements.

## 13) UX עיקרי (לפי תוכנית מנוי)
- Free: יצירה אחת לפחות, צפייה מלאה ב־Viewer אחרי אישור Overview. להמשך – רכישה.
- Single/3-Pack: יצירת כמות מוגדרת, עריכה בסיסית, צפייה מלאה.
- Pro: יצירה ללא הגבלה, יכולות עריכה מתקדמות (כולל Overview), Chat עשיר, ואפשרויות אינטגרציה מורחבות.

—
- כל הטקסטים באתר למשתמשים עצמם נשמרים באנגלית בהתאם להנחיות המותג; המסמך שלמעלה בעברית לצורך תפעולי/פנימי.


