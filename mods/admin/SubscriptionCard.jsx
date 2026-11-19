/* v51.3 — المرحلة 07 / S4: «الاشتراك والمنشأة» — عرض فقط.
   الخطة والحالة يحددهما مزوّد مِثقال (السجل + mq_control في قاعدة المنشأة)، ولا يغيّرهما أي حساب داخل المنشأة.
   التطبيق الفعلي على الخادم: قواعد Firestore (للقراءة فقط/موقوف) وخادم مِثقال (الذكاء والفوترة حسب الخطة). */
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { TENANT } from '../../tenant.js';
import { planFeatures, PLAN_AR, FEATURE_AR, STATUS_AR, branchesOk } from '../../plans.js';

const pill = (on) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, border: '1px solid var(--line)', background: on ? 'rgba(46,139,98,.12)' : 'transparent', color: on ? 'var(--green, #2E8B62)' : 'var(--dim)' });
const REGION_AR = { 'me-central2': 'الدمام — المملكة العربية السعودية' };

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
    </div>
  );
}
