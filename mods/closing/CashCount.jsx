/* v41.5 — «الجرد النقدي المفاجئ»: عدّ صندوق الكاشير أو العهدة أو الخزنة بالفئات مقابل المتوقع، بيد شخص غير حافظ النقد
   المحرك في النواة (ccOpenShifts/cashCountStatus). الفرق ≠ 0 ⇒ تفسير إلزامي + إجراء متابعة تلقائي. */
import React, { useMemo, useState } from 'react';
import { Banknote, Shuffle, Printer, Info, Check } from 'lucide-react';
import { CC_KIND, CC_SRC, DENOMS, Field, Kpi, ROLES, arDate, cashCountStatus, ccOpenShifts, countDenoms, emptyDenoms, money, newAction, nowISO, printA4, today, uid } from '../../App.jsx';

export function CashCount({ org, ops, me, myBranches, commit, say }) {
  const brs = (myBranches && myBranches.length ? myBranches : (org.branches || [])).filter(b => b.isActive !== false);
  const ST = useMemo(() => cashCountStatus({ ...org, branches: brs }, ops), [org, ops, brs]);
  const [f, setF] = useState(null);
  const start = (bId) => { const sh = ccOpenShifts(ops, bId); setF({ branchId: bId, kind: 'drawer', holder: sh[0] ? sh[0].openedBy : '', shiftId: sh[0] ? sh[0].id : '', src: sh[0] ? 'pos' : 'xreport', expected: sh[0] ? String(sh[0].expected) : '', ref: '', denoms: emptyDenoms(), note: '' }); };
  const pickRandom = () => { if (!brs.length) return; const b = brs[Math.floor(Math.random() * brs.length)]; start(b.id); say('اختيار عشوائي: ' + b.name); };
  const shifts = f ? ccOpenShifts(ops, f.branchId) : [];
  const counted = f ? Math.round(countDenoms(f.denoms) * 100) / 100 : 0;
  const expected = f ? Math.round((Number(f.expected) || 0) * 100) / 100 : 0;
  const variance = Math.round((counted - expected) * 100) / 100;
  const save = async () => {
    if (!String(f.holder || '').trim()) return say('اكتب اسم حافظ النقد (الكاشير أو صاحب العهدة)', 'no');
    if (String(f.holder).trim() === me?.name) return say('لا يجرد حافظ النقد نفسه — يعدّه شخص آخر', 'no');
    if (f.expected === '' || !isFinite(Number(f.expected))) return say('أدخل المبلغ المتوقع ومصدره', 'no');
    if (f.src !== 'pos' && !String(f.ref || '').trim()) return say('اكتب مرجع المتوقع (رقم قراءة X أو تاريخ كشف العهدة)', 'no');
    if (Math.abs(variance) >= 0.01 && String(f.note || '').trim().length < 4) return say('يوجد فرق ' + money(variance) + ' — اكتب تفسير حافظ النقد', 'no');
    const bn = ((org.branches || []).find(b => b.id === f.branchId) || {}).name || '';
    const rec = { id: uid('cc'), branchId: f.branchId, kind: f.kind, holder: String(f.holder).trim(), src: f.src, ...(f.src === 'pos' ? { shiftId: f.shiftId } : { ref: String(f.ref).trim() }),
      expected, counted, variance, denoms: Object.fromEntries(Object.entries(f.denoms).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])), note: String(f.note || '').trim(), by: me?.name || '', at: nowISO(), date: today() };
    const act = Math.abs(variance) >= 0.01 ? newAction(me, { src: 'check', srcKey: 'cc|' + rec.id, branchId: f.branchId, area: 'cash', title: 'فرق جرد نقدي مفاجئ — ' + bn + ' — ' + CC_KIND[f.kind] + ' (' + rec.holder + ')', detail: (variance < 0 ? 'عجز ' : 'زيادة ') + money(Math.abs(variance)) + ' · المتوقع ' + money(expected) + ' · المعدود ' + money(counted) + ' · التفسير: ' + rec.note }) : null;
    const ok = await commit(d => ({ ...d, cashCounts: [rec, ...(d.cashCounts || [])], ...(act ? { actions: [{ ...act, ...(act.branchId ? {} : { branchId: f.branchId }) }, ...(d.actions || [])] } : {}) }),
      { actionType: 'create', targetType: 'daily_closing', targetId: rec.id, title: 'جرد نقدي مفاجئ — ' + bn, details: CC_KIND[f.kind] + ' · ' + rec.holder + ' · المتوقع ' + money(expected) + ' · المعدود ' + money(counted) + ' · الفرق ' + money(variance) });
    if (ok !== false) { setF(null); say(Math.abs(variance) < 0.01 ? 'سُجّل الجرد — مطابق ✓' : 'سُجّل الجرد بفرق ' + money(variance) + ' — وأُنشئ إجراء متابعة'); }
  };
  const printRec = (c) => { const bn = ((org.branches || []).find(b => b.id === c.branchId) || {}).name || '';
    const rows = DENOMS.filter(d => c.denoms && c.denoms[d.k]).map(d => `<tr><td class="n">${d.v}</td><td class="n">${c.denoms[d.k]}</td><td class="n">${money(d.v * c.denoms[d.k])}</td></tr>`).join('');
    printA4(org, 'محضر جرد نقدي مفاجئ — ' + bn, arDate(c.date) + ' · ' + String(c.at).slice(11, 16) + ' · ' + CC_KIND[c.kind],
      `<table><tbody><tr><td>حافظ النقد</td><td>${c.holder}</td></tr><tr><td>المتوقع (${CC_SRC[c.src]}${c.ref ? ' · ' + c.ref : ''})</td><td class="n">${money(c.expected)}</td></tr><tr><td>المعدود</td><td class="n">${money(c.counted)}</td></tr><tr class="tot"><td>${c.variance < 0 ? 'عجز' : c.variance > 0 ? 'زيادة' : 'الفرق'}</td><td class="n">${money(c.variance)}</td></tr>${c.note ? `<tr><td>تفسير حافظ النقد</td><td>${c.note}</td></tr>` : ''}</tbody></table>
      <table><thead><tr><th>الفئة</th><th>العدد</th><th>القيمة</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sign"><div>العادّ: ${c.by}</div><div>حافظ النقد: ${c.holder}</div><div>المراجعة</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); };
  const recent = (ops.cashCounts || []).filter(c => brs.some(b => b.id === c.branchId)).sort((a, c) => String(c.at).localeCompare(String(a.at))).slice(0, 12);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>الجرد النقدي المفاجئ</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>عدّ الصندوق أو العهدة دون موعد، بيد شخص غير حافظ النقد — بالفئات ومقابل المتوقع</div></div>
        {!f && commit && <button className="btn sm pri" onClick={pickRandom}><Shuffle size={13} />فرع عشوائي</button>}
      </div>
      {!f ? <div className="card"><div className="me-list">{ST.map(b => <div key={b.id} className="me-row">
          <span className="me-a"><b>{b.name}</b><small>{b.last ? 'آخر جرد ' + arDate(b.last.date) + ' (قبل ' + b.days + ' يوم) · ' + (Math.abs(b.last.variance) < 0.01 ? 'مطابق' : 'فرق ' + money(b.last.variance)) : 'لم يُجرد قط'}</small>
            <small>آخر 90 يومًا: {b.n90} جرد · عجز {money(b.short90)} · زيادة {money(b.over90)}</small></span>
          <span className="me-b">{commit && <button className="btn sm" onClick={() => start(b.id)}><Banknote size={12} />جرد الآن</button>}</span></div>)}</div></div>
      : <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}>جرد {((org.branches || []).find(b => b.id === f.branchId) || {}).name} — {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
        <div className="grid g3" style={{ gap: 8 }}>
          <Field label="المعدود"><div className="rp-seg">{Object.entries(CC_KIND).map(([k, v]) => <button key={k} type="button" className={'btn sm' + (f.kind === k ? ' pri' : ' gh')} onClick={() => setF(x => ({ ...x, kind: k, src: k === 'drawer' && shifts[0] ? 'pos' : k === 'custody' ? 'statement' : 'manual', expected: k === 'drawer' && shifts[0] ? String(shifts[0].expected) : '' }))}>{v}</button>)}</div></Field>
          <Field label="حافظ النقد (الكاشير أو صاحب العهدة)"><input className="inp" aria-label="حافظ النقد" value={f.holder} onChange={e => setF(x => ({ ...x, holder: e.target.value }))} /></Field>
          <Field label="مصدر المتوقع"><select className="inp sel" value={f.src} onChange={e => { const v = e.target.value; setF(x => ({ ...x, src: v, ...(v === 'pos' && shifts[0] ? { expected: String(shifts[0].expected), shiftId: shifts[0].id } : {}) })); }}>
            {Object.entries(CC_SRC).filter(([k]) => k !== 'pos' || shifts.length).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label={f.src === 'pos' ? 'المتوقع من الوردية (الافتتاحي + صافي النقدي)' : 'المبلغ المتوقع'}><input className="inp n" inputMode="decimal" aria-label="المتوقع" disabled={f.src === 'pos'} value={f.expected} onChange={e => setF(x => ({ ...x, expected: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          {f.src !== 'pos' && <Field label="مرجع المتوقع"><input className="inp" aria-label="مرجع المتوقع" placeholder="رقم قراءة X / تاريخ الكشف" value={f.ref} onChange={e => setF(x => ({ ...x, ref: e.target.value }))} /></Field>}
        </div>
        <div className="lbl" style={{ margin: '8px 0 4px' }}>العدّ بالفئات</div>
        <div className="cc-den">{DENOMS.map(d => <label key={d.k} className="cc-d" style={{ borderColor: d.c }}><span>{d.v}</span><input className="inp n" inputMode="numeric" aria-label={'فئة ' + d.v} value={f.denoms[d.k] || ''} onChange={e => setF(x => ({ ...x, denoms: { ...x.denoms, [d.k]: e.target.value.replace(/\D/g, '').slice(0, 5) } }))} /></label>)}</div>
        <div className="grid g3" style={{ marginTop: 10 }}>
          <Kpi label="المتوقع" value={money(expected)} sub={CC_SRC[f.src]} icon={Banknote} color="#5B93C4" />
          <Kpi label="المعدود" value={money(counted)} sub="مجموع الفئات" icon={Banknote} color="#C8A24A" />
          <Kpi label={variance < 0 ? 'عجز' : variance > 0 ? 'زيادة' : 'الفرق'} value={money(variance)} sub={Math.abs(variance) < 0.01 ? 'مطابق' : 'يتطلب تفسيرًا'} icon={Banknote} color={Math.abs(variance) < 0.01 ? '#4FB286' : '#D9544D'} />
        </div>
        {Math.abs(variance) >= 0.01 && <Field label="تفسير حافظ النقد (إلزامي)"><input className="inp" aria-label="التفسير" value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))} /></Field>}
        <div className="row" style={{ gap: 6, marginTop: 8 }}><button className="btn pri" onClick={save}><Check size={14} />حفظ المحضر</button><button className="btn gh" onClick={() => setF(null)}>إلغاء</button></div>
      </div>}
      {recent.length > 0 && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>آخر المحاضر</div>
        <div className="me-list">{recent.map(c => <div key={c.id} className="me-row"><span className="me-a"><b>{((org.branches || []).find(b => b.id === c.branchId) || {}).name} — {CC_KIND[c.kind]}</b><small>{arDate(c.date)} {String(c.at).slice(11, 16)} · {c.holder} · العادّ {c.by}{c.note ? ' · ' + c.note : ''}</small></span>
          <span className="me-b"><b className="num" dir="ltr" style={{ color: Math.abs(c.variance) < 0.01 ? 'var(--mint)' : 'var(--rose)' }}>{money(c.variance)}</b><button className="btn sm gh" onClick={() => printRec(c)}><Printer size={12} />محضر</button></span></div>)}</div></div>}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> الجرد المفاجئ يكشف ما لا يكشفه الإغلاق اليومي (الاستعارة المؤقتة من الصندوق خلال اليوم). المتوقع: من وردية نقطة بيع ميزان المفتوحة تلقائيًا، أو من قراءة X لنظام الكاشير الخارجي/كشف العهدة بمرجعها. «فرع عشوائي» يمنع توقّع موعد الجرد. كل محضر في سجل التدقيق، وأي فرق يُنشئ إجراء متابعة.</div>
    </div>);
}
