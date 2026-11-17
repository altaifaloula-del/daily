# INTEGRATION AUDIT

| التكامل | ما وُجد في الكود | الحالة الموثقة |
|---|---|---|
| Firebase Auth/Firestore | storage.js | مستخدم فعليًا |
| Firebase Cloud Messaging | storage.js (VAPID)، public/push-sw.js، scripts/push-alerts.mjs، push-alerts.yml | الكود موجود؛ يحتاج `VITE_FCM_VAPID_KEY` في GitHub. واجهة FCM API مفعلة في مشروع Google Cloud (لقطة المستخدم 2026-11-18) |
| ZATCA «فاتورة» | zatca/، server.js | المطورين والمحاكاة فقط؛ الإنتاج مقفل في الخادم |
| Anthropic (الذكاء المالي) | server.js | عبر الخادم فقط مع تحقق العضوية وحد معدل |
| منصات التوصيل / أجهزة الدفع / الطابعات | — | لم تُفحص بعد (المرحلة 5). لا يُدّعى أي تكامل حي |

لم يُشغَّل أي تكامل خارجي حي في هذه الدفعة.
