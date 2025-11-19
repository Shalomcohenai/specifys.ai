# מדריך לבדיקת בעיות בבלוג

## מקומות לבדיקה:

### 1. בדיקת לוגים של השרת (Backend)
```bash
# לוגים מקומיים
tail -f backend/server.log | grep -i "blog\|post\|github"

# או לוגים ב-Render (אם זה מועלה שם)
# היכנס ל-Render Dashboard > Service > Logs
```

**מה לחפש:**
- `[Blog Post] Publishing:` - האם הפוסט מתחיל להעלות?
- `[Blog Post] Successfully published:` - האם ההעלאה הצליחה?
- `[Blog Queue]` - מה הסטטוס של התור?
- שגיאות GitHub API (401, 403, 404, 500)

### 2. בדיקת Firebase (Firestore)
**היכנס ל-Firebase Console:**
- `https://console.firebase.google.com/`
- בחר את הפרויקט
- `Firestore Database` > `blogQueue` collection

**מה לבדוק:**
- האם יש פריטים ב-`blogQueue`?
- מה ה-`status` שלהם? (`pending`, `processing`, `completed`, `failed`)
- אם `failed` - מה ה-`error`?

### 3. בדיקת GitHub
**היכנס ל-GitHub Repository:**
- `https://github.com/Shalomcohenai/specifys.ai`
- ענף: `main`
- תיקייה: `_posts/`

**מה לבדוק:**
- האם הקבצים קיימים ב-`_posts/`?
- מה התאריך של ה-commit האחרון?
- האם יש שגיאות ב-commits?

**בדיקה מהירה:**
```bash
# בדוק את הקבצים האחרונים ב-_posts
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/Shalomcohenai/specifys.ai/contents/_posts?ref=main
```

### 4. בדיקת GitHub Pages
**היכנס ל-GitHub Repository Settings:**
- `https://github.com/Shalomcohenai/specifys.ai/settings/pages`

**מה לבדוק:**
- האם GitHub Pages מופעל?
- מה ה-Source branch? (צריך להיות `main`)
- מה ה-Source folder? (צריך להיות `/ (root)`)
- מה הסטטוס של ה-last deployment?

**בדיקת Actions (אם יש):**
- `https://github.com/Shalomcohenai/specifys.ai/actions`
- האם יש builds שנכשלו?

### 5. בדיקת ה-URL בפועל
**לאחר שהפוסט מועלה:**
- בדוק את ה-URL שנוצר (למשל: `https://specifys-ai.com/2025/01/14/post-title/`)
- בדוק אם יש redirects או שגיאות 404

**בדיקה מקומית (אם יש Jekyll):**
```bash
cd /path/to/repo
bundle exec jekyll serve
# פתח: http://localhost:4000/2025/01/14/post-title/
```

### 6. בדיקת Console בדפדפן
**פתח את Admin Dashboard:**
- `F12` > Console
- בדוק אם יש שגיאות JavaScript
- בדוק את ה-Network tab - האם ה-API calls מצליחים?

### 7. בדיקת Environment Variables
**ב-Render (או בסביבה שלך):**
- `GITHUB_TOKEN` - האם מוגדר?
- האם ה-token תקף עם הרשאות נכונות?

**בדיקת Token:**
```bash
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user
```

## צעדים לפתרון לפי הבעיה:

### אם הפוסט לא מועלה ל-GitHub:
1. בדוק את לוגי השרת - מה השגיאה?
2. בדוק את `GITHUB_TOKEN` - האם הוא תקף?
3. בדוק את ה-`blogQueue` ב-Firebase - מה הסטטוס?

### אם הפוסט מועלה אבל לא מופיע באתר:
1. בדוק את GitHub Pages - האם הוא בונה?
2. בדוק את ה-URL - האם הוא תואם ל-permalink של Jekyll?
3. חכה 2-3 דקות (GitHub Pages צריך לבנות)

### אם יש 404:
1. בדוק את ה-URL שנוצר - האם הוא תואם ל-permalink?
2. בדוק את ה-permalink ב-`_config.yml`: `permalink: /:year/:month/:day/:title/`
3. בדוק אם הפוסט קיים ב-GitHub ב-`_posts/`

## בדיקות מהירות:

### בדוק אם השרת עובד:
```bash
curl http://localhost:3002/api/blog/posts
```

### בדוק את התור:
```bash
curl http://localhost:3002/api/blog/queue/status
```

### בדוק פוסט ספציפי:
```bash
curl "http://localhost:3002/api/blog/post?slug=post-title&date=2025-01-14"
```

