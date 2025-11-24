# פתרון בעיות דיפלוימנט GitHub Pages

## הבעיה: "Deployment cancelled"

השגיאה "Deployment cancelled" יכולה להיגרם מכמה סיבות:

### 1. בעיית Timeout
הדיפלוימנט לוקח יותר מדי זמן ומבוטל אוטומטית.

**פתרון:**
- בדוק את הגדרות ה-workflow שלך
- הוסף timeout ארוך יותר
- בדוק אם יש תהליכי build ארוכים מדי

### 2. בעיית הרשאות
אין הרשאות מספיקות לדיפלוימנט.

**פתרון:**
- בדוק את הגדרות ה-Permissions ב-workflow
- ודא שיש GITHUB_TOKEN עם הרשאות מתאימות
- בדוק את הגדרות ה-Repository Settings > Actions > General

### 3. בעיה עם Artifact
ה-artifact לא נבנה כראוי או נמחק.

**פתרון:**
- בדוק את שלב ה-build ב-workflow
- ודא שה-artifact נוצר בהצלחה
- בדוק את גודל ה-artifact (יש מגבלה של 10GB)

### 4. בעיה עם הגדרות GitHub Pages
הגדרות GitHub Pages לא נכונות.

**פתרון:**
- בדוק את Repository Settings > Pages
- ודא שה-Source branch נכון (main)
- ודא שה-Source folder נכון (/ (root) או /docs)

## בדיקות מהירות

### 1. בדוק את ה-workflow
```bash
# בדוק אם יש קובץ workflow
ls -la .github/workflows/
```

### 2. בדוק את הלוגים
- היכנס ל-GitHub Repository > Actions
- בדוק את ה-run האחרון
- חפש שגיאות בשלב ה-build

### 3. בדוק את הגדרות Pages
- היכנס ל-Repository Settings > Pages
- ודא שה-Source branch נכון
- בדוק את הסטטוס של ה-deployment האחרון

## פתרון מומלץ

אם אתה משתמש ב-GitHub Actions לדיפלוימנט, ודא שיש לך workflow תקין:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.1
          bundler-cache: true
      - name: Build Jekyll site
        run: bundle exec jekyll build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./_site

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## צעדים נוספים

1. **נסה דיפלוימנט מחדש:**
   - היכנס ל-Actions
   - בחר את ה-run האחרון
   - לחץ על "Re-run failed jobs"

2. **בדוק את הגדרות ה-Repository:**
   - ודא ש-GitHub Pages מופעל
   - בדוק את ה-Source branch
   - בדוק את ה-Source folder

3. **נקה את ה-Cache:**
   - היכנס ל-Actions
   - לחץ על "Clear cache" אם יש אפשרות

4. **בדוק את הגדרות ה-Permissions:**
   - ודא שיש GITHUB_TOKEN עם הרשאות מתאימות
   - בדוק את הגדרות ה-Repository Settings > Actions > General

## אם הבעיה נמשכת

1. בדוק את הלוגים המלאים ב-GitHub Actions
2. בדוק אם יש שגיאות בשלב ה-build
3. בדוק את הגדרות ה-Permissions
4. נסה לבנות את האתר מקומית כדי לוודא שאין שגיאות

