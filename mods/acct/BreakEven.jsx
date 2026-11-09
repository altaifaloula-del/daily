/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { Download, Scale, CalendarDays, ShieldCheck, TrendingUp, Store, Users, Landmark, FileText, Check } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { Field, Kpi, buildAccounting, chartTone, makeXlsx, money, rolePost, short, sum, today } from '../../App.jsx';

export function BreakEven({ org, ops, me, scoped, setTab, theme, commitOrg, say }) {
  const tn = chartTone(theme);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [ovr, setOvr] = useState(() => ({ ...(org.costClass || {}) }));
  const [daysStr, setDaysStr] = useState(String((org.beCfg && org.beCfg.days) || 30));
  const canPost = rolePost(me?.role);

  const agg = useMemo(() => { const m = {}; A.entries.forEach(e => { if ((e.date || '').slice(0, 7) !== month) return; e.lines.forEach(l => { const x = m[l.code] || (m[l.code] = { d: 0, c: 0 }); x.d += l.debit; x.c += l.credit; }); }); return m; }, [A, month]);
  const acctBal = (code, kind) => { const x = agg[code]; if (!x) return 0; return (kind === 'exp' || kind === 'asset') ? x.d - x.c : x.c - x.d; };
  const revenue = r2(sum(A.accounts.filter(a => a.kind === 'rev'), a => acctBal(a.code, 'rev')));
  const expAccts = A.accounts.filter(a => a.kind === 'exp' && agg[a.code] && Math.abs(acctBal(a.code, 'exp')) > 0.004).map(a => ({ code: a.code, name: a.name, amt: r2(acctBal(a.code, 'exp')) }));
  const isVarDefault = (code, name) => ['5301', '5302', '5198', '5150', '5199'].includes(code) || /مواد|مشتريات|بضاعة|خامات|طعام/.test(name || '');
  const classOf = (a) => ovr[a.code] || (isVarDefault(a.code, a.name) ? 'variable' : 'fixed');
  const variableTotal = r2(sum(expAccts.filter(a => classOf(a) === 'variable'), a => a.amt));
  const fixedTotal = r2(sum(expAccts.filter(a => classOf(a) === 'fixed'), a => a.amt));
  const totalCost = r2(variableTotal + fixedTotal);
  const profit = r2(revenue - totalCost);
  const cm = r2(revenue - variableTotal);
  const cmRatio = revenue > 0.004 ? cm / revenue : 0;
  const breakEven = cmRatio > 0.0001 ? r2(fixedTotal / cmRatio) : 0;
  const days = Number(daysStr) || 30;
  const breakEvenDay = days > 0 ? r2(breakEven / days) : 0;
  const marginSafety = revenue > 0.004 ? r2((revenue - breakEven) / revenue * 100) : 0;
  const commissions = r2(acctBal('5301', 'exp') + acctBal('5302', 'exp'));
  const labor = r2(acctBal('5201', 'exp') + acctBal('5202', 'exp'));
  const food = r2(variableTotal - commissions);
  const foodPct = revenue > 0.004 ? r2(food / revenue * 100) : 0;
  const laborPct = revenue > 0.004 ? r2(labor / revenue * 100) : 0;
  const primePct = r2(foodPct + laborPct);
  const monName = (() => { try { return new Date(month + '-01').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); } catch { return month; } })();

  const hi = Math.max(revenue, breakEven, 1000) * 1.5;
  const varRatio = revenue > 0 ? variableTotal / revenue : 0;
  const chartData = Array.from({ length: 6 }, (_, i) => { const s = r2(hi * i / 5); return { s: short(s), 'الإيراد': s, 'التكلفة الكلية': r2(fixedTotal + varRatio * s) }; });

  const toggle = (code) => setOvr(o => ({ ...o, [code]: (o[code] || (isVarDefault(code, (expAccts.find(x => x.code === code) || {}).name) ? 'variable' : 'fixed')) === 'variable' ? 'fixed' : 'variable' }));
  const saveClass = async () => { await commitOrg(d => ({ ...d, costClass: ovr, beCfg: { days } }), { actionType: 'update', targetType: 'tax_settings', targetId: 'costClass', title: 'حفظ تصنيف التكاليف (التعادل)', details: 'أيام التشغيل ' + days }); say('حُفظ التصنيف ✓'); };
  const beRows = () => [['المؤشر', 'القيمة'], ['الشهر', monName], ['الإيراد', revenue], ['التكاليف المتغيرة', variableTotal], ['التكاليف الثابتة', fixedTotal], ['هامش المساهمة', cm], ['نسبة هامش المساهمة %', r2(cmRatio * 100)], ['نقطة التعادل (شهري)', breakEven], ['نقطة التعادل (يومي)', breakEvenDay], ['هامش الأمان %', marginSafety], ['الربح الحالي', profit], ['تكلفة الطعام %', foodPct], ['تكلفة العمالة %', laborPct], ['التكلفة الأولية %', primePct]];
  const exportBE = () => { try { const blob = makeXlsx([{ name: 'تحليل التعادل', rows: beRows() }, { name: 'تصنيف التكاليف', rows: [['الحساب', 'المبلغ', 'التصنيف'], ...expAccts.map(a => [a.name, a.amt, classOf(a) === 'variable' ? 'متغيّر' : 'ثابت'])] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'تحليل_التعادل_' + month + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل تحليل التعادل (Excel) ✓'); } catch (e) { say('تعذّر توليد Excel', 'no'); } };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>تحليل التعادل وتكلفة الطعام</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>كم مبيعات تحتاج لتغطية تكاليفك؟ ونِسَب تكلفة الطعام والعمالة — من أرقام {monName}</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="month" className="inp" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn sm" onClick={exportBE}><Download size={13} />Excel</button>
        </div>
      </div>

      {revenue <= 0.004 ? <div className="card"><div className="empty">لا إيراد مسجّل في {monName} — اختر شهرًا فيه إغلاقات معتمدة.</div></div> : <>
        <div className="grid g4">
          <Kpi label="نقطة التعادل (شهري)" value={money(breakEven)} sub={cmRatio > 0 ? 'لتغطية التكاليف الثابتة' : 'المتغيّر ≥ الإيراد!'} icon={Scale} color="#C8A24A" />
          <Kpi label="نقطة التعادل (يومي)" value={money(breakEvenDay)} sub={days + ' يوم تشغيل'} icon={CalendarDays} color="#5B93C4" />
          <Kpi label="هامش الأمان" value={marginSafety.toFixed(1) + '%'} sub={marginSafety >= 0 ? 'فوق التعادل' : 'تحت التعادل — خطر' } icon={ShieldCheck} color={marginSafety >= 20 ? '#4FB286' : marginSafety >= 0 ? '#E0A458' : '#D9544D'} />
          <Kpi label="الربح الحالي للشهر" value={money(profit)} sub={'هامش ' + (revenue > 0 ? r2(profit / revenue * 100) : 0) + '%'} icon={TrendingUp} color={profit >= 0 ? '#4FB286' : '#D9544D'} />
        </div>

        <div className="grid g3">
          <Kpi label="تكلفة الطعام / المواد" value={foodPct.toFixed(1) + '%'} sub={money(food) + ' من الإيراد' + (foodPct > 35 ? ' · مرتفعة' : '')} icon={Store} color={foodPct <= 35 ? '#4FB286' : '#E0A458'} />
          <Kpi label="تكلفة العمالة" value={laborPct.toFixed(1) + '%'} sub={money(labor) + ' رواتب وتأمينات'} icon={Users} color={laborPct <= 30 ? '#4FB286' : '#E0A458'} />
          <Kpi label="التكلفة الأولية (طعام + عمالة)" value={primePct.toFixed(1) + '%'} sub={primePct <= 60 ? 'ضمن المستهدف (≤60%)' : 'أعلى من المستهدف'} icon={Landmark} color={primePct <= 60 ? '#4FB286' : primePct <= 65 ? '#E0A458' : '#D9544D'} />
        </div>

        <div className="card">
          <div className="card-t" style={{ marginBottom: 14 }}><Scale size={15} color="var(--brass)" />رسم التعادل — تلتقي التكلفة الكلية مع الإيراد عند نقطة التعادل</div>
          <div style={{ height: 250, direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 6, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={tn.grid} vertical={false} />
                <XAxis dataKey="s" tick={{ fill: tn.tick, fontSize: 9.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
                <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }} formatter={(v, n) => [money(v), n]} />
                <Line type="monotone" dataKey="الإيراد" stroke={tn.pos} strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="التكلفة الكلية" stroke={tn.warn} strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="row" style={{ gap: 14, fontSize: 11, justifyContent: 'center', marginTop: 6 }}>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 11, height: 3, background: '#4FB286', display: 'inline-block' }} />الإيراد</span>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 11, height: 3, background: '#E0A458', display: 'inline-block' }} />التكلفة الكلية (ثابت + متغيّر)</span>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <div className="card-t"><FileText size={15} color="var(--brass)" />تصنيف التكاليف — اضغط لتبديل ثابت/متغيّر</div>
            <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
              <Field label="أيام التشغيل/شهر" style={{ width: 120 }}><input className="inp n" inputMode="decimal" value={daysStr} onChange={e => setDaysStr(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              {canPost && <button className="btn sm pri" onClick={saveClass}><Check size={14} />حفظ التصنيف</button>}
            </div>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>حساب المصروف</th><th style={{ textAlign: 'end' }}>المبلغ ({monName})</th><th style={{ textAlign: 'center' }}>التصنيف</th></tr></thead>
              <tbody>
                {expAccts.map(a => (
                  <tr key={a.code}>
                    <td style={{ fontSize: 12.5 }}>{a.name}</td>
                    <td className="num" style={{ textAlign: 'end' }}>{money(a.amt)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button className={'btn sm ' + (classOf(a) === 'variable' ? 'pri' : 'gh')} onClick={() => canPost && toggle(a.code)} disabled={!canPost}>{classOf(a) === 'variable' ? 'متغيّر' : 'ثابت'}</button>
                    </td>
                  </tr>
                ))}
                {expAccts.length === 0 && <tr><td colSpan={3}><div className="empty">لا مصروفات في هذا الشهر.</div></td></tr>}
                <tr style={{ fontWeight: 800, background: 'rgba(200,162,74,.05)' }}>
                  <td>الإجمالي — متغيّر {money(variableTotal)} · ثابت {money(fixedTotal)}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(totalCost)}</td><td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="note">
          <b>كيف تُقرأ؟</b> نقطة التعادل = التكاليف الثابتة ÷ نسبة هامش المساهمة (1 − نسبة التكاليف المتغيّرة). فوقها تربح، وتحتها تخسر.
          <b> التكلفة الأولية</b> (طعام + عمالة) أهم مؤشر مطاعم — استهدِفها ≤ 60%. المبدئيات: العمولات والمواد <b>متغيّرة</b>، والرواتب والإيجار والإهلاك <b>ثابتة</b> — بدّل أيّها بضغطة واحفظ. الأرقام من قيود الشهر المختار.
        </div>
      </>}
    </div>
  );
}
