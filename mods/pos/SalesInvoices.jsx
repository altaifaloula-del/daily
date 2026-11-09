/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useMemo, useState } from 'react';
import { FileText, Wallet, AlertTriangle, ShieldCheck, Plus, Printer, Check, X, Banknote } from 'lucide-react';
import { Field, Kpi, LOCK_MSG, Modal, Num, ROLES, branchBanks, buildPartners, entityList, isoD, money, naMissing, nowISO, periodLocked, printSalesInvoice, rolePost, siCredited, siRem, siSorted, siStamp, siVerify, sum, today, uid } from '../../App.jsx';

export function SalesInvoices({ org, ops, me, myBranches, commit, say }) {
  const all = ops.salesInvoices || [];
  const central = ROLES[me.role]?.scope === 'all';
  const brIds = (myBranches || []).map(b => b.id);
  const list = all.filter(x => central || brIds.includes(x.branchId));
  const canIssue = rolePost(me.role);
  const tax = org.taxCfg || {}; const vatRate = tax.enabled ? (Number(tax.rate) || 15) : 0;
  const customers = useMemo(() => buildPartners(org, ops).filter(p => p.type === 'customer'), [org, ops]);
  const ents = entityList(org);
  const chain = useMemo(() => siVerify(all), [all]);
  const [q, setQ] = useState(''); const [flt, setFlt] = useState('all');
  const [f, setF] = useState(null); const [rc, setRc] = useState(null); const [cn, setCn] = useState(null);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const byId = (id) => all.find(x => x.id === id);
  const custOf = (key) => customers.find(c => c.key === key);
  const custOwed = (key) => { const c = custOf(key); return c ? Math.max(0, -c.balance) : 0; };
  const fundOpts = (<><option value="1101">نقدًا — الخزينة الرئيسية</option><option value="1201">البنك التجميعي</option>{branchBanks(org).map(bb => <option key={bb.code} value={bb.code}>{bb.name}</option>)}</>);
  const lineCalc = (l) => { const qty = Number(l.qty) || 0, pr = Number(l.price) || 0, net = r2(qty * pr), vt = r2(net * (Number(l.vatRate) || 0) / 100); return { net, vat: vt }; };
  const totals = (lines) => { const L = lines.map(lineCalc); return { net: r2(sum(L, x => x.net)), vat: r2(sum(L, x => x.vat)), total: r2(sum(L, x => x.net + x.vat)) }; };
  const newInv = () => setF({ type: 'simplified', entityId: (ents[0] || {}).id || 'primary', branchId: central ? '' : (brIds[0] || ''), date: today(), time: new Date().toTimeString().slice(0, 5), customerKey: '', buyerName: '', terms: 'cash', fund: '1101', inClosing: false, lines: [{ desc: '', qty: '1', price: '', vatRate: String(vatRate) }] });

  const save = async () => {
    const x = f; const lines = (x.lines || []).filter(l => (l.desc || '').trim() && (Number(l.qty) || 0) > 0 && (Number(l.price) || 0) > 0);
    if (!lines.length) return say('أضف بندًا واحدًا على الأقل (بيان وكمية وسعر)', 'no');
    if (periodLocked(org, x.date)) return say(LOCK_MSG(x.date), 'no');
    const c = x.customerKey ? custOf(x.customerKey) : null;
    if (x.type === 'standard') {
      if (!c) return say('الفاتورة الضريبية تتطلب عميلًا من جهات الاتصال', 'no');
      if (!(c.tax || '').trim()) return say('العميل بلا رقم ضريبي — أكمله من جهات الاتصال أو أصدر فاتورة مبسّطة', 'no');
      const miss = naMissing(c.na); if (miss.length && !c.address) return say('العنوان الوطني للعميل ناقص: ' + miss.join('، '), 'no');
    }
    if (x.terms === 'credit' && !c) return say('البيع الآجل يتطلب عميلًا من جهات الاتصال', 'no');
    if (x.terms === 'credit' && x.inClosing) return say('البيع الآجل لا يكون ضمن إغلاق وردية نقدي', 'no');
    const L = lines.map(l => { const k = lineCalc(l); return { desc: l.desc.trim(), qty: Number(l.qty), price: r2(l.price), vatRate: Number(l.vatRate) || 0, net: k.net, vat: k.vat }; });
    const T = totals(lines);
    if (x.terms === 'credit') { const lim = Number(c.creditLimit) || 0; const owed = custOwed(c.key);
      if (lim > 0 && owed + T.total > lim + 0.004) { if (!ROLES[me.role]?.admin) return say('تتجاوز حد ائتمان العميل (' + money(lim) + ') — المستحق الحالي ' + money(owed) + '. يلزم اعتماد مسؤول النظام', 'no');
        if (!window.confirm('الفاتورة تتجاوز حد ائتمان العميل ' + money(lim) + ' (المستحق ' + money(owed) + '). تجاوز الحد باعتمادك؟')) return; } }
    const due = (() => { const dd = new Date(x.date + 'T12:00:00'); dd.setDate(dd.getDate() + (Number(c && c.terms) || 0)); return isoD(dd); })();
    const base = { id: uid('si'), kind: 'invoice', type: x.type, entityId: x.entityId || 'primary', branchId: x.branchId || '', date: x.date, time: x.time || '',
      customerKey: c ? c.key : '', buyer: c ? { name: c.name, vat: c.tax || '', address: c.address || '', crNo: c.crNo || '' } : { name: (x.buyerName || '').trim() },
      lines: L, net: T.net, vat: T.vat, total: T.total, terms: x.terms, ...(x.terms === 'cash' ? { fund: x.fund || '1101' } : { dueDate: due }), inClosing: !!x.inClosing, receipts: [], by: me.name, at: nowISO() };
    let made = null;
    const ok = await commit(d => { const rec = siStamp(d.salesInvoices || [], base); made = rec; return { ...d, salesInvoices: [...(d.salesInvoices || []), rec] }; },
      { actionType: 'create', targetType: 'sales_invoice', targetId: base.id, need: 'post', title: 'أصدر فاتورة مبيعات', details: (base.buyer.name || 'عميل نقدي') + ' · ' + money(T.total) + (x.terms === 'credit' ? ' · آجل' : '') });
    if (ok && made) { setF(null); say('صدرت ' + made.no + ' ✓'); printSalesInvoice(org, made); }
  };
  const saveRc = async () => {
    const x = byId(rc.id); const a = r2(rc.amount); const rem = siRem(ops, x);
    if (!(a > 0)) return say('أدخل مبلغ التحصيل', 'no'); if (a > rem + 0.004) return say('أكبر من المتبقي ' + money(rem), 'no');
    if (periodLocked(org, rc.date)) return say(LOCK_MSG(rc.date), 'no');
    const r = { id: uid('rc'), date: rc.date, amount: a, fund: rc.fund || '1201', by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, salesInvoices: (d.salesInvoices || []).map(y => y.id === x.id ? { ...y, receipts: [...(y.receipts || []), r] } : y) }),
      { actionType: 'create', targetType: 'sales_invoice', targetId: x.id, need: 'post', title: 'تحصيل من عميل', details: x.no + ' · ' + money(a) });
    if (ok) { setRc(null); say('سُجّل التحصيل ✓'); }
  };
  const saveCn = async () => {
    const o = byId(cn.id); const reason = (cn.reason || '').trim(); if (!reason) return say('اكتب سبب الإشعار الدائن', 'no');
    if (periodLocked(org, cn.date)) return say(LOCK_MSG(cn.date), 'no');
    const already = all.filter(c => c.kind === 'credit' && c.refId === o.id);
    const L = o.lines.map((l, i) => { const back = sum(already, c => ((c.lines || []).find(z => z.src === i) || {}).qty || 0); const can = Math.max(0, l.qty - back); const q2 = Math.min(Number(cn.qtys[i]) || 0, can);
      if (!(q2 > 0)) return null; const net = r2(q2 * l.price), vt = r2(net * l.vatRate / 100); return { src: i, desc: l.desc, qty: q2, price: l.price, vatRate: l.vatRate, net, vat: vt }; }).filter(Boolean);
    if (!L.length) return say('أدخل كمية مرتجعة', 'no');
    const T = { net: r2(sum(L, l => l.net)), vat: r2(sum(L, l => l.vat)) }; T.total = r2(T.net + T.vat);
    const settle = o.terms === 'credit' ? (cn.settle || 'credit') : 'cash';
    const base = { id: uid('si'), kind: 'credit', refId: o.id, type: o.type, entityId: o.entityId, branchId: o.branchId, date: cn.date, time: new Date().toTimeString().slice(0, 5), customerKey: o.customerKey, buyer: o.buyer,
      lines: L, net: T.net, vat: T.vat, total: T.total, terms: settle, ...(settle === 'cash' ? { fund: cn.fund || o.fund || '1101' } : {}), inClosing: !!o.inClosing, reason, receipts: [], by: me.name, at: nowISO() };
    let made = null;
    const ok = await commit(d => { const rec = siStamp(d.salesInvoices || [], base); made = rec; return { ...d, salesInvoices: [...(d.salesInvoices || []), rec] }; },
      { actionType: 'create', targetType: 'sales_invoice', targetId: base.id, need: 'post', title: 'أصدر إشعارًا دائنًا للمبيعات', details: 'عن ' + o.no + ' · ' + money(T.total) + ' · ' + reason });
    if (ok && made) { setCn(null); say('صدر ' + made.no + ' (إشعار دائن) ✓'); printSalesInvoice(org, made, o); }
  };

  const mth = today().slice(0, 7);
  const invs = list.filter(x => x.kind === 'invoice');
  const kMonth = r2(sum(invs.filter(x => (x.date || '').startsWith(mth)), x => x.total) - sum(list.filter(x => x.kind === 'credit' && (x.date || '').startsWith(mth)), x => x.total));
  const kOpen = r2(sum(invs, x => siRem(ops, x)));
  const kOver = r2(sum(invs.filter(x => x.dueDate && x.dueDate < today()), x => siRem(ops, x)));
  const FLT = { all: () => true, open: x => x.kind === 'invoice' && siRem(ops, x) > 0, credit: x => x.kind === 'invoice' && x.terms === 'credit', cash: x => x.kind === 'invoice' && x.terms !== 'credit', cn: x => x.kind === 'credit' };
  const shown = siSorted(list).reverse().filter(x => (FLT[flt] || FLT.all)(x)
    && (!q.trim() || [x.no, (x.buyer || {}).name, (x.buyer || {}).vat].some(v => v && String(v).includes(q.trim()))));
  const T = f ? totals(f.lines || []) : null;
  const fc = f && f.customerKey ? custOf(f.customerKey) : null;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Kpi label="مبيعات الفواتير هذا الشهر" value={money(kMonth)} sub="بعد الإشعارات الدائنة" icon={FileText} color="#C8A24A" />
        <Kpi label="ذمم العملاء المفتوحة" value={money(kOpen)} sub="فواتير آجلة لم تُحصَّل" icon={Wallet} color="#5B93C4" />
        <Kpi label="متأخرة السداد" value={money(kOver)} sub="تجاوزت تاريخ الاستحقاق" icon={AlertTriangle} color="#D9544D" />
        <Kpi label="سلامة السجل" value={chain.ok ? 'سليم ✓' : 'خلل!'} sub={chain.ok ? (chain.n || 0) + ' مستند بسلسلة بصمات متصلة' : chain.why} icon={ShieldCheck} color={chain.ok ? '#4FB286' : '#D9544D'} />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'الكل'], ['open', 'مفتوحة'], ['credit', 'آجلة'], ['cash', 'نقدية'], ['cn', 'إشعارات دائنة']].map(([k, t]) => (
          <button key={k} className={'btn sm' + (flt === k ? ' pri' : ' gh')} onClick={() => setFlt(k)}>{t}</button>))}
        <input className="inp" style={{ width: 220, marginInlineStart: 'auto' }} placeholder="ابحث بالرقم أو العميل أو الرقم الضريبي…" value={q} onChange={e => setQ(e.target.value)} />
        {canIssue && <button className="btn sm pri" onClick={newInv}><Plus size={14} />فاتورة مبيعات</button>}
      </div>
      <div className="card"><div className="tw"><table className="tb">
        <thead><tr><th>الرقم</th><th>العميل</th><th>النوع</th><th style={{ textAlign: 'end' }}>الإجمالي</th><th style={{ textAlign: 'end' }}>المتبقي</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          {shown.map(x => { const rem = siRem(ops, x), crd = siCredited(ops, x), o = x.kind === 'credit' ? byId(x.refId) : null; return (
            <tr key={x.id}>
              <td><span className="num" style={{ fontSize: 11.5, fontWeight: 700 }}>{x.no}</span><div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{x.date} · {x.by}</div></td>
              <td style={{ fontSize: 12.5 }}>{(x.buyer || {}).name || <span style={{ color: 'var(--faint)' }}>عميل نقدي</span>}{(x.buyer || {}).vat ? <div className="num" style={{ fontSize: 9.5, color: 'var(--faint)' }}>{x.buyer.vat}</div> : null}</td>
              <td><span className="badge b-dim">{x.kind === 'credit' ? 'إشعار دائن' + (o ? ' عن ' + o.no : '') : (x.type === 'standard' ? 'ضريبية' : 'مبسّطة') + ' · ' + (x.terms === 'credit' ? 'آجل' : 'نقدي')}</span>{x.inClosing && <div><span className="badge b-dim" style={{ marginTop: 3 }}>ضمن إغلاق وردية</span></div>}</td>
              <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: x.kind === 'credit' ? 'var(--rose)' : undefined }}>{x.kind === 'credit' ? '−' : ''}{money(x.total)}</td>
              <td className="num" style={{ textAlign: 'end' }}>{x.kind === 'invoice' && x.terms === 'credit' ? money(rem) : '—'}</td>
              <td>{x.kind === 'credit' ? <span className="badge b-amber">{x.reason || 'مرتجع'}</span>
                : x.terms !== 'credit' ? <span className="badge b-mint">{crd > 0 ? 'نقدية — عليها إشعار' : 'نقدية ✓'}</span>
                : rem <= 0.004 ? <span className="badge b-mint">محصّلة ✓</span>
                : x.dueDate && x.dueDate < today() ? <span className="badge b-rose">متأخرة منذ {x.dueDate}</span>
                : <span className="badge b-sky">مستحقة {x.dueDate}</span>}</td>
              <td><div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                <button className="btn sm gh" title="طباعة" onClick={() => printSalesInvoice(org, x, o)}><Printer size={12} /></button>
                {canIssue && x.kind === 'invoice' && x.terms === 'credit' && rem > 0.004 && <button className="btn sm" onClick={() => setRc({ id: x.id, amount: String(rem), date: today(), fund: '1201' })}>تحصيل</button>}
                {canIssue && x.kind === 'invoice' && crd < x.total - 0.004 && <button className="btn sm gh" onClick={() => setCn({ id: x.id, date: today(), reason: '', settle: 'credit', fund: x.fund || '1101', qtys: x.lines.map(() => '') })}>إشعار دائن</button>}
              </div></td>
            </tr>); })}
          {shown.length === 0 && <tr><td colSpan={7}><div className="empty">لا فواتير بعد — كل فاتورة تصدر هنا تُرقَّم تلقائيًا ولا تُحذف، وتُصحَّح بإشعار دائن.</div></td></tr>}
        </tbody>
      </table></div></div>
      <div className="note">سجل دائم: الترقيم متسلسل لكل سنة («فاتورة-السنة-الرقم» للفواتير و«إشعار-السنة-الرقم» للإشعارات الدائنة)، ولكل مستند بصمة مرتبطة بسابقه فيُكشف أي تعديل أو حذف. الفاتورة الآجلة تُقيَّد على ذمم العملاء وتظهر في كشف العميل وأعمار الذمم، والنقدية على الصندوق أو البنك؛ أما المسجّلة ضمن إغلاق وردية فتُرقَّم وتُطبع فقط دون قيد ثانٍ.</div>

      {f && (
        <Modal title="فاتورة مبيعات جديدة" icon={FileText} wide onClose={() => setF(null)}
          foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save}><Check size={14} />إصدار وطباعة</button></>}>
          <div className="grid g4">
            <Field label="النوع"><select className="sel" value={f.type} onChange={e => setF(x => ({ ...x, type: e.target.value }))}><option value="simplified">مبسّطة (أفراد)</option><option value="standard">ضريبية (منشآت)</option></select></Field>
            {ents.length > 1 && <Field label="المنشأة البائعة"><select className="sel" value={f.entityId} onChange={e => setF(x => ({ ...x, entityId: e.target.value }))}>{ents.map(en => <option key={en.id} value={en.id}>{en.name}</option>)}</select></Field>}
            <Field label="الفرع"><select className="sel" value={f.branchId} onChange={e => setF(x => ({ ...x, branchId: e.target.value }))}>{central && <option value="">المركز الرئيسي</option>}{(myBranches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="التاريخ"><input type="date" className="inp" value={f.date} onChange={e => setF(x => ({ ...x, date: e.target.value }))} /></Field>
            <Field label="الوقت"><input type="time" className="inp" value={f.time} onChange={e => setF(x => ({ ...x, time: e.target.value }))} /></Field>
          </div>
          <div className="grid g3">
            <Field label="العميل (من جهات الاتصال)"><select className="sel" value={f.customerKey} onChange={e => setF(x => ({ ...x, customerKey: e.target.value }))}>
              <option value="">{f.type === 'standard' ? '— اختر العميل —' : 'عميل نقدي (بلا بطاقة)'}</option>{customers.map(c => <option key={c.key} value={c.key}>{c.name}{c.tax ? ' — ' + c.tax : ''}</option>)}</select></Field>
            {!f.customerKey && f.type === 'simplified' && <Field label="اسم العميل (اختياري)"><input className="inp" value={f.buyerName} onChange={e => setF(x => ({ ...x, buyerName: e.target.value }))} /></Field>}
            <Field label="طريقة البيع"><select className="sel" value={f.terms} onChange={e => setF(x => ({ ...x, terms: e.target.value, inClosing: e.target.value === 'credit' ? false : x.inClosing }))}><option value="cash">نقدي / شبكة</option><option value="credit">آجل على حساب العميل</option></select></Field>
            {f.terms === 'cash' && !f.inClosing && <Field label="المتحصَّل في"><select className="sel" value={f.fund} onChange={e => setF(x => ({ ...x, fund: e.target.value }))}>{fundOpts}</select></Field>}
          </div>
          {fc && <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {fc.tax ? <span className="badge b-dim">الرقم الضريبي {fc.tax}</span> : <span className="badge b-amber">بلا رقم ضريبي</span>}
            {f.terms === 'credit' && <span className="badge b-dim">مهلة {fc.terms || 0} يوم</span>}
            <span className="badge b-dim">المستحق عليه {money(custOwed(fc.key))}</span>
            {Number(fc.creditLimit) > 0 && <span className={'badge ' + (custOwed(fc.key) + (T ? T.total : 0) > Number(fc.creditLimit) ? 'b-rose' : 'b-dim')}>حد الائتمان {money(fc.creditLimit)}</span>}
            {f.type === 'standard' && naMissing(fc.na).length > 0 && <span className="badge b-amber">العنوان الوطني ناقص: {naMissing(fc.na).join('، ')}</span>}
          </div>}
          {f.terms === 'cash' && <label className="row" style={{ gap: 7, fontSize: 12.5, cursor: 'pointer', margin: '4px 0 8px' }}>
            <input type="checkbox" checked={!!f.inClosing} onChange={e => setF(x => ({ ...x, inClosing: e.target.checked }))} />هذا البيع مسجّل في إغلاق الوردية (تُصدر الفاتورة وتُرقَّم فقط دون قيد ثانٍ)</label>}
          <div className="lbl" style={{ margin: '4px 0 6px' }}>البنود — السعر قبل الضريبة</div>
          {(f.lines || []).map((l, i) => { const k = lineCalc(l); return (
            <div key={i} className="row" style={{ gap: 7, marginBottom: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="inp" style={{ flex: 2, minWidth: 170 }} placeholder="البيان (وجبات، تموين حفل…)" value={l.desc} onChange={e => setF(x => ({ ...x, lines: x.lines.map((z, j) => j === i ? { ...z, desc: e.target.value } : z) }))} />
              <input className="inp n" style={{ width: 80 }} inputMode="decimal" placeholder="الكمية" value={l.qty} onChange={e => setF(x => ({ ...x, lines: x.lines.map((z, j) => j === i ? { ...z, qty: e.target.value.replace(/[^\d.]/g, '') } : z) }))} />
              <input className="inp n" style={{ width: 100 }} inputMode="decimal" placeholder="سعر الوحدة" value={l.price} onChange={e => setF(x => ({ ...x, lines: x.lines.map((z, j) => j === i ? { ...z, price: e.target.value.replace(/[^\d.]/g, '') } : z) }))} />
              <select className="sel" style={{ width: 90 }} value={l.vatRate} onChange={e => setF(x => ({ ...x, lines: x.lines.map((z, j) => j === i ? { ...z, vatRate: e.target.value } : z) }))}>
                {[...new Set([String(vatRate), '15', '0'])].map(v => <option key={v} value={v}>{v}%</option>)}</select>
              <span className="num" style={{ fontSize: 12, minWidth: 90, textAlign: 'end' }}>{money(k.net + k.vat)}</span>
              {f.lines.length > 1 && <button className="btn sm gh" onClick={() => setF(x => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))}><X size={13} /></button>}
            </div>); })}
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn sm" onClick={() => setF(x => ({ ...x, lines: [...x.lines, { desc: '', qty: '1', price: '', vatRate: String(vatRate) }] }))}><Plus size={13} />بند</button>
            <span className="badge b-brass">قبل الضريبة {money(T.net)} · الضريبة {money(T.vat)} · الإجمالي {money(T.total)}</span>
          </div>
          {!tax.enabled && <div className="note" style={{ marginTop: 8 }}>ضريبة القيمة المضافة غير مفعّلة في المنصة — تُصدر الفاتورة بنسبة 0% ما لم تختر نسبة للبند.</div>}
        </Modal>
      )}

      {rc && (() => { const x = byId(rc.id); return (
        <Modal title={'تحصيل — ' + x.no + ' · ' + ((x.buyer || {}).name || '')} icon={Banknote} onClose={() => setRc(null)}
          foot={<><button className="btn gh" onClick={() => setRc(null)}>إلغاء</button><button className="btn pri" onClick={saveRc}><Check size={14} />تسجيل التحصيل</button></>}>
          <div className="mono-b" style={{ marginBottom: 10 }}><span>المتبقي</span><span className="num">{money(siRem(ops, x))}</span></div>
          <div className="grid g3">
            <Num label="المبلغ" value={rc.amount} onChange={v => setRc(r => ({ ...r, amount: v }))} />
            <Field label="التاريخ"><input type="date" className="inp" value={rc.date} onChange={e => setRc(r => ({ ...r, date: e.target.value }))} /></Field>
            <Field label="أُودِع في"><select className="sel" value={rc.fund} onChange={e => setRc(r => ({ ...r, fund: e.target.value }))}>{fundOpts}</select></Field>
          </div>
        </Modal>); })()}

      {cn && (() => { const o = byId(cn.id); const already = all.filter(c => c.kind === 'credit' && c.refId === o.id); return (
        <Modal title={'إشعار دائن عن ' + o.no} icon={FileText} onClose={() => setCn(null)}
          foot={<><button className="btn gh" onClick={() => setCn(null)}>إلغاء</button><button className="btn pri" onClick={saveCn}><Check size={14} />إصدار الإشعار</button></>}>
          <div className="grid g2">
            <Field label="التاريخ"><input type="date" className="inp" value={cn.date} onChange={e => setCn(r => ({ ...r, date: e.target.value }))} /></Field>
            <Field label="السبب"><input className="inp" value={cn.reason} placeholder="مرتجع، خطأ في السعر، إلغاء…" onChange={e => setCn(r => ({ ...r, reason: e.target.value }))} /></Field>
            {o.terms === 'credit' && <Field label="التسوية"><select className="sel" value={cn.settle} onChange={e => setCn(r => ({ ...r, settle: e.target.value }))}><option value="credit">تخفيض ذمة العميل</option><option value="cash">رد نقدي للعميل</option></select></Field>}
            {(o.terms !== 'credit' || cn.settle === 'cash') && !o.inClosing && <Field label="يُرد من"><select className="sel" value={cn.fund} onChange={e => setCn(r => ({ ...r, fund: e.target.value }))}>{fundOpts}</select></Field>}
          </div>
          {o.lines.map((l, i) => { const back = sum(already, c => ((c.lines || []).find(z => z.src === i) || {}).qty || 0); const can = Math.max(0, l.qty - back); return (
            <div key={i} className="row" style={{ gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 150, fontSize: 12.5 }}>{l.desc}<div style={{ fontSize: 9.5, color: 'var(--faint)' }}>الكمية {l.qty} · أُشعر سابقًا {back} · المتاح {can} · بسعر {money(l.price)}</div></div>
              <input className="inp n" style={{ width: 110 }} inputMode="decimal" placeholder="الكمية" disabled={can <= 0} value={cn.qtys[i]} onChange={e => setCn(r => ({ ...r, qtys: r.qtys.map((z, j) => j === i ? e.target.value.replace(/[^\d.]/g, '') : z) }))} />
              <button className="btn sm gh" disabled={can <= 0} onClick={() => setCn(r => ({ ...r, qtys: r.qtys.map((z, j) => j === i ? String(can) : z) }))}>الكل</button>
            </div>); })}
          <div className="note">الإشعار الدائن يعكس البيع والضريبة بالكميات المختارة، ولا يتجاوز ما لم يُشعَر به سابقًا.</div>
        </Modal>); })()}
    </div>
  );
}
