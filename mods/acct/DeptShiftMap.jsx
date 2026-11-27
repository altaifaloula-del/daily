/* v56.42 — الدفعة 8 (قرار المجلس U3، وقرار المالك: «الصيانة والكهرباء يختار المحاسب قسمها»): قسم مصروفات الوردية من تصنيفها — الكاشير لا يختار.
   الخريطة نطاق بتاريخ بدء (لا يتغير تقرير ما قبله)، و«يحدده المحاسب» يُختار لكل مصروف من هنا. القسم بُعد إداري لا يمس القيود. */
import React, { useState } from 'react';
import { Layers, Check } from 'lucide-react';
import { DEPT_SHARED, DEPT_PICK, deptList, deptMapSuggest, deptMapAt, expDeptPending, money, nowISO, today, periodLocked } from '../../App.jsx';

export function DeptShiftMap({ org, ops, me, commit, commitOrg, say, canPost, from, to }) {
  const L = deptList(org); const cats = (org.expenseCats || []).filter(c => !/سلف|مسحوبات/.test(c.n || ''));
  const cur = deptMapAt(org, '9999-12-31'); const ranges = (org.costDepts && org.costDepts.catMaps) || [];
  const [m, setM] = useState(null); const [start, setStart] = useState(today());
  const pend = expDeptPending(org, ops, from, to); const [pick, setPick] = useState({});
  const opts = [<option key="_" value="">بلا قسم</option>, <option key="sh" value={DEPT_SHARED}>مشترك (بلا توزيع)</option>, <option key="pk" value={DEPT_PICK}>يحدده المحاسب</option>, ...L.map(d => <option key={d.id} value={d.id}>{d.name}</option>)];
  const lbl = (v) => v === DEPT_PICK ? 'يحدده المحاسب' : v === DEPT_SHARED ? 'مشترك' : v ? ((L.find(d => d.id === v) || {}).name || 'قسم محذوف') : 'بلا قسم';
  const saveMap = async () => {
    if (!start || start < today() || periodLocked(org, start)) return say('تاريخ البدء لا يسبق اليوم ولا يقع في فترة مقفلة — لا يتغير تقرير ما قبله', 'no');
    const ok = await commitOrg(o => ({ ...o, costDepts: { ...(o.costDepts || {}), catMaps: [...(((o.costDepts || {}).catMaps) || []).filter(r => r.from !== start), { from: start, map: m, by: me.name, at: nowISO() }] } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'costDepts.catMaps', need: 'post', title: 'خريطة أقسام مصروفات الوردية', details: 'من ' + start });
    if (ok) { setM(null); say('حُفظت الخريطة — تسري من ' + start + ' ✓'); } };
  const savePick = async (x) => { const v = pick[x.key]; if (!v) return say('اختر القسم', 'no'); if (periodLocked(org, x.date)) return say('الشهر مقفل', 'no');
    const ok = await commit(d => ({ ...d, expDeptPicks: [...(d.expDeptPicks || []), { key: x.key, deptId: v, by: me.name, byId: me.id || '', at: nowISO() }] }), { actionType: 'update', targetType: 'journal_entry', targetId: 'exp:' + x.key, need: 'post', title: 'قسم مصروف وردية', details: x.cat + ' · ' + money(x.amount) + ' ← ' + lbl(v) });
    if (ok) say('حُدد القسم ✓'); };
  return (<div className="card" data-deptmap>
    <div className="card-h"><div className="card-t"><Layers size={15} color="var(--brass)" />قسم مصروفات الوردية (من التصنيف)</div>
      {canPost && !m && <button className="btn sm" onClick={() => setM({ ...(cur || deptMapSuggest(org)) })} data-deptmap-edit>{cur ? 'تعديل الخريطة' : 'إعداد الخريطة'}</button>}</div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      الكاشير لا يختار القسم: يُنسب من تصنيف المصروف. «يحدده المحاسب» (الصيانة والكهرباء بقرارك) يظهر أدناه ليحدد المحاسب قسمه. كل تعديل للخريطة يسري من تاريخه فلا يتغير ما قبله.
      {ranges.length > 0 && <div>النطاقات: {ranges.map(r => r.from).sort().join(' · ')}</div>}</div>
    {m ? <div data-deptmap-editor>
      {cats.map(c => <div key={c.id} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center' }}><span style={{ flex: 1, fontSize: 12.5 }}>{c.n}</span>
        <select className="sel" aria-label={'قسم ' + c.n} value={m[c.id] || ''} onChange={e => setM({ ...m, [c.id]: e.target.value })}>{opts}</select></div>)}
      <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center' }}><span style={{ fontSize: 12 }}>تسري من</span>
        <input type="date" className="inp" aria-label="بدء الخريطة" value={start} onChange={e => setStart(e.target.value)} />
        <button className="btn sm gh" onClick={() => setM(null)}>إلغاء</button><button className="btn sm pri" onClick={saveMap} data-deptmap-save><Check size={13} />حفظ</button></div>
    </div> : cur ? <div style={{ fontSize: 12 }}>{cats.map(c => <span key={c.id} className="badge b-dim" style={{ marginInlineEnd: 4 }}>{c.n}: {lbl(cur[c.id] || '')}</span>)}</div> : <div className="empty">لا خريطة — المصروفات «بلا قسم» كما كانت</div>}
    {pend.length > 0 && <div data-deptmap-pend style={{ marginTop: 10 }}><b style={{ fontSize: 12.5 }}>بانتظار تحديد القسم ({pend.length})</b>
      {pend.slice(0, 50).map(x => <div key={x.key} className="me-row" data-deptmap-item={x.key}><span className="me-a"><b>{x.cat} · <span className="num">{money(x.amount)}</span></b><small>{x.date} · {x.branchName}{x.note ? ' · ' + x.note : ''}</small></span>
        {canPost && <span className="row" style={{ gap: 4 }}><select className="sel" aria-label={'قسم المصروف ' + x.key} value={pick[x.key] || ''} onChange={e => setPick({ ...pick, [x.key]: e.target.value })}><option value="">— القسم —</option><option value={DEPT_SHARED}>مشترك</option>{L.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <button className="btn sm pri" onClick={() => savePick(x)} data-deptmap-pick>تحديد</button></span>}</div>)}</div>}
  </div>);
}
