/**
 * v56.37 — فصل أسماء عملاء الولاء عن الدفتر المشترك: النقاط مشتركة، والاسم في سجل الفرع (القواعد في tests/rules.test.mjs).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const doc = () => ({ members: { '511': { name: 'سارة', since: '2026-01-01', last: '2026-02-01' }, '522': { name: 'خالد', since: '2026-01-05' }, '533': { since: '2026-01-07' } },
  tx: [{ id: 'a:e', phone: '511', name: 'سارة', pts: 10, br: 'A', at: '1' }, { id: 'b:e', phone: '511', pts: 5, br: 'B', at: '2' }, { id: 'c:e', phone: '522', pts: 7, br: 'A', at: '3' }, { id: 'la', phone: '533', pts: 3, br: '', at: '4' }], cpn: { X: [] } });

test('LYP: بلا تفعيل كما كان', () => { assert.equal(E.loyPiiOn({}), false); assert.equal(E.loyPiiOn({ loyPii: { on: true } }), true); });

test('LYP: الحذف يزيل الأسماء وحدها ولا يمس النقاط ولا القسائم', () => {
  const d = doc(), s = E.loyStrip(d);
  assert.equal(Object.values(s.members).some(m => 'name' in m), false); assert.equal(s.tx.some(t => 'name' in t), false);
  assert.deepEqual(s.tx.map(t => t.pts), d.tx.map(t => t.pts)); assert.deepEqual(s.members['511'], { since: '2026-01-01', last: '2026-02-01' }); assert.deepEqual(s.cpn, d.cpn);
  assert.equal(d.members['511'].name, 'سارة', 'لا يغيّر الأصل');
});

test('LYP: الأسماء الجديدة لمستند الفرع الذي جرت فيه الحركة، وحركات المركز للمركز', () => {
  assert.deepEqual(E.loyNamesByBr([{ phone: '511', name: ' سارة ', br: 'A' }, { phone: '522', name: 'خالد', br: '' }, { phone: '533', br: 'B' }]), { A: { '511': 'سارة' }, '': { '522': 'خالد' } });
});

test('LYP: خطة النقل — العضو إلى كل فرع تعامل فيه، ومن لا فرع له إلى المركز', () => {
  const P = E.loyPiiPlan({ ...doc(), members: { ...doc().members, '544': { name: 'منى' } } });
  assert.deepEqual(P.groups, { A: { '511': 'سارة', '522': 'خالد' }, B: { '511': 'سارة' }, '': { '544': 'منى' } });
  assert.equal(P.nMem, 3); assert.equal(P.nTx, 1); assert.equal(P.docs, 3); assert.equal(P.names, 4);
  assert.equal(E.loyPiiPlan(E.loyStrip(doc())).names, 0, 'بعد الحذف لا شيء');
});

test('LYP: العرض يدمج الأسماء المسموحة فقط، والرصيد لا يتغير', () => {
  const s = E.loyStrip(doc()); const v = E.loyWithNames(s, { '511': 'سارة' });
  assert.equal(v.members['511'].name, 'سارة'); assert.equal((v.members['522'] || {}).name, undefined, 'اسم فرع آخر لا يظهر');
  assert.equal(v.tx, s.tx); assert.equal(E.loyWithNames(s, {}), s);
});
