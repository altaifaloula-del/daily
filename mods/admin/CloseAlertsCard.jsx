/* v45.8 — إعداد ملخصات الإغلاق: لمن تصل وماذا يصل (مغلق افتراضيًا) */
import React, { useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { ROLES, closeAlertsCfg } from '../../App.jsx';

export function CloseAlertsCard({ org, me, commitOrg, say }) {
  const [f, setF] = useState(() => closeAlertsCfg(org));
  const [busy, setBusy] = useState(false);
  if (!(ROLES[me.role] || {}).admin) return null;
  const cur = closeAlertsCfg(org);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const save = async (on) => {
    const next = { ...f, on, varMax: Math.max(0, Number(String(f.varMax).replace(/[^\d.]/g, '')) || 0) };
    if (on && !next.roles.length) return say('اختر دورًا واحدًا على الأقل', 'no');
    if (on && !next.shift && !next.variance && !next.daily) return say('اختر نوعًا واحدًا على الأقل من الملخصات', 'no');
    setBusy(true);
    const ok = await commitOrg(d => ({ ...d, closeAlerts: next }), { actionType: 'update', targetType: 'system_settings', targetId: 'close-alerts',
      need: 'edit', title: on ? 'فعّل ملخصات الإغلاق' : 'أوقف ملخصات الإغلاق',
      details: on ? next.roles.map(r => ((ROLES[r] || {}).ar || r).split('—')[0].trim()).join('، ') : '—' });
    setBusy(false);
    if (ok === false) return;
    setF(next); say(on ? 'فُعّلت ملخصات الإغلاق ✓' : 'أُوقفت ملخصات الإغلاق');
  };
  const ck = (k, label, sub) => (
    <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', marginBottom: 6, alignItems: 'flex-start' }}>
      <input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} style={{ marginTop: 3 }} />
      <span>{label}{sub && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)' }}>{sub}</span>}</span>
    </label>);
  return (
    <div className="card" style={{ marginTop: 12, background: 'var(--ink)' }} data-closealerts>
      <div className="card-t" style={{ marginBottom: 8 }}><BellRing size={15} color="var(--brass)" />ملخصات الإغلاق للإدارة
        {cur.on ? <span className="badge b-mint" style={{ marginInlineStart: 8 }}>مُفعّل</span> : <span className="badge b-dim" style={{ marginInlineStart: 8 }}>غير مُفعّل</span>}</div>
      <div className="note" style={{ marginBottom: 10 }}>تصل في مركز التنبيهات وكإشعار على الجهاز، مع زر مشاركة واتساب ونسخ النص. كل مستلم يرى فروعه فقط حسب صلاحياته.</div>
      {ck('shift', 'عند إغلاق كل وردية (Z)', 'المبيعات وطرق الدفع والنقد المتوقع والمعدود والفرق')}
      {ck('variance', 'تنبيه فوري عند وجود فرق نقدي', 'عجز أو زيادة في الصندوق عند إغلاق الوردية')}
      {f.variance && (
        <div className="row" style={{ gap: 8, margin: '0 22px 8px', fontSize: 12, alignItems: 'center' }}>
          <span>عند فرق أكبر من</span>
          <input className="inp n" style={{ width: 90 }} inputMode="decimal" value={f.varMax} onChange={e => set('varMax', e.target.value)} />
          <span>ر.س (0 = أي فرق)</span>
        </div>)}
      {ck('daily', 'التقرير اليومي لكل الفروع (عن الأمس)', 'يصل حين تُغلق كل الفروع، أو عند الساعة المحددة بما توفر')}
      {f.daily && (
        <div className="row" style={{ gap: 8, margin: '0 22px 8px', fontSize: 12, alignItems: 'center' }}>
          <span>الساعة</span>
          <input className="inp n" type="time" style={{ width: 120 }} value={f.dailyAt} onChange={e => set('dailyAt', e.target.value)} />
        </div>)}
      <div style={{ fontSize: 12, fontWeight: 600, margin: '10px 0 6px' }}>المستلمون</div>
      <div className="grid g2" style={{ gap: 2 }}>
        {Object.keys(ROLES).map(k => (
          <label key={k} className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={f.roles.includes(k)} onChange={e => set('roles', e.target.checked ? [...f.roles, k] : f.roles.filter(r => r !== k))} />
            {((ROLES[k] || {}).ar || k).split('—')[0].trim()}
          </label>))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn pri" disabled={busy} onClick={() => save(true)}><Check size={14} />{cur.on ? 'حفظ' : 'تفعيل'}</button>
        {cur.on && <button className="btn gh" disabled={busy} onClick={() => save(false)}>إيقاف</button>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 8, lineHeight: 1.7 }}>ليصلك الإشعار على الجوال: فعّل «إشعارات هذا الجهاز» من مركز التنبيهات 🔔. يصل والمنصة مفتوحة ولو في الخلفية، وما يفوتك يظهر عند فتحها.</div>
    </div>);
}
