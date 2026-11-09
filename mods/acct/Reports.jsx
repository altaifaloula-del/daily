/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { FileBarChart, FileText, ChevronDown, Printer, Download, CircleDollarSign, Receipt, TrendingUp, Landmark } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { A4_CSS, FinancialReports, Kpi, MZ_LOGO_HTML, arDT, arDate, chartTone, countedClosing, exportExcel, isoD, money, openDocWin, short, sum, today } from '../../App.jsx';

export function Reports({ org, ops, me, myBranches, scoped, say, theme }) {
  const [repOpen, setRepOpen] = useState(false);    // v9.5 قائمة تقارير التطبيق
  const tn = chartTone(theme);
  const [mode, setMode] = useState('ops');
  const d30 = new Date(); d30.setDate(d30.getDate() - 29);
  const [from, setFrom] = useState(isoD(d30));
  const [to, setTo] = useState(today());
  const [bid, setBid] = useState('all');

  const rows = scoped.closings.filter(c => countedClosing(c) && c.date >= from && c.date <= to && (bid === 'all' || c.branchId === bid));

  const byBranch = myBranches.filter(b => bid === 'all' || b.id === bid).map(b => {
    const bc = rows.filter(c => c.branchId === b.id);
    const rev = sum(bc, c => c.totalRevenue), exp = sum(bc, c => c.totalExpenses);
    const cash = sum(bc, c => c.cashSales), card = sum(bc, c => c.cardSales);
    const del = sum(bc, c => c.totalDeliverySales);
    const net = rev - exp;
    return {
      id: b.id, name: b.name, n: bc.length, rev, exp, cash, card, del, net,
      margin: rev ? (net / rev) * 100 : 0, varr: sum(bc, c => c.variance),
      vat: sum(bc, c => c.totalRevenue) * 15 / 115
    };
  });

  const T = {
    rev: sum(byBranch, x => x.rev), exp: sum(byBranch, x => x.exp),
    net: sum(byBranch, x => x.net), varr: sum(byBranch, x => x.varr), vat: sum(byBranch, x => x.vat)
  };

  const daily = useMemo(() => {
    const m = {};
    rows.forEach(c => { m[c.date] = (m[c.date] || 0) + c.totalRevenue - c.totalExpenses; });
    return Object.entries(m).sort().map(([d, v]) => ({ lbl: d.slice(5).replace('-', '/'), net: v }));
  }, [rows]);

  const exportCsv = () => {
    const head = ['الفرع', 'عدد الإغلاقات', 'الإيراد', 'المصروف', 'الصافي', 'الهامش%', 'نقدي', 'شبكة', 'تطبيقات', 'فروقات الصندوق', 'ض.القيمة المضافة'];
    const body = byBranch.map(b => [b.name, b.n, b.rev.toFixed(2), b.exp.toFixed(2), b.net.toFixed(2), b.margin.toFixed(1), b.cash.toFixed(2), b.card.toFixed(2), b.del.toFixed(2), b.varr.toFixed(2), b.vat.toFixed(2)]);
    const csv = '\uFEFF' + [head, ...body].map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `تقرير-الفروع-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل التقرير بصيغة CSV');
  };

  const exportXlsx = () => {
    const headers = ['الفرع', 'عدد الإغلاقات', 'الإيراد', 'المصروف', 'الصافي', 'الهامش %', 'نقدي', 'شبكة', 'تطبيقات', 'فروقات الصندوق', 'ض.القيمة المضافة'];
    const rows = byBranch.map(b => [b.name, b.n, +b.rev.toFixed(2), +b.exp.toFixed(2), +b.net.toFixed(2), +b.margin.toFixed(1), +b.cash.toFixed(2), +b.card.toFixed(2), +b.del.toFixed(2), +b.varr.toFixed(2), +b.vat.toFixed(2)]);
    const t = byBranch.reduce((a, b) => ({ n: a.n + b.n, rev: a.rev + b.rev, exp: a.exp + b.exp, net: a.net + b.net, cash: a.cash + b.cash, card: a.card + b.card, del: a.del + b.del, varr: a.varr + b.varr, vat: a.vat + b.vat }), { n: 0, rev: 0, exp: 0, net: 0, cash: 0, card: 0, del: 0, varr: 0, vat: 0 });
    exportExcel(`تقرير-الفروع-${from}_${to}`, `تقرير أداء الفروع`, headers, rows, {
      meta: [`${org.company.name || ''} · الرقم الضريبي: ${org.company.taxNumber || '—'}`, `الفترة: من ${from} إلى ${to}`],
      totals: ['الإجمالي', t.n, +t.rev.toFixed(2), +t.exp.toFixed(2), +t.net.toFixed(2), '', +t.cash.toFixed(2), +t.card.toFixed(2), +t.del.toFixed(2), +t.varr.toFixed(2), +t.vat.toFixed(2)]
    });
    say('تم تنزيل التقرير بصيغة Excel');
  };

  const printOps = () => {
    const co = org.company || {};
    const m = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const rows = byBranch.map(b => `<tr>
      <td>${b.name}</td><td class="num">${b.n}</td>
      <td class="num brass">${m(b.rev)}</td><td class="num">${m(b.cash)}</td>
      <td class="num">${m(b.card)}</td><td class="num">${m(b.del)}</td>
      <td class="num rose">${m(b.exp)}</td><td class="num mint">${m(b.net)}</td>
      <td class="num">${b.margin.toFixed(1)}%</td>
      <td class="num">${m(b.varr)}</td></tr>`).join('');
    const w = openDocWin('width=980,height=780');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير أداء الفروع</title><style>${A4_CSS}</style></head><body><div class="page">
      <div class="head">
        <div class="co">${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` :MZ_LOGO_HTML}
          <div><div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'}</div></div></div>
        <div class="doc-title">تقرير الأداء التشغيلي للفروع</div>
        <div class="doc-sub">من ${arDate(from)} إلى ${arDate(to)}</div>
      </div>
      <table class="t"><thead><tr>
        <th>الفرع</th><th class="num">إغلاقات</th><th class="num">الإيراد</th><th class="num">نقدي</th>
        <th class="num">شبكة</th><th class="num">تطبيقات</th><th class="num">المصروف</th>
        <th class="num">الصافي</th><th class="num">الهامش</th><th class="num">فروقات</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="tot"><td>الإجمالي</td><td class="num">${sum(byBranch, b => b.n)}</td>
        <td class="num brass">${m(T.rev)}</td><td class="num">${m(sum(byBranch, b => b.cash))}</td>
        <td class="num">${m(sum(byBranch, b => b.card))}</td><td class="num">${m(sum(byBranch, b => b.del))}</td>
        <td class="num rose">${m(T.exp)}</td><td class="num mint">${m(T.net)}</td><td>—</td>
        <td class="num">${m(T.varr)}</td></tr></tfoot></table>
      <div class="foot dim">تم التصدير آلياً من منصة ميزان · ${arDT(new Date())}</div>
      </div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  const Tabs = () => (
    <div className="row scroll-x">
      <button className={'btn sm' + (mode === 'ops' ? ' pri' : ' gh')} onClick={() => setMode('ops')}>
        <FileBarChart size={14} />الأداء التشغيلي
      </button>
      <button className={'btn sm' + (mode === 'pnl' ? ' pri' : ' gh')} onClick={() => setMode('pnl')}>
        <FileText size={14} />قائمة الدخل (يومي/شهري/سنوي)
      </button>
    </div>
  );

  if (mode === 'pnl') return (
    <div className="grid" style={{ gap: 14 }}>
      <Tabs />
      <FinancialReports org={org} ops={ops} myBranches={myBranches} scoped={scoped} say={say} />
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* شريط التطبيق — v9.5 */}
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><FileBarChart size={17} /></span>التقارير المالية<small>تقرير الفروع · التصدير · قائمة الدخل</small></div>
        <div className="abar-sp" />
        <div className="abar-dd">
          <button className="btn sm" onClick={() => setRepOpen(o => !o)}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">تقارير ومخرجات</div>
              <button onClick={() => { setRepOpen(false); printOps(); }}><Printer size={13} />طباعة تقرير الفروع</button>
              <button onClick={() => { setRepOpen(false); exportCsv(); }}><Download size={13} />تصدير CSV</button>
              <button onClick={() => { setRepOpen(false); exportXlsx(); }}><Download size={13} />تصدير Excel</button>
            </div>
          </>)}
        </div>
      </div>

      <Tabs />
      <div className="card">
        <div className="row">
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="lbl">من تاريخ</label>
            <input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label className="lbl">إلى تاريخ</label>
            <input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div style={{ flex: 1.4, minWidth: 170 }}>
            <label className="lbl">الفرع</label>
            <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">جميع الفروع ضمن صلاحيتي</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="row" style={{ alignSelf: 'flex-end' }}>
            <button className="btn pri" onClick={printOps}><FileText size={14} />طباعة (PDF)</button>
            <button className="btn" onClick={exportCsv}><Download size={14} />تصدير CSV</button>
            <button className="btn ok" onClick={exportXlsx}><FileBarChart size={14} />تصدير Excel</button>
          </div>
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="الإيرادات" value={money(T.rev)} sub={`${rows.length} إغلاق`} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="المصروفات" value={money(T.exp)} icon={Receipt} color="#D9544D" />
        <Kpi label="صافي الربح" value={money(T.net)} sub={`هامش ${T.rev ? ((T.net / T.rev) * 100).toFixed(1) : 0}%`} icon={TrendingUp} color="#4FB286" />
        <Kpi label="ض. القيمة المضافة المستحقة" value={money(T.vat)} sub="15% من الإيراد الشامل" icon={Landmark} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 14 }}><TrendingUp size={15} color="var(--brass)" />صافي الربح اليومي</div>
        <div style={{ height: 220, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="lbl" tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }}
                formatter={v => [money(v), 'الصافي']} />
              <Line type="monotone" dataKey="net" stroke={tn.pos} strokeWidth={2.2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 12 }}><FileBarChart size={15} color="var(--brass)" />قائمة أداء الفروع</div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>الفرع</th><th>إغلاقات</th><th>الإيراد</th><th>نقدي</th><th>شبكة</th><th>تطبيقات</th>
              <th>المصروف</th><th>الصافي</th><th>الهامش</th><th>فروقات</th>
            </tr></thead>
            <tbody>
              {byBranch.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</td>
                  <td className="num">{b.n}</td>
                  <td className="num" style={{ color: 'var(--brass)' }}>{money(b.rev)}</td>
                  <td className="num">{money(b.cash)}</td>
                  <td className="num">{money(b.card)}</td>
                  <td className="num">{money(b.del)}</td>
                  <td className="num" style={{ color: 'var(--rose)' }}>{money(b.exp)}</td>
                  <td className="num" style={{ color: 'var(--mint)', fontWeight: 600 }}>{money(b.net)}</td>
                  <td><span className={'badge ' + (b.margin > 25 ? 'b-mint' : b.margin > 12 ? 'b-amber' : 'b-rose')}>
                    <span className="num">{b.margin.toFixed(1)}%</span></span></td>
                  <td className="num" style={{ color: b.varr < 0 ? 'var(--rose)' : 'var(--faint)' }}>{money(b.varr)}</td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(200,162,74,.06)' }}>
                <td style={{ fontWeight: 700 }}>الإجمالي</td><td className="num">{sum(byBranch, b => b.n)}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--brass)' }}>{money(T.rev)}</td>
                <td className="num">{money(sum(byBranch, b => b.cash))}</td>
                <td className="num">{money(sum(byBranch, b => b.card))}</td>
                <td className="num">{money(sum(byBranch, b => b.del))}</td>
                <td className="num" style={{ color: 'var(--rose)' }}>{money(T.exp)}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--mint)' }}>{money(T.net)}</td>
                <td>—</td>
                <td className="num" style={{ color: T.varr < 0 ? 'var(--rose)' : 'var(--faint)' }}>{money(T.varr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
