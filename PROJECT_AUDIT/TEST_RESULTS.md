# TEST RESULTS — نتائج فعلية فقط

البيئة: Node v22.23.4، Linux، دون وصول لسجل npm.

## الدفعة 1 — 2026-11-18

| المجموعة | الأمر | قبل التعديل (v46.7) | بعد الدفعة 1 |
|---|---|---|---|
| المحرك المحاسبي | `node --test tests/accounting.test.mjs` | 92/92 ✅ | 92/92 ✅ |
| ZATCA | `node --test tests/zatca.test.mjs` | 7/7 ✅ | ضمن npm test ✅ |
| النسخ الاحتياطي + الإشعارات | `node --test tests/backup.test.mjs tests/push.test.mjs` | 9/9 ✅ | ضمن npm test ✅ |
| **الإجمالي** | `npm test` | — | **108/108 ✅** |
| تحزيم الواجهة كاملة | esbuild من main.jsx | ✅ 109 حزمة | ✅ 109 حزمة، 4.47MB، تحذيران غير مؤثرين |
| توافق package.json مع القفل | فحص semver آلي | — | 0 تعارض ✅ |
| إقلاع الخادم في بنية Docker | محاكاة مرحلة التشغيل | ❌ ERR_MODULE_NOT_FOUND | ✅ الاستيرادات تُحل |

## لم يُشغَّل (ولا يُدّعى نجاحه)
| المجموعة | السبب |
|---|---|
| `npm ci` / `vite build` | سجل npm غير متاح في الجلسة |
| `test:rules` (69 اختبارًا) | يحتاج firebase-tools + Java |
| `test:ui` (72 اختبارًا) | يحتاج Vite + Chromium |
| `docker build` | يحتاج npm داخل الحاوية |
| `npm audit` | يحتاج الشبكة |

**ملاحظة منهجية:** لتشغيل اختبارات المحرك دون npm استُخدمت بدائل محلية داخل `node_modules` (غير مرفوعة، `node_modules` مستبعد من git): روابط إلى react/react-dom/esbuild مثبتة مسبقًا، وحزم فارغة لـ lucide-react وrecharts وjsbarcode. المحرك لا يرسم واجهات فلا تؤثر على النتائج.

## الدفعة 2 — التدقيق الوظيفي (2026-11-18)
| المجموعة | النتيجة |
|---|---|
| `npm test` | **116/116** ✅ (أُضيفت 8 اختبارات دورات) |
| اختبارات الواجهة (73) | **72/73** ✅ — صارت تعمل هنا عبر بديل Vite محلي بـ esbuild خارج المستودع؛ الفاشل الوحيد محجوب بمكتبة jsbarcode |
| زاحف الأزرار (1,425 زرًا في 98 شاشة) | **0 أخطاء** بعد إصلاح 6 |
| قواعد Firestore (69) | BLOCKED |
التفاصيل: `FUNCTIONAL_AUDIT/TEST_EXECUTION_RESULTS.md`.
