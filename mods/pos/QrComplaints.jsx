/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Timer, Check, PenLine } from 'lucide-react';
import { QR_ITEMS, QR_STATUS, qrDate, qrF1, qrIsComplaint, qrOverall, qrOverdue, qrStatusOf } from '../../App.jsx';

export function QrComplaints({ scopeFb, nb, upd, ro, me, loading }) {
  const [filter, setFilter] = useState('open');
  const all = scopeFb.filter(qrIsComplaint);
  const list = all.filter(c => filter === 'all' || (filter === 'open' ? qrStatusOf(c) !== 'resolved' : qrStatusOf(c) === 'resolved'));
  const note = (text) => ({ by: me.name || '', at: Date.now(), text });
  const setStatus = (c, status) => upd(c, (f) => ({
    status,
    ...(status === 'resolved' ? { resolvedAt: f.serverTimestamp() } : {}),
    notes: f.arrayUnion(note('تغيير الحالة إلى «' + QR_STATUS[status].ar + '»'))
  }), status === 'resolved' ? 'أُغلقت الشكوى ✓' : 'بدأت معالجة الشكوى ✓');
  const addNote = (c) => {
    const text = (window.prompt('ملاحظة على الشكوى:') || '').trim().slice(0, 500);
    if (text) upd(c, (f) => ({ notes: f.arrayUnion(note(text)) }), 'أُضيفت الملاحظة ✓');
  };

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 6 }}>
        {[['open', 'مفتوحة'], ['resolved', 'محلولة'], ['all', 'الكل']].map(([k, l]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' pri' : ' gh')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {!loading && !list.length && <div className="card"><div className="empty">لا توجد شكاوى هنا. تُفتح تذكرة تلقائيًا عند كل تقييم متوسطه أقل من 3 نجوم.</div></div>}
      {list.map(c => {
        const st = qrStatusOf(c);
        const low = QR_ITEMS.filter(i => (Number(c.ratings && c.ratings[i.key]) || 0) <= 2);
        return (
          <div key={c.id} className="card" style={{ fontSize: 12.5 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div><b style={{ direction: 'ltr', display: 'inline-block' }}>#{c.id.slice(0, 6).toUpperCase()}</b> · {nb(c.branchId)} · <span className="num">{qrF1(qrOverall(c))}</span> <span style={{ color: '#D9A441' }}>★</span></div>
              <div className="row" style={{ gap: 5 }}>
                {qrOverdue(c) && <span className="badge b-rose">تجاوز مهلة 24 ساعة</span>}
                <span className={'badge ' + QR_STATUS[st].badge}>{QR_STATUS[st].ar}</span>
              </div>
            </div>
            {c.comment && <div style={{ marginTop: 6, color: 'var(--dim)' }}>«{c.comment}»</div>}
            {low.length > 0 && (
              <div className="row" style={{ gap: 4, marginTop: 6 }}>
                {low.map(i => <span key={i.key} className="badge b-amber">{i.label}: {c.ratings[i.key]}</span>)}
              </div>
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--faint)' }}>
              {qrDate(c.createdAt)}{c.tableNo ? ' · طاولة ' + c.tableNo : ''}{c.invoiceNo ? ' · فاتورة ' + c.invoiceNo : ''}
              {c.ai && c.ai.issue && c.ai.issue !== '—' ? ' · ' + c.ai.issue + ' (أهمية ' + c.ai.severity + '/5)' : ''}
            </div>
            {Array.isArray(c.notes) && c.notes.length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--dim)' }}>
                {c.notes.slice().sort((a, b) => (a.at || 0) - (b.at || 0)).map((n, i) => (
                  <div key={i}>• {n.text} — {n.by}{n.at ? ' · ' + qrDate(n.at) : ''}</div>
                ))}
              </div>
            )}
            {!ro && st !== 'resolved' && (
              <div className="row" style={{ gap: 6, marginTop: 10 }}>
                {st === 'new' && <button className="btn sm gh" onClick={() => setStatus(c, 'in_progress')}><Timer size={13} />بدء المعالجة</button>}
                <button className="btn sm ok" onClick={() => setStatus(c, 'resolved')}><Check size={13} />تم الحل</button>
                <button className="btn sm gh" onClick={() => addNote(c)}><PenLine size={13} />إضافة ملاحظة</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
