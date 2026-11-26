/**
 * v56.22 — MUKTASAB FINANCE G1: الصورة المالية في لوحة المدير المالي (النقد والسيولة، الربحية، التكاليف بالفرع، الضريبة والالتزامات).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const org = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'مورد' }] };
const ops = { closings: [{ id: 'c1', branchId: 'b1', branchName: 'العليا', date: '2026-11-05', status: 'approved', cashSales: 10000 }, { id: 'c0', branchId: 'b1', branchName: 'العليا', date: '2026-10-05', status: 'approved', cashSales: 8000 }],
  invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'مورد', date: '2026-11-06', amount: 3000, paidAmount: 0 }] };

test('G1: النقد والسيولة من الدفاتر، والمستحق للموردين، وصافي السيولة', () => {
  const A = E.buildAccounting(org, ops); const P = E.finPicture(org, ops, A, '2026-11-20');
  assert.equal(P.cash.cash, 18000); assert.equal(P.cash.ap, 3000); assert.equal(P.cash.net, 15000);
  assert.ok(P.cash.cashCodes.length >= 1, 'رموز الحسابات للتنقيب');
});

test('G1: الربحية للشهر الجاري مقابل السابق بنسبة التغير', () => {
  const A = E.buildAccounting(org, ops); const P = E.finPicture(org, ops, A, '2026-11-20');
  assert.equal(P.profit.cur.netSales, 10000); assert.equal(P.profit.prev.netSales, 8000); assert.equal(P.profit.chg.netSales, 25);
});

test('G1: التكاليف بالفرع، والعمالة على مستوى الشركة فقط (الرواتب بلا فرع)، والضريبة غير مفعّلة ⇒ null', () => {
  const A = E.buildAccounting(org, ops); const P = E.finPicture(org, ops, A, '2026-11-20');
  assert.equal(P.costs.branches.length, 1); assert.equal(P.costs.branches[0].netSales, 10000); assert.equal(P.costs.laborByBranch, null);
  assert.equal(P.tax.vat, null); assert.equal(P.tax.openMonths, null, 'لا قفل بعد');
});
