/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { FileBarChart, Printer, Download, LayoutDashboard, Fingerprint, Coins, CheckCircle2, TrendingUp, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Kpi, chartTone, hrAttendanceDetail, hrEmpStats, hrScoreFor, makeXlsx, money, printA4, today } from '../../App.jsx';

export function HrDashboard({ org, ops, me, myBranches, say, setTab }) {
  const branches = (myBranches || []).filter(b => b.isActive !== false);
  const [view, setView] = useState('dash');
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const [branchId, setBranchId] = useState('');
  const ymAdd = (y, n) => { const [Y, M] = y.split('-').map(Number); const d = new Date(Y, M - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const ymLabel = (y) => { const [Y, M] = String(y).split('-').map(Number); return isNaN(Y) ? y : new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };
  const from = ym + '-01', to = ym + '-31';
  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  const fmtP = (v) => v == null ? '—' : v + '%';
  const empsOf = (bId) => (org.employees || []).filter(e => e.isActive !== false && e.branchId === bId);
  const bName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';

  // === 1) اللوحة التنفيذية — تجميع لكل فرع (والشركة) لشهر، مع الشهر السابق ===
  const aggBranch = (bId, y) => {
    const f = y + '-01', t = y + '-31';
    const emps = empsOf(bId);
    const agg = { emps: emps.length, scheduled: 0, onTime: 0, late: 0, absent: 0, lateMinutes: 0, tasksExpected: 0, tasksDone: 0, scores: [], rewards: 0, penalties: 0, points: 0 };
    emps.forEach(e => {
      const d = hrAttendanceDetail(org, ops, e, f, t);
      agg.scheduled += d.scheduled; agg.onTime += d.onTime; agg.late += d.late; agg.absent += d.absent; agg.lateMinutes += d.lateMinutes;
      const st = hrEmpStats(org, ops, e, f, t);
      agg.tasksExpected += st.tasksExpected; agg.tasksDone += st.tasksDone; agg.points += st.manualPts + st.autoPts;
      const sc = hrScoreFor(org, ops, e, y); if (sc.score != null) agg.scores.push(sc.score);
    });
    (ops.rewardRequests || []).filter(r => r.branchId === bId && r.month === y && r.status === 'approved').forEach(r => { if (r.kind === 'reward') agg.rewards += Number(r.amount) || 0; else agg.penalties += Number(r.amount) || 0; });
    return { ...agg, onTimePct: pct(agg.onTime, agg.scheduled), taskPct: pct(agg.tasksDone, agg.tasksExpected), avgScore: agg.scores.length ? Math.round(agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length) : null };
  };
  const sumAgg = (list) => {
    const t = { emps: 0, scheduled: 0, onTime: 0, late: 0, absent: 0, lateMinutes: 0, tasksExpected: 0, tasksDone: 0, scores: [], rewards: 0, penalties: 0, points: 0 };
    list.forEach(a => { ['emps', 'scheduled', 'onTime', 'late', 'absent', 'lateMinutes', 'tasksExpected', 'tasksDone', 'rewards', 'penalties', 'points'].forEach(k => { t[k] += a[k]; }); t.scores = t.scores.concat(a.scores); });
    return { ...t, onTimePct: pct(t.onTime, t.scheduled), taskPct: pct(t.tasksDone, t.tasksExpected), avgScore: t.scores.length ? Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length) : null };
  };
  const rowsNow = branches.map(b => ({ b, ...aggBranch(b.id, ym) }));
  const rowsPrev = branches.map(b => ({ b, ...aggBranch(b.id, ymAdd(ym, -1)) }));
  const totNow = sumAgg(rowsNow), totPrev = sumAgg(rowsPrev);
  const delta = (a, b) => (a == null || b == null) ? null : a - b;
  const DeltaBadge = ({ d, unit, invert }) => d == null || d === 0 ? <span className="badge b-dim">—</span> : <span className={'badge ' + ((invert ? d < 0 : d > 0) ? 'b-mint' : 'b-rose')}>{d > 0 ? '▲ +' : '▼ '}{d}{unit || ''}</span>;
  const tone = chartTone();
  const chartData = rowsNow.map(r => ({ name: r.b.name, 'حضور في الوقت %': r.onTimePct || 0, 'إنجاز المهام %': r.taskPct || 0, 'متوسط الدرجة': r.avgScore || 0 }));

  // === 2) تقرير الحضور الشهري التفصيلي ===
  const repBranches = branchId ? branches.filter(b => b.id === branchId) : branches;
  const attRows = repBranches.flatMap(b => empsOf(b.id).map(e => ({ e, b, ...hrAttendanceDetail(org, ops, e, from, to) })));
  // v27.4 — أعمدة «الحضور الفعلي» (بلا اعتماد على الجدولة) أولًا، ثم أعمدة الالتزام بالوردية المجدولة
  const hoursOf = (m) => m > 0 ? Math.round(m / 6) / 10 : 0;   // دقائق ⇒ ساعات بمنزلة عشرية
  const attHead = ['الموظف', 'الفرع', 'أيام حضور فعلي', 'ساعات فعلية', 'دخول بلا انصراف', 'أيام مجدولة', 'حضور مقابل الوردية', 'في الوقت', 'تأخير (مرات)', 'دقائق التأخير', 'غياب', 'انصراف مبكر (مرات)', 'دقائق مبكرة', 'بلا انصراف (مجدول)', 'نسبة الحضور في الوقت %'];
  const attLine = (r) => [r.e.name, r.b.name, r.actualDays, hoursOf(r.workedMinutes), r.openDays, r.scheduled, r.present, r.onTime, r.late, r.lateMinutes, r.absent, r.early, r.earlyMinutes, r.noCheckout, pct(r.onTime, r.scheduled) == null ? '' : pct(r.onTime, r.scheduled)];
  // === 3) تقرير المكافآت والجزاءات والنقاط ===
  const rwRows = repBranches.flatMap(b => empsOf(b.id).map(e => {
    const reqs = (ops.rewardRequests || []).filter(r => r.employeeId === e.id && r.month === ym);
    const st = hrEmpStats(org, ops, e, from, to);
    return { e, b, rewards: reqs.filter(r => r.kind === 'reward' && r.status === 'approved').reduce((a, r) => a + Number(r.amount || 0), 0), penalties: reqs.filter(r => r.kind === 'penalty' && r.status === 'approved').reduce((a, r) => a + Number(r.amount || 0), 0), pending: reqs.filter(r => r.status === 'pending').length, rejected: reqs.filter(r => r.status === 'rejected').length, points: st.manualPts + st.autoPts, score: hrScoreFor(org, ops, e, ym).score };
  }));
  const rwHead = ['الموظف', 'الفرع', 'مكافآت معتمدة', 'جزاءات معتمدة', 'الصافي', 'طلبات معلّقة', 'مرفوضة', 'صافي النقاط', 'درجة الأداء'];
  const rwLine = (r) => [r.e.name, r.b.name, r.rewards, r.penalties, r.rewards - r.penalties, r.pending, r.rejected, r.points, r.score == null ? '' : r.score];

  const download = (name, head, lines) => {
    try {
      const blob = makeXlsx([{ name: name.slice(0, 28), rows: [head, ...lines] }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name + '_' + ym + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
      say('نُزّل ملف Excel ✓');
    } catch (e) { say('تعذّر توليد ملف Excel', 'no'); }
  };
  const printTable = (title, head, lines) => {
    const html = '<table><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + lines.map(l => '<tr>' + l.map((c, i) => '<td' + (i > 1 ? ' class="n"' : '') + '>' + (c === '' ? '—' : c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    printA4(org, title + ' — ' + ymLabel(ym), (branchId ? bName(branchId) : 'كل الفروع') + ' · ' + lines.length + ' موظف', html) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  if (!branches.length) return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;

  const ToolBar = ({ title, head, lines, fileName }) => (
    <div className="card-h" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
      <div className="card-t"><FileBarChart size={15} color="var(--brass)" />{title} — {ymLabel(ym)}</div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sm gh" onClick={() => printTable(title, head, lines)}><Printer size={13} />طباعة</button>
        <button className="btn sm gh" onClick={() => download(fileName, head, lines)}><Download size={13} />Excel</button>
      </div>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'dash' ? ' pri' : ' gh')} onClick={() => setView('dash')}><LayoutDashboard size={13} />اللوحة التنفيذية</button>
            <button className={'btn sm' + (view === 'attendance' ? ' pri' : ' gh')} onClick={() => setView('attendance')}><Fingerprint size={13} />تقرير الحضور</button>
            <button className={'btn sm' + (view === 'rewards' ? ' pri' : ' gh')} onClick={() => setView('rewards')}><Coins size={13} />المكافآت والنقاط</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input type="month" className="inp" value={ym} onChange={e => setYm(e.target.value)} />
            {view !== 'dash' && branches.length > 1 && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="">كل الفروع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {view === 'dash' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid g4">
            <Kpi label="الحضور في الوقت" value={fmtP(totNow.onTimePct)} sub={totNow.scheduled + ' يوم مجدول · ' + totNow.late + ' تأخير · ' + totNow.absent + ' غياب'} icon={Fingerprint} color={tone.pos} />
            <Kpi label="إنجاز المهام" value={fmtP(totNow.taskPct)} sub={totNow.tasksDone + ' من ' + totNow.tasksExpected} icon={CheckCircle2} color={tone.info} />
            <Kpi label="متوسط درجة الأداء" value={totNow.avgScore == null ? '—' : String(totNow.avgScore)} sub={totNow.scores.length + ' موظف بدرجة'} icon={TrendingUp} color={tone.accent} />
            <Kpi label="مكافآت − جزاءات معتمدة" value={money(totNow.rewards - totNow.penalties)} sub={money(totNow.rewards) + ' مكافآت · ' + money(totNow.penalties) + ' جزاءات'} icon={Coins} color={tone.warn} />
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><LayoutDashboard size={15} color="var(--brass)" />مقارنة الفروع — {ymLabel(ym)} (مقابل {ymLabel(ymAdd(ym, -1))})</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الفرع</th><th>موظفون</th><th>حضور في الوقت</th><th>تغيّر</th><th>تأخير</th><th>غياب</th><th>إنجاز المهام</th><th>تغيّر</th><th>متوسط الدرجة</th><th>تغيّر</th><th>مكافآت</th><th>جزاءات</th><th>صافي النقاط</th></tr></thead>
                <tbody>
                  {rowsNow.map((r, i) => { const p = rowsPrev[i]; return (
                    <tr key={r.b.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.b.name}</td>
                      <td className="num">{r.emps}</td>
                      <td className="num">{fmtP(r.onTimePct)}</td><td><DeltaBadge d={delta(r.onTimePct, p.onTimePct)} unit="%" /></td>
                      <td className="num">{r.late}</td><td className="num">{r.absent}</td>
                      <td className="num">{fmtP(r.taskPct)}</td><td><DeltaBadge d={delta(r.taskPct, p.taskPct)} unit="%" /></td>
                      <td className="num">{r.avgScore == null ? '—' : r.avgScore}</td><td><DeltaBadge d={delta(r.avgScore, p.avgScore)} /></td>
                      <td className="num">{money(r.rewards)}</td><td className="num">{money(r.penalties)}</td>
                      <td className="num">{r.points > 0 ? '+' : ''}{r.points}</td>
                    </tr>
                  ); })}
                  <tr className="tot"><td style={{ fontWeight: 700 }}>الشركة</td><td className="num">{totNow.emps}</td><td className="num">{fmtP(totNow.onTimePct)}</td><td><DeltaBadge d={delta(totNow.onTimePct, totPrev.onTimePct)} unit="%" /></td><td className="num">{totNow.late}</td><td className="num">{totNow.absent}</td><td className="num">{fmtP(totNow.taskPct)}</td><td><DeltaBadge d={delta(totNow.taskPct, totPrev.taskPct)} unit="%" /></td><td className="num">{totNow.avgScore == null ? '—' : totNow.avgScore}</td><td><DeltaBadge d={delta(totNow.avgScore, totPrev.avgScore)} /></td><td className="num">{money(totNow.rewards)}</td><td className="num">{money(totNow.penalties)}</td><td className="num">{totNow.points > 0 ? '+' : ''}{totNow.points}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          {branches.length > 0 && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><BarChart3 size={15} color="var(--brass)" />مؤشرات الفروع</div>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke={tone.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fill: tone.tick, fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: tone.tick, fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: tone.tip, color: tone.tipTxt, border: 'none', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="حضور في الوقت %" fill={tone.pos} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="إنجاز المهام %" fill={tone.info} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="متوسط الدرجة" fill={tone.accent} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'attendance' && (
        <div className="card">
          <ToolBar title="تقرير الحضور الشهري" head={attHead} lines={attRows.map(attLine)} fileName="تقرير_الحضور" />
          <div className="note" style={{ marginBottom: 8 }}>الأعمدة الأولى «الحضور الفعلي» (أيام الحضور والساعات) تُحسب من البصمات مباشرة وتعمل بلا ورديات. أعمدة «مقابل الوردية» (حضور/تأخير/غياب/نسبة) لا تُحسب إلا لموظف له ورديات مُعيَّنة في «محرّك الورديات» — تبقى صفرًا لمن لا وردية له.</div>
          <div className="tw">
            <table className="tb">
              <thead><tr>{attHead.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {attRows.map(r => { const l = attLine(r); return <tr key={r.e.id}>{l.map((c, i) => <td key={i} className={i > 1 ? 'num' : ''} style={i === 0 ? { fontWeight: 600, fontSize: 12.5 } : {}}>{c === '' ? '—' : c}</td>)}</tr>; })}
                {attRows.length === 0 && <tr><td colSpan={attHead.length}><div className="empty">لا يوجد موظفون نشطون.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'rewards' && (
        <div className="card">
          <ToolBar title="تقرير المكافآت والجزاءات والنقاط" head={rwHead} lines={rwRows.map(rwLine)} fileName="تقرير_المكافآت" />
          <div className="tw">
            <table className="tb">
              <thead><tr>{rwHead.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {rwRows.map(r => { const l = rwLine(r); return <tr key={r.e.id}>{l.map((c, i) => <td key={i} className={i > 1 ? 'num' : ''} style={i === 0 ? { fontWeight: 600, fontSize: 12.5 } : {}}>{c === '' ? '—' : c}</td>)}</tr>; })}
                {rwRows.length === 0 && <tr><td colSpan={rwHead.length}><div className="empty">لا يوجد موظفون نشطون.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
