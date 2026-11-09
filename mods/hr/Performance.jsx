/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { TrendingUp, Star, BarChart3, FileText, Settings, Check, Trash2, Printer } from 'lucide-react';
import { Field, ROLES, defaultHrPolicies, hrScoreFor, nowISO, today, uid } from '../../App.jsx';

export function Performance({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canManage = me.role === 'branch_manager' || isAll; // تقييم المدير الشهري
  const canConfig = isAll; // الأوزان وأهداف KPI: أدوار المركز
  const branches = myBranches || [];
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };

  const [view, setView] = useState('scores');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => { if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || ''); }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const ymAdd = (y, n) => { const [Y, M] = y.split('-').map(Number); const d = new Date(Y, M - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const ymLabel = (y) => { const [Y, M] = y.split('-').map(Number); return new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };
  const scoreBadge = (v) => v == null ? 'b-dim' : v >= 85 ? 'b-mint' : v >= 70 ? 'b-amber' : 'b-rose';
  const fmt = (v) => v == null ? '—' : v;

  // === 1) الدرجات الشهرية ===
  const rows = emps.map(e => ({ e, ...hrScoreFor(org, ops, e, ym) }));
  const [wf, setWf] = useState({ scoreWeightsEnabled: !!policies.scoreWeightsEnabled, scoreWeights: { ...(policies.scoreWeights || {}) }, disciplineBase: policies.disciplineBase, disciplinePointValue: policies.disciplinePointValue });
  const saveWeights = async () => {
    const w = wf.scoreWeights || {};
    const sum = (Number(w.attendance) || 0) + (Number(w.quality) || 0) + (Number(w.tasks) || 0) + (Number(w.discipline) || 0);
    if (wf.scoreWeightsEnabled && sum !== 100) return say('مجموع الأوزان يجب أن يساوي 100 (الحالي ' + sum + ')', 'no');
    const patch = { scoreWeightsEnabled: !!wf.scoreWeightsEnabled, scoreWeights: { attendance: Number(w.attendance) || 0, quality: Number(w.quality) || 0, tasks: Number(w.tasks) || 0, discipline: Number(w.discipline) || 0 }, disciplineBase: Number(wf.disciplineBase) || 0, disciplinePointValue: Number(wf.disciplinePointValue) || 0 };
    await commitOrg(d => ({ ...d, hrPolicies: { ...defaultHrPolicies(), ...(d.hrPolicies || {}), ...patch } }),
      { actionType: 'update', targetType: 'settings', targetId: 'hrPolicies', title: 'ضبط أوزان درجة الأداء', details: (patch.scoreWeightsEnabled ? 'مفعَّلة' : 'مُعطَّلة') + ' — حضور ' + patch.scoreWeights.attendance + ' / جودة ' + patch.scoreWeights.quality + ' / مهام ' + patch.scoreWeights.tasks + ' / انضباط ' + patch.scoreWeights.discipline });
    say('حُفظت أوزان الدرجة ✓');
  };
  const [showW, setShowW] = useState(false);

  // === 2) تقييم المدير الشهري ===
  const [rvEmp, setRvEmp] = useState('');
  const existing = (ops.qualityReviews || []).find(r => r.employeeId === rvEmp && r.ym === ym) || null;
  const [rvF, setRvF] = useState({ workQuality: 3, customerService: 3, teamwork: 3, note: '' });
  useEffect(() => { setRvF(existing ? { workQuality: existing.workQuality, customerService: existing.customerService, teamwork: existing.teamwork, note: existing.note || '' } : { workQuality: 3, customerService: 3, teamwork: 3, note: '' }); }, [rvEmp, ym, existing && existing.id]); // eslint-disable-line
  const saveReview = async () => {
    const emp = emps.find(e => e.id === rvEmp);
    if (!emp || !branch) return say('اختر الموظف', 'no');
    const rec = { id: existing ? existing.id : uid('qr'), branchId: branch.id, employeeId: emp.id, employeeName: emp.name, ym, workQuality: Number(rvF.workQuality), customerService: Number(rvF.customerService), teamwork: Number(rvF.teamwork), note: rvF.note || '', reviewedBy: me.id, reviewedByName: me.name, reviewedAt: nowISO() };
    await commit(d => ({ ...d, qualityReviews: existing ? (d.qualityReviews || []).map(r => r.id === rec.id ? rec : r) : [rec, ...(d.qualityReviews || [])] }),
      { actionType: existing ? 'update' : 'create', targetType: 'quality_review', targetId: rec.id, branchName: branch.name, title: 'تقييم المدير الشهري', details: emp.name + ' — ' + ym + ' (' + rec.workQuality + '/' + rec.customerService + '/' + rec.teamwork + ')' });
    say('حُفظ التقييم ✓');
  };
  const monthReviews = (ops.qualityReviews || []).filter(r => r.ym === ym && branch && r.branchId === branch.id);
  // v26.1 — حذف تقييم شهري
  const delReview = async (r) => {
    if (!window.confirm('حذف تقييم «' + r.employeeName + '» لشهر ' + r.ym + '؟ سيُستبعد محور الجودة من درجته.')) return;
    await commit(d => ({ ...d, qualityReviews: (d.qualityReviews || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'quality_review', targetId: r.id, branchName: r.branchName || (branch ? branch.name : ''), title: 'حذف تقييم المدير الشهري', details: r.employeeName + ' — ' + r.ym });
    say('حُذف التقييم');
  };
  const RATE = [1, 2, 3, 4, 5];
  const rateSel = (k, label) => (
    <Field label={label}>
      <select className="inp sel" value={rvF[k]} onChange={e => setRvF(f => ({ ...f, [k]: e.target.value }))}>
        {RATE.map(v => <option key={v} value={v}>{v} — {['ضعيف', 'مقبول', 'جيد', 'جيد جدًا', 'ممتاز'][v - 1]}</option>)}
      </select>
    </Field>
  );

  // === 3) أهداف KPI للفرع مقابل الفعلي ===
  const targetsOf = (bid) => ({ onTimePct: '', taskPct: '', avgScore: '', ...(((org.kpiTargets || {})[bid]) || {}) });
  const [tgF, setTgF] = useState(() => targetsOf(branchId));
  useEffect(() => { setTgF(targetsOf(branchId)); }, [branchId, org.kpiTargets]); // eslint-disable-line
  const saveTargets = async () => {
    if (!branch) return;
    const rec = { onTimePct: Number(tgF.onTimePct) || 0, taskPct: Number(tgF.taskPct) || 0, avgScore: Number(tgF.avgScore) || 0 };
    await commitOrg(d => ({ ...d, kpiTargets: { ...(d.kpiTargets || {}), [branch.id]: rec } }),
      { actionType: 'update', targetType: 'settings', targetId: 'kpiTargets:' + branch.id, branchName: branch.name, title: 'ضبط أهداف KPI للفرع', details: branch.name + ' — حضور ' + rec.onTimePct + '% / مهام ' + rec.taskPct + '% / درجة ' + rec.avgScore });
    say('حُفظت أهداف الفرع ✓');
  };
  const branchActual = (() => {
    let on = 0, tot = 0, te = 0, tdn = 0; const scores = [];
    rows.forEach(r => { on += r.st.onTime; tot += r.st.onTime + r.st.late + r.st.absent; te += r.st.tasksExpected; tdn += r.st.tasksDone; if (r.score != null) scores.push(r.score); });
    return { onTimePct: tot ? Math.round(on / tot * 100) : null, taskPct: te ? Math.round(tdn / te * 100) : null, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
  })();
  const tg = targetsOf(branchId);
  const kpiRows = [
    { k: 'onTimePct', ar: 'نسبة الحضور في الوقت', unit: '%' },
    { k: 'taskPct', ar: 'نسبة إنجاز المهام', unit: '%' },
    { k: 'avgScore', ar: 'متوسط درجة الأداء', unit: '' },
  ];

  // === 4) بطاقة أداء الموظف (6 أشهر + اتجاه) ===
  const [cardEmp, setCardEmp] = useState('');
  const cEmp = emps.find(e => e.id === cardEmp) || null;
  const months6 = [5, 4, 3, 2, 1, 0].map(n => ymAdd(ym, -n));
  const cardRows = cEmp ? months6.map(m => ({ m, ...hrScoreFor(org, ops, cEmp, m) })) : [];
  const withScore = cardRows.filter(r => r.score != null);
  const trend = withScore.length >= 2 ? withScore[withScore.length - 1].score - withScore[withScore.length - 2].score : null;

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'scores' ? ' pri' : ' gh')} onClick={() => setView('scores')}><TrendingUp size={13} />درجات الأداء</button>
            <button className={'btn sm' + (view === 'review' ? ' pri' : ' gh')} onClick={() => setView('review')}><Star size={13} />تقييم المدير</button>
            <button className={'btn sm' + (view === 'targets' ? ' pri' : ' gh')} onClick={() => setView('targets')}><BarChart3 size={13} />أهداف KPI</button>
            <button className={'btn sm' + (view === 'card' ? ' pri' : ' gh')} onClick={() => setView('card')}><FileText size={13} />بطاقة الموظف</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input type="month" className="inp" value={ym} onChange={e => setYm(e.target.value)} />
            {branches.length > 1 && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {view === 'scores' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-h" style={{ marginBottom: 6 }}>
              <div className="card-t"><Settings size={15} color="var(--brass)" />أوزان الدرجة النهائية {policies.scoreWeightsEnabled ? <span className="badge b-mint">مخصّصة</span> : <span className="badge b-dim">الافتراضية المتساوية (مُعطَّلة)</span>}</div>
              {canConfig && <button className="btn sm gh" onClick={() => setShowW(v => !v)}>{showW ? 'إخفاء' : 'ضبط الأوزان'}</button>}
            </div>
            <div style={{ fontSize: 12 }}>حضور {fmt(rows[0]?.weights.attendance ?? policies.scoreWeights.attendance)} · جودة {fmt(policies.scoreWeightsEnabled ? policies.scoreWeights.quality : 25)} · مهام {fmt(policies.scoreWeightsEnabled ? policies.scoreWeights.tasks : 25)} · انضباط {fmt(policies.scoreWeightsEnabled ? policies.scoreWeights.discipline : 25)} — المحاور غير المتاحة لموظف (بلا جدولة/مهام/تقييم) تُستبعد ويُعاد توزيع الوزن على الباقي.</div>
            {showW && canConfig && (
              <div style={{ marginTop: 10 }}>
                <label className="row" style={{ gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!wf.scoreWeightsEnabled} onChange={e => setWf(f => ({ ...f, scoreWeightsEnabled: e.target.checked }))} />
                  <b>تفعيل الأوزان المخصّصة</b> (يجب أن يكون مجموعها 100)
                </label>
                <div className="grid g3">
                  {[['attendance', 'الحضور'], ['quality', 'الجودة (تقييم المدير)'], ['tasks', 'المهام'], ['discipline', 'الانضباط (النقاط)']].map(([k, l]) => (
                    <Field key={k} label={l}><input className="inp n" inputMode="numeric" value={wf.scoreWeights[k] ?? ''} onChange={e => setWf(f => ({ ...f, scoreWeights: { ...f.scoreWeights, [k]: e.target.value.replace(/\D/g, '') } }))} /></Field>
                  ))}
                  <Field label="قاعدة محور الانضباط (0–100)"><input className="inp n" inputMode="numeric" value={wf.disciplineBase ?? ''} onChange={e => setWf(f => ({ ...f, disciplineBase: e.target.value.replace(/\D/g, '') }))} /></Field>
                  <Field label="قيمة النقطة الواحدة في محور الانضباط"><input className="inp n" inputMode="numeric" value={wf.disciplinePointValue ?? ''} onChange={e => setWf(f => ({ ...f, disciplinePointValue: e.target.value.replace(/\D/g, '') }))} /></Field>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}><button className="btn pri" onClick={saveWeights}><Check size={14} />حفظ الأوزان</button></div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><TrendingUp size={15} color="var(--brass)" />درجات الأداء — {branch.name} — {ymLabel(ym)}</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>الحضور</th><th>المهام</th><th>الانضباط</th><th>الجودة</th><th>الدرجة</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.e.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.e.name}</td>
                      <td className="num" title={r.st.onTime + ' في الوقت / ' + r.st.late + ' تأخير / ' + r.st.absent + ' غياب'}>{fmt(r.axes.attendance)}</td>
                      <td className="num" title={r.st.tasksDone + ' من ' + r.st.tasksExpected}>{fmt(r.axes.tasks)}</td>
                      <td className="num" title={'صافي النقاط ' + (r.st.manualPts + r.st.autoPts)}>{fmt(r.axes.discipline)}</td>
                      <td className="num">{fmt(r.axes.quality)}{!r.review && canManage ? <span style={{ fontSize: 10.5, color: 'var(--muted)', marginInlineStart: 4 }}>(بلا تقييم)</span> : null}</td>
                      <td><span className={'badge ' + scoreBadge(r.score)} style={{ fontWeight: 700 }}>{r.score == null ? '—' : r.score + ' / 100'}</span></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={6}><div className="empty">لا يوجد موظفون نشطون لهذا الفرع.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'review' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canManage && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Star size={15} color="var(--brass)" />تقييم المدير الشهري — {ymLabel(ym)}</div>
              <div className="grid g2">
                <Field label="الموظف"><select className="inp sel" value={rvEmp} onChange={e => setRvEmp(e.target.value)}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                {rvEmp && existing && <div className="note" style={{ alignSelf: 'end' }}>يوجد تقييم محفوظ لهذا الشهر (بواسطة {existing.reviewedByName}) — الحفظ يُحدِّثه.</div>}
              </div>
              {rvEmp && (<>
                <div className="grid g3" style={{ marginTop: 8 }}>
                  {rateSel('workQuality', 'جودة العمل')}
                  {rateSel('customerService', 'التعامل مع العملاء')}
                  {rateSel('teamwork', 'العمل الجماعي')}
                </div>
                <Field label="ملاحظات (اختياري)" style={{ marginTop: 8 }}><input className="inp" value={rvF.note} onChange={e => setRvF(f => ({ ...f, note: e.target.value }))} /></Field>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn pri" onClick={saveReview}><Check size={14} />حفظ التقييم</button></div>
              </>)}
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>تقييمات {ymLabel(ym)} — {branch.name}</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>جودة العمل</th><th>العملاء</th><th>الجماعي</th><th>المتوسط</th><th>ملاحظة</th><th>بواسطة</th>{canManage && <th />}</tr></thead>
                <tbody>
                  {monthReviews.map(r => { const avg = ((Number(r.workQuality) + Number(r.customerService) + Number(r.teamwork)) / 3); return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.employeeName}</td>
                      <td className="num">{r.workQuality}</td><td className="num">{r.customerService}</td><td className="num">{r.teamwork}</td>
                      <td><span className={'badge ' + (avg >= 4 ? 'b-mint' : avg >= 3 ? 'b-amber' : 'b-rose')}>{avg.toFixed(1)}</span></td>
                      <td style={{ fontSize: 12 }}>{r.note || '—'}</td>
                      <td style={{ fontSize: 11.5 }}>{r.reviewedByName}</td>
                      {canManage && <td><div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}><button className="btn sm gh" onClick={() => setRvEmp(r.employeeId)}>تعديل</button><button className="btn sm gh" onClick={() => delReview(r)}><Trash2 size={13} /></button></div></td>}
                    </tr>
                  ); })}
                  {monthReviews.length === 0 && <tr><td colSpan={canManage ? 8 : 7}><div className="empty">لا توجد تقييمات لهذا الشهر بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'targets' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canConfig && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Settings size={15} color="var(--brass)" />أهداف KPI — {branch.name}</div>
              <div className="grid g3">
                <Field label="نسبة الحضور في الوقت المستهدفة (%)"><input className="inp n" inputMode="numeric" value={tgF.onTimePct} onChange={e => setTgF(f => ({ ...f, onTimePct: e.target.value.replace(/\D/g, '') }))} /></Field>
                <Field label="نسبة إنجاز المهام المستهدفة (%)"><input className="inp n" inputMode="numeric" value={tgF.taskPct} onChange={e => setTgF(f => ({ ...f, taskPct: e.target.value.replace(/\D/g, '') }))} /></Field>
                <Field label="متوسط درجة الأداء المستهدف (من 100)"><input className="inp n" inputMode="numeric" value={tgF.avgScore} onChange={e => setTgF(f => ({ ...f, avgScore: e.target.value.replace(/\D/g, '') }))} /></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn pri" onClick={saveTargets}><Check size={14} />حفظ الأهداف</button></div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><BarChart3 size={15} color="var(--brass)" />الفعلي مقابل المستهدف — {branch.name} — {ymLabel(ym)}</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>المؤشر</th><th>المستهدف</th><th>الفعلي</th><th>الحالة</th></tr></thead>
                <tbody>
                  {kpiRows.map(k => { const t = Number(tg[k.k]) || 0; const a = branchActual[k.k]; const ok = a != null && t > 0 ? a >= t : null; return (
                    <tr key={k.k}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{k.ar}</td>
                      <td className="num">{t > 0 ? t + k.unit : '—'}</td>
                      <td className="num">{a == null ? '—' : a + k.unit}</td>
                      <td><span className={'badge ' + (ok == null ? 'b-dim' : ok ? 'b-mint' : 'b-rose')}>{ok == null ? (t > 0 ? 'لا بيانات' : 'بلا هدف') : ok ? 'محقَّق ✓' : 'دون الهدف'}</span></td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'card' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="row" style={{ gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Field label="الموظف" style={{ minWidth: 220 }}><select className="inp sel" value={cardEmp} onChange={e => setCardEmp(e.target.value)}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
              {cEmp && <button className="btn sm gh" style={{ alignSelf: 'end' }} onClick={() => window.print()}><Printer size={13} />طباعة البطاقة</button>}
            </div>
          </div>
          {cEmp && (
            <div className="card">
              <div className="card-h" style={{ marginBottom: 8 }}>
                <div className="card-t"><FileText size={15} color="var(--brass)" />بطاقة أداء — {cEmp.name} — {branch.name}</div>
                {trend != null && <span className={'badge ' + (trend > 0 ? 'b-mint' : trend < 0 ? 'b-rose' : 'b-dim')}>{trend > 0 ? '▲ تحسّن +' + trend : trend < 0 ? '▼ تراجع ' + trend : '— ثابت'}</span>}
              </div>
              <div className="tw">
                <table className="tb">
                  <thead><tr><th>الشهر</th><th>الحضور</th><th>المهام</th><th>الانضباط</th><th>الجودة</th><th>الدرجة</th></tr></thead>
                  <tbody>
                    {cardRows.map(r => (
                      <tr key={r.m}>
                        <td style={{ fontSize: 12.5 }}>{ymLabel(r.m)}</td>
                        <td className="num">{fmt(r.axes.attendance)}</td>
                        <td className="num">{fmt(r.axes.tasks)}</td>
                        <td className="num">{fmt(r.axes.discipline)}</td>
                        <td className="num">{fmt(r.axes.quality)}</td>
                        <td><span className={'badge ' + scoreBadge(r.score)} style={{ fontWeight: 700 }}>{r.score == null ? '—' : r.score}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cardRows.some(r => r.review && r.review.note) && (
                <div style={{ marginTop: 10 }}>
                  <div className="card-t" style={{ fontSize: 12.5, marginBottom: 4 }}>ملاحظات المدير</div>
                  {cardRows.filter(r => r.review && r.review.note).map(r => <div key={r.m} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--line)' }}><b>{ymLabel(r.m)}:</b> {r.review.note} <span style={{ color: 'var(--muted)' }}>— {r.review.reviewedByName}</span></div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
