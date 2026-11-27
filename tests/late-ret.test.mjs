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
  const U = E.lvUnpaidFor(ops, '2026-04'); assert.equal(U.length, 1); assert.equal(U[0].days, 4); assert.equal(U[0].to, '2026-04-29'); assert.equal(U[0].art80, false);
});

test('H1: سجل قديم بلا تقسيم يُخصم كله من الرصيد كما كان، وتنبيه المادة 80 عند 15 يومًا', () => {
  const ops = { leaveRequests: [req(3, '2026-03-14')] }; const b0 = E.leaveBalance(org, { leaveRequests: [req(0, '2026-03-11')] }, emp, '2026-03-30'); const b1 = E.leaveBalance(org, ops, emp, '2026-03-30');
  assert.equal(Math.round((b0.balance - b1.balance) * 100) / 100, 3);
  const U = E.lvUnpaidFor({ leaveRequests: [req(20, '2026-03-31', { lateBal: 5, unpaidDays: 15 })] }, '2026-03'); assert.equal(U[0].art80, true); assert.equal(U[0].from, '2026-03-16');
});
