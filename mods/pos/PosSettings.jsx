/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Settings, Trash2, Plus, Check } from 'lucide-react';
import { Field, POS_DEV_KEY, uid } from '../../App.jsx';

export function PosSettings({ org, commitOrg, say, dev }) {
  const c = org.posCfg || {};
  const [f, setF] = useState({ branches: c.branches || [], footer: c.footer || '', autoPrint: c.autoPrint !== false, devName: dev ? dev.name : '', maxDiscPct: c.maxDiscPct != null ? String(c.maxDiscPct) : '', payMethods: (c.payMethods || []).map(x => ({ ...x })) });
  const KIND_AR = { card: 'شبكة', cash: 'نقدي', transfer: 'تحويل' };
  const setPm = (i, patch) => setF(x => ({ ...x, payMethods: x.payMethods.map((y, k) => k === i ? { ...y, ...patch } : y) }));
  const save = async () => {
    if (dev && f.devName.trim()) { try { localStorage.setItem(POS_DEV_KEY, JSON.stringify({ ...dev, name: f.devName.trim() })); } catch { } }
    const ok = await commitOrg(d => ({ ...d, posCfg: { ...(d.posCfg || {}), branches: f.branches, footer: f.footer.trim(), autoPrint: !!f.autoPrint, maxDiscPct: Number(f.maxDiscPct) || 0, payMethods: f.payMethods.filter(x => (x.n || '').trim()).map(x => ({ id: x.id, n: x.n.trim(), kind: x.kind || 'card', active: x.active !== false })) } }), { actionType: 'update', targetType: 'settings', targetId: 'posCfg', need: 'edit', title: 'إعدادات نقطة البيع', details: 'الفروع: ' + f.branches.map(id => ((org.branches || []).find(b => b.id === id) || {}).name).join('، ') });
    if (ok) say('حُفظت إعدادات نقطة البيع ✓');
  };
  return (
    <div className="card">
      <div className="card-t" style={{ marginBottom: 8 }}><Settings size={15} color="var(--brass)" />إعدادات نقطة البيع</div>
      <div className="lbl">الفروع المفعّلة (التجربة)</div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', margin: '4px 0 10px' }}>{(org.branches || []).filter(b => b.isActive !== false).map(b => <label key={b.id} className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={f.branches.includes(b.id)} onChange={e => setF(x => ({ ...x, branches: e.target.checked ? [...x.branches, b.id] : x.branches.filter(i => i !== b.id) }))} />{b.name}</label>)}</div>
      <div className="grid g2">
        <Field label="عبارة أسفل الفاتورة"><input className="inp" value={f.footer} placeholder="رقم خدمة العملاء، رابط التقييم…" onChange={e => setF(x => ({ ...x, footer: e.target.value }))} /></Field>
        <Field label="أقصى خصم يدوي للكاشير % (فارغ = بلا حد)"><input className="inp n" inputMode="decimal" value={f.maxDiscPct} placeholder="مثال: 10" onChange={e => setF(x => ({ ...x, maxDiscPct: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
        {dev && <Field label={'اسم هذا الجهاز (' + dev.tag + ')'}><input className="inp" value={f.devName} placeholder="كاشير 1" onChange={e => setF(x => ({ ...x, devName: e.target.value }))} /></Field>}
      </div>
      <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px' }}><input type="checkbox" checked={f.autoPrint} onChange={e => setF(x => ({ ...x, autoPrint: e.target.checked }))} />طباعة الفاتورة تلقائيًا بعد الدفع</label>
      <div className="lbl">طرق دفع إضافية (تمارا، تابي، STC Pay، قسائم…)</div>
      <div className="note" style={{ marginBottom: 6 }}>تظهر في شاشة الدفع وفي أزرار السلة. اختر كيف تُحتسب في الإغلاق اليومي والقيود: «شبكة» للمحافظ والتقسيط والبطاقات، «تحويل» للتحويل البنكي، «نقدي» لما يدخل الدرج.</div>
      {f.payMethods.map((pm, i) => <div key={pm.id} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" style={{ flex: 2, minWidth: 130 }} value={pm.n} placeholder="اسم طريقة الدفع" onChange={e => setPm(i, { n: e.target.value })} />
        <select className="sel" style={{ flex: 1, minWidth: 120 }} value={pm.kind || 'card'} onChange={e => setPm(i, { kind: e.target.value })}>{Object.entries(KIND_AR).map(([k, t]) => <option key={k} value={k}>تُحتسب: {t}</option>)}</select>
        <label className="row" style={{ gap: 5, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={pm.active !== false} onChange={e => setPm(i, { active: e.target.checked })} />مفعّلة</label>
        <button className="btn sm gh" onClick={() => setF(x => ({ ...x, payMethods: x.payMethods.filter((_, k) => k !== i) }))}><Trash2 size={12} color="#D9544D" /></button>
      </div>)}
      <button className="btn sm" style={{ marginBottom: 10 }} onClick={() => setF(x => ({ ...x, payMethods: [...x.payMethods, { id: uid('pm'), n: '', kind: 'card', active: true }] }))}><Plus size={13} />إضافة طريقة دفع</button>
      <div />
      <button className="btn pri" onClick={save}><Check size={14} />حفظ</button>
      <div className="note" style={{ marginTop: 8 }}>المنتجات وأسعارها وتصنيفاتها من «المخزون ← الوصفات والتكلفة». الرقم الضريبي واسم المنشأة من الإعدادات. الطابعة: اختر الطابعة الحرارية من نافذة الطباعة (على الآيباد عبر AirPrint).</div>
    </div>);
}
