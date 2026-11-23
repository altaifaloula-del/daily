/* v53.3 — رقم قيد ثابت لكل فاتورة مورد + رقم موحد لدفعة الاستيراد */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();

test('الفواتير الجديدة فقط تُرقَّم عند الحفظ، والقديمة لا تُمس', () => {
  const prev = [{ id: 'a', date: '2026-01-01' }, { id: 'b', date: '2026-01-02', jeNo: 'PJ-000007' }];
  const next = [{ id: 'n2', date: '2026-03-02' }, { id: 'n1', date: '2026-03-01' }, ...prev];
  const r = E.pjStamp(prev, next);
  assert.equal(r.find(x => x.id === 'n1').jeNo, 'PJ-000008');
  assert.equal(r.find(x => x.id === 'n2').jeNo, 'PJ-000009');
  assert.equal(r.find(x => x.id === 'a').jeNo, undefined);
  assert.equal(E.pjStamp(next, next), next);          // لا تغيير ⇒ نفس المرجع
});

test('الرقم الموحد للدفعة: رقم واحد لكل دفعة، ويستمر عبر الأجزاء', () => {
  const part1 = [{ id: 'x1', date: '2026-02-01', importBatch: 'xb1', importLine: 2 }, { id: 'x2', date: '2026-02-01', importBatch: 'xb1', importLine: 3 }];
  const s1 = E.pjStamp([], part1);
  assert.deepEqual(s1.map(i => [i.jeNo, i.importNo]), [['PJ-000001', 'IMP-0001'], ['PJ-000002', 'IMP-0001']]);
  const s2 = E.pjStamp(s1, [{ id: 'x3', date: '2026-01-15', importBatch: 'xb1', importLine: 4 }, ...s1]);
  assert.deepEqual([s2[0].jeNo, s2[0].importNo], ['PJ-000003', 'IMP-0001']);
  const s3 = E.pjStamp(s2, [{ id: 'y1', date: '2026-02-03', importBatch: 'xb2' }, ...s2]);
  assert.equal(s3[0].importNo, 'IMP-0002');
});

test('الترقيم الصريح للقديمة بترتيب التاريخ ويكمل من أكبر رقم', () => {
  const L = [{ id: 'c', date: '2026-05-01' }, { id: 'd', date: '2026-04-01', importBatch: 'xb9' }, { id: 'e', date: '2026-06-01', jeNo: 'PJ-000010' }];
  assert.equal(E.pjMissing(L), 2);
  const r = E.pjBackfill(L);
  assert.deepEqual(r.map(i => i.jeNo), ['PJ-000012', 'PJ-000011', 'PJ-000010']);
  assert.equal(r[1].importNo, 'IMP-0001'); assert.equal(E.pjMissing(r), 0);
});

test('القيد في الدفتر يحمل الرقم الثابت للفاتورة ولسدادها', () => {
  const org = { taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'طيبة' }], suppliers: [{ id: 's1', name: 'م' }], fin: {} };
  const ops = { invoices: [{ id: 'i1', kind: 'svc', supplierId: 's1', supplierName: 'م', invoiceNo: 'E1', amount: 115, vatAmt: 15, taxable: true, date: '2026-02-01', dueDate: '2026-02-01', jeNo: 'PJ-000005',
    paidAmount: 115, payments: [{ id: 'p1', amount: 115, date: '2026-02-01', fund: '1101' }], expLines: [{ desc: 'x', accCode: '5198', net: 100, vat: 15 }] }] };
  const A = E.buildAccounting(org, ops, [], {});
  const inv = A.entries.find(e => e.id === 'inv:i1'); assert.equal(inv.fix, 'PJ-000005');
  const pay = A.entries.find(e => String(e.id).startsWith('invp:i1')); assert.equal(pay.fix, 'PJ-000005/س1');
});
