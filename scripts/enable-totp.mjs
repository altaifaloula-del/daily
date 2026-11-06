// v31.3 — تفعيل التحقق بخطوتين (TOTP) على مستوى مشروع Firebase مرة واحدة، باعتماد حساب الخدمة نفسه المستخدم لنشر القواعد.
// يقرأ الإعداد الحالي، ثم يضيف TOTP إلى مزوّدي العامل الثاني دون المساس بغيره (الرسائل النصية تبقى كما هي).
import { GoogleAuth } from 'google-auth-library';

const pid = process.env.PROJECT_ID;
if (!pid) { console.error('::error::معرّف المشروع غير مضبوط (VITE_FIREBASE_PROJECT_ID)'); process.exit(1); }
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const client = await auth.getClient();
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${encodeURIComponent(pid)}/config`;
const explain = (e) => {
  const st = e?.response?.status, msg = JSON.stringify(e?.response?.data?.error || e?.message || e);
  console.error('::error::فشل الطلب (' + (st || '?') + '): ' + msg);
  if (st === 403) console.error('حساب الخدمة لا يملك صلاحية إدارة المصادقة — امنحه دور «Firebase Authentication Admin» من Google Cloud ← IAM.');
  if (/IDENTITY_PLATFORM|identity platform|upgrade/i.test(msg)) console.error('يلزم ترقية المشروع إلى «Firebase Authentication with Identity Platform» من لوحة Firebase ← Authentication ← Settings.');
  process.exit(1);
};
const cur = await client.request({ url: base }).catch(explain);
const mfa = cur.data.mfa || {};
console.log('الإعداد الحالي للعامل الثاني:', JSON.stringify(mfa));
const others = (mfa.providerConfigs || []).filter(p => !p.totpProviderConfig);
const body = { mfa: { providerConfigs: [...others, { state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 5 } }] } };
const r = await client.request({ url: base + '?updateMask=mfa.providerConfigs', method: 'PATCH', data: body }).catch(explain);
console.log('بعد التفعيل:', JSON.stringify(r.data.mfa || {}));
const ok = (r.data.mfa?.providerConfigs || []).some(p => p.totpProviderConfig && p.state === 'ENABLED');
if (!ok) { console.error('::error::لم يظهر TOTP مفعّلًا في الاستجابة'); process.exit(1); }
console.log('✓ التحقق بخطوتين عبر تطبيق المصادقة (TOTP) مفعّل في المشروع ' + pid);
