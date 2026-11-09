/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect, useMemo } from 'react';
import { cloud, KEYS } from '../../storage';
import { Gift, Check, Users, RefreshCw } from 'lucide-react';
import { Field, Modal, loyPost, money, normPhone, nowISO, posR2, uid } from '../../App.jsx';

export function PosLoyalty({ org, commitOrg, say, canCfg, me }) {
  const c = org.loyaltyCfg || {};
  const [f, setF] = useState({ enabled: !!c.enabled, earnPer: String(c.earnPer || 10), ptValue: String(c.ptValue || 0.5), minRedeem: String(c.minRedeem || 20), maxRedeemPct: String(c.maxRedeemPct || 50) });
  const [doc, setDoc] = useState(null); const [q, setQ] = useState(''); const [adj, setAdj] = useState(null);
  const load = () => cloud.get(KEYS.loy, { members: {}, tx: [] }).then(d => setDoc(d || { members: {}, tx: [] })).catch(() => setDoc({ members: {}, tx: [] }));
  useEffect(() => { load(); }, []);
  const saveCfg = async () => {
    const v = { enabled: !!f.enabled, earnPer: Number(f.earnPer) || 0, ptValue: Number(f.ptValue) || 0, minRedeem: Number(f.minRedeem) || 0, maxRedeemPct: Math.min(100, Number(f.maxRedeemPct) || 100) };
    if (v.enabled && (v.earnPer <= 0 || v.ptValue <= 0)) return say('حدّد قيمة الكسب وقيمة النقطة', 'no');
    const ok = await commitOrg(d => ({ ...d, loyaltyCfg: v }), { actionType: 'update', targetType: 'settings', targetId: 'loyaltyCfg', need: 'edit', title: 'إعداد نقاط الولاء', details: v.enabled ? 'نقطة لكل ' + v.earnPer + ' ر.س · النقطة = ' + v.ptValue + ' ر.س' : 'موقوف' });
    if (ok) say('حُفظ إعداد الولاء ✓');
  };
  const rows = useMemo(() => { if (!doc) return []; const m = {};
    (doc.tx || []).forEach(t => { const x = m[t.phone] || (m[t.phone] = { phone: t.phone, bal: 0, earned: 0, used: 0, n: 0, last: '' }); x.bal += Number(t.pts) || 0; if (t.pts > 0) x.earned += t.pts; else x.used -= t.pts; if (/:e$/.test(t.id)) x.n++; if (String(t.at) > x.last) x.last = t.at; });
    return Object.values(m).map(x => ({ ...x, bal: posR2(x.bal), name: ((doc.members || {})[x.phone] || {}).name || '' })).sort((a, b) => b.bal - a.bal); }, [doc]);
  const shown = rows.filter(x => !q.trim() || x.phone.includes(normPhone(q) || q.trim()) || x.name.includes(q.trim()));
  const liab = posR2(rows.reduce((a, x) => a + Math.max(0, x.bal), 0) * (Number(c.ptValue) || 0));
  const doAdj = async () => {
    const pts = Math.round(Number(adj.pts) || 0); if (!pts) return say('أدخل عدد النقاط (+ أو −)', 'no'); if (!adj.reason.trim()) return say('اكتب السبب', 'no');
    const r = await loyPost([{ id: uid('la'), phone: adj.phone, pts, at: nowISO(), br: '', ord: 'تعديل: ' + adj.reason.trim() + ' — ' + me.name }]);
    if (r) { setDoc(r); setAdj(null); say('عُدّل الرصيد ✓'); } else say('تعذّر الحفظ — تحقق من الاتصال', 'no');
  };
  return (
    <div className="grid" style={{ gap: 12 }}>
      {canCfg && <div className="card">
        <div className="card-t" style={{ marginBottom: 8 }}><Gift size={15} color="var(--brass)" />إعداد نقاط الولاء</div>
        <label className="row" style={{ gap: 7, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}><input type="checkbox" checked={f.enabled} onChange={e => setF(x => ({ ...x, enabled: e.target.checked }))} />تفعيل نقاط الولاء في كل الفروع</label>
        <div className="grid g4">
          <Field label="نقطة واحدة لكل (ر.س)"><input className="inp n" inputMode="decimal" value={f.earnPer} onChange={e => setF(x => ({ ...x, earnPer: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          <Field label="قيمة النقطة عند الاستبدال (ر.س)"><input className="inp n" inputMode="decimal" value={f.ptValue} onChange={e => setF(x => ({ ...x, ptValue: e.target.value.replace(/[^\d.]/g, '') }))} /></Field>
          <Field label="أقل رصيد للاستبدال (نقطة)"><input className="inp n" inputMode="numeric" value={f.minRedeem} onChange={e => setF(x => ({ ...x, minRedeem: e.target.value.replace(/\D/g, '') }))} /></Field>
          <Field label="أقصى استبدال من الفاتورة %"><input className="inp n" inputMode="numeric" value={f.maxRedeemPct} onChange={e => setF(x => ({ ...x, maxRedeemPct: e.target.value.replace(/\D/g, '') }))} /></Field>
        </div>
        {Number(f.earnPer) > 0 && Number(f.ptValue) > 0 && <div className="note">مثال: فاتورة 100 ر.س تكسب <b className="num">{Math.floor(100 / Number(f.earnPer))}</b> نقطة قيمتها <b className="num">{money(Math.floor(100 / Number(f.earnPer)) * Number(f.ptValue))}</b> — أي ردّ <b className="num">{(Number(f.ptValue) / Number(f.earnPer) * 100).toFixed(1)}%</b> من قيمة المشتريات.</div>}
        <button className="btn pri" style={{ marginTop: 8 }} onClick={saveCfg}><Check size={14} />حفظ</button>
      </div>}
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}><div className="card-t"><Users size={15} color="var(--brass)" />عملاء الولاء</div>
          <span className="badge b-brass">{rows.length} عميل</span><span className="badge b-dim" title="قيمة النقاط القائمة غير المستبدلة">التزام النقاط {money(liab)}</span>
          <input className="inp" style={{ width: 200, marginInlineStart: 'auto' }} placeholder="بحث بالجوال أو الاسم" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn sm gh" onClick={load}><RefreshCw size={13} /></button></div>
        {!doc ? <div className="empty">جارٍ التحميل…</div> : <div className="tw"><table className="tb"><thead><tr><th>العميل</th><th>الجوال</th><th style={{ textAlign: 'end' }}>الرصيد</th><th style={{ textAlign: 'end' }}>المكتسب</th><th style={{ textAlign: 'end' }}>المستبدل</th><th>الزيارات</th><th>آخر زيارة</th>{canCfg && <th></th>}</tr></thead><tbody>
          {shown.slice(0, 300).map(x => <tr key={x.phone}><td>{x.name || '—'}</td><td className="num">0{x.phone}</td><td className="num" style={{ textAlign: 'end', fontWeight: 700 }}>{x.bal}</td><td className="num" style={{ textAlign: 'end' }}>{x.earned}</td><td className="num" style={{ textAlign: 'end' }}>{x.used}</td><td className="num">{x.n}</td><td className="num" style={{ fontSize: 11 }}>{String(x.last).slice(0, 10)}</td>
            {canCfg && <td><button className="btn sm gh" onClick={() => setAdj({ phone: x.phone, name: x.name, pts: '', reason: '' })}>تعديل</button></td>}</tr>)}
          {!shown.length && <tr><td colSpan={8}><div className="empty">لا عملاء بعد — يُسجَّل العميل تلقائيًا عند إدخال جواله في نقطة البيع.</div></td></tr>}
        </tbody></table></div>}
        <div className="note" style={{ marginTop: 8 }}>محاسبيًا: النقاط المستبدلة تُسجَّل خصمًا على الفاتورة (تخفض الإيراد قبل الضريبة)، و«التزام النقاط» قيمة تقديرية لما قد يُستبدل مستقبلًا.</div>
      </div>
      {adj && <Modal title={'تعديل رصيد ' + (adj.name || '0' + adj.phone)} icon={Gift} onClose={() => setAdj(null)} foot={<><button className="btn gh" onClick={() => setAdj(null)}>إلغاء</button><button className="btn pri" onClick={doAdj}><Check size={14} />حفظ</button></>}>
        <div className="grid g2"><Field label="النقاط (+ إضافة / − خصم)"><input className="inp n" value={adj.pts} placeholder="مثال: 50 أو -20" onChange={e => setAdj(a => ({ ...a, pts: e.target.value.replace(/[^\d-]/g, '') }))} /></Field>
          <Field label="السبب"><input className="inp" value={adj.reason} onChange={e => setAdj(a => ({ ...a, reason: e.target.value }))} /></Field></div>
      </Modal>}
    </div>);
}
