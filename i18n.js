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
export const TX = (ar) => (LANG === 'en' && ar && EN[ar]) || ar;
