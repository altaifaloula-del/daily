/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Check, Signature, FileText, Printer, Trash2 } from 'lucide-react';
import { Modal, ROLES, SIGN_DOC_AR, SigView, SignDocsModal, arDT, escH, money, printA4, sigSvg, signDeclaration, signDocHtml, today } from '../../App.jsx';

export function ESign({ org, ops, me, myBranches, commit, say }) {
  const role = ROLES[me.role] || {};
  const isAll = role.scope === 'all';
  const isCashier = me.role === 'cashier';
  const canCancel = isAll;          // إلغاء مستند معلّق: أدوار المركز (الجهة المُصدِرة)
  const showAmounts = isAll;        // مبالغ الرواتب لا تُعرض لأدوار الفروع في السجل — يراها الموظف نفسه بعد PIN فقط
  const branches = myBranches || [];
  const [view, setView] = useState('kiosk');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => { if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || ''); }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;
  const branchIds = branches.map(b => b.id);
  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);
  const docsAll = (ops.hrSignDocs || []).filter(d => branchIds.includes(d.branchId));
  const pendingOf = (empId) => docsAll.filter(d => d.employeeId === empId && d.status === 'pending' && branch && d.branchId === branch.id).sort((a, b) => (a.issuedAt < b.issuedAt ? -1 : 1));
  const [signFor, setSignFor] = useState(null);
  const ymLabel = (y) => { const [Y, M] = String(y).split('-').map(Number); return isNaN(Y) ? y : new Date(Y, M - 1, 1).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }); };
  const statusBadge = (d) => d.status === 'signed' ? <span className="badge b-mint"><Check size={11} />موقَّع</span> : d.status === 'voided' ? <span className="badge b-dim">مُلغى</span> : <span className="badge b-amber">بانتظار التوقيع</span>;
  const viaAr = (d) => d.status !== 'signed' ? '—' : (d.pinVerified ? 'PIN' : 'بحضور ' + (d.witnessName || '')) + (d.signedVia === 'central' ? ' · المكتب' : ' · جهاز الفرع');

  // === سجل الإقرارات ===
  const [ym, setYm] = useState(() => today().slice(0, 7));
  const [logBranch, setLogBranch] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [logType, setLogType] = useState('');
  const logRows = docsAll
    .filter(d => !ym || d.month === ym)
    .filter(d => !logBranch || d.branchId === logBranch)
    .filter(d => !logStatus || d.status === logStatus)
    .filter(d => !logType || d.docType === logType)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  const monthDocs = docsAll.filter(d => d.month === ym && (!logBranch || d.branchId === logBranch));
  const nSigned = monthDocs.filter(d => d.status === 'signed').length, nPending = monthDocs.filter(d => d.status === 'pending').length;
  const [viewDoc, setViewDoc] = useState(null);
  const cancelDoc = async (d) => {
    if (!canCancel || d.status !== 'pending') return;
    if (!window.confirm('إلغاء «' + d.title + '» لـ' + d.employeeName + '؟ يمكن إعادة إصداره من شاشة الرواتب.')) return;
    const ok = await commit(x => ({ ...x, hrSignDocs: (x.hrSignDocs || []).filter(y => y.id !== d.id) }),
      { actionType: 'delete', targetType: 'hr_sign_doc', targetId: d.id, branchName: d.branchName, title: 'إلغاء مستند توقيع معلّق', details: d.employeeName + ' · ' + d.title });
    if (ok) say('أُلغي المستند');
  };
  const printDoc = (d) => {
    printA4(org, (SIGN_DOC_AR[d.docType] || 'إقرار') + ' — ' + d.employeeName, 'شهر ' + d.month + ' · ' + (d.branchName || ''), signDocHtml(d, showAmounts)) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  const printReport = () => {
    const rws = logRows.map(d => `<tr><td>${escH(d.employeeName)}</td><td>${escH(d.branchName)}</td><td>${SIGN_DOC_AR[d.docType] || ''}</td><td class="n">${escH(d.month)}</td>${showAmounts ? `<td class="n">${money(d.amount)}</td>` : ''}<td>${d.status === 'signed' ? 'موقَّع' : d.status === 'voided' ? 'مُلغى' : 'بانتظار التوقيع'}</td><td class="n">${d.signedAt ? escH(arDT(d.signedAt)) : '—'}</td><td>${escH(viaAr(d))}</td><td style="width:110px">${d.status === 'signed' ? sigSvg(d.sig, { width: 100 }) : ''}</td></tr>`).join('');
    printA4(org, 'تقرير حالة التوقيعات — ' + ymLabel(ym), (logBranch ? (branches.find(b => b.id === logBranch) || {}).name + ' · ' : '') + 'موقَّع ' + nSigned + ' · بانتظار ' + nPending,
      `<table><thead><tr><th>الموظف</th><th>الفرع</th><th>المستند</th><th>الشهر</th>${showAmounts ? '<th>المبلغ</th>' : ''}<th>الحالة</th><th>وقت التوقيع</th><th>الطريقة</th><th>التوقيع</th></tr></thead><tbody>${rws || '<tr><td colspan="9" style="text-align:center;color:#888">لا مستندات ضمن هذه الفلاتر</td></tr>'}</tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }
  return (
    <div className="grid" style={{ gap: 12 }}>
      {!isCashier && (
        <div className="card" style={{ padding: '8px 12px' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (view === 'kiosk' ? ' pri' : ' gh')} onClick={() => setView('kiosk')}><Signature size={13} />كشك التوقيع</button>
              <button className={'btn sm' + (view === 'log' ? ' pri' : ' gh')} onClick={() => setView('log')}><FileText size={13} />سجل الإقرارات</button>
            </div>
            {branches.length > 1 && view === 'kiosk' && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {view === 'kiosk' && branch && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 4 }}><Signature size={15} color="var(--brass)" />كشك التوقيع الإلكتروني — {branch.name}</div>
          <div className="note" style={{ marginBottom: 10 }}>اختر اسمك، أدخل رقم PIN، اقرأ الإقرار ثم وقّع بإصبعك. تُعرض المبالغ لك وحدك بعد التحقق من هويتك، ويظهر توقيعك على قسيمة الراتب والمسير المطبوعين.</div>
          <div className="grid g3">
            {emps.map(e => {
              const pend = pendingOf(e.id);
              const n = pend.length;
              return (
                <button key={e.id} className="card" disabled={!n} style={{ padding: 12, textAlign: 'center', cursor: n ? 'pointer' : 'default', border: '1px solid var(--frame-o)', opacity: n ? 1 : 0.6 }}
                  onClick={() => { if (n) setSignFor(e); }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</div>
                  <div style={{ marginTop: 6 }}>
                    {n ? <span className="badge b-amber">{n} {n === 1 ? 'مستند بانتظار توقيعك' : 'مستندات بانتظار توقيعك'}</span> : <span className="badge b-dim">لا مستندات بانتظارك</span>}
                  </div>
                  {n > 0 && <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 4 }}>{pend.map(d => SIGN_DOC_AR[d.docType] + ' ' + d.month).join(' · ')}</div>}
                </button>
              );
            })}
            {emps.length === 0 && <div className="empty">لا يوجد موظفون في هذا الفرع بعد — أضِفهم من «البيانات الرئيسية».</div>}
          </div>
        </div>
      )}

      {view === 'log' && !isCashier && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div className="card-t"><FileText size={15} color="var(--brass)" />سجل الإقرارات والإشعارات</div>
            <div className="row" style={{ gap: 6 }}>
              <span className="badge b-mint">موقَّع {nSigned}</span>
              <span className="badge b-amber">بانتظار {nPending}</span>
              <button className="btn sm gh" onClick={printReport}><Printer size={13} />تقرير حالة التوقيعات</button>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input type="month" className="inp" style={{ width: 150 }} value={ym} onChange={e => setYm(e.target.value)} />
            {branches.length > 1 && (
              <select className="inp sel" style={{ width: 160 }} value={logBranch} onChange={e => setLogBranch(e.target.value)}>
                <option value="">كل الفروع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <select className="inp sel" style={{ width: 150 }} value={logType} onChange={e => setLogType(e.target.value)}>
              <option value="">كل المستندات</option>
              <option value="payslip">إقرارات الراتب</option>
              <option value="reward">إشعارات المكافآت</option>
              <option value="penalty">إشعارات الجزاءات</option>
              <option value="corrective">محاضر الإجراءات التأديبية</option>
            </select>
            <select className="inp sel" style={{ width: 150 }} value={logStatus} onChange={e => setLogStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="pending">بانتظار التوقيع</option>
              <option value="signed">موقَّع</option>
              <option value="voided">مُلغى</option>
            </select>
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th><th>الفرع</th><th>المستند</th><th>الشهر</th>{showAmounts && <th style={{ textAlign: 'end' }}>المبلغ</th>}<th>الحالة</th><th>وقت التوقيع</th><th>الطريقة</th><th>التوقيع</th><th /></tr></thead>
              <tbody>
                {logRows.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{d.employeeName}</td>
                    <td style={{ fontSize: 12 }}>{d.branchName}</td>
                    <td><span className={'badge ' + (d.docType === 'penalty' ? 'b-rose' : d.docType === 'reward' ? 'b-mint' : 'b-brass')}>{SIGN_DOC_AR[d.docType]}</span></td>
                    <td className="num">{d.month}</td>
                    {showAmounts && <td className="num" style={{ textAlign: 'end' }}>{money(d.amount)}</td>}
                    <td>{statusBadge(d)}</td>
                    <td style={{ fontSize: 11.5 }}>{d.signedAt ? arDT(d.signedAt) : '—'}</td>
                    <td style={{ fontSize: 11.5 }}>{viaAr(d)}</td>
                    <td>{d.status === 'signed' ? <button className="btn sm gh" onClick={() => setViewDoc(d)} title="عرض التوقيع"><SigView sig={d.sig} width={70} /></button> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        <button className="btn sm gh" onClick={() => printDoc(d)} title="طباعة الإقرار"><Printer size={13} /></button>
                        {canCancel && d.status === 'pending' && <button className="btn sm gh" onClick={() => cancelDoc(d)} title="إلغاء المستند المعلّق"><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {logRows.length === 0 && <tr><td colSpan={showAmounts ? 10 : 9}><div className="empty">لا مستندات ضمن هذه الفلاتر — تُصدَر قسائم الشهر تلقائيًا عند «تسجيل صرف الرواتب»، وإشعارات المكافآت/الجزاءات عند اعتمادها.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {signFor && (
        <SignDocsModal org={org} ops={ops} me={me} emp={signFor} docs={pendingOf(signFor.id)} onClose={() => setSignFor(null)} commit={commit} say={say} via={isAll ? 'central' : 'branch_kiosk'} />
      )}
      {viewDoc && (
        <Modal title={SIGN_DOC_AR[viewDoc.docType] + ' — ' + viewDoc.employeeName} icon={Signature} onClose={() => setViewDoc(null)} foot={<button className="btn gh" onClick={() => setViewDoc(null)}>إغلاق</button>}>
          <div className="grid" style={{ gap: 8, textAlign: 'center' }}>
            <SigView sig={viewDoc.sig} width={320} style={{ margin: '0 auto', border: '1px solid var(--frame-o)' }} />
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>وُقِّع {viewDoc.signedAt ? arDT(viewDoc.signedAt) : ''} · {viaAr(viewDoc)}{viewDoc.sigHash ? ' · #' + String(viewDoc.sigHash).slice(0, 10) : ''}</div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>{signDeclaration(viewDoc)}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
