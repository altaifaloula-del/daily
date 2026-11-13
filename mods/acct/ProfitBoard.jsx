/* v40.1 — «ربحية الفروع اليومية» (المرحلة 1 من مركز إدارة المطعم)
   كل طريقة حساب يختارها المالك في الإعداد — لا افتراضيات، والميزة موقوفة حتى تكتمل وتُفعَّل.
   للإدارة المركزية فقط: الرواتب والإيجارات في مستند الإعدادات المركزي الذي لا تقرؤه الفروع (قواعد Firestore). */
import React, { useMemo, useState } from 'react';
import { TrendingUp, Settings, Check, Plus, Trash2, Download, ChevronDown, Info, Lock } from 'lucide-react';
import { EXP_CATS, Field, Kpi, PROFIT_OPTS, ROLES, arDate, makeXlsx, money, profitDays, profitMissing, roleEdit, today, uid } from '../../App.jsx';

const pad = (n) => String(n).padStart(2, '0');
const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const pct = (v) => v == null ? '—' : v.toFixed(1) + '%';
const TG = { food: 'تكلفة الطعام', labor: 'تكلفة العمالة', prime: 'التكلفة الأساسية (طعام + عمالة)' };

export function ProfitBoard({ org, ops, me, myBranches, commitOrg, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const canCfg = roleEdit(me?.role);
  const saved = org.profitCfg || {};
  const [cfgOpen, setCfgOpen] = useState(!saved.enabled);
  const [d, setD] = useState(() => ({ foodBasis: '', laborBasis: '', alloc: '', cardFee: '', cardRate: '', foodCats: [], foodSuppliers: [], fixed: [], targets: {}, ...saved, enabled: !!saved.enabled }));
  const td = today();
  const [rng, setRng] = useState({ k: 'y', from: addD(td, -1), to: addD(td, -1) });
  const [open, setOpen] = useState(null);
  const ids = (myBranches || []).map(b => b.id);
  const P = useMemo(() => profitDays(org, ops, { from: rng.from, to: rng.to, branchIds: ids, cfg: saved }), [org, ops, rng, saved]);
  // المرجع لاختيار الأهداف: متوسطك الفعلي آخر 30 يومًا بإعدادات المسودة الحالية
  const draftMissing = profitMissing(d);
  const ref = useMemo(() => draftMissing.length ? null : profitDays(org, ops, { from: addD(td, -30), to: addD(td, -1), branchIds: ids, cfg: d }), [org, ops, d, draftMissing.length]);
  if (!central) return <div className="card"><div className="empty"><Lock size={16} /> ربحية الفروع للإدارة المركزية فقط — الرواتب والإيجارات محفوظة في المستند المركزي الذي لا يقرؤه حساب الفرع.</div></div>;
  const cats = org.expenseCats && org.expenseCats.length ? org.expenseCats : EXP_CATS;
  const tgt = saved.targets || {};
  const save = async () => {
    const miss = profitMissing(d); if (d.enabled && miss.length) return say('أكمل قبل التفعيل: ' + miss.join('، '), 'no');
    const rec = { enabled: !!d.enabled, foodBasis: d.foodBasis, laborBasis: d.laborBasis, alloc: d.alloc, cardFee: d.cardFee, cardRate: Number(d.cardRate) || 0,
      foodCats: d.foodCats || [], foodSuppliers: d.foodSuppliers || [], fixed: (d.fixed || []).filter(x => x.branchId && Number(x.amount) > 0).map(x => ({ ...x, amount: Number(x.amount) })),
      targets: Object.fromEntries(Object.entries(d.targets || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) };
    const ok = await commitOrg(o => ({ ...o, profitCfg: rec }), { actionType: 'update', targetType: 'settings', targetId: 'profitCfg', need: 'edit', title: 'إعدادات الربحية', details: (rec.enabled ? 'مفعّلة' : 'موقوفة') + ' · الطعام: ' + (PROFIT_OPTS.foodBasis[rec.foodBasis] || '—') + ' · العمالة: ' + (PROFIT_OPTS.laborBasis[rec.laborBasis] || '—') });
    if (ok !== false) { say('حُفظت إعدادات الربحية ✓'); if (rec.enabled) setCfgOpen(false); }
  };
  const setK = (k, v) => setD(x => ({ ...x, [k]: v }));
  const tog = (k, id) => setD(x => ({ ...x, [k]: (x[k] || []).includes(id) ? x[k].filter(y => y !== id) : [...(x[k] || []), id] }));
  const refTot = ref ? (() => { const b = ref.branches.filter(x => x.tot.net > 0); const net = b.reduce((a, x) => a + x.tot.net, 0); const sumK = (k) => b.every(x => x.tot[k] != null) ? b.reduce((a, x) => a + x.tot[k], 0) : null;
    const f = sumK('food'), l = sumK('labor'); return { food: f != null && net ? f / net * 100 : null, labor: l != null && net ? l / net * 100 : null, prime: f != null && l != null && net ? (f + l) / net * 100 : null }; })() : null;
  const sel = (k, label) => <Field label={label}><select className="inp sel" value={d[k] || ''} onChange={e => setK(k, e.target.value)}><option value="">— اختر —</option>{Object.entries(PROFIT_OPTS[k]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>;
  const periods = [['t', 'اليوم', td, td], ['y', 'أمس', addD(td, -1), addD(td, -1)], ['w', 'آخر 7 أيام', addD(td, -7), addD(td, -1)], ['m', 'هذا الشهر', td.slice(0, 7) + '-01', td]];
  const flag = (v, k) => { const t = tgt[k]; return v == null || !t ? '' : v > t ? ' over' : ' under'; };
  const exportX = () => { try { const head = ['الفرع', 'التاريخ', 'المصدر', 'صافي المبيعات', 'تكلفة الطعام', 'الطعام %', 'النظري', 'العمالة', 'العمالة %', 'التكلفة الأساسية %', 'العمولات', 'رسوم الشبكة', 'الثابتة', 'الهامش', 'الهامش %', 'غير متاح'];
    const rows = P.branches.flatMap(b => b.days.filter(x => x.gross > 0).map(x => [b.name, x.date, x.src === 'import' ? 'استيراد' : 'إغلاق', x.net, x.food ?? '', x.foodPct ?? '', x.theo ?? '', x.labor ?? '', x.laborPct ?? '', x.primePct ?? '', x.comm, x.card, x.fixed, x.margin ?? '', x.marginPct ?? '', Object.values(x.na).join(' · ')]));
    const blob = makeXlsx([{ name: 'ربحية الفروع', rows: [head, ...rows] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ربحية_الفروع_' + rng.from + '_' + rng.to + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); } catch { say('تعذّر توليد Excel', 'no'); } };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>ربحية الفروع اليومية</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>صافي المبيعات − الطعام − العمالة − العمولات والرسوم − الثابتة = هامش الفرع</div></div>
        <div className="rp-seg">{P.enabled && <button className="btn sm" onClick={exportX}><Download size={13} />Excel</button>}{canCfg && <button className={'btn sm' + (cfgOpen ? ' pri' : '')} onClick={() => setCfgOpen(v => !v)}><Settings size={13} />إعدادات الربحية</button>}</div>
      </div>

      {cfgOpen && canCfg && <div className="card">
        <div className="card-h"><div className="card-t"><Settings size={15} color="var(--brass)" />إعدادات الربحية — كل طريقة قرارك، لا افتراضيات</div><button className="btn sm pri" onClick={save}><Check size={13} />حفظ</button></div>
        <div className="grid g2" style={{ gap: 10 }}>
          {sel('foodBasis', '1. أساس تكلفة الطعام')}{sel('laborBasis', '2. أساس تكلفة العمالة')}
          {sel('alloc', '3. توزيع التكاليف الشهرية (الثابتة، والرواتب إن اخترتها) على الأيام')}
          <div className="grid g2" style={{ gap: 8 }}>{sel('cardFee', '4. رسوم الشبكة')}{d.cardFee === 'flat' && <Field label="النسبة % (كما في عقد البنك)"><input className="inp n" inputMode="decimal" value={d.cardRate} onChange={e => setK('cardRate', e.target.value.replace(/[^\d.]/g, ''))} /></Field>}</div>
        </div>
        {d.foodBasis === 'purchases' && <><div className="lbl" style={{ marginTop: 8 }}>تصنيفات مصروفات الإغلاق التي تُعدّ مواد طعام</div>
          <div className="pf-chips">{cats.map(c => <label key={c.id} className={'pf-chip' + ((d.foodCats || []).includes(c.id) ? ' on' : '')}><input type="checkbox" checked={(d.foodCats || []).includes(c.id)} onChange={() => tog('foodCats', c.id)} />{c.n}</label>)}</div>
          {(org.suppliers || []).length > 0 && <><div className="lbl">موردو المواد (فواتيرهم المسجلة للفرع تُحسب في يومها)</div>
          <div className="pf-chips">{(org.suppliers || []).map(s => <label key={s.id} className={'pf-chip' + ((d.foodSuppliers || []).includes(s.id) ? ' on' : '')}><input type="checkbox" checked={(d.foodSuppliers || []).includes(s.id)} onChange={() => tog('foodSuppliers', s.id)} />{s.name}</label>)}</div></>}</>}
        <div className="lbl" style={{ marginTop: 8 }}>التكاليف الثابتة الشهرية لكل فرع (عقود الإيجار في «مركز المستندات» تُحسب تلقائيًا — لا تكررها هنا)</div>
        <div className="pf-fixed">{(d.fixed || []).map((x, i) => <div key={x.id} className="pf-frow">
          <select className="inp sel" value={x.branchId} onChange={e => setD(y => ({ ...y, fixed: y.fixed.map((z, j) => j === i ? { ...z, branchId: e.target.value } : z) }))}><option value="">— الفرع —</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <input className="inp" placeholder="البند (كهرباء، اشتراكات…)" value={x.label} onChange={e => setD(y => ({ ...y, fixed: y.fixed.map((z, j) => j === i ? { ...z, label: e.target.value } : z) }))} />
          <input className="inp n" inputMode="decimal" placeholder="شهريًا" value={x.amount} onChange={e => setD(y => ({ ...y, fixed: y.fixed.map((z, j) => j === i ? { ...z, amount: e.target.value.replace(/[^\d.]/g, '') } : z) }))} />
          <button className="btn sm gh" aria-label="حذف" onClick={() => setD(y => ({ ...y, fixed: y.fixed.filter((_, j) => j !== i) }))}><Trash2 size={13} /></button></div>)}</div>
        <button className="btn sm gh" style={{ marginTop: 6 }} onClick={() => setD(y => ({ ...y, fixed: [...(y.fixed || []), { id: uid('pf'), branchId: '', label: '', amount: '' }] }))}><Plus size={13} />بند ثابت</button>
        <div className="lbl" style={{ marginTop: 10 }}>5. الأهداف % من صافي المبيعات (اختيارية){refTot ? ' — متوسطك الفعلي آخر 30 يومًا بهذه الإعدادات بجانب كل خانة' : ''}</div>
        <div className="grid g3" style={{ gap: 8 }}>{Object.entries(TG).map(([k, l]) => <Field key={k} label={l + (refTot && refTot[k] != null ? ' — فعليك ' + refTot[k].toFixed(1) + '%' : '')}><input className="inp n" inputMode="decimal" value={(d.targets || {})[k] || ''} onChange={e => setD(y => ({ ...y, targets: { ...(y.targets || {}), [k]: e.target.value.replace(/[^\d.]/g, '') } }))} /></Field>)}</div>
        <label className="row" style={{ gap: 6, marginTop: 10, fontSize: 13 }}><input type="checkbox" checked={!!d.enabled} disabled={!!draftMissing.length} onChange={e => setK('enabled', e.target.checked)} /><b>تفعيل لوحة الربحية</b>{draftMissing.length ? <small style={{ color: 'var(--amber)' }}> — أكمل: {draftMissing.join('، ')}</small> : null}</label>
      </div>}

      {!P.enabled ? <div className="card"><div className="empty">{P.missing.length ? 'اللوحة موقوفة — أكمل في «إعدادات الربحية»: ' + P.missing.join('، ') : 'اللوحة موقوفة — فعّلها من «إعدادات الربحية»'}</div></div> : <>
        <div className="rp-seg">{periods.map(([k, l, f, t]) => <button key={k} className={'btn sm' + (rng.k === k ? ' pri' : ' gh')} onClick={() => setRng({ k, from: f, to: t })}>{l}</button>)}</div>
        {P.branches.map(b => { const t = b.tot; return (
          <div key={b.id} className="card pf-br">
            <div className="card-h"><div className="card-t"><TrendingUp size={15} color="var(--brass)" />{b.name}</div>
              <span className={'badge ' + (t.margin == null ? 'b-dim' : t.margin >= 0 ? 'b-mint' : 'b-rose')}>{t.margin == null ? (t.days ? 'ناقص ' + t.naDays + ' يوم' : 'لا مبيعات') : 'الهامش ' + money(t.margin) + ' · ' + pct(t.marginPct)}</span></div>
            {!t.days ? <div className="empty">لا مبيعات في الفترة.</div> : <>
              <div className="pf-grid">
                <div className="pf-c"><small>صافي المبيعات</small><b className="num">{money(t.net)}</b></div>
                <div className={'pf-c' + flag(t.foodPct, 'food')}><small>{TG.food}</small><b className="num">{t.food == null ? 'غير متاح' : money(t.food)}</b><span>{pct(t.foodPct)}{tgt.food ? ' / هدف ' + tgt.food + '%' : ''}</span></div>
                <div className={'pf-c' + flag(t.laborPct, 'labor')}><small>{TG.labor}</small><b className="num">{t.labor == null ? 'غير متاح' : money(t.labor)}</b><span>{pct(t.laborPct)}{tgt.labor ? ' / هدف ' + tgt.labor + '%' : ''}</span></div>
                <div className={'pf-c' + flag(t.primePct, 'prime')}><small>التكلفة الأساسية</small><b className="num">{pct(t.primePct)}</b><span>{tgt.prime ? 'هدف ' + tgt.prime + '%' : 'طعام + عمالة'}</span></div>
                <div className="pf-c"><small>عمولات ورسوم</small><b className="num">{money(t.comm + t.card)}</b><span>تطبيقات {money(t.comm)} · شبكة {money(t.card)}</span></div>
                <div className="pf-c"><small>الثابتة الموزّعة</small><b className="num">{money(t.fixed)}</b><span>{PROFIT_OPTS.alloc[saved.alloc]}</span></div>
              </div>
              {t.usageGapPct != null && <div className={'cf-note ' + (t.usageGapPct > 5 ? 'warn' : 'info')}><span className="badge b-amber">رقابة</span><span>الاستهلاك الفعلي أعلى من النظري بـ {t.usageGapPct}% ({money(t.food - t.theo)}) — فاقد غير مسجّل أو وصفة غير دقيقة</span></div>}
              {b.notes.map((n, i) => <div key={i} className="cf-note info"><span className="badge b-dim">معلومة</span><span>{n}</span></div>)}
              <button type="button" className="cf-wh" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}><span className="card-t" style={{ fontSize: 12.5 }}>يومًا بيوم</span><ChevronDown size={14} className="cf-chev" /></button>
              {open === b.id && <div className="pf-days">{b.days.filter(x => x.gross > 0).map(x => <div key={x.date} className={'pf-day' + (x.margin == null ? ' na' : x.margin < 0 ? ' neg' : '')}>
                <span className="pf-a"><b className="dt">{arDate(x.date)}</b><small>{x.src === 'import' ? 'من الاستيراد' : 'إغلاق'} · صافي {money(x.net)}</small>{Object.values(x.na).filter((v, i, a) => a.indexOf(v) === i).map(v => <small key={v} style={{ color: 'var(--amber)' }}>{v}</small>)}</span>
                <span className="pf-b"><small>طعام {pct(x.foodPct)} · عمالة {pct(x.laborPct)}</small><b className="num" dir="ltr">{x.margin == null ? '—' : money(x.margin)}</b></span></div>)}</div>}
            </>}
          </div>); })}
        <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>المنهج (إعداداتك):</b> الطعام: {PROFIT_OPTS.foodBasis[saved.foodBasis]} · العمالة: {PROFIT_OPTS.laborBasis[saved.laborBasis]} (الأجر والبدلات وحصة صاحب العمل في التأمينات) · التوزيع: {PROFIT_OPTS.alloc[saved.alloc]} · الشبكة: {PROFIT_OPTS.cardFee[saved.cardFee]}{saved.cardFee === 'flat' ? ' ' + saved.cardRate + '%' : ''}.
          الإيراد بعد استبعاد ضريبة القيمة المضافة، ومشتريات المواد بعد استبعاد ضريبتها القابلة للخصم. الأيام المستوردة بلا إغلاق تظهر، لكن ما لا تعرفه بياناتها يبقى «غير متاح».
          {saved.alloc === 'operating' || saved.alloc === 'sales' ? ' في الشهر الجاري يُوزَّع المبلغ الشهري على ما مضى منه، فتظهر الأيام الأولى أثقل حتى يكتمل الشهر.' : ''} الإهلاك ومكافأة نهاية الخدمة خارج الهامش اليومي.</div>
      </>}
    </div>);
}
