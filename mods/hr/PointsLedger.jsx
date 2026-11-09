/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Star, Settings, BarChart3, Fingerprint, Plus, Check, Trash2, Eye, X } from 'lucide-react';
import { Field, ROLES, defaultHrPolicies, defaultPointsRules, isoD, nowISO, onLeave, sha, today, uid } from '../../App.jsx';

export function PointsLedger({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const isCashier = me.role === 'cashier';
  const canManage = me.role === 'branch_manager' || isAll; // حركات يدوية: مدير الفرع + أدوار المركز
  const canRules = isAll; // قواعد النقاط التلقائية سياسة على مستوى الشركة: أدوار المركز فقط
  const branches = myBranches || [];
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const tolerance = Number(policies.lateToleranceMinutes) || 0;
  const rules = { ...defaultPointsRules(), ...(org.pointsRules || {}) };

  const [view, setView] = useState(isCashier ? 'kiosk' : 'ledger');
  useEffect(() => { if (isCashier && view !== 'kiosk') setView('kiosk'); }, [isCashier]); // eslint-disable-line
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => {
    if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || '');
  }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;
  const branchIds = branches.map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);

  const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
  const parseHM = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const monthFrom = ym + '-01';
  const monthTo = ym + '-31';

  // === النقاط التلقائية (مُشتقّة، لا تُخزَّن — نفس فلسفة buildAccounting) من م3/م4/م5 ===
  const autoFor = (emp, from, to) => {
    const c = { onTime: 0, late: 0, absent: 0, tasks: 0 };
    (ops.shiftAssignments || []).filter(a => a.empId === emp.id).forEach(a => {
      (a.shiftIds || []).forEach((sid, di) => {
        if (!sid) return;
        const ds = addDays(a.weekStart, di);
        if (ds < from || ds > to || ds > today()) return;
        const tpl = (ops.shiftTemplates || []).find(t => t.id === sid);
        const evs = (ops.attendanceEvents || []).filter(ev => ev.employeeId === emp.id && (ev.at || '').slice(0, 10) === ds).sort((x, y) => (x.at < y.at ? -1 : 1));
        const inEv = evs.find(ev => ev.type === 'in');
        if (!inEv) { if (ds < today() && !onLeave(ops, emp.id, ds)) c.absent++; return; }
        const inMin = new Date(inEv.at).getHours() * 60 + new Date(inEv.at).getMinutes();
        const lateBy = tpl ? inMin - parseHM(tpl.startTime) - tolerance : 0;
        if (lateBy > 0) c.late++; else c.onTime++;
      });
    });
    c.tasks = (ops.taskCompletions || []).filter(x => x.employeeId === emp.id && x.date >= from && x.date <= to).length
      + (ops.taskAssignments || []).filter(x => x.employeeId === emp.id && x.status === 'done' && (x.doneAt || '').slice(0, 10) >= from && (x.doneAt || '').slice(0, 10) <= to).length;
    const pts = rules.enabled ? c.onTime * Number(rules.onTime || 0) + c.late * Number(rules.late || 0) + c.absent * Number(rules.absent || 0) + c.tasks * Number(rules.taskDone || 0) : 0;
    return { ...c, pts };
  };
  const manualFor = (emp, from, to) => (ops.pointsEntries || []).filter(x => x.employeeId === emp.id && x.date >= from && x.date <= to).reduce((s, x) => s + Number(x.points || 0), 0);
  const ALL_FROM = '0000-00-00', ALL_TO = '9999-99-99';
  const balanceOf = (emp) => manualFor(emp, ALL_FROM, ALL_TO) + autoFor(emp, ALL_FROM, ALL_TO).pts;

  // === 1) حركات يدوية ===
  const [entF, setEntF] = useState({ empId: '', points: '', reason: '', date: today() });
  const entries = (ops.pointsEntries || []).filter(x => branchIds.includes(x.branchId)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const saveEntry = async () => {
    if (!branch) return;
    const emp = emps.find(e => e.id === entF.empId);
    const pts = Number(entF.points);
    if (!emp || !pts || !entF.reason) return say('اختر الموظف وأدخل عدد النقاط (موجب أو سالب) والسبب', 'no');
    const rec = { id: uid('pt'), branchId: branch.id, employeeId: emp.id, employeeName: emp.name, date: entF.date || today(), points: pts, reason: entF.reason, source: 'manual', createdBy: me.id, createdByName: me.name, createdAt: nowISO() };
    await commit(d => ({ ...d, pointsEntries: [rec, ...(d.pointsEntries || [])] }),
      { actionType: 'create', targetType: 'points_entry', targetId: rec.id, branchName: branch.name, title: pts > 0 ? 'إضافة نقاط لموظف' : 'خصم نقاط من موظف', details: emp.name + ': ' + (pts > 0 ? '+' : '') + pts + ' — ' + rec.reason });
    say('سُجِّلت الحركة ✓'); setEntF({ empId: '', points: '', reason: '', date: today() });
  };
  const delEntry = async (x) => {
    if (!window.confirm('حذف حركة النقاط «' + x.reason + '» (' + x.points + ') لـ' + x.employeeName + '؟')) return;
    await commit(d => ({ ...d, pointsEntries: (d.pointsEntries || []).filter(y => y.id !== x.id) }),
      { actionType: 'delete', targetType: 'points_entry', targetId: x.id, branchName: branch ? branch.name : '', title: 'حذف حركة نقاط', details: x.employeeName + ': ' + x.points });
    say('حُذفت الحركة');
  };

  // === 2) قواعد النقاط التلقائية ===
  const [rulesF, setRulesF] = useState(rules);
  const saveRules = async () => {
    const rec = { enabled: !!rulesF.enabled, onTime: Number(rulesF.onTime) || 0, late: Number(rulesF.late) || 0, absent: Number(rulesF.absent) || 0, taskDone: Number(rulesF.taskDone) || 0 };
    await commitOrg(d => ({ ...d, pointsRules: rec }),
      { actionType: 'update', targetType: 'points_rules', targetId: 'pointsRules', title: 'تعديل قواعد النقاط التلقائية', details: (rec.enabled ? 'مفعَّلة' : 'مُعطَّلة') + ' — حضور ' + rec.onTime + ' / تأخير ' + rec.late + ' / غياب ' + rec.absent + ' / مهمة ' + rec.taskDone });
    say('حُفظت قواعد النقاط ✓');
  };

  // === 3) لوحة الترتيب الشهرية ===
  const [boardScope, setBoardScope] = useState('branch');
  const boardEmps = boardScope === 'all' ? (org.employees || []).filter(e => e.isActive !== false && branchIds.includes(e.branchId)) : emps;
  const boardRows = boardEmps.map(e => {
    const auto = autoFor(e, monthFrom, monthTo);
    const manual = manualFor(e, monthFrom, monthTo);
    return { e, auto, manual, total: manual + auto.pts, branchName: ((org.branches || []).find(b => b.id === e.branchId) || {}).name || '' };
  }).sort((a, b) => b.total - a.total);

  // === 4) كشك الفرع: رصيدي بعد PIN ===
  const [kEmpId, setKEmpId] = useState('');
  const [kPin, setKPin] = useState('');
  const [kShown, setKShown] = useState(null); // employee object after verified PIN
  const kioskCheck = async () => {
    const emp = emps.find(e => e.id === kEmpId);
    if (!emp) return say('اختر الموظف', 'no');
    if (!/^\d{4,6}$/.test(kPin)) return say('أدخل رقم PIN المكوّن من 4 إلى 6 أرقام', 'no');
    const hash = await sha(kPin);
    const ph = (((ops.hrPins || []).find(p => p.employeeId === emp.id)) || {}).pinHash || '';
    if (!ph || ph !== hash) { setKPin(''); return say('رقم PIN غير صحيح', 'no'); }
    setKShown(emp); setKPin('');
  };

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }
  const signed = (n) => (n > 0 ? '+' : '') + n;

  return (
    <div className="grid" style={{ gap: 12 }}>
      {!isCashier && (
        <div className="card" style={{ padding: '8px 12px' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (view === 'ledger' ? ' pri' : ' gh')} onClick={() => setView('ledger')}><Star size={13} />دفتر النقاط</button>
              {canRules && <button className={'btn sm' + (view === 'rules' ? ' pri' : ' gh')} onClick={() => setView('rules')}><Settings size={13} />قواعد النقاط</button>}
              <button className={'btn sm' + (view === 'board' ? ' pri' : ' gh')} onClick={() => setView('board')}><BarChart3 size={13} />لوحة الترتيب</button>
              <button className={'btn sm' + (view === 'kiosk' ? ' pri' : ' gh')} onClick={() => setView('kiosk')}><Fingerprint size={13} />رصيدي (كشك)</button>
            </div>
            {branches.length > 1 && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {view === 'ledger' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {!rules.enabled && <div className="note">قواعد النقاط التلقائية <b>مُعطَّلة</b> حاليًا — الأرصدة أدناه من الحركات اليدوية فقط. {canRules ? 'فعِّلها من «قواعد النقاط».' : 'تفعيلها من أدوار المركز.'}</div>}
          {canManage && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Plus size={15} color="var(--brass)" />حركة نقاط يدوية</div>
              <div className="grid g3">
                <Field label="الموظف"><select className="inp sel" value={entF.empId} onChange={e => setEntF(f => ({ ...f, empId: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="النقاط (موجب للإضافة، سالب للخصم)"><input className="inp n" inputMode="numeric" value={entF.points} onChange={e => setEntF(f => ({ ...f, points: e.target.value.replace(/[^\d-]/g, '') }))} placeholder="+5 أو -3" /></Field>
                <Field label="التاريخ"><input type="date" className="inp" value={entF.date} onChange={e => setEntF(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="السبب (إلزامي)" style={{ gridColumn: '1 / -1' }}><input className="inp" value={entF.reason} onChange={e => setEntF(f => ({ ...f, reason: e.target.value }))} placeholder="مثال: تعامل ممتاز مع شكوى عميل" /></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn pri" onClick={saveEntry}><Check size={14} />تسجيل الحركة</button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>أرصدة النقاط — {branch.name}</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>يدوي</th><th>تلقائي</th><th>الرصيد</th></tr></thead>
                <tbody>
                  {emps.map(e => { const m = manualFor(e, ALL_FROM, ALL_TO); const a = autoFor(e, ALL_FROM, ALL_TO).pts; return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}</td>
                      <td className="num">{signed(m)}</td>
                      <td className="num">{signed(a)}</td>
                      <td><span className={'badge ' + (m + a > 0 ? 'b-mint' : m + a < 0 ? 'b-rose' : 'b-dim')}>{signed(m + a)}</span></td>
                    </tr>
                  ); })}
                  {emps.length === 0 && <tr><td colSpan={4}><div className="empty">لا يوجد موظفون نشطون لهذا الفرع.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>سجل الحركات اليدوية</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>التاريخ</th><th>الموظف</th><th>النقاط</th><th>السبب</th><th>بواسطة</th>{canManage && <th />}</tr></thead>
                <tbody>
                  {entries.filter(x => x.branchId === branch.id).map(x => (
                    <tr key={x.id}>
                      <td className="num">{x.date}</td>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{x.employeeName}</td>
                      <td><span className={'badge ' + (x.points > 0 ? 'b-mint' : 'b-rose')}>{signed(x.points)}</span></td>
                      <td style={{ fontSize: 12 }}>{x.reason}</td>
                      <td style={{ fontSize: 11.5 }}>{x.createdByName}</td>
                      {canManage && <td><button className="btn sm gh" onClick={() => delEntry(x)}><Trash2 size={13} /></button></td>}
                    </tr>
                  ))}
                  {entries.filter(x => x.branchId === branch.id).length === 0 && <tr><td colSpan={canManage ? 6 : 5}><div className="empty">لا توجد حركات يدوية بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'rules' && canRules && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><Settings size={15} color="var(--brass)" />قواعد النقاط التلقائية (على مستوى الشركة)</div>
          <div className="note" style={{ marginBottom: 10 }}>تُحسب تلقائيًا من الحضور الموثَّق (م3) مقابل الوردية المجدولة (م4) ومن إنجاز المهام (م5) — بلا تخزين مزدوج، أي تعديل هنا يعيد الاحتساب فورًا لكل الفترات. تبقى مُعطَّلة حتى تفعّلها صراحةً.</div>
          <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!rulesF.enabled} onChange={e => setRulesF(f => ({ ...f, enabled: e.target.checked }))} />
            <b>تفعيل النقاط التلقائية</b>
          </label>
          <div className="grid g2">
            <Field label="حضور في الوقت (لكل وردية)"><input className="inp n" value={rulesF.onTime} onChange={e => setRulesF(f => ({ ...f, onTime: e.target.value.replace(/[^\d-]/g, '') }))} /></Field>
            <Field label="تأخير (لكل وردية)"><input className="inp n" value={rulesF.late} onChange={e => setRulesF(f => ({ ...f, late: e.target.value.replace(/[^\d-]/g, '') }))} /></Field>
            <Field label="غياب عن وردية مجدولة"><input className="inp n" value={rulesF.absent} onChange={e => setRulesF(f => ({ ...f, absent: e.target.value.replace(/[^\d-]/g, '') }))} /></Field>
            <Field label="إنجاز مهمة (متكررة أو فردية)"><input className="inp n" value={rulesF.taskDone} onChange={e => setRulesF(f => ({ ...f, taskDone: e.target.value.replace(/[^\d-]/g, '') }))} /></Field>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn pri" onClick={saveRules}><Check size={14} />حفظ القواعد</button>
          </div>
        </div>
      )}

      {view === 'board' && branch && (
        <div className="card">
          <div className="card-h" style={{ marginBottom: 8 }}>
            <div className="card-t"><BarChart3 size={15} color="var(--brass)" />لوحة الترتيب — {boardScope === 'all' ? 'كل فروعي' : branch.name}</div>
            <div className="row" style={{ gap: 8 }}>
              <input type="month" className="inp" value={ym} onChange={e => setYm(e.target.value)} />
              {branches.length > 1 && <select className="inp sel" value={boardScope} onChange={e => setBoardScope(e.target.value)}><option value="branch">هذا الفرع</option><option value="all">كل فروعي</option></select>}
            </div>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>#</th><th>الموظف</th>{boardScope === 'all' && <th>الفرع</th>}<th>في الوقت</th><th>تأخير</th><th>غياب</th><th>مهام</th><th>يدوي</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {boardRows.map((r, i) => (
                  <tr key={r.e.id}>
                    <td className="num">{i + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{i === 0 && r.total > 0 ? '🏆 ' : ''}{r.e.name}</td>
                    {boardScope === 'all' && <td style={{ fontSize: 12 }}>{r.branchName}</td>}
                    <td className="num">{r.auto.onTime}</td>
                    <td className="num">{r.auto.late}</td>
                    <td className="num">{r.auto.absent}</td>
                    <td className="num">{r.auto.tasks}</td>
                    <td className="num">{signed(r.manual)}</td>
                    <td><span className={'badge ' + (r.total > 0 ? 'b-mint' : r.total < 0 ? 'b-rose' : 'b-dim')}>{signed(r.total)}</span></td>
                  </tr>
                ))}
                {boardRows.length === 0 && <tr><td colSpan={9}><div className="empty">لا يوجد موظفون نشطون.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'kiosk' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {!kShown ? (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Fingerprint size={15} color="var(--brass)" />رصيدي من النقاط — {branch.name}</div>
              <div className="grid g2">
                <Field label="الموظف"><select className="inp sel" value={kEmpId} onChange={e => setKEmpId(e.target.value)}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="رقم PIN"><input className="inp n" type="password" inputMode="numeric" value={kPin} onChange={e => setKPin(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && kioskCheck()} /></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn pri" onClick={kioskCheck}><Eye size={14} />عرض رصيدي</button>
              </div>
            </div>
          ) : (() => { const a = autoFor(kShown, monthFrom, monthTo); const m = manualFor(kShown, monthFrom, monthTo); const bal = balanceOf(kShown); const my = (ops.pointsEntries || []).filter(x => x.employeeId === kShown.id).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)).slice(0, 10); return (
            <div className="card">
              <div className="card-h" style={{ marginBottom: 8 }}>
                <div className="card-t"><Star size={15} color="var(--brass)" />{kShown.name}</div>
                <button className="btn sm gh" onClick={() => { setKShown(null); setKEmpId(''); }}><X size={13} />إغلاق</button>
              </div>
              <div style={{ textAlign: 'center', padding: '14px 0' }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>رصيدي الإجمالي</div>
                <div style={{ fontSize: 34, fontWeight: 800, color: bal >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{signed(bal)}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>هذا الشهر: يدوي {signed(m)} · تلقائي {signed(a.pts)} (في الوقت {a.onTime} · تأخير {a.late} · غياب {a.absent} · مهام {a.tasks})</div>
              </div>
              <div className="card-t" style={{ marginBottom: 6, fontSize: 12.5 }}>آخر الحركات اليدوية</div>
              {my.length === 0 ? <div className="empty">لا توجد حركات يدوية.</div> : my.map(x => (
                <div key={x.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
                  <span>{x.date} — {x.reason}</span>
                  <span className={'badge ' + (x.points > 0 ? 'b-mint' : 'b-rose')}>{signed(x.points)}</span>
                </div>
              ))}
            </div>
          ); })()}
        </div>
      )}
    </div>
  );
}
