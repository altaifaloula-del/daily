/**
 * v51.0 — المرحلة 07 / الدفعة S1: طبقة «إعداد المستأجر» (قرار المالك 2026-11-19: مشروع Firebase لكل عميل، ثم قاعدة لكل عميل؛ بيانات العملاء الجدد في الدمام).
 *
 * مصدر واحد لإعداد المنشأة التي تعمل عليها هذه النسخة من الواجهة:
 *   1) window.__MQ_TENANT__ — يحقنه سجل المستأجرين لاحقًا (الدفعة S2) قبل تحميل التطبيق.
 *   2) متغيرات البناء VITE_FIREBASE_* — المستأجر الافتراضي (الطيف) كما يعمل اليوم تمامًا.
 * أي إعداد محقون غير صالح يُتجاهل ويُستعمل الافتراضي — لا تتعطل المنصة بسبب إعداد ناقص.
 * لا أسرار هنا: مفتاح Firebase للويب عام بطبيعته، والحماية في قواعد الخادم.
 */
export const DEFAULT_TENANT_ID = 'default';
export const PLANS = ['basic', 'pro', 'enterprise'];
// المناطق المعتمدة لبيانات العملاء الجدد — الدمام أولًا (نظام حماية البيانات الشخصية)
export const TENANT_REGIONS = ['me-central2'];

const S = (v) => (typeof v === 'string' ? v.trim() : '');
const okId = (v) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(v);
const okProject = (v) => /^[a-z][a-z0-9-]{4,29}$/.test(v);
const okKey = (v) => /^[A-Za-z0-9_-]{20,60}$/.test(v);
const okCol = (v) => /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(v);

function fromEnv(env) {
  const E = env || {};
  return {
    id: DEFAULT_TENANT_ID, name: '', plan: 'enterprise', region: '', status: 'active', source: 'env',
    collection: S(E.VITE_FIREBASE_COLLECTION) || 'platform',
    firebase: {
      apiKey: E.VITE_FIREBASE_API_KEY, authDomain: E.VITE_FIREBASE_AUTH_DOMAIN, projectId: E.VITE_FIREBASE_PROJECT_ID,
      storageBucket: E.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: E.VITE_FIREBASE_SENDER_ID, appId: E.VITE_FIREBASE_APP_ID
    }
  };
}

/** يتحقق من إعداد محقون ويعيد سبب الرفض، أو '' إن كان صالحًا */
export function tenantConfigError(t) {
  if (!t || typeof t !== 'object') return 'ليس كائنًا';
  if (!okId(S(t.id)) || t.id === DEFAULT_TENANT_ID) return 'معرّف المستأجر غير صالح';
  const f = t.firebase || {};
  if (!okProject(S(f.projectId))) return 'معرّف مشروع Firebase غير صالح';
  if (!okKey(S(f.apiKey))) return 'مفتاح Firebase غير صالح';
  if (t.collection != null && !okCol(S(t.collection))) return 'اسم المجموعة غير صالح';
  if (t.plan != null && !PLANS.includes(t.plan)) return 'الخطة غير معروفة';
  if (t.status != null && !['active', 'readonly', 'suspended'].includes(t.status)) return 'حالة الاشتراك غير معروفة';
  if (t.region != null && t.region !== '' && !TENANT_REGIONS.includes(t.region)) return 'المنطقة غير معتمدة';
  return '';
}

/** يحدد المستأجر: المحقون الصالح أولًا، وإلا الافتراضي من متغيرات البناء */
export function resolveTenant(env, injected) {
  const def = fromEnv(env);
  if (injected == null) return def;
  const err = tenantConfigError(injected);
  if (err) { try { console.warn('[mithqal] إعداد المستأجر المحقون مرفوض — يُستعمل الافتراضي:', err); } catch { } return { ...def, rejected: err }; }
  const f = injected.firebase;
  return {
    id: injected.id, name: S(injected.name), plan: injected.plan || 'basic', region: injected.region || TENANT_REGIONS[0],
    status: injected.status === 'readonly' ? 'readonly' : 'active', source: 'injected',
    collection: S(injected.collection) || 'platform',
    firebase: { apiKey: S(f.apiKey), authDomain: S(f.authDomain) || f.projectId + '.firebaseapp.com', projectId: S(f.projectId),
      storageBucket: S(f.storageBucket), messagingSenderId: S(f.messagingSenderId), appId: S(f.appId) }
  };
}

const _env = (() => { try { return import.meta.env || {}; } catch { return {}; } })();
const _inj = (() => { try { return typeof window !== 'undefined' ? window.__MQ_TENANT__ : undefined; } catch { return undefined; } })();
export const TENANT = Object.freeze(resolveTenant(_env, _inj));
export const tenantFirebase = () => TENANT.firebase;
export const tenantFbReady = () => !!(TENANT.firebase.apiKey && TENANT.firebase.projectId);
