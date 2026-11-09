/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { CheckCircle2, TrendingUp, Landmark, AlertTriangle, Bell, Clock, TrendingDown, ArrowUp, ArrowDown, BarChart3, Building2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Kpi, businessDay, chartTone, countedClosing, money, sum, today } from '../../App.jsx';

export function BranchCompare({ org, ops, me, myBranches, scoped, theme, setTab }) {
  const tn = chartTone(theme);
  const [day, setDay] = useState(businessDay());

  const rows = useMemo(() => myBranches.map(b => {
    const c = scoped.closings.find(x => countedClosing(x) && x.branchId === b.id && x.date === day);
    return {
      id: b.id, name: b.name,
      closed: !!c,
      status: c ? c.status : 'none',
      rev: c ? c.totalRevenue : 0,
      exp: c ? c.totalExpenses : 0,
      net: c ? c.totalRevenue - c.totalExpenses : 0,
      cash: c ? c.cashSales : 0,
      variance: c ? c.variance : 0,
      transfer: c ? c.transferredToMainTreasury : 0,
      shiftEnd: b.shiftEndTime || ''
    };
  }), [myBranches, scoped, day]);

  const closedCount = rows.filter(r => r.closed).length;
  const pendingRows = rows.filter(r => !r.closed);
  const deficitRows = rows.filter(r => r.closed && r.variance < 0);
  const totRev = sum(rows, r => r.rev);
  const totNet = sum(rows, r => r.net);
  const sorted = [...rows].filter(r => r.closed).sort((a, b) => b.rev - a.rev);
  const top = sorted[0], bottom = sorted[sorted.length - 1];

  // هل تأخّر فرع عن موعد إغلاقه؟
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = day === today();
  const late = (r) => {
    if (!isToday || r.closed || !r.shiftEnd) return false;
    const [h, m] = r.shiftEnd.split(':').map(Number);
    return nowMin > (h * 60 + m) + 30; // متأخر أكثر من 30 دقيقة
  };

  const barData = sorted.map(r => ({ name: r.name.replace('الفرع ', '').replace('فرع ', ''), الإيراد: r.rev, المصروف: r.exp }));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>مقارنة الفروع الفورية</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>نظرة شاملة على أداء كل الفروع في يوم واحد</div>
        </div>
        <input type="date" className="inp" style={{ width: 'auto' }} value={day} onChange={e => setDay(e.target.value)} />
      </div>

      <div className="grid g4">
        <Kpi label="فروع أغلقت" value={`${closedCount} / ${rows.length}`} icon={CheckCircle2} color="#4FB286" />
        <Kpi label="إجمالي الإيراد" value={money(totRev)} icon={TrendingUp} color="#C8A24A" />
        <Kpi label="صافي المجموعة" value={money(totNet)} icon={Landmark} color={totNet >= 0 ? '#4FB286' : '#D9544D'} />
        <Kpi label="فروع بعجز" value={deficitRows.length} icon={AlertTriangle} color={deficitRows.length ? '#D9544D' : '#4FB286'} />
      </div>

      {/* تنبيهات فورية */}
      {(pendingRows.length > 0 || deficitRows.length > 0) && (
        <div className="card" style={{ borderColor: 'rgba(224,164,88,.35)' }}>
          <div className="card-h"><div className="card-t"><Bell size={15} color="#E0A458" />تنبيهات اليوم</div></div>
          <div className="grid" style={{ gap: 8 }}>
            {pendingRows.map(r => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', background: late(r) ? 'rgba(217,84,77,.1)' : 'var(--ink)', borderRadius: 9, border: '1px solid ' + (late(r) ? 'rgba(217,84,77,.3)' : 'var(--line)') }}>
                <span className="row" style={{ gap: 8, fontSize: 12.5 }}>
                  {late(r) ? <AlertTriangle size={14} color="#D9544D" /> : <Clock size={14} color="#E0A458" />}
                  {r.name}
                </span>
                <span className="badge" style={{ color: late(r) ? '#D9544D' : '#E0A458', borderColor: 'currentColor', fontSize: 10 }}>
                  {late(r) ? 'متأخر عن الإغلاق' : 'لم يُغلق بعد'}{r.shiftEnd ? ' · ' + r.shiftEnd : ''}
                </span>
              </div>
            ))}
            {deficitRows.map(r => (
              <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(217,84,77,.1)', borderRadius: 9, border: '1px solid rgba(217,84,77,.3)' }}>
                <span className="row" style={{ gap: 8, fontSize: 12.5 }}><TrendingDown size={14} color="#D9544D" />{r.name}</span>
                <span className="badge" style={{ color: '#D9544D', borderColor: 'currentColor', fontSize: 10 }}>عجز صندوق <span className="num">{money(r.variance)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الأفضل والأضعف */}
      {closedCount > 1 && (
        <div className="grid g2">
          <div className="card" style={{ background: 'linear-gradient(135deg,rgba(79,178,134,.1),transparent)' }}>
            <div className="row" style={{ gap: 8, color: '#4FB286', fontSize: 12, marginBottom: 6 }}><ArrowUp size={15} />الأعلى إيراداً</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{top?.name}</div>
            <div className="num" style={{ fontSize: 22, color: '#4FB286', marginTop: 4 }}>{money(top?.rev || 0)}</div>
          </div>
          <div className="card" style={{ background: 'linear-gradient(135deg,rgba(217,84,77,.08),transparent)' }}>
            <div className="row" style={{ gap: 8, color: '#D9544D', fontSize: 12, marginBottom: 6 }}><ArrowDown size={15} />الأدنى إيراداً</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{bottom?.name}</div>
            <div className="num" style={{ fontSize: 22, color: '#D9544D', marginTop: 4 }}>{money(bottom?.rev || 0)}</div>
          </div>
        </div>
      )}

      {/* رسم بياني مقارن */}
      {barData.length > 0 && (
        <div className="card">
          <div className="card-h"><div className="card-t"><BarChart3 size={15} />الإيراد مقابل المصروف لكل فرع</div></div>
          <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 46)}>
            <BarChart data={barData} layout="vertical" margin={{ right: 12, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tn.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: tn.tick, fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: tn.tick, fontSize: 11 }} width={80} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 8, fontSize: 12, color: tn.tipTxt }} />
              <Bar dataKey="الإيراد" fill={tn.pos} radius={[0, 4, 4, 0]} />
              <Bar dataKey="المصروف" fill={tn.neg} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* جدول تفصيلي */}
      <div className="card">
        <div className="card-h"><div className="card-t"><Building2 size={15} />تفاصيل كل الفروع</div></div>
        <div className="tw">
          <table className="tb">
            <thead><tr>
              <th>الفرع</th><th>الحالة</th><th className="num">الإيراد</th><th className="num">المصروف</th>
              <th className="num">الصافي</th><th className="num">نقدي</th><th className="num">للخزينة</th><th className="num">الفرق</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    {!r.closed ? <span className="badge b-dim" style={{ fontSize: 10 }}>لم يُغلق</span>
                      : r.status === 'approved' ? <span className="badge b-mint" style={{ fontSize: 10 }}>معتمد</span>
                      : r.status === 'submitted' ? <span className="badge b-amber" style={{ fontSize: 10 }}>بانتظار</span>
                      : <span className="badge b-brass" style={{ fontSize: 10 }}>مغلق</span>}
                  </td>
                  <td className="num brass">{r.closed ? money(r.rev) : '—'}</td>
                  <td className="num rose">{r.closed ? money(r.exp) : '—'}</td>
                  <td className="num" style={{ color: r.net >= 0 ? '#4FB286' : '#D9544D' }}>{r.closed ? money(r.net) : '—'}</td>
                  <td className="num">{r.closed ? money(r.cash) : '—'}</td>
                  <td className="num">{r.closed ? money(r.transfer) : '—'}</td>
                  <td className="num" style={{ color: r.variance < 0 ? '#D9544D' : r.variance > 0 ? '#E0A458' : 'var(--dim)' }}>{r.closed ? money(r.variance) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
