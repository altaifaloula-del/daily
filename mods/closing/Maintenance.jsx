/* v41.6 — «صيانة المعدات»: بلاغات الأعطال وإغلاقها بالتكلفة، والصيانة الوقائية، وتنبيه الدفع أثناء الضمان
   المحرك في النواة (maintStatus). التكلفة هنا للمتابعة — السداد يُقيَّد من الفاتورة أو الإغلاق. */
import React, { useMemo, useState } from 'react';
import { Wrench, Plus, Check, Printer, Info, ShieldAlert } from 'lucide-react';
import { Field, Kpi, MT_TYPE, ROLES, arDate, maintStatus, money, nowISO, printA4, today, uid } from '../../App.jsx';

export function Maintenance({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const brs = (myBranches && myBranches.length ? myBranches : (org.branches || [])).filter(b => b.isActive !== false);
  const [br, setBr] = useState(me?.branchId || (central ? '' : (brs[0] || {}).id || ''));
  const [rep, setRep] = useState(null);   // بلاغ/صيانة وقائية جديدة
  const [cls, setCls] = useState(null);   // إغلاق بلاغ
  const [eF, setEF] = useState(null);     // جهاز
  const S = useMemo(() => maintStatus(org, ops, { branchIds: br ? [br] : brs.map(b => b.id) }), [org, ops, br, brs]);
  const eq = (org.equipment || []).filter(e => !br || e.branchId === br);
  const bn = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
  const submitRep = async () => { const e = (org.equipment || []).find(x => x.id === rep.equipId); if (!e) return say('اختر الجهاز', 'no');
    if (rep.type === 'breakdown' && String(rep.issue || '').trim().length < 4) return say('صِف العطل', 'no');
    const now = nowISO(); const pv = rep.type === 'preventive';
    if (pv && e.warrantyTo && e.warrantyTo >= today() && Number(rep.cost) > 0 && !String(rep.wnote || '').trim()) return say('الجهاز تحت الضمان حتى ' + e.warrantyTo + ' — اكتب سبب الدفع (أو اجعل التكلفة صفرًا)', 'no');
    const rec = { id: uid('mt'), branchId: e.branchId, equipId: e.id, equipName: e.name, type: rep.type, at: now, by: me?.name || '', issue: String(rep.issue || '').trim(),
      ...(pv ? { status: 'done', doneAt: now, doneBy: me?.name || '', cost: Number(rep.cost) || 0, vendor: String(rep.vendor || '').trim(), ref: String(rep.ref || '').trim(), ...(rep.wnote ? { wnote: rep.wnote } : {}) } : { status: 'open' }) };
    const ok = await commit(d => ({ ...d, maintLogs: [rec, ...(d.maintLogs || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: rec.id, title: (pv ? 'صيانة وقائية — ' : 'بلاغ عطل — ') + e.name, details: bn(e.branchId) + (rec.issue ? ' · ' + rec.issue : '') + (pv ? ' · ' + money(rec.cost) : '') });
    if (ok !== false) { setRep(null); say(pv ? 'سُجّلت الصيانة الوقائية ✓' : 'سُجّل البلاغ ✓'); } };
  const closeRep = async () => { const l = cls.log; const e = (org.equipment || []).find(x => x.id === l.equipId) || {};
    const inW = e.warrantyTo && e.warrantyTo >= today();
    if (inW && Number(cls.cost) > 0 && !String(cls.wnote || '').trim()) return say('الجهاز تحت الضمان حتى ' + e.warrantyTo + ' — اكتب سبب الدفع (خارج الضمان؟ سوء استخدام؟) أو اجعل التكلفة صفرًا', 'no');
    if (String(cls.fix || '').trim().length < 3) return say('اكتب ما أُصلح', 'no');
    const upd = { status: 'done', doneAt: nowISO(), doneBy: me?.name || '', fix: String(cls.fix).trim(), cost: Number(cls.cost) || 0, vendor: String(cls.vendor || '').trim(), ref: String(cls.ref || '').trim(), ...(cls.wnote ? { wnote: cls.wnote } : {}) };
    const ok = await commit(d => ({ ...d, maintLogs: (d.maintLogs || []).map(x => x.id === l.id ? { ...x, ...upd } : x) }), { actionType: 'update', targetType: 'daily_closing', targetId: l.id, title: 'إغلاق بلاغ عطل — ' + (l.equipName || ''), details: upd.fix + ' · ' + money(upd.cost) + (upd.vendor ? ' · ' + upd.vendor : '') });
    if (ok !== false) { setCls(null); say('أُغلق البلاغ ✓'); } };
  const saveEq = async () => { const f = eF; if (!String(f.name || '').trim() || !f.branchId) return say('اسم الجهاز وفرعه', 'no');
    const rec = { id: f.id || uid('eq'), branchId: f.branchId, name: f.name.trim(), cat: String(f.cat || '').trim(), vendor: String(f.vendor || '').trim(), warrantyTo: f.warrantyTo || '', pmDays: Number(f.pmDays) || 0, ...(f.assetId ? { assetId: f.assetId } : {}) };
    const ok = await commitOrg(d => ({ ...d, equipment: f.id ? (d.equipment || []).map(x => x.id === f.id ? rec : x) : [...(d.equipment || []), rec] }), { actionType: f.id ? 'update' : 'create', targetType: 'settings', targetId: rec.id, title: 'سجل المعدات', details: rec.name + ' · ' + bn(rec.branchId) });
    if (ok !== false) { setEF(null); say('حُفظ ✓'); } };
  const print = () => { const L = (ops.maintLogs || []).filter(l => !br || l.branchId === br).sort((a, c) => String(c.at).localeCompare(String(a.at)));
    printA4(org, 'سجل صيانة المعدات', br ? bn(br) : 'كل الفروع', `<table><thead><tr><th>الفرع</th><th>الجهاز</th><th>النوع</th><th>البلاغ</th><th>الوصف</th><th>الإغلاق</th><th>الإصلاح</th><th>التكلفة</th><th>المورد/المرجع</th></tr></thead><tbody>${L.map(l => `<tr><td>${bn(l.branchId)}</td><td>${l.equipName || ''}</td><td>${MT_TYPE[l.type]}</td><td class="n">${String(l.at).slice(0, 16).replace('T', ' ')}</td><td>${l.issue || ''}</td><td class="n">${l.doneAt ? String(l.doneAt).slice(0, 16).replace('T', ' ') : 'مفتوح'}</td><td>${l.fix || ''}</td><td class="n">${l.cost != null ? money(l.cost) : ''}</td><td>${[l.vendor, l.ref].filter(Boolean).join(' · ')}</td></tr>`).join('')}</tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); };
  const tot = { open: S.reduce((a, x) => a + x.open.length, 0), due: S.filter(x => x.pmDue).length, cost: S.reduce((a, x) => a + x.cost12, 0), warr: S.reduce((a, x) => a + x.paidInWarranty, 0) };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>صيانة المعدات</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>بلاغات الأعطال، والصيانة الوقائية، وتكلفة كل جهاز وتوقفه وضمانه</div></div>
        <div className="rp-seg">{commit && <button className="btn sm pri" onClick={() => setRep({ type: 'breakdown', equipId: (eq[0] || {}).id || '' })}><Plus size={13} />بلاغ عطل</button>}
          {commit && <button className="btn sm" onClick={() => setRep({ type: 'preventive', equipId: (eq[0] || {}).id || '' })}><Wrench size={13} />صيانة وقائية تمت</button>}
          <button className="btn sm gh" onClick={print}><Printer size={13} />السجل</button></div>
      </div>
      {brs.length > 1 && <select className="inp sel" style={{ maxWidth: 320 }} value={br} onChange={e => setBr(e.target.value)} aria-label="الفرع">{central && <option value="">كل الفروع</option>}{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
      <div className="grid g4">
        <Kpi label="بلاغات مفتوحة" value={String(tot.open)} sub="أعطال لم تُغلق" icon={Wrench} color={tot.open ? '#D9544D' : '#4FB286'} />
        <Kpi label="صيانة وقائية مستحقة" value={String(tot.due)} sub="حسب دورة كل جهاز" icon={Wrench} color={tot.due ? '#E0A458' : '#4FB286'} />
        <Kpi label="تكلفة الصيانة (12 شهرًا)" value={money(tot.cost)} sub="من البلاغات المغلقة والوقائية" icon={Wrench} color="#5B93C4" />
        <Kpi label="دُفع أثناء الضمان" value={money(tot.warr)} sub={tot.warr ? 'راجِع: الضمان يغطيه عادةً' : 'لا شيء'} icon={ShieldAlert} color={tot.warr ? '#D9544D' : '#4FB286'} />
      </div>
      {rep && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>{rep.type === 'breakdown' ? 'بلاغ عطل' : 'صيانة وقائية تمت'}</div><div className="grid g3" style={{ gap: 8 }}>
        <Field label="الجهاز"><select className="inp sel" aria-label="الجهاز" value={rep.equipId} onChange={e => setRep(r => ({ ...r, equipId: e.target.value }))}>{eq.map(e => <option key={e.id} value={e.id}>{e.name}{central && !br ? ' — ' + bn(e.branchId) : ''}</option>)}</select></Field>
        <Field label={rep.type === 'breakdown' ? 'وصف العطل' : 'ما نُفِّذ'}><input className="inp" aria-label="الوصف" value={rep.issue || ''} onChange={e => setRep(r => ({ ...r, issue: e.target.value }))} /></Field>
        {rep.type === 'preventive' && <><Field label="التكلفة"><input className="inp n" inputMode="decimal" aria-label="التكلفة" value={rep.cost || ''} onChange={e => setRep(r => ({ ...r, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          <Field label="المورد/الفني"><input className="inp" value={rep.vendor || ''} onChange={e => setRep(r => ({ ...r, vendor: e.target.value }))} /></Field>
          <Field label="رقم الفاتورة"><input className="inp" value={rep.ref || ''} onChange={e => setRep(r => ({ ...r, ref: e.target.value }))} /></Field></>}
        {(() => { const e = (org.equipment || []).find(x => x.id === rep.equipId); return rep.type === 'preventive' && e && e.warrantyTo >= today() && Number(rep.cost) > 0 ? <Field label={'⚠ تحت الضمان حتى ' + e.warrantyTo + ' — سبب الدفع'}><input className="inp" value={rep.wnote || ''} onChange={x => setRep(r => ({ ...r, wnote: x.target.value }))} /></Field> : null; })()}
      </div><div className="row" style={{ gap: 6, marginTop: 8 }}><button className="btn pri" onClick={submitRep}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setRep(null)}>إلغاء</button></div></div>}
      {cls && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>إغلاق بلاغ — {cls.log.equipName}</div><div className="grid g3" style={{ gap: 8 }}>
        <Field label="ما أُصلح"><input className="inp" aria-label="ما أُصلح" value={cls.fix || ''} onChange={e => setCls(c => ({ ...c, fix: e.target.value }))} /></Field>
        <Field label="التكلفة"><input className="inp n" inputMode="decimal" aria-label="تكلفة الإصلاح" value={cls.cost || ''} onChange={e => setCls(c => ({ ...c, cost: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
        <Field label="المورد/الفني"><input className="inp" value={cls.vendor || ''} onChange={e => setCls(c => ({ ...c, vendor: e.target.value }))} /></Field>
        <Field label="رقم الفاتورة"><input className="inp" value={cls.ref || ''} onChange={e => setCls(c => ({ ...c, ref: e.target.value }))} /></Field>
        {(() => { const e = (org.equipment || []).find(x => x.id === cls.log.equipId); return e && e.warrantyTo >= today() && Number(cls.cost) > 0 ? <Field label={'⚠ تحت الضمان حتى ' + e.warrantyTo + ' — سبب الدفع'}><input className="inp" aria-label="سبب الدفع" value={cls.wnote || ''} onChange={x => setCls(c => ({ ...c, wnote: x.target.value }))} /></Field> : null; })()}
      </div><div className="row" style={{ gap: 6, marginTop: 8 }}><button className="btn pri" onClick={closeRep}><Check size={14} />إغلاق البلاغ</button><button className="btn gh" onClick={() => setCls(null)}>إلغاء</button></div></div>}
      <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>المعدات ({S.length})</div>
        {!S.length ? <div className="empty">لا معدات مسجّلة{central ? ' — أضفها أدناه' : ' — تضيفها الإدارة'}.</div> :
          <div className="me-list">{S.map(x => <div key={x.id} className="me-row">
            <span className="me-a"><b>{x.name}</b><small>{bn(x.branchId)}{x.cat ? ' · ' + x.cat : ''} · {x.breakdowns12} عطل في 12 شهرًا · توقف {x.downHrs12} ساعة{x.costPct != null ? ' · الصيانة ' + x.costPct + '% من تكلفة الأصل' : ''}</small>
              <small>{x.warranty ? '🛡 تحت الضمان حتى ' + x.warrantyTo : x.warrantyTo ? 'انتهى الضمان ' + x.warrantyTo : 'بلا ضمان مسجّل'}{x.nextPM ? ' · الوقائية القادمة ' + arDate(x.nextPM) : ''}{x.paidInWarranty ? ' · ⚠ دُفع أثناء الضمان ' + money(x.paidInWarranty) : ''}</small>
              {x.open.map(l => <small key={l.id} style={{ color: 'var(--rose)' }}>عطل مفتوح منذ {String(l.at).slice(0, 16).replace('T', ' ')}: {l.issue} {commit && <button className="btn sm gh" onClick={() => setCls({ log: l })}>إغلاق</button>}</small>)}</span>
            <span className="me-b"><b className="num" dir="ltr">{money(x.cost12)}</b><small>12 شهرًا</small>{x.pmDue && <span className="badge b-amber">وقائية مستحقة</span>}</span></div>)}</div>}
      </div>
      {central && commitOrg && <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}><div className="card-t">سجل المعدات</div><button className="btn sm pri" onClick={() => setEF({ branchId: br || (brs[0] || {}).id || '', name: '', cat: '', vendor: '', warrantyTo: '', pmDays: '' })}><Plus size={13} />جهاز</button></div>
        {eF && <div className="grid g3" style={{ gap: 8, marginBottom: 8 }}>
          <Field label="الفرع"><select className="inp sel" value={eF.branchId} onChange={e => setEF(f => ({ ...f, branchId: e.target.value }))}>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="اسم الجهاز"><input className="inp" aria-label="اسم الجهاز" value={eF.name} placeholder="قلاية، فرن، مكيف…" onChange={e => setEF(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="الفئة"><input className="inp" value={eF.cat} placeholder="مطبخ، تبريد، تكييف…" onChange={e => setEF(f => ({ ...f, cat: e.target.value }))} /></Field>
          <Field label="المورد/الوكيل"><input className="inp" value={eF.vendor} onChange={e => setEF(f => ({ ...f, vendor: e.target.value }))} /></Field>
          <Field label="الضمان حتى"><input className="inp" type="date" aria-label="الضمان حتى" value={eF.warrantyTo} onChange={e => setEF(f => ({ ...f, warrantyTo: e.target.value }))} /></Field>
          <Field label="الصيانة الوقائية كل (يوم) — اختياري"><input className="inp n" inputMode="numeric" value={eF.pmDays} onChange={e => setEF(f => ({ ...f, pmDays: e.target.value.replace(/\D/g, '') }))} /></Field>
          {(org.assets || []).length > 0 && <Field label="الأصل الثابت المرتبط (اختياري)"><select className="inp sel" value={eF.assetId || ''} onChange={e => setEF(f => ({ ...f, assetId: e.target.value }))}><option value="">—</option>{(org.assets || []).map(a => <option key={a.id} value={a.id}>{a.name} · {money(a.cost)}</option>)}</select></Field>}
          <div className="row" style={{ gap: 6, alignItems: 'end' }}><button className="btn pri" onClick={saveEq}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setEF(null)}>إلغاء</button></div>
        </div>}
        <div className="me-list">{(org.equipment || []).filter(e => !br || e.branchId === br).map(e => <div key={e.id} className="me-row"><span className="me-a"><b>{e.name}</b><small>{bn(e.branchId)}{e.cat ? ' · ' + e.cat : ''}{e.vendor ? ' · ' + e.vendor : ''}{e.pmDays ? ' · وقائية كل ' + e.pmDays + ' يوم' : ''}</small></span><span className="me-b"><button className="btn sm gh" onClick={() => setEF({ ...e, pmDays: e.pmDays || '' })}>تعديل</button></span></div>)}</div>
      </div>}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> تكلفة الصيانة هنا للمتابعة واتخاذ القرار (إصلاح أم استبدال)؛ السداد نفسه يُقيَّد من فاتورة المورد أو مصروفات الإغلاق — لا ترحيل مزدوج. الدفع لجهاز تحت الضمان يتطلب سببًا ويظهر للإدارة. دورة الصيانة الوقائية يحددها دليل الشركة المصنّعة لكل جهاز.</div>
    </div>);
}
