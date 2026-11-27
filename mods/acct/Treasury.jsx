/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Landmark, FileBarChart, ChevronDown, Printer, ArrowLeftRight, TrendingUp, TrendingDown, Banknote, FileText, Plus, Lock, Check, X, Receipt } from 'lucide-react';
import { CashVouchers } from './CashVouchers.jsx';
import { dsLive, dsCashOut, dsPostDate, canApproveJe, jeOwner } from '../../App.jsx';
import { dsHanded, dsPreOpen, dsPreOpenItem, dsCashMoves, dsHandCheck } from '../../App.jsx';   // v56.45 T1 النقد المسلَّم قبل الاعتماد   // v56.29 اعتماد أوامر الصرف
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
  const outflow = -sum((ops.disbursements || []).flatMap(d => dsCashMoves(org, d)), m => m.amt);   // v56.45: المسلَّم قبل الاعتماد يخرج بتاريخ تسليمه، والمسترد يعود   // v56.29: المعلّق والمرفوض لا يُخصمان · v56.31: المصروف من البنك لا يمس نقد الخزينة
  const pendCash = sum((ops.disbursements || []).filter(d => d.status === 'pending' && dsCashOut(org, d) && !dsHanded(org, d)), d => d.amount);   // v56.45: المسلَّم خرج فعلًا فلا يُحجز مرتين   // v56.31 T2: المعلّق يحجز الرصيد للعرض والفحص
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

  // v56.29: اعتماد أمر الصرف — غير منشئه، وبرصيد كافٍ، وخارج فترة مقفلة
  const decideDs = async (x, ok, withdraw) => {
    const mine = x.byId ? x.byId === me.id : x.by === me.name;
    if (withdraw ? !mine : !canApproveJe(me, x)) return say(withdraw ? 'يسحب الأمرَ منشئه فقط' : 'لا يعتمد أمر الصرف من أنشأه — يعتمده المحاسب أو الإدارة المالية أو المالك', 'no');
    const hd = dsHanded(org, x);   // v56.45: سُلِّم نقده قبل الاعتماد ⇒ المصروف بتاريخ التسليم إن كان شهره مفتوحًا، والرصيد لا يُفحص (خرج فعلًا)
    const td0 = hd && !periodLocked(org, x.cashAt) ? x.cashAt : today();   // v56.31 T1: القيد بتاريخ الاعتماد
    if (ok && periodLocked(org, td0)) return say(LOCK_MSG(td0), 'no');
    if (withdraw && hd) return say('سُلِّم نقد هذا الأمر — لا يُسحب؛ يعتمده غير منشئه أو يرفضه ثم يُسجَّل الاسترداد', 'no');
    if (ok && !hd && dsCashOut(org, x) && x.amount > balance - (pendCash - x.amount) + 0.004) return say('المبلغ يتجاوز رصيد الخزينة المتاح (بعد حجز الأوامر المعلّقة)', 'no');
    const r = ok || withdraw ? null : window.prompt('سبب الرفض:', ''); if (!ok && !withdraw && r === null) return;
    const st = ok ? 'posted' : withdraw ? 'withdrawn' : 'rejected'; let hit = false;
    // v56.29 (التحقق المستقل): الانتقال من «معلّق» فقط وعلى أحدث نسخة — فلا يُعاد اعتماد مرفوض ولا يُرفض مرحّل
    const done = await commit(d => ({ ...d, disbursements: (d.disbursements || []).map(y => (y.id === x.id && y.status === 'pending') ? (hit = true, { ...y, status: st, [(ok ? 'approved' : st) + 'By']: me.name, [(ok ? 'approved' : st) + 'At']: nowISO(), ...(ok ? { postDate: td0, ...(hd ? { lateAppr: true } : {}) } : {}), ...(r ? { rejectReason: r } : {}) }) : y) }), {
      actionType: 'cash_transfer', targetType: 'cash_transfer', targetId: x.id, title: ok ? 'اعتمد أمر صرف من الخزينة' : withdraw ? 'سحب أمر صرف معلّقًا' : 'رفض أمر صرف', details: `${x.category} · ${x.beneficiary} · ${money(x.amount)} ر.س · المنشئ ${x.by}` });
    if (!hit) return say('تغيّرت حالة الأمر قبل الحفظ — حدّث الشاشة', 'no');
    if (done !== false) say(ok ? 'اعتُمد أمر الصرف وخُصم من الخزينة ✓' : withdraw ? 'سُحب الأمر' : 'رُفض أمر الصرف');
  };

  // v56.45 T1: تسجيل تسليم النقد على أمر معلّق (الواقع قبل الاعتماد)، واسترداد نقد أمر رُفض بعد تسليمه
  const handDs = async (x) => {
    const d = window.prompt('تاريخ تسليم النقد فعلًا (YYYY-MM-DD):', today()); if (d === null) return;
    const why = dsHandCheck(org, x, d.trim(), today()); if (why) return say(why, 'no');
    if (dsCashOut(org, x) && x.amount > balance - (pendCash - x.amount) + 0.004) return say('المبلغ يتجاوز رصيد الخزينة', 'no');
    if (!window.confirm('تسجيل أن نقد هذا الأمر (' + money(x.amount) + ') سُلِّم في ' + d.trim() + ' قبل اعتماده؟\nيُقيَّد على 1402 «مبالغ صُرفت بانتظار الاعتماد» حتى يُعتمد الأمر أو يُسترد المبلغ — ولا يُلغى التسجيل بعده.')) return;
    let hit = false;
    const done = await commit(dd => ({ ...dd, disbursements: (dd.disbursements || []).map(y => (y.id === x.id && y.status === 'pending' && !y.cashAt) ? (hit = true, { ...y, cashAt: d.trim(), cashBy: me.name, cashById: me.id || '', cashRecAt: nowISO() }) : y) }), {
      actionType: 'cash_transfer', targetType: 'cash_transfer', targetId: x.id, title: 'سجّل تسليم نقد أمر صرف قبل اعتماده', details: `${x.category} · ${x.beneficiary} · ${money(x.amount)} ر.س · ${d.trim()}` });
    if (!hit) return say('تغيّرت حالة الأمر قبل الحفظ — حدّث الشاشة', 'no');
    if (done !== false) say('سُجّل التسليم ✓ — بانتظار الاعتماد اللاحق');
  };
  const recDs = async (x) => {
    const d = (window.prompt('تاريخ استرداد النقد إلى الخزينة (YYYY-MM-DD):', today()) || '').trim(); if (!d) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today() || d < x.cashAt) return say('تاريخ الاسترداد بين تاريخ التسليم واليوم', 'no');
    if (periodLocked(org, d)) return say(LOCK_MSG(d), 'no');
    let hit = false;
    const done = await commit(dd => ({ ...dd, disbursements: (dd.disbursements || []).map(y => (y.id === x.id && y.cashAt && !y.recAt && (y.status === 'rejected' || y.status === 'withdrawn')) ? (hit = true, { ...y, recAt: d, recBy: me.name, recById: me.id || '' }) : y) }), {
      actionType: 'cash_transfer', targetType: 'cash_transfer', targetId: x.id, title: 'سجّل استرداد نقد أمر صرف مرفوض', details: `${x.category} · ${x.beneficiary} · ${money(x.amount)} ر.س · ${d}` });
    if (!hit) return say('تغيّرت حالة الأمر قبل الحفظ — حدّث الشاشة', 'no');
    if (done !== false) say('سُجّل الاسترداد ✓');
  };
  const ledger = useMemo(() => {
    const items = [
      ...(ops.transfers || []).filter(t => t.status === 'received')
        .map(t => ({ id: t.id, date: t.date, kind: 'in', label: 'توريد من ' + t.branchName, ref: t.referenceNo, amount: t.amount })),
      ...(ops.disbursements || []).flatMap(x => dsCashMoves(org, x).map((m, i) => ({ id: x.id + (i ? '-r' : ''), date: m.date, kind: m.amt < 0 ? 'out' : 'in',
        label: (m.k === 'rec' ? 'استرداد نقد أمر لم يُعتمد — ' : '') + x.category + ' — ' + x.beneficiary + (m.k === 'out' && dsHanded(org, x) && x.status !== 'posted' ? ' (سُلِّم قبل الاعتماد)' : ''), ref: x.reference, amount: Math.abs(m.amt) })))
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
        {isCentral && <Kpi label="رصيد الخزينة الرئيسية" value={money(balance)} sub={pendCash > 0 ? 'المتاح بعد المعلّق ' + money(balance - pendCash) : 'الوارد ناقص المنصرف'} icon={Landmark} color="#D9A83E" />}
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
          <button className={'btn sm' + (tab === 'cv' ? ' pri' : ' gh')} data-tabcv onClick={() => setTab('cv')}>
            <Receipt size={14} />سندات القبض والصرف
          </button>
          <button className={'btn sm' + (tab === 'led' ? ' pri' : ' gh')} onClick={() => setTab('led')}>
            <FileText size={14} />كشف حركة الخزينة
          </button>
          {tab === 'out' && <button className="btn pri" style={{ marginInlineStart: 'auto' }} onClick={() => setAdd(true)}>
            <Plus size={15} />أمر صرف جديد
          </button>}
        </>}
      </div>

      {tab === 'cv' && isCentral && <CashVouchers org={org} ops={ops} me={me} commit={commit} say={say} />}   {/* v46.6 */}
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
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{x.by}
                      {x.status === 'pending' && <div className="row" style={{ gap: 4, marginTop: 4 }} data-ds-pending><span className="badge b-amber">بانتظار الاعتماد</span>
                        {x.cashAt && <span className="badge b-rose" data-ds-handed title={'سجّله ' + (x.cashBy || '')}>سُلِّم النقد {x.cashAt}</span>}
                        {!x.cashAt && dsPreOpen(org) && canReceive && <button className="btn sm gh" data-ds-hand onClick={() => handDs(x)}>سُلِّم النقد</button>}
                        {canApproveJe(me, x) && <><button className="btn sm" data-ds-ok onClick={() => decideDs(x, true)}><Check size={12} />اعتماد</button><button className="btn sm gh" data-ds-no onClick={() => decideDs(x, false)}><X size={12} />رفض</button></>}
                        {(x.byId ? x.byId === me.id : x.by === me.name) && <button className="btn sm gh" data-ds-wd onClick={() => decideDs(x, false, true)}>سحب</button>}</div>}
                      {x.status === 'withdrawn' && <div><span className="badge b-dim">مسحوب</span></div>}
                      {x.selfPosted && <div><span className="badge b-sky" data-ds-self>رحّله المالك بنفسه</span></div>}
                      {x.postDate && x.postDate !== x.date && <div style={{ fontSize: 10.5 }}>قُيِّد بتاريخ الاعتماد {x.postDate}</div>}
                      {x.fundAcc && <div style={{ fontSize: 10.5 }}>من البنك {x.fundAcc}</div>}
                      {x.status === 'rejected' && <div><span className="badge b-rose" title={x.rejectReason || ''}>مرفوض</span></div>}
                      {x.lateAppr && <div><span className="badge b-amber" data-ds-late>اعتماد لاحق — سُلِّم النقد {x.cashAt}</span></div>}
                      {dsPreOpenItem(org, x) && x.status !== 'pending' && <div className="row" style={{ gap: 4, marginTop: 4 }} data-ds-unrec><span className="badge b-rose">سُلِّم نقده ولم يُسترد</span>{canReceive && <button className="btn sm" data-ds-rec onClick={() => recDs(x)}>تسجيل الاسترداد</button>}</div>}
                      {x.recAt && <div style={{ fontSize: 10.5 }}>استُرد {x.recAt}</div>}
                      {x.dsRoute === 'blocked' && <div><span className="badge b-amber">يحتاج مراجعة</span></div>}</td>
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

      {add && <DisbursementForm org={org} me={me} balance={balance - pendCash} commit={commit} say={say} onClose={() => setAdd(false)} />}
    </div>
  );
}
