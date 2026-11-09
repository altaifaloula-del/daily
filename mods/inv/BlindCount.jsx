/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { EyeOff, RotateCcw, Check, ClipboardCheck, X, Printer } from 'lucide-react';
import { COUNT_ST, Field, MAIN_WH, Modal, aCountDone, aItemsOf, arDate, canApproveCount, countCfgOf, countFocus, fmtBalP, itemAvgCosts, money, nowISO, periodLocked, printA4, q3, stockByWh, sum, today, uid, whOn } from '../../App.jsx';

export function BlindCount({ org, ops, me, commit, say, whId, branchId, col, items, title, canCount = true }) {
  const cc = countCfgOf(org);
  const SB = useMemo(() => stockByWh(org, ops), [org, ops]);
  const AVG = useMemo(() => itemAvgCosts(org, ops), [org, ops]);
  const bookOf = (id) => q3((((whOn(org) ? SB.byWh[whId] : SB.total) || {})[id]) || 0);
  const A = useMemo(() => aItemsOf(org, ops, whId, SB, AVG), [org, ops, whId]);
  const focus = useMemo(() => countFocus(org, ops, whId), [org, ops, whId]);
  const [mode, setMode] = useState(cc.dailyA && !aCountDone(ops, whId, today()) ? 'a' : 'full');
  const [cnt, setCnt] = useState({});
  const [rej, setRej] = useState(null);
  const itN = (id) => (items.find(x => x.id === id) || (org.items || []).find(x => x.id === id) || {}).name || 'صنف';
  const unitOf = (id) => (items.find(x => x.id === id) || {}).unit || '';
  const mine = (ops.countSessions || []).filter(s => (s.whId || MAIN_WH) === whId).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const act = mine.find(s => s.status === 'recount' || s.status === 'submitted');
  const canAppr = canApproveCount(me);
  const outTol = (l) => { const d = Math.abs(l.final - l.book), v = d * (l.cost || 0), pct = l.book > 0 ? d / l.book * 100 : (d > 0.0005 ? 100 : 0);
    return d > 0.0005 && v >= cc.tolVal && pct >= cc.tolPct; };
  const list = (mode === 'a' ? items.filter(it => A.includes(it.id)) : (focus ? [...items].sort((x, y) => (focus.has(y.id) ? 1 : 0) - (focus.has(x.id) ? 1 : 0)) : items));
  const meta = { actionType: 'update', targetType: 'stocktake', branchName: title };
  const submit = async () => {
    const ent = list.filter(it => cnt[it.id] !== undefined && cnt[it.id] !== '');
    if (!ent.length) return say('أدخل العدّ لصنف واحد على الأقل', 'no');
    if (mode === 'a' && ent.length < list.length) return say('جرد A يشمل كل أصنافه (' + list.length + ') — أكمل العدّ', 'no');
    const lines = ent.map(it => { const c1 = q3(Number(cnt[it.id]) || 0); return { itemId: it.id, c1, final: c1, book: bookOf(it.id), cost: Math.round((AVG[it.id] || 0) * 10000) / 10000 }; });
    lines.forEach(l => { l.flag = outTol(l); });
    const rc = lines.filter(l => l.flag).length;
    const rec = { id: uid('cs'), whId, ...(branchId ? { branchId } : {}), col, scope: mode, date: today(), countedBy: me.name, at: nowISO(), lines, status: rc ? 'recount' : 'submitted' };
    const ok = await commit(d => {
      if ((d.countSessions || []).some(s => (s.whId || MAIN_WH) === whId && (s.status === 'recount' || s.status === 'submitted'))) throw new Error('count-open');
      return { ...d, countSessions: [rec, ...(d.countSessions || [])] };
    }, { ...meta, actionType: 'create', targetId: rec.id, title: 'تسليم جرد أعمى' + (mode === 'a' ? ' (أصناف A)' : '') + ' — ' + title, details: lines.length + ' صنف' + (rc ? ' · ' + rc + ' لإعادة العدّ' : '') });
    if (ok) { setCnt({}); say(rc ? rc + ' صنف خارج التسامح — أعد عدّها قبل الاعتماد' : 'سُلّم العدّ ✓ — بانتظار اعتماد شخص آخر'); }
  };
  const recount = async () => {
    const fl = act.lines.filter(l => l.flag);
    if (fl.some(l => cnt[l.itemId] === undefined || cnt[l.itemId] === '')) return say('أعد عدّ كل الأصناف المطلوبة', 'no');
    const lines = act.lines.map(l => { if (!l.flag) return l; const c2 = q3(Number(cnt[l.itemId]) || 0); return { ...l, c2, final: c2, book: bookOf(l.itemId) }; });
    const still = lines.filter(l => l.flag && outTol(l)).length;
    const ok = await commit(d => ({ ...d, countSessions: (d.countSessions || []).map(s => s.id === act.id && s.status === 'recount' ? { ...s, lines, status: 'submitted', recountBy: me.name, recountAt: nowISO() } : s) }),
      { ...meta, targetId: act.id, title: 'إعادة عدّ — ' + title, details: fl.map(l => itN(l.itemId) + ' ' + l.c1 + '←' + q3(Number(cnt[l.itemId]) || 0)).join('، ').slice(0, 150) });
    if (ok) { setCnt({}); say('سُلّمت إعادة العدّ ✓' + (still ? ' — ' + still + ' صنف ما زال بفرق، يقرّره المعتمد' : '') + ' — بانتظار الاعتماد'); }
  };
  const decide = async (approve, note) => {
    const s = act; if (!s || s.status !== 'submitted') return;
    if (!canAppr) return say('لا تملك صلاحية اعتماد الجرد', 'no');
    if (s.countedBy === me.name || s.recountBy === me.name) return say('لا يعتمد العادّ جرده — يعتمده شخص آخر', 'no');
    const diffs = s.lines.map(l => ({ ...l, d: q3(l.final - l.book) })).filter(l => Math.abs(l.d) > 0.0005);
    const date = periodLocked(org, s.date) ? today() : s.date;
    const recs = approve ? diffs.map(l => ({ id: uid(s.col === 'whMoves' ? 'wm' : 'sm'), ...(s.col === 'whMoves' || whOn(org) ? { whId } : {}), ...(branchId ? { branchId } : {}), itemId: l.itemId, kind: 'adjust', qty: l.d,
      note: 'جرد أعمى ' + s.date + (l.d < 0 ? ' — عجز' : ' — زيادة') + (l.c2 != null ? ' (بعد إعادة العدّ)' : ''), date, by: s.countedBy, approvedBy: me.name, countId: s.id, ...(s.scope === 'a' ? { countScope: 'a' } : {}), at: nowISO() })) : [];
    const logRec = { id: uid('sc'), whId, ...(branchId ? { branchId } : {}), date: s.date, counted: s.lines.length, diffs: diffs.length, by: s.countedBy, approvedBy: me.name, scope: s.scope, at: nowISO() };
    const ok = await commit(d => {
      const cur = (d.countSessions || []).find(x => x.id === s.id); if (!cur || cur.status !== 'submitted') throw new Error('count-decided');
      const out = { ...d, countSessions: (d.countSessions || []).map(x => x.id === s.id ? { ...x, status: approve ? 'approved' : 'rejected', decidedBy: me.name, decidedAt: nowISO(), ...(note ? { decideNote: note } : {}) } : x) };
      if (approve) { out[s.col] = [...recs, ...(d[s.col] || [])]; out.stockCounts = [logRec, ...(d.stockCounts || [])]; }
      return out;
    }, { ...meta, targetId: s.id, title: (approve ? 'اعتماد جرد' : 'رفض جرد') + ' — ' + title, details: approve ? (diffs.length ? diffs.map(l => itN(l.itemId) + ' (' + (l.d > 0 ? '+' : '') + l.d + ')').join('، ').slice(0, 150) : 'مطابق بلا فروقات') : note || '' });
    if (ok) { setRej(null); say(approve ? (diffs.length ? 'اعتُمد الجرد وسُجّلت ' + diffs.length + ' تسوية ✓' : 'اعتُمد الجرد — مطابق ✓') : 'رُفض الجرد — يُعاد العدّ من جديد'); }
  };
  const printSheet = () => {
    const rows = list.map(it => `<tr><td>${it.name}</td><td>${it.unit || ''}</td><td style="height:26px"></td><td></td></tr>`).join('');
    printA4(org, 'قائمة جرد أعمى — ' + title, arDate(today()) + (mode === 'a' ? ' · أصناف الفئة A' : '') + ' — لا يظهر الرصيد الدفتري للعادّ',
      `<table><thead><tr><th>الصنف</th><th>الوحدة</th><th>العدّ الفعلي</th><th>ملاحظات</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sign"><div>قام بالعدّ</div><div>أعاد العدّ</div><div>اعتماد (شخص آخر)</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const inp = (id) => <input className="inp n" inputMode="decimal" disabled={!canCount} value={cnt[id] ?? ''} onChange={e => setCnt(c => ({ ...c, [id]: e.target.value.replace(/[^\d.]/g, '') }))} />;
  const head = (
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
      <span className="badge b-dim"><EyeOff size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />جرد أعمى · اعتماد مزدوج</span>
      {cc.dailyA && <span className={'badge ' + (aCountDone(ops, whId, today()) ? 'b-mint' : 'b-amber')}>جرد A اليومي: {aCountDone(ops, whId, today()) ? 'تم اليوم' : 'مطلوب اليوم'}</span>}
      <span className="badge b-dim">إعادة العدّ عند فرق {money(cc.tolVal)} فأكثر وبنسبة {cc.tolPct}% فأكثر</span>
    </div>);
  // —— جلسة قائمة ——
  if (act) {
    const isCounter = act.countedBy === me.name || act.recountBy === me.name;
    if (act.status === 'recount') {
      const fl = act.lines.filter(l => l.flag);
      return (<div className="card">{head}
        <div className="card-t" style={{ marginBottom: 6 }}><RotateCcw size={15} color="var(--amber)" />إعادة عدّ مطلوبة — {fl.length} صنف</div>
        <div className="note" style={{ marginBottom: 10 }}>هذه الأصناف فرقها خارج التسامح. أعد عدّها فعليًا (يُفضّل شخص آخر) — لا يظهر الرصيد الدفتري. عدّها الأول باسم {act.countedBy}.</div>
        <div className="tw"><table className="tb"><thead><tr><th>الصنف</th><th style={{ width: 140 }}>إعادة العدّ</th></tr></thead>
          <tbody>{fl.map(l => <tr key={l.itemId}><td>{itN(l.itemId)} <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{unitOf(l.itemId)}</span></td><td>{inp(l.itemId)}</td></tr>)}</tbody></table></div>
        {canCount && <button className="btn pri" style={{ marginTop: 10 }} onClick={recount}><Check size={14} />تسليم إعادة العدّ</button>}
      </div>);
    }
    if (!canAppr || isCounter) return (<div className="card">{head}
      <div className="empty" style={{ textAlign: 'start' }}><b>العدّ مُسلَّم — بانتظار اعتماد شخص آخر</b><br />سلّمه {act.countedBy}{act.recountBy ? ' وأعاد العدّ ' + act.recountBy : ''} · <span className="dt">{arDate(act.date)}</span> · {act.lines.length} صنف. لا تظهر الفروقات للعادّ.</div>
    </div>);
    const rows = act.lines.map(l => ({ ...l, d: q3(l.final - l.book), v: Math.round((l.final - l.book) * (l.cost || 0) * 100) / 100 }));
    const net = Math.round(sum(rows, r => r.v) * 100) / 100;
    return (<div className="card">{head}
      <div className="card-h"><div className="card-t"><ClipboardCheck size={15} color="var(--brass)" />مراجعة واعتماد الجرد{act.scope === 'a' ? ' (أصناف A)' : ''}</div>
        <span className="badge b-dim">عدّه {act.countedBy}{act.recountBy ? ' · أعاد ' + act.recountBy : ''} · {arDate(act.date)}</span></div>
      <div className="tw"><table className="tb">
        <thead><tr><th>الصنف</th><th style={{ textAlign: 'end' }}>الدفتري</th><th style={{ textAlign: 'end' }}>العدّ الأول</th><th style={{ textAlign: 'end' }}>إعادة العدّ</th><th style={{ textAlign: 'end' }}>الفرق</th><th style={{ textAlign: 'end' }}>القيمة</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.itemId} className={outTol(r) ? 'cnt-bad' : ''}><td>{itN(r.itemId)} <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{unitOf(r.itemId)}</span></td>
          <td className="num" style={{ textAlign: 'end' }}>{r.book}</td><td className="num" style={{ textAlign: 'end' }}>{r.c1}</td><td className="num" style={{ textAlign: 'end' }}>{r.c2 != null ? r.c2 : '—'}</td>
          <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: r.d < 0 ? 'var(--rose)' : r.d > 0 ? 'var(--mint)' : 'var(--faint)' }}>{Math.abs(r.d) < 0.0005 ? 'مطابق' : <span dir="ltr">{r.d > 0 ? '+' + r.d : r.d}</span>}</td>
          <td className={'num' + (r.v < 0 ? ' neg' : '')} style={{ textAlign: 'end' }}>{Math.abs(r.v) < 0.005 ? '—' : fmtBalP(r.v)}</td></tr>)}
          <tr className="tot"><td colSpan={5}>صافي أثر الجرد</td><td className={'num' + (net < 0 ? ' neg' : '')} style={{ textAlign: 'end' }}>{fmtBalP(net)}</td></tr></tbody>
      </table></div>
      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn pri" onClick={() => decide(true)}><Check size={14} />اعتماد وتسجيل التسويات</button>
        <button className="btn gh" onClick={() => setRej({ note: '' })}><X size={14} />رفض وإعادة الجرد</button>
      </div>
      {rej && <Modal title="رفض الجرد" icon={X} onClose={() => setRej(null)} foot={<><button className="btn gh" onClick={() => setRej(null)}>إلغاء</button><button className="btn pri" onClick={() => { if (!rej.note.trim()) return say('اكتب سبب الرفض', 'no'); decide(false, rej.note.trim()); }}>رفض</button></>}>
        <Field label="سبب الرفض"><input className="inp" value={rej.note} onChange={e => setRej({ note: e.target.value })} placeholder="مثال: فرق اللحم غير منطقي — أعيدوا الجرد بحضور المشرف" /></Field></Modal>}
    </div>);
  }
  // —— إدخال عدّ جديد (أعمى) ——
  const last = mine.find(s => s.status === 'approved' || s.status === 'rejected');
  if (!canCount) return (<div className="card">{head}<div className="empty">لا جرد بانتظار الاعتماد في هذا المستودع.</div>
    {mine.length > 0 && <div className="tw"><table className="tb"><thead><tr><th>التاريخ</th><th>النطاق</th><th>العادّ</th><th>المعتمد</th><th>الحالة</th></tr></thead>
      <tbody>{mine.slice(0, 30).map(s => <tr key={s.id}><td><span className="dt">{arDate(s.date)}</span></td><td>{s.scope === 'a' ? 'أصناف A' : 'كامل'} · {s.lines.length}</td><td style={{ fontSize: 12 }}>{s.countedBy}{s.recountBy ? ' / ' + s.recountBy : ''}</td><td style={{ fontSize: 12 }}>{s.decidedBy || '—'}</td><td><span className={'badge ' + (COUNT_ST[s.status] || [])[0]}>{(COUNT_ST[s.status] || [])[1]}</span></td></tr>)}</tbody></table></div>}</div>);
  return (<div className="card">{head}
    <div className="card-h">
      <div className="row" style={{ gap: 6 }}>
        <button className={'btn sm' + (mode === 'full' ? ' pri' : ' gh')} onClick={() => setMode('full')}>جرد كامل</button>
        <button className={'btn sm' + (mode === 'a' ? ' pri' : ' gh')} onClick={() => setMode('a')}>أصناف A ({A.length})</button>
      </div>
      <button className="btn sm" onClick={printSheet}><Printer size={13} />قائمة ورقية</button>
    </div>
    {last && last.status === 'rejected' && <div className="note" style={{ marginBottom: 8, borderColor: 'rgba(217,84,77,.4)' }}>رُفض آخر جرد ({arDate(last.date)}) من {last.decidedBy}: {last.decideNote || '—'} — أعد الجرد.</div>}
    {mode === 'a' && !A.length ? <div className="empty">لا أصناف برصيد ذي قيمة في هذا المستودع.</div> : <div className="tw"><table className="tb">
      <thead><tr><th>الصنف</th><th style={{ width: 140 }}>العدّ الفعلي</th></tr></thead>
      <tbody>{list.map(it => <tr key={it.id}><td>{(mode === 'a' || (focus && focus.has(it.id))) ? <span style={{ color: 'var(--brass)' }}>★ </span> : null}{it.name} <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{it.unit}</span></td><td>{inp(it.id)}</td></tr>)}
        {!list.length && <tr><td colSpan={2}><div className="empty">لا أصناف.</div></td></tr>}</tbody>
    </table></div>}
    {canCount && <button className="btn pri" style={{ marginTop: 10 }} onClick={submit}><Check size={14} />تسليم العدّ للاعتماد</button>}
    <div className="note" style={{ marginTop: 10 }}>لا يظهر الرصيد الدفتري ولا الفرق أثناء العدّ. الأصناف خارج التسامح تعود لإعادة العدّ، ولا تُسجَّل أي تسوية قبل اعتماد شخص آخر غير العادّ.</div>
    {mine.length > 0 && <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontSize: 12.5 }}>سجل جلسات الجرد ({mine.length})</summary>
      <div className="tw"><table className="tb"><thead><tr><th>التاريخ</th><th>النطاق</th><th>العادّ</th><th>المعتمد</th><th>الحالة</th></tr></thead>
        <tbody>{mine.slice(0, 30).map(s => <tr key={s.id}><td><span className="dt">{arDate(s.date)}</span></td><td>{s.scope === 'a' ? 'أصناف A' : 'كامل'} · {s.lines.length}</td><td style={{ fontSize: 12 }}>{s.countedBy}{s.recountBy ? ' / ' + s.recountBy : ''}</td><td style={{ fontSize: 12 }}>{s.decidedBy || '—'}</td><td><span className={'badge ' + (COUNT_ST[s.status] || [])[0]}>{(COUNT_ST[s.status] || [])[1]}</span></td></tr>)}</tbody></table></div></details>}
  </div>);
}
