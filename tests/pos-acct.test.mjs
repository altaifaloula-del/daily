/**
 * v56.7 — MUKTASAB POS الدفعة 6a: الأثر المحاسبي لفواتير نقطة البيع في قيد الإغلاق (قرارات المالك 2026-11-26).
 * الضريبة من الفواتير؛ الخصومات في 4104 والمبيعات بالإجمالي؛ الولاء التزام 2401 = النقاط × قيمة النقطة بلا ضريبة.
 * معطّل افتراضيًا — والقيد كما كان.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

let E = null, why = '';
try { const { buildEngine } = await import('./build-engine.mjs'); E = await buildEngine(); }
catch (e) { why = 'تعذّر بناء المحرك (npm ci): ' + String(e.message || e).split('\n')[0]; }
const run = (name, fn) => test(name, { skip: E ? false : why }, fn);

const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع', isActive: true }], taxCfg: { enabled: true, rate: 15 },
  loyaltyCfg: { enabled: true, ptValue: 0.5 }, ...x });
const closing = (tot, x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'فرع', date: '2026-03-10', status: 'approved', totalRevenue: tot, cashSales: tot, cardSales: 0,
  deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, actualCashCount: tot, expectedCashInSafe: tot, transferredToMainTreasury: 0, supplierPayments: [], ...x });
// فاتورة 115 شاملة: إجمالي 138، خصم 23 منها 11.5 استبدال نقاط؛ اكتسب 10 نقاط
const sale = { id: 'o1', branchId: 'b1', date: '2026-03-10', status: 'paid', gross: 138, disc: 23, total: 115, vat: 15, net: 100, rate: 15,
  loyalty: { phone: '0500000000', earned: 10, redeemed: 23, redeemAmt: 11.5 } };
const rev = (A) => A.entries.find(e => e.id === 'rev:c1');
const ln = (e, code) => e.lines.filter(l => l.code === code).reduce((a, l) => ({ dr: a.dr + l.debit, cr: a.cr + l.credit }), { dr: 0, cr: 0 });

run('الملخص: الخصم بلا الاستبدال، والاستبدال والاكتساب بلا ضريبة', () => {
  const S = E.posAcctSummary([sale, { ...sale, id: 'v', status: 'void' }, { ...sale, id: 'x', branchId: 'b2' }], 'b1', '2026-03-10', 0.5);
  assert.deepEqual(S, { n: 1, total: 115, vat: 15, discX: 10, redeemX: 10, earnX: 4.35 });
});

run('معطّل افتراضيًا: القيد بالنسبة الثابتة كما كان، بلا 4104 ولا 2401', () => {
  const A = E.buildAccounting(org(), { closings: [closing(115)], posOrders: [sale] });
  const e = rev(A); assert.equal(e.posAcct, undefined);
  assert.deepEqual(ln(e, '4101'), { dr: 0, cr: 100 }); assert.deepEqual(ln(e, '2301'), { dr: 0, cr: 15 });
  assert.equal(e.lines.some(l => l.code === '4104' || l.code === '2401'), false);
});

run('مفعّل: الضريبة من الفاتورة، 4104 مدين بالخصم، 2401 بالاكتساب والاستبدال، والمبيعات بالإجمالي — متوازن بالهللة', () => {
  const A = E.buildAccounting(org({ posAcct: { on: true } }), { closings: [closing(115)], posOrders: [sale] });
  const e = rev(A); assert.equal(e.posAcct, 'pos');
  assert.deepEqual(ln(e, '2301'), { dr: 0, cr: 15 });
  assert.deepEqual(ln(e, '4104'), { dr: 10, cr: 0 });
  assert.deepEqual(ln(e, '2401'), { dr: 10, cr: 4.35 });
  assert.deepEqual(ln(e, '4101'), { dr: 0, cr: 115.65 });
  assert.equal(e.halDiff, 0); assert.equal(e.balanced, true);
  assert.ok(A.accounts.some(a => a.code === '4104') && A.accounts.some(a => a.code === '2401'));
});

run('مفعّل: إغلاق لا يساوي إجمالي الفواتير يبقى بالنسبة الثابتة؛ واللقطة المحفوظة تُقدَّم على الفواتير', () => {
  const A = E.buildAccounting(org({ posAcct: { on: true } }), { closings: [closing(200)], posOrders: [sale] });
  assert.equal(rev(A).posAcct, 'formula'); assert.equal(rev(A).lines.some(l => l.code === '4104'), false);
  const snap = { n: 1, total: 115, vat: 14, discX: 0, redeemX: 0, earnX: 0 };
  const B = E.buildAccounting(org({ posAcct: { on: true } }), { closings: [closing(115, { posFilled: { acct: snap } })], posOrders: [sale] });
  assert.deepEqual(ln(rev(B), '2301'), { dr: 0, cr: 14 }, 'اللقطة عند التعبئة هي المرجع');
  assert.equal(rev(B).balanced, true);
});

run('المرتجع: يخفض الإيراد والضريبة، وخصم نقاطه يخفض الالتزام', () => {
  const ret = { id: 'r1', kind: 'return', branchId: 'b1', date: '2026-03-10', status: 'paid', total: -23, vat: -3, net: -20, rate: 15, disc: 0, loyalty: { phone: '0500000000', ded: 2 } };
  const S = E.posAcctSummary([sale, ret], 'b1', '2026-03-10', 0.5);
  assert.equal(S.total, 92); assert.equal(S.vat, 12); assert.equal(S.earnX, 3.48);   // (10 − 2) × 0.5 ÷ 1.15
  const A = E.buildAccounting(org({ posAcct: { on: true } }), { closings: [closing(92)], posOrders: [sale, ret] });
  assert.equal(rev(A).posAcct, 'pos'); assert.equal(rev(A).balanced, true); assert.equal(rev(A).halDiff, 0);
});
