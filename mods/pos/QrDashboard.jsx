/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Star, TrendingUp, AlertTriangle, Clock, BarChart3, Sparkles, RefreshCw, Wand2, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { Kpi, QR_ITEMS, qrAnalyzeComments, qrAvg, qrBranchStats, qrDate, qrF1, qrIsComplaint, qrMs, qrOverall, qrOverdue, qrSentBadge, qrStatusOf } from '../../App.jsx';

export function QrDashboard({ fb, scopeFb, brs, sel, nb, upd, ro, say, loading }) {
  const [aiBusy, setAiBusy] = useState(false);
  const wk = 7 * 864e5;

  const rows = useMemo(() => qrBranchStats(fb, brs), [fb, brs]);

  // مركز الذكاء: نفس منطق التوصيات اليومية في المواصفات، يُحسب لحظيًا من بيانات الأسبوعين الأخيرين
  const insights = useMemo(() => {
    const out = []; const now = Date.now();
    (sel === 'all' ? brs : brs.filter(b => b.id === sel)).forEach(b => {
      const all = fb.filter(f => f.branchId === b.id);
      const cur = all.filter(f => now - qrMs(f.createdAt) <= wk);
      const prev = all.filter(f => { const a = now - qrMs(f.createdAt); return a > wk && a <= 2 * wk; });
      const ca = qrAvg(cur.map(qrOverall)), pa = qrAvg(prev.map(qrOverall));
      const trend = cur.length && prev.length && pa ? ((ca - pa) / pa) * 100 : 0;
      const issues = {};
      cur.forEach(f => { const i = f.ai && f.ai.issue; if (i && i !== '—') issues[i] = (issues[i] || 0) + 1; });
      const [top, topN] = Object.entries(issues).sort((x, y) => y[1] - x[1])[0] || [null, 0];
      const rec = ((cur.find(f => f.ai && f.ai.issue === top) || {}).ai || {}).recommendation || 'مراجعة ميدانية للفرع';
      if (trend <= -5) out.push({ sev: 4, title: 'انخفض تقييم ' + b.name + ' بنسبة ' + Math.abs(trend).toFixed(0) + '% خلال آخر أسبوع', cause: top ? 'زيادة شكاوى «' + top + '» (' + topN + ')' : 'لا توجد تعليقات محلَّلة كافية لتحديد السبب', action: rec });
      else if (trend >= 5) out.push({ sev: 1, title: 'ارتفع تقييم ' + b.name + ' بنسبة ' + trend.toFixed(0) + '%', cause: 'تحسّن في التقييمات الأسبوعية', action: 'وثّق ما تغيّر وانقله لبقية الفروع' });
      if (top && topN >= 3) out.push({ sev: 3, title: b.name + ': تكرار شكاوى «' + top + '»', cause: topN + ' تعليقات هذا الأسبوع تشير للمشكلة نفسها', action: rec });
      if (cur.length >= 3 && ca < 3.5) out.push({ sev: 5, title: b.name + ' تحت الحد الآمن (' + ca.toFixed(1) + ' هذا الأسبوع)', cause: 'متوسط أسبوعي منخفض', action: 'زيارة ميدانية ومراجعة الفريق' });
      const od = all.filter(f => qrIsComplaint(f) && qrOverdue(f)).length;
      if (od) out.push({ sev: 4, title: b.name + ': ' + od + ' شكوى تجاوزت مهلة 24 ساعة', cause: 'شكاوى مفتوحة دون حل', action: 'عالجها من تبويب «الشكاوى»' });
    });
    return out.sort((a, b) => b.sev - a.sev);
  }, [fb, brs, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const overall = qrAvg(scopeFb.map(qrOverall));
  const complaints = scopeFb.filter(qrIsComplaint);
  const openC = complaints.filter(f => qrStatusOf(f) !== 'resolved');
  const overdueC = openC.filter(qrOverdue);
  const happy = scopeFb.length ? Math.round(scopeFb.filter(f => qrOverall(f) >= 4).length / scopeFb.length * 100) : 0;
  const issues = Object.entries(scopeFb.reduce((m, f) => { const i = f.ai && f.ai.issue; if (i && i !== '—') m[i] = (m[i] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]);
  const itemAvg = QR_ITEMS.map(i => ({ name: i.label, value: Number(qrAvg(scopeFb.map(f => Number(f.ratings && f.ratings[i.key]) || 0).filter(Boolean)).toFixed(2)) })).sort((x, y) => x.value - y.value);
  const pendingAi = scopeFb.filter(f => String(f.comment || '').trim().length >= 3 && !f.ai);

  const analyze = async () => {
    const batch = pendingAi.slice(0, 20);
    if (!batch.length) return;
    setAiBusy(true);
    try {
      const res = await qrAnalyzeComments(batch);
      let n = 0;
      for (const f of batch) { if (res[f.id] && await upd(f, () => ({ ai: res[f.id] }), null)) n++; }
      say(n ? 'حُلِّل ' + n + ' تعليقًا ✓' : 'لم تُرجع أداة التحليل نتائج صالحة', n ? 'ok' : 'no');
    } catch (e) {
      say(e && e.message === 'no-endpoint'
        ? 'تحليل التعليقات غير مفعّل: أضف VITE_AI_ENDPOINT (رابط /api/ai/analyze على خادم المنصة) أو VITE_AI_FEEDBACK_ENDPOINT ثم أعد البناء'
        : 'تعذّر التحليل: ' + ((e && e.message) || 'خطأ غير معروف'), 'no');
    }
    setAiBusy(false);
  };

  if (!loading && !fb.length) {
    return <div className="card"><div className="empty">لا توجد تقييمات في هذه الفترة بعد. فعّل استقبال التقييمات واطبع رمز QR لكل فرع من «رموز QR للفروع».</div></div>;
  }

  return (
    <>
      <div className="grid g4">
        <Kpi label="عدد التقييمات" value={scopeFb.length} sub={'رضا (4 نجوم فأكثر): ' + happy + '%'} icon={Star} color="#D9A441" />
        <Kpi label="متوسط التقييم" value={qrF1(overall) + ' ★'} sub="من 5" icon={TrendingUp} color={overall && overall < 3.5 ? '#D9544D' : '#4FB286'} />
        <Kpi label="شكاوى مفتوحة" value={openC.length} sub={'من ' + complaints.length + ' شكوى (تقييم أقل من 3)'} icon={AlertTriangle} color="#E0A458" />
        <Kpi label="تجاوزت مهلة 24 ساعة" value={overdueC.length} sub="شكاوى بلا حل" icon={Clock} color="#D9544D" />
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><BarChart3 size={15} color="var(--brass)" />مقارنة الفروع</div></div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>الفرع</th><th>المتوسط</th><th>التقييمات</th><th>الاتجاه الأسبوعي</th><th>شكاوى مفتوحة</th></tr></thead>
            <tbody>
              {rows.map(({ b, n, a, trend, open }) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 700 }}>{b.name}</td>
                  <td><span className="num" style={{ color: a && a < 3.5 ? 'var(--rose)' : 'var(--mint)', fontWeight: 700 }}>{n ? qrF1(a) + ' ★' : '—'}</span></td>
                  <td><span className="num">{n}</span></td>
                  <td><span className="num" style={{ color: trend < 0 ? 'var(--rose)' : trend > 0 ? 'var(--mint)' : 'var(--dim)' }}>{trend ? (trend > 0 ? '▲ ' : '▼ ') + Math.abs(trend).toFixed(0) + '%' : '—'}</span></td>
                  <td>{open ? <span className="badge b-rose">{open}</span> : <span className="badge b-dim">0</span>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5}><div className="empty">لا توجد فروع ضمن صلاحيتك.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><Sparkles size={15} color="var(--brass)" />مركز الذكاء</div>
          <button className="btn sm" disabled={ro || aiBusy || !pendingAi.length} onClick={analyze}>
            {aiBusy ? <RefreshCw size={13} className="spin" /> : <Wand2 size={13} />}تحليل التعليقات ({Math.min(20, pendingAi.length)}{pendingAi.length > 20 ? ' من ' + pendingAi.length : ''})
          </button>
        </div>
        {!insights.length && <div className="empty">لا توجد تنبيهات. تظهر التوصيات عند توفر بيانات أسبوعين أو تكرار مشكلة أو شكاوى متأخرة.</div>}
        <div className="grid" style={{ gap: 10 }}>
          {insights.map((i, k) => (
            <div key={k} style={{ borderInlineStart: '4px solid ' + (i.sev >= 4 ? 'var(--rose)' : i.sev >= 3 ? 'var(--amber)' : 'var(--mint)'), paddingInlineStart: 10, fontSize: 12.5 }}>
              <div style={{ fontWeight: 800 }}>{i.title}</div>
              <div style={{ color: 'var(--dim)' }}>السبب: {i.cause}</div>
              <div>الإجراء المقترح: <b>{i.action}</b></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><AlertTriangle size={15} color="var(--brass)" />أكثر المشاكل</div>
          {!issues.length ? <div className="empty">لا مشاكل مصنّفة بعد — شغّل «تحليل التعليقات».</div> : issues.map(([n, c]) => (
            <div key={n} style={{ marginBottom: 9, fontSize: 12.5 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>{n}</span><b className="num">{c}</b></div>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--ink3)', marginTop: 4 }}>
                <div style={{ height: 6, borderRadius: 4, background: 'var(--rose)', width: (c / issues[0][1]) * 100 + '%' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><Star size={15} color="var(--brass)" />متوسط العناصر</div>
          {!scopeFb.length ? <div className="empty">لا تقييمات للفرع المحدد.</div> : (
            <div style={{ height: 300, direction: 'ltr' }}>
              <ResponsiveContainer>
                <BarChart data={itemAvg} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 5]} hide reversed />
                  <YAxis type="category" dataKey="name" width={100} orientation="right" tick={{ fontSize: 11, fill: 'var(--dim)' }} />
                  <Tooltip formatter={(v) => [v, 'المتوسط']} />
                  <Bar dataKey="value" fill="#C8A24A" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />آخر التعليقات</div>
        {!scopeFb.some(f => f.comment) && <div className="empty">لا تعليقات مكتوبة بعد.</div>}
        {scopeFb.filter(f => f.comment).slice(0, 10).map(f => (
          <div key={f.id} style={{ borderTop: '1px solid var(--line)', padding: '9px 0', fontSize: 12.5 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span>«{f.comment}»</span>
              {f.ai && <span className={'badge ' + qrSentBadge(f.ai.sentiment)}>{f.ai.sentiment}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>
              {nb(f.branchId)} · {qrF1(qrOverall(f))} ★ · {qrDate(f.createdAt)}
              {f.ai && f.ai.issue !== '—' ? ' · ' + f.ai.issue + ' · أهمية ' + f.ai.severity + '/5' : ''}
            </div>
            {f.ai && f.ai.recommendation && f.ai.recommendation !== '—' && <div style={{ fontSize: 11.5, marginTop: 2 }}>توصية: {f.ai.recommendation}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
