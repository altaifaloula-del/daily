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
