/* v40.3 — «هندسة القائمة» (المرحلة 2 من مركز إدارة المطعم) — منهج كاسافانا وسميث
   المحرك في النواة (menuEngineering). للإدارة المركزية: الوصفات والتكاليف في المستند المركزي. */
import React, { useMemo, useState } from 'react';
import { UtensilsCrossed, Info, Download, ListChecks, Settings, Check, Lock } from 'lucide-react';
import { Field, Kpi, MENU_CLS, ROLES, makeXlsx, menuEngineering, money, newAction, roleEdit, today } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const mEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const COL = { star: '#4FB286', plow: '#5B93C4', puzzle: '#C8A24A', dog: '#D9544D' };

function Matrix({ M }) {
  if (!M.rows.length) return null;
  const W = 340, H = 220, pad = 26;
  const xm = Math.max(M.popTh * 2, ...M.rows.map(r => r.mm)) * 1.08, ys = M.rows.map(r => r.cm), y0 = Math.min(0, ...ys), y1 = Math.max(M.cmAvg * 2, ...ys) * 1.08;
  const x = (v) => pad + v / xm * (W - pad - 8), y = (v) => H - pad - (v - y0) / ((y1 - y0) || 1) * (H - pad - 8);
  return (
    <svg className="me-mx" viewBox={`0 0 ${W} ${H}`} direction="ltr" style={{ direction: 'ltr' }} role="img" aria-label="مصفوفة هندسة القائمة">
      <line x1={x(M.popTh)} x2={x(M.popTh)} y1={6} y2={H - pad} stroke="currentColor" strokeOpacity=".35" strokeDasharray="4 3" />
      <line x1={pad} x2={W - 6} y1={y(M.cmAvg)} y2={y(M.cmAvg)} stroke="currentColor" strokeOpacity=".35" strokeDasharray="4 3" />
      <text x={W - 8} y={14} fontSize="9" textAnchor="end" fill={COL.star}>⭐ نجوم</text><text x={pad + 4} y={14} fontSize="9" fill={COL.puzzle}>❓ ألغاز</text>
      <text x={W - 8} y={H - pad - 4} fontSize="9" textAnchor="end" fill={COL.plow}>🐎 أحصنة عمل</text><text x={pad + 4} y={H - pad - 4} fontSize="9" fill={COL.dog}>🐕 ضعيفة</text>
      <text x={W / 2} y={H - 6} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity=".6">الشعبية (حصة الكميات) →</text>
      <text x={8} y={H / 2} fontSize="9" textAnchor="middle" fill="currentColor" fillOpacity=".6" transform={`rotate(-90 8 ${H / 2})`}>الهامش للوحدة ←</text>
      {M.rows.map(r => <circle key={r.id} cx={x(r.mm)} cy={y(r.cm)} r="4.5" fill={COL[r.cls]} fillOpacity=".85"><title>{r.name} — {r.mm}% · {money(r.cm)}</title></circle>)}
    </svg>);
}

export function MenuEngineering({ org, ops, me, commit, commitOrg, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const td = today(), pm = addD(td.slice(0, 7) + '-01', -1).slice(0, 7);
  const [rng, setRng] = useState({ k: '30', from: addD(td, -30), to: addD(td, -1) });
  const [br, setBr] = useState('');
  const [cls, setCls] = useState('');
  const [cfgOpen, setCfgOpen] = useState(false);
  const [pp, setPp] = useState(String((org.menuCfg || {}).popPct || 70));
  const M = useMemo(() => menuEngineering(org, ops, { from: rng.from, to: rng.to, branchIds: br ? [br] : null }), [org, ops, rng, br]);
  if (!central) return <div className="card"><div className="empty"><Lock size={16} /> هندسة القائمة للإدارة المركزية — الوصفات والتكاليف في المستند المركزي.</div></div>;
  const acts = new Set((ops.actions || []).filter(a => a.srcKey && a.status !== 'dismissed').map(a => a.srcKey));
  const toAction = async (r) => { const k = 'menu|' + r.id + '|' + r.cls; const C = MENU_CLS[r.cls];
    const rec = newAction(me, { src: 'menu', srcKey: k, area: 'menu', title: 'هندسة القائمة: ' + C.ar + ' — ' + r.name, detail: C.tip + ' · الحصة ' + r.mm + '% (العتبة ' + M.popTh + '%) · الهامش ' + money(r.cm) + ' (المتوسط ' + money(M.cmAvg) + ') · تكلفة الطعام ' + (r.foodPct ?? '—') + '%' });
    const ok = await commit(d => ((d.actions || []).some(x => x.srcKey === k && x.status !== 'dismissed') ? d : { ...d, actions: [rec, ...(d.actions || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'حوّل توصية هندسة القائمة إلى إجراء', details: rec.title });
    if (ok !== false) say('أُنشئ إجراء ✓ — حدّد مسؤوله وموعده من «الإجراءات والتوصيات»'); };
  const saveCfg = async () => { const v = Number(pp); if (!(v > 0 && v <= 200)) return say('أدخل نسبة بين 1 و200', 'no');
    const ok = await commitOrg(d => ({ ...d, menuCfg: { ...(d.menuCfg || {}), popPct: v } }), { actionType: 'update', targetType: 'settings', targetId: 'menuCfg', need: 'edit', title: 'عتبة الشعبية في هندسة القائمة', details: v + '%' });
    if (ok !== false) { setCfgOpen(false); say('حُفظ ✓'); } };
  const exportX = () => { try { const head = ['المنتج', 'التصنيف', 'الكمية', 'الحصة %', 'السعر', 'السعر بعد الضريبة', 'تكلفة الوصفة', 'الهامش للوحدة', 'تكلفة الطعام %', 'إجمالي الهامش', 'التوصية'];
    const rows = M.rows.map(r => [r.name, MENU_CLS[r.cls].ar, r.qty, r.mm, r.price, r.net, r.cost, r.cm, r.foodPct ?? '', r.totCm, MENU_CLS[r.cls].tip]);
    const ex = [['المنتج', 'الكمية', 'سبب الاستبعاد'], ...M.excluded.map(x => [x.name, x.qty, x.why])];
    const blob = makeXlsx([{ name: 'هندسة القائمة', rows: [head, ...rows] }, { name: 'مستبعد', rows: ex }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'هندسة_القائمة_' + rng.from + '_' + rng.to + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); } catch { say('تعذّر توليد Excel', 'no'); } };
  const list = M.rows.filter(r => !cls || r.cls === cls);
  const periods = [['30', 'آخر 30 يومًا', addD(td, -30), addD(td, -1)], ['m', 'هذا الشهر', td.slice(0, 7) + '-01', td], ['pm', 'الشهر السابق', pm + '-01', mEnd(pm)]];
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>هندسة القائمة</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>ربحية كل صنف مقابل شعبيته — ماذا تحافظ عليه، وماذا تعيد تسعيره، وماذا تروّج له، وماذا تحذف</div></div>
        <div className="rp-seg"><button className="btn sm" onClick={exportX}><Download size={13} />Excel</button>{roleEdit(me?.role) && <button className={'btn sm' + (cfgOpen ? ' pri' : '')} onClick={() => setCfgOpen(v => !v)}><Settings size={13} />المنهج</button>}</div>
      </div>
      {cfgOpen && <div className="card"><div className="row" style={{ gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label="عتبة الشعبية % من الحصة المتساوية (معيار المنهج 70%)"><input className="inp n" inputMode="decimal" value={pp} onChange={e => setPp(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        <button className="btn pri" style={{ flex: '0 0 auto' }} onClick={saveCfg}><Check size={14} />حفظ</button></div></div>}
      <div className="rp-bar"><div className="rp-seg">{periods.map(([k, l, f, t]) => <button key={k} className={'btn sm' + (rng.k === k ? ' pri' : ' gh')} onClick={() => setRng({ k, from: f, to: t })}>{l}</button>)}</div>
        <div className="rp-dates"><select className="inp sel" value={br} onChange={e => setBr(e.target.value)}><option value="">كل الفروع</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div></div>
      {!M.rows.length ? <div className="card"><div className="empty">لا كميات مبيعات بالأصناف في الفترة{M.excluded.length ? ' قابلة للتحليل' : ''}. المصدر: فواتير نقطة البيع في ميزان، أو «المخزون ← الاستهلاك مقابل النظري ← مبيعات المنتجات» (استيراد Excel بعمودي المنتج والكمية، مثل تقرير مبيعات الأصناف من نظام الكاشير).</div></div> : <>
        <div className="grid g4">
          <Kpi label="أصناف محلّلة" value={String(M.rows.length)} sub={M.excluded.length ? M.excluded.length + ' مستبعد لنقص بياناته' : 'كل المبيع محلّل'} icon={UtensilsCrossed} color="#C8A24A" />
          <Kpi label="إجمالي هامش المساهمة" value={money(M.tot.cm)} sub={'من ' + money(M.tot.rev) + ' مبيعات' + (M.vat ? ' بعد الضريبة' : '')} icon={UtensilsCrossed} color="#4FB286" />
          <Kpi label="تكلفة الطعام النظرية" value={M.tot.foodPct == null ? '—' : M.tot.foodPct + '%'} sub="تكلفة الوصفات ÷ المبيعات" icon={UtensilsCrossed} color="#E0A458" />
          <Kpi label="متوسط الهامش للوحدة" value={money(M.cmAvg)} sub={'عتبة الشعبية ' + M.popTh + '%'} icon={UtensilsCrossed} color="#5B93C4" />
        </div>
        <div className="me-q">{Object.entries(MENU_CLS).map(([k, c]) => <button key={k} type="button" className={'me-qc' + (cls === k ? ' on' : '')} style={{ borderColor: COL[k] }} onClick={() => setCls(cls === k ? '' : k)}>
          <span className="me-qh">{c.ic} {c.ar} <b className="num">{M.cls[k].n}</b></span><small>{money(M.cls[k].cm)} هامش · {M.tot.cm ? Math.round(M.cls[k].cm / M.tot.cm * 100) : 0}%</small><small className="me-tip">{c.tip}</small></button>)}</div>
        <div className="card"><Matrix M={M} /></div>
        <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>{cls ? MENU_CLS[cls].ic + ' ' + MENU_CLS[cls].ar + ' (' + list.length + ')' : 'كل الأصناف بالأعلى هامشًا إجماليًا'}</div>
          <div className="me-list">{list.map(r => { const k = 'menu|' + r.id + '|' + r.cls; return (
            <div key={r.id} className="me-row">
              <span className="me-a"><b>{r.name}</b><small><span className="badge" style={{ background: COL[r.cls] + '22', color: COL[r.cls] }}>{MENU_CLS[r.cls].ic} {MENU_CLS[r.cls].ar}</span> {r.qty} مباع · حصة {r.mm}%</small>
                <small>السعر {money(r.price)}{M.vat ? ' (' + money(r.net) + ' بعد الضريبة)' : ''} · التكلفة {money(r.cost)} · تكلفة الطعام {r.foodPct ?? '—'}%</small></span>
              <span className="me-b"><b className="num" dir="ltr">{money(r.cm)}</b><small>للوحدة · {money(r.totCm)} إجمالي</small>
                {acts.has(k) ? <span className="badge b-sky">له إجراء</span> : (r.cls !== 'star' && commit ? <button className="btn sm gh" onClick={() => toAction(r)}><ListChecks size={12} />إجراء</button> : null)}</span>
            </div>); })}</div></div>
      </>}
      {M.excluded.length > 0 && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>مستبعد من التحليل لنقص بياناته ({M.excluded.length}) — أكمل الوصفة أو السعر أو تكلفة المكوّن</div>
        <div className="me-list">{M.excluded.map((x, i) => <div key={i} className="me-row"><span className="me-a"><b>{x.name}</b><small>{x.why}</small></span><span className="me-b"><small>{x.qty} مباع</small></span></div>)}</div></div>}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>المنهج (كاسافانا وسميث):</b> الشعبية عالية إذا بلغت حصة الصنف من الكميات ≥ (1 ÷ عدد الأصناف) × {M.popPct}%؛ والهامش عالٍ إذا بلغ متوسط الهامش المرجّح بالكميات. الهامش = سعر البيع{M.vat ? ' بعد استبعاد الضريبة' : ''} − تكلفة الوصفة بالناتج (المتوسط المرجّح للمكوّنات).
        السعر هو سعر القائمة — الخصومات الفعلية لا تظهر هنا. المصدر: فواتير نقطة البيع ومبيعات المنتجات المستوردة الواقعة كاملة داخل الفترة{M.src.partial ? ' (' + M.src.partial + ' سجل متداخل جزئيًا لم يُحتسب)' : ''}.</div>
    </div>);
}
