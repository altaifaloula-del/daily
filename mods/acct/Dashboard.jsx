/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Building2, Users, UserCog, ClipboardCheck, Check, FileText, CircleDollarSign, Receipt, TrendingUp, AlertTriangle, Landmark, ArrowLeftRight, Store, Banknote, Radio } from 'lucide-react';
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, BarChart, Bar } from 'recharts';
import { AppsStrip, DailyBranchReport, Kpi, arTime, businessDay, chartTone, countedClosing, isoD, money, short, sum } from '../../App.jsx';

export function Dashboard({ org, ops, pulse, me, myBranches, scoped, online, setTab, theme, openAcctView, openInvView }) {
  const [days, setDays] = useState(14);
  const [dayReport, setDayReport] = useState(false);
  const tn = chartTone(theme);

  // منصة جديدة بلا فروع بعد → دليل البدء
  if ((org.branches || []).length === 0) {
    const steps = [
      { n: 1, t: 'أضف فروعك', d: 'سجّل كل فرع باسمه ومدينته والعهدة الافتتاحية.', to: 'admin', ic: Building2, done: false },
      { n: 2, t: 'أنشئ حسابات المستخدمين', d: 'مدير لكل فرع، ومحاسب للإدارة المالية — بريد وكلمة سر لكل منهم.', to: 'admin', ic: Users, done: false },
      { n: 3, t: 'أضف الموظفين', d: 'لتفعيل كشوف الرواتب والسلف.', to: 'admin', ic: UserCog, done: (org.employees || []).length > 0 },
      { n: 4, t: 'سجّل أول إغلاق يومي', d: 'ابدأ التشغيل الفعلي بإغلاق وردية.', to: 'closing', ic: ClipboardCheck, done: false }
    ];
    return (
      <div className="grid" style={{ gap: 14 }}>
        <div className="card" style={{ borderColor: 'rgba(200,162,74,.3)' }}>
          <h2 style={{ fontSize: 18, marginBottom: 6 }}>مرحباً {me.name.split(' ')[0]} — لنبدأ التهيئة</h2>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.9 }}>
            هذه منصة حية جديدة بلا بيانات تجريبية. أكمل الخطوات التالية لتشغيلها. كل ما تدخله يُحفظ سحابياً ويظهر لبقية المستخدمين فوراً.
          </div>
        </div>
        <div className="grid g2">
          {steps.map(st => (
            <div key={st.n} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div className="brand-mark" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: st.done ? 'linear-gradient(145deg,#4FB286,#2E8B62)' : 'linear-gradient(145deg,var(--brass),var(--brass-d))' }}>
                {st.done ? <Check size={18} /> : <st.ic size={17} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>الخطوة {st.n}: {st.t}</div>
                  {st.done && <span className="badge b-mint">تم</span>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', margin: '5px 0 10px', lineHeight: 1.7 }}>{st.d}</div>
                <button className="btn sm pri" onClick={() => setTab(st.to)}>ابدأ</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cls = scoped.closings.filter(countedClosing);
  const from = new Date(); from.setDate(from.getDate() - days);
  const fromS = isoD(from);
  const win = cls.filter(c => c.date >= fromS);

  const rev = sum(win, c => c.totalRevenue);
  const exp = sum(win, c => c.totalExpenses);
  const net = rev - exp;
  const margin = rev ? (net / rev) * 100 : 0;
  const varSum = sum(win, c => c.variance);
  const deficits = win.filter(c => c.variance < 0);

  const series = useMemo(() => {
    const map = {};
    win.forEach(c => {
      if (!map[c.date]) map[c.date] = { d: c.date, rev: 0, exp: 0, cash: 0 };
      map[c.date].rev += c.totalRevenue; map[c.date].exp += c.totalExpenses; map[c.date].cash += c.cashSales;
    });
    return Object.values(map).sort((a, b) => a.d.localeCompare(b.d))
      .map(x => ({ ...x, lbl: x.d.slice(5).replace('-', '/'), net: x.rev - x.exp }));
  }, [win]);

  const perBranch = useMemo(() => myBranches.map(b => {
    const bc = win.filter(c => c.branchId === b.id);
    const r = sum(bc, c => c.totalRevenue), e = sum(bc, c => c.totalExpenses);
    return { name: b.name.replace('الفرع ', '').replace('فرع ', ''), rev: r, exp: e, net: r - e, id: b.id, n: bc.length };
  }).sort((a, b) => b.net - a.net), [win, myBranches]);

  const channels = useMemo(() => [
    { k: 'نقدي', v: sum(win, c => c.cashSales), c: '#4FB286' },
    { k: 'شبكة', v: sum(win, c => c.cardSales), c: '#5B93C4' },
    { k: 'تطبيقات', v: sum(win, c => c.totalDeliverySales), c: '#C8A24A' },
    { k: 'تحويل بنكي', v: sum(win, c => c.bankTransferSales || 0), c: '#9B7BB8' }
  ], [win]);
  const chTotal = sum(channels, c => c.v) || 1;

  const pendingT = scoped.transfers.filter(t => t.status === 'pending');
  const missing = myBranches.filter(b => !cls.some(c => c.date === businessDay() && c.branchId === b.id));
  const audit = (pulse.audit || []).slice(0, 8);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <AppsStrip me={me} setTab={setTab} openAcctView={openAcctView} openInvView={openInvView} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 17 }}>مرحباً {me.name.split(' ')[0]} 👋</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            {myBranches.length} فرع ضمن نطاق صلاحيتك · آخر {days} يوماً
          </div>
        </div>
        <div className="row">
          <button className="btn sm pri" onClick={() => setDayReport(true)}>
            <FileText size={14} />تقارير الفروع اليومية
          </button>
          {[7, 14, 30].map(d => (
            <button key={d} className={'btn sm' + (days === d ? ' pri' : ' gh')} onClick={() => setDays(d)}>
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      {dayReport && <DailyBranchReport org={org} scoped={scoped} myBranches={myBranches} onClose={() => setDayReport(false)} />}

      <div className="grid g4">
        <Kpi label="إجمالي الإيرادات" value={money(rev)} sub={`${win.length} إغلاق مسجل`} icon={CircleDollarSign} color="#C8A24A" />
        <Kpi label="إجمالي المصروفات" value={money(exp)} sub={`${rev ? ((exp / rev) * 100).toFixed(1) : 0}% من الإيراد`} icon={Receipt} color="#D9544D" />
        <Kpi label="صافي الربح" value={money(net)} sub={`هامش ${margin.toFixed(1)}%`} icon={TrendingUp} color="#4FB286" />
        <Kpi label="فروقات الصندوق" value={money(varSum)} sub={`${deficits.length} حالة عجز`} icon={AlertTriangle} color={varSum < 0 ? '#D9544D' : '#5B93C4'} />
      </div>

      {(missing.length > 0 || pendingT.length > 0) && (
        <div className="grid g2">
          {missing.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(224,164,88,.35)' }}>
              <div className="card-t" style={{ color: 'var(--amber)' }}><AlertTriangle size={15} />إغلاقات اليوم لم تُسجّل بعد</div>
              {missing.map(b => (
                <div key={b.id} className="mono-b" style={{ marginBottom: 7 }}>
                  <div><div style={{ fontSize: 12.5 }}>{b.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>نهاية الوردية {b.shiftEndTime}</div></div>
                  <button className="btn sm pri" onClick={() => setTab('closing')}>تسجيل الآن</button>
                </div>
              ))}
            </div>
          )}
          {pendingT.length > 0 && (
            <div className="card">
              <div className="card-t"><Landmark size={15} color="var(--brass)" />تحويلات بانتظار الاستلام</div>
              <div className="kpi-v num" style={{ color: 'var(--brass)' }}>{money(sum(pendingT, t => t.amount))}</div>
              <div className="kpi-s">{pendingT.length} سند تحويل من {new Set(pendingT.map(t => t.branchId)).size} فرع</div>
              <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setTab('treasury')}>
                <ArrowLeftRight size={13} />فتح الخزينة
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <div className="card-t"><TrendingUp size={15} color="var(--brass)" />حركة الإيرادات والمصروفات</div>
          <span className="badge b-dim">ريال سعودي</span>
        </div>
        <div style={{ height: 260, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C8A24A" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#C8A24A" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D9544D" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D9544D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="lbl" tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }}
                labelStyle={{ color: '#A2968A' }} formatter={(v, n) => [money(v), n === 'rev' ? 'الإيراد' : n === 'exp' ? 'المصروف' : 'الصافي']} />
              <Area type="monotone" dataKey="rev" stroke={tn.accent} strokeWidth={2} fill="url(#gr)" />
              <Area type="monotone" dataKey="exp" stroke={tn.neg} strokeWidth={1.6} fill="url(#ge)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-t" style={{ marginBottom: 14 }}><Store size={15} color="var(--brass)" />أداء الفروع</div>
          <div style={{ height: 210, direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perBranch} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={tn.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tn.tick, fontSize: 9.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }}
                  contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }}
                  formatter={(v, n) => [money(v), n === 'rev' ? 'الإيراد' : 'الصافي']} />
                <Bar dataKey="rev" fill={tn.bar} radius={[5, 5, 0, 0]} />
                <Bar dataKey="net" fill={tn.accent} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-t" style={{ marginBottom: 14 }}><Banknote size={15} color="var(--brass)" />توزيع قنوات التحصيل</div>
          {channels.map((c, i) => (
            <div key={i} style={{ marginBottom: 13 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span>{c.k}</span>
                <span className="num" style={{ color: c.c }}>{money(c.v)} · {((c.v / chTotal) * 100).toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--ink)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ width: ((c.v / chTotal) * 100) + '%', height: '100%', background: c.c, borderRadius: 6, transition: '.5s' }} />
              </div>
            </div>
          ))}
          <hr className="hr" />
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--dim)' }}>عمولات تطبيقات التوصيل المقدّرة</span>
            <span className="num" style={{ color: 'var(--rose)' }}>
              {money(sum(win, c => sum(c.deliverySales || [], d => d.commissionAmount || 0)))}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="card-t"><Radio size={15} color="var(--mint)" />النشاط اللحظي على المنصة</div>
          <span className="badge b-mint"><span className="dot" />{online.map(o => o.name.split(' ')[0]).join('، ') || 'أنت فقط'}</span>
        </div>
        {audit.length === 0 && <div className="empty">لا يوجد نشاط بعد — أي إجراء تقوم به سيظهر هنا لدى بقية المستخدمين.</div>}
        {audit.map(a => (
          <div key={a.id} className="feed">
            <div className="feed-d" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div><b style={{ fontWeight: 600 }}>{a.userName}</b> <span style={{ color: 'var(--dim)' }}>{a.title}</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{a.details} · {arTime(a.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
