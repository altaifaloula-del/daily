/**
 * v56.21 — MUKTASAB FINANCE E3: فروق الصرف غير المحققة (IFRS for SMEs 30.9–30.10 — قرار المالك: شهريًا بقيد ينعكس أول الشهر).
 * مثال رئيس المحاسبين (04-PHASE-E-ANALYSIS.md): فاتورة 10,000 يورو بسعر 4.00 (ذمة 40,000)، سعر آخر الشهر 4.10 ⇒ خسارة 1,000.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const tb = (A, upto) => { const t = {}; A.entries.filter(e => !upto || e.date <= upto).forEach(e => e.lines.forEach(l => { t[l.code] = Math.round(((t[l.code] || 0) + l.debit - l.credit) * 100) / 100; })); return t; };
const inv = (x = {}) => ({ id: 'i1', supplierId: 's1', supplierName: 'مورد أوروبي', date: '2026-10-10', amount: 40000, cur: 'EUR', fxRate: 4, fcAmount: 10000, ...x });
const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'مورد أوروبي' }], ...x });
const on = (rates) => org({ fxReval: { on: true, rates } });

test('E3: خسارة إعادة التقييم آخر الشهر في 5804/2109، وتنعكس أول الشهر التالي — و2101 لا يتغير', () => {
  const A = E.buildAccounting(on({ '2026-10': { EUR: 4.1 } }), { invoices: [inv()] });
  const e = A.entries.find(x => x.id === 'fxr:2026-10'); assert.equal(e.date, '2026-10-31'); assert.equal(e.balanced, true);
  const t = tb(A, '2026-10-31'); assert.equal(t['5804'], 1000); assert.equal(t['2109'], -1000); assert.equal(t['2101'], -40000, 'ذمة المورد بسعر الفاتورة كما هي');
  const r = A.entries.find(x => x.id === 'fxr:2026-10:rev'); assert.equal(r.date, '2026-11-01');
  const t2 = tb(A); assert.equal(t2['5804'] || 0, 0); assert.equal(t2['2109'] || 0, 0);
});

test('E3: السداد الجزئي قبل نهاية الشهر يخفض المتبقي، والربح عند انخفاض السعر', () => {
  const i = inv({ payments: [{ id: 'p', date: '2026-10-20', amount: 16000, paid: 16200, fc: 4000, rate: 4.05, fund: '1201' }], paidAmount: 16000 });
  const rows = E.fxRevalRows(on({ '2026-10': { EUR: 3.9 } }), { invoices: [i] }, '2026-10');
  assert.deepEqual(rows.map(r => [r.rem, r.diff]), [[6000, -600]]);
  const t = tb(E.buildAccounting(on({ '2026-10': { EUR: 3.9 } }), { invoices: [i] }), '2026-10-31');
  assert.equal(t['5804'], -600); assert.equal(t['2109'], 600); assert.equal(t['5803'], 200, 'الفرق المحقق من سعر الفاتورة الأصلي كما كان');
});

test('E3: بلا تفعيل، أو بلا سعر للعملة، أو فاتورة مسددة أو بعد الشهر ⇒ لا قيد', () => {
  assert.equal(E.buildAccounting(org({ fxReval: { on: false, rates: { '2026-10': { EUR: 4.1 } } } }), { invoices: [inv()] }).entries.some(x => String(x.id).startsWith('fxr:')), false);
  assert.equal(E.fxRevalRows(on({ '2026-10': { USD: 3.75 } }), { invoices: [inv()] }, '2026-10').length, 0);
  assert.equal(E.fxRevalRows(on({ '2026-10': { EUR: 4.1 } }), { invoices: [inv({ payments: [{ date: '2026-10-15', fc: 10000, amount: 40000 }] })] }, '2026-10').length, 0);
  assert.equal(E.fxRevalRows(on({ '2026-09': { EUR: 4.1 } }), { invoices: [inv()] }, '2026-09').length, 0);
});
