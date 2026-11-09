/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { FileBarChart, Download, CircleDollarSign, Receipt, TrendingUp, Landmark, FileText } from 'lucide-react';
import { EXP_CATS, Kpi, exportExcel, money, sum, today } from '../../App.jsx';

export function IncomeStatement({ org, ops, myBranches, scoped, say }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [bid, setBid] = useState('all');

  const branches = myBranches.filter(b => bid === 'all' || b.id === bid);
  const ids = branches.map(b => b.id);
  const cls = scoped.closings.filter(c => c.date.slice(0, 7) === month && ids.includes(c.branchId));

  const R = {
    cash: sum(cls, c => c.cashSales),
    card: sum(cls, c => c.cardSales),
    bank: sum(cls, c => c.bankTransferSales || 0),
    del: sum(cls, c => c.totalDeliverySales)
  };
  const grossRevenue = R.cash + R.card + R.bank + R.del;
  const commissions = sum(cls, c => sum(c.deliverySales || [], d => d.commissionAmount || 0));
  const netRevenue = grossRevenue - commissions;

  const cats = org.expenseCats || EXP_CATS;
  const byCat = cats.map(k => ({
    id: k.id, n: k.n, taxable: k.taxable,
    v: sum(cls.flatMap(c => c.expenses || []).filter(e => e.categoryId === k.id), e => e.amount)
  })).filter(x => x.v > 0);
  const branchExpenses = sum(byCat, x => x.v);

  const fx = (ops.fixedExpenses || []).filter(f => f.month === month && ids.includes(f.branchId));
  const fixedTotal = sum(fx, f => f.rentAmount + f.electricityBill + f.waterBill + f.internetBill + f.otherBills);

  const emps = (org.employees || []).filter(e => ids.includes(e.branchId));
  const payrollCost = sum(emps, e => e.baseSalary + (e.housingAllowance || 0) + (e.transportAllowance || 0));
  const paidAtBranch = sum(byCat.filter(x => ['ec2', 'ec3'].includes(x.id)), x => x.v);
  const payrollRemaining = Math.max(0, payrollCost - paidAtBranch);

  const _tc = org.taxCfg || {}; const _vr = _tc.enabled ? (Number(_tc.rate) || 15) : 0; // v15: تتبع تفعيل الضريبة ونسبتها
  const vatOut = _vr ? grossRevenue * _vr / (100 + _vr) : 0;
  const vatIn = _vr ? sum(byCat.filter(x => x.taxable), x => x.v) * _vr / (100 + _vr) : 0;
  const vatDue = vatOut - vatIn;

  const totalCost = branchExpenses + fixedTotal + payrollRemaining;
  const operatingProfit = netRevenue - totalCost;
  const netAfterVat = operatingProfit - vatDue;
  const cashVariance = sum(cls, c => c.variance);

  const L = ({ k, v, c, bold, ind, note }) => (
    <div className="row" style={{
      justifyContent: 'space-between', padding: '9px 0',
      borderBottom: '1px solid rgba(51,44,38,.45)',
      paddingInlineStart: ind ? 18 : 0
    }}>
      <span style={{ fontSize: bold ? 13 : 12.5, fontWeight: bold ? 600 : 400, color: ind ? 'var(--dim)' : 'var(--txt)' }}>
        {k}{note && <span style={{ fontSize: 10.5, color: 'var(--faint)', marginInlineStart: 7 }}>{note}</span>}
      </span>
      <span className="num" style={{ fontSize: bold ? 14 : 12.5, fontWeight: bold ? 700 : 500, color: c }}>{money(v)}</span>
    </div>
  );

  const exportCsv = () => {
    const rows = [
      ['قائمة الدخل', month, bid === 'all' ? 'كل الفروع' : branches[0]?.name],
      ['مبيعات نقدية', R.cash], ['مبيعات الشبكة', R.card], ['تحويل بنكي', R.bank],
      ['تطبيقات التوصيل', R.del], ['إجمالي الإيراد', grossRevenue],
      ['عمولات التطبيقات', -commissions], ['صافي الإيراد', netRevenue],
      ...byCat.map(x => ['مصروف: ' + x.n, -x.v]),
      ['الالتزامات الثابتة', -fixedTotal],
      ['الرواتب غير المصروفة بالفروع', -payrollRemaining],
      ['إجمالي التكاليف', -totalCost],
      ['الربح التشغيلي', operatingProfit],
      ['ض.ق.م المستحقة', -vatDue],
      ['صافي الربح بعد الضريبة', netAfterVat],
      ['فروقات الصندوق', cashVariance]
    ];
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `قائمة-الدخل-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    say('تم تنزيل قائمة الدخل');
  };
  // v15.4: تصدير Excel لقائمة الدخل الشهرية
  const exportXlsx = () => {
    const N = (n) => Math.round((n || 0) * 100) / 100;
    const xrows = [
      ['مبيعات نقدية', N(R.cash)], ['مبيعات الشبكة', N(R.card)], ['تحويل بنكي', N(R.bank)],
      ['تطبيقات التوصيل', N(R.del)], ['إجمالي الإيراد', N(grossRevenue)],
      ['عمولات التطبيقات', -N(commissions)], ['صافي الإيراد', N(netRevenue)],
      ...byCat.map(x => ['مصروف: ' + x.n, -N(x.v)]),
      ['الالتزامات الثابتة', -N(fixedTotal)], ['الرواتب غير المصروفة بالفروع', -N(payrollRemaining)],
      ['إجمالي التكاليف', -N(totalCost)], ['الربح التشغيلي', N(operatingProfit)],
      ['ض.ق.م المستحقة', -N(vatDue)], ['فروقات الصندوق', N(cashVariance)]
    ];
    exportExcel(`قائمة-الدخل-${month}`, `قائمة الدخل — ${month}`, ['البند', 'المبلغ (ر.س)'], xrows, {
      meta: [`${org.company.name || ''} · الرقم الضريبي: ${org.company.taxNumber || '—'}`, `النطاق: ${bid === 'all' ? 'كل الفروع' : (branches[0]?.name || '')} · الشهر: ${month}`],
      totals: ['صافي الربح بعد الضريبة', N(netAfterVat)]
    });
    say('تم تنزيل قائمة الدخل بصيغة Excel');
  };

  return (
    <>
      <div className="card">
        <div className="row">
          <div style={{ flex: 1, minWidth: 150 }}>
            <label className="lbl">الشهر المالي</label>
            <input type="month" className="inp" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <div style={{ flex: 1.5, minWidth: 180 }}>
            <label className="lbl">النطاق</label>
            <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
              <option value="all">كل الفروع ضمن صلاحيتي</option>
              {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="row" style={{ alignSelf: 'flex-end', gap: 8 }}>
            <button className="btn pri" onClick={exportXlsx}><FileBarChart size={14} />تصدير Excel</button>
            <button className="btn gh" onClick={exportCsv}><Download size={14} />CSV</button>
          </div>
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="صافي الإيراد" value={money(netRevenue)} sub={`${cls.length} إغلاق`} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="إجمالي التكاليف" value={money(totalCost)} sub={`${netRevenue ? ((totalCost / netRevenue) * 100).toFixed(1) : 0}% من الإيراد`} icon={Receipt} color="#D9544D" />
        <Kpi label="الربح التشغيلي" value={money(operatingProfit)} sub={`هامش ${netRevenue ? ((operatingProfit / netRevenue) * 100).toFixed(1) : 0}%`} icon={TrendingUp} color="#4FB286" />
        <Kpi label="ض.ق.م المستحقة" value={money(vatDue)} sub="مخرجات ناقص مدخلات" icon={Landmark} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><FileText size={15} color="var(--brass)" />قائمة الدخل — {month}</div>
          <span className="badge b-dim">{bid === 'all' ? `${branches.length} فرع` : branches[0]?.name}</span>
        </div>

        <div className="lbl" style={{ marginTop: 4 }}>الإيرادات</div>
        <L k="مبيعات نقدية" v={R.cash} ind />
        <L k="مبيعات الشبكة (مدى/فيزا)" v={R.card} ind />
        <L k="تحويل بنكي مباشر" v={R.bank} ind />
        <L k="تطبيقات التوصيل" v={R.del} ind />
        <L k="إجمالي الإيراد" v={grossRevenue} bold c="var(--brass)" />
        <L k="ناقص عمولات التطبيقات" v={-commissions} ind c="var(--rose)" />
        <L k="صافي الإيراد" v={netRevenue} bold c="var(--brass)" />

        <div className="lbl" style={{ marginTop: 16 }}>التكاليف التشغيلية بالفروع</div>
        {byCat.map(x => <L key={x.id} k={x.n} v={x.v} ind />)}
        {byCat.length === 0 && <div className="empty" style={{ padding: 16 }}>لا مصروفات مسجلة لهذا الشهر.</div>}
        <L k="إجمالي مصروفات الفروع" v={branchExpenses} bold c="var(--rose)" />

        <div className="lbl" style={{ marginTop: 16 }}>التكاليف الثابتة والإدارية</div>
        <L k="إيجارات الفروع" v={sum(fx, f => f.rentAmount)} ind />
        <L k="كهرباء ومياه" v={sum(fx, f => f.electricityBill + f.waterBill)} ind />
        <L k="إنترنت ومصاريف إدارية" v={sum(fx, f => f.internetBill + f.otherBills)} ind />
        <L k="الرواتب المستحقة" v={payrollRemaining} ind note={paidAtBranch > 0 ? `صُرف بالفروع ${money(paidAtBranch)}` : ''} />
        <L k="إجمالي التكاليف الثابتة" v={fixedTotal + payrollRemaining} bold c="var(--rose)" />

        <hr className="hr" />
        <L k="الربح التشغيلي" v={operatingProfit} bold c={operatingProfit >= 0 ? 'var(--mint)' : 'var(--rose)'} />
        <L k="ضريبة القيمة المضافة المستحقة" v={vatDue} ind c="var(--sky)"
          note={`مخرجات ${money(vatOut)} − مدخلات ${money(vatIn)}`} />
        <div style={{
          marginTop: 12, padding: '13px 15px', borderRadius: 12,
          border: '1px solid ' + (netAfterVat >= 0 ? 'rgba(79,178,134,.45)' : 'rgba(217,84,77,.45)'),
          background: netAfterVat >= 0 ? 'rgba(79,178,134,.08)' : 'rgba(217,84,77,.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>صافي الربح بعد الضريبة</span>
          <span className="num" style={{ fontSize: 20, fontWeight: 700, color: netAfterVat >= 0 ? 'var(--mint)' : 'var(--rose)' }}>
            {money(netAfterVat)}
          </span>
        </div>
        {cashVariance !== 0 && (
          <div style={{ fontSize: 11.5, color: cashVariance < 0 ? 'var(--rose)' : 'var(--dim)', marginTop: 10 }}>
            ملاحظة: فروقات الصندوق خلال الشهر بلغت {money(cashVariance)} ر.س وهي خارج القائمة أعلاه وتُعالَج كتسويات.
          </div>
        )}
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 10, lineHeight: 1.9 }}>
          الرواتب تظهر بالمستحق الشهري بعد استبعاد ما صُرف نقداً بالفروع لتفادي الازدواج. القائمة استرشادية لأغراض الإدارة ولا تحل محل القوائم المعتمدة من المحاسب القانوني.
        </div>
      </div>
    </>
  );
}
