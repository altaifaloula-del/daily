# DATABASE AUDIT

## الدفعة 1
- **الفهارس:** حُصرت استعلامات Firestore (8): `client_errors` (orderBy at)، `audit_log` (orderBy at)، `closings` (where branchId)، `signoffs` (where kind / branchId / at)، `qr_feedback` (createdAt، و branchId+createdAt). الفهرس المركب الوحيد اللازم موجود في `firestore.indexes.json`. ✅
- **التخزين المعروف من الكود (للمرحلة 2):** المستندات تحت المجموعة `platform` (قابلة للتغيير بـ `VITE_FIREBASE_COLLECTION`)، تقسيم بالبايت 900KB للجزء، سقف 500 جزء، حتى 10 أجزاء في دفعة ذرية.

## معلّق
- مراجعة `storage.js` كاملة (الكتابة الذرية، التعارض، الانقطاع، حدود Firestore) — المرحلة 2.
- تقييم الانتقال التدريجي لتخزين على مستوى السجلات — يحتاج قرارًا وخطة في `MIGRATION_PLAN.md` قبل أي تنفيذ.
