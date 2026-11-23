/* v53.1 — استيراد فواتير المصروفات والمشتريات من كشف Excel/CSV (طلب المالك 2026-11-22)
   ارفع الملف ← يتعرّف على الأعمدة ← معاينة بحالة كل سطر ← تُحفظ الصالحة فقط كفواتير خدمات ومصروفات بحساباتها (والموردون الجدد إن اخترت) */
import React, { useState, useMemo } from 'react';
import { Upload, Download, Check } from 'lucide-react';
import { Modal, Field, money, uid, today, nextPartnerCode, parseCsvGrid, parseXlsxGrid, makeXlsx, buildAccounting, xiDetect, xiPlan, xiRecords, XI_AR, XI_TEMPLATE, INV_CLS } from '../../App.jsx';

const PM_L = { credit: 'آجل', cash: 'نقدًا (الصندوق)', bank: 'بنك/شبكة', cheque: 'شيك' };

export function ExpImport({ org, ops, me, commit, commitOrg, say, onClose }) {
  const [file, setFile] = useState(null);   // {name, sheets:[{name,grid,det}], si}
  const [opts, setOpts] = useState({ createSup: true, createAcc: false, inclVat: false, addVat: false, defAcc: '', defBranch: '', defPay: 'credit' });
  const [busy, setBusy] = useState(false); const [onlyBad, setOnlyBad] = useState(false); const [prog, setProg] = useState('');
  const sheet = file ? file.sheets[file.si] : null;
  const accounts = useMemo(() => buildAccounting(org, {}).accounts.filter(a => String(a.code) !== '2101').map(a => ({ code: String(a.code), name: a.name })).sort((x, y) => x.code.localeCompare(y.code)), [org]);
  const plan = useMemo(() => (sheet && sheet.det ? xiPlan(sheet.grid, sheet.det, { org, ops, opts: { ...opts, accounts } }) : null), [sheet, opts, org, ops, accounts]);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      // v53.2: ملف بعدة أوراق ⇒ تُفحص كلها وتُختار تلقائيًا الورقة التي تعرّفنا على أعمدتها وبها أكثر الأسطر
      const raw = /\.xlsx$/i.test(f.name) ? await parseXlsxGrid(await f.arrayBuffer(), { all: true }) : [{ name: f.name, grid: parseCsvGrid(await f.text()) }];
      const sheets = (raw || []).map(s => ({ name: s.name, grid: s.grid || [], det: xiDetect(s.grid || []) }));
      let si = -1; sheets.forEach((s, i) => { if (s.det && (si < 0 || s.grid.length > sheets[si].grid.length)) si = i; });
      setFile({ name: f.name, sheets, si: si < 0 ? 0 : si });
      if (si < 0) say('لم أتعرّف على أعمدة الكشف في أي ورقة — يلزم على الأقل: التاريخ والمورد أو البيان والمبلغ. نزّل النموذج للمقارنة', 'no');
      else if (sheets.length > 1) say('اختيرت ورقة «' + sheets[si].name + '» (' + (sheets[si].grid.length - sheets[si].det.header - 1) + ' سطرًا) — يمكنك تغييرها');
    } catch { say('تعذّرت قراءة الملف — احفظه بصيغة xlsx أو CSV وأعد رفعه', 'no'); }
  };
  const template = () => { try { const blob = makeXlsx([{ name: 'فواتير المصروفات', rows: XI_TEMPLATE }]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'نموذج استيراد فواتير المصروفات.xlsx'; document.body.appendChild(a); a.click(); a.remove(); } catch { say('تعذّر إنشاء النموذج', 'no'); } };
  const save = async () => {
    if (!plan || !plan.ok) return say('لا أسطر صالحة للحفظ', 'no');
    if (!window.confirm('حفظ ' + plan.ok + ' فاتورة بإجمالي ' + money(plan.sum) + ' ر.س' + (plan.newSup.length ? ' وإنشاء ' + plan.newSup.length + ' مورد جديد' : '') + '؟' + (plan.bad ? '\n' + plan.bad + ' سطر به ملاحظة لن يُحفظ.' : ''))) return;
    setBusy(true);
    try {
      const supIds = {};
      // v53.2: الحسابات الجديدة والموردون الجدد في حفظ واحد للإعدادات
      const nCls = Object.keys(plan.accCls || {}).length;
      if (plan.newAcc.length || plan.newSup.length || plan.supVatFix.length || nCls) {
        const ok = await commitOrg(d => {
          const have = new Set([...(d.customAccounts || []).map(a => String(a.code)), ...accounts.map(a => a.code)]);
          const fix = new Map(plan.supVatFix.map(f => [f.id, f.vatNo]));
          const sups = (d.suppliers || []).map(s => fix.has(s.id) && !String(s.vatNo || '').trim() ? { ...s, vatNo: fix.get(s.id), taxable: true } : s); const all = sups.map(s => ({ ...s, type: 'supplier' }));
          plan.newSup.forEach(s => { const id = uid('sp'); const code = nextPartnerCode(all, 'supplier'); all.push({ code, type: 'supplier' }); supIds[s.id] = id;
            sups.push({ id, code, name: s.name, category: '', phone: '', vatNo: s.vatNo || '', address: '', taxable: !!s.vatNo, terms: 0, createdAt: today(), source: 'xi' }); });
          return { ...d, accCls: { ...(d.accCls || {}), ...(plan.accCls || {}) }, suppliers: sups, customAccounts: [...(d.customAccounts || []), ...plan.newAcc.filter(a => !have.has(a.code))] }; },
          { actionType: 'create', targetType: 'partner', targetId: 'xi', title: 'أضاف موردين وحسابات من استيراد فواتير المصروفات',
            details: [plan.newSup.length ? plan.newSup.length + ' مورد' : '', plan.supVatFix.length ? 'استكمال الرقم الضريبي لـ ' + plan.supVatFix.length + ' مورد' : '', plan.newAcc.length ? 'حسابات: ' + plan.newAcc.map(a => a.code).join('، ') : '', nCls ? 'تصنيف ' + nCls + ' حساب (مشتريات/مصروفات)' : ''].filter(Boolean).join(' · ') });
        if (ok === false) return;
      }
      const batch = uid('xb'); const recs = xiRecords(plan, { me, supIds, batch });
      // v53.2: الملفات الكبيرة على دفعات من 300 فاتورة — كل دفعة حفظ مستقل يظهر تقدّمه، ويتوقف عند أول تعذّر (ما حُفظ يبقى ولا يتكرر عند الإعادة)
      const N = 300; let done = 0;
      for (let i = 0; i < recs.length; i += N) {
        const part = recs.slice(i, i + N); setProg('جارٍ الحفظ ' + Math.min(i + N, recs.length) + ' / ' + recs.length);
        const ok = await commit(d => ({ ...d, invoices: [...part, ...(d.invoices || [])] }), { actionType: 'create', targetType: 'expense', targetId: batch + ':' + (i / N + 1), title: 'استورد فواتير مصروفات من Excel', details: file.name + ' · دفعة ' + (i / N + 1) + ' · ' + part.length + ' فاتورة · ' + money(part.reduce((a, r) => a + r.amount, 0)) });
        if (ok === false) { say('توقف الاستيراد بعد ' + done + ' فاتورة — أعد رفع الملف، فالمحفوظ يظهر «مسجّلة سابقًا» ولا يتكرر', 'no'); return; }
        done += part.length;
      }
      say('استُوردت ' + done + ' فاتورة مشتريات ومصروفات وقُيّدت على حساباتها ✓ — لكل فاتورة رقم قيد ثابت PJ-، وللدفعة رقم موحد IMP- تبحث به في القائمة'); onClose();
    } finally { setBusy(false); setProg(''); }
  };
  // v53.4: تطبيق تصنيف الحسابات وحده (إعادة رفع ملف استُورد قبل v53.4 — أسطره «مسجّلة سابقًا»)
  const applyCls = async () => {
    const m = plan && plan.accCls; const n = m ? Object.keys(m).length : 0; if (!n) return;
    if (!window.confirm('تصنيف ' + n + ' حساب كما في الملف (مشتريات/مصروفات/أصول)؟ يُطبَّق على كل الفواتير المسجّلة على هذه الحسابات وعلى قائمة الدخل، دون تغيير أي مبلغ أو قيد.')) return;
    const ok = await commitOrg(d => ({ ...d, accCls: { ...(d.accCls || {}), ...m } }), { actionType: 'update', targetType: 'account', targetId: 'acc-cls', title: 'صنّف حسابات المشتريات والمصروفات من ملف الاستيراد', details: Object.entries(m).map(([c, v]) => c + ' ' + INV_CLS[v]).join('، ') });
    if (ok !== false) say('صُنّفت ' + n + ' حساب ✓ — المشتريات والمصروفات مفصولة الآن في قائمة الموردين وقائمة الدخل');
  };
  const O = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  const rowsAll = plan ? (onlyBad ? plan.rows.filter(r => !r.ok) : plan.rows) : []; const LIM = 300; const rows = rowsAll.slice(0, LIM);
  return (
    <Modal title="استيراد فواتير المشتريات والمصروفات من Excel" icon={Upload} onClose={onClose} wide
      foot={<><button className="btn gh" onClick={onClose}>إلغاء</button><button className="btn pri" data-xisave disabled={busy || !plan || !plan.ok} onClick={save}><Check size={14} />{busy ? 'جارٍ الحفظ…' : 'حفظ ' + (plan ? plan.ok : 0) + ' فاتورة'}</button></>}>
      <div className="note" style={{ marginBottom: 8 }}>كشف بسطر لكل فاتورة: التاريخ، المورد، رقم الفاتورة، الفرع، البيان، الحساب (رقمه أو اسمه)، المبلغ قبل الضريبة والضريبة أو الإجمالي، وطريقة الدفع. تُسجَّل «فواتير خدمات ومصروفات» بقيدها، ولا يُحفظ السطر الذي به ملاحظة.</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn sm pri" style={{ cursor: 'pointer' }}><Upload size={14} />رفع الكشف (xlsx/CSV)<input type="file" accept=".xlsx,.csv,text/csv" aria-label="ملف الكشف" style={{ display: 'none' }} onChange={pick} /></label>
        <button className="btn sm gh" onClick={template}><Download size={14} />نموذج فارغ</button>
        {file && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{file.name}</span>}
        {file && file.sheets.length > 1 && <select className="sel" aria-label="الورقة" style={{ width: 'auto' }} value={file.si} onChange={e => setFile(x => ({ ...x, si: Number(e.target.value) }))}>
          {file.sheets.map((s, i) => <option key={i} value={i}>{s.name}{s.det ? '' : ' (غير متعرَّف)'}</option>)}</select>}
      </div>
      <div className="note" style={{ marginTop: 8, borderColor: 'rgba(217,164,65,.5)' }}>تأكد أن هذه الفواتير غير مسجّلة في النظام من طريق آخر (مصروفات الإغلاق اليومي، أو «فاتورة توريد»، أو قيود يدوية) — وإلا تتكرر التكلفة. النظام يمنع تكرار رقم فاتورة المورد نفسه فقط.</div>
      {sheet && sheet.det && <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 6 }} data-ximap>الأعمدة المعروفة: {Object.keys(sheet.det.map).map(k => XI_AR[k]).join('، ')}</div>}
      {sheet && sheet.det && <div className="grid g3" style={{ marginTop: 8 }}>
        <Field label="الحساب حين لا يُعرف"><select className="sel" aria-label="الحساب الافتراضي" value={opts.defAcc} onChange={e => O('defAcc', e.target.value)}><option value="">— بلا (السطر يحتاج حسابًا) —</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
        <Field label="الفرع حين لا يُذكر"><select className="sel" aria-label="الفرع الافتراضي" value={opts.defBranch} onChange={e => O('defBranch', e.target.value)}><option value="">المركز الرئيسي</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="الدفع حين لا يُذكر"><select className="sel" aria-label="الدفع الافتراضي" value={opts.defPay} onChange={e => O('defPay', e.target.value)}>{Object.entries(PM_L).filter(([k]) => k !== 'cheque').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>}
      {sheet && sheet.det && <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginTop: 4 }}>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={opts.createSup} onChange={e => O('createSup', e.target.checked)} />إنشاء الموردين غير الموجودين</label>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" aria-label="إنشاء الحسابات" checked={opts.createAcc} onChange={e => O('createAcc', e.target.checked)} />إنشاء حسابات المصروفات غير الموجودة (5xxx/6xxx) بأسمائها من الملف</label>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={opts.inclVat} onChange={e => O('inclVat', e.target.checked)} />الإجمالي شامل الضريبة (عند غياب عمودها)</label>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={opts.addVat} onChange={e => O('addVat', e.target.checked)} />أضف الضريبة على «قبل الضريبة» (عند غياب عمودها)</label>
      </div>}
      {plan && <>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', margin: '10px 0 6px', fontSize: 13 }} data-xisum>
          <span>صالحة: <b className="num" style={{ color: 'var(--mint)' }}>{plan.ok}</b></span><span>بها ملاحظة: <b className="num" style={{ color: plan.bad ? 'var(--rose)' : 'inherit' }}>{plan.bad}</b></span>
          <span>إجمالي الصالحة: <b className="num">{money(plan.sum)}</b></span><span>منها ضريبة مدخلات: <b className="num">{money(plan.vatSum)}</b></span>{plan.newSup.length > 0 && <span>موردون جدد: <b className="num">{plan.newSup.length}</b></span>}
          {plan.newAcc.length > 0 && <span>حسابات جديدة: <b className="num">{plan.newAcc.length}</b></span>}
          {Object.keys(plan.clsSum || {}).length > 0 && <span data-xicls>{Object.entries(plan.clsSum).map(([k, v]) => (INV_CLS[k] || k) + ': ' + money(v)).join(' · ')}</span>}
          {plan.bad > 0 && <label className="row" style={{ gap: 4, marginInlineStart: 'auto' }}><input type="checkbox" checked={onlyBad} onChange={e => setOnlyBad(e.target.checked)} />الملاحظات فقط</label>}
        </div>
        <div className="tw" style={{ maxHeight: 360, overflow: 'auto' }}><table className="tb" data-xitable><thead><tr><th>سطر</th><th>التاريخ</th><th>المورد</th><th>رقم</th><th>الفرع</th><th>الحساب</th><th style={{ textAlign: 'end' }}>قبل الضريبة</th><th style={{ textAlign: 'end' }}>الضريبة</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.line} data-xirow={r.line} style={r.ok ? null : { background: 'rgba(217,84,77,.06)' }}>
            <td className="num">{r.line}</td><td className="num">{r.date || '—'}</td><td>{r.supName || '—'}{r.sp && r.sp._new ? <small style={{ color: 'var(--amber)' }}> (جديد)</small> : null}</td><td className="num">{r.no || 'تلقائي'}</td>
            <td>{r.branch ? r.branch.name : 'المركز'}</td><td>{r.acc ? r.acc.code + ' · ' + r.acc.name + (r.acc._new ? ' (جديد)' : '') : '—'}{r.cls ? <div><span className={'badge ' + (r.cls === 'pur' ? 'b-mint' : r.cls === 'asset' ? 'b-sky' : 'b-amber')} style={{ fontSize: 9 }}>{INV_CLS[r.cls]}</span></div> : null}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.net)}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.vat)}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.total)}</td>
            <td>{PM_L[r.pm]}</td><td style={{ color: r.ok ? 'var(--mint)' : 'var(--rose)', fontSize: 12 }}>{r.ok ? '✓' : r.err.join(' · ')}</td></tr>)}</tbody></table></div>
        {rowsAll.length > LIM && <div className="hint" style={{ marginTop: 4 }}>يُعرض أول {LIM} سطر من {rowsAll.length} — كلها تُفحص وتُحفظ. اختر «الملاحظات فقط» لرؤية المرفوض.</div>}
        {plan.bad > 0 && <div className="note" style={{ marginTop: 6 }} data-xiwhy>أسباب الرفض: {Object.entries(plan.rows.filter(r => !r.ok).reduce((m, r) => { r.err.forEach(e => { const k = e.replace(/: .*/, ''); m[k] = (m[k] || 0) + 1; }); return m; }, {})).map(([k, n]) => k + ' (' + n + ')').join(' · ')}</div>}
        {Object.keys(plan.accCls || {}).length > 0 && <div className="note" style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }} data-xiclsnote>
          <span>الملف يصنّف {Object.keys(plan.accCls).length} حسابًا ({Object.entries(plan.accCls).map(([c, v]) => c + ' ' + INV_CLS[v]).join('، ')}).{plan.ok ? ' يُطبَّق مع الحفظ.' : plan.dupN ? ' أسطره مسجّلة سابقًا — طبّق التصنيف وحده لتُفنَّد فواتيرك المستوردة.' : ''}</span>
          <button className="btn sm pri" data-xiapplycls disabled={busy} onClick={applyCls}>تطبيق التصنيف فقط</button></div>}
        {(plan.accMixed || []).length > 0 && <div className="hint" style={{ marginTop: 4 }}>حسابات بتصنيفين مختلفين في الملف لم تُصنَّف: {plan.accMixed.join('، ')} — الفاتورة نفسها تحتفظ بتصنيف سطرها.</div>}
        {prog && <div className="note" style={{ marginTop: 6 }} data-xiprog>{prog}</div>}
      </>}
    </Modal>);
}
