/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { KEYS, brKey, bfKey, cloud } from '../../storage';
import { ShieldCheck, RefreshCw, Trash2 } from 'lucide-react';
import { BR_COLS, slimBranchDoc, today } from '../../App.jsx';

export function CloudHealth({ org, say, only, auto, commit, me }) {
  const [rows, setRows] = useState(null); const [busy, setBusy] = useState(false);
  const keys = [[KEYS.core, 'المستند المركزي (الحسابات والمشتريات)'], [KEYS.org, 'الإعدادات'], [KEYS.dir, 'الدليل العام للفروع'], [KEYS.loy, 'نقاط الولاء'],
    ...(org.branches || []).flatMap(b => [[brKey(b.id), 'فرع ' + b.name], [bfKey(b.id), 'أرشيف مستندات ' + b.name]])].filter(([k]) => !only || only.includes(k));
  useEffect(() => { if (auto) run(); }, []);   // eslint-disable-line
  const run = async () => { setBusy(true); const out = []; for (const [k, l] of keys) { const r = await cloud.inspect(k); out.push({ ...r, label: l, re: cloud.readErr(k) }); setRows([...out]); } setBusy(false); };
  const bad = (r) => !r.txOk && (r.err || (r.exists && (r.missing.length || !r.json)));
  const slim = async (r) => {
    const b = (org.branches || []).find(x => brKey(x.id) === r.key); if (!b) return;
    if (!window.confirm('تخفيف ملف «' + b.name + '» (' + r.kb + ' KB)؟\n\nتُنسخ صور الإغلاقات (إثبات الشبكة، توثيق المسؤول، فواتير المصروفات) إلى «المستندات والأرشيف» بعد التحقق، ثم تُزال من ملف الفرع. الصور تبقى متاحة في الأرشيف، والأرقام والقيود لا تتغير.')) return;
    setBusy(true); const res = await slimBranchDoc(b, commit, me); setBusy(false);
    if (res.err) say(res.err, 'no'); else say(res.n ? 'خُفّف الملف ✓ — ' + res.n + ' إغلاق، ' + res.imgs + ' صورة نُقلت للأرشيف' : 'لا صور داخل الإغلاقات — الملف خفيف أصلًا'); run();
  };
  const dropImgs = async (r) => {
    const b = (org.branches || []).find(x => brKey(x.id) === r.key); if (!b) return;
    if (!window.confirm('حذف صور الإغلاقات نهائيًا من «' + b.name + '» (' + r.kb + ' KB)؟\n\nتُحذف صور إثبات الشبكة وتوثيق المسؤول وفواتير المصروفات المرفقة بالإغلاقات، ولا تُنسخ لأي مكان ولا يمكن استرجاعها.\nأرقام الإغلاقات والقيود المحاسبية لا تتغير.')) return;
    setBusy(true); const res = await slimBranchDoc(b, commit, me, true); setBusy(false);
    if (res.err) say(res.err, 'no'); else say(res.n ? 'حُذفت ' + res.imgs + ' صورة من ' + res.n + ' إغلاق ✓ — الملف خفيف الآن' : 'لا صور داخل الإغلاقات'); run();
  };
  const emptyArchive = async (r) => {
    if (!window.confirm('تفريغ «' + r.label + '» وحذف محتواه نهائيًا؟\n\nالأرشيف تالف ولا يُقرأ أصلًا منذ مدة. سيُستبدل بأرشيف فارغ سليم، ولا يمكن استرجاع ما كان فيه.')) return;
    const res = await cloud.repairWith(r.key, { items: [] });
    say(res === 'ok' ? 'فُرّغ الأرشيف ✓' : 'تعذّر التفريغ: ' + res, res === 'ok' ? 'ok' : 'no'); if (res === 'ok') run();
  };
  // v37.3 — مستند فرع تالف بلا أي نسخة سليمة وبياناته ملغاة: يُستبدل بمستند فرع فارغ سليم (بعد تنزيل النص التالف كاملًا للجهاز)
  const emptyBranch = async (r) => {
    try { const blob = new Blob([r.raw || JSON.stringify(r.head || {})], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'فرع_تالف_' + r.key.replace(/[^\w]/g, '_') + '_' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch { }
    if (!window.confirm('تفريغ «' + r.label + '» نهائيًا؟\n\nنُزّل النص التالف إلى جهازك (احفظه في «الملفات»).\nسيُستبدل المستند التالف بمستند فرع فارغ سليم: تُحذف إغلاقات وتحويلات وفواتير هذا الفرع المحفوظة فيه، ويبقى الفرع نفسه وموظفوه وإعداداته.\n\nاستخدمه فقط إذا كانت بيانات الفرع القديمة ملغاة.')) return;
    setBusy(true);
    const res = await cloud.repairWith(r.key, Object.fromEntries(BR_COLS.map(c => [c, []])));
    setBusy(false);
    say(res === 'ok' ? 'فُرّغ مستند الفرع ✓ — الفرع يعمل الآن من جديد؛ أعد تحميل المنصة على أجهزته' : 'تعذّر التفريغ: ' + res, res === 'ok' ? 'ok' : 'no'); if (res === 'ok') run();
  };
  // ملخص محتوى نسخة: يساعد على اختيار الأحدث والأكمل قبل الاستعادة
  const sumOf = (v) => { if (!v || typeof v !== 'object') return 'فارغة'; const cl = v.closings || []; const last = cl.reduce((m, c) => (c.date || '') > m ? c.date : m, '');
    const parts = [cl.length ? cl.length + ' إغلاق (آخره ' + (last || '—') + ')' : '', (v.posOrders || []).length ? v.posOrders.length + ' فاتورة نقطة بيع' : '', (v.invoices || []).length ? v.invoices.length + ' فاتورة مورد' : '',
      (v.transfers || []).length ? v.transfers.length + ' تحويل' : '', (v.journalManual || []).length ? v.journalManual.length + ' قيد يدوي' : '', (v.tx || []).length ? v.tx.length + ' حركة نقاط' : '', v.branches ? (v.branches.length + ' فرع') : ''].filter(Boolean);
    return parts.join(' · ') || 'بلا سجلات'; };
  // النص الخام التالف يُنزَّل كاملًا إلى الجهاز أولًا (لا يضيع شيء حتى ما لم يُستخرج)، ثم تُكتب المستندات السليمة
  const salvageRestore = async (r) => {
    try { const blob = new Blob([r.raw || ''], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'نسخة_تالفة_' + r.key.replace(/[^\w]/g, '_') + '_' + today() + '.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 5000); } catch { }
    if (!window.confirm('نُزّلت النسخة التالفة كاملة إلى جهازك (احفظها في «الملفات»).\n\nاستعادة «' + r.label + '» بالمستندات السليمة المستخرجة (' + r.salvage.items.length + ' مستند)؟ ما لم يُستخرج يبقى في الملف المنزّل.')) return;
    const res = await cloud.repairWith(r.key, { items: r.salvage.items });
    say(res === 'ok' ? 'استُعيد الأرشيف بـ ' + r.salvage.items.length + ' مستند ✓ — يمكنك الآن «تخفيف الملف»' : 'تعذّرت الاستعادة: ' + res, res === 'ok' ? 'ok' : 'no');
    if (res === 'ok') run();
  };
  const restore = async (r, val, from) => {
    if (!window.confirm('استعادة «' + r.label + '» من ' + from + '؟\n\nالمحتوى: ' + sumOf(val) + '\n\nيُستبدل المستند التالف في السحابة بهذه النسخة. أي بيانات أحدث منها في المستند التالف لا يمكن قراءتها أصلًا. يُنصح بتنزيل نسخة احتياطية أولًا.')) return;
    const res = await cloud.repairWith(r.key, val);
    say(res === 'ok' ? 'استُعيد المستند ✓ — أعد تحميل المنصة على كل الأجهزة' : 'تعذّرت الاستعادة: ' + res, res === 'ok' ? 'ok' : 'no');
    if (res === 'ok') run();
  };
  return (
    <div className="card">
      <div className="row" style={{ gap: 8, marginBottom: 8 }}><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />فحص سلامة البيانات السحابية</div>
        <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} disabled={busy} onClick={run}><RefreshCw size={13} />{busy ? 'جارٍ الفحص…' : 'فحص الآن'}</button></div>
      <div className="note">إذا ظهرت رسالة «تعذّرت قراءة … من السحابة» عند الحفظ، افحص هنا لمعرفة المستند المتأثر وسببه. الفحص قراءة فقط ولا يغيّر شيئًا؛ الاستعادة لا تتم إلا بعد اختيارك وتأكيدك.</div>
      {rows && <div className="tw" style={{ marginTop: 8 }}><table className="tb"><thead><tr><th>المستند</th><th>الحالة</th><th style={{ textAlign: 'end' }}>الحجم</th><th>الأجزاء</th></tr></thead><tbody>
        {rows.map(r => <React.Fragment key={r.key}><tr><td style={{ fontSize: 12 }}>{r.label}</td>
          <td>{r.err ? <span className="badge b-rose">تعذّرت القراءة: {r.err}</span> : !r.exists ? <span className="badge b-dim">غير موجود بعد</span>
            : (r.missing.length || !r.json) && r.txOk ? <span className="badge b-amber">سليم — كان تلفًا عابرًا أثناء كتابة جهاز آخر ✓</span>
            : r.missing.length ? <span className="badge b-rose">أجزاء مفقودة: {r.missing.join('، ')}</span> : !r.json ? <span className="badge b-rose">محتوى تالف</span> : <span className="badge b-mint">سليم ✓</span>}</td>
          <td className="num" style={{ textAlign: 'end' }}>{r.kb != null ? r.kb + ' KB' : '—'}{commit && !bad(r) && r.kb > 2500 && String(r.key).startsWith('rms8:br_') && <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}><button className="btn sm" disabled={busy} onClick={() => slim(r)}>تخفيف الملف</button><button className="btn sm gh" disabled={busy} onClick={() => dropImgs(r)}><Trash2 size={12} color="#D9544D" />حذف الصور نهائيًا</button></div>}</td><td className="num">{r.parts || '—'}</td></tr>
          {bad(r) && <tr><td colSpan={4} style={{ background: 'var(--ink)' }}>
            {r.head && <div style={{ fontSize: 10.5, color: 'var(--faint)', marginBottom: 6, direction: 'ltr', textAlign: 'left', fontFamily: 'monospace', wordBreak: 'break-all' }}>head: {r.head.keys} · value={r.head.valueType}/{String(r.head.valueLen)} · parts={r.parts}{r.ver ? ' · ver=' + r.ver : ''} · {r.head.at} · «{r.head.start}»</div>}
            <div className="lbl">خيارات الاستعادة — اختر النسخة الأحدث والأكمل:</div>
            {(r.candidates || []).map((c, i) => <div key={i} className="row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}><span className="badge b-mint">نسخة سحابية سليمة</span><span style={{ fontSize: 12 }}>{c.parts} أجزاء · {c.kb} KB — {sumOf(c.value)}</span><button className="btn sm" onClick={() => restore(r, c.value, 'نسخة سحابية سليمة')}>استعادة هذه</button></div>)}
            {r.localValue !== undefined ? <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}><span className="badge b-brass">نسخة هذا الجهاز</span><span style={{ fontSize: 12 }}>{sumOf(r.localValue)}</span><button className="btn sm" onClick={() => restore(r, r.localValue, 'نسخة هذا الجهاز')}>استعادة هذه</button></div>
              : <div style={{ fontSize: 12, color: 'var(--faint)' }}>لا توجد نسخة لهذا المستند على هذا الجهاز — افتح الفحص من جهاز كان يعمل على هذا الفرع (جهاز الكاشير أو المدير).</div>}
            {/^rms8:bf_/.test(r.key) && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 6 }}><span className="badge b-rose">حذف</span><span style={{ fontSize: 12 }}>لا تحتاج محتواه؟ استبدله بأرشيف فارغ سليم</span><button className="btn sm" onClick={() => emptyArchive(r)}><Trash2 size={12} color="#D9544D" />تفريغ الأرشيف</button></div>}
            {r.salvage && r.salvage.items.length > 0 && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 6 }}><span className="badge b-amber">استعادة جزئية</span><span style={{ fontSize: 12 }}>{r.salvage.items.length} مستند سليم استُخرج من النسخة التالفة{(() => { const ds = r.salvage.items.map(x => x.uploadDate || '').filter(Boolean).sort(); return ds.length ? ' (من ' + ds[0] + ' إلى ' + ds[ds.length - 1] + ')' : ''; })()}</span>
              <button className="btn sm" onClick={() => salvageRestore(r)}>نسخ احتياطي ثم استعادة جزئية</button></div>}
            {/^rms8:br_/.test(r.key) && commit && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 6, marginTop: 4 }}><span className="badge b-rose">تفريغ</span><span style={{ fontSize: 12 }}>بيانات هذا الفرع القديمة ملغاة؟ استبدل المستند التالف بمستند فرع فارغ سليم (يُنزَّل النص التالف لجهازك أولًا).</span><button className="btn sm" disabled={busy} style={{ color: 'var(--rose)', borderColor: 'color-mix(in srgb,var(--rose) 45%,var(--line))' }} onClick={() => emptyBranch(r)}>نسخ ثم تفريغ مستند الفرع</button></div>}
            {!(r.candidates || []).length && r.localValue === undefined && !(r.salvage && r.salvage.items.length) && <div style={{ fontSize: 12, color: 'var(--rose)', marginTop: 4 }}>لم تُعثر على نسخة سليمة.{/^rms8:br_/.test(r.key) ? ' إن كانت بيانات الفرع القديمة ملغاة فاستخدم «نسخ ثم تفريغ مستند الفرع» أعلاه، وإلا تواصل مع المطوّر قبل أي إجراء.' : ' تواصل مع المطوّر قبل أي إجراء.'}</div>}
          </td></tr>}</React.Fragment>)}
      </tbody></table></div>}
    </div>);
}
