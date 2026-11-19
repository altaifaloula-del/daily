/* v51.3 — المرحلة 07 / S4: «الاشتراك والمنشأة» — عرض فقط.
   الخطة والحالة يحددهما مزوّد مِثقال (السجل + platform/release.sub في قاعدة المنشأة)، ولا يغيّرهما أي حساب داخل المنشأة.
   التطبيق الفعلي على الخادم: قواعد Firestore (للقراءة فقط/موقوف) وخادم مِثقال (الذكاء والفوترة حسب الخطة).
   v51.4 — S5: «الفواتير والدفع» للمنشآت المشتركة: مدى، فيزا/ماستركارد، Apple Pay، STC Pay عبر صفحة «ميسر» المستضافة، أو تحويل بنكي.
   الخادم وحده يصدر الفاتورة ويتحقق من الدفع من البوابة مباشرة؛ الواجهة تعرض وتطبع فقط. */
import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, CreditCard, Landmark, Printer, RefreshCw } from 'lucide-react';
import { TENANT } from '../../tenant.js';
import { planFeatures, PLAN_AR, FEATURE_AR, STATUS_AR, branchesOk } from '../../plans.js';
import { PERIOD_AR, INV_ST_AR, SUB_STATE_AR, PAYMENT_METHODS, amounts, sar, VAT_RATE } from '../../billing.js';
import { aiHeaders, openDocWin, A4_CSS, zatcaTLV, qrSvg, escH } from '../../App.jsx';

const pill = (on) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: '1px solid var(--line)', background: on ? 'rgba(46,139,98,.12)' : 'transparent', color: on ? 'var(--green, #2E8B62)' : 'var(--dim)' });
const REGION_AR = { 'me-central2': 'الدمام — المملكة العربية السعودية' };
const apiBase = () => { const E = import.meta.env || {}; if (E.VITE_ZATCA_ENDPOINT) return String(E.VITE_ZATCA_ENDPOINT).replace(/\/+$/, '');
  try { return E.VITE_AI_ENDPOINT ? new URL(E.VITE_AI_ENDPOINT).origin : ''; } catch { return ''; } };
const GW_METHODS = PAYMENT_METHODS.filter(m => m.via === 'gateway').map(m => m.ar).join('، ');

/** الفاتورة الضريبية لاشتراك مِثقال — البائع مِثقال والمشتري المنشأة (البيانات محفوظة في الفاتورة وقت إصدارها) */
export function subInvoiceHtml(inv) {
  const e = (v) => escH(String(v == null ? '' : v));
  const std = !!(inv.buyer && inv.buyer.vatNo);
  const qr = qrSvg(zatcaTLV(inv.seller.name, inv.seller.vatNo, inv.issuedAt, inv.total / 100, inv.vat / 100), { px: 120 });
  const row = (k, v) => `<tr><td style="color:#555;width:38%">${k}</td><td><b>${v}</b></td></tr>`;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${e(inv.no)}</title><style>${A4_CSS}
    .h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #10294A;padding-bottom:10px;margin-bottom:14px}
    table{width:100%;border-collapse:collapse;font-size:12.5px} td,th{border:1px solid #DDE2EA;padding:6px 8px;text-align:right} th{background:#F3F5F8}
    .t{font-size:20px;font-weight:700;color:#10294A}.paid{color:#2E8B62;font-weight:700}</style></head><body>
    <div class="h"><div><div class="t">${std ? 'فاتورة ضريبية' : 'فاتورة ضريبية مبسطة'}</div><div>رقم الفاتورة: <b>${e(inv.no)}</b></div><div>تاريخ الإصدار: ${e(inv.issuedAt.slice(0, 10))}</div></div><div>${qr}</div></div>
    <table><tr><th colspan="2">البائع</th><th colspan="2">المشتري</th></tr>
      <tr><td>الاسم</td><td>${e(inv.seller.name)}</td><td>الاسم</td><td>${e(inv.buyer.name)}</td></tr>
      <tr><td>الرقم الضريبي</td><td>${e(inv.seller.vatNo)}</td><td>الرقم الضريبي</td><td>${e(inv.buyer.vatNo || '—')}</td></tr>
      <tr><td>السجل التجاري</td><td>${e(inv.seller.crNo || '—')}</td><td>العنوان</td><td>${e(inv.buyer.address || '—')}</td></tr>
      <tr><td>العنوان</td><td colspan="3">${e(inv.seller.address || '—')}</td></tr></table>
    <h3 style="margin:16px 0 6px">البيان</h3>
    <table><tr><th>الوصف</th><th>الفترة</th><th>المبلغ قبل الضريبة</th><th>الضريبة ${VAT_RATE}%</th><th>الإجمالي</th></tr>
      <tr><td>اشتراك منصة مِثقال — خطة ${e(PLAN_AR[inv.plan] || inv.plan)} (${e(PERIOD_AR[inv.period] || inv.period)})</td><td>${e(inv.start)} — ${e(inv.end)}</td><td>${sar(inv.net)}</td><td>${sar(inv.vat)}</td><td><b>${sar(inv.total)}</b></td></tr></table>
    <table style="margin-top:12px;width:50%">${row('الإجمالي قبل الضريبة', sar(inv.net) + ' ر.س')}${row('ضريبة القيمة المضافة', sar(inv.vat) + ' ر.س')}${row('الإجمالي شامل الضريبة', sar(inv.total) + ' ر.س')}
      ${row('الحالة', `<span class="${inv.status === 'paid' ? 'paid' : ''}">${e(INV_ST_AR[inv.status] || inv.status)}</span>` + (inv.paidAt ? ' — ' + e(inv.paidAt.slice(0, 10)) : ''))}</table>
    </body></html>`;
}

function Billing({ tenant }) {
  const [d, setD] = useState(null), [busy, setBusy] = useState(''), [err, setErr] = useState(''), [period, setPeriod] = useState('monthly'), [bank, setBank] = useState(null);
  const base = apiBase();
  const load = useCallback(async () => {
    if (!base) { setD({ enabled: false }); return; }
    try { const r = await fetch(base + '/api/billing/summary', { headers: await aiHeaders() }); const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'تعذّر تحميل بيانات الاشتراك'); setD({ enabled: false, denied: r.status === 403 }); return; }
      setD(j); if (j.prices && !j.prices[period]) setPeriod(Object.keys(j.prices)[0] || 'monthly');
    } catch { setErr('تعذّر الاتصال بخادم مِثقال'); setD({ enabled: false }); }
  }, [base]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (async () => {
    // العودة من صفحة الدفع: الخادم يتحقق من البوابة مباشرة ثم تُحدَّث البطاقة
    let no = ''; try { no = new URL(location.href).searchParams.get('billing') || ''; } catch { }
    if (no && base) { try { await fetch(base + '/api/billing/refresh', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ no }) }); } catch { }
      try { const u = new URL(location.href); u.searchParams.delete('billing'); history.replaceState(null, '', u.toString()); } catch { } }
    load();
  })(); }, [load, base]);
  if (!d) return <div className="note" style={{ marginTop: 10 }}>جارٍ تحميل الفواتير…</div>;
  if (!d.enabled) return <div className="note mq-bill-off" style={{ marginTop: 10 }}>{d.denied ? 'الاشتراك والدفع لمسؤول المنشأة فقط.' : 'الدفع الإلكتروني للاشتراك غير مفعّل بعد — تواصل مع مِثقال.'}</div>;
  const price = d.prices && d.prices[period], A = price ? amounts(price) : null;
  const pay = async (method) => {
    setBusy(method); setErr(''); setBank(null);
    try { const r = await fetch(base + '/api/billing/checkout', { method: 'POST', headers: await aiHeaders(), body: JSON.stringify({ period, method }) }); const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'تعذّر بدء الدفع'); return; }
      if (method === 'bank') { setBank(j); load(); return; }
      if (j.url && /^https:\/\//.test(j.url)) location.assign(j.url);
    } catch { setErr('تعذّر الاتصال بخادم مِثقال'); } finally { setBusy(''); }
  };
  const printInv = async (no) => {
    try { const r = await fetch(base + '/api/billing/invoice/' + encodeURIComponent(no), { headers: await aiHeaders() }); const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'تعذّر تحميل الفاتورة'); return; }
      const w = openDocWin('width=900,height=1000'); if (!w) return; w.document.write(subInvoiceHtml(j)); w.document.close();
    } catch { setErr('تعذّر تحميل الفاتورة'); }
  };
  const S = d.sub || {};
  return (
    <div className="mq-bill" style={{ marginTop: 12 }}>
      <div className="lbl" style={{ marginBottom: 6 }}>الفواتير والدفع</div>
      <div className="note" style={{ marginBottom: 8 }}>
        {SUB_STATE_AR[S.state] || ''}{S.paidThrough ? ' — مدفوع حتى ' + S.paidThrough : ''}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {Object.keys(d.prices || {}).map(p => <label key={p} className="row" style={{ gap: 4, fontSize: 12.5, cursor: 'pointer' }}>
          <input type="radio" name="mq-period" checked={period === p} onChange={() => setPeriod(p)} />{PERIOD_AR[p]}: {sar(amounts(d.prices[p]).total)} ر.س
        </label>)}
      </div>
      {A && <div className="note" style={{ margin: '6px 0' }}>{sar(A.net)} ر.س + ضريبة {VAT_RATE}% {sar(A.vat)} = <b>{sar(A.total)} ر.س</b></div>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn pri sm" disabled={!!busy || !price} onClick={() => pay('gateway')}><CreditCard size={14} />{busy === 'gateway' ? 'جارٍ التحويل لصفحة الدفع…' : 'ادفع إلكترونيًا'}</button>
        {d.bank && (d.methods || []).includes('bank') && <button className="btn sm" disabled={!!busy || !price} onClick={() => pay('bank')}><Landmark size={14} />تحويل بنكي</button>}
      </div>
      <div className="note" style={{ marginTop: 4 }}>الدفع الإلكتروني: {GW_METHODS} — عبر صفحة «ميسر» الآمنة؛ بيانات البطاقة لا تمر بمِثقال.</div>
      {bank && <div className="card mq-bank" style={{ marginTop: 8, padding: 10 }}>
        <div>حوّل <b>{sar(bank.total)} ر.س</b> إلى:</div>
        <div>المستفيد: <b>{bank.bank.holder}</b>{bank.bank.name ? ' — ' + bank.bank.name : ''}</div>
        <div style={{ direction: 'ltr', textAlign: 'right' }}><b>{bank.bank.iban}</b></div>
        <div>واكتب في وصف التحويل رقم الفاتورة: <b>{bank.reference}</b> — يُفعَّل الاشتراك بعد تأكيد مِثقال لاستلام المبلغ.</div>
      </div>}
      {err && <div className="note" style={{ color: 'var(--rose, #c0392b)', marginTop: 6 }}>{err}</div>}
      {(d.invoices || []).length > 0 && <table className="tbl" style={{ fontSize: 12, marginTop: 10 }}><thead><tr><th>الفاتورة</th><th>الفترة</th><th>الإجمالي</th><th>الحالة</th><th /></tr></thead><tbody>
        {d.invoices.map(v => <tr key={v.no}><td className="n">{v.no}</td><td>{v.start} — {v.end}</td><td className="n">{sar(v.total)}</td><td>{INV_ST_AR[v.status] || v.status}</td>
          <td><button className="btn sm gh" title="طباعة الفاتورة" onClick={() => printInv(v.no)}><Printer size={13} /></button></td></tr>)}
      </tbody></table>}
      <button className="btn sm gh" style={{ marginTop: 6 }} onClick={() => { setD(null); load(); }}><RefreshCw size={13} />تحديث</button>
    </div>
  );
}

export function SubscriptionCard({ branches = 0, tenant = TENANT }) {
  const F = planFeatures(tenant.plan), isDef = tenant.id === 'default';
  const rows = [
    ['المنشأة', isDef ? 'المنشأة الرئيسية (الافتراضية)' : (tenant.name || tenant.id)],
    ['المعرّف', isDef ? '—' : tenant.id],
    ['الخطة', PLAN_AR[tenant.plan] || tenant.plan],
    ['الحالة', STATUS_AR[tenant.status || 'active']],
    ['موقع البيانات', isDef ? 'مشروع المنشأة الحالي' : (REGION_AR[tenant.region] || tenant.region)],
    ['مشروع البيانات', (tenant.firebase && tenant.firebase.projectId) || '—']
  ];
  const over = !branchesOk(tenant.plan, branches);
  return (
    <div className="card mq-sub-card" style={{ marginTop: 12, background: 'var(--ink)' }}>
      <div className="card-t" style={{ marginBottom: 10 }}><ShieldCheck size={15} color="var(--brass)" />الاشتراك والمنشأة</div>
      <table className="tbl" style={{ fontSize: 12.5 }}><tbody>
        {rows.map(([k, v]) => <tr key={k}><td style={{ color: 'var(--dim)', width: '38%' }}>{k}</td><td><b>{v}</b></td></tr>)}
      </tbody></table>
      <div className="lbl" style={{ margin: '12px 0 6px' }}>الخصائص المشمولة</div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {['ai', 'zatca'].map(k => <span key={k} style={pill(F[k])}>{F[k] ? '✓' : '✕'} {FEATURE_AR[k]}</span>)}
        <span style={pill(true)}>{FEATURE_AR.maxBranches + ': ' + (F.maxBranches ? branches + ' / ' + F.maxBranches : branches + ' (بلا حد)')}</span>
      </div>
      {over && <div className="note" style={{ marginTop: 8, color: 'var(--amber)' }}>عدد الفروع يتجاوز حد الخطة — تواصل مع مِثقال لترقية الاشتراك.</div>}
      <div className="note" style={{ marginTop: 10 }}>الخطة والحالة يحددهما مزوّد مِثقال ولا تُعدَّل من داخل المنشأة. تغييرها يتم بطلب ترقية أو تجديد.</div>
      {!isDef && <Billing tenant={tenant} />}
    </div>
  );
}
