/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect, useMemo } from 'react';
import { HardDrive, ClipboardCheck, Truck, Send, ArrowLeftRight, Trash2, Scale, Check, X, ShoppingCart, PackageCheck } from 'lucide-react';
import { cloud, bfKey } from '../../storage';
import { canBrPurchase, ItemPick, signoff, sigFailMsg, BlindCount, COUNT_FREQ, Field, MAIN_WH, Modal, SectionNav, WH_MOVE, WH_ST, WasteFields, WastePending, WhLines, bookHidden, countFocus, countSchedule, isCostCtl, isStocked, itemAvgCosts, nowISO, q3, stockByWh, submitWaste, sum, today, uid, wasteCfg, wasteReasonAr, whForBranch, whName, whOf, whOn } from '../../App.jsx';

export function BranchWarehouse({ org, ops, me, myBranches, commit, say }) {
  const items = (org.items || []).filter(it => it.isActive !== false && isStocked(it));
  const mine = (myBranches || []).map(b => whForBranch(org, b.id)).filter(Boolean);
  const [whId, setWhId] = useState(mine[0]?.id || '');
  const [view, setView] = useState('bal');
  const [reqLines, setReqLines] = useState([{ itemId: '', qtyReq: '' }]);
  const [mvF, setMvF] = useState({ kind: 'out', lines: [{ itemId: '', qty: '' }], note: '' });
  const [recvF, setRecvF] = useState(null);
  const [prF, setPrF] = useState({ lines: [{ itemId: '', qty: '', note: '' }], note: '' });   // v44.3 طلب شراء
  const [poR, setPoR] = useState(null);   // v44.3 استلام أمر شراء موجّه لمستودع الفرع
  const [outF, setOutF] = useState({ kind: 'b2b', toWh: '', lines: [{ itemId: '', qtySent: '' }], note: '' });   // v30.1 صادر
  useEffect(() => { if (!mine.some(w => w.id === whId) && mine[0]) setWhId(mine[0].id); }, [mine.map(w => w.id).join(',')]); // eslint-disable-line
  const wh = mine.find(w => w.id === whId);
  const blind = bookHidden(org, me);   // v38.2 جرد أعمى على مستوى الشاشات
  const ctl = isCostCtl(me);   // v37.8 مراقب التكاليف: الأرصدة + اعتماد الهدر + اعتماد الجرد فقط
  useEffect(() => { if (ctl && !['bal', 'mv', 'count'].includes(view)) setView('bal'); }, [ctl, view]);
  const SB = useMemo(() => stockByWh(org, ops), [org, ops]);
  const AVG = useMemo(() => itemAvgCosts(org, ops), [org, ops]);   // v37.4 قيمة الهدر
  const qOf = (id) => q3(((SB.byWh[whId] || {})[id]) || 0);
  const itemOf = (id) => (org.items || []).find(x => x.id === id) || { name: '—', unit: '' };
  // الوارد: من الرئيسي، أو نسخة «واردة» لتحويل فرع←فرع اعتمده المركز (لا النسخة الصادرة لفرع آخر)
  const myT = (ops.whTransfers || []).filter(t => t.toWh === whId && t.kind !== 'b2b' && t.kind !== 'return').sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const incoming = myT.filter(t => t.status === 'sent');
  const myOut = (ops.whTransfers || []).filter(t => t.fromWh === whId && (t.kind === 'b2b' || t.kind === 'return')).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const otherWhs = whOf(org).filter(w => w.kind === 'branch' && w.id !== whId);
  const myMoves = (ops.whMoves || []).filter(m => m.whId === whId).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

  // v44.3 — أوامر الشراء المعتمدة الموجّهة لمستودعي (نسخة يكتبها المركز) والمتبقي منها بعد استلاماتي غير المرحّلة
  const myRcv = (ops.poReceipts || []).filter(r => r.whId === whId).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const pendQ = (poId, li) => sum(myRcv.filter(r => r.poId === poId && r.status === 'pending').flatMap(r => (r.lines || []).filter(l => l.li === li)), l => Number(l.qty) || 0);
  const poRem = (p, l, li) => q3(Math.max(0, (Number(l.qty) || 0) - (Number(l.received) || 0) - pendQ(p.poId, li)));
  const myPos = (ops.poInbox || []).filter(p => p.whId === whId && (p.lines || []).some((l, i) => poRem(p, l, i) > 0));
  const myReqs = (ops.purchaseReqs || []).filter(r => r.whId === whId).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const allItems = (org.items || []).filter(it => it.isActive !== false);

  if (!whOn(org)) return <div className="card"><div className="empty">لم تُفعَّل المستودعات بعد — يُنشئها المركز من «المخزون والمنتجات ← المستودعات».</div></div>;
  if (!wh) return <div className="card"><div className="empty">لا يوجد مستودع مرتبط بفرعك — اطلب من المركز إنشاءه.</div></div>;

  const request = async () => {
    const lines = reqLines.filter(l => l.itemId && (Number(l.qtyReq) || 0) > 0).map(l => ({ itemId: l.itemId, qtyReq: q3(l.qtyReq), qtySent: 0, qtyRecv: 0 }));
    if (!lines.length) return say('أضف صنفًا وكمية', 'no');
    const rec = { id: uid('wtr'), no: 'REQ-' + today().replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), fromWh: wh.parentId || MAIN_WH, toWh: wh.id, branchId: wh.branchId,
      lines, status: 'requested', requestedBy: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, whTransfers: [rec, ...(d.whTransfers || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: rec.id, branchName: whName(org, wh.id), title: 'طلب تحويل من المستودع الرئيسي', details: lines.map(l => itemOf(l.itemId).name + ' ' + l.qtyReq).join('، ').slice(0, 160) });
    if (ok) { setReqLines([{ itemId: '', qtyReq: '' }]); say('أُرسل الطلب للمستودع الرئيسي ✓'); }
  };
  // v30.1 — صادر: إرجاع للرئيسي (يخرج فورًا ويستلمه المركز) أو تحويل لفرع آخر (بانتظار اعتماد المركز)
  const sendOut = async () => {
    const f = outF;
    const lines = f.lines.filter(l => l.itemId && (Number(l.qtySent) || 0) > 0).map(l => ({ itemId: l.itemId, qtyReq: q3(l.qtySent), qtySent: q3(l.qtySent), qtyRecv: 0 }));
    if (!lines.length) return say('أضف صنفًا وكمية', 'no');
    if (f.kind === 'b2b' && !otherWhs.some(w => w.id === f.toWh)) return say('اختر الفرع المستلم', 'no');
    const over = lines.find(l => l.qtySent > qOf(l.itemId) + 0.0005);
    if (over) return say('الكمية تتجاوز رصيد مستودعك: ' + itemOf(over.itemId).name + (blind ? '' : ' (المتاح ' + qOf(over.itemId) + ')'), 'no');
    const ret = f.kind === 'return';
    const rec = { id: uid('wtr'), kind: f.kind, no: (ret ? 'RET-' : 'B2B-') + today().replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      fromWh: wh.id, toWh: ret ? (wh.parentId || MAIN_WH) : f.toWh, branchId: wh.branchId, lines, note: f.note || '', requestedBy: me.name, at: nowISO(),
      ...(ret ? { status: 'sent', sentDate: today(), sentBy: me.name, sentAt: nowISO() } : { status: 'proposed' }) };
    const ok = await commit(d => ({ ...d, whTransfers: [rec, ...(d.whTransfers || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: rec.id, branchName: whName(org, wh.id),
        title: ret ? 'إرجاع للمستودع الرئيسي' : 'طلب تحويل إلى ' + whName(org, f.toWh) + ' (بانتظار اعتماد المركز)', details: lines.map(l => itemOf(l.itemId).name + ' ' + l.qtySent).join('، ').slice(0, 160) });
    if (ok) { setOutF({ kind: f.kind, toWh: f.toWh, lines: [{ itemId: '', qtySent: '' }], note: '' }); say(ret ? 'أُرسل الإرجاع — يستلمه المستودع الرئيسي ✓' : 'أُرسل للمركز للاعتماد — لا يُخصم من مستودعك قبل الاعتماد ✓'); }
  };
  const cancelOut = async (t) => {
    if (t.status !== 'proposed') return;
    await commit(d => ({ ...d, whTransfers: (d.whTransfers || []).map(x => x.id === t.id && x.status === 'proposed' ? { ...x, status: 'cancelled', cancelledBy: me.name, cancelledAt: nowISO() } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: t.id, branchName: whName(org, wh.id), title: 'إلغاء طلب تحويل صادر', details: t.no || '' });
  };
  const receive = async () => {
    const t = recvF;
    const lines = t.lines.map(l => ({ ...l, qtyRecv: q3(l.qtyRecv) }));
    if (lines.some(l => l.qtyRecv < 0)) return say('كمية غير صحيحة', 'no');
    const ok = await commit(d => ({ ...d, whTransfers: (d.whTransfers || []).map(x => x.id === t.id && x.status === 'sent'
      ? { ...x, lines, status: 'received', receivedDate: today(), receivedBy: me.name, receivedAt: nowISO(), recvNote: t.note || '' } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: t.id, branchName: whName(org, wh.id), title: 'استلام تحويل مخزني', details: (t.no || '') + ' · ' + lines.map(l => itemOf(l.itemId).name + ' ' + l.qtyRecv + (Math.abs(l.qtyRecv - (Number(l.qtySent) || 0)) > 0.0005 ? ' (مصروف ' + l.qtySent + ')' : '')).join('، ').slice(0, 160) });
    if (ok) { setRecvF(null); say('سُجّل الاستلام ✓'); }
  };
  // v44.3 — طلب شراء من الفرع: يراجعه المركز ويحوّله لأمر شراء موجّه لهذا المستودع أو يرفضه بسبب
  const pur = canBrPurchase(me);   // v44.3 (ث34): طلب الشراء والاستلام لمدير الفرع وحده
  const sendPr = async () => {
    if (!pur) return say('طلب الشراء لمدير الفرع فقط', 'no');
    if (prF.lines.some(l => Number(l.qty) > 0 && !l.itemId)) return say('اختر الصنف لكل بند من الأصناف المضافة', 'no');
    const lines = prF.lines.filter(l => l.itemId && (Number(l.qty) || 0) > 0).map(l => ({ itemId: l.itemId, qty: q3(l.qty), ...(String(l.note || '').trim() ? { note: String(l.note).trim() } : {}) }));
    if (!lines.length) return say('أضف صنفًا وكمية', 'no');
    let rec = { id: uid('preq'), no: 'PR-' + today().replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), branchId: wh.branchId, whId: wh.id, lines, note: String(prF.note || '').trim(), status: 'pending', by: me.name, at: nowISO() };
    const sgR = await signoff('preq', 'submit', rec, { branchId: wh.branchId }); if (!sgR.ok) return say(sigFailMsg(sgR, 'طلب الشراء'), 'no'); if (sgR.id) rec = { ...rec, sigSubmit: sgR.id };
    const ok = await commit(d => ({ ...d, purchaseReqs: [rec, ...(d.purchaseReqs || [])] }),
      { actionType: 'create', targetType: 'purchase_order', targetId: rec.id, branchName: whName(org, wh.id), title: 'طلب شراء من الفرع', details: rec.no + ' · ' + lines.map(l => itemOf(l.itemId).name + ' ' + l.qty).join('، ').slice(0, 150) });
    if (ok) { setPrF({ lines: [{ itemId: '', qty: '', note: '' }], note: '' }); say('أُرسل طلب الشراء ' + rec.no + ' للمشتريات المركزية ✓'); }
  };
  // v44.3 — استلام مدير الفرع لأمر شراء موجّه لمستودعه: الأصناف المخزنية تدخل مستودعه فورًا (بسعر الأمر مقابل «بضاعة مستلمة لم تُفوتر»)،
  // والمركز يرحّل الاستلام: فاتورة تلقائية عند المطابقة الكاملة، وإلا يحوّله المحاسب أو مدير النظام. مع الفحص المفعّل: لا مخزون قبل الفحص.
  const inspect = !!(org.purchaseCfg || {}).inspect;
  const openPoR = (p) => setPoR({ p, date: today(), supInvNo: '', supInvAmt: '', taxable: true, img: null, qtys: p.lines.map((l, i) => String(poRem(p, l, i))) });
  const pickImg = (fl) => new Promise((resolve, reject) => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const mx = 1100; const sc = Math.min(1, mx / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.66)); }; img.onerror = reject; img.src = String(rd.result); }; rd.onerror = reject; rd.readAsDataURL(fl); });
  const savePoR = async () => {
    const f = poR, p = f.p;
    if (!pur) return say('استلام أوامر الشراء لمدير الفرع فقط', 'no');
    const lines = p.lines.map((l, i) => { const q = Math.min(Math.max(Number(f.qtys[i]) || 0, 0), poRem(p, l, i)); return q > 0 ? { li: i, itemId: l.itemId, desc: l.desc, ...(l.note ? { note: l.note } : {}), qty: q3(q), factor: l.factor || 1, uomName: l.uomName || '' } : null; }).filter(Boolean);
    if (!lines.length) return say('أدخل كمية مستلمة لبند واحد على الأقل', 'no');
    if (!String(f.supInvNo || '').trim()) return say('أدخل رقم فاتورة المورد كما في ورقته', 'no');
    if (!((Number(f.supInvAmt) || 0) > 0)) return say('أدخل مبلغ فاتورة المورد (شامل الضريبة)', 'no');
    const rDate = (f.date || today()).slice(0, 10);
    let rec = { id: uid('grn'), no: 'GRN-' + rDate.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), poId: p.poId, poNo: p.poNo, whId: wh.id, branchId: wh.branchId, supplierId: p.supplierId, supplierName: p.supplierName,
      date: rDate, lines, supInvNo: String(f.supInvNo).trim(), supInvAmt: Math.round((Number(f.supInvAmt) || 0) * 100) / 100, taxable: f.taxable !== false, status: 'pending', ...(inspect ? { inspect: true } : {}), by: me.name, byEmail: me.email || '', at: nowISO() };
    if (f.img) { const key = bfKey(wh.branchId); const d0 = (await cloud.get(key, { items: [] })) || { items: [] };
      const fr = { id: uid('fl'), title: 'فاتورة مورد ' + rec.supInvNo + ' — ' + p.supplierName, category: 'receipt', branchId: wh.branchId, fileUrl: f.img.url, fileType: 'image', fileName: f.img.name || 'invoice.jpg', fileSizeKb: Math.round(f.img.url.length * 0.75 / 1024), uploadDate: today(), uploadedBy: me.name, amount: rec.supInvAmt, referenceNo: rec.supInvNo, notes: 'فاتورة مورد', source: 'supplier-invoice', uploadedAt: nowISO() };
      if (await cloud.set(key, { ...d0, items: [fr, ...(d0.items || [])] })) rec.docId = fr.id; else say('تعذّر حفظ صورة الفاتورة — يُحفظ الاستلام بدونها', 'no'); }
    const sgP = await signoff('prcv', 'submit', rec, { branchId: wh.branchId }); if (!sgP.ok) return say(sigFailMsg(sgP, 'الاستلام'), 'no'); if (sgP.id) rec = { ...rec, sigSubmit: sgP.id };
    if (inspect) { const sg = await signoff('grn', 'submit', rec, { branchId: wh.branchId }); if (!sg.ok) return say(sigFailMsg(sg, 'الاستلام'), 'no'); if (sg.id) rec = { ...rec, grnSig: sg.id }; }
    const moves = inspect ? [] : lines.map(l => { const it = (org.items || []).find(x => x.id === l.itemId); if (!l.itemId || (it && !isStocked(it))) return null; const fac = Number(l.factor) || 1;
      return { id: uid('wm'), whId: wh.id, branchId: wh.branchId, itemId: l.itemId, kind: 'purchase', qty: q3(l.qty * fac), grnRef: rec.id,   // التكلفة بسعر الأمر يضعها المركز عند الترحيل — الفرع لا يرى الأسعار grn: rec.no, ref: p.poNo,
        note: 'استلام ' + p.poNo + ' — ' + l.desc, date: rDate, by: me.name, at: nowISO() }; }).filter(Boolean);
    const ok = await commit(d => ({ ...d, poReceipts: [rec, ...(d.poReceipts || [])], whMoves: [...moves, ...(d.whMoves || [])] }),
      { actionType: 'create', targetType: 'purchase_order', targetId: rec.id, branchName: whName(org, wh.id), title: 'استلام الفرع لأمر شراء', details: p.poNo + ' · ' + rec.no + ' · فاتورة ' + rec.supInvNo + ' · ' + lines.length + ' بند' });
    if (ok) { setPoR(null); say('سُجّل استلام ' + p.poNo + (inspect ? ' — بانتظار الفحص قبل دخول المستودع' : ' ودخلت الأصناف مستودعك') + ' · يرحّله المركز: فاتورة تلقائية عند المطابقة ✓'); }
  };
  const saveMove = async () => {
    const k = WH_MOVE[mvF.kind];
    const lines = mvF.lines.filter(l => l.itemId && (Number(l.qty) || 0) > 0);
    if (!lines.length) return say('أضف صنفًا وكمية', 'no');
    const over = lines.find(l => k.sign < 0 && q3(l.qty) > qOf(l.itemId) + 0.0005);
    if (over) return say('الكمية تتجاوز رصيد المستودع: ' + itemOf(over.itemId).name + (blind ? '' : ' (المتاح ' + qOf(over.itemId) + ')'), 'no');
    if (mvF.kind === 'waste') {   // v37.4 — سبب منظّم + صورة + اعتماد فوق الحد
      const ok = await submitWaste({ org, me, commit, say, col: 'whMoves', whId: wh.id, branchId: wh.branchId, lines, f: mvF, avg: AVG, title: wh.name });
      if (ok) setMvF({ kind: 'waste', lines: [{ itemId: '', qty: '' }], note: '', reason: '', photo: '' });
      return;
    }
    const recs = lines.map(l => ({ id: uid('wm'), whId: wh.id, branchId: wh.branchId, itemId: l.itemId, kind: mvF.kind, qty: k.sign * q3(l.qty), note: mvF.note || '', date: today(), by: me.name, at: nowISO() }));
    const ok = await commit(d => ({ ...d, whMoves: [...recs, ...(d.whMoves || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: recs[0].id, branchName: whName(org, wh.id), title: k.ar + ' — ' + wh.name, details: lines.map(l => itemOf(l.itemId).name + ' ' + l.qty).join('، ').slice(0, 160) });
    if (ok) { setMvF({ kind: mvF.kind, lines: [{ itemId: '', qty: '' }], note: '' }); say('سُجّلت الحركة ✓'); }
  };

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="card-t" style={{ marginInlineEnd: 'auto' }}><HardDrive size={15} color="var(--brass)" />{wh.name}<span style={{ fontSize: 11, color: 'var(--faint)', marginInlineStart: 6 }}>يتبع {whName(org, wh.parentId || MAIN_WH)}</span></div>
          {mine.length > 1 && <select className="inp sel" style={{ maxWidth: 240 }} value={whId} onChange={e => setWhId(e.target.value)}>{mine.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
        </div>
        <div style={{ marginTop: 10 }}><SectionNav label="أقسام مستودع الفرع" cur={view} onPick={setView} items={([{ id: 'bal', ar: 'الأرصدة', icon: ClipboardCheck }, { id: 'in', ar: 'الوارد', icon: Truck, badge: incoming.length || null }, { id: 'req', ar: 'طلب من الرئيسي', icon: Send }, ...(pur ? [{ id: 'preq', ar: 'طلب شراء', icon: ShoppingCart }, { id: 'po', ar: 'استلام أوامر الشراء', icon: PackageCheck, badge: myPos.length || null }] : []), { id: 'out', ar: 'صادر (فرع / إرجاع)', icon: ArrowLeftRight }, { id: 'mv', ar: 'صرف وهدر', icon: Trash2, badge: (ops.wasteRequests || []).filter(r => r.status === 'pending' && r.whId === wh.id).length || null }, { id: 'count', ar: 'الجرد', icon: Scale }]).filter(x => !ctl || ['bal', 'mv', 'count'].includes(x.id))} /></div>
      </div>

      {view === 'bal' && (
        <div className="card"><div className="tw"><table className="tb">
          <thead><tr><th>الصنف</th><th>الوحدة</th>{!blind && <th style={{ textAlign: 'end' }}>الرصيد</th>}<th>الحالة</th></tr></thead>
          <tbody>{items.map(it => { const b = qOf(it.id), mn = it.minQty || 0; return (
            <tr key={it.id}><td>{it.name}</td><td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{it.unit}</td>
              {!blind && <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: b < 0 ? 'var(--rose)' : undefined }}>{b}</td>}
              <td>{mn > 0 && b <= mn ? <span className="badge b-rose">اطلب الآن</span> : <span className="badge b-mint">جيد</span>}</td></tr>); })}
            {!items.length && <tr><td colSpan={4}><div className="empty">لا أصناف معرّفة — يضيفها المركز</div></td></tr>}
          </tbody></table></div>
          {blind && <div className="note" style={{ marginTop: 8 }}>الكميات الدفترية لا تظهر لموظفي الفرع (جرد أعمى) — «اطلب الآن» يعني أن الصنف عند حد الطلب أو دونه.</div>}
          <div className="card-t" style={{ margin: '14px 0 8px', fontSize: 13 }}>آخر الحركات</div>
          <div className="tw"><table className="tb"><tbody>
            {myMoves.slice(0, 30).map(m => (<tr key={m.id}><td className="num" style={{ fontSize: 11 }}>{m.date}</td><td>{itemOf(m.itemId).name}</td>
              <td><span className={'badge ' + ((WH_MOVE[m.kind] || {}).c || 'b-dim')}>{(WH_MOVE[m.kind] || {}).ar || m.kind}</span>{m.kind === 'waste' && m.reason ? <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{wasteReasonAr(m.reason)}{m.approvedBy ? ' · اعتمده ' + m.approvedBy : ''}</div> : null}</td>
              <td className="num" style={{ fontWeight: 700, color: m.qty < 0 ? 'var(--rose)' : 'var(--mint)' }}>{m.qty > 0 ? '+' + m.qty : m.qty}</td>
              <td style={{ fontSize: 11, color: 'var(--faint)' }}>{m.by}</td></tr>))}
            {!myMoves.length && <tr><td><div className="empty">لا حركات بعد</div></td></tr>}
          </tbody></table></div>
        </div>
      )}

      {view === 'in' && (
        <div className="card"><div className="tw"><table className="tb">
          <thead><tr><th>الرقم</th><th>الأصناف</th><th>الحالة</th><th>التواريخ</th><th></th></tr></thead>
          <tbody>{myT.slice(0, 80).map(t => { const [c, tx] = WH_ST[t.status] || ['b-dim', t.status]; return (
            <tr key={t.id}><td className="num" style={{ fontSize: 11 }}>{t.no}</td>
              <td style={{ fontSize: 11.5 }}>{(t.lines || []).map(l => itemOf(l.itemId).name + ' ' + (t.status === 'requested' ? l.qtyReq : t.status === 'received' ? l.qtyRecv : l.qtySent)).join('، ')}</td>
              <td><span className={'badge ' + c}>{tx}</span></td>
              <td style={{ fontSize: 10.5, color: 'var(--dim)' }}>{(t.at || '').slice(0, 10)}{t.sentDate ? ' · صُرف ' + t.sentDate : ''}{t.receivedDate ? ' · استُلم ' + t.receivedDate : ''}</td>
              <td>{t.status === 'sent' && <button className="btn sm pri" onClick={() => setRecvF({ id: t.id, no: t.no, note: '', lines: (t.lines || []).map(l => ({ ...l, qtyRecv: l.qtySent })) })}><Check size={12} />استلام</button>}</td></tr>); })}
            {!myT.length && <tr><td colSpan={5}><div className="empty">لا تحويلات بعد</div></td></tr>}
          </tbody></table></div></div>
      )}

      {view === 'req' && (
        <div className="card">
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 10 }}>يُرسل الطلب إلى {whName(org, wh.parentId || MAIN_WH)}، ويظهر لديك في «الوارد» بعد صرفه.</div>
          <WhLines items={items} lines={reqLines} setLines={setReqLines} field="qtyReq" />
          <button className="btn pri" style={{ marginTop: 10 }} onClick={request}><Send size={14} />إرسال الطلب</button>
        </div>
      )}

      {view === 'preq' && pur && (
        <div className="card" data-preqform>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.8 }}>طلب شراء من المورد لمستودعك — تراجعه المشتريات المركزية وتختار المورد والسعر وتحوّله لأمر شراء يُسلَّم لمستودعك مباشرة، أو ترفضه بسبب.</div>
          {prF.lines.map((l, i) => (
            <div key={i} className="row" style={{ gap: 6, alignItems: 'flex-end', marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 220px' }}><ItemPick items={allItems} value={l.itemId} label={'صنف الطلب ' + (i + 1)} onChange={(id) => setPrF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, itemId: id } : x) }))} /></div>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder={'الكمية' + (itemOf(l.itemId).unit ? ' (' + itemOf(l.itemId).unit + ')' : '')} aria-label={'كمية الطلب ' + (i + 1)} value={l.qty} onChange={e => setPrF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, qty: e.target.value.replace(/[^\d.]/g, '') } : x) }))} />
              <input className="inp" style={{ flex: '1 1 160px' }} placeholder="ملاحظة (اختياري)" value={l.note} onChange={e => setPrF(f => ({ ...f, lines: f.lines.map((x, k) => k === i ? { ...x, note: e.target.value } : x) }))} />
              {prF.lines.length > 1 && <button className="btn sm gh" onClick={() => setPrF(f => ({ ...f, lines: f.lines.filter((_, k) => k !== i) }))}><X size={13} /></button>}
            </div>))}
          <button className="btn sm" onClick={() => setPrF(f => ({ ...f, lines: [...f.lines, { itemId: '', qty: '', note: '' }] }))}>+ بند</button>
          <Field label="البيان"><input className="inp" value={prF.note} onChange={e => setPrF(f => ({ ...f, note: e.target.value }))} placeholder="سبب الطلب أو موعد الحاجة" /></Field>
          <button className="btn pri" onClick={sendPr}><Send size={14} />إرسال طلب الشراء</button>
          <div className="card-t" style={{ margin: '16px 0 8px', fontSize: 13 }}>طلباتي</div>
          <div className="tw"><table className="tb"><thead><tr><th>الطلب</th><th>الأصناف</th><th>الحالة</th></tr></thead><tbody>
            {myReqs.slice(0, 60).map(r => (<tr key={r.id}><td className="num" style={{ fontSize: 11 }}>{r.no}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{String(r.at || '').slice(0, 10)}</div></td>
              <td style={{ fontSize: 11.5 }}>{(r.lines || []).map(l => itemOf(l.itemId).name + ' ' + l.qty).join('، ')}</td>
              <td>{r.status === 'pending' ? <span className="badge b-amber">بانتظار المراجعة</span> : r.status === 'converted' ? <span className="badge b-mint">أمر شراء {r.poNo}{r.supplierName ? ' · ' + r.supplierName : ''}</span> : <span className="badge b-rose">مرفوض{r.rejectNote ? ' — ' + r.rejectNote : ''}</span>}</td></tr>))}
            {!myReqs.length && <tr><td colSpan={3}><div className="empty">لا طلبات شراء بعد</div></td></tr>}
          </tbody></table></div>
        </div>
      )}

      {view === 'po' && pur && (
        <div className="card" data-brpo>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.8 }}>أوامر الشراء المعتمدة الموجّهة لمستودعك — بضاعة تدخل الفرع مباشرة دون المرور بالمستودع الرئيسي. سجّل الكميات الفعلية ورقم فاتورة المورد ومبلغها.</div>
          <div className="tw"><table className="tb"><thead><tr><th>الأمر</th><th>المورد</th><th>المتبقي</th><th /></tr></thead><tbody>
            {myPos.map(p => (<tr key={p.id} data-brpo-row={p.poNo}><td className="num" style={{ fontSize: 11.5 }}>{p.poNo}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{p.date}</div></td><td style={{ fontSize: 12 }}>{p.supplierName}</td>
              <td style={{ fontSize: 11.5 }}>{p.lines.map((l, i) => poRem(p, l, i) > 0 ? l.desc + ' ' + poRem(p, l, i) + ' ' + (l.uomName || itemOf(l.itemId).unit || '') : null).filter(Boolean).join('، ')}</td>
              <td><button className="btn sm pri" data-brrecv onClick={() => openPoR(p)}><Check size={12} />تسجيل استلام</button></td></tr>))}
            {!myPos.length && <tr><td colSpan={4}><div className="empty">لا أوامر شراء قيد التوريد لمستودعك</div></td></tr>}
          </tbody></table></div>
          <div className="card-t" style={{ margin: '16px 0 8px', fontSize: 13 }}>استلاماتي</div>
          <div className="tw"><table className="tb"><tbody>
            {myRcv.slice(0, 40).map(r => (<tr key={r.id}><td className="num" style={{ fontSize: 11 }}>{r.no}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{r.date}</div></td><td style={{ fontSize: 12 }}>{r.poNo} · {r.supplierName}</td>
              <td className="num" style={{ fontSize: 11.5 }}>{r.supInvNo}</td>
              <td>{r.status === 'pending' ? <span className="badge b-amber">بانتظار ترحيل المركز</span> : r.result === 'matched' ? <span className="badge b-mint">مطابق — فاتورة {r.invoiceNo}</span> : r.result === 'qc' ? <span className="badge b-sky">بانتظار الفحص</span> : <span className="badge b-dim" title={r.whyNot || ''}>غير مطابق — لدى المحاسب{r.whyNot ? ' (' + r.whyNot + ')' : ''}</span>}</td></tr>))}
            {!myRcv.length && <tr><td><div className="empty">لا استلامات بعد</div></td></tr>}
          </tbody></table></div>
        </div>
      )}

      {view === 'out' && (
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (outF.kind === 'b2b' ? ' pri' : ' gh')} onClick={() => setOutF(f => ({ ...f, kind: 'b2b' }))}>تحويل إلى فرع آخر</button>
            <button className={'btn sm' + (outF.kind === 'return' ? ' pri' : ' gh')} onClick={() => setOutF(f => ({ ...f, kind: 'return' }))}>إرجاع للمستودع الرئيسي</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.8 }}>
            {outF.kind === 'b2b'
              ? 'يُرسل الطلب للمركز للاعتماد. عند الاعتماد يُخصم من مستودعك وتصبح البضاعة في الطريق حتى يؤكد الفرع المستلم الكميات الفعلية.'
              : 'تخرج الكميات من مستودعك فور الإرسال (في الطريق) حتى يستلمها المستودع الرئيسي بالكميات الفعلية.'}
          </div>
          {outF.kind === 'b2b' && (
            <Field label="الفرع المستلم">
              <select className="inp sel" value={outF.toWh} onChange={e => setOutF(f => ({ ...f, toWh: e.target.value }))}>
                <option value="">— اختر —</option>
                {otherWhs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
          )}
          <WhLines items={items} lines={outF.lines} setLines={(fn) => setOutF(f => ({ ...f, lines: typeof fn === 'function' ? fn(f.lines) : fn }))} field="qtySent" max={blind ? null : qOf} />
          <Field label="البيان"><input className="inp" value={outF.note} onChange={e => setOutF(f => ({ ...f, note: e.target.value }))} placeholder={outF.kind === 'return' ? 'سبب الإرجاع (فائض، قرب انتهاء…)' : 'سبب التحويل'} /></Field>
          <button className="btn pri" onClick={sendOut}><Send size={14} />{outF.kind === 'b2b' ? 'إرسال للاعتماد' : 'إرسال الإرجاع'}</button>

          <div className="card-t" style={{ margin: '16px 0 8px', fontSize: 13 }}>الصادر من مستودعك</div>
          <div className="tw"><table className="tb">
            <thead><tr><th>الرقم</th><th>إلى</th><th>الأصناف</th><th>الحالة</th><th></th></tr></thead>
            <tbody>{myOut.slice(0, 60).map(t => { const [c, tx] = WH_ST[t.status] || ['b-dim', t.status]; return (
              <tr key={t.id}><td className="num" style={{ fontSize: 11 }}>{t.no}</td>
                <td style={{ fontSize: 12 }}>{whName(org, t.toWh)}</td>
                <td style={{ fontSize: 11.5 }}>{(t.lines || []).map(l => itemOf(l.itemId).name + ' ' + l.qtySent).join('، ')}</td>
                <td><span className={'badge ' + c}>{t.kind === 'b2b' && t.status === 'sent' ? 'معتمد — في الطريق' : tx}</span>{t.rejectNote ? <div style={{ fontSize: 10.5, color: 'var(--rose)' }}>{t.rejectNote}</div> : null}</td>
                <td>{t.status === 'proposed' && <button className="btn sm gh" onClick={() => cancelOut(t)}><X size={12} />إلغاء</button>}</td></tr>); })}
              {!myOut.length && <tr><td colSpan={5}><div className="empty">لا صادر بعد</div></td></tr>}
            </tbody></table></div>
        </div>
      )}

      {view === 'mv' && <WastePending org={org} ops={ops} me={me} commit={commit} say={say} whIds={[wh.id]} />}
      {view === 'mv' && ctl && !(ops.wasteRequests || []).some(r => r.status === 'pending' && r.whId === wh.id) && <div className="card"><div className="empty">لا هدر بانتظار الاعتماد في هذا المستودع.</div></div>}
      {view === 'mv' && !ctl && (
        <div className="card">
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            {['out', 'waste'].map(k => <button key={k} className={'btn sm' + (mvF.kind === k ? ' pri' : ' gh')} onClick={() => setMvF(f => ({ ...f, kind: k }))}>{WH_MOVE[k].ar}</button>)}
          </div>
          <WhLines items={items} lines={mvF.lines} setLines={(fn) => setMvF(f => ({ ...f, lines: typeof fn === 'function' ? fn(f.lines) : fn }))} field="qty" max={blind ? null : qOf} />
          {mvF.kind === 'waste'
            ? <WasteFields f={mvF} setF={setMvF} cfg={wasteCfg(org)} me={me} say={say} value={Math.round(sum(mvF.lines.filter(l => l.itemId), l => (Number(l.qty) || 0) * (AVG[l.itemId] || 0)) * 100) / 100} />
            : <Field label="البيان"><input className="inp" value={mvF.note} onChange={e => setMvF(f => ({ ...f, note: e.target.value }))} placeholder="مثال: تشغيل الوردية" /></Field>}
          <button className="btn pri" style={{ marginTop: 10 }} onClick={saveMove}><Check size={14} />تسجيل {WH_MOVE[mvF.kind].ar}</button>
        </div>
      )}

      {view === 'count' && (
        <div>
          {(() => { const sc = (countSchedule(org, ops) || []).find(x => x.w.id === wh.id); const fc = countFocus(org, ops, wh.id); return sc ? (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className={'badge ' + (sc.st === 'over' ? 'b-rose' : sc.st === 'due' ? 'b-amber' : 'b-dim')}>الجرد الدوري ({COUNT_FREQ[(org.countCfg || {}).freq].ar}): {sc.st === 'over' ? 'متأخر منذ ' + sc.due : sc.st === 'due' ? 'مستحق اليوم' : 'القادم ' + sc.due}</span>
              <span className="badge b-dim">آخر جرد: {sc.last || '—'}</span>
              {fc && <span className="badge b-brass">المطلوب: الأصناف المميّزة بـ ★ (الأعلى قيمة)</span>}
            </div>) : null; })()}
          <BlindCount org={org} ops={ops} me={me} commit={commit} say={say} whId={wh.id} branchId={wh.branchId} col="whMoves" items={items} title={wh.name} canCount={!ctl} />
        </div>
      )}

      {poR && (
        <Modal title={'استلام أمر الشراء ' + poR.p.poNo} icon={PackageCheck} onClose={() => setPoR(null)}
          foot={<><button className="btn pri" onClick={savePoR}><Check size={14} />تأكيد الاستلام</button><button className="btn gh" onClick={() => setPoR(null)}>إلغاء</button></>}>
          <div className="note" style={{ marginBottom: 8 }}>المورد: <b>{poR.p.supplierName}</b> · يُستلم في <b>{wh.name}</b> فقط (مستودع الأمر).</div>
          <div className="grid g2">
            <Field label="تاريخ الاستلام"><input type="date" className="inp" value={poR.date} onChange={e => setPoR(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label="رقم فاتورة المورد"><input className="inp" aria-label="رقم فاتورة المورد" value={poR.supInvNo} onChange={e => setPoR(f => ({ ...f, supInvNo: e.target.value }))} /></Field>
            <Field label="مبلغ فاتورة المورد (شامل الضريبة)"><input className="inp n" inputMode="decimal" aria-label="مبلغ فاتورة المورد" value={poR.supInvAmt} onChange={e => setPoR(f => ({ ...f, supInvAmt: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={poR.taxable !== false} onChange={e => setPoR(f => ({ ...f, taxable: e.target.checked }))} />الفاتورة خاضعة لضريبة القيمة المضافة</label>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center', margin: '6px 0' }} data-imgfield>
            <label className="btn sm gh" style={{ cursor: 'pointer' }}>📎 صورة فاتورة المورد (اختياري)<input type="file" accept="image/*" style={{ display: 'none' }} aria-label="صورة فاتورة المورد"
              onChange={async e => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (!fl) return; if (!fl.type.startsWith('image/')) return say('صورة فقط', 'no'); try { const url = await pickImg(fl); setPoR(f => ({ ...f, img: { url, name: fl.name } })); } catch { say('تعذّرت معالجة الصورة', 'no'); } }} /></label>
            {poR.img && <><img src={poR.img.url} alt="" style={{ height: 40, borderRadius: 6, border: '1px solid var(--line)' }} /><button className="btn sm gh" onClick={() => setPoR(f => ({ ...f, img: null }))} title="إزالة الصورة"><X size={12} /></button></>}
          </div>
          {poR.p.lines.map((l, i) => poRem(poR.p, l, i) > 0 && (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12.5 }}>{l.desc} <span style={{ color: 'var(--faint)', fontSize: 11 }}>(المتبقي {poRem(poR.p, l, i)} {l.uomName || itemOf(l.itemId).unit})</span>{l.note ? <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{l.note}</div> : null}</span>
              <input className="inp n" style={{ width: 120 }} inputMode="decimal" aria-label={'الكمية المستلمة ' + (i + 1)} value={poR.qtys[i]} onChange={e => setPoR(f => ({ ...f, qtys: f.qtys.map((q, k) => k === i ? e.target.value.replace(/[^\d.]/g, '') : q) }))} />
            </div>))}
          <div className="hint">المطابقة الكاملة (كل الكميات + مبلغ الفاتورة = قيمة الأمر وضريبته) ⇒ فاتورة المورد تُنشأ تلقائيًا؛ وإلا يحوّلها المحاسب أو مدير النظام.</div>
        </Modal>
      )}

      {recvF && (
        <Modal title={'استلام التحويل ' + (recvF.no || '')} icon={Truck} onClose={() => setRecvF(null)}
          foot={<><button className="btn pri" onClick={receive}><Check size={14} />تأكيد الاستلام</button><button className="btn gh" onClick={() => setRecvF(null)}>إلغاء</button></>}>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>أدخل الكمية المستلمة فعليًا لكل صنف — أي فرق عن المصروف يُوثَّق «فرق استلام».</div>
          {recvF.lines.map((l, i) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12.5 }}>{itemOf(l.itemId).name} <span style={{ color: 'var(--faint)', fontSize: 11 }}>(مصروف {l.qtySent} {itemOf(l.itemId).unit})</span></span>
              <input className="inp n" style={{ width: 120 }} inputMode="decimal" value={l.qtyRecv} onChange={e => setRecvF(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, qtyRecv: e.target.value } : x) }))} />
            </div>))}
          <Field label="ملاحظة"><input className="inp" value={recvF.note} onChange={e => setRecvF(f => ({ ...f, note: e.target.value }))} /></Field>
        </Modal>
      )}
    </>
  );
}
