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

// ===== v43.2 الإغلاق اليومي والتدقيق والاعتماد =====
Object.assign(EN, {
  'إغلاق وردية': 'Shift closing', 'إغلاق وردية جديد': 'New shift closing', 'إغلاق جديد': 'New closing', 'فتح نموذج إغلاق وردية جديد': 'Open a new shift-closing form', 'تعديل إغلاق وردية': 'Edit shift closing',
  'خطوات الإغلاق': 'Closing steps', 'الفرع والتاريخ + العهدة والنقدي': 'Branch & date + float & cash', 'النقد والمبيعات': 'Cash & sales', 'المصروفات والموردون': 'Expenses & suppliers', 'التوثيق والترحيل': 'Documentation & posting', 'النقد والترحيل': 'Cash & posting',
  'اختر الفرع': 'Choose branch', 'اختر الفرع أولاً': 'Choose a branch first', 'تاريخ الوردية': 'Shift date', 'رصيد بداية الوردية': 'Shift opening balance', 'العهدة الافتتاحية': 'Opening float',
  'مبيعات نقدية': 'Cash sales', 'مبيعات نقدية (كاش)': 'Cash sales', 'مبيعات الشبكة': 'Card sales', 'مبيعات الشبكة — إجمالي الجهاز': 'Card sales — terminal total', 'شبكة (نقاط بيع)': 'Card (POS terminals)', 'مبيعات تحويل بنكي مباشر': 'Direct bank-transfer sales',
  'مبيعات تطبيقات التوصيل': 'Delivery-app sales', 'مبيعات التطبيق · يقبل عدة مبالغ': 'App sales · accepts several amounts', 'هنقرستيشن · كيتا · جاهز': 'HungerStation · Keeta · Jahez', 'إضافة تطبيق': 'Add app', 'اسم التطبيق': 'App name', 'تطبيقات': 'Apps',
  'عدد الطلبات': 'Orders', 'عمولة': 'Commission', 'تعبئة من نقطة البيع': 'Fill from POS', 'عُبّئ ✓': 'Filled ✓', 'مبيعات مستوردة من نقطة البيع': 'Sales imported from POS', 'المبيعات مطابقة لنقطة البيع': 'Sales match the POS', 'فرق عن نقطة البيع —': 'Difference from POS —',
  'إجمالي إيراد الوردية': 'Total shift revenue', 'الإيراد': 'Revenue', 'الإيرادات': 'Revenue', 'المبيعات': 'Sales', 'صافي اليوم': 'Net for the day',
  'الشبكة والتحويل': 'Card & transfer', 'مدى/فيزا + تحويل بنكي مباشر': 'mada/Visa + direct bank transfer', 'تقسيم الشبكة حسب نوع البطاقة (من تقرير الجهاز)': 'Card split by card type (from terminal report)', 'تقسيم الشبكة (': 'Card split (',
  'مدى': 'mada', 'فيزا': 'Visa', 'ماستركارد': 'Mastercard', 'تقسيم الشبكة لا يساوي إجمالي الجهاز': 'Card split does not equal the terminal total', '≠ إجمالي الجهاز': '≠ terminal total', '✓ المجموع': '✓ Total',
  'الشبكة غير مقسّمة إلى مدى/فيزا/ماستركارد': 'Card not split into mada/Visa/Mastercard', 'لم تُقسَّم بعد — رسوم البطاقات في الربحية لا تُحسب ليوم غير مقسّم': 'Not split yet — card fees are not counted in profitability for an unsplit day',
  'إثبات': 'Proof', 'إثبات الشبكة / التحويل': 'Card / transfer proof', 'إثبات تحصيل الشبكة / التحويل': 'Proof of card / transfer collection', 'إثبات شبكة/تحويل': 'Card/transfer proof', 'إثبات تسوية الشبكة مرفق': 'Card settlement proof attached', 'إثبات تسوية الشبكة غير مرفق': 'Card settlement proof not attached',
  'صورة إشعار الشبكة أو سند التحويل — اختياري لكنه يوثّق المبلغ': 'Card slip or transfer receipt photo — optional but documents the amount', 'مرجع التحويل': 'Transfer reference',
  'مصروفات ومسحوبات الوردية': 'Shift expenses & withdrawals', 'مسحوبات ومشتريات الوردية': 'Shift withdrawals & purchases', 'المصروفات والمشتريات': 'Expenses & purchases', 'المصروفات': 'Expenses', 'المصروف': 'Expense', 'مصروف': 'Expense',
  'إضافة مصروف': 'Add expense', 'بند المصروف': 'Expense item', 'مثال: مواد خام': 'e.g. raw materials', 'لا مصروفات': 'No expenses', 'لا توجد مصروفات مسجلة على هذه الوردية.': 'No expenses recorded for this shift.', 'إجمالي المصروفات': 'Total expenses',
  'المستفيد / المورد': 'Payee / supplier', 'اسم الجهة': 'Party name', 'اسم المورد': 'Supplier name', 'اسم المورد/الموظف/العميل': 'Supplier/employee/customer name', 'مورد': 'Supplier', 'موظف': 'Employee', 'عميل': 'Customer', 'غير ذلك': 'Other',
  'طريقة الدفع': 'Payment method', 'نقداً من الصندوق': 'Cash from drawer', 'نقد': 'Cash', 'نقدًا': 'Cash', 'آجل': 'Credit', 'آجل (على الحساب)': 'Credit (on account)', 'آجل — على الحساب': 'Credit — on account', 'شيك': 'Cheque', 'رقم الشيك': 'Cheque No.',
  'التصنيف': 'Category', 'التصنيف الضريبي': 'Tax category', 'خاضع للضريبة': 'Taxable', 'غير خاضع': 'Non-taxable', 'غير خاضع للضريبة': 'Non-taxable', 'نوع الفاتورة': 'Invoice type', 'فاتورة ضريبية': 'Tax invoice', 'ضريبية': 'Tax', 'مبسّطة': 'Simplified',
  'ض.ق.م القابلة للخصم': 'Deductible VAT', 'رقم فاتورة/سند': 'Invoice/voucher No.', 'المرجع / الفاتورة (اختياري)': 'Reference / invoice (optional)', 'رقم الإيصال': 'Receipt No.', 'إيصال': 'Receipt', 'فاتورة مصروف': 'Expense invoice', 'فاتورة': 'Invoice',
  'صورة الفاتورة / الإيصال (كاميرا · صورة · PDF)': 'Invoice / receipt photo (camera · image · PDF)', 'مشتريات خاضعة للضريبة': 'Taxable purchases', 'مشتريات غير خاضعة': 'Non-taxable purchases', 'مشتريات آجلة (ذمم)': 'Credit purchases (payables)', 'تحليل المشتريات': 'Purchases analysis',
  'سداد الموردين': 'Supplier payments', 'سداد الموردين خلال الوردية': 'Supplier payments during the shift', 'إضافة دفعة سداد مورد': 'Add supplier payment', 'إجمالي سداد الموردين': 'Total supplier payments', 'إجمالي هذه الدفعة': 'This payment total', 'دفعات نقد/شبكة/تحويل للموردين': 'Cash/card/transfer payments to suppliers',
  'سجّل دفعات سداد الموردين — تُخصم الدفعة النقدية من الصندoق وتظهر في كشف حساب المورد بالرئيسي.': 'Record supplier payments — cash payments are deducted from the drawer and appear in the supplier statement at head office.',
  'وزّع السداد على طرق الدفع (يمكن الجمع بينها لنفس الفاتورة)': 'Split the payment across methods (they can be combined for one invoice)', '— اختر المورد من الرئيسي —': '— Choose supplier from head office —',
  '— اربط السداد بفاتورة مفتوحة (اختياري — يمنع الازدواج مع سداد الرئيسي) —': '— Link to an open invoice (optional — prevents double payment with head office) —', '— اربطه بشريك في الرئيسي (اختياري) —': '— Link to a head-office partner (optional) —',
  'إضافة شريك جديد إلى الرئيسي': 'Add new partner to head office', 'إضافة شريك جديد إلى دفتر الفرع': 'Add new partner to the branch ledger', 'اكتب اسم الشريك': 'Enter the partner name', 'إضافة وربط فورًا': 'Add & link now', 'حفظ وربط': 'Save & link',
  'لا تملك صلاحية الإضافة للرئيسي': 'You are not allowed to add to head office', 'أُضيف إلى دفتر الشركاء بالرئيسي ✓': 'Added to the head-office partner ledger ✓', 'الجوال': 'Mobile', 'الاسم': 'Name', 'المسمى الوظيفي': 'Job title',
  'يُسجَّل مباشرةً في الإدارة الرئيسية (دفتر الشركاء) ويُربط بهذا السطر — فيظهر في كشف حسابه.': 'Recorded directly at head office (partner ledger) and linked to this line — it appears in their statement.',
  'جرد الصندوق': 'Cash count', 'جرد الفئات النقدية': 'Denomination count', 'جرد الفئات النقدية — عدّ الصندوق فعلياً': 'Denomination count — physically count the drawer', 'عدّ الفئات النقدية فعليًّا': 'Physically count the denominations', 'ريال': 'SAR', 'هللات': 'Halalas', 'قطع × 0.50': 'pcs × 0.50', 'عدد': 'Qty',
  'المبلغ المعدود بالصندوق': 'Amount counted in drawer', 'العدّ الفعلي': 'Actual count', 'المتوقع بالصندوق': 'Expected in drawer', 'المتوقع': 'Expected', 'الفعلي': 'Actual', 'الفرق': 'Difference', 'الفرق (الفعلي − المتوقع)': 'Difference (actual − expected)', 'المجموع': 'Total',
  'أُجري الجرد والصندوق فارغ فعلًا (0.00)': 'Counted — the drawer is actually empty (0.00)', 'جرد الصندوق لم يكتمل': 'Cash count not completed', 'أكمل جرد الصندوق (الخطوة 3) لحساب الفرق': 'Complete the cash count (step 3) to compute the difference', 'بانتظار الجرد': 'Awaiting count',
  'الصندوق متوازن': 'Drawer balanced', 'الصندوق مطابق تماماً': 'Drawer matches exactly', 'الصندوق مطابق للمتوقع': 'Drawer matches expected', 'الصندوق مطابق — لا يوجد ما يمنع الترحيل': 'Drawer matches — nothing blocks posting', 'لا فروقات — يمكن الترحيل مباشرة': 'No differences — you can post directly',
  'عجز': 'Shortage', 'فائض': 'Surplus', 'عجز نقدي': 'Cash shortage', 'فائض نقدي': 'Cash surplus', 'عجز نقدي يستوجب التبرير': 'Cash shortage requires a reason', 'فائض نقدي غير مبرر': 'Unexplained cash surplus', 'سبب العجز أو الفائض (إلزامي)': 'Reason for shortage or surplus (required)',
  'وثّق سبب العجز أو الفائض قبل الترحيل': 'Document the reason for the shortage or surplus before posting', 'مثال: باقي عميل لم يُستلم / خطأ في إدخال فاتورة': 'e.g. customer change not collected / invoice entry error', '— موثّق السبب': '— reason documented',
  'المخصوم نقداً من الصندوق': 'Paid in cash from drawer', 'الإجمالي — منه نقدًا من الصندوق': 'Total — of which cash from drawer', 'محسوب آلياً': 'Auto-calculated',
  'وجهة نقد اليوم للخزينة الرئيسية': "Today's cash destination to main treasury", 'ماذا تريد أن تفعل بنقد اليوم؟': "What do you want to do with today's cash?", 'ترحيل الكل للخزينة': 'Post all to treasury', 'ترحيل الفائض وإبقاء عهدة': 'Post the excess and keep a float', 'إبقاء الكل عهدة بالفرع': 'Keep all as branch float',
  'المرحّل للخزينة': 'Posted to treasury', 'المرحّل للخزينة الرئيسية': 'Posted to main treasury', 'المتبقي كعهدة للغد': "Remaining as tomorrow's float", 'عهدة الغد': "Tomorrow's float", 'المرحّل للخزينة يتجاوز النقد المعدود': 'Amount posted to treasury exceeds the counted cash', 'مطابقة النقدية وترحيلها للخزينة الرئيسية': 'Match cash and post it to the main treasury', '0 للخزينة': '0 to treasury',
  'التوثيق والملاحظات': 'Documentation & notes', 'ملاحظات · توقيع · صور التوثيق': 'Notes · signature · documentation photos', 'ملاحظات الإغلاق': 'Closing notes', 'ملاحظات المدير على الوردية': "Manager's notes on the shift", 'توقيع': 'Signature', 'توقيع المسؤول': "Supervisor's signature", 'توقيع المسؤول الرقمي': "Supervisor's digital signature",
  'توثيق': 'Documentation', 'توثيق المسؤول': 'Supervisor documentation', 'صورة توثيق': 'Documentation photo', 'صورة توثيق المسؤول مطلوبة': 'Supervisor documentation photo required', 'التقط صورة توثيق المسؤول قبل الترحيل — إجباري': 'Take the supervisor documentation photo before posting — required',
  'صور توثيق المسؤول (إجباري قبل الترحيل — يمكن التقاط أكثر من صورة)': 'Supervisor documentation photos (required before posting — more than one allowed)', 'صور توثيق الوردية (اختيارية للكاشير — يمكن التقاط أكثر من صورة)': 'Shift documentation photos (optional for the cashier — more than one allowed)',
  'التقاط صورة بالكاميرا': 'Take a photo', 'التقاط صورة إضافية': 'Take another photo', 'إزالة هذه الصورة': 'Remove this photo', 'تم التوثيق': 'Documented', 'صور موثّقة': 'Documented photos', 'معاينة الصورة': 'Photo preview', 'معاينة مكبّرة': 'Enlarged preview', 'اضغط في أي مكان للإغلاق': 'Tap anywhere to close', 'إغلاق المعاينة': 'Close preview',
  'ملخّص النظام · حيّ': 'System summary · live', 'الملخّص ▾': 'Summary ▾', 'الملخّص وفحوص المدقق تتحدّث فورًا مع كل إدخال': 'The summary and audit checks update instantly with every entry', 'فحوص المدقق قبل الترحيل': 'Pre-posting audit checks', 'كل مصروف له جهة وإيصال': 'Every expense has a party and a receipt',
  'مصروف بلا جهة (مورد/مستفيد)': 'Expense without a party (supplier/payee)', 'مصروف بلا صورة إيصال': 'Expense without a receipt photo', 'لا مبيعات مُدخلة لهذه الوردية': 'No sales entered for this shift', 'غير معتاد': 'Unusual', 'أعلى': 'higher', 'أقل': 'lower',
  'حفظ كمسودة': 'Save as draft', 'حفظ كمسودة ليراجعها الكاشير': 'Save as draft for the cashier to review', 'تم حفظ المسودة': 'Draft saved', 'ترحيل الإغلاق': 'Post closing', 'ترحيل موقّع': 'Signed posting', 'ترحيل بلا توقيع': 'Posting without signature', 'إتمام وترحيل إغلاق وردية': 'Complete and post shift closing',
  'تم إغلاق الوردية': 'Shift closed', 'تم إغلاق الوردية بنجاح ✓': 'Shift closed successfully ✓', 'حُفظ الإغلاق وقيد التدقيق والطباعة. يمكنك بدء وردية جديدة مباشرة أو العودة للقائمة.': 'The closing is saved and queued for audit and printing. You can start a new shift right away or return to the list.',
  'بدء وردية جديدة': 'Start a new shift', 'العودة للقائمة': 'Back to list', 'أدخل مبيعات الوردية قبل الحفظ': 'Enter the shift sales before saving',
  'يوجد إغلاق مسجّل لهذا الفرع بنفس التاريخ — عدّل الإغلاق القائم بدل إنشاء نسخة ثانية': 'A closing already exists for this branch on this date — edit it instead of creating a second one',
  'أكمل جرد الفئات النقدية قبل الترحيل — وإن كان الصندوق فارغًا فعلًا فعلّم «الصندوق فارغ» في قسم الجرد': 'Complete the denomination count before posting — if the drawer is really empty, tick "drawer empty" in the count section',
  'رقم الإغلاق': 'Closing No.', 'الحالة': 'Status', 'كل الحالات': 'All statuses', 'كل الفروع': 'All branches', 'من تاريخ': 'From date', 'إلى تاريخ': 'To date', 'بحث سريع...': 'Quick search...', 'مسح كل الفلاتر': 'Clear all filters', 'لا نتائج مطابقة لبحثك.': 'No results match your search.',
  'لا توجد إغلاقات ضمن نطاقك بعد.': 'No closings in your scope yet.', 'توسيع الكل': 'Expand all', 'طيّ الكل': 'Collapse all', 'تفاصيل': 'Details', 'تعديل': 'Edit', 'حذف': 'Delete', 'تصحيح': 'Correct', 'إرجاع': 'Return', 'جديد': 'New', 'جاهز': 'Ready',
  'مسودة': 'Draft', 'مرحّل للمراجعة': 'Submitted for review', 'مُرحّل': 'Posted', 'المرحّل': 'Posted', 'مرفوض': 'Rejected', 'مدقّق ومعتمد': 'Audited & approved', 'معتمد من الإدارة العليا': 'Approved by senior management', 'خارج صلاحيتك': 'Outside your permissions',
  'بانتظار التدقيق المالي': 'Awaiting financial audit', 'بانتظار الاعتماد النهائي': 'Awaiting final approval', 'التدقيق': 'Audit', 'الاعتماد النهائي': 'Final approval', 'الرفض': 'Rejection', 'الترحيل للخزينة': 'Treasury posting',
  'المرحلة 1: تدقيق مالي': 'Stage 1: financial audit', 'المرحلة 2: اعتماد نهائي': 'Stage 2: final approval', 'اعتماد التدقيق': 'Approve audit', 'اعتماد نهائي': 'Final approval', 'اعتماد نهائي من الإدارة العليا': 'Final approval by senior management',
  'ملاحظة التدقيق أو سبب الإرجاع': 'Audit note or return reason', 'اكتب سبب الرفض قبل الإرجاع': 'Enter the rejection reason before returning', 'تم الاعتماد بنجاح': 'Approved successfully', 'تم تدقيق الإغلاق': 'Closing audited', 'أُرجع الإغلاق للفرع مع السبب': 'Closing returned to the branch with the reason',
  'لا يوجد ما ينتظر إجراءك — كل الإغلاقات مدقّقة ومعتمدة.': 'Nothing awaits your action — all closings are audited and approved.', 'إغلاقات بها فروقات': 'Closings with differences', 'بلا سبب مكتوب': 'No written reason', '— السبب:': '— reason:',
  'تعديل كمسودة': 'Edit as draft', 'تعديل الإغلاق وإعادته مسودة ليراجعها الكاشير ويرحّله من جديد (للإدارة)': 'Edit the closing and return it as a draft for the cashier to review and re-post (management)',
  'أُعيد الإغلاق مسودةً وأُشعر الفرع — يراجعه الكاشير ويرحّله من جديد ✓': 'Closing returned to draft and the branch notified — the cashier reviews and re-posts it ✓',
  'حذف نهائي لإغلاق مُرحّل (تصفير)': 'Permanently delete a posted closing (reset)', 'حذف نهائي — تصفير هذا الإغلاق من كل السجلات والحسابات (للإدارة)': 'Permanent delete — reset this closing from all records and accounts (management)', 'تم حذف الإغلاق': 'Closing deleted',
  'حُذف الإغلاق نهائيًا — وأثره أُزيل من كل الحسابات والتقارير ✓': 'Closing permanently deleted — its effect was removed from all accounts and reports ✓',
  'تقرير PDF رسمي': 'Official PDF report', 'إيصال PDF': 'PDF receipt', 'طباعة حرارية 80مم': '80mm thermal print', 'وسيلة الإخراج': 'Output', 'حالة PDF': 'PDF status', '🔒 بصمة التقرير الرقمية:': '🔒 Report digital fingerprint:', 'سجل إتمام الإغلاق — قيد تدقيق غير قابل للتعديل': 'Closing completion record — immutable audit entry',
  'الجهاز / المتصفح': 'Device / browser', 'المستخدم': 'User', 'التاريخ': 'Date', 'النوع': 'Type', 'المبلغ': 'Amount', 'الإجمالي': 'Total', 'الفرع': 'Branch', 'اختياري': 'Optional', 'إلغاء': 'Cancel', 'إغلاق': 'Close',
  'اعتماد غير محمي': 'Unprotected approval', 'بلا سجل محمي': 'No protected record', 'لا يطابق التوقيع': 'Signature mismatch', 'أرقام السجل لا تطابق بصمة توقيع اعتماده': "The record's figures do not match its approval signature",
  'رُحّل بلا توقيع موثّق — يتعذّر تدقيقه حتى يُعاد ترحيله': 'Posted without a verified signature — cannot be audited until re-posted', 'لا سجل محمي لهذا الإغلاق بعد — شغّل «ترحيل الإغلاقات الحالية» من صيانة النظام': 'No protected record for this closing yet — run "migrate existing closings" from System Maintenance',
  'تعذّر عرض هذا المرفق': 'Cannot display this attachment', 'الملف المحفوظ تالف أو من نوع غير مدعوم للعرض. إن كان الإغلاق قديمًا فقد تجد نسخته في «أرشيف المستندات».': 'The saved file is damaged or of an unsupported type. If the closing is old, you may find its copy in the Document Archive.',
  '🗄 صور هذا الإغلاق في أرشيف المستندات': "🗄 This closing's photos are in the Document Archive", 'سياسة الاحتفاظ 60 يومًا': '60-day retention policy', '— تجدها مرتّبة بالفرع والتاريخ.': '— sorted by branch and date.',
  '🗄 صور هذا الإغلاق نُقلت إلى «أرشيف المستندات» (سياسة الاحتفاظ 60 يومًا) — تجدها هناك باسم الفرع وتاريخ اليوم.': "🗄 This closing's photos moved to the Document Archive (60-day retention) — find them under the branch name and date.",
  '— نقد': '— cash', '— نقدي': '— cash', '— شبكة وتحويل': '— card & transfer', '— توصيل': '— delivery', '— مدى / فيزا / ماستركارد': '— mada / Visa / Mastercard', '— تأكد من الرقم': '— check the number', 'نقطة البيع': 'Point of Sale', 'الإغلاق اليومي': 'Daily Closing'
});

// ===== v43.2 تكملة =====
Object.assign(EN, {
  'يمنع': 'blocks', '· يقبل عدة مبالغ': '· accepts several amounts', 'أضف مبلغًا': 'Add amount', 'هنقرستيشن': 'HungerStation', 'تويو': 'ToYou', 'مرسول': 'Mrsool', 'نينجا': 'Ninja', 'كيتا': 'Keeta', 'ذا شيفز': 'The Chefz',
  'كريم فود': 'Careem Food', 'نون فود': 'Noon Food', 'المتجر الخاص / طلب مباشر': 'Own store / direct order', '— رغم أن المتوقع': '— although expected is', '. سيُسجَّل الفرق كعجز ويلزم توثيق سببه قبل الترحيل.': '. The difference will be recorded as a shortage and its reason must be documented before posting.',
  'ر.س. اختر وجهته:': 'SAR. Choose its destination:', 'عهدة': 'Float', 'مسح التوقيع': 'Clear signature', 'وقّع بالإصبع أو الفأرة': 'Sign with finger or mouse', 'ترحيل للإدارة المالية': 'Post to finance',
  'مبلغ واحد، أو عدة مبالغ: 500+250 — أو زر «أضف مبلغًا»': 'One amount, or several: 500+250 — or the "Add amount" button', 'فلترة': 'Filter', 'سجّله': 'Recorded by',
  'أقسام التطبيق': 'App sections', 'طريقة عرض الأقسام': 'Section display mode', 'شريط قوائم': 'Menu bar', 'قائمة منسدلة': 'Dropdown list'
});
const MONTHS = { 'يناير': 'Jan', 'فبراير': 'Feb', 'مارس': 'Mar', 'أبريل': 'Apr', 'مايو': 'May', 'يونيو': 'Jun', 'يوليو': 'Jul', 'أغسطس': 'Aug', 'سبتمبر': 'Sep', 'أكتوبر': 'Oct', 'نوفمبر': 'Nov', 'ديسمبر': 'Dec' };
export const TX = (ar) => (LANG === 'en' && ar && EN[ar]) || ar;

/* v43.1 مترجم الشاشة: في الوضع الإنجليزي يترجم نصوص الواجهة (عُقد النص + placeholder/title/aria-label) بمطابقة القاموس حرفيًا،
   فلا يمسّ بيانات المستخدم (أسماء الأصناف والعملاء) إلا إن طابقت مدخلًا بالكامل، ولا الحقول ولا ما عليه data-noi18n ولا المطبوعات (نوافذ مستقلة). */
const AFFIX = /^([\s·—(]*)(.*?)([\s:،)·—]*)$/s;
// نصوص فيها أرقام/قيم متغيرة: [نمط، بديل]
export const EN_RX = [
  [/^(\s*·?\s*)الوردية منذ (.+)$/s, '$1shift since $2'], [/^طاولة (\S+)$/, 'Table $1'], [/^(\d+) فاتورة$/, '$1 invoices'], [/^(\d+) جولة$/, '$1 rounds'], [/^(\d+) دقيقة$/, '$1 min'], [/^ض\.ق\.م 15% ≈(.*)$/s, 'VAT 15% ≈$1'],
  [/^أقصى مبلغ متاح (.+) ر\.س — يمكنك تعديله يدوياً$/, 'Max available $1 SAR — you can edit it manually'],
  [/^(\d{1,2}) (يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر) (\d{4})$/, (_, d, m, y) => d + ' ' + MONTHS[m] + ' ' + y]
];
export function trWord(t) {
  if (!t || !/[؀-ۿ]/.test(t)) return null;
  const k = t.trim(); if (EN[k]) return t.replace(k, EN[k]);
  const m = AFFIX.exec(t); if (m && m[2] && EN[m[2]]) return m[1] + EN[m[2]] + m[3];
  for (const [re, to] of EN_RX) if (re.test(t)) return t.replace(re, to);
  // نص مركّب «أ · ب · ج»: تُترجم الأجزاء المعروفة ويبقى الباقي (أسماء الفروع مثلًا)
  if (t.includes(' · ')) { const ps = t.split(' · '); let hit = false; const out = ps.map(x => { const v = trWord(x); if (v != null) { hit = true; return v; } return x; }); if (hit) return out.join(' · '); }
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
