/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { ShieldCheck, Check, Camera, Lock, AlertTriangle, Trash2, X, BarChart3, Printer } from 'lucide-react';
import { Field, Kpi, Modal, WastePending, arDate, countedClosing, isoD, itemAvgCosts, money, printA4, q3, roleEdit, sum, today, wasteCfg, wasteDaily, wasteReasonAr, wasteRows, whName } from '../../App.jsx';

export function WasteControl({ org, ops, me, commit, commitOrg, say }) {
  const cfg = wasteCfg(org);
  const canSet = roleEdit(me?.role);   // v37.8: حدود الهدر للمكتب الرئيسي/الإدارة — لا لمن يعتمد عليها
  const [f, setF] = useState(null);
  const [days, setDays] = useState(30);
  const [by, setBy] = useState('emp');
  const [img, setImg] = useState(null);
  const AVG = useMemo(() => itemAvgCosts(org, ops), [org, ops]);
  const to = today(); const from = (() => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return isoD(d); })();
  const rows = useMemo(() => wasteRows(org, ops, AVG).filter(m => { const d = String(m.date || '').slice(0, 10); return d >= from && d <= to; }), [org, ops, AVG, from]);
  const daily = useMemo(() => wasteDaily(org, ops, AVG, from, to), [org, ops, AVG, from]);
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || (id ? '' : 'المستودع الرئيسي');
  const itN = (id) => ((org.items || []).find(x => x.id === id) || {}).name || 'صنف';
  const total = Math.round(sum(rows, m => m.val) * 100) / 100;
  const salesT = sum((ops.closings || []).filter(c => countedClosing(c) && c.date >= from && c.date <= to), c => Number(c.totalRevenue) || 0);
  const over = daily.filter(x => x.pct != null && cfg.capPct > 0 && x.pct > cfg.capPct).sort((a, b) => b.date.localeCompare(a.date));
  const noSale = daily.filter(x => x.pct == null);
  const pend = (ops.wasteRequests || []).filter(r => r.status === 'pending');
  const rejected = (ops.wasteRequests || []).filter(r => r.status === 'rejected' && String(r.date || '') >= from);
  const noReason = rows.filter(m => !m.reason).length;
  const grp = (keyOf, nameOf) => { const G = {}; rows.forEach(m => { const k = keyOf(m); const g = G[k] = G[k] || { k, name: nameOf(m), n: 0, val: 0, reasons: {} }; g.n++; g.val += m.val; const rk = m.reason || '—'; g.reasons[rk] = (g.reasons[rk] || 0) + m.val; });
    return Object.values(G).map(g => ({ ...g, val: Math.round(g.val * 100) / 100, share: total ? Math.round(g.val / total * 1000) / 10 : 0, top: Object.entries(g.reasons).sort((a, b) => b[1] - a[1])[0] })).sort((a, b) => b.val - a.val); };
  const T = by === 'emp' ? grp(m => m.by || '—', m => m.by || '—') : by === 'reason' ? grp(m => m.reason || '—', m => m.reason ? wasteReasonAr(m.reason) : 'بلا سبب (قبل v37.4)') : by === 'item' ? grp(m => m.itemId, m => itN(m.itemId)) : grp(m => m.branchId || '', m => brName(m.branchId));
  const save = async () => {
    const n = (v) => Math.max(0, Number(String(v).replace(/[^\d.]/g, '')) || 0);
    const next = { photoOver: n(f.photoOver), approveOver: n(f.approveOver), capPct: n(f.capPct) };
    if (next.approveOver && next.photoOver && next.approveOver < next.photoOver) return say('حد الاعتماد يجب أن يكون ≥ حد الصورة', 'no');
    const ok = await commitOrg(d => ({ ...d, wasteCfg: next }), { actionType: 'update', targetType: 'settings', targetId: 'wasteCfg', need: 'edit', title: 'ضوابط الهدر', details: 'صورة فوق ' + money(next.photoOver) + ' · اعتماد فوق ' + money(next.approveOver) + ' · سقف يومي ' + next.capPct + '%' });
    if (ok) { setF(null); say('حُفظت ضوابط الهدر ✓'); }
  };
  const printRep = () => {
    const tr = T.map(g => `<tr><td>${g.name}</td><td class="n">${g.n}</td><td class="n">${money(g.val)}</td><td class="n">${g.share}%</td><td>${by === 'reason' ? '' : (g.top ? (g.top[0] === '—' ? 'بلا سبب' : wasteReasonAr(g.top[0])) : '')}</td></tr>`).join('');
    printA4(org, 'تقرير الهدر', 'آخر ' + days + ' يومًا · الإجمالي ' + money(total),
      `<table><thead><tr><th>${{ emp: 'الموظف', reason: 'السبب', item: 'الصنف', br: 'الفرع' }[by]}</th><th>حالات</th><th>القيمة</th><th>النسبة</th><th>${by === 'reason' ? '' : 'أكثر سبب'}</th></tr></thead><tbody>${tr}</tbody></table>
      <div class="box">القيمة بالمتوسط المرجّح لحظة التسجيل. سقف الهدر اليومي ${cfg.capPct}% من مبيعات الفرع — أيام التجاوز في الفترة: ${over.length}.</div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />ضوابط الهدر</div>
          {canSet && !f && <button className="btn sm" onClick={() => setF({ photoOver: String(cfg.photoOver), approveOver: String(cfg.approveOver), capPct: String(cfg.capPct) })}>تعديل</button>}</div>
        {f ? <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <Field label="صورة إلزامية فوق (ر.س)" style={{ width: 170, marginBottom: 0 }}><input className="inp n" inputMode="decimal" value={f.photoOver} onChange={e => setF(x => ({ ...x, photoOver: e.target.value }))} /></Field>
          <Field label="اعتماد مدير فوق (ر.س)" style={{ width: 170, marginBottom: 0 }}><input className="inp n" inputMode="decimal" value={f.approveOver} onChange={e => setF(x => ({ ...x, approveOver: e.target.value }))} /></Field>
          <Field label="سقف يومي % من المبيعات" style={{ width: 170, marginBottom: 0 }}><input className="inp n" inputMode="decimal" value={f.capPct} onChange={e => setF(x => ({ ...x, capPct: e.target.value }))} /></Field>
          <button className="btn pri" onClick={save}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setF(null)}>إلغاء</button>
        </div> : <div className="wst-rules">
          <span><Camera size={13} />صورة التالف إلزامية من <b className="num">{money(cfg.photoOver)}</b></span>
          <span><Lock size={13} />اعتماد شخص آخر من <b className="num">{money(cfg.approveOver)}</b></span>
          <span><AlertTriangle size={13} />سقف الهدر اليومي <b className="num">{cfg.capPct}%</b> من مبيعات الفرع</span>
        </div>}
        <div className="note" style={{ marginTop: 8 }}>{!canSet ? 'تعديل الحدود للمكتب الرئيسي. ' : ''}وضع 0 يعطّل الضابط. الهدر المعلّق لا يُخصم من الرصيد ولا يُقيَّد حتى يُعتمد، ومقدّم الطلب لا يعتمد طلبه.</div>
      </div>
      <WastePending org={org} ops={ops} me={me} commit={commit} say={say} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {[[7, 'أسبوع'], [30, '30 يومًا'], [90, '90 يومًا']].map(([d, l]) => <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>{l}</button>)}
      </div>
      <div className="grid g4">
        <Kpi label="قيمة الهدر" value={money(total)} sub={rows.length + ' حركة' + (salesT ? ' · ' + (Math.round(total / salesT * 1000) / 10) + '% من المبيعات' : '')} icon={Trash2} color="#D9544D" />
        <Kpi label="أيام تجاوز السقف" value={String(over.length)} sub={cfg.capPct ? 'فوق ' + cfg.capPct + '% من مبيعات اليوم' : 'السقف معطّل'} icon={AlertTriangle} color={over.length ? '#D9544D' : '#4FB286'} />
        <Kpi label="بانتظار الاعتماد" value={String(pend.length)} sub={money(sum(pend, r => r.value))} icon={Lock} color={pend.length ? '#E0A458' : '#4FB286'} />
        <Kpi label="طلبات مرفوضة" value={String(rejected.length)} sub={money(sum(rejected, r => r.value)) + (noReason ? ' · ' + noReason + ' حركة بلا سبب' : '')} icon={X} color="#5B93C4" />
      </div>
      <div className="card">
        <div className="card-h"><div className="card-t"><BarChart3 size={15} color="var(--brass)" />تقرير الهدر — آخر {days} يومًا</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {[['emp', 'حسب الموظف'], ['reason', 'حسب السبب'], ['item', 'حسب الصنف'], ['br', 'حسب الفرع']].map(([k, l]) => <button key={k} className={'btn sm' + (by === k ? ' pri' : ' gh')} onClick={() => setBy(k)}>{l}</button>)}
            <button className="btn sm" onClick={printRep}><Printer size={13} />طباعة</button>
          </div></div>
        {!T.length ? <div className="empty">لا هدر مسجّل في الفترة.</div> : <div className="tw"><table className="tb">
          <thead><tr><th>{{ emp: 'الموظف', reason: 'السبب', item: 'الصنف', br: 'الفرع' }[by]}</th><th style={{ textAlign: 'end' }}>حالات</th><th style={{ textAlign: 'end' }}>القيمة</th><th style={{ textAlign: 'end' }}>النسبة</th>{by !== 'reason' && <th>أكثر سبب</th>}</tr></thead>
          <tbody>{T.map(g => <tr key={g.k}><td>{g.name}</td><td className="num" style={{ textAlign: 'end' }}>{g.n}</td><td className="num" style={{ textAlign: 'end' }}>{money(g.val)}</td>
            <td style={{ textAlign: 'end' }}><span className="wst-bar"><i style={{ width: Math.min(100, g.share) + '%' }} /></span><span className="num">{g.share}%</span></td>
            {by !== 'reason' && <td style={{ fontSize: 12 }}>{g.top ? (g.top[0] === '—' ? 'بلا سبب' : wasteReasonAr(g.top[0])) : '—'}</td>}</tr>)}</tbody>
        </table></div>}
      </div>
      {(over.length > 0 || noSale.length > 0) && <div className="card">
        <div className="card-h"><div className="card-t"><AlertTriangle size={15} color="var(--rose)" />أيام تجاوز سقف الهدر ({cfg.capPct}%)</div></div>
        <div className="tw"><table className="tb">
          <thead><tr><th>التاريخ</th><th>الفرع</th><th style={{ textAlign: 'end' }}>الهدر</th><th style={{ textAlign: 'end' }}>المبيعات</th><th style={{ textAlign: 'end' }}>النسبة</th></tr></thead>
          <tbody>{[...over, ...noSale.filter(x => x.waste > 0)].slice(0, 60).map(x => <tr key={x.branchId + x.date}><td><span className="dt">{arDate(x.date)}</span></td><td>{brName(x.branchId)}</td>
            <td className="num neg" style={{ textAlign: 'end' }}>{money(x.waste)}</td><td className="num" style={{ textAlign: 'end' }}>{x.sales ? money(x.sales) : '—'}</td>
            <td style={{ textAlign: 'end' }}>{x.pct == null ? <span className="badge b-amber">هدر بلا مبيعات مسجّلة</span> : <span className="badge b-rose num">{x.pct}%</span>}</td></tr>)}</tbody>
        </table></div>
      </div>}
      <div className="card">
        <div className="card-h"><div className="card-t"><Camera size={15} color="var(--brass)" />آخر حركات الهدر</div></div>
        {!rows.length ? <div className="empty">لا حركات.</div> : <div className="tw"><table className="tb">
          <thead><tr><th>التاريخ</th><th>المستودع</th><th>الصنف</th><th style={{ textAlign: 'end' }}>الكمية</th><th style={{ textAlign: 'end' }}>القيمة</th><th>السبب</th><th>سجّله / اعتمده</th><th>صورة</th></tr></thead>
          <tbody>{rows.slice().sort((a, b) => String(b.at || b.date || '').localeCompare(String(a.at || a.date || ''))).slice(0, 80).map(m => <tr key={m.id}>
            <td><span className="dt">{arDate(m.date)}</span></td><td style={{ fontSize: 12 }}>{whName(org, m.whId)}</td><td>{itN(m.itemId)}</td>
            <td className="num" style={{ textAlign: 'end' }}>{q3(-m.qty)}</td><td className="num" style={{ textAlign: 'end' }}>{money(m.val)}</td>
            <td style={{ fontSize: 12 }}>{m.reason ? wasteReasonAr(m.reason) : <span style={{ color: 'var(--faint)' }}>—</span>}{m.note ? <div style={{ color: 'var(--dim)', fontSize: 11 }}>{m.note}</div> : null}</td>
            <td style={{ fontSize: 12 }}>{m.by || '—'}{m.approvedBy ? <div style={{ color: 'var(--dim)', fontSize: 11 }}>اعتمده {m.approvedBy}{m.selfApproved ? ' (ذاتي)' : ''}</div> : null}</td>
            <td>{m.photo ? <button type="button" className="wst-ph sm" onClick={() => setImg(m.photo)}><img src={m.photo} alt="" /></button> : ''}</td></tr>)}</tbody>
        </table></div>}
      </div>
      {img && <Modal title="صورة التالف" icon={Camera} onClose={() => setImg(null)}><img src={img} alt="" style={{ width: '100%', borderRadius: 10 }} /></Modal>}
    </div>);
}
