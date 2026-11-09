/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Upload, Scale, Check, FileText } from 'lucide-react';
import { APPS, Field, LOCK_MSG, PAY_GUESS, money, nowISO, parseCsvGrid, parseXlsxGrid, periodLocked, piAggregate, piDetect, piNorm, posR2, sha256Hex, sum, uid } from '../../App.jsx';

export function PosImport({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const brs = (myBranches || []).filter(b => b.isActive !== false);
  const apps = org.deliveryApps || APPS;
  const saved = org.posImportMap || {};
  const [st, setSt] = useState(null);   // {name, grid, cfg}
  const [res, setRes] = useState(null);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const grid = /\.xlsx$/i.test(f.name) ? await parseXlsxGrid(await f.arrayBuffer()) : parseCsvGrid(await f.text());
      if (!grid || grid.length < 2) return say('الملف فارغ أو غير مقروء', 'no');
      const d = piDetect(grid);
      if (!d) return say('لم أجد عمود التاريخ وعمود الإجمالي أو طريقة الدفع في أول 15 سطرًا — تأكد من صف العناوين', 'no');
      const brVals = d.map.branch >= 0 ? [...new Set(grid.slice(d.start).map(r => String((r || [])[d.map.branch] || '').trim()).filter(Boolean))] : [];
      const brMap = {}; brVals.forEach(v => { const b = brs.find(x => piNorm(x.name) === piNorm(v) || piNorm(v).includes(piNorm(x.name)) || piNorm(x.name).includes(piNorm(v))); brMap[v] = (saved.br || {})[v] || (b ? b.id : ''); });
      const payVals = d.layout === 'summary' ? d.payCols.map(ci => String(d.headers[ci] || '').trim()) : (d.map.pay >= 0 ? [...new Set(grid.slice(d.start).map(r => String((r || [])[d.map.pay] || '').trim()).filter(Boolean))] : []);
      const payMap = {}; payVals.forEach(v => { payMap[v] = (saved.pay || {})[v] || PAY_GUESS(v, apps); });
      setRes(null); setSt({ name: f.name, grid, cfg: { ...d, brMap, payMap, branchId: (brs[0] || {}).id || '' }, brVals, payVals });
    } catch { say('تعذّرت قراءة الملف — احفظه بصيغة xlsx أو CSV', 'no'); }
  };
  const run = () => setRes(piAggregate(st.grid, st.cfg));
  const save = async () => {
    const days = res.days.filter(x => x.n || x.total);
    const lk = days.find(x => periodLocked(org, x.date)); if (lk) return say(LOCK_MSG(lk.date), 'no');
    const closed = days.filter(x => (ops.closings || []).some(c => c.branchId === x.branchId && c.date === x.date && (c.status === 'submitted' || c.status === 'approved')));
    const exist = days.filter(x => (ops.posImports || []).some(y => y.branchId === x.branchId && y.date === x.date));
    if ((exist.length || closed.length) && !window.confirm((exist.length ? exist.length + ' يوم مستورد سابقًا وسيُستبدل. ' : '') + (closed.length ? closed.length + ' يوم له إغلاق مُرحّل (لن يتغير الإغلاق — راجعه يدويًا). ' : '') + 'متابعة؟')) return;
    const recs = days.map(x => ({ id: uid('pi'), branchId: x.branchId, date: x.date, n: x.n, total: x.total, vat: x.vat, cash: x.cash, card: x.card, transfer: x.transfer, apps: x.apps, nosCount: x.nos.length, nosSig: x.nos.length ? sha256Hex(x.nos.slice().sort().join('|')) : '', file: st.name, by: me.name, at: nowISO() }));
    const ok = await commit(d => ({ ...d, posImports: [...(d.posImports || []).filter(y => !recs.some(r => r.branchId === y.branchId && r.date === y.date)), ...recs] }),
      { actionType: 'create', targetType: 'pos_import', targetId: recs[0] && recs[0].id, title: 'استيراد مبيعات نقاط البيع', details: st.name + ' · ' + recs.length + ' يوم/فرع · ' + money(recs.reduce((a, r) => a + r.total, 0)) });
    if (!ok) return;
    // حفظ الربط لتصبح الرفعات القادمة تلقائية
    await commitOrg(d => ({ ...d, posImportMap: { br: { ...((d.posImportMap || {}).br || {}), ...st.cfg.brMap }, pay: { ...((d.posImportMap || {}).pay || {}), ...st.cfg.payMap } } }), { actionType: 'update', targetType: 'settings', targetId: 'posImportMap', title: 'حفظ ربط استيراد نقاط البيع', details: st.name });
    say('استُورد ' + recs.length + ' يوم ✓ — افتح الإغلاق اليومي واضغط «تعبئة من نقطة البيع»'); setSt(null); setRes(null);
  };
  const brName = (id) => (brs.find(b => b.id === id) || {}).name || id;
  const appName = (id) => (apps.find(a => a.id === id) || {}).n || id;
  const payOpts = (<><option value="">— تجاهل —</option><option value="cash">نقدي</option><option value="card">شبكة / مدى</option><option value="transfer">تحويل</option>{apps.map(a => <option key={a.id} value={'app:' + a.id}>{a.n}</option>)}</>);
  const colSel = (k, lbl) => (<Field label={lbl} style={{ marginBottom: 0, minWidth: 130 }}><select className="sel" value={st.cfg.map[k]} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, map: { ...x.cfg.map, [k]: Number(e.target.value) } } }))}>
    <option value={-1}>—</option>{(st.cfg.headers || []).map((h, i) => <option key={i} value={i}>{String(h || 'عمود ' + (i + 1)).slice(0, 24)}</option>)}</select></Field>);
  const recent = (ops.posImports || []).filter(x => brs.some(b => b.id === x.branchId)).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 30);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="card-t" style={{ marginBottom: 6 }}><Upload size={15} color="var(--brass)" />استيراد مبيعات نقاط البيع (Excel / CSV)</div>
        <div className="note">صدّر من نظام نقاط البيع تقرير المبيعات بالفواتير (فاتورة في كل سطر: التاريخ، الفرع، رقم الفاتورة، الإجمالي، الضريبة، طريقة الدفع) أو تقريرًا يوميًا بعمود لكل طريقة دفع، ثم ارفعه هنا. تتعرّف المنصة على الأعمدة، وتحفظ ربط الفروع وطرق الدفع للمرات القادمة.</div>
        <label className="btn pri" style={{ cursor: 'pointer', marginTop: 8 }}><Upload size={14} />رفع الملف<input type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} onChange={pick} /></label>
        {st && <span className="badge b-dim" style={{ marginInlineStart: 8 }}>{st.name} · {st.cfg.layout === 'summary' ? 'ملخص يومي' : 'فاتورة لكل سطر'}</span>}
      </div>
      {st && <div className="card">
        <div className="lbl">الأعمدة (تعرّفت عليها تلقائيًا — صحّح إن لزم)</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 10 }}>
          {colSel('date', 'التاريخ')}{colSel('branch', 'الفرع')}{st.cfg.layout !== 'summary' && colSel('no', 'رقم الفاتورة')}{colSel('total', 'الإجمالي')}{colSel('vat', 'الضريبة')}{st.cfg.layout !== 'summary' ? colSel('pay', 'طريقة الدفع') : colSel('count', 'عدد الفواتير')}
          {st.cfg.map.branch < 0 && <Field label="الفرع (للملف كله)" style={{ marginBottom: 0 }}><select className="sel" value={st.cfg.branchId} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, branchId: e.target.value } }))}>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
        </div>
        {st.brVals.length > 0 && <><div className="lbl">ربط الفروع</div><div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{st.brVals.map(v => <Field key={v} label={v} style={{ marginBottom: 0 }}><select className="sel" value={st.cfg.brMap[v] || ''} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, brMap: { ...x.cfg.brMap, [v]: e.target.value } } }))}><option value="">— تجاهل —</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>)}</div></>}
        {st.payVals.length > 0 && <><div className="lbl">ربط طرق الدفع</div><div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>{st.payVals.map(v => <Field key={v} label={v} style={{ marginBottom: 0 }}><select className="sel" value={st.cfg.payMap[v] || ''} onChange={e => setSt(x => ({ ...x, cfg: { ...x.cfg, payMap: { ...x.cfg.payMap, [v]: e.target.value } } }))}>{payOpts}</select></Field>)}</div></>}
        <button className="btn pri" onClick={run}><Scale size={14} />معاينة التجميع</button>
      </div>}
      {res && <div className="card">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="badge b-brass">{res.days.length} يوم/فرع · {money(res.days.reduce((a, x) => a + x.total, 0))}</span>
          {res.issues.noBranch > 0 && <span className="badge b-amber">{res.issues.noBranch} سطر بلا فرع مربوط</span>}
          {res.issues.noPay > 0 && <span className="badge b-amber">{res.issues.noPay} مبلغ بطريقة دفع غير مربوطة</span>}
          {res.issues.badDate > 0 && <span className="badge b-dim">{res.issues.badDate} سطر بلا تاريخ (عناوين/مجاميع)</span>}
          {res.issues.dup > 0 && <span className="badge b-rose">{res.issues.dup} فاتورة مكررة استُبعدت</span>}
        </div>
        <div className="tw"><table className="tb"><thead><tr><th>التاريخ</th><th>الفرع</th><th style={{ textAlign: 'end' }}>الفواتير</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th style={{ textAlign: 'end' }}>نقدي</th><th style={{ textAlign: 'end' }}>شبكة</th><th>التطبيقات</th><th style={{ textAlign: 'end' }}>الضريبة</th><th>الفرق</th></tr></thead><tbody>
          {res.days.map(x => { const sumP = posR2(x.cash + x.card + x.transfer + Object.values(x.apps).reduce((a, y) => a + y.amount, 0)); const df = posR2(x.total - sumP); return (
            <tr key={x.branchId + x.date}><td className="num">{x.date}</td><td style={{ fontSize: 12 }}>{brName(x.branchId)}</td><td className="num" style={{ textAlign: 'end' }}>{x.n || '—'}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{money(x.total)}</td>
              <td className="num" style={{ textAlign: 'end' }}>{money(x.cash)}</td><td className="num" style={{ textAlign: 'end' }}>{money(x.card)}</td>
              <td style={{ fontSize: 11 }}>{Object.entries(x.apps).map(([id, y]) => appName(id) + ' ' + money(y.amount)).join(' · ') || '—'}</td><td className="num" style={{ textAlign: 'end' }}>{money(x.vat)}</td>
              <td>{Math.abs(df) < 0.01 ? <span className="badge b-mint">مطابق</span> : <span className="badge b-amber" title="الإجمالي لا يساوي مجموع طرق الدفع">{money(df)}</span>}</td></tr>); })}
        </tbody></table></div>
        <button className="btn pri" style={{ marginTop: 10 }} onClick={save}><Check size={14} />حفظ الاستيراد</button>
      </div>}
      <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><FileText size={15} color="var(--brass)" />آخر الأيام المستوردة</div>
        <div className="tw"><table className="tb"><thead><tr><th>التاريخ</th><th>الفرع</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th>الإغلاق</th><th>الملف</th></tr></thead><tbody>
          {recent.map(x => { const c = (ops.closings || []).find(c2 => c2.branchId === x.branchId && c2.date === x.date); const ct = c ? posR2((c.cashSales || 0) + (c.cardSales || 0) + (c.bankTransferSales || 0) + sum(c.deliverySales || [], d => d.amount || 0)) : null; return (
            <tr key={x.id}><td className="num">{x.date}</td><td style={{ fontSize: 12 }}>{brName(x.branchId)}</td><td className="num" style={{ textAlign: 'end' }}>{money(x.total)}</td>
              <td>{!c ? <span className="badge b-dim">لم يُسجَّل</span> : Math.abs(ct - x.total) < 0.01 ? <span className="badge b-mint">مطابق ✓</span> : <span className="badge b-rose">الإغلاق {money(ct)} · الفرق {money(ct - x.total)}</span>}</td>
              <td style={{ fontSize: 10.5, color: 'var(--faint)' }}>{x.file}</td></tr>); })}
          {!recent.length && <tr><td colSpan={5}><div className="empty">لا استيراد بعد.</div></td></tr>}
        </tbody></table></div>
      </div>
    </div>);
}
