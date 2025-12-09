# מדריך קומפוננטות UI - Components Guide

מדריך מלא לכל הקומפוננטות המודולריות שנוצרו.

## צבעים בסיסיים

- **כתום ראשי**: `#FF6B35` (`bg-primary`, `text-primary`)
- **אפור כהה ראשי**: `#333` (`text-text-DEFAULT`, `bg-text-DEFAULT`)
- **אפור בהיר ראשי**: `#FFF4F0` (`bg-bg-secondary`, `bg-gray-light`)

## קומפוננטות

### 1. Button (כפתור)

כפתור בסיסי עם וריאציות.

```tsx
import { Button } from '@/components/ui';

<Button size="md" variant="primary">Click Me</Button>
<Button size="sm" variant="secondary">Secondary</Button>
<Button size="lg" variant="outline">Outline</Button>
<Button as={Link} href="/page" size="md">Link Button</Button>
```

**Props:**
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'xl'`
- `variant`: `'primary' | 'secondary' | 'outline'`
- `as`: `'button' | 'a' | typeof Link`
- `href`: string (for links)
- Hover: כתום יותר בהיר (`#FF8551`), טקסט נשאר לבן

---

### 2. Badge (תווית)

תווית/תגית עם רקע כתום.

```tsx
import { Badge } from '@/components/ui';

<Badge>BEST VALUE</Badge>
<Badge variant="secondary">PRO</Badge>
```

**Props:**
- `variant`: `'primary' | 'secondary'`
- `children`: string (uppercase מומלץ)

---

### 3. ToggleButton (כפתור טוגל)

כפתור טוגל למיון בין אפשרויות (Monthly/Yearly).

```tsx
import { ToggleButton } from '@/components/ui';

<ToggleButton
  options={[
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
  ]}
  value={selectedValue}
  onChange={(value) => setSelectedValue(value)}
/>
```

**Props:**
- `options`: `ToggleOption[]`
- `value`: string (הערך הנבחר)
- `onChange`: `(value: string) => void`

---

### 4. PricingCard (כרטיס תמחור)

כרטיס תמחור מלא עם תכונות וכפתור CTA.

```tsx
import { PricingCard } from '@/components/ui';

<PricingCard
  title="Single Spec"
  description="One-time payment"
  price="4.90"
  features={[
    { text: '1 additional spec', included: true },
    { text: 'Edit saved specs', included: true },
    { text: 'All free features', included: true }
  ]}
  ctaText="Buy Now"
  ctaHref="/pricing"
  badge="BEST VALUE"
  highlightTop={true}
/>
```

**Props:**
- `title`: string
- `description?`: string
- `price`: string
- `pricePeriod?`: string (e.g., "/month")
- `features`: `PricingFeature[]`
- `ctaText`: string
- `ctaHref`: string
- `badge?`: string
- `highlightTop?`: boolean (פס הדגשה עליון)

---

### 5. IconCard (כרטיס אייקון)

כרטיס עם אייקון גדול, רקע אפור כהה.

```tsx
import { IconCard } from '@/components/ui';

<IconCard icon={<i className="fa fa-map"></i>} />
<IconCard 
  icon={<i className="fa fa-search"></i>} 
  onClick={() => console.log('clicked')}
/>
```

**Props:**
- `icon`: ReactNode
- `onClick?`: `() => void`

---

### 6. InfoCard (כרטיס מידע/סטטיסטיקה)

כרטיס להצגת מידע/סטטיסטיקה.

```tsx
import { InfoCard } from '@/components/ui';

<InfoCard
  value="105+"
  label="Vibe Coding Tools"
  description="Curated tools in our Vibe Coding Tools Map."
/>
```

**Props:**
- `value`: string | number
- `label`: string
- `description?`: string

---

### 7. StatusIcon (אייקון סטטוס)

אייקון עגול קטן לסטטוס (checkmark/X).

```tsx
import { StatusIcon } from '@/components/ui';

<StatusIcon status="check" />
<StatusIcon status="cross" />
```

**Props:**
- `status`: `'check' | 'cross'`

---

### 8. FeatureList (רשימת תכונות)

רשימת תכונות עם אייקוני סטטוס.

```tsx
import { FeatureList } from '@/components/ui';

<FeatureList
  features={[
    { text: '1 additional spec', included: true },
    { text: 'Edit saved specs', included: true },
    { text: 'Premium support', included: false }
  ]}
/>
```

**Props:**
- `features`: `FeatureItem[]`

---

### 9. Container (קונטיינר)

קונטיינר עם max-width.

```tsx
import { Container } from '@/components/ui';

<Container size="lg">
  <h1>Content</h1>
</Container>
```

**Props:**
- `size`: `'sm' | 'md' | 'lg' | 'xl' | 'full'`

---

### 10. SectionHeader (כותרת סקשן)

כותרת ותת-כותרת לסקשן.

```tsx
import { SectionHeader } from '@/components/ui';

<SectionHeader
  title="Discover Our Tools"
  subtitle="Everything you need to build your app"
/>
```

**Props:**
- `title`: string
- `subtitle?`: string

---

### 11. PriceDisplay (תצוגת מחיר)

תצוגת מחיר עם סימן $.

```tsx
import { PriceDisplay } from '@/components/ui';

<PriceDisplay price="4.90" />
<PriceDisplay price="29.90" period="/month" size="lg" />
```

**Props:**
- `price`: string
- `period?`: string
- `size`: `'sm' | 'md' | 'lg'`

---

### 12. Divider (קו מפריד)

קו מפריד אופקי או אנכי.

```tsx
import { Divider } from '@/components/ui';

<Divider />
<Divider orientation="vertical" />
```

**Props:**
- `orientation`: `'horizontal' | 'vertical'`

---

### 13. ScrollToTop (כפתור גלילה למעלה)

כפתור עגול לגלילה למעלה, מופיע אחרי גלילה.

```tsx
import { ScrollToTop } from '@/components/ui';

<ScrollToTop threshold={400} />
```

**Props:**
- `threshold?`: number (default: 400)
- Hover: רקע הופך כתום, חץ נשאר לבן

---

## דוגמאות שימוש משולבות

### Pricing Section

```tsx
import { Container, SectionHeader, PricingCard } from '@/components/ui';

<Container>
  <SectionHeader
    title="Choose Your Plan"
    subtitle="Start free or upgrade for unlimited specifications"
  />
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <PricingCard {...singleSpecProps} />
    <PricingCard {...threePackProps} />
    <PricingCard {...proProps} />
  </div>
</Container>
```

### Tools Section

```tsx
import { Container, SectionHeader, IconCard } from '@/components/ui';

<Container>
  <SectionHeader
    title="Discover Our Tools"
    subtitle="Everything you need to build your app"
  />
  <div className="flex gap-4">
    <IconCard icon={<i className="fa fa-map"></i>} />
    <IconCard icon={<i className="fa fa-search"></i>} />
    <IconCard icon={<i className="fa fa-cogs"></i>} />
  </div>
</Container>
```

### Stats Section

```tsx
import { Container, SectionHeader, InfoCard } from '@/components/ui';

<Container>
  <SectionHeader
    title="Our Impact"
    subtitle="Join thousands who've planned apps"
  />
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <InfoCard value="105+" label="Tools" description="..." />
    <InfoCard value="4590+" label="Specs" description="..." />
    <InfoCard value="5440+" label="Users" description="..." />
  </div>
</Container>
```

## Best Practices

1. **שימוש עקבי**: השתמש באותן קומפוננטות בכל האתר
2. **צבעים**: השתמש רק בצבעים המוגדרים (`primary`, `text-DEFAULT`, `bg-secondary`)
3. **פונט**: כל הטקסטים משתמשים בפונט sans-serif מודרני
4. **Hover States**: כל הכפתורים הופכים כתום יותר בהיר ב-hover
5. **מודולריות**: כל קומפוננטה עצמאית וניתנת לשימוש חוזר

