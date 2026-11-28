/**
 * v56.58 — بقايا صغيرة بقرارات المجلس:
 *   (1) سجل التعارضات المحمي pos_conflicts يُحمَّل دائمًا: تعارض محمي غير محسوم يمنع الترحيل ولو أُطفئ العمل دون اتصال وحُذفت tab.conflicts،
 *       وتعذّر القراءة فشل مغلق كما كان (مع العمل دون اتصال أو تعارض على الحساب)، واستعلام الإغلاق للفرع واليوم فقط.
 *   (2) إلغاء فاتورة جزء من تقسيم بالأصناف: الحساب مفتوح ⇒ يُوسم الجزء ملغى (يبقى في السجل) وتعود أصنافه إلى المتبقي؛ مغلق ⇒ لا يُعاد فتح شيء.
 *       جزء التقسيم بالتساوي كما في v56.56 (لا يُمس).
 * كل الأرقام وهمية: طاولة طبق 3×50 = 150، مقسّمة بالأصناف 1|1|1.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const AT = '2026-11-20T12:00:00.000Z', D = '2026-11-20';
const now = new Date('2026-11-20T12:00:00');
const tab = (x = {}) => ({ id: 't2', branchId: 'b1', table: '2', status: 'open', openedAt: AT, rounds: [{ at: AT, by: 'ك', lines: [{ productId: 'x', name: 'طبق', qty: 3, price: 50 }] }], ...x });
const cart = (t) => E.tabRemain(t).lines.map((l, i) => ({ ...l, key: 'r' + i }));
const payO = (t, pt, id) => ({ id, no: 'ف1-' + id, at: AT, total: pt.total, vat: pt.vat, lines: pt.lines, ...(pt.eqItems ? { eqItems: pt.eqItems } : {}), tabSplitVer: t.split.ver });
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

/* ---------------- (1) التعارضات المحمية تُحمَّل دائمًا ---------------- */
test('(1) تعارض محمي غير محسوم يمنع الترحيل بلا المفتاح وبلا tab.conflicts، وتعذّر القراءة فشل مغلق كما كان', () => {
  const ops = { posOrders: [], posTabs: [{ id: 't9', branchId: 'b1', table: '9', status: 'paid', conflicts: [] }] };   // حُذفت tab.conflicts
  const pcf = [{ branchId: 'b1', orderId: 'o2', tabId: 't9', table: '9', date: D, orderNo: 'ف1-B-0001', why: 'الحساب لم يعد مفتوحًا', total: 50 }];
  const hasConf = false;   // العمل دون اتصال مُطفأ ولا تعارض على الحساب
  assert.deepEqual(E.pcfGate(pcf, hasConf), pcf, 'المقروء يُمرَّر كما هو أيًا كان المفتاح');
  assert.deepEqual(E.posConflictBlock({}, ops, 'b1', D, [], E.pcfGate(pcf, hasConf)).map(c => c.orderNo), ['ف1-B-0001'], 'يمنع ولو أُطفئ المفتاح');
  assert.equal(E.posConflictBlock({}, ops, 'b1', D, [{ branchId: 'b1', orderId: 'o2', act: 'keep' }], E.pcfGate(pcf, hasConf)).length, 0, 'المحسوم في السجل المحمي لا يمنع');
  assert.equal(E.posConflictBlock({}, ops, 'b1', D, null, E.pcfGate(pcf, hasConf)).length, 1, 'سجل الحسم غير مقروء ⇒ غير محسوم');
  // تعذّر القراءة أو لم تكتمل: فشل مغلق مع المفتاح أو تعارض على الحساب (كما كان)، وإلا لا منع جديد (خارج Firestore لا سجل محمي أصلًا)
  for (const v of [null, undefined]) {
    assert.equal(E.pcfGate(v, true), null); assert.deepEqual(E.posConflictBlock({ posCfg: { offline: true } }, ops, 'b1', D, [], E.pcfGate(v, true)).map(c => c.readErr), [true]);
    assert.deepEqual(E.pcfGate(v, false), []); assert.equal(E.posConflictBlock({}, ops, 'b1', D, [], E.pcfGate(v, false)).length, 0);
  }
  assert.equal(E.pcfNeedRes([], false), false); assert.equal(E.pcfNeedRes(pcf, false), true); assert.equal(E.pcfNeedRes(null, true), true);
});

test('(1) pcfLoad باليوم: استعلام الفرع واليوم معًا، وبلا يوم كما كان', async () => {
  const Q = []; const c = { email: 'a@t.sa', f: { db: 'DB', collection: (db, k) => ({ k }), where: (f, op, v) => [f, op, v], query: (col, ...w) => ({ col, w }),
    getDocs: async (q) => { Q.push(q); return { docs: [{ id: 'o2', data: () => ({ branchId: 'b1', date: D }) }] }; } } };
  const L = await E.pcfLoad(['b1'], false, c, D);
  assert.deepEqual(Q[0].w, [['branchId', '==', 'b1'], ['date', '==', D]]); assert.deepEqual(L.map(r => r.orderId), ['o2']);
  await E.pcfLoad(['b1'], false, c); assert.deepEqual(Q[1].w, [['branchId', '==', 'b1']], 'بلا يوم كما كان');
  await E.pcfLoad(['b1'], false, c, 'x'); assert.deepEqual(Q[2].w, [['branchId', '==', 'b1']], 'يوم غير صالح يُتجاهل');
  const bad = { email: 'a@t.sa', f: { ...c.f, getDocs: async () => { throw Object.assign(new Error('x'), { code: 'unavailable' }); } } };
  assert.equal(await E.pcfLoad(['b1'], false, bad, D), null, 'تعذّر القراءة ⇒ null (فشل مغلق عند المستدعي)');
});

test('(1) الواجهات: التحميل دائمًا في نموذج الإغلاق والورديات ومهام الإقفال وقائمة الإغلاقات', () => {
  const cf = read('../mods/closing/ClosingForm.jsx');
  assert.match(cf, /pcfLoad\(\[f\.branchId\], false, null, f\.date\)/, 'الفرع واليوم');
  assert.match(cf, /const pcfArg = pcfGate\(pcf, hasConf\)/);
  assert.doesNotMatch(cf, /if \(!hasConf\) return; let on = true/);
  assert.doesNotMatch(read('../mods/pos/PosShifts.jsx'), /if \(!anyConf\) return/);
  assert.doesNotMatch(read('../mods/acct/Accounting.jsx'), /if \(!hasPConf\) return/);
  const cl = read('../mods/closing/Closing.jsx'); assert.doesNotMatch(cl, /if \(!hasConf\) return/); assert.doesNotMatch(cl, /hasConf \? posConflictLate/);
});

/* ---------------- (2) إلغاء جزء التقسيم بالأصناف ---------------- */
const split3 = () => { const t0 = tab(); const S = E.tabSplitItems(t0, { 0: [1, 1, 1] }, 3, E.posPriceCart(cart(t0), [{ id: 'x' }], [], { now })); return E.tabSplitSet(t0, S.parts, { at: AT }); };

test('(2) الحساب مفتوح: يُوسم الجزء ملغى ويبقى في السجل، وتعود أصنافه إلى المتبقي، ولا يُدفع مرة ثانية', () => {
  let t = split3(); const [p1, p2, p3] = t.split.parts;
  t = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  assert.deepEqual([E.tabRemain(t).total, E.tabRemain(t).paidParts], [100, 1]);
  const V = E.tabPartVoid(t, 'o1', { at: AT, by: 'مدير', note: 'م1-0001' });
  assert.deepEqual([V.st, V.no], ['open', 1]);
  const v1 = V.tab.split.parts[0];
  assert.deepEqual([v1.orderId, v1.orderNo, v1.voided], ['o1', 'ف1-o1', { at: AT, by: 'مدير', note: 'م1-0001' }], 'لا حذف — الفاتورة والوسم في السجل');
  assert.equal(V.tab.split.parts.length, 3); assert.equal(V.tab.split.ver, t.split.ver, 'لا تتغير نسخة التقسيم (دفع الأجزاء الأخرى سارٍ)');
  assert.deepEqual([E.tabRemain(V.tab).total, E.tabRemain(V.tab).paidParts || 0], [150, 0], 'أصناف الجزء الملغى عادت للمتبقي');
  assert.equal(E.tabPaidParts(V.tab).length, 0);
  assert.match(E.tabPayPart(V.tab, p1.id, payO(V.tab, p1, 'oX'), 'ك').err, /مدفوع/, 'الجزء الملغى لا يُدفع ثانية');
  assert.deepEqual(E.tabPartVoid(V.tab, 'o1'), { tab: V.tab, st: '', no: 1 }, 'مكرر التنفيذ لا يغيّر شيئًا');
  // دفع بقية الأجزاء لا يُغلق الحساب ما دامت أصناف الجزء الملغى غير مدفوعة
  let t2 = E.tabPayPart(V.tab, p2.id, payO(V.tab, p2, 'o2'), 'ك').tab; t2 = E.tabPayPart(t2, p3.id, payO(t2, p3, 'o3'), 'ك').tab;
  assert.deepEqual([t2.status, E.tabRemain(t2).total, E.tabRemain(t2).lines.map(l => l.qty)], ['open', 50, [1]]);
  // جولة جديدة أو إعادة تقسيم: الجزء الملغى يبقى في السجل
  assert.equal(E.tabSplitReset(t2).split.parts.filter(p => p.voided).length, 1);
  const S2 = E.tabSplitItems(t2, { 0: [1, 0] }, 2, null); assert.match(S2.err, /صنفًا واحدًا/, 'المتبقي صنف واحد');
  const tR = E.tabSplitSet(t2, [], { at: AT }); assert.equal(tR.split.parts.filter(p => p.voided).length, 1);
});

test('(2) الحساب مغلق: لا يُعاد فتح شيء (st:closed للتنبيه)، والتقسيم بالتساوي وغير المقسّم لا يُمسّان', () => {
  let t = split3(); t.split.parts.forEach((p, i) => { t = E.tabPayPart(t, p.id, payO(t, p, 'q' + i), 'ك').tab; });
  assert.equal(t.status, 'paid');
  const V = E.tabPartVoid(t, 'q0', { at: AT }); assert.equal(V.st, 'closed'); assert.equal(V.tab, t, 'لا تغيير');
  // التقسيم بالتساوي كما في v56.56
  const t0 = tab(); const Q = E.tabSplitEqual(t0, 3, E.posPriceCart(cart(t0), [{ id: 'x' }], [], { now }), 15);
  let te = E.tabSplitSet(t0, Q.parts, { at: AT }); te = E.tabPayPart(te, Q.parts[0].id, payO(te, te.split.parts[0], 'e1'), 'ك').tab;
  const VE = E.tabPartVoid(te, 'e1'); assert.deepEqual([VE.st, VE.tab === te], ['', true]); assert.equal(E.tabRemain(te).total, 100);
  assert.deepEqual(E.tabPartVoid(tab(), 'zz'), { tab: tab(), st: '', no: 0 }); assert.equal(E.tabPartVoid(null, 'zz').st, '');
});

test('(2) الكوبون كما في v56.56: نقل حجز الجزء الملغى إلى أول جزء غير مدفوع يعمل بعد وسم الإلغاء', () => {
  const ta = tab(); const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const S = E.tabSplitItems(ta, { 0: [1, 1, 1] }, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} }));
  let t = E.tabSplitSet(ta, S.parts, { at: AT }); const [p1, p2] = t.split.parts;
  t = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  const V = E.tabPartVoid(t, 'o1', { at: AT }); const M = E.tabCouponMove(V.tab, 'o1', AT, 'o1');
  assert.equal(M.to, p2.id); assert.deepEqual(M.tab.split.parts.map(p => [!!p.voided, !!p.coupon]), [[true, false], [false, true], [false, false]]);
  const src = read('../mods/pos/PosApp.jsx');
  assert.match(src, /const V = tabPartVoid\(t, o\.id, \{ at, by: me\.name, note: vn\.no \}\)/, 'داخل حفظ الإلغاء نفسه على أحدث حالة');
  assert.match(src, /الطاولة مغلقة — لم تُعد الأصناف إليها/);
});
