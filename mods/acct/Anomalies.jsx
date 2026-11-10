/* v38.6 — شاشة «الأنماط الشاذة» في مركز التحليل: ما خرج عن النمط المعتاد للفروع والموردين والكاشيرية
   المحرك في النواة (detectAnomalies) — إحصاء مقاوم للقيم المتطرفة، يعمل داخل المتصفح بلا تكلفة. */
import React, { useMemo, useState } from 'react';
import { Activity, TrendingDown, TrendingUp, Receipt, Trash2, Truck, CreditCard, Info, Scale } from 'lucide-react';
import { Kpi, actionFromAnomaly, anomKey, detectAnomalies, money } from '../../App.jsx';
import { ListChecks } from 'lucide-react';

const AREA = {
  sales: { ar: 'المبيعات', icon: TrendingDown, c: '#D9544D' },
  expense: { ar: 'المصروفات', icon: Receipt, c: '#E0A458' },
  waste: { ar: 'الهدر', icon: Trash2, c: '#C8A24A' },
  price: { ar: 'أسعار الموردين', icon: Truck, c: '#5B93C4' },
  pos: { ar: 'نقطة البيع', icon: CreditCard, c: '#9A7CC4' },
  usage: { ar: 'الاستهلاك مقابل النظري', icon: Scale, c: '#C8A24A' }   // v39.3
};

// منحنى صغير: الأسابيع السابقة رمادية والقيمة الحالية ملوّنة، وخط الوسيط المعتاد متقطع
function Spark({ s, expected, up }) {
  if (!s || s.length < 2) return null;
  const W = 120, H = 34, max = Math.max(...s, expected || 0) || 1, min = Math.min(...s, expected || 0, 0);
  const x = (i) => 2 + i * (W - 4) / (s.length - 1), y = (v) => H - 3 - (v - min) / (max - min || 1) * (H - 6);
  const pts = s.map((v, i) => x(i) + ',' + y(v)).join(' ');
  return (
    <svg className="an-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {expected != null && <line x1="0" x2={W} y1={y(expected)} y2={y(expected)} stroke="currentColor" strokeOpacity=".35" strokeDasharray="3 3" />}
      <polyline points={pts} fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
      <circle cx={x(s.length - 1)} cy={y(s[s.length - 1])} r="3.5" fill={up ? '#E0A458' : '#D9544D'} />
    </svg>);
}

export function Anomalies({ org, ops, me, myBranches, commit, say }) {
  // v38.7 — تحويل النمط إلى إجراء (مرة واحدة لكل نمط ما دام إجراؤه قائمًا)
  const openActs = new Map((ops.actions || []).filter(x => x.srcKey && x.status !== 'dismissed').map(x => [x.srcKey, x]));
  const toAction = async (a) => { const rec = actionFromAnomaly(org, ops, me, a);
    const ok = await commit(d => ((d.actions || []).some(x => x.srcKey === rec.srcKey && x.status !== 'dismissed') ? d : { ...d, actions: [rec, ...(d.actions || [])] }),
      { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'حوّل نمطًا شاذًا إلى إجراء', details: rec.title });
    if (ok) say('أُنشئ إجراء ✓ — حدّد مسؤوله وموعده من «الإجراءات والتوصيات»'); };
  const [area, setArea] = useState('');
  const [br, setBr] = useState('');
  const list = useMemo(() => detectAnomalies(org, ops, { branchIds: (myBranches || []).map(b => b.id) }), [org, ops, myBranches]);
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
  const shown = list.filter(a => (!area || a.area === area) && (!br || a.branchId === br));
  const by = (k) => list.filter(a => a.area === k).length;
  const brs = [...new Set(list.map(a => a.branchId).filter(Boolean))];
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Kpi label="أنماط شاذة" value={String(list.length)} sub={list.filter(a => a.sev === 'high').length + ' حادة'} icon={Activity} color={list.length ? '#D9544D' : '#4FB286'} />
        <Kpi label="المبيعات" value={String(by('sales'))} sub="مقابل اليوم نفسه من الأسبوع" icon={TrendingDown} color="#D9544D" />
        <Kpi label="المصروفات والهدر والاستهلاك" value={String(by('expense') + by('waste') + by('usage'))} sub="مقابل المعتاد والوصفات" icon={Receipt} color="#E0A458" />
        <Kpi label="الموردون والكاشيرية" value={String(by('price') + by('pos'))} sub="أسعار، إلغاءات، خصومات يدوية" icon={Truck} color="#5B93C4" />
      </div>
      <div className="card">
        <div className="card-h"><div className="card-t"><Activity size={15} color="var(--brass)" />ما خرج عن النمط المعتاد</div></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className={'btn sm' + (!area ? ' pri' : ' gh')} onClick={() => setArea('')}>الكل ({list.length})</button>
          {Object.entries(AREA).filter(([k]) => by(k)).map(([k, v]) => <button key={k} className={'btn sm' + (area === k ? ' pri' : ' gh')} onClick={() => setArea(k)}>{v.ar} ({by(k)})</button>)}
          {brs.length > 1 && <select className="inp sel" style={{ maxWidth: 200 }} value={br} onChange={e => setBr(e.target.value)}><option value="">كل الفروع</option>{brs.map(b => <option key={b} value={b}>{brName(b)}</option>)}</select>}
        </div>
        {!shown.length ? <div className="empty">{list.length ? 'لا شيء في هذا التصنيف.' : 'لا أنماط شاذة — كل الأرقام ضمن نمطها المعتاد ✓'}</div> : <div className="an-list">
          {shown.map(a => { const A = AREA[a.area] || AREA.sales; const I = a.pct > 0 && a.area === 'sales' ? TrendingUp : A.icon; return (
            <div key={a.id} className={'an-item ' + a.sev}>
              <span className="an-ic" style={{ color: A.c }}><I size={16} /></span>
              <div className="an-body">
                <div className="an-h"><b>{a.title}</b><span className={'badge ' + (a.sev === 'high' ? 'b-rose' : 'b-amber')}>{a.sev === 'high' ? 'حاد' : 'متابعة'}</span></div>
                <div className="an-msg">{a.msg}</div>
                <div className="an-meta"><span className="badge b-dim">{A.ar}</span>{a.branchId ? <span className="badge b-dim">{brName(a.branchId)}</span> : null}
                  {a.area !== 'pos' && <span className="num an-pct" dir="ltr" style={{ color: a.pct < 0 ? 'var(--rose)' : 'var(--amber)' }}>{a.pct > 0 ? '+' : ''}{a.pct}%</span>}
                  <span className="an-sp"><Spark s={a.series} expected={a.expected} up={a.pct > 0} /></span></div>
                <div>{openActs.get(anomKey(a)) ? <span className="badge b-sky">له إجراء — {({ open: 'مفتوح', doing: 'قيد التنفيذ', done: 'منجز' })[openActs.get(anomKey(a)).status] || ''}{openActs.get(anomKey(a)).assignee ? ' · ' + openActs.get(anomKey(a)).assignee : ''}</span>
                  : commit ? <button className="btn sm gh" onClick={() => toAction(a)}><ListChecks size={12} />حوّل إلى إجراء</button> : null}</div>
              </div>
            </div>); })}
        </div>}
      </div>
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>كيف يُحسب؟</b> كل رقم يُقارن بنمطه المعتاد بالوسيط (لا المتوسط) فلا يشوّه يوم استثنائي واحد الحكم:
        المبيعات بكل يوم من آخر 7 أيام مقابل اليوم نفسه من الأسبوع في الأسابيع الثمانية السابقة (يلزم 4 أسابيع على الأقل) — هبوط 30% فأكثر أو ارتفاع 60% فأكثر وخارج التذبذب المعتاد؛
        المصروفات (لكل تصنيف) والهدر بمجموع الأسبوع مقابل وسيط الأسابيع الثمانية — ضعفه فأكثر؛ أسعار الموردين بآخر شراء مقابل وسيط ما قبله — 10% فأكثر أو ثلاث زيادات متتالية؛
        الكاشيرية بنسبة الإلغاء والخصم اليدوي مقابل الزملاء في 14 يومًا. والاستهلاك لكل مستودع في 14 يومًا: ما خرج فعلًا (صرف للمطبخ + هدر) مقابل ما تقتضيه الوصفات للمبيعات — يُنبَّه حين تزيد الأصناف 10% فأكثر وبقيمة 150 ريالًا فأكثر (فاقد غير مسجّل أو وصفة غير دقيقة). الأنماط الحادة تصل أيضًا في التنبيهات والإشعارات. هذه مؤشرات للمراجعة لا أحكام.</div>
    </div>);
}
