/* v42.0 — «الدوران وفروق أسعار الشراء»: لمؤشرَي Inventory Turnover وPurchase Price Variance في وثيقة المتطلبات.
   المحركان في النواة (invTurnover / ppvReport). PPV بقرار المالك: مقابل آخر سعر دُفع للصنف نفسه. */
import React, { useMemo, useState } from 'react';
import { TrendingUp, Printer } from 'lucide-react';
import { Kpi, arDate, invTurnover, money, ppvReport, printA4, today } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const q = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sgn = (v) => (v > 0 ? '+' : '') + money(v);

export function TurnoverPpv({ org, ops }) {
  const td = today();
  const [from, setFrom] = useState(addD(td, -89));
  const [to, setTo] = useState(td);
  const [tab, setTab] = useState('turn');
  const T = useMemo(() => invTurnover(org, ops, { from, to }), [org, ops, from, to]);
  const P = useMemo(() => ppvReport(org, ops, { from, to }), [org, ops, from, to]);
  const print = () => {
    const per = arDate(from) + ' — ' + arDate(to);
    const body = tab === 'turn'
      ? `<table><thead><tr><th>الصنف</th><th>أول الفترة</th><th>آخر الفترة</th><th>المستهلك</th><th>تكلفة الاستهلاك</th><th>متوسط المخزون</th><th>الدوران</th><th>أيام التغطية</th></tr></thead><tbody>${T.rows.map(r => `<tr><td>${esc(r.name)}${r.idle ? ' (راكد)' : ''}</td><td class="n">${q(r.openQ)}</td><td class="n">${q(r.closeQ)}</td><td class="n">${q(r.useQ)} ${esc(r.unit)}</td><td class="n">${money(r.use)}</td><td class="n">${money(r.avgInv)}</td><td class="n">${r.turn ?? '—'}</td><td class="n">${r.days ?? '—'}</td></tr>`).join('')}</tbody></table>`
      : `<table><thead><tr><th>الصنف</th><th>التاريخ</th><th>المرجع</th><th>السعر السابق</th><th>السعر</th><th>الفرق %</th><th>الكمية</th><th>أثر الفرق</th></tr></thead><tbody>${P.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${l.date}</td><td>${esc(l.ref)}</td><td class="n">${money(l.prevUnit)}</td><td class="n">${money(l.unit)}</td><td class="n">${l.pct}%</td><td class="n">${q(l.qty)}</td><td class="n">${sgn(l.value)}</td></tr>`).join('')}</tbody></table>`;
    printA4(org, tab === 'turn' ? 'دوران المخزون' : 'فروق أسعار الشراء', per, body);
  };
  return (
    <div className="card" data-turnppv>
      <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="card-t"><TrendingUp size={15} color="var(--brass)" />الدوران وفروق أسعار الشراء</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input className="inp" type="date" aria-label="من" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} style={{ width: 150 }} />
          <input className="inp" type="date" aria-label="إلى" value={to} min={from} max={td} onChange={e => e.target.value && setTo(e.target.value)} style={{ width: 150 }} />
          <button className="btn sm gh" onClick={print}><Printer size={13} />طباعة</button>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginBottom: 10 }}>
        <button className={'btn sm' + (tab === 'turn' ? ' pri' : ' gh')} onClick={() => setTab('turn')}>دوران المخزون</button>
        <button className={'btn sm' + (tab === 'ppv' ? ' pri' : ' gh')} onClick={() => setTab('ppv')}>فروق أسعار الشراء</button>
      </div>
      {tab === 'turn' ? <>
        <div className="grid g4">
          <Kpi label="معدل الدوران" value={T.turn == null ? '—' : T.turn + '×'} sub={T.days + ' يومًا'} icon={TrendingUp} color="#C8A24A" />
          <Kpi label="أيام التغطية" value={T.daysOnHand == null ? '—' : T.daysOnHand + ' يومًا'} sub="المخزون يكفي" icon={TrendingUp} color="#5B93C4" />
          <Kpi label="تكلفة الاستهلاك" value={money(T.use)} sub="صرف + هدر + عجز جرد" icon={TrendingUp} color="#4FB286" />
          <Kpi label="مخزون راكد" value={money(T.idleValue)} sub="بلا استهلاك في الفترة" icon={TrendingUp} color="#D9544D" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', margin: '8px 0' }}>الدوران = تكلفة الاستهلاك ÷ متوسط قيمة المخزون (أول الفترة وآخرها) بمتوسط التكلفة المرجّح. التحويلات بين المستودعات ومرتجعات الموردين لا تُحتسب استهلاكًا.</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الصنف</th><th>المستهلك</th><th>تكلفة الاستهلاك</th><th>متوسط المخزون</th><th>الدوران</th><th>أيام التغطية</th></tr></thead>
          <tbody>{T.rows.map(r => <tr key={r.itemId}>
            <td><b>{r.name}</b>{r.idle && <span className="badge b-rose" style={{ marginInlineStart: 6 }}>راكد</span>}</td>
            <td className="num">{q(r.useQ)} {r.unit}</td><td className="num">{money(r.use)}</td><td className="num">{money(r.avgInv)}</td>
            <td className="num">{r.turn ?? '—'}</td><td className="num">{r.days ?? '—'}</td></tr>)}
            {!T.rows.length && <tr><td colSpan={6}><div className="empty">لا حركات مخزون في الفترة.</div></td></tr>}</tbody>
        </table></div>
      </> : <>
        <div className="grid g4">
          <Kpi label="دفعنا أكثر" value={money(P.up)} sub="ارتفاع عن السعر السابق" icon={TrendingUp} color="#D9544D" />
          <Kpi label="وفّرنا" value={money(P.down)} sub="انخفاض عن السعر السابق" icon={TrendingUp} color="#4FB286" />
          <Kpi label="صافي الفرق" value={sgn(P.net)} sub={P.lines.length + ' استلامًا'} icon={TrendingUp} color="#C8A24A" />
          <Kpi label="أصناف تغيّر سعرها" value={P.items.filter(g => g.value !== 0).length} sub={'من ' + P.items.length} icon={TrendingUp} color="#5B93C4" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', margin: '8px 0' }}>كل استلام شراء يُقارن بآخر سعر دُفع للصنف نفسه قبله (أي مورد) — الأثر = الفرق × الكمية بالوحدة الأساسية. أول شراء للصنف لا يُقارن.</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الصنف</th><th>التاريخ</th><th>السعر السابق</th><th>السعر</th><th>الفرق</th><th>الأثر</th></tr></thead>
          <tbody>{P.lines.map(l => <tr key={l.id}>
            <td><b>{l.name}</b><div style={{ fontSize: 11, color: 'var(--faint)' }}>{l.ref}</div></td><td className="num">{l.date}</td>
            <td className="num">{money(l.prevUnit)}</td><td className="num">{money(l.unit)}</td>
            <td className="num" style={{ color: l.diff > 0 ? 'var(--rose)' : l.diff < 0 ? 'var(--mint)' : undefined }}>{l.pct > 0 ? '+' : ''}{l.pct}%</td>
            <td className="num" style={{ fontWeight: 700, color: l.value > 0 ? 'var(--rose)' : l.value < 0 ? 'var(--mint)' : undefined }}>{sgn(l.value)}</td></tr>)}
            {!P.lines.length && <tr><td colSpan={6}><div className="empty">لا استلامات شراء مسبوقة بسعر للمقارنة في الفترة.</div></td></tr>}</tbody>
        </table></div>
      </>}
    </div>
  );
}
