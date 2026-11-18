# FUNCTIONAL SCREEN INVENTORY — جرد الشاشات الوظيفي

المصدر: مسارات التنقل الفعلية في `App.jsx` (`HUBS` + `ACCT_SECTIONS` + مفتاح العرض في `safeTab`) — لا أسماء المجلدات.
الأزرار: عدّها **زاحف الأزرار** بفتح كل شاشة فعليًا ببيانات اختبار حية والضغط على كل زر ظاهر (دور مسؤول النظام، حاسوب 1280).

**دليل الأثر:** DATA = غيّر البيانات · OUTPUT = طباعة/تنزيل/نافذة · NAV = نقل لشاشة أخرى · UI = غيّر الواجهة/فتح نافذة/رسالة · NO_EFFECT = لا أثر مرصود · ERROR = خطأ/انهيار · DISABLED = معطّل بحالته · UNCLICKABLE = تعذّر الضغط

| # | المسار | الشاشة | المكوّن | الملف | أزرار | DATA | OUTPUT | NAV | UI | NO_EFFECT | ERROR | حقول* | جداول* | طباعة* | تصدير* | استيراد* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `hub/analytics/exec` | اللوحة التنفيذية | ExecDashboard | mods/acct/ExecDashboard.jsx | 21 | 0 | 0 | 13 | 7 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| 2 | `hub/analytics/dash` | لوحة المؤشرات | Dashboard | mods/acct/Dashboard.jsx | 16 | 0 | 0 | 4 | 10 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | `hub/analytics/compare` | مقارنة الفروع | BranchCompare | mods/acct/BranchCompare.jsx | 9 | 0 | 0 | 1 | 7 | 1 | 0 | 1 | 1 | 0 | 0 | 0 |
| 4 | `hub/analytics/growth` | تحليلات النمو | GrowthAnalytics | mods/acct/GrowthAnalytics.jsx | 11 | 0 | 1 | 1 | 8 | 1 | 0 | 1 | 4 | 2 | 3 | 0 |
| 5 | `hub/analytics/breakeven` | تحليل التعادل | BreakEven | mods/acct/BreakEven.jsx | 14 | 1 | 1 | 1 | 10 | 1 | 0 | 3 | 1 | 0 | 3 | 0 |
| 6 | `hub/analytics/scorecard` | لوحة الأهداف | Scorecard | mods/acct/Scorecard.jsx | 21 | 1 | 1 | 1 | 17 | 1 | 0 | 2 | 1 | 0 | 3 | 0 |
| 7 | `hub/analytics/scenario` | ماذا-لو | Scenario | mods/acct/Scenario.jsx | 15 | 0 | 1 | 1 | 11 | 2 | 0 | 3 | 1 | 0 | 3 | 0 |
| 8 | `hub/analytics/ai` | المركز الذكي | AiCenter | mods/acct/AiCenter.jsx | 16 | 0 | 0 | 4 | 10 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| 9 | `hub/analytics/alerts` | التنبيهات | AlertsCenter | mods/acct/AlertsCenter.jsx | 33 | 0 | 0 | 10 | 20 | 3 | 0 | 6 | 0 | 0 | 0 | 0 |
| 10 | `hub/analytics/anomaly` | الأنماط الشاذة | Anomalies | mods/acct/Anomalies.jsx | 10 | 0 | 0 | 1 | 7 | 2 | 0 | 1 | 0 | 0 | 0 | 0 |
| 11 | `hub/analytics/actions` | الإجراءات والتوصيات | ActionsBoard | mods/acct/ActionsBoard.jsx | 14 | 0 | 0 | 1 | 8 | 5 | 0 | 17 | 0 | 0 | 0 | 0 |
| 12 | `hub/analytics/forecast` | توقع المبيعات | SalesForecast | mods/acct/SalesForecast.jsx | 11 | 0 | 0 | 1 | 8 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| 13 | `hub/analytics/profit` | ربحية الفروع اليومية | ProfitBoard | mods/acct/ProfitBoard.jsx | 12 | 1 | 0 | 1 | 9 | 1 | 0 | 16 | 0 | 0 | 3 | 0 |
| 14 | `hub/analytics/menu` | هندسة القائمة | MenuEngineering | mods/acct/MenuEngineering.jsx | 14 | 0 | 1 | 1 | 8 | 4 | 0 | 3 | 0 | 0 | 3 | 0 |
| 15 | `hub/analytics/savings` | خطة التوفير | SavingsPlan | mods/acct/SavingsPlan.jsx | 15 | 0 | 1 | 1 | 10 | 3 | 0 | 2 | 0 | 0 | 3 | 0 |
| 16 | `hub/reporting/reports` | التقارير المالية | Reports | mods/acct/Reports.jsx | 12 | 0 | 2 | 1 | 7 | 2 | 0 | 3 | 2 | 2 | 1 | 0 |
| 17 | `hub/reporting/rbuild` | منشئ التقارير | ReportBuilder | mods/acct/ReportBuilder.jsx | 33 | 0 | 2 | 1 | 25 | 5 | 0 | 10 | 2 | 2 | 4 | 0 |
| 18 | `hub/reporting/boardpack` | تقرير الإدارة الشهري | BoardPack | mods/acct/BoardPack.jsx | 8 | 0 | 1 | 1 | 5 | 1 | 0 | 1 | 7 | 2 | 3 | 0 |
| 19 | `hub/reporting/cashflow` | التدفق النقدي (13 أسبوعًا) | CashFlow13 | mods/acct/CashFlow13.jsx | 22 | 0 | 1 | 1 | 19 | 1 | 0 | 13 | 0 | 0 | 3 | 0 |
| 20 | `hub/purchasing/suppliers` | المشتريات والفواتير | Suppliers | mods/inv/Suppliers.jsx | 23 | 0 | 0 | 4 | 14 | 5 | 0 | 104 | 9 | 3 | 0 | 1 |
| 21 | `hub/purchasing/reorder` | المشتريات الذكية | SmartPurchasing | mods/inv/SmartPurchasing.jsx | 13 | 0 | 2 | 3 | 5 | 3 | 0 | 3 | 2 | 2 | 3 | 0 |
| 22 | `hub/purchasing/suprep` | تقرير مشتريات الموردين | SupplierPurchReport | mods/acct/TaxPurchReports.jsx | 17 | 0 | 1 | 3 | 9 | 4 | 0 | 3 | 3 | 3 | 4 | 0 |
| 23 | `hub/closehub/closing` | الإغلاق اليومي | Closing | mods/closing/Closing.jsx | 27 | 6 | 0 | 0 | 20 | 1 | 0 | 9 | 1 | 0 | 0 | 0 |
| 24 | `hub/closehub/approve` | التدقيق والاعتماد | Approvals | mods/closing/Approvals.jsx | 13 | 2 | 0 | 0 | 10 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| 25 | `hub/closehub/shifts` | المواعيد والتذكيرات | Shifts | mods/hr/Shifts.jsx | 10 | 0 | 0 | 0 | 9 | 1 | 0 | 7 | 0 | 0 | 0 | 0 |
| 26 | `hub/closehub/cashiers` | سجل الكاشير | CashierBook | mods/pos/CashierBook.jsx | 13 | 0 | 0 | 0 | 11 | 2 | 0 | 1 | 2 | 2 | 0 | 0 |
| 27 | `hub/closehub/myactions` | إجراءات الفرع | ActionsBoard | mods/acct/ActionsBoard.jsx | 12 | 0 | 0 | 0 | 7 | 5 | 0 | 17 | 0 | 0 | 0 | 0 |
| 28 | `hub/closehub/myforecast` | توقع مبيعات الفرع | SalesForecast | mods/acct/SalesForecast.jsx | 9 | 0 | 0 | 0 | 7 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| 29 | `hub/closehub/fsafety` | سجل سلامة الغذاء | FoodSafety | mods/closing/FoodSafety.jsx | 11 | 0 | 0 | 0 | 8 | 3 | 0 | 14 | 1 | 2 | 0 | 0 |
| 30 | `hub/closehub/prepdaily` | التحضير اليومي (باركود) | PrepDaily | mods/inv/PrepBatches.jsx | 12 | 0 | 0 | 0 | 9 | 3 | 0 | 30 | 6 | 3 | 0 | 0 |
| 31 | `hub/closehub/cashcount` | الجرد النقدي المفاجئ | CashCount | mods/closing/CashCount.jsx | 11 | 0 | 0 | 0 | 10 | 1 | 0 | 12 | 2 | 2 | 0 | 0 |
| 32 | `hub/closehub/maint` | صيانة المعدات | Maintenance | mods/closing/Maintenance.jsx | 11 | 0 | 0 | 0 | 10 | 1 | 0 | 37 | 1 | 2 | 0 | 0 |
| 33 | `hub/finhub/acct` | المحاسبة | Accounting | mods/acct/Accounting.jsx | 19 | 0 | 0 | 0 | 17 | 2 | 0 | 156 | 68 | 19 | 25 | 5 |
| 34 | `hub/finhub/treasury` | الخزينة والترحيل | Treasury | mods/acct/Treasury.jsx | 13 | 2 | 0 | 0 | 9 | 2 | 0 | 2 | 4 | 2 | 0 | 0 |
| 35 | `hub/finhub/entities` | المنشآت | EntitiesCenter | mods/acct/EntitiesCenter.jsx | 11 | 0 | 0 | 0 | 9 | 2 | 0 | 13 | 1 | 0 | 0 | 0 |
| 36 | `hub/finhub/cardrec` | مطابقة تسويات الشبكة | CardRecon | mods/acct/CardRecon.jsx | 6 | 0 | 0 | 0 | 5 | 1 | 0 | 4 | 1 | 0 | 7 | 5 |
| 37 | `hub/finhub/ibanctl` | ضبط حسابات الدفع | IbanControl | mods/acct/IbanControl.jsx | 9 | 0 | 0 | 0 | 5 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| 38 | `hub/docshub/docs` | مركز المستندات | DocsCenter | mods/acct/DocsCenter.jsx | 10 | 1 | 1 | 2 | 3 | 3 | 0 | 24 | 1 | 0 | 3 | 0 |
| 39 | `hub/docshub/archive` | الأرشيف | Archive | mods/acct/Archive.jsx | 20 | 0 | 0 | 2 | 3 | 15 | 0 | 10 | 0 | 0 | 0 | 2 |
| 40 | `hub/hr/attendance` | الحضور الموثَّق | Attendance | mods/hr/Attendance.jsx | 12 | 0 | 0 | 0 | 10 | 2 | 0 | 13 | 2 | 3 | 0 | 0 |
| 41 | `hub/hr/leaves` | الإجازات | Leaves | mods/hr/Leaves.jsx | 19 | 0 | 0 | 0 | 12 | 7 | 0 | 18 | 2 | 0 | 0 | 0 |
| 42 | `hub/hr/shiftengine` | محرّك الورديات | ShiftEngine | mods/hr/ShiftEngine.jsx | 13 | 0 | 0 | 0 | 11 | 2 | 0 | 25 | 5 | 0 | 0 | 0 |
| 43 | `hub/hr/staffplan` | تخطيط العمالة من التوقع | StaffingPlan | mods/hr/StaffingPlan.jsx | 10 | 0 | 0 | 0 | 7 | 3 | 0 | 5 | 0 | 0 | 0 | 0 |
| 44 | `hub/hr/tasks` | المهام | Tasks | mods/hr/Tasks.jsx | 11 | 0 | 0 | 0 | 9 | 2 | 0 | 32 | 3 | 0 | 0 | 0 |
| 45 | `hub/hr/points` | دفتر النقاط | PointsLedger | mods/hr/PointsLedger.jsx | 12 | 0 | 0 | 0 | 10 | 2 | 0 | 24 | 3 | 0 | 0 | 0 |
| 46 | `hub/hr/esign` | التوقيع الإلكتروني | ESign | mods/hr/ESign.jsx | 10 | 0 | 0 | 0 | 7 | 2 | 0 | 5 | 2 | 3 | 0 | 0 |
| 47 | `hub/hr/hrmaster` | البيانات الرئيسية | HrMaster | mods/hr/HrMaster.jsx | 11 | 0 | 0 | 0 | 9 | 2 | 0 | 73 | 4 | 2 | 0 | 0 |
| 48 | `hub/hr/hrpolicy` | السياسات والأدوار | HrPolicy | mods/hr/HrPolicy.jsx | 12 | 1 | 0 | 0 | 9 | 2 | 0 | 10 | 4 | 0 | 0 | 0 |
| 49 | `hub/hr/payroll` | الرواتب والسلف | Payroll | mods/hr/Payroll.jsx | 23 | 1 | 1 | 0 | 18 | 1 | 0 | 50 | 7 | 5 | 3 | 0 |
| 50 | `hub/hr/muster` | مسير الرواتب | PayrollMuster | mods/hr/PayrollMuster.jsx | 9 | 0 | 1 | 0 | 7 | 1 | 0 | 2 | 2 | 2 | 3 | 0 |
| 51 | `hub/hr/overtime` | مسير الأجور الإضافية | OvertimeSheet | mods/hr/OvertimeSheet.jsx | 12 | 2 | 1 | 0 | 7 | 2 | 0 | 3 | 2 | 2 | 3 | 0 |
| 52 | `hub/hr/workforce` | تخطيط العمالة والتكلفة | Workforce | mods/hr/Workforce.jsx | 14 | 0 | 1 | 0 | 11 | 2 | 0 | 6 | 3 | 2 | 3 | 0 |
| 53 | `hub/hr/empfile` | ملف الموظف | EmployeeFile | mods/hr/EmployeeFile.jsx | 8 | 0 | 0 | 0 | 7 | 1 | 0 | 6 | 4 | 2 | 0 | 0 |
| 54 | `hub/hr/kpi` | الأداء والتقييم | Performance | mods/hr/Performance.jsx | 12 | 0 | 0 | 0 | 10 | 2 | 0 | 23 | 4 | 1 | 0 | 0 |
| 55 | `hub/hr/rolekpi` | مؤشرات الأداء بالدور | RoleKpi | mods/hr/RoleKpi.jsx | 10 | 0 | 0 | 0 | 8 | 2 | 0 | 20 | 1 | 0 | 0 | 0 |
| 56 | `hub/hr/rewards` | المكافآت والجزاءات | Rewards | mods/hr/Rewards.jsx | 10 | 0 | 0 | 0 | 8 | 2 | 0 | 18 | 1 | 0 | 0 | 0 |
| 57 | `hub/hr/corrective` | الإجراءات التصحيحية | Corrective | mods/hr/Corrective.jsx | 11 | 0 | 0 | 0 | 9 | 2 | 0 | 60 | 1 | 0 | 0 | 0 |
| 58 | `hub/hr/training` | التدريب والشهادات | Training | mods/hr/Training.jsx | 11 | 0 | 0 | 0 | 9 | 2 | 0 | 30 | 2 | 0 | 0 | 0 |
| 59 | `hub/hr/perfsnap` | تجميد الأداء الشهري | PerfSnap | mods/hr/PerfSnap.jsx | 8 | 1 | 0 | 0 | 6 | 1 | 0 | 1 | 2 | 0 | 3 | 0 |
| 60 | `hub/hr/hrdash` | لوحة الموارد البشرية | HrDashboard | mods/hr/HrDashboard.jsx | 10 | 0 | 0 | 0 | 8 | 2 | 0 | 2 | 4 | 2 | 3 | 0 |
| 61 | `acct/jr` | المحاسبة — القيود اليومية | Accounting | mods/acct/Accounting.jsx | 13 | 0 | 0 | 0 | 12 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 62 | `acct/coa` | المحاسبة — دليل الحسابات | Accounting | mods/acct/Accounting.jsx | 13 | 0 | 0 | 0 | 12 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 63 | `acct/tb` | المحاسبة — ميزان المراجعة | Accounting | mods/acct/Accounting.jsx | 16 | 0 | 0 | 0 | 15 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 64 | `acct/fs` | المحاسبة — القوائم المالية | Accounting | mods/acct/Accounting.jsx | 16 | 0 | 0 | 0 | 15 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 65 | `acct/food` | المحاسبة — تكلفة الطعام بالفروع | Accounting | mods/acct/Accounting.jsx | 15 | 0 | 0 | 0 | 14 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 66 | `acct/cf` | المحاسبة — التدفقات النقدية | Accounting | mods/acct/Accounting.jsx | 16 | 0 | 0 | 0 | 15 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 67 | `acct/fcast` | المحاسبة — التوقّع النقدي | Accounting | mods/acct/Accounting.jsx | 14 | 1 | 0 | 0 | 12 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 68 | `acct/bud` | المحاسبة — الموازنة | Accounting | mods/acct/Accounting.jsx | 13 | 1 | 0 | 0 | 11 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 69 | `acct/anl` | المحاسبة — التحليل والنِسَب | Accounting | mods/acct/Accounting.jsx | 16 | 0 | 0 | 0 | 15 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 70 | `acct/unbilled` | المحاسبة — مستلم لم يُفوتر | Accounting | mods/acct/Accounting.jsx | 12 | 0 | 0 | 0 | 11 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 71 | `acct/apage` | المحاسبة — أعمار الموردين | Accounting | mods/acct/Accounting.jsx | 15 | 0 | 0 | 0 | 14 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 72 | `acct/arage` | المحاسبة — أعمار العملاء | Accounting | mods/acct/Accounting.jsx | 13 | 0 | 0 | 0 | 13 | 0 | 0 | 156 | 68 | 19 | 25 | 5 |
| 73 | `acct/export` | المحاسبة — تصدير للمحاسب | Accounting | mods/acct/Accounting.jsx | 25 | 0 | 10 | 0 | 14 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 74 | `acct/cc` | المحاسبة — مراكز التكلفة | Accounting | mods/acct/Accounting.jsx | 17 | 1 | 0 | 0 | 15 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 75 | `acct/vat` | المحاسبة — الضريبة (ق.م) | Accounting | mods/acct/Accounting.jsx | 26 | 1 | 1 | 0 | 21 | 2 | 0 | 156 | 68 | 19 | 25 | 5 |
| 76 | `acct/vatreg` | المحاسبة — سجلات الضريبة المفصلة | Accounting | mods/acct/Accounting.jsx | 22 | 0 | 1 | 0 | 18 | 3 | 0 | 156 | 68 | 19 | 25 | 5 |
| 77 | `acct/einv` | المحاسبة — الفوترة (زاتكا) | Accounting | mods/acct/Accounting.jsx | 23 | 0 | 0 | 0 | 16 | 3 | 0 | 156 | 68 | 19 | 25 | 5 |
| 78 | `acct/zakat` | المحاسبة — الزكاة وضريبة الدخل | Accounting | mods/acct/Accounting.jsx | 18 | 1 | 1 | 0 | 15 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 79 | `acct/suprep` | المحاسبة — مشتريات الموردين بطرق الدفع | Accounting | mods/acct/Accounting.jsx | 22 | 0 | 1 | 0 | 18 | 3 | 0 | 156 | 68 | 19 | 25 | 5 |
| 80 | `acct/ast` | المحاسبة — الأصول والإهلاك | Accounting | mods/acct/Accounting.jsx | 14 | 0 | 0 | 0 | 13 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 81 | `acct/bank` | المحاسبة — التسوية البنكية | Accounting | mods/acct/Accounting.jsx | 15 | 2 | 0 | 0 | 11 | 2 | 0 | 156 | 68 | 19 | 25 | 5 |
| 82 | `acct/mclose` | المحاسبة — حزمة الإقفال | Accounting | mods/acct/Accounting.jsx | 23 | 0 | 1 | 4 | 17 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 83 | `acct/ctrl` | المحاسبة — الضوابط والتدقيق | Accounting | mods/acct/Accounting.jsx | 13 | 1 | 0 | 0 | 11 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 84 | `acct/lock` | المحاسبة — الإقفال الشهري | Accounting | mods/acct/Accounting.jsx | 14 | 1 | 0 | 0 | 11 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 85 | `acct/astl` | المحاسبة — تسوية التطبيقات | Accounting | mods/acct/Accounting.jsx | 13 | 0 | 0 | 0 | 12 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 86 | `acct/ob` | المحاسبة — الأرصدة الافتتاحية | Accounting | mods/acct/Accounting.jsx | 13 | 1 | 0 | 0 | 11 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 87 | `acct/yend` | المحاسبة — إقفال السنة | Accounting | mods/acct/Accounting.jsx | 13 | 1 | 0 | 0 | 11 | 1 | 0 | 156 | 68 | 19 | 25 | 5 |
| 88 | `acct/mizan` | المحاسبة — استيراد البيانات التاريخية | Accounting | mods/acct/Accounting.jsx | 13 | 0 | 0 | 0 | 12 | 0 | 0 | 156 | 68 | 19 | 25 | 5 |
| 89 | `comp/Launcher` | الرئيسية (التطبيقات) | Launcher | App.jsx | 21 | 0 | 0 | 5 | 16 | 0 | 0 | — | — | — | — | — |
| 90 | `comp/PosApp` | نقطة البيع | PosApp | mods/pos/PosApp.jsx | 2 | 1 | 0 | 0 | 1 | 0 | 0 | 26 | 1 | 0 | 3 | 0 |
| 91 | `comp/Inventory` | المخزون والمنتجات | Inventory | mods/inv/Inventory.jsx | 15 | 0 | 1 | 0 | 13 | 1 | 0 | 77 | 9 | 4 | 9 | 6 |
| 92 | `comp/Partners` | جهات الاتصال | Partners | mods/inv/Partners.jsx | 7 | 1 | 0 | 0 | 5 | 1 | 0 | 53 | 2 | 0 | 0 | 0 |
| 93 | `comp/SalesHub` | المبيعات | SalesHub | App.jsx | 9 | 0 | 0 | 1 | 5 | 3 | 0 | — | — | — | — | — |
| 94 | `comp/QrFeedback` | تقييم العملاء QR | QrFeedback | mods/pos/QrFeedback.jsx | 4 | 0 | 0 | 0 | 0 | 3 | 0 | 2 | 0 | 0 | 0 | 0 |
| 95 | `comp/AppsCenter` | إدارة التطبيقات | AppsCenter | mods/admin/AppsCenter.jsx | 60 | 0 | 0 | 28 | 31 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| 96 | `comp/BranchWarehouse` | مستودع الفرع | BranchWarehouse | mods/inv/BranchWarehouse.jsx | 11 | 0 | 0 | 0 | 8 | 3 | 0 | 23 | 7 | 0 | 0 | 1 |
| 97 | `comp/Admin` | الإعدادات والمستخدمون | Admin | mods/admin/Admin.jsx | 15 | 3 | 0 | 0 | 11 | 1 | 0 | 0 | 2 | 0 | 0 | 0 |
| 98 | `comp/AuditView` | سجل التدقيق | AuditView | App.jsx | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — | — | — | — | — |

**الإجمالي:** 98 شاشة، 1425 زرًا ظاهرًا: UI 1053, NO_EFFECT 192, NAV 98, OUTPUT 36, DATA 35, DISABLED 10, UNCLICKABLE 1

\* عدّ ثابت من ملف المكوّن (عدد مواضع الحقول/الجداول/الطباعة/التصدير/الاستيراد في الكود) — مؤشر حجم، لا اختبار.

## ملفات في mods/ ليست شاشات مستقلة في التنقل

تُستخدم داخل شاشات أخرى (نوافذ، بطاقات، أقسام):

- `mods/acct/CashVouchers.jsx` — 130 سطرًا، 12 زرًا في الكود
- `mods/acct/DailyBranchReport.jsx` — 147 سطرًا، 7 زرًا في الكود
- `mods/acct/EInvoiceOnboard.jsx` — 156 سطرًا، 9 زرًا في الكود
- `mods/acct/FinancialReports.jsx` — 214 سطرًا، 7 زرًا في الكود
- `mods/acct/IncomeStatement.jsx` — 184 سطرًا، 2 زرًا في الكود
- `mods/acct/MizanMerge.jsx` — 254 سطرًا، 7 زرًا في الكود
- `mods/admin/AppPermsPanel.jsx` — 98 سطرًا، 2 زرًا في الكود
- `mods/admin/BranchForm.jsx` — 47 سطرًا، 2 زرًا في الكود
- `mods/admin/CategoriesPanel.jsx` — 93 سطرًا، 4 زرًا في الكود
- `mods/admin/CloseAlertsCard.jsx` — 62 سطرًا، 2 زرًا في الكود
- `mods/admin/CloudHealth.jsx` — 84 سطرًا، 8 زرًا في الكود
- `mods/admin/DeliveryAppsPanel.jsx` — 84 سطرًا، 2 زرًا في الكود
- `mods/admin/MfaPolicyCard.jsx` — 36 سطرًا، 2 زرًا في الكود
- `mods/admin/PasswordPanel.jsx` — 40 سطرًا، 1 زرًا في الكود
- `mods/admin/SystemMaintenance.jsx` — 402 سطرًا، 12 زرًا في الكود
- `mods/admin/SystemPanel.jsx` — 620 سطرًا، 20 زرًا في الكود
- `mods/admin/UserForm.jsx` — 129 سطرًا، 7 زرًا في الكود
- `mods/closing/ClosingForm.jsx` — 968 سطرًا، 34 زرًا في الكود
- `mods/closing/ClosingView.jsx` — 180 سطرًا، 5 زرًا في الكود
- `mods/closing/OutputDialog.jsx` — 120 سطرًا، 12 زرًا في الكود
- `mods/hr/HrSignPad.jsx` — 63 سطرًا، 2 زرًا في الكود
- `mods/hr/SignDocsModal.jsx` — 115 سطرًا، 4 زرًا في الكود
- `mods/inv/BlindCount.jsx` — 146 سطرًا، 9 زرًا في الكود
- `mods/inv/ContactsImport.jsx` — 82 سطرًا، 5 زرًا في الكود
- `mods/inv/CountScheduleCard.jsx` — 43 سطرًا، 3 زرًا في الكود
- `mods/inv/ForecastPurchase.jsx` — 87 سطرًا، 3 زرًا في الكود
- `mods/inv/ItemLedger.jsx` — 95 سطرًا، 3 زرًا في الكود
- `mods/inv/PrepList.jsx` — 60 سطرًا، 1 زرًا في الكود
- `mods/inv/PriceAlerts.jsx` — 41 سطرًا، 0 زرًا في الكود
- `mods/inv/Production.jsx` — 133 سطرًا، 8 زرًا في الكود
- `mods/inv/StockVouchers.jsx` — 138 سطرًا، 9 زرًا في الكود
- `mods/inv/TurnoverPpv.jsx` — 76 سطرًا، 3 زرًا في الكود
- `mods/inv/UsageVariance.jsx` — 142 سطرًا، 5 زرًا في الكود
- `mods/inv/WarehousesPanel.jsx` — 283 سطرًا، 15 زرًا في الكود
- `mods/inv/WasteControl.jsx` — 105 سطرًا، 7 زرًا في الكود
- `mods/inv/WasteFields.jsx` — 26 سطرًا، 2 زرًا في الكود
- `mods/inv/WastePending.jsx` — 67 سطرًا، 5 زرًا في الكود
- `mods/pos/PosImport.jsx` — 163 سطرًا، 6 زرًا في الكود
- `mods/pos/PosLoyalty.jsx` — 60 سطرًا، 5 زرًا في الكود
- `mods/pos/PosPromos.jsx` — 83 سطرًا، 10 زرًا في الكود
- `mods/pos/PosQuickProducts.jsx` — 39 سطرًا، 2 زرًا في الكود
- `mods/pos/PosSettings.jsx` — 52 سطرًا، 3 زرًا في الكود
- `mods/pos/PosShifts.jsx` — 71 سطرًا، 6 زرًا في الكود
- `mods/pos/QrBranchesView.jsx` — 145 سطرًا، 9 زرًا في الكود
- `mods/pos/QrComplaints.jsx` — 70 سطرًا، 4 زرًا في الكود
- `mods/pos/QrDashboard.jsx` — 163 سطرًا، 1 زرًا في الكود
- `mods/pos/Sales.jsx` — 118 سطرًا، 4 زرًا في الكود
- `mods/pos/SalesInvoices.jsx` — 205 سطرًا، 14 زرًا في الكود
