/* v49.2 — MQ-037: ربحية الأصناف × الفروع × الفترات — من فواتير نقطة البيع الفعلية (المحرك profitMatrix في النواة) */
import React, { useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { Field, Kpi, makeXlsx, money, profitMatrix, today } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };

export function ProfitMatrix({ org, ops, myBranches }) {
  const td = today();
  const [f, setF] = useState({ from: addD(td, -89), to: td, by: 'month', br: '', view: 'product', q: '' });
  const brs = (myBranches || org.branches || []).filter(b => b.isActive !== false);
  const P = useMemo(() => profitMatrix(org, ops, { from: f.from, to: f.to, by: f.by, branchIds: f.br ? [f.br] : brs.map(b => b.id) }), [org, ops, f.from, f.to, f.by, f.br]);   // eslint-disable-line
  const pct = (v) => v == null ? '—' : v + '%';
  const rows = f.view === 'detail' ? P.rows : f.view === 'branch' ? P.byBranch : f.view === 'period' ? P.byPeriod : P.byProduct;
  const shown = f.q ? rows.filter(r => String(r.name || r.key).includes(f.q)) : rows;
  const exportX = () => {
    const head = ['الصنف', 'الفرع', 'الفترة', 'الكمية', 'الإيراد الصافي', 'التكلفة', 'مجمل الربح', 'هامش %', 'نسبة التكلفة %'];
    const body = P.rows.map(r => [r.name, r.branchName, r.period, r.qty, r.rev, r.cost ?? 'غير معروفة', r.gp ?? '', r.gpPct ?? '', r.foodPct ?? '']);
    const blob = makeXlsx([{ name: 'الربحية', rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ربحية_الأصناف_' + f.from + '_' + f.to + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <div className="grid" style={{ gap: 14 }} data-pmx>
      <div className="card">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="من"><input type="date" className="inp" aria-label="من تاريخ" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} /></Field>
          <Field label="إلى"><input type="date" className="inp" aria-label="إلى تاريخ" value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} /></Field>
          <Field label="الفترة"><select className="sel" aria-label="تجميع الفترة" value={f.by} onChange={e => setF(x => ({ ...x, by: e.target.value }))}><option value="day">يومي</option><option value="week">أسبوعي</option><option value="month">شهري</option></select></Field>
          <Field label="الفرع"><select className="sel" aria-label="الفرع" value={f.br} onChange={e => setF(x => ({ ...x, br: e.target.value }))}><option value="">كل الفروع</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <button className="btn" onClick={exportX} disabled={!P.rows.length}><Download size={14} />Excel</button>
        </div>
      </div>
      <div className="grid g4" style={{ gap: 10 }}>
        <Kpi label="الإيراد الصافي" value={money(P.tot.rev)} />
        <Kpi label="التكلفة (المعروفة)" value={money(P.tot.cost)} />
        <Kpi label="مجمل الربح" value={money(P.tot.gp)} sub={P.tot.gpPct != null ? 'هامش ' + P.tot.gpPct + '%' : ''} />
        <Kpi label="إيراد بلا تكلفة معروفة" value={money(P.tot.unknownRev)} sub="أصناف بلا وصفة أو مكوّن بلا تكلفة" />
      </div>
      {P.tot.unknownRev > 0 && <div className="note"><Info size={13} /> {money(P.tot.unknownRev)} من الإيراد لأصناف تكلفتها غير معروفة — لا يدخل في مجمل الربح ولا في الهامش، أكمل وصفاتها لتظهر.</div>}
      <div className="card">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          {[['product', 'حسب الصنف'], ['branch', 'حسب الفرع'], ['period', 'حسب الفترة'], ['detail', 'صنف × فرع × فترة']].map(([k, t]) => <button key={k} className={'btn sm' + (f.view === k ? ' pri' : ' gh')} onClick={() => setF(x => ({ ...x, view: k }))}>{t}</button>)}
          <input className="inp" style={{ width: 160, marginInlineStart: 'auto' }} aria-label="بحث في الربحية" placeholder="بحث…" value={f.q} onChange={e => setF(x => ({ ...x, q: e.target.value }))} />
        </div>
        <div className="tw"><table className="tb" data-pmxtable><thead><tr>
          {f.view === 'detail' ? <><th>الصنف</th><th>الفرع</th><th>الفترة</th></> : <th>{f.view === 'branch' ? 'الفرع' : f.view === 'period' ? 'الفترة' : 'الصنف'}</th>}
          <th>الكمية</th><th>الإيراد الصافي</th><th>التكلفة</th><th>مجمل الربح</th><th>الهامش</th>{f.view === 'detail' && <th>نسبة التكلفة</th>}</tr></thead><tbody>
          {shown.length ? shown.map((r, i) => <tr key={(r.productId || r.key) + '|' + (r.branchId || '') + '|' + (r.period || '') + i}>
            {f.view === 'detail' ? <><td>{r.name}</td><td>{r.branchName}</td><td className="num">{r.period}</td></> : <td>{r.name}</td>}
            <td className="num">{Math.round(r.qty * 100) / 100}</td><td className="num">{money(r.rev)}</td>
            <td className="num">{f.view === 'detail' ? (r.cost == null ? <span className="badge b-amber">غير معروفة</span> : money(r.cost)) : money(r.cost)}{f.view !== 'detail' && r.unknown > 0 && <div style={{ fontSize: 10.5, color: 'var(--amber)' }}>+ {money(r.unknown)} بلا تكلفة</div>}</td>
            <td className="num" style={{ color: (r.gp || 0) < 0 ? 'var(--rose)' : undefined }}><b>{r.gp == null ? '—' : money(r.gp)}</b></td><td className="num">{pct(r.gpPct)}</td>{f.view === 'detail' && <td className="num">{pct(r.foodPct)}</td>}</tr>)
            : <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--faint)', padding: 18 }}>لا مبيعات من نقطة البيع في الفترة</td></tr>}
        </tbody></table></div>
        <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>الإيراد = حصة كل صنف من صافي الفاتورة بعد الخصومات وقبل الضريبة، والمرتجعات مطروحة. التكلفة = تكلفة الوصفة بالمتوسط المرجّح حتى نهاية الفترة.</div>
      </div>
    </div>
  );
}
