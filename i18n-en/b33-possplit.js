/* v52.7 دفعة الترجمة b33 — فصل فواتير نقطة البيع شهريًا (G3-A) */
export default {
"فصل فواتير نقطة البيع شهريًا (G3)": "Split POS invoices by month (G3)",
"فحص الحالة": "Check status",
"جارٍ الفحص…": "Checking…",
"فصل شهريًا": "Split by month",
"جارٍ الفصل…": "Splitting…",
"تراجع": "Undo",
"مفصول شهريًا": "Split by month",
"مستند واحد": "Single document",
"تعذّرت القراءة": "Read failed",
"لا صلاحية": "No access",
"لمدير النظام فقط.": "System admin only.",
"قرارك (G3 — الخيار A): فواتير كل فرع في مستند لكل شهر، فلا يُعاد رفع فواتير السنة كلها مع كل حفظ. ابدأ بالمنشأة التجريبية ثم بفرع واحد هنا. كل الشاشات والتقارير تعمل كما هي.": "Your decision (G3 — option A): each branch's invoices are kept in one document per month, so a whole year of invoices is not re-uploaded on every save. Start with the pilot tenant, then one branch here. All screens and reports work as before.",
};
export const RX = [
  [/^(\d+) فاتورة محمّلة$/, '$1 invoices loaded'],
  [/^فُصلت فواتير (.+): (\d+) فاتورة في (\d+) شهر ✓$/, 'Split invoices of $1: $2 invoices in $3 months ✓'],
  [/^تم التراجع لفرع (.+)$/, 'Undone for branch $1'],
];
