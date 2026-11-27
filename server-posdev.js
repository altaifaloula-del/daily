/**
 * v56.54 — سجل أجهزة نقطة البيع على الخادم بأرقام فريدة لكل فرع (docs/pos/POS_OFFLINE_SW.md §3).
 * POST /api/pos/device-register  { branchId, devKey, localTag?, name? }  ⇒  { ok, tag, again }
 * • الطالب عضو نشط (requireMember) ومن فرع الطلب (أو مركزي/مسؤول منصة) — العضوية تُقرأ بحساب الخدمة، لا من جسم الطلب.
 * • يعمل فقط حين يفعّل مسؤول النظام org.posCfg.devReg والفرع مفعّل في نقطة البيع (posCfg.branches).
 * • الرقم من عدّاد في pos_devices/<الفرع> بمعاملة Firestore واحدة (طلبان متزامنان لا يأخذان الرقم نفسه)،
 *   ومفتاح عدم التكرار = devKey: الجهاز نفسه يأخذ رقمه نفسه مهما أعاد الطلب. الرقم لا يُعاد استخدامه.
 * • pos_devices مجموعة خادمية: القاعدة العامة في firestore.rules تمنع العملاء (لا قراءة ولا كتابة) — اختبار في security.rules.test.mjs.
 * • سقف 200 جهاز لكل فرع، وحد الطلبات بالمستخدم، ومهلة لكل نداء خارجي.
 */
import { saTokenSource } from './server-billing.js';
import { memberInBranch } from './server-poscredit.js';

const KEY = /^[A-Za-z0-9_-]{1,120}$/;
const DEVKEY = /^[A-Za-z0-9_-]{16,64}$/;
const LOCAL_TAG = /^[A-Z0-9]{1,8}$/;
export const DEV_CAP = 200;
/** الوسم من الرقم: «D» + 4 أرقام على الأقل (5 خانات) — لا يتصادم مع الوسم المحلي (2 أو 4 خانات) */
export const devTagOf = (n) => 'D' + String(Math.floor(Number(n) || 0)).padStart(4, '0');

/** تحقق نقي من جسم الطلب */
export function devRegInput(b) {
  const x = b || {};
  if (typeof x !== 'object' || Array.isArray(x)) return { err: 'طلب غير صالح' };
  const extra = Object.keys(x).filter(k => !['branchId', 'devKey', 'localTag', 'name'].includes(k));
  if (extra.length) return { err: 'حقول غير متوقعة' };
  if (!KEY.test(String(x.branchId || ''))) return { err: 'الفرع غير صالح' };
  if (typeof x.devKey !== 'string' || !DEVKEY.test(x.devKey)) return { err: 'مفتاح الجهاز غير صالح' };
  if (x.localTag != null && (typeof x.localTag !== 'string' || !LOCAL_TAG.test(x.localTag))) return { err: 'الوسم المحلي غير صالح' };
  if (x.name != null && (typeof x.name !== 'string' || x.name.length > 40)) return { err: 'اسم الجهاز غير صالح' };
  return { v: { branchId: x.branchId, devKey: x.devKey, localTag: x.localTag || '', name: String(x.name || '').replace(/[\u0000-\u001f<>]/g, '').trim() } };
}

/**
 * القرار النقي: devs = الأجهزة المسجّلة للفرع، next = الرقم التالي. الجهاز المسجّل سابقًا (devKey) ⇒ رقمه نفسه بلا زيادة.
 * يعيد { ok, tag, again, devs, next } أو { ok:false, why }.
 */
export function devRegDecide({ devs = [], next = 1, devKey, localTag = '', name = '', by = '', now = Date.now() }) {
  const L = Array.isArray(devs) ? devs : [];
  const prev = L.find(d => d && d.k === devKey);
  if (prev) return { ok: true, again: true, tag: prev.tag, devs: L, next };
  if (L.length >= DEV_CAP) return { ok: false, why: 'بلغ الفرع الحد الأعلى للأجهزة المسجّلة (' + DEV_CAP + ') — راجع مسؤول النظام' };
  const used = new Set(L.map(d => d && d.tag));
  let n = Math.max(1, Math.floor(Number(next) || 1), ...L.map(d => (Number(String((d && d.tag) || '').slice(1)) || 0) + 1));
  while (used.has(devTagOf(n))) n++;
  const tag = devTagOf(n);
  return { ok: true, again: false, tag, devs: [...L, { k: devKey, tag, at: new Date(now).toISOString(), by, ...(localTag ? { local: localTag } : {}), ...(name ? { name } : {}) }], next: n + 1 };
}

const S = (v) => ({ stringValue: String(v) });
const val = (f) => !f ? undefined : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'doubleValue' in f ? Number(f.doubleValue) : 'booleanValue' in f ? f.booleanValue
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(val) : 'timestampValue' in f ? f.timestampValue : undefined;
const fieldsOf = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, f]) => { o[k] = val(f); }); return o; };
const FETCH_MS = 10000;

export function mountPosDevices(app, { express, requireMember, rateLimit, T, fetchImpl = fetch, log = console, orgLoader = null, now = Date.now, timeoutMs = FETCH_MS }) {
  const json = express.json({ limit: '2kb' });
  const lim = rateLimit({ windowMs: 60 * 1000, max: 10, keyFn: (r) => 'pd:' + String((r.user && r.user.email) || '').toLowerCase() });
  const tokens = new Map();
  const tenantOf = (req) => T.byId((req.user && req.user.tenant) || 'default') || T.def;
  const tok = (t) => { if (!tokens.has(t.id)) tokens.set(t.id, saTokenSource(t.sa, { fetchImpl })); return tokens.get(t.id)(); };
  const root = (t) => 'projects/' + (t.dataProject || t.projectId) + '/databases/(default)';
  const api = (t) => 'https://firestore.googleapis.com/v1/' + root(t);
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
  const loadOrg = orgLoader || (async (t) => {
    const h = fieldsOf(await getDoc(t, 'platform/rms8_org')); const parts = Number(h.parts) || 1; let text = h.value;
    if (parts > 1) { if (parts > 500) throw new Error('org parts'); const ch = [];
      for (let i = 0; i < parts; i++) ch.push(fieldsOf(await getDoc(t, 'platform/rms8_org__' + (h.ver ? h.ver + '_' : '') + i)).chunk || '');
      text = ch.join(''); }
    return text ? JSON.parse(text) : {};
  });
  const member = async (t, email) => { const [md, ad] = await Promise.all([getDoc(t, 'members/' + encodeURIComponent(email)), getDoc(t, 'platform/admins')]);
    const m = fieldsOf(md); return { m, admin: (fieldsOf(ad).emails || []).some(e => String(e || '').toLowerCase() === email) && (!md || m.active === true) }; };

  app.post('/api/pos/device-register', json, requireMember, lim, async (req, res) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase();
    const inp = devRegInput(req.body); if (inp.err) return res.status(400).json({ error: inp.err });
    const q = inp.v; const t = tenantOf(req);
    if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' });
    let M;
    try { M = await member(t, email); } catch (e) { log.error('pos/device-register member', t.id, e.message); return res.status(502).json({ error: 'تعذّر التحقق من العضوية' }); }
    if (!memberInBranch(M.m, q.branchId, M.admin)) return res.status(403).json({ error: 'لا صلاحية على هذا الفرع' });
    try { const c = ((await loadOrg(t)) || {}).posCfg || {};
      if (!c.devReg) return res.status(409).json({ error: 'سجل أجهزة نقطة البيع غير مفعّل للمنشأة' });
      if (!(c.branches || []).includes(q.branchId)) return res.status(409).json({ error: 'نقطة البيع غير مفعّلة لهذا الفرع' }); }
    catch (e) { log.error('pos/device-register org', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة إعداد المنشأة' }); }
    const path = 'pos_devices/' + q.branchId;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const { transaction: tx } = await call(t, '/documents:beginTransaction', { options: { readWrite: {} } });
        const cur = await getDoc(t, path, tx); const F = fieldsOf(cur); let devs = [];
        try { devs = JSON.parse(F.devs || '[]'); } catch { devs = []; }
        const rollback = () => call(t, '/documents:rollback', { transaction: tx }).catch(() => {});
        const d = devRegDecide({ devs, next: F.next, devKey: q.devKey, localTag: q.localTag, name: q.name, by: email, now: now() });
        if (!d.ok || d.again) { await rollback();
          log.log('pos/device-register', t.id, d.ok ? 'again' : 'refused', q.branchId);
          return d.ok ? res.json({ ok: true, tag: d.tag, again: true }) : res.status(409).json({ ok: false, error: d.why }); }
        const writes = [{ update: { name: root(t) + '/documents/' + path, fields: { branchId: S(q.branchId), next: { integerValue: String(d.next) }, devs: S(JSON.stringify(d.devs)) } },
          ...(cur ? {} : { currentDocument: { exists: false } }), updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }] }];
        try { await call(t, '/documents:commit', { writes, transaction: tx });
          log.log('pos/device-register', t.id, 'ok', q.branchId, d.tag);
          return res.json({ ok: true, tag: d.tag, again: false }); }
        catch (e) { if (e.code === 'ABORTED' || e.code === 'ALREADY_EXISTS' || e.code === 'FAILED_PRECONDITION' || e.status === 409) continue; throw e; }
      }
      return res.status(503).json({ error: 'تزاحم — أعد المحاولة' });
    } catch (e) { log.error('pos/device-register', t.id, e.message); return res.status(502).json({ error: 'تعذّر تسجيل الجهاز' }); }
  });
}
