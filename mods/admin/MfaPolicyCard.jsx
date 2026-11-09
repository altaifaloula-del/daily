/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { authApi } from '../../storage';
import { ShieldCheck, Check } from 'lucide-react';
import { MFA_DEFAULT_ROLES, ROLES, nowISO } from '../../App.jsx';

export function MfaPolicyCard({ org, me, commitOrg, say }) {
  const [pol, setPol] = useState(null); const [info, setInfo] = useState(null); const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { const [p, i] = await Promise.all([authApi.getPolicy(), authApi.mfaInfo()]); setPol(p || {}); setInfo(i);
    setF({ admins: p && p.at ? !!p.admins : true, roles: p && p.at ? (p.roles || []) : MFA_DEFAULT_ROLES.slice() }); })(); }, []);
  const isAdmin = !!(ROLES[me.role] || {}).admin;
  if (!isAdmin || !f) return null;
  const on = !!(pol && pol.at && (pol.admins || (pol.roles || []).length));
  const save = async (enable) => {
    const next = enable ? f : { admins: false, roles: [] };
    const selfIn = (next.admins && isAdmin) || (next.roles || []).includes(me.role);
    if (selfIn && !(info && info.enrolled && info.used)) return say('فعّل التحقق بخطوتين لحسابك أولًا وادخل بالرمز (من قائمة حسابي) — حتى لا تُقفل المنصة عليك', 'no');
    setBusy(true); const ok = await authApi.setPolicy(next); setBusy(false);
    if (!ok) return say('رفض الخادم حفظ السياسة — تأكد أن دخولك الحالي تم بالرمز', 'no');
    await commitOrg(d => ({ ...d, securityCfg: { ...(d.securityCfg || {}), mfa: { ...next, at: nowISO(), by: me.name } } }), { actionType: 'update', targetType: 'system_settings', targetId: 'mfa-policy', need: 'edit', title: enable ? 'ألزم أدوارًا بالتحقق بخطوتين' : 'أوقف إلزام التحقق بخطوتين', details: enable ? ((next.admins ? 'المدراء، ' : '') + (next.roles || []).map(r => ((ROLES[r] || {}).ar || r).split('—')[0].trim()).join('، ')) : '—' });
    setPol({ ...next, at: Date.now() }); say(enable ? 'فُعّل الإلزام — يُطلب من الأدوار المحددة التسجيل عند دخولها ✓' : 'أُوقف الإلزام');
  };
  const roleKeys = Object.keys(ROLES).filter(k => !(ROLES[k] || {}).admin);
  return (
    <div className="card" style={{ marginTop: 12, background: 'var(--ink)' }}>
      <div className="card-t" style={{ marginBottom: 8 }}><ShieldCheck size={15} color="var(--brass)" />إلزام التحقق بخطوتين{on ? <span className="badge b-mint" style={{ marginInlineStart: 8 }}>مُفعّل</span> : <span className="badge b-dim" style={{ marginInlineStart: 8 }}>غير مُلزِم</span>}</div>
      <div className="note" style={{ marginBottom: 8 }}>الأدوار المحددة لا تصل لبيانات المنصة إلا بجلسة اجتازت الخطوة الثانية — يُفرض ذلك على خادم Firebase نفسه لا في الشاشة فقط. حسابك: {info && info.enrolled ? (info.used ? 'مفعّل ودخلت بالرمز ✓' : 'مفعّل — ادخل بالرمز') : 'غير مفعّل — فعّله من قائمة حسابي أولًا'}.</div>
      <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', marginBottom: 4 }}><input type="checkbox" checked={!!f.admins} onChange={e => setF(x => ({ ...x, admins: e.target.checked }))} />مسؤولو النظام (المدراء)</label>
      {roleKeys.map(k => <label key={k} className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', marginBottom: 4 }}><input type="checkbox" checked={(f.roles || []).includes(k)} onChange={e => setF(x => ({ ...x, roles: e.target.checked ? [...(x.roles || []), k] : (x.roles || []).filter(r => r !== k) }))} />{(ROLES[k].ar || k)}</label>)}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn pri" disabled={busy} onClick={() => save(true)}><Check size={14} />{on ? 'حفظ السياسة' : 'تفعيل الإلزام'}</button>
        {on && <button className="btn gh" disabled={busy} onClick={() => save(false)}>إيقاف الإلزام</button>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8, lineHeight: 1.7 }}>للطوارئ إن فُقدت كل الهواتف: احذف المستند platform/security من لوحة Firebase ← Firestore فيتوقف الإلزام فورًا.</div>
    </div>);
}
