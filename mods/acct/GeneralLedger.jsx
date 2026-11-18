/* v49.4 — المرحلة 03: دفتر الأستاذ العام (كشف أي حساب برصيد جارٍ) وحركة الحسابات — كل سطر يُفتح على قيده (Drill-down) */
import React, { useMemo, useState } from 'react';
import { FileText as BookOpen, Printer, Download, ArrowLeftRight } from 'lucide-react';
import { glLedger, acctActivity, DocLink, money, printA4, makeXlsx, _xe, projList } from '../../App.jsx';

const fmt = (n) => n < 0 ? '(' + money(-n) + ')' : money(n);
const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); };

export function GeneralLedger({ org, ops, A, mode, code, setCode, from, to, bf, setBf, onMode }) {
  const [sub, setSub] = useState(true);
  const [prj, setPrj] = useState('');
  const [q, setQ] = useState('');
  const accs = (A.accounts || []);
  const bfName = !bf ? 'كل الفروع والمركز' : bf === 'central' ? 'القيود المركزية' : (((org.branches || []).find(b => b.id === bf) || {}).name || bf);
  const per = (from || to) ? ((from || '…') + ' ← ' + (to || '…')) : 'كل الفترات';
  const L = useMemo(() => code ? glLedger(A, code, { from, to, bf, sub, projectId: prj }) : null, [A, code, from, to, bf, sub, prj]);
  const M = useMemo(() => mode === 'act' ? acctActivity(A, { from, to, bf, projectId: prj }) : null, [A, mode, from, to, bf, prj]);
  const brName = (id) => !id ? 'مركزي' : (((org.branches || []).find(b => b.id === id) || {}).name || id);
  const accName = (c) => (accs.find(a => a.code === c) || {}).name || c;
  const filters = (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select className="sel" style={{ width: 170 }} aria-label="فرع الدفتر" value={bf} onChange={e => setBf(e.target.value)}>
        <option value="">كل الفروع والمركز</option><option value="central">القيود المركزية فقط</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
      {projList(org).length > 0 && <select className="sel" style={{ width: 150 }} aria-label="مشروع الدفتر" value={prj} onChange={e => setPrj(e.target.value)}><option value="">كل المشاريع</option>{projList(org).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
    </div>);

  if (mode === 'act') {
    const rows = q ? M.rows.filter(r => r.code.includes(q) || String(r.name).includes(q)) : M.rows;
    const xl = () => dl(makeXlsx([{ name: 'حركة الحسابات', rows: [['الرمز', 'الحساب', 'رصيد أول المدة', 'مدين', 'دائن', 'رصيد آخر المدة'], ...M.rows.map(r => [r.code, r.name, r.open, r.debit, r.credit, r.close]), ['', 'الإجمالي', '', M.debit, M.credit, '']] }]), 'حركة_الحسابات.xlsx');
    const pr = () => printA4(org, 'حركة الحسابات', per + ' · ' + bfName, `<table><thead><tr><th>الرمز</th><th>الحساب</th><th>أول المدة</th><th>مدين</th><th>دائن</th><th>آخر المدة</th></tr></thead><tbody>${M.rows.map(r => `<tr><td class="n">${r.code}</td><td>${_xe(r.name)}</td><td class="n">${fmt(r.open)}</td><td class="n">${money(r.debit)}</td><td class="n">${money(r.credit)}</td><td class="n"><b>${fmt(r.close)}</b></td></tr>`).join('')}<tr><td></td><td><b>الإجمالي</b></td><td></td><td class="n"><b>${money(M.debit)}</b></td><td class="n"><b>${money(M.credit)}</b></td><td></td></tr></tbody></table>`);
    return (
      <div className="card" data-actmv>
        <div className="card-h"><div className="card-t"><ArrowLeftRight size={15} color="var(--brass)" />حركة الحسابات — {per}</div>
          <div className="row" style={{ gap: 6 }}>{filters}<button className="btn sm" onClick={pr}><Printer size={13} />طباعة</button><button className="btn sm" onClick={xl}><Download size={13} />Excel</button></div></div>
        <input className="inp" style={{ width: 200, marginBottom: 8 }} aria-label="بحث في الحسابات" placeholder="بحث بالرمز أو الاسم…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="tw"><table className="tb"><thead><tr><th>الرمز</th><th>الحساب</th><th style={{ textAlign: 'end' }}>رصيد أول المدة</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th><th style={{ textAlign: 'end' }}>رصيد آخر المدة</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.code}><td className="num">{r.code}</td>
            <td><button type="button" className="doclink" data-glopen={r.code} title="فتح دفتر الأستاذ" onClick={() => { setCode(r.code); onMode('gl'); }}>{r.name}</button></td>
            <td className="num" style={{ textAlign: 'end' }}>{r.open ? fmt(r.open) : '—'}</td><td className="num" style={{ textAlign: 'end' }}>{r.debit ? money(r.debit) : '—'}</td><td className="num" style={{ textAlign: 'end' }}>{r.credit ? money(r.credit) : '—'}</td>
            <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: r.close < 0 ? 'var(--rose)' : undefined }}>{fmt(r.close)}</td></tr>)}
          {!rows.length && <tr><td colSpan={6}><div className="empty">لا حركة في هذه الفترة.</div></td></tr>}
          <tr style={{ fontWeight: 800 }}><td colSpan={3}>الإجمالي {M.balanced ? '— متوازن ✓' : '— غير متوازن!'}</td><td className="num" style={{ textAlign: 'end' }}>{money(M.debit)}</td><td className="num" style={{ textAlign: 'end' }}>{money(M.credit)}</td><td /></tr>
        </tbody></table></div>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>اضغط اسم أي حساب لفتح دفتر أستاذه بالفترة نفسها، ثم رقم أي قيد لاستعراضه.</div>
      </div>);
  }

  const xl = () => L && dl(makeXlsx([{ name: 'دفتر الأستاذ', rows: [['التاريخ', 'رقم القيد', 'البيان', 'المصدر', 'الفرع', 'مدين', 'دائن', 'الرصيد'], ['', '', 'رصيد أول المدة', '', '', '', '', L.open], ...L.rows.map(r => [r.date, r.no || r.id, r.title, r.src || '', brName(r.branchId), r.debit, r.credit, r.bal]), ['', '', 'الإجمالي', '', '', L.debit, L.credit, L.close]] }]), 'دفتر_الأستاذ_' + L.acc.code + '.xlsx');
  const pr = () => L && printA4(org, 'دفتر الأستاذ — ' + L.acc.code + ' ' + L.acc.name, per + ' · ' + bfName + (sub ? '' : ' · بلا الحسابات الفرعية'),
    `<table><thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody><tr><td></td><td></td><td><b>رصيد أول المدة</b></td><td></td><td></td><td class="n"><b>${fmt(L.open)}</b></td></tr>${L.rows.map(r => `<tr><td class="n">${r.date}</td><td class="n">${_xe(String(r.no || ''))}</td><td>${_xe(r.title || '')}</td><td class="n">${r.debit ? money(r.debit) : ''}</td><td class="n">${r.credit ? money(r.credit) : ''}</td><td class="n">${fmt(r.bal)}</td></tr>`).join('')}<tr><td></td><td></td><td><b>الإجمالي ورصيد آخر المدة</b></td><td class="n"><b>${money(L.debit)}</b></td><td class="n"><b>${money(L.credit)}</b></td><td class="n"><b>${fmt(L.close)}</b></td></tr></tbody></table>`);
  return (
    <div className="card" data-gl>
      <div className="card-h"><div className="card-t"><BookOpen size={15} color="var(--brass)" />دفتر الأستاذ — {per}</div>
        <div className="row" style={{ gap: 6 }}>{filters}<button className="btn sm" onClick={pr} disabled={!L}><Printer size={13} />طباعة</button><button className="btn sm" onClick={xl} disabled={!L}><Download size={13} />Excel</button></div></div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select className="sel" style={{ minWidth: 260 }} aria-label="الحساب" value={code} onChange={e => setCode(e.target.value)}>
          <option value="">اختر الحساب…</option>{accs.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select>
        <label className="row" style={{ gap: 5, fontSize: 12.5 }}><input type="checkbox" checked={sub} onChange={e => setSub(e.target.checked)} />مع الحسابات الفرعية</label>
      </div>
      {!L ? <div className="empty">اختر حسابًا لعرض كشفه برصيد جارٍ — أو اضغط اسم حساب في «ميزان المراجعة» أو «حركة الحسابات».</div> : <>
        <div className="tw"><table className="tb" data-gltable><thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>المقابل</th><th style={{ textAlign: 'end' }}>مدين</th><th style={{ textAlign: 'end' }}>دائن</th><th style={{ textAlign: 'end' }}>الرصيد</th></tr></thead><tbody>
          <tr style={{ background: 'rgba(200,162,74,.05)' }}><td colSpan={6}><b>رصيد أول المدة</b></td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }} data-glopen-bal>{fmt(L.open)}</td></tr>
          {L.rows.map(r => <tr key={r.id}><td className="num" style={{ whiteSpace: 'nowrap' }}>{r.date}</td><td className="num"><DocLink to={{ e: r.id }} title="استعراض القيد">{r.no || '—'}</DocLink></td>
            <td style={{ fontSize: 12.5 }}>{r.title}{r.src ? <span className="badge b-dim" style={{ marginInlineStart: 6, fontSize: 10 }}>{r.src}</span> : null}{r.codes.length > 1 || r.codes[0] !== L.acc.code ? <div className="num" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{r.codes.join('، ')}</div> : null}</td>
            <td style={{ fontSize: 11.5, color: 'var(--dim)' }}>{r.against.map(accName).join('، ')}</td>
            <td className="num" style={{ textAlign: 'end' }}>{r.debit ? money(r.debit) : ''}</td><td className="num" style={{ textAlign: 'end' }}>{r.credit ? money(r.credit) : ''}</td>
            <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: r.bal < 0 ? 'var(--rose)' : undefined }}>{fmt(r.bal)}</td></tr>)}
          {!L.rows.length && <tr><td colSpan={7}><div className="empty">لا حركة على الحساب في الفترة.</div></td></tr>}
          <tr style={{ fontWeight: 800 }}><td colSpan={4}>الإجمالي ورصيد آخر المدة</td><td className="num" style={{ textAlign: 'end' }}>{money(L.debit)}</td><td className="num" style={{ textAlign: 'end' }}>{money(L.credit)}</td><td className="num" style={{ textAlign: 'end' }} data-glclose>{fmt(L.close)}</td></tr>
        </tbody></table></div>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>الرصيد بطبيعة الحساب ({L.nat > 0 ? 'مدين' : 'دائن'})؛ القيمة بين قوسين = رصيد عكس الطبيعة. اضغط رقم القيد لاستعراضه ومستنده.</div>
      </>}
    </div>);
}
