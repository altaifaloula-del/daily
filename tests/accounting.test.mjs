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
