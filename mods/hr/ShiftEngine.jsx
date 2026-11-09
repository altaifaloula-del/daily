/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Clock, CalendarDays, ShieldCheck, ArrowLeftRight, Send, Plus, Trash2, Check, X } from 'lucide-react';
import { Field, HR_WEEK_DAYS, Modal, ROLES, defaultHrPolicies, isoD, nowISO, onLeave, today, uid } from '../../App.jsx';

export function ShiftEngine({ org, ops, me, myBranches, commitOrg, commit, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canEdit = role.scope === 'own' || isAll; // تعديل: مدير الفرع + أدوار المركز — بلا تعديل للمدير الإقليمي (اطّلاع فقط)
  const canApproveTransfer = isAll; // اعتماد نقل الموظف بين الفروع: أدوار المركز فقط (أثر مالي/تنظيمي عابر للفروع)
  const branches = myBranches || [];
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const tolerance = Number(policies.lateToleranceMinutes) || 0;

  const [view, setView] = useState('templates');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => {
    if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || '');
  }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;
  const branchIds = branches.map(b => b.id);

  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const templates = (ops.shiftTemplates || []).filter(t => branch && t.branchId === branch.id);

  const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
  const weekdayOf = (ds) => new Date(ds + 'T00:00:00').getDay();
  const dNm = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'short' });
  const dDay = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  const parseHM = (t) => { const [h, m] = String(t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

  const [weekStart, setWeekStart] = useState(() => today());
  const D7 = [0, 1, 2, 3, 4, 5, 6];
  const days = D7.map(i => addDays(weekStart, i));

  // === 1) قوالب الورديات ===
  const [tplF, setTplF] = useState(null); // {id?, name, startTime, endTime, breakMinutes, days:[]}
  const saveTpl = async () => {
    if (!branch) return;
    if (!tplF.name || !tplF.startTime || !tplF.endTime) return say('أدخل الاسم ووقتي البداية والنهاية', 'no');
    const rec = { id: tplF.id || uid('shtpl'), branchId: branch.id, name: tplF.name, startTime: tplF.startTime, endTime: tplF.endTime, breakMinutes: Number(tplF.breakMinutes) || 0, days: tplF.days && tplF.days.length ? tplF.days : [0, 1, 2, 3, 4, 5, 6] };
    const exists = (ops.shiftTemplates || []).some(t => t.id === rec.id);
    await commit(d => ({ ...d, shiftTemplates: exists ? (d.shiftTemplates || []).map(t => t.id === rec.id ? rec : t) : [...(d.shiftTemplates || []), rec] }),
      { actionType: exists ? 'update' : 'create', targetType: 'shift_template', targetId: rec.id, branchName: branch.name, title: exists ? 'عدّل قالب وردية' : 'أضاف قالب وردية', details: branch.name + ' — ' + rec.name });
    say('حُفظ قالب الوردية ✓'); setTplF(null);
  };
  const delTpl = async (t) => {
    if (!window.confirm('حذف قالب «' + t.name + '»؟ التعيينات القائمة عليه ستظهر بلا قالب (لن تُحذف بياناتها).')) return;
    await commit(d => ({ ...d, shiftTemplates: (d.shiftTemplates || []).filter(x => x.id !== t.id) }),
      { actionType: 'delete', targetType: 'shift_template', targetId: t.id, branchName: branch.name, title: 'حذف قالب وردية', details: t.name });
    say('حُذف القالب ✓');
  };

  // === 2) تقويم التعيين الأسبوعي (ops.shiftAssignments — تُبقيها بجانب ops.attendanceEvents وطلبات التبديل/النقل
  // في نفس المستند كي يُعتمَد التبديل بكتابة ذرّية واحدة تُحدِّث التعيين وحالة الطلب معًا) ===
  const assignRecs = (ops.shiftAssignments || []).filter(a => a.weekStart === weekStart && branch && a.branchId === branch.id);
  const [draftAssign, setDraftAssign] = useState({}); // {empId: [7]}
  const shiftIdsOf = (empId) => {
    if (draftAssign[empId]) return draftAssign[empId];
    const r = assignRecs.find(a => a.empId === empId);
    return (r && r.shiftIds) || Array(7).fill('');
  };
  const setShiftId = (empId, di, val) => setDraftAssign(s => { const arr = [...shiftIdsOf(empId)]; arr[di] = val; return { ...s, [empId]: arr }; });
  const dirtyAssign = Object.keys(draftAssign).length > 0;
  const saveAssign = async () => {
    if (!branch) return;
    const recs = emps.map(e => ({ id: (assignRecs.find(a => a.empId === e.id) || {}).id || uid('shas'), weekStart, empId: e.id, branchId: branch.id, shiftIds: shiftIdsOf(e.id) }));
    await commit(d => ({ ...d, shiftAssignments: [...(d.shiftAssignments || []).filter(a => !(a.weekStart === weekStart && a.branchId === branch.id)), ...recs] }),
      { actionType: 'update', targetType: 'shift_assignment', targetId: weekStart, branchName: branch.name, title: 'حفظ تعيين ورديات الأسبوع', details: branch.name + ' — أسبوع ' + weekStart });
    setDraftAssign({}); say('حُفظ تعيين الأسبوع ✓');
  };
  const coverage = (di) => {
    const ds = days[di]; const wd = weekdayOf(ds);
    return templates.filter(t => (t.days || []).includes(wd)).map(t => ({ t, n: emps.filter(e => shiftIdsOf(e.id)[di] === t.id).length }));
  };

  // === 3) مطابقة الحضور الفعلي بالجدول ===
  const matchRows = [];
  emps.forEach(e => {
    D7.forEach(di => {
      const shiftId = shiftIdsOf(e.id)[di];
      if (!shiftId) return;
      const tpl = templates.find(t => t.id === shiftId);
      const ds = days[di];
      if (ds > today()) { matchRows.push({ e, ds, tpl, status: 'upcoming' }); return; }
      const evs = (ops.attendanceEvents || []).filter(ev => ev.employeeId === e.id && (ev.at || '').slice(0, 10) === ds).sort((a, b) => a.at < b.at ? -1 : 1);
      const inEv = evs.find(ev => ev.type === 'in');
      const outEvs = evs.filter(ev => ev.type === 'out');
      const outEv = outEvs[outEvs.length - 1];
      if (!inEv) { matchRows.push({ e, ds, tpl, status: onLeave(ops, e.id, ds) ? 'leave' : 'absent' }); return; }
      const inMin = new Date(inEv.at).getHours() * 60 + new Date(inEv.at).getMinutes();
      const lateBy = tpl ? inMin - parseHM(tpl.startTime) - tolerance : 0;
      let status = lateBy > 0 ? 'late' : 'on_time';
      let extra = lateBy > 0 ? lateBy : 0;
      if (outEv) {
        const outMin = new Date(outEv.at).getHours() * 60 + new Date(outEv.at).getMinutes();
        const earlyBy = tpl ? parseHM(tpl.endTime) - outMin - tolerance : 0;
        if (earlyBy > 0) { status = status === 'late' ? 'late_early' : 'early'; extra = Math.max(extra, earlyBy); }
      } else if (ds < today()) { status = status === 'late' ? 'late_nocheckout' : 'no_checkout'; }
      matchRows.push({ e, ds, tpl, status, extra, inEv, outEv });
    });
  });
  const matchLabel = { upcoming: ['قادم', 'b-dim'], absent: ['غياب', 'b-rose'], leave: ['إجازة معتمدة', 'b-sky'], on_time: ['في الوقت', 'b-mint'], late: ['تأخير', 'b-amber'], early: ['انصراف مبكر', 'b-amber'], late_early: ['تأخير + انصراف مبكر', 'b-rose'], no_checkout: ['لم يُسجَّل انصراف', 'b-amber'], late_nocheckout: ['تأخير + لم يُسجَّل انصراف', 'b-rose'] };

  // === 4) طلبات تبديل الوردية ===
  const [swapF, setSwapF] = useState({ di: 0, empA: '', empB: '' });
  const swapReqs = (ops.shiftSwapRequests || []).filter(r => branchIds.includes(r.branchId)).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  const requestSwap = async () => {
    if (!branch || !swapF.empA || !swapF.empB || swapF.empA === swapF.empB) return say('اختر موظفين مختلفين', 'no');
    const rec = { id: uid('swap'), weekStart, day: Number(swapF.di), branchId: branch.id, branchName: branch.name, empFromId: swapF.empA, empFromName: emps.find(e => e.id === swapF.empA)?.name || '', empToId: swapF.empB, empToName: emps.find(e => e.id === swapF.empB)?.name || '', status: 'pending', requestedBy: me.id, requestedByName: me.name, requestedAt: nowISO() };
    await commit(d => ({ ...d, shiftSwapRequests: [rec, ...(d.shiftSwapRequests || [])] }),
      { actionType: 'create', targetType: 'shift_swap', targetId: rec.id, branchName: branch.name, title: 'طلب تبديل وردية', details: rec.empFromName + ' ↔ ' + rec.empToName + ' — ' + HR_WEEK_DAYS[rec.day].ar });
    say('أُرسل طلب التبديل ✓'); setSwapF({ di: 0, empA: '', empB: '' });
  };
  // v26.1 — إلغاء طلب معلّق (تبديل/نقل) قبل البتّ فيه
  const cancelSwap = async (r) => {
    if (r.status !== 'pending' || !window.confirm('إلغاء طلب التبديل بين ' + r.empFromName + ' و' + r.empToName + '؟')) return;
    await commit(d => ({ ...d, shiftSwapRequests: (d.shiftSwapRequests || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'shift_swap', targetId: r.id, branchName: r.branchName, title: 'إلغاء طلب تبديل وردية', details: r.empFromName + ' ↔ ' + r.empToName });
    say('أُلغي الطلب');
  };
  const cancelTransfer = async (r) => {
    if (r.status !== 'pending' || !window.confirm('إلغاء طلب نقل «' + r.employeeName + '» إلى ' + r.toBranchName + '؟')) return;
    await commit(d => ({ ...d, branchTransferRequests: (d.branchTransferRequests || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'branch_transfer', targetId: r.id, branchName: r.fromBranchName, title: 'إلغاء طلب نقل موظف', details: r.employeeName });
    say('أُلغي الطلب');
  };
  const decideSwap = async (r, approve) => {
    if (approve) {
      const recA = (ops.shiftAssignments || []).find(a => a.weekStart === r.weekStart && a.branchId === r.branchId && a.empId === r.empFromId);
      const recB = (ops.shiftAssignments || []).find(a => a.weekStart === r.weekStart && a.branchId === r.branchId && a.empId === r.empToId);
      const arrA = (recA && recA.shiftIds) || Array(7).fill('');
      const arrB = (recB && recB.shiftIds) || Array(7).fill('');
      const newArrA = [...arrA]; const newArrB = [...arrB];
      const tmp = newArrA[r.day]; newArrA[r.day] = newArrB[r.day]; newArrB[r.day] = tmp;
      await commit(d => {
        let list = (d.shiftAssignments || []).slice();
        const upsert = (empId, arr) => {
          const idx = list.findIndex(a => a.weekStart === r.weekStart && a.branchId === r.branchId && a.empId === empId);
          if (idx >= 0) list[idx] = { ...list[idx], shiftIds: arr };
          else list.push({ id: uid('shas'), weekStart: r.weekStart, branchId: r.branchId, empId, shiftIds: arr });
        };
        upsert(r.empFromId, newArrA); upsert(r.empToId, newArrB);
        return { ...d, shiftAssignments: list, shiftSwapRequests: (d.shiftSwapRequests || []).map(x => x.id === r.id ? { ...x, status: 'approved', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO() } : x) };
      }, { actionType: 'update', targetType: 'shift_swap', targetId: r.id, branchName: r.branchName, title: 'اعتماد تبديل وردية', details: r.empFromName + ' ↔ ' + r.empToName });
      say('اعتُمد التبديل وطُبِّق على الجدول ✓');
    } else {
      await commit(d => ({ ...d, shiftSwapRequests: (d.shiftSwapRequests || []).map(x => x.id === r.id ? { ...x, status: 'rejected', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO() } : x) }),
        { actionType: 'update', targetType: 'shift_swap', targetId: r.id, branchName: r.branchName, title: 'رفض تبديل وردية', details: r.empFromName + ' ↔ ' + r.empToName });
      say('رُفض الطلب');
    }
  };

  // === 5) طلبات نقل موظف بين الفروع ===
  const [trF, setTrF] = useState({ empId: '', toBranchId: '', note: '' });
  const transferReqs = (ops.branchTransferRequests || []).filter(r => branchIds.includes(r.fromBranchId) || isAll).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  const requestTransfer = async () => {
    if (!branch || !trF.empId || !trF.toBranchId) return say('اختر الموظف والفرع الجديد', 'no');
    const emp = (org.employees || []).find(x => x.id === trF.empId);
    const toB = (org.branches || []).find(x => x.id === trF.toBranchId);
    const rec = { id: uid('trreq'), branchId: branch.id, employeeId: emp.id, employeeName: emp.name, fromBranchId: branch.id, fromBranchName: branch.name, toBranchId: toB.id, toBranchName: toB.name, note: trF.note || '', status: 'pending', requestedBy: me.id, requestedByName: me.name, requestedAt: nowISO() };
    await commit(d => ({ ...d, branchTransferRequests: [rec, ...(d.branchTransferRequests || [])] }),
      { actionType: 'create', targetType: 'branch_transfer', targetId: rec.id, branchName: branch.name, title: 'طلب نقل موظف بين الفروع', details: emp.name + ': ' + branch.name + ' ← ' + toB.name });
    say('أُرسل طلب النقل ✓'); setTrF({ empId: '', toBranchId: '', note: '' });
  };
  const decideTransfer = async (r, approve) => {
    if (approve) {
      // v24.0: نقل الموظف في org (أدوار المركز تكتبه) ثم حالة الطلب في مستند الفرع — بترتيب يجعل إعادة المحاولة آمنة
      const ok1 = await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === r.employeeId ? { ...x, branchId: r.toBranchId } : x) }),
        { actionType: 'update', targetType: 'branch_transfer', targetId: r.id, branchName: r.toBranchName, title: 'اعتماد نقل موظف بين الفروع', details: r.employeeName + ': ' + r.fromBranchName + ' ← ' + r.toBranchName });
      if (!ok1) return;
      await commit(d => ({ ...d, branchTransferRequests: (d.branchTransferRequests || []).map(x => x.id === r.id ? { ...x, status: 'approved', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO() } : x) }));
      say('اعتُمد النقل — الموظف الآن ضمن ' + r.toBranchName + ' ✓');
    } else {
      await commit(d => ({ ...d, branchTransferRequests: (d.branchTransferRequests || []).map(x => x.id === r.id ? { ...x, status: 'rejected', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO() } : x) }),
        { actionType: 'update', targetType: 'branch_transfer', targetId: r.id, branchName: r.fromBranchName, title: 'رفض نقل موظف بين الفروع', details: r.employeeName });
      say('رُفض الطلب');
    }
  };

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'templates' ? ' pri' : ' gh')} onClick={() => setView('templates')}><Clock size={13} />قوالب الورديات</button>
            <button className={'btn sm' + (view === 'calendar' ? ' pri' : ' gh')} onClick={() => setView('calendar')}><CalendarDays size={13} />التعيين الأسبوعي</button>
            <button className={'btn sm' + (view === 'match' ? ' pri' : ' gh')} onClick={() => setView('match')}><ShieldCheck size={13} />مطابقة الحضور</button>
            <button className={'btn sm' + (view === 'swap' ? ' pri' : ' gh')} onClick={() => setView('swap')}><ArrowLeftRight size={13} />تبديل وردية</button>
            <button className={'btn sm' + (view === 'transfer' ? ' pri' : ' gh')} onClick={() => setView('transfer')}><Send size={13} />نقل موظف</button>
          </div>
          {branches.length > 1 && (
            <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {view === 'templates' && branch && (
        <div className="card">
          <div className="card-h" style={{ marginBottom: 8 }}>
            <div className="card-t"><Clock size={15} color="var(--brass)" />قوالب الورديات — {branch.name}</div>
            {canEdit && <button className="btn sm pri" onClick={() => setTplF({ name: '', startTime: '08:00', endTime: '16:00', breakMinutes: 0, days: [0, 1, 2, 3, 4, 5, 6] })}><Plus size={13} />قالب جديد</button>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الاسم</th><th>البداية</th><th>النهاية</th><th>الاستراحة</th><th>أيام التطبيق</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{t.name}</td>
                    <td className="num">{t.startTime}</td>
                    <td className="num">{t.endTime}</td>
                    <td className="num">{t.breakMinutes || 0} د</td>
                    <td style={{ fontSize: 11 }}>{(t.days || []).map(d => HR_WEEK_DAYS.find(x => x.v === d)?.ar.slice(0, 3)).join('، ')}</td>
                    {canEdit && <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn sm gh" onClick={() => setTplF({ ...t })}>تعديل</button>
                        <button className="btn sm gh" onClick={() => delTpl(t)}><Trash2 size={13} /></button>
                      </div>
                    </td>}
                  </tr>
                ))}
                {templates.length === 0 && <tr><td colSpan={canEdit ? 6 : 5}><div className="empty">لا توجد قوالب ورديات لهذا الفرع بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tplF && (
        <Modal title={tplF.id ? 'تعديل قالب وردية' : 'قالب وردية جديد'} icon={Clock} onClose={() => setTplF(null)}
          foot={<>
            <button className="btn gh" onClick={() => setTplF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveTpl}><Check size={14} />حفظ</button>
          </>}>
          <div className="grid" style={{ gap: 10 }}>
            <Field label="اسم الوردية">
              <input className="inp" autoFocus value={tplF.name} onChange={e => setTplF(f => ({ ...f, name: e.target.value }))} placeholder="صباحية" />
            </Field>
            <div className="grid g2">
              <Field label="وقت البداية"><input type="time" className="inp" value={tplF.startTime} onChange={e => setTplF(f => ({ ...f, startTime: e.target.value }))} /></Field>
              <Field label="وقت النهاية"><input type="time" className="inp" value={tplF.endTime} onChange={e => setTplF(f => ({ ...f, endTime: e.target.value }))} /></Field>
            </div>
            <Field label="مدة الاستراحة (دقائق)">
              <input className="inp n" inputMode="numeric" value={tplF.breakMinutes} onChange={e => setTplF(f => ({ ...f, breakMinutes: e.target.value.replace(/\D/g, '') }))} />
            </Field>
            <Field label="أيام التطبيق">
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                {HR_WEEK_DAYS.map(d => (
                  <label key={d.v} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={(tplF.days || []).includes(d.v)}
                      onChange={e => setTplF(f => ({ ...f, days: e.target.checked ? [...(f.days || []), d.v] : (f.days || []).filter(x => x !== d.v) }))} />
                    {d.ar}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Modal>
      )}

      {view === 'calendar' && branch && (
        <div className="card">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            <button className="btn sm gh" onClick={() => { setWeekStart(w => addDays(w, -7)); setDraftAssign({}); }}>▶ الأسبوع السابق</button>
            <input type="date" className="inp" style={{ width: 150 }} value={weekStart} onChange={e => { if (e.target.value) { setWeekStart(e.target.value); setDraftAssign({}); } }} />
            <button className="btn sm gh" onClick={() => { setWeekStart(w => addDays(w, 7)); setDraftAssign({}); }}>الأسبوع التالي ◀</button>
            <div style={{ flex: 1 }} />
            {canEdit && dirtyAssign && <button className="btn sm pri" onClick={saveAssign}><Check size={14} />حفظ تعيين الأسبوع</button>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th>{days.map((ds, di) => <th key={di} style={{ textAlign: 'center', minWidth: 90 }}>{dNm(ds)}<div style={{ fontSize: 9, color: 'var(--faint)', fontWeight: 400 }}>{dDay(ds)}</div></th>)}</tr></thead>
              <tbody>
                {emps.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}</td>
                    {D7.map(di => {
                      const wd = weekdayOf(days[di]);
                      const opts = templates.filter(t => (t.days || []).includes(wd));
                      return (
                        <td key={di} style={{ textAlign: 'center' }}>
                          <select className="inp sel" style={{ width: 84, fontSize: 11 }} disabled={!canEdit} value={shiftIdsOf(e.id)[di] || ''} onChange={ev => setShiftId(e.id, di, ev.target.value)}>
                            <option value="">— إجازة —</option>
                            {opts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {emps.length === 0 && <tr><td colSpan={8}><div className="empty">لا يوجد موظفون في هذا الفرع بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
          {templates.length > 0 && (
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              {D7.map(di => {
                const cov = coverage(di).filter(c => c.n === 0);
                return cov.length ? <span key={di} className="badge b-amber">{dNm(days[di])}: لا تغطية لـ{cov.map(c => c.t.name).join('، ')}</span> : null;
              })}
            </div>
          )}
        </div>
      )}

      {view === 'match' && branch && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><ShieldCheck size={15} color="var(--brass)" />مطابقة الحضور الفعلي بالجدول المعيَّن — {branch.name}</div>
          <div className="note" style={{ marginBottom: 10 }}>تقارن هذه الشاشة حركات الحضور الفعلية (من «الحضور الموثَّق») بوقت بداية/نهاية الوردية المُعيَّنة لكل موظف — بلا أي حجب أو منع، تصنيف معلوماتي فقط لأسبوع {weekStart}.</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th><th>اليوم</th><th>الوردية</th><th>الحضور الفعلي</th><th>الانصراف الفعلي</th><th>الحالة</th></tr></thead>
              <tbody>
                {matchRows.map((r, i) => {
                  const lb = matchLabel[r.status];
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.e.name}</td>
                      <td style={{ fontSize: 12 }}>{dNm(r.ds)} {dDay(r.ds)}</td>
                      <td style={{ fontSize: 12 }}>{r.tpl ? r.tpl.name + ' (' + r.tpl.startTime + '-' + r.tpl.endTime + ')' : 'قالب محذوف'}</td>
                      <td className="num">{r.inEv ? new Date(r.inEv.at).toLocaleTimeString('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="num">{r.outEv ? new Date(r.outEv.at).toLocaleTimeString('ar-SA-u-ca-gregory-nu-latn', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td><span className={'badge ' + lb[1]}>{lb[0]}{r.extra ? ' (' + r.extra + 'د)' : ''}</span></td>
                    </tr>
                  );
                })}
                {matchRows.length === 0 && <tr><td colSpan={6}><div className="empty">لا تعيينات ورديات لهذا الأسبوع بعد — عيّن من «التعيين الأسبوعي».</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'swap' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canEdit && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><ArrowLeftRight size={15} color="var(--brass)" />طلب تبديل وردية جديد</div>
              <div className="grid g3">
                <Field label="اليوم"><select className="inp sel" value={swapF.di} onChange={e => setSwapF(f => ({ ...f, di: e.target.value }))}>{HR_WEEK_DAYS.map(d => <option key={d.v} value={d.v}>{d.ar}</option>)}</select></Field>
                <Field label="الموظف الأول"><select className="inp sel" value={swapF.empA} onChange={e => setSwapF(f => ({ ...f, empA: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="الموظف الثاني"><select className="inp sel" value={swapF.empB} onChange={e => setSwapF(f => ({ ...f, empB: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn pri" onClick={requestSwap}><Send size={14} />إرسال طلب التبديل</button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>طلبات التبديل</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>اليوم</th><th>الموظفان</th><th>الحالة</th>{canEdit && <th />}</tr></thead>
                <tbody>
                  {swapReqs.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontSize: 12 }}>{HR_WEEK_DAYS[r.day]?.ar} · {r.weekStart}</td>
                      <td style={{ fontSize: 12.5, fontWeight: 600 }}>{r.empFromName} ↔ {r.empToName}</td>
                      <td><span className={'badge ' + (r.status === 'approved' ? 'b-mint' : r.status === 'rejected' ? 'b-rose' : 'b-amber')}>{r.status === 'approved' ? 'معتمد' : r.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}</span></td>
                      {canEdit && <td>
                        {r.status === 'pending' && <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                          <button className="btn sm pri" onClick={() => decideSwap(r, true)}><Check size={13} />اعتماد</button>
                          <button className="btn sm gh" onClick={() => decideSwap(r, false)}><X size={13} />رفض</button>
                          <button className="btn sm gh" title="إلغاء الطلب" onClick={() => cancelSwap(r)}><Trash2 size={13} /></button>
                        </div>}
                      </td>}
                    </tr>
                  ))}
                  {swapReqs.length === 0 && <tr><td colSpan={canEdit ? 4 : 3}><div className="empty">لا توجد طلبات تبديل بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'transfer' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canEdit && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Send size={15} color="var(--brass)" />طلب نقل موظف إلى فرع آخر</div>
              <div className="grid g3">
                <Field label="الموظف"><select className="inp sel" value={trF.empId} onChange={e => setTrF(f => ({ ...f, empId: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="الفرع الجديد"><select className="inp sel" value={trF.toBranchId} onChange={e => setTrF(f => ({ ...f, toBranchId: e.target.value }))}><option value="">اختر</option>{(org.branches || []).filter(b => b.id !== branch.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
                <Field label="ملاحظة (اختياري)"><input className="inp" value={trF.note} onChange={e => setTrF(f => ({ ...f, note: e.target.value }))} /></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn pri" onClick={requestTransfer}><Send size={14} />إرسال طلب النقل</button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>طلبات النقل {canApproveTransfer ? '(كل الفروع)' : '(فرعي)'}</div>
            <div className="note" style={{ marginBottom: 8 }}>اعتماد النقل يُغيِّر فرع الموظف فعليًا فور الموافقة — متاح لأدوار المركز فقط لأثره المالي والتنظيمي العابر للفروع.</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>من</th><th>إلى</th><th>الحالة</th>{(canApproveTransfer || canEdit) && <th />}</tr></thead>
                <tbody>
                  {transferReqs.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.employeeName}</td>
                      <td style={{ fontSize: 12 }}>{r.fromBranchName}</td>
                      <td style={{ fontSize: 12 }}>{r.toBranchName}</td>
                      <td><span className={'badge ' + (r.status === 'approved' ? 'b-mint' : r.status === 'rejected' ? 'b-rose' : 'b-amber')}>{r.status === 'approved' ? 'معتمد' : r.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}</span></td>
                      {(canApproveTransfer || canEdit) && <td>
                        {r.status === 'pending' && <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                          {canApproveTransfer && <button className="btn sm pri" onClick={() => decideTransfer(r, true)}><Check size={13} />اعتماد</button>}
                          {canApproveTransfer && <button className="btn sm gh" onClick={() => decideTransfer(r, false)}><X size={13} />رفض</button>}
                          <button className="btn sm gh" title="إلغاء الطلب" onClick={() => cancelTransfer(r)}><Trash2 size={13} /></button>
                        </div>}
                      </td>}
                    </tr>
                  ))}
                  {transferReqs.length === 0 && <tr><td colSpan={(canApproveTransfer || canEdit) ? 5 : 4}><div className="empty">لا توجد طلبات نقل بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
