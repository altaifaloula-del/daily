# الذكاء المالي والرقابة المستمرة — الواجهات البرمجية والأمان والنشر (v54.0 — v54.7)

المعادلات التفصيلية: `FIN_INTEL_FORMULAS.md` (مولَّد من المحرك). سجل الإصدارات: `RELEASE_NOTES.md`.

## 1. المكونات

| المرحلة | الإصدار | الشاشة (مركز التحليل) | المحرك / الخادم |
|---|---|---|---|
| 1 التحليل المالي المتقدم | v54.0 | `analytics:finintel` | `finAnalyze`, `FA_RATIOS` (App.jsx) |
| 2 سجل حالات الرقابة | v54.1 | `analytics:cases` | `ctlScan`, `caseSync`, `caseMove` — التخزين `ops.ctlCases` |
| 3 التوصيات المالية | v54.2 | `analytics:recs` | `finRecs`, `recRealized` + لوحة الإجراءات |
| 4 لوحة المدير المالي | v54.3 | `analytics:cfo` | `cfoDash` |
| 5 مكتبة المراجع | v54.4 | `analytics:refs` | `ref-lib.mjs`, `server-refs.js` |
| 6 وكيل المراجعة | v54.5 | داخل `analytics:cases` | `revValidate` + `/api/refs/review` + `/api/mcp/proposals/review` |
| 7 الحوكمة | v54.6 | «ربط Claude» (سجل الذكاء الاصطناعي، نطاق الروابط) | `server-ailog.js`, `mcpScope` |
| 8 الجودة والتوثيق | v54.7 | — | هذا الملف، `gen-fin-docs.mjs`، اختبار القواعد |

## 2. الواجهات البرمجية الجديدة (الخادم على Render)

كل المسارات تتطلب رمز Firebase لعضو نشط (`requireMember`) وتعمل بحساب الخدمة `FIREBASE_SERVICE_ACCOUNT`؛ بدونه ترد 409 `no-sa`.

| المسار | الدور | الوظيفة | يكتب في |
|---|---|---|---|
| `GET /api/refs` | أي عضو | قائمة المراجع والتصنيفات والحجية | — |
| `POST /api/refs/search` | أي عضو | بحث نصي، `rerank` اختياري بـ Claude | — |
| `POST /api/refs/upload` | مسؤول النظام | رفع `{meta, pages}` أو `{meta, pdf}` (مهمة غير متزامنة) | `ref_docs`, `ref_chunks` |
| `GET /api/refs/job/:id` | أي عضو | حالة مهمة الرفع | — |
| `POST /api/refs/update` | مسؤول النظام | البيانات الوصفية والحالة والتوثيق | `ref_docs` |
| `POST /api/refs/review` | المالية والإدارة¹ | مراجعة حتى 10 حالات بالمراجع | لا شيء (النتيجة تُحفظ في الحالة من التطبيق) |
| `POST /api/mcp/proposals/review` | المالية والإدارة¹ | قيد تصحيحي من الوكيل ⇐ مقترح | `mcp_proposals` (pending) |
| `GET /api/ai/log` | مسؤول النظام | آخر 300 سطر من سجل الذكاء الاصطناعي | — |
| `POST /api/mcp/links` | مسؤول النظام | رابط Claude مع `branches` اختياري (نطاق) | `mcp_tokens` |

¹ `system_admin`, `finance_department`, `accountant`, `general_management`, `head_office`.

أداة الموصل الجديدة: `search_references` (قراءة). أدوات `propose_*` تبقى مقترحات لا تُنفَّذ إلا باعتماد مسؤول النظام.

## 3. الأمان والضوابط المتحقَّق منها في الخادم وقواعد البيانات

- **المجموعات الخادمية** `ref_docs`, `ref_chunks`, `ai_log`, `mcp_tokens`, `mcp_proposals`: لا قاعدة تسمح بها، فتمنعها القاعدة العامة `match /{document=**} { allow read, write: if false; }` — يختبر ذلك `tests/rules.test.mjs` (v54.7) على محاكي Firestore في CI.
- **الذكاء الاصطناعي لا يرحّل ولا يعدّل:** كل كتابة من Claude أو من الوكيل تُحفظ «مقترحًا» `pending` وتنفَّذ بالحفظ العادي في التطبيق بعد اعتماد مسؤول النظام (نفس حراس الإقفال والتوازن والتكرار).
- **الاستشهاد:** لا يُقبل إلا من مقطع مُرسل وبنص حرفي فيه (`revValidate`)، والحجية تُشتق من بيانات المرجع لا من النموذج.
- **نطاق الفروع:** الرابط المقيّد يرى فروعه فقط في الخادم والعامل المعزول (`mcpScope`)، ويرفض القيود على المركز أو خارج النطاق.
- **سجل الذكاء الاصطناعي:** من/متى/الوظيفة/النتيجة/المدة — بلا نصوص الطلبات أو الأرقام المالية؛ فشل التسجيل لا يعطل الطلب.
- **حقوق النشر:** المستودع عام — لا تُرفع نصوص المعايير أو بيانات المنشأة إليه؛ المراجع تُرفع من التطبيق إلى Firestore الخاص بالمنشأة فقط.
- **الأخطاء التقنية** (سجل أخطاء الأجهزة) منفصلة عن سجل حالات الرقابة المحاسبية.

## 4. النشر

متغيرات Render (Environment) — لا تُلصق قيمها في أي محادثة أو ملف:

| المتغير | إلزامي | الاستخدام |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | نعم | JSON حساب الخدمة؛ مشروع البيانات يُشتق منه (لا تضف `FIREBASE_PROJECT_ID` — يكسر التحقق من العضوية، انظر BUG-017) |
| `ANTHROPIC_API_KEY` | للمراجع (PDF)، الترتيب، الوكيل | بدونه: البحث النصي يعمل، والوكيل يرد 503 `no-ai` |
| `REF_MODEL` | لا | نموذج المراجع والوكيل (الافتراضي `claude-haiku-5-5`) |
| `MCP_PUBLIC_BASE` | لا | الرابط العام لروابط Claude |

الخطوات: دمج PR في `main` ⇐ يبني GitHub Actions الواجهة وينشرها على Pages وينشر قواعد Firestore ⇐ يعيد Render بناء الخادم من `Dockerfile` (يجب أن ينسخ `server-refs.js ref-lib.mjs server-ailog.js` — يتحقق منه اختبار). التحقق بعد النشر: `/api/health/config` (`serviceAccount.readsData: true`).

## 5. الاختبارات

- المحرك والخادم: `npm test` (finintel، ctlcases، finrecs، cfodash، refs، mcp، gov).
- الواجهة: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node --test --test-name-pattern="v54" tests/ui/ui.test.mjs`.
- القواعد: محاكي Firestore في CI.
- دليل المعادلات: `node scripts/gen-fin-docs.mjs` — و`tests/docs.test.mjs` يفشل إن لم يُحدَّث الملف بعد تغيير المحرك.

## 6. قرارات مؤجَّلة تحتاج موافقة المالك

| البند | السبب |
|---|---|
| نقل الحالات من `ops.ctlCases` إلى مجموعة `fin_cases` مستقلة | ترحيل بيانات إنتاج — لا يُنفَّذ دون موافقة صريحة؛ الحالي متوافق ويعمل |
| OAuth لموصل Claude | الرابط السري يعمل؛ OAuth يلزم عند مشاركة الموصل مع مستخدمين آخرين |
| بيانات المبيعات والنقدية والأرصدة الافتتاحية | غيابها يجعل نسب السيولة والدرجات «بيانات غير كافية» — يُعلن ولا يُختلق |
