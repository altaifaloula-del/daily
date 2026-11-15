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

// ===== v43.3 المخزون والمنتجات =====
Object.assign(EN, {
  'الحركات': 'Movements', 'الجرد': 'Counts', 'المنتجات والوصفات': 'Products & recipes', 'المخزون': 'Inventory', 'المطبخ والوصفات': 'Kitchen & Recipes', 'الرقابة': 'Control', 'قيمة المخزون (بآخر تكلفة)': 'Stock value (last cost)', 'أصناف تحت حد الطلب': 'Items below reorder level', 'لا شيء — ممتاز': 'None — excellent',
  'حركات المخزون': 'Stock movements', 'توريد · صرف · هدر · جرد': 'Receipts · issues · waste · counts', 'منتجات بوصفات': 'Products with recipes', 'تكلفة وهامش لكل منتج': 'Cost and margin per product', 'طباعة الأرصدة': 'Print balances', 'استيراد من Excel': 'Import from Excel', 'نموذج': 'Template',
  'صنف جديد': 'New item', 'الصنف': 'Item', 'الوحدة': 'Unit', 'متوسط التكلفة': 'Average cost', 'القيمة': 'Value', 'استهلاكي': 'Consumable', 'جيد': 'Good', 'كجم': 'kg', 'جرام': 'g', 'لتر': 'L', 'حبة': 'pc', 'كرتون': 'carton',
  'حدود هذه المرحلة (بشفافية):': 'Limits of this phase (transparently):',
  'لا خصم تلقائي للمخزون مع البيع — النظام يسجّل إجماليات المبيعات لا أصنافها، فالاستهلاك يُسجَّل «صرفًا للتشغيل» أو عبر الجرد الدوري. التكلفة المعروضة بآخر سعر شراء، وتتحدّث تلقائيًا عند استلام أوامر الشراء. التقييم المحاسبي للمخزون (رسملة المشتريات وتكلفة المبيعات) قرار محاسبي يُبنى في مرحلة لاحقة — حاليًا تبقى المشتريات مصروفًا كما هي (طريقة الجرد الدوري المتعارفة للمطاعم).': 'No automatic stock deduction on sale — the system records sales totals, not items, so consumption is recorded as an operations issue or via periodic counts. Cost shown is the last purchase price and updates automatically when purchase orders are received. Accounting valuation of inventory (capitalizing purchases and cost of sales) is an accounting decision built in a later phase — purchases currently remain an expense (the periodic method common in restaurants).',
  'المستودعات': 'Warehouses', 'بانتظار إجراء المركز': 'Awaiting head-office action', 'صرف · اعتماد فرع←فرع · استلام إرجاع': 'Issue · branch→branch approval · return receipt', 'تحويلات في الطريق': 'Transfers in transit', 'قيمة المخزون — كل المستودعات': 'Stock value — all warehouses', 'بالتكلفة': 'At cost',
  'المستودعات وربطها': 'Warehouses and links', 'مستودع لـ': 'Warehouse for', 'فرع جديد': 'New branch', 'تحويل جديد من الرئيسي': 'New transfer from main', 'المستودع': 'Warehouse', 'الفرع المرتبط': 'Linked branch', 'يتبع': 'Belongs to', 'حساب المخزون': 'Inventory account',
  'المستودع الرئيسي': 'Main warehouse', 'رئيسي': 'Main', 'فرعي': 'Branch', 'أرصدة': 'Balances', 'لا أرصدة في هذا المستودع': 'No balances in this warehouse', 'الجرد الدوري المجدول': 'Scheduled cycle count', 'غير مجدول': 'Not scheduled', 'جدولة': 'Schedule',
  'جرد أعمى · اعتماد شخص آخر': 'Blind count · approval by someone else', 'الكميات الدفترية مخفية عن موظفي الفروع': 'Book quantities hidden from branch staff', 'إعادة عدّ عند فرق': 'Recount on difference', 'فأكثر و': 'or more and', '% فأكثر': '% or more', 'الجرد اليومي لأصناف A موقوف': 'Daily count of A items is off',
  'جدولة الجرد ترسل للفروع تنبيهًا بموعد الجرد وتبرز الأصناف الأعلى قيمة لعدّها، فيُكتشف العجز مبكرًا بدل نهاية الشهر.': 'Scheduling sends branches a count reminder and highlights the highest-value items, so shortages are found early instead of at month end.',
  'التحويلات بين المستودعات': 'Inter-warehouse transfers', 'الرقم': 'No.', 'التواريخ': 'Dates', 'لا تحويلات بعد — تطلبها الفروع من شاشة «مستودع الفرع» أو يبادر بها المركز': 'No transfers yet — branches request them from Branch Warehouse, or head office initiates them',
  'حركة جديدة': 'New movement', 'حركات': 'Movements', '— حركات مستودعات الفروع يسجّلها كل فرع من شاشة «مستودع الفرع».': '— branch warehouse movements are recorded by each branch from Branch Warehouse.', 'الكمية': 'Quantity', 'البيان': 'Description', 'بواسطة': 'By',
  'لا حركات بعد — التوريد من أوامر الشراء يظهر هنا تلقائياً.': 'No movements yet — receipts from purchase orders appear here automatically.',
  'رسملة المخزون — بضاعة آخر المدة (الطريقة الدورية)': 'Inventory capitalization — closing stock (periodic method)', 'عند التفعيل: تُرسمَل قيمة المخزون الحالية أصلًا في المركز المالي، وتُخفّض تكلفة الفترة — فتصير': 'When enabled: current stock value is capitalized as an asset on the balance sheet and the period cost is reduced — so',
  'تكلفة البضاعة المباعة = المشتريات − بضاعة آخر المدة': 'Cost of goods sold = purchases − closing stock', '. (موقوفة افتراضيًا؛ فعّلها عند الحاجة.)': '. (Off by default; enable when needed.)', 'تفعيل رسملة المخزون': 'Enable inventory capitalization', 'القيمة تلقائيًا من المخزون الحالي': 'Value taken automatically from current stock',
  'تاريخ التسوية': 'Adjustment date', 'قيمة المخزون الحالية:': 'Current stock value:', 'حفظ': 'Save', 'جرد أعمى · اعتماد مزدوج': 'Blind count · dual approval', 'إعادة العدّ عند فرق': 'Recount on difference', 'فأكثر وبنسبة': 'or more and by', 'جرد كامل': 'Full count', 'قائمة ورقية': 'Paper list', 'تسليم العدّ للاعتماد': 'Submit count for approval',
  'لا يظهر الرصيد الدفتري ولا الفرق أثناء العدّ. الأصناف خارج التسامح تعود لإعادة العدّ، ولا تُسجَّل أي تسوية قبل اعتماد شخص آخر غير العادّ.': 'Book balance and difference are hidden during the count. Items outside tolerance go back for recount, and no adjustment is posted before someone other than the counter approves it.',
  'بطاقة السعرات': 'Calorie card', 'تحضيرة جديدة': 'New prep', 'منتج جديد': 'New product', 'التحضيرات (وصفات فرعية):': 'Preps (sub-recipes):',
  'للصلصات والتتبيلات والعجين التي تُحضَّر بدفعات — أنشئ التحضيرة بكمية ناتجها ومكوّناتها، ثم استخدمها مكوّنًا في وصفات المنتجات؛ تكلفتها واستهلاكها النظري يُحسبان من خاماتها.': 'For sauces, marinades and dough made in batches — create the prep with its yield and ingredients, then use it as an ingredient in product recipes; its cost and theoretical usage come from its raw materials.',
  'تكلفة المنتج': 'Product cost', 'السعرات ناقصة:': 'Calories missing:', 'بلا وصفة': 'No recipe', 'شامل': 'incl.', 'الصافي': 'Net', 'هامش': 'Margin', 'ناتج': 'Yield', '% · يُصرف': '% · issued',
  'قائمة التحضير اليومية': 'Daily prep list', 'كم يُحضَّر من كل صلصة وتتبيلة وعجين — من توقع مبيعات الفرع ووصفات المنتجات': 'How much of each sauce, marinade and dough to prepare — from the branch sales forecast and product recipes', 'طباعة للمطبخ': 'Print for kitchen',
  '(غدًا)': '(tomorrow)', 'تنبيه': 'Note', 'اليوم': 'Day', 'لا توقع لهذا اليوم — يلزم 3 أسابيع على الأقل من مبيعات اليوم نفسه من الأسبوع في الفرع': 'No forecast for this day — needs at least 3 weeks of sales for the same weekday at the branch',
  'لا مبيعات بالأصناف للفرع في آخر 28 يومًا (فواتير نقطة البيع أو استيراد مبيعات المنتجات) — لا يُعرف مزيج الأصناف': 'No item-level sales for the branch in the last 28 days (POS invoices or imported product sales) — the item mix is unknown', 'كيف تُحسب؟': 'How is it calculated?',
  'المبيعات المتوقعة للفرع في ذلك اليوم (من «توقع المبيعات» بيوم الأسبوع) × كمية كل صنف لكل ريال مبيعات في آخر 28 يومًا (على الأيام التي فيها مبيعات بالأصناف فقط: فواتير نقطة البيع أو مبيعات المنتجات المستوردة) × كمية التحضيرة في وصفته. يُطرح المتبقي الذي تدخله، والتحضيرة داخل تحضيرة تُحسب مما سيُحضَّر من الخارجية. المزيج يُفترض مستقرًا خلال الشهر — المناسبات والعروض لا يعرفها التوقع، فعدّل الكمية يدويًا عند الطباعة.': "The branch's forecast sales for that day (from Sales Forecast by weekday) × each item's quantity per riyal of sales over the last 28 days (only days with item-level sales: POS invoices or imported product sales) × the prep quantity in its recipe. The leftover you enter is subtracted, and a prep inside a prep is computed from what the outer prep needs. The mix is assumed stable during the month — the forecast does not know about events and promotions, so adjust quantities manually when printing.",
  'أوامر مخططة': 'Planned orders', 'بانتظار التنفيذ': 'Awaiting execution', 'منجزة اليوم': 'Completed today', 'متوسط الإنجاز': 'Average yield', 'الفعلي ÷ المخطط (آخر 30)': 'Actual ÷ planned (last 30)', 'تحضيرات مخزّنة': 'Stocked preps', 'أوامر الإنتاج': 'Production Orders', 'أمر إنتاج جديد': 'New production order',
  'لا توجد تحضيرات مخزّنة بعد. افتح «الوصفات والتكلفة» ← التحضيرة ← فعّل «تُخزَّن صنفًا (أوامر الإنتاج)».': 'No stocked preps yet. Open Recipes & Cost → the prep → enable "Stocked as an item (production orders)".',
  'الأمر': 'Order', 'المنتج': 'Product', 'المخطط': 'Planned', 'المنتج فعلًا': 'Produced', 'الإنجاز': 'Yield', 'التكلفة': 'Cost', 'لا أوامر إنتاج بعد.': 'No production orders yet.',
  'حفظ الكميات': 'Save quantities', '⭐ نجوم (ربحي ورائج)': '⭐ Stars (profitable & popular)', '❓ ألغاز (ربحي قليل الطلب)': '❓ Puzzles (profitable, low demand)', '🐎 أحصنة (رائج ضعيف الهامش)': '🐎 Plowhorses (popular, low margin)', '🐕 كلاب (ضعيف الطلب والهامش)': '🐕 Dogs (low demand & margin)',
  'هندسة القائمة — أدخل كمية البيع الشهرية لكل منتج': 'Menu engineering — enter the monthly sales quantity per product', 'هامش الوحدة': 'Unit margin', 'الهامش %': 'Margin %', 'كمية/شهر': 'Qty/month', 'مساهمة الربح': 'Profit contribution', 'بلا كمية': 'No quantity', 'إجمالي مساهمة الربح الشهرية (من الكميات المُدخلة)': 'Total monthly profit contribution (from entered quantities)',
  'أدخل كمية البيع الشهرية لمنتجاتك (ثم «حفظ الكميات») ليصنّفها النظام. التكلفة والهامش يأتيان من وصفاتك تلقائيًا.': 'Enter the monthly sales quantity for your products (then Save quantities) for the system to classify them. Cost and margin come from your recipes automatically.',
  'كيف تُقرأ؟': 'How to read it?', 'يقارن النظام كل منتج بمتوسط القائمة في بُعدين:': 'The system compares each product with the menu average on two axes:', 'الرواج': 'popularity', '(كمية البيع) و': '(quantity sold) and', 'الربحية': 'profitability', '(هامش الوحدة).': '(unit margin).',
  '⭐ نجم': '⭐ Star', ': رائج وربحي — أبرِزه.': ': popular and profitable — feature it.', '❓ لغز': '❓ Puzzle', ': ربحي لكن قليل الطلب — روّج له.': ': profitable but low demand — promote it.', '🐎 حصان': '🐎 Plowhorse', ': رائج ضعيف الهامش — راجع تكلفته أو سعره.': ': popular, low margin — review its cost or price.',
  '🐕 كلب': '🐕 Dog', ': ضعيف الطلب والهامش — طوّره أو أزِله. القواطع: متوسط الهامش المرجّح، و70% من متوسط الكمية.': ': low demand and margin — improve or remove it. Cut-offs: weighted average margin and 70% of average quantity.',
  'يُنبَّه عند سعر أعلى من متوسط آخر 3 مشتريات للصنف بأكثر من 5% — ويحتاج أمر الشراء اعتماد شخص غير منشئه.': 'Alerts when a price exceeds the average of the last 3 purchases of the item by more than 5% — and the purchase order then needs approval by someone other than its creator.',
  'بنود أوامر شراء بسعر مرتفع': 'Purchase order lines with a high price', 'لا بنود متجاوزة.': 'No lines over the limit.', 'أصناف ارتفع آخر سعر شرائها': 'Items whose last purchase price rose', 'لا ارتفاعات فوق الحد في آخر المشتريات المستلمة.': 'No increases above the limit in recent received purchases.',
  'من': 'From', 'حد التسامح %': 'Tolerance %', 'المبيعات المحتسبة:': 'Sales counted:', 'التكلفة النظرية': 'Theoretical cost', 'نسبة تكلفة الطعام —': 'Food cost % —', 'التكلفة الفعلية': 'Actual cost', 'الفرق (هدر/فقد)': 'Variance (waste/loss)', 'أصناف تتجاوز الحد': 'Items over the limit',
  '⚠ لا مبيعات منتجات مسجّلة لهذه الفترة — النظري صفر. سجّلها من «مبيعات المنتجات» أدناه.': '⚠ No product sales recorded for this period — theoretical is zero. Record them in Product sales below.', 'الفرق لكل صنف — مرتّب بالأثر المالي': 'Variance per item — sorted by financial impact',
  'النظري': 'Theoretical', 'صرف للمطبخ': 'Issued to kitchen', 'هدر مسجّل': 'Recorded waste', 'عجز الجرد': 'Count shortage', 'لا حركات ولا مبيعات في هذه الفترة.': 'No movements or sales in this period.',
  'الفرق الموجب = استُهلك أكثر مما تبرره المبيعات (هدر غير مسجّل، زيادة في الحصص، أو فقد). السالب = أقل من الوصفة (حصص أصغر أو مبيعات غير مسجّلة أو وصفة مبالغ فيها). عجز الجرد يأتي من تسويات الجرد في الفترة.': 'Positive variance = more used than sales justify (unrecorded waste, larger portions, or loss). Negative = less than the recipe (smaller portions, unrecorded sales, or an inflated recipe). Count shortage comes from count adjustments in the period.',
  'مبيعات المنتجات المسجّلة': 'Recorded product sales', 'تسجيل مبيعات منتجات': 'Record product sales', 'الفترة': 'Period', 'المنتجات': 'Products', 'الكميات': 'Quantities', 'لا مبيعات منتجات بعد — استوردها من تقرير نقطة البيع (Excel: المنتج + الكمية) أو أدخلها يدويًا.': 'No product sales yet — import them from a POS report (Excel: product + quantity) or enter them manually.',
  'ضوابط الهدر': 'Waste controls', 'صورة التالف إلزامية من': 'Damaged-item photo required from', 'اعتماد شخص آخر من': 'Approval by someone else from', 'سقف الهدر اليومي': 'Daily waste cap', 'من مبيعات الفرع': 'of branch sales',
  'وضع 0 يعطّل الضابط. الهدر المعلّق لا يُخصم من الرصيد ولا يُقيَّد حتى يُعتمد، ومقدّم الطلب لا يعتمد طلبه.': 'Setting 0 disables the control. Pending waste is not deducted from stock or posted until approved, and the requester cannot approve their own request.',
  'أسبوع': 'Week', '30 يومًا': '30 days', '90 يومًا': '90 days', 'قيمة الهدر': 'Waste value', 'أيام تجاوز السقف': 'Days over the cap', 'بانتظار الاعتماد': 'Awaiting approval', 'طلبات مرفوضة': 'Rejected requests', 'تقرير الهدر — آخر': 'Waste report — last', 'يومًا': 'days',
  'حسب الموظف': 'By employee', 'حسب السبب': 'By reason', 'حسب الصنف': 'By item', 'حسب الفرع': 'By branch', 'طباعة': 'Print', 'لا هدر مسجّل في الفترة.': 'No waste recorded in the period.', 'آخر حركات الهدر': 'Latest waste movements', 'لا حركات.': 'No movements.',
  'الدوران وفروق أسعار الشراء': 'Turnover & purchase price variance', 'دوران المخزون': 'Inventory turnover', 'فروق أسعار الشراء': 'Purchase price variance', 'معدل الدوران': 'Turnover rate', 'أيام التغطية': 'Days of cover', 'المخزون يكفي': 'Stock lasts', 'تكلفة الاستهلاك': 'Consumption cost',
  'صرف + هدر + عجز جرد': 'Issues + waste + count shortage', 'مخزون راكد': 'Dead stock', 'بلا استهلاك في الفترة': 'No consumption in the period', 'المستهلك': 'Consumed', 'متوسط المخزون': 'Average stock', 'الدوران': 'Turnover', 'راكد': 'Dead',
  'الدوران = تكلفة الاستهلاك ÷ متوسط قيمة المخزون (أول الفترة وآخرها) بمتوسط التكلفة المرجّح. التحويلات بين المستودعات ومرتجعات الموردين لا تُحتسب استهلاكًا.': 'Turnover = consumption cost ÷ average stock value (start and end of period) at weighted average cost. Inter-warehouse transfers and supplier returns do not count as consumption.'
});

// ===== v43.3 نوافذ المخزون =====
Object.assign(EN, {
  'صنف مخزون جديد': 'New stock item', 'اسم الصنف': 'Item name', 'نوع الصنف': 'Item type', 'للبيع': 'For sale', 'خدمي': 'Service', 'استهلاكي — مواد خام ومستلزمات تُستهلك': 'Consumable — raw materials and supplies', 'الوحدة الأساسية (للأرصدة والصرف)': 'Base unit (for balances and issues)',
  'حد الطلب الأدنى': 'Minimum reorder level', 'وحدة الشراء (اختياري)': 'Purchase unit (optional)', 'السعرات الحرارية — لكل 100 غ (من بطاقة القيمة الغذائية)': 'Calories — per 100 g (from the nutrition label)', 'أساس السعرات': 'Calorie basis', 'لكل 100 غ/مل': 'per 100 g/ml', 'لكل كغ': 'per kg',
  'التكلفة تُحتسب بـ': 'Cost is calculated by', 'المتوسط المرجّح': 'weighted average', ': كل استلام بتكلفته يعيد حساب المتوسط، والصرف والهدر يخرجان به. التكلفة المرجعية تُستخدم فقط قبل أول استلام مسعّر.': ': each receipt at its cost recalculates the average, and issues and waste go out at it. The reference cost is used only before the first priced receipt.',
  'حفظ الصنف': 'Save item', 'أرز بسمتي، لحم غنم…': 'Basmati rice, lamb…', 'كغ · pc · L': 'kg · pc · L', 'carton · كيس · صندوق': 'carton · bag · box', 'السعرات الحرارية': 'Calories', 'كغ': 'kg', 'كيس': 'bag', 'صندوق': 'box',
  'حركة مخزون جديدة': 'New stock movement', 'نوع الحركة': 'Movement type', 'توريد يدوي (+)': 'Manual receipt (+)', 'صرف للتشغيل (−)': 'Issue to operations (−)', 'هدر/إتلاف (−)': 'Waste/disposal (−)', 'توريد يدوي': 'Manual receipt', 'توريد يدوي…': 'Manual receipt…', 'رصيد': 'balance', 'البيان (اختياري)': 'Description (optional)', 'تسجيل الحركة': 'Record movement',
  'تحويل جديد من المستودع الرئيسي': 'New transfer from the main warehouse', 'إلى المستودع': 'To warehouse', 'الكميات المصروفة (يمكن صرف أقل من المطلوب)': 'Issued quantities (you can issue less than requested)', 'سطر': 'Line', 'ملاحظة': 'Note', 'صرف — تصبح البضاعة في الطريق': 'Issue — goods become in transit',
  'تحضيرة جديدة (وصفة فرعية)': 'New prep (sub-recipe)', 'كمية الناتج للدفعة': 'Batch yield quantity', 'تُخزَّن صنفًا (أوامر الإنتاج) — الناتج يدخل المخزون ويُصرف للفروع ويُجرد': 'Stocked as an item (production orders) — output enters stock, is issued to branches and counted',
  'اكتب ما يدخل في': 'Enter what goes into', 'دفعة واحدة': 'one batch', 'وكمية ما تُنتجه بعد الطهي/التصفية. تكلفة الوحدة = تكلفة المكوّنات ÷ الناتج.': 'and how much it yields after cooking/straining. Unit cost = ingredient cost ÷ yield.', '— اختر الصنف أو التحضيرة —': '— Choose item or prep —',
  '% ناتج': '% yield', 'مكوّن إضافي': 'Add ingredient', 'تكلفة الدفعة': 'Batch cost', 'حفظ التحضيرة': 'Save prep', 'صلصة ثوم، تتبيلة شاورما، عجينة…': 'Garlic sauce, shawarma marinade, dough…', 'الكمية الصافية': 'Net quantity', 'معامل الناتج: نسبة الصافي من الخام بعد التنظيف/الطهي': 'Yield factor: net share of raw after cleaning/cooking',
  'منتج جديد بوصفته': 'New product with recipe', 'اسم المنتج': 'Product name', 'سعر البيع (شامل الضريبة)': 'Selling price (VAT incl.)', 'تصنيف نقطة البيع': 'POS category', 'متاح في نقطة البيع': 'Available in POS', 'خصم الصنف في نقطة البيع (اختياري)': 'Item discount in POS (optional)',
  'سعرات معتمدة من مختبر (اختياري — تتقدم على المحسوبة)': 'Lab-certified calories (optional — overrides calculated)', 'سعرات معتمدة': 'Certified calories', 'المكوّنات (أصناف المخزون أو التحضيرات)': 'Ingredients (stock items or preps)', 'اكتب الكمية': 'Enter the', 'الصافية': 'net quantity',
  'في الطبق، ومعامل الناتج لكل مكوّن يفقد وزنًا (لحم 1 كجم ← 0.82 كجم مطبوخ = 82%). التكلفة والاستهلاك النظري يُحسبان على الكمية الخام. اتركه فارغًا = 100%.': 'on the plate, and the yield factor for each ingredient that loses weight (meat 1 kg → 0.82 kg cooked = 82%). Cost and theoretical usage are computed on the raw quantity. Leave empty = 100%.',
  'التكلفة الحالية:': 'Current cost:', 'حفظ المنتج': 'Save product', 'مندي لحم — وجبة': 'Lamb mandi — meal', 'وجبات، مشروبات، حلويات…': 'Meals, drinks, desserts…',
  'تسجيل مبيعات المنتجات': 'Record product sales', 'استيراد تقرير نقطة البيع (Excel/CSV)': 'Import POS report (Excel/CSV)', 'الكمية المباعة': 'Quantity sold',
  'التكرار': 'Frequency', 'موقوف': 'Off', 'أسبوعي': 'Weekly', 'كل أسبوعين': 'Every two weeks', 'شهري': 'Monthly', 'النطاق': 'Scope', 'الأصناف الأعلى قيمة': 'Highest-value items', 'كل الأصناف': 'All items', 'عددها': 'Count',
  'تسامح الفرق (ر.س)': 'Difference tolerance (SAR)', 'تسامح الفرق (%)': 'Difference tolerance (%)', 'إخفاء الكميات الدفترية عن موظفي الفروع': 'Hide book quantities from branch staff', 'جرد يومي لأصناف A': 'Daily count of A items'
});
export const TX = (ar) => (LANG === 'en' && ar && EN[ar]) || ar;

/* v43.1 مترجم الشاشة: في الوضع الإنجليزي يترجم نصوص الواجهة (عُقد النص + placeholder/title/aria-label) بمطابقة القاموس حرفيًا،
   فلا يمسّ بيانات المستخدم (أسماء الأصناف والعملاء) إلا إن طابقت مدخلًا بالكامل، ولا الحقول ولا ما عليه data-noi18n ولا المطبوعات (نوافذ مستقلة). */
const AFFIX = /^([\s·—(]*)(.*?)([\s:،)·—]*)$/s;
// نصوص فيها أرقام/قيم متغيرة: [نمط، بديل]
export const EN_RX = [
  [/^(\s*·?\s*)الوردية منذ (.+)$/s, '$1shift since $2'], [/^طاولة (\S+)$/, 'Table $1'], [/^(\d+) فاتورة$/, '$1 invoices'], [/^(\d+) جولة$/, '$1 rounds'], [/^(\d+) دقيقة$/, '$1 min'], [/^ض\.ق\.م 15% ≈(.*)$/s, 'VAT 15% ≈$1'],
  [/^(\d+) صنفاً$/, '$1 items'], [/^رئيسي \+ (\d+) فرعي$/, 'Main + $1 branch'], [/^أصناف A \($/, 'A items ('], [/^([\d.,]+) ر\.س$/, '$1 SAR'], [/^([\d.,]+) تكلفة$/, '$1 cost'], [/^من (\d+) تحضيرة$/, 'of $1 preps'],
  [/^منها زيادات (.+)$/, 'of which increases $1'], [/^من (\d+) صنف · حد (.+)$/, 'of $1 items · limit $2'], [/^(\d+) حركة · (.+) من المبيعات$/, '$1 movements · $2 of sales'], [/^فوق (.+) من مبيعات اليوم$/, "above $1 of the day's sales"], [/^بلا سعرات: (.+)$/, (_, x) => 'No calories: ' + (EN[x] || x)],
  [/^التكلفة المرجعية \/ (.+)$/, (_, u) => 'Reference cost / ' + (EN[u] || u)], [/^كم (.+) في وحدة الشراء$/, (_, u) => 'How many ' + (EN[u] || u) + ' per purchase unit'], [/^تكلفة (.+) \(تُحدّث المتوسط\)$/, (_, u) => 'Cost per ' + (EN[u] || u) + ' (updates the average)'],
  [/^(.+) — رصيد (.+)$/, '$1 — balance $2'], [/^— رصيد$/, '— balance'], [/^المكوّن (\d+)$/, 'Ingredient $1'], [/^كمية المكوّن (\d+)$/, 'Ingredient $1 quantity'], [/^المحسوبة: (.+)$/, 'Calculated: $1'],
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
