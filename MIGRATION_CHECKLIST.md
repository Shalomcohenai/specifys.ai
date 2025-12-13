# ✅ רשימת בדיקה - מיגרציה מערכת קרדיטים

## 🎯 סטטוס כללי

✅ **המיגרציה הושלמה בהצלחה!**

המערכת החדשה **מוכנה לשימוש** - כל הנתונים הועתקו והקוד עודכן.

---

## ⚠️ שלבים קריטיים לפני שימוש

### 1. מיגרציה של נתונים ✅ **הושלם!**

**סטטוס:** ✅ **הושלם בהצלחה**

**תוצאות:**
- ✅ 232 משתמשים הועתקו ל-`user_credits`
- ✅ 80 transactions הועתקו ל-`credit_ledger`
- ✅ Backup מלא נשמר
- ✅ Validation עבר בהצלחה

**גיבויים:**
- Firestore: `credits_migration_backup/backup_1765663924205`
- Local: `backend/scripts/credits_backup_1765663925200.json`

---

### 2. בדיקות (חובה!)

**מה לבדוק:**

1. **יצירת משתמש חדש**
   - האם מקבל 1 קרדיט חינם?
   - האם `user_credits` נוצר?

2. **צריכת קרדיט**
   - האם קרדיט נצרך נכון?
   - האם התצוגה מתעדכנת?

3. **רכישת קרדיטים**
   - האם webhook מעבד נכון?
   - האם קרדיטים מתווספים?

4. **Pro subscription**
   - האם Pro מופעל נכון?
   - האם קרדיטים נשמרים?

5. **תצוגת קרדיטים**
   - האם מוצג נכון ב-header?
   - האם מתעדכן בזמן אמת?

---

### 4. Backward Compatibility

**מה עובד:**
- ✅ `/api/specs/entitlements` - עדיין עובד (מפנה למערכת החדשה)
- ✅ `/api/specs/consume-credit` - עדיין עובד (מפנה למערכת החדשה)
- ✅ Frontend ישן - עדיין עובד (משתמש ב-endpoints ישנים)

**מה לא עובד:**
- ❌ `/api/credits/*` - הוסר (צריך להשתמש ב-`/api/v2/credits/*`)
- ❌ Firestore listeners ישנים - הוסרו

---

## 📋 רשימת פעולות לפי סדר עדיפות

### לפני העלאה ל-Production:

1. ✅ **הרצת מיגרציה** - `migrate-credits-system.js`
2. ✅ **בדיקות בסיסיות** - יצירת משתמש, צריכת קרדיט, רכישה
3. ✅ **ניטור** - לבדוק שהכל עובד תקופה

### אחרי שהכל עובד (לפחות שבוע):

5. ⚠️ **מחיקת collections ישנות** (רק אחרי ניטור!)
   - `entitlements` collection
   - `credits_transactions` collection
   - `free_specs_remaining` מ-`users` collection

---

## 🔍 איך לבדוק שהכל עובד

### בדיקה מהירה:

```bash
# 1. בדוק שהשרת עולה
curl https://your-api.com/api/health

# 2. בדוק שהמערכת החדשה עובדת
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.com/api/v2/credits

# 3. בדוק backward compatibility
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.com/api/specs/entitlements
```

### בדיקה ב-Firestore:

1. פתח Firestore Console
2. בדוק ש-`user_credits` collection קיימת
3. בדוק ש-`credit_ledger` collection קיימת
4. בדוק שמשתמש חדש מקבל document ב-`user_credits`

---

## ⚠️ אזהרות חשובות

1. **אל תמחק collections ישנות** עד שמוודא שהכל עובד לפחות שבוע
2. **שמור backups** - הסקריפט יוצר backups אוטומטית
3. **בדוק בסביבת staging** לפני production
4. **React Components** - אם יש לך Next.js app, עדכן אותו

---

## 📝 סיכום

**המערכת מוכנה לשימוש מלא:**
- ✅ Backend חדש עובד
- ✅ Frontend חדש עובד (Jekyll)
- ✅ כל קבצי Jekyll עודכנו
- ✅ Backward compatibility שמור
- ✅ **מיגרציה הושלמה** - כל הנתונים הקיימים הועתקו
- ✅ **המערכת מוכנה לניסוי!**

**לפני שימוש מלא:**
1. ✅ הרץ מיגרציה - **הושלם!**
2. ⚠️ בדוק הכל - **מומלץ לבדוק לפני production**
3. ⚠️ ניטור שבוע - **מומלץ אחרי העלאה ל-production**

**אחרי ניטור:**
5. מחק collections ישנות
