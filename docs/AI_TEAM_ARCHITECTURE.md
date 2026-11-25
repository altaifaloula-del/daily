# بنية فريق الذكاء الاصطناعي — MITHQAL ERP

## 1. المكونات
| المكون | المسار | العدد |
|---|---|---|
| الوكلاء | `.claude/agents/*.md` | 20 (16 تخصصيًا + 4 للجودة والاعتماد) |
| المهارات | `.claude/skills/<name>/SKILL.md` | 24 |
| الحدود والصلاحيات | `.claude/settings.json` | deny / ask / allow |
| تعليمات المشروع | `CLAUDE.md` | 1 |
| محرك التحقق المحاسبي المستقل | `tests/validation/` | محرك + سيناريوهات + محوّل للمحرك الحقيقي |
| بوابة الجودة والإصدار | `scripts/quality-gate.mjs` | 12 فحصًا، 4 حالات |
| فحص الهوية | `tests/ai-team/design-lint.mjs` + `brand-baseline.json` | — |
| اختبارات الإطار | `tests/ai-team/*.test.mjs` | سلامة الملفات + اختبار البوابة بأخطاء متعمدة |
| الموافقات | `docs/approvals/requests` ← `docs/approvals/granted` | الثاني للمالك وحده |

## 2. الهيكل التنظيمي
```
                         المالك (القرار النهائي والموافقات)
                                     │
                         mithqal-orchestrator (التخطيط والتوزيع)
     ┌───────────────┬───────────────┼────────────────┬─────────────────┐
  المحاسبة        الهندسة          التصميم           الجودة            الاعتماد المستقل
 accounting-chief  erp-architect    uiux-director     qa-engineer       quality-assurance-director
 financial-acct.   database-arch.   reports-designer  security-auditor  accounting-validation-agent
 cost-accountant   backend-eng.     icon-designer                       design-quality-auditor
 zatca-specialist  frontend-eng.                                        release-approval-agent
 financial-ctrl.   integration-eng.
```

## 3. فئات الصلاحيات
| الفئة | الوكلاء | الأدوات |
|---|---|---|
| تنسيق | orchestrator | قراءة، Bash، كتابة الخطط، Agent |
| مراجعة مالية وأمنية (قراءة فقط) | accounting-chief، financial-accountant، cost-accountant، zatca-specialist، financial-controller، security-auditor | Read/Grep/Glob/Bash/Web — **Write وEdit ممنوعان** |
| اعتماد مستقل (قراءة فقط) | quality-assurance-director، accounting-validation-agent، design-quality-auditor، release-approval-agent | Read/Grep/Glob/Bash — **Write وEdit ممنوعان** |
| تصميم معماري (وثائق جديدة فقط) | erp-architect، database-architect | Write بلا Edit |
| تنفيذ | backend، frontend، integration، uiux-director، reports-designer، icon-designer، qa-engineer | Read/Edit/Write/Bash ضمن النطاق |

فوق كل ذلك تُطبَّق قواعد `.claude/settings.json` على الجميع (منع قراءة الأسرار، منع النشر، طلب الموافقة على الدفع والدمج وتعديل القواعد).

## 4. ربط الوكلاء بالمهارات
تُحمَّل المهارات المذكورة في حقل `skills` بالوكيل تلقائيًا عند تشغيله.

| الوكيل | المهارات |
|---|---|
| mithqal-orchestrator | erp-gap-analysis |
| accounting-chief | accounting-standards، general-ledger، financial-statements |
| financial-accountant | general-ledger، financial-statements، bank-reconciliation، accounts-receivable-payable |
| cost-accountant | cost-accounting، restaurant-accounting |
| zatca-specialist | saudi-zatca-compliance |
| financial-controller | bank-reconciliation، accounts-receivable-payable، accounting-standards |
| erp-architect | erp-gap-analysis، erp-module-builder، multi-tenant-architecture |
| database-architect | database-design، multi-tenant-architecture |
| backend-engineer | api-integration، rbac-permissions، erp-module-builder |
| frontend-engineer | design-system، responsive-layouts، premium-ui-design |
| integration-engineer | api-integration، saudi-zatca-compliance |
| uiux-director | premium-ui-design، design-system، dashboard-design، responsive-layouts |
| reports-designer | financial-report-design، pdf-print-engine، excel-reporting |
| icon-designer | app-icon-design، svg-icon-system |
| qa-engineer | erp-regression-testing |
| security-auditor | rbac-permissions، multi-tenant-architecture |
| quality-assurance-director | erp-regression-testing |
| accounting-validation-agent | general-ledger، financial-statements، accounting-standards |
| design-quality-auditor | design-system، financial-report-design، svg-icon-system، responsive-layouts |
| release-approval-agent | erp-regression-testing |

## 5. دورة العمل
```
ANALYZE ─► PLAN ─► DEVELOP ─► TEST ─► VALIDATE ─► AUDIT ─► APPROVE ─► RELEASE
 مراجعون   المنسق   المنفذون   qa-eng.  مدققون       أمن +      المالك     release-approval
 (قراءة)                               مستقلون      مدير جودة  (فعليًا)    + المالك
```
| المرحلة | الدليل المطلوب للانتقال |
|---|---|
| ANALYZE | تقارير المراجعين بأدلة `ملف:سطر` |
| PLAN | جدول المهام: الوكيل، الملفات، معيار القبول |
| DEVELOP | فرق الكود على فرع تطوير |
| TEST | مخرجات الاختبارات المشغّلة |
| VALIDATE | حكم `accounting-validation-agent` و/أو `design-quality-auditor` |
| AUDIT | حكم `security-auditor` + `node scripts/quality-gate.mjs` |
| APPROVE | ملف في `docs/approvals/granted/` يكتبه المالك |
| RELEASE | `node scripts/quality-gate.mjs --release` = PASS أو CONDITIONAL PASS |

## 6. مبدأ الاستقلالية
- الوكيل المنفذ لا يراجع عمله؛ والمدققون المستقلون لا يملكون أدوات كتابة.
- محرك التحقق المحاسبي لا يستورد أي دالة من `App.jsx`؛ يعيد الحساب بالهللات ويقارن بقيود متوقعة مكتوبة يدويًا.
- البوابة لا تعتبر «لم يُشغَّل» نجاحًا.

## 7. منع تعارض التعديلات
- المنسق يحجز الملفات لكل مهمة؛ لا ملف لوكيلين متوازيين.
- `App.jsx` يعدّله وكيل واحد في كل مرة.
- التعديلات المتوازية في worktrees منفصلة (`isolation: worktree`).

## 8. حدود Claude Code المعروفة
- الوكيل الفرعي لا يستدعي وكيلًا فرعيًا؛ لذلك يعمل المنسق كجلسة رئيسية (`claude --agent mithqal-orchestrator`).
- قواعد `settings.json` تُطبَّق على جلسات Claude Code فقط؛ الحماية النهائية للبيانات تبقى في قواعد Firestore والخادم.
