/* v48.0 — SMART POS GROWTH «التسويق والنمو الذكي» — المرحلتان C (الأساس والصلاحيات) وD (ملفات العملاء والشرائح)
   القراءة فقط من طلبات نقطة البيع ودفتر الولاء؛ الكتابة في mktConsents وmktMerges وorg.mkt، وحركات دمج النقاط في دفتر الولاء نفسه (إلحاق فقط). */
import React, { useState, useEffect, useMemo } from 'react';
import { cloud, KEYS } from '../../storage';
import { Target, Users, Grid3x3 as Layers, ShieldCheck, Settings, Download, Users as UserCheck, RefreshCw as GitMerge } from 'lucide-react';
import { Field, Kpi, Modal, money, makeXlsx, today, nowISO, uid, normPhone, loyPost, ROLES,
  mktCfg, mktCanApprove, MKT_SEGS, MKT_SEG_ORDER, crmBuild, crmSegment, crmDupes, mktKpis, mktCanContact } from '../../App.jsx';

const CH = { all: 'كل القنوات', whatsapp: 'واتساب', sms: 'رسائل SMS', email: 'البريد', app: 'إشعارات التطبيق' };
const anDay = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dl = (name, rows) => { try { const blob = makeXlsx([{ name: name.slice(0, 30), rows }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch { /* */ } };

export function MktGrowth({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const [view, setView] = useState('dash');
  const [loy, setLoy] = useState(null);
  useEffect(() => { cloud.get(KEYS.loy, { members: {}, tx: [] }).then(d => setLoy(d || { members: {}, tx: [] })).catch(() => setLoy({ members: {}, tx: [] })); }, []);
  const R = ROLES[(me || {}).role] || {}; const central = R.scope === 'all' || R.admin;
  const brIds = (myBranches || []).map(b => b.id);
  const cfg = mktCfg(org); const canApp = mktCanApprove(me);
  const list = useMemo(() => crmSegment(crmBuild(org, ops, loy, { branches: central ? null : brIds }), cfg, today()), [org, ops, loy, central, brIds.join(',')]);
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  const [sel, setSel] = useState(null);
  const V = [['dash', 'لوحة التسويق', Target], ['crm', 'ملفات العملاء', Users], ['seg', 'الشرائح', Layers], ['gov', 'الموافقات والتكرار', ShieldCheck], ['cfg', 'الإعدادات', Settings]];
  return (
    <div className="grid" style={{ gap: 12 }} data-mkt>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="أقسام التسويق">
        {V.map(([k, ar, I]) => <button key={k} role="tab" aria-selected={view === k} className={'btn sm' + (view === k ? ' pri' : ' gh')} data-mktv={k} onClick={() => setView(k)}><I size={14} />{ar}</button>)}
      </div>
      {!loy && <div className="empty">جارٍ تحميل دفتر الولاء…</div>}
      {loy && view === 'dash' && <Dash org={org} ops={ops} list={list} brIds={central ? null : brIds} myBranches={myBranches} brName={brName} />}
      {loy && view === 'crm' && <Crm list={list} brName={brName} onOpen={setSel} />}
      {loy && view === 'seg' && <Seg list={list} cfg={cfg} />}
      {loy && view === 'gov' && <Gov list={list} ops={ops} me={me} canApp={canApp} commit={commit} say={say} setLoy={setLoy} />}
      {view === 'cfg' && <Cfg cfg={cfg} canApp={canApp} commitOrg={commitOrg} say={say} />}
      {sel && <Profile c={list.find(x => x.id === sel)} brName={brName} me={me} commit={commit} say={say} onClose={() => setSel(null)} />}
    </div>);
}

function Dash({ org, ops, list, brIds, myBranches, brName }) {
  const [to, setTo] = useState(today()); const [from, setFrom] = useState(anDay(today(), -29)); const [br, setBr] = useState('');
  const scope = br ? [br] : brIds;
  const K = useMemo(() => mktKpis(org, ops, list, { from, to, branches: scope }), [org, ops, list, from, to, br, (brIds || []).join(',')]);
  const perBr = useMemo(() => (myBranches || []).map(b => ({ b, k: mktKpis(org, ops, [], { from, to, branches: [b.id] }) })).filter(x => x.k.orders > 0).sort((a, b) => b.k.sales - a.k.sales), [org, ops, from, to, myBranches]);
  const na = 'تُفعَّل في مرحلة لاحقة';
  return (<>
    <div className="card row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Field label="من"><input type="date" className="inp" aria-label="من تاريخ" value={from} onChange={e => setFrom(e.target.value)} /></Field>
      <Field label="إلى"><input type="date" className="inp" aria-label="إلى تاريخ" value={to} onChange={e => setTo(e.target.value)} /></Field>
      <Field label="الفرع"><select className="sel" aria-label="فرع اللوحة" value={br} onChange={e => setBr(e.target.value)}><option value="">كل فروعي</option>{(myBranches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <span className="hint">المقارنة مع الفترة السابقة بالطول نفسه · كل الأرقام من طلبات نقطة البيع الفعلية</span>
    </div>
    <div className="grid g4" data-mktkpis>
      <Kpi label="مبيعات نقطة البيع" value={money(K.sales)} sub={K.orders + ' طلب'} color="#2C6BC4" />
      <Kpi label="متوسط الفاتورة" value={money(K.aov)} sub={'معرَّف العميل: ' + K.idPct + '%'} color="#C8A24A" />
      <Kpi label="العملاء النشطون" value={String(K.active)} sub={K.newC + ' جديد · ' + K.returning + ' عائد'} color="#2f8a5b" />
      <Kpi label="الاحتفاظ بالعملاء" value={K.retention == null ? '—' : K.retention + '%'} sub={K.retention == null ? 'لا عملاء معرَّفون في الفترة السابقة' : 'من ' + K.prevActive + ' عميل في الفترة السابقة'} color="#5B93C4" />
      <Kpi label="غير نشطين" value={String(K.inactive)} sub={'معرّضون للانقطاع: ' + K.risk} color="#D95C4F" />
      <Kpi label="كبار العملاء" value={String(K.vip)} sub="حسب قواعد الشرائح" color="#C8A24A" />
      <Kpi label="موافقون على التسويق" value={String(K.consentIn)} sub={'من ' + list.length + ' عميل'} color="#2f8a5b" />
      <Kpi label="الحملات والكوبونات والعائد" value="—" sub={na} color="#8A94A6" />
    </div>
    <div className="card">
      <div className="card-t">مقارنة الفروع — الفترة المختارة</div>
      <div className="tw"><table className="tb" data-mktbr><thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>الطلبات</th><th style={{ textAlign: 'end' }}>المبيعات</th><th style={{ textAlign: 'end' }}>متوسط الفاتورة</th><th style={{ textAlign: 'end' }}>تعريف العميل</th><th style={{ textAlign: 'end' }}>عملاء نشطون</th></tr></thead>
        <tbody>{perBr.map(({ b, k }) => <tr key={b.id}><td>{b.name}</td><td className="num" style={{ textAlign: 'end' }}>{k.orders}</td><td className="num" style={{ textAlign: 'end' }}>{money(k.sales)}</td><td className="num" style={{ textAlign: 'end' }}>{money(k.aov)}</td><td className="num" style={{ textAlign: 'end' }}>{k.idPct}%</td><td className="num" style={{ textAlign: 'end' }}>{k.active}</td></tr>)}
          {!perBr.length && <tr><td colSpan={6}><div className="empty">لا طلبات نقطة بيع في الفترة.</div></td></tr>}</tbody></table></div>
      <div className="note" style={{ marginTop: 8 }}>«تعريف العميل» = نسبة الطلبات التي أُدخل فيها جوال العميل. كلما ارتفعت صار تحليل العملاء أدق.</div>
    </div>
    <div className="card" data-mktroadmap>
      <div className="card-t">مراحل الوحدة</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>✓ الأساس والصلاحيات · ✓ ملفات العملاء والشرائح والموافقات · ○ الولاء المتقدم والكوبونات · ○ الحملات والاعتماد · ○ اقتراحات البيع عند الدفع · ○ تقارير الفروع والربحية · ○ قنوات التواصل · ○ المساعد الذكي</div>
    </div>
  </>);
}

function Crm({ list, brName, onOpen }) {
  const [q, setQ] = useState(''); const [cls, setCls] = useState(''); const [sort, setSort] = useState('net');
  const qn = q.trim(), qp = normPhone(q);
  const rows = list.filter(c => (!cls || c.cls === cls || c.tags.includes(cls)) && (!qn || (c.name || '').includes(qn) || (qp && c.phone.includes(qp))))
    .sort((a, b) => sort === 'last' ? String(b.last).localeCompare(String(a.last)) : sort === 'n' ? b.n - a.n : b.net - a.net);
  return (<div className="card">
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
      <input className="inp" style={{ maxWidth: 260 }} placeholder="ابحث بالاسم أو الجوال" value={q} onChange={e => setQ(e.target.value)} />
      <select className="sel" style={{ width: 180 }} aria-label="تصفية الشريحة" value={cls} onChange={e => setCls(e.target.value)}><option value="">كل الشرائح</option>{MKT_SEG_ORDER.map(k => <option key={k} value={k}>{MKT_SEGS[k].ar}</option>)}</select>
      <select className="sel" style={{ width: 160 }} aria-label="ترتيب العملاء" value={sort} onChange={e => setSort(e.target.value)}><option value="net">الأعلى إنفاقًا</option><option value="n">الأكثر زيارة</option><option value="last">الأحدث شراءً</option></select>
      <span className="badge b-dim">{rows.length} عميل</span>
    </div>
    <div className="tw"><table className="tb" data-crmtable><thead><tr><th>العميل</th><th>الشريحة</th><th style={{ textAlign: 'end' }}>الزيارات</th><th style={{ textAlign: 'end' }}>صافي المشتريات</th><th style={{ textAlign: 'end' }}>متوسط الفاتورة</th><th>آخر شراء</th><th>الفرع المفضل</th><th style={{ textAlign: 'end' }}>النقاط</th><th>الموافقة</th></tr></thead>
      <tbody>{rows.slice(0, 400).map(c => <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(c.id)} data-crmrow={c.phone}>
        <td>{c.name || '—'}<div className="num" style={{ fontSize: 10.5, color: 'var(--faint)' }}>{c.phone}</div></td>
        <td><span className={'badge ' + MKT_SEGS[c.cls].c}>{MKT_SEGS[c.cls].ar}</span></td>
        <td className="num" style={{ textAlign: 'end' }}>{c.n}</td><td className="num" style={{ textAlign: 'end' }}>{money(c.net)}</td><td className="num" style={{ textAlign: 'end' }}>{money(c.avg)}</td>
        <td className="num">{c.last || '—'}{c.daysSince != null && <div style={{ fontSize: 10, color: 'var(--faint)' }}>قبل {c.daysSince} يوم</div>}</td>
        <td>{c.branches[0] ? brName(c.branches[0].id) : '—'}</td><td className="num" style={{ textAlign: 'end' }}>{c.pts}</td>
        <td>{mktCanContact(c.consent, 'any') ? <span className="badge b-mint">موافق</span> : c.consent.all === 'out' ? <span className="badge b-rose">ألغى الاشتراك</span> : <span className="badge b-dim">غير مسجّلة</span>}</td></tr>)}
        {!rows.length && <tr><td colSpan={9}><div className="empty">لا عملاء — يُعرَّف العميل بإدخال جواله في نقطة البيع.</div></td></tr>}</tbody></table></div>
  </div>);
}

function Profile({ c, brName, me, commit, say, onClose }) {
  const [f, setF] = useState({ status: 'in', ch: 'all', src: 'نقطة البيع', note: '' });
  if (!c) return null;
  const rec = async () => {
    const x = { id: uid('mc'), phone: c.phone, status: f.status, ch: f.ch, src: f.src.trim() || '—', ...(f.note.trim() ? { note: f.note.trim() } : {}), by: me.name, byId: me.id || '', at: nowISO() };
    const ok = await commit(d => ({ ...d, mktConsents: [...(d.mktConsents || []), x] }), { actionType: 'create', targetType: 'customer', targetId: c.phone, need: 'edit', title: x.status === 'in' ? 'سجّل موافقة تسويقية' : 'سجّل إلغاء اشتراك تسويقي', details: c.phone + ' · ' + CH[x.ch] + ' · ' + x.src });
    if (ok) say(x.status === 'in' ? 'سُجّلت الموافقة ✓' : 'سُجّل إلغاء الاشتراك فورًا ✓');
  };
  return (<Modal title={(c.name || 'عميل') + ' — ' + c.phone} icon={UserCheck} onClose={onClose} wide>
    <div data-crmprofile>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}><span className={'badge ' + MKT_SEGS[c.cls].c}>{MKT_SEGS[c.cls].ar}</span>{c.tags.filter(t => t !== c.cls).map(t => <span key={t} className={'badge ' + MKT_SEGS[t].c}>{MKT_SEGS[t].ar}</span>)}{c.b2b && <span className="badge b-sky">مرتبط بعميل آجل: {c.b2b.name}</span>}{c.aliases.length > 0 && <span className="badge b-dim">مدموج من: {c.aliases.join('، ')}</span>}</div>
      <div className="grid g3" style={{ marginBottom: 10 }}>
        {[['أول ظهور', c.since || c.first || '—'], ['آخر شراء', c.last ? c.last + ' (قبل ' + c.daysSince + ' يوم)' : '—'], ['عدد الزيارات', c.n + (c.gapDays != null ? ' · كل ' + c.gapDays + ' يوم تقريبًا' : '')], ['إجمالي المشتريات', money(c.total) + (c.ret ? ' (مرتجع ' + money(c.ret) + ')' : '')], ['متوسط الفاتورة', money(c.avg)], ['رصيد النقاط', String(c.pts)]].map(([k, v]) =>
          <div key={k} className="mono-b"><span>{k}</span><b className="num">{v}</b></div>)}
      </div>
      <div className="grid g2">
        <div className="card"><div className="card-t">الأكثر شراءً</div>{c.top.length ? <table className="tb" style={{ fontSize: 12 }}><tbody>{c.top.map(p => <tr key={p.id}><td>{p.name}</td><td className="num" style={{ textAlign: 'end' }}>{p.qty}</td><td className="num" style={{ textAlign: 'end' }}>{money(p.amt)}</td></tr>)}</tbody></table> : <div className="empty">—</div>}</div>
        <div className="card"><div className="card-t">الفروع</div>{c.branches.length ? <table className="tb" style={{ fontSize: 12 }}><tbody>{c.branches.map(b => <tr key={b.id}><td>{brName(b.id)}</td><td className="num" style={{ textAlign: 'end' }}>{b.n} زيارة</td></tr>)}</tbody></table> : <div className="empty">—</div>}</div>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="card-t">الموافقة التسويقية (سجل غير قابل للتعديل)</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="الحالة"><select className="sel" aria-label="حالة الموافقة" value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}><option value="in">موافق على استلام التسويق</option><option value="out">إلغاء الاشتراك</option></select></Field>
          <Field label="القناة"><select className="sel" aria-label="قناة الموافقة" value={f.ch} onChange={e => setF(x => ({ ...x, ch: e.target.value }))}>{Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="المصدر/الإثبات"><input className="inp" aria-label="مصدر الموافقة" value={f.src} onChange={e => setF(x => ({ ...x, src: e.target.value }))} /></Field>
          <button className="btn pri sm" data-consent-save onClick={rec}>تسجيل</button>
        </div>
        <table className="tb" style={{ fontSize: 12, marginTop: 8 }} data-consent-hist><tbody>{c.consent.hist.slice().reverse().map(h => <tr key={h.id}><td className="num">{String(h.at).slice(0, 16).replace('T', ' ')}</td><td>{h.status === 'in' ? 'موافقة' : 'إلغاء اشتراك'}</td><td>{CH[h.ch] || h.ch}</td><td>{h.src}</td><td>{h.by}</td></tr>)}
          {!c.consent.hist.length && <tr><td><div className="empty">لا موافقة مسجّلة — لا يُراسَل تسويقيًا.</div></td></tr>}</tbody></table>
      </div>
    </div>
  </Modal>);
}

function Seg({ list, cfg }) {
  const cnt = {}; const tagCnt = {}; list.forEach(c => { cnt[c.cls] = (cnt[c.cls] || 0) + 1; c.tags.forEach(t => { tagCnt[t] = (tagCnt[t] || 0) + 1; }); });
  const S = cfg.seg;
  const RULE = { vip: 'صافي مشترياته ≥ ' + money(S.vipSpend) + ' أو ضمن أعلى ' + S.vipTopPct + '% إنفاقًا', loyal: S.loyalVisits + ' زيارات فأكثر خلال ' + S.loyalDays + ' يومًا', risk: S.riskMinVisits + ' زيارات فأكثر وآخرها قبل أكثر من ' + S.riskDays + ' يومًا', inactive: 'لا شراء منذ أكثر من ' + S.inactiveDays + ' يومًا',
    potential: 'زيارة أو زيارتان ومتوسط فاتورته ≥ ' + S.potMult + '× المتوسط العام', new: 'أول ظهور خلال ' + S.newDays + ' يومًا', regular: 'ما عدا ذلك' };
  const exp = (k, onlyOk) => { const L = list.filter(c => (c.cls === k || c.tags.includes(k)) && (!onlyOk || mktCanContact(c.consent, 'any')));
    dl('شريحة_' + MKT_SEGS[k].ar, [['الجوال', 'الاسم', 'الشريحة', 'الزيارات', 'صافي المشتريات', 'آخر شراء', 'الموافقة'], ...L.map(c => [c.phone, c.name, MKT_SEGS[c.cls].ar, c.n, c.net, c.last, mktCanContact(c.consent, 'any') ? 'موافق' : 'غير مسجّلة'])]); };
  return (<div className="card">
    <div className="card-t">الشرائح — تصنيف رئيسي واحد لكل عميل بالأولوية، وقد يحمل وسومًا أخرى</div>
    <div className="tw"><table className="tb" data-segtable><thead><tr><th>الشريحة</th><th>القاعدة</th><th style={{ textAlign: 'end' }}>تصنيف رئيسي</th><th style={{ textAlign: 'end' }}>يحمل الوسم</th><th /></tr></thead>
      <tbody>{MKT_SEG_ORDER.map(k => <tr key={k} data-seg={k}><td><span className={'badge ' + MKT_SEGS[k].c}>{MKT_SEGS[k].ar}</span></td><td style={{ fontSize: 12 }}>{RULE[k]}</td><td className="num" style={{ textAlign: 'end' }}>{cnt[k] || 0}</td><td className="num" style={{ textAlign: 'end' }}>{k === 'regular' ? '—' : (tagCnt[k] || 0)}</td>
        <td><button className="btn sm gh" onClick={() => exp(k, true)} title="الموافقون على التسويق فقط"><Download size={12} />تصدير المسموح بمراسلتهم</button></td></tr>)}</tbody></table></div>
    <div className="note" style={{ marginTop: 8 }}>التصدير يشمل الموافقين على التسويق فقط حمايةً للبيانات. القواعد تُضبط من «الإعدادات».</div>
  </div>);
}

function Gov({ list, ops, me, canApp, commit, say, setLoy }) {
  const groups = crmDupes(list); const [mg, setMg] = useState(null);
  const doMerge = async () => {
    if (!canApp) return say('دمج العملاء يتطلب صلاحية الاعتماد', 'no');
    const from = list.find(c => c.id === mg.from), to = list.find(c => c.id === mg.to);
    if (!from || !to || from.id === to.id) return say('اختر عميلين مختلفين', 'no'); if (!(mg.reason || '').trim()) return say('اكتب سبب الدمج والتحقق', 'no');
    const id = uid('mg'); const x = { id, from: from.phone, to: to.phone, reason: mg.reason.trim(), pts: from.pts, by: me.name, byId: me.id || '', at: nowISO() };
    if (from.pts) { const r = await loyPost([{ id: id + ':o', phone: from.phone, pts: -from.pts, at: x.at, br: '', ord: 'دمج إلى ' + to.phone }, { id: id + ':i', phone: to.phone, name: to.name, pts: from.pts, at: x.at, br: '', ord: 'دمج من ' + from.phone }]);
      if (!r) return say('تعذّر نقل النقاط — تحقق من الاتصال ولم يتم الدمج', 'no'); setLoy(r); }
    const ok = await commit(d => ({ ...d, mktMerges: [...(d.mktMerges || []), x] }), { actionType: 'approve', targetType: 'customer', targetId: to.phone, need: 'edit', title: 'دمج ملف عميل مكرر', details: from.phone + ' ← ' + to.phone + ' · ' + x.reason });
    if (ok) { setMg(null); say('دُمج الملف ونُقلت ' + from.pts + ' نقطة ✓'); }
  };
  const optOut = list.filter(c => c.consent.all === 'out').length, optIn = list.filter(c => mktCanContact(c.consent, 'any')).length;
  return (<>
    <div className="grid g3">
      <Kpi label="موافقون على التسويق" value={String(optIn)} sub="بسجل إثبات" color="#2f8a5b" />
      <Kpi label="ألغوا الاشتراك" value={String(optOut)} sub="يُستبعدون فورًا من أي حملة" color="#D95C4F" />
      <Kpi label="بلا موافقة مسجّلة" value={String(list.length - optIn - optOut)} sub="لا يُراسَلون تسويقيًا" color="#8A94A6" />
    </div>
    <div className="card">
      <div className="card-t"><GitMerge size={15} />احتمالات التكرار — لا دمج تلقائي</div>
      <div className="note" style={{ marginBottom: 8 }}>الهوية في نقطة البيع هي الجوال؛ هنا أسماء متطابقة بجوالات مختلفة. الدمج يدوي، بسبب مكتوب، لمن له صلاحية الاعتماد، وتنتقل النقاط بحركة في دفتر الولاء.</div>
      {groups.map(g => <div key={g.key} className="mono-b" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 6 }} data-dupe>
        <span>{g.name}: {g.items.map(c => c.phone + ' (' + c.n + ' زيارة)').join(' · ')}</span>
        {canApp && <button className="btn sm gh" data-merge onClick={() => setMg({ from: g.items[1].id, to: g.items[0].id, reason: '' })}>دمج…</button>}</div>)}
      {!groups.length && <div className="empty">لا احتمالات تكرار.</div>}
    </div>
    {mg && <Modal title="دمج ملفي عميل" icon={GitMerge} onClose={() => setMg(null)} foot={<><button className="btn pri" data-merge-save onClick={doMerge}>دمج</button><button className="btn gh" onClick={() => setMg(null)}>إلغاء</button></>}>
      <div className="grid g2">
        <Field label="من (يُدمج ويختفي)"><select className="sel" aria-label="دمج من" value={mg.from} onChange={e => setMg(m => ({ ...m, from: e.target.value }))}>{list.map(c => <option key={c.id} value={c.id}>{c.phone} — {c.name}</option>)}</select></Field>
        <Field label="إلى (يبقى)"><select className="sel" aria-label="دمج إلى" value={mg.to} onChange={e => setMg(m => ({ ...m, to: e.target.value }))}>{list.map(c => <option key={c.id} value={c.id}>{c.phone} — {c.name}</option>)}</select></Field>
      </div>
      <Field label="السبب والتحقق (إلزامي)"><input className="inp" aria-label="سبب الدمج" value={mg.reason} onChange={e => setMg(m => ({ ...m, reason: e.target.value }))} placeholder="تأكدنا من العميل هاتفيًا أن الرقمين له" /></Field>
    </Modal>}
  </>);
}

function Cfg({ cfg, canApp, commitOrg, say }) {
  const [S, setS] = useState(() => ({ ...cfg.seg, approveDiscPct: cfg.approveDiscPct }));
  const F = [['vipSpend', 'VIP: حد صافي المشتريات (ر.س)'], ['vipTopPct', 'VIP: أعلى نسبة إنفاقًا (%)'], ['loyalVisits', 'الأوفياء: عدد الزيارات'], ['loyalDays', 'الأوفياء: خلال (يوم)'], ['newDays', 'الجدد: خلال (يوم)'],
    ['riskDays', 'المعرّضون: انقطاع أكثر من (يوم)'], ['riskMinVisits', 'المعرّضون: زيارات سابقة على الأقل'], ['inactiveDays', 'غير النشطين: انقطاع أكثر من (يوم)'], ['potMult', 'الواعدون: مضاعف متوسط الفاتورة'], ['potMaxVisits', 'الواعدون: زيارات حتى'], ['approveDiscPct', 'خصم يتطلب اعتمادًا فوق (%)']];
  const save = async () => {
    const seg = {}; for (const [k] of F) { const v = Number(S[k]); if (!(v >= 0)) return say('قيمة غير صالحة', 'no'); if (k !== 'approveDiscPct') seg[k] = v; }
    const ok = await commitOrg(g => ({ ...g, mkt: { ...(g.mkt || {}), seg, approveDiscPct: Number(S.approveDiscPct) } }), { actionType: 'update', targetType: 'settings', targetId: 'mkt', need: 'edit', title: 'عدّل إعدادات التسويق والشرائح', details: JSON.stringify(seg) });
    if (ok !== false) say('حُفظت إعدادات التسويق ✓');
  };
  return (<div className="card" data-mktcfg>
    <div className="card-t">قواعد الشرائح والضوابط</div>
    {!canApp && <div className="note" style={{ marginBottom: 8 }}>للاطلاع فقط — التعديل لمن له صلاحية الاعتماد.</div>}
    <div className="grid g3">{F.map(([k, ar]) => <Field key={k} label={ar}><input className="inp n" inputMode="decimal" aria-label={ar} disabled={!canApp} value={S[k]} onChange={e => setS(x => ({ ...x, [k]: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>)}</div>
    {canApp && <button className="btn pri" style={{ marginTop: 8 }} data-mktcfg-save onClick={save}>حفظ</button>}
    <div className="note" style={{ marginTop: 8 }}>التسويق يتطلب موافقة صريحة مسجّلة لكل عميل (لا يُعطَّل). الأرقام أمثلة ابتدائية وليست قواعد ثابتة.</div>
  </div>);
}
