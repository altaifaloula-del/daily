/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Printer, TrendingUp, Fingerprint, CalendarDays, Star, Coins, ShieldAlert, Stamp } from 'lucide-react';
import { Field, Kpi, LEAVE_TYPES, ROLES, _xe, eosYears, hrScoreFor, leaveBalance, lvDays, money, printA4, today } from '../../App.jsx';

export function EmployeeFile({ org, ops, me, myBranches, say }) {
  const R = ROLES[me.role] || {};
  const brIds = (myBranches || []).map(b => b.id);
  const emps = (org.employees || []).filter(e => R.scope === 'all' || brIds.includes(e.branchId)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  const [eid, setEid] = useState((emps.find(e => e.isActive !== false) || emps[0] || {}).id || '');
  const [ym, setYm] = useState(today().slice(0, 7));
  const [q, setQ] = useState('');
  const e = emps.find(x => x.id === eid);
  const ymAdd = (y, n) => { const [Y, M] = y.split('-').map(Number); const d = new Date(Y, M - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const ymAr = (y) => { const [Y, M] = y.split('-').map(Number); return new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', year: 'numeric' }); };
  const D = useMemo(() => {
    if (!e) return null;
    const months = [5, 4, 3, 2, 1, 0].map(k => ymAdd(ym, -k));
    const trend = months.map(m => ({ m, ...hrScoreFor(org, ops, e, m) }));
    const cur = trend[trend.length - 1];
    const from12 = ymAdd(ym, -11) + '-01', to = ym + '-31';
    const mine = (col) => (ops[col] || []).filter(x => x.employeeId === e.id);
    const leaves = mine('leaveRequests').filter(r => r.status === 'approved' && r.to >= from12 && r.from <= to);
    const lvBy = {}; leaves.forEach(r => { lvBy[r.type] = (lvBy[r.type] || 0) + (r.days || lvDays(r.from, r.to)); });
    const pts = mine('pointsEntries').filter(p => (p.date || '') >= from12 && (p.date || '') <= to).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const rw = mine('rewardRequests').filter(r => r.status === 'approved' && (r.month || '') >= from12.slice(0, 7) && (r.month || '') <= ym);
    const corr = mine('hrCorrective').filter(c => c.status !== 'rejected' && c.status !== 'cancelled').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const pips = mine('hrPips').filter(p => !['closed', 'cancelled', 'passed', 'failed'].includes(p.status));
    const tr = mine('hrTraining').sort((a, b) => String(b.completedDate || b.plannedDate || '').localeCompare(String(a.completedDate || a.plannedDate || '')));
    const lb = leaveBalance(org, ops, e, today());
    const yrs = e.hireDate ? eosYears(e.hireDate, today()) : null;
    return { months, trend, cur, leaves, lvBy, pts, rw, corr, pips, tr, lb, yrs,
      rwSum: rw.filter(r => r.kind === 'reward').reduce((a, r) => a + (Number(r.amount) || 0), 0), penSum: rw.filter(r => r.kind !== 'reward').reduce((a, r) => a + (Number(r.amount) || 0), 0),
      ptsSum: pts.reduce((a, p) => a + (Number(p.points) || 0), 0) };
  }, [e, ym, org, ops]);
  const badge = (v) => v == null ? 'b-dim' : v >= 85 ? 'b-mint' : v >= 70 ? 'b-amber' : 'b-rose';
  const AX = [['attendance', 'الحضور'], ['tasks', 'المهام'], ['discipline', 'الانضباط'], ['quality', 'الجودة'], ['roleKpi', 'مؤشرات الدور']];
  const td2 = today();
  const trSt = (t) => t.status !== 'completed' ? ['مخطط ' + (t.plannedDate || ''), 'b-sky'] : t.expiryDate && t.expiryDate < td2 ? ['منتهية ' + t.expiryDate, 'b-rose'] : t.expiryDate ? ['سارية حتى ' + t.expiryDate, 'b-mint'] : ['مكتمل', 'b-mint'];
  const printIt = () => {
    if (!e || !D) return;
    const br = ((org.branches || []).find(b => b.id === e.branchId) || {}).name || '';
    const row = (k, v) => `<tr><td>${_xe(k)}</td><td class="n">${_xe(String(v))}</td></tr>`;
    const body = `<div class="box"><b>${_xe(e.name)}</b> · ${_xe(e.jobTitle || '')} · ${_xe(br)}${e.hireDate ? ' · تعيين ' + e.hireDate : ''}</div>
      <table><thead><tr><th>الشهر</th><th class="n">الدرجة</th>${AX.map(a => '<th class="n">' + a[1] + '</th>').join('')}</tr></thead><tbody>
      ${D.trend.map(t => `<tr><td>${ymAr(t.m)}</td><td class="n">${t.score ?? '—'}</td>${AX.map(a => '<td class="n">' + (t.axes[a[0]] ?? '—') + '</td>').join('')}</tr>`).join('')}</tbody></table>
      <table><tbody>${row('حضور الشهر: في الوقت / تأخير / غياب', D.cur.st.onTime + ' / ' + D.cur.st.late + ' / ' + D.cur.st.absent)}${row('رصيد الإجازة السنوية', D.lb.ok ? D.lb.balance + ' يوم' : '—')}
      ${row('النقاط (12 شهرًا)', D.ptsSum)}${row('المكافآت المعتمدة (12 شهرًا)', money(D.rwSum))}${row('الجزاءات المعتمدة (12 شهرًا)', money(D.penSum))}${row('إجراءات تصحيحية', D.corr.length)}${row('خطط تحسين مفتوحة', D.pips.length)}${row('تدريب مكتمل', D.tr.filter(t => t.status === 'completed').length)}</tbody></table>`;
    if (!printA4(org, 'ملف الموظف — ' + e.name, 'حتى ' + ymAr(ym), body)) say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const shownEmps = emps.filter(x => !q.trim() || String(x.name || '').includes(q.trim()));
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card"><div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <Field label="بحث" style={{ marginBottom: 0 }}><input className="inp" style={{ width: 160 }} value={q} placeholder="اسم الموظف" onChange={ev => setQ(ev.target.value)} /></Field>
        <Field label="الموظف" style={{ marginBottom: 0 }}><select className="sel" style={{ minWidth: 220 }} value={eid} onChange={ev => setEid(ev.target.value)}>{shownEmps.map(x => <option key={x.id} value={x.id}>{x.name}{x.isActive === false ? ' (موقوف)' : ''}</option>)}</select></Field>
        <Field label="حتى شهر" style={{ marginBottom: 0 }}><input type="month" className="inp" value={ym} onChange={ev => setYm(ev.target.value || today().slice(0, 7))} /></Field>
        <button className="btn sm" style={{ marginInlineStart: 'auto' }} disabled={!e} onClick={printIt}><Printer size={13} />طباعة الملف</button>
      </div></div>
      {!e || !D ? <div className="card"><div className="empty">لا موظفون في نطاقك.</div></div> : <>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, alignItems: 'center' }}>
          <div>
            <div className="card-t" style={{ fontSize: 19 }}>{e.name}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {e.jobTitle && <span className="badge b-dim">{e.jobTitle}</span>}
              <span className="badge b-dim">{((org.branches || []).find(b => b.id === e.branchId) || {}).name || '—'}</span>
              {e.hireDate && <span className="badge b-dim">تعيين {e.hireDate} · {Math.floor(D.yrs)} سنة</span>}
              {e.isActive === false && <span className="badge b-rose">موقوف{e.endDate ? ' منذ ' + e.endDate : ''}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--ink3)', border: '1px solid var(--line)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>درجة {ymAr(ym)}</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 800 }}>{D.cur.score ?? '—'}</div>
            <span className={'badge ' + badge(D.cur.score)}>{D.cur.score == null ? 'لا بيانات كافية' : D.cur.score >= 85 ? 'ممتاز' : D.cur.score >= 70 ? 'جيد' : 'يحتاج تحسين'}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><TrendingUp size={15} color="var(--brass)" />الأداء آخر 6 أشهر</div>
          <div className="tw"><table className="tb">
            <thead><tr><th>الشهر</th><th style={{ textAlign: 'end' }}>الدرجة</th>{AX.map(a => <th key={a[0]} style={{ textAlign: 'end' }}>{a[1]}</th>)}</tr></thead>
            <tbody>{D.trend.map(t => <tr key={t.m}><td style={{ fontSize: 12 }}>{ymAr(t.m)}</td><td style={{ textAlign: 'end' }}><span className={'badge ' + badge(t.score)}>{t.score ?? '—'}</span></td>{AX.map(a => <td key={a[0]} className="num" style={{ textAlign: 'end' }}>{t.axes[a[0]] ?? '—'}</td>)}</tr>)}</tbody>
          </table></div>
        </div>
        <div className="grid g4">
          <Kpi label="حضور الشهر" value={D.cur.st.onTime + ' / ' + (D.cur.st.onTime + D.cur.st.late + D.cur.st.absent)} sub={'تأخير ' + D.cur.st.late + ' · غياب ' + D.cur.st.absent} icon={Fingerprint} color="#5B93C4" />
          <Kpi label="رصيد الإجازة السنوية" value={D.lb.ok ? String(Math.floor(D.lb.balance)) + ' يوم' : '—'} sub={Object.entries(D.lvBy).map(([k, v]) => (LEAVE_TYPES[k] || {}).ar + ' ' + v).join(' · ') || 'لا إجازات خلال 12 شهرًا'} icon={CalendarDays} color="#9B7BB8" />
          <Kpi label="النقاط (12 شهرًا)" value={String(D.ptsSum)} sub={D.pts.length + ' حركة'} icon={Star} color="#C8A24A" />
          <Kpi label="مكافآت / جزاءات" value={money(D.rwSum)} sub={'جزاءات ' + money(D.penSum)} icon={Coins} color="#4FB286" />
        </div>
        <div className="grid g2">
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><ShieldAlert size={15} color="var(--brass)" />الإجراءات التصحيحية وخطط التحسين</div>
            {D.pips.map(p => <div key={p.id} className="note" style={{ marginBottom: 6 }}>خطة تحسين مفتوحة منذ {String(p.openedAt || '').slice(0, 10)} — {p.reason || ''}</div>)}
            {D.corr.slice(0, 8).map(c => <div key={c.id} className="row" style={{ justifyContent: 'space-between', gap: 6, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{c.title || c.code} <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>· {c.date} · المرة {c.level}</span></span>
              <span className={'badge ' + (c.status === 'approved' ? 'b-rose' : 'b-amber')}>{c.status === 'approved' ? (c.penaltyType === 'fine' ? 'غرامة ' + money(c.fineAmount) : c.penaltyType === 'warning' ? 'إنذار' : (c.penaltyType || 'معتمد')) : 'بانتظار الاعتماد'}</span></div>)}
            {!D.corr.length && !D.pips.length && <div className="empty">سجل نظيف ✓</div>}
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><Stamp size={15} color="var(--brass)" />التدريب والشهادات</div>
            {D.tr.slice(0, 8).map(t => { const [l, c] = trSt(t); return <div key={t.id} className="row" style={{ justifyContent: 'space-between', gap: 6, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
              <span>{t.programTitle}{t.score != null ? <span style={{ fontSize: 10.5, color: 'var(--faint)' }}> · درجة {t.score}</span> : null}</span><span className={'badge ' + c}>{l}</span></div>; })}
            {!D.tr.length && <div className="empty">لا سجلات تدريب.</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><Coins size={15} color="var(--brass)" />آخر المكافآت والجزاءات والنقاط</div>
          <div className="tw"><table className="tb"><tbody>
            {[...D.rw.map(r => ({ d: (r.month || '') + '-28', t: (r.kind === 'reward' ? 'مكافأة' : 'جزاء') + ': ' + (r.reason || ''), v: (r.kind === 'reward' ? '+' : '−') + money(r.amount), c: r.kind === 'reward' ? 'var(--mint)' : 'var(--rose)' })),
              ...D.pts.map(p => ({ d: p.date, t: 'نقاط: ' + (p.reason || ''), v: (p.points > 0 ? '+' : '') + p.points, c: p.points >= 0 ? 'var(--mint)' : 'var(--rose)' }))]
              .sort((a, b) => String(b.d).localeCompare(String(a.d))).slice(0, 12).map((x, i) => <tr key={i}><td className="num" style={{ fontSize: 11.5 }}>{String(x.d).slice(0, 10)}</td><td style={{ fontSize: 12.5 }}>{x.t}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700, color: x.c }}>{x.v}</td></tr>)}
            {!D.rw.length && !D.pts.length && <tr><td><div className="empty">لا حركات خلال 12 شهرًا.</div></td></tr>}
          </tbody></table></div>
        </div>
      </>}
    </div>
  );
}
