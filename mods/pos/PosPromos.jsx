/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Lightbulb, Check } from 'lucide-react';
import { DAYS_AR, Field, Modal, PROMO_IDEAS, PROMO_T, money, nowISO, promoActive, promoDesc, uid, normPhone, promoMarginCheck, mktCanApprove, mktCfg } from '../../App.jsx';

export function PosPromos({ org, ops, me, commitOrg, say }) {
  const canApp = mktCanApprove(me); const appPct = Number(mktCfg(org).approveDiscPct) || 0;   // v48.1 الضوابط المالية
  const list = org.posPromos || []; const prods = (org.products || []).filter(p => !p.posOff);
  const cats = [...new Set(prods.map(p => p.cat || 'أخرى'))]; const brs = (org.branches || []).filter(b => b.isActive !== false);
  const [f, setF] = useState(null);
  const blank = { name: '', type: 'pct', value: '', x: '', y: '', mode: 'pct', minTotal: '', scope: 'all', cats: [], items: [], code: '', from: '', to: '', days: [], tFrom: '', tTo: '', branches: [], active: true };
  const tog = (k, v) => setF(x => ({ ...x, [k]: (x[k] || []).includes(v) ? x[k].filter(y => y !== v) : [...(x[k] || []), v] }));
  const save = async () => {
    if (!f.name.trim()) return say('اكتب اسم العرض', 'no');
    const v = Number(f.value) || 0;
    if (f.type === 'bxgy' ? !(Number(f.x) >= 1 && Number(f.y) >= 1) : v <= 0) return say(f.type === 'bxgy' ? 'حدّد X و Y' : 'أدخل قيمة العرض', 'no');
    if ((f.type === 'pct' || (f.type === 'order' && f.mode !== 'amt')) && v > 100) return say('النسبة لا تتجاوز 100%', 'no');
    if (f.type !== 'order' && f.scope === 'items' && !(f.items || []).length) return say('اختر الأصناف المشمولة', 'no');
    if (f.type !== 'order' && f.scope === 'cats' && !(f.cats || []).length) return say('اختر التصنيفات المشمولة', 'no');
    if (f.from && f.to && f.to < f.from) return say('تاريخ النهاية قبل البداية', 'no');
    if (f.code && list.some(x => x.id !== f.id && x.code && x.code.trim().toLowerCase() === f.code.trim().toLowerCase())) return say('رمز الكوبون مستخدم في عرض آخر', 'no');
    // v48.1 — الضوابط المالية قبل التفعيل: لا هامش سالب، وما فوق حد الخصم ينتظر الاعتماد
    const MC = promoMarginCheck(org, ops || {}, { ...f, value: v, x: Number(f.x) || 0, y: Number(f.y) || 0, minTotal: Number(f.minTotal) || 0 });
    if (MC.neg.length) return say('العرض يجعل هامش «' + MC.neg.slice(0, 3).map(r => r.name).join('، ') + '» سالبًا — عدّل الخصم أو استثنِ الصنف', 'no');
    if (f.custPhone && normPhone(f.custPhone).length < 9) return say('جوال العميل المحدد غير صحيح', 'no');
    if (Number(f.perCust) > 0 && !f.code) return say('حد الاستخدام لكل عميل يتطلب رمز كوبون', 'no');
    if (Number(f.maxUses) > 0 && !f.code) return say('حد الاستخدام الكلي يتطلب رمز كوبون', 'no');
    const needApp = appPct > 0 && MC.maxPct != null && MC.maxPct > appPct + 0.001 && !canApp;
    const { q: _q, ...f0 } = f;
    const ctl = { maxUses: Number(f.maxUses) || 0, perCust: Number(f.perCust) || 0, maxDisc: Number(f.maxDisc) || 0, custPhone: f.custPhone ? normPhone(f.custPhone) : '', firstOnly: !!f.firstOnly, loyOnly: !!f.loyOnly, exclude: f.exclude || [],
      ...(needApp ? { pending: true, pendBy: (me || {}).name || '', pendPct: Math.round(MC.maxPct * 10) / 10 } : { pending: false }), ...(MC.incomplete.length ? { marginIncomplete: MC.incomplete.length } : {}) };
    const rec = { ...f0, ...ctl, id: f.id || uid('pm'), name: f.name.trim(), value: v, x: Number(f.x) || 0, y: Number(f.y) || 0, minTotal: Number(f.minTotal) || 0, code: (f.code || '').trim(), scope: f.type === 'order' ? 'all' : f.scope, by: f.by || '', at: f.at || nowISO() };
    const ok = await commitOrg(d => ({ ...d, posPromos: f.id ? (d.posPromos || []).map(x => x.id === f.id ? rec : x) : [...(d.posPromos || []), rec] }), { actionType: f.id ? 'update' : 'create', targetType: 'settings', targetId: rec.id, need: 'edit', title: f.id ? 'عدّل عرضًا ترويجيًا' : 'أضاف عرضًا ترويجيًا', details: rec.name + ' · ' + promoDesc(rec) });
    if (ok) { setF(null); say(needApp ? 'حُفظ العرض بانتظار الاعتماد — الخصم ' + Math.round(MC.maxPct) + '% يتجاوز الحد ' + appPct + '%' : 'حُفظ العرض ✓'); }
  };
  const approve = (pr) => { if (!canApp) return say('الاعتماد لمن له صلاحية الاعتماد', 'no');
    commitOrg(d => ({ ...d, posPromos: (d.posPromos || []).map(x => x.id === pr.id ? { ...x, pending: false, apprBy: (me || {}).name || '', apprAt: nowISO() } : x) }), { actionType: 'approve', targetType: 'settings', targetId: pr.id, need: 'edit', title: 'اعتمد عرضًا/كوبونًا', details: pr.name + ' · ' + (pr.pendPct || '') + '%' }).then(ok => ok && say('اعتُمد العرض ✓')); };
  const setActive = (pr, a) => commitOrg(d => ({ ...d, posPromos: (d.posPromos || []).map(x => x.id === pr.id ? { ...x, active: a } : x) }), { actionType: 'update', targetType: 'settings', targetId: pr.id, need: 'edit', title: a ? 'فعّل عرضًا' : 'أوقف عرضًا', details: pr.name });
  const del = (pr) => { if (window.confirm('حذف العرض «' + pr.name + '»؟ الفواتير السابقة تحتفظ باسمه وقيمته.')) commitOrg(d => ({ ...d, posPromos: (d.posPromos || []).filter(x => x.id !== pr.id) }), { actionType: 'delete', targetType: 'settings', targetId: pr.id, need: 'edit', title: 'حذف عرضًا', details: pr.name }); };
  const now = new Date();
  const when = (pr) => [pr.from || pr.to ? (pr.from || '…') + ' ← ' + (pr.to || '…') : '', (pr.days || []).length ? pr.days.map(d => DAYS_AR[d]).join('، ') : '', pr.tFrom && pr.tTo ? pr.tFrom + '–' + pr.tTo : ''].filter(Boolean).join(' · ') || 'دائم';
  const scopeTxt = (pr) => pr.type === 'order' ? 'الفاتورة' : pr.scope === 'items' ? (pr.items || []).map(id => (prods.find(p => p.id === id) || {}).name).filter(Boolean).join('، ') : pr.scope === 'cats' ? (pr.cats || []).join('، ') : 'كل الأصناف';
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}><div className="card-t"><Sparkles size={15} color="var(--brass)" />العروض والخصومات</div><button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setF({ ...blank })}><Plus size={13} />عرض جديد</button></div>
        <div className="note">يُطبَّق تلقائيًا في نقطة البيع <b>أفضل عرض واحد لكل صنف</b> (لا تتراكب العروض على الصنف نفسه)، ثم أفضل عرض على الفاتورة. خصم صنف بعينه يُضبط أيضًا من بطاقة الصنف (المخزون ← الوصفات والتكلفة). الخصم يُخصم من الإيراد قبل الضريبة في القيود.</div>
        <div className="tw" style={{ marginTop: 8 }}><table className="tb"><thead><tr><th>العرض</th><th>النوع</th><th>يشمل</th><th>المدة</th><th>الحالة</th><th></th></tr></thead><tbody>
          {list.map(pr => { const on = promoActive(pr, now, ''); return (
            <tr key={pr.id} style={pr.active === false ? { opacity: .55 } : undefined}><td><b>{pr.name}</b>{pr.code && <div><span className="badge b-dim">كوبون: {pr.code}</span></div>}</td>
              <td style={{ fontSize: 12 }}>{PROMO_T[pr.type]}<div className="num" style={{ color: 'var(--brass)' }}>{promoDesc(pr)}</div></td>
              <td style={{ fontSize: 11.5 }}>{scopeTxt(pr)}{(pr.branches || []).length ? <div style={{ color: 'var(--faint)' }}>{pr.branches.map(id => (brs.find(b => b.id === id) || {}).name).join('، ')}</div> : null}</td>
              <td style={{ fontSize: 11.5 }}>{when(pr)}</td>
              <td>{pr.pending ? <span className="badge b-amber" data-promopend>بانتظار الاعتماد</span> : pr.active === false ? <span className="badge b-dim">موقوف</span> : on ? <span className="badge b-mint">فعّال الآن</span> : <span className="badge b-amber">مجدول</span>}
                {(pr.maxUses > 0 || pr.perCust > 0 || pr.custPhone || pr.firstOnly || pr.loyOnly || pr.maxDisc > 0) && <div style={{ fontSize: 10, color: 'var(--faint)' }}>{[pr.maxUses > 0 && 'حد ' + pr.maxUses, pr.perCust > 0 && pr.perCust + '/عميل', pr.maxDisc > 0 && 'سقف ' + money(pr.maxDisc), pr.custPhone && 'لعميل محدد', pr.firstOnly && 'أول شراء', pr.loyOnly && 'أعضاء الولاء'].filter(Boolean).join(' · ')}</div>}
                {pr.pending && canApp && <button className="btn sm pri" style={{ marginTop: 4 }} data-promoapprove onClick={() => approve(pr)}>اعتماد</button>}</td>
              <td><div className="row" style={{ gap: 4 }}><button className="btn sm gh" onClick={() => setF({ ...blank, ...pr, value: String(pr.value || ''), x: String(pr.x || ''), y: String(pr.y || ''), minTotal: String(pr.minTotal || '') })}>تعديل</button>
                <button className="btn sm gh" onClick={() => setActive(pr, pr.active === false)}>{pr.active === false ? 'تفعيل' : 'إيقاف'}</button><button className="btn sm gh" onClick={() => del(pr)}><Trash2 size={12} color="#D9544D" /></button></div></td></tr>); })}
          {!list.length && <tr><td colSpan={6}><div className="empty">لا عروض بعد — ابدأ من الأفكار أدناه.</div></td></tr>}
        </tbody></table></div>
      </div>
      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><Lightbulb size={15} color="var(--brass)" />أفكار ترويجية جاهزة</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{PROMO_IDEAS.map(x => <button key={x.k} className="btn" style={{ flexDirection: 'column', alignItems: 'flex-start', minWidth: 170 }} onClick={() => setF({ ...blank, ...x.f })}><b>{x.k}</b><span style={{ fontSize: 11, color: 'var(--dim)' }}>{x.d}</span></button>)}</div>
        <div className="note" style={{ marginTop: 8 }}>مقترحات أخرى: نقاط الولاء (من تبويب «الولاء») لتكرار الزيارة، كوبونات للحملات لقياس أثرها (تظهر في التقارير باسم العرض)، عروض الأوقات الهادئة بدل الخصم الدائم، وتقييم العرض من «الورديات والتقارير» بمقارنة المبيعات والخصم الممنوح.</div>
      </div>
      {f && <Modal title={f.id ? 'تعديل عرض' : 'عرض جديد'} icon={Sparkles} onClose={() => setF(null)} wide foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save}><Check size={14} />حفظ العرض</button></>}>
        <div className="grid g2">
          <Field label="اسم العرض (يظهر في الفاتورة والتقارير)"><input className="inp" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Field>
          <Field label="نوع العرض"><select className="sel" value={f.type} onChange={e => setF(x => ({ ...x, type: e.target.value }))}>{Object.entries(PROMO_T).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {f.type === 'bxgy' ? <><Field label="اشترِ (X)"><input className="inp n" inputMode="numeric" value={f.x} onChange={e => setF(x => ({ ...x, x: e.target.value.replace(/\D/g, '') }))} /></Field>
            <Field label="واحصل مجانًا على (Y)"><input className="inp n" inputMode="numeric" value={f.y} onChange={e => setF(x => ({ ...x, y: e.target.value.replace(/\D/g, '') }))} /></Field></>
            : <Field label={f.type === 'pct' ? 'النسبة %' : f.type === 'amt' ? 'المبلغ المخصوم من كل وحدة' : f.type === 'price' ? 'السعر الخاص للوحدة (شامل الضريبة)' : f.mode === 'amt' ? 'المبلغ المخصوم من الفاتورة' : 'النسبة % من الفاتورة'}>
              <div className="row" style={{ gap: 4 }}><input className="inp n" style={{ flex: 1 }} inputMode="decimal" value={f.value} onChange={e => setF(x => ({ ...x, value: e.target.value.replace(/[^\d.]/g, '') }))} />
                {f.type === 'order' && <><button type="button" className={'btn sm' + (f.mode !== 'amt' ? ' pri' : ' gh')} onClick={() => setF(x => ({ ...x, mode: 'pct' }))}>%</button><button type="button" className={'btn sm' + (f.mode === 'amt' ? ' pri' : ' gh')} onClick={() => setF(x => ({ ...x, mode: 'amt' }))}>ر.س</button></>}</div></Field>}
          {f.type === 'order' && <Field label="حد أدنى للفاتورة (ر.س)"><input className="inp n" inputMode="decimal" value={f.minTotal} onChange={e => setF(x => ({ ...x, minTotal: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>}
          <Field label="رمز كوبون (اختياري — يُطبَّق فقط عند إدخاله)"><input className="inp" value={f.code} placeholder="مثال: RAMADAN" onChange={e => setF(x => ({ ...x, code: e.target.value.toUpperCase() }))} /></Field>
        </div>
        {f.type !== 'order' && <><div className="lbl">يشمل</div>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>{[['all', 'كل الأصناف'], ['cats', 'تصنيفات (مجموعات)'], ['items', 'أصناف محددة']].map(([k, t]) => <button key={k} type="button" className={'btn sm' + (f.scope === k ? ' pri' : ' gh')} onClick={() => setF(x => ({ ...x, scope: k }))}>{t}</button>)}</div>
          {f.scope !== 'all' && !prods.length && <div className="note" style={{ marginBottom: 8 }}>لا توجد منتجات بعد، فلا تظهر أصناف ولا مجموعات. أضفها من «المخزون والمنتجات ← الوصفات والتكلفة ← منتج جديد» (اكتب «تصنيف نقطة البيع» مثل وجبات/مشروبات ليصبح مجموعة)، أو من «نقطة البيع ← البيع ← إضافة/تسعير أصناف».</div>}
          {f.scope === 'cats' && !!prods.length && cats.length === 1 && cats[0] === 'أخرى' && <div className="note" style={{ marginBottom: 8 }}>منتجاتك بلا تصنيف، فكلها في مجموعة «أخرى». لإنشاء مجموعات اكتب «تصنيف نقطة البيع» في بطاقة كل منتج (المخزون ← الوصفات والتكلفة).</div>}
          {f.scope === 'cats' && <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>{cats.map(c => <label key={c} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={(f.cats || []).includes(c)} onChange={() => tog('cats', c)} />{c}</label>)}</div>}
          {f.scope === 'items' && prods.length > 8 && <input className="inp" style={{ marginBottom: 6 }} placeholder="بحث عن صنف…" value={f.q || ''} onChange={e => setF(x => ({ ...x, q: e.target.value }))} />}
          {f.scope === 'items' && <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 8, maxHeight: 220, overflow: 'auto' }}>{prods.filter(p => !(f.q || '').trim() || (p.name || '').includes(f.q.trim())).map(p => <label key={p.id} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={(f.items || []).includes(p.id)} onChange={() => tog('items', p.id)} />{p.name} <span className="num" style={{ color: 'var(--faint)' }}>{money(p.sellPrice)}</span></label>)}</div>}</>}
        <div className="lbl">ضوابط الكوبون والعميل (اختياري)</div>
        <div className="grid g4">
          <Field label="حد الاستخدام الكلي"><input className="inp n" inputMode="numeric" aria-label="حد الاستخدام الكلي" value={f.maxUses || ''} onChange={e => setF(x => ({ ...x, maxUses: e.target.value.replace(/\D/g, '') }))} /></Field>
          <Field label="لكل عميل"><input className="inp n" inputMode="numeric" aria-label="حد لكل عميل" value={f.perCust || ''} onChange={e => setF(x => ({ ...x, perCust: e.target.value.replace(/\D/g, '') }))} /></Field>
          <Field label="سقف الخصم (ر.س)"><input className="inp n" inputMode="decimal" aria-label="سقف الخصم" value={f.maxDisc || ''} onChange={e => setF(x => ({ ...x, maxDisc: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          <Field label="لعميل محدد (جوال)"><input className="inp" inputMode="tel" aria-label="جوال العميل المحدد" value={f.custPhone || ''} onChange={e => setF(x => ({ ...x, custPhone: e.target.value }))} /></Field>
        </div>
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', margin: '2px 0 8px', fontSize: 12.5 }}>
          <label className="row" style={{ gap: 5 }}><input type="checkbox" aria-label="لأول شراء فقط" checked={!!f.firstOnly} onChange={e => setF(x => ({ ...x, firstOnly: e.target.checked }))} />لأول شراء فقط</label>
          <label className="row" style={{ gap: 5 }}><input type="checkbox" aria-label="لأعضاء الولاء فقط" checked={!!f.loyOnly} onChange={e => setF(x => ({ ...x, loyOnly: e.target.checked }))} />لأعضاء الولاء فقط</label>
          {f.type !== 'order' && f.scope !== 'items' && prods.length > 0 && <details><summary style={{ cursor: 'pointer' }}>استثناء أصناف ({(f.exclude || []).length})</summary><div className="row" style={{ gap: 8, flexWrap: 'wrap', maxHeight: 160, overflow: 'auto', marginTop: 6 }}>{prods.map(p => <label key={p.id} className="row" style={{ gap: 4 }}><input type="checkbox" checked={(f.exclude || []).includes(p.id)} onChange={() => tog('exclude', p.id)} />{p.name}</label>)}</div></details>}
        </div>
        {(() => { const v = Number(f.value) || 0; if (!(f.type === 'bxgy' ? Number(f.x) >= 1 && Number(f.y) >= 1 : v > 0)) return null;
          const MC = promoMarginCheck(org, ops || {}, { ...f, value: v, x: Number(f.x) || 0, y: Number(f.y) || 0, minTotal: Number(f.minTotal) || 0 }); const known = MC.rows.filter(r => r.cm != null);
          return <div className="card" style={{ padding: 10, marginBottom: 8 }} data-promomargin>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>فحص الهامش قبل التفعيل</div>
            <div style={{ fontSize: 12 }}>أقصى خصم متوقع: <b className="num">{MC.maxPct == null ? '—' : Math.round(MC.maxPct * 10) / 10 + '%'}</b>{appPct > 0 && MC.maxPct > appPct && <span className="badge b-amber" style={{ marginInlineStart: 6 }}>فوق حد {appPct}% — {canApp ? 'أنت معتمد' : 'يحتاج اعتمادًا'}</span>}</div>
            {MC.neg.length > 0 && <div style={{ color: 'var(--rose)', fontSize: 12 }} data-promoneg>هامش سالب: {MC.neg.map(r => r.name + ' (' + money(r.cm) + ')').join('، ')} — لا يُحفظ</div>}
            {known.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>أدنى هامش بعد الخصم: {known.slice().sort((a, b) => a.cm - b.cm).slice(0, 3).map(r => r.name + ' ' + money(r.cm) + (r.cmPct != null ? ' (' + r.cmPct + '%)' : '')).join(' · ')}</div>}
            {MC.incomplete.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--amber)' }}>الربحية غير مكتملة لـ {MC.incomplete.length} صنف (بلا وصفة أو تكلفة مكوّن)</div>}
          </div>; })()}
        <div className="lbl">الجدولة (اختياري)</div>
        <div className="grid g4">
          <Field label="من تاريخ"><input type="date" className="inp" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} /></Field>
          <Field label="إلى تاريخ"><input type="date" className="inp" value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} /></Field>
          <Field label="من الساعة"><input type="time" className="inp" value={f.tFrom} onChange={e => setF(x => ({ ...x, tFrom: e.target.value }))} /></Field>
          <Field label="إلى الساعة"><input type="time" className="inp" value={f.tTo} onChange={e => setF(x => ({ ...x, tTo: e.target.value }))} /></Field>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', margin: '4px 0 8px' }}><span className="lbl" style={{ margin: 0 }}>الأيام:</span>{DAYS_AR.map((d, i) => <label key={i} className="row" style={{ gap: 4, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={(f.days || []).includes(i)} onChange={() => tog('days', i)} />{d}</label>)}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}><span className="lbl" style={{ margin: 0 }}>الفروع (فارغ = الكل):</span>{brs.map(b => <label key={b.id} className="row" style={{ gap: 4, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={(f.branches || []).includes(b.id)} onChange={() => tog('branches', b.id)} />{b.name}</label>)}</div>
      </Modal>}
    </div>);
}
