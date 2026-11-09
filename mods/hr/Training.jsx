/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Stamp, ClipboardCheck, FileText, Check, Trash2, Plus } from 'lucide-react';
import { Field, ROLES, TRAIN_STATUS_AR, activeTrainingRecord, defaultHrPolicies, defaultTrainingPrograms, isoD, nowISO, programRequiredFor, today, trainingExpiryOf, trainingStatusNow, uid } from '../../App.jsx';

export function Training({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canManage = me.role === 'branch_manager' || isAll;   // تسجيل/تحديث سجلات التدريب
  const canConfig = isAll;                                   // البرامج المركزية
  const branches = myBranches || [];
  const pol = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const alertDays = Number(pol.trainingExpiryAlertDays) || 30;
  const programs = (org.trainingPrograms && org.trainingPrograms.length) ? org.trainingPrograms : defaultTrainingPrograms();
  const td = today();

  const [view, setView] = useState('records');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => { if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || ''); }, [branches, branchId]); // eslint-disable-line
  const branch = branches.find(b => b.id === branchId) || null;
  const branchIds = branches.map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const allRecs = (ops.hrTraining || []).filter(r => branchIds.includes(r.branchId)).sort((a, b) => ((a.completedDate || a.plannedDate || '') < (b.completedDate || b.plannedDate || '') ? 1 : -1));
  const progById = (id) => programs.find(p => p.id === id) || null;
  const statusBadge = (st) => { const cls = st === 'completed' ? 'b-mint' : st === 'expired' ? 'b-rose' : st === 'in_progress' ? 'b-sky' : 'b-amber'; return <span className={'badge ' + cls}>{TRAIN_STATUS_AR[st] || st}</span>; };

  // ===== 1) تسجيل/تحديث سجل تدريب =====
  const emptyF = { id: '', empId: '', programId: '', status: 'completed', plannedDate: td, completedDate: td, score: '', result: 'pass', certNo: '', note: '' };
  const [f, setF] = useState(emptyF);
  const selProg = progById(f.programId);
  const previewExpiry = (f.status === 'completed' && selProg) ? trainingExpiryOf(f.completedDate, selProg.validityMonths) : '';
  const editRec = (r) => setF({ id: r.id, empId: r.employeeId, programId: r.programId, status: r.status, plannedDate: r.plannedDate || td, completedDate: r.completedDate || td, score: r.score != null ? String(r.score) : '', result: r.result || '', certNo: r.certNo || '', note: r.note || '' });
  const submit = async () => {
    if (!branch) return;
    const emp = emps.find(e => e.id === f.empId); const prog = progById(f.programId);
    if (!emp) return say('اختر الموظف', 'no');
    if (!prog) return say('اختر البرنامج التدريبي', 'no');
    const completedDate = f.status === 'completed' ? (f.completedDate || td) : '';
    const rec = {
      id: f.id || uid('tr'), branchId: branch.id, branchName: branch.name, employeeId: emp.id, employeeName: emp.name,
      programId: prog.id, programTitle: prog.title, status: f.status,
      plannedDate: f.plannedDate || '', completedDate, expiryDate: trainingExpiryOf(completedDate, prog.validityMonths),
      score: f.score === '' ? null : Number(f.score), result: f.status === 'completed' ? (f.result || 'pass') : '', certNo: (f.certNo || '').trim(), note: (f.note || '').trim(),
      recordedBy: me.id, recordedByName: me.name, recordedAt: nowISO()
    };
    const ok = await commit(d => ({ ...d, hrTraining: f.id ? (d.hrTraining || []).map(x => x.id === f.id ? rec : x) : [rec, ...(d.hrTraining || [])] }),
      { actionType: f.id ? 'update' : 'create', targetType: 'training_record', targetId: rec.id, branchName: branch.name, title: (f.id ? 'تحديث' : 'تسجيل') + ' سجل تدريب', details: emp.name + ' · ' + prog.title + ' · ' + (TRAIN_STATUS_AR[rec.status] || rec.status) + (rec.expiryDate ? ' · ينتهي ' + rec.expiryDate : '') });
    if (ok) { say('حُفظ سجل التدريب ✓'); setF({ ...emptyF, plannedDate: f.plannedDate, completedDate: f.completedDate }); }
  };
  const delRec = async (r) => {
    if (!window.confirm('حذف سجل تدريب «' + r.programTitle + '» لـ' + r.employeeName + '؟')) return;
    await commit(d => ({ ...d, hrTraining: (d.hrTraining || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'training_record', targetId: r.id, branchName: r.branchName, title: 'حذف سجل تدريب', details: r.employeeName + ' · ' + r.programTitle });
    say('حُذف السجل');
  };

  // ===== 2) البرامج (المركز) =====
  const [cf, setCf] = useState(() => programs.map(p => ({ ...p, requiredJobTitles: (p.requiredJobTitles || []).join('، ') })));
  const saveProgs = async () => {
    const list = (cf || []).filter(p => String(p.title || '').trim()).map(p => ({
      id: (p.id || uid('tp')), title: p.title.trim(), category: (p.category || '').trim(), validityMonths: Number(p.validityMonths) || 0,
      mandatory: !!p.mandatory, requiredJobTitles: String(p.requiredJobTitles || '').split(/[،,]/).map(s => s.trim()).filter(Boolean), provider: (p.provider || '').trim()
    }));
    const ok = await commitOrg(d => ({ ...d, trainingPrograms: list }),
      { actionType: 'update', targetType: 'settings', targetId: 'trainingPrograms', title: 'ضبط البرامج التدريبية', details: list.length + ' برنامجًا · ' + list.filter(p => p.mandatory).length + ' إلزامي' });
    if (ok) say('حُفظت البرامج ✓');
  };

  if (!branch && branches.length === 0) return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;

  // بيانات المصفوفة: الموظفون × البرامج الإلزامية المنطبقة
  const mandProgs = programs.filter(p => p.mandatory);
  const cellFor = (emp, prog) => {
    if (!programRequiredFor(prog, emp)) return { t: 'na', ar: '—', cls: 'b-dim' };
    const rec = activeTrainingRecord(ops.hrTraining || [], emp.id, prog.id, td);
    if (!rec) return { t: 'missing', ar: 'مفقود', cls: 'b-rose' };
    if (rec.expiryDate) {
      const soon = (() => { const d = new Date(td + 'T00:00:00'); d.setDate(d.getDate() + alertDays); return rec.expiryDate <= isoD(d); })();
      if (soon) return { t: 'soon', ar: 'ينتهي ' + rec.expiryDate, cls: 'b-amber' };
      return { t: 'ok', ar: 'ساري حتى ' + rec.expiryDate, cls: 'b-mint' };
    }
    return { t: 'ok', ar: 'مكتمل', cls: 'b-mint' };
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'records' ? ' pri' : ' gh')} onClick={() => setView('records')}><Stamp size={13} />سجل التدريب</button>
            <button className={'btn sm' + (view === 'matrix' ? ' pri' : ' gh')} onClick={() => setView('matrix')}><ClipboardCheck size={13} />مصفوفة الامتثال</button>
            {canConfig && <button className={'btn sm' + (view === 'programs' ? ' pri' : ' gh')} onClick={() => setView('programs')}><FileText size={13} />البرامج</button>}
          </div>
          {branches.length > 1 && view !== 'programs' && (
            <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {view === 'records' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canManage && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Stamp size={15} color="var(--brass)" />{f.id ? 'تحديث سجل تدريب' : 'تسجيل تدريب/شهادة'} — {branch.name}</div>
              <div className="note" style={{ marginBottom: 8 }}>سجّل اجتياز الموظف برنامجًا تدريبيًا أو شهادة؛ يُحسب تاريخ الانتهاء تلقائيًا من مدة صلاحية البرنامج، وتظهر الشهادات المنتهية قريبًا في مركز التنبيهات ومصفوفة الامتثال.</div>
              <div className="grid g3">
                <Field label="الموظف"><select className="inp sel" value={f.empId} onChange={e => setF(x => ({ ...x, empId: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}{e.jobTitle ? ' — ' + e.jobTitle : ''}</option>)}</select></Field>
                <Field label="البرنامج"><select className="inp sel" value={f.programId} onChange={e => setF(x => ({ ...x, programId: e.target.value }))}><option value="">اختر</option>{programs.map(p => <option key={p.id} value={p.id}>{p.title}{p.mandatory ? ' (إلزامي)' : ''}</option>)}</select></Field>
                <Field label="الحالة"><select className="inp sel" value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}><option value="planned">مجدول</option><option value="in_progress">جارٍ</option><option value="completed">مكتمل</option></select></Field>
                {f.status !== 'completed' && <Field label="تاريخ الجدولة"><input type="date" className="inp" value={f.plannedDate} onChange={e => setF(x => ({ ...x, plannedDate: e.target.value }))} /></Field>}
                {f.status === 'completed' && <Field label="تاريخ الإكمال"><input type="date" className="inp" value={f.completedDate} onChange={e => setF(x => ({ ...x, completedDate: e.target.value }))} /></Field>}
                {f.status === 'completed' && <Field label="النتيجة"><select className="inp sel" value={f.result} onChange={e => setF(x => ({ ...x, result: e.target.value }))}><option value="pass">اجتياز</option><option value="fail">عدم اجتياز</option></select></Field>}
                {f.status === 'completed' && <Field label="الدرجة (اختياري)"><input className="inp n" inputMode="numeric" value={f.score} onChange={e => setF(x => ({ ...x, score: e.target.value.replace(/\D/g, '') }))} /></Field>}
                {f.status === 'completed' && <Field label="رقم الشهادة (اختياري)"><input className="inp" value={f.certNo} onChange={e => setF(x => ({ ...x, certNo: e.target.value }))} /></Field>}
                <Field label="ملاحظة (اختياري)" style={{ gridColumn: 'span 2' }}><input className="inp" value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} /></Field>
              </div>
              {previewExpiry && <div className="note" style={{ marginTop: 8 }}>تاريخ انتهاء الشهادة المحسوب: <b>{previewExpiry}</b> (مدة الصلاحية {selProg.validityMonths} شهرًا).</div>}
              {f.status === 'completed' && selProg && !(selProg.validityMonths > 0) && <div className="note" style={{ marginTop: 8 }}>هذا البرنامج بلا تاريخ انتهاء.</div>}
              <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
                {f.id && <button className="btn gh" onClick={() => setF(emptyF)}>إلغاء التحرير</button>}
                <button className="btn pri" onClick={submit}><Check size={14} />{f.id ? 'تحديث' : 'حفظ'}</button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>سجل تدريب {branch.name}</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>البرنامج</th><th>الحالة</th><th>الإكمال</th><th>الانتهاء</th><th>النتيجة</th><th>الشهادة</th>{canManage && <th />}</tr></thead>
                <tbody>
                  {allRecs.filter(r => r.branchId === branch.id).map(r => { const st = trainingStatusNow(r, td); return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.employeeName}</td>
                      <td style={{ fontSize: 12 }}>{r.programTitle}</td>
                      <td>{statusBadge(st)}</td>
                      <td className="num" style={{ fontSize: 11.5 }}>{r.completedDate || '—'}</td>
                      <td className="num" style={{ fontSize: 11.5 }}>{r.expiryDate || '—'}</td>
                      <td style={{ fontSize: 11.5 }}>{r.result === 'pass' ? 'اجتياز' : r.result === 'fail' ? 'عدم اجتياز' : '—'}{r.score != null ? ' · ' + r.score : ''}</td>
                      <td style={{ fontSize: 11.5 }}>{r.certNo || '—'}</td>
                      {canManage && <td><div className="row" style={{ gap: 4 }}><button className="btn sm gh" onClick={() => editRec(r)}>تحرير</button><button className="btn sm gh" onClick={() => delRec(r)}><Trash2 size={13} /></button></div></td>}
                    </tr>
                  ); })}
                  {allRecs.filter(r => r.branchId === branch.id).length === 0 && <tr><td colSpan={canManage ? 8 : 7}><div className="empty">لا سجلات تدريب بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'matrix' && branch && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />مصفوفة الامتثال للتدريب الإلزامي — {branch.name}</div>
          <div className="note" style={{ marginBottom: 8 }}>لكل موظف والبرامج الإلزامية المنطبقة على مسماه: <span className="badge b-mint">ساري</span> <span className="badge b-amber">ينتهي خلال {alertDays} يومًا</span> <span className="badge b-rose">مفقود/منتهٍ</span> <span className="badge b-dim">غير مطلوب</span>.</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th>{mandProgs.map(p => <th key={p.id} style={{ fontSize: 11 }}>{p.title}</th>)}</tr></thead>
              <tbody>
                {emps.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}<div style={{ fontSize: 10, color: 'var(--faint)' }}>{e.jobTitle || ''}</div></td>
                    {mandProgs.map(p => { const c = cellFor(e, p); return <td key={p.id}><span className={'badge ' + c.cls} style={{ fontSize: 9.5 }}>{c.ar}</span></td>; })}
                  </tr>
                ))}
                {emps.length === 0 && <tr><td colSpan={mandProgs.length + 1}><div className="empty">لا موظفين نشطين.</div></td></tr>}
                {mandProgs.length === 0 && <tr><td colSpan={1}><div className="empty">لا برامج إلزامية معرَّفة — أضِفها من «البرامج».</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'programs' && canConfig && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />البرامج التدريبية والشهادات</div>
          <div className="note" style={{ marginBottom: 10 }}>عرِّف برامجك وشهاداتك ومدد صلاحيتها. البرامج «الإلزامية» تدخل مصفوفة الامتثال وتنبيهات النقص؛ حصر «المسميات المطلوبة» (مفصولة بفواصل) يقصر الإلزام على تلك المسميات — واتركه فارغًا ليشمل الجميع. المدد الافتراضية مبنية على متطلبات السعودية (الشهادة الصحية سنة)، وهي قابلة للضبط حسب لائحة الجهة الرسمية.</div>
          <div className="grid" style={{ gap: 8 }}>
            {cf.map((p, i) => (
              <div key={i} className="card" style={{ padding: 10, border: '1px solid var(--frame-o)' }}>
                <div className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <Field label="البرنامج/الشهادة" style={{ flex: 2, minWidth: 180 }}><input className="inp" value={p.title} onChange={e => setCf(x => x.map((y, j) => j === i ? { ...y, title: e.target.value } : y))} /></Field>
                  <Field label="التصنيف"><input className="inp" style={{ width: 120 }} value={p.category} onChange={e => setCf(x => x.map((y, j) => j === i ? { ...y, category: e.target.value } : y))} /></Field>
                  <Field label="الصلاحية (شهر، 0=دائم)"><input className="inp n" style={{ width: 120 }} inputMode="numeric" value={p.validityMonths} onChange={e => setCf(x => x.map((y, j) => j === i ? { ...y, validityMonths: e.target.value.replace(/\D/g, '') } : y))} /></Field>
                  <button className="btn sm gh" onClick={() => setCf(x => x.filter((_, j) => j !== i))}><Trash2 size={13} /></button>
                </div>
                <div className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 6 }}>
                  <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={!!p.mandatory} onChange={e => setCf(x => x.map((y, j) => j === i ? { ...y, mandatory: e.target.checked } : y))} />إلزامي</label>
                  <Field label="المسميات المطلوبة (فارغ=الجميع)" style={{ flex: 2, minWidth: 180 }}><input className="inp" value={p.requiredJobTitles} onChange={e => setCf(x => x.map((y, j) => j === i ? { ...y, requiredJobTitles: e.target.value } : y))} placeholder="مثال: شيف، مشرف" /></Field>
                  <Field label="الجهة"><input className="inp" style={{ width: 160 }} value={p.provider} onChange={e => setCf(x => x.map((y, j) => j === i ? { ...y, provider: e.target.value } : y))} /></Field>
                </div>
              </div>
            ))}
            <div><button className="btn sm gh" onClick={() => setCf(x => [...x, { id: '', title: '', category: '', validityMonths: 0, mandatory: false, requiredJobTitles: '', provider: '' }])}><Plus size={13} />برنامج</button></div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn pri" onClick={saveProgs}><Check size={14} />حفظ البرامج</button></div>
        </div>
      )}
    </div>
  );
}
