/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Store, Plus, Check } from 'lucide-react';
import { Field, money, uid } from '../../App.jsx';

export function PosQuickProducts({ org, commitOrg, say, canAdd }) {
  const all = org.products || []; const unpriced = all.filter(p => !(Number(p.sellPrice) > 0));
  const cats = [...new Set(all.map(p => p.cat).filter(Boolean))];
  const [f, setF] = useState({ name: '', price: '', cat: '' }); const [px, setPx] = useState({});
  const add = async () => {
    const pr = Number(f.price) || 0; if (!f.name.trim()) return say('اكتب اسم الصنف', 'no'); if (pr <= 0) return say('أدخل سعر البيع', 'no');
    if (all.some(p => (p.name || '').trim() === f.name.trim())) return say('يوجد صنف بنفس الاسم — سعّره من القائمة', 'no');
    const rec = { id: uid('pr'), name: f.name.trim(), sellPrice: pr, parts: [], cat: f.cat.trim() };
    const ok = await commitOrg(d => ({ ...d, products: [...(d.products || []), rec] }), { actionType: 'create', targetType: 'product', targetId: rec.id, need: 'edit', title: 'أضاف صنفًا من نقطة البيع', details: rec.name + ' · ' + money(pr) });
    if (ok) { setF({ name: '', price: '', cat: f.cat }); say('أُضيف «' + rec.name + '» ✓'); }
  };
  const price = async (p) => { const v = Number(px[p.id]) || 0; if (v <= 0) return say('أدخل السعر', 'no');
    const ok = await commitOrg(d => ({ ...d, products: (d.products || []).map(x => x.id === p.id ? { ...x, sellPrice: v } : x) }), { actionType: 'update', targetType: 'product', targetId: p.id, need: 'edit', title: 'سعّر صنفًا من نقطة البيع', details: p.name + ' · ' + money(v) });
    if (ok) say('سُعّر «' + p.name + '» ✓'); };
  const tax = (org.taxCfg || {}).enabled;
  return (
    <div className="card">
      <div className="card-t" style={{ marginBottom: 6 }}><Store size={15} color="var(--brass)" />أصناف نقطة البيع</div>
      <div className="note">نقطة البيع تعرض المنتجات التي لها <b>سعر بيع</b> من «المخزون ← الوصفات والتكلفة». {all.length ? <>لديك <b className="num">{all.length}</b> منتج، منها <b className="num">{unpriced.length}</b> بلا سعر بيع.</> : 'لا توجد منتجات بعد.'}{!canAdd && ' اطلب من مسؤول النظام إضافتها.'}</div>
      {canAdd && <>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'end', marginTop: 8 }}>
          <Field label="اسم الصنف" style={{ marginBottom: 0, flex: 2, minWidth: 150 }}><input className="inp" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Field>
          <Field label={'السعر' + (tax ? ' (شامل الضريبة)' : '')} style={{ marginBottom: 0, width: 120 }}><input className="inp n" inputMode="decimal" value={f.price} onChange={e => setF(x => ({ ...x, price: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          <Field label="التصنيف" style={{ marginBottom: 0, width: 140 }}><input className="inp" list="pq-cats" value={f.cat} placeholder="وجبات…" onChange={e => setF(x => ({ ...x, cat: e.target.value }))} /><datalist id="pq-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></Field>
          <button className="btn pri" onClick={add}><Plus size={14} />إضافة</button>
        </div>
        {unpriced.length > 0 && <><div className="lbl" style={{ marginTop: 10 }}>منتجات بلا سعر بيع</div>
          {unpriced.slice(0, 40).map(p => <div key={p.id} className="row" style={{ gap: 6, marginBottom: 5 }}><span style={{ flex: 1, fontSize: 12.5 }}>{p.name}</span>
            <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder="السعر" value={px[p.id] || ''} onChange={e => setPx(x => ({ ...x, [p.id]: e.target.value.replace(/[^\d.]/g, '') }))} />
            <button className="btn sm" onClick={() => price(p)}><Check size={12} />حفظ</button></div>)}</>}
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>الوصفة (المكوّنات) والتكلفة وخصم الصنف تُضبط لاحقًا من «المخزون ← الوصفات والتكلفة».</div>
      </>}
    </div>);
}
