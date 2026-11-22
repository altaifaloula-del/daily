/* v53.0 — مجالات النشاط: إظهار الأصناف والمنتجات في كل فرع حسب مجاله */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';
const E = await buildEngine();
const org = (on) => ({ domainCfg: { on }, branches: [{ id: 'k', name: 'كشك', domains: ['مقهى'] }, { id: 'r', name: 'مطعم', domains: ['مطعم'] }, { id: 'x', name: 'بلا مجال' }] });
const L = [{ id: 'coffee', domains: ['مقهى'] }, { id: 'rice', domains: ['مطعم'] }, { id: 'water' }, { id: 'both', domains: ['مطعم', 'مقهى'] }];

test('الإعداد: متوقف افتراضيًا وقائمة مجالات افتراضية بلا تكرار', () => {
  assert.equal(E.domCfgOf({}).on, false); assert.deepEqual(E.domCfgOf({}).list, E.DOMAIN_DEF);
  assert.deepEqual(E.domCfgOf({ domainCfg: { on: true, list: [' مقهى ', 'مقهى', '', 'مطعم'] } }), { on: true, list: ['مقهى', 'مطعم'] });
});

test('الخيار متوقف: كل شيء يظهر كما كان', () => {
  assert.deepEqual(E.domFilter(org(false), 'k', L).map(x => x.id), ['coffee', 'rice', 'water', 'both']);
});

test('الخيار مفعّل: الفرع يرى مجاله والمشترك، والفرع بلا مجال يرى الكل، ومجموعة فروع تكفي أحدها، وما له رصيد لا يُخفى', () => {
  const O = org(true);
  assert.deepEqual(E.domFilter(O, 'k', L).map(x => x.id), ['coffee', 'water', 'both']);
  assert.deepEqual(E.domFilter(O, 'r', L).map(x => x.id), ['rice', 'water', 'both']);
  assert.deepEqual(E.domFilter(O, 'x', L).map(x => x.id), ['coffee', 'rice', 'water', 'both']);
  assert.deepEqual(E.domFilter(O, ['k', 'r'], L).map(x => x.id), ['coffee', 'rice', 'water', 'both']);
  assert.deepEqual(E.domFilter(O, [], L).length, 4, 'بلا فرع (المركز) = الكل');
  assert.deepEqual(E.domFilter(O, 'k', L, it => it.id === 'rice').map(x => x.id), ['coffee', 'rice', 'water', 'both'], 'له رصيد في مستودع الكشك');
  assert.equal(E.domOk(O, 'k', { domains: ['مطعم'] }), false); assert.equal(E.domOk(O, '', { domains: ['مطعم'] }), true);
  assert.deepEqual(E.userBrIds({ branchId: 'k', allowedBranchIds: ['r', 'k'] }), ['k', 'r']);
});
