/* v39.0 — «الشراء من التوقع»: كم أطلب من كل صنف لكل مستودع حتى الاستلام القادم
   المحرك في النواة (purchasePlan). الأوامر المنشأة تمر بحد اعتماد المشتريات كأي أمر شراء. */
import React, { useMemo, useState } from 'react';
import { TrendingUp, Truck, Plus, Download, Info, PackageCheck } from 'lucide-react';
import { Kpi, ROLES, arDate, makeXlsx, money, nowISO, purchasePlan, today, uid } from '../../App.jsx';

const SRC = { actual: ['b-mint', 'استهلاك فعلي'], recipe: ['b-sky', 'من الوصفات'], none: ['b-dim', 'حد الأمان'] };
const q = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });

export function ForecastPurchase({ org, ops, me, commit, say }) {
  const pc = org.purchaseCfg || {};
  const [cover, setCover] = useState(Number(pc.planCover) || 7);
  const [lead, setLead] = useState(pc.planLead != null ? String(pc.planLead) : '');
  const P = useMemo(() => purchasePlan(org, ops, { cover, lead: Number(lead) || 0 }), [org, ops, cover, lead]);
  const [pid, setPid] = useState(null);
  const pool = P.pools.find(p => p.id === pid) || P.pools.find(p => p.toOrder) || P.pools[0];
  const [ov, setOv] = useState({});   // تعديل الكمية المقترحة (بوحدة الشراء)
  const [noSup, setNoSup] = useState((org.suppliers || [])[0]?.id || '');
  const canW = ROLES[me?.role]?.scope === 'all' || !!ROLES[me?.role]?.costCtl;
  if (!pool) return null;
  const qtyPU = (r) => { const k = pool.id + '|' + r.id; return ov[k] != null && ov[k] !== '' ? Math.max(0, Math.round(Number(ov[k]) || 0)) : r.suggestPU; };
  const lines = pool.rows.filter(r => qtyPU(r) > 0);
  const value = Math.round(lines.reduce((s, r) => s + qtyPU(r) * r.factor * r.cost, 0) * 100) / 100;
  const bySup = {}; lines.forEach(r => { const k = r.supplierId || noSup || ''; (bySup[k] = bySup[k] || []).push(r); });

  const createPOs = async () => {
    const lim = Number(pc.approvalLimit) || 0;
    const sups = Object.entries(bySup).filter(([k]) => k);
    if (!sups.length) return say('اختر موردًا للأصناف التي بلا مورد سابق', 'no');
    let mx = 0; (ops.purchaseOrders || []).forEach(x => { const m = /(\d+)$/.exec(x.poNo || ''); if (m) mx = Math.max(mx, +m[1]); });
    const br = (org.warehouses || []).find(w => w.id === pool.id);
    const recs = sups.map(([sid, rs], i) => { const sp = (org.suppliers || []).find(s => s.id === sid) || { id: sid, name: rs[0].supplierName || '' };
      const ls = rs.map(r => ({ desc: r.name, itemId: r.id, qty: qtyPU(r), price: Math.round(r.cost * r.factor * 10000) / 10000, received: 0, ...(r.factor > 1 ? { factor: r.factor, uomName: r.purchaseUnit } : {}) }));
      const tot = ls.reduce((s, l) => s + l.qty * l.price, 0);
      return { id: uid('po'), poNo: 'PO-' + String(mx + 1 + i).padStart(4, '0'), supplierId: sp.id, supplierName: sp.name, branchId: (br && br.kind === 'branch' && br.branchId) || '',
        note: 'من التوقع — ' + pool.name + ' · تغطية ' + P.cover + ' أيام' + (P.lead ? ' + توريد ' + P.lead : ''), lines: ls, status: lim > 0 && tot > lim ? 'pending' : 'open', by: me.name, at: nowISO(), date: today(), fromPlan: true }; });
    const ok = await commit(d => ({ ...d, purchaseOrders: [...recs, ...(d.purchaseOrders || [])] }), { actionType: 'create', targetType: 'purchase_order', targetId: recs.map(r => r.id).join(','), title: 'أنشأ أوامر شراء من التوقع', details: recs.map(r => r.poNo + ' · ' + r.supplierName).join('، ') });
    if (ok !== false) { setOv({}); const pend = recs.filter(r => r.status === 'pending').length; say('أُنشئ ' + recs.length + ' أمر شراء ✓' + (pend ? ' — ' + pend + ' بانتظار الاعتماد (فوق حد ' + money(lim) + ')' : '')); }
  };
  const exportX = () => { try { const head = ['الصنف', 'الوحدة', 'المصدر', 'استهلاك 28 يومًا', 'الاحتياج المتوقع', 'الاحتياج (حد أعلى)', 'حد الأمان', 'الرصيد', 'مطلوب لم يُستلم', 'المقترح', 'بوحدة الشراء', 'التكلفة', 'القيمة', 'المورد'];
    const body = pool.rows.map(r => [r.name, r.unit, SRC[r.src][1], r.use28, r.need, r.needHi, r.safety, r.stock, r.onOrder, qtyPU(r) * r.factor, qtyPU(r) + ' ' + (r.purchaseUnit || r.unit), r.cost, Math.round(qtyPU(r) * r.factor * r.cost * 100) / 100, r.supplierName]);
    const blob = makeXlsx([{ name: 'الشراء من التوقع', rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'الشراء_من_التوقع_' + pool.name + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل (Excel) ✓'); } catch { say('تعذّر توليد Excel', 'no'); } };

  return (
    <div className="card pp">
      <div className="card-h"><div className="card-t"><TrendingUp size={15} color="var(--brass)" />الشراء من التوقع — حتى الاستلام القادم</div>
        <button className="btn sm" onClick={exportX}><Download size={13} />Excel</button></div>
      <div className="pp-ctl">
        {P.pools.length > 1 && <select className="inp sel" value={pool.id} onChange={e => setPid(e.target.value)}>{P.pools.map(p => <option key={p.id} value={p.id}>{p.name}{p.toOrder ? ' (' + p.toOrder + ')' : ''}</option>)}</select>}
        <div className="pp-seg">{[3, 7, 14].map(d => <button key={d} className={'btn sm' + (cover === d ? ' pri' : ' gh')} onClick={() => setCover(d)}>تغطية {d} أيام</button>)}</div>
        <label className="pp-lead">مدة التوريد <input className="inp n" inputMode="numeric" value={lead} placeholder="0" onChange={e => setLead(e.target.value.replace(/\D/g, '').slice(0, 2))} /> يوم</label>
      </div>
      <div className="grid g3" style={{ marginTop: 10 }}>
        <Kpi label={'المبيعات المتوقعة (' + P.days + ' أيام)'} value={money(pool.revN)} sub={pool.revLo !== pool.revHi ? 'المدى ' + money(pool.revLo) + ' – ' + money(pool.revHi) : 'بمتوسط المبيعات'} icon={TrendingUp} color="#5B93C4" />
        <Kpi label="أصناف للطلب" value={String(lines.length)} sub={pool.rows.length + ' صنف بحساب استهلاك'} icon={PackageCheck} color={lines.length ? '#E0A458' : '#4FB286'} />
        <Kpi label="قيمة الطلب المقترح" value={money(value)} sub="بآخر سعر شراء مستلم" icon={Truck} color="#C8A24A" />
      </div>
      {pool.notes.length > 0 && <div className="cf-notes" style={{ marginTop: 10 }}>{pool.notes.map((n, i) => <div key={i} className={'cf-note ' + n.sev}><span className={'badge ' + (n.sev === 'warn' ? 'b-amber' : 'b-dim')}>{n.sev === 'warn' ? 'تنبيه' : 'معلومة'}</span><span>{n.msg}</span></div>)}</div>}
      {!pool.rows.length ? <div className="empty">لا أصناف باستهلاك مسجّل أو حد أمان في {pool.name}.</div> : <div className="pp-list">
        {pool.rows.map(r => { const k = pool.id + '|' + r.id, pu = qtyPU(r); return (
          <div key={r.id} className={'pp-row' + (pu > 0 ? ' go' : '')}>
            <div className="pp-h"><b>{r.name}</b><span className={'badge ' + SRC[r.src][0]}>{SRC[r.src][1]}</span>{r.cover != null && <span className={'badge ' + (r.cover < P.days ? 'b-rose' : 'b-dim')}>يكفي {r.cover} يومًا</span>}</div>
            <div className="pp-m">
              <span>الرصيد <b className="num">{q(r.stock)}</b></span>
              {r.onOrder > 0 && <span>مطلوب لم يُستلم <b className="num">{q(r.onOrder)}</b></span>}
              <span>الاحتياج <b className="num">{q(r.need)}</b>{r.needHi > r.need ? <small> · حتى <span className="num">{q(r.needHi)}</span></small> : null}</span>
              {r.safety > 0 && <span>حد الأمان <b className="num">{q(r.safety)}</b></span>}
              <span className="pp-u">{r.unit}</span>
            </div>
            <div className="pp-o">
              <span className="pp-sup">{r.supplierName || <i>بلا مورد سابق</i>}{r.cost ? ' · ' + money(r.cost) + '/' + (r.unit || 'وحدة') : ''}</span>
              <span className="pp-q">{canW ? <input className="inp n" inputMode="numeric" aria-label={'كمية ' + r.name} value={ov[k] != null ? ov[k] : String(r.suggestPU)} onChange={e => setOv(o => ({ ...o, [k]: e.target.value.replace(/\D/g, '').slice(0, 5) }))} /> : <b className="num">{pu}</b>}
                <small>{r.purchaseUnit && r.factor > 1 ? r.purchaseUnit + ' = ' + q(pu * r.factor) + ' ' + r.unit : r.unit}</small></span>
            </div>
          </div>); })}
      </div>}
      {canW && lines.length > 0 && <div className="pp-go">
        {lines.some(r => !r.supplierId) && <label className="pp-lead">للأصناف بلا مورد سابق: <select className="inp sel" value={noSup} onChange={e => setNoSup(e.target.value)}><option value="">— اختر —</option>{(org.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <button className="btn pri" onClick={createPOs}><Plus size={14} />إنشاء {Object.keys(bySup).filter(Boolean).length || ''} أمر شراء ({money(value)})</button>
      </div>}
      <div className="note" style={{ marginTop: 10 }}><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف يُحسب؟</b> معدل استهلاك كل صنف لكل ريال مبيعات في آخر 28 يومًا (ما صُرف للمطبخ وما هُدر؛ أو من الوصفات إن لم تُسجَّل حركات صرف)
        × المبيعات المتوقعة للفروع التي يخدمها المستودع خلال مدة التوريد وأيام التغطية — ثم يُضاف حد الأمان (الحد الأدنى للصنف) ويُطرح الرصيد والكميات المطلوبة ولم تُستلم، ويُقرَّب لوحدة الشراء.
        الأوامر تُنشأ لكل مورد بآخر سعر شراء مستلم، وتمر بحد اعتماد المشتريات. المناسبات لا يعرفها التوقع — عدّل الكمية يدويًا. آخر تحديث {arDate(P.today)}.</div>
    </div>);
}
