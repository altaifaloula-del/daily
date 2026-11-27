/* v56.45 (الدفعة 11): T1 تسجيل النقد المسلَّم قبل اعتماد أمر الصرف (إعداد معطّل افتراضيًا)،
   وT7 مراجعة أوامر الصرف الماضية المكررة مع شاشاتها (قراءة + قيد تصحيح بانتظار الاعتماد). */
import React, { useState, useMemo } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { jeOwner } from '../../App.jsx';
import { dsPreRanges, dsPreOpen, dsRouteOpen, dsDupScan, buildAccounting, fpLockedTo, jeAutoSt, money, nowISO, today, uid, periodLocked, LOCK_MSG } from '../../App.jsx';

export function DsPreCard({ org, commitOrg, say, isAdm }) {
  const R = dsPreRanges(org); const open0 = R.find(r => !r.to); const on = !!open0; const [from, setFrom] = useState(today()); const lk = fpLockedTo(org) || '';
  const lastTo = R.reduce((a, r) => (r.to && r.to > a ? r.to : a), '');
  const toggle = async () => {
    if (!isAdm) return;
    if (!on) {
      if (!dsRouteOpen(org)) return say('فعّل «ضوابط أوامر الصرف» أولًا — التسجيل يخص الأوامر بانتظار الاعتماد', 'no');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return say('اختر تاريخ البدء', 'no');
      if (from < today()) return say('تاريخ البدء لا يسبق اليوم', 'no');
      if (lk && from <= lk) return say('تاريخ البدء داخل فترة مقفلة (حتى ' + lk + ')', 'no');
      if (lastTo && from <= lastTo) return say('تاريخ البدء يجب أن يكون بعد نهاية التفعيل السابق (' + lastTo + ')', 'no');
      if (!window.confirm('تفعيل تسجيل النقد المسلَّم قبل اعتماد أمر الصرف من ' + from + '؟\nيُضاف الحساب 1402، ويُخصم المسلَّم من الخزينة بتاريخ تسليمه حتى يُعتمد الأمر أو يُسترد.')) return;
    } else if (!window.confirm('إيقاف من اليوم؟ ما سُجّل يبقى كما هو.')) return;
    const ok = await commitOrg(o => { const rs = dsPreRanges(o).map(r => ({ ...r }));
      if (on) { const x = rs.find(r => !r.to); if (x) { x.to = today(); x.offAt = nowISO(); } } else rs.push({ from, at: nowISO() });
      return { ...o, dsPre: { ...(o.dsPre || {}), ranges: rs } }; },
      { actionType: 'settings', targetType: 'system_settings', targetId: 'dsPre', title: on ? 'أوقف تسجيل النقد المسلَّم قبل الاعتماد' : 'فعّل تسجيل النقد المسلَّم قبل الاعتماد', details: on ? 'حتى ' + today() : 'من ' + from });
    if (ok) say(on ? 'أُوقف — ما سُجّل كما هو' : 'فُعّل من ' + from + ' ✓');
  };
  return (<div className="card" data-dspre>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />النقد المسلَّم قبل اعتماد أمر الصرف</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل من ' + open0.from : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بإجابتك «يُسلَّم النقد قبل اعتماد الأمر كثيرًا» وقرار المجلس: لا يُمنع الواقع بل يُسجَّل. أمين الخزينة يسجّل «سُلِّم النقد» بتاريخه على الأمر المعلّق،
      فيُخصم من الخزينة فورًا على الحساب 1402 «مبالغ صُرفت بانتظار الاعتماد». عند الاعتماد (بغير المنشئ) يُحمَّل على حساب البند بتاريخ التسليم بوسم «اعتماد لاحق»،
      وعند الرفض يبقى على 1402 حتى يُسجَّل استرداده. الشهر لا يُقفل وفيه أمر سُلِّم نقده ولم يُعتمد أو رُفض ولم يُسترد.
      {R.filter(r => r.to).map((r, i) => <div key={i}>نطاق سابق: {r.from} ← {r.to}</div>)}</div>
    {isAdm && !on && <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}><label style={{ fontSize: 12 }}>يسري من <input className="inp" type="date" aria-label="تاريخ بدء تسجيل النقد المسلَّم قبل الاعتماد" value={from} min={today()} onChange={e => setFrom(e.target.value)} /></label></div>}
    {isAdm && <div className="row" style={{ marginTop: 8 }}><button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-dspre-toggle>{on ? 'إيقاف' : 'تفعيل'}</button></div>}
  </div>);
}

/* T7: مراجعة التكرار — لا يُعدَّل قيد سابق. التصحيح قيد يدوي «بانتظار الاعتماد»: مدين حساب النقد الذي خُصم مرتين / دائن 5901 (تصحيح في الفترة الجارية)
   أو 3201 (الأرباح المبقاة إن قرر المختص أن الخطأ جوهري لسنة سابقة) — الاختيار صريح ولا افتراض. */
export function DsDupCard({ org, ops, me, commit, say, canPost }) {
  const [open, setOpen] = useState(false); const [pick, setPick] = useState({});
  const A = useMemo(() => open ? buildAccounting(org, ops) : null, [open, org, ops]);
  const rows = useMemo(() => A ? dsDupScan(A, ops, org) : [], [A, ops, org]);
  const cashAccs = useMemo(() => A ? A.accounts.filter(a => a.cash || /^12/.test(String(a.code))).map(a => ({ code: String(a.code), name: a.name })) : [], [A]);
  const n = (ops.disbursements || []).filter(x => ['سداد موردين', 'ضريبة القيمة المضافة', 'صرف رواتب'].includes(x.category)).length;
  if (!n) return null;
  // (التحقق المستقل) المدين المقترح = حساب النقد الدائن في القيد المطابَق إن كان واحدًا (الشاشة سجّلت الدفع عليه)، وإلا اختيار صريح
  const drSug = (r) => { const s = [...new Set(r.matches.flatMap(m => m.cr || []))]; return r.matches.length === 1 && s.length === 1 ? s[0] : ''; };
  const fix = async (r) => {
    const p = pick[r.x.id] || {}; const dr = p.dr || drSug(r), cr = p.cr;
    if (!dr) return say('اختر الطرف المدين: حساب النقد الذي خُصم مرتين (الأمر أو الشاشة) — راجع كشف البنك أو جرد الخزينة', 'no');
    if (!canPost) return say('ينشئ قيد التصحيح المحاسب أو الإدارة المالية', 'no');
    if (!cr) return say('اختر الطرف الدائن: 5901 (تصحيح في الفترة الجارية) أو 3201 (الأرباح المبقاة إن كان جوهريًا لسنة سابقة) — قرار المختص', 'no');
    const dt = today(); if (periodLocked(org, dt)) return say(LOCK_MSG(dt), 'no');
    if (!window.confirm((r.matches.length ? '' : 'لا مطابقة آلية لهذا الأمر — تأكد يدويًا من تكراره.\n') + (jeOwner(me) ? 'إنشاء قيد التصحيح وترحيله باعتمادك' : 'إنشاء قيد تصحيح «بانتظار الاعتماد»') + ': مدين ' + dr + ' / دائن ' + cr + ' بمبلغ ' + money(r.x.amount) + '؟' + (jeOwner(me) ? '' : '\nلا أثر له قبل أن يعتمده غير منشئه (المالك).') + (cr === '3201' ? '\nدائن 3201 لا يعيد عرض أرقام المقارنة — يوثّقه المختص.' : ''))) return;
    const rec = { id: uid('jm'), date: dt, title: 'تصحيح تكرار أمر صرف «' + r.x.category + '» ' + (r.x.reference || r.x.id) + ' بتاريخ ' + r.date + ' (سُجّل أيضًا في شاشته)', opening: false,
      by: me.name, createdAt: nowISO(), ...jeAutoSt(me), src: 'ds-dup', dsDup: r.x.id, lines: [{ code: dr, debit: r.x.amount, credit: 0 }, { code: cr, debit: 0, credit: r.x.amount }] };
    let dup = false;
    const ok = await commit(d => { if ((d.journalManual || []).some(j => j.dsDup === r.x.id && j.status !== 'rejected' && j.status !== 'withdrawn')) { dup = true; return d; } return { ...d, journalManual: [rec, ...(d.journalManual || [])] }; },
      { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'قيد تصحيح تكرار أمر صرف (T7)', details: r.x.category + ' · ' + money(r.x.amount) + ' · مدين ' + dr + ' / دائن ' + cr });
    if (dup) return say('قيد تصحيح هذا الأمر موجود', 'no');
    if (ok !== false) say(rec.status === 'pending' ? 'أُرسل قيد التصحيح للاعتماد ✓' : 'سُجّل قيد التصحيح ✓');
  };
  return (<div className="card" data-dsdup>
    <div className="card-h"><div className="card-t"><AlertTriangle size={15} color="var(--amber)" />مراجعة أوامر الصرف المكررة مع شاشاتها</div>
      <button className="btn sm" data-dsdup-open onClick={() => setOpen(v => !v)}>{open ? 'إخفاء' : 'فحص'}</button></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9 }}>
      بإجابتك: سداد الموردين والضريبة والرواتب التي صُرفت بأوامر صرف سُجّلت أيضًا في شاشاتها — فالمصروف 5901 مضخَّم والنقد مخصوم مرتين.
      الفحص يعرض لكل أمر المطابقات المحتملة (المبلغ نفسه خلال 31 يومًا — قد يطابق قيد واحد أكثر من أمر). المدين المقترح حساب النقد في القيد المطابَق، وبلا مطابقة واحدة يُختار صراحةً. راجع كل سطر؛ التصحيح قيد بانتظار الاعتماد يعتمده المالك قيدًا قيدًا، ولا يُعدَّل قيد سابق ولا يُفتح شهر مقفل.</div>
    {open && <div style={{ marginTop: 8 }}>
      {!rows.length && <div className="empty">لا أوامر مرحّلة على 5901 لهذه البنود.</div>}
      {rows.map(r => <div key={r.x.id} className="me-row" data-dsdup-row={r.x.id} style={{ flexWrap: 'wrap', gap: 6 }}>
        <span className="me-a"><b>{r.date} · {r.x.category} · {money(r.x.amount)}</b><small>{r.x.beneficiary} {r.x.reference ? '· ' + r.x.reference : ''}</small>
          <small data-dsdup-m>{r.matches.length ? 'مطابقة محتملة: ' + r.matches.map(m => m.date + ' ' + m.title).join(' | ') : 'لا مطابقة آلية — راجع يدويًا'}</small></span>
        {r.fix ? <span className={'badge ' + (r.fix.status === 'pending' ? 'b-amber' : 'b-mint')} data-dsdup-fixed>{r.fix.status === 'pending' ? 'قيد تصحيح بانتظار الاعتماد' : 'صُحِّح'}</span>
          : canPost && <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <select className="sel" aria-label="الطرف المدين" data-dsdup-dr value={(pick[r.x.id] || {}).dr || drSug(r)} onChange={e => setPick(p => ({ ...p, [r.x.id]: { ...(p[r.x.id] || {}), dr: e.target.value } }))}>
              <option value="">— المدين —</option>{cashAccs.map(a => <option key={a.code} value={a.code}>مدين {a.code} — {a.name}</option>)}</select>
            <select className="sel" aria-label="الطرف الدائن" data-dsdup-cr value={(pick[r.x.id] || {}).cr || ''} onChange={e => setPick(p => ({ ...p, [r.x.id]: { ...(p[r.x.id] || {}), cr: e.target.value } }))}>
              <option value="">— الدائن —</option><option value="5901">دائن 5901 (الفترة الجارية)</option><option value="3201">دائن 3201 (الأرباح المبقاة)</option></select>
            <button className="btn sm" data-dsdup-fix onClick={() => fix(r)}>إنشاء قيد تصحيح</button></span>}
      </div>)}
    </div>}
  </div>);
}
