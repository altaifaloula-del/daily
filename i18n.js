/* v43.0 — الواجهة الإنجليزية (LTR) — المرحلة الأولى: البنية + الإطار
   اللغة تفضيل محلي لكل جهاز (rms8:lang). TX(نص عربي) يعيد ترجمته متى كانت الواجهة إنجليزية وله مدخل في القاموس،
   وإلا يعيد النص العربي كما هو (فالشاشات التي لم تُترجم بعد تبقى عربية حتى تُضاف تباعًا).
   المطبوعات الرسمية (الفواتير والإقرارات والتقارير الرسمية) تبقى عربية. */
let LANG = (() => { try { return localStorage.getItem('rms8:lang') === 'en' ? 'en' : 'ar'; } catch { return 'ar'; } })();
export const getLang = () => LANG;
export const isEn = () => LANG === 'en';
export function setLangGlobal(l) {
  LANG = l === 'en' ? 'en' : 'ar';
  try { localStorage.setItem('rms8:lang', LANG); } catch { }
  try { document.documentElement.lang = LANG; document.documentElement.dir = LANG === 'en' ? 'ltr' : 'rtl'; } catch { }
}
export const EN = {
  // ===== الإطار والتنقل =====
  'الرئيسية': 'Home', 'الإدارة المالية والتشغيلية': 'Finance & Operations', 'الموارد والرقابة': 'People & Control', 'التشغيل اليومي': 'Daily operations',
  'التحليل والتنبيهات': 'Analytics & Alerts', 'مركز التنبيهات': 'Alerts Center', 'مركز التقارير': 'Reports Center', 'المبيعات': 'Sales', 'نقطة البيع': 'Point of Sale',
  'الإغلاق اليومي والاعتماد': 'Daily Closing & Approvals', 'مواعيد الإغلاق والتذكيرات': 'Closing Deadlines', 'الموارد البشرية — التشغيل': 'HR Operations', 'الأداء والانضباط': 'Performance & Discipline',
  'تقييم العملاء (QR)': 'QR Customer Feedback', 'إدارة التطبيقات': 'App Management', 'التدقيق والاعتماد': 'Audit & Approval', 'الخزينة والترحيل': 'Treasury', 'شؤون الموظفين': 'Personnel',
  'المشتريات': 'Purchasing', 'المخزون والمنتجات': 'Inventory & Products', 'مستودع الفرع': 'Branch Warehouse', 'جهات الاتصال': 'Contacts', 'المالية والمحاسبة': 'Finance & Accounting',
  'المستندات والأرشيف': 'Documents & Archive', 'أرشيف المستندات': 'Document Archive', 'مركز المنشآت': 'Entities', 'الإعدادات والمستخدمون': 'Settings & Users', 'سجل التدقيق': 'Audit Log',
  'الموارد البشرية': 'Human Resources', 'كل التطبيقات': 'All apps', 'تثبيت التطبيق على الجهاز': 'Install the app', 'جولة تعريفية في المنصة': 'Platform tour', 'تفريغ بيانات المنصة': 'Reset platform data',
  'طيّ القائمة': 'Collapse menu', 'توسيع القائمة': 'Expand menu', 'إظهار القائمة': 'Show menu', 'إخفاء القائمة': 'Hide menu', 'خروج': 'Sign out', 'تسجيل الخروج': 'Sign out',
  // ===== المراكز (Hubs) وأقسامها =====
  'مركز التحليل والأداء': 'Analytics & Performance', 'لوحاتك ومؤشراتك وتحليلاتك في مكان واحد': 'Your dashboards, KPIs and analyses in one place',
  'اللوحة التنفيذية': 'Executive Dashboard', 'لوحة المؤشرات': 'KPI Dashboard', 'مقارنة الفروع': 'Branch Comparison', 'تحليلات النمو': 'Growth Analytics', 'تحليل التعادل': 'Break-even Analysis',
  'لوحة الأهداف': 'Scorecard', 'ماذا-لو': 'What-if', 'المركز الذكي': 'Smart Center', 'التنبيهات': 'Alerts', 'الأنماط الشاذة': 'Anomalies', 'الإجراءات والتوصيات': 'Actions & Recommendations',
  'توقع المبيعات': 'Sales Forecast', 'ربحية الفروع اليومية': 'Daily Branch Profitability', 'هندسة القائمة': 'Menu Engineering', 'خطة التوفير': 'Savings Plan',
  'اللوحات': 'Dashboards', 'التحليل': 'Analysis', 'الربحية والتكلفة': 'Profitability & Cost', 'الرقابة والإجراءات': 'Control & Actions',
  'التقارير المالية والإدارية وبناؤها وتصديرها': 'Financial and management reports — build and export', 'التقارير المالية': 'Financial Reports', 'منشئ التقارير': 'Report Builder',
  'تقرير الإدارة الشهري': 'Monthly Management Report', 'التدفق النقدي (13 أسبوعًا)': 'Cash Flow (13 weeks)', 'التقارير': 'Reports',
  'الإغلاق اليومي': 'Daily Closing', 'إدخال الإغلاق ← التدقيق والاعتماد ← المواعيد والتذكيرات': 'Enter closing → audit & approval → deadlines & reminders',
  'المواعيد والتذكيرات': 'Deadlines & Reminders', 'سجل الكاشير': 'Cashier Log', 'إجراءات الفرع': 'Branch Actions', 'توقع مبيعات الفرع': 'Branch Sales Forecast', 'سجل سلامة الغذاء': 'Food Safety Log',
  'الجرد النقدي المفاجئ': 'Surprise Cash Count', 'صيانة المعدات': 'Equipment Maintenance', 'الإغلاق': 'Closing', 'المتابعة': 'Follow-up', 'الفرع': 'Branch',
  'القيود والقوائم والتسويات ← الخزينة والترحيل ← المنشآت': 'Entries, statements and reconciliations → treasury → entities', 'المحاسبة': 'Accounting', 'المنشآت': 'Entities',
  'مطابقة تسويات الشبكة': 'Card Settlement Reconciliation', 'ضبط حسابات الدفع': 'Payment Account Control', 'الرقابة المالية': 'Financial Control',
  'أوامر الشراء والاستلام وفواتير الموردين وإعادة الطلب — بطاقات الموردين في «جهات الاتصال»': 'Purchase orders, receiving, supplier invoices and reordering — supplier cards are in Contacts',
  'المشتريات والفواتير': 'Purchases & Invoices', 'المشتريات الذكية': 'Smart Purchasing', 'تقرير مشتريات الموردين': 'Supplier Purchases Report',
  'المستندات الرسمية والصادرة ← أرشيف الصور والمرفقات': 'Official and issued documents → photo and attachment archive', 'مركز المستندات': 'Documents Center', 'الأرشيف': 'Archive',
  'الحضور والورديات والإجازات · البيانات والرواتب والسلف · الأداء والتدريب والانضباط': 'Attendance, shifts and leave · records, payroll and advances · performance, training and discipline',
  'الحضور والورديات والمهام والنقاط والتوقيع الإلكتروني': 'Attendance, shifts, tasks, points and e-signature', 'الحضور الموثَّق': 'Verified Attendance', 'محرّك الورديات': 'Shift Engine',
  'المهام': 'Tasks', 'دفتر النقاط': 'Points Ledger', 'التوقيع الإلكتروني': 'E-signature', 'الإجازات': 'Leave',
  'البيانات الرئيسية والسياسات والرواتب والسلف وتخطيط العمالة': 'Master data, policies, payroll, advances and labor planning', 'البيانات الرئيسية': 'Master Data', 'ملف الموظف': 'Employee File',
  'السياسات والأدوار': 'Policies & Roles', 'الرواتب والسلف': 'Payroll & Advances', 'مسير الرواتب': 'Payroll Run', 'مسير الأجور الإضافية': 'Overtime Run', 'تخطيط العمالة والتكلفة': 'Labor Planning & Cost',
  'تخطيط العمالة من التوقع': 'Labor Planning from Forecast', 'التقييم ومؤشرات الدور والحوافز والإجراءات التصحيحية والتدريب وتجميد الأداء ولوحة HR': 'Appraisals, role KPIs, incentives, corrective actions, training, performance freeze and HR dashboard',
  'الأداء والتقييم': 'Performance & Appraisal', 'مؤشرات الأداء بالدور': 'Role KPIs', 'المكافآت والجزاءات': 'Rewards & Penalties', 'الإجراءات التصحيحية': 'Corrective Actions',
  'التدريب والشهادات': 'Training & Certificates', 'تجميد الأداء الشهري': 'Monthly Performance Freeze', 'لوحة الموارد البشرية': 'HR Dashboard',
  // ===== شاشة التطبيقات والرأس =====
  'ابحث عن تطبيق أو قسم… (جرّب: تعادل، رواتب، تدفق نقدي)': 'Search apps or sections… (try: break-even, payroll, cash flow)', 'صباح الخير يا': 'Good morning,', 'مساء الخير يا': 'Good evening,',
  'تطبيقًا': 'apps', 'المفضلة': 'Favorites', 'آخر استخدام': 'Recent', 'اللغة': 'Language', 'English': 'English', 'العربية': 'العربية',
  'ثيم المنصّة': 'Platform theme', 'أسلوب التصميم والوضع — فوريّ ومحفوظ': 'Design style and mode — instant and saved', '🌞 نهار': '🌞 Light', '🌙 ليل': '🌙 Dark',
  'الشركة:': 'Company:', 'الرقم الضريبي:': 'VAT No.:', 'فروعك:': 'Your branches:', 'إغلاقاتك المسجلة:': 'Your closings:', 'مزامنة دورية': 'Periodic sync', 'متصل الآن': 'online now',
  'كل الأقسام': 'All sections', 'تحديث للأحدث': 'Update to latest', 'مزامنة لحظية': 'Live sync', 'الأقسام': 'Sections',
  'قوائم': 'Menus', 'شبكة': 'Grid', 'منسدلة': 'Dropdown', 'تبويبات': 'Tabs', 'البصمة / بصمة الوجه لهذا الجهاز': 'Fingerprint / Face ID on this device',
  'حسابي': 'My account', 'الإعدادات': 'Settings', 'الإشعارات': 'Notifications'
};

// ===== v43.1 نقطة البيع =====
Object.assign(EN, {
  'نقطة البيع — تجربة': 'Point of Sale — pilot', 'أقسام نقطة البيع': 'POS sections', 'البيع': 'Sell', 'الفواتير': 'Invoices', 'الورديات والتقارير': 'Shifts & Reports', 'الطاولات': 'Tables', 'المطبخ': 'Kitchen',
  'المزيد…': 'More…', 'المزيد': 'More', 'الإعدادات': 'Settings', 'تشخيص': 'Diagnostics', 'إخفاء التشخيص': 'Hide diagnostics', 'تشخيص وإصلاح مشكلة الحفظ': 'Diagnose and fix saving issues',
  'بحث عن صنف…': 'Search item…', 'بحث': 'Search', 'الكل': 'All', 'الأصناف': 'Items', 'اضغط الأصناف لإضافتها': 'Tap items to add them', 'إضافة/تسعير أصناف': 'Add / price items',
  'سفري': 'Takeaway', 'محلي': 'Dine-in', 'توصيل': 'Delivery', 'تطبيق': 'App', 'تطبيق توصيل': 'Delivery app', 'تطبيقات التوصيل': 'Delivery apps', 'نوع الطلب': 'Order type',
  'طاولة': 'Table', 'الطاولة': 'Table', 'اختر الطاولة أولًا': 'Choose a table first', 'اختر الطاولة للإرسال للمطبخ': 'Choose a table to send to the kitchen', '— اختر —': '— Choose —',
  '+ خصم': '+ Discount', '+ عميل ولاء': '+ Loyalty customer', '+ كوبون': '+ Coupon', '+ ملاحظة': '+ Note', 'بدون بصل، حار…': 'No onion, spicy…',
  'الإجمالي': 'Total', 'الإجمالي (شامل الضريبة)': 'Total (VAT incl.)', 'قبل الخصم': 'Before discount', 'منها ضريبة': 'incl. VAT', 'الخصم': 'Discount', 'خصم': 'Discount', 'خصم يدوي': 'Manual discount',
  'سبب الخصم': 'Discount reason', 'اكتب سبب الخصم': 'Enter the discount reason', 'إلزامي': 'Required', 'الخصم اليدوي يتجاوز الحد المسموح للكاشير (': 'Manual discount exceeds the cashier limit (', '%) — يلزم مدير الفرع': '%) — branch manager required',
  'رمز الكوبون': 'Coupon code', 'كوبون ✓': 'Coupon ✓', '✓ الكوبون فعّال': '✓ Coupon applied', 'رمز غير صالح أو العرض غير متاح الآن': 'Invalid code or offer not available now', 'العروض': 'Offers',
  'الولاء': 'Loyalty', 'عميل': 'Customer', 'عميل جديد': 'New customer', 'اسم العميل (جديد)': 'Customer name (new)', 'جوال العميل': 'Customer mobile', 'رقم جوال العميل غير صحيح': 'Invalid customer mobile number',
  'الرصيد': 'Balance', 'نقطة': 'pts', 'يكسب': 'earns', 'الرصيد يتطلب اتصالًا — النقاط المكتسبة تُحفظ وتُرسل لاحقًا': 'Balance needs a connection — earned points are saved and sent later',
  'عرض الطلب والدفع': 'View order & pay', 'إفراغ': 'Clear', 'إفراغ الطلب؟': 'Clear the order?', 'إنقاص': 'Decrease', 'زيادة': 'Increase', '(زيادة)': '(over)', '(عجز)': '(short)', '(مطابق)': '(matched)',
  'الدفع': 'Payment', 'الدفع —': 'Payment —', 'نوع السداد': 'Payment type', 'الطريقة': 'Method', 'المبلغ': 'Amount', 'نقدي': 'Cash', 'شبكة': 'Card', 'شبكة (مدى/بطاقة)': 'Card (mada/credit)', 'تحويل': 'Transfer', 'تحويل بنكي': 'Bank transfer', 'أخرى': 'Other',
  'إضافة دفعة:': 'Add payment:', 'تقسيم': 'Split', 'حذف هذه الدفعة': 'Remove this payment', 'المتبقي': 'Remaining', 'الباقي': 'Change', 'الباقي للعميل': 'Change due', 'الباقي لا يُرد إلا من النقد': 'Change can only be given from cash',
  'مكتمل — لا باقٍ': 'Complete — no change', 'المدفوع أقل من الإجمالي': 'Paid amount is less than the total', 'تأكيد': 'Confirm', 'تأكيد وطباعة': 'Confirm & print', 'بلا طباعة': 'No print', 'إلغاء': 'Cancel', 'إلغاء الدفع': 'Cancel payment',
  'آخر فاتورة:': 'Last invoice:', 'بـ': 'for', 'إعادة طباعة': 'Reprint', 'إعادة الطباعة': 'Reprint', 'فاتورة': 'invoices', 'فواتير': 'Invoices', 'الفاتورة': 'Invoice', 'رقم الفاتورة': 'Invoice No.',
  'رقم الفاتورة، صنف، جوال عميل': 'Invoice no., item, customer mobile', 'التاريخ': 'Date', 'الوقت': 'Time', 'الحالة': 'Status', 'الكاشير': 'Cashier', 'الفرع': 'Branch', 'التطبيق': 'App',
  'مدفوعة': 'Paid', 'الملغاة': 'Voided', 'ملغاة:': 'Voided:', 'لا فواتير بهذه التصفية.': 'No invoices match this filter.', 'لا نتائج.': 'No results.', 'لا شيء': 'Nothing',
  'سبب إلغاء الفاتورة': 'Void reason', 'إلغاء الفاتورة لمدير الفرع': 'Voiding is for the branch manager', 'أُلغيت الفاتورة': 'Invoice voided', 'إغلاق هذا اليوم مُرحّل — لا تُلغى فواتيره': "This day's closing is posted — its invoices cannot be voided",
  'انتظر إرسال الفاتورة أولًا': 'Wait for the invoice to be sent first', 'نُزّل سجل الفواتير (Excel) ✓': 'Invoice log downloaded (Excel) ✓', 'تعذّر التصدير': 'Export failed',
  'فاتورة مبدئية — ليست فاتورة ضريبية': 'Pro-forma — not a tax invoice',
  'الوردية': 'Shift', 'وردية': 'Shift', 'فتح الوردية': 'Open shift', 'فتح وردية نقطة البيع': 'Open POS shift', 'افتح الوردية للبدء': 'Open the shift to start', 'النقد الافتتاحي في الدرج': 'Opening cash in drawer',
  'فُتحت الوردية ✓': 'Shift opened ✓', 'مفتوحة منذ': 'Open since', '(مفتوحة ·': '(open ·', 'افتتاحي': 'Opening', '· افتتاحي': '· opening', '· الوردية منذ': '· shift since', '· لا وردية مفتوحة': '· no open shift',
  'لا وردية مفتوحة على هذا الجهاز — افتحها من «البيع».': 'No open shift on this device — open it from Sell.', 'إغلاق الوردية وطباعة التقرير': 'Close shift & print report', 'النقد المعدود فعلًا': 'Cash actually counted',
  'الفرق:': 'Difference:', 'الفرق': 'Difference', '· متوقع': '· expected', '· فعلي': '· actual', '· فرق': '· diff', 'أُغلقت الوردية — الفرق': 'Shift closed — difference', 'أُغلقت الوردية على الجهاز — الفرق': 'Shift closed on device — difference', 'الوردية نفسها': 'Same shift',
  'متاحة': 'Free', 'مشغولة': 'Busy', 'جولة': 'rounds', 'دقيقة': 'min', 'إضافة طلب': 'Add order', 'طباعة الحساب': 'Print bill', 'الحساب مطبوع': 'Bill printed', 'دفع حساب الطاولة': 'Pay table bill',
  'نقل الطاولة': 'Move table', 'نقل إلى طاولة': 'Move to table', 'نقل إلى طاولة…': 'Move to table…', 'نُقل الحساب إلى الطاولة': 'Bill moved to table', 'إرسال للمطبخ — الطاولة': 'Send to kitchen — table',
  'أرسل طلب الطاولة': 'Sent the table order', 'أُرسل طلب الطاولة': 'Table order sent', 'للمطبخ': 'to kitchen', 'أنت في دفع حساب طاولة — أكمل الدفع أو ألغه': 'You are paying a table bill — finish or cancel it',
  'دُفعت الفاتورة، لكن تعذّر إغلاق حساب الطاولة الآن — أغلقه من «الطاولات» عند عودة الاتصال': 'Invoice paid, but the table bill could not be closed now — close it from Tables when back online',
  'دُفعت الفاتورة، لكن لم تصل لشاشة المطبخ (لا اتصال) — أبلغ المطبخ يدويًا': 'Invoice paid, but it did not reach the kitchen screen (offline) — tell the kitchen manually',
  'ابدأ التحضير': 'Start preparing', 'جاهز': 'Ready', 'تم التسليم': 'Delivered', 'جديد': 'New', 'قيد التحضير': 'Preparing', 'سُلّم': 'Served',
  'إرسال الآن': 'Send now', 'جارٍ الإرسال…': 'Sending…', 'لم تُرسل بعد': 'Not sent yet', 'متزامن ✓': 'Synced ✓', 'أُرسل كل شيء للسحابة ✓': 'Everything sent to the cloud ✓', 'أُرسل': 'Sent', 'تحقق من الاتصال': 'Check the connection',
  '· تُرسل تلقائيًا': '· sent automatically', '· المحاولة التالية': '· next attempt', 'سبب تأخر الإرسال:': 'Why sending is delayed:', 'لم يكتمل الإرسال (': 'Sending incomplete (', 'توجد بيانات لم تصل للسحابة بعد (': 'Some data has not reached the cloud yet (',
  'نفدت حصة الكتابة اليومية في Firestore — تتجدد 11:00 صباحًا بتوقيت السعودية، والبيانات محفوظة على الجهاز': 'Daily Firestore write quota exhausted — resets at 11:00 AM KSA time; data is saved on the device',
  'فعّلها لفرع التجربة من الإعدادات أدناه.': 'Enable it for the pilot branch in the settings below.', 'يفعّلها مسؤول النظام لفرع التجربة.': 'The system admin enables it for the pilot branch.',
  'الطلب الحالي': 'Current order', 'منها ضريبة القيمة المضافة': 'incl. VAT', 'الطاولات': 'Tables',
  'خطأ': 'Error', 'إغلاق': 'Close', 'إلى': 'to', 'بقي': 'left', 'ر.س': 'SAR', 'المستند المركزي': 'Central document'
});
export const TX = (ar) => (LANG === 'en' && ar && EN[ar]) || ar;

/* v43.1 مترجم الشاشة: في الوضع الإنجليزي يترجم نصوص الواجهة (عُقد النص + placeholder/title/aria-label) بمطابقة القاموس حرفيًا،
   فلا يمسّ بيانات المستخدم (أسماء الأصناف والعملاء) إلا إن طابقت مدخلًا بالكامل، ولا الحقول ولا ما عليه data-noi18n ولا المطبوعات (نوافذ مستقلة). */
const AFFIX = /^([\s·—(]*)(.*?)([\s:،)·—]*)$/s;
// نصوص فيها أرقام/قيم متغيرة: [نمط، بديل]
export const EN_RX = [
  [/^(\s*·?\s*)الوردية منذ (.+)$/s, '$1shift since $2'], [/^طاولة (\S+)$/, 'Table $1'], [/^(\d+) فاتورة$/, '$1 invoices'], [/^(\d+) جولة$/, '$1 rounds'], [/^(\d+) دقيقة$/, '$1 min']
];
export function trWord(t) {
  if (!t || !/[؀-ۿ]/.test(t)) return null;
  const k = t.trim(); if (EN[k]) return t.replace(k, EN[k]);
  const m = AFFIX.exec(t); if (m && m[2] && EN[m[2]]) return m[1] + EN[m[2]] + m[3];
  for (const [re, to] of EN_RX) if (re.test(t)) return t.replace(re, to);
  return null;
}
const SKIP = 'script,style,textarea,input,[contenteditable],[data-noi18n]';
const ATTRS = ['placeholder', 'title', 'aria-label'];
function trNode(n) {
  if (n.nodeType === 3) { const p = n.parentElement; if (!p || p.closest(SKIP)) return; const v = trWord(n.nodeValue); if (v != null && v !== n.nodeValue) n.nodeValue = v; return; }
  if (n.nodeType !== 1 || n.closest(SKIP)) return;
  const els = [n, ...n.querySelectorAll('[placeholder],[title],[aria-label]')];
  for (const e of els) for (const a of ATTRS) { const v = e.getAttribute(a); const t = v && trWord(v); if (t && t !== v) e.setAttribute(a, t); }
  const w = document.createTreeWalker(n, 4); let x; const list = []; while ((x = w.nextNode())) list.push(x); list.forEach(trNode);
}
let OBS = null;
export function domI18n(on) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (OBS) { OBS.disconnect(); OBS = null; }
  if (!on) return;
  trNode(document.body);
  OBS = new MutationObserver(ms => { for (const m of ms) {
    if (m.type === 'characterData') trNode(m.target);
    else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); const t = v && trWord(v); if (t && t !== v && !m.target.closest(SKIP)) m.target.setAttribute(m.attributeName, t); }
    else m.addedNodes.forEach(trNode);
  } });
  OBS.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
