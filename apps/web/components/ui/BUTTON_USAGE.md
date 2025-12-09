# Button Component - שימוש בכפתורים

## עיצוב בסיסי

הכפתור הבסיסי הוא:
- **מרובע** עם **קצוות מעוגלים מעט** (`rounded-md`)
- **צבע כתום בוהק** (`bg-orange-bright` - `#F28147`)
- **טקסט קטן ו-bold** (גדלים שונים זמינים)

## שימוש בסיסי

```tsx
import { Button } from '@/components/ui/Button';

// כפתור בסיסי
<Button>Click Me</Button>

// כפתור עם גודל ספציפי
<Button size="sm">Credits: 0</Button>
<Button size="md">Buy Now</Button>
```

## גדלים זמינים

- `xs` - Extra Small (טקסט קטן מאוד)
- `sm` - Small (כפתור קטן - מומלץ ל-"Credits: 0")
- `md` - Medium (כפתור בינוני - מומלץ ל-"Buy Now")
- `lg` - Large (כפתור גדול)
- `xl` - Extra Large (כפתור גדול מאוד)

## וריאציות

- `primary` - כתום בוהק (ברירת מחדל)
- `secondary` - אפור
- `outline` - מסגרת כתומה, רקע שקוף

## דוגמאות שימוש

### כפתור Credits
```tsx
<Button size="sm" variant="primary">
  Credits: 0
</Button>
```

### כפתור Buy Now
```tsx
<Button size="md" variant="primary">
  Buy Now
</Button>
```

### כפתור עם Link
```tsx
import Link from 'next/link';

<Button as={Link} href="/pricing" size="md">
  View Details
</Button>
```

### כפתור Disabled
```tsx
<Button size="md" disabled>
  Disabled Button
</Button>
```

### כל הגדלים על רקע אפור
```tsx
<div className="bg-bg-secondary p-4 rounded-lg flex gap-4">
  <Button size="xs">XS</Button>
  <Button size="sm">SM</Button>
  <Button size="md">MD</Button>
  <Button size="lg">LG</Button>
  <Button size="xl">XL</Button>
</div>
```

## Props מלאים

```tsx
interface ButtonProps {
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; // default: 'md'
  variant?: 'primary' | 'secondary' | 'outline'; // default: 'primary'
  as?: 'button' | 'a' | typeof Link; // default: 'button'
  href?: string; // for links
  className?: string; // additional classes
  disabled?: boolean;
  // ... כל שאר ה-props של HTML button
}
```

## צבעים בסיסיים

הצבעים הבסיסיים מוגדרים ב-`tailwind.config.js`:

### כתום ראשי
- `primary`: `#FF6B35` - הצבע הראשי לכפתורים וקישורים
- `primary-hover`: `#FF8551` - צבע hover
- `primary-light`: `#FFF4F0` - רקע בהיר

### אפור ראשי
- `text-DEFAULT`: `#333` - טקסט ראשי
- `gray-DEFAULT`: `#333` - אפור ראשי
- `gray-light`: `#FFF4F0` - אפור בהיר (רקע)

### שימוש ישיר
```tsx
// כתום ראשי
<div className="bg-primary text-white">
  Orange background
</div>

// אפור ראשי
<div className="bg-text-DEFAULT text-white">
  Gray background
</div>

// אפור בהיר (רקע)
<div className="bg-gray-light text-text-DEFAULT">
  Light gray background
</div>
```

