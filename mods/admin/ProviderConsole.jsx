/* v51.5 — المرحلة 07 / S6: «لوحة مِثقال» — لمزوّد المنصة وحده (يفحصه الخادم: البريد + المنشأة الرئيسية + جلسة بخطوتين).
   المنشآت وحالتها والتوصيات، الفترة التجريبية، تغيير حالة الاشتراك، تأكيد التحويلات البنكية، وطلبات التسجيل العام.
   كل إجراء يُنفَّذ على الخادم ويُسجَّل باسم المزوّد؛ الواجهة لا ترى أي سر. */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import { aiHeaders } from '../../App.jsx';
import { PLAN_AR, STATUS_AR } from '../../plans.js';
import { SUB_STATE_AR, INV_ST_AR, sar } from '../../billing.js';

const apiBase = () => { const E = import.meta.env || {}; if (E.VITE_ZATCA_ENDPOINT) return String(E.VITE_ZATCA_ENDPOINT).replace(/\/+$/, '');
  try { return E.VITE_AI_ENDPOINT ? new URL(E.VITE_AI_ENDPOINT).origin : ''; } catch { return ''; } };
const STATE_AR = { ...SUB_STATE_AR, unconfigured: 'غير مهيأة على الخادم' };
const SG_AR = { new: 'جديد', approved: 'مقبول', rejected: 'مرفوض' };

/** هل المستخدم الحالي مزوّد مِثقال؟ (الخادم يقرر) */
export async function probeProvider() {
  const b = apiBase(); if (!b) return false;
  try { const r = await fetch(b + '/api/provider/me', { headers: await aiHeaders() }); const j = await r.json().catch(() => ({})); return !!(r.ok && j.provider); } catch { return false; }
}

export function ProviderConsole({ say }) {
  const base = apiBase();
  const [ts, setTs] = useState(null), [sg, setSg] = useState([]), [inv, setInv] = useState(null), [msg, setMsg] = useState(''), [cmd, setCmd] = useState('');
  const api = useCallback(async (path, body) => {
    const r = await fetch(base + path, body ? { method: 'POST', headers: await aiHeaders(), body: JSON.stringify(body) } : { headers: await aiHeaders() });
    const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.cmd = j.cmd; throw e; } return j;
  }, [base]);
  const load = useCallback(async () => {
    try { const [a, b] = await Promise.all([api('/api/provider/tenants'), api('/api/provider/signups')]); setTs(a.tenants || []); setSg(b.signups || []); setMsg(''); }
    catch (e) { setMsg(e.message); setTs([]); }
  }, [api]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn, ok) => { setMsg(''); setCmd(''); try { const j = await fn(); if (j && j.cmd) setCmd(j.cmd); if (ok) (say || setMsg)(typeof ok === 'function' ? ok(j) : ok); load(); } catch (e) { setMsg(e.message); if (e.cmd) setCmd(e.cmd); } };
  const status = (t, s) => { if (!confirm('تغيير حالة «' + (t.name || t.id) + '» إلى «' + STATUS_AR[s] + '»؟' + (s === 'active' ? '' : ' تتوقف كل كتابة في المنشأة فورًا.'))) return; act(() => api('/api/provider/status', { tenant: t.id, status: s }), 'تم تغيير الحالة'); };
  const trial = (t) => { const d = prompt('عدد أيام التجربة', '14'); if (!d) return; act(() => api('/api/provider/trial', { tenant: t.id, days: Number(d) }), j => 'التجربة حتى ' + j.paidThrough); };
  const openInv = async (t) => { try { setInv({ t, list: (await api('/api/provider/invoices?tenant=' + encodeURIComponent(t.id))).invoices }); } catch (e) { setMsg(e.message); } };
  const confirmTr = (v) => { const ref = prompt('مرجع التحويل البنكي'); if (!ref) return; const amt = prompt('المبلغ المستلم بالريال (يجب أن يطابق ' + sar(v.total) + ')', sar(v.total)); if (!amt) return;
    act(() => api('/api/provider/invoice/confirm', { no: v.no, ref, amount: amt }), 'تم تأكيد التحويل وتمديد الاشتراك').then(() => openInv(inv.t)); };
  const decide = (s, status) => { const tid = status === 'approved' ? prompt('معرّف المنشأة (أحرف إنجليزية صغيرة وأرقام وشرطة)', '') : ''; if (status === 'approved' && tid === null) return;
    act(() => api('/api/provider/signups/decide', { id: s.id, status, tenantId: tid || undefined }), status === 'approved' ? 'قُبل الطلب — نفّذ أمر التهيئة المعروض' : 'رُفض الطلب'); };
  if (!ts) return <div className="note">جارٍ تحميل لوحة مِثقال…</div>;
  return (
    <div className="mq-prov">
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div className="card-t" style={{ margin: 0 }}>لوحة مِثقال — المنشآت المشتركة</div>
        <button className="btn sm gh" style={{ marginInlineStart: 'auto' }} onClick={load}><RefreshCw size={13} />تحديث</button>
      </div>
      {msg && <div className="note" style={{ marginBottom: 8 }}>{msg}</div>}
      {cmd && <div className="note mq-prov-cmd" style={{ marginBottom: 8, direction: 'ltr', textAlign: 'left', fontFamily: 'monospace', fontSize: 12, userSelect: 'all' }}>{cmd}</div>}
      <div style={{ overflowX: 'auto' }}><table className="tbl" style={{ fontSize: 12.5 }}>
        <thead><tr><th>المنشأة</th><th>الخطة</th><th>الاشتراك</th><th>مدفوع حتى</th><th>التوصية</th><th>المفاتيح</th><th>إجراءات</th></tr></thead>
        <tbody>{ts.length === 0 ? <tr><td colSpan={7} className="note">لا منشآت مشتركة بعد.</td></tr> : ts.map(t => <tr key={t.id}>
          <td><b>{t.name || t.id}</b><div className="n" style={{ fontSize: 11, color: 'var(--dim)' }}>{t.id} · {t.projectId}</div></td>
          <td>{PLAN_AR[t.plan] || t.registryPlan || '—'}{t.registryPlan && t.plan && t.registryPlan !== t.plan ? ' ⚠' : ''}</td>
          <td>{STATE_AR[t.state] || t.state}{t.trial ? ' (تجربة)' : ''}</td>
          <td className="n">{t.paidThrough || '—'}</td>
          <td>{t.recommend && t.recommend !== 'active' ? <b style={{ color: 'var(--amber)' }}>{STATUS_AR[t.recommend]}</b> : '—'}</td>
          <td style={{ fontSize: 11 }}>{['web', 'zatca', 'ops'].map(k => <span key={k} style={{ marginInlineEnd: 6 }}>{(t.keys || {})[k] ? '✓' : '✕'} {k}</span>)}</td>
          <td><div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {t.state !== 'unconfigured' && <>
              <button className="btn sm gh" onClick={() => openInv(t)}>الفواتير</button>
              {!t.paidThrough && <button className="btn sm gh" onClick={() => trial(t)}>بدء تجربة</button>}
              {['active', 'readonly', 'suspended'].map(s => <button key={s} className="btn sm gh" onClick={() => status(t, s)}>{STATUS_AR[s]}</button>)}
            </>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
      {inv && <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ alignItems: 'center' }}><b>فواتير {inv.t.name || inv.t.id}</b><button className="btn sm gh" style={{ marginInlineStart: 'auto' }} onClick={() => setInv(null)}><X size={13} /></button></div>
        {inv.list.length === 0 ? <div className="note">لا فواتير.</div> : <table className="tbl" style={{ fontSize: 12 }}><tbody>{inv.list.map(v => <tr key={v.no}>
          <td className="n">{v.no}</td><td>{v.start} — {v.end}</td><td className="n">{sar(v.total)}</td><td>{INV_ST_AR[v.status] || v.status}{v.method ? ' · ' + v.method : ''}</td>
          <td>{v.status === 'pending_transfer' && <button className="btn sm pri" onClick={() => confirmTr(v)}><Check size={13} />تأكيد التحويل</button>}</td></tr>)}</tbody></table>}
      </div>}
      <div className="card-t" style={{ margin: '18px 0 8px' }}>طلبات التسجيل</div>
      {sg.length === 0 ? <div className="note">لا طلبات. رابط التسجيل العام: <span className="n" style={{ direction: 'ltr' }}>?signup</span></div> :
        <div style={{ overflowX: 'auto' }}><table className="tbl" style={{ fontSize: 12.5 }}>
          <thead><tr><th>الطلب</th><th>المنشأة</th><th>المسؤول</th><th>الخطة</th><th>الفروع</th><th>الحالة</th><th /></tr></thead>
          <tbody>{sg.map(s => <tr key={s.id}>
            <td className="n">{s.id}<div style={{ fontSize: 11, color: 'var(--dim)' }}>{String(s.at || '').slice(0, 10)}</div></td>
            <td><b>{s.company}</b>{s.city ? <div style={{ fontSize: 11 }}>{s.city}</div> : null}</td>
            <td>{s.contact}<div className="n" style={{ fontSize: 11, direction: 'ltr', textAlign: 'right' }}>{s.email} · {s.phone}</div></td>
            <td>{PLAN_AR[s.plan] || s.plan}</td><td className="n">{s.branches}</td>
            <td>{SG_AR[s.status] || s.status}{s.tenantId ? ' · ' + s.tenantId : ''}</td>
            <td>{s.status === 'new' && <div className="row" style={{ gap: 4 }}>
              <button className="btn sm pri" onClick={() => decide(s, 'approved')}><Check size={13} />قبول</button>
              <button className="btn sm gh" onClick={() => decide(s, 'rejected')}><X size={13} />رفض</button></div>}</td>
          </tr>)}</tbody></table></div>}
      <div className="note" style={{ marginTop: 12 }}>القبول لا ينشئ المنشأة تلقائيًا: يعرض أمر التهيئة لتنفيذه بحسابك في Google، ثم «بدء تجربة» عند جاهزيتها.</div>
    </div>
  );
}
