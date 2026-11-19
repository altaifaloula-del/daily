/* v52.4 — المرحلة H: تقارير الفروع والربحية من الطلبات الفعلية */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const org = { taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'طيبة' }, { id: 'b2', name: 'النسيم' }],
  items: [{ id: 'm', name: 'لحم', unit: 'كجم', cost: 40 }],
  products: [{ id: 'k', name: 'كبسة', sellPrice: 46, parts: [{ itemId: 'm', qty: 0.5 }] }, { id: 'l', name: 'لبن', sellPrice: 3 }] };
const o = (id, date, br, lines, x = {}) => { const total = lines.reduce((a, l) => a + l.qty * l.price - (l.disc || 0), 0) - (x.manualDisc || 0) - (x.orderDisc || 0);
  return { id, date, at: date + 'T09:30:00.000Z', branchId: br, channel: 'takeaway', lines, total, net: Math.round(total / 1.15 * 100) / 100, ...x }; };

test('تقرير الفروع: المبيعات والنمو والخصومات والمرتجعات والقنوات والأعلى مبيعًا', () => {
  const ops = { posOrders: [
    o('a', '2026-11-10', 'b1', [{ productId: 'k', name: 'كبسة', qty: 2, price: 46, disc: 4.6, promoId: 'p' }], { coupon: 'X', loyalty: { phone: '0500000001', redeemAmt: 2 } }),
    o('b', '2026-11-11', 'b1', [{ productId: 'k', name: 'كبسة', qty: 1, price: 46 }, { productId: 'l', name: 'لبن', qty: 2, price: 3, rec: 'co' }], { channel: 'delivery', manualDisc: 5 }),
    o('c', '2026-11-11', 'b1', [{ productId: 'k', qty: 1, price: 46 }], { status: 'void' }),
    { id: 'r', kind: 'return', date: '2026-11-12', branchId: 'b1', total: 46 },
    o('p', '2026-10-15', 'b1', [{ productId: 'k', qty: 1, price: 46 }]),
    o('q', '2026-11-12', 'b2', [{ productId: 'l', qty: 10, price: 3 }]),
  ] };
  const R = E.brReport(org, ops, { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(R.rows.map(r => r.branchId), ['b1', 'b2']);
  const b = R.rows[0];
  assert.equal(b.name, 'طيبة'); assert.equal(b.orders, 2); assert.equal(b.sales, 87.4 + 47); assert.equal(b.prevSales, 46); assert.equal(b.growthPct, Math.round((134.4 - 46) / 46 * 1000) / 10);
  assert.equal(b.promoDisc, 4.6); assert.equal(b.manualDisc, 5); assert.equal(b.loyDisc, 2); assert.equal(b.discTotal, 11.6);
  assert.equal(b.couponOrders, 1); assert.equal(b.recSales, 6); assert.equal(b.returns, 46); assert.equal(b.returnsN, 1); assert.equal(b.idPct, 50);
  assert.deepEqual(b.channels.map(c => [c.k, c.n, c.pct]), [['takeaway', 1, 50], ['delivery', 1, 50]]);
  assert.equal(b.top[0].productId, 'k'); assert.equal(b.top[0].qty, 3);
  assert.equal(typeof b.peakHour, 'number');
  // التكلفة: الكبسة 0.5×40=20 للوحدة × 3؛ اللبن بلا وصفة = غير مغطى
  assert.equal(b.cost, 60); assert.ok(b.costCover > 90 && b.costCover < 100, 'التغطية ناقصة بسبب اللبن');
  const covNet = (87.4 + 46) / 1.15; assert.equal(b.marginPct, Math.round((covNet - 60) / covNet * 1000) / 10);
  assert.equal(R.rows[1].costCover, 0); assert.equal(R.rows[1].marginPct, null);
  assert.equal(R.total.orders, 3); assert.equal(R.total.sales, 164.4);
});

test('النطاق: فروع المستخدم فقط، والفترة السابقة بالطول نفسه', () => {
  const ops = { posOrders: [o('a', '2026-11-10', 'b1', [{ productId: 'l', qty: 1, price: 3 }]), o('q', '2026-11-12', 'b2', [{ productId: 'l', qty: 1, price: 3 }])] };
  const R = E.brReport(org, ops, { from: '2026-11-01', to: '2026-11-30', branches: ['b2'] });
  assert.deepEqual(R.rows.map(r => r.branchId), ['b2']); assert.equal(R.pFrom, '2026-10-02'); assert.equal(R.pTo, '2026-10-31');
  assert.equal(R.rows[0].growthPct, null, 'لا فترة سابقة = لا نسبة نمو مختلقة');
  assert.deepEqual(E.brReport(org, { posOrders: [] }, { from: '2026-11-01', to: '2026-11-30' }).rows, []);
});
