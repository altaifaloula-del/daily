/**
 * v52.9 — إدارة حسابات الدخول من التطبيق (بلاغ المالك 2026-11-20: حسابات الفروع والمحاسب «كلمة السر غير صحيحة»، وبريدها شكلي لا يستقبل رابط التعيين).
 * • لمسؤول النظام فقط (الدور من سجل العضوية الموثّق على الخادم)، وفي منشأته فقط (مشروع رمز الدخول).
 * • الهدف يجب أن يكون عضوًا في المنشأة نفسها، ولا يُمس حساب مسؤول نظام آخر (منع الاستيلاء) ولا حساب الطالب نفسه (يغيّره من «كلمة السر»).
 * • يعمل بحساب خدمة المنشأة (الرئيسية: FIREBASE_SERVICE_ACCOUNT على الخادم) — كلمة السر لا تُسجَّل ولا تُخزَّن ولا تعود في الرد.
 */
import { saTokenSource } from './server-billing.js';

const SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';
const okEmail = (v) => /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,}$/.test(v);
const iso = (ms) => { const n = Number(ms); return n > 0 ? new Date(n).toISOString() : ''; };

/** حالة حساب الدخول — دالة نقية لتحويل رد Google */
export function accountSummary(u) {
  if (!u) return { exists: false };
  return { exists: true, disabled: !!u.disabled, createdAt: iso(u.createdAt), lastLoginAt: iso(u.lastLoginAt), passwordUpdatedAt: iso(u.passwordUpdatedAt),
    providers: (u.providerUserInfo || []).map(p => p.providerId).filter(Boolean), mfa: (u.mfaInfo || []).length > 0, emailVerified: !!u.emailVerified };
}

export function validatePassword(p) {
  const s = String(p || '');
  if (s.length < 8) return 'كلمة السر 8 أحرف على الأقل';
  if (s.length > 64) return 'كلمة السر أطول من 64 حرفًا';
  if (!/[0-9]/.test(s) || !/[^0-9]/.test(s)) return 'كلمة السر تجمع أرقامًا وحروفًا';
  return '';
}

export function mountUserAdmin(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, log = console }) {
  const json = express.json({ limit: '4kb' });
  const lim = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
  const tokens = new Map();
  const tenantOf = (req) => T.byId((req.user && req.user.tenant) || 'default') || T.def;
  const tokenFor = (t) => { if (!tokens.has(t.id)) tokens.set(t.id, saTokenSource(t.sa, { fetchImpl, scope: SCOPE })); return tokens.get(t.id)(); };
  const base = (t) => 'https://identitytoolkit.googleapis.com/v1/projects/' + encodeURIComponent(t.dataProject || t.projectId);
  const call = async (t, path, body) => {
    const r = await fetchImpl(base(t) + path, { method: 'POST', headers: { authorization: 'Bearer ' + await tokenFor(t), 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  };
  const memberOf = async (t, email) => {   // الهدف عضو في المنشأة نفسها؟ (مستند members بحساب الخدمة)
    const r = await fetchImpl('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(t.dataProject || t.projectId) + '/databases/(default)/documents/members/' + encodeURIComponent(email),
      { headers: { authorization: 'Bearer ' + await tokenForFs(t) } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('تعذّرت قراءة العضوية');
    const f = ((await r.json()) || {}).fields || {};
    return { role: (f.role && f.role.stringValue) || '', active: !!(f.active && f.active.booleanValue) };
  };
  const fsTokens = new Map();
  const tokenForFs = (t) => { if (!fsTokens.has(t.id)) fsTokens.set(t.id, saTokenSource(t.sa, { fetchImpl })); return fsTokens.get(t.id)(); };

  /** بوابة مشتركة: مسؤول نظام + حساب خدمة مهيأ + هدف صالح من المنشأة نفسها وليس مسؤولًا ولا الطالب نفسه */
  const gate = async (req, res) => {
    if (!req.user || req.user.role !== 'system_admin') { res.status(403).json({ error: 'لمسؤول النظام فقط' }); return null; }
    const t = tenantOf(req);
    if (!t || !t.sa) { res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT) — أضفه في إعدادات Render ثم أعد المحاولة', code: 'no-sa' }); return null; }
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!okEmail(email)) { res.status(400).json({ error: 'بريد غير صالح' }); return null; }
    if (email === String(req.user.email || '').toLowerCase()) { res.status(400).json({ error: 'غيّر كلمة سرك من «كلمة السر» في حسابك' }); return null; }
    let mem; try { mem = await memberOf(t, email); } catch (e) { res.status(502).json({ error: e.message }); return null; }
    if (!mem) { res.status(404).json({ error: 'هذا البريد ليس عضوًا في منشأتك' }); return null; }
    if (mem.role === 'system_admin') { res.status(403).json({ error: 'لا يُدار حساب مسؤول نظام آخر من هنا' }); return null; }
    return { t, email };
  };

  app.post('/api/users/status', json, requireMember, lim, async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    try { const j = await call(g.t, '/accounts:lookup', { email: [g.email] }); res.json({ account: accountSummary((j.users || [])[0]) }); }
    catch (e) { log.error('users/status', g.t.id, e.message); res.status(502).json({ error: 'تعذّر الاستعلام من خدمة الدخول (' + e.message + ')' }); }
  });

  app.post('/api/users/password', json, requireMember, lim, async (req, res) => {
    const g = await gate(req, res); if (!g) return;
    const pw = String((req.body && req.body.password) || ''); const bad = validatePassword(pw);
    if (bad) return res.status(400).json({ error: bad });
    try {
      const j = await call(g.t, '/accounts:lookup', { email: [g.email] }); const u = (j.users || [])[0];
      if (u) await call(g.t, '/accounts:update', { localId: u.localId, password: pw, ...(req.body.enable ? { disableUser: false } : {}) });
      else await call(g.t, '/accounts', { email: g.email, password: pw });   // حساب مفقود من خدمة الدخول ⇒ يُنشأ بالبريد نفسه
      log.log('users/password', g.t.id, 'by', req.user.email, u ? 'updated' : 'created');   // بلا كلمة السر
      res.json({ ok: true, created: !u });
    } catch (e) { log.error('users/password', g.t.id, e.message); res.status(502).json({ error: 'تعذّر تعيين كلمة السر (' + e.message + ')' }); }
  });
}
