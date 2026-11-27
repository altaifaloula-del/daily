/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { cloud, KEYS, brKey, bfKey } from '../../storage';
import { Store, X, RefreshCw, FileText, Clock, ShieldCheck, Check, Plus, Printer, Download, Lock, Banknote, ChefHat, LayoutGrid, Send, Truck } from 'lucide-react';
import { posAreas, tableArea, salesByArea, DLV_ST, posDrivers, dlvNeeded, dlvRecord, dlvMove, dlvSummary } from '../../App.jsx';   // v49.2 التوصيل   // v49.2 الصالات
import { posTables, kdsOn, openTab, tabSum, tableStates, KDS_NEXT, KDS_ST, kdsLive, kdsTicket, posTrim } from '../../App.jsx';   // v42.9
import { couponWhy, cpnReserve, cpnRelease, loyEarnX, loyTier, loyGet } from '../../App.jsx';
import { domFilter, domOk, userBrIds, DomainChips, ROLES as ROLES_D } from '../../App.jsx';   // v53.0 مجالات النشاط   // v48.1 الكوبونات المحدودة والولاء المتقدم
import { posReturnable, posReturnCalc, posRefundOptions, posReturnHtml, posReturnLoyDed, WASTE_REASONS } from '../../App.jsx';   // v46.8 المرتجع
import { posDocView, APPS, CloudHealth, Field, Modal, Num, POS_SH_KEY, PosLoyalty, PosPromos, PosQuickProducts, PosSettings, PosShifts, QUOTA_MSG, ROLES, businessDay, isoD, logClientError, loyBal, loyEarn, loyPost, loyQ, loyQSet, loyRedeemMax, makeXlsx, money, normPhone, nowISO, pendShiftsGet, pendShiftsSet, posCashNet, posDaySummary, posDev, posOrdersStats, posPriceCart, posPrint, posQueue, posQueueSet, posR2, posReceiptHtml, posTotals, posZHtml, promoActive, promoHits, sha256Hex, uid, recCfgOf, recIndex, recFor } from '../../App.jsx';

import { posAppPricesOn, posAppHasPrices, posPriceListErr } from '../../App.jsx';   // v56.47 (P4) قوائم أسعار التطبيقات
import { posHolds, posHoldsSet, posHoldPut, posHoldRecall } from '../../App.jsx';   // v56.0 (GAP-007) تعليق الطلب واستدعاؤه
import { posVoidBlock, posNextNo, posTabCuts, escH, POS_VOID_ROLES } from '../../App.jsx';   // v56.2 (POS دفعة 1) حراس الإلغاء والترقيم وحساب الطاولة
import { posCreditList, posCreditAuthApi, posArRefundMax } from '../../App.jsx';   // v56.46 البيع الآجل
import { restCfg, coversOf, posWaiters, salesByWaiter, tabRemain, tabSplitItems, tabSplitSet, tabPartPriced, tabSplitReset, tabPayPart, tabMerge, kdsStations, kdsSplit, kdsPrepReport, kdsPrepSheets } from '../../App.jsx';   // v56.52 المطعم (مُطفأة افتراضيًا)
import { posOffOn, POS_OB_USED, posObItem, posObSort, posStoreOpen, posLegacyQ, posObMigrate, posObRestore, posSyncRun, posSyncLogList, posSyncDelay, posSyncErr, posOffRetCheck, posOffRetPending, posOffRetReview } from '../../App.jsx';   // v56.53 العمل دون اتصال (مُطفأ افتراضيًا)

/* v56.53 — صندوق الصادر (IndexedDB «muktasab-pos») حين org.posCfg.offline — بلا تفعيل لا يُفتح شيء ويبقى الطابور القديم حرفيًا.
   مرآة في الذاكرة (items) للقراءات المتزامنة (الترقيم وقائمة الفواتير)، والكتابة تُنتظر حتى تكتمل المعاملة؛ إن أخفقت ⇒ الطابور القديم (لا فقد). */
function usePosOutbox(on, onRestored) {
  const ready = useRef(null); const items = useRef([]); const [ver, setVer] = useState(0);
  const [info, setInfo] = useState({ mode: '', lastOk: '', lastAt: '', fails: 0, nextAt: 0, lastErr: '' });
  const bump = () => setVer(v => v + 1);
  useEffect(() => {
    let dead = false;
    if (!on) {   // أُوقف بعد استخدام ⇒ يعود ما بقي إلى الطابور القديم (لا يُفتح IndexedDB أبدًا لمن لم يفعّل)
      let used = null; try { used = localStorage.getItem(POS_OB_USED); } catch { }
      if (used) posStoreOpen().then(s => posObRestore(s, posLegacyQ())).then(r => { if (r.ok) { try { localStorage.removeItem(POS_OB_USED); } catch { } } if (!dead && onRestored) onRestored(); }).catch(() => { });
      ready.current = null; items.current = []; return () => { dead = true; };
    }
    ready.current = posStoreOpen().then(async s => {
      try { localStorage.setItem(POS_OB_USED, '1'); } catch { }
      await posObMigrate(s, posLegacyQ()).catch(() => null);   // ترحيل آمن: يُعاد كل فتح (لا يكرر)، والقديم لا يُمسح إلا بعد التحقق
      const st = await s.list('outbox'); const ks = new Set(st.map(x => x.key));
      items.current = posObSort([...st, ...items.current.filter(x => !ks.has(x.key))]);
      if (!dead) { setInfo(i => ({ ...i, mode: s.mode })); bump(); } return s; });
    return () => { dead = true; };
  }, [on]);   // eslint-disable-line react-hooks/exhaustive-deps
  const list = (kind) => items.current.filter(x => x.kind === kind).map(x => x.data);
  const add = async (kind, arr) => {
    const its = (arr || []).filter(d => d && d.id != null).map((d, i) => posObItem(kind, d, i)); if (!its.length) return true;
    items.current = posObSort([...items.current.filter(x => !its.some(y => y.key === x.key)), ...its]); bump();
    try { const s = await ready.current; for (const it of its) await s.put('outbox', it); return true; }
    catch (e) {   // تعذّرت الكتابة في الصادر ⇒ الطابور القديم احتياطًا، ويُرحَّل في الفتح التالي
      const L = posLegacyQ(); if (kind !== 'ticket') { const cur = (L.read() || {})[kind] || []; L.write(kind, [...cur.filter(d => !its.some(y => y.data.id === d.id)), ...its.map(y => y.data)]); }
      logClientError(e, 'pos-outbox'); return false; }
  };
  const run = async (send) => {
    const s = await ready.current; if (!s) return null; let r;
    await posObMigrate(s, posLegacyQ()).catch(() => null);   // ما سقط احتياطًا في الطابور القديم يُرحَّل قبل كل مزامنة
    try { r = await posSyncRun(s, send); } catch (e) { r = { sent: 0, failed: 1, left: items.current.length, err: posSyncErr(e), done: [] }; }
    const st = await s.list('outbox').catch(() => null); const done = new Set(r.done || []);
    if (st) { const ks = new Set(st.map(x => x.key)); items.current = posObSort([...st, ...items.current.filter(x => !ks.has(x.key) && !done.has(x.key))]); }
    const at = new Date().toISOString();
    setInfo(i => { const fails = r.err ? i.fails + 1 : 0; return { ...i, lastAt: at, ...(r.err ? {} : { lastOk: at }), fails, nextAt: fails ? Date.now() + posSyncDelay(fails) : 0, lastErr: r.err || '' }; });
    bump(); return r;
  };
  const logs = async () => { const s = await ready.current; return s ? posSyncLogList(s) : []; };
  return { on, ver, info, list, add, run, logs, count: () => items.current.length };
}

export function PosApp({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const R = ROLES[me.role] || {};
  const isMgr = !!(R.admin || R.scope === 'all' || me.role === 'branch_manager' || me.role === 'regional_manager');
  // v56.6 (قرار المالك 2026-11-26): الإلغاء والمرتجع للإدارة التشغيلية فقط — يطابق قواعد سجلات pos_orders (posMgrRoles) وفصل المهام: من يدقق لا يلغي
  const canVoid = !!(R.admin || POS_VOID_ROLES.includes(me.role));
  const cfg = org.posCfg || {}; const enabled = cfg.branches || [];
  // v56.46: البيع الآجل — المفتاح من إعداد المنشأة، والعملاء المؤهلون (على الفرع: الاسم والمفتاح فقط)
  const creditOn = !!cfg.credit; const crCusts = creditOn ? posCreditList(org).map(c => ({ key: c.key || ('cust:' + c.id), name: c.name || '' })) : [];
  const brs = (myBranches || []).filter(b => b.isActive !== false && enabled.includes(b.id));
  const [brId, setBrId] = useState(() => (brs[0] || {}).id || '');
  const payBusy = useRef(false); const tabSent = useRef(null);   // v56.2: B2 قفل إتمام البيع · B7 أصناف الطاولة المُرسلة للمطبخ
  const br = brs.find(b => b.id === brId) || brs[0];
  const dev = useMemo(posDev, []);
  const rate = (org.taxCfg || {}).enabled ? (Number((org.taxCfg || {}).rate) || 15) : 0;
  const prods = (org.products || []).filter(p => !p.posOff && Number(p.sellPrice) > 0 && domOk(org, br && br.id, p));   // v53.0 مجال الفرع
  const noImg = !!(org.posCfg || {}).noImg;   // v45.4: إخفاء صور المنتجات من إعدادات نقطة البيع
  const cats = [...new Set(prods.map(p => p.cat || 'أخرى'))];
  const [cat, setCat] = useState(''); const [q, setQ] = useState('');
  const [cart, setCart] = useState([]); const [channel, setChannel] = useState('takeaway');
  const [priceList, setPriceList] = useState('');   // v56.47 (P4) قائمة الأسعار: '' = المطعم، أو معرّف التطبيق
  // v56.0 (GAP-007): الطلبات المعلّقة على هذا الجهاز لهذا الفرع — الخطافات هنا قبل أي «return» مبكر (قاعدة React)
  const [holds, setHolds] = useState(() => posHolds((br || {}).id)); const [holdOpen, setHoldOpen] = useState(false);
  useEffect(() => { setHolds(posHolds((br || {}).id)); setHoldOpen(false); }, [(br || {}).id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [disc, setDisc] = useState({ mode: 'amt', amt: '', reason: '' }); const [pay, setPay] = useState(null); const [last, setLast] = useState(null);
  const [code, setCode] = useState(''); const [quickP, setQuickP] = useState(false); const [diag, setDiag] = useState(false); const [sending, setSending] = useState(false); const [ext, setExt] = useState({ disc: false, code: false, loy: false }); const [ordF, setOrdF] = useState(() => ({ d: businessDay(), pay: 'all', q: '' })); const [cust, setCust] = useState({ phone: '', name: '', redeem: false });
  const loyCfg = org.loyaltyCfg || {}; const [loy, setLoy] = useState(null);
  // v48.1: يُحمَّل دفتر الولاء أيضًا إن وُجد كوبون محدود/مشروط (سجل الاستخدام فيه) — ويُحدَّث عند كتابة الرمز
  const needLoy = !!loyCfg.enabled || (org.posPromos || []).some(p => Number(p.maxUses) > 0 || Number(p.perCust) > 0 || p.firstOnly || p.loyOnly || p.custPhone);
  const lyScope = () => [(br || {}).id].filter(Boolean);   // v56.37: أسماء عملاء هذا الفرع فقط إن فُصلت
  const reloadLoy = () => loyGet(lyScope(), false).then(d => setLoy(d || { members: {}, tx: [] })).catch(() => { });
  useEffect(() => { if (!needLoy) return; let dead = false; loyGet(lyScope(), false).then(d => { if (!dead) setLoy(d || { members: {}, tx: [] }); }).catch(() => { }); return () => { dead = true; }; }, [needLoy]);
  useEffect(() => { if (!needLoy || !code.trim()) return; const t = setTimeout(reloadLoy, 350); return () => clearTimeout(t); }, [code, needLoy]);
  const [view, setView] = useState('sell'); const [showCart, setShowCart] = useState(false);
  const [ret, setRet] = useState(null);   // v46.8 نافذة المرتجع: { o, q:{i:qty}, reason, note, k }
  const [tbl, setTbl] = useState(''); const [areaF, setAreaF] = useState(''); const dlvOn = !!br && (posDrivers(org, br.id).length > 0 || (ops.posDeliveries || []).some(x => x.branchId === br.id)); const [dlv, setDlv] = useState({ phone: '', addr: '' }); const [payTab, setPayTab] = useState(null); const [tblSel, setTblSel] = useState(null); const [, setTick] = useState(0);   // v42.9
  const tables = br ? posTables(org, br.id) : []; const useTabs = tables.length > 0; const kds = kdsOn(org);
  // v56.52 — المطعم: الأشخاص، النادل، الدمج، التقسيم، محطات المطبخ والأولوية، تقرير أوقات التحضير (كلها من posCfg.rest، مُطفأة افتراضيًا)
  const RC = restCfg(org); const waiters = RC.waiters && br ? posWaiters(org, br.id) : []; const kdsSTs = kds && br ? kdsStations(org, br.id) : [];
  const [tmeta, setTmeta] = useState({ covers: '', waiterId: '' }); const [rush, setRush] = useState(false); const [payPart, setPayPart] = useState(null); const [splitF, setSplitF] = useState(null);
  const [kdsStM, setKdsStM] = useState(() => { try { return JSON.parse(localStorage.getItem('mizan:kdsStation') || '{}') || {}; } catch { return {}; } });
  const [rptF, setRptF] = useState(() => ({ d: businessDay(), sh: '' }));
  useEffect(() => { if (!useTabs && !kds) return; const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, [useTabs, kds]);   // تحديث الدقائق المنقضية (قبل أي عودة مبكرة — قاعدة الخطافات)
  const [queueL, setQueue] = useState(posQueue); const [cfgF, setCfgF] = useState(null); const [shiftF, setShiftF] = useState(null);
  // v56.53: العمل دون اتصال — مع التفعيل الصادر في IndexedDB بدل الطابور (queue/pendClose من الصادر)، وبلا تفعيل كما كان حرفيًا
  const offOn = posOffOn(org); const OB = usePosOutbox(offOn, () => { setQueue(posQueue()); setPendClose(pendShiftsGet()); });
  const queue = useMemo(() => offOn ? OB.list('order') : queueL, [offOn, OB.ver, queueL]);   // eslint-disable-line react-hooks/exhaustive-deps
  const qNow = () => offOn ? OB.list('order') : posQueue();   // للترقيم (posNextNo): الفواتير غير المرسلة على الجهاز
  const loyAdd = (a) => { if (!a.length) return; if (offOn) OB.add('loy', a); else loyQSet([...loyQ(), ...a]); };
  const [obLog, setObLog] = useState(null);   // سجل المزامنة للمدير
  const apps = org.deliveryApps || APPS;
  const apOn = posAppPricesOn(org); const plApps = apOn ? apps.filter(a => posAppHasPrices(org.products, a.id)) : []; const plId = apOn && !payTab && plApps.some(a => a.id === priceList) ? priceList : '';   // v56.47 (P4)
  const today = businessDay();
  // الطلبات = المتزامنة + المعلّقة على الجهاز
  const allOrders = useMemo(() => { const m = {}; (ops.posOrders || []).forEach(o => { m[o.id] = o; }); queue.forEach(o => { if (!m[o.id]) m[o.id] = { ...o, pending: true }; }); return Object.values(m); }, [ops.posOrders, queue]);
  // v33.3: الوردية تُفتح على الجهاز فورًا حتى لو تعذّر الحفظ السحابي، وتُرسل مع الطلبات عند عودة الاتصال
  const [localShift, setLocalShift] = useState(() => { try { return JSON.parse(localStorage.getItem(POS_SH_KEY) || 'null'); } catch { return null; } });
  const [pendCloseLS, setPendClose] = useState(pendShiftsGet); const pendCloseL = useMemo(() => offOn ? OB.list('shift') : pendCloseLS, [offOn, OB.ver, pendCloseLS]); const pendClose = pendCloseL.length ? pendCloseL : null;   // eslint-disable-line react-hooks/exhaustive-deps
  const cloudShift = (ops.posShifts || []).find(x => x.branchId === (br || {}).id && x.dev === dev.tag && x.status === 'open' && !pendCloseL.some(p => p.id === x.id));
  const shift = cloudShift || (localShift && localShift.branchId === (br || {}).id && localShift.dev === dev.tag && localShift.status === 'open' ? { ...localShift, pending: true } : null);
  const setLS = (v) => { try { if (v) localStorage.setItem(POS_SH_KEY, JSON.stringify(v)); else localStorage.removeItem(POS_SH_KEY); } catch { } setLocalShift(v); };
  // v34.0: التسعير = العروض وخصم الصنف (لكل سطر) ← عرض الفاتورة ← الخصم اليدوي (مبلغ أو نسبة) ← استبدال النقاط
  const phoneN0 = normPhone(cust.phone); const phone0 = phoneN0.length >= 9 ? phoneN0 : '';
  const cpOpt = { branchId: (br || {}).id, code, phone: phone0, isMember: !!(phone0 && loy && (loy.members || {})[phone0]), uses: loy ? (loy.cpn || {}) : null };
  // v56.52 (بعد التحقق): جزء الفاتورة المقسّمة يُدفع بتسعيره المجمّد من تسعير الطاولة كاملة مرة واحدة (العروض والكوبون موزّعة) — لا يُعاد تسعيره وحده
  const partNow = payTab && payPart ? ((((ops.posTabs || []).find(t => t.id === payTab) || {}).split || {}).parts || []).find(x => x.id === payPart && !x.orderId) || null : null;
  const frozenP = partNow ? tabPartPriced(partNow) : null; const cpCode = frozenP ? String((frozenP.coupon || {}).code || '') : code;
  const priced = frozenP ? { ...frozenP, lines: frozenP.lines.map((l, i) => ({ ...l, key: (cart[i] || {}).key })) } : posPriceCart(cart, org.products, org.posPromos, plId ? { ...cpOpt, priceList: plId } : cpOpt);   // v56.47 (P4): بلا قائمة كما كان
  const base1 = posR2(priced.sub - priced.orderDisc);
  const manual = disc.mode === 'pct' ? posR2(base1 * Math.min(100, Number(disc.amt) || 0) / 100) : Math.min(base1, posR2(disc.amt));
  const phoneN = normPhone(cust.phone); const phoneOk = phoneN.length >= 9;
  const loyBalance = phoneOk && loy ? loyBal(loy, phoneN) : 0;
  const redeemPts = phoneOk && loy && cust.redeem ? loyRedeemMax(loyCfg, loyBalance, posR2(base1 - manual)) : 0;
  const redeemAmt = posR2(redeemPts * (Number(loyCfg.ptValue) || 0));
  const T = posTotals(priced.lines, priced.orderDisc + manual + redeemAmt, rate);
  const tierNow = phoneOk && loy ? loyTier(org, loy, phoneN, today) : null;
  const earnPts = phoneOk && loyCfg.enabled ? loyEarnX(org, loyCfg, T.total, { tierMult: tierNow ? Number(tierNow.mult) || 1 : 1, branchId: (br || {}).id, lines: priced.lines }) : 0;   // v48.1 المستوى والفرع ونقاط المنتج
  const custName = phoneOk && loy ? (((loy.members || {})[phoneN] || {}).name || '') : '';
  // v52.2 — المرحلة G: توصيات عند الدفع من سلال الفرع الفعلية وطلبات العميل المعتادة؛ المعروض والمُغفل والمقبول يُحفظ مع الفاتورة نفسها
  const recCfg = recCfgOf(org); const [recSeen, setRecSeen] = useState([]); const [recDis, setRecDis] = useState([]);
  const recIdx = useMemo(() => (recCfg.on && br ? recIndex(ops.posOrders, { to: today, days: recCfg.days, branchId: br.id }) : null), [ops.posOrders, (br || {}).id, today, recCfg.on, recCfg.days]);
  const recs = recIdx && cart.length && !payTab ? recFor(recIdx, cart, prods, { cfg: recCfg, phone: phoneOk ? phoneN : '', dismissed: recDis }) : [];
  const recKey = recs.map(r => r.productId).join(',');
  useEffect(() => { if (recKey) setRecSeen(s => { const add = recKey.split(',').filter(x => !s.includes(x)); return add.length ? [...s, ...add] : s; }); }, [recKey]);
  useEffect(() => { if (!cart.length) { setRecSeen([]); setRecDis([]); setPriceList(''); } }, [cart.length]);
  const addRec = (r) => setCart(c => c.some(l => l.productId === r.productId) ? c : [...c, { key: uid('l'), productId: r.productId, name: r.name, price: r.price, qty: 1, note: '', rec: r.kind }]);
  // المزامنة: إرسال المعلّق ثم إزالته من الجهاز
  const flushRaw = useCallback(async () => {
    // الوردية المحلية أولًا (إن لم تصل السحابة بعد)
    let ls = null; try { ls = JSON.parse(localStorage.getItem(POS_SH_KEY) || 'null'); } catch { }
    if (ls) { const okS = await commit(d => (d.posShifts || []).some(x => x.id === ls.id) ? d : { ...d, posShifts: [ls, ...(d.posShifts || [])] });
      if (okS) { try { localStorage.removeItem(POS_SH_KEY); } catch { } setLocalShift(null); } else return; }
    if (offOn) {   // v56.53: محرك المزامنة بسجل — الفواتير ثم الورديات ثم الولاء، ولا حذف من الصادر إلا بعد تأكيد الحفظ
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      await OB.run(async (kind, list) => {
        if (kind === 'order') return (await commit(d => { const have = new Set((d.posOrders || []).map(o => o.id)); return { ...d, posOrders: [...list.filter(o => !have.has(o.id)), ...(d.posOrders || [])] }; })) === true;
        if (kind === 'shift') return (await commit(d => { let sl = d.posShifts || []; list.forEach(pc => { sl = sl.some(x => x.id === pc.id) ? sl.map(x => x.id === pc.id ? pc : x) : [pc, ...sl]; }); return { ...d, posShifts: sl }; })) === true;
        if (kind === 'loy') { const r = await loyPost(list); if (r) setLoy(r); return !!r; }
        return false;   // التذاكر: لا مستقبِل في 5أ (KDS المحلي في 5ب) — تبقى
      });
      return;
    }
    const qn = posQueue();
    if (qn.length) {
      const ok = await commit(d => { const have = new Set((d.posOrders || []).map(o => o.id)); return { ...d, posOrders: [...qn.filter(o => !have.has(o.id)), ...(d.posOrders || [])] }; });
      if (ok) { const rest = posQueue().filter(o => !qn.some(x => x.id === o.id)); posQueueSet(rest); setQueue(rest); } else return;
    }
    // إغلاق الوردية المعلّق (بعد وصول فواتيرها)
    const pcs = pendShiftsGet();
    if (pcs.length) { const okC = await commit(d => { let list = d.posShifts || []; pcs.forEach(pc => { list = list.some(x => x.id === pc.id) ? list.map(x => x.id === pc.id ? pc : x) : [pc, ...list]; }); return { ...d, posShifts: list }; });
      if (okC) { const rest = pendShiftsGet().filter(x => !pcs.some(p => p.id === x.id)); pendShiftsSet(rest); setPendClose(rest); } else return; }
    // نقاط الولاء بعد وصول الفواتير
    const lq = loyQ(); if (lq.length) { const r = await loyPost(lq); if (r) { loyQSet(loyQ().filter(t => !lq.some(x => x.id === t.id))); setLoy(r); } }
  }, [commit, offOn]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v34.7: لا إرسالان متداخلان — رفع مستند كبير قد يتجاوز فاصل الإرسال الدوري (20 ثانية)
  const flushing = useRef(false);
  const obNext = useRef(0); obNext.current = offOn ? OB.info.nextAt : 0;
  const flush = useCallback(async (force) => { if (flushing.current || cloud.quotaUntil()) return; if (force !== true && obNext.current > Date.now()) return;   /* v56.53: تباعد متزايد بعد الإخفاق (بلا تفعيل: 0 دائمًا) */ flushing.current = true; try { await flushRaw(); } finally { flushing.current = false; } }, [flushRaw]);
  useEffect(() => { flush(); const t = setInterval(flush, 20000); const on = () => flush(true); window.addEventListener('online', on); return () => { clearInterval(t); window.removeEventListener('online', on); }; }, [flush]);

  if (!brs.length) return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card"><div className="card-t" style={{ marginBottom: 8 }}><Store size={16} color="var(--brass)" />نقطة البيع — تجربة</div>
        <div className="note">نقطة البيع غير مفعّلة لفرعك بعد.{R.admin || R.scope === 'all' ? ' فعّلها لفرع التجربة من الإعدادات أدناه.' : ' يفعّلها مسؤول النظام لفرع التجربة.'}</div></div>
      {(R.admin || R.scope === 'all') && <PosSettings org={org} commitOrg={commitOrg} say={say} me={me} />}
    </div>);

  const add = (p) => setCart(c => { const i = c.findIndex(l => l.productId === p.id && !l.note); if (i >= 0) return c.map((l, k) => k === i ? { ...l, qty: l.qty + 1 } : l); return [...c, { key: uid('l'), productId: p.id, name: p.name, price: Number(p.sellPrice), qty: 1, note: '' }]; });
  const setQty = (key, d) => setCart(c => c.map(l => l.key === key ? { ...l, qty: Math.max(0, l.qty + d) } : l).filter(l => l.qty > 0));
  /* v42.9 — الطاولات والحساب المفتوح وشاشة المطبخ (مُطفأة افتراضيًا) */
  const sendRound = async () => {
    if (!cart.length) return; if (!tbl) return say('اختر الطاولة أولًا', 'no');
    if (payTab) return say('أنت في دفع حساب طاولة — أكمل الدفع أو ألغه', 'no');
    const lines = cart.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price, ...((l.note || '').trim() ? { note: l.note.trim() } : {}) }));
    const at = nowISO(), no = tbl;
    const cv = RC.covers ? coversOf(tmeta.covers) : 0, wt = RC.waiters ? waiters.find(w => w.id === tmeta.waiterId) : null;   // v56.52
    const meta = { ...(cv ? { covers: cv } : {}), ...(wt ? { waiterId: wt.id, waiterName: wt.name } : {}) };
    const ok = await commit(d => { const t0 = openTab(d, br.id, no);
      const tabs = t0 ? (d.posTabs || []).map(t => t.id === t0.id ? { ...tabSplitReset(t), ...meta, billAt: '', rounds: [...(t.rounds || []), { at, by: me.name, lines }] } : t)
        : [{ id: uid('tab'), branchId: br.id, table: no, status: 'open', openedAt: at, openedBy: me.name, ...meta, rounds: [{ at, by: me.name, lines }] }, ...(d.posTabs || [])];
      return posTrim({ ...d, posTabs: tabs, kdsTickets: kds ? [...(d.kdsTickets || []), ...kdsSplit(org, br.id, { branchId: br.id, src: 'tab', table: no, channel: 'dinein', lines, at, by: me.name, rush: RC.rush && rush }, org.products)] : (d.kdsTickets || []) }, today);
    }, { actionType: 'create', targetType: 'pos_tab', targetId: br.id + ':' + no, branchName: br.name, title: 'أرسل طلب الطاولة ' + no + (kds ? ' للمطبخ' : ''), details: lines.map(l => l.name + ' ×' + l.qty).join('، ').slice(0, 160) });
    if (ok) { setCart([]); setShowCart(false); setTmeta({ covers: '', waiterId: '' }); setRush(false); say('أُرسل طلب الطاولة ' + no + (kds ? ' للمطبخ' : '') + ' ✓'); }
  };
  const startPayTab = (t, part) => { const S = part ? { lines: part.lines } : tabRemain(t); tabSent.current = S.lines; setPayPart(part ? part.id : null);   /* v56.52: جزء من فاتورة مقسّمة، أو المتبقي (بلا تقسيم = tabSum) */ setCart(S.lines.map(l => ({ key: uid('l'), productId: l.productId, name: l.name, price: l.price, qty: l.qty, note: l.note || '' }))); setChannel('dinein'); setTbl(String(t.table)); setPayTab(t.id); setTblSel(null); setView('sell'); };
  const cancelPayTab = () => { setPayTab(null); setPayPart(null); setCart([]); tabSent.current = null; };
  const printBill = async (t) => { const S = tabSum(t);
    posPrint('<div style="font-family:sans-serif;direction:rtl;width:280px;font-size:13px"><h3 style="text-align:center;margin:4px 0">' + escH((org.company || {}).name) + '</h3><div style="text-align:center">' + escH(br.name) + ' · طاولة ' + escH(t.table) + '</div><div style="text-align:center;font-size:11px;margin:4px 0">فاتورة مبدئية — ليست فاتورة ضريبية</div><hr>' +
      S.lines.map(l => '<div style="display:flex;justify-content:space-between"><span>' + escH(l.name) + ' ×' + escH(l.qty) + '</span><span>' + (l.qty * l.price).toFixed(2) + '</span></div>').join('') + '<hr><div style="display:flex;justify-content:space-between;font-weight:700"><span>الإجمالي (شامل الضريبة)</span><span>' + S.total.toFixed(2) + '</span></div></div>');
    await commit(d => ({ ...d, posTabs: (d.posTabs || []).map(x => x.id === t.id ? { ...x, billAt: nowISO() } : x) })); setTblSel(null); };
  const moveTab = async (t, to) => { if (openTab(ops, br.id, to)) return say('الطاولة ' + to + ' مشغولة', 'no');
    let busy = false;   // v56.2 (B8): الإشغال يُفحص على أحدث نسخة داخل الحفظ (جهازان لا ينقلان لطاولة واحدة)
    const ok = await commit(d => { busy = false; if (openTab(d, br.id, to)) { busy = true; return d; } return { ...d, posTabs: (d.posTabs || []).map(x => x.id === t.id ? { ...x, table: String(to), movedFrom: t.table } : x) }; }, () => busy ? null : { actionType: 'update', targetType: 'pos_tab', targetId: t.id, branchName: br.name, title: 'نقل الطاولة ' + t.table + ' إلى ' + to });
    if (busy) return say('الطاولة ' + to + ' شُغلت للتو من جهاز آخر', 'no');
    if (ok) { setTblSel(null); say('نُقل الحساب إلى الطاولة ' + to); } };
  const kdsMove = async (k) => { const nx = KDS_NEXT[k.status]; if (!nx) return;
    await commit(d => posTrim({ ...d, kdsTickets: (d.kdsTickets || []).map(x => x.id === k.id ? { ...x, status: nx, [nx + 'At']: nowISO() } : x) }, today)); };
  /* v56.52 — المطعم */
  const kdsRush = async (k) => { await commit(d => ({ ...d, kdsTickets: (d.kdsTickets || []).map(x => x.id === k.id ? (x.rush ? (({ rush: _r, ...y }) => y)(x) : { ...x, rush: true }) : x) })); };
  const setTabMeta = async (t, patch) => {
    const p2 = {}; if ('covers' in patch) { const c = coversOf(patch.covers); if (patch.covers !== '' && !c) return say('عدد الأشخاص من 1 إلى 99', 'no'); p2.covers = c; }
    if ('waiterId' in patch) { const w = waiters.find(x => x.id === patch.waiterId); p2.waiterId = w ? w.id : ''; p2.waiterName = w ? w.name : ''; }
    await commit(d => ({ ...d, posTabs: (d.posTabs || []).map(x => x.id === t.id ? (() => { const y = { ...x, ...p2 }; if (!y.covers) delete y.covers; if (!y.waiterId) { delete y.waiterId; delete y.waiterName; } return y; })() : x) }),
      { actionType: 'update', targetType: 'pos_tab', targetId: t.id, branchName: br.name, title: 'الطاولة ' + t.table + ': ' + ('covers' in p2 ? 'عدد الأشخاص ' + (p2.covers || '—') : 'النادل ' + (p2.waiterName || '—')) }); };
  const mergeTab = async (dst, fromNo) => { if (!window.confirm('دمج حساب الطاولة ' + fromNo + ' في حساب الطاولة ' + dst.table + '؟ تبقى تذاكر المطبخ المرسلة كما هي، وتصبح الطاولة ' + fromNo + ' متاحة.')) return;
    let err = '', tot = 0; const at = nowISO();
    const ok = await commit(d => { err = ''; const s0 = openTab(d, br.id, fromNo), t0 = openTab(d, br.id, dst.table); const M = tabMerge(s0, t0, { at, by: me.name }); if (M.err) { err = M.err; return d; } tot = tabSum(s0).total;
      return posTrim({ ...d, posTabs: (d.posTabs || []).map(x => x.id === M.into.id ? M.into : x.id === M.from.id ? M.from : x) }, today); },
      () => err ? null : { actionType: 'update', targetType: 'pos_tab', targetId: dst.id, branchName: br.name, title: 'دمج حساب الطاولة ' + fromNo + ' في الطاولة ' + dst.table, details: 'المنقول ' + money(tot) });
    if (err) return say(err, 'no'); if (ok) say('دُمج حساب الطاولة ' + fromNo + ' في الطاولة ' + dst.table + ' ✓'); };
  // v56.52 (قرار المجلس بعد التحقق): الطاولة تُسعَّر كاملة مرة واحدة (العروض التلقائية + كوبون الطاولة) ثم تُوزَّع على الأجزاء
  const splitPrice = (t, cpc) => posPriceCart(tabRemain(t).lines.map((l, i) => ({ ...l, key: 'r' + i })), org.products, org.posPromos, { branchId: br.id, code: cpc || '', phone: '', isMember: false, uses: loy ? (loy.cpn || {}) : null });
  const saveSplit = async () => { const { tab: t, n, alloc } = splitF; let err = '', parts = null; const at = nowISO();
    const ok = await commit(d => { err = ''; const cur = (d.posTabs || []).find(x => x.id === t.id); if (!cur || cur.status !== 'open') { err = 'الحساب لم يعد مفتوحًا'; return d; }
      const S = tabSplitItems(cur, alloc, n, splitPrice(cur, splitF.code)); if (S.err) { err = S.err; return d; } parts = S.parts;
      return { ...d, posTabs: (d.posTabs || []).map(x => x.id === t.id ? tabSplitSet(x, S.parts, { at, by: me.name }) : x) }; },
      () => err ? null : { actionType: 'update', targetType: 'pos_tab', targetId: t.id, branchName: br.name, title: 'تقسيم فاتورة الطاولة ' + t.table + ' إلى ' + n + ' أجزاء', details: (parts || []).map(p => 'جزء ' + p.no + ': ' + money(p.total)).join(' · ') });
    if (err) return say(err, 'no'); if (ok) { setSplitF(null); say('قُسّمت فاتورة الطاولة ' + t.table + ' ✓ — ادفع كل جزء من نافذة الطاولة'); } };
  // شارة العرض على بطاقة الصنف (العروض الفعّالة الآن بلا كوبون، وخصم بطاقة الصنف)
  const nowT = new Date(); const actP = (org.posPromos || []).filter(pr => pr.type !== 'order' && !pr.code && promoActive(pr, nowT, (br || {}).id));
  const tileTag = (p) => { if (p.disc && Number(p.disc.v) > 0 && (!p.disc.to || isoD(nowT) <= p.disc.to)) return p.disc.t === 'amt' ? '−' + money(p.disc.v) : '−' + p.disc.v + '%'; const pr = actP.find(x => promoHits(x, p)); return pr ? pr.name : ''; };
  const shown = prods.filter(p => (!cat || (p.cat || 'أخرى') === cat) && (!q.trim() || p.name.includes(q.trim())));

  const openShift = async (cashStr) => {
    const amt = posR2(String(cashStr == null ? '' : cashStr).replace(/[^\d.]/g, ''));
    const rec = { id: uid('ps'), branchId: br.id, dev: dev.tag, devName: dev.name, openedAt: nowISO(), openedBy: me.name, openingCash: amt, status: 'open', date: today };
    let ok = false;
    try { ok = await commit(d => ({ ...d, posShifts: [rec, ...(d.posShifts || [])] }), { actionType: 'create', targetType: 'pos_shift', targetId: rec.id, branchName: br.name, title: 'فتح وردية نقطة بيع', details: dev.name + ' · افتتاحي ' + money(amt) }); }
    catch (e) { console.warn('openShift', e); logClientError(e, 'فتح وردية نقطة البيع'); }
    setShiftF(null);
    if (ok) say('فُتحت الوردية ✓');
    // تعذّر الحفظ السحابي (سبب الرفض ظهر في الرسالة السابقة): تُفتح على الجهاز ويستمر البيع، وتُرسل تلقائيًا لاحقًا
    else setLS(rec);   // لا رسالة هنا كي تبقى رسالة السبب الحقيقي ظاهرة؛ والشريط أعلى الشاشة يوضح حالة الوردية
  };
  const shiftOrders = (sh) => allOrders.filter(o => o.shiftId === sh.id);
  const closeShift = async () => {
    const os = shiftOrders(shift).filter(o => o.status !== 'void');
    const expected = posR2(shift.openingCash + os.reduce((a, o) => a + posCashNet(o), 0));
    const counted = posR2(String(shiftF.counted).replace(/[^\d.]/g, ''));
    const { pending: _pd, ...shiftClean } = shift;
    const rec = { ...shiftClean, status: 'closed', closedAt: nowISO(), closedBy: me.name, expected, counted, diff: posR2(counted - expected), n: os.length, total: posR2(os.reduce((a, o) => a + o.total, 0)) };
    // v34.14: إغلاق على الجهاز حين لم تصل الوردية أو فواتيرها للسحابة بعد — يُطبع Z من فواتير الجهاز وتُرسل كلها لاحقًا تلقائيًا
    if (queue.length || shift.pending || (offOn && typeof navigator !== 'undefined' && navigator.onLine === false)) {   // v56.53: مع التفعيل الإغلاق دون اتصال على الجهاز
      if (!window.confirm('توجد بيانات لم تصل للسحابة بعد (' + (queue.length ? queue.length + ' فاتورة' : 'الوردية نفسها') + ').\n\nإغلاق الوردية على هذا الجهاز وطباعة تقرير Z الآن؟ تُرسل الوردية المغلقة وفواتيرها تلقائيًا عند نجاح الحفظ — لا تمسح بيانات المتصفح ولا تحذف التطبيق قبل ذلك.')) return;
      if (shift.pending) setLS(null);
      if (offOn) await OB.add('shift', [rec]); else { const nx = [...pendShiftsGet().filter(x => x.id !== rec.id), rec]; pendShiftsSet(nx); setPendClose(nx); }
      setShiftF(null); say('أُغلقت الوردية على الجهاز — الفرق ' + money(rec.diff) + ' · تُرسل تلقائيًا'); posDocView(posZHtml(org, rec, shiftOrders(shift), br)); flush();
      return;
    }
    const ok = await commit(d => ({ ...d, posShifts: (d.posShifts || []).map(x => x.id === shift.id ? rec : x) }), { actionType: 'update', targetType: 'pos_shift', targetId: shift.id, branchName: br.name, title: 'إغلاق وردية نقطة بيع', details: dev.name + ' · متوقع ' + money(expected) + ' · فعلي ' + money(counted) + ' · فرق ' + money(rec.diff) });
    if (ok) { setShiftF(null); say('أُغلقت الوردية — الفرق ' + money(rec.diff)); posDocView(posZHtml(org, rec, shiftOrders(shift), br)); }
  };
  // v56.2 (B2): قفل يمنع النقر المزدوج من إنشاء فاتورتين (الانتظار لحجز الكوبون كان يترك الزر نشطًا)
  const checkout = async (printNow) => { if (payBusy.current) return; payBusy.current = true; try { await checkoutRun(printNow); } finally { payBusy.current = false; } };
  const checkoutRun = async (printNow) => {
    const paid = posR2((pay.parts || []).reduce((a, x) => a + (Number(x.amount) || 0), 0));
    const cashGiven = posR2((pay.parts || []).filter(x => x.m === 'cash').reduce((a, x) => a + (Number(x.amount) || 0), 0));
    if (paid + 0.004 < T.total) return say('المدفوع أقل من الإجمالي', 'no');
    const change = posR2(paid - T.total); if (change > cashGiven + 0.004) return say('الباقي لا يُرد إلا من النقد', 'no');
    if (manual > 0 && !disc.reason.trim()) return say('اكتب سبب الخصم', 'no');
    const maxPct = Number(cfg.maxDiscPct) || 0;
    if (manual > 0 && maxPct > 0 && !isMgr && base1 > 0 && manual / base1 * 100 > maxPct + 0.001) return say('الخصم اليدوي يتجاوز الحد المسموح للكاشير (' + maxPct + '%) — يلزم مدير الفرع', 'no');
    if (cust.phone.trim() && !phoneOk) return say('رقم جوال العميل غير صحيح', 'no');
    if (!payTab) { const ple = posPriceListErr(org, plId, pay.parts, apps); if (ple) return say(ple, 'no'); }   // v56.47 (P4) قائمة الأسعار تطابق تطبيق الدفع
    if (payPart) { const sig = (L) => JSON.stringify((L || []).map(l => [l.productId, Number(l.price), (l.note || '').trim(), Number(l.qty)]));   // v56.52: حارس الجزء قبل الترقيم
      if (!partNow) return say('أُعيد تقسيم الحساب أو دُفع هذا الجزء من جهاز آخر — افتح الطاولة من جديد', 'no');
      if (sig(cart) !== sig(partNow.lines)) return say('لا تُعدَّل أسطر جزء مقسّم — أعد التقسيم من نافذة الطاولة', 'no'); }
    const cuts = payTab ? posTabCuts(tabSent.current, cart) : [];   // v56.2 (B7)
    if (cuts.length && !isMgr) return say('لا يُنقص صنف أُرسل للمطبخ إلا مدير الفرع: ' + cuts.map(c => c.name).join('، '), 'no');
    // v56.46: البيع الآجل — دفعة آجلة واحدة لعميل مؤهل، لا مع تطبيق توصيل، والتفويض من الخادم قبل الترقيم (دون اتصال يُمنع)
    const crParts = (pay.parts || []).filter(x => x.m === 'credit' && Number(x.amount) > 0); let crCu = null, crAmt = 0;
    if (crParts.length) {
      if (!creditOn) return say('البيع الآجل غير مفعّل', 'no');
      if (crParts.length > 1) return say('دفعة آجلة واحدة فقط لعميل واحد', 'no');
      if ((pay.parts || []).some(x => x.m === 'app' && Number(x.amount) > 0)) return say('لا يُجمع الآجل مع تطبيق توصيل', 'no');
      crCu = crCusts.find(c => c.key === crParts[0].custKey); if (!crCu) return say('اختر عميلًا مؤهلًا للبيع الآجل', 'no');
      crAmt = posR2(crParts[0].amount); if (crAmt > T.total + 0.004) return say('المبلغ الآجل أكبر من إجمالي الفاتورة', 'no');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return say('البيع الآجل يتطلب اتصالًا', 'no');
    }
    // v48.1: الكوبون المحدود يُحجز ذرّيًا قبل إتمام البيع (مفتاح عدم التكرار = معرّف الطلب)؛ إن تعذّر لا يُكمل البيع بالكوبون
    const oid = uid('po');
    if (priced.coupon && priced.coupon.limited) { const pr = (org.posPromos || []).find(x => x.id === priced.coupon.id) || {};
      const rv = await cpnReserve(cpCode, { id: oid, phone: phoneOk ? phoneN : '', at: nowISO(), br: br.id }, pr);
      if (!rv.ok) { setSending(false); reloadLoy(); return say('الكوبون: ' + rv.why + ' — احذف الرمز لإكمال البيع بدونه', 'no'); }
      if (rv.doc) setLoy(rv.doc); }
    let ar = null;
    if (crCu) { const a = await posCreditAuthApi({ orderId: oid, branchId: br.id, customerKey: crCu.key, amount: crAmt, date: today });
      if (!a || !a.ok) { if (priced.coupon && priced.coupon.limited) cpnRelease(cpCode, oid, 'رُفض البيع الآجل'); return say('البيع الآجل: ' + ((a && (a.why || a.error)) || 'تعذّر التفويض'), 'no'); }
      ar = { key: crCu.key, name: crCu.name, dueDate: a.dueDate || '', authId: a.authId || '' }; }
    // v56.52: النادل والأشخاص والجزء (حقول خارج البصمة؛ بلا تفعيل لا شيء) — الأشخاص على أول فاتورة من الحساب فقط حتى لا تتكرر في المتوسط
    const tabNow = payTab ? (ops.posTabs || []).find(t => t.id === payTab) : null, prtAll = ((tabNow && tabNow.split) || {}).parts || [], prt = payPart ? prtAll.find(x => x.id === payPart) : null;
    const wtr = tabNow ? (tabNow.waiterId ? { id: tabNow.waiterId, name: tabNow.waiterName || '' } : null) : (RC.waiters && channel === 'dinein' ? waiters.find(w => w.id === tmeta.waiterId) || null : null);
    const cvr = tabNow ? (prtAll.some(x => x.orderId) ? 0 : Math.floor(Number(tabNow.covers) || 0)) : (RC.covers && channel === 'dinein' ? coversOf(tmeta.covers) : 0);
    const restMeta = { ...(prt ? { tabPart: prt.no, tabParts: prtAll.length, tabPartId: prt.id, ...(tabNow.split.ver ? { tabSplitVer: tabNow.split.ver } : {}) } : {}), ...(wtr ? { waiterId: wtr.id, waiterName: wtr.name } : {}), ...(cvr ? { covers: cvr } : {}) };
    // ترقيم الجهاز اليومي وسلسلة البصمات (تعمل دون اتصال)
    const yy = today.replace(/-/g, '').slice(2); const sk = 'mizan:posSeq:' + br.id + ':' + today, hk = 'mizan:posHash:' + br.id;
    let ls = 0, lp = null; try { ls = Number(localStorage.getItem(sk)) || 0; lp = JSON.parse(localStorage.getItem(hk) || 'null'); } catch { }
    const { seq, prev } = posNextNo(ls, lp, [...(ops.posOrders || []), ...qNow()], br.id, dev.tag, today, 'ف');   // v56.2 (B4): لا رقم مكرر بعد مسح التخزين المحلي
    const bi = (org.branches || []).findIndex(b => b.id === br.id) + 1;
    const o = { id: oid, no: 'ف' + bi + '-' + yy + '-' + dev.tag + '-' + String(seq).padStart(4, '0'), branchId: br.id, dev: dev.tag, shiftId: shift.id, date: today, at: nowISO(), by: me.name,
      channel, ...(plId ? { priceList: plId } : {}), lines: priced.lines.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price, ...(l.note ? { note: l.note } : {}), ...(((cart.find(c => c.key === l.key) || {}).rec) ? { rec: (cart.find(c => c.key === l.key) || {}).rec } : {}), ...(l.disc ? { disc: l.disc, promoId: l.promoId, promoName: l.promoName } : {}) })),
      gross: T.gross, disc: T.disc, ...(priced.orderDisc ? { orderDisc: priced.orderDisc, orderPromo: priced.orderPromo } : {}), manualDisc: manual, ...(manual ? { discReason: disc.reason.trim() } : {}),
      ...(cpCode.trim() && priced.codeOk ? { coupon: cpCode.trim(), ...(priced.coupon ? { couponId: priced.coupon.id, ...(priced.coupon.limited ? { couponLtd: true } : {}) } : {}) } : {}),
      ...(phoneOk ? { loyalty: { phone: phoneN, name: (cust.name || custName).trim(), earned: earnPts, redeemed: redeemPts, redeemAmt, pv: Number(loyCfg.ptValue) || 0, balAfter: posR2(loyBalance - redeemPts + earnPts) } } : {}),
      total: T.total, vat: T.vat, net: T.net, rate,
      payments: pay.parts.filter(x => Number(x.amount) > 0).map(x => ({ m: x.m, amount: posR2(x.amount), ...(x.m === 'app' ? { appId: x.appId, appName: (apps.find(a => a.id === x.appId) || {}).n || 'تطبيق' } : {}), ...(x.pm ? { pm: x.pm, pmName: x.pmName } : {}), ...(x.m === 'credit' && ar ? { custKey: ar.key, custName: ar.name } : {}) })),
      ...(ar ? { ar } : {}),   // v56.46: العميل والاستحقاق ورقم التفويض — قبل البصمة
      ...(recSeen.length ? { recShown: recSeen.slice(0, 30) } : {}), ...(recDis.length ? { recDismissed: recDis.slice(0, 30) } : {}),
      change, status: 'paid', icv: (prev.icv || 0) + 1, pih: prev.hash || '0', ...(channel === 'dinein' && tbl ? { table: tbl, ...((ar) => ar ? { areaId: ar.id, areaName: ar.name } : {})(tableArea(org, br.id, tbl)) } : {}), ...(payTab ? { tabId: payTab } : {}), ...(cuts.length ? { tabCuts: cuts, tabCutBy: me.name } : {}), ...restMeta };
    o.hash = sha256Hex(JSON.stringify([o.no, o.at, o.lines, o.total, o.vat, o.payments, o.icv, o.pih, ...(o.ar ? [o.ar] : [])]));   // v56.46: الآجل ضمن البصمة متى وُجد
    try { localStorage.setItem(sk, String(seq)); localStorage.setItem(hk, JSON.stringify({ icv: o.icv, hash: o.hash })); } catch { }
    if (offOn) await OB.add('order', [o]); else { const qn = [...posQueue(), o]; posQueueSet(qn); setQueue(qn); }
    if (phoneOk && (earnPts || redeemPts)) loyAdd([...(redeemPts ? [{ id: o.id + ':r', phone: phoneN, name: (cust.name || custName).trim(), pts: -redeemPts, at: o.at, br: br.id, ord: o.no }] : []), ...(earnPts ? [{ id: o.id + ':e', phone: phoneN, name: (cust.name || custName).trim(), pts: earnPts, at: o.at, br: br.id, ord: o.no }] : [])]);
    setLast(o); setCart([]); setDisc({ mode: 'amt', amt: '', reason: '' }); setCode(''); setCust({ phone: '', name: '', redeem: false }); setPay(null); setShowCart(false);
    if (printNow === true || (printNow !== false && cfg.autoPrint !== false)) posPrint(posReceiptHtml(org, o, br));
    flush();
    // v42.9: إغلاق حساب الطاولة بعد دفعه، أو تذكرة مطبخ للطلب المدفوع مباشرة (بالخلفية — الفاتورة نفسها محفوظة على الجهاز)
    setTmeta({ covers: '', waiterId: '' }); setRush(false);
    if (payTab) { const tid = payTab, pid = payPart; setPayTab(null); setPayPart(null); setTbl('');   // v56.52: دفع جزء يختمه، والحساب يُغلق بآخر جزء
      let clash = '';   // v56.52: ختم الجزء على أحدث نسخة — إن أُعيد التقسيم أو تغيّر الجزء يُرفض ويُسجَّل تعارضًا للمراجعة
      commit(d => { clash = ''; return posTrim({ ...d, posTabs: (d.posTabs || []).map(t => { if (t.id !== tid) return t; if (!pid) return { ...t, status: 'paid', orderId: o.id, orderNo: o.no, closedAt: o.at, closedBy: me.name };
        const P = tabPayPart(t, pid, o, me.name); if (P.err) clash = P.err; return P.tab; }) }, today); }).then(ok => { if (ok && clash) say('صدرت الفاتورة ' + o.no + ' لكن لم يُختم الجزء: ' + clash + ' — سُجّلت «تعارضًا» على الطاولة ليراجعها مدير الفرع (إلغاء الفاتورة أو تسوية الحساب)', 'no'); else if (!ok) say('دُفعت الفاتورة، لكن تعذّر إغلاق حساب الطاولة الآن — أغلقه من «الطاولات» عند عودة الاتصال', 'no'); }); }
    // v49.2 — MQ-006: طلب توصيل ذاتي ⇒ سجل توصيل (بالخلفية، مستقل عن الفاتورة)
    if (dlvNeeded(o)) { const rec = dlvRecord(o, { phone: dlv.phone || (phoneOk ? phoneN : ''), addr: dlv.addr }); setDlv({ phone: '', addr: '' });
      commit(d => posTrim({ ...d, posDeliveries: [rec, ...(d.posDeliveries || []).filter(x => x.id !== rec.id)] }, today)).then(ok => { if (!ok) say('دُفعت الفاتورة، لكن تعذّر تسجيل التوصيل الآن — أعد المحاولة من «التوصيل»', 'no'); }); }
    if (payTab) { } else if (kds) commit(d => posTrim({ ...d, kdsTickets: [...(d.kdsTickets || []), ...kdsSplit(org, br.id, { branchId: br.id, src: 'order', ref: o.no, table: o.table || '', channel: o.channel, lines: o.lines, at: o.at, by: me.name, rush: RC.rush && rush }, org.products)] }, today)).then(ok => { if (!ok) say('دُفعت الفاتورة، لكن لم تصل لشاشة المطبخ (لا اتصال) — أبلغ المطبخ يدويًا', 'no'); });
  };
  const voidOrder = async (o) => {
    if (!canVoid) return say('إلغاء الفاتورة للإدارة التشغيلية (مدير الفرع فأعلى)', 'no');
    if (o.pending) return say('انتظر إرسال الفاتورة أولًا', 'no');
    const vb = posVoidBlock(ops, o); if (vb) return say(vb, 'no');   // v56.2 (B1/B6)
    const closed = (ops.closings || []).some(c => c.branchId === o.branchId && c.date === o.date && (c.status === 'submitted' || c.status === 'approved'));
    if (closed) return say('إغلاق هذا اليوم مُرحّل — لا تُلغى فواتيره', 'no');
    const reason = window.prompt('سبب إلغاء الفاتورة ' + o.no + ':'); if (!reason || !reason.trim()) return;
    /* v56.2 (B3): الفاتورة الصادرة بـ QR لا تُلغى بتغيير حالتها فقط — يصدر لها إشعار دائن مرقّم في سلسلة الجهاز.
       الإشعار يُحفظ داخل الفاتورة الملغاة (voidNote) لا كمرتجع مستقل، فلا يُخصم من مبيعات اليوم مرة ثانية. */
    const all = {}; (o.lines || []).forEach((l, i) => { all[i] = Number(l.qty) || 0; }); const C = posReturnCalc(o, all);
    const yy = today.replace(/-/g, '').slice(2); const sk = 'mizan:posRetSeq:' + br.id + ':' + today, hk = 'mizan:posHash:' + br.id;
    let ls = 0, lp = null; try { ls = Number(localStorage.getItem(sk)) || 0; lp = JSON.parse(localStorage.getItem(hk) || 'null'); } catch { }
    const { seq, prev } = posNextNo(ls, lp, [...(ops.posOrders || []), ...qNow()], br.id, dev.tag, today, 'م');
    const bi = (org.branches || []).findIndex(b => b.id === br.id) + 1;
    const at = nowISO();
    const vn = { no: 'م' + bi + '-' + yy + '-' + dev.tag + '-' + String(seq).padStart(4, '0'), dev: dev.tag, date: today, at, by: me.name, total: -C.total, vat: -C.vat, net: -C.net, icv: (prev.icv || 0) + 1, pih: prev.hash || '0' };
    vn.hash = sha256Hex(JSON.stringify([vn.no, vn.at, C.lines, vn.total, vn.vat, vn.icv, vn.pih, o.id]));
    let blocked = '';
    const ok = await commit(d => { blocked = ''; const cur = (d.posOrders || []).find(x => x.id === o.id); const why = posVoidBlock(d, cur); if (why) { blocked = why; return d; }
      return { ...d, posOrders: (d.posOrders || []).map(x => x.id === o.id ? { ...x, status: 'void', voidBy: me.name, voidAt: at, voidReason: reason.trim(), voidNote: vn } : x) }; },
      () => blocked ? null : { actionType: 'update', targetType: 'pos_order', targetId: o.id, branchName: br.name, title: 'ألغى فاتورة نقطة بيع', details: o.no + ' · ' + money(o.total) + ' · إشعار ' + vn.no + ' · ' + reason.trim() });   // v56.6: لا سجل تدقيق لإلغاء رُفض
    if (blocked) return say(blocked, 'no');
    if (!ok) return say('تعذّر حفظ الإلغاء — أعد المحاولة', 'no');
    try { localStorage.setItem(sk, String(seq)); localStorage.setItem(hk, JSON.stringify({ icv: vn.icv, hash: vn.hash })); } catch { }
    if (o.loyalty && (o.loyalty.earned || o.loyalty.redeemed)) loyAdd([...(o.loyalty.earned ? [{ id: o.id + ':ve', phone: o.loyalty.phone, pts: -o.loyalty.earned, at: nowISO(), br: o.branchId, ord: o.no + ' (إلغاء)' }] : []), ...(o.loyalty.redeemed ? [{ id: o.id + ':vr', phone: o.loyalty.phone, pts: o.loyalty.redeemed, at: nowISO(), br: o.branchId, ord: o.no + ' (إلغاء)' }] : [])]);
    if (o.coupon && o.couponLtd) cpnRelease(o.coupon, o.id, 'إلغاء الفاتورة');   // v48.1 يعود حد الكوبون
    say('أُلغيت الفاتورة ' + o.no + ' — إشعار دائن ' + vn.no); flush();
    posPrint(posReturnHtml(org, { ...vn, cancel: true, refNo: o.no, retLines: C.lines, payments: (o.payments || []).map(p => ({ ...p, amount: -p.amount })), reason: 'other', note: reason.trim() }, br));
  };


  // v46.8 — مرتجع جزئي/كلي لفاتورة مدفوعة (قرار المالك): مدير الفرع فقط · الطبق المرتجع هدر بسبب من قائمة الهدر · الرد بطريقة الدفع الأصلية أو نقدًا
  const retOn = !!cfg.returns;
  const opsR = offOn ? { ...ops, posOrders: allOrders } : ops;   // v56.53: مع التفعيل تُحتسب مرتجعات الجهاز غير المرسلة (لا يُرجَع الصنف مرتين دون اتصال)
  const openReturn = (o) => {
    if (!canVoid) return say('المرتجع للإدارة التشغيلية (مدير الفرع فأعلى)', 'no');
    if (o.pending) return say('انتظر إرسال الفاتورة أولًا', 'no');
    if (o.status === 'void') return say('الفاتورة ملغاة — لا مرتجع عليها', 'no');   // v56.2
    const left = posReturnable(opsR, o); if (!left.some(x => x > 0)) return say('أُرجعت كل أصناف هذه الفاتورة سابقًا', 'no');
    setRet({ o, q: {}, reason: 'returned', note: '', k: (posRefundOptions(o)[0] || {}).k || 'cash' });
  };
  const saveReturn = async (printNow) => {
    const o = ret.o; const left = posReturnable(opsR, o);
    const qs = {}; Object.entries(ret.q).forEach(([i, v]) => { const n = Number(v) || 0; if (n > 0) qs[i] = n; });
    if (!Object.keys(qs).length) return say('حدّد كمية صنف واحد على الأقل', 'no');
    if (Object.entries(qs).some(([i, n]) => n > (left[i] || 0) + 1e-9 || n !== Math.floor(n))) return say('الكمية أكبر من المتبقي في الفاتورة', 'no');
    if (!WASTE_REASONS[ret.reason]) return say('اختر سبب المرتجع', 'no');
    if (ret.reason === 'other' && !ret.note.trim()) return say('اكتب وصف السبب', 'no');
    const closed = (ops.closings || []).some(c => c.branchId === br.id && c.date === today && (c.status === 'submitted' || c.status === 'approved'));
    if (closed) return say('إغلاق اليوم مُرحّل — لا يُسجَّل مرتجع عليه', 'no');
    const opt = posRefundOptions(o).find(x => x.k === ret.k) || { m: 'cash' };
    if (opt.m === 'cash' && !shift) return say('الرد نقدًا يحتاج وردية مفتوحة على هذا الجهاز', 'no');
    const C = posReturnCalc(o, qs); const loyDed = posReturnLoyDed(opsR, o, C.total);
    // v56.53 (قرار المالك): المرتجع دون اتصال حتى حد المدير لكل فرع (الافتراضي صفر = ممنوع)، ويُوسم للمراجعة بعد الاتصال
    const offRet = offOn && typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offRet) { if (opt.m === 'credit') return say('المرتجع إلى حساب العميل يتطلب اتصالًا', 'no');
      const ck = posOffRetCheck(org, allOrders, ops.posOffRevs, br.id, C.total); if (ck.err) return say(ck.err, 'no'); }
    // v56.46: «إلى حساب العميل» — لا يمس الدرج، ولا يتجاوز متبقي الذمة (أو الآجل ناقص المرتجعات السابقة إلى الحساب)
    if (opt.m === 'credit') { const mx = posArRefundMax({ ...ops, posOrders: allOrders }, o); if (C.total > mx + 0.004) return say('المرتجع إلى حساب العميل لا يتجاوز ' + money(mx) + ' — رُدّ الباقي بطريقة أخرى', 'no'); }
    if (opt.m === 'cash' && shift) { const drawer = posR2((Number(shift.openingCash) || 0) + posOrdersStats(shiftOrders(shift)).cash); if (C.total > drawer + 0.004) return say('النقد في الدرج (' + money(drawer) + ') أقل من المبلغ المردود', 'no'); }
    const yy = today.replace(/-/g, '').slice(2); const sk = 'mizan:posRetSeq:' + br.id + ':' + today, hk = 'mizan:posHash:' + br.id;
    let ls = 0, lp = null; try { ls = Number(localStorage.getItem(sk)) || 0; lp = JSON.parse(localStorage.getItem(hk) || 'null'); } catch { }
    const { seq, prev } = posNextNo(ls, lp, [...(ops.posOrders || []), ...qNow()], br.id, dev.tag, today, 'م');   // v56.2 (B4): لا رقم مكرر بعد مسح التخزين المحلي
    const bi = (org.branches || []).findIndex(b => b.id === br.id) + 1;
    const r = { id: uid('pr'), kind: 'return', refId: o.id, refNo: o.no, no: 'م' + bi + '-' + yy + '-' + dev.tag + '-' + String(seq).padStart(4, '0'), branchId: br.id, dev: dev.tag, ...(shift ? { shiftId: shift.id } : {}),
      date: today, at: nowISO(), by: me.name, channel: o.channel, lines: [], retLines: C.lines, gross: -C.total, disc: 0, manualDisc: 0, total: -C.total, vat: -C.vat, net: -C.net, rate: o.rate,
      payments: [{ m: opt.m, amount: -C.total, ...(opt.appId ? { appId: opt.appId, appName: opt.appName } : {}), ...(opt.pm ? { pm: opt.pm, pmName: opt.pmName } : {}), ...(opt.m === 'credit' ? { custKey: opt.custKey, custName: opt.custName } : {}) }], change: 0, status: 'paid',
      ...(opt.m === 'credit' ? { ar: { key: opt.custKey, name: opt.custName || '' } } : {}),
      reason: ret.reason, ...(ret.note.trim() ? { note: ret.note.trim() } : {}), ...(offRet ? { offline: true, byId: me.id || '' } : {}), ...(o.waiterId ? { waiterId: o.waiterId, waiterName: o.waiterName || '' } : {}) /* v56.52: المرتجع يُخصم من نادل الفاتورة */, ...(RC.covers && o.table ? { retArea: o.areaId ? { id: o.areaId, name: o.areaName || o.areaId } : (tableArea(org, br.id, o.table) || { id: '', name: 'بلا صالة' }) } : {}) /* وصالته */, ...(loyDed ? { loyalty: { phone: o.loyalty.phone, ded: loyDed } } : {}), icv: (prev.icv || 0) + 1, pih: prev.hash || '0' };
    r.hash = sha256Hex(JSON.stringify([r.no, r.at, r.retLines, r.total, r.vat, r.payments, r.icv, r.pih, r.refId]));
    const ok = offRet ? (await OB.add('order', [r]), true) : await commit(d => ({ ...d, posOrders: [...(d.posOrders || []), r] }), { actionType: 'create', targetType: 'pos_order', targetId: r.id, branchName: br.name, title: 'مرتجع ' + r.no + ' عن الفاتورة ' + o.no, details: C.lines.map(l => l.name + ' ×' + l.qty).join('، ') + ' · ' + money(C.total) + ' · ' + WASTE_REASONS[ret.reason] });
    if (!ok) return say('تعذّر حفظ المرتجع', 'no');
    try { localStorage.setItem(sk, String(seq)); localStorage.setItem(hk, JSON.stringify({ icv: r.icv, hash: r.hash })); } catch { }
    if (loyDed) { loyAdd([{ id: r.id + ':rd', phone: o.loyalty.phone, name: o.loyalty.name || '', pts: -loyDed, at: r.at, br: br.id, ord: r.no + ' (مرتجع عن ' + o.no + ')' }]); flush(); }   // v46.9 خصم نقاط الولاء
    setRet(null); say((offRet ? 'سُجّل المرتجع دون اتصال ' : 'سُجّل المرتجع ') + r.no + ' — رُدّ ' + money(C.total) + (loyDed ? ' · خُصم ' + loyDed + ' نقطة ولاء' : '') + (offRet ? ' · للمراجعة بعد الاتصال' : ''));
    if (printNow) posPrint(posReturnHtml(org, r, br));
  };

  const css = `.pos-wrap{display:grid;grid-template-columns:1fr 360px;gap:12px;align-items:start}
  .pos-tables{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
  .pos-tbl{border:1.5px solid var(--line);border-radius:14px;background:var(--ink2);min-height:96px;padding:10px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;cursor:pointer;font:inherit;color:var(--txt);text-align:start}
  .pos-tbl b{font-size:20px} .pos-tbl small{font-size:11.5px;color:var(--dim)}
  .pos-tbl.free{border-color:color-mix(in srgb,var(--mint) 50%,var(--line))} .pos-tbl.busy{border-color:var(--brass);background:color-mix(in srgb,var(--brass) 8%,var(--ink2))} .pos-tbl.bill{border-color:var(--rose);background:color-mix(in srgb,var(--rose) 7%,var(--ink2))}
  .pos-kds{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:12px;overflow-x:auto}
  .pos-kcol{background:var(--ink3);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:9px;min-height:200px}
  .pos-ticket{background:var(--ink2);border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:7px;font-size:13.5px}
  .pos-ticket.late{border-color:var(--rose);box-shadow:inset 3px 0 0 var(--rose)} .pos-ticket.rush{outline:2px solid var(--rose);outline-offset:-2px} .pos-ticket ul{margin:0;padding-inline-start:18px} .pos-ticket li small{color:var(--dim)}
  @media(max-width:700px){.pos-kds{grid-template-columns:repeat(3,minmax(230px,82vw))}}
  .pos-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:9px}
  .pos-tile-img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;display:block;background:var(--ink3,#f3f3f3)}
  .pos-tile.has-img{padding:7px 7px 10px;justify-content:flex-start}
  .pos-tile-img.cut{object-fit:contain;background:transparent;filter:drop-shadow(0 3px 5px rgba(0,0,0,.18))}
  .pos-tile{border:1px solid var(--line);border-radius:14px;background:var(--ink2);padding:12px;min-height:104px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;cursor:pointer;text-align:start;font:inherit;color:var(--txt)}
  .pos-tile:active{transform:scale(.97)} .pos-tile b{font-size:14.5px;line-height:1.4} .pos-tile .num{font-size:15px;font-weight:700;color:var(--txt)}
  .pos-tile.on{border:2px solid var(--brand-fill,var(--brass));padding:11px 7px}
  .pos-tile-f{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .pos-qty{font-size:12px !important;font-weight:800 !important;background:var(--brand-fill,var(--brass));color:var(--brand-ink,#10294A) !important;border-radius:999px;padding:1px 9px}
  .pos-head{background:var(--side-bg,#1F1C18);color:var(--side-txt,#EFEAE1);border-radius:var(--r-md);padding:10px 12px;display:flex;flex-direction:column;gap:10px}
  .pos-head-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .pos-mark{width:36px;height:36px;border-radius:10px;background:var(--brand-fill,var(--brass));color:var(--brand-ink,#10294A);display:grid;place-items:center;flex-shrink:0}
  .pos-sub{font-size:12px;color:var(--side-dim,#B5AC9F);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pos-chip{font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:999px;background:var(--side-hl,#2F2A23);color:var(--side-txt,#EFEAE1)}
  .pos-head .sel.pos-br{width:auto;min-width:150px;background:var(--side-hl,#2F2A23);color:var(--side-txt,#EFEAE1);border-color:transparent}
  .pos-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .pos-tabs button{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--side-hl,#3A342C);background:transparent;color:var(--side-txt,#EFEAE1);font:600 14px inherit;font-family:inherit;cursor:pointer}
  .pos-tabs button.on{background:var(--brand-fill,var(--brass));color:var(--brand-ink,#10294A);border-color:transparent}
  .pos-tabs .sel.pos-moresel{width:auto;min-height:40px;background:transparent;color:var(--side-txt,#EFEAE1);border:1px solid var(--side-hl,#3A342C);font-weight:600}
  .pos-tabs .sel.pos-moresel.on{background:var(--brand-fill,var(--brass));color:var(--brand-ink,#10294A)}
  .pos-tabs .sel option{color:#1D1B18;background:#fff}
  .pos-cnt{font-size:11.5px;font-weight:700;background:var(--brand-fill,var(--brass));color:var(--brand-ink,#10294A);border-radius:999px;padding:0 8px;margin-inline-start:6px}
  .pos-seg{display:flex;background:color-mix(in srgb,var(--txt) 7%,transparent);border-radius:10px;padding:4px;gap:4px;margin-bottom:6px}
  .pos-seg button{flex:1;min-height:36px;border:0;border-radius:8px;background:transparent;font:500 13.5px inherit;font-family:inherit;color:var(--dim);cursor:pointer}
  .pos-seg button.on{background:var(--ink2);color:var(--txt);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .pos-link{border:0;background:none;color:color-mix(in srgb,var(--acc,var(--brass)) 85%,var(--txt));font:600 12px inherit;font-family:inherit;cursor:pointer;padding:0 6px}
  .pos-ext{display:flex;gap:6px;margin-top:10px}
  .pos-ext button{flex:1;min-height:38px;border-radius:9px;border:1px dashed color-mix(in srgb,var(--txt) 25%,var(--line));background:transparent;font:500 13px inherit;font-family:inherit;color:var(--dim);cursor:pointer}
  .pos-ext button.on{border-style:solid;border-color:var(--brand-fill,var(--brass));color:var(--txt);font-weight:600}
  .pos-sum{margin:12px 0 10px;padding:10px 12px 6px;border-radius:12px;background:var(--ink3);border:1px solid var(--line);font-size:13px;color:var(--dim)}
  .pos-sum>div{display:flex;justify-content:space-between;padding:2px 0}
  .pos-sum .pos-total{color:var(--txt);font-size:18px;font-weight:700;align-items:baseline;padding-top:6px}
  .pos-sum .pos-total .num{font-size:28px;font-weight:700}
  .pos-more-pay{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px;margin-top:8px}
  .pos-more-pay .btn{min-height:42px}
  .pos-fab-n{background:var(--brand-fill,var(--brass));color:var(--brand-ink,#10294A);border-radius:999px;padding:1px 10px;font-size:14px}
  .pos-addpay{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:13px;color:var(--dim)}
  .pos-addpay button{min-height:38px;padding:0 12px;border-radius:999px;border:1px dashed color-mix(in srgb,var(--txt) 25%,var(--line));background:transparent;font:500 13px inherit;font-family:inherit;color:var(--txt);cursor:pointer}
  .pos-paystat{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:12px;font-weight:700;margin-top:6px}
  .pos-paystat .num{font-size:20px}
  .pos-paystat.ok{background:color-mix(in srgb,var(--mint) 14%,transparent);color:var(--mint)}
  .pos-paystat.chg{background:color-mix(in srgb,var(--sky) 12%,transparent);color:var(--sky)}
  .pos-paystat.rem{background:color-mix(in srgb,var(--rose) 12%,transparent);color:var(--rose)}
  .pos-pay-card{background:var(--txt) !important;background-image:none !important;color:var(--ink2) !important;border-color:transparent !important}
  .pos-cart{position:sticky;top:8px} .pos-line{display:flex;align-items:center;gap:6px;padding:7px 0;border-bottom:1px solid var(--line)}
  .pos-qb{width:34px;height:34px;border-radius:9px;border:1px solid var(--line-g);background:var(--ink3);font-size:18px;cursor:pointer;color:var(--txt)}
  .pos-pay{width:100%;min-height:56px;padding:0;font-size:18px;font-weight:800;border-radius:12px}
  .pos-fab{display:none}
  @media(max-width:900px){.pos-wrap{grid-template-columns:1fr}.pos-cart{display:none}.pos-cart.open{display:block;position:fixed;inset:auto 0 calc(72px + env(safe-area-inset-bottom)) 0;max-height:calc(100dvh - 200px - env(safe-area-inset-bottom));overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;z-index:60;border-radius:18px;margin:0 6px;padding-bottom:14px;box-shadow:0 -10px 34px rgba(0,0,0,.35)}
    .pos-fab{display:flex;position:sticky;bottom:10px;z-index:55;width:100%;justify-content:space-between;align-items:center;min-height:58px;padding:0 18px;font-size:16px;font-weight:700;border-radius:14px;margin-top:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);background:var(--txt) !important;color:var(--ink2) !important;background-image:none !important}
    .pos-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}
    .pos-tile-img{aspect-ratio:16/9}
    .pos-head .pos-sub{max-width:180px}}`;
  // v56.53: مع التفعيل — «لم يُرسل بعد: N» و«آخر مزامنة» وسجل المزامنة للمدير، ومرتجعات دون اتصال للمراجعة
  const obN = offOn ? OB.count() + (localShift && localShift.branchId === (br || {}).id ? 1 : 0) : 0;
  const hhmm = (t) => t ? new Date(t).toTimeString().slice(0, 5) : '';
  const offBadge = offOn ? <span className="row" style={{ gap: 6, alignItems: 'center' }} data-offbadge>
    <span className={'badge ' + (obN ? 'b-amber' : 'b-mint')} data-obcount={obN}>{obN ? 'لم يُرسل بعد: ' + obN : 'متزامن ✓'}</span>
    <small className="pos-sub" data-lastsync>{'آخر مزامنة: ' + (hhmm(OB.info.lastOk) || '—')}{OB.info.fails ? ' · أخفقت ' + OB.info.fails + ' مرة، المحاولة التالية ' + hhmm(OB.info.nextAt) : ''}</small>
    {isMgr && <button className="btn sm gh" data-synclogbtn style={{ color: 'var(--side-txt,#EFEAE1)', borderColor: 'var(--side-hl,#3A342C)', background: 'transparent' }} onClick={async () => setObLog(await OB.logs())}>سجل المزامنة</button>}</span> : null;
  const offRevs = offOn || (ops.posOffRevs || []).length || (ops.posOrders || []).some(o => o.offline) ? posOffRetPending(ops.posOrders, ops.posOffRevs, (br || {}).id) : [];
  const reviewOff = async (r) => {
    const x = posOffRetReview(ops, r, me); if (x.err) return say(x.err, 'no');
    let blocked = '';
    const ok = await commit(d => { blocked = ''; if ((d.posOffRevs || []).some(v => v.retId === r.id)) { blocked = 'رُوجع هذا المرتجع سابقًا'; return d; } return { ...d, posOffRevs: [...(d.posOffRevs || []), x.rev] }; },
      () => blocked ? null : { actionType: 'update', targetType: 'pos_order', targetId: r.id, branchName: br.name, title: 'اعتمد مراجعة مرتجع دون اتصال', details: r.no + ' · ' + money(Math.abs(r.total)) + ' · سجّله ' + (r.by || '') });
    if (blocked) return say(blocked, 'no'); if (!ok) return say('تعذّر حفظ المراجعة — أعد المحاولة', 'no');
    say('اعتُمدت مراجعة المرتجع ' + r.no);
  };
  const pendingBadge = offBadge || ((queue.length || pendClose || (localShift && localShift.branchId === (br || {}).id)) ? <span className="badge b-amber">⏳ {queue.length ? queue.length + ' فاتورة' : ''}{pendClose || localShift ? (queue.length ? ' + ' : '') + 'وردية' : ''} بانتظار الإرسال</span> : <span className="badge b-mint">متزامن ✓</span>);
  // v34.15: «إرسال الآن» — ينتظر أي إرسال جارٍ ثم يرسل فورًا ويعرض النتيجة
  function pendLeft() { let ls = null; try { ls = localStorage.getItem(POS_SH_KEY); } catch { } return (offOn ? OB.count() : posQueue().length + pendShiftsGet().length + loyQ().length) + (ls ? 1 : 0); }
  async function sendNow() {
    setSending(true);
    try {
      for (let i = 0; i < 300 && flushing.current; i++) await new Promise(r => setTimeout(r, 200));
      const before = pendLeft(); await flush(true); const left = pendLeft();
      if (!left) say('أُرسل كل شيء للسحابة ✓');
      else { const e2 = cloud.lastError || {}; const r2 = e2.key ? cloud.readErr(e2.key) : null;
        if (e2.code === 'resource-exhausted') { say(QUOTA_MSG(), 'no'); return; }
        say('لم يكتمل الإرسال (' + (before - left > 0 ? 'أُرسل ' + (before - left) + '، ' : '') + 'بقي ' + left + ') — ' + (e2.code === 'read-failed' ? 'تعذّرت قراءة ' + (e2.key || '') + (r2 ? ' (' + r2.code + ')' : '') : (e2.code || 'تحقق من الاتصال')), 'no'); }
    } finally { setSending(false); }
  }
  // v34.14: سبب تأخر الإرسال ظاهرًا دائمًا (رسائل الخطأ المنبثقة تختفي)
  const le = cloud.lastError || null; const leRe = le && le.key ? cloud.readErr(le.key) : null;
  const leLbl = le && le.key ? (le.key === KEYS.core ? 'المستند المركزي' : le.key.startsWith('rms8:br_') ? 'ملف فرع «' + (((org.branches || []).find(b => 'rms8:br_' + b.id === le.key)) || { name: le.key.slice(8) }).name + '»' : le.key.startsWith('rms8:bf_') ? 'أرشيف مستندات فرع' : le.key) : '';
  const pendReason = (queue.length || pendClose || localShift) && le ? (le.code === 'resource-exhausted' ? 'نفدت حصة الكتابة اليومية في Firestore — تتجدد 11:00 صباحًا بتوقيت السعودية، والبيانات محفوظة على الجهاز' + (cloud.quotaUntil() ? ' · المحاولة التالية ' + new Date(cloud.quotaUntil()).toTimeString().slice(0, 5) : '')
    : (leLbl + ' — ' + (le.code === 'read-failed' ? 'تعذّرت قراءته' + (leRe ? ' (' + leRe.code + ')' : '') : le.code || 'خطأ') + ' · ' + new Date(le.at).toTimeString().slice(0, 5))) : '';;
  const todayOrders = allOrders.filter(o => o.branchId === br.id && o.date === today).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const daySum = posDaySummary(todayOrders, br.id, today);
  const pl = (l) => priced.lines.find(x => x.key === l.key) || {};
  const payMs = (cfg.payMethods || []).filter(x => x.active !== false && x.n);
  // v56.0 (GAP-007): الطلبات المعلّقة على هذا الجهاز لهذا الفرع — بلا رقم فاتورة حتى الدفع
  const holdCur = () => {
    if (payTab) return say('أنت في دفع حساب طاولة — أكمل الدفع أو ألغه', 'no');
    const r = posHoldPut(posHolds(br.id), { id: uid('hold'), at: nowISO(), by: me.name, channel, cart, cust, disc, code, label: (cust.name || cust.phone || '').trim() });
    if (r.err) return say(r.err, 'no');
    if (!posHoldsSet(br.id, r.list)) return say('تعذّر حفظ الطلب المعلّق على الجهاز (المساحة ممتلئة)', 'no');
    setHolds(r.list); setCart([]); setDisc({ mode: 'amt', amt: '', reason: '' }); setCode(''); setCust({ phone: '', name: '', redeem: false }); setShowCart(false);
    say('عُلّق الطلب ✓ — استدعه من «المعلّقة» متى عاد العميل');
  };
  const recallHold = (h) => {
    if (cart.length) return say('علّق الطلب الحالي أو أفرغه أولًا', 'no');
    const r = posHoldRecall(h, prods);
    if (!r.cart.length) { const rest = posHolds(br.id).filter(x => x.id !== h.id); posHoldsSet(br.id, rest); setHolds(rest); return say('أصناف هذا الطلب لم تعد متاحة — حُذف من المعلّقة', 'no'); }
    const rest = posHolds(br.id).filter(x => x.id !== h.id); posHoldsSet(br.id, rest); setHolds(rest);
    setCart(r.cart); setChannel(h.channel === 'dinein' ? 'takeaway' : (h.channel || 'takeaway')); setDisc(h.disc || { mode: 'amt', amt: '', reason: '' }); setCode(h.code || ''); setCust(h.cust || { phone: '', name: '', redeem: false });
    setHoldOpen(false); setShowCart(true);
    say('استُدعي الطلب' + (r.dropped.length ? ' — أُسقط غير المتاح: ' + r.dropped.join('، ') : '') + (r.repriced.length ? ' — حُدّث سعر: ' + r.repriced.join('، ') : '') + ' ✓', r.dropped.length ? 'no' : undefined);
  };
  const dropHold = (h) => { if (!window.confirm('حذف الطلب المعلّق؟')) return; const rest = posHolds(br.id).filter(x => x.id !== h.id); posHoldsSet(br.id, rest); setHolds(rest); };
  const cartCount = cart.reduce((a, l) => a + l.qty, 0);
  const extOpen = { disc: ext.disc || !!disc.amt, code: ext.code || !!code.trim(), loy: ext.loy || !!cust.phone };
  const cartBox = (
    <div className={'card pos-cart' + (showCart ? ' open' : '')}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: 17 }}>الطلب الحالي{cartCount ? <span className="num pos-cnt">{cartCount}</span> : null}</b>
        <div className="row" style={{ gap: 4 }}>
          {holds.length > 0 && <button className="btn sm gh" data-holdlist onClick={() => setHoldOpen(v => !v)}>المعلّقة <span className="num">{holds.length}</span></button>}
          {cart.length > 0 && !payTab && channel !== 'dinein' && <button className="btn sm gh" data-hold onClick={holdCur}>تعليق</button>}
          {cart.length > 0 && <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => { if (window.confirm('إفراغ الطلب؟')) setCart([]); }}>إفراغ</button>}
          {showCart && <button className="btn sm gh" aria-label="إغلاق" onClick={() => setShowCart(false)}><X size={16} /></button>}
        </div>
      </div>
      {holdOpen && holds.length > 0 && <div className="note" data-holds style={{ marginBottom: 8 }}>
        {holds.map(h => <div key={h.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
          <span style={{ fontSize: 12 }}><b>{h.label || 'طلب'}</b> · {(h.cart || []).reduce((a, l) => a + (Number(l.qty) || 0), 0)} صنف · {money((h.cart || []).reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0), 0))} · {String(h.at || '').slice(11, 16)} · {h.by}</span>
          <span className="row" style={{ gap: 4 }}><button className="btn sm pri" onClick={() => recallHold(h)}>استدعاء</button><button className="btn sm gh" style={{ color: 'var(--rose)' }} aria-label="حذف المعلّق" onClick={() => dropHold(h)}>حذف</button></span>
        </div>)}
      </div>}
      <div className="pos-seg" role="group" aria-label="نوع الطلب">{[['takeaway', 'سفري'], ['dinein', 'محلي'], ['delivery', 'توصيل']].map(([k, t]) => <button key={k} className={channel === k ? 'on' : ''} onClick={() => setChannel(k)}>{t}</button>)}</div>
      {plApps.length > 0 && !payTab && <div className="row" style={{ gap: 6, alignItems: 'center', margin: '0 0 8px' }} data-pricelist><span style={{ fontSize: 13, fontWeight: 600 }}>قائمة الأسعار</span>
        <select className="sel" style={{ width: 'auto', minWidth: 130 }} aria-label="قائمة الأسعار" value={plId} onChange={e => setPriceList(e.target.value)}><option value="">المطعم</option>{plApps.map(a => <option key={a.id} value={a.id}>{a.n}</option>)}</select></div>}
      {channel === 'delivery' && <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '0 0 8px' }} data-dlvform>
        <input className="inp" style={{ width: 130 }} inputMode="tel" aria-label="جوال التوصيل" placeholder="جوال العميل" value={dlv.phone || cust.phone || ''} onChange={e => setDlv(x => ({ ...x, phone: e.target.value }))} />
        <input className="inp" style={{ flex: 1, minWidth: 160 }} aria-label="عنوان التوصيل" placeholder="العنوان / الحي / وصف الموقع" value={dlv.addr} onChange={e => setDlv(x => ({ ...x, addr: e.target.value }))} />
      </div>}
      {channel === 'dinein' && useTabs && <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 8px' }}>
        {payTab ? <div className="note" style={{ flex: 1, margin: 0 }}>دفع حساب الطاولة <b className="num">{tbl}</b>{payPart ? <span data-paypart> — الجزء <b className="num">{partNow ? partNow.no : '—'}</b></span> : null} <button className="btn sm gh" onClick={cancelPayTab}>إلغاء الدفع</button></div>
          : <><span style={{ fontSize: 13, fontWeight: 600 }}>الطاولة</span><select className="sel" style={{ width: 'auto', minWidth: 110 }} aria-label="الطاولة" value={tbl} onChange={e => setTbl(e.target.value)}><option value="">— اختر —</option>
            {tables.map(no => { const t = openTab(ops, br.id, no); const ar = tableArea(org, br.id, no); return <option key={no} value={no}>{no}{ar ? ' · ' + ar.name : ''}{t ? ' (مفتوحة · ' + money(tabSum(t).total) + ')' : ''}</option>; })}</select>
            {RC.covers && <input className="inp n" style={{ width: 74 }} inputMode="numeric" aria-label="عدد الأشخاص" placeholder="الأشخاص" value={tmeta.covers} onChange={e => setTmeta(x => ({ ...x, covers: e.target.value.replace(/[^\d٠-٩]/g, '').slice(0, 2) }))} />}
            {RC.waiters && <select className="sel" style={{ width: 'auto', minWidth: 110 }} aria-label="النادل" value={tmeta.waiterId} onChange={e => setTmeta(x => ({ ...x, waiterId: e.target.value }))}><option value="">— النادل —</option>{waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}</>}
      </div>}
      {cart.map(l => (
        <div key={l.key} className="pos-line">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{l.name}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}><span className="num">{money(pl(l).price != null ? pl(l).price : l.price)} × {l.qty}</span>{pl(l).disc ? <span style={{ color: 'var(--mint)', fontWeight: 600 }}> · {pl(l).promoName} −<span className="num">{money(pl(l).disc)}</span></span> : null}
              {!(l.showNote || l.note) && <button className="pos-link" onClick={() => setCart(c => c.map(x => x.key === l.key ? { ...x, showNote: true } : x))}>+ ملاحظة</button>}</div>
            {(l.showNote || l.note) && <input className="inp" style={{ minHeight: 34, padding: '4px 8px', fontSize: 12.5, marginTop: 4 }} autoFocus={!l.note} placeholder="بدون بصل، حار…" value={l.note} onChange={e => setCart(c => c.map(x => x.key === l.key ? { ...x, note: e.target.value } : x))} />}
          </div>
          <button className="pos-qb" aria-label="إنقاص" onClick={() => setQty(l.key, -1)}>−</button><b className="num" style={{ minWidth: 22, textAlign: 'center' }}>{l.qty}</b><button className="pos-qb" aria-label="زيادة" onClick={() => setQty(l.key, 1)}>+</button>
          <b className="num" style={{ minWidth: 60, textAlign: 'end' }}>{money(l.qty * (pl(l).price != null ? pl(l).price : l.price) - (pl(l).disc || 0))}</b>
        </div>))}
      {!cart.length && <div className="empty">اضغط الأصناف لإضافتها</div>}
      {recs.length > 0 && <div className="pos-recs" data-recs style={{ margin: '8px 0 2px', padding: '8px 10px', border: '1px dashed var(--line)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', marginBottom: 6 }}>مقترح مع الطلب</div>
        {recs.map(r => <div key={r.productId} className="row" data-rec={r.productId} style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <button className="btn sm gh" style={{ flex: 1, justifyContent: 'space-between', minWidth: 0 }} title={r.why} onClick={() => addRec(r)}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>+ {r.name}</span><span className="num">{money(r.price)}</span></button>
          <button className="btn sm gh" aria-label={'إخفاء ' + r.name} onClick={() => setRecDis(d => d.includes(r.productId) ? d : [...d, r.productId])}><X size={13} /></button>
        </div>)}
        <div style={{ fontSize: 11, color: 'var(--faint)' }}>{recs[0].why}</div>
      </div>}
      {cart.length > 0 && <>
        <div className="pos-ext">
          <button className={extOpen.disc ? 'on' : ''} onClick={() => setExt(x => ({ ...x, disc: !extOpen.disc }))}>{manual ? 'خصم ' + money(manual) : '+ خصم'}</button>
          {!frozenP && <button className={extOpen.code ? 'on' : ''} onClick={() => setExt(x => ({ ...x, code: !extOpen.code }))}>{priced.codeOk ? 'كوبون ✓' : '+ كوبون'}</button>}
          {needLoy && <button className={extOpen.loy ? 'on' : ''} onClick={() => setExt(x => ({ ...x, loy: !extOpen.loy }))}>{phoneOk ? (custName || 'عميل') + ' ✓' : '+ عميل ولاء'}</button>}
        </div>
        {extOpen.disc && <div className="grid g2" style={{ gap: 6, marginTop: 8 }}>
          <Field label="خصم يدوي" style={{ marginBottom: 0 }}><div className="row" style={{ gap: 4 }}>
            <input className="inp n" inputMode="decimal" style={{ flex: 1 }} value={disc.amt} onChange={e => setDisc(d => ({ ...d, amt: e.target.value.replace(/[^\d.]/g, '') }))} />
            <button className={'btn sm' + (disc.mode === 'amt' ? ' pri' : ' gh')} onClick={() => setDisc(d => ({ ...d, mode: 'amt' }))}>ر.س</button><button className={'btn sm' + (disc.mode === 'pct' ? ' pri' : ' gh')} onClick={() => setDisc(d => ({ ...d, mode: 'pct' }))}>%</button></div></Field>
          <Field label="سبب الخصم" style={{ marginBottom: 0 }}><input className="inp" value={disc.reason} placeholder={manual ? 'إلزامي' : ''} onChange={e => setDisc(d => ({ ...d, reason: e.target.value }))} /></Field>
        </div>}
        {extOpen.code && !frozenP && <div style={{ marginTop: 8 }}><input className="inp" value={code} placeholder="رمز الكوبون" aria-label="رمز الكوبون" onChange={e => setCode(e.target.value)} />
          {code.trim() && <div style={{ fontSize: 12, marginTop: 3, color: priced.codeOk ? 'var(--mint)' : 'var(--rose)', fontWeight: 600 }}>{priced.codeOk ? '✓ الكوبون فعّال' : (couponWhy(org.posPromos, code, { ...cpOpt, sub: priced.sub }, new Date(), (br || {}).id) || 'رمز غير صالح أو العرض غير متاح الآن')}</div>}</div>}
        {needLoy && extOpen.loy && <div style={{ marginTop: 8 }}>
          <div className="row" style={{ gap: 6 }}><input className="inp" inputMode="tel" style={{ flex: 1 }} placeholder="جوال العميل" aria-label="جوال العميل" value={cust.phone} onChange={e => setCust(c => ({ ...c, phone: e.target.value, redeem: false }))} />
            {phoneOk && !custName && <input className="inp" style={{ flex: 1 }} placeholder="اسم العميل (جديد)" value={cust.name} onChange={e => setCust(c => ({ ...c, name: e.target.value }))} />}</div>
          {phoneOk && <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.8 }}>{custName ? <b>{custName}</b> : <span className="badge b-mint">عميل جديد</span>} · الرصيد <b className="num">{loy ? loyBalance : '…'}</b> نقطة{earnPts ? <> · يكسب <b className="num">{earnPts}</b></> : null}
            {loyRedeemMax(loyCfg, loyBalance, posR2(base1 - manual)) > 0 && <label className="row" style={{ gap: 6, cursor: 'pointer', marginTop: 3 }}><input type="checkbox" checked={cust.redeem} onChange={e => setCust(c => ({ ...c, redeem: e.target.checked }))} />استبدال {loyRedeemMax(loyCfg, loyBalance, posR2(base1 - manual))} نقطة = <b className="num">{money(loyRedeemMax(loyCfg, loyBalance, posR2(base1 - manual)) * (Number(loyCfg.ptValue) || 0))}</b></label>}
            {!loy && <div style={{ color: 'var(--faint)' }}>الرصيد يتطلب اتصالًا — النقاط المكتسبة تُحفظ وتُرسل لاحقًا</div>}</div>}
        </div>}
        <div className="pos-sum">
          {T.ldisc ? <div><span>العروض</span><span className="num">−{money(T.ldisc)}</span></div> : null}
          {priced.orderDisc ? <div><span>{(priced.orderPromo || {}).name}</span><span className="num">−{money(priced.orderDisc)}</span></div> : null}
          {manual ? <div><span>خصم يدوي{disc.mode === 'pct' ? ' ' + disc.amt + '%' : ''}</span><span className="num">−{money(manual)}</span></div> : null}
          {redeemAmt ? <div><span>استبدال {redeemPts} نقطة</span><span className="num">−{money(redeemAmt)}</span></div> : null}
          <div><span>منها ضريبة القيمة المضافة {rate}%</span><span className="num">{money(T.vat)}</span></div>
          <div className="pos-total"><span>الإجمالي</span><span className="num">{money(T.total)}</span></div>
        </div>
        {kds && RC.rush && !payTab && <label className="row" data-rush style={{ gap: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', margin: '0 0 8px', color: rush ? 'var(--rose)' : undefined }}><input type="checkbox" aria-label="مستعجل" checked={rush} onChange={e => setRush(e.target.checked)} />مستعجل — تتقدّم تذكرته في شاشة المطبخ</label>}
        {channel === 'dinein' && useTabs && !payTab && <button className="btn pos-pay" style={{ width: '100%', marginBottom: 8, background: 'var(--sky)', color: '#fff', borderColor: 'transparent' }} disabled={!tbl} onClick={sendRound}>
          <Send size={16} />{tbl ? 'إرسال للمطبخ — الطاولة ' + tbl + ' (الدفع لاحقًا)' : 'اختر الطاولة للإرسال للمطبخ'}</button>}
        <div className="grid g2" style={{ gap: 8 }}>
          <button className="btn pri pos-pay" onClick={() => setPay({ parts: [{ m: 'cash', amount: String(T.total) }] })}>نقدي</button>
          <button className="btn pri pos-pay pos-pay-card" onClick={() => setPay({ parts: [{ m: 'card', amount: String(T.total) }] })}>شبكة</button>
        </div>
        <div className="pos-more-pay">
          <button className="btn" onClick={() => setPay({ parts: [{ m: 'cash', amount: '' }, { m: 'card', amount: '' }] })}>تقسيم</button>
          {payMs.slice(0, 3).map(pm => <button key={pm.id} className="btn" onClick={() => setPay({ parts: [{ m: pm.kind || 'card', pm: pm.id, pmName: pm.n, amount: String(T.total) }] })}>{pm.n}</button>)}
          <button className="btn" onClick={() => setPay({ parts: [{ m: 'app', appId: plId || (apps[0] || {}).id, amount: String(T.total) }] })}>تطبيق توصيل</button>
          {creditOn && crCusts.length > 0 && <button className="btn" data-credit onClick={() => setPay({ parts: [{ m: 'credit', custKey: '', amount: String(T.total) }] })}>آجل</button>}
        </div>
      </>}
    </div>);
  return (
    <div className="grid" style={{ gap: 10 }}>
      <style>{css}</style>
      {/* v35.1: رأس نقطة البيع — الحبر الداكن، ثلاثة تبويبات أساسية، والإدارة في «المزيد» */}
      <div className="pos-head">
        <div className="pos-head-r">
          <span className="pos-mark"><Store size={17} /></span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <b style={{ fontSize: 16 }}>نقطة البيع</b>
            <span className="pos-sub">{dev.name} ({dev.tag}){shift ? ' · الوردية منذ ' + String(shift.openedAt || '').slice(11, 16) : ' · لا وردية مفتوحة'}</span>
          </div>
          {brs.length > 1 ? <select className="sel pos-br" aria-label="الفرع" value={br.id} onChange={e => setBrId(e.target.value)}>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : <span className="pos-chip">{br.name}</span>}
          <span style={{ marginInlineStart: 'auto' }} />
          {pendingBadge}
          {pendLeft() > 0 && <button className="btn sm pri" disabled={sending} onClick={sendNow}><RefreshCw size={13} />{sending ? 'جارٍ الإرسال…' : 'إرسال الآن'}</button>}
        </div>
        <div className="pos-tabs" role="tablist" aria-label="أقسام نقطة البيع">
          {[['sell', 'البيع', Store], ...(useTabs ? [['tables', 'الطاولات', LayoutGrid]] : []), ...(kds ? [['kds', 'المطبخ', ChefHat]] : []), ...(dlvOn ? [['dlv', 'التوصيل', Truck]] : []), ['orders', 'الفواتير', FileText], ['shift', 'الوردية', Clock]].map(([id, t, Ic]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}><Ic size={15} />{t}{id === 'orders' && todayOrders.length ? <span className="num pos-cnt">{todayOrders.length}</span> : null}</button>)}
          {(() => { const more = [...(isMgr ? [['shifts', 'الورديات والتقارير']] : []), ...(isMgr && (RC.waiters || RC.covers || (kds && RC.prepRpt)) ? [['rest', 'تقارير المطعم']] : []), ...(R.admin || R.scope === 'all' ? [['promos', 'العروض']] : []), ...(isMgr ? [['loyalty', 'الولاء']] : []), ...(R.admin || R.scope === 'all' ? [['cfg', 'الإعدادات']] : [])];
            if (!more.length) return null; const curM = more.find(x => x[0] === view);
            return <select className={'sel pos-moresel' + (curM ? ' on' : '')} aria-label="المزيد" value={curM ? view : ''} onChange={e => e.target.value && setView(e.target.value)}><option value="">المزيد…</option>{more.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select>; })()}
        </div>
      </div>

      {canVoid && offRevs.length > 0 && <div className="note" data-offrevs style={{ borderColor: 'rgba(224,164,88,.6)' }}><b>مرتجعات دون اتصال للمراجعة بعد الاتصال ({offRevs.length})</b>
        {offRevs.map(r => <div key={r.id} className="row" style={{ gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }} data-offrev={r.no}><span className="num">{r.no}</span><span>عن {r.refNo}</span><b className="num">{money(Math.abs(r.total))}</b><small>{r.by || ''} · {String(r.at || '').slice(0, 16).replace('T', ' ')}</small>
          <button className="btn sm" onClick={() => reviewOff(r)}><Check size={13} />اعتماد المراجعة</button></div>)}</div>}
      {obLog && <Modal title="سجل المزامنة" icon={RefreshCw} onClose={() => setObLog(null)}>
        <div className="note" style={{ fontSize: 12, marginBottom: 8 }}>التخزين على الجهاز: <b>{OB.info.mode === 'idb' ? 'IndexedDB' : OB.info.mode === 'ls' ? 'التخزين المحلي (IndexedDB غير متاح)' : OB.info.mode || '—'}</b> · لم يُرسل بعد: <b className="num">{OB.count()}</b> · آخر مزامنة ناجحة: <b className="num">{hhmm(OB.info.lastOk) || '—'}</b></div>
        {OB.count() > 0 && <div style={{ marginBottom: 10 }} data-oblist>{posObSort([...OB.list('order').map(d => ({ kind: 'order', d })), ...OB.list('shift').map(d => ({ kind: 'shift', d })), ...OB.list('loy').map(d => ({ kind: 'loy', d }))].map(x => ({ ...x, key: x.kind + x.d.id, at: x.d.at || x.d.closedAt || '' }))).map(x => <div key={x.key} style={{ fontSize: 12 }}>⏳ {x.kind === 'order' ? (x.d.kind === 'return' ? 'مرتجع ' : 'فاتورة ') + (x.d.no || '') : x.kind === 'shift' ? 'وردية مغلقة' : 'نقاط ولاء'} <span className="num">{String(x.at).slice(11, 16)}</span></div>)}</div>}
        <div className="tbl-w"><table className="tbl" data-synclog><thead><tr><th>الوقت</th><th>النوع</th><th>المعرّف</th><th>النتيجة</th><th>الخطأ</th></tr></thead>
          <tbody>{obLog.length ? obLog.slice(0, 200).map(l => <tr key={l.key}><td className="num" style={{ fontSize: 11.5 }}>{String(l.at).slice(0, 19).replace('T', ' ')}</td><td>{({ order: 'فاتورة', shift: 'وردية', loy: 'ولاء', ticket: 'تذكرة' })[l.kind] || l.kind}</td><td className="num" style={{ fontSize: 11 }}>{l.ref}</td><td>{l.ok ? <span className="badge b-mint">أُرسل</span> : <span className="badge b-rose">أخفق</span>}</td><td style={{ fontSize: 11.5 }}>{l.err === 'not-confirmed' ? 'لم يتأكد الحفظ في السحابة' : (l.err || '')}</td></tr>) : <tr><td colSpan={5} style={{ fontSize: 12 }}>لا محاولات بعد</td></tr>}</tbody></table></div>
      </Modal>}
      {pendReason && <div className="note" style={{ fontSize: 12 }}>سبب تأخر الإرسال: <b>{pendReason}</b>{R.admin && !(shift && shift.pending) && <button className="btn sm gh" style={{ marginInlineStart: 8 }} onClick={() => setDiag(x => !x)}>تشخيص</button>}</div>}
      {!(shift && shift.pending) && R.admin && diag && <CloudHealth org={org} say={say} only={[brKey(br.id), bfKey(br.id), KEYS.core]} auto commit={commit} me={me} />}
      {shift && shift.pending && R.admin && <div><button className="btn sm" onClick={() => setDiag(x => !x)}><ShieldCheck size={13} />{diag ? 'إخفاء التشخيص' : 'تشخيص وإصلاح مشكلة الحفظ'}</button></div>}
      {shift && shift.pending && R.admin && diag && <CloudHealth org={org} say={say} only={[brKey(br.id), bfKey(br.id), KEYS.core]} auto commit={commit} me={me} />}
      {shift && shift.pending && <div className="note" style={{ borderColor: 'rgba(224,164,88,.6)' }}>⚠ الوردية مفتوحة على هذا الجهاز ولم تُحفظ في السحابة بعد — البيع مستمر والفواتير محفوظة على الجهاز، وتُرسل تلقائيًا عند نجاح الاتصال. إن استمر هذا التنبيه أرسل لي نص رسالة الخطأ التي ظهرت عند فتح الوردية.</div>}
      {view === 'sell' && (!shift ? (
        <div className="card" style={{ maxWidth: 420, margin: '20px auto', textAlign: 'center' }}>
          <div className="card-t" style={{ justifyContent: 'center', marginBottom: 8 }}><Clock size={16} color="var(--brass)" />افتح الوردية للبدء</div>
          <Num label="النقد الافتتاحي في الدرج" value={(shiftF || {}).cash ?? String(br.defaultFloat || '')} onChange={v => setShiftF({ cash: v })} />
          <button className="btn pri" style={{ width: '100%', marginTop: 8 }} onClick={() => openShift((shiftF || {}).cash ?? String(br.defaultFloat || 0))}><Check size={14} />فتح الوردية</button>
        </div>) : (
        <div className="pos-wrap">
          <div className="grid" style={{ gap: 9 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <input className="inp" style={{ width: 170 }} placeholder="بحث عن صنف…" value={q} onChange={e => setQ(e.target.value)} />
              <button className={'btn sm' + (!cat ? ' pri' : ' gh')} onClick={() => setCat('')}>الكل</button>
              {cats.map(c => <button key={c} className={'btn sm' + (cat === c ? ' pri' : ' gh')} onClick={() => setCat(c)}>{c}</button>)}
            </div>
            <div className="pos-tiles">{shown.map(p => { const tg = tileTag(p); const inCart = cart.filter(l => l.productId === p.id).reduce((a, l) => a + l.qty, 0); return <button key={p.id} className={'pos-tile' + (inCart ? ' on' : '') + (p.img && !noImg ? ' has-img' : '')} onClick={() => add(p)}>{p.img && !noImg && <img className={'pos-tile-img' + (/^data:image\/(webp|png)/.test(p.img) ? ' cut' : '')} src={p.img} alt="" loading="lazy" draggable={false} />}{tg && <i style={{ fontStyle: 'normal', fontSize: 10, background: 'var(--mint)', color: '#fff', borderRadius: 6, padding: '1px 6px', alignSelf: 'center' }}>🏷 {tg}</i>}<b>{p.name}</b><span className="pos-tile-f"><span className="num">{money(p.sellPrice)}</span>{inCart > 0 && <span className="num pos-qty" dir="ltr" style={{ unicodeBidi: 'isolate' }}>×{inCart}</span>}</span></button>; })}</div>
            {!shown.length && (q.trim() || cat ? <div className="card"><div className="empty">لا نتائج.</div></div>
              : <PosQuickProducts org={org} commitOrg={commitOrg} say={say} canAdd={!!R.admin} />)}
            {!!shown.length && R.admin && <div><button className="btn sm gh" onClick={() => setQuickP(x => !x)}><Plus size={12} />إضافة/تسعير أصناف</button></div>}
            {quickP && !!shown.length && <PosQuickProducts org={org} commitOrg={commitOrg} say={say} canAdd={!!R.admin} />}
            {last && <div className="note">آخر فاتورة: <b className="num">{last.no}</b> بـ <b className="num">{money(last.total)}</b>{last.change ? ' · الباقي ' + money(last.change) : ''} — <button className="btn sm gh" onClick={() => posPrint(posReceiptHtml(org, last, br))}><Printer size={12} />إعادة الطباعة</button></div>}
          </div>
          {cartBox}
          {cart.length > 0 && !showCart && <button className="btn pri pos-fab" onClick={() => setShowCart(true)}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="num pos-fab-n">{cartCount}</span>عرض الطلب والدفع</span><span className="num" style={{ fontSize: 19 }}>{money(T.total)}</span></button>}
        </div>))}

      {view === 'orders' && (() => {
        // v34.4: سجل الفواتير — بالتاريخ ونوع السداد والبحث، مع مجموع كل نوع وتصدير Excel
        const payAr = (p) => p.pmName ? p.pmName : p.m === 'cash' ? 'نقدي' : p.m === 'card' ? 'شبكة' : p.m === 'transfer' ? 'تحويل' : p.m === 'credit' ? 'آجل' + (p.custName ? ' — ' + p.custName : '') : (p.appName || 'تطبيق');
        const list = allOrders.filter(o => o.branchId === br.id && o.date === ordF.d)
          .filter(o => ordF.pay === 'all' || (ordF.pay === 'void' ? o.status === 'void' : o.status !== 'void' && (o.payments || []).some(p => p.m === ordF.pay)))
          .filter(o => !ordF.q.trim() || String(o.no).includes(ordF.q.trim()) || (o.loyalty && String(o.loyalty.phone || '').includes(normPhone(ordF.q))) || (o.lines || []).some(l => (l.name || '').includes(ordF.q.trim())))
          .sort((a, b) => String(b.at).localeCompare(String(a.at)));
        const st = posOrdersStats(list);
        const xl = () => { try { const head = ['رقم الفاتورة', 'التاريخ', 'الوقت', 'الكاشير', 'الأصناف', 'قبل الخصم', 'الخصم', 'الإجمالي', 'منها ضريبة', 'نقدي', 'شبكة', 'تحويل', 'تطبيق', 'الباقي', 'الحالة'];
          const amt = (o, m) => posR2((o.payments || []).filter(p => p.m === m).reduce((a, p) => a + (Number(p.amount) || 0), 0));
          const body = list.map(o => [o.no, o.date, new Date(o.at).toTimeString().slice(0, 5), o.by || '', (o.lines || []).map(l => l.name + ' ×' + l.qty).join('، '), o.gross || 0, o.disc || 0, o.total, o.vat, amt(o, 'cash'), amt(o, 'card'), amt(o, 'transfer'), amt(o, 'app'), o.change || 0, o.status === 'void' ? 'ملغاة: ' + (o.voidReason || '') : o.kind === 'return' ? 'مرتجع عن ' + (o.refNo || '') + ' — ' + (WASTE_REASONS[o.reason] || '') : o.pending ? 'لم تُرسل بعد' : 'مدفوعة']);
          const blob = makeXlsx([{ name: 'فواتير ' + ordF.d, rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'فواتير_' + br.name + '_' + ordF.d + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل سجل الفواتير (Excel) ✓'); } catch { say('تعذّر التصدير', 'no'); } };
        return <div className="card">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 8 }}>
            <Field label="التاريخ" style={{ marginBottom: 0 }}><input type="date" className="inp" value={ordF.d} onChange={e => setOrdF(x => ({ ...x, d: e.target.value || today }))} /></Field>
            <Field label="نوع السداد" style={{ marginBottom: 0 }}><select className="sel" value={ordF.pay} onChange={e => setOrdF(x => ({ ...x, pay: e.target.value }))}><option value="all">الكل</option><option value="cash">نقدي</option><option value="card">شبكة</option><option value="transfer">تحويل</option><option value="app">تطبيقات التوصيل</option><option value="void">الملغاة</option></select></Field>
            <Field label="بحث" style={{ marginBottom: 0, flex: 1, minWidth: 150 }}><input className="inp" value={ordF.q} placeholder="رقم الفاتورة، صنف، جوال عميل" onChange={e => setOrdF(x => ({ ...x, q: e.target.value }))} /></Field>
            <button className="btn sm" onClick={xl}><Download size={13} />Excel</button>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="badge b-brass">{st.n} فاتورة · {money(st.total)}</span><span className="badge b-dim">نقدي {money(st.cash)}</span><span className="badge b-dim">شبكة {money(st.card)}</span>
            {st.transfer > 0 && <span className="badge b-dim">تحويل {money(st.transfer)}</span>}
            {Object.entries(st.pms || {}).map(([n, v]) => <span key={n} className="badge b-dim">{n} {money(v)}</span>)}
            {Object.entries(st.apps).map(([id, x]) => <span key={id} className="badge b-dim">{(apps.find(a => a.id === id) || {}).n || 'تطبيق'} {money(x.amount)}</span>)}
            {st.ldisc + st.odisc + st.mdisc + st.loyAmt > 0 && <span className="badge b-amber">خصومات {money(st.ldisc + st.odisc + st.mdisc + st.loyAmt)}</span>}
            {st.voidN > 0 && <span className="badge b-rose">ملغاة {st.voidN}</span>}{st.retN > 0 && <span className="badge b-rose">مرتجعات {st.retN} · {money(st.retAmt)}</span>}
          </div>
          <div className="tw"><table className="tb"><thead><tr><th>الفاتورة</th><th>الوقت</th><th>الأصناف</th><th style={{ textAlign: 'end' }}>المبلغ</th><th>نوع السداد</th><th></th></tr></thead><tbody>
            {list.map(o => <tr key={o.id} style={o.status === 'void' ? { opacity: .5 } : undefined}>
              <td className="num" style={{ fontSize: 11.5 }}>{o.no}{o.pending && <div><span className="badge b-amber" style={{ fontSize: 9.5 }}>لم تُرسل بعد</span></div>}{o.by && <div style={{ fontSize: 10, color: 'var(--faint)' }}>{o.by}</div>}</td>
              <td className="num" style={{ fontSize: 11.5 }}>{new Date(o.at).toLocaleTimeString('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit' })}</td>
              <td style={{ fontSize: 12 }}>{o.kind === 'return' ? <><span className="badge b-rose">مرتجع عن {o.refNo}</span> {o.offline && <span className="badge b-amber" data-offtag>{(ops.posOffRevs || []).some(v => v.retId === o.id) ? 'دون اتصال · رُوجع' : 'دون اتصال · للمراجعة'}</span>} {(o.retLines || []).map(l => l.name + (l.qty > 1 ? ' ×' + l.qty : '')).join('، ')}<div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{WASTE_REASONS[o.reason] || ''}{o.note ? ' — ' + o.note : ''}</div></> : (o.lines || []).map(l => l.name + (l.qty > 1 ? ' ×' + l.qty : '')).join('، ')}</td>
              <td style={{ textAlign: 'end' }}><b className="num">{money(o.total)}</b>{o.disc ? <div className="num" style={{ fontSize: 10, color: 'var(--mint)' }}>خصم {money(o.disc)}</div> : null}</td>
              <td style={{ fontSize: 11.5 }}>{o.status === 'void' ? <span className="badge b-rose">ملغاة: {o.voidReason}</span> : (o.payments || []).map((p, k) => <div key={k}><span className="badge b-dim">{payAr(p)}</span> <span className="num">{money(p.amount)}</span></div>)}{o.change ? <div className="num" style={{ fontSize: 10, color: 'var(--faint)' }}>الباقي {money(o.change)}</div> : null}</td>
              <td><div className="row" style={{ gap: 4 }}><button className="btn sm gh" title="إعادة طباعة" onClick={() => posPrint(o.kind === 'return' ? posReturnHtml(org, o, br) : posReceiptHtml(org, o, br))}><Printer size={12} /></button>{isMgr && o.status !== 'void' && o.kind !== 'return' && <button className="btn sm gh" onClick={() => voidOrder(o)}>إلغاء</button>}{retOn && isMgr && o.status !== 'void' && o.kind !== 'return' && !o.pending && <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => openReturn(o)}>مرتجع</button>}</div></td>
            </tr>)}
            {!list.length && <tr><td colSpan={6}><div className="empty">لا فواتير بهذه التصفية.</div></td></tr>}
          </tbody></table></div></div>;
      })()}

      {view === 'tables' && useTabs && (() => { const TS = tableStates(org, ops, br.id); const C2 = { free: ['var(--mint)', 'متاحة'], busy: ['var(--brass)', 'مشغولة'], bill: ['var(--rose)', 'الحساب مطبوع'] };
        return <div className="card" data-tables>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}><b style={{ fontSize: 16 }}>الطاولات — {br.name}</b>
            <div className="row" style={{ gap: 12, fontSize: 12 }}>{Object.entries(C2).map(([k, [c, t]]) => <span key={k} className="row" style={{ gap: 5, alignItems: 'center' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: c, display: 'inline-block' }} />{t} <b className="num">{TS.filter(x => x.st === k).length}</b></span>)}</div></div>
          {(() => { const AR = posAreas(org, br.id); const btn = (x) => <button key={x.no} className={'pos-tbl ' + x.st} aria-label={'طاولة ' + x.no} onClick={() => { if (x.st === 'free') { setTbl(x.no); setChannel('dinein'); setPayTab(null); setView('sell'); } else setTblSel(x); }}>
            <b className="num">{x.no}</b>{x.st === 'free' ? <small>متاحة</small> : <><small className="num">{money(x.total)}</small><small>{x.rounds} جولة · <span className="num">{x.mins}</span> د</small></>}</button>;
            if (!AR.length) return <div className="pos-tables">{TS.map(btn)}</div>;
            // v49.2 — MQ-005: الطاولات مجمّعة حسب الصالة، ومنتقي سريع للصالة
            const groups = [...AR.map(a => ({ ...a, list: TS.filter(x => +x.no >= a.from && +x.no <= a.to) })), { id: '', name: 'بلا صالة', list: TS.filter(x => !AR.some(a => +x.no >= a.from && +x.no <= a.to)) }].filter(g => g.list.length);
            const shown = areaF ? groups.filter(g => g.id === areaF) : groups;
            return <>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }} data-areas>{[{ id: '', name: 'كل الصالات' }, ...groups.filter(g => g.id)].map(g => <button key={g.id || 'all'} className={'btn sm' + ((areaF || '') === g.id ? ' pri' : ' gh')} onClick={() => setAreaF(g.id)}>{g.name}{g.list ? <small className="num" style={{ marginInlineStart: 5 }}>{g.list.filter(x => x.st !== 'free').length}/{g.list.length}</small> : null}</button>)}</div>
              {(() => { const SA = salesByArea(org, ops, br.id, today, today); return SA.length ? <div className="note" style={{ marginBottom: 10, fontSize: 12 }} data-areasales>مبيعات اليوم حسب الصالة: {SA.map(x => <span key={x.id || 'n'} style={{ marginInlineEnd: 12 }}>{x.name} <b className="num">{money(x.total)}</b> <small>({x.orders})</small>{x.perHead != null ? <small> · للشخص <span className="num">{money(x.perHead)}</span></small> : null}</span>)}</div> : null; })()}
              {shown.map(g => <div key={g.id || 'none'} style={{ marginBottom: 12 }} data-area={g.name}><div className="lbl" style={{ marginBottom: 6 }}>{g.name}</div><div className="pos-tables">{g.list.map(btn)}</div></div>)}
            </>; })()}
          {tblSel && (() => { const tl = openTab(ops, br.id, tblSel.no) || tblSel.tab; const RM = tabRemain(tl); const parts = ((tl.split || {}).parts) || []; return <Modal title={'الطاولة ' + tblSel.no} onClose={() => setTblSel(null)}>
            <div className="note" style={{ marginBottom: 10 }}>مفتوحة منذ <b className="num">{tblSel.mins}</b> دقيقة · {tblSel.rounds} جولة · الإجمالي <b className="num">{money(tblSel.total)}</b></div>
            {tabSum(tblSel.tab).lines.map((l, i) => <div key={i} className="row" style={{ justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px dashed var(--line)' }}><span>{l.name} ×<b className="num">{l.qty}</b>{l.note ? <small style={{ color: 'var(--faint)' }}> · {l.note}</small> : null}</span><span className="num">{money(l.qty * l.price)}</span></div>)}
            <div className="grid g2" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn" onClick={() => { setTbl(tblSel.no); setChannel('dinein'); setPayTab(null); setTblSel(null); setView('sell'); }}><Plus size={14} />إضافة طلب</button>
              <button className="btn" onClick={() => printBill(tblSel.tab)}><Printer size={14} />طباعة الحساب</button>
              <select className="sel" aria-label="نقل إلى طاولة" value="" onChange={e => e.target.value && moveTab(tblSel.tab, e.target.value)}><option value="">نقل إلى طاولة…</option>{TS.filter(y => y.st === 'free').map(y => <option key={y.no} value={y.no}>{y.no}</option>)}</select>
              <button className="btn pri" onClick={() => startPayTab(tl)}><Banknote size={14} />{RM.paidParts ? 'دفع المتبقي ' + money(RM.total) : 'الدفع'}</button>
            </div>
            {/* v56.52 — المطعم: الأشخاص والنادل والدمج والتقسيم (تظهر بتفعيلها فقط) */}
            {(RC.covers || RC.waiters) && <div className="row" data-tabmeta style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
              {RC.covers && <label className="row" style={{ gap: 6, fontSize: 13, alignItems: 'center' }}>الأشخاص<input className="inp n" style={{ width: 64 }} inputMode="numeric" aria-label="أشخاص الطاولة" defaultValue={tl.covers || ''} key={'cv' + tl.id + (tl.covers || '')} onBlur={e => { const v = e.target.value.trim(); if (v !== String(tl.covers || '')) setTabMeta(tl, { covers: v }); }} /></label>}
              {RC.waiters && <select className="sel" style={{ width: 'auto', minWidth: 120 }} aria-label="نادل الطاولة" value={tl.waiterId || ''} onChange={e => setTabMeta(tl, { waiterId: e.target.value })}><option value="">— النادل —</option>{waiters.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}{tl.waiterId && !waiters.some(w => w.id === tl.waiterId) ? <option value={tl.waiterId}>{tl.waiterName || tl.waiterId}</option> : null}</select>}
            </div>}
            {(RC.merge || RC.split) && <div className="grid g2" style={{ gap: 8, marginTop: 10 }}>
              {RC.merge && <select className="sel" aria-label="دمج طاولة" value="" onChange={e => e.target.value && mergeTab(tl, e.target.value)}><option value="">ضمّ حساب طاولة أخرى…</option>{TS.filter(y => y.st !== 'free' && y.no !== tblSel.no).map(y => <option key={y.no} value={y.no}>{y.no} · {money(y.total)}</option>)}</select>}
              {RC.split && <button className="btn" data-splitbtn disabled={!RM.lines.length} onClick={() => setSplitF({ tab: tl, n: 2, alloc: Object.fromEntries(RM.lines.map((l, i) => [i, [l.qty, 0]])) }) || setTblSel(null)}>تقسيم الفاتورة بالأصناف</button>}
            </div>}
            {parts.length > 0 && <div className="note" data-parts style={{ marginTop: 10 }}><b>أجزاء الفاتورة</b>
              {parts.map(pt => <div key={pt.id} className="row" data-part={pt.no} style={{ justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px dashed var(--line)' }}>
                <span style={{ fontSize: 12.5 }}>الجزء <b className="num">{pt.no}</b> · {pt.lines.map(l => l.name + ' ×' + l.qty).join('، ')} · <b className="num">{money(pt.total)}</b></span>
                {pt.orderId ? <span className="badge b-mint">مدفوع <span className="num">{pt.orderNo}</span></span> : <button className="btn sm pri" onClick={() => startPayTab(tl, pt)}>دفع الجزء {pt.no}</button>}</div>)}
            </div>}
            {(tl.conflicts || []).length > 0 && <div className="note" data-conflicts style={{ marginTop: 8, borderColor: 'var(--rose)' }}><b style={{ color: 'var(--rose)' }}>فواتير لم تُختم على الحساب (تعارض) — يراجعها مدير الفرع</b>{tl.conflicts.map((c, i) => <div key={i} style={{ fontSize: 12 }}><span className="num">{c.orderNo}</span> · {money(c.total)} · {c.why}</div>)}</div>}
            {(tl.mergeLog || []).length > 0 && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6 }} data-mergelog>{tl.mergeLog.map((m, i) => <div key={i}>دُمجت الطاولة <span className="num">{m.from}</span> ({money(m.total)}) — {m.by} · <span className="num">{String(m.at || '').slice(11, 16)}</span></div>)}</div>}
          </Modal>; })()}
          {splitF && (() => { const RM = tabRemain(splitF.tab), n = splitF.n; const PZ = splitPrice(splitF.tab, splitF.code); const S = tabSplitItems(splitF.tab, splitF.alloc, n, PZ); const disc = posR2(PZ.lines.reduce((a, l) => a + (l.disc || 0), 0) + PZ.orderDisc);
            const ptot = Array.from({ length: n }, (_, k) => RM.lines.reduce((a, l, i) => a + Math.round((Number((splitF.alloc[i] || [])[k]) || 0) * l.price * 100), 0) / 100);
            const setN = (v) => setSplitF(f => ({ ...f, n: v, alloc: Object.fromEntries(RM.lines.map((l, i) => [i, Array.from({ length: v }, (_, k) => (f.alloc[i] || [])[k] || 0)])) }));
            return <Modal title={'تقسيم فاتورة الطاولة ' + splitF.tab.table} onClose={() => setSplitF(null)} foot={<><button className="btn pri" data-splitsave disabled={!!S.err} onClick={saveSplit}><Check size={14} />حفظ التقسيم</button><button className="btn gh" onClick={() => setSplitF(null)}>إلغاء</button></>}>
              <div className="note" style={{ marginBottom: 8 }}>وزّع كمية كل صنف على الأجزاء. كل جزء يُدفع فاتورةً مستقلة (برقمها وبصمتها وضريبتها)، ومجموع الأجزاء = المتبقي <b className="num">{money(RM.total)}</b>.</div>
              <Field label="كوبون الطاولة (اختياري — يُحتسب على الطاولة كاملة ويُستهلك على الجزء الأول)"><input className="inp" aria-label="كوبون الطاولة" value={splitF.code || ''} onChange={e => setSplitF(f => ({ ...f, code: e.target.value }))} />{(splitF.code || '').trim() ? <div style={{ fontSize: 12, marginTop: 3, color: PZ.codeOk ? 'var(--mint)' : 'var(--rose)', fontWeight: 600 }}>{PZ.codeOk ? '✓ الكوبون فعّال' : 'رمز غير صالح أو العرض غير متاح الآن'}</div> : null}</Field>
              <Field label="عدد الأجزاء"><select className="sel" aria-label="عدد الأجزاء" value={n} onChange={e => setN(Number(e.target.value))}>{[2, 3, 4, 5, 6].map(v => <option key={v} value={v}>{v}</option>)}</select></Field>
              <div className="tw"><table className="tb" data-splited><thead><tr><th>الصنف</th><th>الكمية</th>{Array.from({ length: n }, (_, k) => <th key={k}>جزء {k + 1}</th>)}</tr></thead><tbody>
                {RM.lines.map((l, i) => <tr key={i}><td>{l.name}{l.note ? <small style={{ color: 'var(--faint)' }}> · {l.note}</small> : null}</td><td className="num">{l.qty}</td>
                  {Array.from({ length: n }, (_, k) => <td key={k}><input className="inp n" style={{ width: 56 }} inputMode="numeric" aria-label={'جزء ' + (k + 1) + ' ' + l.name} value={(splitF.alloc[i] || [])[k] ?? 0} onChange={e => { const v = Number(e.target.value.replace(/[^\d]/g, '')) || 0; setSplitF(f => ({ ...f, alloc: { ...f.alloc, [i]: Array.from({ length: n }, (_, kk) => kk === k ? v : (f.alloc[i] || [])[kk] || 0) } })); }} /></td>)}</tr>)}
                <tr><td><b>{disc > 0 ? 'قبل العروض' : 'الإجمالي'}</b></td><td className="num">{money(RM.total)}</td>{ptot.map((v, k) => <td key={k} className="num" data-parttotal={k + 1}><b>{money(v)}</b></td>)}</tr>
                {disc > 0 && <tr><td><b>بعد العروض</b> <small style={{ color: 'var(--faint)' }}>(الطاولة كاملة −{money(disc)})</small></td><td className="num">{money(posR2(RM.total - disc))}</td>{Array.from({ length: n }, (_, k) => <td key={k} className="num" data-partnet={k + 1}><b>{S.err ? '—' : money(S.parts[k].total)}</b></td>)}</tr>}
              </tbody></table></div>
              {S.err && <div className="note" data-spliterr style={{ marginTop: 8, color: 'var(--rose)' }}>{S.err}</div>}
            </Modal>; })()}
        </div>; })()}

      {view === 'dlv' && dlvOn && (() => {
        // v49.2 — MQ-006: لوحة التوصيل — جديد ← مع السائق ← تم/تعذّر، وعهدة نقد كل سائق وتسويتها
        const DR = posDrivers(org, br.id), L = (ops.posDeliveries || []).filter(x => x.branchId === br.id && (x.st === 'new' || x.st === 'out' || x.st === 'fail' || (x.st === 'done' && (!x.settledAt || String(x.date || x.doneAt || '').slice(0, 10) === today))));
        const move = async (x, to, extra = {}) => { const r = dlvMove(x, to, me.name, extra); if (r.err) return say(r.err, 'no');
          const ok = await commit(d => ({ ...d, posDeliveries: (d.posDeliveries || []).map(y => y.id === x.id ? r : y) }), { actionType: 'update', targetType: 'pos_delivery', targetId: x.id, branchName: br.name, title: 'التوصيل: ' + DLV_ST[to].ar, details: x.no + (r.driverName ? ' · ' + r.driverName : '') + (r.reason ? ' · ' + r.reason : '') });
          if (ok) say(x.no + ' — ' + DLV_ST[to].ar + ' ✓'); };
        const settle = async (s2) => { if (!(s2.custody > 0)) return; if (!window.confirm('استلام ' + money(s2.custody) + ' نقدًا من ' + s2.name + '؟')) return; const at = nowISO();
          const ok = await commit(d => ({ ...d, posDeliveries: (d.posDeliveries || []).map(y => y.branchId === br.id && y.driverId === s2.driverId && y.st === 'done' && !y.settledAt ? { ...y, settledAt: at, settledBy: me.name } : y) }), { actionType: 'update', targetType: 'pos_delivery', targetId: s2.driverId, branchName: br.name, title: 'تسوية عهدة سائق', details: s2.name + ' · ' + money(s2.custody) });
          if (ok) say('سُوّيت عهدة ' + s2.name + ' ✓'); };
        const SM = dlvSummary(org, ops, br.id, today);
        const col = (st) => <div className="card" style={{ flex: 1, minWidth: 240 }} data-dlvcol={st}>
          <div className="card-t" style={{ marginBottom: 8 }}><span className={'badge ' + DLV_ST[st].c}>{DLV_ST[st].ar}</span> <b className="num">{L.filter(x => x.st === st).length}</b></div>
          {L.filter(x => x.st === st).map(x => <div key={x.id} className="note" style={{ margin: '0 0 8px', fontSize: 12.5 }} data-dlv={x.no}>
            <div className="row" style={{ justifyContent: 'space-between' }}><b className="num">{x.no}</b><b className="num">{money(x.total)}</b></div>
            {(x.addr || x.phone) && <div style={{ color: 'var(--dim)' }}>{x.addr}{x.phone ? <span className="num"> · {x.phone}</span> : null}</div>}
            {x.cash > 0 && <div>نقد يُحصَّل: <b className="num">{money(x.cash)}</b></div>}
            {x.driverName && <div>السائق: <b>{x.driverName}</b></div>}{x.reason && <div style={{ color: 'var(--rose)' }}>{x.reason}</div>}
            <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {(st === 'new' || st === 'fail') && <select className="sel" style={{ width: 'auto' }} aria-label={'سائق ' + x.no} defaultValue="" onChange={e => { const d0 = DR.find(d => d.id === e.target.value); if (d0) move(x, 'out', { driverId: d0.id, driverName: d0.name }); }}><option value="">إرسال مع…</option>{DR.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
              {st === 'out' && <><button className="btn sm pri" onClick={() => move(x, 'done')}>تم التوصيل</button><button className="btn sm gh" onClick={() => { const r = window.prompt('سبب تعذّر التوصيل:'); if (r) move(x, 'fail', { reason: r }); }}>تعذّر</button></>}
              {st === 'done' && (x.settledAt ? <span className="badge b-mint">سُوّي</span> : x.cash > 0 ? <span className="badge b-amber">النقد مع السائق</span> : null)}
            </div></div>)}
        </div>;
        return <>
          {!DR.length && <div className="note">أضف السائقين من إعدادات نقطة البيع لإسناد الطلبات.</div>}
          <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>{['new', 'out', 'done', 'fail'].map(col)}</div>
          {SM.length > 0 && <div className="card" style={{ marginTop: 10 }} data-dlvsum><div className="card-t" style={{ marginBottom: 8 }}>السائقون اليوم</div>
            <div className="tw"><table className="tb"><thead><tr><th>السائق</th><th>الطلبات</th><th>تم</th><th>جارٍ</th><th>متوسط الدقائق</th><th>العهدة النقدية</th><th /></tr></thead><tbody>
              {SM.map(r => <tr key={r.driverId}><td>{r.name}</td><td className="num">{r.orders}</td><td className="num">{r.done}</td><td className="num">{r.out}</td><td className="num">{r.avgMin ?? '—'}</td><td className="num"><b>{money(r.custody)}</b></td>
                <td>{r.custody > 0 && <button className="btn sm" onClick={() => settle(r)}>استلام النقد</button>}</td></tr>)}</tbody></table></div></div>}
        </>; })()}
      {view === 'kds' && kds && (() => { const now = Date.now(); const cols = ['new', 'prep', 'ready'];
        // v56.52: محطة هذا الجهاز (تُحفظ على الجهاز) — بلا محطات معرّفة: كل التذاكر كما كان
        const kv = kdsStM[br.id] || '', kSt = kdsSTs.length && (kdsSTs.some(x => x.id === kv) || kv === '-') ? kv : ''; const L = kdsLive(ops, br.id).filter(k => !kSt || (kSt === '-' ? !k.station : k.station === kSt));
        const pickSt = (v) => { const m = { ...kdsStM, [br.id]: v }; setKdsStM(m); try { localStorage.setItem('mizan:kdsStation', JSON.stringify(m)); } catch { } };
        return <>{kdsSTs.length > 0 && <div className="row" data-kdsst style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600 }}>محطة هذه الشاشة</span>
          {[['', 'كل المحطات'], ...kdsSTs.map(x => [x.id, x.name]), ['-', 'عام']].map(([id, t]) => <button key={id || 'all'} className={'btn sm' + (kSt === id ? ' pri' : ' gh')} onClick={() => pickSt(id)}>{t}</button>)}</div>}
        <div className="pos-kds" data-kds>{cols.map(c => { const list = L.filter(k => k.status === c); return <div key={c} className="pos-kcol">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b>{KDS_ST[c][1]}</b><span className={'badge ' + KDS_ST[c][0]}>{list.length}</span></div>
          {list.map(k => { const m = Math.max(0, Math.round((now - Date.parse(k.at)) / 60000)) || 0; return <div key={k.id} className={'pos-ticket' + (m >= 20 ? ' late' : '') + (k.rush ? ' rush' : '')} data-ticket={k.station || ''}>
            {(k.rush || k.stationName) && <div className="row" style={{ gap: 6 }}>{k.rush && <span className="badge b-rose" data-rushtag>مستعجل</span>}{k.stationName && <span className="badge b-dim">{k.stationName}</span>}</div>}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b>{k.table ? 'طاولة ' + k.table : k.channel === 'delivery' ? 'توصيل' : 'سفري'}{k.ref ? <small className="num" style={{ color: 'var(--faint)' }}> {k.ref}</small> : null}</b><span className="num" style={{ fontSize: 12, fontWeight: 700, color: m >= 20 ? 'var(--rose)' : 'var(--dim)' }}>{m} د</span></div>
            <ul>{k.lines.map((l, i) => <li key={i}><b className="num">{l.qty}×</b> {l.name}{l.note ? <small> — {l.note}</small> : null}</li>)}</ul>
            <div className="row" style={{ gap: 6 }}><button className={'btn sm' + (c === 'ready' ? ' pri' : '')} style={{ flex: 1 }} onClick={() => kdsMove(k)}>{c === 'new' ? 'ابدأ التحضير' : c === 'prep' ? 'جاهز' : 'تم التسليم'}</button>
              {RC.rush && c !== 'ready' && <button className="btn sm gh" aria-label={k.rush ? 'إلغاء الاستعجال' : 'مستعجل'} onClick={() => kdsRush(k)}>{k.rush ? 'عادي' : 'مستعجل'}</button>}</div>
          </div>; })}
          {!list.length && <div className="empty" style={{ padding: 14 }}>لا شيء</div>}
        </div>; })}</div></>; })()}

      {view === 'shift' && <div className="card">
        {!shift ? <div className="empty">لا وردية مفتوحة على هذا الجهاز — افتحها من «البيع».</div> : (() => { const os = shiftOrders(shift).filter(o => o.status !== 'void'); const exp = posR2(shift.openingCash + os.reduce((a, o) => a + posCashNet(o), 0)); return <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}><span className="badge b-mint">مفتوحة منذ {String(shift.openedAt).slice(11, 16)} · {shift.openedBy}</span><span className="badge b-dim">افتتاحي {money(shift.openingCash)}</span><span className="badge b-dim">{os.length} فاتورة · {money(os.reduce((a, o) => a + o.total, 0))}</span><span className="badge b-brass">النقد المتوقع في الدرج {money(exp)}</span></div>
          <div className="grid g2" style={{ alignItems: 'end' }}><Num label="النقد المعدود فعلًا" value={(shiftF || {}).counted || ''} onChange={v => setShiftF({ counted: v })} />
            <button className="btn pri" disabled={!shiftF || shiftF.counted === undefined || shiftF.counted === ''} onClick={closeShift}><Lock size={14} />إغلاق الوردية وطباعة التقرير</button></div>
          {shiftF && shiftF.counted !== undefined && shiftF.counted !== '' && <div className="note" style={{ marginTop: 6 }}>الفرق: <b className="num">{money(posR2(posR2(String(shiftF.counted).replace(/[^\d.]/g, '')) - exp))}</b> {posR2(String(shiftF.counted).replace(/[^\d.]/g, '')) - exp < -0.004 ? '(عجز)' : posR2(String(shiftF.counted).replace(/[^\d.]/g, '')) - exp > 0.004 ? '(زيادة)' : '(مطابق)'}</div>}
        </>; })()}
        <div className="note" style={{ marginTop: 8 }}>بعد إغلاق ورديات اليوم: افتح «الإغلاق اليومي» واضغط «تعبئة من نقطة البيع» فتُملأ المبيعات النقدية والشبكة والتطبيقات تلقائيًا.</div>
      </div>}

      {view === 'rest' && isMgr && (() => {
        // v56.52 — تقارير المطعم: مبيعات النُّدُل (اليوم أو وردية)، الصالات بمتوسط الفاتورة للشخص، وأوقات التحضير من حالات شاشة المطبخ
        const d = rptF.d, shs = (ops.posShifts || []).filter(x => x.branchId === br.id && x.date === d);
        const W = RC.waiters ? salesByWaiter({ posOrders: allOrders }, br.id, d, d, rptF.sh) : [];
        const SA = RC.covers ? salesByArea(org, { posOrders: allOrders }, br.id, d, d) : [];
        const PR = kds && RC.prepRpt ? kdsPrepReport(ops.kdsTickets, { branchId: br.id, from: d, to: d, target: RC.prepTarget }) : null;
        const xl = () => { try { const sheets = [...(RC.waiters ? [{ name: 'النُّدُل', rows: [['النادل', 'الفواتير', 'الأشخاص', 'المبيعات', 'منها مرتجعات', 'متوسط الفاتورة', 'للشخص'], ...W.map(x => [x.name, x.orders, x.covers, x.total, x.returns, x.avg, x.perHead == null ? '' : x.perHead])] }] : []),
            ...(RC.covers ? [{ name: 'الصالات', rows: [['الصالة', 'الفواتير', 'الأشخاص', 'المبيعات', 'للشخص'], ...SA.map(x => [x.name, x.orders, x.covers, x.total, x.perHead == null ? '' : x.perHead])] }] : []), ...(PR ? kdsPrepSheets(PR) : [])];
          const blob = makeXlsx(sheets); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'تقارير_المطعم_' + br.name + '_' + d + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل التقرير (Excel) ✓'); } catch { say('تعذّر التصدير', 'no'); } };
        const tb = (head, rows) => <div className="tw"><table className="tb"><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>;
        return <div className="grid" style={{ gap: 10 }} data-restrpt>
          <div className="card"><div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
            <Field label="اليوم" style={{ marginBottom: 0 }}><input type="date" className="inp" value={d} onChange={e => setRptF({ d: e.target.value || today, sh: '' })} /></Field>
            {RC.waiters && <Field label="الوردية" style={{ marginBottom: 0 }}><select className="sel" aria-label="وردية التقرير" value={rptF.sh} onChange={e => setRptF(x => ({ ...x, sh: e.target.value }))}><option value="">كل اليوم</option>{shs.map(x => <option key={x.id} value={x.id}>{(x.devName || x.dev || '') + ' · ' + String(x.openedAt || '').slice(11, 16) + ' · ' + (x.openedBy || '')}</option>)}</select></Field>}
            <button className="btn sm" onClick={xl}><Download size={13} />Excel</button></div></div>
          {RC.waiters && <div className="card" data-rptwaiters><div className="card-t" style={{ marginBottom: 8 }}>مبيعات النُّدُل</div>
            {tb(['النادل', 'الفواتير', 'الأشخاص', 'المبيعات', 'منها مرتجعات', 'متوسط الفاتورة', 'للشخص'], W.length ? W.map(x => <tr key={x.id}><td>{x.name}</td><td className="num">{x.orders}</td><td className="num">{x.covers || '—'}</td><td className="num"><b>{money(x.total)}</b></td><td className="num">{x.returns ? money(x.returns) : '—'}</td><td className="num">{money(x.avg)}</td><td className="num">{x.perHead == null ? '—' : money(x.perHead)}</td></tr>) : <tr><td colSpan={7}><div className="empty">لا فواتير بنادل في هذه الفترة.</div></td></tr>)}</div>}
          {RC.covers && <div className="card" data-rptareas><div className="card-t" style={{ marginBottom: 8 }}>الصالات ومتوسط الفاتورة للشخص</div>
            {tb(['الصالة', 'الفواتير', 'الأشخاص', 'المبيعات', 'للشخص'], SA.length ? SA.map(x => <tr key={x.id || 'n'}><td>{x.name}</td><td className="num">{x.orders}</td><td className="num">{x.covers || '—'}</td><td className="num"><b>{money(x.total)}</b></td><td className="num">{x.perHead == null ? '—' : money(x.perHead)}</td></tr>) : <tr><td colSpan={5}><div className="empty">لا مبيعات محلية في هذا اليوم.</div></td></tr>)}
            <div className="hint">الأشخاص يُختمون على أول فاتورة من حساب الطاولة فقط (لا تتكرر عند التقسيم).</div></div>}
          {PR && <div className="card" data-rptprep><div className="card-t" style={{ marginBottom: 8 }}>أوقات التحضير (من وصول التذكرة حتى «جاهز»)</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}><span className="badge b-brass">{PR.n} تذكرة · متوسط <span className="num">{PR.avg}</span> د</span>{PR.target ? <span className={'badge ' + (PR.late ? 'b-rose' : 'b-mint')}>المتأخر عن <span className="num">{PR.target}</span> د: <span className="num">{PR.late}</span> ({PR.latePct}%)</span> : <span className="badge b-dim">لم يُحدَّد هدف التحضير في الإعدادات</span>}</div>
            {tb(['المحطة', 'التذاكر', 'المتوسط (د)', 'الأقصى (د)', 'المتأخر', 'النسبة %'], PR.stations.map(x => <tr key={x.key || 'k'}><td>{x.name}</td><td className="num">{x.n}</td><td className="num">{x.avg}</td><td className="num">{x.max}</td><td className="num">{PR.target ? x.late : '—'}</td><td className="num">{x.latePct == null ? '—' : x.latePct}</td></tr>))}
            <div style={{ height: 8 }} />
            {tb(['الصنف', 'مرات', 'الكمية', 'المتوسط (د)', 'المتأخر', 'النسبة %'], PR.items.map(x => <tr key={x.key}><td>{x.name}</td><td className="num">{x.n}</td><td className="num">{x.qty}</td><td className="num">{x.avg}</td><td className="num">{PR.target ? x.late : '—'}</td><td className="num">{x.latePct == null ? '—' : x.latePct}</td></tr>))}
            <div className="hint">تُحفظ التذاكر المُسلّمة يومين فقط على مستند الفرع — صدّر التقرير يوميًا للاحتفاظ به.</div></div>}
        </div>; })()}
      {view === 'cfg' && <PosSettings org={org} commitOrg={commitOrg} say={say} dev={dev} me={me} />}
      {view === 'promos' && <PosPromos org={org} ops={ops} me={me} commitOrg={commitOrg} say={say} />}
      {view === 'loyalty' && <PosLoyalty org={org} commitOrg={commitOrg} say={say} canCfg={!!(R.admin || R.scope === 'all')} me={me} />}
      {view === 'shifts' && <PosShifts org={org} ops={ops} me={me} brs={brs} commit={commit} say={say} />}

      {ret && (() => { const o = ret.o; const left = posReturnable(opsR, o); const qs = {}; Object.entries(ret.q).forEach(([i, v]) => { const n = Number(v) || 0; if (n > 0) qs[i] = Math.min(n, left[i] || 0); });
        const C = posReturnCalc(o, qs); const opts = posRefundOptions(o);
        const optAr = (x) => x.pmName || (x.m === 'cash' ? 'نقدي' : x.m === 'card' ? 'شبكة' : x.m === 'transfer' ? 'تحويل' : x.m === 'credit' ? 'إلى حساب العميل' + (x.custName ? ' — ' + x.custName : '') + ' (حتى ' + money(posArRefundMax({ ...ops, posOrders: allOrders }, o)) + ')' : (x.appName || 'تطبيق'));
        return <Modal title={'مرتجع عن الفاتورة ' + o.no} icon={FileText} onClose={() => setRet(null)}
          foot={<><button className="btn pri" disabled={!(C.total > 0)} onClick={() => saveReturn(true)}><Printer size={14} />حفظ وطباعة الإشعار</button><button className="btn" disabled={!(C.total > 0)} onClick={() => saveReturn(false)}>حفظ</button><button className="btn gh" onClick={() => setRet(null)}>إلغاء</button></>}>
          <div className="note" style={{ marginBottom: 8 }}>الأطباق المرتجعة تُسجَّل <b>هدرًا</b> ولا ترجع للمخزون. يُصدر «إشعار دائن» ويُخصم المبلغ والضريبة من مبيعات اليوم.</div>
          <div className="tw"><table className="tb"><thead><tr><th>الصنف</th><th>المباع</th><th>المتبقي</th><th>المرتجع</th></tr></thead><tbody>
            {(o.lines || []).map((l, i) => <tr key={i}><td>{l.name}</td><td className="num">{l.qty}</td><td className="num">{left[i]}</td>
              <td>{left[i] > 0 ? <input className="inp n" style={{ width: 80 }} inputMode="numeric" aria-label={'كمية مرتجع ' + l.name} value={ret.q[i] || ''} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setRet(x => ({ ...x, q: { ...x.q, [i]: v } })); }} /> : '—'}</td></tr>)}
          </tbody></table></div>
          <div className="grid g2" style={{ gap: 8, marginTop: 8 }}>
            <Field label="سبب المرتجع (قائمة الهدر)"><select className="sel" value={ret.reason} onChange={e => setRet(x => ({ ...x, reason: e.target.value }))}>{Object.entries(WASTE_REASONS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
            <Field label="رد المبلغ"><select className="sel" value={ret.k} onChange={e => setRet(x => ({ ...x, k: e.target.value }))}>{opts.map(x => <option key={x.k} value={x.k}>{optAr(x)}{x.k === opts[0].k ? ' (طريقة الدفع الأصلية)' : ''}</option>)}</select></Field>
          </div>
          <Field label={ret.reason === 'other' ? 'وصف السبب (إلزامي)' : 'ملاحظة'}><input className="inp" value={ret.note} onChange={e => setRet(x => ({ ...x, note: e.target.value }))} /></Field>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="badge b-rose">المبلغ المردود {money(C.total)}</span><span className="badge b-dim">منها ضريبة {money(C.vat)}</span>{(() => { const d = posReturnLoyDed(ops, o, C.total); return d > 0 ? <span className="badge b-amber">يُخصم {d} نقطة ولاء</span> : null; })()}</div>
        </Modal>; })()}
      {pay && <Modal title={'الدفع — ' + money(T.total)} icon={Banknote} onClose={() => setPay(null)}
        foot={<><button className="btn pri" style={{ flex: 1, minHeight: 50, fontSize: 16 }} onClick={() => checkout(cfg.autoPrint !== false)}><Check size={16} />{cfg.autoPrint !== false ? 'تأكيد وطباعة' : 'تأكيد'}</button>
          <button className="btn" style={{ minHeight: 50 }} onClick={() => checkout(cfg.autoPrint === false)}>{cfg.autoPrint !== false ? 'بلا طباعة' : 'تأكيد وطباعة'}</button></>}>
        {pay.parts.map((x, i) => <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="الطريقة" style={{ marginBottom: 0 }}><select className="sel" value={x.pm ? 'pm:' + x.pm : x.m} onChange={e => { const v = e.target.value; const pm = v.startsWith('pm:') ? payMs.find(z => 'pm:' + z.id === v) : null; setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? (pm ? { ...y, m: pm.kind || 'card', pm: pm.id, pmName: pm.n } : { ...y, m: v, pm: undefined, pmName: undefined, ...(v === 'app' && !y.appId ? { appId: (apps[0] || {}).id } : {}) }) : y) })); }}>{payMs.map(pm => <option key={pm.id} value={'pm:' + pm.id}>{pm.n}</option>)}<option value="cash">نقدي</option><option value="card">شبكة (مدى/بطاقة)</option><option value="transfer">تحويل بنكي</option><option value="app">تطبيق توصيل</option>{creditOn && crCusts.length > 0 && <option value="credit">آجل (على حساب عميل)</option>}</select></Field>
          {x.m === 'credit' && <Field label="العميل (مؤهل للآجل)" style={{ marginBottom: 0 }}><select className="sel" aria-label="عميل الآجل" value={x.custKey || ''} onChange={e => setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? { ...y, custKey: e.target.value } : y) }))}><option value="">— اختر العميل —</option>{crCusts.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}</select></Field>}
          {x.m === 'app' && <Field label="التطبيق" style={{ marginBottom: 0 }}><select className="sel" value={x.appId} onChange={e => setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? { ...y, appId: e.target.value } : y) }))}>{apps.map(a => <option key={a.id} value={a.id}>{a.n}</option>)}</select></Field>}
          <Field label="المبلغ" style={{ marginBottom: 0 }}><input className="inp n" style={{ fontSize: 18, width: 140 }} inputMode="decimal" autoFocus={i === 0} value={x.amount} onChange={e => setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? { ...y, amount: e.target.value.replace(/[^\d.]/g, '') } : y) }))} /></Field>
          {pay.parts.length > 1 && <button className="btn sm gh" title="حذف هذه الدفعة" onClick={() => setPay(pp => ({ ...pp, parts: pp.parts.filter((_, k) => k !== i) }))}><X size={14} /></button>}
        </div>)}
        {/* v34.13: دفعات متعددة بلا حد — المتبقي يُقترح تلقائيًا للدفعة الجديدة */}
        <div className="pos-addpay"><span>إضافة دفعة:</span>{[['cash', 'نقدي'], ['card', 'شبكة'], ['transfer', 'تحويل'], ...payMs.map(pm => ['pm:' + pm.id, pm.n]), ['app', 'تطبيق توصيل'], ...(creditOn && crCusts.length && !pay.parts.some(y => y.m === 'credit') ? [['credit', 'آجل']] : [])].map(([k, t]) => <button key={k} onClick={() => setPay(pp => { const rem = posR2(T.total - pp.parts.reduce((a, y) => a + (Number(y.amount) || 0), 0)); const pm = k.startsWith('pm:') ? payMs.find(z => 'pm:' + z.id === k) : null;
          return { ...pp, parts: [...pp.parts, { ...(pm ? { m: pm.kind || 'card', pm: pm.id, pmName: pm.n } : { m: k, ...(k === 'app' ? { appId: (apps[0] || {}).id } : {}) }), amount: rem > 0 ? String(rem) : '' }] }; })}>+ {t}</button>)}</div>
        {pay.parts.some(x => x.m === 'cash') && <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{[...new Set([T.total, Math.ceil(T.total / 10) * 10, Math.ceil(T.total / 50) * 50, Math.ceil(T.total / 100) * 100, 500])].filter(v => v >= T.total).slice(0, 5).map(v => <button key={v} className="btn sm" onClick={() => setPay(pp => ({ ...pp, parts: pp.parts.map(y => y.m === 'cash' ? { ...y, amount: String(v) } : y) }))}>{money(v)}</button>)}</div>}
        {pay.parts.some(x => x.m === 'credit') && <div className="note" style={{ margin: '6px 0' }}>البيع الآجل يتطلب اتصالًا: يتحقق الخادم من حد ائتمان العميل قبل إصدار الفاتورة. الباقي يُرد من النقد فقط، ولا يُجمع الآجل مع تطبيق توصيل. اطلب توقيع المستلم على الإيصال.</div>}
        {(() => { const paid = posR2(pay.parts.reduce((a, x) => a + (Number(x.amount) || 0), 0)); const ch = posR2(paid - T.total); const st = ch < -0.004 ? 'rem' : ch > 0.004 ? 'chg' : 'ok';
          return <div className={'pos-paystat ' + st}><span>{st === 'rem' ? 'المتبقي' : st === 'chg' ? 'الباقي للعميل' : 'مكتمل — لا باقٍ'}</span><span className="num">{money(Math.abs(ch))}</span></div>; })()}
      </Modal>}
    </div>);
}
