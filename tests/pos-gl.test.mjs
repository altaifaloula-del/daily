/**
 * v56.18 — MUKTASAB POS المرحلة 6a: أثر فواتير نقطة البيع في قيد إيراد الوردية (قرارات المالك — DECISION_LOG 74–75).
 * الأرقام المتوقعة محسوبة يدويًا (مثال رئيس المحاسبين: فاتورة 115 بخصم عرض، وفاتورة 45 باستبدال 10 نقاط، وقيمة النقطة 0.10 شاملة).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const tb = (A) => { const t = {}; A.entries.forEach(e => e.lines.forEach(l => { t[l.code] = Math.round(((t[l.code] || 0) + l.debit - l.credit) * 100) / 100; })); return t; };
const D = '2026-11-20';
// فاتورة 1: إجمالي 126.50، خصم عرض 11.50 ⇒ 115 (ضريبة 15)، ومنحت 10 نقاط · فاتورة 2: إجمالي 46، استبدال 10 نقاط = 1.00 ⇒ 45 (ضريبة 5.87)
const o1 = { id: 'o1', branchId: 'b1', date: D, status: 'paid', gross: 126.5, disc: 11.5, total: 115, vat: 15, net: 100, rate: 15, loyalty: { phone: '5', earned: 10, redeemed: 0, redeemAmt: 0 } };
const o2 = { id: 'o2', branchId: 'b1', date: D, status: 'paid', gross: 46, disc: 1, total: 45, vat: 5.87, net: 39.13, rate: 15, loyalty: { phone: '5', earned: 0, redeemed: 10, redeemAmt: 1 } };
const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: true, rate: 15 }, loyaltyCfg: { ptValue: 0.1 }, ...x });
const clo = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'العليا', date: D, status: 'approved', cashSales: 160, ...x });

test('تفصيل اليوم: الضريبة من الفواتير، والخصم والاستبدال والنقاط بعد استبعاد الضريبة', () => {
  const d = E.posGlDay([o1, o2, { ...o1, id: 'v', status: 'void' }, { ...o1, id: 'x', branchId: 'b2' }], 'b1', D, 0.1, 15);
  assert.deepEqual([d.n, d.total, d.vat, d.disc, d.redeem, d.earn], [2, 160, 20.87, 10, 0.87, 0.87]);
});

test('القيد مع التفعيل: المبيعات بالإجمالي، الخصم في 4104، الاستبدال يُطفئ 2106، والنقاط الممنوحة التزام — والقيد متوازن', () => {
  const A = E.buildAccounting(org({ posGl: { on: true, from: '2026-11-01' } }), { closings: [clo()], posOrders: [o1, o2] });
  const e = A.entries.find(x => x.id === 'rev:c1'); assert.equal(e.posGl, 'pos'); assert.equal(e.balanced, true);
  const t = tb(A);
  assert.equal(t['4101'], -149.13, 'إجمالي: صافي 139.13 + خصم 10 + استبدال 0.87 = 150 دائن، ناقص تأجيل النقاط 0.87');
  assert.equal(t['4104'], 10); assert.equal(t['2106'], 0); assert.equal(t['2301'], -20.87);
  assert.equal(e.vat.out, 20.87, 'سجل الضريبة من الفواتير');
  // الاستبدال بلا منح في اليوم نفسه: الالتزام ينخفض 0.87
  const B = E.buildAccounting(org({ posGl: { on: true, from: '2026-11-01' } }), { closings: [clo({ cashSales: 45 })], posOrders: [o2] });
  assert.equal(tb(B)['2106'], 0.87); assert.equal(tb(B)['4101'], -40, 'مثال رئيس المحاسبين: إيراد الوجبة الثانية 40.00');
});

test('بلا تفعيل، أو قبل تاريخه، أو إجمالي غير مطابق ⇒ القيد كما كان تمامًا (توافق رجعي)', () => {
  const old = tb(E.buildAccounting(org(), { closings: [clo()], posOrders: [o1, o2] }));
  assert.equal(old['4101'], -139.13); assert.equal(old['2301'], -20.87); assert.equal(old['4104'], undefined);
  const before = E.buildAccounting(org({ posGl: { on: true, from: '2026-11-25' } }), { closings: [clo()], posOrders: [o1, o2] });
  assert.deepEqual(tb(before), old); assert.equal(before.entries.find(x => x.id === 'rev:c1').posGl, undefined);
  const mm = E.buildAccounting(org({ posGl: { on: true, from: '2026-11-01' } }), { closings: [clo({ cashSales: 170 })], posOrders: [o1, o2] });
  assert.equal(mm.entries.find(x => x.id === 'rev:c1').posGl, 'mismatch'); assert.equal(tb(mm)['4104'], undefined);
  const chk = E.posGlCheck(org({ posGl: { on: true, from: '2026-11-01' } }), { closings: [clo(), clo({ id: 'c2', cashSales: 170 })], posOrders: [o1, o2] });
  assert.deepEqual(chk.map(x => [x.id, x.ok]), [['c1', true], ['c2', false]]);
});

test('المرتجع يخفض المبيعات والضريبة، والنقاط المسترجعة تخفض الالتزام', () => {
  const r = { id: 'r1', kind: 'return', refId: 'o1', branchId: 'b1', date: D, status: 'paid', total: -57.5, vat: -7.5, net: -50, loyalty: { phone: '5', ded: 5 } };
  const d = E.posGlDay([o1, r], 'b1', D, 0.1, 15);
  assert.deepEqual([d.retN, d.total, d.vat, d.earn], [1, 57.5, 7.5, 0.44], 'منح 0.87 − استرجاع 5 نقاط 0.43 = 0.44');
  const A = E.buildAccounting(org({ posGl: { on: true, from: '2026-11-01' } }), { closings: [clo({ cashSales: 57.5 })], posOrders: [o1, r] });
  const e = A.entries.find(x => x.id === 'rev:c1'); assert.equal(e.balanced, true); assert.equal(tb(A)['2106'], -0.44);
});

test('مراجعة رئيس المحاسبين (1): الإيقاف يغلق النطاق ولا يعيد كتابة ما قبله — والتفعيل الثاني نطاق جديد', () => {
  const ops = { closings: [clo(), clo({ id: 'c2', date: '2026-11-28', cashSales: 160 })], posOrders: [o1, o2, { ...o1, id: 'p1', date: '2026-11-28' }, { ...o2, id: 'p2', date: '2026-11-28' }] };
  const A = E.buildAccounting(org({ posGl: { ranges: [{ from: '2026-11-01', to: '2026-11-25' }] } }), ops);
  assert.equal(A.entries.find(x => x.id === 'rev:c1').posGl, 'pos', 'داخل النطاق المغلق يبقى بقيد نقطة البيع');
  assert.equal(A.entries.find(x => x.id === 'rev:c2').posGl, undefined, 'بعد الإيقاف بالطريقة السابقة');
  assert.ok(A.accounts.some(a => a.code === '4104'), 'الحسابان باقيان بعد الإيقاف');
});

test('مراجعة رئيس المحاسبين (2): قيمة النقطة من الفاتورة — تغيير الإعداد لا يغيّر الماضي', () => {
  const p1 = { ...o1, loyalty: { ...o1.loyalty, pv: 0.1 } };
  const g = { posGl: { ranges: [{ from: '2026-11-01' }] } };
  const t1 = tb(E.buildAccounting(org({ ...g, loyaltyCfg: { ptValue: 0.1 } }), { closings: [clo({ cashSales: 115 })], posOrders: [p1] }));
  const t2 = tb(E.buildAccounting(org({ ...g, loyaltyCfg: { ptValue: 0.5 } }), { closings: [clo({ cashSales: 115 })], posOrders: [p1] }));
  assert.equal(t1['2106'], -0.87); assert.deepEqual(t2, t1, 'رفع قيمة النقطة لاحقًا لا يمس الفاتورة السابقة');
  // فاتورة قديمة بلا قيمة: تُستعمل لقطة التفعيل لا الإعداد الحالي
  const t3 = tb(E.buildAccounting(org({ posGl: { ranges: [{ from: '2026-11-01' }], pv: 0.1 }, loyaltyCfg: { ptValue: 0.5 } }), { closings: [clo({ cashSales: 115 })], posOrders: [o1] }));
  assert.equal(t3['2106'], -0.87);
  // المرتجع يأخذ قيمة نقطة فاتورته الأصلية
  const r = { id: 'r1', kind: 'return', refId: 'o1', branchId: 'b1', date: D, status: 'paid', total: -57.5, vat: -7.5, loyalty: { phone: '5', ded: 5 } };
  assert.equal(E.posGlDay([p1, r], 'b1', D, 0.5, 15).earn, 0.44);
});

test('فحص المطابقة يميّز «بلا فواتير» عن «غير مطابق»', () => {
  const chk = E.posGlCheck(org({ posGl: { ranges: [{ from: '2026-11-01' }] } }), { closings: [clo(), clo({ id: 'c2', cashSales: 170 }), clo({ id: 'c3', branchId: 'b2', cashSales: 50 })], posOrders: [o1, o2] });
  assert.deepEqual(chk.map(x => [x.id, x.st]), [['c1', 'ok'], ['c2', 'diff'], ['c3', 'none']]);
});
