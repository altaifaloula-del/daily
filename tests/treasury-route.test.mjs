/**
 * v56.29 — أوامر الصرف من الخزينة (توجيه المجلس بتفويض المالك): منع سداد الموردين والضريبة والرواتب منها، واعتماد بغير المنشئ.
 * معطّل افتراضيًا، ويسري من تاريخ بدء؛ ما قبله كما هو حرفيًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const base = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false } };
const ds = (id, date, category, amount, extra) => ({ id, date, category, amount, beneficiary: 'جهة', method: 'cash', by: 'أ', ...(extra || {}) });
const ent = (A, id) => A.entries.find(e => e.id === 'dis:' + id);
const lines = (e) => e.lines.map(l => l.code + ':' + l.debit + '/' + l.credit).join(',');

test('أوامر الصرف: الإعداد مطفأ ⇒ القيد كما كان حرفيًا (5901/1101)، وبلا منع', () => {
  const A = E.buildAccounting(base, { disbursements: [ds('a', '2026-11-10', 'سداد موردين', 1000)] });
  assert.equal(lines(ent(A, 'a')), '5901:1000/0,1101:0/1000'); assert.equal(ent(A, 'a').dsRoute, undefined);
  assert.equal(E.dsBlockReason(base, ds('a', '2026-11-10', 'سداد موردين', 1)), ''); assert.equal(E.dsRouteOpen(base), false);
});

test('التفعيل من 2026-12-01: ما قبله كما هو، والبنود الثلاثة ممنوعة بعده، والبقية مسموحة', () => {
  const org = { ...base, dsRoute: { ranges: [{ from: '2026-12-01' }] } };
  for (const c of ['سداد موردين', 'ضريبة القيمة المضافة', 'صرف رواتب']) {
    assert.equal(E.dsBlockReason(org, ds('x', '2026-11-30', c, 1)), '', c + ' قبل البدء');
    assert.match(E.dsBlockReason(org, ds('x', '2026-12-01', c, 1)), /لا يُصرف/, c + ' بعد البدء'); }
  assert.equal(E.dsBlockReason(org, ds('x', '2026-12-05', 'إيجارات الفروع', 1)), '');
  const A = E.buildAccounting(org, { disbursements: [ds('o', '2026-11-30', 'سداد موردين', 500), ds('n', '2026-12-02', 'إيجارات الفروع', 3000)] });
  assert.equal(lines(ent(A, 'o')), '5901:500/0,1101:0/500'); assert.equal(ent(A, 'o').dsRoute, undefined);
  assert.equal(lines(ent(A, 'n')), '5901:3000/0,1101:0/3000', 'الإيجار يبقى على 5901 حتى قرار الخريطة');
});

test('سجل ممنوع وصل من مصدر آخر داخل النطاق ⇒ يبقى على 5901 مع وسم للمراجعة (لا توجيه صامت)', () => {
  const org = { ...base, dsRoute: { ranges: [{ from: '2026-12-01' }] } };
  const A = E.buildAccounting(org, { disbursements: [ds('b', '2026-12-03', 'ضريبة القيمة المضافة', 400)] });
  assert.equal(lines(ent(A, 'b')), '5901:400/0,1101:0/400'); assert.equal(ent(A, 'b').dsRoute, 'blocked');
});

test('الاعتماد: المعلّق والمرفوض بلا قيد، والقديم بلا حالة مرحّل، والمعتمد يظهر بتاريخه', () => {
  const org = { ...base, dsRoute: { ranges: [{ from: '2026-12-01' }] } };
  const A = E.buildAccounting(org, { disbursements: [ds('p', '2026-12-02', 'صيانة وتشغيل', 100, { status: 'pending' }), ds('r', '2026-12-02', 'صيانة وتشغيل', 100, { status: 'rejected' }),
    ds('k', '2026-12-03', 'صيانة وتشغيل', 70, { status: 'posted' }), ds('old', '2026-10-01', 'صيانة وتشغيل', 50)] });
  assert.equal(ent(A, 'p'), undefined); assert.equal(ent(A, 'r'), undefined);
  assert.equal(ent(A, 'k').date, '2026-12-03'); assert.ok(ent(A, 'old'));
  assert.equal(E.dsLive({}), true); assert.equal(E.dsLive({ status: 'pending' }), false);
});

test('التوازن، ومجموعة الدفتر المخزّن «dis:» مصنّفة، وبصمة الأشهر المقفلة لا تتغير بالتفعيل', () => {
  const ops = { disbursements: [ds('a', '2026-10-05', 'سداد موردين', 900), ds('b', '2026-12-04', 'مصاريف إدارية', 60)] };
  const lockOrg = { ...base, periodLocks: { lockedThrough: '2026-11' } };
  const A1 = E.buildAccounting(lockOrg, ops), A2 = E.buildAccounting({ ...lockOrg, dsRoute: { ranges: [{ from: '2026-12-01' }] } }, ops);
  for (const A of [A1, A2]) for (const e of A.entries) assert.equal(Math.round(e.lines.reduce((t, l) => t + l.debit - l.credit, 0) * 100), 0, e.id);
  assert.ok(E.flGroupOf('dis:a') >= 0, 'مصنّف في مجموعة');
  assert.equal(E.lockedLedgerSig(lockOrg, ops, '2026-11'), E.lockedLedgerSig({ ...lockOrg, dsRoute: { ranges: [{ from: '2026-12-01' }] } }, ops, '2026-11'));
});

test('بداية الضوابط المفتوحة، والحالات غير «posted» لا تُرحَّل (مسحوب/مسودة)', () => {
  const org = { ...base, dsRoute: { ranges: [{ from: '2026-12-01', to: '2026-12-10' }, { from: '2026-12-20' }] } };
  assert.equal(E.dsOpenFrom(org), '2026-12-20'); assert.equal(E.dsOpenFrom(base), '');
  const A = E.buildAccounting(org, { disbursements: [ds('w', '2026-12-21', 'صيانة وتشغيل', 10, { status: 'withdrawn' }), ds('d', '2026-12-21', 'صيانة وتشغيل', 10, { status: 'draft' })] });
  assert.equal(ent(A, 'w'), undefined); assert.equal(ent(A, 'd'), undefined);
});

test('v56.30 (قرار المالك): أوامر الصرف حسب بنودها — الحساب المثبَّت على الأمر داخل النطاق، وإلا 5901', () => {
  const org = { ...base, customAccounts: [{ code: '5610', name: 'مصروف الإيجار', kind: 'exp' }], dsRoute: { ranges: [{ from: '2026-12-01' }], map: { 'إيجارات الفروع': '5610' } } };
  const A = E.buildAccounting(org, { disbursements: [
    ds('r1', '2026-12-02', 'إيجارات الفروع', 3000, { acc: '5610' }),          // ضمن النطاق ومثبَّت ⇒ 5610
    ds('r2', '2026-12-02', 'إيجارات الفروع', 100),                             // بلا تثبيت (قبل الخريطة) ⇒ 5901
    ds('r3', '2026-11-20', 'إيجارات الفروع', 200, { acc: '5610' }),            // قبل النطاق ⇒ 5901 حرفيًا
    ds('r4', '2026-12-03', 'صيانة وتشغيل', 50, { acc: '9999' }),               // حساب غير موجود ⇒ 5901
    ds('r5', '2026-12-03', 'ضريبة القيمة المضافة', 40, { acc: '5610' }),       // بند ممنوع لا يُوجَّه ⇒ 5901 + وسم
    ds('r6', '2026-12-03', 'صيانة وتشغيل', 60, { acc: '1101' }) ] });           // ليس مصروفًا ولا مخزونًا ⇒ 5901
  assert.equal(lines(ent(A, 'r1')), '5610:3000/0,1101:0/3000');
  for (const id of ['r2', 'r3', 'r4', 'r5', 'r6']) assert.equal(ent(A, id).lines[0].code, '5901', id);
  for (const e of A.entries) assert.equal(Math.round(e.lines.reduce((t, l) => t + l.debit - l.credit, 0) * 100), 0, e.id);
  // تغيير الخريطة لا يمس الأمر المسجل (الحساب على الأمر نفسه)
  const A2 = E.buildAccounting({ ...org, dsRoute: { ...org.dsRoute, map: {} } }, { disbursements: [ds('r1', '2026-12-02', 'إيجارات الفروع', 3000, { acc: '5610' })] });
  assert.equal(lines(ent(A2, 'r1')), '5610:3000/0,1101:0/3000');
});

test('v56.31 (قرارات المجلس T1/T3): داخل النطاق القيد بتاريخ الاعتماد والتحويل البنكي على البنك؛ خارجه كما كان', () => {
  const org = { ...base, dsRoute: { ranges: [{ from: '2026-12-01' }] } };
  const A = E.buildAccounting(org, { disbursements: [
    ds('a', '2026-12-02', 'صيانة وتشغيل', 100, { status: 'posted', postDate: '2026-12-05' }),
    ds('b', '2026-12-02', 'صيانة وتشغيل', 200, { status: 'posted', method: 'bank_transfer', fundAcc: '1201' }),
    ds('c', '2026-11-20', 'صيانة وتشغيل', 300, { postDate: '2026-12-09', fundAcc: '1201' }),     // قبل النطاق ⇒ كما كان
    ds('d', '2026-12-03', 'صيانة وتشغيل', 40, { status: 'posted', fundAcc: '5201' }) ] });        // ليس بنكًا ⇒ 1101
  assert.equal(ent(A, 'a').date, '2026-12-05'); assert.equal(lines(ent(A, 'a')), '5901:100/0,1101:0/100');
  assert.equal(lines(ent(A, 'b')), '5901:200/0,1201:0/200');
  assert.equal(ent(A, 'c').date, '2026-11-20'); assert.equal(lines(ent(A, 'c')), '5901:300/0,1101:0/300');
  assert.equal(lines(ent(A, 'd')), '5901:40/0,1101:0/40');
  assert.equal(E.dsCashOut({}), true); assert.equal(E.dsCashOut({ fundAcc: '1201' }), false);
});
