/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { ClipboardCheck, ShieldCheck, AlertTriangle, Eye, Check, X, Lock } from 'lucide-react';
import { Badge, ClosingView, Kpi, LOCK_MSG, ROLES, arDate, arTime, money, nowISO, periodLocked, uid } from '../../App.jsx';

export function Approvals({ org, me, scoped, commit, say }) {
  const [note, setNote] = useState({});
  const [view, setView] = useState(null);
  const isGM = !!ROLES[me.role]?.approver;
  const queue = scoped.closings.filter(c => c.status === 'submitted' || (c.status === 'approved' && c.gmApprovalStatus === 'pending'))
    .sort((a, b) => b.date.localeCompare(a.date));

  const act = async (c, kind) => {
    const reason = note[c.id] || '';
    if ((kind === 'audit' || kind === 'reject') && periodLocked(org, c.date)) return say(LOCK_MSG(c.date), 'no');
    if (kind === 'reject' && !reason) return say('اكتب سبب الرفض قبل الإرجاع', 'no');
    await commit(d => ({
      ...d,
      // v15.12: رفض الإغلاق يُبطِل توريده أيضًا (الحالة → rejected) فلا يبقى قيدٌ «تحت التحويل» وهمي في الحساب الوسيط ولا نقصٌ في نقد الفرع. (مطابق لسلوك حذف الإغلاق.)
      transfers: kind === 'reject' ? (d.transfers || []).map(t => t.closingId === c.id ? { ...t, status: 'rejected' } : t) : d.transfers,
      closings: d.closings.map(x => {
        if (x.id !== c.id) return x;
        if (kind === 'audit') return { ...x, status: 'approved', auditedBy: me.name, auditedAt: nowISO(), updatedAt: nowISO() };
        if (kind === 'gm') return { ...x, gmApprovalStatus: 'approved', gmApprovedBy: me.name, gmApprovedAt: nowISO(), gmNotes: reason, updatedAt: nowISO() };
        return { ...x, status: 'rejected', rejectionReason: reason, updatedAt: nowISO() };
      }),
      notifications: [{
        id: uid('n'), type: kind === 'reject' ? 'closing_rejected' : 'gm_approval',
        title: kind === 'reject' ? 'إغلاق مرفوض ويحتاج تصحيحاً' : kind === 'gm' ? 'اعتماد نهائي من الإدارة العليا' : 'تم تدقيق الإغلاق',
        message: `${c.branchName} — ${arDate(c.date)}${reason ? ' · ' + reason : ''}`,
        severity: kind === 'reject' ? 'high' : 'info', branchId: c.branchId, closingId: c.id,
        date: c.date, createdAt: nowISO(), isRead: false
      }, ...(d.notifications || [])].slice(0, 60)
    }), {
      actionType: kind === 'reject' ? 'reject' : 'approve', targetType: 'daily_closing', targetId: c.id,
      branchName: c.branchName,
      title: kind === 'audit' ? 'دقّق إغلاقاً مالياً' : kind === 'gm' ? 'اعتمد إغلاقاً نهائياً' : 'أرجع إغلاقاً للتصحيح',
      details: `${c.branchName} — ${arDate(c.date)}${reason ? ' · ' + reason : ''}`
    });
    say(kind === 'reject' ? 'أُرجع الإغلاق للفرع مع السبب' : 'تم الاعتماد بنجاح');
    setNote(p => ({ ...p, [c.id]: '' }));
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid g3">
        <Kpi label="بانتظار التدقيق المالي" value={scoped.closings.filter(c => c.status === 'submitted').length} icon={ClipboardCheck} color="#E0A458" />
        <Kpi label="بانتظار الاعتماد النهائي" value={scoped.closings.filter(c => c.status === 'approved' && c.gmApprovalStatus === 'pending').length} icon={ShieldCheck} color="#5B93C4" />
        <Kpi label="إغلاقات بها فروقات" value={queue.filter(c => c.variance !== 0).length} icon={AlertTriangle} color="#D9544D" />
      </div>

      {queue.length === 0 && <div className="card"><div className="empty">لا يوجد ما ينتظر إجراءك — كل الإغلاقات مدقّقة ومعتمدة.</div></div>}

      {queue.map(c => {
        const needAudit = c.status === 'submitted';
        const canAct = needAudit ? (ROLES[me.role]?.scope !== 'own' && ROLES[me.role]?.tabs?.includes('approve')) : isGM;
        return (
          <div key={c.id} className="card" style={{ borderColor: c.variance < 0 ? 'rgba(217,84,77,.3)' : 'var(--line)' }}>
            <div className="card-h">
              <div>
                <div className="card-t">{c.branchName}<span className="dt" style={{ color: 'var(--faint)', fontSize: 12 }}>{arDate(c.date)}</span></div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>سجّله {c.managerName} · {arTime(c.createdAt)}</div>
              </div>
              <div className="row">
                <Badge s={c.status} />
                {needAudit ? <span className="badge b-dim">المرحلة 1: تدقيق مالي</span> : <span className="badge b-sky">المرحلة 2: اعتماد نهائي</span>}
              </div>
            </div>
            <div className="grid g4" style={{ gap: 9 }}>
              <div className="mono-b"><span style={{ fontSize: 11 }}>الإيراد</span><span className="num" style={{ color: 'var(--brass)' }}>{money(c.totalRevenue)}</span></div>
              <div className="mono-b"><span style={{ fontSize: 11 }}>المصروف</span><span className="num" style={{ color: 'var(--rose)' }}>{money(c.totalExpenses)}</span></div>
              <div className="mono-b"><span style={{ fontSize: 11 }}>المرحّل</span><span className="num">{money(c.transferredToMainTreasury)}</span></div>
              <div className="mono-b" style={{ borderColor: c.variance !== 0 ? 'rgba(217,84,77,.4)' : 'var(--line)' }}>
                <span style={{ fontSize: 11 }}>الفرق</span>
                <span className="num" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>{money(c.variance)}</span>
              </div>
            </div>
            {c.varianceReason && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 10 }}>تبرير الفرق: {c.varianceReason}</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <input className="inp" style={{ flex: 1, minWidth: 180 }} placeholder="ملاحظة التدقيق أو سبب الإرجاع"
                value={note[c.id] || ''} onChange={e => setNote(p => ({ ...p, [c.id]: e.target.value }))} />
              <button className="btn sm gh" onClick={() => setView(c)}><Eye size={13} />تفاصيل</button>
              {canAct ? (
                <>
                  <button className="btn sm ok" onClick={() => act(c, needAudit ? 'audit' : 'gm')}>
                    <Check size={13} />{needAudit ? 'اعتماد التدقيق' : 'اعتماد نهائي'}
                  </button>
                  <button className="btn sm no" onClick={() => act(c, 'reject')}><X size={13} />إرجاع</button>
                </>
              ) : <span className="badge b-dim"><Lock size={10} />خارج صلاحيتك</span>}
            </div>
          </div>
        );
      })}
      {view && <ClosingView c={view} org={org} onClose={() => setView(null)} />}
    </div>
  );
}
