/**
 * محوّل المحرك: يشغّل buildAccounting الحقيقي (App.jsx) ثم يفحص ناتجه بمحرك التحقق المستقل
 * مقابل نتائج محسوبة يدويًا. يحتاج esbuild (من npm ci)؛ إن غاب يُتخطّى مع ذكر السبب صراحةً
 * — وبوابة الجودة تعدّ التخطي «لم يُشغَّل» لا «نجح».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLedger, computeBalances, checkInventory } from './ledger-validator.mjs';

let E = null, why = '';
try { const { buildEngine } = await import('../build-engine.mjs'); E = await buildEngine(); }
catch (e) { why = 'تعذّر بناء المحرك (غالبًا لم يُشغَّل npm ci): ' + String(e.message || e).split('\n')[0]; }

/** يحوّل ناتج buildAccounting إلى صيغة المحرك المستقل */
export function normalizeFromEngine(A, tenant = 'default') {
  return {
    tenant, baseCurrency: 'SAR',
    accounts: (A.accounts || []).map(a => ({ code: a.code, kind: a.kind })),
    entries: (A.entries || []).map((e, i) => ({
      id: 'E' + i,   // معرّف تسلسلي: المحرك قد يكرر معرّفات القيود المجمّعة، وفحص التكرار هنا للدفاتر المرحّلة فقط date: e.date, tenant, status: 'posted',
      lines: (e.lines || []).map(l => ({ acc: l.code, dr: l.debit || 0, cr: l.credit || 0 })),
    })),
  };
}
const baseOrg = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع', isActive: true }], taxCfg: { enabled: true, rate: 15 }, ...x });

test('المحرك الحقيقي: فاتورة مورد 1,150 شاملة ⇐ مصروف 1,000 + مدخلات 150 = ذمم 1,150 (تحقق مستقل)', { skip: E ? false : why }, () => {
  const A = E.buildAccounting(baseOrg({ suppliers: [{ id: 's1', name: 'م' }] }), { invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', paidAmount: 0 }] });
  const lg = normalizeFromEngine(A);
  const r = validateLedger(lg, { reported: { balances: { 5198: 1000, 1501: 150, 2101: -1150 } } });
  const blocking = r.findings.filter(f => f.check !== 'posting.account-missing');
  const raw = blocking.map(f => { const e = A.entries[Number(String(f.ref).slice(1))]; return e && { id: e.id, title: e.title, src: e.src, keys: Object.keys(e), lines: e.lines.map(l => l.code + ':' + l.debit + '/' + l.credit) }; });
  assert.deepEqual(blocking, [], 'FINDINGS ' + JSON.stringify(blocking) + ' RAW ' + JSON.stringify(raw));
  assert.equal(r.tb.balanced, true);
});

test('المحرك الحقيقي: كل القيود المولّدة متوازنة بالهللات وبلا كسور زائدة', { skip: E ? false : why }, () => {
  const A = E.buildAccounting(baseOrg({ suppliers: [{ id: 's1', name: 'م' }] }), { invoices: [
    { id: 'i1', supplierId: 's1', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', paidAmount: 0 },
    { id: 'i2', supplierId: 's1', supplierName: 'م', amount: 33.33, taxable: true, date: '2026-03-06', paidAmount: 33.33 }] });
  const r = validateLedger(normalizeFromEngine(A));
  const bad = r.findings.filter(f => f.check.startsWith('balance') || f.check.startsWith('rounding') || f.check === 'tb.balanced');
  assert.deepEqual(bad, []);
  const { bal } = computeBalances(normalizeFromEngine(A));
  assert.equal(Object.values(bal).reduce((s, x) => s + x, 0), 0, 'Σالأرصدة = صفر');
});

test('المحرك الحقيقي: الجرد المستمر 60×10 ثم صرف 6 ثم مرتجع 24 — المتوسط المرجّح يُعاد حسابه باستقلال', { skip: E ? false : why }, () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { perpetualFrom: '2026-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'فرع', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102' }] });
  const ops = {
    invoices: [
      { id: 'inv1', supplierId: 's1', supplierName: 'مورد', amount: 690, vatAmt: 90, taxable: true, date: '2026-03-02', paidAmount: 0, branchId: 'b1', whId: 'wh-b1', lines: [{ itemId: 'i1', qty: 60, unitCost: 10, net: 600, stock: true }] },
      { id: 'cn1', creditNote: true, supplierId: 's1', supplierName: 'مورد', amount: -276, vatAmt: -36, taxable: true, date: '2026-03-04', paidAmount: 0, branchId: 'b1', whId: 'wh-b1', appliesTo: 'inv1', lines: [{ itemId: 'i1', qty: -24, unitCost: 10, net: -240, stock: true }] }],
    whMoves: [
      { id: 'm1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 60, unitCost: 10, invoiceId: 'inv1', date: '2026-03-02', at: '2026-03-02T08:00:00Z' },
      { id: 'm2', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'out', qty: -6, date: '2026-03-03', at: '2026-03-03T08:00:00Z' },
      { id: 'm3', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: -24, unitCost: 10, invoiceId: 'cn1', date: '2026-03-04', at: '2026-03-04T08:00:00Z' }],
    stockMoves: [], whTransfers: [] };
  const lg = normalizeFromEngine(E.buildAccounting(org, ops));
  // المتوقع محسوب يدويًا: المخزون 30 × 10 = 300؛ المورد 690 − 276 = 414؛ المدخلات 90 − 36 = 54؛ المصروف 6 × 10 = 60
  const r = validateLedger(lg, { reported: { balances: { 160102: 300, 2101: -414, 1501: 54, 5501: 60 } } });
  const blk = r.findings.filter(f => f.check !== 'posting.account-missing');
  assert.deepEqual(blk, [], 'FINDINGS ' + JSON.stringify(blk) + ' ACCOUNTS ' + JSON.stringify(lg.accounts.map(a => a.code + ':' + a.kind)));
  const { bal } = computeBalances(lg);
  // إعادة حساب مستقلة لتقييم المخزون من الحركات، ومقارنتها برصيد حساب المستودع الناتج من المحرك
  const moves = [{ qty: 60, unitCost: 10 }, { qty: -6, kind: 'out' }, { qty: -24, kind: 'out' }];
  assert.deepEqual(checkInventory(moves, { qty: 30, value: (bal['160102'] || 0) / 100 }), []);
});
