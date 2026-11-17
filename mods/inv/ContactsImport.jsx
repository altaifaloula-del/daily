/* v46.6 — استيراد جهات الاتصال: ملف Excel/CSV بأعمدة معروفة، أو ملف جهات الجوال (vCard .vcf)، أو الاختيار المباشر من جهات الجوال (أندرويد/Chrome).
   معاينة قبل الحفظ، والنوع (عميل/مورد) لكل سطر، وتُتجاوز المكررات (نفس الاسم أو الجوال). */
import React, { useState } from 'react';
import { Upload, Download, Check, Smartphone } from 'lucide-react';
import { Modal, makeXlsx, nextPartnerCode, normDigits, parseCsvGrid, parseXlsxGrid, uid } from '../../App.jsx';

const clean = (s) => String(s == null ? '' : s).trim();
const phoneNorm = (s) => normDigits(clean(s)).replace(/[^\d+]/g, '');
const typeOf = (s) => /مورد|supplier|vendor/i.test(clean(s)) ? 'supplier' : 'customer';
// vCard: FN/N، TEL، EMAIL، ORG — مع طي الأسطر
export function parseVcf(text) {
  const out = []; const unf = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  unf.split(/BEGIN:VCARD/i).slice(1).forEach(card => {
    const get = (k) => { const m = new RegExp('^' + k + '(?:;[^:]*)?:(.*)$', 'im').exec(card); return m ? m[1].trim() : ''; };
    let name = get('FN'); if (!name) { const n = get('N').split(';'); name = [n[1], n[0]].filter(Boolean).join(' '); }
    const tels = []; card.replace(/^TEL(?:;[^:]*)?:(.*)$/gim, (_, t) => { tels.push(t.trim()); return ''; });
    if (!name && !tels.length) return;
    out.push({ name: name || tels[0], phone: phoneNorm(tels[0] || ''), mobile2: phoneNorm(tels[1] || ''), email: get('EMAIL'), org: get('ORG').replace(/;+$/, '') });
  });
  return out;
}
const COLS = [['name', /الاسم|اسم|name/i], ['type', /النوع|نوع|type/i], ['phone', /جوال|هاتف|phone|mobile|tel/i], ['tax', /ضريبي|vat|tax/i], ['city', /مدينة|city/i], ['email', /بريد|email/i], ['cat', /تصنيف|فئة|category/i]];
export function rowsFromGrid(grid) {
  if (!grid || !grid.length) return [];
  const head = (grid[0] || []).map(clean); const ix = {};
  COLS.forEach(([k, re]) => { const i = head.findIndex(h => re.test(h)); if (i >= 0) ix[k] = i; });
  if (ix.name == null) ix.name = 0;
  return grid.slice(1).map(r => ({ name: clean(r[ix.name]), type: ix.type != null ? typeOf(r[ix.type]) : '', phone: phoneNorm(ix.phone != null ? r[ix.phone] : ''), tax: normDigits(clean(ix.tax != null ? r[ix.tax] : '')).replace(/\D/g, ''), city: clean(ix.city != null ? r[ix.city] : ''), email: clean(ix.email != null ? r[ix.email] : ''), cat: clean(ix.cat != null ? r[ix.cat] : '') })).filter(r => r.name);
}

export function ContactsImport({ partners, commitOrg, say, onClose }) {
  const [rows, setRows] = useState(null); const [defType, setDefType] = useState('customer');
  const exists = (r) => partners.some(p => (p.name || '').trim() === r.name.trim() || (r.phone && phoneNorm(p.phone) === r.phone));
  const load = (list) => { if (!list.length) return say('لم يُعثر على جهات اتصال في الملف', 'no'); setRows(list.map(r => ({ ...r, type: r.type || '', pick: !exists(r), dup: exists(r) }))); };
  const pickFile = async (file) => {
    try {
      if (/\.vcf$/i.test(file.name) || /vcard/i.test(file.type)) return load(parseVcf(await file.text()));
      const grid = /\.xlsx$/i.test(file.name) ? await parseXlsxGrid(await file.arrayBuffer()) : parseCsvGrid(await file.text());
      load(rowsFromGrid(grid));
    } catch (e) { console.warn(e); say('تعذّرت قراءة الملف', 'no'); }
  };
  const canPhone = typeof navigator !== 'undefined' && navigator.contacts && typeof navigator.contacts.select === 'function';
  const fromPhone = async () => { try { const cs = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true }); load((cs || []).map(c => ({ name: clean((c.name || [])[0]), phone: phoneNorm((c.tel || [])[0]), mobile2: phoneNorm((c.tel || [])[1]), email: clean((c.email || [])[0]) })).filter(r => r.name || r.phone).map(r => ({ ...r, name: r.name || r.phone }))); } catch (e) { console.warn(e); } };
  const template = () => { try { const blob = makeXlsx([{ name: 'جهات الاتصال', rows: [['الاسم', 'النوع (عميل/مورد)', 'الجوال', 'الرقم الضريبي', 'المدينة', 'البريد', 'التصنيف'], ['مؤسسة مثال', 'مورد', '0500000000', '', 'الرياض', '', 'لحوم']] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'نموذج_جهات_الاتصال.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch { } };
  const save = async () => {
    const sel = (rows || []).filter(r => r.pick); if (!sel.length) return say('اختر جهة واحدة على الأقل', 'no');
    let n = 0;
    const ok = await commitOrg(d => {
      const all = [...partners]; const sups = [...(d.suppliers || [])], pts = [...(d.partners || [])];
      sel.forEach(r => { const t = r.type || defType; const code = nextPartnerCode(all, t); n++;
        if (t === 'supplier') { const id = uid('sp'); const rec = { id, code, name: r.name, category: r.cat || r.org || '', phone: r.phone || '', vatNo: r.tax || '', address: '', taxable: !!r.tax, terms: 0, mobile2: r.mobile2 || '', email: r.email || '', city: r.city || '', iban: '' }; sups.push(rec); all.push({ ...rec, type: 'supplier' }); }
        else { const id = uid('pt'); const rec = { id, key: 'cust:' + id, code, name: r.name, type: 'customer', cat: r.cat || r.org || '', phone: r.phone || '', tax: r.tax || '', vatNo: r.tax || '', address: '', taxable: !!r.tax, terms: 0, mobile2: r.mobile2 || '', email: r.email || '', city: r.city || '' }; pts.push(rec); all.push(rec); } });
      return { ...d, suppliers: sups, partners: pts };
    }, { actionType: 'create', targetType: 'partner', targetId: 'import', title: 'استورد جهات اتصال', details: sel.length + ' جهة' });
    if (ok !== false) { say('اُستوردت ' + n + ' جهة اتصال ✓'); onClose(); }
  };
  return (
    <Modal title="استيراد جهات الاتصال" icon={Upload} onClose={onClose} wide
      foot={<><button className="btn gh" onClick={onClose}>إلغاء</button>{rows && <button className="btn pri" data-cimpsave onClick={save}><Check size={14} />استيراد المحدد ({(rows || []).filter(r => r.pick).length})</button>}</>}>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <label className="btn sm pri" style={{ cursor: 'pointer' }}><Upload size={13} />ملف Excel / CSV / vCard<input type="file" accept=".xlsx,.csv,.vcf,text/csv,text/vcard" style={{ display: 'none' }} data-cimpfile onChange={e => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (fl) pickFile(fl); }} /></label>
        {canPhone && <button className="btn sm" onClick={fromPhone}><Smartphone size={13} />من جهات الجوال</button>}
        <button className="btn sm gh" onClick={template}><Download size={13} />نموذج Excel</button>
      </div>
      <div className="note" style={{ fontSize: 11 }}>من الجوال: صدّر جهات الاتصال بملف <b>.vcf</b> (آيفون: جهات الاتصال ← اختيار ← تصدير · أندرويد: جهات الاتصال ← تصدير) ثم ارفعه هنا{canPhone ? '، أو اختر مباشرة بزر «من جهات الجوال»' : ''}.</div>
      {rows && <>
        <div className="row" style={{ gap: 8, margin: '10px 0', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12 }}>النوع لما لم يُحدَّد:</span>
          {[['customer', 'عميل'], ['supplier', 'مورد']].map(([k, t]) => <button key={k} className={'btn sm' + (defType === k ? ' pri' : ' gh')} onClick={() => setDefType(k)}>{t}</button>)}
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>{rows.length} جهة · المكررة غير محددة</span>
        </div>
        <div className="tw"><table className="tb" data-cimprows>
          <thead><tr><th /><th>الاسم</th><th>النوع</th><th>الجوال</th><th>الرقم الضريبي</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} style={{ opacity: r.pick ? 1 : 0.55 }}>
            <td><input type="checkbox" checked={!!r.pick} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, pick: e.target.checked } : x))} /></td>
            <td style={{ fontSize: 12 }}>{r.name}{r.dup && <span className="badge b-amber" style={{ marginInlineStart: 6, fontSize: 9 }}>موجود</span>}</td>
            <td><select className="sel" style={{ minWidth: 90 }} value={r.type || ''} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}><option value="">{defType === 'supplier' ? 'مورد' : 'عميل'} (افتراضي)</option><option value="customer">عميل</option><option value="supplier">مورد</option></select></td>
            <td className="num" style={{ fontSize: 11.5 }}>{r.phone}</td><td className="num" style={{ fontSize: 11.5 }}>{r.tax || ''}</td></tr>)}</tbody>
        </table></div>
      </>}
    </Modal>);
}
