/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { ClipboardCheck, HardDrive, AlertTriangle, Download, Store, Plus, Trash2, Check, Upload } from 'lucide-react';
import { Field, Kpi, Modal, _normName, isCostCtl, makeXlsx, money, nowISO, parseCsvGrid, parseXlsxGrid, rolePost, sum, today, uid, usageReport, whOf } from '../../App.jsx';

export function UsageVariance({ org, ops, me, commit, say }) {
  const whs = whOf(org), useWh = whs.length > 0;
  const branches = (org.branches || []).filter(b => b.isActive !== false);
  const products = org.products || [];
  const canW = rolePost(me.role) && !isCostCtl(me);
  const m0 = today().slice(0, 7) + '-01';
  const [wid, setWid] = useState(useWh ? ((whs.find(w => w.kind === 'branch') || whs[0]).id) : '');
  const [from, setFrom] = useState(m0); const [to, setTo] = useState(today());
  const [tol, setTol] = useState('5');
  const [ps, setPs] = useState(null);   // نموذج مبيعات المنتجات
  const R = useMemo(() => usageReport(org, ops, wid, from, to), [org, ops, wid, from, to]);
  const T = Number(tol) || 0;
  const over = R.rows.filter(r => r.pct != null ? Math.abs(r.pct) > T : r.actual > 0.0005);
  const lossV = Math.round(R.rows.reduce((a, r) => a + Math.max(0, r.dv), 0) * 100) / 100;
  const pctOf = (v) => R.revenue > 0 ? Math.round(v / R.revenue * 1000) / 10 + '%' : '—';
  const servedNames = R.served.map(id => (branches.find(b => b.id === id) || {}).name).filter(Boolean);

  const openPs = () => setPs({ branchId: R.served[0] || (branches[0] || {}).id || '', from, to, qty: {}, unmatched: [] });
  const importPs = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    try {
      const grid = /\.xlsx$/i.test(file.name) ? await parseXlsxGrid(await file.arrayBuffer()) : parseCsvGrid(await file.text());
      if (!grid || !grid.length) return say('الملف فارغ', 'no');
      let h = -1, cn = -1, cq = -1;
      for (let i = 0; i < Math.min(grid.length, 15) && h < 0; i++) { const row = (grid[i] || []).map(_normName);
        const a = row.findIndex(c => /منتج|صنف|الوجبه|اسم|item|product|name/.test(c)), b = row.findIndex(c => /كميه|الكميه|عدد|المباع|qty|quantity|sold|count/.test(c));
        if (a >= 0 && b >= 0 && a !== b) { h = i; cn = a; cq = b; } }
      if (h < 0) return say('لم أجد عمودي «المنتج» و«الكمية» في أول 15 سطرًا', 'no');
      const byName = {}; products.forEach(p => { byName[_normName(p.name)] = p.id; });
      const qty = { ...(ps.qty || {}) }, unmatched = [];
      grid.slice(h + 1).forEach(row => { const n = _normName(row[cn]); const q = Number(String(row[cq] || '').replace(/[^\d.-]/g, '')) || 0; if (!n || !q) return;
        const pid = byName[n]; if (pid) qty[pid] = String((Number(qty[pid]) || 0) + q); else unmatched.push({ name: String(row[cn]).trim(), qty: q }); });
      setPs(f => ({ ...f, qty, unmatched })); say('قُرئ الملف — ' + (Object.keys(qty).length) + ' منتج مطابق' + (unmatched.length ? ' و' + unmatched.length + ' غير مطابق' : ''), unmatched.length ? 'no' : 'ok');
    } catch (err) { say('تعذّرت قراءة الملف', 'no'); }
  };
  const savePs = async () => {
    const f = ps; if (!f.branchId) return say('اختر الفرع', 'no'); if (!f.from || !f.to || f.from > f.to) return say('الفترة غير صحيحة', 'no');
    const lines = Object.entries(f.qty || {}).map(([productId, q]) => ({ productId, qty: Number(q) || 0 })).filter(l => l.qty > 0);
    if (!lines.length) return say('أدخل كميات المنتجات', 'no');
    const clash = (ops.productSales || []).find(r => r.branchId === f.branchId && r.to >= f.from && r.from <= f.to);
    if (clash && !window.confirm('توجد مبيعات مسجّلة لنفس الفرع في فترة متداخلة (' + clash.from + ' ← ' + clash.to + '). الحفظ قد يضاعف الكميات. متابعة؟')) return;
    const rec = { id: uid('ps'), branchId: f.branchId, from: f.from, to: f.to, lines, by: me.name, at: nowISO() };
    const ok = await commit(d => ({ ...d, productSales: [rec, ...(d.productSales || [])] }), { actionType: 'create', targetType: 'product', targetId: rec.id, title: 'سجّل مبيعات المنتجات', details: ((branches.find(b => b.id === f.branchId) || {}).name || '') + ' · ' + f.from + ' ← ' + f.to + ' · ' + lines.length + ' منتج' });
    if (ok) { setPs(null); say('حُفظت مبيعات المنتجات ✓'); }
  };
  const delPs = async (r) => {
    if (!window.confirm('حذف مبيعات ' + r.from + ' ← ' + r.to + '؟')) return;
    await commit(d => ({ ...d, productSales: (d.productSales || []).filter(x => x.id !== r.id) }), { actionType: 'delete', targetType: 'product', targetId: r.id, title: 'حذف مبيعات منتجات', details: r.from + ' ← ' + r.to });
  };
  const exportX = () => { try {
    const head = ['الصنف', 'الوحدة', 'النظري', 'صرف للمطبخ', 'هدر مسجّل', 'عجز الجرد', 'الفعلي', 'الفرق (كمية)', 'الفرق %', 'الفرق (قيمة)'];
    const blob = makeXlsx([{ name: 'الاستهلاك', rows: [head, ...R.rows.map(r => [r.name, r.unit, r.theo, r.out, r.waste, r.count, r.actual, r.dq, r.pct == null ? '' : r.pct, r.dv])] }]);
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'الاستهلاك_النظري_والفعلي_' + from + '_' + to + '.xlsx'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch (e) { say('تعذّر التصدير', 'no'); } };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="grid g4" style={{ alignItems: 'end' }}>
          {useWh && <Field label="المستودع"><select className="sel" value={wid} onChange={e => setWid(e.target.value)}>{whs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
          <Field label="من"><input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="إلى"><input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} /></Field>
          <Field label="حد التسامح %"><input className="inp n" inputMode="decimal" value={tol} onChange={e => setTol(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
        </div>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>المبيعات المحتسبة: {servedNames.join('، ') || '—'}{useWh && whs.find(w => w.id === wid)?.kind !== 'branch' ? ' (الفروع التي تُخدَم من هذا المستودع بلا مستودع خاص)' : ''}</div>
      </div>
      <div className="grid g4">
        <Kpi label="التكلفة النظرية" value={money(R.theoV)} sub={'نسبة تكلفة الطعام ' + pctOf(R.theoV)} icon={ClipboardCheck} color="#5B93C4" />
        <Kpi label="التكلفة الفعلية" value={money(R.actV)} sub={'نسبة تكلفة الطعام ' + pctOf(R.actV)} icon={HardDrive} color="#C8A24A" />
        <Kpi label="الفرق (هدر/فقد)" value={money(Math.round((R.actV - R.theoV) * 100) / 100)} sub={'منها زيادات ' + money(lossV)} icon={AlertTriangle} color={R.actV - R.theoV > 0 ? '#D9544D' : '#4FB286'} />
        <Kpi label="أصناف تتجاوز الحد" value={String(over.length)} sub={'من ' + R.rows.length + ' صنف · حد ' + T + '%'} icon={AlertTriangle} color={over.length ? '#D9544D' : '#4FB286'} />
      </div>
      {(R.partial.length > 0 || R.noRecipe.length > 0 || !R.recs.length) && <div className="note" style={{ color: 'var(--amber)' }}>
        {!R.recs.length && <div>⚠ لا مبيعات منتجات مسجّلة لهذه الفترة — النظري صفر. سجّلها من «مبيعات المنتجات» أدناه.</div>}
        {R.partial.length > 0 && <div>⚠ {R.partial.length} سجل مبيعات يتداخل جزئيًا مع الفترة فلم يُحتسب — اجعل الفترة تشمله كاملًا.</div>}
        {R.noRecipe.length > 0 && <div>⚠ منتجات مباعة بلا وصفة: {R.noRecipe.map(id => (products.find(p => p.id === id) || {}).name || id).join('، ')} — أكمل وصفاتها.</div>}
      </div>}
      <div className="card">
        <div className="card-h"><div className="card-t"><AlertTriangle size={15} color="var(--brass)" />الفرق لكل صنف — مرتّب بالأثر المالي</div>
          <button className="btn sm" onClick={exportX}><Download size={13} />Excel</button></div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الصنف</th><th style={{ textAlign: 'end' }}>النظري</th><th style={{ textAlign: 'end' }}>صرف للمطبخ</th><th style={{ textAlign: 'end' }}>هدر مسجّل</th><th style={{ textAlign: 'end' }}>عجز الجرد</th><th style={{ textAlign: 'end' }}>الفعلي</th><th style={{ textAlign: 'end' }}>الفرق</th><th style={{ textAlign: 'end' }}>القيمة</th></tr></thead>
          <tbody>
            {R.rows.map(r => { const bad = r.pct != null ? Math.abs(r.pct) > T : r.actual > 0.0005; return (
              <tr key={r.id}>
                <td style={{ fontSize: 12.5, fontWeight: 600 }}>{r.name} <span style={{ fontSize: 10, color: 'var(--faint)' }}>({r.unit})</span>{r.theo === 0 && r.actual > 0 && <div><span className="badge b-amber" style={{ fontSize: 9.5 }}>مستهلك بلا وصفة تبرره</span></div>}</td>
                <td className="num" style={{ textAlign: 'end' }}>{r.theo}</td>
                <td className="num" style={{ textAlign: 'end' }}>{r.out}</td>
                <td className="num" style={{ textAlign: 'end', color: r.waste > 0 ? 'var(--amber)' : undefined }}>{r.waste}</td>
                <td className="num" style={{ textAlign: 'end', color: r.count > 0 ? 'var(--rose)' : undefined }}>{r.count}</td>
                <td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{r.actual}</td>
                <td style={{ textAlign: 'end' }}><span className={'badge ' + (bad ? (r.dq > 0 ? 'b-rose' : 'b-amber') : 'b-mint')}>{r.dq > 0 ? '+' : ''}{r.dq}{r.pct != null ? ' (' + (r.pct > 0 ? '+' : '') + r.pct + '%)' : ''}</span></td>
                <td className="num" style={{ textAlign: 'end', fontWeight: 700, color: r.dv > 0 ? 'var(--rose)' : r.dv < 0 ? 'var(--mint)' : undefined }}>{money(r.dv)}</td>
              </tr>); })}
            {R.rows.length === 0 && <tr><td colSpan={8}><div className="empty">لا حركات ولا مبيعات في هذه الفترة.</div></td></tr>}
          </tbody>
        </table></div>
        <div className="note" style={{ marginTop: 8 }}>الفرق الموجب = استُهلك أكثر مما تبرره المبيعات (هدر غير مسجّل، زيادة في الحصص، أو فقد). السالب = أقل من الوصفة (حصص أصغر أو مبيعات غير مسجّلة أو وصفة مبالغ فيها). عجز الجرد يأتي من تسويات الجرد في الفترة.</div>
      </div>
      <div className="card">
        <div className="card-h"><div className="card-t"><Store size={15} color="var(--brass)" />مبيعات المنتجات المسجّلة</div>
          {canW && <button className="btn sm pri" onClick={openPs}><Plus size={14} />تسجيل مبيعات منتجات</button>}</div>
        <div className="tw"><table className="tb">
          <thead><tr><th>الفرع</th><th>الفترة</th><th style={{ textAlign: 'end' }}>المنتجات</th><th style={{ textAlign: 'end' }}>الكميات</th><th>بواسطة</th><th></th></tr></thead>
          <tbody>
            {(ops.productSales || []).slice().sort((a, b) => String(b.to).localeCompare(String(a.to))).slice(0, 40).map(r => (
              <tr key={r.id}><td style={{ fontSize: 12.5 }}>{(branches.find(b => b.id === r.branchId) || {}).name || '—'}</td><td className="num" style={{ fontSize: 11.5 }}>{r.from} ← {r.to}</td>
                <td className="num" style={{ textAlign: 'end' }}>{(r.lines || []).length}</td><td className="num" style={{ textAlign: 'end' }}>{sum(r.lines || [], l => l.qty)}</td><td style={{ fontSize: 11 }}>{r.by}</td>
                <td>{canW && <button className="btn sm gh" onClick={() => delPs(r)}><Trash2 size={12} color="#D9544D" /></button>}</td></tr>))}
            {!(ops.productSales || []).length && <tr><td colSpan={6}><div className="empty">لا مبيعات منتجات بعد — استوردها من تقرير نقطة البيع (Excel: المنتج + الكمية) أو أدخلها يدويًا.</div></td></tr>}
          </tbody>
        </table></div>
      </div>

      {ps && (
        <Modal title="تسجيل مبيعات المنتجات" icon={Store} wide onClose={() => setPs(null)}
          foot={<><button className="btn gh" onClick={() => setPs(null)}>إلغاء</button><button className="btn pri" onClick={savePs}><Check size={14} />حفظ</button></>}>
          <div className="grid g3">
            <Field label="الفرع"><select className="sel" value={ps.branchId} onChange={e => setPs(f => ({ ...f, branchId: e.target.value }))}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="من"><input type="date" className="inp" value={ps.from} onChange={e => setPs(f => ({ ...f, from: e.target.value }))} /></Field>
            <Field label="إلى"><input type="date" className="inp" value={ps.to} onChange={e => setPs(f => ({ ...f, to: e.target.value }))} /></Field>
          </div>
          <label className="btn sm" style={{ cursor: 'pointer', marginBottom: 8 }}><Upload size={13} />استيراد تقرير نقطة البيع (Excel/CSV)<input type="file" accept=".xlsx,.csv,text/csv" style={{ display: 'none' }} onChange={importPs} /></label>
          {(ps.unmatched || []).length > 0 && <div className="note" style={{ color: 'var(--amber)' }}>منتجات في الملف بلا مطابق في الوصفات (لم تُحتسب): {ps.unmatched.slice(0, 12).map(u => u.name + ' (' + u.qty + ')').join('، ')}{ps.unmatched.length > 12 ? '…' : ''} — أضفها في «الوصفات والتكلفة» بنفس الاسم ثم أعد الاستيراد.</div>}
          <div className="tw" style={{ maxHeight: 360, overflow: 'auto' }}><table className="tb">
            <thead><tr><th>المنتج</th><th style={{ textAlign: 'end' }}>الكمية المباعة</th></tr></thead>
            <tbody>{products.map(p => (
              <tr key={p.id}><td style={{ fontSize: 12.5 }}>{p.name}{!(p.parts || []).length && <span className="badge b-amber" style={{ marginInlineStart: 6, fontSize: 9.5 }}>بلا وصفة</span>}</td>
                <td style={{ textAlign: 'end' }}><input className="inp n" style={{ width: 110 }} inputMode="decimal" value={(ps.qty || {})[p.id] || ''} onChange={e => setPs(f => ({ ...f, qty: { ...(f.qty || {}), [p.id]: e.target.value.replace(/[^\d.]/g, '') } }))} /></td></tr>))}
              {!products.length && <tr><td colSpan={2}><div className="empty">أضف المنتجات ووصفاتها أولًا من «الوصفات والتكلفة».</div></td></tr>}
            </tbody>
          </table></div>
        </Modal>
      )}
    </div>
  );
}
