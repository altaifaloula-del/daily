# REPORTS MIGRATION — v56.0

| القالب / الدالة | الملف | قبل | بعد |
|---|---|---|---|
| `rptHtml` (كل تقارير مركز التقارير) | App.jsx | كحلي MITHQAL ثابت، شعار الشركة فقط | ألوان المنشأة، ترويسة المنشأة الموحدة (اسمان، اتصال، سطر ترويسة)، تذييلها، القوالب الستة، أحادي |
| `rptShell`/`printA4` (السندات والمستندات) | App.jsx | كحلي ثابت | ألوان وترويسة وتذييل المنشأة |
| `rptXlsxRows` | App.jsx | `company.name` | اسم المنشأة حسب لغة التقرير |
| `A4_CSS` ← تقرير الإغلاق، التقرير الصباحي، قائمة الدخل A4، تقرير تقييم العملاء | App.jsx | كحلي ثابت | متغيرات المنشأة |
| `buildClosingA4`, `printReceipt`, `printSalesInvoice`, `printPartnerStatement`, `printIncomeA4` | App.jsx | شعار غير معقّم + كحلي | `tbLogo` + ألوان المنشأة |
| `exportExcel` (HTML) | App.jsx | ذهبي/كحلي المنصة | محايد |
| قسيمة الراتب | mods/hr/Payroll.jsx | كحلي، شعار غير معقّم | ألوان المنشأة، `tbLogo` |
| الفاتورة الإلكترونية، القوائم المالية | mods/acct/Accounting.jsx | كحلي | ألوان المنشأة |
| التقارير المالية | mods/acct/FinancialReports.jsx | كحلي | ألوان المنشأة |
| تقارير الفروع، التقرير اليومي | mods/acct/Reports.jsx, DailyBranchReport.jsx | شعار غير معقّم | `tbLogo` |
| بطاقة الحضور، ملصق QR | mods/hr/Attendance.jsx, mods/pos/QrBranchesView.jsx | كحلي | ألوان المنشأة |
| فاتورة اشتراك مِثقال | mods/admin/SubscriptionCard.jsx | — | **بقيت بهوية MITHQAL** (مستند المنصة للعميل، لا مستند المنشأة) |

لم يتغير أي رقم أو حساب: كل الاختبارات المحاسبية والتقارير بقيت ناجحة (`REGRESSION_RESULTS_V56.md`).
الصور: `design/reports/report-*-before.png` (محرك v55) و`-after.png` (v56) لنفس المواصفة ونفس المنشأة.
