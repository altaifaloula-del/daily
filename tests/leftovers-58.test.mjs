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
  // قرار المجلس: بهوية Firestore — قيد التحميل (undefined) أو تعذّر القراءة (null) ⇒ فشل مغلق دائمًا أيًا كان المفتاح
  for (const v of [null, undefined]) for (const hc of [true, false]) {
    assert.equal(E.pcfGate(v, hc), null); assert.deepEqual(E.posConflictBlock({}, ops, 'b1', D, [], E.pcfGate(v, hc)).map(c => c.readErr), [true]);
  }
  // بلا هوية Firestore (false — الوضع المحلي): كما كان — لا منع جديد، ومع المفتاح أو تعارض على الحساب فشل مغلق
  assert.deepEqual(E.pcfGate(false, false), []); assert.equal(E.posConflictBlock({}, ops, 'b1', D, [], E.pcfGate(false, false)).length, 0);
  assert.equal(E.pcfGate(false, true), null);
  assert.equal(E.PCF_READ_MSG, 'سجل التعارضات قيد التحميل أو غير مقروء — أعد المحاولة');
  // بند مهام الإقفال: null ⇒ «غير مقروء» لا «سليم»؛ و[] كما كان
  const ck = (recs) => E.closeAutoChecks({ entries: [] }, { ...ops, posConflictRes: [], posConflictRecs: recs }, '2026-11', {}).filter(x => x.k === 'posconf');
  assert.deepEqual(ck(null).map(x => [x.ok, x.unread, /غير مقروء/.test(x.ar)]), [[false, true, true]]);
  assert.deepEqual(ck([]), []); assert.deepEqual(ck(pcf).map(x => [x.ok, x.n]), [[false, 1]]);
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
  assert.equal(await E.pcfLoad(['b1'], false, false, D), false, 'لا هوية Firestore ⇒ false (الوضع المحلي)');
});

test('(1) الواجهات: التحميل دائمًا في نموذج الإغلاق والورديات ومهام الإقفال وقائمة الإغلاقات', () => {
  const cf = read('../mods/closing/ClosingForm.jsx');
  assert.match(cf, /pcfLoad\(\[f\.branchId\], false, null, f\.date\)/, 'الفرع واليوم');
  assert.match(cf, /const pcfArg = pcfGate\(pcf, hasConf\)/);
  assert.match(cf, /if \(cf\.some\(c => c\.readErr\)\) \{ say\('لا يُرحَّل الإغلاق: ' \+ PCF_READ_MSG/, 'رسالة القراءة عند الترحيل');
  assert.match(read('../mods/acct/Accounting.jsx'), /posConflictRecs: Array\.isArray\(pcfL\) \? pcfL : pcfL === false \? \[\] : null/);
  assert.match(read('../mods/pos/PosShifts.jsx'), /const pcfErr = pcf === null \|\| \(anyConf && pcf === false\)/);
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
  assert.equal(V.tab.split.ver, t.split.ver, 'لا تتغير نسخة التقسيم (دفع الأجزاء الأخرى سارٍ)');
  const re = V.tab.split.parts[3]; assert.deepEqual([V.tab.split.parts.length, re.no, re.re, re.total, re.lines.map(l => [l.name, l.qty]), !!re.orderId, !!re.coupon], [4, 4, [p1.id], 50, [['طبق', 1]], false, false], 'جزء إعادة بتسعير الجزء الملغى');
  assert.deepEqual([E.tabRemain(V.tab).total, E.tabRemain(V.tab).paidParts || 0], [150, 0], 'أصناف الجزء الملغى عادت للمتبقي');
  assert.equal(E.tabRemainFree(V.tab).total, 100, 'المتبقي الحر بلا أصناف الإعادة'); assert.deepEqual(E.tabRemainPay(V.tab), { block: [2, 3, 4], part: re }, 'الأجزاء غير المدفوعة الفعلية');
  assert.equal(E.tabPaidParts(V.tab).length, 0);
  assert.match(E.tabPayPart(V.tab, p1.id, payO(V.tab, p1, 'oX'), 'ك').err, /مدفوع/, 'الجزء الملغى لا يُدفع ثانية');
  assert.deepEqual(E.tabPartVoid(V.tab, 'o1'), { tab: V.tab, st: '', no: 1 }, 'مكرر التنفيذ لا يغيّر شيئًا');
  // دفع بقية الأجزاء لا يُغلق الحساب ما دامت أصناف الجزء الملغى غير مدفوعة
  let t2 = E.tabPayPart(V.tab, p2.id, payO(V.tab, p2, 'o2'), 'ك').tab; t2 = E.tabPayPart(t2, p3.id, payO(t2, p3, 'o3'), 'ك').tab;
  assert.deepEqual([t2.status, E.tabRemain(t2).total, E.tabRemain(t2).lines.map(l => l.qty)], ['open', 50, [1]]);
  assert.deepEqual(E.tabRemainPay(t2), { part: re }, '«دفع المتبقي» = جزء الإعادة بتسعيره المجمّد');
  // جولة جديدة أو إعادة تقسيم: الجزء الملغى وجزء الإعادة يبقيان، والتقسيم الجديد على المتبقي الحر فقط
  assert.deepEqual(E.tabSplitReset(t2).split.parts.map(p => [p.no, !!p.voided, !!p.re]), [[1, true, false], [2, false, false], [3, false, false], [4, false, true]]);
  assert.match(E.tabSplitItems(t2, { 0: [1, 0] }, 2, null).err, /لا أصناف متبقية/, 'أصناف الإعادة لا يُعاد تقسيمها');
  const tR = E.tabSplitSet(t2, [], { at: AT }); assert.deepEqual(tR.split.parts.map(p => p.no), [1, 2, 3, 4]);
  // آخر دفعة: جزء الإعادة يُغلق الحساب
  const t3 = E.tabPayPart(t2, re.id, payO(t2, re, 'o4'), 'ك').tab; assert.deepEqual([t3.status, t3.orderId], ['paid', 'o4']);
  // إلغاء ثانٍ وجزء الإعادة غير مدفوع ⇒ يُضم إليه (جزء إعادة واحد)
  const V2 = E.tabPartVoid(t2, 'o2', { at: AT }); assert.deepEqual(V2.tab.split.parts.filter(p => p.re).map(p => [p.no, p.re.length, p.total, p.lines.length]), [[4, 2, 100, 2]]);
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

test('(2) الكوبون: إلغاء الجزء الحامل للكوبون ينقل الرمز وحجزه الحي نفسه إلى جزء الإعادة (حصته من الخصم معه) — لا نقل آخر ولا تحرير', () => {
  const ta = tab(); const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const S = E.tabSplitItems(ta, { 0: [1, 1, 1] }, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} }));
  let t = E.tabSplitSet(ta, S.parts, { at: AT }); const [p1] = t.split.parts;
  t = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  const V = E.tabPartVoid(t, 'o1', { at: AT }); const re = V.tab.split.parts[3];
  assert.equal(V.cpTo, re.id); assert.deepEqual([re.coupon.code, re.cpHeld], ['T6', 'o1']);
  assert.deepEqual(V.tab.split.parts.map(p => [!!p.voided, !!p.coupon]), [[true, false], [false, false], [false, false], [false, true]]);
  assert.equal(V.tab.split.parts[0].cpMoved.to, re.id);
  assert.equal(E.tabCouponMove(V.tab, 'o1', AT, 'o1').to, '', 'لا نقل ثانٍ');
  const src = read('../mods/pos/PosApp.jsx');
  assert.match(src, /const V = tabPartVoid\(t, o\.id, \{ at, by: me\.name, note: vn\.no \}\)/, 'داخل حفظ الإلغاء نفسه على أحدث حالة');
  assert.match(src, /if \(pv && pv\.cpTo\) \{ \}[^\n]*\n\s*else if \(o\.coupon && o\.tabId && o\.tabPartId\)/, 'لا تحرير حين ينتقل إلى جزء الإعادة');
  assert.match(src, /الطاولة مغلقة — لم تُعد الأصناف إليها/);
});

/* ---------------- (1′) قرار المالك: العميل يحتفظ بحصة الجزء الملغى من خصم الطاولة وكوبونها — سيناريو المراجع ---------------- */
const fin = (t, pt, id) => { const P = E.tabPartPriced(pt), T = E.posTotals(P.lines, P.orderDisc, 15);   // كما في شاشة الدفع: الجزء بتسعيره المجمّد
  return { id, no: 'ف1-' + id, branchId: 'b1', date: D, at: AT, kind: 'sale', status: 'paid', rate: 15, lines: P.lines, gross: T.gross, disc: T.disc, ...(P.orderDisc ? { orderDisc: P.orderDisc, orderPromo: P.orderPromo } : {}),
    total: T.total, vat: T.vat, net: T.net, tabSplitVer: t.split.ver, ...(pt.coupon ? { coupon: pt.coupon.code, couponLtd: true, ...(pt.cpHeld ? { couponUse: pt.cpHeld } : {}) } : {}) }; };
test('(1′) A×2@57.50 + B×1@34.50، كوبون 6، ثلاثة أجزاء: دفع 1 و2، إلغاء 1، دفع 3، دفع المتبقي ⇒ العميل 143.50 والكوبون 6 مرة واحدة', () => {
  const ta = tab({ rounds: [{ at: AT, lines: [{ productId: 'a', name: 'أ', qty: 2, price: 57.5 }, { productId: 'b', name: 'ب', qty: 1, price: 34.5 }] }] });
  const cp = [{ id: 'cp', name: 'كوبون 6', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const PZ = E.posPriceCart(cart(ta), [{ id: 'a' }, { id: 'b' }], cp, { now, code: 'T6', uses: {} });
  const S = E.tabSplitItems(ta, { 0: [1, 1, 0], 1: [0, 0, 1] }, 3, PZ); assert.equal(S.err, undefined);
  assert.deepEqual(S.parts.map(p => p.total), [55.19, 55.19, 33.12], '6 بنسبة الصافي: 2.31 + 2.31 + 1.38');
  let t = E.tabSplitSet(ta, S.parts, { at: AT, ver: 'sv1' }); const [p1, p2, p3] = t.split.parts;
  const uses = new Set(); const O = [];
  // دفع 1 (يُحجز الكوبون باسم فاتورته) ثم 2
  let o = fin(t, p1, 'o1'); uses.add('o1'); O.push(o); t = E.tabPayPart(t, p1.id, o, 'ك').tab;
  o = fin(t, p2, 'o2'); O.push(o); t = E.tabPayPart(t, p2.id, o, 'ك').tab;
  // إلغاء 1: الجزء يُوسم وتعود أصنافه بجزء إعادة 55.19 يحمل الكوبون بحجزه نفسه (لا تحرير ولا حجز جديد)
  O[0] = { ...O[0], status: 'void' }; const V = E.tabPartVoid(t, 'o1', { at: AT }); t = V.tab; assert.ok(V.cpTo);
  // دفع 3 (بلا كوبون)
  o = fin(t, p3, 'o3'); assert.equal(o.coupon, undefined); O.push(o); t = E.tabPayPart(t, p3.id, o, 'ك').tab;
  // دفع المتبقي ⇒ جزء الإعادة بتسعيره المجمّد وبالحجز المنقول (couponUse = o1، لا حجز جديد)
  const RP = E.tabRemainPay(t); assert.equal(RP.block, undefined); assert.equal(RP.part.total, 55.19, 'لا 57.50');
  o = fin(t, RP.part, 'o4'); assert.deepEqual([o.coupon, o.couponUse], ['T6', 'o1'], 'الحجز نفسه'); if (!RP.part.cpHeld) uses.add('o4'); O.push(o); t = E.tabPayPart(t, RP.part.id, o, 'ك').tab;
  assert.equal(t.status, 'paid');
  const live = O.filter(x => x.status !== 'void'); const H = (v) => E.toHal(v);
  assert.equal(live.reduce((a, x) => a + H(x.total), 0), 14350, 'العميل دفع 143.50');
  assert.equal(live.reduce((a, x) => a + H(x.orderDisc), 0), 600, 'منفعة الكوبون 6.00 إجمالًا');
  assert.equal(uses.size, 1, 'استخدام كوبون واحد صافٍ');
  // ضريبة كل فاتورة = posTotals لأسطرها، والقيد: الإجمالي والضريبة = مجموع الفواتير، و4104 = مجموع خصوماتها
  live.forEach(x => { const T = E.posTotals(x.lines, x.orderDisc || 0, 15); assert.deepEqual([x.total, x.vat], [T.total, T.vat]); });
  const g = E.posGlDay(O, 'b1', D, 0, 15);
  assert.deepEqual([g.total, g.vat, g.n], [143.5, Math.round(live.reduce((a, x) => a + H(x.vat), 0)) / 100, 3]);
  assert.equal(g.disc, Math.round(live.reduce((a, x) => a + Math.round(E.posDiscOf(x).disc * (x.total - x.vat) / x.total * 100), 0)) / 100, '4104 = خصومات الفواتير الصادرة');
  const L = E.posGlLines(g); const dr = L.reduce((a, l) => a + H(l[1]), 0), cr = L.reduce((a, l) => a + H(l[2]), 0); assert.equal(cr - dr, 14350, 'سطور الإيراد = المحصّل');
});

/* ---------------- (2′) حجز كوبون على جزء غير مدفوع سقط بإعادة التقسيم أو جولة جديدة ---------------- */
const cp6 = [{ id: 'cp', name: 'كوبون 6', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
const cpDisc = (t) => (((t.split || {}).parts) || []).filter(p => !p.voided && (p.orderPromo || {}).id === 'cp').reduce((a, p) => a + E.toHal(p.orderDisc), 0);
const base3 = () => { const ta = tab(); const S = E.tabSplitItems(ta, { 0: [1, 1, 1] }, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], cp6, { now, code: 'T6', uses: {} })); return E.tabSplitSet(ta, S.parts, { at: AT }); };
const priceFree = (t, code, uses) => E.posPriceCart(E.tabRemainFree(t).lines.map((l, i) => ({ ...l, key: 'r' + i })), [{ id: 'x' }], cp6, { now, code, uses });
test('(2′) tabCpHeldCarry: نقل إلى جزء جديد بالرمز نفسه، أو إلى جزء إعادة يحمل حصته، ولا تحرير ما دامت فاتورة تحمل حصته؛ ويُحرَّر فقط حين لا يحمله جزء', () => {
  let t = base3(); const [p1, p2] = t.split.parts;
  t = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  // حالة قديمة (v56.56): الحجز نُقل إلى الجزء 2 غير المدفوع
  const legacy = E.tabCouponMove(t, 'o1', AT, 'o1').tab; assert.equal(legacy.split.parts[1].cpHeld, 'o1');
  // (ج) فاتورة الجزء 1 قائمة (غير موسومة ملغاة) تحمل حصته ⇒ لا تحرير
  assert.deepEqual(E.tabCpHeldCarry(legacy, E.tabSplitReset(legacy)).rel, []);
  // (د) الجزء 1 ملغى ولا جزء يحمل حصته ⇒ يُحرَّر
  const lv = { ...legacy, split: { ...legacy.split, parts: legacy.split.parts.map(p => p.id === p1.id ? { ...p, voided: { at: AT } } : p) } };
  assert.deepEqual(E.tabCpHeldCarry(lv, E.tabSplitReset(lv)).rel, [{ code: 'T6', use: 'o1', limited: true }]);
  // (أ) جزء جديد بالرمز نفسه ⇒ الحجز نفسه
  const S2 = E.tabSplitItems(lv, { 0: [1, 1] }, 2, priceFree(lv, 'T6', {})); const n2 = E.tabSplitSet(lv, S2.parts, { at: AT }); const C2 = E.tabCpHeldCarry(lv, n2);
  assert.deepEqual(C2.rel, []); assert.deepEqual(C2.tab.split.parts.filter(p => p.cpHeld).map(p => [p.cpHeld, p.coupon.code]), [['o1', 'T6']]);
  // (ب) جزء إعادة يحمل حصته بلا رمز ⇒ يحمل الرمز والحجز (إلغاء الجزء 2 المدفوع غير الحامل)
  let tb = E.tabPayPart(lv, p2.id, payO(lv, lv.split.parts[1], 'o2'), 'ك').tab;   // الجزء 2 دُفع بالحجز المنقول
  tb = { ...tb, split: { ...tb.split, parts: tb.split.parts.map(p => p.id === p2.id ? (({ coupon: _c, ...y }) => y)(p) : p).concat([{ id: 'u', no: 9, lines: [], total: 0, coupon: { id: 'cp', code: 'T6', limited: true }, cpHeld: 'o1' }]) } };
  const tb2 = E.tabPartVoid(tb, 'o2', { at: AT }).tab; const nb = E.tabSplitReset(tb2); const Cb = E.tabCpHeldCarry(tb2, nb);
  assert.deepEqual(Cb.rel, []); assert.deepEqual(Cb.tab.split.parts.filter(p => p.re).map(p => [p.coupon && p.coupon.code, p.cpHeld]), [['T6', 'o1']]);
  const src = read('../mods/pos/PosApp.jsx');
  assert.equal((src.match(/tabCpHeldCarry\(/g) || []).length, 3, 'saveSplit وsaveEq والجولة الجديدة');
  assert.equal((src.match(/hRel\.forEach\(h => \{ if \(h\.limited\) cpnRelease\(h\.code, h\.use/g) || []).length, 3);
});

/* ---------------- سيناريوهات المراجع A–D (دائمة) ---------------- */
const live1 = { t6: [{ id: 'o1' }] };   // الحجز الحي للكوبون محدود الاستخدام الواحد
test('(A) إلغاء الجزء الحامل ودفع البقية: حجز واحد، وخصم الكوبون الكلي 6.00', () => {
  let t = base3(); const P = t.split.parts; t = E.tabPayPart(t, P[0].id, payO(t, P[0], 'o1'), 'ك').tab;
  const V = E.tabPartVoid(t, 'o1', { at: AT }); t = V.tab; assert.ok(V.cpTo);
  assert.equal(cpDisc(t), 600, 'الحصص على الأجزاء القائمة (2 و3 وجزء الإعادة) = 6.00');
  for (const p of t.split.parts.filter(x => !x.orderId)) t = E.tabPayPart(t, p.id, payO(t, p, 'q' + p.no), 'ك').tab;
  assert.equal(t.status, 'paid'); assert.equal(cpDisc(t), 600);
});
test('(B) إلغاء جزء غير حامل بعد دفع الحامل: لا نقل ولا تحرير، وجزء الإعادة بحصته', () => {
  let t = base3(); const P = t.split.parts; t = E.tabPayPart(t, P[0].id, payO(t, P[0], 'o1'), 'ك').tab; t = E.tabPayPart(t, P[1].id, payO(t, P[1], 'o2'), 'ك').tab;
  const V = E.tabPartVoid(t, 'o2', { at: AT }); assert.equal(V.cpTo, undefined); t = V.tab;
  assert.equal(cpDisc(t), 600); assert.deepEqual(E.tabCpHeldCarry(t, E.tabSplitReset(t)).rel, []);
});
test('(C) إلغاء الحامل ثم إعادة تقسيم المتبقي الحر مع إدخال الرمز: الرمز مرفوض (الحجز حي على جزء الإعادة)، ولا تحرير، والخصم ≤ 6.00', () => {
  let t = base3(); const P = t.split.parts; t = E.tabPayPart(t, P[0].id, payO(t, P[0], 'o1'), 'ك').tab; t = E.tabPartVoid(t, 'o1', { at: AT }).tab;
  const PZ = priceFree(t, 'T6', live1); assert.equal(PZ.coupon, null, 'لا كوبون ثانٍ'); assert.equal(E.toHal(PZ.orderDisc), 0);
  const S = E.tabSplitItems(t, { 0: [1, 1] }, 2, PZ); const nx = E.tabSplitSet(t, S.parts, { at: AT }); const C = E.tabCpHeldCarry(t, nx);
  assert.deepEqual(C.rel, []); assert.ok(cpDisc(C.tab) <= 600, 'الخصم الكلي ≤ 6.00');
  assert.deepEqual(C.tab.split.parts.filter(p => p.cpHeld).map(p => [!!p.re, p.cpHeld]), [[true, 'o1']]);
});
test('(D) إلغاء الحامل ثم جولة جديدة ثم إعادة تقسيم: rel فارغ، والخصم الكلي ≤ 6.00، وإعادة إدخال الرمز مرفوضة', () => {
  let t = base3(); const P = t.split.parts; t = E.tabPayPart(t, P[0].id, payO(t, P[0], 'o1'), 'ك').tab; t = E.tabPartVoid(t, 'o1', { at: AT }).tab;
  // جولة جديدة: tabSplitReset تُسقط الجزأين 2 و3 غير المدفوعين
  const r1 = { ...E.tabSplitReset(t), rounds: [...t.rounds, { at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 1, price: 50 }] }] };
  assert.deepEqual(E.tabCpHeldCarry(t, r1).rel, [], 'جزء الإعادة يحمل الحجز — لا تحرير');
  // إعادة التقسيم مع إدخال T6 والحجز حي ⇒ مرفوض
  assert.match(E.couponWhy(cp6, 'T6', { uses: live1, sub: 150 }, now, 'b1'), /استُنفد/);
  const PZ = priceFree(r1, 'T6', live1); assert.equal(PZ.coupon, null);
  const S = E.tabSplitItems(r1, { 0: [2, 1] }, 2, PZ); assert.equal(S.err, undefined); const nx = E.tabSplitSet(r1, S.parts, { at: AT });
  const C = E.tabCpHeldCarry(r1, nx); assert.deepEqual(C.rel, []);
  assert.ok(cpDisc(C.tab) <= 600, 'الخصم الكلي ≤ 6.00'); assert.equal(cpDisc(C.tab), 400, 'حصتا الجزأين القائمين فقط (جزء الإعادة 2.00 ... وما سقط لا يُحتسب)'.length ? cpDisc(C.tab) : 0);
});
