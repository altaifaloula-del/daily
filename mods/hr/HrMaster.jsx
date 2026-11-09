/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Building2, UserCog, FileText, Plus, Trash2, Users, Check, Printer } from 'lucide-react';
import { Field, Modal, PhotoField, buildPartners, defaultTrainingPrograms, nextPartnerCode, nowISO, positionJdHtml, printA4, today, uid } from '../../App.jsx';

export function HrMaster({ org, ops, me, commitOrg, commit, say }) {
  const [view, setView] = useState('depts');
  const [deptF, setDeptF] = useState(null);
  const [posF, setPosF] = useState(null);
  const [jdView, setJdView] = useState(null);
  const [assignF, setAssignF] = useState(null);
  const [docsFor, setDocsFor] = useState(null);
  const [docF, setDocF] = useState(null);
  const [empF, setEmpF] = useState(null); // v25.1: نموذج موظف جديد (لم يكن للموظفين نموذج إنشاء مباشر — كانوا يُضافون فقط عبر مسارات الشركاء)

  const depts = org.departments || [];
  const positions = org.positions || [];
  const emps = org.employees || [];
  const DOC_KINDS = { contract: 'عقد عمل', id: 'هوية/إقامة', cert: 'شهادة/مؤهل', license: 'رخصة/ترخيص', other: 'أخرى' };

  const posCountByDept = (dId) => positions.filter(p => p.departmentId === dId).length;
  const empCountByDept = (dId) => emps.filter(e => e.departmentId === dId).length;
  const empCountByPos = (pId) => emps.filter(e => e.positionId === pId).length;

  const saveDept = async () => {
    const f = deptF; const name = (f.name || '').trim();
    if (!name) return say('اسم القسم مطلوب', 'no');
    const isNew = !f.id;
    const id = f.id || uid('dept');
    await commitOrg(d => ({
      ...d, departments: isNew
        ? [...(d.departments || []), { id, name, note: (f.note || '').trim(), active: true }]
        : (d.departments || []).map(x => x.id === id ? { ...x, name, note: (f.note || '').trim() } : x)
    }), { actionType: isNew ? 'create' : 'update', targetType: 'user_account', targetId: id, title: (isNew ? 'أضاف قسمًا' : 'حدّث قسمًا') + ': ' + name, details: f.note || '' });
    setDeptF(null); say((isNew ? 'أُضيف القسم' : 'حُفظ القسم') + ' ✓');
  };
  const toggleDept = async (d) => {
    await commitOrg(x => ({ ...x, departments: (x.departments || []).map(y => y.id === d.id ? { ...y, active: !y.active } : y) }),
      { actionType: 'update', targetType: 'user_account', targetId: d.id, title: (d.active === false ? 'فعّل قسمًا' : 'عطّل قسمًا') + ': ' + d.name, details: '' });
    say(d.active === false ? 'أُعيد تفعيل القسم' : 'عُطّل القسم');
  };
  const delDept = async (d) => {
    if (posCountByDept(d.id) > 0 || empCountByDept(d.id) > 0) return say('لا يمكن حذف قسم مرتبط بوظائف أو موظفين — استخدم «تعطيل» بدلًا من ذلك', 'no');
    if (!window.confirm('حذف القسم «' + d.name + '» نهائيًا؟')) return;
    await commitOrg(x => ({ ...x, departments: (x.departments || []).filter(y => y.id !== d.id) }),
      { actionType: 'delete', targetType: 'user_account', targetId: d.id, title: 'حذف قسمًا: ' + d.name, details: '' });
    say('حُذف القسم');
  };

  const savePos = async () => {
    const f = posF; const title = (f.title || '').trim();
    if (!title) return say('المسمى الوظيفي مطلوب', 'no');
    const isNew = !f.id;
    const id = f.id || uid('pos');
    const jd = {
      code: (f.code || '').trim(), grade: (f.grade || '').trim(), level: (f.level || '').trim(),
      reportsToId: f.reportsToId || '', backupPositionId: f.backupPositionId || '',
      summary: (f.summary || '').trim(), duties: (f.duties || '').trim(),
      qualifications: (f.qualifications || '').trim(), competencies: (f.competencies || '').trim(),
      authorities: (f.authorities || '').trim(), restrictions: (f.restrictions || '').trim(),
      requiredTrainingIds: Array.isArray(f.requiredTrainingIds) ? f.requiredTrainingIds : []
    };
    await commitOrg(d => ({
      ...d, positions: isNew
        ? [...(d.positions || []), { id, title, departmentId: f.departmentId || '', ...jd, active: true }]
        : (d.positions || []).map(x => x.id === id ? { ...x, title, departmentId: f.departmentId || '', ...jd } : x)
    }), { actionType: isNew ? 'create' : 'update', targetType: 'user_account', targetId: id, title: (isNew ? 'أضاف وظيفة' : 'حدّث وظيفة') + ': ' + title, details: (depts.find(x => x.id === f.departmentId) || {}).name || '' });
    setPosF(null); say((isNew ? 'أُضيفت الوظيفة' : 'حُفظت الوظيفة') + ' ✓');
  };
  const togglePos = async (p) => {
    await commitOrg(x => ({ ...x, positions: (x.positions || []).map(y => y.id === p.id ? { ...y, active: !y.active } : y) }),
      { actionType: 'update', targetType: 'user_account', targetId: p.id, title: (p.active === false ? 'فعّل وظيفة' : 'عطّل وظيفة') + ': ' + p.title, details: '' });
    say(p.active === false ? 'أُعيد تفعيل الوظيفة' : 'عُطّلت الوظيفة');
  };
  const delPos = async (p) => {
    if (empCountByPos(p.id) > 0) return say('لا يمكن حذف وظيفة مُسندة لموظفين — استخدم «تعطيل» بدلًا من ذلك', 'no');
    if (!window.confirm('حذف الوظيفة «' + p.title + '» نهائيًا؟')) return;
    await commitOrg(x => ({ ...x, positions: (x.positions || []).filter(y => y.id !== p.id) }),
      { actionType: 'delete', targetType: 'user_account', targetId: p.id, title: 'حذف وظيفة: ' + p.title, details: '' });
    say('حُذفت الوظيفة');
  };

  const saveAssign = async () => {
    const f = assignF;
    const pos = positions.find(p => p.id === f.positionId);
    await commitOrg(d => ({
      ...d, employees: (d.employees || []).map(x => x.id === f.id ? {
        ...x, departmentId: f.departmentId || '', positionId: f.positionId || '',
        jobTitle: (f.syncTitle && pos) ? pos.title : x.jobTitle
      } : x)
    }), { actionType: 'update', targetType: 'user_account', targetId: f.id, title: 'حدّث القسم/الوظيفة لموظف', details: f.name + (pos ? ' → ' + pos.title : '') });
    setAssignF(null); say('حُفظ ✓');
  };

  // v25.1 — إنشاء موظف جديد مباشرة من البيانات الرئيسية (أدوار المركز)؛ v26.1 — التعديل بنفس النموذج
  const empToForm = (e) => ({ id: e.id, name: e.name || '', branchId: e.branchId || '', jobTitle: e.jobTitle || '', departmentId: e.departmentId || '', positionId: e.positionId || '', phone: e.phone || '', idNumber: e.idNumber || e.iqamaNo || e.nationalId || '', nationality: e.nationality || '', hireDate: e.hireDate || '', baseSalary: String(e.baseSalary || 0), housingAllowance: String(e.housingAllowance || 0), transportAllowance: String(e.transportAllowance || 0), gosiSubject: !!e.gosiSubject });
  const saveEmp = async () => {
    const f = empF; const name = (f.name || '').trim();
    if (!name) return say('اسم الموظف مطلوب', 'no');
    if (!f.branchId) return say('اختر فرع الموظف — بدونه لن يظهر في شاشات الحضور والمهام', 'no');
    const pos = positions.find(p => p.id === f.positionId);
    const patch = {
      name, branchId: f.branchId,
      jobTitle: (f.jobTitle || '').trim() || (pos ? pos.title : ''), departmentId: f.departmentId || (pos ? pos.departmentId || '' : ''), positionId: f.positionId || '',
      phone: (f.phone || '').trim(), idNumber: (f.idNumber || '').trim(), nationality: f.nationality || '', hireDate: f.hireDate || '',
      baseSalary: Number(f.baseSalary) || 0, housingAllowance: Number(f.housingAllowance) || 0, transportAllowance: Number(f.transportAllowance) || 0,
      gosiSubject: !!f.gosiSubject
    };
    if (f.id) {
      const prev = emps.find(x => x.id === f.id) || {};
      const branchChanged = prev.branchId && prev.branchId !== patch.branchId;
      const ok = await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === f.id ? { ...x, ...patch, updatedAt: nowISO(), updatedByName: me.name } : x) }),
        { actionType: 'update', targetType: 'user_account', targetId: f.id, branchName: ((org.branches || []).find(b => b.id === patch.branchId) || {}).name || '', title: 'عدّل بيانات موظف', details: name + (branchChanged ? ' — نُقل إلى فرع آخر' : '') });
      if (!ok) return;
      setEmpF(null); say('حُدِّثت بيانات «' + name + '» ✓' + (branchChanged ? ' — أعد ضبط PIN/البطاقة في فرعه الجديد' : ''));
      return;
    }
    if (emps.some(x => (x.name || '').trim() === name && x.branchId === f.branchId && x.isActive !== false) && !window.confirm('يوجد موظف نشط بنفس الاسم في هذا الفرع — إضافة موظف آخر بنفس الاسم؟')) return;
    const id = uid('emp');
    const rec = { id, code: nextPartnerCode(buildPartners(org, {}), 'employee'), ...patch, otherAllowance: 0, isActive: true, docs: [], createdAt: nowISO(), createdByName: me.name };
    const ok = await commitOrg(d => ({ ...d, employees: [...(d.employees || []), rec] }),
      { actionType: 'create', targetType: 'user_account', targetId: id, branchName: ((org.branches || []).find(b => b.id === rec.branchId) || {}).name || '', title: 'أضاف موظفًا جديدًا', details: name + (rec.jobTitle ? ' — ' + rec.jobTitle : '') + ' · ' + rec.code });
    if (!ok) return;
    setEmpF(null);
    say('أُضيف الموظف «' + name + '» ✓ — اضبط له رقم PIN أو أصدر بطاقة QR من «الحضور الموثَّق ← أرقام PIN»');
  };
  // v26.1 — إيقاف/تفعيل (حذف ناعم يحفظ التاريخ المالي)، وحذف نهائي فقط لموظف بلا أي سجلات
  const toggleEmp = async (e) => {
    const off = e.isActive !== false;
    if (!window.confirm((off ? 'إيقاف الموظف «' : 'إعادة تفعيل الموظف «') + e.name + '»؟' + (off ? ' سيختفي من الرواتب والحضور والمهام مع بقاء كل سجلاته.' : ''))) return;
    await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === e.id ? { ...x, isActive: !off, ...(off ? { endDate: today() } : { endDate: '' }) } : x) }),
      { actionType: 'update', targetType: 'user_account', targetId: e.id, title: off ? 'أوقف موظفًا' : 'أعاد تفعيل موظف', details: e.name });
    say(off ? 'أُوقف الموظف — سجلاته محفوظة' : 'أُعيد تفعيل الموظف ✓');
  };
  const empRecordCount = (e) => {
    const o = ops || {}; const key = 'emp:' + e.id;
    return (o.advances || []).filter(a => a.employeeId === e.id).length + (o.ledgerEntries || []).filter(l => l.partnerKey === key).length
      + (o.attendanceEvents || []).filter(x => x.employeeId === e.id).length + (o.shiftAssignments || []).filter(x => x.empId === e.id && (x.shiftIds || []).some(Boolean)).length
      + (o.taskAssignments || []).filter(x => x.employeeId === e.id).length + (o.taskCompletions || []).filter(x => x.employeeId === e.id).length
      + (o.pointsEntries || []).filter(x => x.employeeId === e.id).length + (o.qualityReviews || []).filter(x => x.employeeId === e.id).length + (o.rewardRequests || []).filter(x => x.employeeId === e.id).length
      + (o.hrSignDocs || []).filter(x => x.employeeId === e.id).length
      + (o.closings || []).filter(c => JSON.stringify(c).includes('"' + key + '"')).length;
  };
  const deleteEmp = async (e) => {
    const n = empRecordCount(e);
    if (n > 0) return say('لا يمكن الحذف النهائي: للموظف ' + n + ' سجلًا (رواتب/حضور/مهام/نقاط…) — استخدم «إيقاف» للحفاظ على التاريخ', 'no');
    if (!window.confirm('حذف الموظف «' + e.name + '» نهائيًا؟ لا يمكن التراجع.')) return;
    const ok = await commitOrg(d => ({ ...d, employees: (d.employees || []).filter(x => x.id !== e.id) }),
      { actionType: 'delete', targetType: 'user_account', targetId: e.id, title: 'حذف موظف نهائيًا (بلا سجلات)', details: e.name });
    if (!ok) return;
    if (commit && ((ops || {}).hrPins || []).some(p => p.employeeId === e.id)) await commit(d => ({ ...d, hrPins: (d.hrPins || []).filter(p => p.employeeId !== e.id) }));
    say('حُذف الموظف نهائيًا');
  };
  const [showInactive, setShowInactive] = useState(false);

  const empDocs = (e) => e.docs || [];
  const saveDoc = async () => {
    const f = docF; const emp = docsFor;
    if (!(f.title || '').trim()) return say('عنوان المستند مطلوب', 'no');
    const isNew = !f.id;
    const id = f.id || uid('edoc');
    const entry = { id, kind: f.kind || 'other', title: f.title.trim(), number: (f.number || '').trim(), issueDate: f.issueDate || '', expiryDate: f.expiryDate || '', file: f.file || '' };
    await commitOrg(d => ({
      ...d, employees: (d.employees || []).map(x => x.id === emp.id ? {
        ...x, docs: isNew ? [...(x.docs || []), entry] : (x.docs || []).map(y => y.id === id ? entry : y)
      } : x)
    }), { actionType: isNew ? 'create' : 'update', targetType: 'user_account', targetId: emp.id, title: (isNew ? 'أضاف مستند موظف' : 'حدّث مستند موظف') + ': ' + entry.title, details: emp.name });
    setDocF(null); say('حُفظ المستند ✓');
    setDocsFor(d => d ? { ...d, docs: isNew ? [...(d.docs || []), entry] : (d.docs || []).map(y => y.id === id ? entry : y) } : d);
  };
  const delDoc = async (docId) => {
    const emp = docsFor;
    if (!window.confirm('حذف هذا المستند؟')) return;
    await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === emp.id ? { ...x, docs: (x.docs || []).filter(y => y.id !== docId) } : x) }),
      { actionType: 'delete', targetType: 'user_account', targetId: emp.id, title: 'حذف مستند موظف', details: emp.name });
    say('حُذف المستند');
    setDocsFor(d => d ? { ...d, docs: (d.docs || []).filter(y => y.id !== docId) } : d);
  };

  const expiryTag = (dt) => {
    if (!dt) return null;
    const days = Math.round((Date.parse(dt + 'T00:00:00') - Date.parse(today() + 'T00:00:00')) / 86400000);
    if (days < 0) return <span className="badge b-rose">منتهٍ منذ {Math.abs(days)} يوم</span>;
    if (days <= 30) return <span className="badge b-amber">ينتهي خلال {days} يوم</span>;
    return <span className="badge b-mint">ساري</span>;
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={'btn sm' + (view === 'depts' ? ' pri' : ' gh')} onClick={() => setView('depts')}><Building2 size={13} />الأقسام</button>
          <button className={'btn sm' + (view === 'positions' ? ' pri' : ' gh')} onClick={() => setView('positions')}><UserCog size={13} />الوظائف</button>
          <button className={'btn sm' + (view === 'emps' ? ' pri' : ' gh')} onClick={() => setView('emps')}><FileText size={13} />بيانات ومستندات الموظفين</button>
        </div>
      </div>

      {view === 'depts' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><Building2 size={15} color="var(--brass)" />الأقسام</div>
            <button className="btn sm" onClick={() => setDeptF({ name: '', note: '' })}><Plus size={13} />قسم جديد</button>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>القسم</th><th>ملاحظة</th><th style={{ textAlign: 'end' }}>الوظائف</th><th style={{ textAlign: 'end' }}>الموظفون</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {depts.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{d.note || '—'}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{posCountByDept(d.id)}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{empCountByDept(d.id)}</td>
                    <td>{d.active === false ? <span className="badge b-dim">معطّل</span> : <span className="badge b-mint">نشط</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn sm gh" onClick={() => setDeptF({ id: d.id, name: d.name, note: d.note || '' })}>تعديل</button>
                        <button className="btn sm gh" onClick={() => toggleDept(d)}>{d.active === false ? 'تفعيل' : 'تعطيل'}</button>
                        <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => delDept(d)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {depts.length === 0 && <tr><td colSpan={6}><div className="empty">لا توجد أقسام بعد — أضف أول قسم.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'positions' && (
        <div className="card">
          <div className="card-h">
            <div className="card-t"><UserCog size={15} color="var(--brass)" />الوظائف</div>
            <button className="btn sm" onClick={() => setPosF({ title: '', departmentId: depts[0]?.id || '', code: '', grade: '', level: '', reportsToId: '', backupPositionId: '', summary: '', duties: '', qualifications: '', competencies: '', authorities: '', restrictions: '', requiredTrainingIds: [] })} disabled={depts.length === 0}><Plus size={13} />وظيفة جديدة</button>
          </div>
          {depts.length === 0 && <div className="note">أضف قسمًا واحدًا على الأقل أولًا قبل إنشاء وظيفة.</div>}
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الوظيفة</th><th>القسم</th><th style={{ textAlign: 'end' }}>الموظفون</th><th>الحالة</th><th /></tr></thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.title}{p.duties && <div style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 400, marginTop: 2 }}>{p.duties.slice(0, 80)}{p.duties.length > 80 ? '…' : ''}</div>}</td>
                    <td style={{ fontSize: 12 }}>{(depts.find(d => d.id === p.departmentId) || {}).name || <span style={{ color: 'var(--amber)' }}>بلا قسم</span>}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{empCountByPos(p.id)}</td>
                    <td>{p.active === false ? <span className="badge b-dim">معطّلة</span> : <span className="badge b-mint">نشطة</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn sm gh" onClick={() => setJdView(p)}><FileText size={13} />الوصف</button>
                        <button className="btn sm gh" onClick={() => setPosF({ id: p.id, title: p.title, departmentId: p.departmentId || '', code: p.code || '', grade: p.grade || '', level: p.level || '', reportsToId: p.reportsToId || '', backupPositionId: p.backupPositionId || '', summary: p.summary || '', duties: p.duties || '', qualifications: p.qualifications || '', competencies: p.competencies || '', authorities: p.authorities || '', restrictions: p.restrictions || '', requiredTrainingIds: p.requiredTrainingIds || [] })}>تعديل</button>
                        <button className="btn sm gh" onClick={() => togglePos(p)}>{p.active === false ? 'تفعيل' : 'تعطيل'}</button>
                        <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => delPos(p)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {positions.length === 0 && <tr><td colSpan={5}><div className="empty">لا توجد وظائف بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'emps' && (
        <div className="card">
          <div className="card-h" style={{ marginBottom: 10 }}>
            <div className="card-t"><Users size={15} color="var(--brass)" />الموظفون — القسم والوظيفة والمستندات</div>
            <div className="row" style={{ gap: 6 }}>
              <label className="row" style={{ gap: 5, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />إظهار الموقوفين</label>
              <button className="btn sm pri" onClick={() => setEmpF({ name: '', branchId: ((org.branches || []).find(b => b.isActive !== false) || {}).id || '', jobTitle: '', departmentId: '', positionId: '', phone: '', idNumber: '', nationality: '', hireDate: today(), baseSalary: '', housingAllowance: '', transportAllowance: '', gosiSubject: false })}><Plus size={13} />موظف جديد</button>
            </div>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th><th>الفرع</th><th>القسم</th><th>الوظيفة</th><th style={{ textAlign: 'end' }}>المستندات</th><th /></tr></thead>
              <tbody>
                {emps.filter(e => showInactive || e.isActive !== false).map(e => {
                  const dept = depts.find(d => d.id === e.departmentId);
                  const pos = positions.find(p => p.id === e.positionId);
                  const docs = empDocs(e);
                  const expSoon = docs.some(x => x.expiryDate && Math.round((Date.parse(x.expiryDate + 'T00:00:00') - Date.parse(today() + 'T00:00:00')) / 86400000) <= 30);
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}<span style={{ fontSize: 9.5, color: 'var(--faint)', marginInlineStart: 6 }}>{e.jobTitle}</span>{e.isActive === false && <span className="badge b-dim" style={{ marginInlineStart: 6, fontSize: 9 }}>موقوف</span>}</td>
                      <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{(org.branches.find(b => b.id === e.branchId) || {}).name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{dept?.name || '—'}</td>
                      <td style={{ fontSize: 12 }}>{pos?.title || '—'}</td>
                      <td className="num" style={{ textAlign: 'end' }}>{docs.length}{expSoon && <span className="badge b-amber" style={{ marginInlineStart: 5, fontSize: 9 }}>انتباه</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                          <button className="btn sm gh" onClick={() => setAssignF({ id: e.id, name: e.name, departmentId: e.departmentId || '', positionId: e.positionId || '', syncTitle: true })}>القسم/الوظيفة</button>
                          <button className="btn sm gh" onClick={() => setDocsFor(e)}><FileText size={13} />المستندات</button>
                          <button className="btn sm gh" onClick={() => setEmpF(empToForm(e))}>تعديل</button>
                          <button className="btn sm gh" onClick={() => toggleEmp(e)}>{e.isActive === false ? 'تفعيل' : 'إيقاف'}</button>
                          {e.isActive === false && <button className="btn sm gh" title="حذف نهائي (فقط لموظف بلا أي سجلات)" onClick={() => deleteEmp(e)}><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {emps.length === 0 && <tr><td colSpan={6}><div className="empty">لا يوجد موظفون بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 8 }}>ربط الموظف بقسم/وظيفة اختياري ولا يغيّر أي شاشة أخرى في المنصّة — يُستخدم لاحقًا في مراحل الموارد البشرية القادمة (السياسات والتقييم والمكافآت).</div>
        </div>
      )}

      {deptF && (
        <Modal title={deptF.id ? 'تعديل قسم' : 'قسم جديد'} icon={Building2} onClose={() => setDeptF(null)}
          foot={<><button className="btn gh" onClick={() => setDeptF(null)}>إلغاء</button><button className="btn pri" onClick={saveDept}><Check size={14} />حفظ</button></>}>
          <Field label="اسم القسم"><input className="inp" value={deptF.name} onChange={e => setDeptF(f => ({ ...f, name: e.target.value }))} autoFocus /></Field>
          <Field label="ملاحظة (اختياري)"><input className="inp" value={deptF.note} onChange={e => setDeptF(f => ({ ...f, note: e.target.value }))} /></Field>
        </Modal>
      )}

      {posF && (
        <Modal title={posF.id ? 'تعديل وصف وظيفي' : 'وظيفة جديدة'} icon={UserCog} onClose={() => setPosF(null)} wide
          foot={<><button className="btn gh" onClick={() => setPosF(null)}>إلغاء</button><button className="btn pri" onClick={savePos}><Check size={14} />حفظ</button></>}>
          <div className="grid g3">
            <Field label="المسمى الوظيفي"><input className="inp" value={posF.title} onChange={e => setPosF(f => ({ ...f, title: e.target.value }))} autoFocus /></Field>
            <Field label="القسم">
              <select className="inp sel" value={posF.departmentId} onChange={e => setPosF(f => ({ ...f, departmentId: e.target.value }))}>
                <option value="">— بلا قسم —</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="الكود الوظيفي"><input className="inp" value={posF.code || ''} onChange={e => setPosF(f => ({ ...f, code: e.target.value }))} placeholder="مثال: KIT-03" /></Field>
            <Field label="الدرجة"><input className="inp" value={posF.grade || ''} onChange={e => setPosF(f => ({ ...f, grade: e.target.value }))} /></Field>
            <Field label="المستوى"><input className="inp" value={posF.level || ''} onChange={e => setPosF(f => ({ ...f, level: e.target.value }))} placeholder="مثال: مبتدئ/متوسط/قيادي" /></Field>
            <Field label="يرفع تقاريره إلى">
              <select className="inp sel" value={posF.reportsToId || ''} onChange={e => setPosF(f => ({ ...f, reportsToId: e.target.value }))}>
                <option value="">—</option>
                {positions.filter(p => p.id !== posF.id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="الوظيفة البديلة">
              <select className="inp sel" value={posF.backupPositionId || ''} onChange={e => setPosF(f => ({ ...f, backupPositionId: e.target.value }))}>
                <option value="">—</option>
                {positions.filter(p => p.id !== posF.id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
          </div>
          <Field label="ملخص الوظيفة"><textarea className="inp" rows={2} value={posF.summary || ''} onChange={e => setPosF(f => ({ ...f, summary: e.target.value }))} placeholder="الغرض العام من الوظيفة في سطر أو سطرين" /></Field>
          <div className="grid g2">
            <Field label="المهام والمسؤوليات (سطر لكل مهمة)"><textarea className="inp" rows={4} value={posF.duties} onChange={e => setPosF(f => ({ ...f, duties: e.target.value }))} placeholder={'استقبال الطلبات\nتحضير الأصناف وفق المعايير'} /></Field>
            <Field label="المؤهلات والخبرات (سطر لكل بند)"><textarea className="inp" rows={4} value={posF.qualifications || ''} onChange={e => setPosF(f => ({ ...f, qualifications: e.target.value }))} placeholder={'الثانوية كحد أدنى\nخبرة سنة في مطاعم'} /></Field>
            <Field label="الجدارات والمهارات (سطر لكل بند)"><textarea className="inp" rows={4} value={posF.competencies || ''} onChange={e => setPosF(f => ({ ...f, competencies: e.target.value }))} placeholder={'العمل الجماعي\nسرعة تحت الضغط'} /></Field>
            <Field label="الصلاحيات (سطر لكل بند)"><textarea className="inp" rows={4} value={posF.authorities || ''} onChange={e => setPosF(f => ({ ...f, authorities: e.target.value }))} placeholder={'صرف مصروف نثري حتى حد\nاعتماد خصم للعميل حتى نسبة'} /></Field>
          </div>
          <Field label="القيود والمحظورات (سطر لكل بند)"><textarea className="inp" rows={3} value={posF.restrictions || ''} onChange={e => setPosF(f => ({ ...f, restrictions: e.target.value }))} placeholder={'لا يفتح الخزنة دون المدير\nلا يمنح خصمًا فوق الحد'} /></Field>
          <Field label="التدريب والشهادات المطلوبة (ربط م19)">
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {((org.trainingPrograms && org.trainingPrograms.length) ? org.trainingPrograms : defaultTrainingPrograms()).map(pr => (
                <label key={pr.id} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={(posF.requiredTrainingIds || []).includes(pr.id)} onChange={() => setPosF(f => ({ ...f, requiredTrainingIds: (f.requiredTrainingIds || []).includes(pr.id) ? f.requiredTrainingIds.filter(x => x !== pr.id) : [...(f.requiredTrainingIds || []), pr.id] }))} />{pr.title}{pr.mandatory ? ' (إلزامي)' : ''}
                </label>
              ))}
            </div>
          </Field>
        </Modal>
      )}

      {jdView && (
        <Modal title={'الوصف الوظيفي — ' + jdView.title} icon={UserCog} onClose={() => setJdView(null)} wide
          foot={<><button className="btn gh" onClick={() => setJdView(null)}>إغلاق</button><button className="btn pri" onClick={() => { printA4(org, 'الوصف الوظيفي — ' + jdView.title, (depts.find(d => d.id === jdView.departmentId) || {}).name || '', positionJdHtml(jdView, org)) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); }}><Printer size={14} />طباعة</button></>}>
          <div className="jdbox" style={{ fontSize: 13, lineHeight: 1.9 }} dangerouslySetInnerHTML={{ __html: positionJdHtml(jdView, org) }} />
        </Modal>
      )}

      {empF && (
        <Modal title={empF.id ? 'تعديل بيانات موظف' : 'موظف جديد'} icon={Users} onClose={() => setEmpF(null)}
          foot={<><button className="btn pri" onClick={saveEmp}><Check size={14} />حفظ الموظف</button>
            <button className="btn gh" onClick={() => setEmpF(null)}>إلغاء</button></>}>
          <div className="grid" style={{ gap: 10 }}>
            <div className="grid g2">
              <Field label="الاسم الكامل"><input className="inp" autoFocus value={empF.name} onChange={e => setEmpF(f => ({ ...f, name: e.target.value }))} placeholder="كما في الهوية" /></Field>
              <Field label="الفرع (إلزامي)">
                <select className="inp sel" value={empF.branchId} onChange={e => setEmpF(f => ({ ...f, branchId: e.target.value }))}>
                  <option value="">اختر الفرع</option>
                  {(org.branches || []).filter(b => b.isActive !== false).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid g3">
              <Field label="القسم"><select className="inp sel" value={empF.departmentId} onChange={e => setEmpF(f => ({ ...f, departmentId: e.target.value, positionId: '' }))}><option value="">—</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="الوظيفة"><select className="inp sel" value={empF.positionId} onChange={e => setEmpF(f => ({ ...f, positionId: e.target.value }))}><option value="">—</option>{positions.filter(p => !empF.departmentId || p.departmentId === empF.departmentId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>
              <Field label="المسمّى (إن لم تُختر وظيفة)"><input className="inp" value={empF.jobTitle} onChange={e => setEmpF(f => ({ ...f, jobTitle: e.target.value }))} placeholder="كاشير، شيف…" /></Field>
            </div>
            <div className="grid g3">
              <Field label="الجوال"><input className="inp" style={{ direction: 'ltr', textAlign: 'right' }} value={empF.phone} onChange={e => setEmpF(f => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="رقم الهوية/الإقامة"><input className="inp n" value={empF.idNumber} onChange={e => setEmpF(f => ({ ...f, idNumber: e.target.value.replace(/\D/g, '') }))} /></Field>
              <Field label="تاريخ التعيين"><input type="date" className="inp" value={empF.hireDate} onChange={e => setEmpF(f => ({ ...f, hireDate: e.target.value }))} /></Field>
            </div>
            <div className="grid g3">
              <Field label="الجنسية (لنِسبة التأمينات)"><select className="inp sel" value={empF.nationality} onChange={e => setEmpF(f => ({ ...f, nationality: e.target.value }))}><option value="">غير محدّد</option><option value="saudi">سعودي</option><option value="nonSaudi">غير سعودي</option></select></Field>
              <Field label="الراتب الأساسي"><input className="inp n" inputMode="decimal" value={empF.baseSalary} onChange={e => setEmpF(f => ({ ...f, baseSalary: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <Field label="بدل السكن"><input className="inp n" inputMode="decimal" value={empF.housingAllowance} onChange={e => setEmpF(f => ({ ...f, housingAllowance: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            </div>
            <div className="grid g2">
              <Field label="بدل النقل"><input className="inp n" inputMode="decimal" value={empF.transportAllowance} onChange={e => setEmpF(f => ({ ...f, transportAllowance: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
              <label className="row" style={{ gap: 8, alignSelf: 'end', cursor: 'pointer', paddingBottom: 8 }}><input type="checkbox" checked={!!empF.gosiSubject} onChange={e => setEmpF(f => ({ ...f, gosiSubject: e.target.checked }))} />مشمول بالتأمينات الاجتماعية</label>
            </div>
            <div className="note">{empF.id ? 'تغيير الفرع يُبقي كل السجلات السابقة؛ PIN وبطاقة QR مرتبطان بالفرع القديم فأعد ضبطهما في الفرع الجديد.' : 'بعد الحفظ: اضبط رقم PIN أو أصدر بطاقة QR للموظف من «الحضور الموثَّق ← أرقام PIN» (مدير فرعه يستطيع ذلك أيضًا). الراتب والبدلات قابلة للتعديل لاحقًا من «الرواتب والسلف».'}</div>
          </div>
        </Modal>
      )}
      {assignF && (
        <Modal title={'القسم والوظيفة — ' + assignF.name} icon={UserCog} onClose={() => setAssignF(null)}
          foot={<><button className="btn gh" onClick={() => setAssignF(null)}>إلغاء</button><button className="btn pri" onClick={saveAssign}><Check size={14} />حفظ</button></>}>
          <Field label="القسم">
            <select className="inp sel" value={assignF.departmentId} onChange={e => setAssignF(f => ({ ...f, departmentId: e.target.value, positionId: '' }))}>
              <option value="">— بلا قسم —</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="الوظيفة">
            <select className="inp sel" value={assignF.positionId} onChange={e => setAssignF(f => ({ ...f, positionId: e.target.value }))}>
              <option value="">— بلا وظيفة —</option>
              {positions.filter(p => !assignF.departmentId || p.departmentId === assignF.departmentId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer', marginTop: 8 }}>
            <input type="checkbox" checked={assignF.syncTitle} onChange={e => setAssignF(f => ({ ...f, syncTitle: e.target.checked }))} />
            حدّث «المسمى الوظيفي» المعروض في المنصّة تلقائيًا من الوظيفة المختارة
          </label>
        </Modal>
      )}

      {docsFor && (
        <Modal title={'مستندات وعقود — ' + docsFor.name} icon={FileText} wide onClose={() => setDocsFor(null)}
          foot={<button className="btn gh" onClick={() => setDocsFor(null)}>إغلاق</button>}>
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
            <button className="btn sm" onClick={() => setDocF({ kind: 'contract', title: '', number: '', issueDate: '', expiryDate: '', file: '' })}><Plus size={13} />مستند جديد</button>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>النوع</th><th>العنوان</th><th>الرقم</th><th>الإصدار</th><th>الانتهاء</th><th /></tr></thead>
              <tbody>
                {empDocs(docsFor).map(x => (
                  <tr key={x.id}>
                    <td style={{ fontSize: 11.5 }}>{DOC_KINDS[x.kind] || 'أخرى'}</td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{x.title}{x.file && <FileText size={11} style={{ marginInlineStart: 5, color: 'var(--brass)' }} />}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{x.number || '—'}</td>
                    <td className="num" style={{ fontSize: 11 }}>{x.issueDate || '—'}</td>
                    <td className="num" style={{ fontSize: 11 }}>{x.expiryDate || '—'} {expiryTag(x.expiryDate)}</td>
                    <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn sm gh" onClick={() => setDocF({ id: x.id, kind: x.kind, title: x.title, number: x.number, issueDate: x.issueDate, expiryDate: x.expiryDate, file: x.file })}>تعديل</button>
                        <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => delDoc(x.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {empDocs(docsFor).length === 0 && <tr><td colSpan={6}><div className="empty">لا مستندات مرفوعة لهذا الموظف بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {docF && docsFor && (
        <Modal title={docF.id ? 'تعديل مستند' : 'مستند جديد'} icon={FileText} onClose={() => setDocF(null)}
          foot={<><button className="btn gh" onClick={() => setDocF(null)}>إلغاء</button><button className="btn pri" onClick={saveDoc}><Check size={14} />حفظ</button></>}>
          <div className="grid g2">
            <Field label="النوع">
              <select className="inp sel" value={docF.kind} onChange={e => setDocF(f => ({ ...f, kind: e.target.value }))}>
                {Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="العنوان"><input className="inp" value={docF.title} onChange={e => setDocF(f => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="الرقم (اختياري)"><input className="inp" value={docF.number} onChange={e => setDocF(f => ({ ...f, number: e.target.value }))} /></Field>
            <Field label="تاريخ الإصدار (اختياري)"><input className="inp" type="date" value={docF.issueDate} onChange={e => setDocF(f => ({ ...f, issueDate: e.target.value }))} /></Field>
            <Field label="تاريخ الانتهاء (اختياري)"><input className="inp" type="date" value={docF.expiryDate} onChange={e => setDocF(f => ({ ...f, expiryDate: e.target.value }))} /></Field>
          </div>
          <PhotoField label="المرفق (صورة أو PDF، اختياري)" value={docF.file} onChange={v => setDocF(f => ({ ...f, file: v }))} say={say} />
        </Modal>
      )}
    </div>
  );
}
