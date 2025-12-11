# צבעים בסיסיים - Basic Colors

## צבעים ראשיים

### כתום ראשי - Primary Orange
- **קוד צבע**: `#FF6B35`
- **שימוש ב-Tailwind**: `bg-primary`, `text-primary`, `border-primary`
- **שימוש**: כפתורים ראשיים, קישורים, אלמנטים חשובים

```tsx
// רקע כתום
<div className="bg-primary text-white">Content</div>

// טקסט כתום
<p className="text-primary">Orange text</p>

// מסגרת כתומה
<div className="border-2 border-primary">Bordered</div>
```

### אפור ראשי - Primary Gray
- **קוד צבע**: `#333`
- **שימוש ב-Tailwind**: `bg-text-DEFAULT`, `text-text-DEFAULT`, `bg-gray-DEFAULT`
- **שימוש**: טקסט ראשי, רקעים כהים

```tsx
// טקסט אפור ראשי
<p className="text-text-DEFAULT">Main text</p>

// רקע אפור ראשי
<div className="bg-text-DEFAULT text-white">Dark background</div>
```

### אפור בהיר ראשי - Light Gray
- **קוד צבע**: `#FFF4F0`
- **שימוש ב-Tailwind**: `bg-bg-secondary`, `bg-gray-light`, `bg-primary-light`
- **שימוש**: רקעים בהירים, sections, cards

```tsx
// רקע בהיר
<div className="bg-bg-secondary text-text-DEFAULT">
  Light background section
</div>

// או
<div className="bg-gray-light text-text-DEFAULT">
  Light background
</div>
```

## צבעים נוספים

### כתום - וריאציות
- `primary` (`#FF6B35`) - כתום ראשי
- `primary-hover` (`#FF8551`) - hover state
- `primary-light` (`#FFF4F0`) - רקע בהיר

### אפור - וריאציות
- `text-DEFAULT` (`#333`) - אפור ראשי
- `text-secondary` (`#666`) - אפור משני
- `text-muted` (`#999`) - אפור מושתק
- `gray-light` (`#FFF4F0`) - אפור בהיר

### רקעים
- `bg-primary` (`#ffffff`) - לבן
- `bg-secondary` (`#FFF4F0`) - אפור בהיר
- `bg-DEFAULT` (`#f5f5f5`) - אפור בהיר מאוד

## דוגמאות שימוש

### כפתור כתום על רקע אפור בהיר
```tsx
<div className="bg-bg-secondary p-4">
  <Button variant="primary">Click Me</Button>
</div>
```

### טקסט אפור על רקע בהיר
```tsx
<div className="bg-bg-secondary p-4">
  <h2 className="text-text-DEFAULT font-bold">Title</h2>
  <p className="text-text-secondary">Description</p>
</div>
```

### קישור כתום
```tsx
<a href="/" className="text-primary hover:text-primary-hover">
  Link
</a>
```

## מיפוי צבעים

| שם בעברית | קוד צבע | Tailwind Class | שימוש |
|-----------|---------|----------------|-------|
| כתום ראשי | `#FF6B35` | `bg-primary` | כפתורים, קישורים |
| אפור ראשי | `#333` | `text-text-DEFAULT` | טקסט ראשי |
| אפור בהיר | `#FFF4F0` | `bg-bg-secondary` | רקעים |

## Best Practices

1. **כפתורים**: השתמש ב-`bg-primary` לכפתורים ראשיים
2. **טקסט**: השתמש ב-`text-text-DEFAULT` לטקסט ראשי
3. **רקעים**: השתמש ב-`bg-bg-secondary` לרקעים בהירים
4. **קישורים**: השתמש ב-`text-primary` עם `hover:text-primary-hover`



