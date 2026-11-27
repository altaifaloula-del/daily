/**
 * v56.42 — الدفعة 8 (U3 + قرار المالك): قسم مصروفات الوردية من تصنيفها؛ الصيانة والكهرباء يحدد المحاسب قسمها.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const cats = [{ id: 'ec1', n: 'مشتريات مواد خام' }, { id: 'ec2', n: 'رواتب وأجور' }, { id: 'ec3', n: 'سلف ومسحوبات موظفين' }, { id: 'ec4', n: 'صيانة وتشغيل' }, { id: 'ec5', n: 'كهرباء ومياه' }, { id: 'ec6', n: 'إيجار الفرع' }, { id: 'ec7', n: 'نظافة ومستهلكات' }, { id: 'ec8', n: 'مصاريف نثرية' }];
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, expenseCats: cats,
  costDepts: { on: true, list: [{ id: 'k', name: 'المطبخ' }, { id: 'h', name: 'الصالة' }] } };
const cl = (id, date, ex) => ({ id, branchId: 'b1', branchName: 'العليا', date, status: 'approved', cash: 0, card: 0, totalRevenue: 0, expenses: ex });

test('U3: الاقتراح من قرار المجلس والمالك', () => {
  assert.deepEqual(E.deptMapSuggest(base), { ec1: 'k', ec2: '', ec4: E.DEPT_PICK, ec5: E.DEPT_PICK, ec6: 'shared', ec7: 'h', ec8: 'shared' });
});

test('U3: بلا خريطة كما كان؛ ومع الخريطة القسم من التصنيف بتاريخ الإغلاق، وما قبل البدء لا يتغير، و«يحدده المحاسب» من اختياره', () => {
  const ex = [{ id: 'x1', categoryId: 'ec7', categoryName: 'نظافة', amount: 100, paymentMethod: 'cash' }, { id: 'x2', categoryId: 'ec4', categoryName: 'صيانة', amount: 200, paymentMethod: 'cash' },
    { id: 'x3', categoryId: 'ec3', categoryName: 'سلف', amount: 50, paymentMethod: 'cash' }];
  const ops = { closings: [cl('c0', '2026-10-01', ex), cl('c1', '2026-11-10', ex)] };
  const A0 = E.buildAccounting(base, ops); assert.equal(A0.entries.some(e => /^exp:/.test(e.id) && e.deptId), false, 'بلا خريطة');
  const org = { ...base, costDepts: { ...base.costDepts, catMaps: [{ from: '2026-11-01', map: E.deptMapSuggest(base) }] } };
  const A = E.buildAccounting(org, ops); const dep = (id) => (A.entries.find(e => e.id === id) || {}).deptId;
  assert.equal(dep('exp:c0:x1'), undefined, 'قبل البدء'); assert.equal(dep('exp:c1:x1'), 'h'); assert.equal(dep('exp:c1:x2'), undefined, 'ينتظر المحاسب'); assert.equal(dep('exp:c1:x3'), undefined, 'السلف ليست مصروفًا');
  assert.deepEqual(E.expDeptPending(org, ops, '2026-11-01', '2026-11-30').map(x => x.key), ['c1:x2']);
  const ops2 = { ...ops, expDeptPicks: [{ key: 'c1:x2', deptId: 'h' }, { key: 'c1:x2', deptId: 'k' }] };
  assert.equal(E.buildAccounting(org, ops2).entries.find(e => e.id === 'exp:c1:x2').deptId, 'k', 'الأحدث يغلب'); assert.deepEqual(E.expDeptPending(org, ops2, '2026-11-01', '2026-11-30'), []);
  const C = E.closeAutoChecks(A, ops, '2026-11', org); assert.equal(C.find(x => x.k === 'deptpick').n, 1);
  const R = E.deptPL(org, E.buildAccounting(org, ops2), '2026-11-01', '2026-11-30', ''); assert.equal(R.rows.find(r => r.id === 'k').v, 200); assert.equal(R.rows.find(r => r.id === 'h').v, 100);
  assert.equal(E.lockedLedgerSig(org, ops, '2026-11'), E.lockedLedgerSig(org, ops2, '2026-11'), 'القسم لا يمس بصمة الإقفال');
});
