/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { ClipboardCheck, Printer, Lock } from 'lucide-react';
import { Field, Modal, Num, _xe, businessDay, money, nowISO, posOrdersStats, posPrint, posR2, posShiftHtml, posZHtml, printA4 } from '../../App.jsx';

export function PosShifts({ org, ops, me, brs, commit, say }) {
  const [bid, setBid] = useState('all'); const [d, setD] = useState(businessDay()); const [rc, setRc] = useState(null);
  const ids = brs.map(b => b.id); const bOf = (id) => brs.find(b => b.id === id) || { id, name: id };
  const shifts = (ops.posShifts || []).filter(x => ids.includes(x.branchId) && (bid === 'all' || x.branchId === bid) && (x.date === d || (x.status === 'open' && x.date <= d)))
    .sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)));
  const ordersOf = (sh) => (ops.posOrders || []).filter(o => o.shiftId === sh.id);
  const dayOrders = (ops.posOrders || []).filter(o => ids.includes(o.branchId) && (bid === 'all' || o.branchId === bid) && o.date === d);
  const st = posOrdersStats(dayOrders);
  const expOf = (sh) => posR2((sh.openingCash || 0) + posOrdersStats(ordersOf(sh)).cash);
  const remoteClose = async () => {
    const sh = rc.sh; const counted = posR2(String(rc.counted).replace(/[^\d.]/g, ''));
    if (rc.counted === '' || rc.counted == null) return say('أدخل النقد المعدود', 'no'); if (!rc.note.trim()) return say('اكتب سبب الإنهاء من هنا', 'no');
    const os = ordersOf(sh); const okOs = os.filter(o => o.status !== 'void'); const expected = expOf(sh);
    const rec = { ...sh, status: 'closed', closedAt: nowISO(), closedBy: me.name + ' (إنهاء إداري)', remote: true, closeNote: rc.note.trim(), expected, counted, diff: posR2(counted - expected), n: okOs.length, total: posR2(okOs.reduce((a, o) => a + o.total, 0)) };
    const ok = await commit(dd => ({ ...dd, posShifts: (dd.posShifts || []).map(x => x.id === sh.id ? rec : x) }), { actionType: 'update', targetType: 'pos_shift', targetId: sh.id, branchName: bOf(sh.branchId).name, title: 'إنهاء وردية نقطة بيع إداريًا', details: (sh.devName || '') + ' · ' + rc.note.trim() + ' · فرق ' + money(rec.diff) });
    if (ok) { setRc(null); say('أُنهيت الوردية — الفرق ' + money(rec.diff)); posPrint(posZHtml(org, rec, os, bOf(sh.branchId))); }
  };
  const printDay = () => {
    const m = (n) => money(n); const rowsB = (bid === 'all' ? brs : brs.filter(b => b.id === bid)).map(b => { const os = dayOrders.filter(o => o.branchId === b.id); const s2 = posOrdersStats(os);
      const shs = (ops.posShifts || []).filter(x => x.branchId === b.id && x.date === d); const diff = posR2(shs.filter(x => x.status === 'closed').reduce((a, x) => a + (x.diff || 0), 0));
      return { b, s2, shs, diff }; });
    const tr = rowsB.map(({ b, s2, shs, diff }) => `<tr><td>${_xe(b.name)}</td><td class="n">${s2.n}</td><td class="n">${m(s2.total)}</td><td class="n">${m(s2.cash)}</td><td class="n">${m(s2.card)}</td><td class="n">${m(Object.values(s2.apps).reduce((a, x) => a + x.amount, 0) + s2.transfer)}</td><td class="n">${m(s2.ldisc + s2.odisc + s2.mdisc + s2.loyAmt)}</td><td class="n">${s2.voidN}</td><td class="n">${shs.filter(x => x.status === 'closed').length}/${shs.length}</td><td class="n ${diff < 0 ? 'neg' : ''}">${m(diff)}</td></tr>`).join('');
    const promoRows = Object.entries(st.promo).map(([k, v]) => `<tr><td>${_xe(k)}</td><td class="n">${m(v)}</td></tr>`).join('');
    printA4(org, 'تقرير مبيعات نقاط البيع اليومي', (bid === 'all' ? 'كل الفروع' : bOf(bid).name) + ' — ' + d,
      `<div class="box">الفواتير: <b>${st.n}</b> · المبيعات: <b>${m(st.total)}</b> · منها ضريبة: <b>${m(st.vat)}</b> · قبل الخصومات: <b>${m(st.gross)}</b></div>
      <table><tr><th>الفرع</th><th>الفواتير</th><th>المبيعات</th><th>نقدي</th><th>شبكة</th><th>تطبيقات/تحويل</th><th>الخصومات</th><th>ملغاة</th><th>الورديات (مغلقة/الكل)</th><th>فروقات الدرج</th></tr>${tr}
      <tr class="tot"><td>الإجمالي</td><td class="n">${st.n}</td><td class="n">${m(st.total)}</td><td class="n">${m(st.cash)}</td><td class="n">${m(st.card)}</td><td class="n">${m(Object.values(st.apps).reduce((a, x) => a + x.amount, 0) + st.transfer)}</td><td class="n">${m(st.ldisc + st.odisc + st.mdisc + st.loyAmt)}</td><td class="n">${st.voidN}</td><td></td><td class="n">${m(rowsB.reduce((a, x) => a + x.diff, 0))}</td></tr></table>
      ${promoRows || st.mdisc || st.loyAmt ? `<h3 style="font-size:13px">الخصومات حسب العرض</h3><table><tr><th>العرض</th><th>الخصم الممنوح</th></tr>${promoRows}${st.mdisc ? `<tr><td>خصم يدوي</td><td class="n">${m(st.mdisc)}</td></tr>` : ''}${st.loyAmt ? `<tr><td>استبدال نقاط ولاء (${st.loyPts} نقطة)</td><td class="n">${m(st.loyAmt)}</td></tr>` : ''}</table>` : ''}
      <div class="sign"><div>أمين الصندوق</div><div>مدير الفرع</div><div>المحاسب</div></div>`);
  };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'end', marginBottom: 8 }}>
          <div className="card-t" style={{ marginInlineEnd: 'auto' }}><ClipboardCheck size={15} color="var(--brass)" />الورديات والتقارير</div>
          {brs.length > 1 && <Field label="الفرع" style={{ marginBottom: 0 }}><select className="sel" value={bid} onChange={e => setBid(e.target.value)}><option value="all">كل الفروع</option>{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>}
          <Field label="يوم العمل" style={{ marginBottom: 0 }}><input type="date" className="inp" value={d} onChange={e => setD(e.target.value)} /></Field>
          <button className="btn pri" onClick={printDay}><Printer size={14} />تقرير اليوم المجمّع</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}><span className="badge b-brass">{st.n} فاتورة · {money(st.total)}</span><span className="badge b-dim">نقد {money(st.cash)}</span><span className="badge b-dim">شبكة {money(st.card)}</span>
          {st.ldisc + st.odisc + st.mdisc + st.loyAmt > 0 && <span className="badge b-amber">خصومات {money(st.ldisc + st.odisc + st.mdisc + st.loyAmt)}</span>}{st.voidN > 0 && <span className="badge b-rose">ملغاة {st.voidN}</span>}
          <span className="badge b-dim">ورديات مفتوحة {shifts.filter(x => x.status === 'open').length}</span></div>
      </div>
      <div className="card"><div className="tw"><table className="tb"><thead><tr><th>الفرع</th><th>الجهاز</th><th>فتحها</th><th>الحالة</th><th style={{ textAlign: 'end' }}>الفواتير</th><th style={{ textAlign: 'end' }}>المبيعات</th><th style={{ textAlign: 'end' }}>النقد المتوقع</th><th style={{ textAlign: 'end' }}>الفرق</th><th></th></tr></thead><tbody>
        {shifts.map(sh => { const os = ordersOf(sh); const s2 = posOrdersStats(os); const b = bOf(sh.branchId); return (
          <tr key={sh.id}><td style={{ fontSize: 12 }}>{b.name}</td><td style={{ fontSize: 12 }}>{sh.devName} <span className="num" style={{ color: 'var(--faint)' }}>({sh.dev})</span></td>
            <td style={{ fontSize: 11.5 }}>{sh.openedBy}<div className="num" style={{ color: 'var(--faint)' }}>{String(sh.openedAt).slice(0, 16).replace('T', ' ')}</div></td>
            <td>{sh.status === 'open' ? <span className="badge b-mint">مفتوحة</span> : <span className="badge b-dim">مغلقة {String(sh.closedAt || '').slice(11, 16)}</span>}{sh.remote && <div><span className="badge b-amber" title={sh.closeNote}>إنهاء إداري</span></div>}</td>
            <td className="num" style={{ textAlign: 'end' }}>{s2.n}</td><td className="num" style={{ textAlign: 'end' }}>{money(s2.total)}</td>
            <td className="num" style={{ textAlign: 'end' }}>{money(sh.status === 'closed' ? sh.expected : expOf(sh))}</td>
            <td className="num" style={{ textAlign: 'end', color: (sh.diff || 0) < -0.004 ? 'var(--rose)' : undefined }}>{sh.status === 'closed' ? money(sh.diff) : '—'}</td>
            <td><div className="row" style={{ gap: 4 }}>{sh.status === 'open' ? <>
              <button className="btn sm gh" onClick={() => posPrint(posShiftHtml(org, sh, os, b, 'X'))}><Printer size={12} />X</button>
              <button className="btn sm" onClick={() => setRc({ sh, counted: '', note: '' })}><Lock size={12} />إنهاء</button></>
              : <button className="btn sm gh" onClick={() => posPrint(posZHtml(org, sh, os, b))}><Printer size={12} />Z</button>}</div></td></tr>); })}
        {!shifts.length && <tr><td colSpan={9}><div className="empty">لا ورديات في هذا اليوم.</div></td></tr>}
      </tbody></table></div>
        <div className="note" style={{ marginTop: 8 }}>«إنهاء» يغلق وردية جهاز آخر من هنا (نسي الكاشير الإغلاق أو تعطل الجهاز) بعد عدّ النقد، ويطبع تقرير Z. فواتير لم يرسلها ذلك الجهاز بعد تُضاف عند اتصاله وتظهر في تقرير اليوم.</div></div>
      {rc && <Modal title={'إنهاء وردية — ' + bOf(rc.sh.branchId).name + ' · ' + (rc.sh.devName || '')} icon={Lock} onClose={() => setRc(null)} foot={<><button className="btn gh" onClick={() => setRc(null)}>إلغاء</button><button className="btn pri" onClick={remoteClose}><Lock size={14} />إنهاء وطباعة Z</button></>}>
        <div className="mono-b" style={{ marginBottom: 8 }}><span>النقد المتوقع في الدرج</span><span className="num">{money(expOf(rc.sh))}</span></div>
        <div className="grid g2"><Num label="النقد المعدود فعلًا" value={rc.counted} onChange={v => setRc(x => ({ ...x, counted: v }))} />
          <Field label="سبب الإنهاء من هنا"><input className="inp" value={rc.note} placeholder="نسي الكاشير الإغلاق / تعطل الجهاز…" onChange={e => setRc(x => ({ ...x, note: e.target.value }))} /></Field></div>
        {rc.counted !== '' && <div className="note">الفرق: <b className="num">{money(posR2(posR2(String(rc.counted).replace(/[^\d.]/g, '')) - expOf(rc.sh)))}</b></div>}
      </Modal>}
    </div>);
}
