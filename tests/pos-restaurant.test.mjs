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
    { id: 'r1', kind: 'return', branchId: 'b1', date: '2026-11-20', status: 'paid', total: -18.4, waiterId: 'e1', waiterName: 'نادل أ', shiftId: 's2' }] };
  assert.deepEqual(E.salesByWaiter(ops, 'b1', '2026-11-20', '2026-11-20'), [
    { id: 'e1', name: 'نادل أ', orders: 2, covers: 3, total: 115, returns: 18.4, avg: 57.5, perHead: 38.33 },
    { id: 'e5', name: 'نادل هـ', orders: 1, covers: 1, total: 4.6, returns: 0, avg: 4.6, perHead: 4.6 }]);
  assert.deepEqual(E.salesByWaiter(ops, 'b1', '2026-11-20', '2026-11-20', 's1').map(x => [x.id, x.total]), [['e1', 115], ['e5', 4.6]], 'تصفية الوردية');
  assert.deepEqual(E.salesByWaiter(ops, 'b1', '2026-11-21', '2026-11-21'), [], 'يوم آخر');
  // الصالات: o1 (115 بثلاثة أشخاص) + o2 (18.40) + o3 (4.60 بشخص) + o5 (115) — الملغاة والمرتجع خارجها ⇒ 253 ÷ 4 أشخاص
  const SA = E.salesByArea({ posCfg: { tables: { b1: 4 } } }, ops, 'b1', '2026-11-20', '2026-11-20');
  assert.deepEqual(SA.map(x => [x.orders, x.total, x.covers, x.perHead]), [[4, 253, 4, 63.25]], '115+18.4+4.6+115 = 253 ÷ 4 = 63.25');
});

test('التقسيم بالأصناف: كل جزء فاتورة، المجموع = الحساب بالهللة، والضريبة صحيحة لكل جزء', () => {
  const t = tab(); const R = E.tabRemain(t);
  assert.deepEqual(R.lines.map(l => [l.name, l.qty, l.price]), [['كبسة', 2, 57.5], ['حمص', 3, 18.4], ['شاي', 1, 4.6]]);
  assert.equal(R.total, 174.8);
  const S = E.tabSplitItems(t, ALLOC, 2);
  assert.equal(S.err, undefined);
  assert.deepEqual(S.parts.map(p => [p.id, p.no, p.total, p.lines.map(l => l.name + '×' + l.qty).join('،')]), [['p1', 1, 119.6, 'كبسة×2،شاي×1'], ['p2', 2, 55.2, 'حمص×3']]);
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

test('دفع الأجزاء: يُختم كل جزء بفاتورته، يُغلق الحساب بآخرها، ولا يُدفع جزء مرتين؛ والجولة الجديدة تسقط الأجزاء غير المدفوعة', () => {
  const S = E.tabSplitItems(tab(), ALLOC, 2);
  let t = E.tabSplitSet(tab(), S.parts, { at: AT, by: 'مدير' });
  assert.equal(t.split.parts.length, 2); assert.equal(t.status, 'open');
  t = E.tabPayPart(t, 'p1', { id: 'o1', no: 'ف1-1', at: AT }, 'كاشير');
  assert.equal(t.status, 'open'); assert.equal(t.split.parts[0].orderNo, 'ف1-1');
  assert.deepEqual(E.tabRemain(t).lines.map(l => [l.name, l.qty]), [['حمص', 3]]); assert.equal(E.tabRemain(t).total, 55.2);
  assert.equal(E.tabPayPart(t, 'p1', { id: 'oX', no: 'X', at: AT }, 'ك'), t, 'لا يُدفع جزء مرتين');
  // جولة جديدة قبل دفع الجزء الثاني: يُسقط الجزء غير المدفوع ويبقى المدفوع
  const tR = E.tabSplitReset(t); assert.deepEqual(tR.split.parts.map(p => p.id), ['p1']);
  // إعادة التقسيم على المتبقي ترقّم بعد المدفوع
  const t2r = { ...tR, rounds: [...tR.rounds, { at: AT, lines: [{ productId: 't', name: 'شاي', qty: 2, price: 4.6 }] }] };
  const S2 = E.tabSplitItems(t2r, { 0: [3, 0], 1: [0, 2] }, 2);
  assert.deepEqual(S2.parts.map(p => [p.id, p.total]), [['p2', 55.2], ['p3', 9.2]]);
  // إكمال الدفع يغلق الحساب
  t = E.tabPayPart(t, 'p2', { id: 'o2', no: 'ف1-2', at: AT }, 'كاشير');
  assert.deepEqual([t.status, t.orderId, t.orderNo, t.closedBy], ['paid', 'o2', 'ف1-2', 'كاشير']);
  assert.deepEqual(E.tabRemain(t).lines, []);
  // بلا تقسيم غير مدفوع: tabSplitReset يحذف الحقل
  const u = E.tabSplitReset(E.tabSplitSet(tab(), S.parts, { at: AT })); assert.equal('split' in u, false);
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
  const paid = E.tabPayPart(E.tabSplitSet(b, E.tabSplitItems(b, ALLOC, 2).parts), 'p1', { id: 'o', no: 'n', at: AT }, 'ك');
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
