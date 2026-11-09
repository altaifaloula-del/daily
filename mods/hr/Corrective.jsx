/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { PenLine, ShieldAlert, ShieldCheck, ClipboardCheck, Scale, Send, Trash2, Check, X, Plus } from 'lucide-react';
import { Field, LOCK_MSG, PEN_TYPES, ROLES, activePriorCorrectives, correctiveExpiry, correctiveSignDoc, daysBetween, defaultHrPolicies, defaultPenaltySchedule, fineSuggest, hrScoreFor, isoD, lockedThru, money, nowISO, penTypeAr, pipTriggered, suggestNextLevel, today, uid } from '../../App.jsx';

export function Corrective({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canRequest = me.role === 'branch_manager' || isAll;   // فتح إجراء: مدير الفرع + المركز
  const canApprove = !!role.approver;                         // الاعتماد النهائي: المكتب الرئيسي/مسؤول النظام/الإدارة العليا
  const canConfig = isAll;                                    // اللائحة والنوافذ الزمنية: أدوار المركز
  const branches = myBranches || [];
  const pol = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const schedule = (pol.penaltySchedule && pol.penaltySchedule.length) ? pol.penaltySchedule : defaultPenaltySchedule();
  const eraseDays = Number(pol.penaltyEraseDays) || 180;
  const capDays = Number(pol.fineCapDaysPerMonth) || 5;
  const chargeWindow = Number(pol.chargeWindowDays) || 30;
  const objectionDays = Number(pol.objectionDays) || 15;
  const pipThreshold = Number(pol.pipTriggerScore) || 60;

  const [view, setView] = useState(canApprove ? 'queue' : 'log');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => { if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || ''); }, [branches, branchId]); // eslint-disable-line
  const branch = branches.find(b => b.id === branchId) || null;
  const branchIds = branches.map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const empName = (id) => ((org.employees || []).find(e => e.id === id) || {}).name || '';
  const allRecs = (ops.hrCorrective || []).filter(r => branchIds.includes(r.branchId)).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  const allPips = (ops.hrPips || []).filter(p => branchIds.includes(p.branchId)).sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));
  const td = today();
  const ymLabel = (y) => { const [Y, M] = String(y).split('-').map(Number); return isNaN(Y) ? y : new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };
  const penBadge = (k) => { const rank = (PEN_TYPES.find(t => t.k === k) || {}).rank || 0; return <span className={'badge ' + (rank >= 6 ? 'b-rose' : rank >= 3 ? 'b-amber' : 'b-sky')}>{penTypeAr(k)}</span>; };
  const statusBadge = (st) => <span className={'badge ' + (st === 'approved' ? 'b-mint' : st === 'rejected' ? 'b-rose' : 'b-amber')}>{st === 'approved' ? 'معتمد' : st === 'rejected' ? 'مرفوض' : 'قيد الاعتماد'}</span>;

  // ===== 1) فتح إجراء تأديبي =====
  const emptyF = { empId: '', code: '', penaltyType: 'warning', fineDays: '0', description: '', discoveredAt: td, date: td, investigation: '', witnessName: '' };
  const [f, setF] = useState(emptyF);
  const selItem = schedule.find(s => s.code === f.code) || null;
  const priorActives = f.empId && f.code ? activePriorCorrectives(ops.hrCorrective || [], f.empId, f.code, f.date, eraseDays) : [];
  const suggestion = f.code ? suggestNextLevel(schedule, f.code, priorActives.length) : null;
  // تطبيق اقتراح السلّم تلقائيًا عند تغيّر الموظف/المخالفة (يبقى قابلًا لتعديل المدير يدويًا)
  useEffect(() => {
    if (suggestion) setF(x => ({ ...x, penaltyType: suggestion.penaltyType, fineDays: String(suggestion.fineDays || 0), description: x.description || (selItem ? selItem.title : '') }));
  }, [f.empId, f.code]); // eslint-disable-line
  const priorFineDaysMonth = (empId, month, exclId) => (ops.hrCorrective || []).filter(c => c.employeeId === empId && c.status === 'approved' && c.penaltyType === 'fine' && (c.month === month) && c.id !== exclId).reduce((a, c) => a + (Number(c.fineDays) || 0), 0);
  const selEmp = emps.find(e => e.id === f.empId) || null;
  const fineCalc = (selEmp && f.penaltyType === 'fine') ? fineSuggest(selEmp.baseSalary, f.fineDays, capDays, priorFineDaysMonth(f.empId, (f.date || td).slice(0, 7))) : null;
  const chargeLate = f.discoveredAt && daysBetween(f.discoveredAt, f.date) > chargeWindow;

  const submit = async () => {
    if (!branch) return;
    if (!selEmp) return say('اختر الموظف', 'no');
    if (!f.code) return say('اختر نوع المخالفة من اللائحة', 'no');
    if (!String(f.description || '').trim()) return say('اكتب وصف المخالفة', 'no');
    const month = (f.date || td).slice(0, 7);
    if (f.penaltyType === 'fine' && lockedThru(org) && month <= lockedThru(org)) return say(LOCK_MSG(month + '-01'), 'no');
    const fc = f.penaltyType === 'fine' ? fineSuggest(selEmp.baseSalary, f.fineDays, capDays, priorFineDaysMonth(f.empId, month)) : { days: 0, amount: 0 };
    const rec = {
      id: uid('cr'), branchId: branch.id, branchName: branch.name, employeeId: selEmp.id, employeeName: selEmp.name,
      month, date: f.date || td, category: selItem ? selItem.category : '', code: f.code, title: selItem ? selItem.title : '',
      level: priorActives.length + 1, penaltyType: f.penaltyType, fineDays: fc.days || 0, fineAmount: fc.amount || 0,
      description: f.description.trim(), discoveredAt: f.discoveredAt || td, investigation: (f.investigation || '').trim(), witnessName: (f.witnessName || '').trim(),
      status: 'pending', requestedBy: me.id, requestedByName: me.name, requestedAt: nowISO()
    };
    const ok = await commit(d => ({ ...d, hrCorrective: [rec, ...(d.hrCorrective || [])] }),
      { actionType: 'create', targetType: 'corrective_action', targetId: rec.id, branchName: branch.name, title: 'فتح إجراء تأديبي', details: rec.employeeName + ' · ' + rec.title + ' · مستوى ' + rec.level + ' · ' + penTypeAr(rec.penaltyType) + (rec.fineAmount ? ' (' + money(rec.fineAmount) + ' ر.س)' : '') });
    if (!ok) return;
    say('سُجِّل الإجراء ✓ — بانتظار الاعتماد المركزي');
    setF({ ...emptyF, date: f.date, discoveredAt: f.discoveredAt });
  };
  const cancelReq = async (r) => {
    if (r.status !== 'pending') return;
    if (!window.confirm('إلغاء إجراء «' + r.employeeName + '»؟')) return;
    await commit(d => ({ ...d, hrCorrective: (d.hrCorrective || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'corrective_action', targetId: r.id, branchName: r.branchName, title: 'إلغاء إجراء تأديبي', details: r.employeeName + ' · ' + (r.title || '') });
    say('أُلغي الإجراء');
  };

  // ===== 2) الاعتماد المركزي (+ ترحيل الغرامة لمسيّر الرواتب + إصدار محضر التوقيع) =====
  const [notes, setNotes] = useState({});
  const pending = allRecs.filter(r => r.status === 'pending');
  const decided = allRecs.filter(r => r.status !== 'pending');
  const decide = async (r, approve) => {
    if (!canApprove) return;
    const note = (notes[r.id] || '').trim();
    if (approve) {
      const month = r.month || (r.date || '').slice(0, 7);
      let adv = null, fineAmt = 0;
      if (r.penaltyType === 'fine') {
        if (lockedThru(org) && month <= lockedThru(org)) return say(LOCK_MSG(month + '-01'), 'no');
        const fc = fineSuggest(((org.employees || []).find(e => e.id === r.employeeId) || {}).baseSalary, r.fineDays, capDays, priorFineDaysMonth(r.employeeId, month, r.id));
        fineAmt = fc.amount;
        const existing = (ops.advances || []).find(a => a.correctiveId === r.id);
        adv = existing || {
          id: uid('ad'), correctiveId: r.id, employeeId: r.employeeId, employeeName: r.employeeName, branchId: r.branchId, branchName: r.branchName,
          month, date: month + '-28', type: 'discipline_penalty', amount: fineAmt,
          reason: 'غرامة تأديبية معتمدة: ' + (r.title || '') + ' — مستوى ' + r.level, paymentMethod: 'salary', isUnjustified: false, createdByName: me.name, createdAt: nowISO()
        };
        if (existing) adv = { ...existing, amount: fineAmt };
      }
      const ok = await commit(d => {
        const hasAdv = adv ? (d.advances || []).some(a => a.correctiveId === r.id) : false;
        return {
          ...d,
          advances: !adv ? (d.advances || []) : (hasAdv ? (d.advances || []).map(a => a.correctiveId === r.id ? { ...a, amount: fineAmt } : a) : [adv, ...(d.advances || [])]),
          hrCorrective: (d.hrCorrective || []).map(x => x.id === r.id ? { ...x, status: 'approved', fineAmount: fineAmt, decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO(), decisionNote: note, expiresAt: correctiveExpiry(r.date, eraseDays), advanceId: adv ? adv.id : '', signRefId: r.id } : x),
          hrSignDocs: (d.hrSignDocs || []).some(x => x.refId === r.id) ? (d.hrSignDocs || []) : [correctiveSignDoc({ ...r, fineAmount: fineAmt }, me), ...(d.hrSignDocs || [])]
        };
      }, { actionType: 'approve', targetType: 'corrective_action', targetId: r.id, branchName: r.branchName, title: 'اعتماد إجراء تأديبي', details: r.employeeName + ' · ' + (r.title || '') + ' · ' + penTypeAr(r.penaltyType) + (fineAmt ? ' · غرامة ' + money(fineAmt) + ' ر.س لشهر ' + month : '') + ' · صدر محضر للتوقيع' + (note ? ' · ' + note : '') });
      if (ok) say('اعتُمد الإجراء ✓' + (fineAmt ? ' ورُحِّلت الغرامة لمسيّر رواتب ' + month : '') + ' وصدر محضر بالعلم للتوقيع');
    } else {
      if (!note) return say('اكتب سبب الرفض في الملاحظة', 'no');
      const ok = await commit(d => ({ ...d, hrCorrective: (d.hrCorrective || []).map(x => x.id === r.id ? { ...x, status: 'rejected', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO(), decisionNote: note } : x) }),
        { actionType: 'reject', targetType: 'corrective_action', targetId: r.id, branchName: r.branchName, title: 'رفض إجراء تأديبي', details: r.employeeName + ' · ' + note });
      if (ok) say('رُفض الإجراء');
    }
  };
  const revertApproval = async (r) => {
    if (!canApprove || r.status !== 'approved') return;
    const month = r.month || (r.date || '').slice(0, 7);
    if (r.penaltyType === 'fine') {
      const accrued = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === month);
      if (accrued) return say('لا يمكن التراجع: استحقاق رواتب شهر ' + month + ' مُرحَّل للدفتر — عالجه بقيد يدوي', 'no');
      if (lockedThru(org) && month <= lockedThru(org)) return say(LOCK_MSG(month + '-01'), 'no');
    }
    if (!window.confirm('التراجع عن اعتماد إجراء «' + r.employeeName + '»؟ ستُحذف الغرامة إن وُجدت ويعود الإجراء قيد الاعتماد.')) return;
    const ok = await commit(d => ({
      ...d,
      advances: (d.advances || []).filter(a => a.correctiveId !== r.id),
      hrCorrective: (d.hrCorrective || []).map(x => x.id === r.id ? { ...x, status: 'pending', decidedBy: '', decidedByName: '', decidedAt: '', decisionNote: '', expiresAt: '', advanceId: '' } : x),
      hrSignDocs: (d.hrSignDocs || []).filter(x => !(x.refId === r.id && x.status === 'pending')).map(x => (x.refId === r.id && x.status === 'signed') ? { ...x, status: 'voided', voidedAt: nowISO(), voidedByName: me.name } : x)
    }), { actionType: 'update', targetType: 'corrective_action', targetId: r.id, branchName: r.branchName, title: 'التراجع عن اعتماد إجراء تأديبي', details: r.employeeName + ' · ' + (r.title || '') });
    if (ok) say('تراجعتَ عن الاعتماد — الإجراء قيد الاعتماد مجددًا');
  };
  // تظلّم الموظف (خلال objectionDays من الاعتماد) — يُسجَّل ثم يبتّه المركز
  const [objTxt, setObjTxt] = useState({});
  const logObjection = async (r) => {
    const t = (objTxt[r.id] || '').trim(); if (!t) return say('اكتب نص التظلّم', 'no');
    const ok = await commit(d => ({ ...d, hrCorrective: (d.hrCorrective || []).map(x => x.id === r.id ? { ...x, objection: { at: nowISO(), text: t, decidedNote: '', decidedByName: '', decidedAt: '' } } : x) }),
      { actionType: 'update', targetType: 'corrective_action', targetId: r.id, branchName: r.branchName, title: 'تسجيل تظلّم موظف', details: r.employeeName + ' · ' + t });
    if (ok) { say('سُجِّل التظلّم ✓'); setObjTxt(o => ({ ...o, [r.id]: '' })); }
  };
  const decideObjection = async (r, note) => {
    if (!canApprove) return; const n = (note || '').trim(); if (!n) return say('اكتب قرار البتّ في التظلّم', 'no');
    const ok = await commit(d => ({ ...d, hrCorrective: (d.hrCorrective || []).map(x => x.id === r.id ? { ...x, objection: { ...(x.objection || {}), decidedNote: n, decidedByName: me.name, decidedAt: nowISO() } } : x) }),
      { actionType: 'update', targetType: 'corrective_action', targetId: r.id, branchName: r.branchName, title: 'البتّ في تظلّم موظف', details: r.employeeName + ' · ' + n });
    if (ok) say('سُجِّل قرار التظلّم');
  };

  // ===== 3) خطط تحسين الأداء (PIP) =====
  const curYm = td.slice(0, 7);
  const activePipEmpIds = new Set(allPips.filter(p => p.status === 'active').map(p => p.employeeId));
  const belowThreshold = branch ? emps.map(e => ({ e, sc: hrScoreFor(org, ops, e, curYm).score })).filter(x => pipTriggered(x.sc, pipThreshold) && !activePipEmpIds.has(x.e.id)) : [];
  const [pf, setPf] = useState(null);   // نموذج فتح PIP للموظف المحدَّد
  const openPipForm = (e, sc) => {
    const end = new Date(td + 'T00:00:00'); end.setDate(end.getDate() + 30);
    setPf({ empId: e.id, empName: e.name, reason: sc != null ? ('درجة الأداء ' + sc + '/100 دون العتبة ' + pipThreshold) : 'قرار إداري', triggerScore: sc, mentorName: '', startAt: td, endAt: isoD(end), objectives: [{ text: '', metric: '', target: '' }] });
  };
  const savePip = async () => {
    if (!pf || !branch) return;
    const objs = (pf.objectives || []).filter(o => String(o.text || '').trim()).map(o => ({ text: o.text.trim(), metric: (o.metric || '').trim(), target: (o.target || '').trim() }));
    if (!objs.length) return say('أضف هدفًا واحدًا على الأقل', 'no');
    const rec = { id: uid('pip'), branchId: branch.id, branchName: branch.name, employeeId: pf.empId, employeeName: pf.empName, openedAt: nowISO(), reason: pf.reason, triggerScore: pf.triggerScore, triggerMonth: curYm, objectives: objs, mentorName: (pf.mentorName || '').trim(), startAt: pf.startAt, endAt: pf.endAt, reviews: [], status: 'active', outcome: '', closedByName: '', closedAt: '' };
    const ok = await commit(d => ({ ...d, hrPips: [rec, ...(d.hrPips || [])] }),
      { actionType: 'create', targetType: 'pip', targetId: rec.id, branchName: branch.name, title: 'فتح خطة تحسين أداء', details: rec.employeeName + ' · ' + objs.length + ' هدف · حتى ' + rec.endAt });
    if (ok) { say('فُتحت خطة تحسين الأداء ✓'); setPf(null); }
  };
  const [rvTxt, setRvTxt] = useState({});
  const addReview = async (p) => {
    const v = rvTxt[p.id] || {}; const note = (v.note || '').trim(); const progress = Number(v.progress);
    if (!note) return say('اكتب ملاحظة المراجعة', 'no');
    const rev = { at: nowISO(), byName: me.name, note, progress: isNaN(progress) ? null : Math.max(0, Math.min(100, progress)) };
    const ok = await commit(d => ({ ...d, hrPips: (d.hrPips || []).map(x => x.id === p.id ? { ...x, reviews: [...(x.reviews || []), rev] } : x) }),
      { actionType: 'update', targetType: 'pip', targetId: p.id, branchName: p.branchName, title: 'مراجعة خطة تحسين أداء', details: p.employeeName + ' · ' + note + (rev.progress != null ? ' · ' + rev.progress + '%' : '') });
    if (ok) { say('سُجِّلت المراجعة ✓'); setRvTxt(o => ({ ...o, [p.id]: {} })); }
  };
  const closePip = async (p, outcome) => {
    const outAr = { passed: 'ناجحة', failed: 'غير ناجحة', closed: 'مُغلقة' }[outcome] || outcome;
    if (!window.confirm('إغلاق خطة «' + p.employeeName + '» كـ«' + outAr + '»؟')) return;
    const ok = await commit(d => ({ ...d, hrPips: (d.hrPips || []).map(x => x.id === p.id ? { ...x, status: outcome, outcome: outAr, closedByName: me.name, closedAt: nowISO() } : x) }),
      { actionType: 'update', targetType: 'pip', targetId: p.id, branchName: p.branchName, title: 'إغلاق خطة تحسين أداء', details: p.employeeName + ' · ' + outAr });
    if (ok) say('أُغلقت الخطة (' + outAr + ')');
  };

  // ===== 4) اللائحة والنوافذ الزمنية (المركز) =====
  const [cf, setCf] = useState(() => ({
    penaltyEraseDays: String(eraseDays), fineCapDaysPerMonth: String(capDays), chargeWindowDays: String(chargeWindow), objectionDays: String(objectionDays), pipTriggerScore: String(pipThreshold),
    penaltySchedule: schedule.map(s => ({ ...s, ladder: (s.ladder || []).map(l => ({ ...l })) }))
  }));
  const saveConfig = async () => {
    const sched = (cf.penaltySchedule || []).filter(s => String(s.code || '').trim() && String(s.title || '').trim()).map(s => ({
      code: s.code.trim(), category: (s.category || '').trim(), title: s.title.trim(),
      ladder: (s.ladder || []).map((l, i) => ({ level: i + 1, penaltyType: l.penaltyType || 'warning', fineDays: Number(l.fineDays) || 0 }))
    }));
    const patch = { penaltyEraseDays: Number(cf.penaltyEraseDays) || 180, fineCapDaysPerMonth: Number(cf.fineCapDaysPerMonth) || 5, chargeWindowDays: Number(cf.chargeWindowDays) || 30, objectionDays: Number(cf.objectionDays) || 15, pipTriggerScore: Number(cf.pipTriggerScore) || 60, penaltySchedule: sched };
    const ok = await commitOrg(d => ({ ...d, hrPolicies: { ...defaultHrPolicies(), ...(d.hrPolicies || {}), ...patch } }),
      { actionType: 'update', targetType: 'settings', targetId: 'hrPolicies.penalty', title: 'ضبط لائحة الجزاءات والنوافذ الزمنية', details: sched.length + ' مخالفة · محو ' + patch.penaltyEraseDays + 'ي · سقف غرامة ' + patch.fineCapDaysPerMonth + ' أيام · عتبة PIP ' + patch.pipTriggerScore });
    if (ok) say('حُفظت اللائحة ✓');
  };

  if (!branch && branches.length === 0) return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;

  const CorrTable = ({ rows, actions }) => (
    <div className="tw">
      <table className="tb">
        <thead><tr><th>الموظف</th>{branches.length > 1 && <th>الفرع</th>}<th>المخالفة</th><th>المستوى</th><th>الجزاء</th><th>الغرامة</th><th>التاريخ</th><th>الحالة</th>{actions && <th />}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.employeeName}</td>
              {branches.length > 1 && <td style={{ fontSize: 12 }}>{r.branchName}</td>}
              <td style={{ fontSize: 12 }}>{r.title || '—'}{r.category ? <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r.category}</div> : null}{r.description ? <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{r.description}</div> : null}</td>
              <td className="num">{r.level}</td>
              <td>{penBadge(r.penaltyType)}</td>
              <td className="num">{r.penaltyType === 'fine' ? money(r.fineAmount || 0) : '—'}</td>
              <td className="num" style={{ fontSize: 11.5 }}>{r.date}{r.status === 'approved' && r.expiresAt ? <div style={{ fontSize: 10, color: 'var(--faint)' }}>يُمحى {r.expiresAt}</div> : null}</td>
              <td>{statusBadge(r.status)}{r.decisionNote ? <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{r.decisionNote}</div> : null}{r.status === 'approved' && (() => { const sd = (ops.hrSignDocs || []).find(x => x.refId === r.id); return sd ? <div style={{ marginTop: 3 }}><span className={'badge ' + (sd.status === 'signed' ? 'b-mint' : sd.status === 'voided' ? 'b-dim' : 'b-amber')} style={{ fontSize: 9.5 }}><PenLine size={10} />{sd.status === 'signed' ? 'وقّع المحضر' : sd.status === 'voided' ? 'محضر مُلغى' : 'بانتظار توقيع الموظف'}</span></div> : null; })()}{r.objection ? <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--amber)' }}>تظلّم: {r.objection.text}{r.objection.decidedNote ? <div style={{ color: 'var(--mint)' }}>القرار: {r.objection.decidedNote}</div> : null}</div> : null}</td>
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={branches.length > 1 ? 9 : 8}><div className="empty">لا توجد إجراءات.</div></td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'log' ? ' pri' : ' gh')} onClick={() => setView('log')}><ShieldAlert size={13} />الإجراءات التأديبية</button>
            {canApprove && <button className={'btn sm' + (view === 'queue' ? ' pri' : ' gh')} onClick={() => setView('queue')}><ShieldCheck size={13} />الاعتماد{pending.length ? <span className="badge b-amber" style={{ marginInlineStart: 6 }}>{pending.length}</span> : null}</button>}
            <button className={'btn sm' + (view === 'pip' ? ' pri' : ' gh')} onClick={() => setView('pip')}><ClipboardCheck size={13} />خطط تحسين الأداء{belowThreshold.length ? <span className="badge b-rose" style={{ marginInlineStart: 6 }}>{belowThreshold.length}</span> : null}</button>
            {canConfig && <button className={'btn sm' + (view === 'schedule' ? ' pri' : ' gh')} onClick={() => setView('schedule')}><Scale size={13} />اللائحة</button>}
          </div>
          {branches.length > 1 && view !== 'schedule' && (
            <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {view === 'log' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canRequest && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><ShieldAlert size={15} color="var(--brass)" />فتح إجراء تأديبي — {branch.name}</div>
              <div className="note" style={{ marginBottom: 8 }}>يُحدَّد الجزاء تلقائيًا حسب سلّم اللائحة وعدد المخالفات السابقة السارية للموظف (تُمحى بعد {eraseDays} يومًا). لا أثر مالي قبل الاعتماد المركزي؛ بعد الاعتماد يصدر محضر بالعلم يوقّعه الموظف من كشك الفرع، وتُرحَّل الغرامة — إن وُجدت — لمسيّر الرواتب.</div>
              <div className="grid g3">
                <Field label="الموظف"><select className="inp sel" value={f.empId} onChange={e => setF(x => ({ ...x, empId: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="المخالفة (من اللائحة)"><select className="inp sel" value={f.code} onChange={e => setF(x => ({ ...x, code: e.target.value }))}><option value="">اختر</option>{schedule.map(s => <option key={s.code} value={s.code}>{s.title} ({s.category})</option>)}</select></Field>
                <Field label="تاريخ المخالفة"><input type="date" className="inp" value={f.date} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Field>
                <Field label="نوع الجزاء"><select className="inp sel" value={f.penaltyType} onChange={e => setF(x => ({ ...x, penaltyType: e.target.value }))}>{PEN_TYPES.map(t => <option key={t.k} value={t.k}>{t.ar}</option>)}</select></Field>
                {f.penaltyType === 'fine' && <Field label="أيام الغرامة (أجر)"><input className="inp n" inputMode="decimal" value={f.fineDays} onChange={e => setF(x => ({ ...x, fineDays: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
                <Field label="تاريخ اكتشاف المخالفة"><input type="date" className="inp" value={f.discoveredAt} onChange={e => setF(x => ({ ...x, discoveredAt: e.target.value }))} /></Field>
                <Field label="وصف المخالفة (إلزامي)" style={{ gridColumn: 'span 2' }}><input className="inp" value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))} placeholder="ماذا حدث بالتحديد ومتى وأين" /></Field>
                <Field label="الشاهد (اختياري)"><input className="inp" value={f.witnessName} onChange={e => setF(x => ({ ...x, witnessName: e.target.value }))} /></Field>
                <Field label="التحقيق ودفاع الموظف (محضر — نظام العمل)" style={{ gridColumn: 'span 3' }}><textarea className="inp" rows={2} value={f.investigation} onChange={e => setF(x => ({ ...x, investigation: e.target.value }))} placeholder="ما أُبلِغ به الموظف كتابةً، واستجوابه، ودفاعه — يُثبَت في المحضر" /></Field>
              </div>
              {(suggestion || priorActives.length > 0 || fineCalc || chargeLate) && (
                <div className="card" style={{ padding: 10, marginTop: 8, background: 'rgba(200,162,74,.06)', fontSize: 12, lineHeight: 1.9 }}>
                  {priorActives.length > 0 && <div>سجل ساري لهذه المخالفة: <b>{priorActives.length}</b> جزاء سابق ⇒ هذا هو المستوى <b>{priorActives.length + 1}</b>.</div>}
                  {priorActives.length === 0 && <div>لا جزاء ساري سابق لهذه المخالفة ⇒ المستوى <b>الأول</b>.</div>}
                  {suggestion && <div>اقتراح اللائحة: <b>{penTypeAr(suggestion.penaltyType)}</b>{suggestion.overflow ? ' (تجاوز أعلى درجات السلّم — راجع اللائحة)' : ''}.</div>}
                  {fineCalc && <div>الغرامة: {fineCalc.days} يوم أجر × {money(fineCalc.dw)} = <b>{money(fineCalc.amount)} ر.س</b>{fineCalc.capped ? <span style={{ color: 'var(--rose)' }}> — محدودة بسقف {capDays} أيام أجر شهريًا (المتبقي هذا الشهر {fineCalc.remaining} يوم)</span> : ''}.</div>}
                  {chargeLate && <div style={{ color: 'var(--rose)' }}>⚠ مضى أكثر من {chargeWindow} يومًا بين اكتشاف المخالفة وتاريخها — قد تسقط المؤاخذة نظامًا (المادة 69).</div>}
                </div>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn pri" onClick={submit}><Send size={14} />إرسال للاعتماد</button></div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>سجل إجراءات {branch.name}</div>
            <CorrTable rows={allRecs.filter(r => r.branchId === branch.id)} actions={(r) => (
              <div className="grid" style={{ gap: 4, minWidth: 150 }}>
                {r.status === 'pending' && canRequest && (r.requestedBy === me.id || isAll) && <button className="btn sm gh" onClick={() => cancelReq(r)}><Trash2 size={13} />إلغاء</button>}
                {r.status === 'approved' && !r.objection && daysBetween((r.decidedAt || '').slice(0, 10), td) <= objectionDays && (
                  <><input className="inp" style={{ fontSize: 11 }} placeholder={'تظلّم (خلال ' + objectionDays + ' يوم)'} value={objTxt[r.id] || ''} onChange={e => setObjTxt(o => ({ ...o, [r.id]: e.target.value }))} /><button className="btn sm gh" onClick={() => logObjection(r)}>تسجيل تظلّم</button></>
                )}
                {r.status === 'approved' && r.objection && !r.objection.decidedNote && canApprove && (
                  <><input className="inp" style={{ fontSize: 11 }} placeholder="قرار البتّ" value={notes['obj-' + r.id] || ''} onChange={e => setNotes(n => ({ ...n, ['obj-' + r.id]: e.target.value }))} /><button className="btn sm gh" onClick={() => decideObjection(r, notes['obj-' + r.id])}>بتّ التظلّم</button></>
                )}
              </div>
            )} />
          </div>
        </div>
      )}

      {view === 'queue' && canApprove && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><ShieldCheck size={15} color="var(--brass)" />اعتماد الإجراءات التأديبية — {pending.length} قيد الانتظار (كل فروعي)</div>
            <div className="note" style={{ marginBottom: 8 }}>الاعتماد يُثبِّت مدة محو الجزاء، ويصدر محضرًا بالعلم للتوقيع الإلكتروني، ويُرحِّل الغرامة (إن وُجدت) لمسيّر رواتب الشهر — بسقف {capDays} أيام أجر شهريًا.</div>
            <CorrTable rows={pending} actions={(r) => (
              <div className="grid" style={{ gap: 5, minWidth: 190 }}>
                <input className="inp" placeholder="ملاحظة القرار (إلزامية للرفض)" value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                  <button className="btn sm pri" onClick={() => decide(r, true)}><Check size={13} />اعتماد</button>
                  <button className="btn sm gh" onClick={() => decide(r, false)}><X size={13} />رفض</button>
                </div>
              </div>
            )} />
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>سجل القرارات</div>
            <CorrTable rows={decided} actions={(r) => (r.status === 'approved' ? <button className="btn sm gh" title="التراجع عن الاعتماد" onClick={() => revertApproval(r)}><X size={13} />تراجع</button> : null)} />
          </div>
        </div>
      )}

      {view === 'pip' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />خطط تحسين الأداء — {branch.name}</div>
            <div className="note" style={{ marginBottom: 8 }}>خطة تحسين الأداء بديل تطويري عن الجزاء: أهداف قابلة للقياس ومدة ومراجعات دورية. تُقترح تلقائيًا لمن درجته (م7) لشهر {ymLabel(curYm)} دون العتبة {pipThreshold} وليست لديه خطة نشطة.</div>
            {belowThreshold.length > 0 ? (
              <div className="grid g3">
                {belowThreshold.map(({ e, sc }) => (
                  <div key={e.id} className="card" style={{ padding: 10, border: '1px solid var(--frame-o)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</div>
                    <div style={{ marginTop: 4 }}><span className="badge b-rose">درجة {sc}/100</span></div>
                    <button className="btn sm pri" style={{ marginTop: 8 }} onClick={() => openPipForm(e, sc)}><Plus size={13} />فتح خطة</button>
                  </div>
                ))}
              </div>
            ) : <div className="empty">لا موظفين دون العتبة لهذا الشهر — أو خططهم نشطة. يمكنك فتح خطة يدويًا لأي موظف.</div>}
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="فتح خطة يدويًا لموظف"><select className="inp sel" style={{ width: 200 }} value={(pf && pf.manualSel) || ''} onChange={e => { const emp = emps.find(x => x.id === e.target.value); if (emp) openPipForm(emp, hrScoreFor(org, ops, emp, curYm).score); }}><option value="">اختر موظفًا</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
            </div>
          </div>

          {pf && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />خطة تحسين أداء — {pf.empName}</div>
              <div className="grid g3">
                <Field label="السبب"><input className="inp" value={pf.reason} onChange={e => setPf(x => ({ ...x, reason: e.target.value }))} /></Field>
                <Field label="المسؤول/الموجّه"><input className="inp" value={pf.mentorName} onChange={e => setPf(x => ({ ...x, mentorName: e.target.value }))} /></Field>
                <Field label="من"><input type="date" className="inp" value={pf.startAt} onChange={e => setPf(x => ({ ...x, startAt: e.target.value }))} /></Field>
                <Field label="إلى"><input type="date" className="inp" value={pf.endAt} onChange={e => setPf(x => ({ ...x, endAt: e.target.value }))} /></Field>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 4px' }}>الأهداف القابلة للقياس</div>
              <div className="grid" style={{ gap: 6 }}>
                {pf.objectives.map((o, i) => (
                  <div key={i} className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Field label="الهدف" style={{ flex: 2, minWidth: 180 }}><input className="inp" value={o.text} onChange={e => setPf(x => ({ ...x, objectives: x.objectives.map((y, j) => j === i ? { ...y, text: e.target.value } : y) }))} /></Field>
                    <Field label="المقياس"><input className="inp" value={o.metric} onChange={e => setPf(x => ({ ...x, objectives: x.objectives.map((y, j) => j === i ? { ...y, metric: e.target.value } : y) }))} /></Field>
                    <Field label="المستهدف"><input className="inp" value={o.target} onChange={e => setPf(x => ({ ...x, objectives: x.objectives.map((y, j) => j === i ? { ...y, target: e.target.value } : y) }))} /></Field>
                    <button className="btn sm gh" onClick={() => setPf(x => ({ ...x, objectives: x.objectives.filter((_, j) => j !== i) }))}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div><button className="btn sm gh" onClick={() => setPf(x => ({ ...x, objectives: [...x.objectives, { text: '', metric: '', target: '' }] }))}><Plus size={13} />هدف</button></div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
                <button className="btn gh" onClick={() => setPf(null)}>إلغاء</button>
                <button className="btn pri" onClick={savePip}><Check size={14} />فتح الخطة</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>الخطط النشطة والمغلقة — {branch.name}</div>
            <div className="grid" style={{ gap: 10 }}>
              {allPips.filter(p => p.branchId === branch.id).map(p => (
                <div key={p.id} className="card" style={{ padding: 12, border: '1px solid var(--frame-o)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <div><b>{p.employeeName}</b> <span className="badge b-dim" style={{ fontSize: 10 }}>{p.startAt} ← {p.endAt}</span></div>
                    <span className={'badge ' + (p.status === 'active' ? 'b-amber' : p.status === 'passed' ? 'b-mint' : p.status === 'failed' ? 'b-rose' : 'b-dim')}>{p.status === 'active' ? 'نشطة' : p.outcome || p.status}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{p.reason}{p.mentorName ? ' · الموجّه: ' + p.mentorName : ''}</div>
                  <ul style={{ margin: '6px 0', paddingInlineStart: 18, fontSize: 12 }}>{p.objectives.map((o, i) => <li key={i}>{o.text}{o.metric ? ' — ' + o.metric : ''}{o.target ? ' (' + o.target + ')' : ''}</li>)}</ul>
                  {(p.reviews || []).length > 0 && <div style={{ fontSize: 11, color: 'var(--dim)', borderTop: '1px dashed var(--frame-o)', paddingTop: 6 }}>{p.reviews.map((rv, i) => <div key={i}>• {(rv.at || '').slice(0, 10)} — {rv.note}{rv.progress != null ? ' (' + rv.progress + '%)' : ''} — {rv.byName}</div>)}</div>}
                  {p.status === 'active' && (
                    <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <Field label="مراجعة" style={{ flex: 2, minWidth: 160 }}><input className="inp" value={(rvTxt[p.id] || {}).note || ''} onChange={e => setRvTxt(o => ({ ...o, [p.id]: { ...(o[p.id] || {}), note: e.target.value } }))} /></Field>
                      <Field label="التقدّم %"><input className="inp n" inputMode="numeric" style={{ width: 80 }} value={(rvTxt[p.id] || {}).progress || ''} onChange={e => setRvTxt(o => ({ ...o, [p.id]: { ...(o[p.id] || {}), progress: e.target.value.replace(/\D/g, '') } }))} /></Field>
                      <button className="btn sm gh" onClick={() => addReview(p)}><Plus size={13} />مراجعة</button>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn sm pri" onClick={() => closePip(p, 'passed')}>ناجحة</button>
                        <button className="btn sm gh" onClick={() => closePip(p, 'failed')}>غير ناجحة</button>
                        <button className="btn sm gh" onClick={() => closePip(p, 'closed')}>إغلاق</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {allPips.filter(p => p.branchId === branch.id).length === 0 && <div className="empty">لا خطط بعد.</div>}
            </div>
          </div>
        </div>
      )}

      {view === 'schedule' && canConfig && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 6 }}><Scale size={15} color="var(--brass)" />النوافذ الزمنية (نظام العمل — قابلة للضبط)</div>
            <div className="note" style={{ marginBottom: 8 }}>القيم الافتراضية مبنية على نظام العمل السعودي؛ عدّلوها لتطابق لائحة تنظيم العمل المسجّلة لمنشأتكم لدى وزارة الموارد البشرية — هي المرجع الملزم.</div>
            <div className="grid g3">
              <Field label="محو الجزاء بعد (يوم)"><input className="inp n" inputMode="numeric" value={cf.penaltyEraseDays} onChange={e => setCf(x => ({ ...x, penaltyEraseDays: e.target.value.replace(/\D/g, '') }))} /></Field>
              <Field label="سقف الغرامة الشهري (أيام أجر)"><input className="inp n" inputMode="numeric" value={cf.fineCapDaysPerMonth} onChange={e => setCf(x => ({ ...x, fineCapDaysPerMonth: e.target.value.replace(/\D/g, '') }))} /></Field>
              <Field label="مهلة المؤاخذة من الاكتشاف (يوم)"><input className="inp n" inputMode="numeric" value={cf.chargeWindowDays} onChange={e => setCf(x => ({ ...x, chargeWindowDays: e.target.value.replace(/\D/g, '') }))} /></Field>
              <Field label="مهلة تظلّم الموظف (يوم)"><input className="inp n" inputMode="numeric" value={cf.objectionDays} onChange={e => setCf(x => ({ ...x, objectionDays: e.target.value.replace(/\D/g, '') }))} /></Field>
              <Field label="عتبة اقتراح خطة تحسين الأداء (من 100)"><input className="inp n" inputMode="numeric" value={cf.pipTriggerScore} onChange={e => setCf(x => ({ ...x, pipTriggerScore: e.target.value.replace(/\D/g, '') }))} /></Field>
            </div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 6 }}><Scale size={15} color="var(--brass)" />لائحة المخالفات وسلّم الجزاءات</div>
            <div className="grid" style={{ gap: 10 }}>
              {cf.penaltySchedule.map((s, si) => (
                <div key={si} className="card" style={{ padding: 10, border: '1px solid var(--frame-o)' }}>
                  <div className="row" style={{ gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <Field label="الرمز"><input className="inp" style={{ width: 90 }} value={s.code} onChange={e => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, code: e.target.value } : y) }))} /></Field>
                    <Field label="التصنيف"><input className="inp" style={{ width: 120 }} value={s.category} onChange={e => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, category: e.target.value } : y) }))} /></Field>
                    <Field label="المخالفة" style={{ flex: 2, minWidth: 180 }}><input className="inp" value={s.title} onChange={e => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, title: e.target.value } : y) }))} /></Field>
                    <button className="btn sm gh" onClick={() => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.filter((_, j) => j !== si) }))}><Trash2 size={13} /></button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', margin: '6px 0 4px' }}>سلّم الجزاء بالتكرار (المستوى 1 = أول مرة):</div>
                  <div className="grid" style={{ gap: 4 }}>
                    {(s.ladder || []).map((l, li) => (
                      <div key={li} className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge b-dim">{li + 1}</span>
                        <select className="inp sel" style={{ width: 200 }} value={l.penaltyType} onChange={e => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, ladder: y.ladder.map((z, k) => k === li ? { ...z, penaltyType: e.target.value } : z) } : y) }))}>{PEN_TYPES.map(t => <option key={t.k} value={t.k}>{t.ar}</option>)}</select>
                        {l.penaltyType === 'fine' && <input className="inp n" style={{ width: 90 }} inputMode="decimal" placeholder="أيام أجر" value={l.fineDays} onChange={e => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, ladder: y.ladder.map((z, k) => k === li ? { ...z, fineDays: e.target.value.replace(/[^\d.]/g, '') } : z) } : y) }))} />}
                        <button className="btn sm gh" onClick={() => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, ladder: y.ladder.filter((_, k) => k !== li) } : y) }))}><X size={12} /></button>
                      </div>
                    ))}
                    <div><button className="btn sm gh" onClick={() => setCf(x => ({ ...x, penaltySchedule: x.penaltySchedule.map((y, j) => j === si ? { ...y, ladder: [...(y.ladder || []), { level: (y.ladder || []).length + 1, penaltyType: 'warning', fineDays: 0 }] } : y) }))}><Plus size={12} />درجة</button></div>
                  </div>
                </div>
              ))}
              <div><button className="btn sm gh" onClick={() => setCf(x => ({ ...x, penaltySchedule: [...x.penaltySchedule, { code: '', category: '', title: '', ladder: [{ level: 1, penaltyType: 'verbal', fineDays: 0 }] }] }))}><Plus size={13} />مخالفة</button></div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn pri" onClick={saveConfig}><Check size={14} />حفظ اللائحة</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
