/**
 * MUKTASAB FINANCE — المرحلة C: اختبارات السلامة المالية (Financial Integrity Tests)
 *
 * لكل تكامل: يُشغَّل المحرك الحقيقي (buildAccounting من App.jsx)، ثم يُفحص ناتجه بمحرك التحقق المستقل،
 * ويُقارن رصيد حساب الرقابة برقم **محسوب من السجلات المصدرية مباشرة** (لا من المحرك).
 * يحتاج esbuild (npm ci)؛ عند غيابه يُتخطّى مع السبب — والبوابة تعدّ التخطي «لم يُشغَّل».
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLedger, computeBalances, checkStatements, toH } from './ledger-validator.mjs';

let E = null, why = '';
try { const { buildEngine } = await import('../build-engine.mjs'); E = await buildEngine(); }
catch (e) { why = 'تعذّر بناء المحرك (غالبًا لم يُشغَّل npm ci): ' + String(e.message || e).split('\n')[0]; }
const run = (name, fn) => test(name, { skip: E ? false : why }, fn);

const KIND = { asset: 'asset', liab: 'liability', equity: 'equity', rev: 'revenue', exp: 'expense' };
/** تحويل ناتج المحرك إلى صيغة المحرك المستقل، مع أنواع الحسابات */
function ledgerOf(A) {
  return {
    tenant: 't', baseCurrency: 'SAR',
    accounts: (A.accounts || []).map(a => ({ code: String(a.code), kind: KIND[a.kind] || a.kind })),
    // معرّف تسلسلي: فحص تكرار المعرّف هنا للدفاتر المرحّلة فقط
    entries: (A.entries || []).map((e, i) => ({
      id: 'E' + i, date: e.date, tenant: 't', status: 'posted',
      lines: (e.lines || []).map(l => ({ acc: String(l.code), dr: l.debit || 0, cr: l.credit || 0 })),
    })),
  };
}
/** الرصيد بالهللات لحساب أو لكل الحسابات التي تبدأ بمقطع */
const balH = (lg, pred) => { const { bal } = computeBalances(lg); return Object.entries(bal).filter(([c]) => pred(c)).reduce((s, [, h]) => s + h, 0); };
const H = (x) => toH(x).h;
/** لا ملاحظات تمنع الاعتماد (الحسابات غير المعرّفة في الدليل المولّد تُتجاهل هنا) */
const clean = (lg) => { const r = validateLedger(lg); const bad = r.findings.filter(f => f.check !== 'posting.account-missing'); assert.deepEqual(bad, [], 'FINDINGS ' + JSON.stringify(bad)); assert.equal(r.tb.balanced, true); return r; };

const baseOrg = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع', isActive: true }], taxCfg: { enabled: true, rate: 15 }, ...x });
const closing = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'فرع', date: '2026-03-10', status: 'approved', totalRevenue: 1150, cashSales: 690, cardSales: 460,
  deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, actualCashCount: 690, expectedCashInSafe: 690, transferredToMainTreasury: 0, supplierPayments: [], ...x });

// ———— POS / الإغلاق ← الأستاذ ————
run('POS ← GL: إغلاقان معتمدان ومسودة — الإيراد الصافي وضريبة المخرجات من السجلات المصدرية مباشرة', () => {
  const cls = [closing(), closing({ id: 'c2', date: '2026-03-11', totalRevenue: 2300, cashSales: 1300, cardSales: 1000, actualCashCount: 1300, expectedCashInSafe: 1300 }),
    closing({ id: 'c3', date: '2026-03-12', status: 'draft', totalRevenue: 999, cashSales: 999, cardSales: 0 })];
  const lg = ledgerOf(E.buildAccounting(baseOrg(), { closings: cls })); clean(lg);
  // المتوقع من السجلات: المعتمدة فقط، الإيراد شامل الضريبة ÷ 1.15
  const gross = cls.filter(c => c.status === 'approved').reduce((s, c) => s + H(c.totalRevenue), 0);   // 345,000 هللة
  const net = Math.round(gross / 1.15), vat = gross - net;                                                  // 300,000 و 45,000
  assert.equal(-balH(lg, c => c.startsWith('4')), net, 'الإيراد الصافي');
  assert.equal(-balH(lg, c => c === '2301'), vat, 'ضريبة المخرجات');
  assert.equal(balH(lg, c => c.startsWith('1')), gross, 'النقد والشبكة = المقبوض الشامل');
});

// ———— المشتريات ← الذمم الدائنة والأستاذ (AP Aging = Control) ————
run('AP = حساب الرقابة 2101: المتبقي على فواتير الموردين من السجلات = رصيد الأستاذ', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'أ' }, { id: 's2', name: 'ب' }] });
  const invoices = [
    { id: 'i1', supplierId: 's1', supplierName: 'أ', amount: 1150, taxable: true, date: '2026-03-01', paidAmount: 0 },
    { id: 'i2', supplierId: 's1', supplierName: 'أ', amount: 460, vatAmt: 60, taxable: true, date: '2026-03-02', paidAmount: 300, pm: 'bank',
      payments: [{ id: 'p1', amount: 300, date: '2026-03-02', fund: '1201', pm: 'bank' }] },
    { id: 'i3', supplierId: 's2', supplierName: 'ب', amount: 690, taxable: true, date: '2026-03-03', paidAmount: 0 }];
  const lg = ledgerOf(E.buildAccounting(org, { invoices })); clean(lg);
  const openFromRecords = invoices.reduce((s, i) => s + H(i.amount) - (i.payments || []).reduce((t, p) => t + H(p.amount), 0), 0);   // 200,000 هللة
  assert.equal(-balH(lg, c => c === '2101'), openFromRecords, 'رصيد الموردين = المتبقي من السجلات');
  const parts = E.buildPartners(org, { invoices }).filter(p => p.type === 'supplier' || /^sup/.test(String(p.key || p.id)));
  if (parts.length) assert.equal(parts.reduce((s, p) => s + H(Math.abs(p.balance || 0)), 0), openFromRecords, 'مجموع كشوف الموردين = الرقابة');
});

// ———— المبيعات ← الذمم المدينة والأستاذ (AR Aging = Control) ————
run('AR = حساب الرقابة 1380: الفواتير − الإشعارات − المقبوضات من السجلات = رصيد الأستاذ وكشف العميل', () => {
  const org = baseOrg({ partners: [{ id: 'c1', key: 'cust:c1', name: 'عميل', type: 'customer', terms: 30 }] });
  const L = (desc, qty, price) => ({ desc, qty, price, vatRate: 15, net: qty * price, vat: Math.round(qty * price * 15) / 100 });
  let list = []; const add = (r) => { list = [...list, E.siStamp(list, r)]; };
  add({ id: 'a', kind: 'invoice', type: 'standard', date: '2026-04-01', customerKey: 'cust:c1', buyer: { name: 'عميل' }, lines: [L('تموين', 10, 50), L('مشروبات', 20, 5)], net: 600, vat: 90, total: 690, terms: 'credit', receipts: [] });
  add({ id: 'b', kind: 'invoice', type: 'standard', date: '2026-04-02', customerKey: 'cust:c1', buyer: { name: 'عميل' }, lines: [L('تموين', 4, 100)], net: 400, vat: 60, total: 460, terms: 'credit', receipts: [] });
  add({ id: 'c', kind: 'credit', refId: 'a', type: 'standard', date: '2026-04-03', customerKey: 'cust:c1', buyer: { name: 'عميل' }, lines: [{ src: 0, ...L('تموين', 2, 50) }], net: 100, vat: 15, total: 115, terms: 'credit', receipts: [] });
  list = list.map(x => x.id === 'a' ? { ...x, receipts: [{ id: 'r1', date: '2026-04-05', amount: 300, fund: '1201' }] } : x);
  const ops = { salesInvoices: list };
  const lg = ledgerOf(E.buildAccounting(org, ops)); clean(lg);
  const fromRecords = list.reduce((s, x) => s + (x.kind === 'credit' ? -1 : 1) * H(x.total) - (x.receipts || []).reduce((t, r) => t + H(r.amount), 0), 0);   // 73,500
  assert.equal(balH(lg, c => c === '1380'), fromRecords, 'رصيد العملاء = السجلات');
  const cust = E.buildPartners(org, ops).find(p => p.id === 'c1');
  assert.equal(H(-cust.balance), fromRecords, 'كشف العميل = الرقابة');
});

// ———— الأصول ← الأستاذ (Fixed Assets Register = GL) ————
run('سجل الأصول = الأستاذ: تكلفة الأصول القائمة في السجل = رصيد 1701، والمستبعد يخرج بتكلفته', () => {
  const assets = [
    { id: 'a1', name: 'فرن', cost: 12000, lifeYears: 1, buyDate: '2026-01-15', fund: '1201', disposedDate: '2026-07-10', salePrice: 8000, saleFund: '1201' },
    { id: 'a2', name: 'ثلاجة', cost: 6000, lifeYears: 5, buyDate: '2026-02-01', fund: '1201' },
    { id: 'a3', name: 'شاشة', cost: 1500.5, lifeYears: 3, buyDate: '2026-03-01', fund: '1201' }];
  const lg = ledgerOf(E.buildAccounting(baseOrg({ assets }), {})); clean(lg);
  const registerCost = assets.filter(a => !a.disposedDate).reduce((s, a) => s + H(a.cost), 0);   // 750,050 هللة
  assert.equal(balH(lg, c => c === '1701'), registerCost, 'تكلفة الأصول القائمة');
  assert.ok(balH(lg, c => c === '1791') <= 0, 'مجمّع الإهلاك دائن أو صفر');
});

// ———— الرواتب ← الأستاذ ————
run('الرواتب ← GL: استحقاق وسلفة وصرف — الحسابات تُقفل كما في السجلات', () => {
  const org = baseOrg({ employees: [{ id: 'e1', name: 'أ', branchId: 'b1' }] });
  const ops = {
    advances: [{ id: 'a1', employeeId: 'e1', employeeName: 'أ', branchId: 'b1', month: '2026-03', date: '2026-03-10', type: 'advance', amount: 500, paymentMethod: 'bank' }],
    ledgerEntries: [{ id: 'acc', kind: 'salary_accrual', month: '2026-03', date: '2026-03-28', credit: 10000 },
      { id: 'pay', kind: 'salary_payout', month: '2026-03', date: '2026-03-30', debit: 8950, gosi: 550, gosiEr: 1180, fund: '1201' }] };
  const lg = ledgerOf(E.buildAccounting(org, ops)); clean(lg);
  const accrual = H(10000), net = H(8950), gEmp = H(550), gEr = H(1180), adv = H(500);
  assert.equal(accrual, net + gEmp + adv, 'معادلة الراتب من السجلات');
  assert.equal(balH(lg, c => c === '2201'), 0, 'الرواتب المستحقة أُقفلت');
  assert.equal(-balH(lg, c => c === '2202'), gEmp + gEr, 'التأمينات المستحقة');
  assert.equal(balH(lg, c => c === '1201'), -(adv + net), 'البنك');
});

// ———— القوائم المالية = ميزان المراجعة (سيناريو مجمّع) ————
run('القوائم = الميزان: الأصول = الالتزامات + حقوق الملكية + صافي الربح على سيناريو مجمّع، وكل الحسابات مصنّفة', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'أ' }], employees: [{ id: 'e1', name: 'أ', branchId: 'b1' }],
    assets: [{ id: 'a2', name: 'ثلاجة', cost: 6000, lifeYears: 5, buyDate: '2026-02-01', fund: '1201' }] });
  const ops = { closings: [closing()], invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'أ', amount: 1150, taxable: true, date: '2026-03-01', paidAmount: 0 }],
    ledgerEntries: [{ id: 'acc', kind: 'salary_accrual', month: '2026-03', date: '2026-03-28', credit: 3000 }] };
  const lg = ledgerOf(E.buildAccounting(org, ops)); clean(lg);
  const used = new Set(lg.entries.flatMap(e => e.lines.map(l => l.acc)));
  const kinds = Object.fromEntries(lg.accounts.map(a => [a.code, a.kind]));
  const unclassified = [...used].filter(c => !['asset', 'liability', 'equity', 'revenue', 'expense'].includes(kinds[c]));
  assert.deepEqual(unclassified, [], 'كل حساب مستخدم له نوع يضعه في قائمة');
  assert.deepEqual(checkStatements(lg, {}), [], 'معادلة المركز المالي');
});
