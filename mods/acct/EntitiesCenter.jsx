/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState } from 'react';
import { Building2, Store, Landmark, Plus, Settings, Trash2, Check } from 'lucide-react';
import { Field, Kpi, Modal, NationalAddressFields, ROLES, branchEntityId, countedClosing, entityById, entityList, fmtNA, isoD, money, multiEntityOn, naClean, naErr, naHas, sum } from '../../App.jsx';

export function EntitiesCenter({ org, ops, me, myBranches, scoped, commitOrg, say }) {
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const admin = !!ROLES[me?.role]?.admin;
  const ents = entityList(org);
  const branches = org.branches || [];
  const counted = (scoped.closings || []).filter(countedClosing);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [ef, setEf] = useState(null); // نموذج منشأة (إضافة/تعديل)
  const inP = (d) => (!from || d >= from) && (!to || d <= to);
  const brOfEnt = (eid) => branches.filter(b => branchEntityId(b) === eid);
  const figFor = (eid) => {
    const bids = new Set(brOfEnt(eid).map(b => b.id));
    const cs = counted.filter(c => bids.has(c.branchId) && inP(c.date || ''));
    const rev = r2(sum(cs, c => c.totalRevenue || 0)), exp = r2(sum(cs, c => c.totalExpenses || 0));
    return { nb: brOfEnt(eid).length, n: cs.length, rev, exp, net: r2(rev - exp) };
  };
  const rows = ents.map(e => ({ e, ...figFor(e.id) }));
  const tot = { nb: sum(rows, r => r.nb), rev: r2(sum(rows, r => r.rev)), exp: r2(sum(rows, r => r.exp)), net: r2(sum(rows, r => r.net)) };

  const preset = (kind) => {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth(), iso = (dt) => isoD(dt);
    if (kind === 'month') { setFrom(iso(new Date(y, m, 1))); setTo(iso(new Date(y, m + 1, 0))); }
    else if (kind === 'year') { setFrom(y + '-01-01'); setTo(y + '-12-31'); }
    else { setFrom(''); setTo(''); }
  };

  const saveEnt = async () => {
    const f = ef; if (!f.name.trim()) return say('أدخل اسم المنشأة', 'no');
    if (naErr(f.na)) return say('العنوان الوطني: ' + naErr(f.na), 'no');
    const na = naClean(f.na), adr = naHas(na) ? { na, address: fmtNA(na) } : { na, address: (f.address || '').trim() };
    if (f.primary) {
      await commitOrg(d => ({ ...d, company: { ...(d.company || {}), name: f.name.trim(), taxNumber: (f.taxNumber || '').trim(), commercialReg: (f.commercialReg || '').trim(), activity: (f.activity || '').trim(), ...adr } }), { actionType: 'update', targetType: 'entity', targetId: 'primary', title: 'تعديل المنشأة الرئيسية', details: f.name.trim() });
    } else if (f.id) {
      await commitOrg(d => ({ ...d, entities: (d.entities || []).map(e => e.id === f.id ? { ...e, name: f.name.trim(), taxNumber: (f.taxNumber || '').trim(), commercialReg: (f.commercialReg || '').trim(), activity: (f.activity || '').trim(), ...adr } : e) }), { actionType: 'update', targetType: 'entity', targetId: f.id, title: 'تعديل منشأة', details: f.name.trim() });
    } else {
      const id = 'ent' + Date.now().toString(36);
      await commitOrg(d => ({ ...d, entities: [...(d.entities || []), { id, name: f.name.trim(), taxNumber: (f.taxNumber || '').trim(), commercialReg: (f.commercialReg || '').trim(), activity: (f.activity || '').trim(), ...adr }] }), { actionType: 'create', targetType: 'entity', targetId: id, title: 'إضافة منشأة', details: f.name.trim() });
    }
    setEf(null);
  };
  const delEnt = async (e) => {
    if (e.primary) return;
    await commitOrg(d => ({ ...d, entities: (d.entities || []).filter(x => x.id !== e.id), branches: (d.branches || []).map(b => branchEntityId(b) === e.id ? { ...b, entityId: '' } : b) }), { actionType: 'delete', targetType: 'entity', targetId: e.id, title: 'حذف منشأة', details: e.name });
  };
  const assignBranch = async (bId, eid) => {
    await commitOrg(d => ({ ...d, branches: (d.branches || []).map(b => b.id === bId ? { ...b, entityId: eid === 'primary' ? '' : eid } : b) }), { actionType: 'update', targetType: 'branch', targetId: bId, title: 'إسناد فرع لمنشأة', details: entityById(org, eid).name });
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 17 }}>مركز المنشآت</h2>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>أدِر أكثر من منشأة/شركة بأرقام ضريبية وفروع مستقلة — بنظرة موحّدة ولكل منشأة</div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <input className="inp" style={{ width: 'auto' }} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input className="inp" style={{ width: 'auto' }} type="date" value={to} onChange={e => setTo(e.target.value)} />
          <button className="btn sm gh" onClick={() => preset('month')}>هذا الشهر</button>
          <button className="btn sm gh" onClick={() => preset('year')}>هذه السنة</button>
          <button className="btn sm gh" onClick={() => preset('all')}>الكل</button>
        </div>
      </div>

      <div className="grid g3">
        <Kpi label="عدد المنشآت" value={ents.length} sub={multiEntityOn(org) ? (org.entities.length + ' إضافية + الرئيسية') : 'منشأة واحدة (الوضع الافتراضي)'} icon={Building2} color="#C8A24A" />
        <Kpi label="إجمالي الفروع" value={tot.nb} sub="موزّعة على المنشآت" icon={Store} color="#5B93C4" />
        <Kpi label="صافي المجموعة (موحّد)" value={money(tot.net)} sub={(from || to) ? 'للفترة المحددة' : 'كل المدة'} icon={Landmark} color={tot.net >= 0 ? '#4FB286' : '#D9544D'} />
      </div>

      <div className="card">
        <div className="card-t" style={{ marginBottom: 10 }}><Building2 size={15} color="var(--brass)" />النظرة الموحّدة — كل منشأة على حدة</div>
        <div className="tw">
          <table className="tb">
            <thead><tr><th>المنشأة</th><th>الرقم الضريبي</th><th style={{ textAlign: 'center' }}>الفروع</th><th style={{ textAlign: 'end' }}>الإيراد</th><th style={{ textAlign: 'end' }}>المصروفات</th><th style={{ textAlign: 'end' }}>الصافي</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.e.id}>
                  <td>{r.e.name} {r.e.primary && <span className="badge b-brass" style={{ marginInlineStart: 6 }}>الرئيسية</span>}</td>
                  <td className="num" style={{ fontSize: 11, color: r.e.taxNumber ? 'inherit' : 'var(--amber)' }}>{r.e.taxNumber || 'غير محدّد'}</td>
                  <td className="num" style={{ textAlign: 'center' }}>{r.nb}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(r.rev)}</td>
                  <td className="num" style={{ textAlign: 'end' }}>{money(r.exp)}</td>
                  <td className="num" style={{ textAlign: 'end', color: r.net >= 0 ? 'var(--mint)' : '#D9544D' }}>{money(r.net)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 900, background: 'rgba(200,162,74,.05)' }}>
                <td>الإجمالي الموحّد</td><td /><td className="num" style={{ textAlign: 'center' }}>{tot.nb}</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(tot.rev)}</td>
                <td className="num" style={{ textAlign: 'end' }}>{money(tot.exp)}</td>
                <td className="num" style={{ textAlign: 'end', color: 'var(--brass-l)' }}>{money(tot.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {admin ? (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="card-h">
              <div className="card-t"><Building2 size={15} color="var(--brass)" />المنشآت</div>
              <button className="btn sm pri" onClick={() => setEf({ name: '', taxNumber: '', commercialReg: '', activity: '' })}><Plus size={14} />منشأة جديدة</button>
            </div>
            {ents.map(e => (
              <div key={e.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--frame-o)' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{e.name} {e.primary && <span className="badge b-brass" style={{ marginInlineStart: 6 }}>الرئيسية</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)' }}>ض: {e.taxNumber || '—'} · س.ت: {e.commercialReg || '—'}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm gh" onClick={() => setEf({ ...e })}><Settings size={13} /></button>
                  {!e.primary && <button className="btn sm gh" onClick={() => delEnt(e)}><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><Store size={15} color="var(--brass)" />إسناد الفروع للمنشآت</div>
            {branches.length ? branches.map(b => (
              <div key={b.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--frame-o)' }}>
                <span style={{ fontSize: 13 }}>{b.name}</span>
                <select className="inp" style={{ width: 190 }} value={branchEntityId(b)} onChange={e => assignBranch(b.id, e.target.value)}>
                  {ents.map(en => <option key={en.id} value={en.id}>{en.name}{en.primary ? ' (الرئيسية)' : ''}</option>)}
                </select>
              </div>
            )) : <div className="empty">لا فروع بعد.</div>}
          </div>
        </div>
      ) : <div className="note">إدارة المنشآت وإسناد الفروع صلاحية للإدارة العليا/مسؤول النظام. هذه الشاشة لك للعرض الموحّد.</div>}

      {ef && (
        <Modal title={ef.primary ? 'تعديل المنشأة الرئيسية' : ef.id ? 'تعديل منشأة' : 'منشأة جديدة'} icon={Building2} onClose={() => setEf(null)}
          foot={<><button className="btn gh" onClick={() => setEf(null)}>إلغاء</button><button className="btn pri" onClick={saveEnt}><Check size={14} />حفظ</button></>}>
          <div className="grid g2" style={{ gap: 10 }}>
            <Field label="اسم المنشأة"><input className="inp" value={ef.name} onChange={e => setEf({ ...ef, name: e.target.value })} /></Field>
            <Field label="الرقم الضريبي"><input className="inp n" value={ef.taxNumber} placeholder="3xxxxxxxxxxxxx3" onChange={e => setEf({ ...ef, taxNumber: e.target.value })} /></Field>
            <Field label="السجل التجاري"><input className="inp n" value={ef.commercialReg} onChange={e => setEf({ ...ef, commercialReg: e.target.value })} /></Field>
            <Field label="النشاط"><input className="inp" value={ef.activity} onChange={e => setEf({ ...ef, activity: e.target.value })} /></Field>
          </div>
          <NationalAddressFields value={ef.na} legacy={ef.address} onChange={na => setEf(f => ({ ...f, na }))} />
          {!naHas(ef.na) && !!ef.address && <Field label="العنوان القديم (نص حر) — يُستبدل بالحقول أعلاه"><input className="inp" value={ef.address || ''} onChange={e => setEf({ ...ef, address: e.target.value })} /></Field>}
          {ef.primary && <div className="note" style={{ marginTop: 10 }}>هذه بيانات منشأتك الرئيسية (تُستخدم في الفواتير والتقارير) — تعديلها هنا يعدّل «بيانات الشركة».</div>}
        </Modal>
      )}

      <div className="note">💡 المنشأة الرئيسية هي منشأتك الحالية بلا أي تغيير. أضِف منشأة فقط إن كنت تدير أكثر من كيان قانوني؛ عندها تظهر خيارات المنشأة في <b>فاتورة زاتكا</b> و<b>منشئ التقارير</b>. الفروع غير المُسندة تبقى ضمن الرئيسية.</div>
    </div>
  );
}
