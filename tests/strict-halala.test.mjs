/**
 * v56.7 — MUKTASAB FINANCE C4 (A2): التطابق التام بالهللات.
 * القيد متوازن فقط إذا تساوى مجموع الهللات في الجانبين ولم يحمل سطر كسرًا أدق من الهللة — عند تفعيل org.finStrict.on.
 * معطّل افتراضيًا: السلوك السابق (سماح 0.01) لا يتغير.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

let E = null, why = '';
try { const { buildEngine } = await import('./build-engine.mjs'); E = await buildEngine(); }
catch (e) { why = 'تعذّر بناء المحرك (npm ci): ' + String(e.message || e).split('\n')[0]; }
const run = (name, fn) => test(name, { skip: E ? false : why }, fn);

const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع', isActive: true }], ...x });
const je = (id, lines) => ({ id, date: '2026-03-06', title: id, lines: lines.map(([code, debit, credit]) => ({ code, debit, credit })) });
const ent = (A, id) => A.entries.find(e => (e.title || '') === id);

run('الهللة: تحويل دقيق وكشف الكسر الأدق', () => {
  assert.equal(E.toHal(10.1), 1010); assert.equal(E.toHal(0.1 + 0.2), 30); assert.equal(E.toHal(-2.5), -250);
  assert.equal(E.isHal(13.04), true); assert.equal(E.isHal(0.1 + 0.2), true); assert.equal(E.isHal(33.335), false);
  assert.equal(E.finStrictOn(org()), false); assert.equal(E.finStrictOn(org({ finStrict: { on: true } })), true);
});

run('معطّل افتراضيًا: فرق 0.005 يبقى متوازنًا كما كان، والتشخيص يكشفه', () => {
  const ops = { journalManual: [je('ok', [['5901', 25, 0], ['1201', 0, 25]]), je('tiny', [['5901', 10.005, 0], ['1201', 0, 10]])] };
  const A = E.buildAccounting(org(), ops);
  assert.equal(A.strictHal, false);
  assert.equal(ent(A, 'tiny').balanced, true, 'السلوك السابق محفوظ');
  assert.equal(ent(A, 'ok').halDiff, 0); assert.equal(ent(A, 'ok').subHal, 0);
  assert.equal(ent(A, 'tiny').subHal, 1, 'السطر بكسر أدق من الهللة مكشوف');
  assert.equal(A.halIssues, 1);
});

run('مفعّل: قيد بفرق هللة أو بكسر أدق غير متوازن، والسليم متوازن، والميزان يتبع', () => {
  const good = je('ok', [['5901', 0.1, 0], ['5901', 0.2, 0], ['1201', 0, 0.3]]);   // 0.1+0.2 العائم ≠ 0.3 حرفيًا لكنه 30 هللة تمامًا
  const A1 = E.buildAccounting(org({ finStrict: { on: true } }), { journalManual: [good] });
  assert.equal(A1.strictHal, true); assert.equal(ent(A1, 'ok').balanced, true); assert.equal(A1.balanced, true);
  const A2 = E.buildAccounting(org({ finStrict: { on: true } }), { journalManual: [good, je('cent', [['5901', 10.01, 0], ['1201', 0, 10]])] });
  assert.equal(ent(A2, 'cent').halDiff, 1); assert.equal(ent(A2, 'cent').balanced, false); assert.equal(A2.balanced, false);
  const A3 = E.buildAccounting(org({ finStrict: { on: true } }), { journalManual: [je('frac', [['5901', 10.004, 0], ['1201', 0, 10.004]])] });
  assert.equal(ent(A3, 'frac').halDiff, 0, 'متساويان بالهللات بعد التقريب'); assert.equal(ent(A3, 'frac').balanced, false, 'لكن الكسر الأدق يُرفض');
});

run('القيود الآلية من إغلاق معتمد متطابقة بالهللة (لا أثر لتفعيل المفتاح عليها)', () => {
  const c = { id: 'c1', branchId: 'b1', branchName: 'فرع', date: '2026-03-10', status: 'approved', totalRevenue: 1000, cashSales: 600, cardSales: 400,
    deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, actualCashCount: 600, expectedCashInSafe: 600, transferredToMainTreasury: 0, supplierPayments: [] };
  const A = E.buildAccounting(org({ taxCfg: { enabled: true, rate: 15 }, finStrict: { on: true } }), { closings: [c] });
  const bad = A.entries.filter(e => !e.balanced).map(e => e.title + ' ' + e.halDiff + '/' + e.subHal);
  assert.deepEqual(bad, [], 'قيود الإغلاق بالضريبة (1000 ÷ 1.15) يجب أن تُقرَّب سطورها إلى الهللة');
});
