/**
 * v56.54 — نقطة البيع، المرحلة 5ب (docs/pos/POS_OFFLINE_SW.md):
 *   (1) نوع حد المرتجع دون اتصال (قرار المالك: «اترك خيار لتحديد حد المرتجع») — مجموع/لكل مرتجع، وفترة المجموع بلا/يوم/وردية.
 *   (2) فتح التطبيق دون إنترنت: منطق عامل الخدمة public/pos-sw.js (يُحمَّل الملف المنشور نفسه في vm)، وسكربت الشفاء في index.html، وposSwSync.
 *   (3) سجل الأجهزة على الخادم /api/pos/device-register بأرقام فريدة لكل فرع (معاملة)، واختيار وسم الجهاز.
 * لا اعتماديات جديدة. الأرقام وهمية: حد الفرع b1 = 100.00؛ مرتجعات غير مراجَعة 25.00 (أمس، وردية s0) + 35.00 (اليوم، وردية s1) = 60.00.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildEngine } from './build-engine.mjs';
import { devRegInput, devRegDecide, devTagOf, mountPosDevices, DEV_CAP } from '../server-posdev.js';
import { loadTenants } from '../tenants.js';

let E;
before(async () => { E = await buildEngine(); });

const D0 = '2026-03-09', D1 = '2026-03-10';
const ret = (id, total, x = {}) => ({ id, kind: 'return', offline: true, branchId: 'b1', total: -total, date: D1, ...x });
const orders = () => [ret('r1', 25, { date: D0, shiftId: 's0' }), ret('r2', 35, { shiftId: 's1' }), ret('rx', 500, { branchId: 'b2' }), { id: 'o1', kind: 'sale', branchId: 'b1', total: 999 }];
const org = (x = {}) => ({ posCfg: { offRetLimit: { b1: 100 }, ...x } });

test('(1) بلا الإعداد الجديد: posOffRetCheck كما في v56.53 حرفيًا (النتيجة والرسالة)، والسياق الجديد لا يغيّر شيئًا', () => {
  for (const ctx of [undefined, { date: D1, shiftId: 's1' }]) {
    assert.deepEqual(E.posOffRetCheck(org(), orders(), [], 'b1', 40, ctx), { ok: true, lim: 100, used: 60, left: 0 });
    const over = E.posOffRetCheck(org(), orders(), [], 'b1', 40.01, ctx);
    assert.deepEqual(Object.keys(over).sort(), ['err', 'lim', 'used']);
    assert.equal(over.err, 'يتجاوز حد المرتجع دون اتصال لهذا الفرع (100.00) — غير المراجَع 60.00؛ انتظر عودة الاتصال');
    assert.match(E.posOffRetCheck({}, orders(), [], 'b1', 1, ctx).err, /غير مسموح/);
  }
  assert.deepEqual(E.posOffRetRule(org(), 'b1'), { lim: 100, mode: 'total', period: 'none' });
  // قيم غير معروفة ⇒ الافتراضي
  assert.deepEqual(E.posOffRetRule(org({ offRetMode: { b1: 'x' }, offRetPeriod: { b1: 'week' } }), 'b1'), { lim: 100, mode: 'total', period: 'none' });
  assert.deepEqual(E.posOffRetCheck(org({ offRetMode: { b1: 'x' }, offRetPeriod: { b1: 'week' } }), orders(), [], 'b1', 40, { date: D1 }), { ok: true, lim: 100, used: 60, left: 0 });
  // المراجَع لا يُحتسب (كما كان)
  assert.deepEqual(E.posOffRetCheck(org(), orders(), [{ retId: 'r2' }], 'b1', 75), { ok: true, lim: 100, used: 25, left: 0 });
});

test('(1) «لكل مرتجع وحده»: كل مرتجع حتى الحد بلا مجموع؛ الحد صفر ما زال ممنوعًا، والفترة تُتجاهل', () => {
  const o = org({ offRetMode: { b1: 'each' }, offRetPeriod: { b1: 'day' } });
  assert.deepEqual(E.posOffRetRule(o, 'b1'), { lim: 100, mode: 'each', period: 'none' });
  assert.deepEqual(E.posOffRetCheck(o, orders(), [], 'b1', 100, { date: D1 }), { ok: true, lim: 100, used: 0, left: 0, mode: 'each' }, 'غير المراجَع 60 لا يُحتسب');
  assert.equal(E.posOffRetCheck(o, orders(), [], 'b1', 100.01).err, 'يتجاوز حد المرتجع الواحد دون اتصال لهذا الفرع (100.00)؛ انتظر عودة الاتصال');
  assert.match(E.posOffRetCheck({ posCfg: { offRetMode: { b1: 'each' } } }, orders(), [], 'b1', 1).err, /غير مسموح/);
  assert.match(E.posOffRetCheck(o, orders(), [], 'b1', 0).err, /غير صحيح/);
  assert.equal(E.posOffRetRule(o, 'b2').mode, 'total', 'لكل فرع');
});

test('(1) المجموع لكل يوم عمل أو لكل وردية؛ الوردية غير المعروفة ⇒ كل غير المراجَع (الأشد)', () => {
  const day = org({ offRetPeriod: { b1: 'day' } });
  assert.deepEqual(E.posOffRetCheck(day, orders(), [], 'b1', 65, { date: D1 }), { ok: true, lim: 100, used: 35, left: 0, period: 'day' }, 'مرتجع الأمس خارج اليوم');
  assert.equal(E.posOffRetCheck(day, orders(), [], 'b1', 65.01, { date: D1 }).err, 'يتجاوز حد المرتجع دون اتصال لهذا الفرع لهذا اليوم (100.00) — غير المراجَع 35.00؛ انتظر عودة الاتصال');
  assert.deepEqual(E.posOffRetCheck(day, orders(), [], 'b1', 100, { date: '2026-03-11' }), { ok: true, lim: 100, used: 0, left: 0, period: 'day' });
  const sh = org({ offRetPeriod: { b1: 'shift' } });
  assert.deepEqual(E.posOffRetCheck(sh, orders(), [], 'b1', 75, { date: D1, shiftId: 's0' }), { ok: true, lim: 100, used: 25, left: 0, period: 'shift' });
  assert.deepEqual(E.posOffRetCheck(sh, orders(), [], 'b1', 100, { date: D1, shiftId: 's9' }), { ok: true, lim: 100, used: 0, left: 0, period: 'shift' });
  // بلا وردية (رد بغير النقد دون وردية مفتوحة) ⇒ مجموع كل غير المراجَع
  assert.deepEqual(E.posOffRetCheck(sh, orders(), [], 'b1', 40, { date: D1, shiftId: '' }), { ok: true, lim: 100, used: 60, left: 0, period: 'none' });
  assert.match(E.posOffRetCheck(sh, orders(), [], 'b1', 40.01, { date: D1 }).err, /لهذا الفرع \(100\.00\) — غير المراجَع 60\.00/);
  assert.deepEqual(E.posOffRetCheck(day, orders(), [], 'b1', 40, {}).used, 60, 'بلا تاريخ ⇒ الأشد');
});

/* ---------------- (3) سجل الأجهزة: وسم الجهاز على الكاشير ---------------- */
const mkLs = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };

test('(3) اختيار وسم الجهاز: بلا رقم خادم ⇒ المحلي؛ لا يتبدّل أثناء وردية مفتوحة؛ مع التفعيل رقم الخادم؛ بعد الإيقاف لإكمال ورديته فقط', () => {
  const P = E.posDevTagPick;
  assert.equal(P({ local: 'AB12', srv: '', on: true }), 'AB12');
  assert.equal(P({ local: 'AB12', srv: 'bad', on: true }), 'AB12', 'رقم غير صالح يُتجاهل');
  assert.equal(P({ local: 'AB12', srv: 'D0003', on: true }), 'D0003');
  assert.equal(P({ local: 'AB12', srv: 'D0003', on: true, openLocal: true }), 'AB12', 'الوردية المفتوحة تُغلق بوسمها');
  assert.equal(P({ local: 'AB12', srv: 'D0003', on: false }), 'AB12', 'الإيقاف ⇒ كما كان');
  assert.equal(P({ local: 'AB12', srv: 'D0003', on: false, openSrv: true }), 'D0003', 'وردية برقم الخادم تُكمل بعد الإيقاف');
  assert.equal(E.posDevRegOn({ posCfg: {} }), false); assert.equal(E.posDevRegOn({ posCfg: { devReg: true } }), true);
  // الحفظ مرة واحدة: لا يُستبدل رقم محفوظ صالح
  const ls = mkLs();
  assert.deepEqual(E.posDevNoGet(ls), {});
  let m = E.posDevNoSet('b1', 'D0002', ls, 'T1'); assert.deepEqual(m, { b1: { tag: 'D0002', at: 'T1' } });
  m = E.posDevNoSet('b1', 'D0009', ls, 'T2'); assert.equal(E.posDevSrvTag(m, 'b1'), 'D0002');
  assert.equal(E.posDevSrvTag(E.posDevNoSet('b2', 'X1', ls), 'b2'), '', 'وسم ليس من الخادم لا يُحفظ');
  assert.equal(E.posDevSrvTag(E.posDevNoGet(ls), 'b1'), 'D0002');
  ls.setItem(E.POS_DEVNO_KEY, '[1,2]'); assert.deepEqual(E.posDevNoGet(ls), {});
  // مفتاح الجهاز: يُنشأ مرة ويبقى
  const ls2 = mkLs(); const k = E.posDevKey(ls2); assert.match(k, /^[A-Za-z0-9]{22}$/); assert.equal(E.posDevKey(ls2), k);
  // الوسم من الخادم لا يتصادم مع المحلي (2 أو 4 خانات) ويطابق نمط الترقيم
  assert.ok(E.POS_SRV_TAG.test(devTagOf(1)) && devTagOf(1).length === 5);
  assert.match('ف1-260310-' + devTagOf(12) + '-0001', /^(.)\d+-(\d{6})-([A-Z0-9]+)-(\d+)$/);
});

test('(3) الترقيم برقم الخادم: سلسلة البصمات والتسلسل اليومي المحلي (لكل فرع ويوم) يستمران فلا يرجع رقم، والفواتير القديمة كما هي', () => {
  const old = [{ id: 'a', branchId: 'b1', dev: 'AB12', no: 'ف1-260310-AB12-0004', date: D1, icv: 4, hash: 'h4' }];
  assert.deepEqual(E.posNextNo(4, { icv: 4, hash: 'h4' }, old, 'b1', 'D0001', D1, 'ف'), { seq: 5, prev: { icv: 4, hash: 'h4' } }, 'ف1-260310-D0001-0005 بعد ف1-260310-AB12-0004');
  assert.deepEqual(E.posNextNo(0, null, old, 'b1', 'D0001', D1, 'ف'), { seq: 1, prev: { icv: 0, hash: '0' } }, 'بعد مسح التخزين: وسم جديد ⇒ سلسلة جديدة له (posChainGaps لا يفحص أول حلقة)');
  assert.deepEqual(E.posNextNo(4, { icv: 4, hash: 'h4' }, old, 'b1', 'AB12', D1, 'ف'), { seq: 5, prev: { icv: 4, hash: 'h4' } }, 'بلا رقم خادم كما كان');
});

/* ---------------- (3) الخادم: /api/pos/device-register ---------------- */
test('(3) الخادم — التحقق من المدخل والقرار النقي: الجهاز نفسه رقمه نفسه، والأرقام لا تتكرر ولا تُعاد، وسقف الأجهزة', () => {
  const K = 'k'.repeat(22);
  assert.ok(devRegInput({ branchId: 'b1', devKey: K }).v);
  assert.deepEqual(devRegInput({ branchId: 'b1', devKey: K, localTag: 'AB12', name: ' كاشير <1> ' }).v, { branchId: 'b1', devKey: K, localTag: 'AB12', name: 'كاشير 1' });
  for (const bad of [{ x: 1 }, { branchId: 'a/b' }, { devKey: 'short' }, { devKey: 5 }, { localTag: 'ab' }, { name: 'x'.repeat(41) }]) assert.ok(devRegInput({ branchId: 'b1', devKey: K, ...bad }).err, JSON.stringify(bad));
  assert.ok(devRegInput([]).err);
  let d = devRegDecide({ devs: [], next: undefined, devKey: 'A', by: 'c@t', now: 0 }); assert.deepEqual([d.ok, d.again, d.tag, d.next], [true, false, 'D0001', 2]);
  d = devRegDecide({ devs: d.devs, next: d.next, devKey: 'B', now: 0 }); assert.equal(d.tag, 'D0002');
  const again = devRegDecide({ devs: d.devs, next: d.next, devKey: 'A' }); assert.deepEqual([again.again, again.tag, again.next], [true, 'D0001', 3]);
  // عدّاد ناقص أو تالف لا يعيد رقمًا مستخدمًا
  assert.equal(devRegDecide({ devs: d.devs, next: 1, devKey: 'C' }).tag, 'D0003');
  const full = Array.from({ length: DEV_CAP }, (_, i) => ({ k: 'k' + i, tag: devTagOf(i + 1) }));
  assert.match(devRegDecide({ devs: full, next: DEV_CAP + 1, devKey: 'new' }).why, /الحد الأعلى/);
  assert.equal(devRegDecide({ devs: full, next: DEV_CAP + 1, devKey: 'k5' }).tag, 'D0006', 'المسجّل سابقًا يأخذ رقمه حتى مع السقف');
});

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@test-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'test-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'test-prod', FIREBASE_SERVICE_ACCOUNT: SA };
function harness({ env = ENV, orgV = { posCfg: { devReg: true, branches: ['b1', 'b2'] } } } = {}) {
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) }; let orgLoads = 0;
  const users = { cash: { email: 'c@test.sa', role: 'cashier', tenant: 'default' }, other: { email: 'o@test.sa', role: 'cashier', tenant: 'default' }, view: { email: 'v@test.sa', role: 'accountant_view', tenant: 'default' }, off: { email: 'x@test.sa', role: 'cashier', tenant: 'default' }, kash: { email: 'k@test.sa', role: 'cashier', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({ error: 'يلزم تسجيل الدخول' }); req.user = u; next(); };
  const F = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(x => ({ stringValue: x })) } } : { stringValue: String(v) }])) });
  const db = { 'members/c@test.sa': { ...F({ active: true, branchId: 'b1', role: 'branch_manager' }), v: 1 }, 'members/o@test.sa': { ...F({ active: true, branchId: 'b2', role: 'branch_manager' }), v: 1 },
    'members/k@test.sa': { ...F({ active: true, branchId: 'b1', role: 'cashier' }), v: 1 },
    'members/v@test.sa': { ...F({ active: true, scope: 'all', role: 'accountant_view' }), v: 1 }, 'members/x@test.sa': { ...F({ active: false, branchId: 'b1', role: 'cashier' }), v: 1 }, 'platform/admins': { ...F({ emails: [] }), v: 1 } };
  const txReads = {}; let txn = 0; let commits = 0;
  const fetchImpl = async (u, i = {}) => {
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':beginTransaction')) { const t = 'TX' + (++txn); txReads[t] = {}; return ok({ transaction: t }); }
    if (u.endsWith(':rollback')) return ok({});
    if (u.endsWith(':commit')) { const b = JSON.parse(i.body); const R = txReads[b.transaction] || {};
      if (Object.entries(R).some(([k, v]) => ((db[k] || {}).v || 0) !== v)) return { ok: false, status: 409, json: async () => ({ error: { status: 'ABORTED' } }) };
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1]; if (w.currentDocument && w.currentDocument.exists === false && db[k]) return { ok: false, status: 409, json: async () => ({ error: { status: 'ALREADY_EXISTS' } }) }; }
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1]; db[k] = { fields: { ...w.update.fields, ...(w.updateTransforms ? { updatedAt: { timestampValue: 'NOW' } } : {}) }, v: ((db[k] || {}).v || 0) + 1 }; } commits++; return ok({}); }
    const [p0, qs] = (u.split('/documents/')[1] || '').split('?'); const k = decodeURIComponent(p0);
    const tx = qs && /transaction=([^&]+)/.exec(qs); if (tx) { txReads[decodeURIComponent(tx[1])][k] = (db[k] || {}).v || 0; await new Promise(r => setTimeout(r, 5)); }
    return db[k] ? ok(db[k]) : { ok: false, status: 404, json: async () => ({}) };
  };
  mountPosDevices(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), fetchImpl, log: { log() {}, error() {} }, orgLoader: async () => { orgLoads++; return orgV; }, now: () => Date.parse('2026-03-10T10:00:00Z') });
  const call = async (who, body) => { const req = { who, body }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes['/api/pos/device-register']) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, db, commits: () => commits, orgLoads: () => orgLoads };
}
const KA = 'devA'.repeat(5), KB = 'devB'.repeat(5);
const body = (x = {}) => ({ branchId: 'b1', devKey: KA, localTag: 'AB12', name: 'كاشير 1', ...x });

test('(3) المسار: 401 بلا هوية، 400 لمدخل خاطئ، 403 لغير عضو الفرع وللعرض فقط وللمعطّل، 409 والمفتاح مطفأ أو الفرع غير مفعّل، 200 برقم فريد وعدم تكرار', async () => {
  const H = harness();
  assert.equal((await H.call('nobody', body())).status, 401);
  assert.equal((await H.call('cash', body({ devKey: 'x' }))).status, 400);
  assert.equal((await H.call('cash', body({ extra: 1 }))).status, 400);
  assert.equal((await H.call('other', body())).status, 403, 'عضو فرع آخر');
  assert.equal((await H.call('view', body())).status, 403, 'العرض فقط');
  assert.equal((await H.call('off', body())).status, 403, 'عضو معطّل');
  assert.equal((await H.call('kash', body())).status, 403, 'قرار المالك: مدير الفرع فقط — الكاشير لا يطلب رقم الجهاز');
  let r = await H.call('cash', body()); assert.equal(r.status, 200); assert.deepEqual(r.json, { ok: true, tag: 'D0001', again: false });
  r = await H.call('cash', body()); assert.deepEqual(r.json, { ok: true, tag: 'D0001', again: true }, 'الجهاز نفسه رقمه نفسه');
  r = await H.call('cash', body({ devKey: KB })); assert.equal(r.json.tag, 'D0002');
  r = await H.call('other', body({ branchId: 'b2', devKey: KB })); assert.equal(r.json.tag, 'D0001', 'الترقيم لكل فرع');
  const doc = H.db['pos_devices/b1']; assert.equal(doc.fields.next.integerValue, '3'); assert.equal(doc.fields.updatedAt.timestampValue, 'NOW');
  const devs = JSON.parse(doc.fields.devs.stringValue); assert.deepEqual(devs.map(d => [d.tag, d.by, d.local, d.name]), [['D0001', 'c@test.sa', 'AB12', 'كاشير 1'], ['D0002', 'c@test.sa', 'AB12', 'كاشير 1']]);
  assert.equal(H.commits(), 3, 'لا كتابة عند التكرار');
  assert.equal((await harness({ orgV: { posCfg: { branches: ['b1'] } } }).call('cash', body())).status, 409, 'المفتاح مطفأ');
  assert.equal((await harness({ orgV: { posCfg: { devReg: true, branches: ['b2'] } } }).call('cash', body())).status, 409, 'الفرع غير مفعّل');
  assert.equal((await harness({ orgV: {} }).call('cash', body())).status, 409);
  assert.equal((await harness({ env: { FIREBASE_API_KEY: ENV.FIREBASE_API_KEY, FIREBASE_PROJECT_ID: 'test-prod' } }).call('cash', body())).status, 409, 'بلا حساب خدمة');
});

test('(3) المسار: طلبات متزامنة من أجهزة مختلفة لا تأخذ الرقم نفسه (المعاملة تُعاد عند التعارض)', async () => {
  const H = harness(); const keys = ['dev1', 'dev2', 'dev3', 'dev4'].map(k => k.repeat(5));
  const rs = await Promise.all(keys.map(k => H.call('cash', body({ devKey: k }))));
  assert.deepEqual(rs.map(r => r.status), [200, 200, 200, 200]);
  assert.deepEqual(rs.map(r => r.json.tag).sort(), ['D0001', 'D0002', 'D0003', 'D0004']);
  assert.equal(JSON.parse(H.db['pos_devices/b1'].fields.devs.stringValue).length, 4);
  const again = await Promise.all([H.call('cash', body({ devKey: keys[0] })), H.call('cash', body({ devKey: keys[0] }))]);
  assert.deepEqual(again.map(r => r.json.tag), [rs[0].json.tag, rs[0].json.tag]);
});

/* ---------------- (2) عامل الخدمة public/pos-sw.js (الملف نفسه في vm) ---------------- */
function loadSw(ver = 'v56.54', opt = {}) {
  const L = {}; const store = new Map();   // name -> Map(key -> res)
  const keyOf = (r) => typeof r === 'string' ? r : r.url;
  const caches = { keys: async () => [...store.keys()], delete: async (k) => store.delete(k),
    open: async (n) => { if (!store.has(n)) store.set(n, new Map()); const m = store.get(n); return { match: async (r) => m.get(keyOf(r)), put: async (r, v) => { m.set(keyOf(r), v); } }; } };
  const res = (body, x = {}) => ({ ok: true, status: 200, type: 'basic', body, clone() { return res(body, x); }, ...x });
  const self = { location: { href: 'https://pos.example/pos-sw.js?v=' + ver }, registration: { scope: 'https://pos.example/' }, navigator: { onLine: true }, clients: { claim: async () => { L.claimed = true; } },
    skipWaiting() {}, addEventListener: (t, f) => { L[t] = f; } };
  const ctx = { self, caches, URL, setTimeout: opt.setTimeout || setTimeout, clearTimeout: opt.setTimeout ? () => { } : clearTimeout, Promise, fetch: async (r) => opt.fetch(r) };
  vm.runInNewContext(fs.readFileSync(new URL('../public/pos-sw.js', import.meta.url), 'utf8'), ctx);
  const fire = async (type, data) => { let p = null; const ev = { request: data, data, waitUntil: (x) => { p = x; }, respondWith: (x) => { p = x; ev.responded = true; } }; L[type](ev); return { ev, out: p ? await p : undefined }; };
  return { self, store, fire, res };
}

test('(2) عامل الخدمة: اختيار الاستراتيجية حسب الرابط — لا يُخزَّن أي طلب بيانات', () => {
  const { self } = loadSw(); const R = (url, x = {}) => self.posSwRoute({ url, method: 'GET', mode: 'cors', ...x }, 'https://pos.example', '/');
  assert.equal(R('https://pos.example/', { mode: 'navigate' }), 'shell');
  assert.equal(R('https://pos.example/?u=123&t=x', { mode: 'navigate' }), 'shell');
  assert.equal(R('https://pos.example/index.html', { mode: 'navigate' }), 'shell');
  assert.equal(R('https://pos.example/some/deep', { mode: 'navigate' }), 'pass');
  assert.equal(R('https://pos.example/assets/index-AbC123xy.js'), 'asset');
  assert.equal(R('https://pos.example/assets/mod-pos-Zz9_8-7q.css'), 'asset');
  assert.equal(R('https://pos.example/assets/plain.js'), 'pass', 'بلا بصمة في الاسم');
  assert.equal(R('https://pos.example/?_c=1712'), 'pass', 'فحص النسخة الجديدة يذهب للشبكة دائمًا');
  assert.equal(R('https://pos.example/api/pos/credit-auth', { method: 'POST' }), 'pass');
  assert.equal(R('https://pos.example/api/ai/analyze', { mode: 'navigate' }), 'pass');
  assert.equal(R('https://pos.example/tenants/x.json'), 'pass');
  assert.equal(R('https://pos.example/pos-sw.js'), 'pass');
  assert.equal(R('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/x'), 'pass');
  assert.equal(R('https://fonts.gstatic.com/s/ibm/x-AbC123xy.woff2'), 'pass', 'خارجي');
  assert.equal(R('https://pos.example/assets/index-AbC123xy.js', { method: 'POST' }), 'pass');
  assert.equal(self.posShellKey('https://pos.example/?u=1#x'), 'https://pos.example/');
});

test('(2) عامل الخدمة: الصفحة الشبكة أولًا (تُحدَّث في الكاش) والمخزّن عند الانقطاع فقط، والأصول الكاش أولًا، والتفعيل يحذف كاش الإصدار القديم', async () => {
  let net = 'ok'; const hits = [];
  const S = loadSw('v56.54', { fetch: async (r) => { hits.push(r.url || r); if (net === 'down') throw new TypeError('Failed to fetch'); return S.res('NET:' + (r.url || r)); } });
  S.store.set('muktasab-pos-shell-v56.53', new Map()); S.store.set('other-cache', new Map());
  await S.fire('activate');
  assert.deepEqual([...S.store.keys()], ['other-cache'], 'القديم حُذف؛ غير كاشنا لا يُلمس (مسحه للشفاء العام)');
  const nav = (u) => ({ url: u, method: 'GET', mode: 'navigate' });
  let { out } = await S.fire('fetch', nav('https://pos.example/?u=1'));
  assert.equal(out.body, 'NET:https://pos.example/?u=1'); await new Promise(r => setTimeout(r, 5));
  assert.equal(S.store.get('muktasab-pos-shell-v56.54').get('https://pos.example/').body, 'NET:https://pos.example/?u=1');
  net = 'down'; ({ out } = await S.fire('fetch', nav('https://pos.example/')));
  assert.equal(out.body, 'NET:https://pos.example/?u=1', 'دون شبكة ⇒ المخزّن');
  net = 'ok'; ({ out } = await S.fire('fetch', nav('https://pos.example/')));
  assert.equal(out.body, 'NET:https://pos.example/', 'عاد الاتصال ⇒ الأحدث من الشبكة لا المخزّن');
  const a = { url: 'https://pos.example/assets/index-AbC123xy.js', method: 'GET', mode: 'cors' };
  ({ out } = await S.fire('fetch', a)); assert.equal(out.body, 'NET:' + a.url); await new Promise(r => setTimeout(r, 5));
  net = 'down'; const n0 = hits.length; ({ out } = await S.fire('fetch', a)); assert.equal(out.body, 'NET:' + a.url); assert.equal(hits.length, n0, 'من الكاش بلا شبكة');
  const api = await S.fire('fetch', { url: 'https://pos.example/api/x', method: 'POST', mode: 'cors' }); assert.equal(api.ev.responded, undefined, 'لا اعتراض');
  const fsx = await S.fire('fetch', { url: 'https://firestore.googleapis.com/v1/x', method: 'GET', mode: 'cors' }); assert.equal(fsx.ev.responded, undefined);
  // بلا نسخة مخزّنة ودون شبكة ⇒ الخطأ نفسه (لا صفحة مختلقة)
  const S2 = loadSw('v56.54', { fetch: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(S2.fire('fetch', nav('https://pos.example/')), /Failed to fetch/);
});

test('(2) عامل الخدمة: متصل وبطيء ⇒ ينتظر الشبكة (لا نسخة قديمة) حتى المهلة القصوى؛ دون شبكة ⇒ المخزّن بعد المهلة القصيرة', async () => {
  const timers = []; const fakeT = (f, ms) => { timers.push({ f, ms }); return timers.length; };
  let resolveNet; const S = loadSw('v56.54', { setTimeout: fakeT, fetch: () => new Promise(r => { resolveNet = () => r(S.res('NEW')); }) });
  const c = new Map([['https://pos.example/', S.res('OLD')]]); S.store.set('muktasab-pos-shell-v56.54', c);
  let got = null; const p = new Promise(ok => { S.fire('fetch', { url: 'https://pos.example/', method: 'GET', mode: 'navigate' }).then(x => { got = x.out; ok(); }); });
  await new Promise(r => setImmediate(r));
  timers.find(t => t.ms === 3000).f(); await new Promise(r => setTimeout(r, 5));
  assert.equal(got, null, 'متصل (onLine) ⇒ لا رجوع للمخزّن بعد 3 ث');
  resolveNet(); await p; assert.equal(got.body, 'NEW');
  // دون شبكة ظاهرًا
  let got2 = null; const S3 = loadSw('v56.54', { setTimeout: fakeT, fetch: () => new Promise(() => { }) }); S3.self.navigator.onLine = false;
  S3.store.set('muktasab-pos-shell-v56.54', new Map([['https://pos.example/', S3.res('OLD')]]));
  timers.length = 0; S3.fire('fetch', { url: 'https://pos.example/', method: 'GET', mode: 'navigate' }).then(x => { got2 = x.out; });
  await new Promise(r => setImmediate(r)); timers.find(t => t.ms === 3000).f(); await new Promise(r => setTimeout(r, 5));
  assert.equal(got2.body, 'OLD');
});

test('(2) التسخين: الصفحة والأصول المجزّأة المحمّلة فقط (لا بيانات ولا خارجي)', async () => {
  const S = loadSw('v56.54', { fetch: async (u) => S.res('W:' + u) });
  const list = E.posSwWarmList('/', [{ name: 'https://pos.example/assets/index-AbC123xy.js' }, { name: 'https://pos.example/assets/core-Q1w2E3r4.css' }, { name: 'https://firestore.googleapis.com/x' }, { name: 'https://pos.example/tenants/a.json' }, { name: 'https://pos.example/assets/plain.js' }], 'https://pos.example');
  assert.deepEqual(list, ['/', 'https://pos.example/assets/index-AbC123xy.js', 'https://pos.example/assets/core-Q1w2E3r4.css']);
  await S.fire('message', { type: 'warm', urls: [...list, 'https://firestore.googleapis.com/x'] });
  assert.deepEqual([...S.store.get('muktasab-pos-shell-v56.54').keys()].sort(), ['https://pos.example/', 'https://pos.example/assets/core-Q1w2E3r4.css', 'https://pos.example/assets/index-AbC123xy.js']);
});

/* ---------------- (2) سكربت الشفاء الذاتي في index.html ---------------- */
async function runHeal({ flag, regs, cacheKeys }) {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => /getRegistrations/.test(s));
  const st = { unreg: [], deleted: [], reload: 0 }; const keys = [...cacheKeys];
  const reg = (url) => ({ active: { scriptURL: url }, unregister: () => { st.unreg.push(url); return Promise.resolve(true); } });
  const ls = mkLs(flag ? { 'mizan:posSwOn': '1' } : {}); const ss = mkLs();
  const win = { caches: { keys: async () => keys, delete: async (k) => { st.deleted.push(k); return true; } } };
  const ctx = { navigator: { serviceWorker: { getRegistrations: async () => regs.map(reg) } }, window: win, caches: win.caches, localStorage: ls, sessionStorage: ss, location: { reload: () => { st.reload++; } } };
  vm.runInNewContext(code, ctx); await new Promise(r => setTimeout(r, 20)); return st;
}
test('(2) سكربت الشفاء: بلا العلامة كما كان (يُزال pos-sw وكل الكاش)، ومع العلامة يُستثنى pos-sw وكاشه فقط', async () => {
  const regs = ['https://pos.example/push-sw.js', 'https://pos.example/pos-sw.js?v=v56.54', 'https://pos.example/sw.js'];
  const ck = ['muktasab-pos-shell-v56.54', 'workbox-old'];
  let st = await runHeal({ flag: false, regs, cacheKeys: ck });
  assert.deepEqual(st.unreg.sort(), ['https://pos.example/pos-sw.js?v=v56.54', 'https://pos.example/sw.js']); assert.deepEqual(st.deleted, ck); assert.equal(st.reload, 1);
  st = await runHeal({ flag: true, regs, cacheKeys: ck });
  assert.deepEqual(st.unreg, ['https://pos.example/sw.js'], 'push-sw وpos-sw يبقيان'); assert.deepEqual(st.deleted, ['workbox-old']); assert.equal(st.reload, 1);
  st = await runHeal({ flag: true, regs: ['https://pos.example/push-sw.js', 'https://pos.example/pos-sw.js?v=v56.54'], cacheKeys: ck });
  assert.deepEqual(st.unreg, []); assert.equal(st.reload, 0, 'لا إعادة تحميل حين لا عامل غريب');
  st = await runHeal({ flag: false, regs: ['https://pos.example/push-sw.js'], cacheKeys: [] });
  assert.deepEqual([st.unreg, st.reload], [[], 0], 'جهاز عادي بلا عوامل ⇒ لا شيء');
});

/* ---------------- (2) posSwSync على الصفحة ---------------- */
test('(2) posSwSync: التفعيل يضع العلامة ويسجّل pos-sw بإصداره ويرسل قائمة التسخين؛ الإيقاف يزيل العلامة ويلغيه ويمسح كاشه وحده', async () => {
  const st = { reg: [], posted: [], unreg: [], deleted: [] };
  const regs = [{ active: { scriptURL: 'https://x/push-sw.js' }, unregister: async () => st.unreg.push('push') }, { active: { scriptURL: 'https://x/pos-sw.js?v=v56.54' }, unregister: async () => st.unreg.push('pos') }];
  const worker = { postMessage: (m) => st.posted.push(m) };
  const env = { ls: mkLs(), ver: 'v56.54', url: 'pos-sw.js', scope: './', warm: () => ['/', 'https://x/assets/a-AbC123xy.js'],
    sw: { register: async (u, o) => { st.reg.push([u, o.scope]); return { active: worker }; }, ready: Promise.resolve({ active: worker }), getRegistrations: async () => regs },
    caches: { keys: async () => ['muktasab-pos-shell-v56.54', 'muktasab-pos-shell-v56.53', 'other'], delete: async (k) => st.deleted.push(k) } };
  assert.deepEqual(await E.posSwSync(true, env), { on: true });
  assert.equal(env.ls.getItem(E.POS_SW_FLAG), '1'); assert.deepEqual(st.reg, [['pos-sw.js?v=v56.54', './']]);
  assert.deepEqual(st.posted, [{ type: 'warm', urls: ['/', 'https://x/assets/a-AbC123xy.js'] }]);
  const off = await E.posSwSync(false, env);
  assert.deepEqual(off, { on: false, had: true, unreg: 1, cleared: 2 }); assert.equal(env.ls.getItem(E.POS_SW_FLAG), null);
  assert.deepEqual(st.unreg, ['pos'], 'عامل الإشعارات لا يُلمس'); assert.deepEqual(st.deleted, ['muktasab-pos-shell-v56.54', 'muktasab-pos-shell-v56.53']);
  assert.deepEqual(await E.posSwSync(true, { ls: mkLs() }), { on: false, why: 'no-sw' }, 'متصفح بلا عوامل خدمة');
  assert.equal(E.posShellOn({ posCfg: { offShell: true } }), false, 'يتطلب العمل دون اتصال'); assert.equal(E.posShellOn({ posCfg: { offline: true } }), false); assert.equal(E.posShellOn({ posCfg: { offline: true, offShell: true } }), true);
  assert.equal(E.posSwIsPos({ waiting: { scriptURL: 'https://x/pos-sw.js' } }), true); assert.equal(E.posSwIsPos({ active: { scriptURL: 'https://x/push-sw.js' } }), false);
});
