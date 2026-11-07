/**
 * اختبارات المحرك المحاسبي (v32.0) — تُشغَّل آليًا قبل كل نشر؛ أي إخلال بالأرقام يوقف النشر.
 * الأرقام المتوقعة محسوبة يدويًا ومطابقة لما تحقق في المتصفح عند بناء كل خاصية.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const tb = (A) => { const t = {}; A.entries.forEach(e => e.lines.forEach(l => { t[l.code] = Math.round(((t[l.code] || 0) + l.debit - l.credit) * 100) / 100; })); return t; };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, (msg || '') + ` — المتوقع ${b} والفعلي ${a}`);
const baseOrg = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: true, rate: 15 }, ...x });

test('SHA-256: متجه الاختبار القياسي', () => {
  assert.equal(E.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(E.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('فاتورة مورد خاضعة (دوري): مصروف 1000 + ضريبة مدخلات 150 = ذمم 1150، والميزان متوازن', () => {
  const ops = { invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', paidAmount: 0 }] };
  const A = E.buildAccounting(baseOrg({ suppliers: [{ id: 's1', name: 'م' }] }), ops);
  const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['5198'], 1000, 'مصروف المشتريات'); near(t['1501'], 150, 'ضريبة المدخلات'); near(t['2101'], -1150, 'ذمم الموردين');
});

test('الجرد المستمر: استلام 60×10 ثم صرف 6 ثم مرتجع 24 → المستودع 300، المورد 414، الضريبة 54، تكلفة المواد 60', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { perpetualFrom: '2026-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'العليا', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102' }] });
  const ops = {
    invoices: [
      { id: 'inv1', supplierId: 's1', supplierName: 'مورد', amount: 690, vatAmt: 90, taxable: true, date: '2026-03-02', paidAmount: 0, branchId: 'b1', whId: 'wh-b1', lines: [{ itemId: 'i1', qty: 60, unitCost: 10, net: 600, stock: true }] },
      { id: 'cn1', creditNote: true, supplierId: 's1', supplierName: 'مورد', amount: -276, vatAmt: -36, taxable: true, date: '2026-03-04', paidAmount: 0, branchId: 'b1', whId: 'wh-b1', appliesTo: 'inv1', lines: [{ itemId: 'i1', qty: -24, unitCost: 10, net: -240, stock: true }] }],
    whMoves: [
      { id: 'm1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 60, unitCost: 10, invoiceId: 'inv1', date: '2026-03-02', at: '2026-03-02T08:00:00Z' },
      { id: 'm2', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'out', qty: -6, date: '2026-03-03', at: '2026-03-03T08:00:00Z' },
      { id: 'm3', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: -24, unitCost: 10, invoiceId: 'cn1', date: '2026-03-04', at: '2026-03-04T08:00:00Z' }],
    stockMoves: [], whTransfers: [] };
  const A = E.buildAccounting(org, ops); const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['160102'], 300, 'حساب المستودع = الرصيد × المتوسط'); near(t['2101'], -414, 'ذمة المورد'); near(t['1501'], 54, 'ضريبة المدخلات'); near(t['5501'], 60, 'تكلفة المواد المصروفة');
  assert.equal(E.stockByWh(org, ops).byWh['wh-b1'].i1, 30, 'الكمية الفعلية في المستودع');
});

test('فواتير المبيعات: آجلتان 690+460 وتحصيل 300 وإشعار دائن 115 → ذمم 735، مبيعات 900، ضريبة 135، والسلسلة سليمة وتكشف العبث', () => {
  const org = baseOrg({ partners: [{ id: 'c1', key: 'cust:c1', name: 'عميل', type: 'customer', tax: '310000000000003', terms: 30 }] });
  let list = [];
  const add = (r) => { list = [...list, E.siStamp(list, r)]; return list[list.length - 1]; };
  const L = (desc, qty, price) => ({ desc, qty, price, vatRate: 15, net: qty * price, vat: Math.round(qty * price * 15) / 100 });
  const a = add({ id: 'a', kind: 'invoice', type: 'standard', date: '2026-04-01', customerKey: 'cust:c1', buyer: { name: 'عميل' }, lines: [L('تموين', 10, 50), L('مشروبات', 20, 5)], net: 600, vat: 90, total: 690, terms: 'credit', receipts: [] });
  add({ id: 'b', kind: 'invoice', type: 'standard', date: '2026-04-02', customerKey: 'cust:c1', buyer: { name: 'عميل' }, lines: [L('تموين', 4, 100)], net: 400, vat: 60, total: 460, terms: 'credit', receipts: [] });
  add({ id: 'c', kind: 'credit', refId: 'a', type: 'standard', date: '2026-04-03', customerKey: 'cust:c1', buyer: { name: 'عميل' }, lines: [{ src: 0, ...L('تموين', 2, 50) }], net: 100, vat: 15, total: 115, terms: 'credit', receipts: [] });
  list = list.map(x => x.id === 'a' ? { ...x, receipts: [{ id: 'r1', date: '2026-04-05', amount: 300, fund: '1201' }] } : x);
  assert.equal(list[0].no, 'فاتورة-2026-00001'); assert.equal(list[2].no, 'إشعار-2026-00001');
  const ops = { salesInvoices: list };
  const A = E.buildAccounting(org, ops); const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['1380'], 735, 'ذمم العملاء'); near(t['4102'], -900, 'المبيعات'); near(t['2301'], -135, 'ضريبة المخرجات'); near(t['1201'], 300, 'البنك');
  near(E.siRem(ops, list.find(x => x.id === 'a')), 275, 'المتبقي على الفاتورة الأولى = 690 − 300 − 115');
  const c = E.buildPartners(org, ops).find(p => p.id === 'c1'); near(c.balance, -735, 'كشف العميل');
  assert.equal(E.siVerify(list).ok, true);
  const tampered = JSON.parse(JSON.stringify(list)); tampered[0].lines[0].price = 40;
  assert.equal(E.siVerify(tampered).ok, false, 'تعديل السعر يُكتشف');
  assert.equal(E.siVerify([list[0], list[2]]).ok, false, 'حذف فاتورة يُكتشف');
});

test('نهاية الخدمة: المتراكم حسب نظام العمل وقواعد الاستقالة', () => {
  const e1 = { id: 'e1', hireDate: '2020-01-01', baseSalary: 4000, housingAllowance: 1000 };
  near(E.eosCumAt(e1, '2026-09-30'), 21230.32, 'خدمة 6.75 سنة بأجر 5000');
  near(E.eosEntitledAmt(3000, 1.5, 'resignation'), 0, 'استقالة قبل سنتين');
  near(E.eosEntitledAmt(3000, 4, 'resignation'), 3000 * 0.5 * 4 / 3, 'استقالة 2–5 سنوات = الثلث');
  near(E.eosEntitledAmt(3000, 7, 'resignation'), 3000 * (2.5 + 2) * 2 / 3, 'استقالة 5–10 سنوات = الثلثان');
  near(E.eosEntitledAmt(3000, 7, 'termination'), 3000 * 4.5, 'إنهاء من صاحب العمل = كاملة');
});

test('قيود مخصص نهاية الخدمة: افتتاحي 1000 + شهري 200 ثم صرف 1300 → المخصص صفر والميزان متوازن', () => {
  const org = baseOrg({ employees: [{ id: 'e1', name: 'أحمد', branchId: 'b1' }] });
  const ops = { ledgerEntries: [
    { id: 'o', kind: 'eos_open', month: '2026-01', date: '2026-01-01', lines: [{ empId: 'e1', branchId: 'b1', amt: 1000 }] },
    { id: 'a', kind: 'eos_accrual', month: '2026-01', date: '2026-01-31', lines: [{ empId: 'e1', branchId: 'b1', amt: 200 }] },
    { id: 'p', kind: 'eos_pay', empId: 'e1', name: 'أحمد', branchId: 'b1', date: '2026-02-10', entitled: 1300, leavePay: 0, fund: '1201' }] };
  const A = E.buildAccounting(org, ops); const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['2203'] || 0, 0, 'المخصص بعد الصرف'); near(t['5203'], 300, 'المصروف = 200 شهري + 100 زيادة الصرف'); near(t['3201'], 1000, 'الافتتاحي على الأرباح المبقاة'); near(t['1201'], -1300, 'البنك');
});

test('الإجازات: الاستحقاق 21 ثم 30 بعد خمس سنوات، وخصم المرضية بعد الثلاثين يومًا', () => {
  const org = baseOrg();
  near(E.leaveBalance(org, {}, { id: 'e1', hireDate: '2021-01-01' }, '2026-11-06').balance, 130.54, 'رصيد موظف تجاوز خمس سنوات');
  near(E.leaveBalance(org, {}, { id: 'e2', hireDate: '2026-01-01' }, '2026-11-06').balance, 17.84, 'رصيد موظف جديد');
  const ops = { leaveRequests: [{ id: 'old', employeeId: 'e2', type: 'sick', from: '2026-03-01', to: '2026-03-28', status: 'approved' }] };
  const plan = E.leaveDeductPlan(ops, { id: 'e2' }, 'sick', '2026-11-14', '2026-11-23');
  assert.deepEqual(plan.map(p => [p.month, p.pct, p.days]), [['2026-11', 25, 8]], 'يومان بأجر كامل ثم 8 أيام بخصم الربع');
  assert.equal(E.lvDays('2026-11-14', '2026-11-23'), 10);
});

test('ميزان المراجعة متوازن عند جمع كل الأنواع معًا', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'م' }], employees: [{ id: 'e1', name: 'أ', branchId: 'b1' }] });
  const ops = {
    invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', paidAmount: 0 }],
    ledgerEntries: [{ id: 'o', kind: 'eos_open', month: '2026-01', date: '2026-01-01', lines: [{ empId: 'e1', branchId: 'b1', amt: 500 }] }],
    journalManual: [{ id: 'j', date: '2026-03-06', title: 'رسوم بنك', lines: [{ code: '5901', debit: 25, credit: 0 }, { code: '1201', debit: 0, credit: 25 }] }] };
  const A = E.buildAccounting(org, ops);
  assert.equal(A.balanced, true); near(A.totalDebit, A.totalCredit, 'المدين = الدائن');
});

test('العنوان الوطني: التكوين والتحقق', () => {
  assert.equal(E.fmtNA({ bldg: '1234', street: 'الأمير سلطان', district: 'المحمدية', city: 'الرياض', zip: '12345', addl: '6789' }), 'مبنى 1234، شارع الأمير سلطان، حي المحمدية، الرياض 12345، الرقم الإضافي 6789');
  assert.match(E.naErr({ zip: '123' }), /5 أرقام/);
  assert.equal(E.naErr({ bldg: '1234', zip: '12345' }), '');
});

test('الدفتر المُرحَّل المجمَّد: البصمة ثابتة لنفس القيود وتتغير عند أي تعديل، والأشهر غير المجمَّدة تُحدد صحيحًا', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'م' }] });
  const ops = { invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', paidAmount: 0 }],
    journalManual: [{ id: 'j', date: '2026-04-06', title: 'رسوم', lines: [{ code: '5901', debit: 25, credit: 0 }, { code: '1201', debit: 0, credit: 25 }] }] };
  const A = E.buildAccounting(org, ops);
  const s1 = E.monthLedger(A, '2026-03');
  assert.equal(s1.n, 1); near(s1.dr, 1150); near(s1.cr, 1150);
  assert.equal(E.monthLedger(E.buildAccounting(org, ops), '2026-03').sig, s1.sig, 'نفس القيود = نفس البصمة');
  const ops2 = { ...ops, invoices: [{ ...ops.invoices[0], amount: 1160 }] };
  assert.notEqual(E.monthLedger(E.buildAccounting(org, ops2), '2026-03').sig, s1.sig, 'تعديل المبلغ يغيّر البصمة');
  assert.deepEqual(E.snapMonths(A, '2026-04', [{ month: '2026-03' }]), ['2026-04'], 'يُجمَّد ما لم يُجمَّد فقط');
  assert.deepEqual(E.snapMonths(A, '2026-03', []), ['2026-03'], 'لا يُجمَّد ما بعد حد القفل');
});

test('قراءة كشف MT940: الحركات بإشاراتها، والبيان متعدد الأسطر، وعكس القيد، والرصيدان', () => {
  const mt = [
    ':20:STMT2611', ':25:SA0380000000608010167519', ':28C:00011/001', ':60F:C261031SAR0,00',
    ':61:2611041104C5000,00NTRFNONREF//BR1', ':86:ايداع نقدي فرع العليا',
    ':61:2611061106D3000,00NTRFRENT11//BR2', ':86:تحويل ايجار', 'فرع العليا - نوفمبر',
    ':61:2611101110D25,00NCHG//BR3', ':86:رسوم خدمات بنكية',
    ':61:2611111111RD25,00NCHG//BR4', ':86:عكس رسوم',
    ':61:2611121112C1200,00NTRF//BR5', ':86:حوالة واردة من عميل',
    ':62F:C261130SAR3200,00', '-'].join('\r\n');
  const r = E.parseMt940(mt);
  assert.equal(r.account, 'SA0380000000608010167519');
  assert.deepEqual(r.lines.map(l => [l.date, l.amount]), [['2026-11-04', 5000], ['2026-11-06', -3000], ['2026-11-10', -25], ['2026-11-11', 25], ['2026-11-12', 1200]]);
  assert.equal(r.lines[1].desc, 'تحويل ايجار فرع العليا - نوفمبر');
  assert.deepEqual([r.open.amount, r.close.amount, r.close.date], [0, 3200, '2026-11-30']);
  near(r.lines.reduce((a, l) => a + l.amount, 0) + r.open.amount, r.close.amount, 'الافتتاحي + الحركات = الختامي');
  assert.equal(E.parseMt940('التاريخ,المبلغ\n2026-01-01,5'), null, 'ملف عادي ليس MT940');
});

test('نقطة البيع: الإجمالي والضريبة الشاملة والخصم، وملخص اليوم للإغلاق (النقد الصافي بعد الباقي، الشبكة، التطبيقات، استبعاد الملغاة)', () => {
  const T = E.posTotals([{ qty: 2, price: 23 }, { qty: 1, price: 8 }], 4, 15);
  near(T.gross, 54); near(T.disc, 4); near(T.total, 50); near(T.vat, 6.52); near(T.net, 43.48);
  const orders = [
    { branchId: 'b1', date: '2026-11-07', status: 'paid', total: 50, vat: 6.52, payments: [{ m: 'cash', amount: 100 }], change: 50 },
    { branchId: 'b1', date: '2026-11-07', status: 'paid', total: 30, vat: 3.91, payments: [{ m: 'cash', amount: 10 }, { m: 'card', amount: 20 }], change: 0 },
    { branchId: 'b1', date: '2026-11-07', status: 'paid', total: 45, vat: 5.87, payments: [{ m: 'app', appId: 'jahez', amount: 45 }], change: 0 },
    { branchId: 'b1', date: '2026-11-07', status: 'void', total: 99, vat: 12.91, payments: [{ m: 'cash', amount: 99 }], change: 0 },
    { branchId: 'b2', date: '2026-11-07', status: 'paid', total: 70, vat: 9.13, payments: [{ m: 'card', amount: 70 }], change: 0 }];
  near(E.posCashNet(orders[0]), 50, 'النقد الصافي = المدفوع − الباقي');
  const s = E.posDaySummary(orders, 'b1', '2026-11-07');
  assert.equal(s.n, 3, 'الملغاة وفواتير الفرع الآخر مستبعدة');
  near(s.total, 125); near(s.cash, 60); near(s.card, 20); near(s.apps.jahez.amount, 45); assert.equal(s.apps.jahez.n, 1);
  near(s.cash + s.card + s.apps.jahez.amount, s.total, 'مجموع طرق الدفع = إجمالي المبيعات');
});

test('استيراد نقاط البيع: فاتورة لكل سطر — كشف الأعمدة وتجميع يومي واستبعاد المكرر', () => {
  const grid = [
    ['تقرير المبيعات'],
    ['التاريخ', 'الفرع', 'رقم الفاتورة', 'الإجمالي', 'الضريبة', 'طريقة الدفع'],
    ['2026-11-01', 'فرع العليا', 'A1', '115', '15', 'نقدي'],
    ['2026-11-01', 'فرع العليا', 'A2', '230', '30', 'مدى'],
    ['2026-11-01', 'فرع العليا', 'A2', '230', '30', 'مدى'],
    ['2026-11-01', 'فرع العليا', 'A3', '57.5', '7.5', 'جاهز'],
    ['2026-11-02', 'فرع النسيم', 'B1', '46', '6', 'كاش'],
    ['', '', '', '448.5', '', 'المجموع'],
  ];
  const d = E.piDetect(grid);
  assert.equal(d.layout, 'invoice'); assert.equal(d.start, 2); assert.equal(d.map.pay, 5); assert.equal(d.map.no, 2);
  const apps = [{ id: 'jahez', n: 'جاهز' }];
  const payMap = {}; ['نقدي', 'مدى', 'جاهز', 'كاش'].forEach(v => { payMap[v] = E.PAY_GUESS(v, apps); });
  assert.deepEqual(payMap, { 'نقدي': 'cash', 'مدى': 'card', 'جاهز': 'app:jahez', 'كاش': 'cash' });
  const r = E.piAggregate(grid, { ...d, brMap: { 'فرع العليا': 'b1', 'فرع النسيم': 'b2' }, payMap });
  assert.equal(r.issues.dup, 1); assert.equal(r.issues.badDate, 1);
  assert.equal(r.days.length, 2);
  const a = r.days.find(x => x.branchId === 'b1');
  assert.equal(a.n, 3); near(a.total, 402.5); near(a.cash, 115); near(a.card, 230); near(a.apps.jahez.amount, 57.5); near(a.vat, 52.5);
  const ops = { posOrders: [], posImports: [{ ...a, id: 'p1' }] };
  const s = E.salesDaySource(ops, 'b1', '2026-11-01');
  assert.equal(s.src, 'import'); near(s.total, 402.5);
});

test('استيراد نقاط البيع: ملخص يومي بعمود لكل طريقة دفع', () => {
  const grid = [
    ['Date', 'Cash', 'Mada', 'Jahez', 'Total'],
    ['01/11/2026', '1,200.50', '800', '300', '2300.5'],
    ['02/11/2026', '900', '0', '100', '1000'],
  ];
  const d = E.piDetect(grid);
  assert.equal(d.layout, 'summary'); assert.equal(d.payCols.length, 3);
  const r = E.piAggregate(grid, { ...d, branchId: 'b1', brMap: {}, payMap: { Cash: 'cash', Mada: 'card', Jahez: 'app:jahez' } });
  assert.equal(r.days.length, 2);
  near(r.days[0].cash, 1200.5); near(r.days[0].card, 800); near(r.days[0].apps.jahez.amount, 300); near(r.days[0].total, 2300.5);
  near(r.days[1].total, 1000);
});
