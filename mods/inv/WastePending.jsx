/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { AlertTriangle, Camera, Check, X } from 'lucide-react';
import { Field, MAIN_WH, Modal, ROLES, arDate, canApproveWaste, money, nowISO, periodLocked, q3, stockByWh, today, uid, wasteReasonAr, whName, whOn } from '../../App.jsx';

export function WastePending({ org, ops, me, commit, say, whIds }) {
  const [rej, setRej] = useState(null);
  const [img, setImg] = useState(null);
  const itN = (id) => ((org.items || []).find(x => x.id === id) || {}).name || 'صنف';
  const list = (ops.wasteRequests || []).filter(r => r.status === 'pending' && (!whIds || whIds.includes(r.whId))).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const R = ROLES[me?.role] || {};
  const can = canApproveWaste(me);
  const decide = async (r, approve, note) => {
    if (!can) return say('الاعتماد لصلاحية المركز أو المدير الإقليمي', 'no');
    if (r.by === me.name && !R.admin) return say('لا يعتمد مقدّم الطلب هدره — يعتمده شخص آخر', 'no');
    if (approve) {
      const SB = stockByWh(org, ops);
      const bal = whOn(org) ? (SB.byWh[r.whId || MAIN_WH] || {}) : SB.total;
      const short = (r.lines || []).find(l => l.qty > q3(bal[l.itemId] || 0) + 0.0005);
      if (short) return say('الرصيد الحالي لا يكفي: ' + itN(short.itemId) + ' (المتاح ' + q3(bal[short.itemId] || 0) + ')', 'no');
    }
    const date = periodLocked(org, r.date) ? today() : r.date;
    const self = r.by === me.name;
    const ok = await commit(d => {
      const cur = (d.wasteRequests || []).find(x => x.id === r.id);
      if (!cur || cur.status !== 'pending') throw new Error('already-decided');
      const upd = { ...cur, status: approve ? 'approved' : 'rejected', decidedBy: me.name, decidedAt: nowISO(), ...(note ? { decideNote: note } : {}), ...(self ? { selfApproved: true } : {}) };
      const out = { ...d, wasteRequests: (d.wasteRequests || []).map(x => x.id === r.id ? upd : x) };
      if (approve) {
        const grp = uid('wg');
        const recs = (r.lines || []).map((l, i) => ({ id: uid(r.col === 'whMoves' ? 'wm' : 'sm'), ...(r.whId ? { whId: r.whId } : {}), ...(r.branchId ? { branchId: r.branchId } : {}), itemId: l.itemId, kind: 'waste', qty: -q3(l.qty), wasteVal: l.val,
          reason: r.reason, note: r.note || '', date, by: r.by, at: nowISO(), approvedBy: me.name, reqId: r.id, grp, ...(self ? { selfApproved: true } : {}), ...(i === 0 && r.photo ? { photo: r.photo } : {}) }));
        out[r.col] = [...recs, ...(d[r.col] || [])];
      }
      return out;
    }, { actionType: 'update', targetType: 'stock_move', targetId: r.id, branchName: whName(org, r.whId), title: (approve ? 'اعتماد هدر' : 'رفض هدر') + (self ? ' (اعتماد ذاتي)' : ''), details: (r.lines || []).map(l => itN(l.itemId) + ' ' + l.qty).join('، ').slice(0, 120) + ' · ' + money(r.value) + ' · طلب ' + r.by + (note ? ' · ' + note : '') });
    if (ok) { setRej(null); say(approve ? 'اعتُمد الهدر ورُحّل ✓' : 'رُفض الطلب — لم يُخصم شيء'); }
  };
  if (!list.length) return null;
  return (
    <div className="card wst-pend">
      <div className="card-h"><div className="card-t"><AlertTriangle size={15} color="var(--amber)" />هدر بانتظار الاعتماد<span className="badge b-amber" style={{ marginInlineStart: 6 }}>{list.length}</span></div></div>
      <div className="grid" style={{ gap: 8 }}>
        {list.map(r => (
          <div key={r.id} className="wst-req">
            {r.photo ? <button type="button" className="wst-ph" onClick={() => setImg(r.photo)}><img src={r.photo} alt="" /></button> : <span className="wst-ph none"><Camera size={16} /></span>}
            <div className="wst-info">
              <b>{(r.lines || []).map(l => itN(l.itemId) + ' × ' + l.qty).join('، ')}</b>
              <small>{whName(org, r.whId)} · {wasteReasonAr(r.reason)}{r.note ? ' — ' + r.note : ''}</small>
              <small>طلبه {r.by} · <span className="dt">{arDate(r.date)}</span></small>
            </div>
            <b className="num wst-val">{money(r.value)}</b>
            {can && <div className="row" style={{ gap: 6 }}>
              <button className="btn sm pri" disabled={r.by === me.name && !R.admin} title={r.by === me.name && !R.admin ? 'يعتمده شخص آخر' : ''} onClick={() => decide(r, true)}><Check size={13} />اعتماد</button>
              <button className="btn sm gh" onClick={() => setRej({ r, note: '' })}><X size={13} />رفض</button>
            </div>}
          </div>))}
      </div>
      {!can && <div className="note" style={{ marginTop: 8 }}>يعتمد هذه الطلبات المركز أو المدير الإقليمي — لا تُخصم من الرصيد قبل الاعتماد.</div>}
      {rej && <Modal title="رفض طلب الهدر" icon={X} onClose={() => setRej(null)} foot={<><button className="btn gh" onClick={() => setRej(null)}>إلغاء</button><button className="btn pri" onClick={() => { if (!rej.note.trim()) return say('اكتب سبب الرفض', 'no'); decide(rej.r, false, rej.note.trim()); }}>رفض</button></>}>
        <Field label="سبب الرفض"><input className="inp" value={rej.note} onChange={e => setRej(x => ({ ...x, note: e.target.value }))} placeholder="مثال: الصنف موجود بالمستودع — أعد العدّ" /></Field>
      </Modal>}
      {img && <Modal title="صورة التالف" icon={Camera} onClose={() => setImg(null)}><img src={img} alt="" style={{ width: '100%', borderRadius: 10 }} /></Modal>}
    </div>);
}
