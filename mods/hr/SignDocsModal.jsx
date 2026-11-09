/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Signature, Check, PenLine, Eye, CheckCircle2 } from 'lucide-react';
import { Field, HrSignPad, Modal, ROLES, SIGN_DOC_AR, money, nowISO, sha, sigPoints, signDeclaration } from '../../App.jsx';

export function SignDocsModal({ org, ops, me, emp, docs, onClose, commit, say, via }) {
  const isAll = (ROLES[me.role] || {}).scope === 'all';
  const pinRec = (ops.hrPins || []).find(p => p.employeeId === emp.id) || {};
  const hasPin = !!pinRec.pinHash;
  const [list] = useState(() => (docs || []).filter(d => d.status === 'pending'));   // تُجمَّد عند الفتح كي لا يقفز الترتيب بعد كل حفظ
  const [step, setStep] = useState('pin');
  const [pin, setPin] = useState('');
  const [witness, setWitness] = useState(false);
  const [idx, setIdx] = useState(0);
  const [sig, setSig] = useState(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doneN, setDoneN] = useState(0);
  const doc = list[idx] || null;
  const verify = async () => {
    if (busy) return;
    if (!hasPin) return say('لا يوجد رقم PIN لهذا الموظف', 'no');
    if (!/^\d{4,6}$/.test(pin)) return say('أدخل رقم PIN المكوّن من 4 إلى 6 أرقام', 'no');
    setBusy(true); const h = await sha(pin); setBusy(false);
    if (h !== pinRec.pinHash) { setPin(''); return say('رقم PIN غير صحيح', 'no'); }
    setPin(''); setStep('sign');
  };
  const witnessGo = () => {
    if (!isAll) return;
    if (!window.confirm('التوقيع بحضورك دون تحقّق PIN؟ سيُسجَّل اسمك شاهدًا على المستند.')) return;
    setWitness(true); setStep('sign');
  };
  const save = async () => {
    if (!doc || busy) return;
    if (sigPoints(sig) < 6) return say('ارسم توقيعك داخل الإطار أولًا', 'no');
    if (!agree) return say('أكّد قراءة نص الإقرار والموافقة عليه', 'no');
    setBusy(true);
    const signedAt = nowISO();
    const sigHash = await sha(JSON.stringify(sig) + '|' + doc.id + '|' + emp.id + '|' + signedAt);
    const patch = { status: 'signed', signedAt, signedVia: via || (isAll ? 'central' : 'branch_kiosk'), signedOnBy: me.id, signedOnByName: me.name, pinVerified: !witness, witnessName: witness ? me.name : '', sig, sigHash };
    const ok = await commit(d => ({ ...d, hrSignDocs: (d.hrSignDocs || []).map(x => (x.id === doc.id && x.status === 'pending') ? { ...x, ...patch } : x) }),
      { actionType: 'update', targetType: 'hr_sign_doc', targetId: doc.id, branchName: doc.branchName, title: 'توقيع إلكتروني — ' + (SIGN_DOC_AR[doc.docType] || doc.docType), details: emp.name + ' · ' + doc.title + ' · ' + money(doc.amount) + ' ر.س · ' + (witness ? 'بحضور ' + me.name : 'تحقّق PIN') });
    setBusy(false);
    if (!ok) return;
    say('حُفظ توقيع ' + emp.name + ' ✓');
    setDoneN(n => n + 1); setSig(null); setAgree(false);
    if (idx + 1 < list.length) setIdx(idx + 1); else setStep('done');
  };
  const L = (doc && doc.lines) || {};
  const title = step === 'done' ? 'اكتمل التوقيع — ' + emp.name : (doc ? (SIGN_DOC_AR[doc.docType] || 'توقيع') + ' — ' + emp.name : 'توقيع — ' + emp.name);
  return (
    <Modal title={title} icon={Signature} onClose={onClose} wide
      foot={<>
        <button className="btn gh" onClick={onClose}>{step === 'done' ? 'إغلاق' : 'إلغاء'}</button>
        {step === 'pin' && <button className="btn pri" disabled={busy || !hasPin} onClick={verify}><Check size={14} />{busy ? 'جارٍ...' : 'تأكيد PIN'}</button>}
        {step === 'sign' && <button className="btn pri" disabled={busy} onClick={save}><PenLine size={14} />{busy ? 'جارٍ الحفظ...' : 'اعتماد التوقيع'}</button>}
      </>}>
      {step === 'pin' && (
        <div className="grid" style={{ gap: 10 }}>
          <div className="note">لديك <b>{list.length}</b> {list.length === 1 ? 'مستند' : 'مستندات'} بانتظار توقيعك: {list.map(d => SIGN_DOC_AR[d.docType] + ' (' + d.month + ')').join('، ')}. تُعرض التفاصيل والمبالغ بعد التحقق من هويتك.</div>
          {hasPin ? (
            <Field label="رقم PIN الخاص بك">
              <input className="inp" type="password" inputMode="numeric" maxLength={6} autoFocus value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter') verify(); }} placeholder="••••" />
            </Field>
          ) : (
            <div className="note" style={{ color: 'var(--rose)' }}>لا يوجد رقم PIN لهذا الموظف — يضبطه مدير الفرع من «الحضور الموثَّق ← أرقام PIN».</div>
          )}
          {isAll && (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn sm gh" onClick={witnessGo}><Eye size={13} />التوقيع بحضوري ({me.name}) دون PIN</button>
            </div>
          )}
        </div>
      )}
      {step === 'sign' && doc && (
        <div className="grid" style={{ gap: 10 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <span className={'badge ' + ((doc.docType === 'penalty' || doc.docType === 'corrective') ? 'b-rose' : doc.docType === 'reward' ? 'b-mint' : 'b-brass')}>{SIGN_DOC_AR[doc.docType]} · شهر {doc.month}</span>
            <span className="badge b-dim">المستند {idx + 1} من {list.length}</span>
          </div>
          <div className="card" style={{ padding: 12, border: '1px solid var(--frame-o)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{doc.docType === 'payslip' ? 'صافي المستلم' : doc.docType === 'corrective' ? 'الغرامة' : 'المبلغ'}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 800, color: (doc.docType === 'penalty' || doc.docType === 'corrective') ? 'var(--rose)' : 'var(--mint)' }}>{doc.docType === 'corrective' && !doc.amount ? <span style={{ fontSize: 15, fontWeight: 700 }}>بلا غرامة مالية</span> : <>{money(doc.amount)} <span style={{ fontSize: 12, fontWeight: 400 }}>ر.س</span></>}</div>
            {doc.docType === 'payslip' && (
              <div className="grid g2" style={{ gap: 4, marginTop: 8, fontSize: 12 }}>
                <div>الأساسي: <b className="num">{money(L.base)}</b></div><div>البدلات: <b className="num">{money(L.allow)}</b></div>
                {L.ot > 0 && <div>عمل إضافي: <b className="num">{money(L.ot)}</b></div>}
                {L.bonus > 0 && <div>مكافآت: <b className="num">{money(L.bonus)}</b></div>}
                <div>الإجمالي: <b className="num">{money(L.gross)}</b></div>
                <div>سلف/سحوبات: <b className="num" style={{ color: 'var(--amber)' }}>{money(L.draws)}</b></div>
                <div>خصومات/جزاءات: <b className="num" style={{ color: 'var(--rose)' }}>{money(L.cuts)}</b></div>
                {L.gEmp > 0 && <div>تأمينات: <b className="num" style={{ color: 'var(--sky)' }}>{money(L.gEmp)}</b></div>}
              </div>
            )}
            {doc.docType !== 'payslip' && <div style={{ fontSize: 12.5, marginTop: 6 }}>السبب: <b>{doc.reason || '—'}</b></div>}
          </div>
          <div className="card" style={{ padding: 10, background: 'rgba(200,162,74,.06)', fontSize: 12.5, lineHeight: 1.8 }}>{signDeclaration(doc)}</div>
          <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />قرأتُ نص الإقرار وأوافق عليه
          </label>
          <HrSignPad key={doc.id} onChange={setSig} />
          {witness && <div className="note" style={{ color: 'var(--amber)' }}>سيُسجَّل هذا التوقيع بحضور {me.name} دون تحقّق PIN.</div>}
        </div>
      )}
      {step === 'done' && (
        <div className="empty" style={{ padding: 20 }}>
          <CheckCircle2 size={34} color="var(--mint)" />
          <div style={{ marginTop: 8, fontWeight: 700 }}>اكتمل توقيع {doneN} {doneN === 1 ? 'مستند' : 'مستندات'} ✓</div>
          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 4 }}>شكرًا {emp.name} — يظهر توقيعك على القسيمة والمسير المطبوعين.</div>
        </div>
      )}
    </Modal>
  );
}
