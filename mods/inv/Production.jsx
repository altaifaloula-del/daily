/* v42.8 — «أوامر الإنتاج»: تحويل الخامات إلى منتجات نصف مصنّعة (تحضيرات مخزّنة) في مستودع يُختار لكل أمر.
   المحرك في النواة (prodCheck / prodMoves). الإكمال يصرف الخامات = الوصفة × الكمية المنتجة فعلًا، ويُدخل الناتج مكلَّفًا بما استُهلك.
   الحالات: planned (مخطط) ← done (منجز) أو cancelled (ملغى). المخزون السالب ممنوع. */
import React, { useMemo, useState } from 'react';
import { Factory, Plus, Check, X, Printer } from 'lucide-react';
import { Field, Kpi, MAIN_WH, Modal, ROLES, arDate, money, nowISO, prodCheck, prodMoves, prepItemOf, printA4, today, uid, whName, whOf, whOn } from '../../App.jsx';

const q3 = (n) => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ST = { planned: ['b-amber', 'مخطط'], done: ['b-mint', 'منجز'], cancelled: ['b-dim', 'ملغى'] };

export function Production({ org, ops, me, commit, say }) {
  const R = ROLES[me?.role] || {};
  const canW = !!(R.admin || R.scope === 'all' || R.costCtl);
  const stocked = (org.preps || []).filter(p => prepItemOf(org, p.id));
  const whs = whOn(org) ? whOf(org) : [];
  const orders = (ops.prodOrders || []).slice().sort((a, b) => String(b.date + b.no).localeCompare(String(a.date + a.no)));
  const [newF, setNewF] = useState(null);
  const [doneF, setDoneF] = useState(null);
  const pName = (id) => ((org.preps || []).find(p => p.id === id) || {}).name || 'تحضيرة محذوفة';
  const pUnit = (id) => ((org.preps || []).find(p => p.id === id) || {}).unit || '';
  const C = useMemo(() => newF && newF.prepId && Number(newF.qty) > 0 ? prodCheck(org, ops, newF.prepId, Number(newF.qty), newF.whId) : null, [org, ops, newF]);
  const D = useMemo(() => doneF && Number(doneF.made) > 0 ? prodCheck(org, ops, doneF.o.prepId, Number(doneF.made), doneF.o.whId) : null, [org, ops, doneF]);

  const create = async () => {
    if (!C || C.err) return say(C ? C.err : 'اختر التحضيرة والكمية', 'no');
    const no = 'MO-' + today().replace(/-/g, '').slice(2) + '-' + String((ops.prodOrders || []).filter(o => o.date === today()).length + 1).padStart(2, '0');
    const rec = { id: uid('mo'), no, date: newF.date || today(), prepId: newF.prepId, planned: Math.round(Number(newF.qty) * 1000) / 1000, made: 0, whId: newF.whId || MAIN_WH, status: 'planned', note: newF.note || '', by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, prodOrders: [rec, ...(d.prodOrders || [])] }), { actionType: 'create', targetType: 'production_order', targetId: rec.id, title: 'أنشأ أمر إنتاج ' + no, details: pName(rec.prepId) + ' · ' + rec.planned + ' ' + pUnit(rec.prepId) });
    if (ok) { setNewF(null); say('أُنشئ أمر الإنتاج ' + no); }
  };
  const complete = async () => {
    const o = doneF.o, made = Math.round(Number(doneF.made) * 1000) / 1000;
    if (!(made > 0)) return say('أدخل الكمية المنتجة فعلًا', 'no');
    const P = prodMoves(org, ops, o, made, { by: me.name, date: doneF.date || today() });
    if (P.err) return say(P.err, 'no');
    let stale = false;   // أُكمل أو أُلغي من جهاز آخر في اللحظة نفسها ⇒ لا حركات مكررة
    const ok = await commit(d => {
      const cur = (d.prodOrders || []).find(x => x.id === o.id);
      if (!cur || cur.status !== 'planned') { stale = true; return d; }
      return { ...d, [P.col]: [...P.moves, ...(d[P.col] || [])], prodOrders: (d.prodOrders || []).map(x => x.id === o.id ? { ...x, status: 'done', made, cost: P.cost, unitCost: P.unitCost, doneBy: me.name, doneAt: nowISO(), doneDate: doneF.date || today() } : x) };
    }, { actionType: 'update', targetType: 'production_order', targetId: o.id, title: 'أكمل أمر إنتاج ' + o.no, details: pName(o.prepId) + ' · ' + made + ' ' + pUnit(o.prepId) + ' · ' + money(P.cost) });
    if (stale) { setDoneF(null); return say('الأمر لم يعد مخططًا (أُكمل أو أُلغي من جهاز آخر) — لم يُسجَّل شيء', 'no'); }
    if (ok) { setDoneF(null); say('سُجّل الإنتاج: صُرفت الخامات وأُضيف ' + made + ' ' + pUnit(o.prepId) + ' للمخزون ✓'); }
  };
  const cancel = async (o) => {
    if (!window.confirm('إلغاء أمر الإنتاج ' + o.no + '؟ (لا حركات مخزون عليه)')) return;
    const ok = await commit(d => ({ ...d, prodOrders: (d.prodOrders || []).map(x => x.id === o.id && x.status === 'planned' ? { ...x, status: 'cancelled', cancelBy: me.name, cancelAt: nowISO() } : x) }), { actionType: 'update', targetType: 'production_order', targetId: o.id, title: 'ألغى أمر إنتاج ' + o.no });
    if (ok) say('أُلغي الأمر');
  };
  const printSheet = (o) => { const K = prodCheck(org, ops, o.prepId, o.planned, o.whId); if (K.err) return say(K.err, 'no');
    printA4(org, 'أمر إنتاج ' + o.no, pName(o.prepId) + ' · ' + q3(o.planned) + ' ' + pUnit(o.prepId) + ' · ' + whName(org, o.whId) + ' · ' + arDate(o.date),
      `<table><thead><tr><th>المكوّن</th><th>الكمية المطلوبة</th><th>الرصيد</th><th>صُرف فعلًا</th></tr></thead><tbody>${K.lines.map(l => `<tr><td>${esc(l.name)}</td><td class="n">${q3(l.qty)}</td><td class="n">${q3(l.have)}</td><td></td></tr>`).join('')}</tbody></table>
      <div style="margin-top:10px;font-size:11px">الكمية المنتجة فعلًا: ................ ${esc(pUnit(o.prepId))}</div><div class="sign"><div>الشيف</div><div>أمين المستودع</div><div>المراجعة</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); };

  const td = today();
  const doneToday = orders.filter(o => o.status === 'done' && (o.doneDate || o.date) === td);
  const yields = orders.filter(o => o.status === 'done' && o.planned > 0).slice(0, 30);
  const avgYield = yields.length ? Math.round(yields.reduce((a, o) => a + o.made / o.planned, 0) / yields.length * 1000) / 10 : null;

  return (
    <div className="grid" style={{ gap: 14 }} data-prod>
      <div className="grid g4">
        <Kpi label="أوامر مخططة" value={orders.filter(o => o.status === 'planned').length} sub="بانتظار التنفيذ" icon={Factory} color="#C8A24A" />
        <Kpi label="منجزة اليوم" value={doneToday.length} sub={money(doneToday.reduce((a, o) => a + (o.cost || 0), 0)) + ' تكلفة'} icon={Check} color="#4FB286" />
        <Kpi label="متوسط الإنجاز" value={avgYield == null ? '—' : avgYield + '%'} sub="الفعلي ÷ المخطط (آخر 30)" icon={Factory} color="#5B93C4" />
        <Kpi label="تحضيرات مخزّنة" value={stocked.length} sub={'من ' + (org.preps || []).length + ' تحضيرة'} icon={Factory} color="#9B7BB8" />
      </div>
      <div className="card">
        <div className="card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="card-t"><Factory size={15} color="var(--brass)" />أوامر الإنتاج</div>
          {canW && <button className="btn pri" disabled={!stocked.length} onClick={() => setNewF({ prepId: (stocked[0] || {}).id || '', qty: '', whId: MAIN_WH, date: today(), note: '' })}><Plus size={14} />أمر إنتاج جديد</button>}
        </div>
        {!stocked.length && <div className="note" style={{ marginBottom: 10 }}>لا توجد تحضيرات مخزّنة بعد. افتح «الوصفات والتكلفة» ← التحضيرة ← فعّل «تُخزَّن صنفًا (أوامر الإنتاج)».</div>}
        <div className="tw"><table className="tb">
          <thead><tr><th>الأمر</th><th>التاريخ</th><th>المنتج</th><th>المستودع</th><th>المخطط</th><th>المنتج فعلًا</th><th>الإنجاز</th><th>التكلفة</th><th>الحالة</th><th></th></tr></thead>
          <tbody>{orders.map(o => { const st = ST[o.status] || ST.planned, pct = o.planned ? Math.round(o.made / o.planned * 1000) / 10 : 0;
            return <tr key={o.id}>
              <td className="num"><b>{o.no}</b></td><td className="num">{o.date}</td><td><b>{pName(o.prepId)}</b></td><td>{whName(org, o.whId)}</td>
              <td className="num">{q3(o.planned)} {pUnit(o.prepId)}</td><td className="num">{o.status === 'done' ? q3(o.made) + ' ' + pUnit(o.prepId) : '—'}</td>
              <td>{o.status === 'done' ? <span className={'badge ' + (pct >= 97 ? 'b-mint' : pct >= 90 ? 'b-amber' : 'b-rose')}>{pct}%</span> : '—'}</td>
              <td className="num">{o.status === 'done' ? money(o.cost) : '—'}</td>
              <td><span className={'badge ' + st[0]}>{st[1]}</span></td>
              <td><div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                <button className="btn sm gh" title="ورقة الأمر للمطبخ" onClick={() => printSheet(o)}><Printer size={13} /></button>
                {canW && o.status === 'planned' && <><button className="btn sm pri" onClick={() => setDoneF({ o, made: String(o.planned), date: today() })}><Check size={13} />تسجيل الإنتاج</button>
                  <button className="btn sm gh" title="إلغاء" onClick={() => cancel(o)}><X size={13} /></button></>}
              </div></td>
            </tr>; })}
            {!orders.length && <tr><td colSpan={10}><div className="empty">لا أوامر إنتاج بعد.</div></td></tr>}</tbody>
        </table></div>
      </div>

      {newF && <Modal title="أمر إنتاج جديد" icon={Factory} onClose={() => setNewF(null)} wide
        foot={<><button className="btn gh" onClick={() => setNewF(null)}>إلغاء</button><button className="btn pri" disabled={!C || !!C.err} onClick={create}><Check size={14} />إنشاء الأمر</button></>}>
        <div className="grid g2">
          <Field label="المنتج (تحضيرة مخزّنة)"><select className="sel" aria-label="المنتج" value={newF.prepId} onChange={e => setNewF(f => ({ ...f, prepId: e.target.value }))}>{stocked.map(p => <option key={p.id} value={p.id}>{p.name} — دفعة {p.batch} {p.unit}</option>)}</select></Field>
          <Field label={'الكمية المخططة (' + pUnit(newF.prepId) + ')'}><input className="inp n" aria-label="الكمية المخططة" inputMode="decimal" value={newF.qty} onChange={e => setNewF(f => ({ ...f, qty: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          {whs.length > 0 && <Field label="المستودع (الصرف والاستلام)"><select className="sel" aria-label="المستودع" value={newF.whId} onChange={e => setNewF(f => ({ ...f, whId: e.target.value }))}>{whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
          <Field label="تاريخ التنفيذ"><input className="inp" type="date" value={newF.date} onChange={e => setNewF(f => ({ ...f, date: e.target.value }))} /></Field>
        </div>
        {C && !C.err && <NeedTable C={C} unit={pUnit(newF.prepId)} qty={Number(newF.qty)} />}
        {C && C.err && <div className="note" style={{ color: 'var(--rose)' }}>{C.err}</div>}
        {C && !C.err && C.short.length > 0 && <div className="note" style={{ color: 'var(--rose)', marginTop: 8 }}>تنبيه: الرصيد الحالي لا يكفي — يمكن إنشاء الأمر، لكن تسجيل الإنتاج يُمنع حتى يتوفر الرصيد (المخزون السالب ممنوع).</div>}
      </Modal>}

      {doneF && <Modal title={'تسجيل إنتاج ' + doneF.o.no} icon={Check} onClose={() => setDoneF(null)} wide
        foot={<><button className="btn gh" onClick={() => setDoneF(null)}>إلغاء</button><button className="btn pri" disabled={!D || !!D.err || D.short.length > 0} onClick={complete}><Check size={14} />تأكيد الإنتاج</button></>}>
        <div className="grid g2">
          <Field label={'الكمية المنتجة فعلًا (' + pUnit(doneF.o.prepId) + ') — المخطط ' + q3(doneF.o.planned)}><input className="inp n" aria-label="الكمية المنتجة فعلًا" inputMode="decimal" value={doneF.made} onChange={e => setDoneF(f => ({ ...f, made: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          <Field label="تاريخ الإنتاج"><input className="inp" type="date" value={doneF.date} onChange={e => setDoneF(f => ({ ...f, date: e.target.value }))} /></Field>
        </div>
        {D && !D.err && <NeedTable C={D} unit={pUnit(doneF.o.prepId)} qty={Number(doneF.made)} />}
        {D && D.err && <div className="note" style={{ color: 'var(--rose)' }}>{D.err}</div>}
        <div className="note" style={{ marginTop: 8 }}>الصرف = الوصفة × الكمية المنتجة فعلًا. أي استهلاك زائد يظهر في الجرد وتقرير «الاستهلاك النظري والفعلي».</div>
      </Modal>}
    </div>
  );
}

function NeedTable({ C, unit, qty }) {
  return <div style={{ marginTop: 12 }}>
    <div className="tw"><table className="tb">
      <thead><tr><th>المكوّن</th><th>المطلوب</th><th>الرصيد في المستودع</th><th>التكلفة</th></tr></thead>
      <tbody>{C.lines.map(l => <tr key={l.itemId}><td>{l.name}</td><td className="num">{q3(l.qty)}</td>
        <td className="num" style={{ color: l.short > 0 ? 'var(--rose)' : undefined, fontWeight: l.short > 0 ? 700 : undefined }}>{q3(l.have)}{l.short > 0 ? ' (ينقص ' + q3(l.short) + ')' : ''}</td><td className="num">{money(l.cost)}</td></tr>)}</tbody>
    </table></div>
    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      <span className="badge b-brass">تكلفة الدفعة {money(C.cost)}</span>
      {qty > 0 && <span className="badge b-dim">تكلفة الوحدة {money(C.unitCost)} / {unit}</span>}
    </div>
  </div>;
}
