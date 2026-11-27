/**
 * v56.41 — الدفعة 6 (قرارات المجلس E5 وT4): الموازنات بالإصدارات، والمصروف المدفوع مقدمًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const acc = { id: 'u1', name: 'أحمد', role: 'accountant' }, fin = { id: 'u2', name: 'سارة', role: 'finance_department' }, own = { id: 'u0', name: 'المالك', role: 'system_admin' };
const org = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false },
  customAccounts: [{ code: '1450', name: 'إيجار مدفوع مقدمًا', kind: 'asset' }] };
const bal = (A, code) => Math.round(A.entries.reduce((t, e) => t + (e.lines || []).filter(l => String(l.code) === code).reduce((a, l) => a + l.debit - l.credit, 0), 0) * 100) / 100;

test('E5.4: بلا إصدارات تُقرأ الموازنة القديمة إصدارًا صفريًا (المبلغ نفسه كل شهر)، وبلا تفعيل لا شيء', () => {
  assert.equal(E.budActive({}, {}, 2026), null); assert.equal(E.budVOn({}), false);
  const B = E.budActive({ budget: { enabled: true, lines: [{ code: '5201', amount: 1000 }] } }, {}, 2026);
  assert.equal(B.ver, 0); assert.equal(B.legacy, true); assert.deepEqual(E.budMonthMap(B, 7), { 5201: 1000 });
});

test('E5.1/E5.2: الإصدارات — حساب × شهر × فرع، الاعتماد لغير المُعدّ ومن المالك أو الإدارة المالية، والمعتمد الجديد يستبدل القديم', () => {
  const v1 = { ...E.budNewVersion({}, 2026, acc), status: 'submitted', lines: [{ code: '5201', month: 1, branchId: 'b1', amount: 600 }, { code: '5201', month: 1, amount: 400 }, { code: '5202', month: 2, branchId: 'b1', amount: 50 }] };
  assert.equal(v1.ver, 1);
  let d = { budgets: [v1] };
  assert.match(E.budApprove(d, v1.id, acc).err, /غير من أعدّها|يعتمدها/, 'المُعدّ');
  assert.match(E.budApprove(d, v1.id, { id: 'u3', name: 'منى', role: 'accountant' }).err, /يعتمدها/, 'محاسب آخر ليس معتمدًا');
  d = E.budApprove(d, v1.id, fin).next; assert.equal(d.budgets[0].status, 'approved');
  const B = E.budActive(org, d, 2026); assert.deepEqual(E.budMonthMap(B, 1), { 5201: 1000 }, 'كل السطور'); assert.deepEqual(E.budMonthMap(B, 1, 'b1'), { 5201: 600 }); assert.deepEqual(E.budMonthMap(B, 1, ''), { 5201: 400 });
  const v2 = { ...E.budNewVersion(d, 2026, acc, B), status: 'submitted' }; assert.equal(v2.ver, 2); assert.equal(v2.lines.length, 3, 'نسخة من السابق');
  v2.lines[0].amount = 700; assert.equal(B.lines[0].amount, 600, 'المعتمد لا يتغير بتعديل النسخة');
  d = E.budApprove({ budgets: [...d.budgets, v2] }, v2.id, own).next;
  assert.deepEqual(d.budgets.map(b => b.status), ['superseded', 'approved']); assert.deepEqual(E.budMonthMap(E.budActive(org, d, 2026), 1, 'b1'), { 5201: 700 });
  assert.equal(E.budActive(org, d, 2027), null, 'سنة أخرى');
});

test('T4: إعادة التصنيف ثم الإطفاء الشهري — متوازن، والمصروف موزّع، والأصل يُطفأ إلى صفر، والهللات على الشهر الأخير', () => {
  const x = { id: 'p1', no: 'PP-1', desc: 'إيجار سنة', date: '2025-01-15', start: '2025-01', months: 12, amount: 10000, assetAcc: '1450', expAcc: '5301', branchId: 'b1', status: 'approved', by: 'أحمد', byId: 'u1' };
  const S = E.ppSchedule(x); assert.equal(S.length, 12); assert.equal(S[0].date, '2025-01-31'); assert.equal(S[11].date, '2025-12-31');
  assert.equal(Math.round(S.reduce((t, s) => t + s.amount, 0) * 100) / 100, 10000); assert.equal(S[0].amount, 833.33); assert.equal(S[11].amount, 833.37);
  const pay = { id: 'j1', date: '2025-01-15', title: 'دفع إيجار', status: 'posted', lines: [{ code: '5301', debit: 10000, credit: 0 }, { code: '1111', debit: 0, credit: 10000 }] };
  const A = E.buildAccounting(org, { journalManual: [pay], prepaids: [x] });
  const pp = A.entries.filter(e => /^pp:/.test(e.id)); const curYm = new Date().toISOString().slice(0, 7);
  assert.equal(pp.length, 13, 'كل أشهر 2026 مضت قبل تاريخ الاختبار'); assert.ok(pp.every(e => e.date.slice(0, 7) <= curYm || /:r$/.test(e.id))); pp.forEach(e => assert.equal(Math.round(e.lines.reduce((t, l) => t + l.debit - l.credit, 0) * 100), 0));
  assert.equal(bal(A, '1450'), 0); assert.equal(bal(A, '5301'), 10000);
  const upto = (d) => Math.round(A.entries.filter(e => e.date <= d).reduce((t, e) => t + e.lines.filter(l => l.code === '5301').reduce((a, l) => a + l.debit - l.credit, 0), 0) * 100) / 100;
  assert.equal(upto('2025-01-31'), 833.33, 'مصروف يناير وحده'); assert.equal(upto('2025-03-31'), 2499.99);
  assert.ok(pp.every(e => e.branchId === 'b1'));
  assert.equal(E.buildAccounting(org, { prepaids: [{ ...x, status: 'pending' }] }).entries.some(e => /^pp:/.test(e.id)), false, 'المعلّق لا يُقيَّد');
});

test('T4: الفحوص والاعتماد لغير المنشئ', () => {
  const A = E.buildAccounting(org, {}); const x = { id: 'p1', desc: 'إيجار', date: '2026-01-15', start: '2026-01', months: 12, amount: 1200, assetAcc: '1450', expAcc: '5301', status: 'pending', by: 'أحمد', byId: 'u1' };
  assert.equal(E.ppCheck(org, {}, x, A), '');
  assert.match(E.ppCheck(org, {}, { ...x, start: '2025-12' }, A), /لا يسبق/);
  assert.match(E.ppCheck(org, {}, { ...x, months: 1 }, A), /من 2 إلى 120/);
  assert.match(E.ppCheck(org, {}, { ...x, assetAcc: '1111' }, A), /المدفوع مقدمًا/); assert.match(E.ppCheck(org, {}, { ...x, assetAcc: '1380' }, A), /المدفوع مقدمًا/);
  assert.match(E.ppCheck(org, {}, { ...x, expAcc: '4101' }, A), /5xxx/);
  assert.match(E.ppCheck({ ...org, periodLocks: { lockedThrough: '2026-01' } }, {}, x, A), /مقفلة/);
  assert.match(E.ppCheck(org, {}, { ...x, date: '2999-01-01', start: '2999-01' }, A), /مستقبلي/);
  const d = { prepaids: [x] }; assert.match(E.ppApprove(org, d, 'p1', acc, A).err, /من أنشأه/);
  assert.equal(E.ppApprove(org, d, 'p1', fin, A).next.prepaids[0].status, 'approved');
});

test('T4 (التحقق المحاسبي): لا إطفاء مستقبلي، والحسابات المسموحة، ولا مستند مكرر، ولا قسط صفري', () => {
  const td = new Date(); const ym = td.getFullYear() + '-' + String(td.getMonth() + 1).padStart(2, '0'); const d0 = ym + '-01';
  const x = { id: 'p1', desc: 'إيجار', date: d0, start: ym, months: 12, amount: 1200, assetAcc: '1450', expAcc: '5301', status: 'approved', by: 'أحمد', byId: 'u1' };
  const A = E.buildAccounting(org, { prepaids: [x] }); const pp = A.entries.filter(e => /^pp:/.test(e.id));
  assert.equal(pp.length, 2, 'إعادة التصنيف + إطفاء الشهر الجاري وحده'); assert.equal(bal(A, '1450'), 1100);
  const A0 = E.buildAccounting(org, {});
  for (const bad of ['1401', '1501', '1601', '1701', '1791', '1111', '1380']) assert.match(E.ppCheck(org, {}, { ...x, id: 'n', status: 'pending', assetAcc: bad }, A0), /المدفوع مقدمًا/, bad);
  assert.match(E.ppCheck(org, {}, { ...x, id: 'n', status: 'pending', expAcc: '5150' }, A0), /تسوية المخزون/);
  assert.match(E.ppCheck(org, { prepaids: [x] }, { ...x, id: 'n', status: 'pending' }, A0), /للدفعة نفسها/);
  assert.equal(E.ppCheck(org, { prepaids: [{ ...x, status: 'rejected' }] }, { ...x, id: 'n', status: 'pending' }, A0), '', 'المرفوض لا يمنع');
  assert.match(E.ppCheck(org, {}, { ...x, id: 'n', status: 'pending', amount: 0.1 }, A0), /أصغر/);
});

test('E5.2: المعتمد المالك أو الإدارة المالية فقط', () => {
  const b = { by: 'أحمد', byId: 'u1' };
  assert.equal(E.budCanApprove({ id: 'u9', role: 'accountant', name: 'م' }, b), false, 'محاسب آخر');
  assert.equal(E.budCanApprove({ id: 'u9', role: 'head_office', name: 'م' }, b), false, 'المكتب الرئيسي');
  assert.equal(E.budCanApprove(fin, b), true); assert.equal(E.budCanApprove(own, b), true); assert.equal(E.budCanApprove({ ...fin, id: 'u1' }, b), false);
});
