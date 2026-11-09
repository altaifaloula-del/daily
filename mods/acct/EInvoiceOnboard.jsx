/* v38.4 — الفوترة الإلكترونية (المرحلة الثانية): بيانات المنشأة وتسجيل جهاز إصدار لكل فرع بالرمز المؤقت
   • التسجيل يتم على الخادم (zatca/onboard.js): مفاتيح ← CSR ← شهادة الامتثال ← 6 فحوص ← شهادة الإنتاج.
   • الرمز المؤقت يُرسل للخادم مرة واحدة ولا يُخزَّن؛ المفتاح الخاص يعود مشفّرًا بمفتاح الخادم ويُحفظ في بيانات المنشأة. */
import React, { useState, useEffect } from 'react';
import { QrCode, Check, X, ShieldCheck, Lock, AlertTriangle, PenLine, Store } from 'lucide-react';
import { Field, Modal, ROLES, aiHeaders, arDate, nowISO } from '../../App.jsx';

const ENV_AR = { sandbox: 'بيئة المطورين (تجربة)', simulation: 'المحاكاة (فحص الامتثال)', production: 'التشغيل الفعلي' };
const CAN_ROLES = ['system_admin', 'general_management', 'head_office'];
const zatcaBase = () => { const E = import.meta.env || {}; if (E.VITE_ZATCA_ENDPOINT) return String(E.VITE_ZATCA_ENDPOINT).replace(/\/+$/, '');
  try { return E.VITE_AI_ENDPOINT ? new URL(E.VITE_AI_ENDPOINT).origin : ''; } catch { return ''; } };
// نفس قواعد الخادم (zatca/onboard.js → sellerProblems)
export function einvSellerProblems(s = {}) {
  const a = s.address || {}, p = [];
  if (!String(s.name || '').trim()) p.push('الاسم المسجّل للمنشأة');
  if (!/^3\d{13}3$/.test(String(s.vat || ''))) p.push('الرقم الضريبي (15 رقمًا يبدأ وينتهي بـ3)');
  if (!/^\d{10}$/.test(String(s.crn || ''))) p.push('السجل التجاري (10 أرقام)');
  if (!/^\d{4}$/.test(String(a.building || ''))) p.push('رقم المبنى (4 أرقام)');
  if (!String(a.street || '').trim()) p.push('اسم الشارع');
  if (!String(a.district || '').trim()) p.push('الحي');
  if (!String(a.city || '').trim()) p.push('المدينة');
  if (!/^\d{5}$/.test(String(a.postal || ''))) p.push('الرمز البريدي (5 أرقام)');
  if (a.plot && !/^\d{4}$/.test(String(a.plot))) p.push('الرقم الإضافي (4 أرقام)');
  return p;
}
const STEPS = ['المفاتيح وطلب الشهادة', 'شهادة الامتثال', 'امتثال: فاتورة ضريبية', 'امتثال: إشعار دائن ضريبي', 'امتثال: إشعار مدين ضريبي', 'امتثال: فاتورة مبسّطة', 'امتثال: إشعار دائن مبسّط', 'امتثال: إشعار مدين مبسّط', 'شهادة الإنتاج'];

export function EInvoiceOnboard({ org, me, commitOrg, say }) {
  const can = CAN_ROLES.includes(me?.role);
  const company = org.company || {}; const cfg = org.einvCfg || {};
  const seller = { name: cfg.name || company.name || '', vat: cfg.vat || company.taxNumber || '', crn: cfg.crn || company.commercialReg || '', address: cfg.address || {}, industry: cfg.industry || 'Restaurants' };
  const problems = einvSellerProblems(seller);
  const branches = (org.branches || []).filter(b => b.isActive !== false);
  const egsAll = org.zatcaEgs || {};
  const [env, setEnv] = useState('simulation');
  const [f, setF] = useState(null);
  const [reg, setReg] = useState(null);       // { b, otp, busy, res }
  const [srv, setSrv] = useState(null);       // إعداد الخادم
  const base = zatcaBase();
  useEffect(() => { let on = true; if (!base) { setSrv({ err: 'لم يُضبط رابط الخادم (VITE_AI_ENDPOINT)' }); return; }
    (async () => { try { const r = await fetch(base + '/api/zatca/config', { headers: await aiHeaders() }); const j = await r.json().catch(() => ({})); if (on) setSrv(r.ok ? j : { err: j.error || ('HTTP ' + r.status) }); }
      catch { if (on) setSrv({ err: 'الخادم لا يستجيب الآن — قد يكون في وضع السكون، أعد فتح الشاشة بعد دقيقة' }); } })();
    return () => { on = false; }; }, [base]);

  const saveSeller = async () => {
    const s = { name: String(f.name || '').trim(), vat: String(f.vat || '').trim(), crn: String(f.crn || '').trim(), industry: String(f.industry || '').trim() || 'Restaurants',
      address: { building: String(f.building || ''), street: String(f.street || '').trim(), district: String(f.district || '').trim(), city: String(f.city || '').trim(), postal: String(f.postal || ''), ...(f.plot ? { plot: String(f.plot) } : {}) } };   // بلا قيم undefined (يرفضها Firestore)
    const p = einvSellerProblems(s); if (p.length) return say('أكمل: ' + p.join('، '), 'no');
    const ok = await commitOrg(d => ({ ...d, einvCfg: s }), { actionType: 'update', targetType: 'settings', targetId: 'einvCfg', need: 'edit', title: 'بيانات المنشأة للفوترة الإلكترونية', details: s.name + ' · ' + s.vat + ' · س.ت ' + s.crn + ' · ' + s.address.city });
    if (ok) { setF(null); say('حُفظت بيانات المنشأة ✓'); }
  };
  const register = async () => {
    const R = reg; const otp = String(R.otp || '').replace(/\D/g, '');
    if (otp.length !== 6) return say('الرمز المؤقت 6 أرقام', 'no');
    setReg(x => ({ ...x, busy: true, res: null }));
    let res;
    try {
      const r = await fetch(base + '/api/zatca/onboard', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ env, otp, seller, branch: { id: R.b.id, name: R.b.name }, industry: seller.industry }) });
      res = await r.json().catch(() => ({})); if (!r.ok && !res.steps) res = { ok: false, steps: [{ k: 'الخادم', ok: false, detail: res.error || ('HTTP ' + r.status) }] };
    } catch { res = { ok: false, steps: [{ k: 'الاتصال', ok: false, detail: 'تعذّر الوصول للخادم — تحقق من الاتصال وأعد المحاولة' }] }; }
    if (res.ok && res.egs) {
      const rec = { ...res.egs, at: nowISO(), by: me.name, branchName: R.b.name, checks: res.steps.map(s => ({ k: s.k, ok: s.ok })) };
      const ok = await commitOrg(d => ({ ...d, zatcaEgs: { ...(d.zatcaEgs || {}), [R.b.id]: { ...((d.zatcaEgs || {})[R.b.id] || {}), [env]: rec } } }),
        { actionType: 'update', targetType: 'settings', targetId: 'zatca-egs-' + R.b.id, need: 'edit', title: 'تسجيل جهاز فوترة إلكترونية', details: R.b.name + ' · ' + ENV_AR[env] + ' · شهادة ' + String(rec.cert.serial).slice(-8) });
      if (ok) say('سُجّل جهاز ' + R.b.name + ' ✓');
    }
    setReg(x => ({ ...x, busy: false, otp: '', res }));
  };

  const vaultOk = srv && srv.vault;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />الربط مع منصة «فاتورة» — المرحلة الثانية</div>
          <span className={'badge ' + (srv && !srv.err && vaultOk ? 'b-mint' : 'b-amber')}>{!srv ? 'جارٍ فحص الخادم…' : srv.err ? 'الخادم غير متاح' : vaultOk ? 'الخادم جاهز' : 'مفتاح التشفير ناقص على الخادم'}</span></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {['simulation', 'sandbox'].map(k => <button key={k} className={'btn sm' + (env === k ? ' pri' : ' gh')} onClick={() => setEnv(k)}>{ENV_AR[k]}</button>)}
          <button className="btn sm gh" disabled title="يُفعَّل في المرحلة الثالثة">{ENV_AR.production} 🔒</button>
        </div>
        <div className="note">
          {env === 'sandbox' ? <>بيئة المطورين للتجربة فقط: الرمز المؤقت الثابت فيها <b className="num">123345</b>، ولا أثر رسمي لها.</>
            : <>المحاكاة: الرمز المؤقت من <b>بوابة «فاتورة» ← بيئة المحاكاة ← إضافة جهاز</b> (رمز لكل فرع، صالح ساعة واحدة). يُدخله المفوَّض هنا بنفسه — لا يُرسل في المحادثات ولا يُحفظ.</>}
        </div>
        {srv && srv.err && <div className="note" style={{ marginTop: 8, borderColor: 'rgba(224,164,88,.5)' }}>⚠️ {srv.err}</div>}
        {srv && !srv.err && !vaultOk && <div className="note" style={{ marginTop: 8, borderColor: 'rgba(224,164,88,.5)' }}>⚠️ مفتاح تشفير أسرار الأجهزة (ZATCA_ENC_KEY) غير مضبوط على الخادم — لا يمكن التسجيل قبل ضبطه.</div>}
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><Store size={15} color="var(--brass)" />بيانات المنشأة في الفاتورة</div>
          {can && !f && <button className="btn sm" onClick={() => setF({ name: seller.name, vat: seller.vat, crn: seller.crn, industry: seller.industry, ...seller.address })}><PenLine size={13} />تعديل</button>}</div>
        {f ? <>
          <div className="grid g2">
            <Field label="الاسم المسجّل (كما في السجل)"><input className="inp" value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} /></Field>
            <Field label="الرقم الضريبي"><input className="inp n" inputMode="numeric" maxLength={15} value={f.vat} onChange={e => setF(x => ({ ...x, vat: e.target.value.replace(/\D/g, '') }))} /></Field>
            <Field label="السجل التجاري"><input className="inp n" inputMode="numeric" maxLength={10} value={f.crn} onChange={e => setF(x => ({ ...x, crn: e.target.value.replace(/\D/g, '') }))} /></Field>
            <Field label="النشاط"><input className="inp" value={f.industry} onChange={e => setF(x => ({ ...x, industry: e.target.value }))} placeholder="Restaurants" /></Field>
          </div>
          <div className="lbl" style={{ margin: '6px 0' }}>العنوان الوطني</div>
          <div className="grid g3">
            <Field label="رقم المبنى"><input className="inp n" inputMode="numeric" maxLength={4} value={f.building || ''} onChange={e => setF(x => ({ ...x, building: e.target.value.replace(/\D/g, '') }))} /></Field>
            <Field label="الشارع"><input className="inp" value={f.street || ''} onChange={e => setF(x => ({ ...x, street: e.target.value }))} /></Field>
            <Field label="الحي"><input className="inp" value={f.district || ''} onChange={e => setF(x => ({ ...x, district: e.target.value }))} /></Field>
            <Field label="المدينة"><input className="inp" value={f.city || ''} onChange={e => setF(x => ({ ...x, city: e.target.value }))} /></Field>
            <Field label="الرمز البريدي"><input className="inp n" inputMode="numeric" maxLength={5} value={f.postal || ''} onChange={e => setF(x => ({ ...x, postal: e.target.value.replace(/\D/g, '') }))} /></Field>
            <Field label="الرقم الإضافي"><input className="inp n" inputMode="numeric" maxLength={4} value={f.plot || ''} onChange={e => setF(x => ({ ...x, plot: e.target.value.replace(/\D/g, '') }))} /></Field>
          </div>
          <div className="row" style={{ gap: 8 }}><button className="btn pri" onClick={saveSeller}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setF(null)}>إلغاء</button></div>
        </> : <div className="einv-seller">
          <div><small>الاسم المسجّل</small><b>{seller.name || '—'}</b></div>
          <div><small>الرقم الضريبي</small><b className="num">{seller.vat || '—'}</b></div>
          <div><small>السجل التجاري</small><b className="num">{seller.crn || '—'}</b></div>
          <div><small>العنوان الوطني</small><b>{[seller.address.building, seller.address.street, seller.address.district, seller.address.city, seller.address.postal].filter(Boolean).join('، ') || '—'}</b></div>
        </div>}
        {problems.length > 0 && !f && <div className="note" style={{ marginTop: 8, borderColor: 'rgba(224,164,88,.5)' }}>⚠️ ناقص قبل التسجيل: {problems.join('، ')}</div>}
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><QrCode size={15} color="var(--brass)" />أجهزة الإصدار — جهاز لكل فرع</div><span className="badge b-dim">{ENV_AR[env]}</span></div>
        <div className="einv-devs">{branches.map(b => { const e = (egsAll[b.id] || {})[env]; return (
          <div key={b.id} className={'einv-dev' + (e ? ' on' : '')}>
            <div className="einv-dev-n"><b>{b.name}</b>
              {e ? <small>شهادة <span className="num">…{String(e.cert.serial).slice(-8)}</span> · حتى <span className="dt">{e.cert.validTo ? arDate(new Date(e.cert.validTo).toISOString().slice(0, 10)) : '—'}</span> · سجّله {e.by}</small> : <small>لم يُسجَّل بعد</small>}</div>
            {e ? <span className="badge b-mint">مسجّل ✓</span> : <span className="badge b-dim">غير مسجّل</span>}
            {can && <button className="btn sm" disabled={!!problems.length || !vaultOk} title={problems.length ? 'أكمل بيانات المنشأة أولًا' : !vaultOk ? 'الخادم غير جاهز' : ''}
              onClick={() => setReg({ b, otp: env === 'sandbox' ? '123345' : '', busy: false, res: null })}><Lock size={12} />{e ? 'إعادة التسجيل' : 'تسجيل الجهاز'}</button>}
          </div>); })}
          {!branches.length && <div className="empty">لا فروع.</div>}
        </div>
        {!can && <div className="note" style={{ marginTop: 8 }}>تسجيل الأجهزة للمفوَّضين: مسؤول النظام أو المكتب الرئيسي.</div>}
      </div>

      {reg && <Modal title={'تسجيل جهاز ' + reg.b.name} icon={Lock} onClose={() => !reg.busy && setReg(null)}
        foot={reg.res && reg.res.ok ? <button className="btn pri" onClick={() => setReg(null)}><Check size={14} />تم</button>
          : <><button className="btn gh" disabled={reg.busy} onClick={() => setReg(null)}>إغلاق</button><button className="btn pri" disabled={reg.busy} onClick={register}>{reg.busy ? 'جارٍ التسجيل…' : 'تسجيل'}</button></>}>
        {!reg.res && <>
          <div className="note" style={{ marginBottom: 10 }}>{ENV_AR[env]} · المنشأة {seller.name} · <span className="num">{seller.vat}</span></div>
          <Field label="الرمز المؤقت (OTP) — 6 أرقام">
            <input className="inp n einv-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={reg.busy} value={reg.otp}
              onChange={e => setReg(x => ({ ...x, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="••••••" />
          </Field>
        </>}
        {(reg.busy || reg.res) && <div className="einv-steps">
          {STEPS.map((k, i) => { const s = reg.res && (reg.res.steps || []).find(x => x.k === k); const failedEarlier = reg.res && !s;
            return <div key={k} className={'einv-step ' + (s ? (s.ok ? 'ok' : 'bad') : reg.busy ? 'run' : 'skip')}>
              <span className="einv-ic">{s ? (s.ok ? <Check size={13} /> : <X size={13} />) : reg.busy ? <span className="mod-spin" /> : '·'}</span>
              <span>{k}{s && s.detail ? <small> — {s.detail}</small> : failedEarlier ? <small> — لم يُنفَّذ</small> : null}
                {s && (s.msgs || []).map((m, j) => <div key={j} className="einv-msg">{m.code ? <b>{m.code}</b> : null} {m.message}</div>)}</span>
            </div>; })}
          {reg.res && (reg.res.steps || []).filter(s => !STEPS.includes(s.k)).map((s, i) => <div key={'x' + i} className={'einv-step ' + (s.ok ? 'ok' : 'bad')}><span className="einv-ic">{s.ok ? <Check size={13} /> : <AlertTriangle size={13} />}</span><span>{s.k}<small> — {s.detail}</small></span></div>)}
        </div>}
        {reg.res && <div className="note" style={{ marginTop: 10, borderColor: reg.res.ok ? 'rgba(79,178,134,.5)' : 'rgba(217,84,77,.5)' }}>
          {reg.res.ok ? 'سُجّل الجهاز واجتاز فحوص الامتثال الستة، وحُفظت شهادته ومفتاحه مشفّرًا. لن يُرسل أي فاتورة قبل تفعيل التشغيل في المرحلة الثالثة.' : 'لم يكتمل التسجيل — لم يُحفظ شيء. صحّح السبب أعلاه واطلب رمزًا جديدًا إن انتهت صلاحية الرمز.'}
        </div>}
      </Modal>}
    </div>);
}
