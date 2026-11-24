/* v54.0 — المرحلة 1: «التحليل المالي المتقدم» — نِسَب متتبَّعة من الدفاتر (finAnalyze): المعادلة، الحسابات المصدرية، الفترة، المقارنة، المخاطرة، الإجراء.
   فحص اكتمال البيانات يظهر أولًا؛ النسبة التي تنقصها مدخلاتها لا تُحسب وتُذكر الأسباب. */
import React, { useMemo, useState } from 'react';
import { Scale, AlertTriangle, CheckCircle2, Download, Info } from 'lucide-react';
import { finAnalyze, money, today, exportExcel, Kpi } from '../../App.jsx';

const RISK = { low: ['b-mint', 'منخفضة'], medium: ['b-amber', 'متوسطة'], high: ['b-rose', 'مرتفعة'], na: ['b-dim', '—'] };
const ST = { ok: ['b-mint', 'محسوبة'], limited: ['b-amber', 'محدودة'], insufficient: ['b-rose', 'بيانات ناقصة'], undefined: ['b-dim', 'غير معرّفة'] };
const fmt = (r, v) => v == null ? '—' : r.unit === '%' ? (Math.round(v * 1000) / 10) + '%' : r.unit === 'SAR' ? money(v) : r.unit === 'times' ? (Math.round(v * 100) / 100) + ' مرة' : (Math.round(v * 100) / 100).toFixed(2) + '×';
const PRESETS = () => { const t = today(), y = t.slice(0, 4), m = t.slice(0, 7); const q = Math.floor((Number(t.slice(5, 7)) - 1) / 3) * 3 + 1;
  return [['month', 'هذا الشهر', m + '-01', t], ['quarter', 'هذا الربع', y + '-' + String(q).padStart(2, '0') + '-01', t], ['ytd', 'منذ بداية السنة', y + '-01-01', t], ['lastyear', 'السنة السابقة', (Number(y) - 1) + '-01-01', (Number(y) - 1) + '-12-31']]; };

export function FinIntel({ org, ops, myBranches }) {
  const P = PRESETS(); const [pr, setPr] = useState('ytd'); const [from, setFrom] = useState(P[2][2]); const [to, setTo] = useState(P[2][3]);
  const allBr = (myBranches || []).length >= (org.branches || []).length;
  const [bf, setBf] = useState(allBr ? '' : ((myBranches || [])[0] || {}).id || '');
  const [open, setOpen] = useState({});
  const F = useMemo(() => { try { return finAnalyze(org, ops, { from, to, bf }); } catch (e) { return { err: e.message }; } }, [org, ops, from, to, bf]);
  const pick = (k) => { const x = P.find(p => p[0] === k); setPr(k); if (x) { setFrom(x[2]); setTo(x[3]); } };
  if (F.err) return <div className="card"><div className="empty">تعذّر التحليل: {F.err}</div></div>;
  const Q = F.quality, S = F.statements; const grps = [...new Set(F.ratios.map(r => r.grp))];
  const xls = () => exportExcel('التحليل-المالي-' + from + '-' + to, 'التحليل المالي ' + from + ' — ' + to,
    ['المجموعة', 'النسبة', 'القيمة', 'الفترة السابقة', 'السنة السابقة', 'الحالة', 'المخاطرة', 'المعادلة', 'الحسابات المصدرية', 'الحد الإرشادي', 'القيود', 'الإجراء'],
    F.ratios.map(r => [r.grp, r.name, fmt(r, r.value), fmt(r, r.prev), fmt(r, r.yoy), ST[r.status][1], RISK[r.risk][1], r.formula, r.sources, r.benchmark, r.limits.join(' · '), r.action]),
    { meta: [['الفترة', from + ' — ' + to], ['النطاق', bf ? ((org.branches || []).find(b => b.id === bf) || {}).name || bf : 'كل الفروع'], ['اكتمال البيانات', Q.complete ? 'مكتملة' : 'ناقصة: ' + Q.checks.filter(c => !c.ok).map(c => c.label).join('، ')]] });
  return (
    <div className="grid" style={{ gap: 14 }} data-finintel>
      <div className="card">
        <div className="card-t"><Scale size={15} color="var(--brass)" />التحليل المالي المتقدم <small style={{ color: 'var(--dim)', fontWeight: 400 }}>من القيود المحاسبية — كل رقم بمعادلته ومصادره</small></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {P.map(p => <button key={p[0]} className={'btn sm ' + (pr === p[0] ? 'pri' : 'gh')} onClick={() => pick(p[0])}>{p[1]}</button>)}
          <input type="date" className="inp" style={{ maxWidth: 160 }} aria-label="من" value={from} onChange={e => { setPr(''); setFrom(e.target.value); }} />
          <input type="date" className="inp" style={{ maxWidth: 160 }} aria-label="إلى" value={to} onChange={e => { setPr(''); setTo(e.target.value); }} />
          <select className="sel" style={{ maxWidth: 220 }} aria-label="النطاق" value={bf} onChange={e => setBf(e.target.value)}>
            {allBr && <option value="">كل الفروع (الشركة)</option>}{allBr && <option value="central">المركز الرئيسي</option>}
            {(myBranches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <button className="btn sm ok" onClick={xls}><Download size={13} />Excel</button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 6 }}>المقارنة: الفترة السابقة {F.period.prev.from} — {F.period.prev.to} · السنة السابقة {F.period.yoy.from} — {F.period.yoy.to}</div>
      </div>

      <div className="card" data-faq>
        <div className="card-t" style={{ marginBottom: 6 }}>{Q.complete ? <CheckCircle2 size={15} color="var(--mint)" /> : <AlertTriangle size={15} color="var(--amber)" />}اكتمال البيانات {Q.complete ? '— مكتملة' : '— ناقصة: النِسَب المتأثرة لا تُحسب'}</div>
        {Q.checks.map(c => <div key={c.id} className="row" style={{ gap: 8, padding: '5px 0', fontSize: 12.5 }} data-faqc={c.id + ':' + (c.ok ? 1 : 0)}>
          <span className={'badge ' + (c.ok ? 'b-mint' : 'b-rose')}>{c.ok ? '✓' : '✗'}</span><b>{c.label}</b><span style={{ color: 'var(--dim)' }}>{c.detail}</span></div>)}
      </div>

      <div className="grid g3">
        <Kpi label="صافي المبيعات" value={money(S.netSales)} />
        <Kpi label="صافي الربح" value={money(S.net)} color={S.net >= 0 ? '#4FB286' : '#D9544D'} />
        <Kpi label="التدفق النقدي التشغيلي" value={money(S.operatingCashFlow)} sub="طريقة مباشرة تقريبية" />
      </div>

      {grps.map(g => <div key={g} className="card">
        <div className="card-t" style={{ marginBottom: 6 }}>{g}</div>
        <div className="tw"><table className="tb" style={{ fontSize: 12.5 }}><thead><tr><th>النسبة</th><th>القيمة</th><th>الفترة السابقة</th><th>السنة السابقة</th><th>الحالة</th><th>المخاطرة</th><th></th></tr></thead>
          <tbody>{F.ratios.filter(r => r.grp === g).map(r => <React.Fragment key={r.id}>
            <tr data-ratio={r.id}><td><b>{r.name}</b></td><td className="num" data-val>{fmt(r, r.value)}</td><td className="num">{fmt(r, r.prev)}</td><td className="num">{fmt(r, r.yoy)}</td>
              <td><span className={'badge ' + ST[r.status][0]}>{ST[r.status][1]}</span></td><td><span className={'badge ' + RISK[r.risk][0]}>{RISK[r.risk][1]}</span></td>
              <td><button className="btn sm gh" data-why onClick={() => setOpen(o => ({ ...o, [r.id]: !o[r.id] }))}><Info size={12} />{open[r.id] ? 'إخفاء' : 'كيف حُسبت'}</button></td></tr>
            {open[r.id] && <tr data-ratiox={r.id}><td colSpan={7} style={{ background: 'var(--ink)', fontSize: 12, lineHeight: 1.9 }}>
              <div><b>المعادلة:</b> {r.formula}</div><div><b>الحسابات المصدرية:</b> {r.sources}</div><div><b>الفترة:</b> {r.period.from} — {r.period.to}</div>
              <div><b>الحد الإرشادي:</b> {r.benchmark}</div><div><b>الشرح:</b> {r.explain}</div>
              {r.limits.length > 0 && <div style={{ color: 'var(--amber)' }}><b>القيود:</b> {r.limits.join(' · ')}</div>}
              {(r.risk === 'medium' || r.risk === 'high') && <div><b>الإجراء المقترح:</b> {r.action}</div>}
            </td></tr>}
          </React.Fragment>)}</tbody></table></div>
      </div>)}
      <div className="hint">الحدود الإرشادية عامة وقابلة للتعديل، وليست معايير رسمية. الأرقام من نفس القيود التي يبني منها النظام الميزان وقائمة الدخل.</div>
    </div>);
}
