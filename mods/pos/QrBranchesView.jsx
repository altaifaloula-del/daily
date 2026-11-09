/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { QrCode, Plus, Check, X, RefreshCw, Printer, Download } from 'lucide-react';
import { BranchForm, Modal, escH, newBranchDraft, openDocWin, qrAvg, qrF1, qrFs, qrOverall, qrRateUrl, qrSvg } from '../../App.jsx';

export function QrBranchesView({ org, brs, fb, pub, canPublish, canAddBranch, commitOrg, say }) {
  const [busyId, setBusyId] = useState('');
  const [show, setShow] = useState(null);
  const [bNew, setBNew] = useState(null);   // مسودة فرع جديد (نفس نموذج «الفروع والمستخدمون»)
  const company = String((org.company || {}).name || '').slice(0, 80);

  const publish = async (b, active) => {
    setBusyId(b.id);
    try {
      const f = await qrFs();
      await f.setDoc(f.doc(f.db, 'qr_branches', b.id), { name: String(b.name || '').slice(0, 80), company, active, updatedAt: f.serverTimestamp() });
      say(active ? 'فُعِّل استقبال التقييمات لفرع ' + b.name + ' ✓' : 'أُوقف استقبال التقييمات لفرع ' + b.name);
    } catch (e) {
      say('تعذّر الحفظ: ' + ((e && e.code) === 'permission-denied' ? 'تفعيل الفروع لحسابات المركز فقط (أو لم تُنشر قواعد Firestore الجديدة)' : ((e && e.message) || 'خطأ')), 'no');
    }
    setBusyId('');
  };

  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); say('نُسخ الرابط ✓'); } catch { window.prompt('انسخ الرابط:', url); }
  };

  const downloadPng = (b) => {
    const svg = qrSvg(qrRateUrl(b.id), { ecl: 2, px: 1024 });
    if (!svg) return say('تعذّر توليد رمز QR', 'no');
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1024, 1024); x.drawImage(img, 0, 0, 1024, 1024);
      const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'QR-' + (b.name || b.id) + '.png'; a.click();
    };
    img.onerror = () => say('تعذّر تحويل الرمز إلى صورة', 'no');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  const printQr = (b) => {
    const w = openDocWin();
    if (!w) return say('اسمح بالنوافذ المنبثقة لطباعة الرمز', 'no');
    const url = qrRateUrl(b.id);
    const svg = qrSvg(url, { ecl: 2, px: 300 });
    const html = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>رمز تقييم — ' + escH(b.name) + '</title>' +
      '<style>body{font-family:Tahoma,sans-serif;margin:0;padding:28px;display:flex;justify-content:center}.card{width:360px;border:2px solid #8C6F2C;border-radius:16px;padding:22px;text-align:center}' +
      '.co{font-size:13px;color:#5a4a1e;font-weight:700}.t{font-size:24px;font-weight:800;margin:8px 0 2px}.br{font-size:13px;color:#555;margin-bottom:12px}.h{font-size:12px;color:#444;margin-top:10px}.u{font-family:monospace;font-size:9.5px;color:#888;direction:ltr;word-break:break-all;margin-top:8px}@media print{body{padding:0}}</style></head><body><div class="card">' +
      '<div class="co">' + escH(company) + '</div><div class="t">قيّم تجربتك</div><div class="br">' + escH(b.name) + '</div>' +
      (svg || '<div style="color:#b00">تعذّر توليد الرمز</div>') +
      '<div class="h">امسح الرمز بكاميرا الجوال — دقيقة واحدة وبدون تسجيل دخول</div><div class="u">' + escH(url) + '</div></div>' +
      '</body></html>';
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (_) { } }, 400);
  };

  // إضافة فرع للمنصة (نفس حفظ شاشة «الفروع والمستخدمون» وسجل تدقيقها) ثم تفعيل استقبال تقييماته مباشرة
  const addBranch = async (b) => {
    if (!String(b.name || '').trim()) return say('أدخل اسم الفرع', 'no');
    const ok = await commitOrg(d => ({ ...d, branches: [...(d.branches || []), b] }), {
      actionType: 'create', targetType: 'branch', targetId: b.id, branchName: b.name,
      title: 'أضاف فرعاً جديداً', details: `${b.name} — ${b.city || ''} (من وحدة تقييم العملاء)`
    });
    if (!ok) return;
    setBNew(null);
    say('تمت إضافة الفرع ✓');
    await publish(b, true);
  };

  const showB = show ? (brs.find(b => b.id === show) || null) : null;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-h">
          <div className="card-t"><QrCode size={15} color="var(--brass)" />رموز التقييم للفروع</div>
          {canAddBranch && <button className="btn sm pri" onClick={() => setBNew(newBranchDraft())}><Plus size={13} />إضافة فرع</button>}
        </div>
        <div className="note" style={{ marginBottom: 10, fontSize: 11.5 }}>
          {canPublish
            ? 'فعّل استقبال التقييمات لكل فرع أولًا (ينشر اسم الفرع فقط للعامة)، ثم اطبع الرمز وضعه على الطاولات. الإيقاف يمنع الإرسال فورًا دون حذف أي تقييم.'
            : 'يفعّل حساب المركز استقبال التقييمات للفروع — يمكنك عرض رمز فرعك وطباعته بعد التفعيل.'}
        </div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>الفرع</th><th>الاستقبال</th><th>المتوسط</th><th>التقييمات</th><th>إجراءات</th></tr></thead>
            <tbody>
              {brs.map(b => {
                const p = pub[b.id];
                const mine = fb.filter(f => f.branchId === b.id);
                const stale = p && p.name !== b.name;
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.name}{b.isActive === false && <span className="badge b-dim" style={{ marginInlineStart: 6 }}>فرع موقوف</span>}</td>
                    <td>
                      {p === undefined ? <span className="badge b-dim">…</span>
                        : p === null ? <span className="badge b-dim">غير مفعّل</span>
                          : p.active ? <span className="badge b-mint">يستقبل</span> : <span className="badge b-amber">موقوف</span>}
                      {stale && <span className="badge b-amber" style={{ marginInlineStart: 4 }}>الاسم يحتاج تحديث</span>}
                    </td>
                    <td><span className="num">{mine.length ? qrF1(qrAvg(mine.map(qrOverall))) + ' ★' : '—'}</span></td>
                    <td><span className="num">{mine.length}</span></td>
                    <td>
                      <div className="row" style={{ gap: 5 }}>
                        {canPublish && (!p || !p.active) && <button className="btn sm ok" disabled={busyId === b.id} onClick={() => publish(b, true)}><Check size={13} />تفعيل الاستقبال</button>}
                        {canPublish && p && p.active && <button className="btn sm gh" disabled={busyId === b.id} onClick={() => publish(b, false)}><X size={13} />إيقاف</button>}
                        {canPublish && stale && <button className="btn sm gh" disabled={busyId === b.id} onClick={() => publish(b, !!p.active)}><RefreshCw size={13} />تحديث الاسم</button>}
                        {p && <button className="btn sm" onClick={() => setShow(b.id)}><QrCode size={13} />رمز QR</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!brs.length && <tr><td colSpan={5}><div className="empty">لا توجد فروع ضمن صلاحيتك.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {bNew && <BranchForm b={bNew} org={org} say={say} onSave={addBranch} onClose={() => setBNew(null)} />}

      {showB && (() => {
        const url = qrRateUrl(showB.id);
        return (
          <Modal title={'رمز تقييم — ' + showB.name} icon={QrCode} onClose={() => setShow(null)}
            foot={<>
              <button className="btn pri" onClick={() => printQr(showB)}><Printer size={14} />طباعة</button>
              <button className="btn" onClick={() => downloadPng(showB)}><Download size={14} />تحميل PNG</button>
              <button className="btn gh" onClick={() => copy(url)}>نسخ الرابط</button>
              <button className="btn gh" onClick={() => setShow(null)}>إغلاق</button>
            </>}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#fff', padding: 10, borderRadius: 12, border: '1px solid var(--frame-o)' }}
                dangerouslySetInnerHTML={{ __html: qrSvg(url, { ecl: 2, px: 240 }) }} />
              <div style={{ direction: 'ltr', fontSize: 11.5, color: 'var(--sky)', marginTop: 10, wordBreak: 'break-all' }}>
                <a href={url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{url}</a>
              </div>
              {pub[showB.id] && !pub[showB.id].active && <div className="note" style={{ marginTop: 10, color: 'var(--amber)' }}>استقبال التقييمات موقوف لهذا الفرع — الرمز لن يقبل إرسالًا حتى التفعيل.</div>}
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
