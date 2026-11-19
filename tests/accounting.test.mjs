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

test('منع تكرار الفواتير: رقم المورد بعد التطبيع، والمبيعات المزدوجة خلال دقائق', () => {
  assert.equal(E.invNoNorm('INV-001'), E.invNoNorm('inv 1'));
  assert.equal(E.invNoNorm('٠٠٤٥'), '45');
  assert.notEqual(E.invNoNorm('100'), E.invNoNorm('10'));
  const prev = { invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'المراعي', invoiceNo: 'A-0045', amount: 500, date: '2026-11-01' }], salesInvoices: [] };
  // نفس المورد ونفس الرقم بصيغة مختلفة → مرفوض
  let d = E.findDupInvoices(prev, { ...prev, invoices: [...prev.invoices, { id: 'i2', supplierId: 's1', supplierName: 'المراعي', invoiceNo: 'a 45', amount: 500 }] });
  assert.equal(d.length, 1); assert.equal(d[0].kind, 'purchase');
  // مورد آخر بنفس الرقم، أو إشعار دائن بنفس الرقم → مقبول
  d = E.findDupInvoices(prev, { ...prev, invoices: [...prev.invoices, { id: 'i3', supplierId: 's2', invoiceNo: 'A-0045', amount: 500 }, { id: 'i4', supplierId: 's1', invoiceNo: 'A-0045', creditNote: true, amount: -50 }] });
  assert.equal(d.length, 0);
  // تكرار داخل الدفعة نفسها (استيراد) → مرفوض
  d = E.findDupInvoices({ invoices: [] }, { invoices: [{ id: 'x1', supplierId: 's1', invoiceNo: '7' }, { id: 'x2', supplierId: 's1', invoiceNo: '007' }] });
  assert.equal(d.length, 1);
  // تعديل فاتورة قائمة لا يُعد تكرارًا
  d = E.findDupInvoices(prev, { ...prev, invoices: [{ ...prev.invoices[0], amount: 520 }] });
  assert.equal(d.length, 0);
  // المبيعات: إصدار مزدوج خلال دقيقة → مرفوض؛ نفس البنود بعد ساعة → مقبول
  const si = { id: 's1', kind: 'invoice', date: '2026-11-07', customerKey: 'c:1', total: 115, lines: [{ desc: 'وجبة', qty: 2, price: 50 }], at: '2026-11-07T10:00:00Z', no: 'فاتورة-2026-00001' };
  d = E.findDupInvoices({ salesInvoices: [si] }, { salesInvoices: [si, { ...si, id: 's2', at: '2026-11-07T10:00:40Z' }] });
  assert.equal(d.length, 1); assert.equal(d[0].kind, 'sales');
  d = E.findDupInvoices({ salesInvoices: [si] }, { salesInvoices: [si, { ...si, id: 's3', at: '2026-11-07T11:30:00Z' }] });
  assert.equal(d.length, 0);
});

test('العروض: أفضل خصم واحد لكل صنف، خصم بطاقة الصنف، اشترِ X واحصل على Y، الجدولة والكوبون وعرض الفاتورة', () => {
  const products = [{ id: 'p1', name: 'برجر', sellPrice: 20, cat: 'وجبات' }, { id: 'p2', name: 'عصير', sellPrice: 10, cat: 'مشروبات', disc: { t: 'amt', v: 2 } }, { id: 'p3', name: 'بطاطس', sellPrice: 8, cat: 'وجبات' }];
  const cart = [{ key: 'a', productId: 'p1', price: 20, qty: 3 }, { key: 'b', productId: 'p2', price: 10, qty: 2 }, { key: 'c', productId: 'p3', price: 8, qty: 1 }];
  const now = new Date(2026, 10, 7, 16, 30);   // السبت 16:30
  const promos = [
    { id: 'm1', name: 'وجبات 10%', type: 'pct', value: 10, scope: 'cats', cats: ['وجبات'] },
    { id: 'm2', name: '2+1 برجر', type: 'bxgy', x: 2, y: 1, scope: 'items', items: ['p1'] },
    { id: 'm3', name: 'ساعة سعيدة', type: 'pct', value: 50, scope: 'cats', cats: ['مشروبات'], tFrom: '18:00', tTo: '20:00' },
    { id: 'm4', name: 'فوق 50', type: 'order', mode: 'pct', value: 5, minTotal: 50 },
    { id: 'm5', name: 'كوبون', type: 'amt', value: 3, scope: 'all', code: 'VIP' }
  ];
  const r = E.posPriceCart(cart, products, promos, { now, branchId: 'b1' });
  const L = Object.fromEntries(r.lines.map(l => [l.productId, l]));
  near(L.p1.disc, 20); assert.equal(L.p1.promoId, 'm2', 'الأفضل للعميل: 2+1 (20) أكبر من 10% (6)');
  near(L.p2.disc, 4); assert.equal(L.p2.promoName, 'خصم الصنف', 'الساعة السعيدة خارج وقتها');
  near(L.p3.disc, 0.8);
  near(r.sub, 60 - 20 + 20 - 4 + 8 - 0.8); near(r.orderDisc, r.sub * 0.05);
  // الكوبون: 3 ريال للوحدة على كل الأصناف → يتفوق على 10% للبطاطس (0.8) لكن ليس على 2+1
  const r2 = E.posPriceCart(cart, products, promos, { now, branchId: 'b1', code: 'vip' });
  assert.ok(r2.codeOk); near(r2.lines.find(l => l.productId === 'p3').disc, 3); near(r2.lines.find(l => l.productId === 'p2').disc, 6);
  // وقت الساعة السعيدة (يدعم ما بعد منتصف الليل أيضًا)
  assert.ok(E.promoActive(promos[2], new Date(2026, 10, 7, 19, 0), 'b1'));
  assert.ok(E.promoActive({ tFrom: '22:00', tTo: '02:00' }, new Date(2026, 10, 7, 1, 0)));
  assert.ok(!E.promoActive({ tFrom: '22:00', tTo: '02:00' }, new Date(2026, 10, 7, 12, 0)));
  assert.ok(!E.promoActive({ days: [4, 5] }, now), 'السبت ليس ضمن الخميس/الجمعة');
  assert.ok(!E.promoActive({ branches: ['b2'] }, now, 'b1'));
  // الإجماليات: خصومات الأسطر + الفاتورة، والضريبة من الصافي بعد الخصم
  const T = E.posTotals(r.lines, r.orderDisc, 15);
  near(T.gross, 88); near(T.ldisc, 24.8); near(T.total, 88 - 24.8 - r.orderDisc); near(T.vat, T.total * 15 / 115);
});

test('نقاط الولاء: الكسب والرصيد وحد الاستبدال وتوحيد رقم الجوال', () => {
  const cfg = { enabled: true, earnPer: 10, ptValue: 0.5, minRedeem: 20, maxRedeemPct: 50 };
  assert.equal(E.normPhone('+966 55 123 4567'), '551234567'); assert.equal(E.normPhone('٠٥٥١٢٣٤٥٦٧'), '551234567');
  assert.equal(E.loyEarn(cfg, 99.99), 9); assert.equal(E.loyEarn({ ...cfg, enabled: false }, 500), 0);
  const doc = { tx: [{ id: 'o1:e', phone: '551234567', pts: 30 }, { id: 'o2:e', phone: '551234567', pts: 15 }, { id: 'o2:r', phone: '551234567', pts: -20 }, { id: 'x', phone: '500000000', pts: 99 }] };
  assert.equal(E.loyBal(doc, '551234567'), 25);
  assert.equal(E.loyRedeemMax(cfg, 25, 100), 25, 'كل الرصيد: 12.5 ر.س أقل من سقف 50%');
  assert.equal(E.loyRedeemMax(cfg, 25, 20), 20, 'السقف 50% من 20 = 10 ر.س = 20 نقطة');
  assert.equal(E.loyRedeemMax(cfg, 19, 100), 0, 'تحت الحد الأدنى');
});

test('ملخص الوردية: المبيعات والخصومات حسب العرض والولاء والملغاة', () => {
  const os = [
    { status: 'paid', total: 50, vat: 6.52, gross: 60, payments: [{ m: 'cash', amount: 50 }], change: 0, lines: [{ disc: 10, promoName: '2+1' }], manualDisc: 0 },
    { status: 'paid', total: 90, vat: 11.74, gross: 100, payments: [{ m: 'card', amount: 90 }], lines: [], orderDisc: 5, orderPromo: { name: 'فوق 50' }, manualDisc: 2, loyalty: { redeemAmt: 3, redeemed: 6, earned: 9 } },
    { status: 'void', total: 30, lines: [], payments: [{ m: 'cash', amount: 30 }] }
  ];
  const s = E.posOrdersStats(os);
  assert.equal(s.n, 2); near(s.total, 140); near(s.cash, 50); near(s.card, 90);
  near(s.promo['2+1'], 10); near(s.promo['فوق 50'], 5); near(s.mdisc, 2); near(s.loyAmt, 3); assert.equal(s.loyEarned, 9);
  assert.equal(s.voidN, 1); near(s.voidAmt, 30);
});

// ===== v38.2 — ضوابط المخزون وإدخال الأرقام =====
test('التفقيط: صيغ عربية صحيحة للأعداد', () => {
  const T = E.tafqeet;
  assert.equal(T(1), 'واحد'); assert.equal(T(11), 'أحد عشر'); assert.equal(T(21), 'واحد وعشرون'); assert.equal(T(215), 'مائتان وخمسة عشر');
  assert.equal(T(1000), 'ألف'); assert.equal(T(2000), 'ألفان'); assert.equal(T(3500), 'ثلاثة آلاف وخمسمائة'); assert.equal(T(15000), 'خمسة عشر ألفًا');
  assert.equal(T(250750), 'مائتان وخمسون ألفًا وسبعمائة وخمسون'); assert.equal(T(2300000), 'مليونان وثلاثمائة ألف');
});

test('معامل الناتج: المصروف الخام = الصافي ÷ الناتج، وخارج 1–99 يُعامل 100%', () => {
  assert.equal(E.partGross({ qty: 0.41, yield: 82 }), 0.5);
  assert.equal(E.partGross({ qty: 0.3 }), 0.3);
  assert.equal(E.partYield({ qty: 1, yield: 150 }), 100);
  assert.equal(E.partYield({ qty: 1, yield: 0 }), 100);
});

test('الهدر: الحدود الافتراضية، وقيمة الهدر اليومي ونسبتها من مبيعات الإغلاق', () => {
  assert.deepEqual(E.wasteCfg({}), { photoOver: 50, approveOver: 300, capPct: 2 });
  assert.deepEqual(E.wasteCfg({ wasteCfg: { photoOver: 0, approveOver: '', capPct: 5 } }), { photoOver: 0, approveOver: 300, capPct: 5 });
  const org = baseOrg({ items: [{ id: 'i1', name: 'لحم', unit: 'كجم' }], warehouses: [{ id: 'wh-b1', kind: 'branch', branchId: 'b1', active: true }] });
  const ops = { whMoves: [{ id: 'w1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'waste', qty: -3, wasteVal: 120, date: '2026-05-02' }, { id: 'w2', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'waste', qty: -1, wasteVal: 40, date: '2026-05-02' }],
    closings: [{ id: 'c1', branchId: 'b1', date: '2026-05-02', status: 'approved', totalRevenue: 4000 }] };
  const d = E.wasteDaily(org, ops, {}, '2026-05-01', '2026-05-31');
  assert.deepEqual(d, [{ branchId: 'b1', date: '2026-05-02', waste: 160, sales: 4000, pct: 4 }]);
});

test('الهدر المعتمد: قيد 5502 مدين مقابل حساب مخزون المستودع (الجرد المستمر)', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'لحم', unit: 'كجم' }], purchaseCfg: { perpetualFrom: '2026-01' },
    warehouses: [{ id: 'wh-b1', name: 'مستودع', kind: 'branch', branchId: 'b1', accCode: '160102', active: true }] });
  const ops = { whMoves: [{ id: 'in1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'in', qty: 50, unitCost: 40, date: '2026-05-01', at: '2026-05-01T08:00:00' },
    { id: 'w1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'waste', qty: -10, wasteVal: 400, reason: 'expired', approvedBy: 'سارة', date: '2026-05-02', at: '2026-05-02T09:00:00' }] };
  const A = E.buildAccounting(org, ops); const t = tb(A);
  assert.equal(A.balanced, true); near(t['5502'], 400, 'مصروف الهدر'); near(t['160102'], 1600, 'مخزون المستودع بعد الهدر');
});

// ===== v38.5 — صيانة النظام: فحوص سلامة البيانات =====
test('فحوص السلامة: بيانات سليمة ← كل الفحوص سليمة', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'لحم', unit: 'كجم' }], products: [{ id: 'p1', name: 'وجبة', parts: [{ itemId: 'i1', qty: 1 }] }],
    cashflowCfg: { vatFreq: 'monthly', fyEnd: '12-31', sched: [{ id: 'z', kind: 'zakat', amount: 1, date: '2099-01-01', every: 'once' }] },
    documents: [{ id: 'cr', type: 'cr', number: '1010', expiryDate: '2099-01-01' }] });
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: '2099-01-01', status: 'approved', totalRevenue: 100 }], invoices: [] };
  const C = E.integrityChecks(org, ops);
  assert.deepEqual(C.filter(c => c.st !== 'ok').map(c => c.id), []);
});
test('فحوص السلامة: تكشف الرصيد السالب والفاتورة المكررة والسجل اليتيم والوصفة المكسورة والإغلاق العالق', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'لحم', unit: 'كجم' }], products: [{ id: 'p1', name: 'وجبة', parts: [{ itemId: 'gone', qty: 1 }] }],
    warehouses: [{ id: 'wh-b1', name: 'مستودع', kind: 'branch', branchId: 'b1', active: true }] });
  const ops = {
    whMoves: [{ id: 'm1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'out', qty: -5, date: '2026-05-01' }],
    invoices: [{ id: 'v1', supplierId: 's1', supplierName: 'م', invoiceNo: '77', amount: 10, date: '2026-05-01' }, { id: 'v2', supplierId: 's1', supplierName: 'م', invoiceNo: '077', amount: 10, date: '2026-05-02' }],
    closings: [{ id: 'c1', branchId: 'b1', branchName: 'العليا', date: '2020-01-01', status: 'submitted', totalRevenue: 100 }, { id: 'c2', branchId: 'deleted-branch', date: '2026-01-01', status: 'approved' }]
  };
  const C = Object.fromEntries(E.integrityChecks(org, ops).map(c => [c.id, c]));
  assert.equal(C.stock.st, 'bad'); assert.match(C.stock.items[0], /لحم \(-5\)/);
  assert.equal(C.dupinv.st, 'bad', 'رقم 77 و077 نفس الفاتورة');
  assert.equal(C.orphans.st, 'warn'); assert.match(C.orphans.detail, /1 إغلاق/);
  assert.equal(C.recipes.st, 'warn');
  assert.equal(C.closings.st, 'warn');
  assert.equal(C.tb.st, 'ok');
});
test('سجل الأخطاء: التجميع حسب النوع مع العدد وآخر ظهور والمستخدمين', () => {
  const G = E.groupErrors([{ id: 'a', sig: 's1', msg: 'x', at: '2026-11-01T10:00', email: 'a@x', branchId: 'b1', v: 'v38.5' },
    { id: 'b', sig: 's1', msg: 'x', at: '2026-11-03T10:00', email: 'b@x', branchId: 'b1', v: 'v38.5' }, { id: 'c', sig: 's2', msg: 'y', at: '2026-11-02T10:00', email: 'a@x' }]);
  assert.equal(G.length, 2); assert.equal(G[0].sig, 's1'); assert.equal(G[0].n, 2); assert.equal(G[0].last, '2026-11-03T10:00');
  assert.deepEqual(G[0].users.sort(), ['a@x', 'b@x']); assert.deepEqual(G[0].ids, ['a', 'b']);
});

// ===== v38.6 — كشف الأنماط الشاذة =====
const TD = '2026-11-10';
const dAgo = (k) => { const d = new Date(TD + 'T12:00:00'); d.setDate(d.getDate() - k); return d.toISOString().slice(0, 10); };
// تسعة أسابيع من الإغلاقات اليومية بمبيعات ثابتة حسب اليوم مع تذبذب طبيعي ±5%
const closingsFor = (b, f) => Array.from({ length: 63 }, (_, k) => ({ id: b + k, branchId: b, date: dAgo(k), status: 'approved', totalRevenue: f(k), expenses: [] }));
const normal = (k) => 5000 + (k % 7) * 300 + ((k * 37) % 11 - 5) * 50;
const anOrg = () => baseOrg({ branches: [{ id: 'b1', name: 'العليا', isActive: true }, { id: 'b2', name: 'النسيم', isActive: true }] });

test('الأنماط الشاذة: نشاط طبيعي متذبذب ← لا تنبيهات', () => {
  const A = E.detectAnomalies(anOrg(), { closings: [...closingsFor('b1', normal), ...closingsFor('b2', normal)] }, { today: TD });
  assert.deepEqual(A.map(a => a.id), []);
});
test('الأنماط الشاذة: هبوط مبيعات 60% أمس ← حاد، وارتفاع ×3 (صفر زائد) ← تنبيه', () => {
  const cl = [...closingsFor('b1', (k) => k === 1 ? normal(k) * 0.4 : normal(k)), ...closingsFor('b2', (k) => k === 2 ? normal(k) * 3 : normal(k))];
  const A = E.detectAnomalies(anOrg(), { closings: cl }, { today: TD });
  const drop = A.find(a => a.id.startsWith('sales-drop|b1|')), spike = A.find(a => a.id.startsWith('sales-spike|b2|'));
  assert.ok(drop && drop.sev === 'high' && drop.date === dAgo(1) && drop.pct <= -55, JSON.stringify(drop));
  assert.ok(spike && spike.pct >= 190, JSON.stringify(spike));
  assert.equal(A.length, 2);
});
test('الأنماط الشاذة: تاريخ قصير (أقل من 4 أسابيع) ← لا حكم', () => {
  const cl = closingsFor('b1', normal).filter(c => c.date >= dAgo(20)).map(c => c.date === dAgo(1) ? { ...c, totalRevenue: 100 } : c);
  assert.deepEqual(E.detectAnomalies(anOrg(), { closings: cl }, { today: TD }), []);
});
test('الأنماط الشاذة: مصروف تضاعف هذا الأسبوع، ومورد رفع سعره، وكاشير يلغي أكثر من زملائه', () => {
  const cl = closingsFor('b1', normal).map((c, k) => ({ ...c, expenses: k % 7 === 0 ? [{ categoryName: 'صيانة', amount: k < 7 ? 1500 : 400 }] : [] }));
  const po = (id, d, price) => ({ id, supplierName: 'مؤسسة اللحوم', date: d, lines: [{ itemId: 'i1', qty: 10, price, received: 10 }] });
  const purchaseOrders = [po('p1', dAgo(120), 40), po('p2', dAgo(90), 41), po('p3', dAgo(60), 40), po('p4', dAgo(30), 40.5), po('p5', dAgo(3), 48)];
  const orders = []; ['سعد', 'خالد', 'ريم'].forEach(who => { for (let i = 0; i < 40; i++) orders.push({ id: who + i, by: who, branchId: 'b1', date: dAgo(i % 10), total: 50, status: (who === 'سعد' ? i < 6 : i < 1) ? 'void' : 'paid' }); });
  const org = { ...anOrg(), items: [{ id: 'i1', name: 'لحم', unit: 'كجم' }] };
  const A = E.detectAnomalies(org, { closings: cl, purchaseOrders, posOrders: orders }, { today: TD });
  const exp = A.find(a => a.area === 'expense'); assert.ok(exp && exp.title.includes('صيانة') && exp.value === 1500 && exp.expected === 400, JSON.stringify(exp));
  const pr = A.find(a => a.area === 'price'); assert.ok(pr && pr.pct >= 19 && pr.title.includes('لحم'), JSON.stringify(pr));
  const vd = A.filter(a => a.area === 'pos'); assert.equal(vd.length, 1); assert.ok(vd[0].title.includes('سعد'));
});

// ===== v38.7 — سجل الإجراءات وقياس الأثر =====
test('الإجراءات: إجراء من نمط شاذ يحمل مقياسه ومفتاحًا ثابتًا لا يتكرر يوميًا', () => {
  const cl = closingsFor('b1', normal).map((c, k) => ({ ...c, expenses: k % 7 === 0 ? [{ categoryName: 'صيانة', amount: k < 7 ? 1500 : 400 }] : [] }));
  const ops = { closings: cl };
  const a = E.detectAnomalies(anOrg(), ops, { today: TD }).find(x => x.area === 'expense');
  const act = E.actionFromAnomaly(anOrg(), ops, { name: 'مجاهد' }, a, { assignee: 'خالد' }, TD);
  assert.equal(act.status, 'open'); assert.equal(act.src, 'anomaly'); assert.equal(act.assignee, 'خالد'); assert.equal(act.branchId, 'b1');
  assert.deepEqual(act.metric, { kind: 'expense_week', key: 'b1|صيانة', normal: 400, before: 1500 });
  assert.equal(act.srcKey, 'exp|b1|صيانة', 'بلا تاريخ اليوم');
  assert.equal(act.due, '2026-11-17');
});
test('الإجراءات: قياس الأثر بعد أسبوع من الإنجاز — تحسّن، لم يتحسّن، قيد القياس', () => {
  const act = { status: 'done', doneAt: '2026-11-10T09:00:00Z', metric: { kind: 'expense_week', key: 'b1|صيانة', normal: 400, before: 1500 } };
  const opsWith = (amt) => ({ closings: [{ id: 'x', branchId: 'b1', date: '2026-11-16', status: 'approved', totalRevenue: 1, expenses: [{ categoryName: 'صيانة', amount: amt }] }] });
  assert.equal(E.actionEffect(anOrg(), opsWith(500), act, '2026-11-15').pending, true, 'قبل مرور أسبوع');
  const good = E.actionEffect(anOrg(), opsWith(500), act, '2026-11-17'); assert.equal(good.better, true); assert.equal(good.now, 500);
  const bad = E.actionEffect(anOrg(), opsWith(1300), act, '2026-11-17'); assert.equal(bad.better, false, 'تحرّك أقل من نصف المسافة');
  const worse = E.actionEffect(anOrg(), opsWith(1800), act, '2026-11-17'); assert.equal(worse.worse, true);
  assert.equal(E.actionEffect(anOrg(), opsWith(500), { ...act, status: 'doing' }, '2026-11-17'), null, 'غير المنجز لا يُقاس');
});
test('الإجراءات: مقياس المبيعات أعلى أفضل، ونسبة إلغاء الكاشير', () => {
  const ops = { closings: [{ id: 'a', branchId: 'b1', date: '2026-11-09', status: 'approved', totalRevenue: 4000 }, { id: 'b', branchId: 'b1', date: '2026-11-10', status: 'approved', totalRevenue: 6000 }],
    posOrders: Array.from({ length: 20 }, (_, i) => ({ id: 'o' + i, by: 'سعد', date: '2026-11-08', status: i < 2 ? 'void' : 'paid' })) };
  assert.equal(E.actionMetric(anOrg(), ops, { kind: 'sales_day', key: 'b1' }, TD), 5000);
  assert.equal(E.actionMetric(anOrg(), ops, { kind: 'void_rate', key: 'سعد' }, TD), 10);
  const up = E.actionEffect(anOrg(), ops, { status: 'done', doneAt: '2026-11-01', metric: { kind: 'sales_day', key: 'b1', normal: 5300, before: 2100 } }, TD);
  assert.equal(up.better, true, 'من 2100 إلى 5000 نحو المعتاد 5300');
});

// ===== v38.8 — توقع المبيعات =====
test('التوقع: نمط أسبوعي ثابت ← توقع كل يوم من الأسبوع بدقة، والمدى يحيط بالقيمة', () => {
  const pat = [6000, 4200, 4400, 4600, 7000, 9000, 6500];   // الأحد..السبت
  const dw = (iso) => new Date(iso + 'T12:00:00').getDay();
  const cl = Array.from({ length: 63 }, (_, k) => { const d = dAgo(k); return { id: 'c' + k, branchId: 'b1', date: d, status: 'approved', totalRevenue: pat[dw(d)] * (1 + (((k * 37) % 11) - 5) / 200) }; });
  const F = E.forecastSales(anOrg(), { closings: cl }, { today: TD, days: 7 });
  const b = F.branches.find(x => x.id === 'b1');
  assert.equal(b.days.length, 7);
  b.days.forEach(x => { const exp = pat[dw(x.date)]; assert.ok(Math.abs(x.f - exp) / exp < 0.04, x.date + ' ' + x.f + ' vs ' + exp); assert.ok(x.lo <= x.f && x.f <= x.hi); });
  assert.ok(b.mape != null && b.mape < 4, 'دقة الاختبار الرجعي ' + b.mape);
  assert.equal(F.branches.find(x => x.id === 'b2').days.length, 0, 'فرع بلا تاريخ ← لا توقع');
});
test('التوقع: يوم شاذ في التاريخ لا يشوّه التوقع، والاتجاه الصاعد يرفعه بأثر مخفّف', () => {
  const cl = Array.from({ length: 63 }, (_, k) => ({ id: 'c' + k, branchId: 'b1', date: dAgo(k), status: 'approved', totalRevenue: k === 7 ? 50000 : 5000 }));
  const F = E.forecastSales(anOrg(), { closings: cl }, { today: TD, days: 7 });
  F.branches[0].days.forEach(x => assert.ok(Math.abs(x.f - 5000) < 1, 'الشاذ (50,000) مستبعد: ' + x.f));
  const up = Array.from({ length: 63 }, (_, k) => ({ id: 'u' + k, branchId: 'b1', date: dAgo(k), status: 'approved', totalRevenue: k < 28 ? 6000 : 5000 }));
  const G = E.forecastSales(anOrg(), { closings: up }, { today: TD, days: 7 }).branches[0];
  assert.ok(G.days[0].trend > 0 && G.days[0].trend <= 15, 'اتجاه صاعد محصور: ' + G.days[0].trend);
});

// ===== v38.9 — التدفق النقدي المرتبط بالتوقع =====
const cfCl = (k, x = {}) => ({ id: 'cf' + k, branchId: 'b1', branchName: 'العليا', date: dAgo(k), status: 'approved', cashSales: 5000, cardSales: 1000, bankTransferSales: 0,
  deliverySales: [{ appId: 'hs', amount: 1000 }], totalRevenue: 7000, expenses: [{ id: 'e' + k, amount: 700, paymentMethod: 'cash', categoryName: 'تشغيل' }], ...x });
const cfOrg = (x = {}) => baseOrg({ taxCfg: { enabled: false }, deliveryApps: [{ id: 'hs', n: 'هنقرستيشن', c: 20 }], ...x });
const cfSum = (F, kind) => Math.round(F.items.filter(i => i.kind === kind).reduce((s, i) => s + i.amount, 0) * 100) / 100;

test('التدفق النقدي: الافتتاحي من النقد في الدفاتر، والمبيعات المتوقعة بمزيج التحصيل الفعلي، والتطبيق بعد العمولة والتسوية', () => {
  const cl = Array.from({ length: 63 }, (_, k) => cfCl(k));
  const F = E.cashForecast(cfOrg(), { closings: cl }, { today: TD, cfg: { appLag: { hs: 7 } } });
  assert.equal(F.opening, 63 * (6000 - 700), 'نقد + شبكة − مصروفات نقدية');
  assert.equal(F.weeks.length, 13);
  assert.equal(cfSum(F, 'sales'), 90 * 6000, '90 يومًا × (نقد وشبكة 6000)');
  assert.equal(cfSum(F, 'opex'), 90 * 700, 'المصروفات 10% من المبيعات');
  const appFuture = F.items.filter(i => i.kind === 'apps' && !i.label.includes('القائم'));
  assert.ok(appFuture.every(i => Math.abs(i.amount - 800) < 0.01), 'صافي التطبيق بعد عمولة 20%');
  assert.equal(appFuture[0].date, '2026-11-18', 'أول تحصيل = أول يوم متوقع + 7 أيام');
  assert.equal(cfSum({ items: F.items.filter(i => i.label.includes('القائم')) }, 'apps'), 63 * 800, 'رصيد الذمة القائم يُحصَّل كاملًا');
  const last = F.weeks[12]; assert.equal(last.bal, Math.round((F.opening + F.weeks.reduce((s, w) => s + w.net, 0)) * 100) / 100);
  assert.ok(F.minLo.v <= F.min.v, 'الحالة المتحفظة لا تتجاوز الأساسية');
});

test('التدفق النقدي: مدة تسوية التطبيق تُستنتج من رصيد الذمة ÷ الصافي اليومي، والتأخر الطويل يُنبَّه عليه', () => {
  const cl = Array.from({ length: 63 }, (_, k) => cfCl(k));
  const F = E.cashForecast(cfOrg(), { closings: cl }, { today: TD });
  assert.equal(F.basis.apps.hs.lag, 60, 'محصورة بـ60 يومًا');
  assert.ok(F.notes.some(n => n.msg.includes('تسويات متأخرة')));
});

test('التدفق النقدي: ض.ق.م — إقرار مقفل غير مسدد يُسدَّد بنهاية الشهر التالي، والفترة المفتوحة = الدفاتر + المتوقع', () => {
  const cl = Array.from({ length: 63 }, (_, k) => cfCl(k, { cashSales: 5900, deliverySales: [], totalRevenue: 6900, expenses: [] }));
  const org = baseOrg({ taxCfg: { enabled: true, rate: 15 } });
  const jm = [{ id: 'vc1', date: '2026-10-31', title: 'إقفال', lines: [], vatClose: { from: '2026-10-01', to: '2026-10-31', out: 9000, inn: 0, net: 9000, rate: 15 } }];
  const F = E.cashForecast(org, { closings: cl, journalManual: jm }, { today: TD });
  const v = F.items.filter(i => i.kind === 'vat');
  assert.deepEqual(v.map(i => [i.date, i.amount]), [['2026-11-30', 9000], ['2026-12-31', 30 * 900], ['2027-01-31', 31 * 900]]);
  assert.equal(F.basis.vat.src, 'مستنتجة من آخر إقرار مقفل');
  const paid = [...jm, { id: 'vp1', date: '2026-11-05', lines: [], vatPay: { closeId: 'vc1', amount: 9000 } }];
  assert.equal(E.cashForecast(org, { closings: cl, journalManual: paid }, { today: TD }).items.filter(i => i.kind === 'vat').length, 2, 'المسدَّد لا يتكرر');
  const late = E.cashForecast(org, { closings: cl, journalManual: jm }, { today: '2026-12-05' });
  assert.ok(late.notes.some(n => n.sev === 'bad' && n.msg.includes('تجاوزت موعد السداد')));
});

test('التدفق النقدي: الضريبة بلا دورية معروفة لا تُفترض، ورقم ضريبي مع ضريبة غير مفعّلة خلل', () => {
  const cl = Array.from({ length: 30 }, (_, k) => cfCl(k, { deliverySales: [], totalRevenue: 6000 }));
  const F = E.cashForecast(baseOrg(), { closings: cl }, { today: TD });
  assert.equal(F.items.filter(i => i.kind === 'vat').length, 0);
  assert.ok(F.notes.some(n => n.msg.includes('دورية إقرار')));
  const G = E.cashForecast(baseOrg(), { closings: cl }, { today: TD, cfg: { vatFreq: 'quarterly' } });
  assert.deepEqual(G.items.filter(i => i.kind === 'vat').map(i => i.date), ['2027-01-31'], 'الربع أكتوبر–ديسمبر يُسدَّد بنهاية يناير');
  const H = E.cashForecast(baseOrg({ taxCfg: { enabled: false }, company: { name: 'x', taxNumber: '300000000000003' } }), { closings: cl }, { today: TD });
  assert.ok(H.notes.some(n => n.sev === 'bad' && n.msg.includes('رقم ضريبي')));
});

test('التدفق النقدي: الذمم بتواريخ استحقاقها — الدائنة المتأخرة فورًا، والمدينة المتأخرة لا تُدرج (IFRS 9)', () => {
  const org = cfOrg({ suppliers: [{ id: 's1', name: 'مورد', terms: 30 }], partners: [{ id: 'c1', name: 'عميل', type: 'customer' }] });
  const ops = { closings: [], invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'مورد', invoiceNo: '1', amount: 5000, date: dAgo(40), dueDate: dAgo(10) }, { id: 'i2', supplierId: 's1', supplierName: 'مورد', invoiceNo: '2', amount: 3000, date: dAgo(1), dueDate: '2026-11-30' }],
    salesInvoices: [{ id: 'si1', no: 'S1', customerKey: 'cust:c1', terms: 'credit', total: 2000, date: dAgo(50), dueDate: dAgo(20) }, { id: 'si2', no: 'S2', customerKey: 'cust:c1', terms: 'credit', total: 1500, date: dAgo(2), dueDate: '2026-11-25' }] };
  const F = E.cashForecast(org, ops, { today: TD });
  assert.deepEqual(F.items.filter(i => i.kind === 'ap').map(i => [i.date, i.amount]), [[TD, 5000], ['2026-11-30', 3000]]);
  assert.deepEqual(F.items.filter(i => i.kind === 'ar').map(i => [i.date, i.amount]), [['2026-11-25', 1500]]);
  assert.equal(F.basis.ar.over, 2000);
  const G = E.cashForecast(org, ops, { today: TD, cfg: { includeOverdueAR: true } });
  assert.equal(cfSum(G, 'ar'), 3500, 'إدراج المتأخر بقرار صريح');
});

test('التدفق النقدي: الرواتب من البطاقات والتأمينات في 15 الشهر التالي، والزكاة تُذكَّر بها قبل 120 يومًا', () => {
  const org = cfOrg({ gosiCfg: { enabled: true }, employees: [{ id: 'e1', name: 'سعد', baseSalary: 6000, housingAllowance: 1500, nationality: 'saudi', gosiSubject: true, hireDate: '2020-01-01' }] });
  const F = E.cashForecast(org, { closings: [] }, { today: TD });
  assert.deepEqual(F.items.filter(i => i.kind === 'payroll').map(i => [i.date, i.amount]), [['2026-11-30', 6768.75], ['2026-12-31', 6768.75], ['2027-01-31', 6768.75]]);
  assert.deepEqual(F.items.filter(i => i.kind === 'gosi').map(i => [i.date, i.amount]), [['2026-12-15', 1612.5], ['2027-01-15', 1612.5]]);
  const z = E.cashForecast(org, { closings: [] }, { today: '2027-02-01', cfg: { fyEnd: '12-31' } });
  assert.ok(z.notes.some(n => n.msg.includes('الزكاة') && n.msg.includes('2027-04-30')));
  const z2 = E.cashForecast(org, { closings: [] }, { today: '2027-02-01', cfg: { fyEnd: '12-31', sched: [{ id: 'z', kind: 'zakat', amount: 40000, date: '2027-04-20', every: 'once' }, { id: 'r', kind: 'rent', label: 'إيجار العليا', amount: 10000, date: '2027-02-05', every: 'monthly' }] } });
  assert.ok(!z2.notes.some(n => n.msg.includes('إقرار الزكاة')));
  assert.deepEqual(z2.items.filter(i => i.kind === 'sched').map(i => [i.date, i.amount]), [['2027-02-05', 10000], ['2027-03-05', 10000], ['2027-04-05', 10000], ['2027-04-20', 40000]]);
});

test('فحوص السلامة (v38.9): إقرار ضريبي متأخر، ورقم ضريبي بلا احتساب، والزكاة بلا نهاية سنة مالية', () => {
  const jm = [{ id: 'vc1', date: '2020-01-31', lines: [], vatClose: { from: '2020-01-01', to: '2020-01-31', out: 500, inn: 0, net: 500 } }];
  const C = Object.fromEntries(E.integrityChecks(baseOrg(), { closings: [], journalManual: jm }).map(c => [c.id, c]));
  assert.equal(C.vat.st, 'bad'); assert.match(C.vat.items[0], /2020-01-01 ← 2020-01-31/);
  assert.equal(C.zakat.st, 'warn');
  const D = Object.fromEntries(E.integrityChecks(baseOrg({ taxCfg: { enabled: false }, company: { name: 'x', taxNumber: '300000000000003' } }), { closings: [] }).map(c => [c.id, c]));
  assert.equal(D.vat.st, 'bad');
  assert.equal(D.cash.st, 'ok');
});

// ===== v39.0 — الشراء من التوقع =====
test('الشراء من التوقع: الاحتياج = معدل الاستهلاك لكل ريال × المبيعات المتوقعة + حد الأمان − الرصيد والمطلوب، مقرّبًا لوحدة الشراء', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', purchaseUnit: 'كرتون', purchaseFactor: 10, minQty: 5 }, { id: 'i2', name: 'ملح', unit: 'كجم' }] });
  const closings = Array.from({ length: 63 }, (_, k) => ({ id: 'c' + k, branchId: 'b1', date: dAgo(k), status: 'approved', totalRevenue: 5000 }));
  const stockMoves = [{ id: 'in', itemId: 'i1', qty: 60, kind: 'in', date: dAgo(40) }, ...Array.from({ length: 28 }, (_, k) => ({ id: 'o' + k, itemId: 'i1', qty: -2, kind: 'out', date: dAgo(k) }))];
  const P = E.purchasePlan(org, { closings, stockMoves }, { today: TD, cover: 7 });
  const r = P.pools[0].rows.find(x => x.id === 'i1');
  assert.equal(r.src, 'actual'); assert.equal(r.use28, 56); assert.equal(r.stock, 4);
  assert.equal(r.need, 14, '0.0004 كجم لكل ريال × 35,000');
  assert.equal(r.suggestPU, 2); assert.equal(r.suggest, 20, '14 + 5 − 4 = 15 ← كرتونان');
  assert.ok(!P.pools[0].rows.some(x => x.id === 'i2'), 'صنف بلا استهلاك ولا حد أمان لا يظهر');
  const po = [{ id: 'po1', status: 'open', supplierId: 's', lines: [{ itemId: 'i1', qty: 1, factor: 10, received: 0, price: 100 }] }];
  const Q = E.purchasePlan(org, { closings, stockMoves, purchaseOrders: po }, { today: TD, cover: 7 }).pools[0].rows.find(x => x.id === 'i1');
  assert.equal(Q.onOrder, 10); assert.equal(Q.suggest, 10, 'المطلوب ولم يُستلم يُخصم');
  const L = E.purchasePlan(org, { closings, stockMoves }, { today: TD, cover: 7, lead: 3 }).pools[0].rows.find(x => x.id === 'i1');
  assert.equal(L.need, 20, 'مدة التوريد تُضاف للأفق: 10 أيام');
});

// ===== v39.1 — التنبيهات المهمة والتقارير الضريبية والمشتريات =====
test('عقود الإيجار: جدول الدفعات حتى انتهاء العقد، والتنبيهات بالأهمية، والدفعات تدخل التدفق النقدي', () => {
  const lease = { id: 'L1', type: 'lease', branchId: 'b1', landlord: 'مؤسسة العقار', rent: 30000, payEvery: 'quarterly', firstPay: '2026-01-31', expiryDate: '2027-01-15', noticeDays: 90 };
  assert.deepEqual(E.leaseSchedule(lease, '2026-01-01', '2030-01-01').map(p => p.date), ['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31'], 'نهاية الشهر تُحترم والعقد ينتهي يناير');
  const org = baseOrg({ taxCfg: { enabled: false }, documents: [lease, { id: 'cr', type: 'cr', number: '1010', expiryDate: '2026-11-01' }, { id: 'mun', type: 'municipal', expiryDate: '2026-12-01' }],
    employees: [{ id: 'e1', name: 'سعد', docs: [{ id: 'd1', title: 'إقامة', expiryDate: '2026-11-20' }] }] });
  const C = E.complianceItems(org, { closings: [] }, { today: TD });
  const by = Object.fromEntries(C.items.map(x => [x.id, x]));
  assert.equal(by['doc:cr'].sev, 'bad', 'سجل منتهٍ');
  assert.equal(by['doc:mun'].sev, 'warn', 'رخصة خلال المهلة (45 يومًا)');
  assert.equal(by['lnotice:L1'].sev, 'bad', 'فات موعد إشعار المؤجر (90 يومًا قبل 2027-01-15)');
  assert.equal(by['edoc:e1:d1'].sev, 'warn');
  assert.equal(C.items[0].sev, 'bad', 'العاجل أولًا');
  const F = E.cashForecast(org, { closings: [] }, { today: TD });
  assert.deepEqual(F.items.filter(i => i.kind === 'sched').map(i => i.date), [], 'لا دفعة بين اليوم وانتهاء العقد (التالية 2027-01-31 بعده)');
  const org2 = baseOrg({ taxCfg: { enabled: false }, documents: [{ ...lease, expiryDate: '2028-01-01' }] });
  assert.deepEqual(E.cashForecast(org2, { closings: [] }, { today: TD }).items.filter(i => i.kind === 'sched').map(i => [i.date, i.amount]), [['2027-01-31', 30000]]);
});

test('سجلات ض.ق.م: المبيعات والمشتريات من القيود، بنود الإقرار، المطابقة مع 2301/1501، وضابط الرقم الضريبي للمورد', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'مورد مسجل', vatNo: '300000000000003' }, { id: 's2', name: 'مورد بلا رقم' }] });
  const ops = { closings: [{ id: 'c1', branchId: 'b1', branchName: 'العليا', date: '2026-10-05', status: 'approved', cashSales: 1150, totalRevenue: 1150,
      expenses: [{ id: 'x1', amount: 230, paymentMethod: 'cash', isTaxable: true, supplierId: 's2', categoryName: 'خضار' }, { id: 'x2', amount: 100, paymentMethod: 'card', categoryName: 'نظافة' }] }],
    invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'مورد مسجل', invoiceNo: 'A1', amount: 575, taxable: true, date: '2026-10-07', dueDate: '2026-11-07' }] };
  const R = E.vatRegister(org, ops, { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(R.sales.map(r => [r.net, r.vat, r.gross]), [[1000, 150, 1150]]);
  assert.deepEqual(R.purch.map(r => [r.party, r.pm, r.net, r.vat]), [['مورد بلا رقم', 'cash', 200, 30], ['', 'card', 100, 0], ['مورد مسجل', 'deferred', 500, 75]]);
  const B = Object.fromEntries(R.boxes.map(b => [b.n, b]));
  assert.equal(B['1'].vat, 150); assert.equal(B['7'].net, 700); assert.equal(B['7'].vat, 105); assert.equal(B['10–11'].net, 100); assert.equal(B['13'].vat, 45);
  assert.ok(R.checks.some(c => c.sev === 'ok' && c.msg.includes('مطابقان')), 'مطابقة الدفاتر');
  assert.ok(R.checks.some(c => c.sev === 'warn' && c.msg.includes('بلا رقم ضريبي')), 'مدخلات من مورد بلا رقم ضريبي');
  assert.equal(E.vatRegister(org, ops, { from: '2026-11-01', to: '2026-11-30' }).sales.length, 0, 'الفترة تُحترم');
});

test('مشتريات الموردين حسب طريقة الدفع وسداداتهم', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'مورد اللحوم' }] });
  const ops = { closings: [{ id: 'c1', branchId: 'b1', branchName: 'العليا', date: '2026-10-05', status: 'approved', totalRevenue: 0,
      expenses: [{ id: 'x1', amount: 300, paymentMethod: 'cash', supplierId: 's1' }, { id: 'x2', amount: 200, paymentMethod: 'card', supplierId: 's1' }, { id: 'x3', amount: 400, paymentMethod: 'deferred', supplierId: 's1' }, { id: 'x4', amount: 50, paymentMethod: 'bank_transfer', supplierId: 's1' }],
      supplierPayments: [{ supplierId: 's1', cash: 100, transfer: 250 }] }],
    invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'مورد اللحوم', invoiceNo: '9', amount: 1000, date: '2026-10-08', payments: [{ id: 'p1', amount: 600, date: '2026-10-20', fund: '1201' }, { id: 'p2', amount: 100, date: '2026-10-21', fund: '1101' }] }] };
  const R = E.supplierPurchReport(org, ops, { from: '2026-10-01', to: '2026-10-31' });
  const r = R.rows.find(x => x.supplierId === 's1');
  assert.deepEqual(r.buy, { cash: 300, card: 200, transfer: 50, cheque: 0, deferred: 1400, other: 0 });
  assert.equal(r.buyTot, 1950);
  assert.deepEqual(r.pay, { cash: 200, card: 0, transfer: 850, cheque: 0, deferred: 0, other: 0 });
});

// ===== v39.2 — تخطيط العمالة من التوقع =====
test('تخطيط العمالة: ميزانية الساعات من صافي المبيعات المتوقعة (بعد الضريبة) × النسبة المستهدفة ÷ تكلفة الساعة، موزعة على الورديات ومقارنة بالتعيين', () => {
  const org = baseOrg({ taxCfg: { enabled: true, rate: 15 }, employees: [{ id: 'e1', name: 'أ', branchId: 'b1', baseSalary: 4160 }, { id: 'e2', name: 'ب', branchId: 'b1', baseSalary: 4160 }] });
  const closings = Array.from({ length: 63 }, (_, k) => ({ id: 'c' + k, branchId: 'b1', date: dAgo(k), status: 'approved', totalRevenue: 6900 }));
  const shiftTemplates = [{ id: 'm', branchId: 'b1', name: 'صباحية', startTime: '08:00', endTime: '16:00', breakMinutes: 0, days: [0, 1, 2, 3, 4, 5, 6] }, { id: 'n', branchId: 'b1', name: 'مسائية', startTime: '16:00', endTime: '00:00', breakMinutes: 0, days: [0, 1, 2, 3, 4, 5, 6] }];
  const d1 = '2026-11-11';
  const shiftAssignments = ['a', 'b', 'c'].map(x => ({ id: x, branchId: 'b1', weekStart: d1, empId: x, shiftIds: ['m', '', '', '', '', '', ''] }));
  const S = E.staffingPlan(org, { closings, shiftTemplates, shiftAssignments }, { today: TD, days: 7 });
  const b = S.branches[0], d = b.days[0];
  assert.equal(b.rate, 20, '4160 ÷ 208');
  assert.equal(d.net, 6000, 'الإيراد بعد استبعاد الضريبة'); assert.equal(d.budget, 1500); assert.equal(d.needH, 75);
  assert.deepEqual(d.shifts.map(s => [s.name, s.paid, s.exact, s.staff, s.assigned, s.gap]), [['صباحية', 8, 4.7, 5, 3, -2], ['مسائية', 8, 4.7, 5, 0, -5]]);
  assert.equal(d.asgPct, Math.round(3 * 8 * 20 / 6000 * 1000) / 10, 'نسبة العمالة بالتعيين الحالي');
  // مبيعات نقطة البيع كلها مسائية ← الاحتياج ينتقل للمسائية والصباحية بالحد الأدنى
  const day = new Date(TD + 'T12:00:00').getDay();   // يوم فواتير نقطة البيع
  const posOrders = Array.from({ length: 60 }, (_, k) => { const dt = dAgo(7 * (1 + (k % 3))); return { id: 'p' + k, branchId: 'b1', date: dt, at: dt + 'T19:00:00', total: 100, status: 'paid' }; });
  const P = E.staffingPlan(org, { closings, shiftTemplates, posOrders }, { today: TD, days: 7 }).branches[0].days.find(x => x.dow === day);
  assert.deepEqual(P.shifts.map(s => s.staff), [1, 9], 'المسائية 75 ÷ 8 ≈ 9، الصباحية بالحد الأدنى');
});

// ===== v39.3 — الاستهلاك الفعلي مقابل النظري في الأنماط الشاذة =====
test('الأنماط الشاذة: استهلاك فعلي أعلى من النظري (المبيع × الوصفة) يُنبَّه عليه بالقيمة والنسبة ويُقاس أثر إجرائه', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', cost: 30 }], products: [{ id: 'p1', name: 'وجبة', sellPrice: 25, parts: [{ itemId: 'i1', qty: 0.2 }] }] });
  const posOrders = Array.from({ length: 14 }, (_, k) => ({ id: 'o' + k, branchId: 'b1', date: dAgo(k), at: dAgo(k) + 'T13:00:00', status: 'paid', total: 250, lines: [{ productId: 'p1', qty: 10 }] }));
  const out = (kg) => Array.from({ length: 14 }, (_, k) => ({ id: 'm' + k, itemId: 'i1', qty: -kg, kind: 'out', date: dAgo(k) }));
  const A = E.detectAnomalies(org, { posOrders, stockMoves: [{ id: 'in', itemId: 'i1', qty: 500, kind: 'in', date: dAgo(60) }, ...out(3)] }, { today: TD });
  const a = A.find(x => x.area === 'usage');
  assert.ok(a, 'نمط الاستهلاك'); assert.equal(a.value, 50, '42 كجم فعلي مقابل 28 نظري = +50%');
  assert.match(a.msg, /دجاج \+14 كجم \(\+50%\)/); assert.equal(a.sev, 'high');
  assert.equal(E.actionMetric(org, { posOrders, stockMoves: out(3) }, { kind: 'usage_gap', key: '' }, TD), 50);
  const ok = E.detectAnomalies(org, { posOrders, stockMoves: out(2.1) }, { today: TD });
  assert.ok(!ok.some(x => x.area === 'usage'), 'ضمن التسامح (+5%) لا تنبيه');
  assert.ok(!E.detectAnomalies(org, { stockMoves: out(3) }, { today: TD }).some(x => x.area === 'usage'), 'بلا كميات مبيعات لا يُحكم');
});

// ===== v39.4 — استيراد فواتير نقاط البيع ومطابقتها مع الإغلاق =====
test('استيراد فواتير نقاط البيع: «طريقة الدفع» لا «حالة الدفع»، يوم العمل لفواتير ما بعد منتصف الليل، واستبعاد الملغاة', () => {
  const H = ['تاريخ', 'رقم الفاتورة', 'اسم العميل', 'الفرع', 'حالة الدفع', 'طريقة الدفع', 'الإجمالي الكلي', 'المدفوع', 'عدد الاصناف', 'رقم المرجع', 'تم الإنشاء بواسطة'];
  const row = (dt, no, br, st, pm, t) => [dt, no, 'عميل نقدي', br, st, pm, t, t, 1, 'r' + no, 'كاشير'];
  const grid = [H,
    row('2026-11-09 05:10:00', '1', 'فرغ النسيم', 'مدفوع', 'نقدا', 10), row('2026-11-09 21:00:00', '2', 'فرغ النسيم', 'مدفوع', 'شبكة', 20),
    row('2026-11-10 00:30:00', '3', 'فرغ النسيم', 'مدفوع', 'شبكة', 5),   // وردية ليلة 9
    row('2026-11-10 07:00:00', '4', 'فرغ النسيم', 'مدفوع', 'نقدا', 7), row('2026-11-10 08:00:00', '5', 'فرغ النسيم', 'ملغاة', 'نقدا', 99),
    row('2026-11-10 09:00:00', '4', 'فرغ النسيم', 'مدفوع', 'نقدا', 7),   // مكرر
    [null, null, null, null, null, null, '148', '148', null, null, null]];
  const d = E.piDetect(grid);
  assert.equal(d.layout, 'invoice');
  assert.deepEqual([d.map.date, d.map.no, d.map.branch, d.map.pay, d.map.total, d.map.status], [0, 1, 3, 5, 6, 4], 'طريقة الدفع = العمود 5 لا حالة الدفع 4');
  const C = E.piCutoff(grid, d); assert.equal(C.cutoff, 5, 'فواتير حتى 00:59 ثم فجوة ثم تبدأ 05:00');
  const cfg = { ...d, cutoff: C.cutoff, brMap: { 'فرغ النسيم': 'b1' }, payMap: { 'نقدا': 'cash', 'شبكة': 'card' } };
  const A = E.piAggregate(grid, cfg);
  const by = Object.fromEntries(A.days.map(x => [x.date, [x.n, x.total, x.cash, x.card]]));
  assert.deepEqual(by, { '2026-11-09': [3, 35, 10, 25], '2026-11-10': [1, 7, 7, 0] });
  assert.equal(A.issues.voided, 1); assert.equal(A.issues.voidAmt, 99); assert.equal(A.issues.dup, 1); assert.equal(A.issues.shifted, 1);
  // المطابقة مع الإغلاق
  const ops = { closings: [{ id: 'c9', branchId: 'b1', date: '2026-11-09', status: 'approved', cashSales: 10, cardSales: 25 }, { id: 'c10', branchId: 'b1', date: '2026-11-10', status: 'submitted', cashSales: 2, cardSales: 5 }] };
  const R = E.posRecon(baseOrg(), ops, A.days);
  assert.deepEqual(R.map(x => [x.date, x.st]), [['2026-11-09', 'match'], ['2026-11-10', 'mix']], 'نفس الإجمالي وتوزيع مختلف بين النقد والشبكة');
  assert.deepEqual(R[1].d, { total: 0, cash: -5, card: 5, transfer: 0, apps: 0 });
  assert.equal(E.posRecon(baseOrg(), { closings: [] }, A.days)[0].st, 'noclose');
});
test('استيراد نقاط البيع: أول وآخر يوم عمل خارج فترة التصدير كاملة يُعلَّمان «جزئي»', () => {
  const H = ['تاريخ', 'رقم الفاتورة', 'الفرع', 'حالة الدفع', 'طريقة الدفع', 'الإجمالي الكلي'];
  const g = [H, ['2026-11-08 00:10:00', '1', 'ف', 'مدفوع', 'نقدا', 5], ['2026-11-08 06:00:00', '2', 'ف', 'مدفوع', 'نقدا', 5], ['2026-11-09 00:20:00', '3', 'ف', 'مدفوع', 'نقدا', 5],
    ['2026-11-09 06:00:00', '4', 'ف', 'مدفوع', 'نقدا', 5], ['2026-11-10 00:30:00', '5', 'ف', 'مدفوع', 'نقدا', 5], ['2026-11-10 11:00:00', '6', 'ف', 'مدفوع', 'نقدا', 5]];
  const d = E.piDetect(g); const c = E.piCutoff(g, d).cutoff; assert.equal(c, 6);
  const A = E.piAggregate(g, { ...d, cutoff: c, brMap: { 'ف': 'b1' }, payMap: { 'نقدا': 'cash' } });
  assert.deepEqual(A.days.map(x => [x.date, x.partial || 'full']), [['2026-11-07', 'start'], ['2026-11-08', 'full'], ['2026-11-09', 'full'], ['2026-11-10', 'end']]);
  const g2 = [H, ['2026-11-08 06:10:00', '1', 'ف', 'مدفوع', 'نقدا', 5], ['2026-11-09 00:20:00', '2', 'ف', 'مدفوع', 'نقدا', 5], ['2026-11-09 07:00:00', '3', 'ف', 'مدفوع', 'نقدا', 5]];
  const B = E.piAggregate(g2, { ...E.piDetect(g2), cutoff: 6, brMap: { 'ف': 'b1' }, payMap: { 'نقدا': 'cash' } });
  assert.deepEqual(B.days.map(x => [x.date, x.partial || 'full']), [['2026-11-08', 'full'], ['2026-11-09', 'end']], 'أول فاتورة صباحية لا تجعل اليوم جزئيًا');
});

// ===== v39.5 — الأيام المستوردة في التحليل، ومسودات الإغلاق منها =====
test('الأيام المستوردة بلا إغلاق تدخل التحليل والتوقع لا الدفاتر، والإغلاق المرحّل يتقدّم عليها، ومسودة الإغلاق معبأة', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, deliveryApps: [{ id: 'hs', n: 'هنقرستيشن', c: 20 }] });
  const imp = Array.from({ length: 35 }, (_, k) => ({ id: 'i' + k, branchId: 'b1', date: dAgo(k), n: 100, total: 5000, cash: 2000, card: 2500, transfer: 0, apps: { hs: { amount: 500, n: 5 } }, file: 'f.xlsx' }));
  const ops = { posImports: [...imp, { id: 'p', branchId: 'b1', date: dAgo(40), total: 10, cash: 10, card: 0, partial: 'start' }],
    closings: [{ id: 'c0', branchId: 'b1', date: dAgo(0), status: 'approved', cashSales: 3000, cardSales: 3000, totalRevenue: 6000 }] };
  const S = E.salesDays(ops);
  assert.equal(S.length, 35, 'الجزئي لا يدخل');
  assert.equal(S.find(x => x.date === dAgo(0)).totalRevenue, 6000, 'الإغلاق المرحّل يتقدّم على الاستيراد');
  assert.equal(S.filter(x => x.fromImport).length, 34);
  const F = E.forecastSales(org, ops, { today: TD, days: 7 });
  assert.ok(F.branches[0].days.length === 7, 'التوقع يعمل من الاستيراد وحده');
  const A = E.buildAccounting(org, ops); assert.equal(A.entries.filter(e => e.src === 'إغلاق وردية').length, 1, 'الدفاتر من الإغلاق المرحّل فقط');
  const d = E.importDraftClosing(org, imp[3], 'مجاهد');
  assert.equal(d.status, 'draft'); assert.equal(d.totalRevenue, 5000); assert.equal(d.cashSales, 2000);
  assert.deepEqual(d.deliverySales.map(x => [x.appId, x.amount, x.commissionAmount]), [['hs', 500, 100]]);
  assert.equal(E.buildAccounting(org, { closings: [d] }).entries.length, 0, 'المسودة لا تُقيَّد حتى تُرحَّل');
});

// ===== v40.0 — اختبار الانجراف: قوائم الأدوار في firestore.rules = أدوار المنصة في الكود =====
test('الدستور: قوائم الأدوار في قواعد Firestore تطابق صلاحيات المنصة حرفيًا', async () => {
  const fs = await import('node:fs');
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const listOf = (tag) => { const m = rules.match(new RegExp('\\[ROLES:' + tag + '\\][^\\n]*\\n[^\\[]*\\[([^\\]]*)\\]')); assert.ok(m, 'لا قائمة ' + tag); return m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean).sort(); };
  const R = E.ROLES, K = Object.keys(R), f = (p) => K.filter(k => p(R[k], k)).sort();
  assert.deepEqual(listOf('AUDIT_READ'), f(r => (r.tabs || []).includes('audit')), 'قرّاء السجل = من يملك شاشة التدقيق');
  assert.deepEqual(listOf('CLOSING_AUDIT'), f(r => r.scope !== 'own' && (r.tabs || []).includes('approve')), 'مدققو الإغلاق');
  assert.deepEqual(listOf('CLOSING_GM'), f(r => !!r.approver), 'الاعتماد النهائي');
  assert.deepEqual(listOf('WASTE'), f((r, k) => !!(r.approver || r.admin || r.costCtl || k === 'regional_manager')), 'معتمدو الهدر = canApproveWaste');
  assert.deepEqual(listOf('COUNT'), f((r, k) => !!(E.rolePost(k) || r.approver || r.admin || k === 'regional_manager' || k === 'branch_manager')), 'معتمدو الجرد = canApproveCount');
  assert.deepEqual(listOf('PO'), f(r => !!(r.approver || r.admin)), 'معتمدو أوامر الشراء');
  assert.deepEqual(listOf('IBAN'), f(r => (r.tabs || []).includes('audit')), 'معتمدو تغيير حسابات الدفع = أصحاب شاشة التدقيق');
  assert.deepEqual(listOf('GRN'), f((r, k) => !!E.rolePost(k)), 'فاحصو الاستلام = canInspect (rolePost)');
  assert.deepEqual(listOf('PINV'), [...E.INV_BILLERS].sort(), 'محوّلو الفاتورة = INV_BILLERS');
  assert.deepEqual(listOf('BRPUR'), [...E.BR_PURCHASERS].sort(), 'طلب/استلام الفرع = BR_PURCHASERS (مدير الفرع)');
});

test('الدستور ث19: التحقق من الاعتماد — موقّع ومطابق، أو عُدّل بعد اعتماده، أو بلا توقيع بعد بدء التوقيع، أو أقدم منه', () => {
  const c = { id: 'c1', branchId: 'b1', date: '2026-11-20', cashSales: 1000, cardSales: 500, totalRevenue: 1500, expenses: [{ amount: 50, paymentMethod: 'cash', categoryName: 'غاز' }], totalExpenses: 50, actualCashCount: 950, variance: 0, status: 'approved', auditedAt: '2026-11-21T10:00:00Z', gmApprovalStatus: 'pending' };
  const sig = { kind: 'closing', entityId: 'c1', stage: 'audit', digest: E.sigDigest('closing', c), atMs: 2 };
  assert.equal(E.sigVerify('closing', c, [sig], '2026-11-13').st, 'ok');
  assert.equal(E.sigVerify('closing', { ...c, cashSales: 900 }, [sig], '2026-11-13').st, 'tampered', 'تعديل رقم بعد الاعتماد');
  assert.equal(E.sigVerify('closing', { ...c, expenses: [{ amount: 500, paymentMethod: 'cash', categoryName: 'غاز' }] }, [sig], '2026-11-13').st, 'tampered', 'تعديل مصروف');
  assert.equal(E.sigVerify('closing', { ...c, auditedBy: 'آخر', updatedAt: 'x' }, [sig], '2026-11-13').st, 'ok', 'حقول غير مالية لا تغيّر البصمة');
  assert.equal(E.sigVerify('closing', c, [], '2026-11-13').st, 'unsigned', 'معتمد بعد بدء التوقيع بلا توقيع');
  assert.equal(E.sigVerify('closing', { ...c, auditedAt: '2026-11-01T10:00:00Z' }, [], '2026-11-13').st, 'legacy');
  assert.equal(E.sigVerify('closing', { ...c, status: 'submitted' }, [], '2026-11-13').st, 'na');
  assert.equal(E.sigVerify('closing', c, null, '2026-11-13').st, 'na', 'خارج Firestore');
  const gm = { ...c, gmApprovalStatus: 'approved', gmApprovedAt: '2026-11-22T10:00:00Z' };
  assert.equal(E.sigVerify('closing', gm, [sig], '2026-11-13').st, 'unsigned', 'الاعتماد النهائي يحتاج توقيعه');
  assert.equal(E.sigVerify('closing', gm, [sig, { ...sig, stage: 'gm' }], '2026-11-13').st, 'ok');
  const C = Object.fromEntries(E.integrityChecks(baseOrg(), { closings: [{ ...c, cashSales: 1 }] }, { sigs: [sig], cutover: '2026-11-13' }).map(x => [x.id, x]));
  assert.equal(C.signoffs.st, 'bad'); assert.match(C.signoffs.items[0], /عُدّل بعد اعتماده/);
});

// ===== v40.1 — المرحلة 1: ربحية الفرع اليومية =====
test('الربحية اليومية: لا تعمل قبل اكتمال الإعداد، ثم تحسب كل مكوّن بالطريقة المختارة (يدويًا: هامش 1148.5)', () => {
  const org = baseOrg({ taxCfg: { enabled: true, rate: 15 },
    employees: [{ id: 'e1', name: 'سعد', branchId: 'b1', baseSalary: 6240 }],
    documents: [{ id: 'L', type: 'lease', branchId: 'b1', rent: 9000, payEvery: 'quarterly', firstPay: '2026-01-01', expiryDate: '2027-12-31' }] });
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-05', status: 'approved', cashSales: 1150, cardSales: 1150, totalRevenue: 2300,
      expenses: [{ id: 'x1', amount: 460, categoryId: 'ec1', isTaxable: true, paymentMethod: 'cash' }, { id: 'x2', amount: 300, categoryId: 'ec5', isTaxable: true, paymentMethod: 'cash' }] }],
    attendanceEvents: [{ id: 'a1', employeeId: 'e1', type: 'in', at: '2026-11-05T08:00:00' }, { id: 'a2', employeeId: 'e1', type: 'out', at: '2026-11-05T16:00:00' }] };
  const P0 = E.profitDays(org, ops, { from: '2026-11-05', to: '2026-11-05', cfg: {} });
  assert.deepEqual(P0.missing, ['أساس تكلفة الطعام', 'أساس تكلفة العمالة', 'توزيع التكاليف الشهرية على الأيام', 'رسوم الشبكة'], 'لا افتراض');
  assert.equal(P0.branches[0].days[0].margin, null);
  const cfg = { enabled: true, foodBasis: 'purchases', foodCats: ['ec1'], laborBasis: 'attendance', alloc: 'calendar', cardFee: 'flat', cardRate: 1, fixed: [{ id: 'f', branchId: 'b1', label: 'كهرباء', amount: 3000 }] };
  const d = E.profitDays(org, ops, { from: '2026-11-05', to: '2026-11-05', cfg }).branches[0].days[0];
  assert.equal(d.net, 2000, 'صافي بعد الضريبة'); assert.equal(d.food, 400, 'مشتريات المواد بعد الضريبة فقط من التصنيف المختار');
  assert.equal(d.labor, 240, '8 ساعات × (6240 ÷ 208)'); assert.equal(d.card, 11.5); assert.equal(d.fixed, 200, '(3000 + إيجار 9000/3) ÷ 30 يومًا');
  assert.equal(d.margin, 1148.5); assert.equal(d.foodPct, 20); assert.equal(d.laborPct, 12); assert.equal(d.primePct, 32);
  // يوم مستورد بلا إغلاق: مشتريات المواد غير معروفة ← غير متاح لا صفر
  const imp = { ...ops, closings: [], posImports: [{ id: 'p', branchId: 'b1', date: '2026-11-05', total: 2300, cash: 1150, card: 1150 }] };
  const di = E.profitDays(org, imp, { from: '2026-11-05', to: '2026-11-05', cfg }).branches[0].days[0];
  assert.equal(di.margin, null); assert.match(di.na.food, /بلا إغلاق/);
  // الرواتب الشهرية موزعة على أيام التشغيل
  const dp = E.profitDays(org, ops, { from: '2026-11-05', to: '2026-11-05', today: '2026-11-05', cfg: { ...cfg, laborBasis: 'payroll', alloc: 'operating' } }).branches[0].days[0];
  assert.equal(dp.labor, 6240, 'يوم التشغيل الوحيد في الشهر حتى اليوم يحمل الشهر كاملًا — معلن في الشاشة');
});

test('v40.2 رسوم الشبكة حسب نوع البطاقة: من التقسيم في الإغلاق بنسبة كل نوع؛ ويوم بلا تقسيم «غير متاح»؛ والبصمة القديمة لا تتغير', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, employees: [{ id: 'e1', name: 'س', branchId: 'b1', baseSalary: 3000 }] });
  const cfg = { enabled: true, foodBasis: 'purchases', foodCats: ['ec1'], laborBasis: 'payroll', alloc: 'calendar', cardFee: 'bytype', cardRates: { mada: 0.8, visa: 2, mc: 2.2 } };
  assert.deepEqual(E.profitMissing({ ...cfg, cardRates: { mada: 0.8 } }), ['نسب رسوم مدى وفيزا وماستركارد'], 'لا افتراض لنسبة ناقصة');
  const c = { id: 'c1', branchId: 'b1', date: '2026-11-05', status: 'approved', cashSales: 0, cardSales: 1150, totalRevenue: 1150, expenses: [], cardSplit: { mada: 700, visa: 300, mc: 150 } };
  const d = E.profitDays(org, { closings: [c] }, { from: '2026-11-05', to: '2026-11-05', cfg }).branches[0].days[0];
  assert.equal(d.card, 14.9, '700×0.8% + 300×2% + 150×2.2%');
  const { cardSplit, ...noSplit } = c;
  const d2 = E.profitDays(org, { closings: [noSplit] }, { from: '2026-11-05', to: '2026-11-05', cfg }).branches[0].days[0];
  assert.equal(d2.margin, null); assert.match(d2.na.card, /غير مقسّمة/);
  // v40.5: النسبة الموحّدة الاحتياطية للإغلاقات غير المقسّمة (اختيارية)
  const d3 = E.profitDays(org, { closings: [noSplit] }, { from: '2026-11-05', to: '2026-11-05', cfg: { ...cfg, cardRateFallback: 0.99 } }).branches[0].days[0];
  assert.equal(d3.card, Math.round(noSplit.cardSales * 0.99) / 100); assert.equal(d3.cardEst, 1); assert.equal(d3.na.card, undefined); assert.notEqual(d3.margin, null);
  const d4 = E.profitDays(org, { closings: [c] }, { from: '2026-11-05', to: '2026-11-05', cfg: { ...cfg, cardRateFallback: 0.99 } }).branches[0].days[0];
  assert.deepEqual([d4.card, d4.cardEst], [14.9, undefined], 'المقسّم يبقى بنسب كل نوع');
  const legacy = E.sigDigest('closing', noSplit);
  assert.equal(E.sigDigest('closing', { ...noSplit }), legacy, 'إغلاق بلا تقسيم: البصمة كما كانت (لا إنذار كاذب على الموقّع سابقًا)');
  assert.notEqual(E.sigDigest('closing', c), E.sigDigest('closing', { ...c, cardSplit: { mada: 800, visa: 200, mc: 150 } }), 'تعديل التقسيم بعد الاعتماد يُكشف');
});

// ===== v40.3 — المرحلة 2: هندسة القائمة =====
test('هندسة القائمة (كاسافانا-سميث): نجم/حصان عمل/لغز/ضعيف بعتبتي الشعبية والهامش المرجّح، والصنف بلا وصفة يُستثنى ويُذكر', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', cost: 10 }],
    products: [['A', 30], ['B', 15], ['C', 40], ['D', 12]].map(([id, price]) => ({ id, name: 'منتج ' + id, sellPrice: price, parts: [{ itemId: 'i1', qty: 1 }] })).concat([{ id: 'E', name: 'بلا وصفة', sellPrice: 20, parts: [] }]) });
  const ops = { productSales: [{ id: 'ps', branchId: 'b1', from: '2026-11-01', to: '2026-11-10', lines: [{ productId: 'A', qty: 100 }, { productId: 'B', qty: 100 }, { productId: 'C', qty: 10 }, { productId: 'D', qty: 10 }, { productId: 'E', qty: 50 }] },
    { id: 'ps2', branchId: 'b1', from: '2026-10-25', to: '2026-11-05', lines: [{ productId: 'A', qty: 999 }] }] };
  const M = E.menuEngineering(org, ops, { from: '2026-11-01', to: '2026-11-30' });
  const by = Object.fromEntries(M.rows.map(r => [r.id, r.cls]));
  assert.deepEqual(by, { A: 'star', B: 'plow', C: 'puzzle', D: 'dog' });
  assert.equal(M.popTh, 17.5, '(1 ÷ 4) × 70%'); assert.equal(M.cmAvg, 12.82, 'متوسط الهامش المرجّح بالكميات');
  assert.deepEqual(M.excluded.map(x => [x.name, x.why]), [['بلا وصفة', 'بلا وصفة — التكلفة غير معروفة']]);
  assert.equal(M.src.partial, 1, 'سجل يتداخل جزئيًا مع الفترة لا يُحتسب ويُذكر');
  assert.equal(M.tot.cm, 2820);
  assert.deepEqual(Object.fromEntries(E.menuEngineering(org, ops, { from: '2026-11-01', to: '2026-11-30', cfg: { popPct: 200 } }).rows.map(r => [r.id, r.cls])), { A: 'puzzle', B: 'dog', C: 'puzzle', D: 'dog' }, 'العتبة قابلة للتعديل: 200% ⇒ الشعبية تتطلب 50% فيصير A وB منخفضي الشعبية');
});

// ===== v40.4 — المرحلة 3: خطة التوفير =====
test('خطة التوفير: فرص مقاسة فقط (هدر، فرق سعر عن أفضل سعر دُفع، خصومات يدوية) بمعدل 30 يومًا، والمتحقق = الأساس − الحالي', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', cost: 10 }], branches: [{ id: 'b1', name: 'العليا', isActive: true }, { id: 'b2', name: 'النسيم', isActive: true }] });
  const po = (id, date, price, rq, sup, factor) => ({ id, poNo: id, date, supplierId: sup, supplierName: sup, status: 'received', lines: [{ itemId: 'i1', desc: 'دجاج', qty: rq, received: rq, price, ...(factor ? { factor } : {}) }] });
  const ops = {
    stockMoves: [{ id: 'w1', kind: 'waste', branchId: 'b1', itemId: 'i1', qty: -3, wasteVal: 30, date: '2026-11-03' }, { id: 'w2', kind: 'waste', branchId: 'b1', itemId: 'i1', qty: -1, wasteVal: 15, date: '2026-11-08' },
      { id: 'w3', kind: 'waste', branchId: 'b1', itemId: 'i1', qty: -9, wasteVal: 99, date: '2026-10-20' }],
    purchaseOrders: [po('P0', '2026-09-15', 9, 10, 'أ'), po('P1', '2026-11-02', 11, 100, 'ب'), po('P2', '2026-11-06', 120, 5, 'ب', 10)],
    posOrders: [{ id: 'o1', branchId: 'b2', date: '2026-11-04', total: 100, manualDisc: 12, by: 'سالم' }, { id: 'o2', branchId: 'b2', date: '2026-11-05', total: 50, manualDisc: 8, by: 'سالم', status: 'void' }, { id: 'o3', branchId: 'b2', date: '2026-11-09', total: 70, manualDisc: 3, by: 'فهد' }]
  };
  const S = E.savingsOpps(org, ops, { from: '2026-11-01', to: '2026-11-10' });
  const by = Object.fromEntries(S.opps.map(o => [o.key, [o.value, o.per30]]));
  assert.deepEqual(by['waste|b1'], [45, 135], 'هدر الفترة فقط (30+15) — 10 أيام ⇒ ×3');
  assert.deepEqual(by['price|i1'], [350, 1050], 'أفضل سعر دُفع 9 (خلال 90 يومًا قبل الفترة): (11−9)×100 + (12−9)×50 = 350 (الوحدة الكبيرة 120÷10)');
  assert.deepEqual(by['mdisc|b2'], [15, 45], 'الملغاة لا تُحتسب: 12+3');
  assert.equal(S.opps[0].key, 'price|i1', 'مرتبة بالأعلى أثرًا');
  assert.equal(S.tot30, 1230);
  assert.equal(E.savingsOpps(org, ops, { from: '2026-11-01', to: '2026-11-10', branchIds: ['b1'] }).opps.some(o => o.kind === 'price'), false, 'فرق السعر مركزي — لا يظهر بفلتر الفرع');
  // المتابعة: بدأت الخطة 11/11 بهدف 50% من 135
  const sv = { kind: 'waste', id: 'b1', base30: 135, pct: 50, start: '2026-11-11' };
  assert.equal(E.savingsTrack(org, ops, sv, '2026-11-14').pending, true, 'أقل من 7 أيام: لا حكم');
  const ops2 = { ...ops, stockMoves: [...ops.stockMoves, { id: 'w4', kind: 'waste', branchId: 'b1', itemId: 'i1', qty: -1, wasteVal: 20, date: '2026-11-15' }] };
  const T = E.savingsTrack(org, ops2, sv, '2026-11-20');
  assert.deepEqual([T.days, T.now30, T.real30, T.target30, T.hit], [10, 60, 75, 67.5, true]);
  const Tp = E.savingsTrack(org, ops, { kind: 'price', id: 'i1', ref: 9, base30: 900, pct: 20, start: '2026-11-11' }, '2026-11-20');
  assert.equal(Tp.nodata, true, 'لا مشتريات بعد البدء: لا يُدّعى توفير');
});

// ===== v40.6 — مطابقة تسويات الشبكة بالأجهزة =====
test('مطابقة الشبكة: مدى بإجماليه وعمولته المنفصلة، فيزا/ماستركارد صافية تُعاد لإجماليها بنسب العقد، وفارق التوقيت يُستنتج', () => {
  const H = ['التاريخ', 'الوقت', 'نوع العملية (كما في الكشف)', 'التصنيف', 'الجهة الموحدة', 'طبيعة الحركة', 'تفاصيل الطرف', 'الجهاز', 'رقم الجهاز', 'نوع البطاقة', 'المرجع', 'طريقة الدفع', 'دائن (وارد)', 'مدين (صادر)', 'رصيد البنك'];
  const row = (d, tm, op, cat, tid, card, cr, db) => [d, tm, op, cat, 'جهاز ...' + tid, 'إيرادات', 'جهاز ...' + tid + ' (' + card + ')', 'جهاز …' + tid, '15521647021' + '6' + tid, card, '0575', 'نقاط البيع', cr, db, 0];
  const grid = [['سجل الحركات'], H,
    row('2026-11-02', '00:57:05', 'نقاط بيع - دائنة التاجر', 'مبيعات شبكة - مدى', '4274', 'مدى', 1708, 0),
    row('2026-11-02', '00:57:05', 'نقاط بيع - مدين التاجر', 'عمولة نقاط البيع', '4274', 'مدى', 0, 15.76),
    row('2026-11-02', '22:10:34', 'عمليات التجار', 'مبيعات شبكة - فيزا/ماستر', '4274', 'فيزا', 333.08, 0),
    row('2026-11-02', '22:10:34', 'عمليات التجار', 'مبيعات شبكة - فيزا/ماستر', '4274', 'ماستركارد', 162.67, 0),
    row('2026-11-03', '01:00:00', 'نقاط بيع - دائنة التاجر', 'مبيعات شبكة - مدى', '4274', 'مدى', 1000, 0),
    row('2026-11-03', '01:00:00', 'نقاط بيع - مدين التاجر', 'عمولة نقاط البيع', '4274', 'مدى', 0, 9.22),
    row('2026-11-03', '02:00:00', 'نقاط بيع - دائنة التاجر', 'مبيعات شبكة - مدى', '9999', 'مدى', 100, 0),
    ['2026-11-02', '10:00', 'سداد فاتورة', 'كهرباء', 'الشركة السعودية للكهرباء', '', '', '', '', '', '', 'سداد', 0, 800, 0]];
  const map = E.detectStmtMap(grid); assert.ok(map, 'الأعمدة تُكتشف');
  const L = E.cardStmtLines(grid, map);
  assert.deepEqual(L.map(l => [l.kind, l.type, l.tid]), [['settle', 'mada', '4274'], ['fee', 'mada', '4274'], ['settle', 'visa', '4274'], ['settle', 'mc', '4274'], ['settle', 'mada', '4274'], ['fee', 'mada', '4274'], ['settle', 'mada', '9999']], 'سطر الكهرباء لا يدخل');
  const org = baseOrg({ taxCfg: { enabled: true, rate: 15 }, cardTerminals: [{ tid: '4274', branchId: 'b1' }], profitCfg: { cardRates: { mada: 0.8, visa: 2.5, mc: 2.5 } } });
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-01', status: 'approved', cardSales: 2218.43, totalRevenue: 3000 }, { id: 'c2', branchId: 'b1', date: '2026-11-02', status: 'approved', cardSales: 1000, totalRevenue: 1500 }] };
  const M = E.cardRecon(org, ops, L, { from: '2026-11-01', to: '2026-11-02' });
  const b = M.branches[0];
  assert.deepEqual([b.lag, b.exp, b.bank, b.diff, b.ok], [1, 3218.43, 3218.43, 0, true], 'الإجمالي = مدى 1708 + فيزا 333.08÷0.97125 + ماستر 162.67÷0.97125، بفارق يوم');
  assert.deepEqual([b.mada.gross, b.mada.fee, b.mada.eff, b.mada.expEff], [2708, 24.98, 0.922, 0.92], 'عمولة مدى الفعلية مقابل العقد شاملة الضريبة');
  assert.deepEqual([b.vm.net, b.vm.gross, b.vm.fee, b.devFee], [495.75, 510.43, 14.68, 0]);
  assert.deepEqual(M.unmapped, ['9999']); assert.match(M.notes.join(' '), /غير مسندة/);
  // إيداع ناقص يُكشف
  const ops2 = { closings: ops.closings.map(c => c.id === 'c2' ? { ...c, cardSales: 1200 } : c) };
  const b2 = E.cardRecon(org, ops2, L, { from: '2026-11-01', to: '2026-11-02' }).branches[0];
  assert.deepEqual([b2.diff, b2.ok, b2.days.find(x => x.date === '2026-11-02').diff], [200, false, 200], 'الإغلاق 1200 والمودَع 1000');
  // بلا نسب فيزا/ماستر: لا إعادة إجمالي، ويُذكر السبب
  const M3 = E.cardRecon({ ...org, profitCfg: {} }, ops, L, { from: '2026-11-01', to: '2026-11-02' });
  assert.deepEqual([M3.branches[0].vm.gross, M3.branches[0].vm.miss], [495.75, ['visa', 'mc']], 'تُطابَق صافية'); assert.match(M3.notes.join(' '), /لا نسبة عمولة لـ فيزا وماستركارد/);
  // رسوم «ضعف الاستخدام» الشهرية رسوم جهاز لا عمولة مدى، وأمريكان إكسبريس نوع مستقل
  const g2 = [...grid, ['2026-11-02', '17:42:05', 'رسوم نقاط البيع الشهري', 'رسوم أجهزة نقاط البيع', 'مصرف الراجحي', 'رسوم بنكية', 'Low usage fee for 1552164702164274', '', '', '', '', 'أخرى', 0, 115, 0],
    row('2026-11-02', '22:08:30', 'عمليات التجار', 'مبيعات شبكة - فيزا/ماستر', '4274', 'أمريكان إكسبريس', 41.76, 0)];
  const L2 = E.cardStmtLines(g2, map); assert.deepEqual(L2.slice(-2).map(l => [l.kind, l.type, l.tid]), [['devfee', null, '4274'], ['settle', 'amex', '4274']]);
  const b4 = E.cardRecon(org, ops, L2, { from: '2026-11-01', to: '2026-11-02' }).branches[0];
  assert.deepEqual([b4.mada.fee, b4.devFee, b4.vm.byType.amex, b4.vm.miss], [24.98, 115, 41.76, ['amex']], 'عمولة مدى لا تتضخم برسوم الجهاز');
});

// ===== v40.7 — الوصفات الفرعية (التحضيرات) =====
test('الوصفات الفرعية: تحضيرة داخل تحضيرة تُفكّ لخاماتها بالناتج، والتكلفة والاستهلاك النظري يتبعانها، والدوران يُمنع', () => {
  const org = baseOrg({ taxCfg: { enabled: false },
    items: [{ id: 'ch', name: 'دجاج', unit: 'كجم', cost: 20 }, { id: 'sp', name: 'بهارات', unit: 'كجم', cost: 30 }, { id: 'ga', name: 'ثوم', unit: 'كجم', cost: 10 }, { id: 'oi', name: 'زيت', unit: 'لتر', cost: 8 }],
    preps: [{ id: 'sauce', name: 'صلصة ثوم', unit: 'كجم', batch: 5, parts: [{ itemId: 'ga', qty: 1, yield: 80 }, { itemId: 'oi', qty: 4 }] },
      { id: 'mar', name: 'تتبيلة', unit: 'كجم', batch: 2.5, parts: [{ prepId: 'sauce', qty: 2 }, { itemId: 'sp', qty: 0.5 }] }],
    products: [{ id: 'P', name: 'شاورما', sellPrice: 25, parts: [{ itemId: 'ch', qty: 0.25, yield: 50 }, { prepId: 'mar', qty: 0.2 }] }] });
  const R = E.recipeRaw(org, org.products[0].parts);
  assert.deepEqual(R.raw, { ch: 0.5, ga: 0.04, oi: 0.128, sp: 0.04 }, 'تتبيلة 0.2 من 2.5 ⇒ صلصة 0.16 من 5 ⇒ ثوم 1÷0.8×0.032 وزيت 4×0.032');
  assert.equal(E.recipeCost(org, org.products[0].parts, {}).cost, 12.624);
  assert.deepEqual(E.prepUnitCost(org, org.preps[0], {}), { cost: 8.9, miss: '' }, '(12.5 + 32) ÷ 5');
  const ops = { productSales: [{ id: 's', branchId: 'b1', from: '2026-11-01', to: '2026-11-07', lines: [{ productId: 'P', qty: 10 }] }] };
  const U = E.usageReport(org, ops, undefined, '2026-11-01', '2026-11-07');
  assert.deepEqual(Object.fromEntries(U.rows.map(r => [r.id, r.theo])), { ch: 5, ga: 0.4, oi: 1.28, sp: 0.4 }, 'الاستهلاك النظري بالخامات لا بالتحضيرة');
  const M = E.menuEngineering(org, ops, { from: '2026-11-01', to: '2026-11-07' });
  assert.equal(M.rows[0].cost, 12.62, 'هندسة القائمة تحسب تكلفة التحضيرات');
  const cyc = { ...org, preps: [{ id: 'a', name: 'أ', batch: 1, parts: [{ prepId: 'b', qty: 1 }] }, { id: 'b', name: 'ب', batch: 1, parts: [{ prepId: 'a', qty: 1 }] }] };
  assert.equal(E.recipeRaw(cyc, [{ prepId: 'a', qty: 1 }]).cycle, true);
  assert.match(E.recipeCost(cyc, [{ prepId: 'a', qty: 1 }], {}).miss, /دائرية/);
  assert.match(E.recipeCost({ ...org, preps: [] }, org.products[0].parts, {}).miss, /تحضيرة محذوفة/, 'مرجع محذوف لا يُحتسب صفرًا بصمت');
});

// ===== v40.8 — قائمة التحضير اليومية =====
test('قائمة التحضير: توقع الفرع × مزيج الأصناف × الوصفات، والمتبقي يُطرح، والتحضيرة الداخلية تتبع ما سيُحضَّر من الخارجية', () => {
  const org = baseOrg({ taxCfg: { enabled: false },
    items: [{ id: 'ch', name: 'دجاج', unit: 'كجم', cost: 20 }, { id: 'sp', name: 'بهارات', unit: 'كجم', cost: 30 }, { id: 'ga', name: 'ثوم', unit: 'كجم', cost: 10 }, { id: 'oi', name: 'زيت', unit: 'لتر', cost: 8 }],
    preps: [{ id: 'sauce', name: 'ثومية', unit: 'كجم', batch: 5, parts: [{ itemId: 'ga', qty: 1, yield: 80 }, { itemId: 'oi', qty: 4 }] },
      { id: 'mar', name: 'تتبيلة', unit: 'كجم', batch: 2.5, parts: [{ prepId: 'sauce', qty: 2 }, { itemId: 'sp', qty: 0.5 }] }, { id: 'unused', name: 'غير مستخدمة', unit: 'كجم', batch: 1, parts: [{ itemId: 'oi', qty: 1 }] }],
    products: [{ id: 'P', name: 'شاورما', sellPrice: 20, parts: [{ itemId: 'ch', qty: 0.2 }, { prepId: 'mar', qty: 0.2 }] }, { id: 'Q', name: 'بروستد', sellPrice: 25, parts: [{ prepId: 'sauce', qty: 0.05 }] }] });
  const closings = []; for (let k = 0; k < 63; k++) { const d = new Date(Date.UTC(2026, 10, 14) - k * 864e5).toISOString().slice(0, 10); closings.push({ id: 'c' + k, branchId: 'b1', date: d, status: 'approved', totalRevenue: 1000 }); }
  const ops = { closings, productSales: [{ id: 's', branchId: 'b1', from: '2026-11-08', to: '2026-11-14', lines: [{ productId: 'P', qty: 70 }, { productId: 'Q', qty: 140 }] }] };
  const P = E.prepPlan(org, ops, { branchId: 'b1', today: '2026-11-14', date: '2026-11-15', onHand: { mar: 0.5 } });
  assert.equal(P.f, 1000); assert.deepEqual(P.products.map(x => [x.id, x.qty]), [['Q', 20], ['P', 10]], 'مزيج 7 أيام: 70 و140 من 7000 ريال');
  const by = Object.fromEntries(P.preps.map(r => [r.id, [r.need, r.make, r.batches]]));
  assert.deepEqual(by, { mar: [2, 1.5, 0.6], sauce: [2.2, 2.2, 0.44] }, 'تتبيلة 10×0.2=2 −0.5 متبقٍ؛ ثومية 20×0.05 + 0.6 دفعة × 2 = 2.2؛ وغير المستخدمة لا تظهر');
  const sauce = P.preps.find(r => r.id === 'sauce'), mar = P.preps.find(r => r.id === 'mar');
  assert.deepEqual(sauce.parts.map(x => [x.name, x.qty]), [['ثوم', 0.55], ['زيت', 1.76]], 'بالناتج: 1÷0.8×0.44');
  assert.deepEqual(mar.parts.map(x => [x.name, x.qty, !!x.prep]), [['ثومية', 1.2, true], ['بهارات', 0.3, false]]);
  const P2 = E.prepPlan(org, { closings }, { branchId: 'b1', today: '2026-11-14', date: '2026-11-15' });
  assert.equal(P2.preps.length, 0); assert.match(P2.notes.join(' '), /لا مبيعات بالأصناف/, 'بلا مزيج أصناف لا يُخمَّن');
});

// ===== v40.9 — ضبط تغيير حسابات الدفع =====
test('الآيبان: موثّق بآخر اعتماد موقّع، والمعتمد غير المطبَّق يُستخدم، والمعدّل خارج المسار «مخالف»، والطلب بانتظار القرار', () => {
  const A = 'SA' + '1'.repeat(22), B = 'SA' + '2'.repeat(22), C = 'SA' + '3'.repeat(22);
  const dg = (ent, iban) => E.sigDigest('iban', { id: ent, iban });
  const org = baseOrg({ employees: [{ id: 'e1', name: 'سالم', iban: A }, { id: 'e2', name: 'فهد', iban: B }, { id: 'e3', name: 'ماجد', iban: C }, { id: 'e4', name: 'خالد', iban: '' }, { id: 'e5', name: 'سعد', iban: A }],
    suppliers: [{ id: 's1', name: 'مورد الدواجن', iban: B }],
    ibanReqs: [{ id: 'r1', ent: 'emp:e2', iban: C, sigSubmit: 'sub1' }, { id: 'r2', ent: 'emp:e4', iban: A, sigSubmit: 'sub2' }, { id: 'r3', ent: 'sup:s1', iban: A, sigSubmit: 'sub3' }] });
  const sigs = [
    { kind: 'iban', entityId: 'emp:e1', stage: 'approve', digest: dg('emp:e1', A), atMs: 1 },                                   // e1 موثّق
    { kind: 'iban', entityId: 'emp:e2', stage: 'approve', digest: dg('emp:e2', B), atMs: 1 },
    { kind: 'iban', entityId: 'emp:e2', stage: 'approve', subRef: 'sub1', digest: dg('emp:e2', C), atMs: 5 },                  // e2: اعتُمد C ولم يُطبَّق
    { kind: 'iban', entityId: 'emp:e3', stage: 'approve', digest: dg('emp:e3', A), atMs: 1 },                                  // e3: السجل C يخالف آخر اعتماد A
    { kind: 'iban', entityId: 'sup:s1', stage: 'approve', subRef: 'sub3', digest: dg('sup:s1', C), atMs: 2 }];                // s1: اعتماد ببصمة غير الطلب ولا السجل
  const S = E.ibanStatus(org, sigs); const st = Object.fromEntries(S.payees.map(p => [p.ent, [p.st, p.effective]]));
  assert.deepEqual(st['emp:e1'], ['ok', A]);
  assert.deepEqual(st['emp:e2'], ['approved', C], 'المعتمد يُستخدم قبل تطبيقه');
  assert.deepEqual(st['emp:e3'], ['changed', null], 'عُدّل خارج المسار');
  assert.deepEqual(st['emp:e4'], ['pending', null]);
  assert.deepEqual(st['emp:e5'], ['unverified', null], 'قديم بلا اعتماد موقّع');
  assert.deepEqual(st['sup:s1'], ['changed', null], 'اعتماد ببصمة آيبان آخر لا يوثّق السجل ولا يُطبَّق');
  assert.equal(S.reqs.find(r => r.id === 'r3').valid, false);
  const d2 = E.ibanApply(org, S.reqs.filter(r => r.decision));
  assert.equal(d2.employees.find(e => e.id === 'e2').iban, C, 'التطبيق يضع المعتمد');
  assert.equal(d2.suppliers[0].iban, B, 'غير الصالح لا يُطبَّق');
  assert.deepEqual(d2.ibanReqs.map(r => r.id), ['r2'], 'المقرَّر يُزال والمعلّق يبقى');
  assert.deepEqual(E.ibanStatus(org, 'err').payees.find(p => p.ent === 'emp:e1').st, 'na', 'تعذّر القراءة ⇒ لا ادعاء توثيق');
  assert.deepEqual([...E.IBAN_APPROVERS].sort(), ['finance_department', 'general_management', 'head_office', 'system_admin']);
});

// ===== v41.1 — السعرات الحرارية =====
test('السعرات: لكل 100 غ/مل تُحوَّل بوحدة الصنف، ولكل وحدة للمعدود، والتحضيرات تُفكّ، والناقص لا يُعطى رقمًا جزئيًا، والمعتمدة تتقدم', () => {
  const org = baseOrg({ items: [{ id: 'ch', name: 'دجاج', unit: 'كجم', kcal: { basis: '100', v: 165 } }, { id: 'oi', name: 'زيت', unit: 'لتر', kcal: { basis: '100', v: 884 } },
      { id: 'br', name: 'خبز', unit: 'حبة', kcal: { basis: 'unit', v: 160 } }, { id: 'ga', name: 'ثوم', unit: 'كجم' }, { id: 'sp', name: 'بهارات', unit: 'جم', kcal: { basis: '100', v: 300 } }],
    preps: [{ id: 'sauce', name: 'صلصة', unit: 'كجم', batch: 1, parts: [{ itemId: 'oi', qty: 0.5 }, { itemId: 'sp', qty: 100 }] }] });
  assert.equal(E.kcalPerUnit(org.items[0]), 1650, '165 لكل 100 غ ⇒ 1650 لكل كجم');
  assert.equal(E.kcalPerUnit(org.items[4]), 3, '300 لكل 100 غ ⇒ 3 لكل غرام');
  assert.equal(E.kcalPerUnit(org.items[3]), null);
  const P = { id: 'P', name: 'شاورما', parts: [{ itemId: 'ch', qty: 0.15, yield: 75 }, { itemId: 'br', qty: 1 }, { prepId: 'sauce', qty: 0.03 }] };
  assert.deepEqual(E.productKcal(org, P), { kcal: 632, miss: [], src: 'recipe' }, 'دجاج 0.2 كجم خام ×1650=330 + خبز 160 + صلصة (0.015 لتر×8840=132.6 + 3 غ×3=9) = 631.6');
  assert.deepEqual(E.productKcal(org, { ...P, parts: [...P.parts, { itemId: 'ga', qty: 0.01 }] }), { kcal: null, miss: ['ثوم'], src: 'recipe' }, 'مكوّن بلا سعرات ⇒ ناقصة لا رقم جزئي');
  assert.deepEqual(E.productKcal(org, { ...P, kcalDeclared: '610' }), { kcal: 610, src: 'declared', miss: [] }, 'المعتمدة من مختبر تتقدم');
  assert.equal(E.productKcal(org, { id: 'x', parts: [] }).kcal, null);
});

// ===== v41.2 — حجم البيانات ونموها =====
test('حجم البيانات: الحجم الفعلي لكل مجموعة، والنمو الشهري متوسط آخر 3 أشهر مكتملة، والإسقاط بالمعدل الحالي', () => {
  const o = (id, date, b) => ({ id, date, branchId: b, note: 'x'.repeat(50) });
  const ops = { posOrders: [o('a', '2026-08-03', 'b1'), o('b', '2026-09-03', 'b1'), o('c', '2026-10-03', 'b2'), o('d', '2026-10-09', 'b1'), o('e', '2026-11-02', 'b1'), o('f', '2026-05-01', 'b1')], closings: [], misc: { a: 1 } };
  const F = E.dataFootprint(ops, { today: '2026-11-14' });
  assert.deepEqual(F.months, ['2026-10', '2026-09', '2026-08'], 'الشهر الجاري غير مكتمل فلا يدخل');
  const r = F.rows[0]; const one = new TextEncoder().encode(JSON.stringify(ops.posOrders[0])).length;
  assert.deepEqual([r.key, r.n, r.oldest, r.branches], ['posOrders', 6, '2026-05-01', { b1: 5, b2: 1 }]);
  assert.equal(r.bytes, new TextEncoder().encode(JSON.stringify(ops.posOrders)).length);
  assert.equal(r.growth, Math.round(4 * one / 3), '4 سجلات في الأشهر الثلاثة');
  assert.equal(r.proj12, r.bytes + r.growth * 12);
  assert.equal(F.rows.length, 1, 'المجموعات الفارغة وغير المصفوفات لا تُعدّ');
});

// ===== v41.3 — التسوية التلقائية لوسيط الشبكة =====
test('تسوية الوسيط: قيد متوازن لليوم المعتمد إغلاقه فقط (بنك + عمولة بلا ضريبة + ضريبة مدخلات ⇐ الوسيط)، ولا يتكرر، والوسيط يُقفل', () => {
  const row = (d, op, tid, card, cr, db) => [d, '00:57:05', op, '', '', '', 'جهاز ...' + tid + ' (' + card + ')', '', '155216470216' + tid, card, '', 'نقاط البيع', cr, db];
  const grid = [['التاريخ', 'الوقت', 'البيان', 'x', 'x', 'x', 'التفاصيل', 'x', 'رقم الجهاز', 'نوع البطاقة', 'المرجع', 'طريقة', 'دائن', 'مدين'],
    row('2026-11-02', 'نقاط بيع - دائنة التاجر', '4274', 'مدى', 1708, 0), row('2026-11-02', 'نقاط بيع - مدين التاجر عمولة', '4274', 'مدى', 0, 15.76),
    row('2026-11-02', 'عمليات التجار مبيعات شبكة', '4274', 'فيزا', 333.08, 0), row('2026-11-02', 'عمليات التجار مبيعات شبكة', '4274', 'ماستركارد', 162.67, 0),
    row('2026-11-03', 'نقاط بيع - دائنة التاجر', '4274', 'مدى', 1000, 0), row('2026-11-03', 'نقاط بيع - مدين التاجر عمولة', '4274', 'مدى', 0, 9.22)];
  const L = E.cardStmtLines(grid, E.detectStmtMap(grid));
  const org = baseOrg({ taxCfg: { enabled: true, rate: 15 }, cardTerminals: [{ tid: '4274', branchId: 'b1' }], profitCfg: { cardRates: { mada: 0.8, visa: 2.5, mc: 2.5 } }, posClearing: { enabled: true, from: '2026-10' } });
  const ops = { closings: [{ id: 'c1', branchId: 'b1', date: '2026-11-01', status: 'approved', cardSales: 2218.42, cashSales: 0, totalRevenue: 2218.42, expenses: [] }, { id: 'c2', branchId: 'b1', date: '2026-11-02', status: 'submitted', cardSales: 1000, totalRevenue: 1000, expenses: [] }] };
  const P = E.cardSettlePlan(org, ops, L, { lags: { b1: 1 } });
  assert.deepEqual(P.rows.map(r => [r.date, r.biz, r.status]), [['2026-11-02', '2026-11-01', 'ready'], ['2026-11-03', '2026-11-02', 'pending']], 'الإغلاق غير المعتمد يُنتظر');
  const r = P.rows[0];
  assert.deepEqual([r.gross, r.net, r.fee, r.feeEx, r.vat], [2218.42, 2187.99, 30.43, 26.46, 3.97]);
  assert.deepEqual(r.lines, [{ code: '1201', debit: 2187.99, credit: 0 }, { code: '5303', debit: 26.46, credit: 0 }, { code: '1501', debit: 3.97, credit: 0 }, { code: '1801', debit: 0, credit: 2218.42 }]);
  const jm = { id: 'j1', date: r.date, title: 'تسوية', ref: r.ref, lines: r.lines };
  const A = E.buildAccounting(org, { ...ops, journalManual: [jm] });
  const bal = (c) => Math.round(((A.accounts.find(a => a.code === c) || {}).balance || 0) * 100) / 100;
  assert.equal(bal('1801'), 1000, 'يوم 1 نوفمبر أُقفل بالكامل، ويبقى في الوسيط يوم 2 نوفمبر (إغلاقه غير معتمد فلم يُسوَّ)');
  assert.equal(E.cardSettlePlan(org, { ...ops, journalManual: [jm] }, L, { lags: { b1: 1 } }).rows[0].status, 'done', 'لا يتكرر');
  const off = E.cardSettlePlan({ ...org, posClearing: {} }, ops, L, { lags: { b1: 1 } }).rows[0];
  assert.deepEqual(off.lines, [{ code: '5303', debit: 26.46, credit: 0 }, { code: '1501', debit: 3.97, credit: 0 }, { code: '1201', debit: 0, credit: 30.43 }], 'بلا وسيط: العمولة فقط من البنك');
});

// ===== v41.4 — انجراف التخزين: كل مجموعة يكتبها commit موجودة في قوائم التقسيم (وإلا لا تُحفظ في السحابة) =====
test('التخزين: كل مجموعة تُكتب عبر commit مُدرجة في BR_COLS أو CORE_COLS — (اكتُشف: cardRecons كانت خارجها)', async () => {
  const fs = await import('node:fs'); const path = await import('node:path');
  const root = new URL('..', import.meta.url).pathname; const app = fs.readFileSync(path.join(root, 'App.jsx'), 'utf8');
  const lst = (n) => { const i = app.indexOf('const ' + n + ' = ['); const j = app.indexOf('];', i); return [...app.slice(i, j).matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]); };
  const known = new Set([...lst('BR_COLS'), ...lst('CORE_COLS')]);
  const files = [path.join(root, 'App.jsx'), ...fs.readdirSync(path.join(root, 'mods')).flatMap(d => fs.readdirSync(path.join(root, 'mods', d)).filter(f => f.endsWith('.jsx')).map(f => path.join(root, 'mods', d, f)))];
  const miss = {};
  files.forEach(f => { const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/\bcommit\(\s*(?:async\s*)?\(?d\)?\s*=>([\s\S]{0,600}?)(?:\}\)\s*,|\)\s*,\s*\{)/g)) {
      [...m[1].matchAll(/\.\.\.d,\s*(\w+)\s*:/g), ...m[1].matchAll(/\bd\.(\w+)\s*\|\|\s*\[\]/g)].forEach(x => { if (!known.has(x[1])) (miss[x[1]] = miss[x[1]] || new Set()).add(path.basename(f)); }); } });
  assert.deepEqual(Object.fromEntries(Object.entries(miss).map(([k, v]) => [k, [...v]])), {}, 'مجموعات تُكتب ولا تُحفظ');
  assert.ok(known.has('cardRecons') && known.has('fsLogs'));
});

test('سجل سلامة الغذاء: الالتزام = القراءات المنجزة ÷ المطلوبة (بحد القراءات اليومية)، وخارج المدى يُرصد', () => {
  const org = baseOrg({ fsCfg: { perDay: 2 }, fsUnits: [{ id: 'u1', branchId: 'b1', name: 'ثلاجة 1', kind: 'fridge', min: 0, max: 5 }, { id: 'u2', branchId: 'b1', name: 'فريزر', kind: 'freezer', min: -40, max: -18 }] });
  const lg = (id, unitId, date, temp, ok) => ({ id, branchId: 'b1', unitId, date, at: date + 'T08:00', temp, ok });
  const ops = { fsLogs: [lg('a', 'u1', '2026-11-01', 3, true), lg('b', 'u1', '2026-11-01', 4, true), lg('c', 'u1', '2026-11-01', 4, true), lg('d', 'u2', '2026-11-01', -10, false), lg('e', 'u1', '2026-11-02', 2, true)] };
  const S = E.fsStatus(org, ops, { from: '2026-11-01', to: '2026-11-02' }).branches[0];
  assert.deepEqual([S.req, S.done, S.pct, S.out.length], [8, 4, 50, 1], 'u1: 2(حد)+1، u2: 1 — من 2×2×2');
  assert.deepEqual(S.missed.map(m => [m.unit, m.date, m.n]), [['ثلاجة 1', '2026-11-02', 1], ['فريزر', '2026-11-01', 1], ['فريزر', '2026-11-02', 0]]);
  assert.equal(E.fsInRange({ min: -40, max: -18 }, -10), false); assert.equal(E.fsInRange({ min: 0, max: 5 }, 5), true); assert.equal(E.fsInRange({ min: 0, max: 5 }, 'x'), false);
});

// ===== v41.5 — الجرد النقدي المفاجئ =====
test('الجرد المفاجئ: المتوقع من الوردية المفتوحة = الافتتاحي + صافي النقدي، والحالة لكل فرع مرتبة بالأطول بلا جرد', () => {
  const ops = { posShifts: [{ id: 's1', branchId: 'b1', status: 'open', openingCash: 300, openedBy: 'سالم' }, { id: 's0', branchId: 'b1', status: 'closed', openingCash: 300 }],
    posOrders: [{ id: 'o1', shiftId: 's1', status: 'paid', total: 100, payments: [{ m: 'cash', amount: 150 }], change: 50 }, { id: 'o2', shiftId: 's1', status: 'void', payments: [{ m: 'cash', amount: 999 }] }, { id: 'o3', shiftId: 's1', total: 80, payments: [{ m: 'card', amount: 80 }] }],
    cashCounts: [{ id: 'c1', branchId: 'b1', date: '2026-11-10', at: '2026-11-10T13:00', variance: -20 }, { id: 'c2', branchId: 'b1', date: '2026-11-01', at: '2026-11-01T13:00', variance: 5 }] };
  assert.deepEqual(E.ccOpenShifts(ops, 'b1').map(s => [s.id, s.expected, s.openedBy]), [['s1', 400, 'سالم']], '300 + (150 − 50) — الملغاة والشبكة لا تدخل');
  const org = baseOrg({ branches: [{ id: 'b1', name: 'العليا', isActive: true }, { id: 'b2', name: 'النسيم', isActive: true }] });
  const S = E.cashCountStatus(org, ops, { today: '2026-11-14' });
  assert.deepEqual(S.map(b => [b.id, b.days, b.n90, b.short90, b.over90, b.withVar]), [['b2', null, 0, 0, 0, 0], ['b1', 4, 2, 20, 5, 2]], 'من لم يُجرد قط أولًا');
});

// ===== v41.6 — صيانة المعدات =====
test('صيانة المعدات: البلاغ المفتوح، التكلفة والتوقف في 12 شهرًا، الوقائية المستحقة، والدفع أثناء الضمان ونسبته من الأصل', () => {
  const org = baseOrg({ assets: [{ id: 'a1', name: 'قلاية', cost: 10000 }], equipment: [{ id: 'e1', branchId: 'b1', name: 'قلاية 1', assetId: 'a1', warrantyTo: '2026-12-31', pmDays: 90 }, { id: 'e2', branchId: 'b1', name: 'فرن' }] });
  const ops = { maintLogs: [
    { id: 'm1', equipId: 'e1', type: 'breakdown', at: '2026-10-01T10:00', status: 'done', doneAt: '2026-10-01T16:00', cost: 800 },
    { id: 'm2', equipId: 'e1', type: 'preventive', at: '2026-07-01T09:00', status: 'done', doneAt: '2026-07-01T09:00', cost: 200 },
    { id: 'm3', equipId: 'e1', type: 'breakdown', at: '2026-11-13T12:00', status: 'open' },
    { id: 'm4', equipId: 'e1', type: 'breakdown', at: '2025-01-01T10:00', status: 'done', doneAt: '2025-01-01T12:00', cost: 5000 }] };
  const S = E.maintStatus(org, ops, { today: '2026-11-14' }); const x = S[0];
  assert.equal(x.id, 'e1', 'صاحب البلاغ المفتوح أولًا');
  assert.deepEqual([x.open.length, x.breakdowns12, x.cost12, x.downHrs12, x.lastPM, x.nextPM, x.pmDue, x.warranty, x.paidInWarranty, x.costPct],
    [1, 2, 1000, 6, '2026-07-01', '2026-09-29', true, true, 1000, 10], 'خارج 12 شهرًا لا يدخل؛ 800+200 دُفعا والجهاز تحت الضمان');
  assert.deepEqual([S[1].pmDue, S[1].costPct, S[1].warranty], [false, null, false], 'بلا دورة وقائية ولا أصل ولا ضمان');
});

// ===== v41.7 — أرشفة فواتير نقطة البيع =====
test('الأرشفة: فواتير الأشهر المقفلة الأقدم من 12 شهرًا فقط، مجمّعة لكل فرع وسنة، والدفاتر لا تتغير بإزالتها', () => {
  const org = baseOrg({ branches: [{ id: 'b1', name: 'العليا', isActive: true }], periodLocks: { lockedThrough: '2025-10' } });
  const o = (id, date, total) => ({ id, branchId: 'b1', date, total, status: 'paid', lines: [{ productId: 'p', qty: 1 }], payments: [{ m: 'cash', amount: total }] });
  const ops = { posOrders: [o('a', '2024-12-30', 50), o('b', '2025-03-05', 20), o('c', '2025-10-31', 30), o('d', '2025-11-02', 40), o('e', '2026-11-01', 10)],
    closings: [{ id: 'c1', branchId: 'b1', date: '2025-03-05', status: 'approved', cashSales: 20, totalRevenue: 20, expenses: [] }] };
  const P = E.archivePlan(org, ops, { today: '2026-11-14' });
  assert.equal(P.cutoff, '2025-11-01');
  assert.deepEqual(P.groups.map(g => [g.year, g.ids, g.from, g.to, g.total, g.key]), [['2024', ['a'], '2024-12-30', '2024-12-30', 50, 'rms8:arch_b1_2024'], ['2025', ['b', 'c'], '2025-03-05', '2025-10-31', 50, 'rms8:arch_b1_2025']], 'نوفمبر 2025 خارج (غير مقفل وضمن الـ12 شهرًا)');
  const P2 = E.archivePlan({ ...org, periodLocks: { lockedThrough: '2025-01' } }, ops, { today: '2026-11-14' });
  assert.deepEqual([P2.n, P2.unlocked], [1, 2], 'شهر غير مقفل لا يُؤرشَف ولو كان قديمًا');
  const ids = new Set(P.groups.flatMap(g => g.ids));
  const tb = (x) => JSON.stringify(E.buildAccounting(org, x).accounts.map(a => [a.code, Math.round(a.balance * 100)]));
  assert.equal(tb({ ...ops, posOrders: ops.posOrders.filter(x => !ids.has(x.id)) }), tb(ops), 'ميزان المراجعة متطابق قبل الأرشفة وبعدها');
});

test('v41.9 سجلات الإغلاق المستقلة: الفرق، مرجع التوقيع لكل انتقال، والمطابقة تكشف الناقص والمختلف والزائد', () => {
  const c = (x) => ({ id: 'c1', branchId: 'b1', date: '2026-11-14', status: 'draft', gmApprovalStatus: 'pending', cashSales: 100, cardSales: 50, totalRevenue: 150, expenses: [], ...x });
  const sub = c({ status: 'submitted', sigSubmit: 's1' });
  const aud = { ...sub, status: 'approved', sigAudit: 'a1' }, gm = { ...aud, gmApprovalStatus: 'approved', sigGm: 'g1' }, rej = { ...sub, status: 'rejected', sigReject: 'r1' };
  assert.equal(E.clrSigRef(c(), sub), '', 'الترحيل كتابة تشغيلية بلا قرار');
  assert.equal(E.clrSigRef(sub, aud), 'a1'); assert.equal(E.clrSigRef(aud, gm), 'g1'); assert.equal(E.clrSigRef(sub, rej), 'r1');
  assert.equal(E.clrSigRef(gm, { ...gm, transferStatus: 'received' }), '', 'تحديث تشغيلي لمعتمد بلا قرار جديد');
  const R = E.clrRecord(aud, sub);
  assert.deepEqual([R.branchId, R.date, R.status, R.gm, R.sigRef], ['b1', '2026-11-14', 'approved', 'pending', 'a1']);
  assert.match(R.digest, /^[0-9a-f]{64}$/);
  assert.equal(R.digest, E.clrRecord({ ...aud, transferStatus: 'received' }).digest, 'البصمة لا تتأثر بالبيانات التشغيلية');
  assert.notEqual(R.digest, E.clrRecord({ ...aud, cashSales: 101 }).digest, 'وتتأثر بالأرقام');
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(9000);
  assert.ok(E.clrRecord({ ...aud, cardReceiptImage: img }).data.length < 2000, 'الصور الكبيرة لا تُنسخ إلى السجل');
  const D = E.clrDiff([sub, c({ id: 'c2' }), c({ id: 'bad id!' })], [aud, c({ id: 'c3' }), c({ id: 'c4', branchId: '' })]);
  assert.deepEqual(D.put.map(p => p.x.id), ['c1', 'c3']); assert.equal(D.put[0].prev.status, 'submitted');
  assert.deepEqual(D.del.map(d => d.id), ['c2'], 'المعرّف غير الصالح لا يُحذف'); assert.deepEqual(D.skip.map(s => s.x.id), ['c4'], 'بلا فرع لا يُنسخ');
  assert.deepEqual(E.clrDiff([sub], [JSON.parse(JSON.stringify(sub))]).put, [], 'لا كتابة بلا تغيير');
  const recOf = (x) => ({ id: x.id, ...E.clrRecord(x) });
  assert.equal(E.clrCompare([aud], [recOf(aud)]).ok, true);
  const K = E.clrCompare([aud, c({ id: 'c5' })], [{ ...recOf(aud), status: 'submitted' }, recOf(c({ id: 'c9' }))]);
  assert.deepEqual([K.ok, K.missing.map(x => x.id), K.differ.map(x => x.id), K.extra.map(x => x.id)], [false, ['c5'], ['c1'], ['c9']]);
  assert.equal(E.clrCompare([{ ...aud, cashSales: 999 }], [recOf(aud)]).differ.length, 1, 'تعديل الأرقام في مستند الفرع يُكشف');
  assert.equal(E.clrOn({ closingRecords: { on: true } }), true); assert.equal(E.clrOn({}), true, 'v46.9: مفعّلة افتراضيًا (قرار المالك)'); assert.equal(E.clrOn({ closingRecords: { on: false } }), false, 'تُطفأ صراحةً فقط'); assert.equal(E.clrOn(E.dirOf({ company: {} })), true);
  assert.equal(E.clrRead({ closingRecords: { read: true } }), true, 'القراءة تتبع التفعيل الافتراضي'); assert.equal(E.clrRead({}), false, 'القراءة يدوية');
  assert.equal(E.clrOn(E.dirOf({ company: {}, closingRecords: { on: false } })), false, 'الإشارة (ومنها الإيقاف) تصل لأجهزة الفروع عبر الدليل');
});

test('v42.0 فرق سعر الشراء (مقابل آخر سعر) ودوران المخزون', () => {
  const org = { items: [{ id: 'm', name: 'لحم', unit: 'كجم', cost: 40 }, { id: 'r', name: 'أرز', unit: 'كجم', cost: 5 }, { id: 's', name: 'صيانة', type: 'service' }], branches: [] };
  const P = (id, d, it, q, u) => ({ id, date: d, at: d + 'T10:00', itemId: it, kind: 'purchase', qty: q, unitCost: u });
  const ops = { stockMoves: [
    P('p1', '2026-09-01', 'm', 100, 40), P('p2', '2026-10-05', 'm', 50, 44), P('p3', '2026-10-20', 'm', 20, 42),
    P('p4', '2026-10-02', 'r', 200, 5),
    { id: 'rt', date: '2026-10-21', itemId: 'm', kind: 'purchase', qty: -5, unitCost: 42 },
    { id: 'o1', date: '2026-10-10', itemId: 'm', kind: 'out', qty: -60 }, { id: 'w1', date: '2026-10-11', itemId: 'm', kind: 'waste', qty: -5 },
    { id: 'a1', date: '2026-10-30', itemId: 'm', kind: 'adjust', qty: -2 }, { id: 'a2', date: '2026-10-30', itemId: 'm', kind: 'adjust', qty: 1 }
  ], whMoves: [], whTransfers: [] };
  const R = E.ppvReport(org, ops, { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(R.lines.map(l => [l.id, l.prevUnit, l.unit, l.value]).sort(), [['p2', 40, 44, 200], ['p3', 44, 42, -40]].sort(), 'كل استلام مقابل السابق له، والمرتجع لا يُحتسب');
  assert.deepEqual([R.up, R.down, R.net], [200, 40, 160]);
  assert.equal(R.lines.some(l => l.itemId === 'r'), false, 'أول شراء للصنف بلا مقارنة');
  assert.equal(E.ppvReport(org, ops, { from: '2026-10-06', to: '2026-10-31' }).lines.length, 1, 'السعر السابق يُؤخذ ولو كان قبل الفترة');
  const T = E.invTurnover(org, ops, { from: '2026-10-01', to: '2026-10-31' });
  const m = T.rows.find(r => r.itemId === 'm'), r = T.rows.find(x => x.itemId === 'r');
  assert.equal(m.openQ, 100); assert.equal(m.closeQ, 100 + 50 + 20 - 5 - 60 - 5 - 2 + 1);
  assert.equal(m.useQ, 67, 'صرف 60 + هدر 5 + عجز جرد 2 — الزيادة والمرتجع لا يُحتسبان');
  assert.ok(Math.abs(m.turn - (m.use / m.avgInv)) < 0.01);
  assert.equal(m.days, Math.round(31 / m.turn));
  assert.equal(r.idle, true, 'صنف بلا استهلاك = راكد'); assert.equal(r.turn, 0);
  assert.equal(T.rows.some(x => x.itemId === 's'), false, 'الخدمي لا يدخل');
  assert.ok(T.idleValue > 0 && T.turn > 0);
});

test('v42.2 القراءة من السجلات: السجل يغلب مستند الفرع، والاعتماد بلا سجل يُعرض مرحّلًا، والصور تُستعاد', () => {
  const c = (x) => ({ id: 'c1', branchId: 'b1', date: '2026-11-14', status: 'submitted', gmApprovalStatus: 'pending', cashSales: 100, cardSales: 50, totalRevenue: 150, expenses: [], ...x });
  const img = 'data:image/jpeg;base64,' + 'A'.repeat(9000);
  const ok = c({ status: 'approved', cardReceiptImage: img });
  const rec = (x) => ({ id: x.id, ...E.clrRecord(x) });
  // 1) الفرع زوّر الأرقام في مستنده بعد الاعتماد ⇒ يُعرض ما في السجل
  const tampered = { ...ok, cashSales: 999, totalRevenue: 1049 };
  let M = E.clrMerge([tampered], [rec(ok)]);
  assert.equal(M.list[0].cashSales, 100); assert.equal(M.list[0].totalRevenue, 150); assert.equal(M.stats.fixed, 1);
  assert.equal(M.list[0].cardReceiptImage, img, 'الصورة المختصرة في السجل تُستعاد من مستند الفرع');
  // 2) الحالة من حقل السجل (المحروس) لا من داخل البيانات
  const r2 = rec(c({ id: 'c2' })); r2.data = JSON.stringify({ ...JSON.parse(r2.data), status: 'approved' });
  assert.equal(E.clrMerge([], [r2]).list[0].status, 'submitted', 'كتابة «معتمد» داخل البيانات لا تجعل الإغلاق معتمدًا');
  // 3) «معتمد» في مستند الفرع بلا سجل ⇒ مرحّل ومعلَّم
  M = E.clrMerge([c({ id: 'c3', status: 'approved' })], []);
  assert.deepEqual([M.list[0].status, M.list[0]._clrDemoted, M.stats.demoted], ['submitted', true, 1]);
  // 4) مسودة بلا سجل تبقى كما هي معلَّمة
  M = E.clrMerge([c({ id: 'c4', status: 'draft' })], []);
  assert.deepEqual([M.list[0].status, M.list[0]._clrUnrec, M.list[0]._clrDemoted], ['draft', true, undefined]);
  // 5) بصمة لا تطابق أرقام سجل معتمد ⇒ تُكشف
  const r5 = rec(ok); r5.data = JSON.stringify({ ...JSON.parse(r5.data), cashSales: 500 });
  assert.equal(E.clrMerge([], [r5]).list[0]._clrDigestBad, true);
  // 6) الإشارة تتطلب النسخ والقراءة معًا
  assert.equal(E.clrRead({ closingRecords: { on: true, read: true } }), true);
  assert.equal(E.clrRead({ closingRecords: { on: false, read: true } }), false);
  assert.equal(E.clrRead({}), false, 'مُطفأة افتراضيًا');
});

test('v42.8 أوامر الإنتاج: الاحتياج من الوصفة بالناتج، التحضيرة المخزّنة تُصرف من مخزونها، المنع عند النقص، والتكلفة تنتقل للناتج', () => {
  const org = { branches: [], warehouses: [],
    items: [{ id: 'ga', name: 'ثوم', unit: 'كجم', cost: 10 }, { id: 'oi', name: 'زيت', unit: 'لتر', cost: 8 }, { id: 'pp_sauce', name: 'ثومية', unit: 'كجم', type: 'stock', prepId: 'sauce' }],
    preps: [{ id: 'sauce', name: 'ثومية', unit: 'كجم', batch: 5, parts: [{ itemId: 'ga', qty: 1, yield: 80 }, { itemId: 'oi', qty: 4 }] },
      { id: 'mar', name: 'تتبيلة', unit: 'كجم', batch: 2, parts: [{ prepId: 'sauce', qty: 1 }, { itemId: 'oi', qty: 1 }] },
      { id: 'mar2', name: 'تتبيلة2', unit: 'كجم', batch: 2, parts: [{ prepId: 'raw', qty: 1 }] }, { id: 'raw', name: 'خليط غير مخزّن', unit: 'كجم', batch: 1, parts: [{ itemId: 'ga', qty: 0.5 }] }] };
  // 10 كجم ثومية = دفعتان: ثوم 1÷0.8×2 = 2.5 · زيت 8
  assert.deepEqual(E.prodNeeds(org, org.preps[0], 10).need, { ga: 2.5, oi: 8 });
  // التحضيرة الفرعية المخزّنة تُصرف كصنف، وغير المخزّنة تُفكّ إلى خاماتها
  assert.deepEqual(E.prodNeeds(org, org.preps[1], 4).need, { pp_sauce: 2, oi: 2 });
  assert.deepEqual(E.prodNeeds(org, org.preps[2], 2).need, { ga: 0.5 });
  const ops = { stockMoves: [{ id: 'a', date: '2026-11-01', at: '2026-11-01T08:00', itemId: 'ga', kind: 'purchase', qty: 3, unitCost: 10 }, { id: 'b', date: '2026-11-01', at: '2026-11-01T08:00', itemId: 'oi', kind: 'purchase', qty: 10, unitCost: 8 }], whMoves: [], whTransfers: [] };
  const C = E.prodCheck(org, ops, 'sauce', 10);
  assert.equal(C.cost, 2.5 * 10 + 8 * 8); assert.equal(C.unitCost, 8.9); assert.equal(C.short.length, 0);
  assert.equal(E.prodCheck(org, ops, 'sauce', 20).short.length, 2, 'ضعف الكمية ⇒ نقص في الثوم والزيت');
  assert.match(E.prodMoves(org, ops, { id: 'm1', no: 'MO-1', prepId: 'sauce' }, 20).err, /رصيد غير كافٍ/, 'المخزون السالب ممنوع');
  assert.match(E.prodCheck({ ...org, items: org.items.filter(i => !i.prepId) }, ops, 'sauce', 10).err, /غير مفعّل تخزينها/);
  const P = E.prodMoves(org, ops, { id: 'm1', no: 'MO-1', prepId: 'sauce' }, 10, { date: '2026-11-02', at: '2026-11-02T09:00', by: 'شيف' });
  assert.equal(P.col, 'stockMoves');
  const ops2 = { ...ops, stockMoves: [...P.moves, ...ops.stockMoves] };
  const T = E.stockByWh(org, ops2).total;
  assert.deepEqual([Math.round(T.ga * 1000) / 1000, T.oi, T.pp_sauce], [0.5, 2, 10], 'صُرفت الخامات ودخل الناتج');
  assert.equal(E.itemAvgCosts(org, ops2).pp_sauce, 8.9, 'الناتج مكلَّف بما استُهلك');
  const A0 = E.buildAccounting(org, ops), A1 = E.buildAccounting(org, ops2);
  assert.equal(A1.balanced, true); assert.equal(A1.entries.length, A0.entries.length, 'نقل داخل المخزون — لا قيد');
});

test('v42.9 الطاولات والحساب المفتوح وشاشة المطبخ: الجولات تُجمع، الحالة لكل طاولة، والتذاكر بلا أسعار، والتقليم', () => {
  const org = { posCfg: { tables: { b1: 4 }, kds: true } };
  assert.deepEqual(E.posTables(org, 'b1'), ['1', '2', '3', '4']); assert.deepEqual(E.posTables(org, 'b2'), [], 'مُطفأة افتراضيًا');
  assert.equal(E.kdsOn(org), true); assert.equal(E.kdsOn({}), false);
  const tab = { id: 't1', branchId: 'b1', table: '2', status: 'open', openedAt: '2026-11-15T12:00:00Z', rounds: [
    { at: '2026-11-15T12:00:00Z', lines: [{ productId: 'k', name: 'كبسة', price: 58, qty: 2 }, { productId: 'h', name: 'حمص', price: 18, qty: 1, note: 'بدون ثوم' }] },
    { at: '2026-11-15T12:20:00Z', lines: [{ productId: 'k', name: 'كبسة', price: 58, qty: 1 }, { productId: 'h', name: 'حمص', price: 18, qty: 1 }] }] };
  const S = E.tabSum(tab);
  assert.deepEqual(S.lines.map(l => [l.productId, l.qty, l.note || '']), [['k', 3, ''], ['h', 1, 'بدون ثوم'], ['h', 1, '']], 'تُجمع بالصنف والسعر والملاحظة');
  assert.equal(S.total, 3 * 58 + 18 + 18); assert.equal(S.rounds, 2);
  const ops = { posTabs: [tab, { ...tab, id: 't0', table: '3', status: 'paid' }, { ...tab, id: 't9', table: '4', billAt: '2026-11-15T12:40:00Z' }] };
  assert.equal(E.openTab(ops, 'b1', '3'), null, 'المدفوع ليس مفتوحًا');
  const T = E.tableStates(org, ops, 'b1', Date.parse('2026-11-15T12:45:00Z'));
  assert.deepEqual(T.map(x => [x.no, x.st, x.mins || 0]), [['1', 'free', 0], ['2', 'busy', 45], ['3', 'free', 0], ['4', 'bill', 45]]);
  const k = E.kdsTicket({ branchId: 'b1', src: 'tab', table: '2', lines: tab.rounds[0].lines, at: '2026-11-15T12:00:00Z' });
  assert.equal(k.status, 'new'); assert.equal(JSON.stringify(k.lines).includes('price'), false, 'المطبخ لا يرى الأسعار');
  const live = E.kdsLive({ kdsTickets: [{ ...k, id: 'a', at: '2026-11-15T12:05:00Z' }, { ...k, id: 'b', at: '2026-11-15T12:01:00Z' }, { ...k, id: 'c', status: 'served' }] }, 'b1');
  assert.deepEqual(live.map(x => x.id), ['b', 'a'], 'غير المُسلّمة فقط والأقدم أولًا');
  const d = E.posTrim({ kdsTickets: [{ id: 'old', status: 'served', at: '2026-11-10T10:00:00Z' }, { id: 'new', status: 'served', at: '2026-11-14T10:00:00Z' }, { id: 'live', status: 'new', at: '2026-11-01T10:00:00Z' }],
    posTabs: [{ id: 'p1', status: 'paid', closedAt: '2026-11-01T10:00:00Z' }, { id: 'p2', status: 'open', openedAt: '2026-11-01T10:00:00Z' }] }, '2026-11-15');
  assert.deepEqual([d.kdsTickets.map(x => x.id), d.posTabs.map(x => x.id)], [['new', 'live'], ['p2']]);
});

// ===== v43.5 — مسار الفحص: GRNI عند الفحص، والفاتورة تُقفله وفرق السعر إلى 5504؛ وفاتورة الخدمات ببنودها =====
test('v43.5 الفحص ثم الفاتورة بسعر أعلى: المستودع بسعر الأمر، و2105 يُقفل، والفرق 5504، والمورد بالسعر الفعلي', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { perpetualFrom: '2026-01', inspect: true },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }] });
  const mv = { id: 'm1', whId: 'wh-main', itemId: 'i1', kind: 'purchase', qty: 50, unitCost: 10, grnRef: 'g1', grn: 'GRN-1', date: '2026-03-02', at: '2026-03-02T08:00:00Z' };
  // قبل الفاتورة: بضاعة مستلمة لم تُفوتر
  let A = E.buildAccounting(org, { stockMoves: [mv], whMoves: [], whTransfers: [] }); let t = tb(A);
  assert.equal(A.balanced, true); near(t['160101'], 500, 'المقبول دخل المستودع بسعر الأمر'); near(t['2105'], -500, 'بضاعة مستلمة لم تُفوتر'); assert.equal(t['2101'] || 0, 0, 'لا ذمة مورد قبل الفاتورة');
  // الفاتورة: 50 × 10.2 = 510 + ضريبة 76.5
  const inv = { id: 'inv1', supplierId: 's1', supplierName: 'مورد', amount: 586.5, vatAmt: 76.5, taxable: true, date: '2026-03-05', paidAmount: 0, whId: 'wh-main', grnRefs: ['g1'], poNet: 500,
    lines: [{ itemId: 'i1', qty: 50, unitCost: 10.2, net: 510, poNet: 500, stock: true, grnRef: 'g1' }] };
  A = E.buildAccounting(org, { stockMoves: [mv], whMoves: [], whTransfers: [], invoices: [inv] }); t = tb(A);
  assert.equal(A.balanced, true);
  near(t['160101'], 500, 'المستودع لا يتغير بالفاتورة'); assert.ok(Math.abs(t['2105'] || 0) < 0.01, '2105 أُقفل'); near(t['5504'], 10, 'فرق سعر الشراء');
  near(t['1501'], 76.5, 'ضريبة المدخلات'); near(t['2101'], -586.5, 'ذمة المورد بالسعر الفعلي');
  // سعر أقل: الفرق دائن
  const inv2 = { ...inv, amount: 563.5, vatAmt: 73.5, lines: [{ ...inv.lines[0], unitCost: 9.8, net: 490 }] };
  t = tb(E.buildAccounting(org, { stockMoves: [mv], whMoves: [], whTransfers: [], invoices: [inv2] }));
  near(t['5504'], -10, 'فرق سعر لصالحنا'); assert.ok(Math.abs(t['2105'] || 0) < 0.01);
  // 5504 ضمن تكلفة المبيعات
  const acc = E.buildAccounting(org, { stockMoves: [mv], whMoves: [], whTransfers: [], invoices: [inv] }).accounts.find(a => a.code === '5504');
  assert.ok(acc && acc.kind === 'exp', 'حساب فروق أسعار الشراء موجود');
});

test('v43.5 بلا جرد مستمر: الفحص لا يولّد قيدًا والفاتورة تُقيَّد مشتريات كما كانت', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { inspect: true } });
  const mv = { id: 'm1', itemId: 'i1', kind: 'purchase', qty: 50, unitCost: 10, grnRef: 'g1', date: '2026-03-02', at: '2026-03-02T08:00:00Z' };
  let A = E.buildAccounting(org, { stockMoves: [mv] }); assert.equal(A.entries.length, 0, 'لا قيد عند الفحص في الطريقة الدورية');
  const inv = { id: 'inv1', supplierId: 's1', supplierName: 'مورد', amount: 586.5, vatAmt: 76.5, taxable: true, date: '2026-03-05', paidAmount: 0, grnRefs: ['g1'], lines: [{ itemId: 'i1', qty: 50, unitCost: 10.2, net: 510, stock: true }] };
  const t = tb(E.buildAccounting(org, { stockMoves: [mv], invoices: [inv] }));
  near(t['5198'], 510, 'مشتريات'); near(t['2101'], -586.5); assert.equal(t['2105'] || 0, 0); assert.equal(t['5504'] || 0, 0);
});

test('v43.5 فاتورة خدمات ومصروفات: كل بند على حسابه، والضريبة للخاضع فقط، والإجمالي للمورد', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'شركة صيانة', vatNo: '300000000000003' }], expenseCats: [{ id: 'c1', n: 'صيانة وتشغيل' }, { id: 'c2', n: 'كهرباء ومياه' }] });
  const inv = { id: 'sv1', kind: 'svc', supplierId: 's1', supplierName: 'شركة صيانة', branchId: 'b1', amount: 1265, vatAmt: 165, taxable: true, date: '2026-03-10', paidAmount: 0,
    expLines: [{ desc: 'صيانة مكيف', accCode: '5101', net: 600, vat: 90 }, { desc: 'كهرباء', accCode: '5102', net: 500, vat: 75 }] };
  const A = E.buildAccounting(org, { invoices: [inv] }); const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['5101'], 600, 'الصيانة'); near(t['5102'], 500, 'الكهرباء'); near(t['1501'], 165, 'ضريبة المدخلات'); near(t['2101'], -1265, 'ذمة المورد'); assert.equal(t['5198'] || 0, 0, 'لا شيء على المشتريات العامة');
  const e = A.entries.find(x => x.id === 'inv:sv1'); assert.equal(e.branchId, 'b1', 'مركز التكلفة الفرع');
  // بند غير خاضع: صافيه كامل بلا ضريبة
  const t2 = tb(E.buildAccounting(org, { invoices: [{ ...inv, amount: 1190, vatAmt: 90, expLines: [inv.expLines[0], { desc: 'رسوم حكومية', accCode: '5102', net: 500, vat: 0 }] }] }));
  near(t2['5102'], 500); near(t2['1501'], 90); near(t2['2101'], -1190);
});

// ===== v43.9 — تعدد العملات: فاتورة بالدولار، سداد على دفعتين بسعرين، فرق الصرف محقّق في 5803 =====
test('v43.9 فاتورة 1000 USD @3.75 تُسدَّد 400 @3.80 ثم 600 @3.70: الذمة تُقفل، والبنك بالفعلي، والفرق 5803', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'Global Foods' }] });
  const inv = { id: 'f1', supplierId: 's1', supplierName: 'Global Foods', amount: 3750, cur: 'USD', fxRate: 3.75, fcAmount: 1000, date: '2026-03-01', paidAmount: 3750,
    payments: [{ id: 'p1', amount: 1500, fc: 400, rate: 3.8, paid: 1520, date: '2026-03-10', fund: '1201' }, { id: 'p2', amount: 2250, fc: 600, rate: 3.7, paid: 2220, date: '2026-04-10', fund: '1201' }] };
  const A = E.buildAccounting(org, { invoices: [inv] }); const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['5198'], 3750, 'المشتريات بسعر الفاتورة'); assert.ok(Math.abs(t['2101'] || 0) < 0.01, 'ذمة المورد أُقفلت'); near(t['1201'], -3740, 'البنك = 1520 + 2220');
  near(t['5803'], -10, 'صافي فرق الصرف: خسارة 20 − ربح 30 = ربح 10');
  const e1 = A.entries.find(x => x.id === 'invp:f1:p1'); assert.ok(e1.lines.some(l => l.code === '5803' && l.debit === 20), 'الدفعة الأولى خسارة 20');
  const e2 = A.entries.find(x => x.id === 'invp:f1:p2'); assert.ok(e2.lines.some(l => l.code === '5803' && l.credit === 30), 'الثانية ربح 30');
  assert.equal(E.buildAccounting(org, { invoices: [{ ...inv, cur: undefined, payments: [] , paidAmount: 0 }] }).accounts.some(a => a.code === '5803'), false, 'الحساب لا يظهر بلا فواتير عملة');
});

test('v44.2 فاتورة مدفوعة جزئيًا عند تسجيلها: قيد الفاتورة للمورد ثم دفعة من البنك، والباقي ذمة', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'مورد', vatNo: '300000000000003' }] });
  const inv = { id: 'x1', supplierId: 's1', supplierName: 'مورد', amount: 460, vatAmt: 60, taxable: true, date: '2026-03-01', paidAmount: 300, pm: 'bank', lines: [{ itemId: 'i1', qty: 10, unitCost: 40, net: 400, stock: false }],
    payments: [{ id: 'p1', amount: 300, date: '2026-03-01', fund: '1201', pm: 'bank', ref: 'TRX-77' }] };
  const A = E.buildAccounting(org, { invoices: [inv] }); const t = tb(A);
  assert.equal(A.balanced, true); near(t['2101'], -160, 'الباقي آجل'); near(t['1201'], -300, 'المدفوع من البنك'); near(t['1501'], 60); near(t['5198'], 400);
});

// ===== v44.3 — أوامر الشراء الموجّهة لمستودع الفرع: نسخة في مستند الفرع، واستلام الفرع المباشر يُقيَّد GRNI وتقفله الفاتورة =====
test('v44.3 مستودع الأمر ونسخة الفرع: المعتمد الموجّه لمستودع فرع فقط، بالمستلم وقيد الفحص، وحتمية بلا تغيير', () => {
  const org = { branches: [{ id: 'b1', name: 'ف1' }], warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main' }, { id: 'wh-b1', name: 'مستودع ف1', kind: 'branch', branchId: 'b1' }] };
  assert.equal(E.poWhOf(org, { whId: 'wh-b1' }), 'wh-b1');
  assert.equal(E.poWhOf(org, { branchId: 'b1' }), 'wh-b1', 'الأوامر القديمة: مستودع فرعها');
  assert.equal(E.poWhOf(org, {}), 'wh-main', 'وإلا الرئيسي');
  const ops = { purchaseOrders: [
    { id: 'p1', poNo: 'PO-1', status: 'open', whId: 'wh-b1', branchId: 'b1', supplierId: 's1', supplierName: 'م', lines: [{ itemId: 'i1', desc: 'زيت', qty: 10, received: 2, inQc: 3, price: 5 }] },
    { id: 'p2', poNo: 'PO-2', status: 'pending', whId: 'wh-b1', lines: [] },
    { id: 'p3', poNo: 'PO-3', status: 'open', whId: 'wh-main', lines: [] },
    { id: 'p4', poNo: 'PO-4', status: 'received', whId: 'wh-b1', lines: [] }] };
  const o = E.syncPoInbox(org, ops);
  assert.deepEqual(o.poInbox.map(x => [x.id, x.branchId, x.whId]), [['pib_p1', 'b1', 'wh-b1']], 'المعتمد قيد التوريد لمستودع فرع فقط');
  assert.equal(o.poInbox[0].lines[0].received, 5, 'المستلم + قيد الفحص');
  assert.equal(JSON.stringify(o.poInbox).includes('price'), false, 'لا أسعار في مستند الفرع');
  assert.equal(E.syncPoInbox(org, o), o, 'لا تغيير ⇒ نفس الكائن (لا كتابة)');
  assert.equal(E.syncPoInbox({}, ops), ops, 'بلا مستودعات لا شيء');
});
test('v44.3 استلام الفرع المباشر: مستودع الفرع مدين مقابل 2105 بسعر الأمر، والفاتورة المطابقة تقفله إلى المورد', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { perpetualFrom: '2026-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'مستودع ف1', kind: 'branch', branchId: 'b1', accCode: '160102' }] });
  const mv = { id: 'w1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 20, unitCost: 5, grnRef: 'grnB', grn: 'GRN-B', date: '2026-03-02', at: '2026-03-02T08:00:00Z' };
  let A = E.buildAccounting(org, { stockMoves: [], whMoves: [mv], whTransfers: [] }); let t = tb(A);
  assert.equal(A.balanced, true); near(t['160102'], 100, 'دخل مستودع الفرع'); near(t['2105'], -100, 'مستلم لم يُفوتر'); assert.equal(t['160101'] || 0, 0, 'لم يمر بالرئيسي');
  const inv = { id: 'inv_grnB', supplierId: 's1', supplierName: 'مورد', amount: 115, vatAmt: 15, taxable: true, date: '2026-03-02', paidAmount: 0, branchId: 'b1', whId: 'wh-b1', grnRefs: ['grnB'], poNet: 100,
    lines: [{ itemId: 'i1', qty: 20, unitCost: 5, net: 100, poNet: 100, stock: true, grnRef: 'grnB' }] };
  A = E.buildAccounting(org, { stockMoves: [], whMoves: [mv], whTransfers: [], invoices: [inv] }); t = tb(A);
  assert.equal(A.balanced, true); near(t['160102'], 100); assert.ok(Math.abs(t['2105'] || 0) < 0.01, '2105 أُقفل'); assert.equal(t['5504'] || 0, 0, 'بلا فرق سعر');
  near(t['2101'], -115, 'ذمة المورد'); near(t['1501'], 15);
});
test('v44.3 التخزين: طلبات الشراء ونسخة الأوامر واستلامات الفروع في مستند الفرع', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../App.jsx', import.meta.url), 'latin1');
  const br = /const BR_COLS = \[([\s\S]*?)\];/.exec(src)[1];
  ['purchaseReqs', 'poInbox', 'poReceipts'].forEach(c => assert.ok(br.includes("'" + c + "'"), c));
});

// ===== v44.5 — التحضير اليومي بالباركود =====
test('v44.5 حالة دفعة التحضير: صالح ثم «قارب الانتهاء» عند ربع المدة ثم منتهٍ؛ والمستخدم/المتلف ثابتان', () => {
  const b = { status: 'shelf', madeAt: '2026-11-16T08:00:00Z', expAt: '2026-11-17T08:00:00Z' };   // 24 ساعة
  const at = (iso) => E.prepBatchState(b, Date.parse(iso)).st;
  assert.equal(at('2026-11-16T09:00:00Z'), 'ok');
  assert.equal(at('2026-11-17T01:59:00Z'), 'ok', 'أكثر من ربع المدة');
  assert.equal(at('2026-11-17T02:00:00Z'), 'near', 'ست ساعات = ربع المدة');
  assert.equal(at('2026-11-17T08:00:00Z'), 'expired');
  assert.equal(E.prepBatchState({ ...b, status: 'used' }, Date.parse('2026-11-18T00:00:00Z')).st, 'used');
  assert.equal(E.prepBatchState({ ...b, status: 'discarded' }).st, 'discarded');
  assert.equal(E.prepShelfH({ preps: [{ id: 'p1', shelfH: 72 }] }, 'p1'), 72);
  assert.equal(E.prepShelfH({ preps: [{ id: 'p1' }] }, 'p1'), 0, 'بلا مدة');
});
test('v44.5 التخزين والدليل: الدفعات في مستند الفرع، والفرع يرى اسم التحضيرة ومدتها فقط (بلا مكوّنات)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../App.jsx', import.meta.url), 'latin1');
  assert.ok(/const BR_COLS = \[[\s\S]*?'prepBatches'[\s\S]*?\];/.test(src));
  const dir = Buffer.from(/function dirOf\(org\) \{[\s\S]*?\n\}/.exec(src)[0], 'latin1').toString('utf8');
  const line = dir.split('\n').find(l => l.includes('preps: (org.preps'));
  assert.ok(line && line.includes('shelfH') && !line.includes('parts') && !line.includes('cost'), line);
});

// ===== v44.7 — عرض ورق الإيصال 58/80 مم =====
test('v44.7 عرض ورق الإيصال: 80 مم افتراضيًا، و58 مم من إعداد نقطة البيع — للفاتورة المبسّطة وتقرير الوردية', () => {
  const o = { no: 'S-1', at: '2026-11-16T10:00:00Z', lines: [{ name: 'شاورما', qty: 1, price: 15, total: 15 }], total: 15, vat: 1.96, payments: [{ m: 'cash', amount: 15 }] };
  const br = { id: 'b1', name: 'ف1' };
  assert.equal(E.posPaper({}), '80'); assert.equal(E.posPaper({ posCfg: { paper: '58' } }), '58'); assert.equal(E.posPaper({ posCfg: { paper: 'x' } }), '80');
  const h80 = E.posReceiptHtml({ company: { name: 'م' } }, o, br), h58 = E.posReceiptHtml({ company: { name: 'م' }, posCfg: { paper: '58' } }, o, br);
  assert.match(h80, /size:80mm auto/); assert.match(h80, /width:74mm/); assert.doesNotMatch(h80, /58mm/);
  assert.match(h58, /size:58mm auto/); assert.match(h58, /width:54mm/); assert.doesNotMatch(h58, /80mm/);
  const z = E.posShiftHtml({ company: { name: 'م' }, posCfg: { paper: '58' } }, { openingCash: 0 }, [o], br, 'X');
  assert.match(z, /size:58mm auto/); assert.doesNotMatch(z, /80mm/);
});

// ===== v45.2 — قراءة المسح بأي صيغة =====
test('v45.2 تطبيع المسح: الأرقام العربية والفارسية ⇒ إنجليزية، وحروف تخطيط لوحة المفاتيح العربية ⇒ الرمز الأصلي، والكتابة الإنجليزية كما هي', () => {
  assert.equal(E.normDigits('٦٢٨١٠٠٠١٢٣٤٥٦'), '6281000123456');
  assert.equal(E.normDigits('۶۲۸۱'), '6281');
  assert.equal(E.normDigits('١٢٫٥'), '12.5');
  assert.equal(E.normScan('٦٢٨١٠٠٠١٢٣٤٥٦'), '6281000123456');
  // «PMB7Q2K4XZ» مكتوبًا على لوحة مفاتيح عربية (Shift للأحرف الكبيرة) وبدونها
  assert.equal(E.normScan('؛\'لآ7َ2،4ْ~'), 'PMB7Q2K4XZ');
  assert.equal(E.normScan('حةلا7ض2ن4ءئ'), 'PMB7Q2K4XZ');
  assert.equal(E.normScan('حةلا٧ض٢ن٤ءئ'), 'PMB7Q2K4XZ', 'حروف وأرقام عربية معًا');
  assert.equal(E.normScan(' pmb7q2k4xz '), 'PMB7Q2K4XZ');
  assert.equal(E.normScan('PMB7Q2K4XZ'), 'PMB7Q2K4XZ');
});

// ===== v45.3 — تقرير هدر التحضير =====
test('v45.3 هدر التحضير: المحضَّر بتاريخ الإنتاج والمتلَف بتاريخ الإتلاف، النسبة والسبب والقيمة بتكلفة الوصفة، وتصفية الفروع', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'ثوم', unit: 'كجم', type: 'stock', cost: 10 }],
    preps: [{ id: 'p1', name: 'صلصة ثوم', unit: 'كجم', batch: 2, parts: [{ itemId: 'i1', qty: 1 }], shelfH: 24 }, { id: 'p2', name: 'تتبيلة', unit: 'كجم', shelfH: 48 }] });
  const B = (id, br, prep, qty, made, extra) => ({ id, code: id, branchId: br, prepId: prep, name: prep === 'p1' ? 'صلصة ثوم' : 'تتبيلة', unit: 'كجم', qty, madeAt: made, expAt: made, status: 'shelf', ...(extra || {}) });
  const ops = { prepBatches: [
    B('a', 'b1', 'p1', 4, '2026-11-10T09:00:00Z'), B('b', 'b1', 'p1', 2, '2026-11-11T09:00:00Z', { status: 'discarded', discardAt: '2026-11-12T09:00:00Z', reason: 'expired' }),
    B('c', 'b2', 'p1', 4, '2026-11-11T09:00:00Z', { status: 'discarded', discardAt: '2026-11-12T10:00:00Z', reason: 'storage' }),
    B('d', 'b1', 'p2', 5, '2026-11-11T09:00:00Z', { status: 'discarded', discardAt: '2026-11-12T11:00:00Z', reason: 'expired' }),
    B('e', 'b1', 'p1', 9, '2026-10-30T09:00:00Z', { status: 'discarded', discardAt: '2026-11-01T09:00:00Z', reason: 'prep' })] };
  const avg = { i1: 10 };   // تكلفة صلصة الثوم = 10 ÷ 2 = 5 للكيلو
  const S = E.prepWasteStats(org, ops, { from: '2026-11-05', to: '2026-11-30', avg });
  const r1 = S.rows.find(r => r.prepId === 'p1'), r2 = S.rows.find(r => r.prepId === 'p2');
  assert.deepEqual([r1.made, r1.waste, r1.wasteN, r1.pct, r1.value, r1.topReason], [10, 6, 2, 60, 30, 'storage']);
  assert.deepEqual([r2.made, r2.waste, r2.pct, r2.value], [5, 5, 100, 0], 'بلا وصفة ⇒ بلا قيمة');
  assert.equal(S.hasValue, true); assert.equal(S.totals.value, 30); assert.equal(S.totals.wasteN, 3, 'إتلاف 1/11 خارج الفترة');
  assert.deepEqual(S.byReason.map(z => [z.reason, z.n]), [['expired', 2], ['storage', 1]]);
  const b1 = E.prepWasteStats(org, ops, { from: '2026-11-05', to: '2026-11-30', avg, branchIds: ['b1'] });
  assert.deepEqual(b1.byBranch.map(b => [b.branchId, b.wasteN]), [['b1', 2]]);
  assert.equal(E.prepWasteStats({ preps: [{ id: 'p1', name: 'صلصة ثوم', unit: 'كجم', shelfH: 24 }] }, ops, { from: '2026-11-05', to: '2026-11-30' }).hasValue, false, 'الفرع بلا تكاليف');
});

test('v45.4 صورة المنتج تصل أجهزة الفروع مع المنتج في الدليل (بلا الوصفة)', async () => {
  const src = Buffer.from((await import('node:fs')).readFileSync(new URL('../App.jsx', import.meta.url))).toString('utf8');
  const line = /function dirOf\(org\) \{[\s\S]*?\n\}/.exec(src)[0].split('\n').find(l => l.includes('products: (org.products'));
  assert.ok(line.includes('img: p.img') && !line.includes('parts'), line);
});

// ===== v45.5 — صورة المنتج بلا خلفية ولا ضوضاء =====
test('v45.5 إزالة الخلفية: لون الإطار يُزال بالتعبئة من الحواف، والبقع الصغيرة تُحذف، والمنتج يبقى بإطاره', () => {
  const w = 60, h = 40, px = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, c) => { const i = (y * w + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, [235 + ((x * 7 + y * 3) % 9), 233, 230]);   // خلفية فاتحة مع ضوضاء خفيفة
  for (let y = 10; y < 30; y++) for (let x = 20; x < 45; x++) set(x, y, [150, 60, 20]);   // المنتج
  set(5, 5, [20, 20, 20]); set(6, 5, [20, 20, 20]);   // بقعة ضوضاء صغيرة
  const R = E.cutoutPixels(px, w, h);
  const a = (x, y) => R.data[(y * w + x) * 4 + 3];
  assert.equal(a(0, 0), 0); assert.equal(a(59, 39), 0); assert.equal(a(10, 20), 0, 'الخلفية شفافة');
  assert.equal(a(5, 5), 0, 'البقعة الصغيرة أُزيلت');
  assert.equal(a(30, 20), 255, 'المنتج باقٍ');
  assert.deepEqual(R.box, { x: 20, y: 10, w: 25, h: 20 });
  assert.ok(Math.abs(R.fgRatio - 500 / 2400) < 0.001);
});

test('v46.3 خصم المبيعات من المخزون: مع كل فاتورة حركة يومية لكل صنف من مستودع الفرع (بالفاقد)، والتحضيرة المخزّنة يُخصم رصيدها، والإلغاء يُعيد الكمية، وقيد تكلفة المبيعات 5505', () => {
  const org = baseOrg({
    items: [{ id: 'i1', name: 'لحم', unit: 'كيلو', type: 'stock' }, { id: 'i2', name: 'ملح', unit: 'جرام', type: 'stock' }, { id: 'bag', name: 'كيس', unit: 'حبة', type: 'consumable' }, { id: 'pp_sauce', name: 'صلصة', unit: 'كيلو', type: 'stock', prepId: 'sauce' }],
    preps: [{ id: 'sauce', name: 'صلصة', unit: 'كيلو', batch: 5, stocked: true, parts: [{ itemId: 'i2', qty: 100 }] }, { id: 'rub', name: 'تتبيلة', unit: 'كيلو', batch: 1, parts: [{ itemId: 'i2', qty: 50 }] }],
    products: [{ id: 'p1', name: 'مندي', sellPrice: 60, parts: [{ itemId: 'i1', qty: 0.4, yield: 80 }, { prepId: 'sauce', qty: 0.1 }, { prepId: 'rub', qty: 0.2 }, { itemId: 'bag', qty: 1 }] }],
    purchaseCfg: { perpetualFrom: '2026-01', saleDeductFrom: '2026-03-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'العليا', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102' }] });
  const o = (id, qty, st, date) => ({ id, branchId: 'b1', date: date || '2026-03-05', status: st || 'paid', total: qty * 60, lines: [{ productId: 'p1', qty }] });
  const base = { whMoves: [{ id: 'in1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 10, unitCost: 40, date: '2026-03-01', at: '2026-03-01T08:00:00Z' }], posOrders: [], stockMoves: [], whTransfers: [] };
  let next = E.syncSaleMoves(org, base, { ...base, posOrders: [o('a', 2), o('b', 1)] });
  const sl = (ops) => Object.fromEntries((ops.whMoves || []).filter(m => m.kind === 'sale').map(m => [m.itemId, m.qty]));
  assert.deepEqual(sl(next), { i1: -1.5, pp_sauce: -0.3, i2: -30 }, 'لحم 3×0.5 بالفاقد · صلصة مخزّنة 0.3 · ملح التتبيلة 3×0.2×50 · الكيس الاستهلاكي لا يُخصم');
  assert.ok(next.whMoves.every(m => m.kind !== 'sale' || (m.whId === 'wh-b1' && m.branchId === 'b1' && m.date === '2026-03-05')));
  // إلغاء فاتورة ⇒ تُعاد الكمية (إعادة حساب لا تكرار)
  const after = E.syncSaleMoves(org, next, { ...next, posOrders: [o('a', 2), o('b', 1, 'void')] });
  assert.deepEqual(sl(after), { i1: -1, pp_sauce: -0.2, i2: -20 });
  assert.equal(after.whMoves.filter(m => m.kind === 'sale').length, 3, 'حركة واحدة لكل صنف ويوم');
  assert.equal(E.stockByWh(org, after).byWh['wh-b1'].i1, 9, 'الرصيد = 10 − 1');
  // قبل تاريخ البدء لا خصم · وحفظ لا يمس الفواتير لا يغيّر شيئًا
  assert.deepEqual(sl(E.syncSaleMoves(org, base, { ...base, posOrders: [o('c', 4, 'paid', '2026-02-20')] })), {});
  assert.strictEqual(E.syncSaleMoves(org, after, after), after);
  // القيد: تكلفة المبيعات 1 كجم × 40
  const A = E.buildAccounting(org, after); const t = tb(A);
  assert.equal(A.balanced, true); near(t['5505'], 40 + 0, 'تكلفة المبيعات للحم (الصلصة والملح بلا تكلفة شراء هنا)');
  // المواد الداخلة في الوصفات (لمنع صرفها يدويًا)
  assert.deepEqual([...E.saleRecipeItems(org)].sort(), ['bag', 'i1', 'i2', 'pp_sauce'].sort());
});

test('v46.5 ترقيم السندات المخزنية: الحركات المحفوظة معًا من نوع ومستودع واحد سند واحد، وتسلسل لكل مستودع ونوع، والقديم والتلقائي بلا رقم', () => {
  const org = baseOrg({ warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main' }, { id: 'wh-b1', name: 'العليا', kind: 'branch', branchId: 'b1' }], items: [{ id: 'i1', name: 'لحم', unit: 'كيلو' }, { id: 'i2', name: 'أرز', unit: 'كيلو' }] });
  const before = { stockMoves: [{ id: 'old', itemId: 'i1', kind: 'in', qty: 5, date: '2026-03-01' }], whMoves: [] };
  const m = (id, kind, qty, x) => ({ id, itemId: 'i1', kind, qty, date: '2026-03-02', ...x });
  let next = E.assignVouchers(org, before, { ...before, stockMoves: [m('a', 'in', 10, { whId: 'wh-main' }), m('b', 'in', 4, { whId: 'wh-main', itemId: 'i2' }), m('c', 'out', -2, { whId: 'wh-main' }), ...before.stockMoves],
    whMoves: [m('d', 'waste', -1, { whId: 'wh-b1', branchId: 'b1' }), m('s', 'sale', -3, { whId: 'wh-b1', branchId: 'b1', auto: true })] });
  const v = (col, id) => next[col].find(x => x.id === id).vno;
  assert.equal(v('stockMoves', 'a'), 'RCV-M-00001'); assert.equal(v('stockMoves', 'b'), 'RCV-M-00001', 'سند واحد متعدد البنود');
  assert.equal(v('stockMoves', 'c'), 'ISS-M-00001'); assert.equal(v('stockMoves', 'old'), undefined, 'القديم لا يُرقَّم');
  assert.equal(v('whMoves', 'd'), 'WST-W2-00001'); assert.equal(v('whMoves', 's'), undefined, 'خصم المبيعات التلقائي بلا سند');
  const n2 = E.assignVouchers(org, next, { ...next, stockMoves: [m('e', 'in', 1, { whId: 'wh-main', opening: true }), m('f', 'in', 2, { whId: 'wh-main' }), ...next.stockMoves] });
  assert.equal(n2.stockMoves.find(x => x.id === 'f').vno, 'RCV-M-00002', 'التسلسل يستمر'); assert.equal(n2.stockMoves.find(x => x.id === 'e').vno, 'OPN-M-00001');
  assert.strictEqual(E.assignVouchers(org, n2, n2), n2, 'حفظ بلا حركات جديدة لا يغيّر شيئًا');
  const L = E.voucherList(org, n2, {}); const r1 = L.find(x => x.no === 'RCV-M-00001');
  assert.equal(r1.type, 'rcv'); assert.equal(r1.lines.length, 2);
});

test('v46.6 سندات القبض والصرف والمقاصّة: التوزيع على الفواتير يُقيَّد مع الفاتورة والباقي على الحساب، والحساب من الدليل، وسلفة الموظف تُستقطع، والمقاصّة بين ذمم العميل والمورد — والميزان متوازن', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, suppliers: [{ id: 's1', name: 'مؤسسة التموين', linkKey: 'cust:c1' }], partners: [{ id: 'c1', key: 'cust:c1', name: 'مؤسسة التموين', type: 'customer', linkKey: 'sup:s1' }],
    employees: [{ id: 'e1', name: 'أحمد', branchId: 'b1' }] });
  const me = { name: 'المحاسب' };
  let ops = { invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'مؤسسة التموين', amount: 1000, date: '2026-03-01', invoiceNo: 'S-1', paidAmount: 0 }],
    salesInvoices: [{ id: 'x1', no: 'INV-1', kind: 'invoice', terms: 'credit', customerKey: 'cust:c1', buyer: { name: 'مؤسسة التموين' }, date: '2026-03-02', net: 600, vat: 0, total: 600, receipts: [] }], cashVouchers: [], advances: [] };
  assert.deepEqual(E.partyOpenDocs(org, ops, { t: 'sup', key: 'sup:s1' }).map(x => x.rem), [1000]);
  // صرف 1200 للمورد: 1000 على الفاتورة + 200 على الحساب
  const pv = { id: 'v1', no: E.cvNextNo(ops, 'pv'), kind: 'pv', date: '2026-03-05', amount: 1200, fund: '1201', pm: 'bank', party: { t: 'sup', key: 'sup:s1', name: 'مؤسسة التموين' }, alloc: [{ id: 'i1', no: 'S-1', amount: 1000 }], at: 't' };
  assert.equal(pv.no, 'PV-000001');
  ops = E.applyCashVoucher(ops, pv, me);
  assert.equal(E.partyOpenDocs(org, ops, { t: 'sup', key: 'sup:s1' }).length, 0, 'الفاتورة سُدّدت');
  // قبض 400 من العميل على فاتورته
  ops = E.applyCashVoucher(ops, { id: 'v2', no: 'RV-000001', kind: 'rv', date: '2026-03-06', amount: 400, fund: '1101', pm: 'cash', party: { t: 'cust', key: 'cust:c1', name: 'مؤسسة التموين' }, alloc: [{ id: 'x1', amount: 400 }], at: 't' }, me);
  assert.deepEqual(E.partyOpenDocs(org, ops, { t: 'cust', key: 'cust:c1' }).map(x => x.rem), [200]);
  // صرف مصروف من الدليل · سلفة موظف · مقاصّة 150
  ops = E.applyCashVoucher(ops, { id: 'v3', no: 'PV-000002', kind: 'pv', date: '2026-03-07', amount: 90, fund: '1101', party: { t: 'acc', acc: '5301', name: 'صيانة' }, at: 't' }, me);
  ops = E.applyCashVoucher(ops, { id: 'v4', no: 'PV-000003', kind: 'pv', date: '2026-03-07', amount: 500, fund: '1101', empPurpose: 'advance', party: { t: 'emp', key: 'emp:e1', name: 'أحمد' }, at: 't' }, me);
  ops = E.applyCashVoucher(ops, { id: 'v5', no: 'OV-000001', kind: 'ov', date: '2026-03-08', amount: 150, supKey: 'sup:s1', custKey: 'cust:c1', supName: 'مؤسسة التموين', custName: 'مؤسسة التموين', at: 't' }, me);
  assert.equal(ops.advances.length, 1, 'السلفة سُجّلت لتُستقطع من الراتب');
  const A = E.buildAccounting(org, ops); const t = tb(A);
  assert.equal(A.balanced, true);
  near(t['2101'], -1000 + 1200 + 150, 'المورد: فاتورة 1000 − سداد 1200 − مقاصّة 150 ⇒ مدين 350');
  near(t['1380'], 600 - 400 - 150, 'العميل: 600 − تحصيل 400 − مقاصّة 150 = 50');
  near(t['1401'], 500, 'سلفة الموظف مرة واحدة'); near(t['1101'], 400 - 90 - 500, 'الخزينة');
  const P = E.buildPartners(org, ops); const sup = P.find(x => x.key === 'sup:s1');
  assert.ok(sup.txns.some(x => /على الحساب/.test(x.desc) && x.debit === 200)); assert.ok(sup.txns.some(x => /مقاصّة/.test(x.desc) && x.debit === 150));
  assert.equal(sup.linkKey, 'cust:c1');
});

test('v46.7 نفاد المواد مع خصم المبيعات: مادة وصفة بالسالب أو صفر في مستودع الفرع تنبيه عالٍ، وصنف تحت حده الأدنى تنبيه متوسط', () => {
  const td = new Date().toISOString().slice(0, 10);
  const org = baseOrg({ items: [{ id: 'i1', name: 'لحم', unit: 'كيلو', type: 'stock' }, { id: 'i2', name: 'أرز', unit: 'كيلو', type: 'stock', minQty: 10 }, { id: 'i3', name: 'زيت', unit: 'لتر', type: 'stock' }],
    products: [{ id: 'p1', name: 'مندي', parts: [{ itemId: 'i1', qty: 0.5 }, { itemId: 'i3', qty: 0.1 }] }], purchaseCfg: { perpetualFrom: td.slice(0, 7), saleDeductFrom: td },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main' }, { id: 'wh-b1', name: 'العليا', kind: 'branch', branchId: 'b1' }] });
  const ops = { whMoves: [{ id: 'a', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'in', qty: 2, date: td }, { id: 'b', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'sale', qty: -3, date: td, auto: true },
    { id: 'c', whId: 'wh-b1', branchId: 'b1', itemId: 'i2', kind: 'in', qty: 5, date: td }, { id: 'd', whId: 'wh-b1', branchId: 'b1', itemId: 'i3', kind: 'in', qty: 4, date: td }], stockMoves: [], whTransfers: [] };
  const S = E.stockShortages(org, ops);
  assert.deepEqual(S.map(x => [x.wh, x.itemId, x.qty, x.st]), [['wh-b1', 'i1', -1, 'neg'], ['wh-b1', 'i2', 5, 'low']]);
  const A = E.computeSmartAlerts(org, ops, org.branches);
  assert.ok(A.some(a => a.sev === 'high' && /نفاد مواد في العليا — 1 صنف/.test(a.title) && /البيع مستمر/.test(a.msg)));
  assert.ok(A.some(a => a.sev === 'medium' && /تحت الحد الأدنى في العليا/.test(a.title)));
  // بلا خصم المبيعات: لا تنبيه نفاد للوصفات (الحد الأدنى يبقى)
  const S2 = E.stockShortages({ ...org, purchaseCfg: {} }, ops); assert.deepEqual(S2.map(x => x.st), ['low']);
});

test('v46.8 مرتجع نقطة البيع — القيمة: خصم الفاتورة يُوزَّع على البنود فلا يُرد أكثر من المدفوع، والضريبة بنسبة الفاتورة', () => {
  // بندان: 2×23 + 1×11.5 = 57.5 ثم خصم فاتورة 5.75 ⇒ 51.75 (ضريبتها 6.75)
  const o = { id: 'o1', no: 'ف1-1', total: 51.75, vat: 6.75, lines: [{ productId: 'p1', name: 'مندي', qty: 2, price: 23 }, { productId: 'p2', name: 'شاي', qty: 1, price: 11.5 }], payments: [{ m: 'card', amount: 51.75 }] };
  const C = E.posReturnCalc(o, { 0: 1 });
  near(C.total, 20.7, '23 × (51.75 ÷ 57.5)'); near(C.vat, 2.7); near(C.net, 18);
  near(E.posReturnCalc(o, { 0: 2, 1: 1 }).total, 51.75, 'المرتجع الكامل = المدفوع بالضبط');
  near(E.posReturnCalc(o, { 0: 5 }).total, 41.4, 'لا تتجاوز الكمية المباعة');
  assert.deepEqual(E.posRefundOptions(o).map(x => x.k), ['card', 'cash'], 'طريقة الدفع الأصلية أولًا ثم النقد');
  assert.deepEqual(E.posReturnable({ posOrders: [o, { id: 'r1', kind: 'return', refId: 'o1', status: 'paid', retLines: [{ i: 0, qty: 1 }] }] }, o), [1, 1], 'المتبقي بعد مرتجع سابق');
});

test('v46.8 مرتجع نقطة البيع — ملخص اليوم والإغلاق: الإيراد والضريبة والنقد تنخفض، والمرتجع لا يُعد فاتورة', () => {
  const sale = { id: 'o1', branchId: 'b1', date: '2026-03-05', status: 'paid', total: 51.75, vat: 6.75, payments: [{ m: 'cash', amount: 60 }], change: 8.25, lines: [{ productId: 'p1', qty: 2, price: 23 }] };
  const ret = { id: 'r1', kind: 'return', refId: 'o1', branchId: 'b1', date: '2026-03-05', status: 'paid', total: -20.7, vat: -2.7, payments: [{ m: 'cash', amount: -20.7 }], change: 0, lines: [], retLines: [{ i: 0, productId: 'p1', qty: 1, amount: 20.7 }] };
  const S = E.posDaySummary([sale, ret], 'b1', '2026-03-05');
  assert.equal(S.n, 1, 'عدد الفواتير'); assert.equal(S.retN, 1); near(S.retAmt, 20.7);
  near(S.total, 31.05); near(S.vat, 4.05); near(S.cash, 31.05, '51.75 نقدًا − 20.70 مردودة');
});

test('v46.8 مرتجع نقطة البيع — المخزون والدفاتر: الطبق المرتجع هدر؛ الرصيد لا يتغير، وتكلفته تنتقل من تكلفة المبيعات 5505 إلى الهدر 5502', () => {
  const org = baseOrg({
    items: [{ id: 'i1', name: 'لحم', unit: 'كيلو', type: 'stock' }],
    products: [{ id: 'p1', name: 'مندي', sellPrice: 60, parts: [{ itemId: 'i1', qty: 0.5 }] }],
    purchaseCfg: { perpetualFrom: '2026-01', saleDeductFrom: '2026-03-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'العليا', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102' }] });
  const sale = { id: 'o1', no: 'ف1-1', branchId: 'b1', date: '2026-03-05', status: 'paid', total: 120, vat: 15.65, lines: [{ productId: 'p1', qty: 2, price: 60 }], payments: [{ m: 'cash', amount: 120 }] };
  const ret = { id: 'r1', kind: 'return', refId: 'o1', refNo: 'ف1-1', no: 'م1-1', branchId: 'b1', date: '2026-03-06', at: '2026-03-06T10:00:00Z', status: 'paid', total: -60, vat: -7.83, lines: [], retLines: [{ i: 0, productId: 'p1', qty: 1, amount: 60 }], payments: [{ m: 'cash', amount: -60 }], reason: 'prep', by: 'مدير' };
  const base = { whMoves: [{ id: 'in1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 10, unitCost: 40, date: '2026-03-01', at: '2026-03-01T08:00:00Z' }], posOrders: [], stockMoves: [], whTransfers: [] };
  const s1 = E.syncSaleMoves(org, base, { ...base, posOrders: [sale] });
  const s2 = E.syncSaleMoves(org, s1, { ...s1, posOrders: [sale, ret] });
  const mv = (k, d) => s2.whMoves.filter(m => m.kind === k && m.date === d).map(m => m.qty);
  assert.deepEqual(mv('sale', '2026-03-05'), [-1], 'بيع يوم الفاتورة كما هو');
  assert.deepEqual(mv('sale', '2026-03-06'), [0.5], 'يوم المرتجع: عكس استهلاك البيع');
  assert.deepEqual(mv('waste', '2026-03-06'), [-0.5], 'ويقابله هدر بالكمية نفسها');
  const w = s2.whMoves.find(m => m.kind === 'waste'); assert.equal(w.reason, 'prep', 'بسبب المرتجع من قائمة الهدر'); assert.match(w.note, /م1-1/);
  assert.equal(E.stockByWh(org, s2).byWh['wh-b1'].i1, 9, 'الرصيد = 10 − 1 (الطبق المرتجع لا يرجع للمخزون)');
  const A = E.buildAccounting(org, s2); const t = tb(A); assert.equal(A.balanced, true);
  near(t['5505'], 20, 'تكلفة المبيعات: 40 − 20 المعكوسة'); near(t['5502'], 20, 'الهدر: نصف كيلو × 40');
  assert.ok(E.wasteRows(org, s2, { i1: 40 }).some(r => r.reason === 'prep' && r.val === 20), 'يظهر في تقارير الهدر بسببه وقيمته');
  // حفظ المرتجع نفسه مرة ثانية لا يكرر الحركات
  assert.equal(E.syncSaleMoves(org, s1, { ...s2, posOrders: [sale, ret] }).whMoves.filter(m => m.kind === 'waste').length, 1);
});

test('v46.9 مرتجع نقطة البيع — نقاط الولاء تُخصم بنسبة المرتجع، والمرتجع الكامل يخصم كلها، ولا يتجاوز المجموع ما اكتُسب', () => {
  const o = { id: 'o1', total: 100, loyalty: { phone: '0500000000', earned: 10 } };
  assert.equal(E.posReturnLoyDed({ posOrders: [o] }, o, 25), 3, 'يبقى floor(10 × 75/100) = 7 ⇒ يُخصم 3');
  assert.equal(E.posReturnLoyDed({ posOrders: [o] }, o, 100), 10, 'المرتجع الكامل يخصم كل النقاط');
  const r1 = { id: 'r1', kind: 'return', refId: 'o1', status: 'paid', total: -25, loyalty: { ded: 3 } };
  assert.equal(E.posReturnLoyDed({ posOrders: [o, r1] }, o, 75), 7, 'المرتجع الثاني لباقي الفاتورة: 10 − 3 = 7');
  assert.equal(E.posReturnLoyDed({ posOrders: [o, r1] }, o, 10), 1, 'يبقى floor(10 × 65/100) = 6 ⇒ 10 − 6 − 3 = 1');
  assert.equal(E.posReturnLoyDed({ posOrders: [{ id: 'x', total: 50 }] }, { id: 'x', total: 50 }, 50), 0, 'فاتورة بلا عميل ولاء');
});

test('v47.1 اعتماد القيد اليدوي: بانتظار الاعتماد والمرفوض لا يدخلان الدفاتر، والقديم بلا حالة مرحّل؛ يعتمده المحاسب أو المالك ولا يعتمد أحدٌ قيده', () => {
  const ln = [{ code: '5901', debit: 100, credit: 0 }, { code: '1201', debit: 0, credit: 100 }];
  const j = (id, st) => ({ id, date: '2026-03-06', title: 'ت', by: 'منى', byId: 'u7', lines: ln, ...(st ? { status: st } : {}) });
  const A = E.buildAccounting(baseOrg(), { journalManual: [j('old'), j('p', 'pending'), j('r', 'rejected'), j('ok', 'posted')] });
  assert.equal(A.balanced, true);
  assert.deepEqual(A.entries.filter(e => e.manual).map(e => e.id).sort(), ['man:ok', 'man:old'], 'المرحّل والقديم فقط');
  assert.equal(E.jeOwner({ role: 'system_admin' }), true); assert.equal(E.jeOwner({ role: 'general_management' }), true); assert.equal(E.jeOwner({ role: 'accountant' }), false);
  const pend = j('p', 'pending');
  assert.equal(E.canApproveJe({ id: 'u1', name: 'مجاهد', role: 'system_admin' }, pend), true, 'المالك يعتمد');
  assert.equal(E.canApproveJe({ id: 'u8', name: 'فهد', role: 'finance_department' }, pend), true, 'المحاسب الرئيسي يعتمد');
  assert.equal(E.canApproveJe({ id: 'u6', name: 'هند', role: 'accountant' }, pend), true, 'محاسب آخر يعتمد');
  assert.equal(E.canApproveJe({ id: 'u7', name: 'منى', role: 'accountant' }, pend), false, 'لا يعتمد قيده بنفسه');
  assert.equal(E.canApproveJe({ id: 'u5', name: 'سارة', role: 'head_office' }, pend), false, 'المكتب الرئيسي لا يعتمد');
  assert.equal(E.canApproveJe({ id: 'u9', name: 'ريم', role: 'cost_controller' }, pend), false);
});

test('v47.2 الرواتب برقم فعلي: الإجمالي والاستقطاعات والتأمينات والصافي لموظف سعودي (نظام قديم) مع سلفة ومكافأة وإضافي وجزاء', () => {
  const org = { gosiCfg: { enabled: true } };
  const e = { id: 'e1', name: 'سعد', nationality: 'saudi', hireDate: '2020-01-01', gosiSubject: true, baseSalary: 6000, housingAllowance: 1500, transportAllowance: 500 };
  const adv = [{ employeeId: 'e1', month: '2026-10', type: 'advance', amount: 500 }, { employeeId: 'e1', month: '2026-10', type: 'bonus', amount: 300 },
    { employeeId: 'e1', month: '2026-10', type: 'overtime', amount: 450, hours: 10 }, { employeeId: 'e1', month: '2026-10', type: 'deduction', amount: 200 },
    { employeeId: 'e1', month: '2026-09', type: 'advance', amount: 999 }];
  const [r] = E.payrollRowsOf(org, adv, [e], '2026-10');
  near(r.allow, 2000, 'البدلات 1500 + 500'); near(r.gross, 8750, '6000 + 2000 + 300 مكافأة + 450 إضافي'); assert.equal(r.otHours, 10);
  near(r.draws, 500, 'سلفة الشهر فقط (سلفة سبتمبر لا تدخل)'); near(r.cuts, 200, 'الجزاء');
  near(r.gEmp, 731.25, '9.75% × (6000 + 1500)'); near(r.gEr, 881.25, '11.75% × 7500');
  near(r.net, 7318.75, '8750 − 500 − 200 − 731.25');
});

test('v47.2 التأمينات — النظام الجديد (المسجّلون من 3 يوليو 2024): +0.5% لكل طرف كل يوليو حتى 2028، بحسب شهر المسير', () => {
  const s = (m) => [E.gosiNewSched(m).emp, E.gosiNewSched(m).er];
  assert.deepEqual(s('2025-06'), [9.75, 11.75]); assert.deepEqual(s('2025-07'), [10.25, 12.25]);
  assert.deepEqual(s('2026-06'), [10.25, 12.25]); assert.deepEqual(s('2026-07'), [10.75, 12.75]);
  assert.deepEqual(s('2027-07'), [11.25, 13.25]); assert.deepEqual(s('2028-07'), [11.75, 13.75]); assert.deepEqual(s('2031-01'), [11.75, 13.75], 'يثبت بعد 2028');
  const e = { id: 'n', nationality: 'saudi', hireDate: '2025-02-01', gosiSubject: true, baseSalary: 5000, housingAllowance: 1000 };
  const row = (cfg, m) => E.payrollRowsOf({ gosiCfg: cfg }, [], [e], m)[0];
  near(row({ enabled: true }, '2026-03').gEmp, 615, 'مارس 2026: 10.25% × 6000'); near(row({ enabled: true }, '2026-10').gEmp, 645, 'أكتوبر 2026: 10.75% × 6000');
  near(row({ enabled: true }, '2026-10').gEr, 765, '12.75% × 6000');
  near(row({ enabled: true, saudiNewEmp: 10, saudiNewEr: 12 }, '2026-10').gEmp, 600, 'نسب يدوية محفوظة سابقًا تبقى كما هي (توافق رجعي)');
  near(row({ enabled: true, saudiNewEmp: 10, saudiNewEr: 12, newAuto: true }, '2026-10').gEmp, 645, 'اختيار «حسب الجدول» يغلب اليدوي');
  const old = { ...e, hireDate: '2024-07-02' }; near(E.payrollRowsOf({ gosiCfg: { enabled: true } }, [], [old], '2026-10')[0].gEmp, 585, 'قبل 3 يوليو 2024: القديم 9.75%');
  const xp = { ...e, nationality: 'nonSaudi' }; const rx = E.payrollRowsOf({ gosiCfg: { enabled: true } }, [], [xp], '2026-10')[0];
  assert.deepEqual([rx.gEmp, rx.gEr], [0, 120], 'غير السعودي: 0% موظف و2% أخطار مهنية على صاحب العمل');
  near(E.payrollRowsOf({ gosiCfg: { enabled: true } }, [], [{ ...e, baseSalary: 50000 }], '2026-10')[0].gEmp, 4837.5, 'سقف الأجر الخاضع 45,000');
});

test('v47.2 الإضافي (المادة 107): أجر الساعة الفعلي + 50% من الأساسي، والساعات من البصمة بتقريب ربع ساعة للأسفل', () => {
  const e = { id: 'e1', baseSalary: 3600, housingAllowance: 900, transportAllowance: 300 };
  const R = E.otRateOf(e, 8, 'actual');
  near(R.hBasic, 15, '3600 ÷ 30 ÷ 8'); near(R.hActual, 20, '4800 ÷ 30 ÷ 8'); near(R.rate, 27.5, '20 + 0.5 × 15');
  near(E.otRateOf(e, 8, 'basic').rate, 22.5, 'على الأساسي = 1.5 × 15');
  const org = { hrPolicies: { workHoursPerDay: 8, weeklyOffDays: [5] } };
  const ev = (d, t, ty) => ({ employeeId: 'e1', at: d + 'T' + t + ':00', type: ty });
  // الأحد 2026-11-01: 9 ساعات و50 دقيقة ⇒ 1:50 إضافي ⇒ 1.75 · الجمعة 2026-11-06 (راحة): 4:10 ⇒ 4.0 · يوم بلا خروج: مفتوح
  const ops = { attendanceEvents: [ev('2026-11-01', '08:00', 'in'), ev('2026-11-01', '17:50', 'out'), ev('2026-11-06', '10:00', 'in'), ev('2026-11-06', '14:10', 'out'), ev('2026-11-02', '08:00', 'in')] };
  const O = E.otFromAttendance(org, ops, e, '2026-11');
  // الإجمالي يُقرَّب مرة واحدة على مجموع الدقائق (110 + 250 = 360 دقيقة = 6 ساعات)، والتفصيل يطابقه (v47.4): راحة 4 + عمل 2
  assert.deepEqual([O.regH, O.offH, O.hours, O.days, O.open], [2, 4, 6, 2, 1]); assert.equal(O.regH + O.offH, O.hours, 'التفصيل = الإجمالي');
  near(O.hours * R.rate, 165, 'مبلغ الإضافي = 6 × 27.5');
});

test('v47.3 سند التحويل: من الخزينة إلى بنك الفرع — قيد متوازن بلا أثر على الإيراد أو المصروف', () => {
  const org = baseOrg();
  const ops = { cashVouchers: [{ id: 't1', kind: 'tv', no: 'TV-0001', date: '2026-11-10', amount: 2500, fund: '1101', toFund: '1201', note: 'إيداع نقدية' }] };
  const A = E.buildAccounting(org, ops); const t = tb(A);
  near(t['1201'], 2500, 'البنك مدين'); near(t['1101'], -2500, 'الخزينة دائنة');
  assert.ok(A.balanced); assert.equal(A.entries.filter(e => e.id === 'cv:t1').length, 1);
  assert.equal(A.entries.find(e => e.id === 'cv:t1').src, 'سند تحويل');
  // حساب واحد للطرفين أو حساب غير معروف: لا قيد
  const bad = E.buildAccounting(org, { cashVouchers: [{ id: 't2', kind: 'tv', no: 'TV-0002', date: '2026-11-10', amount: 100, fund: '1101', toFund: '1101' }, { id: 't3', kind: 'tv', no: 'TV-0003', date: '2026-11-10', amount: 100, fund: '9999', toFund: '1201' }] });
  assert.equal(bad.entries.filter(e => String(e.id).startsWith('cv:')).length, 0);
  assert.equal(E.CV_KIND.tv.p, 'TV'); assert.equal(E.cvNextNo(ops, 'tv'), 'TV-000002');
});

test('v47.3 الإشعار المدين: يرفع الإيراد وضريبة المخرجات والذمة، ويُحصَّل كأي مستند آجل', () => {
  const org = baseOrg();
  let list = [];
  const inv = E.siStamp(list, { id: 'i1', kind: 'invoice', type: 'standard', date: '2026-11-01', customerKey: 'c:1', buyer: { name: 'عميل', vat: '300000000000003' }, lines: [{ desc: 'وجبات', qty: 10, price: 100, vatRate: 15, net: 1000, vat: 150 }], net: 1000, vat: 150, total: 1150, terms: 'credit', dueDate: '2026-12-01', receipts: [] });
  list = [inv];
  const dn = E.siStamp(list, { id: 'd1', kind: 'debit', refId: 'i1', type: 'standard', date: '2026-11-05', customerKey: 'c:1', buyer: inv.buyer, lines: [{ desc: 'رسوم توصيل', qty: 1, price: 200, vatRate: 15, net: 200, vat: 30 }], net: 200, vat: 30, total: 230, terms: 'credit', dueDate: '2026-12-05', reason: 'رسوم توصيل', receipts: [{ id: 'r1', date: '2026-11-08', amount: 100, fund: '1201' }] });
  list = [inv, dn];
  assert.ok(/^إشعار مدين-2026-00001$/.test(dn.no), dn.no); assert.equal(dn.icv, 2); assert.equal(E.siVerify(list).ok, true, 'السلسلة متصلة');
  const A = E.buildAccounting(org, { salesInvoices: list }); const t = tb(A);
  near(t['4102'], -1200, 'الإيراد 1000 + 200'); near(t['2301'], -180, 'الضريبة 150 + 30'); near(t['1380'], 1280, '1150 + 230 − 100 تحصيل'); near(t['1201'], 100);
  assert.ok(A.balanced);
  near(E.siRem({ salesInvoices: list }, dn), 130, 'المتبقي على الإشعار المدين');
  const e = A.entries.find(x => x.id === 'si:d1'); assert.equal(e.reg.doc, 'إشعار مدين مبيعات'); near(e.reg.gross, 230);
  // الإشعار المدين النقدي يذهب للصندوق
  const cash = E.buildAccounting(org, { salesInvoices: [inv, { ...dn, id: 'd2', terms: 'cash', fund: '1101', receipts: [] }] });
  near(tb(cash)['1101'], 230);
});

test('v47.3 FEFO: الصرف يقترح الدفعات الأقرب انتهاءً وينبّه للمنتهية', () => {
  const lots = [{ id: 'a', whId: 'w', itemId: 'x', batch: 'B2', expiry: '2026-12-20', left: 5 }, { id: 'b', whId: 'w', itemId: 'x', batch: 'B1', expiry: '2026-11-10', left: 3 }, { id: 'c', whId: 'w2', itemId: 'x', batch: 'Z', expiry: '2026-01-01', left: 9 }];
  const mine = E.lotsFor(lots, 'w', 'x'); assert.deepEqual(mine.map(l => l.batch), ['B1', 'B2'], 'مستودع واحد مرتبًا بالانتهاء');
  const P = E.fefoPick(mine, 6, '2026-11-01');
  assert.deepEqual(P.picks.map(p => [p.batch, p.qty]), [['B1', 3], ['B2', 3]]); assert.equal(P.undated, 0); assert.equal(P.expiredLots, 0);
  const Q = E.fefoPick(mine, 10, '2026-11-15');
  assert.equal(Q.expiredLots, 1); near(Q.expiredPicked, 3, 'B1 منتهية'); near(Q.undated, 2, 'الزائد من رصيد بلا تاريخ');
  // expiryLots: الرصيد الحالي على الدفعات الأحدث، والصادر يستهلك الأقدم
  const org = { items: [{ id: 'x', name: 'حليب', unit: 'ل', stock: true }] };
  const ops = { whMoves: [{ id: 'm1', whId: 'w', itemId: 'x', kind: 'purchase', qty: 4, expiry: '2026-11-10', batch: 'B1', date: '2026-10-01' }, { id: 'm2', whId: 'w', itemId: 'x', kind: 'purchase', qty: 6, expiry: '2026-12-20', batch: 'B2', date: '2026-10-05' }, { id: 'm3', whId: 'w', itemId: 'x', kind: 'out', qty: -3, date: '2026-10-06' }] };
  const L = E.lotsFor(E.expiryLots(org, ops), 'w', 'x');
  assert.deepEqual(L.map(l => [l.batch, l.left]), [['B1', 1], ['B2', 6]]);
});

test('v47.4 الإشعار المدين للمشتريات: نُصدره للمورد يخفض الذمة والتكلفة وضريبة المدخلات؛ وإشعار المورد (زيادة) يرفعها', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'المورد', vatNo: '300000000000003' }] });
  const inv = { id: 'p1', supplierId: 's1', supplierName: 'المورد', invoiceNo: 'S-1', date: '2026-11-01', amount: 1150, vatAmt: 150, accCode: '5198', paidAmount: 0 };
  const dn = { id: 'p2', creditNote: true, debitNote: true, appliesTo: 'p1', supplierId: 's1', supplierName: 'المورد', invoiceNo: 'PDN-1', date: '2026-11-05', amount: -230, vatAmt: -30, accCode: '5198', reason: 'فرق سعر' };
  const inc = { id: 'p3', supDebit: true, appliesTo: 'p1', supplierId: 's1', supplierName: 'المورد', invoiceNo: 'SDN-1', date: '2026-11-06', amount: 115, vatAmt: 15, accCode: '5198', reason: 'رسوم نقل' };
  const A = E.buildAccounting(org, { invoices: [inv, dn, inc] }); const t = tb(A);
  near(t['2101'], -(1150 - 230 + 115), 'ذمة المورد'); near(t['1501'], 150 - 30 + 15, 'ضريبة المدخلات'); near(t['5198'], 1000 - 200 + 100, 'التكلفة');
  assert.ok(A.balanced);
  assert.equal(A.entries.find(e => e.id === 'inv:p2').reg.doc, 'إشعار مدين للمورد'); near(A.entries.find(e => e.id === 'inv:p2').vat.inn, -30);
  assert.equal(A.entries.find(e => e.id === 'inv:p3').reg.doc, 'إشعار مدين من المورد');
  // خصم مكتسب: الحساب 4202 والضريبة تُعكس
  const disc = { ...dn, id: 'p4', accCode: '4202', disc: true, amount: -57.5, vatAmt: -7.5 };
  const B = E.buildAccounting(org, { invoices: [inv, disc] }); const u = tb(B);
  near(u['4202'], -50, 'خصم مكتسب دائن'); near(u['1501'], 142.5); near(u['2101'], -1092.5); assert.ok(B.balanced);
});

test('v47.4 الخصم الممنوح بعد الفاتورة: إشعار دائن إلى «خصم مسموح به» 4103 ويخفض ضريبة المخرجات', () => {
  const org = baseOrg();
  const inv = E.siStamp([], { id: 'i1', kind: 'invoice', type: 'simplified', date: '2026-11-01', customerKey: 'c:1', buyer: { name: 'عميل' }, lines: [{ desc: 'وجبات', qty: 1, price: 1000, vatRate: 15, net: 1000, vat: 150 }], net: 1000, vat: 150, total: 1150, terms: 'credit', receipts: [{ id: 'r1', date: '2026-11-10', amount: 1092.5, fund: '1201' }] });
  const cn = E.siStamp([inv], { id: 'c1', kind: 'credit', disc: true, refId: 'i1', type: 'simplified', date: '2026-11-10', customerKey: 'c:1', buyer: inv.buyer, lines: [{ desc: 'خصم تعجيل سداد', qty: 1, price: 50, vatRate: 15, net: 50, vat: 7.5 }], net: 50, vat: 7.5, total: 57.5, terms: 'credit', reason: 'خصم تعجيل سداد', receipts: [] });
  const list = [inv, cn]; const A = E.buildAccounting(org, { salesInvoices: list }); const t = tb(A);
  near(t['4103'], 50, 'خصم مسموح به مدين'); near(t['4102'], -1000, 'المبيعات كما هي'); near(t['2301'], -142.5, 'الضريبة بعد الخصم'); near(t['1380'] || 0, 0, 'الذمة مقفلة');
  near(E.siRem({ salesInvoices: list }, inv), 0); assert.ok(A.balanced);
});

test('v47.4 بُعد المشروع: وسم المستند أو سطر القيد اليدوي، وربحية المشروع = إيراده − مصروفه في الفترة', () => {
  const org = baseOrg({ projects: [{ id: 'pa', code: 'PRJ-001', name: 'تموين عرس', active: true }, { id: 'pb', code: 'PRJ-002', name: 'افتتاح فرع', active: false }] });
  assert.equal(E.projNextCode(org), 'PRJ-003'); assert.deepEqual(E.projList(org).map(p => p.id), ['pa']); assert.equal(E.projList(org, true).length, 2);
  const ops = {
    salesInvoices: [{ id: 's1', no: 'X-1', kind: 'invoice', date: '2026-11-03', net: 5000, vat: 750, total: 5750, terms: 'cash', fund: '1201', projectId: 'pa', receipts: [] }],
    cashVouchers: [{ id: 'v1', kind: 'pv', no: 'PV-000001', date: '2026-11-04', amount: 800, fund: '1101', party: { t: 'acc', acc: '5901', name: 'مصروفات' }, projectId: 'pa' }],
    journalManual: [{ id: 'j1', date: '2026-11-05', title: 'تحميل', status: 'posted', branchId: 'b1', lines: [{ code: '5201', debit: 1200, credit: 0, projectId: 'pa' }, { code: '5201', debit: 300, credit: 0, projectId: 'pb' }, { code: '1201', debit: 0, credit: 1500 }] }]
  };
  const A = E.buildAccounting(org, ops);
  const R = E.projectPL(A, 'pa', '2026-11-01', '2026-11-30');
  near(R.rev, 5000); near(R.exp, 2000, '800 سند + 1200 سطر القيد'); near(R.net, 3000); assert.equal(R.n, 3);
  near(E.projectPL(A, 'pb').exp, 300, 'سطر واحد فقط للمشروع الثاني');
  near(E.projectPL(A, 'pa', '2026-12-01', '2026-12-31').net, 0, 'خارج الفترة');
  assert.equal(A.entries.find(e => e.id === 'man:j1').branchId, 'b1', 'القيد اليدوي يحمل مركز التكلفة');
});

test('v47.6 البحث بالصوت: تطبيع الكلام المنطوق (أرقام بالكلمات، أوامر البدء، الأرقام العربية)', () => {
  const N = E.voiceNorm;
  assert.equal(N('ابحث عن فاتورة ألفين وستة وعشرين'), 'فاتورة 2026');
  assert.equal(N('خمسة عشر'), '15');
  assert.equal(N('ثلاث آلاف وخمسمية'), '3500');
  assert.equal(N('مية وعشرين ريال'), '120 ريال');
  assert.equal(N('فاتورة-٢٠٢٦-٠٠٠٠٩.'), 'فاتورة-2026-00009');
  assert.equal(N('دور على مؤسسة اللحوم'), 'مؤسسة اللحوم');
  assert.equal(N('واحد'), '1');
  assert.equal(N('أحمد الواحدي'), 'أحمد الواحدي', 'لا يمس الأسماء');
  assert.equal(N('search for invoice 12'), 'invoice 12');
});

test('v47.8 ترتيب الصفوف والقيود الدورية: moveIdx و recurNext و recurDue', () => {
  assert.deepEqual(E.moveIdx(['a', 'b', 'c', 'd'], 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(E.moveIdx(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(E.moveIdx(['a', 'b'], 0, 5), ['a', 'b'], 'خارج المدى لا يغيّر');
  assert.equal(E.recurNext('2026-01-31', 'm', 31), '2026-02-28', 'آخر الشهر');
  assert.equal(E.recurNext('2026-02-28', 'm', 31), '2026-03-31', 'يعود لليوم المطلوب');
  assert.equal(E.recurNext('2026-11-18', 'w'), '2026-11-25');
  assert.equal(E.recurNext('2026-11-15', 'q', 15), '2027-02-15');
  assert.equal(E.recurNext('2024-02-29', 'y', 29), '2025-02-28');
  const due = E.recurDue([{ id: 't1', every: 'm', day: 5, next: '2026-09-05', active: true }, { id: 't2', every: 'm', day: 1, next: '2026-12-01' }, { id: 't3', every: 'm', day: 5, next: '2026-09-05', end: '2026-10-31' }, { id: 't4', every: 'm', next: '2026-09-05', active: false }], '2026-11-18');
  assert.deepEqual(due.map(x => [x.t.id, x.dates, x.next]), [['t1', ['2026-09-05', '2026-10-05', '2026-11-05'], '2026-12-05'], ['t3', ['2026-09-05', '2026-10-05'], '2026-11-05']]);
});

// ═══ v48.0 SMART POS GROWTH — المرحلتان C وD ═══
const spgOrg = { branches: [{ id: 'b1', name: 'طيبة' }, { id: 'b2', name: 'النسيم' }], products: [{ id: 'p1', name: 'برجر' }, { id: 'p2', name: 'بطاطس' }], partners: [{ id: 'c9', type: 'customer', name: 'مؤسسة', phone: '0555000009' }] };
const po = (id, ph, d, tot, br, extra) => ({ id, no: id, branchId: br || 'b1', date: d, at: d + 'T12:00:00', total: tot, vat: 0, net: tot, status: 'paid', lines: [{ productId: 'p1', name: 'برجر', qty: 1, price: tot }],
  ...(ph ? { loyalty: { phone: ph, name: 'عميل ' + ph.slice(-2) } } : {}), ...(extra || {}) });

test('v48.0 CRM: ملف العميل من طلبات نقطة البيع، بعد خصم المرتجع، واستبعاد الملغى، وربط عميل B2B', () => {
  const ops = { posOrders: [po('o1', '555000001', '2026-10-01', 100), po('o2', '555000001', '2026-11-01', 300, 'b2'), po('o3', '555000001', '2026-11-10', 50, 'b1', { status: 'void' }),
    { id: 'r1', kind: 'return', refId: 'o2', branchId: 'b2', date: '2026-11-02', total: -40 }, po('o4', '555000009', '2026-11-15', 80), po('o5', null, '2026-11-15', 999)] };
  const loy = { members: { '555000001': { name: 'سارة', since: '2026-09-20T10:00:00' }, '555000077': { name: 'بلا طلبات', since: '2026-11-01' } }, tx: [{ id: 't1', phone: '555000001', pts: 40 }] };
  const L = E.crmBuild(spgOrg, ops, loy, { td: '2026-11-18' });
  const a = L.find(c => c.phone === '555000001');
  assert.equal(a.n, 2, 'الملغى مستبعد'); near(a.total, 400); near(a.ret, 40); near(a.net, 360); near(a.avg, 200); assert.equal(a.last, '2026-11-01'); assert.equal(a.daysSince, 17);
  assert.equal(a.pts, 40); assert.equal(a.since, '2026-09-20'); assert.deepEqual(a.branches.map(b => b.id).sort(), ['b1', 'b2']);
  assert.equal(L.find(c => c.phone === '555000009').b2b.id, 'c9', 'ربط بعميل آجل بالجوال');
  assert.ok(L.find(c => c.phone === '555000077'), 'عضو ولاء بلا طلبات يظهر للنطاق الكامل');
  assert.equal(L.length, 3, 'الطلب بلا جوال لا يصنع عميلًا');
  // عزل الفروع: مستخدم فرع b2 لا يرى عملاء طلبات b1 ولا أعضاء الولاء بلا طلبات
  const B = E.crmBuild(spgOrg, ops, loy, { td: '2026-11-18', branches: ['b2'] });
  assert.deepEqual(B.map(c => c.phone), ['555000001']); assert.equal(B[0].n, 1);
});

test('v48.0 الشرائح: قواعد قابلة للضبط وتصنيف رئيسي بالأولوية', () => {
  const td = '2026-11-18'; const mk = (ph, dates, tot) => dates.map((d, i) => po(ph + i, ph, d, tot));
  const ops = { posOrders: [
    ...mk('500000001', ['2026-10-20', '2026-10-28', '2026-11-05', '2026-11-12'], 100),   // 4 زيارات خلال 90 يومًا ← وفيّ
    ...mk('500000002', ['2026-06-01', '2026-06-15', '2026-07-01', '2026-07-10'], 50),    // انقطع > 60 ← غير نشط
    ...mk('500000003', ['2026-09-01', '2026-09-20', '2026-10-05'], 60),                  // 3 زيارات وآخرها قبل 44 يومًا ← معرّض
    ...mk('500000004', ['2026-11-10'], 900),                                              // زيارة واحدة بمتوسط عالٍ وجديد ← VIP (حد 800) ثم واعد وجديد
    ...mk('500000005', ['2026-11-15'], 40) ] };
  const cfg = E.mktCfg({ mkt: { seg: { vipSpend: 800 } } });
  assert.equal(cfg.seg.loyalVisits, 4, 'الافتراضات تبقى عند تعديل جزء');
  const S = E.crmSegment(E.crmBuild(spgOrg, ops, null, { td }), cfg, td); const by = (ph) => S.find(c => c.phone === ph);
  assert.equal(by('500000001').cls, 'loyal'); assert.equal(by('500000002').cls, 'inactive'); assert.equal(by('500000003').cls, 'risk');
  assert.equal(by('500000004').cls, 'vip'); assert.ok(by('500000004').tags.includes('potential') && by('500000004').tags.includes('new'));
  assert.equal(by('500000005').cls, 'new');
});

test('v48.0 الموافقة التسويقية: آخر حركة تحكم، وإلغاء الاشتراك فوري، والقناة الخاصة تغلب', () => {
  const ops = { mktConsents: [{ id: 'a', phone: '5', status: 'in', ch: 'all', at: '2026-11-01T10:00' }, { id: 'b', phone: '5', status: 'out', ch: 'sms', at: '2026-11-05T10:00' }, { id: 'c', phone: '6', status: 'in', ch: 'all', at: '2026-11-01' }, { id: 'd', phone: '6', status: 'out', ch: 'all', at: '2026-11-02' }] };
  const c5 = E.mktConsentOf(ops, '5'), c6 = E.mktConsentOf(ops, '6'), c7 = E.mktConsentOf(ops, '7');
  assert.equal(E.mktCanContact(c5, 'whatsapp'), true); assert.equal(E.mktCanContact(c5, 'sms'), false, 'ألغى SMS فقط');
  assert.equal(E.mktCanContact(c6, 'whatsapp'), false, 'إلغاء شامل'); assert.equal(E.mktCanContact(c7, 'any'), false, 'بلا موافقة = لا مراسلة');
  assert.equal(c5.hist.length, 2);
});

test('v48.0 التكرار والدمج المعتمد: لا دمج تلقائي، والدمج يوحّد الطلبات تحت الجوال الباقي', () => {
  const ops = { posOrders: [po('x1', '511111111', '2026-11-01', 100), po('x2', '522222222', '2026-11-02', 50)] };
  ops.posOrders[0].loyalty.name = 'أحمد الحربي'; ops.posOrders[1].loyalty.name = 'احمد  الحربي';
  const L = E.crmBuild(spgOrg, ops, null, { td: '2026-11-18' });
  assert.equal(L.length, 2, 'لا دمج تلقائي'); const D = E.crmDupes(L); assert.equal(D.length, 1); assert.equal(D[0].items.length, 2);
  const M = E.crmBuild(spgOrg, { ...ops, mktMerges: [{ id: 'm', from: '522222222', to: '511111111' }] }, null, { td: '2026-11-18' });
  assert.equal(M.length, 1); assert.equal(M[0].n, 2); near(M[0].total, 150); assert.deepEqual(M[0].aliases, ['522222222']);
  assert.equal(E.mktCanApprove({ role: 'system_admin' }), true); assert.equal(E.mktCanApprove({ role: 'branch_manager' }), false); assert.equal(E.mktCanApprove({ role: 'cashier' }), false);
});

test('v48.0 لوحة التسويق: مؤشرات من الطلبات الفعلية فقط، والاحتفاظ مقابل الفترة السابقة، وما لم يُبنَ = null', () => {
  const ops = { posOrders: [po('k1', '501', '2026-10-25', 100), po('k2', '502', '2026-10-26', 100), po('k3', '501', '2026-11-10', 200), po('k4', '503', '2026-11-11', 100), po('k5', null, '2026-11-12', 60), po('k6', '504', '2026-11-12', 70, 'b2')] };
  const K = E.mktKpis(spgOrg, ops, [], { from: '2026-11-05', to: '2026-11-18', branches: ['b1'] });
  assert.equal(K.orders, 3); near(K.sales, 360); near(K.aov, 120); assert.equal(K.idPct, 67); assert.equal(K.active, 2); assert.equal(K.newC, 1); assert.equal(K.returning, 1);
  assert.equal(K.prevActive, 2); assert.equal(K.retention, 50, 'عاد واحد من اثنين');
  ['campaigns', 'couponRate', 'upsellRate', 'mktCost', 'incRevenue', 'incProfit', 'roi'].forEach(k => assert.equal(K[k], null, k + ' لا يُختلق'));
});

// ═══ v48.1 SMART POS GROWTH — المرحلة E ═══
test('v48.1 الكوبونات: الأهلية (عميل محدد، أول شراء، أعضاء)، حد الاستخدام الكلي ولكل عميل، والسقف، والاستثناء — والعروض القديمة كما هي', () => {
  const now = new Date('2026-11-18T13:00:00');
  const prods = [{ id: 'p1', name: 'برجر', sellPrice: 30 }, { id: 'p2', name: 'ماء', sellPrice: 2 }];
  const cart = [{ productId: 'p1', name: 'برجر', qty: 2, price: 30 }, { productId: 'p2', name: 'ماء', qty: 5, price: 2 }];
  const legacy = [{ id: 'l', name: 'قديم', type: 'pct', value: 10, scope: 'all', active: true }];
  const L0 = E.posPriceCart(cart, prods, legacy, { now }); near(L0.lines[0].disc, 6); near(L0.lines[1].disc, 1); assert.equal(L0.coupon, null);
  const cp = { id: 'c', name: 'كوبون', type: 'pct', value: 50, scope: 'all', code: 'VIP50', active: true, maxUses: 2, perCust: 1, maxDisc: 20, exclude: ['p2'] };
  const uses0 = { vip50: [] };
  let R = E.posPriceCart(cart, prods, [cp], { now, code: 'vip50', phone: '555', uses: uses0 });
  near(R.lines[0].disc, 20, 'سقف 20 بدل 30'); near(R.lines[1].disc || 0, 0, 'الماء مستثنى'); assert.deepEqual(R.coupon, { id: 'c', code: 'VIP50', limited: true });
  assert.equal(E.posPriceCart(cart, prods, [cp], { now, code: 'vip50', phone: '555', uses: null }).coupon, null, 'بلا سجل استخدام (انقطاع) يُرفض');
  assert.equal(E.couponWhy([cp], 'VIP50', { phone: '555', uses: null }, now), 'يتطلب اتصالًا للتحقق من حد الاستخدام');
  const used1 = { vip50: [{ id: 'o1', phone: '555' }] };
  assert.equal(E.posPriceCart(cart, prods, [cp], { now, code: 'vip50', phone: '555', uses: used1 }).coupon, null, 'لكل عميل مرة');
  assert.equal(E.couponWhy([cp], 'vip50', { phone: '555', uses: used1 }, now), 'استخدمه هذا العميل من قبل');
  assert.ok(E.posPriceCart(cart, prods, [cp], { now, code: 'vip50', phone: '777', uses: used1 }).coupon, 'عميل آخر مسموح');
  const used2 = { vip50: [{ id: 'o1', phone: '555' }, { id: 'o2', phone: '666' }] };
  assert.equal(E.couponWhy([cp], 'vip50', { phone: '777', uses: used2 }, now), 'استُنفد حد الاستخدام (2)');
  const rel = { vip50: [{ id: 'o1', phone: '555', rel: '2026-11-18' }, { id: 'o2', phone: '666' }] };
  assert.ok(E.posPriceCart(cart, prods, [cp], { now, code: 'vip50', phone: '555', uses: rel }).coupon, 'المحرَّر بالإلغاء لا يُحتسب');
  const first = { id: 'f', name: 'أول', type: 'order', mode: 'amt', value: 10, code: 'NEW', firstOnly: true, active: true };
  assert.equal(E.posPriceCart(cart, prods, [first], { now, code: 'new', phone: '555', isMember: true }).orderDisc, 0);
  assert.equal(E.posPriceCart(cart, prods, [first], { now, code: 'new', phone: '555', isMember: false }).orderDisc, 10);
  const own = { id: 'o', name: 'خاص', type: 'pct', value: 100, scope: 'items', items: ['p1'], code: 'RW1', custPhone: '555', maxQty: 1, active: true };
  near(E.posPriceCart(cart, prods, [own], { now, code: 'rw1', phone: '555' }).lines[0].disc, 30, 'وحدة واحدة مجانًا لا الكل');
  assert.equal(E.posPriceCart(cart, prods, [own], { now, code: 'rw1', phone: '999' }).coupon, null);
  assert.equal(E.couponWhy([{ ...cp, to: '2026-11-01' }], 'vip50', {}, now), 'انتهت صلاحيته (2026-11-01)');
  assert.equal(E.posPriceCart(cart, prods, [{ ...cp, pending: true }], { now, code: 'vip50', phone: '1', uses: uses0 }).coupon, null, 'بانتظار الاعتماد لا يُطبَّق');
});

test('v48.1 فحص الهامش قبل التفعيل: خصم يجعل الهامش سالبًا يُكشف، وبلا وصفة «غير مكتمل»، والنسبة المتوقعة لكل نوع', () => {
  const org = { taxCfg: { rate: 15 }, items: [{ id: 'm', name: 'لحم', unit: 'كجم', cost: 40 }], products: [{ id: 'p1', name: 'برجر', sellPrice: 23, parts: [{ itemId: 'm', qty: 0.25 }] }, { id: 'p2', name: 'عصير', sellPrice: 10 }] };
  const ok = E.promoMarginCheck(org, {}, { type: 'pct', value: 10, scope: 'all' });
  const b = ok.rows.find(r => r.id === 'p1'); near(b.cost, 10); near(b.net, 18); near(b.cm, 8); assert.equal(ok.neg.length, 0); assert.equal(ok.incomplete.length, 1, 'العصير بلا وصفة');
  const bad = E.promoMarginCheck(org, {}, { type: 'pct', value: 60, scope: 'items', items: ['p1'] }); assert.equal(bad.neg.length, 1); near(bad.neg[0].cm, -2);
  near(E.promoDiscPct({ type: 'bxgy', x: 2, y: 1 }), 33.33, 'اشترِ 2 والثالث مجانًا ≈ 33%');
  near(E.promoDiscPct({ type: 'price', value: 15 }, 20), 25); near(E.promoDiscPct({ type: 'amt', value: 5 }, 20), 25);
});

test('v48.1 الولاء المتقدم: المستويات بنقاط السنة، مضاعف المستوى والفرع ونقاط المنتج، الانتهاء الأقدم أولًا، والمكافآت الدورية بلا تكرار', () => {
  const org = { mkt: { loy: { tiers: [{ k: 's', ar: 'فضي', min: 0, mult: 1 }, { k: 'g', ar: 'ذهبي', min: 100, mult: 1.5 }], brMult: { b2: 2 }, prodPts: { p1: 3 }, expireMonths: 12, bdayPts: 50, refPts: 20 } } };
  const doc = { tx: [{ id: 'a:e', phone: '5', pts: 80, at: '2025-06-01T10:00' }, { id: 'b:e', phone: '5', pts: 120, at: '2026-10-01T10:00' }, { id: 'c:r', phone: '5', pts: -30, at: '2026-10-05T10:00' }, { id: 'adj', phone: '5', pts: 500, at: '2026-10-06' }] };
  const T = E.loyTier(org, doc, '5', '2026-11-18'); assert.equal(T.k, 'g', '120 خلال السنة (التعديل لا يُحتسب)'); assert.equal(T.earned, 120);
  const cfg = { enabled: true, earnPer: 10 };
  assert.equal(E.loyEarnX(org, cfg, 100, { tierMult: 1.5, branchId: 'b2', lines: [{ productId: 'p1', qty: 2 }] }), 36, '10 × 1.5 × 2 + 6');
  assert.equal(E.loyEarnX(org, { enabled: false, earnPer: 10 }, 100, {}), 0);
  assert.equal(E.loyExpiring(doc, '5', 12, '2026-11-18'), 50, 'من 80 القديمة يبقى 50 بعد استهلاك 30');
  const ops = { mktProfiles: [{ phone: '7', bday: '11-02', at: '1' }, { phone: '8', bday: '03-01', at: '1' }], mktReferrals: [{ referrer: '5', referred: '9' }, { referrer: '5', referred: '10' }],
    posOrders: [{ id: 'q', kind: 'sale', status: 'paid', loyalty: { phone: '9' } }] };
  const P = E.loyPeriodicTx(org, ops, doc, '2026-11-18');
  assert.deepEqual(P.map(t => [t.kind, t.phone, t.pts]).sort(), [['bday', '7', 50], ['expire', '5', -50], ['ref', '5', 20]].sort());
  const doc2 = { tx: [...doc.tx, ...P.map(({ kind, ...t }) => t)] };
  assert.equal(E.loyPeriodicTx(org, ops, doc2, '2026-11-25').filter(t => t.kind !== 'expire').length, 0, 'لا تكرار للمكافأة');
  const rc = E.rewardCoupon({ id: 'r', name: 'قهوة', productId: 'p1', days: 10 }, '5', '2026-11-18', 'RWX');
  assert.deepEqual([rc.type, rc.value, rc.items, rc.custPhone, rc.maxUses, rc.maxQty, rc.to], ['pct', 100, ['p1'], '5', 1, 1, '2026-11-28']);
});

test('v49.0 — القيود اليدوية سجلات مستقلة: الفرق والمطابقة والبصمة', () => {
  const j = (o = {}) => ({ id: 'jm1', date: '2026-11-10', title: 'قيد', by: 'أ', byId: 'u1', createdAt: '2026-11-10T08:00:00Z', status: 'pending', lines: [{ code: '1101', debit: 100, credit: 0 }, { code: '4101', debit: 0, credit: 100 }], ...o });
  const a = j(), posted = j({ status: 'posted', approvedBy: 'ب', approvedAt: '2026-11-11T08:00:00Z' });
  // المحتوى الثابت لا يتأثر بالاعتماد — البصمة واحدة قبل القرار وبعده (القواعد تشترط ثباتها)
  assert.equal(E.fjData(a), E.fjData(posted));
  const r = E.fjRecord(a);
  assert.deepEqual([r.date, r.status, r.digest, r.digest.length], ['2026-11-10', 'pending', E.sha256Hex(r.data), 64]);
  assert.equal(E.fjRecord(j({ reverses: 'jm0' })).reverses, 'jm0');
  assert.equal(E.fjStatus({}), 'posted', 'قيد بلا حالة (قديم/آلي) يُعدّ مرحّلًا كما في jeLive');
  // الفرق: إنشاء · قرار · حذف قبل الاعتماد · تعديل محتوى (لا يُنسخ — تكشفه المطابقة)
  let D = E.fjDiff([], [a]); assert.deepEqual([D.create.length, D.decide.length, D.del.length, D.skip.length], [1, 0, 0, 0]);
  D = E.fjDiff([a], [posted]); assert.deepEqual([D.create.length, D.decide.length], [0, 1]);
  D = E.fjDiff([a], []); assert.equal(D.del.length, 1);
  D = E.fjDiff([a], [j({ title: 'معدّل' })]); assert.deepEqual([D.decide.length, D.skip.length, D.skip[0].why], [0, 1, 'content']);
  D = E.fjDiff([a], [a]); assert.equal(D.create.length + D.decide.length + D.del.length + D.skip.length, 0);
  assert.equal(E.fjDiff([], [j({ id: 'bad id!' })]).skip.length, 1);
  // المطابقة
  const rec = (x) => ({ id: x.id, ...E.fjRecord(x) });
  assert.equal(E.fjCompare([a], [rec(a)]).ok, true);
  const K = E.fjCompare([posted, j({ id: 'jm2' })], [rec(a), rec(j({ id: 'jm9' }))]);
  assert.deepEqual([K.ok, K.differ.length, K.missing.length, K.extra.length], [false, 1, 1, 1], 'حالة مختلفة + ناقص + زائد');
  const tampered = { ...rec(a), data: E.fjData(j({ lines: [{ code: '1101', debit: 999, credit: 0 }, { code: '4101', debit: 0, credit: 999 }] })) };
  assert.equal(E.fjCompare([a], [tampered]).differ.length, 1, 'تغيير الأرقام يُكشف');
  assert.equal(E.fjOn({}), false, 'مُطفأ افتراضيًا');
  assert.equal(E.fjOn({ finRecords: { on: true } }), true);
  // BUG-01-02: قفل التطبيق الشهري ← تاريخ الخادم (آخر يوم في الشهر)
  assert.equal(E.fpLockedTo({ periodLocks: { lockedThrough: '2026-02' } }), '2026-02-28');
  assert.equal(E.fpLockedTo({ periodLocks: { lockedThrough: '2026-10' } }), '2026-10-31');
  assert.equal(E.fpLockedTo({}), '0000-00-00');
  // G4: سجل الترحيل يحمل الحالة الأصلية والمنشئ الأصلي، وبصمته كبصمة النسخ المزدوج (فتنجح المطابقة بعده)
  const rej = j({ id: 'jm7', status: 'rejected', rejectedBy: 'ب', rejectReason: 'حساب خاطئ' });
  const L = E.fjLegacyRecord(rej);
  assert.deepEqual([L.legacy, L.origBy, L.status, L.reason, L.digest], [true, 'أ', 'rejected', 'حساب خاطئ', E.fjRecord(rej).digest]);
  assert.equal(E.fjCompare([rej], [{ id: 'jm7', ...L }]).ok, true);
});

test('v49.0 القيود الآلية تمر بالاعتماد (قرار المالك): المالك يرحّل مباشرة، وغيره بانتظار الاعتماد', () => {
  const own = Object.keys(E.ROLES).find(k => E.ROLES[k].admin);
  assert.equal(E.jeAutoSt({ id: 'u1', name: 'م', role: own }).status, 'posted');
  const p = E.jeAutoSt({ id: 'u2', name: 'ح', role: 'accountant' });
  assert.deepEqual([p.status, p.byId, 'approvedBy' in p], ['pending', 'u2', false]);
  assert.equal(E.jeLive({ status: 'pending' }), false, 'لا يدخل الدفاتر قبل الاعتماد');
});


test('v49.0 الفواتير والسندات سجلات مستقلة: المحتوى ثابت، والسداد وحده يتغير، والمطابقة تكشف العبث', () => {
  const pi = { id: 'inv1', supplierId: 's1', invoiceNo: 'A-1', date: '2026-11-10', amount: 115, vatAmt: 15, paidAmount: 0, lines: [{ itemId: 'i', qty: 2, price: 50 }] };
  const paid = { ...pi, paidAmount: 50, payments: [{ amount: 50, date: '2026-11-12' }] };
  assert.equal(E.fdData('pi', pi), E.fdData('pi', paid), 'السداد لا يغيّر المحتوى ولا البصمة');
  assert.notEqual(E.fdProg('pi', pi), E.fdProg('pi', paid));
  assert.deepEqual([E.fdPaid('pi', paid), E.fdPaid('si', { receipts: [{ amount: 10 }, { amount: 5.5 }] }), E.fdPaid('cv', { amount: 99 })], [50, 15.5, 0]);
  const r = E.fdRecord('pi', pi);
  assert.deepEqual([r.kind, r.date, r.digest, r.paid], ['pi', '2026-11-10', E.sha256Hex(r.data), 0]);
  assert.equal(E.fdDate({ createdAt: '2026-11-03T10:00:00Z' }), '2026-11-03', 'بلا تاريخ: تاريخ الإنشاء');
  let D = E.fdDiff('pi', [], [pi]); assert.equal(D.create.length, 1);
  D = E.fdDiff('pi', [pi], [paid]); assert.deepEqual([D.upd.length, D.skip.length], [1, 0]);
  D = E.fdDiff('pi', [pi], [{ ...pi, amount: 999 }]); assert.deepEqual([D.upd.length, D.skip.length, D.skip[0].why], [0, 1, 'content']);
  D = E.fdDiff('pi', [pi], []); assert.equal(D.del.length, 1);
  D = E.fdDiff('cv', [{ id: 'v1', date: '2026-11-10', amount: 5 }], [{ id: 'v1', date: '2026-11-10', amount: 5, _flag: 1 }]); assert.equal(D.upd.length + D.skip.length, 0, 'علامات العرض لا تُحسب');
  const rec = (k, x) => ({ id: k + '_' + x.id, ...E.fdRecord(k, x) });
  assert.equal(E.fdCompare('pi', [paid], [rec('pi', paid)]).ok, true);
  const K = E.fdCompare('pi', [paid, { ...pi, id: 'inv2' }], [rec('pi', pi), rec('pi', { ...pi, id: 'inv9' }), rec('si', { id: 'x', date: '2026-11-10' })]);
  assert.deepEqual([K.differ.length, K.missing.length, K.extra.length, K.recs], [1, 1, 1, 3 - 1], 'السداد غير المنسوخ يُكشف، والأنواع الأخرى لا تختلط');
});

test('v49.0 BUG-01-04: إلغاء الإقفال الضريبي المرحّل بقيد عكسي لا بالحذف', () => {
  const c = { id: 'vc1', date: '2026-09-30', vatClose: { from: '2026-07-01', to: '2026-09-30', net: 100 }, lines: [{ code: '2301', debit: 150, credit: 0 }, { code: '1501', debit: 0, credit: 50 }, { code: '2302', debit: 0, credit: 100 }] };
  assert.equal(E.vatCloseLive([c], c), true);
  assert.equal(E.vatCloseLive([c, { id: 'u', vatUndo: 'vc1', status: 'pending' }], c), true, 'الإلغاء المعلّق لا يلغي الإقفال');
  assert.equal(E.vatCloseLive([c, { id: 'u', vatUndo: 'vc1', status: 'posted' }], c), false);
  assert.equal(E.vatCloseLive([c, { id: 'u', vatUndo: 'vc1', status: 'rejected' }], c), true);
  assert.equal(E.vatCloseLive([], { ...c, status: 'rejected' }), false);
});

test('v49.1 MQ-021 الحارس المركزي للرصيد السالب: يمنع ما يجعل الرصيد سالبًا من أي شاشة، ويستثني خصم المبيعات التلقائي', () => {
  const org = { items: [{ id: 'i1', name: 'دجاج', unit: 'كجم' }], warehouses: [{ id: 'wh-main', kind: 'main' }, { id: 'w1', kind: 'branch', branchId: 'b1' }] };
  const base = { stockMoves: [{ id: 'm1', itemId: 'i1', qty: 10, kind: 'purchase', whId: 'wh-main' }], whMoves: [], whTransfers: [] };
  const add = (o, k, m) => ({ ...o, [k]: [...o[k], m] });
  assert.deepEqual(E.negStockChanges(org, base, add(base, 'stockMoves', { id: 'm2', itemId: 'i1', qty: -10, kind: 'out' })), [], 'حتى الصفر مسموح');
  const N = E.negStockChanges(org, base, add(base, 'stockMoves', { id: 'm2', itemId: 'i1', qty: -12, kind: 'out' }));
  assert.deepEqual(N.map(x => [x.whId, x.itemId, x.before, x.after]), [['wh-main', 'i1', 10, -2]]);
  assert.match(E.negStockMsg(org, N), /دجاج.*المتاح 10 كجم/);
  // تحويل يتجاوز الرصيد · حذف التوريد بعد الصرف
  assert.equal(E.negStockChanges(org, base, add(base, 'whTransfers', { id: 't1', status: 'sent', fromWh: 'wh-main', toWh: 'w1', lines: [{ itemId: 'i1', qtySent: 11 }] })).length, 1);
  const used = add(base, 'stockMoves', { id: 'm2', itemId: 'i1', qty: -6, kind: 'out' });
  assert.equal(E.negStockChanges(org, used, { ...used, stockMoves: used.stockMoves.filter(m => m.id !== 'm1') }).length, 1, 'حذف توريد مستهلك');
  // خصم المبيعات التلقائي لا يُمنع (البيع لا يتوقف)
  assert.deepEqual(E.negStockChanges(org, base, add(base, 'whMoves', { id: 's1', itemId: 'i1', qty: -50, kind: 'sale', whId: 'w1' })), []);
  // سالب قديم لا يمنع حفظًا لا يمسّه، والتوريد يُسمح
  const neg = { ...base, stockMoves: [{ id: 'mx', itemId: 'i1', qty: -3, kind: 'out', whId: 'wh-main' }] };
  assert.deepEqual(E.negStockChanges(org, neg, add(neg, 'stockMoves', { id: 'my', itemId: 'i1', qty: 1, kind: 'in', whId: 'wh-main' })), []);
  assert.deepEqual(E.negStockChanges(org, neg, { ...neg, closings: [] }), []);
  assert.deepEqual(E.negStockChanges({ ...org, allowNegStock: true }, base, add(base, 'stockMoves', { id: 'm2', itemId: 'i1', qty: -12, kind: 'out' })), [], 'استثناء صريح من الإعدادات');
});

test('v49.1 MQ-169 منع تكرار العمليات: إعادة المحاولة لا تكرر السجل نفسه، والنقرة المزدوجة على حفظ تُرفض', () => {
  const v = { id: 'cv1', kind: 'pv', date: '2026-11-18', amount: 50, by: 'منى', at: '2026-11-18T10:00:00.000Z' };
  const prev = { cashVouchers: [v] };
  assert.deepEqual(E.dedupeSameId(prev, { cashVouchers: [v, v] }).cashVouchers.map(x => x.id), ['cv1'], 'المعرّف نفسه مرة واحدة');
  const old = { cashVouchers: [v, v] };
  assert.equal(E.dedupeSameId(old, { cashVouchers: [v, v, { id: 'cv2' }] }).cashVouchers.length, 3, 'تكرار قديم لا يُمس');
  // نقرتان: نفس المحتوى بمعرّف جديد خلال دقيقتين
  const v2 = { ...v, id: 'cv2', at: '2026-11-18T10:00:40.000Z' };
  assert.equal(E.findRecentDups(prev, { cashVouchers: [v2, v] }).length, 1);
  assert.equal(E.findRecentDups(prev, { cashVouchers: [{ ...v2, at: '2026-11-18T10:05:00.000Z' }, v] }).length, 0, 'بعد دقائق: عملية مقصودة');
  assert.equal(E.findRecentDups(prev, { cashVouchers: [{ ...v2, amount: 51 }, v] }).length, 0, 'محتوى مختلف');
  assert.equal(E.findRecentDups(prev, { cashVouchers: [{ ...v2, by: 'سعد' }, v] }).length, 0, 'مستخدم آخر');
  const j = { id: 'j1', date: '2026-11-18', title: 'ت', by: 'منى', createdAt: '2026-11-18T10:00:00Z', lines: [{ code: '1101', debit: 1, credit: 0 }] };
  assert.equal(E.findRecentDups({ journalManual: [j] }, { journalManual: [{ ...j, id: 'j2', createdAt: '2026-11-18T10:00:05Z' }, j] }).length, 1);
});

test('v49.2 MQ-005 الصالات: نطاقات صالحة فقط، الطاولة خارج الصالات «بلا صالة»، والتحقق يكشف التداخل والتجاوز، ومبيعات كل صالة', () => {
  const org = { posCfg: { tables: { b1: 12 }, areas: { b1: [{ id: 'f', name: 'العائلات', from: 6, to: 10 }, { id: 'm', name: 'الرئيسية', from: 1, to: 5 }, { id: 'x', name: 'متداخلة', from: 4, to: 7 }, { id: 'y', name: 'خارج', from: 11, to: 30 }] } } };
  assert.deepEqual(E.posAreas(org, 'b1').map(a => [a.id, a.from, a.to]), [['m', 1, 5], ['f', 6, 10], ['y', 11, 12]], 'المتداخلة تُهمل والتجاوز يُقص');
  assert.equal(E.tableArea(org, 'b1', '7').name, 'العائلات'); assert.equal(E.tableArea({ posCfg: { tables: { b1: 12 } } }, 'b1', '7'), null);
  assert.equal(E.areasErr([{ name: 'أ', from: 1, to: 5 }, { name: 'ب', from: 5, to: 8 }], 12), 'الصالتان «أ» و«ب» متداخلتان');
  assert.match(E.areasErr([{ name: 'أ', from: 1, to: 15 }], 12), /يتجاوز عدد الطاولات/);
  assert.match(E.areasErr([{ name: '', from: 1, to: 2 }], 12), /اسم/);
  assert.equal(E.areasErr([{ name: 'أ', from: 1, to: 6 }, { name: 'ب', from: 7, to: 12 }], 12), '');
  const ops = { posOrders: [
    { branchId: 'b1', status: 'paid', table: '2', total: 50, at: '2026-11-18T10:00:00Z' },
    { branchId: 'b1', status: 'paid', table: '8', total: 30, at: '2026-11-18T11:00:00Z', areaId: 'f', areaName: 'العائلات' },
    { branchId: 'b1', status: 'paid', table: '12', total: 20, at: '2026-11-18T12:00:00Z' },
    { branchId: 'b1', status: 'void', table: '2', total: 99, at: '2026-11-18T12:00:00Z' },
    { branchId: 'b1', status: 'paid', total: 70, at: '2026-11-18T12:00:00Z' }] };
  assert.deepEqual(E.salesByArea({ posCfg: { tables: { b1: 12 }, areas: { b1: [{ id: 'm', name: 'الرئيسية', from: 1, to: 5 }, { id: 'f', name: 'العائلات', from: 6, to: 10 }] } } }, ops, 'b1', '2026-11-18', '2026-11-18').map(x => [x.name, x.orders, x.total]),
    [['الرئيسية', 1, 50], ['العائلات', 1, 30], ['بلا صالة', 1, 20]]);
});

test('v49.2 MQ-006 التوصيل الذاتي: السجل منفصل عن الفاتورة، الانتقالات المسموحة، وعهدة السائق وتسويتها', () => {
  const o = { id: 'o1', no: 'ف1-1', branchId: 'b1', at: '2026-11-18T12:00:00.000Z', channel: 'delivery', total: 92, change: 8, payments: [{ m: 'cash', amount: 100 }] };
  assert.equal(E.dlvNeeded(o), true); assert.equal(E.dlvNeeded({ ...o, payments: [{ m: 'app', amount: 92 }] }), false, 'طلب تطبيق: سائق التطبيق');
  assert.equal(E.dlvNeeded({ ...o, channel: 'takeaway' }), false);
  const r = E.dlvRecord(o, { phone: '0500', addr: 'حي النسيم' });
  assert.deepEqual([r.id, r.st, r.cash, r.addr], ['dl_o1', 'new', 92, 'حي النسيم'], 'النقد = المدفوع − الباقي');
  assert.match(E.dlvMove(r, 'done', 'س').err, /غير مسموح/);
  assert.match(E.dlvMove(r, 'out', 'س').err, /السائق/);
  const out = E.dlvMove(r, 'out', 'س', { driverId: 'd1', driverName: 'أحمد', at: '2026-11-18T12:05:00.000Z' });
  assert.match(E.dlvMove(out, 'fail', 'س').err, /سبب/);
  const done = E.dlvMove(out, 'done', 'س', { at: '2026-11-18T12:29:00.000Z' });
  const ops = { posDeliveries: [done, { ...E.dlvRecord({ ...o, id: 'o2', total: 40, change: 0, payments: [{ m: 'card', amount: 40 }] }), st: 'out', driverId: 'd1', driverName: 'أحمد', outAt: '2026-11-18T12:10:00.000Z' }] };
  const S = E.dlvSummary({}, ops, 'b1', '2026-11-18');
  assert.deepEqual(S.map(x => [x.name, x.orders, x.done, x.out, x.avgMin, x.custody]), [['أحمد', 2, 1, 1, 24, 92]]);
  const settled = { posDeliveries: ops.posDeliveries.map(x => x.st === 'done' ? { ...x, settledAt: '2026-11-18T13:00:00Z' } : x) };
  assert.equal(E.dlvSummary({}, settled, 'b1', '2026-11-18')[0].custody, 0);
  assert.deepEqual(E.posDrivers({ posCfg: { drivers: [{ id: 'd1', name: 'أ' }, { id: 'd2', name: 'ب', branchId: 'b2' }, { id: 'd3', name: 'ج', active: false }] } }, 'b1').map(d => d.id), ['d1']);
  const T = E.posTrim({ posDeliveries: [{ ...done, settledAt: 'x', at: '2026-08-01T10:00:00Z' }, done] }, '2026-11-18');
  assert.equal(T.posDeliveries.length, 1, 'المسوّى الأقدم من 60 يومًا يُقلَّم');
});

test('v49.2 MQ-024 طلب عروض الأسعار: المقارنة لكل صنف ولكل مورد، الفرق عن آخر سعر، والترسية الكاملة أو المجزأة بحد الاعتماد', () => {
  const org = { suppliers: [{ id: 'A', name: 'مورد أ' }, { id: 'B', name: 'مورد ب' }, { id: 'C', name: 'مورد ج' }], purchaseCfg: { approvalLimit: 1000 } };
  const ops = { purchaseOrders: [{ id: 'p0', poNo: 'PO-0007', supplierId: 'A', date: '2026-10-01', lines: [{ itemId: 'rice', qty: 10, price: 40, received: 10 }] }] };
  const rfq = { id: 'r1', no: 'RFQ-0001', lines: [{ key: 'l1', itemId: 'rice', desc: 'رز', qty: 20 }, { key: 'l2', desc: 'زيت', qty: 10 }], suppliers: ['A', 'B', 'C'],
    quotes: { A: { lines: { l1: { price: 42 }, l2: { price: 30 } } }, B: { lines: { l1: { price: 38 }, l2: { price: 33 } }, delivDays: 2 }, C: { lines: { l1: { price: 35 }, l2: { na: true } } } } };
  const C = E.rfqCompare(org, ops, rfq);
  assert.deepEqual(C.rows.map(r => [r.desc, r.best.supplierId, r.best.price, r.vsLast]), [['رز', 'C', 35, -12.5], ['زيت', 'A', 30, null]]);
  assert.deepEqual(C.bySup.map(s => [s.supplierId, s.total, s.full, s.wins]), [['B', 1090, true, 0], ['A', 1140, true, 1], ['C', 700, false, 1]], 'الكامل أولًا ثم الأرخص');
  assert.deepEqual([C.splitTotal, C.bestFull.supplierId, C.saving], [1000, 'B', 90]);
  const one = E.rfqToPOs(org, ops, rfq, 'one', 'B', { name: 'م' }, '2026-11-18T10:00:00Z');
  assert.deepEqual(one.pos.map(p => [p.poNo, p.supplierId, p.lines.length, p.status, p.rfqId]), [['PO-0008', 'B', 2, 'pending', 'r1']], '1090 فوق الحد ⇒ بانتظار الاعتماد');
  assert.match(E.rfqToPOs(org, ops, rfq, 'one', 'C', {}).err, /لم يسعّر كل الأصناف/);
  const sp = E.rfqToPOs(org, ops, rfq, 'split', '', { name: 'م' }, '2026-11-18T10:00:00Z');
  assert.deepEqual(sp.pos.map(p => [p.poNo, p.supplierId, p.lines.map(l => l.desc + ':' + l.price).join(), p.status]), [['PO-0008', 'C', 'رز:35', 'open'], ['PO-0009', 'A', 'زيت:30', 'open']]);
  assert.match(E.rfqToPOs(org, ops, { ...rfq, quotes: { C: rfq.quotes.C } }, 'split').err, /بلا أي عرض/);
  assert.equal(E.rfqNextNo({ rfqs: [{ no: 'RFQ-0009' }] }), 'RFQ-0010');
});

test('v49.2 MQ-037 الربحية صنف × فرع × فترة: الإيراد بحصة السطر من صافي الفاتورة بعد الخصم، المرتجع يُطرح، الملغاة تُستبعد، وبلا وصفة «غير معروفة»', () => {
  const org = baseOrg({ taxCfg: { enabled: true, rate: 15 }, branches: [{ id: 'b1', name: 'طيبة' }, { id: 'b2', name: 'النسيم' }], items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', cost: 10 }],
    products: [{ id: 'K', name: 'كبسة', sellPrice: 46, parts: [{ itemId: 'i1', qty: 1.5 }] }, { id: 'S', name: 'شاي', sellPrice: 4.6, parts: [] }] });
  const o = (id, br, date, lines, net, extra = {}) => ({ id, branchId: br, date, status: 'paid', lines, net, ...extra });
  const ops = { posOrders: [
    o('1', 'b1', '2026-10-05', [{ productId: 'K', name: 'كبسة', qty: 2, price: 46 }, { productId: 'S', name: 'شاي', qty: 2, price: 4.6 }], 88),      // 101.2 قبل خصم ⇒ 88 صافيًا (خصم فاتورة)
    o('2', 'b1', '2026-11-02', [{ productId: 'K', name: 'كبسة', qty: 1, price: 46 }], 40),
    o('3', 'b1', '2026-11-03', [{ productId: 'K', name: 'كبسة', qty: -1, price: 46 }], -40, { kind: 'return' }),
    o('4', 'b2', '2026-11-04', [{ productId: 'K', name: 'كبسة', qty: 3, price: 46 }], 120),
    o('5', 'b2', '2026-11-04', [{ productId: 'K', name: 'كبسة', qty: 9, price: 46 }], 360, { status: 'void' })] };
  const P = E.profitMatrix(org, ops, { from: '2026-10-01', to: '2026-11-30', by: 'month' });
  const pick = (pid, br, per) => P.rows.find(r => r.productId === pid && r.branchId === br && r.period === per);
  const k1 = pick('K', 'b1', '2026-10');
  assert.deepEqual([k1.qty, k1.rev, k1.cost, k1.gp], [2, 80, 30, 50], 'حصة الكبسة 92/101.2 × 88 = 80؛ التكلفة 2 × 1.5 × 10');
  assert.deepEqual([pick('S', 'b1', '2026-10').rev, pick('S', 'b1', '2026-10').cost], [8, null], 'بلا وصفة: تكلفة غير معروفة');
  const k2 = pick('K', 'b1', '2026-11'); assert.deepEqual([k2.qty, k2.rev, k2.cost], [0, 0, 0], 'المرتجع يلغي البيع');
  assert.deepEqual([pick('K', 'b2', '2026-11').qty, pick('K', 'b2', '2026-11').gpPct], [3, 62.5], 'الملغاة مستبعدة');
  assert.deepEqual(P.byBranch.map(b => [b.name, b.rev, b.unknown, b.gp]), [['النسيم', 120, 0, 75], ['طيبة', 88, 8, 50]]);
  assert.deepEqual([P.tot.rev, P.tot.known, P.tot.cost, P.tot.gp, P.tot.unknownRev], [208, 200, 75, 125, 8]);
  assert.equal(E.profitMatrix(org, ops, { from: '2026-10-01', to: '2026-11-30', branchIds: ['b2'] }).rows.length, 1);
  assert.equal(E.pmPeriod('2026-11-18', 'week'), 'أسبوع 2026-11-14', 'الأسبوع يبدأ السبت');
});

test('v49.2 MQ-013 مواقع التخزين: الموقع لكل مستودع، والترتيب الطبيعي (A-2 قبل A-10) والأصناف بلا موقع آخرًا', () => {
  const its = [{ id: 'a', name: 'رز', bins: { 'wh-main': 'A-10' } }, { id: 'b', name: 'زيت', bins: { 'wh-main': 'A-2', 'w1': 'B-1' } }, { id: 'c', name: 'ملح' }, { id: 'd', name: 'بهار', bins: { 'wh-main': 'B-1' } }];
  assert.equal(E.itemBin(its[1], 'w1'), 'B-1'); assert.equal(E.itemBin(its[1]), 'A-2', 'بلا مستودع = الرئيسي'); assert.equal(E.itemBin(its[2], 'w1'), '');
  assert.deepEqual([...its].sort(E.binSort('wh-main')).map(x => x.id), ['b', 'a', 'd', 'c']);
  assert.deepEqual([...its].sort(E.binSort('w1')).map(x => x.id), ['b', 'd', 'c', 'a'].filter(x => x === 'b').concat(['d', 'c', 'a'].sort((x, y) => ({ d: 'بهار', c: 'ملح', a: 'رز' }[x]).localeCompare({ d: 'بهار', c: 'ملح', a: 'رز' }[y], 'ar'))));
});

test('v49.2 MQ-020 تقارير المخزون متسقة: كرت الصنف = الأرصدة لكل مستودع، والافتتاحي + الوارد − الصادر = الختامي، والفترة تُحترم', () => {
  const org = { items: [{ id: 'i1', name: 'دجاج', unit: 'كجم', cost: 10 }], warehouses: [{ id: 'wh-main', kind: 'main', name: 'الرئيسي' }, { id: 'w1', kind: 'branch', branchId: 'b1', name: 'طيبة' }] };
  const ops = { stockMoves: [
      { id: 'a', itemId: 'i1', whId: 'wh-main', kind: 'purchase', qty: 100, date: '2026-10-01', at: '2026-10-01T08:00:00' },
      { id: 'b', itemId: 'i1', whId: 'wh-main', kind: 'out', qty: -5, date: '2026-11-02', at: '2026-11-02T08:00:00' }],
    whMoves: [{ id: 'c', itemId: 'i1', whId: 'w1', kind: 'waste', qty: -2, date: '2026-11-05', at: '2026-11-05T08:00:00' }],
    whTransfers: [{ id: 't', no: 'TR-1', status: 'received', fromWh: 'wh-main', toWh: 'w1', sentDate: '2026-11-03', receivedDate: '2026-11-03', lines: [{ itemId: 'i1', qtySent: 30, qtyRecv: 30 }] }] };
  const S = E.stockByWh(org, ops).byWh;
  for (const w of ['wh-main', 'w1']) assert.equal(E.itemLedger(org, ops, 'i1', { whId: w }).close, S[w].i1, 'كرت الصنف يطابق الأرصدة في ' + w);
  assert.deepEqual([S['wh-main'].i1, S.w1.i1], [65, 28]);
  const L = E.itemLedger(org, ops, 'i1', { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual([L.open, L.qIn, L.qOut, L.close], [100, 30, 37, 93], 'نوفمبر: افتتاحي 100، وارد التحويل 30، صادر 5 + 30 + 2');
  assert.equal(Math.round((L.open + L.qIn - L.qOut) * 1000) / 1000, L.close);
});

test('v49.3 سياسة التكلفة: المتوسط المرجّح افتراضي، وFIFO يستهلك الأقدم — الدفاتر متوازنة بالطريقتين، والمقارنة لا تغيّر شيئًا', () => {
  const mk = (method) => baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], purchaseCfg: { perpetualFrom: '2026-01' }, ...(method ? { costCfg: { method } } : {}),
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }] });
  const ops = { stockMoves: [
      { id: 'a', whId: 'wh-main', itemId: 'i1', kind: 'in', qty: 10, unitCost: 10, date: '2026-03-01', at: '2026-03-01T08:00:00Z' },
      { id: 'b', whId: 'wh-main', itemId: 'i1', kind: 'in', qty: 10, unitCost: 12, date: '2026-03-02', at: '2026-03-02T08:00:00Z' },
      { id: 'c', whId: 'wh-main', itemId: 'i1', kind: 'out', qty: -15, date: '2026-03-03', at: '2026-03-03T08:00:00Z' }], whMoves: [], whTransfers: [] };
  assert.equal(E.costMethod(mk()), 'avg', 'الافتراضي'); assert.equal(E.costMethod(mk('fifo')), 'fifo'); assert.equal(E.costMethod(mk('lifo')), 'avg', 'LIFO غير مسموح ⇒ المتوسط');
  const A = E.buildAccounting(mk(), ops), F = E.buildAccounting(mk('fifo'), ops);
  assert.equal(A.balanced, true); assert.equal(F.balanced, true);
  const ta = tb(A), tf = tb(F);
  near(ta['5501'], 165, 'المتوسط: 15 × 11'); near(ta['160101'], 55, 'المتوسط: 5 × 11');
  near(tf['5501'], 160, 'FIFO: 10 × 10 + 5 × 12'); near(tf['160101'], 60, 'FIFO: الباقي 5 × 12');
  assert.equal(E.itemAvgCosts(mk('fifo'), ops).i1, 12, 'قيمة الوحدة القائمة بطبقاتها');
  const C = E.costCompare(mk(), ops, { from: '2026-03-01', to: '2026-03-31' });
  assert.deepEqual([C.current, C.tot.avgV, C.tot.fifoV, C.tot.avgOut, C.tot.fifoOut], ['avg', 55, 60, 165, 160]);
  // مرتجع لمورد يُخرج من طبقة شرائه
  const ops2 = { ...ops, stockMoves: [...ops.stockMoves.slice(0, 2), { id: 'r', whId: 'wh-main', itemId: 'i1', kind: 'purchase', qty: -10, unitCost: 12, date: '2026-03-02', at: '2026-03-02T09:00:00Z' }] };
  assert.equal(E.itemAvgCosts(mk('fifo'), ops2).i1, 10, 'بقيت طبقة الـ10 فقط');
});

test('v49.4 المرحلة 03 دفتر الأستاذ وحركة الحسابات: رصيد جارٍ، افتتاحي الفترة، الحساب الأب مع فروعه، الفرع، والمطابقة مع الميزان لكل حساب', () => {
  const org = baseOrg({ items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { perpetualFrom: '2026-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'العليا', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102' }] });
  const ops = {
    invoices: [{ id: 'inv1', supplierId: 's1', supplierName: 'مورد', amount: 690, vatAmt: 90, taxable: true, date: '2026-03-02', paidAmount: 0, branchId: 'b1', whId: 'wh-b1', lines: [{ itemId: 'i1', qty: 60, unitCost: 10, net: 600, stock: true }] }],
    whMoves: [{ id: 'm1', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'purchase', qty: 60, unitCost: 10, invoiceId: 'inv1', date: '2026-03-02', at: '2026-03-02T08:00:00Z' },
      { id: 'm2', whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind: 'out', qty: -6, date: '2026-04-03', at: '2026-04-03T08:00:00Z' }],
    journalManual: [{ id: 'j1', date: '2026-04-10', title: 'تمويل', status: 'posted', lines: [{ code: '1101', debit: 500, credit: 0 }, { code: '3101', debit: 0, credit: 500 }] }],
    stockMoves: [], whTransfers: [] };
  const A = E.buildAccounting(org, ops); assert.equal(A.balanced, true);
  const L = E.glLedger(A, '160102', { from: '2026-04-01', to: '2026-04-30' });
  assert.deepEqual([L.open, L.debit, L.credit, L.close, L.rows.length, L.rows[0].bal], [600, 0, 60, 540, 1, 540], 'افتتاحي أبريل 600 ثم صرف 60');
  const P = E.glLedger(A, '1601', { to: '2026-04-30' });
  assert.equal(P.close, 540, 'الحساب الأب يجمع فروعه');
  assert.equal(E.glLedger(A, '1601', { to: '2026-04-30', sub: false }).rows.length, 0);
  assert.equal(E.glLedger(A, '2101', { to: '2026-04-30' }).close, 690, 'المورد دائن بطبيعته');
  assert.equal(E.glLedger(A, '1101', { bf: 'b1' }).rows.length, 0, 'القيد المركزي خارج الفرع');
  // المطابقة: لكل حساب ورقي، ختامي الدفتر = ختامي حركة الحسابات = رصيد الميزان، والحركة متوازنة
  const M = E.acctActivity(A, { from: '2026-04-01', to: '2026-04-30' });
  assert.equal(M.balanced, true);
  M.rows.forEach(r => { const g = E.glLedger(A, r.code, { from: '2026-04-01', to: '2026-04-30', sub: false });
    assert.deepEqual([g.open, g.debit, g.credit, g.close], [r.open, r.debit, r.credit, r.close], 'الحساب ' + r.code); });
  const t = tb(A); M.rows.forEach(r => near(r.close * (['asset', 'exp'].includes(r.kind) ? 1 : -1), t[r.code] || 0, 'الميزان ' + r.code));
});

test('v49.4 MQ-048 طرق الإهلاك: القسط الثابت افتراضي، والمتناقص ومجموع أرقام السنين يستنفدان القابل للإهلاك بالهللة، والقيود متوازنة', () => {
  const a = { cost: 12000, lifeYears: 2, salvage: 0 };
  const sl = E.deprSchedule(a), dd = E.deprSchedule({ ...a, depMethod: 'ddb' }), sy = E.deprSchedule({ ...a, depMethod: 'syd' }), sv = E.deprSchedule({ ...a, salvage: 2400 });
  const S = (x) => Math.round(x.reduce((p, v) => p + v, 0) * 100) / 100;
  assert.equal(E.depMethod({}), 'sl'); assert.equal(E.depMethod({ depMethod: 'xx' }), 'sl');
  assert.deepEqual([sl.length, sl[0], S(sl)], [24, 500, 12000]);
  assert.deepEqual([dd.length, dd[0], S(dd)], [24, 1000, 12000], 'المضاعف: 2/24 من الرصيد أول شهر');
  assert.ok(dd[0] > dd[10] && Math.abs(dd[22] - dd[13]) < 0.02, 'متناقص ثم يتحول للثابت على المتبقي');
  assert.deepEqual([sy.length, sy[0], sy[23], S(sy)], [24, 960, 40, 12000], 'مجموع الأرقام 300: 24/300 ثم 1/300');
  assert.deepEqual([sv[0], S(sv)], [400, 9600], 'القيمة المتبقية خارج القابل للإهلاك');
  const org = baseOrg({ assets: [{ id: 'x', name: 'فرن', cost: 12000, buyDate: '2024-01-10', lifeYears: 2, fund: '1201', depMethod: 'ddb' }] });
  const A = E.buildAccounting(org, {}); assert.equal(A.balanced, true);
  const t = tb(A); near(-t['1791'], 12000, 'استُنفد بالكامل بعد عامين');
});

test('v49.5 MQ-059 مسارات الاعتماد: مستويات بحدود مبالغ وأدوار، بالترتيب، مع فصل المهام، وبلا تهيئة يبقى السلوك الحالي', () => {
  const org = baseOrg({ purchaseCfg: { approvalLimit: 1000 }, wf: { po: { tiers: [
    { id: 'm', min: 5000, roles: ['head_office'], label: 'المكتب الرئيسي' }, { id: 'f', min: 0, roles: ['finance_department'], label: 'المالية' }] } } });
  const fin = { id: 'u1', name: 'سعد', role: 'finance_department' }, gm = { id: 'u2', name: 'خالد', role: 'head_office' }, own = { id: 'u0', name: 'مجاهد', role: 'general_management' };
  assert.deepEqual(E.wfTiers(org, 'po').map(t => t.id), ['f', 'm'], 'مرتبة بالحد');
  assert.equal(E.poNeedsAppr(org, 300), true, 'المسار المهيّأ يحل محل حد الاعتماد (المستوى الأول من صفر)');
  assert.equal(E.poNeedsAppr(baseOrg({ purchaseCfg: { approvalLimit: 1000 } }), 300), false, 'بلا تهيئة: الحد القديم');
  const po = { id: 'p', by: 'منى', byId: 'u9' };
  assert.deepEqual(E.wfState(org, 'po', po, 800).req.map(t => t.id), ['f']);
  let S = E.wfState(org, 'po', po, 8000); assert.deepEqual([S.req.length, S.next.id, S.complete], [2, 'f', false]);
  assert.match(E.wfCanAct(org, 'po', po, 8000, gm).why, /المالية/, 'الترتيب: المالية أولًا');
  assert.match(E.wfCanAct(org, 'po', po, 8000, { id: 'u9', name: 'منى', role: 'finance_department' }).why, /أنشأته/);
  const c1 = E.wfCanAct(org, 'po', po, 8000, fin); assert.deepEqual([c1.ok, c1.tier.id, c1.last], [true, 'f', false]);
  const po1 = E.wfApprove(po, c1.tier, fin, '2026-11-19T10:00:00Z');
  assert.match(E.wfCanAct(org, 'po', po1, 8000, fin).why, /اعتمدتَ مستوى سابقًا/, 'الشخص نفسه لا يعتمد مستويين');
  const c2 = E.wfCanAct(org, 'po', po1, 8000, gm); assert.deepEqual([c2.ok, c2.last], [true, true]);
  assert.equal(E.wfCanAct(org, 'po', po1, 8000, own).ok, true, 'المالك يعتمد أي مستوى');
  assert.equal(E.wfState(org, 'po', E.wfApprove(po1, c2.tier, gm), 8000).complete, true);
});

test('v50.0 المرحلة 05 منظومة التقارير: مواصفة واحدة ⇒ طباعة وExcel بصيغ وCSV بأرقام متطابقة، والصيغ تغطي صفوف البيانات بالضبط', async () => {
  const org = baseOrg({ company: { name: 'مطعم الطائف', taxNumber: '300000000000003' } });
  const spec = { id: 'demo', title: 'مصروفات الفروع', sub: 'نوفمبر 2026', template: 'statement', lang: 'ar', meta: { user: 'مجاهد', source: 'مِثقال v50.0', at: '2026-11-19T10:00:00Z' }, filters: [['الفرع', 'الكل']],
    columns: [{ key: 'name', label: 'البند' }, { key: 'q', label: 'الكمية', type: 'qty', total: 'sum' }, { key: 'amt', label: 'المبلغ', type: 'money', total: 'sum' }],
    groups: [{ label: 'طيبة', rows: [{ name: 'كهرباء', q: 1, amt: 1200.5 }, { name: 'ماء', q: 2, amt: 300 }] }, { label: 'النسيم', rows: [{ name: 'كهرباء', q: 1, amt: -50 }] }] };
  assert.deepEqual(E.rptTotals(spec), { q: 4, amt: 1450.5 });
  assert.deepEqual(E.rptFlat(spec).map(r => r._k), ['head', 'row', 'row', 'sub', 'head', 'row', 'sub']);
  const X = E.rptXlsxRows(org, spec), tot = X.rows[X.rows.length - 1];
  assert.equal(tot[2].f, 'SUM(C' + (X.freeze + 2) + ',C' + (X.freeze + 3) + ',C' + (X.freeze + 6) + ')', 'المجموع الكلي بصيغة على صفوف البيانات وحدها (لا المجاميع الفرعية)');
  const refs = tot[2].f.slice(4, -1).split(',').map(r => Number(r.slice(1)) - 1);
  assert.equal(Math.round(refs.reduce((a, i) => a + X.rows[i][2].v, 0) * 100) / 100, tot[2].v, 'قيمة الصيغة = المجموع المحسوب');
  const flat = { ...spec, groups: undefined, rows: spec.groups.flatMap(g => g.rows) };
  const XF = E.rptXlsxRows(org, flat), tf = XF.rows[XF.rows.length - 1];
  assert.equal(tf[2].f, 'SUM(C' + (XF.freeze + 1) + ':C' + (XF.rows.length - 1) + ')');
  const xml = new TextDecoder().decode(new Uint8Array(await E.makeRptXlsx(org, spec).arrayBuffer()));   // ملف مخزّن بلا ضغط ⇒ الـXML مقروء
  assert.match(xml, /<pane ySplit="\d+"/); assert.match(xml, /<f>SUM\(C\d+,C\d+,C\d+\)<\/f><v>1450\.5<\/v>/); assert.match(xml, /#,##0\.00/); assert.match(xml, /<col min="1"/);
  const csv = E.rptCsv(spec);
  assert.equal(csv.charCodeAt(0), 0xFEFF, 'BOM للعربية'); assert.match(csv, /الإجمالي,4,1450\.5/);
  const html = E.rptHtml(org, spec);
  assert.match(html, /thead\{display:table-header-group\}/, 'رأس الجدول يتكرر في كل صفحة');
  assert.match(html, /counter\(page\)/, 'ترقيم الصفحات'); assert.match(html, /طبعه: مجاهد/); assert.match(html, /300000000000003/);
  assert.match(html, /\(50\.00\)/, 'السالب بين قوسين'); assert.match(html, /1,450\.50/);
  assert.match(E.rptHtml(org, { ...spec, lang: 'en', orientation: 'landscape', paper: 'A3' }), /size:A3 landscape[\s\S]*dir="ltr"|dir="ltr"[\s\S]*size:A3 landscape/);
});

test('v50.0 G2 التعميم: كل طباعة قديمة بالقالب الموحد (ترقيم، رأس متكرر، تذييل)، وكل ورقة Excel قديمة برأس مجمّد وعرض أعمدة', async () => {
  const org = baseOrg({ company: { name: 'مطعم', taxNumber: '3001', address: 'الطائف' } });
  const h = E.rptShell(org, 'كشف', 'نوفمبر', '<table><thead><tr><th>أ</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>', { orientation: 'landscape' });
  assert.match(h, /counter\(page\)[\s\S]*counter\(pages\)/); assert.match(h, /thead\{display:table-header-group\}/); assert.match(h, /size:A4 landscape/);
  assert.match(h, /الرقم الضريبي: 3001 · الطائف/); assert.match(h, /صادر من مِثقال v[\s\S]*طبعه:/);
  const xml = new TextDecoder().decode(new Uint8Array(await E.makeXlsx([{ name: 'قديم', rows: [['البند', 'المبلغ'], ['كهرباء طويلة الاسم جدًا', 1200]] }]).arrayBuffer()));
  assert.match(xml, /<pane ySplit="1"/); assert.match(xml, /<col min="1" max="1" width="\d+"/);
  assert.match(xml, /<c r="A1" s="1"/, 'الرأس عريض كما كان');
});
