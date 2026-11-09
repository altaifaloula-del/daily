/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { Printer, Download, TrendingUp, Landmark, Banknote, ArrowUp, ArrowDown, FileBarChart, Scale, BarChart3, Users, Store } from 'lucide-react';
import { Kpi, _xe, arDate, buildAccounting, buildPartners, countedClosing, customerAging, makeXlsx, money, monthLabel, printA4, sum, supplierAging, today } from '../../App.jsx';

export function BoardPack({ org, ops, me, myBranches, scoped, say }) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const [month, setMonth] = useState(today().slice(0, 7));

  const D = useMemo(() => {
    const magg = {}; A.entries.forEach(e => { if ((e.date || '').slice(0, 7) !== month) return; e.lines.forEach(l => { const x = magg[l.code] || (magg[l.code] = { d: 0, c: 0 }); x.d += l.debit; x.c += l.credit; }); });
    const mBal = (code, kind) => { const x = magg[code]; if (!x) return 0; return (kind === 'exp' || kind === 'asset') ? x.d - x.c : x.c - x.d; };
    const revAccts = A.accounts.filter(a => a.kind === 'rev' && magg[a.code]).map(a => ({ name: a.name, amt: r2(mBal(a.code, 'rev')) }));
    const expAccts = A.accounts.filter(a => a.kind === 'exp' && magg[a.code]).map(a => ({ code: a.code, name: a.name, amt: r2(mBal(a.code, 'exp')) })).sort((x, y) => y.amt - x.amt);
    const rev = r2(sum(revAccts, a => a.amt)), totExp = r2(sum(expAccts, a => a.amt)), net = r2(rev - totExp);
    const bsAssets = r2(sum(A.accounts.filter(a => a.kind === 'asset'), a => a.balance));
    const bsLiab = r2(sum(A.accounts.filter(a => a.kind === 'liab'), a => a.balance));
    // حقوق الملكية تشمل صافي أرباح الفترة غير المقفلة حتى تتوازن القائمة (الأصول = الالتزامات + الملكية)
    const cumNet = r2(sum(A.accounts.filter(a => a.kind === 'rev'), a => a.balance) - sum(A.accounts.filter(a => a.kind === 'exp'), a => a.balance));
    const bsEquity = r2(sum(A.accounts.filter(a => a.kind === 'equity'), a => a.balance) + cumNet);
    const cash = r2(sum(A.accounts.filter(a => a.cash), a => a.balance));
    const labor = r2(mBal('5201', 'exp') + mBal('5202', 'exp'));
    const costClass = org.costClass || {};
    const isVar = (c, n) => ['5301', '5302', '5198', '5150', '5199'].includes(c) || /مواد|مشتريات|بضاعة|خامات|طعام/.test(n || '');
    const variable = r2(sum(expAccts.filter(a => (costClass[a.code] || (isVar(a.code, a.name) ? 'variable' : 'fixed')) === 'variable'), a => a.amt));
    const fixed = r2(totExp - variable);
    const commissions = r2(mBal('5301', 'exp') + mBal('5302', 'exp'));
    const foodPct = rev > 0.004 ? r2((variable - commissions) / rev * 100) : 0;
    const laborPct = rev > 0.004 ? r2(labor / rev * 100) : 0;
    const primePct = r2(foodPct + laborPct);
    const varRatio = rev > 0.004 ? variable / rev : 0;
    const be = (1 - varRatio) > 0.0001 ? r2(fixed / (1 - varRatio)) : 0;
    const margin = rev > 0.004 ? r2(net / rev * 100) : 0;
    const pd = new Date(month + '-01'); pd.setMonth(pd.getMonth() - 1); const lastM = pd.toISOString().slice(0, 7);
    const counted = scoped.closings.filter(countedClosing);
    const mRevC = (m) => r2(sum(counted.filter(c => (c.date || '').slice(0, 7) === m), c => c.totalRevenue || 0));
    const revThis = mRevC(month), revLast = mRevC(lastM);
    const growth = revLast > 0.004 ? r2((revThis - revLast) / revLast * 100) : null;
    const arTot = r2(sum(buildPartners(org, ops).filter(p => p.type === 'customer'), p => customerAging(p, today()).total));
    const apTot = r2(sum(buildPartners(org, ops).filter(p => p.type === 'supplier'), p => supplierAging(p, today()).total));
    const perBr = (myBranches || []).map(b => { const bc = counted.filter(c => c.branchId === b.id && (c.date || '').slice(0, 7) === month); return { name: b.name, rev: r2(sum(bc, c => c.totalRevenue || 0)), net: r2(sum(bc, c => (c.totalRevenue || 0) - (c.totalExpenses || 0))) }; }).filter(x => x.rev > 0.004).sort((a, b) => b.net - a.net);
    return { revAccts, expAccts, rev, totExp, net, bsAssets, bsLiab, bsEquity, cash, foodPct, laborPct, primePct, be, margin, growth, lastM, revLast, arTot, apTot, perBr, hasData: rev > 0.004 || counted.some(c => (c.date || '').slice(0, 7) === month) };
  }, [A, month, org, ops, scoped, myBranches]);

  const mL = monthLabel(month);
  const printFull = () => {
    const tRows = (arr, neg) => arr.map(x => `<tr><td>${_xe(x.name)}</td><td class="n">${neg ? '(' + money(x.amt) + ')' : money(x.amt)}</td></tr>`).join('') || '<tr><td colspan="2" style="text-align:center;color:#999">—</td></tr>';
    const brRows = D.perBr.map(b => `<tr><td>${_xe(b.name)}</td><td class="n">${money(b.rev)}</td><td class="n">${money(b.net)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#999">لا بيانات فروع للشهر</td></tr>';
    const body = `
    <div class="box" style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px"><div class="sub">الإيراد</div><b>${money(D.rev)}</b></div>
      <div style="flex:1;min-width:120px"><div class="sub">صافي الربح</div><b>${money(D.net)}</b></div>
      <div style="flex:1;min-width:120px"><div class="sub">هامش الربح</div><b>${D.margin}%</b></div>
      <div style="flex:1;min-width:120px"><div class="sub">النقد</div><b>${money(D.cash)}</b></div>
      ${D.growth != null ? `<div style="flex:1;min-width:120px"><div class="sub">النمو عن ${D.lastM}</div><b>${D.growth >= 0 ? '+' : ''}${D.growth}%</b></div>` : ''}
    </div>
    <div class="grid2">
      <div><h2>قائمة الدخل — ${mL}</h2><table>${tRows(D.revAccts)}<tr class="tot"><td>إجمالي الإيراد</td><td class="n">${money(D.rev)}</td></tr>
      ${tRows(D.expAccts, true)}<tr class="tot"><td>إجمالي المصروفات</td><td class="n">(${money(D.totExp)})</td></tr>
      <tr class="tot"><td>${D.net >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</td><td class="n">${money(D.net)}</td></tr></table></div>
      <div><h2>المركز المالي (حتى ${arDate(today())})</h2><table>
      <tr class="tot"><td>إجمالي الأصول</td><td class="n">${money(D.bsAssets)}</td></tr>
      <tr><td>إجمالي الالتزامات</td><td class="n">${money(D.bsLiab)}</td></tr>
      <tr><td>حقوق الملكية (شامل ربح الفترة)</td><td class="n">${money(D.bsEquity)}</td></tr>
      <tr class="tot"><td>الالتزامات + حقوق الملكية</td><td class="n">${money(r2(D.bsLiab + D.bsEquity))}</td></tr>
      <tr><td>النقد والصناديق</td><td class="n">${money(D.cash)}</td></tr></table>
      <h2>المؤشرات التشغيلية</h2><table>
      <tr><td>تكلفة الطعام %</td><td class="n">${D.foodPct}%</td></tr>
      <tr><td>تكلفة العمالة %</td><td class="n">${D.laborPct}%</td></tr>
      <tr><td>التكلفة الأولية %</td><td class="n">${D.primePct}%</td></tr>
      <tr><td>نقطة التعادل الشهرية</td><td class="n">${money(D.be)}</td></tr></table></div>
    </div>
    <h2>الذمم</h2><table><tr><td>ذمم مدينة (على العملاء)</td><td class="n">${money(D.arTot)}</td></tr><tr><td>ذمم دائنة (للموردين)</td><td class="n">${money(D.apTot)}</td></tr></table>
    <h2>أداء الفروع — ${mL}</h2><table><thead><tr><th>الفرع</th><th class="n">الإيراد</th><th class="n">الصافي</th></tr></thead><tbody>${brRows}</tbody></table>`;
    printA4(org, 'تقرير الإدارة الشهري — ' + mL, 'حزمة المالك · صادر ' + arDate(today()), body) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const exportXlsx = () => {
    try {
      const is = [['قائمة الدخل — ' + mL, ''], ...D.revAccts.map(a => [a.name, a.amt]), ['إجمالي الإيراد', D.rev], ...D.expAccts.map(a => [a.name, -a.amt]), ['إجمالي المصروفات', -D.totExp], ['صافي الربح', D.net]];
      const bs = [['المركز المالي', ''], ['إجمالي الأصول', D.bsAssets], ['إجمالي الالتزامات', D.bsLiab], ['حقوق الملكية (شامل ربح الفترة)', D.bsEquity], ['الالتزامات + الملكية', r2(D.bsLiab + D.bsEquity)], ['النقد', D.cash]];
      const kp = [['المؤشر', 'القيمة'], ['هامش الربح %', D.margin], ['تكلفة الطعام %', D.foodPct], ['تكلفة العمالة %', D.laborPct], ['التكلفة الأولية %', D.primePct], ['نقطة التعادل', D.be], ['النمو عن الشهر السابق %', D.growth == null ? '' : D.growth], ['ذمم مدينة', D.arTot], ['ذمم دائنة', D.apTot]];
      const br = [['الفرع', 'الإيراد', 'الصافي'], ...D.perBr.map(b => [b.name, b.rev, b.net])];
      const blob = makeXlsx([{ name: 'قائمة الدخل', rows: is }, { name: 'المركز المالي', rows: bs }, { name: 'المؤشرات', rows: kp }, { name: 'الفروع', rows: br }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'تقرير_الإدارة_' + month + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل التقرير (Excel) ✓');
    } catch (e) { say('تعذّر توليد Excel', 'no'); }
  };

  const Mini = ({ title, icon: Ic, rows, foot }) => (
    <div className="card">
      <div className="card-t" style={{ marginBottom: 8 }}>{Ic && <Ic size={15} color="var(--brass)" />}{title}</div>
      <div className="tw"><table className="tb"><tbody>
        {rows.map((r, i) => <tr key={i} style={r[2] ? { fontWeight: 800, background: 'rgba(200,162,74,.05)' } : null}><td style={{ fontSize: 12.5 }}>{r[0]}</td><td className="num" style={{ textAlign: 'end', fontWeight: r[2] ? 800 : 500 }}>{r[1]}</td></tr>)}
      </tbody></table></div>
      {foot}
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>تقرير الإدارة الشهري — حزمة المالك</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>كل ما تحتاجه عن {mL} في تقرير واحد — القوائم والمؤشرات والذمم والفروع</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="month" className="inp" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn sm pri" onClick={printFull}><Printer size={13} />طباعة التقرير الكامل</button>
          <button className="btn sm" onClick={exportXlsx}><Download size={13} />Excel</button>
        </div>
      </div>

      {!D.hasData ? <div className="card"><div className="empty">لا نشاط مسجّل في {mL} — اختر شهرًا فيه إغلاقات وقيود.</div></div> : <>
        <div className="grid g4">
          <Kpi label="الإيراد" value={money(D.rev)} sub={mL} icon={TrendingUp} color="#C8A24A" />
          <Kpi label="صافي الربح" value={money(D.net)} sub={'هامش ' + D.margin + '%'} icon={Landmark} color={D.net >= 0 ? '#4FB286' : '#D9544D'} />
          <Kpi label="النقد والصناديق" value={money(D.cash)} sub="حتى اليوم" icon={Banknote} color="#5B93C4" />
          <Kpi label="النمو عن الشهر السابق" value={D.growth == null ? '—' : (D.growth >= 0 ? '+' : '') + D.growth + '%'} sub={D.growth == null ? 'لا شهر سابق' : 'مقابل ' + D.lastM} icon={D.growth >= 0 ? ArrowUp : ArrowDown} color={D.growth == null ? '#7E7566' : D.growth >= 0 ? '#4FB286' : '#D9544D'} />
        </div>

        <div className="grid g2" style={{ alignItems: 'start' }}>
          <Mini title={'قائمة الدخل — ' + mL} icon={FileBarChart} rows={[
            ...D.revAccts.map(a => [a.name, money(a.amt)]), ['إجمالي الإيراد', money(D.rev), true],
            ...D.expAccts.slice(0, 6).map(a => [a.name, '(' + money(a.amt) + ')']),
            ['إجمالي المصروفات', '(' + money(D.totExp) + ')', true], [D.net >= 0 ? 'صافي الربح' : 'صافي الخسارة', money(D.net), true]
          ]} />
          <div className="grid" style={{ gap: 12 }}>
            <Mini title="المركز المالي" icon={Scale} rows={[['إجمالي الأصول', money(D.bsAssets), true], ['إجمالي الالتزامات', money(D.bsLiab)], ['حقوق الملكية (شامل ربح الفترة)', money(D.bsEquity)], ['الالتزامات + الملكية', money(r2(D.bsLiab + D.bsEquity)), true]]} />
            <Mini title="المؤشرات التشغيلية" icon={BarChart3} rows={[['تكلفة الطعام %', D.foodPct + '%'], ['تكلفة العمالة %', D.laborPct + '%'], ['التكلفة الأولية %', D.primePct + '%'], ['نقطة التعادل', money(D.be), true]]} />
          </div>
        </div>

        <div className="grid g2" style={{ alignItems: 'start' }}>
          <Mini title="الذمم" icon={Users} rows={[['ذمم مدينة (على العملاء)', money(D.arTot)], ['ذمم دائنة (للموردين)', money(D.apTot)]]} />
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><Store size={15} color="var(--brass)" />أداء الفروع — {mL}</div>
            <div className="tw"><table className="tb">
              <thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>الإيراد</th><th style={{ textAlign: 'end' }}>الصافي</th></tr></thead>
              <tbody>
                {D.perBr.map((b, i) => <tr key={i}><td style={{ fontSize: 12.5, fontWeight: 600 }}>{b.name}</td><td className="num" style={{ textAlign: 'end' }}>{money(b.rev)}</td><td className="num" style={{ textAlign: 'end', color: b.net >= 0 ? 'var(--mint)' : '#D9544D' }}>{money(b.net)}</td></tr>)}
                {D.perBr.length === 0 && <tr><td colSpan={3}><div className="empty">لا بيانات فروع للشهر.</div></td></tr>}
              </tbody>
            </table></div>
          </div>
        </div>

        <div className="note">📄 هذه معاينة مختصرة. اضغط <b>«طباعة التقرير الكامل»</b> لمستند A4 مفصّل، أو <b>Excel</b> لملف متعدّد الأوراق (قائمة الدخل · المركز المالي · المؤشرات · الفروع). القوائم من قيود {mL}؛ المركز المالي تراكميّ حتى اليوم.</div>
      </>}
    </div>
  );
}
