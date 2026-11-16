/* v44.5 — «التحضير اليومي»: كل دفعة تحضير تُسجَّل بملصق باركود (Code128) عليه تاريخ ووقت الإنتاج والانتهاء،
   ويمسحه المطبخ بالقارئ (يعمل كلوحة مفاتيح: الرمز ثم Enter) لعرض الحالة، أو تسجيل الاستخدام، أو الإتلاف.
   قرارات المالك: يسجّلها مطبخ الفرع · الانتهاء آليًا من مدة صلاحية التحضيرة (يحددها المركز) · ملصق 50×30 مم.
   الإتلاف: التحضيرة المخزّنة صنفًا تُخصم هدرًا من مستودع الفرع بمسار الهدر الحالي (واعتماده)، وغيرها يُوثَّق على الدفعة. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Printer, Check, Trash2, Plus, ChefHat, QrCode, PenLine, List, ClipboardList, X, BarChart3 } from 'lucide-react';
import { prepWasteStats, itemAvgCosts, printA4, money, arDate, ROLES, normScan, Field, Kpi, Modal, PREP_ST, WASTE_REASONS, nowISO, prepBatchState, prepItemOf, prepShelfH, q3, submitWaste, today, uid, whName } from '../../App.jsx';

const pad = (n) => String(n).padStart(2, '0');
export const fmtDT = (iso) => { const d = new Date(iso); if (isNaN(d)) return '—'; return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const toLocalInp = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtLeft = (ms) => { if (ms <= 0) return 'منتهٍ'; const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h >= 48 ? Math.floor(h / 24) + ' يوم' : h > 0 ? h + ' س ' + m + ' د' : m + ' د'; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const newCode = () => 'P' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 6).toUpperCase();

/** v44.8 — طريقة الإدخال عند المسح: قارئ الباركود يكتب الرمز كاملًا خلال أجزاء من الثانية ثم Enter، والكتابة اليدوية أبطأ.
 *  الحكم: 4 أحرف فأكثر بوسيط فاصل بين المفاتيح ≤ 35 مللي ثانية ⇒ قارئ؛ اللصق أو الأبطأ ⇒ يدوي. */
export function scanVia(times, pasted) {
  if (pasted || !Array.isArray(times) || times.length < 4) return 'manual';
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] <= 35 ? 'scan' : 'manual';
}
// v44.8 — أيقونة لكل طريقة: رمز QR للقارئ، وقلم للإدخال اليدوي، وقائمة للإجراء من جدول الرف
export const VIA = { scan: ['b-mint', 'قارئ باركود', QrCode], manual: ['b-amber', 'إدخال يدوي', PenLine], list: ['b-dim', 'من القائمة', List] };
const viaBadge = (v, attr) => { if (!v || !VIA[v]) return null; const [c, t, Ic] = VIA[v];
  return <span className={'badge ' + c} data-pbvia={attr || v} title={t} style={{ marginInlineStart: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Ic size={13} aria-hidden="true" />{t}</span>; };

const CNT_WHY = { unknown: 'ملصق غير معروف', other: 'من فرع آخر', used: 'مسجّل «استُخدم» وما زال على الرف', discarded: 'مسجّل «أُتلف» وما زال على الرف' };
/** v44.5 — مقاسات الملصق: ورق حراري بمقاسات شائعة، أو ورقة A4 بـ 24 ملصقًا (3×8). الخطوط والباركود تتناسب مع المقاس */
export const LABEL_SIZES = [
  { id: '50x30', ar: '50×30 مم (الافتراضي)', w: 50, h: 30 },
  { id: '40x25', ar: '40×25 مم (صغير)', w: 40, h: 25 },
  { id: '58x40', ar: '58×40 مم', w: 58, h: 40 },
  { id: '60x40', ar: '60×40 مم', w: 60, h: 40 },
  { id: '70x50', ar: '70×50 مم', w: 70, h: 50 },
  { id: '100x50', ar: '100×50 مم (كبير)', w: 100, h: 50 },
  { id: 'a4', ar: 'ورقة A4 — 24 ملصقًا (70×37 مم)', w: 70, h: 37.125, sheet: true }
];
const SIZE_KEY = 'rms8:prepLabelSize';
export const savedLabelSize = () => { try { const v = localStorage.getItem(SIZE_KEY); return LABEL_SIZES.some(z => z.id === v) ? v : '50x30'; } catch { return '50x30'; } };
const keepLabelSize = (id) => { try { localStorage.setItem(SIZE_KEY, id); } catch { } };
export const labelCss = (z) => {
  const k = Math.min(z.w / 50, z.h / 30), f = (n) => Math.round(n * k * 10) / 10;
  return `@page{size:${z.sheet ? 'A4' : z.w + 'mm ' + z.h + 'mm'};margin:0} *{box-sizing:border-box} body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#000}
    ${z.sheet ? '.sheet{display:grid;grid-template-columns:repeat(3,70mm);grid-auto-rows:37.125mm;width:210mm}.sheet .lb{page-break-after:auto;break-inside:avoid}' : ''}
    .lb{width:${z.w}mm;height:${z.h}mm;padding:${f(1.4)}mm ${f(2)}mm;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;gap:${f(.6)}mm}
    .t{display:flex;justify-content:space-between;gap:2mm;font-size:${f(9)}pt}.t b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .d{display:flex;flex-direction:column;font-size:${f(7)}pt;line-height:1.25}.bc{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.bc svg{max-width:100%;height:${f(13)}mm}`;
};

/** ملصقات التحضير بالمقاس المختار — نسخة لكل حاوية */
export async function labelDoc(batches, copies, show, sizeId) {
  const sh = { made: true, exp: true, by: true, ...(show || {}) };
  const z = (sizeId && typeof sizeId === 'object') ? sizeId : (LABEL_SIZES.find(x => x.id === sizeId) || LABEL_SIZES[0]);
  const { default: JsBarcode } = await import('jsbarcode');
  const svgOf = (code) => { const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(el, code, { format: 'CODE128', width: 1.5, height: 34, displayValue: true, fontSize: 11, margin: 0, textMargin: 1 }); return el.outerHTML; };
  const one = (b) => `<div class="lb"><div class="t"><b>${esc(b.name)}</b><span>${esc(q3(b.qty))} ${esc(b.unit)}</span></div>
    <div class="d">${sh.made ? `<span>إنتاج: <b dir="ltr">${esc(fmtDT(b.madeAt))}</b></span>` : ''}${sh.exp ? `<span>انتهاء: <b dir="ltr">${esc(fmtDT(b.expAt))}</b></span>` : ''}${sh.by && b.by ? `<span>أعدّه: <b>${esc(b.by)}</b></span>` : ''}</div><div class="bc">${svgOf(b.code)}</div></div>`;
  const html = batches.flatMap(b => Array.from({ length: Math.max(1, Math.min(50, Number(copies) || 1)) }, () => one(b))).join('');
  return { z, doc: `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ملصقات التحضير</title><style>${labelCss(z)}</style></head><body data-size="${z.id}">${z.sheet ? '<div class="sheet">' + html + '</div>' : html}` };
}
export async function printPrepLabels(batches, copies, say, show, sizeId) {
  const { z, doc } = await labelDoc(batches, copies, show, sizeId); keepLabelSize(z.id);
  const w = window.open('', '_blank', 'width=' + (z.sheet ? 820 : 420) + ',height=' + (z.sheet ? 900 : 360)); if (!w) { say && say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); return false; }
  w.document.write(doc + '<script>window.onload=function(){window.print();}</script></body></html>');
  w.document.close(); return true;
}

/** معاينة حيّة للملصق بالمقاس المختار (ملصق واحد) */
function LabelPreview({ b, show, size }) {
  const [doc, setDoc] = useState(''); const z = LABEL_SIZES.find(x => x.id === size) || LABEL_SIZES[0];
  useEffect(() => { let on = true; labelDoc([b], 1, show, z.sheet ? { ...z, sheet: false } : z).then(r => { if (on) setDoc(r.doc + '</body></html>'); }); return () => { on = false; }; }, [b.by, show.by, b.code, b.madeAt, b.expAt, show.made, show.exp, size]); // eslint-disable-line
  const wPx = Math.round(z.w * 3.78), hPx = Math.round(z.h * 3.78), sc = Math.min(1.6, 300 / wPx);
  return (<div style={{ margin: '4px 0 10px' }} data-lbpreview={z.id}>
    <div className="lbl" style={{ marginBottom: 4 }}>معاينة الملصق{z.sheet ? ' (ملصق واحد من الورقة)' : ''}</div>
    <div style={{ width: wPx * sc, height: hPx * sc, border: '1px dashed var(--line)', borderRadius: 4, background: '#fff', overflow: 'hidden', direction: 'ltr' }}>
      {doc && <iframe title="معاينة الملصق" srcDoc={doc} style={{ width: wPx, height: hPx, maxWidth: 'none', border: 0, transform: 'scale(' + sc + ')', transformOrigin: '0 0', pointerEvents: 'none' }} />}
    </div></div>);
}

export function PrepBatches({ org, ops, me, commit, say, whId, branchId, canAct }) {
  const preps = (org.preps || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const all = useMemo(() => (ops.prepBatches || []).filter(b => b.branchId === branchId), [ops.prepBatches, branchId]);
  const withSt = all.map(b => ({ ...b, S: prepBatchState(b, now) }));
  const shelf = withSt.filter(b => !['used', 'discarded'].includes(b.S.st)).sort((a, b) => String(a.expAt).localeCompare(String(b.expAt)));
  const td = today();
  const doneToday = withSt.filter(b => ['used', 'discarded'].includes(b.status) && String(b.status === 'used' ? b.usedAt : b.discardAt).slice(0, 10) === td);
  const [f, setF] = useState({ prepId: '', qty: '', copies: '1' });
  const [code, setCode] = useState('');
  const [hit, setHit] = useState(null);       // نتيجة المسح
  const [disc, setDisc] = useState(null);     // نموذج الإتلاف
  const [pv, setPv] = useState(null);         // معاينة الملصق قبل الطباعة: تاريخا الإنتاج والانتهاء (تعديل وإظهار)
  const scanRef = useRef(null);
  const focusScan = () => setTimeout(() => scanRef.current && scanRef.current.focus(), 30);
  const prepOf = (id) => preps.find(p => p.id === id) || {};

  const create = async () => {
    if (!canAct) return say('للعرض فقط', 'no');
    const p = prepOf(f.prepId); if (!p.id) return say('اختر التحضيرة', 'no');
    const qty = q3(f.qty); if (!(qty > 0)) return say('أدخل الكمية المحضّرة', 'no');
    const h = prepShelfH(org, p.id); if (!(h > 0)) return say('مدة صلاحية «' + p.name + '» غير محددة — يحددها المركز من بطاقة التحضيرة', 'no');
    const t0 = Date.now();
    setPv({ isNew: true, prepId: p.id, name: p.name, unit: p.unit || '', qty, h, copies: f.copies, made: toLocalInp(t0), exp: toLocalInp(t0 + h * 3600000), showMade: true, showExp: true, showBy: true, size: savedLabelSize() });
  };
  // v44.5 — قبل الطباعة: معاينة بتاريخي الإنتاج والانتهاء — تعديلهما وخيار إظهار كل منهما على الملصق
  const savePv = async () => {
    const v = pv; const mk = new Date(v.made), ex = new Date(v.exp);
    if (isNaN(mk) || isNaN(ex)) return say('أدخل تاريخ ووقت الإنتاج والانتهاء', 'no');
    if (!(ex > mk)) return say('الانتهاء يجب أن يكون بعد الإنتاج', 'no');
    if (!v.isNew) { setPv(null); return printPrepLabels([v.b], v.copies, say, { made: v.showMade, exp: v.showExp, by: v.showBy }, v.size); }
    if (mk.getTime() > Date.now() + 5 * 60000) return say('وقت الإنتاج في المستقبل', 'no');
    if (ex.getTime() - mk.getTime() > v.h * 3600000 + 60000) return say('الانتهاء يتجاوز مدة صلاحية التحضيرة (' + v.h + ' ساعة من الإنتاج) — لا يُمدَّد', 'no');
    const p = { id: v.prepId, name: v.name, unit: v.unit }; const qty = v.qty, h = v.h;
    const rec = { id: uid('pb'), code: newCode(), branchId, whId: whId || '', prepId: p.id, name: p.name, unit: p.unit || '', qty, shelfH: h, madeAt: mk.toISOString(), expAt: ex.toISOString(), status: 'shelf', by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, prepBatches: [rec, ...(d.prepBatches || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: rec.id, branchName: whName(org, whId), title: 'تحضير يومي — ' + p.name, details: rec.code + ' · ' + qty + ' ' + rec.unit + ' · ينتهي ' + fmtDT(rec.expAt) });
    if (!ok) return;
    setF({ prepId: f.prepId, qty: '', copies: f.copies }); setPv(null);
    say('سُجّلت الدفعة ' + rec.code + ' — تنتهي ' + fmtDT(rec.expAt) + ' ✓');
    printPrepLabels([rec], v.copies, say, { made: v.showMade, exp: v.showExp, by: v.showBy }, v.size);
  };
  const keyT = useRef([]), pasted = useRef(false);
  const onScanKey = (e) => { if (e.key && e.key.length === 1) keyT.current.push(performance.now()); };
  // v45.0 — جرد رف التحضير بالمسح: تُمسح كل الملصقات الموجودة فعلًا ثم يُقارن بالمسجّل على الرف
  const [cnt, setCnt] = useState(null);   // { startAt, seen: [{code, id?, via, at}] }
  const cntRes = cnt ? (() => {
    const seenIds = new Set(cnt.seen.filter(x => x.id).map(x => x.id));
    return { found: shelf.filter(b => seenIds.has(b.id)), missing: shelf.filter(b => !seenIds.has(b.id)),
      expired: shelf.filter(b => seenIds.has(b.id) && b.S.st === 'expired'), extra: cnt.seen.filter(x => !x.id || !shelf.some(b => b.id === x.id)) };
  })() : null;
  const finishCnt = async () => {
    if (!canAct) return say('للعرض فقط', 'no');
    const R = cntRes; if (!cnt.seen.length) return say('امسح ملصقات الرف أولًا', 'no');
    const rec = { id: uid('pc'), branchId, whId: whId || '', startAt: cnt.startAt, at: nowISO(), by: me.name, shelf: shelf.length,
      found: R.found.map(b => b.code), missing: R.missing.map(b => b.code), expired: R.expired.map(b => b.code), extra: R.extra.map(x => ({ code: x.code, why: x.why })),
      viaScan: cnt.seen.filter(x => x.via === 'scan').length, viaManual: cnt.seen.filter(x => x.via !== 'scan').length };
    const ok = await commit(d => ({ ...d, prepCounts: [rec, ...(d.prepCounts || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: rec.id, branchName: whName(org, whId), title: 'جرد رف التحضير', details: 'موجود ' + rec.found.length + ' من ' + rec.shelf + ' · مفقود ' + rec.missing.length + ' · منتهٍ ' + rec.expired.length + ' · غير متوقع ' + rec.extra.length });
    if (ok) { setCnt(null); say('حُفظ جرد الرف — ' + (rec.missing.length || rec.expired.length || rec.extra.length ? 'توجد فروقات تحتاج إجراء' : 'مطابق ✓')); }
  };
  const counts = (ops.prepCounts || []).filter(r => r.branchId === branchId).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const scan = (e) => {
    e.preventDefault(); const c = normScan(code); setCode('');   // v45.2: أرقام عربية/حروف من لوحة مفاتيح عربية ⇒ الرمز الأصلي
    const via = scanVia(keyT.current, pasted.current); keyT.current = []; pasted.current = false; if (!c) return;
    if (cnt) {   // وضع الجرد: يُضاف الملصق لقائمة الموجود (مرة واحدة) دون إجراء على الدفعة
      if (cnt.seen.some(x => x.code === c)) { say('مُسح من قبل في هذا الجرد: ' + c, 'no'); return focusScan(); }
      const b0 = (ops.prepBatches || []).find(x => String(x.code).toUpperCase() === c);
      const why = !b0 ? 'unknown' : b0.branchId !== branchId ? 'other' : b0.status === 'used' ? 'used' : b0.status === 'discarded' ? 'discarded' : '';
      setCnt(x => ({ ...x, seen: [{ code: c, id: b0 && !why ? b0.id : '', why, via, at: nowISO() }, ...x.seen] })); return focusScan();
    }
    const b = (ops.prepBatches || []).find(x => String(x.code).toUpperCase() === c);
    if (!b) { setHit({ miss: c, via }); return focusScan(); }
    if (b.branchId !== branchId) { setHit({ other: b, via }); return focusScan(); }
    const ev = { by: me.name, at: nowISO(), via };
    setHit({ b: { ...b, scans: [ev, ...(b.scans || [])].slice(0, 30) }, via }); focusScan();
    // v44.9 — سجل المسح: اسم الماسح ووقته وطريقته على الدفعة (آخر 30 مسحًا) — لأدوار الكتابة فقط
    if (canAct) commit(d => ({ ...d, prepBatches: (d.prepBatches || []).map(x => x.id === b.id ? { ...x, scans: [ev, ...(x.scans || [])].slice(0, 30) } : x) }));
  };
  const markUsed = async (b, via) => {
    if (!canAct) return say('للعرض فقط', 'no');
    const S = prepBatchState(b, Date.now()); if (S.st === 'expired') return say('الدفعة منتهية الصلاحية — لا تُستخدم، سجّل إتلافها', 'no');
    if (S.st !== 'ok' && S.st !== 'near') return say('الدفعة ' + (PREP_ST[S.st] || ['', ''])[1], 'no');
    const ok = await commit(d => ({ ...d, prepBatches: (d.prepBatches || []).map(x => x.id === b.id && x.status === 'shelf' ? { ...x, status: 'used', usedAt: nowISO(), usedBy: me.name, usedVia: via || 'list' } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: b.id, branchName: whName(org, whId), title: 'استخدام دفعة تحضير', details: b.code + ' · ' + b.name + ' · ' + VIA[via || 'list'][1] });
    if (ok) { setHit(h => h && h.b && h.b.id === b.id ? { ...h, b: { ...b, status: 'used', usedAt: nowISO(), usedBy: me.name, usedVia: via || 'list' } } : h); say('سُجّل استخدام ' + b.code + ' ✓'); focusScan(); }
  };
  const doDiscard = async () => {
    const b = disc.b; if (!canAct) return say('للعرض فقط', 'no');
    if (!WASTE_REASONS[disc.reason]) return say('اختر سبب الإتلاف', 'no');
    if (disc.reason === 'other' && !String(disc.note || '').trim()) return say('اكتب وصف السبب', 'no');
    const it = prepItemOf(org, b.prepId);
    // التحضيرة المخزّنة صنفًا: هدر من مستودع الفرع بمساره المعتاد (واعتماده فوق الحد)
    if (it && whId) { const okW = await submitWaste({ org, me, commit, say, col: 'whMoves', whId, branchId, lines: [{ itemId: it.id, qty: b.qty }], f: { reason: disc.reason, note: (disc.note ? disc.note + ' · ' : '') + 'دفعة ' + b.code }, avg: {}, title: b.name }); if (!okW) return; }
    const ok = await commit(d => ({ ...d, prepBatches: (d.prepBatches || []).map(x => x.id === b.id && x.status === 'shelf' ? { ...x, status: 'discarded', discardAt: nowISO(), discardBy: me.name, reason: disc.reason, discardNote: String(disc.note || '').trim(), discardVia: disc.via || 'list', ...(it && whId ? { wasteItem: it.id } : {}) } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: b.id, branchName: whName(org, whId), title: 'إتلاف دفعة تحضير', details: b.code + ' · ' + b.name + ' · ' + WASTE_REASONS[disc.reason] });
    if (ok) { setDisc(null); setHit(h => h && h.b && h.b.id === b.id ? null : h); say('أُتلفت الدفعة ' + b.code + ' ✓'); focusScan(); }
  };
  const actBtns = (b, via) => { const st = prepBatchState(b, now).st; return (
    <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
      <button className="btn sm gh" title="طباعة الملصق" data-pbprint onClick={() => setPv({ isNew: false, b, name: b.name, unit: b.unit, qty: b.qty, copies: '1', made: toLocalInp(Date.parse(b.madeAt)), exp: toLocalInp(Date.parse(b.expAt)), showMade: true, showExp: true, showBy: true, size: savedLabelSize() })}><Printer size={12} /></button>
      {canAct && (st === 'ok' || st === 'near') && <button className="btn sm pri" data-pbuse onClick={() => markUsed(b, via)}><Check size={12} />استخدام</button>}
      {canAct && ['ok', 'near', 'expired'].includes(st) && <button className={'btn sm' + (st === 'expired' ? ' pri' : ' gh')} data-pbdisc onClick={() => setDisc({ b, via, reason: st === 'expired' ? 'expired' : '', note: '' })}><Trash2 size={12} />إتلاف</button>}
    </div>); };
  const badge = (b) => { const S = prepBatchState(b, now); const [c, t] = PREP_ST[S.st] || ['b-dim', S.st]; return <span className={'badge ' + c} data-pbst={S.st}>{t}{(S.st === 'ok' || S.st === 'near') ? ' · ' + fmtLeft(S.left) : ''}</span>; };
  const nSt = (st) => shelf.filter(b => b.S.st === st).length;

  return (
    <div data-prepbatches>
      <div className="grid g4">
        <Kpi label="على رف التحضير" value={String(shelf.length)} sub="دفعات صالحة أو تحتاج إجراء" icon={ChefHat} color="#4FB286" />
        <Kpi label="قارب الانتهاء" value={String(nSt('near'))} sub="ربع المدة أو أقل — يُستخدم أولًا" icon={ScanLine} color="#E0A458" />
        <Kpi label="منتهٍ لم يُتلف" value={String(nSt('expired'))} sub={nSt('expired') ? 'أتلفه الآن' : 'لا شيء ✓'} icon={Trash2} color="#D9534F" />
        <Kpi label="اليوم" value={String(doneToday.length)} sub={doneToday.filter(b => b.status === 'used').length + ' استُخدم · ' + doneToday.filter(b => b.status === 'discarded').length + ' أُتلف'} icon={Check} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <div className="card-t"><ScanLine size={15} color="var(--brass)" />{cnt ? 'جرد الرف — امسح كل ملصق موجود' : 'مسح الملصق'}</div>
          {canAct && !cnt && <button className="btn sm" data-cntstart onClick={() => { setCnt({ startAt: nowISO(), seen: [] }); setHit(null); focusScan(); }}><ClipboardList size={13} />جرد الرف</button>}
          {cnt && <div className="row" style={{ gap: 6 }}><button className="btn sm pri" data-cntdone onClick={finishCnt}><Check size={13} />إنهاء وحفظ الجرد</button><button className="btn sm gh" onClick={() => setCnt(null)}><X size={13} />إلغاء</button></div>}
        </div>
        <form onSubmit={scan} className="row" style={{ gap: 8 }}>
          <input ref={scanRef} autoFocus className="inp" style={{ flex: 1, fontSize: 16 }} aria-label="مسح ملصق التحضير" placeholder="امسح الباركود بالقارئ أو اكتب الرمز ثم Enter" value={code} onKeyDown={onScanKey} onPaste={() => { pasted.current = true; }} onChange={e => { if (!e.target.value) { keyT.current = []; pasted.current = false; } setCode(e.target.value); }} />
          <button className="btn pri" type="submit"><ScanLine size={14} />بحث</button>
        </form>
        {cnt && cntRes && (
          <div style={{ marginTop: 10 }} data-cntlive>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="badge b-mint" data-cntn="found">موجود {cntRes.found.length} من {shelf.length}</span>
              <span className={'badge ' + (cntRes.missing.length ? 'b-amber' : 'b-dim')} data-cntn="missing">لم يُمسح بعد {cntRes.missing.length}</span>
              <span className={'badge ' + (cntRes.expired.length ? 'b-rose' : 'b-dim')} data-cntn="expired">منتهٍ على الرف {cntRes.expired.length}</span>
              <span className={'badge ' + (cntRes.extra.length ? 'b-rose' : 'b-dim')} data-cntn="extra">غير متوقع {cntRes.extra.length}</span>
            </div>
            {cntRes.missing.length > 0 && <div className="note" style={{ marginBottom: 6 }}><b>لم يُمسح:</b> {cntRes.missing.map(b => b.name + ' (' + b.code + ')').join('، ')}</div>}
            {cntRes.expired.length > 0 && <div className="note" style={{ marginBottom: 6, color: 'var(--rose)' }}><b>منتهٍ موجود — أتلفه:</b> {cntRes.expired.map(b => b.name + ' (' + b.code + ')').join('، ')}</div>}
            {cntRes.extra.length > 0 && <div className="note" style={{ marginBottom: 6, color: 'var(--rose)' }}><b>غير متوقع:</b> {cntRes.extra.map(x => x.code + ' — ' + CNT_WHY[x.why]).join('، ')}</div>}
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>آخر ما مُسح: {cnt.seen.slice(0, 6).map((x, i) => <span key={i} style={{ marginInlineEnd: 6 }}><b dir="ltr">{x.code}</b>{viaBadge(x.via, 'cnt')}</span>)}</div>
          </div>)}
        {!cnt && hit && (hit.miss ? <div className="note" style={{ marginTop: 10, color: 'var(--rose)' }} data-pbhit="miss">ملصق غير معروف: <b dir="ltr">{hit.miss}</b>{viaBadge(hit.via, 'hit')}</div>
          : hit.other ? <div className="note" style={{ marginTop: 10, color: 'var(--rose)' }} data-pbhit="other">الدفعة <b dir="ltr">{hit.other.code}</b> تخص {whName(org, hit.other.whId) || 'فرعًا آخر'} — ليست من هذا المطبخ{viaBadge(hit.via, 'hit')}</div>
          : <div className="card" style={{ marginTop: 10, padding: 12, background: 'var(--ink2)' }} data-pbhit="ok">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{hit.b.name} <span style={{ fontWeight: 400, color: 'var(--dim)', fontSize: 12.5 }}>{q3(hit.b.qty)} {hit.b.unit}</span></div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>{viaBadge(hit.via, 'hit')}{badge(hit.b)}</div>
              </div>
              <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.9 }}>
                <div>الرمز: <b dir="ltr" className="num">{hit.b.code}</b></div>
                <div>الإنتاج: <b dir="ltr" className="num">{fmtDT(hit.b.madeAt)}</b> · أعدّه <b data-pbby>{hit.b.by}</b></div>
                <div>الانتهاء: <b dir="ltr" className="num">{fmtDT(hit.b.expAt)}</b></div>
                {hit.b.status === 'used' && <div>استُخدم: <b dir="ltr" className="num">{fmtDT(hit.b.usedAt)}</b> · {hit.b.usedBy}{viaBadge(hit.b.usedVia)}</div>}
                {hit.b.status === 'discarded' && <div>أُتلف: <b dir="ltr" className="num">{fmtDT(hit.b.discardAt)}</b> · {hit.b.discardBy} · {WASTE_REASONS[hit.b.reason] || ''}{viaBadge(hit.b.discardVia)}</div>}
              </div>
              {(hit.b.scans || []).length > 0 && <div style={{ marginTop: 8 }} data-pbscans>
                <div className="lbl" style={{ marginBottom: 4 }}>سجل المسح ({(hit.b.scans || []).length})</div>
                {(hit.b.scans || []).slice(0, 5).map((e, i) => <div key={i} className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 3, flexWrap: 'wrap' }}><b>{e.by}</b><span className="num" dir="ltr" style={{ color: 'var(--dim)' }}>{fmtDT(e.at)}</span>{viaBadge(e.via, 'log')}</div>)}
              </div>}
              <div style={{ marginTop: 8 }}>{actBtns(hit.b, hit.via)}</div>
            </div>)}
      </div>

      {canAct && (
        <div className="card" data-pbnew>
          <div className="card-t" style={{ marginBottom: 8 }}><Plus size={15} color="var(--brass)" />تسجيل تحضير وطباعة ملصقه</div>
          <div className="grid g3">
            <Field label="التحضيرة">
              <select className="sel" aria-label="التحضيرة" value={f.prepId} onChange={e => setF(x => ({ ...x, prepId: e.target.value }))}>
                <option value="">— اختر —</option>
                {preps.map(p => <option key={p.id} value={p.id}>{p.name}{p.shelfH > 0 ? ' — صلاحية ' + (p.shelfH >= 48 && p.shelfH % 24 === 0 ? p.shelfH / 24 + ' يوم' : p.shelfH + ' ساعة') : ' — بلا مدة صلاحية'}</option>)}
              </select>
            </Field>
            <Field label={'الكمية المحضّرة' + (prepOf(f.prepId).unit ? ' (' + prepOf(f.prepId).unit + ')' : '')}><input className="inp n" inputMode="decimal" aria-label="الكمية المحضّرة" value={f.qty} onChange={e => setF(x => ({ ...x, qty: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
            <Field label="عدد الملصقات (حاوية لكل ملصق)"><input className="inp n" inputMode="numeric" aria-label="عدد الملصقات" value={f.copies} onChange={e => setF(x => ({ ...x, copies: e.target.value.replace(/[^\d]/g, '').slice(0, 2) }))} /></Field>
          </div>
          {f.prepId && prepShelfH(org, f.prepId) > 0 && <div className="hint">ينتهي: <b dir="ltr" className="num">{fmtDT(new Date(now + prepShelfH(org, f.prepId) * 3600000).toISOString())}</b> (الآن + {prepShelfH(org, f.prepId)} ساعة)</div>}
          <button className="btn pri" style={{ marginTop: 8 }} data-pbsave onClick={create}><Printer size={14} />معاينة وطباعة الملصق</button>
        </div>
      )}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><ChefHat size={15} color="var(--brass)" />رف التحضير — الأقرب انتهاءً أولًا</div>
        <div className="tw"><table className="tb" data-pbshelf>
          <thead><tr><th>التحضيرة</th><th>الرمز</th><th>الإنتاج</th><th>الانتهاء</th><th>الحالة</th><th>آخر مسح</th><th /></tr></thead>
          <tbody>
            {shelf.map(b => (<tr key={b.id} data-pbrow={b.code}><td>{b.name}<div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{q3(b.qty)} {b.unit} · {b.by}</div></td>
              <td className="num" dir="ltr" style={{ fontSize: 11 }}>{b.code}</td><td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(b.madeAt)}</td><td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(b.expAt)}</td>
              <td>{badge(b)}</td><td style={{ fontSize: 11 }}>{(b.scans || [])[0] ? <>{b.scans[0].by}<div className="num" dir="ltr" style={{ color: 'var(--faint)', fontSize: 10.5 }}>{fmtDT(b.scans[0].at)}</div></> : <span style={{ color: 'var(--faint)' }}>—</span>}</td><td>{actBtns(b)}</td></tr>))}
            {!shelf.length && <tr><td colSpan={7}><div className="empty">لا دفعات على الرف</div></td></tr>}
          </tbody></table></div>
        {doneToday.length > 0 && <>
          <div className="card-t" style={{ margin: '14px 0 8px', fontSize: 13 }}>ما خرج من الرف اليوم</div>
          <div className="tw"><table className="tb"><tbody>
            {doneToday.map(b => (<tr key={b.id}><td>{b.name}<div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{q3(b.qty)} {b.unit}</div></td><td className="num" dir="ltr" style={{ fontSize: 11 }}>{b.code}</td>
              <td>{badge(b)}{b.status === 'discarded' && b.reason ? <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{WASTE_REASONS[b.reason]}</div> : null}</td>
              <td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(b.status === 'used' ? b.usedAt : b.discardAt)}</td><td style={{ fontSize: 11, color: 'var(--faint)' }}>{b.status === 'used' ? b.usedBy : b.discardBy}{viaBadge(b.status === 'used' ? b.usedVia : b.discardVia)}</td></tr>))}
          </tbody></table></div></>}
      </div>

      {counts.length > 0 && (
        <div className="card" data-cnthist>
          <div className="card-t" style={{ marginBottom: 8 }}><ClipboardList size={15} color="var(--brass)" />سجل جرد الرف</div>
          <div className="tw"><table className="tb"><thead><tr><th>الوقت</th><th>بواسطة</th><th>موجود</th><th>مفقود</th><th>منتهٍ</th><th>غير متوقع</th></tr></thead><tbody>
            {counts.slice(0, 20).map(r => (<tr key={r.id}><td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(r.at)}</td><td style={{ fontSize: 12 }}>{r.by}</td>
              <td className="num">{(r.found || []).length} / {r.shelf}</td>
              <td title={(r.missing || []).join('، ')}><span className={'badge ' + ((r.missing || []).length ? 'b-amber' : 'b-mint')}>{(r.missing || []).length}</span></td>
              <td title={(r.expired || []).join('، ')}><span className={'badge ' + ((r.expired || []).length ? 'b-rose' : 'b-mint')}>{(r.expired || []).length}</span></td>
              <td title={(r.extra || []).map(x => x.code).join('، ')}><span className={'badge ' + ((r.extra || []).length ? 'b-rose' : 'b-mint')}>{(r.extra || []).length}</span></td></tr>))}
          </tbody></table></div>
        </div>)}

      {pv && (
        <Modal title={pv.isNew ? 'معاينة الملصق قبل الطباعة' : 'إعادة طباعة ملصق ' + pv.b.code} icon={Printer} onClose={() => setPv(null)}
          foot={<><button className="btn pri" data-pbprintok onClick={savePv}><Printer size={14} />{pv.isNew ? 'تسجيل وطباعة' : 'طباعة'}</button><button className="btn gh" onClick={() => setPv(null)}>إلغاء</button></>}>
          <div className="note" style={{ marginBottom: 8 }}><b>{pv.name}</b> · {q3(pv.qty)} {pv.unit}{pv.isNew ? ' · صلاحية ' + pv.h + ' ساعة' : ''}</div>
          <div className="grid g2">
            <Field label="تاريخ ووقت الإنتاج"><input type="datetime-local" className="inp" aria-label="تاريخ الإنتاج" value={pv.made} disabled={!pv.isNew}
              onChange={e => { const v = e.target.value; setPv(x => ({ ...x, made: v, ...(x.isNew && !isNaN(new Date(v)) ? { exp: toLocalInp(new Date(v).getTime() + x.h * 3600000) } : {}) })); }} />
              <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12.5, marginTop: 6 }}><input type="checkbox" aria-label="طباعة تاريخ الإنتاج" checked={pv.showMade} onChange={e => setPv(x => ({ ...x, showMade: e.target.checked }))} />طباعته على الملصق</label></Field>
            <Field label="تاريخ ووقت الانتهاء"><input type="datetime-local" className="inp" aria-label="تاريخ الانتهاء" value={pv.exp} disabled={!pv.isNew} onChange={e => setPv(x => ({ ...x, exp: e.target.value }))} />
              <label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12.5, marginTop: 6 }}><input type="checkbox" aria-label="طباعة تاريخ الانتهاء" checked={pv.showExp} onChange={e => setPv(x => ({ ...x, showExp: e.target.checked }))} />طباعته على الملصق</label></Field>
            <Field label="اسم المُعِد"><label className="row" style={{ gap: 6, alignItems: 'center', fontSize: 12.5, marginTop: 8 }}><input type="checkbox" aria-label="طباعة اسم المعد" checked={pv.showBy} onChange={e => setPv(x => ({ ...x, showBy: e.target.checked }))} />طباعة «أعدّه: {pv.isNew ? me.name : (pv.b.by || '—')}» على الملصق</label></Field>
            <Field label="مقاس الملصق"><select className="sel" aria-label="مقاس الملصق" value={pv.size} onChange={e => setPv(x => ({ ...x, size: e.target.value }))}>{LABEL_SIZES.map(z => <option key={z.id} value={z.id}>{z.ar}</option>)}</select></Field>
            <Field label="عدد الملصقات"><input className="inp n" inputMode="numeric" aria-label="عدد ملصقات المعاينة" value={pv.copies} onChange={e => setPv(x => ({ ...x, copies: e.target.value.replace(/[^\d]/g, '').slice(0, 2) }))} /></Field>
          </div>
          {(() => { const mk = new Date(pv.made), ex = new Date(pv.exp); const ok = !isNaN(mk) && !isNaN(ex);
            return ok ? <LabelPreview b={pv.isNew ? { code: 'P0000000000', name: pv.name, unit: pv.unit, qty: pv.qty, by: me.name, madeAt: mk.toISOString(), expAt: ex.toISOString() } : pv.b} show={{ made: pv.showMade, exp: pv.showExp, by: pv.showBy }} size={pv.size} /> : null; })()}
          {pv.isNew && <div className="hint">الانتهاء يُحسب آليًا من وقت الإنتاج + مدة الصلاحية، ويمكن تقديمه فقط (لا يُمدَّد بعد المدة).</div>}
        </Modal>
      )}

      {disc && (
        <Modal title={'إتلاف الدفعة ' + disc.b.code} icon={Trash2} onClose={() => setDisc(null)}
          foot={<><button className="btn pri" data-pbdiscsave onClick={doDiscard}><Trash2 size={14} />تأكيد الإتلاف</button><button className="btn gh" onClick={() => setDisc(null)}>إلغاء</button></>}>
          <div className="note" style={{ marginBottom: 8 }}>{disc.b.name} · {q3(disc.b.qty)} {disc.b.unit} · انتهاء <b dir="ltr">{fmtDT(disc.b.expAt)}</b>{prepItemOf(org, disc.b.prepId) && whId ? ' — تُخصم هدرًا من مستودع الفرع (بالاعتماد إن تجاوزت الحد)' : ''}</div>
          <Field label="سبب الإتلاف"><select className="sel" aria-label="سبب الإتلاف" value={disc.reason} onChange={e => setDisc(x => ({ ...x, reason: e.target.value }))}><option value="">— اختر —</option>{Object.entries(WASTE_REASONS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
          <Field label="ملاحظة"><input className="inp" value={disc.note} onChange={e => setDisc(x => ({ ...x, note: e.target.value }))} /></Field>
        </Modal>
      )}
    </div>
  );
}

/** شاشة «التحضير اليومي» في مركز الإغلاق (بجوار سجل سلامة الغذاء): الفرع يختار فرعه، والمركز يراقب أي فرع */
/** v45.3 — تقرير هدر التحضير: لكل تحضيرة وفرع وسبب، بالفترة؛ القيمة للمركز فقط (بتكلفة الوصفة) */
const pad2 = (n) => String(n).padStart(2, '0');
const dayStr = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
export function PrepWasteReport({ org, ops, brs, central, say }) {
  const now = new Date(), td = dayStr(now);
  const m0 = td.slice(0, 8) + '01';
  const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1), pmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const [P, setP] = useState({ from: m0, to: td, br: central ? '' : ((brs[0] || {}).id || '') });
  const AVG = useMemo(() => central ? itemAvgCosts(org, ops) : null, [org, ops, central]);
  const S = useMemo(() => prepWasteStats(org, ops, { from: P.from, to: P.to, branchIds: P.br ? [P.br] : brs.map(b => b.id), avg: AVG }), [org, ops, P, AVG, brs]);
  const bn = (id) => (brs.find(b => b.id === id) || {}).name || id;
  const val = S.hasValue && central;
  const quick = [['اليوم', td, td], ['هذا الشهر', m0, td], ['الشهر الماضي', dayStr(pm), dayStr(pmEnd)]];
  const print = () => {
    const rows = S.rows.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${q3(r.made)} ${esc(r.unit)}</td><td class="n">${q3(r.waste)} ${esc(r.unit)}</td><td class="n">${r.pct == null ? '—' : r.pct + '%'}</td><td>${esc(WASTE_REASONS[r.topReason] || '')}</td>${val ? `<td class="n">${money(r.value)}</td>` : ''}</tr>`).join('');
    printA4(org, 'تقرير هدر التحضير', (P.br ? bn(P.br) : 'كل الفروع') + ' · ' + arDate(P.from) + ' — ' + arDate(P.to),
      `<table><thead><tr><th>التحضيرة</th><th>المحضَّر</th><th>المتلَف</th><th>نسبة الهدر</th><th>أكثر سبب</th>${val ? '<th>القيمة</th>' : ''}</tr></thead><tbody>${rows}
      ${val ? `<tr class="tot"><td colspan="5">إجمالي قيمة الهدر</td><td class="n">${money(S.totals.value)}</td></tr>` : ''}</tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no');
  };
  return (<div data-pwr>
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div className="card-t"><BarChart3 size={15} color="var(--brass)" />تقرير هدر التحضير</div>
        <button className="btn sm gh" onClick={print}><Printer size={13} />طباعة</button>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{quick.map(([t, f, e]) => <button key={t} className={'btn sm' + (P.from === f && P.to === e ? ' pri' : ' gh')} onClick={() => setP(x => ({ ...x, from: f, to: e }))}>{t}</button>)}</div>
      <div className="grid g3">
        <Field label="من"><input type="date" className="inp" aria-label="من تاريخ" value={P.from} onChange={e => setP(x => ({ ...x, from: e.target.value }))} /></Field>
        <Field label="إلى"><input type="date" className="inp" aria-label="إلى تاريخ" value={P.to} onChange={e => setP(x => ({ ...x, to: e.target.value }))} /></Field>
        {brs.length > 1 && <Field label="الفرع"><select className="sel" aria-label="فرع التقرير" value={P.br} onChange={e => setP(x => ({ ...x, br: e.target.value }))}>{central && <option value="">كل الفروع</option>}{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
      </div>
    </div>
    <div className="grid g4">
      <Kpi label="دفعات محضّرة" value={String(S.totals.madeN)} sub="في الفترة" icon={ChefHat} color="#4FB286" />
      <Kpi label="دفعات متلَفة" value={String(S.totals.wasteN)} sub={S.totals.madeN ? Math.round(S.totals.wasteN / S.totals.madeN * 1000) / 10 + '% من الدفعات' : '—'} icon={Trash2} color="#D9534F" />
      <Kpi label="قيمة الهدر" value={val ? money(S.totals.value) : '—'} sub={val ? 'بتكلفة الوصفة' : central ? 'الوصفات بلا تكلفة' : 'تظهر للمركز'} icon={BarChart3} color="#E0A458" />
      <Kpi label="أكثر سبب" value={S.byReason[0] ? WASTE_REASONS[S.byReason[0].reason] || S.byReason[0].reason : '—'} sub={S.byReason[0] ? S.byReason[0].n + ' دفعة' : 'لا هدر ✓'} icon={ClipboardList} color="#5B93C4" />
    </div>
    <div className="card">
      <div className="card-t" style={{ marginBottom: 8 }}>حسب التحضيرة</div>
      <div className="tw"><table className="tb" data-pwrrows>
        <thead><tr><th>التحضيرة</th><th style={{ textAlign: 'end' }}>المحضَّر</th><th style={{ textAlign: 'end' }}>المتلَف</th><th style={{ textAlign: 'end' }}>نسبة الهدر</th><th>أكثر سبب</th>{val && <th style={{ textAlign: 'end' }}>القيمة</th>}</tr></thead>
        <tbody>{S.rows.map(r => (<tr key={r.prepId} data-pwr-row={r.name}><td>{r.name}</td>
          <td className="num" style={{ textAlign: 'end' }}>{q3(r.made)} <span style={{ color: 'var(--dim)', fontSize: 11 }}>{r.unit} · {r.madeN}</span></td>
          <td className="num" style={{ textAlign: 'end', color: r.waste > 0 ? 'var(--rose)' : undefined }}>{q3(r.waste)} <span style={{ color: 'var(--dim)', fontSize: 11 }}>{r.unit} · {r.wasteN}</span></td>
          <td style={{ textAlign: 'end' }}>{r.pct == null ? <span className="badge b-dim">—</span> : <span className={'badge ' + (r.pct >= 10 ? 'b-rose' : r.pct > 0 ? 'b-amber' : 'b-mint')} data-pwr-pct>{r.pct}%</span>}</td>
          <td style={{ fontSize: 12 }}>{WASTE_REASONS[r.topReason] || '—'}</td>{val && <td className="num" style={{ textAlign: 'end' }}>{money(r.value)}</td>}</tr>))}
          {!S.rows.length && <tr><td colSpan={6}><div className="empty">لا تحضير ولا هدر في الفترة</div></td></tr>}
        </tbody></table></div>
      {central && !P.br && S.byBranch.length > 0 && <>
        <div className="card-t" style={{ margin: '14px 0 8px', fontSize: 13 }}>حسب الفرع</div>
        <div className="tw"><table className="tb" data-pwrbr><thead><tr><th>الفرع</th><th style={{ textAlign: 'end' }}>دفعات متلَفة</th><th style={{ textAlign: 'end' }}>نسبة الهدر (كمية)</th>{val && <th style={{ textAlign: 'end' }}>القيمة</th>}</tr></thead>
          <tbody>{S.byBranch.map(B => (<tr key={B.branchId}><td>{bn(B.branchId)}</td><td className="num" style={{ textAlign: 'end' }}>{B.wasteN}</td><td style={{ textAlign: 'end' }}>{B.pct == null ? '—' : B.pct + '%'}</td>{val && <td className="num" style={{ textAlign: 'end' }}>{money(B.value)}</td>}</tr>))}</tbody></table></div></>}
      {S.byReason.length > 0 && <>
        <div className="card-t" style={{ margin: '14px 0 8px', fontSize: 13 }}>حسب السبب</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} data-pwrreasons>{S.byReason.map(Z => <span key={Z.reason} className="badge b-dim">{WASTE_REASONS[Z.reason] || Z.reason}: {Z.n}{val ? ' · ' + money(Z.value) : ''}</span>)}</div></>}
    </div>
  </div>);
}

/** شاشة «التحضير اليومي» في مركز الإغلاق (بجوار سجل سلامة الغذاء): الفرع يختار فرعه، والمركز يراقب أي فرع */
export function PrepDaily({ org, ops, me, myBranches, commit, say }) {
  const brs = (myBranches && myBranches.length ? myBranches : (org.branches || [])).filter(b => b.isActive !== false);
  const [br, setBr] = useState(me?.branchId && brs.some(b => b.id === me.branchId) ? me.branchId : (brs[0] || {}).id || '');
  const [tab, setTab] = useState('shelf');
  const wh = (org.warehouses || []).find(w => w && w.active !== false && w.kind === 'branch' && w.branchId === br);
  const ro = ['cost_controller', 'accountant_view'].includes(me?.role);
  const central = (ROLES[me?.role] || {}).scope === 'all' || !!(ROLES[me?.role] || {}).costCtl;
  if (!brs.length) return <div className="card"><div className="empty">لا فروع</div></div>;
  return (<>
    <div className="card" style={{ padding: 10 }}><div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className={'btn sm' + (tab === 'shelf' ? ' pri' : ' gh')} data-ptab="shelf" onClick={() => setTab('shelf')}><ChefHat size={13} />رف التحضير</button>
      <button className={'btn sm' + (tab === 'waste' ? ' pri' : ' gh')} data-ptab="waste" onClick={() => setTab('waste')}><BarChart3 size={13} />تقرير الهدر</button>
      {tab === 'shelf' && brs.length > 1 && <><b style={{ marginInlineStart: 'auto' }}>الفرع</b>
        <select className="sel" style={{ maxWidth: 260 }} aria-label="فرع التحضير" value={br} onChange={e => setBr(e.target.value)}>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></>}
    </div></div>
    {tab === 'shelf' && <PrepBatches key={br} org={org} ops={ops} me={me} commit={commit} say={say} whId={wh ? wh.id : ''} branchId={br} canAct={!ro} />}
    {tab === 'waste' && <PrepWasteReport org={org} ops={ops} brs={brs} central={central} say={say} />}
  </>);
}
