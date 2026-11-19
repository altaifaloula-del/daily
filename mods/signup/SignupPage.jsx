/* v51.5 — المرحلة 07 / S6: صفحة التسجيل العام في مِثقال (‎?signup‎) — مستقلة عن التطبيق (لا تحمّل بيانات أي منشأة).
   الطلب يُرسل لخادم مِثقال ويُراجعه المزوّد؛ لا يُنشأ حساب ولا مشروع تلقائيًا. الحقل «website» مخفي للروبوتات. */
import React, { useState } from 'react';
import { PLAN_AR, PLAN_FEATURES } from '../../plans.js';

const apiBase = () => { const E = import.meta.env || {}; if (E.VITE_ZATCA_ENDPOINT) return String(E.VITE_ZATCA_ENDPOINT).replace(/\/+$/, '');
  try { return E.VITE_AI_ENDPOINT ? new URL(E.VITE_AI_ENDPOINT).origin : ''; } catch { return ''; } };
const C = { navy: 'var(--mithqal-navy, #10294A)', gold: 'var(--mithqal-gold, #D9A83E)', soft: 'var(--mithqal-soft-gray, #F3F5F8)' };
const inp = { width: '100%', padding: '10px 12px', border: '1px solid #CBD3DF', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' };
const planLine = (p) => { const f = PLAN_FEATURES[p]; return [f.maxBranches ? (f.maxBranches === 1 ? 'فرع واحد' : 'حتى ' + f.maxBranches + ' فروع') : 'فروع بلا حد', f.ai ? 'التحليل بالذكاء الاصطناعي' : '', f.zatca ? 'الفوترة الإلكترونية' : ''].filter(Boolean).join(' · '); };

// خارج المكوّن — تعريفه داخله يعيد إنشاء الحقول مع كل حرف فيفقد المؤشر موضعه
const L = ({ t, children, req }) => <label style={{ display: 'block', marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 5, color: C.navy }}>{t}{req ? ' *' : ''}</div>{children}</label>;

export function SignupPage() {
  const [f, setF] = useState({ company: '', contact: '', email: '', phone: '', city: '', crNo: '', vatNo: '', branches: 1, plan: 'pro', note: '', website: '' });
  const [st, setSt] = useState({ busy: false, err: '', id: '' });
  const set = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const send = async (e) => {
    e.preventDefault(); setSt({ busy: true, err: '', id: '' });
    try { const r = await fetch(apiBase() + '/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) }); const j = await r.json().catch(() => ({}));
      setSt(r.ok ? { busy: false, err: '', id: j.id || 'تم' } : { busy: false, err: j.error || 'تعذّر إرسال الطلب', id: '' });
    } catch { setSt({ busy: false, err: 'تعذّر الاتصال — أعد المحاولة', id: '' }); }
  };
  return (
    <div dir="rtl" className="mq-signup" style={{ position: 'relative', overflowX: 'hidden', minHeight: '100vh', background: C.soft, fontFamily: "'IBM Plex Sans Arabic','Noto Sans Arabic',sans-serif", padding: '28px 16px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <img src="./brand/mithqal-logo-horizontal-bilingual.svg" alt="مِثقال — Mithqal ERP" style={{ height: 52, display: 'block', margin: '0 auto 18px' }} />
        <div style={{ background: '#fff', borderRadius: 18, padding: '22px 20px', boxShadow: '0 6px 24px rgba(16,41,74,.08)' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 6px', color: C.navy }}>اطلب اشتراكك في مِثقال</h1>
          <p style={{ margin: '0 0 18px', color: '#5a6577', fontSize: 14 }}>نظام متكامل للمطاعم: الإغلاق اليومي، المحاسبة، المخزون، نقاط البيع، الموارد البشرية. بياناتك في مشروع مستقل داخل المملكة (الدمام).</p>
          {st.id ? <div className="mq-signup-ok" style={{ padding: 16, borderRadius: 12, background: 'rgba(46,139,98,.1)', color: '#1f6b4a' }}>
            <b>استلمنا طلبك ({st.id}).</b> سيتواصل معك فريق مِثقال لتجهيز منشأتك وبدء الفترة التجريبية.
          </div> : <form onSubmit={send}>
            <L t="اسم المنشأة" req><input style={inp} value={f.company} onChange={set('company')} required minLength={3} /></L>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <L t="اسم المسؤول" req><input style={inp} value={f.contact} onChange={set('contact')} required minLength={3} /></L>
              <L t="الجوال" req><input style={{ ...inp, direction: 'ltr', textAlign: 'right' }} value={f.phone} onChange={set('phone')} placeholder="05XXXXXXXX" required inputMode="tel" /></L>
            </div>
            <L t="البريد الإلكتروني (يصبح حساب المالك)" req><input style={{ ...inp, direction: 'ltr', textAlign: 'right' }} type="email" value={f.email} onChange={set('email')} required /></L>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <L t="المدينة"><input style={inp} value={f.city} onChange={set('city')} /></L>
              <L t="السجل التجاري"><input style={{ ...inp, direction: 'ltr' }} value={f.crNo} onChange={set('crNo')} inputMode="numeric" /></L>
              <L t="عدد الفروع"><input style={inp} type="number" min="1" max="500" value={f.branches} onChange={set('branches')} /></L>
            </div>
            <L t="الرقم الضريبي (اختياري)"><input style={{ ...inp, direction: 'ltr' }} value={f.vatNo} onChange={set('vatNo')} inputMode="numeric" /></L>
            <div style={{ fontSize: 13, fontWeight: 600, margin: '4px 0 6px', color: C.navy }}>الخطة</div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {Object.keys(PLAN_FEATURES).map(p => <label key={p} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: '1.5px solid ' + (f.plan === p ? '#D9A83E' : '#DDE2EA'), background: f.plan === p ? 'rgba(217,168,62,.08)' : '#fff' }}>
                <input type="radio" name="mq-plan" checked={f.plan === p} onChange={() => setF(x => ({ ...x, plan: p }))} />
                <span><b>{PLAN_AR[p]}</b><span style={{ display: 'block', fontSize: 12.5, color: '#5a6577' }}>{planLine(p)}</span></span>
              </label>)}
            </div>
            <L t="ملاحظات"><textarea style={{ ...inp, minHeight: 70 }} value={f.note} onChange={set('note')} maxLength={500} /></L>
            <input name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, border: 0, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', opacity: 0 }} />
            {st.err && <div className="mq-signup-err" style={{ color: '#b03a2e', marginBottom: 10 }}>{st.err}</div>}
            <button type="submit" disabled={st.busy} style={{ width: '100%', padding: '12px 14px', border: 0, borderRadius: 12, background: C.navy, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{st.busy ? 'جارٍ الإرسال…' : 'أرسل الطلب'}</button>
            <p style={{ fontSize: 12, color: '#7a8496', marginTop: 10 }}>بإرسال الطلب توافق على تواصل فريق مِثقال معك بخصوص الاشتراك.</p>
          </form>}
        </div>
      </div>
    </div>
  );
}
