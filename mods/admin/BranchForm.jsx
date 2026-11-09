/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Building2, Check, Landmark } from 'lucide-react';
import { Field, Modal, Num, PhotoField } from '../../App.jsx';

export function BranchForm({ b, org, say, onSave, onClose }) {
  const [f, setF] = useState(b);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal title={b.name ? 'تعديل فرع' : 'إضافة فرع جديد'} icon={Building2} onClose={onClose}
      foot={<><button className="btn pri" onClick={() => f.name ? onSave(f) : null} disabled={!f.name}>
        <Check size={14} />حفظ الفرع</button><button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      <div className="grid g2">
        <Field label="اسم الفرع"><input className="inp" value={f.name} onChange={e => set('name', e.target.value)} placeholder="فرع ..." /></Field>
        <Field label="المدينة"><input className="inp" value={f.city} onChange={e => set('city', e.target.value)} /></Field>
        <Field label="مدير الفرع"><input className="inp" value={f.managerName} onChange={e => set('managerName', e.target.value)} /></Field>
        <Field label="جوال الفرع"><input className="inp n" value={f.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Num label="العهدة التشغيلية الافتراضية" value={f.defaultFloat} onChange={v => set('defaultFloat', v)} />
        <Field label="وقت نهاية الوردية"><input type="time" className="inp" value={f.shiftEndTime} onChange={e => set('shiftEndTime', e.target.value)} /></Field>
      </div>
      <div className="card" style={{ marginTop: 6, background: 'rgba(200,162,74,.05)', borderColor: 'var(--frame)' }}>
        <div className="card-t" style={{ marginBottom: 4 }}><Landmark size={14} color="var(--brass)" />الحساب البنكي للفرع (اختياري)</div>
        <div className="note" style={{ marginBottom: 10 }}>عند إدخال بنكٍ للفرع، تُرحَّل إليه تحصيلات الشبكة والتحويل بدل البنك التجميعي، ويُنشأ للفرع <b>حساب وسيط «تحصيلات تحت التحويل»</b> يمرّ عبره توريد النقد للخزينة الرئيسية. اتركه فارغًا ليعمل الفرع كالسابق تمامًا.</div>
        <div className="grid g2">
          <Field label="اسم البنك"><input className="inp" value={f.bankName || ''} onChange={e => set('bankName', e.target.value)} placeholder="مثال: مصرف الراجحي" /></Field>
          <Field label="الآيبان / رقم الحساب"><input className="inp n" style={{ direction: 'ltr', textAlign: 'right' }} value={f.bankIban || ''} onChange={e => set('bankIban', e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" /></Field>
        </div>
        {/* v15.21 — ربط بنك الفرع بحساب قائم في الدليل المحاسبي بدل الحساب التلقائي */}
        <Field label="حساب البنك في الدليل المحاسبي">
          <select className="sel" value={f.bankAcc || ''} onChange={e => set('bankAcc', e.target.value)}>
            <option value="">تلقائي — يُنشأ حساب مستقل باسم الفرع (الوضع المعتاد)</option>
            <option value="1201">1201 · البنك — الشبكة والمدفوعات البنكية (تجميعي)</option>
            {((org && org.customAccounts) || []).filter(a => (a.kind || '') === 'asset').map(a => (
              <option key={a.code} value={String(a.code)}>{a.code} · {a.name}</option>
            ))}
          </select>
        </Field>
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: -4, lineHeight: 1.7 }}>
          اختر حساباً من دليلك المحاسبي لتُرحَّل إليه تحصيلات هذا الفرع مباشرةً (يظهر هنا: البنك التجميعي + حساباتك المخصّصة من نوع «أصول» — أنشئها أولاً من المحاسبة ← دليل الحسابات). يمكن ربط أكثر من فرع بنفس الحساب إن كانا يصبّان في حساب بنكي واحد فعلاً.
        </div>
      </div>
      <Field label="شعار الفرع (يظهر في تقارير هذا الفرع)">
        <PhotoField value={f.logoUrl} onChange={v => set('logoUrl', v)} say={say} />
      </Field>
    </Modal>
  );
}
