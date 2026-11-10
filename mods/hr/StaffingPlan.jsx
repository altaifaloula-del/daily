/* v39.2 — «تخطيط العمالة من التوقع»: الموظفون المقترحون لكل وردية مقابل التعيين الحالي
   المحرك في النواة (staffingPlan). نسبة العمالة على صافي المبيعات بعد الضريبة (IFRS 15). */
import React, { useMemo, useState } from 'react';
import { Users, Settings, Check, Info, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { Field, Kpi, ROLES, arDate, money, staffingPlan } from '../../App.jsx';

export function StaffingPlan({ org, ops, me, myBranches, commitOrg, say }) {
  const [H, setH] = useState(7);
  const S = useMemo(() => staffingPlan(org, ops, { days: H, branchIds: (myBranches || []).map(b => b.id) }), [org, ops, myBranches, H]);
  const [bid, setBid] = useState(null);
  const B = S.branches.find(b => b.id === bid) || S.branches[0];
  const canCfg = ROLES[me?.role]?.scope === 'all';
  const [cf, setCf] = useState(null);
  if (!B) return <div className="card"><div className="empty">لا فروع.</div></div>;
  const saveCfg = async () => { const t = Number(cf.targetPct), m = Number(cf.minPerShift);
    if (!(t > 0 && t < 100)) return say('أدخل نسبة عمالة مستهدفة بين 1 و99', 'no');
    const ok = await commitOrg(d => ({ ...d, laborCfg: { ...(d.laborCfg || {}), targetPct: t, minPerShift: Math.max(0, Math.round(m) || 0) } }), { actionType: 'update', targetType: 'settings', targetId: 'laborCfg', need: 'edit', title: 'إعداد تخطيط العمالة', details: 'الهدف ' + t + '% · الحد الأدنى ' + m + ' لكل وردية' });
    if (ok !== false) { setCf(null); say('حُفظ ✓'); } };
  const days = B.days, short = B.short, over = B.over;
  const sugH = days.reduce((s, d) => s + d.sugH, 0), asgH = days.reduce((s, d) => s + d.asgH, 0), net = days.reduce((s, d) => s + d.net, 0);
  const asgPct = net > 0 && B.rate ? Math.round(asgH * B.rate / net * 1000) / 10 : null;
  const gapB = (g) => g == null ? null : g < 0 ? <span className="badge b-rose">نقص {-g}</span> : g > 0 ? <span className="badge b-amber">زيادة {g}</span> : <span className="badge b-mint">مطابق</span>;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {S.branches.length > 1 && <select className="inp sel" style={{ maxWidth: 220 }} value={B.id} onChange={e => setBid(e.target.value)}>{S.branches.map(b => <option key={b.id} value={b.id}>{b.name}{b.short ? ' (نقص ' + b.short + ')' : ''}</option>)}</select>}
        {[[7, 'الأسبوع القادم'], [14, 'أسبوعان']].map(([d, l]) => <button key={d} className={'btn sm' + (H === d ? ' pri' : ' gh')} style={{ flex: '0 0 auto' }} onClick={() => setH(d)}>{l}</button>)}
        {canCfg && <button className="btn sm gh" style={{ flex: '0 0 auto', marginInlineStart: 'auto' }} onClick={() => setCf(cf ? null : { targetPct: String(S.target), minPerShift: String(S.minPer) })}><Settings size={13} />الإعداد</button>}
      </div>
      {cf && <div className="card"><div className="grid g3" style={{ gap: 10 }}>
        <Field label="نسبة العمالة المستهدفة من صافي المبيعات %"><input className="inp n" inputMode="decimal" value={cf.targetPct} onChange={e => setCf(c => ({ ...c, targetPct: e.target.value }))} /></Field>
        <Field label="الحد الأدنى لكل وردية مفتوحة"><input className="inp n" inputMode="numeric" value={cf.minPerShift} onChange={e => setCf(c => ({ ...c, minPerShift: e.target.value.replace(/\D/g, '') }))} /></Field>
        <div style={{ alignSelf: 'end' }}><button className="btn pri" onClick={saveCfg}><Check size={14} />حفظ</button></div></div></div>}
      <div className="grid g4">
        <Kpi label="ساعات مقترحة" value={String(Math.round(sugH))} sub={'التعيين الحالي ' + Math.round(asgH) + ' ساعة'} icon={Clock} color="#5B93C4" />
        <Kpi label="نسبة العمالة بالتعيين الحالي" value={asgPct == null ? '—' : asgPct + '%'} sub={'الهدف ' + S.target + '% (' + S.targetSrc + ')'} icon={TrendingUp} color={asgPct == null ? '#9A7CC4' : asgPct > S.target * 1.1 ? '#D9544D' : asgPct < S.target * 0.8 ? '#E0A458' : '#4FB286'} />
        <Kpi label="ورديات بنقص" value={String(short)} sub={over + ' وردية بزيادة'} icon={AlertTriangle} color={short ? '#D9544D' : '#4FB286'} />
        <Kpi label="تكلفة الساعة" value={B.rate ? money(B.rate) : '—'} sub={B.emps + ' موظف' + (B.splh ? ' · إنتاجيتك ' + money(B.splh) + '/ساعة' : '')} icon={Users} color="#C8A24A" />
      </div>
      {B.notes.length > 0 && <div className="cf-notes">{B.notes.map((n, i) => <div key={i} className={'cf-note ' + n.sev}><span className={'badge ' + (n.sev === 'warn' ? 'b-amber' : 'b-dim')}>{n.sev === 'warn' ? 'تنبيه' : 'معلومة'}</span><span>{n.msg}</span></div>)}</div>}
      {days.map(d => (
        <div key={d.date} className="card sp-day">
          <div className="sp-h"><span><b>{d.dowAr}</b> <small className="dt">{arDate(d.date)}</small></span>
            <span className="sp-m">صافي متوقع <b className="num">{money(d.net)}</b>{d.needH != null ? <> · ميزانية <b className="num">{Math.round(d.needH)}</b> ساعة</> : null}{d.asgPct != null && d.asgH > 0 ? <> · بالتعيين <b className="num">{d.asgPct}%</b></> : null}</span></div>
          {!d.shifts.length ? <div className="empty" style={{ padding: 8 }}>{B.tpls ? 'لا ورديات مفعّلة في هذا اليوم' : 'أضف قوالب الورديات لتوزيع الاحتياج'}</div> : <div className="sp-rows">{d.shifts.map(s => (
            <div key={s.id} className={'sp-row' + (s.gap < 0 ? ' short' : s.gap > 0 ? ' over' : '')}>
              <span className="sp-a"><b>{s.name}</b><small className="num" dir="ltr">{s.startTime}–{s.endTime}</small><small>{s.share}% من مبيعات اليوم</small></span>
              <span className="sp-n"><small>مقترح</small><b className="num">{s.staff ?? '—'}</b></span>
              <span className="sp-n"><small>معيّن</small><b className="num">{s.assigned}</b></span>
              <span className="sp-g">{gapB(s.gap)}</span>
            </div>))}</div>}
        </div>))}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف يُحسب؟</b> ميزانية ساعات اليوم = صافي المبيعات المتوقعة بعد استبعاد ضريبة القيمة المضافة × نسبة العمالة المستهدفة ÷ تكلفة الساعة
        (الأجر والبدلات وحصة صاحب العمل في التأمينات ÷ {S.stdH} ساعة شهريًا). تُوزَّع على الورديات بحسب مبيعات كل ساعة من نقطة البيع لنفس يوم الأسبوع في آخر 28 يومًا (أو بطول الوردية)،
        ويُقرَّب عدد الموظفين مع حد أدنى {S.minPer} لكل وردية مفتوحة. «معيّن» من «محرّك الورديات ← التعيين الأسبوعي». المناسبات لا يعرفها التوقع — عدّل يدويًا.</div>
    </div>);
}
