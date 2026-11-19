/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { UserCog, Check, Scale, Lock } from 'lucide-react';
import { ACCT_SECTIONS, ACCT_SEC_AR, LAUNCH_APPS, ROLES, acctSecKey, EDIT_KINDS, editPermOf, rolePost, roleEdit } from '../../App.jsx';
import { authApi } from '../../storage';

/* v51.9 — صلاحيات التعديل لكل مستخدم (طلب المالك): القيود اليدوية وفواتير الموردين — اختيارية يحددها المسؤول */
const MODE_AR = { role: 'حسب الدور', allow: 'مسموح', deny: 'ممنوع' };
function EditPermsCard({ u, commitOrg, say }) {
  const init = () => Object.fromEntries(Object.keys(EDIT_KINDS).map(k => [k, editPermOf(u, k)]));
  const [f, setF] = useState(init);
  useEffect(() => { setF(init()); }, [u.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const canPostRole = rolePost(u.role), roleCan = roleEdit(u.role);
  const set = (k, patch) => setF(x => ({ ...x, [k]: { ...x[k], ...patch } }));
  const save = async () => {
    const ep = Object.fromEntries(Object.entries(f).filter(([, v]) => v.mode !== 'role' || v.own || v.days).map(([k, v]) => [k, { mode: v.mode, ...(v.own ? { own: true } : {}), ...(v.days ? { days: v.days } : {}) }]));
    const ok = await commitOrg(d => ({ ...d, users: (d.users || []).map(x => x.id === u.id ? (Object.keys(ep).length ? { ...x, editPerms: ep } : (({ editPerms, ...rest }) => rest)(x)) : x) }), {
      actionType: 'update', targetType: 'user_perms', targetId: u.id, need: 'edit', title: 'حدّد صلاحيات التعديل لمستخدم',
      details: u.name + ' · ' + Object.keys(EDIT_KINDS).map(k => EDIT_KINDS[k] + ': ' + MODE_AR[f[k].mode] + (f[k].own ? ' (ما أدخله فقط)' : '') + (f[k].days ? ' (آخر ' + f[k].days + ' يوم)' : '')).join(' · ') });
    if (ok === false) return;
    // «ممنوع» يُنسخ لعضوية الخادم فترفض قواعد Firestore الحذف للسجلات المالية المستقلة أيضًا
    if (u.email && authApi.enabled) { try { await authApi.upsertMember(u.email, { editDeny: Object.keys(f).filter(k => f[k].mode === 'deny') }); } catch { } }
    say('حُفظت صلاحيات التعديل لـ ' + u.name);
  };
  return (
    <div className="card mq-editperms">
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <Lock size={16} color="var(--brass)" />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>صلاحيات التعديل لـ {u.name}</span>
        <span className="badge b-dim" style={{ marginInlineStart: 'auto' }}>دوره: {roleCan ? 'يعدّل' : canPostRole ? 'يُدخل بلا تعديل' : 'لا يُدخل قيودًا ولا فواتير'}</span>
      </div>
      {!canPostRole ? <div className="note">دور هذا المستخدم لا يُدخل قيودًا ولا فواتير — لا تُمنح له صلاحية تعديل. غيّر دوره أولًا إن لزم.</div> : <>
        <div className="note" style={{ marginBottom: 10 }}>«حسب الدور» يبقي الصلاحية كما هي. «مسموح» يمنحه التعديل ولو كان دوره بلا تعديل، و«ممنوع» يسحبه حتى لو كان دوره يعدّل. ويمكن حصرها فيما أدخله هو، أو في آخر أيام محددة. القيد المرحّل يُعدَّل بقيد عكسي وقيد مصحَّح (لا يُمسح أثره)، والفترة المقفلة تبقى مقفلة.</div>
        {Object.keys(EDIT_KINDS).map(k => <div key={k} className="row" data-perm={k} style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
          <b style={{ minWidth: 190, fontSize: 12.5 }}>{EDIT_KINDS[k]}</b>
          <select className="sel" aria-label={EDIT_KINDS[k]} value={f[k].mode} onChange={e => set(k, { mode: e.target.value })}>
            {['role', 'allow', 'deny'].map(m => <option key={m} value={m}>{MODE_AR[m]}{m === 'role' ? (roleCan ? ' (يعدّل)' : ' (لا يعدّل)') : ''}</option>)}
          </select>
          {f[k].mode !== 'deny' && <>
            <label className="row" style={{ gap: 5, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={f[k].own} onChange={e => set(k, { own: e.target.checked })} />ما أدخله هو فقط</label>
            <label className="row" style={{ gap: 5, fontSize: 12 }}>خلال آخر<input className="inp n" style={{ width: 64 }} inputMode="numeric" value={f[k].days || ''} placeholder="∞" onChange={e => set(k, { days: Math.max(0, Math.min(3650, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)) })} />يومًا</label>
          </>}
        </div>)}
        <button className="btn pri sm" onClick={save}><Check size={14} />حفظ صلاحيات التعديل</button>
      </>}
    </div>
  );
}

export function AppPermsPanel({ org, commitOrg, say }) {
  const editable = (org.users || []).filter(u => !ROLES[u.role]?.admin);
  const [uid1, setUid1] = useState(editable[0]?.id || '');
  const u = (org.users || []).find(x => x.id === uid1);
  if (!editable.length || !u) return <div className="card"><div className="empty">لا يوجد مستخدم قابل للتخصيص — أدوار الإدارة ترى كل التطبيقات دائمًا.</div></div>;
  const roleTabs = ROLES[u.role]?.tabs || [];
  const roleHas = (a) => roleTabs.includes(a.open.tab);
  const allow = u.appAllow || [], deny = u.appDeny || [];
  const isOn = (a) => { let on = roleHas(a); if (allow.includes(a.id)) on = true; if (deny.includes(a.id)) on = false; return on; };
  const toggle = async (a) => {
    const role = roleHas(a);
    let nAllow = allow.filter(x => x !== a.id), nDeny = deny.filter(x => x !== a.id);
    const target = !isOn(a);
    if (target && !role) nAllow = [...nAllow, a.id];
    if (!target && role) nDeny = [...nDeny, a.id];
    await commitOrg(d => ({ ...d, users: (d.users || []).map(x => x.id === u.id ? { ...x, appAllow: nAllow, appDeny: nDeny } : x) }), {
      actionType: 'update', targetType: 'user_apps', targetId: u.id, need: 'edit', title: 'خصّص ظهور تطبيقات لمستخدم', details: u.name + ' · ' + a.ar
    });
    say('حُدِّث ظهور «' + a.ar + '» لـ ' + u.name);
  };
  // v15.10: تخصيص أقسام شاشة المحاسبة لكل مستخدم (تُخزَّن كـ acctsec:<view> في appDeny)
  const toggleSec = async (v) => {
    const key = acctSecKey(v); const was = deny.includes(key);
    const nDeny = was ? deny.filter(x => x !== key) : [...deny, key];
    await commitOrg(d => ({ ...d, users: (d.users || []).map(x => x.id === u.id ? { ...x, appDeny: nDeny } : x) }), {
      actionType: 'update', targetType: 'user_apps', targetId: u.id, need: 'edit', title: 'خصّص أقسام المحاسبة لمستخدم', details: u.name + ' · ' + ACCT_SEC_AR[v] + ' · ' + (was ? 'إظهار' : 'إخفاء')
    });
    say((was ? 'أُظهر' : 'أُخفي') + ' قسم «' + ACCT_SEC_AR[v] + '» لـ ' + u.name);
  };
  const acctUser = (ROLES[u.role]?.tabs || []).includes('acct');
  const apps = LAUNCH_APPS;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <UserCog size={16} color="var(--brass)" />
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>ظهور التطبيقات لكل مستخدم</span>
          <select className="sel" style={{ minWidth: 230 }} value={uid1} onChange={e => setUid1(e.target.value)}>
            {editable.map(x => <option key={x.id} value={x.id}>{x.name} — {(ROLES[x.role]?.ar || x.role).split('—')[0].trim()}</option>)}
          </select>
          <span className="badge b-dim" style={{ marginInlineStart: 'auto' }}>اضغط أي تطبيق لتغيير ظهوره لهذا المستخدم</span>
        </div>
        <div className="appperm-grid">
          {apps.map(a => {
            const on = isOn(a), role = roleHas(a);
            const lbl = on ? (role && !deny.includes(a.id) ? 'بالدور' : 'مُضاف يدويًا') : (role ? 'مُخفى يدويًا' : 'غير ظاهر');
            const cls = (on && role && !deny.includes(a.id)) ? ' role' : (on && !role) ? ' ovr' : (!on && role) ? ' ovr' : ' off';
            return (
              <button key={a.id} className={'appperm' + (on ? ' on' : '') + cls} onClick={() => toggle(a)}>
                <span className="ic"><a.icon size={15} /></span>
                <span className="nm">{a.ar}<small>{lbl}</small></span>
                <span className="tk">{on ? <Check size={13} /> : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* v15.10: تخصيص أقسام شاشة المحاسبة لهذا المستخدم — يظهر فقط لمن يملك وصول المحاسبة */}
      {acctUser && (
        <div className="card">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <Scale size={16} color="var(--brass)" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>أقسام شاشة المحاسبة لـ {u.name}</span>
            <span className="badge b-dim" style={{ marginInlineStart: 'auto' }}>اضغط أي قسم لإظهاره/إخفائه داخل «المحاسبة»</span>
          </div>
          <div className="note" style={{ marginBottom: 10 }}>الأخضر = ظاهر له داخل شاشة المحاسبة. اضغط لإخفاء ما لا يخصّه (مثلاً: الزكاة · إقفال السنة · الأصول · الضوابط). لا يؤثّر على القيود التلقائية ولا على بقية المستخدمين.</div>
          <div className="appperm-grid">
            {ACCT_SECTIONS.map(s => {
              const on = !deny.includes(acctSecKey(s.v));
              return (
                <button key={s.v} className={'appperm' + (on ? ' on role' : ' off')} onClick={() => toggleSec(s.v)}>
                  <span className="ic"><Scale size={14} /></span>
                  <span className="nm">{s.ar}<small>{on ? 'ظاهر' : 'مخفي'}</small></span>
                  <span className="tk">{on ? <Check size={13} /> : ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <EditPermsCard u={u} commitOrg={commitOrg} say={say} />

      <div className="card" style={{ background: 'rgba(200,162,74,.04)', borderStyle: 'dashed' }}>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 2 }}>
          🟢 <b style={{ color: 'var(--mint)' }}>بالدور</b>: يظهر تلقائيًا حسب دور المستخدم ·
          🟡 <b style={{ color: 'var(--amber)' }}>مُضاف/مُخفى يدويًا</b>: تخصيص لهذا الشخص وحده فوق دوره.
          الإضافة تمنح التطبيق ويفتح فعلاً، والإخفاء يزيله من شاشته. لا يؤثر على بقية المستخدمين، ولا يمسّ عزل بيانات الفروع.
          <br /><b style={{ color: 'var(--brass-l)' }}>لوحة «أقسام شاشة المحاسبة» أعلاه</b> تتيح لك تخصيص ما يراه المحاسب داخل المحاسبة تفصيلًا (قسمًا قسمًا) — يظهر تأثيرها فورًا في شاشته.
        </div>
      </div>
    </div>
  );
}
