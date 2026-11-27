/**
 * v56.52 — نقطة البيع، المرحلة 3: المطعم (docs/pos/POS_AUDIT_REPORT.md §10).
 * الأرقام وهمية ومحسوبة يدويًا. الأسعار شاملة ضريبة 15%:
 *   طاولة 2: كبسة 2×57.50 = 115.00 · حمص 3×18.40 = 55.20 · شاي 1×4.60 = 4.60 ⇒ الإجمالي 174.80 (17,480 هللة)
 *   تقسيم بالأصناف إلى جزأين: (كبسة×2 + شاي) = 119.60 ، (حمص×3) = 55.20 ⇒ 119.60 + 55.20 = 174.80
 *   الضريبة لكل جزء = الإجمالي × 15 ÷ 115: 119.60 ⇒ 15.60 ، 55.20 ⇒ 7.20 (مجموعها 22.80 = ضريبة الحساب كاملًا)
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildEngine } from './build-engine.mjs';

let E;
before(async () => { E = await buildEngine(); });

const AT = '2026-11-20T12:00:00.000Z';
const tab = (x = {}) => ({ id: 't2', branchId: 'b1', table: '2', status: 'open', openedAt: AT, rounds: [
  { at: AT, by: 'كاشير', lines: [{ productId: 'k', name: 'كبسة', qty: 2, price: 57.5 }, { productId: 'h', name: 'حمص', qty: 1, price: 18.4 }] },
  { at: AT, by: 'كاشير', lines: [{ productId: 'h', name: 'حمص', qty: 2, price: 18.4 }, { productId: 't', name: 'شاي', qty: 1, price: 4.6 }] }], ...x });
const products = [{ id: 'k', name: 'كبسة', cat: 'رئيسي', sellPrice: 57.5, parts: [{ itemId: 'rice', qty: 0.25 }, { itemId: 'chk', qty: 0.5 }] },
  { id: 'h', name: 'حمص', cat: 'مقبلات', sellPrice: 18.4, parts: [{ itemId: 'chick', qty: 0.1 }] },
  { id: 't', name: 'شاي', cat: 'مشروبات', sellPrice: 4.6, parts: [{ itemId: 'tea', qty: 0.01 }] }];
const items = [{ id: 'rice', name: 'أرز', type: 'stock' }, { id: 'chk', name: 'دجاج', type: 'stock' }, { id: 'chick', name: 'حمص حب', type: 'stock' }, { id: 'tea', name: 'شاي', type: 'stock' }];
// توزيع أسطر tabRemain (بترتيب الظهور: كبسة، حمص، شاي) على جزأين
const ALLOC = { 0: [2, 0], 1: [0, 3], 2: [1, 0] };
const order = (id, lines, x = {}) => { const T = E.posTotals(lines, 0, 15); return { id, no: 'ف1-' + id, branchId: 'b1', date: '2026-11-20', at: AT, status: 'paid', channel: 'dinein', table: '2', lines, total: T.total, vat: T.vat, net: T.net, rate: 15, ...x }; };

test('بلا تفعيل: الإعداد مُطفأ، والحساب والتذاكر والصالات كما كانت', () => {
  const c = E.restCfg({ posCfg: { tables: { b1: 4 }, kds: true } });
  assert.deepEqual(c, { covers: false, waiters: false, merge: false, split: false, stations: false, rush: false, prepRpt: false, prepTarget: 0 });
  assert.deepEqual(E.restCfg({}), c);
  // المتبقي = tabSum نفسه حرفيًا بلا تقسيم
  assert.deepEqual(E.tabRemain(tab()), E.tabSum(tab()));
  // التذكرة واحدة كما كانت (بلا محطة ولا أولوية ولا مجموعة) حتى لو طُلب «مستعجل» والمفتاح مطفأ
  const org = { posCfg: { kds: true, stations: { b1: [{ id: 's1', name: 'شواية', cats: ['رئيسي'] }] } } };
  const L = E.kdsSplit(org, 'b1', { branchId: 'b1', src: 'tab', table: '2', lines: tab().rounds[0].lines, at: AT, rush: true }, products);
  assert.equal(L.length, 1);
  assert.deepEqual(Object.keys(L[0]).sort(), ['at', 'branchId', 'by', 'channel', 'id', 'lines', 'ref', 'src', 'status', 'table']);
  assert.equal(JSON.stringify(L[0]).includes('price'), false, 'المطبخ لا يرى الأسعار');
  // الحساب بلا تقسيم: tabSplitReset يعيده كما هو
  const t0 = tab(); assert.equal(E.tabSplitReset(t0), t0);
  // ترتيب التذاكر بلا وسم «مستعجل»: الأقدم أولًا كما كان
  const live = E.kdsLive({ kdsTickets: [{ id: 'a', branchId: 'b1', status: 'new', at: '2026-11-20T12:05:00Z' }, { id: 'b', branchId: 'b1', status: 'new', at: '2026-11-20T12:01:00Z' }] }, 'b1');
  assert.deepEqual(live.map(x => x.id), ['b', 'a']);
  // الصالات بلا أشخاص: perHead = null والمجاميع كما هي
  const SA = E.salesByArea({ posCfg: { tables: { b1: 4 } } }, { posOrders: [order('o1', [{ productId: 'k', name: 'كبسة', qty: 1, price: 57.5 }])] }, 'b1', '2026-11-20', '2026-11-20');
  assert.deepEqual(SA.map(x => [x.name, x.orders, x.total, x.covers, x.perHead]), [['بلا صالة', 1, 57.5, 0, null]]);
});

test('عدد الأشخاص والنادل: التحقق، قائمة النُّدُل من موظفي الفرع، ومبيعات النادل ومتوسط الفاتورة للشخص بالهللة', () => {
  assert.deepEqual(['3', '٤', 0, '', '100', '2.5', -1, 99].map(E.coversOf), [3, 4, 0, 0, 0, 0, 0, 99]);
  const org = { employees: [{ id: 'e1', name: 'نادل أ', branchId: 'b1' }, { id: 'e2', name: 'نادل ب', branchId: 'b1', status: 'terminated' }, { id: 'e3', name: 'نادل ج', branchId: 'b2' }, { id: 'e4', name: 'نادل د', branchId: 'b1', isActive: false }, { id: 'e5', name: 'نادل هـ', branchId: 'b1' }] };
  assert.deepEqual(E.posWaiters(org, 'b1'), [{ id: 'e1', name: 'نادل أ' }, { id: 'e5', name: 'نادل هـ' }]);
  const kb = [{ productId: 'k', name: 'كبسة', qty: 2, price: 57.5 }];
  const ops = { posOrders: [
    order('o1', kb, { waiterId: 'e1', waiterName: 'نادل أ', covers: 3, shiftId: 's1' }),                       // 115.00
    order('o2', [{ productId: 'h', name: 'حمص', qty: 1, price: 18.4 }], { waiterId: 'e1', waiterName: 'نادل أ', shiftId: 's2' }),   // 18.40 (جزء ثانٍ بلا أشخاص)
    order('o3', [{ productId: 't', name: 'شاي', qty: 1, price: 4.6 }], { waiterId: 'e5', waiterName: 'نادل هـ', covers: 1, shiftId: 's1' }),
    order('o4', kb, { waiterId: 'e5', waiterName: 'نادل هـ', status: 'void' }),                                 // ملغاة لا تُحتسب
    order('o5', kb, {}),                                                                                         // بلا نادل لا تظهر
    { id: 'r1', kind: 'return', refId: 'o2', branchId: 'b1', date: '2026-11-20', status: 'paid', total: -18.4, waiterId: 'e1', waiterName: 'نادل أ', shiftId: 's2' }] };
  assert.deepEqual(E.salesByWaiter(ops, 'b1', '2026-11-20', '2026-11-20'), [
    { id: 'e1', name: 'نادل أ', orders: 2, covers: 3, total: 115, returns: 18.4, avg: 57.5, perHead: 38.33 },
    { id: 'e5', name: 'نادل هـ', orders: 1, covers: 1, total: 4.6, returns: 0, avg: 4.6, perHead: 4.6 }]);
  assert.deepEqual(E.salesByWaiter(ops, 'b1', '2026-11-20', '2026-11-20', 's1').map(x => [x.id, x.total]), [['e1', 115], ['e5', 4.6]], 'تصفية الوردية');
  assert.deepEqual(E.salesByWaiter(ops, 'b1', '2026-11-21', '2026-11-21'), [], 'يوم آخر');
  // الصالات: o1 (115 بثلاثة أشخاص) + o2 (18.40) + o3 (4.60 بشخص) + o5 (115) = 253؛ المرتجع r1 بلا صالة مختومة لا يُطرح
  // «للشخص» (بعد التحقق) من الفواتير التي لها أشخاص فقط: (115 + 4.60) ÷ 4 = 29.90 — لا 253 ÷ 4
  const SA = E.salesByArea({ posCfg: { tables: { b1: 4 } } }, ops, 'b1', '2026-11-20', '2026-11-20');
  assert.deepEqual(SA.map(x => [x.orders, x.total, x.covers, x.perHead, x.returns]), [[4, 253, 4, 29.9, 0]]);
  // المرتجع المختوم بصالته يُطرح من مبيعاتها، والمرتجع عن فاتورة لها أشخاص يُطرح من بسط «للشخص»
  const ops2 = { posOrders: [...ops.posOrders, { id: 'r2', kind: 'return', refId: 'o1', branchId: 'b1', date: '2026-11-20', status: 'paid', total: -57.5, retArea: { id: '', name: 'بلا صالة' } }] };
  assert.deepEqual(E.salesByArea({ posCfg: { tables: { b1: 4 } } }, ops2, 'b1', '2026-11-20', '2026-11-20').map(x => [x.total, x.returns, x.perHead]), [[195.5, 57.5, 15.53]], '253 − 57.50؛ (57.50 + 4.60) ÷ 4 = 15.525');
  assert.deepEqual(E.salesByArea({ posCfg: { tables: { b1: 4 } } }, ops, 'b1', '2026-11-21', '2026-11-21'), [], 'تصفية التاريخ (كانت معطّلة داخل تعليق)');
  // إلغاء الجزء الأول ينقل أشخاصه إلى أول جزء غير ملغى من الحساب نفسه
  const vo = { posOrders: [order('q1', kb, { tabId: 'T', tabPart: 1, covers: 4, status: 'void', waiterId: 'e1' }), order('q2', kb, { tabId: 'T', tabPart: 2, waiterId: 'e1' }), order('q3', kb, { tabId: 'T', tabPart: 3, waiterId: 'e1' })] };
  assert.deepEqual([...E.coversEff(vo.posOrders)], [['q2', 4]]);
  assert.deepEqual(E.salesByWaiter(vo, 'b1').map(x => [x.orders, x.covers, x.total, x.perHead]), [[2, 4, 230, 28.75]]);
});

test('التقسيم بالأصناف: كل جزء فاتورة، المجموع = الحساب بالهللة، والضريبة صحيحة لكل جزء', () => {
  const t = tab(); const R = E.tabRemain(t);
  assert.deepEqual(R.lines.map(l => [l.name, l.qty, l.price]), [['كبسة', 2, 57.5], ['حمص', 3, 18.4], ['شاي', 1, 4.6]]);
  assert.equal(R.total, 174.8);
  const S = E.tabSplitItems(t, ALLOC, 2);
  assert.equal(S.err, undefined);
  assert.deepEqual(S.parts.map(p => [p.no, p.total, p.gross, p.lines.map(l => l.name + '×' + l.qty).join('،')]), [[1, 119.6, 119.6, 'كبسة×2،شاي×1'], [2, 55.2, 55.2, 'حمص×3']]);
  assert.equal(new Set(S.parts.map(p => p.id)).size, 2); assert.ok(S.parts.every(p => /^sp-/.test(p.id)), 'معرّف فريد لكل جزء (لا p1/p2)');
  assert.equal(S.parts.reduce((a, p) => a + E.toHal(p.total), 0), 17480, 'المجموع بالهللة');
  const T = S.parts.map(p => E.posTotals(p.lines, 0, 15));
  assert.deepEqual(T.map(x => [x.total, x.vat, x.net]), [[119.6, 15.6, 104], [55.2, 7.2, 48]]);
  assert.equal(E.toHal(T[0].vat) + E.toHal(T[1].vat), E.toHal(E.posTotals(R.lines, 0, 15).vat), 'ضريبة الأجزاء = ضريبة الحساب (22.80)');
  // التحقق من المدخلات
  assert.match(E.tabSplitItems(t, ALLOC, 1).err, /من 2 إلى 10/);
  assert.match(E.tabSplitItems(t, { 0: [1, 0], 1: [0, 3], 2: [1, 0] }, 2).err, /وزّع كل كمية «كبسة» \(2\)/);
  assert.match(E.tabSplitItems(t, { 0: [2, 0], 1: [3, 0], 2: [1, 0] }, 2).err, /كل جزء يحتاج صنفًا/);
  assert.match(E.tabSplitItems(t, { 0: [1.5, 0.5], 1: [0, 3], 2: [1, 0] }, 2).err, /كميات صحيحة/);
  // ثلاثة أجزاء بأسعار كسرية: لا ضياع هللة
  const t3 = tab({ rounds: [{ at: AT, lines: [{ productId: 'x', name: 'صنف', qty: 3, price: 33.33 }, { productId: 'y', name: 'آخر', qty: 1, price: 0.01 }] }] });
  const S3 = E.tabSplitItems(t3, { 0: [1, 1, 1], 1: [0, 0, 1] }, 3);
  assert.deepEqual(S3.parts.map(p => p.total), [33.33, 33.33, 33.34]); assert.equal(S3.total, 100);
});

const payO = (t, pt, id, x = {}) => ({ id, no: 'ف1-' + id, at: AT, total: pt.total, lines: pt.lines, tabSplitVer: t.split.ver, ...x });
test('دفع الأجزاء: يُختم كل جزء بفاتورته، يُغلق الحساب بآخرها، ولا يُدفع جزء مرتين؛ والجولة الجديدة تسقط الأجزاء غير المدفوعة', () => {
  const S = E.tabSplitItems(tab(), ALLOC, 2);
  let t = E.tabSplitSet(tab(), S.parts, { at: AT, by: 'مدير' });
  assert.equal(t.split.parts.length, 2); assert.equal(t.status, 'open'); assert.ok(t.split.ver);
  const [p1, p2] = t.split.parts;
  let R = E.tabPayPart(t, p1.id, payO(t, p1, 'o1'), 'كاشير'); assert.equal(R.err, undefined); t = R.tab;
  assert.equal(t.status, 'open'); assert.equal(t.split.parts[0].orderNo, 'ف1-o1');
  assert.deepEqual(E.tabRemain(t).lines.map(l => [l.name, l.qty]), [['حمص', 3]]); assert.equal(E.tabRemain(t).total, 55.2);
  R = E.tabPayPart(t, p1.id, payO(t, p1, 'oX'), 'ك'); assert.match(R.err, /مدفوع/, 'لا يُدفع جزء مرتين'); assert.deepEqual(E.tabRemain(R.tab), E.tabRemain(t));
  // جولة جديدة قبل دفع الجزء الثاني: يُسقط الجزء غير المدفوع ويبقى المدفوع
  const tR = E.tabSplitReset(t); assert.deepEqual(tR.split.parts.map(p => p.id), [p1.id]); assert.notEqual(tR.split.ver, t.split.ver);
  // إعادة التقسيم على المتبقي ترقّم بعد المدفوع
  const t2r = { ...tR, rounds: [...tR.rounds, { at: AT, lines: [{ productId: 't', name: 'شاي', qty: 2, price: 4.6 }] }] };
  const S2 = E.tabSplitItems(t2r, { 0: [3, 0], 1: [0, 2] }, 2);
  assert.deepEqual(S2.parts.map(p => [p.no, p.total]), [[2, 55.2], [3, 9.2]]);
  // إكمال الدفع يغلق الحساب
  R = E.tabPayPart(t, p2.id, payO(t, p2, 'o2'), 'كاشير'); t = R.tab;
  assert.deepEqual([R.err, t.status, t.orderId, t.orderNo, t.closedBy], [undefined, 'paid', 'o2', 'ف1-o2', 'كاشير']);
  assert.deepEqual(E.tabRemain(t).lines, []);
  assert.match(E.tabPayPart(t, p2.id, payO(t, p2, 'o3'), 'ك').err, /لم يعد مفتوحًا/);
  // بلا تقسيم غير مدفوع: tabSplitReset يحذف الحقل
  const u = E.tabSplitReset(E.tabSplitSet(tab(), S.parts, { at: AT })); assert.equal('split' in u, false);
});

test('التزامن: دفع جزء قديم بعد إعادة التقسيم من جهاز آخر ⇒ يُرفض ويُسجَّل تعارضًا، والمتبقي صحيح', () => {
  const t0 = E.tabSplitSet(tab(), E.tabSplitItems(tab(), ALLOC, 2).parts, { at: AT });
  const old2 = t0.split.parts[1];   // الجهاز أ بدأ دفع الجزء 2 (حمص×3)
  // الجهاز ب أعاد التقسيم: (كبسة×2) | (حمص×3 + شاي)
  const t1 = E.tabSplitSet(t0, E.tabSplitItems(t0, { 0: [2, 0], 1: [0, 3], 2: [0, 1] }, 2).parts, { at: AT });
  assert.notEqual(t1.split.ver, t0.split.ver);
  const R = E.tabPayPart(t1, old2.id, payO(t0, old2, 'oA'), 'أ');
  assert.match(R.err, /أُعيد تقسيم/);
  assert.deepEqual(R.tab.conflicts.map(c => [c.orderNo, c.total]), [['ف1-oA', 55.2]]);
  assert.deepEqual(E.tabRemain(R.tab), E.tabRemain(t1), 'المتبقي لا يتغير'); assert.equal(E.tabRemain(R.tab).total, 174.8);
  assert.ok(R.tab.split.parts.every(p => !p.orderId));
  // نفس النسخة لكن أسطر الفاتورة مختلفة عن الجزء ⇒ رفض
  const p1 = t1.split.parts[0];
  assert.match(E.tabPayPart(t1, p1.id, payO(t1, p1, 'oB', { lines: [{ productId: 'k', name: 'كبسة', qty: 1, price: 57.5 }] }), 'ب').err, /تختلف/);
  // الجزء الجديد بنسخته الصحيحة يُختم
  assert.equal(E.tabPayPart(t1, p1.id, payO(t1, p1, 'oC'), 'ب').err, undefined);
});

test('العروض على الطاولة كاملة مرة واحدة: خصم الفاتورة يُوزَّع بنسبة صافي الأجزاء، و«اشترِ 2 واحصل على 1» يبقى على أسطره', () => {
  const T = (lines) => tab({ rounds: [{ at: AT, lines }] });
  const cart = (t) => E.tabRemain(t).lines.map((l, i) => ({ ...l, key: 'r' + i }));
  const now = new Date('2026-11-20T12:00:00');
  // (أ) خصم ثابت 10 على الفاتورة بحد أدنى 40: الطاولة 100 مقسّمة 50|50 ⇒ الخصم 10 مرة واحدة (5 + 5) لا 20
  const ta = T([{ productId: 'x', name: 'طبق', qty: 2, price: 50 }]);
  const od = [{ id: 'od', name: 'خصم 10', type: 'order', mode: 'amt', value: 10, minTotal: 40 }];
  const PA = E.posPriceCart(cart(ta), [{ id: 'x', cat: 'رئيسي' }], od, { now });
  assert.equal(PA.orderDisc, 10);
  const SA = E.tabSplitItems(ta, { 0: [1, 1] }, 2, PA);
  assert.deepEqual(SA.parts.map(p => [p.gross, p.orderDisc, p.total]), [[50, 5, 45], [50, 5, 45]]);
  assert.equal(SA.total, 90);
  // دون تسعير الطاولة كاملة كانت كل فاتورة 50 ≥ 40 تأخذ 10 (المجموع 20 — هذا ما عالجه القرار)
  assert.equal(E.posPriceCart([{ key: 'a', productId: 'x', name: 'طبق', qty: 1, price: 50 }], [{ id: 'x' }], od, { now }).orderDisc, 10);
  // خصم الفاتورة على صافٍ غير متساوٍ: 10 على 70|30 ⇒ 7 | 3، والفرق بالهللة على الأخير (10 على 3 أجزاء متساوية ⇒ 3.33|3.33|3.34)
  const t3 = T([{ productId: 'x', name: 'طبق', qty: 3, price: 20 }]);
  const S3 = E.tabSplitItems(t3, { 0: [1, 1, 1] }, 3, E.posPriceCart(cart(t3), [{ id: 'x' }], od, { now }));
  assert.deepEqual(S3.parts.map(p => p.orderDisc), [3.33, 3.33, 3.34]); assert.equal(S3.parts.reduce((a, p) => a + E.toHal(p.total), 0), 5000);
  // (ب) اشترِ 2 واحصل على 1: 3 × 23 ⇒ خصم 23 يبقى 23 عند التقسيم 2|1 (15.33 + 7.67)
  const tb = T([{ productId: 'b', name: 'برجر', qty: 3, price: 23 }, { productId: 't', name: 'شاي', qty: 1, price: 4.6 }]);
  const bx = [{ id: 'bx', name: '2+1', type: 'bxgy', x: 2, y: 1, scope: 'items', items: ['b'] }];
  const PB = E.posPriceCart(cart(tb), [{ id: 'b' }, { id: 't' }], bx, { now });
  assert.equal(PB.lines[0].disc, 23);
  const SB = E.tabSplitItems(tb, { 0: [2, 1], 1: [0, 1] }, 2, PB);
  assert.deepEqual(SB.parts.map(p => p.lines.map(l => [l.name, l.qty, l.disc || 0, l.promoName || ''])), [[['برجر', 2, 15.33, '2+1']], [['برجر', 1, 7.67, '2+1'], ['شاي', 1, 0, '']]]);
  assert.equal(SB.parts.reduce((a, p) => a + p.lines.reduce((b, l) => b + E.toHal(l.disc), 0), 0), 2300, 'الخصم يبقى 23');
  assert.deepEqual(SB.parts.map(p => p.total), [30.67, 19.93]); assert.equal(SB.total, 50.6, '69 + 4.60 − 23');
  // التسعير المجمّد للدفع يعطي الإجمالي والضريبة نفسيهما لكل جزء
  const FZ = SB.parts.map(p => { const f = E.tabPartPriced(p); return E.posTotals(f.lines, f.orderDisc, 15); });
  assert.deepEqual(FZ.map(x => [x.total, x.vat]), [[30.67, 4], [19.93, 2.6]]);
  // الكوبون يُستهلك على الجزء الأول فقط
  const cp = [{ id: 'cp', name: 'كوبون', type: 'order', mode: 'amt', value: 6, code: 'T6', maxUses: 5 }];
  const PC = E.posPriceCart(cart(ta), [{ id: 'x' }], cp, { now, code: 'T6', uses: {} });
  const SC = E.tabSplitItems(ta, { 0: [1, 1] }, 2, PC);
  assert.deepEqual(SC.parts.map(p => [p.total, !!p.coupon]), [[47, true], [47, false]]);
  assert.deepEqual([E.tabPartPriced(SC.parts[0]).codeOk, E.tabPartPriced(SC.parts[1]).codeOk], [true, false]);
  // تسعير لا يطابق الأسطر ⇒ رفض
  assert.match(E.tabSplitItems(ta, { 0: [1, 1] }, 2, { lines: [], sub: 0, orderDisc: 0 }).err, /لا يطابق/);
});

test('المخزون لا يتضاعف ولا ينقص: فاتورتا الجزأين تخصمان مثل فاتورة الحساب كاملًا', () => {
  const org = { products, items };
  const S = E.tabSplitItems(tab(), ALLOC, 2);
  const whole = E.saleDayUse(org, { posOrders: [order('w', E.tabRemain(tab()).lines)] }, 'b1', '2026-11-20');
  const parts = E.saleDayUse(org, { posOrders: S.parts.map((p, i) => order('p' + i, p.lines, { tabId: 't2', tabPart: p.no, tabParts: 2 })) }, 'b1', '2026-11-20');
  assert.deepEqual(parts, whole);
  assert.deepEqual(whole, { rice: 0.5, chk: 1, chick: 0.3, tea: 0.01 });
  // إلغاء جزء يعيد مكوّناته وحدها
  const one = E.saleDayUse(org, { posOrders: S.parts.map((p, i) => order('p' + i, p.lines, { status: i ? 'void' : 'paid' })) }, 'b1', '2026-11-20');
  assert.deepEqual(one, { rice: 0.5, chk: 1, tea: 0.01 });
});

test('دمج الطاولات: الجولات تنتقل (والمرسلة للمطبخ تبقى)، الأشخاص تُجمع، سجل تدقيق، والرفض عند جزء مدفوع', () => {
  const a = tab({ id: 'ta', table: '3', covers: 2, rounds: [{ at: AT, by: 'ك', lines: [{ productId: 'h', name: 'حمص', qty: 1, price: 18.4 }] }] });
  const b = tab({ id: 'tb', table: '2', covers: 3 });
  const M = E.tabMerge(a, b, { at: AT, by: 'مدير' });
  assert.equal(M.err, undefined);
  assert.equal(M.into.rounds.length, 3); assert.equal(M.into.rounds[2].from, '3');
  assert.equal(E.tabSum(M.into).total, 193.2, '174.80 + 18.40');
  assert.equal(M.into.covers, 5);
  assert.deepEqual(M.into.mergeLog, [{ at: AT, by: 'مدير', from: '3', tabId: 'ta', total: 18.4 }]);
  assert.deepEqual([M.from.status, M.from.mergedInto, M.from.mergedTo, M.from.closedBy], ['merged', 'tb', '2', 'مدير']);
  assert.equal(E.openTab({ posTabs: [M.from, M.into] }, 'b1', '3'), null, 'الطاولة 3 تصبح متاحة');
  assert.match(E.tabMerge(a, a).err, /مختلفتين/);
  assert.match(E.tabMerge({ ...a, status: 'paid' }, b).err, /المفتوحة/);
  assert.match(E.tabMerge(a, { ...b, branchId: 'b2' }).err, /الفرع/);
  const bs = E.tabSplitSet(b, E.tabSplitItems(b, ALLOC, 2).parts); const paid = E.tabPayPart(bs, bs.split.parts[0].id, payO(bs, bs.split.parts[0], 'o'), 'ك').tab;
  assert.match(E.tabMerge(a, paid).err, /دُفع جزء/);
  // خطة تقسيم غير مدفوعة على الوجهة تسقط بالدمج (تُعاد القسمة على المجموع)
  assert.equal('split' in E.tabMerge(a, E.tabSplitSet(b, E.tabSplitItems(b, ALLOC, 2).parts)).into, false);
});

test('محطات المطبخ: توزيع التذكرة لكل محطة (المنتج قبل التصنيف، وغير المربوط «عام»)، «مستعجل» أولًا، وأخطاء الإعداد', () => {
  const org = { posCfg: { kds: true, rest: { stations: true, rush: true }, stations: { b1: [{ id: 'g', name: 'شواية', cats: ['رئيسي'] }, { id: 'd', name: 'مشروبات', cats: ['مشروبات'], prods: ['h'] }, { id: '', name: 'بلا معرّف' }] } } };
  assert.deepEqual(E.kdsStations(org, 'b1').map(s => s.name), ['شواية', 'مشروبات']);
  assert.deepEqual(E.kdsStations(org, 'b2'), []);
  const lines = [...tab().rounds[0].lines, { productId: 't', name: 'شاي', qty: 1, price: 4.6 }, { productId: 'z', name: 'صنف محذوف', qty: 1, price: 1 }];
  const L = E.kdsSplit(org, 'b1', { branchId: 'b1', src: 'tab', table: '2', channel: 'dinein', lines, at: AT, by: 'ك', rush: true }, products);
  assert.deepEqual(L.map(k => [k.station, k.stationName, k.lines.map(l => l.name).join('،'), k.rush]), [['g', 'شواية', 'كبسة', true], ['d', 'مشروبات', 'حمص،شاي', true], ['', 'عام', 'صنف محذوف', true]]);
  assert.equal(new Set(L.map(k => k.grp)).size, 1, 'مجموعة واحدة'); assert.equal(new Set(L.map(k => k.id)).size, 3);
  assert.equal(JSON.stringify(L).includes('price'), false);
  // بلا «مستعجل» مطلوب: لا وسم
  assert.equal(E.kdsSplit(org, 'b1', { branchId: 'b1', lines, at: AT }, products).some(k => 'rush' in k), false);
  // محطات معرّفة لكن المفتاح مطفأ ⇒ تذكرة واحدة
  assert.equal(E.kdsSplit({ posCfg: { ...org.posCfg, rest: {} } }, 'b1', { branchId: 'b1', lines, at: AT }, products).length, 1);
  // الأولوية
  const live = E.kdsLive({ kdsTickets: [{ id: 'a', branchId: 'b1', status: 'new', at: '2026-11-20T12:01:00Z' }, { id: 'b', branchId: 'b1', status: 'prep', at: '2026-11-20T12:09:00Z', rush: true }, { id: 'c', branchId: 'b1', status: 'new', at: '2026-11-20T12:05:00Z', rush: true }] }, 'b1');
  assert.deepEqual(live.map(x => x.id), ['c', 'b', 'a']);
  // أخطاء الإعداد
  assert.equal(E.kdsStationsErr([{ name: 'شواية', cats: ['رئيسي'] }, { name: 'مقلاة', cats: ['مقبلات'] }]), '');
  assert.equal(E.kdsStationsErr([{ name: '', cats: [] }]), '', 'السطر الفارغ يُتجاهل');
  assert.match(E.kdsStationsErr([{ name: '', cats: ['رئيسي'] }]), /اسم كل محطة/);
  assert.match(E.kdsStationsErr([{ name: 'أ' }, { name: 'أ', cats: ['x'] }]), /مكرر/);
  assert.match(E.kdsStationsErr([{ name: 'أ', cats: ['رئيسي'] }, { name: 'ب', cats: ['رئيسي'] }]), /«رئيسي» مربوط بمحطتين/);
  assert.match(E.kdsStationsErr([{ name: 'أ', prods: ['k'] }, { name: 'ب', prods: ['k'] }]), /منتج مربوط بمحطتين/);
});

test('تقرير أوقات التحضير: من الوصول حتى «جاهز» لكل محطة ولكل صنف، ونسبة المتأخر عن الهدف، وأوراق Excel', () => {
  const t = (id, st, at, readyAt, lines, x = {}) => ({ id, branchId: 'b1', station: st, stationName: st === 'g' ? 'شواية' : 'مشروبات', at, readyAt, status: 'ready', lines, ...x });
  const K = [
    t('1', 'g', '2026-11-20T12:00:00Z', '2026-11-20T12:08:00Z', [{ name: 'كبسة', qty: 2 }]),          // 8 د
    t('2', 'g', '2026-11-20T12:00:00Z', '2026-11-20T12:20:00Z', [{ name: 'كبسة', qty: 1 }, { name: 'مشويات', qty: 1 }]),   // 20 د (متأخر عن 15)
    t('3', 'd', '2026-11-20T12:00:00Z', '2026-11-20T12:03:00Z', [{ name: 'شاي', qty: 3 }]),            // 3 د
    t('4', 'd', '2026-11-20T12:00:00Z', '', [{ name: 'شاي', qty: 1 }], { status: 'prep' }),            // لم يجهز ⇒ لا يُحتسب
    t('5', 'g', '2026-11-20T12:00:00Z', '2026-11-20T12:30:00Z', [{ name: 'كبسة', qty: 1 }], { branchId: 'b2' }),   // فرع آخر
    t('6', 'g', '2026-11-25T12:00:00Z', '2026-11-25T12:30:00Z', [{ name: 'كبسة', qty: 1 }])];         // خارج الفترة
  const R = E.kdsPrepReport(K, { branchId: 'b1', from: '2026-11-20', to: '2026-11-20', target: 15 });
  assert.deepEqual([R.n, R.avg, R.late, R.latePct, R.target], [3, 10.3, 1, 33.3, 15]);
  assert.deepEqual(R.stations.map(x => [x.name, x.n, x.avg, x.max, x.late, x.latePct]), [['شواية', 2, 14, 20, 1, 50], ['مشروبات', 1, 3, 3, 0, 0]]);
  assert.deepEqual(R.items.map(x => [x.name, x.n, x.qty, x.avg, x.late, x.latePct]), [['مشويات', 1, 1, 20, 1, 100], ['كبسة', 2, 3, 14, 1, 50], ['شاي', 1, 3, 3, 0, 0]]);
  // بلا هدف: لا نسبة تأخر (لا افتراض لهدف)
  const R0 = E.kdsPrepReport(K, { branchId: 'b1', from: '2026-11-20', to: '2026-11-20' });
  assert.deepEqual([R0.late, R0.latePct, R0.stations[0].latePct], [0, null, null]);
  // تذاكر بلا محطات (الشاشة الواحدة) ⇒ «المطبخ»
  assert.deepEqual(E.kdsPrepReport([{ ...K[0], station: undefined, stationName: undefined }]).stations.map(x => x.name), ['المطبخ']);
  const X = E.kdsPrepSheets(R);
  assert.deepEqual(X.map(s => s.name), ['حسب المحطة', 'حسب الصنف']);
  assert.deepEqual(X[0].rows[1], ['شواية', 2, 14, 20, 1, 50]);
  assert.ok(E.makeXlsx(X).size > 500, 'ملف Excel');
});
