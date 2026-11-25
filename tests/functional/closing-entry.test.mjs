/**
 * اختبارات انحدار قيد الإغلاق اليومي (buildAccounting — قسم الإغلاقات في App.jsx).
 * تثبّت السلوك الحالي الموثق في الكود فقط؛ لا تمس ما هو معلّق على قرار المالك
 * (حذف/إرجاع المرحّل، الاعتراف عند الترحيل، تاريخ سريان الضريبة، النسبة الافتراضية، isTaxable، فصل ضريبة العمولة).
 * تُشغَّل: node --test tests/functional/closing-entry.test.mjs — كل الأرقام وهمية ومحسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from '../build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const r2 = (x) => Math.round(x * 100) / 100;
const tb = (A, pred = () => true) => { const t = {}; A.entries.filter(pred).forEach(e => e.lines.forEach(l => { t[l.code] = r2((t[l.code] || 0) + l.debit - l.credit); })); return t; };
const near = (a, b, msg) => assert.ok(Math.abs((a || 0) - b) < 0.011, (msg || '') + ` — المتوقع ${b} والفعلي ${a}`);
const baseOrg = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'فرع أ', isActive: true }], taxCfg: { enabled: true, rate: 15 }, ...x });
const closing = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'فرع أ', date: '2026-03-10', status: 'approved', totalRevenue: 0, cashSales: 0, cardSales: 0,
  deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, supplierPayments: [], ...x });
const entry = (A, id) => A.entries.find(e => e.id === id);
const lineOf = (e, code) => e.lines.filter(l => l.code === code);
const amt = (e, code, side) => r2(lineOf(e, code).reduce((s, l) => s + l[side], 0));
const apps = [{ id: 'appA', n: 'تطبيق أ', c: 20 }, { id: 'appB', n: 'تطبيق ب', c: 10 }];

// ───── 1) تطبيقات التوصيل ─────
test('توصيل بنسبة محفوظة على الإغلاق: ذمم التطبيق 1301 مدينة بالصافي و5301 بالعمولة، والقيد متوازن', () => {
  // نقد 500 + تطبيق أ 400 بنسبة محفوظة 18% (تغلب نسبة الإعدادات 20%) ← عمولة 72، صافي 328؛ الإجمالي 900 ← 782.61 + 117.39
  const A = E.buildAccounting(baseOrg({ deliveryApps: apps }), { closings: [closing({ cashSales: 500, deliverySales: [{ appId: 'appA', amount: 400, commissionPercentage: 18 }] })] });
  const e = entry(A, 'rev:c1'); assert.ok(e, 'قيد إيراد الوردية موجود');
  assert.equal(e.balanced, true); assert.equal(A.balanced, true);
  near(amt(e, '1301', 'debit'), 328, 'ذمم تطبيق أ = الصافي');
  near(amt(e, '5301', 'debit'), 72, 'العمولة بالنسبة المحفوظة 18%');
  near(amt(e, '1111', 'debit'), 500, 'صندوق الفرع');
  near(amt(e, '4101', 'credit'), 782.61, 'الإيراد الصافي'); near(amt(e, '2301', 'credit'), 117.39, 'ضريبة المخرجات');
  near(e.debit, 900); near(e.credit, 900);
});

test('توصيل بلا نسبة محفوظة: تُؤخذ نسبة التطبيق من الإعدادات، وكل تطبيق إلى حساب ذممه', () => {
  // أ: 400 × 20% = 80 ← صافي 320 (1301) · ب: 250 × 10% = 25 ← صافي 225 (1302) · الإجمالي 650 ← 565.22 + 84.78
  const A = E.buildAccounting(baseOrg({ deliveryApps: apps }), { closings: [closing({ deliverySales: [{ appId: 'appA', amount: 400 }, { appId: 'appB', amount: 250 }] })] });
  const e = entry(A, 'rev:c1'); assert.equal(e.balanced, true); assert.equal(A.balanced, true);
  near(amt(e, '1301', 'debit'), 320, 'ذمم تطبيق أ'); near(amt(e, '1302', 'debit'), 225, 'ذمم تطبيق ب');
  near(amt(e, '5301', 'debit'), 105, 'مجموع العمولتين 80 + 25');
  near(amt(e, '4101', 'credit') + amt(e, '2301', 'credit'), 650, 'الإيراد + الضريبة = إجمالي المبيعات');
});

test('توصيل لتطبيق غير معرّف: يُقيَّد في 1399 بالنسبة المحفوظة على الإغلاق، والسطر بمبلغ صفر لا يُرحَّل', () => {
  const A = E.buildAccounting(baseOrg({ deliveryApps: apps }), { closings: [closing({ deliverySales: [{ appId: 'xx', amount: 200, commissionPercentage: 10 }, { appId: 'appA', amount: 0 }] })] });
  const e = entry(A, 'rev:c1'); assert.equal(e.balanced, true);
  near(amt(e, '1399', 'debit'), 180, 'ذمم تطبيقات أخرى = 200 − 20'); near(amt(e, '5301', 'debit'), 20, 'العمولة 10%');
  assert.equal(lineOf(e, '1301').length, 0, 'لا سطر لتطبيق بمبلغ صفر');
});

// ───── 2) عجز/فائض الصندوق ─────
test('عجز الصندوق: مدين 5401 دائن صندوق الفرع بقيمة العجز، في قيد مستقل متوازن', () => {
  const A = E.buildAccounting(baseOrg(), { closings: [closing({ cashSales: 300, variance: -25 })] });
  const e = entry(A, 'cashvar:c1'); assert.ok(e, 'قيد فرق الجرد موجود'); assert.equal(e.balanced, true);
  assert.equal(e.lines.length, 2);
  near(amt(e, '5401', 'debit'), 25, 'مصروف العجز'); near(amt(e, '1111', 'credit'), 25, 'الصندوق ينقص');
  near(tb(A)['1111'], 275, 'رصيد الصندوق = 300 − 25'); assert.equal(A.balanced, true);
});

test('فائض الصندوق: مدين صندوق الفرع دائن 5401، والفرق صفر لا يولّد قيدًا', () => {
  const A = E.buildAccounting(baseOrg(), { closings: [closing({ cashSales: 300, variance: 40 })] });
  const e = entry(A, 'cashvar:c1'); assert.equal(e.balanced, true);
  near(amt(e, '1111', 'debit'), 40, 'الصندوق يزيد'); near(amt(e, '5401', 'credit'), 40, '5401 دائن بالفائض');
  near(tb(A)['1111'], 340); assert.equal(A.balanced, true);
  const B = E.buildAccounting(baseOrg(), { closings: [closing({ cashSales: 300, variance: 0 })] });
  assert.equal(entry(B, 'cashvar:c1'), undefined, 'لا قيد عند تطابق الجرد');
});

// ───── 3) وسيط الشبكة ─────
test('وسيط الشبكة مفعّل من شهر الإغلاق: الشبكة إلى 1801 لا إلى البنك؛ وقبل تاريخ السريان إلى البنك 1201', () => {
  const org = baseOrg({ posClearing: { enabled: true, from: '2026-03' } });
  const A = E.buildAccounting(org, { closings: [closing({ id: 'm', date: '2026-03-01', cashSales: 100, cardSales: 460 }), closing({ id: 'f', date: '2026-02-28', cashSales: 100, cardSales: 230 })] });
  const m = entry(A, 'rev:m'), f = entry(A, 'rev:f');
  near(amt(m, '1801', 'debit'), 460, 'مارس: الشبكة في الوسيط'); assert.equal(lineOf(m, '1201').length, 0, 'مارس: لا شبكة في البنك');
  near(amt(f, '1201', 'debit'), 230, 'فبراير: قبل السريان إلى البنك'); assert.equal(lineOf(f, '1801').length, 0);
  assert.equal(m.balanced, true); assert.equal(f.balanced, true); assert.equal(A.balanced, true);
});

test('وسيط الشبكة غير مفعّل (أو بلا تاريخ سريان): الشبكة إلى البنك مباشرة ولا حساب 18xx', () => {
  for (const pc of [undefined, { enabled: false, from: '2026-01' }, { enabled: true }]) {
    const A = E.buildAccounting(baseOrg(pc ? { posClearing: pc } : {}), { closings: [closing({ cardSales: 460 })] });
    const e = entry(A, 'rev:c1');
    near(amt(e, '1201', 'debit'), 460, 'الشبكة في البنك — ' + JSON.stringify(pc));
    assert.equal(e.lines.some(l => l.code.startsWith('18')), false);
  }
});

test('وسيط الشبكة لفرع له بنك خاص: الشبكة إلى وسيط بنك الفرع 1811 (مشتق من 1211)', () => {
  const org = baseOrg({ branches: [{ id: 'b1', name: 'فرع أ', isActive: true, bankName: 'بنك وهمي' }], posClearing: { enabled: true, from: '2026-01' } });
  const e = entry(E.buildAccounting(org, { closings: [closing({ cardSales: 115 })] }), 'rev:c1');
  near(amt(e, '1811', 'debit'), 115); assert.equal(lineOf(e, '1211').length, 0); assert.equal(lineOf(e, '1801').length, 0);
});

// ───── 4) التحويل البنكي المباشر ─────
test('التحويل البنكي المباشر bankTransferSales: إلى البنك دائمًا حتى مع تفعيل وسيط الشبكة', () => {
  const org = baseOrg({ posClearing: { enabled: true, from: '2026-01' } });
  const A = E.buildAccounting(org, { closings: [closing({ cashSales: 100, cardSales: 200, bankTransferSales: 230 })] });
  const e = entry(A, 'rev:c1'); assert.equal(e.balanced, true);
  near(amt(e, '1201', 'debit'), 230, 'التحويل في البنك'); near(amt(e, '1801', 'debit'), 200, 'الشبكة في الوسيط');
  near(amt(e, '4101', 'credit') + amt(e, '2301', 'credit'), 530, 'التحويل داخل الإجمالي: 100 + 200 + 230');
  const B = E.buildAccounting(baseOrg({ branches: [{ id: 'b1', name: 'فرع أ', isActive: true, bankIban: 'SA0000000000000000000000' }] }), { closings: [closing({ bankTransferSales: 50 })] });
  near(amt(entry(B, 'rev:c1'), '1211', 'debit'), 50, 'فرع له بنك خاص: التحويل إلى بنك الفرع');
});

// ───── 5) التقريب ─────
test('التقريب بكسور الهللات وضريبة 15%: القيد متوازن، و4101 + 2301 = الإجمالي', () => {
  // نقد 333.33 + شبكة 111.11 + تطبيق أ 77.77 بنسبة 18% (عمولة 14.00، صافي 63.77) = 522.21 ← 454.10 + 68.11
  const A = E.buildAccounting(baseOrg({ deliveryApps: apps }), { closings: [closing({ cashSales: 333.33, cardSales: 111.11, deliverySales: [{ appId: 'appA', amount: 77.77, commissionPercentage: 18 }] })] });
  const e = entry(A, 'rev:c1'); assert.equal(e.balanced, true); assert.equal(A.balanced, true);
  near(amt(e, '4101', 'credit'), 454.10); near(amt(e, '2301', 'credit'), 68.11);
  near(amt(e, '1301', 'debit'), 63.77); near(amt(e, '5301', 'debit'), 14);
  near(amt(e, '4101', 'credit') + amt(e, '2301', 'credit'), 522.21, 'الإيراد + الضريبة = الإجمالي');
});

test('التقريب على عينة مبالغ بكسور: كل قيد متوازن، والإيراد + الضريبة = الإجمالي حتى الهللة', () => {
  const vals = [[0.01, 0, 0], [0.99, 0.01, 0], [10.05, 20.15, 0.3], [1234.56, 789.01, 12.34], [99.99, 0.07, 0.11], [7.77, 8.88, 9.99]];
  vals.forEach(([cash, card, bt], i) => {
    const A = E.buildAccounting(baseOrg({ deliveryApps: apps }), { closings: [closing({ cashSales: cash, cardSales: card, bankTransferSales: bt, deliverySales: [{ appId: 'appA', amount: r2(cash + 3.33) }] })] });
    const e = entry(A, 'rev:c1'); const gross = r2(cash + card + bt + r2(cash + 3.33));
    assert.equal(e.balanced, true, 'عينة ' + i);
    assert.ok(Math.abs(amt(e, '4101', 'credit') + amt(e, '2301', 'credit') - gross) < 0.005, 'عينة ' + i + ': الإيراد + الضريبة = ' + gross);
  });
});

// ───── 6) تعدد الفروع ─────
test('تعدد الفروع: كل فرع إلى صندوقه، وبنك الفرع إن وُجد وإلا البنك التجميعي، والعجز من صندوق الفرع نفسه', () => {
  const org = baseOrg({ branches: [{ id: 'b1', name: 'فرع أ', isActive: true }, { id: 'b2', name: 'فرع ب', isActive: true, bankName: 'بنك وهمي' }] });
  const A = E.buildAccounting(org, { closings: [
    closing({ id: 'x1', branchId: 'b1', branchName: 'فرع أ', cashSales: 100, cardSales: 50 }),
    closing({ id: 'x2', branchId: 'b2', branchName: 'فرع ب', cashSales: 200, cardSales: 80, bankTransferSales: 20, variance: -5 })] });
  assert.equal(A.balanced, true);
  const t = tb(A);
  near(t['1111'], 100, 'صندوق فرع أ'); near(t['1112'], 195, 'صندوق فرع ب = 200 − عجز 5');
  near(t['1201'], 50, 'شبكة فرع أ في البنك التجميعي'); near(t['1212'], 100, 'بنك فرع ب = شبكة 80 + تحويل 20');
  near(t['5401'], 5, 'العجز');
  assert.equal(entry(A, 'rev:x1').branchId, 'b1'); assert.equal(entry(A, 'rev:x2').branchId, 'b2');
  assert.equal(entry(A, 'rev:x1').lines.some(l => l.code === '1112' || l.code === '1212'), false, 'لا تداخل بين الفرعين');
});

// ───── 7) الضريبة معطّلة ─────
test('الضريبة معطّلة: لا سطر 2301 والإيراد كله في 4101، والقيد متوازن', () => {
  for (const taxCfg of [{ enabled: false, rate: 15 }, undefined]) {
    const org = baseOrg({ deliveryApps: apps }); if (taxCfg) org.taxCfg = taxCfg; else delete org.taxCfg;
    const A = E.buildAccounting(org, { closings: [closing({ cashSales: 690, cardSales: 460, deliverySales: [{ appId: 'appA', amount: 100 }] })] });
    const e = entry(A, 'rev:c1');
    assert.equal(lineOf(e, '2301').length, 0, 'لا ضريبة مخرجات — ' + JSON.stringify(taxCfg));
    near(amt(e, '4101', 'credit'), 1250, 'الإيراد = 690 + 460 + 100');
    assert.equal(e.vat, null, 'لا بيانات ضريبية على القيد');
    assert.equal(e.balanced, true); assert.equal(A.balanced, true);
  }
});
