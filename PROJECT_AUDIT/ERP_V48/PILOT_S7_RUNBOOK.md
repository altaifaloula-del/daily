# S7 — أول منشأة مشتركة (تجريبية) في الدمام — دليل التنفيذ

**قرارات المالك (2026-11-19):** منشأة تجريبية أولًا ببريد المالك، على الرابط الحالي مع `?t=`، وتجربة مجانية ثم تحويل بنكي (بلا «ميسر» الآن).

> كل خطوة على السحابة يُنفّذها المالك بحسابه في Google بعد مراجعتها. الطيف لا يتأثر بأي خطوة هنا.
> ضع بريدك مكان `OWNER@EMAIL` في كل الأوامر.

## أ) مشروع التحكم ولوحة مِثقال (مرة واحدة)
```bash
gcloud projects create mithqal-control --name="Mithqal control"
gcloud billing projects link mithqal-control --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud firestore databases create --project=mithqal-control --location=me-central2 --type=firestore-native
firebase deploy --config firebase.control.json --only firestore:rules --project mithqal-control
gcloud iam service-accounts create mithqal-server --project=mithqal-control
gcloud projects add-iam-policy-binding mithqal-control --member=serviceAccount:mithqal-server@mithqal-control.iam.gserviceaccount.com --role=roles/datastore.user
gcloud iam service-accounts keys create control-sa.json --iam-account=mithqal-server@mithqal-control.iam.gserviceaccount.com
```
متغيرات Render (ثم احذف `control-sa.json` من جهازك):
| المتغير | القيمة |
|---|---|
| `MQ_CONTROL_PROJECT` | `mithqal-control` |
| `MQ_CONTROL_SA` | محتوى `control-sa.json` كاملًا |
| `MQ_PROVIDER_ADMINS` | `OWNER@EMAIL` |
| `MQ_TRIAL_DAYS` | `30` (اختياري — الافتراضي 14) |

**الخطوتان:** اللوحة تتطلب جلسة بخطوتين لحسابك في الطيف. إن لم تكن مفعّلة: الإعدادات ← سياسة التحقق بخطوتين، أو `scripts/enable-totp.mjs`.

**تحقق:** ادخل الطيف ← الإعدادات والمستخدمون ← يظهر تبويب «لوحة مِثقال» ← «لا منشآت مشتركة بعد».
ورابط التسجيل العام `…/daily/?signup` يقبل الطلبات الآن ويظهرها في اللوحة.

## ب) المنشأة التجريبية `pilot`
```bash
node scripts/tenant-provision.mjs plan --id pilot --name "منشأة تجريبية — مِثقال" --plan pro --owner OWNER@EMAIL --billing XXXXXX-XXXXXX-XXXXXX
```
يطبع 14 خطوة بالترتيب (المشروع `mithqal-pilot` ← Firestore في الدمام ← قواعد المنشآت ← تثبيتك مالكًا ← حالة الاشتراك ← …).
إن كان المعرّف `mithqal-pilot` محجوزًا عالميًا في Google Cloud، استخدم `--id pilot1`.

بعد الخطوة 6 أرسل لي محتوى `sdkconfig.json` (ليس سرًا — مفتاح ويب عام)، فأُعدّ ملف السجل `public/tenants/pilot.json` في طلب دمج، وأنت تعتمده.

متغيرات Render للمنشأة (الخطوة 12):
| المتغير | القيمة |
|---|---|
| `MQ_TENANTS_JSON` | `[{"id":"pilot","projectId":"mithqal-pilot","plan":"pro","apiKeyEnv":"FB_KEY_PILOT","zatcaKeyEnv":"ZATCA_KEY_PILOT","saEnv":"SA_OPS_PILOT"}]` |
| `FB_KEY_PILOT` | `apiKey` من `sdkconfig.json` |
| `ZATCA_KEY_PILOT` | `openssl rand -base64 48` (سر جديد — لا تستعمل سر الطيف) |
| `SA_OPS_PILOT` | حساب خدمة `mithqal-ops` بدور Cloud Datastore User في `mithqal-pilot` (لتغيير الحالة من اللوحة) |

## ج) الفوترة بالتحويل البنكي فقط (عند انتهاء التجربة)
| المتغير | القيمة |
|---|---|
| `MQ_BILLING` | `1` |
| `MQ_SELLER_JSON` | `{"name":"…","vatNo":"3…3","crNo":"…","address":"…"}` — بيانات الكيان الذي يُصدر فواتير مِثقال |
| `MQ_PRICES_JSON` | `{"pro":{"monthly":…,"yearly":…}}` بالريال قبل الضريبة |
| `MQ_BANK_IBAN` / `MQ_BANK_NAME` / `MQ_BANK_HOLDER` | آيبان مِثقال واسم البنك واسم المستفيد |
| `MQ_APP_URL` | `https://altaifaloula-del.github.io/daily` |

لا حاجة لـ `MOYASAR_SECRET_KEY` و`MQ_BILLING_HOOK_KEY` و`MQ_PUBLIC_API` في وضع التحويل البنكي (v51.7). عند إضافة «ميسر» لاحقًا تُضاف الثلاثة ويظهر زر «ادفع إلكترونيًا» تلقائيًا.

## د) معايير القبول — قبل أي عميل حقيقي
| # | الاختبار | المتوقع |
|---|---|---|
| 1 | افتح `…/daily/` | الطيف كما هو تمامًا |
| 2 | افتح `…/daily/?t=pilot` وادخل ببريدك | «الإعداد الأول» لمنشأة فارغة — لا أثر لبيانات الطيف |
| 3 | سجّل حسابًا آخر غير بريدك في `?t=pilot` | لا يصبح مديرًا (تثبيت المالك) |
| 4 | أدخل إغلاقًا وفاتورة في المنشأة التجريبية | تُحفظ في `mithqal-pilot` وحدها |
| 5 | اللوحة ← «بدء تجربة» | «مدفوع حتى» = اليوم + أيام التجربة |
| 6 | اللوحة ← «للقراءة فقط» ثم حاول الحفظ في المنشأة | الشريط يظهر، والحفظ مرفوض من الخادم، والعرض والطباعة يعملان |
| 7 | اللوحة ← «نشط» | يعود الحفظ |
| 8 | المنشأة ← الاشتراك ← «تحويل بنكي» ثم اللوحة ← «تأكيد التحويل» | الفاتورة «مدفوعة» والاشتراك ممدد، والفاتورة الضريبية تُطبع |
| 9 | Actions ← النسخ الليلي ← تشغيل يدوي | نسختان: الطيف و`pilot`، كلٌّ بمفتاحه |
| 10 | تحليل ذكي في `pilot` | يعمل (خطة «المتقدمة») |

بعد نجاح العشرة: المراجعة، ثم أول عميل حقيقي بنفس الخطوات (ب) بمعرّفه وبريده.
