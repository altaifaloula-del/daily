# BUG REGISTER

| رقم | الخطورة | الملف | الوصف | الحالة | Commit |
|---|---|---|---|---|---|
| BUG-001 | P0 حرج | Dockerfile | مرحلة التشغيل لا تنسخ `zatca/` فيتوقف الخادم `ERR_MODULE_NOT_FOUND` | **مغلق** | 77cbe84 |
| BUG-002 | P1 عالٍ | Dockerfile, render.yaml, package.json | Node 20 خارج الدعم الأمني منذ 2026-04 | **مغلق جزئيًا** (سير عمل GitHub في المرحلة 13) | ef62a07, 77cbe84 |
| BUG-003 | P1 عالٍ | package.json | `google-auth-library` مستوردة في nightly-backup/push-alerts/enable-totp دون إعلان | **مغلق** | ef62a07 |
| BUG-004 | P3 | package.json | لا يوجد `npm test` موحد | **مغلق** | ef62a07 |
| BUG-005 | P2 متوسط | .gitignore, .dockerignore | ملفات `.env.*` وحسابات الخدمة غير محمية من الرفع | **مغلق** | 77cbe84 |
| BUG-006 | P2 متوسط | .env.example | 6 متغيرات مستخدمة غير موثقة (منها ZATCA_ENC_KEY) | **مغلق** | 77cbe84 |
| BUG-007 | P2 متوسط | README.md | توثيق رمز دخول افتراضي وحسابات وأزرار غير موجودة | **مغلق** | 20d3c7e |
| BUG-008 | P2 | Procfile | لا يضبط NODE_ENV | **مغلق** | 77cbe84 |
| BUG-009 | P3 | i18n.js:94 | مفتاح مكرر «الطاولات» (نفس القيمة) | مفتوح — المرحلة 2 | — |
| BUG-010 | P2 | .github/workflows/firestore-rules.yml | ينشر بـ `firebase-tools@13` بينما المشروع على 15.35 | مفتوح — المرحلة 13 | — |
| BUG-011 | P2 | .github/workflows/*.yml | `node-version: '20'` | مفتوح — المرحلة 13 | — |
| BUG-012 | P3 | render.yaml | `ZATCA_ENC_KEY` مولّد تلقائيًا؛ إعادة إنشاء الخدمة تفقد القدرة على فك الأسرار | موثق (إجراء تشغيلي) | — |

ملاحظة غير مصنفة كخطأ: `mods/acct/ReportBuilder.jsx:90` تحذير esbuild «مفتاح cols مكرر» — مقصود (القيمة الثانية تتجاوز الأولى بعد الدمج)؛ يُنظَّف عند مراجعة الملف في المرحلة 3.
| BUG-013 | P0 | mods/closing/ClosingForm.jsx | «تعديل كمسودة» ينهار مع إغلاق تنقصه الفئات/المصروفات (اكتشفه زاحف الأزرار) | **مغلق** | 8b22da3 |
| BUG-014 | P0 | mods/admin/SystemMaintenance.jsx | الإغلاق المكرر بنفس المعرّف يضاعف الإيراد دون كشف | **مغلق جزئيًا** (فحص سلامة؛ المنع من الخادم في المرحلة 11) | 1b60334 |
| BUG-015 | P3 | mods/inv/StockVouchers.jsx | «آخر 30 يومًا» بتوقيت UTC | **مغلق** | fa8fcc2 |
| BUG-016 | P3 | tests/ui/fixture.jsx | بيانات الاختبار بتوقيت UTC (فشل ليلي) | **مغلق** | dc70913 |

التدقيق الوظيفي الكامل وسجل النواقص: `FUNCTIONAL_AUDIT/FUNCTIONAL_GAP_REGISTER.md`.
