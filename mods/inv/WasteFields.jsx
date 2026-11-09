/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React from 'react';
import { Camera, X } from 'lucide-react';
import { Field, WASTE_REASONS, compressImage, money } from '../../App.jsx';

export function WasteFields({ f, setF, value, cfg, me, say }) {
  const pick = async (e) => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (!fl) return;
    try { setF(x => ({ ...x, photo: '' })); const u = await compressImage(fl, 640, 0.5); setF(x => ({ ...x, photo: u })); } catch { say && say('تعذّر قراءة الصورة', 'no'); } };
  const needPhoto = value >= cfg.photoOver && cfg.photoOver > 0;
  const needAppr = value >= cfg.approveOver && cfg.approveOver > 0;
  return (
    <div className="grid" style={{ gap: 8 }}>
      <Field label="سبب الهدر (إلزامي)">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{Object.entries(WASTE_REASONS).map(([k, v]) => <button key={k} type="button" className={'btn sm' + (f.reason === k ? ' pri' : ' gh')} onClick={() => setF(x => ({ ...x, reason: k }))}>{v}</button>)}</div>
      </Field>
      <Field label={f.reason === 'other' ? 'وصف السبب (إلزامي)' : 'تفاصيل (اختياري)'}><input className="inp" value={f.note || ''} onChange={e => setF(x => ({ ...x, note: e.target.value }))} placeholder="مثال: تعطل ثلاجة التبريد ليلًا" /></Field>
      <div className="wst-box">
        <span>قيمة الهدر <b className="num">{money(value)}</b></span>
        {needAppr ? <span className="badge b-amber">فوق {money(cfg.approveOver)} — يُرسل للاعتماد ولا يُخصم قبله</span> : <span className="badge b-dim">يُرحّل مباشرة</span>}
        <label className={'btn sm' + (needPhoto && !f.photo ? ' pri' : ' gh')} style={{ cursor: 'pointer' }}><Camera size={13} />{f.photo ? 'تغيير الصورة' : needPhoto ? 'صورة التالف (إلزامية)' : 'صورة (اختياري)'}
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={pick} /></label>
        {f.photo && <img src={f.photo} alt="" className="wst-thumb" />}
        {f.photo && <button type="button" className="btn sm gh" onClick={() => setF(x => ({ ...x, photo: '' }))}><X size={12} /></button>}
      </div>
    </div>);
}
