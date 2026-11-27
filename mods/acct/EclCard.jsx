/* v56.40 — الدفعة 7 (قرارات المجلس E6): مخصص الخسائر الائتمانية المحدد لكل عميل.
   المحاسب يُنشئ (تكوين/عكس/شطب) بدليل، ويعتمده غيره؛ القيد بعد الاعتماد وحده. الشطب على المخصص وعلى فاتورة بعينها. */
import React, { useState } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';
import { eclAllowBal, eclCheck, eclApprove, eclWoOf, eclRecOf, canApproveJe, siRem, arDocs, Field, Modal, money, uid, nowISO, today } from '../../App.jsx';

const KIND = { prov: 'تكوين مخصص', rel: 'عكس مخصص زائد', wo: 'شطب دين معدوم', rec: 'استرداد دين مشطوب' };

export function EclCard({ org, ops, A, me, commit, say, arRows, canPost }) {
  const [f, setF] = useState(null);
  const docs = ops.eclDocs || []; const pend = docs.filter(x => x.status === 'pending');
  const AR = arDocs(ops, org);   // v56.46: فواتير المبيعات + مستندات ذمم الكاشير المرحّلة (pos:)
  const invs = (key) => AR.filter(x => x.customerKey === key && siRem(ops, x) > 0.004);
  const woInvs = (key) => AR.filter(x => x.customerKey === key && eclWoOf(ops, x.id) - eclRecOf(ops, x.id) > 0.004);
  const allRows = [...arRows]; AR.forEach(x => { if (woInvs(x.customerKey).length && !allRows.some(r => r.p.key === x.customerKey)) allRows.push({ p: { key: x.customerKey, name: (x.buyer || {}).name || x.customerKey }, total: 0, b90: 0 }); });
  const rows = allRows.filter(r => r.total > 0.004 || eclAllowBal(ops, r.p.key) > 0.004 || woInvs(r.p.key).length).map(r => ({ ...r, allow: eclAllowBal(ops, r.p.key) }));
  const r2 = (n) => Math.round(n * 100) / 100; const totAllow = r2(rows.reduce((t, r) => t + r.allow, 0));
  const open = (r, kind) => setF({ kind, customerKey: r.p.key, custName: r.p.name, amount: '', date: today(), reason: '', siId: '', branchId: '' });
  const brs = (org.branches || []).filter(b => b.isActive !== false);
  const save = async () => {
    const x = { id: uid('ecl'), kind: f.kind, customerKey: f.customerKey, custName: f.custName, amount: Math.round((Number(String(f.amount).replace(/[^\d.]/g, '')) || 0) * 100) / 100,
      date: f.date, reason: f.reason.trim(), ...(f.kind === 'wo' || f.kind === 'rec' ? { siId: f.siId } : (f.branchId ? { branchId: f.branchId } : {})), status: 'pending', by: me.name, byId: me.id || '', at: nowISO() };
    const e = eclCheck(org, ops, x, A); if (e) return say(e, 'no');
    // الترقيم داخل الحفظ على أحدث نسخة (لا يتكرر بين مستخدمين)
    const ok = await commit(d => { const n = (d.eclDocs || []).reduce((m, y) => Math.max(m, Number(String(y.no || '').replace(/\D/g, '')) || 0), 0) + 1; return { ...d, eclDocs: [...(d.eclDocs || []), { ...x, no: 'ECL-' + String(n).padStart(4, '0') }] }; }, { actionType: 'create', targetType: 'journal_entry', targetId: x.id, need: 'post', title: KIND[x.kind] + ' — ' + x.custName, details: money(x.amount) + ' · ' + x.reason });
    if (ok) { setF(null); say('أُرسل للاعتماد — يعتمده غيرك ✓'); } };
  const decide = async (x, okd) => {
    if (!okd) { const why = window.prompt('سبب الرفض (إلزامي):', ''); if (!why || !why.trim()) return;
      if (!canApproveJe(me, x)) return say('لا يرفضه من أنشأه', 'no');
      const ok = await commit(d => ({ ...d, eclDocs: (d.eclDocs || []).map(y => y.id === x.id && y.status === 'pending' ? { ...y, status: 'rejected', rejBy: me.name, rejAt: nowISO(), rejWhy: why.trim() } : y) }), { actionType: 'reject', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'رفض ' + KIND[x.kind], details: why.trim() });
      if (ok) say('رُفض'); return; }
    let err = ''; const ok = await commit(d => { const r = eclApprove(org, d, x.id, me, A); if (r.err) { err = r.err; return d; } return r.next; }, { actionType: 'approve', targetType: 'journal_entry', targetId: x.id, need: 'post', title: 'اعتماد ' + KIND[x.kind] + ' — ' + (x.custName || ''), details: money(x.amount) });
    if (err) return say(err, 'no'); if (ok) say('اعتُمد ورُحّل القيد ✓'); };
  return (<div className="card" data-ecl>
    <div className="card-h"><div className="card-t"><ShieldAlert size={15} color="var(--brass)" />مخصص الخسائر الائتمانية (محدد لكل عميل)</div>
      <span className="badge b-dim">رصيد المخصص <b className="num">{money(totAllow)}</b></span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      الأعمار أعلاه من <b>تاريخ الاستحقاق</b>. عند دليل على تعثر عميل (تأخر طويل، نزاع، إفلاس) كوّن مخصصًا بقيمة المتوقع عدم تحصيله؛ والشطب يكون على المخصص وعلى فاتورة بعينها.
      كل مستند يعتمده غير منشئه، ولا يُقيَّد قبل الاعتماد. راجع المخصص شهريًا عند الإقفال.</div>
    {pend.length > 0 && <div data-ecl-pend style={{ marginBottom: 8 }}>
      {pend.map(x => <div key={x.id} className="me-row" data-ecl-doc={x.id}><span className="me-a"><b>{KIND[x.kind]} · {x.custName} · <span className="num">{money(x.amount)}</span></b><small>{x.date} · {x.reason} · أنشأه {x.by}</small></span>
        {canApproveJe(me, x) ? <span className="row" style={{ gap: 4 }}><button className="btn sm pri" onClick={() => decide(x, true)} data-ecl-ok><Check size={13} />اعتماد</button><button className="btn sm gh" onClick={() => decide(x, false)} data-ecl-no><X size={13} />رفض</button></span>
          : <span className="badge b-amber" data-ecl-wait>بانتظار الاعتماد</span>}</div>)}</div>}
    <div className="tw"><table className="tb">
      <thead><tr><th>العميل</th><th style={{ textAlign: 'end' }}>الذمة</th><th style={{ textAlign: 'end' }}>متأخر +90</th><th style={{ textAlign: 'end' }}>المخصص</th><th style={{ textAlign: 'end' }}>الصافي</th><th /></tr></thead>
      <tbody>{rows.map(r => <tr key={r.p.key} data-ecl-row={r.p.key}><td style={{ fontWeight: 600 }}>{r.p.name}</td>
        <td className="num" style={{ textAlign: 'end' }}>{money(r.total)}</td><td className="num" style={{ textAlign: 'end', color: r.b90 ? 'var(--rose)' : 'inherit' }}>{r.b90 ? money(r.b90) : '—'}</td>
        <td className="num" style={{ textAlign: 'end' }}>{r.allow ? money(r.allow) : '—'}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(r2(r.total - r.allow))}</td>
        <td>{canPost && <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
          <button className="btn sm gh" onClick={() => open(r, 'prov')} data-ecl-prov>تكوين</button>
          {r.allow > 0.004 && <button className="btn sm gh" onClick={() => open(r, 'rel')} data-ecl-rel>عكس</button>}
          {r.allow > 0.004 && invs(r.p.key).length > 0 && <button className="btn sm gh" onClick={() => open(r, 'wo')} data-ecl-wo>شطب</button>}
          {woInvs(r.p.key).length > 0 && <button className="btn sm gh" onClick={() => open(r, 'rec')} data-ecl-rec>استرداد</button>}</div>}</td></tr>)}
        {!rows.length && <tr><td colSpan={6}><div className="empty">لا ذمم عملاء قائمة</div></td></tr>}</tbody></table></div>
    {f && <Modal title={KIND[f.kind] + ' — ' + f.custName} icon={ShieldAlert} onClose={() => setF(null)}
      foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save} data-ecl-save><Check size={14} />إرسال للاعتماد</button></>}>
      <div className="grid g2">
        <Field label="المبلغ (ر.س)"><input className="inp n" inputMode="decimal" aria-label="مبلغ المخصص" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" className="inp" aria-label="تاريخ المخصص" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
      </div>
      {(f.kind === 'prov' || f.kind === 'rel') && brs.length > 0 && <Field label="مركز التكلفة (اختياري)"><select className="sel" aria-label="فرع المخصص" value={f.branchId} onChange={e => setF({ ...f, branchId: e.target.value })}><option value="">المركز الرئيسي</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
      {f.kind === 'rec' && <Field label="الفاتورة المشطوبة المسترَدة"><select className="sel" aria-label="الفاتورة المسترَدة" value={f.siId} onChange={e => setF({ ...f, siId: e.target.value })}>
        <option value="">— اختر —</option>{woInvs(f.customerKey).map(x => <option key={x.id} value={x.id}>{x.no} · مشطوب غير مسترد {money(eclWoOf(ops, x.id) - eclRecOf(ops, x.id))}</option>)}</select></Field>}
      {f.kind === 'wo' && <Field label="الفاتورة المشطوبة"><select className="sel" aria-label="الفاتورة المشطوبة" value={f.siId} onChange={e => setF({ ...f, siId: e.target.value, amount: f.amount || String(siRem(ops, (ops.salesInvoices || []).find(x => x.id === e.target.value) || {})) })}>
        <option value="">— اختر —</option>{invs(f.customerKey).map(x => <option key={x.id} value={x.id}>{x.no} · {x.date} · متبقٍّ {money(siRem(ops, x))}</option>)}</select></Field>}
      <Field label="الدليل أو السبب (إلزامي)"><input className="inp" aria-label="سبب المخصص" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="مثال: متأخر 6 أشهر ورفض السداد كتابيًا" /></Field>
      <div className="note" style={{ marginTop: 8 }}>{f.kind === 'rec' ? 'القيد بعد الاعتماد: مدين ذمة العميل 1380 / دائن مصروف الخسائر الائتمانية (عكس الخسارة عبر الأرباح والخسائر)، فتعود الفاتورة مستحقة وتُحصَّل من «فواتير المبيعات».' : f.kind === 'prov' ? 'القيد بعد الاعتماد: مدين مصروف الخسائر الائتمانية / دائن المخصص.' : f.kind === 'rel' ? 'القيد بعد الاعتماد: مدين المخصص / دائن مصروف الخسائر الائتمانية (عند تحصيل أو زوال الدليل).' : 'القيد بعد الاعتماد: مدين المخصص / دائن ذمة العميل 1380 — لا يتجاوز رصيد مخصص العميل ولا متبقي الفاتورة. لا أثر ضريبي هنا.'}</div>
    </Modal>}
  </div>);
}
