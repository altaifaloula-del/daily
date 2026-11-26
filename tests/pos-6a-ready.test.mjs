/**
 * v56.33 — الدفعة 2 (قرارات المجلس P1/P2 بتفويض المالك): جاهزية 6a — رصيد النقاط القائم، والإغلاق غير المطابق.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const tb = (A) => { const t = {}; A.entries.forEach(e => e.lines.forEach(l => { t[l.code] = Math.round(((t[l.code] || 0) + l.debit - l.credit) * 100) / 100; })); return t; };
const D = '2026-12-05';
const o1 = { id: 'o1', branchId: 'b1', date: D, status: 'paid', gross: 126.5, disc: 11.5, total: 115, vat: 15, net: 100, rate: 15, loyalty: { phone: '5', earned: 10, redeemed: 0, redeemAmt: 0 } };
const org = (x = {}) => ({ company: { name: 'اختبار' }, branches: [{ id: 'b1', name: 'العليا', isActive: true }], taxCfg: { enabled: true, rate: 15 }, loyaltyCfg: { ptValue: 0.1 }, posGl: { ranges: [{ from: '2026-12-01' }], ...x } });
const clo = (x = {}) => ({ id: 'c1', branchId: 'b1', branchName: 'العليا', date: D, status: 'approved', cashSales: 120, ...x });   // 120 ≠ 115 ⇒ غير مطابق

test('P1: رصيد النقاط قبل تاريخ القطع × قيمة النقطة بعد استبعاد الضريبة', () => {
  const doc = { tx: [{ pts: 100, at: '2026-11-10T10:00:00Z' }, { pts: -15, at: '2026-11-20T10:00:00Z' }, { pts: 40, at: '2026-12-02T10:00:00Z' }] };
  const r = E.posLoyOpening(org(), doc, '2026-12-01');
  assert.equal(r.pts, 85); assert.equal(r.amt, Math.round(85 * 0.1 * 100 / 115 * 100) / 100);   // 7.39
  assert.equal(E.posLoyOpening(org({}), { tx: [] }, '2026-12-01').amt, 0);
});

test('P2: الإغلاق غير المطابق — بلا تفعيل كما كان؛ ومع التفعيل قيد حركة الولاء وحدها، والقيد متوازن', () => {
  const old = E.buildAccounting(org(), { closings: [clo()], posOrders: [o1] });
  const e0 = old.entries.find(x => x.id === 'rev:c1'); assert.equal(e0.posGl, 'mismatch'); assert.equal(tb(old)['2106'] || 0, 0);
  const A = E.buildAccounting(org({ misLoy: { from: '2026-12-01' } }), { closings: [clo()], posOrders: [o1] });
  const e = A.entries.find(x => x.id === 'rev:c1'); assert.equal(e.posLoy, true); assert.equal(e.balanced, true);
  const earn = Math.round(10 * 0.1 * 100 / 115 * 100) / 100;   // 0.87
  assert.equal(tb(A)['2106'], -earn); assert.equal(Math.round((tb(A)['4101'] - tb(old)['4101']) * 100) / 100, earn, 'نقل من الإيراد إلى الالتزام');
  // قبل تاريخ البدء أو بعد الإيقاف ⇒ كما كان
  assert.equal(E.buildAccounting(org({ misLoy: { from: '2026-12-06' } }), { closings: [clo()], posOrders: [o1] }).entries.find(x => x.id === 'rev:c1').posLoy, undefined);
  assert.equal(E.buildAccounting(org({ misLoy: { from: '2026-12-01', to: '2026-12-04' } }), { closings: [clo()], posOrders: [o1] }).entries.find(x => x.id === 'rev:c1').posLoy, undefined);
});

test('P2: قائمة الإقفال تكشف غير المطابق بلا شرح (داخل نطاق الولاء فقط)، والشرح يرفع المنع', () => {
  assert.equal(E.closeAutoChecks(E.buildAccounting(org(), { closings: [clo()], posOrders: [o1] }), {}, '2026-12', org()).some(c => c.k === 'posmis'), false, 'بلا تفعيل لا منع');
  const o = org({ misLoyRanges: [{ from: '2026-12-01' }] }); const A = E.buildAccounting(o, { closings: [clo()], posOrders: [o1] });
  const it = E.closeAutoChecks(A, {}, '2026-12', o).find(c => c.k === 'posmis'); assert.ok(it && it.n === 1 && !it.ok);
  const o2 = org({ misLoyRanges: [{ from: '2026-12-01' }], notes: { c1: 'فرق نقد مسلّم — محضر 12' } });
  assert.equal(E.closeAutoChecks(A, {}, '2026-12', o2).some(c => c.k === 'posmis'), false);
  assert.equal(E.closeAutoChecks(A, {}, '2026-12').some(c => c.k === 'posmis'), false, 'بلا org كما كان');
});

test('(التحقق المستقل) نطاقات الولاء: الإيقاف ثم إعادة التفعيل لا يغيّر ما سبق؛ والإغلاق بلا فواتير لا يمنع القفل', () => {
  const o = org({ misLoyRanges: [{ from: '2026-12-01', to: '2026-12-05' }, { from: '2026-12-20' }] });
  assert.equal(E.buildAccounting(o, { closings: [clo()], posOrders: [o1] }).entries.find(x => x.id === 'rev:c1').posLoy, true, 'النطاق الأول باقٍ');
  assert.equal(E.posMisLoyFrom(o), '2026-12-20');
  const o3 = org({ misLoyRanges: [{ from: '2026-12-01' }] }); const A = E.buildAccounting(o3, { closings: [clo({ id: 'c9' })], posOrders: [] });
  assert.equal(E.closeAutoChecks(A, {}, '2026-12', o3).some(c => c.k === 'posmis'), false, 'بلا فواتير لا منع');
});

test('(التحقق المستقل) P1 بالوقت المحلي: حركة فجر يوم القطع لا تُحتسب في الرصيد السابق', () => {
  const local0130 = new Date('2026-12-01T01:30:00').toISOString();   // فجر يوم القطع بالتوقيت المحلي
  const r = E.posLoyOpening(org(), { tx: [{ pts: 100, at: '2026-11-10T10:00:00Z' }, { pts: 10, at: local0130 }] }, '2026-12-01');
  assert.equal(r.pts, 100);
});
