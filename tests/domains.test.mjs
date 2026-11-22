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

test('الفئات المُدارة: المنتج بلا مجال يرث مجال فئته، ومجاله الخاص يتقدّم، والفئة لنطاقها', () => {
  const O = { ...org(true), catList: [{ id: 'c1', name: 'مشروبات ساخنة', for: 'prod', domains: ['مقهى'] }, { id: 'c2', name: 'لحوم', for: 'item', domains: ['مطعم'] }, { id: 'c3', name: 'عام' }, { name: '' }] };
  assert.deepEqual(E.catListOf(O).map(c => [c.name, c.for]), [['مشروبات ساخنة', 'prod'], ['لحوم', 'item'], ['عام', 'both']]);
  assert.deepEqual(E.catsFor(O, 'prod').map(c => c.name), ['مشروبات ساخنة', 'عام']);
  const latte = { id: 'l', cat: 'مشروبات ساخنة' }, special = { id: 's', cat: 'مشروبات ساخنة', domains: ['مطعم'] }, meat = { id: 'm', cat: 'لحوم' }, misc = { id: 'x', cat: 'غير مُدارة' };
  assert.deepEqual(E.recDomains(O, latte), ['مقهى']); assert.deepEqual(E.recDomains(O, special), ['مطعم']); assert.deepEqual(E.recDomains(O, misc), []);
  assert.deepEqual(E.domFilter(O, 'k', [latte, special, meat, misc]).map(x => x.id), ['l', 'x']);
  assert.deepEqual(E.domFilter(O, 'r', [latte, special, meat, misc]).map(x => x.id), ['s', 'm', 'x']);
});
