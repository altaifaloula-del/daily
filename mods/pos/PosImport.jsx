/* استيراد مبيعات نقاط البيع من Excel/CSV ومطابقتها مع الإغلاق اليومي
   v33.1 الاستيراد · v39.4: «طريقة الدفع» بدقة، يوم العمل لفواتير ما بعد منتصف الليل، استبعاد الملغاة،
   الأيام الجزئية عند حدود التصدير، ومطابقة كل يوم/فرع مع الإغلاق بالإجمالي وكل طريقة دفع. */
import React, { useMemo, useState } from 'react';
import { Upload, Scale, Check, FileText, Download, Clock, ChevronDown, Plus } from 'lucide-react';
import { APPS, Field, Kpi, importDraftClosing, PAY_GUESS, arDate, makeXlsx, money, nowISO, parseCsvGrid, parseXlsxGrid, periodLocked, piAggregate, piCutoff, piDetect, piNorm, posR2, posRecon, sha256Hex, uid } from '../../App.jsx';

const ST = { match: ['b-mint', 'مطابق'], mix: ['b-amber', 'الإجمالي مطابق وتوزيع الدفع مختلف'], diff: ['b-rose', 'فرق'], noclose: ['b-dim', 'لا إغلاق'] };
const bare = (s) => piNorm(s).replace(/^(فرع|فرغ|فرح|branch)\s*/, '').trim();   // «فرغ النسيم» ← «النسيم»

export function PosImport({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const brs = (myBranches || []).filter(b => b.isActive !== false);
  const apps = org.deliveryApps || APPS;
  const saved = org.posImportMap || {};
  const [st, setSt] = useState(null);   // {name, grid, cfg, brVals, payVals, cut}
  const [res, setRes] = useState(null);
  const [inclPartial, setInclPartial] = useState(false);
  const [open, setOpen] = useState(null);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const grid = /\.xlsx$/i.test(f.name) ? await parseXlsxGrid(await f.arrayBuffer()) : parseCsvGrid(await f.text());
      if (!grid || grid.length < 2) return say('الملف فارغ أو غير مقروء', 'no');
      const d = piDetect(grid);
      if (!d) return say('لم أجد عمود التاريخ وعمود الإجمالي أو طريقة الدفع في أول 15 سطرًا — تأكد من صف العناوين', 'no');
      const brVals = d.map.branch >= 0 ? [...new Set(grid.slice(d.start).map(r => String((r || [])[d.map.branch] || '').trim()).filter(Boolean))] : [];
      const brMap = {}; brVals.forEach(v => { const k = bare(v); const b = brs.find(x => piNorm(x.name) === piNorm(v) || (k && (piNorm(x.name).includes(k) || k.includes(bare(x.name))))); brMap[v] = (saved.br || {})[v] || (b ? b.id : ''); });
      const payVals = d.layout === 'summary' ? d.payCols.map(ci => String(d.headers[ci] || '').trim()) : (d.map.pay >= 0 ? [...new Set(grid.slice(d.start).map(r => String((r || [])[d.map.pay] || '').trim()).filter(Boolean))] : []);
      const payMap = {}; payVals.forEach(v => { payMap[v] = (saved.pay || {})[v] || PAY_GUESS(v, apps); });
      const cut = piCutoff(grid, d);
      const cutoff = saved.cutoff != null && !cut.cutoff ? saved.cutoff : cut.cutoff;
      setRes(null); setSt({ name: f.name, grid, cfg: { ...d, brMap, payMap, cutoff, branchId: (brs[0] || {}).id || '' }, brVals, payVals, cut });
    } catch { say('تعذّرت قراءة الملف — احفظه بصيغة xlsx أو CSV', 'no'); }
  };
  const run = () => { setOpen(null); setDone(null); setRes(piAggregate(st.grid, st.cfg)); };
  const recon = useMemo(() => res ? posRecon(org, ops, res.days) : [], [res, org, ops]);
  const brName = (id) => (brs.find(b => b.id === id) || (org.branches || []).find(b => b.id === id) || {}).name || id;
  const appName = (id) => (apps.find(a => a.id === id) || {}).n || id;
  const full = recon.filter(x => !x.partial);
  const kp = { match: full.filter(x => x.st === 'match').length, mix: full.filter(x => x.st === 'mix').length, diff: full.filter(x => x.st === 'diff').length, noclose: full.filter(x => x.st === 'noclose').length,
    diffSum: posR2(full.filter(x => x.d).reduce((a, x) => a + x.d.total, 0)) };
  // v39.4.1: خطة الحفظ معروضة قبل الضغط — بلا نافذة تأكيد من المتصفح (قد يكتمها بعض المتصفحات فيتوقف الحفظ صامتًا)،
  // والأيام في شهر مقفل أو الجزئية تُستثنى وحدها بدل إيقاف الحفظ كله
  const plan = useMemo(() => { if (!res) return null;
    const all = res.days.filter(x => x.n || x.total); const part = all.filter(x => x.partial && !inclPartial); const rest = all.filter(x => inclPartial || !x.partial);
    const locked = rest.filter(x => periodLocked(org, x.date)); const days = rest.filter(x => !periodLocked(org, x.date));
    return { days, part, locked, exist: days.filter(x => (ops.posImports || []).some(y => y.branchId === x.branchId && y.date === x.date)), unmapped: res.issues.noBranch };
  }, [res, inclPartial, org, ops]);
  const [done, setDone] = useState(null);
  const save = async () => {
    const days = plan.days;
    if (!days.length) return say(plan.locked.length ? 'كل الأيام في أشهر مقفلة محاسبيًا 🔒 — لا شيء للحفظ' : res.issues.noBranch ? 'لا أيام للحفظ — اربط فروع الملف بفروع ميزان أولًا' : 'لا أيام كاملة للحفظ — فعّل «احفظ الأيام الجزئية» إن أردت', 'no');
    const recs = days.map(x => ({ id: uid('pi'), branchId: x.branchId, date: x.date, n: x.n, total: x.total, vat: x.vat, cash: x.cash, card: x.card, transfer: x.transfer, apps: x.apps, nosCount: x.nos.length, nosSig: x.nos.length ? sha256Hex(x.nos.slice().sort().join('|')) : '', ...(x.partial ? { partial: x.partial } : {}), cutoff: st.cfg.cutoff || 0, file: st.name, by: me.name, at: nowISO() }));
    const ok = await commit(d => ({ ...d, posImports: [...(d.posImports || []).filter(y => !recs.some(r => r.branchId === y.branchId && r.date === y.date)), ...recs] }),
      { actionType: 'create', targetType: 'pos_import', targetId: recs[0] && recs[0].id, title: 'استيراد مبيعات نقاط البيع', details: st.name + ' · ' + recs.length + ' يوم/فرع · ' + money(recs.reduce((a, r) => a + r.total, 0)) });
    if (!ok) return;
    // حفظ الربط وساعة بداية اليوم لتصبح الرفعات القادمة تلقائية
    await commitOrg(d => ({ ...d, posImportMap: { br: { ...((d.posImportMap || {}).br || {}), ...st.cfg.brMap }, pay: { ...((d.posImportMap || {}).pay || {}), ...st.cfg.payMap }, cutoff: st.cfg.cutoff || 0 } }), { actionType: 'update', targetType: 'settings', targetId: 'posImportMap', title: 'حفظ ربط استيراد نقاط البيع', details: st.name });
    setDone({ n: recs.length, total: recs.reduce((a, r) => a + r.total, 0), file: st.name, skipped: plan.locked.length + plan.part.length });
    say('حُفظ ' + recs.length + ' يوم ✓'); setSt(null); setRes(null);
  };
  const exportRecon = (rows) => { try {
    const head = ['التاريخ', 'الفرع', 'الحالة', 'الفواتير', 'نقطة البيع', 'الإغلاق', 'الفرق', 'نقدي (ن.ب)', 'نقدي (إغلاق)', 'فرق النقدي', 'شبكة (ن.ب)', 'شبكة (إغلاق)', 'فرق الشبكة', 'تطبيقات (ن.ب)', 'تطبيقات (إغلاق)', 'فرق التطبيقات'];
    const body = rows.map(x => [x.date, brName(x.branchId), x.partial ? 'يوم جزئي' : ST[x.st][1], x.n, x.total, x.closing ? x.closing.total : '', x.d ? x.d.total : '', x.cash, x.closing ? x.closing.cash : '', x.d ? x.d.cash : '', x.card, x.closing ? x.closing.card : '', x.d ? x.d.card : '', x.appsI, x.closing ? x.closing.apps : '', x.d ? x.d.apps : '']);
    const blob = makeXlsx([{ name: 'مطابقة نقاط البيع', rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'مطابقة_نقاط_البيع.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل (Excel) ✓');
  } catch { say('تعذّر توليد Excel', 'no'); } };
  const payOpts = (<><option value="">— تجاهل —</option><option value="cash">نقدي</option><option value="card">شبكة / مدى</option><option value="transfer">تحويل</option>{apps.map(a => <option key={a.id} value={'app:' + a.id}>{a.n}</option>)}</>);
  const colSel = (k, lbl) => (<Field label={lbl} style={{ marginBottom: 0, minWidth: 130 }}><select className="sel" value={st.cfg.map[k] ?? -1} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, map: { ...x.cfg.map, [k]: Number(e.target.value) } } }))}>
    <option value={-1}>—</option>{(st.cfg.headers || []).map((h, i) => <option key={i} value={i}>{String(h || 'عمود ' + (i + 1)).slice(0, 24)}</option>)}</select></Field>);
  // v39.5: أيام مستوردة كاملة بلا أي إغلاق (غير مرفوض) وخارج الأشهر المقفلة ← مسودات إغلاق
  const noClose = (ops.posImports || []).filter(x => !x.partial && brs.some(b => b.id === x.branchId) && !periodLocked(org, x.date)
    && !(ops.closings || []).some(c => c.branchId === x.branchId && c.date === x.date && c.status !== 'rejected'));
  const makeDrafts = async () => {
    const recs = noClose.map(x => importDraftClosing(org, x, me.name));
    const ok = await commit(d => { const have = new Set((d.closings || []).filter(c => c.status !== 'rejected').map(c => c.branchId + '|' + c.date));
      return { ...d, closings: [...recs.filter(r => !have.has(r.branchId + '|' + r.date)), ...(d.closings || [])] }; },
      { actionType: 'create', targetType: 'closing', targetId: recs.map(r => r.id).slice(0, 5).join(','), title: 'أنشأ إغلاقات مسودة من استيراد نقاط البيع', details: recs.length + ' يوم · ' + money(recs.reduce((a, r) => a + r.totalRevenue, 0)) });
    if (ok !== false) say('أُنشئ ' + recs.length + ' إغلاق مسودة ✓ — أكملها من «الإغلاق اليومي» (العدّ والمصروفات) ثم رحّلها');
  };
  const recentRaw = (ops.posImports || []).filter(x => brs.some(b => b.id === x.branchId)).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 40);
  const recent = posRecon(org, ops, recentRaw);
  const ReconRow = ({ x, k }) => (
    <div className={'pr-row ' + (x.partial ? 'part' : x.st)}>
      <button type="button" className="cf-wh" onClick={() => setOpen(open === k ? null : k)} aria-expanded={open === k}>
        <span className="pr-a"><b>{brName(x.branchId)}</b><small><span className="dt">{arDate(x.date)}</span>{x.n ? ' · ' + x.n + ' فاتورة' : ''}</small></span>
        <span className="pr-v"><b className="num" dir="ltr">{money(x.total)}</b>{x.closing && <small className="num" dir="ltr">الإغلاق {money(x.closing.total)}</small>}</span>
        <span className="pr-s">{x.partial ? <span className="badge b-dim">يوم جزئي</span> : x.st === 'diff' ? <span className="badge b-rose">{money(x.d.total)}</span> : <span className={'badge ' + ST[x.st][0]}>{x.st === 'mix' ? 'توزيع مختلف' : ST[x.st][1]}</span>}</span>
        <ChevronDown size={14} className="cf-chev" />
      </button>
      {open === k && <div className="pr-d">
        {[['نقدي', x.cash, x.closing && x.closing.cash, x.d && x.d.cash], ['شبكة', x.card, x.closing && x.closing.card, x.d && x.d.card], ['تحويل', x.transfer || 0, x.closing && x.closing.transfer, x.d && x.d.transfer], ['تطبيقات', x.appsI, x.closing && x.closing.apps, x.d && x.d.apps]].filter(r => r[1] || r[2]).map(r => (
          <div key={r[0]} className="pr-m"><span>{r[0]}</span><span className="num" dir="ltr">{money(r[1])}</span><span className="num" dir="ltr">{r[2] == null ? '—' : money(r[2])}</span><b className="num" dir="ltr" style={{ color: r[3] == null || Math.abs(r[3]) < 0.01 ? 'var(--mint)' : 'var(--rose)' }}>{r[3] == null ? '' : Math.abs(r[3]) < 0.01 ? '✓' : (r[3] > 0 ? '+' : '') + money(r[3])}</b></div>))}
        <div className="pr-m pr-h"><span /><span>نقطة البيع</span><span>الإغلاق</span><span>الإغلاق − ن.ب</span></div>
        {Object.keys(x.apps || {}).length > 0 && <small style={{ color: 'var(--dim)' }}>{Object.entries(x.apps).map(([id, y]) => appName(id) + ' ' + money(y.amount)).join(' · ')}</small>}
        {x.partial && <small style={{ color: 'var(--dim)' }}>فترة التصدير لا تغطي يوم العمل كاملًا ({x.partial === 'start' ? 'بدأت بعد بدايته' : 'انتهت قبل نهايته'}) — لا يُقارن ولا يُحفظ إلا بقرارك.</small>}
      </div>}
    </div>);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-t" style={{ marginBottom: 6 }}><Upload size={15} color="var(--brass)" />رفع مبيعات نقاط البيع ومطابقتها (Excel / CSV)</div>
        <div className="note">صدّر من نظام نقاط البيع تقرير الفواتير (فاتورة في كل سطر: التاريخ والوقت، الفرع، رقم الفاتورة، الإجمالي، طريقة الدفع، حالة الدفع) أو تقريرًا يوميًا بعمود لكل طريقة دفع، ثم ارفعه هنا.
          تتعرّف المنصة على الأعمدة، وتنسب فواتير ما بعد منتصف الليل لوردية يومها، وتستبعد الملغاة والمكررة، ثم تطابق كل يوم وفرع مع الإغلاق اليومي بالإجمالي وكل طريقة دفع.</div>
        <label className="btn pri" style={{ cursor: 'pointer', marginTop: 8 }}><Upload size={14} />رفع الملف<input type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} onChange={pick} /></label>
        {st && <span className="badge b-dim" style={{ marginInlineStart: 8 }}>{st.name} · {st.cfg.layout === 'summary' ? 'ملخص يومي' : 'فاتورة لكل سطر'}</span>}
      </div>
      {st && <div className="card">
        <div className="lbl">الأعمدة (تعرّفت عليها تلقائيًا — صحّح إن لزم)</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 10 }}>
          {colSel('date', 'التاريخ')}{colSel('branch', 'الفرع')}{st.cfg.layout !== 'summary' && colSel('no', 'رقم الفاتورة')}{colSel('total', 'الإجمالي')}{colSel('vat', 'الضريبة')}{st.cfg.layout !== 'summary' ? colSel('pay', 'طريقة الدفع') : colSel('count', 'عدد الفواتير')}{st.cfg.layout !== 'summary' && colSel('status', 'حالة الفاتورة')}
          {st.cfg.map.branch < 0 && <Field label="الفرع (للملف كله)" style={{ marginBottom: 0 }}><select className="sel" value={st.cfg.branchId} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, branchId: e.target.value } }))}>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
        </div>
        <div className="lbl"><Clock size={12} style={{ verticalAlign: -2 }} /> بداية يوم العمل</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select className="sel" style={{ width: 'auto' }} value={st.cfg.cutoff || 0} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, cutoff: Number(e.target.value) } }))}>
            <option value={0}>منتصف الليل (اليوم التقويمي)</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00 — ما قبلها لليوم السابق</option>)}</select>
          <small style={{ color: st.cut.unsure ? 'var(--amber)' : 'var(--dim)' }}>{st.cut.why}</small>
        </div>
        {st.brVals.length > 0 && <><div className="lbl">ربط الفروع</div><div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{st.brVals.map(v => <Field key={v} label={v} style={{ marginBottom: 0 }}><select className="sel" value={st.cfg.brMap[v] || ''} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, brMap: { ...x.cfg.brMap, [v]: e.target.value } } }))}><option value="">— تجاهل —</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>)}</div></>}
        {st.payVals.length > 0 && <><div className="lbl">ربط طرق الدفع</div><div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{st.payVals.map(v => <Field key={v} label={v} style={{ marginBottom: 0 }}><select className="sel" value={st.cfg.payMap[v] || ''} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, payMap: { ...x.cfg.payMap, [v]: e.target.value } } }))}>{payOpts}</select></Field>)}</div></>}
        <button className="btn pri" onClick={run}><Scale size={14} />التجميع والمطابقة</button>
      </div>}
      {done && !res && <div className="card pi-done"><Check size={18} color="var(--mint)" /><div><b>حُفظ الاستيراد: {done.n} يوم/فرع بإجمالي {money(done.total)}</b><small>{done.file}{done.skipped ? ' · استُثني ' + done.skipped + ' يوم (جزئي أو شهر مقفل)' : ''} — تجدها مع مطابقتها في «آخر الأيام المستوردة» أدناه، والإغلاقات غير المسجّلة تُعبّأ منها بـ«تعبئة من نقطة البيع».</small></div></div>}
      {res && <div className="card">
        <div className="card-h"><div className="card-t"><Scale size={15} color="var(--brass)" />المطابقة مع الإغلاق اليومي</div><button className="btn sm" onClick={() => exportRecon(recon)}><Download size={13} />Excel</button></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="badge b-brass">{res.days.length} يوم/فرع · {money(res.days.reduce((a, x) => a + x.total, 0))}</span>
          {res.issues.shifted > 0 && <span className="badge b-sky">{res.issues.shifted} فاتورة بعد منتصف الليل نُسبت ليومها</span>}
          {res.issues.voided > 0 && <span className="badge b-amber">{res.issues.voided} ملغاة/مرتجعة استُبعدت ({money(res.issues.voidAmt)})</span>}
          {Object.entries(res.issues.other || {}).map(([k, n]) => <span key={k} className="badge b-amber">{n} بحالة «{k}» — مُحتسبة، راجعها</span>)}
          {res.issues.noBranch > 0 && <span className="badge b-amber">{res.issues.noBranch} سطر بلا فرع مربوط</span>}
          {res.issues.noPay > 0 && <span className="badge b-amber">{res.issues.noPay} مبلغ بطريقة دفع غير مربوطة</span>}
          {res.issues.dup > 0 && <span className="badge b-rose">{res.issues.dup} فاتورة مكررة استُبعدت</span>}
          {res.issues.badDate > 0 && <span className="badge b-dim">{res.issues.badDate} سطر بلا تاريخ (عناوين/مجاميع)</span>}
        </div>
        <div className="grid g4">
          <Kpi label="أيام مطابقة" value={String(kp.match)} sub={'من ' + full.length + ' يوم كامل'} icon={Check} color="#4FB286" />
          <Kpi label="أيام بفرق" value={String(kp.diff)} sub={kp.diff ? 'صافي الفرق ' + money(kp.diffSum) : 'لا فروق في الإجمالي'} icon={Scale} color={kp.diff ? '#D9544D' : '#4FB286'} />
          <Kpi label="توزيع دفع مختلف" value={String(kp.mix)} sub="الإجمالي مطابق — نقدي/شبكة مختلفان" icon={Scale} color={kp.mix ? '#E0A458' : '#4FB286'} />
          <Kpi label="بلا إغلاق" value={String(kp.noclose)} sub="يُعبّأ الإغلاق منها بعد الحفظ" icon={FileText} color={kp.noclose ? '#5B93C4' : '#4FB286'} />
        </div>
        <div className="pr-list">{recon.map(x => <ReconRow key={x.branchId + x.date} x={x} k={'n|' + x.branchId + x.date} />)}</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          {res.days.some(x => x.partial) && <label className="row" style={{ gap: 6, fontSize: 12 }}><input type="checkbox" checked={inclPartial} onChange={e => setInclPartial(e.target.checked)} />احفظ الأيام الجزئية أيضًا ({res.days.filter(x => x.partial).length})</label>}
          <button className="btn pri" onClick={save} disabled={!plan || !plan.days.length}><Check size={14} />حفظ الاستيراد ({plan ? plan.days.length : 0} يوم)</button>
        </div>
        {plan && <div className="pi-plan">
          <span className="badge b-mint">سيُحفظ {plan.days.length} يوم/فرع · {money(plan.days.reduce((a, x) => a + x.total, 0))}</span>
          {plan.exist.length > 0 && <span className="badge b-sky">{plan.exist.length} مستورد سابقًا سيُستبدل</span>}
          {plan.part.length > 0 && <span className="badge b-dim">{plan.part.length} يوم جزئي لن يُحفظ</span>}
          {plan.locked.length > 0 && <span className="badge b-amber">{plan.locked.length} يوم في شهر مقفل لن يُحفظ ({[...new Set(plan.locked.map(x => x.date.slice(0, 7)))].join('، ')})</span>}
          {plan.unmapped > 0 && <span className="badge b-rose">{plan.unmapped} فاتورة لفرع غير مربوط لن تُحفظ — اربطه من «ربط الفروع» أعلاه</span>}
        </div>}
        <div className="note" style={{ marginTop: 8 }}>الفرق = الإغلاق − نقطة البيع. «توزيع مختلف» يعني أن الإجمالي مطابق لكن الكاشير سجّل جزءًا من الشبكة نقدًا أو العكس — راجع عدّ الصندوق وتقرير جهاز الشبكة. الحفظ لا يغيّر أي إغلاق مسجّل؛ الإغلاقات غير المسجّلة تُعبّأ من الاستيراد.</div>
      </div>}
      <div className="card">
        <div className="card-h"><div className="card-t"><FileText size={15} color="var(--brass)" />آخر الأيام المستوردة ومطابقتها</div>{recent.length > 0 && <button className="btn sm" onClick={() => exportRecon(recent)}><Download size={13} />Excel</button>}</div>
        {noClose.length > 0 && <div className="pi-drafts"><span><b>{noClose.length} يوم مستورد بلا إغلاق</b> — يظهر في تحليل المبيعات والتوقع الآن، ويدخل الدفاتر بعد إغلاقه. أنشئ له إغلاقات مسودة معبأة بالمبيعات وطرق الدفع، يكملها الفرع (العدّ والمصروفات) ثم يرحّلها.</span>
          <button className="btn sm pri" onClick={makeDrafts}><Plus size={13} />إنشاء {noClose.length} إغلاق مسودة</button></div>}
        {!recent.length ? <div className="empty">لا استيراد بعد.</div> : <div className="pr-list">{recent.map(x => <ReconRow key={x.id} x={x} k={'r|' + x.id} />)}</div>}
      </div>
    </div>);
}
