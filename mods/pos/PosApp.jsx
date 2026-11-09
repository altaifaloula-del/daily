/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { cloud, KEYS, brKey, bfKey } from '../../storage';
import { Store, X, RefreshCw, FileText, Clock, ShieldCheck, Check, Plus, Printer, Download, Lock, Banknote } from 'lucide-react';
import { APPS, CloudHealth, Field, Modal, Num, POS_SH_KEY, PosLoyalty, PosPromos, PosQuickProducts, PosSettings, PosShifts, QUOTA_MSG, ROLES, businessDay, isoD, logClientError, loyBal, loyEarn, loyPost, loyQ, loyQSet, loyRedeemMax, makeXlsx, money, normPhone, nowISO, pendShiftsGet, pendShiftsSet, posCashNet, posDaySummary, posDev, posOrdersStats, posPriceCart, posPrint, posQueue, posQueueSet, posR2, posReceiptHtml, posTotals, posZHtml, promoActive, promoHits, sha256Hex, uid } from '../../App.jsx';

export function PosApp({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const R = ROLES[me.role] || {};
  const isMgr = !!(R.admin || R.scope === 'all' || me.role === 'branch_manager' || me.role === 'regional_manager');
  const cfg = org.posCfg || {}; const enabled = cfg.branches || [];
  const brs = (myBranches || []).filter(b => b.isActive !== false && enabled.includes(b.id));
  const [brId, setBrId] = useState(() => (brs[0] || {}).id || '');
  const br = brs.find(b => b.id === brId) || brs[0];
  const dev = useMemo(posDev, []);
  const rate = (org.taxCfg || {}).enabled ? (Number((org.taxCfg || {}).rate) || 15) : 0;
  const prods = (org.products || []).filter(p => !p.posOff && Number(p.sellPrice) > 0);
  const cats = [...new Set(prods.map(p => p.cat || 'أخرى'))];
  const [cat, setCat] = useState(''); const [q, setQ] = useState('');
  const [cart, setCart] = useState([]); const [channel, setChannel] = useState('takeaway');
  const [disc, setDisc] = useState({ mode: 'amt', amt: '', reason: '' }); const [pay, setPay] = useState(null); const [last, setLast] = useState(null);
  const [code, setCode] = useState(''); const [quickP, setQuickP] = useState(false); const [diag, setDiag] = useState(false); const [sending, setSending] = useState(false); const [ext, setExt] = useState({ disc: false, code: false, loy: false }); const [ordF, setOrdF] = useState(() => ({ d: businessDay(), pay: 'all', q: '' })); const [cust, setCust] = useState({ phone: '', name: '', redeem: false });
  const loyCfg = org.loyaltyCfg || {}; const [loy, setLoy] = useState(null);
  useEffect(() => { if (!loyCfg.enabled) return; let dead = false; cloud.get(KEYS.loy, { members: {}, tx: [] }).then(d => { if (!dead) setLoy(d || { members: {}, tx: [] }); }).catch(() => { }); return () => { dead = true; }; }, [loyCfg.enabled]);
  const [view, setView] = useState('sell'); const [showCart, setShowCart] = useState(false);
  const [queue, setQueue] = useState(posQueue); const [cfgF, setCfgF] = useState(null); const [shiftF, setShiftF] = useState(null);
  const apps = org.deliveryApps || APPS;
  const today = businessDay();
  // الطلبات = المتزامنة + المعلّقة على الجهاز
  const allOrders = useMemo(() => { const m = {}; (ops.posOrders || []).forEach(o => { m[o.id] = o; }); queue.forEach(o => { if (!m[o.id]) m[o.id] = { ...o, pending: true }; }); return Object.values(m); }, [ops.posOrders, queue]);
  // v33.3: الوردية تُفتح على الجهاز فورًا حتى لو تعذّر الحفظ السحابي، وتُرسل مع الطلبات عند عودة الاتصال
  const [localShift, setLocalShift] = useState(() => { try { return JSON.parse(localStorage.getItem(POS_SH_KEY) || 'null'); } catch { return null; } });
  const [pendCloseL, setPendClose] = useState(pendShiftsGet); const pendClose = pendCloseL.length ? pendCloseL : null;
  const cloudShift = (ops.posShifts || []).find(x => x.branchId === (br || {}).id && x.dev === dev.tag && x.status === 'open' && !pendCloseL.some(p => p.id === x.id));
  const shift = cloudShift || (localShift && localShift.branchId === (br || {}).id && localShift.dev === dev.tag && localShift.status === 'open' ? { ...localShift, pending: true } : null);
  const setLS = (v) => { try { if (v) localStorage.setItem(POS_SH_KEY, JSON.stringify(v)); else localStorage.removeItem(POS_SH_KEY); } catch { } setLocalShift(v); };
  // v34.0: التسعير = العروض وخصم الصنف (لكل سطر) ← عرض الفاتورة ← الخصم اليدوي (مبلغ أو نسبة) ← استبدال النقاط
  const priced = posPriceCart(cart, org.products, org.posPromos, { branchId: (br || {}).id, code });
  const base1 = posR2(priced.sub - priced.orderDisc);
  const manual = disc.mode === 'pct' ? posR2(base1 * Math.min(100, Number(disc.amt) || 0) / 100) : Math.min(base1, posR2(disc.amt));
  const phoneN = normPhone(cust.phone); const phoneOk = phoneN.length >= 9;
  const loyBalance = phoneOk && loy ? loyBal(loy, phoneN) : 0;
  const redeemPts = phoneOk && loy && cust.redeem ? loyRedeemMax(loyCfg, loyBalance, posR2(base1 - manual)) : 0;
  const redeemAmt = posR2(redeemPts * (Number(loyCfg.ptValue) || 0));
  const T = posTotals(priced.lines, priced.orderDisc + manual + redeemAmt, rate);
  const earnPts = phoneOk && loyCfg.enabled ? loyEarn(loyCfg, T.total) : 0;
  const custName = phoneOk && loy ? (((loy.members || {})[phoneN] || {}).name || '') : '';
  // المزامنة: إرسال المعلّق ثم إزالته من الجهاز
  const flushRaw = useCallback(async () => {
    // الوردية المحلية أولًا (إن لم تصل السحابة بعد)
    let ls = null; try { ls = JSON.parse(localStorage.getItem(POS_SH_KEY) || 'null'); } catch { }
    if (ls) { const okS = await commit(d => (d.posShifts || []).some(x => x.id === ls.id) ? d : { ...d, posShifts: [ls, ...(d.posShifts || [])] });
      if (okS) { try { localStorage.removeItem(POS_SH_KEY); } catch { } setLocalShift(null); } else return; }
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
  }, [commit]);
  // v34.7: لا إرسالان متداخلان — رفع مستند كبير قد يتجاوز فاصل الإرسال الدوري (20 ثانية)
  const flushing = useRef(false);
  const flush = useCallback(async () => { if (flushing.current || cloud.quotaUntil()) return; flushing.current = true; try { await flushRaw(); } finally { flushing.current = false; } }, [flushRaw]);
  useEffect(() => { flush(); const t = setInterval(flush, 20000); const on = () => flush(); window.addEventListener('online', on); return () => { clearInterval(t); window.removeEventListener('online', on); }; }, [flush]);

  if (!brs.length) return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card"><div className="card-t" style={{ marginBottom: 8 }}><Store size={16} color="var(--brass)" />نقطة البيع — تجربة</div>
        <div className="note">نقطة البيع غير مفعّلة لفرعك بعد.{R.admin || R.scope === 'all' ? ' فعّلها لفرع التجربة من الإعدادات أدناه.' : ' يفعّلها مسؤول النظام لفرع التجربة.'}</div></div>
      {(R.admin || R.scope === 'all') && <PosSettings org={org} commitOrg={commitOrg} say={say} />}
    </div>);

  const add = (p) => setCart(c => { const i = c.findIndex(l => l.productId === p.id && !l.note); if (i >= 0) return c.map((l, k) => k === i ? { ...l, qty: l.qty + 1 } : l); return [...c, { key: uid('l'), productId: p.id, name: p.name, price: Number(p.sellPrice), qty: 1, note: '' }]; });
  const setQty = (key, d) => setCart(c => c.map(l => l.key === key ? { ...l, qty: Math.max(0, l.qty + d) } : l).filter(l => l.qty > 0));
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
    if (queue.length || shift.pending) {
      if (!window.confirm('توجد بيانات لم تصل للسحابة بعد (' + (queue.length ? queue.length + ' فاتورة' : 'الوردية نفسها') + ').\n\nإغلاق الوردية على هذا الجهاز وطباعة تقرير Z الآن؟ تُرسل الوردية المغلقة وفواتيرها تلقائيًا عند نجاح الحفظ — لا تمسح بيانات المتصفح ولا تحذف التطبيق قبل ذلك.')) return;
      if (shift.pending) setLS(null);
      const nx = [...pendShiftsGet().filter(x => x.id !== rec.id), rec]; pendShiftsSet(nx); setPendClose(nx);
      setShiftF(null); say('أُغلقت الوردية على الجهاز — الفرق ' + money(rec.diff) + ' · تُرسل تلقائيًا'); posPrint(posZHtml(org, rec, shiftOrders(shift), br)); flush();
      return;
    }
    const ok = await commit(d => ({ ...d, posShifts: (d.posShifts || []).map(x => x.id === shift.id ? rec : x) }), { actionType: 'update', targetType: 'pos_shift', targetId: shift.id, branchName: br.name, title: 'إغلاق وردية نقطة بيع', details: dev.name + ' · متوقع ' + money(expected) + ' · فعلي ' + money(counted) + ' · فرق ' + money(rec.diff) });
    if (ok) { setShiftF(null); say('أُغلقت الوردية — الفرق ' + money(rec.diff)); posPrint(posZHtml(org, rec, shiftOrders(shift), br)); }
  };
  const checkout = async (printNow) => {
    const paid = posR2((pay.parts || []).reduce((a, x) => a + (Number(x.amount) || 0), 0));
    const cashGiven = posR2((pay.parts || []).filter(x => x.m === 'cash').reduce((a, x) => a + (Number(x.amount) || 0), 0));
    if (paid + 0.004 < T.total) return say('المدفوع أقل من الإجمالي', 'no');
    const change = posR2(paid - T.total); if (change > cashGiven + 0.004) return say('الباقي لا يُرد إلا من النقد', 'no');
    if (manual > 0 && !disc.reason.trim()) return say('اكتب سبب الخصم', 'no');
    const maxPct = Number(cfg.maxDiscPct) || 0;
    if (manual > 0 && maxPct > 0 && !isMgr && base1 > 0 && manual / base1 * 100 > maxPct + 0.001) return say('الخصم اليدوي يتجاوز الحد المسموح للكاشير (' + maxPct + '%) — يلزم مدير الفرع', 'no');
    if (cust.phone.trim() && !phoneOk) return say('رقم جوال العميل غير صحيح', 'no');
    // ترقيم الجهاز اليومي وسلسلة البصمات (تعمل دون اتصال)
    const yy = today.replace(/-/g, '').slice(2); const sk = 'mizan:posSeq:' + br.id + ':' + today, hk = 'mizan:posHash:' + br.id;
    let seq = 1, prev = { icv: 0, hash: '0' }; try { seq = (Number(localStorage.getItem(sk)) || 0) + 1; prev = JSON.parse(localStorage.getItem(hk) || '{"icv":0,"hash":"0"}'); } catch { }
    const bi = (org.branches || []).findIndex(b => b.id === br.id) + 1;
    const o = { id: uid('po'), no: 'ف' + bi + '-' + yy + '-' + dev.tag + '-' + String(seq).padStart(4, '0'), branchId: br.id, dev: dev.tag, shiftId: shift.id, date: today, at: nowISO(), by: me.name,
      channel, lines: priced.lines.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price, ...(l.note ? { note: l.note } : {}), ...(l.disc ? { disc: l.disc, promoId: l.promoId, promoName: l.promoName } : {}) })),
      gross: T.gross, disc: T.disc, ...(priced.orderDisc ? { orderDisc: priced.orderDisc, orderPromo: priced.orderPromo } : {}), manualDisc: manual, ...(manual ? { discReason: disc.reason.trim() } : {}),
      ...(code.trim() && priced.codeOk ? { coupon: code.trim() } : {}),
      ...(phoneOk ? { loyalty: { phone: phoneN, name: (cust.name || custName).trim(), earned: earnPts, redeemed: redeemPts, redeemAmt, balAfter: posR2(loyBalance - redeemPts + earnPts) } } : {}),
      total: T.total, vat: T.vat, net: T.net, rate,
      payments: pay.parts.filter(x => Number(x.amount) > 0).map(x => ({ m: x.m, amount: posR2(x.amount), ...(x.m === 'app' ? { appId: x.appId, appName: (apps.find(a => a.id === x.appId) || {}).n || 'تطبيق' } : {}), ...(x.pm ? { pm: x.pm, pmName: x.pmName } : {}) })),
      change, status: 'paid', icv: (prev.icv || 0) + 1, pih: prev.hash || '0' };
    o.hash = sha256Hex(JSON.stringify([o.no, o.at, o.lines, o.total, o.vat, o.payments, o.icv, o.pih]));
    try { localStorage.setItem(sk, String(seq)); localStorage.setItem(hk, JSON.stringify({ icv: o.icv, hash: o.hash })); } catch { }
    const qn = [...posQueue(), o]; posQueueSet(qn); setQueue(qn);
    if (phoneOk && (earnPts || redeemPts)) loyQSet([...loyQ(), ...(redeemPts ? [{ id: o.id + ':r', phone: phoneN, name: (cust.name || custName).trim(), pts: -redeemPts, at: o.at, br: br.id, ord: o.no }] : []), ...(earnPts ? [{ id: o.id + ':e', phone: phoneN, name: (cust.name || custName).trim(), pts: earnPts, at: o.at, br: br.id, ord: o.no }] : [])]);
    setLast(o); setCart([]); setDisc({ mode: 'amt', amt: '', reason: '' }); setCode(''); setCust({ phone: '', name: '', redeem: false }); setPay(null); setShowCart(false);
    if (printNow === true || (printNow !== false && cfg.autoPrint !== false)) posPrint(posReceiptHtml(org, o, br));
    flush();
  };
  const voidOrder = async (o) => {
    if (!isMgr) return say('إلغاء الفاتورة لمدير الفرع', 'no');
    if (o.pending) return say('انتظر إرسال الفاتورة أولًا', 'no');
    const closed = (ops.closings || []).some(c => c.branchId === o.branchId && c.date === o.date && (c.status === 'submitted' || c.status === 'approved'));
    if (closed) return say('إغلاق هذا اليوم مُرحّل — لا تُلغى فواتيره', 'no');
    const reason = window.prompt('سبب إلغاء الفاتورة ' + o.no + ':'); if (!reason || !reason.trim()) return;
    await commit(d => ({ ...d, posOrders: (d.posOrders || []).map(x => x.id === o.id ? { ...x, status: 'void', voidBy: me.name, voidAt: nowISO(), voidReason: reason.trim() } : x) }), { actionType: 'update', targetType: 'pos_order', targetId: o.id, branchName: br.name, title: 'ألغى فاتورة نقطة بيع', details: o.no + ' · ' + money(o.total) + ' · ' + reason.trim() });
    if (o.loyalty && (o.loyalty.earned || o.loyalty.redeemed)) loyQSet([...loyQ(), ...(o.loyalty.earned ? [{ id: o.id + ':ve', phone: o.loyalty.phone, pts: -o.loyalty.earned, at: nowISO(), br: o.branchId, ord: o.no + ' (إلغاء)' }] : []), ...(o.loyalty.redeemed ? [{ id: o.id + ':vr', phone: o.loyalty.phone, pts: o.loyalty.redeemed, at: nowISO(), br: o.branchId, ord: o.no + ' (إلغاء)' }] : [])]);
    say('أُلغيت الفاتورة ' + o.no); flush();
  };

  const css = `.pos-wrap{display:grid;grid-template-columns:1fr 360px;gap:12px;align-items:start}
  .pos-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:9px}
  .pos-tile{border:1px solid var(--line);border-radius:14px;background:var(--ink2);padding:12px;min-height:104px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;cursor:pointer;text-align:start;font:inherit;color:var(--txt)}
  .pos-tile:active{transform:scale(.97)} .pos-tile b{font-size:14.5px;line-height:1.4} .pos-tile .num{font-size:15px;font-weight:700;color:var(--txt)}
  .pos-tile.on{border:2px solid var(--brand-fill,var(--brass));padding:11px 7px}
  .pos-tile-f{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .pos-qty{font-size:12px !important;font-weight:800 !important;background:var(--brand-fill,var(--brass));color:var(--brand-ink,#1a1410) !important;border-radius:999px;padding:1px 9px}
  .pos-head{background:var(--side-bg,#1F1C18);color:var(--side-txt,#EFEAE1);border-radius:var(--r-md);padding:10px 12px;display:flex;flex-direction:column;gap:10px}
  .pos-head-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .pos-mark{width:36px;height:36px;border-radius:10px;background:var(--brand-fill,var(--brass));color:var(--brand-ink,#1a1410);display:grid;place-items:center;flex-shrink:0}
  .pos-sub{font-size:12px;color:var(--side-dim,#B5AC9F);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pos-chip{font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:999px;background:var(--side-hl,#2F2A23);color:var(--side-txt,#EFEAE1)}
  .pos-head .sel.pos-br{width:auto;min-width:150px;background:var(--side-hl,#2F2A23);color:var(--side-txt,#EFEAE1);border-color:transparent}
  .pos-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .pos-tabs button{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--side-hl,#3A342C);background:transparent;color:var(--side-txt,#EFEAE1);font:600 14px inherit;font-family:inherit;cursor:pointer}
  .pos-tabs button.on{background:var(--brand-fill,var(--brass));color:var(--brand-ink,#1a1410);border-color:transparent}
  .pos-tabs .sel.pos-moresel{width:auto;min-height:40px;background:transparent;color:var(--side-txt,#EFEAE1);border:1px solid var(--side-hl,#3A342C);font-weight:600}
  .pos-tabs .sel.pos-moresel.on{background:var(--brand-fill,var(--brass));color:var(--brand-ink,#1a1410)}
  .pos-tabs .sel option{color:#1D1B18;background:#fff}
  .pos-cnt{font-size:11.5px;font-weight:700;background:var(--brand-fill,var(--brass));color:var(--brand-ink,#1a1410);border-radius:999px;padding:0 8px;margin-inline-start:6px}
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
  .pos-fab-n{background:var(--brand-fill,var(--brass));color:var(--brand-ink,#1a1410);border-radius:999px;padding:1px 10px;font-size:14px}
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
    .pos-head .pos-sub{max-width:180px}}`;
  const pendingBadge = (queue.length || pendClose || (localShift && localShift.branchId === (br || {}).id)) ? <span className="badge b-amber">⏳ {queue.length ? queue.length + ' فاتورة' : ''}{pendClose || localShift ? (queue.length ? ' + ' : '') + 'وردية' : ''} بانتظار الإرسال</span> : <span className="badge b-mint">متزامن ✓</span>;
  // v34.15: «إرسال الآن» — ينتظر أي إرسال جارٍ ثم يرسل فورًا ويعرض النتيجة
  function pendLeft() { let ls = null; try { ls = localStorage.getItem(POS_SH_KEY); } catch { } return posQueue().length + pendShiftsGet().length + loyQ().length + (ls ? 1 : 0); }
  async function sendNow() {
    setSending(true);
    try {
      for (let i = 0; i < 300 && flushing.current; i++) await new Promise(r => setTimeout(r, 200));
      const before = pendLeft(); await flush(); const left = pendLeft();
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
  const cartCount = cart.reduce((a, l) => a + l.qty, 0);
  const extOpen = { disc: ext.disc || !!disc.amt, code: ext.code || !!code.trim(), loy: ext.loy || !!cust.phone };
  const cartBox = (
    <div className={'card pos-cart' + (showCart ? ' open' : '')}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: 17 }}>الطلب الحالي{cartCount ? <span className="num pos-cnt">{cartCount}</span> : null}</b>
        <div className="row" style={{ gap: 4 }}>
          {cart.length > 0 && <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => { if (window.confirm('إفراغ الطلب؟')) setCart([]); }}>إفراغ</button>}
          {showCart && <button className="btn sm gh" aria-label="إغلاق" onClick={() => setShowCart(false)}><X size={16} /></button>}
        </div>
      </div>
      <div className="pos-seg" role="group" aria-label="نوع الطلب">{[['takeaway', 'سفري'], ['dinein', 'محلي'], ['delivery', 'توصيل']].map(([k, t]) => <button key={k} className={channel === k ? 'on' : ''} onClick={() => setChannel(k)}>{t}</button>)}</div>
      {cart.map(l => (
        <div key={l.key} className="pos-line">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{l.name}</div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}><span className="num">{money(l.price)} × {l.qty}</span>{pl(l).disc ? <span style={{ color: 'var(--mint)', fontWeight: 600 }}> · {pl(l).promoName} −<span className="num">{money(pl(l).disc)}</span></span> : null}
              {!(l.showNote || l.note) && <button className="pos-link" onClick={() => setCart(c => c.map(x => x.key === l.key ? { ...x, showNote: true } : x))}>+ ملاحظة</button>}</div>
            {(l.showNote || l.note) && <input className="inp" style={{ minHeight: 34, padding: '4px 8px', fontSize: 12.5, marginTop: 4 }} autoFocus={!l.note} placeholder="بدون بصل، حار…" value={l.note} onChange={e => setCart(c => c.map(x => x.key === l.key ? { ...x, note: e.target.value } : x))} />}
          </div>
          <button className="pos-qb" aria-label="إنقاص" onClick={() => setQty(l.key, -1)}>−</button><b className="num" style={{ minWidth: 22, textAlign: 'center' }}>{l.qty}</b><button className="pos-qb" aria-label="زيادة" onClick={() => setQty(l.key, 1)}>+</button>
          <b className="num" style={{ minWidth: 60, textAlign: 'end' }}>{money(l.qty * l.price - (pl(l).disc || 0))}</b>
        </div>))}
      {!cart.length && <div className="empty">اضغط الأصناف لإضافتها</div>}
      {cart.length > 0 && <>
        <div className="pos-ext">
          <button className={extOpen.disc ? 'on' : ''} onClick={() => setExt(x => ({ ...x, disc: !extOpen.disc }))}>{manual ? 'خصم ' + money(manual) : '+ خصم'}</button>
          <button className={extOpen.code ? 'on' : ''} onClick={() => setExt(x => ({ ...x, code: !extOpen.code }))}>{priced.codeOk ? 'كوبون ✓' : '+ كوبون'}</button>
          {loyCfg.enabled && <button className={extOpen.loy ? 'on' : ''} onClick={() => setExt(x => ({ ...x, loy: !extOpen.loy }))}>{phoneOk ? (custName || 'عميل') + ' ✓' : '+ عميل ولاء'}</button>}
        </div>
        {extOpen.disc && <div className="grid g2" style={{ gap: 6, marginTop: 8 }}>
          <Field label="خصم يدوي" style={{ marginBottom: 0 }}><div className="row" style={{ gap: 4 }}>
            <input className="inp n" inputMode="decimal" style={{ flex: 1 }} value={disc.amt} onChange={e => setDisc(d => ({ ...d, amt: e.target.value.replace(/[^\d.]/g, '') }))} />
            <button className={'btn sm' + (disc.mode === 'amt' ? ' pri' : ' gh')} onClick={() => setDisc(d => ({ ...d, mode: 'amt' }))}>ر.س</button><button className={'btn sm' + (disc.mode === 'pct' ? ' pri' : ' gh')} onClick={() => setDisc(d => ({ ...d, mode: 'pct' }))}>%</button></div></Field>
          <Field label="سبب الخصم" style={{ marginBottom: 0 }}><input className="inp" value={disc.reason} placeholder={manual ? 'إلزامي' : ''} onChange={e => setDisc(d => ({ ...d, reason: e.target.value }))} /></Field>
        </div>}
        {extOpen.code && <div style={{ marginTop: 8 }}><input className="inp" value={code} placeholder="رمز الكوبون" aria-label="رمز الكوبون" onChange={e => setCode(e.target.value)} />
          {code.trim() && <div style={{ fontSize: 12, marginTop: 3, color: priced.codeOk ? 'var(--mint)' : 'var(--rose)', fontWeight: 600 }}>{priced.codeOk ? '✓ الكوبون فعّال' : 'رمز غير صالح أو العرض غير متاح الآن'}</div>}</div>}
        {loyCfg.enabled && extOpen.loy && <div style={{ marginTop: 8 }}>
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
        <div className="grid g2" style={{ gap: 8 }}>
          <button className="btn pri pos-pay" onClick={() => setPay({ parts: [{ m: 'cash', amount: String(T.total) }] })}>نقدي</button>
          <button className="btn pri pos-pay pos-pay-card" onClick={() => setPay({ parts: [{ m: 'card', amount: String(T.total) }] })}>شبكة</button>
        </div>
        <div className="pos-more-pay">
          <button className="btn" onClick={() => setPay({ parts: [{ m: 'cash', amount: '' }, { m: 'card', amount: '' }] })}>تقسيم</button>
          {payMs.slice(0, 3).map(pm => <button key={pm.id} className="btn" onClick={() => setPay({ parts: [{ m: pm.kind || 'card', pm: pm.id, pmName: pm.n, amount: String(T.total) }] })}>{pm.n}</button>)}
          <button className="btn" onClick={() => setPay({ parts: [{ m: 'app', appId: (apps[0] || {}).id, amount: String(T.total) }] })}>تطبيق توصيل</button>
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
          {[['sell', 'البيع', Store], ['orders', 'الفواتير', FileText], ['shift', 'الوردية', Clock]].map(([id, t, Ic]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}><Ic size={15} />{t}{id === 'orders' && todayOrders.length ? <span className="num pos-cnt">{todayOrders.length}</span> : null}</button>)}
          {(() => { const more = [...(isMgr ? [['shifts', 'الورديات والتقارير']] : []), ...(R.admin || R.scope === 'all' ? [['promos', 'العروض']] : []), ...(isMgr ? [['loyalty', 'الولاء']] : []), ...(R.admin || R.scope === 'all' ? [['cfg', 'الإعدادات']] : [])];
            if (!more.length) return null; const curM = more.find(x => x[0] === view);
            return <select className={'sel pos-moresel' + (curM ? ' on' : '')} aria-label="المزيد" value={curM ? view : ''} onChange={e => e.target.value && setView(e.target.value)}><option value="">المزيد…</option>{more.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select>; })()}
        </div>
      </div>

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
            <div className="pos-tiles">{shown.map(p => { const tg = tileTag(p); const inCart = cart.filter(l => l.productId === p.id).reduce((a, l) => a + l.qty, 0); return <button key={p.id} className={'pos-tile' + (inCart ? ' on' : '')} onClick={() => add(p)}>{tg && <i style={{ fontStyle: 'normal', fontSize: 10, background: 'var(--mint)', color: '#fff', borderRadius: 6, padding: '1px 6px', alignSelf: 'center' }}>🏷 {tg}</i>}<b>{p.name}</b><span className="pos-tile-f"><span className="num">{money(p.sellPrice)}</span>{inCart > 0 && <span className="num pos-qty" dir="ltr" style={{ unicodeBidi: 'isolate' }}>×{inCart}</span>}</span></button>; })}</div>
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
        const payAr = (p) => p.pmName ? p.pmName : p.m === 'cash' ? 'نقدي' : p.m === 'card' ? 'شبكة' : p.m === 'transfer' ? 'تحويل' : (p.appName || 'تطبيق');
        const list = allOrders.filter(o => o.branchId === br.id && o.date === ordF.d)
          .filter(o => ordF.pay === 'all' || (ordF.pay === 'void' ? o.status === 'void' : o.status !== 'void' && (o.payments || []).some(p => p.m === ordF.pay)))
          .filter(o => !ordF.q.trim() || String(o.no).includes(ordF.q.trim()) || (o.loyalty && String(o.loyalty.phone || '').includes(normPhone(ordF.q))) || (o.lines || []).some(l => (l.name || '').includes(ordF.q.trim())))
          .sort((a, b) => String(b.at).localeCompare(String(a.at)));
        const st = posOrdersStats(list);
        const xl = () => { try { const head = ['رقم الفاتورة', 'التاريخ', 'الوقت', 'الكاشير', 'الأصناف', 'قبل الخصم', 'الخصم', 'الإجمالي', 'منها ضريبة', 'نقدي', 'شبكة', 'تحويل', 'تطبيق', 'الباقي', 'الحالة'];
          const amt = (o, m) => posR2((o.payments || []).filter(p => p.m === m).reduce((a, p) => a + (Number(p.amount) || 0), 0));
          const body = list.map(o => [o.no, o.date, new Date(o.at).toTimeString().slice(0, 5), o.by || '', (o.lines || []).map(l => l.name + ' ×' + l.qty).join('، '), o.gross || 0, o.disc || 0, o.total, o.vat, amt(o, 'cash'), amt(o, 'card'), amt(o, 'transfer'), amt(o, 'app'), o.change || 0, o.status === 'void' ? 'ملغاة: ' + (o.voidReason || '') : o.pending ? 'لم تُرسل بعد' : 'مدفوعة']);
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
            {st.voidN > 0 && <span className="badge b-rose">ملغاة {st.voidN}</span>}
          </div>
          <div className="tw"><table className="tb"><thead><tr><th>الفاتورة</th><th>الوقت</th><th>الأصناف</th><th style={{ textAlign: 'end' }}>المبلغ</th><th>نوع السداد</th><th></th></tr></thead><tbody>
            {list.map(o => <tr key={o.id} style={o.status === 'void' ? { opacity: .5 } : undefined}>
              <td className="num" style={{ fontSize: 11.5 }}>{o.no}{o.pending && <div><span className="badge b-amber" style={{ fontSize: 9.5 }}>لم تُرسل بعد</span></div>}{o.by && <div style={{ fontSize: 10, color: 'var(--faint)' }}>{o.by}</div>}</td>
              <td className="num" style={{ fontSize: 11.5 }}>{new Date(o.at).toLocaleTimeString('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit' })}</td>
              <td style={{ fontSize: 12 }}>{(o.lines || []).map(l => l.name + (l.qty > 1 ? ' ×' + l.qty : '')).join('، ')}</td>
              <td style={{ textAlign: 'end' }}><b className="num">{money(o.total)}</b>{o.disc ? <div className="num" style={{ fontSize: 10, color: 'var(--mint)' }}>خصم {money(o.disc)}</div> : null}</td>
              <td style={{ fontSize: 11.5 }}>{o.status === 'void' ? <span className="badge b-rose">ملغاة: {o.voidReason}</span> : (o.payments || []).map((p, k) => <div key={k}><span className="badge b-dim">{payAr(p)}</span> <span className="num">{money(p.amount)}</span></div>)}{o.change ? <div className="num" style={{ fontSize: 10, color: 'var(--faint)' }}>الباقي {money(o.change)}</div> : null}</td>
              <td><div className="row" style={{ gap: 4 }}><button className="btn sm gh" title="إعادة طباعة" onClick={() => posPrint(posReceiptHtml(org, o, br))}><Printer size={12} /></button>{isMgr && o.status !== 'void' && <button className="btn sm gh" onClick={() => voidOrder(o)}>إلغاء</button>}</div></td>
            </tr>)}
            {!list.length && <tr><td colSpan={6}><div className="empty">لا فواتير بهذه التصفية.</div></td></tr>}
          </tbody></table></div></div>;
      })()}

      {view === 'shift' && <div className="card">
        {!shift ? <div className="empty">لا وردية مفتوحة على هذا الجهاز — افتحها من «البيع».</div> : (() => { const os = shiftOrders(shift).filter(o => o.status !== 'void'); const exp = posR2(shift.openingCash + os.reduce((a, o) => a + posCashNet(o), 0)); return <>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}><span className="badge b-mint">مفتوحة منذ {String(shift.openedAt).slice(11, 16)} · {shift.openedBy}</span><span className="badge b-dim">افتتاحي {money(shift.openingCash)}</span><span className="badge b-dim">{os.length} فاتورة · {money(os.reduce((a, o) => a + o.total, 0))}</span><span className="badge b-brass">النقد المتوقع في الدرج {money(exp)}</span></div>
          <div className="grid g2" style={{ alignItems: 'end' }}><Num label="النقد المعدود فعلًا" value={(shiftF || {}).counted || ''} onChange={v => setShiftF({ counted: v })} />
            <button className="btn pri" disabled={!shiftF || shiftF.counted === undefined || shiftF.counted === ''} onClick={closeShift}><Lock size={14} />إغلاق الوردية وطباعة التقرير</button></div>
          {shiftF && shiftF.counted !== undefined && shiftF.counted !== '' && <div className="note" style={{ marginTop: 6 }}>الفرق: <b className="num">{money(posR2(posR2(String(shiftF.counted).replace(/[^\d.]/g, '')) - exp))}</b> {posR2(String(shiftF.counted).replace(/[^\d.]/g, '')) - exp < -0.004 ? '(عجز)' : posR2(String(shiftF.counted).replace(/[^\d.]/g, '')) - exp > 0.004 ? '(زيادة)' : '(مطابق)'}</div>}
        </>; })()}
        <div className="note" style={{ marginTop: 8 }}>بعد إغلاق ورديات اليوم: افتح «الإغلاق اليومي» واضغط «تعبئة من نقطة البيع» فتُملأ المبيعات النقدية والشبكة والتطبيقات تلقائيًا.</div>
      </div>}

      {view === 'cfg' && <PosSettings org={org} commitOrg={commitOrg} say={say} dev={dev} />}
      {view === 'promos' && <PosPromos org={org} commitOrg={commitOrg} say={say} />}
      {view === 'loyalty' && <PosLoyalty org={org} commitOrg={commitOrg} say={say} canCfg={!!(R.admin || R.scope === 'all')} me={me} />}
      {view === 'shifts' && <PosShifts org={org} ops={ops} me={me} brs={brs} commit={commit} say={say} />}

      {pay && <Modal title={'الدفع — ' + money(T.total)} icon={Banknote} onClose={() => setPay(null)}
        foot={<><button className="btn pri" style={{ flex: 1, minHeight: 50, fontSize: 16 }} onClick={() => checkout(cfg.autoPrint !== false)}><Check size={16} />{cfg.autoPrint !== false ? 'تأكيد وطباعة' : 'تأكيد'}</button>
          <button className="btn" style={{ minHeight: 50 }} onClick={() => checkout(cfg.autoPrint === false)}>{cfg.autoPrint !== false ? 'بلا طباعة' : 'تأكيد وطباعة'}</button></>}>
        {pay.parts.map((x, i) => <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="الطريقة" style={{ marginBottom: 0 }}><select className="sel" value={x.pm ? 'pm:' + x.pm : x.m} onChange={e => { const v = e.target.value; const pm = v.startsWith('pm:') ? payMs.find(z => 'pm:' + z.id === v) : null; setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? (pm ? { ...y, m: pm.kind || 'card', pm: pm.id, pmName: pm.n } : { ...y, m: v, pm: undefined, pmName: undefined, ...(v === 'app' && !y.appId ? { appId: (apps[0] || {}).id } : {}) }) : y) })); }}>{payMs.map(pm => <option key={pm.id} value={'pm:' + pm.id}>{pm.n}</option>)}<option value="cash">نقدي</option><option value="card">شبكة (مدى/بطاقة)</option><option value="transfer">تحويل بنكي</option><option value="app">تطبيق توصيل</option></select></Field>
          {x.m === 'app' && <Field label="التطبيق" style={{ marginBottom: 0 }}><select className="sel" value={x.appId} onChange={e => setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? { ...y, appId: e.target.value } : y) }))}>{apps.map(a => <option key={a.id} value={a.id}>{a.n}</option>)}</select></Field>}
          <Field label="المبلغ" style={{ marginBottom: 0 }}><input className="inp n" style={{ fontSize: 18, width: 140 }} inputMode="decimal" autoFocus={i === 0} value={x.amount} onChange={e => setPay(pp => ({ ...pp, parts: pp.parts.map((y, k) => k === i ? { ...y, amount: e.target.value.replace(/[^\d.]/g, '') } : y) }))} /></Field>
          {pay.parts.length > 1 && <button className="btn sm gh" title="حذف هذه الدفعة" onClick={() => setPay(pp => ({ ...pp, parts: pp.parts.filter((_, k) => k !== i) }))}><X size={14} /></button>}
        </div>)}
        {/* v34.13: دفعات متعددة بلا حد — المتبقي يُقترح تلقائيًا للدفعة الجديدة */}
        <div className="pos-addpay"><span>إضافة دفعة:</span>{[['cash', 'نقدي'], ['card', 'شبكة'], ['transfer', 'تحويل'], ...payMs.map(pm => ['pm:' + pm.id, pm.n]), ['app', 'تطبيق توصيل']].map(([k, t]) => <button key={k} onClick={() => setPay(pp => { const rem = posR2(T.total - pp.parts.reduce((a, y) => a + (Number(y.amount) || 0), 0)); const pm = k.startsWith('pm:') ? payMs.find(z => 'pm:' + z.id === k) : null;
          return { ...pp, parts: [...pp.parts, { ...(pm ? { m: pm.kind || 'card', pm: pm.id, pmName: pm.n } : { m: k, ...(k === 'app' ? { appId: (apps[0] || {}).id } : {}) }), amount: rem > 0 ? String(rem) : '' }] }; })}>+ {t}</button>)}</div>
        {pay.parts.some(x => x.m === 'cash') && <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{[...new Set([T.total, Math.ceil(T.total / 10) * 10, Math.ceil(T.total / 50) * 50, Math.ceil(T.total / 100) * 100, 500])].filter(v => v >= T.total).slice(0, 5).map(v => <button key={v} className="btn sm" onClick={() => setPay(pp => ({ ...pp, parts: pp.parts.map(y => y.m === 'cash' ? { ...y, amount: String(v) } : y) }))}>{money(v)}</button>)}</div>}
        {(() => { const paid = posR2(pay.parts.reduce((a, x) => a + (Number(x.amount) || 0), 0)); const ch = posR2(paid - T.total); const st = ch < -0.004 ? 'rem' : ch > 0.004 ? 'chg' : 'ok';
          return <div className={'pos-paystat ' + st}><span>{st === 'rem' ? 'المتبقي' : st === 'chg' ? 'الباقي للعميل' : 'مكتمل — لا باقٍ'}</span><span className="num">{money(Math.abs(ch))}</span></div>; })()}
      </Modal>}
    </div>);
}
