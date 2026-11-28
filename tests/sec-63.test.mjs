/**
 * v56.63 — مراجعة الأمان المستقلة لـ v56.62 (نقطتان متوسطتان):
 *  1) م-1 (قرار المجلس الخيار أ): accessMfaNeeded — متى ترفض القواعد كتابة العضويات وقائمة المدراء من جلسة بلا خطوة ثانية.
 *     (القواعد نفسها على المحاكي: tests/sec-m1m2.rules.test.mjs)
 *  2) قرار المالك: «فواتير المبيعات» للمركز فقط (siTabOk)، وشبكة أمان: مسار الفرع يرفض صراحةً أي تغيير في CORE_COLS.
 * كل البيانات وهمية.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

test('م-1: accessMfaNeeded — سياسة غير فارغة وجلسة بلا خطوة ثانية ⇒ مرفوض؛ وإلا كما كان', () => {
  const f = (p, u) => E.accessMfaNeeded(p, u);
  assert.equal(f(null, false), false, 'بلا سياسة');
  assert.equal(f({}, false), false, 'مستند فارغ');
  assert.equal(f({ admins: false, roles: [] }, false), false, 'سياسة فارغة = لا سياسة');
  assert.equal(f({ admins: true, roles: [] }, false), true, 'تُلزم المدراء');
  assert.equal(f({ admins: false, roles: ['finance_department'] }, false), true, 'دور فقط — قرار المجلس الخيار أ');
  assert.equal(f({ admins: false, roles: ['finance_department'] }, true), false, 'بخطوتين');
  assert.equal(f({ admins: true, roles: ['cashier'] }, true), false);
  assert.equal(f({ admins: 'yes', roles: 'x' }, false), false, 'قيم غير صالحة لا تُعدّ سياسة (القواعد ترفض حفظها أصلًا)');
  assert.equal(E.ACCESS_MFA_MSG, 'فعّل التحقق بخطوتين لحسابك لإدارة المستخدمين');
});

test('قرار المالك: siTabOk — فواتير المبيعات للنطاق الكامل فقط', () => {
  for (const r of ['branch_manager', 'regional_manager', 'cashier']) assert.equal(E.siTabOk(r), false, r);
  for (const r of ['finance_department', 'head_office', 'system_admin', 'general_management']) assert.equal(E.siTabOk(r), true, r);
  assert.equal(E.siTabOk(''), false, 'دور مجهول');
  assert.equal(E.siTabOk(undefined), false);
  // كل دور نطاقه ≠ all لا يراها — مهما أضيفت أدوار لاحقًا
  Object.keys(E.ROLES).forEach(r => assert.equal(E.siTabOk(r), E.ROLES[r].scope === 'all', r));
});

test('شبكة الأمان: outOfScopeRecords يلتقط أي إضافة/تعديل/حذف في CORE_COLS على مسار الفرع', () => {
  const my = ['b1'];
  assert.ok(E.CORE_COLS.includes('salesInvoices') && E.CORE_COLS.includes('invoices') && E.CORE_COLS.includes('cashVouchers'));
  // إضافة فاتورة مبيعات (حتى بفرع الحساب نفسه) ⇒ مرفوضة
  const add = E.outOfScopeRecords({ salesInvoices: [{ id: 's1', branchId: 'b1', total: 115 }] }, {}, my);
  assert.equal(add.length, 1); assert.equal(add[0].core, true); assert.equal(add[0].col, 'salesInvoices');
  // تعديل وحذف
  const L = { invoices: [{ id: 'i1', amount: 100 }, { id: 'i2', amount: 50 }] };
  const ed = E.outOfScopeRecords({ invoices: [{ id: 'i1', amount: 90 }] }, L, my);
  assert.deepEqual(ed.map(x => [x.id, !!x.removed]).sort(), [['i1', false], ['i2', true]]);
  // بلا تغيير (أو undefined مقابل []) ⇒ لا شيء — الحفظ التشغيلي للفرع يمر كما كان
  assert.equal(E.outOfScopeRecords({ invoices: JSON.parse(JSON.stringify(L.invoices)) }, L, my).length, 0);
  assert.equal(E.outOfScopeRecords({ salesInvoices: [], closings: [{ id: 'c1', branchId: 'b1' }] }, {}, my).length, 0, 'إغلاق فرعه');
  // سلوك BR_COLS القائم كما هو
  assert.equal(E.outOfScopeRecords({ closings: [{ id: 'c2', branchId: 'b9' }] }, {}, my).length, 1);
  assert.equal(E.outOfScopeRecords({ closings: [{ id: 'c2', branchId: 'b9' }] }, {}, my)[0].core, undefined);
  assert.match(E.CORE_SCOPE_MSG, /^لم يُحفظ/);
});

test('توافق رجعي: كل مجموعات CORE_COLS لا تتقاطع مع BR_COLS (الحارس لا يمس مستند الفرع)', () => {
  const br = new Set(E.BR_COLS); E.CORE_COLS.forEach(c => assert.equal(br.has(c), false, c));
});
