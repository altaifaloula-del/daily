/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Printer, Download, Settings, Check, Clock, Banknote, TrendingUp, CircleDollarSign, CalendarDays } from 'lucide-react';
import { Field, Kpi, Modal, ROLES, _xe, arDate, countedClosing, isoD, makeXlsx, money, printA4, sum, today, uid } from '../../App.jsx';

export function Workforce({ org, ops, me, myBranches, scoped, commit, commitOrg, say }) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (s) => { const n = Number(String(s == null ? '' : s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : 0; };
  const canW = ROLES[me?.role]?.scope === 'all';
  const ids = myBranches.map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && ids.includes(e.branchId));
  const D7 = [0, 1, 2, 3, 4, 5, 6];

  const cfg = org.laborCfg || {};
  const targetPct = Number(cfg.targetPct != null ? cfg.targetPct : 25) || 0;              // هدف نسبة العمالة (افتراضي 25%)
  const stdH = Number(cfg.stdMonthlyHours != null ? cfg.stdMonthlyHours : 208) || 208;    // ساعات شهرية معيارية (26×8)
  const grossOf = (e) => r2((e.baseSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowance || 0));
  const rateOf = (e) => stdH > 0 ? grossOf(e) / stdH : 0;

  const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
  const [weekStart, setWeekStart] = useState(() => addDays(today(), -6));   // آخر 7 أيام حتى اليوم (بيانات مبيعات حقيقية)
  const [mode, setMode] = useState('plan');     // plan | actual
  const [draft, setDraft] = useState({});        // { empId: { plan:[7], actual:[7] } }
  const [setOpen, setSetOpen] = useState(false);
  const [cfgD, setCfgD] = useState({ targetPct: String(targetPct), stdMonthlyHours: String(stdH) });

  const days = D7.map(i => addDays(weekStart, i));
  const dNm = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'short' });
  const dDay = (ds) => new Date(ds + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });

  const weekRecs = (ops.schedules || []).filter(s => s.weekStart === weekStart && ids.includes(s.branchId));
  const recOf = (empId) => weekRecs.find(s => s.empId === empId);
  const stored = (empId, key, di) => { const r = recOf(empId); return r && r[key] && r[key][di] != null ? r[key][di] : null; };
  const shown = (empId, di) => { const dr = draft[empId]; if (dr && dr[mode] && dr[mode][di] != null) return dr[mode][di]; const v = stored(empId, mode, di); return v != null ? String(v) : ''; };
  const planOf = (empId, di) => { const dr = draft[empId]; if (dr && dr.plan && dr.plan[di] != null) return num(dr.plan[di]); return num(stored(empId, 'plan', di)); };
  // (ج) v27.12 — الساعات الفعلية تُحسب من الحضور الموثَّق مباشرةً (لا إدخال يدوي)
  const attHoursOf = (empId, ds) => {
    const evs = (ops.attendanceEvents || []).filter(x => x.employeeId === empId && (x.at || '').slice(0, 10) === ds).sort((a, b) => (a.at < b.at ? -1 : 1));
    const firstIn = evs.find(e => e.type === 'in'); if (!firstIn) return 0;
    const outs = evs.filter(e => e.type === 'out'); const lastOut = outs[outs.length - 1];
    if (!lastOut || lastOut.at <= firstIn.at) return 0;
    return r2((new Date(lastOut.at) - new Date(firstIn.at)) / 3600000);
  };
  const actOf = (empId, di) => attHoursOf(empId, days[di]);
  const effOf = (empId, di) => mode === 'plan' ? planOf(empId, di) : actOf(empId, di);
  const setCell = (empId, di, v) => setDraft(s => { const cur = s[empId] || {}; const arr = cur[mode] ? [...cur[mode]] : Array(7).fill(null); arr[di] = v.replace(/[^\d.]/g, ''); return { ...s, [empId]: { ...cur, [mode]: arr } }; });

  const rowHours = (empId) => r2(sum(D7, di => effOf(empId, di)));
  const rowCost = (e) => r2(rowHours(e.id) * rateOf(e));
  // v39.2: نسبة العمالة على صافي المبيعات بعد استبعاد ضريبة القيمة المضافة (الإيراد وفق IFRS 15) — كانت على الإجمالي فتظهر أقل بنحو 13%
  const vatF = (org.taxCfg || {}).enabled ? 1 + (Number((org.taxCfg || {}).rate) || 15) / 100 : 1;
  const daySales = (di) => r2(sum((scoped.closings || []).filter(c => countedClosing(c) && c.date === days[di] && ids.includes(c.branchId)), c => (c.cashSales || 0) + (c.cardSales || 0) + (c.bankTransferSales || 0) + sum(c.deliverySales || [], s => s.amount || 0)) / vatF);
  const dayHours = (di) => r2(sum(emps, e => effOf(e.id, di)));
  const dayCost = (di) => r2(sum(emps, e => effOf(e.id, di) * rateOf(e)));
  const allAvgRate = emps.length ? r2(sum(emps, rateOf) / emps.length) : 0;
  const dayAvgRate = (di) => { const w = emps.filter(e => effOf(e.id, di) > 0); return w.length ? r2(sum(w, rateOf) / w.length) : allAvgRate; };

  const analysis = days.map((ds, di) => {
    const sales = daySales(di), hours = dayHours(di), cost = dayCost(di);
    const pct = sales > 0 ? r2(cost / sales * 100) : null;
    const ar = dayAvgRate(di);
    const recHours = (sales > 0 && ar > 0) ? r2(sales * targetPct / 100 / ar) : 0;
    let status = 'idle';
    if (sales > 0 && hours === 0) status = 'gap';
    else if (pct != null && pct > targetPct + 0.001) status = 'over';
    else if (hours > 0) status = 'ok';
    return { ds, di, sales, hours, cost, pct, recHours, status };
  });
  const totHours = r2(sum(analysis, a => a.hours));
  const totCost = r2(sum(analysis, a => a.cost));
  const totSales = r2(sum(analysis, a => a.sales));
  const weekPct = totSales > 0 ? r2(totCost / totSales * 100) : null;
  const splh = totHours > 0 ? r2(totSales / totHours) : 0;
  const gapDays = analysis.filter(a => a.status === 'gap').length;
  const overDays = analysis.filter(a => a.status === 'over').length;
  const cutHours = (weekPct != null && weekPct > targetPct && allAvgRate > 0) ? r2((totCost - totSales * targetPct / 100) / allAvgRate) : 0;
  const planTot = r2(sum(emps, e => sum(D7, di => planOf(e.id, di))));
  const actTot = r2(sum(emps, e => sum(D7, di => actOf(e.id, di))));
  const hasActual = actTot > 0;
  const dirty = Object.keys(draft).length > 0;

  const saveWeek = async () => {
    const recs = emps.map(e => ({ id: (recOf(e.id) || {}).id || uid('sch'), weekStart, empId: e.id, branchId: e.branchId, plan: D7.map(di => planOf(e.id, di)), actual: D7.map(di => actOf(e.id, di)) }));
    const others = (ops.schedules || []).filter(s => !(s.weekStart === weekStart && ids.includes(s.branchId)));
    const okc = await commit(d => ({ ...d, schedules: [...others, ...recs] }), { actionType: 'update', targetType: 'schedule', targetId: weekStart, title: 'حفظ جدول العمل والحضور', details: 'أسبوع يبدأ ' + weekStart + ' · ' + emps.length + ' موظف · ' + totHours + ' ساعة' });
    if (okc) { setDraft({}); say('حُفظ جدول الأسبوع ✓'); }
  };
  const saveCfg = async () => {
    const okc = await commitOrg(d => ({ ...d, laborCfg: { targetPct: num(cfgD.targetPct), stdMonthlyHours: num(cfgD.stdMonthlyHours) || 208 } }), { actionType: 'update', targetType: 'setting', targetId: 'laborCfg', title: 'ضبط إعدادات تحسين العمالة', details: 'هدف ' + num(cfgD.targetPct) + '% · ساعات معيارية ' + (num(cfgD.stdMonthlyHours) || 208) });
    if (okc) { setSetOpen(false); say('حُفظت الإعدادات ✓'); }
  };
  const exportXlsx = () => {
    try {
      const head1 = ['الموظف', 'الأجر/ساعة', ...days.map(ds => dNm(ds) + ' ' + dDay(ds)), 'إجمالي الساعات', 'التكلفة'];
      const body1 = emps.map(e => [e.name, r2(rateOf(e)), ...D7.map(di => effOf(e.id, di)), rowHours(e.id), rowCost(e)]);
      body1.push(['الإجمالي', '', ...D7.map(di => dayHours(di)), totHours, totCost]);
      const stTxt = { gap: 'نقص تغطية', over: 'زيادة عمالة', ok: 'متوازن', idle: 'بلا نشاط' };
      const head2 = ['اليوم', 'التاريخ', 'المبيعات', 'ساعات العمل', 'تكلفة العمالة', 'نسبة العمالة %', 'الساعات المقترحة', 'الحالة'];
      const body2 = analysis.map(a => [dNm(a.ds), a.ds, a.sales, a.hours, a.cost, a.pct != null ? a.pct : '—', a.recHours, stTxt[a.status]]);
      body2.push(['الإجمالي', '', totSales, totHours, totCost, weekPct != null ? weekPct : '—', '', '']);
      const blob = makeXlsx([{ name: ('جدول ' + (mode === 'plan' ? 'مخطط' : 'فعلي')).slice(0, 28), rows: [head1, ...body1] }, { name: 'تحسين العمالة', rows: [head2, ...body2] }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'الجدولة_وتحسين_العمالة_' + weekStart + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500);
      say('نُزّل الملف (Excel) ✓');
    } catch (e) { say('تعذّر توليد Excel', 'no'); }
  };
  const printSched = () => {
    const dayCols = days.map(ds => `<th>${dNm(ds)}<br>${dDay(ds)}</th>`).join('');
    const rws = emps.map(e => `<tr><td>${_xe(e.name)}</td>${D7.map(di => `<td class="n">${effOf(e.id, di) || '—'}</td>`).join('')}<td class="n">${rowHours(e.id)}</td><td class="n">${money(rowCost(e))}</td></tr>`).join('') || `<tr><td colspan="10" style="text-align:center;color:#999">لا موظفين في نطاقك</td></tr>`;
    printA4(org, 'جدول العمل (' + (mode === 'plan' ? 'المخطط' : 'الفعلي') + ') — أسبوع يبدأ ' + weekStart, arDate(today()) + ' · ' + emps.length + ' موظف · ' + totHours + ' ساعة · تكلفة ' + money(totCost) + (weekPct != null ? ' · نسبة العمالة ' + weekPct + '%' : ''),
      `<table><thead><tr><th>الموظف</th>${dayCols}<th>الساعات</th><th>التكلفة</th></tr></thead><tbody>${rws}<tr class="tot"><td>الإجمالي</td>${D7.map(di => `<td class="n">${dayHours(di)}</td>`).join('')}<td class="n">${totHours}</td><td class="n">${money(totCost)}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة', 'no');
  };
  const stB = (s) => s === 'gap' ? { c: 'b-amber', t: 'نقص تغطية' } : s === 'over' ? { c: 'b-rose', t: 'زيادة عمالة' } : s === 'ok' ? { c: 'b-mint', t: 'متوازن' } : { c: 'b-dim', t: '—' };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>تخطيط العمالة والتكلفة</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>خطّط ساعات فريقك، والفعلي من الحضور الموثَّق، واضبط نسبة العمالة على مبيعاتك</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={printSched}><Printer size={13} />طباعة الجدول</button>
          <button className="btn sm" onClick={exportXlsx}><Download size={13} />Excel</button>
          {canW && <button className="btn sm" onClick={() => { setCfgD({ targetPct: String(targetPct), stdMonthlyHours: String(stdH) }); setSetOpen(true); }}><Settings size={13} />الإعدادات</button>}
          {canW && dirty && <button className="btn sm pri" onClick={saveWeek}><Check size={14} />حفظ الأسبوع</button>}
        </div>
      </div>

      {emps.length === 0 ? <div className="card"><div className="empty">أضف موظفيك وأسند كلًّا منهم لفرعٍ من «الرواتب» أو «الفروع والمستخدمون»، ثم جدْول ساعاتهم هنا.</div></div> : <>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn sm gh" onClick={() => { setWeekStart(addDays(weekStart, -7)); setDraft({}); }}>▶ الأسبوع السابق</button>
          <input type="date" className="inp" value={weekStart} onChange={e => { if (e.target.value) { setWeekStart(e.target.value); setDraft({}); } }} style={{ width: 160 }} />
          <button className="btn sm gh" onClick={() => { setWeekStart(addDays(weekStart, 7)); setDraft({}); }}>الأسبوع التالي ◀</button>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{dDay(days[0])} — {dDay(days[6])}</span>
          <div style={{ flex: 1 }} />
          <div className="row" style={{ gap: 0, border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            <button className={'btn sm ' + (mode === 'plan' ? 'pri' : 'gh')} style={{ borderRadius: 0 }} onClick={() => setMode('plan')}>الجدول المخطط</button>
            <button className={'btn sm ' + (mode === 'actual' ? 'pri' : 'gh')} style={{ borderRadius: 0 }} onClick={() => setMode('actual')}>الحضور الفعلي</button>
          </div>
        </div>

        <div className="grid g4">
          <Kpi label={'إجمالي ساعات الأسبوع (' + (mode === 'plan' ? 'مخطط' : 'فعلي') + ')'} value={String(totHours)} sub={emps.length + ' موظف'} icon={Clock} color="#5B93C4" />
          <Kpi label="تكلفة العمالة" value={money(totCost)} sub={'أجر/ساعة وسطي ' + money(allAvgRate)} icon={Banknote} color="#C8A24A" />
          <Kpi label="نسبة العمالة من المبيعات" value={weekPct != null ? weekPct + '%' : '—'} sub={'الهدف ' + targetPct + '%'} icon={TrendingUp} color={weekPct == null ? '#5B93C4' : weekPct > targetPct ? '#D9544D' : '#4FB286'} />
          <Kpi label="المبيعات لكل ساعة عمل" value={money(splh)} sub={'من مبيعات ' + money(totSales)} icon={CircleDollarSign} color="#4FB286" />
        </div>

        {mode === 'actual' && (
          <div className="note" style={{ borderColor: 'rgba(91,147,196,.3)' }}>
            {hasActual ? <>الحضور الفعلي <b>{actTot}</b> ساعة مقابل المخطط <b>{planTot}</b> ساعة — الفرق <b style={{ color: actTot > planTot ? 'var(--rose)' : 'var(--mint)' }}>{r2(actTot - planTot)}</b> ساعة.</> : 'لا حضور موثَّق مُسجَّل لهذا الأسبوع بعد — تظهر الساعات الفعلية هنا تلقائيًا فور تسجيل الموظفين حضورهم من كشك الفرع.'}
          </div>
        )}

        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><CalendarDays size={15} color="var(--brass)" />{mode === 'plan' ? 'الجدول الأسبوعي — ساعات العمل المخطّطة لكل موظف' : 'الحضور الفعلي — ساعات العمل المحسوبة من الحضور الموثَّق'}</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th>{days.map((ds, di) => <th key={di} style={{ textAlign: 'center', minWidth: 46 }}>{dNm(ds)}<div style={{ fontSize: 9, color: 'var(--faint)', fontWeight: 400 }}>{dDay(ds)}</div></th>)}<th style={{ textAlign: 'end' }}>الساعات</th><th style={{ textAlign: 'end' }}>التكلفة</th></tr></thead>
              <tbody>
                {emps.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}<span style={{ fontSize: 9.5, color: 'var(--faint)' }}> · {e.jobTitle || ''}</span></td>
                    {D7.map(di => (
                      <td key={di} style={{ textAlign: 'center' }}>
                        {mode === 'actual'
                          ? <span className="num" style={{ fontSize: 12.5 }}>{actOf(e.id, di) || '—'}</span>
                          : <input className="inp n" style={{ width: 44, textAlign: 'center', padding: '4px 2px' }} inputMode="decimal" value={shown(e.id, di)} placeholder="—" disabled={!canW} onChange={ev => setCell(e.id, di, ev.target.value)} />}
                      </td>
                    ))}
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{rowHours(e.id) || '—'}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{money(rowCost(e))}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                  <td>الإجمالي</td>
                  {D7.map(di => <td key={di} className="num" style={{ textAlign: 'center' }}>{dayHours(di) || '—'}</td>)}
                  <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{totHours}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(totCost)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><TrendingUp size={15} color="var(--brass)" />تحسين العمالة — المبيعات مقابل تكلفة الساعات يومياً</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>اليوم</th><th style={{ textAlign: 'end' }}>المبيعات</th><th style={{ textAlign: 'end' }}>ساعات العمل</th><th style={{ textAlign: 'end' }}>تكلفة العمالة</th><th style={{ textAlign: 'end' }}>نسبة العمالة</th><th style={{ textAlign: 'end' }}>الساعات المقترحة</th><th style={{ textAlign: 'center' }}>الحالة</th></tr></thead>
              <tbody>
                {analysis.map(a => { const sb = stB(a.status); return (
                  <tr key={a.di} style={a.status === 'over' ? { background: 'rgba(217,84,77,.05)' } : a.status === 'gap' ? { background: 'rgba(224,164,88,.06)' } : null}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{dNm(a.ds)}<span style={{ fontSize: 9.5, color: 'var(--faint)' }}> · {dDay(a.ds)}</span></td>
                    <td className="num" style={{ textAlign: 'end' }}>{a.sales ? money(a.sales) : '—'}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{a.hours || '—'}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{a.cost ? money(a.cost) : '—'}</td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: a.pct == null ? 'var(--faint)' : a.pct > targetPct ? 'var(--rose)' : 'var(--mint)' }}>{a.pct != null ? a.pct + '%' : '—'}</td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{a.recHours || '—'}</td>
                    <td style={{ textAlign: 'center' }}><span className={'badge ' + sb.c}>{sb.t}</span></td>
                  </tr>
                ); })}
                <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                  <td>الإجمالي</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(totSales)}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{totHours}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(totCost)}</td>
                  <td className="num" style={{ textAlign: 'end', color: weekPct == null ? 'var(--faint)' : weekPct > targetPct ? 'var(--rose)' : 'var(--mint)' }}>{weekPct != null ? weekPct + '%' : '—'}</td>
                  <td className="num" style={{ textAlign: 'end' }}>—</td>
                  <td style={{ textAlign: 'center' }}>{overDays ? <span className="badge b-rose">{overDays} يوم زيادة</span> : gapDays ? <span className="badge b-amber">{gapDays} يوم نقص</span> : <span className="badge b-mint">متوازن</span>}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="note">💡 <b>نسبة العمالة</b> = تكلفة ساعات العمل ÷ صافي المبيعات بعد الضريبة (هدفك <b>{targetPct}%</b> — اضبطه من «الإعدادات»). <b>الأجر/الساعة</b> لكل موظف = (الأساسي + البدلات) ÷ الساعات الشهرية المعيارية ({stdH}). <b>الساعات المقترحة</b> = مبيعات اليوم × الهدف ÷ متوسط الأجر/الساعة. {weekPct == null ? 'سجّل مبيعات الأيام (من الإغلاق) لاحتساب النسبة.' : weekPct > targetPct ? <>نسبة أسبوعك <b>{weekPct}%</b> أعلى من هدفك — يمكن خفض نحو <b>{cutHours}</b> ساعة أسبوعياً للوصول للهدف.</> : <>نسبة أسبوعك <b>{weekPct}%</b> ضمن هدفك — توزيع عمالة جيّد 👍</>}{gapDays > 0 ? ' وهناك أيام فيها مبيعات دون تسجيل ساعات — راجعها.' : ''} كل الأرقام من ساعاتك المُدخلة ومن مبيعات إغلاقاتك المعتمدة — بلا افتراض.</div>
      </>}

      {setOpen && (
        <Modal title="إعدادات تحسين العمالة" sub="ضوابط صريحة — بلا افتراض خفيّ" icon={Settings} onClose={() => setSetOpen(false)}
          foot={<><button className="btn pri" onClick={saveCfg}><Check size={14} />حفظ الإعدادات</button><button className="btn gh" onClick={() => setSetOpen(false)}>إلغاء</button></>}>
          <div className="grid g2">
            <Field label="هدف نسبة العمالة من المبيعات (%)"><input className="inp n" inputMode="decimal" value={cfgD.targetPct} onChange={e => setCfgD(s => ({ ...s, targetPct: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="ساعات العمل الشهرية المعيارية"><input className="inp n" inputMode="decimal" value={cfgD.stdMonthlyHours} onChange={e => setCfgD(s => ({ ...s, stdMonthlyHours: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          </div>
          <div className="note" style={{ marginTop: 10 }}>تُستخدم <b>الساعات الشهرية المعيارية</b> لتحويل راتب كل موظف إلى أجرٍ بالساعة (الأساسي + البدلات ÷ الساعات). الافتراضات الحالية: هدف <b>25%</b> وساعات <b>208</b> (26 يوم × 8 ساعات) — عدّلهما بما يناسب نشاطك ونظام دوامك.</div>
        </Modal>
      )}
    </div>
  );
}
