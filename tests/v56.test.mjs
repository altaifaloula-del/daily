/**
 * v56.0 — اختبارات المحرك لإصلاحات التدقيق (P0/P1): تكرار الإغلاق (GAP-002)، قفل الخادم (GAP-003)،
 * إقفال عدة سنوات مالية (ACC-V56-001)، وعدم ازدواج الإيراد. الأرقام المتوقعة محسوبة يدويًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const r2 = (x) => Math.round(x * 100) / 100;
const tb = (A, pred = () => true) => { const t = {}; A.entries.filter(pred).forEach(e => e.lines.forEach(l => { t[l.code] = r2((t[l.code] || 0) + l.debit - l.credit); })); return t; };
const near = (a, b, msg) => assert.ok(Math.abs((a || 0) - b) < 0.011, (msg || '') + ` — المتوقع ${b} والفعلي ${a}`);
const baseOrg = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'طيبة', isActive: true }, { id: 'b2', name: 'العليا', isActive: true }], taxCfg: { enabled: true, rate: 15 }, ...x });
const closing = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'طيبة', date: '2026-03-10', status: 'submitted', gmApprovalStatus: 'pending', totalRevenue: 1150, cashSales: 690, cardSales: 460,
  deliverySales: [], expenses: [], totalExpenses: 0, variance: 0, actualCashCount: 690, expectedCashInSafe: 690, transferredToMainTreasury: 0, supplierPayments: [], ...x });
const revOf = (A) => -Object.entries(tb(A)).filter(([c]) => c.startsWith('4')).reduce((s, [, v]) => s + v, 0);

/* ===================== GAP-002 ===================== */
test('GAP-002: جهازان يُنشئان إغلاقين للفرع واليوم نفسه بمعرّفين مختلفين — الحارس يرفض الثاني على أحدث نسخة', () => {
  const latest = { closings: [closing({ id: 'cl-b1-2026-03-10-aaa' })] };          // ما كتبه الجهاز الأول (أحدث نسخة سحابية)
  const next = { closings: [closing({ id: 'cl-b1-2026-03-10-bbb' }), ...latest.closings] };   // الجهاز الثاني يعيد تطبيق تعديله عليها
  const d = E.findDupClosings(latest, next);
  assert.equal(d.length, 1); assert.equal(d[0].rec.id, 'cl-b1-2026-03-10-bbb'); assert.equal(d[0].dup.id, 'cl-b1-2026-03-10-aaa');
  assert.match(d[0].msg, /يوجد إغلاق مسجّل/);
});

test('GAP-002: طابور دون اتصال يرفع إغلاقين جديدين لليوم نفسه في حفظ واحد — مرفوض', () => {
  const d = E.findDupClosings({ closings: [] }, { closings: [closing({ id: 'x1' }), closing({ id: 'x2', status: 'draft' })] });
  assert.equal(d.length, 1);
});

test('GAP-002: ما لا يمس التكرار يمر — تعديل الإغلاق نفسه، إغلاق فرع آخر أو يوم آخر، وإعادة الإغلاق بعد الرفض', () => {
  const a = closing({ id: 'a' });
  assert.equal(E.findDupClosings({ closings: [a] }, { closings: [{ ...a, cashSales: 700 }] }).length, 0, 'تعديل نفسه');
  assert.equal(E.findDupClosings({ closings: [a] }, { closings: [closing({ id: 'b', branchId: 'b2' }), a] }).length, 0, 'فرع آخر');
  assert.equal(E.findDupClosings({ closings: [a] }, { closings: [closing({ id: 'b', date: '2026-03-11' }), a] }).length, 0, 'يوم آخر');
  const rej = { ...a, status: 'rejected' };
  assert.equal(E.findDupClosings({ closings: [rej] }, { closings: [closing({ id: 'b' }), rej] }).length, 0, 'بعد الرفض');
  assert.equal(E.findDupClosings({ closings: [rej, closing({ id: 'b' })] }, { closings: [{ ...rej, status: 'draft' }, closing({ id: 'b' })] }).length, 1, 'إعادة المرفوض مسودة والخانة مشغولة');
  assert.equal(E.findDupClosings({ closings: [a, closing({ id: 'b', date: '2026-03-11' })] }, { closings: [a, closing({ id: 'b', date: '2026-03-10' })] }).length, 1, 'نقل التاريخ لخانة مشغولة');
});

test('GAP-002: تكرار قديم موجود قبل الحفظ لا يوقف حفظًا غير متصل به (يكشفه فحص السلامة dupclose)', () => {
  const legacy = [closing({ id: 'a' }), closing({ id: 'b' })];
  assert.equal(E.findDupClosings({ closings: legacy }, { closings: [closing({ id: 'z', date: '2026-04-01' }), ...legacy] }).length, 0);
  const S = E.integrityChecks(baseOrg(), { closings: legacy }).find(x => x.id === 'dupclose');
  assert.equal(S.st, 'bad', 'فحص السلامة يكشفه');
});

test('GAP-002: الإغلاق بالمعرّف نفسه مرتين (إعادة محاولة/مزامنة) يُحفظ مرة واحدة ولا يتضاعف الإيراد', () => {
  const c = closing();
  const before = { closings: [] }, next = { closings: [c, { ...c }] };
  const out = E.dedupeSameId(before, next);
  assert.equal(out.closings.length, 1);
  const A1 = E.buildAccounting(baseOrg(), { closings: [c] }), A2 = E.buildAccounting(baseOrg(), out);
  assert.equal(A2.balanced, true);
  near(revOf(A2), revOf(A1), 'الإيراد مرة واحدة'); near(revOf(A2), 1000, 'إيراد صافٍ 1000 (1150 شاملة)');
});

test('عدم ازدواج الإيراد والمصروف: الإيراد = مجموع الإغلاقات المحتسبة فقط، والمسودة والمرفوض لا يدخلان', () => {
  const ops = { closings: [closing({ id: 'a' }), closing({ id: 'b', date: '2026-03-11', status: 'approved' }), closing({ id: 'd', date: '2026-03-12', status: 'draft' }), closing({ id: 'r', date: '2026-03-13', status: 'rejected' })] };
  const A = E.buildAccounting(baseOrg(), ops); assert.equal(A.balanced, true);
  near(revOf(A), 2000, 'إغلاقان محتسبان × 1000');
  const ids = A.entries.map(e => e.id); assert.equal(new Set(ids).size, ids.length, 'لا قيد مكرر المعرّف');
});

/* ===================== GAP-003 ===================== */
test('GAP-003: قفل الخادم يُنسخ في التشغيل الافتراضي (الإغلاقات المستقلة مفعّلة افتراضيًا) — كان مشروطًا بـ finRecords المطفأة', () => {
  assert.equal(E.fpOn({}), true, 'المنشأة الافتراضية');
  assert.equal(E.fpOn({ closingRecords: { on: false } }), false, 'كلاهما مطفأ صراحةً');
  assert.equal(E.fpOn({ closingRecords: { on: false }, finRecords: { on: true } }), true);
  assert.equal(E.fpLockedTo({ periodLocks: { lockedThrough: '2026-02' } }), '2026-02-28');
});

/* ===================== ACC-V56-001: إقفال عدة سنوات ===================== */
const yeOps = { journalManual: [
  { id: 'r25', date: '2025-06-01', title: 'إيراد 2025', lines: [{ code: '1201', debit: 1000, credit: 0 }, { code: '4101', debit: 0, credit: 1000 }] },
  { id: 'e25', date: '2025-07-01', title: 'إيجار 2025', lines: [{ code: '5901', debit: 300, credit: 0 }, { code: '1201', debit: 0, credit: 300 }] },
  { id: 'r26', date: '2026-06-01', title: 'إيراد 2026', lines: [{ code: '1201', debit: 500, credit: 0 }, { code: '4101', debit: 0, credit: 500 }] },
  { id: 'e26', date: '2026-07-01', title: 'إيجار 2026', lines: [{ code: '5901', debit: 650, credit: 0 }, { code: '1201', debit: 0, credit: 650 }] }] };

test('ACC-V56-001: إقفال 2026 بعد قفل 2025 — كان مستحيلًا (حارس الإقفال يرفض)، الآن يُحفظ ويبقى قيد 2025 كما هو', () => {
  const o1 = baseOrg({ taxCfg: { enabled: false }, yearEnd: { enabled: true, closeDate: '2025-12-31' }, periodLocks: { lockedThrough: '2025-12' } });
  const o2 = { ...o1, yearEnd: E.yearEndNext(o1.yearEnd, true, '2026-12-31') };
  assert.deepEqual(o2.yearEnd.history, ['2025-12-31']);
  assert.equal(E.lockedLedgerChanged(o1, yeOps, o2, yeOps), false, 'لا يغيّر قيود 2025 المقفلة');
  const A1 = E.buildAccounting(o1, yeOps), A2 = E.buildAccounting(o2, yeOps);
  assert.equal(A2.balanced, true);
  const y25a = A1.entries.find(e => e.id === 'yearend'), y25b = A2.entries.find(e => e.id === 'yearend');
  assert.deepEqual(y25b.lines, y25a.lines, 'قيد إقفال 2025 لم يتغير'); assert.equal(y25b.date, '2025-12-31');
  const y26 = A2.entries.find(e => e.id === 'yearend-2026-12-31'); assert.ok(y26, 'قيد إقفال 2026');
  // كل سنة مُصفّرة حتى تاريخ إقفالها
  for (const cd of ['2025-12-31', '2026-12-31']) {
    const t = tb(A2, e => e.date <= cd);
    Object.entries(t).filter(([c]) => c.startsWith('4') || c.startsWith('5')).forEach(([c, v]) => near(v, 0, 'الحساب ' + c + ' مُصفّر حتى ' + cd));
  }
  near(-(tb(A2, e => e.date <= '2025-12-31')['3201'] || 0), 700, 'أرباح مبقاة نهاية 2025 = 1000 − 300');
  near(-(tb(A2)['3201'] || 0), 550, 'نهاية 2026 = 700 + (500 − 650) خسارة 150');
  assert.match(y26.title, /خسارة مُدوّرة 150/);
});

test('ACC-V56-001: تصحيح تاريخ إقفال إلى تاريخ أسبق يحذف ما بعده من السجل، والإيقاف يعيد السلوك السابق', () => {
  const p = { enabled: true, closeDate: '2026-12-31', history: ['2024-12-31', '2025-12-31'] };
  assert.deepEqual(E.yearEndNext(p, true, '2025-06-30'), { enabled: true, closeDate: '2025-06-30', history: ['2024-12-31'] });
  assert.deepEqual(E.yearEndDates({ closeDate: '2025-12-31', history: ['2025-12-31', 'bad'] }), ['2025-12-31'], 'لا تكرار ولا تاريخ تالف');
  const A = E.buildAccounting(baseOrg({ taxCfg: { enabled: false }, yearEnd: { enabled: false, closeDate: '2025-12-31', history: ['2024-12-31'] } }), yeOps);
  assert.equal(A.entries.filter(e => e.closing).length, 0, 'موقوف = لا قيود إقفال');
});

test('ACC-V56-001: منشأة بإقفال سنة واحدة (بيانات ما قبل v56) — القيد مطابق حرفيًا لما قبل الإصلاح', () => {
  const o = baseOrg({ taxCfg: { enabled: false }, yearEnd: { enabled: true, closeDate: '2025-12-31' } });
  const A = E.buildAccounting(o, yeOps), ye = A.entries.filter(e => e.closing);
  assert.equal(ye.length, 1); assert.equal(ye[0].id, 'yearend');
  near(-(tb(A, e => e.date <= '2025-12-31')['3201'] || 0), 700);
  // بلا السجل يُصفّر كل ما قبل التاريخ تراكميًا كما كان
  const o2 = baseOrg({ taxCfg: { enabled: false }, yearEnd: { enabled: true, closeDate: '2026-12-31' } });
  near(-(tb(E.buildAccounting(o2, yeOps))['3201'] || 0), 550);
});

/* ===================== PAY-V56-001: الرواتب حسب مدة الخدمة ===================== */
const emp = (x = {}) => ({ id: 'e1', name: 'سعد', branchId: 'b1', nationality: 'saudi', hireDate: '2020-01-01', gosiSubject: true, baseSalary: 6000, housingAllowance: 1500, transportAllowance: 500, ...x });
const G = { gosiCfg: { enabled: true } };

test('PAY-V56-001: شهر كامل لا يتغير — الأرقام مطابقة لاختبار v47.2', () => {
  const [r] = E.payrollRowsOf(G, [], [emp()], '2026-10');
  assert.equal(r.factor, 1); near(r.gross, 8000); near(r.gEmp, 731.25); near(r.net, 7268.75);
});

test('PAY-V56-001: موظف يُعيَّن بعد الشهر لا يُستحق له شيء (كان يُستحق راتبًا كاملًا في الاستحقاق التلقائي)', () => {
  const [r] = E.payrollRowsOf(G, [], [emp({ hireDate: '2026-11-01' })], '2026-10');
  assert.equal(r.factor, 0); near(r.gross, 0); near(r.gEmp, 0); near(r.gEr, 0); near(r.net, 0);
  const org = { ...baseOrg(), ...G, employees: [emp({ hireDate: '2026-11-01' }), emp({ id: 'e2' })] };
  const A = E.payrollAccrualApply({ ledgerEntries: [], advances: [] }, org, '2026-10');
  assert.deepEqual(A.entries.map(x => x.partnerKey), ['emp:e2'], 'المعيَّن في نوفمبر لا يدخل استحقاق أكتوبر');
});

test('PAY-V56-001: تعيين منتصف الشهر — الأساسي والبدلات بنسبة الأيام ÷ 30، والمكافأة والسلفة كما هي', () => {
  const adv = [{ employeeId: 'e1', month: '2026-10', type: 'bonus', amount: 300 }, { employeeId: 'e1', month: '2026-10', type: 'advance', amount: 500 }];
  const [r] = E.payrollRowsOf(G, adv, [emp({ hireDate: '2026-10-20' })], '2026-10');
  assert.equal(r.days, 12, '20 → 31 أكتوبر'); near(r.factor, 0.4);
  near(r.allow, 800, '(1500 + 500) × 12/30'); near(r.gross, 3500, '6000×0.4 + 800 + 300 مكافأة');
  near(r.gEmp, 806.25, 'التأمينات اشتراك شهري كامل — معيَّن 2026 = النظام الجديد 10.75% × 7500'); near(r.net, 3500 - 500 - 806.25);
});

test('PAY-V56-001: انتهاء الخدمة — الشهر الأخير جزئي، وما بعده صفر، والموقوف بلا تاريخ صفر', () => {
  const left = emp({ isActive: false, endDate: '2026-10-10' });
  const [a] = E.payrollRowsOf(G, [], [left], '2026-10'); assert.equal(a.days, 10); near(a.gross, 8000 / 3);
  const [b] = E.payrollRowsOf(G, [], [left], '2026-11'); near(b.gross, 0); near(b.gEmp, 0);
  const [c] = E.payrollRowsOf(G, [], [emp({ isActive: false })], '2026-10'); near(c.gross, 0);
  const org = { ...baseOrg(), ...G, employees: [left] };
  const A = E.payrollAccrualApply({ ledgerEntries: [], advances: [] }, org, '2026-10');
  assert.equal(A.entries.length, 1, 'المنتهية خدمته في أكتوبر يُستحق له ما خدمه'); near(A.entries[0].credit, 8000 / 3);
  assert.equal(E.payrollAccrualApply({ ledgerEntries: [], advances: [] }, org, '2026-11').entries.length, 0);
});

test('PAY-V56-001: فبراير وأشهر 31 يومًا — الشهر الكامل راتب كامل لا 28/30 ولا 31/30', () => {
  assert.equal(E.payFactor(emp(), '2026-02').f, 1);
  assert.equal(E.payFactor(emp({ hireDate: '2026-02-01' }), '2026-02').f, 1);
  assert.equal(E.payFactor(emp({ hireDate: '2026-01-01', endDate: '2026-01-31', isActive: false }), '2026-01').f, 1);
  assert.equal(E.payFactor(emp({ hireDate: '2026-03-02' }), '2026-03').days, 30, '2 → 31 مارس = 30 يومًا (الحد)');
});

test('الاستحقاق التلقائي للرواتب لا يتكرر لنفس الشهر، ولا يُنشأ لشهر مقفل', () => {
  const org = { ...baseOrg(), ...G, employees: [emp()] };
  const A = E.payrollAccrualApply({ ledgerEntries: [], advances: [] }, org, '2026-10');
  assert.equal(A.entries.length, 1);
  assert.equal(E.payrollAccrualApply(A.next, org, '2026-10').entries.length, 0, 'مرة واحدة فقط');
  assert.equal(E.payrollAccrualApply({ ledgerEntries: [], advances: [] }, { ...org, periodLocks: { lockedThrough: '2026-10' } }, '2026-10').entries.length, 0, 'الشهر المقفل');
});

/* ===================== GAP-007: تعليق طلب السفري واستدعاؤه ===================== */
test('GAP-007: التعليق لا يقبل سلة فارغة وله حد أقصى، والاستدعاء يعيد التسعير ويُسقط المحذوف', () => {
  assert.ok(E.posHoldPut([], { cart: [] }).err, 'سلة فارغة');
  const h = { id: 'h1', cart: [{ productId: 'k', name: 'كبسة', qty: 2, price: 90 }, { productId: 'gone', name: 'صنف محذوف', qty: 1, price: 10 }] };
  const r = E.posHoldPut([], h); assert.equal(r.list.length, 1);
  const full = Array.from({ length: E.POS_HOLD_MAX }, (_, i) => ({ id: 'x' + i, cart: [{ productId: 'k', qty: 1, price: 1 }] }));
  assert.match(E.posHoldPut(full, h).err, /الحد/);
  const R = E.posHoldRecall(h, [{ id: 'k', name: 'كبسة', sellPrice: 100 }]);
  assert.deepEqual(R.cart.map(l => [l.productId, l.qty, l.price]), [['k', 2, 100]], 'السعر الحالي 100 لا المحفوظ 90');
  assert.deepEqual(R.dropped, ['صنف محذوف']); assert.deepEqual(R.repriced, ['كبسة']);
});

/* ===================== المخزون: تسوية الجرد بالتكلفة ===================== */
test('تسوية الجرد: عجز 5 وحدات بمتوسط مرجّح 11 → 5503 مدين 55 ومخزون المستودع دائن 55، وفائض يعكسها، والميزان متوازن', () => {
  const org = baseOrg({ taxCfg: { enabled: false }, items: [{ id: 'i1', name: 'زيت', unit: 'لتر', type: 'stock' }], suppliers: [{ id: 's1', name: 'مورد' }], purchaseCfg: { perpetualFrom: '2026-01' },
    warehouses: [{ id: 'wh-main', name: 'الرئيسي', kind: 'main', accCode: '160101' }, { id: 'wh-b1', name: 'طيبة', kind: 'branch', branchId: 'b1', parentId: 'wh-main', accCode: '160102' }] });
  const inv = (id, qty, cost, d) => ({ id, supplierId: 's1', supplierName: 'مورد', amount: qty * cost, taxable: false, date: d, paidAmount: 0, branchId: 'b1', whId: 'wh-b1', lines: [{ itemId: 'i1', qty, unitCost: cost, net: qty * cost, stock: true }] });
  const mv = (id, kind, qty, d, x = {}) => ({ id, whId: 'wh-b1', branchId: 'b1', itemId: 'i1', kind, qty, date: d, at: d + 'T08:00:00Z', ...x });
  const ops = { invoices: [inv('p1', 10, 10, '2026-03-01'), inv('p2', 10, 12, '2026-03-02')], stockMoves: [], whTransfers: [],
    whMoves: [mv('m1', 'purchase', 10, '2026-03-01', { unitCost: 10, invoiceId: 'p1' }), mv('m2', 'purchase', 10, '2026-03-02', { unitCost: 12, invoiceId: 'p2' }), mv('a1', 'adjust', -5, '2026-03-05')] };
  const A = E.buildAccounting(org, ops); assert.equal(A.balanced, true);
  const t = tb(A); near(t['5503'], 55, 'عجز الجرد 5 × 11'); near(t['160102'], 220 - 55, 'المخزون 165');
  const B = E.buildAccounting(org, { ...ops, whMoves: [...ops.whMoves.slice(0, 2), mv('a2', 'adjust', 3, '2026-03-05')] });
  assert.equal(B.balanced, true); near(tb(B)['5503'], -33, 'فائض 3 × 11 دائن'); near(tb(B)['160102'], 253);
});

/* ===================== التقارير = الدفتر ===================== */
test('التقارير تطابق الدفتر: حركة الحسابات ودفتر الأستاذ والإجماليات المطبوعة = ميزان القيود، بالعربية RTL والإنجليزية LTR', () => {
  const org = baseOrg({ suppliers: [{ id: 's1', name: 'م' }] });
  const ops = { closings: [closing({ id: 'a', status: 'approved' }), closing({ id: 'b', date: '2026-03-11', branchId: 'b2', branchName: 'العليا' })],
    invoices: [{ id: 'i1', supplierId: 's1', supplierName: 'م', amount: 1150, taxable: true, date: '2026-03-05', paidAmount: 0 }],
    journalManual: [{ id: 'j1', date: '2026-03-20', title: 'إيجار', lines: [{ code: '5901', debit: 300, credit: 0 }, { code: '1201', debit: 0, credit: 300 }] }] };
  const A = E.buildAccounting(org, ops); assert.equal(A.balanced, true);
  const t = tb(A), act = E.acctActivity(A, { from: '2026-03-01', to: '2026-03-31' });
  assert.equal(act.balanced, true, 'حركة الحسابات متوازنة');
  const dr = r2(A.entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0));
  near(act.debit, dr, 'إجمالي المدين في التقرير = مجموع مدين القيود');
  act.rows.forEach(r => { const g = E.glLedger(A, r.code, { from: '2026-03-01', to: '2026-03-31' });
    near(g.close, r.close, 'دفتر الأستاذ = حركة الحسابات للحساب ' + r.code);
    const n = ['asset', 'exp'].includes(r.kind) ? 1 : -1; near(r.close, n * (t[r.code] || 0), 'الختامي = الميزان للحساب ' + r.code); });
  const spec = (lang) => ({ title: 'حركة الحسابات', lang, columns: [{ key: 'code', label: 'الحساب', en: 'Account' }, { key: 'debit', label: 'مدين', en: 'Debit', type: 'money', total: 'sum' }, { key: 'credit', label: 'دائن', en: 'Credit', type: 'money', total: 'sum' }], rows: act.rows });
  const T = E.rptTotals(spec('ar')); near(T.debit, act.debit, 'إجمالي التقرير المطبوع'); near(T.credit, act.credit);
  const ar = E.rptHtml(org, spec('ar')), en = E.rptHtml(org, spec('en'));
  assert.match(ar, /dir="rtl"/); assert.match(en, /dir="ltr"/);
  assert.match(ar, /صفحة/); assert.match(en, /Page/); assert.match(ar, /اختبار/, 'ترويسة باسم المنشأة');
  assert.ok(ar.includes(act.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })), 'الإجمالي المطبوع بالأرقام نفسها');
});
