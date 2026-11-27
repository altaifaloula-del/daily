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

test('(التحقق المستقل B3) جائزة صدرت قبل بدء 6a وسُلّمت بعده: في الرصيد الافتتاحي حتى تسليمها — لا تُطفأ مرتين', () => {
  const d = { tx: [{ id: 'o1:e', phone: '5', pts: 1000, at: at('2026-11-01') }, { id: 'rw:y1', phone: '5', pts: -200, at: at('2026-12-12') }] };
  const pr = [{ code: 'RWY', rwTx: 'rw:y1', to: '2027-01-30' }], ord = [{ id: 'q', date: '2026-12-20', coupon: 'RWY', status: 'paid' }];
  const op = E.posLoyOpening(org, d, '2026-12-15', { orders: ord, promos: pr });
  assert.equal(op.pts, 1000, '800 صافي + 200 جائزة لم تُسلَّم'); assert.equal(op.rwOpen, 200);
  const m = E.loyMonthAdj(org, d, '2026-12', { orders: ord, promos: pr, from: '2026-12-15' }); assert.equal(m.rwPts, 200, 'تُطفأ عند التسليم');
  // ⇒ الرصيد بعد التسليم = 800 نقطة كما في السجل
});

test('(التحقق المستقل) انتهاء مناسبة مُنحت قبل بدء 6a ⇒ إيراد (دخلت الرصيد الافتتاحي لا المصروف)', () => {
  const d = { tx: [{ id: 'bd:9:2025', phone: '9', pts: 50, at: at('2025-11-01') }, { id: 'ex:9:2026-12', phone: '9', pts: -50, at: at('2026-12-01') }] };
  const r = E.loyMonthAdj(org, d, '2026-12', { from: '2026-11-01' }); assert.deepEqual([r.expOccPts, r.expPts], [0, 50]);
});

test('v56.47 (قرار المالك): النقاط اليدوية مصروف تسويق — بلا تفعيل تنبيه فقط، ومع التفعيل الصافي (هدية − تصحيح)، وانتهاؤها يعكس المصروف', () => {
  const d = { tx: [{ id: 'la1', phone: '5', pts: 80, at: at('2026-12-02') }, { id: 'la2', phone: '5', pts: -20, at: at('2026-12-09') }] };
  const off = E.loyMonthAdj(org, d, '2026-12', { from: '2026-11-01' });
  assert.equal(off.manPts, 2); assert.equal(off.man, undefined);
  const on = E.loyMonthAdj(org, d, '2026-12', { from: '2026-11-01', manOn: true, manFrom: '2026-12' });
  assert.equal(on.manNetPts, 60); assert.equal(on.man, v(60));
  const d2 = { tx: [{ id: 'la1', phone: '5', pts: 80, at: at('2026-12-02') }, { id: 'ex:5:2027-01', phone: '5', pts: -80, at: at('2027-01-05') }] };
  const j = E.loyMonthAdj(org, d2, '2027-01', { from: '2026-11-01', manOn: true, manFrom: '2026-12' });
  assert.equal(j.expOccPts, 80, 'انتهاء اليدوية يعكس المصروف لا إيراد'); assert.equal(j.expPts, 0);
  const k = E.loyMonthAdj(org, d2, '2027-01', { from: '2026-11-01' });
  assert.equal(k.expPts, 80, 'بلا تفعيل كما كان: المنتهي إيراد');
});

test('v56.47 (التحقق المستقل): الإيقاف لا يمحو النطاق — انتهاء ما قُيّد مصروفًا يعكسه؛ والتصحيح السالب يُنقص الهدايا اليدوية أولًا', () => {
  const d = { tx: [{ id: 'la1', phone: '5', pts: 80, at: at('2026-12-02') }, { id: 'ex:5:2027-02', phone: '5', pts: -80, at: at('2027-02-05') }] };
  const j = E.loyMonthAdj(org, d, '2027-02', { from: '2026-11-01', manRanges: [{ from: '2026-12', to: '2027-01' }] });
  assert.equal(j.expOccPts, 80); assert.equal(j.expPts, 0);
  const d2 = { tx: [{ id: 'o1:e', phone: '5', pts: 100, at: at('2026-12-01') }, { id: 'la1', phone: '5', pts: 50, at: at('2026-12-02') }, { id: 'la2', phone: '5', pts: -30, at: at('2026-12-03') },
    { id: 'ex:5:2027-01', phone: '5', pts: -120, at: at('2027-01-05') }] };
  const k = E.loyMonthAdj(org, d2, '2027-01', { from: '2026-11-01', manRanges: [{ from: '2026-12' }] });
  assert.equal(k.expOccPts, 20, 'صافي الهدية 20 يعكس المصروف'); assert.equal(k.expPts, 100);
});
