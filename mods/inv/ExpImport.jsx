/* v53.1 — استيراد فواتير المصروفات والمشتريات من كشف Excel/CSV (طلب المالك 2026-11-22)
   ارفع الملف ← يتعرّف على الأعمدة ← معاينة بحالة كل سطر ← تُحفظ الصالحة فقط كفواتير خدمات ومصروفات بحساباتها (والموردون الجدد إن اخترت) */
import React, { useState, useMemo } from 'react';
import { Upload, Download, Check } from 'lucide-react';
import { Modal, Field, money, uid, today, nextPartnerCode, parseCsvGrid, parseXlsxGrid, makeXlsx, buildAccounting, xiDetect, xiPlan, xiRecords, XI_AR, XI_TEMPLATE } from '../../App.jsx';

const PM_L = { credit: 'آجل', cash: 'نقدًا (الصندوق)', bank: 'بنك/شبكة', cheque: 'شيك' };

export function ExpImport({ org, ops, me, commit, commitOrg, say, onClose }) {
  const [file, setFile] = useState(null);   // {name, grid, det}
  const [opts, setOpts] = useState({ createSup: true, inclVat: false, addVat: false, defAcc: '', defBranch: '', defPay: 'credit' });
  const [busy, setBusy] = useState(false); const [onlyBad, setOnlyBad] = useState(false);
  const accounts = useMemo(() => buildAccounting(org, {}).accounts.filter(a => String(a.code) !== '2101').map(a => ({ code: String(a.code), name: a.name })).sort((x, y) => x.code.localeCompare(y.code)), [org]);
  const plan = useMemo(() => (file && file.det ? xiPlan(file.grid, file.det, { org, ops, opts: { ...opts, accounts } }) : null), [file, opts, org, ops, accounts]);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const grid = /\.xlsx$/i.test(f.name) ? await parseXlsxGrid(await f.arrayBuffer()) : parseCsvGrid(await f.text());
      const det = xiDetect(grid || []);
      setFile({ name: f.name, grid: grid || [], det });
      if (!det) say('لم أتعرّف على أعمدة الكشف — يلزم على الأقل: التاريخ والمورد أو البيان والمبلغ. نزّل النموذج للمقارنة', 'no');
    } catch { say('تعذّرت قراءة الملف — احفظه بصيغة xlsx أو CSV وأعد رفعه', 'no'); }
  };
  const template = () => { try { const blob = makeXlsx([{ name: 'فواتير المصروفات', rows: XI_TEMPLATE }]); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'نموذج استيراد فواتير المصروفات.xlsx'; document.body.appendChild(a); a.click(); a.remove(); } catch { say('تعذّر إنشاء النموذج', 'no'); } };
  const save = async () => {
    if (!plan || !plan.ok) return say('لا أسطر صالحة للحفظ', 'no');
    if (!window.confirm('حفظ ' + plan.ok + ' فاتورة بإجمالي ' + money(plan.sum) + ' ر.س' + (plan.newSup.length ? ' وإنشاء ' + plan.newSup.length + ' مورد جديد' : '') + '؟' + (plan.bad ? '\n' + plan.bad + ' سطر به ملاحظة لن يُحفظ.' : ''))) return;
    setBusy(true);
    try {
      const supIds = {};
      if (plan.newSup.length) {
        const ok = await commitOrg(d => { const sups = [...(d.suppliers || [])]; const all = sups.map(s => ({ ...s, type: 'supplier' }));
          plan.newSup.forEach(s => { const id = uid('sp'); const code = nextPartnerCode(all, 'supplier'); all.push({ code, type: 'supplier' }); supIds[s.id] = id;
            sups.push({ id, code, name: s.name, category: '', phone: '', vatNo: s.vatNo || '', address: '', taxable: !!s.vatNo, terms: 0, createdAt: today(), source: 'xi' }); });
          return { ...d, suppliers: sups }; }, { actionType: 'create', targetType: 'partner', targetId: 'xi', title: 'أنشأ موردين من استيراد فواتير المصروفات', details: plan.newSup.map(s => s.name).join('، ') });
        if (ok === false) return;
      }
      const batch = uid('xb'); const recs = xiRecords(plan, { me, supIds, batch });
      const ok = await commit(d => ({ ...d, invoices: [...recs, ...(d.invoices || [])] }), { actionType: 'create', targetType: 'expense', targetId: batch, title: 'استورد فواتير مصروفات من Excel', details: file.name + ' · ' + recs.length + ' فاتورة · ' + money(plan.sum) });
      if (ok === false) return;
      say('استُوردت ' + recs.length + ' فاتورة مصروفات وقُيّدت على حساباتها ✓'); onClose();
    } finally { setBusy(false); }
  };
  const O = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  const rows = plan ? (onlyBad ? plan.rows.filter(r => !r.ok) : plan.rows) : [];
  return (
    <Modal title="استيراد فواتير المصروفات من Excel" icon={Upload} onClose={onClose} wide
      foot={<><button className="btn gh" onClick={onClose}>إلغاء</button><button className="btn pri" data-xisave disabled={busy || !plan || !plan.ok} onClick={save}><Check size={14} />{busy ? 'جارٍ الحفظ…' : 'حفظ ' + (plan ? plan.ok : 0) + ' فاتورة'}</button></>}>
      <div className="note" style={{ marginBottom: 8 }}>كشف بسطر لكل فاتورة: التاريخ، المورد، رقم الفاتورة، الفرع، البيان، الحساب (رقمه أو اسمه)، المبلغ قبل الضريبة والضريبة أو الإجمالي، وطريقة الدفع. تُسجَّل «فواتير خدمات ومصروفات» بقيدها، ولا يُحفظ السطر الذي به ملاحظة.</div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn sm pri" style={{ cursor: 'pointer' }}><Upload size={14} />رفع الكشف (xlsx/CSV)<input type="file" accept=".xlsx,.csv,text/csv" aria-label="ملف الكشف" style={{ display: 'none' }} onChange={pick} /></label>
        <button className="btn sm gh" onClick={template}><Download size={14} />نموذج فارغ</button>
        {file && <span style={{ fontSize: 12, color: 'var(--dim)' }}>{file.name}</span>}
      </div>
      {file && file.det && <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 6 }} data-ximap>الأعمدة المعروفة: {Object.keys(file.det.map).map(k => XI_AR[k]).join('، ')}</div>}
      {file && file.det && <div className="grid g3" style={{ marginTop: 8 }}>
        <Field label="الحساب حين لا يُعرف"><select className="sel" aria-label="الحساب الافتراضي" value={opts.defAcc} onChange={e => O('defAcc', e.target.value)}><option value="">— بلا (السطر يحتاج حسابًا) —</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></Field>
        <Field label="الفرع حين لا يُذكر"><select className="sel" aria-label="الفرع الافتراضي" value={opts.defBranch} onChange={e => O('defBranch', e.target.value)}><option value="">المركز الرئيسي</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="الدفع حين لا يُذكر"><select className="sel" aria-label="الدفع الافتراضي" value={opts.defPay} onChange={e => O('defPay', e.target.value)}>{Object.entries(PM_L).filter(([k]) => k !== 'cheque').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>}
      {file && file.det && <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginTop: 4 }}>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={opts.createSup} onChange={e => O('createSup', e.target.checked)} />إنشاء الموردين غير الموجودين</label>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={opts.inclVat} onChange={e => O('inclVat', e.target.checked)} />الإجمالي شامل الضريبة (عند غياب عمودها)</label>
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={opts.addVat} onChange={e => O('addVat', e.target.checked)} />أضف الضريبة على «قبل الضريبة» (عند غياب عمودها)</label>
      </div>}
      {plan && <>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', margin: '10px 0 6px', fontSize: 13 }} data-xisum>
          <span>صالحة: <b className="num" style={{ color: 'var(--mint)' }}>{plan.ok}</b></span><span>بها ملاحظة: <b className="num" style={{ color: plan.bad ? 'var(--rose)' : 'inherit' }}>{plan.bad}</b></span>
          <span>إجمالي الصالحة: <b className="num">{money(plan.sum)}</b></span>{plan.newSup.length > 0 && <span>موردون جدد: <b className="num">{plan.newSup.length}</b></span>}
          {plan.bad > 0 && <label className="row" style={{ gap: 4, marginInlineStart: 'auto' }}><input type="checkbox" checked={onlyBad} onChange={e => setOnlyBad(e.target.checked)} />الملاحظات فقط</label>}
        </div>
        <div className="tw" style={{ maxHeight: 360, overflow: 'auto' }}><table className="tb" data-xitable><thead><tr><th>سطر</th><th>التاريخ</th><th>المورد</th><th>رقم</th><th>الفرع</th><th>الحساب</th><th style={{ textAlign: 'end' }}>قبل الضريبة</th><th style={{ textAlign: 'end' }}>الضريبة</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th>الدفع</th><th>الحالة</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.line} data-xirow={r.line} style={r.ok ? null : { background: 'rgba(217,84,77,.06)' }}>
            <td className="num">{r.line}</td><td className="num">{r.date || '—'}</td><td>{r.supName || '—'}{r.sp && r.sp._new ? <small style={{ color: 'var(--amber)' }}> (جديد)</small> : null}</td><td className="num">{r.no || 'تلقائي'}</td>
            <td>{r.branch ? r.branch.name : 'المركز'}</td><td>{r.acc ? r.acc.code + ' · ' + r.acc.name : '—'}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.net)}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.vat)}</td><td className="num" style={{ textAlign: 'end' }}>{money(r.total)}</td>
            <td>{PM_L[r.pm]}</td><td style={{ color: r.ok ? 'var(--mint)' : 'var(--rose)', fontSize: 12 }}>{r.ok ? '✓' : r.err.join(' · ')}</td></tr>)}</tbody></table></div>
      </>}
    </Modal>);
}
