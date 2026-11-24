/* v54.1 — المرحلة 2: الرقابة المستمرة وسجل الحالات — فحوص بنتائج معروفة، عدم التكرار، دورة الحياة، إعادة التحقق وإعادة الفتح، الصلاحيات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const org = { taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'طيبة' }], suppliers: [{ id: 's1', name: 'مكين', vatNo: '311135091100003' }, { id: 's2', name: 'بلا رقم', vatNo: '' }] };
const inv = (id, x) => ({ id, kind: 'svc', supplierId: 's1', supplierName: 'مكين', invoiceNo: id, amount: 115, vatAmt: 15, taxable: true, date: '2026-02-01', dueDate: '2026-02-01', expLines: [{ accCode: '5198', net: 100, vat: 15 }], createdAt: '2026-02-01T0' + id.length + ':00:00Z', ...x });
const ops = { invoices: [
  inv('A1'), inv('A1b', { invoiceNo: 'A1', createdAt: '2026-02-02T00:00:00Z' }),           // مكررة
  inv('B1', { amount: 230, vatAmt: 30, invoiceNo: 'B1', date: '2026-02-05' }), inv('B2', { amount: 230, vatAmt: 30, invoiceNo: 'B2', date: '2026-02-05' }),   // مبلغ مكرر محتمل
  inv('C1', { amount: 115, vatAmt: 25, date: '2026-02-07' }),                                                   // ضريبة لا تطابق
  inv('D1', { supplierId: 's2', supplierName: 'بلا رقم', date: '2026-02-09' }),                                  // ضريبة بلا رقم ضريبي
  inv('F1', { date: '2099-01-01' }), inv('G1', { invoiceNo: '', date: '2026-02-08' }) ],
  journalManual: [{ id: 'jx', date: '2026-02-03', title: 'غير متوازن', status: 'posted', lines: [{ code: '5198', debit: 100, credit: 0 }, { code: '1101', debit: 0, credit: 90 }] },
    { id: 'jq', date: '2026-02-03', title: 'مكافأة على الحقوق', status: 'posted', lines: [{ code: '3201', debit: 50, credit: 0 }, { code: '2203', debit: 0, credit: 50 }] }] };
const cats = (L) => L.reduce((m, x) => (m[x.cat] = (m[x.cat] || 0) + 1, m), {});

test('الفحوص تكتشف كل حالة معروفة بفئتها وخطورتها ودليلها وأثرها', () => {
  const L = E.ctlScan(org, ops, { today: '2026-03-01', anomalies: false });
  const c = cats(L);
  assert.equal(c.dup_invoice, 1); assert.equal(c.dup_amount, 1); assert.equal(c.vat_calc, 1); assert.equal(c.vat_supplier, 1); assert.equal(c.future_date, 1); assert.equal(c.missing_doc, 1);
  assert.equal(c.unbalanced, 1); assert.equal(c.equity_touch, 1); assert.ok(c.nature >= 1, 'رصيد بعكس طبيعته');
  const d = L.find(x => x.cat === 'dup_invoice'); assert.equal(d.sev, 'high'); assert.equal(d.impact, 115); assert.equal(d.ref.id, 'A1b'); assert.match(d.evidence, /A1/);
  assert.equal(L.find(x => x.cat === 'unbalanced').sev, 'critical'); assert.equal(L.find(x => x.cat === 'unbalanced').impact, 10);
  assert.ok(L.every(x => x.type && x.key && x.fix), 'كل نتيجة لها نوع ومفتاح وحل مقترح'); assert.equal(new Set(L.map(x => x.key)).size, L.length, 'لا تكرار');
});

test('السجل: حالة واحدة لكل مشكلة، رقم مرجعي، موعد حسب الخطورة، ولا تكرار عند إعادة الفحص', () => {
  const L = E.ctlScan(org, ops, { today: '2026-03-01', anomalies: false });
  const s1 = E.caseSync([], L, { at: '2026-03-01T10:00:00Z' }); assert.equal(s1.res.created, L.length);
  const u = s1.list.find(c => c.cat === 'unbalanced'); assert.match(u.no, /^CASE-\d{6}$/); assert.equal(u.due, '2026-03-03'); assert.equal(u.status, 'new'); assert.equal(u.history.length, 1);
  const s2 = E.caseSync(s1.list, L, { at: '2026-03-02T10:00:00Z' }); assert.equal(s2.res.created, 0); assert.equal(s2.list.length, s1.list.length);
});

test('دورة الحياة: الحل ⇒ إعادة تحقق (تنجح أو تُعاد فتحًا)، والتكرار بعد التحقق يُعيد الفتح ويُحتسب', () => {
  const L = E.ctlScan(org, ops, { today: '2026-03-01', anomalies: false }); let { list } = E.caseSync([], L, { at: '2026-03-01T10:00:00Z' });
  const admin = { role: 'system_admin', name: 'م' }, clerk = { role: 'cashier', name: 'ك' };
  let c = list.find(x => x.cat === 'dup_invoice');
  assert.match(E.caseMove(c, 'verified', admin).err, /غير مسموح/);
  c = E.caseMove(c, 'review', clerk).c; assert.match(E.caseMove(c, 'resolved', clerk, '').err, /سبب/); c = E.caseMove(c, 'resolved', clerk, 'أُصدر إشعار دائن').c;
  list = list.map(x => x.id === c.id ? c : x);
  // المشكلة ما زالت قائمة ⇒ إعادة فتح
  let r = E.caseSync(list, L, { at: '2026-03-02T10:00:00Z' }); let c2 = r.list.find(x => x.id === c.id); assert.equal(c2.status, 'reopened'); assert.equal(c2.verify.result, 'fail');
  // بعد التصحيح الفعلي ⇒ تحقق ناجح
  const fixed = { ...ops, invoices: ops.invoices.filter(i => i.id !== 'A1b') }; const L2 = E.ctlScan(org, fixed, { today: '2026-03-01', anomalies: false });
  c2 = E.caseMove(E.caseMove(c2, 'review', clerk).c, 'resolved', clerk, 'حُذف المكرر').c; r = E.caseSync(r.list.map(x => x.id === c2.id ? c2 : x), L2, { at: '2026-03-03T10:00:00Z' });
  let c3 = r.list.find(x => x.id === c.id); assert.equal(c3.status, 'verified'); assert.equal(c3.verify.result, 'pass');
  assert.match(E.caseMove(c3, 'closed', clerk).err, /صلاحية الاعتماد/); c3 = E.caseMove(c3, 'closed', admin).c;
  // تكررت ⇒ إعادة فتح مع عدّاد التكرار
  r = E.caseSync(r.list.map(x => x.id === c3.id ? c3 : x), L, { at: '2026-03-10T10:00:00Z' }); const c4 = r.list.find(x => x.id === c.id);
  assert.equal(c4.status, 'reopened'); assert.equal(c4.occurrences, 2);
  // الإنذار الخاطئ لا يُعاد فتحه آليًا
  let fp = list.find(x => x.cat === 'equity_touch'); fp = E.caseMove(fp, 'false_positive', admin, 'توزيع أرباح معتمد').c;
  const r5 = E.caseSync(list.map(x => x.id === fp.id ? fp : x), L, { at: '2026-03-11T10:00:00Z' }); assert.equal(r5.list.find(x => x.id === fp.id).status, 'false_positive');
});

test('حالة مفتوحة اختفت مشكلتها تُعلَّم «عولجت» ولا تُغلق دون تأكيد بشري', () => {
  const L = E.ctlScan(org, ops, { today: '2026-03-01', anomalies: false }); const { list } = E.caseSync([], L, { at: '2026-03-01T10:00:00Z' });
  const r = E.caseSync(list, L.filter(x => x.cat !== 'future_date'), { at: '2026-03-02T10:00:00Z' }); const f = r.list.find(x => x.cat === 'future_date');
  assert.equal(f.status, 'new'); assert.equal(f.cleared, '2026-03-02T10:00:00Z'); assert.equal(r.res.cleared, 1);
});
