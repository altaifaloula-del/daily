/* v50.2 الدفعة 1: «مهامي»، مجموعات المحاسبة، الإشعارات، ووحدات v49–v50 (طلبات العروض، سياسة التكلفة، الربحية، دفتر الأستاذ، الجدول الموحد، مسارات الاعتماد) */
export const RX = [
  [/^(\d+) بند ينتظرك$/, '$1 items waiting for you'], [/^\+ (\d+) أخرى$/, '+ $1 more'],
  [/^(\d{4}-\d{2}-\d{2}) · إيراد ([\d.,-]+)(?: · فرق ([\d.,-]+))?$/, (_, d, r, f) => d + ' · revenue ' + r + (f ? ' · diff ' + f : '')],
  [/^المتبقي ([\d.,-]+) ر\.س$/, 'Remaining $1 SAR'], [/^(.+): عجز ([\d.,]+) ر\.س في إغلاق اليوم \(الحد ([\d.,]+)\)\.$/, "$1: shortage $2 SAR in today's closing (limit $3)."],
  [/^(\d+) فاتورة مورد مستحقة اليوم أو متأخرة$/, '$1 supplier invoices due today or overdue'], [/^عجز صندوق في (\d+) إغلاق اليوم$/, "Cash shortage in $1 of today's closings"],
  [/^(\d+) طلب$/, '$1 orders'], [/^(\d+) جديد · (\d+) عائد$/, '$1 new · $2 returning'], [/^من (\d+) عميل$/, 'of $1 customers'], [/^معرّضون للانقطاع: (\d+)$/, 'At risk of churn: $1'],
  [/^معرَّف العميل: (.+)$/, 'Customer identified: $1'], [/^تأخر (\d+) س (\d+) د$/, 'Late $1h $2m'], [/^(.+) \((مستودع .+)\)$/, (_, a, w) => a + ' (' + w + ')'],
  [/^Hours — (.+)$/, 'Hours — $1'], [/^ربحية_الأصناف_(.+)$/, 'item_profitability_$1'], [/^دفتر_الأستاذ_(.+)$/, 'general_ledger_$1']
];
export default {
  // «مهامي» والمجموعات
  'مهامي': 'My work', 'لا شيء ينتظرك ✓': 'Nothing waiting for you ✓', 'المالية والموردون': 'Finance & Suppliers', 'المخزون': 'Inventory',
  'العمليات اليومية': 'Daily operations', 'الدفاتر': 'Books', 'الإقفال والضريبة': 'Closing & Tax', 'الإعداد والأدوات': 'Setup & Tools', 'أقسام المحاسبة': 'Accounting sections',
  'ربحية الأصناف والفروع': 'Item & Branch Profitability', 'طلبات عروض الأسعار': 'Requests for Quotation', 'سندات القبض والصرف': 'Receipt & Payment Vouchers', 'دفتر الأستاذ العام': 'General Ledger',
  'كشف أي حساب برصيد جارٍ يطابق الميزان، وكل سطر يُفتح على قيده.': 'Any account statement with a running balance that matches the trial balance; every line opens its entry.',
  'لكل حساب: رصيد أول المدة وحركة الفترة ورصيد آخرها.': 'For each account: opening balance, period activity and closing balance.',
  'التسويق والنمو الذكي': 'Smart Marketing & Growth', 'السندات': 'Vouchers',
  // الإشعارات
  'إغلاق بانتظار التدقيق': 'Closing awaiting audit', 'عجز صندوق تجاوز الحد': 'Cash shortage over limit', 'أمر شراء بانتظار اعتمادك': 'Purchase order awaiting your approval',
  'توريد نقدي بانتظار الاستلام': 'Cash supply awaiting receipt', 'قيد بانتظار اعتمادك': 'Entry awaiting your approval', 'أُعيد إغلاق للتصحيح': 'Closing returned for correction',
  'إجراء متأخر عن موعده': 'Action past due', 'إجراء مسند إليك': 'Action assigned to you', 'إعادة عدّ مطلوبة': 'Recount required', 'جرد أصناف A اليومي': 'Daily A-items count',
  'جرد بانتظار اعتمادك': 'Count awaiting your approval', 'جرد دوري متأخر': 'Cycle count overdue', 'جرد دوري مستحق اليوم': 'Cycle count due today',
  'دفعة تنتهي خلال 7 أيام': 'Batch expiring within 7 days', 'دفعة منتهية الصلاحية': 'Expired batch', 'هدر بانتظار اعتمادك': 'Waste awaiting your approval',
  'إغلاق وردية': 'Shift close', 'التقرير اليومي': 'Daily report', 'طلب إجازة': 'Leave request', 'طلب تبديل وردية': 'Shift swap request', 'طلب مكافأة/جزاء': 'Reward/penalty request',
  'طلب نقل موظف بين الفروع': 'Employee transfer request', 'مستندات موظفين تحتاج تجديدًا': 'Employee documents need renewal', 'لم يُسلَّم جرد اليوم للأصناف الأعلى قيمة': "Today's count of top-value items was not submitted",
  'عجز صندوق': 'Cash shortage', 'الأعلى إيراداً': 'Highest revenue', 'الأدنى إيراداً': 'Lowest revenue', 'معتمد': 'Approved', 'تتطلب متابعة فورية': 'Needs immediate follow-up',
  // طلبات عروض الأسعار
  'نرجو تزويدنا بالأسعار شاملة الضريبة، ومدة التوريد، وصلاحية العرض، وشروط الدفع.': 'Please send your prices including VAT, delivery time, offer validity and payment terms.',
  'اطلب الأسعار من عدة موردين، قارنها صنفًا صنفًا، ثم حوّل الأفضل إلى أوامر شراء.': 'Request prices from several suppliers, compare them item by item, then turn the best into purchase orders.',
  'طلب جديد': 'New request', 'الموضوع': 'Subject', 'لا طلبات بعد': 'No requests yet', 'آخر سعر شراء': 'Last purchase price', 'الأفضل': 'Best', 'بلا عرض': 'No offer', 'التغطية': 'Coverage',
  'الأفضل في': 'Best in', 'التوريد': 'Delivery', 'الصلاحية': 'Validity', 'ترسية كاملة': 'Full award', 'الأفضل لكل صنف:': 'Best per item:', 'يوفر': 'saves', 'ترسية الأفضل لكل صنف': 'Award best per item',
  'لم يُدخل أي عرض بعد. اطبع الطلب وأرسله للموردين، ثم اضغط اسم المورد لإدخال أسعاره.': "No offer entered yet. Print the request and send it to suppliers, then click a supplier's name to enter their prices.",
  'إنشاء الطلب': 'Create request', 'الموردون (اثنان على الأقل)': 'Suppliers (at least two)', 'حفظ العرض': 'Save offer', 'غير متوفر': 'Not available',
  'أضف صنفًا واحدًا على الأقل بكمية': 'Add at least one item with a quantity', 'اختر موردَين على الأقل للمقارنة': 'Choose at least two suppliers to compare', 'أنشأ طلب عروض أسعار': 'Created a request for quotation',
  'موردين': 'suppliers', '✓ — اطبعه وأرسله للموردين ثم أدخل عروضهم': '✓ — print it, send it to suppliers, then enter their offers', 'طلب عرض أسعار': 'Request for Quotation', 'آخر موعد للرد': 'Reply deadline',
  'أدخل سعرًا واحدًا على الأقل أو علّم «غير متوفر»': 'Enter at least one price or mark «Not available»', 'أدخل عرض مورد': 'Enter supplier offer', 'حُفظ عرض': 'Offer saved', 'أمر شراء من': 'Purchase order from',
  'أمر الشراء': 'Purchase order', 'ترسية طلب عروض أسعار': 'Award RFQ', 'أُرسي': 'Awarded', 'بعضها بانتظار الاعتماد': 'some awaiting approval', 'سبب إلغاء': 'Cancellation reason', 'ألغى طلب عروض أسعار': 'Cancelled an RFQ',
  'أدخل العرض': 'Enter offer', 'طلب عروض أسعار جديد': 'New request for quotation', 'موضوع الطلب': 'Request subject', 'مثال: مواد غذائية الربع الأول': 'e.g. Food supplies Q1',
  'مدة التوريد (يوم)': 'Delivery time (days)', 'صلاحية العرض حتى': 'Offer valid until', 'شروط الدفع': 'Payment terms', 'نقدًا / آجل 30 يومًا': 'Cash / net 30', 'إشعار مدين': 'Debit note',
  '⧉ نسخ': '⧉ Copy', 'استعراض الفاتورة': 'View invoice', 'نسخة مطابقة بتاريخ اليوم': "Duplicate with today's date", 'استعراض القيد': 'View entry',
  // سياسة التكلفة
  'سياسة تكلفة المخزون': 'Inventory Costing Policy', 'قيمة المخزون: المتوسط': 'Inventory value: average', 'تكلفة الصادر في الفترة: المتوسط': 'Cost of issues in period: average', 'أثر التحويل على الربح:': 'Profit impact of switching:',
  'وحدة (متوسط)': 'Unit (avg)', 'وحدة (FIFO)': 'Unit (FIFO)', 'القيمة (متوسط)': 'Value (avg)', 'القيمة (FIFO)': 'Value (FIFO)', 'الصادر (متوسط)': 'Issues (avg)', 'الصادر (FIFO)': 'Issues (FIFO)',
  'لا أرصدة ولا صادر في الفترة': 'No balances or issues in the period', 'اعتماد «': 'Adopt «', 'غيّر سياسة تكلفة المخزون إلى': 'Changed the inventory costing policy to', 'إخفاء المقارنة': 'Hide comparison',
  'مقارنة الطريقتين': 'Compare both methods', 'مقارنة من': 'Compare from', 'مقارنة إلى': 'Compare to', 'الحالية:': 'Current:', 'الافتراضي · موصى به': 'Default · recommended',
  'الافتراضي والموصى به — تكلفة كل صرف = متوسط تكلفة الرصيد لحظتها': 'Default and recommended — each issue costs the average cost of the balance at that moment',
  'الوارد أولًا يصرف أولًا (FIFO)': 'First in, first out (FIFO)', 'الصرف يستهلك أقدم الكميات بتكلفتها — يناسب الأصناف المتتبَّعة بالدفعات والصلاحية': 'Issues consume the oldest quantities at their cost — suits batch- and expiry-tracked items',
  'مقارنة الطريقتين': 'Compare both methods', 'طريقة المخزون الحالية:': 'Current inventory method:', 'المتوسط المرجّح': 'Weighted average',
  'المبيعات لا تُخصم من المخزون تلقائيًا (يمكن تفعيلها من إعدادات المشتريات).': 'Sales are not deducted from inventory automatically (enable it in purchasing settings).',
  'بحث بالاسم أو الرمز أو الباركود': 'Search by name, code or barcode', 'بحث الأصناف': 'Search items', 'حالة الصنف': 'Item status', 'حركة الصنف': 'Item movement',
  // الربحية
  'الإيراد الصافي': 'Net revenue', 'نسبة التكلفة': 'Cost ratio', 'لا مبيعات من نقطة البيع في الفترة': 'No POS sales in the period', 'نسبة التكلفة %': 'Cost ratio %', 'تجميع الفترة': 'Period grouping',
  'التكلفة (المعروفة)': 'Cost (known)', 'إيراد بلا تكلفة معروفة': 'Revenue without known cost', 'أصناف بلا وصفة أو مكوّن بلا تكلفة': 'Items without a recipe or with an uncosted ingredient', 'حسب الفترة': 'By period',
  'صنف × فرع × فترة': 'Item × branch × period', 'بحث في الربحية': 'Search profitability', 'بحث…': 'Search…',
  // دفتر الأستاذ وحركة الحسابات
  'كل المشاريع': 'All projects', 'اضغط اسم أي حساب لفتح دفتر أستاذه بالفترة نفسها، ثم رقم أي قيد لاستعراضه.': 'Click any account name to open its ledger for the same period, then any entry number to view it.',
  'الإجمالي ورصيد آخر المدة': 'Total and closing balance', 'اختر الحساب…': 'Choose account…', 'مع الحسابات الفرعية': 'Including sub-accounts',
  'اختر حسابًا لعرض كشفه برصيد جارٍ — أو اضغط اسم حساب في «ميزان المراجعة» أو «حركة الحسابات».': 'Choose an account to see its statement with a running balance — or click an account name in the Trial Balance or Account Activity.',
  'مركزي': 'Central', 'فرع الدفتر': 'Ledger branch', 'مشروع الدفتر': 'Ledger project', 'المدين = الدائن — متوازن ✓': 'Debit = credit — balanced ✓', 'دفتر الأستاذ —': 'General ledger —', 'حركة الحسابات —': 'Account activity —',
  'بلا الحسابات الفرعية': 'without sub-accounts', 'الحسابات الفرعية': 'Sub-accounts', 'مشمولة': 'Included', 'غير مشمولة': 'Excluded', 'المقابل': 'Counter account', 'الرصيد بطبيعة الحساب (': "Balance in the account's normal side (",
  ')؛ القيمة بين قوسين رصيد عكس الطبيعة.': '); a value in brackets is a balance against the normal side.', 'كل الفترات': 'All periods', 'متوازن ✓': 'Balanced ✓', 'رصيد أول المدة': 'Opening balance', 'رصيد آخر المدة': 'Closing balance',
  'دفتر الأستاذ لهذا الحساب': 'Ledger for this account',
  // الجدول الموحد
  'العروض المحفوظة…': 'Saved views…', 'عربي': 'Arabic', 'طولي': 'Portrait', 'عرضي': 'Landscape', 'لا بيانات مطابقة.': 'No matching data.', 'اسم العرض المحفوظ (الفرز والأعمدة والبحث):': 'Saved view name (sort, columns and search):',
  'بحث في التقرير': 'Search report', 'مخفي)': 'hidden)', 'العروض المحفوظة': 'Saved views', 'لغة التقرير': 'Report language', 'اتجاه الورق': 'Paper orientation', 'حجم الورق': 'Paper size',
  'القالب:': 'Template:', 'قائمة': 'List', 'اضغط رأس العمود للفرز': 'click a column header to sort', 'واضغط السطر لفتح مصدره': 'and click a row to open its source', 'تقرير': 'Report',
  // مسارات الاعتماد
  'مسارات الاعتماد': 'Approval Workflows', 'مستوى': 'Level', 'من مبلغ': 'From amount', 'لا مستويات — السلوك الافتراضي.': 'No levels — default behaviour.', 'حفظ المسارات': 'Save workflows',
  ': أدخل حد المبلغ لكل مستوى': ': enter the amount threshold for each level', ': اختر دورًا واحدًا على الأقل لكل مستوى': ': choose at least one role for each level', ': لا يتكرر حد المبلغ بين مستويين': ': two levels cannot share the same threshold',
  'عدّل مسارات الاعتماد': 'Edited approval workflows', 'حُفظت مسارات الاعتماد ✓': 'Approval workflows saved ✓', 'تهيئة': 'Configure', 'اسم المستوى': 'Level name', 'حد المستوى': 'Level threshold', 'حذف المستوى': 'Delete level',
  // نقطة البيع (v49.2)
  'سائقو التوصيل الذاتي (لا يلزم لطلبات التطبيقات)': 'In-house delivery drivers (not needed for app orders)', '+ سائق': '+ Driver', 'تفعيل المرتجع': 'Enable returns',
  'تفعيل المرتجع (جزئي أو كلي) — لمدير الفرع فقط؛ الطبق المرتجع يُسجَّل هدرًا، ويُرد المبلغ بطريقة الدفع الأصلية': 'Enable returns (partial or full) — branch manager only; the returned dish is recorded as waste and the amount is refunded by the original payment method',
  'استيراد جهات اتصال': 'Import contacts',
  // المشاريع
  'المشاريع': 'Projects', 'اسم المشروع': 'Project name', 'الفرع (اختياري)': 'Branch (optional)', 'الموازنة (اختياري)': 'Budget (optional)', 'إضافة مشروع': 'Add project', 'المشروع': 'Project', 'من الموازنة': 'of budget', 'لا مشاريع بعد.': 'No projects yet.',
  // الدليل
  'خصم مسموح به (يُطرح من المبيعات)': 'Sales discount (deducted from sales)', 'خصم مكتسب': 'Purchase discount', 'تكلفة المبيعات — خصم المخزون من المبيعات': 'Cost of sales — inventory deducted by sales',
  'خصم تعجيل السداد للعملاء — بإشعار دائن يخفض الضريبة': 'Early-payment discount to customers — by credit note reducing VAT', 'خصومات الموردين بعد الفاتورة — بإشعار مدين يخفض ضريبة المدخلات': 'Supplier discounts after invoice — by debit note reducing input VAT',
  'الخصم التلقائي لمواد الوصفات مع كل فاتورة بيع (بالمتوسط المرجّح)': 'Automatic deduction of recipe materials with every sales invoice (weighted average)', 'سلفة': 'Advance', 'مشتريات خضار': 'Vegetable purchases'
};
