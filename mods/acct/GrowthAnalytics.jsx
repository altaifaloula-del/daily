/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState, useEffect } from 'react';
import { Printer, Download, TrendingUp, CalendarDays, ArrowUp, BarChart3, Store } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, BarChart, Bar } from 'recharts';
import { GROWTH_MONTHS, Kpi, _xe, chartTone, countedClosing, makeXlsx, money, printA4, short, sum } from '../../App.jsx';

export function GrowthAnalytics({ org, ops, me, myBranches, scoped, setTab, theme, say }) {
  const tn = chartTone(theme);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const counted = useMemo(() => (scoped.closings || []).filter(countedClosing), [scoped]);

  // تجميع شهري: 'YYYY-MM' → {rev, exp, net, n}
  const monthly = useMemo(() => {
    const m = {};
    counted.forEach(c => {
      const key = (c.date || '').slice(0, 7); if (key.length !== 7) return;
      const x = m[key] || (m[key] = { rev: 0, exp: 0, n: 0 });
      x.rev += c.totalRevenue || 0; x.exp += c.totalExpenses || 0; x.n += 1;
    });
    Object.values(m).forEach(x => { x.rev = r2(x.rev); x.exp = r2(x.exp); x.net = r2(x.rev - x.exp); });
    return m;
  }, [counted]);

  const years = useMemo(() => { const s = new Set(); Object.keys(monthly).forEach(k => s.add(k.slice(0, 4))); return [...s].sort(); }, [monthly]);
  const hasData = years.length > 0;
  const latestYear = hasData ? years[years.length - 1] : String(new Date().getFullYear());
  const [selYear, setSelYear] = useState(latestYear);
  useEffect(() => { if (hasData && !years.includes(selYear)) setSelYear(latestYear); }, [years.join(',')]);

  const yr = years.includes(selYear) ? selYear : latestYear;
  const prevYr = String(Number(yr) - 1);
  const prevYearHasData = years.includes(prevYr);
  const cell = (y, mo) => monthly[y + '-' + String(mo).padStart(2, '0')];
  const monRev = (y, mo) => (cell(y, mo) || {}).rev || 0;
  const hasMon = (y, mo) => !!cell(y, mo);

  // نمو %: يعالج القسمة على صفر و«الجديد»
  const gpct = (cur, prev) => {
    if (prev > 0.005) { const v = r2((cur - prev) / prev * 100); return { txt: (v >= 0 ? '+' : '') + v.toFixed(1) + '%', up: v >= 0, has: true }; }
    if (cur > 0.005) return { txt: 'جديد', up: true, has: false };
    return { txt: '—', up: true, has: false };
  };

  // آخر شهر فيه بيانات في السنة المختارة (لمقارنة YTD المقابلة)
  let lastMo = 0; for (let mo = 1; mo <= 12; mo++) if (hasMon(yr, mo)) lastMo = mo;
  if (!lastMo) lastMo = 1;
  const ytdCur = r2(sum(Array.from({ length: lastMo }, (_, i) => monRev(yr, i + 1))));
  const ytdPrev = r2(sum(Array.from({ length: lastMo }, (_, i) => monRev(prevYr, i + 1))));
  const ytdG = gpct(ytdCur, ytdPrev);
  const curMoRev = monRev(yr, lastMo), prevMoRev = monRev(prevYr, lastMo);
  const moG = gpct(curMoRev, prevMoRev);

  const allMonths = Object.entries(monthly).map(([k, v]) => ({ k, rev: v.rev })).sort((a, b) => b.rev - a.rev);
  const bestMo = allMonths[0];
  const moLabel = (k) => k ? (GROWTH_MONTHS[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4)) : '—';

  const trendData = Object.keys(monthly).sort().map(k => ({ lbl: GROWTH_MONTHS[Number(k.slice(5, 7)) - 1].slice(0, 3) + ' ' + k.slice(2, 4), الإيراد: monthly[k].rev, الصافي: monthly[k].net }));
  const yoyData = Array.from({ length: 12 }, (_, i) => ({ lbl: GROWTH_MONTHS[i].slice(0, 3), [yr]: monRev(yr, i + 1), [prevYr]: monRev(prevYr, i + 1) }));

  const monthlyRows = Array.from({ length: 12 }, (_, i) => {
    const cur = monRev(yr, i + 1), prev = monRev(prevYr, i + 1);
    return { name: GROWTH_MONTHS[i], cur, prev, g: gpct(cur, prev), active: hasMon(yr, i + 1) || hasMon(prevYr, i + 1) };
  });
  const totCur = r2(sum(monthlyRows, r => r.cur)), totPrev = r2(sum(monthlyRows, r => r.prev));
  const totG = gpct(totCur, totPrev);

  const branchGrowth = useMemo(() => (myBranches || []).map(b => {
    const cur = r2(sum(counted.filter(c => c.branchId === b.id && (c.date || '').slice(0, 4) === yr), c => c.totalRevenue || 0));
    const prev = r2(sum(counted.filter(c => c.branchId === b.id && (c.date || '').slice(0, 4) === prevYr), c => c.totalRevenue || 0));
    return { name: b.name, cur, prev, g: gpct(cur, prev) };
  }).filter(x => x.cur > 0.005 || x.prev > 0.005).sort((a, b) => b.cur - a.cur), [myBranches, counted, yr, prevYr]);

  const GBadge = ({ g }) => (<span className="num" style={{ fontWeight: 800, color: !g.has ? 'var(--dim)' : g.up ? 'var(--mint)' : '#D9544D' }}>{g.has ? (g.up ? '▲ ' : '▼ ') : ''}{g.txt}</span>);
  const dlBlob = (name, blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); };

  const printGrowth = () => {
    const mrows = monthlyRows.filter(r => r.active).map(r => `<tr><td>${r.name}</td><td class="n">${money(r.cur)}</td><td class="n">${money(r.prev)}</td><td class="n">${r.g.txt}</td></tr>`).join('');
    const brows = branchGrowth.map(r => `<tr><td>${_xe(r.name)}</td><td class="n">${money(r.cur)}</td><td class="n">${money(r.prev)}</td><td class="n">${r.g.txt}</td></tr>`).join('');
    const body = `
    <div class="box">إجمالي ${yr}: <b>${money(totCur)}</b> · إجمالي ${prevYr}: <b>${money(totPrev)}</b> · النمو السنوي: <b>${totG.txt}</b></div>
    <h3 style="margin:10px 0 4px">المقارنة الشهرية (سنة بسنة)</h3>
    <table><thead><tr><th>الشهر</th><th class="n">${yr}</th><th class="n">${prevYr}</th><th class="n">النمو</th></tr></thead><tbody>${mrows}
    <tr class="tot"><td>الإجمالي</td><td class="n">${money(totCur)}</td><td class="n">${money(totPrev)}</td><td class="n">${totG.txt}</td></tr></tbody></table>
    ${brows ? `<h3 style="margin:14px 0 4px">نمو الفروع (سنة بسنة)</h3><table><thead><tr><th>الفرع</th><th class="n">${yr}</th><th class="n">${prevYr}</th><th class="n">النمو</th></tr></thead><tbody>${brows}</tbody></table>` : ''}`;
    printA4(org, 'تحليلات النمو والمقارنة السنوية', yr + ' مقابل ' + prevYr, body) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const exportGrowthXlsx = () => {
    try {
      const mh = ['الشهر', yr, prevYr, 'النمو'];
      const mr = monthlyRows.filter(r => r.active).map(r => [r.name, r.cur, r.prev, r.g.txt]);
      mr.push(['الإجمالي', totCur, totPrev, totG.txt]);
      const bh = ['الفرع', yr, prevYr, 'النمو'];
      const br = branchGrowth.map(r => [r.name, r.cur, r.prev, r.g.txt]);
      const blob = makeXlsx([{ name: 'مقارنة شهرية', rows: [mh, ...mr] }, { name: 'نمو الفروع', rows: [bh, ...br] }]);
      dlBlob('تحليلات_النمو_' + yr + '.xlsx', blob);
    } catch (e) { say('تعذّر توليد ملف Excel', 'no'); }
  };

  if (!hasData) return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div><h2 style={{ fontSize: 17 }}>تحليلات النمو والمقارنة السنوية</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>نموّ مبيعاتك عبر الزمن — سنة بسنة وشهر بشهر</div></div>
      </div>
      <div className="card"><div className="empty">لا توجد إغلاقات معتمدة بعد — تظهر التحليلات فور اعتماد أول إغلاق يومي.</div></div>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>تحليلات النمو والمقارنة السنوية</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>نموّ مبيعاتك عبر الزمن — سنة بسنة وشهر بشهر (من الإغلاقات المعتمدة)</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select className="inp" style={{ width: 'auto' }} value={yr} onChange={e => setSelYear(e.target.value)}>
            {[...years].reverse().map(y => <option key={y} value={y}>سنة {y}</option>)}
          </select>
          <button className="btn sm" onClick={printGrowth}><Printer size={13} />طباعة</button>
          <button className="btn sm" onClick={exportGrowthXlsx}><Download size={13} />Excel</button>
        </div>
      </div>

      {!prevYearHasData && <div className="note">ℹ️ لا توجد بيانات لسنة {prevYr} للمقارنة الكاملة — تظهر أرقام {yr} واتجاهها، وتكتمل المقارنة السنوية تلقائيًا عند توفّر سنة سابقة.</div>}

      <div className="grid g4">
        <Kpi label={'نمو ' + yr + ' (حتى ' + GROWTH_MONTHS[lastMo - 1] + ')'} value={ytdG.txt} sub={money(ytdCur) + ' مقابل ' + money(ytdPrev)} icon={TrendingUp} color={!ytdG.has ? '#7E7566' : ytdG.up ? '#4FB286' : '#D9544D'} />
        <Kpi label={'نمو شهر ' + GROWTH_MONTHS[lastMo - 1]} value={moG.txt} sub={money(curMoRev) + ' مقابل ' + money(prevMoRev)} icon={CalendarDays} color={!moG.has ? '#7E7566' : moG.up ? '#4FB286' : '#D9544D'} />
        <Kpi label="أعلى شهر مبيعات" value={money(bestMo.rev)} sub={moLabel(bestMo.k)} icon={ArrowUp} color="#C8A24A" />
        <Kpi label={'إجمالي مبيعات ' + yr} value={money(totCur)} sub={lastMo + ' من ٱثنَي عشر شهرًا مسجّلة'} icon={BarChart3} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 14 }}><TrendingUp size={15} color="var(--brass)" />اتجاه المبيعات والصافي الشهري</div>
        <div style={{ height: 240, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="lbl" tick={{ fill: tn.tick, fontSize: 9.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }} labelStyle={{ color: '#A2968A' }} formatter={(v, n) => [money(v), n]} />
              <Line type="monotone" dataKey="الإيراد" stroke={tn.accent} strokeWidth={2.4} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="الصافي" stroke={tn.pos} strokeWidth={1.8} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><BarChart3 size={15} color="var(--brass)" />المقارنة السنوية شهرًا بشهر</div>
          <div className="row" style={{ gap: 12, fontSize: 11 }}>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#C8A24A', display: 'inline-block' }} />{yr}</span>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#7E7566', display: 'inline-block' }} />{prevYr}</span>
          </div>
        </div>
        <div style={{ height: 240, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yoyData} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="lbl" tick={{ fill: tn.tick, fontSize: 9.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }} formatter={(v, n) => [money(v), 'سنة ' + n]} />
              <Bar dataKey={yr} fill={tn.accent} radius={[5, 5, 0, 0]} />
              <Bar dataKey={prevYr} fill={tn.muted} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><CalendarDays size={15} color="var(--brass)" />المقارنة الشهرية — {yr} مقابل {prevYr}</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الشهر</th><th style={{ textAlign: 'end' }}>{yr}</th><th style={{ textAlign: 'end' }}>{prevYr}</th><th style={{ textAlign: 'end' }}>النمو</th></tr></thead>
              <tbody>
                {monthlyRows.filter(r => r.active).map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{money(r.cur)}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{money(r.prev)}</td>
                    <td className="num" style={{ textAlign: 'end' }}><GBadge g={r.g} /></td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.05)' }}>
                  <td>الإجمالي</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(totCur)}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{money(totPrev)}</td>
                  <td className="num" style={{ textAlign: 'end' }}><GBadge g={totG} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><Store size={15} color="var(--brass)" />نمو الفروع — {yr} مقابل {prevYr}</div>
          {branchGrowth.length ? (
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>{yr}</th><th style={{ textAlign: 'end' }}>{prevYr}</th><th style={{ textAlign: 'end' }}>النمو</th></tr></thead>
                <tbody>
                  {branchGrowth.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{money(r.cur)}</td>
                      <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{money(r.prev)}</td>
                      <td className="num" style={{ textAlign: 'end' }}><GBadge g={r.g} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty">لا توجد بيانات فروع كافية للمقارنة.</div>}
        </div>
      </div>

      <div className="note">
        💡 الأرقام مبنيّة على <b>إجمالي إيراد الإغلاقات المعتمدة</b> ضمن نطاقك، مجمّعة شهريًا. «النمو» = تغيّر النسبة عن نفس الفترة من السنة السابقة؛
        يظهر «جديد» حين لا يوجد نظير في السنة السابقة، و«—» حين لا مبيعات في الطرفين.
      </div>
    </div>
  );
}
