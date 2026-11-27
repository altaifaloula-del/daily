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
  assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['5806', 3000, 0], ['1792', 0, 3000]]);
  const P = E.assetDepPlan(asset, ops.impairDocs); assert.deepEqual(P.slice(0, 6).map(p => p.amt), [1000, 1000, 1000, 1000, 1000, 1000], 'يونيو بالقسط القديم (الهبوط يسري من الشهر التالي)');
  assert.equal(P[6].amt, 500); assert.equal(Math.round(P.reduce((t, p) => t + p.amt, 0) * 100) / 100, 9000);
  assert.equal(bal(A, '1791', '2025-05-31'), -5000, 'ما قبل الهبوط لا يتغير');
  assert.equal(Math.round((bal(A, '1701') + bal(A, '1791') + bal(A, '1792')) * 100) / 100, 0, 'الدفتري صفر في نهاية العمر');
  const row = A.assetRows.find(r => r.id === 'a1'); assert.equal(row.impBal, 3000); assert.equal(row.book, 0);
});

const ymAdd = (ym, k) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + k; return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0'); };
const td = new Date(); const cur = td.getFullYear() + '-' + String(td.getMonth() + 1).padStart(2, '0'); const dNow = cur + '-' + String(Math.min(td.getDate(), 28)).padStart(2, '0');
const a2 = { id: 'a2', name: 'ثلاجة', cost: 12000, buyDate: ymAdd(cur, -7) + '-15', lifeYears: 1, fund: '1201' };   // إهلاك من cur−6 حتى cur = 7000 ⇒ الدفتري 5000
const org2 = { ...org, assets: [a2] };

test('E8.3 + (التحقق المحاسبي): الدفتري يشمل إهلاك شهر المستند، فلا هبوط يجعله سالبًا؛ والعكس في حدود 27.30', () => {
  const A = E.buildAccounting(org2, {});
  assert.equal(E.assetBookOn(a2, {}, dNow).book, 5000);
  assert.match(E.impCheck(org2, {}, doc('n', 'imp', 5001, dNow, { assetId: 'a2', status: 'pending' }), A), /القيمة الدفترية/);
  assert.equal(E.impCheck(org2, {}, doc('n', 'imp', 5000, dNow, { assetId: 'a2', status: 'pending' }), A), '');
  const full = { impairDocs: [doc('f', 'imp', 5000, dNow, { assetId: 'a2' })] }; const Af = E.buildAccounting(org2, full);
  const b = (c) => Math.round(Af.entries.reduce((t, e) => t + e.lines.filter(l => l.code === c).reduce((x, l) => x + l.debit - l.credit, 0), 0) * 100) / 100;
  assert.ok(b('1701') + b('1791') + b('1792') >= -0.001, 'الدفتري لا يصير سالبًا');
  const ops = { impairDocs: [doc('d1', 'imp', 3000, ymAdd(cur, -3) + '-10', { assetId: 'a2' })] };   // هبوط معتمد سابق
  const B = E.assetBookOn(a2, ops, dNow); assert.deepEqual([B.impBal, B.book0, B.book], [3000, 5000, 3125]);
  assert.match(E.impCheck(org2, ops, doc('n', 'rev', 1876, dNow, { assetId: 'a2', status: 'pending' }), A), /27\.30/);
  assert.equal(E.impCheck(org2, ops, doc('n', 'rev', 1875, dNow, { assetId: 'a2', status: 'pending' }), A), '');
  assert.match(E.impCheck(org2, ops, doc('n', 'rev', 3001, dNow, { assetId: 'a2', status: 'pending' }), A), /رصيد الهبوط/);
});

test('E8.4 (قرار المجلس): الهبوط بتاريخ في الشهر الجاري فقط — لا يتغير إهلاك مضى، ولا مستقبلي، ولا حساب غير مسموح', () => {
  const A = E.buildAccounting(org2, {});
  assert.match(E.impCheck(org2, {}, doc('n', 'imp', 100, ymAdd(cur, -1) + '-10', { assetId: 'a2', status: 'pending' }), A), /الشهر الجاري/);
  assert.match(E.impCheck(org2, {}, doc('n', 'imp', 100, '2999-01-01', { assetId: 'a2', status: 'pending' }), A), /مستقبلي/);
  assert.match(E.impCheck({ ...org2, impair: { on: true, lossAcc: '5806', accAcc: '1791' } }, {}, doc('n', 'imp', 100, dNow, { assetId: 'a2', status: 'pending' }), A), /حسابي/);
  const before = E.buildAccounting(org2, {}).entries.filter(e => /^dep:/.test(e.id) && e.date.slice(0, 7) <= cur).map(e => e.id + ':' + e.lines[0].debit).join();
  const after = E.buildAccounting(org2, { impairDocs: [doc('x', 'imp', 1000, dNow, { assetId: 'a2' })] }).entries.filter(e => /^dep:/.test(e.id) && e.date.slice(0, 7) <= cur).map(e => e.id + ':' + e.lines[0].debit).join();
  assert.equal(after, before, 'قيود الإهلاك حتى الشهر الجاري لا تتغير');
  const imp = E.buildAccounting(org2, { impairDocs: [doc('x', 'imp', 1000, dNow, { assetId: 'a2' })] }).entries.find(e => e.id === 'imp:x'); assert.equal(imp.branchId, undefined, 'على المركز الرئيسي كالإهلاك');
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
  const A = E.buildAccounting(org2, {}); const ops = { impairDocs: [doc('d1', 'imp', 1000, dNow, { assetId: 'a2', status: 'pending', lossAcc: undefined, accAcc: undefined })] };
  assert.match(E.impApprove(org2, ops, 'd1', { id: 'u1', name: 'أحمد', role: 'accountant' }, A).err, /من أنشأه/);
  const r = E.impApprove(org2, ops, 'd1', { id: 'u2', name: 'سارة', role: 'finance_department' }, A); assert.deepEqual([r.next.impairDocs[0].lossAcc, r.next.impairDocs[0].accAcc], ['5806', '1792']);
  const C = E.closeAutoChecks(A, { closings: [] }, '2025-12', org); assert.equal(C.find(x => x.k === 'impair').n, 1, 'لا اختبار مؤشرات لسنة 2025');
  const C2 = E.closeAutoChecks(A, { closings: [], impairTests: [{ year: '2025', result: 'none' }] }, '2025-12', org); assert.equal(C2.some(x => x.k === 'impair'), false);
});
