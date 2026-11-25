/**
 * v53.6 — قيد المبيعات من فواتير نقطة البيع بدل الإغلاق اليومي (قرار المالك 2026-11-25).
 * الإغلاق بيانات تشغيلية؛ قيد لكل فاتورة بضريبتها الفعلية؛ تاريخ سريان لكل فرع؛ معطّل افتراضيًا.
 * كل الأرقام وهمية ومحسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from '../build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const r2 = (x) => Math.round(x * 100) / 100;
const near = (a, b, msg) => assert.ok(Math.abs((a || 0) - b) < 0.011, (msg || '') + ` — المتوقع ${b} والفعلي ${a}`);
const tb = (A) => { const t = {}; A.entries.forEach(e => e.lines.forEach(l => { t[l.code] = r2((t[l.code] || 0) + l.debit - l.credit); })); return t; };
const entry = (A, id) => A.entries.find(e => e.id === id);
const amt = (e, code, side) => r2(e.lines.filter(l => l.code === code).reduce((s, l) => s + l[side], 0));
const branches = [{ id: 'b1', name: 'فرع أ', isActive: true }, { id: 'b2', name: 'فرع ب', isActive: true }];
const apps = [{ id: 'appA', n: 'تطبيق أ', c: 20 }];
const org = (pj, x = {}) => ({ company: { name: 'اختبار' }, branches, deliveryApps: apps, taxCfg: { enabled: true, rate: 15 }, ...(pj ? { posJournal: pj } : {}), ...x });
const PJ = { enabled: true, from: { b1: '2026-03-10' } };
const closing = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'فرع أ', date: '2026-03-10', status: 'approved', cashSales: 115, cardSales: 0,
  deliverySales: [], expenses: [], variance: 0, supplierPayments: [], ...x });
const order = (x = {}) => ({ id: 'o1', no: 'ف1-1', branchId: 'b1', date: '2026-03-10', status: 'paid', total: 115, vat: 15, net: 100, change: 0,
  payments: [{ m: 'cash', amount: 115 }], ...x });

test('معطّل افتراضيًا: بلا إعداد يبقى قيد الإغلاق ولا قيد للفواتير (توافق رجعي)', () => {
  const A = E.buildAccounting(org(null), { closings: [closing()], posOrders: [order()] });
  assert.ok(entry(A, 'rev:c1')); assert.equal(entry(A, 'pos:o1'), undefined);
  const B = E.buildAccounting(org({ enabled: false, from: { b1: '2026-01-01' } }), { closings: [closing()], posOrders: [order()] });
  assert.ok(entry(B, 'rev:c1')); assert.equal(entry(B, 'pos:o1'), undefined, 'الإيقاف يعيد السلوك السابق');
});

test('بعد السريان: لا قيد إيراد من الإغلاق، وقيد للفاتورة بضريبتها الفعلية', () => {
  const A = E.buildAccounting(org(PJ), { closings: [closing()], posOrders: [order({ total: 115, vat: 15, payments: [{ m: 'cash', amount: 50 }, { m: 'card', amount: 65 }] })] });
  assert.equal(entry(A, 'rev:c1'), undefined, 'الإغلاق لا يولّد قيد مبيعات');
  const e = entry(A, 'pos:o1'); assert.ok(e); assert.equal(e.balanced, true); assert.equal(A.balanced, true);
  near(amt(e, '1111', 'debit'), 50, 'صندوق الفرع'); near(amt(e, '1201', 'debit'), 65, 'البنك');
  near(amt(e, '4101', 'credit'), 100); near(amt(e, '2301', 'credit'), 15, 'ضريبة الفاتورة نفسها');
  assert.equal(e.vat.out, 15); assert.equal(e.reg.k, 's');
});

test('ضريبة المخرجات = مجموع ضرائب الفواتير لا الضريبة على مجموع اليوم', () => {
  // 100 فاتورة × 12.99 بضريبة 1.69 لكل فاتورة ← 169.00 (لا 169.43)
  const os = Array.from({ length: 100 }, (_, i) => order({ id: 'o' + i, total: 12.99, vat: 1.69, net: 11.30, payments: [{ m: 'cash', amount: 12.99 }] }));
  const A = E.buildAccounting(org(PJ), { posOrders: os });
  near(-tb(A)['2301'], 169, 'مجموع ضرائب الفواتير'); near(-tb(A)['4101'], 1130); assert.equal(A.balanced, true);
});

test('قبل تاريخ السريان والفروع بلا تاريخ تبقى على قيد الإغلاق', () => {
  const ops = { closings: [closing({ id: 'c0', date: '2026-03-09' }), closing({ id: 'c2', branchId: 'b2', branchName: 'فرع ب' })],
    posOrders: [order({ id: 'oa', date: '2026-03-09' }), order({ id: 'ob', branchId: 'b2' })] };
  const A = E.buildAccounting(org(PJ), ops);
  assert.ok(entry(A, 'rev:c0'), 'إغلاق قبل التاريخ'); assert.ok(entry(A, 'rev:c2'), 'فرع بلا تاريخ');
  assert.equal(entry(A, 'pos:oa'), undefined); assert.equal(entry(A, 'pos:ob'), undefined);
});

test('عجز الصندوق ومصروفات الوردية وسداد الموردين تبقى من الإغلاق بعد السريان', () => {
  const A = E.buildAccounting(org(PJ), { closings: [closing({ variance: -5, expenses: [{ id: 'x1', amount: 30, paymentMethod: 'cash' }],
    supplierPayments: [{ id: 'p1', cash: 40 }] })], posOrders: [order()] });
  assert.ok(entry(A, 'cashvar:c1')); assert.ok(entry(A, 'exp:c1:x1')); assert.ok(entry(A, 'spay:c1:p1'));
  near(tb(A)['1111'], 115 - 5 - 30 - 40, 'الصندوق = الفاتورة − العجز − المصروف − السداد'); assert.equal(A.balanced, true);
});

test('الباقي المردود يُطرح من النقد، والتطبيق صافٍ في ذممه مع العمولة، والآجل في 1380', () => {
  const A = E.buildAccounting(org(PJ), { posOrders: [
    order({ id: 'oc', payments: [{ m: 'cash', amount: 200 }], change: 85 }),
    order({ id: 'oa', total: 230, vat: 30, net: 200, payments: [{ m: 'app', appId: 'appA', amount: 230 }] }),
    order({ id: 'od', payments: [{ m: 'deferred', amount: 115 }] })] });
  const c = entry(A, 'pos:oc'); near(amt(c, '1111', 'debit'), 115); assert.equal(c.balanced, true);
  const a = entry(A, 'pos:oa'); near(amt(a, '1301', 'debit'), 184, '230 − عمولة 46'); near(amt(a, '5301', 'debit'), 46); assert.equal(a.balanced, true);
  const d = entry(A, 'pos:od'); near(amt(d, '1380', 'debit'), 115); assert.equal(d.balanced, true);
});

test('المرتجع يعكس الفاتورة، والملغاة لا قيد لها', () => {
  const A = E.buildAccounting(org(PJ), { posOrders: [order(),
    order({ id: 'r1', kind: 'return', refNo: 'ف1-1', total: -115, vat: -15, net: -100, payments: [{ m: 'cash', amount: -115 }] }),
    order({ id: 'v1', status: 'void' })] });
  const r = entry(A, 'pos:r1'); assert.ok(r); assert.equal(r.balanced, true);
  near(amt(r, '4101', 'debit'), 100); near(amt(r, '2301', 'debit'), 15); near(amt(r, '1111', 'credit'), 115);
  assert.equal(r.vat.out, -15); assert.equal(entry(A, 'pos:v1'), undefined);
  const t = tb(A); near(t['4101'] || 0, 0); near(t['2301'] || 0, 0); near(t['1111'] || 0, 0);
});

test('وسيط الشبكة يسري على فواتير نقطة البيع كما على الإغلاق', () => {
  const A = E.buildAccounting(org(PJ, { posClearing: { enabled: true, from: '2026-03' } }), { posOrders: [order({ payments: [{ m: 'card', amount: 115 }] })] });
  const e = entry(A, 'pos:o1'); near(amt(e, '1801', 'debit'), 115, 'الشبكة إلى الوسيط'); assert.equal(e.balanced, true);
});

test('فاتورة مبيعات «مسجلة في الإغلاق» لا قيد لها قبل السريان ولا بعده (الخيار ممنوع للفروع السارية — قرار المالك)', () => {
  const si = { id: 's1', no: 'INV-1', date: '2026-03-10', branchId: 'b1', inClosing: true, total: 115, net: 100, vat: 15, fund: '1201' };
  assert.equal(entry(E.buildAccounting(org(PJ), { salesInvoices: [si] }), 'si:s1'), undefined);
  assert.equal(entry(E.buildAccounting(org(PJ), { salesInvoices: [{ ...si, date: '2026-03-09' }] }), 'si:s1'), undefined);
});
test('عمولة التطبيق: النسبة المحفوظة على الفاتورة وقت البيع تغلب الإعداد الحالي (لا أثر رجعي)', () => {
  const o = order({ id: 'oa', total: 230, vat: 30, net: 200, payments: [{ m: 'app', appId: 'appA', amount: 230, commPct: 20 }] });
  const A = E.buildAccounting(org(PJ, { deliveryApps: [{ id: 'appA', n: 'تطبيق أ', c: 25 }] }), { posOrders: [o] });
  const e = entry(A, 'pos:oa'); near(amt(e, '5301', 'debit'), 46, '20% المحفوظة لا 25% الحالية'); assert.equal(e.balanced, true);
});

test('فاتورة بلا دفعات (بيانات تالفة) لا تولّد قيدًا غير متوازن', () => {
  const A = E.buildAccounting(org(PJ), { posOrders: [order({ payments: [] })] });
  assert.equal(entry(A, 'pos:o1'), undefined); assert.equal(A.balanced, true);
});

test('posJeOn: معطّل افتراضيًا، ولكل فرع تاريخه', () => {
  assert.equal(E.posJeOn({}, 'b1', '2026-03-10'), false);
  assert.equal(E.posJeOn(org(PJ), 'b1', '2026-03-09'), false); assert.equal(E.posJeOn(org(PJ), 'b1', '2026-03-10'), true);
  assert.equal(E.posJeOn(org(PJ), 'b2', '2026-03-10'), false); assert.equal(E.posJeOn(org({ enabled: false, from: { b1: '2026-01-01' } }), 'b1', '2026-03-10'), false);
});

test('posCloseDiff: يكشف فرق الإغلاق عن نقطة البيع (نقد/شبكة/تحويل/تطبيقات) ويطابق عند التساوي', () => {
  const os = [order({ payments: [{ m: 'cash', amount: 50 }, { m: 'card', amount: 65 }] }), order({ id: 'o2', total: 230, vat: 30, payments: [{ m: 'app', appId: 'appA', amount: 230 }] })];
  const ok = E.posCloseDiff(os, closing({ cashSales: 50, cardSales: 65, deliverySales: [{ appId: 'appA', amount: 230 }] }));
  assert.equal(ok.ok, true);
  const bad = E.posCloseDiff(os, closing({ cashSales: 30, cardSales: 65, deliverySales: [] }));
  assert.equal(bad.ok, false); near(bad.cash, -20); near(bad.apps, 230);
});

test('الأرشفة لا تشمل فواتير الفروع السارية (الدفاتر تقرؤها) — قرار المالك', () => {
  const g = org({ enabled: true, from: { b1: '2024-01-01' } }, { periodLocks: { lockedThrough: '2024-12' } });
  const ops = { posOrders: [order({ id: 'a1', date: '2024-03-01' }), order({ id: 'a2', branchId: 'b2', date: '2024-03-01' })] };
  const P = E.archivePlan(g, ops, { today: '2026-03-10' });
  assert.equal(P.journaled, 1); assert.equal(P.n, 1, 'فاتورة الفرع غير الساري فقط');
});
