/* v48.0 — SMART POS GROWTH «التسويق والنمو الذكي» — المرحلتان C (الأساس والصلاحيات) وD (ملفات العملاء والشرائح)
   القراءة فقط من طلبات نقطة البيع ودفتر الولاء؛ الكتابة في mktConsents وmktMerges وorg.mkt، وحركات دمج النقاط في دفتر الولاء نفسه (إلحاق فقط). */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cloud, KEYS } from '../../storage';
import { Target, Users, Grid3x3 as Layers, ShieldCheck, Settings, Download, Users as UserCheck, RefreshCw as GitMerge } from 'lucide-react';
import { Field, Kpi, Modal, money, makeXlsx, today, nowISO, uid, normPhone, loyPost, ROLES,
  mktCfg, mktCanApprove, MKT_SEGS, MKT_SEG_ORDER, crmBuild, crmSegment, crmDupes, mktKpis, mktCanContact,
  loyX, loyTier, loyPeriodicTx, mktProfiles, rewardCoupon, cpnKey, posR2, CAMP_ST, campNextNo, campStatusOf, campStats, buildAccounting, recCfgOf, recStats, dtLocal, brReport, printScreen, AI_GROWTH_PRESETS, growthDigest, aiGrowthAsk, COMMS_PROVIDERS, COMMS_CH, COMMS_VARS, commsCfgOf, commsRender, smsParts, commsTplErr, loyAudit, LOY_AUDIT_WHY,
  logAudit, MKT_RW_KEY, rwPendSplit, rwUndoTx, mktUnmergeBlock, mktBrOn, mktRecBranch, mktMergesLive, loyGet, mkmSrcOn, mkmWrite , aiCentralOk } from '../../App.jsx';
import { mktCtlOn, mktCanExport, mktCanExportAll, mktUndoPending } from '../../App.jsx';   // v56.35 الدفعة 4
import { Megaphone, Sparkles, Building2, Bot, MessageSquare } from 'lucide-react';
import { Gift, Gift as Ticket, Send } from 'lucide-react';
import { CommsJobs } from './CommsJobs.jsx';   // v56.50 دفعات الرسائل
import { commsSendOn, jeOwner } from '../../App.jsx';
import { posDiscOf } from '../../App.jsx';   // v56.56 خصومات الجزء المتساوي

const CH = { all: 'كل القنوات', whatsapp: 'واتساب', sms: 'رسائل SMS', email: 'البريد', app: 'إشعارات التطبيق' };
const anDay = (iso, k) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + k); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const rwPend = () => { try { const a = JSON.parse(localStorage.getItem(MKT_RW_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const rwPendSet = (a) => { try { if (a.length) localStorage.setItem(MKT_RW_KEY, JSON.stringify(a)); else localStorage.removeItem(MKT_RW_KEY); } catch { } };
const dl = (name, rows) => { try { const blob = makeXlsx([{ name: name.slice(0, 30), rows }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch { /* */ } };

export function MktGrowth({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const [view, setView] = useState('dash');
  const [loy, setLoy] = useState(null);
  useEffect(() => { loyGet(brIds, central).then(d => setLoy(d || { members: {}, tx: [] })).catch(() => setLoy({ members: {}, tx: [] })); }, []);   // v56.37: الأسماء المسموحة مدموجة إن فُصلت
  const R = ROLES[(me || {}).role] || {}; const central = R.scope === 'all' || R.admin;
  const brIds = (myBranches || []).map(b => b.id);
  const cfg = mktCfg(org); const canApp = mktCanApprove(me);
  const list = useMemo(() => crmSegment(crmBuild(org, ops, loy, { branches: central ? null : brIds }), cfg, today()), [org, ops, loy, central, brIds.join(',')]);
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  const [sel, setSel] = useState(null);
  // v56.12 (G1): رقم فرع سجل التسويق — فارغ والمفتاح معطّل ⇒ السلوك السابق (المستند المركزي)
  const brOn = mktBrOn(org); const bTag = (c) => { const b = mktRecBranch(brOn, central, c, brIds); return b ? { branchId: b } : {}; };
  // v56.12 (G5): استكمال استبدال جائزة انقطع بين خصم النقاط وإصدار الكوبون
  useEffect(() => { if (!loy || !canApp) return; const P = rwPend().filter(x => !x.uid || x.uid === (me.id || me.email || '')); if (!P.length) return; const { done, refund, wait } = rwPendSplit(P, org.posPromos, Date.now(), loy.tx);
    (async () => { const o2 = await cloud.get(KEYS.org, null).catch(() => null); const sp = o2 ? rwPendSplit(P, o2.posPromos, Date.now(), loy.tx) : { done, refund, wait }; const left = [...sp.wait]; const refund2 = sp.refund; if (refund2.length) { const r = await loyPost(refund2.map(x => rwUndoTx(x, nowISO()))); if (r) { setLoy(r); say('أُعيدت نقاط ' + refund2.length + ' استبدال لم يصدر كوبونه ✓'); logAudit({ actionType: 'update', targetType: 'customer', targetId: 'loyalty', title: 'أعاد نقاط استبدال لم يصدر كوبونه', details: refund2.map(x => x.phone + ' · ' + x.pts + ' · ' + x.code).join('، ') }).catch(() => { }); } else left.push(...refund2); }
      const others = rwPend().filter(x => !P.includes(x) && !P.some(y => y.txid === x.txid)); rwPendSet([...others, ...left]); void done; })(); }, [!!loy]);
  const V = [['dash', 'لوحة التسويق', Target], ['crm', 'ملفات العملاء', Users], ['seg', 'الشرائح', Layers], ['loy', 'الولاء والمكافآت', Gift], ['cpn', 'الكوبونات', Ticket], ['cmp', 'الحملات', Megaphone], ['rec', 'التوصيات', Sparkles], ['brr', 'تقارير الفروع', Building2], ['ai', 'المساعد الذكي', Bot], ['msg', 'الرسائل', Send], ['com', 'إعدادات التواصل', MessageSquare], ['gov', 'الموافقات والتكرار', ShieldCheck], ['cfg', 'الإعدادات', Settings]].filter(([k]) => k !== 'ai' || aiCentralOk(me));   // v56.59: المساعد الذكي للأدوار المركزية وحدها (الخادم يفرضه)
  return (
    <div className="grid" style={{ gap: 12 }} data-mkt>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="tablist" aria-label="أقسام التسويق">
        {V.map(([k, ar, I]) => <button key={k} role="tab" aria-selected={view === k} className={'btn sm' + (view === k ? ' pri' : ' gh')} data-mktv={k} onClick={() => setView(k)}><I size={14} />{ar}</button>)}
      </div>
      {!loy && <div className="empty">جارٍ تحميل دفتر الولاء…</div>}
      {!central && !brOn && <div className="note" data-mktbr-off>تسجيل الموافقات وبيانات العملاء والإحالات من الفرع يتطلب تفعيل «سجلات التسويق في الفروع» من صيانة النظام (للمركز).</div>}
      {!central && view === 'cmp' && <div className="note">الحملات تُخطط وتُعتمد من المركز.</div>}
      {loy && view === 'dash' && <Dash org={org} ops={ops} list={list} brIds={central ? null : brIds} myBranches={myBranches} brName={brName} />}
      {loy && view === 'crm' && <Crm list={list} brName={brName} onOpen={setSel} />}
      {loy && view === 'seg' && <Seg list={list} cfg={cfg} say={say} org={org} me={me} />}
      {loy && view === 'gov' && <Gov list={list} ops={ops} org={org} me={me} canApp={canApp && central} commit={commit} say={say} setLoy={setLoy} loyD={loy} />}
      {loy && view === 'loy' && <Loy org={org} ops={ops} loy={loy} setLoy={setLoy} canApp={canApp} me={me} commit={commit} commitOrg={commitOrg} say={say} bTag={bTag} list={list} />}
      {loy && view === 'cpn' && <Cpn org={org} ops={ops} loy={loy} canApp={canApp} me={me} commitOrg={commitOrg} say={say} brName={brName} />}
      {loy && view === 'cmp' && <Cmp org={org} ops={ops} list={list} canApp={canApp} me={me} commit={commit} commitOrg={commitOrg} say={say} brName={brName} />}
      {loy && view === 'ai' && aiCentralOk(me) && <Ai org={org} ops={ops} list={list} central={central} brIds={brIds} />}
      {view === 'com' && <Com org={org} me={me} canApp={canApp} commitOrg={commitOrg} say={say} />}
      {!central && view === 'msg' && <div className="note">دفعات الرسائل تُنشأ وتُعتمد من المركز.</div>}
      {loy && central && view === 'msg' && <CommsJobs org={org} ops={ops} loy={loy} me={me} commit={commit} say={say} canApp={canApp} />}
      {view === 'brr' && <Brr org={org} ops={ops} central={central} brIds={brIds} />}
      {view === 'rec' && <Rec org={org} ops={ops} central={central} brIds={brIds} myBranches={myBranches} canApp={canApp} commitOrg={commitOrg} say={say} />}
      {view === 'cfg' && <Cfg cfg={cfg} canApp={canApp} commitOrg={commitOrg} say={say} />}
      {sel && <Profile c={list.find(x => x.id === sel)} org={org} ops={ops} loy={loy} setLoy={setLoy} canApp={canApp} brName={brName} me={me} commit={commit} commitOrg={commitOrg} say={say} bTag={bTag} onClose={() => setSel(null)} />}
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
      <Kpi label="متوسط الفاتورة" value={money(K.aov)} sub={'معرَّف العميل: ' + K.idPct + '%'} color="#D9A83E" />
      <Kpi label="العملاء النشطون" value={String(K.active)} sub={K.newC + ' جديد · ' + K.returning + ' عائد'} color="#2f8a5b" />
      <Kpi label="الاحتفاظ بالعملاء" value={K.retention == null ? '—' : K.retention + '%'} sub={K.retention == null ? 'لا عملاء معرَّفون في الفترة السابقة' : 'من ' + K.prevActive + ' عميل في الفترة السابقة'} color="#5B93C4" />
      <Kpi label="غير نشطين" value={String(K.inactive)} sub={'معرّضون للانقطاع: ' + K.risk} color="#D95C4F" />
      <Kpi label="كبار العملاء" value={String(K.vip)} sub="حسب قواعد الشرائح" color="#D9A83E" />
      <Kpi label="موافقون على التسويق" value={String(K.consentIn)} sub={'من ' + list.length + ' عميل'} color="#2f8a5b" />
      <Kpi label="تكلفة التسويق والعائد" value="—" sub={na} color="#8A94A6" />
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
      <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>✓ الأساس والصلاحيات · ✓ ملفات العملاء والشرائح والموافقات · ✓ الولاء المتقدم والكوبونات · ✓ الحملات والاعتماد · ✓ اقتراحات البيع عند الدفع · ✓ تقارير الفروع والربحية · ○ قنوات التواصل (الإعدادات جاهزة — الإرسال بانتظار اعتماد المزوّد) · ✓ المساعد الذكي</div>
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

function Profile({ c, org, ops, loy, setLoy, canApp, brName, me, commit, commitOrg, say, bTag, onClose }) {
  const [f, setF] = useState({ status: 'in', ch: 'all', src: 'نقطة البيع', note: '' });
  const P0 = c ? (mktProfiles(ops)[c.phone] || {}) : {}; const [pf, setPf] = useState({ bday: P0.bday || '', email: P0.email || '' }); const [rw, setRw] = useState('');
  if (!c) return null;
  const X = loyX(org); const T = loyTier(org, loy, c.phone, today());
  const saveProf = async () => { const b = String(pf.bday || '').trim(); if (b && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b)) return say('عيد الميلاد بصيغة شهر-يوم مثل 04-21', 'no');
    const e = String(pf.email || '').trim(); if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return say('بريد غير صحيح', 'no');
    const ok = await commit(d => ({ ...d, mktProfiles: [...(d.mktProfiles || []), { id: uid('mp'), ...bTag(c), phone: c.phone, bday: b, email: e, by: me.name, at: nowISO() }] }), { actionType: 'update', targetType: 'customer', targetId: c.phone, need: 'edit', title: 'حدّث بيانات عميل', details: c.phone });
    if (ok) say('حُفظت بيانات العميل ✓'); };
  const redeem = async () => { const R0 = (X.rewards || []).find(r => r.id === rw); if (!R0) return say('اختر جائزة', 'no'); if (!canApp) return say('إصدار الجوائز لمن له صلاحية الاعتماد', 'no');
    if (c.pts < R0.pts) return say('الرصيد ' + c.pts + ' أقل من ' + R0.pts, 'no');
    const code = 'RW' + Math.random().toString(36).slice(2, 8).toUpperCase(); const txid = 'rw:' + uid('x');
    const pend = { txid, code, phone: c.phone, pts: R0.pts, at: nowISO(), uid: me.id || me.email || '' }; rwPendSet([...rwPend(), pend]); const unPend = () => rwPendSet(rwPend().filter(x => x.txid !== txid));
    const r = await loyPost([{ id: txid, phone: c.phone, name: c.name, pts: -R0.pts, at: nowISO(), br: '', ord: 'استبدال جائزة: ' + R0.name + ' (' + code + ')' }]); if (!r) { unPend(); return say('تعذّر خصم النقاط — لم تُصدر الجائزة', 'no'); } setLoy(r);
    const cp = rewardCoupon(R0, c.phone, today(), code, txid);
    const ok = await commitOrg(g => ({ ...g, posPromos: [...(g.posPromos || []), cp] }), { actionType: 'create', targetType: 'settings', targetId: cp.id, need: 'edit', title: 'أصدر جائزة ولاء', details: c.phone + ' · ' + R0.name + ' · ' + code + ' · ' + R0.pts + ' نقطة · ' + txid });
    // قد يكون الكوبون حُفظ رغم الخطأ (انقطاع بعد التنفيذ) — فلا إرجاع فوري؛ يُحسم بعد دقيقة من دليل الخادم: كوبون موجود ⇒ تم، غير موجود ⇒ تُعاد النقاط
    if (ok === false) return say('تعذّر تأكيد إصدار الكوبون — يُحسم تلقائيًا عند فتح التسويق بعد دقيقة (تُعاد النقاط إن لم يصدر)', 'no');
    unPend();
    say('صدرت الجائزة بكوبون ' + code + ' (لهذا العميل، مرة واحدة، حتى ' + cp.to + ') ✓'); };
  const rec = async () => {
    const x = { id: uid('mc'), ...bTag(c), phone: c.phone, status: f.status, ch: f.ch, src: f.src.trim() || '—', ...(f.note.trim() ? { note: f.note.trim() } : {}), by: me.name, byId: me.id || '', at: nowISO() };
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
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }} data-crmtier><span className="badge b-brass">المستوى: {T.ar}</span><span className="badge b-dim">نقاط مكتسبة خلال 365 يومًا: {T.earned}</span>{T.next && <span className="badge b-dim">للمستوى {T.next.ar}: {T.next.need} نقطة</span>}</div>
      <div className="grid g2">
        <div className="card"><div className="card-t">الأكثر شراءً</div>{c.top.length ? <table className="tb" style={{ fontSize: 12 }}><tbody>{c.top.map(p => <tr key={p.id}><td>{p.name}</td><td className="num" style={{ textAlign: 'end' }}>{p.qty}</td><td className="num" style={{ textAlign: 'end' }}>{money(p.amt)}</td></tr>)}</tbody></table> : <div className="empty">—</div>}</div>
        <div className="card"><div className="card-t">الفروع</div>{c.branches.length ? <table className="tb" style={{ fontSize: 12 }}><tbody>{c.branches.map(b => <tr key={b.id}><td>{brName(b.id)}</td><td className="num" style={{ textAlign: 'end' }}>{b.n} زيارة</td></tr>)}</tbody></table> : <div className="empty">—</div>}</div>
      </div>
      <div className="grid g2" style={{ marginTop: 10 }}>
        <div className="card"><div className="card-t">بيانات تكميلية</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="عيد الميلاد (شهر-يوم)"><input className="inp n" style={{ width: 110 }} aria-label="عيد الميلاد" placeholder="04-21" value={pf.bday} onChange={e => setPf(x => ({ ...x, bday: e.target.value }))} /></Field>
            <Field label="البريد"><input className="inp" aria-label="بريد العميل" value={pf.email} onChange={e => setPf(x => ({ ...x, email: e.target.value }))} /></Field>
            <button className="btn sm" data-prof-save onClick={saveProf}>حفظ</button></div></div>
        <div className="card"><div className="card-t">استبدال جائزة</div>
          {(X.rewards || []).length ? <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="الجائزة"><select className="sel" aria-label="جائزة الولاء" value={rw} onChange={e => setRw(e.target.value)}><option value="">—</option>{X.rewards.filter(r => r.active !== false).map(r => <option key={r.id} value={r.id} disabled={c.pts < r.pts}>{r.name} — {r.pts} نقطة</option>)}</select></Field>
            {canApp && <button className="btn sm pri" data-redeem onClick={redeem}>إصدار</button>}</div> : <div className="empty">لا جوائز في الكتالوج — من «الولاء والمكافآت».</div>}</div>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="card-t">الموافقة التسويقية (سجل غير قابل للتعديل)</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="الحالة"><select className="sel" aria-label="حالة الموافقة" value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}><option value="in">موافق على استلام التسويق</option><option value="out">إلغاء الاشتراك</option></select></Field>
          <Field label="القناة"><select className="sel" aria-label="قناة الموافقة" value={f.ch} onChange={e => setF(x => ({ ...x, ch: e.target.value }))}>{Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="المصدر/الإثبات"><input className="inp" aria-label="مصدر الموافقة" value={f.src} onChange={e => setF(x => ({ ...x, src: e.target.value }))} /></Field>
          <button className="btn pri sm" data-consent-save onClick={rec}>تسجيل</button>
        </div>
        <table className="tb" style={{ fontSize: 12, marginTop: 8 }} data-consent-hist><tbody>{c.consent.hist.slice().reverse().map(h => <tr key={h.id}><td className="num">{dtLocal(h.at)}</td><td>{h.status === 'in' ? 'موافقة' : 'إلغاء اشتراك'}</td><td>{CH[h.ch] || h.ch}</td><td>{h.src}</td><td>{h.by}</td></tr>)}
          {!c.consent.hist.length && <tr><td><div className="empty">لا موافقة مسجّلة — لا يُراسَل تسويقيًا.</div></td></tr>}</tbody></table>
      </div>
    </div>
  </Modal>);
}

function Seg({ list, cfg, say, org, me }) {
  const cnt = {}; const tagCnt = {}; list.forEach(c => { cnt[c.cls] = (cnt[c.cls] || 0) + 1; c.tags.forEach(t => { tagCnt[t] = (tagCnt[t] || 0) + 1; }); });
  const S = cfg.seg;
  const RULE = { vip: 'صافي مشترياته ≥ ' + money(S.vipSpend) + ' أو ضمن أعلى ' + S.vipTopPct + '% إنفاقًا', loyal: S.loyalVisits + ' زيارات فأكثر خلال ' + S.loyalDays + ' يومًا', risk: S.riskMinVisits + ' زيارات فأكثر وآخرها قبل أكثر من ' + S.riskDays + ' يومًا', inactive: 'لا شراء منذ أكثر من ' + S.inactiveDays + ' يومًا',
    potential: 'زيارة أو زيارتان ومتوسط فاتورته ≥ ' + S.potMult + '× المتوسط العام', new: 'أول ظهور خلال ' + S.newDays + ' يومًا', regular: 'ما عدا ذلك' };
  const exp = (k, onlyOk) => {
    if (!mktCanExport(org, me)) return say && say('تصدير أرقام العملاء للمركز وحده (المدير أو المالك) — ضوابط التسويق', 'no');   // v56.35 M3
    let why = ''; if (!onlyOk) { if (!mktCanExportAll(org, me)) return say && say('تصدير غير الموافقين للمالك وحده', 'no'); why = window.prompt('سبب تصدير أرقام غير الموافقين (إلزامي):', '') || ''; if (!why.trim()) return; }
    const L = list.filter(c => (c.cls === k || c.tags.includes(k)) && (!onlyOk || mktCanContact(c.consent, 'any')));
    // v56.12 (G6): تصدير أرقام العملاء يُسجَّل في سجل التدقيق (من، أي شريحة، كم رقمًا)
    // لا تنزيل قبل نجاح التسجيل (المراجعة الأمنية 8أ)
    return logAudit({ actionType: 'export', targetType: 'customer', targetId: 'seg:' + k, title: 'صدّر أرقام شريحة عملاء', details: MKT_SEGS[k].ar + ' · ' + L.length + ' رقم' + (onlyOk ? ' (الموافقون فقط)' : ' (كل الأرقام — السبب: ' + why.trim() + ')') })
      .then(ok => { if (ok === false) return say && say('تعذّر تسجيل التصدير في سجل التدقيق — لم يُنزَّل الملف', 'no');
    dl('شريحة_' + MKT_SEGS[k].ar, [['الجوال', 'الاسم', 'الشريحة', 'الزيارات', 'صافي المشتريات', 'آخر شراء', 'الموافقة'], ...L.map(c => [c.phone, c.name, MKT_SEGS[c.cls].ar, c.n, c.net, c.last, mktCanContact(c.consent, 'any') ? 'موافق' : 'غير مسجّلة'])]); }); };
  return (<div className="card">
    <div className="card-t">الشرائح — تصنيف رئيسي واحد لكل عميل بالأولوية، وقد يحمل وسومًا أخرى</div>
    <div className="tw"><table className="tb" data-segtable><thead><tr><th>الشريحة</th><th>القاعدة</th><th style={{ textAlign: 'end' }}>تصنيف رئيسي</th><th style={{ textAlign: 'end' }}>يحمل الوسم</th><th /></tr></thead>
      <tbody>{MKT_SEG_ORDER.map(k => <tr key={k} data-seg={k}><td><span className={'badge ' + MKT_SEGS[k].c}>{MKT_SEGS[k].ar}</span></td><td style={{ fontSize: 12 }}>{RULE[k]}</td><td className="num" style={{ textAlign: 'end' }}>{cnt[k] || 0}</td><td className="num" style={{ textAlign: 'end' }}>{k === 'regular' ? '—' : (tagCnt[k] || 0)}</td>
        <td>{mktCanExport(org, me) && <button className="btn sm gh" data-seg-exp onClick={() => exp(k, true)} title="الموافقون على التسويق فقط"><Download size={12} />تصدير المسموح بمراسلتهم</button>}
          {mktCanExportAll(org, me) && <button className="btn sm gh" data-seg-expall onClick={() => exp(k, false)} title="للمالك وحده بسبب إلزامي">تصدير الكل…</button>}</td></tr>)}</tbody></table></div>
    <div className="note" style={{ marginTop: 8 }}>التصدير يشمل الموافقين على التسويق فقط حمايةً للبيانات. القواعد تُضبط من «الإعدادات».</div>
  </div>);
}

function Gov({ list, ops, org, me, canApp, commit, say, setLoy, loyD }) {
  const groups = crmDupes(list, mktProfiles(ops)); const [mg, setMg] = useState(null); const live = mktMergesLive(ops);
  const WHY = { name: 'اسم متطابق', email: 'بريد واحد', b2b: 'نفس العميل الآجل' };
  // v56.35 M4: مع ضوابط التسويق، التراجع الذي يحرّك نقاطًا يصبح طلبًا يعتمده غير صاحبه
  const pend = mktUndoPending(ops);
  // v56.39: مع «مصدر الدمج على الخادم» يُكتب السجل المحمي أولًا — رفض الخادم (فصل المهام) يوقف العملية قبل أي أثر
  const gate = async (rec) => { if (!mkmSrcOn(org)) return true; const r = await mkmWrite(rec); if (r.err) { say(r.err, 'no'); return false; } return true; };
  const requestUndo = async (x) => { const blk = mktUnmergeBlock(ops, (loyD || {}).tx, x); if (blk) return say('لا يمكن التراجع: ' + blk, 'no');
    if (pend.some(r => r.undoReq === x.id)) return say('يوجد طلب تراجع قائم لهذا الدمج', 'no');
    const why = window.prompt('سبب طلب التراجع عن دمج ' + x.from + ' ← ' + x.to + ' (إلزامي):'); if (!why || !why.trim()) return;
    const rq = { id: uid('mg'), undoReq: x.id, reason: why.trim(), by: me.name, byId: me.id || '', ...(me.email ? { byEmail: me.email } : {}), at: nowISO() }; if (!(await gate(rq))) return;
    const ok = await commit(d => ({ ...d, mktMerges: [...(d.mktMerges || []), rq] }), { actionType: 'create', targetType: 'customer', targetId: x.to, need: 'edit', title: 'طلب تراجع عن دمج يمس النقاط', details: x.from + ' ← ' + x.to + ' · ' + x.pts + ' نقطة · ' + why.trim() });
    if (ok) say('أُرسل الطلب — يعتمده شخص آخر ✓'); };
  const decideReq = async (r, okd) => { if (!canApp) return; const x = live.find(m => m.id === r.undoReq);
    const mine = (r.byEmail && me.email && String(r.byEmail).toLowerCase() === String(me.email).toLowerCase()) || (r.byId ? r.byId === me.id : r.by === me.name);   // (مراجعة الأمن) البريد أولًا
    if (mine) return say('لا يعتمد الطلب صاحبه', 'no');
    if (!okd) { const why = window.prompt('سبب الرفض (إلزامي):', ''); if (!why || !why.trim()) return; const rj = { id: r.id + '-r', rejOf: r.id, reason: why, by: me.name, byId: me.id || '', ...(me.email ? { byEmail: me.email } : {}), at: nowISO() }; if (!(await gate(rj))) return; const ok = await commit(d => ({ ...d, mktMerges: [...(d.mktMerges || []), rj] }), { actionType: 'update', targetType: 'customer', targetId: r.undoReq, need: 'edit', title: 'رفض طلب تراجع عن دمج', details: why }); if (ok) say('رُفض الطلب'); return; }
    if (!x) return say('الدمج لم يعد قائمًا', 'no'); return undo(x, r); };
  const undo = async (x, req) => { if (!canApp) return;
    const resume = ((loyD || {}).tx || []).some(t => t.id === x.id + ':uo');   // v56.39: النقاط أُرجعت ولم يُحفظ السجل — استكمال الحفظ فقط
    const blk = resume ? '' : mktUnmergeBlock(ops, (loyD || {}).tx, x); if (blk) return say('لا يمكن التراجع: ' + blk, 'no');
    if (!req && mktCtlOn(org) && Number(x.pts) > 0) return requestUndo(x);
    const why = req ? req.reason : window.prompt('سبب التراجع عن دمج ' + x.from + ' ← ' + x.to + ' (إلزامي):'); if (!why || !why.trim()) return;
    const id = x.id + '-u'; const at = nowISO();   // v56.39: معرّف ثابت للتراجع (تراجع واحد لكل دمج على الخادم)، وإعادة المحاولة لا تُنشئ سجلًا ثانيًا
    const ux = { id, undoOf: x.id, reason: why.trim(), by: me.name, byId: me.id || '', ...(me.email ? { byEmail: me.email } : {}), at, ...(req ? { reqId: req.id, reqBy: req.by } : {}) };
    if (!(await gate(ux))) return;
    if (Number(x.pts) > 0 && !resume) { const r = await loyPost([{ id: x.id + ':uo', phone: x.to, pts: -Number(x.pts), at, br: '', ord: 'تراجع عن دمج ' + x.from }, { id: x.id + ':ui', phone: x.from, pts: Number(x.pts), at, br: '', ord: 'تراجع عن دمج إلى ' + x.to }]);
      if (!r) return say('تعذّر إرجاع النقاط — لم يتم التراجع', 'no'); setLoy(r); }
    const ok = await commit(d => ({ ...d, mktMerges: [...(d.mktMerges || []).filter(m => m.id !== id), ux] }), { actionType: 'update', targetType: 'customer', targetId: x.to, need: 'edit', title: 'تراجع عن دمج ملف عميل', details: x.from + ' ← ' + x.to + ' · ' + (Number(x.pts) || 0) + ' نقطة · ' + why.trim() });
    if (ok) say('أُلغي الدمج وعاد الملفان منفصلين ✓'); else say('نُقلت النقاط ولم يُحفظ سجل التراجع — أعد المحاولة (لن تتحرك النقاط مرة ثانية)', 'no'); };
  const doMerge = async () => {
    if (!canApp) return say('دمج العملاء يتطلب صلاحية الاعتماد', 'no');
    const from = list.find(c => c.id === mg.from), to = list.find(c => c.id === mg.to);
    if (!from || !to || from.id === to.id) return say('اختر عميلين مختلفين', 'no'); if (!(mg.reason || '').trim()) return say('اكتب سبب الدمج والتحقق', 'no');
    const id = uid('mg'); const x = { id, from: from.phone, to: to.phone, reason: mg.reason.trim(), pts: from.pts, by: me.name, byId: me.id || '', ...(me.email ? { byEmail: me.email } : {}), at: nowISO() };
    if (!(await gate(x))) return;
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
      <div className="note" style={{ marginBottom: 8 }}>الهوية في نقطة البيع هي الجوال؛ هنا جوالات مختلفة باسم متطابق أو بريد واحد أو لنفس العميل الآجل. الدمج يدوي، بسبب مكتوب، لمن له صلاحية الاعتماد، وتنتقل النقاط بحركة في دفتر الولاء.</div>
      {groups.map(g => <div key={g.key} className="mono-b" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 6 }} data-dupe>
        <span>{g.name}{g.why !== 'name' ? ' (' + WHY[g.why] + ')' : ''}: {g.items.map(c => c.phone + ' (' + c.n + ' زيارة)').join(' · ')}</span>
        {canApp && <button className="btn sm gh" data-merge onClick={() => setMg({ from: g.items[1].id, to: g.items[0].id, reason: '' })}>دمج…</button>}</div>)}
      {!groups.length && <div className="empty">لا احتمالات تكرار.</div>}
      {live.length > 0 && <div style={{ marginTop: 10 }} data-merges><div className="card-t" style={{ fontSize: 13 }}>عمليات الدمج القائمة</div>
        {live.map(x => <div key={x.id} className="mono-b" style={{ marginBottom: 4, gap: 6, flexWrap: 'wrap' }}><span>{x.from} ← {x.to} · {String(x.at || '').slice(0, 10)} · {x.reason}</span>
          {canApp && !pend.some(r => r.undoReq === x.id) && <button className="btn sm gh" data-unmerge onClick={() => undo(x)}>{mktCtlOn(org) && Number(x.pts) > 0 ? 'طلب تراجع…' : 'تراجع…'}</button>}
          {pend.filter(r => r.undoReq === x.id).map(r => <span key={r.id} className="row" style={{ gap: 4 }} data-unmerge-req><span className="badge b-amber">طلب تراجع من {r.by}: {r.reason}</span>
            {canApp && !((r.byEmail && me.email && String(r.byEmail).toLowerCase() === String(me.email).toLowerCase()) || (r.byId ? r.byId === me.id : r.by === me.name)) && <><button className="btn sm" data-unmerge-ok onClick={() => decideReq(r, true)}>اعتماد</button><button className="btn sm gh" data-unmerge-no onClick={() => decideReq(r, false)}>رفض</button></>}</span>)}</div>)}</div>}
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


function Loy({ org, ops, loy, setLoy, canApp, me, commit, commitOrg, say, bTag, list }) {
  const X = loyX(org); const prods = (org.products || []).filter(p => !p.posOff); const brs = org.branches || [];
  const [F, setF] = useState(() => JSON.parse(JSON.stringify({ tiers: X.tiers, brMult: X.brMult || {}, prodPts: X.prodPts || {}, expireMonths: X.expireMonths || 0, bdayPts: X.bdayPts || 0, refPts: X.refPts || 0, rewards: X.rewards || [] })));
  const [nr, setNr] = useState({ name: '', productId: '', pts: '', days: '30' }); const [pp, setPp] = useState({ pid: '', pts: '' }); const [ref, setRef] = useState({ a: '', b: '' });
  const phones = [...new Set((loy.tx || []).map(t => t.phone))];
  const dist = {}; let liab = 0; phones.forEach(ph => { const t = loyTier(org, loy, ph, today()); dist[t.k] = (dist[t.k] || 0) + 1; }); (loy.tx || []).forEach(t => { liab += Number(t.pts) || 0; });
  const ptv = Number((org.loyaltyCfg || {}).ptValue) || 0;
  const due = loyPeriodicTx(org, ops, loy, today()); const byK = due.reduce((m, t) => { m[t.kind] = (m[t.kind] || 0) + 1; return m; }, {});
  const save = async () => {
    const tiers = F.tiers.map(t => ({ ...t, min: Number(t.min) || 0, mult: Number(t.mult) || 1 })); if (tiers.some(t => t.mult < 1 || t.mult > 5)) return say('مضاعف المستوى بين 1 و5', 'no');
    const v = { ...F, tiers, expireMonths: Number(F.expireMonths) || 0, bdayPts: Number(F.bdayPts) || 0, refPts: Number(F.refPts) || 0 };
    const ok = await commitOrg(g => ({ ...g, mkt: { ...(g.mkt || {}), loy: v } }), { actionType: 'update', targetType: 'settings', targetId: 'mkt.loy', need: 'edit', title: 'عدّل برنامج الولاء المتقدم', details: tiers.map(t => t.ar + '≥' + t.min + '×' + t.mult).join('، ') });
    if (ok !== false) say('حُفظ برنامج الولاء ✓'); };
  const run = async () => { if (!canApp) return say('الترحيل لمن له صلاحية الاعتماد', 'no'); if (!due.length) return say('لا حركات مستحقة', 'no');
    const r = await loyPost(due.map(({ kind, ...t }) => t)); if (!r) return say('تعذّر الترحيل — تحقق من الاتصال', 'no'); setLoy(r); say('رُحّلت ' + due.length + ' حركة ولاء ✓'); };
  const addRef = async () => { const a = normPhone(ref.a), b = normPhone(ref.b); if (a.length < 9 || b.length < 9 || a === b) return say('أدخل جوالين صحيحين مختلفين', 'no');
    if ((ops.mktReferrals || []).some(r => r.referred === b)) return say('هذا العميل مُحال من قبل', 'no');
    if ((ops.posOrders || []).some(o => o.loyalty && o.loyalty.phone === b && o.status !== 'void' && o.kind !== 'return')) return say('العميل المُحال اشترى من قبل — الإحالة للعملاء الجدد فقط', 'no');
    const ok = await commit(d => ({ ...d, mktReferrals: [...(d.mktReferrals || []), { id: uid('rf'), ...bTag((list || []).find(c => c.phone === a) || null), referrer: a, referred: b, by: me.name, at: nowISO() }] }), { actionType: 'create', targetType: 'customer', targetId: b, need: 'edit', title: 'سجّل إحالة عميل', details: a + ' ← ' + b });
    if (ok) { setRef({ a: '', b: '' }); say('سُجّلت الإحالة — تُمنح المكافأة بعد أول شراء للمُحال ✓'); } };
  const dis = !canApp;
  return (<>
    <div className="grid g4" data-loystats>
      {X.tiers.map(t => <Kpi key={t.k} label={'مستوى ' + t.ar} value={String(dist[t.k] || 0)} sub={'من ' + t.min + ' نقطة/سنة · ×' + t.mult} color="#D9A83E" />)}
      <Kpi label="التزام النقاط القائمة" value={money(posR2(Math.max(0, liab) * ptv))} sub={posR2(liab) + ' نقطة × ' + ptv} color="#D95C4F" />
    </div>
    <LoyAuditCard loy={loy} ops={ops} />
    <div className="card" data-loydue>
      <div className="card-t">الحركات الدورية المستحقة</div>
      <div style={{ fontSize: 12.5 }}>انتهاء نقاط: {byK.expire || 0} · أعياد ميلاد: {byK.bday || 0} · إحالات: {byK.ref || 0}</div>
      <div className="note">كل حركة بمعرّف ثابت (الشهر/السنة/العميل) فلا تتكرر المكافأة ولو ضُغط الزر مرتين.</div>
      {canApp && due.length > 0 && <button className="btn pri sm" style={{ marginTop: 6 }} data-loyrun onClick={run}>ترحيل {due.length} حركة</button>}
    </div>
    <div className="card" data-loycfg>
      <div className="card-t">برنامج الولاء المتقدم {dis && <span className="badge b-dim">للاطلاع</span>}</div>
      <div className="note" style={{ marginBottom: 6 }}>الأساس (نقطة لكل كم ريال وقيمة النقطة) من إعداد الولاء في نقطة البيع، وهنا: المستويات تُحسب بالنقاط المكتسبة من المشتريات خلال آخر 365 يومًا، والمضاعفات تُطبّق على نقاط الشراء.</div>
      <table className="tb" style={{ fontSize: 12.5 }}><thead><tr><th>المستوى</th><th>من (نقطة/سنة)</th><th>مضاعف النقاط</th></tr></thead><tbody>{F.tiers.map((t, i) => <tr key={t.k}><td>{t.ar}</td>
        <td><input className="inp n" style={{ width: 100 }} disabled={dis} aria-label={'حد ' + t.ar} value={t.min} onChange={e => setF(x => ({ ...x, tiers: x.tiers.map((z, j) => j === i ? { ...z, min: e.target.value.replace(/\D/g, '') } : z) }))} /></td>
        <td><input className="inp n" style={{ width: 80 }} disabled={dis} aria-label={'مضاعف ' + t.ar} value={t.mult} onChange={e => setF(x => ({ ...x, tiers: x.tiers.map((z, j) => j === i ? { ...z, mult: e.target.value.replace(/[^\d.]/g, '') } : z) }))} /></td></tr>)}</tbody></table>
      <div className="grid g3" style={{ marginTop: 8 }}>
        <Field label="انتهاء النقاط بعد (شهر، 0 = لا تنتهي)"><input className="inp n" disabled={dis} aria-label="انتهاء النقاط" value={F.expireMonths} onChange={e => setF(x => ({ ...x, expireMonths: e.target.value.replace(/\D/g, '') }))} /></Field>
        <Field label="نقاط عيد الميلاد"><input className="inp n" disabled={dis} aria-label="نقاط عيد الميلاد" value={F.bdayPts} onChange={e => setF(x => ({ ...x, bdayPts: e.target.value.replace(/\D/g, '') }))} /></Field>
        <Field label="نقاط الإحالة (للمُحيل بعد أول شراء)"><input className="inp n" disabled={dis} aria-label="نقاط الإحالة" value={F.refPts} onChange={e => setF(x => ({ ...x, refPts: e.target.value.replace(/\D/g, '') }))} /></Field>
      </div>
      <div className="lbl" style={{ marginTop: 8 }}>مضاعف نقاط الفرع</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{brs.map(b => <Field key={b.id} label={b.name}><input className="inp n" style={{ width: 80 }} disabled={dis} aria-label={'مضاعف فرع ' + b.name} placeholder="1" value={F.brMult[b.id] || ''} onChange={e => setF(x => ({ ...x, brMult: { ...x.brMult, [b.id]: e.target.value.replace(/[^\d.]/g, '') } }))} /></Field>)}</div>
      <div className="lbl" style={{ marginTop: 8 }}>نقاط إضافية لكل وحدة من منتج</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{Object.entries(F.prodPts).filter(([, v]) => Number(v) > 0).map(([pid, v]) => <span key={pid} className="badge b-sky">{(prods.find(p => p.id === pid) || {}).name || pid}: +{v}{!dis && <button className="btn sm gh" style={{ padding: '0 4px' }} onClick={() => setF(x => { const m = { ...x.prodPts }; delete m[pid]; return { ...x, prodPts: m }; })}>×</button>}</span>)}
        {!dis && <><select className="sel" style={{ width: 170 }} aria-label="منتج بنقاط إضافية" value={pp.pid} onChange={e => setPp(x => ({ ...x, pid: e.target.value }))}><option value="">منتج…</option>{prods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input className="inp n" style={{ width: 70 }} aria-label="نقاط المنتج" placeholder="نقاط" value={pp.pts} onChange={e => setPp(x => ({ ...x, pts: e.target.value.replace(/\D/g, '') }))} />
          <button className="btn sm" onClick={() => { if (!pp.pid || !(Number(pp.pts) > 0)) return; setF(x => ({ ...x, prodPts: { ...x.prodPts, [pp.pid]: Number(pp.pts) } })); setPp({ pid: '', pts: '' }); }}>إضافة</button></>}</div>
      <div className="lbl" style={{ marginTop: 8 }}>كتالوج الجوائز (تُصرف بكوبون شخصي لمرة واحدة عبر محرك العروض)</div>
      <table className="tb" style={{ fontSize: 12.5 }} data-rewards><tbody>{F.rewards.map((r, i) => <tr key={r.id}><td>{r.name}</td><td>{(prods.find(p => p.id === r.productId) || {}).name || '—'}</td><td className="num">{r.pts} نقطة</td><td className="num">صلاحية {r.days} يوم</td>
        <td>{!dis && <button className="btn sm gh" onClick={() => setF(x => ({ ...x, rewards: x.rewards.filter((_, j) => j !== i) }))}>حذف</button>}</td></tr>)}</tbody></table>
      {!dis && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        <input className="inp" style={{ width: 160 }} aria-label="اسم الجائزة" placeholder="اسم الجائزة" value={nr.name} onChange={e => setNr(x => ({ ...x, name: e.target.value }))} />
        <select className="sel" style={{ width: 170 }} aria-label="منتج الجائزة" value={nr.productId} onChange={e => setNr(x => ({ ...x, productId: e.target.value }))}><option value="">المنتج المجاني…</option>{prods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input className="inp n" style={{ width: 80 }} aria-label="نقاط الجائزة" placeholder="نقاط" value={nr.pts} onChange={e => setNr(x => ({ ...x, pts: e.target.value.replace(/\D/g, '') }))} />
        <input className="inp n" style={{ width: 70 }} aria-label="صلاحية الجائزة" placeholder="أيام" value={nr.days} onChange={e => setNr(x => ({ ...x, days: e.target.value.replace(/\D/g, '') }))} />
        <button className="btn sm" data-addreward onClick={() => { if (!nr.name.trim() || !nr.productId || !(Number(nr.pts) > 0)) return say('أكمل اسم الجائزة والمنتج والنقاط', 'no'); setF(x => ({ ...x, rewards: [...x.rewards, { id: uid('rw'), name: nr.name.trim(), productId: nr.productId, pts: Number(nr.pts), days: Number(nr.days) || 30, active: true }] })); setNr({ name: '', productId: '', pts: '', days: '30' }); }}>إضافة جائزة</button></div>}
      {!dis && <button className="btn pri" style={{ marginTop: 10 }} data-loycfg-save onClick={save}>حفظ برنامج الولاء</button>}
    </div>
    <div className="card">
      <div className="card-t">تسجيل إحالة</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="جوال المُحيل"><input className="inp" inputMode="tel" aria-label="جوال المحيل" value={ref.a} onChange={e => setRef(x => ({ ...x, a: e.target.value }))} /></Field>
        <Field label="جوال العميل الجديد"><input className="inp" inputMode="tel" aria-label="جوال المحال" value={ref.b} onChange={e => setRef(x => ({ ...x, b: e.target.value }))} /></Field>
        <button className="btn sm" data-refadd onClick={addRef}>تسجيل</button></div>
      <div className="note">المكافأة تُستحق مرة واحدة لكل عميل جديد بعد أول شراء فعلي له.</div>
    </div>
  </>);
}

function Cpn({ org, ops, loy, canApp, me, commitOrg, say, brName }) {
  const U = loy.cpn || {}; const list = (org.posPromos || []).filter(p => p.code);
  const [open, setOpen] = useState(null);
  const stat = (pr) => { const k = cpnKey(pr.code); const L = U[k] || []; const live = L.filter(u => !u.rel);
    const os = (ops.posOrders || []).filter(o => { const cc = posDiscOf(o).coupon; return cc && cpnKey(cc) === k && o.status !== 'void' && o.kind !== 'return'; });   // v56.56: والأجزاء المتساوية
    const disc = os.reduce((a, o) => { const X = posDiscOf(o); return a + X.lines.filter(l => l.promoId === pr.id).reduce((b, l) => b + (Number(l.disc) || 0), 0) + (X.orderPromo && X.orderPromo.id === pr.id ? X.od : 0); }, 0);
    return { L, live: live.length, n: os.length, sales: posR2(os.reduce((a, o) => a + (Number(o.total) || 0), 0)), disc: posR2(disc), rate: Number(pr.maxUses) > 0 ? Math.round(live.length / pr.maxUses * 100) : null }; };
  const approve = (pr) => commitOrg(d => ({ ...d, posPromos: (d.posPromos || []).map(x => x.id === pr.id ? { ...x, pending: false, apprBy: me.name, apprAt: nowISO() } : x) }), { actionType: 'approve', targetType: 'settings', targetId: pr.id, need: 'edit', title: 'اعتمد كوبونًا', details: pr.name }).then(ok => ok !== false && say('اعتُمد ✓'));
  return (<div className="card">
    <div className="card-t">الكوبونات — الاستخدام والاسترداد</div>
    <div className="note" style={{ marginBottom: 8 }}>الإنشاء والتعديل من «نقطة البيع ← العروض» (محرك واحد للعروض). «مبيعات الفواتير» هنا إجمالي فواتير استُخدم فيها الكوبون — ليست إيرادًا إضافيًا ناتجًا عنه.</div>
    <div className="tw"><table className="tb" data-cpntable><thead><tr><th>الكوبون</th><th>الحالة</th><th style={{ textAlign: 'end' }}>الاستخدام</th><th style={{ textAlign: 'end' }}>نسبة الاسترداد</th><th style={{ textAlign: 'end' }}>الخصم الممنوح</th><th style={{ textAlign: 'end' }}>مبيعات الفواتير</th><th /></tr></thead>
      <tbody>{list.map(pr => { const S = stat(pr); return <React.Fragment key={pr.id}><tr data-cpn={pr.code}>
        <td><b className="num">{pr.code}</b><div style={{ fontSize: 11, color: 'var(--faint)' }}>{pr.name}{pr.reward ? ' · جائزة ولاء' : ''}{pr.campaignId ? ' · حملة ' + (((ops.mktCampaigns || []).find(c => c.id === pr.campaignId) || {}).no || '') : ''}</div></td>
        <td>{pr.pending ? <span className="badge b-amber">بانتظار الاعتماد</span> : pr.active === false ? <span className="badge b-dim">موقوف</span> : pr.to && pr.to < today() ? <span className="badge b-dim">منتهٍ</span> : <span className="badge b-mint">متاح</span>}</td>
        <td className="num" style={{ textAlign: 'end' }}>{S.live}{Number(pr.maxUses) > 0 ? ' / ' + pr.maxUses : ''}</td><td className="num" style={{ textAlign: 'end' }}>{S.rate == null ? '—' : S.rate + '%'}</td>
        <td className="num" style={{ textAlign: 'end' }}>{money(S.disc)}</td><td className="num" style={{ textAlign: 'end' }}>{money(S.sales)}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{S.L.length > 0 && <button className="btn sm gh" onClick={() => setOpen(o => o === pr.id ? null : pr.id)}>السجل</button>}{pr.pending && canApp && <button className="btn sm pri" onClick={() => approve(pr)}>اعتماد</button>}</td></tr>
        {open === pr.id && <tr><td colSpan={7}><table className="tb" style={{ fontSize: 12 }} data-cpnhist><tbody>{S.L.map(u => <tr key={u.id}><td className="num">{dtLocal(u.at)}</td><td className="num">{u.phone || '—'}</td><td>{brName(u.br)}</td><td className="num">{u.id}</td><td>{u.rel ? 'مُحرَّر: ' + (u.relWhy || '') : 'مستخدم'}</td></tr>)}</tbody></table></td></tr>}
      </React.Fragment>; })}
        {!list.length && <tr><td colSpan={7}><div className="empty">لا كوبونات بعد.</div></td></tr>}</tbody></table></div>
  </div>);
}

/* v52.1 — المرحلة F: الحملات — هدف وشريحة وكوبونات من محرك العروض وفروع وفترة وميزانية، والنتائج من الطلبات الفعلية */
const ST_C = { draft: 'b-dim', pending: 'b-amber', active: 'b-mint', ended: 'b-dim', cancelled: 'b-rose' };
function Cmp({ org, ops, list, canApp, me, commit, commitOrg, say, brName }) {
  const camps = (ops.mktCampaigns || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const promos = (org.posPromos || []).filter(p => p.code);
  const linkedTo = (pid) => camps.find(c => (c.promoIds || []).includes(pid) && ['pending', 'active'].includes(campStatusOf(c)));
  const [f, setF] = useState(null);
  // عائد التسويق (قرار المالك): تكلفة الحملة من حساب مصروف خاص بها في الدليل
  const A = useMemo(() => { try { return buildAccounting(org, ops); } catch { return null; } }, [org, ops]);
  const expAccs = ((A && A.accounts) || []).filter(a => a.kind === 'exp').sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const accName = (code) => { const a = expAccs.find(x => String(x.code) === String(code)); return a ? a.code + ' — ' + a.name : code; };
  const usedAcc = (code, self) => camps.find(c => c.acc && String(c.acc) === String(code) && c.id !== self);
  const setAcc = (c, acc) => { const u = acc && usedAcc(acc, c.id); if (u) return say('الحساب مخصص لحملة أخرى: ' + u.no, 'no');
    return commit(d => ({ ...d, mktCampaigns: (d.mktCampaigns || []).map(x => x.id === c.id ? { ...x, acc: acc || undefined } : x) }),
      { actionType: 'update', targetType: 'settings', targetId: c.id, title: acc ? 'ربط حملة بحساب تكلفتها' : 'فك حساب تكلفة حملة', details: c.no + (acc ? ' · ' + accName(acc) : '') }).then(ok => { if (ok !== false) say(acc ? 'رُبط حساب التكلفة' : 'فُك الحساب'); }); };
  const blank = () => ({ name: '', goal: '', segment: 'all', promoIds: [], branches: [], from: today(), to: anDay(today(), 30), budget: '', acc: '' });
  const save = async () => {
    if (String(f.name).trim().length < 3) return say('اسم الحملة مطلوب', 'no');
    if (!f.from || !f.to || f.to < f.from) return say('فترة الحملة غير صحيحة', 'no');
    const clash = f.promoIds.map(id => [id, linkedTo(id)]).find(([, c]) => c);
    if (clash) return say('الكوبون مرتبط بحملة قائمة: ' + clash[1].name, 'no');
    if (f.acc && usedAcc(f.acc)) return say('حساب التكلفة مخصص لحملة أخرى: ' + usedAcc(f.acc).no, 'no');
    const rec = { id: uid('cmp'), no: campNextNo(ops), name: f.name.trim(), goal: String(f.goal || '').trim(), segment: f.segment, promoIds: f.promoIds, branches: f.branches, from: f.from, to: f.to,
      budget: Math.max(0, Number(f.budget) || 0), ...(f.acc ? { acc: f.acc } : {}), status: canApp ? 'active' : 'pending', createdBy: me.name, createdById: me.id, createdAt: nowISO(), ...(canApp ? { apprBy: me.name, apprAt: nowISO() } : {}) };
    const ok = await commit(d => ({ ...d, mktCampaigns: [rec, ...(d.mktCampaigns || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'أنشأ حملة تسويقية', details: rec.no + ' · ' + rec.name + (canApp ? ' · نشطة' : ' · بانتظار الاعتماد') });
    if (ok === false) return;
    if (rec.promoIds.length) await commitOrg(d => ({ ...d, posPromos: (d.posPromos || []).map(p => rec.promoIds.includes(p.id) ? { ...p, campaignId: rec.id } : p) }), { actionType: 'update', targetType: 'settings', targetId: rec.id, title: 'ربط كوبونات بحملة', details: rec.no });
    setF(null); say(canApp ? 'أُطلقت الحملة ' + rec.no : 'أُرسلت الحملة ' + rec.no + ' للاعتماد');
  };
  const setSt = (c, status, title) => commit(d => ({ ...d, mktCampaigns: (d.mktCampaigns || []).map(x => x.id === c.id ? { ...x, status, ...(status === 'active' ? { apprBy: me.name, apprAt: nowISO() } : { closedBy: me.name, closedAt: nowISO() }) } : x) }),
    { actionType: status === 'active' ? 'approve' : 'update', targetType: 'settings', targetId: c.id, title, details: c.no + ' · ' + c.name }).then(ok => { if (ok !== false) say(title + ' — ' + c.no); });
  const tog = (k, v) => setF(x => ({ ...x, [k]: x[k].includes(v) ? x[k].filter(y => y !== v) : [...x[k], v] }));
  return (<div className="card" data-cmp>
    <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}><div className="card-t" style={{ margin: 0 }}>الحملات التسويقية</div>
      <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setF(blank())}>حملة جديدة</button></div>
    <div className="note" style={{ marginBottom: 8 }}>الحملة تربط شريحة مستهدفة بكوبونات من «نقطة البيع ← العروض» في فترة وفروع محددة، وتقيس نتيجتها من الطلبات الفعلية. «مبيعات الفواتير» إجمالي الفواتير التي استُخدم فيها كوبون الحملة — ليست إيرادًا إضافيًا بالضرورة. إرسال الرسائل للعملاء ليس هنا.</div>
    {!camps.length && <div className="empty">لا حملات بعد.</div>}
    {camps.map(c => { const st = campStatusOf(c), S = campStats(org, ops, list, c, A); return <div key={c.id} className="card" data-camp={c.no} style={{ background: 'var(--ink)', marginBottom: 8 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{c.name}</b><span className="num" style={{ fontSize: 11, color: 'var(--dim)' }}>{c.no}</span><span className={'badge ' + ST_C[st]}>{CAMP_ST[st]}</span>
        <span style={{ fontSize: 12, color: 'var(--dim)' }}>{c.from} ← {c.to} · {c.segment === 'all' ? 'كل العملاء' : (MKT_SEGS[c.segment] || {}).ar || c.segment}{(c.branches || []).length ? ' · ' + c.branches.map(brName).join('، ') : ' · كل الفروع'}</span>
        <span style={{ marginInlineStart: 'auto' }} />
        {st === 'pending' && canApp && <button className="btn sm pri" onClick={() => setSt(c, 'active', 'اعتمد حملة')}>اعتماد وإطلاق</button>}
        {st === 'active' && canApp && <button className="btn sm gh" onClick={() => setSt(c, 'ended', 'أنهى حملة')}>إنهاء</button>}
        {['pending', 'draft'].includes(st) && (canApp || c.createdById === me.id) && <button className="btn sm gh" onClick={() => setSt(c, 'cancelled', 'ألغى حملة')}>إلغاء</button>}</div>
      {c.goal && <div style={{ fontSize: 12, marginTop: 4 }}>الهدف: {c.goal}</div>}
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12 }} data-campstats>
        <span>الكوبونات: <b>{(org.posPromos || []).filter(p => (c.promoIds || []).includes(p.id)).map(p => p.code).join('، ') || '—'}</b></span>
        <span>الاستخدام: <b className="num">{S.redemptions}</b></span><span>مبيعات الفواتير: <b className="num">{money(S.sales)}</b></span><span>الخصم الممنوح: <b className="num">{money(S.disc)}</b></span>
        <span>المستهدفون: <b className="num">{S.target}</b></span><span>اشترى منهم: <b className="num">{S.responders}{S.respRate != null ? ' (' + S.respRate + '%)' : ''}</b></span>
        <span>عملاء جدد: <b className="num">{S.newCustomers}</b></span><span>الميزانية: <b className="num">{money(S.budget)}</b></span><span>التكلفة لكل طلب: <b className="num">{S.costPerOrder == null ? '—' : money(S.costPerOrder)}</b></span>
      </div>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12, alignItems: 'center' }} data-camproi>
        <span>حساب التكلفة: {canApp ? <select className="sel" aria-label={'حساب تكلفة ' + c.no} style={{ height: 30, fontSize: 12, maxWidth: 260 }} value={c.acc || ''} onChange={e => setAcc(c, e.target.value)}>
          <option value="">— غير مربوط —</option>{expAccs.map(a => <option key={a.code} value={a.code} disabled={!!usedAcc(a.code, c.id)}>{a.code} — {a.name}</option>)}</select> : <b>{c.acc ? accName(c.acc) : '—'}</b>}</span>
        {c.acc ? <>
          <span>التكلفة الفعلية: <b className="num">{S.spend == null ? '—' : money(S.spend)}</b></span>
          <span>المبيعات المنسوبة بلا ضريبة: <b className="num">{money(S.netSales)}</b></span>
          <span>كل ريال تسويق جلب: <b className="num">{S.roas == null ? '—' : S.roas}</b>{S.roas == null ? '' : ' ر.س'}</span>
          <span>العائد: <b className="num" style={{ color: S.roi == null ? undefined : S.roi >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{S.roi == null ? '—' : S.roi + '%'}</b></span>
        </> : <span style={{ color: 'var(--dim)' }}>اربط حساب مصروف خاصًا بالحملة لحساب التكلفة الفعلية والعائد</span>}
      </div>
      {c.acc && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>العائد = (المبيعات المنسوبة بلا ضريبة − التكلفة الفعلية) ÷ التكلفة الفعلية. «منسوبة» = فواتير استخدمت كوبونات الحملة، وليست بالضرورة مبيعات إضافية.</div>}
    </div>; })}
    {f && <Modal title="حملة جديدة" icon={Megaphone} onClose={() => setF(null)} wide foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save}>{canApp ? 'إطلاق الحملة' : 'إرسال للاعتماد'}</button></>}>
      <Field label="اسم الحملة"><input className="inp" aria-label="اسم الحملة" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Field>
      <Field label="الهدف"><input className="inp" aria-label="هدف الحملة" placeholder="مثال: إعادة العملاء المعرّضين للانقطاع خلال شهر" value={f.goal} onChange={e => setF(x => ({ ...x, goal: e.target.value }))} /></Field>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Field label="الشريحة المستهدفة"><select className="sel" aria-label="الشريحة" value={f.segment} onChange={e => setF(x => ({ ...x, segment: e.target.value }))}><option value="all">كل العملاء</option>{MKT_SEG_ORDER.map(k => <option key={k} value={k}>{MKT_SEGS[k].ar}</option>)}</select></Field>
        <Field label="من"><input type="date" className="inp" aria-label="من" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} /></Field>
        <Field label="إلى"><input type="date" className="inp" aria-label="إلى" value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} /></Field>
        <Field label="الميزانية (ر.س)"><input className="inp n" aria-label="الميزانية" inputMode="decimal" value={f.budget} onChange={e => setF(x => ({ ...x, budget: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
        <Field label="حساب تكلفة الحملة"><select className="sel" aria-label="حساب تكلفة الحملة" value={f.acc} onChange={e => setF(x => ({ ...x, acc: e.target.value }))}>
          <option value="">— لاحقًا —</option>{expAccs.map(a => <option key={a.code} value={a.code} disabled={!!usedAcc(a.code)}>{a.code} — {a.name}</option>)}</select></Field>
      </div>
      <div className="lbl" style={{ margin: '8px 0 4px' }}>الكوبونات (من محرك العروض)</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{promos.length ? promos.map(p => { const L = linkedTo(p.id); return <label key={p.id} className="row" style={{ gap: 4, fontSize: 12, opacity: L ? .5 : 1 }}>
        <input type="checkbox" disabled={!!L} checked={f.promoIds.includes(p.id)} onChange={() => tog('promoIds', p.id)} /><b className="num">{p.code}</b> {p.name}{L ? ' (في ' + L.no + ')' : ''}</label>; }) : <span className="note">لا كوبونات — أنشئها من «نقطة البيع ← العروض» برمز كوبون.</span>}</div>
      <div className="lbl" style={{ margin: '8px 0 4px' }}>الفروع (بلا اختيار = كل الفروع)</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{(org.branches || []).map(b => <label key={b.id} className="row" style={{ gap: 4, fontSize: 12 }}><input type="checkbox" checked={f.branches.includes(b.id)} onChange={() => tog('branches', b.id)} />{b.name}</label>)}</div>
    </Modal>}
  </div>);
}

/* v52.2 — المرحلة G: نتائج التوصيات عند الدفع وإعداداتها */
function Rec({ org, ops, central, brIds, myBranches, canApp, commitOrg, say }) {
  const C = recCfgOf(org);
  const [to, setTo] = useState(today()); const [from, setFrom] = useState(anDay(today(), -29)); const [br, setBr] = useState('');
  const S = useMemo(() => recStats(ops.posOrders, { from, to, branches: br ? [br] : (central ? null : brIds) }), [ops.posOrders, from, to, br, central, brIds.join(',')]);
  const [F, setF] = useState(() => ({ on: C.on, days: String(C.days), minPair: String(C.minPair), minConf: String(C.minConf), max: String(C.max) }));
  const save = async () => {
    const v = { on: !!F.on, days: Number(F.days), minPair: Number(F.minPair), minConf: Number(F.minConf), max: Number(F.max) };
    if (!(v.days >= 7 && v.days <= 365) || !(v.minPair >= 1) || !(v.minConf >= 1 && v.minConf <= 100) || !(v.max >= 1 && v.max <= 6)) return say('قيم غير صالحة: الفترة 7–365 يومًا، الثقة 1–100%، العدد 1–6', 'no');
    const ok = await commitOrg(g => ({ ...g, mkt: { ...(g.mkt || {}), recs: v } }), { actionType: 'update', targetType: 'settings', targetId: 'mkt.recs', need: 'edit', title: 'عدّل إعدادات التوصيات عند الدفع', details: JSON.stringify(v) });
    if (ok !== false) say('حُفظت إعدادات التوصيات ✓');
  };
  const N = (k, ar) => <Field label={ar}><input className="inp n" inputMode="numeric" aria-label={ar} disabled={!canApp} value={F[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value.replace(/\D/g, '') }))} /></Field>;
  return (<div className="grid" style={{ gap: 12 }} data-recview>
    <div className="card">
      <div className="row" style={{ gap: 8, alignItems: 'end', flexWrap: 'wrap', marginBottom: 8 }}><div className="card-t" style={{ margin: 0 }}>نتائج التوصيات عند الدفع</div><span style={{ marginInlineStart: 'auto' }} />
        <Field label="من"><input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="إلى"><input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <Field label="الفرع"><select className="sel" value={br} onChange={e => setBr(e.target.value)}><option value="">{central ? 'كل الفروع' : 'فروعي'}</option>{(myBranches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field></div>
      <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 13 }} data-recstats>
        <span>فواتير عُرضت فيها توصيات: <b className="num">{S.orders}</b></span><span>مرات العرض: <b className="num">{S.shown}</b></span><span>القبول: <b className="num">{S.accepted}</b></span>
        <span>نسبة القبول: <b className="num">{S.rate == null ? '—' : S.rate + '%'}</b></span><span>أُخفيت: <b className="num">{S.dismissed}</b></span><span>مبيعات الأسطر المقبولة: <b className="num">{money(S.sales)}</b></span></div>
      <div className="note" style={{ marginTop: 8 }}>«مبيعات الأسطر المقبولة» قيمة الأصناف التي أضافها الكاشير من التوصية — ليست إيرادًا إضافيًا بالضرورة (قد يكون العميل سيطلبها أصلًا).</div>
      {S.rows.length ? <div className="tw" style={{ marginTop: 8 }}><table className="tb" data-rectable><thead><tr><th>الصنف</th><th>عُرض</th><th>قُبل</th><th>أُخفي</th><th>نسبة القبول</th><th>الكمية</th><th>المبيعات</th></tr></thead>
        <tbody>{S.rows.map(r => <tr key={r.productId}><td>{r.name}</td><td className="num">{r.shown}</td><td className="num">{r.accepted}</td><td className="num">{r.dismissed}</td><td className="num">{r.rate == null ? '—' : r.rate + '%'}</td><td className="num">{r.qty}</td><td className="num">{money(r.sales)}</td></tr>)}</tbody></table></div>
        : <div className="empty">لا توصيات في هذه الفترة.</div>}
    </div>
    <div className="card" data-reccfg>
      <div className="card-t">إعدادات التوصيات</div>
      {!canApp && <div className="note" style={{ marginBottom: 8 }}>للاطلاع فقط — التعديل لمن له صلاحية الاعتماد.</div>}
      <label className="row" style={{ gap: 6, marginBottom: 8 }}><input type="checkbox" aria-label="تفعيل التوصيات" disabled={!canApp} checked={!!F.on} onChange={e => setF(x => ({ ...x, on: e.target.checked }))} />إظهار «مقترح مع الطلب» في نقطة البيع</label>
      <div className="grid g4">{N('days', 'تحليل طلبات آخر (يوم)')}{N('minPair', 'أقل عدد طلبات مشتركة')}{N('minConf', 'أقل نسبة ارتباط (%)')}{N('max', 'عدد الاقتراحات')}</div>
      {canApp && <button className="btn pri" style={{ marginTop: 8 }} data-reccfg-save onClick={save}>حفظ</button>}
      <div className="note" style={{ marginTop: 8 }}>الاقتراح من طلبات الفرع الفعلية: الصنف الذي يُطلب مع ما في السلة بنسبة لا تقل عن الحد، أو ما يطلبه عميل الولاء عادةً (مرتان فأكثر). لا يقترح صنفًا موقوفًا أو موجودًا في السلة، ولا يغيّر السعر أو الخصم.</div>
    </div>
  </div>);
}


/* v52.4 — المرحلة H: تقارير الفروع والربحية */
function Brr({ org, ops, central, brIds }) {
  const [to, setTo] = useState(today()); const [from, setFrom] = useState(anDay(today(), -29)); const [open, setOpen] = useState(''); const ref = useRef(null);
  const R = useMemo(() => brReport(org, ops, { from, to, branches: central ? null : brIds }), [org, ops, from, to, central, brIds.join(',')]);
  const pc = (v) => v == null ? '—' : (v > 0 ? '+' : '') + v + '%';
  const hr = (h) => h == null ? '—' : String(h).padStart(2, '0') + ':00–' + String((h + 1) % 24).padStart(2, '0') + ':00';
  const xl = () => dl('تقرير الفروع ' + from + ' — ' + to, [['الفرع', 'الطلبات', 'المبيعات', 'الفترة السابقة', 'النمو %', 'متوسط الفاتورة', 'الخصومات', 'نسبة الخصم %', 'طلبات بكوبون', 'مبيعات التوصيات', 'المرتجعات', 'تعريف العميل %', 'تكلفة الوصفات', 'تغطية التكلفة %', 'هامش الوصفات %', 'ساعة الذروة'],
    ...R.rows.map(r => [r.name, r.orders, r.sales, r.prevSales, r.growthPct == null ? '' : r.growthPct, r.aov, r.discTotal, r.discPct, r.couponOrders, r.recSales, r.returns, r.idPct, r.cost, r.costCover, r.marginPct == null ? '' : r.marginPct, hr(r.peakHour)]),
    ['الإجمالي', R.total.orders, R.total.sales, R.total.prevSales, R.total.growthPct == null ? '' : R.total.growthPct, R.total.aov, R.total.discTotal, '', R.total.couponOrders, R.total.recSales, R.total.returns, '', '', '', '', ''],
    [], ['تاريخ ووقت التصدير: ' + dtLocal(new Date())]]);
  return (<div className="grid" style={{ gap: 12 }} data-brr ref={ref}>
    <div className="card row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <Field label="من"><input type="date" className="inp" aria-label="من تاريخ" value={from} onChange={e => setFrom(e.target.value)} /></Field>
      <Field label="إلى"><input type="date" className="inp" aria-label="إلى تاريخ" value={to} onChange={e => setTo(e.target.value)} /></Field>
      <span className="hint">مقارنة بالفترة السابقة {R.pFrom} ← {R.pTo}</span><span style={{ marginInlineStart: 'auto' }} />
      <button className="btn sm gh" data-noprint onClick={xl}><Download size={14} />Excel</button>
      <button className="btn sm gh" data-noprint onClick={() => printScreen(org, ref.current, 'تقرير الفروع والربحية ' + from + ' — ' + to)}>طباعة</button>
    </div>
    <div className="grid g4" data-brrkpis>
      <Kpi label="مبيعات الفروع" value={money(R.total.sales)} sub={R.total.orders + ' طلب · ' + pc(R.total.growthPct)} color="#2C6BC4" />
      <Kpi label="متوسط الفاتورة" value={money(R.total.aov)} sub={'الفترة السابقة: ' + money(R.total.prevSales)} color="#D9A83E" />
      <Kpi label="الخصومات الممنوحة" value={money(R.total.discTotal)} sub={R.total.couponOrders + ' طلب بكوبون'} color="#D95C4F" />
      <Kpi label="المرتجعات" value={money(R.total.returns)} sub={'مبيعات التوصيات: ' + money(R.total.recSales)} color="#8A94A6" />
    </div>
    <div className="card">
      <div className="card-t">الفروع — الفترة المختارة</div>
      <div className="tw"><table className="tb" data-brrtable><thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>الطلبات</th><th style={{ textAlign: 'end' }}>المبيعات</th><th style={{ textAlign: 'end' }}>النمو</th><th style={{ textAlign: 'end' }}>متوسط الفاتورة</th><th style={{ textAlign: 'end' }}>الخصومات</th><th style={{ textAlign: 'end' }}>المرتجعات</th><th style={{ textAlign: 'end' }}>هامش الوصفات</th><th>الذروة</th><th data-noprint /></tr></thead>
        <tbody>{R.rows.map(r => <React.Fragment key={r.branchId}><tr data-brrow={r.branchId}>
          <td><b>{r.name}</b></td><td className="num" style={{ textAlign: 'end' }}>{r.orders}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.sales)}</td>
          <td className="num" style={{ textAlign: 'end', color: r.growthPct == null ? 'var(--faint)' : r.growthPct >= 0 ? 'var(--mint)' : 'var(--rose)' }}>{pc(r.growthPct)}</td>
          <td className="num" style={{ textAlign: 'end' }}>{money(r.aov)}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.discTotal)} <small>({r.discPct}%)</small></td>
          <td className="num" style={{ textAlign: 'end' }}>{money(r.returns)}</td>
          <td className="num" style={{ textAlign: 'end' }} title={'تغطية التكلفة ' + r.costCover + '%'}>{r.marginPct == null ? '—' : r.marginPct + '%'}{r.marginPct != null && r.costCover < 100 ? <small style={{ color: 'var(--amber)' }}> (غير مكتمل {r.costCover}%)</small> : null}</td>
          <td className="num">{hr(r.peakHour)}</td>
          <td data-noprint><button className="btn sm gh" onClick={() => setOpen(open === r.branchId ? '' : r.branchId)}>{open === r.branchId ? 'إخفاء' : 'تفاصيل'}</button></td></tr>
          {open === r.branchId && <tr><td colSpan={10}><div className="grid g3" style={{ gap: 10, fontSize: 12.5 }} data-brrdet>
            <div><b>الخصومات</b><div>العروض والكوبونات: <span className="num">{money(r.promoDisc)}</span></div><div>يدوي: <span className="num">{money(r.manualDisc)}</span></div><div>نقاط الولاء: <span className="num">{money(r.loyDisc)}</span></div><div>طلبات بكوبون: <span className="num">{r.couponOrders}</span></div></div>
            <div><b>القنوات والعملاء</b>{r.channels.map(c => <div key={c.k}>{c.ar}: <span className="num">{c.n} ({c.pct}%)</span></div>)}<div>تعريف العميل: <span className="num">{r.idPct}%</span></div><div>مبيعات التوصيات: <span className="num">{money(r.recSales)}</span></div></div>
            <div><b>الأعلى مبيعًا</b>{r.top.map(p => <div key={p.productId}>{p.name}: <span className="num">{p.qty} · {money(p.sales)}</span></div>)}</div>
          </div></td></tr>}</React.Fragment>)}
          {!R.rows.length && <tr><td colSpan={10}><div className="empty">لا طلبات نقطة بيع في الفترة.</div></td></tr>}</tbody></table></div>
      <div className="note" style={{ marginTop: 8 }}>كل الأرقام من طلبات نقطة البيع الفعلية (بلا الملغاة). «هامش الوصفات» تقديري: صافي الأسطر قبل خصم الفاتورة ناقص تكلفة الوصفات بمتوسط التكلفة الحالي، ويُحسب للأصناف ذات الوصفة المكتملة فقط — «غير مكتمل» يعني أن بعض المبيعات بلا تكلفة. ليس بديلًا عن قائمة الدخل.</div>
    </div>
  </div>);
}

/* v52.5 — المرحلة J: المساعد الذكي للنمو — ملخص مجمّع بلا بيانات شخصية، والاقتراحات للمراجعة فقط */
function Ai({ org, ops, list, central, brIds }) {
  const [to, setTo] = useState(today()); const [from, setFrom] = useState(anDay(today(), -29));
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [hist, setHist] = useState([]); const [show, setShow] = useState(false);
  const D = useMemo(() => growthDigest(org, ops, list, { from, to, branches: central ? null : brIds }), [org, ops, list, from, to, central, brIds.join(',')]);
  const ask = async (text) => {
    const question = String(text || q).trim(); if (question.length < 3) return setErr('اكتب سؤالك');
    setBusy(true); setErr('');
    try { const r = await aiGrowthAsk(D, question); setHist(h => [{ q: question, r, at: new Date() }, ...h].slice(0, 10)); setQ(''); }
    catch (e) { setErr(String((e && e.message) || e)); } finally { setBusy(false); }
  };
  return (<div className="grid" style={{ gap: 12 }} data-ai>
    <div className="card">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}><div className="card-t" style={{ margin: 0 }}>اسأل عن نمو مطاعمك</div><span style={{ marginInlineStart: 'auto' }} />
        <Field label="من"><input type="date" className="inp" aria-label="من تاريخ" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="إلى"><input type="date" className="inp" aria-label="إلى تاريخ" value={to} onChange={e => setTo(e.target.value)} /></Field></div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>{AI_GROWTH_PRESETS.map(p => <button key={p} className="btn sm gh" disabled={busy} data-aipreset onClick={() => ask(p)}>{p}</button>)}</div>
      <div className="row" style={{ gap: 6 }}><textarea className="inp" rows={2} style={{ flex: 1 }} aria-label="سؤالك" maxLength={500} placeholder="مثال: لماذا انخفضت مبيعات فرع النسيم هذا الشهر؟" value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn pri" disabled={busy} onClick={() => ask()}>{busy ? 'جارٍ التحليل…' : 'اسأل'}</button></div>
      {err && <div className="note" style={{ marginTop: 8, color: 'var(--rose)' }} data-aierr>{err}</div>}
      <div className="note" style={{ marginTop: 8 }}>يُرسل للمساعد ملخص أرقام مجمّع فقط (المبيعات والفروع والشرائح والحملات والكوبونات والتوصيات) — لا أسماء عملاء ولا جوالات. الإجابات اقتراحات للمراجعة ولا يُنفَّذ شيء تلقائيًا. <button className="pos-link" onClick={() => setShow(s => !s)}>{show ? 'إخفاء ما يُرسل' : 'عرض ما يُرسل'}</button></div>
      {show && <pre className="num" dir="ltr" style={{ maxHeight: 260, overflow: 'auto', fontSize: 11, background: 'var(--ink)', padding: 8, borderRadius: 8, marginTop: 6 }} data-aidigest>{JSON.stringify(D, null, 1)}</pre>}
    </div>
    {hist.map((h, i) => <div key={i} className="card" data-aians>
      <div style={{ fontSize: 12, color: 'var(--dim)' }}>{h.q} · <span className="num">{dtLocal(h.at)}</span></div>
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, marginTop: 6 }}>{h.r.answer}</div>
      {h.r.points.length > 0 && <ul style={{ margin: '8px 0', paddingInlineStart: 18, lineHeight: 1.8 }}>{h.r.points.map((p, k) => <li key={k}>{p}</li>)}</ul>}
      {h.r.actions.length > 0 && <div style={{ marginTop: 6 }}><b>إجراءات مقترحة للمراجعة</b>{h.r.actions.map((a, k) => <div key={k} className="note" style={{ marginTop: 6 }} data-aiact><b>{a.title}</b>{a.why ? ' — ' + a.why : ''}{a.where ? <div style={{ fontSize: 11, color: 'var(--faint)' }}>المكان: {a.where}</div> : null}</div>)}</div>}
      {h.r.caveats.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 6 }}>{h.r.caveats.join(' · ')}</div>}
    </div>)}
  </div>);
}

/* v52.5 — إعدادات التواصل مع العملاء (تمهيد للمرحلة I) — لا إرسال ولا مفاتيح هنا */
function Com({ org, me, canApp, commitOrg, say }) {
  const C = commsCfgOf(org);
  const [F, setF] = useState(() => JSON.parse(JSON.stringify({ provider: C.provider, channels: C.channels, senderName: C.senderName, quietFrom: C.quietFrom, quietTo: C.quietTo, maxPerMonth: String(C.maxPerMonth), optOutText: C.optOutText, templates: C.templates })));
  const [t, setT] = useState(null);
  const sample = { name: 'سارة', points: 120, coupon: 'BACK10', branch: ((org.branches || [])[0] || {}).name || 'الفرع', company: ((org.company || {}).name) || 'المنشأة' };
  const save = async (next) => {
    const v = next || F; const mp = Number(v.maxPerMonth);
    if (!(mp >= 0 && mp <= 30)) return say('الحد الشهري بين 0 و30 رسالة', 'no');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.quietFrom) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.quietTo)) return say('ساعات الهدوء غير صحيحة', 'no');
    const comms = { provider: v.provider, channels: v.channels, senderName: String(v.senderName || '').trim().slice(0, 11), quietFrom: v.quietFrom, quietTo: v.quietTo, maxPerMonth: mp, optOutText: String(v.optOutText || '').trim().slice(0, 80), templates: v.templates };
    // v56.50: مفتاح مسار الإرسال يُحفظ من بطاقته وحدها — حفظ الإعدادات لا يمسّه
    const ok = await commitOrg(g => ({ ...g, mkt: { ...(g.mkt || {}), comms: { ...comms, ...((((g.mkt || {}).comms) || {}).sendOn ? { sendOn: true } : {}) } } }), { actionType: 'update', targetType: 'settings', targetId: 'mkt.comms', need: 'edit', title: 'عدّل إعدادات التواصل مع العملاء', details: (COMMS_PROVIDERS[comms.provider] || '') + ' · ' + comms.templates.length + ' قالب' });
    if (ok !== false) { say('حُفظت إعدادات التواصل ✓'); if (next) setF(next); }
    return ok;
  };
  const saveTpl = async () => { const e = commsTplErr(t); if (e) return say(e, 'no');
    const rec = { id: t.id || uid('tpl'), name: t.name.trim().slice(0, 60), ch: t.ch, body: String(t.body).trim(), at: nowISO() };
    const next = { ...F, templates: [...F.templates.filter(x => x.id !== rec.id), rec] }; const ok = await save(next); if (ok !== false) setT(null); };
  const delTpl = (id) => { if (window.confirm('حذف القالب؟')) save({ ...F, templates: F.templates.filter(x => x.id !== id) }); };
  const R = t ? commsRender(t.body, sample) : null; const SP = t && t.ch === 'sms' ? smsParts(R.text + (F.optOutText ? '\n' + F.optOutText : '')) : null;
  const dis = !canApp; const sOn = commsSendOn(org); const isAdm = jeOwner(me);
  const togSend = async () => { if (!isAdm) return say('لمسؤول النظام', 'no');
    if (!sOn && !window.confirm('تفعيل مسار إرسال الرسائل؟ المحوّل الحالي تجريبي لا يرسل شيئًا فعلًا؛ كل دفعة تحتاج اعتماد المالك أو المدير العام.')) return;
    const ok = await commitOrg(g => { const c0 = { ...((((g.mkt || {}).comms) || {})) }; if (sOn) delete c0.sendOn; else c0.sendOn = true; return { ...g, mkt: { ...(g.mkt || {}), comms: c0 } }; },
      { actionType: 'update', targetType: 'settings', targetId: 'mkt.comms.sendOn', need: 'edit', title: sOn ? 'أوقف مسار إرسال الرسائل' : 'فعّل مسار إرسال الرسائل (تجريبي)', details: sOn ? 'إيقاف' : 'تفعيل' });
    if (ok !== false) say(sOn ? 'أُوقف مسار الإرسال' : 'فُعّل مسار الإرسال (المحوّل التجريبي)'); };
  return (<div className="grid" style={{ gap: 12 }} data-com>
    <div className="card" data-comsend><div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div className="card-t" style={{ margin: 0 }}>مسار إرسال الرسائل</div>
      <span className={'badge ' + (sOn ? 'b-mint' : 'b-dim')} data-comsend-st>{sOn ? 'مفعّل (تجريبي — بلا إرسال فعلي)' : 'غير مفعّل'}</span>
      {isAdm && <button className="btn sm gh" style={{ marginInlineStart: 'auto' }} data-comsend-toggle onClick={togSend}>{sOn ? 'إيقاف' : 'تفعيل'}</button>}</div>
      <div className="note" style={{ marginTop: 6 }}>يسمح بإنشاء دفعات الرسائل في «الرسائل» واعتمادها وإرسالها تجريبيًا من الخادم. لا تُرسل رسالة فعلًا حتى يُختار مزوّد ويُفتح حساب باسم المنشأة ويُسجَّل اسم المرسل ويُضاف المفتاح في إعدادات الخادم. التفعيل لمسؤول النظام.</div></div>
    <div className="card" style={{ borderColor: 'rgba(217,164,65,.5)' }}><div className="note" data-comoff>الإرسال للعملاء <b>غير مفعّل</b> — هذه الإعدادات تمهيد للمرحلة I. يُفعَّل الإرسال بعد اعتمادك للمزوّد والتكلفة، ويُضاف مفتاح المزوّد في إعدادات الخادم (لا يُحفظ هنا أبدًا). الرسائل التسويقية تُرسل فقط لمن سجّل موافقة صريحة، وتحترم ساعات الهدوء والحد الشهري.</div></div>
    <div className="card" data-comcfg>
      <div className="card-t">المزوّد والقنوات</div>
      {dis && <div className="note" style={{ marginBottom: 8 }}>للاطلاع فقط — التعديل لمن له صلاحية الاعتماد.</div>}
      <div className="grid g3">
        <Field label="المزوّد المقترح"><select className="sel" aria-label="المزوّد" disabled={dis} value={F.provider} onChange={e => setF(x => ({ ...x, provider: e.target.value }))}>{Object.entries(COMMS_PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="اسم المرسل (حتى 11 حرفًا لاتينيًا)"><input className="inp" dir="ltr" aria-label="اسم المرسل" disabled={dis} maxLength={11} value={F.senderName} onChange={e => setF(x => ({ ...x, senderName: e.target.value }))} /></Field>
        <Field label="أقصى رسائل تسويقية للعميل شهريًا"><input className="inp n" inputMode="numeric" aria-label="الحد الشهري" disabled={dis} value={F.maxPerMonth} onChange={e => setF(x => ({ ...x, maxPerMonth: e.target.value.replace(/\D/g, '') }))} /></Field>
        <Field label="ساعات الهدوء من"><input type="time" className="inp" aria-label="الهدوء من" disabled={dis} value={F.quietFrom} onChange={e => setF(x => ({ ...x, quietFrom: e.target.value }))} /></Field>
        <Field label="إلى"><input type="time" className="inp" aria-label="الهدوء إلى" disabled={dis} value={F.quietTo} onChange={e => setF(x => ({ ...x, quietTo: e.target.value }))} /></Field>
        <Field label="نص إلغاء الاشتراك (يُلحق بكل رسالة)"><input className="inp" aria-label="نص الإلغاء" disabled={dis} value={F.optOutText} onChange={e => setF(x => ({ ...x, optOutText: e.target.value }))} /></Field>
      </div>
      <div className="row" style={{ gap: 12, marginTop: 6 }}>{Object.entries(COMMS_CH).map(([k, v]) => <label key={k} className="row" style={{ gap: 4 }}><input type="checkbox" aria-label={'قناة ' + v} disabled={dis} checked={!!F.channels[k]} onChange={e => setF(x => ({ ...x, channels: { ...x.channels, [k]: e.target.checked } }))} />{v}</label>)}</div>
      {canApp && <button className="btn pri" style={{ marginTop: 8 }} data-comsave onClick={() => save()}>حفظ</button>}
    </div>
    <div className="card" data-comtpl>
      <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}><div className="card-t" style={{ margin: 0 }}>قوالب الرسائل</div>
        {canApp && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} onClick={() => setT({ name: '', ch: 'whatsapp', body: '' })}>قالب جديد</button>}</div>
      {!F.templates.length && <div className="empty">لا قوالب بعد.</div>}
      {F.templates.map(x => <div key={x.id} className="row" data-tpl={x.name} style={{ gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
        <b>{x.name}</b><span className="badge b-dim">{COMMS_CH[x.ch]}</span><span style={{ flex: 1, fontSize: 12, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.body}</span>
        {canApp && <><button className="btn sm gh" onClick={() => setT({ ...x })}>تعديل</button><button className="btn sm gh" onClick={() => delTpl(x.id)}>حذف</button></>}</div>)}
      <div className="note" style={{ marginTop: 8 }}>المتغيرات المتاحة: {Object.entries(COMMS_VARS).map(([k, v]) => '{' + k + '} ' + v).join(' · ')}</div>
    </div>
    {t && <Modal title={t.id ? 'تعديل قالب' : 'قالب جديد'} icon={MessageSquare} onClose={() => setT(null)} wide foot={<><button className="btn gh" onClick={() => setT(null)}>إلغاء</button><button className="btn pri" onClick={saveTpl}>حفظ القالب</button></>}>
      <div className="row" style={{ gap: 10 }}><Field label="اسم القالب"><input className="inp" aria-label="اسم القالب" value={t.name} onChange={e => setT(x => ({ ...x, name: e.target.value }))} /></Field>
        <Field label="القناة"><select className="sel" aria-label="القناة" value={t.ch} onChange={e => setT(x => ({ ...x, ch: e.target.value }))}>{Object.entries(COMMS_CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field></div>
      <Field label="النص"><textarea className="inp" rows={4} aria-label="نص القالب" value={t.body} onChange={e => setT(x => ({ ...x, body: e.target.value }))} /></Field>
      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{Object.keys(COMMS_VARS).map(k => <button key={k} className="btn sm gh" onClick={() => setT(x => ({ ...x, body: x.body + '{' + k + '}' }))}>{'{' + k + '}'}</button>)}</div>
      <div className="lbl" style={{ margin: '8px 0 4px' }}>معاينة ببيانات تجريبية</div>
      <div className="note" style={{ whiteSpace: 'pre-wrap' }} data-tplprev>{R.text}{F.optOutText ? '\n' + F.optOutText : ''}</div>
      {R.unknown.length > 0 && <div style={{ color: 'var(--rose)', fontSize: 12 }}>متغير غير معروف: {'{' + R.unknown[0] + '}'}</div>}
      {SP && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }} data-smsparts>{SP.chars} حرفًا · {SP.parts} رسالة SMS</div>}
    </Modal>}
  </div>);
}

/* v52.6 — BUG-00-12: فحص سلامة الولاء والكوبونات (رقابة كاشفة) */
function LoyAuditCard({ loy, ops }) {
  const A = useMemo(() => loyAudit(loy, ops), [loy, ops]); const [open, setOpen] = useState(false);
  return (<div className="card" data-loyaudit style={{ borderColor: A.ok ? 'var(--line)' : 'rgba(217,84,77,.45)' }}>
    <div className="row" style={{ alignItems: 'center', gap: 8 }}><div className="card-t" style={{ margin: 0 }}>فحص سلامة النقاط والكوبونات</div>
      <span className={'badge ' + (A.ok ? 'b-mint' : 'b-rose')}>{A.ok ? 'سليم ✓' : (A.flags.length + A.cpn.length) + ' ملاحظة'}</span>
      {(A.flags.length + A.cpn.length + A.manual.n) > 0 && <button className="btn sm gh" style={{ marginInlineStart: 'auto' }} onClick={() => setOpen(o => !o)}>{open ? 'إخفاء' : 'التفاصيل'}</button>}</div>
    <div style={{ fontSize: 12.5, marginTop: 6 }}>فُحصت <b className="num">{A.checked}</b> حركة نقاط مقابل الفواتير والمرتجعات والدمج{A.outOfRange ? ' · ' + A.outOfRange + ' أقدم من الفواتير المحمّلة (مؤرشفة)' : ''} · تعديلات يدوية: <b className="num">{A.manual.n}</b> ({A.manual.pts} نقطة)</div>
    <div className="note" style={{ marginTop: 6 }}>كل حركة نقاط يجب أن يكون لها مصدر: فاتورة بالقيمة نفسها، أو مرتجع، أو إلغاء، أو دمج معتمد، أو جائزة، أو حركة دورية، أو تعديل يدوي مسجّل باسم من أجراه. وكل حجز كوبون أقدم من يوم يجب أن تقابله فاتورة. ما لا مصدر له يظهر هنا للمراجعة.</div>
    {open && <div className="tw" style={{ marginTop: 8 }}><table className="tb" data-loyflags><thead><tr><th>الملاحظة</th><th>العميل</th><th style={{ textAlign: 'end' }}>النقاط</th><th>البيان</th><th>الوقت</th></tr></thead><tbody>
      {A.flags.map(f => <tr key={f.id}><td style={{ color: 'var(--rose)' }}>{LOY_AUDIT_WHY[f.why]}{f.expected != null ? ' (المتوقع ' + f.expected + ')' : ''}</td><td className="num">{f.phone}</td><td className="num" style={{ textAlign: 'end' }}>{f.pts}</td><td>{f.ord}</td><td className="num">{dtLocal(f.at)}</td></tr>)}
      {A.cpn.map(c => <tr key={c.code + c.id}><td style={{ color: 'var(--rose)' }}>{LOY_AUDIT_WHY[c.why]} — {c.code}</td><td className="num">{c.phone}</td><td /><td className="num">{c.id}</td><td className="num">{dtLocal(c.at)}</td></tr>)}
      {A.manual.list.map(m => <tr key={m.id}><td style={{ color: 'var(--amber)' }}>تعديل يدوي</td><td className="num">{m.phone}</td><td className="num" style={{ textAlign: 'end' }}>{m.pts}</td><td>{m.ord}</td><td className="num">{dtLocal(m.at)}</td></tr>)}
    </tbody></table></div>}
  </div>);
}

