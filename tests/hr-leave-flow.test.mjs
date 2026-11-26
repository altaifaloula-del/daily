/**
 * v56.13 — تتبع الإجازة بعد الاعتماد، وتوقيع الموظف، ومباشرة العمل (قرارات المالك 2026-11-26):
 * مدير الفرع يسجّل المباشرة ويعتمدها المركز · أيام التأخر تُخصم من رصيد الإجازات · التوقيع إلكتروني بالرمز.
 * الأرقام المتوقعة محسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const lv = (x = {}) => ({ id: 'lv1', employeeId: 'e1', employeeName: 'أحمد', branchId: 'b1', type: 'annual', from: '2026-11-10', to: '2026-11-14', days: 5, status: 'approved', requestedBy: 'خالد', at: '2026-11-01T09:00', decidedBy: 'سارة', decidedAt: '2026-11-02T10:00', ...x });

test('مباشرة العمل: في موعدها ومبكرة ومتأخرة بعدد أيام التأخر', () => {
  assert.deepEqual(E.lvReturnPlan(lv(), '2026-11-15'), { kind: 'ontime', lastDay: '2026-11-14', lateDays: 0, due: '2026-11-15' });
  assert.deepEqual(E.lvReturnPlan(lv(), '2026-11-13'), { kind: 'early', lastDay: '2026-11-12', lateDays: 0, due: '2026-11-15' });
  assert.deepEqual(E.lvReturnPlan(lv(), '2026-11-18'), { kind: 'late', lastDay: '2026-11-14', lateDays: 3, due: '2026-11-15' }, '15 و16 و17');
  assert.match(E.lvReturnPlan(lv(), '2026-11-10').err, /بعد أول يوم/);
  assert.match(E.lvReturnPlan(lv(), 'x').err, /غير صحيح/);
});

test('أيام التأخر تُخصم من الرصيد بعد اعتماد المركز فقط', () => {
  const org = { hrPolicies: {} }; const e = { id: 'e1', hireDate: '2025-01-01' };
  const D = '2026-11-30';
  const base = E.leaveBalance(org, { leaveRequests: [lv()] }, e, D);
  const pend = E.leaveBalance(org, { leaveRequests: [lv({ ret: { date: '2026-11-18', lateDays: 3, status: 'pending' } })] }, e, D);
  const appr = E.leaveBalance(org, { leaveRequests: [lv({ ret: { date: '2026-11-18', lateDays: 3, status: 'approved' } })] }, e, D);
  assert.equal(pend.used, base.used, 'قبل الاعتماد لا خصم'); assert.equal(appr.used, base.used + 3); assert.equal(Math.round((base.balance - appr.balance) * 100) / 100, 3);
  // تأخر بعد إجازة مرضية يُخصم من الرصيد السنوي أيضًا (قرار المالك)
  const sick = E.leaveBalance(org, { leaveRequests: [lv({ type: 'sick', ret: { date: '2026-11-17', lateDays: 2, status: 'approved' } })] }, e, D);
  assert.equal(sick.used, 2);
});

test('تتبع الإجازة بعد الاعتماد: كل مرحلة بمن نفّذها ومتى، والمباشرة المتأخرة تظهر', () => {
  const T = E.lvTrack(lv(), [{ refId: 'lv1', docType: 'leave', status: 'signed', signedAt: '2026-11-01T09:05' }], '2026-11-20');
  assert.deepEqual(T.map(x => x.k + ':' + x.st), ['req:done', 'sign:done', 'dec:done', 'start:done', 'ret:late']);
  assert.equal(T[2].who, 'سارة');
  const T2 = E.lvTrack(lv({ ret: { date: '2026-11-18', kind: 'late', lateDays: 3, byName: 'خالد', at: 'x', status: 'approved', apByName: 'سارة', apAt: 'y' } }), [{ refId: 'lv1', docType: 'leave_return', status: 'pending' }], '2026-11-20');
  assert.deepEqual(T2.slice(2).map(x => x.k + ':' + x.st), ['start:done', 'ret:done', 'rsign:wait', 'rap:done']);
  assert.match(T2.find(x => x.k === 'ret').ar, /متأخرة 3 يوم/);
  assert.deepEqual(E.lvTrack(lv({ status: 'pending' }), [], '2026-11-20').map(x => x.k + ':' + x.st), ['req:done', 'dec:wait']);
});

test('مستند التوقيع: طلب الإجازة وإقرار المباشرة بنص واضح', () => {
  const d1 = E.leaveSignDoc(lv({ reason: 'سفر' }), { id: 'u3', name: 'خالد' }, 'leave');
  assert.equal(d1.docType, 'leave'); assert.equal(d1.refId, 'lv1'); assert.equal(d1.status, 'pending'); assert.equal(d1.month, '2026-11');
  assert.match(E.signDeclaration(d1), /بطلب إجازة سنوية من 2026-11-10 إلى 2026-11-14 \(5 يوم\)/);
  const d2 = E.leaveSignDoc(lv({ ret: { date: '2026-11-18', lateDays: 3, kind: 'late', note: 'ظرف' } }), null, 'leave_return');
  assert.match(E.signDeclaration(d2), /بمباشرتي العمل بتاريخ 2026-11-18.*متأخرًا 3 يوم/);
});
