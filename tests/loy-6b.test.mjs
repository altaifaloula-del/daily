/**
 * v56.34 — الدفعة 3 (ولاء 6ب، قرارات المجلس P5/P6/P7): تسوية الولاء الشهرية من سجل النقاط.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const org = { company: {}, branches: [], taxCfg: { enabled: true, rate: 15 }, loyaltyCfg: { ptValue: 0.1 }, posGl: { ranges: [{ from: '2026-11-01' }] } };
const at = (d) => new Date(d + 'T12:00:00').toISOString();
const doc = { tx: [
  { id: 'ex:5:2026-12', phone: '5', pts: -100, at: at('2026-12-01') },
  { id: 'bd:5:2026', phone: '5', pts: 50, at: at('2026-12-03') },
  { id: 'rf:7', phone: '5', pts: 30, at: at('2026-12-04') },
  { id: 'rw:x1', phone: '5', pts: -200, at: at('2026-12-05') },
  { id: 'rw:x2', phone: '5', pts: -40, at: at('2026-12-06') }, { id: 'rw:x2:undo', phone: '5', pts: 40, at: at('2026-12-06') },
  { id: 'o1:e', phone: '5', pts: 10, at: at('2026-12-07') },   // من الفواتير — يغطيها 6a لا هذه التسوية
  { id: 'ex:5:2026-11', phone: '5', pts: -999, at: at('2026-11-01') } ] };

const promos = [{ code: 'RWA', rwTx: 'rw:x1', to: '2027-01-20' }, { code: 'RWB', rwTx: 'rw:x2', to: '2026-12-31' }, { code: 'RWC', rwTx: 'rw:x3', to: '2026-12-15' }];
const doc2 = { tx: [...doc.tx, { id: 'rw:x3', phone: '5', pts: -60, at: at('2026-12-02') }] };
const orders = [{ id: 'p1', date: '2026-12-10', coupon: 'rwa', status: 'paid' }];
const v = (p) => Math.round(p * 0.1 * 100 / 115 * 100) / 100;

test('6ب: المنتهية والمناسبات للشهر، والجائزة عند تسليمها (استعمال الكوبون أو انتهاؤه)، والملغاة لا تُحتسب', () => {
  const r = E.loyMonthAdj(org, doc2, '2026-12', { orders, promos, from: '2026-11-01' });
  assert.deepEqual([r.expPts + r.expOccPts, r.occPts], [100, 80]);
  assert.equal(r.rwPts, 200 + 60, 'RWA مستعمل في ديسمبر + RWC انتهى في ديسمبر بلا استعمال؛ RWB أُلغي');
  assert.deepEqual([r.occ, r.rw], [v(80), v(260)]);
});

test('(التحقق المستقل) P5: انتهاء نقاط المناسبات يعكس المصروف لا يصبح إيرادًا', () => {
  const d = { tx: [{ id: 'bd:9:2026', phone: '9', pts: 50, at: at('2025-11-01') }, { id: 'o9:e', phone: '9', pts: 30, at: at('2025-12-01') }, { id: 'ex:9:2026-12', phone: '9', pts: -60, at: at('2026-12-01') }] };
  const r = E.loyMonthAdj(org, d, '2026-12', { from: '2025-01-01' });
  assert.deepEqual([r.expOccPts, r.expPts], [50, 10], 'الأقدم أولًا: 50 من المناسبة ثم 10 من الشراء');
});

test('(التحقق المستقل) لا عدّ مزدوج في شهر بدء النطاق: ما قبل البداية في الرصيد الافتتاحي', () => {
  const r = E.loyMonthAdj(org, doc, '2026-12', { from: '2026-12-04' });
  assert.equal(r.expPts + r.expOccPts, 0, 'الانتهاء في 12-01 قبل البداية'); assert.equal(r.occPts, 30, 'الإحالة 12-04 فقط');
});

test('6ب: شهر بلا حركات ⇒ أصفار', () => {
  const r = E.loyMonthAdj(org, doc, '2027-02', { orders, promos }); assert.deepEqual([r.exp, r.occ, r.rw, r.expOcc], [0, 0, 0, 0]);
});
