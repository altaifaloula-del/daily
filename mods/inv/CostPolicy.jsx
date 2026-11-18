/* v49.3 — سياسة تكلفة المخزون: المتوسط المرجّح (الافتراضي والموصى) أو FIFO، مع مقارنة الطريقتين قبل أي تغيير */
import React, { useMemo, useState } from 'react';
import { Check, Scale } from 'lucide-react';
import { COST_METHODS, costMethod, costCompare, ROLES, money, today } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };

export function CostPolicy({ org, ops, me, commitOrg, say }) {
  const cur = costMethod(org), canSet = !!(ROLES[me?.role] || {}).admin;
  const [sel, setSel] = useState(cur);
  const [cmp, setCmp] = useState(false);
  const [per, setPer] = useState({ from: addD(today(), -89), to: today() });
  const C = useMemo(() => cmp ? costCompare(org, ops, per) : null, [cmp, org, ops, per.from, per.to]);   // eslint-disable-line
  const save = async () => {
    if (sel === cur) return;
    const t = COST_METHODS[sel].ar;
    if (!window.confirm('اعتماد «' + t + '» سياسةً لتكلفة المخزون؟\nتُعاد قيود الصرف والهدر والتسويات وتكلفة المبيعات بالطريقة الجديدة لكل الأشهر غير المقفلة؛ والأشهر المقفلة لا تتغير (يُرفض التغيير إن مسّها).\nيُنصح بتطبيقها من بداية سنة مالية والإفصاح عنها (IAS 8).')) return;
    const ok = await commitOrg(o => ({ ...o, costCfg: { ...(o.costCfg || {}), method: sel, since: new Date().toISOString(), by: me?.name || '' } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'costCfg', need: 'edit', title: 'غيّر سياسة تكلفة المخزون إلى ' + t, details: COST_METHODS[cur].ar + ' ⇢ ' + t });
    if (ok) say('اعتُمدت ' + t + ' ✓'); else setSel(cur);
  };
  return (
    <div className="card" data-costpolicy>
      <div className="card-h"><div className="card-t"><Scale size={15} color="var(--brass)" />سياسة تكلفة المخزون</div>
        <span className={'badge ' + (cur === 'avg' ? 'b-mint' : 'b-sky')}>الحالية: {COST_METHODS[cur].ar}</span></div>
      <div className="grid g2" style={{ gap: 10 }}>
        {Object.entries(COST_METHODS).map(([k, m]) => <label key={k} className="note" data-method={k} style={{ margin: 0, cursor: canSet ? 'pointer' : 'default', borderColor: sel === k ? 'var(--brass)' : undefined, borderWidth: m.rec ? 2 : 1, borderStyle: 'solid' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="radio" name="costm" aria-label={m.ar} checked={sel === k} disabled={!canSet} onChange={() => setSel(k)} />
            <b style={{ fontSize: m.rec ? 15 : 13 }}>{m.ar}</b>{m.rec && <span className="badge b-mint">الافتراضي · موصى به</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>{m.desc}</div>
        </label>)}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8, lineHeight: 1.8 }}>
        الوارد أخيرًا يصرف أولًا (LIFO) غير مسموح وفق المعايير الدولية المعتمدة في المملكة (IAS 2) فلا يُعرض. والتكلفة المعيارية (تكلفة الوصفة) متاحة للتحليل في «هندسة القائمة» و«الربحية» ولا تُقيَّد في الدفاتر.
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn sm" onClick={() => setCmp(x => !x)} data-costcmp>{cmp ? 'إخفاء المقارنة' : 'مقارنة الطريقتين'}</button>
        {cmp && <><input type="date" className="inp" style={{ width: 150 }} aria-label="مقارنة من" value={per.from} onChange={e => setPer(x => ({ ...x, from: e.target.value }))} /><input type="date" className="inp" style={{ width: 150 }} aria-label="مقارنة إلى" value={per.to} onChange={e => setPer(x => ({ ...x, to: e.target.value }))} /></>}
        {canSet && sel !== cur && <button className="btn sm pri" onClick={save} style={{ marginInlineStart: 'auto' }}><Check size={13} />اعتماد {COST_METHODS[sel].ar}</button>}
      </div>
      {C && <div style={{ marginTop: 10 }} data-costcmptable>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 6 }}>
          <span>قيمة المخزون: المتوسط <b className="num">{money(C.tot.avgV)}</b> · FIFO <b className="num">{money(C.tot.fifoV)}</b></span>
          <span>تكلفة الصادر في الفترة: المتوسط <b className="num">{money(C.tot.avgOut)}</b> · FIFO <b className="num">{money(C.tot.fifoOut)}</b></span>
          <span>أثر التحويل على الربح: <b className="num" style={{ color: C.tot.avgOut - C.tot.fifoOut >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(Math.round((C.tot.avgOut - C.tot.fifoOut) * 100) / 100)}</b></span>
        </div>
        <div className="tw"><table className="tb"><thead><tr><th>الصنف</th><th>الرصيد</th><th>وحدة (متوسط)</th><th>وحدة (FIFO)</th><th>القيمة (متوسط)</th><th>القيمة (FIFO)</th><th>الصادر (متوسط)</th><th>الصادر (FIFO)</th></tr></thead><tbody>
          {C.rows.map(r => <tr key={r.itemId}><td>{r.name}</td><td className="num">{r.qty} {r.unit}</td><td className="num">{money(r.avgU)}</td><td className="num">{money(r.fifoU)}</td><td className="num">{money(r.avgV)}</td><td className="num">{money(r.fifoV)}</td><td className="num">{money(r.avgOut)}</td><td className="num">{money(r.fifoOut)}</td></tr>)}
          {!C.rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--faint)' }}>لا أرصدة ولا صادر في الفترة</td></tr>}
        </tbody></table></div>
      </div>}
    </div>
  );
}
