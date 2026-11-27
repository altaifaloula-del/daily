/**
 * v56.51 — المقترحات الضريبية الأربعة (قرار المالك 2026-11-27 بناءً على رأي أخصائي الزكاة والضريبة في المجلس — اجتهاد يحتاج تأكيد مختص).
 * كل الأرقام وهمية ومحسوبة يدويًا، والنِّسب «إعدادات يُدخلها المالك» في الاختبار لا قيمًا مثبّتة في الكود:
 *  (1) خدمة 10,000 من مورد غير مقيم بنسبة ضريبة 15% (من taxCfg.rate) ⇒ مدين 1501 1,500 / دائن 2301 1,500 بلا أثر نقدي.
 *  (2) استقطاع 5% على سندات مارس بتاريخ الدفع، وموعد توريد يوم 10 (إعداد مؤكَّد).
 *  (3) مبسّطة 1,150 (1,000 + 150) ⇒ إشعار دائن 1,150 + ضريبية 1,150 — الصافي صفر والسلسلة سليمة.
 *  (4) شطب 1,150 بعد 6 أشهر (إعداد مؤكَّد) ⇒ تعديل 150: مدين 2301 / دائن مصروف الخسائر؛ استرداد 575 ⇒ عكس 75.
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
const LN = (e) => e.lines.map(l => [l.code, l.debit, l.credit]);
const ME = { name: 'محاسب تجريبي', role: 'finance_department', id: 'u1' };
const ME2 = { name: 'مراجع تجريبي', role: 'accountant', id: 'u2' };
const T5 = { id: 'wt1', name: 'خدمات فنية (تجريبي)', rate: 5, ok: true };
const TT = { id: 'wt9', name: 'مخفّض باتفاقية (تجريبي)', rate: 2, ok: true, treaty: true };
const sup = (x = {}) => ({ id: 's1', code: 'S-1', name: 'مورد خارجي تجريبي', nonResident: true, country: 'دولة تجريبية', whtType: 'wt1', ...x });
const sup2 = { id: 's2', code: 'S-2', name: 'مورد محلي تجريبي' };
const CK = 'cust:c1';
const base = (x = {}) => ({ company: { name: 'منشأة اختبار' }, branches: [{ id: 'b1', name: 'فرع 1', isActive: true }], suppliers: [sup(), sup2], taxCfg: { enabled: true, rate: 15 },
  partners: [{ id: 'c1', type: 'customer', name: 'عميل تجريبي', key: CK, terms: 30 }],
  customAccounts: [{ code: '1389', name: 'مخصص الخسائر الائتمانية', kind: 'asset' }, { code: '5805', name: 'مصروف الخسائر الائتمانية', kind: 'exp' }, { code: '5310', name: 'خدمات مهنية', kind: 'exp' }],
  ecl: { on: true, expAcc: '5805', allowAcc: '1389' }, ...x });
const ON = (x = {}) => base({ wht: { on: true, types: [T5, TT], dueDay: 10, dueOk: true }, rcm: { on: true }, siConv: { on: true }, badDebtVat: { on: true, minMonths: 6, ok: true }, ...x });
const inv = (x = {}) => ({ id: 'i1', supplierId: 's1', supplierName: 'مورد خارجي تجريبي', invoiceNo: 'INV-1', date: '2026-03-01', amount: 10000, vatAmt: 0, branchId: 'b1', kind: 'svc', expLines: [{ desc: 'خدمة', accCode: '5310', net: 10000, vat: 0 }], ...x });
const pv = (x = {}) => ({ id: 'cv1', kind: 'pv', date: '2026-03-10', amount: 10000, note: '', by: ME.name, at: '2026-03-10T10:00:00Z', fund: '1201', pm: 'bank', party: { t: 'sup', key: 'sup:s1', name: 'مورد خارجي تجريبي' }, ...x });
const si = (x = {}) => ({ id: 'si1', no: 'فاتورة-2026-00001', kind: 'invoice', type: 'simplified', entityId: 'primary', branchId: 'b1', date: '2026-01-15', time: '10:00', customerKey: CK, buyer: { name: 'عميل تجريبي' },
  lines: [{ desc: 'وجبات', qty: 10, price: 100, vatRate: 15, net: 1000, vat: 150 }], net: 1000, vat: 150, total: 1150, terms: 'credit', dueDate: '2026-02-14', inClosing: false, receipts: [], by: 'x', at: '2026-01-15T10:00:00Z', ...x });
const ecl = (id, kind, amount, x = {}) => ({ id, no: 'ECL-' + id, kind, customerKey: CK, custName: 'عميل تجريبي', amount, date: '2026-08-01', reason: 'تعثر', status: 'approved', by: 'أحمد', byId: 'u9', expAcc: '5805', allowAcc: '1389', ...x });
const stamped = (list) => list.reduce((acc, x) => [...acc, E.siStamp(acc, x)], []);
const isRcm = (e) => /:rcm$/.test(e.id), isBdv = (e) => /^ecl:.*:vat$/.test(e.id);

/* ———————— بلا تفعيل: كما كان حرفيًا ———————— */
test('بلا تفعيل: لا حقول ولا قيود جديدة، وسجل الضريبة والسجل الشهري والبصمة كما هي — والتفعيل وحده (بلا حقول على المستندات) لا يغيّر شيئًا', () => {
  const off = base({ wht: { on: true, types: [T5] } });
  const ops = { invoices: [inv()], cashVouchers: [{ ...E.whtApply(off, pv(), 'wt1').v, no: 'PV-000001' }], salesInvoices: [si()], eclDocs: [ecl('p', 'prov', 1150), ecl('w', 'wo', 1150, { siId: 'si1' })] };
  // دوال التثبيت لا تغيّر المستند بلا تفعيل
  assert.deepEqual(E.rcmApply(off, inv(), { nr: true }).doc, inv()); assert.deepEqual(E.rcmApply(off, pv()).doc, pv());
  assert.equal(E.siConvCheck(off, { salesInvoices: [si()] }, si(), {}, '2026-03-01'), 'تحويل المبسّطة إلى ضريبية غير مفعّل');
  assert.equal(E.bdvCheck(off, ops, ecl('w', 'wo', 1150, { siId: 'si1' })), '', 'شطب بلا تعديل ضريبة = بلا فحص جديد');
  assert.equal(E.whtDueDay(off), 0); assert.equal(E.whtDueAlert(off, E.buildAccounting(off, ops), '2026-04-05'), null);
  const A = E.buildAccounting(off, ops);
  assert.equal(A.entries.some(e => isRcm(e) || isBdv(e)), false, 'لا قيد احتساب عكسي ولا تعديل');
  const R = E.vatRegister(off, ops, { A });
  assert.deepEqual(R.boxes.map(b => b.n), ['1', '3–5', '6', '7', '10–11', '12', '13']); assert.equal('rcm' in R, false);
  R.boxes.forEach(b => { assert.equal('adj' in b, false); assert.equal('rc' in b, false); });
  [...R.sales, ...R.purch].forEach(r => { assert.equal('adj' in r, false); assert.equal('nr' in r, false); });
  assert.equal(E.closeAutoChecks(A, ops, '2026-04', off).some(c => c.k === 'whtdue'), false);
  // المفاتيح مفعّلة لكن المستندات بلا الحقول الجديدة ⇒ القيود والسجل والبصمة متطابقة حرفيًا
  const on = ON({ wht: { on: true, types: [T5] } }); const A2 = E.buildAccounting(on, ops);
  assert.deepEqual(A2.entries.map(e => [e.id, e.date, LN(e), e.vat || null, e.reg || null]), A.entries.map(e => [e.id, e.date, LN(e), e.vat || null, e.reg || null]));
  assert.deepEqual(E.vatRegister(on, ops, { A: A2 }), R);
  assert.deepEqual(E.whtRows(on, ops, '2026-03'), E.whtRows(off, ops, '2026-03'));
  assert.equal(E.lockedLedgerSig(on, ops, '2026-12'), E.lockedLedgerSig(off, ops, '2026-12'));
  assert.equal(sumDr(A), sumCr(A));
});

/* ———————— (1) الاحتساب العكسي ———————— */
test('(1) فاتورة خدمات 10,000 لمورد غير مقيم: مدين 1501 1,500 / دائن 2301 1,500 بتاريخ الفاتورة وبلا أثر نقدي — وبند 9 مستقل في الإقرار', () => {
  const o = ON(); const r = E.rcmApply(o, inv()); assert.ok(!r.err, r.err);
  assert.deepEqual(r.doc.rcm, { rate: 15, base: 10000, vat: 1500 });
  const ops = { invoices: [r.doc] }; const A = E.buildAccounting(o, ops);
  const e = A.entries.find(x => x.id === 'inv:i1:rcm'); assert.ok(e);
  assert.equal(e.date, '2026-03-01'); assert.deepEqual(LN(e), [['1501', 1500, 0], ['2301', 0, 1500]]);
  assert.equal(A.entries.find(x => x.id === 'inv:i1').lines.length, 2, 'قيد الفاتورة نفسه لم يتغير');
  const t = tb(A); assert.equal(t['1201'] || 0, 0, 'لا أثر نقدي'); assert.equal(t['2101'], -10000);
  const R = E.vatRegister(o, ops, { A });
  assert.equal(R.rcm.length, 1); assert.deepEqual([R.rcm[0].net, R.rcm[0].vat], [10000, 1500]);
  const b9 = R.boxes.find(b => b.n === '9'); assert.ok(b9 && /للاحتساب العكسي/.test(b9.ar)); assert.deepEqual([b9.net, b9.vat, b9.rcIn], [10000, 1500, 1500]);
  assert.deepEqual(R.boxes.map(b => b.n), ['1', '3–5', '6', '7', '9', '10–11', '12', '13']);
  assert.equal(R.boxes.find(b => b.n === '12').vat, 1500); assert.equal(R.boxes.find(b => b.n === '13').vat, 0, 'القابل للاسترداد صافيه صفر');
  assert.equal(R.checks.find(c => c.sev !== 'warn').sev, 'ok', 'السجل يطابق حركة 2301 و1501');
  assert.equal(R.purch.some(x => x.k === 'rc'), false, 'لا يختلط بسجل المشتريات');
  assert.equal(sumDr(A), sumCr(A));
});

test('(1) غير القابل للاسترداد: مدين حساب المصروف بدل 1501 — والصافي المستحق يزيد 1,500 والمطابقة سليمة', () => {
  const o = ON(); const r = E.rcmApply(o, inv(), { nr: true }); assert.ok(!r.err, r.err);
  assert.deepEqual(r.doc.rcm, { rate: 15, base: 10000, vat: 1500, nr: true, acc: '5310' }, 'حساب أكبر بند خدمات');
  const ops = { invoices: [r.doc] }; const A = E.buildAccounting(o, ops);
  assert.deepEqual(LN(A.entries.find(x => x.id === 'inv:i1:rcm')), [['5310', 1500, 0], ['2301', 0, 1500]]);
  const R = E.vatRegister(o, ops, { A }); const b9 = R.boxes.find(b => b.n === '9');
  assert.deepEqual([b9.vat, b9.rcIn], [1500, 0]); assert.equal(R.boxes.find(b => b.n === '13').vat, 1500); assert.equal(R.rcm[0].nr, true);
  assert.equal(R.checks.find(c => c.sev !== 'warn').sev, 'ok'); assert.equal(sumDr(A), sumCr(A));
});

test('(1) سند صرف على الحساب مع استقطاع 5%: الاحتساب على الإجمالي قبل الاستقطاع (10,000) بتاريخ السند؛ والموزَّع على فاتورة لا يتكرر', () => {
  const o = ON(); let v = E.whtApply(o, pv(), 'wt1').v; const r = E.rcmApply(o, v); assert.ok(!r.err, r.err); v = r.doc;
  assert.deepEqual(v.rcm, { rate: 15, base: 10000, vat: 1500 }); assert.equal(v.whtAmt, 500);
  const ops = E.applyCashVoucher({ cashVouchers: [] }, { ...v, no: 'PV-000001' }, ME); const A = E.buildAccounting(o, ops);
  const e = A.entries.find(x => x.id === 'cv:cv1:rcm'); assert.equal(e.date, '2026-03-10'); assert.deepEqual(LN(e), [['1501', 1500, 0], ['2301', 0, 1500]]);
  assert.deepEqual(LN(A.entries.find(x => x.id === 'cv:cv1')), [['2101', 10000, 0], ['1201', 0, 9500], ['2107', 0, 500]], 'قيد السند كما هو');
  // كامل السند موزَّع على فاتورة ⇒ لا احتساب على السند (احتُسب عند الفاتورة)
  const r2v = E.rcmApply(o, pv({ alloc: [{ id: 'i1', no: 'INV-1', amount: 10000 }] })); assert.equal('rcm' in r2v.doc, false);
  // جزء موزَّع وباقٍ على الحساب 4,000 ⇒ الأساس 4,000
  assert.equal(E.rcmApply(o, pv({ alloc: [{ id: 'i1', no: 'INV-1', amount: 6000 }] })).doc.rcm.base, 4000);
  assert.equal(sumDr(A), sumCr(A));
});

test('(1) الحدود: الخدمة خارج المملكة تُلغى بوسم، والفاتورة ذات الضريبة مرفوضة، وبلا نسبة مرفوض، وغير القابل على السند يتطلب حسابًا، والمورد المقيم بلا أثر', () => {
  const o = ON();
  const sk = E.rcmApply(o, inv(), { on: false }).doc; assert.equal(sk.rcmSkip, true); assert.equal('rcm' in sk, false);
  assert.equal(E.buildAccounting(o, { invoices: [sk] }).entries.some(isRcm), false);
  assert.match(E.rcmApply(o, inv({ vatAmt: 150 })).err, /ضريبة مدخلات/);
  assert.match(E.rcmApply(ON({ taxCfg: { enabled: true } }), inv()).err, /نسبة/);
  assert.equal(E.rcmApply(ON({ rcm: { on: true, rate: 5 } }), inv()).doc.rcm.vat, 500, 'نسبة الاحتساب من إعداده إن أُدخلت');
  assert.match(E.rcmApply(o, pv(), { nr: true }).err, /حساب مصروف/);
  assert.equal(E.rcmApply(ON({ rcm: { on: true, nrAcc: '5310' } }), pv(), { nr: true }).doc.rcm.acc, '5310');
  assert.deepEqual(E.rcmApply(o, inv({ supplierId: 's2' })).doc, inv({ supplierId: 's2' }));
});

/* ———————— (2) الاستقطاع ———————— */
test('(2-أ) السجل الشهري مجمّع بتاريخ الدفع (تاريخ السند) لا تاريخ الفاتورة', () => {
  const o = ON(); const mk = (id, date, amount, type = 'wt1', x = {}) => ({ ...E.whtApply(o, pv({ id, date, amount, ...x }), type).v, no: 'PV-' + id });
  const ops = { invoices: [inv({ date: '2026-02-20' })], cashVouchers: [mk('a', '2026-03-05', 10000), mk('b', '2026-03-28', 4000), mk('c', '2026-04-02', 2000),
    mk('d', '2026-03-15', 1000, 'wt9', { whtTreaty: { ref: 'REQ-1', cert: 'TRC-1', exp: '2026-12-31' } })] };
  const S = E.whtSummary(o, ops, '2026-03');
  assert.equal(S.basis, 'payment'); assert.deepEqual(S.rows.map(r => r.no), ['PV-a', 'PV-d', 'PV-b']);
  assert.deepEqual(S.groups.map(g => [g.type, g.rate, g.n, g.gross, g.wht]), [['خدمات فنية (تجريبي)', 5, 2, 14000, 700], ['مخفّض باتفاقية (تجريبي)', 2, 1, 1000, 20]]);
  assert.deepEqual(S.tot, { gross: 15000, wht: 720, net: 14280 });
  assert.deepEqual(S.rows[1].treaty, { ref: 'REQ-1', cert: 'TRC-1', exp: '2026-12-31' });
  assert.equal(E.whtSummary(o, ops, '2026-02').rows.length, 0, 'تاريخ الفاتورة لا يُحتسب');
});

test('(2-أ) تنبيه التوريد: لا يظهر بلا يوم مؤكَّد، ويظهر لاستقطاع الشهر السابق غير المورَّد، ويختفي بعد قيد التوريد — وفحص الإقفال', () => {
  const o = ON(); const v = { ...E.whtApply(o, pv(), 'wt1').v, no: 'PV-1' }; const ops = { cashVouchers: [v] };
  const A = E.buildAccounting(o, ops);
  assert.equal(E.whtDueAlert(ON({ wht: { on: true, types: [T5] } }), A, '2026-04-05'), null, 'بلا يوم');
  assert.equal(E.whtDueAlert(ON({ wht: { on: true, types: [T5], dueDay: 10 } }), A, '2026-04-05'), null, 'يوم غير مؤكَّد');
  assert.equal(E.whtDueAlert(ON({ wht: { on: true, types: [T5], dueDay: 31, dueOk: true } }), A, '2026-04-05'), null, 'يوم خارج 1–28');
  assert.deepEqual(E.whtDueAlert(o, A, '2026-04-05'), { ym: '2026-03', due: '2026-04-10', amt: 500, late: false });
  assert.equal(E.whtDueAlert(o, A, '2026-04-11').late, true);
  assert.equal(E.whtDueAlert(o, A, '2026-03-20'), null, 'استقطاع الشهر الجاري لم يحن موعده');
  assert.equal(E.closeAutoChecks(A, ops, '2026-04', o).find(c => c.k === 'whtdue').ok, false);
  const paid = { ...ops, journalManual: [{ id: 'jm1', date: '2026-04-08', title: 'توريد الاستقطاع', status: 'posted', lines: [{ code: '2107', debit: 500, credit: 0 }, { code: '1201', debit: 0, credit: 500 }] }] };
  const A2 = E.buildAccounting(o, paid);
  assert.equal(E.whtDueAlert(o, A2, '2026-04-09'), null); assert.equal(E.closeAutoChecks(A2, paid, '2026-04', o).find(c => c.k === 'whtdue').ok, true);
});

test('(2-ب) النسبة المخفّضة باتفاقية: تُرفض بلا مرجع البوابة أو بلا شهادة الإقامة أو بشهادة منتهية، وتُقبل بها', () => {
  const o = ON();
  assert.match(E.whtApply(o, pv(), 'wt9').err, /مرجع طلب البوابة/);
  assert.match(E.whtApply(o, pv({ whtTreaty: { ref: 'REQ-1', cert: '', exp: '2026-12-31' } }), 'wt9').err, /شهادة الإقامة/);
  assert.match(E.whtApply(o, pv({ whtTreaty: { ref: 'REQ-1', cert: 'TRC-1', exp: '' } }), 'wt9').err, /صلاحيتها/);
  assert.match(E.whtApply(o, pv({ whtTreaty: { ref: 'REQ-1', cert: 'TRC-1', exp: '2026-03-09' } }), 'wt9').err, /منتهية/);
  const ok = E.whtApply(o, pv({ whtTreaty: { ref: ' REQ-1 ', cert: 'TRC-1', exp: '2026-03-10' } }), 'wt9'); assert.ok(!ok.err, ok.err);
  assert.deepEqual([ok.v.whtRate, ok.v.whtAmt, ok.v.whtTreaty], [2, 200, { ref: 'REQ-1', cert: 'TRC-1', exp: '2026-03-10' }]);
  const plain = E.whtApply(o, pv({ whtTreaty: { ref: 'x', cert: 'y', exp: '2027-01-01' } }), 'wt1').v; assert.equal('whtTreaty' in plain, false, 'النوع العادي لا يحمل مستند الاتفاقية');
});

test('(2-ج) تحذير تسوية رصيد مورد غير مقيم بمقاصّة أو قيد يدوي على 2101 — ولا تحذير بلا تفعيل أو لمورد مقيم', () => {
  const o = ON();
  assert.match(E.whtSettleWarn(o, { kind: 'ov', supKey: 'sup:s1', custKey: CK }), /غير المقيم/);
  assert.equal(E.whtSettleWarn(o, { kind: 'ov', supKey: 'sup:s2', custKey: CK }), '');
  assert.match(E.whtSettleWarn(o, { lines: [{ code: '2101', debit: 100, credit: 0 }, { code: '1201', debit: 0, credit: 100 }] }), /سند صرف/);
  assert.equal(E.whtSettleWarn(o, { lines: [{ code: '5310', debit: 100, credit: 0 }, { code: '1201', debit: 0, credit: 100 }] }), '');
  assert.equal(E.whtSettleWarn(base(), { kind: 'ov', supKey: 'sup:s1' }), '');
});

/* ———————— (3) تحويل المبسّطة إلى ضريبية ———————— */
const C2 = { key: CK, name: 'عميل تجريبي', tax: '300000000000003', address: 'عنوان وطني تجريبي' };
test('(3) التحويل: إشعار دائن كامل + فاتورة ضريبية بالمبالغ نفسها، مرتبطان، والسلسلة سليمة والصافي صفر والأصل لم يُمس', () => {
  const o = ON(); const list = stamped([si({ terms: 'cash', fund: '1101', dueDate: undefined })]); const ops = { salesInvoices: list };
  const A0 = E.buildAccounting(o, ops); const orig = list[0];
  const r = E.siConvert(o, ops, 'si1', C2, ME, { date: '2026-03-01', time: '12:00' }); assert.ok(!r.err, r.err);
  const { cn, inv: x } = r;
  assert.deepEqual([cn.kind, cn.refId, cn.reason, cn.convTo, cn.total, cn.vat, cn.terms, cn.fund], ['credit', 'si1', 'إعادة إصدار بفاتورة ضريبية للمشتري المسجل', x.id, 1150, 150, 'cash', '1101']);
  assert.deepEqual([x.kind, x.type, x.convFrom, x.total, x.net, x.vat, x.terms, x.fund, x.buyer.vat, x.customerKey], ['invoice', 'standard', 'si1', 1150, 1000, 150, 'cash', '1101', '300000000000003', CK]);
  assert.deepEqual(x.lines, orig.lines); assert.equal(cn.lines.length, 1);
  assert.deepEqual(r.next.salesInvoices[0], orig, 'الأصل لم يُعدَّل');
  assert.deepEqual([cn.icv, x.icv, x.pih], [2, 3, cn.hash]); assert.deepEqual(E.siVerify(r.next.salesInvoices), { ok: true, n: 3 });
  const A = E.buildAccounting(o, r.next); const t0 = tb(A0), t1 = tb(A);
  ['4102', '2301', '1101', '1380'].forEach(c => assert.equal(t1[c] || 0, t0[c] || 0, 'صافي الأثر صفر على ' + c));
  assert.equal(E.vatRegister(o, r.next, { A }).sales.filter(s => s.doc === 'فاتورة ضريبية').length, 1);
  assert.equal(sumDr(A), sumCr(A));
  // آجلة: الإشعار يخفض الذمة والفاتورة الجديدة ترفعها — الذمة نفسها
  const lc = stamped([si()]); const rc = E.siConvert(o, { salesInvoices: lc }, 'si1', C2, ME, { date: '2026-03-01' }); assert.ok(!rc.err, rc.err);
  assert.deepEqual([rc.cn.terms, rc.inv.terms, rc.inv.dueDate], ['credit', 'credit', '2026-02-14']);
  assert.equal(tb(E.buildAccounting(o, rc.next))['1380'], 1150); assert.equal(E.siRem(rc.next, rc.next.salesInvoices[0]), 0); assert.equal(E.siRem(rc.next, rc.inv), 1150);
});

test('(3) الحدود: معطّل، ضريبية أصلًا، محوّلة سابقًا، عليها إشعار، آجلة محصّلة، عميل بلا رقم أو عنوان، عميل آخر لآجل، فترة مقفلة', () => {
  const o = ON(); const L = stamped([si({ terms: 'cash', fund: '1101' })]); const ops = { salesInvoices: L };
  assert.match(E.siConvert(base(), ops, 'si1', C2, ME, { date: '2026-03-01' }).err, /غير مفعّل/);
  assert.match(E.siConvert(o, { salesInvoices: stamped([si({ type: 'standard' })]) }, 'si1', C2, ME, { date: '2026-03-01' }).err, /مبسّطة فقط/);
  const done = E.siConvert(o, ops, 'si1', C2, ME, { date: '2026-03-01' }).next; assert.match(E.siConvert(o, done, 'si1', C2, ME, { date: '2026-03-02' }).err, /سابقًا/);
  const part = { salesInvoices: [...L, E.siStamp(L, { id: 'cnx', kind: 'credit', refId: 'si1', type: 'simplified', date: '2026-02-01', lines: [], net: 100, vat: 15, total: 115, terms: 'cash', reason: 'مرتجع' })] };
  assert.match(E.siConvert(o, part, 'si1', C2, ME, { date: '2026-03-01' }).err, /إشعار دائن/);
  assert.match(E.siConvert(o, { salesInvoices: stamped([si({ receipts: [{ id: 'r', amount: 100, date: '2026-02-01' }] })]) }, 'si1', C2, ME, { date: '2026-03-01' }).err, /تحصيل/);
  assert.match(E.siConvert(o, ops, 'si1', { ...C2, tax: '' }, ME, { date: '2026-03-01' }).err, /رقم ضريبي/);
  assert.match(E.siConvert(o, ops, 'si1', { ...C2, address: '' }, ME, { date: '2026-03-01' }).err, /العنوان الوطني/);
  assert.match(E.siConvert(o, { salesInvoices: stamped([si()]) }, 'si1', { ...C2, key: 'cust:c9' }, ME, { date: '2026-03-01' }).err, /للعميل نفسه/);
  assert.match(E.siConvert({ ...o, periodLocks: { lockedThrough: '2026-03' } }, ops, 'si1', C2, ME, { date: '2026-03-01' }).err, /مقفل/);
});

/* ———————— (4) تعديل ضريبة الدين المعدوم ———————— */
test('(4) قبل المدة مرفوض، وبعدها القيد مدين 2301 / دائن المصروف 150 ويظهر في عمود التعديل، والاسترداد النصفي يعكس 75 تلقائيًا', () => {
  const o = ON(); const list = stamped([si()]);
  const ops0 = { salesInvoices: list, eclDocs: [ecl('p', 'prov', 1150)] };
  const wo = (x = {}) => ({ id: 'w', no: 'ECL-w', kind: 'wo', customerKey: CK, custName: 'عميل تجريبي', siId: 'si1', amount: 1150, date: '2026-07-15', reason: 'تعثر', bdv: 150, bdvRef: 'شهادة م.ق 123', status: 'pending', by: 'أحمد', byId: 'u9', ...x });
  assert.equal(E.bdvAmtOf(ops0, o, wo()), 150);
  assert.match(E.eclCheck(o, ops0, wo({ date: '2026-07-14' })), /لم تمضِ 6 شهرًا/);
  assert.match(E.eclCheck(o, ops0, wo({ bdvRef: ' ' })), /شهادة المحاسب القانوني/);
  assert.match(E.eclCheck(o, ops0, wo({ bdv: 100 })), /150/);
  assert.match(E.eclCheck(ON({ badDebtVat: { on: true, minMonths: 6 } }), ops0, wo()), /لم يؤكّدها المختص/);
  assert.match(E.eclCheck(ON({ badDebtVat: { on: true, minMonths: '', ok: true } }), ops0, wo()), /لم تُدخل/);
  assert.match(E.eclCheck(base(), ops0, wo()), /غير مفعّل/);
  assert.equal(E.eclCheck(o, ops0, wo()), '');
  const ap = E.eclApprove(o, { ...ops0, eclDocs: [...ops0.eclDocs, wo()] }, 'w', ME2); assert.ok(ap.next, ap.err);
  const A = E.buildAccounting(o, ap.next);
  assert.deepEqual(LN(A.entries.find(e => e.id === 'ecl:w')), [['1389', 1150, 0], ['1380', 0, 1150]], 'قيد الشطب نفسه كما هو');
  const ev = A.entries.find(e => e.id === 'ecl:w:vat'); assert.equal(ev.date, '2026-07-15'); assert.deepEqual(LN(ev), [['2301', 150, 0], ['5805', 0, 150]]);
  let t = tb(A); assert.equal(t['5805'], 1000, 'الخسارة الفعلية = الصافي'); assert.equal(t['2301'], -150 + 150, 'المخرجات المستحقة صفر بعد التعديل');
  const R = E.vatRegister(o, ap.next, { A }); const adj = R.sales.find(r => r.adj === 'bd');
  assert.deepEqual([adj.net, adj.vat, adj.gross], [-1000, -150, -1150]);
  assert.deepEqual([R.boxes[0].adj, R.boxes[2].adj, R.boxes[0].vat], [-150, -150, 0]);
  assert.equal(R.checks.find(c => c.sev !== 'warn').sev, 'ok');
  // الاسترداد 575 (نصف المشطوب) ⇒ عكس 75
  const rec = ecl('r', 'rec', 575, { siId: 'si1', date: '2026-09-01' }); const ops2 = { ...ap.next, eclDocs: [...ap.next.eclDocs, rec] };
  assert.equal(E.bdvRecOf(ops2, rec), 75);
  const A2 = E.buildAccounting(o, ops2); assert.deepEqual(LN(A2.entries.find(e => e.id === 'ecl:r:vat')), [['5805', 75, 0], ['2301', 0, 75]]);
  t = tb(A2); assert.equal(t['2301'], -75); assert.equal(t['5805'], 1000 - 575 + 75);
  const R2 = E.vatRegister(o, ops2, { A: A2 }); assert.equal(R2.sales.find(r => r.adj === 'bdr').vat, 75); assert.equal(R2.boxes[0].adj, -75);
  // استرداد الباقي ⇒ مجموع العكس = التعديل تمامًا
  const rec2 = ecl('r2', 'rec', 575, { siId: 'si1', date: '2026-10-01' }); const ops3 = { ...ops2, eclDocs: [...ops2.eclDocs, rec2] };
  assert.equal(E.bdvRecOf(ops3, rec2), 75); assert.equal(tb(E.buildAccounting(o, ops3))['2301'], -150);
  assert.equal(sumDr(A2), sumCr(A2));
});

test('(4) مستند ذمة الكاشير (pos:): النسبة من ضريبة الطلب وإجماليه — والمستند بلا تعديل كما كان', () => {
  const o = ON(); const ops = { posOrders: [{ id: 'o1', no: 'ف1-0001', branchId: 'b1', date: '2026-01-10', status: 'paid', total: 1150, vat: 150, net: 1000, payments: [{ m: 'credit', amount: 460, custKey: CK, custName: 'عميل تجريبي' }], ar: { key: CK, name: 'عميل تجريبي' } }] };
  assert.equal(E.bdvAmtOf(ops, o, { siId: 'pos:o1', amount: 460 }), 60);
  assert.equal(E.bdvDocOf(ops, o, 'pos:o1').date, '2026-01-10');
  assert.equal(E.bdvRecOf(ops, { kind: 'rec', id: 'x', siId: 'pos:o1', amount: 100 }), 0, 'بلا تعديل سابق لا عكس');
});

/* ———————— الميزان في سيناريو مركّب ———————— */
test('سيناريو مركّب بالبنود الأربعة: الميزان متوازن وسجل الضريبة يطابق حركة 2301 و1501', () => {
  const o = ON(); const L = stamped([si(), si({ id: 'si2', terms: 'cash', fund: '1101', dueDate: undefined, date: '2026-02-01' })]);
  const conv = E.siConvert(o, { salesInvoices: L }, 'si2', C2, ME, { date: '2026-03-01' }).next;
  const v = E.rcmApply(o, E.whtApply(o, pv(), 'wt1').v, { nr: true, acc: '5310' }).doc;
  const ops = { ...E.applyCashVoucher({ salesInvoices: conv.salesInvoices, invoices: [E.rcmApply(o, inv()).doc], cashVouchers: [] }, { ...v, no: 'PV-1' }, ME),
    eclDocs: [ecl('p', 'prov', 1150), ecl('w', 'wo', 1150, { siId: 'si1', date: '2026-07-20', bdv: 150, bdvRef: 'ش-1' }), ecl('r', 'rec', 230, { siId: 'si1', date: '2026-09-01' })] };
  const A = E.buildAccounting(o, ops);
  assert.equal(sumDr(A), sumCr(A)); A.entries.forEach(e => assert.ok(e.balanced, e.id));
  const R = E.vatRegister(o, ops, { A });
  assert.equal(R.checks.find(c => c.sev !== 'warn').sev, 'ok', 'السجل = الدفاتر');
  assert.deepEqual(R.boxes.find(b => b.n === '9').vat, 3000);
  assert.equal(E.bdvRecOf(ops, ops.eclDocs[2]), 30);
});
