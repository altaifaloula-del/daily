/**
 * v56.36 — الحماية على الخادم لسجلات دمج العملاء: تحويل mktMerges إلى سجلات mkt_merges ومطابقتها (القواعد في tests/mkt-merges.rules.test.mjs).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

test('MKM: بلا تفعيل لا نسخ؛ ويلزم نسخ السجلات المحمية وضوابط التسويق معًا', () => {
  assert.equal(E.mkmOn({}), false);
  assert.equal(E.mkmOn({ growthRecords: { on: true } }), false);
  assert.equal(E.mkmOn({ mktCtl: { on: true } }), false);
  assert.equal(E.mkmOn({ growthRecords: { on: true }, mktCtl: { on: true } }), true);
});

test('MKM: الأنواع الأربعة ومراجعها، والنسخ التاريخي يحمل الكاتب الأصلي', () => {
  const g = { id: 'mg-1', from: '0500000001', to: '500000002', pts: 12.345, reason: 'مكرر', by: 'أحمد', at: '2026-10-01T10:00:00Z' };
  assert.deepEqual(E.mkmRecord(g), { kind: 'merge', ref: 'mg-1', reason: 'مكرر', from: '0500000001', to: '500000002', pts: 12.35, byName: 'أحمد' });
  assert.equal(E.mkmRecord({ id: 'mg-2', undoReq: 'mg-1', reason: 'خطأ' }).kind, 'undoReq'); assert.equal(E.mkmRecord({ id: 'mg-2', undoReq: 'mg-1' }).ref, 'mg-1');
  assert.deepEqual([E.mkmRecord({ id: 'mg-3', rejOf: 'mg-2' }).kind, E.mkmRecord({ id: 'mg-3', rejOf: 'mg-2' }).ref], ['rej', 'mg-2']);
  const u = E.mkmRecord({ id: 'mg-4', undoOf: 'mg-1', reqId: 'mg-2' }); assert.deepEqual([u.kind, u.ref, u.reqId], ['undo', 'mg-1', 'mg-2']);
  assert.equal('pts' in u, false, 'النقاط للدمج وحده');
  const s = E.mkmRecord({ ...g, byEmail: 'a@x.com' }, true); assert.deepEqual([s.seed, s.origBy, s.origAt], [true, 'a@x.com', g.at]);
});

test('MKM: الجديد فقط، والمطابقة بالترتيب الزمني (الدمج قبل طلبه)', () => {
  const g = { id: 'mg-1', from: '500000001', to: '500000002', pts: 5, at: '2026-10-01' }, r = { id: 'mg-2', undoReq: 'mg-1', at: '2026-10-02' };
  assert.deepEqual(E.mkmDiff([g], [g, r, { id: 'bad id', undoOf: 'mg-1' }]).map(x => x.id), ['mg-2'], 'المعرّف غير الصالح يُتجاهل');
  const c = E.mkmCompare([r, g], [{ id: 'mg-9', kind: 'merge', ref: 'mg-9' }]);
  assert.deepEqual(c.missing.map(x => x.id), ['mg-1', 'mg-2']); assert.equal(c.extra.length, 1); assert.equal(c.ok, false);
  const ok = E.mkmCompare([g], [{ id: 'mg-1', kind: 'merge', ref: 'mg-1', from: '500000001', to: '500000002' }]); assert.equal(ok.ok, true);
  const df = E.mkmCompare([g], [{ id: 'mg-1', kind: 'merge', ref: 'mg-1', from: '500000001', to: '500000003' }]); assert.equal(df.differ.length, 1);
});
