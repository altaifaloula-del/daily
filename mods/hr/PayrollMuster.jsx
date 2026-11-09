/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Users, Wallet, TrendingDown, Landmark, FileText, Printer, Download } from 'lucide-react';
import { Kpi, makeXlsx, money, payrollRowsOf, printA4, sum, today } from '../../App.jsx';

export function PayrollMuster({ org, ops, me, myBranches, scoped, say }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [bf, setBf] = useState('');
  const brs = (myBranches || []).filter(b => b.isActive !== false);
  const emps = (org.employees || []).filter(e => brs.some(b => b.id === e.branchId) && (!bf || e.branchId === bf));
  const rows = payrollRowsOf(org, scoped.advances, emps, month).filter(r => r.gross > 0 || r.net !== 0);
  const gosiOn = !!(org.gosiCfg || {}).enabled;
  const accrual = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === month);
  const payout = (ops.ledgerEntries || []).some(x => x.kind === 'salary_payout' && x.month === month);
  const T = (k) => Math.round(sum(rows, r => typeof k === 'function' ? k(r) : r[k]) * 100) / 100;
  const groups = brs.filter(b => !bf || b.id === bf).map(b => ({ b, rows: rows.filter(r => r.e.branchId === b.id) })).filter(g => g.rows.length);
  const cols = [
    ['الأساسي', r => r.e.baseSalary || 0], ['السكن', r => r.e.housingAllowance || 0], ['النقل', r => r.e.transportAllowance || 0], ['بدلات أخرى', r => r.e.otherAllowance || 0],
    ['الإضافي', r => r.ot], ['مكافآت', r => r.bonus], ['الإجمالي', r => r.gross, 1],
    ...(gosiOn ? [['تأمينات', r => r.gEmp]] : []), ['سلف', r => r.draws], ['خصومات', r => r.cuts], ['الصافي', r => r.net, 1]
  ];
  const monthName = (() => { try { return new Date(month + '-01T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); } catch { return month; } })();
  const print = () => {
    let n = 0;
    const body = groups.map(g => `<tr class="hd"><td colspan="${cols.length + 3}">${g.b.name} — ${g.rows.length} موظف</td></tr>` + g.rows.map(r => `<tr><td class="n">${++n}</td><td>${r.e.name}${r.e.jobTitle ? '<br><span style="font-size:9px;color:#888">' + r.e.jobTitle + '</span>' : ''}</td>${cols.map(c => `<td class="n"${c[2] ? ' style="font-weight:700"' : ''}>${c[1](r) ? money(c[1](r)) : '—'}</td>`).join('')}<td>${r.e.iban ? '<span style="font-size:9px">' + r.e.iban + '</span>' : ''}</td></tr>`).join('')
      + `<tr class="grp"><td colspan="2">مجموع ${g.b.name}</td>${cols.map(c => `<td class="n">${money(Math.round(sum(g.rows, c[1]) * 100) / 100)}</td>`).join('')}<td></td></tr>`).join('');
    printA4(org, 'مسير رواتب شهر ' + monthName, rows.length + ' موظف' + (bf ? ' · ' + (brs.find(b => b.id === bf) || {}).name : ' · كل الفروع') + (accrual ? ' · الاستحقاق مُرحّل' : ' · مسودة قبل الترحيل'),
      `<style>@page{size:A4 landscape}table{font-size:10px}td,th{padding:4px 5px}.hd td{background:#f5f0e4;font-weight:800}.grp td{font-weight:700;background:#fbf8f1}</style>
      <table><thead><tr><th>#</th><th>الموظف</th>${cols.map(c => `<th>${c[0]}</th>`).join('')}<th>الآيبان</th></tr></thead><tbody>${body}
      <tr class="tot"><td colspan="2">الإجمالي العام</td>${cols.map(c => `<td class="n">${money(T(c[1]))}</td>`).join('')}<td></td></tr></tbody></table>
      <div class="box">الإجمالي = الأساسي + البدلات + الإضافي المعتمد + المكافآت المعتمدة · الصافي = الإجمالي − السلف − الخصومات${gosiOn ? ' − حصة الموظف من التأمينات' : ''}.</div>
      <div class="sign"><div>إعداد الموارد البشرية</div><div>مراجعة المحاسبة</div><div>اعتماد الإدارة</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const xl = () => { try {
    const rr = [['الموظف', 'الفرع', 'الوظيفة', ...cols.map(c => c[0]), 'ساعات الإضافي', 'الآيبان']];
    groups.forEach(g => g.rows.forEach(r => rr.push([r.e.name, g.b.name, r.e.jobTitle || '', ...cols.map(c => Math.round((c[1](r) || 0) * 100) / 100), r.otHours, r.e.iban || ''])));
    rr.push(['الإجمالي', '', '', ...cols.map(c => T(c[1])), T('otHours'), '']);
    const blob = makeXlsx([{ name: 'مسير ' + month, rows: rr }]); const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = 'مسير_الرواتب_' + month + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500);
  } catch { say('تعذّر توليد Excel', 'no'); } };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="month" className="inp" style={{ width: 170 }} value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
        <select className="sel" style={{ width: 170 }} value={bf} onChange={e => setBf(e.target.value)}>
          <option value="">كل الفروع</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className={'badge ' + (payout ? 'b-mint' : accrual ? 'b-brass' : 'b-amber')}>{payout ? 'مصروف ✓' : accrual ? 'الاستحقاق مُرحّل — بانتظار الصرف' : 'مسودة — قبل ترحيل الاستحقاق'}</span>
      </div>
      <div className="grid g4">
        <Kpi label="الموظفون" value={String(rows.length)} sub={groups.length + ' فرع'} icon={Users} color="#C8A24A" />
        <Kpi label="إجمالي المستحق" value={money(T('gross'))} sub={'منها إضافي ' + money(T('ot')) + ' (' + T('otHours') + ' ساعة)'} icon={Wallet} color="#5B93C4" />
        <Kpi label="الاستقطاعات" value={money(T(r => r.draws + r.cuts + r.gEmp))} sub={'سلف ' + money(T('draws')) + ' · خصومات ' + money(T('cuts'))} icon={TrendingDown} color="#D9544D" />
        <Kpi label="صافي المسير" value={money(T('net'))} sub="المطلوب صرفه" icon={Landmark} color="#4FB286" />
      </div>
      <div className="card">
        <div className="card-h">
          <div className="card-t"><FileText size={15} color="var(--brass)" />مسير رواتب شهر {monthName}</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={print}><Printer size={13} />طباعة</button>
            <button className="btn sm" onClick={xl}><Download size={13} />Excel</button>
          </div>
        </div>
        {rows.length === 0 ? <div className="empty">لا رواتب للفروع والشهر المحددين.</div> : (
          <div className="tw"><table className="tb is-tb mus-tb">
            <thead><tr><th>الموظف</th>{cols.map(c => <th key={c[0]} style={{ textAlign: 'end' }}>{c[0]}</th>)}</tr></thead>
            <tbody>
              {groups.map(g => (<React.Fragment key={g.b.id}>
                <tr className="is-head"><td colSpan={cols.length + 1}>{g.b.name} <span style={{ fontWeight: 500, color: 'var(--faint)' }}>· {g.rows.length} موظف</span></td></tr>
                {g.rows.map(r => (
                  <tr key={r.e.id} className="is-line">
                    <td><b>{r.e.name}</b>{r.e.jobTitle && <div style={{ fontSize: 11, color: 'var(--faint)' }}>{r.e.jobTitle}</div>}</td>
                    {cols.map(c => { const v = c[1](r); return <td key={c[0]} className="is-amt"><span className="num" style={c[2] ? { fontWeight: 700 } : undefined}>{v ? money(v) : '—'}</span>{c[0] === 'الإضافي' && r.otHours > 0 && <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{r.otHours} ساعة</div>}</td>; })}
                  </tr>))}
                <tr className="is-sub"><td>مجموع {g.b.name}</td>{cols.map(c => <td key={c[0]} className="is-amt"><span className="num">{money(Math.round(sum(g.rows, c[1]) * 100) / 100)}</span></td>)}</tr>
              </React.Fragment>))}
              <tr className="is-net"><td>الإجمالي العام</td>{cols.map(c => <td key={c[0]} className="is-amt"><span className="num">{money(T(c[1]))}</span></td>)}</tr>
            </tbody>
          </table></div>)}
        <div className="note" style={{ marginTop: 10 }}>المسير من نفس حساب «الرواتب والسلف» — الإجمالي = الأساسي + البدلات + الإضافي المعتمد + المكافآت · الصافي = الإجمالي − السلف − الخصومات{gosiOn ? ' − التأمينات' : ''}. ترحيل الاستحقاق والصرف من «الرواتب والسلف».</div>
      </div>
    </div>
  );
}
