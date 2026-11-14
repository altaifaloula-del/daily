/* v40.8 — «قائمة التحضير اليومية» للمطبخ: كم يُحضَّر من كل تحضيرة ليوم معيّن في فرع
   المحرك في النواة (prepPlan). المتبقي من الأمس يُدخله المطبخ ويُطرح؛ الورقة تُطبع للمطبخ. */
import React, { useMemo, useState } from 'react';
import { ChefHat, Printer, Info, Lock } from 'lucide-react';
import { Kpi, ROLES, arDate, money, prepPlan, printA4, today } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const q = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function PrepList({ org, ops, me, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all' || !!(ROLES[me?.role] || {}).costCtl;
  const td = today();
  const brs = (org.branches || []).filter(b => b.isActive !== false);
  const [br, setBr] = useState((brs[0] || {}).id || '');
  const [date, setDate] = useState(addD(td, 1));
  const [oh, setOh] = useState({});
  const onHand = useMemo(() => Object.fromEntries(Object.entries(oh).map(([k, v]) => [k, Number(v) || 0])), [oh]);
  const P = useMemo(() => (br ? prepPlan(org, ops, { branchId: br, today: td, date, onHand }) : null), [org, ops, br, td, date, onHand]);
  if (!central) return <div className="card"><div className="empty"><Lock size={16} /> قائمة التحضير تُعدّ مركزيًا — الوصفات في المستند المركزي.</div></div>;
  const brName = (brs.find(b => b.id === br) || {}).name || '';
  const print = () => { if (!P || !P.preps.length) return;
    const rows = P.preps.map(r => `<tr><td><b>${esc(r.name)}</b><div style="font-size:10px;color:#555">${r.parts.map(x => esc(x.name) + ' ' + q(x.qty) + ' ' + esc(x.unit)).join(' · ')}</div></td>
      <td class="n">${q(r.need)} ${esc(r.unit)}</td><td class="n">${r.onHand ? q(r.onHand) : ''}</td><td class="n"><b>${q(r.make)} ${esc(r.unit)}</b></td><td class="n">${r.batches}</td><td></td></tr>`).join('');
    printA4(org, 'قائمة التحضير — ' + brName, arDate(date) + ' · المبيعات المتوقعة ' + money(P.f) + ' (المدى ' + money(P.lo) + ' – ' + money(P.hi) + ')',
      `<table><thead><tr><th>التحضيرة ومكوّنات ما يُحضَّر</th><th>الاحتياج</th><th>المتبقي</th><th>يُحضَّر</th><th>دفعات</th><th>تم ✓</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="font-size:10.5px;margin-top:8px">الكميات صافية بعد الطهي/التصفية حسب ناتج كل تحضيرة؛ المكوّنات بالكمية الخام. التوقع تقدير — عدّل حسب الحجوزات والمناسبات.</div>
      <div class="sign"><div>أعدّها</div><div>رئيس المطبخ</div><div>المراجعة</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); };
  const dates = Array.from({ length: 7 }, (_, k) => addD(td, k + 1));
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>قائمة التحضير اليومية</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>كم يُحضَّر من كل صلصة وتتبيلة وعجين — من توقع مبيعات الفرع ووصفات المنتجات</div></div>
        <button className="btn sm" onClick={print} disabled={!P || !P.preps.length}><Printer size={13} />طباعة للمطبخ</button>
      </div>
      <div className="rp-bar"><div className="rp-dates">
        <select className="inp sel" value={br} onChange={e => { setBr(e.target.value); setOh({}); }} aria-label="الفرع">{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select className="inp sel" value={date} onChange={e => setDate(e.target.value)} aria-label="اليوم">{dates.map(d => <option key={d} value={d}>{arDate(d)}{d === addD(td, 1) ? ' (غدًا)' : ''}</option>)}</select>
      </div></div>
      {P && P.notes.length > 0 && <div className="cf-notes">{P.notes.map((n, i) => <div key={i} className="cf-note warn"><span className="badge b-amber">تنبيه</span><span>{n}</span></div>)}</div>}
      {P && P.f != null && P.mix.days > 0 && <div className="grid g3">
        <Kpi label="المبيعات المتوقعة" value={money(P.f)} sub={'المدى ' + money(P.lo) + ' – ' + money(P.hi)} icon={ChefHat} color="#5B93C4" />
        <Kpi label="تحضيرات اليوم" value={String(P.preps.length)} sub={P.preps.filter(r => r.make > 0).length + ' تحتاج تحضيرًا'} icon={ChefHat} color="#C8A24A" />
        <Kpi label="مزيج الأصناف" value={P.mix.days + ' يومًا'} sub={'من مبيعات ' + money(P.mix.rev) + ' في آخر 28 يومًا'} icon={ChefHat} color="#4FB286" />
      </div>}
      {P && P.preps.length > 0 && <div className="card"><div className="pl-list">{P.preps.map(r => (
        <div key={r.id} className={'pl-row' + (r.make > 0 ? '' : ' done')}>
          <div className="pl-a"><b>{r.name}</b><small>الاحتياج <span className="num">{q(r.need)}</span> {r.unit} · المدى <span className="num">{q(r.needLo)}–{q(r.needHi)}</span></small>
            <small>{r.parts.map((x, i) => <span key={i}>{x.prep && '🥣 '}{x.name} <span className="num">{q(x.qty)}</span> {x.unit}{i < r.parts.length - 1 ? ' · ' : ''}</span>)}</small></div>
          <div className="pl-b">
            <label className="pl-oh">المتبقي <input className="inp n" inputMode="decimal" placeholder="0" aria-label={'المتبقي من ' + r.name} value={oh[r.id] || ''} onChange={e => setOh(o => ({ ...o, [r.id]: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) }))} /></label>
            <b className="num" dir="ltr">{q(r.make)} {r.unit}</b><small>{r.make > 0 ? r.batches + ' دفعة (الدفعة ' + q(r.batch) + ' ' + r.unit + ')' : 'المتبقي يكفي'}</small>
          </div></div>))}</div></div>}
      {P && P.products.length > 0 && <details className="card"><summary className="card-t" style={{ cursor: 'pointer' }}>الكميات المتوقعة للأصناف ({P.products.length})</summary>
        <div className="me-list" style={{ marginTop: 6 }}>{P.products.map(x => <div key={x.id} className="me-row"><span className="me-a"><b>{x.name}</b>{x.usesPrep && <small>يستخدم تحضيرات</small>}</span><span className="me-b"><b className="num">{x.qty}</b><small>المدى {x.lo}–{x.hi}</small></span></div>)}</div></details>}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف تُحسب؟</b> المبيعات المتوقعة للفرع في ذلك اليوم (من «توقع المبيعات» بيوم الأسبوع) × كمية كل صنف لكل ريال مبيعات في آخر 28 يومًا
        (على الأيام التي فيها مبيعات بالأصناف فقط: فواتير نقطة البيع أو مبيعات المنتجات المستوردة) × كمية التحضيرة في وصفته. يُطرح المتبقي الذي تدخله، والتحضيرة داخل تحضيرة تُحسب مما سيُحضَّر من الخارجية.
        المزيج يُفترض مستقرًا خلال الشهر — المناسبات والعروض لا يعرفها التوقع، فعدّل الكمية يدويًا عند الطباعة.</div>
    </div>);
}
