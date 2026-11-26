/* v52.1 — المرحلة F: الحملات التسويقية — الترقيم والحالة والنتائج من الطلبات الفعلية */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();

test('ترقيم الحملات تسلسلي ولا يتكرر', () => {
  assert.equal(E.campNextNo({}), 'CMP-0001');
  assert.equal(E.campNextNo({ mktCampaigns: [{ no: 'CMP-0007' }, { no: 'CMP-0002' }] }), 'CMP-0008');
});

test('الحالة: النشطة بعد تاريخ نهايتها «منتهية»، والبقية كما هي', () => {
  assert.equal(E.campStatusOf({ status: 'active', to: '2026-11-01' }, '2026-11-19'), 'ended');
  assert.equal(E.campStatusOf({ status: 'active', to: '2026-12-01' }, '2026-11-19'), 'active');
  assert.equal(E.campStatusOf({ status: 'pending', to: '2026-11-01' }, '2026-11-19'), 'pending');
  assert.equal(E.campStatusOf({}, '2026-11-19'), 'draft');
  assert.equal(E.CAMP_ST.ended, 'منتهية');
});

test('النتائج: كوبونات الحملة داخل الفترة والفروع فقط، بلا المرتجعات والملغاة', () => {
  const org = { posPromos: [{ id: 'p1', code: 'WIN10' }, { id: 'p2', code: 'OTHER' }] };
  const o = (id, date, br, coupon, total, extra = {}) => ({ id, date, branchId: br, coupon, total, lines: [{ promoId: String(coupon).toUpperCase() === 'WIN10' ? 'p1' : 'p2', disc: 5 }], ...extra });
  const ops = { posOrders: [
    o('a', '2026-11-05', 'b1', 'WIN10', 100, { loyalty: { phone: '0500000001' } }),
    o('b', '2026-11-06', 'b1', 'win10', 50, { loyalty: { phone: '0500000002' } }),
    o('c', '2026-11-06', 'b2', 'WIN10', 70),                 // فرع خارج الحملة
    o('d', '2026-10-30', 'b1', 'WIN10', 90),                 // قبل الفترة
    o('e', '2026-11-07', 'b1', 'WIN10', 40, { status: 'void' }),
    o('f', '2026-11-07', 'b1', 'WIN10', 40, { kind: 'return' }),
    o('g', '2026-11-07', 'b1', 'OTHER', 30),                 // كوبون غير مرتبط
    o('h', '2026-11-08', 'b1', '', 60, { loyalty: { phone: '0500000003' } }),
  ] };
  const list = [{ phone: '500000001', tags: ['churn'], first: '2026-01-01' }, { phone: '500000002', tags: [], first: '2026-11-06' }, { phone: '500000003', tags: ['churn'], first: '2025-05-01' }, { phone: '500000004', tags: ['churn'], first: '2025-01-01' }];
  const c = { promoIds: ['p1'], branches: ['b1'], from: '2026-11-01', to: '2026-11-30', segment: 'churn', budget: 40 };
  const S = E.campStats(org, ops, list, c);
  assert.equal(S.redemptions, 2); assert.equal(S.sales, 150); assert.equal(S.disc, 10);
  assert.equal(S.target, 3); assert.equal(S.responders, 2); assert.equal(S.respRate, 66.7);   // 1 و3 اشتريا (3 بلا كوبون)
  assert.equal(S.newCustomers, 1); assert.equal(S.cost, 50); assert.equal(S.costPerOrder, 25);
  const all = E.campStats(org, ops, list, { ...c, branches: [], segment: 'all', budget: 0 });
  assert.equal(all.redemptions, 3); assert.equal(all.target, 4);
  const none = E.campStats(org, { posOrders: [] }, [], { promoIds: [], from: '2026-11-01', to: '2026-11-30' });
  assert.equal(none.redemptions, 0); assert.equal(none.costPerOrder, null); assert.equal(none.respRate, null);
});

test('عائد التسويق (قرار المالك): التكلفة من رصيد حساب الحملة في القيود، والعائد على المبيعات المنسوبة بلا ضريبة', () => {
  const org = { company: { name: 'ت' }, branches: [{ id: 'b1', name: 'فرع', isActive: true }], posPromos: [{ id: 'p1', code: 'WIN10' }] };
  const ord = (id, total, vat) => ({ id, date: '2026-11-05', branchId: 'b1', coupon: 'WIN10', total, vat, net: total - vat, lines: [{ promoId: 'p1', disc: 5 }] });
  const ops = { posOrders: [ord('a', 230, 30), ord('b', 115, 15)],
    journalManual: [{ id: 'j1', date: '2026-11-01', title: 'إعلانات الحملة', lines: [{ code: '5901', debit: 200, credit: 0 }, { code: '1201', debit: 0, credit: 200 }] },
      { id: 'j2', date: '2026-11-03', title: 'استرداد جزئي', lines: [{ code: '1201', debit: 50, credit: 0 }, { code: '5901', debit: 0, credit: 50 }] }] };
  const A = E.buildAccounting(org, ops);
  assert.equal(E.campSpend(A, '5901'), 150, 'المدين − الدائن');
  assert.equal(E.campSpend(A, '0000'), null); assert.equal(E.campSpend(null, '5901'), null);
  const c = { promoIds: ['p1'], from: '2026-11-01', to: '2026-11-30', segment: 'all', budget: 999, acc: '5901' };
  const S = E.campStats(org, ops, [], c, A);
  assert.equal(S.netSales, 300); assert.equal(S.spend, 150);
  assert.equal(S.roas, 2); assert.equal(S.roi, 100);                      // (300 − 150) ÷ 150
  assert.equal(S.cost, 150, 'مع الحساب: التكلفة الفعلية لا الميزانية'); assert.equal(S.costPerOrder, 75);
  const N = E.campStats(org, ops, [], { ...c, acc: undefined }, A);
  assert.equal(N.spend, null); assert.equal(N.roi, null); assert.equal(N.cost, 1009, 'بلا حساب: كما كان (الخصم + الميزانية)');
  const Z = E.campStats(org, ops, [], { ...c, acc: '5902' }, A);   // حساب بلا حركة
  assert.equal(Z.roi, null, 'لا قسمة على صفر');
});
