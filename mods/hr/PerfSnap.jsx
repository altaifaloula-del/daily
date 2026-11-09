/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Lock, AlertTriangle, Download, X } from 'lucide-react';
import { ROLES, defaultHrPolicies, frozenSnapshotFor, hrScoreFor, makeXlsx, nowISO, today, uid } from '../../App.jsx';

export function PerfSnap({ org, ops, me, myBranches, commit, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canFreeze = isAll;                 // التجميد: أدوار المركز
  const canUnlock = !!role.admin;          // فكّ التجميد: مسؤول النظام/الإدارة العليا فقط
  const td = today();
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const ymLabel = (y) => { const [Y, M] = String(y).split('-').map(Number); return isNaN(Y) ? y : new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };
  const bName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
  const snaps = ((ops.hrScoreSnapshots || [])).slice().sort((a, b) => (a.ym < b.ym ? 1 : -1));
  const frozen = frozenSnapshotFor(ops, ym);
  const activeEmps = () => (org.employees || []).filter(e => e.isActive !== false);

  const freeze = async () => {
    if (!canFreeze) return;
    if (!/^\d{4}-\d{2}$/.test(ym)) return say('اختر شهرًا صحيحًا', 'no');
    if (ym > td.slice(0, 7)) return say('لا يمكن تجميد شهر لم ينتهِ بعد', 'no');
    if (frozenSnapshotFor(ops, ym)) return say('هذا الشهر مجمّد بالفعل — فكّ التجميد أولًا لإعادته', 'no');
    const pol = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
    const rows = activeEmps().map(e => {
      const sc = hrScoreFor(org, ops, e, ym);
      return {
        employeeId: e.id, employeeName: e.name, branchId: e.branchId || '', branchName: bName(e.branchId), jobTitle: e.jobTitle || '',
        score: sc.score, axes: sc.axes,
        st: { scheduled: sc.st.scheduled, onTime: sc.st.onTime, late: sc.st.late, absent: sc.st.absent, tasksExpected: sc.st.tasksExpected, tasksDone: sc.st.tasksDone, manualPts: sc.st.manualPts, autoPts: sc.st.autoPts }
      };
    });
    const rec = {
      id: uid('snap'), ym, createdAt: nowISO(), createdBy: me.id, createdByName: me.name, locked: true,
      meta: { weightsEnabled: !!pol.scoreWeightsEnabled, roleKpiEnabled: !!pol.roleKpiEnabled, roleKpiWeight: Number(pol.roleKpiWeight) || 0, weights: pol.scoreWeightsEnabled ? pol.scoreWeights : defaultHrPolicies().scoreWeights },
      rows
    };
    const ok = await commit(d => ({ ...d, hrScoreSnapshots: [rec, ...(d.hrScoreSnapshots || []).filter(s => !(s.ym === ym && s.locked))] }),
      { actionType: 'create', targetType: 'score_snapshot', targetId: rec.id, title: 'تجميد الأداء الشهري', details: ymLabel(ym) + ' · ' + rows.length + ' موظف · ' + rows.filter(r => r.score != null).length + ' بدرجة' });
    if (ok) say('جُمِّد أداء ' + ymLabel(ym) + ' ✓ — صار سجلًّا ثابتًا لا يُعاد حسابه');
  };
  const unlock = async (snap) => {
    if (!canUnlock) return say('فكّ التجميد لمسؤول النظام فقط', 'no');
    if (!window.confirm('فكّ تجميد ' + ymLabel(snap.ym) + '؟ سيعود الأداء للحساب الحيّ ويُفقد السجل الثابت لهذا الشهر (يُوثَّق في التدقيق).')) return;
    const ok = await commit(d => ({ ...d, hrScoreSnapshots: (d.hrScoreSnapshots || []).filter(s => s.id !== snap.id) }),
      { actionType: 'delete', targetType: 'score_snapshot', targetId: snap.id, title: 'فكّ تجميد الأداء الشهري', details: ymLabel(snap.ym) + ' · بواسطة ' + me.name });
    if (ok) say('فُكّ تجميد ' + ymLabel(snap.ym));
  };

  // مقارنة الحيّ بالمجمّد لكشف تغيّر رجعي
  const driftRows = frozen ? frozen.rows.map(r => {
    const emp = (org.employees || []).find(e => e.id === r.employeeId) || { id: r.employeeId, name: r.employeeName, branchId: r.branchId };
    const live = hrScoreFor(org, ops, emp, frozen.ym).score;
    return { ...r, live, drift: (r.score != null || live != null) && r.score !== live };
  }) : [];
  const driftN = driftRows.filter(r => r.drift).length;

  const AX = [['attendance', 'حضور'], ['tasks', 'مهام'], ['quality', 'جودة'], ['discipline', 'انضباط'], ['roleKpi', 'مؤشرات الدور']];
  const scoreBadge = (v) => v == null ? <span className="badge b-dim">—</span> : <span className={'badge ' + (v >= 85 ? 'b-mint' : v >= 70 ? 'b-amber' : 'b-rose')}>{v}</span>;

  const download = () => {
    if (!frozen) return;
    const head = ['الموظف', 'الفرع', 'المسمى', 'الدرجة المجمّدة', 'الدرجة الحيّة الآن', 'تغيّر', ...AX.map(a => a[1])];
    const lines = driftRows.map(r => [r.employeeName, r.branchName, r.jobTitle, r.score == null ? '' : r.score, r.live == null ? '' : r.live, r.drift ? 'نعم' : 'لا', ...AX.map(a => r.axes && r.axes[a[0]] != null ? r.axes[a[0]] : '')]);
    try { const blob = makeXlsx([{ name: 'أداء ' + frozen.ym, rows: [head, ...lines] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'لقطة_الأداء_' + frozen.ym + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل ملف Excel ✓'); } catch { say('تعذّر التصدير', 'no'); }
  };

  if (!isAll) return <div className="card"><div className="empty">تجميد الأداء الشهري متاح لأدوار المركز فقط.</div></div>;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="card-t"><Lock size={15} color="var(--brass)" />تجميد الأداء الشهري</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input type="month" className="inp" value={ym} onChange={e => setYm(e.target.value)} />
            {!frozen && canFreeze && <button className="btn pri" onClick={freeze}><Lock size={14} />جمّد أداء {ymLabel(ym)}</button>}
            {frozen && <span className="badge b-mint"><Lock size={11} />مجمّد {frozen.createdAt ? ('· ' + (frozen.createdAt || '').slice(0, 10)) : ''}</span>}
          </div>
        </div>
        <div className="note">التجميد يخزّن درجة كل موظف ومكوّناتها لحظته سجلًّا ثابتًا لا يُعاد حسابه — يُنفَّذ بعد اعتماد الشهر (مع قفل الرواتب). أي تغيّر لاحق في بيانات الشهر يُكشف هنا بمقارنة «الحيّ» بـ«المجمّد».</div>
      </div>

      {frozen ? (
        <div className="card">
          <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="card-t">لقطة {ymLabel(frozen.ym)} — {frozen.rows.length} موظف {driftN > 0 ? <span className="badge b-rose" style={{ marginInlineStart: 6 }}><AlertTriangle size={11} />{driftN} تغيّرت بياناتهم بعد التجميد</span> : <span className="badge b-mint" style={{ marginInlineStart: 6 }}>لا انحراف</span>}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm gh" onClick={download}><Download size={13} />Excel</button>
              {canUnlock && <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => unlock(frozen)}><X size={13} />فكّ التجميد</button>}
            </div>
          </div>
          <div className="note" style={{ marginBottom: 8 }}>
            عند التجميد: {frozen.meta && frozen.meta.weightsEnabled ? 'أوزان مخصّصة' : 'أوزان متساوية'}{frozen.meta && frozen.meta.roleKpiEnabled ? ' · محور مؤشرات الدور مفعّل (وزن ' + frozen.meta.roleKpiWeight + ')' : ' · محور مؤشرات الدور غير مفعّل'}. «الدرجة الحيّة الآن» تُحسب من البيانات الحالية — اختلافها عن المجمّدة يعني تغيّر بيانات الشهر بعد اعتماده.
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th><th>الفرع</th><th>الدرجة المجمّدة</th><th>الحيّة الآن</th>{AX.map(a => <th key={a[0]}>{a[1]}</th>)}</tr></thead>
              <tbody>
                {driftRows.map(r => (
                  <tr key={r.employeeId} style={r.drift ? { background: 'rgba(217,84,77,.07)' } : undefined}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.employeeName}<div style={{ fontSize: 10, color: 'var(--faint)' }}>{r.jobTitle}</div></td>
                    <td style={{ fontSize: 11.5 }}>{r.branchName}</td>
                    <td>{scoreBadge(r.score)}</td>
                    <td>{r.drift ? <span className="row" style={{ gap: 4 }}>{scoreBadge(r.live)}<AlertTriangle size={12} color="var(--rose)" /></span> : scoreBadge(r.live)}</td>
                    {AX.map(a => <td key={a[0]} className="num" style={{ fontSize: 11.5 }}>{r.axes && r.axes[a[0]] != null ? r.axes[a[0]] : '—'}</td>)}
                  </tr>
                ))}
                {frozen.rows.length === 0 && <tr><td colSpan={4 + AX.length}><div className="empty">لا موظفين في اللقطة.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card"><div className="empty">{ymLabel(ym)} غير مجمّد. الدرجات لهذا الشهر تُحسب حيًّا وتتغيّر بتغيّر بياناته — جمّده بعد اعتماده لتثبيته.</div></div>
      )}

      {snaps.length > 0 && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}>الشهور المجمّدة</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الشهر</th><th>موظفون</th><th>تاريخ التجميد</th><th>بواسطة</th><th /></tr></thead>
              <tbody>
                {snaps.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{ymLabel(s.ym)}</td>
                    <td className="num">{(s.rows || []).length}</td>
                    <td style={{ fontSize: 11.5 }}>{(s.createdAt || '').slice(0, 10)}</td>
                    <td style={{ fontSize: 11.5 }}>{s.createdByName || '—'}</td>
                    <td><div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}><button className="btn sm gh" onClick={() => setYm(s.ym)}>عرض</button>{canUnlock && <button className="btn sm gh" style={{ color: 'var(--rose)' }} onClick={() => unlock(s)}><X size={12} /></button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
