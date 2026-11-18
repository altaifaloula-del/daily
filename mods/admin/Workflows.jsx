/* v49.5 — المرحلة 04 (MQ-059): تهيئة مسارات الاعتماد — مستويات بحدود مبالغ وأدوار لكل نوع مستند */
import React, { useState } from 'react';
import { RefreshCw as GitBranch, Plus, X, Check } from 'lucide-react';
import { WF_DOCS, wfTiers, ROLES, money, uid } from '../../App.jsx';

const ROLE_KEYS = () => Object.keys(ROLES).filter(k => !(ROLES[k] || {}).readOnly);

export function WorkflowsCard({ org, commitOrg, say, isAdm }) {
  const init = () => { const o = {}; Object.keys(WF_DOCS).forEach(t => { o[t] = wfTiers(org, t).map(x => ({ ...x, min: String(x.min) })); }); return o; };
  const [f, setF] = useState(init);
  const [open, setOpen] = useState(false);
  const up = (t, i, p) => setF(x => ({ ...x, [t]: x[t].map((y, k) => k === i ? { ...y, ...p } : y) }));
  const save = async () => {
    const wf = {};
    for (const t of Object.keys(WF_DOCS)) {
      const L = (f[t] || []).filter(x => x.roles && x.roles.length || String(x.min).trim());
      for (const x of L) { if (!(Number(x.min) >= 0) || String(x.min).trim() === '') return say(WF_DOCS[t].ar + ': أدخل حد المبلغ لكل مستوى', 'no'); if (!(x.roles || []).length) return say(WF_DOCS[t].ar + ': اختر دورًا واحدًا على الأقل لكل مستوى', 'no'); }
      const mins = L.map(x => Number(x.min)); if (new Set(mins).size !== mins.length) return say(WF_DOCS[t].ar + ': لا يتكرر حد المبلغ بين مستويين', 'no');
      if (L.length) wf[t] = { tiers: L.map((x, i) => ({ id: x.id || uid('wt'), min: Math.round(Number(x.min) * 100) / 100, roles: x.roles, label: String(x.label || '').trim() || ('المستوى ' + (i + 1)) })).sort((a, b) => a.min - b.min) };
    }
    const ok = await commitOrg(d => { const n = { ...d }; if (Object.keys(wf).length) n.wf = wf; else delete n.wf; return n; },
      { actionType: 'settings', targetType: 'system_settings', targetId: 'wf', need: 'edit', title: 'عدّل مسارات الاعتماد', details: Object.keys(WF_DOCS).map(t => WF_DOCS[t].ar + ': ' + ((wf[t] || {}).tiers || []).length + ' مستوى').join(' · ') });
    if (ok) say('حُفظت مسارات الاعتماد ✓');
  };
  return (
    <div className="card" data-wf>
      <div className="card-h"><div className="card-t"><GitBranch size={15} color="var(--brass)" />مسارات الاعتماد</div>
        <button className="btn sm gh" onClick={() => setOpen(x => !x)}>{open ? 'إخفاء' : 'تهيئة'}</button></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9 }}>
        لكل نوع مستند مستويات اعتماد بالترتيب: المستند الذي تبلغ قيمته حدّ المستوى يحتاج اعتماده. لا يعتمد المنشئ مستنده، ولا يعتمد الشخص نفسه مستويين.
        بلا مستويات يبقى السلوك الحالي (حد اعتماد أوامر الشراء، واعتماد واحد للقيد).
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 8 }}>{Object.keys(WF_DOCS).map(t => { const T = wfTiers(org, t);
        return <span key={t} className={'badge ' + (T.length ? 'b-sky' : 'b-dim')}>{WF_DOCS[t].ar}: {T.length ? T.map(x => x.label + ' ≥ ' + money(x.min)).join(' ← ') : 'الافتراضي'}</span>; })}</div>
      {open && <div style={{ marginTop: 12 }}>
        {Object.keys(WF_DOCS).map(t => <div key={t} className="note" style={{ margin: '0 0 10px' }} data-wfdoc={t}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><b>{WF_DOCS[t].ar} <small style={{ color: 'var(--faint)' }}>(الحد على {WF_DOCS[t].unit})</small></b>
            {isAdm && <button className="btn sm gh" onClick={() => setF(x => ({ ...x, [t]: [...(x[t] || []), { id: '', min: '', label: '', roles: [] }] }))}><Plus size={13} />مستوى</button>}</div>
          {(f[t] || []).map((x, i) => <div key={i} style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 8 }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="inp" style={{ width: 150 }} aria-label={'اسم المستوى ' + (i + 1)} placeholder={'المستوى ' + (i + 1)} value={x.label} disabled={!isAdm} onChange={e => up(t, i, { label: e.target.value })} />
              <span style={{ fontSize: 12 }}>من مبلغ</span>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" aria-label={'حد المستوى ' + (i + 1)} value={x.min} disabled={!isAdm} onChange={e => up(t, i, { min: e.target.value.replace(/[^\d.]/g, '') })} />
              {isAdm && <button className="btn sm gh" aria-label="حذف المستوى" onClick={() => setF(y => ({ ...y, [t]: y[t].filter((_, k) => k !== i) }))}><X size={13} /></button>}
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 6 }}>{ROLE_KEYS().map(r => <label key={r} className="row" style={{ gap: 4, fontSize: 11.5 }}>
              <input type="checkbox" aria-label={'دور ' + (ROLES[r].ar || r) + ' ' + (i + 1)} disabled={!isAdm} checked={(x.roles || []).includes(r)} onChange={e => up(t, i, { roles: e.target.checked ? [...(x.roles || []), r] : (x.roles || []).filter(y => y !== r) })} />{(ROLES[r].ar || r).split(' — ')[0]}</label>)}</div>
          </div>)}
          {!(f[t] || []).length && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>لا مستويات — السلوك الافتراضي.</div>}
        </div>)}
        {isAdm && <button className="btn pri" onClick={save}><Check size={14} />حفظ المسارات</button>}
      </div>}
    </div>);
}
