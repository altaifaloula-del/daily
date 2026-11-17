/* v46.5 — السندات المخزنية: توريد، صرف، إتلاف، تسوية، رصيد افتتاحي (يدوي أو من Excel) لأي مستودع،
   وقائمة كل السندات (مع سندات التحويل) بالطباعة A4 والتصدير إلى Excel. رقم السند يُمنح عند الحفظ (assignVouchers). */
import React, { useMemo, useState } from 'react';
import { FileText, Plus, Printer, Download, Upload, X, Check } from 'lucide-react';
import { VCH_T, VCH_TRF, voucherList, voucherHtml, ItemPick, Field, Modal, MAIN_WH, WasteFields, itemAvgCosts, isStocked, makeXlsx, nowISO, printA4, parseXlsxGrid, parseCsvGrid,
  saleDeductOn, saleRecipeItems, stockByWh, submitWaste, today, uid, wasteCfg, whName, whOf, whOn, normDigits } from '../../App.jsx';

const q3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const NEW_TYPES = ['rcv', 'iss', 'wst', 'adj', 'opn'];

export function StockVouchers({ org, ops, me, commit, say, fixedWh, canCreate = true }) {
  const items = (org.items || []).filter(it => it.isActive !== false && isStocked(it));
  const whs = whOn(org) ? whOf(org) : [{ id: MAIN_WH, name: 'المستودع الرئيسي' }];
  const [whId, setWhId] = useState(fixedWh || ''); const [type, setType] = useState('');
  const d30 = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
  const [from, setFrom] = useState(d30); const [to, setTo] = useState(today());
  const list = useMemo(() => voucherList(org, ops, { whId: fixedWh || whId, type, from, to }), [org, ops, fixedWh, whId, type, from, to]);
  const [vf, setVf] = useState(null);
  const AVG = useMemo(() => itemAvgCosts(org, ops), [org, ops]);
  const SB = useMemo(() => stockByWh(org, ops), [org, ops]);
  const balOf = (w, id) => (((SB.byWh || {})[w] || {})[id]) || 0;
  const tAr = (t) => t === 'trf' ? VCH_TRF.ar : (VCH_T[t] || {}).ar || t;

  const print = (v) => printA4(org, tAr(v.type) + ' — ' + v.no, '', voucherHtml(org, v));
  const xlsx = () => {
    const rows = [['رقم السند', 'النوع', 'التاريخ', 'المستودع', 'إلى', 'الصنف', 'الوحدة', 'الكمية', 'التكلفة', 'أعدّه', 'ملاحظة']];
    list.forEach(v => v.lines.forEach(l => rows.push([v.no, tAr(v.type), v.date, whName(org, v.wh), v.toWh ? whName(org, v.toWh) : '', l.name, l.unit, q3(l.qty), l.unitCost != null ? l.unitCost : '', v.by, v.note])));
    try { const blob = makeXlsx([{ name: 'السندات المخزنية', rows }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'السندات_المخزنية.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch (e) { console.warn(e); }
  };

  const newV = (t) => setVf({ type: t || 'rcv', whId: fixedWh || whId || (whs[0] || {}).id || MAIN_WH, date: today(), note: '', lines: [{ itemId: '', qty: '', cost: '', dir: '+' }] });
  const setLine = (i, k, v) => setVf(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, [k]: v } : l) }));
  // استيراد بنود من Excel: الصنف (اسم/رمز/باركود)، الكمية، التكلفة
  const importLines = async (file) => {
    try {
      const grid = /\.xlsx$/i.test(file.name) ? await parseXlsxGrid(await file.arrayBuffer()) : parseCsvGrid(await file.text()); const find = (v) => { const s = normDigits(String(v || '')).trim(); if (!s) return null; return items.find(it => it.code === s || String(it.barcode || '') === s || it.name === s) || items.find(it => it.name.trim() === s.trim()); };
      const lines = [], miss = [];
      grid.slice(1).forEach(r => { if (!r || !r.length) return; const it = find(r[0]); const q = Number(normDigits(String(r[1] || '')).replace(/[^\d.-]/g, '')) || 0; if (!it) { if (String(r[0] || '').trim()) miss.push(String(r[0]).trim()); return; } if (!q) return; lines.push({ itemId: it.id, qty: String(Math.abs(q)), cost: r[2] != null && r[2] !== '' ? String(Number(normDigits(String(r[2])).replace(/[^\d.]/g, '')) || '') : '', dir: q < 0 ? '-' : '+' }); });
      if (!lines.length) return say('لم يُعثر على بنود صالحة — العمود الأول الصنف (اسم/رمز/باركود)، الثاني الكمية، الثالث التكلفة', 'no');
      setVf(f => ({ ...f, lines })); say('اُستورد ' + lines.length + ' بند' + (miss.length ? ' · غير معروف: ' + miss.slice(0, 5).join('، ') + (miss.length > 5 ? '…' : '') : ' ✓'), miss.length ? 'no' : undefined);
    } catch (e) { console.warn(e); say('تعذّرت قراءة الملف', 'no'); }
  };
  const template = () => { try { const blob = makeXlsx([{ name: 'البنود', rows: [['الصنف (الاسم أو الرمز أو الباركود)', 'الكمية', 'التكلفة للوحدة'], ...items.slice(0, 3).map(it => [it.code || it.name, '', ''])] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'نموذج_بنود_سند.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch { } };

  const save = async () => {
    const f = vf; const w = whs.find(x => x.id === f.whId) || { id: MAIN_WH }; const main = !whOn(org) || f.whId === MAIN_WH;
    const lines = f.lines.filter(l => l.itemId && Number(l.qty) > 0).map(l => ({ ...l, q: q3(l.qty) }));
    if (!lines.length) return say('أضف صنفًا وكمية', 'no');
    if (new Set(lines.map(l => l.itemId)).size !== lines.length) return say('الصنف مكرر في السند — اجمعه في بند واحد', 'no');
    const itN = (id) => (items.find(x => x.id === id) || {}).name || 'صنف';
    if (f.type === 'iss' && saleDeductOn(org, f.date)) { const R = saleRecipeItems(org); const bad = lines.find(l => R.has(l.itemId)); if (bad) return say('«' + itN(bad.itemId) + '» يُخصم تلقائيًا مع كل فاتورة بيع — لا يُصرف يدويًا. للتالف استخدم سند الإتلاف', 'no'); }
    const out = lines.filter(l => f.type === 'iss' || f.type === 'wst' || (f.type === 'adj' && l.dir === '-'));
    const over = out.find(l => l.q > balOf(f.whId, l.itemId) + 0.0005);
    if (over) return say('الكمية تتجاوز رصيد المستودع: ' + itN(over.itemId) + ' (المتاح ' + q3(balOf(f.whId, over.itemId)) + ')', 'no');
    if (f.type === 'adj' && !String(f.note || '').trim()) return say('اكتب سبب التسوية في الملاحظة', 'no');
    if (f.type === 'opn') { const has = lines.filter(l => [...(ops.stockMoves || []), ...(ops.whMoves || [])].some(m => m.itemId === l.itemId && (main ? (m.whId || MAIN_WH) === MAIN_WH && (ops.stockMoves || []).includes(m) : m.whId === f.whId)));
      if (has.length && !window.confirm('أصناف لها حركات سابقة في هذا المستودع: ' + has.slice(0, 5).map(l => itN(l.itemId)).join('، ') + '\nالرصيد الافتتاحي يُضاف فوق رصيدها الحالي. متابعة؟')) return; }
    const col = main ? 'stockMoves' : 'whMoves';
    if (f.type === 'wst') {
      const ok = await submitWaste({ org, me, commit, say, col, whId: main ? (whOn(org) ? MAIN_WH : '') : w.id, branchId: main ? '' : w.branchId, lines: lines.map(l => ({ itemId: l.itemId, qty: l.q })), f, avg: AVG, title: whName(org, f.whId) });
      if (ok) setVf(null); return;
    }
    const kind = f.type === 'iss' ? 'out' : f.type === 'adj' ? 'adjust' : 'in';
    const recs = lines.map(l => {
      const sign = f.type === 'iss' || (f.type === 'adj' && l.dir === '-') ? -1 : 1; const c = Number(l.cost);
      return { id: uid(main ? 'sm' : 'wm'), date: f.date || today(), itemId: l.itemId, kind, qty: sign * l.q, note: (f.type === 'opn' ? 'رصيد افتتاحي' : '') + (f.note ? (f.type === 'opn' ? ' — ' : '') + f.note : ''), by: me.name, at: nowISO(),
        ...((f.type === 'rcv' || f.type === 'opn') && l.cost !== '' && c >= 0 ? { unitCost: c } : {}), ...(f.type === 'opn' ? { opening: true } : {}),
        ...(main ? (whOn(org) ? { whId: MAIN_WH } : {}) : { whId: w.id, branchId: w.branchId }) };
    });
    const ok = await commit(d => ({ ...d, [col]: [...recs, ...(d[col] || [])] }), { actionType: 'create', targetType: 'stock_move', targetId: recs[0].id, title: 'أصدر ' + VCH_T[f.type].ar, details: whName(org, f.whId) + ' · ' + recs.length + ' بند' + (f.note ? ' · ' + f.note : '') });
    if (ok === false) return;
    setVf(null); say('سُجّل ' + VCH_T[f.type].ar + ' ✓');
  };

  return (
    <div className="card" data-vouchers>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'flex-end' }}>
        <div className="card-t" style={{ margin: 0, flex: '1 1 160px' }}><FileText size={15} color="var(--brass)" />السندات المخزنية</div>
        {canCreate && <button className="btn sm pri" data-newvoucher onClick={() => newV('rcv')}><Plus size={14} />سند جديد</button>}
        <button className="btn sm" onClick={xlsx}><Download size={13} />Excel</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
        {!fixedWh && <Field label="المستودع"><select className="sel" aria-label="مستودع السندات" value={whId} onChange={e => setWhId(e.target.value)}><option value="">كل المستودعات</option>{whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
        <Field label="نوع السند"><select className="sel" aria-label="نوع السند" value={type} onChange={e => setType(e.target.value)}><option value="">كل الأنواع</option>{[...NEW_TYPES, 'prd'].map(t => <option key={t} value={t}>{VCH_T[t].ar}</option>)}<option value="trf">{VCH_TRF.ar}</option></select></Field>
        <Field label="من"><input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="إلى"><input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>
      <div className="tw">
        <table className="tb" data-vlist>
          <thead><tr><th>رقم السند</th><th>النوع</th><th>التاريخ</th><th>المستودع</th><th style={{ textAlign: 'end' }}>البنود</th><th>أعدّه</th><th /></tr></thead>
          <tbody>
            {list.map(v => (
              <tr key={v.type + v.no}>
                <td className="num" style={{ fontSize: 11.5, fontWeight: 700 }}>{v.no}</td>
                <td><span className={'badge ' + (v.type === 'wst' ? 'b-rose' : v.type === 'iss' ? 'b-sky' : v.type === 'adj' ? 'b-amber' : v.type === 'trf' ? 'b-violet' : 'b-mint')}>{tAr(v.type)}</span></td>
                <td className="num" style={{ fontSize: 11.5 }}>{v.date}</td>
                <td style={{ fontSize: 11.5 }}>{whName(org, v.wh)}{v.toWh ? ' ← ' + whName(org, v.toWh) : ''}</td>
                <td className="num" style={{ textAlign: 'end' }}>{v.lines.length}</td>
                <td style={{ fontSize: 11 }}>{v.by}</td>
                <td><button className="btn sm gh" data-vprint onClick={() => print(v)}><Printer size={13} />طباعة</button></td>
              </tr>))}
            {!list.length && <tr><td colSpan={7}><div className="empty">لا سندات في هذه الفترة — السندات تُرقَّم تلقائيًا لكل حركة جديدة</div></td></tr>}
          </tbody>
        </table>
      </div>

      {vf && (
        <Modal title={'سند جديد — ' + VCH_T[vf.type].ar} icon={FileText} onClose={() => setVf(null)} wide
          foot={<><button className="btn gh" onClick={() => setVf(null)}>إلغاء</button><button className="btn pri" data-vsave onClick={save}><Check size={14} />حفظ السند</button></>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 6, marginBottom: 10 }}>
            {NEW_TYPES.map(t => <button key={t} className={'btn sm' + (vf.type === t ? ' pri' : ' gh')} data-vtype={t} onClick={() => setVf(f => ({ ...f, type: t }))}>{VCH_T[t].ar}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <Field label="المستودع"><select className="sel" aria-label="مستودع السند" value={vf.whId} disabled={!!fixedWh} onChange={e => setVf(f => ({ ...f, whId: e.target.value }))}>{whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
            <Field label="التاريخ"><input type="date" className="inp" value={vf.date} onChange={e => setVf(f => ({ ...f, date: e.target.value }))} /></Field>
            <Field label={vf.type === 'adj' ? 'سبب التسوية *' : 'ملاحظة'}><input className="inp" aria-label="ملاحظة السند" value={vf.note} onChange={e => setVf(f => ({ ...f, note: e.target.value }))} /></Field>
          </div>
          {(vf.type === 'rcv' || vf.type === 'opn') && <div className="row" style={{ gap: 6, margin: '6px 0', flexWrap: 'wrap' }}>
            <label className="btn sm" style={{ cursor: 'pointer' }}><Upload size={13} />استيراد البنود من Excel<input type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} data-vimport onChange={e => { const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (fl) importLines(fl); }} /></label>
            <button className="btn sm gh" onClick={template}><Download size={13} />نموذج</button>
          </div>}
          <div className="lbl" style={{ margin: '8px 0 6px' }}>البنود</div>
          {vf.lines.map((l, i) => { const it = items.find(x => x.id === l.itemId); return (
            <div key={i} className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }} data-vline>
              <ItemPick items={items} label={'صنف السند ' + (i + 1)} value={l.itemId} onChange={id => setLine(i, 'itemId', id)} />
              {vf.type === 'adj' && <select className="sel" style={{ width: 110 }} aria-label={'اتجاه التسوية ' + (i + 1)} value={l.dir} onChange={e => setLine(i, 'dir', e.target.value)}><option value="+">زيادة +</option><option value="-">نقص −</option></select>}
              <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder={'الكمية' + (it ? ' (' + it.unit + ')' : '')} aria-label={'كمية السند ' + (i + 1)} value={l.qty} onChange={e => setLine(i, 'qty', e.target.value.replace(/[^\d.]/g, ''))} />
              {(vf.type === 'rcv' || vf.type === 'opn') && <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder="التكلفة للوحدة" aria-label={'تكلفة السند ' + (i + 1)} value={l.cost} onChange={e => setLine(i, 'cost', e.target.value.replace(/[^\d.]/g, ''))} />}
              {it && <span className="badge b-dim">الرصيد {q3(balOf(vf.whId, it.id))}</span>}
              {vf.lines.length > 1 && <button className="btn sm gh" onClick={() => setVf(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}><X size={13} /></button>}
            </div>); })}
          <button className="btn sm gh" onClick={() => setVf(f => ({ ...f, lines: [...f.lines, { itemId: '', qty: '', cost: '', dir: '+' }] }))}><Plus size={13} />بند آخر</button>
          {vf.type === 'wst' && <div style={{ marginTop: 10 }}><WasteFields f={vf} setF={setVf} cfg={wasteCfg(org)} me={me} say={say} value={Math.round(vf.lines.filter(l => l.itemId).reduce((a, l) => a + (Number(l.qty) || 0) * (AVG[l.itemId] || 0), 0) * 100) / 100} /></div>}
          {vf.type === 'opn' && <div className="note" style={{ marginTop: 8, fontSize: 11 }}>الرصيد الافتتاحي يُضاف للمستودع المختار بتكلفته — أدخل التكلفة ليُحسب متوسط الصنف وقيمة المخزون.</div>}
        </Modal>
      )}
    </div>);
}
