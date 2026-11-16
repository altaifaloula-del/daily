/* v44.5 — «التحضير اليومي»: كل دفعة تحضير تُسجَّل بملصق باركود (Code128) عليه تاريخ ووقت الإنتاج والانتهاء،
   ويمسحه المطبخ بالقارئ (يعمل كلوحة مفاتيح: الرمز ثم Enter) لعرض الحالة، أو تسجيل الاستخدام، أو الإتلاف.
   قرارات المالك: يسجّلها مطبخ الفرع · الانتهاء آليًا من مدة صلاحية التحضيرة (يحددها المركز) · ملصق 50×30 مم.
   الإتلاف: التحضيرة المخزّنة صنفًا تُخصم هدرًا من مستودع الفرع بمسار الهدر الحالي (واعتماده)، وغيرها يُوثَّق على الدفعة. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScanLine, Printer, Check, Trash2, Plus, ChefHat } from 'lucide-react';
import { Field, Kpi, Modal, PREP_ST, WASTE_REASONS, nowISO, prepBatchState, prepItemOf, prepShelfH, q3, submitWaste, today, uid, whName } from '../../App.jsx';

const pad = (n) => String(n).padStart(2, '0');
export const fmtDT = (iso) => { const d = new Date(iso); if (isNaN(d)) return '—'; return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtLeft = (ms) => { if (ms <= 0) return 'منتهٍ'; const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h >= 48 ? Math.floor(h / 24) + ' يوم' : h > 0 ? h + ' س ' + m + ' د' : m + ' د'; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const newCode = () => 'P' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 6).toUpperCase();

/** ملصقات 50×30 مم — نسخة لكل حاوية */
export async function printPrepLabels(batches, copies, say) {
  const { default: JsBarcode } = await import('jsbarcode');
  const svgOf = (code) => { const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(el, code, { format: 'CODE128', width: 1.5, height: 34, displayValue: true, fontSize: 11, margin: 0, textMargin: 1 }); return el.outerHTML; };
  const one = (b) => `<div class="lb"><div class="t"><b>${esc(b.name)}</b><span>${esc(q3(b.qty))} ${esc(b.unit)}</span></div>
    <div class="d"><span>إنتاج: <b dir="ltr">${esc(fmtDT(b.madeAt))}</b></span><span>انتهاء: <b dir="ltr">${esc(fmtDT(b.expAt))}</b></span></div><div class="bc">${svgOf(b.code)}</div></div>`;
  const html = batches.flatMap(b => Array.from({ length: Math.max(1, Math.min(50, Number(copies) || 1)) }, () => one(b))).join('');
  const w = window.open('', '_blank', 'width=420,height=360'); if (!w) { say && say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); return false; }
  w.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ملصقات التحضير</title><style>
    @page{size:50mm 30mm;margin:0} *{box-sizing:border-box} body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#000}
    .lb{width:50mm;height:30mm;padding:1.4mm 2mm;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;gap:.6mm}
    .t{display:flex;justify-content:space-between;gap:2mm;font-size:9pt}.t b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .d{display:flex;flex-direction:column;font-size:7pt;line-height:1.25}.bc{flex:1;display:flex;align-items:center;justify-content:center}.bc svg{max-width:100%;height:13mm}
  </style></head><body>${html}<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close(); return true;
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
  const scanRef = useRef(null);
  const focusScan = () => setTimeout(() => scanRef.current && scanRef.current.focus(), 30);
  const prepOf = (id) => preps.find(p => p.id === id) || {};

  const create = async () => {
    if (!canAct) return say('للعرض فقط', 'no');
    const p = prepOf(f.prepId); if (!p.id) return say('اختر التحضيرة', 'no');
    const qty = q3(f.qty); if (!(qty > 0)) return say('أدخل الكمية المحضّرة', 'no');
    const h = prepShelfH(org, p.id); if (!(h > 0)) return say('مدة صلاحية «' + p.name + '» غير محددة — يحددها المركز من بطاقة التحضيرة', 'no');
    const mk = new Date(); const ex = new Date(mk.getTime() + h * 3600000);
    const rec = { id: uid('pb'), code: newCode(), branchId, whId: whId || '', prepId: p.id, name: p.name, unit: p.unit || '', qty, shelfH: h, madeAt: mk.toISOString(), expAt: ex.toISOString(), status: 'shelf', by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, prepBatches: [rec, ...(d.prepBatches || [])] }),
      { actionType: 'create', targetType: 'stock_move', targetId: rec.id, branchName: whName(org, whId), title: 'تحضير يومي — ' + p.name, details: rec.code + ' · ' + qty + ' ' + rec.unit + ' · ينتهي ' + fmtDT(rec.expAt) });
    if (!ok) return;
    setF({ prepId: f.prepId, qty: '', copies: f.copies });
    say('سُجّلت الدفعة ' + rec.code + ' — تنتهي ' + fmtDT(rec.expAt) + ' ✓');
    printPrepLabels([rec], f.copies, say);
  };
  const scan = (e) => {
    e.preventDefault(); const c = code.trim().toUpperCase(); setCode(''); if (!c) return;
    const b = (ops.prepBatches || []).find(x => String(x.code).toUpperCase() === c);
    if (!b) { setHit({ miss: c }); return focusScan(); }
    if (b.branchId !== branchId) { setHit({ other: b }); return focusScan(); }
    setHit({ b }); focusScan();
  };
  const markUsed = async (b) => {
    if (!canAct) return say('للعرض فقط', 'no');
    const S = prepBatchState(b, Date.now()); if (S.st === 'expired') return say('الدفعة منتهية الصلاحية — لا تُستخدم، سجّل إتلافها', 'no');
    if (S.st !== 'ok' && S.st !== 'near') return say('الدفعة ' + (PREP_ST[S.st] || ['', ''])[1], 'no');
    const ok = await commit(d => ({ ...d, prepBatches: (d.prepBatches || []).map(x => x.id === b.id && x.status === 'shelf' ? { ...x, status: 'used', usedAt: nowISO(), usedBy: me.name } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: b.id, branchName: whName(org, whId), title: 'استخدام دفعة تحضير', details: b.code + ' · ' + b.name });
    if (ok) { setHit(h => h && h.b && h.b.id === b.id ? { b: { ...b, status: 'used', usedAt: nowISO(), usedBy: me.name } } : h); say('سُجّل استخدام ' + b.code + ' ✓'); focusScan(); }
  };
  const doDiscard = async () => {
    const b = disc.b; if (!canAct) return say('للعرض فقط', 'no');
    if (!WASTE_REASONS[disc.reason]) return say('اختر سبب الإتلاف', 'no');
    if (disc.reason === 'other' && !String(disc.note || '').trim()) return say('اكتب وصف السبب', 'no');
    const it = prepItemOf(org, b.prepId);
    // التحضيرة المخزّنة صنفًا: هدر من مستودع الفرع بمساره المعتاد (واعتماده فوق الحد)
    if (it && whId) { const okW = await submitWaste({ org, me, commit, say, col: 'whMoves', whId, branchId, lines: [{ itemId: it.id, qty: b.qty }], f: { reason: disc.reason, note: (disc.note ? disc.note + ' · ' : '') + 'دفعة ' + b.code }, avg: {}, title: b.name }); if (!okW) return; }
    const ok = await commit(d => ({ ...d, prepBatches: (d.prepBatches || []).map(x => x.id === b.id && x.status === 'shelf' ? { ...x, status: 'discarded', discardAt: nowISO(), discardBy: me.name, reason: disc.reason, discardNote: String(disc.note || '').trim(), ...(it && whId ? { wasteItem: it.id } : {}) } : x) }),
      { actionType: 'update', targetType: 'stock_move', targetId: b.id, branchName: whName(org, whId), title: 'إتلاف دفعة تحضير', details: b.code + ' · ' + b.name + ' · ' + WASTE_REASONS[disc.reason] });
    if (ok) { setDisc(null); setHit(h => h && h.b && h.b.id === b.id ? null : h); say('أُتلفت الدفعة ' + b.code + ' ✓'); focusScan(); }
  };
  const actBtns = (b) => { const st = prepBatchState(b, now).st; return (
    <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
      <button className="btn sm gh" title="طباعة الملصق" onClick={() => printPrepLabels([b], 1, say)}><Printer size={12} /></button>
      {canAct && (st === 'ok' || st === 'near') && <button className="btn sm pri" data-pbuse onClick={() => markUsed(b)}><Check size={12} />استخدام</button>}
      {canAct && ['ok', 'near', 'expired'].includes(st) && <button className={'btn sm' + (st === 'expired' ? ' pri' : ' gh')} data-pbdisc onClick={() => setDisc({ b, reason: st === 'expired' ? 'expired' : '', note: '' })}><Trash2 size={12} />إتلاف</button>}
    </div>); };
  const badge = (b) => { const S = prepBatchState(b, now); const [c, t] = PREP_ST[S.st] || ['b-dim', S.st]; return <span className={'badge ' + c} data-pbst={S.st}>{t}{(S.st === 'ok' || S.st === 'near') ? ' · ' + fmtLeft(S.left) : ''}</span>; };
  const cnt = (st) => shelf.filter(b => b.S.st === st).length;

  return (
    <div data-prepbatches>
      <div className="grid g4">
        <Kpi label="على رف التحضير" value={String(shelf.length)} sub="دفعات صالحة أو تحتاج إجراء" icon={ChefHat} color="#4FB286" />
        <Kpi label="قارب الانتهاء" value={String(cnt('near'))} sub="ربع المدة أو أقل — يُستخدم أولًا" icon={ScanLine} color="#E0A458" />
        <Kpi label="منتهٍ لم يُتلف" value={String(cnt('expired'))} sub={cnt('expired') ? 'أتلفه الآن' : 'لا شيء ✓'} icon={Trash2} color="#D9534F" />
        <Kpi label="اليوم" value={String(doneToday.length)} sub={doneToday.filter(b => b.status === 'used').length + ' استُخدم · ' + doneToday.filter(b => b.status === 'discarded').length + ' أُتلف'} icon={Check} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><ScanLine size={15} color="var(--brass)" />مسح الملصق</div>
        <form onSubmit={scan} className="row" style={{ gap: 8 }}>
          <input ref={scanRef} autoFocus className="inp" style={{ flex: 1, fontSize: 16 }} aria-label="مسح ملصق التحضير" placeholder="امسح الباركود بالقارئ أو اكتب الرمز ثم Enter" value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn pri" type="submit"><ScanLine size={14} />بحث</button>
        </form>
        {hit && (hit.miss ? <div className="note" style={{ marginTop: 10, color: 'var(--rose)' }} data-pbhit="miss">ملصق غير معروف: <b dir="ltr">{hit.miss}</b></div>
          : hit.other ? <div className="note" style={{ marginTop: 10, color: 'var(--rose)' }} data-pbhit="other">الدفعة <b dir="ltr">{hit.other.code}</b> تخص {whName(org, hit.other.whId) || 'فرعًا آخر'} — ليست من هذا المطبخ</div>
          : <div className="card" style={{ marginTop: 10, padding: 12, background: 'var(--ink2)' }} data-pbhit="ok">
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{hit.b.name} <span style={{ fontWeight: 400, color: 'var(--dim)', fontSize: 12.5 }}>{q3(hit.b.qty)} {hit.b.unit}</span></div>
                {badge(hit.b)}
              </div>
              <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.9 }}>
                <div>الرمز: <b dir="ltr" className="num">{hit.b.code}</b></div>
                <div>الإنتاج: <b dir="ltr" className="num">{fmtDT(hit.b.madeAt)}</b> · {hit.b.by}</div>
                <div>الانتهاء: <b dir="ltr" className="num">{fmtDT(hit.b.expAt)}</b></div>
                {hit.b.status === 'used' && <div>استُخدم: <b dir="ltr" className="num">{fmtDT(hit.b.usedAt)}</b> · {hit.b.usedBy}</div>}
                {hit.b.status === 'discarded' && <div>أُتلف: <b dir="ltr" className="num">{fmtDT(hit.b.discardAt)}</b> · {hit.b.discardBy} · {WASTE_REASONS[hit.b.reason] || ''}</div>}
              </div>
              <div style={{ marginTop: 8 }}>{actBtns(hit.b)}</div>
            </div>)}
      </div>

      {canAct && (
        <div className="card" data-pbnew>
          <div className="card-t" style={{ marginBottom: 8 }}><Plus size={15} color="var(--brass)" />تسجيل تحضير وطباعة ملصقه (50×30 مم)</div>
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
          <button className="btn pri" style={{ marginTop: 8 }} data-pbsave onClick={create}><Printer size={14} />تسجيل وطباعة الملصق</button>
        </div>
      )}

      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><ChefHat size={15} color="var(--brass)" />رف التحضير — الأقرب انتهاءً أولًا</div>
        <div className="tw"><table className="tb" data-pbshelf>
          <thead><tr><th>التحضيرة</th><th>الرمز</th><th>الإنتاج</th><th>الانتهاء</th><th>الحالة</th><th /></tr></thead>
          <tbody>
            {shelf.map(b => (<tr key={b.id} data-pbrow={b.code}><td>{b.name}<div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{q3(b.qty)} {b.unit} · {b.by}</div></td>
              <td className="num" dir="ltr" style={{ fontSize: 11 }}>{b.code}</td><td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(b.madeAt)}</td><td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(b.expAt)}</td>
              <td>{badge(b)}</td><td>{actBtns(b)}</td></tr>))}
            {!shelf.length && <tr><td colSpan={6}><div className="empty">لا دفعات على الرف</div></td></tr>}
          </tbody></table></div>
        {doneToday.length > 0 && <>
          <div className="card-t" style={{ margin: '14px 0 8px', fontSize: 13 }}>ما خرج من الرف اليوم</div>
          <div className="tw"><table className="tb"><tbody>
            {doneToday.map(b => (<tr key={b.id}><td>{b.name}<div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{q3(b.qty)} {b.unit}</div></td><td className="num" dir="ltr" style={{ fontSize: 11 }}>{b.code}</td>
              <td>{badge(b)}{b.status === 'discarded' && b.reason ? <div style={{ fontSize: 10.5, color: 'var(--dim)' }}>{WASTE_REASONS[b.reason]}</div> : null}</td>
              <td className="num" dir="ltr" style={{ fontSize: 11 }}>{fmtDT(b.status === 'used' ? b.usedAt : b.discardAt)}</td><td style={{ fontSize: 11, color: 'var(--faint)' }}>{b.status === 'used' ? b.usedBy : b.discardBy}</td></tr>))}
          </tbody></table></div></>}
      </div>

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
export function PrepDaily({ org, ops, me, myBranches, commit, say }) {
  const brs = (myBranches && myBranches.length ? myBranches : (org.branches || [])).filter(b => b.isActive !== false);
  const [br, setBr] = useState(me?.branchId && brs.some(b => b.id === me.branchId) ? me.branchId : (brs[0] || {}).id || '');
  const wh = (org.warehouses || []).find(w => w && w.active !== false && w.kind === 'branch' && w.branchId === br);
  const ro = ['cost_controller', 'accountant_view'].includes(me?.role);
  if (!brs.length) return <div className="card"><div className="empty">لا فروع</div></div>;
  return (<>
    {brs.length > 1 && <div className="card" style={{ padding: 10 }}><div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><ChefHat size={15} color="var(--brass)" /><b>الفرع</b>
      <select className="sel" style={{ maxWidth: 260 }} aria-label="فرع التحضير" value={br} onChange={e => setBr(e.target.value)}>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div></div>}
    <PrepBatches key={br} org={org} ops={ops} me={me} commit={commit} say={say} whId={wh ? wh.id : ''} branchId={br} canAct={!ro} />
  </>);
}
