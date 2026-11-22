/* v53.0 دفعة الترجمة b35 — مجالات النشاط */
export default {
"مجالات النشاط": "Business domains",
"إظهار الأصناف والمنتجات في كل فرع حسب مجاله": "Show items and products in each branch by its domain",
"مجال النشاط": "Business domain",
"مجال نشاط الفرع": "Branch business domain",
"بلا اختيار = مشترك لكل المجالات": "None selected = shared across all domains",
"بلا اختيار = يرى أصناف ومنتجات كل المجالات": "None selected = sees items and products of all domains",
"كل المجالات": "All domains",
"مطعم": "Restaurant", "مقهى": "Café", "مخبز وحلويات": "Bakery & sweets", "كشك": "Kiosk",
"حفظ القائمة": "Save list",
"إخفاء القائمة": "Hide list",
"اكتب مجالًا واحدًا على الأقل": "Enter at least one domain",
"عند التفعيل يرى كل فرع في نقطة البيع والمستودع والجرد أصناف ومنتجات مجاله فقط. حدّد مجال الفرع من «تعديل» الفرع، ومجال الصنف أو المنتج من شاشة المخزون.": "When enabled, each branch sees only its domain's items and products in POS, the warehouse and counts. Set a branch's domain from “Edit” branch, and an item's or product's domain from the Inventory screen.",
"الصنف أو المنتج بلا مجال مشترك لكل الفروع، والفرع بلا مجال يرى الكل، والصنف الذي له رصيد في مستودع الفرع لا يُخفى. التقارير المركزية لا تتأثر.": "An item or product with no domain is shared by all branches, a branch with no domain sees everything, and an item with stock in the branch warehouse is never hidden. Central reports are unaffected.",
};
export const RX = [
  [/^المجال: (.+)$/, 'Domain: $1'],
  [/^تعديل قائمة المجالات \((\d+)\)$/, 'Edit domain list ($1)'],
  [/^(.+) · خيار «الإظهار حسب المجال» متوقف حاليًا — يُطبَّق عند تفعيله من «الفروع والمستخدمون»$/, '$1 · “Show by domain” is currently off — applies once enabled in “Branches & users”'],
];
