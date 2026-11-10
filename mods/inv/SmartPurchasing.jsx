/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Printer, Download, Check, AlertTriangle, Truck, HardDrive, Plus, ClipboardCheck } from 'lucide-react';
import { ForecastPurchase } from './ForecastPurchase.jsx';
import { Kpi, ROLES, _xe, arDate, isoD, makeXlsx, money, nowISO, printA4, stockByWh, sum, today, uid } from '../../App.jsx';

export function SmartPurchasing({ org, ops, me, commit, commitOrg, say }) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const items = org.items || [];
  const moves = ops.stockMoves || [];
  const canW = ROLES[me?.role]?.scope === 'all';
  const [lvl, setLvl] = useState({});
  const [supId, setSupId] = useState((org.suppliers || [])[0]?.id || '');

  const bal = stockByWh(org, ops).total;   // v29.9: كل المستودعات + الطريق
  const balOf = (id) => Math.round((bal[id] || 0) * 1000) / 1000;
  const cutoff = isoD(new Date(Date.now() - 30 * 86400000));
  const usage = {}; [...moves, ...(ops.whMoves || [])].forEach(m => { if ((Number(m.qty) || 0) < 0 && (m.at || m.date || '').slice(0, 10) >= cutoff) usage[m.itemId] = (usage[m.itemId] || 0) + (-(Number(m.qty) || 0)); });
  const lastPrice = {}; (ops.purchaseOrders || []).forEach(po => (po.lines || []).forEach(l => { if (l.itemId && (Number(l.price) || 0) > 0) lastPrice[l.itemId] = Number(l.price); }));

  const minOf = (it) => { const v = lvl[it.id] && lvl[it.id].min; return v != null && v !== '' ? Number(v) || 0 : (it.minQty || 0); };
  const maxOf = (it) => { const v = lvl[it.id] && lvl[it.id].max; return v != null && v !== '' ? Number(v) || 0 : (it.maxQty || 0); };
  const rows = items.map(it => {
    const stock = balOf(it.id), min = minOf(it), max = maxOf(it);
    const daily = r2((usage[it.id] || 0) / 30);
    const cover = daily > 0.0001 ? Math.round(stock / daily) : null;
    const needs = min > 0 && stock <= min;
    const suggested = needs ? r2(Math.max(0, (max > 0 ? max : min * 2) - stock)) : 0;
    const status = needs ? 'reorder' : (min > 0 && stock <= min * 1.5 ? 'low' : 'ok');
    return { it, stock, min, max, daily, cover, needs, suggested, status, price: lastPrice[it.id] || it.cost || 0 };
  });
  const toOrder = rows.filter(r => r.suggested > 0);
  const orderValue = r2(sum(toOrder, r => r.suggested * r.price));
  const lowCount = rows.filter(r => r.status !== 'ok').length;

  const saveLevels = async () => {
    await commitOrg(d => ({ ...d, items: (d.items || []).map(it => lvl[it.id] ? { ...it, minQty: minOf(it), maxQty: maxOf(it) } : it) }), { actionType: 'update', targetType: 'stock_item', targetId: 'levels', title: 'حفظ حدود إعادة الطلب', details: Object.keys(lvl).length + ' صنف' });
    setLvl({}); say('حُفظت الحدود ✓');
  };
  const createPO = async () => {
    if (!toOrder.length) return say('لا أصناف تحت حد الطلب حاليًا 👍', 'ok');
    const sp = (org.suppliers || []).find(x => x.id === supId); if (!sp) return say('اختر موردًا أولًا', 'no');
    let mx = 0; (ops.purchaseOrders || []).forEach(x => { const m = /(\d+)$/.exec(x.poNo || ''); if (m) mx = Math.max(mx, +m[1]); });
    const poNo = 'PO-' + String(mx + 1).padStart(4, '0');
    const lines = toOrder.map(r => ({ desc: r.it.name, itemId: r.it.id, qty: r.suggested, price: r.price, received: 0 }));
    const lim = Number((org.purchaseCfg || {}).approvalLimit) || 0, tot = sum(lines, l => l.qty * l.price);   // v39.0: يمر بحد الاعتماد كأي أمر شراء
    const rec = { id: uid('po'), poNo, supplierId: sp.id, supplierName: sp.name, branchId: '', note: 'إعادة طلب تلقائي', lines, status: lim > 0 && tot > lim ? 'pending' : 'open', by: me.name, at: nowISO(), date: today() };
    await commit(d => ({ ...d, purchaseOrders: [rec, ...(d.purchaseOrders || [])] }), { actionType: 'create', targetType: 'purchase_order', targetId: rec.id, title: 'أنشأ أمر شراء (إعادة طلب)', details: poNo + ' · ' + sp.name + ' · ' + lines.length + ' صنف' });
    say('أُنشئ أمر الشراء ' + poNo + ' ✓' + (rec.status === 'pending' ? ' — بانتظار الاعتماد (فوق حد ' + money(lim) + ')' : ' — تابعه من «الموردون ← أوامر الشراء»'));
  };
  const exportReq = () => { try { const head = ['الصنف', 'الوحدة', 'المخزون', 'حد الطلب', 'الكمية المقترحة', 'آخر سعر', 'القيمة']; const body = toOrder.map(r => [r.it.name, r.it.unit || '', r.stock, r.min, r.suggested, r.price, r2(r.suggested * r.price)]); const blob = makeXlsx([{ name: 'طلب شراء مقترح', rows: [head, ...body] }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'طلب_شراء_مقترح.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1500); say('نُزّل الطلب (Excel) ✓'); } catch (e) { say('تعذّر توليد Excel', 'no'); } };
  const printReq = () => { const rws = toOrder.map(r => `<tr><td>${_xe(r.it.name)}</td><td>${_xe(r.it.unit || '')}</td><td class="n">${r.stock}</td><td class="n">${r.min}</td><td class="n">${r.suggested}</td><td class="n">${money(r.price)}</td><td class="n">${money(r2(r.suggested * r.price))}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#999">لا أصناف تحتاج طلبًا</td></tr>'; printA4(org, 'طلب شراء مقترح (إعادة طلب)', arDate(today()) + ' · ' + toOrder.length + ' صنف · قيمة ' + money(orderValue), `<table><thead><tr><th>الصنف</th><th>الوحدة</th><th>المخزون</th><th>حد الطلب</th><th>المقترحة</th><th>آخر سعر</th><th>القيمة</th></tr></thead><tbody>${rws}<tr class="tot"><td colspan="6">إجمالي القيمة المقترحة</td><td class="n">${money(orderValue)}</td></tr></tbody></table>`) || say('اسمح بالنوافذ المنبثقة', 'no'); };

  const stBadge = (s) => s === 'reorder' ? { c: 'b-rose', t: 'أعِد الطلب' } : s === 'low' ? { c: 'b-amber', t: 'منخفض' } : { c: 'b-mint', t: 'كافٍ' };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>المشتريات الذكية ونقطة إعادة الطلب</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>اعرف ماذا تطلب وكم — قبل أن ينفد أيّ صنف</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={printReq}><Printer size={13} />طباعة الطلب</button>
          <button className="btn sm" onClick={exportReq}><Download size={13} />Excel</button>
          {canW && Object.keys(lvl).length > 0 && <button className="btn sm pri" onClick={saveLevels}><Check size={14} />حفظ الحدود</button>}
        </div>
      </div>

      {items.length > 0 && <ForecastPurchase org={org} ops={ops} me={me} commit={commit} say={say} />}
      {items.length === 0 ? <div className="card"><div className="empty">أضف أصناف مخزونك من «المخزون ← الأصناف والأرصدة» أولًا، ثم حدّد حد الطلب لكلٍّ منها هنا.</div></div> : <>
        <div className="grid g3">
          <Kpi label="أصناف تحت حد الطلب" value={String(toOrder.length)} sub={toOrder.length ? 'تحتاج إعادة طلب' : 'كل الأصناف كافية 👍'} icon={AlertTriangle} color={toOrder.length ? '#D9544D' : '#4FB286'} />
          <Kpi label="قيمة أمر الشراء المقترح" value={money(orderValue)} sub="بآخر أسعار الشراء" icon={Truck} color="#C8A24A" />
          <Kpi label="أصناف تحت المراقبة" value={String(lowCount)} sub="منخفضة أو تحت الحد" icon={HardDrive} color={lowCount ? '#E0A458' : '#4FB286'} />
        </div>

        {(org.suppliers || []).length > 0 && toOrder.length > 0 && canW && (
          <div className="card" style={{ borderColor: 'rgba(79,178,134,.3)' }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 12.5 }}><b>{toOrder.length} صنف</b> تحت حد الطلب بقيمة <b>{money(orderValue)}</b> — أنشئ أمر شراء بها بضغطة.</div>
              <div className="row" style={{ gap: 8 }}>
                <select className="inp" style={{ width: 180 }} value={supId} onChange={e => setSupId(e.target.value)}>{(org.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <button className="btn pri" onClick={createPO}><Plus size={14} />إنشاء أمر شراء</button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-t" style={{ marginBottom: 8 }}><ClipboardCheck size={15} color="var(--brass)" />تحليل إعادة الطلب — حدّد الحد الأدنى/الأعلى لكل صنف</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الصنف</th><th style={{ textAlign: 'end' }}>المخزون</th><th style={{ textAlign: 'center' }}>حد الطلب</th><th style={{ textAlign: 'center' }}>الحد الأعلى</th><th style={{ textAlign: 'end' }}>استهلاك/يوم</th><th style={{ textAlign: 'end' }}>أيام التغطية</th><th style={{ textAlign: 'end' }}>المقترحة</th><th style={{ textAlign: 'center' }}>الحالة</th></tr></thead>
              <tbody>
                {rows.map(r => { const sb = stBadge(r.status); return (
                  <tr key={r.it.id} style={r.status === 'reorder' ? { background: 'rgba(217,84,77,.06)' } : null}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.it.name}<span style={{ fontSize: 9.5, color: 'var(--faint)' }}> · {r.it.unit || ''}</span></td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{r.stock}</td>
                    <td style={{ textAlign: 'center' }}><input className="inp n" style={{ width: 70, textAlign: 'center' }} inputMode="decimal" value={lvl[r.it.id] && lvl[r.it.id].min != null ? lvl[r.it.id].min : (r.it.minQty || '')} placeholder="—" disabled={!canW} onChange={e => setLvl(s => ({ ...s, [r.it.id]: { ...s[r.it.id], min: e.target.value.replace(/[^\d.]/g, '') } }))} /></td>
                    <td style={{ textAlign: 'center' }}><input className="inp n" style={{ width: 70, textAlign: 'center' }} inputMode="decimal" value={lvl[r.it.id] && lvl[r.it.id].max != null ? lvl[r.it.id].max : (r.it.maxQty || '')} placeholder="—" disabled={!canW} onChange={e => setLvl(s => ({ ...s, [r.it.id]: { ...s[r.it.id], max: e.target.value.replace(/[^\d.]/g, '') } }))} /></td>
                    <td className="num" style={{ textAlign: 'end', color: 'var(--dim)' }}>{r.daily || '—'}</td>
                    <td className="num" style={{ textAlign: 'end', color: r.cover != null && r.cover < 7 ? '#D9544D' : 'var(--dim)' }}>{r.cover != null ? r.cover + ' يوم' : '—'}</td>
                    <td className="num" style={{ textAlign: 'end', fontWeight: 800, color: r.suggested > 0 ? 'var(--brass-l)' : 'var(--faint)' }}>{r.suggested || '—'}</td>
                    <td style={{ textAlign: 'center' }}><span className={'badge ' + sb.c}>{sb.t}</span></td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="note">💡 <b>حد الطلب</b> (نقطة إعادة الطلب): عند وصول المخزون إليه أو دونه يُقترَح الطلب. <b>الكمية المقترحة</b> = الحد الأعلى − المخزون (أو ضعف حد الطلب إن لم تحدّد أعلى). <b>الاستهلاك/اليوم</b> وأيام التغطية من حركات الصرف آخر 30 يومًا. آخر سعر من أوامر الشراء السابقة. عدّل الحدود واحفظها لتُحسب تلقائيًا.</div>
      </>}
    </div>
  );
}
