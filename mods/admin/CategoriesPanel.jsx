/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Plus, Receipt, Check } from 'lucide-react';
import { EXP_CATS, Field, Modal, Num, money, sum, today, uid } from '../../App.jsx';

export function CategoriesPanel({ org, ops, commitOrg, say }) {
  const [edit, setEdit] = useState(null);
  const month = today().slice(0, 7);
  const cats = org.expenseCats || EXP_CATS;

  const spent = useMemo(() => {
    const m = {};
    (ops.closings || []).filter(c => c.date.slice(0, 7) === month)
      .forEach(c => (c.expenses || []).forEach(e => { m[e.categoryId] = (m[e.categoryId] || 0) + e.amount; }));
    return m;
  }, [ops, month]);

  const save = async (c) => {
    const isNew = !cats.some(x => x.id === c.id);
    await commitOrg(d => ({
      ...d, expenseCats: isNew ? [...(d.expenseCats || []), c] : (d.expenseCats || []).map(x => x.id === c.id ? c : x)
    }), {
      actionType: isNew ? 'create' : 'update', targetType: 'system_settings', targetId: c.id,
      title: isNew ? 'أضاف بند مصروف' : 'عدّل بند مصروف وميزانيته',
      details: `${c.n} · حد شهري ${money(c.budgetLimitMonthly || 0)} ر.س`
    });
    say('تم حفظ البند'); setEdit(null);
  };

  const totalBudget = sum(cats, c => c.budgetLimitMonthly || 0);
  const totalSpent = sum(cats, c => spent[c.id] || 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <span className="badge b-dim">شهر <span className="num">{month}</span></span>
          <span className="badge b-brass">المنصرف <span className="num">{money(totalSpent)}</span> من <span className="num">{money(totalBudget)}</span></span>
        </div>
        <button className="btn pri" onClick={() => setEdit({ id: uid('ec'), n: '', taxable: true, budgetLimitMonthly: 5000 })}>
          <Plus size={15} />بند جديد
        </button>
      </div>

      <div className="grid g2">
        {cats.map(c => {
          const sp = spent[c.id] || 0, bd = c.budgetLimitMonthly || 0;
          const pct = bd ? Math.min(100, (sp / bd) * 100) : 0;
          const over = bd && sp > bd;
          return (
            <div key={c.id} className="card" style={{ borderColor: over ? 'rgba(217,84,77,.4)' : 'var(--line)' }}>
              <div className="card-h" style={{ marginBottom: 10 }}>
                <div className="card-t" style={{ fontSize: 13 }}>{c.n}</div>
                <div className="row">
                  <span className={'badge ' + (c.taxable ? 'b-sky' : 'b-dim')}>{c.taxable ? 'خاضع لض.ق.م' : 'معفى'}</span>
                  <button className="btn sm gh" onClick={() => setEdit(c)}>تعديل</button>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--dim)' }}>المنصرف هذا الشهر</span>
                <span className="num" style={{ color: over ? 'var(--rose)' : 'var(--txt)' }}>
                  {money(sp)} / {money(bd)}
                </span>
              </div>
              <div style={{ height: 7, background: 'var(--ink)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', borderRadius: 7, transition: '.5s', background: over ? 'var(--rose)' : pct > 80 ? 'var(--amber)' : 'var(--mint)' }} />
              </div>
              <div style={{ fontSize: 10.5, color: over ? 'var(--rose)' : 'var(--faint)', marginTop: 6 }}>
                {over ? `تجاوز الميزانية بمقدار ${money(sp - bd)} ر.س` : `المتبقي ${money(Math.max(0, bd - sp))} ر.س`}
              </div>
            </div>
          );
        })}
      </div>

      {edit && (
        <Modal title={edit.n ? 'تعديل بند مصروف' : 'بند مصروف جديد'} icon={Receipt} onClose={() => setEdit(null)}
          foot={<><button className="btn pri" disabled={!edit.n} onClick={() => save(edit)}><Check size={14} />حفظ البند</button>
            <button className="btn gh" onClick={() => setEdit(null)}>إلغاء</button></>}>
          <Field label="اسم البند">
            <input className="inp" value={edit.n} onChange={e => setEdit({ ...edit, n: e.target.value })} placeholder="مثال: مصاريف تسويق" />
          </Field>
          <Num label="حد الميزانية الشهري" value={edit.budgetLimitMonthly || 0}
            onChange={v => setEdit({ ...edit, budgetLimitMonthly: v })} hint="ينبّه النظام عند تجاوزه" />
          <label className="row" style={{ fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!edit.taxable} onChange={e => setEdit({ ...edit, taxable: e.target.checked })} />
            خاضع لضريبة القيمة المضافة 15%
          </label>
        </Modal>
      )}
    </div>
  );
}
