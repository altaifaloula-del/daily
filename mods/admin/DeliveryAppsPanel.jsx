/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Plus, Truck, Trash2 } from 'lucide-react';
import { APPS, Field, uid } from '../../App.jsx';

export function DeliveryAppsPanel({ org, ops = {}, commitOrg, say }) {
  const apps = org.deliveryApps || APPS;
  const [nm, setNm] = useState('');
  const [comm, setComm] = useState('');

  const addApp = async () => {
    const name = nm.trim();
    if (!name) return say('أدخل اسم التطبيق', 'no');
    const c = Number(comm) || 0;
    if (c < 0 || c > 100) return say('نسبة العمولة يجب أن تكون بين 0 و 100', 'no');
    if (apps.some(a => a.n === name)) return say('هذا التطبيق مضاف مسبقاً', 'no');
    const app = { id: uid('app'), n: name, c };
    await commitOrg(d => ({ ...d, deliveryApps: [...(d.deliveryApps || APPS), app] }), {
      actionType: 'create', targetType: 'delivery_app', targetId: app.id, title: 'أضاف تطبيق توصيل', details: `${name} — عمولة ${c}%`
    });
    setNm(''); setComm(''); say('تمت إضافة التطبيق — سيظهر في الإغلاقات الجديدة');
  };

  const updateComm = async (id, c) => {
    await commitOrg(d => ({ ...d, deliveryApps: (d.deliveryApps || APPS).map(a => a.id === id ? { ...a, c: Number(c) || 0 } : a) }), {
      actionType: 'update', targetType: 'delivery_app', targetId: id, title: 'عدّل عمولة تطبيق توصيل', details: `عمولة ${c}%`
    });
  };

  const removeApp = async (app) => {
    // v29.4: حذف تطبيق له مبيعات أو تسويات يغيّر رموز حسابات التطبيقات التالية في الدليل وينقل ذمته للحساب العام
    const used = (ops.closings || []).some(c => (c.deliverySales || []).some(s => s.appId === app.id && (s.amount || 0) > 0))
      || (ops.appSettlements || []).some(s => s.appId === app.id);
    if (used) return say('لا يُحذف تطبيق عليه مبيعات أو تسويات مسجّلة — اضبط عمولته أو اتركه دون استخدام', 'no');
    await commitOrg(d => ({ ...d, deliveryApps: (d.deliveryApps || APPS).filter(a => a.id !== app.id) }), {
      actionType: 'delete', targetType: 'delivery_app', targetId: app.id, title: 'حذف تطبيق توصيل', details: app.n
    });
    say('تم حذف التطبيق');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card" style={{ borderColor: 'rgba(200,162,74,.3)' }}>
        <div className="card-h"><div className="card-t"><Plus size={15} />إضافة تطبيق توصيل جديد</div></div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 12 }}>
          عند ظهور تطبيق توصيل جديد في السوق، أضِفه هنا فيظهر تلقائياً في نموذج الإغلاق اليومي لكل الفروع.
        </div>
        <div className="row" style={{ gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="اسم التطبيق" style={{ flex: 1, minWidth: 160 }}>
            <input className="inp" placeholder="مثال: مرسول، ذا شيف..." value={nm} onChange={e => setNm(e.target.value)} />
          </Field>
          <Field label="نسبة العمولة %" style={{ width: 130 }}>
            <input className="inp n" inputMode="decimal" placeholder="0" value={comm} onChange={e => setComm(e.target.value.replace(/[^\d.]/g, ''))} />
          </Field>
          <button className="btn pri" onClick={addApp}><Plus size={15} />إضافة</button>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><Truck size={15} />التطبيقات المفعّلة ({apps.length})</div></div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>التطبيق</th><th>نسبة العمولة %</th><th></th></tr></thead>
            <tbody>
              {apps.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.n}</td>
                  <td>
                    <input className="inp n" style={{ width: 90 }} inputMode="decimal" defaultValue={a.c}
                      onBlur={e => updateComm(a.id, e.target.value.replace(/[^\d.]/g, ''))} />
                  </td>
                  <td>
                    <button className="btn sm gh" onClick={() => removeApp(a)}><Trash2 size={12} color="#D9544D" />حذف</button>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && <tr><td colSpan={3}><div className="empty">لا توجد تطبيقات. أضف تطبيقاً من الأعلى.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
