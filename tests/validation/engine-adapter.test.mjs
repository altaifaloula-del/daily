/**
 * محوّل المحرك: يشغّل buildAccounting الحقيقي (App.jsx) ثم يفحص ناتجه بمحرك التحقق المستقل
 * مقابل نتائج محسوبة يدويًا. يحتاج esbuild (من npm ci)؛ إن غاب يُتخطّى مع ذكر السبب صراحةً
 * — وبوابة الجودة تعدّ التخطي «لم يُشغَّل» لا «نجح».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLedger, computeBalances } from './ledger-validator.mjs';

let E = null, why = '';
try { const { buildEngine } = await import('../build-engine.mjs'); E = await buildEngine(); }
catch (e) { why = 'تعذّر بناء المحرك (غالبًا لم يُشغَّل npm ci): ' + String(e.message || e).split('\n')[0]; }

/** يحوّل ناتج buildAccounting إلى صيغة المحرك المستقل */
export function normalizeFromEngine(A, tenant = 'default') {
  return {
    tenant, baseCurrency: 'SAR',
    accounts: (A.accounts || []).map(a => ({ code: a.code, kind: a.kind })),
    entries: (A.entries || []).map((e, i) => ({
      id: e.id || 'E' + i, date: e.date, tenant, status: 'posted',
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
  assert.deepEqual(blocking, []);
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
