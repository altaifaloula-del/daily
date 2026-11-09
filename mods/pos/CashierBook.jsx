/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Users, AlertTriangle, TrendingDown, TrendingUp, Printer, Eye, X, Store, Scale, Lock } from 'lucide-react';
import { Kpi, arDate, countedClosing, deficitCfg, fmtBalP, isoD, money, moneyP, printA4, sum } from '../../App.jsx';

export function CashierBook({ org, ops, me, myBranches, scoped }) {
  const [days, setDays] = useState(30);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const ids = new Set((myBranches || []).map(b => b.id));
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
  const from = (() => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); return isoD(d); })();
  const dcf = deficitCfg(org);
  const people = useMemo(() => {
    const P = {};
    const get = (name) => { const k = String(name || '').replace(/\s*\(إنهاء إداري\)\s*$/, '').trim() || 'غير معروف'; return P[k] = P[k] || { name: k, sh: [], cl: [], br: new Set() }; };
    (ops.posShifts || []).filter(s => s.status === 'closed' && ids.has(s.branchId) && (s.date || (s.openedAt || '').slice(0, 10)) >= from)
      .forEach(s => { const p = get(s.openedBy); p.sh.push(s); p.br.add(s.branchId); });
    (scoped?.closings || []).filter(c => countedClosing(c) && ids.has(c.branchId) && (c.date || '') >= from)
      .forEach(c => { const p = get(c.createdBy || c.managerName); p.cl.push(c); p.br.add(c.branchId); });
    return Object.values(P).map(p => {
      const shDiff = p.sh.map(s => r2(s.diff));
      const clVar = p.cl.map(c => r2(c.variance));
      const all = [...shDiff, ...clVar];
      const defs = all.filter(v => v < -0.004), surp = all.filter(v => v > 0.004);
      const sales = r2(sum(p.sh, s => s.total)), inv = sum(p.sh, s => Number(s.n) || 0);
      const n = all.length;
      const rate = n ? Math.round(defs.length / n * 100) : 0;
      const big = defs.filter(v => v < -dcf.max).length;
      const remote = p.sh.filter(s => s.remote).length;
      // الخطر: تكرار العجز بنسبة عالية مع عدد كافٍ من الحالات، أو عجز فوق الحد، أو إنهاءات إدارية متكررة
      const risk = (defs.length >= dcf.repeat && rate >= 30) || big > 0 ? 'high' : (defs.length >= 2 || remote >= 2) ? 'mid' : 'ok';
      const last = [...p.sh.map(s => s.date || (s.openedAt || '').slice(0, 10)), ...p.cl.map(c => c.date)].sort().slice(-1)[0] || '';
      return { ...p, branches: [...p.br].map(brName).filter(Boolean), n, shifts: p.sh.length, closings: p.cl.length, sales, inv, avgTicket: inv ? r2(sales / inv) : 0,
        defN: defs.length, defT: r2(sum(defs, v => v)), surN: surp.length, surT: r2(sum(surp, v => v)), worst: defs.length ? Math.min(...defs) : 0,
        net: r2(sum(all, v => v)), rate, big, remote, risk, last };
    }).sort((a, b) => ({ high: 0, mid: 1, ok: 2 }[a.risk] - { high: 0, mid: 1, ok: 2 }[b.risk]) || a.defT - b.defT);
  }, [ops.posShifts, scoped, days, org]);
  const shown = people.filter(p => !q.trim() || (p.name + ' ' + p.branches.join(' ')).includes(q.trim()));
  const hi = people.filter(p => p.risk === 'high');
  const riskAr = { high: 'يحتاج مراجعة', mid: 'متابعة', ok: 'سليم' };
  const P = sel && people.find(p => p.name === sel);
  const printBook = () => {
    const rows = people.map(p => `<tr><td>${p.name}</td><td>${p.branches.join('، ')}</td><td class="n">${p.shifts}</td><td class="n">${p.closings}</td><td class="n">${money(p.sales)}</td><td class="n">${p.defN}</td><td class="n ${p.defT < 0 ? 'neg' : ''}">${p.defT ? '(' + money(-p.defT) + ')' : '—'}</td><td class="n">${p.rate}%</td><td>${riskAr[p.risk]}</td></tr>`).join('');
    printA4(org, 'سجل الكاشير', 'آخر ' + days + ' يومًا · حد العجز ' + money(dcf.max),
      `<table><thead><tr><th>الكاشير</th><th>الفروع</th><th>ورديات</th><th>إغلاقات</th><th>مبيعات الورديات</th><th>حالات عجز</th><th>إجمالي العجز</th><th>نسبة العجز</th><th>التقييم</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="box">نسبة العجز = حالات العجز ÷ كل الورديات والإغلاقات المسجّلة باسمه. «يحتاج مراجعة» = ${dcf.repeat} حالات عجز أو أكثر بنسبة ≥ 30%، أو عجز فوق الحد.</div>`) || 0;
  };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[[7, 'أسبوع'], [30, '30 يومًا'], [90, '90 يومًا']].map(([d, l]) => <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>{l}</button>)}
      </div>
      <div className="grid g4">
        <Kpi label="الكاشيرية في الفترة" value={String(people.length)} sub={sum(people, p => p.shifts) + ' وردية · ' + sum(people, p => p.closings) + ' إغلاق'} icon={Users} color="#C8A24A" />
        <Kpi label="يحتاجون مراجعة" value={String(hi.length)} sub={hi.length ? hi.map(p => p.name).slice(0, 2).join('، ') : 'لا أحد'} icon={AlertTriangle} color={hi.length ? '#D9544D' : '#4FB286'} />
        <Kpi label="إجمالي العجز" value={moneyP(sum(people, p => p.defT))} sub={sum(people, p => p.defN) + ' حالة'} icon={TrendingDown} color="#D9544D" />
        <Kpi label="إجمالي الزيادة" value={money(sum(people, p => p.surT))} sub={sum(people, p => p.surN) + ' حالة — الزيادة المتكررة خلل أيضًا'} icon={TrendingUp} color="#5B93C4" />
      </div>
      <div className="card">
        <div className="card-h">
          <div className="card-t"><Users size={15} color="var(--brass)" />سجل الكاشير — آخر {days} يومًا</div>
          <div className="row" style={{ gap: 6 }}>
            <input className="inp" style={{ maxWidth: 220 }} placeholder="بحث بالاسم أو الفرع" value={q} onChange={e => setQ(e.target.value)} />
            <button className="btn sm" onClick={printBook}><Printer size={13} />طباعة</button>
          </div>
        </div>
        {shown.length === 0 ? <div className="empty">لا ورديات أو إغلاقات مسجّلة في الفترة.</div> : (
          <div className="cb-list">
            {shown.map(p => (
              <button key={p.name} type="button" className={'cb-row ' + p.risk + (sel === p.name ? ' on' : '')} onClick={() => setSel(sel === p.name ? null : p.name)}>
                <span className="cb-av">{p.name.trim().charAt(0)}</span>
                <span className="cb-id"><b>{p.name}</b><small>{p.branches.join('، ') || '—'} · آخر نشاط {p.last ? arDate(p.last) : '—'}</small></span>
                <span className="cb-m"><small>النشاط</small><b>{p.shifts} وردية · {p.closings} إغلاق</b></span>
                <span className="cb-m"><small>العجز{p.defN ? ' (' + p.defN + ' حالات)' : ''}</small><b className={'num' + (p.defT < 0 ? ' neg' : '')}>{p.defN ? moneyP(p.defT) : '—'}</b></span>
                <span className="cb-m"><small>نسبة العجز</small><b className="num">{p.n ? p.rate + '%' : '—'}</b></span>
                <span className={'cb-st ' + p.risk}>{riskAr[p.risk]}</span>
              </button>))}
          </div>)}
      </div>
      {P && (
        <div className="card">
          <div className="card-h"><div className="card-t"><Eye size={15} color="var(--brass)" />تفاصيل {P.name}</div><button className="btn sm gh" onClick={() => setSel(null)}><X size={13} /></button></div>
          <div className="grid g4" style={{ marginBottom: 10 }}>
            <Kpi label="مبيعات ورديات نقطة البيع" value={money(P.sales)} sub={P.inv + ' فاتورة · متوسط ' + money(P.avgTicket)} icon={Store} color="#4FB286" />
            <Kpi label="أسوأ عجز" value={P.worst ? moneyP(P.worst) : '—'} sub={P.big ? P.big + ' فوق الحد (' + money(dcf.max) + ')' : 'لا شيء فوق الحد'} icon={AlertTriangle} color={P.big ? '#D9544D' : '#C8A24A'} />
            <Kpi label="صافي الفروقات" value={moneyP(P.net)} sub={'عجز ' + P.defN + ' · زيادة ' + P.surN} icon={Scale} color={P.net < 0 ? '#D9544D' : '#4FB286'} />
            <Kpi label="إنهاءات إدارية" value={String(P.remote)} sub="ورديات أنهتها الإدارة عن بُعد" icon={Lock} color={P.remote ? '#E0A458' : '#4FB286'} />
          </div>
          <div className="tw"><table className="tb is-tb">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>الفرع</th><th style={{ textAlign: 'end' }}>المبيعات</th><th style={{ textAlign: 'end' }}>الفرق</th><th>ملاحظة</th></tr></thead>
            <tbody>
              {[...P.sh.map(s => ({ d: s.date || (s.openedAt || '').slice(0, 10), t: 'وردية نقطة بيع', b: brName(s.branchId), rev: s.total, v: r2(s.diff), note: s.remote ? 'إنهاء إداري' + (s.closeNote ? ': ' + s.closeNote : '') : (s.n ? s.n + ' فاتورة' : '') })),
                ...P.cl.map(c => ({ d: c.date, t: 'إغلاق يومي', b: c.branchName || brName(c.branchId), rev: c.totalRevenue, v: r2(c.variance), note: c.varianceReason || '' }))]
                .sort((a, b) => (b.d || '').localeCompare(a.d || '')).map((x, i) => (
                  <tr key={i} className={'is-line' + (x.v < -dcf.max ? ' bad' : '')}>
                    <td><span className="dt">{arDate(x.d)}</span></td><td>{x.t}</td><td>{x.b}</td>
                    <td className="is-amt"><span className="num">{money(x.rev)}</span></td>
                    <td className={'is-amt' + (x.v < 0 ? ' neg' : '')}><span className="num">{Math.abs(x.v) < 0.005 ? '✓ 0.00' : fmtBalP(x.v)}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--dim)' }}>{x.note}</td>
                  </tr>))}
            </tbody>
          </table></div>
        </div>)}
      <div className="note">المصدر: ورديات نقطة البيع المغلقة (باسم من فتحها، والفرق = المعدود − المتوقع) والإغلاقات اليومية المرحّلة/المعتمدة (باسم من أدخلها). «يحتاج مراجعة» = {dcf.repeat} حالات عجز أو أكثر بنسبة ≥ 30% من نشاطه، أو أي عجز فوق الحد ({money(dcf.max)}). هذا مؤشر للمراجعة لا حكم — راجع أسباب الفروقات المكتوبة.</div>
    </div>
  );
}
