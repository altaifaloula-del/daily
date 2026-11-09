/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { money, sum, supplierPrices } from '../../App.jsx';

export function PriceAlerts({ org, ops }) {
  const pcfg = org.purchaseCfg || {}; const pct = pcfg.priceAlertPct != null ? Number(pcfg.priceAlertPct) || 0 : 5;
  const itN = (id) => ((org.items || []).find(x => x.id === id) || {}).name || '';
  const flagged = [];
  (ops.purchaseOrders || []).forEach(po => (po.lines || []).forEach(l => { if (l.pAlert) flagged.push({ po, l }); }));
  flagged.sort((a, b) => String(b.po.at || b.po.date || '').localeCompare(String(a.po.at || a.po.date || '')));
  const P = supplierPrices(ops);
  const rising = Object.entries(P).map(([id, a]) => { const p3 = a.slice(1, 4); if (!p3.length) return null; const av = sum(p3, r => r.unitCost) / p3.length; const ch = av > 0 ? Math.round((a[0].unitCost - av) / av * 1000) / 10 : 0;
    return { id, name: itN(id) || 'صنف', last: a[0], av: Math.round(av * 100) / 100, n: p3.length, ch }; }).filter(x => x && pct > 0 && x.ch > pct).sort((a, b) => b.ch - a.ch);
  const ST = { pending: ['b-amber', 'بانتظار الاعتماد'], open: ['b-sky', 'معتمد'], partial: ['b-sky', 'استلام جزئي'], received: ['b-mint', 'مستلم'], rejected: ['b-rose', 'مرفوض'] };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="note">{pct > 0 ? 'يُنبَّه عند سعر أعلى من متوسط آخر 3 مشتريات للصنف بأكثر من ' + pct + '% — ويحتاج أمر الشراء اعتماد شخص غير منشئه.' : 'تنبيه الأسعار موقوف من إعدادات المشتريات.'}</div>
      <div className="card">
        <div className="card-h"><div className="card-t"><AlertTriangle size={15} color="var(--rose)" />بنود أوامر شراء بسعر مرتفع<span className="badge b-rose" style={{ marginInlineStart: 6 }}>{flagged.length}</span></div></div>
        {!flagged.length ? <div className="empty">لا بنود متجاوزة.</div> : <div className="tw"><table className="tb">
          <thead><tr><th>الأمر</th><th>المورد</th><th>البند</th><th style={{ textAlign: 'end' }}>السعر</th><th style={{ textAlign: 'end' }}>متوسط آخر 3</th><th style={{ textAlign: 'end' }}>الزيادة</th><th>الحالة</th></tr></thead>
          <tbody>{flagged.slice(0, 100).map(({ po, l }, i) => { const st = ST[po.status] || ['b-dim', po.status]; return <tr key={po.id + i}>
            <td><span className="num" style={{ fontSize: 11.5 }}>{po.poNo}</span><div style={{ fontSize: 10, color: 'var(--faint)' }}>{po.date} · {po.by}</div></td>
            <td style={{ fontSize: 12.5 }}>{po.supplierName}</td><td>{l.desc}</td>
            <td className="num" style={{ textAlign: 'end' }}>{money(l.pAlert.unit)}</td><td className="num" style={{ textAlign: 'end' }}>{money(l.pAlert.avg3)}</td>
            <td style={{ textAlign: 'end' }}><span className="badge b-rose num" dir="ltr">+{l.pAlert.pct}%</span></td>
            <td><span className={'badge ' + st[0]}>{st[1]}</span>{po.decidedBy ? <div style={{ fontSize: 10, color: 'var(--faint)' }}>{po.decidedBy}</div> : null}</td></tr>; })}</tbody>
        </table></div>}
      </div>
      <div className="card">
        <div className="card-h"><div className="card-t"><TrendingUp size={15} color="var(--brass)" />أصناف ارتفع آخر سعر شرائها</div></div>
        {!rising.length ? <div className="empty">لا ارتفاعات فوق الحد في آخر المشتريات المستلمة.</div> : <div className="tw"><table className="tb">
          <thead><tr><th>الصنف</th><th>آخر شراء</th><th style={{ textAlign: 'end' }}>آخر سعر</th><th style={{ textAlign: 'end' }}>متوسط ما قبله</th><th style={{ textAlign: 'end' }}>الزيادة</th></tr></thead>
          <tbody>{rising.map(r => <tr key={r.id}><td>{r.name}</td><td style={{ fontSize: 12 }}>{r.last.supplierName} · {r.last.date}</td>
            <td className="num" style={{ textAlign: 'end' }}>{money(r.last.unitCost)}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.av)}<div style={{ fontSize: 10, color: 'var(--faint)' }}>{r.n} شراء</div></td>
            <td style={{ textAlign: 'end' }}><span className="badge b-rose num" dir="ltr">+{r.ch}%</span></td></tr>)}</tbody>
        </table></div>}
      </div>
    </div>);
}
