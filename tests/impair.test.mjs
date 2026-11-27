/**
 * v56.43 — الدفعة 10 (قرارات المجلس E8، IFRS for SMEs القسم 27): هبوط قيمة الأصول وعكسه، والإهلاك بعده للمستقبل.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const asset = { id: 'a1', name: 'فرن', cost: 12000, buyDate: '2024-12-15', lifeYears: 1, fund: '1201', branchId: 'b1' };   // 12 شهرًا: يناير–ديسمبر 2025 بـ 1000
const org = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, assets: [asset],
  customAccounts: [{ code: '1792', name: 'مجمع خسائر الهبوط', kind: 'asset' }, { code: '5806', name: 'خسارة هبوط قيمة الأصول', kind: 'exp' }], impair: { on: true, lossAcc: '5806', accAcc: '1792' } };
const doc = (id, kind, amount, date, x = {}) => ({ id, no: 'IMP-' + id, kind, assetId: 'a1', amount, date, reason: 'تلف', status: 'approved', by: 'أحمد', byId: 'u1', lossAcc: '5806', accAcc: '1792', ...x });
const bal = (A, code, upto) => Math.round(A.entries.filter(e => !upto || e.date <= upto).reduce((t, e) => t + (e.lines || []).filter(l => String(l.code) === code).reduce((a, l) => a + l.debit - l.credit, 0), 0) * 100) / 100;

test('E8: بلا مستندات كما كان', () => {
  const P = E.assetDepPlan(asset, []); assert.equal(P.length, 12); assert.ok(P.every(p => p.amt === 1000));
  assert.equal(bal(E.buildAccounting(org, {}), '1791'), -12000);
});

test('E8: هبوط 3000 في منتصف السنة — القيد، ثم قسط ثابت على المتبقي للمستقبل فقط، ومجموع الإهلاك + الهبوط = التكلفة', () => {
  const ops = { impairDocs: [doc('d1', 'imp', 3000, '2025-06-20')] };   // إهلاك يناير–يونيو 6000، والهبوط يسري من يوليو: المتبقي 12000−6000−3000 = 3000 على 6 أشهر = 500
  const A = E.buildAccounting(org, ops); const e = A.entries.find(x => x.id === 'imp:d1');
  assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['5806', 3000, 0], ['1792', 0, 3000]]); assert.equal(e.branchId, 'b1');
  const P = E.assetDepPlan(asset, ops.impairDocs); assert.deepEqual(P.slice(0, 6).map(p => p.amt), [1000, 1000, 1000, 1000, 1000, 1000], 'يونيو بالقسط القديم (الهبوط يسري من الشهر التالي)');
  assert.equal(P[6].amt, 500); assert.equal(Math.round(P.reduce((t, p) => t + p.amt, 0) * 100) / 100, 9000);
  assert.equal(bal(A, '1791', '2025-05-31'), -5000, 'ما قبل الهبوط لا يتغير');
  assert.equal(Math.round((bal(A, '1701') + bal(A, '1791') + bal(A, '1792')) * 100) / 100, 0, 'الدفتري صفر في نهاية العمر');
  const row = A.assetRows.find(r => r.id === 'a1'); assert.equal(row.impBal, 3000); assert.equal(row.book, 0);
});

test('E8.3: العكس في حدود القيمة الدفترية لو لم يقع هبوط (27.30)، وحدود الهبوط', () => {
  const A = E.buildAccounting(org, {});
  const ops = { impairDocs: [doc('d1', 'imp', 3000, '2025-06-20')] };
  const B = E.assetBookOn(asset, ops, '2025-09-10'); assert.deepEqual([B.impBal, B.book0, B.book], [3000, 4000, 2000]);   // إهلاك 6000 + يوليو وأغسطس 500×2
  assert.match(E.impCheck(org, ops, doc('n', 'rev', 3001, '2025-09-10', { status: 'pending' }), A), /رصيد الهبوط/);
  const lim = Math.round((B.book0 - B.book) * 100) / 100; assert.equal(E.impCheck(org, ops, doc('n', 'rev', lim, '2025-09-10', { status: 'pending' }), A), '');
  assert.match(E.impCheck(org, ops, doc('n', 'imp', 99999, '2025-09-10', { status: 'pending' }), A), /القيمة الدفترية/);
  assert.match(E.impCheck(org, ops, doc('n', 'imp', 100, '2999-01-01', { status: 'pending' }), A), /مستقبلي/);
  assert.match(E.impCheck({ ...org, impair: { on: true, lossAcc: '5806', accAcc: '1791' } }, ops, doc('n', 'imp', 100, '2025-09-10', { status: 'pending' }), A), /حسابي/);
  assert.match(E.impCheck({ ...org, periodLocks: { lockedThrough: '2025-09' } }, ops, doc('n', 'imp', 100, '2025-09-10', { status: 'pending' }), A), /مقفلة/);
});

test('E8: الاستبعاد يُقفل مجمع الهبوط، والربح والخسارة على الدفتري بعد الهبوط', () => {
  const o2 = { ...org, assets: [{ ...asset, disposedDate: '2025-08-15', salePrice: 1000, saleFund: '1201' }] };
  const A = E.buildAccounting(o2, { impairDocs: [doc('d1', 'imp', 3000, '2025-06-20')] });
  assert.equal(bal(A, '1792'), 0, 'مجمع الهبوط مُقفل'); assert.equal(bal(A, '1701'), 0); assert.equal(bal(A, '1791'), 0);
  const d = A.entries.find(e => e.id === 'disp:a1'); assert.equal(Math.round(d.lines.reduce((t, l) => t + l.debit - l.credit, 0) * 100), 0);
  // الدفتري عند البيع = 12000 − (6000 + 500 يوليو) − 3000 = 2500 ⇒ خسارة 1500 بسعر بيع 1000
  assert.equal(d.lines.find(l => l.code === '5801').debit, 1500);
});

test('E8.2/E8.4: الاعتماد لغير المنشئ ويثبّت الحسابين، وبند الإقفال السنوي لاختبار المؤشرات', () => {
  const A = E.buildAccounting(org, {}); const ops = { impairDocs: [doc('d1', 'imp', 1000, '2025-06-20', { status: 'pending', lossAcc: undefined, accAcc: undefined })] };
  assert.match(E.impApprove(org, ops, 'd1', { id: 'u1', name: 'أحمد', role: 'accountant' }, A).err, /من أنشأه/);
  const r = E.impApprove(org, ops, 'd1', { id: 'u2', name: 'سارة', role: 'finance_department' }, A); assert.deepEqual([r.next.impairDocs[0].lossAcc, r.next.impairDocs[0].accAcc], ['5806', '1792']);
  const C = E.closeAutoChecks(A, { closings: [] }, '2025-12', org); assert.equal(C.find(x => x.k === 'impair').n, 1, 'لا اختبار مؤشرات لسنة 2025');
  const C2 = E.closeAutoChecks(A, { closings: [], impairTests: [{ year: '2025', result: 'none' }] }, '2025-12', org); assert.equal(C2.some(x => x.k === 'impair'), false);
});
