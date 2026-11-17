/* v46.2 — كرت حركة الصنف: الوارد والصادر والرصيد التراكمي لكل مستودع أو للمنشأة، والاستهلاك النظري من المبيعات */
import React, { useMemo, useState } from 'react';
import { History, Printer } from 'lucide-react';
import { Modal, Field, MAIN_WH, itemLedger, isoD, today, whName, printA4 } from '../../App.jsx';

const whsOf = (org) => ((org && org.warehouses) || []).filter(w => w && w.active !== false);
const q3 = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export function ItemLedger({ org, ops, item, onClose }) {
  const d30 = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoD(d); })();
  const [whId, setWhId] = useState(''); const [from, setFrom] = useState(d30); const [to, setTo] = useState(today());
  const L = useMemo(() => itemLedger(org, ops, item.id, { whId, from, to }), [org, ops, item.id, whId, from, to]);
  const whs = whsOf(org);
  const wn = (w) => whName(org, w || MAIN_WH);
  const print = () => {
    const rows = L.rows.map(r => `<tr><td>${r.date}</td><td>${r.kind}</td><td>${wn(r.wh)}</td><td class="n">${r.q > 0 ? q3(r.q) : ''}</td><td class="n">${r.q < 0 ? q3(-r.q) : ''}</td><td class="n">${q3(r.bal)}</td><td>${r.ref || ''} ${r.note || ''}</td></tr>`).join('');
    printA4(org, 'كرت حركة الصنف — ' + item.name, (item.code || '') + ' · ' + item.name + ' · الوحدة: ' + (item.unit || '') + ' · ' + (whId ? wn(whId) : 'كل المستودعات') + ' · من ' + (from || '—') + ' إلى ' + (to || '—'), `
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>المستودع</th><th>وارد</th><th>صادر</th><th>الرصيد</th><th>المرجع</th></tr></thead>
      <tbody><tr><td colspan="5"><b>رصيد افتتاحي</b></td><td class="n"><b>${q3(L.open)}</b></td><td></td></tr>${rows}
      <tr><td colspan="3"><b>الإجمالي</b></td><td class="n"><b>${q3(L.qIn)}</b></td><td class="n"><b>${q3(L.qOut)}</b></td><td class="n"><b>${q3(L.close)}</b></td><td></td></tr></tbody></table>`);
  };
  return (
    <Modal title={'حركة الصنف — ' + item.name} icon={History} onClose={onClose} wide
      foot={<><button className="btn" onClick={print}><Printer size={14} />طباعة / PDF</button><button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }} data-ledgerfilter>
        <Field label="المستودع"><select className="sel" aria-label="مستودع الحركة" value={whId} onChange={e => setWhId(e.target.value)}>
          <option value="">كل المستودعات (المنشأة)</option>
          {(whs.length ? whs : [{ id: MAIN_WH, name: 'المستودع الرئيسي' }]).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select></Field>
        <Field label="من"><input type="date" className="inp" aria-label="من تاريخ" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="إلى"><input type="date" className="inp" aria-label="إلى تاريخ" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }} data-ledgersum>
        {[['رصيد افتتاحي', L.open], ['وارد', L.qIn], ['صادر', L.qOut], ['رصيد ختامي', L.close]].map(([l, v]) => (
          <div key={l} className="card" style={{ padding: 10, background: 'var(--ink)' }}><div style={{ fontSize: 11, color: 'var(--faint)' }}>{l}</div><div className="num" style={{ fontWeight: 700, fontSize: 16 }}>{q3(v)} <span style={{ fontSize: 11, color: 'var(--faint)' }}>{item.unit}</span></div></div>))}
      </div>
      <div className="tw">
        <table className="tb" data-ledger>
          <thead><tr><th>التاريخ</th><th>النوع</th><th>المستودع</th><th style={{ textAlign: 'end' }}>وارد</th><th style={{ textAlign: 'end' }}>صادر</th><th style={{ textAlign: 'end' }}>الرصيد</th><th>المرجع</th></tr></thead>
          <tbody>
            {L.rows.map((r, i) => (
              <tr key={i}>
                <td className="num" style={{ fontSize: 11.5 }}>{r.date}</td>
                <td><span className={'badge ' + (r.c || 'b-dim')}>{r.kind}</span></td>
                <td style={{ fontSize: 11.5 }}>{wn(r.wh)}</td>
                <td className="num" style={{ textAlign: 'end', color: 'var(--mint)' }}>{r.q > 0 ? q3(r.q) : ''}</td>
                <td className="num" style={{ textAlign: 'end', color: 'var(--rose)' }}>{r.q < 0 ? q3(-r.q) : ''}</td>
                <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{q3(r.bal)}</td>
                <td style={{ fontSize: 11, color: 'var(--dim)' }}>{r.ref}{r.note ? <div style={{ fontSize: 10, color: 'var(--faint)' }}>{r.note}{r.by ? ' · ' + r.by : ''}</div> : null}</td>
              </tr>))}
            {!L.rows.length && <tr><td colSpan={7}><div className="empty">لا حركات في هذه الفترة</div></td></tr>}
          </tbody>
        </table>
      </div>
      {L.transit.length > 0 && <div className="note" style={{ marginTop: 8 }} data-ledgertransit>🚚 في الطريق (لم يُستلم بعد): {L.transit.map(t => q3(t.q) + ' ' + (item.unit || '') + ' · ' + (t.ref || '') + ' إلى ' + wn(t.to)).join(' — ')}</div>}
      <div className="lbl" style={{ margin: '14px 0 6px' }}>المبيعات — الاستهلاك النظري من وصفات المنتجات المباعة</div>
      <div className="note" style={{ fontSize: 11, marginBottom: 6 }}>للمتابعة والمقارنة فقط: المبيعات لا تخصم من الرصيد تلقائيًا — الخصم الفعلي يكون بحركة «صرف للتشغيل» أو بالجرد.</div>
      <div className="tw">
        <table className="tb" data-ledgersales>
          <thead><tr><th>يوم البيع</th><th style={{ textAlign: 'end' }}>كمية المنتجات المباعة</th><th style={{ textAlign: 'end' }}>استهلاك الصنف ({item.unit})</th></tr></thead>
          <tbody>
            {L.salesRows.map(r => <tr key={r.date}><td className="num">{r.date}</td><td className="num" style={{ textAlign: 'end' }}>{q3(r.n)}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{q3(r.q)}</td></tr>)}
            {!L.salesRows.length && <tr><td colSpan={3}><div className="empty">لا مبيعات لمنتجات تدخل فيها هذه المادة في الفترة</div></td></tr>}
            {L.salesRows.length > 0 && <tr><td><b>الإجمالي</b></td><td /><td className="num" style={{ textAlign: 'end' }}><b>{q3(L.salesQ)}</b></td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>);
}
