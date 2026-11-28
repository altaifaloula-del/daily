/**
 * v56.59 — «إبقاء الكل» لتعارضات نقطة البيع (قرار المالك 2026-11-28: «حسم جماعي للمدير»).
 * حسم «إبقاء» مستقل لكل تعارض بالفحوص نفسها (posConflictResolve) — ما لا يحق للمدير حسمه (فاتورته، أو محسوم سلفًا، أو لم تصل) يُتخطّى ويُذكر.
 * الأرقام والأسماء وهمية.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const AT = '2026-11-20T12:00:00.000Z', D = '2026-11-20';
const bm = { id: 'u-bm', name: 'مدير الفرع', role: 'branch_manager', email: 'bm@t.sa' };
const ord = (id, no, x = {}) => ({ id, no, branchId: 'b1', date: D, at: AT, kind: 'sale', status: 'paid', by: 'كاشير', byId: 'u-c', byEmail: 'c@t.sa', total: 50, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 50 }], ...x });
const cf = (orderId, orderNo) => ({ orderId, orderNo, at: AT, total: 50, partId: '', why: 'الحساب لم يعد مفتوحًا', off: true });
const ops = () => ({
  posOrders: [ord('o1', 'ف-1'), ord('o2', 'ف-2'), ord('o3', 'ف-3', { byId: 'u-bm', byEmail: 'bm@t.sa', by: 'مدير الفرع' }), ord('o4', 'ف-4'), ord('o5', 'ف-5')],
  posTabs: [{ id: 't1', branchId: 'b1', table: '1', status: 'paid', conflicts: [cf('o2', 'ف-2'), cf('o3', 'ف-3')] },
    { id: 't2', branchId: 'b1', table: '2', status: 'paid', conflicts: [cf('o4', 'ف-4'), cf('o5', 'ف-5'), cf('o9', 'ف-9')] }]
});

test('إبقاء الكل: سجل مستقل لكل تعارض بالفحوص نفسها، وتخطّي فاتورة المدير نفسه والمحسوم سلفًا وما لم يصل، مع ذكر السبب', () => {
  const O = ops(); const res = [{ branchId: 'b1', orderId: 'o5', act: 'keep', by: 'x@t.sa' }];
  const list = E.posConflicts(O, null, null, res, []);
  assert.equal(list.length, 5);
  const P = E.posConflictBulkKeep(O, list, bm, res);
  assert.deepEqual(P.ok.map(x => x.rec), [
    { branchId: 'b1', orderId: 'o2', tabId: 't1', act: 'keep', byName: 'مدير الفرع' },
    { branchId: 'b1', orderId: 'o4', tabId: 't2', act: 'keep', byName: 'مدير الفرع' }]);
  assert.deepEqual(P.skipped.map(x => [x.c.orderId, x.err]).map(([o, e]) => [o, /من أصدر/.test(e) ? 'own' : /لم تصل/.test(e) ? 'missing' : e]), [['o3', 'own'], ['o9', 'missing']], 'o5 المحسوم لا يُعرض أصلًا (c.res)');
  // كل سجل يطابق ما يعيده الحسم الفردي حرفيًا (القواعد تفحص كلًّا منها كما في الفردي)
  for (const x of P.ok) assert.deepEqual(x.rec, E.posConflictResolve(O, x.c.tabId, x.c.orderId, 'keep', bm, res).rec);
});

test('إبقاء الكل: للأدوار نفسها فقط (مدير الفرع ومسؤول النظام)، ولا تكرار لفاتورة في الدفعة، ومحسوم في resList يُتخطّى', () => {
  const O = ops(); const list = E.posConflicts(O, null, null, [], []);
  for (const role of ['cashier', 'regional_manager', 'head_office', 'accountant']) { const P = E.posConflictBulkKeep(O, list, { ...bm, role }, []); assert.equal(P.ok.length, 0, role); assert.ok(P.skipped.every(s => /لمدير الفرع/.test(s.err)), role); }
  const sa = E.posConflictBulkKeep(O, list, { id: 'u-sa', name: 'مسؤول', role: 'system_admin', email: 'sa@t.sa' }, []);
  assert.deepEqual(sa.ok.map(x => x.c.orderId), ['o2', 'o3', 'o4', 'o5'], 'مسؤول النظام ليس مُصدِرًا لأيٍّ منها');
  const dup = E.posConflictBulkKeep(O, [...list, ...list], bm, []); assert.equal(dup.ok.length, 3);
  const stale = E.posConflictBulkKeep(O, list.map(c => ({ ...c, res: null })), bm, [{ orderId: 'o2' }]);
  assert.match(stale.skipped.find(s => s.c.orderId === 'o2').err, /سابقًا/);
  assert.deepEqual(E.posConflictBulkKeep(O, [], bm, []), { ok: [], skipped: [] });
});

test('الواجهة: زر «إبقاء الكل» في بطاقة التعارضات لمن يحسم، يكتب سجلًّا لكل تعارض عبر pcrWrite ويذكر المتخطّى', () => {
  const src = fs.readFileSync(new URL('../mods/pos/PosShifts.jsx', import.meta.url), 'utf8');
  assert.match(src, /data-conflictkeepall/); assert.match(src, /canRes && confl\.filter\(c => !c\.res\)\.length > 1/);
  assert.match(src, /posConflictBulkKeep\(ops, confl\.filter\(c => !c\.res\), me, resList \|\| \[\]\)/);
  assert.match(src, /for \(const x of P\.ok\) \{ const W = await pcrWrite\(x\.rec\)/, 'كتابة مستقلة لكل سجل');
  assert.match(src, /تُتخطّى/);
});
