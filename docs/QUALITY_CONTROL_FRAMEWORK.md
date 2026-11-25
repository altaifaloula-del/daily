# إطار الرقابة على الجودة والاعتماد — MITHQAL ERP

| البند | القيمة |
|---|---|
| تاريخ التنفيذ | 2026-11-25 |
| النطاق | منظومة الرقابة نفسها: الوكلاء الأربعة، محرك التحقق المحاسبي، البوابات، سياسة الموافقة، اللوحة |
| الفرع | `ai-team-framework` (غير مدموج) |
| قرار الاعتماد | **BLOCKED** — يعمل ومختبر ذاتيًا، لكن فحوصًا إلزامية لم تُشغَّل في هذه البيئة (انظر §8)، ويحتاج اعتماد المالك |

## 1. الدورة الإلزامية
`ANALYZE → PLAN → DEVELOP → TEST → VALIDATE → AUDIT → APPROVE → RELEASE` — التفاصيل والأدلة لكل مرحلة في `AI_TEAM_ARCHITECTURE.md` §5.
لا تُعد مهمة مكتملة دون دليل اختبار، ولا إصدار جاهزًا دون اجتياز بوابته.

## 2. وكلاء الجودة والاعتماد (مستقلون، قراءة فقط)
| الوكيل | المسؤولية | لا يملك |
|---|---|---|
| `quality-assurance-director` | يملك الدورة، يشغّل البوابة، يجمع الأحكام المستقلة، يصدر حكم الجودة | Write/Edit |
| `accounting-validation-agent` | التحقق المحاسبي المستقل بسيناريوهات معروفة النتائج | Write/Edit |
| `design-quality-auditor` | بوابة التصميم: الهوية، الاتساق، RTL/LTR، الطباعة، الأيقونات، لقطات قبل/بعد | Write/Edit |
| `release-approval-agent` | بوابة الإصدار والحالات الأربع | Write/Edit، ومنح الموافقة |

## 3. نظام التحقق التلقائي — الخريطة الكاملة
كل بند مربوط بأداة **موجودة فعلًا** في المشروع (لم تُكرر أدوات قائمة).

### A. الخلفية
| الاختبار | الأداة / الملف | يُشغَّل في البوابة عبر |
|---|---|---|
| Unit Tests | `node:test` — 41 ملفًا في `tests/*.test.mjs` | `engine-tests` (`npm test`) |
| Integration Tests | `tests/functional/cycles.test.mjs`، `tests/tenant-server.test.mjs` | `engine-tests` |
| API Tests | `tests/mcp.test.mjs`، `provider.test.mjs`، `useradmin.test.mjs`، `billing.test.mjs` | `engine-tests` |
| Error Handling Tests | حالات الرفض داخل الملفات السابقة + `tests/zatca.test.mjs` | `engine-tests` |
| Authentication Tests | `tests/useradmin.test.mjs`، `server-auth` عبر `tenant-server.test.mjs` | `engine-tests` |
| Authorization Tests | `tests/editperm.test.mjs`، `security.rules.test.mjs` | `engine-tests`، `rules` |

### B. قاعدة البيانات
| الاختبار | الأداة | البوابة |
|---|---|---|
| Integrity Tests | `tests/validation/` + `integrityChecks` (صيانة النظام) | `accounting-validation`، `engine-tests` |
| Relationship Validation | `subledger.*`، `posting.account-missing`، `reversal.orphan` | `accounting-validation` |
| Migration Tests | `tests/restore.emu.test.mjs` + خطة ترحيل لكل تغيير (مهارة `database-design`) | `rules` |
| Backup and Recovery Tests | `tests/backup.test.mjs`، `restore.test.mjs`، `restore-drill.yml` | `engine-tests`، `rules` |
| Multi-Tenant Isolation Tests | `tests/tenant.rules.test.mjs`، `tenant*.test.mjs`، `tenant.isolation` | `rules`، `engine-tests`، `accounting-validation` |
| Data Consistency Tests | `gl-vs-tb`، `source-vs-report`، `statements.*` | `accounting-validation`، `engine-validation` |

### C. الواجهة
| الاختبار | الأداة | البوابة |
|---|---|---|
| Component Tests | `tests/ui/ui.test.mjs` (165 حالة Playwright) | `ui` |
| Form Validation | حالات النماذج في `ui.test.mjs` | `ui` |
| Navigation Tests | `tests/hubnav.test.mjs` | `engine-tests` |
| RTL/LTR Tests | `ui.test.mjs` + `scripts/i18n-coverage.mjs` | `ui` |
| Responsive Tests | `ui.test.mjs` (جوال وحاسوب) | `ui` |
| Accessibility Tests | **غير موجود آليًا** — قائمة فحص يدوية في `DESIGN_QUALITY_REPORT.md` | `design-review` |

### D. عدم التراجع (Regression)
- تشغيل كل الاختبارات القديمة بعد كل تغيير (البوابة تشغلها كلها، لا المتأثرة فقط).
- مقارنة قبل/بعد: `node scripts/quality-gate.mjs --json > before.json` على `main`، ثم `--baseline before.json` على الفرع. **فحص كان ناجحًا وفشل = FAIL حتى لو غير حرج.**
- اكتشاف المتأثر: `git diff --name-only main...HEAD` (تغييرات الواجهة تفعّل مراجعة التصميم).
- منع اعتماد التراجع: حالة FAIL تمنع الدمج والنشر.

## 4. محرك التحقق المحاسبي المستقل
`tests/validation/ledger-validator.mjs` — لا يستورد شيئًا من `App.jsx`. يعيد الحساب بالهللات، ويقارن بقيود متوقعة مكتوبة يدويًا. التفاصيل والفحوص في `ACCOUNTING_QUALITY_STANDARDS.md` §4 والنتائج في `ACCOUNTING_VALIDATION_REPORT.md`.

## 5. البوابات
| البوابة | الأمر | تمنع |
|---|---|---|
| بوابة التغيير | `node scripts/quality-gate.mjs` | الدمج عند FAIL/BLOCKED |
| بوابة التصميم | `design-lint` + سجل `design-quality-auditor` في `docs/quality/reviews/` | أي تغيير واجهة بلا مراجعة مستقلة لآخر التزام |
| بوابة الموافقة البشرية | `docs/HUMAN_APPROVAL_POLICY.md` | العمليات التسع الحساسة |
| بوابة الإصدار | `node scripts/quality-gate.mjs --release` | النشر عند FAIL/BLOCKED |

### الفحوص الاثنا عشر
| المعرّف | الفئة | حرج | إلزامي في |
|---|---|---|---|
| framework | العملية | ✓ | التغيير، الإصدار |
| accounting-validation | المحاسبة | ✓ | التغيير، الإصدار |
| engine-validation | المحاسبة | ✓ | التغيير، الإصدار |
| design-lint | التصميم | ✓ | التغيير، الإصدار |
| secrets | الأمن | ✓ | التغيير، الإصدار |
| build | البرمجة | ✓ | التغيير، الإصدار |
| engine-tests | البرمجة | ✓ | التغيير، الإصدار |
| rules | الأمن/البيانات | ✓ | التغيير، الإصدار |
| ui | التصميم | ✓ | الإصدار (والتغيير عند تغيير واجهة) |
| design-review | التصميم | ✓ | عند تغيير واجهة |
| open-critical-bugs | العملية | ✓ | الإصدار |
| human-approval | الموافقة | ✓ | الإصدار |

### منطق الحكم
1. انحدار أو فشل فحص حرج ⇒ **FAIL** (يغلب على كل شيء).
2. فحص إلزامي «لم يُشغَّل» (بيئة ناقصة، موافقة غائبة، مراجعة غائبة) ⇒ **BLOCKED**.
3. فشل غير حرج موثق ⇒ **CONDITIONAL PASS**.
4. غير ذلك ⇒ **PASS**.
رموز الخروج: 0 / 0 / 1 / 2. لا نشر عند FAIL أو BLOCKED.

## 6. لوحة الرقابة
`docs/QUALITY_DASHBOARD.md` تُولَّد بـ `--dashboard`: عدد الاختبارات المنفذة والناجحة والفاشلة والمتخطاة، الأخطاء المحاسبية والبرمجية والتصميمية، الثغرات، الموافقات المعلقة، تغطية الدوال الحرجة (بنيوية ومعلنة كذلك)، وجاهزية الإصدار.
**تغطية الأسطر غير مقاسة ولا تُعرض نسبة شكلية.** المتخطى لا يُحسب نجاحًا.

## 7. اختبار المنظومة الرقابية نفسها (أخطاء متعمدة)
| الخطأ المتعمد | البيئة | النتيجة المطلوبة | النتيجة الفعلية |
|---|---|---|---|
| 15 خطأ في الدفتر (عدم توازن، تكرار، عكس خاطئ، فترة مقفلة، عملة، تقريب، منشأة أخرى...) | سيناريوهات في الذاكرة | يُكتشف كل خطأ بفحصه | ✓ 15/15 |
| 4 أخطاء في التقارير المعلنة | سيناريوهات | تُكتشف | ✓ 4/4 |
| قيد متوازن بمعالجة خاطئة (الضريبة داخل الإيراد) | سيناريو | يُكتشف بالقيد المتوقع لا بالتوازن | ✓ |
| تعطيل فحص التوازن في محرك التحقق نفسه | نسخة مؤقتة | تفشل اختبارات المحرك | ✓ |
| تغيير لون الكحلي في التوكنات | نسخة مؤقتة | design-lint يفشل | ✓ |
| SVG بنص برمجي | نسخة مؤقتة | design-lint يفشل | ✓ |
| مفتاح خاص مزروع | مستودع git مؤقت | فحص الأسرار يفشل ولا يطبع القيمة | ✓ |
| خطأ حرج بلا حالة إصلاح | سجل مؤقت | يمنع الإصدار | ✓ |
| فحص حرج فاشل / إلزامي غير مُشغَّل / غير حرج / انحدار | المشغّل الحقيقي | FAIL / BLOCKED / CONDITIONAL / FAIL | ✓ 5/5 (`--self-test`) |

**خطأ حقيقي اكتشفه الاختبار الذاتي وعولج:** تشغيل `node --test` من داخل `node --test` يرث `NODE_TEST_CONTEXT` فيخرج دائمًا بنجاح حتى مع وجود فشل — كان سيجعل البوابة تقبل نتيجة فاشلة. أُصلح في البوابة وفي الاختبار.

## 8. الأخطاء والمخاطر
| النوع | البند |
|---|---|
| متبقٍ | `engine-validation`، `build`، `engine-tests`، `rules`، `ui` لم تُشغَّل هنا (لا شبكة لـ `npm ci`) ⇒ الحكم BLOCKED حتى تُشغَّل في CI أو محليًا |
| متبقٍ | اختبارات الوصولية الآلية غير موجودة |
| متبقٍ | لا صور مرجعية لاختبار الانحدار البصري (تحتاج Playwright) |
| مخاطرة | البوابة لا تُشغَّل تلقائيًا في CI بعد (إضافتها لـ `deploy.yml` تحتاج موافقة لأنها تعدّل سير عمل) |
| مخاطرة | تكرار أسماء الحالات في سجل الأخطاء غير موحّد؛ كشف «المفتوح» يعتمد كلمات (مُصلح/مكتمل/مغلق/منشور) |

## 9. قرار الاعتماد
**BLOCKED** — المنظومة تعمل واختُبرت بأخطاء متعمدة، وتنتظر: (1) تشغيل الفحوص الإلزامية في بيئة فيها الاعتماديات، (2) اعتماد المالك للسياسة وللدمج.
