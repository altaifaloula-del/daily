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

test('6ب: المنتهية والمناسبات والجوائز للشهر فقط، بالقيمة بعد استبعاد الضريبة', () => {
  const r = E.loyMonthAdj(org, doc, '2026-12');
  assert.deepEqual([r.expPts, r.occPts, r.rwPts], [100, 80, 200], 'الجائزة الملغاة تُطرح، وحركات الفواتير وشهر آخر لا تدخل');
  const v = (p) => Math.round(p * 0.1 * 100 / 115 * 100) / 100;
  assert.deepEqual([r.exp, r.occ, r.rw], [v(100), v(80), v(200)]);
});

test('6ب: شهر بلا حركات ⇒ أصفار', () => {
  const r = E.loyMonthAdj(org, doc, '2027-01'); assert.deepEqual([r.exp, r.occ, r.rw], [0, 0, 0]);
});
