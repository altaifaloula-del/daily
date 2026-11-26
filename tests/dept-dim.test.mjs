/**
 * v56.27 — FINANCE E4: بُعد القسم الإداري (بقرار المالك: قائمة مستقلة، اختياري، «مشترك» بلا توزيع، الرواتب لا تُقسَّم).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'مورد' }],
  costDepts: { on: true, list: [{ id: 'k', name: 'المطبخ' }, { id: 'h', name: 'الصالة' }, { id: 'x', name: 'قديم', active: false }] } };
const je = (id, lines) => ({ id, date: '2026-11-10', title: 'قيد', status: 'posted', lines });

test('E4: معطّل افتراضيًا، والقائمة تستبعد الموقوف إلا بطلب', () => {
  assert.equal(E.deptOn({}), false); assert.equal(E.deptOn({ costDepts: { list: [] } }), false); assert.equal(E.deptOn(base), true);
  assert.deepEqual(E.deptList(base).map(d => d.id), ['k', 'h']); assert.equal(E.deptList(base, true).length, 3);
});

test('E4: المصروفات حسب القسم من سطور القيد اليدوي + مشترك + بلا قسم = إجمالي المصروفات', () => {
  const ops = { journalManual: [
    je('j1', [{ code: '5201', debit: 300, credit: 0, deptId: 'k' }, { code: '5202', debit: 200, credit: 0, deptId: 'h' }, { code: '1111', debit: 0, credit: 500 }]),
    je('j2', [{ code: '5203', debit: 120, credit: 0, deptId: E.DEPT_SHARED }, { code: '5201', debit: 80, credit: 0 }, { code: '1111', debit: 0, credit: 200 }]) ] };
  const org = base; const A = E.buildAccounting(org, ops);
  const R = E.deptPL(org, A, '2026-11-01', '2026-11-30', '');
  const v = Object.fromEntries(R.rows.map(r => [r.id, r.v]));
  assert.equal(v.k, 300); assert.equal(v.h, 200); assert.equal(R.shared, 120);
  assert.equal(Math.round((R.rows.reduce((t, r) => t + r.v, 0) + R.shared + R.none) * 100) / 100, R.total, 'الأجزاء = الإجمالي');
  const expAll = (A.entries || []).reduce((t, e) => t + (e.lines || []).filter(l => (A.accounts.find(a => a.code === String(l.code)) || {}).kind === 'exp').reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0), 0);
  assert.equal(R.total, Math.round(expAll * 100) / 100, 'يطابق إجمالي المصروفات في الدفاتر');
  assert.equal(R.rows.find(r => r.id === 'x'), undefined, 'الموقوف بلا حركة لا يظهر');
});

test('E4: قسم فاتورة الخدمات ينتقل إلى قيدها', () => {
  const ops = { invoices: [{ id: 'i1', kind: 'svc', supplierId: 's1', supplierName: 'مورد', date: '2026-11-06', amount: 1000, paidAmount: 0, deptId: 'h', accCode: '5202', expLines: [{ accCode: '5202', net: 1000 }] }] };
  const A = E.buildAccounting(base, ops); const e = A.entries.find(x => x.id === 'inv:i1');
  assert.ok(e, 'قيد الفاتورة'); assert.equal(e.deptId, 'h');
  const R = E.deptPL(base, A, '', '', ''); assert.ok((R.rows.find(r => r.id === 'h') || {}).v > 0, 'مصروف الصالة');
});

test('E4 (مراجعة رئيس المحاسبين): القيد العكسي بأبعاد الأصل يصفّر القسم، و«بلا قسم» لا يصير سالبًا', () => {
  const orig = je('j1', [{ code: '5201', debit: 500, credit: 0, deptId: 'k' }, { code: '1111', debit: 0, credit: 500 }]);
  const rev = { id: 'r1', date: '2026-11-12', title: 'عكس', status: 'posted', reverses: 'j1', lines: [{ code: '1111', debit: 500, credit: 0 }, { code: '5201', debit: 0, credit: 500, deptId: 'k' }] };
  const A = E.buildAccounting(base, { journalManual: [orig, rev] }); const R = E.deptPL(base, A, '', '', '');
  assert.equal((R.rows.find(r => r.id === 'k') || {}).v, 0); assert.equal(R.none, 0); assert.equal(R.total, 0);
});

test('E4: الإشعار المدين على فاتورة الخدمات يخفض قسمها', () => {
  const ops = { invoices: [
    { id: 'i1', kind: 'svc', supplierId: 's1', supplierName: 'مورد', date: '2026-11-06', amount: 1000, paidAmount: 0, deptId: 'h', expLines: [{ accCode: '5202', net: 1000 }] },
    { id: 'i2', supplierId: 's1', supplierName: 'مورد', date: '2026-11-08', appliesTo: 'i1', creditNote: true, debitNote: true, deptId: 'h', accCode: '5202', amount: -200, vatAmt: 0, invoiceNo: 'PDN-1' } ] };
  const A = E.buildAccounting(base, ops); const R = E.deptPL(base, A, '', '', '');
  assert.equal((R.rows.find(r => r.id === 'h') || {}).v, R.total, 'كل الصافي على الصالة'); assert.equal(R.none, 0);
});

test('E4: الإقفال السنوي مستثنى، وفلتر «المركزي» والفرع، والأجزاء = الإجمالي', () => {
  const ops = { journalManual: [
    { ...je('a', [{ code: '5201', debit: 100, credit: 0, deptId: 'k' }, { code: '1111', debit: 0, credit: 100 }]), date: '2025-06-01' },
    { ...je('b', [{ code: '5201', debit: 300, credit: 0, deptId: 'h' }, { code: '1111', debit: 0, credit: 300 }]), branchId: 'b1' } ] };
  const org = { ...base, yearEnd: { enabled: true, closeDate: '2025-12-31' } };
  const A = E.buildAccounting(org, ops);
  const all = E.deptPL(org, A, '', '', ''); assert.equal(all.total, 400, 'قيد الإقفال لا يُحسب');
  assert.equal(E.deptPL(org, A, '', '', 'central').total, 100); assert.equal(E.deptPL(org, A, '', '', 'b1').total, 300);
  for (const R of [all]) assert.equal(Math.round((R.rows.reduce((t, r) => t + r.v, 0) + R.shared + R.none) * 100) / 100, R.total);
});

test('E4: القيد الدوري يحمل قسم السطر', () => {
  const tpl = { id: 't', title: 'إيجار', every: 'm', day: 1, next: '2026-11-01', active: true, lines: [{ code: '5202', debit: 50, credit: 0, deptId: 'h' }, { code: '1111', debit: 0, credit: 50 }] };
  const out = E.recurApply({ journalManual: [], jeRecurring: [tpl] }, { name: 'x', id: 'u', role: 'owner' }, base, '2026-11-02');
  const j = out.recs[0];
  assert.ok(j, 'قيد مولَّد'); assert.equal((j.lines || []).find(l => l.code === '5202').deptId, 'h');
});
