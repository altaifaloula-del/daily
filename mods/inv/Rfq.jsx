/* v49.2 — MQ-024: طلبات عروض الأسعار (RFQ): إنشاء الطلب لعدة موردين، طباعته، إدخال العروض، المقارنة، والترسية إلى أوامر شراء */
import React, { useState } from 'react';
import { Plus, Printer, Check, X, FileText } from 'lucide-react';
import { RFQ_ST, rfqNextNo, rfqCompare, rfqToPOs, ROLES, Modal, Field, ItemPick, _xe, money, nowISO, printA4, today, uid, signoff, sigFailMsg } from '../../App.jsx';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const supName = (org, id) => ((org.suppliers || []).find(s => s.id === id) || {}).name || id;

export function Rfq({ org, ops, me, commit, say }) {
  const canW = ROLES[me?.role]?.scope === 'all';
  const list = ops.rfqs || [];
  const [ed, setEd] = useState(null);       // نموذج طلب جديد
  const [openId, setOpenId] = useState(''); // الطلب المعروض
  const [qEd, setQEd] = useState(null);     // إدخال عرض مورد
  const cur = list.find(x => x.id === openId) || null;

  const newRfq = () => setEd({ title: '', due: '', lines: [{ key: uid('rl'), itemId: '', desc: '', unit: '', qty: '' }], suppliers: [] });
  const saveRfq = async () => {
    const lines = ed.lines.filter(l => (l.itemId || String(l.desc).trim()) && Number(l.qty) > 0).map(l => ({ key: l.key, ...(l.itemId ? { itemId: l.itemId } : {}), desc: String(l.desc).trim(), unit: l.unit || '', qty: r2(l.qty) }));
    if (!lines.length) return say('أضف صنفًا واحدًا على الأقل بكمية', 'no');
    if (ed.suppliers.length < 2) return say('اختر موردَين على الأقل للمقارنة', 'no');
    const rec = { id: uid('rfq'), no: rfqNextNo(ops), date: today(), ...(ed.due ? { due: ed.due } : {}), title: String(ed.title || '').trim(), lines, suppliers: ed.suppliers, quotes: {}, status: 'open', by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, rfqs: [rec, ...(d.rfqs || [])] }), { actionType: 'create', targetType: 'rfq', targetId: rec.id, title: 'أنشأ طلب عروض أسعار', details: rec.no + ' · ' + lines.length + ' صنف · ' + rec.suppliers.length + ' موردين' });
    if (ok) { setEd(null); setOpenId(rec.id); say('أُنشئ ' + rec.no + ' ✓ — اطبعه وأرسله للموردين ثم أدخل عروضهم'); }
  };
  const printRfq = (r, sid) => {
    const rows = r.lines.map((l, i) => `<tr><td class="n">${i + 1}</td><td>${_xe(l.desc)}</td><td>${_xe(l.unit || '')}</td><td class="n">${l.qty}</td><td></td><td></td></tr>`).join('');
    printA4(org, 'طلب عرض أسعار ' + r.no, (sid ? 'إلى: ' + supName(org, sid) + ' · ' : '') + 'التاريخ ' + r.date + (r.due ? ' · آخر موعد للرد ' + r.due : ''),
      (r.title ? `<p>${_xe(r.title)}</p>` : '') + `<table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <p>نرجو تزويدنا بالأسعار شاملة الضريبة، ومدة التوريد، وصلاحية العرض، وشروط الدفع.</p>`);
  };
  const saveQuote = async () => {
    const q = qEd, lines = {};
    cur.lines.forEach(l => { const v = q.lines[l.key] || {}; if (v.na) lines[l.key] = { na: true }; else if (Number(v.price) > 0) lines[l.key] = { price: r2(v.price) }; });
    if (!Object.keys(lines).length) return say('أدخل سعرًا واحدًا على الأقل أو علّم «غير متوفر»', 'no');
    const rec = { at: nowISO(), by: me.name, lines, ...(q.delivDays !== '' && q.delivDays != null ? { delivDays: Number(q.delivDays) || 0 } : {}), ...(q.validTo ? { validTo: q.validTo } : {}), ...(String(q.terms || '').trim() ? { terms: String(q.terms).trim() } : {}) };
    const ok = await commit(d => ({ ...d, rfqs: (d.rfqs || []).map(x => x.id === cur.id && x.status === 'open' ? { ...x, quotes: { ...(x.quotes || {}), [q.sid]: rec } } : x) }),
      { actionType: 'update', targetType: 'rfq', targetId: cur.id, title: 'أدخل عرض مورد', details: cur.no + ' · ' + supName(org, q.sid) });
    if (ok) { setQEd(null); say('حُفظ عرض ' + supName(org, q.sid) + ' ✓'); }
  };
  const award = async (mode, sid) => {
    const R = rfqToPOs(org, ops, cur, mode, sid, me);
    if (R.err) return say(R.err, 'no');
    if (!window.confirm('إنشاء ' + R.pos.length + ' أمر شراء من ' + cur.no + '؟\n' + R.pos.map(p => p.poNo + ' · ' + p.supplierName + ' · ' + money(p.lines.reduce((a, l) => a + l.qty * l.price, 0))).join('\n'))) return;
    for (const p of R.pos) if (p.status === 'pending') { const sg = await signoff('po', 'submit', p, { branchId: '', alert: false }); if (!sg.ok) return say(sigFailMsg(sg, 'أمر الشراء'), 'no'); if (sg.id) p.sigSubmit = sg.id; }
    const ok = await commit(d => ({ ...d, purchaseOrders: [...R.pos, ...(d.purchaseOrders || [])], rfqs: (d.rfqs || []).map(x => x.id === cur.id ? { ...x, status: 'awarded', award: { mode, ...(sid ? { supplierId: sid } : {}), at: nowISO(), by: me.name, poIds: R.pos.map(p => p.id), poNos: R.pos.map(p => p.poNo) } } : x) }),
      { actionType: 'create', targetType: 'purchase_order', targetId: R.pos.map(p => p.id).join(','), title: 'ترسية طلب عروض أسعار', details: cur.no + ' ⇢ ' + R.pos.map(p => p.poNo + ' (' + p.supplierName + ')').join('، ') });
    if (ok) say('أُرسي ' + cur.no + ' ⇢ ' + R.pos.map(p => p.poNo).join('، ') + ' ✓' + (R.pos.some(p => p.status === 'pending') ? ' — بعضها بانتظار الاعتماد' : ''));
  };
  const cancel = async () => {
    const why = (window.prompt('سبب إلغاء ' + cur.no + ':') || '').trim(); if (!why) return;
    await commit(d => ({ ...d, rfqs: (d.rfqs || []).map(x => x.id === cur.id ? { ...x, status: 'cancelled', cancelReason: why, cancelledBy: me.name, cancelledAt: nowISO() } : x) }), { actionType: 'update', targetType: 'rfq', targetId: cur.id, title: 'ألغى طلب عروض أسعار', details: cur.no + ' · ' + why });
  };

  const C = cur ? rfqCompare(org, ops, cur) : null;
  return (
    <div className="grid" style={{ gap: 14 }} data-rfq>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div><b style={{ fontSize: 16 }}>طلبات عروض الأسعار</b><div style={{ fontSize: 12, color: 'var(--dim)' }}>اطلب الأسعار من عدة موردين، قارنها صنفًا صنفًا، ثم حوّل الأفضل إلى أوامر شراء.</div></div>
        {canW && <button className="btn pri" onClick={newRfq}><Plus size={14} />طلب جديد</button>}
      </div>
      <div className="card"><div className="tw"><table className="tb"><thead><tr><th>الرقم</th><th>الموضوع</th><th>الأصناف</th><th>العروض</th><th>الحالة</th></tr></thead><tbody>
        {list.length ? list.map(r => <tr key={r.id} style={{ cursor: 'pointer', background: r.id === openId ? 'var(--ink3)' : undefined }} onClick={() => setOpenId(r.id)} data-rfqrow={r.no}>
          <td className="num">{r.no}<div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{r.date}{r.due ? ' · حتى ' + r.due : ''}</div></td><td>{r.title || '—'}</td><td className="num">{r.lines.length}</td>
          <td className="num">{Object.keys(r.quotes || {}).length}/{r.suppliers.length}</td><td><span className={'badge ' + RFQ_ST[r.status].c}>{RFQ_ST[r.status].ar}</span>{r.award && r.award.poNos ? <div style={{ fontSize: 10.5 }}>{r.award.poNos.join('، ')}</div> : null}</td></tr>)
          : <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--faint)', padding: 18 }}>لا طلبات بعد</td></tr>}
      </tbody></table></div></div>

      {cur && C && <div className="card" data-rfqview>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <b>{cur.no}{cur.title ? ' — ' + cur.title : ''} <span className={'badge ' + RFQ_ST[cur.status].c}>{RFQ_ST[cur.status].ar}</span></b>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => printRfq(cur)}><Printer size={13} />طباعة الطلب</button>
            {canW && cur.status === 'open' && <button className="btn sm gh" onClick={cancel}><X size={13} />إلغاء</button>}
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{cur.suppliers.map(sid => { const q = (cur.quotes || {})[sid];
          return <button key={sid} className={'btn sm' + (q ? '' : ' gh')} disabled={!canW || cur.status !== 'open'} data-quote={supName(org, sid)}
            onClick={() => setQEd({ sid, lines: JSON.parse(JSON.stringify((q && q.lines) || {})), delivDays: q && q.delivDays != null ? String(q.delivDays) : '', validTo: (q && q.validTo) || '', terms: (q && q.terms) || '' })}>
            {q ? <Check size={13} /> : <FileText size={13} />}{supName(org, sid)}{q ? '' : ' — أدخل العرض'}</button>; })}</div>
        {C.bySup.length > 0 ? <>
          <div className="tw"><table className="tb" data-rfqcmp><thead><tr><th>الصنف</th><th>الكمية</th>{cur.suppliers.filter(id => (cur.quotes || {})[id]).map(id => <th key={id}>{supName(org, id)}</th>)}<th>آخر سعر شراء</th><th>الأفضل</th></tr></thead><tbody>
            {C.rows.map(r => <tr key={r.key}><td>{r.desc}</td><td className="num">{r.qty} {r.unit}</td>
              {cur.suppliers.filter(id => (cur.quotes || {})[id]).map(id => { const o = r.offers.find(x => x.supplierId === id); const na = ((cur.quotes[id].lines || {})[r.key] || {}).na;
                return <td key={id} className="num" style={o && r.best && r.best.supplierId === id ? { color: 'var(--mint)', fontWeight: 800 } : {}}>{o ? money(o.price) : na ? 'غير متوفر' : '—'}</td>; })}
              <td className="num">{r.last != null ? money(r.last) : '—'}</td>
              <td>{r.best ? <>{supName(org, r.best.supplierId)} <b className="num">{money(r.bestTotal)}</b>{r.vsLast != null && <small className="num" style={{ color: r.vsLast <= 0 ? 'var(--mint)' : 'var(--rose)', marginInlineStart: 4 }}>{r.vsLast > 0 ? '+' : ''}{r.vsLast}%</small>}</> : <span className="badge b-rose">بلا عرض</span>}</td></tr>)}
          </tbody></table></div>
          <div className="tw" style={{ marginTop: 10 }}><table className="tb" data-rfqsup><thead><tr><th>المورد</th><th>الإجمالي</th><th>التغطية</th><th>الأفضل في</th><th>التوريد</th><th>الصلاحية</th><th /></tr></thead><tbody>
            {C.bySup.map(s => <tr key={s.supplierId}><td>{s.name}{s.terms ? <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{s.terms}</div> : null}</td><td className="num"><b>{money(s.total)}</b></td>
              <td>{s.full ? <span className="badge b-mint">كامل</span> : <span className="badge b-amber">{s.covered}/{cur.lines.length}</span>}</td><td className="num">{s.wins}</td><td className="num">{s.delivDays != null ? s.delivDays + ' يوم' : '—'}</td><td className="num">{s.validTo || '—'}</td>
              <td>{canW && cur.status === 'open' && s.full && <button className="btn sm" onClick={() => award('one', s.supplierId)}>ترسية كاملة</button>}</td></tr>)}
          </tbody></table></div>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <div style={{ fontSize: 12.5 }}>الأفضل لكل صنف: <b className="num">{money(C.splitTotal)}</b>{C.saving != null && C.saving > 0 && <> · يوفر <b className="num" style={{ color: 'var(--mint)' }}>{money(C.saving)}</b> عن أفضل عرض كامل ({supName(org, C.bestFull.supplierId)})</>}{C.unquoted > 0 && <span style={{ color: 'var(--rose)' }}> · {C.unquoted} صنف بلا عرض</span>}</div>
            {canW && cur.status === 'open' && <button className="btn pri" disabled={C.unquoted > 0} onClick={() => award('split')}>ترسية الأفضل لكل صنف</button>}
          </div>
        </> : <div className="note">لم يُدخل أي عرض بعد. اطبع الطلب وأرسله للموردين، ثم اضغط اسم المورد لإدخال أسعاره.</div>}
      </div>}

      {ed && <Modal title="طلب عروض أسعار جديد" icon={FileText} wide onClose={() => setEd(null)} foot={<><button className="btn gh" onClick={() => setEd(null)}>إلغاء</button><button className="btn pri" onClick={saveRfq}><Check size={14} />إنشاء الطلب</button></>}>
        <div className="grid g2" style={{ gap: 10 }}>
          <Field label="الموضوع"><input className="inp" aria-label="موضوع الطلب" value={ed.title} onChange={e => setEd(x => ({ ...x, title: e.target.value }))} placeholder="مثال: مواد غذائية الربع الأول" /></Field>
          <Field label="آخر موعد للرد"><input type="date" className="inp" value={ed.due} onChange={e => setEd(x => ({ ...x, due: e.target.value }))} /></Field>
        </div>
        <div className="lbl" style={{ marginTop: 8 }}>الأصناف</div>
        {ed.lines.map((l, i) => { const up = (p) => setEd(x => ({ ...x, lines: x.lines.map((y, k) => k === i ? { ...y, ...p } : y) }));
          return <div key={l.key} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 220, flex: 1 }}><ItemPick items={org.items || []} value={l.itemId} onChange={(id) => { const it = (org.items || []).find(x => x.id === id) || {}; up({ itemId: id, desc: it.name || l.desc, unit: it.purchaseUnit || it.unit || '' }); }} label={'صنف ' + (i + 1)} /></div>
            <input className="inp" style={{ width: 160 }} aria-label={'وصف ' + (i + 1)} placeholder="أو وصف حر" value={l.desc} onChange={e => up({ desc: e.target.value, ...(l.itemId ? {} : {}) })} />
            <input className="inp n" style={{ width: 80 }} inputMode="decimal" aria-label={'كمية ' + (i + 1)} placeholder="الكمية" value={l.qty} onChange={e => up({ qty: e.target.value.replace(/[^\d.]/g, '') })} />
            {ed.lines.length > 1 && <button className="btn sm gh" onClick={() => setEd(x => ({ ...x, lines: x.lines.filter((_, k) => k !== i) }))}><X size={13} /></button>}
          </div>; })}
        <button className="btn sm" onClick={() => setEd(x => ({ ...x, lines: [...x.lines, { key: uid('rl'), itemId: '', desc: '', unit: '', qty: '' }] }))}><Plus size={13} />صنف</button>
        <div className="lbl" style={{ marginTop: 10 }}>الموردون (اثنان على الأقل)</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>{(org.suppliers || []).filter(s => s.isActive !== false).map(s => <label key={s.id} className="row" style={{ gap: 5, fontSize: 12.5 }}>
          <input type="checkbox" aria-label={'مورد ' + s.name} checked={ed.suppliers.includes(s.id)} onChange={e => setEd(x => ({ ...x, suppliers: e.target.checked ? [...x.suppliers, s.id] : x.suppliers.filter(y => y !== s.id) }))} />{s.name}</label>)}</div>
      </Modal>}

      {qEd && cur && <Modal title={'عرض ' + supName(org, qEd.sid) + ' — ' + cur.no} icon={FileText} onClose={() => setQEd(null)} foot={<><button className="btn gh" onClick={() => setQEd(null)}>إلغاء</button><button className="btn pri" onClick={saveQuote}><Check size={14} />حفظ العرض</button></>}>
        {cur.lines.map(l => { const v = qEd.lines[l.key] || {}; const up = (p) => setQEd(x => ({ ...x, lines: { ...x.lines, [l.key]: { ...(x.lines[l.key] || {}), ...p } } }));
          return <div key={l.key} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, minWidth: 140 }}>{l.desc} <small className="num">× {l.qty} {l.unit}</small></span>
            <input className="inp n" style={{ width: 100 }} inputMode="decimal" aria-label={'سعر ' + l.desc} placeholder="سعر الوحدة" disabled={!!v.na} value={v.price ?? ''} onChange={e => up({ price: e.target.value.replace(/[^\d.]/g, '') })} />
            <label className="row" style={{ gap: 4, fontSize: 12 }}><input type="checkbox" checked={!!v.na} onChange={e => up({ na: e.target.checked })} />غير متوفر</label></div>; })}
        <div className="grid g3" style={{ gap: 8, marginTop: 8 }}>
          <Field label="مدة التوريد (يوم)"><input className="inp n" inputMode="numeric" aria-label="مدة التوريد" value={qEd.delivDays} onChange={e => setQEd(x => ({ ...x, delivDays: e.target.value.replace(/[^\d]/g, '') }))} /></Field>
          <Field label="صلاحية العرض حتى"><input type="date" className="inp" value={qEd.validTo} onChange={e => setQEd(x => ({ ...x, validTo: e.target.value }))} /></Field>
          <Field label="شروط الدفع"><input className="inp" aria-label="شروط الدفع" value={qEd.terms} onChange={e => setQEd(x => ({ ...x, terms: e.target.value }))} placeholder="نقدًا / آجل 30 يومًا" /></Field>
        </div>
      </Modal>}
    </div>
  );
}
