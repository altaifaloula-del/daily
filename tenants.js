/**
 * v51.0 — المرحلة 07 / S1: سجل المستأجرين على الخادم.
 * النموذج المعتمد (مشروع Firebase لكل عميل): المستأجر يُعرف من مشروع رمز الدخول (aud) بعد تحقق Google منه — لا من ترويسة يرسلها المتصفح.
 * الافتراضي (الطيف) من متغيرات البيئة الحالية كما هي. المستأجرون الإضافيون (الدفعة S3) من MQ_TENANTS_JSON:
 *   [{ "id": "client2", "projectId": "mithqal-client2", "apiKeyEnv": "FB_KEY_CLIENT2", "zatcaKeyEnv": "ZATCA_KEY_CLIENT2" }]
 * الأسرار نفسها لا تُكتب في JSON — يُذكر اسم متغير البيئة الذي يحملها فقط (خزنة الأسرار = متغيرات بيئة الخادم السرية).
 * v51.2 (S3): الخادم يخدم كل المنشآت المسجّلة — انظر server-auth.js.
 */
import { PLAN_FEATURES } from './plans.js';
const clean = (v) => String(v || '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
const okId = (v) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(v);
const okProject = (v) => /^[a-z][a-z0-9-]{4,29}$/.test(v);
const okEnvName = (v) => /^[A-Z][A-Z0-9_]{2,60}$/.test(v);

export function loadTenants(env = process.env) {
  const def = { id: 'default', projectId: clean(env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID), apiKey: clean(env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY), zatcaKey: String(env.ZATCA_ENC_KEY || '').trim(), plan: 'enterprise' };
  const list = [def], errors = [];
  if (env.MQ_TENANTS_JSON) {
    let arr = [];
    try { arr = JSON.parse(env.MQ_TENANTS_JSON); if (!Array.isArray(arr)) throw new Error('not array'); } catch { errors.push('MQ_TENANTS_JSON غير صالح'); arr = []; }
    for (const t of arr) {
      const id = clean(t && t.id), projectId = clean(t && t.projectId);
      if (!okId(id) || id === 'default') { errors.push('معرّف غير صالح: ' + id); continue; }
      if (!okProject(projectId)) { errors.push(id + ': مشروع غير صالح'); continue; }
      if (list.some(x => x.id === id || (x.projectId && x.projectId === projectId))) { errors.push(id + ': مكرر'); continue; }
      if (!okEnvName(t.apiKeyEnv || '')) { errors.push(id + ': اسم متغير المفتاح غير صالح'); continue; }
      const zatcaKey = okEnvName(t.zatcaKeyEnv || '') ? String(env[t.zatcaKeyEnv] || '').trim() : '';
      // v51.2 (S3): مفتاح تشفير الفوترة لا يُشارك بين المنشآت — يُرفض تكراره (يعمل المستأجر بلا فوترة حتى يُضبط مفتاحه)
      const dupKey = zatcaKey && list.some(x => x.zatcaKey && x.zatcaKey === zatcaKey);
      if (dupKey) errors.push(id + ': مفتاح تشفير الفوترة مكرر مع منشأة أخرى — عُطّل لها');
      if (!clean(env[t.apiKeyEnv])) errors.push(id + ': متغير المفتاح ' + t.apiKeyEnv + ' فارغ');
      // v51.3 (S4): الخطة من السجل؛ غير المعروفة ⇒ الأساسية (الأضيق) مع تنبيه
      const plan = Object.prototype.hasOwnProperty.call(PLAN_FEATURES, t.plan) ? t.plan : 'basic';
      if (t.plan != null && t.plan !== plan) errors.push(id + ': خطة غير معروفة (' + t.plan + ') — طُبّقت الأساسية');
      // v51.5 (S6): حساب خدمة تشغيلي اختياري للمنشأة (تغيير حالة الاشتراك من لوحة مِثقال) — اسم المتغير فقط في JSON
      let sa = null;
      if (okEnvName(t.saEnv || '')) { try { const o = JSON.parse(env[t.saEnv] || ''); if (o && o.client_email && o.private_key && (!o.project_id || o.project_id === projectId)) sa = { client_email: o.client_email, private_key: o.private_key }; else errors.push(id + ': حساب الخدمة لا يطابق المشروع'); } catch { errors.push(id + ': ' + t.saEnv + ' غير صالح'); } }
      list.push({ id, projectId, apiKey: clean(env[t.apiKeyEnv]), zatcaKey: dupKey ? '' : zatcaKey, plan, sa });
    }
  }
  return { list, errors, byProject: (p) => list.find(t => t.projectId && t.projectId === p) || null, byId: (id) => list.find(t => t.id === id) || null, def };
}
