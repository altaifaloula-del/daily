/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Plus, Search, X, Eye, Trash2 } from 'lucide-react';
import { Badge, ClosingForm, ClosingView, Field, LOCK_MSG, ROLES, arDate, businessDay, money, periodLocked, today } from '../../App.jsx';

export function Closing({ org, ops, me, myBranches, scoped, commit, commitOrg, say }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const canEdit = !!ROLES[me.role]?.create;
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [bid, setBid] = useState('all');
  const [fromD, setFromD] = useState('');
  const [toD, setToD] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(15);

  const filtered = [...scoped.closings]
    // v15.26/v15.27: قيْد «اليوم فقط» (الكاشير) لا يحجب ما ينتظر عمله — المسودات غير المكتملة
    // والمرفوضات المعادة للتصحيح تظهر دائماً مهما كان تاريخها، بينما السجل المرحّل/المعتمد
    // يبقى لليوم الحالي فقط (منع تصفّح تاريخ المبيعات).
    .filter(c => !ROLES[me.role]?.todayOnly || c.date === today() || c.date === businessDay() || c.status === 'draft' || c.status === 'rejected')
    .filter(c => st === 'all' || c.status === st)
    .filter(c => bid === 'all' || c.branchId === bid)
    .filter(c => !fromD || c.date >= fromD)
    .filter(c => !toD || c.date <= toD)
    .filter(c => !q || (c.branchName + c.date + (c.managerName || '')).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const list = filtered.slice(0, limit);

  const remove = (c) => {
    if (periodLocked(org, c.date)) return say(LOCK_MSG(c.date), 'no');
    return commit(
    d => ({ ...d, closings: d.closings.filter(x => x.id !== c.id), transfers: d.transfers.filter(t => t.closingId !== c.id) }),
    { actionType: 'delete', targetType: 'daily_closing', targetId: c.id, branchName: c.branchName, title: 'حذف إغلاق يومي', details: `${c.branchName} — ${arDate(c.date)}` }
  ).then(() => say('تم حذف الإغلاق'));
  };

  // v15.17 — حذف نهائي لإغلاق مُرحّل/معتمد (للإدارة فقط): تصفير إدخال تجريبي بعينه.
  // القيود المحاسبية مشتقّة حسابيًا من الإغلاقات نفسها (لا نسخة مخزّنة) — فحذف الإغلاق
  // يُصفّر أثره من كل الحسابات والتقارير فورًا وبأثر رجعي، دون أي مساس بغيره من البيانات.
  const removeFinal = (c) => {
    if (periodLocked(org, c.date)) return say(LOCK_MSG(c.date), 'no');
    if (!window.confirm('حذف نهائي لإغلاق «' + c.branchName + ' — ' + arDate(c.date) + '» (إيراد ' + money(c.totalRevenue) + ' ر.س)؟\n\nسيختفي من كل السجلات والتقارير والحسابات فورًا وبأثر رجعي، وتُحذف تحويلاته المرتبطة بالخزينة، ولا يمكن التراجع.\nبقية الإغلاقات وكل البيانات الأخرى لا تتأثر إطلاقًا، ويصبح هذا اليوم قابلًا لإغلاق جديد.')) return;
    return commit(
      d => ({ ...d, closings: d.closings.filter(x => x.id !== c.id), transfers: (d.transfers || []).filter(t => t.closingId !== c.id) }),
      { actionType: 'delete', targetType: 'daily_closing', targetId: c.id, branchName: c.branchName, need: 'edit', title: 'حذف نهائي لإغلاق مُرحّل (تصفير)', details: `${c.branchName} — ${arDate(c.date)} · إيراد ${money(c.totalRevenue)} · كان بحالة ${c.status}` }
    ).then(ok => { if (ok) say('حُذف الإغلاق نهائيًا — وأثره أُزيل من كل الحسابات والتقارير ✓'); });
  };
  const isAdminMe = !!ROLES[me.role]?.admin;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="pagehead">
        <div>
          <h2 className="pagehead-t">الإغلاق اليومي</h2>
          <div className="pagehead-s">مطابقة النقدية وترحيلها للخزينة الرئيسية</div>
        </div>
        {canEdit && (
          <button className="btn pri newclosing-btn" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus size={16} />إغلاق وردية جديد
          </button>
        )}
      </div>

      {/* زر عائم دائم الظهور على الجوال — لا يختفي بالتمرير */}
      {canEdit && (
        <button className="btn pri fab-new" onClick={() => { setEdit(null); setOpen(true); }} aria-label="فتح نموذج إغلاق وردية جديد">
          <Plus size={20} /><span className="fab-lbl">إغلاق وردية</span>
        </button>
      )}

      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 7, flex: 1, minWidth: 0 }}>
              <Search size={14} color="var(--faint)" style={{ flexShrink: 0 }} />
              <input className="inp" style={{ flex: 1, minWidth: 0 }} placeholder="بحث سريع..."
                value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <button className={'btn sm' + (showFilters || st !== 'all' || bid !== 'all' || fromD || toD ? ' pri' : ' gh')}
              onClick={() => setShowFilters(v => !v)} style={{ flexShrink: 0 }}>
              <Search size={13} />فلترة
              {(st !== 'all' || bid !== 'all' || fromD || toD) && <span className="num" style={{ marginInlineStart: 3 }}>•</span>}
            </button>
            <span className="badge b-dim" style={{ flexShrink: 0 }}><span className="num">{filtered.length}</span></span>
          </div>
          {showFilters && (
            <div className="card" style={{ padding: 12, marginTop: 10, background: 'var(--ink)' }}>
              <div className="grid g2" style={{ gap: 10 }}>
                <Field label="الحالة">
                  <select className="sel" value={st} onChange={e => setSt(e.target.value)}>
                    <option value="all">كل الحالات</option>
                    <option value="draft">مسودة</option>
                    <option value="submitted">مرحّل للمراجعة</option>
                    <option value="approved">مدقّق ومعتمد</option>
                    <option value="rejected">مرفوض</option>
                  </select>
                </Field>
                {myBranches.length > 1 && (
                  <Field label="الفرع">
                    <select className="sel" value={bid} onChange={e => setBid(e.target.value)}>
                      <option value="all">كل الفروع</option>
                      {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="من تاريخ">
                  <input type="date" className="inp" value={fromD} onChange={e => setFromD(e.target.value)} />
                </Field>
                <Field label="إلى تاريخ">
                  <input type="date" className="inp" value={toD} onChange={e => setToD(e.target.value)} />
                </Field>
              </div>
              {(q || st !== 'all' || bid !== 'all' || fromD || toD) && (
                <button className="btn sm gh" style={{ marginTop: 10 }} onClick={() => { setQ(''); setSt('all'); setBid('all'); setFromD(''); setToD(''); }}>
                  <X size={13} />مسح كل الفلاتر
                </button>
              )}
            </div>
          )}
        </div>
        <div className="tw">
          <table className="tb cards">
            <thead><tr>
              <th>التاريخ</th><th>الفرع</th><th>الإيراد</th><th>المصروف</th>
              <th>المتوقع بالصندوق</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th></th>
            </tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td data-label="التاريخ" style={{ whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600 }}>{arDate(c.date)}</td>
                  <td data-label="الفرع" style={{ fontSize: 12 }}>{c.branchName}</td>
                  <td className="num" data-label="الإيراد" style={{ color: 'var(--brass)' }}>{money(c.totalRevenue)}</td>
                  <td className="num" data-label="المصروف" style={{ color: 'var(--rose)' }}>{money(c.totalExpenses)}</td>
                  <td className="num" data-label="المتوقع بالصندوق">{money(c.expectedCashInSafe)}</td>
                  <td className="num" data-label="الفعلي">{money(c.actualCashCount)}</td>
                  <td className="num" data-label="الفرق" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>
                    {c.variance > 0 ? '+' : ''}{money(c.variance)}
                  </td>
                  <td data-label="الحالة"><Badge s={c.status} /></td>
                  <td className="acts">
                    <div className="row" style={{ gap: 5, flexWrap: 'nowrap' }}>
                      <button className="btn sm gh" onClick={() => setView(c)}><Eye size={13} /></button>
                      {canEdit && (c.status === 'draft' || c.status === 'rejected') && (
                        <>
                          <button className="btn sm gh" onClick={() => { setEdit(c); setOpen(true); }}>{c.status === 'rejected' ? 'تصحيح' : 'تعديل'}</button>
                          {c.status === 'draft' && <button className="btn sm gh" onClick={() => remove(c)}><Trash2 size={13} color="#D9544D" /></button>}
                        </>
                      )}
                      {/* v16.9 — بطلب المالك: الإدارة تعدّل الإغلاق المرحّل/المعتمد وتعيده مسودة ليراجعها الكاشير */}
                      {isAdminMe && (c.status === 'submitted' || c.status === 'approved') && (
                        <button className="btn sm gh" title="تعديل الإغلاق وإعادته مسودة ليراجعها الكاشير ويرحّله من جديد (للإدارة)"
                          onClick={() => {
                            if (periodLocked(org, c.date)) return say(LOCK_MSG(c.date), 'no');
                            setEdit(c); setOpen(true);
                          }}>تعديل كمسودة</button>
                      )}
                      {isAdminMe && c.status !== 'draft' && (
                        <button className="btn sm gh" title="حذف نهائي — تصفير هذا الإغلاق من كل السجلات والحسابات (للإدارة)"
                          onClick={() => removeFinal(c)}><Trash2 size={13} color="#D9544D" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={9}><div className="empty">
                {scoped.closings.length ? 'لا نتائج مطابقة لبحثك.' : 'لا توجد إغلاقات ضمن نطاقك بعد.'}
              </div></td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > limit && (
          <button className="btn" style={{ marginTop: 12 }} onClick={() => setLimit(l => l + 15)}>
            عرض 15 إغلاقاً إضافياً ({filtered.length - limit} متبقٍ)
          </button>
        )}
      </div>

      {open && (
        <ClosingForm key={formKey} org={org} me={me} branches={myBranches} initial={edit} commit={commit} commitOrg={commitOrg} say={say}
          existing={ops.closings || []} invoices={ops.invoices || []} branchPartners={ops.branchPartners || []} posOrders={ops.posOrders || []} posImports={ops.posImports || []}
          onStartNew={() => { setEdit(null); setFormKey(k => k + 1); }}
          onClose={() => { setOpen(false); setEdit(null); }} />
      )}
      {view && <ClosingView c={view} org={org} onClose={() => setView(null)} />}
    </div>
  );
}
