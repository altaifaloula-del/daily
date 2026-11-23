/* v53.5 — ربط Claude بمثقال (موصل MCP للقراءة فقط): إنشاء رابط سري، نسخه مرة واحدة، متابعة الاستخدام، والإلغاء */
import React, { useState, useEffect } from 'react';
import { Link2, Copy, Trash2, Plus, ShieldCheck } from 'lucide-react';
import { mcpApi, dtLocal } from '../../App.jsx';

const TOOLS_AR = ['نظرة عامة على المنشأة والفروع', 'دليل الحسابات', 'ميزان المراجعة', 'قائمة الدخل', 'دفتر أستاذ أي حساب', 'المبيعات حسب الفرع والشهر', 'المشتريات والمصروفات حسب التصنيف', 'أرصدة الموردين والمتأخرات', 'البحث في فواتير الموردين (PJ- / IMP-)', 'قيود اليومية'];

export function ClaudeLink({ me, say }) {
  const [links, setLinks] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(''); const [fresh, setFresh] = useState(null);
  const load = async () => { try { const j = await mcpApi('GET', 'links'); setLinks(j.links || []); setErr(null); } catch (e) { setErr(e); setLinks([]); } };
  useEffect(() => { load(); }, []);
  const create = async () => {
    setBusy(true);
    try { const j = await mcpApi('POST', 'links', { label: label.trim() || 'Claude' }); setFresh(j); setLabel(''); await load(); say('أُنشئ رابط الربط ✓ — انسخه الآن، لن يظهر مرة أخرى'); }
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
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 6 }}><Link2 size={18} /><b>ربط Claude بمثقال (موصل للقراءة فقط)</b></div>
      <div style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--dim)' }}>
        يتيح لك سؤال Claude (في تطبيقه على الجوال أو الكمبيوتر) عن بيانات منشأتك الحية مباشرة: «كم مصروفات الصيانة في النسيم هذا الشهر؟»، «ما الموردون المتأخرون؟»، «قارن مبيعات الفروع».
        <b> Claude يقرأ فقط</b> — لا يستطيع إنشاء أو تعديل أو حذف أي شيء.
      </div>
      <div className="grid g2" style={{ marginTop: 10, gap: 12 }}>
        <div className="note" style={{ fontSize: 12.5, lineHeight: 1.9 }}><b>طريقة الربط</b><ol style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>
          <li>أنشئ رابطًا هنا وانسخه.</li><li>في Claude: الإعدادات ← الموصلات ← إضافة موصل مخصص.</li><li>الاسم: «مثقال»، والرابط: الصق الرابط المنسوخ، ثم «إضافة».</li><li>فعّل موصل «مثقال» في المحادثة واسأل.</li></ol></div>
        <div className="note" style={{ fontSize: 12.5, lineHeight: 1.9 }}><b>ما يستطيع Claude قراءته</b><div>{TOOLS_AR.join(' · ')}</div></div>
      </div>
      <div className="note" style={{ marginTop: 10, fontSize: 12.5, borderColor: 'rgba(217,164,65,.5)' }}><ShieldCheck size={13} /> الرابط نفسه هو المفتاح: من يملكه يقرأ بيانات المنشأة المالية. لا ترسله لأحد ولا تنشره، وألغِه فورًا إن شككت. يتوقف تلقائيًا إذا لم يعد صاحبه مسؤول نظام نشطًا.</div>
      {err && err.code === 'no-sa' && <div className="note" data-mcpnosa style={{ marginTop: 10, borderColor: 'rgba(217,84,77,.5)' }}>يلزم أولًا ضبط حساب الخدمة على الخادم: في Render ← Environment أضف <code>FIREBASE_SERVICE_ACCOUNT</code> (ملف JSON لحساب خدمة مشروع Firebase) ثم أعد تشغيل الخدمة.</div>}
      {err && err.code !== 'no-sa' && <div className="note" style={{ marginTop: 10 }} data-mcperr>{err.message}</div>}
      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input className="inp" style={{ maxWidth: 260 }} placeholder="اسم الرابط (مثل: جوالي)" aria-label="اسم الرابط" value={label} maxLength={60} onChange={e => setLabel(e.target.value)} />
        <button className="btn pri" data-mcpnew disabled={busy} onClick={create}><Plus size={14} />{busy ? 'جارٍ الإنشاء…' : 'إنشاء رابط ربط'}</button>
      </div>
      {fresh && <div className="note" data-mcpfresh style={{ marginTop: 10, borderColor: 'rgba(76,175,125,.6)' }}>
        <div style={{ fontSize: 12.5, marginBottom: 6 }}>رابط «{fresh.label}» — <b>انسخه الآن، لن يظهر مرة أخرى</b>:</div>
        <div className="row" style={{ gap: 6 }}><input className="inp n" dir="ltr" readOnly value={fresh.url} aria-label="رابط الربط" onFocus={e => e.target.select()} style={{ fontSize: 11.5 }} />
          <button className="btn sm pri" onClick={copy}><Copy size={13} />نسخ</button></div></div>}
    </div>
    <div className="card">
      <b style={{ fontSize: 14 }}>الروابط ({active.length} نشط)</b>
      <div className="tw" style={{ marginTop: 8 }}><table className="tb" data-mcplinks><thead><tr><th>الاسم</th><th>أنشأه</th><th>الإنشاء</th><th>آخر استخدام</th><th>الطلبات</th><th>الحالة</th><th></th></tr></thead>
        <tbody>{(links || []).map(l => <tr key={l.id}><td>{l.label || 'Claude'} <small className="num" style={{ color: 'var(--faint)' }}>…{l.hint}</small></td><td style={{ fontSize: 11.5 }}>{l.email}</td>
          <td className="num" style={{ fontSize: 11.5 }}>{l.createdAt ? dtLocal(l.createdAt) : ''}</td><td className="num" style={{ fontSize: 11.5 }}>{l.lastUsedAt ? dtLocal(l.lastUsedAt) : '—'}</td><td className="num">{l.calls || 0}</td>
          <td><span className={'badge ' + (l.active ? 'b-mint' : 'b-dim')}>{l.active ? 'نشط' : 'ملغى'}</span></td>
          <td>{l.active && <button className="btn sm gh" data-mcprevoke onClick={() => revoke(l)}><Trash2 size={13} />إلغاء</button>}</td></tr>)}
          {links && !links.length && <tr><td colSpan={7}><div className="empty">لا روابط بعد</div></td></tr>}
          {!links && <tr><td colSpan={7}><div className="empty">جارٍ التحميل…</div></td></tr>}</tbody></table></div>
    </div>
  </>);
}
