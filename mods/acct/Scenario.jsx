/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { RefreshCw, Download, Compass, TrendingUp, TrendingDown, Landmark, Scale, FileText, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Field, Kpi, buildAccounting, chartTone, makeXlsx, money, monthLabel, short, sum, today } from '../../App.jsx';

export function Scenario({ org, ops, me, scoped, theme, say }) {
  const tn = chartTone(theme);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [sc, setSc] = useState({ revD: '', varD: '', fixD: '', brRev: '', brFix: '' });
  const num = (s) => Number(String(s).replace(/[^\d.-]/g, '')) || 0;

  const agg = useMemo(() => { const m = {}; A.entries.forEach(e => { if ((e.date || '').slice(0, 7) !== month) return; e.lines.forEach(l => { const x = m[l.code] || (m[l.code] = { d: 0, c: 0 }); x.d += l.debit; x.c += l.credit; }); }); return m; }, [A, month]);
  const accBal = (code, kind) => { const x = agg[code]; if (!x) return 0; return (kind === 'exp' || kind === 'asset') ? x.d - x.c : x.c - x.d; };
  const rev0 = r2(sum(A.accounts.filter(a => a.kind === 'rev'), a => accBal(a.code, 'rev')));
  const costClass = org.costClass || {};
  const isVarDefault = (code, name) => ['5301', '5302', '5198', '5150', '5199'].includes(code) || /مواد|مشتريات|بضاعة|خامات|طعام/.test(name || '');
  const expAccts = A.accounts.filter(a => a.kind === 'exp' && agg[a.code]).map(a => ({ code: a.code, name: a.name, amt: r2(accBal(a.code, 'exp')) }));
  const var0 = r2(sum(expAccts.filter(a => (costClass[a.code] || (isVarDefault(a.code, a.name) ? 'variable' : 'fixed')) === 'variable'), a => a.amt));
  const fix0 = r2(sum(expAccts.filter(a => (costClass[a.code] || (isVarDefault(a.code, a.name) ? 'variable' : 'fixed')) === 'fixed'), a => a.amt));
  const net0 = r2(rev0 - var0 - fix0);
  const varRatio0 = rev0 > 0.004 ? var0 / rev0 : 0;
  const be0 = (1 - varRatio0) > 0.0001 ? r2(fix0 / (1 - varRatio0)) : 0;
  const margin0 = rev0 > 0.004 ? r2(net0 / rev0 * 100) : 0;

  const revD = num(sc.revD), varD = num(sc.varD), fixD = num(sc.fixD), brRev = num(sc.brRev), brFix = num(sc.brFix);
  const rev1 = r2(rev0 * (1 + revD / 100) + brRev);
  const var1 = r2(var0 * (1 + revD / 100) * (1 + varD / 100) + brRev * varRatio0);
  const fix1 = r2(fix0 + fixD + brFix);
  const net1 = r2(rev1 - var1 - fix1);
  const varRatio1 = rev1 > 0.004 ? var1 / rev1 : 0;
  const be1 = (1 - varRatio1) > 0.0001 ? r2(fix1 / (1 - varRatio1)) : 0;
  const margin1 = rev1 > 0.004 ? r2(net1 / rev1 * 100) : 0;
  const dNet = r2(net1 - net0), dBe = r2(be1 - be0);
  const changed = revD || varD || fixD || brRev || brFix;

  const cmp = [
    ['الإيراد', rev0, rev1, true], ['التكاليف المتغيرة', var0, var1, false], ['التكاليف الثابتة', fix0, fix1, false],
    ['صافي الربح', net0, net1, true], ['هامش الربح %', margin0, margin1, true, true], ['نقطة التعادل', be0, be1, false]
  ];
  const preset = (patch) => setSc(s => ({ ...s, ...patch }));
  const reset = () => setSc({ revD: '', varD: '', fixD: '', brRev: '', brFix: '' });
  const chartData = [{ name: 'الإيراد', الحالي: rev0, السيناريو: rev1 }, { name: 'صافي الربح', الحالي: net0, السيناريو: net1 }];
  const exportSc = () => { try { const head = ['البند', 'الحالي', 'السيناريو', 'التغيّر']; const body = cmp.map(r => [r[0], r[4] ? r2(r[1]) : r[1], r[4] ? r2(r[2]) : r[2], r2(r[2] - r[1])]); const blob = makeXlsx([{ name: 'سيناريو ' + month, rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'سيناريو_' + month + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل السيناريو (Excel) ✓'); } catch (e) { say('تعذّر توليد Excel', 'no'); } };

  const L = (label, key, hint) => (
    <Field label={label}><input className="inp n" inputMode="decimal" value={sc[key]} placeholder="0" onChange={e => setSc(s => ({ ...s, [key]: e.target.value.replace(/[^\d.-]/g, '') }))} />
      {hint && <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>{hint}</div>}</Field>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>التخطيط والسيناريوهات (ماذا-لو)</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>حاكِ قراراتك قبل أن تتّخذها — انطلاقًا من أرقام {monthLabel(month)}</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="month" className="inp" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn sm gh" onClick={reset}><RefreshCw size={13} />تصفير</button>
          <button className="btn sm" onClick={exportSc}><Download size={13} />Excel</button>
        </div>
      </div>

      {rev0 <= 0.004 ? <div className="card"><div className="empty">لا إيراد في {monthLabel(month)} — اختر شهرًا فيه نشاط لتبني عليه سيناريوهاتك.</div></div> : <>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><Compass size={15} color="var(--brass)" />روافع القرار</div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn sm gh" onClick={() => preset({ revD: '5' })}>رفع الأسعار 5%</button>
            <button className="btn sm gh" onClick={() => preset({ varD: '-10' })}>خفض المواد 10%</button>
            <button className="btn sm gh" onClick={() => preset({ fixD: '5000' })}>توظيف (+5,000 ثابت)</button>
            <button className="btn sm gh" onClick={() => preset({ brRev: String(r2(rev0)), brFix: '10000' })}>فرع مماثل جديد</button>
          </div>
          <div className="grid g3" style={{ gap: 10 }}>
            {L('تغيّر الإيراد %', 'revD', 'رفع/خفض الأسعار أو الكميات (+ زيادة، − نقص)')}
            {L('تغيّر تكلفة المواد %', 'varD', 'تغيّر أسعار الموردين للوحدة')}
            {L('تغيّر التكاليف الثابتة (ر.س)', 'fixD', 'إيجار/توظيف إضافي (+) أو توفير (−)')}
            {L('إيراد فرع جديد شهريًا (ر.س)', 'brRev', 'بنفس هيكل تكاليف نشاطك الحالي')}
            {L('تكاليف الفرع الثابتة (ر.س)', 'brFix', 'إيجار ورواتب الفرع الجديد')}
          </div>
        </div>

        <div className="grid g3">
          <Kpi label="التغيّر في صافي الربح" value={(dNet >= 0 ? '+' : '') + money(dNet)} sub={changed ? 'شهريًا مقابل الحالي' : 'اضبط الروافع أعلاه'} icon={dNet >= 0 ? TrendingUp : TrendingDown} color={dNet >= 0 ? '#4FB286' : '#D9544D'} />
          <Kpi label="صافي ربح السيناريو" value={money(net1)} sub={'هامش ' + margin1 + '% (كان ' + margin0 + '%)'} icon={Landmark} color={net1 >= 0 ? '#4FB286' : '#D9544D'} />
          <Kpi label="نقطة التعادل الجديدة" value={money(be1)} sub={(dBe >= 0 ? 'ارتفعت ' : 'انخفضت ') + money(Math.abs(dBe))} icon={Scale} color={dBe <= 0 ? '#4FB286' : '#E0A458'} />
        </div>

        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><FileText size={15} color="var(--brass)" />الحالي مقابل السيناريو</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>البند</th><th style={{ textAlign: 'end' }}>الحالي</th><th style={{ textAlign: 'end' }}>السيناريو</th><th style={{ textAlign: 'end' }}>التغيّر</th></tr></thead>
                <tbody>
                  {cmp.map((r, i) => { const d = r2(r[2] - r[1]); const good = r[3] ? d >= 0 : d <= 0; const fmt = (v) => r[4] ? r2(v).toFixed(1) + '%' : money(v); return (
                    <tr key={i} style={r[0] === 'صافي الربح' ? { fontWeight: 800, background: 'rgba(200,162,74,.05)' } : null}>
                      <td>{r[0]}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{fmt(r[1])}</td>
                      <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{fmt(r[2])}</td>
                      <td className="num" style={{ textAlign: 'end', color: Math.abs(d) < 0.005 ? 'var(--dim)' : good ? 'var(--mint)' : '#D9544D' }}>{d > 0 ? '+' : ''}{fmt(d)}</td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 14 }}><BarChart3 size={15} color="var(--brass)" />المقارنة البيانية</div>
            <div style={{ height: 230, direction: 'ltr' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke={tn.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }} formatter={(v, n) => [money(v), n]} />
                  <Bar dataKey="الحالي" fill={tn.muted} radius={[5, 5, 0, 0]} />
                  <Bar dataKey="السيناريو" fill={tn.accent} radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="note">💡 المحاكاة تفترض أن التكاليف المتغيّرة تتحرّك مع النشاط (نسبتها من الإيراد ثابتة ما لم تغيّر «تكلفة المواد %»)، والثابتة تبقى ثابتة إلا بما تضيفه. الأرقام الأساسية من قيود {monthLabel(month)} وتصنيف تكاليفها في «تحليل التعادل». نتائج استرشادية للتخطيط.</div>
      </>}
    </div>
  );
}
