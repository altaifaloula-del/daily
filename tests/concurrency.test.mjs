/**
 * المرحلة H (v56.60) — اختبارات التزامن: كتابات متزامنة ومتعارضة على حمايات قائمة لم يكن لها اختبار تزامن.
 * الجرد الكامل في docs/testing/PHASE_H_REPORT.md. ما كان مختبرًا قبل هذه المرحلة (لا يُكرر هنا):
 *   tabPayPart (tests/pos-restaurant.test.mjs:128) · حجز البيع الآجل (tests/pos-credit.test.mjs:141, 225) · تسجيل الأجهزة (tests/pos-offline-b.test.mjs:174)
 *   · قفل المزامنة دون اتصال posLockRun (tests/pos-offline.test.mjs:230, 250).
 * الجديد هنا:
 *   (1) ترحيل الدفتر المخزّن server-ledger.js: طلبات متزامنة ⇒ أرقام JV فريدة ومتتالية، والقيد نفسه مرة واحدة، والعكس مرة واحدة.
 *   (2) حجز الكوبون المحدود cpnReserve (App.jsx) من أجهزة متزامنة: لا يتجاوز الحد، والطلب نفسه لا يُحجز مرتين.
 * خادم Firestore REST الوهمي هنا يحترم المعاملات تفاؤليًا: كل قراءة داخل معاملة تُسجّل إصدار المستند، والإيداع يُرفض ABORTED إن تغيّر.
 * التزامن على المحاكي الحقيقي (الكتابة المشروطة fsWriteIf في storage.js): tests/concurrency.emu.test.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { build } from 'esbuild';
import { mountLedger } from '../server-ledger.js';
import { loadTenants } from '../tenants.js';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@test-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'test-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'test-prod', FIREBASE_SERVICE_ACCOUNT: SA };
const tick = (n) => new Promise(r => setTimeout(r, n));

/** Firestore REST وهمي بمعاملات تفاؤلية (إصدار لكل مستند) + currentDocument.exists + تأخير يُشابك الطلبات */
function fakeFirestore(docs = {}) {
  const db = {}; Object.entries(docs).forEach(([k, f]) => { db[k] = { fields: f, v: 1 }; });
  const txReads = {}; let txn = 0; const stats = { commits: 0, aborted: 0 };
  const fetchImpl = async (u, i = {}) => {
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    const fail = (status, s) => ({ ok: false, status, json: async () => ({ error: { status: s } }) });
    if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':beginTransaction')) { const t = 'TX' + (++txn); txReads[t] = {}; return ok({ transaction: t }); }
    if (u.endsWith(':rollback')) return ok({});
    if (u.endsWith(':commit')) { const b = JSON.parse(i.body); await tick(2); const R = (b.transaction && txReads[b.transaction]) || {};
      if (Object.entries(R).some(([k, v]) => ((db[k] || {}).v || 0) !== v)) { stats.aborted++; return fail(409, 'ABORTED'); }
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1];
        if (w.currentDocument && w.currentDocument.exists === false && db[k]) return fail(409, 'ALREADY_EXISTS');
        if (w.currentDocument && w.currentDocument.exists === true && !db[k]) return fail(404, 'NOT_FOUND'); }
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1];
        const fields = w.updateMask ? { ...((db[k] || {}).fields || {}), ...w.update.fields } : { ...w.update.fields, ...(w.updateTransforms ? { at: { timestampValue: 'NOW' } } : {}) };
        db[k] = { fields, v: ((db[k] || {}).v || 0) + 1 }; }
      stats.commits++; return ok({}); }
    const [p0, qs] = (u.split('/documents/')[1] || '').split('?'); const k = decodeURIComponent(p0);
    const tx = qs && /transaction=([^&]+)/.exec(qs); if (tx) { txReads[decodeURIComponent(tx[1])][k] = (db[k] || {}).v || 0; }
    await tick(1 + (k.length % 3));
    return db[k] ? ok({ fields: db[k].fields }) : { ok: false, status: 404, json: async () => ({}) };
  };
  const F = (k) => { const d = db[k]; if (!d) return null; const o = {}; Object.entries(d.fields).forEach(([n, f]) => { o[n] = f.stringValue ?? (f.integerValue != null ? Number(f.integerValue) : f.booleanValue ?? f.timestampValue); }); return o; };
  return { fetchImpl, db, F, stats };
}

/* ===== (1) ترحيل الدفتر المخزّن ===== */
const LINES = JSON.stringify([['1101', 115000, 0, 'b1'], ['4101', 0, 100000, 'b1'], ['2301', 0, 15000, 'b1']]);
const item = (key, x = {}) => ({ key, rec: { date: '2026-11-20', src: 'rev:' + key, title: 'إيراد', lines: LINES, ver: 1, ...(x.rec || {}) }, ...(x.reverseId ? { reverseId: x.reverseId } : {}) });
function ledgerHarness() {
  const FS = fakeFirestore({ 'fin_periods/locks': { lockedTo: { stringValue: '2026-10-31' } }, 'platform/admins': { emails: { arrayValue: { values: [] } } } });
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) };
  const users = { a1: { email: 'a1@test.sa', role: 'accountant', tenant: 'default' }, a2: { email: 'a2@test.sa', role: 'accountant', tenant: 'default' }, a3: { email: 'a3@test.sa', role: 'finance_department', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({}); req.user = u; next(); };
  mountLedger(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(ENV), cv: 565900, fetchImpl: FS.fetchImpl, log: { log() {}, error() {} } });
  const call = async (who, items) => { const req = { who, body: { items } }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes['/api/ledger/post']) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, ...FS };
}

test('الدفتر المخزّن: ثلاثة محاسبين يرحّلون في اللحظة نفسها ⇒ لا رقم مكرر ولا فجوة، والعدّاد = عدد المرحّل، والمتعارض يُعاد تلقائيًا', async () => {
  const H = ledgerHarness();
  const rs = await Promise.all([H.call('a1', [item('k1_v1'), item('k2_v1')]), H.call('a2', [item('k3_v1')]), H.call('a3', [item('k4_v1'), item('k5_v1')])]);
  assert.deepEqual(rs.map(r => r.status), [200, 200, 200]);
  const res = rs.flatMap(r => r.json.results); const nos = res.filter(x => x.no).map(x => x.no).sort();
  const crowded = res.filter(x => x.err); // «تزاحم — أعد المحاولة» مقبول (لا كتابة)، لكن المرحّل لا يتكرر رقمه أبدًا
  assert.equal(nos.length + crowded.length, 5); crowded.forEach(x => assert.match(x.err, /تزاحم/));
  assert.equal(new Set(nos).size, nos.length, 'لا رقم مكرر: ' + nos.join(','));
  assert.deepEqual(nos, nos.map((_, i) => 'JV-2026-' + String(i + 1).padStart(6, '0')), 'متتالية بلا فجوة');
  assert.equal(H.F('fin_ledger_meta/seq_2026').n, nos.length);
  assert.ok(H.stats.aborted > 0, 'حدث تعارض فعلًا وأُعيدت المعاملة (' + H.stats.aborted + ')');
  // كل قيد مرحّل في مستنده برقمه، وما لم يُرحَّل لا مستند له
  res.forEach(x => { const d = H.F('fin_ledger/' + x.key); if (x.no) assert.equal(d.no, x.no); else assert.equal(d, null); });
});

test('الدفتر المخزّن: القيد نفسه من جهازين في اللحظة نفسها ⇒ يُرحَّل مرة واحدة برقم واحد، والآخر «موجود»', async () => {
  const H = ledgerHarness();
  const rs = await Promise.all([H.call('a1', [item('same_v1')]), H.call('a2', [item('same_v1')]), H.call('a3', [item('same_v1')])]);
  const res = rs.map(r => r.json.results[0]);
  assert.equal(res.filter(x => x.no).length, 1, JSON.stringify(res));
  assert.ok(res.filter(x => !x.no).every(x => x.skip === 'exists' || /تزاحم/.test(x.err || '')), JSON.stringify(res));
  assert.equal(H.F('fin_ledger_meta/seq_2026').n, 1);
});

test('الدفتر المخزّن: عكس القيد الأصلي بإصدارين جديدين متزامنين ⇒ عكس واحد فقط، والأصل «معكوس» مرة، والآخر مرفوض', async () => {
  const H = ledgerHarness();
  assert.equal((await H.call('a1', [item('orig_v1')])).json.results[0].no, 'JV-2026-000001');
  const rev = (k) => item(k, { reverseId: 'orig_v1', rec: { reversalOf: 'orig_v1', lines: JSON.stringify([['1101', 0, 115000, 'b1'], ['4101', 100000, 0, 'b1'], ['2301', 15000, 0, 'b1']]) } });
  const rs = await Promise.all([H.call('a1', [rev('orig_r1')]), H.call('a2', [rev('orig_r2')])]);
  const res = rs.map(r => r.json.results[0]);
  assert.equal(res.filter(x => x.no).length, 1, JSON.stringify(res));
  assert.ok(res.find(x => !x.no).err, 'الثاني مرفوض: ' + JSON.stringify(res));
  const o = H.F('fin_ledger/orig_v1'); assert.equal(o.status, 'reversed'); assert.equal(o.reversedBy, res.find(x => x.no).key);
});

/* ===== (2) حجز الكوبون المحدود من أجهزة متزامنة =====
   cpnReserve يقرأ مستند الولاء المشترك ثم يكتبه كتابة مشروطة (cloud.setIfUnchanged). هنا تُستبدل طبقة التخزين بمخزن ذاكرة
   يحاكي البصمة لكل جهاز (AsyncLocalStorage = جهاز) — أي كتابة بعد أن كتب جهاز آخر ⇒ 'conflict' كما في fsWriteIf. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devCtx = new AsyncLocalStorage();
function fakeCloud(init) {
  const docs = new Map(Object.entries(init || {}).map(([k, v]) => [k, { v: JSON.stringify(v), ver: 1 }])); const seen = new Map(); let writes = 0, conflicts = 0;
  const dev = () => (devCtx.getStore() || { id: 'main' }).id; const jitter = () => tick(1 + Math.floor(Math.random() * 4));
  return {
    async get(key, dflt) { await jitter(); const d = docs.get(key); seen.set(dev() + '|' + key, d ? d.ver : 0); return d ? JSON.parse(d.v) : dflt; },
    async setIfUnchanged(key, val) { await jitter(); if ((devCtx.getStore() || {}).offline) return 'fail';
      const d = docs.get(key), cur = d ? d.ver : 0; if (seen.get(dev() + '|' + key) !== cur) { conflicts++; return 'conflict'; }
      docs.set(key, { v: JSON.stringify(val), ver: cur + 1 }); seen.set(dev() + '|' + key, cur + 1); writes++; return 'ok'; },
    peek: (key) => { const d = docs.get(key); return d ? JSON.parse(d.v) : undefined; }, stats: () => ({ writes, conflicts }) };
}
let CP = null;
async function cpnEngine() {
  if (CP) return CP;
  const cache = path.join(root, 'tests', '.cache'); fs.mkdirSync(cache, { recursive: true });
  const tag = process.pid + '-' + Math.random().toString(36).slice(2, 8);
  const shim = path.join(cache, 'StorageShim-' + tag + '.js'), entry = path.join(cache, 'Cpn-' + tag + '.jsx'), out = path.join(cache, 'cpn-' + tag + '.mjs');
  fs.writeFileSync(shim, "import { cloud as real } from '../../storage.js';\nexport * from '../../storage.js';\n"
    + "export const cloud = new Proxy({}, { get: (t, k) => (globalThis.__H_CLOUD__ && k in globalThis.__H_CLOUD__ ? globalThis.__H_CLOUD__ : real)[k] });\n");
  fs.writeFileSync(entry, "export { cpnReserve, cpnRelease, cpnKey } from '../../App.jsx';\n");
  const plugin = { name: 'storage-shim', setup(b) { b.onResolve({ filter: /^\.\/storage(\.js)?$/ }, (a) => (/App\.jsx$/.test(a.importer) ? { path: shim } : undefined)); } };
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, jsx: 'automatic', plugins: [plugin],
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'recharts', 'firebase/*', 'jsbarcode'] });
  try { CP = await import(out); } finally { for (const f of [shim, entry, out]) { try { fs.unlinkSync(f); } catch { } } }
  return CP;
}
const LOY = 'rms8:loy';
const onDev = (id, fn, extra = {}) => devCtx.run({ id, ...extra }, fn);

test('الكوبون المحدود بمرة واحدة: ستة أجهزة في ستة فروع تحجزه في اللحظة نفسها ⇒ يُقبل لواحد فقط، والباقي «استُنفد»، ولا يُكتب إلا استخدام واحد', async () => {
  const C = await cpnEngine(); const cl = globalThis.__H_CLOUD__ = fakeCloud({ [LOY]: { members: {}, tx: [] } });
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => onDev('dev' + i, () => C.cpnReserve('WELCOME1', { id: 'po_' + i, phone: '', at: '2026-11-28T10:00:00Z', br: 'b' + i }, { maxUses: 1 }))));
  assert.equal(rs.filter(r => r.ok).length, 1, JSON.stringify(rs.map(r => r.why || 'ok')));
  rs.filter(r => !r.ok).forEach(r => assert.match(r.why, /استُنفد|ازدحام/));
  assert.equal(cl.peek(LOY).cpn.welcome1.length, 1, 'استخدام واحد مسجّل');
  assert.ok(cl.stats().conflicts > 0, 'حدث تعارض فعلًا');
});

test('الكوبون بحد 3 وحد عميل 1: عشرة أجهزة متزامنة ⇒ لا يتجاوز 3 والمسجّل = المقبول، و«استُنفد» بعد 3 فقط؛ وعميل واحد من جهازين ⇒ مرة واحدة', async () => {
  const C = await cpnEngine(); let cl = globalThis.__H_CLOUD__ = fakeCloud({ [LOY]: { members: {}, tx: [] } });
  let rs = await Promise.all(Array.from({ length: 10 }, (_, i) => onDev('d' + i, () => C.cpnReserve('Promo3', { id: 'o' + i, phone: '50000000' + i, at: 'T', br: 'b1' }, { maxUses: 3 }))));
  const okN = rs.filter(r => r.ok).length, crowd = rs.filter(r => /ازدحام/.test(r.why || '')).length, gone = rs.filter(r => /استُنفد/.test(r.why || '')).length;
  assert.equal(okN + crowd + gone, 10, JSON.stringify(rs.map(r => r.why || 'ok')));
  assert.ok(okN <= 3, 'لا يتجاوز الحد'); if (gone) assert.equal(okN, 3, '«استُنفد» لا يظهر إلا بعد 3 استخدامات فعلًا');
  assert.ok(okN + crowd >= 3, 'ما دون الحد يُرفض بالازدحام (أعد المحاولة) لا بالاستنفاد');
  assert.equal(cl.peek(LOY).cpn.promo3.filter(u => !u.rel).length, okN, 'المسجّل = المقبول');
  cl = globalThis.__H_CLOUD__ = fakeCloud({ [LOY]: { members: {}, tx: [] } });
  rs = await Promise.all(['x', 'y'].map(d => onDev(d, () => C.cpnReserve('ONCE', { id: 'o' + d, phone: '500000009', at: 'T', br: 'b1' }, { perCust: 1 }))));
  assert.equal(rs.filter(r => r.ok).length, 1); assert.match(rs.find(r => !r.ok).why, /استخدمه هذا العميل/);
});

test('الكوبون: إعادة إرسال الطلب نفسه من جهازين (مفتاح عدم التكرار) ⇒ حجز واحد؛ والتحرير يعيد الاستخدام المتاح؛ ودون اتصال يُرفض', async () => {
  const C = await cpnEngine(); const cl = globalThis.__H_CLOUD__ = fakeCloud({ [LOY]: { members: {}, tx: [] } });
  const use = { id: 'po_same', phone: '', at: 'T', br: 'b1' };
  const rs = await Promise.all(['a', 'b', 'c'].map(d => onDev(d, () => C.cpnReserve('ONE', use, { maxUses: 1 }))));
  assert.ok(rs.every(r => r.ok), JSON.stringify(rs.map(r => r.why || 'ok'))); assert.equal(cl.peek(LOY).cpn.one.length, 1, 'الطلب نفسه لا يُحجز مرتين');
  assert.equal(await onDev('a', () => C.cpnRelease('ONE', 'po_same', 'إلغاء')), true);
  assert.ok(cl.peek(LOY).cpn.one[0].rel, 'محرَّر بتاريخ');
  const again = await onDev('b', () => C.cpnReserve('ONE', { id: 'po_next', phone: '', at: 'T', br: 'b1' }, { maxUses: 1 })); assert.equal(again.ok, true, 'بعد التحرير يُتاح');
  const off = await onDev('z', () => C.cpnReserve('NEW', { id: 'po_off', phone: '', at: 'T', br: 'b1' }, { maxUses: 1 }), { offline: true });
  assert.deepEqual([off.ok, /دون اتصال/.test(off.why)], [false, true]);
  delete globalThis.__H_CLOUD__;
});
