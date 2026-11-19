/* v52.3 — التاريخ والوقت بجانب كل تقرير وعملية، بالتوقيت المحلي */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const loc = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

test('dtLocal: وقت UTC المخزّن يُعرض بالتوقيت المحلي، والنص المحلي كما هو', () => {
  const z = '2026-11-19T19:23:41.000Z';
  assert.equal(E.dtLocal(z), loc(new Date(z)));
  assert.equal(E.dtLocal(new Date(z)), loc(new Date(z)));
  assert.equal(E.dtLocal('2026-11-19T22:23'), '2026-11-19 22:23', 'بلا منطقة زمنية = محلي أصلًا');
  assert.equal(E.dtLocal('2026-11-19'), '2026-11-19');
  assert.equal(E.dtLocal(''), ''); assert.equal(E.dtLocal(null), '');
});

test('arTime: الوقت الفعلي بجانب «منذ»، والأقدم من يوم بالتاريخ والوقت', () => {
  assert.match(E.arTime(new Date(Date.now() - 5 * 60e3).toISOString()), /^قبل 5 د · \d{2}:\d{2}/);
  assert.match(E.arTime(new Date(Date.now() - 3 * 3600e3).toISOString()), /^قبل 3 س · \d{2}:\d{2}/);
  const old = E.arTime('2026-11-13T09:05:00.000Z'); assert.match(old, /2026/); assert.match(old, /·\s*\d{2}:\d{2}/);
  assert.equal(E.arTime('x'), '');
});

test('التقارير: تاريخ ووقت الإصدار في رأس كل تقرير', () => {
  const h = E.rptShell({ company: { name: 'ش' } }, 'تقرير', 'فرعي', '<p>x</p>');
  assert.match(h, /data-issued>تاريخ ووقت الإصدار: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  const r = E.rptHtml({ company: {} }, { title: 'ت', columns: [{ key: 'a', label: 'أ' }], rows: [{ a: 1 }], meta: { at: '2026-11-19T19:23:00.000Z' } });
  assert.ok(r.includes('تاريخ ووقت الإصدار: ' + loc(new Date('2026-11-19T19:23:00.000Z'))));
});
