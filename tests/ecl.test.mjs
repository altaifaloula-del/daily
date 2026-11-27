/**
 * v56.40 — الدفعة 7 (قرارات المجلس E6): مخصص الخسائر الائتمانية المحدد لكل عميل، والشطب على المخصص، وأعمار الذمم بتاريخ الاستحقاق.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const org = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false },
  partners: [{ id: 'c1', type: 'customer', name: 'شركة أ', key: 'cust:c1', terms: 30 }],
  customAccounts: [{ code: '1389', name: 'مخصص الخسائر الائتمانية', kind: 'asset' }, { code: '5805', name: 'مصروف الخسائر الائتمانية', kind: 'exp' }],
  ecl: { on: true, expAcc: '5805', allowAcc: '1389' } };
const si = (id, date, total, due) => ({ id, no: 'S-' + id, kind: 'invoice', terms: 'credit', customerKey: 'cust:c1', date, dueDate: due, net: total, vat: 0, total, receipts: [], buyer: { name: 'شركة أ' } });
const doc = (id, kind, amount, x = {}) => ({ id, no: 'ECL-' + id, kind, customerKey: 'cust:c1', amount, date: '2026-11-25', reason: 'تعثر', status: 'approved', by: 'أحمد', byId: 'u1', expAcc: '5805', allowAcc: '1389', ...x });
const bal = (A, code) => Math.round(A.entries.reduce((t, e) => t + (e.lines || []).filter(l => String(l.code) === code).reduce((a, l) => a + l.debit - l.credit, 0), 0) * 100) / 100;

test('E6: بلا مستندات كما كان، والمعلّق لا يُقيَّد', () => {
  const ops = { salesInvoices: [si('i1', '2026-09-01', 1000, '2026-10-01')], eclDocs: [doc('d1', 'prov', 400, { status: 'pending' })] };
  const A = E.buildAccounting(org, ops); assert.equal(A.entries.some(e => /^ecl:/.test(e.id)), false); assert.equal(bal(A, '1380'), 1000);
  assert.equal(E.eclOn({}), false);
});

test('E6: التكوين ثم الشطب ثم العكس — قيود متوازنة، والشطب يخفض الذمة ومتبقي الفاتورة ويُطفئ المخصص', () => {
  const ops = { salesInvoices: [si('i1', '2026-09-01', 1000, '2026-10-01')], eclDocs: [doc('d1', 'prov', 600), doc('d2', 'wo', 400, { siId: 'i1' }), doc('d3', 'rel', 50)] };
  const A = E.buildAccounting(org, ops); const ec = A.entries.filter(e => /^ecl:/.test(e.id));
  assert.equal(ec.length, 3); ec.forEach(e => assert.equal(Math.round(e.lines.reduce((t, l) => t + l.debit - l.credit, 0) * 100), 0, 'متوازن'));
  assert.equal(bal(A, '5805'), 550, 'المصروف = التكوين − العكس'); assert.equal(bal(A, '1389'), -150, 'المخصص الباقي = 600 − 400 − 50');
  assert.equal(bal(A, '1380'), 600, 'الذمة بعد الشطب'); assert.equal(E.siRem(ops, ops.salesInvoices[0]), 600);
  assert.equal(E.eclAllowBal(ops, 'cust:c1'), 150);
  const P = E.buildPartners(org, ops).find(p => p.key === 'cust:c1'); const pb = P.txns.reduce((t, x) => t + (x.debit || 0) - (x.credit || 0), 0);
  assert.equal(Math.round(pb * 100) / 100, bal(A, '1380'), 'الدفتر المساعد = الحساب الرقابي 1380');
});

test('E6: الحدود — لا شطب فوق رصيد المخصص ولا فوق متبقي الفاتورة، ولا عكس فوق الرصيد، ولا فترة مقفلة، ولا حسابات ناقصة', () => {
  const ops = { salesInvoices: [si('i1', '2026-09-01', 1000, '2026-10-01')], eclDocs: [doc('d1', 'prov', 300)] };
  const A = E.buildAccounting(org, ops);
  assert.match(E.eclCheck(org, ops, doc('n', 'wo', 400, { siId: 'i1', status: 'pending' }), A), /رصيد مخصص العميل/);
  assert.match(E.eclCheck(org, ops, doc('n', 'rel', 301, { status: 'pending' }), A), /رصيد مخصص العميل/);
  assert.equal(E.eclCheck(org, ops, doc('n', 'wo', 300, { siId: 'i1', status: 'pending' }), A), '');
  const big = { ...ops, eclDocs: [doc('d1', 'prov', 5000)] };
  assert.match(E.eclCheck(org, big, doc('n', 'wo', 1200, { siId: 'i1', status: 'pending' }), A), /متبقي الفاتورة/);
  assert.match(E.eclCheck(org, ops, doc('n', 'wo', 100, { status: 'pending' }), A), /فاتورة العميل/);
  assert.match(E.eclCheck(org, ops, doc('n', 'prov', 100, { reason: ' ', status: 'pending' }), A), /الدليل/);
  assert.match(E.eclCheck({ ...org, ecl: { on: true, expAcc: '5805' } }, ops, doc('n', 'prov', 100, { status: 'pending' }), A), /حسابي/);
  assert.match(E.eclCheck({ ...org, ecl: { on: true, expAcc: '5805', allowAcc: '9876' } }, ops, doc('n', 'prov', 100, { status: 'pending' }), A), /حسابي/, 'حساب غير موجود في الدليل');
  assert.match(E.eclCheck({ ...org, periodLocks: { lockedThrough: '2026-11' } }, ops, doc('n', 'prov', 100, { status: 'pending' }), A), /مقفلة/);
});

test('E6.4: الاعتماد لغير المنشئ، ويثبّت الحسابين، ويعيد الفحص', () => {
  const ops = { salesInvoices: [si('i1', '2026-09-01', 1000, '2026-10-01')], eclDocs: [doc('d1', 'prov', 300, { status: 'pending' })] };
  const A = E.buildAccounting(org, ops);
  assert.match(E.eclApprove(org, ops, 'd1', { id: 'u1', name: 'أحمد', role: 'accountant' }, A).err, /من أنشأه/);
  const r = E.eclApprove(org, ops, 'd1', { id: 'u2', name: 'سارة', role: 'accountant' }, A); assert.ok(r.next);
  const x = r.next.eclDocs[0]; assert.deepEqual([x.status, x.expAcc, x.allowAcc, x.approvedBy], ['approved', '5805', '1389', 'سارة']);
  assert.match(E.eclApprove(org, r.next, 'd1', { id: 'u2', name: 'سارة', role: 'accountant' }, A).err, /تغيّرت حالة/);
  const wo = { ...ops, eclDocs: [doc('w', 'wo', 100, { siId: 'i1', status: 'pending' })] };
  assert.match(E.eclApprove(org, wo, 'w', { id: 'u2', name: 'سارة', role: 'accountant' }, A).err, /رصيد مخصص/, 'الشطب بلا مخصص يُرفض عند الاعتماد أيضًا');
});

test('E6.5: الأعمار بتاريخ الاستحقاق اختيارًا — بلا ذلك كما كان', () => {
  const ops = { salesInvoices: [si('i1', '2026-08-01', 1000, '2026-10-25')] };
  const P = E.buildPartners(org, ops).find(p => p.key === 'cust:c1');
  assert.equal(E.customerAging(P, '2026-11-15').b90, 1000, 'من تاريخ الفاتورة (106 يوم)');
  const g = E.customerAging(P, '2026-11-15', true); assert.equal(g.b0, 1000, 'من الاستحقاق (21 يومًا)'); assert.equal(g.total, 1000);
});

test('E6.3: بند الإقفال — المعلّق في الشهر يُظهر البند', () => {
  const ops = { closings: [], eclDocs: [doc('d1', 'prov', 300, { status: 'pending', date: '2026-11-20' })] };
  const A = E.buildAccounting(org, ops); const C = E.closeAutoChecks(A, ops, '2026-11', org);
  const it = C.find(x => x.k === 'ecl'); assert.ok(it); assert.equal(it.n, 1);
  assert.equal(E.closeAutoChecks(E.buildAccounting({}, { closings: [] }), { closings: [] }, '2026-11', {}).some(x => x.k === 'ecl'), false, 'بلا تفعيل لا بند');
});

test('E6 (التحقق المحاسبي): الشطب يُخصم من فاتورته في الأعمار لا من الأقدم', () => {
  const ops = { salesInvoices: [si('i1', '2026-06-01', 1000, '2026-07-01'), si('i2', '2026-11-01', 1000, '2026-12-01')], eclDocs: [doc('d1', 'prov', 1000), doc('d2', 'wo', 1000, { siId: 'i2' })] };
  const P = E.buildPartners(org, ops).find(p => p.key === 'cust:c1'); const g = E.customerAging(P, '2026-11-25', true);
  assert.deepEqual([g.b0, g.b90, g.total], [0, 1000, 1000], 'المتأخر القديم يبقى متأخرًا');
});

test('E6 (التحقق المحاسبي): الاسترداد بعد الشطب — يعيد الذمة ويعكس المصروف (11.26) ويقبل التحصيل، ولا يتجاوز المشطوب', () => {
  const base = { salesInvoices: [{ ...si('i1', '2026-09-01', 1000, '2026-10-01'), branchId: 'b1' }], eclDocs: [doc('d1', 'prov', 1000), doc('d2', 'wo', 1000, { siId: 'i1' })] };
  const A0 = E.buildAccounting(org, base);
  assert.match(E.eclCheck(org, base, doc('r', 'rec', 1200, { siId: 'i1', status: 'pending' }), A0), /المشطوب غير المسترد/);
  const ops = { ...base, eclDocs: [...base.eclDocs, doc('d3', 'rec', 400, { siId: 'i1' })] };
  const A = E.buildAccounting(org, ops); assert.equal(bal(A, '1380'), 400); assert.equal(bal(A, '5805'), 600, 'المصروف بعد العكس'); assert.equal(bal(A, '1389'), 0, 'المخصص لا يتأثر');
  assert.equal(E.siRem(ops, ops.salesInvoices[0]), 400, 'الفاتورة مستحقة بالمسترد'); assert.equal(E.eclAllowBal(ops, 'cust:c1'), 0);
  const P = E.buildPartners(org, ops).find(p => p.key === 'cust:c1'); assert.equal(Math.round(P.txns.reduce((t, x) => t + (x.debit || 0) - (x.credit || 0), 0) * 100) / 100, 400, 'المساعد = 1380');
  assert.equal(A.entries.find(e => e.id === 'ecl:d2').branchId, 'b1', 'الشطب بفرع الفاتورة'); assert.equal(A.entries.find(e => e.id === 'ecl:d3').branchId, 'b1');
});

test('E6 (التحقق المحاسبي): حساب المخصص فرعي من 13xx غير 1380 وغير النقد، ولا تاريخ مستقبلي، وفرع التكوين اختياري', () => {
  const ops = { salesInvoices: [si('i1', '2026-09-01', 1000, '2026-10-01')], eclDocs: [] }; const A = E.buildAccounting(org, ops);
  for (const bad of ['1380', '1111', '1601']) assert.match(E.eclCheck({ ...org, ecl: { on: true, expAcc: '5805', allowAcc: bad } }, ops, doc('n', 'prov', 100, { status: 'pending' }), A), /حسابي/, bad);
  assert.match(E.eclCheck(org, ops, doc('n', 'prov', 100, { status: 'pending', date: '2999-01-01' }), A), /مستقبلي/);
  const A2 = E.buildAccounting(org, { ...ops, eclDocs: [doc('d1', 'prov', 100, { branchId: 'b1' }), doc('d2', 'prov', 50)] });
  assert.equal(A2.entries.find(e => e.id === 'ecl:d1').branchId, 'b1'); assert.equal(A2.entries.find(e => e.id === 'ecl:d2').branchId, undefined, 'بلا فرع = مركزي');
});

test('E6: eclAllowOk مباشرة', () => {
  const A = E.buildAccounting(org, {});
  assert.equal(E.eclAllowOk('1389', A), true); assert.equal(E.eclAllowOk('1380', A), false); assert.equal(E.eclAllowOk('13', A), false); assert.equal(E.eclAllowOk('1111', A), false);
});
