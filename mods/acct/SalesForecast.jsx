/* v38.8 — «توقع المبيعات»: لكل فرع توقع الأيام القادمة حسب يوم الأسبوع، بمدى متوقع ودقة مقيسة على الماضي
   المحرك في النواة (forecastSales) — يعمل في المتصفح بلا تكلفة. */
import React, { useMemo, useState } from 'react';
import { LineChart, TrendingUp, TrendingDown, Target, CalendarDays, Info } from 'lucide-react';
import { Kpi, arDate, forecastSales, money } from '../../App.jsx';

const DOW_S = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const accLbl = (m) => m == null ? ['b-dim', 'تحتاج 3 أسابيع على الأقل'] : m < 10 ? ['b-mint', 'دقيقة جدًا'] : m < 20 ? ['b-sky', 'جيدة'] : ['b-amber', 'تقريبية'];

// أعمدة الأيام القادمة: العمود = التوقع، والخط الرأسي = المدى المتوقع
function Bars({ days }) {
  if (!days.length) return null;
  const W = Math.max(280, days.length * 34), H = 120, max = Math.max(...days.map(d => d.hi)) || 1, bw = W / days.length;
  const y = (v) => H - 18 - v / max * (H - 26);
  return (
    <div className="fc-bars"><svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="التوقع اليومي">
      {days.map((d, i) => { const x = W - (i + 1) * bw + bw * 0.2, w = bw * 0.6, fri = d.dow === 5 || d.dow === 4;   // من اليمين: الأقرب أولًا
        return <g key={d.date}>
          <rect x={x} y={y(d.f)} width={w} height={H - 18 - y(d.f)} rx="3" fill={fri ? 'var(--brass)' : 'var(--sky)'} fillOpacity=".75" />
          <line x1={x + w / 2} x2={x + w / 2} y1={y(d.hi)} y2={y(d.lo)} stroke="currentColor" strokeOpacity=".5" />
          <text x={x + w / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity=".75">{DOW_S[d.dow]}</text>
        </g>; })}
    </svg></div>);
}
// الماضي: الفعلي (خط) مقابل ما كان النموذج سيتوقعه (متقطع)
function Fit({ past }) {
  if (past.length < 7) return null;
  const W = 280, H = 60, vals = past.flatMap(p => [p.actual, p.f]), max = Math.max(...vals), min = Math.min(...vals, 0);
  const x = (i) => W - 4 - i * (W - 8) / (past.length - 1), y = (v) => H - 4 - (v - min) / (max - min || 1) * (H - 8);
  return (
    <svg className="fc-fit" width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={past.map((p, i) => x(i) + ',' + y(p.f)).join(' ')} fill="none" stroke="var(--brass)" strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={past.map((p, i) => x(i) + ',' + y(p.actual)).join(' ')} fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth="1.5" />
    </svg>);
}

export function SalesForecast({ org, ops, myBranches }) {
  const [h, setH] = useState(7);
  const [open, setOpen] = useState(null);
  const F = useMemo(() => forecastSales(org, ops, { days: h, branchIds: (myBranches || []).map(b => b.id) }), [org, ops, myBranches, h]);
  const ready = F.branches.filter(b => b.days.length);
  const lastN = ready.reduce((s, b) => s + b.past.slice(-h).reduce((a, p) => a + p.actual, 0), 0);
  const chg = lastN > 0 ? Math.round((F.total - lastN) / lastN * 1000) / 10 : null;
  const mapes = ready.map(b => b.mape).filter(m => m != null).sort((a, b) => a - b);
  const medMape = mapes.length ? mapes[Math.floor(mapes.length / 2)] : null;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 6 }}>{[[7, 'الأسبوع القادم'], [14, 'أسبوعان']].map(([d, l]) => <button key={d} className={'btn sm' + (h === d ? ' pri' : ' gh')} onClick={() => setH(d)}>{l}</button>)}</div>
      <div className="grid g4">
        <Kpi label={'المبيعات المتوقعة (' + h + ' أيام)'} value={money(F.total)} sub={arDate(F.from) + ' ← ' + arDate(F.to)} icon={LineChart} color="#C8A24A" />
        <Kpi label={'مقابل آخر ' + h + ' أيام فعلية'} value={chg == null ? '—' : (chg > 0 ? '+' : '') + chg + '%'} sub={lastN ? money(lastN) + ' فعليًا' : 'لا بيانات'} icon={chg != null && chg < 0 ? TrendingDown : TrendingUp} color={chg != null && chg < 0 ? '#D9544D' : '#4FB286'} />
        <Kpi label="دقة التوقع (وسيط الفروع)" value={medMape == null ? '—' : (100 - medMape).toFixed(1) + '%'} sub={medMape == null ? 'تُقاس بعد 3 أسابيع من الإغلاقات' : 'متوسط الخطأ ' + medMape + '% على آخر 28 يومًا'} icon={Target} color="#5B93C4" />
        <Kpi label="فروع بتوقع" value={ready.length + '/' + F.branches.length} sub={F.branches.length - ready.length ? (F.branches.length - ready.length) + ' تحتاج تاريخًا أطول' : 'كل الفروع'} icon={CalendarDays} color="#9A7CC4" />
      </div>
      {!F.branches.length ? <div className="card"><div className="empty">لا فروع.</div></div> : F.branches.map(b => { const [ac, al] = accLbl(b.mape); const tr = b.days[0] ? b.days[0].trend : 0; return (
        <div key={b.id} className="card">
          <div className="card-h"><div className="card-t"><LineChart size={15} color="var(--brass)" />{b.name}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {b.days.length > 0 && <b className="num">{money(b.total)}</b>}
              <span className={'badge ' + ac}>{b.mape != null ? 'دقة ' + (100 - b.mape).toFixed(0) + '% — ' : ''}{al}</span>
              {tr ? <span className={'badge ' + (tr > 0 ? 'b-mint' : 'b-rose')} dir="ltr">{tr > 0 ? '▲ +' : '▼ '}{tr}%</span> : null}
            </div></div>
          {!b.days.length ? <div className="empty">لا يكفي التاريخ للتوقع — يلزم 3 أسابيع على الأقل من الإغلاقات المرحّلة لكل يوم من الأسبوع ({b.history} يومًا متاحة).</div> : <>
            <Bars days={b.days} />
            <button type="button" className="btn sm gh" onClick={() => setOpen(open === b.id ? null : b.id)}>{open === b.id ? 'إخفاء التفاصيل' : 'التفاصيل يومًا بيوم'}</button>
            {open === b.id && <>
              <div className="fc-rows">{b.days.map(d => <div key={d.date} className={'fc-row' + (d.dow === 4 || d.dow === 5 ? ' wk' : '')}>
                <span className="fc-d"><b>{d.dowAr}</b><small className="dt">{arDate(d.date)}</small></span>
                <span className="fc-v"><b className="num">{money(d.f)}</b><small className="num" dir="ltr">{Math.round(d.lo).toLocaleString('en-US')} – {Math.round(d.hi).toLocaleString('en-US')}</small></span>
              </div>)}</div>
              {b.past.length >= 7 && <div style={{ marginTop: 8 }}><div className="lbl">آخر {b.past.length} يومًا: الفعلي (خط متصل) مقابل ما كان سيُتوقع (متقطع)</div><Fit past={b.past} /></div>}
            </>}
          </>}
        </div>); })}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف يُحسب؟</b> لكل فرع ولكل يوم من الأسبوع: متوسط مرجّح لآخر 8 أسابيع (الأحدث أثقل) بعد استبعاد الأيام الشاذة، مضروبًا في اتجاه آخر 4 أسابيع مقابل الأربعة قبلها (مخفّفًا ومحصورًا بين −15% و+15%).
        المدى يضم نحو 80% من الأيام المعتادة. الدقة تُقاس باختبار رجعي على آخر 28 يومًا. المناسبات (رمضان، الأعياد، الإجازات) لا يعرفها النموذج مسبقًا — عدّل توقعاتك لها يدويًا.</div>
    </div>);
}
