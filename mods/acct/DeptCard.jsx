/* v56.27 (FINANCE E4 — بقرار المالك): بُعد «القسم» الإداري — تفعيل، وقائمة الأقسام، وتقرير المصروفات حسب القسم.
   قائمة مالية مستقلة يضبطها المالك؛ القسم اختياري على سطر القيد اليدوي وفاتورة الخدمات؛ «مشترك» بلا توزيع؛ الرواتب لا تُقسَّم. */
import React, { useState } from 'react';
import { Layers, Plus, Download } from 'lucide-react';
import { DEPT_SHARED, deptOn, deptList, deptPL, money, uid, nowISO, makeXlsx } from '../../App.jsx';

export function DeptCard({ org, A, from, to, bf, canPost, commitOrg, say, flNote }) {
  const on = deptOn(org); const L = deptList(org, true); const [nm, setNm] = useState('');
  const R = on ? deptPL(org, A, from, to, bf) : null;
  const save = (fn, title, details) => commitOrg(d => ({ ...d, costDepts: fn({ on: false, list: [], ...(d.costDepts || {}) }) }), { actionType: 'settings', targetType: 'system_settings', targetId: 'costDepts', title, details: details || '' });
  const toggle = async () => { if (!canPost) return; if (await save(c => ({ ...c, on: !on, at: nowISO() }), on ? 'أوقف بُعد القسم' : 'فعّل بُعد القسم')) say(on ? 'أُوقف — الوسوم المحفوظة باقية' : 'فُعّل بُعد القسم ✓'); };
  const add = async () => { const n = nm.trim(); if (!n) return say('اكتب اسم القسم', 'no');
    if (L.some(d => d.name === n)) return say('القسم موجود', 'no');
    if (await save(c => ({ ...c, list: [...(c.list || []), { id: uid('dp'), name: n, active: true }] }), 'إضافة قسم', n)) { setNm(''); say('أُضيف ' + n + ' ✓'); } };
  const flip = (d) => save(c => ({ ...c, list: (c.list || []).map(x => x.id === d.id ? { ...x, active: x.active === false } : x) }), d.active === false ? 'إعادة تفعيل قسم' : 'إيقاف قسم', d.name);
  const xl = () => { if (!R) return; const rows = [['القسم', 'المصروفات (ر.س)'], ...R.rows.map(r => [r.name, r.v]), ['مشترك (بلا توزيع)', R.shared], ['بلا قسم', R.none], ['إجمالي التكاليف والمصروفات', R.total]];
    try { const b = makeXlsx([{ name: 'الأقسام', rows }]); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'المصروفات_حسب_القسم.xlsx'; a.click(); } catch { say('تعذّر التصدير', 'no'); } };
  return (<div className="card" data-dept>
    <div className="card-h"><div className="card-t"><Layers size={15} color="var(--brass)" />المصروفات حسب القسم (بُعد إداري)</div>
      <div className="row" style={{ gap: 6 }}>
        <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span>
        {canPost && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-dept-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
        {on && <button className="btn sm" onClick={xl} data-dept-xl><Download size={13} />Excel</button>}
      </div></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بقرارك: قائمة أقسام مستقلة (مطبخ، صالة، توصيل، إدارة…) · القسم اختياري على سطر القيد اليدوي وعلى فاتورة الخدمات · المصروف المشترك يُوسَم «مشترك» ولا يُوزَّع · الرواتب لا تُقسَّم حاليًا. يشمل كل حسابات المصروف بما فيها تكلفة المبيعات (غير الموسومة تظهر في «بلا قسم») — تقرير إداري فقط، لا يغيّر أي قيد.</div>
    {canPost && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      <input className="inp" style={{ width: 200 }} placeholder="اسم قسم جديد" aria-label="اسم القسم" value={nm} onChange={e => setNm(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
      <button className="btn sm" onClick={add} data-dept-add><Plus size={13} />إضافة قسم</button>
      {L.map(d => <button key={d.id} className={'btn sm ' + (d.active === false ? 'gh' : '')} title={d.active === false ? 'موقوف — اضغط لإعادته' : 'اضغط لإيقافه'} onClick={() => flip(d)} data-dept-item>{d.name}{d.active === false ? ' (موقوف)' : ''}</button>)}
    </div>}
    {R && flNote && <div className="note" data-dept-flnote style={{ marginBottom: 8, color: 'var(--amber)' }}>القوائم المالية لهذه الفترة تُقرأ من الدفتر المخزّن، وهذا التقرير من حساب القيود اللحظي (الدفتر المخزّن لا يحفظ القسم بعد) — قد يختلف الإجمالي إن وُجدت فروق بين المصدرين.</div>}
    {R && <div className="tw"><table className="tb" data-dept-table>
      <thead><tr><th>القسم</th><th style={{ textAlign: 'end' }}>التكاليف والمصروفات (ر.س)</th><th style={{ textAlign: 'end' }}>النسبة</th></tr></thead>
      <tbody>
        {[...R.rows, { id: DEPT_SHARED, name: 'مشترك (بلا توزيع)', v: R.shared }, { id: '', name: 'بلا قسم', v: R.none }].map(r => <tr key={r.id || '_'} data-dept-row>
          <td>{r.name}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.v)}</td><td className="num" style={{ textAlign: 'end' }}>{R.total ? (Math.round(r.v / R.total * 1000) / 10) + '%' : '—'}</td></tr>)}
        <tr style={{ fontWeight: 700 }} data-dept-total><td>إجمالي التكاليف والمصروفات</td><td className="num" style={{ textAlign: 'end' }}>{money(R.total)}</td><td /></tr>
      </tbody></table></div>}
  </div>);
}
