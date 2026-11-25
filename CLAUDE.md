# MITHQAL ERP (مِثقال) — تعليمات Claude Code

منصة SaaS عربية (RTL) مع الإنجليزية لإدارة المطاعم متعددة الفروع: الإغلاق اليومي، المحاسبة بالقيد المزدوج، المخزون والتكلفة، نقاط البيع، الموارد البشرية والرواتب، الفوترة الإلكترونية (ZATCA)، والتقارير.
التقنية: React 18 + Vite 6، Firebase (Auth + Firestore)، Express على Render، Node ≥ 22. التفاصيل: `README.md`.

## قواعد المالك الثابتة
1. الرد بالعربية دائمًا وبشرح بسيط؛ المالك محاسب وليس مبرمجًا.
2. **لا افتراض لقواعد العمل المحاسبية أو التشغيلية أو النظامية** — اسأل عند الجهل.
3. التطوير على مراحل ببوابات موافقة (G0–G5). **لا دمج ولا نشر ولا ترحيل بيانات ولا تعديل إنتاج دون موافقة صريحة من المالك.** لا يُسقط أي بند دون موافقته.
4. الميزات الجديدة **معطّلة افتراضيًا** مع توافق رجعي إلزامي.
5. رفع رقم الإصدار (`APP_VER` في `App.jsx` و`package.json` معًا) في كل إصدار، وتسجيله في `PROJECT_AUDIT/RELEASE_NOTES.md`.
6. التحقق البصري بلقطات Playwright حقيقية بلا تخمين.
7. تفضيل Excel للمخرجات الجدولية.
8. الهوية المعتمدة (`brand/`، `public/brand/`) لا تُعدَّل، والمطبوعات تحمل شعار المنشأة فقط.
9. المستودع **عام**: لا بيانات منشأة ولا أسرار في أي ملف.

## فريق الوكلاء
- 20 وكيلًا في `.claude/agents/` و24 مهارة في `.claude/skills/`. الدليل: `docs/AI_TEAM_USAGE_GUIDE.md`، والبنية: `docs/AI_TEAM_ARCHITECTURE.md`.
- ابدأ أي مهمة متعددة التخصصات بالمنسق: `claude --agent mithqal-orchestrator`.
- دورة العمل الإلزامية: `ANALYZE → PLAN → DEVELOP → TEST → VALIDATE → AUDIT → APPROVE → RELEASE`.
- **لا يعتمد وكيل عمله بنفسه.** نجاح البرمجة ليس نجاحًا محاسبيًا، ونجاح البناء ليس نجاحًا تصميميًا.

## الجودة والاعتماد
- بوابة التغيير قبل أي طلب دمج: `node scripts/quality-gate.mjs` ← PASS / CONDITIONAL PASS / FAIL / BLOCKED.
- بوابة الإصدار: `node scripts/quality-gate.mjs --release` — لا نشر عند FAIL أو BLOCKED.
- التحقق المحاسبي المستقل: `node --test tests/validation/*.test.mjs`.
- الموافقات البشرية: `docs/HUMAN_APPROVAL_POLICY.md`. الطلبات في `docs/approvals/requests/`، والموافقات الممنوحة في `docs/approvals/granted/` يكتبها المالك وحده (ممنوعة على الوكلاء في `.claude/settings.json`). **إعداد طلب الموافقة ليس موافقة.**
- الحدود الأمنية: `docs/SECURITY_GUARDRAILS.md`.

## الأوامر
| الأمر | الغرض |
|---|---|
| `npm ci` | تثبيت الاعتماديات (يحتاج موافقة في هذا الإطار) |
| `npm run build` | بناء الواجهة |
| `npm test` | اختبارات المحرك والخادم |
| `npm run test:rules` | قواعد Firestore على المحاكي (Java) |
| `npm run test:ui` | Playwright |
| `node --test tests/validation/*.test.mjs tests/ai-team/*.test.mjs` | التحقق المحاسبي المستقل وسلامة الإطار (بلا اعتماديات) |
| `node scripts/quality-gate.mjs --dashboard` | البوابة + تحديث `docs/QUALITY_DASHBOARD.md` |

## مراجع لا تُخالف
`PROJECT_AUDIT/ERP_V48/DECISION_LOG.md` (قرارات المالك)، `tests/security/CONSTITUTION.md` (دستور الأمان)، `PROJECT_AUDIT/ERP_V48/PROJECT_MASTER_PLAN.md` (المراحل والبوابات).
