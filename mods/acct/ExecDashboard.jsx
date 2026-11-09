/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo } from 'react';
import { Compass, CircleDollarSign, Wallet, TrendingUp, ArrowLeftRight, BarChart3, ChevronLeft, Users, Bell, FileBarChart } from 'lucide-react';
import { Kpi, buildAccounting, buildPartners, businessDay, countedClosing, money, stockByWh, sum, supplierAging, today } from '../../App.jsx';

export function ExecDashboard({ org, ops, me, myBranches, scoped, setTab, openAcctView, openInvView }) {
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const sups = useMemo(() => buildPartners(org, ops).filter(p => p.type === 'supplier'), [org, ops]);
  const td = today(); const ym = td.slice(0, 7);
  const r2 = (n) => Math.round(n * 100) / 100;
  const accByCode = {}; A.accounts.forEach(a => { accByCode[a.code] = a; });
  const goAcct = (v) => { setTab('acct'); openAcctView && openAcctView(v); };

  const cashNow = r2(sum(A.accounts.filter(a => a.cash), a => a.balance));
  const monAgg = {};
  A.entries.forEach(e => { if ((e.date || '').slice(0, 7) === ym && !e.closing) e.lines.forEach(l => { const x = monAgg[l.code] || (monAgg[l.code] = { d: 0, c: 0 }); x.d += l.debit; x.c += l.credit; }); });
  const mbal = (a) => { const x = monAgg[a.code] || { d: 0, c: 0 }; return (a.kind === 'asset' || a.kind === 'exp') ? x.d - x.c : x.c - x.d; };
  const monRev = r2(sum(A.accounts.filter(a => a.kind === 'rev'), mbal));
  const monExp = r2(sum(A.accounts.filter(a => a.kind === 'exp'), mbal));
  const monNet = r2(monRev - monExp);
  const monCash = r2(sum(A.accounts.filter(a => a.cash), mbal));

  const budgetOn = !!(org.budget && org.budget.enabled);
  const budLines = (org.budget && org.budget.lines) || [];
  const budExp = r2(sum(budLines.filter(l => (accByCode[l.code] || {}).kind === 'exp'), l => l.amount));
  const budRev = r2(sum(budLines.filter(l => (accByCode[l.code] || {}).kind === 'rev'), l => l.amount));
  const budNet = r2(budRev - budExp);

  const counted = scoped.closings.filter(countedClosing);
  const daySales = (d) => r2(sum(counted.filter(c => c.date === d), c => c.totalRevenue || 0));
  let salesDay = td, salesVal = daySales(td);
  if (salesVal <= 0 && counted.length) { salesDay = counted.map(c => c.date).sort().slice(-1)[0]; salesVal = daySales(salesDay); }
  const isToday = salesDay === td;

  const aged = sups.map(p => ({ p, ...supplierAging(p, td) })).filter(r => r.total > 0.004);
  const totOwed = r2(sum(aged, r => r.total));
  const tot90 = r2(sum(aged, r => r.b90));
  const topOverdue = aged.map(r => ({ name: r.p.name, over: r2(r.b30 + r.b60 + r.b90), total: r.total, b90: r.b90 }))
    .filter(x => x.over > 0.004).sort((a, b) => b.over - a.over).slice(0, 5);

  const totAssets = sum(A.accounts.filter(a => a.kind === 'asset'), a => a.balance);
  const totLiab = sum(A.accounts.filter(a => a.kind === 'liab'), a => a.balance);
  const netFixed = ((accByCode['1701'] || {}).balance || 0) + ((accByCode['1791'] || {}).balance || 0);
  const curAssets = r2(totAssets - netFixed);
  const currentRatio = totLiab > 0.005 ? curAssets / totLiab : null;
  const workingCap = r2(curAssets - totLiab);
  const monMargin = monRev > 0.005 ? monNet / monRev * 100 : null;

  const stockBal = stockByWh(org, ops).total;   // v29.9: كل المستودعات
  const lowStock = (org.items || []).filter(it => (Number(it.minQty) || 0) > 0 && (stockBal[it.id] || 0) < (Number(it.minQty) || 0));
  const bdT = businessDay();
  const deficitsToday = counted.filter(c => c.date === bdT && (c.variance || 0) < 0).length;

  const alerts = [];
  if (tot90 > 0.004) alerts.push({ sev: 'high', txt: 'ذمم موردين متأخرة أكثر من 90 يومًا: ' + money(tot90), go: () => goAcct('apage') });
  if (budgetOn && monExp > budExp + 0.005) alerts.push({ sev: 'high', txt: 'تجاوزت موازنة مصروفات الشهر بـ ' + money(r2(monExp - budExp)), go: () => goAcct('bud') });
  if (deficitsToday > 0) alerts.push({ sev: 'mid', txt: 'عجز صندوق في ' + deficitsToday + ' إغلاق اليوم', go: () => setTab('approve') });
  if (lowStock.length) alerts.push({ sev: 'mid', txt: lowStock.length + ' صنف تحت حد الأمان', go: () => setTab('inv') });
  if (currentRatio != null && currentRatio < 1) alerts.push({ sev: 'mid', txt: 'النسبة الجارية دون 1 (سيولة قصيرة الأجل ضعيفة)', go: () => goAcct('anl') });
  if (!budgetOn) alerts.push({ sev: 'low', txt: 'الموازنة غير مفعّلة — فعّلها لمقارنة الأداء بالمخطّط', go: () => goAcct('bud') });
  const sevCls = { high: 'b-rose', mid: 'b-amber', low: 'b-dim' };
  const sevTxt = { high: 'عاجل', mid: 'متابعة', low: 'اقتراح' };

  const pctTxt = (x) => x == null ? '—' : (Math.round(x * 10) / 10) + '%';
  const xTxt = (x) => x == null ? '—' : (Math.round(x * 100) / 100).toFixed(2) + '×';
  const budBar = (actual, plan, isExp) => {
    const max = Math.max(actual, plan, 1); const wA = Math.max(2, actual / max * 100), wP = Math.max(2, plan / max * 100);
    const over = isExp ? actual > plan + 0.005 : actual + 0.005 < plan;
    return (
      <div style={{ margin: '2px 0 8px' }}>
        <div style={{ height: 9, borderRadius: 5, width: wA + '%', background: over ? 'var(--rose)' : 'var(--mint)' }} />
        <div style={{ height: 5, borderRadius: 3, width: wP + '%', background: 'var(--frame-o)', marginTop: 2 }} />
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Compass size={17} /></span>اللوحة التنفيذية<small>حالة عملك بلمحة — {td}</small></div>
      </div>

      <div className="grid g4">
        <Kpi label={isToday ? 'مبيعات اليوم' : 'مبيعات آخر يوم (' + salesDay + ')'} value={money(salesVal)} sub={isToday ? td : 'لا مبيعات اليوم بعد'} icon={CircleDollarSign} color="#4FB286" />
        <Kpi label="النقد الآن (خزائن + بنك)" value={money(cashNow)} sub="الرصيد الدفتري الحالي" icon={Wallet} color="#C8A24A" />
        <Kpi label="صافي ربح الشهر" value={money(monNet)} sub={'إيراد ' + money(monRev) + ' − مصروف ' + money(monExp)} icon={TrendingUp} color={monNet >= 0 ? '#4FB286' : '#D9544D'} />
        <Kpi label="التغيّر النقدي هذا الشهر" value={money(monCash)} sub={monCash >= 0 ? 'دخول صافٍ' : 'خروج صافٍ'} icon={ArrowLeftRight} color={monCash >= 0 ? '#4FB286' : '#E0A458'} />
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><div className="card-t"><BarChart3 size={15} color="var(--brass)" />الربح مقابل الموازنة — {ym}</div>
            <button className="btn sm gh" onClick={() => goAcct('bud')}>الموازنة<ChevronLeft size={13} /></button></div>
          {budgetOn ? (
            <div style={{ marginTop: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--dim)' }}>الإيراد — فعلي {money(monRev)} · هدف {money(budRev)}</span></div>
              {budBar(monRev, budRev, false)}
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: 'var(--dim)' }}>المصروف — فعلي {money(monExp)} · موازنة {money(budExp)}</span></div>
              {budBar(monExp, budExp, true)}
              <div className="row" style={{ justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--line)', fontWeight: 800 }}>
                <span>صافي الربح — فعلي مقابل مخطّط</span>
                <b className="num" style={{ color: monNet + 0.005 >= budNet ? 'var(--mint)' : 'var(--rose)' }}>{money(monNet)} / {money(budNet)}</b>
              </div>
            </div>
          ) : <div className="note" style={{ marginTop: 8 }}>الموازنة غير مفعّلة. فعّلها من «المحاسبة ← الموازنة» لتقارن ربح الشهر بالمخطّط هنا.</div>}
        </div>

        <div className="card">
          <div className="card-h"><div className="card-t"><TrendingUp size={15} color="var(--mint)" />أهم النِسَب والمركز</div>
            <button className="btn sm gh" onClick={() => goAcct('anl')}>التحليل<ChevronLeft size={13} /></button></div>
          <div style={{ marginTop: 6 }}>
            {[['هامش ربح الشهر', pctTxt(monMargin), monMargin == null ? null : monMargin >= 0 ? 'var(--mint)' : 'var(--rose)'],
              ['النسبة الجارية', xTxt(currentRatio), currentRatio == null ? null : currentRatio >= 1 ? 'var(--mint)' : 'var(--amber)'],
              ['رأس المال العامل', money(workingCap), workingCap >= 0 ? 'var(--mint)' : 'var(--rose)'],
              ['إجمالي المستحق للموردين', money(totOwed), totOwed > 0.004 ? 'var(--amber)' : 'var(--mint)']].map(([l, v, c]) => (
              <div key={l} className="row" style={{ justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>{l}</span><b className="num" style={{ fontSize: 12.5, color: c || 'var(--txt)' }}>{v}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-h"><div className="card-t"><Users size={15} color="var(--brass)" />أعلى الموردين المتأخرين</div>
            <button className="btn sm gh" onClick={() => goAcct('apage')}>الأعمار<ChevronLeft size={13} /></button></div>
          <div className="tw" style={{ marginTop: 6 }}>
            <table className="tb">
              <thead><tr><th>المورد</th><th style={{ textAlign: 'end' }}>متأخر</th><th style={{ textAlign: 'end' }}>الإجمالي</th></tr></thead>
              <tbody>
                {topOverdue.map(s => (
                  <tr key={s.name}><td style={{ fontSize: 12.5 }}>{s.name}{s.b90 > 0.004 && <span className="badge b-rose" style={{ marginInlineStart: 6, fontSize: 9.5 }}>+90</span>}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{money(s.over)}</td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(s.total)}</td></tr>
                ))}
                {topOverdue.length === 0 && <tr><td colSpan={3}><div className="empty">لا موردين متأخرين — أحسنت.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><div className="card-t"><Bell size={15} color="var(--brass)" />تنبيهات سريعة</div>
            <button className="btn sm gh" onClick={() => setTab('alerts')}>عرض الكل<ChevronLeft size={13} /></button></div>
          <div className="grid" style={{ gap: 7, marginTop: 6 }}>
            {alerts.map((a, i) => (
              <button key={i} className="row" onClick={a.go} style={{ justifyContent: 'space-between', gap: 8, background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 9, padding: '9px 11px', cursor: 'pointer', textAlign: 'start' }}>
                <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}><span className={'badge ' + sevCls[a.sev]} style={{ fontSize: 9.5, flexShrink: 0 }}>{sevTxt[a.sev]}</span>{a.txt}</span>
                <ChevronLeft size={14} style={{ flexShrink: 0, color: 'var(--faint)' }} />
              </button>
            ))}
            {alerts.length === 0 && <div className="empty">لا تنبيهات — كل شيء ضمن المسار ✓</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', marginInlineEnd: 4 }}>انتقال سريع:</span>
          <button className="btn sm gh" onClick={() => goAcct('cf')}><ArrowLeftRight size={13} />التدفقات النقدية</button>
          <button className="btn sm gh" onClick={() => goAcct('bud')}><BarChart3 size={13} />الموازنة</button>
          <button className="btn sm gh" onClick={() => goAcct('anl')}><TrendingUp size={13} />التحليل والنِسَب</button>
          <button className="btn sm gh" onClick={() => goAcct('apage')}><Users size={13} />أعمار الموردين</button>
          <button className="btn sm gh" onClick={() => goAcct('fs')}><FileBarChart size={13} />القوائم المالية</button>
          <button className="btn sm gh" onClick={() => setTab('sales')}><CircleDollarSign size={13} />المبيعات</button>
        </div>
      </div>
    </div>
  );
}
