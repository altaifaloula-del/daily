/* v52.7 — G3 الخيار A: فواتير نقطة البيع في مستند شهري لكل فرع — التقسيم والتجميع والكتابة والترحيل والتراجع */
import { test } from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); }, key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; }, clear: () => mem.clear() };
const { buildEngine } = await import('./build-engine.mjs');
const E = await buildEngine();
const get = (k) => JSON.parse(mem.get(k) || 'null');
const put = (k, v) => mem.set(k, JSON.stringify(v));
const o = (id, date, total = 10) => ({ id, date, branchId: 'b1', total, lines: [] });

test('التقسيم والتجميع: الشهر من تاريخ الفاتورة، بلا تكرار، والفواتير المتبقية في المستند القديم تُضم', () => {
  assert.equal(E.posYmOf({ date: '2026-11-19' }), '202611'); assert.equal(E.posYmOf({ at: '2026-10-01T09:00:00Z' }), '202610');
  const S = E.posSplitDoc({ posOrders: [o('a', '2026-11-02'), o('b', '2026-10-30'), o('c', '2026-11-05')], closings: [{ id: 'x' }] });
  assert.deepEqual(Object.keys(S.months).sort(), ['202610', '202611']); assert.deepEqual(S.months['202611'].map(x => x.id), ['a', 'c']);
  assert.deepEqual(S.base.posOrders, []); assert.deepEqual(S.base.posMonths, ['202610', '202611']); assert.deepEqual(S.base.closings, [{ id: 'x' }]);
  const J = E.posJoin({ posMonths: ['202610', '202611'], posOrders: [o('late', '2026-11-20'), o('a', '2026-11-02')] }, { '202611': { orders: [o('a', '2026-11-02'), o('c', '2026-11-05')] }, '202610': { orders: [o('b', '2026-10-30')] } });
  assert.deepEqual(J.posOrders.map(x => x.id), ['a', 'c', 'b', 'late'], 'الأحدث شهرًا أولًا، وبلا تكرار');
  assert.equal(E.posSplitOn({ posMonths: [] }), true); assert.equal(E.posSplitOn({ posOrders: [] }), false);
});

test('الترحيل ثم الكتابة: لا يُكتب إلا الشهر المتغير، ومستند الفرع يصغر، والقراءة تعيد كل الفواتير، والتراجع يعيدها لمستند الفرع', async () => {
  mem.clear();
  const orders = []; for (let i = 0; i < 30; i++) orders.push(o('o' + i, i < 20 ? '2026-10-' + String(1 + i).padStart(2, '0') : '2026-11-' + String(i - 19).padStart(2, '0'), 5 + i));
  put('rms8:br_b1', { posOrders: orders, closings: [{ id: 'c1', branchId: 'b1' }], rev: 3 });
  const m = await E.posSplitBranch('b1');
  assert.equal(m.ok, true); assert.equal(m.n, 30); assert.equal(m.months, 2);
  const raw = get('rms8:br_b1'); assert.deepEqual(raw.posOrders, []); assert.deepEqual(raw.posMonths, ['202610', '202611']); assert.equal(raw.closings.length, 1);
  assert.equal(get('rms8:pos_b1_202610').orders.length, 20); assert.equal(get('rms8:pos_b1_202611').orders.length, 10);
  // القراءة المجمّعة
  const r = await E.brRead('b1', true); assert.equal(r.value.posOrders.length, 30); assert.equal(r.value.closings.length, 1);
  // فاتورة جديدة في نوفمبر: أكتوبر لا يُلمس
  const octBefore = mem.get('rms8:pos_b1_202610');
  const next = { ...r.value, posOrders: [o('new', '2026-11-20', 99), ...r.value.posOrders] };
  assert.equal(await E.brWrite('b1', { closings: next.closings, posOrders: next.posOrders, rev: 4 }, r.value), 'ok');
  assert.equal(mem.get('rms8:pos_b1_202610'), octBefore, 'شهر لم يتغير لا يُعاد كتابته');
  assert.equal(get('rms8:pos_b1_202611').orders.length, 11); assert.deepEqual(get('rms8:br_b1').posMonths, ['202610', '202611']); assert.deepEqual(get('rms8:br_b1').posOrders, []);
  // جهاز بإصدار قديم كتب فاتورة في مستند الفرع مباشرة: تظهر، وأول حفظ تالٍ ينقلها لشهرها
  put('rms8:br_b1', { ...get('rms8:br_b1'), posOrders: [o('old-client', '2026-12-01', 7)] });
  const r2 = await E.brRead('b1', true); assert.equal(r2.value.posOrders.length, 32); assert.ok(r2.value.posOrders.some(x => x.id === 'old-client'));
  assert.equal(await E.brWrite('b1', { closings: r2.value.closings, posOrders: r2.value.posOrders, rev: 5 }, r2.value), 'ok');
  assert.deepEqual(get('rms8:br_b1').posOrders, []); assert.equal(get('rms8:pos_b1_202612').orders[0].id, 'old-client'); assert.deepEqual(get('rms8:br_b1').posMonths, ['202610', '202611', '202612']);
  // إعادة الترحيل لا تكرر
  assert.equal((await E.posSplitBranch('b1')).already, true);
  // التراجع
  const u = await E.posUnsplitBranch('b1'); assert.equal(u.ok, true); assert.equal(u.n, 32);
  const back = get('rms8:br_b1'); assert.equal(back.posOrders.length, 32); assert.equal('posMonths' in back, false); assert.ok(mem.has('rms8:pos_b1_202610'), 'المستندات الشهرية تبقى (لا حذف)');
  const r3 = await E.brRead('b1', true); assert.equal(r3.value.posOrders.length, 32);
});

test('فرع غير مفصول: القراءة والكتابة كما كانتا تمامًا', async () => {
  mem.clear(); put('rms8:br_b2', { posOrders: [o('a', '2026-11-01')], rev: 1 });
  const r = await E.brRead('b2', true); assert.deepEqual(r.value.posOrders.map(x => x.id), ['a']);
  assert.equal(await E.brWrite('b2', { posOrders: [o('b', '2026-11-02'), o('a', '2026-11-01')], rev: 2 }, r.value), 'ok');
  assert.deepEqual(get('rms8:br_b2').posOrders.map(x => x.id), ['b', 'a']); assert.equal([...mem.keys()].some(k => k.startsWith('rms8:pos_')), false);
});
