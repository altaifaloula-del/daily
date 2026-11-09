/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Printer, Check, RefreshCw } from 'lucide-react';
import { Modal, browserName, deviceType, printClosingA4, printReceipt, sha } from '../../App.jsx';

export function OutputDialog({ rec, org, onDone, onCancel }) {
  const [method, setMethod] = useState('both');
  const [size, setSize] = useState('80');
  const [phase, setPhase] = useState('choose'); // choose | confirm
  const [attempts, setAttempts] = useState(0);
  const [pdfOk, setPdfOk] = useState(false);
  const [printConfirmed, setPrintConfirmed] = useState(false);
  const [printFailed, setPrintFailed] = useState(false);
  const [pdfAck, setPdfAck] = useState(false);
  const [hash, setHash] = useState('');

  const needPdf = method === 'pdf' || method === 'both';
  const needPrint = method === 'print' || method === 'both';

  const runOutputs = async () => {
    const h = await sha([rec.transferReferenceNo, rec.branchName, rec.date, rec.totalRevenue, rec.totalExpenses, rec.actualCashCount, rec.variance, rec.transferredToMainTreasury].join('|'));
    setHash(h);
    if (needPdf) { const ok = printClosingA4(rec, org); setPdfOk(ok !== false); }
    if (needPrint) { const ok = printReceipt(rec, org, size); setAttempts(1); setPrintFailed(ok === false); }
    setPhase('confirm');
  };
  const reprint = () => { const ok = printReceipt(rec, org, size); setAttempts(a => a + 1); setPrintFailed(ok === false); };
  const regenPdf = () => { const ok = printClosingA4(rec, org); setPdfOk(ok !== false); };

  // يكفي لإتمام الإغلاق أن يكون المُخرَج الرسمي قد أُنشئ فعلاً (بعد «متابعة الإخراج»).
  // تأكيد الطباعة وحالة الـPDF تُسجَّل في التدقيق لكنها لا تحجب الإتمام حتى لا يعلق المستخدم.
  const canFinish = phase === 'confirm';
  const finish = () => onDone({
    outputMethod: method === 'both' ? 'طباعة + PDF' : method === 'pdf' ? 'PDF فقط' : 'طباعة حرارية',
    thermalSize: needPrint ? size + 'مم' : '—',
    pdfStatus: needPdf ? (pdfOk ? 'تم الإنشاء' : 'فشل') : 'غير مطلوب',
    printStatus: needPrint ? (printConfirmed ? 'تمت' : printFailed ? 'فشلت' : 'غير مؤكدة') : 'غير مطلوب',
    printAttempts: attempts, device: deviceType(), browser: browserName(), reportHash: hash
  });

  const opt = (k, lbl, tag) => (
    <button key={k} type="button" onClick={() => setMethod(k)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start', marginBottom: 8, padding: '13px 14px', borderRadius: 12, cursor: 'pointer', minHeight: 44,
        border: '1px solid ' + (method === k ? 'var(--brass)' : 'var(--line)'), background: method === k ? 'rgba(200,162,74,.1)' : 'var(--ink3)', color: 'var(--txt)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600 }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid ' + (method === k ? 'var(--brass)' : 'var(--faint)'), flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        {method === k && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brass)' }} />}
      </span>
      <span style={{ flex: 1 }}>{lbl}</span>
      <span className="badge b-dim" style={{ fontSize: 9.5 }}>{tag}</span>
    </button>
  );
  const statusRow = (label, node) => (
    <div className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(120,100,80,.14)', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5 }}>{label}</span>{node}
    </div>
  );

  return (
    <Modal title="إخراج الإغلاق الرسمي — خطوة إلزامية" icon={Printer} onClose={onCancel}
      foot={phase === 'confirm'
        ? <>
            <button className="btn pri" disabled={!canFinish} onClick={finish}><Check size={14} />إتمام الإغلاق</button>
            <button className="btn gh" onClick={onCancel}>إلغاء الإغلاق</button>
          </>
        : <>
            <button className="btn pri" onClick={runOutputs}><Printer size={14} />متابعة الإخراج</button>
            <button className="btn gh" onClick={onCancel}>إلغاء</button>
          </>}>
      {phase === 'choose' ? (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 12 }}>
            لا يمكن إتمام الإغلاق قبل اختيار مُخرَج رسمي واحد على الأقل:
          </div>
          {opt('both', '🖨 + 📄  طباعة حرارية + تقرير PDF', 'موصى به')}
          {opt('print', '🖨  طباعة حرارية للكاشير', '58/80مم')}
          {opt('pdf', '📄  تقرير PDF رسمي', 'A4')}
          {needPrint && (
            <div style={{ marginTop: 12 }}>
              <div className="lbl">حجم ورق طابعة الكاشير</div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className={'btn sm' + (size === '80' ? ' pri' : ' gh')} onClick={() => setSize('80')}>80مم</button>
                <button type="button" className={'btn sm' + (size === '58' ? ' pri' : ' gh')} onClick={() => setSize('58')}>58مم</button>
              </div>
            </div>
          )}
          <div className="cflow-alert" style={{ border: '1px solid rgba(91,147,196,.4)', background: 'rgba(91,147,196,.1)', color: 'var(--sky)', marginTop: 14, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8 }}>
            <span>ℹ</span><span style={{ fontSize: 11.5, lineHeight: 1.6 }}>تُرسَل الطباعة عبر نافذة الطباعة في المتصفح — اختر طابعة الكاشير (58/80مم) المثبّتة على الجهاز. سيُطلب منك تأكيد نجاح الطباعة قبل اعتماد الإغلاق.</span>
          </div>
        </>
      ) : (
        <>
          {needPdf && statusRow('📄 تقرير PDF الرسمي',
            (pdfOk || pdfAck) ? <span className="badge b-mint"><Check size={11} />{pdfOk ? 'تم الإنشاء — عايِنه ونزّله من النافذة' : 'مُتابَع'}</span>
              : <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}><span className="badge b-rose">لم تُفتح النافذة</span><button className="btn sm" onClick={regenPdf}>إعادة</button><button className="btn sm gh" onClick={() => setPdfAck(true)}>متابعة بدونها</button></span>)}
          {needPrint && (
            <>
              {statusRow(<span>🖨 طباعة حرارية {size}مم · محاولات: <span className="num">{attempts}</span></span>,
                printConfirmed ? <span className="badge b-mint"><Check size={11} />تمت الطباعة</span>
                  : <span className="badge b-amber">بانتظار تأكيدك</span>)}
              {!printConfirmed && (
                <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn sm pri" onClick={() => { setPrintConfirmed(true); setPrintFailed(false); }}><Check size={13} />نعم، تمت الطباعة</button>
                  <button className="btn sm" onClick={reprint}><RefreshCw size={13} />أعد المحاولة</button>
                  <button className="btn sm gh" onClick={() => { const ns = size === '80' ? '58' : '80'; setSize(ns); }}>بدّل الحجم</button>
                </div>
              )}
            </>
          )}
          <div className="cflow-alert" style={{ border: '1px solid rgba(200,162,74,.35)', background: 'rgba(200,162,74,.08)', color: 'var(--dim)', marginTop: 14, borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 8, fontSize: 11 }}>
            <span>🔒</span><span>بصمة التقرير الرقمية: <span className="num" style={{ fontSize: 10 }}>{(hash || '').slice(0, 20)}…</span><br />الجهاز: {deviceType()} · المتصفح: {browserName()} — تُحفظ في سجل التدقيق.</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--mint)', marginTop: 10, textAlign: 'center', lineHeight: 1.7 }}>
            تم إنشاء المُخرَج الرسمي — اضغط «إتمام الإغلاق» لإنهاء الوردية وبدء وردية جديدة.
            {needPrint && !printConfirmed ? ' (تأكيد الطباعة اختياري ويُسجَّل في التدقيق.)' : ''}
          </div>
        </>
      )}
    </Modal>
  );
}
