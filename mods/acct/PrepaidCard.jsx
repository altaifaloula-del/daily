/* v56.41 — الدفعة 6 (قرار المجلس T4): المصروف المدفوع مقدمًا (مثل الإيجار لأكثر من شهر) — أصل متداول يُطفأ شهريًا (القسم 20، الإصدار الثاني).
   الدفعة نفسها سُجّلت مصروفًا في شاشتها؛ المستند يعيد تصنيفها ثم يُطفئها بآخر كل شهر. ينشئه المحاسب ويعتمده غيره. */
import React, { useState } from 'react';
import { CalendarClock, Check, X, Plus } from 'lucide-react';
import { ppSchedule, ppCheck, ppApprove, ppAssetOk, ppExpOk, canApproveJe, Field, Modal, money, uid, nowISO, today } from '../../App.jsx';

export function PrepaidCard({ org, ops, A, me, commit, say, canPost }) {
  const [f, setF] = useState(null); const L = ops.prepaids || [];
  const assets = (A.accounts || []).filter(a => ppAssetOk(a.code, A)), exps = (A.accounts || []).filter(a => ppExpOk(a.code, A));
  const brs = (org.branches || []).filter(b => b.isActive !== false); const td = today();
  const left = (x) => Math.round(ppSchedule(x).filter(s => s.date > td).reduce((t, s) => t + s.amount, 0) * 100) / 100;
  const save = async () => {
    const x = { id: uid('pp'), desc: f.desc.trim(), date: f.date, start: f.start, months: Number(f.months), amount: Math.round((Number(String(f.amount).replace(/[^\d.]/g, '')) || 0) * 100) / 100,
      assetAcc: f.assetAcc, expAcc: f.expAcc, ...(f.branchId ? { branchId: f.branchId } : {}), status: 'pending', by: me.name, byId: me.id || '', at: nowISO() };
    const e = ppCheck(org, ops, x, A); if (e) return say(e, 'no');
    const ok = await commit(d => { const n = (d.prepaids || []).reduce((m, y) => Math.max(m, Number(String(y.no || '').replace(/\D/g, '')) || 0), 0) + 1; return { ...d, prepaids: [...(d.prepaids || []), { ...x, no: 'PP-' + String(n).padStart(4, '0') }] }; },
      { actionType: 'create', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'مصروف مدفوع مقدمًا — ' + x.desc, details: money(x.amount) + ' على ' + x.months + ' شهرًا' });
    if (ok) { setF(null); say('أُرسل للاعتماد — يعتمده غيرك ✓'); } };
  const decide = async (x, okd) => { let err = '';
    if (!okd) { const why = window.prompt('سبب الرفض (إلزامي):', ''); if (!why || !why.trim()) return; if (!canApproveJe(me, x)) return say('لا يرفضه من أنشأه', 'no');
      if (await commit(d => ({ ...d, prepaids: (d.prepaids || []).map(y => y.id === x.id && y.status === 'pending' ? { ...y, status: 'rejected', rejBy: me.name, rejAt: nowISO(), rejWhy: why.trim() } : y) }), { actionType: 'reject', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'رفض مصروف مدفوع مقدمًا', details: why.trim() })) say('رُفض'); return; }
    const ok = await commit(d => { const r = ppApprove(org, d, x.id, me, A); if (r.err) { err = r.err; return d; } return r.next; }, { actionType: 'approve', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'اعتماد مصروف مدفوع مقدمًا — ' + x.desc, details: money(x.amount) });
    if (err) return say(err, 'no'); if (ok) say('اعتُمد — قيد إعادة التصنيف وجدول الإطفاء ✓'); };
  return (<div className="card" data-prepaid>
    <div className="card-h"><div className="card-t"><CalendarClock size={15} color="var(--brass)" />المصروفات المدفوعة مقدمًا</div>
      {canPost && <button className="btn sm pri" onClick={() => setF({ desc: '', date: td, start: td.slice(0, 7), months: '12', amount: '', assetAcc: '', expAcc: '', branchId: '' })} data-pp-new><Plus size={13} />جديد</button>}</div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      مثل الإيجار المدفوع لعدة أشهر: سجّل الدفعة كالمعتاد على حساب المصروف، ثم أنشئ هنا مستندًا يعيدها أصلًا (مدفوعًا مقدمًا) ويُطفئها بآخر كل شهر. كل مستند يعتمده غير منشئه. اختر الفرع نفسه الذي سُجّلت عليه الدفعة، والمبلغ المحمَّل على المصروف (بلا الضريبة). يُطفأ شهر البدء كاملًا، والإطفاء يُقيَّد حين يحل شهره.</div>
    {L.map(x => <div key={x.id} className="me-row" data-pp-doc={x.id}><span className="me-a"><b>{x.no || ''} · {x.desc} · <span className="num">{money(x.amount)}</span></b>
      <small>{x.months} شهرًا من {x.start} · {x.branchId ? ((brs.find(b => b.id === x.branchId) || {}).name || x.branchId) : 'المركز الرئيسي'} · {x.assetAcc} ← {x.expAcc}{x.status === 'approved' ? ' · المتبقي غير المُطفأ ' + money(left(x)) : ''}{x.rejWhy ? ' · رُفض: ' + x.rejWhy : ''}</small></span>
      {x.status === 'pending' ? (canApproveJe(me, x) ? <span className="row" style={{ gap: 4 }}><button className="btn sm pri" onClick={() => decide(x, true)} data-pp-ok><Check size={13} />اعتماد</button><button className="btn sm gh" onClick={() => decide(x, false)} data-pp-no><X size={13} />رفض</button></span>
        : <span className="badge b-amber" data-pp-wait>بانتظار الاعتماد</span>) : <span className={'badge ' + (x.status === 'approved' ? 'b-mint' : 'b-dim')}>{x.status === 'approved' ? 'معتمد' : 'مرفوض'}</span>}</div>)}
    {!L.length && <div className="empty">لا مصروفات مدفوعة مقدمًا</div>}
    {f && <Modal title="مصروف مدفوع مقدمًا" icon={CalendarClock} onClose={() => setF(null)}
      foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save} data-pp-save><Check size={14} />إرسال للاعتماد</button></>}>
      <Field label="الوصف"><input className="inp" aria-label="وصف المدفوع مقدمًا" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} placeholder="إيجار فرع العليا — سنة" /></Field>
      <div className="grid g2">
        <Field label="المبلغ المحمَّل على المصروف (ر.س، بلا ضريبة المدخلات)"><input className="inp n" inputMode="decimal" aria-label="مبلغ المدفوع مقدمًا" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="تاريخ الدفعة"><input type="date" className="inp" aria-label="تاريخ الدفعة" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="أول شهر إطفاء"><input type="month" className="inp" aria-label="أول شهر إطفاء" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="عدد الأشهر"><input className="inp n" inputMode="numeric" aria-label="عدد أشهر الإطفاء" value={f.months} onChange={e => setF({ ...f, months: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      <Field label="حساب المصروف الذي سُجّلت عليه الدفعة"><select className="sel" aria-label="حساب المصروف" value={f.expAcc} onChange={e => setF({ ...f, expAcc: e.target.value })}><option value="">—</option>{exps.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
      <Field label="حساب المصروف المدفوع مقدمًا (أصل)"><select className="sel" aria-label="حساب المدفوع مقدمًا" value={f.assetAcc} onChange={e => setF({ ...f, assetAcc: e.target.value })}><option value="">—</option>{assets.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
      {brs.length > 0 && <Field label="مركز التكلفة (اختياري) — إيجار كل فرع مستند مستقل"><select className="sel" aria-label="فرع المدفوع مقدمًا" value={f.branchId} onChange={e => setF({ ...f, branchId: e.target.value })}><option value="">المركز الرئيسي</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
      <div className="note" style={{ marginTop: 8 }}>بعد الاعتماد: مدين المدفوع مقدمًا / دائن المصروف بتاريخ الدفعة، ثم كل شهر: مدين المصروف / دائن المدفوع مقدمًا ({f.months && Number(f.amount) ? money(Math.floor(Number(f.amount) / Number(f.months) * 100) / 100) : '—'} شهريًا تقريبًا).</div>
    </Modal>}
  </div>);
}
