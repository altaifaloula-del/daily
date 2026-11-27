/**
 * v56.44 — الدفعة 9 (قرار المجلس H1): التأخر عن المباشرة — من الرصيد بقدر المتاح، والباقي غياب بلا أجر بلا خصم آلي، وتنبيه المادة 80.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const emp = { id: 'e1', name: 'سعد', hireDate: '2025-01-01', basic: 3000 };
const org = { company: { name: 'اختبار' }, employees: [emp], lateRet: { unpaid: true } };
const req = (lateDays, retDate, x = {}) => ({ id: 'r1', employeeId: 'e1', employeeName: 'سعد', branchName: 'العليا', type: 'annual', from: '2026-03-01', to: '2026-03-10', days: 10, status: 'approved',
  ret: { date: retDate, kind: 'late', lateDays, status: 'approved', ...x } });

test('H1: بلا تفعيل كما كان — كل التأخر من الرصيد', () => {
  const r = req(5, '2026-03-16'); assert.deepEqual(E.lvLateSplit({ ...org, lateRet: {} }, { leaveRequests: [] }, emp, r), { lateBal: 5, unpaidDays: 0 });
  assert.equal(E.lrUnpaidOn({}), false);
});

test('H1: مع التفعيل — من الرصيد بقدر المتاح والباقي بلا أجر، والرصيد لا يصير سالبًا', () => {
  const base = req(0, '2026-04-30'); const ops0 = { leaveRequests: [{ ...base, ret: undefined }] };
  const b = E.leaveBalance(org, ops0, emp, '2026-04-30'); assert.ok(b.ok); const avail = Math.floor(b.balance); assert.ok(avail > 0);
  const r = req(avail + 4, '2026-04-30'); const sp = E.lvLateSplit(org, ops0, emp, r); assert.deepEqual(sp, { lateBal: avail, unpaidDays: 4 });
  const ops = { leaveRequests: [{ ...r, ret: { ...r.ret, ...sp } }] };
  const b2 = E.leaveBalance(org, ops, emp, '2026-04-30'); assert.ok(b2.balance >= 0 && b2.balance < 1, 'لا رصيد سالب بسبب التأخر');
  const U = E.lvUnpaidFor(ops, '2026-04'); assert.equal(U.length, 1); assert.equal(U[0].days, 4); assert.equal(U[0].to, '2026-04-29'); assert.equal(U[0].art80, '', 'أقل من حد الإنذار');
});

test('H1: سجل قديم بلا تقسيم يُخصم كله من الرصيد كما كان، وتنبيه المادة 80 عند 15 يومًا', () => {
  const ops = { leaveRequests: [req(3, '2026-03-14')] }; const b0 = E.leaveBalance(org, { leaveRequests: [req(0, '2026-03-11')] }, emp, '2026-03-30'); const b1 = E.leaveBalance(org, ops, emp, '2026-03-30');
  assert.equal(Math.round((b0.balance - b1.balance) * 100) / 100, 3);
  const U = E.lvUnpaidFor({ leaveRequests: [req(20, '2026-03-31', { lateBal: 5, unpaidDays: 15 })] }, '2026-03'); assert.equal(U[0].art80, 'warn', '15 يومًا متصلة: إنذار، ولا يتجاوز حد الفصل'); assert.equal(U[0].from, '2026-03-16');
});

test('H1 (الجودة): الأيام داخل الشهر لا الإجمالي، وتصفية الفروع، والرصيد غير المعروف كما كان، وحدود المادة 80', () => {
  const r = { ...req(55, '2026-05-05', { lateBal: 5, unpaidDays: 50 }), branchId: 'b1' };   // بلا أجر من 2026-03-16 إلى 2026-05-04
  const ops = { leaveRequests: [r] };
  const m3 = E.lvUnpaidFor(ops, '2026-03')[0], m4 = E.lvUnpaidFor(ops, '2026-04')[0], m5 = E.lvUnpaidFor(ops, '2026-05')[0];
  assert.deepEqual([m3.daysInMonth, m4.daysInMonth, m5.daysInMonth], [16, 30, 4], 'المجموع 50 موزعًا على الأشهر'); assert.equal(m3.days, 50);
  assert.equal(m3.art80, 'exceed');
  assert.deepEqual(E.lvUnpaidFor(ops, '2026-04', ['b2']), [], 'فرع آخر لا يرى'); assert.equal(E.lvUnpaidFor(ops, '2026-04', ['b1']).length, 1);
  const w = E.lvUnpaidFor({ leaveRequests: [req(12, '2026-03-23', { lateBal: 0, unpaidDays: 12 })] }, '2026-03')[0]; assert.equal(w.art80, 'warn', '10 أيام متصلة: إنذار');
  assert.match(E.lvArt80Txt(w), /الإنذار الكتابي/);
  const noHire = { ...emp, hireDate: '' }; assert.deepEqual(E.lvLateSplit({ ...org, employees: [noHire] }, { leaveRequests: [] }, noHire, req(4, '2026-03-15')), { lateBal: 4, unpaidDays: 0 }, 'رصيد غير معروف ⇒ كما كان');
});
