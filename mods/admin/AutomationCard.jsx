/* v52.0 — «الأتمتة»: ما يجري تلقائيًا في المنشأة، يفعّله أو يوقفه المسؤول (org.autoCfg). كله يمر بمسار الاعتماد والصلاحيات المعتاد. */
import React, { useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { autoCfgOf } from '../../App.jsx';

// خارج المكوّن كي لا تُعاد الحقول مع كل حرف
const Row = ({ children }) => <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>{children}</div>;

export function AutomationCard({ org, commitOrg, say }) {
  const [f, setF] = useState(() => autoCfgOf(org));
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const num = (k, lo, hi) => (e) => set(k, Math.max(lo, Math.min(hi, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)));
  const save = async () => {
    const ok = await commitOrg(d => ({ ...d, autoCfg: { ...f } }), { actionType: 'update', targetType: 'settings', targetId: 'autoCfg', need: 'edit', title: 'عدّل إعدادات الأتمتة',
      details: ['قيود دورية ' + (f.recurring ? 'تلقائية' : 'يدوية'), 'استحقاق الرواتب ' + (f.payroll ? 'يوم ' + f.payrollDay : 'يدوي'), 'أوامر مقترحة ' + (f.poSuggest ? 'مفعّلة' : 'موقوفة'), 'تذكير الإقرار ' + (f.vatRemindDays || 'موقوف'), 'تذكير الإقفال ' + (f.lockAfterDays || 'موقوف')].join(' · ') });
    if (ok !== false) say('حُفظت إعدادات الأتمتة');
  };
  const chk = (k, label) => <label className="row" style={{ gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} /><b>{label}</b></label>;
  const n = (k, lo, hi) => <input className="inp n" style={{ width: 60 }} inputMode="numeric" aria-label={k} value={f[k]} onChange={num(k, lo, hi)} />;
  return (
    <div className="card mq-auto" style={{ marginTop: 12, background: 'var(--ink)' }}>
      <div className="card-t" style={{ marginBottom: 6 }}><RefreshCw size={15} color="var(--brass)" />الأتمتة</div>
      <div className="note" style={{ marginBottom: 6 }}>ما يجري تلقائيًا — بمسار الاعتماد والصلاحيات نفسه، ولا يمس فترة مقفلة.</div>
      <Row>{chk('recurring', 'القيود الدورية المستحقة')}<span style={{ color: 'var(--dim)' }}>تُنشأ عند دخول من يملك الترحيل</span></Row>
      <Row>{chk('payroll', 'استحقاق رواتب الشهر السابق')}{f.payroll && <>ابتداءً من يوم {n('payrollDay', 1, 28)} من الشهر</>}</Row>
      <Row>{chk('poSuggest', 'أوامر شراء مقترحة من نفاد المخزون')}<span style={{ color: 'var(--dim)' }}>تُراجع ثم تُنشأ من الموردين ← أوامر الشراء</span></Row>
      <Row><b>تذكير الإقرار الضريبي</b>قبل الموعد بـ {n('vatRemindDays', 0, 30)} يوم <span style={{ color: 'var(--dim)' }}>(0 = موقوف)</span></Row>
      <Row><b>تذكير الإقفال الشهري</b>بعد {n('lockAfterDays', 0, 60)} يوم من نهاية الشهر <span style={{ color: 'var(--dim)' }}>(0 = موقوف)</span></Row>
      <button className="btn pri sm" style={{ marginTop: 8 }} onClick={save}><Check size={14} />حفظ إعدادات الأتمتة</button>
    </div>
  );
}
