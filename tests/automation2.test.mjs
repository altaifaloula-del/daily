/* v52.0 — الأتمتة (الدفعة الثانية): استحقاق الرواتب، أوامر الشراء المقترحة، تذكير الإقرار، اقتراح الإقفال */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();

test('الإعداد: الافتراضيات والحدود', () => {
  assert.deepEqual(E.autoCfgOf({}), { recurring: true, payroll: true, payrollDay: 5, poSuggest: true, vatRemindDays: 7, lockAfterDays: 10 });
  assert.deepEqual(E.autoCfgOf({ autoCfg: { payroll: false, payrollDay: 99, vatRemindDays: -3 } }).payrollDay, 28);
  assert.equal(E.autoCfgOf({ autoCfg: { vatRemindDays: 0 } }).vatRemindDays, 0);
  assert.equal(E.prevMonthOf('2026-01-05'), '2025-12'); assert.equal(E.prevMonthOf('2026-11-19'), '2026-10');
});

test('استحقاق الرواتب تلقائيًا: موظفو المنشأة النشطون، بمعرّفات ثابتة، ولا تكرار، ولا شهر مقفل', () => {
  const org = { branches: [{ id: 'b1' }], employees: [{ id: 'e1', branchId: 'b1', baseSalary: 3000, housingAllowance: 750 }, { id: 'e2', branchId: 'b1', baseSalary: 4000, isActive: false }, { id: 'e3', branchId: 'gone', baseSalary: 9000 }] };
  const r = E.payrollAccrualApply({ ledgerEntries: [], advances: [] }, org, '2026-10');
  assert.deepEqual(r.entries.map(x => x.id), ['le_acc_e1_2026-10']); assert.equal(r.entries[0].credit, 3750); assert.equal(r.entries[0].kind, 'salary_accrual');
  assert.equal(E.payrollAccrualApply(r.next, org, '2026-10').entries.length, 0, 'مرة واحدة للشهر');
  assert.equal(E.payrollAccrualApply({ ledgerEntries: [{ kind: 'salary_accrual', month: '2026-10' }] }, org, '2026-10').entries.length, 0, 'رُحّل يدويًا ⇒ لا شيء');
  assert.equal(E.payrollAccrualApply({ ledgerEntries: [] }, { ...org, periodLocks: { lockedThrough: '2026-10' } }, '2026-10').entries.length, 0, 'الشهر المقفل');
});

test('أوامر الشراء المقترحة: من النفاد بآخر سعر ومورد، حتى ضعف الحد، بلا ما في أمر مفتوح', () => {
  const org = { warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', active: true }], items: [{ id: 'i1', name: 'لحم', unit: 'كجم', minQty: 10, isActive: true }, { id: 'i2', name: 'ملح', unit: 'كجم', minQty: 5, isActive: true }, { id: 'i3', name: 'أرز', unit: 'كجم', minQty: 20, isActive: true }], purchaseCfg: { perpetualFrom: '2020-01' } };
  const ops = { whMoves: [{ id: 'm1', whId: 'wh-main', itemId: 'i1', kind: 'in', qty: 4, unitCost: 40, date: '2026-01-01' }, { id: 'm2', whId: 'wh-main', itemId: 'i2', kind: 'in', qty: 100, date: '2026-01-01' }, { id: 'm3', whId: 'wh-main', itemId: 'i3', kind: 'in', qty: 2, date: '2026-01-01' }],
    purchaseOrders: [{ id: 'p0', supplierId: 's1', supplierName: 'مؤسسة اللحوم', status: 'received', date: '2026-10-01', lines: [{ itemId: 'i1', qty: 10, price: 42, received: 10 }] },
      { id: 'p1', supplierId: 's2', supplierName: 'الحبوب', status: 'received', date: '2026-10-02', lines: [{ itemId: 'i3', qty: 50, price: 5, received: 50 }] },
      { id: 'p2', supplierId: 's2', supplierName: 'الحبوب', status: 'open', date: '2026-11-18', whId: 'wh-main', lines: [{ itemId: 'i3', qty: 40, price: 5, received: 0 }] }] };
  const G = E.poSuggestions(org, ops);
  assert.equal(G.length, 1, 'الأرز في أمر مفتوح يغطيه، والملح فوق حده');
  assert.equal(G[0].supplierId, 's1'); assert.deepEqual(G[0].lines.map(l => [l.itemId, l.qty, l.price]), [['i1', 16, 42]]); assert.equal(G[0].total, 672);
});

test('التنبيهات: الإقرار الضريبي قبل موعده، والإقفال الشهري المتأخر', () => {
  const org = { taxCfg: { enabled: true, rate: 15 }, cashflowCfg: { vatFreq: 'monthly' }, branches: [] };
  const a1 = E.autoAlerts(org, { journalManual: [] }, '2026-11-25');
  assert.ok(a1.some(a => a.id === 'vat-due-2026-12-31') === false, 'الشهري: فترة نوفمبر تستحق 31 ديسمبر — بعيد');
  const a2 = E.autoAlerts(org, { journalManual: [] }, '2026-11-26');
  const lock = a2.find(a => a.id === 'lock-2026-10'); assert.ok(lock, 'أكتوبر لم يُقفل بعد مضي 26 يوم');
  assert.equal(E.autoAlerts({ ...org, periodLocks: { lockedThrough: '2026-10' } }, { journalManual: [] }, '2026-11-26').some(a => a.id.startsWith('lock-')), false);
  assert.equal(E.autoAlerts({ ...org, autoCfg: { lockAfterDays: 0 } }, { journalManual: [] }, '2026-11-26').some(a => a.id.startsWith('lock-')), false, 'موقوف');
  const q = E.autoAlerts({ ...org, cashflowCfg: { vatFreq: 'quarterly' } }, { journalManual: [] }, '2027-01-26');
  assert.ok(q.some(a => a.id === 'vat-due-2027-01-31'), 'ربع أكتوبر–ديسمبر يستحق 31 يناير — قبل 5 أيام');
  const paid = E.autoAlerts(org, { journalManual: [{ id: 'vc', status: 'posted', vatClose: { from: '2026-10-01', to: '2026-10-31', net: 5000 } }] }, '2026-11-27');
  assert.ok(paid.some(a => a.id === 'vat-pay-vc' && /سداد ضريبة يستحق خلال 3 يوم/.test(a.title)), JSON.stringify(paid.map(a => a.title)));
});
