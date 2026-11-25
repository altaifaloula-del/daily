/** v56.0 — البنود المتبقية من أمر التصميم: البحث العام، اختصارات لوحة المفاتيح، محدد المنشأة، لوحات الأدوار. */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
let E; before(async () => { E = await buildEngine(); });

const org = { suppliers: [{ id: 's1', name: 'مؤسسة الإمداد', code: 'S-01' }], employees: [{ id: 'e1', name: 'أحمد الحربي', baseSalary: 9000 }],
  items: [{ id: 'i1', name: 'زيت زيتون', unit: 'لتر' }], products: [{ id: 'p1', name: 'كبسة لحم', sellPrice: 45 }] };
const ops = { invoices: [{ id: 'pi1', invoiceNo: 'A-778', supplierName: 'مؤسسة الإمداد', date: '2026-03-01', amount: 1150 }],
  salesInvoices: [{ id: 'si1', no: 'INV-2026-00012', buyer: { name: 'شركة النور' }, date: '2026-03-02', total: 575 }],
  journalManual: [{ id: 'j1', title: 'إيجار مارس', date: '2026-03-31' }], cashVouchers: [{ id: 'v1', no: 'PV-000004', date: '2026-03-03', amount: 300, note: 'سداد' }],
  closings: [{ id: 'c1', closingNo: 'TR-20260310-b1', branchName: 'العليا', date: '2026-03-10', totalRevenue: 1150 }] };
const screens = [{ id: 'acct', label: 'المالية والمحاسبة' }, { id: 'people', label: 'شؤون الموظفين' }, { id: 'purchasing', label: 'المشتريات' }];
const ALL = ['acct', 'people', 'purchasing', 'sales', 'closing', 'partners', 'inv', 'treasury'];

test('البحث العام: تطبيع العربية والأرقام — الهمزات والتاء المربوطة والتشكيل والأرقام الهندية', () => {
  assert.equal(E.gsNorm('أَحْمَد'), 'احمد'); assert.equal(E.gsNorm('مؤسسة'), 'مؤسسه'); assert.equal(E.gsNorm('٧٧٨'), '778');
  assert.equal(E.gsearch(org, ops, ALL, screens, 'احمد')[0].label, 'أحمد الحربي', 'بلا همزة يجد بالهمزة');
  assert.equal(E.gsearch(org, ops, ALL, screens, '٧٧٨')[0].go.peek.inv, 'pi1', 'أرقام هندية');
});

test('البحث العام: كل نوع يفتح مستنده أو شاشته', () => {
  const g = (q) => E.gsearch(org, ops, ALL, screens, q)[0];
  assert.deepEqual(g('INV-2026-00012').go, { peek: { si: 'si1' }, tab: 'sales' });
  assert.deepEqual(g('إيجار').go, { peek: { e: 'man:j1' }, tab: 'acct' });
  assert.deepEqual(g('PV-000004').go, { peek: { cv: 'v1' }, tab: 'acct' });
  assert.equal(g('TR-20260310').go.tab, 'closing'); assert.equal(g('كبسة').kind, 'prod'); assert.equal(g('زيت').kind, 'item');
  assert.equal(g('المشتريات').kind, 'screen'); assert.equal(E.gsearch(org, ops, ALL, screens, 'ا').length, 0, 'حرف واحد لا يبحث');
});

test('البحث العام يحترم الصلاحيات: لا شاشة ولا سجل خارج تبويبات المستخدم (كاشير بلا محاسبة ولا موظفين)', () => {
  const R = (q) => E.gsearch(org, ops, ['closing', 'pos'], screens, q);
  assert.equal(R('أحمد').length, 0, 'لا موظفين'); assert.equal(R('A-778').length, 0, 'لا فواتير موردين'); assert.equal(R('إيجار').length, 0, 'لا قيود');
  assert.equal(R('المالية').length, 0, 'لا شاشة المحاسبة'); assert.equal(R('TR-2026').length, 1, 'إغلاقاته فقط');
  assert.ok(!JSON.stringify(E.gsearch(org, ops, ALL, screens, 'أحمد')).includes('9000'), 'النتيجة لا تكشف الراتب');
});

test('اختصارات لوحة المفاتيح: الأوامر، ولا تعمل أثناء الكتابة عدا Ctrl/⌘+K', () => {
  const ev = (x, tag = 'BODY') => ({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, target: { tagName: tag }, ...x });
  assert.equal(E.kbAction(ev({ key: 'k', ctrlKey: true })), 'search'); assert.equal(E.kbAction(ev({ key: 'k', metaKey: true }, 'INPUT')), 'search', 'حتى داخل حقل');
  assert.equal(E.kbAction(ev({ key: '/' })), 'search'); assert.equal(E.kbAction(ev({ key: '/' }, 'INPUT')), '', 'الكتابة لا تُقاطع');
  assert.equal(E.kbAction(ev({ key: '?' })), 'help');
  for (const [code, a] of [['KeyH', 'home'], ['KeyB', 'back'], ['KeyM', 'side'], ['KeyD', 'mode'], ['KeyL', 'lang']]) assert.equal(E.kbAction(ev({ code, altKey: true })), a);
  assert.equal(E.kbAction(ev({ code: 'KeyH', altKey: true }, 'TEXTAREA')), ''); assert.equal(E.kbAction(ev({ key: 'p', ctrlKey: true })), '', 'لا يمس اختصارات المتصفح');
});

test('محدد المنشأة: قائمة الجهاز (الأحدث أولًا، بلا تكرار، حد 12، معرّفات صالحة) ورابط الانتقال ?t= فقط', () => {
  let L = E.tnRemember([], 'oasis', 'مطاعم الواحة'); L = E.tnRemember(L, 'sunbula', 'السنبلة'); L = E.tnRemember(L, 'oasis', 'الواحة <b>');
  assert.deepEqual(L.map(x => x.id), ['oasis', 'sunbula']); assert.equal(L[0].name, 'الواحة b');
  assert.deepEqual(E.tnRemember(L, '../evil', 'x'), L, 'معرّف غير صالح لا يُحفظ');
  for (let i = 0; i < 20; i++) L = E.tnRemember(L, 't' + i + 'x', 'n'); assert.equal(L.length, 12);
  assert.equal(E.tnHref({ pathname: '/mithqal/' }, 'oasis'), '/mithqal/?t=oasis');
  assert.equal(E.tnHref({ pathname: '/' }, 'https://evil.com'), '', 'لا روابط خارجية'); assert.equal(E.tnHref({ pathname: '/' }, 'a'), '', 'قصير جدًا');
});

/* ===================== لوحات الأدوار ===================== */
const cl = (x) => ({ id: 'c', branchId: 'b1', branchName: 'العليا', status: 'approved', totalRevenue: 1150, cashSales: 690, cardSales: 460, deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, actualCashCount: 690, expectedCashInSafe: 690, transferredToMainTreasury: 0, supplierPayments: [], ...x });
const dOrg = { company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا' }, { id: 'b2', name: 'النخيل' }], taxCfg: { enabled: true, rate: 15 },
  employees: [{ id: 'e1', branchId: 'b1', baseSalary: 6000, hireDate: '2020-01-01' }, { id: 'e2', branchId: 'b2', baseSalary: 3000, hireDate: '2026-03-16' }] };
const dOps = { closings: [cl({ id: 'm1', date: '2026-03-10' }), cl({ id: 'm2', date: '2026-03-11', totalRevenue: 2300, cashSales: 1380, cardSales: 920 }), cl({ id: 'f1', date: '2026-02-10' }), cl({ id: 'x', date: '2026-03-12', branchId: 'b2', status: 'draft' }), cl({ id: 'd', date: '2026-03-13', variance: -40 })],
  journalManual: [{ id: 'j1', date: '2026-03-20', title: 'إيجار', lines: [{ code: '5901', debit: 300, credit: 0 }, { code: '1201', debit: 0, credit: 300 }] }, { id: 'j2', date: '2026-03-21', status: 'pending', title: 'معلق', lines: [] }],
  invoices: [{ id: 'p1', supplierId: 's', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', dueDate: '2026-03-20', paidAmount: 0 }] };
const ALLD = ['acct', 'analytics', 'reporting', 'sales', 'pos', 'purchasing', 'inv', 'people', 'hrops', 'closing', 'approve', 'treasury'];

test('لوحات الأدوار: التسع معرّفة، والمتاح حسب التبويبات، والافتراضية حسب الدور', () => {
  assert.deepEqual(Object.keys(E.RD_DEF), ['exec', 'cfo', 'accountant', 'sales', 'purchasing', 'inventory', 'hr', 'branch', 'ops']);
  assert.equal(E.roleDashList('x', ALLD).length, 9);
  assert.deepEqual(E.roleDashList('cashier', ['pos', 'closing']), ['sales', 'branch', 'ops'], 'الكاشير لا يرى المالية ولا الموارد البشرية');
  assert.equal(E.roleDashDefault('cashier', ['pos', 'closing']), 'ops'); assert.equal(E.roleDashDefault('finance_department', ALLD), 'cfo');
  assert.equal(E.roleDashDefault('general_management', ['acct']), 'exec'); assert.equal(E.roleDashDefault('cost_controller', ['pos']), 'sales', 'الافتراضي غير متاح ⇒ أول متاح');
});

test('اللوحة التنفيذية/المالية = أرقام الدفتر نفسها: إيراد مارس 3000 (3450 شاملة) مقابل فبراير 1000، مصروف 300، وصافي 2700', () => {
  const D = E.roleDash(dOrg, dOps, 'exec', { td: '2026-03-25', allowed: ALLD }); const k = Object.fromEntries(D.kpis.map(x => [x.id, x]));
  const A = E.buildAccounting(dOrg, dOps); let rev = 0; A.entries.filter(e => e.date.startsWith('2026-03')).forEach(e => e.lines.forEach(l => { if (/^4/.test(l.code)) rev += l.credit - l.debit; }));
  assert.equal(k.rev.v, Math.round(rev * 100) / 100, 'من الدفتر'); assert.equal(k.rev.v, 4000, '(1150+2300+1150)/1.15'); assert.equal(k.rev.prev, 1000); assert.equal(k.rev.pct, 300);
  assert.equal(k.net.v, k.rev.v - k.exp.v); assert.equal(k.pend.v, 0); assert.equal(D.trend.length, 6); assert.equal(D.trend[5].m, '2026-03');
  const C = Object.fromEntries(E.roleDash(dOrg, dOps, 'cfo', { td: '2026-03-25', allowed: ALLD }).kpis.map(x => [x.id, x]));
  assert.equal(C.ap.v, 1150, 'ذمم الموردين'); assert.ok('vat' in C && 'cash' in C);
});

test('لوحات التشغيل: المحاسب والمشتريات والموارد البشرية والفرع بأرقام محسوبة يدويًا', () => {
  const g = (kind, o = {}) => Object.fromEntries(E.roleDash(dOrg, dOps, kind, { td: '2026-03-25', allowed: ALLD, ...o }).kpis.map(x => [x.id, x]));
  assert.equal(g('accountant').jpend.v, 1); assert.equal(g('accountant').jm.v, 2);
  const P = g('purchasing'); assert.equal(P.due.v, 1); assert.equal(P.dueAmt.v, 1150); assert.equal(P.pur.v, 1150);
  const H = g('hr'); assert.equal(H.emp.v, 2); assert.equal(H.payroll.v, 6000 + 1600, '6000 + (16→31 مارس = 16 يومًا × 3000/30 = 1600)');
  const B = g('branch', { branchIds: ['b1'] }); assert.equal(B.month.v, 4600, 'المحتسبة لفرعه فقط (المسودة وفرع آخر لا)'); assert.equal(B.deficit.v, 40); assert.equal(B.draft.v, 0);
  assert.equal(g('branch', { branchIds: ['b2'] }).draft.v, 1, 'فرع النخيل يرى مسودته فقط');
});

test('لوحات الأدوار: لا مؤشر يفتح شاشة خارج الصلاحية', () => {
  const D = E.roleDash(dOrg, dOps, 'exec', { td: '2026-03-25', allowed: ['acct'] });
  assert.ok(D.kpis.every(k => k.tab === '' || k.tab === 'acct'), 'treasury/approve غير مسموحين ⇒ بلا انتقال');
});
