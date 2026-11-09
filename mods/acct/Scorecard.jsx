/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { Download, Check, CheckCircle2, TrendingUp, Landmark } from 'lucide-react';
import { Kpi, SC_KPIS, buildAccounting, countedClosing, makeXlsx, money, monthLabel, rolePost, sum, today } from '../../App.jsx';

export function Scorecard({ org, ops, me, scoped, commitOrg, say, setTab }) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [tg, setTg] = useState(() => ({ ...((org.scorecard && org.scorecard.targets) || {}) }));
  const [enabled, setEnabled] = useState(() => (org.scorecard && org.scorecard.enabled) || SC_KPIS.map(k => k.k));
  const canPost = rolePost(me?.role);

  const agg = useMemo(() => { const m = {}; A.entries.forEach(e => { if ((e.date || '').slice(0, 7) !== month) return; e.lines.forEach(l => { const x = m[l.code] || (m[l.code] = { d: 0, c: 0 }); x.d += l.debit; x.c += l.credit; }); }); return m; }, [A, month]);
  const accBal = (code, kind) => { const x = agg[code]; if (!x) return 0; return (kind === 'exp' || kind === 'asset') ? x.d - x.c : x.c - x.d; };
  const rev = r2(sum(A.accounts.filter(a => a.kind === 'rev'), a => accBal(a.code, 'rev')));
  const exp = r2(sum(A.accounts.filter(a => a.kind === 'exp'), a => accBal(a.code, 'exp')));
  const net = r2(rev - exp);
  const margin = rev > 0.004 ? r2(net / rev * 100) : 0;
  const labor = r2(accBal('5201', 'exp') + accBal('5202', 'exp'));
  const laborPct = rev > 0.004 ? r2(labor / rev * 100) : 0;
  const costClass = org.costClass || {};
  const isVarDefault = (code, name) => ['5301', '5302', '5198', '5150', '5199'].includes(code) || /مواد|مشتريات|بضاعة|خامات|طعام/.test(name || '');
  const expAccts = A.accounts.filter(a => a.kind === 'exp' && agg[a.code]).map(a => ({ code: a.code, name: a.name, amt: r2(accBal(a.code, 'exp')) }));
  const variable = r2(sum(expAccts.filter(a => (costClass[a.code] || (isVarDefault(a.code, a.name) ? 'variable' : 'fixed')) === 'variable'), a => a.amt));
  const commissions = r2(accBal('5301', 'exp') + accBal('5302', 'exp'));
  const foodPct = rev > 0.004 ? r2((variable - commissions) / rev * 100) : 0;
  const prime = r2(foodPct + laborPct);
  const counted = scoped.closings.filter(c => countedClosing(c) && (c.date || '').slice(0, 7) === month);
  const days = new Set(counted.map(c => c.date)).size || 1;
  const val = { rev, net, margin, food: foodPct, labor: laborPct, prime, avgday: r2(rev / days), variance: r2(sum(counted, c => c.variance || 0)), count: counted.length, cash: r2(sum(A.accounts.filter(a => a.cash), a => a.balance)) };

  const numT = (k) => { const v = tg[k]; if (v == null || v === '') return null; const n = Number(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? null : n; };
  const statusOf = (kpi, actual, target) => {
    if (target == null) return { s: 'none', c: '#7E7566', ar: 'بلا هدف' };
    if (kpi.dir === 'up') return actual >= target ? { s: 'ok', c: '#4FB286', ar: 'محقّق' } : actual >= target * 0.85 ? { s: 'near', c: '#E0A458', ar: 'قريب' } : { s: 'miss', c: '#D9544D', ar: 'دون الهدف' };
    if (kpi.dir === 'down') return actual <= target ? { s: 'ok', c: '#4FB286', ar: 'محقّق' } : actual <= target * 1.15 ? { s: 'near', c: '#E0A458', ar: 'قريب' } : { s: 'miss', c: '#D9544D', ar: 'تجاوز الهدف' };
    return Math.abs(actual) <= Math.abs(target) ? { s: 'ok', c: '#4FB286', ar: 'ضمن الحد' } : Math.abs(actual) <= Math.abs(target) * 2 ? { s: 'near', c: '#E0A458', ar: 'قريب' } : { s: 'miss', c: '#D9544D', ar: 'خارج الحد' };
  };
  const fmtVal = (kpi, v) => kpi.unit === 'pct' ? (r2(v).toFixed(1) + '%') : kpi.unit === 'num' ? String(r2(v)) : money(v);
  const rows = SC_KPIS.filter(k => enabled.includes(k.k)).map(kpi => { const actual = r2(val[kpi.k]); const target = numT(kpi.k); return { kpi, actual, target, st: statusOf(kpi, actual, target) }; });
  const withTarget = rows.filter(r => r.target != null);
  const achieved = withTarget.filter(r => r.st.s === 'ok').length;

  const save = async () => { await commitOrg(d => ({ ...d, scorecard: { targets: tg, enabled } }), { actionType: 'update', targetType: 'tax_settings', targetId: 'scorecard', title: 'حفظ لوحة الأهداف', details: withTarget.length + ' هدف' }); say('حُفظت اللوحة ✓'); };
  const toggleKpi = (k) => setEnabled(e => e.includes(k) ? e.filter(x => x !== k) : [...e, k]);
  const exportSC = () => { try { const head = ['المؤشر', 'القيمة الحالية', 'الهدف', 'الحالة']; const body = rows.map(r => [r.kpi.ar, r.kpi.unit === 'pct' ? r2(r.actual) : r.actual, r.target == null ? '' : r.target, r.st.ar]); const blob = makeXlsx([{ name: 'لوحة الأهداف ' + month, rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'لوحة_الأهداف_' + month + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّلت اللوحة (Excel) ✓'); } catch (e) { say('تعذّر توليد Excel', 'no'); } };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>لوحة المؤشرات بأهداف</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>حدّد أهدافك الشهرية وتابع تحقّقها بإشارات لونية — القيم من قيودك</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="month" className="inp" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn sm" onClick={exportSC}><Download size={13} />Excel</button>
          {canPost && <button className="btn sm pri" onClick={save}><Check size={14} />حفظ</button>}
        </div>
      </div>

      <div className="grid g3">
        <Kpi label="أهداف محقّقة" value={achieved + ' / ' + withTarget.length} sub={withTarget.length ? Math.round(achieved / withTarget.length * 100) + '% من أهدافك' : 'حدّد أهدافك أدناه'} icon={CheckCircle2} color={withTarget.length && achieved === withTarget.length ? '#4FB286' : achieved > 0 ? '#E0A458' : '#7E7566'} />
        <Kpi label="إيراد الشهر" value={money(rev)} sub={monthLabel(month)} icon={TrendingUp} color="#C8A24A" />
        <Kpi label="صافي الشهر" value={money(net)} sub={'هامش ' + margin + '%'} icon={Landmark} color={net >= 0 ? '#4FB286' : '#D9544D'} />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 10 }}><CheckCircle2 size={15} color="var(--brass)" />المؤشرات مقابل الأهداف — {monthLabel(month)}</div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>المؤشر</th><th style={{ textAlign: 'end' }}>القيمة الحالية</th><th style={{ textAlign: 'center' }}>الهدف</th><th style={{ textAlign: 'center' }}>الحالة</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.kpi.k}>
                  <td style={{ fontSize: 12.5, fontWeight: 600 }}>{r.kpi.ar}<span style={{ fontSize: 9.5, color: 'var(--faint)' }}> · {r.kpi.dir === 'up' ? 'الأعلى أفضل' : r.kpi.dir === 'down' ? 'الأقل أفضل' : 'قرب الصفر'}</span></td>
                  <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{fmtVal(r.kpi, r.actual)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input className="inp n" style={{ width: 100, textAlign: 'center' }} inputMode="decimal" value={tg[r.kpi.k] != null ? tg[r.kpi.k] : ''} placeholder="—" disabled={!canPost} onChange={e => setTg(s => ({ ...s, [r.kpi.k]: e.target.value.replace(/[^\d.-]/g, '') }))} />
                  </td>
                  <td style={{ textAlign: 'center' }}><span className="badge" style={{ background: 'transparent', border: '1px solid ' + r.st.c, color: r.st.c }}>● {r.st.ar}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: 'var(--dim)', margin: '12px 0 6px' }}>المؤشرات المعروضة (اضغط لإظهار/إخفاء)</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {SC_KPIS.map(k => <button key={k.k} className={'btn sm' + (enabled.includes(k.k) ? ' pri' : ' gh')} onClick={() => canPost && toggleKpi(k.k)} disabled={!canPost}>{enabled.includes(k.k) ? '✓ ' : ''}{k.ar}</button>)}
        </div>
      </div>

      <div className="note">🎯 القيمة الحالية تُحتسب من قيود الشهر المختار؛ الهدف تحدّده أنت. الإشارة: <b style={{ color: '#4FB286' }}>أخضر</b> محقّق · <b style={{ color: '#E0A458' }}>أصفر</b> قريب (ضمن 15%) · <b style={{ color: '#D9544D' }}>أحمر</b> بعيد. نِسَب الطعام والعمالة تتبع تصنيف التكاليف في «تحليل التعادل».</div>
    </div>
  );
}
