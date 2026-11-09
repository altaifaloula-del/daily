/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Sparkles, ChevronLeft, RefreshCw, FileText, TrendingDown, AlertTriangle, Store } from 'lucide-react';
import { aiHeaders, buildAccounting, buildPartners, countedClosing, customerAging, isoD, money, stockByWh, sum, supplierAging, today } from '../../App.jsx';

export function AiCenter({ org, ops, me, myBranches, scoped, say, setTab }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(14);

  const digest = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate() - days);
    const fs = isoD(from);
    const win = scoped.closings.filter(c => countedClosing(c) && c.date >= fs);
    const perBranch = myBranches.map(b => {
      const bc = win.filter(c => c.branchId === b.id);
      const rev = sum(bc, c => c.totalRevenue), exp = sum(bc, c => c.totalExpenses);
      return {
        الفرع: b.name, عدد_الإغلاقات: bc.length, الإيراد: Math.round(rev), المصروف: Math.round(exp),
        الصافي: Math.round(rev - exp), نقدي: Math.round(sum(bc, c => c.cashSales)),
        شبكة: Math.round(sum(bc, c => c.cardSales)), تطبيقات: Math.round(sum(bc, c => c.totalDeliverySales)),
        عمولات_التطبيقات: Math.round(sum(bc, c => sum(c.deliverySales || [], d => d.commissionAmount || 0))),
        فروقات_الصندوق: Math.round(sum(bc, c => c.variance)),
        أعلى_بنود_المصروف: Object.entries(bc.flatMap(c => c.expenses || [])
          .reduce((m, e) => ({ ...m, [e.categoryName]: (m[e.categoryName] || 0) + e.amount }), {}))
          .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k}: ${Math.round(v)}`)
      };
    });
    return {
      الفترة: `آخر ${days} يوماً`, العملة: 'ريال سعودي',
      الالتزامات_المتأخرة: (ops.invoices || []).filter(i => (i.amount - (i.paidAmount || 0)) > 0 && i.dueDate < today()).length,
      السلف_غير_المبررة: (ops.advances || []).filter(a => a.isUnjustified).length,
      الفروع: perBranch
    };
  }, [scoped, myBranches, days, ops]);

  // v12.7 — محرّك رؤى وتوصيات فوري (بلا اتصال ولا مفتاح): يقرأ كل الوحدات ويرتّب التوصيات بالأولوية
  const insights = useMemo(() => {
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const A = buildAccounting(org, ops);
    const accByCode = {}; A.accounts.forEach(a => { accByCode[a.code] = a; });
    const counted = scoped.closings.filter(countedClosing);
    const out = [];
    const P = (sev, cat, title, detail, rec, go) => out.push({ sev, cat, title, detail, rec, go });
    const ym = today().slice(0, 7);
    const pd = new Date(ym + '-01'); pd.setMonth(pd.getMonth() - 1); const lastYm = pd.toISOString().slice(0, 7);
    const monRev = (m) => r2(sum(counted.filter(c => (c.date || '').slice(0, 7) === m), c => c.totalRevenue || 0));
    const monExp = (m) => r2(sum(counted.filter(c => (c.date || '').slice(0, 7) === m), c => c.totalExpenses || 0));
    const revT = monRev(ym), revL = monRev(lastYm), netT = r2(revT - monExp(ym));
    const cash = r2(sum(A.accounts.filter(a => a.cash), a => a.balance));
    const monthlyExp = Math.max(monExp(ym), monExp(lastYm));

    if (revL > 0.004) {
      const g = r2((revT - revL) / revL * 100);
      if (g <= -5) P('high', 'نمو', 'تراجع الإيراد هذا الشهر', 'إيراد ' + ym + ' (' + money(revT) + ') أقل بـ ' + Math.abs(g) + '% عن الشهر السابق (' + money(revL) + ').', 'راجع المبيعات حسب القناة والفرع، وأطلق عروضًا للأصناف عالية الهامش.', () => setTab('growth'));
      else if (g >= 10) P('good', 'نمو', 'نموّ إيراد جيّد (+' + g + '%)', 'إيراد ' + ym + ' أعلى من الشهر السابق.', 'حافظ على ما ينجح، وراقب أن يواكب الهامش النمو.', () => setTab('growth'));
    }
    if (revT > 0.004) {
      const margin = r2(netT / revT * 100);
      if (netT < 0) P('high', 'ربحية', 'خسارة تشغيلية هذا الشهر', 'صافي ' + ym + ' = ' + money(netT) + '.', 'راجع أكبر بنود المصروف وتحليل التعادل — غالبًا أنت تحت نقطة التعادل.', () => setTab('breakeven'));
      else if (margin < 10) P('mid', 'ربحية', 'هامش ربح منخفض (' + margin + '%)', 'صافي الشهر ' + money(netT) + ' من إيراد ' + money(revT) + '.', 'خفّض التكاليف المتغيّرة أو ارفع أسعار الأصناف ضعيفة الهامش.', () => setTab('breakeven'));
    }
    if (monthlyExp > 0.004) {
      const runway = Math.round(cash / (monthlyExp / 30));
      if (runway < 15) P('high', 'سيولة', 'النقد يكفي أيامًا قليلة', 'رصيدك النقدي (' + money(cash) + ') يغطّي ~' + runway + ' يومًا من المصروفات.', 'سرّع تحصيل الذمم المدينة وأجّل غير الضروري من الصرف.', () => setTab('acct'));
      else if (runway < 30) P('mid', 'سيولة', 'سيولة محدودة (~' + runway + ' يومًا)', 'النقد الحالي ' + money(cash) + '.', 'راقب التدفق النقدي وخطّط تحصيلاتك مبكرًا.', () => setTab('acct'));
    }
    const custs = buildPartners(org, ops).filter(p => p.type === 'customer');
    const arOver = r2(sum(custs, p => { const a = customerAging(p, today()); return a.b30 + a.b60 + a.b90; }));
    if (arOver > 0.004) P('mid', 'عملاء', 'ذمم مدينة متأخرة', 'لديك ' + money(arOver) + ' متأخرة على العملاء.', 'حصّل الأقدم أولًا لتحسين نقدك.', () => setTab('acct'));
    const sups = buildPartners(org, ops).filter(p => p.type === 'supplier');
    const apOver = r2(sum(sups, p => { const a = supplierAging(p, today()); return a.b60 + a.b90; }));
    if (apOver > 0.004) P('mid', 'موردون', 'ذمم موردين متأخرة', money(apOver) + ' متأخرة عليك لموردين.', 'سدّد أو فاوض جدولة لتجنّب توقف التوريد.', () => setTab('acct'));
    const totRev = r2(sum(A.accounts.filter(a => a.kind === 'rev'), a => a.balance));
    const totLabor = r2((accByCode['5201'] ? accByCode['5201'].balance : 0) + (accByCode['5202'] ? accByCode['5202'].balance : 0));
    if (totRev > 0.004 && totLabor > 0.004) { const lp = r2(totLabor / totRev * 100); if (lp > 30) P('mid', 'تكلفة', 'تكلفة العمالة مرتفعة (' + lp + '%)', 'الرواتب والتأمينات كنسبة من الإيراد.', 'راجع الجدولة وساعات الذروة؛ المستهدف ≤ 30%.', () => setTab('breakeven')); }
    const perBr = myBranches.map(b => { const bc = counted.filter(c => c.branchId === b.id && (c.date || '').slice(0, 7) === ym); return { name: b.name, net: r2(sum(bc, c => (c.totalRevenue || 0) - (c.totalExpenses || 0))), n: bc.length }; }).filter(x => x.n > 0);
    if (perBr.length >= 2) { perBr.sort((a, b) => b.net - a.net); const top = perBr[0], bot = perBr[perBr.length - 1]; if (top.net - bot.net > 0.004) P('low', 'فروع', 'تفاوت أداء الفروع', 'الأفضل هذا الشهر: ' + top.name + ' (' + money(top.net) + ') · الأضعف: ' + bot.name + ' (' + money(bot.net) + ').', 'انقل ممارسات الفرع الأفضل إلى الأضعف.', () => setTab('compare')); }
    const defs = counted.filter(c => (c.variance || 0) < -0.004 && (c.date || '').slice(0, 7) === ym);
    if (defs.length) P('mid', 'رقابة', defs.length + ' إغلاق فيه عجز صندوق هذا الشهر', 'إجمالي العجز ' + money(r2(sum(defs, c => c.variance))) + '.', 'دقّق تسليمات الكاشير وراجع الفروقات المتكررة.', () => setTab('compare'));
    const stockBal = stockByWh(org, ops).total;   // v29.9: كل المستودعات
    const low = (org.items || []).filter(it => (Number(it.minQty) || 0) > 0 && (stockBal[it.id] || 0) < (Number(it.minQty) || 0));
    if (low.length) P('low', 'مخزون', low.length + ' صنف تحت حد الطلب', 'أصناف قاربت النفاد.', 'أنشئ أمر شراء لتفادي التوقف.', () => setTab('inv'));

    const order = { high: 0, mid: 1, low: 2, good: 3 };
    out.sort((a, b) => order[a.sev] - order[b.sev]);
    const counts = { high: out.filter(x => x.sev === 'high').length, mid: out.filter(x => x.sev === 'mid').length };
    return { list: out, counts, cash, revT, netT, hasData: counted.length > 0 };
  }, [org, ops, scoped, myBranches]);

  const analyze = async () => {
    setBusy(true); setErr(''); setRes(null);
    const endpoint = import.meta.env && import.meta.env.VITE_AI_ENDPOINT;
    try {
      let result;
      if (endpoint) {
        // وسيط خادم آمن: مفتاح Anthropic يبقى على الخادم، والخادم يتحقق من رمز الجلسة وعضوية المستخدم
        const r = await fetch(endpoint, {
          method: 'POST', headers: await aiHeaders(),
          body: JSON.stringify({ digest })
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) throw new Error(data.error || ('HTTP ' + r.status));
        result = data.result;
      } else {
        throw new Error('no-endpoint');
      }
      setRes(result);
      say('اكتمل التحليل المالي الذكي');
    } catch (e) {
      if (e.message === 'no-endpoint') {
        setErr('المركز المالي الذكي غير مفعّل. لتفعيله: شغّل خادم المنصة (server.js) بمفتاح ANTHROPIC_API_KEY، ثم أضف سرّ VITE_AI_ENDPOINT (رابط /api/ai/analyze على الخادم) في إعدادات المستودع وأعد النشر. بقية وحدات المنصة تعمل كاملة.');
      } else {
        setErr('تعذّر إتمام التحليل: ' + (e.message || 'خطأ غير معروف'));
      }
    }
    setBusy(false);
  };

  const grade = (s) => s === 'ممتاز' ? 'b-mint' : s === 'جيد جداً' ? 'b-sky' : s === 'متوسط' ? 'b-amber' : 'b-rose';

  const sevColor = (s) => s === 'high' ? '#D9544D' : s === 'mid' ? '#E0A458' : s === 'good' ? '#4FB286' : '#5B93C4';
  const sevLabel = (s) => s === 'high' ? 'عاجل' : s === 'mid' ? 'للمتابعة' : s === 'good' ? 'إيجابي' : 'ملاحظة';

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card" style={{ borderColor: 'rgba(79,178,134,.28)' }}>
        <div className="card-h">
          <div className="card-t"><Sparkles size={16} color="var(--brass)" />رؤى وتوصيات فورية</div>
          <div className="row" style={{ gap: 6 }}>
            {insights.counts.high > 0 && <span className="badge b-rose">{insights.counts.high} عاجلة</span>}
            {insights.counts.mid > 0 && <span className="badge b-amber">{insights.counts.mid} للمتابعة</span>}
          </div>
        </div>
        {!insights.hasData ? <div className="empty">تظهر الرؤى والتوصيات فور اعتماد أول إغلاق يومي.</div> : <>
          <div className="grid g3" style={{ gap: 8, marginBottom: 12 }}>
            {[['النقد الحالي', money(insights.cash)], ['إيراد الشهر', money(insights.revT)], ['صافي الشهر', money(insights.netT)]].map((s, i) => (
              <div key={i} style={{ background: 'var(--acc-soft)', border: '1px solid var(--frame-o)', borderRadius: 10, padding: '8px 10px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{s[0]}</div>
                <div className="num" style={{ fontSize: 15, fontWeight: 800 }}>{s[1]}</div>
              </div>
            ))}
          </div>
          {insights.list.length === 0 ? <div className="note">✅ لا ملاحظات جوهرية حاليًا — مؤشراتك ضمن الطبيعي. واصل المتابعة.</div> :
            insights.list.map((it, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < insights.list.length - 1 ? '1px solid var(--frame-o)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: sevColor(it.sev), marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13 }}>{it.title}</b>
                    <span className="badge" style={{ background: 'transparent', border: '1px solid ' + sevColor(it.sev), color: sevColor(it.sev) }}>{sevLabel(it.sev)} · {it.cat}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', margin: '4px 0', lineHeight: 1.8 }}>{it.detail}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>💡 <b>التوصية:</b> {it.rec}</div>
                  {it.go && <button className="btn sm gh" style={{ marginTop: 6 }} onClick={it.go}>افتح الشاشة<ChevronLeft size={13} /></button>}
                </div>
              </div>
            ))}
          <div className="note" style={{ marginTop: 10 }}>رؤى فورية تُحتسب من بياناتك مباشرةً (بلا اتصال) وتُرتّب بالأولوية. للتحليل السردي المعمّق فعّل الذكاء الاصطناعي أدناه (اختياري).</div>
        </>}
      </div>

      <div className="card" style={{ borderColor: 'rgba(200,162,74,.3)' }}>
        <div className="card-h">
          <div>
            <div className="card-t"><Sparkles size={16} color="var(--brass)" />تحليل معمّق بالذكاء الاصطناعي (اختياري)</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 5 }}>
              تحليل سرديّ لإغلاقات {myBranches.length} فرع وتقييم أداء كل فرع — يتطلب تفعيل مفتاح. الرؤى الفورية أعلاه تعمل دائمًا بلا تفعيل.
            </div>
          </div>
          <div className="row">
            {[7, 14, 30].map(d => (
              <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>{d} يوم</button>
            ))}
          </div>
        </div>
        <button className="btn pri" onClick={analyze} disabled={busy}>
          {busy ? <><RefreshCw size={15} className="spin" />جارٍ التحليل…</> : <><Sparkles size={15} />تشغيل التحليل المالي</>}
        </button>
        {err && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 12 }}>{err}</div>}
      </div>

      {!res && !busy && (
        <div className="card"><div className="empty">
          لم يُشغَّل التحليل بعد. اضغط «تشغيل التحليل المالي» للحصول على قراءة مالية لفترة {days} يوماً.
        </div></div>
      )}

      {res && (
        <>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><FileText size={15} color="var(--brass)" />الملخص التنفيذي</div>
            <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--txt)' }}>{res.الملخص_التنفيذي}</div>
            <hr className="hr" />
            <div className="lbl">اتجاهات المبيعات والمصروفات</div>
            <div style={{ fontSize: 12.5, lineHeight: 2, color: 'var(--dim)' }}>{res.اتجاهات_المبيعات_والمصروفات}</div>
          </div>

          <div className="grid g2">
            <div className="card">
              <div className="card-t" style={{ marginBottom: 12 }}><TrendingDown size={15} color="var(--mint)" />توصيات خفض التكلفة</div>
              {(res.توصيات_خفض_التكلفة || []).map((t, i) => (
                <div key={i} className="feed">
                  <div className="feed-d" style={{ background: 'var(--mint)' }} />
                  <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>{t}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-t" style={{ marginBottom: 12 }}><AlertTriangle size={15} color="var(--rose)" />مخاطر النقدية</div>
              {(res.مخاطر_النقدية || []).map((t, i) => (
                <div key={i} className="feed">
                  <div className="feed-d" style={{ background: 'var(--rose)' }} />
                  <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-t" style={{ marginBottom: 12 }}><Store size={15} color="var(--brass)" />تقييم أداء الفروع</div>
            <div className="grid g3">
              {(res.تقييم_الفروع || []).map((b, i) => (
                <div key={i} className="card" style={{ background: 'var(--ink)' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.الفرع}</span>
                    <span className={'badge ' + grade(b.الحالة)}>{b.الحالة}</span>
                  </div>
                  <div className="num" style={{ fontSize: 26, color: 'var(--brass)', margin: '8px 0 4px' }}>
                    {b.الدرجة}<span style={{ fontSize: 12, color: 'var(--faint)' }}>/100</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--ink2)', borderRadius: 5, overflow: 'hidden', marginBottom: 9 }}>
                    <div style={{ width: Math.min(100, b.الدرجة) + '%', height: '100%', background: 'var(--brass)' }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.8 }}>{b.التعليق}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--faint)', textAlign: 'center' }}>
            تحليل استرشادي مبني على بيانات الإغلاقات المسجلة — لا يغني عن مراجعة المحاسب القانوني.
          </div>
        </>
      )}
    </div>
  );
}
