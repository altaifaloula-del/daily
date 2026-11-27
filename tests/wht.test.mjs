/**
 * v56.47 (E7) — ضريبة الاستقطاع على المدفوعات لغير المقيمين (docs/finance/04-PHASE-E-ANALYSIS.md §البند 4).
 * الأرقام وهمية ومحسوبة يدويًا: خدمة 10,000 لمورد غير مقيم بنسبة 5% (نوع أدخله المحاسب ووسمه «أكّده المختص» — لا نسبة في الكود).
 * السداد: مدين 2101 10,000 / دائن البنك 9,500 / دائن 2107 500، وذمة المورد تنخفض 10,000 (العقد بالإجمالي).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const r2 = (n) => Math.round(n * 100) / 100;
const tb = (A) => { const t = {}; A.entries.forEach(e => e.lines.forEach(l => { t[l.code] = r2((t[l.code] || 0) + l.debit - l.credit); })); return t; };
const sumDr = (A) => r2(A.entries.reduce((a, e) => a + e.lines.reduce((s, l) => s + l.debit, 0), 0));
const sumCr = (A) => r2(A.entries.reduce((a, e) => a + e.lines.reduce((s, l) => s + l.credit, 0), 0));
const D = '2026-03-10';
const ME = { name: 'محاسب تجريبي', role: 'finance_department', id: 'u1' };
const T5 = { id: 'wt1', name: 'خدمات فنية (تجريبي)', rate: 5, ok: true };
const TX = { id: 'wt2', name: 'نوع لم يؤكَّد', rate: 15, ok: false };
const sup = (x = {}) => ({ id: 's1', code: 'S-1', name: 'مورد خارجي تجريبي', nonResident: true, country: 'دولة تجريبية', whtType: 'wt1', ...x });
const sup2 = { id: 's2', code: 'S-2', name: 'مورد محلي تجريبي' };
const org = (x = {}) => ({ company: { name: 'منشأة اختبار' }, branches: [{ id: 'b1', name: 'فرع 1', isActive: true }], suppliers: [sup(), sup2], wht: { on: true, types: [T5, TX] }, ...x });
const inv = (x = {}) => ({ id: 'i1', supplierId: 's1', supplierName: 'مورد خارجي تجريبي', invoiceNo: 'INV-1', date: '2026-03-01', amount: 10000, vatAmt: 0, branchId: 'b1', source: 'stored', kind: 'svc', expLines: [{ desc: 'خدمة', accCode: '5198', net: 10000, vat: 0 }], ...x });
const pv = (x = {}) => ({ id: 'cv1', kind: 'pv', date: D, amount: 10000, note: '', by: ME.name, at: D + 'T10:00:00Z', fund: '1201', pm: 'bank', party: { t: 'sup', key: 'sup:s1', name: 'مورد خارجي تجريبي' }, ...x });
const pay = (o, ops, v, type) => { const r = E.whtApply(o, v, type); if (r.err) return r; return { next: E.applyCashVoucher(ops, { ...r.v, no: 'PV-000001' }, ME), v: r.v }; };
const supBal = (o, ops, key) => r2((E.buildPartners(o, ops).find(p => p.key === key) || {}).balance || 0);

test('بلا تفعيل: السند كما كان حرفيًا — لا حقول ولا 2107 ولا تغيّر في القيد', () => {
  const off = org({ wht: undefined });
  const r = E.whtApply(off, pv(), 'wt1'); assert.deepEqual(r.v, pv(), 'السند نفسه بلا حقول');
  const ops = E.applyCashVoucher({ cashVouchers: [] }, { ...pv(), no: 'PV-000001' }, ME);
  const A = E.buildAccounting(off, ops);
  assert.equal(A.accounts.some(a => a.code === '2107'), false, 'لا حساب 2107');
  const e = A.entries.find(x => x.id === 'cv:cv1'); assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['2101', 10000, 0], ['1201', 0, 10000]]);
  assert.equal(E.whtPayBlock(off, 's1'), '', 'لا منع لمسارات السداد الأخرى');
  // التخصيص على فاتورة: الدفعة بلا حقل wht والقيد بطرفين كما كان
  const ops2 = E.applyCashVoucher({ invoices: [inv()], cashVouchers: [] }, { ...pv({ alloc: [{ id: 'i1', no: 'INV-1', amount: 10000 }] }), no: 'PV-000001' }, ME);
  assert.equal('wht' in ops2.invoices[0].payments[0], false);
  const ep = E.buildAccounting(off, ops2).entries.find(x => x.id.startsWith('invp:i1')); assert.deepEqual(ep.lines.map(l => [l.code, l.debit, l.credit]), [['2101', 10000, 0], ['1201', 0, 10000]]);
  // الطباعة: سند بلا استقطاع لا يتغير
  assert.equal(E.cashVoucherHtml(off, { ...pv(), no: 'PV-1' }).includes('الاستقطاع'), false);
});

test('سند 10,000 بنسبة 5% على الحساب: مدين 2101 10,000 / دائن البنك 9,500 / دائن 2107 500 — وذمة المورد تنخفض 10,000', () => {
  const o = org(); const base = { invoices: [inv()], cashVouchers: [] };
  const r = pay(o, base, pv(), 'wt1'); assert.ok(!r.err, r.err);
  assert.deepEqual([r.v.whtType, r.v.whtRate, r.v.whtAmt, r.v.whtCountry], ['wt1', 5, 500, 'دولة تجريبية']);
  const A = E.buildAccounting(o, r.next);
  assert.ok(A.accounts.some(a => a.code === '2107' && a.kind === 'liab'), 'الحساب 2107 في الدليل');
  const e = A.entries.find(x => x.id === 'cv:cv1');
  assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['2101', 10000, 0], ['1201', 0, 9500], ['2107', 0, 500]]);
  assert.equal(sumDr(A), sumCr(A), 'الميزان متوازن');
  assert.equal(Math.abs(supBal(o, base, 'sup:s1')), 10000, 'قبل السداد: علينا 10,000');
  assert.equal(supBal(o, r.next, 'sup:s1'), 0, 'بعد السداد: الذمة سُدّدت بالإجمالي');
  const t = tb(A); assert.equal(t['2107'], -500); assert.equal(t['1201'], -9500); assert.equal(t['2101'], 0);
  // الطباعة: الإجمالي والاستقطاع والصافي
  const h = E.cashVoucherHtml(o, { ...r.v, no: 'PV-000001' }); assert.ok(h.includes('المبلغ الإجمالي') && h.includes('ضريبة الاستقطاع') && h.includes('الصافي المدفوع') && h.includes('9,500'));
});

test('السند الموزَّع على فاتورة: قيد السداد يحمل الاستقطاع (والمجموع كما هو) — ومقسَّم بين فاتورة وباقٍ على الحساب بالهللة', () => {
  const o = org();
  const r = pay(o, { invoices: [inv()], cashVouchers: [] }, pv({ alloc: [{ id: 'i1', no: 'INV-1', amount: 10000 }] }), 'wt1');
  assert.equal(r.next.invoices[0].payments[0].wht, 500);
  const A = E.buildAccounting(o, r.next);
  const ep = A.entries.find(x => x.id.startsWith('invp:i1'));
  assert.deepEqual(ep.lines.map(l => [l.code, l.debit, l.credit]), [['2101', 10000, 0], ['1201', 0, 9500], ['2107', 0, 500]]);
  assert.equal(A.entries.some(x => x.id === 'cv:cv1'), false, 'لا باقٍ على الحساب');
  assert.equal(supBal(o, r.next, 'sup:s1'), 0); assert.equal(sumDr(A), sumCr(A));
  // 10,000 منها 3,333.33 لفاتورة والباقي 6,666.67 على الحساب ⇒ 166.67 + 333.33 = 500 تمامًا
  const r2v = pay(o, { invoices: [inv({ amount: 3333.33 })], cashVouchers: [] }, pv({ alloc: [{ id: 'i1', no: 'INV-1', amount: 3333.33 }] }), 'wt1');
  const sh = E.whtShares(r2v.v); assert.equal(r2(sh.i1 + sh._rest), 500); assert.deepEqual([sh.i1, sh._rest], [166.67, 333.33]);
  const A2 = E.buildAccounting(o, r2v.next); const t = tb(A2);
  assert.equal(t['2107'], -500); assert.equal(t['1201'], -9500); assert.equal(sumDr(A2), sumCr(A2));
});

test('نوع غير مؤكَّد مرفوض، وبلا نوع مرفوض، والمورد المقيم بلا استقطاع', () => {
  const o = org();
  assert.match(E.whtApply(o, pv(), 'wt2').err, /لم يؤكّده المختص/);
  assert.match(E.whtApply(o, pv(), '').err, /اختر نوع/);
  assert.match(E.whtApply(org({ wht: { on: true, types: [{ id: 'wt3', name: 'بلا نسبة', rate: '', ok: true }] } }), pv(), 'wt3').err, /لم يؤكّده/);
  assert.deepEqual(E.whtOkTypes(o).map(t => t.id), ['wt1']);
  const loc = pv({ party: { t: 'sup', key: 'sup:s2', name: 'مورد محلي تجريبي' } });
  assert.deepEqual(E.whtApply(o, loc, 'wt1').v, loc, 'المقيم: السند كما هو');
  assert.equal(E.whtPayBlock(o, 's2'), ''); assert.match(E.whtPayBlock(o, 'sup:s1'), /سند صرف/);
  // سند قبض أو على حساب: لا ينطبق
  assert.deepEqual(E.whtApply(o, pv({ kind: 'rv' }), 'wt1').v, pv({ kind: 'rv' }));
});

test('السند المعلّق (اعتماد سندات الصرف) بلا أثر حتى يُعتمد، ثم يُقيَّد بالاستقطاع — والتقرير الشهري', () => {
  const o = org();
  const r = E.whtApply(o, pv({ status: 'pending' }), 'wt1');
  const ops = E.applyCashVoucher({ invoices: [inv()], cashVouchers: [] }, { ...r.v, no: 'PV-000001' }, ME);
  assert.equal(E.buildAccounting(o, ops).entries.some(x => x.id === 'cv:cv1'), false);
  assert.equal(E.whtRows(o, ops, '2026-03').rows.length, 0, 'المعلّق خارج التقرير');
  const ap = E.cvApprove(ops, 'cv1', { name: 'مالك', role: 'system_admin', id: 'u9' }); assert.ok(ap.next, ap.err);
  const e = E.buildAccounting(o, ap.next).entries.find(x => x.id === 'cv:cv1');
  assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['2101', 10000, 0], ['1201', 0, 9500], ['2107', 0, 500]]);
  const R = E.whtRows(o, ap.next, '2026-03');
  assert.equal(R.rows.length, 1);
  assert.deepEqual([R.rows[0].sup, R.rows[0].country, R.rows[0].type, R.rows[0].rate, R.rows[0].gross, R.rows[0].wht, R.rows[0].net], ['مورد خارجي تجريبي', 'دولة تجريبية', 'خدمات فنية (تجريبي)', 5, 10000, 500, 9500]);
  assert.deepEqual(R.tot, { gross: 10000, wht: 500, net: 9500 });
  assert.equal(E.whtRows(o, ap.next, '2026-04').rows.length, 0);
});

test('إيقاف الميزة بعد سندات فيها استقطاع: القيد التاريخي كما هو، و2107 يبقى في الدليل', () => {
  const o = org(); const r = pay(o, { cashVouchers: [] }, pv(), 'wt1');
  const off = org({ wht: { on: false, types: [T5] } });
  const A = E.buildAccounting(off, r.next);
  assert.ok(A.accounts.some(a => a.code === '2107'));
  assert.deepEqual(tb(A), tb(E.buildAccounting(o, r.next)));
  assert.equal(E.whtAmtOf(1234.56, 5), 61.73);
});
