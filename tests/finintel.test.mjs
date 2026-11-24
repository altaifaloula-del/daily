/* v54.0 — المرحلة 1: محرك التحليل المالي المتتبَّع — نِسَب بنتائج معروفة مسبقًا، واكتمال البيانات، والمقارنات */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const J = (id, date, lines, extra = {}) => ({ id, date, title: id, status: 'posted', lines: lines.map(([code, debit, credit]) => ({ code, debit, credit })), ...extra });
const org = { taxCfg: { enabled: false }, branches: [{ id: 'b1', name: 'طيبة' }] };
const ops = { journalManual: [
  J('open', '2025-12-31', [['1101', 100000, 0], ['3101', 0, 100000]], { opening: true }),
  J('sale', '2026-02-10', [['1101', 50000, 0], ['4101', 0, 50000]]),
  J('purch', '2026-02-11', [['5198', 20000, 0], ['2101', 0, 20000]]),
  J('sal', '2026-02-12', [['5201', 10000, 0], ['1101', 0, 10000]]),
  J('inv', '2026-02-13', [['1601', 5000, 0], ['1101', 0, 5000]]) ] };
const R = (F, id) => F.ratios.find(r => r.id === id);

test('النِسَب تطابق القيم المحسوبة يدويًا من القيود', () => {
  const F = E.finAnalyze(org, ops, { from: '2026-01-01', to: '2026-03-31' });
  assert.equal(F.quality.complete, true);
  assert.deepEqual([F.statements.netSales, F.statements.cogs, F.statements.gross, F.statements.opex, F.statements.net], [50000, 20000, 30000, 10000, 20000]);
  assert.deepEqual([F.statements.cash, F.statements.inventory, F.statements.currentAssets, F.statements.liabilities, F.statements.equity], [135000, 5000, 140000, 20000, 120000]);
  const exp = { current: 7, quick: 6.75, cashr: 6.75, wc: 120000, gm: 0.6, om: 0.4, nm: 0.4, roa: 0.1667, roe: 0.1818, invt: 8, apt: 2, de: 0.1667, ocf: 1.75 };
  for (const [k, v] of Object.entries(exp)) assert.equal(R(F, k).value, v, k);
  assert.equal(R(F, 'art').value, null); assert.equal(R(F, 'art').status, 'undefined', 'لا ذمم مدينة ⇒ غير معرّفة لا صفر');
  const gm = R(F, 'gm'); assert.ok(gm.formula && gm.sources && gm.explain && gm.action && gm.benchmark); assert.equal(gm.risk, 'low'); assert.equal(gm.period.from, '2026-01-01');
  assert.equal(R(F, 'nm').risk, 'low'); assert.equal(R(F, 'de').risk, 'low');
});

test('المقارنة بالفترة السابقة المماثلة والسنة السابقة', () => {
  const F = E.finAnalyze(org, ops, { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(F.period.prev, { from: '2025-10-03', to: '2025-12-31' }); assert.deepEqual(F.period.yoy, { from: '2025-01-01', to: '2025-03-31' });
  assert.equal(R(F, 'gm').prev, null, 'لا مبيعات في الفترة السابقة ⇒ لا مقارنة مختلقة'); assert.equal(R(F, 'current').prev, null);
});

test('البيانات الناقصة: لا مبيعات ولا نقدية ⇒ النِسَب لا تُحسب ويُذكر السبب', () => {
  const ops2 = { journalManual: [J('p', '2026-02-11', [['5198', 1000, 0], ['2101', 0, 1000]])] };
  const F = E.finAnalyze(org, ops2, { from: '2026-01-01', to: '2026-03-31' });
  assert.equal(F.quality.complete, false); assert.deepEqual(F.quality.checks.filter(c => !c.ok).map(c => c.id).sort(), ['cash', 'opening', 'sales']);
  for (const k of ['gm', 'om', 'nm', 'roa', 'roe', 'invt', 'art', 'current', 'quick', 'cashr', 'ocf']) { assert.equal(R(F, k).value, null, k); assert.equal(R(F, k).status, 'insufficient', k); assert.ok(R(F, k).limits.length, k); }
  assert.equal(R(F, 'apt').status, 'ok'); assert.equal(R(F, 'de').status, 'undefined', 'حقوق ملكية سالبة ⇒ لا تُحسب');
});

test('بلا أرصدة افتتاحية: النِسَب المعتمدة عليها تُحسب مع تعليم «محدودة»', () => {
  const ops3 = { journalManual: ops.journalManual.filter(j => j.id !== 'open') };
  const F = E.finAnalyze(org, ops3, { from: '2026-01-01', to: '2026-03-31' });
  assert.equal(R(F, 'current').status, 'limited'); assert.match(R(F, 'current').limits.join(), /افتتاحية/); assert.equal(R(F, 'gm').status, 'ok');
});

test('التحليل لفرع واحد يأخذ قيوده فقط، والنتيجة تطابق ميزان المراجعة', () => {
  const ops4 = { journalManual: [...ops.journalManual, J('b1sale', '2026-02-15', [['1101', 7000, 0], ['4101', 0, 7000]], { branchId: 'b1' })] };
  const F = E.finAnalyze(org, ops4, { from: '2026-01-01', to: '2026-03-31', bf: 'b1' }); assert.equal(F.statements.netSales, 7000);
  const A = E.buildAccounting(org, ops4); const T = E.acctActivity(A, { from: '2026-01-01', to: '2026-03-31' });
  const G = E.finAnalyze(org, ops4, { from: '2026-01-01', to: '2026-03-31' }); assert.equal(G.statements.balanced, T.balanced);
  assert.equal(G.statements.netSales, 57000);
});
