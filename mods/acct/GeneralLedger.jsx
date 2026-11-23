/* v49.4 — المرحلة 03: دفتر الأستاذ العام (كشف أي حساب برصيد جارٍ) وحركة الحسابات — كل سطر يُفتح على قيده (Drill-down) */
import React, { useMemo, useState } from 'react';
import { FileText as BookOpen, Printer, Download, ArrowLeftRight } from 'lucide-react';
import { glLedger, acctActivity, DocLink, money, printA4, makeXlsx, _xe, projList, peekDoc, APP_VER } from '../../App.jsx';
import { RptTable } from '../rpt/RptTable.jsx';   // v50.0 نموذج منظومة التقارير الموحدة

const fmt = (n) => n < 0 ? '(' + money(-n) + ')' : money(n);
const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); };

export function GeneralLedger({ org, ops, A, mode, code, setCode, from, to, bf, setBf, onMode, me }) {
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
          <div className="row" style={{ gap: 6 }}>{filters}<span className="badge b-mint" data-actbal>{M.balanced ? 'متوازن ✓' : 'غير متوازن!'}</span></div></div>
        <RptTable org={org} me={me} onRow={(r) => { setCode(r.code); onMode('gl'); }} spec={{ id: 'actmv', title: 'حركة الحسابات', sub: per, template: 'list', meta: { user: (me && me.name) || '', source: 'مِثقال ' + APP_VER + ' — المحاسبة' },
          filters: [['الفرع', bfName]], columns: [{ key: 'code', label: 'الرمز', en: 'Code', w: 10 }, { key: 'name', label: 'الحساب', en: 'Account', w: 34 }, { key: 'open', label: 'رصيد أول المدة', en: 'Opening', type: 'money' }, { key: 'debit', label: 'مدين', en: 'Debit', type: 'money', total: 'sum' }, { key: 'credit', label: 'دائن', en: 'Credit', type: 'money', total: 'sum' }, { key: 'close', label: 'رصيد آخر المدة', en: 'Closing', type: 'money' }],
          rows: M.rows, notes: [M.balanced ? 'المدين = الدائن — متوازن ✓' : 'تنبيه: غير متوازن'] }} />
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>اضغط اسم أي حساب لفتح دفتر أستاذه بالفترة نفسها، ثم رقم أي قيد لاستعراضه.</div>
      </div>);
  }

  const xl = () => L && dl(makeXlsx([{ name: 'دفتر الأستاذ', rows: [['التاريخ', 'رقم القيد', 'البيان', 'المصدر', 'الفرع', 'مدين', 'دائن', 'الرصيد'], ['', '', 'رصيد أول المدة', '', '', '', '', L.open], ...L.rows.map(r => [r.date, (r.no || r.id) + (r.fix ? ' · ' + r.fix : ''), r.title, r.src || '', brName(r.branchId), r.debit, r.credit, r.bal]), ['', '', 'الإجمالي', '', '', L.debit, L.credit, L.close]] }]), 'دفتر_الأستاذ_' + L.acc.code + '.xlsx');
  const pr = () => L && printA4(org, 'دفتر الأستاذ — ' + L.acc.code + ' ' + L.acc.name, per + ' · ' + bfName + (sub ? '' : ' · بلا الحسابات الفرعية'),
    `<table><thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody><tr><td></td><td></td><td><b>رصيد أول المدة</b></td><td></td><td></td><td class="n"><b>${fmt(L.open)}</b></td></tr>${L.rows.map(r => `<tr><td class="n">${r.date}</td><td class="n">${_xe(String(r.no || '') + (r.fix ? ' · ' + r.fix : ''))}</td><td>${_xe(r.title || '')}</td><td class="n">${r.debit ? money(r.debit) : ''}</td><td class="n">${r.credit ? money(r.credit) : ''}</td><td class="n">${fmt(r.bal)}</td></tr>`).join('')}<tr><td></td><td></td><td><b>الإجمالي ورصيد آخر المدة</b></td><td class="n"><b>${money(L.debit)}</b></td><td class="n"><b>${money(L.credit)}</b></td><td class="n"><b>${fmt(L.close)}</b></td></tr></tbody></table>`);
  return (
    <div className="card" data-gl>
      <div className="card-h"><div className="card-t"><BookOpen size={15} color="var(--brass)" />دفتر الأستاذ — {per}</div>
        <div className="row" style={{ gap: 6 }}>{filters}</div></div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select className="sel" style={{ minWidth: 260 }} aria-label="الحساب" value={code} onChange={e => setCode(e.target.value)}>
          <option value="">اختر الحساب…</option>{accs.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select>
        <label className="row" style={{ gap: 5, fontSize: 12.5 }}><input type="checkbox" checked={sub} onChange={e => setSub(e.target.checked)} />مع الحسابات الفرعية</label>
      </div>
      {!L ? <div className="empty">اختر حسابًا لعرض كشفه برصيد جارٍ — أو اضغط اسم حساب في «ميزان المراجعة» أو «حركة الحسابات».</div> : <>
        <RptTable org={org} me={me} onRow={(r) => r.id && peekDoc({ e: r.id })} spec={{ id: 'gl', title: 'دفتر الأستاذ — ' + L.acc.code + ' ' + L.acc.name, sub: per, template: 'ledger', meta: { user: (me && me.name) || '', source: 'مِثقال ' + APP_VER + ' — المحاسبة' },
          filters: [['الفرع', bfName], ['الحسابات الفرعية', sub ? 'مشمولة' : 'غير مشمولة']], kpis: [{ label: 'رصيد أول المدة', value: fmt(L.open) }, { label: 'مدين الفترة', value: money(L.debit) }, { label: 'دائن الفترة', value: money(L.credit) }, { label: 'رصيد آخر المدة', value: fmt(L.close) }],
          columns: [{ key: 'date', label: 'التاريخ', en: 'Date', type: 'date' }, { key: 'no', label: 'القيد', en: 'Entry', w: 10 }, { key: 'title', label: 'البيان', en: 'Description', w: 36 }, { key: 'against', label: 'المقابل', en: 'Contra', w: 24 },
            { key: 'debit', label: 'مدين', en: 'Debit', type: 'money', total: 'sum' }, { key: 'credit', label: 'دائن', en: 'Credit', type: 'money', total: 'sum' }, { key: 'bal', label: 'الرصيد', en: 'Balance', type: 'money' }],
          rows: [{ date: '', no: '', title: 'رصيد أول المدة', against: '', bal: L.open, _bold: true, _drill: false }, ...L.rows.map(r => ({ id: r.id, date: r.date, no: (r.no || '') + (r.fix ? ' · ' + r.fix : ''), title: r.title + (r.src ? ' · ' + r.src : ''), against: r.against.map(accName).join('، '), debit: r.debit || null, credit: r.credit || null, bal: r.bal }))],
          notes: ['الرصيد بطبيعة الحساب (' + (L.nat > 0 ? 'مدين' : 'دائن') + ')؛ القيمة بين قوسين رصيد عكس الطبيعة.'] }} />
        <div data-glclose style={{ display: 'none' }}>{fmt(L.close)}</div>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8 }}>الرصيد بطبيعة الحساب ({L.nat > 0 ? 'مدين' : 'دائن'})؛ القيمة بين قوسين = رصيد عكس الطبيعة. اضغط رقم القيد لاستعراضه ومستنده.</div>
      </>}
    </div>);
}
