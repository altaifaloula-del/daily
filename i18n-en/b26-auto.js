/* v52.0 دفعة الترجمة b26 — الأتمتة (الدفعة الثانية) */
export default {
"الأتمتة": "Automation",
"ما يجري تلقائيًا — بمسار الاعتماد والصلاحيات نفسه، ولا يمس فترة مقفلة.": "What runs automatically — through the same approvals and permissions, never touching a locked period.",
"تُنشأ عند دخول من يملك الترحيل": "Created when a user with posting rights signs in",
"تُراجع ثم تُنشأ من الموردين ← أوامر الشراء": "Reviewed, then created from Suppliers ← Purchase orders",
"تذكير الإقرار الضريبي": "VAT return reminder",
"تذكير الإقفال الشهري": "Month-end close reminder",
"حفظ إعدادات الأتمتة": "Save automation settings",
"حُفظت إعدادات الأتمتة": "Automation settings saved",
"القيود الدورية المستحقة": "Due recurring entries",
"استحقاق رواتب الشهر السابق": "Previous month's payroll accrual",
"أوامر شراء مقترحة من نفاد المخزون": "Suggested purchase orders from stock-outs",
"مراجعة وإنشاء الأمر": "Review and create order",
"مقترح آليًا من نفاد المخزون": "Auto-suggested from stock-outs",
"سداد ضريبة متأخر": "VAT payment overdue"
};
export const RX = [
  [/^ابتداءً من يوم$/, 'starting on day'],
  [/^من الشهر$/, 'of the month'],
  [/^قبل الموعد بـ$/, 'before the due date by'],
  [/^\(0 = موقوف\)$/, '(0 = off)'],
  [/^يوم من نهاية الشهر$/, 'days after month end'],
  [/^أوامر شراء مقترحة من نفاد المخزون \((\d+)\)$/, 'Suggested purchase orders from stock-outs ($1)'],
  [/^الإقرار الضريبي يستحق خلال (\d+) يوم$/, 'VAT return due in $1 days'],
  [/^فترة (\S+) ← (\S+) — آخر موعد للإقرار والسداد (\S+)\. جهّز الإقرار من المحاسبة ← الضريبة\.$/, 'Period $1 ← $2 — filing and payment deadline $3. Prepare the return from Accounting ← VAT.'],
  [/^سداد ضريبة يستحق خلال (\d+) يوم$/, 'VAT payment due in $1 days'],
  [/^إقرار (\S+) ← (\S+): المتبقي (.+) ر\.س — الموعد (\S+)\.$/, 'Return $1 ← $2: $3 SAR outstanding — due $4.'],
  [/^الشهر (\S+) لم يُقفل بعد$/, 'Month $1 is not closed yet'],
  [/^مضى (\d+) يوم على نهايته — راجع حزمة الإقفال ثم أقفله من المحاسبة ← الإقفال الشهري، حتى لا تتغير أرقامه\.$/, '$1 days since it ended — review the close pack, then lock it from Accounting ← Monthly close so its figures cannot change.'],
  [/^أوامر شراء مقترحة جاهزة — (\d+)$/, 'Suggested purchase orders ready — $1'],
  [/^(.+) — من الموردين ← أوامر الشراء\.$/, '$1 — from Suppliers ← Purchase orders.'],
  [/^رُحّل استحقاق رواتب (\S+) تلقائيًا — (\d+) موظف · (.+) ر\.س ✓$/, 'Payroll accrual for $1 posted automatically — $2 employees · $3 SAR ✓']
];
