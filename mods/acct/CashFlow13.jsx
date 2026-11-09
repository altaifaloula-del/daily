/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { Download, Check, Settings, AlertTriangle, CalendarDays, Banknote, TrendingUp, FileText } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { Field, Kpi, buildAccounting, buildPartners, chartTone, countedClosing, customerAging, isoD, makeXlsx, money, rolePost, short, sum, supplierAging, today } from '../../App.jsx';

export function CashFlow13({ org, ops, me, scoped, theme, commitOrg, say }) {
  const tn = chartTone(theme);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const num = (s) => Number(String(s).replace(/[^\d.-]/g, '')) || 0;
  const [cfg, setCfg] = useState(() => { const c = org.cashflowCfg || {}; return { wkSales: c.wkSales != null ? String(c.wkSales) : '', wkOpex: c.wkOpex != null ? String(c.wkOpex) : '', payroll: c.payroll != null ? String(c.payroll) : '', fixed: c.fixed != null ? String(c.fixed) : '', colWeeks: c.colWeeks != null ? String(c.colWeeks) : '4', startCash: c.startCash != null ? String(c.startCash) : '' }; });
  const canPost = rolePost(me?.role);

  const cash0 = r2(sum(A.accounts.filter(a => a.cash), a => a.balance));
  const counted = scoped.closings.filter(countedClosing);
  const cutoff = isoD(new Date(Date.now() - 56 * 86400000));
  const recent = counted.filter(c => (c.date || '') >= cutoff);
  const wkRevDef = recent.length ? r2(sum(recent, c => c.totalRevenue || 0) / 8) : 0;
  const wkExpDef = recent.length ? r2(sum(recent, c => c.totalExpenses || 0) / 8) : 0;
  const payrollDef = r2(sum(org.employees || [], e => (e.baseSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowance || 0)));
  const arTot = r2(sum(buildPartners(org, ops).filter(p => p.type === 'customer'), p => customerAging(p, today()).total));
  const apTot = r2(sum(buildPartners(org, ops).filter(p => p.type === 'supplier'), p => supplierAging(p, today()).total));

  const startCash = cfg.startCash !== '' ? num(cfg.startCash) : cash0;
  const wkSales = cfg.wkSales !== '' ? num(cfg.wkSales) : wkRevDef;
  const wkOpex = cfg.wkOpex !== '' ? num(cfg.wkOpex) : wkExpDef;
  const payroll = cfg.payroll !== '' ? num(cfg.payroll) : payrollDef;
  const fixed = num(cfg.fixed);
  const colWeeks = Math.min(13, Math.max(1, Math.round(num(cfg.colWeeks) || 4)));

  const weeks = useMemo(() => {
    const out = []; let bal = startCash; let lastMonth = null; const start = new Date();
    for (let w = 0; w < 13; w++) {
      const ws = new Date(start.getTime() + w * 7 * 86400000);
      const ym = ws.getFullYear() + '-' + ws.getMonth(); const newMonth = ym !== lastMonth; lastMonth = ym;
      const inAR = w < colWeeks ? r2(arTot / colWeeks) : 0, outAP = w < colWeeks ? r2(apTot / colWeeks) : 0;
      const outPay = newMonth ? payroll : 0, outFix = newMonth ? fixed : 0;
      const inflow = r2(wkSales + inAR), outflow = r2(wkOpex + outAP + outPay + outFix);
      const net = r2(inflow - outflow); bal = r2(bal + net);
      out.push({ label: ws.toISOString().slice(5, 10), inflow, outflow, net, bal, gap: bal < -0.004, pay: outPay > 0 });
    }
    return out;
  }, [startCash, wkSales, wkOpex, payroll, fixed, colWeeks, arTot, apTot]);

  const minBal = weeks.reduce((m, w) => Math.min(m, w.bal), startCash);
  const gapCount = weeks.filter(w => w.gap).length;
  const endBal = weeks.length ? weeks[12].bal : startCash;
  const chartData = [{ label: 'الآن', الرصيد: startCash }, ...weeks.map(w => ({ label: w.label, الرصيد: w.bal }))];

  const save = async () => { await commitOrg(d => ({ ...d, cashflowCfg: { wkSales: num(wkSales), wkOpex: num(wkOpex), payroll: num(payroll), fixed: num(fixed), colWeeks, startCash: num(startCash) } }), { actionType: 'update', targetType: 'tax_settings', targetId: 'cashflowCfg', need: 'post', title: 'حفظ إعداد التدفق النقدي', details: '13 أسبوعًا' }); say('حُفظ الإعداد ✓'); };
  const exportCF = () => { try { const head = ['الأسبوع', 'النقد الداخل', 'النقد الخارج', 'صافي الأسبوع', 'الرصيد النهائي']; const body = weeks.map(w => [w.label, w.inflow, w.outflow, w.net, w.bal]); const blob = makeXlsx([{ name: 'تدفق 13 أسبوعًا', rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'التدفق_النقدي_13أسبوع.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل التدفق (Excel) ✓'); } catch (e) { say('تعذّر توليد Excel', 'no'); } };

  const F = (label, key, ph, hint) => (
    <Field label={label}><input className="inp n" inputMode="decimal" value={cfg[key]} placeholder={ph} disabled={!canPost} onChange={e => setCfg(s => ({ ...s, [key]: e.target.value.replace(/[^\d.-]/g, '') }))} />
      {hint && <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 2 }}>{hint}</div>}</Field>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>التدفق النقدي المتدحرج — 13 أسبوعًا</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>توقّع النقد أسبوعًا بأسبوع لتكتشف فجوات السيولة قبل وقوعها</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={exportCF}><Download size={13} />Excel</button>
          {canPost && <button className="btn sm pri" onClick={save}><Check size={14} />حفظ الإعداد</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 10 }}><Settings size={15} color="var(--brass)" />الافتراضات (اتركها فارغة لاستخدام المبدئي من بياناتك)</div>
        <div className="grid g3" style={{ gap: 10 }}>
          {F('النقد الابتدائي', 'startCash', money(cash0), 'رصيدك النقدي الحالي')}
          {F('مبيعات أسبوعية متوقعة', 'wkSales', money(wkRevDef), 'متوسط آخر 8 أسابيع')}
          {F('مصروفات تشغيلية أسبوعية', 'wkOpex', money(wkExpDef), 'متوسط آخر 8 أسابيع')}
          {F('رواتب شهرية', 'payroll', money(payrollDef), 'مرّة كل شهر')}
          {F('التزامات ثابتة شهرية', 'fixed', '0', 'إيجار ونحوه — مرّة كل شهر')}
          {F('أسابيع تحصيل/سداد الذمم', 'colWeeks', '4', 'توزيع الذمم المدينة/الدائنة')}
        </div>
        <div className="note" style={{ marginTop: 8 }}>الذمم المدينة ({money(arTot)}) تُوزَّع تحصيلًا على أول {colWeeks} أسابيع، والدائنة ({money(apTot)}) سدادًا كذلك. الرواتب والثابتة مرّة عند بداية كل شهر.</div>
      </div>

      <div className="grid g3">
        <Kpi label="أدنى رصيد نقدي متوقّع" value={money(minBal)} sub={minBal < 0 ? 'عجز متوقّع!' : 'يبقى موجبًا'} icon={AlertTriangle} color={minBal < 0 ? '#D9544D' : minBal < startCash * 0.25 ? '#E0A458' : '#4FB286'} />
        <Kpi label="أسابيع العجز (رصيد سالب)" value={String(gapCount)} sub={gapCount ? 'تحتاج تدبير سيولة' : 'لا فجوات خلال 13 أسبوعًا'} icon={CalendarDays} color={gapCount ? '#D9544D' : '#4FB286'} />
        <Kpi label="الرصيد بعد 13 أسبوعًا" value={money(endBal)} sub={(endBal >= startCash ? 'أعلى من البداية' : 'أقل من البداية') + ' (' + money(startCash) + ')'} icon={Banknote} color={endBal >= 0 ? '#4FB286' : '#D9544D'} />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 14 }}><TrendingUp size={15} color="var(--brass)" />مسار الرصيد النقدي — إن هبط تحت الصفر فهناك فجوة</div>
        <div style={{ height: 240, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 6, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tn.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }} formatter={(v) => [money(v), 'الرصيد']} />
              <Line type="monotone" dataKey="الرصيد" stroke={minBal < 0 ? '#D9544D' : '#4FB286'} strokeWidth={2.4} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><FileText size={15} color="var(--brass)" />الجدول الأسبوعي</div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>الأسبوع (يبدأ)</th><th style={{ textAlign: 'end' }}>الداخل</th><th style={{ textAlign: 'end' }}>الخارج</th><th style={{ textAlign: 'end' }}>الصافي</th><th style={{ textAlign: 'end' }}>الرصيد</th><th style={{ textAlign: 'center' }}>الحالة</th></tr></thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={i} style={w.gap ? { background: 'rgba(217,84,77,.07)' } : null}>
                  <td className="num" style={{ fontSize: 11 }}>{w.label}{w.pay && <span className="badge b-sky" style={{ marginInlineStart: 6, fontSize: 9 }}>رواتب</span>}</td>
                  <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{money(w.inflow)}</td>
                  <td className="num" style={{ textAlign: 'end', color: '#D9544D' }}>{money(w.outflow)}</td>
                  <td className="num" style={{ textAlign: 'end', color: w.net >= 0 ? 'var(--mint)' : '#D9544D' }}>{w.net >= 0 ? '+' : ''}{money(w.net)}</td>
                  <td className="num" style={{ textAlign: 'end', fontWeight: 800, color: w.gap ? '#D9544D' : 'inherit' }}>{money(w.bal)}</td>
                  <td style={{ textAlign: 'center' }}>{w.gap ? <span className="badge b-rose">عجز</span> : <span className="badge b-mint">سليم</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="note">💡 تنبؤ استرشادي متدحرج من اليوم. المبيعات والمصروفات الأسبوعية مبدئيًا من متوسط آخر 8 أسابيع، والذمم من أعمارها، والرواتب والثابتة عند بداية كل شهر — عدّل أيّ افتراض ليعكس واقعك. راقب <b>أدنى رصيد</b> و<b>أسابيع العجز</b> لتدبّر السيولة مبكرًا.</div>
    </div>
  );
}
