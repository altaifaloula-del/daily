# DEPLOYMENT GUIDE — دليل التشغيل والنشر الإنتاجي

## البنية الإنتاجية
| الجزء | المكان | سير العمل |
|---|---|---|
| الواجهة | GitHub Pages | `deploy.yml` — عند الرفع على `main` بعد نجاح الاختبارات |
| قواعد Firestore والفهارس | Firebase | `firestore-rules.yml` (منفصل عن نشر الواجهة) |
| الخادم (ذكاء اصطناعي + فوترة) | Render أو Docker | `render.yaml` / `Dockerfile` |
| نسخ احتياطي ليلي | GitHub Actions | `nightly-backup.yml` (مشفر بـ BACKUP_KEY) |
| إشعارات | GitHub Actions + FCM | `push-alerts.yml` |

## قبل أول نشر
1. **Firebase:** فعّل Firestore وEmail/Password Auth (الدخول المجهول مرفوض في القواعد).
2. **GitHub Secrets:** `VITE_FIREBASE_*` (6)، `FIREBASE_SERVICE_ACCOUNT`، `BACKUP_KEY`؛ واختياريًا `VITE_AI_ENDPOINT` و`VITE_FCM_VAPID_KEY`.
3. **الخادم:** `ANTHROPIC_API_KEY`، `FIREBASE_API_KEY`، `ALLOWED_ORIGINS`، `ZATCA_ENC_KEY` (32+ حرفًا — **انسخه واحفظه خارج Render**).
4. انشر القواعد: `firebase deploy --only firestore:rules,firestore:indexes` بعد `npm run test:rules`.

## التحقق المحلي قبل أي رفع
```bash
npm ci
npm run check          # بناء + اختبارات المحرك
npm run test:rules     # Java مطلوب
npm run test:ui
```

## Docker
```bash
docker build -t mithqal \
  --build-arg VITE_FIREBASE_API_KEY=... --build-arg VITE_FIREBASE_AUTH_DOMAIN=... \
  --build-arg VITE_FIREBASE_PROJECT_ID=... --build-arg VITE_FIREBASE_STORAGE_BUCKET=... \
  --build-arg VITE_FIREBASE_SENDER_ID=... --build-arg VITE_FIREBASE_APP_ID=... .
docker run -p 8787:8787 -e ANTHROPIC_API_KEY=... -e FIREBASE_API_KEY=... \
  -e ZATCA_ENC_KEY=... -e ALLOWED_ORIGINS=https://altaifaloula-del.github.io mithqal
curl http://localhost:8787/api/health
```
الحاوية تعمل بمستخدم غير جذري، وفيها HEALTHCHECK. **لا تعتمد على `data/store.json` في السحابة** — يُمسح عند كل نشر؛ استخدم Firestore.

## بعد النشر
1. ادخل بحساب المالك، وراجع المستخدمين والأدوار والفروع.
2. فعّل MFA للأدوار الإدارية.
3. تحقق من: `/api/health`، ظهور «لحظي» في المزامنة، ونجاح أول نسخة احتياطية ليلية.

## الاسترجاع عند الفشل
- الواجهة: أعد تشغيل `deploy.yml` على commit سابق.
- القواعد: انشر `firestore.rules` من commit سابق بعد اختبارها.
- البيانات: من النسخة الليلية المشفرة (أداة الاستعادة تُراجع في المرحلة 10).

## الذكاء المالي والرقابة (v54+)
متغيرات الخادم ومسارات الواجهة البرمجية والتحقق بعد النشر: `FIN_INTEL_API_SECURITY.md`.
