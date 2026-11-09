/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { UserCog, Check, Eye, Fingerprint, Trash2, RefreshCw, ScanFace } from 'lucide-react';
import { authApi } from '../../storage';
import { Field, Modal, ROLES, bioEnroll, webauthnSupported } from '../../App.jsx';

export function UserForm({ u, org, onSave, onClose }) {
  const [resetMsg, setResetMsg] = useState('');
  const [f, setF] = useState(u);
  const [bioMsg, setBioMsg] = useState('');
  const [showPw, setShowPw] = useState(false); // v15.15 — استعراض كلمة السر أثناء الكتابة (رمز العين)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggle = (id) => {
    const cur = f.allowedBranchIds || [];
    set('allowedBranchIds', cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };
  return (
    <Modal title={u.name ? 'تعديل مستخدم' : 'مستخدم جديد'} icon={UserCog} onClose={onClose}
      foot={<><button className="btn pri" disabled={!f.name} onClick={() => onSave(f)}><Check size={14} />حفظ الحساب</button>
        <button className="btn gh" onClick={onClose}>إلغاء</button></>}>
      <div className="grid g2">
        <Field label="الاسم الكامل"><input className="inp" value={f.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="البريد الإلكتروني"><input className="inp" type="email" style={{ direction: 'ltr', textAlign: 'right' }} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" /></Field>
      </div>
      <Field label="الدور والصلاحية">
        <select className="sel" value={f.role} onChange={e => set('role', e.target.value)}>
          {Object.entries(ROLES).filter(([k, v]) => !v.legacy || k === f.role).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}
        </select>
      </Field>
      {ROLES[f.role].scope === 'own' && (
        <Field label="الفرع المخصص">
          <select className="sel" value={f.branchId} onChange={e => set('branchId', e.target.value)}>
            {org.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}
      {ROLES[f.role].scope === 'assigned' && (
        <Field label="الفروع المصرّح بالوصول إليها">
          <div className="row">
            {org.branches.map(b => (
              <button key={b.id} className={'btn sm' + ((f.allowedBranchIds || []).includes(b.id) ? ' pri' : ' gh')}
                onClick={() => toggle(b.id)}>{b.name}</button>
            ))}
          </div>
        </Field>
      )}
      <Field label={u.name ? 'كلمة سر جديدة (اتركها فارغة للإبقاء على الحالية)' : 'كلمة السر'}>
        <div style={{ position: 'relative' }}>
          <input className="inp" type={showPw ? 'text' : 'password'} value={f.newPass || ''} placeholder={u.name ? 'بدون تغيير' : '6 أحرف على الأقل'}
            style={showPw ? { direction: 'ltr', textAlign: 'right', letterSpacing: 1 } : undefined}
            onChange={e => set('newPass', e.target.value)} />
          <button type="button" className="btn sm gh pw-eye" style={{ position: 'absolute', insetInlineEnd: 4, top: 4, padding: '4px 8px' }}
            title={showPw ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
            onClick={() => setShowPw(s => !s)} tabIndex={-1}><Eye size={14} /></button>
        </div>
        {showPw && f.newPass && (
          <div style={{ fontSize: 10.5, color: 'var(--brass-l)', marginTop: 4 }}>
            تُكتب هكذا حرفاً بحرف: <b className="num" style={{ direction: 'ltr', unicodeBidi: 'isolate', letterSpacing: 2 }}>{f.newPass}</b>
            {f.newPass !== f.newPass.trim() && <span style={{ color: 'var(--rose)' }}> — ⚠ تحوي مسافة في البداية أو النهاية!</span>}
          </div>
        )}
        {u.passHash && !f.newPass && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>للحساب كلمة سر محفوظة — لن تتغير ما لم تكتب واحدة جديدة.</div>}
        {authApi.enabled && (
          <div style={{ fontSize: 10.5, color: 'var(--sky)', marginTop: 6, lineHeight: 1.8 }}>
            المصادقة السحابية مفعّلة: كلمة السر هنا تُنشئ حساب دخول المستخدم <b>الجديد</b>. لتغيير كلمة سر مستخدم قائم:
            <button type="button" className="btn sm gh" style={{ marginInlineStart: 6 }}
              onClick={async () => {
                if (!f.email) { setResetMsg('اكتب البريد أولاً'); return; }
                setResetMsg('...');
                try { await authApi.resetPass(f.email); setResetMsg('أُرسل رابط التعيين إلى ' + f.email); }
                catch { setResetMsg('تعذّر الإرسال — تأكد من صحة البريد ووجود حساب مصادقة له'); }
              }}>إرسال رابط تعيين كلمة السر</button>
            {resetMsg && <div style={{ marginTop: 4, color: resetMsg.startsWith('أُرسل') ? 'var(--mint)' : 'var(--amber)' }}>{resetMsg}</div>}
          </div>
        )}
      </Field>
      <Field label="رقم سري للدخول السريع (اختياري — 4 إلى 6 أرقام)">
        <input className="inp" inputMode="numeric" style={{ direction: 'ltr', textAlign: 'right', letterSpacing: 4 }} value={f.newPin || ''}
          placeholder={f.pinHash ? 'محفوظ — اكتب رقماً جديداً لتغييره' : 'يمكّن الدخول السريع بالرقم'}
          onChange={e => set('newPin', e.target.value.replace(/\D/g, '').slice(0, 6))} />
        {f.pinHash && !f.newPin && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>لهذا الحساب رقم سري محفوظ للدخول السريع.</div>}
      </Field>

      <div className="card" style={{ background: 'var(--ink)', padding: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Fingerprint size={14} color="var(--brass)" />البصمة الحيوية لهذا الجهاز
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 3, lineHeight: 1.6 }}>
              تسجّل بصمة/وجه هذا الجهاز (Touch ID / Face ID / Windows Hello) لدخول أسرع.
            </div>
          </div>
          {f.bioCredId ? (
            <div className="row">
              <span className="badge b-mint"><Check size={11} />مُفعّلة</span>
              <button type="button" className="btn sm gh" onClick={() => set('bioCredId', undefined)}>
                <Trash2 size={12} color="#D9544D" />إلغاء
              </button>
            </div>
          ) : (
            <button type="button" className="btn sm" disabled={bioMsg === 'busy'}
              onClick={async () => {
                if (!webauthnSupported()) { setBioMsg('unsupported'); return; }
                if (!f.email) { setBioMsg('needmail'); return; }
                setBioMsg('busy');
                try { const id = await bioEnroll({ ...f, id: f.id }); set('bioCredId', id); setBioMsg('done'); }
                catch { setBioMsg('fail'); }
              }}>
              {bioMsg === 'busy' ? <RefreshCw size={12} className="spin" /> : <ScanFace size={13} />}تفعيل البصمة
            </button>
          )}
        </div>
        {bioMsg === 'unsupported' && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 8 }}>هذا الجهاز/المتصفح لا يدعم البصمة الحيوية.</div>}
        {bioMsg === 'needmail' && <div style={{ fontSize: 10.5, color: 'var(--amber)', marginTop: 8 }}>أدخل البريد الإلكتروني أولاً.</div>}
        {bioMsg === 'fail' && <div style={{ fontSize: 10.5, color: 'var(--rose)', marginTop: 8 }}>تعذّر التسجيل — تأكد من إعداد البصمة على الجهاز.</div>}
        {bioMsg === 'done' && <div style={{ fontSize: 10.5, color: 'var(--mint)', marginTop: 8 }}>تم — احفظ الحساب لاعتماد البصمة.</div>}
      </div>
      <div className="card" style={{ background: 'var(--ink)', padding: 12 }}>
        <div className="lbl">ما يستطيع هذا الدور فعله</div>
        {ROLES[f.role].perms.map((p, i) => (
          <div key={i} style={{ fontSize: 11.5, color: 'var(--dim)', display: 'flex', gap: 7, marginBottom: 4 }}>
            <Check size={13} color="var(--mint)" style={{ flexShrink: 0, marginTop: 3 }} />{p}
          </div>
        ))}
      </div>
    </Modal>
  );
}
