/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { A4_CSS, Field, MZ_LOGO_HTML, Modal, arDT, arDate, buildClosingA4, businessDay, countedClosing, money, openDocWin, sum } from '../../App.jsx';

export function DailyBranchReport({ org, scoped, myBranches, onClose }) {
  const [date, setDate] = useState(businessDay());
  const [scope, setScope] = useState('all'); // all | one | some
  const [oneBranch, setOneBranch] = useState(myBranches[0]?.id || '');
  const [someIds, setSomeIds] = useState([]);

  const targetBranches = scope === 'all' ? myBranches
    : scope === 'one' ? myBranches.filter(b => b.id === oneBranch)
    : myBranches.filter(b => someIds.includes(b.id));

  const dayClosings = scoped.closings.filter(c => countedClosing(c) && c.date === date &&
    targetBranches.some(b => b.id === c.branchId));

  const toggleSome = (id) => setSomeIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // طباعة تقرير مجمّع ليوم واحد لكل الفروع المحددة
  const printConsolidated = () => {
    const co = org.company || {};
    const m = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const T = {
      rev: sum(dayClosings, c => c.totalRevenue), exp: sum(dayClosings, c => c.totalExpenses),
      cash: sum(dayClosings, c => c.cashSales), card: sum(dayClosings, c => c.cardSales),
      bank: sum(dayClosings, c => c.bankTransferSales || 0), del: sum(dayClosings, c => c.totalDeliverySales),
      transfer: sum(dayClosings, c => c.transferredToMainTreasury), variance: sum(dayClosings, c => c.variance)
    };
    const rows = dayClosings.map(c => `<tr>
      <td>${c.branchName}</td>
      <td class="num brass">${m(c.totalRevenue)}</td>
      <td class="num">${m(c.cashSales)}</td>
      <td class="num">${m(c.cardSales)}</td>
      <td class="num">${m(c.bankTransferSales || 0)}</td>
      <td class="num">${m(c.totalDeliverySales)}</td>
      <td class="num rose">${m(c.totalExpenses)}</td>
      <td class="num mint">${m(c.totalRevenue - c.totalExpenses)}</td>
      <td class="num">${m(c.transferredToMainTreasury)}</td>
      <td class="num ${c.variance < 0 ? 'rose' : ''}">${m(c.variance)}</td></tr>`).join('');
    const w = openDocWin('width=1000,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقرير الفروع اليومي - ${date}</title><style>${A4_CSS}</style></head><body><div class="page">
      <div class="head">
        <div class="co">${co.logoUrl ? `<img class="logo" src="${co.logoUrl}">` :MZ_LOGO_HTML}
          <div><div class="co-n">${co.name || 'المنشأة'}</div>
          <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div></div></div>
        <div class="doc-title">تقرير الإغلاق اليومي المجمّع للفروع</div>
        <div class="doc-sub">${arDate(date)} · عدد الفروع: ${dayClosings.length}</div>
        <div class="doc-sub dim">تاريخ التصدير: ${arDT(new Date())}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>إجمالي الإيرادات</span><b class="brass">${m(T.rev)} ر.س</b></div>
        <div class="kpi"><span>إجمالي المصروفات</span><b class="rose">${m(T.exp)} ر.س</b></div>
        <div class="kpi ok"><span>صافي اليوم</span><b>${m(T.rev - T.exp)} ر.س</b></div>
        <div class="kpi"><span>المحوّل للخزينة</span><b>${m(T.transfer)} ر.س</b></div>
        <div class="kpi"><span>المبيعات النقدية</span><b>${m(T.cash)} ر.س</b></div>
        <div class="kpi ${T.variance === 0 ? 'ok' : T.variance < 0 ? 'bad' : 'warn'}"><span>فروقات الصندوق</span><b>${m(T.variance)} ر.س</b></div>
      </div>
      <table class="t"><thead><tr>
        <th>الفرع</th><th class="num">الإيراد</th><th class="num">نقدي</th><th class="num">شبكة</th>
        <th class="num">تحويل</th><th class="num">تطبيقات</th><th class="num">المصروف</th>
        <th class="num">الصافي</th><th class="num">للخزينة</th><th class="num">فروقات</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="10" class="ce dim">لا إغلاقات في هذا اليوم للفروع المحددة</td></tr>'}</tbody>
      <tfoot><tr class="tot"><td>الإجمالي</td>
        <td class="num brass">${m(T.rev)}</td><td class="num">${m(T.cash)}</td><td class="num">${m(T.card)}</td>
        <td class="num">${m(T.bank)}</td><td class="num">${m(T.del)}</td><td class="num rose">${m(T.exp)}</td>
        <td class="num mint">${m(T.rev - T.exp)}</td><td class="num">${m(T.transfer)}</td>
        <td class="num">${m(T.variance)}</td></tr></tfoot></table>
      <div class="foot dim">تقرير مجمّع لأغراض الإدارة · ${co.name || ''}</div>
      </div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  // طباعة تقرير رسمي منفصل لكل فرع (كل إغلاق في صفحته)
  const printEachDetailed = () => {
    if (dayClosings.length === 0) return;
    const co = org.company || {};
    const pages = dayClosings.map(c => buildClosingA4(c, org)).join('<div style="page-break-after:always"></div>');
    const w = openDocWin('width=1000,height=800');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>تقارير الفروع اليومية - ${date}</title><style>${A4_CSS}</style></head><body>${pages}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  return (
    <Modal title="طباعة تقارير الفروع اليومية" icon={FileText} onClose={onClose}
      foot={<>
        <button className="btn pri" disabled={dayClosings.length === 0} onClick={printConsolidated}>
          <FileText size={14} />تقرير مجمّع
        </button>
        <button className="btn" disabled={dayClosings.length === 0} onClick={printEachDetailed}>
          <Printer size={14} />تقرير رسمي لكل فرع
        </button>
        <button className="btn gh" onClick={onClose}>إغلاق</button>
      </>}>
      <Field label="اليوم">
        <input type="date" className="inp" value={date} onChange={e => setDate(e.target.value)} />
      </Field>
      <Field label="نطاق الفروع">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className={'btn sm' + (scope === 'all' ? ' pri' : ' gh')} onClick={() => setScope('all')}>جميع الفروع</button>
          <button type="button" className={'btn sm' + (scope === 'some' ? ' pri' : ' gh')} onClick={() => setScope('some')}>فروع محددة</button>
          <button type="button" className={'btn sm' + (scope === 'one' ? ' pri' : ' gh')} onClick={() => setScope('one')}>فرع واحد</button>
        </div>
      </Field>
      {scope === 'one' && (
        <Field label="اختر الفرع">
          <select className="sel" value={oneBranch} onChange={e => setOneBranch(e.target.value)}>
            {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}
      {scope === 'some' && (
        <Field label="اختر الفروع المطلوبة">
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {myBranches.map(b => (
              <button key={b.id} type="button" className={'btn sm' + (someIds.includes(b.id) ? ' pri' : ' gh')}
                onClick={() => toggleSome(b.id)}>{b.name}</button>
            ))}
          </div>
        </Field>
      )}
      <div className="card" style={{ background: 'var(--ink)', padding: 12, marginTop: 4 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>الإغلاقات المتاحة في هذا اليوم</span>
          <span className="badge b-brass"><span className="num">{dayClosings.length}</span> من {targetBranches.length} فرع</span>
        </div>
        {dayClosings.length > 0 && (
          <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {dayClosings.map(c => <span key={c.id} className="badge b-dim">{c.branchName}: <span className="num">{money(c.totalRevenue)}</span></span>)}
          </div>
        )}
        {dayClosings.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 8 }}>
            لا توجد إغلاقات مسجّلة في هذا اليوم للفروع المحددة. اختر يوماً آخر أو نطاقاً مختلفاً.
          </div>
        )}
      </div>
    </Modal>
  );
}
