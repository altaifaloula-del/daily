/* v56.41 — الدفعة 6 (قرارات المجلس E5): الموازنات بالإصدارات — حساب × شهر × فرع، يعدّها المحاسب ويعتمدها المالك أو الإدارة المالية غير المُعدّ.
   المعتمد لا يُعدَّل (التعديل إصدار جديد)، والتجاوز ينبّه ولا يمنع. الموازنة القديمة تُقرأ إصدارًا صفريًا. */
import React, { useState, useMemo } from 'react';
import { Target, Check, X, Plus, Send, Download } from 'lucide-react';
import { BUD_ST, budActive, budMonthMap, budCanApprove, budNewVersion, budApprove, money, nowISO, makeXlsx } from '../../App.jsx';

const MN = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function BudgetV({ org, ops, A, me, commit, say, canPost }) {
  const now = new Date(); const [year, setYear] = useState(String(now.getFullYear())); const [mon, setMon] = useState(now.getMonth() + 1);
  const [br, setBr] = useState('*'); const [ed, setEd] = useState(null);   // ed: { id, br, map: { code: [12] } }
  const brs = (org.branches || []).filter(b => b.isActive !== false);
  const vs = (ops.budgets || []).filter(b => String(b.year) === year).sort((a, b) => (b.ver || 0) - (a.ver || 0));
  const B = budActive(org, ops, year); const draft = vs.find(b => b.status === 'draft' || b.status === 'submitted');
  const accs = (A.accounts || []).filter(a => (a.kind === 'rev' || a.kind === 'exp') && !['4201', '5801', '5150'].includes(a.code));
  const bf = br === '*' ? undefined : br;
  const BM = B ? budMonthMap(B, mon, bf) : {};
  const ym = year + '-' + String(mon).padStart(2, '0');
  const act = useMemo(() => { const M = {}; (A.entries || []).forEach(e => { if (e.closing || String(e.date || '').slice(0, 7) !== ym) return;   // قيد الإقفال السنوي لا يدخل الفعلي if (bf !== undefined && String(e.branchId || '') !== bf) return;
    (e.lines || []).forEach(l => { M[l.code] = (M[l.code] || 0) + (Number(l.debit) || 0) - (Number(l.credit) || 0); }); }); return M; }, [A, ym, bf]);
  const rows = accs.map(a => { const budget = r2(BM[a.code] || 0); const actual = r2(a.kind === 'exp' ? (act[a.code] || 0) : -(act[a.code] || 0)); const v = r2(actual - budget);
    return { a, budget, actual, v, over: a.kind === 'exp' ? v > 0.005 : v < -0.005 }; }).filter(r => r.budget || Math.abs(r.actual) > 0.004);
  const save = (fn, log) => commit(fn, { actionType: 'update', targetType: 'budget', targetId: 'budget-' + year, need: 'post', ...log });
  const newV = async () => { if (!canPost) return; if (draft) return say('يوجد إصدار مسودة أو مرفوع لهذه السنة', 'no');
    const x = budNewVersion(ops, year, me, B && !B.legacy ? B : null);
    if (await save(d => ({ ...d, budgets: [...(d.budgets || []), budNewVersion(d, year, me, B && !B.legacy ? B : null)] }), { title: 'إصدار موازنة جديد ' + year, details: 'الإصدار ' + x.ver })) say('أُنشئ الإصدار ' + x.ver + ' (مسودة) ✓'); };
  const openEd = (b) => { const map = {}; const bk = br === '*' ? '' : br;
    (b.lines || []).filter(l => String(l.branchId || '') === bk).forEach(l => { const m = map[l.code] || (map[l.code] = Array(12).fill('')); m[Number(l.month) - 1] = String(l.amount); });
    setEd({ id: b.id, br: bk, map }); };
  const saveEd = async () => { const b = (ops.budgets || []).find(x => x.id === ed.id); if (!b || b.status !== 'draft') return say('الإصدار لم يعد مسودة', 'no');
    const keep = (b.lines || []).filter(l => String(l.branchId || '') !== ed.br);
    const add = []; Object.entries(ed.map).forEach(([code, arr]) => arr.forEach((v, i) => { const a = r2(String(v).replace(/[^\d.]/g, '')); if (a > 0) add.push({ code, month: i + 1, ...(ed.br ? { branchId: ed.br } : {}), amount: a }); }));
    if (await save(d => ({ ...d, budgets: (d.budgets || []).map(x => x.id === ed.id && x.status === 'draft' ? { ...x, lines: [...keep, ...add], editedAt: nowISO() } : x) }), { title: 'تعديل مسودة موازنة ' + year, details: add.length + ' سطر' })) { setEd(null); say('حُفظت المسودة ✓'); } };
  const submit = async (b) => { if (await save(d => ({ ...d, budgets: (d.budgets || []).map(x => x.id === b.id && x.status === 'draft' ? { ...x, status: 'submitted', submittedAt: nowISO() } : x) }), { title: 'رفع موازنة ' + year + ' للاعتماد', details: 'الإصدار ' + b.ver })) say('رُفعت للاعتماد ✓'); };
  const decide = async (b, ok) => { let err = '';
    if (!ok) { const why = window.prompt('سبب الرفض (إلزامي):', ''); if (!why || !why.trim()) return; if (!budCanApprove(me, b)) return say('يرفضها المعتمد غير المُعدّ', 'no');
      if (await save(d => ({ ...d, budgets: (d.budgets || []).map(x => x.id === b.id && x.status === 'submitted' ? { ...x, status: 'draft', rejWhy: why.trim(), rejBy: me.name, rejAt: nowISO() } : x) }), { actionType: 'reject', title: 'إعادة موازنة ' + year + ' للمُعدّ', details: why.trim() })) say('أُعيدت مسودةً للمُعدّ'); return; }
    const done = await save(d => { const r = budApprove(d, b.id, me); if (r.err) { err = r.err; return d; } return r.next; }, { actionType: 'approve', title: 'اعتماد موازنة ' + year, details: 'الإصدار ' + b.ver });
    if (err) return say(err, 'no'); if (done) say('اعتُمدت — صارت الموازنة السارية ✓'); };
  const xl = () => { const head = ['الحساب', 'الموازنة', 'الفعلي', 'الانحراف'];
    try { const blob = makeXlsx([{ name: 'الموازنة ' + ym, rows: [head, ...rows.map(r => [r.a.code + ' ' + r.a.name, r.budget, r.actual, r.v])] }]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'الموازنة_' + ym + '.xlsx'; a.click(); } catch { say('تعذّر التصدير', 'no'); } };
  return (<div className="grid" style={{ gap: 12 }} data-budv>
    <div className="card">
      <div className="card-h"><div className="card-t"><Target size={15} color="var(--brass)" />الموازنة بالإصدارات</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input className="inp n" style={{ width: 80 }} aria-label="سنة الموازنة" value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <select className="sel" aria-label="شهر المقارنة" value={mon} onChange={e => setMon(Number(e.target.value))}>{MN.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
          <select className="sel" aria-label="فرع الموازنة" value={br} onChange={e => setBr(e.target.value)}><option value="*">كل الفروع</option><option value="">مركزي (بلا فرع)</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <button className="btn sm" onClick={xl}><Download size={13} />Excel</button>
        </div></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        الموازنة السارية: {B ? (B.legacy ? <b>الموازنة السابقة (إصدار صفري — المبلغ نفسه كل شهر)</b> : <b>الإصدار {B.ver} المعتمد{B.apprBy ? ' — اعتمدها ' + B.apprBy : ''}</b>) : <b>لا موازنة معتمدة لهذه السنة</b>}.
        التجاوز يُنبَّه إليه ولا يمنع الصرف.</div>
      <div className="tw"><table className="tb" data-budv-table><thead><tr><th>الحساب</th><th style={{ textAlign: 'end' }}>الموازنة</th><th style={{ textAlign: 'end' }}>الفعلي</th><th style={{ textAlign: 'end' }}>الانحراف</th><th>الحالة</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.a.code}><td>{r.a.code} · {r.a.name}</td><td className="num" style={{ textAlign: 'end' }}>{r.budget ? money(r.budget) : '—'}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.actual)}</td>
          <td className={'num' + (r.over ? ' neg' : '')} style={{ textAlign: 'end' }}>{money(r.v)}</td><td><span className={'badge ' + (r.over ? 'b-rose' : 'b-mint')}>{r.a.kind === 'exp' ? (r.over ? 'تجاوز' : 'ضمن الموازنة') : (r.over ? 'دون الهدف' : 'تحقّق الهدف')}</span></td></tr>)}
          {!rows.length && <tr><td colSpan={5}><div className="empty">لا موازنة ولا حركة لهذا الشهر</div></td></tr>}</tbody></table></div>
    </div>
    <div className="card">
      <div className="card-h"><div className="card-t">إصدارات {year}</div>{canPost && !draft && <button className="btn sm pri" onClick={newV} data-budv-new><Plus size={13} />إصدار جديد</button>}</div>
      {vs.map(b => <div key={b.id} className="me-row" data-budv-ver={b.ver}><span className="me-a"><b>الإصدار {b.ver} · {BUD_ST[b.status] || b.status}</b><small>أعدّه {b.by}{b.apprBy ? ' · اعتمده ' + b.apprBy : ''}{b.rejWhy ? ' · أُعيد: ' + b.rejWhy : ''} · {(b.lines || []).length} سطر</small></span>
        <span className="row" style={{ gap: 4 }}>
          {b.status === 'draft' && canPost && <><button className="btn sm gh" onClick={() => openEd(b)} data-budv-edit>تعديل ({br === '*' || br === '' ? 'مركزي' : (brs.find(x => x.id === br) || {}).name})</button><button className="btn sm" onClick={() => submit(b)} data-budv-submit><Send size={13} />رفع للاعتماد</button></>}
          {b.status === 'submitted' && (budCanApprove(me, b) ? <><button className="btn sm pri" onClick={() => decide(b, true)} data-budv-ok><Check size={13} />اعتماد</button><button className="btn sm gh" onClick={() => decide(b, false)} data-budv-no><X size={13} />إعادة</button></>
            : <span className="badge b-amber" data-budv-wait>بانتظار اعتماد المالك أو الإدارة المالية</span>)}
        </span></div>)}
      {!vs.length && <div className="empty">لا إصدارات بعد — «إصدار جديد» يبدأ مسودة{B && !B.legacy ? ' منسوخة من المعتمد' : ''}.</div>}
    </div>
    {ed && <div className="card" data-budv-editor>
      <div className="card-h"><div className="card-t">تعديل المسودة — {ed.br ? (brs.find(x => x.id === ed.br) || {}).name : 'مركزي (بلا فرع)'}</div>
        <span className="row" style={{ gap: 4 }}><button className="btn sm gh" onClick={() => setEd(null)}>إلغاء</button><button className="btn sm pri" onClick={saveEd} data-budv-save><Check size={13} />حفظ المسودة</button></span></div>
      <div className="tw"><table className="tb"><thead><tr><th>الحساب</th>{MN.map(m => <th key={m} style={{ textAlign: 'end' }}>{m}</th>)}</tr></thead>
        <tbody>{accs.map(a => <tr key={a.code}><td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{a.code} · {a.name}</td>{MN.map((m, i) => <td key={m}><input className="inp n" style={{ width: 76 }} aria-label={'موازنة ' + a.code + ' ' + m} inputMode="decimal"
          value={((ed.map[a.code] || [])[i]) || ''} onChange={e => setEd(s => { const arr = (s.map[a.code] || Array(12).fill('')).slice(); arr[i] = e.target.value.replace(/[^\d.]/g, ''); return { ...s, map: { ...s.map, [a.code]: arr } }; })} /></td>)}</tr>)}</tbody></table></div>
    </div>}
  </div>);
}
