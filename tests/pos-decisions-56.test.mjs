/**
 * v56.56 — نقطة البيع: قرارات المالك 2026-11-27 ومتابعات المراجعة الأمنية لـ v56.54.
 *   (1) فحص فجوات سلسلة الفوترة دائمًا لكل فرع (تنبيه لا منع) + لا إنذار كاذب عند إيقاف سجل الأجهزة (تبدّل الوسم).
 *   (2) حد المرتجع «لكل وردية» بلا وردية مفتوحة ⇒ حد اليوم (في tests/pos-offline-b.test.mjs).
 *   (3) تقسيم فاتورة الطاولة بالتساوي (2–20 جزءًا).
 *   (4) تعارضات الفواتير بعد عودة الاتصال: يحسمها مدير الفرع («إبقاء» / «إلغاء بمرتجع») قبل الإغلاق اليومي.
 *   (5) إلغاء الجزء الذي يحمل الكوبون يعيده صالحًا لجزء آخر.
 *   ومتابعات v56.54: a (عامل الخدمة دون شبكة فورًا)، b (غياب posCfg)، c (مطابقة تامة لرابط pos-sw.js)، f (تسخين أصول هيكل نقطة البيع بحد).
 * كل الأرقام وهمية. الأسعار شاملة ضريبة 15%:
 *   طاولة: كبسة 2×57.50 + حمص 3×18.40 + شاي 1×4.60 = 174.80 (17,480 هللة)، ضريبتها 174.80×15÷115 = 22.80، صافيها 152.00.
 *   بالتساوي على 3: ⌊17480÷3⌋ = 5826 ⇒ 58.26 | 58.26 | 58.28 (الباقي 2 هللة على الأخير).
 *   الضريبة: round(2280×5826÷17480) = 760 ⇒ 7.60 | 7.60 | 7.60 (الأخير = 2280 − 1520) ⇒ الصافي 50.66 | 50.66 | 50.68.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const AT = '2026-11-20T12:00:00.000Z', D = '2026-11-20';
const tab = (x = {}) => ({ id: 't2', branchId: 'b1', table: '2', status: 'open', openedAt: AT, rounds: [
  { at: AT, by: 'كاشير', lines: [{ productId: 'k', name: 'كبسة', qty: 2, price: 57.5 }, { productId: 'h', name: 'حمص', qty: 1, price: 18.4 }] },
  { at: AT, by: 'كاشير', lines: [{ productId: 'h', name: 'حمص', qty: 2, price: 18.4 }, { productId: 't', name: 'شاي', qty: 1, price: 4.6 }] }], ...x });
const products = [{ id: 'k', name: 'كبسة', sellPrice: 57.5, parts: [{ itemId: 'rice', qty: 0.25 }] }, { id: 'h', name: 'حمص', sellPrice: 18.4, parts: [{ itemId: 'chick', qty: 0.1 }] }, { id: 't', name: 'شاي', sellPrice: 4.6, parts: [{ itemId: 'tea', qty: 0.01 }] }];
const items = [{ id: 'rice', type: 'stock' }, { id: 'chick', type: 'stock' }, { id: 'tea', type: 'stock' }];
const now = new Date('2026-11-20T12:00:00');
const cart = (t) => E.tabRemain(t).lines.map((l, i) => ({ ...l, key: 'r' + i }));
const price = (t, promos = [], x = {}) => E.posPriceCart(cart(t), products, promos, { now, ...x });
const H = (v) => E.toHal(v), sumH = (L, f) => L.reduce((a, p) => a + H(p[f]), 0);

/* ---------------- (3) التقسيم بالتساوي ---------------- */
test('(3) بالتساوي على 3: مبالغ متساوية والباقي بالهللة على الأخير، والضريبة بنسبة المبلغ، والمجموع = الفاتورة بالهللة تمامًا', () => {
  const S = E.tabSplitEqual(tab(), 3, price(tab()), 15);
  assert.equal(S.err, undefined);
  assert.deepEqual(S.parts.map(p => [p.no, p.eq.k, p.eq.n, p.total, p.vat, p.net]), [[1, 1, 3, 58.26, 7.6, 50.66], [2, 2, 3, 58.26, 7.6, 50.66], [3, 3, 3, 58.28, 7.6, 50.68]]);
  assert.deepEqual([S.total, S.vat, S.net], [174.8, 22.8, 152]);
  const W = E.posTotals(E.tabRemain(tab()).lines, 0, 15);
  assert.deepEqual([sumH(S.parts, 'total'), sumH(S.parts, 'vat'), sumH(S.parts, 'net'), sumH(S.parts, 'gross')], [H(W.total), H(W.vat), H(W.net), H(W.gross)]);
  assert.equal(new Set(S.parts.map(p => p.id)).size, 3, 'معرّف فريد لكل جزء');
  // الكميات كسرية بالألف ومجموعها = الطاولة تمامًا
  assert.deepEqual(S.parts.map(p => p.lines.map(l => [l.name, l.qty])), [[['كبسة', 0.666], ['حمص', 1], ['شاي', 0.333]], [['كبسة', 0.666], ['حمص', 1], ['شاي', 0.333]], [['كبسة', 0.668], ['حمص', 1], ['شاي', 0.334]]]);
  // إجماليات الدفع المجمّدة لكل جزء = الجزء نفسه (لا يُعاد حساب الضريبة من الأسطر)
  assert.deepEqual(E.tabPartTotals(S.parts[2]), { gross: 58.28, ldisc: 0, disc: 0, total: 58.28, vat: 7.6, net: 50.68 });
  assert.equal(E.tabPartTotals({ lines: [] }), null, 'جزء بالأصناف ⇒ كما كان');
});

test('(3) كل عدد من 2 إلى 20 يطابق الفاتورة بالهللة؛ خارج المدى أو بلا تسعير الطاولة ⇒ رفض', () => {
  const P = price(tab()), W = E.posTotals(E.tabRemain(tab()).lines, 0, 15);
  for (let n = 2; n <= 20; n++) { const S = E.tabSplitEqual(tab(), n, P, 15);
    if (S.err) { assert.match(S.err, /أكبر من أن تُقسَّم/, 'n=' + n); continue; }
    assert.equal(S.parts.length, n); assert.equal(sumH(S.parts, 'total'), H(W.total)); assert.equal(sumH(S.parts, 'vat'), H(W.vat)); assert.equal(sumH(S.parts, 'net'), H(W.net));
    const a = H(S.parts[0].total); assert.ok(S.parts.slice(0, -1).every(p => H(p.total) === a)); assert.ok(H(S.parts[n - 1].total) - a >= 0 && H(S.parts[n - 1].total) - a < n, 'الباقي على الأخير'); }
  for (const n of [1, 21, 0, 2.5, 'x']) assert.match(E.tabSplitEqual(tab(), n, P, 15).err, /من 2 إلى 20/);
  assert.match(E.tabSplitEqual(tab(), 2, null, 15).err, /لا يطابق/);
  assert.match(E.tabSplitEqual(tab({ rounds: [] }), 2, { lines: [] }, 15).err, /لا أصناف/);
  // بلا ضريبة (المنشأة غير مسجلة) ⇒ الضريبة صفر
  const S0 = E.tabSplitEqual(tab(), 2, P, 0); assert.deepEqual(S0.parts.map(p => [p.total, p.vat]), [[87.4, 0], [87.4, 0]]);
});

test('(3) الطاولة تُسعَّر كاملة مرة واحدة: خصم الفاتورة وخصم السطر يُقسَّمان بالتساوي، والكوبون على الجزء الأول', () => {
  const T = (lines) => tab({ rounds: [{ at: AT, lines }] });
  const ta = T([{ productId: 'x', name: 'طبق', qty: 2, price: 50 }]);
  const od = [{ id: 'od', name: 'خصم 10', type: 'order', mode: 'amt', value: 10, minTotal: 40 }];
  const PA = E.posPriceCart(cart(ta), [{ id: 'x' }], od, { now });
  const SA = E.tabSplitEqual(ta, 3, PA, 15);
  assert.deepEqual(SA.parts.map(p => [p.gross, p.orderDisc, p.total]), [[33.33, 3.33, 30], [33.33, 3.33, 30], [33.34, 3.34, 30]]);
  assert.equal(SA.total, 90, 'الخصم 10 مرة واحدة');
  // اشترِ 2 واحصل على 1 (خصم السطر 23) على جزأين
  const tb = T([{ productId: 'b', name: 'برجر', qty: 3, price: 23 }, { productId: 't', name: 'شاي', qty: 1, price: 4.6 }]);
  const PB = E.posPriceCart(cart(tb), [{ id: 'b' }, { id: 't' }], [{ id: 'bx', name: '2+1', type: 'bxgy', x: 2, y: 1, scope: 'items', items: ['b'] }], { now });
  const SB = E.tabSplitEqual(tb, 2, PB, 15);
  assert.deepEqual(SB.parts.map(p => [p.total, p.ldisc, p.lines[0].disc, p.lines[0].promoName]), [[25.3, 11.5, 11.5, '2+1'], [25.3, 11.5, 11.5, '2+1']]);
  assert.equal(SB.total, 50.6);
  // الكوبون
  const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const SC = E.tabSplitEqual(ta, 2, E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} }), 15);
  assert.deepEqual(SC.parts.map(p => [p.total, !!p.coupon]), [[47, true], [47, false]]);
  assert.deepEqual(SC.parts.map(p => E.tabPartPriced(p).codeOk), [true, false]);
});

const payO = (t, pt, id, x = {}) => ({ id, no: 'ف1-' + id, at: AT, total: pt.total, lines: pt.lines, tabSplitVer: t.split.ver, ...x });
test('(3) دفع الأجزاء المتساوية بآلية v56.52: يُختم كل جزء، يُغلق الحساب بآخرها، ولا يُدفع جزء مرتين، وإعادة التقسيم ترفض الجزء القديم', () => {
  const S = E.tabSplitEqual(tab(), 3, price(tab()), 15);
  let t = E.tabSplitSet(tab(), S.parts, { at: AT, by: 'مدير' }); const [p1, p2, p3] = t.split.parts;
  let R = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك'); assert.equal(R.err, undefined); t = R.tab;
  assert.match(E.tabPayPart(t, p1.id, payO(t, p1, 'oX'), 'ك').err, /مدفوع/);
  // جهاز آخر أعاد التقسيم ⇒ دفع الجزء القديم يُرفض ويُسجَّل تعارضًا
  const t2 = E.tabSplitSet(t, [], { at: AT });   // جهاز آخر أعاد التقسيم (الأجزاء غير المدفوعة سقطت)
  assert.notEqual(t2.split.ver, t.split.ver);
  const Rx = E.tabPayPart(t2, p2.id, payO(t, p2, 'oA'), 'أ'); assert.match(Rx.err, /أُعيد تقسيم/); assert.equal(Rx.tab.conflicts.length, 1);
  R = E.tabPayPart(t, p2.id, payO(t, p2, 'o2'), 'ك'); t = R.tab; assert.equal(t.status, 'open');
  R = E.tabPayPart(t, p3.id, payO(t, p3, 'o3'), 'ك'); t = R.tab;
  assert.deepEqual([R.err, t.status, t.orderNo], [undefined, 'paid', 'ف1-o3']); assert.deepEqual(E.tabRemain(t).lines, [], 'لا بقايا كسرية');
  // بعد دفع جزء متساوٍ لا يُعاد التقسيم على متبقٍ كسري
  const tp = E.tabPayPart(E.tabSplitSet(tab(), S.parts, { at: AT }), S.parts[0].id, payO({ split: { ver: '' } }, S.parts[0], 'q'), 'ك').tab;
  const tr = E.tabSplitReset(tp); assert.match(E.tabSplitEqual(tr, 2, price(tr), 15).err, /تقسيم سابق بالتساوي/);
});

test('(3) المخزون: فواتير الأجزاء المتساوية تخصم مثل فاتورة الحساب كاملًا', () => {
  const S = E.tabSplitEqual(tab(), 3, price(tab()), 15); const org = { products, items };
  const ord = (id, lines) => ({ id, branchId: 'b1', date: D, status: 'paid', lines });
  const whole = E.saleDayUse(org, { posOrders: [ord('w', E.tabRemain(tab()).lines)] }, 'b1', D);
  assert.deepEqual(E.saleDayUse(org, { posOrders: S.parts.map((p, i) => ord('p' + i, p.lines)) }, 'b1', D), whole);
});

test('(3) الواجهة: زر «تقسيم الفاتورة بالتساوي» خلف مفتاح التقسيم نفسه، والجزء المتساوي يُدفع بإجمالياته المجمّدة بلا خصم يدوي', () => {
  const src = fs.readFileSync(new URL('../mods/pos/PosApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /\{RC\.split && <button className="btn" data-spliteqbtn/);
  assert.match(src, /const T = tabPartTotals\(partNow\) \|\| posTotals\(/);
  assert.match(src, /partNow\.eq && \(manual > 0 \|\| redeemPts > 0\)/);
  assert.match(src, /tabSplitEqual\(cur, n, splitPrice\(cur, eqF\.code\), rate\)/, 'الحفظ على أحدث نسخة');
});

/* ---------------- (1) فجوات السلسلة دائمًا + تبدّل وسم الجهاز ---------------- */
const inv = (no, dev, icv, pih, hash, x = {}) => ({ id: no, no, branchId: 'b1', dev, date: D, icv, pih, hash, ...x });
test('(1) تبدّل وسم الجهاز (تفعيل سجل الأجهزة ثم إيقافه) لا يُنذر كذبًا؛ والخلل الحقيقي ما زال يُكشف', () => {
  // AB12: 1..3 ثم D0003: 4..5 (يكمل السلسلة نفسها) ثم إيقاف السجل ⇒ AB12: 6 يشير إلى بصمة 5
  const L = [inv('a1', 'AB12', 1, '0', 'h1'), inv('a2', 'AB12', 2, 'h1', 'h2'), inv('a3', 'AB12', 3, 'h2', 'h3'), inv('d4', 'D0003', 4, 'h3', 'h4'), inv('d5', 'D0003', 5, 'h4', 'h5'), inv('a6', 'AB12', 6, 'h5', 'h6'), inv('a7', 'AB12', 7, 'h6', 'h7')];
  assert.deepEqual(E.posChainGaps(L, 'b1'), [], 'لا إنذار كاذب');
  // فاتورة مفقودة بعد العودة للوسم المحلي ⇒ تُكشف
  assert.deepEqual(E.posChainGaps(L.filter(x => x.id !== 'a6'), 'b1').map(g => [g.kind, g.prevNo, g.no]), [['gap', 'a3', 'a7']]);
  // فاتورة مفقودة على وسم الخادم ⇒ تُكشف
  const L2 = [...L.slice(0, 3), inv('d4', 'D0003', 4, 'h3', 'h4'), inv('d6', 'D0003', 6, 'h5x', 'h6x')];
  assert.deepEqual(E.posChainGaps(L2, 'b1').map(g => [g.kind, g.no]), [['gap', 'd6']]);
  // بصمة لا تطابق رغم تبدّل الوسم ⇒ ما زالت فجوة (لا يُعفى إلا الربط بالبصمة)
  const L3 = [...L.slice(0, 5), inv('a6', 'AB12', 6, 'bad', 'h6')];
  assert.deepEqual(E.posChainGaps(L3, 'b1').map(g => [g.kind, g.no]), [['gap', 'a6']]);
  // التاريخ في المخرج، والتصفية باليوم
  const G = E.posChainGaps(L.filter(x => x.id !== 'a6'), 'b1'); assert.equal(G[0].date, D);
  assert.equal(E.posChainGapsDay(L.filter(x => x.id !== 'a6'), 'b1', D).length, 1); assert.equal(E.posChainGapsDay(L.filter(x => x.id !== 'a6'), 'b1', '2026-11-21').length, 0);
});

test('(1) الفحص دائمًا لكل الفروع: تنبيه في الورديات والتقارير وفي فحوص الإغلاق اليومي دون منع', () => {
  const sh = fs.readFileSync(new URL('../mods/pos/PosShifts.jsx', import.meta.url), 'utf8');
  assert.match(sh, /const gaps = posChainGaps\(ops\.posOrders, null\)\.filter/, 'بلا شرط العمل دون اتصال');
  assert.doesNotMatch(sh, /posOffOn\(org\) \? posChainGaps/);
  const cf = fs.readFileSync(new URL('../mods/closing/ClosingForm.jsx', import.meta.url), 'utf8');
  assert.match(cf, /posChainGapsDay\(posOrders, f\.branchId, f\.date\); if \(gp\.length\) add\('warn'/, 'تنبيه لا منع');
});

/* ---------------- (4) التعارضات ---------------- */
const bm = { id: 'u-bm', name: 'مدير الفرع', role: 'branch_manager' }, cash = { id: 'u-c', name: 'كاشير ب', role: 'cashier' };
const ops0 = () => {
  const o1 = { id: 'o1', no: 'ف1-A-0001', branchId: 'b1', date: D, at: AT, status: 'paid', by: 'كاشير أ', total: 50, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 50 }] };
  const o2 = { id: 'o2', no: 'ف1-B-0001', branchId: 'b1', date: D, at: AT, status: 'paid', by: 'كاشير ب', byId: 'u-c', total: 50, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 50 }] };
  const t = { id: 't9', branchId: 'b1', table: '9', status: 'paid', orderId: 'o1', orderNo: o1.no, closedAt: AT, conflicts: [{ orderId: 'o2', orderNo: o2.no, at: AT, total: 50, partId: '', why: 'الحساب لم يعد مفتوحًا' }] };
  return { posOrders: [o1, o2], posTabs: [t] };
};
const offOrg = { posCfg: { offline: true } };

test('(4) دفع الحساب كاملًا من جهازين دون اتصال: الثاني يُسجَّل تعارضًا ولا يستبدل الختم؛ بلا العمل دون اتصال كما كان حرفيًا', () => {
  const open = { id: 't9', branchId: 'b1', table: '9', status: 'open' }, o = { id: 'o2', no: 'N2', at: AT, total: 50 };
  assert.deepEqual(E.tabPayWhole(open, o, 'ك', true), { tab: { ...open, status: 'paid', orderId: 'o2', orderNo: 'N2', closedAt: AT, closedBy: 'ك' } });
  const paid = { ...open, status: 'paid', orderId: 'o1', orderNo: 'N1' };
  const R = E.tabPayWhole(paid, o, 'ك', true); assert.match(R.err, /لم يعد مفتوحًا/);
  assert.deepEqual([R.tab.orderId, R.tab.conflicts.map(c => c.orderNo)], ['o1', ['N2']]);
  assert.deepEqual(E.tabPayWhole(paid, o, 'ك', false), { tab: { ...paid, status: 'paid', orderId: 'o2', orderNo: 'N2', closedAt: AT, closedBy: 'ك' } }, 'بلا تفعيل: السلوك السابق');
});

test('(4) قائمة التعارضات ومانع الإغلاق: مع العمل دون اتصال فقط، ليوم الإغلاق، حتى يحسمها مدير الفرع', () => {
  const ops = ops0();
  assert.deepEqual(E.posConflicts(ops, 'b1').map(c => [c.table, c.orderNo, c.by, c.date, c.res]), [['9', 'ف1-B-0001', 'كاشير ب', D, null]]);
  assert.equal(E.posConflicts(ops, 'b2').length, 0); assert.equal(E.posConflicts(ops, 'b1', '2026-11-21').length, 0);
  assert.deepEqual(E.posConflictBlock({}, ops, 'b1', D), [], 'بلا العمل دون اتصال لا يمنع شيئًا');
  assert.equal(E.posConflictBlock(offOrg, ops, 'b1', D).length, 1);
  assert.equal(E.posConflictBlock(offOrg, ops, 'b1', '2026-11-21').length, 0, 'يوم آخر');
  const R = E.posConflictResolve(ops, 't9', 'o2', 'keep', bm); assert.equal(R.err, undefined);
  assert.deepEqual([R.res.act, R.res.by, R.res.byId, typeof R.res.at], ['keep', 'مدير الفرع', 'u-bm', 'string']);
  const ops2 = { ...ops, posTabs: ops.posTabs.map(t => E.tabConflictSet(t, 'o2', R.res)) };
  assert.equal(E.posConflictBlock(offOrg, ops2, 'b1', D).length, 0, 'بعد الحسم يُرحَّل الإغلاق');
  assert.match(E.posConflictResolve(ops2, 't9', 'o2', 'void', bm).err, /سابقًا/);
  assert.deepEqual(E.tabConflictSet(ops2.posTabs[0], 'o2', { act: 'void' }).conflicts[0].res.act, 'keep', 'المحسوم لا يُستبدل');
  // الإغلاق اليومي يمنع الترحيل ويعرضه في الفحوص
  const cf = fs.readFileSync(new URL('../mods/closing/ClosingForm.jsx', import.meta.url), 'utf8');
  assert.match(cf, /if \(status === 'submitted'\) \{ const cf = posConflictBlock\(org, \{ posOrders, posTabs \}, f\.branchId, f\.date\);\s+if \(cf\.length\) \{ say\(/);
  assert.match(cf, /if \(cf\.length\) add\('block'/);
  assert.match(fs.readFileSync(new URL('../mods/closing/Closing.jsx', import.meta.url), 'utf8'), /posTabs=\{ops\.posTabs \|\| \[\]\}/);
});

test('(4) من يحسم: مدير الفرع ومسؤول النظام فقط، ولا يحسمه من أصدر الفاتورة؛ «إلغاء بمرتجع» يتطلب مستند مرتجع (لا حذف)', () => {
  const ops = ops0();
  for (const role of ['cashier', 'regional_manager', 'head_office', 'accountant', 'general_management']) assert.match(E.posConflictResolve(ops, 't9', 'o2', 'keep', { id: 'x', name: 'س', role }).err, /لمدير الفرع/, role);
  assert.equal(E.posConflictResolve(ops, 't9', 'o2', 'keep', { id: 'sa', name: 'مسؤول', role: 'system_admin' }).err, undefined);
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'keep', { id: 'u-c', name: 'آخر', role: 'branch_manager' }).err, /من أصدر الفاتورة/, 'بالمعرّف');
  assert.match(E.posConflictResolve({ ...ops, posTabs: [{ ...ops.posTabs[0], conflicts: [{ ...ops.posTabs[0].conflicts[0], orderId: 'o1' }] }] }, 't9', 'o1', 'keep', { id: 'z', name: 'كاشير أ', role: 'branch_manager' }).err, /من أصدر/, 'بالاسم حين لا معرّف');
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'delete', bm).err, /إبقاء/);
  assert.match(E.posConflictResolve(ops, 't9', 'oZ', 'keep', bm).err, /غير موجود/);
  assert.match(E.posConflictResolve({ ...ops, posOrders: [ops.posOrders[0]] }, 't9', 'o2', 'keep', bm).err, /لم تصل/);
  // إلغاء بمرتجع: بلا مرتجع ⇒ رفض؛ مرتجع جزئي ⇒ رفض؛ مرتجع كامل أو إشعار دائن ⇒ يُسجَّل رقم المستند
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'void', bm).err, /مرتجعًا كاملًا/);
  const o2 = ops.posOrders[1];
  const twoQ = { ...ops, posOrders: [ops.posOrders[0], { ...o2, lines: [{ ...o2.lines[0], qty: 2 }] }, { id: 'r1', kind: 'return', refId: 'o2', no: 'م1-B-0001', status: 'paid', retLines: [{ i: 0, qty: 1 }] }] };
  assert.match(E.posConflictResolve(twoQ, 't9', 'o2', 'void', bm).err, /مرتجعًا كاملًا/, 'مرتجع جزئي');
  const full = { ...ops, posOrders: [...ops.posOrders, { id: 'r1', kind: 'return', refId: 'o2', no: 'م1-B-0001', status: 'paid', retLines: [{ i: 0, qty: 1 }] }] };
  assert.deepEqual([E.posConflictResolve(full, 't9', 'o2', 'void', bm).res.act, E.posConflictResolve(full, 't9', 'o2', 'void', bm).res.doc], ['void', 'م1-B-0001']);
  const vd = { ...ops, posOrders: [ops.posOrders[0], { ...o2, status: 'void', voidNote: { no: 'م1-B-0002' } }] };
  assert.equal(E.posConflictResolve(vd, 't9', 'o2', 'void', bm).res.doc, 'م1-B-0002');
  assert.deepEqual(E.POS_CONFLICT_ROLES, ['branch_manager', 'system_admin']);
});

test('(4) التقليم: حساب عليه تعارض لم يُحسم يبقى حتى 60 يومًا، والمحسوم يُقلَّم بعد 7 كما كان', () => {
  const t = (id, closedAt, res) => ({ id, branchId: 'b1', status: 'paid', closedAt, conflicts: [{ orderId: 'o', ...(res ? { res: { act: 'keep' } } : {}) }] });
  const d = E.posTrim({ posTabs: [t('a', '2026-11-01T10:00:00Z'), t('b', '2026-11-01T10:00:00Z', true), t('c', '2026-09-01T10:00:00Z'), { id: 'd', status: 'paid', closedAt: '2026-11-01T10:00:00Z' }] }, '2026-11-27');
  assert.deepEqual(d.posTabs.map(x => x.id), ['a']);
});

/* ---------------- (5) الكوبون على جزء ملغى ---------------- */
test('(5) إلغاء الجزء الذي يحمل الكوبون: ينتقل إلى أول جزء غير مدفوع (فيُستهلك عند دفعه)، مرة واحدة، ولا نقل بلا جزء متبقٍ', () => {
  const ta = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 3, price: 50 }] }] });
  const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const S = E.tabSplitEqual(ta, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} }), 15);
  let t = E.tabSplitSet(ta, S.parts, { at: AT }); const [p1, p2, p3] = t.split.parts;
  t = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  const M = E.tabCouponMove(t, 'o1', AT);
  assert.equal(M.to, p2.id);
  assert.deepEqual(M.tab.split.parts.map(p => [p.no, !!p.coupon, !!p.orderId]), [[1, false, true], [2, true, false], [3, false, false]]);
  assert.deepEqual(M.tab.split.parts[0].cpMoved, { to: p2.id, at: AT });
  assert.equal(E.tabPartPriced(M.tab.split.parts[1]).codeOk, true, 'يُحجز الكوبون عند دفع الجزء 2');
  assert.deepEqual(M.tab.split.parts.map(p => p.total), t.split.parts.map(p => p.total), 'المبالغ لا تتغيّر');
  // التكرار لا يغيّر شيئًا
  const M2 = E.tabCouponMove(M.tab, 'o1', AT); assert.equal(M2.to, ''); assert.equal(M2.tab, M.tab);
  // جزء بلا كوبون أو حساب مغلق أو لا جزء متبقٍ ⇒ لا نقل
  assert.equal(E.tabCouponMove(M.tab, 'oX').to, '');
  assert.equal(E.tabCouponMove({ ...t, status: 'paid' }, 'o1').to, '');
  let tAll = E.tabSplitSet(ta, S.parts, { at: AT }); for (const [i, p] of tAll.split.parts.entries()) tAll = E.tabPayPart(tAll, p.id, payO(tAll, p, 'q' + i), 'ك').tab;
  assert.equal(E.tabCouponMove({ ...tAll, status: 'open' }, 'q0').to, '', 'كل الأجزاء مدفوعة ⇒ يبقى الكوبون محرّرًا فقط');
});

test('(5) لا استخدام مزدوج: الحجز المحرَّر لا يُحتسب، والحجز الحي الثاني يُرفض؛ والنقل بعد نجاح التحرير فقط', () => {
  const pr = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const why = (uses) => E.couponWhy(pr, 'T6', { uses, sub: 100 }, now, 'b1');
  assert.match(why({ t6: [{ id: 'o1' }] }), /استُنفد/, 'الجزء 1 يستهلكه');
  assert.equal(why({ t6: [{ id: 'o1', rel: AT }] }), null, 'بعد إلغاء الجزء 1 وتحريره صالح من جديد');
  assert.match(why({ t6: [{ id: 'o1', rel: AT }, { id: 'o2' }] }), /استُنفد/, 'الجزء 2 استهلكه ⇒ لا ثالث');
  const src = fs.readFileSync(new URL('../mods/pos/PosApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /cpRel\.then\(okR => \{ if \(!okR\) return say\(/, 'لا نقل إن فشل التحرير');
  assert.match(src, /const M = tabCouponMove\(t, o\.id\)/);
});

/* ---------------- متابعات v56.54 ---------------- */
test('(b) غياب posCfg في منشأة محمّلة = مطفأ (يُلغى العامل)، والمنشأة الفارغة (تعذّر القراءة) لا تُلغيه', () => {
  assert.equal(E.posShellOff(null), false);
  assert.equal(E.posShellOff({ branches: [] }), false, 'emptyOrg');
  assert.equal(E.posShellOff({ branches: [{ id: 'b1' }] }), true, 'بلا posCfg');
  assert.equal(E.posShellOff({ branches: [{ id: 'b1' }], posCfg: {} }), true);
  assert.equal(E.posShellOff({ branches: [], posCfg: { offline: true, offShell: true } }), false);
  assert.match(fs.readFileSync(new URL('../App.jsx', import.meta.url), 'utf8'), /const shellOff = posShellOff\(org\);/);
});

test('(c) مطابقة تامة لرابط pos-sw.js (posSwIsPos وسكربت الشفاء)', () => {
  const B = 'https://pos.example/?u=1';
  assert.equal(E.posSwUrlOk('https://pos.example/pos-sw.js?v=v56.56', B), true);
  assert.equal(E.posSwUrlOk('https://pos.example/pos-sw.js', B), true);
  for (const bad of ['https://pos.example/x/pos-sw.js', 'https://evil.example/pos-sw.js', 'https://pos.example/pos-sw.js?v=1&x=2', 'https://pos.example/evilpos-sw.js', 'https://pos.example/pos-sw.json', 'nope'])
    assert.equal(E.posSwUrlOk(bad, B), false, bad);
  assert.equal(E.posSwUrlOk('https://pos.example/app/pos-sw.js', 'https://pos.example/app/'), true, 'مسار أساس فرعي');
  assert.equal(E.posSwIsPos({ active: { scriptURL: 'https://pos.example/x/pos-sw.js' } }, B), false);
  assert.equal(E.posSwIsPos({ active: { scriptURL: 'https://x/pos-sw.js?v=a' } }), true, 'بلا أساس ⇒ /pos-sw.js تمامًا');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /u\.pathname === want\.pathname/); assert.doesNotMatch(html, /\/\\\/pos-sw\\\.js\(\\\?\|\$\)\/\.test/);
});

test('(f) التسخين: أصول هيكل نقطة البيع من البناء تُضاف إلى المحمّل فعلًا، بلا تكرار ولا بيانات، وبحد أعلى', async () => {
  const O = 'https://pos.example';
  const L = E.posSwWarmList('/', [{ name: O + '/assets/index-AbC123xy.js' }], O, ['/assets/mod-pos-Zz9_8-7q.js', '/assets/index-AbC123xy.js', '/tenants/a.json', 'https://evil.example/assets/x-AbC123xy.js']);
  assert.deepEqual(L, ['/', O + '/assets/index-AbC123xy.js', O + '/assets/mod-pos-Zz9_8-7q.js']);
  const many = Array.from({ length: 200 }, (_, i) => '/assets/c' + i + '-AbC123xy.js');
  assert.equal(E.posSwWarmList('/', [], O, many).length, E.POS_SW_WARM_MAX);
  assert.deepEqual(await E.posSwShellList(async () => ({ ok: true, json: async () => ({ files: ['/assets/a-AbC123xy.js', 5] }) }), '/pos-shell.json'), ['/assets/a-AbC123xy.js']);
  assert.deepEqual(await E.posSwShellList(async () => ({ ok: false }), '/pos-shell.json'), []);
  assert.deepEqual(await E.posSwShellList(async () => { throw new Error('offline'); }, '/pos-shell.json'), []);
  // posSwSync يرسل القائمة المدمجة
  const posted = []; const worker = { postMessage: (m) => posted.push(m) };
  const ls = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); }, removeItem(k) { this.m.delete(k); } };
  await E.posSwSync(true, { ls, ver: 'v', url: 'pos-sw.js', scope: './', sw: { register: async () => ({ active: worker }), ready: Promise.resolve({ active: worker }) },
    shellList: async () => ['/assets/mod-pos-Zz9_8-7q.js'], warm: (extra) => E.posSwWarmList('/', [], O, extra) });
  assert.deepEqual(posted, [{ type: 'warm', urls: ['/', O + '/assets/mod-pos-Zz9_8-7q.js'] }]);
  // إضافة البناء تكتب pos-shell.json
  assert.match(fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /fileName: 'pos-shell\.json'/);
});

function loadSw(opt) {
  const store = new Map(); const keyOf = (r) => typeof r === 'string' ? r : r.url;
  const caches = { keys: async () => [...store.keys()], delete: async (k) => store.delete(k),
    open: async (n) => { if (!store.has(n)) store.set(n, new Map()); const m = store.get(n); return { match: async (r) => m.get(keyOf(r)), put: async (r, v) => { m.set(keyOf(r), v); }, keys: async () => [...m.keys()] }; } };
  const res = (body) => ({ ok: true, status: 200, type: 'basic', body, clone() { return res(body); } }); const L = {};
  const self = { location: { href: 'https://pos.example/pos-sw.js?v=v56.56' }, registration: { scope: 'https://pos.example/' }, navigator: { onLine: opt.onLine !== false }, clients: { claim: async () => { } }, skipWaiting() { }, addEventListener: (t, f) => { L[t] = f; } };
  const timers = []; const ctx = { self, caches, URL, Promise, setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => { }, fetch: async (r) => opt.fetch(r, res) };
  vm.runInNewContext(fs.readFileSync(new URL('../public/pos-sw.js', import.meta.url), 'utf8'), ctx);
  const fire = (type, data) => new Promise((ok) => { const ev = { request: data, data, waitUntil: (x) => Promise.resolve(x).then(() => ok(ev)), respondWith: (x) => { Promise.resolve(x).then(v => { ev.out = v; ok(ev); }); } }; L[type](ev); });
  return { store, fire, res, timers };
}
test('(a) دون شبكة ظاهرًا عند فتح الصفحة ⇒ المخزّن فورًا بلا انتظار مهلة؛ وكاش الأصول بحد أعلى', async () => {
  const S = loadSw({ onLine: false, fetch: () => new Promise(() => { }) });
  S.store.set('muktasab-pos-shell-v56.56', new Map([['https://pos.example/', S.res('OLD')]]));
  const ev = await S.fire('fetch', { url: 'https://pos.example/', method: 'GET', mode: 'navigate' });
  assert.equal(ev.out.body, 'OLD'); assert.ok(S.timers.every(t => true), 'لم يُستدعَ أي مؤقت');
  // متصل ⇒ لا رجوع فوري (ينتظر الشبكة كما كان)
  let got = null; const S2 = loadSw({ onLine: true, fetch: () => new Promise(() => { }) });
  S2.store.set('muktasab-pos-shell-v56.56', new Map([['https://pos.example/', S2.res('OLD')]]));
  S2.fire('fetch', { url: 'https://pos.example/', method: 'GET', mode: 'navigate' }).then(e => { got = e.out; });
  await new Promise(r => setTimeout(r, 10)); assert.equal(got, null);
  // حد الأصول: الكاش الممتلئ لا يُضاف إليه
  const S3 = loadSw({ fetch: async (r, res) => res('NET') });
  S3.store.set('muktasab-pos-shell-v56.56', new Map(Array.from({ length: 80 }, (_, i) => ['https://pos.example/assets/f' + i + '-AbC123xy.js', S3.res('x')])));
  await S3.fire('fetch', { url: 'https://pos.example/assets/new-AbC123xy.js', method: 'GET', mode: 'cors' }); await new Promise(r => setTimeout(r, 10));
  assert.equal(S3.store.get('muktasab-pos-shell-v56.56').size, 80);
  const src = fs.readFileSync(new URL('../public/pos-sw.js', import.meta.url), 'utf8'); assert.match(src, /var MAX_ENTRIES = 80;/);
});
