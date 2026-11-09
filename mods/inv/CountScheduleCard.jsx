/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { ClipboardCheck, Check } from 'lucide-react';
import { COUNT_FREQ, Field, countCfgOf, countSchedule, money, roleEdit, today } from '../../App.jsx';

export function CountScheduleCard({ org, ops, me, commitOrg, say }) {
  const c = org.countCfg || {}; const canSet = roleEdit(me?.role);
  const [f, setF] = useState(null);
  const sch = countSchedule(org, ops);
  const save = async () => {
    const nn = (v, d) => { const x = Number(String(v ?? '').replace(/[^\d.]/g, '')); return String(v ?? '').trim() === '' || !Number.isFinite(x) ? d : x; };
    const next = { ...c, freq: f.freq || '', scope: f.scope || 'all', top: Math.max(5, Number(f.top) || 15), since: today(),
      tolPct: nn(f.tolPct, 3), tolVal: nn(f.tolVal, 25), dailyA: !!f.dailyA, aTop: Math.max(1, Math.round(nn(f.aTop, 5))), hideBook: f.hideBook !== false };
    const ok = await commitOrg(d => ({ ...d, countCfg: next }), { actionType: 'update', targetType: 'settings', targetId: 'countCfg', need: 'edit', title: next.freq ? 'جدولة الجرد الدوري' : 'إيقاف الجرد الدوري', details: next.freq ? COUNT_FREQ[next.freq].ar + ' · ' + (next.scope === 'top' ? 'أعلى ' + next.top + ' صنف قيمة' : 'كل الأصناف') : '' });
    if (ok) { setF(null); say(next.freq ? 'جُدول الجرد الدوري ✓ — تصل الفروع تنبيهات بموعدها' : 'أُوقف الجرد الدوري'); }
  };
  const ST = { over: ['متأخر', 'b-rose'], due: ['مستحق اليوم', 'b-amber'], soon: ['قريب', 'b-sky'], ok: ['في موعده', 'b-mint'] };
  return (
    <div className="card">
      <div className="card-h"><div className="card-t"><ClipboardCheck size={15} color="var(--brass)" />الجرد الدوري المجدول {sch ? <span className="badge b-mint" style={{ marginInlineStart: 8 }}>{COUNT_FREQ[c.freq].ar} · {c.scope === 'top' ? 'أعلى ' + (c.top || 15) + ' صنف قيمة' : 'كل الأصناف'}</span> : <span className="badge b-dim" style={{ marginInlineStart: 8 }}>غير مجدول</span>}</div>
        {canSet && !f && <button className="btn sm" onClick={() => { const k = countCfgOf(org); setF({ freq: c.freq || 'weekly', scope: c.scope || 'top', top: String(c.top || 15), tolPct: String(k.tolPct), tolVal: String(k.tolVal), dailyA: k.dailyA, aTop: String(k.aTop), hideBook: k.hideBook }); }}>{sch ? 'تعديل' : 'جدولة'}</button>}</div>
      {f && <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 10 }}>
        <Field label="التكرار" style={{ marginBottom: 0 }}><select className="sel" value={f.freq} onChange={e => setF(x => ({ ...x, freq: e.target.value }))}><option value="">موقوف</option>{Object.entries(COUNT_FREQ).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}</select></Field>
        <Field label="النطاق" style={{ marginBottom: 0 }}><select className="sel" value={f.scope} onChange={e => setF(x => ({ ...x, scope: e.target.value }))}><option value="top">الأصناف الأعلى قيمة</option><option value="all">كل الأصناف</option></select></Field>
        {f.scope === 'top' && <Field label="عددها" style={{ width: 90, marginBottom: 0 }}><input className="inp n" inputMode="numeric" value={f.top} onChange={e => setF(x => ({ ...x, top: e.target.value.replace(/\D/g, '') }))} /></Field>}
        <Field label="تسامح الفرق (ر.س)" style={{ width: 130, marginBottom: 0 }}><input className="inp n" inputMode="decimal" value={f.tolVal} onChange={e => setF(x => ({ ...x, tolVal: e.target.value }))} /></Field>
        <Field label="تسامح الفرق (%)" style={{ width: 120, marginBottom: 0 }}><input className="inp n" inputMode="decimal" value={f.tolPct} onChange={e => setF(x => ({ ...x, tolPct: e.target.value }))} /></Field>
        <label className="row" style={{ gap: 6, fontSize: 12.5, alignSelf: 'center' }}><input type="checkbox" checked={f.hideBook !== false} onChange={e => setF(x => ({ ...x, hideBook: e.target.checked }))} />إخفاء الكميات الدفترية عن موظفي الفروع</label>
        <label className="row" style={{ gap: 6, fontSize: 12.5, alignSelf: 'center' }}><input type="checkbox" checked={!!f.dailyA} onChange={e => setF(x => ({ ...x, dailyA: e.target.checked }))} />جرد يومي لأصناف A</label>
        {f.dailyA && <Field label="عدد أصناف A" style={{ width: 100, marginBottom: 0 }}><input className="inp n" inputMode="numeric" value={f.aTop} onChange={e => setF(x => ({ ...x, aTop: e.target.value.replace(/\D/g, '') }))} /></Field>}
        <button className="btn pri" onClick={save}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setF(null)}>إلغاء</button>
      </div>}
      {!f && (() => { const k = countCfgOf(org); return <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span className="badge b-dim">جرد أعمى · اعتماد شخص آخر</span>
        <span className={'badge ' + (k.hideBook ? 'b-mint' : 'b-amber')}>{k.hideBook ? 'الكميات الدفترية مخفية عن موظفي الفروع' : 'الكميات الدفترية ظاهرة للفروع'}</span>
        <span className="badge b-dim">إعادة عدّ عند فرق {money(k.tolVal)} فأكثر و{k.tolPct}% فأكثر</span>
        <span className={'badge ' + (k.dailyA ? 'b-mint' : 'b-dim')}>{k.dailyA ? 'جرد يومي لأعلى ' + k.aTop + ' أصناف قيمة (A)' : 'الجرد اليومي لأصناف A موقوف'}</span></div>; })()}
      {sch ? <div className="tw"><table className="tb">
        <thead><tr><th>المستودع</th><th>آخر جرد</th><th>الموعد التالي</th><th>الحالة</th></tr></thead>
        <tbody>{sch.map(x => <tr key={x.w.id}><td style={{ fontSize: 12.5 }}>{x.w.name}</td><td className="num" style={{ fontSize: 11.5 }}>{x.last || '—'}</td><td className="num" style={{ fontSize: 11.5 }}>{x.due}</td><td><span className={'badge ' + ST[x.st][1]}>{ST[x.st][0]}</span></td></tr>)}</tbody>
      </table></div> : <div className="note">جدولة الجرد ترسل للفروع تنبيهًا بموعد الجرد وتبرز الأصناف الأعلى قيمة لعدّها، فيُكتشف العجز مبكرًا بدل نهاية الشهر.</div>}
    </div>);
}
