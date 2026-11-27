/**
 * v56.46 — تفويض البيع الآجل من نقطة البيع (docs/finance/06-POS-CREDIT.md — قرار المجلس 6).
 * POST /api/pos/credit-auth  { orderId, branchId, customerKey, amount, date }
 * • الطالب عضو نشط (requireMember) ومن فرع الطلب (أو مركزي/مدير منصة) — العضوية تُقرأ بحساب الخدمة، لا من جسم الطلب.
 * • الأهلية والحد والمهلة من سجل العميل في المركز (org.partners) — لا من الجهاز.
 * • التعرض = الرصيد المرحّل في دفتر العميل + آجل الكاشير غير المرحّل في كل الفروع + حجوزات أقل من 24 ساعة لم تصل فاتورتها.
 *   يُرفض إن تجاوز (التعرض + المبلغ) الحد. لا يتجاوز الحد الكاشير ولا مدير الفرع؛ العلاج رفع الحد مركزيًا.
 * • الحجز في pos_credit/<بصمة العميل> بمعاملة Firestore واحدة (حجزان متزامنان لا يتجاوزان الحد معًا)، ومفتاح عدم التكرار = معرّف الطلب.
 * • يعمل بحساب خدمة المنشأة؛ قواعد Firestore تمنع العملاء من المجموعة (القاعدة العامة: لا قراءة ولا كتابة).
 * • (المراجعة الأمنية) في المعاملة نفسها سجل دائم pos_credit_log/<orderId> يُكتب مرة واحدة ولا يُحذف؛ و/api/pos/credit-exceptions
 *   (للأدوار المالية المركزية) يقارن فواتير الآجل في فترة بالسجل: بلا تفويض، أو مبلغ أكبر، أو عميل/فرع مختلف ⇒ استثناء.
 * • سقف 50 حجزًا حيًا لكل عميل و20 لكل مستخدم، وحد الطلبات بالمستخدم، ومهلة لكل نداء خارجي، والمفتاح يُفحص من مستند المنشأة قبل التحميل الثقيل.
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

/** سقف الحجوزات الحية (حماية حد العميل من الاستنزاف — المراجعة الأمنية 8) */
export const HOLD_CAP_CUST = 50, HOLD_CAP_USER = 20;
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
  if (live.length >= HOLD_CAP_CUST) return { ok: false, why: 'حجوزات معلّقة كثيرة على هذا العميل (' + live.length + ') — انتظر وصول فواتيرها أو راجع المركز' };
  if (by && live.filter(h => h.by === by).length >= HOLD_CAP_USER) return { ok: false, why: 'حجوزات معلّقة كثيرة من هذا المستخدم على العميل — أرسل الفواتير المعلّقة أولًا' };
  const held = r2(live.reduce((a, h) => a + (Number(h.amount) || 0), 0));
  const exposure = r2((Number(s.posted) || 0) + (Number(s.unposted) || 0) + held);
  const avail = r2((Number(s.limit) || 0) - exposure);
  if (!(Number(s.limit) > 0)) return { ok: false, why: 'لا حد ائتمان للعميل', avail: 0, exposure };
  if (r2(amount) > avail + 0.004) return { ok: false, why: 'يتجاوز حد الائتمان — المتاح ' + Math.max(0, avail).toFixed(2) + ' ر.س. رفع الحد من المركز (الإدارة المالية)', avail: Math.max(0, avail), exposure };
  const dueDate = creditDue(date, s.terms); const after = r2(avail - amount);
  const authId = 'ca_' + crypto.createHash('sha256').update(orderId + '|' + now).digest('hex').slice(0, 16);
  return { ok: true, dueDate, terms: s.terms || 0, avail: after, exposure, authId, holds: [...live, { id: orderId, amount: r2(amount), at: now, br: branchId, by, dueDate, avail: after, authId }] };
}

const WHY_AR = { noauth: 'بلا تفويض من الخادم', over: 'المبلغ الآجل أكبر من المفوَّض', cust: 'عميل مختلف عن المفوَّض', branch: 'فرع مختلف عن المفوَّض' };
/**
 * استثناءات التفويض (المراجعة الأمنية 7): كل فاتورة كاشير (غير ملغاة) فيها دفعة آجلة في الفترة تُقارن بسجل التفويض الدائم.
 * logs = { [orderId]: { amount, customerKey, branchId } }. يعيد قائمة { orderId, no, branchId, date, customerKey, amount, authAmount, why, whyAr }.
 */
export function creditExceptions(orders, logs, { from = '', to = '9999-12-31' } = {}) {
  const out = [];
  (orders || []).forEach(o => {
    if (!o || o.kind === 'return' || o.status === 'void') return; const d = String(o.date || ''); if (d < from || d > to) return;
    const cp = (o.payments || []).filter(p => p && p.m === 'credit'); const amt = r2(cp.reduce((a, p) => a + (Number(p.amount) || 0), 0)); if (!(amt > 0.004)) return;
    const cust = (o.ar && o.ar.key) || (cp[0] && cp[0].custKey) || ''; const L = (logs || {})[o.id];
    const why = !L ? 'noauth' : amt > r2(L.amount) + 0.004 ? 'over' : cust !== L.customerKey ? 'cust' : (L.branchId && o.branchId !== L.branchId) ? 'branch' : '';
    if (why) out.push({ orderId: o.id, no: o.no || '', branchId: o.branchId || '', date: d, customerKey: cust, amount: amt, authAmount: L ? r2(L.amount) : 0, why, whyAr: WHY_AR[why] });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
}

/** هل العضو من فرع الطلب؟ (مطابق لـ canBranch في القواعد) */
export function memberInBranch(m, branchId, admin) {
  if (admin) return true; if (!m || m.active !== true) return false;
  if (m.role === 'accountant_view') return false;
  return m.scope === 'all' || m.branchId === branchId || (Array.isArray(m.branchIds) && m.branchIds.includes(branchId));
}

const custDoc = (key) => 'c_' + crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 40);
const S = (v) => ({ stringValue: String(v) });
const val = (f) => !f ? undefined : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'doubleValue' in f ? Number(f.doubleValue) : 'booleanValue' in f ? f.booleanValue
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(val) : 'timestampValue' in f ? f.timestampValue : undefined;
const fieldsOf = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, f]) => { o[k] = val(f); }); return o; };
/** الأدوار المركزية لفحص الاستثناءات — مطابقة finRole في القواعد + مسؤول النظام (ومدير المنصة من platform/admins) */
export const CREDIT_AUDIT_ROLES = ['system_admin', 'general_management', 'head_office', 'finance_department', 'accountant'];
const FETCH_MS = 10000;

export function mountPosCredit(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, log = console, engine = null, loader = null, orgLoader = null, now = Date.now, timeoutMs = FETCH_MS }) {
  const json = express.json({ limit: '8kb' });
  // حد الطلبات بالمستخدم (بعد التحقق من الهوية) لا بعنوان IP
  const lim = rateLimit({ windowMs: 60 * 1000, max: 30, keyFn: (r) => 'pc:' + String((r.user && r.user.email) || '').toLowerCase() });
  const limX = rateLimit({ windowMs: 60 * 1000, max: 6, keyFn: (r) => 'pcx:' + String((r.user && r.user.email) || '').toLowerCase() });
  const tokens = new Map();
  const tenantOf = (req) => T.byId((req.user && req.user.tenant) || 'default') || T.def;
  const tok = (t) => { if (!tokens.has(t.id)) tokens.set(t.id, saTokenSource(t.sa, { fetchImpl })); return tokens.get(t.id)(); };
  const root = (t) => 'projects/' + (t.dataProject || t.projectId) + '/databases/(default)';
  const api = (t) => 'https://firestore.googleapis.com/v1/' + root(t);
  // مهلة لكل نداء خارجي — لا يعلق الطلب (ولا الكاشير) على Firestore بطيء
  const tfetch = async (u, init = {}) => { const ac = typeof AbortController === 'function' ? new AbortController() : null; const tm = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
    try { return await fetchImpl(u, { ...init, ...(ac ? { signal: ac.signal } : {}) }); } finally { if (tm) clearTimeout(tm); } };
  const call = async (t, path, body, method = 'POST') => {
    const r = await tfetch(api(t) + path, { method, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && method === 'GET') return null;
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error && j.error.status; throw e; }
    return j;
  };
  const getDoc = (t, path, tx) => call(t, '/documents/' + path + (tx ? '?transaction=' + encodeURIComponent(tx) : ''), null, 'GET');
  let E = engine; const loadEngine = async () => { if (!E) E = await import('./dist-engine/engine.mjs'); return E; };
  const sget = (t) => async (u, init = {}) => { const r = await tfetch(u, { ...init, headers: { authorization: 'Bearer ' + await tok(t), 'content-type': 'application/json' } }); return { ok: r.ok, status: r.status, j: await r.json().catch(() => null) }; };
  // بيانات المنشأة: org + core + مستندات الفروع + فواتير نقطة البيع الآجلة (الشهرية أيضًا) — مصفوفات المحرك فقط
  const loadData = loader || ((t) => loadPlatformData(api(t) + '/documents', sget(t), now, { posCredit: true }));
  // مستند المنشأة وحده (رأسه وأجزاؤه) — لرفض الطلب مبكرًا إن كان المفتاح مطفأ قبل التحميل الثقيل
  const loadOrg = orgLoader || (async (t) => {
    const h = fieldsOf(await getDoc(t, 'platform/rms8_org')); const parts = Number(h.parts) || 1; let text = h.value;
    if (parts > 1) { if (parts > 500) throw new Error('org parts'); const ch = [];
      for (let i = 0; i < parts; i++) ch.push(fieldsOf(await getDoc(t, 'platform/rms8_org__' + (h.ver ? h.ver + '_' : '') + i)).chunk || '');
      text = ch.join(''); }
    return text ? JSON.parse(text) : {};
  });
  const member = async (t, email) => { const [md, ad] = await Promise.all([getDoc(t, 'members/' + encodeURIComponent(email)), getDoc(t, 'platform/admins')]);
    const m = fieldsOf(md); return { m, admin: (fieldsOf(ad).emails || []).some(e => String(e || '').toLowerCase() === email) && (!md || m.active === true) }; };

  app.post('/api/pos/credit-auth', json, requireMember, lim, async (req, res) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase();
    const inp = creditAuthInput(req.body); if (inp.err) return res.status(400).json({ error: inp.err });
    const q = inp.v; const t = tenantOf(req);
    if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' });
    let M;
    try { M = await member(t, email); } catch (e) { log.error('pos/credit-auth member', t.id, e.message); return res.status(502).json({ error: 'تعذّر التحقق من العضوية' }); }
    if (!memberInBranch(M.m, q.branchId, M.admin)) return res.status(403).json({ error: 'لا صلاحية على هذا الفرع' });
    try { const org = await loadOrg(t); if (!((org || {}).posCfg || {}).credit) return res.status(409).json({ error: 'البيع الآجل من نقطة البيع غير مفعّل للمنشأة' }); }
    catch (e) { log.error('pos/credit-auth org', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة إعداد المنشأة' }); }
    let data, snap;
    try { data = await loadData(t); const En = await loadEngine();
      if (!((data.org || {}).posCfg || {}).credit) return res.status(409).json({ error: 'البيع الآجل من نقطة البيع غير مفعّل للمنشأة' });
      snap = En.posCreditSnap(data.org, data.ops, q.customerKey); }
    catch (e) { log.error('pos/credit-auth data', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة بيانات المنشأة' }); }
    if (snap.err) return res.status(422).json({ ok: false, error: snap.err });
    const path = 'pos_credit/' + custDoc(q.customerKey), lpath = 'pos_credit_log/' + q.orderId;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { transaction: tx } = await call(t, '/documents:beginTransaction', { options: { readWrite: {} } });
        const [cur, lg] = await Promise.all([getDoc(t, path, tx), getDoc(t, lpath, tx)]); let holds = [];
        try { holds = JSON.parse(fieldsOf(cur).holds || '[]'); } catch { holds = []; }
        const rollback = () => call(t, '/documents:rollback', { transaction: tx }).catch(() => {});
        // السجل الدائم هو المرجع: الطلب المفوَّض سابقًا يعيد تفويضه نفسه، أو يُرفض إن اختلف العميل أو المبلغ
        if (lg) { const L = fieldsOf(lg); await rollback();
          if (L.customerKey === q.customerKey && Math.abs(r2(L.amount) - q.amount) < 0.005) return res.json({ ok: true, dueDate: L.dueDate || '', terms: snap.terms, avail: null, authId: L.authId || '' });
          return res.status(409).json({ ok: false, error: 'هذا الطلب مفوَّض سابقًا لعميل أو مبلغ مختلف — أعد إنشاء الطلب' }); }
        const d = creditDecide({ snap, holds, orderId: q.orderId, amount: q.amount, date: q.date, now: now(), branchId: q.branchId, by: email });
        if (!d.ok || d.again) { await rollback();
          log.log('pos/credit-auth', t.id, d.ok ? 'again' : 'refused', q.branchId);
          return d.ok ? res.json({ ok: true, dueDate: d.dueDate, terms: d.terms, avail: d.avail, authId: d.authId }) : res.status(422).json({ ok: false, error: d.why, avail: d.avail }); }
        // الحجز + سجل التفويض الدائم (لا يُحذف — القواعد تمنع العملاء، ويُكتب مرة واحدة) في المعاملة نفسها
        const writes = [{ update: { name: root(t) + '/documents/' + path, fields: { key: S(q.customerKey), holds: S(JSON.stringify(d.holds)) } } },
          { update: { name: root(t) + '/documents/' + lpath, fields: { orderId: S(q.orderId), branchId: S(q.branchId), customerKey: S(q.customerKey), amount: { doubleValue: q.amount }, dueDate: S(d.dueDate), authId: S(d.authId), by: S(email) } },
            currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }];
        try { await call(t, '/documents:commit', { writes, transaction: tx });
          log.log('pos/credit-auth', t.id, 'ok', q.branchId);
          return res.json({ ok: true, dueDate: d.dueDate, terms: d.terms, avail: d.avail, authId: d.authId }); }
        catch (e) { if (e.code === 'ABORTED' || e.code === 'ALREADY_EXISTS' || e.status === 409) continue; throw e; }
      }
      return res.status(503).json({ error: 'تزاحم — أعد المحاولة' });
    } catch (e) { log.error('pos/credit-auth', t.id, e.message); return res.status(502).json({ error: 'تعذّر حفظ الحجز' }); }
  });

  /** فحص تفويض الآجل: فواتير الكاشير الآجلة في الفترة مقابل السجل الدائم — للأدوار المركزية فقط */
  app.post('/api/pos/credit-exceptions', json, requireMember, limX, async (req, res) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase(); const b = req.body || {};
    if (Object.keys(b).some(k => !['from', 'to'].includes(k)) || !DATE.test(String(b.from || '')) || !DATE.test(String(b.to || '')) || b.from > b.to) return res.status(400).json({ error: 'الفترة غير صالحة' });
    if ((Date.parse(b.to) - Date.parse(b.from)) / 86400000 > 366) return res.status(400).json({ error: 'الفترة أطول من سنة' });
    const t = tenantOf(req);
    if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' });
    let M; try { M = await member(t, email); } catch (e) { log.error('pos/credit-exceptions member', t.id, e.message); return res.status(502).json({ error: 'تعذّر التحقق من العضوية' }); }
    if (!(M.admin || (M.m.active === true && CREDIT_AUDIT_ROLES.includes(M.m.role)))) return res.status(403).json({ error: 'فحص التفويض للأدوار المالية المركزية فقط' });
    try {
      const data = await loadData(t);
      const orders = ((data.ops || {}).posOrders || []).filter(o => o && o.kind !== 'return' && o.status !== 'void' && String(o.date || '') >= b.from && String(o.date || '') <= b.to && (o.payments || []).some(p => p && p.m === 'credit'));
      const ids = [...new Set(orders.map(o => String(o.id)).filter(x => KEY.test(x)))]; const logs = {};
      for (let i = 0; i < ids.length; i += 100) {
        const r = await call(t, '/documents:batchGet', { documents: ids.slice(i, i + 100).map(id => root(t) + '/documents/pos_credit_log/' + id) });
        (Array.isArray(r) ? r : []).forEach(x => { if (x && x.found) logs[x.found.name.split('/').pop()] = fieldsOf(x.found); }); }
      const list = creditExceptions(orders, logs, { from: b.from, to: b.to });
      log.log('pos/credit-exceptions', t.id, orders.length + '/' + list.length);
      return res.json({ checked: orders.length, exceptions: list });
    } catch (e) { log.error('pos/credit-exceptions', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة البيانات' }); }
  });
}
