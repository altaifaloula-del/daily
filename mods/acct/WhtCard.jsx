/* v56.47 (E7) — ضريبة الاستقطاع على المدفوعات لغير المقيمين: التفعيل وجدول الأنواع (بلا قيم افتراضية — النسبة لا تُستخدم إلا إن وُسم «أكّده المختص»)،
   ورصيد 2107، والسجل الشهري بصيغة Excel يُرفع للهيئة يدويًا. التعديل لمسؤول النظام والإدارة المالية؛ لا موعد توريد مبرمج (قرار المجلس). */
import React, { useMemo, useState } from 'react';
import { ShieldCheck, Download, Plus, Trash2, Check } from 'lucide-react';
import { ROLES, WHT_ACC, whtOn, whtTypes, whtRateOk, whtRows, buildAccounting, makeXlsx, money, nowISO, today, uid } from '../../App.jsx';

export const whtCanEdit = (me) => !!(me && ((ROLES[me.role] || {}).admin || me.role === 'finance_department'));

export function WhtCard({ org, ops, me, commitOrg, say }) {
  const on = whtOn(org); const can = whtCanEdit(me);
  const [T, setT] = useState(null);   // مسودة جدول الأنواع
  const [ym, setYm] = useState(today().slice(0, 7));
  const types = whtTypes(org);
  const bal = useMemo(() => { const A = buildAccounting(org, ops || {}); return Math.round(A.entries.reduce((t, e) => t + (e.lines || []).reduce((s, l) => s + (String(l.code) === WHT_ACC ? (l.credit || 0) - (l.debit || 0) : 0), 0), 0) * 100) / 100; }, [org, ops]);
  const R = useMemo(() => whtRows(org, ops || {}, ym), [org, ops, ym]);
  const flip = async () => { if (!can) return;
    if (!on && !window.confirm('تفعيل ضريبة الاستقطاع؟\nيُضاف الحساب 2107 «ضريبة استقطاع مستحقة». سند الصرف لمورد موسوم «غير مقيم» يُلزم باختيار نوع مؤكَّد من المختص، ويُمنع سداده من المسارات الأخرى.')) return;
    const ok = await commitOrg(o => ({ ...o, wht: { ...(o.wht || {}), on: !on, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'wht', title: on ? 'أوقف ضريبة الاستقطاع' : 'فعّل ضريبة الاستقطاع' });
    if (ok) say(on ? 'أُوقفت — السندات السابقة كما هي' : 'فُعّلت ✓ — أضف الأنواع ونسبها بعد تأكيد المختص'); };
  const save = async () => { if (!can || !T) return;
    const list = T.filter(t => String(t.name || '').trim() || String(t.rate || '').trim());
    for (const t of list) { if (!String(t.name || '').trim()) return say('اكتب اسم كل نوع', 'no'); if (String(t.rate || '').trim() && !whtRateOk(t.rate)) return say('النسبة بين 0 و100 — ' + t.name, 'no');
      if (t.ok && !whtRateOk(t.rate)) return say('لا يُوسم «أكّده المختص» بلا نسبة — ' + t.name, 'no'); }
    const out = list.map(t => ({ id: t.id || uid('wt'), name: String(t.name).trim().slice(0, 80), rate: String(t.rate || '').trim() === '' ? '' : Number(t.rate), ok: !!t.ok }));
    const ok = await commitOrg(o => ({ ...o, wht: { ...(o.wht || {}), types: out } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'wht.types', title: 'حدّث أنواع ضريبة الاستقطاع', details: out.map(t => t.name + ' ' + (t.rate === '' ? '—' : t.rate + '%') + (t.ok ? ' ✓' : '')).join('، ') });
    if (ok) { setT(null); say('حُفظت الأنواع ✓'); } };
  const xlsx = () => {
    const rows = [['سجل ضريبة الاستقطاع — شهر ' + ym], [], ['التاريخ', 'رقم السند', 'المورد', 'الدولة', 'النوع', 'النسبة %', 'الإجمالي', 'الاستقطاع', 'الصافي'],
      ...R.rows.map(x => [x.date, x.no, x.sup, x.country, x.type, x.rate, x.gross, x.wht, x.net]), ['المجموع', '', '', '', '', '', R.tot.gross, R.tot.wht, R.tot.net]];
    try { const blob = makeXlsx([{ name: 'الاستقطاع ' + ym, rows }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ضريبة_الاستقطاع_' + ym + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 4000); } catch (e) { console.warn(e); } };
  const ed = T || types.map(t => ({ ...t, rate: t.rate === '' || t.rate == null ? '' : String(t.rate) }));
  const setRow = (i, patch) => setT(ed.map((x, k) => k === i ? { ...x, ...patch } : x));
  return (<div className="card" data-whtcard>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />ضريبة الاستقطاع — المدفوعات لغير المقيمين</div><span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّلة' : 'غير مفعّلة'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>بقرار المجلس وإجابات المالك (العقود بالإجمالي): يُسدَّد المورد غير المقيم بسند صرف بالمبلغ الإجمالي، فيُخصم الاستقطاع ويُدفع الصافي:
      مدين ذمم الموردين بالإجمالي / دائن الصندوق أو البنك بالصافي / دائن <b>2107 ضريبة استقطاع مستحقة</b>. التوريد للهيئة بقيد يدوي (مدين 2107 / دائن البنك).
      <b> لا نسب ولا مواعيد مبرمجة:</b> يدخل المحاسب الأنواع ونسبها، ولا يُستخدم النوع إلا إن وُسم «أكّده المختص». وسم المورد «غير مقيم» من بطاقته في جهات الاتصال.</div>
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
      <span>رصيد 2107 (مستحق للهيئة): <b className="num" data-wht-bal>{money(bal)}</b> ر.س</span>
      {can && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={flip} data-wht-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}</div>
    {(on || types.length > 0) && <>
      <div className="tw"><table className="tb" data-wht-types><thead><tr><th>النوع</th><th>النسبة %</th><th>أكّده المختص</th><th /></tr></thead><tbody>
        {ed.map((t, i) => <tr key={t.id || 'n' + i}>
          <td><input className="inp" aria-label="اسم نوع الاستقطاع" disabled={!can} value={t.name || ''} onChange={e => setRow(i, { name: e.target.value })} /></td>
          <td><input className="inp n" style={{ width: 90 }} inputMode="decimal" aria-label="نسبة نوع الاستقطاع" disabled={!can} value={t.rate ?? ''} onChange={e => setRow(i, { rate: e.target.value.replace(/[^\d.]/g, ''), ok: false })} /></td>
          <td><label className="row" style={{ gap: 5, fontSize: 12 }}><input type="checkbox" aria-label="أكّده المختص" disabled={!can} checked={!!t.ok} onChange={e => setRow(i, { ok: e.target.checked })} />{t.ok ? 'مؤكَّد' : 'غير مؤكَّد'}</label></td>
          <td>{can && <button className="btn sm gh" aria-label="حذف النوع" onClick={() => setT(ed.filter((_, k) => k !== i))}><Trash2 size={12} /></button>}</td></tr>)}
        {!ed.length && <tr><td colSpan={4}><div className="empty">لا أنواع بعد — أضفها بعد تأكيد المختص</div></td></tr>}
      </tbody></table></div>
      {can && <div className="row" style={{ gap: 6, marginTop: 6 }}><button className="btn sm gh" onClick={() => setT([...ed, { name: '', rate: '', ok: false }])} data-wht-add><Plus size={12} />نوع</button>
        {T && <button className="btn sm pri" onClick={save} data-wht-save><Check size={12} />حفظ الأنواع</button>}</div>}
      <div className="hint" style={{ marginTop: 4 }}>تغيير النسبة يلغي وسم «أكّده المختص» حتى يُعاد تأكيده. السندات السابقة تحتفظ بنسبتها.</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <span className="lbl" style={{ margin: 0 }}>السجل الشهري</span>
        <input className="inp" type="month" aria-label="شهر سجل الاستقطاع" value={ym} onChange={e => setYm(e.target.value)} />
        <span style={{ fontSize: 12 }} data-wht-month>{R.rows.length} سند · الإجمالي <b className="num">{money(R.tot.gross)}</b> · الاستقطاع <b className="num">{money(R.tot.wht)}</b> · الصافي <b className="num">{money(R.tot.net)}</b></span>
        <button className="btn sm gh" onClick={xlsx} disabled={!R.rows.length} data-wht-xlsx><Download size={13} />Excel</button></div>
    </>}
  </div>);
}
