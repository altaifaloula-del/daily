# DESIGN SYSTEM — v56.0

نظام التصميم **قائم في الكود** ومُعاد استعماله؛ هذا الإصدار وثّقه ووحّد مصادر الهوية وأضاف ما يخص المنشأة — لم يُستبدل أي مكوّن مستقر.

## 1. الرموز (Design Tokens)
| المجموعة | المتغيرات | الملف |
|---|---|---|
| ألوان المنصة | `--mithqal-navy/gold/deep-navy/tech-blue/white/soft-gray` | `brand/tokens/mithqal-tokens.css` (+ JSON) |
| سطوح ونص | `--ink --ink2 --ink3 --line --txt --dim --faint` | `styles.js` (لكل ثيم × فاتح/داكن) |
| حالات | `--mint` نجاح · `--rose` خطأ · `--amber` تنبيه · `--sky` معلومة · `--violet` | `styles.js` |
| العلامة | `--acc/--brass` (+ مشتقات `color-mix`)، `--brand-fill --brand-ink --gold --navy` | `styles.js` |
| المسافات (8pt) | `--s1 4 · --s2 8 · --s3 12 · --s4 16 · --s5 20 · --s6 24 · --s8 32 · --s10 40` | `styles.js` |
| الاستدارة | `--r-sm --r --r-md --r-lg --r-xl --r-full` | `styles.js` |
| الظلال | `--sh-1…--sh-4`, `--sh-brass` | `styles.js` |
| الحركة | `--ease --ease-out --t-fast --t --t-slow` | `styles.js` |
| التركيز (وصول) | `--ring` | `styles.js` |
| الخطوط | `--font-ui --font-head --font-en`، أرقام `MizanNum` (`.num`، `.inp.n`) بعرض ثابت واتجاه LTR | `styles.js` |
| **مستندات المنشأة (جديد)** | `--tb-p --tb-a --tb-h --tb-t --tb-soft --tb-line` يولّدها `tbCss()` من هوية المنشأة | `App.jsx` |

## 2. المكونات المشتركة (فئات CSS + مكوّنات React)
`card`, `kpi`, `btn` (`pri`, `gh`, `gold`, `sm`), `inp`/`sel`/`Field`, `tb` (الجداول)، `badge b-*`, `note`, `Modal`, `pagehead`, `seg`، `SecPager`، `OdooBar`، `RptTable` (جدول التقارير بالفرز والتصدير)، `DocPeekHost` (عارض المستندات)، `BrandSymbol`/`BrandLockup` (المنصة)، **`TenantChip`** و**`TenantBranding`** (جديد).

## 3. الثيمات
11 ثيمًا يختارها **المستخدم لجهازه** (تفضيل عرض)؛ الافتراضي `restpro` = هوية MITHQAL. الثيم لا يغيّر شعار المنصة ولا هوية المنشأة ولا مستنداتها.

## 4. الدعم
RTL (افتراضي) / LTR (`lang-en`)، فاتح/داكن لكل ثيم، الجوال والتابلت والحاسوب (اختبار «كل الشاشات» على iPhone 13 و1280px + لقطات 900px تابلت).

## 5. قواعد
- لا قيم لونية ثابتة في الشاشات (`brand.test.mjs` يمنع ألوان الهوية القديمة)؛ مستندات المنشأة لا تحمل كحلي المنصة (`branding.test.mjs`).
- الألوان دلالية: الأحمر خسارة/خطأ، الأخضر ربح/نجاح، لا ألوان زينة في المؤشرات.
