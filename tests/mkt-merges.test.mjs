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
  const ok = E.mkmCompare([g], [{ id: 'mg-1', kind: 'merge', ref: 'mg-1', from: '500000001', to: '500000002', pts: 5 }]); assert.equal(ok.ok, true);
  const df = E.mkmCompare([g], [{ id: 'mg-1', kind: 'merge', ref: 'mg-1', from: '500000001', to: '500000003' }]); assert.equal(df.differ.length, 1);
});

test('MKM (مراجعة الأمن): المطابقة تكشف النقاط ورقم الطلب، والمخالف لفصل المهام لا يُنسخ', () => {
  const g = { id: 'mg-1', from: '500000001', to: '500000002', pts: 40, at: '1' };
  assert.equal(E.mkmCompare([g], [{ id: 'mg-1', kind: 'merge', ref: 'mg-1', from: '500000001', to: '500000002', pts: 0 }]).differ.length, 1, 'سجل محمي بنقاط أقل');
  const u = { id: 'mg-3', undoOf: 'mg-1', reqId: 'mg-2', at: '3' };
  assert.equal(E.mkmCompare([u], [{ id: 'mg-3', kind: 'undo', ref: 'mg-1', reqId: 'mg-9' }]).differ.length, 1, 'رقم طلب آخر');
  const req = { id: 'mg-2', undoReq: 'mg-1', by: 'أ', byEmail: 'a@x.com', at: '2' };
  const self = { ...u, by: 'أ', byEmail: 'A@x.com' }, other = { ...u, by: 'ب', byEmail: 'b@x.com' };
  assert.deepEqual(E.mkmViolations([g, req, self]).map(x => x.id), ['mg-3'], 'اعتماد ذاتي');
  assert.deepEqual(E.mkmViolations([g, req, other]), [], 'اعتماد غيره');
  assert.deepEqual(E.mkmViolations([g, { id: 'mg-4', undoOf: 'mg-1' }]).map(x => x.id), ['mg-4'], 'تراجع بلا طلب عن دمج فيه نقاط');
  assert.deepEqual(E.mkmViolations([{ ...g, pts: 0 }, { id: 'mg-4', undoOf: 'mg-1' }]), []);
  assert.deepEqual(E.mkmViolations([g, req, { id: 'mg-5', rejOf: 'mg-2', by: 'أ', byEmail: 'a@x.com' }]).map(x => x.id), ['mg-5'], 'رفض ذاتي');
  assert.equal(E.mkmRecord({ ...req, byEmail: 'A@X.com' }, true).origBy, 'a@x.com');
});

test('MKM v56.39: مصدر الدمج على الخادم — بلا تفعيل كما كان؛ ومع التحميل لا يُعتدّ إلا بما في الخادم', () => {
  const on = { growthRecords: { on: true }, mktCtl: { on: true } };
  assert.equal(E.mkmSrcOn(on), false); assert.equal(E.mkmSrcOn({ mkmSrc: { on: true } }), false, 'يلزم نسخ السجلات وضوابط التسويق');
  assert.equal(E.mkmSrcOn({ ...on, mkmSrc: { on: true } }), true);
  const ops = { mktMerges: [{ id: 'mg-1', from: '1', to: '2', pts: 5, at: '1' }, { id: 'mg-x', from: '3', to: '4', pts: 9, at: '2' }, { id: 'mg-r', undoReq: 'mg-1', at: '3' }, { id: 'mg-f', undoOf: 'mg-1', at: '4' }] };
  E.mkmSrvSet(null); assert.equal(E.mkmEff(ops).length, 4, 'بلا تحميل كما كان'); assert.deepEqual(E.mktMergesLive(ops).map(x => x.id), ['mg-x'], 'التراجع المزوّر يسري بلا الخادم');
  E.mkmSrvSet(['mg-1', 'mg-r']);
  assert.deepEqual(E.mktMergesLive(ops).map(x => x.id), ['mg-1'], 'الدمج المكتوب مباشرةً والتراجع بلا سجل محمي لا أثر لهما');
  assert.deepEqual(E.mktUndoPending(ops).map(x => x.id), ['mg-r'], 'الطلب قائم لأن التراجع بلا سجل محمي لا يُغلقه');
  E.mkmSrvSet(null);
});
