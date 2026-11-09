/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { ClipboardCheck, CalendarDays, Landmark, Plus, Bell, Users, Wallet, Check } from 'lucide-react';
import { Field, Kpi, LEAVE_TYPES, LOCK_MSG, Modal, Num, ROLES, SectionNav, eosYears, isoD, leaveBalance, leaveDeductPlan, lvAccrualLines, lvAddD, lvCfg, lvDaily, lvDays, lvRequired, lvState, money, monthEnd, nowISO, periodLocked, sum, today, uid } from '../../App.jsx';

export function Leaves({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const R = ROLES[me.role] || {};
  const central = R.scope === 'all';
  const canDecide = central || !!R.approver;
  const brIds = (myBranches || []).map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && (central || brIds.includes(e.branchId)));
  const allEmps = org.employees || [];
  const empOf = (id) => allEmps.find(e => e.id === id) || {};
  const reqs = (ops.leaveRequests || []).filter(r => central || brIds.includes(r.branchId)).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const [tab, setTab] = useState('req'); const [st, setSt] = useState('pending');
  const [f, setF] = useState(null); const [opF, setOpF] = useState(null); const [lvStart, setLvStart] = useState(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const td = today();
  const LV = useMemo(() => lvState(ops), [ops]);
  const lvLines = useMemo(() => (LV.open && month >= LV.from) ? lvAccrualLines(org, ops, monthEnd(month)) : [], [org, ops, month, LV]);
  const lvTotal = r2(Object.values(LV.bal).reduce((a, v) => a + v, 0));

  const check = (x, exceptId) => {
    const e = empOf(x.employeeId); const T = LEAVE_TYPES[x.type]; const n = lvDays(x.from, x.to);
    if (!e.id) return 'اختر الموظف'; if (!n) return 'الفترة غير صحيحة';
    const clash = (ops.leaveRequests || []).find(r => r.id !== exceptId && r.employeeId === e.id && ['pending', 'approved'].includes(r.status) && r.to >= x.from && r.from <= x.to);
    if (clash) return 'تتداخل مع إجازة ' + (LEAVE_TYPES[clash.type] || {}).ar + ' (' + clash.from + ' ← ' + clash.to + ')';
    if (T.max && n > T.max) return 'الحد الأعلى لإجازة ' + T.ar + ' ' + T.max + ' يومًا';
    if (T.once && (ops.leaveRequests || []).some(r => r.id !== exceptId && r.employeeId === e.id && r.type === x.type && r.status === 'approved')) return 'إجازة ' + T.ar + ' تُمنح مرة واحدة طوال الخدمة';
    if (T.minYears && e.hireDate && eosYears(e.hireDate, x.from) < T.minYears) return 'إجازة ' + T.ar + ' بعد ' + T.minYears + ' سنتين خدمة على الأقل';
    if (x.type === 'annual') { const b = leaveBalance(org, ops, e, x.to); if (!b.ok) return 'أضف تاريخ تعيين الموظف أو رصيده الافتتاحي أولًا';
      const pend = (ops.leaveRequests || []).filter(r => r.id !== exceptId && r.employeeId === e.id && r.type === 'annual' && r.status === 'approved' && r.from > x.to).reduce((a, r) => a + lvDays(r.from, r.to), 0);
      if (n > b.balance - pend + 0.0001) return 'الرصيد غير كافٍ: المتاح ' + Math.floor(b.balance - pend) + ' يوم والمطلوب ' + n; }
    return '';
  };
  const submit = async () => {
    const x = f; const err = check(x); if (err) return say(err, 'no');
    const e = empOf(x.employeeId); const b = (org.branches || []).find(z => z.id === e.branchId) || {};
    const rec = { id: uid('lv'), employeeId: e.id, employeeName: e.name, branchId: e.branchId || '', branchName: b.name || '', type: x.type, from: x.from, to: x.to, days: lvDays(x.from, x.to), reason: (x.reason || '').trim(), status: 'pending', requestedBy: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, leaveRequests: [rec, ...(d.leaveRequests || [])] }), { actionType: 'create', targetType: 'leave', targetId: rec.id, branchName: rec.branchName, title: 'طلب إجازة', details: e.name + ' · ' + LEAVE_TYPES[x.type].ar + ' · ' + rec.days + ' يوم (' + x.from + ' ← ' + x.to + ')' });
    if (ok) { setF(null); say('أُرسل طلب الإجازة للاعتماد ✓'); }
  };
  const decide = async (r, ok2) => {
    if (!canDecide) return;
    let note = ''; if (!ok2) { note = window.prompt('سبب الرفض:'); if (note === null) return; }
    const e = empOf(r.employeeId);
    let advs = [];
    if (ok2) {
      const err = check(r, r.id); if (err) return say(err, 'no');
      const plan = leaveDeductPlan(ops, e, r.type, r.from, r.to, r.id); const daily = lvDaily(e);
      advs = plan.map(p => ({ id: uid('ad'), employeeId: e.id, employeeName: e.name, branchId: e.branchId || '', branchName: r.branchName || '', type: r.type === 'sick' ? 'sick_leave_cut' : 'unpaid_leave',
        amount: r2(p.days * daily * p.pct / 100), month: p.month, date: p.month + '-01' > r.from ? p.month + '-01' : r.from, reason: 'إجازة ' + LEAVE_TYPES[r.type].ar + ' — ' + p.days + ' يوم' + (p.pct < 100 ? ' بخصم ' + p.pct + '%' : ''), leaveId: r.id, createdByName: me.name, createdAt: nowISO() })).filter(a => a.amount > 0);
      const lk = advs.find(a => periodLocked(org, a.month + '-28')); if (lk) return say(LOCK_MSG(lk.month + '-28'), 'no');
      const posted = advs.find(a => (ops.ledgerEntries || []).some(x => x.kind === 'salary_payout' && x.month === a.month));
      if (posted && !window.confirm('رواتب ' + posted.month + ' صُرفت مسبقًا — سيُسجَّل الخصم على ذلك الشهر لكنه لن يظهر إلا في التسوية. متابعة؟')) return;
    }
    const done = await commit(d => ({ ...d,
      leaveRequests: (d.leaveRequests || []).map(x => x.id === r.id && x.status === 'pending' ? { ...x, status: ok2 ? 'approved' : 'rejected', decidedBy: me.name, decidedAt: nowISO(), ...(note ? { note } : {}), ...(advs.length ? { deduct: r2(sum(advs, a => a.amount)) } : {}) } : x),
      ...(advs.length ? { advances: [...advs, ...(d.advances || [])] } : {}) }),
      { actionType: 'update', targetType: 'leave', targetId: r.id, need: 'post', branchName: r.branchName, title: ok2 ? 'اعتمد إجازة' : 'رفض إجازة', details: r.employeeName + ' · ' + LEAVE_TYPES[r.type].ar + ' · ' + r.days + ' يوم' + (advs.length ? ' · خصم ' + money(sum(advs, a => a.amount)) : '') + (note ? ' · ' + note : '') });
    if (done) say(ok2 ? 'اعتُمدت الإجازة' + (advs.length ? ' وسُجّل خصمها على المسير' : '') + ' ✓' : 'رُفض الطلب');
  };
  const cancel = async (r) => {
    if (r.status === 'approved') {
      if (!central) return say('إلغاء إجازة معتمدة للإدارة فقط', 'no');
      if (r.from <= td) return say('بدأت الإجازة — لا تُلغى بعد بدئها؛ سجّل مباشرة العمل بتعديل تاريخ النهاية', 'no');
    } else if (r.requestedBy !== me.name && !canDecide) return say('يلغي الطلب صاحبه أو المعتمد', 'no');
    if (!window.confirm('إلغاء إجازة ' + r.employeeName + ' (' + r.from + ' ← ' + r.to + ')؟')) return;
    await commit(d => ({ ...d, leaveRequests: (d.leaveRequests || []).map(x => x.id === r.id ? { ...x, status: 'cancelled', cancelledBy: me.name, cancelledAt: nowISO() } : x), advances: (d.advances || []).filter(a => a.leaveId !== r.id) }),
      { actionType: 'update', targetType: 'leave', targetId: r.id, branchName: r.branchName, title: 'ألغى إجازة', details: r.employeeName + ' · ' + r.from + ' ← ' + r.to });
    say('أُلغيت الإجازة' + (r.deduct ? ' وأُزيل خصمها' : '') + ' ✓');
  };
  const endEarly = async (r) => {
    if (!central) return; const back = window.prompt('تاريخ آخر يوم إجازة فعلي (YYYY-MM-DD) — المباشرة في اليوم التالي:', td); if (!back) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(back) || back < r.from || back >= r.to) return say('التاريخ يجب أن يكون داخل الإجازة وقبل نهايتها', 'no');
    const e = empOf(r.employeeId); const nr = { ...r, to: back, days: lvDays(r.from, back) };
    const plan = leaveDeductPlan(ops, e, r.type, r.from, back, r.id); const daily = lvDaily(e);
    const advs = plan.map(p => ({ id: uid('ad'), employeeId: e.id, employeeName: e.name, branchId: e.branchId || '', branchName: r.branchName || '', type: r.type === 'sick' ? 'sick_leave_cut' : 'unpaid_leave', amount: r2(p.days * daily * p.pct / 100), month: p.month, date: p.month + '-01' > r.from ? p.month + '-01' : r.from, reason: 'إجازة ' + LEAVE_TYPES[r.type].ar + ' — ' + p.days + ' يوم', leaveId: r.id, createdByName: me.name, createdAt: nowISO() })).filter(a => a.amount > 0);
    const old = (ops.advances || []).filter(a => a.leaveId === r.id); const lk = [...old, ...advs].find(a => periodLocked(org, a.month + '-28')); if (lk) return say(LOCK_MSG(lk.month + '-28'), 'no');
    await commit(d => ({ ...d, leaveRequests: (d.leaveRequests || []).map(x => x.id === r.id ? { ...x, to: back, days: nr.days, endedEarly: r.to, deduct: r2(sum(advs, a => a.amount)) } : x), advances: [...advs, ...(d.advances || []).filter(a => a.leaveId !== r.id)] }),
      { actionType: 'update', targetType: 'leave', targetId: r.id, branchName: r.branchName, title: 'مباشرة مبكرة من إجازة', details: r.employeeName + ' · آخر يوم ' + back + ' بدل ' + r.to });
    say('سُجّلت المباشرة وعُدّل الرصيد والخصم ✓');
  };
  const saveOpening = async () => {
    const x = opF; if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return say('التاريخ غير صحيح', 'no');
    await commitOrg(d => ({ ...d, employees: (d.employees || []).map(e => e.id === x.id ? { ...e, leaveOpening: { date: x.date, days: Number(x.days) || 0 } } : e) }),
      { actionType: 'update', targetType: 'user_account', targetId: x.id, need: 'edit', title: 'رصيد إجازات افتتاحي', details: empOf(x.id).name + ' · ' + x.days + ' يوم في ' + x.date });
    setOpF(null); say('حُفظ الرصيد الافتتاحي ✓');
  };
  const startLv = async () => {
    const m = lvStart.month; if (!/^\d{4}-\d{2}$/.test(m)) return; if (periodLocked(org, m + '-01')) return say(LOCK_MSG(m + '-01'), 'no'); if (LV.open) return;
    const prevD = lvAddD(m + '-01', -1);
    const lines = allEmps.map(e => ({ empId: e.id, name: e.name, branchId: e.branchId || '', cum: lvRequired(org, ops, e, prevD), amt: lvRequired(org, ops, e, prevD) })).filter(l => l.amt > 0);
    const rec = { id: uid('lv'), kind: 'lv_open', month: m, date: m + '-01', asOf: prevD, lines, total: r2(sum(lines, l => l.amt)), ...(lvStart.post ? {} : { noPost: true }), by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, ledgerEntries: [rec, ...(d.ledgerEntries || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: 'lv-open', need: 'post', title: 'بدء مخصص الإجازات', details: 'من ' + m + ' · ' + money(rec.total) });
    if (ok) { setLvStart(null); say('فُعّل مخصص الإجازات ✓'); }
  };
  const lvPending = useMemo(() => { if (!LV.open) return []; const out = []; let m = LV.from; const cur = td.slice(0, 7);
    while (m < cur && out.length < 36) { if (!LV.months.has(m)) out.push(m); const [y, mo] = m.split('-').map(Number); m = isoD(new Date(y, mo, 1)).slice(0, 7); } return out; }, [LV]);
  const postLv = async () => {
    if (LV.months.has(month) || month < LV.from || month > td.slice(0, 7)) return; const D = monthEnd(month); if (periodLocked(org, D)) return say(LOCK_MSG(D), 'no');
    const miss = lvPending.filter(m => m < month); if (miss.length) return say('رحّل الأشهر السابقة أولًا: ' + miss.join('، '), 'no');
    const rec = { id: uid('lv'), kind: 'lv_accrual', month, date: D, lines: lvLines, total: r2(sum(lvLines, l => l.amt)), by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, ledgerEntries: [rec, ...(d.ledgerEntries || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: 'lv-' + month, need: 'post', title: 'رحّل مخصص الإجازات', details: month + ' · ' + money(rec.total) });
    if (ok) say('رُحّل مخصص ' + month + ' ✓');
  };

  const shown = reqs.filter(r => st === 'all' || r.status === st);
  const pendN = reqs.filter(r => r.status === 'pending').length;
  const onNow = reqs.filter(r => r.status === 'approved' && r.from <= td && r.to >= td);
  const SB = { pending: ['بانتظار الاعتماد', 'b-amber'], approved: ['معتمدة', 'b-mint'], rejected: ['مرفوضة', 'b-rose'], cancelled: ['ملغاة', 'b-dim'] };
  const nf = f ? lvDays(f.from, f.to) : 0; const fe = f ? empOf(f.employeeId) : null;
  const fb = fe && fe.id ? leaveBalance(org, ops, fe, f.to || td) : null;
  const fplan = f && fe && fe.id && nf ? leaveDeductPlan(ops, fe, f.type, f.from, f.to) : [];
  const fded = r2(sum(fplan, p => p.days * lvDaily(fe) * p.pct / 100));

  return (
    <div className="grid" style={{ gap: 12 }}>
      <SectionNav label="أقسام الإجازات" cur={tab} onPick={setTab} items={[{ id: 'req', ar: 'الطلبات', icon: ClipboardCheck, badge: pendN || null }, { id: 'bal', ar: 'الأرصدة', icon: CalendarDays }, central && { id: 'prov', ar: 'المخصص في الدفاتر', icon: Landmark }]}
        extra={<button className="btn sm pri" onClick={() => setF({ employeeId: (emps[0] || {}).id || '', type: 'annual', from: td, to: td, reason: '' })}><Plus size={14} />طلب إجازة</button>} />
      <div className="grid g4">
        <Kpi label="طلبات بانتظار الاعتماد" value={String(pendN)} sub={canDecide ? 'قرارك مطلوب' : 'لدى الإدارة'} icon={Bell} color="#E0A458" />
        <Kpi label="في إجازة اليوم" value={String(onNow.length)} sub={onNow.slice(0, 3).map(r => r.employeeName).join('، ') || '—'} icon={CalendarDays} color="#5B93C4" />
        <Kpi label="أرصدة الإجازات (أيام)" value={String(Math.round(sum(emps, e => leaveBalance(org, ops, e, td).balance)))} sub={emps.length + ' موظف'} icon={Users} color="#C8A24A" />
        <Kpi label="قيمة الأرصدة" value={money(r2(sum(emps, e => Math.max(0, leaveBalance(org, ops, e, td).balance) * lvDaily(e))))} sub={LV.open ? 'المخصص في الدفاتر ' + money(lvTotal) : 'المخصص غير مفعّل'} icon={Wallet} color="#9B7BB8" />
      </div>

      {tab === 'req' && <div className="card">
        <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>{[['pending', 'بانتظار الاعتماد'], ['approved', 'معتمدة'], ['rejected', 'مرفوضة'], ['all', 'الكل']].map(([k, t]) => <button key={k} className={'btn sm' + (st === k ? ' pri' : ' gh')} onClick={() => setSt(k)}>{t}</button>)}</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الموظف</th><th>النوع</th><th>الفترة</th><th style={{ textAlign: 'end' }}>الأيام</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id}>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{r.employeeName}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{r.branchName} · طلب {r.requestedBy}</div></td>
                <td><span className="badge b-dim">{(LEAVE_TYPES[r.type] || {}).ar}</span>{r.deduct ? <div><span className="badge b-rose" style={{ marginTop: 3 }}>خصم {money(r.deduct)}</span></div> : null}</td>
                <td className="num" style={{ fontSize: 11.5 }}>{r.from} ← {r.to}{r.endedEarly ? <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>باشر مبكرًا (كانت حتى {r.endedEarly})</div> : null}</td>
                <td className="num" style={{ textAlign: 'end' }}>{r.days}</td>
                <td><span className={'badge ' + (SB[r.status] || SB.pending)[1]}>{(SB[r.status] || SB.pending)[0]}</span>{r.note ? <div style={{ fontSize: 10, color: 'var(--faint)' }}>{r.note}</div> : null}{r.reason ? <div style={{ fontSize: 10, color: 'var(--faint)' }}>{r.reason}</div> : null}</td>
                <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {canDecide && r.status === 'pending' && <><button className="btn sm pri" onClick={() => decide(r, true)}>اعتماد</button><button className="btn sm gh" onClick={() => decide(r, false)}>رفض</button></>}
                  {(r.status === 'pending' || (r.status === 'approved' && r.from > td && central)) && <button className="btn sm gh" onClick={() => cancel(r)}>إلغاء</button>}
                  {central && r.status === 'approved' && r.from <= td && r.to > td && <button className="btn sm gh" onClick={() => endEarly(r)}>مباشرة مبكرة</button>}
                </div></td>
              </tr>))}
            {shown.length === 0 && <tr><td colSpan={6}><div className="empty">لا طلبات.</div></td></tr>}
          </tbody>
        </table></div>
      </div>}

      {tab === 'bal' && <div className="card">
        <div className="tw"><table className="tb">
          <thead><tr><th>الموظف</th><th>الاستحقاق السنوي</th><th style={{ textAlign: 'end' }}>المستحق</th><th style={{ textAlign: 'end' }}>المأخوذ</th><th style={{ textAlign: 'end' }}>الرصيد</th><th style={{ textAlign: 'end' }}>القيمة</th><th></th></tr></thead>
          <tbody>
            {emps.map(e => { const b = leaveBalance(org, ops, e, td); return (
              <tr key={e.id}>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{e.name}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{e.hireDate ? 'تعيين ' + e.hireDate : 'بلا تاريخ تعيين'}{e.leaveOpening ? ' · افتتاحي ' + e.leaveOpening.days + ' يوم في ' + e.leaveOpening.date : ''}</div></td>
                <td><span className="badge b-dim">{b.rate} يوم</span></td>
                <td className="num" style={{ textAlign: 'end' }}>{b.ok ? b.accrued : '—'}</td>
                <td className="num" style={{ textAlign: 'end' }}>{b.used}</td>
                <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: b.balance < 0 ? 'var(--rose)' : undefined }}>{b.ok ? b.balance : '—'}</td>
                <td className="num" style={{ textAlign: 'end' }}>{b.ok ? money(Math.max(0, b.balance) * lvDaily(e)) : '—'}</td>
                <td>{central && <button className="btn sm gh" onClick={() => setOpF({ id: e.id, date: (e.leaveOpening || {}).date || td, days: String((e.leaveOpening || {}).days || '') })}>رصيد افتتاحي</button>}</td>
              </tr>); })}
            {emps.length === 0 && <tr><td colSpan={7}><div className="empty">لا موظفون.</div></td></tr>}
          </tbody>
        </table></div>
        <div className="note" style={{ marginTop: 8 }}>يُستحق الرصيد يوميًا: {lvCfg(org).annual} يومًا في السنة، وتصبح {lvCfg(org).after5} بعد خمس سنوات خدمة. إن كان للموظف رصيد قبل المنصة فأدخله «رصيدًا افتتاحيًا» بتاريخه، ويُحتسب الاستحقاق بعده.</div>
      </div>}

      {tab === 'prov' && central && <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 8 }}>
          {!LV.open ? <button className="btn sm pri" onClick={() => setLvStart({ month: td.slice(0, 7), post: true })}>تفعيل مخصص الإجازات في الدفاتر</button> : <>
            <Field label="الشهر"><input type="month" className="inp" value={month} onChange={e => setMonth(e.target.value)} /></Field>
            <button className="btn sm pri" disabled={LV.months.has(month) || month < LV.from || month > td.slice(0, 7)} onClick={postLv}>{LV.months.has(month) ? 'مُرحّل ✓' : 'ترحيل مخصص ' + month + ' (' + money(r2(sum(lvLines, l => l.amt))) + ')'}</button>
            <span className="badge b-mint">مُفعّل من {LV.from}</span><span className="badge b-dim">الرصيد في الدفاتر {money(lvTotal)}</span>
            {lvPending.length > 0 && <span className="badge b-amber">لم تُرحَّل: {lvPending.join('، ')}</span>}</>}
        </div>
        <div className="note">المخصص = رصيد أيام كل موظف × أجر يومه (الشامل ÷ 30). يُرحَّل شهريًا بالفرق: يرتفع بما يُستحق ويُرد بما يُؤخذ، فيُحمَّل المصروف وقت استحقاقه لا وقت أخذه.</div>
      </div>}

      {f && (
        <Modal title="طلب إجازة" icon={CalendarDays} onClose={() => setF(null)}
          foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={submit}><Check size={14} />إرسال للاعتماد</button></>}>
          <div className="grid g2">
            <Field label="الموظف"><select className="sel" value={f.employeeId} onChange={e => setF(x => ({ ...x, employeeId: e.target.value }))}>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            <Field label="نوع الإجازة"><select className="sel" value={f.type} onChange={e => setF(x => ({ ...x, type: e.target.value }))}>{Object.entries(LEAVE_TYPES).map(([k, t]) => <option key={k} value={k}>{t.ar}{t.max ? ' (حتى ' + t.max + ' يوم)' : ''}</option>)}</select></Field>
            <Field label="من"><input type="date" className="inp" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value, to: x.to < e.target.value ? e.target.value : x.to }))} /></Field>
            <Field label="إلى"><input type="date" className="inp" value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} /></Field>
          </div>
          <Field label="السبب / ملاحظة"><input className="inp" value={f.reason} onChange={e => setF(x => ({ ...x, reason: e.target.value }))} /></Field>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="badge b-brass">{nf} يوم</span>
            {f.type === 'annual' && fb && <span className={'badge ' + (fb.ok && fb.balance >= nf ? 'b-mint' : 'b-rose')}>الرصيد المتاح {fb.ok ? Math.floor(fb.balance) : '—'} يوم</span>}
            {fded > 0 && <span className="badge b-rose">خصم متوقع {money(fded)}</span>}
            {f.type === 'sick' && fplan.length > 0 && <span className="badge b-amber">تجاوز الثلاثين يومًا المدفوعة هذه السنة</span>}
          </div>
          {(() => { const er = f.employeeId && nf ? check(f) : ''; return er ? <div className="note" style={{ color: 'var(--rose)', marginTop: 6 }}>⚠ {er}</div> : null; })()}
        </Modal>
      )}
      {opF && (
        <Modal title={'رصيد إجازات افتتاحي — ' + empOf(opF.id).name} icon={CalendarDays} onClose={() => setOpF(null)}
          foot={<><button className="btn gh" onClick={() => setOpF(null)}>إلغاء</button><button className="btn pri" onClick={saveOpening}><Check size={14} />حفظ</button></>}>
          <div className="grid g2">
            <Field label="في تاريخ"><input type="date" className="inp" value={opF.date} onChange={e => setOpF(x => ({ ...x, date: e.target.value }))} /></Field>
            <Num label="الرصيد (أيام)" value={opF.days} onChange={v => setOpF(x => ({ ...x, days: v }))} />
          </div>
          <div className="note">يُحتسب الاستحقاق بعد هذا التاريخ، ولا تُخصم منه إلا الإجازات التي تبدأ بعده.</div>
        </Modal>
      )}
      {lvStart && (() => { const prevD = /^\d{4}-\d{2}$/.test(lvStart.month) ? lvAddD(lvStart.month + '-01', -1) : ''; const tot = prevD ? r2(sum(allEmps, e => lvRequired(org, ops, e, prevD))) : 0; return (
        <Modal title="تفعيل مخصص الإجازات" icon={CalendarDays} onClose={() => setLvStart(null)}
          foot={<><button className="btn gh" onClick={() => setLvStart(null)}>إلغاء</button><button className="btn pri" onClick={startLv}><Check size={14} />تفعيل</button></>}>
          <Field label="بداية المخصص (شهر)"><input type="month" className="inp" value={lvStart.month} onChange={e => setLvStart(x => ({ ...x, month: e.target.value }))} /></Field>
          <div className="mono-b" style={{ margin: '6px 0' }}><span>المتراكم حتى {prevD || '—'}</span><span className="num">{money(tot)}</span></div>
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '6px 0' }}><input type="radio" checked={!!lvStart.post} onChange={() => setLvStart(x => ({ ...x, post: true }))} />قيّد المتراكم: من ح/ الأرباح المبقاة إلى ح/ مخصص الإجازات</label>
          <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '6px 0' }}><input type="radio" checked={!lvStart.post} onChange={() => setLvStart(x => ({ ...x, post: false }))} />مسجّل مسبقًا في الأرصدة الافتتاحية (حساب 2204) — بلا قيد</label>
          <div className="note">أدخل الأرصدة الافتتاحية للموظفين من «الأرصدة» قبل التفعيل ليكون المتراكم صحيحًا.</div>
        </Modal>); })()}
    </div>
  );
}
