/* v40.4 — «خطة التوفير» (المرحلة 3 من مركز إدارة المطعم)
   الفرص مقاسة من البيانات الفعلية (savingsOpps)؛ النسبة المستهدفة يُدخلها المستخدم لكل بند — لا نسب مفترضة.
   البند المعتمد يصير إجراءً (src: saving) يحمل أساسه، ويُقاس المتحقق بالمعيار نفسه بعد البدء (savingsTrack). */
import React, { useMemo, useState } from 'react';
import { PiggyBank, Info, Download, Plus, Lock, Target, CheckCircle2 } from 'lucide-react';
import { Kpi, ROLES, SAV_KIND, makeXlsx, money, newAction, savingsOpps, savingsTrack, today } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const mEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const KB = { waste: 'b-rose', usage: 'b-amber', price: 'b-sky', mdisc: 'b-dim' };
const ST = { open: ['b-amber', 'مفتوح'], doing: ['b-sky', 'قيد التنفيذ'], done: ['b-mint', 'منجز'] };

export function SavingsPlan({ org, ops, me, commit, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const td = today(), pm = addD(td.slice(0, 7) + '-01', -1).slice(0, 7);
  const [tab, setTab] = useState('opps');
  const [rng, setRng] = useState({ k: '30', from: addD(td, -30), to: addD(td, -1) });
  const [br, setBr] = useState('');
  const [pct, setPct] = useState({});
  const S = useMemo(() => savingsOpps(org, ops, { from: rng.from, to: rng.to, branchIds: br ? [br] : null }), [org, ops, rng, br]);
  const plan = useMemo(() => (ops.actions || []).filter(a => a.saving && a.status !== 'dismissed').map(a => ({ a, T: savingsTrack(org, ops, a.saving, td) })), [org, ops, td]);
  if (!central) return <div className="card"><div className="empty"><Lock size={16} /> خطة التوفير للإدارة المركزية — تجمع بيانات كل الفروع والمشتريات.</div></div>;
  const inPlan = new Set(plan.map(x => x.a.srcKey));
  const add = async (o) => { const v = Number(pct[o.key]); if (!(v > 0 && v <= 100)) return say('أدخل النسبة المستهدفة (1–100%) — النظام لا يفترضها', 'no');
    const k = 'saving|' + o.key, K = SAV_KIND[o.kind];
    const rec = newAction(me, { src: 'saving', srcKey: k, area: o.kind, branchId: o.branchId || '', due: addD(td, 30), title: 'خفض ' + K.ar + ' — ' + o.name + ' بنسبة ' + v + '%',
      detail: 'الأساس ' + money(o.per30) + ' لكل 30 يومًا (' + money(o.value) + ' في ' + S.days + ' يومًا من ' + S.from + ' إلى ' + S.to + ') · المستهدف ' + money(o.per30 * v / 100) + ' شهريًا' + (o.top.length ? ' · ' + o.top.join('، ') : ''),
      saving: { kind: o.kind, id: o.id, name: o.name, base30: o.per30, pct: v, start: td, from: S.from, to: S.to, ...(o.ref != null ? { ref: o.ref } : {}) } });
    const ok = await commit(d => ((d.actions || []).some(x => x.srcKey === k && x.status !== 'dismissed') ? d : { ...d, actions: [rec, ...(d.actions || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'أضاف بندًا لخطة التوفير', details: rec.title });
    if (ok !== false) say('أُضيف للخطة ✓ — حدّد مسؤوله من «الإجراءات والتوصيات»'); };
  const exportX = () => { try {
    const o = [['النوع', 'البند', 'القيمة في الفترة', 'لكل 30 يومًا', 'تفاصيل'], ...S.opps.map(x => [SAV_KIND[x.kind].ar, x.name, x.value, x.per30, x.top.join('، ')])];
    const p = [['البند', 'الحالة', 'البدء', 'الأساس/30 يومًا', 'المستهدف %', 'المستهدف/30 يومًا', 'الحالي/30 يومًا', 'المتحقق/30 يومًا'], ...plan.map(({ a, T }) => [a.title, (ST[a.status] || ['', a.status])[1], a.saving.start, a.saving.base30, a.saving.pct, T?.target30 ?? '', T?.now30 ?? '', T?.real30 ?? ''])];
    const blob = makeXlsx([{ name: 'فرص التوفير', rows: o }, { name: 'الخطة', rows: p }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'خطة_التوفير_' + td + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); } catch { say('تعذّر توليد Excel', 'no'); } };
  const tgt = plan.reduce((s, x) => s + (x.T?.target30 || 0), 0), real = plan.reduce((s, x) => s + (x.T && x.T.real30 != null ? x.T.real30 : 0), 0), meas = plan.filter(x => x.T && x.T.real30 != null).length;
  const periods = [['30', 'آخر 30 يومًا', addD(td, -30), addD(td, -1)], ['pm', 'الشهر السابق', pm + '-01', mEnd(pm)], ['90', 'آخر 90 يومًا', addD(td, -90), addD(td, -1)]];
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>خطة التوفير</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>فرص مقاسة من بياناتك ← هدف تحدده أنت ← إجراء بمسؤول وموعد ← قياس ما تحقق فعلًا</div></div>
        <div className="rp-seg"><button className="btn sm" onClick={exportX}><Download size={13} />Excel</button></div>
      </div>
      <div className="grid g3">
        <Kpi label="فرص مقاسة (لكل 30 يومًا)" value={money(S.tot30)} sub={S.opps.length + ' بند · ' + S.days + ' يومًا من البيانات'} icon={PiggyBank} color="#C8A24A" />
        <Kpi label="المستهدف في الخطة" value={money(tgt)} sub={plan.length + ' بند في الخطة'} icon={Target} color="#5B93C4" />
        <Kpi label="المتحقق فعلًا" value={meas ? money(real) : '—'} sub={meas ? 'لكل 30 يومًا · ' + meas + ' بند مقاس' : 'يُقاس بعد 7 أيام من بدء البند'} icon={CheckCircle2} color={meas && real >= tgt ? '#4FB286' : '#E0A458'} />
      </div>
      <div className="rp-seg"><button className={'btn sm' + (tab === 'opps' ? ' pri' : ' gh')} onClick={() => setTab('opps')}>الفرص ({S.opps.length})</button><button className={'btn sm' + (tab === 'plan' ? ' pri' : ' gh')} onClick={() => setTab('plan')}>الخطة ({plan.length})</button></div>
      {tab === 'opps' ? <>
        <div className="rp-bar"><div className="rp-seg">{periods.map(([k, l, f, t]) => <button key={k} className={'btn sm' + (rng.k === k ? ' pri' : ' gh')} onClick={() => setRng({ k, from: f, to: t })}>{l}</button>)}</div>
          <div className="rp-dates"><select className="inp sel" value={br} onChange={e => setBr(e.target.value)}><option value="">كل الفروع</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div></div>
        {!S.opps.length ? <div className="card"><div className="empty">لا فرص مقاسة في الفترة — تظهر الفرص من: الهدر المسجّل، الاستهلاك مقابل الوصفات، أوامر الشراء المستلمة، والخصومات اليدوية في نقطة البيع.</div></div> :
          <div className="card"><div className="sv-list">{S.opps.map(o => { const k = 'saving|' + o.key, v = Number(pct[o.key]); return (
            <div key={o.key} className="sv-row">
              <div className="sv-a"><span className="sv-h"><span className={'badge ' + KB[o.kind]}>{SAV_KIND[o.kind].ar}</span><b>{o.name}</b></span>
                <small>{money(o.value)} في {S.days} يومًا{o.pct != null ? ' · ' + o.pct + '% فوق النظري' : ''}{o.n ? ' · ' + o.n + ' فاتورة' : ''}</small>
                {o.top.length > 0 && <small>{o.top.join(' · ')}</small>}<small className="sv-hint">{SAV_KIND[o.kind].hint}</small></div>
              <div className="sv-b"><b className="num" dir="ltr">{money(o.per30)}</b><small>لكل 30 يومًا</small>
                {inPlan.has(k) ? <span className="badge b-sky">في الخطة</span> : commit ? <span className="sv-go">
                  <input className="inp n" inputMode="decimal" placeholder="%" aria-label={'النسبة المستهدفة — ' + o.name} value={pct[o.key] || ''} onChange={e => setPct(p => ({ ...p, [o.key]: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))} />
                  <button className="btn sm pri" onClick={() => add(o)}><Plus size={12} />للخطة</button></span> : null}
                {v > 0 && v <= 100 && !inPlan.has(k) && <small>= {money(o.per30 * v / 100)} شهريًا</small>}</div>
            </div>); })}</div></div>}
      </> : (!plan.length ? <div className="card"><div className="empty">الخطة فارغة — اختر من «الفرص» بندًا وحدّد نسبته المستهدفة.</div></div> :
        <div className="card"><div className="sv-list">{plan.map(({ a, T }) => { const s = a.saving; return (
          <div key={a.id} className="sv-row">
            <div className="sv-a"><span className="sv-h"><span className={'badge ' + KB[s.kind]}>{SAV_KIND[s.kind].ar}</span><b>{s.name}</b><span className={'badge ' + (ST[a.status] || ['b-dim'])[0]}>{(ST[a.status] || ['', a.status])[1]}</span></span>
              <small>بدأ {s.start} · الأساس {money(s.base30)} لكل 30 يومًا · الهدف −{s.pct}% = {money(T?.target30 || 0)}{a.assignee ? ' · المسؤول ' + a.assignee : ''}</small></div>
            <div className="sv-b">{!T ? null : T.pending ? <><b>—</b><small>يُقاس من {T.ready}</small></> : T.nodata ? <><b>—</b><small>لا بيانات بعد البدء ({T.days} يومًا)</small></> :
              <><b className={'num ' + (T.hit ? 'sv-ok' : T.real30 < 0 ? 'sv-bad' : '')} dir="ltr">{money(T.real30)}</b><small>متحقق/30 يومًا · الحالي {money(T.now30)} ({T.days} يومًا)</small>
                <span className={'badge ' + (T.hit ? 'b-mint' : T.real30 < 0 ? 'b-rose' : 'b-amber')}>{T.hit ? 'بلغ الهدف' : T.real30 < 0 ? 'زاد بدل أن ينخفض' : 'دون الهدف'}</span></>}</div>
          </div>); })}</div></div>)}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف تُقاس؟</b> كل فرصة قيمة فعلية من سجلاتك في الفترة، محوّلة لكل 30 يومًا: الهدر بمتوسط التكلفة؛ الاستهلاك فوق ما تقتضيه الوصفات للمبيعات؛
        فرق السعر = (سعر الشراء − أقل سعر دفعته للصنف نفسه خلال الفترة و90 يومًا قبلها) × الكمية المستلمة؛ والخصومات اليدوية غير الملغاة. النسبة المستهدفة تحددها أنت.
        المتحقق = الأساس − المعيار نفسه منذ بدء البند (لكل 30 يومًا، حتى 90 يومًا) — ويتأثر بتغيّر حجم المبيعات؛ وأقل سعر قد يختلف جودةً أو شروط دفع.</div>
    </div>);
}
