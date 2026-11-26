/**
 * v56.32 — الدفعة 1ب (قرار المجلس T9 بتفويض المالك): اعتماد سندات الصرف بغير منشئها. معطّل افتراضيًا، وما قبل النطاق كما هو.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'مورد' }] };
const org = { ...base, cvAppr: { ranges: [{ from: '2026-12-01' }] } };
const inv = { id: 'i1', supplierId: 's1', supplierName: 'مورد', invoiceNo: 'S-1', date: '2026-11-01', amount: 1000, paidAmount: 0 };
const pv = (id, date, extra) => ({ id, no: 'PV-' + id, kind: 'pv', date, amount: 600, fund: '1101', pm: 'cash', party: { t: 'sup', key: 'sup:s1', name: 'مورد' }, alloc: [{ id: 'i1', no: 'S-1', amount: 600 }], by: 'أ', byId: 'a', at: '2026-12-02T10:00:00Z', ...(extra || {}) });
const me = { name: 'ب', id: 'b', role: 'accountant' };

test('معطّل افتراضيًا: السند يُطبَّق كما كان', () => {
  assert.equal(E.cvNeedsAppr(base, pv('x', '2026-12-02')), false);
  const d = E.applyCashVoucher({ invoices: [inv], cashVouchers: [] }, pv('x', '2026-12-02'), me);
  assert.equal(d.invoices[0].payments.length, 1);
});

test('داخل النطاق: سند الصرف المعلّق بلا أثر (لا سداد ولا قيد)، وما قبل النطاق كما هو', () => {
  assert.equal(E.cvNeedsAppr(org, pv('x', '2026-12-02')), true); assert.equal(E.cvNeedsAppr(org, pv('x', '2026-11-30')), false);
  assert.equal(E.cvNeedsAppr(org, { ...pv('x', '2026-12-02'), kind: 'rv' }), false, 'سند القبض بلا تغيير');
  const d = E.applyCashVoucher({ invoices: [inv], cashVouchers: [] }, pv('p', '2026-12-02', { status: 'pending' }), me);
  assert.equal((d.invoices[0].payments || []).length, 0, 'لا سداد للفاتورة'); assert.equal(d.cashVouchers.length, 1);
  const A = E.buildAccounting(org, d); assert.equal(A.entries.filter(e => /cv/.test(e.id)).length, 0, 'لا قيد');
});

test('الاعتماد: يطبّق الأثر من «معلّق» فقط، ويفحص متبقي الفاتورة، والمرحّل متوازن', () => {
  const d0 = E.applyCashVoucher({ invoices: [inv], cashVouchers: [] }, pv('p', '2026-12-02', { status: 'pending' }), me);
  const r = E.cvApprove(d0, 'p', me); assert.ok(r.next, r.err);
  assert.equal(r.next.cashVouchers[0].status, 'posted'); assert.equal(r.next.invoices[0].payments.length, 1);
  assert.match(E.cvApprove(r.next, 'p', me).err, /تغيّرت حالة/, 'لا يُعتمد مرتين');
  const A = E.buildAccounting(org, r.next); for (const e of A.entries) assert.equal(Math.round(e.lines.reduce((t, l) => t + l.debit - l.credit, 0) * 100), 0, e.id);
  // فاتورة سُددت في الأثناء ⇒ يُرفض الاعتماد
  const paid = { ...d0, invoices: [{ ...inv, payments: [{ id: 'x', amount: 700 }] }] };
  assert.match(E.cvApprove(paid, 'p', me).err, /متبقي الفاتورة/);
});

test('المرفوض والمسحوب بلا قيد، والقديم بلا حالة مرحّل', () => {
  assert.equal(E.cvLive({}), true); assert.equal(E.cvLive({ status: 'pending' }), false); assert.equal(E.cvLive({ status: 'rejected' }), false); assert.equal(E.cvLive({ status: 'withdrawn' }), false);
  const A = E.buildAccounting(org, { cashVouchers: [{ ...pv('r', '2026-12-02', { status: 'rejected' }), alloc: [] }, { ...pv('o', '2026-11-10'), alloc: [] }] });
  assert.equal(A.entries.some(e => e.id.includes('r')) && A.entries.some(e => /cv:r/.test(e.id)), false); assert.ok(A.entries.some(e => /cv:o/.test(e.id)));
});

test('(التحقق المستقل) لا اعتماد لسند فاتورته حُذفت أو صارت إشعارًا دائنًا، ولا يعتمده منشئه', () => {
  const d0 = E.applyCashVoucher({ invoices: [inv], cashVouchers: [] }, pv('p', '2026-12-02', { status: 'pending' }), me);
  assert.match(E.cvApprove({ ...d0, invoices: [] }, 'p', me).err, /لم تعد قائمة/);
  assert.match(E.cvApprove({ ...d0, invoices: [{ ...inv, creditNote: true, amount: -1000 }] }, 'p', me).err, /لم تعد قائمة/);
  assert.match(E.cvApprove(d0, 'p', { name: 'أ', id: 'a', role: 'accountant' }).err, /من أنشأه/);
});

test('(التحقق المستقل) السجلات المحمية: سند الصرف يُنسخ عند ترحيله فقط', () => {
  const p = pv('p', '2026-12-02', { status: 'pending', alloc: [] }), ok = { ...p, status: 'posted', approvedBy: 'ب' }, rj = { ...p, status: 'rejected' };
  assert.equal(E.fdDiff('cv', [], [p]).create.length, 0, 'المعلّق لا يُنسخ');
  const r = E.fdDiff('cv', [p], [ok]); assert.equal(r.create.length, 1); assert.equal(r.skip.length, 0, 'لا تخطٍّ بعد الاعتماد');
  assert.equal(E.fdDiff('cv', [p], [rj]).create.length + E.fdDiff('cv', [p], [rj]).skip.length, 0, 'المرفوض لا يُنسخ');
  assert.equal(E.fdDiff('cv', [], [{ ...p, status: undefined }]).create.length, 1, 'القديم بلا حالة كما كان');
});

test('(التحقق المستقل) قائمة الإقفال تكشف السندات والأوامر المعلّقة', () => {
  const A = E.buildAccounting(base, {});
  const ck = E.closeAutoChecks(A, { cashVouchers: [pv('p', '2026-12-02', { status: 'pending' })], disbursements: [{ id: 'x', date: '2026-12-03', status: 'pending', amount: 5 }] }, '2026-12');
  const it = ck.find(c => c.k === 'pdocs'); assert.ok(it && it.n === 2 && !it.ok);
  assert.equal(E.closeAutoChecks(A, {}, '2026-12').some(c => c.k === 'pdocs'), false, 'بلا معلّق لا بند جديد');
});
