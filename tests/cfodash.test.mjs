/* v54.3 — المرحلة 4: لوحة المدير المالي — درجات بمنهجية ومدخلات، الفروع، الحالات، الوفر المتوقع مقابل الفعلي، والتوقع بمنهجية معلنة */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const J = (id, date, lines, extra = {}) => ({ id, date, title: id, status: 'posted', lines: lines.map(([code, debit, credit]) => ({ code, debit, credit })), ...extra });
const org = { taxCfg: { enabled: false }, branches: [{ id: 'b1', name: 'طيبة' }, { id: 'b2', name: 'النسيم' }] };
const sales = (ym, v, b) => J('s' + ym + b, ym + '-10', [['1101', v, 0], ['4101', 0, v]], { branchId: b });
const cost = (ym, v, b) => J('c' + ym + b, ym + '-11', [['5198', v, 0], ['1101', 0, v]], { branchId: b });
const ops = { journalManual: [J('open', '2025-12-31', [['1101', 50000, 0], ['3101', 0, 50000]], { opening: true }),
  ...['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].flatMap((ym, i) => [sales(ym, 10000 + i * 1000, 'b1'), cost(ym, 6000, 'b1'), sales(ym, 5000, 'b2'), cost(ym, 4000, 'b2')])],
  ctlCases: [{ id: 'c1', status: 'new', sev: 'high', impact: 500 }, { id: 'c2', status: 'closed', sev: 'critical' }] };

test('الدرجات: لكل درجة معادلة ومدخلات، والصحة متوسط المتاح', () => {
  const D = E.cfoDash(org, ops, { from: '2026-01-01', to: '2026-06-30', today: '2026-07-05' });
  const g = Object.fromEntries(D.scores.map(x => [x.id, x]));
  // صافي المبيعات 105,000 (b1: 75,000 · b2: 30,000) · التكلفة 60,000 ⇒ الصافي 45,000 ⇒ هامش 42.86% ⇒ الربحية 100
  assert.equal(D.statements.netSales, 105000); assert.equal(g.profit.value, 100); assert.ok(g.profit.formula && g.profit.inputs);
  assert.equal(g.control.value, 90, 'حالة عالية مفتوحة = 10 نقاط؛ المغلقة لا تُحسب');
  assert.equal(g.efficiency.value, 100); assert.ok(g.health.value != null); assert.ok(g.health.used.length >= 2);
});

test('الفروع: الشركة ← الفرع بأرقام تطابق المجموع', () => {
  const D = E.cfoDash(org, ops, { from: '2026-01-01', to: '2026-06-30', today: '2026-07-05' });
  const b = Object.fromEntries(D.branches.map(x => [x.name, x])); assert.equal(b['طيبة'].netSales, 75000); assert.equal(b['النسيم'].netSales, 30000);
  assert.equal(b['طيبة'].netSales + b['النسيم'].netSales, D.statements.netSales); assert.equal(b['النسيم'].gm, 20);
});

test('التوقع: متوسط 3 أشهر ± الانحراف، والتوقع مقابل الفعلي للشهر الماضي', () => {
  const D = E.cfoDash(org, ops, { from: '2026-01-01', to: '2026-06-30', today: '2026-07-05' });
  assert.equal(D.forecast.next.month, '2026-07'); assert.equal(D.forecast.next.base, 19000);   // (19,000+20,000+18,000... ) أبريل 18,000 مايو 19,000 يونيو 20,000
  assert.ok(D.forecast.next.best > D.forecast.next.base && D.forecast.next.worst < D.forecast.next.base);
  assert.deepEqual([D.forecast.vsActual.month, D.forecast.vsActual.forecast, D.forecast.vsActual.actual], ['2026-06', 18000, 20000]); assert.equal(D.forecast.vsActual.errorPct, 11.1);
  assert.match(D.forecast.limits, /ليس نتيجة مؤكدة/); assert.match(D.forecast.method, /3 أشهر/);
});

test('بلا مبيعات: لا درجات ربحية ولا توقع، ويُعلَن السبب', () => {
  const D = E.cfoDash(org, { journalManual: [cost('2026-03', 100, 'b1')] }, { from: '2026-01-01', to: '2026-06-30', today: '2026-07-05' });
  const g = Object.fromEntries(D.scores.map(x => [x.id, x])); assert.equal(g.profit.value, null); assert.equal(g.profit.status, 'insufficient'); assert.equal(g.health.value, null);
  assert.equal(D.forecast.next, null); assert.match(D.forecast.limits, /3 أشهر/);
});
