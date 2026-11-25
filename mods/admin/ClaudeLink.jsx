/* v53.5 — ربط Claude بمُكتسَب (موصل MCP للقراءة فقط): إنشاء رابط سري، نسخه مرة واحدة، متابعة الاستخدام، والإلغاء */
import React, { useState, useEffect } from 'react';
import { Link2, Copy, Trash2, Plus, ShieldCheck, Check, X } from 'lucide-react';
import { aiHeaders, mcpApi, dtLocal, money, uid, today, MCP_KINDS, mcpPlanJournal, mcpPlanReclass, mcpApplyReclass, mcpPlanExp, xiRecords, nextPartnerCode } from '../../App.jsx';

const TOOLS_W = ['اقتراح قيد يومية', 'اقتراح إعادة تصنيف فواتير', 'اقتراح فواتير مصروفات ومشتريات'];
const TOOLS_AR = ['نظرة عامة على المنشأة والفروع', 'دليل الحسابات', 'ميزان المراجعة', 'قائمة الدخل', 'دفتر أستاذ أي حساب', 'المبيعات حسب الفرع والشهر', 'المشتريات والمصروفات حسب التصنيف', 'أرصدة الموردين والمتأخرات', 'البحث في فواتير الموردين (PJ- / IMP-)', 'قيود اليومية'];

export function ClaudeLink({ org, ops, me, commit, commitOrg, say }) {
  const [links, setLinks] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(''); const [fresh, setFresh] = useState(null); const [scope, setScope] = useState([]);   // v54.6 نطاق الفروع
  const load = async () => { try { const j = await mcpApi('GET', 'links'); setLinks(j.links || []); setErr(null); } catch (e) { setErr(e); setLinks([]); } };
  useEffect(() => { load(); }, []);
  const create = async () => {
    setBusy(true);
    try { const j = await mcpApi('POST', 'links', { label: label.trim() || 'Claude', branches: scope }); setFresh(j); setLabel(''); setScope([]); await load(); say('أُنشئ رابط الربط ✓ — انسخه الآن، لن يظهر مرة أخرى'); }
    catch (e) { say(e.message, 'no'); if (e.code === 'no-sa') setErr(e); } finally { setBusy(false); }
  };
  const revoke = async (l) => {
    if (!window.confirm('إلغاء رابط «' + (l.label || 'Claude') + '»؟ يتوقف Claude عن قراءة بيانات المنشأة به فورًا.')) return;
    try { await mcpApi('POST', 'links/revoke', { id: l.id }); if (fresh && fresh.id === l.id) setFresh(null); await load(); say('أُلغي الرابط ✓'); } catch (e) { say(e.message, 'no'); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(fresh.url); say('نُسخ الرابط ✓'); } catch { say('انسخ الرابط يدويًا من الحقل', 'no'); } };
  const active = (links || []).filter(l => l.active);
  if (me && me.role !== 'system_admin') return <div className="card"><div className="empty">ربط Claude لمسؤول النظام فقط</div></div>;
  return (<>
    <div className="card" data-claudelink>
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}><Link2 size={18} /><b>ربط Claude بمُكتسَب (موصل للقراءة فقط)</b></div>
      <div style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--dim)' }}>
        يتيح لك سؤال Claude (في تطبيقه على الجوال أو الكمبيوتر) عن بيانات منشأتك الحية مباشرة: «كم مصروفات الصيانة في النسيم هذا الشهر؟»، «ما الموردون المتأخرون؟»، «قارن مبيعات الفروع».
        <b> Claude يقرأ مباشرة، ولا يكتب إلا «مقترحات»</b> تظهر لك في «مقترحات Claude» أدناه — لا يُنفَّذ أي مقترح إلا حين تضغط «اعتماد وتنفيذ»، وبنفس تحقق النظام (الإقفال، التوازن، التكرار). لا يستطيع الحذف أبدًا.
      </div>
      <div className="grid g2" style={{ marginTop: 10, gap: 12 }}>
        <div className="note" style={{ fontSize: 12.5, lineHeight: 1.9 }}><b>طريقة الربط</b><ol style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
          <li>أنشئ رابطًا هنا وانسخه.</li><li>في Claude: الإعدادات ← الموصلات ← إضافة موصل مخصص.</li><li>الاسم: «مُكتسَب»، والرابط: الصق الرابط المنسوخ، ثم «إضافة».</li><li>فعّل موصل «مُكتسَب» في المحادثة واسأل.</li></ol></div>
        <div className="note" style={{ fontSize: 12.5, lineHeight: 1.9 }}><b>ما يستطيع Claude قراءته</b><div>{TOOLS_AR.join(' · ')}</div><b>وما يستطيع اقتراحه (باعتمادك)</b><div>{TOOLS_W.join(' · ')}</div></div>
      </div>
      <div className="note" style={{ marginTop: 10, fontSize: 12.5, borderColor: 'rgba(217,164,65,.5)' }}><ShieldCheck size={13} /> الرابط نفسه هو المفتاح: من يملكه يقرأ بيانات المنشأة المالية. لا ترسله لأحد ولا تنشره، وألغِه فورًا إن شككت. يتوقف تلقائيًا إذا لم يعد صاحبه مسؤول نظام نشطًا.</div>
      {err && err.code === 'no-sa' && <div className="note" data-mcpnosa style={{ marginTop: 10, borderColor: 'rgba(217,84,77,.5)' }}>يلزم أولًا ضبط حساب الخدمة على الخادم: في Render ← Environment أضف <code>FIREBASE_SERVICE_ACCOUNT</code> (ملف JSON لحساب خدمة مشروع Firebase) ثم أعد تشغيل الخدمة.</div>}
      {err && err.code !== 'no-sa' && <div className="note" style={{ marginTop: 10 }} data-mcperr>{err.message}</div>}
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input className="inp" style={{ maxWidth: 260 }} placeholder="اسم الرابط (مثل: جوالي)" aria-label="اسم الرابط" value={label} maxLength={60} onChange={e => setLabel(e.target.value)} />
        <span style={{ fontSize: 12 }} data-mcpscope>النطاق: {(org.branches || []).map(b => <label key={b.id} style={{ marginInlineEnd: 8 }}><input type="checkbox" checked={scope.includes(b.id)} onChange={e => setScope(e.target.checked ? [...scope, b.id] : scope.filter(x => x !== b.id))} /> {b.name}</label>)}
          <small style={{ color: 'var(--dim)' }}>{scope.length ? 'مقيّد بالفروع المحددة — بلا بيانات المركز' : 'كل المنشأة'}</small></span>
        <button className="btn pri" data-mcpnew disabled={busy} onClick={create}><Plus size={14} />{busy ? 'جارٍ الإنشاء…' : 'إنشاء رابط ربط'}</button>
      </div>
      {fresh && <div className="note" data-mcpfresh style={{ marginTop: 10, borderColor: 'rgba(76,175,125,.6)' }}>
        <div style={{ fontSize: 12.5, marginBottom: 6 }}>رابط «{fresh.label}» — <b>انسخه الآن، لن يظهر مرة أخرى</b>:</div>
        <div className="row" style={{ gap: 6 }}><input className="inp n" dir="ltr" readOnly value={fresh.url} aria-label="رابط الربط" onFocus={e => e.target.select()} style={{ fontSize: 11.5 }} />
          <button className="btn sm pri" onClick={copy}><Copy size={13} />نسخ</button></div></div>}
    </div>
    <Proposals org={org} ops={ops} me={me} commit={commit} commitOrg={commitOrg} say={say} />
    <AiLog />
    <div className="card">
      <b style={{ fontSize: 14 }}>الروابط ({active.length} نشط)</b>
      <div className="tw" style={{ marginTop: 8 }}><table className="tb" data-mcplinks><thead><tr><th>الاسم</th><th>أنشأه</th><th>الإنشاء</th><th>آخر استخدام</th><th>الطلبات</th><th>النطاق</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{(links || []).map(l => <tr key={l.id}><td>{l.label || 'Claude'} <small className="num" style={{ color: 'var(--faint)' }}>…{l.hint}</small></td><td style={{ fontSize: 11.5 }}>{l.email}</td>
          <td className="num" style={{ fontSize: 11.5 }}>{l.createdAt ? dtLocal(l.createdAt) : ''}</td><td className="num" style={{ fontSize: 11.5 }}>{l.lastUsedAt ? dtLocal(l.lastUsedAt) : '—'}</td><td className="num">{l.calls || 0}</td><td style={{ fontSize: 11.5 }}>{(l.branches || []).length ? l.branches.map(id => (((org.branches || []).find(b => b.id === id)) || {}).name || id).join('، ') : 'كل المنشأة'}</td>
          <td><span className={'badge ' + (l.active ? 'b-mint' : 'b-dim')}>{l.active ? 'نشط' : 'ملغى'}</span></td>
          <td>{l.active && <button className="btn sm gh" data-mcprevoke onClick={() => revoke(l)}><Trash2 size={13} />إلغاء</button>}</td></tr>)}
          {links && !links.length && <tr><td colSpan={8}><div className="empty">لا روابط بعد</div></td></tr>}
          {!links && <tr><td colSpan={8}><div className="empty">جارٍ التحميل…</div></td></tr>}</tbody></table></div>
    </div>
  </>);
}

/* v53.7 — مقترحات Claude: مراجعة واعتماد/رفض. التنفيذ هنا بالحفظ العادي (نفس الحراس والتدقيق)، ثم يُبلَّغ الخادم بالقرار */
function Proposals({ org, ops, me, commit, commitOrg, say }) {
  const [list, setList] = useState(null); const [busy, setBusy] = useState(''); const [open, setOpen] = useState({}); const [hist, setHist] = useState(false);
  const load = async () => { try { const j = await mcpApi('GET', 'proposals'); setList(j.proposals || []); } catch (e) { setList([]); } };
  useEffect(() => { load(); }, []);
  const decide = async (p, decision, note) => { try { await mcpApi('POST', 'proposals/decide', { id: p.id, decision, note }); } catch (e) { say(e.message, 'no'); } await load(); };
  const applyOne = async (p) => {
    const P = p.payload || {}; const tag = 'Claude · ' + p.id;
    if (p.kind === 'journal') {
      if ((ops.journalManual || []).some(j => j.mcpProposal === p.id)) return 'سبق تنفيذه';
      const J = mcpPlanJournal(org, { ...P, _pid: p.id }, me); if (!J.ok) throw new Error(J.errs.join(' · '));
      const ok = await commit(d => (d.journalManual || []).some(j => j.mcpProposal === p.id) ? d : ({ ...d, journalManual: [J.rec, ...(d.journalManual || [])] }),
        { actionType: 'create', targetType: 'journal_entry', targetId: J.rec.id, need: 'post', title: 'اعتمد قيدًا مقترحًا من Claude', details: tag + ' · ' + J.rec.title + ' · ' + money(J.total) + ' ر.س' });
      if (ok === false) throw new Error('تعذّر الحفظ'); return 'قيد ' + money(J.total) + (J.rec.status === 'posted' ? ' مرحّل' : ' بانتظار اعتماد القيد');
    }
    if (p.kind === 'reclass') {
      const want = new Map((P.changes || []).map(c => [c.id, c])); const R = mcpPlanReclass(org, ops, { changes: P.changes || [] });
      const ok1 = R.ok.filter(x => (want.get(x.id) || {}).from === x.from); if (!ok1.length) throw new Error('لا فاتورة قابلة للنقل الآن (' + R.skipped.length + ' متجاوزة)');
      let n = 0; const ok = await commit(d => { const r = mcpApplyReclass(d.invoices, ok1, { by: (me && me.name) || '', pid: p.id }); n = r.n; return { ...d, invoices: r.list }; },
        { actionType: 'update', targetType: 'invoice', targetId: p.id, need: 'post', title: 'اعتمد إعادة تصنيف فواتير مقترحة من Claude', details: tag + ' · ' + ok1.length + ' فاتورة · ' + money(ok1.reduce((a, x) => a + x.amount, 0)) + ' ر.س' });
      if (ok === false) throw new Error('تعذّر الحفظ'); return 'نُقلت ' + ok1.length + ' فاتورة' + (R.skipped.length ? ' وتُجووزت ' + R.skipped.length : '');
    }
    if (p.kind === 'expinv') {
      const X = mcpPlanExp(org, ops, P);
      if (!X.ok) { if ((ops.invoices || []).some(i => i.mcpProposal === p.id)) return 'سبق تنفيذه'; throw new Error('لا فاتورة صالحة الآن: ' + X.rows.filter(r => !r.ok).slice(0, 3).map(r => r.err.join('، ')).join(' · ')); }
      const supIds = {};
      if (X.newSup.length || X.supVatFix.length) {
        const ok = await commitOrg(d => { const fix = new Map(X.supVatFix.map(f => [f.id, f.vatNo]));
          const sups = (d.suppliers || []).map(s => fix.has(s.id) && !String(s.vatNo || '').trim() ? { ...s, vatNo: fix.get(s.id), taxable: true } : s); const all = sups.map(s => ({ ...s, type: 'supplier' }));
          X.newSup.forEach(s => { const id = uid('sp'); const code = nextPartnerCode(all, 'supplier'); all.push({ code, type: 'supplier' }); supIds[s.id] = id;
            sups.push({ id, code, name: s.name, category: '', phone: '', vatNo: s.vatNo || '', address: '', taxable: !!s.vatNo, terms: 0, createdAt: today(), source: 'claude' }); });
          return { ...d, suppliers: sups }; }, { actionType: 'create', targetType: 'partner', targetId: p.id, title: 'أضاف موردين من مقترح Claude', details: tag + ' · ' + X.newSup.map(s => s.name).join('، ') });
        if (ok === false) throw new Error('تعذّر حفظ الموردين');
      }
      const recs = xiRecords(X, { me, supIds, batch: 'mcp-' + p.id }).map(r => ({ ...r, mcpProposal: p.id }));
      const ok = await commit(d => ({ ...d, invoices: [...recs, ...(d.invoices || [])] }), { actionType: 'create', targetType: 'expense', targetId: p.id, title: 'اعتمد فواتير مصروفات مقترحة من Claude', details: tag + ' · ' + recs.length + ' فاتورة · ' + money(X.sum) + ' ر.س' });
      if (ok === false) throw new Error('تعذّر حفظ الفواتير'); return 'سُجّلت ' + recs.length + ' فاتورة بـ ' + money(X.sum) + (X.bad ? ' (' + X.bad + ' لم تعد صالحة)' : '');
    }
    throw new Error('نوع غير معروف');
  };
  const approve = async (p) => {
    if (!window.confirm('اعتماد وتنفيذ: ' + (MCP_KINDS[p.kind] || p.kind) + ' — ' + p.title + '؟\nيُنفَّذ بالحفظ العادي في مُكتسَب ويُسجَّل في سجل التدقيق.')) return;
    setBusy(p.id); try { const r = await applyOne(p); await decide(p, 'applied', r); say('نُفّذ المقترح ✓ — ' + r); } catch (e) { say('لم يُنفَّذ: ' + e.message, 'no'); } finally { setBusy(''); }
  };
  const reject = async (p) => { const note = window.prompt('سبب الرفض (يراه Claude):', ''); if (note === null) return; setBusy(p.id); await decide(p, 'rejected', note); setBusy(''); say('رُفض المقترح'); };
  const pend = (list || []).filter(p => p.status === 'pending'), done = (list || []).filter(p => p.status !== 'pending');
  const S = (p) => p.summary || {};
  const Detail = ({ p }) => p.kind === 'journal' ? <table className="tb" style={{ fontSize: 12 }}><thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead><tbody>{(S(p).lines || []).map((l, i) => <tr key={i}><td>{l.code} · {l.name}</td><td className="num">{l.debit ? money(l.debit) : ''}</td><td className="num">{l.credit ? money(l.credit) : ''}</td></tr>)}</tbody></table>
    : p.kind === 'reclass' ? <table className="tb" style={{ fontSize: 12 }}><thead><tr><th>من</th><th>إلى</th><th>الفواتير</th><th>القيمة</th></tr></thead><tbody>{(S(p).groups || []).map((g, i) => <tr key={i}><td>{g.from}</td><td>{g.to}</td><td className="num">{g.count}</td><td className="num">{money(g.total)}</td></tr>)}</tbody></table>
    : <table className="tb" style={{ fontSize: 12 }}><thead><tr><th>التاريخ</th><th>المورد</th><th>الفاتورة</th><th>الحساب</th><th>الصافي</th><th>الضريبة</th><th>الدفع</th></tr></thead><tbody>{((p.payload || {}).invoices || []).slice(0, 100).map((r, i) => <tr key={i}><td className="num">{r.date}</td><td>{r.supplier}</td><td className="num">{r.invoice_no}</td><td className="num">{r.account}</td><td className="num">{r.net != null ? money(r.net) : ''}</td><td className="num">{r.vat != null ? money(r.vat) : ''}</td><td>{r.payment === 'cash' ? 'نقدي' : r.payment === 'bank' ? 'بنك' : 'آجل'}</td></tr>)}</tbody></table>;
  const line = (p) => p.kind === 'journal' ? S(p).date + ' · ' + S(p).branch + ' · ' + money(S(p).total) + ' ر.س' : p.kind === 'reclass' ? S(p).count + ' فاتورة · ' + money(S(p).total) + ' ر.س' + (S(p).skipped ? ' · تُجووزت ' + S(p).skipped : '') : S(p).count + ' فاتورة · ' + money(S(p).total) + ' ر.س' + ((S(p).new_suppliers || []).length ? ' · موردون جدد: ' + S(p).new_suppliers.join('، ') : '');
  return (
    <div className="card" data-mcpprops>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 14 }}>مقترحات Claude {pend.length > 0 && <span className="badge b-amber" data-mcppend>{pend.length} بانتظار اعتمادك</span>}</b>
        <button className="btn sm gh" onClick={load}>تحديث</button></div>
      {!list && <div className="empty">جارٍ التحميل…</div>}
      {list && !pend.length && <div className="empty">لا مقترحات بانتظار الاعتماد — اطلب من Claude مثلًا: «اقترح قيد إثبات إيجار يونيو».</div>}
      {pend.map(p => <div key={p.id} className="note" data-mcpprop={p.kind} style={{ marginTop: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span className="badge b-violet">{MCP_KINDS[p.kind] || p.kind}</span><b>{p.title}</b><span style={{ fontSize: 11.5, color: 'var(--dim)' }}>{line(p)}</span></div>
        {p.reason && <div style={{ fontSize: 12, marginTop: 4 }}>السبب: {p.reason}</div>}
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{dtLocal(p.createdAt)} · {p.by}</div>
        <button className="btn sm gh" style={{ marginTop: 4 }} onClick={() => setOpen(o => ({ ...o, [p.id]: !o[p.id] }))}>{open[p.id] ? 'إخفاء التفاصيل' : 'التفاصيل'}</button>
        {open[p.id] && <div className="tw" style={{ marginTop: 6 }}><Detail p={p} /></div>}
        <div className="row" style={{ gap: 6, marginTop: 8 }}><button className="btn sm pri" data-mcpapprove disabled={!!busy} onClick={() => approve(p)}><Check size={13} />{busy === p.id ? 'جارٍ التنفيذ…' : 'اعتماد وتنفيذ'}</button>
          <button className="btn sm gh" data-mcpreject disabled={!!busy} onClick={() => reject(p)}><X size={13} />رفض</button></div>
      </div>)}
      {done.length > 0 && <div style={{ marginTop: 10 }}><button className="btn sm gh" onClick={() => setHist(h => !h)}>{hist ? 'إخفاء السجل' : 'سجل المقترحات (' + done.length + ')'}</button>
        {hist && <table className="tb" style={{ fontSize: 12, marginTop: 6 }}><tbody>{done.slice(0, 30).map(p => <tr key={p.id}><td>{MCP_KINDS[p.kind]}</td><td>{p.title}</td><td><span className={'badge ' + (p.status === 'applied' ? 'b-mint' : 'b-dim')}>{p.status === 'applied' ? 'نُفّذ' : 'رُفض'}</span></td><td style={{ fontSize: 11 }}>{p.note}</td><td className="num" style={{ fontSize: 11 }}>{dtLocal(p.decidedAt)}</td></tr>)}</tbody></table>}</div>}
    </div>);
}

/* v54.6 — المرحلة 7: سجل الذكاء الاصطناعي — من استخدم الذكاء الاصطناعي أو الموصل أو المراجعة، ومتى، وبأي نتيجة (بلا محتوى البيانات) */
function AiLog() {
  const [log, setLog] = useState(null); const [kinds, setKinds] = useState({}); const [err, setErr] = useState(''); const [k, setK] = useState('');
  const load = async () => { try { const b = (import.meta.env || {}).VITE_ZATCA_ENDPOINT || ''; if (!b) throw new Error('الخادم غير مهيأ لهذه النسخة');
    const r = await fetch(String(b).replace(/\/+$/, '') + '/api/ai/log', { headers: await aiHeaders() }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    setLog(j.log || []); setKinds(j.kinds || {}); setErr(''); } catch (e) { setErr(e.message); setLog([]); } };
  useEffect(() => { load(); }, []);
  const rows = (log || []).filter(x => !k || x.kind === k);
  return <div className="card" data-ailog>
    <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 14 }}>سجل الذكاء الاصطناعي</b><small style={{ color: 'var(--dim)' }}>كل تحليل ومراجعة واستدعاء للموصل وقرار على مقترح — دون محتوى البيانات</small>
      <select className="sel" style={{ maxWidth: 200 }} aria-label="نوع السجل" value={k} onChange={e => setK(e.target.value)}><option value="">الكل</option>{Object.entries(kinds).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
      <button className="btn sm gh" onClick={load}>تحديث</button></div>
    {err && <div className="note" style={{ marginTop: 8 }}>{err}</div>}
    <div className="tw" style={{ marginTop: 8 }}><table className="tb" style={{ fontSize: 11.5 }}><thead><tr><th>الوقت</th><th>المستخدم</th><th>النوع</th><th>الوظيفة</th><th>النتيجة</th><th>المدة</th><th>تفاصيل</th></tr></thead>
      <tbody>{rows.slice(0, 300).map(x => <tr key={x.id} data-ailogrow><td className="num">{x.at ? dtLocal(x.at) : ''}</td><td>{x.by}</td><td>{kinds[x.kind] || x.kind}</td><td className="num">{x.name}</td>
        <td><span className={'badge ' + (x.ok ? 'b-mint' : 'b-rose')}>{x.ok ? 'نجح' : 'فشل ' + (x.status || '')}</span></td><td className="num">{x.ms ? x.ms + 'ms' : ''}</td><td>{x.detail}</td></tr>)}
        {log && !rows.length && <tr><td colSpan={7}><div className="empty">لا سجلات</div></td></tr>}</tbody></table></div>
  </div>;
}
