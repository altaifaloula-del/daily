/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { Receipt, FileText, Printer, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { Badge, DENOMS, Modal, PdfTile, arDate, isPdfData, money, openPdfData, payCashPart, payLabel, payTotal, printClosingA4, printReceipt, sum } from '../../App.jsx';

export function ClosingView({ c, org, onClose }) {
  const Row = ({ k, v, color }) => (
    <div className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
      <span style={{ color: 'var(--dim)' }}>{k}</span><span className="num" style={{ color }}>{v}</span>
    </div>
  );
  // v16.2: صور توثيق المسؤول كانت محفوظة مع الإغلاق (وتظهر في تقرير PDF والأرشيف)
  // لكن نافذة الاستعراض لم تكن تعرضها إطلاقاً — قسم العرض أدناه جديد.
  const sessPhotos = (c.sessionPhotos && c.sessionPhotos.length) ? c.sessionPhotos : (c.sessionPhoto ? [c.sessionPhoto] : []);
  // v16.4: التكبير كان يفتح نافذة متصفح خارجية (window.open + document.write) وبعض
  // المتصفحات تحجبها فتظهر صفحة فارغة بصورة مكسورة — استُبدل بعارض داخل المنصة نفسها.
  const [zoom, setZoom] = useState(null);
  const [zoomErr, setZoomErr] = useState(false);
  // v16.5: ملف PDF يُفتح بعارض المتصفح مباشرة (وسم <img> لا يعرض PDF فيظهر مكسوراً)
  const zoomImg = (img) => { if (isPdfData(img)) { openPdfData(img); return; } setZoomErr(false); setZoom(img); };
  useEffect(() => {
    if (!zoom) return;
    // Escape يغلق العارض فقط دون إغلاق نافذة الاستعراض خلفه (التقاط قبل مستمع النافذة)
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setZoom(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoom]);
  return (
    <Modal wide title={`إغلاق ${c.branchName} — ${arDate(c.date)}`} icon={Receipt} onClose={onClose}
      foot={<><button className="btn pri" onClick={() => printClosingA4(c, org)}><FileText size={14} />تقرير PDF رسمي</button>
        <button className="btn" onClick={() => printReceipt(c, org)}><Printer size={14} />طباعة حرارية 80مم</button>
        <button className="btn gh" onClick={onClose}>إغلاق</button></>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <Badge s={c.status} />
        {c.gmApprovalStatus === 'approved' && <span className="badge b-brass"><ShieldCheck size={11} />معتمد من الإدارة العليا</span>}
        {c.imagesPruned && <span className="badge b-dim" title="سياسة الاحتفاظ 60 يومًا">🗄 صور هذا الإغلاق في أرشيف المستندات</span>}
        <span className="badge b-dim">المسؤول: {c.managerName}</span>
        {c.auditedBy && <span className="badge b-sky">دقّقه: {c.auditedBy}</span>}
      </div>
      <div className="grid g2">
        <div className="card" style={{ background: 'var(--ink)' }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>الإيرادات</div>
          <Row k="مبيعات نقدية" v={money(c.cashSales)} />
          <Row k="مبيعات الشبكة" v={money(c.cardSales)} />
          <Row k="تحويل بنكي" v={money(c.bankTransferSales || 0)} />
          {(c.deliverySales || []).filter(d => d.amount > 0).map(d => (
            <Row key={d.appId} k={`${d.appName} (${d.orderCount} طلب)`} v={money(d.amount)} />
          ))}
          <Row k="الإجمالي" v={money(c.totalRevenue)} color="var(--brass)" />
          {c.cardReceiptImage && (
            <div style={{ marginTop: 8 }}>
              <div className="lbl">إثبات الشبكة / التحويل</div>
              {isPdfData(c.cardReceiptImage)
                ? <PdfTile v={c.cardReceiptImage} label="إثبات الشبكة / التحويل" />
                : <img src={c.cardReceiptImage} alt="إثبات"
                  onClick={() => zoomImg(c.cardReceiptImage)}
                  style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 8, background: '#000', cursor: 'zoom-in' }} />}
            </div>
          )}
        </div>
        <div className="card" style={{ background: 'var(--ink)' }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>المصروفات</div>
          {(c.expenses || []).map(e => (
            <div key={e.id} style={{ paddingBottom: 4 }}>
              <Row k={`${e.categoryName}${e.beneficiaryName ? ' — ' + e.beneficiaryName : ''}`} v={money(e.amount)} />
              <div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span className="badge b-dim" style={{ fontSize: 9 }}>{({cash:'نقد',card:'شبكة',cheque:'شيك',bank_transfer:'تحويل',deferred:'آجل'})[e.paymentMethod] || e.paymentMethod}</span>
                {e.isTaxable ? <span className="badge b-brass" style={{ fontSize: 9 }}>خاضع للضريبة{e.taxInvoice ? ' · ضريبية' : ''}</span> : <span className="badge b-dim" style={{ fontSize: 9 }}>غير خاضع</span>}
                {e.receiptNumber && <span className="badge b-dim" style={{ fontSize: 9 }}>#{e.receiptNumber}</span>}
              </div>
              {e.receiptImage && (isPdfData(e.receiptImage)
                ? <div style={{ margin: '4px 0 6px' }}><PdfTile small v={e.receiptImage} label="إيصال PDF" /></div>
                : <img src={e.receiptImage} alt="إيصال"
                  onClick={() => zoomImg(e.receiptImage)}
                  style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 6, margin: '4px 0 6px', cursor: 'zoom-in', border: '1px solid var(--line)' }} />)}
            </div>
          ))}
          {(!c.expenses || c.expenses.length === 0) && <div className="empty" style={{ padding: 18 }}>لا مصروفات</div>}
          <Row k="الإجمالي" v={money(c.totalExpenses)} color="var(--rose)" />
        </div>
      </div>
      {(c.supplierPayments || []).filter(pm => payTotal(pm) > 0).length > 0 && (
        <div className="card" style={{ background: 'var(--ink)', marginTop: 12 }}>
          <div className="card-t" style={{ marginBottom: 8, fontSize: 12.5 }}>سداد الموردين خلال الوردية</div>
          {(c.supplierPayments || []).filter(pm => payTotal(pm) > 0).map(pm => (
            <div key={pm.id} style={{ paddingBottom: 4 }}>
              <Row k={pm.supplierName || 'مورد'} v={money(payTotal(pm))} color="var(--mint)" />
              <div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                <span className="badge b-dim" style={{ fontSize: 9 }}>{payLabel(pm) || '—'}</span>
                {pm.reference && <span className="badge b-dim" style={{ fontSize: 9 }}>#{pm.reference}</span>}
              </div>
            </div>
          ))}
          <Row k="الإجمالي — منه نقدًا من الصندوق" v={`${money(sum((c.supplierPayments || []), payCashPart))} / ${money(sum((c.supplierPayments || []), payTotal))}`} color="var(--mint)" />
        </div>
      )}
      <hr className="hr" />
      <div className="lbl" style={{ marginBottom: 10 }}>جرد الفئات النقدية</div>
      <div className="notes">
        {DENOMS.filter(d => (c.denominationDetails?.[d.k] || 0) > 0).map(d => (
          <div key={d.k} className="note" style={{ '--nc': d.c }}>
            <div className="note-v">{d.k === 'coins' ? 'هللات' : d.v}</div>
            <div className="note-u">عدد <span className="num">{c.denominationDetails[d.k]}</span></div>
            <div className="note-t">{money((c.denominationDetails[d.k] || 0) * d.v)}</div>
          </div>
        ))}
      </div>
      <div className="grid g3" style={{ marginTop: 14 }}>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>المتوقع</span><span className="num">{money(c.expectedCashInSafe)}</span></div>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>الفعلي</span><span className="num">{money(c.actualCashCount)}</span></div>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>الفرق</span>
          <span className="num" style={{ color: c.variance < 0 ? 'var(--rose)' : c.variance > 0 ? 'var(--mint)' : 'var(--faint)' }}>{money(c.variance)}</span></div>
      </div>
      {c.varianceReason && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--dim)' }}>سبب الفرق: {c.varianceReason}</div>}
      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>المرحّل للخزينة</span><span className="num" style={{ color: 'var(--brass)' }}>{money(c.transferredToMainTreasury)}</span></div>
        <div className="mono-b"><span style={{ fontSize: 11.5 }}>عهدة الغد</span><span className="num">{money(c.retainedFloatForTomorrow)}</span></div>
      </div>
      {c.notes && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--dim)' }}>ملاحظات: {c.notes}</div>}
      {sessPhotos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="lbl">صور توثيق المسؤول ({sessPhotos.length}) — اضغط أي صورة لتكبيرها</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {sessPhotos.map((img, i) => (
              <img key={i} src={img} alt={'صورة توثيق ' + (i + 1)} onClick={() => zoomImg(img)}
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line-g)', cursor: 'zoom-in' }} />
            ))}
          </div>
        </div>
      )}
      {c.imagesPruned && sessPhotos.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--dim)' }}>
          🗄 صور هذا الإغلاق نُقلت إلى «أرشيف المستندات» (سياسة الاحتفاظ 60 يومًا) — تجدها هناك باسم الفرع وتاريخ اليوم.
        </div>
      )}
      {c.managerSignature && (
        <div style={{ marginTop: 12 }}>
          <div className="lbl">توقيع المسؤول</div>
          <img src={c.managerSignature} alt="توقيع" style={{ maxWidth: 240, background: '#fff', borderRadius: 8, padding: 4 }} />
        </div>
      )}
      {c.completion && (
        <div className="card" style={{ background: 'var(--ink)', marginTop: 14, borderColor: 'rgba(200,162,74,.3)' }}>
          <div className="card-t" style={{ fontSize: 12.5, marginBottom: 8 }}><ShieldCheck size={14} color="var(--brass)" />سجل إتمام الإغلاق — قيد تدقيق غير قابل للتعديل</div>
          <div className="grid g2" style={{ gap: 8 }}>
            <div className="mono-b"><span style={{ fontSize: 11 }}>رقم الإغلاق</span><span className="num" style={{ fontSize: 11 }}>{c.closingNo || c.transferReferenceNo || '—'}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>وسيلة الإخراج</span><span style={{ fontSize: 11.5 }}>{c.completion.outputMethod}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>حالة PDF</span><span style={{ fontSize: 11.5 }}>{c.completion.pdfStatus}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>الطباعة{c.completion.thermalSize && c.completion.thermalSize !== '—' ? ' (' + c.completion.thermalSize + ')' : ''}</span><span style={{ fontSize: 11.5 }}>{c.completion.printStatus} · محاولات <span className="num">{c.completion.printAttempts}</span></span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>الجهاز / المتصفح</span><span style={{ fontSize: 11 }}>{c.completion.device} · {c.completion.browser}</span></div>
            <div className="mono-b"><span style={{ fontSize: 11 }}>المستخدم</span><span style={{ fontSize: 11 }}>{c.completion.by || c.managerName}</span></div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 8, wordBreak: 'break-all' }}>🔒 بصمة التقرير الرقمية: <span className="num">{c.completion.reportHash || '—'}</span></div>
        </div>
      )}
      {zoom && (
        <div onClick={() => setZoom(null)} role="dialog" aria-label="معاينة الصورة"
          style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(8,6,5,.92)', display: 'grid', placeItems: 'center', padding: 18, cursor: 'zoom-out' }}>
          {zoomErr
            ? <div style={{ background: 'var(--ink2)', border: '1px solid var(--line-g)', borderRadius: 14, padding: '26px 30px', textAlign: 'center', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <AlertTriangle size={26} color="var(--amber)" style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 700, marginBottom: 6 }}>تعذّر عرض هذا المرفق</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.8 }}>
                الملف المحفوظ تالف أو من نوع غير مدعوم للعرض. إن كان الإغلاق قديمًا فقد تجد نسخته في «أرشيف المستندات».
              </div>
              <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setZoom(null)}>إغلاق</button>
            </div>
            : <img src={zoom} alt="معاينة مكبّرة" onError={() => setZoomErr(true)}
              style={{ maxWidth: '96vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 24px 70px rgba(0,0,0,.6)' }} />}
          <button className="btn sm" onClick={() => setZoom(null)}
            style={{ position: 'fixed', top: 16, insetInlineStart: 16, zIndex: 97 }}><X size={14} />إغلاق المعاينة</button>
          <div style={{ position: 'fixed', bottom: 14, insetInline: 0, textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 11.5, pointerEvents: 'none' }}>
            اضغط في أي مكان للإغلاق
          </div>
        </div>
      )}
    </Modal>
  );
}
