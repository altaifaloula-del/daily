/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Settings, Trash2, Plus, Check } from 'lucide-react';
import { Field, POS_DEV_KEY, posPaperDev, setPosPaperDev, uid, areasErr, ROLES, restCfg, kdsStationsErr } from '../../App.jsx';

export function PosSettings({ org, commitOrg, say, dev, me }) {
  const c = org.posCfg || {};
  const canCredit = !!(me && (ROLES[me.role] || {}).admin);   // v56.46: مفتاح البيع الآجل لمسؤول النظام وحده
  const [credit, setCredit] = useState(!!c.credit);
  // v56.53 — العمل دون اتصال: المفتاح لمسؤول النظام وحده (معطّل افتراضيًا)، وحد المرتجع دون اتصال لكل فرع (الافتراضي صفر = ممنوع)
  const [offl, setOffl] = useState(!!c.offline); const [orl, setOrl] = useState(() => Object.fromEntries(Object.entries(c.offRetLimit || {}).map(([b, v]) => [b, String(v)])));
  // v56.54 (قرار المالك): نوع حد المرتجع دون اتصال لكل فرع (مجموع/لكل مرتجع) وفترة المجموع (بلا/يوم/وردية) — الافتراضي كما في v56.53؛ وفتح التطبيق دون إنترنت وسجل الأجهزة (لمسؤول النظام، مطفآن)
  const [orm, setOrm] = useState(() => ({ ...(c.offRetMode || {}) })); const [orp, setOrp] = useState(() => ({ ...(c.offRetPeriod || {}) }));
  const [offSh, setOffSh] = useState(!!c.offShell); const [devReg, setDevReg] = useState(!!c.devReg);
  const [appPr, setAppPr] = useState(!!c.appPrices);   // v56.47 (P4) قوائم أسعار التطبيقات — لمسؤول النظام وحده، معطّل افتراضيًا
  const [f, setF] = useState({ branches: c.branches || [], footer: c.footer || '', autoPrint: c.autoPrint !== false, returns: !!c.returns, devName: dev ? dev.name : '', maxDiscPct: c.maxDiscPct != null ? String(c.maxDiscPct) : '', payMethods: (c.payMethods || []).map(x => ({ ...x })), tables: { ...(c.tables || {}) }, areas: JSON.parse(JSON.stringify(c.areas || {})), drivers: (c.drivers || []).map(x => ({ ...x })), kds: !!c.kds, noImg: !!c.noImg, paper: String(c.paper || '') === '58' ? '58' : '80', devPaper: posPaperDev() });   // v42.9
  // v56.52 — المطعم (المرحلة 3): لمسؤول النظام وحده، كل المفاتيح مطفأة افتراضيًا
  const [rest, setRest] = useState(() => { const r = restCfg(org); return { ...r, prepTarget: r.prepTarget ? String(r.prepTarget) : '' }; });
  const [stns, setStns] = useState(() => JSON.parse(JSON.stringify(c.stations || {})));
  const pCats = [...new Set((org.products || []).filter(p => !p.posOff).map(p => p.cat || 'أخرى'))], pAll = (org.products || []).filter(p => !p.posOff && p.id);
  const REST_KEYS = [['covers', 'عدد الأشخاص للطاولة — يُختم على الفاتورة، ومتوسط الفاتورة للشخص في تقرير الصالات'], ['waiters', 'النادل — اختيار نادل للطاولة من موظفي الفرع، وتقرير مبيعات كل نادل لليوم أو الوردية'],
    ['merge', 'دمج الطاولات — ضمّ حساب طاولة مفتوح إلى آخر (تذاكر المطبخ المرسلة تبقى) بسجل تدقيق'], ['split', 'تقسيم الفاتورة بالأصناف — كل جزء فاتورة نقطة بيع مستقلة برقمها وبصمتها ودفعها'],
    ['stations', 'محطات المطبخ — تذكرة لكل محطة حسب التصنيف أو المنتج، وكل شاشة مطبخ تختار محطتها'], ['rush', 'أولوية «مستعجل» — تتقدّم التذكرة في شاشة المطبخ'], ['prepRpt', 'تقرير أوقات التحضير — من وصول التذكرة حتى «جاهز» لكل محطة وصنف، مع تصدير Excel']];
  const KIND_AR = { card: 'شبكة', cash: 'نقدي', transfer: 'تحويل' };
  const setPm = (i, patch) => setF(x => ({ ...x, payMethods: x.payMethods.map((y, k) => k === i ? { ...y, ...patch } : y) }));
  const save = async () => {
    if (dev && f.devName.trim()) { try { localStorage.setItem(POS_DEV_KEY, JSON.stringify({ ...dev, name: f.devName.trim() })); } catch { } }
    const tables = {}; Object.entries(f.tables || {}).forEach(([b, n]) => { const v = Math.max(0, Math.min(200, Math.floor(Number(n) || 0))); if (v) tables[b] = v; });
    // v49.2 — MQ-006: السائقون (الاسم إلزامي، الجوال اختياري، الفرع اختياري = كل الفروع)
    const drivers = (f.drivers || []).filter(d => String(d.name || '').trim()).map(d => ({ id: d.id || uid('drv'), name: String(d.name).trim().slice(0, 40), ...(String(d.phone || '').trim() ? { phone: String(d.phone).trim().slice(0, 20) } : {}), ...(d.branchId ? { branchId: d.branchId } : {}), active: d.active !== false }));
    // v49.2 — MQ-005: الصالات — تحقق ثم حفظ النطاقات الصالحة فقط
    const areas = {};
    for (const [b, L] of Object.entries(f.areas || {})) { const list = (L || []).filter(a => a && (String(a.name || '').trim() || a.from || a.to));
      if (!list.length || !tables[b]) continue; const e = areasErr(list, tables[b]); if (e) return say(((org.branches || []).find(x => x.id === b) || {}).name + ': ' + e, 'no');
      areas[b] = list.map(a => ({ id: a.id || uid('ar'), name: String(a.name).trim().slice(0, 40), from: Math.floor(Number(a.from)), to: Math.floor(Number(a.to)) })); }
    // v56.52: المحطات — تحقق ثم حفظ الصالحة فقط (لكل فرع مفعّل)
    const stations = {};
    if (canCredit) for (const [b, L] of Object.entries(stns || {})) { const list = (L || []).filter(x => x && (String(x.name || '').trim() || (x.cats || []).length || (x.prods || []).length)); if (!list.length) continue;
      const e = kdsStationsErr(list); if (e) return say(((org.branches || []).find(x => x.id === b) || {}).name + ': ' + e, 'no');
      stations[b] = list.map(x => ({ id: x.id || uid('st'), name: String(x.name).trim().slice(0, 30), cats: x.cats || [], prods: x.prods || [] })); }
    const pt = Math.floor(Number(rest.prepTarget) || 0); if (canCredit && rest.prepRpt && rest.prepTarget !== '' && !(pt >= 1 && pt <= 240)) return say('هدف التحضير بالدقائق من 1 إلى 240', 'no');
    const restOut = { covers: !!rest.covers, waiters: !!rest.waiters, merge: !!rest.merge, split: !!rest.split, stations: !!rest.stations, rush: !!rest.rush, prepRpt: !!rest.prepRpt, ...(pt ? { prepTarget: pt } : {}) };
    const restW = canCredit && (Object.values(restOut).some(Boolean) || c.rest != null), stW = canCredit && (Object.keys(stations).length > 0 || c.stations != null);
    // v56.53: حد المرتجع دون اتصال — رقم ≥ 0 بهللتين وحد أعلى معقول؛ فارغ = صفر (ممنوع)
    const offRetLimit = {}; const offW = (canCredit ? offl : !!c.offline) || c.offRetLimit != null;
    if (offW) for (const b of f.branches) { const raw = String(orl[b] ?? '').trim(); if (raw === '') continue; const v = Number(raw);
      if (!isFinite(v) || v < 0 || v > 1000000 || Math.round(v * 100) !== v * 100) return say('حد المرتجع دون اتصال: رقم من 0 إلى 1,000,000 بهللتين على الأكثر', 'no');
      if (v > 0) offRetLimit[b] = v; }
    // v56.54: يُكتب النوع والفترة لغير الافتراضي فقط (أو إن وُجد المفتاح سابقًا) — الحفظ بلا اختيار لا يكتب مفتاحًا جديدًا
    const offRetMode = {}, offRetPeriod = {};
    if (offW) for (const b of f.branches) { const m = orm[b] === 'each' ? 'each' : 'total'; if (m === 'each') offRetMode[b] = 'each'; else if (['day', 'shift'].includes(orp[b])) offRetPeriod[b] = orp[b]; }
    const ormW = offW && (Object.keys(offRetMode).length > 0 || c.offRetMode != null), orpW = offW && (Object.keys(offRetPeriod).length > 0 || c.offRetPeriod != null);
    setPosPaperDev(f.devPaper);   // v44.7: تخصيص هذا الجهاز (على الجهاز فقط)
    const ok = await commitOrg(d => ({ ...d, posCfg: { ...(d.posCfg || {}), areas, drivers, paper: f.paper === '58' ? '58' : '80', noImg: !!f.noImg, tables, kds: !!f.kds, returns: !!f.returns, ...(canCredit ? { credit, ...(appPr || c.appPrices != null ? { appPrices: appPr } : {}), ...(offl || c.offline != null ? { offline: offl } : {}), ...(offSh || c.offShell != null ? { offShell: offl && offSh } : {}), ...(devReg || c.devReg != null ? { devReg } : {}) } : {}), ...(offW ? { offRetLimit } : {}), ...(ormW ? { offRetMode } : {}), ...(orpW ? { offRetPeriod } : {}), ...(restW ? { rest: restOut } : {}), ...(stW ? { stations } : {}), branches: f.branches, footer: f.footer.trim(), autoPrint: !!f.autoPrint, maxDiscPct: Number(f.maxDiscPct) || 0, payMethods: f.payMethods.filter(x => (x.n || '').trim()).map(x => ({ id: x.id, n: x.n.trim(), kind: x.kind || 'card', active: x.active !== false })) } }), { actionType: 'update', targetType: 'settings', targetId: 'posCfg', need: 'edit', title: 'إعدادات نقطة البيع', details: 'الفروع: ' + f.branches.map(id => ((org.branches || []).find(b => b.id === id) || {}).name).join('، ') });
    if (ok) say('حُفظت إعدادات نقطة البيع ✓');
  };
  return (
    <div className="card">
      <div className="card-t" style={{ marginBottom: 8 }}><Settings size={15} color="var(--brass)" />إعدادات نقطة البيع</div>
      <div className="lbl">الفروع المفعّلة (التجربة)</div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', margin: '4px 0 10px' }}>{(org.branches || []).filter(b => b.isActive !== false).map(b => <label key={b.id} className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={f.branches.includes(b.id)} onChange={e => setF(x => ({ ...x, branches: e.target.checked ? [...x.branches, b.id] : x.branches.filter(i => i !== b.id) }))} />{b.name}</label>)}</div>
      <div className="grid g2">
        <Field label="عبارة أسفل الفاتورة"><input className="inp" value={f.footer} placeholder="رقم خدمة العملاء، رابط التقييم…" onChange={e => setF(x => ({ ...x, footer: e.target.value }))} /></Field>
        <Field label="أقصى خصم يدوي للكاشير % (فارغ = بلا حد)"><input className="inp n" inputMode="decimal" value={f.maxDiscPct} placeholder="مثال: 10" onChange={e => setF(x => ({ ...x, maxDiscPct: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
        {/* v44.7 — عرض ورق الإيصال (طابعة الكاشير الحرارية) */}
        <Field label="عرض ورق الإيصال (الإعداد العام)"><select className="sel" aria-label="عرض ورق الإيصال" value={f.paper} onChange={e => setF(x => ({ ...x, paper: e.target.value }))}><option value="80">80 مم (الافتراضي)</option><option value="58">58 مم</option></select></Field>
        <Field label="عرض الورق لهذا الجهاز"><select className="sel" aria-label="عرض الورق لهذا الجهاز" value={f.devPaper} onChange={e => setF(x => ({ ...x, devPaper: e.target.value }))}><option value="">مثل الإعداد العام</option><option value="80">80 مم</option><option value="58">58 مم</option></select>
          <div className="hint">لكاشير طابعته بعرض مختلف عن باقي الفروع — يُحفظ على هذا الجهاز فقط</div></Field>
        {dev && <Field label={'اسم هذا الجهاز (' + dev.tag + ')'}><input className="inp" value={f.devName} placeholder="كاشير 1" onChange={e => setF(x => ({ ...x, devName: e.target.value }))} /></Field>}
      </div>
      {/* v42.9 — الطاولات والحساب المفتوح وشاشة المطبخ (مُطفأة افتراضيًا) */}
      <div className="lbl">الطاولات (الحساب المفتوح للمحلي) — 0 = بلا طاولات</div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', margin: '4px 0 8px' }}>{(org.branches || []).filter(b => b.isActive !== false && f.branches.includes(b.id)).map(b => <label key={b.id} className="row" style={{ gap: 6, fontSize: 12.5, alignItems: 'center' }}>{b.name}
        <input className="inp n" style={{ width: 70 }} inputMode="numeric" aria-label={'عدد طاولات ' + b.name} value={f.tables[b.id] ?? ''} placeholder="0" onChange={e => setF(x => ({ ...x, tables: { ...x.tables, [b.id]: e.target.value.replace(/[^\d]/g, '') } }))} /></label>)}</div>
      {(org.branches || []).filter(b => b.isActive !== false && f.branches.includes(b.id) && Number(f.tables[b.id]) > 0).map(b => { const L = (f.areas || {})[b.id] || [];
        const setL = (fn) => setF(x => ({ ...x, areas: { ...(x.areas || {}), [b.id]: fn((x.areas || {})[b.id] || []) } }));
        return <div key={b.id} className="note" style={{ margin: '0 0 8px' }} data-areaed={b.name}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 12.5 }}>صالات {b.name} <small style={{ color: 'var(--faint)' }}>(اختياري — نطاقات من طاولات 1–{f.tables[b.id]})</small></b>
            <button className="btn sm gh" onClick={() => setL(l => [...l, { name: '', from: '', to: '' }])}>+ صالة</button></div>
          {L.map((a, i) => <div key={i} className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="inp" style={{ width: 150 }} aria-label="اسم الصالة" placeholder="مثال: العائلات" value={a.name || ''} onChange={e => setL(l => l.map((y, k) => k === i ? { ...y, name: e.target.value } : y))} />
            <span style={{ fontSize: 12 }}>من</span><input className="inp n" style={{ width: 60 }} inputMode="numeric" aria-label="من طاولة" value={a.from ?? ''} onChange={e => setL(l => l.map((y, k) => k === i ? { ...y, from: e.target.value.replace(/[^\d]/g, '') } : y))} />
            <span style={{ fontSize: 12 }}>إلى</span><input className="inp n" style={{ width: 60 }} inputMode="numeric" aria-label="إلى طاولة" value={a.to ?? ''} onChange={e => setL(l => l.map((y, k) => k === i ? { ...y, to: e.target.value.replace(/[^\d]/g, '') } : y))} />
            <button className="btn sm gh" aria-label="حذف الصالة" onClick={() => setL(l => l.filter((_, k) => k !== i))}>×</button></div>)}
        </div>; })}
      <div className="lbl">سائقو التوصيل الذاتي (لا يلزم لطلبات التطبيقات)</div>
      <div data-drivers style={{ marginBottom: 10 }}>
        {(f.drivers || []).map((d, i) => { const up = (patch) => setF(x => ({ ...x, drivers: x.drivers.map((y, k) => k === i ? { ...y, ...patch } : y) }));
          return <div key={i} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="inp" style={{ width: 150 }} aria-label="اسم السائق" placeholder="اسم السائق" value={d.name || ''} onChange={e => up({ name: e.target.value })} />
            <input className="inp" style={{ width: 130 }} inputMode="tel" aria-label="جوال السائق" placeholder="الجوال" value={d.phone || ''} onChange={e => up({ phone: e.target.value })} />
            <select className="sel" style={{ width: 'auto' }} aria-label="فرع السائق" value={d.branchId || ''} onChange={e => up({ branchId: e.target.value })}><option value="">كل الفروع</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <label className="row" style={{ gap: 4, fontSize: 12 }}><input type="checkbox" checked={d.active !== false} onChange={e => up({ active: e.target.checked })} />نشط</label>
            <button className="btn sm gh" aria-label="حذف السائق" onClick={() => setF(x => ({ ...x, drivers: x.drivers.filter((_, k) => k !== i) }))}>×</button></div>; })}
        <button className="btn sm gh" onClick={() => setF(x => ({ ...x, drivers: [...(x.drivers || []), { name: '', phone: '', branchId: '', active: true }] }))}>+ سائق</button>
      </div>
      <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px' }}><input type="checkbox" checked={!!f.kds} onChange={e => setF(x => ({ ...x, kds: e.target.checked }))} />تشغيل شاشة المطبخ — كل طلب يصلها لحظة إرساله أو دفعه</label>
      <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px' }}><input type="checkbox" aria-label="إظهار صور المنتجات" checked={!f.noImg} onChange={e => setF(x => ({ ...x, noImg: !e.target.checked }))} />إظهار صور المنتجات على أزرار نقطة البيع (لمن أُضيفت له صورة)</label>
      <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px' }}><input type="checkbox" aria-label="تفعيل المرتجع" checked={!!f.returns} onChange={e => setF(x => ({ ...x, returns: e.target.checked }))} />تفعيل المرتجع (جزئي أو كلي) — لمدير الفرع فقط؛ الطبق المرتجع يُسجَّل هدرًا، ويُرد المبلغ بطريقة الدفع الأصلية أو نقدًا</label>
      {canCredit && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px', alignItems: 'flex-start' }}><input type="checkbox" aria-label="تفعيل البيع الآجل" checked={credit} onChange={e => setCredit(e.target.checked)} /><span>تفعيل البيع الآجل على حساب العميل (معطّل افتراضيًا) — للعملاء الموسومين «مؤهل للآجل من الكاشير» في جهات الاتصال بحد ائتمان، ومن غير المسجّلين ضريبيًا. يتطلب اتصالًا بالخادم عند كل بيع آجل (يتحقق من الحد)، ويُقيَّد على ذمم العملاء عند ترحيل إغلاق اليوم. كل تفويض يُسجَّل في سجل دائم على الخادم — شغّل «فحص تفويض الآجل» يوميًا من «فواتير المبيعات ← ذمم الكاشير» لكشف أي فاتورة آجلة بلا تفويض أو بمبلغ أو عميل مختلف.</span></label>}
      {canCredit && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px', alignItems: 'flex-start' }}><input type="checkbox" aria-label="تفعيل قوائم أسعار التطبيقات" checked={appPr} onChange={e => setAppPr(e.target.checked)} /><span>تفعيل قوائم أسعار تطبيقات التوصيل (معطّل افتراضيًا) — سعر لكل تطبيق في بطاقة المنتج (فارغ = سعر المطعم)، ويختار الكاشير «قائمة الأسعار» في السلة، والدفع بالتطبيق يطابق قائمته. المبيعات بالإجمالي كما هي.</span></label>}
      {canCredit && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px', alignItems: 'flex-start' }}><input type="checkbox" aria-label="تفعيل العمل دون اتصال" data-offcfg checked={offl} onChange={e => setOffl(e.target.checked)} /><span>تفعيل العمل دون اتصال (معطّل افتراضيًا) — الفواتير والورديات ونقاط الولاء تُحفظ في قاعدة على الجهاز (IndexedDB) وتُرسل بالترتيب مع سجل مزامنة للمدير؛ الإلغاء والبيع الآجل يبقيان بحاجة لاتصال</span></label>}
      {(canCredit ? offl : !!c.offline) && <div className="note" data-offretcfg style={{ margin: '4px 0 10px' }}><b style={{ fontSize: 13 }}>حد المرتجع دون اتصال لكل فرع (ريال)</b>
        <div className="hint">فارغ أو صفر = المرتجع دون اتصال ممنوع. الحد على مجموع مرتجعات الفرع دون اتصال التي لم يعتمد المدير مراجعتها بعد.</div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 6 }}>{(org.branches || []).filter(b => b.isActive !== false && f.branches.includes(b.id)).map(b => <label key={b.id} className="row" style={{ gap: 6, fontSize: 12.5, alignItems: 'center' }}>{b.name}
          <input className="inp n" style={{ width: 90 }} inputMode="decimal" aria-label={'حد المرتجع دون اتصال ' + b.name} value={orl[b.id] ?? ''} placeholder="0" onChange={e => setOrl(x => ({ ...x, [b.id]: e.target.value.replace(/[^\d.]/g, '') }))} />
          <select className="sel" style={{ width: 'auto' }} aria-label={'نوع حد المرتجع ' + b.name} data-offretmode={b.id} value={orm[b.id] === 'each' ? 'each' : 'total'} onChange={e => setOrm(x => ({ ...x, [b.id]: e.target.value }))}><option value="total">على مجموع غير المراجَع</option><option value="each">لكل مرتجع وحده</option></select>
          {orm[b.id] !== 'each' && <select className="sel" style={{ width: 'auto' }} aria-label={'فترة حد المرتجع ' + b.name} data-offretperiod={b.id} value={['day', 'shift'].includes(orp[b.id]) ? orp[b.id] : 'none'} onChange={e => setOrp(x => ({ ...x, [b.id]: e.target.value }))}><option value="none">بلا فترة (كل غير المراجَع)</option><option value="day">لكل يوم عمل</option><option value="shift">لكل وردية على الجهاز</option></select>}</label>)}</div>
        <div className="hint">«لكل مرتجع وحده»: كل مرتجع دون اتصال حتى الحد بلا مجموع. «لكل يوم» أو «لكل وردية»: المجموع غير المراجَع في اليوم أو في وردية هذا الجهاز (مرتجع بلا وردية ⇒ كل غير المراجَع).</div></div>}
      {canCredit && offl && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px', alignItems: 'flex-start' }}><input type="checkbox" aria-label="فتح التطبيق دون إنترنت" data-offshellcfg checked={offSh} onChange={e => setOffSh(e.target.checked)} /><span>فتح التطبيق دون إنترنت على أجهزة نقطة البيع (معطّل افتراضيًا) — يُخزَّن هيكل التطبيق على الجهاز بعد فتح نقطة البيع متصلًا، فيُفتح بعد انقطاع الإنترنت. البيانات لا تُخزَّن بهذا، والجهاز المتصل يأخذ أحدث نسخة دائمًا؛ الإيقاف يزيله من الأجهزة عند فتحها.</span></label>}
      {canCredit && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px', alignItems: 'flex-start' }}><input type="checkbox" aria-label="تفعيل سجل الأجهزة" data-devregcfg checked={devReg} onChange={e => setDevReg(e.target.checked)} /><span>سجل أجهزة نقطة البيع على الخادم (معطّل افتراضيًا) — كل جهاز يأخذ رقمًا فريدًا للفرع من الخادم مرة واحدة (مثل D0001) يُستخدم في ترقيم فواتيره الجديدة بدل وسمه المحلي، بعد إغلاق ورديته الحالية. الفواتير السابقة كما هي، ودون اتصال يبقى الوسم المحلي.</span></label>}
      {canCredit && <div className="note" data-restcfg style={{ margin: '4px 0 10px' }}>
        <b style={{ fontSize: 13 }}>المطعم — كلها معطّلة افتراضيًا</b>
        {REST_KEYS.map(([k, t]) => <label key={k} className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', marginTop: 6, alignItems: 'flex-start' }}><input type="checkbox" aria-label={'مطعم: ' + k} data-restkey={k} checked={!!rest[k]} onChange={e => setRest(x => ({ ...x, [k]: e.target.checked }))} /><span>{t}</span></label>)}
        {rest.prepRpt && <Field label="هدف التحضير بالدقائق (المتأخر أكبر منه — فارغ = بلا نسبة تأخر)" style={{ marginTop: 8, marginBottom: 0 }}><input className="inp n" style={{ width: 90 }} inputMode="numeric" aria-label="هدف التحضير بالدقائق" value={rest.prepTarget} onChange={e => setRest(x => ({ ...x, prepTarget: e.target.value.replace(/[^\d]/g, '').slice(0, 3) }))} /></Field>}
        {rest.stations && (org.branches || []).filter(b => b.isActive !== false && f.branches.includes(b.id)).map(b => { const L = (stns || {})[b.id] || [];
          const setL = (fn) => setStns(x => ({ ...(x || {}), [b.id]: fn((x || {})[b.id] || []) }));
          return <div key={b.id} data-stationed={b.name} style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 12.5 }}>محطات {b.name} <small style={{ color: 'var(--faint)' }}>(المنتج المربوط أولًا ثم تصنيفه؛ غير المربوط ⇒ «عام»)</small></b>
              <button className="btn sm gh" onClick={() => setL(l => [...l, { id: uid('st'), name: '', cats: [], prods: [] }])}>+ محطة</button></div>
            {L.map((st, i) => { const up = (patch) => setL(l => l.map((y, k) => k === i ? { ...y, ...patch } : y));
              return <div key={st.id || i} style={{ marginTop: 6 }}>
                <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><input className="inp" style={{ width: 150 }} aria-label="اسم المحطة" placeholder="مثال: الشواية" value={st.name || ''} onChange={e => up({ name: e.target.value })} />
                  <button className="btn sm gh" aria-label="حذف المحطة" onClick={() => setL(l => l.filter((_, k) => k !== i))}>×</button></div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 4 }}>{pCats.map(ct => <label key={ct} className="row" style={{ gap: 4, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" aria-label={'تصنيف ' + ct + ' للمحطة ' + (i + 1)} checked={(st.cats || []).includes(ct)} onChange={e => up({ cats: e.target.checked ? [...(st.cats || []), ct] : (st.cats || []).filter(x => x !== ct) })} />{ct}</label>)}</div>
                {pAll.length > 0 && <select multiple className="sel" style={{ marginTop: 4, minHeight: 64 }} aria-label={'منتجات المحطة ' + (i + 1)} value={st.prods || []} onChange={e => up({ prods: [...e.target.selectedOptions].map(o => o.value) })}>{pAll.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
              </div>; })}
          </div>; })}
      </div>}
      <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 10px' }}><input type="checkbox" checked={f.autoPrint} onChange={e => setF(x => ({ ...x, autoPrint: e.target.checked }))} />طباعة الفاتورة تلقائيًا بعد الدفع</label>
      <div className="lbl">طرق دفع إضافية (تمارا، تابي، STC Pay، قسائم…)</div>
      <div className="note" style={{ marginBottom: 6 }}>تظهر في شاشة الدفع وفي أزرار السلة. اختر كيف تُحتسب في الإغلاق اليومي والقيود: «شبكة» للمحافظ والتقسيط والبطاقات، «تحويل» للتحويل البنكي، «نقدي» لما يدخل الدرج.</div>
      {f.payMethods.map((pm, i) => <div key={pm.id} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" style={{ flex: 2, minWidth: 130 }} value={pm.n} placeholder="اسم طريقة الدفع" onChange={e => setPm(i, { n: e.target.value })} />
        <select className="sel" style={{ flex: 1, minWidth: 120 }} value={pm.kind || 'card'} onChange={e => setPm(i, { kind: e.target.value })}>{Object.entries(KIND_AR).map(([k, t]) => <option key={k} value={k}>تُحتسب: {t}</option>)}</select>
        <label className="row" style={{ gap: 5, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={pm.active !== false} onChange={e => setPm(i, { active: e.target.checked })} />مفعّلة</label>
        <button className="btn sm gh" onClick={() => setF(x => ({ ...x, payMethods: x.payMethods.filter((_, k) => k !== i) }))}><Trash2 size={12} color="#D9544D" /></button>
      </div>)}
      <button className="btn sm" style={{ marginBottom: 10 }} onClick={() => setF(x => ({ ...x, payMethods: [...x.payMethods, { id: uid('pm'), n: '', kind: 'card', active: true }] }))}><Plus size={13} />إضافة طريقة دفع</button>
      <div />
      <button className="btn pri" onClick={save}><Check size={14} />حفظ</button>
      <div className="note" style={{ marginTop: 8 }}>المنتجات وأسعارها وتصنيفاتها من «المخزون ← الوصفات والتكلفة». الرقم الضريبي واسم المنشأة من الإعدادات. الطابعة: اختر الطابعة الحرارية من نافذة الطباعة (على الآيباد عبر AirPrint).</div>
    </div>);
}
