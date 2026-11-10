/* v39.1 — التقارير المفصلة: سجلا ضريبة القيمة المضافة (مبيعات/مشتريات) مع ملخص الإقرار والمطابقة،
   ومشتريات الموردين حسب طريقة الدفع (آجل/نقدي/شبكة/تحويل/شيك/أخرى) وسداداتهم. المحركات في النواة. */
import React, { useMemo, useState } from 'react';
import { Receipt, Download, Printer, ShieldCheck, Truck, ChevronDown } from 'lucide-react';
import { Kpi, PM_AR, PM_KEYS, _xe, arDate, buildAccounting, makeXlsx, money, printA4, supplierPurchReport, today, vatRegister } from '../../App.jsx';

const pad = (n) => String(n).padStart(2, '0');
const mEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
function periods() {
  const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7), q = Math.floor((m - 1) / 3);
  const pm = m === 1 ? [y - 1, 12] : [y, m - 1]; const pq = q === 0 ? [y - 1, 3] : [y, q - 1];
  return [
    ['mtd', 'هذا الشهر', y + '-' + pad(m) + '-01', mEnd(y, m)],
    ['pm', 'الشهر السابق', pm[0] + '-' + pad(pm[1]) + '-01', mEnd(pm[0], pm[1])],
    ['qtd', 'هذا الربع', y + '-' + pad(q * 3 + 1) + '-01', mEnd(y, q * 3 + 3)],
    ['pq', 'الربع السابق', pq[0] + '-' + pad(pq[1] * 3 + 1) + '-01', mEnd(pq[0], pq[1] * 3 + 3)],
    ['ytd', 'هذه السنة', y + '-01-01', y + '-12-31']
  ];
}
function PeriodBar({ org, st, set }) {
  const P = periods();
  return (
    <div className="rp-bar">
      <div className="rp-seg">{P.map(([k, ar, f, t]) => <button key={k} className={'btn sm' + (st.from === f && st.to === t ? ' pri' : ' gh')} onClick={() => set(s => ({ ...s, from: f, to: t }))}>{ar}</button>)}</div>
      <div className="rp-dates"><input type="date" className="inp" value={st.from} onChange={e => set(s => ({ ...s, from: e.target.value }))} aria-label="من" /><span>←</span><input type="date" className="inp" value={st.to} onChange={e => set(s => ({ ...s, to: e.target.value }))} aria-label="إلى" />
        <select className="inp sel" value={st.br} onChange={e => set(s => ({ ...s, br: e.target.value }))}><option value="">كل الفروع</option><option value="central">المركز (بلا فرع)</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
    </div>);
}
const dl = (name, sheets) => { const blob = makeXlsx(sheets); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); };
const useP = () => { const p = periods()[1]; return useState({ from: p[2], to: p[3], br: '' }); };

/* ——— سجلا الضريبة ——— */
export function VatRegisters({ org, ops, say }) {
  const [st, set] = useP();
  const [tab, setTab] = useState('sum');
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const R = useMemo(() => vatRegister(org, ops, { A, from: st.from, to: st.to, branchId: st.br }), [org, ops, A, st]);
  const brN = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || 'المركز';
  const rate = (org.taxCfg || {}).rate || 15;
  const sub = 'الفترة ' + st.from + ' ← ' + st.to + (st.br ? ' · ' + (st.br === 'central' ? 'المركز' : brN(st.br)) : ' · كل الفروع');
  const head = ['التاريخ', 'المستند', 'الرقم', 'الطرف', 'الرقم الضريبي', 'الفرع', 'قبل الضريبة', 'الضريبة', 'الإجمالي'];
  const rowOf = (r) => [r.date, r.doc + (r.cat ? ' · ' + r.cat : ''), r.no, r.party, r.pvat, brN(r.branchId), r.net, r.vat, r.gross];
  const totOf = (arr) => ['الإجمالي', '', '', '', '', '', sumF(arr, 'net'), sumF(arr, 'vat'), sumF(arr, 'gross')];
  const sumF = (arr, k) => Math.round(arr.reduce((s, r) => s + r[k], 0) * 100) / 100;
  const exportX = () => { try { dl('سجلات_الضريبة_' + st.from + '_' + st.to + '.xlsx', [
    { name: 'ملخص الإقرار', rows: [['البند', 'الوصف', 'المبلغ', 'الضريبة'], ...R.boxes.map(b => [b.n, b.ar, b.net == null ? '' : b.net, b.vat])] },
    { name: 'سجل المبيعات', rows: [head, ...R.sales.map(rowOf), totOf(R.sales)] },
    { name: 'سجل المشتريات', rows: [head, ...R.purch.map(rowOf), totOf(R.purch)] }]); say('نُزّل (Excel) ✓'); } catch { say('تعذّر توليد Excel', 'no'); } };
  const tbl = (arr) => `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map(r => `<tr>${rowOf(r).map((c, i) => `<td${i >= 6 ? ' class="n"' : ''}>${i >= 6 ? money(c) : _xe(String(c || ''))}</td>`).join('')}</tr>`).join('')}<tr class="tot">${totOf(arr).map((c, i) => `<td${i >= 6 ? ' class="n"' : ''}>${i >= 6 ? money(c) : c}</td>`).join('')}</tr></tbody></table>`;
  const print = (what) => printA4(org, what === 'sum' ? 'ملخص إقرار ضريبة القيمة المضافة' : what === 's' ? 'سجل ضريبة المبيعات' : 'سجل ضريبة المشتريات', sub + ' · النسبة ' + rate + '%',
    what === 'sum' ? `<table><thead><tr><th>البند</th><th>الوصف</th><th>المبلغ</th><th>الضريبة</th></tr></thead><tbody>${R.boxes.map(b => `<tr${b.tot ? ' class="tot"' : ''}><td>${b.n}</td><td>${_xe(b.ar)}${b.note ? `<div style="font-size:9px;color:#888">${_xe(b.note)}</div>` : ''}</td><td class="n">${b.net == null ? '' : money(b.net)}</td><td class="n">${money(b.vat)}</td></tr>`).join('')}</tbody></table>
      <div class="box" style="margin-top:10px">${R.checks.map(c => _xe(c.msg)).join('<br>')}</div>` : tbl(what === 's' ? R.sales : R.purch));
  const list = tab === 's' ? R.sales : R.purch;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <PeriodBar org={org} st={st} set={set} />
      <div className="grid g4">
        <Kpi label="ضريبة المخرجات (المبيعات)" value={money(R.boxes[2].vat)} sub={R.sales.length + ' مستند · ' + money(R.boxes[2].net) + ' قبل الضريبة'} icon={Receipt} color="#C8A24A" />
        <Kpi label="ضريبة المدخلات (المشتريات)" value={money(R.boxes[5].vat)} sub={R.purch.length + ' مستند · ' + money(R.boxes[5].net) + ' قبل الضريبة'} icon={Receipt} color="#5B93C4" />
        <Kpi label="صافي الضريبة للفترة" value={money(R.boxes[6].vat)} sub={R.boxes[6].vat >= 0 ? 'مستحقة للهيئة' : 'رصيد دائن (استرداد/ترحيل)'} icon={ShieldCheck} color={R.boxes[6].vat >= 0 ? '#D9544D' : '#4FB286'} />
        <Kpi label="المطابقة مع الدفاتر" value={R.checks.some(c => c.sev === 'bad') ? 'فرق' : 'مطابق'} sub="حسابا 2301 و1501" icon={ShieldCheck} color={R.checks.some(c => c.sev === 'bad') ? '#D9544D' : '#4FB286'} />
      </div>
      <div className="card">
        <div className="card-h"><div className="rp-seg">{[['sum', 'ملخص الإقرار'], ['s', 'سجل المبيعات (' + R.sales.length + ')'], ['p', 'سجل المشتريات (' + R.purch.length + ')']].map(([k, ar]) => <button key={k} className={'btn sm' + (tab === k ? ' pri' : ' gh')} onClick={() => setTab(k)}>{ar}</button>)}</div>
          <div className="rp-seg"><button className="btn sm" onClick={exportX}><Download size={13} />Excel</button><button className="btn sm" onClick={() => print(tab)}><Printer size={13} />طباعة</button></div></div>
        {R.checks.map((c, i) => <div key={i} className={'cf-note ' + (c.sev === 'ok' ? 'info' : c.sev)} style={{ marginBottom: 6 }}><span className={'badge ' + (c.sev === 'ok' ? 'b-mint' : c.sev === 'bad' ? 'b-rose' : 'b-amber')}>{c.sev === 'ok' ? 'سليم' : c.sev === 'bad' ? 'فرق' : 'ضابط'}</span><span>{c.msg}</span></div>)}
        {tab === 'sum' ? <div className="rp-boxes">{R.boxes.map(b => <div key={b.n} className={'rp-box' + (b.tot ? ' tot' : '')}><span className="rp-n num">{b.n}</span><span className="rp-l">{b.ar}{b.note ? <small>{b.note}</small> : null}</span>
          <span className="rp-v">{b.net != null && <span className="num" dir="ltr">{money(b.net)}</span>}<b className="num" dir="ltr">{money(b.vat)}</b></span></div>)}</div>
          : !list.length ? <div className="empty">لا مستندات في الفترة.</div> : <div className="rp-rows">{list.slice(0, 400).map(r => <div key={r.id} className={'rp-row' + (r.k === 'p' && r.vat > 0 && !r.pvat ? ' flag' : '')}>
            <span className="rp-a"><b>{r.party || r.doc}</b><small><span className="dt">{arDate(r.date)}</span> · {r.doc}{r.no ? ' ' + r.no : ''}{r.cat ? ' · ' + r.cat : ''} · {brN(r.branchId)}</small>{r.pvat ? <small className="num" dir="ltr">{r.pvat}</small> : r.vat > 0 && r.k === 'p' ? <small style={{ color: 'var(--amber)' }}>بلا رقم ضريبي للمورد</small> : null}</span>
            <span className="rp-b"><b className="num" dir="ltr">{money(r.gross)}</b><small className="num" dir="ltr">{money(r.net)} + {money(r.vat)}</small></span></div>)}
            {list.length > 400 && <div className="note">يُعرض أول 400 — الكل في Excel.</div>}</div>}
        <div className="note" style={{ marginTop: 8 }}>من القيود نفسها: مبيعات الإغلاقات وفواتير المبيعات وإشعاراتها، ومصروفات الإغلاقات وفواتير الموردين وإشعاراتها — بعد استبعاد السلف. «بلا ضريبة» تعني أن المستند لم يُحمَّل ضريبة؛ تصنيفه (صفري/معفى/خارج النطاق) يُحدَّد عند تعبئة الإقرار في بوابة الهيئة.</div>
      </div>
    </div>);
}

/* ——— مشتريات الموردين حسب طريقة الدفع ——— */
export function SupplierPurchReport({ org, ops, say }) {
  const [st, set] = useP();
  const [open, setOpen] = useState(null);
  const [mode, setMode] = useState('buy');
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const R = useMemo(() => supplierPurchReport(org, ops, { A, from: st.from, to: st.to, branchId: st.br }), [org, ops, A, st]);
  const brN = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || 'المركز';
  const sub = 'الفترة ' + st.from + ' ← ' + st.to + (st.br ? ' · ' + (st.br === 'central' ? 'المركز' : brN(st.br)) : ' · كل الفروع');
  const keys = mode === 'buy' ? PM_KEYS : PM_KEYS.filter(k => k !== 'deferred');
  const T = mode === 'buy' ? R.tot.buy : R.tot.pay, rows = R.rows.filter(r => mode === 'buy' ? r.buyTot : r.payTot);
  const exportX = () => { try { dl('مشتريات_الموردين_' + st.from + '_' + st.to + '.xlsx', [
    { name: 'المشتريات بطرق الدفع', rows: [['المورد', ...PM_KEYS.map(k => PM_AR[k]), 'الإجمالي', 'منها ضريبة'], ...R.rows.map(r => [r.name, ...PM_KEYS.map(k => r.buy[k]), r.buyTot, r.vat]), ['الإجمالي', ...PM_KEYS.map(k => R.tot.buy[k]), R.tot.buyTot, R.tot.vat]] },
    { name: 'السداد بطرق الدفع', rows: [['المورد', ...PM_KEYS.filter(k => k !== 'deferred').map(k => PM_AR[k]), 'الإجمالي'], ...R.rows.filter(r => r.payTot).map(r => [r.name, ...PM_KEYS.filter(k => k !== 'deferred').map(k => r.pay[k]), r.payTot])] },
    { name: 'التفاصيل', rows: [['المورد', 'التاريخ', 'النوع', 'الطريقة', 'المستند', 'الفرع', 'المبلغ', 'الضريبة'], ...R.rows.flatMap(r => r.lines.map(l => [r.name, l.date, l.kind === 'buy' ? 'شراء' : 'سداد', PM_AR[l.pm], l.doc, brN(l.branchId), l.amount, l.vat || '']))] }]); say('نُزّل (Excel) ✓'); } catch { say('تعذّر توليد Excel', 'no'); } };
  const print = () => printA4(org, mode === 'buy' ? 'مشتريات الموردين حسب طريقة الدفع' : 'سداد الموردين حسب طريقة الدفع', sub,
    `<table><thead><tr><th>المورد</th>${keys.map(k => `<th>${PM_AR[k]}</th>`).join('')}<th>الإجمالي</th></tr></thead><tbody>${rows.map(r => `<tr><td>${_xe(r.name)}</td>${keys.map(k => `<td class="n">${money((mode === 'buy' ? r.buy : r.pay)[k])}</td>`).join('')}<td class="n">${money(mode === 'buy' ? r.buyTot : r.payTot)}</td></tr>`).join('')}
    <tr class="tot"><td>الإجمالي</td>${keys.map(k => `<td class="n">${money(T[k])}</td>`).join('')}<td class="n">${money(mode === 'buy' ? R.tot.buyTot : R.tot.payTot)}</td></tr></tbody></table>`);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <PeriodBar org={org} st={st} set={set} />
      <div className="grid g4">
        <Kpi label="إجمالي المشتريات" value={money(R.tot.buyTot)} sub={'منها ضريبة ' + money(R.tot.vat)} icon={Truck} color="#C8A24A" />
        <Kpi label="آجل (على الحساب)" value={money(R.tot.buy.deferred)} sub={R.tot.buyTot ? Math.round(R.tot.buy.deferred / R.tot.buyTot * 100) + '% من المشتريات' : '—'} icon={Truck} color="#E0A458" />
        <Kpi label="مدفوع فورًا" value={money(R.tot.buyTot - R.tot.buy.deferred)} sub={'نقدي ' + money(R.tot.buy.cash) + ' · شبكة ' + money(R.tot.buy.card)} icon={Truck} color="#4FB286" />
        <Kpi label="سداد الموردين" value={money(R.tot.payTot)} sub={'نقدي ' + money(R.tot.pay.cash) + ' · بنكي ' + money(R.tot.pay.transfer + R.tot.pay.cheque)} icon={Truck} color="#5B93C4" />
      </div>
      <div className="card">
        <div className="card-h"><div className="rp-seg">{[['buy', 'المشتريات بطرق الدفع'], ['pay', 'السداد بطرق الدفع']].map(([k, ar]) => <button key={k} className={'btn sm' + (mode === k ? ' pri' : ' gh')} onClick={() => setMode(k)}>{ar}</button>)}</div>
          <div className="rp-seg"><button className="btn sm" onClick={exportX}><Download size={13} />Excel</button><button className="btn sm" onClick={print}><Printer size={13} />طباعة</button></div></div>
        <div className="rp-pm">{keys.map(k => <div key={k} className="rp-pmc"><span>{PM_AR[k]}</span><b className="num" dir="ltr">{money(T[k])}</b></div>)}</div>
        {!rows.length ? <div className="empty">لا حركات في الفترة.</div> : <div className="rp-rows">{rows.map(r => (
          <div key={r.key} className="rp-sup">
            <button type="button" className="cf-wh" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
              <span className="rp-a"><b>{r.name}</b><small>{keys.filter(k => (mode === 'buy' ? r.buy : r.pay)[k]).map(k => PM_AR[k] + ' ' + money((mode === 'buy' ? r.buy : r.pay)[k])).join(' · ')}</small></span>
              <b className="num" dir="ltr">{money(mode === 'buy' ? r.buyTot : r.payTot)}</b><ChevronDown size={14} className="cf-chev" /></button>
            {open === r.key && <div className="cf-items">{r.lines.filter(l => l.kind === mode).map((l, i) => <div key={i} className="cf-it"><span className="cf-id"><small className="dt">{arDate(l.date)}</small><span>{l.doc}</span><small className="cf-b">{PM_AR[l.pm]} · {brN(l.branchId)}{l.vat ? ' · ضريبة ' + money(l.vat) : ''}</small></span><b className="num" dir="ltr">{money(l.amount)}</b></div>)}</div>}
          </div>))}</div>}
        <div className="note" style={{ marginTop: 8 }}>المشتريات بطريقة دفعها وقت الشراء: مصروفات الإغلاق المرتبطة بمورد (أو بلا مورد) بطريقتها، وفواتير التوريد «آجل». السداد: دفعات الفواتير (من الخزينة = نقدي، من البنك = تحويل)، وسدادات الإغلاق بطرقها، والسدادات المركزية. المبالغ شاملة الضريبة.</div>
      </div>
    </div>);
}
