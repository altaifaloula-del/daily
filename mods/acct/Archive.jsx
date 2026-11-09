/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { cloud, bfKey, KEYS } from '../../storage';
import { Image as ImageIcon, Camera, Upload, Store, CalendarDays, FileText, ClipboardCheck, Eye, Trash2, Check } from 'lucide-react';
import { FILE_CATS, Field, Modal, Num, ROLES, arDate, isPdfData, money, nowISO, openPdfData, sum, today, uid } from '../../App.jsx';

export function Archive({ org, me, myBranches, say }) {
  const [items, setItems] = useState(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState(null);
  const [draft, setDraft] = useState(null);
  const camRef = useRef(); const fileRef = useRef();

  // v9: أرشيف موزع — مستند صور لكل فرع + مستند للمركز، والعزل يفرضه الخادم
  const bfIds = useMemo(() => {
    const ids = myBranches.map(b => b.id);
    return (ROLES[me.role]?.scope === 'all') ? [...ids, 'hq'] : ids;
  }, [myBranches, me]);
  useEffect(() => {
    (async () => {
      const all = [];
      for (const b of bfIds) {
        const d = await cloud.get(bfKey(b), { items: [] });
        (d.items || []).forEach(it => all.push(it.branchId ? it : { ...it, branchId: b === 'hq' ? '' : b }));
      }
      all.sort((a, b2) => (b2.uploadedAt || b2.at || '').localeCompare(a.uploadedAt || a.at || ''));
      setItems(all);
    })();
  }, [bfIds]);

  const homeOf = (it) => (it.branchId && myBranches.some(b => b.id === it.branchId)) ? it.branchId : (bfIds.includes('hq') ? 'hq' : (bfIds[0] || 'hq'));
  // v28.1: يُكتب مستند الفرع المتأثر فقط، ولا تتغير الواجهة إلا بعد نجاح الحفظ
  // (سابقًا تُعاد كتابة مستندات كل الفروع بالقائمة المعروضة، فأي اقتطاع أو تحميل ناقص يمحو أرشيف الجميع)
  const persist = async (next, homes) => {
    for (const b of [...new Set(homes)]) {
      const ok = await cloud.set(bfKey(b), { items: next.filter(it => homeOf(it) === b) });
      if (!ok) { say('تعذّر حفظ الأرشيف — لم يتغير شيء، أعد المحاولة', 'no'); return false; }
    }
    setItems(next);
    return true;
  };

  const compress = (file) => new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = reject; img.src = String(rd.result);
    };
    rd.onerror = reject; rd.readAsDataURL(file);
  });

  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return say('يُقبل رفع الصور فقط في هذه النسخة', 'no');
    setBusy(true);
    try {
      const url = await compress(file);
      setDraft({
        id: uid('fl'), title: '', category: 'receipt',
        branchId: myBranches[0]?.id || '', fileUrl: url, fileType: 'image',
        fileName: file.name, fileSizeKb: Math.round(url.length * 0.75 / 1024),
        uploadDate: today(), uploadedBy: me.name, amount: 0, referenceNo: '', notes: ''
      });
    } catch { say('تعذّرت معالجة الصورة', 'no'); }
    setBusy(false);
  };

  const saveDraft = async () => {
    if (!draft.title.trim()) return say('اكتب عنوان المستند', 'no');
    const b = org.branches.find(x => x.id === draft.branchId);
    const rec = { ...draft, branchName: b?.name || '', uploadedAt: nowISO() };
    if (items === null) return say('انتظر اكتمال تحميل الأرشيف ثم احفظ', 'no');
    if (!(await persist([rec, ...items], [homeOf(rec)]))) return;
    say('تمت أرشفة المستند وأصبح متاحاً لبقية المستخدمين');
    setDraft(null);
  };

  // v16.6 — بطلب المالك: مدير النظام يستطيع حذف أي مستند حتى مستندات توثيق الإغلاق
  // (كانت محمية من الحذف للجميع). مع تأكيد صريح، ويُقيَّد الحذف في سجل التدقيق.
  const isAdminMe = !!ROLES[me.role]?.admin;
  const del = async (it) => {
    const closingDoc = it.source === 'closing';
    if (closingDoc && !isAdminMe) return;   // حارس إضافي فوق إخفاء الزر
    const msg = closingDoc
      ? 'هذا مستند توثيق مؤرشف من إغلاق يومي — حذفه نهائي ولا يمكن استرداده، وسيُقيَّد الحذف باسمك في سجل التدقيق. هل أنت متأكد؟'
      : 'حذف هذا المستند من الأرشيف نهائياً؟';
    if (!window.confirm(msg)) return;
    if (items === null) return;
    if (!(await persist(items.filter(x => x.id !== it.id), [homeOf(it)]))) return;
    try {
      const pu = await cloud.get(KEYS.pulse, { presence: {}, audit: [] });
      const entry = {
        id: uid('lg'), timestamp: nowISO(), at: Date.now(), userName: me.name, userRole: me.role,
        userRoleLabel: (ROLES[me.role] || {}).ar || me.role, actionType: 'delete', targetType: 'archive_doc',
        targetId: it.id, branchId: it.branchId, branchName: it.branchName,
        title: 'حذف مستند من الأرشيف', details: (it.title || '') + (closingDoc ? ' · مستند توثيق إغلاق' : '')
      };
      await cloud.set(KEYS.pulse, { ...pu, audit: [entry, ...(pu.audit || [])].slice(0, 150) });
    } catch (e) { /* السجل تكميلي */ }
    say('تم حذف المستند من الأرشيف');
  };

  const ids = myBranches.map(b => b.id);
  const mine = (items || []).filter(i => ids.includes(i.branchId));
  const list = mine.filter(i => (filter === 'all' || i.category === filter)
    && (branchFilter === 'all' || i.branchId === branchFilter));
  const totalKb = sum(mine, i => i.fileSizeKb || 0);

  // تجميع حسب الفرع ثم اليوم (الأحدث أولاً)
  const grouped = (() => {
    const byBranch = {};
    list.forEach(it => {
      const bk = it.branchId || 'x';
      (byBranch[bk] = byBranch[bk] || { name: it.branchName, days: {} });
      const dk = it.uploadDate || '—';
      (byBranch[bk].days[dk] = byBranch[bk].days[dk] || []).push(it);
    });
    return Object.entries(byBranch).map(([bid, v]) => ({
      bid, name: v.name,
      days: Object.entries(v.days).sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, arr]) => ({ date, arr }))
    })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-t"><ImageIcon size={15} color="var(--brass)" />أرشيف الإيصالات والمستندات</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 5 }}>
              {mine.length} مستند · <span className="num">{(totalKb / 1024).toFixed(2)}</span> ميجابايت — تُضغط الصور تلقائياً قبل الحفظ.
            </div>
          </div>
          <div className="row">
            <button className="btn pri" disabled={busy} onClick={() => camRef.current?.click()}>
              <Camera size={15} />التقاط بالكاميرا
            </button>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={14} />رفع صورة
            </button>
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pick} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} />
          </div>
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <button className={'btn sm' + (filter === 'all' ? ' pri' : ' gh')} onClick={() => setFilter('all')}>كل التصنيفات</button>
          {FILE_CATS.map(c => (
            <button key={c.id} className={'btn sm' + (filter === c.id ? ' pri' : ' gh')} onClick={() => setFilter(c.id)}>{c.ar}</button>
          ))}
        </div>
        {myBranches.length > 1 && (
          <div className="row">
            <button className={'btn sm' + (branchFilter === 'all' ? ' pri' : ' gh')} onClick={() => setBranchFilter('all')}>كل الفروع</button>
            {myBranches.map(b => (
              <button key={b.id} className={'btn sm' + (branchFilter === b.id ? ' pri' : ' gh')} onClick={() => setBranchFilter(b.id)}>{b.name}</button>
            ))}
          </div>
        )}
      </div>

      {items === null && <div className="card"><div className="empty">جارٍ تحميل الأرشيف…</div></div>}
      {items !== null && list.length === 0 && (
        <div className="card"><div className="empty">
          لا مستندات في هذا التصنيف. التقط صورة إيصال أو ارفعها لتُحفظ في أرشيف فروعك.
        </div></div>
      )}

      {grouped.map(g => (
        <div key={g.bid} className="card">
          <div className="card-t" style={{ marginBottom: 12 }}>
            <Store size={15} color="var(--brass)" />{g.name}
            <span className="badge b-dim" style={{ marginInlineStart: 'auto' }}>
              {sum(g.days, d => d.arr.length)} مستند
            </span>
          </div>
          {g.days.map(day => (
            <div key={day.date} style={{ marginBottom: 14 }}>
              <div className="row" style={{ marginBottom: 8, gap: 8 }}>
                <CalendarDays size={13} color="var(--faint)" />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{arDate(day.date)}</span>
                <span className="badge b-dim">{day.arr.length}</span>
                <span style={{ height: 1, flex: 1, background: 'var(--line)' }} />
              </div>
              <div className="grid g4">
                {day.arr.map(it => (
                  <div key={it.id} className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--ink)' }}>
                    <div style={{ position: 'relative' }}>
                      {isPdfData(it.fileUrl)
                        ? <div onClick={() => openPdfData(it.fileUrl, it.title)}
                          style={{ width: '100%', height: 120, display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'var(--ink3)' }}>
                          <div style={{ textAlign: 'center' }}>
                            <FileText size={30} color="var(--rose)" />
                            <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 5 }}>ملف PDF — اضغط للفتح</div>
                          </div>
                        </div>
                        : <img src={it.fileUrl} alt={it.title} onClick={() => setPreview(it)}
                          style={{ width: '100%', height: 120, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />}
                      {it.source === 'closing' && (
                        <span className="badge b-mint" style={{ position: 'absolute', top: 6, insetInlineEnd: 6, fontSize: 9 }}>
                          <ClipboardCheck size={9} />إغلاق
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {it.title}
                      </div>
                      <div className="row" style={{ gap: 5 }}>
                        <span className="badge b-brass" style={{ fontSize: 9 }}>{it.categoryLabelAr || FILE_CATS.find(c => c.id === it.category)?.ar}</span>
                        {it.amount > 0 && <span className="badge b-dim" style={{ fontSize: 9 }}><span className="num">{money(it.amount)}</span></span>}
                      </div>
                      <div className="row" style={{ marginTop: 8, gap: 4 }}>
                        <button className="btn sm gh" onClick={() => setPreview(it)}><Eye size={11} /></button>
                        {(it.source !== 'closing' || isAdminMe) && (
                          <button className="btn sm gh" onClick={() => del(it)}
                            title={it.source === 'closing' ? 'حذف نهائي لمستند توثيق إغلاق (لمدير النظام) — يُقيَّد في سجل التدقيق' : 'حذف المستند'}>
                            <Trash2 size={11} color="#D9544D" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {draft && (
        <Modal title="بيانات المستند قبل الأرشفة" icon={Camera} onClose={() => setDraft(null)}
          foot={<><button className="btn pri" onClick={saveDraft}><Check size={14} />حفظ في الأرشيف</button>
            <button className="btn gh" onClick={() => setDraft(null)}>إلغاء</button></>}>
          <img src={draft.fileUrl} alt="معاينة" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, marginBottom: 14, background: '#000' }} />
          <div className="grid g2">
            <Field label="عنوان المستند">
              <input className="inp" value={draft.title} placeholder="مثال: فاتورة خضار 12/8"
                onChange={e => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="التصنيف">
              <select className="sel" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>
                {FILE_CATS.map(c => <option key={c.id} value={c.id}>{c.ar}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid g2">
            <Field label="الفرع">
              <select className="sel" value={draft.branchId} onChange={e => setDraft({ ...draft, branchId: e.target.value })}>
                {myBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Num label="قيمة المستند (اختياري)" value={draft.amount} onChange={v => setDraft({ ...draft, amount: v })}
              hint={`حجم الصورة بعد الضغط ${draft.fileSizeKb} ك.ب`} />
          </div>
          <Field label="ملاحظات">
            <input className="inp" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </Modal>
      )}

      {preview && (
        <Modal wide title={preview.title} icon={ImageIcon} onClose={() => setPreview(null)}
          foot={<button className="btn gh" onClick={() => setPreview(null)}>إغلاق</button>}>
          {isPdfData(preview.fileUrl)
            ? <div style={{ textAlign: 'center', padding: '26px 12px', background: 'var(--ink3)', borderRadius: 10 }}>
              <FileText size={34} color="var(--rose)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 12 }}>هذا المستند ملف PDF — يُفتح بعارض المتصفح</div>
              <button className="btn pri" onClick={() => openPdfData(preview.fileUrl, preview.title)}><FileText size={14} />فتح الملف</button>
            </div>
            : <img src={preview.fileUrl} alt={preview.title} style={{ width: '100%', borderRadius: 10, background: '#000' }} />}
          <div className="row" style={{ marginTop: 12 }}>
            <span className="badge b-brass">{FILE_CATS.find(c => c.id === preview.category)?.ar}</span>
            <span className="badge b-dim">{preview.branchName}</span>
            <span className="badge b-dim">{arDate(preview.uploadDate)}</span>
            {preview.amount > 0 && <span className="badge b-mint"><span className="num">{money(preview.amount)}</span> ر.س</span>}
          </div>
          {preview.notes && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 10 }}>{preview.notes}</div>}
        </Modal>
      )}
    </div>
  );
}
