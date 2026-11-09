/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { HardDrive, Plus, ClipboardCheck, Truck, Landmark, Send, PenLine, X, Check } from 'lucide-react';
import { CountScheduleCard, Field, Kpi, MAIN_WH, Modal, WH_KIND, WH_ST, WhLines, expiryLots, isCostCtl, isStocked, isoD, itemAvgCosts, money, nextWhAcc, nowISO, q3, rolePost, stockByWh, today, uid, whForBranch, whName, whOf, whOn } from '../../App.jsx';

export function WarehousesPanel({ org, ops, me, commit, commitOrg, say }) {
  const items = (org.items || []).filter(isStocked);
  const whs = whOf(org);
  const branches = (org.branches || []).filter(b => b.isActive !== false);
  const canW = rolePost(me?.role) && !isCostCtl(me);
  const SB = useMemo(() => stockByWh(org, ops), [org, ops]);
  const AVG = useMemo(() => itemAvgCosts(org, ops), [org, ops]);
  const LOTS = useMemo(() => expiryLots(org, ops).sort((a, b) => String(a.expiry).localeCompare(String(b.expiry))), [org, ops]);
  const [sel, setSel] = useState(MAIN_WH);
  const [sendF, setSendF] = useState(null);     // صرف تحويل (طلب قائم أو جديد)
  const [ren, setRen] = useState(null);
  const costOf = (id) => AVG[id] || 0;
  const itemOf = (id) => items.find(x => x.id === id) || { name: '—', unit: '' };
  const qOf = (wh, id) => q3(((SB.byWh[wh] || {})[id]) || 0);
  const valOf = (wh) => Math.round(Object.entries(SB.byWh[wh] || {}).reduce((s, [id, q]) => s + Math.max(0, q) * costOf(id), 0) * 100) / 100;
  const transfers = (ops.whTransfers || []).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const missing = branches.filter(b => !whForBranch(org, b.id));

  const setup = async () => {
    if (!canW) return say('لا تملك صلاحية الإعداد', 'no');
    await commitOrg(d => {
      const list = [...(d.warehouses || [])];
      if (!list.some(w => w.id === MAIN_WH)) list.push({ id: MAIN_WH, name: 'المستودع الرئيسي', kind: 'main', branchId: '', parentId: '', accCode: nextWhAcc(list), active: true, at: nowISO() });
      (d.branches || []).filter(b => b.isActive !== false).forEach(b => {
        if (list.some(w => w.kind === 'branch' && w.branchId === b.id)) return;
        list.push({ id: 'wh-' + b.id, name: 'مستودع ' + (b.name || 'فرع'), kind: 'branch', branchId: b.id, parentId: MAIN_WH, accCode: nextWhAcc(list), active: true, at: nowISO() });
      });
      return { ...d, warehouses: list };
    }, { actionType: 'create', targetType: 'inventory', targetId: 'warehouses', need: 'post', title: 'إنشاء المستودعات وربطها بالفروع', details: 'رئيسي + ' + (missing.length || branches.length) + ' مستودع فرع' });
    say('أُنشئت المستودعات ورُبطت بالفروع ✓ — لكل مستودع حساب مخزون في الدليل');
  };
  const rename = async () => {
    const nm = String(ren.name || '').trim(); if (!nm) return say('أدخل الاسم', 'no');
    await commitOrg(d => ({ ...d, warehouses: (d.warehouses || []).map(w => w.id === ren.id ? { ...w, name: nm } : w) }),
      { actionType: 'update', targetType: 'inventory', targetId: ren.id, need: 'post', title: 'تعديل اسم مستودع', details: nm });
    setRen(null); say('حُفظ ✓');
  };

  // صرف من الرئيسي: لطلب قائم أو تحويل جديد بمبادرة المركز
  const openSend = (t) => setSendF(t
    ? { id: t.id, toWh: t.toWh, lines: (t.lines || []).map(l => ({ itemId: l.itemId, qtyReq: l.qtyReq, qtySent: String(Math.max(0, Math.min(Number(l.qtyReq) || 0, qOf(MAIN_WH, l.itemId)))) })), note: '' }
    : { id: '', toWh: (whs.find(w => w.kind === 'branch') || {}).id || '', lines: [{ itemId: '', qtySent: '' }], note: '' });
  const send = async () => {
    const f = sendF; const to = whs.find(w => w.id === f.toWh);
    if (!to) return say('اختر المستودع المستلم', 'no');
    const lines = f.lines.filter(l => l.itemId && (Number(l.qtySent) || 0) > 0).map(l => ({ itemId: l.itemId, qtyReq: l.qtyReq != null ? Number(l.qtyReq) || 0 : Number(l.qtySent) || 0, qtySent: q3(l.qtySent) }));
    if (!lines.length) return say('أدخل كميات الصرف', 'no');
    const short = lines.find(l => l.qtySent > qOf(MAIN_WH, l.itemId) + 0.0005);
    if (short) return say('الكمية تتجاوز رصيد المستودع الرئيسي: ' + itemOf(short.itemId).name + ' (المتاح ' + qOf(MAIN_WH, short.itemId) + ')', 'no');
    const stamp = { status: 'sent', sentDate: today(), sentBy: me.name, sentAt: nowISO(), sendNote: f.note || '' };
    const ok = await commit(d => {
      const list = d.whTransfers || [];
      if (f.id) return { ...d, whTransfers: list.map(t => t.id === f.id && t.status === 'requested' ? { ...t, lines, ...stamp } : t) };
      const rec = { id: uid('wtr'), no: 'TRF-' + today().replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), fromWh: MAIN_WH, toWh: to.id, branchId: to.branchId,
        lines, requestedBy: me.name, at: nowISO(), ...stamp };
      return { ...d, whTransfers: [rec, ...list] };
    }, { actionType: 'create', targetType: 'stock_move', targetId: f.id || 'new-transfer', title: 'صرف تحويل مخزني إلى ' + to.name, details: lines.map(l => itemOf(l.itemId).name + ' ' + l.qtySent).join('، ').slice(0, 160) });
    if (ok) { setSendF(null); say('صُرف التحويل — البضاعة «في الطريق» حتى يستلمها الفرع ✓'); }
  };
  // v30.1 — اعتماد تحويل فرع ← فرع: تُخصم الكمية من المرسِل وتُنشأ نسخة «واردة» في مستند المستلم (في الطريق)
  const inCopyOf = (t) => (ops.whTransfers || []).find(x => x.kind === 'b2b-in' && x.linkId === t.id);
  const approveB2B = async (t) => {
    const short = (t.lines || []).find(l => (Number(l.qtySent) || 0) > qOf(t.fromWh, l.itemId) + 0.0005);
    if (short) return say('رصيد ' + whName(org, t.fromWh) + ' لا يكفي: ' + itemOf(short.itemId).name + ' (المتاح ' + qOf(t.fromWh, short.itemId) + ')', 'no');
    const to = whs.find(w => w.id === t.toWh); if (!to) return say('المستودع المستلم غير موجود', 'no');
    const stamp = { status: 'sent', sentDate: today(), approvedBy: me.name, approvedAt: nowISO() };
    const ok = await commit(d => {
      let list = (d.whTransfers || []).map(x => x.id === t.id && x.status === 'proposed' ? { ...x, ...stamp } : x);
      if (!list.some(x => x.kind === 'b2b-in' && x.linkId === t.id)) {
        list = [{ id: t.id + '-in', kind: 'b2b-in', linkId: t.id, no: t.no, fromWh: t.fromWh, toWh: t.toWh, branchId: to.branchId, lines: (t.lines || []).map(l => ({ itemId: l.itemId, qtySent: l.qtySent, qtyRecv: 0 })),
          requestedBy: t.requestedBy, at: t.at, note: t.note || '', ...stamp }, ...list];
      }
      return { ...d, whTransfers: list };
    }, { actionType: 'update', targetType: 'stock_move', targetId: t.id, title: 'اعتماد تحويل ' + whName(org, t.fromWh) + ' ← ' + whName(org, t.toWh), details: (t.no || '') + ' · ' + (t.lines || []).map(l => itemOf(l.itemId).name + ' ' + l.qtySent).join('، ').slice(0, 150) });
    if (ok) say('اعتُمد التحويل — خُصم من ' + whName(org, t.fromWh) + ' وهو في الطريق حتى يستلمه ' + whName(org, t.toWh) + ' ✓');
  };
  const rejectT = async (t) => {
    const why = window.prompt('سبب رفض التحويل ' + (t.no || '') + ':'); if (why === null) return;
    await commit(d => ({ ...d, whTransfers: (d.whTransfers || []).map(x => x.id === t.id && x.status === 'proposed' ? { ...x, status: 'rejected', rejectedBy: me.name, rejectedAt: nowISO(), rejectNote: why } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: t.id, title: 'رفض تحويل مخزني', details: (t.no || '') + ' · ' + why });
  };
  // إرجاع من فرع: يستلمه المستودع الرئيسي بالكميات الفعلية
  const [retF, setRetF] = useState(null);
  const receiveReturn = async () => {
    const t = retF; const lines = t.lines.map(l => ({ ...l, qtyRecv: q3(l.qtyRecv) }));
    const ok = await commit(d => ({ ...d, whTransfers: (d.whTransfers || []).map(x => x.id === t.id && x.status === 'sent' ? { ...x, lines, status: 'received', receivedDate: today(), receivedBy: me.name, receivedAt: nowISO() } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: t.id, title: 'استلام إرجاع في المستودع الرئيسي', details: (t.no || '') + ' · ' + lines.map(l => itemOf(l.itemId).name + ' ' + l.qtyRecv).join('، ').slice(0, 150) });
    if (ok) { setRetF(null); say('استُلم الإرجاع في المستودع الرئيسي ✓'); }
  };
  const cancelT = async (t) => {
    if (t.status !== 'requested') return;
    await commit(d => ({ ...d, whTransfers: (d.whTransfers || []).map(x => x.id === t.id && x.status === 'requested' ? { ...x, status: 'cancelled', cancelledBy: me.name, cancelledAt: nowISO() } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: t.id, title: 'إلغاء طلب تحويل', details: t.no || '' });
  };

  if (!whOn(org)) return (
    <div className="card">
      <div className="card-t" style={{ marginBottom: 8 }}><HardDrive size={15} color="var(--brass)" />المستودعات — رئيسي + مستودع لكل فرع</div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 10 }}>
        يُنشأ <b>مستودع رئيسي</b> (يستلم من الموردين ويصرف للفروع) و<b>مستودع لكل فرع</b> ({branches.length} فرع) مربوط بالرئيسي.
        لكل مستودع حساب مخزون مستقل في دليل الحسابات. الأرصدة الحالية تُنسب للمستودع الرئيسي.
        بعد الإنشاء: الفرع يطلب ← الرئيسي يصرف ← الفرع يستلم بالكميات الفعلية، ويسجّل موظفو الفرع الصرف للمطبخ والهدر والجرد لمستودعهم.
      </div>
      {canW ? <button className="btn pri" onClick={setup}><Plus size={14} />إنشاء المستودعات وربطها بالفروع</button> : <div className="empty">الإعداد لمن يملك صلاحية الإدخال في المركز</div>}
    </div>
  );

  const pendingReq = transfers.filter(t => t.status === 'requested' || (t.kind === 'b2b' && t.status === 'proposed') || (t.kind === 'return' && t.status === 'sent'));
  const inTransit = transfers.filter(t => t.status === 'sent');
  return (
    <>
      <div className="grid g4">
        <Kpi label="المستودعات" value={String(whs.length)} sub={'رئيسي + ' + whs.filter(w => w.kind === 'branch').length + ' فرعي'} icon={HardDrive} color="#C8A24A" />
        <Kpi label="بانتظار إجراء المركز" value={String(pendingReq.length)} sub="صرف · اعتماد فرع←فرع · استلام إرجاع" icon={ClipboardCheck} color="#E0A458" />
        <Kpi label="تحويلات في الطريق" value={String(inTransit.filter(t => t.kind !== 'b2b').length)} sub={money(Math.round(Object.entries(SB.transit).reduce((s, [id, q]) => s + q * costOf(id), 0) * 100) / 100) + ' ر.س'} icon={Truck} color="#5B93C4" />
        <Kpi label="قيمة المخزون — كل المستودعات" value={money(whs.reduce((s, w) => s + valOf(w.id), 0))} sub="بالتكلفة" icon={Landmark} color="#4FB286" />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div className="card-t"><HardDrive size={15} color="var(--brass)" />المستودعات وربطها</div>
          <div className="row" style={{ gap: 6 }}>
            {canW && missing.length > 0 && <button className="btn sm" onClick={setup}><Plus size={13} />مستودع لـ {missing.length} فرع جديد</button>}
            {canW && <button className="btn sm pri" onClick={() => openSend(null)}><Send size={13} />تحويل جديد من الرئيسي</button>}
          </div>
        </div>
        <div className="tw"><table className="tb">
          <thead><tr><th>المستودع</th><th>النوع</th><th>الفرع المرتبط</th><th>يتبع</th><th>حساب المخزون</th><th style={{ textAlign: 'end' }}>القيمة</th><th></th></tr></thead>
          <tbody>{whs.map(w => (
            <tr key={w.id} style={{ cursor: 'pointer', background: sel === w.id ? 'var(--soft, rgba(200,162,74,.08))' : undefined }} onClick={() => setSel(w.id)}>
              <td style={{ fontWeight: 600 }}>{w.name}</td>
              <td><span className={'badge ' + (w.kind === 'main' ? 'b-brass' : 'b-sky')}>{w.kind === 'main' ? 'رئيسي' : 'فرعي'}</span></td>
              <td style={{ fontSize: 12 }}>{w.branchId ? ((org.branches || []).find(b => b.id === w.branchId) || {}).name || '—' : '—'}</td>
              <td style={{ fontSize: 12 }}>{w.parentId ? whName(org, w.parentId) : '—'}</td>
              <td className="num" style={{ fontSize: 11.5 }}>{w.accCode}</td>
              <td className="num" style={{ textAlign: 'end' }}>{money(valOf(w.id))}</td>
              <td>{canW && <button className="btn sm gh" onClick={e => { e.stopPropagation(); setRen({ id: w.id, name: w.name }); }}><PenLine size={12} /></button>}</td>
            </tr>))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />أرصدة {whName(org, sel)}</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الصنف</th><th>الوحدة</th><th style={{ textAlign: 'end' }}>الرصيد</th><th style={{ textAlign: 'end' }}>القيمة</th></tr></thead>
          <tbody>
            {items.filter(it => qOf(sel, it.id) !== 0).map(it => (
              <tr key={it.id}><td>{it.name}</td><td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{it.unit}</td>
                <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: qOf(sel, it.id) < 0 ? 'var(--rose)' : undefined }}>{qOf(sel, it.id)}</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(Math.max(0, qOf(sel, it.id)) * costOf(it.id))}</td></tr>))}
            {items.every(it => qOf(sel, it.id) === 0) && <tr><td colSpan={4}><div className="empty">لا أرصدة في هذا المستودع</div></td></tr>}
          </tbody>
        </table></div>
      </div>

      <CountScheduleCard org={org} ops={ops} me={me} commitOrg={commitOrg} say={say} />

      {LOTS.length > 0 && (() => { const td2 = today(), lim30 = isoD(new Date(Date.now() + 30 * 86400000)); const near = LOTS.filter(l => l.expiry <= lim30);
        return (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />دفعات الصلاحية — المنتهية والقريبة (30 يومًا)
            <span className="badge b-dim" style={{ marginInlineStart: 8 }}>{LOTS.length} دفعة قائمة</span></div>
          <div className="tw"><table className="tb">
            <thead><tr><th>الصنف</th><th>المستودع</th><th>الدفعة</th><th>الانتهاء</th><th style={{ textAlign: 'end' }}>المتبقي التقديري</th></tr></thead>
            <tbody>
              {near.map(l => { const it = itemOf(l.itemId); const dl = Math.round((new Date(l.expiry + 'T12:00:00') - new Date(td2 + 'T12:00:00')) / 86400000); return (
                <tr key={l.id}><td>{it.name}</td><td style={{ fontSize: 12 }}>{whName(org, l.whId)}</td><td className="num" style={{ fontSize: 11.5 }}>{l.batch || '—'}</td>
                  <td><span className={'badge ' + (dl < 0 ? 'b-rose' : dl <= 7 ? 'b-amber' : 'b-sky')}>{l.expiry} · {dl < 0 ? 'منتهية منذ ' + (-dl) + ' يوم' : dl === 0 ? 'تنتهي اليوم' : 'باقٍ ' + dl + ' يوم'}</span></td>
                  <td className="num" style={{ textAlign: 'end' }}>{l.left} {it.unit}</td></tr>); })}
              {near.length === 0 && <tr><td colSpan={5}><div className="empty">لا دفعات تنتهي خلال 30 يومًا ✓</div></td></tr>}
            </tbody>
          </table></div>
          <div className="note">المتبقي تقديري: يُفترض صرف الأقرب انتهاءً أولًا (FEFO) من رصيد المستودع الحالي.</div>
        </div>); })()}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><Truck size={15} color="var(--brass)" />التحويلات بين المستودعات</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الرقم</th><th>إلى</th><th>الأصناف</th><th>الحالة</th><th>التواريخ</th><th></th></tr></thead>
          <tbody>
            {transfers.filter(t => t.kind !== 'b2b-in').slice(0, 150).map(t => {
              const inC = t.kind === 'b2b' ? inCopyOf(t) : null;
              const stShown = inC ? inC.status : t.status;
              const [c, tx] = WH_ST[stShown] || ['b-dim', stShown];
              const diff = t.status === 'received' && (t.lines || []).some(l => Math.abs((Number(l.qtySent) || 0) - (Number(l.qtyRecv) || 0)) > 0.0005);
              return (
                <tr key={t.id}>
                  <td className="num" style={{ fontSize: 11 }}>{t.no}</td>
                  <td style={{ fontSize: 12 }}>{t.kind ? <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{WH_KIND[t.kind]}<br /></span> : null}{t.kind ? whName(org, t.fromWh) + ' ← ' : ''}{whName(org, t.toWh)}</td>
                  <td style={{ fontSize: 11.5 }}>{(t.lines || []).map(l => itemOf(l.itemId).name + ' ' + (t.status === 'requested' ? l.qtyReq : t.status === 'received' ? (l.qtyRecv + (Math.abs((Number(l.qtySent) || 0) - (Number(l.qtyRecv) || 0)) > 0.0005 ? ' من ' + l.qtySent : '')) : l.qtySent)).join('، ')}</td>
                  <td><span className={'badge ' + c}>{tx}</span>{diff && <span className="badge b-rose" style={{ marginInlineStart: 4 }}>فرق استلام</span>}</td>
                  <td style={{ fontSize: 10.5, color: 'var(--dim)' }}>{(t.at || '').slice(0, 10)}{t.sentDate ? ' · صُرف ' + t.sentDate : ''}{t.receivedDate ? ' · استُلم ' + t.receivedDate : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{canW && t.status === 'requested' && <><button className="btn sm pri" onClick={() => openSend(t)}><Send size={12} />صرف</button>
                    <button className="btn sm gh" onClick={() => cancelT(t)}><X size={12} /></button></>}
                    {canW && t.kind === 'b2b' && t.status === 'proposed' && <><button className="btn sm pri" onClick={() => approveB2B(t)}><Check size={12} />اعتماد</button>
                    <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => rejectT(t)}><X size={12} />رفض</button></>}
                    {canW && t.kind === 'return' && t.status === 'sent' && <button className="btn sm pri" onClick={() => setRetF({ id: t.id, no: t.no, lines: (t.lines || []).map(l => ({ ...l, qtyRecv: l.qtySent })) })}><Check size={12} />استلام</button>}</td>
                </tr>);
            })}
            {transfers.length === 0 && <tr><td colSpan={6}><div className="empty">لا تحويلات بعد — تطلبها الفروع من شاشة «مستودع الفرع» أو يبادر بها المركز</div></td></tr>}
          </tbody>
        </table></div>
      </div>

      {sendF && (
        <Modal title={sendF.id ? 'صرف طلب تحويل' : 'تحويل جديد من المستودع الرئيسي'} icon={Send} onClose={() => setSendF(null)}
          foot={<><button className="btn pri" onClick={send}><Send size={14} />صرف — تصبح البضاعة في الطريق</button><button className="btn gh" onClick={() => setSendF(null)}>إلغاء</button></>}>
          <Field label="إلى المستودع">
            <select className="inp sel" value={sendF.toWh} disabled={!!sendF.id} onChange={e => setSendF(f => ({ ...f, toWh: e.target.value }))}>
              {whs.filter(w => w.kind === 'branch').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="الكميات المصروفة (يمكن صرف أقل من المطلوب)">
            <WhLines items={items} lines={sendF.lines} setLines={(fn) => setSendF(f => ({ ...f, lines: typeof fn === 'function' ? fn(f.lines) : fn }))} field="qtySent" max={(id) => qOf(MAIN_WH, id)} />
          </Field>
          <Field label="ملاحظة"><input className="inp" value={sendF.note} onChange={e => setSendF(f => ({ ...f, note: e.target.value }))} /></Field>
        </Modal>
      )}
      {retF && (
        <Modal title={'استلام إرجاع ' + (retF.no || '')} icon={Truck} onClose={() => setRetF(null)}
          foot={<><button className="btn pri" onClick={receiveReturn}><Check size={14} />تأكيد الاستلام في الرئيسي</button><button className="btn gh" onClick={() => setRetF(null)}>إلغاء</button></>}>
          {retF.lines.map((l, i) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 12.5 }}>{itemOf(l.itemId).name} <span style={{ color: 'var(--faint)', fontSize: 11 }}>(مُرسَل {l.qtySent})</span></span>
              <input className="inp n" style={{ width: 120 }} inputMode="decimal" value={l.qtyRecv} onChange={e => setRetF(f => ({ ...f, lines: f.lines.map((x, j) => j === i ? { ...x, qtyRecv: e.target.value } : x) }))} />
            </div>))}
        </Modal>
      )}
      {ren && (
        <Modal title="تعديل اسم المستودع" icon={PenLine} onClose={() => setRen(null)} foot={<><button className="btn pri" onClick={rename}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setRen(null)}>إلغاء</button></>}>
          <Field label="الاسم"><input className="inp" value={ren.name} onChange={e => setRen(r => ({ ...r, name: e.target.value }))} /></Field>
        </Modal>
      )}
    </>
  );
}
