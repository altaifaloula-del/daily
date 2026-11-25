# معايير الجودة المحاسبية — MITHQAL ERP

المرجع الملزم لكل وكيل يمس رقمًا ماليًا. **لا معالجة تُعدّ صحيحة دون إثباتها من المتطلبات أو مرجع معتمد.**

## 1. الإطار
- IFRS كما اعتمدتها الهيئة السعودية للمراجعين والمحاسبين (SOCPA)، أو IFRS للمنشآت الصغيرة والمتوسطة — **يحدده المالك** (لم يُوثَّق بعد في سجل القرارات).
- ضريبة القيمة المضافة والفوترة الإلكترونية وفق أنظمة ZATCA الرسمية (المهارة `saudi-zatca-compliance`).
- قرارات المالك في `PROJECT_AUDIT/ERP_V48/DECISION_LOG.md` تُطبَّق كما هي.

## 2. نطاق المراجعة الإلزامي
| البند | ما يُفحص | الدالة/الموضع | المهارة |
|---|---|---|---|
| دليل الحسابات وشجرته | الرمز، النوع، الطبيعة، قابلية الترحيل، لا تكرار | `buildAccounting` | general-ledger |
| القيود اليومية | التوازن، الحسابات، التاريخ، المصدر، الحالة | `jeLive`، `fin_journal` | general-ledger |
| الأستاذ العام | افتتاحي + حركة = ختامي | `glLedger`، `acctActivity` | general-ledger |
| ميزان المراجعة | توازن، مطابقة الأستاذ | تبويب المحاسبة | general-ledger |
| الذمم المدينة والدائنة | المساعد = الإجمالي، الأعمار | `customerAging`، `partyOpenDocs` | accounts-receivable-payable |
| التسويات البنكية | تساوي الرصيدين المعدّلين | `cardRecon`، `parseMt940` | bank-reconciliation |
| الأصول والإهلاك | القسط، المجمع، العمر | `deprSchedule`، `depMethod` | accounting-standards |
| المخزون وتكلفة البضاعة | المتوسط المرجّح، لا سالب | `stockCosting`، `itemAvgCosts` | cost-accounting |
| مراكز التكلفة | الفروع، توزيع المشترك | `profitMatrix` | cost-accounting |
| الإيرادات والمصروفات | الصافي من الضريبة، الفترة الصحيحة | `buildAccounting` | accounting-standards |
| الإقفالات المالية | منع الترحيل في المقفل، أثر التعديل | `periodLocked`، `fpLockedTo` | general-ledger |
| قائمة الدخل | الربط بالميزان | `isLayout` | financial-statements |
| المركز المالي | الأصول = الالتزامات + الملكية + الربح | تبويب `fs` | financial-statements |
| التدفقات النقدية | تغير النقد = فرق أرصدة `cash:true` | تبويب `cf` | financial-statements |
| الأرباح والخسائر حسب الفرع | Σالفروع = الإجمالي | `profitDays` | financial-statements |
| المطاعم والوصفات والهالك | تكلفة الطبق، المردود، الهدر | `recipeCost`، `wasteRows` | restaurant-accounting |
| الضريبة والفوترة الإلكترونية | الحساب، QR، السلسلة، الإقرار | `zatca/`، `vatRegister` | saudi-zatca-compliance |

## 3. اختبارات التوازن والاتساق والمطابقة
1. **توازن:** كل قيد مرحّل مدين = دائن بالهللات (عدد صحيح، بلا تسامح).
2. **اتساق:** الرقم نفسه من مصدرين (الإغلاقات مقابل القيود؛ المساعد مقابل الإجمالي؛ الشاشة مقابل الطباعة مقابل Excel) متطابق أو الفرق مفسَّر.
3. **مطابقة مصادر البيانات:** Σسجلات المصدر = رقم التقرير (`checkSourceVsReport`).
4. **صحة المعالجة وليس التوازن فقط:** كل نوع عملية له قيد متوقع مكتوب يدويًا يُقارن حسابًا بحساب (`expected.entry`).

## 4. محرك التحقق المستقل
`tests/validation/ledger-validator.mjs` — مستقل عن `App.jsx`. الفحوص:

| الفحص | المعرّف |
|---|---|
| توازن القيد والميزان | `balance.entry`، `tb.balanced` |
| صحة الترحيل | `posting.account-missing`، `posting.non-postable`، `posting.date`، `posting.status` |
| عدم تكرار الترحيل | `posting.duplicate-source`، `posting.duplicate-id` |
| سلامة العكس | `reversal.mirror`، `reversal.double`، `reversal.orphan`، `reversal.date` |
| أرصدة الحسابات | `balance.account` |
| الأستاذ مقابل الميزان | `gl-vs-tb` |
| العملاء والموردون | `subledger.control`، `subledger.match`، `subledger.party` |
| التسوية البنكية | `bank.reconcile`، `bank.reported` |
| الإهلاك | `depreciation` |
| المخزون والتكلفة | `inventory.qty`، `inventory.value`، `inventory.negative` |
| إقفال الفترات | `period.locked`، `period.close` |
| القوائم المالية | `statements.*`، `statements.equation` |
| المصادر مع التقارير | `source-vs-report` |
| تعدد العملات | `fx.rate`، `fx.conversion` |
| الكسور والتقريب | `rounding.precision` |
| تعدد المنشآت | `tenant.isolation` |
| القيد المتوقع | `expected.entry`، `expected.missing` |

## 5. قواعد التقريب
- الحساب الداخلي بالهللات (أعداد صحيحة). المبالغ المعروضة بخانتين.
- ضريبة السطر تُقرب ثم تُجمع، أو تُجمع ثم تُقرب — **حسب المواصفة الرسمية للفاتورة**، وتُوثَّق في كل دالة.
- فروق التقريب لا تُخفى في حساب عشوائي؛ لها حساب معلن وقيد ظاهر.

## 6. مستويات الخطورة
| المستوى | أمثلة | الأثر على البوابة |
|---|---|---|
| حرجة | قيد غير متوازن، ترحيل مكرر، ترحيل في فترة مقفلة، رصيد خاطئ، خلط منشآت | FAIL |
| عالية | تاريخ عكس خاطئ، حساب رئيسي مُرحّل عليه، تحويل عملة | FAIL |
| متوسطة | قيد صفري | ملاحظة |

## 7. الصلاحيات المحاسبية
- لا يعتمد منشئ القيد قيده (`canApproveJe`).
- القيد اليدوي يعتمده المحاسب أو المالك (قرار المالك).
- قيد إقفال الوردية مسودة حتى اعتماد المحاسب (قرار المالك).
- لا تعديل لقيد مرحّل؛ التصحيح بقيد عكسي مع أثر في `audit_log`.
