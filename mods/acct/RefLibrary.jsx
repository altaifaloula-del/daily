/* v54.4 — المرحلة 5: «مكتبة المراجع المحاسبية» — رفع المراجع (PDF/Word/Excel/CSV/نص)، إصداراتها وتواريخ نفاذها وحالتها وتوثيقها، والبحث بالاستشهاد الحرفي بالصفحة.
   المحتوى خاص بالمنشأة ولا يُنشر؛ لا يُعدّ أي ملف معيارًا ساريًا قبل توثيقه. */
import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Upload, Check } from 'lucide-react';
import { refsApi, docxPages, textPages, xlsxPages } from '../../App.jsx';

const ST = { active: ['b-mint', 'ساري'], superseded: ['b-dim', 'ملغى/مستبدل'], draft: ['b-amber', 'مسودة'] };
export function RefLibrary({ me, say }) {
  const admin = me && me.role === 'system_admin';
  const [lib, setLib] = useState(null); const [err, setErr] = useState(''); const [q, setQ] = useState(''); const [f, setF] = useState({ cat: '', authority: '', family: '', includeInactive: false, rerank: true });
  const [hits, setHits] = useState(null); const [busy, setBusy] = useState(''); const [up, setUp] = useState({ title: '', cat: 'ifrs', authority: 'official', family: '', version: '', pubDate: '', effFrom: '', source: '' }); const [file, setFile] = useState(null);
  const load = async () => { try { setLib(await refsApi('GET', '')); setErr(''); } catch (e) { setErr(e.message); setLib({ docs: [], cats: {}, auth: {} }); } };
  useEffect(() => { load(); }, []);
  const search = async () => { if (q.trim().length < 2) return; setBusy('s'); try { const r = await refsApi('POST', '/search', { q, ...f }); setHits(r); } catch (e) { say(e.message, 'no'); } finally { setBusy(''); } };
  const upload = async () => {
    if (!file || !up.title.trim()) return say('اختر الملف واكتب العنوان', 'no'); setBusy('u');
    try { const n = file.name.toLowerCase(); let body = { meta: up };
      if (n.endsWith('.pdf')) { const b = await file.arrayBuffer(); let s = ''; const u8 = new Uint8Array(b); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); body.pdf = btoa(s); }
      else { const X = n.endsWith('.docx') ? await docxPages(await file.arrayBuffer()) : n.endsWith('.xlsx') ? await xlsxPages(await file.arrayBuffer()) : textPages(await file.text());
        body.pages = X.pages; if (X.estimated) body.meta = { ...up, note: 'أرقام الصفحات تقديرية (الملف لا يحمل فواصل صفحات)' }; }
      const { job } = await refsApi('POST', '/upload', body);
      for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, i < 3 ? 600 : 3000)); const j = await refsApi('GET', '/job/' + job); setBusy('u:' + j.state);
        if (j.state === 'done') { say('أُضيف المرجع ✓ — ' + j.pages + ' صفحة. وثّقه بعد مراجعة إصداره ونفاذه'); setFile(null); await load(); break; }
        if (j.state === 'error') throw new Error(j.error); }
    } catch (e) { say('تعذّر الرفع: ' + e.message, 'no'); } finally { setBusy(''); } };
  const upd = async (d, patch) => { try { await refsApi('POST', '/update', { id: d.id, ...patch }); await load(); say('حُدّث ✓'); } catch (e) { say(e.message, 'no'); } };
  const cats = (lib && lib.cats) || {}, auth = (lib && lib.auth) || {};
  return (
    <div className="grid" style={{ gap: 14 }} data-reflib>
      <div className="card">
        <div className="card-t"><BookOpen size={15} color="var(--brass)" />مكتبة المراجع المحاسبية <small style={{ color: 'var(--dim)', fontWeight: 400 }}>المعايير والأنظمة والسياسات التي ترفعها — الاستشهاد حرفي بالصفحة</small></div>
        {err && <div className="note" style={{ marginTop: 8 }}>{err}</div>}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <input className="inp" style={{ flex: 1, minWidth: 260 }} aria-label="بحث المراجع" placeholder="مثال: الاعتراف بالإيراد IFRS 15 فقرة 31" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <select className="sel" style={{ maxWidth: 200 }} aria-label="التصنيف" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}><option value="">كل التصنيفات</option>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="sel" style={{ maxWidth: 180 }} aria-label="الحجية" value={f.authority} onChange={e => setF({ ...f, authority: e.target.value })}><option value="">كل أنواع الحجية</option>{Object.entries(auth).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={f.includeInactive} onChange={e => setF({ ...f, includeInactive: e.target.checked })} /> يشمل الملغى</label>
          <label style={{ fontSize: 12 }}><input type="checkbox" checked={f.rerank} onChange={e => setF({ ...f, rerank: e.target.checked })} /> ترتيب بـ Claude</label>
          <button className="btn sm pri" data-refsearch disabled={busy === 's'} onClick={search}><Search size={13} />{busy === 's' ? 'جارٍ…' : 'بحث'}</button></div>
        {hits && <div style={{ marginTop: 10 }} data-refhits>
          <div className="hint">{hits.note}</div>
          {!hits.hits.length && <div className="empty">لا نتائج في المراجع المرفوعة — لا يُستشهد بما ليس فيها.</div>}
          {hits.hits.map((h, i) => <div key={i} className="note" style={{ marginTop: 6 }} data-refhit>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><b>{h.title}</b>{h.family && <span className="badge b-dim">{h.family}</span>}{h.version && <span className="badge b-dim">إصدار {h.version}</span>}
              <span className="badge b-sky">{h.authorityLabel}</span><span className={'badge ' + (h.verified ? 'b-mint' : 'b-amber')}>{h.verified ? 'موثّق' : 'غير موثّق'}</span><span className={'badge ' + ST[h.status][0]}>{ST[h.status][1]}</span>
              <span className="num" style={{ fontSize: 12 }}>ص {h.page} · مقطع {h.para}</span></div>
            <div style={{ fontSize: 12.5, marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{h.excerpt}</div></div>)}
        </div>}
      </div>
      {admin && <div className="card" data-refup>
        <div className="card-t" style={{ marginBottom: 6 }}><Upload size={14} />رفع مرجع</div>
        <div className="hint" style={{ marginBottom: 6 }}>ارفع نسخك المرخّصة فقط (معايير IFRS وإصدارات الهيئة محفوظة الحقوق). المحتوى يبقى خاصًا بمنشأتك. PDF حتى 100 صفحة يستخرج Claude نصه (ومنه الممسوح ضوئيًا).</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input type="file" aria-label="ملف المرجع" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={e => setFile(e.target.files[0] || null)} />
          {[['title', 'العنوان'], ['family', 'المعيار (مثل IFRS 15)'], ['version', 'الإصدار'], ['source', 'المصدر/الرابط']].map(([k, l]) => <input key={k} className="inp" style={{ maxWidth: 200 }} aria-label={l} placeholder={l} value={up[k]} onChange={e => setUp({ ...up, [k]: e.target.value })} />)}
          <select className="sel" style={{ maxWidth: 200 }} aria-label="تصنيف الرفع" value={up.cat} onChange={e => setUp({ ...up, cat: e.target.value })}>{Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="sel" style={{ maxWidth: 200 }} aria-label="حجية الرفع" value={up.authority} onChange={e => setUp({ ...up, authority: e.target.value })}>{Object.entries(auth).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label style={{ fontSize: 12 }}>تاريخ النشر <input type="date" className="inp" value={up.pubDate} onChange={e => setUp({ ...up, pubDate: e.target.value })} /></label>
          <label style={{ fontSize: 12 }}>ساري من <input type="date" className="inp" value={up.effFrom} onChange={e => setUp({ ...up, effFrom: e.target.value })} /></label>
          <button className="btn sm pri" data-refupload disabled={!!busy} onClick={upload}><Upload size={13} />{busy.startsWith('u') ? 'جارٍ… ' + (busy.split(':')[1] || '') : 'رفع واستخراج'}</button></div>
      </div>}
      <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>المراجع ({lib ? lib.docs.length : '…'})</div>
        <div className="tw"><table className="tb" style={{ fontSize: 12 }} data-reflist><thead><tr><th>العنوان</th><th>التصنيف</th><th>الحجية</th><th>الإصدار</th><th>ساري من</th><th>الصفحات</th><th>الحالة</th><th>التوثيق</th>{admin && <th></th>}</tr></thead>
          <tbody>{(lib ? lib.docs : []).map(d => <tr key={d.id}><td>{d.title}{d.family && <small> · {d.family}</small>}{d.note && <div className="hint">{d.note}</div>}</td><td>{cats[d.cat] || d.cat}</td><td>{auth[d.authority] || d.authority}</td><td>{d.version}</td><td className="num">{d.effFrom}</td><td className="num">{d.pages}</td>
            <td><span className={'badge ' + (ST[d.status] || ST.active)[0]}>{(ST[d.status] || ST.active)[1]}</span></td><td><span className={'badge ' + (d.verified ? 'b-mint' : 'b-amber')}>{d.verified ? 'موثّق' : 'غير موثّق'}</span></td>
            {admin && <td className="row" style={{ gap: 4 }}><button className="btn sm gh" data-refverify onClick={() => upd(d, { verify: !d.verified })}><Check size={12} />{d.verified ? 'إلغاء التوثيق' : 'توثيق'}</button>
              <select className="sel" style={{ maxWidth: 130 }} aria-label="حالة المرجع" value={d.status || 'active'} onChange={e => upd(d, { meta: { status: e.target.value } })}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v[1]}</option>)}</select></td>}</tr>)}
            {lib && !lib.docs.length && <tr><td colSpan={9}><div className="empty">لا مراجع بعد{admin ? ' — ارفع أول مرجع من الأعلى' : ''}</div></td></tr>}</tbody></table></div></div>
    </div>);
}
