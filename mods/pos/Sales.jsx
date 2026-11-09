/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { CircleDollarSign, FileBarChart, ChevronDown, Printer, ClipboardCheck, Coins, CreditCard, Truck, BarChart3, Store } from 'lucide-react';
import { Kpi, countedClosing, money, printA4, sum } from '../../App.jsx';

export function Sales({ org, ops, me, myBranches, scoped, setTab, say }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [repOpen, setRepOpen] = useState(false);
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const cls = (scoped.closings || []).filter(c => countedClosing(c) && inRange(c.date));
  const delOf = (c) => sum(c.deliverySales || [], s => s.amount || 0);
  const totOf = (c) => (c.cashSales || 0) + (c.cardSales || 0) + delOf(c);
  const cash = sum(cls, c => c.cashSales || 0), card = sum(cls, c => c.cardSales || 0), del = sum(cls, delOf);
  const total = cash + card + del;
  const pct = (x) => total > 0 ? Math.round(x / total * 1000) / 10 : 0;
  const byBranch = myBranches.map(b => {
    const cs = cls.filter(c => c.branchId === b.id);
    return { id: b.id, name: b.name, n: cs.length, cash: sum(cs, c => c.cashSales || 0), card: sum(cs, c => c.cardSales || 0), del: sum(cs, delOf), total: sum(cs, totOf) };
  }).filter(x => x.n > 0).sort((a, b) => b.total - a.total);
  const byApp = (org.deliveryApps || []).map(a => ({ n: a.n, total: sum(cls, c => sum((c.deliverySales || []).filter(s => s.appId === a.id), s => s.amount || 0)) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  const days = [...new Set(cls.map(c => c.date))].length;
  const avgDay = days > 0 ? total / days : 0;
  const periodSub = (from || to) ? ((from || '…') + ' → ' + (to || '…')) : 'كل الفترات';

  const printSales = () => {
    const chan = `<table><thead><tr><th>القناة</th><th>المبلغ</th><th>النسبة</th></tr></thead><tbody>
      <tr><td>نقدي</td><td class="n">${money(cash)}</td><td class="n">${pct(cash)}%</td></tr>
      <tr><td>شبكة (مدى/بطاقات)</td><td class="n">${money(card)}</td><td class="n">${pct(card)}%</td></tr>
      <tr><td>تطبيقات التوصيل</td><td class="n">${money(del)}</td><td class="n">${pct(del)}%</td></tr>
      <tr class="tot"><td>الإجمالي</td><td class="n">${money(total)}</td><td class="n">100%</td></tr></tbody></table>`;
    const br = `<table><thead><tr><th>الفرع (نقطة البيع)</th><th>الإغلاقات</th><th>نقدي</th><th>شبكة</th><th>توصيل</th><th>الإجمالي</th></tr></thead><tbody>${byBranch.map(b => `<tr><td>${b.name}</td><td class="n">${b.n}</td><td class="n">${money(b.cash)}</td><td class="n">${money(b.card)}</td><td class="n">${money(b.del)}</td><td class="n">${money(b.total)}</td></tr>`).join('')}</tbody></table>`;
    printA4(org, 'تقرير المبيعات — نقاط البيع', periodSub + ' · ' + days + ' يوم', '<h3>حسب القناة</h3>' + chan + '<h3 style="margin-top:14px">حسب الفرع (نقطة البيع)</h3>' + br) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  const Seg = ({ v, c, label }) => total > 0 && v > 0 ? <div style={{ width: pct(v) + '%', background: c, height: 26, display: 'grid', placeItems: 'center', fontSize: 10, color: '#12100c', fontWeight: 700, minWidth: pct(v) > 8 ? 'auto' : 0, overflow: 'hidden' }} title={label + ' ' + money(v)}>{pct(v) >= 9 ? pct(v) + '%' : ''}</div> : null;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><CircleDollarSign size={17} /></span>المبيعات<small>مصدرها: نقاط البيع — الإغلاق اليومي</small></div>
        <div className="abar-sp" />
        <div className="abar-dd">
          <button className="btn sm" onClick={() => setRepOpen(o => !o)}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu"><div className="abar-hd">تقارير المبيعات</div>
              <button onClick={() => { setRepOpen(false); printSales(); }}><Printer size={13} />تقرير المبيعات (A4)</button>
            </div>
          </>)}
        </div>
        <button className="btn sm gh" onClick={() => setTab('closing')}><ClipboardCheck size={14} />نقاط البيع (الإغلاق)</button>
      </div>

      <div className="card"><div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>من</span><input type="date" className="inp" style={{ width: 150 }} value={from} onChange={e => setFrom(e.target.value)} />
        <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>إلى</span><input type="date" className="inp" style={{ width: 150 }} value={to} onChange={e => setTo(e.target.value)} />
        {(from || to) && <button className="btn sm gh" onClick={() => { setFrom(''); setTo(''); }}>كل الفترات</button>}
        <span className="badge b-dim" style={{ marginInlineStart: 'auto' }}>{cls.length} إغلاقًا معتمَدًا/مرحّلًا</span>
      </div></div>

      <div className="grid g4">
        <Kpi label="إجمالي المبيعات" value={money(total)} sub={days + ' يوم · متوسط ' + money(avgDay) + '/يوم'} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="نقدي" value={money(cash)} sub={pct(cash) + '% من المبيعات'} icon={Coins} color="#4FB286" />
        <Kpi label="شبكة (مدى/بطاقات)" value={money(card)} sub={pct(card) + '% من المبيعات'} icon={CreditCard} color="#5B93C4" />
        <Kpi label="تطبيقات التوصيل" value={money(del)} sub={pct(del) + '% من المبيعات'} icon={Truck} color="#E0A458" />
      </div>

      {total > 0 && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><BarChart3 size={15} color="var(--brass)" />توزيع المبيعات حسب القناة</div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <Seg v={cash} c="#4FB286" label="نقدي" /><Seg v={card} c="#5B93C4" label="شبكة" /><Seg v={del} c="#E0A458" label="توصيل" />
          </div>
          <div className="row" style={{ gap: 16, marginTop: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#4FB286', borderRadius: 2, marginInlineEnd: 5 }} />نقدي {money(cash)}</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#5B93C4', borderRadius: 2, marginInlineEnd: 5 }} />شبكة {money(card)}</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#E0A458', borderRadius: 2, marginInlineEnd: 5 }} />توصيل {money(del)}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><Store size={15} color="var(--brass)" />المبيعات حسب الفرع (نقطة البيع)</div>
        {byBranch.length === 0 ? <div className="empty">لا مبيعات معتمدة في هذه الفترة.</div> : (
          <div className="tw"><table className="tb">
            <thead><tr><th>الفرع</th><th>الإغلاقات</th><th>نقدي</th><th>شبكة</th><th>توصيل</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody>{byBranch.map(b => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600 }}>{b.name}</td>
                <td className="num">{b.n}</td>
                <td className="num">{money(b.cash)}</td>
                <td className="num">{money(b.card)}</td>
                <td className="num">{money(b.del)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{money(b.total)}</td>
                <td style={{ width: 90 }}><div style={{ height: 6, background: 'var(--ink)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: (total > 0 ? (b.total / byBranch[0].total * 100) : 0) + '%', height: '100%', background: 'var(--brass)' }} /></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {byApp.length > 0 && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><Truck size={15} color="var(--brass)" />مبيعات تطبيقات التوصيل</div>
          <div className="tw"><table className="tb">
            <thead><tr><th>التطبيق</th><th>المبيعات</th><th>النسبة من التوصيل</th></tr></thead>
            <tbody>{byApp.map((a, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{a.n}</td><td className="num">{money(a.total)}</td><td className="num">{del > 0 ? Math.round(a.total / del * 100) : 0}%</td></tr>)}</tbody>
          </table></div>
        </div>
      )}

      <div className="note">🔗 مصدر هذه الأرقام <b>نقاط البيع</b> = شاشة «الإغلاق اليومي» حيث يُدخل كل فرع مبيعاته اليومية (نقدي/شبكة/تطبيقات). المبيعات المعتمدة والمرحّلة فقط. اضغط «نقاط البيع (الإغلاق)» أعلاه لفتح المصدر.</div>
    </div>
  );
}
