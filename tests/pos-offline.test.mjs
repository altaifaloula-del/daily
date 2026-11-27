/**
 * v56.53 — نقطة البيع، المرحلة 5أ: العمل دون اتصال (docs/pos/POS_AUDIT_REPORT.md §8، قرارا المالك 2026-11-26).
 * لا اعتماديات جديدة: IndexedDB يُحاكى هنا بمحاكاة صغيرة (open/upgrade/transaction/oncomplete) وlocalStorage بخريطة.
 * الأرقام وهمية: حد المرتجع دون اتصال للفرع b1 = 100.00 ؛ مرتجعات غير مراجَعة 25.00 + 35.00 = 60.00 ⇒ المتاح 40.00 بالضبط.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

/* ---------- محاكاة IndexedDB (الحد الأدنى الذي يستخدمه posStore) ---------- */
function fakeIdb(opt = {}) {
  const dbs = {};   // name -> { ver, stores: { name -> Map } }
  const later = (f) => setTimeout(f, 0);
  const mkDb = (rec) => ({
    objectStoreNames: { contains: (n) => !!rec.stores[n] },
    createObjectStore: (n, o) => { rec.stores[n] = new Map(); rec.keyPath = rec.keyPath || {}; rec.keyPath[n] = o.keyPath; },
    transaction(n, mode) {
      if (!rec.stores[n]) throw new Error('NotFoundError');
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      const reqs = []; const work = new Map(rec.stores[n]);
      const req = (fn) => { const r = { onsuccess: null, onerror: null, result: undefined }; reqs.push(() => { r.result = fn(); r.onsuccess && r.onsuccess(); }); return r; };
      const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
      tx.objectStore = () => ({
        get: (k) => req(() => clone(work.get(k))),
        getAll: () => req(() => [...work.values()].map(clone)),
        put: (v) => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); return req(() => { if (opt.failPut && opt.failPut(v)) throw new Error('QuotaExceededError'); work.set(v[rec.keyPath[n]], clone(v)); return v[rec.keyPath[n]]; }); },
        delete: (k) => { if (mode !== 'readwrite') throw new Error('ReadOnlyError'); return req(() => { work.delete(k); }); },
      });
      later(() => { try { reqs.forEach(f => f()); rec.stores[n] = work; tx.oncomplete && tx.oncomplete(); } catch (e) { tx.error = e; tx.onabort && tx.onabort(); } });   // ذرّية: تُطبَّق كلها أو لا شيء
      return tx;
    },
  });
  return {
    _dbs: dbs,
    open(name, ver) {
      if (opt.privateMode) throw new Error('SecurityError');
      const r = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: null };
      later(() => { let rec = dbs[name]; const up = !rec || rec.ver < ver; if (!rec) rec = dbs[name] = { ver, stores: {} }; rec.ver = ver;
        r.result = mkDb(rec); if (up && r.onupgradeneeded) r.onupgradeneeded(); r.onsuccess && r.onsuccess(); });
      return r;
    },
  };
}
function fakeLs(opt = {}) { const m = new Map();
  return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (opt.full) throw new Error('QuotaExceededError'); m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
/** الطابور القديم على localStorage وهمي — نفس المفاتيح الحالية */
function legacyOf(ls) { const K = { order: 'mizan:posQueue', shift: 'mizan:posShiftClose', loy: 'mizan:posLoyQ' };
  return { read: () => Object.fromEntries(Object.entries(K).map(([k, key]) => [k, JSON.parse(ls.getItem(key) || '[]')])),
    write: (kind, a) => { if (a.length || kind !== 'shift') ls.setItem(K[kind], JSON.stringify(a)); else ls.removeItem(K[kind]); } }; }

const ord = (id, at, x = {}) => ({ id, at, no: 'ف1-' + id, branchId: 'b1', kind: 'sale', total: 23, status: 'paid', ...x });

test('posOffOn: معطّل افتراضيًا (بلا الحقل أو false)، ومفعّل بالصريح فقط', () => {
  assert.equal(E.posOffOn({}), false); assert.equal(E.posOffOn({ posCfg: {} }), false); assert.equal(E.posOffOn({ posCfg: { offline: false } }), false);
  assert.equal(E.posOffOn({ posCfg: { offline: true } }), true);
});

test('posStore على IndexedDB: put/get/list/del ويبقى بعد إعادة الفتح، والمخزنان outbox وsynclog', async () => {
  const idb = fakeIdb(); const s = await E.posStoreOpen({ idb, ls: fakeLs() });
  assert.equal(s.mode, 'idb');
  await s.put('outbox', E.posObItem('order', ord('a', '2026-11-20T10:00:00Z')));
  assert.equal((await s.get('outbox', 'order:a')).data.no, 'ف1-a');
  const s2 = await E.posStoreOpen({ idb, ls: fakeLs() });   // إعادة فتح (إغلاق المتصفح)
  assert.deepEqual((await s2.list('outbox')).map(x => x.key), ['order:a']);
  assert.deepEqual(await s2.list('synclog'), []);
  await s2.del('outbox', 'order:a'); assert.deepEqual(await s2.list('outbox'), []);
  assert.deepEqual(Object.keys(idb._dbs), ['muktasab-pos']); assert.deepEqual(Object.keys(idb._dbs['muktasab-pos'].stores).sort(), ['outbox', 'synclog']);
});

test('posStore: الرجوع تلقائيًا إلى localStorage في المتصفح الخاص، ثم إلى الذاكرة إن امتلأ localStorage', async () => {
  const ls = fakeLs(); const s = await E.posStoreOpen({ idb: fakeIdb({ privateMode: true }), ls });
  assert.equal(s.mode, 'ls');
  await s.put('outbox', E.posObItem('loy', { id: 'po1:e', at: '2026-11-20T10:00:00Z', pts: 3 }));
  assert.ok(ls.getItem('mizan:posOb:outbox').includes('po1:e'));
  assert.equal((await s.list('outbox')).length, 1);
  await s.del('outbox', 'loy:po1:e'); assert.equal(ls.getItem('mizan:posOb:outbox'), null);
  assert.equal((await E.posStoreOpen({ idb: null, ls })).mode, 'ls', 'بلا IndexedDB أصلًا');
  assert.equal((await E.posStoreOpen({ idb: null, ls: fakeLs({ full: true }) })).mode, 'mem');
});

test('الترحيل الآمن: كل ما في الطابور القديم يصل الصادر مرة واحدة (المعرّف مفتاح) ثم يُزال من القديم', async () => {
  const ls = fakeLs(), L = legacyOf(ls);
  L.write('order', [ord('o1', '2026-11-20T10:00:00Z'), ord('o2', '2026-11-20T10:05:00Z')]);
  L.write('shift', [{ id: 'sh1', status: 'closed', closedAt: '2026-11-20T11:00:00Z', diff: 0 }]);
  L.write('loy', [{ id: 'o1:r', phone: '500000000', pts: -2, at: '2026-11-20T10:00:00Z' }, { id: 'o1:e', phone: '500000000', pts: 3, at: '2026-11-20T10:00:00Z' }]);
  const s = await E.posStoreOpen({ idb: fakeIdb(), ls });
  await s.put('outbox', E.posObItem('order', ord('o1', '2026-11-20T10:00:00Z')));   // وصل في محاولة سابقة انقطعت
  const r = await E.posObMigrate(s, L);
  assert.deepEqual(r, { moved: 4, skipped: 1, cleared: 5, ok: true });
  assert.deepEqual((await s.list('outbox')).map(x => x.key).sort(), ['loy:o1:e', 'loy:o1:r', 'order:o1', 'order:o2', 'shift:sh1']);
  assert.deepEqual(L.read(), { order: [], shift: [], loy: [] });
  assert.deepEqual(await E.posObMigrate(s, L), { moved: 0, skipped: 0, cleared: 0, ok: true }, 'إعادته لا تكرر شيئًا');
});

test('الترحيل: انقطاع في منتصفه لا يفقد شيئًا ولا يكرر عند الإعادة، وما أُضيف للقديم أثناء الترحيل يبقى فيه', async () => {
  const ls = fakeLs(), L = legacyOf(ls);
  L.write('order', [ord('o1', '2026-11-20T10:00:00Z'), ord('o2', '2026-11-20T10:01:00Z'), ord('o3', '2026-11-20T10:02:00Z')]);
  const fo = { failPut: (v) => v.key === 'order:o3' }; const idb = fakeIdb(fo); const bad = await E.posStoreOpen({ idb, ls });
  await assert.rejects(E.posObMigrate(bad, L));
  assert.equal(L.read().order.length, 3, 'القديم لم يُمس');
  assert.deepEqual((await bad.list('outbox')).map(x => x.id), ['o1', 'o2'], 'ما سبق العطل محفوظ');
  fo.failPut = null; const good = await E.posStoreOpen({ idb, ls });   // الإعادة بعد زوال العطل
  // جهاز قديم/تبويب آخر يضيف فاتورة أثناء الترحيل: القراءة الثانية ترى o4
  let n = 0; const L2 = { read: () => { const v = L.read(); if (++n === 2) { v.order.push(ord('o4', '2026-11-20T10:03:00Z')); L.write('order', v.order); } return v; }, write: L.write };
  const r = await E.posObMigrate(good, L2);
  assert.deepEqual([r.moved, r.skipped, r.ok], [1, 2, false]);
  assert.deepEqual(L.read().order.map(o => o.id), ['o4'], 'o4 يبقى في القديم حتى الترحيل التالي');
  const r2 = await E.posObMigrate(good, L);
  assert.deepEqual([r2.moved, r2.ok], [1, true]);
  assert.deepEqual((await good.list('outbox')).map(x => x.id).sort(), ['o1', 'o2', 'o3', 'o4']);
});

test('الرجوع بعد الإيقاف: ما بقي في الصادر يعود للطابور القديم بلا تكرار ولا فقد', async () => {
  const ls = fakeLs(), L = legacyOf(ls); L.write('order', [ord('o1', '2026-11-20T10:00:00Z')]);
  const s = E.posStoreMem();
  for (const [k, d] of [['order', ord('o1', '2026-11-20T10:00:00Z')], ['order', ord('o2', '2026-11-20T10:01:00Z')], ['loy', { id: 'o2:e', at: '2026-11-20T10:01:00Z', pts: 1 }], ['ticket', { id: 'k1', at: '2026-11-20T10:01:00Z' }]]) await s.put('outbox', E.posObItem(k, d));
  const r = await E.posObRestore(s, L);
  assert.deepEqual(r, { moved: 3, kept: 1, ok: false }, 'التذكرة بلا طابور قديم ⇒ تبقى');
  assert.deepEqual(L.read().order.map(o => o.id), ['o1', 'o2']); assert.deepEqual(L.read().loy.map(o => o.id), ['o2:e']);
  assert.deepEqual((await s.list('outbox')).map(x => x.key), ['ticket:k1']);
});

test('المزامنة بالترتيب: الفواتير بالترتيب الزمني ثم الورديات ثم الولاء، ودفعة واحدة لكل نوع', async () => {
  const s = E.posStoreMem();
  await s.put('outbox', E.posObItem('loy', { id: 'b:e', at: '2026-11-20T10:05:00Z', pts: 1 }));
  await s.put('outbox', E.posObItem('order', ord('b', '2026-11-20T10:05:00Z')));
  await s.put('outbox', E.posObItem('shift', { id: 'sh', closedAt: '2026-11-20T09:00:00Z' }));   // أقدم زمنيًا لكنها بعد الفواتير (اعتماد)
  await s.put('outbox', E.posObItem('order', ord('a', '2026-11-20T10:00:00Z')));
  await s.put('outbox', E.posObItem('order', ord('c', '2026-11-20T10:09:00Z')));
  const calls = []; const r = await E.posSyncRun(s, async (kind, list) => { calls.push(kind + ':' + list.map(x => x.id).join(',')); return true; }, { now: () => Date.parse('2026-11-20T12:00:00Z') });
  assert.deepEqual(calls, ['order:a,b,c', 'shift:sh', 'loy:b:e']);
  assert.deepEqual(r, { sent: 5, failed: 0, left: 0, err: '', done: ['order:a', 'order:b', 'order:c', 'shift:sh', 'loy:b:e'] });
  assert.deepEqual(await s.list('outbox'), []);
  const log = await E.posSyncLogList(s);
  assert.equal(log.length, 5); assert.ok(log.every(l => l.ok && l.at === '2026-11-20T12:00:00.000Z' && !('err' in l)));
  assert.deepEqual(log.map(l => l.kind + ':' + l.ref).reverse(), ['order:a', 'order:b', 'order:c', 'shift:sh', 'loy:b:e']);
});

test('لا حذف قبل التأكيد: أثناء الإرسال العنصر في الصادر، والإخفاق يبقيه ويوقف ما بعده ويُسجَّل', async () => {
  const s = E.posStoreMem();
  await s.put('outbox', E.posObItem('order', ord('a', '2026-11-20T10:00:00Z')));
  await s.put('outbox', E.posObItem('shift', { id: 'sh', closedAt: '2026-11-20T11:00:00Z' }));
  await s.put('outbox', E.posObItem('loy', { id: 'a:e', at: '2026-11-20T10:00:00Z' }));
  let release; const gate = new Promise(ok => { release = ok; }); let seenDuring = null;
  const run = E.posSyncRun(s, async (kind) => { if (kind === 'order') { seenDuring = (await s.list('outbox')).length; await gate; return true; } return false; });
  await new Promise(r => setTimeout(r, 5));
  assert.equal((await s.list('outbox')).length, 3, 'لم يُحذف شيء قبل التأكيد'); release();
  const r = await run;
  assert.equal(seenDuring, 3);
  assert.deepEqual([r.sent, r.failed, r.left, r.err], [1, 1, 2, 'not-confirmed']);
  const left = await s.list('outbox'); const sh = left.find(x => x.kind === 'shift'), ly = left.find(x => x.kind === 'loy');
  assert.deepEqual([sh.tries, sh.lastErr, ly.tries], [1, 'not-confirmed', 0], 'الولاء لم يُحاوَل بعد إخفاق الوردية');
  const log = await E.posSyncLogList(s);
  assert.deepEqual(log.map(l => [l.kind, l.ref, l.ok, l.err || '']).reverse(), [['order', 'a', true, ''], ['shift', 'sh', false, 'not-confirmed']]);
  // الاستثناء = إخفاق أيضًا، ورسالته منقّاة في السجل
  const r2 = await E.posSyncRun(s, async () => { throw new Error('denied for cashier@shop.test 0551234567 at https://x.test/a token AbCdEfGhIjKlMnOpQrStUvWxYz012'); });
  assert.equal(r2.sent, 0); assert.equal((await s.list('outbox')).find(x => x.kind === 'shift').tries, 2);
  const e = (await E.posSyncLogList(s))[0].err;
  assert.ok(!/@|0551234567|https?:|AbCdEf/.test(e), e); assert.match(e, /\[email\].*\[#\].*\[url\].*\[token\]/);
});

test('إعادة المحاولة بتباعد متزايد، ومنع التكرار بالمعرّف إن كُتب ثم ضاع التأكيد', async () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 10].map(E.posSyncDelay), [0, 20000, 40000, 80000, 160000, 300000, 300000, 300000]);
  const s = E.posStoreMem(); const cloud = [];
  await s.put('outbox', E.posObItem('order', ord('a', '2026-11-20T10:00:00Z')));
  await s.put('outbox', E.posObItem('order', ord('b', '2026-11-20T10:01:00Z')));
  // الإرسال يدمج بالمعرّف كما commit الحالي (have.has(o.id))
  const merge = (list) => { const have = new Set(cloud.map(o => o.id)); cloud.push(...list.filter(o => !have.has(o.id))); };
  const r1 = await E.posSyncRun(s, async (k, list) => { merge(list); return false; });   // كُتب ولم يصل التأكيد
  assert.equal(r1.failed, 2); assert.equal((await s.list('outbox')).length, 2);
  await s.put('outbox', E.posObItem('order', ord('c', '2026-11-20T10:02:00Z')));
  const r2 = await E.posSyncRun(s, async (k, list) => { merge(list); return true; });
  assert.equal(r2.sent, 3); assert.deepEqual(cloud.map(o => o.id), ['a', 'b', 'c'], 'بلا تكرار');
});

test('سجل المزامنة يُبقي آخر N فقط', async () => {
  const s = E.posStoreMem();
  for (let i = 0; i < 4; i++) await E.posSyncLog(s, [{ at: '2026-11-20T10:0' + i + ':00Z', kind: 'order', ref: 'o' + i, ok: true }], 3);
  assert.deepEqual((await E.posSyncLogList(s)).map(l => l.ref), ['o3', 'o2', 'o1']);
});

test('حد المرتجع دون اتصال لكل فرع: الافتراضي صفر = ممنوع، والحد على مجموع غير المراجَع (بالهللة)', () => {
  const ret = (id, b, total, x = {}) => ({ id, kind: 'return', branchId: b, total: -total, offline: true, by: 'خالد', ...x });
  const orders = [ret('r1', 'b1', 25), ret('r2', 'b1', 35), ret('r3', 'b1', 30), ret('r4', 'b2', 90), { ...ret('r5', 'b1', 50), offline: undefined }, ord('s1', 'x')];
  const revs = [{ id: 'v1', retId: 'r3', branchId: 'b1' }];
  assert.match(E.posOffRetCheck({}, orders, revs, 'b1', 1).err, /غير مسموح/);
  assert.match(E.posOffRetCheck({ posCfg: { offRetLimit: { b1: 0 } } }, orders, revs, 'b1', 1).err, /غير مسموح/);
  assert.equal(E.posOffRetLimit({ posCfg: { offRetLimit: { b1: '100' } } }, 'b2'), 0, 'لكل فرع');
  const org = { posCfg: { offRetLimit: { b1: 100 } } };
  assert.deepEqual(E.posOffRetPending(orders, revs, 'b1').map(o => o.id), ['r1', 'r2'], 'المراجَع والمتصل وفرع آخر خارج الحد');
  assert.deepEqual(E.posOffRetCheck(org, orders, revs, 'b1', 40), { ok: true, lim: 100, used: 60, left: 0 });
  const over = E.posOffRetCheck(org, orders, revs, 'b1', 40.01); assert.match(over.err, /يتجاوز حد المرتجع دون اتصال لهذا الفرع \(100\.00\) — غير المراجَع 60\.00/);
  assert.match(E.posOffRetCheck(org, orders, revs, 'b1', 0).err, /غير صحيح/);
});

test('مراجعة المرتجع دون اتصال: للإدارة التشغيلية، لا يعتمدها من سجّله، ومرة واحدة', () => {
  const r = { id: 'r1', kind: 'return', branchId: 'b1', no: 'م1-1', total: -25, offline: true, by: 'خالد', byId: 'u3' };
  const bm = { id: 'u3', name: 'خالد', role: 'branch_manager', branchId: 'b1' }, bm2 = { id: 'u4', name: 'سعد', role: 'branch_manager', branchId: 'b1' };
  assert.match(E.posOffRetReview({}, r, { id: 'u8', name: 'نورة', role: 'cashier' }).err, /للإدارة التشغيلية/);
  assert.match(E.posOffRetReview({}, r, bm).err, /من سجّله/);
  assert.match(E.posOffRetReview({}, { ...r, byId: undefined }, { ...bm, id: 'zz' }).err, /من سجّله/, 'بالاسم إن لم يُختم المعرّف');
  assert.match(E.posOffRetReview({}, { ...r, offline: undefined }, bm2).err, /ليس مرتجعًا دون اتصال/);
  assert.match(E.posOffRetReview({}, { ...r, pending: true }, bm2).err, /لم يصل/);
  const ok = E.posOffRetReview({}, r, bm2);
  assert.deepEqual({ ...ok.rev, id: 'x', at: 'x' }, { id: 'x', branchId: 'b1', retId: 'r1', retNo: 'م1-1', amount: 25, by: 'سعد', byId: 'u4', at: 'x' });
  assert.match(E.posOffRetReview({ posOffRevs: [ok.rev] }, r, bm2).err, /سابقًا/);
});

test('التوافق الرجعي (فحص المصدر): بلا تفعيل يبقى الطابور القديم ومفاتيحه وفاصل 20 ثانية، ولا تسجيل لعامل خدمة', async () => {
  const fs = await import('node:fs');
  const app = fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8'), pos = fs.readFileSync(new URL('../mods/pos/PosApp.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("POS_Q_KEY = 'mizan:posQueue'") && app.includes("POS_SC_KEY = 'mizan:posShiftClose'") && app.includes("POS_LQ_KEY = 'mizan:posLoyQ'"));
  assert.ok(pos.includes('setInterval(flush, 20000)'));
  assert.ok(!/serviceWorker\.register\(/.test(pos), 'البند 4 (عامل خدمة لنقطة البيع) مؤجَّل إلى 5ب');
  assert.ok(/'posOffRevs'/.test(/const BR_COLS = \[([\s\S]*?)\];/.exec(app)[1]), 'المراجعات في مستند الفرع');
});

/* ---------- v56.53 — معالجة المراجعة الأمنية (قرارات المجلس) ---------- */
/** مخزن ذاكرة بتأخير عشوائي لكل عملية — يتشابك فيه العمل المتزامن كما بين تبويبين */
function slowStore(seed = 7) { const s = E.posStoreMem(); let x = seed; const rnd = () => { x = (x * 1103515245 + 12345) % 2147483648; return x % 4; };
  const d = (f) => async (...a) => { await new Promise(r => setTimeout(r, rnd())); return f(...a); };
  return { mode: 'mem', get: d(s.get), put: d(s.put), del: d(s.del), list: d(s.list) }; }
/** قفل navigator.locks وهمي: سلسلة وعود حسب الاسم */
function fakeLocks() { const q = {}; let busy = 0, max = 0;
  return { stat: () => max, request: (name, fn) => { const p = (q[name] || Promise.resolve()).then(async () => { busy++; max = Math.max(max, busy); try { return await fn(); } finally { busy--; } }); q[name] = p.catch(() => {}); return p; } }; }

test('المراجعة (1): سباق متشابك بين تبويبين (ترحيل + مزامنة + استرجاع + إضافة) تحت القفل — لا يضيع أي معرّف ولا يتكرر', async () => {
  const ls = fakeLs(), L = legacyOf(ls), store = slowStore(), locks = fakeLocks(); const cloud = new Map(); const ids = [];
  const send = async (kind, list) => { await new Promise(r => setTimeout(r, 1)); list.forEach(o => { if (!cloud.has(kind + ':' + o.id)) cloud.set(kind + ':' + o.id, o); }); return Math.random() > 0.3; };
  const env = { locks };
  const legacyAdd = (id) => { const a = L.read().order; L.write('order', [...a, ord(id, '2026-11-20T10:' + String(ids.length % 60).padStart(2, '0') + ':00Z')]); ids.push(id); };
  const tabA = (async () => { for (let i = 0; i < 25; i++) { legacyAdd('a' + i); await E.posLockRun(() => E.posObMigrate(store, L), env); if (i % 3 === 0) await E.posLockRun(() => E.posSyncRun(store, send), env); } })();
  const tabB = (async () => { for (let i = 0; i < 25; i++) { const o = ord('b' + i, '2026-11-20T11:' + String(i).padStart(2, '0') + ':00Z'); ids.push(o.id); await store.put('outbox', E.posObItem('order', o));
    if (i % 4 === 0) await E.posLockRun(() => E.posObRestore(store, L), env); if (i % 5 === 0) await E.posLockRun(() => E.posSyncRun(store, send), env); } })();
  await Promise.all([tabA, tabB]);
  assert.equal(locks.stat(), 1, 'لا تشغيلان متداخلان تحت القفل');
  for (let k = 0; k < 20 && ((await store.list('outbox')).length || L.read().order.length); k++) { await E.posLockRun(() => E.posObMigrate(store, L), env); await E.posLockRun(() => E.posSyncRun(store, async (kind, list) => { list.forEach(o => cloud.set(kind + ':' + o.id, o)); return true; }), env); }
  const seen = new Set([...cloud.keys()].map(k => k.slice(6)));
  assert.deepEqual(ids.filter(id => !seen.has(id)), [], 'كل معرّف وصل السحابة');
  assert.equal(cloud.size, ids.length, 'بلا تكرار (المفتاح معرّف)');
  assert.deepEqual([(await store.list('outbox')).length, L.read().order.length], [0, 0]);
});

test('المراجعة (1): القفل البديل بعلامة في localStorage — يسلسل التشغيل، وينتهي بالمهلة، ولا تشغيل بلا قفل', async () => {
  const ls = fakeLs(); let t = 0; const env = { ls, now: () => t, sleep: async (ms) => { t += ms; await new Promise(r => setTimeout(r, 0)); }, settle: 5, step: 10, ttl: 1000, wait: 5000 };
  let busy = 0, max = 0; const job = (v) => E.posLockRun(async () => { busy++; max = Math.max(max, busy); await env.sleep(50); busy--; return v; }, env);
  assert.deepEqual(await Promise.all([job(1), job(2), job(3)]), [1, 2, 3]); assert.equal(max, 1); assert.equal(ls.getItem('mizan:posObLock'), null, 'يُحرَّر');
  ls.setItem('mizan:posObLock', JSON.stringify({ id: 'dead-tab', until: t + 200 }));   // تبويب أُغلق وهو يحمله
  assert.equal(await job(4), 4, 'تنتهي العلامة بالمهلة');
  ls.setItem('mizan:posObLock', JSON.stringify({ id: 'busy-tab', until: t + 1e9 }));
  assert.equal(await E.posLockRun(async () => 'ran', { ...env, wait: 100 }), null, 'تعذّر القفل ⇒ لا تشغيل');
  assert.equal(await E.posLockRun(async () => 'x', {}), null, 'بلا قفل ولا تخزين ⇒ لا تشغيل');
  assert.equal(await E.posLockRun(async () => 'L', { locks: fakeLocks() }), 'L');
  // منع الاسترجاع ما دام التفعيل قائمًا في تبويب آخر
  E.posOnMark(ls, () => 1000, 'tabB'); assert.equal(E.posOnFresh(ls, () => 50000, 90000, 'tabA'), true, 'تبويب آخر مفعّل حديثًا ⇒ لا استرجاع');
  assert.equal(E.posOnFresh(ls, () => 200000, 90000, 'tabA'), false, 'إعلان قديم'); assert.equal(E.posOnFresh(ls, () => 50000, 90000, 'tabB'), false, 'إعلانه هو لا يمنعه');
  E.posOnClear(ls, 'tabA'); assert.ok(ls.getItem('mizan:posObOnAt'), 'لا يزيل إعلان غيره'); E.posOnClear(ls, 'tabB'); assert.equal(ls.getItem('mizan:posObOnAt'), null);
});

test('المراجعة (2): إخفاق الإرسال لا يعيد كتابة عنصر حُذف أثناءه (أكّده تبويب آخر)', async () => {
  const s = E.posStoreMem(); await s.put('outbox', E.posObItem('order', ord('a', '2026-11-20T10:00:00Z'))); await s.put('outbox', E.posObItem('order', ord('b', '2026-11-20T10:01:00Z')));
  const r = await E.posSyncRun(s, async () => { await s.del('outbox', 'order:a'); return false; });
  assert.equal(r.failed, 2); assert.deepEqual((await s.list('outbox')).map(x => [x.id, x.tries]), [['b', 1]]);
});

test('المراجعة (3): بصمة المرتجع كما كانت حرفيًا، ومع offline وbyId للمرتجع دون اتصال فقط؛ وقيد التدقيق والفحص الآلي للإقفال', () => {
  const r = { id: 'r1', no: 'م1-261120-AB12-0001', at: '2026-11-20T10:00:00.000Z', retLines: [{ i: 0, name: 'كبسة', qty: 1, amount: 58 }], total: -58, vat: -7.57, payments: [{ m: 'cash', amount: -58 }], icv: 4, pih: 'h3', refId: 'po1', refNo: 'ف1-1', by: 'خالد', branchId: 'b1', date: '2026-11-20', kind: 'return' };
  assert.deepEqual(E.posRetHashSrc(r), [r.no, r.at, r.retLines, r.total, r.vat, r.payments, r.icv, r.pih, r.refId], 'غير المرتجع دون اتصال: كما v56.52');
  assert.deepEqual(E.posRetHashSrc({ ...r, offline: true, byId: 'u3' }).slice(-1), [{ offline: true, byId: 'u3' }]);
  const a = E.posOffRetAudit({ ...r, offline: true }, 'فرع 1');
  assert.equal(a.actionType, 'create'); assert.equal(a.targetId, 'r1'); assert.match(a.title, /مزامنة مرتجع دون اتصال م1-261120-AB12-0001 عن الفاتورة ف1-1/); assert.match(a.details, /كبسة ×1 · 58\.00 · سجّله خالد/);
  const A = { entries: [] }; const ops = { posOrders: [{ ...r, offline: true }, { ...r, id: 'r2', offline: true, total: -20, date: '2026-12-02' }, { ...r, id: 'r3' }], posOffRevs: [] };
  const ck = (o, m) => E.closeAutoChecks(A, o, m).find(c => c.k === 'posoffret');
  assert.deepEqual([ck(ops, '2026-11').n, ck(ops, '2026-11').amt, ck(ops, '2026-11').ok], [1, 58, false]);
  assert.equal(ck({ ...ops, posOffRevs: [{ retId: 'r1' }] }, '2026-11'), undefined, 'بعد المراجعة لا بند');
  assert.equal(ck({ posOrders: [{ ...r }] }, '2026-11'), undefined, 'بلا مرتجعات دون اتصال لا بند جديد');
});

test('المراجعة (4): فحص فجوات سلسلة الفوترة لكل فرع وجهاز (icv متتالٍ وpih = البصمة السابقة) — يشمل إشعار الإلغاء', () => {
  const o = (no, icv, pih, hash, x = {}) => ({ id: no, no, branchId: 'b1', dev: 'AB12', icv, pih, hash, ...x });
  const ok = [o('ف1', 5, 'h4', 'h5'), o('ف2', 6, 'h5', 'h6', { status: 'void', voidNote: { no: 'م1', dev: 'AB12', icv: 7, pih: 'h6', hash: 'h7' } }), o('ف3', 8, 'h7', 'h8'), o('X', 1, '0', 'x1', { dev: 'ZZ99' }), { id: 'old', no: 'قديم', branchId: 'b1', dev: 'AB12' }];
  assert.deepEqual(E.posChainGaps(ok, 'b1'), [], 'أول حلقة (5) لا تُفحص لما قبلها، والقديم بلا icv خارج الفحص');
  const bad = [...ok, o('ف5', 10, 'h9', 'h10'), o('ف6', 11, 'zz', 'h11'), o('ف6ب', 11, 'h10', 'h11b'), o('ب2', 3, 'h2', 'h3', { branchId: 'b2' })];
  assert.deepEqual(E.posChainGaps(bad, 'b1').map(g => [g.kind, g.prevNo, g.no, g.dev]), [['gap', 'ف3', 'ف5', 'AB12'], ['pih', 'ف5', 'ف6', 'AB12'], ['dup', 'ف6', 'ف6ب', 'AB12']]);
  assert.equal(E.posChainGaps(bad, 'b2').length, 0);
});
