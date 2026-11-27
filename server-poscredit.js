/**
 * v56.46 — تفويض البيع الآجل من نقطة البيع (docs/finance/06-POS-CREDIT.md — قرار المجلس 6).
 * POST /api/pos/credit-auth  { orderId, branchId, customerKey, amount, date }
 * • الطالب عضو نشط (requireMember) ومن فرع الطلب (أو مركزي/مدير منصة) — العضوية تُقرأ بحساب الخدمة، لا من جسم الطلب.
 * • الأهلية والحد والمهلة من سجل العميل في المركز (org.partners) — لا من الجهاز.
 * • التعرض = الرصيد المرحّل في دفتر العميل + آجل الكاشير غير المرحّل في كل الفروع + حجوزات أقل من 24 ساعة لم تصل فاتورتها.
 *   يُرفض إن تجاوز (التعرض + المبلغ) الحد. لا يتجاوز الحد الكاشير ولا مدير الفرع؛ العلاج رفع الحد مركزيًا.
 * • الحجز في pos_credit/<بصمة العميل> بمعاملة Firestore واحدة (حجزان متزامنان لا يتجاوزان الحد معًا)، ومفتاح عدم التكرار = معرّف الطلب.
 * • يعمل بحساب خدمة المنشأة؛ قواعد Firestore تمنع العملاء من المجموعة (القاعدة العامة: لا قراءة ولا كتابة).
 */
import crypto from 'crypto';
import { saTokenSource } from './server-billing.js';
import { loadPlatformData } from './server-mcp.js';

const KEY = /^[A-Za-z0-9_-]{1,120}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOLD_MS = 24 * 3600 * 1000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** الاستحقاق = تاريخ الفاتورة + المهلة بالأيام (مطابق لـ posCreditDue في المحرك) */
export function creditDue(date, days) {
  const t = Date.parse(String(date || '') + 'T12:00:00Z'); if (isNaN(t)) return '';
  return new Date(t + Math.max(0, Math.floor(Number(days) || 0)) * 86400000).toISOString().slice(0, 10);
}

/** تحقق نقي من جسم الطلب */
export function creditAuthInput(b) {
  const x = b || {};
  const extra = Object.keys(x).filter(k => !['orderId', 'branchId', 'customerKey', 'amount', 'date'].includes(k));
  if (extra.length) return { err: 'حقول غير متوقعة' };
  if (!KEY.test(String(x.orderId || ''))) return { err: 'معرّف الطلب غير صالح' };
  if (!KEY.test(String(x.branchId || ''))) return { err: 'الفرع غير صالح' };
  if (typeof x.customerKey !== 'string' || !x.customerKey || x.customerKey.length > 150) return { err: 'العميل غير صالح' };
  if (!DATE.test(String(x.date || ''))) return { err: 'التاريخ غير صالح' };
  const a = Number(x.amount); if (typeof x.amount !== 'number' || !isFinite(a) || !(a > 0) || a > 10000000 || Math.abs(r2(a) - a) > 1e-9) return { err: 'المبلغ غير صالح' };
  return { v: { orderId: x.orderId, branchId: x.branchId, customerKey: x.customerKey, amount: r2(a), date: x.date } };
}

/**
 * القرار النقي: snap = { limit, terms, posted, unposted, orderIds } من المحرك (posCreditSnap)، holds = حجوزات العميل المخزّنة.
 * يعيد { ok, dueDate, terms, avail, exposure, holds (المحدّثة للحفظ), authId } أو { ok:false, why, avail, exposure }.
 */
export function creditDecide({ snap, holds = [], orderId, amount, date, now = Date.now(), branchId = '', by = '' }) {
  const s = snap || {}; const seen = new Set(s.orderIds || []);
  const prev = (holds || []).find(h => h && h.id === orderId);
  // عدم التكرار: الطلب نفسه محجوز سابقًا بالمبلغ نفسه ⇒ النتيجة نفسها بلا حجز ثانٍ
  if (prev && Math.abs(r2(prev.amount) - r2(amount)) < 0.005) return { ok: true, again: true, dueDate: prev.dueDate || creditDue(date, s.terms), terms: s.terms || 0, avail: prev.avail != null ? prev.avail : null, authId: prev.authId, holds };
  if (prev) return { ok: false, why: 'الطلب محجوز سابقًا بمبلغ مختلف — أعد إنشاء الطلب' };
  const live = (holds || []).filter(h => h && h.id !== orderId && now - (Number(h.at) || 0) < HOLD_MS && !seen.has(h.id));
  const held = r2(live.reduce((a, h) => a + (Number(h.amount) || 0), 0));
  const exposure = r2((Number(s.posted) || 0) + (Number(s.unposted) || 0) + held);
  const avail = r2((Number(s.limit) || 0) - exposure);
  if (!(Number(s.limit) > 0)) return { ok: false, why: 'لا حد ائتمان للعميل', avail: 0, exposure };
  if (r2(amount) > avail + 0.004) return { ok: false, why: 'يتجاوز حد الائتمان — المتاح ' + Math.max(0, avail).toFixed(2) + ' ر.س. رفع الحد من المركز (الإدارة المالية)', avail: Math.max(0, avail), exposure };
  const dueDate = creditDue(date, s.terms); const after = r2(avail - amount);
  const authId = 'ca_' + crypto.createHash('sha256').update(orderId + '|' + now).digest('hex').slice(0, 16);
  return { ok: true, dueDate, terms: s.terms || 0, avail: after, exposure, authId, holds: [...live, { id: orderId, amount: r2(amount), at: now, br: branchId, by, dueDate, avail: after, authId }] };
}

/** هل العضو من فرع الطلب؟ (مطابق لـ canBranch في القواعد) */
export function memberInBranch(m, branchId, admin) {
  if (admin) return true; if (!m || m.active !== true) return false;
  if (m.role === 'accountant_view') return false;
  return m.scope === 'all' || m.branchId === branchId || (Array.isArray(m.branchIds) && m.branchIds.includes(branchId));
}

const custDoc = (key) => 'c_' + crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
const S = (v) => ({ stringValue: String(v) });
const val = (f) => !f ? undefined : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'booleanValue' in f ? f.booleanValue
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(val) : 'timestampValue' in f ? f.timestampValue : undefined;
const fieldsOf = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, f]) => { o[k] = val(f); }); return o; };

export function mountPosCredit(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, log = console, engine = null, loader = null, now = Date.now }) {
  const json = express.json({ limit: '8kb' });
  const lim = rateLimit({ windowMs: 60 * 1000, max: 30 });
  const tokens = new Map();
  const tenantOf = (req) => T.byId((req.user && req.user.tenant) || 'default') || T.def;
  const tok = (t) => { if (!tokens.has(t.id)) tokens.set(t.id, saTokenSource(t.sa, { fetchImpl })); return tokens.get(t.id)(); };
  const root = (t) => 'projects/' + (t.dataProject || t.projectId) + '/databases/(default)';
  const api = (t) => 'https://firestore.googleapis.com/v1/' + root(t);
  const call = async (t, path, body, method = 'POST') => {
    const r = await fetchImpl(api(t) + path, { method, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && method === 'GET') return null;
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error && j.error.status; throw e; }
    return j;
  };
  const getDoc = (t, path, tx) => call(t, '/documents/' + path + (tx ? '?transaction=' + encodeURIComponent(tx) : ''), null, 'GET');
  let E = engine; const loadEngine = async () => { if (!E) E = await import('./dist-engine/engine.mjs'); return E; };
  // بيانات المنشأة: org + core + مستندات الفروع + فواتير نقطة البيع الآجلة (الشهرية أيضًا) — مصفوفات المحرك فقط
  const loadData = loader || (async (t) => {
    const get = async (u, init = {}) => { const r = await fetchImpl(u, { ...init, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' } }); return { ok: r.ok, status: r.status, j: await r.json().catch(() => null) }; };
    return loadPlatformData(api(t) + '/documents', get, now, { posCredit: true });
  });

  app.post('/api/pos/credit-auth', json, requireMember, lim, async (req, res) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase();
    const inp = creditAuthInput(req.body); if (inp.err) return res.status(400).json({ error: inp.err });
    const q = inp.v; const t = tenantOf(req);
    if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' });
    let m, admin;
    try { const [md, ad] = await Promise.all([getDoc(t, 'members/' + encodeURIComponent(email)), getDoc(t, 'platform/admins')]);
      m = fieldsOf(md); admin = (fieldsOf(ad).emails || []).some(e => String(e || '').toLowerCase() === email) && (!md || m.active === true); }
    catch (e) { log.error('pos/credit-auth member', t.id, e.message); return res.status(502).json({ error: 'تعذّر التحقق من العضوية' }); }
    if (!memberInBranch(m, q.branchId, admin)) return res.status(403).json({ error: 'لا صلاحية على هذا الفرع' });
    let data, snap;
    try { data = await loadData(t); const En = await loadEngine();
      if (!((data.org || {}).posCfg || {}).credit) return res.status(409).json({ error: 'البيع الآجل من نقطة البيع غير مفعّل للمنشأة' });
      snap = En.posCreditSnap(data.org, data.ops, q.customerKey); }
    catch (e) { log.error('pos/credit-auth data', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة بيانات المنشأة' }); }
    if (snap.err) return res.status(422).json({ ok: false, error: snap.err });
    const path = 'pos_credit/' + custDoc(q.customerKey);
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { transaction: tx } = await call(t, '/documents:beginTransaction', { options: { readWrite: {} } });
        const cur = await getDoc(t, path, tx); let holds = [];
        try { holds = JSON.parse(fieldsOf(cur).holds || '[]'); } catch { holds = []; }
        const d = creditDecide({ snap, holds, orderId: q.orderId, amount: q.amount, date: q.date, now: now(), branchId: q.branchId, by: email });
        if (!d.ok || d.again) { await call(t, '/documents:rollback', { transaction: tx }).catch(() => {});
          log.log('pos/credit-auth', t.id, d.ok ? 'again' : 'refused', q.branchId);
          return d.ok ? res.json({ ok: true, dueDate: d.dueDate, terms: d.terms, avail: d.avail, authId: d.authId }) : res.status(422).json({ ok: false, error: d.why, avail: d.avail }); }
        const writes = [{ update: { name: root(t) + '/documents/' + path, fields: { key: S(q.customerKey), holds: S(JSON.stringify(d.holds)) } } }];
        try { await call(t, '/documents:commit', { writes, transaction: tx });
          log.log('pos/credit-auth', t.id, 'ok', q.branchId);
          return res.json({ ok: true, dueDate: d.dueDate, terms: d.terms, avail: d.avail, authId: d.authId }); }
        catch (e) { if (e.code === 'ABORTED' || e.status === 409) continue; throw e; }
      }
      return res.status(503).json({ error: 'تزاحم — أعد المحاولة' });
    } catch (e) { log.error('pos/credit-auth', t.id, e.message); return res.status(502).json({ error: 'تعذّر حفظ الحجز' }); }
  });
}
