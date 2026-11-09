/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Clock, Wallet, AlertTriangle, Fingerprint, Scale, Printer, Download, Check } from 'lucide-react';
import { Kpi, LOCK_MSG, ROLES, defaultHrPolicies, makeXlsx, money, nowISO, otFromAttendance, otRateOf, periodLocked, printA4, rolePost, sum, today, uid } from '../../App.jsx';

export function OvertimeSheet({ org, ops, me, myBranches, scoped, commit, commitOrg, say }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [bf, setBf] = useState('');
  const [edit, setEdit] = useState({});            // empId → {hours, note}
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const pol = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const H = Number(pol.workHoursPerDay) > 0 ? Number(pol.workHoursPerDay) : 8;
  const cap = Number(pol.overtimeMaxHoursPerMonth) || 0;
  const basis = pol.otBasis === 'basic' ? 'basic' : 'actual';   // الافتراضي: الأجر الفعلي (نص المادة 107)
  const canPost = rolePost(me.role) && ROLES[me.role]?.scope !== 'own';
  const brs = (myBranches || []).filter(b => b.isActive !== false);
  const emps = (org.employees || []).filter(e => brs.some(b => b.id === e.branchId) && (!bf || e.branchId === bf) && e.status !== 'terminated' && e.isActive !== false);
  const posted = (scoped.advances || []).filter(a => a.type === 'overtime' && a.month === month);
  const accrualPosted = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === month);
  const locked = accrualPosted || periodLocked(org, month + '-28');
  useEffect(() => { setEdit({}); }, [month, bf]);
  const rows = emps.map(e => {
    const R = otRateOf(e, H, basis);
    const att = otFromAttendance(org, ops, e, month);
    const p = posted.filter(a => a.employeeId === e.id);
    const postedH = r2(sum(p, a => Number(a.hours) || 0)), postedAmt = r2(sum(p, a => a.amount));
    const ed = edit[e.id];
    const hours = ed && ed.hours !== undefined ? (Number(String(ed.hours).replace(/[^\d.]/g, '')) || 0) : (p.length ? postedH : att.hours);
    const src = ed && ed.hours !== undefined ? 'manual' : p.length ? (p[0].source || 'manual') : 'attendance';
    return { e, R, att, hours, amount: r2(hours * R.rate), postedH, postedAmt, isPosted: p.length > 0, src, note: (ed && ed.note) ?? ((p[0] || {}).note || ''), overCap: cap > 0 && hours > cap };
  });
  const totH = r2(sum(rows, r => r.hours)), totA = r2(sum(rows, r => r.amount));
  const dirty = rows.some(r => !r.isPosted ? r.hours > 0 : (Math.abs(r.hours - r.postedH) > 0.001 || Math.abs(r.amount - r.postedAmt) > 0.005));
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
  const setBasis = async (v) => {
    await commitOrg(d => ({ ...d, hrPolicies: { ...defaultHrPolicies(), ...(d.hrPolicies || {}), otBasis: v } }), { actionType: 'update', targetType: 'hr_policy', targetId: 'overtimeBasis', need: 'edit', title: 'عدّل أساس احتساب الإضافي', details: v === 'basic' ? 'الأساسي فقط' : 'الأجر الفعلي' });
  };
  const post = async () => {
    if (!canPost) return say('اعتماد الإضافي صلاحية الإدارة/المحاسبة', 'no');
    if (accrualPosted) return say('استحقاق رواتب ' + month + ' مُرحّل — لا يُعدّل الإضافي بعده', 'no');
    if (periodLocked(org, month + '-28')) return say(LOCK_MSG(month + '-28'), 'no');
    const ids = new Set(emps.map(e => e.id));
    const recs = rows.filter(r => r.hours > 0 && r.amount > 0).map(r => ({
      id: uid('ot'), employeeId: r.e.id, employeeName: r.e.name, branchId: r.e.branchId, branchName: brName(r.e.branchId),
      month, date: month + '-28', type: 'overtime', amount: r.amount, hours: r.hours, rate: r.R.rate, hourlyBasic: r.R.hBasic, hourlyActual: r.R.hActual,
      basis, hoursPerDay: H, source: r.src, note: r.note || '', reason: 'عمل إضافي ' + r.hours + ' ساعة × ' + r.R.rate.toFixed(2),
      createdByName: me.name, createdAt: nowISO()
    }));
    const ok = await commit(d => ({ ...d, advances: [...recs, ...(d.advances || []).filter(a => !(a.type === 'overtime' && a.month === month && ids.has(a.employeeId)))] }), {
      actionType: 'payroll_record', targetType: 'payroll', targetId: 'overtime-' + month, title: 'اعتمد مسير الأجور الإضافية',
      details: month + ' · ' + recs.length + ' موظف · ' + totH + ' ساعة · ' + money(totA) + ' ر.س'
    });
    if (ok) { setEdit({}); say('اعتُمد الإضافي وأُضيف إلى مسير رواتب ' + month + ' ✓'); }
  };
  const printOT = () => {
    const rws = rows.filter(r => r.hours > 0).map((r, i) => `<tr><td class="n">${i + 1}</td><td>${r.e.name}</td><td>${brName(r.e.branchId)}</td><td class="n">${money(r.R.base)}</td><td class="n">${money(r.R.actual)}</td><td class="n">${r.R.hBasic.toFixed(2)}</td><td class="n">${r.R.hActual.toFixed(2)}</td><td class="n">${r.R.rate.toFixed(2)}</td><td class="n">${r.hours}</td><td class="n">${money(r.amount)}</td><td style="width:70px"></td></tr>`).join('');
    printA4(org, 'مسير الأجور الإضافية — ' + month, 'ساعات اليوم ' + H + ' · الأساس: ' + (basis === 'basic' ? 'الأساسي' : 'الأجر الفعلي') + ' · المادة 107 من نظام العمل',
      `<style>@page{size:A4 landscape}</style><table><thead><tr><th>#</th><th>الموظف</th><th>الفرع</th><th>الأساسي</th><th>الأجر الفعلي</th><th>ساعة أساسية</th><th>ساعة فعلية</th><th>أجر ساعة الإضافي</th><th>الساعات</th><th>المبلغ</th><th>التوقيع</th></tr></thead><tbody>${rws}
      <tr class="tot"><td colspan="8">الإجمالي</td><td class="n">${totH}</td><td class="n">${money(totA)}</td><td></td></tr></tbody></table>
      <div class="box"><b>المعادلات:</b> أجر الساعة الأساسي = الأساسي ÷ 30 ÷ ${H} · أجر الساعة الفعلي = (الأساسي + البدلات) ÷ 30 ÷ ${H} ·
      أجر ساعة الإضافي = ${basis === 'basic' ? 'أجر الساعة الأساسي' : 'أجر الساعة الفعلي'} + 50% × أجر الساعة الأساسي · المبلغ = الساعات × أجر ساعة الإضافي.
      ساعات الإضافي من البصمة: ما زاد عن ${H} ساعات في يوم العمل، وكامل ساعات يوم الراحة الأسبوعية، مقرّبة لأقرب ربع ساعة لأسفل.</div>
      <div class="sign"><div>إعداد الموارد البشرية</div><div>المدير المباشر</div><div>اعتماد الإدارة المالية</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const xl = () => { try {
    const rr = [['الموظف', 'الفرع', 'الأساسي', 'الأجر الفعلي', 'أجر الساعة الأساسي', 'أجر الساعة الفعلي', 'أجر ساعة الإضافي', 'ساعات البصمة', 'منها أيام الراحة', 'الساعات المعتمدة', 'المبلغ', 'المصدر', 'ملاحظة'],
      ...rows.map(r => [r.e.name, brName(r.e.branchId), r.R.base, r.R.actual, r.R.hBasic, r.R.hActual, r.R.rate, r.att.hours, r.att.offH, r.hours, r.amount, r.src === 'attendance' ? 'البصمة' : 'يدوي', r.note])];
    const blob = makeXlsx([{ name: 'الإضافي ' + month, rows: rr }]); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'مسير_الإضافي_' + month + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500);
  } catch { say('تعذّر توليد Excel', 'no'); } };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="month" className="inp" style={{ width: 170 }} value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
        <select className="sel" style={{ width: 170 }} value={bf} onChange={e => setBf(e.target.value)}>
          <option value="">كل الفروع</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className={'badge ' + (locked ? 'b-dim' : posted.length ? 'b-mint' : 'b-amber')}>{accrualPosted ? 'مقفل — استحقاق الشهر مُرحّل' : locked ? 'الشهر مقفل محاسبيًا' : posted.length ? 'معتمد ومضاف للمسير' + (dirty ? ' · توجد تعديلات غير معتمدة' : '') : 'مسودة — غير معتمد'}</span>
      </div>
      {!pol.overtimeEnabled && <div className="note">⚠ احتساب العمل الإضافي غير مفعّل في سياسات الموارد البشرية — المسير يعمل للمراجعة والإعداد، وفعّله من «السياسات والأدوار».</div>}
      <div className="grid g4">
        <Kpi label="ساعات الإضافي" value={String(totH)} sub={rows.filter(r => r.hours > 0).length + ' موظف'} icon={Clock} color="#C8A24A" />
        <Kpi label="مبلغ الإضافي" value={money(totA)} sub={'يُضاف لمسير ' + month} icon={Wallet} color="#4FB286" />
        <Kpi label="فوق الحد الشهري" value={String(rows.filter(r => r.overCap).length)} sub={cap ? 'الحد ' + cap + ' ساعة' : 'بلا حد'} icon={AlertTriangle} color={rows.some(r => r.overCap) ? '#D9544D' : '#4FB286'} />
        <Kpi label="بصمات بلا انصراف" value={String(sum(rows, r => r.att.open))} sub="أيام لا تُحتسب حتى تُصحَّح" icon={Fingerprint} color={rows.some(r => r.att.open) ? '#E0A458' : '#4FB286'} />
      </div>
      <div className="card ot-f">
        <div className="card-t" style={{ marginBottom: 8 }}><Scale size={15} color="var(--brass)" />المعادلات (المادة 107 من نظام العمل)</div>
        <div className="ot-eq">
          <div><span>أجر الساعة الأساسي</span><b>= الأساسي ÷ 30 ÷ {H}</b></div>
          <div><span>أجر الساعة الفعلي</span><b>= (الأساسي + البدلات) ÷ 30 ÷ {H}</b></div>
          <div className="hl"><span>أجر ساعة الإضافي</span><b>{basis === 'basic' ? '= أجر الساعة الأساسي + 50% × أجر الساعة الأساسي = 1.5 × أجر الساعة الأساسي' : '= أجر الساعة الفعلي + 50% × أجر الساعة الأساسي'}</b></div>
          <div><span>مبلغ الإضافي</span><b>= عدد الساعات × أجر ساعة الإضافي</b></div>
          <div><span>ساعات البصمة</span><b>= ما زاد عن {H} ساعات يوميًا + كامل ساعات يوم الراحة (لأقرب ربع ساعة لأسفل)</b></div>
        </div>
        {canPost && <div className="row" style={{ gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>أساس أجر الساعة:</span>
          <button className={'btn sm' + (basis === 'actual' ? ' pri' : ' gh')} onClick={() => basis !== 'actual' && setBasis('actual')}>الأجر الفعلي (الأساسي + البدلات) — المادة 107</button>
          <button className={'btn sm' + (basis === 'basic' ? ' pri' : ' gh')} onClick={() => basis !== 'basic' && setBasis('basic')}>الأساسي فقط (= 1.5 × ساعة أساسية)</button>
        </div>}
      </div>
      <div className="card">
        <div className="card-h">
          <div className="card-t"><Clock size={15} color="var(--brass)" />مسير الأجور الإضافية — {month}</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={printOT}><Printer size={13} />طباعة</button>
            <button className="btn sm" onClick={xl}><Download size={13} />Excel</button>
          </div>
        </div>
        <div className="tw"><table className="tb is-tb ot-tb">
          <thead><tr><th>الموظف</th><th style={{ textAlign: 'end' }}>الأساسي</th><th style={{ textAlign: 'end' }}>الأجر الفعلي</th><th style={{ textAlign: 'end' }}>ساعة أساسية</th><th style={{ textAlign: 'end' }}>ساعة فعلية</th><th style={{ textAlign: 'end' }}>أجر ساعة الإضافي</th><th style={{ textAlign: 'end' }}>من البصمة</th><th style={{ textAlign: 'center' }}>الساعات المعتمدة</th><th style={{ textAlign: 'end' }}>المبلغ</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9}><div className="empty">لا موظفين نشطين في الفروع المحددة.</div></td></tr>}
            {rows.map(r => (
              <tr key={r.e.id} className={'is-line' + (r.overCap ? ' bad' : '')}>
                <td><b>{r.e.name}</b><div style={{ fontSize: 11, color: 'var(--faint)' }}>{brName(r.e.branchId)}{r.e.jobTitle ? ' · ' + r.e.jobTitle : ''}</div></td>
                <td className="is-amt"><span className="num">{money(r.R.base)}</span></td>
                <td className="is-amt"><span className="num">{money(r.R.actual)}</span></td>
                <td className="is-amt"><span className="num">{r.R.hBasic.toFixed(2)}</span></td>
                <td className="is-amt"><span className="num">{r.R.hActual.toFixed(2)}</span></td>
                <td className="is-amt"><span className="num" style={{ fontWeight: 700 }}>{r.R.rate.toFixed(2)}</span></td>
                <td className="is-amt"><span className="num">{r.att.hours}</span>{r.att.offH > 0 && <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>منها راحة {r.att.offH}</div>}{r.att.open > 0 && <div style={{ fontSize: 10.5, color: 'var(--amber)' }}>{r.att.open} بلا انصراف</div>}</td>
                <td style={{ textAlign: 'center' }}>
                  <input className="inp n ot-h" inputMode="decimal" disabled={locked || !canPost} value={edit[r.e.id]?.hours ?? String(r.hours)} onChange={ev => setEdit(x => ({ ...x, [r.e.id]: { ...(x[r.e.id] || {}), hours: ev.target.value } }))} aria-label={'ساعات ' + r.e.name} />
                  {r.src === 'manual' && Math.abs(r.hours - r.att.hours) > 0.001 && <div style={{ fontSize: 10.5, color: 'var(--amber)' }}>معدّل يدويًا</div>}
                  {r.overCap && <div style={{ fontSize: 10.5, color: 'var(--rose)' }}>فوق الحد {cap}</div>}
                </td>
                <td className="is-amt"><span className="num" style={{ fontWeight: 700 }}>{money(r.amount)}</span></td>
              </tr>))}
            {rows.length > 0 && <tr className="is-total"><td colSpan={7}>الإجمالي</td><td style={{ textAlign: 'center' }}><span className="num">{totH}</span></td><td className="is-amt"><span className="num">{money(totA)}</span></td></tr>}
          </tbody>
        </table></div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn pri" disabled={locked || !canPost || (!dirty && posted.length > 0)} onClick={post}><Check size={14} />{posted.length ? 'إعادة اعتماد الإضافي' : 'اعتماد الإضافي وإضافته للمسير'}</button>
          {Object.keys(edit).length > 0 && !locked && <button className="btn gh" onClick={() => setEdit({})}>تراجع عن التعديلات</button>}
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>بعد الاعتماد يظهر في «الرواتب والسلف» و«مسير الرواتب» ويدخل استحقاق الشهر وقيوده تلقائيًا. يُقفل بعد ترحيل استحقاق الشهر.</span>
        </div>
      </div>
    </div>
  );
}
