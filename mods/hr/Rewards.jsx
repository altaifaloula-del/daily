/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { PenLine, Coins, ShieldCheck, TrendingUp, Send, Trash2, Check, X, Plus, Sparkles } from 'lucide-react';
import { Field, LOCK_MSG, ROLES, defaultRewardTiers, hrScoreFor, lockedThru, money, nowISO, rewardSignDoc, today, uid } from '../../App.jsx';

export function Rewards({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const canRequest = me.role === 'branch_manager' || isAll;   // تسجيل طلب: مدير الفرع + أدوار المركز
  const canApprove = !!role.approver;                          // الاعتماد/الرفض: المكتب الرئيسي، مسؤول النظام، الإدارة العليا (قرار H/5: اعتماد كامل قبل أي أثر مالي)
  const canTiers = isAll;                                      // شرائح المكافآت: أدوار المركز
  const branches = myBranches || [];
  const tiersCfg = { ...defaultRewardTiers(), ...(org.rewardTiers || {}) };

  const [view, setView] = useState(canApprove ? 'queue' : 'requests');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => { if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || ''); }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;
  const branchIds = branches.map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const ymLabel = (y) => { const [Y, M] = String(y).split('-').map(Number); return isNaN(Y) ? y : new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };
  const kindAr = (k) => k === 'reward' ? 'مكافأة' : 'جزاء';
  const statusBadge = (st) => <span className={'badge ' + (st === 'approved' ? 'b-mint' : st === 'rejected' ? 'b-rose' : 'b-amber')}>{st === 'approved' ? 'معتمد ومُرحَّل' : st === 'rejected' ? 'مرفوض' : 'قيد الاعتماد'}</span>;
  const allReqs = (ops.rewardRequests || []).filter(r => branchIds.includes(r.branchId)).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));

  // === 1) طلب مكافأة/جزاء ===
  const [f, setF] = useState({ empId: '', kind: 'reward', amount: '', reason: '', month: today().slice(0, 7) });
  const submit = async () => {
    if (!branch) return;
    const emp = emps.find(e => e.id === f.empId);
    const amt = Number(f.amount);
    if (!emp) return say('اختر الموظف', 'no');
    if (!(amt > 0)) return say('أدخل مبلغًا صحيحًا أكبر من صفر', 'no');
    if (!String(f.reason || '').trim()) return say('السبب إلزامي', 'no');
    if (!/^\d{4}-\d{2}$/.test(f.month)) return say('اختر شهر الراتب المستهدف', 'no');
    if (lockedThru(org) && f.month <= lockedThru(org)) return say(LOCK_MSG(f.month + '-01'), 'no');
    const rec = { id: uid('rw'), branchId: branch.id, branchName: branch.name, employeeId: emp.id, employeeName: emp.name, kind: f.kind, amount: Math.round(amt * 100) / 100, reason: f.reason.trim(), month: f.month, source: 'manual', status: 'pending', requestedBy: me.id, requestedByName: me.name, requestedAt: nowISO() };
    const ok = await commit(d => ({ ...d, rewardRequests: [rec, ...(d.rewardRequests || [])] }),
      { actionType: 'create', targetType: 'reward_request', targetId: rec.id, branchName: branch.name, title: 'طلب ' + kindAr(rec.kind) + ' لموظف', details: emp.name + ' · ' + money(rec.amount) + ' ر.س · ' + rec.reason + ' · شهر ' + rec.month });
    if (!ok) return;
    say('أُرسل طلب ' + kindAr(rec.kind) + ' ✓ — بانتظار الاعتماد المركزي');
    setF({ empId: '', kind: 'reward', amount: '', reason: '', month: f.month });
  };
  const cancelReq = async (r) => {
    if (r.status !== 'pending') return;
    if (!window.confirm('إلغاء طلب ' + kindAr(r.kind) + ' لـ«' + r.employeeName + '»؟')) return;
    await commit(d => ({ ...d, rewardRequests: (d.rewardRequests || []).filter(x => x.id !== r.id) }),
      { actionType: 'delete', targetType: 'reward_request', targetId: r.id, branchName: r.branchName, title: 'إلغاء طلب ' + kindAr(r.kind), details: r.employeeName + ' · ' + money(r.amount) });
    say('أُلغي الطلب');
  };

  // === 2) الاعتماد المركزي + 3) الترحيل التلقائي لمسيّر الرواتب ===
  const [notes, setNotes] = useState({});
  const pending = allReqs.filter(r => r.status === 'pending');
  const decided = allReqs.filter(r => r.status !== 'pending');
  const decide = async (r, approve) => {
    if (!canApprove) return;
    const note = (notes[r.id] || '').trim();
    if (approve) {
      if (lockedThru(org) && r.month <= lockedThru(org)) return say(LOCK_MSG(r.month + '-01'), 'no');
      // idempotent: إن كانت حركة الراتب موجودة من محاولة سابقة لم تكتمل، لا تُنشأ ثانية
      const existing = (ops.advances || []).find(a => a.rewardId === r.id);
      const adv = existing || {
        id: uid('ad'), rewardId: r.id, employeeId: r.employeeId, employeeName: r.employeeName, branchId: r.branchId, branchName: r.branchName,
        month: r.month, date: r.month + '-28', type: r.kind === 'reward' ? 'bonus' : 'discipline_penalty', amount: r.amount,
        reason: (r.kind === 'reward' ? 'مكافأة معتمدة' : 'جزاء معتمد') + (r.source === 'tier' ? ' (شريحة أداء)' : '') + ': ' + r.reason,
        paymentMethod: 'salary', isUnjustified: false, createdByName: me.name, createdAt: nowISO()
      };
      const ok = await commit(d => ({
        ...d,
        advances: existing ? (d.advances || []) : [adv, ...(d.advances || [])],
        rewardRequests: (d.rewardRequests || []).map(x => x.id === r.id ? { ...x, status: 'approved', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO(), decisionNote: note, advanceId: adv.id } : x),
        // م10 (v27.0): إشعار بالعلم يوقّعه الموظف من كشك الفرع (idempotent على refId)
        hrSignDocs: (d.hrSignDocs || []).some(x => x.refId === r.id) ? (d.hrSignDocs || []) : [rewardSignDoc(r, me), ...(d.hrSignDocs || [])]
      }), { actionType: 'approve', targetType: 'reward_request', targetId: r.id, branchName: r.branchName, title: 'اعتماد ' + kindAr(r.kind) + ' وترحيلها لمسيّر الرواتب', details: r.employeeName + ' · ' + money(r.amount) + ' ر.س · شهر ' + r.month + (note ? ' · ' + note : '') + ' · صدر إشعار للتوقيع الإلكتروني' });
      if (ok) say('اعتُمدت ' + kindAr(r.kind) + ' ورُحِّلت لمسيّر رواتب ' + r.month + ' وصدر إشعار بالعلم للتوقيع ✓');
    } else {
      if (!note) return say('اكتب سبب الرفض في الملاحظة', 'no');
      const ok = await commit(d => ({ ...d, rewardRequests: (d.rewardRequests || []).map(x => x.id === r.id ? { ...x, status: 'rejected', decidedBy: me.id, decidedByName: me.name, decidedAt: nowISO(), decisionNote: note } : x) }),
        { actionType: 'reject', targetType: 'reward_request', targetId: r.id, branchName: r.branchName, title: 'رفض طلب ' + kindAr(r.kind), details: r.employeeName + ' · ' + money(r.amount) + ' · ' + note });
      if (ok) say('رُفض الطلب');
    }
  };

  // v26.1 — التراجع عن اعتماد (إعادة الطلب إلى «قيد الاعتماد» وحذف حركة الراتب) ما دام استحقاق الشهر لم يُرحَّل للدفتر
  const revertApproval = async (r) => {
    if (!canApprove || r.status !== 'approved') return;
    const accrued = (ops.ledgerEntries || []).some(x => x.kind === 'salary_accrual' && x.month === r.month);
    if (accrued) return say('لا يمكن التراجع: استحقاق رواتب شهر ' + r.month + ' مُرحَّل للدفتر — عالجه بقيد يدوي أو طلب معاكس', 'no');
    if (lockedThru(org) && r.month <= lockedThru(org)) return say(LOCK_MSG(r.month + '-01'), 'no');
    if (!window.confirm('التراجع عن اعتماد ' + kindAr(r.kind) + ' «' + r.employeeName + '» (' + money(r.amount) + ')؟ ستُحذف حركة الراتب ويعود الطلب قيد الاعتماد.')) return;
    const ok = await commit(d => ({ ...d, advances: (d.advances || []).filter(a => a.rewardId !== r.id), rewardRequests: (d.rewardRequests || []).map(x => x.id === r.id ? { ...x, status: 'pending', decidedBy: '', decidedByName: '', decidedAt: '', decisionNote: '', advanceId: '', revertedAt: nowISO(), revertedByName: me.name } : x),
      // م10: إشعار التوقيع المعلّق يُحذف، والموقَّع يُعلَّم «مُلغى» (يبقى أثرًا)
      hrSignDocs: (d.hrSignDocs || []).filter(x => !(x.refId === r.id && x.status === 'pending')).map(x => (x.refId === r.id && x.status === 'signed') ? { ...x, status: 'voided', voidedAt: nowISO(), voidedByName: me.name } : x) }),
      { actionType: 'update', targetType: 'reward_request', targetId: r.id, branchName: r.branchName, title: 'التراجع عن اعتماد ' + kindAr(r.kind), details: r.employeeName + ' · ' + money(r.amount) + ' · شهر ' + r.month });
    if (ok) say('تراجعتَ عن الاعتماد — الطلب قيد الاعتماد مجددًا');
  };

  // === 4) شرائح مكافآت تلقائية حسب درجة الأداء (م7) ===
  const [tf, setTf] = useState({ enabled: !!tiersCfg.enabled, tiers: (tiersCfg.tiers || []).map(t => ({ minScore: String(t.minScore), amount: String(t.amount) })) });
  const saveTiers = async () => {
    const tiers = tf.tiers.map(t => ({ minScore: Number(t.minScore), amount: Number(t.amount) })).filter(t => t.minScore > 0 && t.minScore <= 100 && t.amount > 0).sort((a, b) => b.minScore - a.minScore);
    if (tf.enabled && !tiers.length) return say('أضف شريحة واحدة على الأقل (درجة من 1 إلى 100 ومبلغ أكبر من صفر)', 'no');
    const rec = { enabled: !!tf.enabled, tiers };
    const ok = await commitOrg(d => ({ ...d, rewardTiers: rec }),
      { actionType: 'update', targetType: 'settings', targetId: 'rewardTiers', title: 'ضبط شرائح المكافآت التلقائية', details: (rec.enabled ? 'مفعَّلة' : 'مُعطَّلة') + ' — ' + tiers.map(t => '≥' + t.minScore + ' ⇒ ' + t.amount).join(' · ') });
    if (ok) { say('حُفظت الشرائح ✓'); setTf({ enabled: rec.enabled, tiers: tiers.map(t => ({ minScore: String(t.minScore), amount: String(t.amount) })) }); }
  };
  const tierFor = (score) => { if (score == null) return null; return (tiersCfg.tiers || []).slice().sort((a, b) => b.minScore - a.minScore).find(t => score >= t.minScore) || null; };
  const genTier = async () => {
    if (!tiersCfg.enabled) return say('الشرائح مُعطَّلة — فعّلها واحفظها أولًا', 'no');
    if (lockedThru(org) && ym <= lockedThru(org)) return say(LOCK_MSG(ym + '-01'), 'no');
    const all = (org.employees || []).filter(e => e.isActive !== false && branchIds.includes(e.branchId));
    const recs = [];
    all.forEach(e => {
      if ((ops.rewardRequests || []).some(r => r.source === 'tier' && r.employeeId === e.id && r.month === ym)) return;
      const sc = hrScoreFor(org, ops, e, ym);
      const t = tierFor(sc.score);
      if (!t) return;
      const b = (org.branches || []).find(x => x.id === e.branchId) || {};
      recs.push({ id: uid('rw'), branchId: e.branchId, branchName: b.name || '', employeeId: e.id, employeeName: e.name, kind: 'reward', amount: t.amount, reason: 'درجة أداء ' + sc.score + '/100 ≥ ' + t.minScore + ' لشهر ' + ym, month: ym, source: 'tier', scoreSnapshot: sc.score, axesSnapshot: sc.axes, status: 'pending', requestedBy: me.id, requestedByName: me.name + ' (تلقائي)', requestedAt: nowISO() });
    });
    if (!recs.length) return say('لا مقترحات جديدة لهذا الشهر (لا درجات تبلغ الشرائح، أو المقترحات موجودة مسبقًا)', 'no');
    const ok = await commit(d => ({ ...d, rewardRequests: [...recs, ...(d.rewardRequests || [])] }),
      { actionType: 'create', targetType: 'reward_request', targetId: 'tier-' + ym, title: 'توليد مقترحات مكافآت الشرائح', details: 'شهر ' + ym + ' · ' + recs.length + ' مقترحًا' });
    if (ok) say('وُلِّد ' + recs.length + ' مقترح مكافأة لشهر ' + ym + ' — بانتظار الاعتماد ✓');
  };

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }

  const ReqTable = ({ rows, actions }) => (
    <div className="tw">
      <table className="tb">
        <thead><tr><th>الموظف</th>{branches.length > 1 && <th>الفرع</th>}<th>النوع</th><th>المبلغ</th><th>الشهر</th><th>السبب</th><th>الطالب</th><th>الحالة</th>{actions && <th />}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.employeeName}</td>
              {branches.length > 1 && <td style={{ fontSize: 12 }}>{r.branchName}</td>}
              <td><span className={'badge ' + (r.kind === 'reward' ? 'b-mint' : 'b-rose')}>{kindAr(r.kind)}{r.source === 'tier' ? ' · شريحة' : ''}</span></td>
              <td className="num">{money(r.amount)}</td>
              <td className="num">{r.month}</td>
              <td style={{ fontSize: 12 }}>{r.reason}{r.decisionNote ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>قرار: {r.decisionNote} — {r.decidedByName}</div> : null}</td>
              <td style={{ fontSize: 11.5 }}>{r.requestedByName}</td>
              <td>{statusBadge(r.status)}{r.status === 'approved' && (() => { const sd = (ops.hrSignDocs || []).find(x => x.refId === r.id); return sd ? <div style={{ marginTop: 3 }}><span className={'badge ' + (sd.status === 'signed' ? 'b-mint' : sd.status === 'voided' ? 'b-dim' : 'b-amber')} style={{ fontSize: 9.5 }}><PenLine size={10} />{sd.status === 'signed' ? 'وقّع بالعلم' : sd.status === 'voided' ? 'إشعار مُلغى' : 'بانتظار توقيع الموظف'}</span></div> : null; })()}</td>
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={9}><div className="empty">لا توجد طلبات.</div></td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={'btn sm' + (view === 'requests' ? ' pri' : ' gh')} onClick={() => setView('requests')}><Coins size={13} />الطلبات</button>
            {canApprove && <button className={'btn sm' + (view === 'queue' ? ' pri' : ' gh')} onClick={() => setView('queue')}><ShieldCheck size={13} />قائمة الاعتماد{pending.length ? <span className="badge b-amber" style={{ marginInlineStart: 6 }}>{pending.length}</span> : null}</button>}
            {canTiers && <button className={'btn sm' + (view === 'tiers' ? ' pri' : ' gh')} onClick={() => setView('tiers')}><TrendingUp size={13} />شرائح المكافآت</button>}
          </div>
          {branches.length > 1 && (
            <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {view === 'requests' && branch && (
        <div className="grid" style={{ gap: 12 }}>
          {canRequest && (
            <div className="card">
              <div className="card-t" style={{ marginBottom: 8 }}><Coins size={15} color="var(--brass)" />طلب مكافأة أو جزاء — {branch.name}</div>
              <div className="note" style={{ marginBottom: 8 }}>الطلب لا يُنتج أي أثر مالي حتى يعتمده المكتب الرئيسي؛ بعد الاعتماد يُرحَّل تلقائيًا إلى مسيّر رواتب الشهر المحدَّد (المكافأة تُضاف للإجمالي، والجزاء يُخصم).</div>
              <div className="grid g3">
                <Field label="الموظف"><select className="inp sel" value={f.empId} onChange={e => setF(x => ({ ...x, empId: e.target.value }))}><option value="">اختر</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
                <Field label="النوع"><select className="inp sel" value={f.kind} onChange={e => setF(x => ({ ...x, kind: e.target.value }))}><option value="reward">مكافأة (تُضاف للراتب)</option><option value="penalty">جزاء (يُخصم من الراتب)</option></select></Field>
                <Field label="المبلغ (ر.س)"><input className="inp n" inputMode="decimal" value={f.amount} onChange={e => setF(x => ({ ...x, amount: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
                <Field label="شهر الراتب المستهدف"><input type="month" className="inp" value={f.month} onChange={e => setF(x => ({ ...x, month: e.target.value }))} /></Field>
                <Field label="السبب (إلزامي)" style={{ gridColumn: 'span 2' }}><input className="inp" value={f.reason} onChange={e => setF(x => ({ ...x, reason: e.target.value }))} placeholder="مثال: تغطية وردية إضافية في موسم الذروة" /></Field>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn pri" onClick={submit}><Send size={14} />إرسال الطلب للاعتماد</button></div>
            </div>
          )}
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>طلبات {branch.name}</div>
            <ReqTable rows={allReqs.filter(r => r.branchId === branch.id)} actions={canRequest ? (r) => (r.status === 'pending' && (r.requestedBy === me.id || isAll) ? <button className="btn sm gh" onClick={() => cancelReq(r)}><Trash2 size={13} />إلغاء</button> : null) : null} />
          </div>
        </div>
      )}

      {view === 'queue' && canApprove && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}><ShieldCheck size={15} color="var(--brass)" />قائمة الاعتماد — {pending.length} طلب قيد الانتظار (كل فروعي)</div>
            <div className="note" style={{ marginBottom: 8 }}>الاعتماد يُرحِّل الطلب فورًا إلى مسيّر رواتب الشهر المحدَّد كحركة «مكافأة معتمدة» أو «جزاء معتمد» — لا يمكن اعتماد طلب لشهر مقفل محاسبيًا.</div>
            <ReqTable rows={pending} actions={(r) => (
              <div className="grid" style={{ gap: 5, minWidth: 180 }}>
                <input className="inp" placeholder="ملاحظة القرار (إلزامية للرفض)" value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                  <button className="btn sm pri" onClick={() => decide(r, true)}><Check size={13} />اعتماد وترحيل</button>
                  <button className="btn sm gh" onClick={() => decide(r, false)}><X size={13} />رفض</button>
                </div>
              </div>
            )} />
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 8 }}>سجل القرارات</div>
            <ReqTable rows={decided} actions={(r) => (r.status === 'approved' ? <button className="btn sm gh" title="التراجع عن الاعتماد" onClick={() => revertApproval(r)}><X size={13} />تراجع</button> : null)} />
          </div>
        </div>
      )}

      {view === 'tiers' && canTiers && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 6 }}><TrendingUp size={15} color="var(--brass)" />شرائح المكافآت التلقائية حسب درجة الأداء {tiersCfg.enabled ? <span className="badge b-mint">مفعَّلة</span> : <span className="badge b-dim">مُعطَّلة</span>}</div>
          <div className="note" style={{ marginBottom: 10 }}>تُولِّد شهريًا — بضغطة زر — طلبات مكافأة مقترحة لكل موظف بلغت درجته (م7) إحدى الشرائح، مع تثبيت لقطة الدرجة وقت الاقتراح. المقترحات تمرّ بقائمة الاعتماد نفسها ولا تُرحَّل إلا بعد اعتمادها. مُعطَّلة افتراضيًا حتى تراجعوها.</div>
          <label className="row" style={{ gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!tf.enabled} onChange={e => setTf(x => ({ ...x, enabled: e.target.checked }))} /><b>تفعيل الشرائح</b>
          </label>
          <div className="grid" style={{ gap: 6 }}>
            {tf.tiers.map((t, i) => (
              <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="الدرجة من (≥)"><input className="inp n" inputMode="numeric" value={t.minScore} onChange={e => setTf(x => ({ ...x, tiers: x.tiers.map((y, j) => j === i ? { ...y, minScore: e.target.value.replace(/\D/g, '') } : y) }))} /></Field>
                <Field label="مبلغ المكافأة (ر.س)"><input className="inp n" inputMode="decimal" value={t.amount} onChange={e => setTf(x => ({ ...x, tiers: x.tiers.map((y, j) => j === i ? { ...y, amount: e.target.value.replace(/[^\d.]/g, '') } : y) }))} /></Field>
                <button className="btn sm gh" onClick={() => setTf(x => ({ ...x, tiers: x.tiers.filter((_, j) => j !== i) }))}><Trash2 size={13} /></button>
              </div>
            ))}
            <div><button className="btn sm gh" onClick={() => setTf(x => ({ ...x, tiers: [...x.tiers, { minScore: '', amount: '' }] }))}><Plus size={13} />شريحة</button></div>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="month" className="inp" value={ym} onChange={e => setYm(e.target.value)} />
              <button className="btn gh" disabled={!tiersCfg.enabled} onClick={genTier}><Sparkles size={14} />توليد مقترحات {ymLabel(ym)}</button>
            </div>
            <button className="btn pri" onClick={saveTiers}><Check size={14} />حفظ الشرائح</button>
          </div>
        </div>
      )}
    </div>
  );
}
