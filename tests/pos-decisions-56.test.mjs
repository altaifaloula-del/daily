/**
 * v56.56 — نقطة البيع: قرارات المالك 2026-11-27، وقرارات المجلس على المراجعات (A–G)، ومتابعات المراجعة الأمنية لـ v56.54.
 *   (1) فحص فجوات سلسلة الفوترة دائمًا (تنبيه لا منع) + لا إنذار كاذب عند إيقاف سجل الأجهزة.
 *   (2) حد المرتجع «لكل وردية» بلا وردية مفتوحة ⇒ حد اليوم (في tests/pos-offline-b.test.mjs).
 *   (3/A/B/C) التقسيم بالتساوي: سطر ملخّص بكمية 1 لكل جزء، وضريبة كل جزء فاتورةً مستقلة، وتفصيل الأصناف الداخلي eqItems للمخزون والتقارير والمرتجع.
 *   (D) الكوبون يُحجز عند حفظ التقسيم بالتساوي ويُحرَّر بشروط؛ والتقسيم بالأصناف ينقل الحجز نفسه (لا سباق).
 *   (4/E/F) التعارضات: الحسم في سجل محمي pos_conflict_res (القواعد في tests/security.rules.test.mjs)، ووسم الإغلاق المرحّل، وعدم التقليم.
 *   (a/b/c/f/G) عامل الخدمة.
 * كل الأرقام وهمية. الأسعار شاملة ضريبة 15%:
 *   طاولة: كبسة 2×57.50 + حمص 3×18.40 + شاي 1×4.60 = 174.80. بالتساوي على 3: ⌊17480÷3⌋ = 5826 ⇒ 58.26 | 58.26 | 58.28.
 *   ضريبة كل جزء round(المبلغ×15÷115): 58.26 ⇒ 7.60 (7.599)، 58.28 ⇒ 7.60 (7.602)؛ الصافي 50.66 | 50.66 | 50.68.
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
const R2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const H = (v) => E.toHal(v), sumH = (L, f) => L.reduce((a, p) => a + H(p[f]), 0);

/* ---------------- (3) التقسيم بالتساوي — بقرارات المجلس A/B/C/D بعد المراجعة ---------------- */
const fz = (p) => ({ gross: p.gross, total: p.total, vat: p.vat, net: p.net });
const lt = (p) => { const T = E.posTotals(p.lines, 0, 15); return { gross: T.gross, total: T.total, vat: T.vat, net: T.net }; };
test('(A/B) بالتساوي على 3: سطر ملخّص واحد بكمية 1 وسعر = مبلغ الجزء، والضريبة لكل جزء فاتورةً مستقلة، والأسطر = الإجماليات', () => {
  const S = E.tabSplitEqual(tab(), 3, price(tab()), 15);
  assert.equal(S.err, undefined);
  assert.deepEqual(S.parts.map(p => [p.no, p.eq.k, p.eq.n, p.total, p.vat, p.net]), [[1, 1, 3, 58.26, 7.6, 50.66], [2, 2, 3, 58.26, 7.6, 50.66], [3, 3, 3, 58.28, 7.6, 50.68]]);
  assert.equal(S.total, 174.8);
  assert.deepEqual(S.parts.map(p => p.lines), [1, 2, 3].map(k => [{ productId: '', name: 'حصة ' + k + ' من 3 — فاتورة الطاولة 2', qty: 1, price: k === 3 ? 58.28 : 58.26 }]));
  for (const p of S.parts) { assert.deepEqual(lt(p), fz(p), 'posTotals(الأسطر) = المجمّد'); assert.deepEqual(E.tabPartTotals(p), { ...fz(p), ldisc: 0, disc: 0 });
    assert.equal(p.vat, R2(p.total * 15 / 115)); assert.equal(H(p.lines[0].qty * p.lines[0].price), H(p.total), 'صافي السطر = الكمية × السعر'); }
  assert.equal(new Set(S.parts.map(p => p.id)).size, 3, 'معرّف فريد لكل جزء');
  // تفصيل الأصناف الكسري داخلي (eqItems)، مجموعه = الطاولة تمامًا
  assert.deepEqual(S.parts.map(p => p.eqItems.map(l => [l.name, l.qty])), [[['كبسة', 0.666], ['حمص', 1], ['شاي', 0.333]], [['كبسة', 0.666], ['حمص', 1], ['شاي', 0.333]], [['كبسة', 0.668], ['حمص', 1], ['شاي', 0.334]]]);
  assert.equal(E.tabPartTotals({ lines: [] }), null, 'جزء بالأصناف ⇒ كما كان');
  // الإيصال يطبع سطر الملخّص فقط
  const html = E.posReceiptHtml({ company: {} }, { no: 'ف1', at: AT, lines: S.parts[0].lines, eqItems: S.parts[0].eqItems, total: 58.26, vat: 7.6, payments: [] }, { name: 'ف' });
  assert.match(html, /حصة 1 من 3 — فاتورة الطاولة 2/); assert.doesNotMatch(html, /كبسة|حمص|شاي/);
});

test('(B) لكل n من 2 إلى 20 وعلى مبالغ كثيرة: ضريبة كل جزء = round(المبلغ × 15 ÷ 115) تمامًا، والأسطر = الإجماليات، والمبالغ متساوية والباقي على الأخير', () => {
  let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  let checked = 0;
  for (let i = 0; i < 60; i++) {
    const L = [{ productId: 'k', name: 'كبسة', qty: 1 + Math.floor(rnd() * 4), price: Math.round(rnd() * 9000 + 50) / 100 }, { productId: 't', name: 'شاي', qty: 1 + Math.floor(rnd() * 3), price: Math.round(rnd() * 900 + 1) / 100 }];
    const t = tab({ rounds: [{ at: AT, lines: L }] }), P = E.posPriceCart(cart(t), [{ id: 'k' }, { id: 't' }], [], { now }), W = H(E.posTotals(P.lines, 0, 15).total);
    for (let n = 2; n <= 20; n++) { const S = E.tabSplitEqual(t, n, P, 15); if (S.err) { assert.match(S.err, /أكبر من أن تُقسَّم|أصغر من أن يُقسَّم/); continue; }
      assert.equal(sumH(S.parts, 'total'), W); const a = H(S.parts[0].total);
      S.parts.forEach((p, k) => { assert.equal(p.vat, R2(p.total * 15 / 115)); assert.deepEqual(lt(p), fz(p)); assert.equal(H(p.net), H(p.total) - H(p.vat)); if (k < n - 1) assert.equal(H(p.total), a); });
      assert.ok(H(S.parts[n - 1].total) - a >= 0 && H(S.parts[n - 1].total) - a < n); checked++; } }
  assert.ok(checked > 900, 'فُحص ' + checked);
  const P = price(tab());
  for (const n of [1, 21, 0, 2.5, 'x']) assert.match(E.tabSplitEqual(tab(), n, P, 15).err, /من 2 إلى 20/);
  assert.match(E.tabSplitEqual(tab(), 2, null, 15).err, /لا يطابق/);
  assert.match(E.tabSplitEqual(tab({ rounds: [] }), 2, { lines: [] }, 15).err, /لا أصناف/);
  const S0 = E.tabSplitEqual(tab(), 2, P, 0); assert.deepEqual(S0.parts.map(p => [p.total, p.vat]), [[87.4, 0], [87.4, 0]], 'بلا ضريبة');
});

test('(A) الطاولة تُسعَّر كاملة مرة واحدة: الخصومات في التفصيل الداخلي، والمبلغ بعدها؛ والكوبون للتقسيم لا لجزء', () => {
  const T = (lines) => tab({ rounds: [{ at: AT, lines }] });
  const ta = T([{ productId: 'x', name: 'طبق', qty: 2, price: 50 }]);
  const od = [{ id: 'od', name: 'خصم 10', type: 'order', mode: 'amt', value: 10, minTotal: 40 }];
  const SA = E.tabSplitEqual(ta, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], od, { now }), 15);
  assert.deepEqual(SA.parts.map(p => [p.total, p.vat, p.eq.od]), [[30, 3.91, 3.33], [30, 3.91, 3.33], [30, 3.91, 3.34]]);
  assert.equal(SA.total, 90, 'الخصم 10 مرة واحدة');
  const tb = T([{ productId: 'b', name: 'برجر', qty: 3, price: 23 }, { productId: 't', name: 'شاي', qty: 1, price: 4.6 }]);
  const PB = E.posPriceCart(cart(tb), [{ id: 'b' }, { id: 't' }], [{ id: 'bx', name: '2+1', type: 'bxgy', x: 2, y: 1, scope: 'items', items: ['b'] }], { now });
  const SB = E.tabSplitEqual(tb, 2, PB, 15);
  assert.deepEqual(SB.parts.map(p => [p.total, p.eqItems[0].disc, p.eqItems[0].promoName, p.lines.length, p.lines[0].disc]), [[25.3, 11.5, '2+1', 1, undefined], [25.3, 11.5, '2+1', 1, undefined]]);
  const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const SC = E.tabSplitEqual(ta, 2, E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} }), 15);
  assert.deepEqual(SC.parts.map(p => [p.total, !!p.coupon, E.tabPartPriced(p).codeOk]), [[47, false, false], [47, false, false]], 'لا حجز عند دفع الجزء');
  assert.equal(SC.cp.id, 'cp');
});

const payO = (t, pt, id, x = {}) => ({ id, no: 'ف1-' + id, at: AT, total: pt.total, vat: pt.vat, lines: pt.lines, ...(pt.eqItems ? { eqItems: pt.eqItems } : {}), tabSplitVer: t.split.ver, ...x });
test('(3) دفع الأجزاء المتساوية بآلية v56.52: يُختم كل جزء، يُغلق الحساب بآخرها، ولا يُدفع جزء مرتين، وإعادة التقسيم ترفض الجزء القديم', () => {
  const S = E.tabSplitEqual(tab(), 3, price(tab()), 15);
  let t = E.tabSplitSet(tab(), S.parts, { at: AT, by: 'مدير' }); const [p1, p2, p3] = t.split.parts;
  let R = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك'); assert.equal(R.err, undefined); t = R.tab;
  assert.deepEqual(E.tabRemain(t).lines.map(l => [l.name, l.qty]), [['كبسة', 1.334], ['حمص', 2], ['شاي', 0.667]], 'المتبقي من التفصيل');
  assert.match(E.tabPayPart(t, p1.id, payO(t, p1, 'oX'), 'ك').err, /مدفوع/);
  const t2 = E.tabSplitSet(t, [], { at: AT });
  const Rx = E.tabPayPart(t2, p2.id, payO(t, p2, 'oA'), 'أ', true); assert.match(Rx.err, /أُعيد تقسيم/); assert.deepEqual(Rx.tab.conflicts.map(c => c.off), [true], 'وسم دون اتصال');
  R = E.tabPayPart(t, p2.id, payO(t, p2, 'o2'), 'ك'); t = R.tab; assert.equal(t.status, 'open');
  R = E.tabPayPart(t, p3.id, payO(t, p3, 'o3'), 'ك'); t = R.tab;
  assert.deepEqual([R.err, t.status, t.orderNo], [undefined, 'paid', 'ف1-o3']); assert.deepEqual(E.tabRemain(t).lines, [], 'لا بقايا كسرية');
  const tp = E.tabPayPart(E.tabSplitSet(tab(), S.parts, { at: AT }), S.parts[0].id, payO({ split: { ver: '' } }, S.parts[0], 'q'), 'ك').tab;
  const tr = E.tabSplitReset(tp); assert.match(E.tabSplitEqual(tr, 2, price(tr), 15).err, /تقسيم سابق بالتساوي/);
});

test('(A/C) المخزون والتقارير بالتفصيل الداخلي: الأجزاء = الحساب كاملًا؛ والمرتجع الكامل لجزء يعكس تفصيله كله، والإلغاء كذلك', () => {
  const S = E.tabSplitEqual(tab(), 3, price(tab()), 15); const org = { products, items };
  const ord = (id, p, x = {}) => ({ id, no: 'ف-' + id, branchId: 'b1', date: D, status: 'paid', kind: 'sale', lines: p.lines, eqItems: p.eqItems, total: p.total, vat: p.vat, ...x });
  const whole = E.saleDayUse(org, { posOrders: [{ id: 'w', branchId: 'b1', date: D, status: 'paid', lines: E.tabRemain(tab()).lines }] }, 'b1', D);
  const os = S.parts.map((p, i) => ord('p' + i, p));
  assert.deepEqual(E.saleDayUse(org, { posOrders: os }, 'b1', D), whole);
  // مرتجع كامل للجزء 1 من شاشة المرتجع العادية (سطر الملخّص بكمية 1)
  assert.deepEqual(E.posReturnable({ posOrders: os }, os[0]), [1]);
  const C = E.posReturnCalc(os[0], { 0: 1 }); assert.deepEqual([C.total, C.vat], [58.26, 7.6], 'المبلغ والضريبة كاملان');
  const r = { id: 'r1', kind: 'return', refId: 'p0', branchId: 'b1', date: D, status: 'paid', lines: [], retLines: C.lines, ...E.posRetEqItems(os[0], C), total: -C.total, vat: -C.vat };
  assert.deepEqual(r.eqItems, os[0].eqItems.map(l => ({ productId: l.productId, name: l.name, qty: l.qty })));
  const after = E.saleDayUse(org, { posOrders: [...os, r] }, 'b1', D), two = E.saleDayUse(org, { posOrders: os.slice(1) }, 'b1', D);
  assert.deepEqual(after, two, 'المرتجع الكامل يعكس تفصيل الجزء كله');
  assert.deepEqual(E.saleRetUse(org, r), E.saleDayUse(org, { posOrders: [os[0]] }, 'b1', D), 'هدر المرتجع = تفصيل الجزء');
  assert.deepEqual(E.posReturnable({ posOrders: [...os, r] }, os[0]), [0]);
  assert.deepEqual(E.saleDayUse(org, { posOrders: [{ ...os[0], status: 'void' }, ...os.slice(1)] }, 'b1', D), two, 'الإلغاء يعكسه كله');
  // مرتجع جزئي بالمبلغ (من مسار آخر) ⇒ بالنسبة
  assert.deepEqual(E.posRetEqItems(os[0], { total: 29.13 }).eqItems.map(l => l.qty), [0.333, 0.5, 0.167]);
  assert.deepEqual(E.posRetEqItems({ lines: [] }, C), {}, 'فاتورة عادية ⇒ كما كان');
  assert.deepEqual(E.posItemLines(os[0]), os[0].eqItems); assert.deepEqual(E.posItemLines({ lines: [1] }), [1]);
});

test('(3) الواجهة: زر «تقسيم الفاتورة بالتساوي» خلف مفتاح التقسيم نفسه، والجزء المتساوي يُدفع بإجمالياته بلا خصم يدوي ويحمل تفصيله الداخلي', () => {
  const src = fs.readFileSync(new URL('../mods/pos/PosApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /\{RC\.split && <button className="btn" data-spliteqbtn/);
  assert.match(src, /const T = tabPartTotals\(partNow\) \|\| posTotals\(/);
  assert.match(src, /partNow\.eq && \(manual > 0 \|\| redeemPts > 0\)/);
  assert.match(src, /\.\.\.\(prt && prt\.eqItems \? \{ eqItems: prt\.eqItems \} : \{\}\)/);
  assert.match(src, /retLines: C\.lines, \.\.\.posRetEqItems\(o, C\)/);
  assert.match(src, /tabSplitEqual\(cur, n, splitPrice\(cur, code\), rate\)/, 'الحفظ على أحدث نسخة');
});

/* ---------------- (D) الكوبون مع التقسيم بالتساوي ---------------- */
test('(D) الكوبون يُحجز مرة عند حفظ التقسيم (مفتاح النسخة)؛ يُحرَّر بإعادة التقسيم قبل أي دفع فقط، أو بعد إلغاء/إرجاع كل الأجزاء', () => {
  const ta = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 2, price: 50 }] }] });
  const prs = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  // سيناريو المراجع: 100 على جزأين بكوبون 6 ⇒ 47 + 47 والخصم موزّع على الجزأين
  const S = E.tabSplitEqual(ta, 2, E.posPriceCart(cart(ta), [{ id: 'x' }], prs, { now, code: 'T6', uses: {} }), 15);
  const cp = { code: 'T6', id: 'cp', limited: true, use: E.EQ_CP_USE('sv1') };
  let t = E.tabSplitSet(ta, S.parts, { at: AT, ver: 'sv1', cp }); assert.deepEqual(t.split.cp, cp); assert.equal(cp.use, 'eqs_sv1');
  // إعادة التقسيم قبل أي دفع ⇒ يُحرَّر القديم
  const t2 = E.tabSplitSet(t, E.tabSplitEqual(t, 2, E.posPriceCart(cart(t), [{ id: 'x' }], [], { now }), 15).parts, { at: AT, ver: 'sv2' });
  assert.deepEqual(E.tabEqCpRelease(t, t2), cp); assert.equal(E.tabEqCpRelease(t, E.tabSplitReset(t)), cp, 'جولة جديدة قبل الدفع');
  assert.equal(E.tabEqCpRelease(t, t), null, 'النسخة نفسها');
  // دُفع الجزء 1 ⇒ لا تحرير بإعادة التقسيم (حصته من الخصم في فاتورة صادرة) والحجز يبقى على التقسيم
  const [p1, p2] = t.split.parts; let tp = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  assert.equal(E.tabEqCpRelease(tp, E.tabSplitReset(tp)), null); assert.deepEqual(E.tabSplitReset(tp).split.cp, cp); assert.deepEqual(E.tabSplitSet(tp, [], { at: AT }).split.cp, cp);
  tp = E.tabPayPart(tp, p2.id, payO(tp, p2, 'o2'), 'ك').tab;
  const o = (id, p, x = {}) => ({ id, no: 'ف-' + id, branchId: 'b1', date: D, kind: 'sale', status: 'paid', lines: p.lines, total: p.total, vat: p.vat, ...x });
  const ops1 = { posOrders: [o('o1', p1, { status: 'void', voidNote: { no: 'م1' } }), o('o2', p2)] };
  assert.equal(E.tabEqCpAllVoid(tp, ops1), null, 'إلغاء جزء واحد والآخر يحمل حصته ⇒ لا تحرير');
  const ops2 = { posOrders: [...ops1.posOrders, { id: 'r2', kind: 'return', refId: 'o2', status: 'paid', retLines: [{ i: 0, qty: 1 }] }] };
  assert.deepEqual(E.tabEqCpAllVoid(tp, ops2), cp, 'كل الأجزاء أُلغيت أو أُرجعت ⇒ يُحرَّر');
  const tm = E.tabEqCpMark(tp, cp.use, AT); assert.equal(tm.split.cp.rel, AT); assert.equal(E.tabEqCpAllVoid(tm, ops2), null, 'مرة واحدة');
  assert.equal(E.tabEqCpMark(tm, cp.use, 'X'), tm);
  // جزء غير مدفوع ⇒ لا تحرير حتى لو أُلغي المدفوع
  const tq = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab; assert.equal(E.tabEqCpAllVoid(tq, ops1), null);
  // نقل الكوبون (التقسيم بالأصناف) لا يعمل على تقسيم بالتساوي
  assert.equal(E.tabCouponMove(tq, 'o1').to, '');
});

test('(D) سيناريو المراجع: كوبون محدود باستخدام واحد ودُفعت أجزاء قبل الجزء 1 ⇒ لا جزء عالق (الحجز عند الحفظ)، ولا استخدام مزدوج', () => {
  const pr = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const why = (uses) => E.couponWhy(pr, 'T6', { uses, sub: 100 }, now, 'b1');
  const ta = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 3, price: 50 }] }] });
  const S = E.tabSplitEqual(ta, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], pr, { now, code: 'T6', uses: {} }), 15);
  // الحجز عند الحفظ باسم التقسيم ⇒ بيع آخر لا يأخذه
  const uses = { t6: [{ id: 'eqs_sv1' }] }; assert.match(why(uses), /استُنفد/);
  let t = E.tabSplitSet(ta, S.parts, { at: AT, ver: 'sv1', cp: { code: 'T6', id: 'cp', limited: true, use: 'eqs_sv1' } });
  // تُدفع الأجزاء 3 ثم 2 ثم 1 بلا أي حجز للجزء (لا كوبون على جزء)
  for (const k of [2, 1, 0]) { const p = t.split.parts[k]; assert.equal(E.tabPartPriced(p).codeOk, false); t = E.tabPayPart(t, p.id, payO(t, p, 'o' + k), 'ك').tab; }
  assert.equal(t.status, 'paid'); assert.equal(uses.t6.filter(u => !u.rel).length, 1, 'استخدام واحد حي');
});

test('(5/D) التقسيم بالأصناف كما كان مع إغلاق السباق: الكوبون ينتقل بحجزه الحي نفسه (cpHeld) ولا تحرير ثم حجز', () => {
  const ta = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 3, price: 50 }] }] });
  const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 1 }];
  const S = E.tabSplitItems(ta, { 0: [1, 1, 1] }, 3, E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} }));
  let t = E.tabSplitSet(ta, S.parts, { at: AT }); const [p1, p2] = t.split.parts;
  t = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'ك').tab;
  const M = E.tabCouponMove(t, 'o1', AT, 'o1');
  assert.equal(M.to, p2.id);
  assert.deepEqual(M.tab.split.parts.map(p => [p.no, !!p.coupon, p.cpHeld || '']), [[1, false, ''], [2, true, 'o1'], [3, false, '']]);
  assert.equal(E.tabPartPriced(M.tab.split.parts[1]).codeOk, true);
  assert.equal(E.tabCouponMove(M.tab, 'o1', AT).to, '', 'مرة واحدة');
  // إلغاء الجزء 2 بعد دفعه بالحجز المنقول ⇒ ينتقل الحجز نفسه مرة أخرى
  let t2 = E.tabPayPart(M.tab, p2.id, payO(M.tab, M.tab.split.parts[1], 'o2'), 'ك').tab;
  assert.equal(E.tabCouponMove(t2, 'o2', AT, 'o1').tab.split.parts[2].cpHeld, 'o1');
  let tAll = E.tabSplitSet(ta, S.parts, { at: AT }); for (const [i, p] of tAll.split.parts.entries()) tAll = E.tabPayPart(tAll, p.id, payO(tAll, p, 'q' + i), 'ك').tab;
  assert.equal(E.tabCouponMove({ ...tAll, status: 'open' }, 'q0').to, '', 'لا جزء متبقٍ ⇒ يحرّره المستدعي');
  const src = fs.readFileSync(new URL('../mods/pos/PosApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /if \(priced\.coupon && priced\.coupon\.limited && !cpHeld\)/, 'لا حجز جديد للحجز المنقول');
  assert.match(src, /else if \(o\.couponLtd\) cpnRelease\(o\.coupon, useId/, 'التحرير فقط حين لا نقل');
  assert.doesNotMatch(src, /cpRel\.then\(okR/, 'لا تحرير ثم نقل');
  assert.match(src, /const rv = await cpnReserve\(code, \{ id: cp0\.use/, 'الحجز عند حفظ التقسيم بالتساوي');
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

/* ---------------- (4/E/F) التعارضات والسجل المحمي ---------------- */
const bm = { id: 'u-bm', name: 'مدير الفرع', role: 'branch_manager', email: 'bm@t.sa' };
const ops0 = () => {
  const o1 = { id: 'o1', no: 'ف1-A-0001', branchId: 'b1', date: D, at: AT, kind: 'sale', status: 'paid', by: 'كاشير أ', total: 50, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 50 }] };
  const o2 = { id: 'o2', no: 'ف1-B-0001', branchId: 'b1', date: D, at: AT, kind: 'sale', status: 'paid', by: 'كاشير ب', byId: 'u-c', byEmail: 'c@t.sa', total: 50, lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 50 }] };
  const t = { id: 't9', branchId: 'b1', table: '9', status: 'paid', orderId: 'o1', orderNo: o1.no, closedAt: AT, conflicts: [{ orderId: 'o2', orderNo: o2.no, at: AT, total: 50, partId: '', why: 'الحساب لم يعد مفتوحًا', off: true }] };
  return { posOrders: [o1, o2], posTabs: [t] };
};
const offOrg = { posCfg: { offline: true } };
const R0 = (x = {}) => ({ branchId: 'b1', orderId: 'o2', tabId: 't9', act: 'keep', by: 'bm@t.sa', byName: 'مدير الفرع', at: AT, ...x });

test('(4) دفع الحساب كاملًا من جهازين دون اتصال: الثاني يُسجَّل تعارضًا (موسومًا) ولا يستبدل الختم؛ بلا العمل دون اتصال كما كان حرفيًا', () => {
  const open = { id: 't9', branchId: 'b1', table: '9', status: 'open' }, o = { id: 'o2', no: 'N2', at: AT, total: 50 };
  assert.deepEqual(E.tabPayWhole(open, o, 'ك', true), { tab: { ...open, status: 'paid', orderId: 'o2', orderNo: 'N2', closedAt: AT, closedBy: 'ك' } });
  const paid = { ...open, status: 'paid', orderId: 'o1', orderNo: 'N1' };
  const R = E.tabPayWhole(paid, o, 'ك', true); assert.match(R.err, /لم يعد مفتوحًا/);
  assert.deepEqual([R.tab.orderId, R.tab.conflicts.map(c => [c.orderNo, c.off])], ['o1', [['N2', true]]]);
  assert.deepEqual(E.tabPayWhole(paid, o, 'ك', false), { tab: { ...paid, status: 'paid', orderId: 'o2', orderNo: 'N2', closedAt: AT, closedBy: 'ك' } }, 'بلا تفعيل: السلوك السابق');
});

test('(E) الحسم يُقرأ من السجل المحمي وحده — لا من مستند الفرع؛ ومانع الإغلاق فاشل مغلق؛ والمسجّل دون اتصال يبقى معتبرًا ولو أُطفئ المفتاح', () => {
  const ops = ops0();
  assert.deepEqual(E.posConflicts(ops, 'b1', null, []).map(c => [c.table, c.orderNo, c.by, c.byEmail, c.date, c.off, c.res]), [['9', 'ف1-B-0001', 'كاشير ب', 'c@t.sa', D, true, null]]);
  // حسم مزوّر في مستند الفرع لا يُعتد به
  const forged = { ...ops, posTabs: [{ ...ops.posTabs[0], conflicts: [{ ...ops.posTabs[0].conflicts[0], res: { act: 'keep' }, resAt: AT }] }] };
  assert.equal(E.posConflictBlock(offOrg, forged, 'b1', D, []).length, 1, 'res في مستند الفرع لا يحسم');
  assert.equal(E.posConflictBlock(offOrg, ops, 'b1', D, null).length, 1, 'تعذّر قراءة السجل ⇒ غير محسوم');
  assert.equal(E.posConflictBlock(offOrg, ops, 'b1', D, [R0()]).length, 0, 'محسوم في السجل المحمي');
  assert.equal(E.posConflictBlock(offOrg, ops, 'b1', D, [R0({ branchId: 'b2' })]).length, 1, 'حسم بفرع آخر لا يُعتد به');
  assert.equal(E.posConflictBlock({}, ops, 'b1', D, []).length, 1, 'المسجّل دون اتصال يبقى ظاهرًا ولو أُطفئ المفتاح');
  const legacy = { ...ops, posTabs: [{ ...ops.posTabs[0], conflicts: [{ ...ops.posTabs[0].conflicts[0], off: undefined }] }] };
  assert.equal(E.posConflictBlock({}, legacy, 'b1', D, []).length, 0, 'تعارض v56.52 القديم بلا وسم وبلا تفعيل ⇒ لا منع جديد');
  assert.equal(E.posConflictBlock(offOrg, legacy, 'b1', D, []).length, 1);
  assert.equal(E.posConflictBlock(offOrg, ops, 'b1', '2026-11-21', []).length, 0, 'يوم آخر');
});

test('(E) posConflictResolve: مدير الفرع ومسؤول النظام فقط، ولا يحسمه المُصدِر (المعرّف ثم البريد ثم الاسم)، و«إلغاء بمرتجع» بمستند؛ ويعيد محتوى السجل المحمي', () => {
  const ops = ops0();
  for (const role of ['cashier', 'regional_manager', 'head_office', 'accountant', 'general_management']) assert.match(E.posConflictResolve(ops, 't9', 'o2', 'keep', { id: 'x', name: 'س', role }, []).err, /لمدير الفرع/, role);
  const R = E.posConflictResolve(ops, 't9', 'o2', 'keep', bm, []);
  assert.deepEqual(R.rec, { branchId: 'b1', orderId: 'o2', tabId: 't9', act: 'keep', byName: 'مدير الفرع' }, 'by/at/cv يضيفها الكاتب والقواعد');
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'keep', bm, [R0()]).err, /سابقًا/);
  assert.equal(E.posConflictResolve(ops, 't9', 'o2', 'keep', { id: 'sa', name: 'مسؤول', role: 'system_admin' }, []).err, undefined);
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'keep', { id: 'u-c', name: 'آخر', role: 'branch_manager' }, []).err, /من أصدر/, 'بالمعرّف');
  const noId = { ...ops, posOrders: [ops.posOrders[0], { ...ops.posOrders[1], byId: undefined }] };
  assert.match(E.posConflictResolve(noId, 't9', 'o2', 'keep', { id: 'z', name: 'آخر', role: 'branch_manager', email: 'C@t.sa' }, []).err, /من أصدر/, 'بالبريد');
  const byName = { ...ops, posTabs: [{ ...ops.posTabs[0], conflicts: [{ ...ops.posTabs[0].conflicts[0], orderId: 'o1' }] }] };
  assert.match(E.posConflictResolve(byName, 't9', 'o1', 'keep', { id: 'z', name: 'كاشير أ', role: 'branch_manager' }, []).err, /من أصدر/, 'بالاسم حين لا معرّف ولا بريد');
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'delete', bm, []).err, /إبقاء/);
  assert.match(E.posConflictResolve(ops, 't9', 'oZ', 'keep', bm, []).err, /غير موجود/);
  assert.match(E.posConflictResolve({ ...ops, posOrders: [ops.posOrders[0]] }, 't9', 'o2', 'keep', bm, []).err, /لم تصل/);
  assert.match(E.posConflictResolve(ops, 't9', 'o2', 'void', bm, []).err, /مرتجعًا كاملًا/);
  const o2 = ops.posOrders[1];
  const part = { ...ops, posOrders: [ops.posOrders[0], { ...o2, lines: [{ ...o2.lines[0], qty: 2 }] }, { id: 'r1', kind: 'return', refId: 'o2', no: 'م1-B-0001', status: 'paid', retLines: [{ i: 0, qty: 1 }] }] };
  assert.match(E.posConflictResolve(part, 't9', 'o2', 'void', bm, []).err, /مرتجعًا كاملًا/, 'مرتجع جزئي');
  const full = { ...ops, posOrders: [...ops.posOrders, { id: 'r1', kind: 'return', refId: 'o2', no: 'م1-B-0001', status: 'paid', retLines: [{ i: 0, qty: 1 }] }] };
  assert.deepEqual(E.posConflictResolve(full, 't9', 'o2', 'void', bm, []).rec, { branchId: 'b1', orderId: 'o2', tabId: 't9', act: 'void', byName: 'مدير الفرع', doc: 'م1-B-0001', retId: 'r1' });
  const vd = { ...ops, posOrders: [ops.posOrders[0], { ...o2, status: 'void', voidNote: { no: 'م1-B-0002' } }] };
  assert.deepEqual([E.posConflictResolve(vd, 't9', 'o2', 'void', bm, []).rec.doc, 'retId' in E.posConflictResolve(vd, 't9', 'o2', 'void', bm, []).rec], ['م1-B-0002', false]);
  assert.deepEqual(E.POS_CONFLICT_ROLES, ['branch_manager', 'system_admin']);
});

test('(E) الكتابة والقراءة المحمية: pos_conflict_res/{orderId} ببريد الحساب ووقت الخادم؛ بلا هوية ⇒ رفض صريح؛ ورفض القواعد برسالة', async () => {
  const W = []; const mk = (fail) => ({ email: 'bm@t.sa', f: { db: 'DB', doc: (db, c, id) => ({ c, id }), serverTimestamp: () => 'TS', collection: (db, c) => ({ c }), query: (col, w) => ({ ...col, w }), where: (k, op, v) => [k, op, v],
    setDoc: async (ref, data) => { if (fail) { const e = new Error('x'); e.code = 'permission-denied'; throw e; } W.push([ref, data]); },
    getDocs: async (q) => ({ docs: [{ id: 'o2', data: () => ({ branchId: 'b1', act: 'keep', by: 'bm@t.sa', at: { toDate: () => new Date(AT) } }) }] }) } });
  const rec = { branchId: 'b1', orderId: 'o2', tabId: 't9', act: 'keep', byName: 'م' };
  assert.deepEqual(await E.pcrWrite(rec, mk()), { ok: true });
  assert.deepEqual(W[0][0], { c: 'pos_conflict_res', id: 'o2' }); assert.equal(W[0][1].by, 'bm@t.sa'); assert.equal(W[0][1].at, 'TS'); assert.equal(typeof W[0][1].cv, 'number');
  assert.match((await E.pcrWrite(rec, mk(true))).err, /رفضت القواعد/);
  const L = await E.pcrLoad(['b1'], false, mk()); assert.deepEqual(L, [{ id: 'o2', branchId: 'b1', act: 'keep', by: 'bm@t.sa', at: AT, orderId: 'o2' }]);
  assert.deepEqual(E.pcrCached(), L);
  const shifts = fs.readFileSync(new URL('../mods/pos/PosShifts.jsx', import.meta.url), 'utf8');
  assert.match(shifts, /const W = await pcrWrite\(pre\.rec\); if \(W\.err\) return say\(W\.err, 'no'\);/, 'لا حسم بلا السجل المحمي');
  assert.doesNotMatch(shifts, /tabConflictSet/);
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /match \/pos_conflict_res\/\{id\} \{\s+allow read: if sigRead\(resource\.data\.branchId\);\s+allow create: if pcrCreate\(id, request\.resource\.data\);\s+allow update, delete: if false;/);
  assert.match(rules, /get\(op\)\.data\.by != userEmail\(\)/, 'فصل المهام بالبريد من السجل المحمي');
});

test('(F) تعارض وصل بعد ترحيل إغلاق يومه يوسم الإغلاق، ويظهر في مهام الإقفال، ولا يُقلَّم أبدًا ما لم يُحسم', () => {
  const ops = { ...ops0(), closings: [{ id: 'c1', branchId: 'b1', date: D, status: 'submitted' }, { id: 'c0', branchId: 'b1', date: '2026-11-19', status: 'approved' }, { id: 'c2', branchId: 'b1', date: D, status: 'draft' }] };
  assert.deepEqual(E.posConflictLate({}, ops, []), [{ closingId: 'c1', branchId: 'b1', date: D, n: 1 }]);
  assert.deepEqual(E.posConflictLate({}, ops, [R0()]), []);
  const ck = (res) => E.closeAutoChecks({ entries: [] }, { ...ops, posConflictRes: res }, '2026-11', {}).find(x => x.k === 'posconf');
  assert.deepEqual([ck([]).n, ck([]).ok], [1, false]); assert.equal(ck([R0()]), undefined);
  assert.equal(E.closeAutoChecks({ entries: [] }, { ...ops, posTabs: [] }, '2026-11', {}).find(x => x.k === 'posconf'), undefined, 'بلا تعارضات لا بند');
  const t = (id, closedAt, c) => ({ id, branchId: 'b1', status: 'paid', closedAt, conflicts: [{ orderId: 'o', ...c }] });
  const d = E.posTrim({ posTabs: [t('a', '2025-01-01T10:00:00Z', { off: true }), t('b', '2026-11-01T10:00:00Z', { off: true, resAt: AT }), t('c', '2026-11-01T10:00:00Z', {}), t('d', '2026-09-01T10:00:00Z', {}), { id: 'e', status: 'paid', closedAt: '2026-11-01T10:00:00Z' }] }, '2026-11-27');
  assert.deepEqual(d.posTabs.map(x => x.id), ['a', 'c'], 'دون اتصال غير محسوم: أبدًا؛ القديم بلا وسم: 60 يومًا؛ المحسوم: 7 كما كان');
  assert.match(fs.readFileSync(new URL('../mods/closing/Closing.jsx', import.meta.url), 'utf8'), /data-lateconf/);
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

test('(G) حد الكاش يشمل الصفحات: الممتلئ لا يُضاف إليه صفحة جديدة ويُحدَّث الموجود؛ والقائمة المقصوصة تُعلَّم ولا تُسقط بصمت', async () => {
  const full = () => new Map(Array.from({ length: 80 }, (_, i) => ['https://pos.example/assets/f' + i + '-AbC123xy.js', 'x']));
  const S = loadSw({ fetch: async (r, res) => res('NET') }); S.store.set('muktasab-pos-shell-v56.56', full());
  await S.fire('fetch', { url: 'https://pos.example/', method: 'GET', mode: 'navigate' }); await new Promise(r => setTimeout(r, 15));
  assert.equal(S.store.get('muktasab-pos-shell-v56.56').has('https://pos.example/'), false, 'صفحة جديدة فوق الحد لا تُخزَّن');
  const m = full(); m.delete('https://pos.example/assets/f0-AbC123xy.js'); m.set('https://pos.example/', 'OLD'); S.store.set('muktasab-pos-shell-v56.56', m);
  await S.fire('fetch', { url: 'https://pos.example/', method: 'GET', mode: 'navigate' }); await new Promise(r => setTimeout(r, 15));
  assert.equal(S.store.get('muktasab-pos-shell-v56.56').get('https://pos.example/').body, 'NET', 'الموجود يُحدَّث'); assert.equal(S.store.get('muktasab-pos-shell-v56.56').size, 80);
  const warn = console.warn; const W = []; console.warn = (x) => W.push(x);
  try { assert.deepEqual(await E.posSwShellList(async () => ({ ok: true, json: async () => ({ files: ['/assets/a-AbC123xy.js'], truncated: true, total: 75 }) }), '/p'), ['/assets/a-AbC123xy.js']); } finally { console.warn = warn; }
  assert.match(W.join(' '), /مقصوص \(75/);
  assert.match(fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8'), /truncated: true, total: all\.length/);
});

test('(قرار المجلس) خصومات الجزء المتساوي تُقيَّد وتُعرض كفاتورة كاملة: طاولة 100 بكوبون 6 على جزأين ⇒ 4101 86.96 · 4104 5.22 · 2301 12.26 كالفاتورة الواحدة', () => {
  const ta = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 2, price: 50 }] }] });
  const prs = [{ id: 'cp', name: 'كوبون 6', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 5 }];
  const P = E.posPriceCart(cart(ta), [{ id: 'x' }], prs, { now, code: 'T6', uses: {} }); assert.equal(P.orderDisc, 6);
  const T = E.posTotals(P.lines, P.orderDisc, 15);
  const whole = { id: 'w', branchId: 'b1', date: D, status: 'paid', kind: 'sale', lines: P.lines, gross: T.gross, disc: T.disc, orderDisc: 6, orderPromo: P.orderPromo, coupon: 'T6', total: T.total, vat: T.vat, net: T.net, rate: 15 };
  const S = E.tabSplitEqual(ta, 2, P, 15);
  const parts = S.parts.map((p, i) => ({ id: 'p' + i, branchId: 'b1', date: D, status: 'paid', kind: 'sale', lines: p.lines, eqItems: p.eqItems, tabEq: p.eq, gross: p.gross, disc: 0, manualDisc: 0, total: p.total, vat: p.vat, net: p.net, rate: 15 }));
  assert.deepEqual(parts.map(o => [o.total, o.vat, o.gross, o.disc]), [[47, 6.13, 47, 0], [47, 6.13, 47, 0]], 'حقول الفاتورة نفسها لا تُمس');
  const gl = (os) => E.posGlLines(E.posGlDay(os, 'b1', D, 0, 15)).map(l => l.join(':'));
  // الفاتورة الواحدة: الضريبة 12.26 والصافي 81.74 والخصم 6 × 81.74/94 = 5.22 ⇒ 4101 = 86.96
  assert.deepEqual(gl([whole]), ['4101:0:86.96', '4104:5.22:0', '2301:0:12.26']);
  // الجزآن: ضريبة كل جزء round(47×15/115) = 6.13 (مجموعهما 12.26 كالواحدة في هذا المثال)، والخصم 3 × 40.87/47 = 2.61 لكل جزء ⇒ 5.22
  assert.deepEqual(gl(parts), gl([whole]), 'القيد نفسه');
  const st = E.posOrdersStats(parts), sw = E.posOrdersStats([whole]);
  assert.deepEqual([st.gross, st.odisc, st.promo], [sw.gross, sw.odisc, sw.promo]); assert.deepEqual(st.promo, { 'كوبون 6': 6 });
  assert.deepEqual(E.posDiscOf(parts[0]), { lines: parts[0].eqItems, od: 3, orderPromo: P.orderPromo, disc: 3, gross: 50, coupon: 'T6' });
  // فاتورة عادية ⇒ كما كان حرفيًا
  assert.deepEqual([E.posDiscOf(whole).disc, E.posDiscOf(whole).gross, E.posDiscOf(whole).od], [6, 100, 6]);
  // في أمثلة أخرى قد تختلف ضريبة الأجزاء عن ضريبة فاتورة واحدة بهللات (كل جزء فاتورة مستقلة — قرار المجلس B): 2301 = ضرائب الفواتير الصادرة، و4101 يقابلها
  const t3 = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'طبق', qty: 1, price: 10 }] }] }); const P3 = E.posPriceCart(cart(t3), [{ id: 'x' }], [], { now });
  const S3 = E.tabSplitEqual(t3, 3, P3, 15).parts.map((p, i) => ({ id: 'q' + i, branchId: 'b1', date: D, status: 'paid', kind: 'sale', lines: p.lines, eqItems: p.eqItems, tabEq: p.eq, total: p.total, vat: p.vat, rate: 15 }));
  const d3 = E.posGlDay(S3, 'b1', D, 0, 15); assert.deepEqual([d3.total, d3.vat], [10, R2(S3.reduce((a, o) => a + o.vat, 0))], 'الضريبة = مجموع ضرائب الفواتير الصادرة'); assert.equal(H(d3.net) + H(d3.vat), 1000);
});

test('(m1) قائمة التعارضات المحمية: حذف tab.conflicts أو تعديلها لا يخفي تعارضًا مسجّلًا، وتعذّر القراءة يمنع، والمصالحة تكتب الناقص', async () => {
  const ops = ops0(); const pcf = [{ branchId: 'b1', orderId: 'o2', tabId: 't9', table: '9', date: D, orderNo: 'ف1-B-0001', why: 'الحساب لم يعد مفتوحًا', total: 50 }];
  const wiped = { ...ops, posTabs: [{ ...ops.posTabs[0], conflicts: [] }] };
  assert.equal(E.posConflictBlock({}, wiped, 'b1', D, [], []).length, 0, 'بلا السجل المحمي يُخفيه الحذف (ما عالجه القرار)');
  assert.deepEqual(E.posConflictBlock({}, wiped, 'b1', D, [], pcf).map(c => [c.orderNo, c.table, c.rec]), [['ف1-B-0001', '9', true]], 'السجل المحمي يُظهره');
  const altered = { ...ops, posTabs: [{ ...ops.posTabs[0], conflicts: [{ ...ops.posTabs[0].conflicts[0], off: false, at: '2026-01-01' }] }] };
  assert.equal(E.posConflictBlock({}, altered, 'b1', D, [], pcf).length, 1, 'تعديل الوسم أو التاريخ لا يُخفيه');
  assert.equal(E.posConflictBlock({}, wiped, 'b1', D, [R0()], pcf).length, 0, 'المحسوم في pos_conflict_res');
  assert.equal(E.posConflictBlock({}, ops, 'b1', D, [], pcf).length, 1, 'لا تكرار بين السجل والحساب');
  assert.deepEqual(E.posConflictBlock(offOrg, ops, 'b1', D, [], null).map(c => c.readErr), [true], 'فشل مغلق');
  assert.deepEqual(E.posConflictLate({}, { ...wiped, closings: [{ id: 'c1', branchId: 'b1', date: D, status: 'approved' }] }, [], pcf), [{ closingId: 'c1', branchId: 'b1', date: D, n: 1 }]);
  assert.equal(E.closeAutoChecks({ entries: [] }, { ...wiped, posConflictRes: [], posConflictRecs: pcf }, '2026-11', {}).find(x => x.k === 'posconf').n, 1);
  // المصالحة: الموسوم دون اتصال بلا سجل محمي ⇒ يُكتب
  assert.deepEqual(E.pcfMissing(ops, [], ['b1']), [{ branchId: 'b1', orderId: 'o2', tabId: 't9', date: D, table: '9', orderNo: 'ف1-B-0001', why: 'الحساب لم يعد مفتوحًا', total: 50 }]);
  assert.deepEqual(E.pcfMissing(ops, pcf, ['b1']), []); assert.deepEqual(E.pcfMissing(ops, [], ['b2']), []);
  const W = []; let fails = 2; const c = { email: 'c@t.sa', f: { db: 'DB', doc: (db, k, id) => ({ k, id }), serverTimestamp: () => 'TS', setDoc: async (r, d) => { if (fails-- > 0) { const e = new Error('x'); e.code = 'permission-denied'; throw e; } W.push([r, d]); } } };
  assert.deepEqual(await E.pcfPut(E.pcfRec(pcf[0]), c, [0, 1, 1]), { ok: true }, 'يُعاد حتى يصل السجل المحمي للفاتورة');
  assert.deepEqual([W[0][0], W[0][1].by, W[0][1].at], [{ k: 'pos_conflicts', id: 'o2' }, 'c@t.sa', 'TS']);
  assert.match(fs.readFileSync(new URL('../mods/pos/PosApp.jsx', import.meta.url), 'utf8'), /if \(ok && clash && offOn\) pcfPut\(pcfRec\(/, 'يُكتب عند الرصد');
});
