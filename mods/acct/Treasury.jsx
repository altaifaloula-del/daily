/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Landmark, FileBarChart, ChevronDown, Printer, ArrowLeftRight, TrendingUp, TrendingDown, Banknote, FileText, Plus, Lock, Check, X } from 'lucide-react';
import { Badge, DisbursementForm, Kpi, LOCK_MSG, ROLES, arDate, money, nowISO, periodLocked, printA4, sum, today } from '../../App.jsx';

export function Treasury({ org, ops, me, myBranches, scoped, commit, say }) {
  const [tab, setTab] = useState('in');
  const [add, setAdd] = useState(false);
  const [repOpen, setRepOpen] = useState(false);    // v9.5 قائمة تقارير التطبيق
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); // v15.5: فلتر التاريخ لكشف الخزينة
  const canReceive = ROLES[me.role]?.scope !== 'own';
  const isCentral = ROLES[me.role]?.scope !== 'own';

  const list = [...scoped.transfers].sort((a, b) => b.date.localeCompare(a.date));
  const pending = list.filter(t => t.status === 'pending');
  const received = list.filter(t => t.status === 'received');
  const disb = isCentral ? [...(ops.disbursements || [])].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const inflow = sum((ops.transfers || []).filter(t => t.status === 'received'), t => t.amount);
  const outflow = sum(ops.disbursements || [], d => d.amount);
  const balance = inflow - outflow;

  const receive = async (t, ok) => {
    if (periodLocked(org, t.date)) return say(LOCK_MSG(t.date), 'no');
    await commit(d => ({
      ...d,
      transfers: d.transfers.map(x => x.id === t.id ? {
        ...x, status: ok ? 'received' : 'rejected', receivedBy: me.name, receivedAt: nowISO()
      } : x),
      closings: d.closings.map(c => c.id === t.closingId ? { ...c, transferStatus: ok ? 'received' : 'rejected' } : c)
    }), {
      actionType: 'cash_transfer', targetType: 'cash_transfer', targetId: t.id, branchName: t.branchName,
      title: ok ? 'استلم تحويلاً نقدياً بالخزينة' : 'رفض سند تحويل',
      details: `${t.branchName} · ${money(t.amount)} ر.س · سند ${t.referenceNo}`
    });
    say(ok ? 'تم تأكيد استلام المبلغ في الخزينة الرئيسية' : 'تم رفض السند وإبلاغ الفرع');
  };

  const ledger = useMemo(() => {
    const items = [
      ...(ops.transfers || []).filter(t => t.status === 'received')
        .map(t => ({ id: t.id, date: t.date, kind: 'in', label: 'توريد من ' + t.branchName, ref: t.referenceNo, amount: t.amount })),
      ...(ops.disbursements || [])
        .map(x => ({ id: x.id, date: x.date, kind: 'out', label: x.category + ' — ' + x.beneficiary, ref: x.reference, amount: x.amount }))
    ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let run = 0;
    return items.map(i => { run += i.kind === 'in' ? i.amount : -i.amount; return { ...i, run }; }).reverse();
  }, [ops]);
  // v15.5: كشف الخزينة ضمن نطاق التاريخ (الرصيد الجاري يبقى تراكميًا حقيقيًا حتى كل حركة)
  const inRange = (d) => (!from || (d || '') >= from) && (!to || (d || '') <= to);
  const fLedger = useMemo(() => ledger.filter(i => inRange(i.date)), [ledger, from, to]);
  const pIn = sum(fLedger.filter(i => i.kind === 'in'), i => i.amount);
  const pOut = sum(fLedger.filter(i => i.kind === 'out'), i => i.amount);
  const rangeSub = (from || to) ? ('من ' + (from ? arDate(from) : 'البداية') + ' إلى ' + (to ? arDate(to) : arDate(today()))) : ('كل الحركات · حتى ' + arDate(today()));

  const printTreasury = () => {
    const rws = fLedger.map(i => `<tr><td class="n">${arDate(i.date)}</td><td>${i.label}</td><td>${i.ref || ''}</td><td class="n">${i.kind === 'in' ? money(i.amount) : '—'}</td><td class="n">${i.kind === 'out' ? money(i.amount) : '—'}</td><td class="n">${money(i.run)}</td></tr>`).join('');
    printA4(org, 'كشف حركة الخزينة الرئيسية', rangeSub + ' · الرصيد الحالي ' + money(balance),
      `<table><thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead><tbody>${rws}
      <tr class="tot"><td colspan="3">${(from || to) ? 'إجمالي الفترة' : 'الإجمالي'}</td><td class="n">${money(from || to ? pIn : inflow)}</td><td class="n">${money(from || to ? pOut : outflow)}</td><td class="n">${money(balance)}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* شريط التطبيق — v9.5 */}
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Landmark size={17} /></span>الخزينة والترحيل<small>التحويلات الواردة · حركة الخزينة</small></div>
        <div className="abar-sp" />
        {isCentral && <div className="abar-dd">
          <button className="btn sm" onClick={() => setRepOpen(o => !o)}><FileBarChart size={14} />التقارير<ChevronDown size={13} /></button>
          {repOpen && (<>
            <div className="abar-back" onClick={() => setRepOpen(false)} />
            <div className="abar-menu">
              <div className="abar-hd">تقارير الخزينة</div>
              <button onClick={() => { setRepOpen(false); printTreasury(); }}><Printer size={13} />كشف حركة الخزينة الرئيسية</button>
            </div>
          </>)}
        </div>}
      </div>

      <div className="grid g4">
        {isCentral && <Kpi label="رصيد الخزينة الرئيسية" value={money(balance)} sub="الوارد ناقص المنصرف" icon={Landmark} color="#C8A24A" />}
        <Kpi label="بانتظار الاستلام" value={money(sum(pending, t => t.amount))} sub={`${pending.length} سند`} icon={ArrowLeftRight} color="#E0A458" />
        <Kpi label="الوارد المستلم" value={money(isCentral ? inflow : sum(received, t => t.amount))} sub={`${received.length} سند من فروعك`} icon={TrendingUp} color="#4FB286" />
        {isCentral && <Kpi label="المنصرف من الخزينة" value={money(outflow)} sub={`${disb.length} أمر صرف`} icon={TrendingDown} color="#D9544D" />}
      </div>

      <div className="row">
        <button className={'btn sm' + (tab === 'in' ? ' pri' : ' gh')} onClick={() => setTab('in')}>
          <ArrowLeftRight size={14} />سندات التوريد
        </button>
        {isCentral && <>
          <button className={'btn sm' + (tab === 'out' ? ' pri' : ' gh')} onClick={() => setTab('out')}>
            <Banknote size={14} />أوامر الصرف
          </button>
          <button className={'btn sm' + (tab === 'led' ? ' pri' : ' gh')} onClick={() => setTab('led')}>
            <FileText size={14} />كشف حركة الخزينة
          </button>
          {tab === 'out' && <button className="btn pri" style={{ marginInlineStart: 'auto' }} onClick={() => setAdd(true)}>
            <Plus size={15} />أمر صرف جديد
          </button>}
        </>}
      </div>

      {tab === 'in' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Landmark size={15} color="var(--brass)" />سندات ترحيل النقدية من الفروع</div>
            {!canReceive && <span className="badge b-dim"><Lock size={10} />الاستلام من صلاحية الإدارة المالية</span>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>الفرع</th><th>رقم السند</th><th>المبلغ</th><th>الحالة</th><th>المستلم</th><th></th></tr></thead>
              <tbody>
                {list.slice(0, 60).map(t => (
                  <tr key={t.id}>
                    <td className="dt" style={{ whiteSpace: 'nowrap' }}>{arDate(t.date)}</td>
                    <td style={{ fontSize: 12 }}>{t.branchName}</td>
                    <td className="num" style={{ fontSize: 11, color: 'var(--dim)' }}>{t.referenceNo}</td>
                    <td className="num" style={{ color: 'var(--brass)', fontWeight: 600 }}>{money(t.amount)}</td>
                    <td><Badge s={t.status} /></td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{t.receivedBy || '—'}</td>
                    <td>
                      {t.status === 'pending' && canReceive && (
                        <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                          <button className="btn sm ok" onClick={() => receive(t, true)}><Check size={12} />استلام</button>
                          <button className="btn sm no" onClick={() => receive(t, false)}><X size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={7}><div className="empty">لا توجد سندات تحويل بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'out' && isCentral && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><Banknote size={15} color="var(--brass)" />أوامر الصرف من الخزينة</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>البند</th><th>المستفيد</th><th>المرجع</th><th>الطريقة</th><th>المبلغ</th><th>أمر الصرف</th></tr></thead>
              <tbody>
                {disb.map(x => (
                  <tr key={x.id}>
                    <td className="dt" style={{ whiteSpace: 'nowrap' }}>{arDate(x.date)}</td>
                    <td style={{ fontSize: 12 }}>{x.category}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{x.beneficiary}</td>
                    <td className="num" style={{ fontSize: 11, color: 'var(--faint)' }}>{x.reference}</td>
                    <td><span className="badge b-dim">
                      {{ cash: 'نقداً', bank_transfer: 'تحويل بنكي', cheque: 'شيك' }[x.method] || x.method}</span></td>
                    <td className="num" style={{ color: 'var(--rose)', fontWeight: 600 }}>{money(x.amount)}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{x.by}</td>
                  </tr>
                ))}
                {disb.length === 0 && <tr><td colSpan={7}><div className="empty">لا توجد أوامر صرف مسجلة.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'led' && isCentral && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><FileText size={15} color="var(--brass)" />كشف حركة الخزينة الرئيسية</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>من</span>
              <input type="date" className="inp" style={{ width: 145 }} value={from} onChange={e => setFrom(e.target.value)} />
              <span style={{ fontSize: 11.5, color: 'var(--dim)' }}>إلى</span>
              <input type="date" className="inp" style={{ width: 145 }} value={to} onChange={e => setTo(e.target.value)} />
              {(from || to) && <button className="btn sm gh" onClick={() => { setFrom(''); setTo(''); }}>إظهار الكل</button>}
              <button className="btn sm" onClick={printTreasury}><Printer size={13} />طباعة</button>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 8 }}>{rangeSub}{(from || to) && <> · وارد الفترة <b style={{ color: 'var(--mint)' }}>{money(pIn)}</b> · منصرف الفترة <b style={{ color: 'var(--rose)' }}>{money(pOut)}</b></>}</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead>
              <tbody>
                {fLedger.slice(0, 200).map(i => (
                  <tr key={i.kind + i.id}>
                    <td className="dt" style={{ whiteSpace: 'nowrap' }}>{arDate(i.date)}</td>
                    <td style={{ fontSize: 12 }}>{i.label}</td>
                    <td className="num" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{i.ref}</td>
                    <td className="num" style={{ color: 'var(--mint)' }}>{i.kind === 'in' ? money(i.amount) : '—'}</td>
                    <td className="num" style={{ color: 'var(--rose)' }}>{i.kind === 'out' ? money(i.amount) : '—'}</td>
                    <td className="num" style={{ fontWeight: 600, color: 'var(--brass)' }}>{money(i.run)}</td>
                  </tr>
                ))}
                {fLedger.length === 0 && <tr><td colSpan={6}><div className="empty">{(from || to) ? 'لا حركات ضمن هذه الفترة.' : 'لا حركات على الخزينة بعد.'}</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {add && <DisbursementForm org={org} me={me} balance={balance} commit={commit} say={say} onClose={() => setAdd(false)} />}
    </div>
  );
}
