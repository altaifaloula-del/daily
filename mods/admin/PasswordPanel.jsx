/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { authApi } from '../../storage';
import { RefreshCw, Check } from 'lucide-react';
import { Field, pwStrength } from '../../App.jsx';

export function PasswordPanel({ me, mfa, say, onDone }) {
  const [f, setF] = useState({ cur: '', next: '', conf: '', code: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false); const [needCode, setNeedCode] = useState(mfa);
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setErr(''); };
  const save = async () => {
    if (!f.cur) return setErr('اكتب كلمة السر الحالية');
    const w = pwStrength(f.next); if (w) return setErr('كلمة السر الجديدة يجب أن تكون ' + w);
    if (f.next !== f.conf) return setErr('التأكيد لا يطابق كلمة السر الجديدة');
    if (f.next === f.cur) return setErr('اختر كلمة سر مختلفة عن الحالية');
    if (needCode && f.code.length !== 6) return setErr('اكتب رمز تطبيق المصادقة (6 أرقام)');
    setBusy(true);
    try { await authApi.changePassword(f.cur, f.next, needCode ? f.code : ''); say('تغيّرت كلمة السر ✓ — استخدمها في دخولك القادم'); onDone && onDone(); }
    catch (e) { const c = String((e && e.code) || '');
      if (c === 'mfa-code-needed') { setNeedCode(true); setErr('حسابك محمي بخطوتين — اكتب رمز تطبيق المصادقة ثم أعد المحاولة'); }
      else if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) setErr('كلمة السر الحالية غير صحيحة');
      else if (c.includes('invalid-verification-code')) setErr('رمز التطبيق غير صحيح');
      else if (c.includes('weak-password')) setErr('كلمة السر الجديدة ضعيفة');
      else if (c.includes('too-many-requests')) setErr('محاولات كثيرة — انتظر دقائق');
      else setErr('تعذّر التغيير (' + c.replace('auth/', '') + ')'); }
    setBusy(false);
  };
  const t = show ? 'text' : 'password';
  return (
    <div className="grid" style={{ gap: 4 }}>
      <Field label="كلمة السر الحالية"><input className="inp" type={t} autoComplete="current-password" value={f.cur} onChange={e => set('cur', e.target.value)} /></Field>
      <Field label="كلمة السر الجديدة"><input className="inp" type={t} autoComplete="new-password" value={f.next} onChange={e => set('next', e.target.value)} /></Field>
      <Field label="تأكيد كلمة السر الجديدة"><input className="inp" type={t} autoComplete="new-password" value={f.conf} onChange={e => set('conf', e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} /></Field>
      {needCode && <Field label="رمز تطبيق المصادقة"><input className="inp n" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" style={{ letterSpacing: 5, textAlign: 'center', direction: 'ltr' }} value={f.code} onChange={e => set('code', e.target.value.replace(/\D/g, '').slice(0, 6))} /></Field>}
      <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer' }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />إظهار كلمات السر</label>
      {f.next && <div style={{ fontSize: 11, color: pwStrength(f.next) ? 'var(--amber)' : 'var(--mint)' }}>{pwStrength(f.next) ? 'يلزم: ' + pwStrength(f.next) : 'كلمة سر مناسبة ✓'}</div>}
      {err && <div className="gate-err">{err}</div>}
      <button className="btn pri" disabled={busy} onClick={save}>{busy ? <RefreshCw size={14} className="spin" /> : <Check size={14} />}حفظ كلمة السر الجديدة</button>
      <div style={{ fontSize: 10.5, color: 'var(--faint)', lineHeight: 1.7 }}>نسيت الحالية؟ سجّل الخروج واضغط «نسيت كلمة السر؟» في شاشة الدخول فيصلك رابط التعيين على {me.email || 'بريدك'}.</div>
    </div>);
}
