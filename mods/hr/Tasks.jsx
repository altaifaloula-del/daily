/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { CheckCircle2, Send, UserCog, FileBarChart, Plus, Trash2, Check } from 'lucide-react';
import { Field, HR_WEEK_DAYS, Modal, ROLES, isoD, nowISO, today, uid } from '../../App.jsx';

export function Tasks({ org, ops, me, myBranches, commit, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const isCashier = me.role === 'cashier';
  const canManage = me.role === 'branch_manager' || isAll; // إنشاء/تعديل القوالب والتكليف الفردي: مدير الفرع + أدوار المركز
  const canComplete = canManage || isCashier; // إنجاز المهام من كشك الفرع: مدير الفرع، أدوار المركز، والكاشير
  const branches = myBranches || [];

  const [view, setView] = useState('checklist');
  useEffect(() => { if (isCashier && view !== 'checklist') setView('checklist'); }, [isCashier]); // eslint-disable-line
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => {
    if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || '');
  }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;

  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const weekdayOf = (ds) => new Date(ds + 'T00:00:00').getDay();

  // === 1) قوالب مهام متكررة (يومية/أسبوعية) لكل فرع ===
  const templates = (ops.taskTemplates || []).filter(t => branch && t.branchId === branch.id);
  const [tplF, setTplF] = useState(null); // {id?, title, freq:'daily'|'weekly', weekdays:[], note}
  const saveTpl = async () => {
    if (!branch) return;
    if (!tplF.title) return say('أدخل عنوان المهمة', 'no');
    const rec = { id: tplF.id || uid('ttpl'), branchId: branch.id, title: tplF.title, freq: tplF.freq || 'daily', weekdays: tplF.freq === 'weekly' ? (tplF.weekdays || []) : [0, 1, 2, 3, 4, 5, 6], note: tplF.note || '', isActive: true };
    const exists = (ops.taskTemplates || []).some(t => t.id === rec.id);
    await commit(d => ({ ...d, taskTemplates: exists ? (d.taskTemplates || []).map(t => t.id === rec.id ? rec : t) : [...(d.taskTemplates || []), rec] }),
      { actionType: exists ? 'update' : 'create', targetType: 'task_template', targetId: rec.id, branchName: branch.name, title: exists ? 'عدّل قالب مهمة' : 'أضاف قالب مهمة', details: branch.name + ' — ' + rec.title });
    say('حُفظ قالب المهمة ✓'); setTplF(null);
  };
  const delTpl = async (t) => {
    if (!window.confirm('حذف قالب مهمة «' + t.title + '»؟')) return;
    await commit(d => ({ ...d, taskTemplates: (d.taskTemplates || []).filter(x => x.id !== t.id) }),
      { actionType: 'delete', targetType: 'task_template', targetId: t.id, branchName: branch.name, title: 'حذف قالب مهمة', details: t.title });
    say('حُذف القالب ✓');
  };

  // === 2) تكليف مهمة فردية لموظف معيّن ===
  const assigns = (ops.taskAssignments || []).filter(a => branch && a.branchId === branch.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const [assignF, setAssignF] = useState({ empId: '', title: '', dueDate: today(), priority: 'normal', note: '' });
  const saveAssign = async () => {
    if (!branch) return;
    const emp = emps.find(e => e.id === assignF.empId);
    if (!emp || !assignF.title) return say('اختر الموظف وأدخل عنوان المهمة', 'no');
    const rec = { id: uid('task'), branchId: branch.id, employeeId: emp.id, employeeName: emp.name, title: assignF.title, note: assignF.note || '', dueDate: assignF.dueDate || today(), priority: assignF.priority || 'normal', status: 'open', createdBy: me.id, createdByName: me.name, createdAt: nowISO() };
    await commit(d => ({ ...d, taskAssignments: [rec, ...(d.taskAssignments || [])] }),
      { actionType: 'create', targetType: 'task_assignment', targetId: rec.id, branchName: branch.name, title: 'تكليف مهمة فردية', details: emp.name + ' — ' + rec.title });
    say('أُسندت المهمة ✓'); setAssignF({ empId: '', title: '', dueDate: today(), priority: 'normal', note: '' });
  };
  // v26.1 — تعديل مهمة فردية مفتوحة
  const [editA, setEditA] = useState(null);
  const saveEditA = async () => {
    const f = editA; if (!f) return;
    if (!String(f.title || '').trim()) return say('عنوان المهمة مطلوب', 'no');
    await commit(d => ({ ...d, taskAssignments: (d.taskAssignments || []).map(x => x.id === f.id ? { ...x, title: f.title.trim(), dueDate: f.dueDate || x.dueDate, priority: f.priority || 'normal', note: f.note || '', updatedAt: nowISO(), updatedByName: me.name } : x) }),
      { actionType: 'update', targetType: 'task_assignment', targetId: f.id, branchName: branch ? branch.name : '', title: 'عدّل مهمة فردية', details: f.title });
    setEditA(null); say('حُدِّثت المهمة ✓');
  };
  const cancelAssign = async (a) => {
    if (!window.confirm('إلغاء المهمة «' + a.title + '»؟')) return;
    await commit(d => ({ ...d, taskAssignments: (d.taskAssignments || []).filter(x => x.id !== a.id) }),
      { actionType: 'delete', targetType: 'task_assignment', targetId: a.id, branchName: branch.name, title: 'إلغاء مهمة فردية', details: a.title });
    say('أُلغيت المهمة');
  };

  // === 3) قائمة المهام من كشك الفرع (جهاز مشترك) — اختيار موظف ثم إنجاز مهامه ===
  const [empId, setEmpId] = useState('');
  useEffect(() => { if (!emps.find(e => e.id === empId)) setEmpId(''); }, [emps, empId]); // eslint-disable-line
  const chkEmp = emps.find(e => e.id === empId) || null;
  const dueTemplatesToday = branch ? templates.filter(t => t.isActive !== false && (t.freq === 'daily' || (t.weekdays || []).includes(weekdayOf(today())))) : [];
  const completionsToday = (ops.taskCompletions || []).filter(c => c.employeeId === empId && c.date === today());
  const isTplDone = (tplId) => completionsToday.some(c => c.templateId === tplId);
  const openIndivToday = chkEmp ? assigns.filter(a => a.employeeId === chkEmp.id && a.status === 'open' && a.dueDate <= today()) : [];
  const toggleTpl = async (t) => {
    if (!chkEmp || !branch) return;
    if (isTplDone(t.id)) {
      await commit(d => ({ ...d, taskCompletions: (d.taskCompletions || []).filter(c => !(c.templateId === t.id && c.employeeId === chkEmp.id && c.date === today())) }),
        { actionType: 'update', targetType: 'task_completion', targetId: t.id, branchName: branch.name, title: 'إلغاء إنجاز مهمة متكررة', details: chkEmp.name + ' — ' + t.title });
    } else {
      const rec = { id: uid('tcomp'), templateId: t.id, branchId: branch.id, employeeId: chkEmp.id, employeeName: chkEmp.name, date: today(), doneAt: nowISO(), doneBy: me.id, doneByName: me.name };
      await commit(d => ({ ...d, taskCompletions: [rec, ...(d.taskCompletions || [])] }),
        { actionType: 'create', targetType: 'task_completion', targetId: rec.id, branchName: branch.name, title: 'إنجاز مهمة متكررة', details: chkEmp.name + ' — ' + t.title });
    }
  };
  const doneIndiv = async (a) => {
    if (!branch) return;
    await commit(d => ({ ...d, taskAssignments: (d.taskAssignments || []).map(x => x.id === a.id ? { ...x, status: 'done', doneAt: nowISO(), doneBy: me.id, doneByName: me.name } : x) }),
      { actionType: 'update', targetType: 'task_assignment', targetId: a.id, branchName: branch.name, title: 'إنجاز مهمة فردية', details: a.employeeName + ' — ' + a.title });
    say('أُنجزت المهمة ✓');
  };

  // === 4) تقرير الالتزام بالمهام لكل موظف/فرع ===
  const [repFrom, setRepFrom] = useState(today());
  const [repTo, setRepTo] = useState(today());
  const dateRange = () => {
    const arr = []; let d = repFrom;
    while (d <= repTo && arr.length < 62) { arr.push(d); const nd = new Date(d + 'T00:00:00'); nd.setDate(nd.getDate() + 1); d = isoD(nd); }
    return arr;
  };
  const dates = dateRange();
  const reportRows = emps.map(e => {
    let expected = 0, done = 0;
    dates.forEach(ds => {
      const wd = weekdayOf(ds);
      templates.filter(t => t.isActive !== false && (t.freq === 'daily' || (t.weekdays || []).includes(wd))).forEach(t => {
        expected++;
        if ((ops.taskCompletions || []).some(c => c.templateId === t.id && c.employeeId === e.id && c.date === ds)) done++;
      });
    });
    const indiv = assigns.filter(a => a.employeeId === e.id && a.dueDate >= repFrom && a.dueDate <= repTo);
    const indivDone = indiv.filter(a => a.status === 'done').length;
    const totalExpected = expected + indiv.length;
    const totalDone = done + indivDone;
    const pct = totalExpected ? Math.round((totalDone / totalExpected) * 100) : null;
    return { e, expected: totalExpected, done: totalDone, pct };
  });

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {!isCashier && (
        <div className="card" style={{ padding: '8px 12px' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (view === 'templates' ? ' pri' : ' gh')} onClick={() => setView('templates')}><CheckCircle2 size={13} />قوالب المهام المتكررة</button>
              <button className={'btn sm' + (view === 'assign' ? ' pri' : ' gh')} onClick={() => setView('assign')}><Send size={13} />تكليف فردي</button>
              <button className={'btn sm' + (view === 'checklist' ? ' pri' : ' gh')} onClick={() => setView('checklist')}><UserCog size={13} />إنجاز المهام</button>
              <button className={'btn sm' + (view === 'report' ? ' pri' : ' gh')} onClick={() => setView('report')}><FileBarChart size={13} />تقرير الالتزام</button>
            </div>
            {branches.length > 1 && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {view === 'templates' && branch && (
        <div className="card">
          <div className="card-h" style={{ marginBottom: 8 }}>
            <div className="card-t"><CheckCircle2 size={15} color="var(--brass)" />قوالب المهام المتكررة — {branch.name}</div>
            {canManage && <button className="btn sm pri" onClick={() => setTplF({ title: '', freq: 'daily', weekdays: [], note: '' })}><Plus size={13} />قالب جديد</button>}
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>العنوان</th><th>التكرار</th><th>الأيام</th><th>ملاحظة</th>{canManage && <th />}</tr></thead>
              <tbody>
                {templates.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{t.title}</td>
                    <td><span className="badge b-dim">{t.freq === 'weekly' ? 'أسبوعي' : 'يومي'}</span></td>
                    <td style={{ fontSize: 11 }}>{t.freq === 'weekly' ? (t.weekdays || []).map(d => HR_WEEK_DAYS.find(x => x.v === d)?.ar.slice(0, 3)).join('، ') : 'كل يوم'}</td>
                    <td style={{ fontSize: 12 }}>{t.note || '—'}</td>
                    {canManage && <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn sm gh" onClick={() => setTplF({ ...t })}>تعديل</button>
                        <button className="btn sm gh" onClick={() => delTpl(t)}><Trash2 size={13} /></button>
                      </div>
                    </td>}
                  </tr>
                ))}
                {templates.length === 0 && <tr><td colSpan={canManage ? 5 : 4}><div className="empty">لا توجد قوالب مهام لهذا الفرع بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editA && (
        <Modal title="تعديل مهمة فردية" icon={Send} onClose={() => setEditA(null)}
          foot={<><button className="btn gh" onClick={() => setEditA(null)}>إلغاء</button><button className="btn pri" onClick={saveEditA}><Check size={14} />حفظ</button></>}>
          <div className="grid" style={{ gap: 10 }}>
            <Field label="عنوان المهمة"><input className="inp" autoFocus value={editA.title} onChange={e => setEditA(f => ({ ...f, title: e.target.value }))} /></Field>
            <div className="grid g2">
              <Field label="تاريخ الاستحقاق"><input type="date" className="inp" value={editA.dueDate} onChange={e => setEditA(f => ({ ...f, dueDate: e.target.value }))} /></Field>
              <Field label="الأولوية"><select className="inp sel" value={editA.priority} onChange={e => setEditA(f => ({ ...f, priority: e.target.value }))}><option value="normal">عادية</option><option value="high">عاجلة</option></select></Field>
            </div>
            <Field label="ملاحظة"><input className="inp" value={editA.note} onChange={e => setEditA(f => ({ ...f, note: e.target.value }))} /></Field>
          </div>
        </Modal>
      )}
      {tplF && (
        <Modal title={tplF.id ? 'تعديل قالب مهمة' : 'قالب مهمة جديد'} icon={CheckCircle2} onClose={() => setTplF(null)}
          foot={<>
            <button className="btn gh" onClick={() => setTplF(null)}>إلغاء</button>
            <button className="btn pri" onClick={saveTpl}><Check size={14} />حفظ</button>
          </>}>
          <div className="grid" style={{ gap: 10 }}>
            <Field label="عنوان المهمة">
              <input className="inp" autoFocus value={tplF.title} onChange={e => setTplF(f => ({ ...f, title: e.target.value }))} placeholder="تنظيف صالة العملاء" />
            </Field>
            <Field label="التكرار">
              <select className="inp sel" value={tplF.freq} onChange={e => setTplF(f => ({ ...f, freq: e.target.value }))}>
                <option value="daily">يومي (كل يوم)</option>
                <option value="weekly">أسبوعي (أيام محدَّدة)</option>
              </select>
            </Field>
            {tplF.freq === 'weekly' && (
              <Field label="أيام التكرار">
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  {HR_WEEK_DAYS.map(d => (
                    <label key={d.v} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={(tplF.weekdays || []).includes(d.v)}
                        onChange={e => setTplF(f => ({ ...f, weekdays: e.target.checked ? [...(f.weekdays || []), d.v] : (f.weekdays || []).filter(x => x !== d.v) }))} />
                      {d.ar}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field label="ملاحظة (اختياري)">
              <input className="inp" value={tplF.note} onChange={e => setTplF(f => ({ ...f, note: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {view === 'assign' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canManage && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Send size={15} color="var(--brass)" />تكليف مهمة فردية لموظف معيّن</div>
              <div className="grid g3">
                <Field label="الموظف"><select className="inp sel" value={assignF.empId} onChange={e => setAssignF(f => ({ ...f, empId: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="عنوان المهمة"><input className="inp" value={assignF.title} onChange={e => setAssignF(f => ({ ...f, title: e.target.value }))} /></Field>
                <Field label="تاريخ الاستحقاق"><input type="date" className="inp" value={assignF.dueDate} onChange={e => setAssignF(f => ({ ...f, dueDate: e.target.value }))} /></Field>
                <Field label="الأولوية">
                  <select className="inp sel" value={assignF.priority} onChange={e => setAssignF(f => ({ ...f, priority: e.target.value }))}>
                    <option value="normal">عادية</option>
                    <option value="high">عاجلة</option>
                  </select>
                </Field>
                <Field label="ملاحظة (اختياري)"><input className="inp" value={assignF.note} onChange={e => setAssignF(f => ({ ...f, note: e.target.value }))} /></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="btn pri" onClick={saveAssign}><Send size={14} />إسناد المهمة</button>
              </div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>المهام الفردية — {branch.name}</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>العنوان</th><th>الاستحقاق</th><th>الأولوية</th><th>الحالة</th>{canManage && <th />}</tr></thead>
                <tbody>
                  {assigns.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{a.employeeName}</td>
                      <td style={{ fontSize: 12.5 }}>{a.title}</td>
                      <td className="num">{a.dueDate}</td>
                      <td><span className={'badge ' + (a.priority === 'high' ? 'b-rose' : 'b-dim')}>{a.priority === 'high' ? 'عاجلة' : 'عادية'}</span></td>
                      <td><span className={'badge ' + (a.status === 'done' ? 'b-mint' : 'b-amber')}>{a.status === 'done' ? 'منجزة' : 'مفتوحة'}</span></td>
                      {canManage && <td>
                        {a.status !== 'done' && <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                          <button className="btn sm gh" onClick={() => setEditA({ id: a.id, title: a.title, dueDate: a.dueDate, priority: a.priority || 'normal', note: a.note || '' })}>تعديل</button>
                          <button className="btn sm gh" onClick={() => cancelAssign(a)}><Trash2 size={13} /></button>
                        </div>}
                      </td>}
                    </tr>
                  ))}
                  {assigns.length === 0 && <tr><td colSpan={canManage ? 6 : 5}><div className="empty">لا توجد مهام فردية بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'checklist' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <Field label="الموظف">
              <select className="inp sel" value={empId} onChange={e => setEmpId(e.target.value)}>
                <option value="">اختر الموظف</option>
                {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
          </div>
          {chkEmp && (
            <>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}>مهام اليوم المتكررة — {chkEmp.name}</div>
                <div className="grid" style={{ gap: 6 }}>
                  {dueTemplatesToday.map(t => (
                    <label key={t.id} className="row" style={{ gap: 8, justifyContent: 'space-between', padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 10, cursor: canComplete ? 'pointer' : 'default' }}>
                      <span className="row" style={{ gap: 8 }}>
                        <input type="checkbox" checked={isTplDone(t.id)} disabled={!canComplete} onChange={() => canComplete && toggleTpl(t)} />
                        {t.title}
                      </span>
                      {isTplDone(t.id) && <span className="badge b-mint">منجزة</span>}
                    </label>
                  ))}
                  {dueTemplatesToday.length === 0 && <div className="empty">لا توجد مهام متكررة مستحقة اليوم لهذا الفرع.</div>}
                </div>
              </div>
              <div className="card">
                <div className="card-t" style={{ marginBottom: 8 }}>مهام فردية مستحقة</div>
                <div className="grid" style={{ gap: 6 }}>
                  {openIndivToday.map(a => (
                    <div key={a.id} className="row" style={{ gap: 8, justifyContent: 'space-between', padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 10 }}>
                      <span style={{ fontSize: 12.5 }}>{a.title} {a.priority === 'high' && <span className="badge b-rose" style={{ marginInlineStart: 6 }}>عاجلة</span>}</span>
                      {canComplete && <button className="btn sm pri" onClick={() => doneIndiv(a)}><Check size={13} />إنجاز</button>}
                    </div>
                  ))}
                  {openIndivToday.length === 0 && <div className="empty">لا توجد مهام فردية مفتوحة ومستحقة لهذا الموظف.</div>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'report' && branch && (
        <div className="card">
          <div className="card-h" style={{ marginBottom: 8 }}>
            <div className="card-t"><FileBarChart size={15} color="var(--brass)" />تقرير الالتزام بالمهام — {branch.name}</div>
            <div className="row" style={{ gap: 8 }}>
              <input type="date" className="inp" value={repFrom} onChange={e => setRepFrom(e.target.value)} />
              <input type="date" className="inp" value={repTo} onChange={e => setRepTo(e.target.value)} />
            </div>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th><th>المهام المستحقة</th><th>المُنجزة</th><th>نسبة الالتزام</th></tr></thead>
              <tbody>
                {reportRows.map(r => (
                  <tr key={r.e.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.e.name}</td>
                    <td className="num">{r.expected}</td>
                    <td className="num">{r.done}</td>
                    <td><span className={'badge ' + (r.pct == null ? 'b-dim' : r.pct >= 90 ? 'b-mint' : r.pct >= 70 ? 'b-amber' : 'b-rose')}>{r.pct == null ? '—' : r.pct + '%'}</span></td>
                  </tr>
                ))}
                {reportRows.length === 0 && <tr><td colSpan={4}><div className="empty">لا يوجد موظفون نشطون لهذا الفرع.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
