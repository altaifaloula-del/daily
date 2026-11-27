/* v56.43 — الدفعة 10 (قرارات المجلس E8، IFRS for SMEs القسم 27): هبوط قيمة الأصول الثابتة.
   المحاسب يُدخل مبلغ الهبوط بمستنده (لا يحسب النظام القيمة القابلة للاسترداد) ويعتمده غيره؛ العكس في حدود الدفتري لو لم يقع هبوط (27.30)؛
   الإهلاك بعده قسط ثابت على المتبقي للمستقبل فقط (E8.4)؛ واختبار المؤشرات سنويًا على الأقل (27.7). */
import React, { useState } from 'react';
import { TrendingDown, Check, X, ClipboardCheck } from 'lucide-react';
import { impCheck, impApprove, assetBookOn, canApproveJe, Field, Modal, money, uid, nowISO, today } from '../../App.jsx';

const KIND = { imp: 'هبوط قيمة', rev: 'عكس هبوط' };

export function ImpairCard({ org, ops, A, me, commit, say, canPost }) {
  const [f, setF] = useState(null); const [t, setT] = useState(null); const docs = ops.impairDocs || []; const pend = docs.filter(x => x.status === 'pending');
  const brName = (id) => id ? (((org.branches || []).find(b => b.id === id) || {}).name || id) : 'المركز الرئيسي';
  const rows = (A.assetRows || []).filter(a => !a.disposed && a.fund && a.fund !== 'none' && Number(a.cost) > 0);
  const tests = (ops.impairTests || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const save = async () => {
    const x = { id: uid('imp'), kind: f.kind, assetId: f.assetId, amount: Math.round((Number(String(f.amount).replace(/[^\d.]/g, '')) || 0) * 100) / 100, date: f.date, reason: f.reason.trim(), status: 'pending', by: me.name, byId: me.id || '', at: nowISO() };
    const e = impCheck(org, ops, x, A); if (e) return say(e, 'no');
    const ok = await commit(d => { const n = (d.impairDocs || []).reduce((m, y) => Math.max(m, Number(String(y.no || '').replace(/\D/g, '')) || 0), 0) + 1; return { ...d, impairDocs: [...(d.impairDocs || []), { ...x, no: 'IMP-' + String(n).padStart(4, '0') }] }; },
      { actionType: 'create', targetType: 'journal_entry', targetId: x.id, need: 'post', title: KIND[x.kind] + ' أصل — ' + f.name, details: money(x.amount) + ' · ' + x.reason });
    if (ok) { setF(null); say('أُرسل للاعتماد — يعتمده غيرك ✓'); } };
  const decide = async (x, okd) => { let err = '';
    if (!okd) { const why = window.prompt('سبب الرفض (إلزامي):', ''); if (!why || !why.trim()) return; if (!canApproveJe(me, x)) return say('لا يرفضه من أنشأه', 'no');
      if (await commit(d => ({ ...d, impairDocs: (d.impairDocs || []).map(y => y.id === x.id && y.status === 'pending' ? { ...y, status: 'rejected', rejBy: me.name, rejAt: nowISO(), rejWhy: why.trim() } : y) }), { actionType: 'reject', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'رفض ' + KIND[x.kind], details: why.trim() })) say('رُفض'); return; }
    const ok = await commit(d => { const r = impApprove(org, d, x.id, me, A); if (r.err) { err = r.err; return d; } return r.next; }, { actionType: 'approve', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'اعتماد ' + KIND[x.kind], details: money(x.amount) });
    if (err) return say(err, 'no'); if (ok) say('اعتُمد — القيد وإعادة قسط الإهلاك للمستقبل ✓'); };
  const saveTest = async () => { if (!String(t.notes || '').trim()) return say('اكتب ما فحصته (الفروع الخاسرة، الإغلاقات، التلف…)', 'no');
    const rec = { id: uid('imt'), year: String(t.date).slice(0, 4), date: t.date, result: t.result, notes: t.notes.trim(), by: me.name, byId: me.id || '', at: nowISO() };
    if (await commit(d => ({ ...d, impairTests: [...(d.impairTests || []), rec] }), { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'اختبار مؤشرات الهبوط ' + rec.year, details: rec.result === 'none' ? 'لا مؤشرات' : 'توجد مؤشرات' })) { setT(null); say('سُجّل الاختبار ✓'); } };
  return (<div className="card" data-impair>
    <div className="card-h"><div className="card-t"><TrendingDown size={15} color="var(--brass)" />هبوط قيمة الأصول</div>
      {canPost && <button className="btn sm" onClick={() => setT({ date: today(), result: 'none', notes: '' })} data-imt-new><ClipboardCheck size={13} />اختبار المؤشرات</button>}</div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      عند مؤشر (فرع خاسر، إغلاق، تلف، تقادم) يُدخل المحاسب الهبوط بمبلغه ومستنده (تقييم أو دراسة) ويعتمده غيره. يُعاد قسط الإهلاك بعده على المتبقي للمستقبل فقط، والعكس في حدود الدفتري لو لم يقع هبوط.
      اختبار المؤشرات مطلوب في كل إقفال سنوي على الأقل{tests[0] ? ' — آخره ' + tests[0].date + ' (' + (tests[0].result === 'none' ? 'لا مؤشرات' : 'توجد مؤشرات') + ')' : ''}.</div>
    {pend.map(x => { const a = (org.assets || []).find(y => y.id === x.assetId) || {}; return <div key={x.id} className="me-row" data-imp-doc={x.id}><span className="me-a"><b>{KIND[x.kind]} · {a.name} · <span className="num">{money(x.amount)}</span></b><small>{x.date} · {x.reason} · أنشأه {x.by}</small></span>
      {canApproveJe(me, x) ? <span className="row" style={{ gap: 4 }}><button className="btn sm pri" onClick={() => decide(x, true)} data-imp-ok><Check size={13} />اعتماد</button><button className="btn sm gh" onClick={() => decide(x, false)} data-imp-no><X size={13} />رفض</button></span>
        : <span className="badge b-amber" data-imp-wait>بانتظار الاعتماد</span>}</div>; })}
    <div className="tw"><table className="tb"><thead><tr><th>الأصل</th><th>مركز التكلفة</th><th style={{ textAlign: 'end' }}>التكلفة</th><th style={{ textAlign: 'end' }}>الهبوط</th><th style={{ textAlign: 'end' }}>الدفتري</th><th /></tr></thead>
      <tbody>{rows.map(a => <tr key={a.id} data-imp-row={a.id}><td style={{ fontWeight: 600 }}>{a.name}</td><td>{brName(a.branchId)}</td><td className="num" style={{ textAlign: 'end' }}>{money(a.cost)}</td>
        <td className="num" style={{ textAlign: 'end' }}>{a.impBal ? money(a.impBal) : '—'}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(a.book)}</td>
        <td>{canPost && <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><button className="btn sm gh" onClick={() => setF({ kind: 'imp', assetId: a.id, name: a.name, amount: '', date: today(), reason: '' })} data-imp-new>هبوط</button>
          {a.impBal > 0.004 && <button className="btn sm gh" onClick={() => setF({ kind: 'rev', assetId: a.id, name: a.name, amount: '', date: today(), reason: '' })} data-imp-rev>عكس</button>}</div>}</td></tr>)}
        {!rows.length && <tr><td colSpan={6}><div className="empty">لا أصول قائمة بقيد شراء</div></td></tr>}</tbody></table></div>
    {f && (() => { const a = (org.assets || []).find(y => y.id === f.assetId) || {}; const B = f.date ? assetBookOn(a, ops, f.date) : null;
      return <Modal title={KIND[f.kind] + ' — ' + f.name} icon={TrendingDown} onClose={() => setF(null)}
        foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save} data-imp-save><Check size={14} />إرسال للاعتماد</button></>}>
        <div className="grid g2">
          <Field label="المبلغ (ر.س)"><input className="inp n" inputMode="decimal" aria-label="مبلغ الهبوط" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="التاريخ (في الشهر الجاري — يُعتمد قبل نهايته، وإلا يُعاد إدخاله في الشهر التالي)"><input type="date" className="inp" aria-label="تاريخ الهبوط" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field></div>
        <Field label="المؤشر والمستند (إلزامي)"><input className="inp" aria-label="سبب الهبوط" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="مثال: إغلاق الفرع — تقييم مقيّم معتمد رقم …" /></Field>
        {B && <div className="note" style={{ marginTop: 8 }}>الدفتري في التاريخ <b className="num">{money(B.book)}</b> · رصيد الهبوط <b className="num">{money(B.impBal)}</b>{f.kind === 'rev' ? <> · حد العكس (27.30) <b className="num">{money(Math.max(0, Math.min(B.impBal, B.book0 - B.book)))}</b></> : null}. القيد بعد الاعتماد: {f.kind === 'imp' ? 'مدين خسارة الهبوط / دائن مجمع الهبوط' : 'مدين مجمع الهبوط / دائن خسارة الهبوط'}، والإهلاك يُعاد قسطًا ثابتًا من الشهر التالي.{B.book - (Number(f.amount) || 0) < (Number(a.salvage) || 0) - 0.004 && f.kind === 'imp' ? ' تنبيه: الدفتري بعد الهبوط أقل من القيمة المتبقية — راجع القيمة المتبقية للأصل (17.19).' : ''}</div>}
      </Modal>; })()}
    {t && <Modal title="اختبار مؤشرات الهبوط" icon={ClipboardCheck} onClose={() => setT(null)}
      foot={<><button className="btn gh" onClick={() => setT(null)}>إلغاء</button><button className="btn pri" onClick={saveTest} data-imt-save><Check size={14} />تسجيل</button></>}>
      <div className="grid g2">
        <Field label="التاريخ"><input type="date" className="inp" aria-label="تاريخ الاختبار" value={t.date} onChange={e => setT({ ...t, date: e.target.value })} /></Field>
        <Field label="النتيجة"><select className="sel" aria-label="نتيجة الاختبار" value={t.result} onChange={e => setT({ ...t, result: e.target.value })}><option value="none">لا مؤشرات هبوط</option><option value="indicator">توجد مؤشرات — يلزم تقدير</option></select></Field></div>
      <Field label="ما فُحص (إلزامي)"><input className="inp" aria-label="ملاحظات الاختبار" value={t.notes} onChange={e => setT({ ...t, notes: e.target.value })} placeholder="الفروع الخاسرة، الإغلاقات، التلف، التقادم…" /></Field>
    </Modal>}
  </div>);
}
