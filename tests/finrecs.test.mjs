/* v54.2 — المرحلة 3: محرك التوصيات — توصيات بأدلة وأثر متوقع بطريقة معلنة، عدم التكرار، والأثر الفعلي بعد فترة القياس فقط */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const J = (id, date, lines, extra = {}) => ({ id, date, title: id, status: 'posted', lines: lines.map(([code, debit, credit]) => ({ code, debit, credit })), ...extra });
const org = { taxCfg: { enabled: true, rate: 15 }, suppliers: [{ id: 's1', name: 'مكين', vatNo: '311135091100003' }, { id: 's2', name: 'صغير', vatNo: '' }] };
const inv = (id, sid, name, amt, date, x) => ({ id, kind: 'svc', supplierId: sid, supplierName: name, invoiceNo: id, amount: amt, vatAmt: Math.round(amt / 1.15 * 0.15 * 100) / 100, date, dueDate: date, expLines: [{ accCode: '5198', net: amt, vat: 0 }], ...x });
const ops = { invoices: [inv('i1', 's1', 'مكين', 80000, '2026-03-05'), inv('i2', 's2', 'صغير', 11500, '2026-03-06')],
  journalManual: [J('u1', '2026-02-10', [['5201', 4000, 0], ['1101', 0, 4000]]), J('u2', '2026-03-10', [['5201', 9000, 0], ['1101', 0, 9000]])] };
const opts = { from: '2026-03-01', to: '2026-03-31', today: '2026-04-01' };

test('التوصيات: تركّز مورد، نمو مصروف، ضريبة غير قابلة للخصم — كلها بدليل وطريقة حساب', () => {
  const R = E.finRecs(org, ops, opts); const k = Object.fromEntries(R.recs.map(r => [r.kind, r]));
  const sc = k.supplier_concentration; assert.ok(sc); assert.match(sc.title, /مكين/); assert.equal(sc.risk, 'high');
  assert.equal(sc.expected, Math.round(80000 * 365 / 31 * 0.02 * 100) / 100); assert.match(sc.method, /تقدير لا نتيجة/);
  const eg = k.expense_growth; assert.ok(eg); assert.equal(eg.metric.code, '5201'); assert.equal(eg.expected, 2500); assert.match(eg.evidence, /9000|9,000/); assert.match(eg.cause, /^فرضية/);
  const vr = k.vat_recovery; assert.ok(vr); assert.equal(vr.expected, 1500); assert.equal(vr.dept, 'tax');
  for (const r of R.recs) for (const f of ['key', 'title', 'problem', 'evidence', 'cause', 'solution', 'method', 'risk', 'priority', 'dept', 'due']) assert.ok(r[f] != null && r[f] !== '', r.kind + ':' + f);
  assert.equal(new Set(R.recs.map(r => r.key)).size, R.recs.length, 'لا تكرار');
});

test('الأثر الفعلي: لا يُحسب قبل الإنجاز ولا قبل اكتمال فترة القياس، ثم يُقاس من الدفاتر', () => {
  const R = E.finRecs(org, ops, opts); const eg = R.recs.find(r => r.kind === 'expense_growth');
  const act = E.newAction({ name: 'م' }, { src: 'rec', srcKey: eg.key, title: eg.title, rec: eg.kind, expected: { amount: eg.expected, method: eg.method }, recMetric: { ...eg.metric } });
  assert.equal(act.approval, 'pending'); assert.equal(act.expected.amount, 2500);
  assert.equal(E.recRealized(org, ops, act, { today: '2026-04-05' }).state, 'not_done');
  const done = { ...act, status: 'done', doneAt: '2026-04-01T10:00:00Z' };
  assert.equal(E.recRealized(org, ops, done, { today: '2026-04-15' }).state, 'measuring');
  const ops2 = { ...ops, journalManual: [...ops.journalManual, J('u3', '2026-04-10', [['5201', 6000, 0], ['1101', 0, 6000]])] };
  const m = E.recRealized(org, ops2, done, { today: '2026-05-05' }); assert.equal(m.state, 'measured'); assert.equal(m.after, 6000); assert.equal(m.actual, 3000);
});

test('لا توصيات مختلقة على دفاتر هادئة', () => {
  const R = E.finRecs(org, { invoices: [inv('i9', 's1', 'مكين', 500, '2026-03-05')] }, opts);
  assert.equal(R.recs.filter(r => r.kind !== 'vat_recovery').length, 0);
});
