/**
 * v56.20 — MUKTASAB FINANCE E2: قائمة مهام الإقفال الشهري (قرار المالك: فشل فحص آلي يمنع قفل الشهر).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, ...x });
const allTasks = (m, ap = true) => ['cash', 'bank', 'apps', 'stock', 'vat'].map(k => ({ id: k, month: m, key: k, doneBy: 'أ', doneById: 'u1', doneAt: 'x', ...(ap ? { apBy: 'ب', apById: 'u2', apAt: 'y' } : {}) }));

test('الفحوص الآلية: مسودة ومرفوع غير مدقق وقيد يدوي معلّق ورصيد 9999', () => {
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-10-05', status: 'draft' }, { id: 'c2', branchId: 'b1', date: '2026-10-06', status: 'submitted', cashSales: 100 }],
    journalManual: [{ id: 'j', date: '2026-10-07', status: 'pending', lines: [] }, { id: 'k', date: '2026-10-08', lines: [{ code: '9999', debit: 50, credit: 0 }, { code: '1101', debit: 0, credit: 50 }] }] };
  const A = E.buildAccounting(org(), ops);
  const C = E.closeAutoChecks(A, ops, '2026-10'); const m = Object.fromEntries(C.map(c => [c.k, c]));
  assert.equal(m.drafts.n, 1); assert.equal(m.pending.n, 1); assert.equal(m.pj.n, 1); assert.equal(m.susp.amt, 50); assert.equal(m.unb.ok, true);
  assert.equal(E.closeAutoChecks(E.buildAccounting(org(), {}), {}, '2026-10').every(c => c.ok), true);
});

test('القفل: معطّلة ⇒ لا منع · مفعّلة ⇒ يمنع فشل الفحص ويمنع المهمة غير المعتمدة · كل شهر غير مقفل حتى الهدف', () => {
  const ok = { closeTasks: [...allTasks('2026-10'), ...allTasks('2026-11')] };
  const A = E.buildAccounting(org(), ok);
  assert.equal(E.closeLockBlock(org(), A, ok, '2026-11', '2026-09'), '', 'معطّلة');
  const on = org({ closeList: { on: true, from: '2026-10' } });
  assert.equal(E.closeLockBlock(on, A, ok, '2026-11', '2026-09'), '', 'كل شيء مكتمل');
  const half = { closeTasks: [...allTasks('2026-10'), ...allTasks('2026-11', false)] };
  assert.match(E.closeLockBlock(on, A, half, '2026-11', '2026-09'), /^2026-11: مهام غير معتمدة/);
  const bad = { ...ok, closings: [{ id: 'c', branchId: 'b1', date: '2026-10-03', status: 'draft' }] };
  assert.match(E.closeLockBlock(on, E.buildAccounting(on, bad), bad, '2026-11', '2026-09'), /^2026-10: لا إغلاقات مسودة/);
  assert.equal(E.closeLockBlock(on, A, { closeTasks: allTasks('2026-11') }, '2026-11', '2026-10'), '', 'المقفل سابقًا لا يُعاد فحصه');
  assert.equal(E.closeLockBlock(org({ closeList: { on: true, from: '2026-11' } }), A, { closeTasks: allTasks('2026-11') }, '2026-11', '2026-09'), '', 'ما قبل تاريخ التفعيل لا يُشترط');
});

test('حالة المهام اليدوية: لم تبدأ ← منجزة ← معتمدة', () => {
  const S = E.closeManualState({ closeTasks: [{ month: '2026-10', key: 'cash', doneBy: 'أ' }, { month: '2026-10', key: 'bank', doneBy: 'أ', apAt: 'z' }] }, '2026-10');
  assert.deepEqual(S.map(x => x.st), ['done', 'approved', 'todo', 'todo', 'todo']);
});
