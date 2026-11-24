/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { FileText, Download, FileBarChart, Receipt, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Kpi, NUM_FACE, arDate, computeIncome, exportExcel, money, openDocWin, printIncomeA4, sum, today, buildAccounting, acctActivity, isLayout, DocLink } from '../../App.jsx';

export function FinancialReports({ org, ops, myBranches, scoped, say }) {
  const [period, setPeriod] = useState('monthly');
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [year, setYear] = useState(today().slice(0, 4));
  const [bid, setBid] = useState('all');

  const branches = myBranches.filter(b => bid === 'all' || b.id === bid);
  const ids = branches.map(b => b.id);

  const range = period === 'daily' ? { from: day, to: day, label: arDate(day), type: 'يومية' }
    : period === 'monthly' ? { from: month + '-01', to: month + '-31', label: month, type: 'شهرية' }
    : { from: year + '-01-01', to: year + '-12-31', label: year, type: 'سنوية' };

  const data = useMemo(() => computeIncome(org, ops, scoped.closings, ids, range.from, range.to),
    [org, ops, scoped, ids.join(), range.from, range.to]);

  // v53.9 — مصدر القائمة: الإغلاقات اليومية (تشغيلية) أو الدفاتر المحاسبية (كل القيود: فواتير الموردين المستوردة، القيود اليدوية، المبيعات…).
  // تلقائيًا: الدفاتر حين لا إغلاقات في الفترة. الدفاتر لكل الفروع تتاح فقط لمن يرى كل الفروع.
  const [src, setSrc] = useState('');
  const allBr = myBranches.length >= (org.branches || []).length;
  const glOk = bid !== 'all' || allBr;
  const gl = useMemo(() => { if (!glOk) return null; try {
    const A = buildAccounting(org, ops); const T = acctActivity(A, { from: range.from, to: range.to, bf: bid === 'all' ? '' : bid }); const mv = {};
    T.rows.forEach(r => { const n = (r.kind === 'asset' || r.kind === 'exp') ? 1 : -1; mv[r.code] = n * (r.debit - r.credit); });
    const Y = isLayout(A.accounts, a => mv[a.code] || 0); Y._any = Object.values(mv).some(v => Math.abs(v) > 0.004); return Y; } catch { return null; } },
    [org, ops, glOk, bid, range.from, range.to]);
  const useGl = !!gl && (src ? src === 'gl' : (data.n === 0 && gl._any));
  const m = (n) => money(n);
  const scopeLabel = bid === 'all' ? 'كل الفروع' : (branches[0]?.name || '');
  const branchLogo = bid !== 'all' ? branches[0]?.logoUrl : '';

  const doPrint = () => printIncomeA4(org, data, {
    periodType: range.type, periodLabel: range.label, scopeLabel, branchLogo
  });

  const exportCsv = () => {
    const rows = [
      ['قائمة الدخل', range.type, range.label, scopeLabel],
      ['مبيعات نقدية', data.R.cash], ['مبيعات الشبكة', data.R.card], ['تحويل بنكي', data.R.bank],
      ['تطبيقات التوصيل', data.R.del], ['إجمالي الإيراد', data.grossRevenue],
      ['عمولات التطبيقات', -data.commissions], ['صافي الإيراد', data.netRevenue],
      ...data.byCat.map(x => ['مصروف: ' + x.n, -x.v]),
      ['الالتزامات الثابتة', -data.fixedTotal], ['الرواتب غير المصروفة', -data.payrollRemaining],
      ['إجمالي التكاليف', -data.totalCost], ['الربح التشغيلي', data.operatingProfit],
      ['ض.ق.م المستحقة', -data.vatDue], ['صافي الربح بعد الضريبة', data.netAfterVat],
      ['فروقات الصندوق', data.cashVariance]
    ];
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `قائمة-الدخل-${range.type}-${range.label}.csv`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل قائمة الدخل');
  };

  const exportXlsx = () => {
    const rows = [
      ['مبيعات نقدية', +data.R.cash.toFixed(2)], ['مبيعات الشبكة', +data.R.card.toFixed(2)], ['تحويل بنكي', +data.R.bank.toFixed(2)],
      ['تطبيقات التوصيل', +data.R.del.toFixed(2)], ['إجمالي الإيراد', +data.grossRevenue.toFixed(2)],
      ['عمولات التطبيقات', -+data.commissions.toFixed(2)], ['صافي الإيراد', +data.netRevenue.toFixed(2)],
      ...data.byCat.map(x => ['مصروف: ' + x.n, -+x.v.toFixed(2)]),
      ['الالتزامات الثابتة', -+data.fixedTotal.toFixed(2)], ['الرواتب غير المصروفة', -+data.payrollRemaining.toFixed(2)],
      ['إجمالي التكاليف', -+data.totalCost.toFixed(2)], ['الربح التشغيلي', +data.operatingProfit.toFixed(2)],
      ['ض.ق.م المستحقة', -+data.vatDue.toFixed(2)], ['فروقات الصندوق', +data.cashVariance.toFixed(2)]
    ];
    exportExcel(`قائمة-الدخل-${range.type}-${range.label}`, `قائمة الدخل — ${range.label}`, ['البند', 'المبلغ (ر.س)'], rows, {
      meta: [`${org.company.name || ''} · الرقم الضريبي: ${org.company.taxNumber || '—'}`, `النطاق: ${scopeLabel} · الفترة: ${range.label}`],
      totals: ['صافي الربح بعد الضريبة', +data.netAfterVat.toFixed(2)]
    });
    say('تم تنزيل قائمة الدخل بصيغة Excel');
  };

  const exportVatDeclaration = () => {
    const m = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);
    const co = org.company || {};
    // مبيعات خاضعة = الإيراد الإجمالي (شامل الضريبة) → الأساس بدون ضريبة
    const salesBase = data.grossRevenue - data.vatOut;
    const purchBase = sum(data.byCat.filter(x => x.taxable), x => x.v) - data.vatIn;
    const w = openDocWin('width=850,height=1000');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>إقرار ضريبة القيمة المضافة - ${range.label}</title>
      <style>${NUM_FACE}
        *{margin:0;padding:0;box-sizing:border-box;font-family:'MizanNum','IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',Tahoma,sans-serif}
        body{padding:32px;color:#222}
        .head{text-align:center;border-bottom:3px solid #D9A83E;padding-bottom:16px;margin-bottom:8px}
        .co-n{font-size:19px;font-weight:bold;color:#10294A}
        .co-m{font-size:12px;color:#666;margin-top:4px}
        .title{text-align:center;font-size:17px;font-weight:bold;margin:18px 0 4px}
        .sub{text-align:center;font-size:13px;color:#666;margin-bottom:22px}
        table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
        th{background:#10294A;color:#fff;padding:10px;text-align:right}
        td{border:1px solid #ddd;padding:10px 12px}
        td.n{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap}
        .sec{background:#F3F5F8;font-weight:bold;color:#10294A}
        .due{background:#D9A83E;color:#10294A;font-weight:bold;font-size:15px}
        .note{font-size:11px;color:#888;margin-top:20px;line-height:1.7}
        .sign{display:flex;justify-content:space-between;margin-top:44px;gap:40px}
        .sign div{flex:1;text-align:center;border-top:1px solid #999;padding-top:8px;font-size:12px;color:#666}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="head">
        <div class="co-n">${co.name || 'المنشأة'}</div>
        <div class="co-m">الرقم الضريبي: ${co.taxNumber || '—'} · السجل التجاري: ${co.commercialReg || '—'}</div>
      </div>
      <div class="title">إقرار ضريبة القيمة المضافة</div>
      <div class="sub">الفترة الضريبية: ${range.label} · ${scopeLabel}</div>

      <table>
        <thead><tr><th style="width:60%">البيان</th><th class="n">الأساس (ر.س)</th><th class="n">الضريبة (ر.س)</th></tr></thead>
        <tbody>
          <tr class="sec"><td colspan="3">المبيعات (ضريبة المخرجات)</td></tr>
          <tr><td>المبيعات الخاضعة للنسبة الأساسية 15%</td><td class="n">${m(salesBase)}</td><td class="n">${m(data.vatOut)}</td></tr>
          <tr><td><b>إجمالي ضريبة المخرجات</b></td><td class="n"></td><td class="n"><b>${m(data.vatOut)}</b></td></tr>

          <tr class="sec"><td colspan="3">المشتريات (ضريبة المدخلات)</td></tr>
          <tr><td>المشتريات الخاضعة القابلة للخصم</td><td class="n">${m(purchBase)}</td><td class="n">${m(data.vatIn)}</td></tr>
          <tr><td><b>إجمالي ضريبة المدخلات القابلة للخصم</b></td><td class="n"></td><td class="n"><b>${m(data.vatIn)}</b></td></tr>

          <tr class="due"><td>صافي الضريبة المستحقة للهيئة</td><td class="n"></td><td class="n">${m(data.vatDue)}</td></tr>
        </tbody>
      </table>

      <div class="note">
        • هذا الإقرار استرشادي أُنشئ آلياً من بيانات المنصة، ولا يُغني عن الإقرار الرسمي المعتمد من محاسب قانوني عبر بوابة هيئة الزكاة والضريبة والجمارك.<br>
        • النسبة المطبّقة 15% وفق الطريقة الحسابية 15/115 على المبالغ الشاملة للضريبة.<br>
        • تاريخ الإصدار: ${arDate(today())}
      </div>
      <div class="sign"><div>المحاسب</div><div>المدير المالي</div><div>اعتماد الإدارة</div></div>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  const L = ({ k, v, c, bold, ind, sub }) => (
    <div className="row" style={{
      justifyContent: 'space-between', padding: '9px 0',
      borderBottom: '1px solid rgba(51,44,38,.45)', paddingInlineStart: ind ? 18 : 0,
      background: sub ? 'rgba(200,162,74,.05)' : 'transparent'
    }}>
      <span style={{ fontSize: bold ? 13 : 12.5, fontWeight: bold ? 600 : 400, color: ind ? 'var(--dim)' : 'var(--txt)' }}>{k}</span>
      <span className="num" style={{ fontSize: bold ? 14 : 12.5, fontWeight: bold ? 700 : 500, color: c }}>{money(v)}</span>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className={'btn sm' + (period === 'daily' ? ' pri' : ' gh')} onClick={() => setPeriod('daily')}>يومي</button>
          <button className={'btn sm' + (period === 'monthly' ? ' pri' : ' gh')} onClick={() => setPeriod('monthly')}>شهري</button>
          <button className={'btn sm' + (period === 'yearly' ? ' pri' : ' gh')} onClick={() => setPeriod('yearly')}>سنوي</button>
        </div>
        <div className="row">
          {period === 'daily' && <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">اليوم</label>
            <input type="date" className="inp" value={day} onChange={e => setDay(e.target.value)} /></div>}
          {period === 'monthly' && <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">الشهر</label>
            <input type="month" className="inp" value={month} onChange={e => setMonth(e.target.value)} /></div>}
          {period === 'yearly' && <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">السنة</label>
            <select className="sel" value={year} onChange={e => setYear(e.target.value)}>
              {[0, 1, 2, 3].map(i => { const y = String(Number(today().slice(0, 4)) - i); return <option key={y} value={y}>{y}</option>; })}
            </select></div>}
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">الفرع</label>
            <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">كل الفروع</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn pri" onClick={doPrint}><FileText size={14} />طباعة قائمة الدخل (PDF)</button>
          <button className="btn" onClick={exportCsv}><Download size={14} />تصدير CSV</button>
          <button className="btn ok" onClick={exportXlsx}><FileBarChart size={14} />تصدير Excel</button>
          <button className="btn" onClick={exportVatDeclaration}><Receipt size={14} />إقرار ض.ق.م</button>
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }} data-pnlsrc>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>المصدر:</span>
        <button className={'btn sm ' + (!useGl ? 'pri' : 'gh')} data-src="closing" onClick={() => setSrc('closing')}>الإغلاقات اليومية ({data.n})</button>
        <button className={'btn sm ' + (useGl ? 'pri' : 'gh')} data-src="gl" disabled={!glOk} title={glOk ? '' : 'اختر فرعًا — الدفاتر لكل الفروع لمن يرى كل الفروع'} onClick={() => setSrc('gl')}>الدفاتر المحاسبية (كل القيود)</button>
        {useGl && !src && <span className="hint" data-pnlauto>لا إغلاقات يومية في الفترة — عُرضت القائمة من الدفاتر المحاسبية تلقائيًا</span>}
      </div>
      {useGl ? <GlPnl Y={gl} range={range} scopeLabel={scopeLabel} L={L} bf={bid === 'all' ? '' : bid} /> : <>
      <div className="grid g3">
        <Kpi label="صافي الإيراد" value={money(data.netRevenue)} sub={`${data.n} إغلاق`} icon={TrendingUp} color="#D9A83E" />
        <Kpi label="إجمالي التكاليف" value={money(data.totalCost)} icon={TrendingDown} color="#D9544D" />
        <Kpi label="صافي الربح بعد الضريبة" value={money(data.netAfterVat)} icon={Wallet} color={data.netAfterVat >= 0 ? '#4FB286' : '#D9544D'} />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />قائمة الدخل {range.type} — {range.label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 10 }}>{scopeLabel}</div>
        <L k="المبيعات النقدية" v={data.R.cash} c="var(--brass)" ind />
        <L k="مبيعات الشبكة (مدى/POS)" v={data.R.card} c="var(--brass)" ind />
        <L k="تحويل بنكي مباشر" v={data.R.bank} c="var(--brass)" ind />
        <L k="مبيعات تطبيقات التوصيل" v={data.R.del} c="var(--brass)" ind />
        <L k="إجمالي الإيرادات" v={data.grossRevenue} bold sub />
        <L k="عمولات منصات التوصيل" v={-data.commissions} c="var(--rose)" ind />
        <L k="صافي الإيرادات" v={data.netRevenue} c="var(--brass)" bold sub />
        {data.byCat.map(x => <L key={x.id} k={x.n} v={-x.v} c="var(--rose)" ind />)}
        <L k="الالتزامات الثابتة" v={-data.fixedTotal} c="var(--rose)" ind />
        <L k="الرواتب غير المصروفة بالفروع" v={-data.payrollRemaining} c="var(--rose)" ind />
        <L k="إجمالي التكاليف" v={-data.totalCost} c="var(--rose)" bold sub />
        <L k="الربح التشغيلي" v={data.operatingProfit} c={data.operatingProfit >= 0 ? 'var(--mint)' : 'var(--rose)'} bold />
        <L k="ضريبة القيمة المضافة المستحقة" v={-data.vatDue} c="var(--amber)" ind />
        <div style={{ marginTop: 8, padding: '14px 16px', background: data.netAfterVat >= 0 ? 'rgba(79,178,134,.12)' : 'rgba(217,84,77,.12)', borderRadius: 12, border: '1px solid ' + (data.netAfterVat >= 0 ? 'rgba(79,178,134,.4)' : 'rgba(217,84,77,.4)') }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>صافي الربح بعد الضريبة</span>
            <span className="num" style={{ fontSize: 18, fontWeight: 700, color: data.netAfterVat >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(data.netAfterVat)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--ink)' }}>
        <div className="card-t" style={{ marginBottom: 10, fontSize: 12.5 }}>مؤشرات ضريبية ورقابية</div>
        <L k="ض.ق.م على المبيعات (مُخرجة)" v={data.vatOut} />
        <L k="ض.ق.م على المشتريات (مُدخلة)" v={data.vatIn} />
        <L k="صافي الضريبة المستحقة للهيئة" v={data.vatDue} c="var(--amber)" bold />
        <L k="إجمالي فروقات الصندوق للفترة" v={data.cashVariance} c={data.cashVariance < 0 ? 'var(--rose)' : 'var(--faint)'} />
      </div>
      </>}
    </div>
  );
}

/* v53.9 — قائمة الدخل من الدفاتر المحاسبية (نفس تخطيط قائمة الدخل في المحاسبة: تكلفة المبيعات حسب تصنيف الحساب) */
function GlPnl({ Y, range, scopeLabel, L, bf }) {
  const ab = (v) => Math.abs(Number(v) || 0);
  const costs = ab(Y.cogsT) + ab(Y.opexT);
  const rows = [['صافي المبيعات', Y.netSales], ...Y.sales.map(l => ['  ' + l.code + ' ' + l.name, ab(l.amt)]), ['تكلفة المبيعات', -ab(Y.cogsT)], ...Y.cogs.map(l => ['  ' + l.code + ' ' + l.name, -ab(l.amt)]),
    ['مجمل الربح', Y.gross], ...(Y.opexG || []).flatMap(g => [[g.t, -ab(g.lines.reduce((a, l) => a + l.amt, 0))], ...g.lines.map(l => ['  ' + l.code + ' ' + l.name, -ab(l.amt)])]), ['الربح التشغيلي', Y.oper], ['بنود أخرى', Y.otherT], ['صافي الربح', Y.net]];
  const xls = () => exportExcel('قائمة-الدخل-الدفاتر-' + range.label, 'قائمة الدخل (الدفاتر) — ' + range.label, ['البند', 'المبلغ (ر.س)'], rows.map(r => [r[0], +(+r[1]).toFixed(2)]), { meta: [['النطاق', scopeLabel], ['الفترة', range.from + ' — ' + range.to]] });
  const Acc = ({ l, neg }) => <L k={<DocLink to={{ acc: l.code, from: range.from, to: range.to, ...(bf ? { bf } : {}) }} title="قيود الحساب في الفترة">{l.code} · {l.name}</DocLink>} v={neg ? -ab(l.amt) : ab(l.amt)} c={neg ? 'var(--rose)' : 'var(--brass)'} ind />;
  return (<>
    <div className="grid g3" data-glpnl>
      <Kpi label="صافي المبيعات" value={money(Y.netSales)} sub="من القيود" icon={TrendingUp} color="#D9A83E" />
      <Kpi label="إجمالي التكاليف" value={money(costs)} sub="تكلفة المبيعات + التشغيل" icon={TrendingDown} color="#D9544D" />
      <Kpi label="صافي الربح" value={money(Y.net)} icon={Wallet} color={Y.net >= 0 ? '#4FB286' : '#D9544D'} />
    </div>
    {Math.abs(Y.netSales) < 0.005 && <div className="note" data-nosales>لا مبيعات مسجّلة في هذه الفترة — المبيعات تدخل الدفاتر من الإغلاقات اليومية أو فواتير المبيعات أو استيراد مبيعات نقاط البيع. لذا تظهر التكاليف وحدها وصافي الربح سالبًا.</div>}
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><div className="card-t"><FileText size={15} color="var(--brass)" />قائمة الدخل {range.type} من الدفاتر — {range.label}</div>
        <button className="btn sm ok" onClick={xls}><FileBarChart size={13} />Excel</button></div>
      <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 10 }}>{scopeLabel} · اضغط أي حساب لفتح دفتر أستاذه وقيوده</div>
      {Y.sales.map(l => <Acc key={l.code} l={l} />)}
      <L k="صافي المبيعات" v={Y.netSales} c="var(--brass)" bold sub />
      {Y.cogs.map(l => <Acc key={l.code} l={l} neg />)}
      <L k="تكلفة المبيعات" v={-ab(Y.cogsT)} c="var(--rose)" bold sub />
      <L k="مجمل الربح" v={Y.gross} c={Y.gross >= 0 ? 'var(--mint)' : 'var(--rose)'} bold />
      {(Y.opexG || []).map(g => <React.Fragment key={g.t}><div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 8 }}>{g.t}</div>{g.lines.map(l => <Acc key={l.code} l={l} neg />)}</React.Fragment>)}
      <L k="مصروفات التشغيل" v={-ab(Y.opexT)} c="var(--rose)" bold sub />
      <L k="الربح التشغيلي" v={Y.oper} c={Y.oper >= 0 ? 'var(--mint)' : 'var(--rose)'} bold />
      {Math.abs(Y.otherT) > 0.004 && <L k="بنود أخرى" v={Y.otherT} ind />}
      <div style={{ marginTop: 8, padding: '14px 16px', background: Y.net >= 0 ? 'rgba(79,178,134,.12)' : 'rgba(217,84,77,.12)', borderRadius: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 14, fontWeight: 700 }}>صافي الربح</span>
          <span className="num" style={{ fontSize: 18, fontWeight: 700, color: Y.net >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{money(Y.net)}</span></div></div>
    </div>
  </>);
}
