/* v54.2 — المرحلة 3: «التوصيات المالية» — توصيات حتمية من الدفاتر والرقابة، لكلٍّ دليلها وطريقة حساب أثرها المتوقع؛ تُتبنّى إجراءً يُعتمد ويُقاس أثره الفعلي بعد التنفيذ. */
import React, { useMemo, useState } from 'react';
import { Lightbulb, Check } from 'lucide-react';
import { finRecs, REC_PRI, REC_DEPT, money, today, newAction, jeOwner, nowISO } from '../../App.jsx';
const RISK = { high: ['b-rose', 'مرتفعة'], medium: ['b-amber', 'متوسطة'], low: ['b-mint', 'منخفضة'] };

export function FinRecs({ org, ops, me, myBranches, commit, say }) {
  const [days, setDays] = useState(90); const to = today();
  const from = useMemo(() => { const d = new Date(to + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (days - 1)); return d.toISOString().slice(0, 10); }, [to, days]);
  const R = useMemo(() => { try { return finRecs(org, ops, { from, to }); } catch (e) { return { recs: [], err: e.message }; } }, [org, ops, from, to]);
  const allBr = (myBranches || []).length >= (org.branches || []).length;
  const adopted = new Map((ops.actions || []).filter(a => a.srcKey && a.status !== 'dismissed').map(a => [a.srcKey, a]));
  const adopt = async (r) => { if (adopted.has(r.key)) return say('متبنّاة سابقًا', 'no');
    const rec = newAction(me, { src: 'rec', srcKey: r.key, title: r.title, detail: r.problem + '\nالدليل: ' + r.evidence + '\nالسبب المرجّح: ' + r.cause + '\nالحل: ' + r.solution + '\nالجهة: ' + REC_DEPT[r.dept], due: r.due,
      rec: r.kind, expected: { amount: r.expected, method: r.method }, recMetric: { ...r.metric, days: (r.metric && r.metric.days) || 30 }, approval: jeOwner(me) ? 'approved' : 'pending' });
    if (jeOwner(me)) { rec.approvedBy = me.name; rec.approvedAt = nowISO(); }
    const ok = await commit(d => (d.actions || []).some(a => a.srcKey === r.key && a.status !== 'dismissed') ? d : ({ ...d, actions: [rec, ...(d.actions || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'تبنّى توصية مالية', details: r.title.slice(0, 160) });
    if (ok !== false) say('تُبنّيت التوصية إجراءً ✓ — تابعها في «الإجراءات والتوصيات»'); };
  if (!allBr) return <div className="card"><div className="empty">التوصيات المالية مبنية على دفاتر الشركة كلها — متاحة لمن يرى كل الفروع.</div></div>;
  return (
    <div className="grid" style={{ gap: 14 }} data-finrecs>
      <div className="card">
        <div className="card-t"><Lightbulb size={15} color="var(--brass)" />التوصيات المالية <small style={{ color: 'var(--dim)', fontWeight: 400 }}>من الدفاتر ونتائج الرقابة — الأثر المتوقع تقدير بطريقة معلنة، والفعلي يُقاس بعد التنفيذ</small></div>
        <div className="row" style={{ gap: 6, marginTop: 8 }}>{[30, 90, 180, 365].map(d => <button key={d} className={'btn sm ' + (days === d ? 'pri' : 'gh')} onClick={() => setDays(d)}>آخر {d} يومًا</button>)}</div>
        {R.quality && !R.quality.complete && <div className="note" style={{ marginTop: 8, fontSize: 12 }}>بيانات ناقصة: {R.quality.checks.filter(c => !c.ok).map(c => c.label).join('، ')} — التوصيات المعتمدة على المبيعات والسيولة لا تظهر حتى تكتمل.</div>}
      </div>
      {!R.recs.length && <div className="card"><div className="empty">لا توصيات في هذه الفترة.</div></div>}
      {R.recs.map(r => { const a = adopted.get(r.key); return (
        <div key={r.key} className="card" data-rec={r.kind}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span className={'badge ' + REC_PRI[r.priority][0]}>{REC_PRI[r.priority][1]}</span><span className={'badge ' + RISK[r.risk][0]}>مخاطرة {RISK[r.risk][1]}</span>
            <span className="badge b-dim">{REC_DEPT[r.dept]}</span><b style={{ fontSize: 14 }}>{r.title}</b></div>
          <div style={{ fontSize: 12.5, lineHeight: 1.9, marginTop: 6 }}>
            <div><b>المشكلة:</b> {r.problem}</div><div><b>الدليل:</b> {r.evidence}</div><div><b>السبب المرجّح:</b> {r.cause}</div><div><b>الحل:</b> {r.solution}</div>
            <div><b>الأثر المتوقع:</b> <span className="num">{money(r.expected)}</span> ر.س — <small>{r.method}</small></div><div><b>الموعد المقترح:</b> <span className="num">{r.due}</span></div></div>
          <div style={{ marginTop: 8 }}>{a ? <span className="badge b-mint" data-recadopted><Check size={11} /> متبنّاة — {a.approval === 'approved' ? 'معتمدة' : a.approval === 'rejected' ? 'مرفوضة' : 'بانتظار الاعتماد'}</span>
            : <button className="btn sm pri" data-recadopt onClick={() => adopt(r)}>تبنّي كإجراء</button>}</div>
        </div>); })}
    </div>);
}
