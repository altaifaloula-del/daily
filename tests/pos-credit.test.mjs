/**
 * v56.46 — البيع الآجل من نقطة البيع (docs/finance/06-POS-CREDIT.md — قرارات المجلس P9).
 * الأرقام وهمية ومحسوبة يدويًا: فاتورة 1,150 شاملة (صافي 1,000 + ضريبة 15% = 150) دُفع منها 690 نقدًا و460 آجلًا على العميل.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildEngine } from './build-engine.mjs';
import { creditDecide, creditDue, creditAuthInput, memberInBranch, mountPosCredit, creditExceptions, HOLD_CAP_CUST, HOLD_CAP_USER } from '../server-poscredit.js';
import { loadTenants } from '../tenants.js';

let E;
before(async () => { E = await buildEngine(); });
const r2 = (n) => Math.round(n * 100) / 100;
const tb = (A) => { const t = {}; A.entries.forEach(e => e.lines.forEach(l => { t[l.code] = r2((t[l.code] || 0) + l.debit - l.credit); })); return t; };
const D1 = '2026-01-10', D2 = '2026-01-12';
const CK = 'cust:c1';
const cust = (x = {}) => ({ id: 'c1', key: CK, name: 'عميل تجريبي', type: 'customer', posCredit: true, creditLimit: 1000, terms: 30, ...x });
const org = (x = {}) => ({ company: { name: 'منشأة اختبار' }, branches: [{ id: 'b1', name: 'فرع 1', isActive: true }], taxCfg: { enabled: true, rate: 15 }, posCfg: { credit: true, branches: ['b1'] }, partners: [cust()], ...x });
const sale = (x = {}) => ({ id: 'o1', no: 'ف1-260110-A-0001', branchId: 'b1', date: D1, status: 'paid', total: 1150, vat: 150, net: 1000, rate: 15, lines: [{ productId: 'p', name: 'وجبة', qty: 10, price: 115 }],
  payments: [{ m: 'cash', amount: 690 }, { m: 'credit', amount: 460, custKey: CK, custName: 'عميل تجريبي' }], change: 0, ar: { key: CK, name: 'عميل تجريبي', dueDate: '2026-02-09', authId: 'ca_x' }, ...x });
const ret = (x = {}) => ({ id: 'r1', kind: 'return', refId: 'o1', refNo: 'ف1-260110-A-0001', no: 'م1-260112-A-0001', branchId: 'b1', date: D2, status: 'paid', total: -115, vat: -15, net: -100, rate: 15, lines: [], retLines: [{ i: 0, qty: 1, amount: 115 }],
  payments: [{ m: 'credit', amount: -115, custKey: CK, custName: 'عميل تجريبي' }], ar: { key: CK, name: 'عميل تجريبي' }, ...x });
const clo = (x = {}) => ({ id: 'cl1', branchId: 'b1', branchName: 'فرع 1', date: D1, status: 'submitted', cashSales: 690, cardSales: 0, bankTransferSales: 0, deliverySales: [], expenses: [], creditSales: 460, creditRows: [{ customerKey: CK, name: 'عميل تجريبي', amount: 460, n: 1 }], ...x });
const custBal = (P) => r2(P.filter(p => p.type === 'customer').reduce((a, p) => a + p.balance, 0));

test('المفتاح مطفأ وبلا فواتير آجلة: لا أثر — السجل الفرعي هو فواتير المبيعات نفسها، والملخص والبصمة والدليل كما كانت', () => {
  const ops = { closings: [clo({ creditSales: undefined, creditRows: undefined, cashSales: 1150 })].map(c => { const { creditSales, creditRows, ...r } = c; return r; }), posOrders: [sale({ payments: [{ m: 'cash', amount: 1150 }], ar: undefined })], salesInvoices: [] };
  assert.equal(E.arDocs(ops, org()), ops.salesInvoices, 'المرجع نفسه بلا فواتير آجلة');
  const s = E.posDaySummary(ops.posOrders, 'b1', D1); assert.equal('credit' in s, false); assert.equal('creditBy' in s, false);
  const off = org({ posCfg: {} });
  assert.deepEqual(tb(E.buildAccounting(off, ops)), tb(E.buildAccounting(org(), ops)));
  assert.deepEqual(E.buildPartners(off, ops).map(p => [p.key, p.balance]), E.buildPartners(org(), ops).map(p => [p.key, p.balance]));
  // البصمة: بلا الحقل = المصفوفة السابقة حرفيًا
  const c = ops.closings[0]; const q = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const old = E.sha256Hex(JSON.stringify([c.id, c.branchId, c.date, q(c.cashSales), q(c.cardSales), q(c.bankTransferSales), [], q(c.totalRevenue), [], q(c.totalExpenses), q(c.actualCashCount), q(c.variance), q(c.transferredToMainTreasury)]));
  assert.equal(E.sigDigest('closing', c), old);
  assert.notEqual(E.sigDigest('closing', clo()), E.sigDigest('closing', { ...clo(), creditSales: 400 }), 'الآجل ضمن البصمة متى وُجد');
  // الدليل: الوسم منشور للمؤهل فقط ومع التفعيل فقط، بلا الحد ولا الرقم الضريبي
  assert.equal(E.dirOf(off).partners[0].posCredit, undefined);
  const dp = E.dirOf(org()).partners[0]; assert.equal(dp.posCredit, true); assert.equal(dp.creditLimit, undefined); assert.equal(dp.tax, undefined);
  assert.equal(E.dirOf(org({ partners: [cust({ tax: '300000000000003' })] })).partners[0].posCredit, undefined, 'المسجّل ضريبيًا غير مؤهل');
  assert.equal(E.posCreditOk(cust({ creditLimit: 0 })), false); assert.equal(E.posCreditOk(cust({ posCredit: false })), false);
});

test('690 نقد + 460 آجل: مدين الصندوق 690 ومدين 1380 460، دائن 4101 1000 و2301 150؛ نقطة البيع مطابقة؛ رصيد العميل 460 = 1380', () => {
  for (const o of [org(), org({ posGl: { on: true, from: '2026-01-01' } })]) {
    const ops = { closings: [clo()], posOrders: [sale()] };
    const A = E.buildAccounting(o, ops); const e = A.entries.find(x => x.id === 'rev:cl1'); assert.equal(e.balanced, true);
    const t = tb(A); assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]).filter(l => l[0] !== '1380' && !/^4|^2301/.test(l[0])), [['1111', 690, 0]], 'صندوق الفرع 690');
    assert.equal(t['1111'], 690); assert.equal(t['1380'], 460); assert.equal(t['4101'], -1000); assert.equal(t['2301'], -150);
    assert.equal(e.lines.find(l => l.code === '1380').debit, 460);
    if (o.posGl) { assert.equal(e.posGl, 'pos'); assert.equal(E.posGlCheck(o, ops)[0].ok, true, 'posGl مطابق مع الآجل'); }
    const P = E.buildPartners(o, ops); const c = P.find(p => p.key === CK);
    assert.equal(c.balance, -460); assert.equal(-custBal(P), t['1380'], '1380 = مجموع أرصدة العملاء');
    assert.deepEqual(E.customerAging(c, '2026-01-20', true), { b0: 460, b30: 0, b60: 0, b90: 0, total: 460, credit: 0 });
  }
  const s = E.posDaySummary([sale()], 'b1', D1);
  assert.equal(s.credit, 460); assert.equal(s.cash, 690); assert.deepEqual(s.creditBy[CK], { customerKey: CK, name: 'عميل تجريبي', amount: 460, n: 1 });
  const inc = E.computeIncome(org(), { closings: [clo()] }, [clo()], ['b1'], '2026-01-01', '2026-01-31'); assert.equal(inc.R.credit, 460); assert.equal(inc.grossRevenue, 1150);
});

test('الإغلاق مسودة: 1380 صفر وكشف العميل صفر ولا مستند ذمة', () => {
  const ops = { closings: [clo({ status: 'draft' })], posOrders: [sale()] };
  assert.equal(tb(E.buildAccounting(org(), ops))['1380'], undefined);
  assert.equal(E.buildPartners(org(), ops).find(p => p.key === CK).balance, 0);
  assert.equal(E.arDocs(ops, org()).length, 0);
  assert.deepEqual(E.partyOpenDocs(org(), ops, { t: 'cust', key: CK }), []);
  assert.equal(E.posCreditSnap(org(), ops, CK).unposted, 460, 'غير المرحّل يُحتسب في التعرض');
});

test('الاستحقاق: 30 يومًا من 2026-01-10 = 2026-02-09 (المحرك والخادم)', () => {
  assert.equal(E.posCreditDue('2026-01-10', 30), '2026-02-09'); assert.equal(creditDue('2026-01-10', 30), '2026-02-09');
  assert.equal(creditDue('2026-02-20', 10), '2026-03-02'); assert.equal(creditDue('2026-01-10', 0), '2026-01-10');
});

test('مرتجع 115 إلى الحساب: مدين 4101 100 ومدين 2301 15 ودائن 1380 115 — ويوم مرتجعات آجلة فقط يُنتج قيدًا', () => {
  const ops = { closings: [clo(), clo({ id: 'cl2', date: D2, cashSales: 0, creditSales: -115, creditRows: [{ customerKey: CK, name: 'عميل تجريبي', amount: -115, n: 0 }] })], posOrders: [sale(), ret()] };
  const A = E.buildAccounting(org(), ops); const e = A.entries.find(x => x.id === 'rev:cl2');
  assert.ok(e, 'قيد يوم المرتجع'); assert.equal(e.balanced, true);
  const L = (c) => e.lines.filter(l => l.code === c).reduce((a, l) => [r2(a[0] + l.debit), r2(a[1] + l.credit)], [0, 0]);
  assert.deepEqual(L('4101'), [100, 0]); assert.deepEqual(L('2301'), [15, 0]); assert.deepEqual(L('1380'), [0, 115]);
  const A2 = E.buildAccounting(org({ posGl: { on: true, from: '2026-01-01' } }), ops); const e2 = A2.entries.find(x => x.id === 'rev:cl2');
  assert.equal(e2.posGl, 'pos'); assert.equal(e2.balanced, true); assert.equal(tb(A2)['1380'], 345);
  const P = E.buildPartners(org(), ops); assert.equal(P.find(p => p.key === CK).balance, -345); assert.equal(-custBal(P), tb(A)['1380']);
  const doc = E.arDocs(ops, org()).find(x => x.id === 'pos:o1'); assert.equal(E.siRem(ops, doc), 345);
  assert.equal(E.posArRefundMax(ops, sale()), 345, 'المرتجع التالي إلى الحساب لا يتجاوز المتبقي');
  const s = E.posDaySummary([ret()], 'b1', D2); assert.equal(s.credit, -115); assert.equal(s.cash, 0, 'لا يمس الدرج');
  const opt = E.posRefundOptions(sale()).find(x => x.m === 'credit'); assert.equal(opt.custKey, CK);
  // مرتجع إلى الحساب قبل ترحيل يومه: لا أثر في الدفتر ولا الكشف، لكنه يخفض أقصى مرتجع تالٍ على الجهاز
  const ops3 = { closings: [clo()], posOrders: [sale(), ret()] };
  assert.equal(E.buildPartners(org(), ops3).find(p => p.key === CK).balance, -460); assert.equal(E.posArRefundMax(ops3, sale()), 345);
});

test('إلغاء الفاتورة قبل الإغلاق: لا مستند ولا ذمة ولا آجل في الملخص', () => {
  const v = sale({ status: 'void' }); const ops = { closings: [clo({ cashSales: 0, creditSales: undefined, creditRows: undefined })], posOrders: [v] };
  assert.equal(E.arDocs(ops, org()).length, 0); assert.equal(E.posDaySummary([v], 'b1', D1).credit, undefined);
  assert.equal(E.buildPartners(org(), ops).find(p => p.key === CK).balance, 0); assert.equal(E.posCreditSnap(org(), ops, CK).unposted, 0);
});

test('سند قبض 460 مخصّص لـ pos: — مدين البنك دائن 1380 في قيد السند نفسه، والمتبقي صفر، والتخصيص لا يُكتب في الفاتورة', () => {
  const base = { closings: [clo()], posOrders: [sale()], salesInvoices: [], cashVouchers: [] };
  const docs = E.partyOpenDocs(org(), base, { t: 'cust', key: CK }); assert.deepEqual(docs.map(d => [d.id, d.rem, d.pos]), [['pos:o1', 460, true]]);
  const v = { id: 'v1', no: 'RV-000001', kind: 'rv', date: '2026-01-15', amount: 460, fund: '1201', pm: 'transfer', party: { t: 'cust', key: CK, name: 'عميل تجريبي' }, alloc: [{ id: 'pos:o1', no: docs[0].no, amount: 460 }], by: 'x', at: 'x' };
  const ops = E.applyCashVoucher(base, v, { name: 'x' });
  assert.deepEqual(ops.posOrders, base.posOrders, 'الفاتورة المختومة لم تُمس'); assert.equal(ops.salesInvoices.length, 0);
  const A = E.buildAccounting(org(), ops); const e = A.entries.find(x => x.id === 'cv:v1');
  assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]), [['1201', 460, 0], ['1380', 0, 460]]);
  const t = tb(A); assert.equal(t['1380'] || 0, 0);
  assert.equal(E.siRem(ops, E.arDocs(ops, org()).find(x => x.id === 'pos:o1')), 0);
  const c = E.buildPartners(org(), ops).find(p => p.key === CK); assert.equal(c.balance, 0);
  assert.equal(E.customerAging(c, '2026-01-20', true).total, 0); assert.deepEqual(E.partyOpenDocs(org(), ops, { t: 'cust', key: CK }), []);
  // تخصيص جزئي 200 + 100 على الحساب: قيد واحد 300، والمتبقي 260
  const ops2 = E.applyCashVoucher(base, { ...v, id: 'v2', amount: 300, alloc: [{ id: 'pos:o1', no: 'x', amount: 200 }] }, { name: 'x' });
  const e2 = E.buildAccounting(org(), ops2).entries.find(x => x.id === 'cv:v2'); assert.deepEqual(e2.lines.map(l => [l.code, l.debit, l.credit]), [['1201', 300, 0], ['1380', 0, 300]]);
  assert.equal(E.siRem(ops2, E.arDocs(ops2, org()).find(x => x.id === 'pos:o1')), 260);
});

test('الشطب (E6) على مستند الكاشير: eclCheck يجده ولا يتجاوز متبقيه', () => {
  const o = org({ ecl: { on: true, expAcc: '5810', allowAcc: '1381' }, customAccounts: [{ code: '5810', name: 'خسائر ائتمانية', kind: 'exp' }, { code: '1381', name: 'مخصص', kind: 'asset' }] });
  const ops = { closings: [clo()], posOrders: [sale()], eclDocs: [{ id: 'e0', kind: 'prov', customerKey: CK, amount: 1000, date: '2026-01-20', status: 'approved', reason: 'x', expAcc: '5810', allowAcc: '1381' }] };
  const wo = { id: 'e1', kind: 'wo', customerKey: CK, siId: 'pos:o1', amount: 100, date: '2026-01-25', reason: 'تعثر' };
  assert.equal(E.eclCheck(o, ops, wo), ''); assert.match(E.eclCheck(o, ops, { ...wo, amount: 500 }), /متبقي الفاتورة/);
  const ops2 = { ...ops, eclDocs: [...ops.eclDocs, { ...wo, status: 'approved', expAcc: '5810', allowAcc: '1381' }] };
  assert.equal(E.siRem(ops2, E.arDocs(ops2, o).find(x => x.id === 'pos:o1')), 360);
  const A = E.buildAccounting(o, ops2); assert.equal(A.entries.find(x => x.id === 'ecl:e1').branchId, 'b1');
  assert.equal(-custBal(E.buildPartners(o, ops2)), tb(A)['1380']);
});

test('الميزان متوازن و1380 = مجموع أرصدة العملاء في سيناريو مركّب (بيع، مرتجع، تحصيل جزئي، فاتورة مبيعات آجلة)', () => {
  const si = { id: 's1', kind: 'invoice', terms: 'credit', no: 'INV-1', customerKey: CK, date: '2026-01-11', total: 230, net: 200, vat: 30, receipts: [] };
  const ops = { closings: [clo(), clo({ id: 'cl2', date: D2, cashSales: 0, creditSales: -115, creditRows: [] })], posOrders: [sale(), ret()], salesInvoices: [si],
    cashVouchers: [{ id: 'v1', no: 'RV-1', kind: 'rv', date: '2026-01-15', amount: 100, fund: '1101', party: { t: 'cust', key: CK, name: 'x' }, alloc: [{ id: 'pos:o1', no: 'x', amount: 100 }] }] };
  const A = E.buildAccounting(org(), ops); const t = tb(A);
  assert.equal(r2(Object.values(t).reduce((a, x) => a + x, 0)), 0, 'الميزان متوازن'); assert.ok(A.entries.every(e => e.balanced));
  assert.equal(t['1380'], 475, '460 − 115 − 100 + 230'); assert.equal(-custBal(E.buildPartners(org(), ops)), t['1380']);
  const ck = E.closeAutoChecks(A, ops, '2026-01', org()).find(x => x.k === 'arsub'); assert.equal(ck.ok, true, 'فحص الإقفال: 1380 = السجل الفرعي');
  assert.equal(E.closeAutoChecks(A, ops, '2026-01', org({ posCfg: {} })).some(x => x.k === 'arsub'), false, 'الفحص مع التفعيل فقط');
});

test('دالة التفويض: تتجاوز الحد ⇒ رفض؛ الحجز يُحتسب؛ حجزان متزامنان لا يتجاوزان الحد؛ الطلب نفسه لا يُحجز مرتين؛ الحجز القديم وما وصلت فاتورته يسقطان', () => {
  const snap = { limit: 1000, terms: 30, posted: 300, unposted: 200, orderIds: ['old'] }; const now = Date.parse('2026-01-10T10:00:00Z');
  let d = creditDecide({ snap, orderId: 'a', amount: 600, date: D1, now }); assert.equal(d.ok, false); assert.match(d.why, /المتاح 500\.00/);
  d = creditDecide({ snap, orderId: 'a', amount: 460, date: D1, now }); assert.equal(d.ok, true); assert.equal(d.dueDate, '2026-02-09'); assert.equal(d.avail, 40);
  const holds = d.holds; assert.equal(holds.length, 1);
  const b = creditDecide({ snap, holds, orderId: 'b', amount: 100, date: D1, now: now + 1000 }); assert.equal(b.ok, false, 'الحجز الأول يُحتسب في التعرض');
  const again = creditDecide({ snap, holds, orderId: 'a', amount: 460, date: D1, now: now + 2000 }); assert.equal(again.ok, true); assert.equal(again.again, true); assert.equal(again.authId, d.authId);
  assert.equal(creditDecide({ snap, holds, orderId: 'a', amount: 461, date: D1, now }).ok, false, 'الطلب نفسه بمبلغ آخر');
  assert.equal(creditDecide({ snap, holds, orderId: 'b', amount: 100, date: D1, now: now + 25 * 3600e3 }).ok, true, 'الحجز الأقدم من 24 ساعة يسقط');
  assert.equal(creditDecide({ snap: { ...snap, orderIds: ['a'] }, holds, orderId: 'b', amount: 100, date: D1, now }).ok, true, 'وصلت فاتورته ⇒ في غير المرحّل لا في الحجز');
  assert.equal(creditDecide({ snap: { ...snap, limit: 0 }, orderId: 'z', amount: 1, date: D1, now }).ok, false);
  assert.equal(creditAuthInput({ orderId: 'po_1', branchId: 'b1', customerKey: CK, amount: 10.5, date: D1 }).err, undefined);
  for (const bad of [{ orderId: 'a/b' }, { amount: -1 }, { amount: '5' }, { amount: 1.005 }, { date: '2026-1-1' }, { x: 1 }]) assert.ok(creditAuthInput({ orderId: 'po_1', branchId: 'b1', customerKey: CK, amount: 10, date: D1, ...bad }).err, JSON.stringify(bad));
  assert.equal(memberInBranch({ active: true, branchId: 'b1' }, 'b1'), true); assert.equal(memberInBranch({ active: true, branchId: 'b2' }, 'b1'), false);
  assert.equal(memberInBranch({ active: true, branchIds: ['b1'] }, 'b1'), true); assert.equal(memberInBranch({ active: true, scope: 'all' }, 'b9'), true);
  assert.equal(memberInBranch({ active: false, scope: 'all' }, 'b1'), false); assert.equal(memberInBranch({}, 'b1', true), true);
  assert.equal(memberInBranch({ active: true, scope: 'all', role: 'accountant_view' }, 'b1'), false);
});

test('تفويض الخادم مع المحرك: غير المؤهل والمسجّل ضريبيًا يُرفضان؛ التعرض يشمل المرحّل وغير المرحّل', () => {
  const ops = { closings: [clo()], posOrders: [sale(), sale({ id: 'o2', date: D2 })] };
  const s = E.posCreditSnap(org(), ops, CK); assert.deepEqual([s.limit, s.terms, s.posted, s.unposted], [1000, 30, 460, 460]);
  assert.equal(creditDecide({ snap: s, orderId: 'n', amount: 81, date: D2, now: 0 }).ok, false); assert.equal(creditDecide({ snap: s, orderId: 'n', amount: 80, date: D2, now: 0 }).ok, true);
  assert.match(E.posCreditSnap(org({ partners: [cust({ tax: '300000000000003' })] }), ops, CK).err, /ضريبيًا/);
  assert.match(E.posCreditSnap(org({ partners: [cust({ posCredit: false })] }), ops, CK).err, /غير مؤهل/);
  assert.match(E.posCreditSnap(org(), ops, 'cust:zz').err, /غير موجود/);
});

/* ===== المسار /api/pos/credit-auth — خادم Firestore وهمي يحترم المعاملات (تعارض الإصدار ⇒ ABORTED) ===== */
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
const SA = JSON.stringify({ client_email: 'ops@test-prod.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), project_id: 'test-prod' });
const ENV = { FIREBASE_API_KEY: 'AIzaSy' + 'a'.repeat(33), FIREBASE_PROJECT_ID: 'test-prod', FIREBASE_SERVICE_ACCOUNT: SA };
function harness({ env = ENV, data = null } = {}) {
  let loads = 0;
  const routes = {}; const app = { post: (p, ...h) => (routes[p] = h) };
  const users = { cash: { email: 'c@test.sa', role: 'cashier', tenant: 'default' }, other: { email: 'o@test.sa', role: 'cashier', tenant: 'default' }, view: { email: 'v@test.sa', role: 'accountant_view', tenant: 'default' }, fin: { email: 'f@test.sa', role: 'finance_department', tenant: 'default' } };
  const requireMember = (req, res, next) => { const u = users[req.who]; if (!u) return res.status(401).json({ error: 'يلزم تسجيل الدخول' }); req.user = u; next(); };
  const F = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(x => ({ stringValue: x })) } } : { stringValue: String(v) }])) });
  const db = { 'members/c@test.sa': { ...F({ active: true, branchId: 'b1', role: 'cashier' }), v: 1 }, 'members/o@test.sa': { ...F({ active: true, branchId: 'b2', role: 'cashier' }), v: 1 },
    'members/v@test.sa': { ...F({ active: true, scope: 'all', role: 'accountant_view' }), v: 1 }, 'members/f@test.sa': { ...F({ active: true, scope: 'all', role: 'finance_department' }), v: 1 }, 'platform/admins': { ...F({ emails: [] }), v: 1 } };
  const txReads = {}; let txn = 0;
  const fetchImpl = async (u, i = {}) => {
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (u.includes('oauth2')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (u.endsWith(':beginTransaction')) { const t = 'TX' + (++txn); txReads[t] = {}; return ok({ transaction: t }); }
    if (u.endsWith(':rollback')) return ok({});
    if (u.endsWith(':batchGet')) return ok(JSON.parse(i.body).documents.map(n => { const k = n.split('/documents/')[1]; return db[k] ? { found: { name: n, fields: db[k].fields } } : { missing: n }; }));
    if (u.endsWith(':commit')) { const b = JSON.parse(i.body); const R = txReads[b.transaction] || {};
      if (Object.entries(R).some(([k, v]) => ((db[k] || {}).v || 0) !== v)) return { ok: false, status: 409, json: async () => ({ error: { status: 'ABORTED' } }) };
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1]; if (w.currentDocument && w.currentDocument.exists === false && db[k]) return { ok: false, status: 409, json: async () => ({ error: { status: 'ALREADY_EXISTS' } }) }; }
      for (const w of b.writes) { const k = w.update.name.split('/documents/')[1]; db[k] = { fields: { ...w.update.fields, ...(w.updateTransforms ? { at: { timestampValue: 'NOW' } } : {}) }, v: ((db[k] || {}).v || 0) + 1 }; } return ok({}); }
    const [p0, qs] = (u.split('/documents/')[1] || '').split('?'); const k = decodeURIComponent(p0);
    const tx = qs && /transaction=([^&]+)/.exec(qs); if (tx) { txReads[decodeURIComponent(tx[1])][k] = (db[k] || {}).v || 0; await new Promise(r => setTimeout(r, 5)); }
    return db[k] ? ok(db[k]) : { ok: false, status: 404, json: async () => ({}) };
  };
  const D = data || { org: org(), ops: { closings: [clo()], posOrders: [sale()] } };
  mountPosCredit(app, { express: { json: () => (q, r, n) => n() }, requireMember, rateLimit: () => (q, r, n) => n(), T: loadTenants(env), fetchImpl, log: { log() {}, error() {} }, engine: E, loader: async () => { loads++; return D; }, orgLoader: async () => D.org, now: () => Date.parse('2026-01-12T10:00:00Z') });
  const call = async (who, body, route = '/api/pos/credit-auth') => { const req = { who, body }; const out = { status: 200 };
    const res = { status(c) { out.status = c; return this; }, json(j) { out.json = j; return this; } };
    for (const h of routes[route]) { let go = false; await h(req, res, () => { go = true; }); if (!go) break; } return out; };
  return { call, db, loads: () => loads };
}
const body = (x = {}) => ({ orderId: 'po_n1', branchId: 'b1', customerKey: CK, amount: 300, date: D2, ...x });

test('المسار: 401 بلا هوية، 400 لمدخل خاطئ، 403 لغير عضو الفرع وللعرض فقط، 200 مع الاستحقاق والحجز، 422 عند تجاوز الحد، وعدم التكرار', async () => {
  const H = harness();
  assert.equal((await H.call('nobody', body())).status, 401);
  assert.equal((await H.call('cash', body({ amount: 'x' }))).status, 400);
  assert.equal((await H.call('cash', body({ extra: 1 }))).status, 400);
  assert.equal((await H.call('other', body())).status, 403, 'عضو فرع آخر');
  assert.equal((await H.call('view', body())).status, 403, 'العرض فقط');
  let r = await H.call('cash', body()); assert.equal(r.status, 200); assert.equal(r.json.ok, true); assert.equal(r.json.dueDate, '2026-02-11'); assert.equal(r.json.avail, 240); assert.match(r.json.authId, /^ca_/);
  const r2_ = await H.call('cash', body()); assert.equal(r2_.json.authId, r.json.authId, 'الطلب نفسه ⇒ الحجز نفسه');
  r = await H.call('cash', body({ orderId: 'po_n2', amount: 241 })); assert.equal(r.status, 422); assert.match(r.json.error, /حد الائتمان/);
  r = await H.call('cash', body({ customerKey: 'cust:none' })); assert.equal(r.status, 422);
  assert.equal((await harness({ env: { FIREBASE_API_KEY: ENV.FIREBASE_API_KEY, FIREBASE_PROJECT_ID: 'test-prod' } }).call('cash', body())).status, 409);
  { const Hoff = harness({ data: { org: org({ posCfg: {} }), ops: {} } }); assert.equal((await Hoff.call('cash', body())).status, 409, 'المفتاح مطفأ'); assert.equal(Hoff.loads(), 0, 'الرفض قبل التحميل الثقيل'); }
  // السجل الدائم: يُكتب مع الحجز، والطلب نفسه لعميل أو مبلغ آخر يُرفض حتى بعد سقوط الحجز
  const L = H.db['pos_credit_log/po_n1']; assert.ok(L); assert.equal(L.fields.amount.doubleValue, 300); assert.equal(L.fields.customerKey.stringValue, CK); assert.equal(L.fields.by.stringValue, 'c@test.sa'); assert.equal(L.fields.at.timestampValue, 'NOW');
  Object.keys(H.db).filter(k => k.startsWith('pos_credit/')).forEach(k => { delete H.db[k]; });
  assert.equal((await H.call('cash', body({ amount: 200 }))).status, 409, 'لا يُعاد تفويض الطلب نفسه بمبلغ آخر');
  r = await H.call('cash', body()); assert.equal(r.status, 200); assert.equal(r.json.authId, r2_.json.authId, 'من السجل الدائم');
});

test('المسار: حجزان متزامنان لنفس العميل لا يتجاوزان الحد معًا (المعاملة تُعاد عند التعارض)', async () => {
  const H = harness();
  const [a, b] = await Promise.all([H.call('cash', body({ orderId: 'po_a', amount: 300 })), H.call('cash', body({ orderId: 'po_b', amount: 300 }))]);
  assert.deepEqual([a.status, b.status].sort(), [200, 422], 'المتاح 540 يكفي أحدهما فقط');
  const doc = Object.entries(H.db).find(([k]) => k.startsWith('pos_credit/'))[1];
  assert.equal(JSON.parse(doc.fields.holds.stringValue).length, 1);
});

test('تحميل بيانات التفويض: فواتير نقطة البيع الآجلة وحدها (من مستند الفرع ومستنداته الشهرية)، والسلوك الافتراضي كما هو', async () => {
  const { loadPlatformData } = await import('../server-mcp.js');
  const enc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? { integerValue: String(v) } : { stringValue: String(v) }]));
  const cr = (id) => ({ id, payments: [{ m: 'credit', amount: 5, custKey: CK }] }), cash = (id) => ({ id, payments: [{ m: 'cash', amount: 5 }] });
  const M = { rms8_org: { parts: 1, value: JSON.stringify({ branches: [{ id: 'b1' }], posCfg: { credit: true } }) }, rms8_core: { parts: 1, value: JSON.stringify({ closings: [] }) },
    rms8_br_b1: { parts: 1, value: JSON.stringify({ closings: [{ id: 'c1' }], posOrders: [cr('p1'), cash('p2')], posMonths: ['202601'] }) },
    rms8_pos_b1_202601: { parts: 1, value: JSON.stringify({ orders: [cr('p3'), cash('p4')] }) } };
  const urls = []; const get = async (u, i) => { urls.push(i.body); return { ok: true, status: 200, j: JSON.parse(i.body).documents.map(n => { const id = n.split('/').pop(); return M[id] ? { found: { name: n, fields: enc(M[id]) } } : { missing: n }; }) }; };
  const base = 'https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents';
  const D = await loadPlatformData(base, get, Date.now, { posCredit: true });
  assert.deepEqual(D.ops.posOrders.map(o => o.id).sort(), ['p1', 'p3']); assert.deepEqual(D.ops.closings.map(c => c.id), ['c1']);
  urls.length = 0; const D0 = await loadPlatformData(base, get);
  assert.equal(D0.ops.posOrders, undefined, 'الموصل كما كان'); assert.ok(!urls.some(b => /pos_b1/.test(b)));
});

test('تحقق محاسبي (1): يوم إجماليه صفر وفيه آجل — بيع نقدي 46 ومرتجع 46 إلى الحساب ⇒ مدين الصندوق 46 / دائن 1380 46', () => {
  const s46 = sale({ id: 'o9', no: 'ف9', date: D2, total: 46, vat: 6, net: 40, payments: [{ m: 'cash', amount: 46 }], ar: undefined });
  const r46 = ret({ id: 'r9', date: D2, total: -46, vat: -6, net: -40, payments: [{ m: 'credit', amount: -46, custKey: CK, custName: 'عميل تجريبي' }] });
  for (const o of [org(), org({ posGl: { on: true, from: '2026-01-01' } })]) {
    const ops = { closings: [clo(), clo({ id: 'cl9', date: D2, cashSales: 46, creditSales: -46, creditRows: [] })], posOrders: [sale(), s46, r46] };
    const A = E.buildAccounting(o, ops); const e = A.entries.find(x => x.id === 'rev:cl9'); assert.ok(e, 'قيد اليوم'); assert.equal(e.balanced, true);
    assert.deepEqual(e.lines.map(l => [l.code, l.debit, l.credit]).filter(l => l[1] || l[2]), [['1111', 46, 0], ['1380', 0, 46]]);
    assert.equal(tb(A)['1380'], 414); assert.equal(-custBal(E.buildPartners(o, ops)), 414);
  }
});

test('تحقق محاسبي (3): لا سطر بمبلغ سالب في قيد يوم فيه آجل (نقد سالب يُقلب دائنًا) — والقيود بلا آجل كما هي', () => {
  const ops = { closings: [clo(), clo({ id: 'cl8', date: D2, cashSales: -100, creditSales: 50, creditRows: [] })], posOrders: [sale()] };
  const e = E.buildAccounting(org(), ops).entries.find(x => x.id === 'rev:cl8'); assert.equal(e.balanced, true);
  assert.ok(e.lines.every(l => l.debit >= 0 && l.credit >= 0)); assert.deepEqual(e.lines.find(l => l.code === '1111'), { ...e.lines.find(l => l.code === '1111'), debit: 0, credit: 100 });
  const old = E.buildAccounting(org(), { closings: [{ id: 'k', branchId: 'b1', date: D2, status: 'submitted', cashSales: -20, cardSales: 100, deliverySales: [], expenses: [] }] }).entries.find(x => x.id === 'rev:k');
  assert.equal(old.lines.find(l => l.code === '1111').debit, -20, 'القديم بلا آجل حرفيًا كما كان');
});

test('تحقق محاسبي (2، 4، 5): لا إلغاء لفاتورة آجلة بعد ترحيل يومها؛ وسم الأهلية مع التفعيل فقط؛ تخصيص سند لغير عميل المستند يبقى على الحساب', () => {
  const opsOpen = { closings: [], posOrders: [sale()], posShifts: [] };
  assert.equal(E.posVoidBlock(opsOpen, sale()), '');
  assert.match(E.posVoidBlock({ ...opsOpen, closings: [clo()] }, sale()), /مرتجعًا إلى حساب العميل/);
  assert.equal(E.posVoidBlock({ ...opsOpen, closings: [clo({ status: 'draft' })] }, sale()), '', 'المسودة لا تمنع');
  assert.equal(E.posVoidBlock({ ...opsOpen, closings: [clo()] }, sale({ payments: [{ m: 'cash', amount: 1150 }], ar: undefined })), '', 'غير الآجلة كما كانت');
  assert.equal(E.buildPartners(org({ posCfg: {} }), {}).find(p => p.key === CK).posCredit, undefined);
  assert.equal(E.buildPartners(org(), {}).find(p => p.key === CK).posCredit, true);
  const o2 = org({ partners: [cust(), cust({ id: 'c2', key: 'cust:c2', name: 'عميل آخر' })] });
  const ops = { closings: [clo()], posOrders: [sale()], cashVouchers: [{ id: 'vx', no: 'RV-9', kind: 'rv', date: '2026-01-15', amount: 100, fund: '1101', party: { t: 'cust', key: 'cust:c2', name: 'عميل آخر' }, alloc: [{ id: 'pos:o1', no: 'x', amount: 100 }] }] };
  assert.equal(E.siRem(ops, E.arDocs(ops, o2).find(x => x.id === 'pos:o1')), 460, 'لم يُخصم من مستند عميل آخر');
  const P = E.buildPartners(o2, ops); assert.equal(P.find(p => p.key === CK).balance, -460); assert.equal(P.find(p => p.key === 'cust:c2').balance, 100, 'على حساب الطرف');
  const A = E.buildAccounting(o2, ops); assert.deepEqual(A.entries.find(x => x.id === 'cv:vx').lines.map(l => [l.code, l.debit, l.credit]), [['1101', 100, 0], ['1380', 0, 100]]);
  assert.ok(P.find(p => p.key === 'cust:c2').txns.some(t => /على الحساب/.test(t.desc) && t.credit === 100 && !t.sid), 'سطر «على الحساب» بلا ربط بمستند');
  assert.equal(-custBal(P), tb(A)['1380']);
});

test('أمن (7، 8): مقارنة السجل الدائم بالفواتير — بلا تفويض، مبلغ أكبر، عميل مختلف؛ وسقف الحجوزات للعميل والمستخدم', () => {
  const logs = { o1: { amount: 460, customerKey: CK, branchId: 'b1' }, o2: { amount: 100, customerKey: CK, branchId: 'b1' }, o3: { amount: 460, customerKey: 'cust:zz', branchId: 'b1' } };
  const os = [sale(), sale({ id: 'o2', no: 'n2' }), sale({ id: 'o3', no: 'n3' }), sale({ id: 'o4', no: 'n4' }), sale({ id: 'o5', no: 'n5', status: 'void' }), ret(), sale({ id: 'o6', no: 'n6', date: '2026-03-01' })];
  const X = creditExceptions(os, logs, { from: '2026-01-01', to: '2026-01-31' });
  assert.deepEqual(X.map(x => [x.orderId, x.why]), [['o2', 'over'], ['o3', 'cust'], ['o4', 'noauth']]);
  assert.equal(X[0].authAmount, 100); assert.equal(X[0].amount, 460);
  const snap = { limit: 1e6, terms: 0, posted: 0, unposted: 0, orderIds: [] }; const now = 1e12;
  const many = Array.from({ length: HOLD_CAP_CUST }, (_, i) => ({ id: 'h' + i, amount: 1, at: now, by: 'u' + (i % 5) }));
  assert.match(creditDecide({ snap, holds: many, orderId: 'n', amount: 1, date: D1, now, by: 'x' }).why, /كثيرة على هذا العميل/);
  const mine = Array.from({ length: HOLD_CAP_USER }, (_, i) => ({ id: 'm' + i, amount: 1, at: now, by: 'x' }));
  assert.match(creditDecide({ snap, holds: mine, orderId: 'n', amount: 1, date: D1, now, by: 'x' }).why, /هذا المستخدم/);
  assert.equal(creditDecide({ snap, holds: mine, orderId: 'n', amount: 1, date: D1, now, by: 'y' }).ok, true);
  assert.equal(creditDecide({ snap, holds: mine, orderId: 'n', amount: 1, date: D1, now: now + 25 * 3600e3, by: 'x' }).ok, true, 'الحجوزات المنتهية لا تُعد');
});

test('المسار /api/pos/credit-exceptions: للأدوار المالية المركزية فقط، والفترة مُتحقَّق منها، والقائمة من السجل الدائم', async () => {
  const D = { org: org({ partners: [cust({ creditLimit: 5000 })] }), ops: { closings: [], posOrders: [sale({ id: 'po_n1', date: D2 }), sale({ id: 'po_forged', no: 'مزوّرة', date: D2 })] } };
  const H = harness({ data: D });
  assert.equal((await H.call('cash', body({ orderId: 'po_n1', amount: 460 }))).status, 200);
  const X = (who, b) => H.call(who, b, '/api/pos/credit-exceptions');
  assert.equal((await X('nobody', { from: D1, to: D2 })).status, 401);
  assert.equal((await X('cash', { from: D1, to: D2 })).status, 403, 'الكاشير');
  assert.equal((await X('view', { from: D1, to: D2 })).status, 403, 'العرض فقط');
  assert.equal((await X('fin', { from: D2, to: D1 })).status, 400); assert.equal((await X('fin', { from: D1, to: D2, x: 1 })).status, 400);
  assert.equal((await X('fin', { from: '2025-01-01', to: '2026-03-01' })).status, 400, 'أطول من سنة');
  const r = await X('fin', { from: D1, to: D2 }); assert.equal(r.status, 200); assert.equal(r.json.checked, 2);
  assert.deepEqual(r.json.exceptions.map(x => [x.orderId, x.why]), [['po_forged', 'noauth']]);
});
