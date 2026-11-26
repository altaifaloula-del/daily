/* v54.3 — المرحلة 4: «لوحة المدير المالي» — درجات بمنهجية ومدخلات ظاهرة، تنقيب الشركة ← الفرع ← الحساب ← القيد، الحالات والتوصيات والوفر، والتوقع مقابل الفعلي. */
import React, { useMemo, useState } from 'react';
import { Gauge, Download } from 'lucide-react';
import { finPicture } from '../../App.jsx';   // v56.22 (FINANCE G1)
import { cfoDash, finAnalyze, buildAccounting, isLayout, acctActivity, DocLink, Kpi, money, today, exportExcel } from '../../App.jsx';

const col = (v) => v == null ? 'var(--faint)' : v >= 70 ? 'var(--mint)' : v >= 40 ? 'var(--amber)' : 'var(--rose)';
export function CfoDash({ org, ops, myBranches, setTab }) {
  const td = today(); const [from, setFrom] = useState(td.slice(0, 4) + '-01-01'); const [to, setTo] = useState(td); const [br, setBr] = useState(''); const [why, setWhy] = useState('');
  const allBr = (myBranches || []).length >= (org.branches || []).length;
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const D = useMemo(() => { try { return cfoDash(org, ops, { from, to }, A); } catch (e) { return { err: e.message }; } }, [org, ops, from, to, A]);
  const lines = useMemo(() => { if (!br) return null; const T = acctActivity(A, { from, to, bf: br }); const mv = {}; T.rows.forEach(r => { const n = (r.kind === 'asset' || r.kind === 'exp') ? 1 : -1; mv[r.code] = n * (r.debit - r.credit); });
    const Y = isLayout(A.accounts, a => mv[a.code] || 0); return [...Y.sales.map(l => ({ ...l, t: 'إيراد' })), ...Y.cogs.map(l => ({ ...l, t: 'تكلفة مبيعات' })), ...(Y.opexG || []).flatMap(g => g.lines.map(l => ({ ...l, t: g.t })))]; }, [A, br, from, to]);
  if (!allBr) return <div className="card"><div className="empty">لوحة المدير المالي على مستوى الشركة — متاحة لمن يرى كل الفروع.</div></div>;
  if (D.err) return <div className="card"><div className="empty">تعذّر الحساب: {D.err}</div></div>;
  const xls = () => exportExcel('لوحة-المدير-المالي-' + to, 'لوحة المدير المالي', ['البند', 'القيمة', 'المنهجية'], [...D.scores.map(x => [x.name, x.value == null ? 'غير قابلة للحساب' : x.value, x.formula]), ...D.branches.map(b => ['فرع: ' + b.name, b.net, 'صافي الربح'])], { meta: [['الفترة', from + ' — ' + to]] });
  const f = D.forecast;
  const P = (() => { try { return finPicture(org, ops, A, to); } catch (e) { return null; } })();
  const pc = (v) => v == null ? '—' : (v > 0 ? '+' : '') + v + '%';
  const Acc = ({ code, children }) => <DocLink to={{ acc: code, to }}>{children}</DocLink>;
  return (
    <div className="grid" style={{ gap: 14 }} data-cfodash>
      <div className="card">
        <div className="card-t"><Gauge size={15} color="var(--brass)" />لوحة المدير المالي <small style={{ color: 'var(--dim)', fontWeight: 400 }}>كل درجة ترجع لأرقامها — اضغط «المنهجية»</small></div>
        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}><input type="date" className="inp" style={{ maxWidth: 160 }} aria-label="من" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="inp" style={{ maxWidth: 160 }} aria-label="إلى" value={to} onChange={e => setTo(e.target.value)} /><button className="btn sm ok" onClick={xls}><Download size={13} />Excel</button></div>
        {!D.quality.complete && <div className="note" style={{ marginTop: 8, fontSize: 12 }}>بيانات ناقصة: {D.quality.checks.filter(c => !c.ok).map(c => c.label).join('، ')} — الدرجات المعتمدة عليها «غير قابلة للحساب».</div>}
      </div>
      {P && <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }} data-finpic>
        <div className="card" data-fp="cash"><div className="card-t" style={{ marginBottom: 6 }}>النقد والسيولة · حتى {P.td}</div>
          <div className="me-row"><span className="me-a"><b>النقد والبنوك</b><small>{P.cash.cashCodes.map(c => <span key={c} style={{ marginInlineEnd: 6 }}><Acc code={c}>{c}</Acc></span>)}</small></span><b className="num">{money(P.cash.cash)}</b></div>
          <div className="me-row"><span className="me-a"><b>مستحق من العملاء والتطبيقات</b><small>{P.cash.arCodes.map(c => <span key={c} style={{ marginInlineEnd: 6 }}><Acc code={c}>{c}</Acc></span>)}</small></span><b className="num">{money(P.cash.ar)}</b></div>
          <div className="me-row"><span className="me-a"><b>مستحق للموردين</b><small><Acc code="2101">2101</Acc></small></span><b className="num" style={{ color: 'var(--rose)' }}>{money(P.cash.ap)}</b></div>
          <div className="me-row"><span className="me-a"><b>صافي السيولة</b><small>النقد + المستحق لنا − المستحق للموردين</small></span><b className="num" style={{ color: P.cash.net < 0 ? 'var(--rose)' : 'var(--mint)' }}>{money(P.cash.net)}</b></div></div>
        <div className="card" data-fp="profit"><div className="card-t" style={{ marginBottom: 6 }}>الربحية · {P.profit.cur.ym} مقابل {P.profit.prev.ym}</div>
          {[['صافي المبيعات', 'netSales'], ['مجمل الربح', 'gross'], ['صافي الربح', 'net']].map(([t, k]) => <div key={k} className="me-row"><span className="me-a"><b>{t}</b><small>الشهر السابق {money(P.profit.prev[k])}</small></span><span style={{ textAlign: 'end' }}><b className="num" style={{ color: P.profit.cur[k] < 0 ? 'var(--rose)' : undefined }}>{money(P.profit.cur[k])}</b><div className="num" style={{ fontSize: 11, color: (P.profit.chg[k] || 0) < 0 ? 'var(--rose)' : 'var(--mint)' }}>{pc(P.profit.chg[k])}</div></span></div>)}
          <div className="hint">هامش المجمل: {P.profit.cur.gm == null ? '—' : P.profit.cur.gm + '%'} · الشهر الجاري حتى {P.td}</div></div>
        <div className="card" data-fp="costs"><div className="card-t" style={{ marginBottom: 6 }}>التكاليف بالفرع · {P.profit.cur.ym} <small style={{ color: 'var(--dim)', fontWeight: 400 }}>نسبة تكلفة الطعام</small></div>
          {P.costs.branches.map(b => <div key={b.id} className="me-row" data-fp-br={b.id}><span className="me-a"><b>{b.name}</b><small>صافي المبيعات {money(b.netSales)} · التكلفة {money(b.cogs)}</small></span><b className="num" style={{ color: b.foodPct != null && b.foodPct > 35 ? 'var(--rose)' : undefined }}>{b.foodPct == null ? '—' : b.foodPct + '%'}</b></div>)}
          <div className="me-row" style={{ marginTop: 6 }}><span className="me-a"><b>العمالة (الرواتب) للشركة</b><small>نسبتها من صافي المبيعات — الرواتب بلا فرع في الدفاتر فلا تتوزع على الفروع</small></span><b className="num">{money(P.costs.labor)} · {P.costs.laborPct == null ? '—' : P.costs.laborPct + '%'}</b></div></div>
        <div className="card" data-fp="tax"><div className="card-t" style={{ marginBottom: 6 }}>الضريبة والالتزامات</div>
          {P.tax.vat ? <div className="me-row"><span className="me-a"><b>ضريبة الفترة الجارية (تقديرية)</b><small>{P.tax.vat.end ? 'تنتهي ' + P.tax.vat.end + ' · السداد حتى ' + P.tax.vat.due : 'حدّد دورية الإقرار (شهري/ربعي) في التوقّع النقدي لمعرفة الموعد'}{P.tax.vat.unpaid.length ? ' · إقرارات غير مسددة: ' + P.tax.vat.unpaid.length : ''}</small></span><b className="num">{money(P.tax.vat.accrued)}</b></div> : <div className="hint">الضريبة غير مفعّلة.</div>}
          <div className="me-row"><span className="me-a"><b>ضريبة مستحقة في الدفاتر</b><small><Acc code="2301">2301</Acc> · <Acc code="2302">2302</Acc></small></span><b className="num">{money(P.tax.vatPay)}</b></div>
          <div className="me-row"><span className="me-a"><b>رواتب وتأمينات مستحقة</b><small><Acc code="2201">2201</Acc> · <Acc code="2202">2202</Acc></small></span><b className="num">{money(P.tax.payroll + P.tax.gosi)}</b></div>
          <div className="me-row"><span className="me-a"><b>الإقفال</b><small>آخر شهر مقفل: {P.tax.lockedThrough || 'لا شيء'}</small></span><b className="num" style={{ color: (P.tax.openMonths || 0) > 1 ? 'var(--amber)' : undefined }}>{P.tax.openMonths == null ? '—' : P.tax.openMonths + ' شهر مفتوح'}</b></div></div>
      </div>}
      <div className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>{D.scores.map(x => <div key={x.id} className="card" data-score={x.id} style={{ padding: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>{x.name}</div><div className="num" style={{ fontSize: 26, fontWeight: 700, color: col(x.value) }}>{x.value == null ? '—' : x.value}</div>
        <button className="btn sm gh" style={{ marginTop: 4 }} onClick={() => setWhy(why === x.id ? '' : x.id)}>المنهجية</button>
        {why === x.id && <div data-scorewhy style={{ fontSize: 11.5, marginTop: 6, lineHeight: 1.8 }}><div>{x.formula}</div>{Object.entries(x.inputs || {}).map(([k, v]) => <div key={k}>{k}: <b className="num">{v == null ? '—' : typeof v === 'number' && Math.abs(v) < 5 ? Math.round(v * 10000) / 10000 : v}</b></div>)}
          {x.status !== 'ok' && <div style={{ color: 'var(--amber)' }}>غير قابلة للحساب: مدخلات ناقصة</div>}</div>}
      </div>)}</div>
      <div className="grid g4">
        <Kpi label="حالات رقابية مفتوحة" value={D.cases.open} sub={D.cases.critical + ' حرجة/عالية · ' + D.cases.overdue + ' متأخرة'} />
        <Kpi label="توصيات بانتظار الاعتماد" value={D.savings.pendingApproval} sub={D.savings.adopted + ' متبنّاة'} />
        <Kpi label="الوفر المتوقع (معتمد)" value={money(D.savings.expected)} sub="تقدير" />
        <Kpi label="الوفر الفعلي المقاس" value={money(D.savings.actual)} sub={D.savings.measured + ' توصية قيست'} />
      </div>
      <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>الفروع — اضغط فرعًا لتفاصيل حساباته</div>
        <div className="tw"><table className="tb" style={{ fontSize: 12.5 }} data-cfobr><thead><tr><th>الفرع</th><th>صافي المبيعات</th><th>مجمل الربح</th><th>هامش المجمل</th><th>صافي الربح</th></tr></thead>
          <tbody>{D.branches.map(b => <tr key={b.id} data-br={b.id} style={{ cursor: 'pointer', background: br === b.id ? 'rgba(200,162,74,.08)' : undefined }} onClick={() => setBr(br === b.id ? '' : b.id)}>
            <td><b>{b.name}</b></td><td className="num">{money(b.netSales)}</td><td className="num">{money(b.gross)}</td><td className="num">{b.gm == null ? '—' : b.gm + '%'}</td><td className="num" style={{ color: b.net < 0 ? 'var(--rose)' : undefined }}>{money(b.net)}</td></tr>)}</tbody></table></div>
        {br && lines && <div style={{ marginTop: 10 }} data-cfoacc><b style={{ fontSize: 13 }}>حسابات {(D.branches.find(b => b.id === br) || {}).name} — اضغط حسابًا لقيوده</b>
          <table className="tb" style={{ fontSize: 12, marginTop: 6 }}><tbody>{lines.map(l => <tr key={l.code}><td>{l.t}</td><td><DocLink to={{ acc: l.code, from, to, bf: br }}>{l.code} · {l.name}</DocLink></td><td className="num">{money(Math.abs(l.amt))}</td></tr>)}
            {!lines.length && <tr><td className="empty">لا حركة لهذا الفرع في الفترة</td></tr>}</tbody></table></div>}
        <div className="hint" style={{ marginTop: 6 }}>مستوى «القسم» غير متاح: الدفاتر لا تحمل أقسامًا حاليًا (مراكز التكلفة = الفروع والمشاريع).</div>
      </div>
      <div className="card" data-cfofc><div className="card-t" style={{ marginBottom: 6 }}>التوقع — ليس نتيجة مؤكدة</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.8 }}>البيانات: {f.data} · المنهجية: {f.method} · القيود: {f.limits}</div>
        {f.next ? <div className="grid g4" style={{ marginTop: 8 }}><Kpi label={'مبيعات ' + f.next.month + ' (أساس)'} value={money(f.next.base)} /><Kpi label="أفضل حالة" value={money(f.next.best)} /><Kpi label="أسوأ حالة" value={money(f.next.worst)} /><Kpi label="صافي متوقع" value={money(f.next.net)} /></div> : null}
        {f.vsActual && <div style={{ marginTop: 8, fontSize: 12.5 }}>التوقع مقابل الفعلي لـ {f.vsActual.month}: توقع {money(f.vsActual.forecast)} · فعلي {money(f.vsActual.actual)} · الخطأ <b className="num">{f.vsActual.errorPct}%</b></div>}
        <table className="tb" style={{ fontSize: 11.5, marginTop: 8 }}><thead><tr><th>الشهر</th><th>المبيعات</th><th>التكاليف</th><th>الصافي</th></tr></thead><tbody>{f.months.map(m => <tr key={m.ym}><td className="num">{m.ym}</td><td className="num">{money(m.sales)}</td><td className="num">{money(m.costs)}</td><td className="num">{money(m.net)}</td></tr>)}</tbody></table>
      </div>
    </div>);
}
