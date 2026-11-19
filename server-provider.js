/**
 * v51.5 — المرحلة 07 / S6: لوحة مزوّد مِثقال + التسجيل العام + الفترة التجريبية.
 * • اللوحة لمزوّد مِثقال وحده: بريده في MQ_PROVIDER_ADMINS، ويدخل من المنشأة الرئيسية، وبجلسة بخطوتين (افتراضيًا) —
 *   كل ذلك يُفحص هنا على الخادم من رمز الدخول بعد أن تحققت منه Google، لا من الواجهة.
 * • لا أسرار تخرج للوحة: تعرض «مضبوط/غير مضبوط» فقط.
 * • تغيير حالة اشتراك منشأة يُكتب في قاعدتها (platform/release.sub) بحساب خدمتها إن ضُبط (saEnv)، وإلا يُعاد الأمر لتنفيذه يدويًا.
 *   المستند يجب أن يكون موجودًا (شرط exists) — كتابة الحقل وحده في مستند غير موجود تكسر فحص الإصدار في القواعد.
 * • التسجيل العام: طلب يُحفظ في مشروع التحكم للمراجعة فقط — لا يُنشئ مشروعًا ولا حسابًا تلقائيًا.
 */
import { subscriptionState, applyPayment, okInvoiceNo } from './billing.js';
import { extendSub, saTokenSource } from './server-billing.js';
import { PLAN_FEATURES } from './plans.js';

const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const today = (now) => new Date(now()).toISOString().slice(0, 10);
const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const SIGNUP_ST = Object.freeze(['new', 'approved', 'rejected']);

export function providerConfig(env = process.env) {
  const admins = String(env.MQ_PROVIDER_ADMINS || '').split(',').map(x => x.trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x));
  return { admins, mfa: env.MQ_PROVIDER_MFA !== '0', trialDays: Math.min(60, Math.max(0, Number(env.MQ_TRIAL_DAYS) || 14)) };
}
/** مطالبات الرمز (بعد أن قبلته Google في requireMember) — للتحقق من الخطوة الثانية */
const claimsOf = (req) => { try { const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '')); return JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString('utf8')); } catch { return {}; } };
export function isProvider(cfg, req) {
  const u = req.user || {};
  if (u.tenant !== 'default' || !cfg.admins.includes(String(u.email || '').toLowerCase())) return false;
  if (!cfg.mfa) return true;
  const f = claimsOf(req).firebase || {};
  return !!f.sign_in_second_factor;
}

/** التحقق من طلب التسجيل العام — يعيد { v } أو { error } */
export function validateSignup(b = {}) {
  if (b.website) return { error: 'spam' };   // حقل مخفي — يملؤه الروبوت وحده
  const v = { company: s(b.company, 120), contact: s(b.contact, 80), email: s(b.email, 120).toLowerCase(), phone: s(b.phone, 20).replace(/[\s-]/g, ''),
    city: s(b.city, 60), crNo: s(b.crNo, 10), vatNo: s(b.vatNo, 15), branches: Math.max(1, Math.min(500, parseInt(b.branches, 10) || 1)),
    plan: Object.prototype.hasOwnProperty.call(PLAN_FEATURES, b.plan) ? b.plan : 'basic', note: s(b.note, 500) };
  if (v.company.length < 3) return { error: 'اسم المنشأة مطلوب' };
  if (v.contact.length < 3) return { error: 'اسم المسؤول مطلوب' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) return { error: 'البريد الإلكتروني غير صالح' };
  if (!/^(05[0-9]{8}|\+9665[0-9]{8}|9665[0-9]{8})$/.test(v.phone)) return { error: 'رقم الجوال السعودي غير صالح (05XXXXXXXX)' };
  if (v.crNo && !/^[0-9]{10}$/.test(v.crNo)) return { error: 'السجل التجاري 10 أرقام' };
  if (v.vatNo && !/^3[0-9]{13}3$/.test(v.vatNo)) return { error: 'الرقم الضريبي 15 رقمًا يبدأ وينتهي بـ 3' };
  return { v };
}
/** معرّف مقترح للمنشأة من اسمها الإنجليزي أو من رقم الطلب */
export const suggestId = (company, seq) => { const a = String(company || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16); return (a.length >= 3 ? a : 'org') + '-' + String(seq).padStart(3, '0'); };

/** كتابة حالة الاشتراك في قاعدة المنشأة بحساب خدمتها — المستند يجب أن يكون موجودًا */
export async function writeTenantStatus({ tenant, status, fetchImpl = fetch, tokenFor }) {
  const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(tenant.projectId) + '/databases/(default)/documents/platform/release?updateMask.fieldPaths=sub&currentDocument.exists=true';
  const r = await fetchImpl(url, { method: 'PATCH', headers: { authorization: 'Bearer ' + (await tokenFor(tenant)), 'content-type': 'application/json' }, body: JSON.stringify({ fields: { sub: { stringValue: status } } }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(r.status === 404 || r.status === 400 ? 'مستند الإصدار غير موجود — نفّذ خطوة «تسجيل حالة الاشتراك» في التهيئة أولًا' : 'تعذّرت الكتابة: ' + s(j.error && j.error.message, 160)); e.status = 409; throw e; }
  return true;
}

export function mountProvider(app, { express, requireMember, rateLimit, T, cfg, store, controlReady, registry = () => ({}), now = Date.now, fetchImpl = fetch }) {
  const json = express.json({ limit: '16kb' });
  const tokens = new Map();
  const tokenFor = (t) => { if (!tokens.has(t.id)) tokens.set(t.id, saTokenSource(t.sa, { fetchImpl })); return tokens.get(t.id)(); };
  const need = (req, res, next) => {
    if (!isProvider(cfg, req)) return res.status(403).json({ error: 'لوحة مِثقال لمزوّد المنصة فقط' + (cfg.mfa ? ' (بجلسة بخطوتين)' : '') });
    if (!controlReady) return res.status(503).json({ error: 'مشروع التحكم غير مضبوط (MQ_CONTROL_PROJECT/MQ_CONTROL_SA)' });
    next();
  };
  const plim = rateLimit({ windowMs: 60000, max: 120, keyFn: (r) => 'prov:' + ((r.user && r.user.email) || r.ip) });
  const audit = (req, what, x) => console.log('[provider]', (req.user && req.user.email) || '', what, JSON.stringify(x || {}));

  // هل المستخدم مزوّد؟ (الواجهة تُظهر اللوحة بناءً على هذا، والمسارات الأخرى تفحصه من جديد)
  app.get('/api/provider/me', requireMember, (req, res) => res.json({ provider: isProvider(cfg, req), controlReady: !!controlReady, mfa: cfg.mfa }));

  app.get('/api/provider/tenants', requireMember, need, plim, async (req, res) => {
    try {
      const subs = Object.fromEntries((await store.listSubs()).map(x => [x.tenant, x])), reg = registry(), d = today(now);
      const list = T.list.filter(t => t.id !== 'default').map(t => {
        const sub = subs[t.id] || {}, st = subscriptionState(sub.paidThrough || '', d), r = reg[t.id] || {};
        return { id: t.id, name: r.name || '', projectId: t.projectId, plan: t.plan, registryPlan: r.plan || '', registryStatus: r.status || (r.id ? 'active' : 'missing'),
          paidThrough: sub.paidThrough || '', trial: !!sub.trial, period: sub.period || '', ...st,
          keys: { web: !!t.apiKey, zatca: !!t.zatcaKey, ops: !!(t.sa && t.sa.client_email) } };
      });
      for (const id of Object.keys(reg)) if (!T.byId(id)) list.push({ id, name: reg[id].name || '', projectId: (reg[id].firebase || {}).projectId || '', plan: '', registryPlan: reg[id].plan || '', registryStatus: reg[id].status || 'active', state: 'unconfigured', recommend: 'active', keys: { web: false, zatca: false, ops: false } });
      res.json({ tenants: list, errors: T.errors.length });
    } catch (e) { console.error('[provider] tenants', e.message); res.status(502).json({ error: 'تعذّر تحميل المنشآت' }); }
  });

  app.get('/api/provider/invoices', requireMember, need, plim, async (req, res) => {
    const id = s(req.query.tenant, 40);
    if (!T.byId(id)) return res.status(404).json({ error: 'منشأة غير معروفة' });
    try { res.json({ invoices: (await store.listInvoices(id)).map(({ gw, ...v }) => v) }); } catch (e) { res.status(502).json({ error: 'تعذّر تحميل الفواتير' }); }
  });

  app.post('/api/provider/invoice/confirm', json, requireMember, need, plim, async (req, res) => {
    try {
      const no = String((req.body && req.body.no) || ''), ref = s(req.body && req.body.ref, 60), amount = Math.round(Number(req.body && req.body.amount) * 100);
      if (!okInvoiceNo(no)) return res.status(400).json({ error: 'رقم فاتورة غير صالح' });
      if (ref.length < 3) return res.status(400).json({ error: 'مرجع التحويل مطلوب' });
      const inv = await store.getInvoice(no);
      if (!inv || !['pending_transfer', 'open'].includes(inv.status)) return res.status(409).json({ error: inv ? 'حالة الفاتورة: ' + inv.status : 'الفاتورة غير موجودة' });
      const r = applyPayment(inv, { ref: 'bank:' + ref, method: 'bank', amount, at: new Date(now()).toISOString() });
      if (r.error) return res.status(409).json({ error: r.error });
      await store.putInvoice({ ...r.inv, confirmedBy: req.user.email }); await extendSub(store, r.inv);
      audit(req, 'confirm', { no, ref }); res.json({ ok: true, status: 'paid', end: r.inv.end });
    } catch (e) { console.error('[provider] confirm', e.message); res.status(502).json({ error: 'تعذّر التأكيد' }); }
  });

  app.post('/api/provider/invoice/void', json, requireMember, need, plim, async (req, res) => {
    try {
      const no = String((req.body && req.body.no) || ''); const inv = okInvoiceNo(no) ? await store.getInvoice(no) : null;
      if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
      if (inv.status === 'paid') return res.status(409).json({ error: 'لا تُلغى فاتورة مدفوعة' });
      await store.putInvoice({ ...inv, status: 'void', voidAt: new Date(now()).toISOString(), voidBy: req.user.email });
      audit(req, 'void', { no }); res.json({ ok: true });
    } catch (e) { res.status(502).json({ error: 'تعذّر الإلغاء' }); }
  });

  // حالة الاشتراك الفعلية (تطبّقها القواعد) — بحساب خدمة المنشأة إن ضُبط، وإلا الأمر اليدوي
  app.post('/api/provider/status', json, requireMember, need, plim, async (req, res) => {
    const t = T.byId(s(req.body && req.body.tenant, 40)), status = String((req.body && req.body.status) || '');
    if (!t || t.id === 'default') return res.status(404).json({ error: 'منشأة غير معروفة' });
    if (!['active', 'readonly', 'suspended'].includes(status)) return res.status(400).json({ error: 'حالة غير معروفة' });
    const cmd = 'node scripts/tenant-provision.mjs status --id ' + t.id + ' --set ' + status;
    if (!(t.sa && t.sa.client_email && t.sa.private_key)) return res.status(409).json({ error: 'لا حساب خدمة تشغيلي لهذه المنشأة (saEnv) — نفّذ الأمر يدويًا', cmd });
    try { await writeTenantStatus({ tenant: t, status, fetchImpl, tokenFor }); audit(req, 'status', { tenant: t.id, status }); res.json({ ok: true, note: status === 'suspended' ? 'حدّث السجل public/tenants أيضًا لتظهر صفحة الإيقاف' : '' }); }
    catch (e) { res.status(e.status || 502).json({ error: e.message, cmd }); }
  });

  // الفترة التجريبية: «مدفوع حتى» = اليوم + الأيام، لمنشأة لم يسبق لها اشتراك فقط
  app.post('/api/provider/trial', json, requireMember, need, plim, async (req, res) => {
    try {
      const t = T.byId(s(req.body && req.body.tenant, 40)); const days = Math.min(60, Math.max(1, parseInt(req.body && req.body.days, 10) || cfg.trialDays));
      if (!t || t.id === 'default') return res.status(404).json({ error: 'منشأة غير معروفة' });
      const cur = (await store.getSub(t.id)) || {};
      if (cur.paidThrough) return res.status(409).json({ error: 'للمنشأة اشتراك سابق — التجربة للمنشآت الجديدة فقط' });
      const paidThrough = addDays(today(now), days - 1);
      await store.putSub(t.id, { ...cur, plan: t.plan, period: '', paidThrough, trial: true, trialDays: days, trialBy: req.user.email });
      audit(req, 'trial', { tenant: t.id, days }); res.json({ ok: true, paidThrough });
    } catch (e) { res.status(502).json({ error: 'تعذّر بدء التجربة' }); }
  });

  app.get('/api/provider/signups', requireMember, need, plim, async (req, res) => {
    try { res.json({ signups: (await store.listSignups()).slice(0, 200) }); } catch (e) { res.status(502).json({ error: 'تعذّر تحميل الطلبات' }); }
  });
  app.post('/api/provider/signups/decide', json, requireMember, need, plim, async (req, res) => {
    try {
      const id = s(req.body && req.body.id, 40), status = String((req.body && req.body.status) || '');
      if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'القرار: approved | rejected' });
      const sg = await store.getSignup(id); if (!sg) return res.status(404).json({ error: 'الطلب غير موجود' });
      if (sg.status !== 'new') return res.status(409).json({ error: 'اتُّخذ القرار سابقًا' });
      const tid = /^[a-z0-9][a-z0-9-]{1,21}$/.test(String(req.body.tenantId || '')) && req.body.tenantId !== 'default' ? req.body.tenantId : suggestId(sg.company, sg.seq);
      const next = { ...sg, status, decidedAt: new Date(now()).toISOString(), decidedBy: req.user.email, note: s(req.body.note, 300), tenantId: status === 'approved' ? tid : '' };
      await store.putSignup(next); audit(req, 'signup', { id, status });
      const q = (x) => '"' + String(x).replace(/["\\$`]/g, '') + '"';
      res.json({ ok: true, signup: next, cmd: status === 'approved' ? 'node scripts/tenant-provision.mjs plan --id ' + tid + ' --name ' + q(sg.company) + ' --plan ' + sg.plan + ' --owner ' + sg.email : '' });
    } catch (e) { res.status(502).json({ error: 'تعذّر حفظ القرار' }); }
  });

  // التسجيل العام (بلا دخول): طلب للمراجعة فقط — حدّ صارم لكل عنوان، وحقل مخفي للروبوتات
  app.post('/api/signup', json, rateLimit({ windowMs: 3600000, max: 5 }), async (req, res) => {
    if (!controlReady) return res.status(503).json({ error: 'التسجيل غير متاح حاليًا — تواصل معنا' });
    const r = validateSignup(req.body || {});
    if (r.error === 'spam') return res.json({ ok: true });   // لا نكشف للروبوت أنه رُفض
    if (r.error) return res.status(400).json({ error: r.error });
    try {
      const recent = (await store.listSignups()).filter(x => x.email === r.v.email && x.status === 'new');
      if (recent.length) return res.json({ ok: true, id: recent[0].id, dup: true });
      const seq = await store.nextSignupSeq();
      const sg = { id: 'S' + String(seq).padStart(5, '0'), seq, ...r.v, status: 'new', at: new Date(now()).toISOString() };
      await store.putSignup(sg); console.log('[signup]', sg.id, sg.plan);
      res.json({ ok: true, id: sg.id });
    } catch (e) { console.error('[signup]', e.message); res.status(502).json({ error: 'تعذّر إرسال الطلب — أعد المحاولة' }); }
  });
}
