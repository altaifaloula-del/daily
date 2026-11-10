/* v38.9 — التدفق النقدي المتوقع (13 أسبوعًا) مربوطًا بتوقع المبيعات لكل فرع
   المحرك في النواة (cashForecast): أساس نقدي (IAS 7) — كل بند من بيانات المنصّة، وما لا تعرفه البيانات يُعلَن ولا يُفترض.
   الشاشة: مؤشرات، ما يحتاج انتباهك، مسار الرصيد (أساسي ومتحفظ)، الأسابيع بتفاصيلها، أساس الحساب للمراجعة، والإعداد. */
import React, { useMemo, useState } from 'react';
import { Download, Check, Settings, AlertTriangle, CalendarDays, Banknote, TrendingUp, FileText, Info, Plus, Trash2, ShieldCheck, ChevronDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, ReferenceLine } from 'recharts';
import { CF_IN, CF_KIND, CF_OUT, CF_SCHED, Field, Kpi, arDate, buildAccounting, cashForecast, chartTone, makeXlsx, money, rolePost, short, uid } from '../../App.jsx';

const SEV = { bad: ['b-rose', 'عاجل'], warn: ['b-amber', 'تنبيه'], info: ['b-dim', 'معلومة'] };
const EVERY = { once: 'مرة واحدة', monthly: 'شهري', quarterly: 'ربع سنوي', yearly: 'سنوي' };
// بنود الأسبوع مجمّعة حسب الوصف (المبيعات اليومية لفرع = بند واحد بمجموعه وأيامه)
const groupWeek = (items, w) => { const G = new Map();
  items.filter(i => i.date >= w.from && i.date <= w.to).forEach(i => { const k = i.kind + '|' + i.label; const g = G.get(k);
    if (g) { g.amount += i.amount; g.n++; if (i.date > g.to) g.to = i.date; } else G.set(k, { ...i, to: i.date, n: 1 }); });
  return [...G.values()].sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount); };
const draftOf = (c = {}) => ({ vatFreq: c.vatFreq || '', fyEnd: c.fyEnd || '', includeOverdueAR: !!c.includeOverdueAR, appLag: { ...(c.appLag || {}) }, sched: (c.sched || []).map(s => ({ ...s })) });

export function CashFlow13({ org, ops, me, theme, commitOrg, say }) {
  const tn = chartTone(theme);
  const canPost = rolePost(me?.role);
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const [cfg, setCfg] = useState(() => draftOf(org.cashflowCfg));
  const [setOpen, setSetOpen] = useState(false);
  const [wk, setWk] = useState(null);
  const [showBasis, setShowBasis] = useState(false);
  const C = useMemo(() => cashForecast(org, ops, { A, cfg: { ...(org.cashflowCfg || {}), ...cfg } }), [org, ops, A, cfg]);
  const dirty = JSON.stringify(draftOf(org.cashflowCfg)) !== JSON.stringify(cfg);
  const wkLbl = (k) => k < 0 ? 'الآن' : 'الأسبوع ' + (k + 1);
  const tot = (kind) => C.items.filter(i => i.kind === kind).reduce((s, i) => s + i.amount, 0);
  const chart = [{ label: 'الآن', base: C.opening, lo: C.opening }, ...C.weeks.map(w => ({ label: w.from.slice(5), base: w.bal, lo: w.balLo }))];
  const B = C.basis;

  const save = async () => {
    const clean = { ...cfg, sched: cfg.sched.filter(s => (Number(s.amount) || 0) > 0 && s.date).map(s => ({ ...s, amount: Number(s.amount) })),
      appLag: Object.fromEntries(Object.entries(cfg.appLag).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, Number(v)])) };
    const ok = await commitOrg(d => ({ ...d, cashflowCfg: clean }), { actionType: 'update', targetType: 'tax_settings', targetId: 'cashflowCfg', need: 'post', title: 'حفظ إعداد التدفق النقدي', details: (clean.vatFreq ? 'ض.ق.م ' + (clean.vatFreq === 'monthly' ? 'شهرية' : 'ربع سنوية') + ' · ' : '') + clean.sched.length + ' التزام مجدول' });
    if (ok !== false) { setCfg(draftOf(clean)); say('حُفظ الإعداد ✓'); }
  };
  const exportCF = () => {
    try {
      const kinds = [...CF_IN, ...CF_OUT];
      const s1 = [['الأسبوع', 'من', 'إلى', ...kinds.map(k => CF_KIND[k]), 'الداخل', 'الخارج', 'الصافي', 'الرصيد', 'الرصيد (متحفظ)'],
        ['الرصيد الافتتاحي', C.today, '', ...kinds.map(() => ''), '', '', '', C.opening, C.opening],
        ...C.weeks.map(w => [w.k + 1, w.from, w.to, ...kinds.map(k => (CF_IN.includes(k) ? 1 : -1) * (w.by[k] || 0)), w.inflow, -w.outflow, w.net, w.bal, w.balLo])];
      const s2 = [['التاريخ', 'البند', 'الوصف', 'داخل', 'خارج', 'الأساس'], ...C.items.map(i => [i.date, CF_KIND[i.kind], i.label, i.dir === 'in' ? i.amount : '', i.dir === 'out' ? i.amount : '', i.basis || ''])];
      const s3 = [['الأهمية', 'الملاحظة'], ...C.notes.map(n => [SEV[n.sev][1], n.msg])];
      const blob = makeXlsx([{ name: 'التدفق الأسبوعي', rows: s1 }, { name: 'البنود', rows: s2 }, { name: 'الملاحظات', rows: s3 }]);
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'التدفق_النقدي_13أسبوع_' + C.today + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل التدفق (Excel) ✓');
    } catch (e) { say('تعذّر توليد Excel', 'no'); }
  };
  const setS = (i, k, v) => setCfg(c => ({ ...c, sched: c.sched.map((s, j) => j === i ? { ...s, [k]: v } : s) }));
  const bad = C.notes.filter(n => n.sev === 'bad').length;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>التدفق النقدي المتوقع — 13 أسبوعًا</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>من توقع مبيعات كل فرع، والذمم بتواريخ استحقاقها، والرواتب والتأمينات، والضريبة — على أساس نقدي</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={exportCF}><Download size={13} />Excel</button>
          {canPost && <button className={'btn sm' + (setOpen ? ' pri' : '')} onClick={() => setSetOpen(v => !v)}><Settings size={13} />الإعداد</button>}
        </div>
      </div>

      <div className="grid g4">
        <Kpi label="النقد الآن (الدفاتر)" value={money(C.opening)} sub="الخزائن والبنوك والوسطاء" icon={Banknote} color="#C8A24A" />
        <Kpi label="أدنى رصيد متوقع" value={money(C.min.v)} sub={C.min.k < 0 ? 'الرصيد الحالي هو الأدنى' : wkLbl(C.min.k) + ' · ' + arDate(C.weeks[C.min.k].from)} icon={AlertTriangle} color={C.min.v < 0 ? '#D9544D' : '#4FB286'} />
        <Kpi label="أدنى رصيد — حالة متحفظة" value={money(C.minLo.v)} sub={'مبيعات عند الحد الأدنى المتوقع' + (C.gapsLo ? ' · ' + C.gapsLo + ' أسابيع عجز' : '')} icon={ShieldCheck} color={C.minLo.v < 0 ? '#D9544D' : C.minLo.v < C.opening * 0.25 ? '#E0A458' : '#4FB286'} />
        <Kpi label="الرصيد بعد 13 أسبوعًا" value={money(C.weeks[12].bal)} sub={arDate(C.end)} icon={CalendarDays} color={C.weeks[12].bal >= 0 ? '#4FB286' : '#D9544D'} />
      </div>

      {setOpen && canPost && <div className="card">
        <div className="card-h"><div className="card-t"><Settings size={15} color="var(--brass)" />الإعداد — ما لا تعرفه البيانات</div>
          {dirty && <button className="btn sm pri" onClick={save}><Check size={13} />حفظ</button>}</div>
        <div className="grid g3" style={{ gap: 10 }}>
          <Field label="دورية إقرار ضريبة القيمة المضافة"><select className="inp sel" value={cfg.vatFreq} onChange={e => setCfg(c => ({ ...c, vatFreq: e.target.value }))}>
            <option value="">{B.vat && B.vat.on && B.vat.src.startsWith('مستنتجة') ? 'تلقائي — ' + (B.vat.months === 3 ? 'ربع سنوية' : 'شهرية') + ' (من آخر إقرار)' : 'غير محددة'}</option>
            <option value="monthly">شهرية</option><option value="quarterly">ربع سنوية</option></select>
            <div className="cf-hint">كما في شهادة التسجيل الضريبي</div></Field>
          <Field label="نهاية السنة المالية (شهر-يوم)"><input className="inp n" dir="ltr" placeholder={B.fyEnd || '12-31'} value={cfg.fyEnd} onChange={e => setCfg(c => ({ ...c, fyEnd: e.target.value.replace(/[^\d-]/g, '').slice(0, 5) }))} />
            <div className="cf-hint">للتذكير بموعد الزكاة (120 يومًا بعدها)</div></Field>
          <Field label="ذمم العملاء المتأخرة"><label className="row" style={{ gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={cfg.includeOverdueAR} onChange={e => setCfg(c => ({ ...c, includeOverdueAR: e.target.checked }))} />أدرج المتأخر حتى 90 يومًا في الأسبوع الأول</label>
            <div className="cf-hint">الافتراضي: لا تُدرج (مبدأ الحيطة)</div></Field>
        </div>
        {(org.deliveryApps || []).length > 0 && <><div className="lbl" style={{ marginTop: 10 }}>مدة تسوية التطبيقات بالأيام (فارغ = تُستنتج من بياناتك)</div>
          <div className="grid g4" style={{ gap: 8 }}>{(org.deliveryApps || []).map(a => <Field key={a.id} label={a.n}><input className="inp n" inputMode="numeric" placeholder={B.apps[a.id] && B.apps[a.id].lag != null ? String(B.apps[a.id].lag) : '—'} value={cfg.appLag[a.id] != null ? String(cfg.appLag[a.id]) : ''} onChange={e => setCfg(c => ({ ...c, appLag: { ...c.appLag, [a.id]: e.target.value.replace(/\D/g, '').slice(0, 3) } }))} /></Field>)}</div></>}
        <div className="lbl" style={{ marginTop: 12 }}>التزامات مجدولة (زكاة، ضريبة دخل، إيجار، أقساط تمويل…)</div>
        <div className="cf-sched">{cfg.sched.map((s, i) => <div key={s.id} className="cf-srow">
          <select className="inp sel" value={s.kind} onChange={e => setS(i, 'kind', e.target.value)}>{Object.entries(CF_SCHED).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className="inp" placeholder="الوصف" value={s.label || ''} onChange={e => setS(i, 'label', e.target.value)} />
          <input className="inp n" inputMode="decimal" placeholder="المبلغ" value={s.amount} onChange={e => setS(i, 'amount', e.target.value)} />
          <input className="inp" type="date" value={s.date} onChange={e => setS(i, 'date', e.target.value)} />
          <select className="inp sel" value={s.every} onChange={e => setS(i, 'every', e.target.value)}>{Object.entries(EVERY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn sm gh" aria-label="حذف" onClick={() => setCfg(c => ({ ...c, sched: c.sched.filter((_, j) => j !== i) }))}><Trash2 size={13} /></button>
        </div>)}</div>
        <button className="btn sm gh" style={{ marginTop: 6 }} onClick={() => setCfg(c => ({ ...c, sched: [...c.sched, { id: uid('cs'), kind: 'rent', label: '', amount: '', date: C.today, every: 'monthly' }] }))}><Plus size={13} />إضافة التزام</button>
        {dirty && <div className="note" style={{ marginTop: 8 }}>المعاينة أعلاه تعكس التعديلات — اضغط «حفظ» لاعتمادها.</div>}
      </div>}

      {C.notes.length > 0 && <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><AlertTriangle size={15} color={bad ? 'var(--rose)' : 'var(--amber)'} />ما يحتاج انتباهك ({C.notes.length})</div>
        <div className="cf-notes">{C.notes.map((n, i) => <div key={i} className={'cf-note ' + n.sev}><span className={'badge ' + SEV[n.sev][0]}>{SEV[n.sev][1]}</span><span>{n.msg}</span></div>)}</div>
      </div>}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 10 }}><TrendingUp size={15} color="var(--brass)" />مسار الرصيد النقدي — الخط المتقطع: المبيعات عند حدها الأدنى المتوقع</div>
        <div style={{ height: 230, direction: 'ltr' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 6, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={tn.grid} vertical={false} />
              <XAxis dataKey="label" reversed tick={{ fill: tn.tick, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis orientation="right" tick={{ fill: tn.tick, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
              <ReferenceLine y={0} stroke="#D9544D" strokeOpacity={0.6} />
              <Tooltip contentStyle={{ background: tn.tip, border: '1px solid ' + tn.grid, borderRadius: 10, fontSize: 12, direction: 'rtl', color: tn.tipTxt }} formatter={(v, k) => [money(v), k === 'base' ? 'الرصيد المتوقع' : 'الحالة المتحفظة']} />
              <Line type="monotone" dataKey="base" stroke={C.min.v < 0 ? '#D9544D' : '#4FB286'} strokeWidth={2.4} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="lo" stroke="#E0A458" strokeWidth={1.6} strokeDasharray="5 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 6 }}><FileText size={15} color="var(--brass)" />الأسابيع — اضغط الأسبوع لتفاصيله</div>
        <div className="cf-wks">{C.weeks.map(w => (
          <div key={w.k} className={'cf-wk' + (w.bal < -0.004 ? ' gap' : w.balLo < -0.004 ? ' risk' : '')}>
            <button type="button" className="cf-wh" onClick={() => setWk(wk === w.k ? null : w.k)} aria-expanded={wk === w.k}>
              <span className="cf-wd"><b>{wkLbl(w.k)}</b><small className="dt">{arDate(w.from)} – {arDate(w.to)}</small></span>
              <span className="cf-io"><small className="num" style={{ color: 'var(--mint)' }} dir="ltr">+{money(w.inflow)}</small><small className="num" style={{ color: 'var(--rose)' }} dir="ltr">−{money(w.outflow)}</small></span>
              <span className="cf-bal"><b className="num" dir="ltr">{money(w.bal)}</b>{w.bal < -0.004 ? <span className="badge b-rose">عجز</span> : w.balLo < -0.004 ? <span className="badge b-amber">خطر</span> : null}</span>
              <ChevronDown size={14} className="cf-chev" />
            </button>
            {wk === w.k && <div className="cf-wb">
              <div className="cf-kinds">{[...CF_IN, ...CF_OUT].filter(k => w.by[k]).map(k => <span key={k} className={'cf-k ' + (CF_IN.includes(k) ? 'in' : 'out')}>{CF_KIND[k]} <b className="num" dir="ltr">{CF_IN.includes(k) ? '+' : '−'}{money(w.by[k])}</b></span>)}</div>
              <div className="cf-items">{groupWeek(C.items, w).slice(0, 60).map((i, ix) => <div key={ix} className="cf-it">
                <span className="cf-id"><small className="dt">{arDate(i.date)}{i.to !== i.date ? ' – ' + arDate(i.to) : ''}{i.n > 1 ? ' · ' + i.n + ' أيام' : ''}</small><span>{i.label}</span>{i.basis ? <small className="cf-b">{i.basis}</small> : null}</span>
                <b className="num" dir="ltr" style={{ color: i.dir === 'in' ? 'var(--mint)' : 'var(--rose)' }}>{i.dir === 'in' ? '+' : '−'}{money(i.amount)}</b></div>)}</div>
            </div>}
          </div>))}</div>
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><Banknote size={15} color="var(--brass)" />مكوّنات التدفق خلال 13 أسبوعًا</div>
        <div className="cf-comp">
          {CF_IN.map(k => tot(k) > 0 && <div key={k} className="cf-c in"><span>{CF_KIND[k]}</span><b className="num" dir="ltr">+{money(tot(k))}</b></div>)}
          {CF_OUT.map(k => tot(k) > 0 && <div key={k} className="cf-c out"><span>{CF_KIND[k]}</span><b className="num" dir="ltr">−{money(tot(k))}</b></div>)}
        </div>
      </div>

      <div className="card">
        <button type="button" className="cf-wh" style={{ padding: 0 }} onClick={() => setShowBasis(v => !v)} aria-expanded={showBasis}>
          <span className="card-t"><ShieldCheck size={15} color="var(--brass)" />أساس الحساب — للمراجعة والتدقيق</span><ChevronDown size={14} className="cf-chev" /></button>
        {showBasis && <div className="cf-basis">
          <div className="lbl">الفروع (من آخر 8 أسابيع من الإغلاقات المرحّلة)</div>
          {B.branches.length ? B.branches.map(b => <div key={b.id} className="cf-br"><b>{b.name}</b>
            <span>توقع 13 أسبوعًا <b className="num">{money(b.total)}</b>{b.mape != null ? ' · دقة ' + (100 - b.mape).toFixed(0) + '%' : ''}</span>
            <span>نقد وشبكة <b className="num">{b.immPct}%</b>{Object.entries(b.apps).map(([id, p]) => ' · ' + ((B.apps[id] || {}).name || 'تطبيق') + ' ' + p + '%').join('')}</span>
            <span>مصروفات الإغلاق: فورية <b className="num">{b.expImmPct}%</b> · آجلة <b className="num">{b.expDefPct}%</b> من المبيعات</span></div>) : <div className="empty">لا فروع بتوقع بعد.</div>}
          {Object.values(B.apps).some(a => a.bal > 0.004 || a.netPct != null) && <><div className="lbl">تطبيقات التوصيل</div>{Object.entries(B.apps).filter(([, a]) => a.bal > 0.004 || a.netPct != null).map(([id, a]) => <div key={id} className="cf-br"><b>{a.name}</b>
            <span>الصافي بعد العمولة <b className="num">{a.netPct != null ? a.netPct + '%' : '—'}</b> · رصيد الذمة <b className="num">{money(a.bal)}</b> · التسوية <b className="num">{a.lag != null ? a.lag + ' يومًا' : 'غير معروفة'}</b>{a.src ? ' (' + a.src + ')' : ''}</span></div>)}</>}
          <div className="lbl">المشتريات والمصروفات المركزية</div>
          <div className="cf-br"><span>فواتير التوريد: <b className="num">{money(B.invWk)}</b> أسبوعيًا · سداد بعد <b className="num">{B.invLag || 0}</b> يومًا · مصروفات الخزينة: <b className="num">{money(B.cenWk)}</b> أسبوعيًا · مدة الموردين للآجل: <b className="num">{B.defLag != null ? B.defLag + ' يومًا' : 'غير محددة'}</b></span></div>
          <div className="lbl">الرواتب والتأمينات</div>
          <div className="cf-br"><span>{B.payroll.emps} موظف · صافي شهري <b className="num">{money(B.payroll.net)}</b> · تأمينات <b className="num">{money(B.payroll.gosi)}</b>{B.payroll.gosiOn ? '' : ' (غير مفعّلة)'} · موعد الصرف: {B.payroll.paySrc}</span></div>
          <div className="lbl">ضريبة القيمة المضافة والزكاة</div>
          <div className="cf-br">{B.vat.on ? <span>النسبة <b className="num">{Math.round(B.vat.rate * 100)}%</b> · الدورية: <b>{B.vat.months ? (B.vat.months === 3 ? 'ربع سنوية' : 'شهرية') + ' (' + B.vat.src + ')' : 'غير محددة'}</b>
            {B.vat.start ? <> · الفترة المفتوحة من <span className="dt">{arDate(B.vat.start)}</span>{B.vat.end ? <> إلى <span className="dt">{arDate(B.vat.end)}</span> · السداد قبل <span className="dt">{arDate(B.vat.due)}</span></> : null} · المستحق في الدفاتر <b className="num">{money(B.vat.accrued)}</b></> : null}
            · مدخلات الإنفاق <b className="num">{B.vatInRatio}%</b> منه</span> : <span>الضريبة غير مفعّلة في المحاسبة</span>}
            <span>نهاية السنة المالية: <b className="num" dir="ltr">{B.fyEnd || '—'}</b>{B.zakatDue ? <> · موعد الزكاة <span className="dt">{arDate(B.zakatDue)}</span></> : null}</span></div>
        </div>}
      </div>

      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>المنهج:</b> أساس نقدي وفق معيار IAS 7 — ما يدخل الخزائن والبنوك ويخرج منها فعلًا.
        المبيعات شاملة الضريبة كما تُحصَّل، وضريبة القيمة المضافة تخرج كاملة بنهاية الشهر التالي لفترتها (الإقرارات المقفلة من الدفاتر، والجارية = المستحق في الدفاتر + المتوقع).
        التأمينات الاجتماعية خلال أول 15 يومًا من الشهر التالي، والزكاة خلال 120 يومًا من نهاية السنة المالية.
        ذمم العملاء المتأخرة لا تُدرج إلا بقرارك (حيطة — IFRS 9)، وذمم الموردين المتأخرة تُسدَّد في الأسبوع الأول (تحفّظ).
        لا يدخل الإهلاك والمخصصات (ليست نقدًا)، ولا مكافأة نهاية الخدمة (تُصرف عند انتهاء العلاقة)، ولا المناسبات التي لا يعرفها التوقع — أضف ما يلزم كالتزام مجدول.</div>
    </div>
  );
}
