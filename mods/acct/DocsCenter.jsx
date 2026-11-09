/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Stamp, Check, Plus, AlertTriangle, CalendarDays, Trash2 } from 'lucide-react';
import { DOC_LABEL, DOC_TYPES, Field, Kpi, Modal, ROLES, today, uid } from '../../App.jsx';

export function DocsCenter({ org, ops, me, myBranches, commitOrg, say }) {
  const [f, setF] = useState(null);   // نموذج إضافة/تعديل
  const [remD, setRemD] = useState(String((org.docCfg && org.docCfg.remindDays) != null ? org.docCfg.remindDays : 45));
  const canW = ROLES[me.role]?.scope === 'all' || !!ROLES[me.role]?.admin;
  const td = today();
  const daysLeft = (d) => { const x = Date.parse(td), y = Date.parse(d); return (isNaN(x) || isNaN(y)) ? null : Math.round((y - x) / 86400000); };
  const remindDays = Number(remD) || 45;
  const docs = (org.documents || []).map(d => ({ ...d, dl: d.expiryDate ? daysLeft(d.expiryDate) : null }))
    .sort((a, b) => (a.dl == null ? 1e9 : a.dl) - (b.dl == null ? 1e9 : b.dl));
  const stOf = (d) => d.dl == null ? 'perm' : d.dl < 0 ? 'expired' : d.dl <= remindDays ? 'soon' : 'valid';
  const nExpired = docs.filter(d => stOf(d) === 'expired').length;
  const nSoon = docs.filter(d => stOf(d) === 'soon').length;
  const stCls = { expired: 'b-rose', soon: 'b-amber', valid: 'b-mint', perm: 'b-dim' };
  const stTx = (d) => { const s = stOf(d); return s === 'expired' ? 'منتهية منذ ' + Math.abs(d.dl) + ' يومًا' : s === 'soon' ? 'تنتهي خلال ' + d.dl + ' يومًا' : s === 'valid' ? 'سارية (' + d.dl + ' يومًا)' : 'دائمة'; };

  const saveCfg = async () => { await commitOrg(d => ({ ...d, docCfg: { remindDays: Number(remD) || 45 } }), { actionType: 'update', targetType: 'year_end', targetId: 'doccfg', title: 'حدّث مهلة تنبيه الوثائق', details: (Number(remD) || 45) + ' يومًا' }); say('حُفظت مهلة التنبيه ✓'); };
  const save = async () => {
    if (!f.type) return say('اختر نوع الوثيقة', 'no');
    const rec = { id: f.id || uid('doc'), type: f.type, number: (f.number || '').trim(), branchId: f.branchId || '', issueDate: f.issueDate || '', expiryDate: f.expiryDate || '', notes: (f.notes || '').trim() };
    await commitOrg(d => ({ ...d, documents: f.id ? (d.documents || []).map(x => x.id === f.id ? rec : x) : [...(d.documents || []), rec] }), {
      actionType: f.id ? 'update' : 'create', targetType: 'official_doc', targetId: rec.id, title: f.id ? 'عدّل وثيقة' : 'أضاف وثيقة', details: DOC_LABEL(rec.type) + (rec.number ? ' · ' + rec.number : '')
    });
    setF(null); say('حُفظت الوثيقة ✓');
  };
  const del = async (id) => {
    await commitOrg(d => ({ ...d, documents: (d.documents || []).filter(x => x.id !== id) }), { actionType: 'delete', targetType: 'official_doc', targetId: id, title: 'حذف وثيقة', details: id });
    say('حُذفت الوثيقة');
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Stamp size={17} /></span>مركز المستندات<small>الوثائق الرسمية وتتبّع الصلاحيات والتنبيه قبل الانتهاء</small></div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        {canW && <div className="row" style={{ gap: 8, alignItems: 'flex-end' }}>
          <Field label="التنبيه قبل الانتهاء بـ (يوم)" style={{ width: 160 }}><input className="inp n" inputMode="numeric" value={remD} onChange={e => setRemD(e.target.value.replace(/[^\d]/g, ''))} /></Field>
          <button className="btn sm" onClick={saveCfg}><Check size={13} />حفظ المهلة</button>
        </div>}
        {canW && <button className="btn pri" onClick={() => setF({ type: '', number: '', branchId: '', issueDate: '', expiryDate: '', notes: '' })}><Plus size={15} />وثيقة جديدة</button>}
      </div>

      <div className="grid g3">
        <Kpi label="إجمالي الوثائق" value={String(docs.length)} sub="في السجل" icon={Stamp} color="#C8A24A" />
        <Kpi label="منتهية" value={String(nExpired)} sub="تتطلب تجديدًا فوريًا" icon={AlertTriangle} color={nExpired ? '#D9544D' : '#4FB286'} />
        <Kpi label={'تنتهي خلال ' + remindDays + ' يومًا'} value={String(nSoon)} sub="جهّز التجديد" icon={CalendarDays} color={nSoon ? '#E0A458' : '#4FB286'} />
      </div>

      <div className="card">
        <div className="tw">
          <table className="tb">
            <thead><tr><th>الوثيقة</th><th>الرقم</th><th>الفرع</th><th>الإصدار</th><th>الانتهاء</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} style={stOf(d) === 'expired' ? { background: 'rgba(217,84,77,.05)' } : null}>
                  <td style={{ fontWeight: 600, fontSize: 12.5 }}>{DOC_LABEL(d.type)}{d.notes ? <div style={{ fontSize: 9.5, color: 'var(--faint)' }}>{d.notes}</div> : null}</td>
                  <td className="num" style={{ fontSize: 11.5 }}>{d.number || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--dim)' }}>{(org.branches || []).find(b => b.id === d.branchId)?.name || 'المنشأة'}</td>
                  <td className="num" style={{ fontSize: 11 }}>{d.issueDate || '—'}</td>
                  <td className="num" style={{ fontSize: 11, fontWeight: 700, color: stOf(d) === 'expired' ? 'var(--rose)' : stOf(d) === 'soon' ? 'var(--amber)' : 'inherit' }}>{d.expiryDate || 'دائمة'}</td>
                  <td><span className={'badge ' + stCls[stOf(d)]} style={{ fontSize: 9.5 }}>{stTx(d)}</span></td>
                  <td>{canW && <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                    <button className="btn sm gh" onClick={() => setF({ ...d })}>تعديل</button>
                    <button className="btn sm gh" onClick={() => del(d.id)} title="حذف"><Trash2 size={13} /></button>
                  </div>}</td>
                </tr>
              ))}
              {docs.length === 0 && <tr><td colSpan={7}><div className="empty">لا وثائق مسجّلة بعد. أضِف سجلك التجاري وشهاداتك ورخصك لتتبّع صلاحياتها والتنبيه قبل انتهائها.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="note" style={{ marginTop: 10 }}>سجّل وثائقك الرسمية بتاريخ انتهائها، فتظهر حالتها (سارية/تنتهي قريبًا/منتهية) وتصلك تنبيهات في «مركز التنبيهات» و«اللوحة التنفيذية» قبل الانتهاء بالمهلة المحددة. الوثائق الدائمة اتركها بلا تاريخ انتهاء.</div>
      </div>

      {f && (
        <Modal title={f.id ? 'تعديل وثيقة' : 'وثيقة جديدة'} icon={Stamp} onClose={() => setF(null)}
          foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={save}><Check size={14} />حفظ</button></>}>
          <Field label="نوع الوثيقة">
            <select className="sel" value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>
              <option value="">— اختر —</option>
              {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.ar}</option>)}
            </select>
          </Field>
          <div className="grid g2">
            <Field label="رقم الوثيقة"><input className="inp" value={f.number} onChange={e => setF(s => ({ ...s, number: e.target.value }))} /></Field>
            <Field label="الفرع (اختياري)">
              <select className="sel" value={f.branchId} onChange={e => setF(s => ({ ...s, branchId: e.target.value }))}>
                <option value="">المنشأة (عام)</option>
                {(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="تاريخ الإصدار"><input type="date" className="inp" value={f.issueDate} onChange={e => setF(s => ({ ...s, issueDate: e.target.value }))} /></Field>
            <Field label="تاريخ الانتهاء (اتركه فارغًا للدائمة)"><input type="date" className="inp" value={f.expiryDate} onChange={e => setF(s => ({ ...s, expiryDate: e.target.value }))} /></Field>
          </div>
          <Field label="ملاحظة (اختياري)"><input className="inp" value={f.notes} onChange={e => setF(s => ({ ...s, notes: e.target.value }))} /></Field>
        </Modal>
      )}
    </div>
  );
}
