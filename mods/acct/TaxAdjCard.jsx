/* v56.51 — إعدادات المقترحات الضريبية (قرار المالك «ابنِ المقترحات الأربعة» من رأي أخصائي الزكاة والضريبة في المجلس — اجتهاد يحتاج تأكيد مختص مرخّص قبل التفعيل).
   كلها معطّلة افتراضيًا: (1) الاحتساب العكسي لخدمات غير المقيم، (3) تحويل المبسّطة إلى ضريبية، (4) تعديل ضريبة الدين المعدوم.
   لا نسبة ولا مدة في الكود: النسبة من إعداد الضريبة (أو نسبة يُدخلها المالك)، والمدة يُدخلها ويُوسمها «أكّده المختص». بند الاستقطاع (2) في بطاقة الاستقطاع. */
import React, { useState } from 'react';
import { Scale, Check } from 'lucide-react';
import { Field, rcmOn, rcmRate, siConvOn, bdvOn, bdvMonths, whtRateOk, nowISO } from '../../App.jsx';

export function TaxAdjCard({ org, me, commitOrg, say, can }) {
  const rc = org.rcm || {}, bd = org.badDebtVat || {};
  const [f, setF] = useState(null);   // مسودة الأرقام
  const d = f || { rate: rc.rate ?? '', nrAcc: rc.nrAcc || '', minMonths: bd.minMonths ?? '', basis: bd.basis === 'due' ? 'due' : 'invoice', ok: !!bd.ok };
  const set = async (key, title, fn) => { if (!can) return;
    const ok = await commitOrg(o => ({ ...o, [key]: { ...(o[key] || {}), ...fn(o[key] || {}), at: nowISO(), by: (me && me.name) || '' } }), { actionType: 'settings', targetType: 'system_settings', targetId: key, title });
    if (ok) say(title + ' ✓'); return ok; };
  const flip = (key, on, label, warn) => { if (!on && !window.confirm(warn + '\n\nهذا اجتهاد من المجلس — لا تفعّله قبل تأكيد مختص مرخّص. متابعة؟')) return;
    set(key, (on ? 'أوقف ' : 'فعّل ') + label, () => ({ on: !on })); };
  const saveNums = async () => {
    if (String(d.rate).trim() && !whtRateOk(d.rate)) return say('نسبة الاحتساب العكسي بين 0 و100 أو فارغة (فتُؤخذ من إعداد الضريبة)', 'no');
    if (String(d.nrAcc).trim() && !/^5\d+$/.test(String(d.nrAcc).trim())) return say('حساب المصروف يبدأ بـ5', 'no');
    const mm = String(d.minMonths).trim(); if (mm && !(Number.isInteger(Number(mm)) && Number(mm) >= 1 && Number(mm) <= 120)) return say('المدة بالأشهر عدد صحيح من 1 إلى 120', 'no');
    if (d.ok && !mm) return say('لا يُوسم «أكّده المختص» بلا مدة', 'no');
    const at = nowISO(), by = (me && me.name) || '';
    const ok = await commitOrg(o => ({ ...o, rcm: { ...(o.rcm || {}), rate: String(d.rate).trim() === '' ? '' : Number(d.rate), nrAcc: String(d.nrAcc).trim(), at, by },
      badDebtVat: { ...(o.badDebtVat || {}), minMonths: mm === '' ? '' : Number(mm), basis: d.basis === 'due' ? 'due' : 'invoice', ok: mm !== '' && !!d.ok, at, by } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'rcm,badDebtVat', title: 'حدّث أرقام المقترحات الضريبية', details: 'نسبة الاحتساب العكسي ' + (String(d.rate).trim() || 'من إعداد الضريبة') + ' · مدة الدين المعدوم ' + (mm || '—') + (d.basis === 'due' ? ' من الاستحقاق' : ' من الفاتورة') + (mm && d.ok ? ' ✓ مؤكَّدة' : '') });
    if (ok) { setF(null); say('حُفظت ✓'); } };
  const row = (on, label, desc, key, warn, extra) => (<div className="me-row" style={{ alignItems: 'flex-start' }} data-taxadj={key}>
    <span className="me-a"><b>{label} <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span></b><small style={{ lineHeight: 1.8 }}>{desc}</small>{extra}</span>
    {can && <button className={'btn sm ' + (on ? 'gh' : 'pri')} data-taxadj-toggle={key} onClick={() => flip(key, on, label, warn)}>{on ? 'إيقاف' : 'تفعيل'}</button>}</div>);
  const rr = rcmRate(org), mmOk = bdvMonths(org);
  return (<div className="card" data-taxadj-card>
    <div className="card-h"><div className="card-t"><Scale size={15} color="var(--brass)" />مقترحات ضريبية (اجتهاد المجلس — يحتاج تأكيد مختص)</div></div>
    <div className="note" style={{ marginBottom: 8 }}>كل بند هنا <b>اجتهاد</b> من أخصائي الزكاة والضريبة في المجلس ومعطّل افتراضيًا. لا تُفعّله قبل تأكيد مختص مرخّص لانطباقه على منشأتك. التفعيل لا يغيّر أي مستند سابق.</div>
    {row(rcmOn(org), 'الاحتساب العكسي على خدمات المورد غير المقيم', 'فاتورة الخدمات أو سند الصرف لمورد موسوم «غير مقيم»: مدين ضريبة المدخلات 1501 / دائن ضريبة المخرجات 2301 بنسبة الضريبة على الإجمالي قبل الاستقطاع، بلا أثر نقدي (أو مدين المصروف إن كانت غير قابلة للاسترداد). يظهر في بند 9 من الإقرار. النسبة الحالية: ' + (rr ? rr + '%' : 'غير محددة'), 'rcm',
      'تفعيل الاحتساب العكسي؟ يُقترح تلقائيًا على مستندات الموردين غير المقيمين ويمكن إلغاؤه للخدمة المؤدّاة خارج المملكة.')}
    {row(siConvOn(org), 'تحويل الفاتورة المبسّطة إلى ضريبية', 'من «فواتير المبيعات»: لفاتورة مبسّطة غير ملغاة يُصدر إشعار دائن كامل عنها وفاتورة ضريبية جديدة بالبنود نفسها لعميل له رقم ضريبي وعنوان وطني — الصافي صفر والأصل لا يُعدَّل. فواتير الكاشير خارج النطاق الآن.', 'siConv',
      'تفعيل تحويل المبسّطة إلى ضريبية؟')}
    {row(bdvOn(org), 'تعديل ضريبة المخرجات للدين المعدوم', 'عند شطب ذمة (مخصص الخسائر الائتمانية) بعد المدة أدناه (من تاريخ الفاتورة أو الاستحقاق حسب الإعداد) ومع مرجع شهادة المحاسب القانوني أو المستند البديل: مدين 2301 / دائن مصروف الخسائر بضريبة الجزء المشطوب، ويُعكس بنسبته عند الاسترداد. المدة: ' + (mmOk ? mmOk + ' شهرًا من ' + (bd.basis === 'due' ? 'تاريخ الاستحقاق' : 'تاريخ الفاتورة') + ' (مؤكَّدة)' : 'غير مؤكَّدة — لا يُتاح التعديل'), 'badDebtVat',
      'تفعيل تعديل ضريبة الدين المعدوم؟ لا يُتاح قبل إدخال المدة ووسمها «أكّده المختص».')}
    {(can || rcmOn(org) || bdvOn(org)) && <div className="grid g3" style={{ marginTop: 8 }}>
      <Field label="نسبة الاحتساب العكسي % (فارغ = من إعداد الضريبة)"><input className="inp n" inputMode="decimal" aria-label="نسبة الاحتساب العكسي" disabled={!can} value={d.rate} onChange={e => setF({ ...d, rate: e.target.value.replace(/[^\d.]/g, '') })} /></Field>
      <Field label="حساب مصروف الضريبة غير القابلة للاسترداد (لسندات الصرف)"><input className="inp n" inputMode="numeric" aria-label="حساب الضريبة غير القابلة للاسترداد" disabled={!can} value={d.nrAcc} placeholder="5xxx" onChange={e => setF({ ...d, nrAcc: e.target.value.replace(/\D/g, '') })} /></Field>
      <Field label="مدة الدين المعدوم بالأشهر"><select className="sel" style={{ marginBottom: 4 }} aria-label="بداية مدة الدين المعدوم" disabled={!can} value={d.basis} onChange={e => setF({ ...d, basis: e.target.value, ok: false })}><option value="invoice">من تاريخ الفاتورة</option><option value="due">من تاريخ الاستحقاق</option></select><div className="row" style={{ gap: 6, alignItems: 'center' }}>
        <input className="inp n" style={{ width: 90 }} inputMode="numeric" aria-label="مدة الدين المعدوم بالأشهر" disabled={!can} value={d.minMonths} onChange={e => setF({ ...d, minMonths: e.target.value.replace(/\D/g, ''), ok: false })} />
        <label className="row" style={{ gap: 5, fontSize: 12 }}><input type="checkbox" aria-label="المدة أكّدها المختص" disabled={!can} checked={!!d.ok} onChange={e => setF({ ...d, ok: e.target.checked })} />أكّده المختص</label></div></Field>
    </div>}
    {can && f && <button className="btn sm pri" style={{ marginTop: 6 }} onClick={saveNums} data-taxadj-save><Check size={12} />حفظ الأرقام</button>}
    <div className="hint" style={{ marginTop: 4 }}>تغيير المدة أو بدايتها يلغي وسم «أكّده المختص» حتى يُعاد تأكيده. المستندات السابقة تحتفظ بأرقامها.</div>
  </div>);
}
