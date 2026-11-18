# DESIGN_SYSTEM — الوضع الحالي (خط الأساس) — النسخة المعتمدة تُبنى في المرحلة 06 وتُعرض في G2

## الموجود فعليًا
- **السمات:** 4 سمات في `styles.js` (الافتراضية، الزجاجية، ميزان، RESTAURANT PRO — الحالية).
- **الرموز (v42.3):** الزوايا `--r-sm..--r-xl`، الحركة `--t-fast/--t/--t-slow` ومنحنى `--ease-out`، الخطوط `--font-head/--font-ui` (IBM Plex Sans Arabic) والأرقام `MizanNum`.
- **الهوية:** الكحلي `#0B1F3A` والذهبي `#C8A24A`، شعار الحلقة والماسة وحرف M (v47.2).
- **المكونات المشتركة (CSS):** `.btn` (pri/gh/sm)، `.inp`، `.sel`، `.card`/`.card-t`، `.tb`/`.tw`، `.badge` (b-mint/rose/amber/sky/brass/dim)، `.modal` (h/b/f)، `.grid g2–g4`، `.row`، `.note`/`.hint`، `.empty`، `.kpi`، `.mono-b`، `.rowgrip`، `.doclink`، `.voicebtn`.
- **مكونات React مشتركة:** `Modal`، `Field`، `Kpi`، `Num`، `ItemPick`، `UomSelect`، `RowGrip`، `DocLink`.

## الناقص (للمرحلة 06)
توثيق المقاييس (المسافات، أحجام العناوين، الأيقونات)، حالات الأزرار والحقول الموحدة (hover/focus/disabled/error)، مكون جدول موحد (فرز/إخفاء/بحث)، كتالوج بصري، هوية المطبوعات.
