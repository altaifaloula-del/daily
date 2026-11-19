/* v52.2 — المرحلة G: توصيات عند الدفع — من السلال الفعلية وطلبات العميل، والنتائج من الطلبات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const P = [{ id: 'k', name: 'كبسة', sellPrice: 30 }, { id: 'l', name: 'لبن', sellPrice: 3 }, { id: 's', name: 'سلطة', sellPrice: 8 }, { id: 'x', name: 'موقوف', sellPrice: 5, posOff: true }, { id: 'm', name: 'ماء', sellPrice: 1 }];
const ord = (id, date, ps, extra = {}) => ({ id, date, branchId: 'b1', lines: ps.map(p => ({ productId: p, name: p, qty: 1, price: 1 })), ...extra });

test('الإعداد: افتراضي مفعّل وحدود معقولة', () => {
  assert.deepEqual(E.recCfgOf({}), { on: true, days: 60, minPair: 3, minConf: 15, max: 3 });
  const c = E.recCfgOf({ mkt: { recs: { on: false, days: 2, max: 99, minConf: 0 } } });
  assert.equal(c.on, false); assert.equal(c.days, 7); assert.equal(c.max, 6); assert.equal(c.minConf, 15);
});

test('«يُطلب معه»: الثقة والتكرار فوق الحد، ولا غير المتاح ولا ما في السلة ولا المُغفل، والفرع والفترة فقط', () => {
  const os = [];
  for (let i = 0; i < 10; i++) os.push(ord('a' + i, '2026-11-10', i < 6 ? ['k', 'l', 'x'] : i < 8 ? ['k', 's'] : ['k']));
  os.push(ord('r', '2026-11-10', ['k', 'm'], { kind: 'return' }), ord('v', '2026-11-10', ['k', 'm'], { status: 'void' }), ord('o', '2026-11-10', ['k', 'm'], { branchId: 'b2' }), ord('old', '2026-06-01', ['k', 'm']));
  for (let i = 0; i < 3; i++) os.push(ord('q' + i, '2026-11-11', ['k', 'm'], { branchId: 'b2' }));
  const idx = E.recIndex(os, { to: '2026-11-19', days: 60, branchId: 'b1' });
  assert.equal(idx.n.k, 10); assert.equal(idx.pair.k.l, 6); assert.equal(idx.pair.k.m, undefined);
  const r = E.recFor(idx, [{ productId: 'k', name: 'كبسة' }], P, { cfg: E.REC_DEF });
  assert.deepEqual(r.map(x => x.productId), ['l'], 'السلطة 2 فقط < حد التكرار 3، والموقوف مستبعد');
  assert.match(r[0].why, /كبسة.+60%/); assert.equal(r[0].kind, 'co'); assert.equal(r[0].price, 3);
  assert.deepEqual(E.recFor(idx, [{ productId: 'k' }], P, { cfg: { ...E.REC_DEF, minPair: 2 } }).map(x => x.productId), ['l', 's']);
  assert.ok(!E.recFor(idx, [{ productId: 'k' }, { productId: 'l' }], P, { cfg: E.REC_DEF }).some(x => x.productId === 'l'), 'لا يوصي بما في السلة');
  assert.deepEqual(E.recFor(idx, [{ productId: 'k' }], P, { cfg: E.REC_DEF, dismissed: ['l'] }), []);
  assert.deepEqual(E.recFor(idx, [], P, { cfg: E.REC_DEF }), []);
});

test('«المعتاد للعميل»: مرتان فأكثر، بالجوال الموحّد', () => {
  const os = [ord('c1', '2026-11-01', ['s'], { loyalty: { phone: '0551234567' } }), ord('c2', '2026-11-05', ['s', 'm'], { loyalty: { phone: '966551234567' } })];
  const idx = E.recIndex(os, { to: '2026-11-19' });
  const r = E.recFor(idx, [{ productId: 'k' }], P, { cfg: E.REC_DEF, phone: '055 123 4567' });
  assert.deepEqual(r.map(x => [x.productId, x.kind]), [['s', 'fav']]); assert.match(r[0].why, /2 مرات/);
});

test('النتائج: المعروض والمقبول والمُغفل ونسبة القبول ومبيعات الأسطر المقبولة', () => {
  const os = [
    { id: 1, date: '2026-11-10', branchId: 'b1', recShown: ['l', 's'], recDismissed: ['s'], lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 30 }, { productId: 'l', name: 'لبن', qty: 2, price: 3, rec: 'co' }] },
    { id: 2, date: '2026-11-11', branchId: 'b1', recShown: ['l'], lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 30 }] },
    { id: 3, date: '2026-11-11', branchId: 'b1', recShown: ['l'], kind: 'return', lines: [{ productId: 'l', qty: 1, price: 3, rec: 'co' }] },
    { id: 4, date: '2026-11-12', branchId: 'b1', lines: [{ productId: 'k', qty: 1, price: 30 }] },
  ];
  const S = E.recStats(os, { from: '2026-11-01', to: '2026-11-30' });
  assert.equal(S.orders, 2); assert.equal(S.withAcc, 1); assert.equal(S.shown, 3); assert.equal(S.accepted, 1); assert.equal(S.dismissed, 1);
  assert.equal(S.rate, 33.3); assert.equal(S.sales, 6);
  const l = S.rows.find(r => r.productId === 'l'); assert.deepEqual([l.shown, l.accepted, l.qty, l.sales, l.rate], [2, 1, 2, 6, 50]);
  assert.equal(E.recStats([], {}).rate, null);
});
