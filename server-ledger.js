/**
 * v56.14 — MUKTASAB FINANCE D5: الترحيل إلى دفتر القيود المخزّن من الخادم وحده (docs/finance/03-PHASE-D-LEDGER-DESIGN.md §5 D-5).
 * يغلق الحد المعروف في D1: قواعد Firestore لا تجمع سطور القيد — هنا يجمعها الخادم بنفسه بالهللات قبل الكتابة.
 * • الطالب عضو نشط بدور مالي (أو مسؤول نظام/مدير المنصة) — الدور من سجل العضوية الموثّق (server-auth).
 * • السطور أعداد هللات صحيحة غير سالبة، والمجموعان يحسبهما الخادم ويجب أن يتساويا وأن يكونا > 0؛ البصمة يحسبها الخادم.
 * • الفترة: بعد تاريخ القفل (fin_periods/locks)، أو قيد تاريخي legacy لمدير المنصة في نافذة ترحيل مفتوحة (fin_periods/migration).
 * • الرقم: معاملة Firestore واحدة — تقرأ عدّاد السنة وتكتب القيد (غير موجود سابقًا) والعدّاد +1، ومع العكس تعلّم الأصل «معكوسًا».
 *   قرار المالك: لا عكس لقيد في فترة مقفلة.
 * • يعمل بحساب خدمة المنشأة. القواعد بعد D5 تمنع أي كتابة على fin_ledger من المتصفح.
 */
import crypto from 'crypto';
import { saTokenSource } from './server-billing.js';

export const LEDGER_FIN_ROLES = ['system_admin', 'general_management', 'head_office', 'finance_department', 'accountant'];
const KEY = /^[A-Za-z0-9_-]{1,150}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, n) => typeof v === 'string' && v.length <= n;

/** تحقق نقي من قيد واحد — يعيد السجل الذي سيُكتب (بمجموعين وبصمة يحسبها الخادم) أو سبب الرفض */
export function ledgerValidate(item) {
  const it = item || {}, r = it.rec || {};
  if (!KEY.test(String(it.key || ''))) return { err: 'مفتاح غير صالح' };
  if (!DATE.test(String(r.date || ''))) return { err: 'تاريخ غير صالح' };
  if (!str(r.src, 200) || !r.src) return { err: 'مصدر غير صالح' };
  if (r.title != null && !str(r.title, 300)) return { err: 'بيان طويل' };
  if (!str(r.lines, 100000)) return { err: 'سطور غير صالحة' };
  let L; try { L = JSON.parse(r.lines); } catch { return { err: 'سطور غير صالحة' }; }
  if (!Array.isArray(L) || L.length < 2 || L.length > 2000) return { err: 'عدد السطور غير صالح' };
  let dr = 0, cr = 0;
  for (const l of L) {
    if (!Array.isArray(l) || l.length !== 4 || !str(l[0], 20) || !l[0] || !str(l[3], 100)) return { err: 'سطر غير صالح' };
    if (!Number.isSafeInteger(l[1]) || !Number.isSafeInteger(l[2]) || l[1] < 0 || l[2] < 0) return { err: 'المبالغ يجب أن تكون هللات صحيحة غير سالبة' };
    dr += l[1]; cr += l[2];
  }
  if (dr !== cr || dr <= 0) return { err: 'القيد غير متوازن بالهللات (' + dr + ' ≠ ' + cr + ')' };
  const ver = Number.isSafeInteger(r.ver) && r.ver >= 1 ? r.ver : 1;
  if (r.reversalOf != null && !KEY.test(String(r.reversalOf))) return { err: 'مرجع العكس غير صالح' };
  if (it.reverseId != null && (!KEY.test(String(it.reverseId)) || it.reverseId !== r.reversalOf)) return { err: 'العكس يجب أن يشير إلى الأصل نفسه' };
  const digest = crypto.createHash('sha256').update(JSON.stringify([r.date, L]), 'utf8').digest('hex');
  return { rec: { date: r.date, src: r.src, title: r.title || '', lines: r.lines, drH: dr, crH: cr, digest, ver, ...(r.reversalOf ? { reversalOf: r.reversalOf } : {}) } };
}

/** هل يُسمح بتاريخ القيد؟ دالة نقية */
export function ledgerPeriodOk(date, { lockedTo = '0000-00-00', legacy = false, admin = false, migOpen = false } = {}) {
  if (date > lockedTo) return true;
  return !!(legacy && admin && migOpen);
}

// ترميز حقول Firestore REST
const S = (v) => ({ stringValue: String(v) }), I = (v) => ({ integerValue: String(v) }), B = (v) => ({ booleanValue: !!v });
const val = (f) => !f ? undefined : 'stringValue' in f ? f.stringValue : 'integerValue' in f ? Number(f.integerValue) : 'booleanValue' in f ? f.booleanValue
  : 'timestampValue' in f ? f.timestampValue : 'arrayValue' in f ? (f.arrayValue.values || []).map(val) : undefined;

export function mountLedger(app, { express, requireMember, rateLimit, T, cv = 0, fetchImpl = fetch, log = console }) {
  const json = express.json({ limit: '2mb' });
  const lim = rateLimit({ windowMs: 60 * 1000, max: 60 });
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
  const fieldsOf = (d) => { const o = {}; Object.entries((d && d.fields) || {}).forEach(([k, f]) => { o[k] = val(f); }); return o; };

  /** حالة المنشأة: القفل ونافذة الترحيل ومديرو المنصة */
  async function context(t, email) {
    const [lk, mg, ad] = await Promise.all([getDoc(t, 'fin_periods/locks'), getDoc(t, 'fin_periods/migration'), getDoc(t, 'platform/admins')]);
    const L = fieldsOf(lk), M = fieldsOf(mg), A = fieldsOf(ad);
    return { lockedTo: String(L.lockedTo || '0000-00-00'), migOpen: M.open === true && !!M.until && new Date(M.until).getTime() > Date.now(),
      admin: (A.emails || []).some(e => String(e || '').toLowerCase() === email) };
  }

  /** معاملة واحدة: قيد + عدّاد (+ تعليم الأصل معكوسًا) — يُعاد المحاولة عند التزاحم */
  async function postOne(t, email, key, rec, reverseId, legacy, ctx) {
    const y = Number(rec.date.slice(0, 4));
    for (let attempt = 0; attempt < 4; attempt++) {
      const { transaction: tx } = await call(t, '/documents:beginTransaction', { options: { readWrite: {} } });
      const [ex, sq, og] = await Promise.all([getDoc(t, 'fin_ledger/' + key, tx), getDoc(t, 'fin_ledger_meta/seq_' + y, tx), reverseId ? getDoc(t, 'fin_ledger/' + reverseId, tx) : null]);
      if (ex) { await call(t, '/documents:rollback', { transaction: tx }).catch(() => {}); return { key, skip: 'exists' }; }
      if (reverseId) {
        const o = fieldsOf(og);
        if (!og || o.status !== 'posted') { await call(t, '/documents:rollback', { transaction: tx }).catch(() => {}); return { key, err: 'الأصل غير موجود أو ليس مرحّلًا' }; }
        if (!(String(o.date) > ctx.lockedTo)) { await call(t, '/documents:rollback', { transaction: tx }).catch(() => {}); return { key, err: 'لا عكس لقيد في فترة مقفلة (قرار المالك)' }; }
      }
      const n = (Number(fieldsOf(sq).n) || 0) + 1, no = 'JV-' + y + '-' + String(n).padStart(6, '0');
      const F = { no: S(no), year: I(y), seq: I(n), date: S(rec.date), src: S(rec.src), title: S(rec.title), lines: S(rec.lines), drH: I(rec.drH), crH: I(rec.crH),
        digest: S(rec.digest), ver: I(rec.ver), status: S('posted'), by: S(email), cv: I(cv), via: S('server'), ...(rec.reversalOf ? { reversalOf: S(rec.reversalOf) } : {}), ...(legacy ? { legacy: B(true) } : {}) };
      const writes = [
        { update: { name: root(t) + '/documents/fin_ledger/' + key, fields: F }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] },
        { update: { name: root(t) + '/documents/fin_ledger_meta/seq_' + y, fields: { n: I(n), last: S(key) } } },
        ...(reverseId ? [{ update: { name: root(t) + '/documents/fin_ledger/' + reverseId, fields: { status: S('reversed'), reversedBy: S(key) } }, updateMask: { fieldPaths: ['status', 'reversedBy'] }, currentDocument: { exists: true } }] : [])
      ];
      try { await call(t, '/documents:commit', { writes, transaction: tx }); return { key, no }; }
      catch (e) { if (e.code === 'ABORTED' || e.status === 409) continue; throw e; }
    }
    return { key, err: 'تزاحم — أعد المحاولة' };
  }

  app.post('/api/ledger/post', json, requireMember, lim, async (req, res) => {
    const u = req.user || {}; const email = String(u.email || '').toLowerCase();
    const t = tenantOf(req);
    if (!t || !t.sa) return res.status(409).json({ error: 'لم يُضبط حساب الخدمة على الخادم (FIREBASE_SERVICE_ACCOUNT)' });
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
    if (!items.length || items.length > 50) return res.status(400).json({ error: 'من 1 إلى 50 قيدًا في الطلب' });
    let ctx; try { ctx = await context(t, email); } catch (e) { log.error('ledger/context', t.id, e.message); return res.status(502).json({ error: 'تعذّرت قراءة حالة الفترات' }); }
    if (!(LEDGER_FIN_ROLES.includes(u.role) || ctx.admin)) return res.status(403).json({ error: 'الترحيل للأدوار المالية فقط' });
    const out = [];
    for (const it of items) {
      // «after»: لا يُرحَّل الإصدار الجديد إن لم يُرحَّل عكس الأصل في الطلب نفسه (وإلا احتُسب الأصل والجديد معًا)
      if (it && it.after) { const pr = out.find(x => x.key === it.after); if (!pr || !(pr.no || pr.skip)) { out.push({ key: it.key, err: 'لم يُرحَّل العكس قبله' }); continue; } }
      const v = ledgerValidate(it); if (v.err) { out.push({ key: it && it.key, err: v.err }); continue; }
      const legacy = it.legacy === true;
      if (!ledgerPeriodOk(v.rec.date, { lockedTo: ctx.lockedTo, legacy, admin: ctx.admin, migOpen: ctx.migOpen })) { out.push({ key: it.key, err: 'الفترة مقفلة' + (legacy ? ' — افتح نافذة الترحيل (للمدير)' : '') }); continue; }
      if (it.reverseId && legacy) { out.push({ key: it.key, err: 'لا عكس في قيد تاريخي' }); continue; }
      try { out.push(await postOne(t, email, it.key, v.rec, it.reverseId || null, legacy && !(v.rec.date > ctx.lockedTo), ctx)); }
      catch (e) { log.error('ledger/post', t.id, e.message); out.push({ key: it.key, err: 'تعذّرت الكتابة (' + (e.code || e.status || 'error') + ')' }); }
    }
    log.log('ledger/post', t.id, 'by', email, out.filter(x => x.no).length + '/' + items.length);
    res.json({ results: out });
  });
}
