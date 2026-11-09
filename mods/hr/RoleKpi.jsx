/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { TrendingUp, FileText, Check, Trash2, Plus } from 'lucide-react';
import { Field, ROLES, defaultHrPolicies, defaultRoleKpis, kpiAchievement, nowISO, roleKpisFor, today, uid } from '../../App.jsx';

export function RoleKpi({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canManage = me.role === 'branch_manager' || isAll;   // إدخال قياسات الشهر
  const canConfig = isAll;                                   // المكتبة والتفعيل
  const branches = myBranches || [];
  const pol = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const kpisAll = (org.roleKpis && org.roleKpis.length) ? org.roleKpis : defaultRoleKpis();

  const [view, setView] = useState('entry');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => { if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || ''); }, [branches, branchId]); // eslint-disable-line
  const branch = branches.find(b => b.id === branchId) || null;
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const ymLabel = (y) => { const [Y, M] = String(y).split('-').map(Number); return isNaN(Y) ? y : new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };

  // ===== 1) إدخال القياسات الشهرية =====
  const [empId, setEmpId] = useState('');
  useEffect(() => { if (!emps.find(e => e.id === empId)) setEmpId((emps[0] || {}).id || ''); }, [branchId, emps.length]); // eslint-disable-line
  const selEmp = emps.find(e => e.id === empId) || null;
  const empKpis = selEmp ? roleKpisFor(org, selEmp) : [];
  const existing = selEmp ? (ops.hrKpiEntries || []).find(e => e.employeeId === selEmp.id && e.ym === ym) : null;
  const [vals, setVals] = useState({});
  useEffect(() => { setVals((existing && existing.values) ? { ...existing.values } : {}); }, [empId, ym, existing && existing.id]); // eslint-disable-line
  const liveScore = selEmp ? (() => { let num = 0, den = 0; empKpis.forEach(k => { const ach = kpiAchievement(vals[k.id], k.target, k.direction); const w = Number(k.weight) || 0; if (ach != null && w > 0) { num += ach * w; den += w; } }); return den ? Math.round(num / den) : null; })() : null;
  const saveEntry = async () => {
    if (!branch || !selEmp) return say('اختر الموظف', 'no');
    const clean = {}; Object.keys(vals).forEach(k => { if (vals[k] !== '' && vals[k] != null) clean[k] = Number(vals[k]); });
    if (!Object.keys(clean).length) return say('أدخل قيمة مؤشر واحد على الأقل', 'no');
    const rec = existing
      ? { ...existing, values: clean, recordedBy: me.id, recordedByName: me.name, recordedAt: nowISO() }
      : { id: uid('kpi'), branchId: branch.id, branchName: branch.name, employeeId: selEmp.id, employeeName: selEmp.name, ym, values: clean, recordedBy: me.id, recordedByName: me.name, recordedAt: nowISO() };
    const ok = await commit(d => ({ ...d, hrKpiEntries: existing ? (d.hrKpiEntries || []).map(x => x.id === existing.id ? rec : x) : [rec, ...(d.hrKpiEntries || [])] }),
      { actionType: existing ? 'update' : 'create', targetType: 'kpi_entry', targetId: rec.id, branchName: branch.name, title: 'قياسات KPI شهرية', details: selEmp.name + ' · ' + ymLabel(ym) + ' · ' + Object.keys(clean).length + ' مؤشر' });
    if (ok) say('حُفظت القياسات ✓');
  };

  // ===== 2) المكتبة + التفعيل (المركز) =====
  const [cf, setCf] = useState(() => ({
    roleKpiEnabled: !!pol.roleKpiEnabled, roleKpiWeight: String(Number(pol.roleKpiWeight) || 20),
    kpis: kpisAll.map(k => ({ ...k, jobTitles: (k.jobTitles || []).join('، '), target: String(k.target), weight: String(k.weight) }))
  }));
  const saveLib = async () => {
    const list = (cf.kpis || []).filter(k => String(k.title || '').trim()).map(k => ({
      id: k.id || uid('rk'), title: k.title.trim(), unit: (k.unit || '').trim(), direction: k.direction === 'lower' ? 'lower' : 'higher',
      target: Number(k.target) || 0, weight: Number(k.weight) || 0,
      jobTitles: String(k.jobTitles || '').split(/[،,]/).map(s => s.trim()).filter(Boolean)
    }));
    const ok = await commitOrg(d => ({ ...d, roleKpis: list, hrPolicies: { ...defaultHrPolicies(), ...(d.hrPolicies || {}), roleKpiEnabled: !!cf.roleKpiEnabled, roleKpiWeight: Number(cf.roleKpiWeight) || 0 } }),
      { actionType: 'update', targetType: 'settings', targetId: 'roleKpis', title: 'ضبط مكتبة مؤشرات الأداء بالدور', details: list.length + ' مؤشر · ' + (cf.roleKpiEnabled ? 'مفعّل بوزن ' + (Number(cf.roleKpiWeight) || 0) : 'غير مفعّل في الدرجة') });
    if (ok) say('حُفظت المكتبة ✓');
  };

  if (!branch && branches.length === 0) return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;

  const achBadge = (ach) => ach == null ? <span className="badge b-dim">—</span> : <span className={'badge ' + (ach >= 85 ? 'b-mint' : ach >= 60 ? 'b-amber' : 'b-rose')}>{ach}%</span>;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'entry' ? ' pri' : ' gh')} onClick={() => setView('entry')}><TrendingUp size={13} />التقييم الشهري</button>
            {canConfig && <button className={'btn sm' + (view === 'library' ? ' pri' : ' gh')} onClick={() => setView('library')}><FileText size={13} />المكتبة والتفعيل</button>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            {view === 'entry' && <input type="month" className="inp" value={ym} onChange={e => setYm(e.target.value)} />}
            {branches.length > 1 && view === 'entry' && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {view === 'entry' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {!pol.roleKpiEnabled && <div className="note" style={{ color: 'var(--amber)' }}>محور مؤشرات الدور غير مفعّل في درجة الأداء المركّبة (م7) — يمكنك إدخال القياسات الآن، لكنها لن تؤثّر في الدرجة حتى يفعّلها المركز من «المكتبة والتفعيل». هذا مقصود كي لا تتغيّر الدرجات القائمة قبل مراجعتك.</div>}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><TrendingUp size={15} color="var(--brass)" />قياسات مؤشرات الأداء — {branch.name} · {ymLabel(ym)}</div>
            <div className="grid g3" style={{ marginBottom: 8 }}>
              <Field label="الموظف"><select className="inp sel" value={empId} onChange={e => setEmpId(e.target.value)}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}{e.jobTitle ? ' — ' + e.jobTitle : ''}</option>)}</select></Field>
              {selEmp && <div style={{ alignSelf: 'flex-end' }}><span className="badge b-dim">درجة KPI: </span> {achBadge(liveScore)}</div>}
            </div>
            {selEmp ? (empKpis.length ? (
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>المؤشر</th><th>الاتجاه</th><th>الهدف</th><th>الفعلي</th><th>الوزن</th><th>التحقّق</th></tr></thead>
                  <tbody>
                    {empKpis.map(k => { const ach = kpiAchievement(vals[k.id], k.target, k.direction); return (
                      <tr key={k.id}>
                        <td style={{ fontWeight: 600, fontSize: 12.5 }}>{k.title}{k.unit ? <span style={{ fontSize: 10.5, color: 'var(--faint)' }}> ({k.unit})</span> : null}</td>
                        <td style={{ fontSize: 11.5 }}>{k.direction === 'lower' ? 'الأقل أفضل' : 'الأعلى أفضل'}</td>
                        <td className="num">{k.target}</td>
                        <td style={{ width: 120 }}><input className="inp n" inputMode="decimal" value={vals[k.id] == null ? '' : vals[k.id]} onChange={e => setVals(v => ({ ...v, [k.id]: e.target.value.replace(/[^\d.]/g, '') }))} /></td>
                        <td className="num">{k.weight}</td>
                        <td>{achBadge(ach)}</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty">لا مؤشرات منطبقة على مسمى «{selEmp.jobTitle || '—'}» — أضِف مؤشرات في المكتبة أو اترك مسمياتها فارغة لتشمل الجميع.</div>) : <div className="empty">اختر موظفًا لإدخال قياساته.</div>}
            {selEmp && empKpis.length > 0 && canManage && (
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn pri" onClick={saveEntry}><Check size={14} />حفظ القياسات</button></div>
            )}
          </div>
        </div>
      )}

      {view === 'library' && canConfig && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 6 }}><TrendingUp size={15} color="var(--brass)" />تفعيل المحور في درجة الأداء</div>
            <div className="note" style={{ marginBottom: 8 }}>عند التفعيل يُضاف «مؤشرات الدور» محورًا خامسًا في درجة الأداء المركّبة (م7) بالوزن المحدَّد — تُطبَّع الدرجة تلقائيًا مع بقية المحاور المتوفّرة. مُعطَّل افتراضيًا كي لا يغيّر أي درجة قائمة قبل مراجعتك.</div>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!cf.roleKpiEnabled} onChange={e => setCf(x => ({ ...x, roleKpiEnabled: e.target.checked }))} /><b>تفعيل محور مؤشرات الدور في الدرجة</b></label>
              <Field label="وزن المحور"><input className="inp n" style={{ width: 100 }} inputMode="numeric" value={cf.roleKpiWeight} onChange={e => setCf(x => ({ ...x, roleKpiWeight: e.target.value.replace(/\D/g, '') }))} /></Field>
            </div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />مكتبة مؤشرات الأداء لكل دور</div>
            <div className="note" style={{ marginBottom: 8 }}>عرّف مؤشرات كل مسمى وظيفي وهدفه ووزنه واتجاهه (الأعلى/الأقل أفضل). «المسميات» مفصولة بفواصل — فارغة تعني «لكل المسميات». الوزن نسبي داخل مؤشرات الموظف نفسه.</div>
            <div className="grid" style={{ gap: 8 }}>
              {cf.kpis.map((k, i) => (
                <div key={i} className="card" style={{ padding: 10, border: '1px solid var(--frame-o)' }}>
                  <div className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Field label="المؤشر" style={{ flex: 2, minWidth: 180 }}><input className="inp" value={k.title} onChange={e => setCf(x => ({ ...x, kpis: x.kpis.map((y, j) => j === i ? { ...y, title: e.target.value } : y) }))} /></Field>
                    <Field label="الوحدة"><input className="inp" style={{ width: 90 }} value={k.unit} onChange={e => setCf(x => ({ ...x, kpis: x.kpis.map((y, j) => j === i ? { ...y, unit: e.target.value } : y) }))} /></Field>
                    <Field label="الاتجاه"><select className="inp sel" style={{ width: 130 }} value={k.direction} onChange={e => setCf(x => ({ ...x, kpis: x.kpis.map((y, j) => j === i ? { ...y, direction: e.target.value } : y) }))}><option value="higher">الأعلى أفضل</option><option value="lower">الأقل أفضل</option></select></Field>
                    <Field label="الهدف"><input className="inp n" style={{ width: 90 }} inputMode="decimal" value={k.target} onChange={e => setCf(x => ({ ...x, kpis: x.kpis.map((y, j) => j === i ? { ...y, target: e.target.value.replace(/[^\d.]/g, '') } : y) }))} /></Field>
                    <Field label="الوزن"><input className="inp n" style={{ width: 80 }} inputMode="numeric" value={k.weight} onChange={e => setCf(x => ({ ...x, kpis: x.kpis.map((y, j) => j === i ? { ...y, weight: e.target.value.replace(/\D/g, '') } : y) }))} /></Field>
                    <button className="btn sm gh" onClick={() => setCf(x => ({ ...x, kpis: x.kpis.filter((_, j) => j !== i) }))}><Trash2 size={13} /></button>
                  </div>
                  <Field label="المسميات المنطبقة (فارغ = الجميع)" style={{ marginTop: 6 }}><input className="inp" value={k.jobTitles} onChange={e => setCf(x => ({ ...x, kpis: x.kpis.map((y, j) => j === i ? { ...y, jobTitles: e.target.value } : y) }))} placeholder="مثال: كاشير، شيف" /></Field>
                </div>
              ))}
              <div><button className="btn sm gh" onClick={() => setCf(x => ({ ...x, kpis: [...x.kpis, { id: '', title: '', unit: '', direction: 'higher', target: '0', weight: '20', jobTitles: '' }] }))}><Plus size={13} />مؤشر</button></div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn pri" onClick={saveLib}><Check size={14} />حفظ المكتبة والتفعيل</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
