/**
 * v56.35 — الدفعة 4 (قرارا المجلس M3/M4): ضوابط التسويق، معطّلة افتراضيًا.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });
const on = { mktCtl: { on: true } };

test('M3: بلا تفعيل كما كان؛ مع التفعيل التصدير للمركز (مدير/مالك) وتصدير الكل للمالك وحده', () => {
  assert.equal(E.mktCanExport({}, { role: 'branch_manager' }), true, 'كما كان');
  assert.equal(E.mktCanExport(on, { role: 'branch_manager' }), false);
  assert.equal(E.mktCanExport(on, { role: 'system_admin' }), true);
  assert.equal(E.mktCanExportAll(on, { role: 'system_admin' }), true); assert.equal(E.mktCanExportAll({}, { role: 'system_admin' }), false);
});

test('M4: الطلب والرفض ليسا دمجًا، والطلب يُغلق بالاعتماد أو الرفض', () => {
  const m = { id: 'm1', from: '1', to: '2', pts: 50 };
  const req = { id: 'r1', undoReq: 'm1', by: 'أ' };
  assert.deepEqual(E.mktMergesLive({ mktMerges: [m, req] }).map(x => x.id), ['m1'], 'الطلب لا يُلغي الدمج ولا يُعدّ دمجًا');
  assert.deepEqual(E.mktUndoPending({ mktMerges: [m, req] }).map(x => x.id), ['r1']);
  assert.equal(E.mktUndoPending({ mktMerges: [m, req, { id: 'u', undoOf: 'm1', reqId: 'r1' }] }).length, 0);
  assert.equal(E.mktMergesLive({ mktMerges: [m, req, { id: 'u', undoOf: 'm1', reqId: 'r1' }] }).length, 0, 'الاعتماد يلغي الدمج');
  assert.equal(E.mktUndoPending({ mktMerges: [m, req, { id: 'x', rejOf: 'r1' }] }).length, 0);
  assert.equal(E.mktMergesLive({ mktMerges: [m, req, { id: 'x', rejOf: 'r1' }] }).length, 1, 'الرفض يُبقي الدمج');
});
