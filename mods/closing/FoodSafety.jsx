/* v41.4 — «سجل سلامة الغذاء»: قراءات درجات حرارة معدات التبريد والتجميد والحفظ الساخن لكل فرع
   الفرع يسجّل القراءة (خارج المدى ⇒ إجراء تصحيحي إلزامي)؛ المركز يعدّ المعدات ويتابع الالتزام ويطبع السجل للتفتيش.
   المحرك في النواة (fsStatus/fsInRange). */
import React, { useMemo, useState } from 'react';
import { Thermometer, Plus, Printer, Info, Check, Trash2 } from 'lucide-react';
import { FS_KIND, Field, Kpi, ROLES, arDate, fsInRange, fsStatus, nowISO, printA4, today, uid } from '../../App.jsx';

const addD = (d, k) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + k); return x.toISOString().slice(0, 10); };
const rng = (u) => (u.min != null && u.min !== '' ? u.min + '°' : '') + (u.min != null && u.min !== '' && u.max != null && u.max !== '' ? ' إلى ' : '') + (u.max != null && u.max !== '' ? u.max + '°' : '') || 'بلا مدى';

export function FoodSafety({ org, ops, me, myBranches, commit, commitOrg, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const brs = (myBranches && myBranches.length ? myBranches : (org.branches || [])).filter(b => b.isActive !== false);
  const [br, setBr] = useState(me?.branchId || (brs[0] || {}).id || '');
  const [inp, setInp] = useState({}); const [act, setAct] = useState({});
  const [per7, setPer7] = useState(7);
  const [uF, setUF] = useState(null);
  const td = today(); const perDay = Math.max(1, Number((org.fsCfg || {}).perDay) || 2);
  const units = (org.fsUnits || []).filter(u => u.branchId === br);
  const todayLogs = (ops.fsLogs || []).filter(l => l.branchId === br && l.date === td);
  const S = useMemo(() => fsStatus(org, ops, { from: addD(td, -(per7 - 1)), to: td, branchIds: central ? null : [br] }), [org, ops, td, per7, central, br]);
  const record = async (u) => { const t = String(inp[u.id] ?? '').trim(); if (t === '' || !isFinite(Number(t))) return say('أدخل درجة الحرارة', 'no');
    const ok = fsInRange(u, t); const a = String(act[u.id] || '').trim(); if (!ok && a.length < 4) return say('القراءة خارج المدى — اكتب الإجراء التصحيحي (نقل المواد، ضبط الجهاز، إتلاف…)', 'no');
    const rec = { id: uid('fs'), branchId: br, unitId: u.id, unitName: u.name, date: td, at: nowISO(), temp: Number(t), ok, ...(ok ? {} : { action: a }), by: me?.name || '' };
    const r = await commit(d => ({ ...d, fsLogs: [rec, ...(d.fsLogs || [])] }), { actionType: 'create', targetType: 'daily_closing', targetId: rec.id, title: 'قراءة حرارة — ' + u.name, details: rec.temp + '°' + (ok ? '' : ' خارج المدى · ' + a) });
    if (r !== false) { setInp(x => ({ ...x, [u.id]: '' })); setAct(x => ({ ...x, [u.id]: '' })); say(ok ? 'سُجّلت القراءة ✓' : 'سُجّلت القراءة خارج المدى مع الإجراء التصحيحي'); } };
  const saveUnit = async () => { const f = uF; if (!String(f.name || '').trim()) return say('اسم الجهاز', 'no'); if (!f.branchId) return say('اختر الفرع', 'no');
    const rec = { id: f.id || uid('fu'), branchId: f.branchId, name: f.name.trim(), kind: FS_KIND[f.kind] ? f.kind : 'other', min: f.min === '' || f.min == null ? null : Number(f.min), max: f.max === '' || f.max == null ? null : Number(f.max) };
    if (rec.min == null && rec.max == null) return say('حدّد المدى المقبول (حد أدنى أو أعلى)', 'no');
    const r = await commitOrg(d => ({ ...d, fsUnits: f.id ? (d.fsUnits || []).map(x => x.id === f.id ? rec : x) : [...(d.fsUnits || []), rec] }), { actionType: f.id ? 'update' : 'create', targetType: 'settings', targetId: rec.id, title: 'جهاز سلامة الغذاء', details: rec.name + ' · ' + rng(rec) });
    if (r !== false) { setUF(null); say('حُفظ ✓'); } };
  const delUnit = async (u) => { if (!window.confirm('حذف «' + u.name + '» من قائمة المعدات؟ (قراءاته السابقة تبقى في السجل)')) return;
    await commitOrg(d => ({ ...d, fsUnits: (d.fsUnits || []).filter(x => x.id !== u.id) }), { actionType: 'delete', targetType: 'settings', targetId: u.id, title: 'حذف جهاز سلامة الغذاء', details: u.name }); };
  const savePer = async (v) => { const n = Math.max(1, Math.min(6, Number(v) || 2)); await commitOrg(d => ({ ...d, fsCfg: { ...(d.fsCfg || {}), perDay: n } }), { actionType: 'update', targetType: 'settings', targetId: 'fsCfg', title: 'عدد قراءات الحرارة اليومية', details: String(n) }); };
  const print = () => { const from = addD(td, -(per7 - 1)); const L = (ops.fsLogs || []).filter(l => l.date >= from && l.date <= td && (central || l.branchId === br)).sort((a, c) => String(a.at).localeCompare(String(c.at)));
    const bn = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
    printA4(org, 'سجل درجات حرارة سلامة الغذاء', from + ' — ' + td + (central ? '' : ' · ' + bn(br)),
      `<table><thead><tr><th>الفرع</th><th>الجهاز</th><th>التاريخ والوقت</th><th>الحرارة °م</th><th>الحالة</th><th>الإجراء التصحيحي</th><th>سجّلها</th></tr></thead><tbody>${L.map(l => `<tr><td>${bn(l.branchId)}</td><td>${l.unitName || ''}</td><td class="n">${String(l.at).slice(0, 16).replace('T', ' ')}</td><td class="n">${l.temp}</td><td>${l.ok ? 'ضمن المدى' : '<b style="color:#C0392B">خارج المدى</b>'}</td><td>${l.action || ''}</td><td>${l.by || ''}</td></tr>`).join('')}</tbody></table>
      <div class="sign"><div>مسؤول المطبخ</div><div>مدير الفرع</div><div>المراجعة</div></div>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); };
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>سجل سلامة الغذاء</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>درجات حرارة الثلاجات والفريزرات والحفظ الساخن — {perDay} قراءة يوميًا لكل جهاز</div></div>
        <div className="rp-seg">{[7, 30].map(n => <button key={n} className={'btn sm' + (per7 === n ? ' pri' : ' gh')} onClick={() => setPer7(n)}>آخر {n} يومًا</button>)}<button className="btn sm" onClick={print}><Printer size={13} />السجل للتفتيش</button></div>
      </div>
      {brs.length > 1 && <select className="inp sel" style={{ maxWidth: 320 }} value={br} onChange={e => setBr(e.target.value)} aria-label="الفرع">{brs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
      <div className="card"><div className="card-t" style={{ marginBottom: 6 }}><Thermometer size={15} color="var(--brass)" /> قراءات اليوم — {arDate(td)}</div>
        {!units.length ? <div className="empty">لا معدات معرّفة لهذا الفرع{central ? ' — أضفها من «المعدات» أدناه' : ' — تطلب الإدارة إضافتها'}.</div> :
          <div className="me-list">{units.map(u => { const L = todayLogs.filter(l => l.unitId === u.id); const t = String(inp[u.id] ?? ''); const bad = t !== '' && isFinite(Number(t)) && !fsInRange(u, t); return (
            <div key={u.id} className="me-row fs-row">
              <span className="me-a"><b>{u.name}</b><small>{(FS_KIND[u.kind] || FS_KIND.other).ar} · المدى {rng(u)} · {L.length}/{perDay} اليوم{L.length ? ' · آخرها ' + L[0].temp + '°' + (L[0].ok ? '' : ' ⚠') : ''}</small>
                {bad && <input className="inp" placeholder="الإجراء التصحيحي (إلزامي)" aria-label={'إجراء ' + u.name} value={act[u.id] || ''} onChange={e => setAct(x => ({ ...x, [u.id]: e.target.value }))} />}</span>
              <span className="me-b"><span className="sv-go"><input className={'inp n' + (bad ? ' fs-bad' : '')} inputMode="decimal" placeholder="°م" aria-label={'حرارة ' + u.name} value={t} onChange={e => setInp(x => ({ ...x, [u.id]: e.target.value.replace(/[^\d.\-]/g, '').slice(0, 6) }))} />
                {commit && <button className="btn sm pri" onClick={() => record(u)}><Check size={12} />تسجيل</button>}</span></span>
            </div>); })}</div>}
      </div>
      <div className="grid g3">{S.branches.map(b => <Kpi key={b.id} label={'الالتزام — ' + b.name} value={b.pct == null ? '—' : b.pct + '%'} sub={b.done + ' من ' + b.req + ' قراءة · ' + b.out.length + ' خارج المدى'} icon={Thermometer} color={b.pct >= 95 ? '#4FB286' : b.pct >= 80 ? '#E0A458' : '#D9544D'} />)}</div>
      {S.branches.some(b => b.out.length) && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>قراءات خارج المدى</div>
        <div className="me-list">{S.branches.flatMap(b => b.out.map(l => <div key={l.id} className="me-row"><span className="me-a"><b>{b.name} — {l.unitName}</b><small>{String(l.at).slice(0, 16).replace('T', ' ')} · {l.by} · الإجراء: {l.action || '—'}</small></span><span className="me-b"><b className="num" style={{ color: 'var(--rose)' }}>{l.temp}°</b></span></div>))}</div></div>}
      {central && commitOrg && <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}><div className="card-t">المعدات ({(org.fsUnits || []).length})</div>
          <div className="rp-seg"><label className="pp-lead">قراءات يوميًا <input className="inp n" inputMode="numeric" defaultValue={perDay} onBlur={e => Number(e.target.value) !== perDay && savePer(e.target.value)} /></label>
            <button className="btn sm pri" onClick={() => setUF({ branchId: br, name: '', kind: 'fridge', min: FS_KIND.fridge.min, max: FS_KIND.fridge.max })}><Plus size={13} />جهاز</button></div></div>
        {uF && <div className="grid g3" style={{ gap: 8, marginBottom: 8 }}>
          <Field label="الفرع"><select className="inp sel" value={uF.branchId} onChange={e => setUF(f => ({ ...f, branchId: e.target.value }))}>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="اسم الجهاز"><input className="inp" value={uF.name} placeholder="ثلاجة الخضار، فريزر اللحوم…" onChange={e => setUF(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="النوع"><select className="inp sel" value={uF.kind} onChange={e => { const k = e.target.value; setUF(f => ({ ...f, kind: k, min: FS_KIND[k].min ?? '', max: FS_KIND[k].max ?? '' })); }}>{Object.entries(FS_KIND).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}</select></Field>
          <Field label="الحد الأدنى °م"><input className="inp n" inputMode="decimal" value={uF.min ?? ''} onChange={e => setUF(f => ({ ...f, min: e.target.value.replace(/[^\d.\-]/g, '') }))} /></Field>
          <Field label="الحد الأعلى °م"><input className="inp n" inputMode="decimal" value={uF.max ?? ''} onChange={e => setUF(f => ({ ...f, max: e.target.value.replace(/[^\d.\-]/g, '') }))} /></Field>
          <div className="row" style={{ gap: 6, alignItems: 'end' }}><button className="btn pri" onClick={saveUnit}><Check size={14} />حفظ</button><button className="btn gh" onClick={() => setUF(null)}>إلغاء</button></div>
        </div>}
        <div className="me-list">{(org.fsUnits || []).map(u => <div key={u.id} className="me-row"><span className="me-a"><b>{u.name}</b><small>{((org.branches || []).find(b => b.id === u.branchId) || {}).name} · {(FS_KIND[u.kind] || FS_KIND.other).ar} · {rng(u)}</small></span>
          <span className="me-b"><span className="sv-go"><button className="btn sm gh" onClick={() => setUF({ ...u })}>تعديل</button><button className="btn sm gh" aria-label={'حذف ' + u.name} onClick={() => delUnit(u)}><Trash2 size={12} /></button></span></span></div>)}</div>
      </div>}
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> المدى المقترح مرجع شائع (تبريد 0 إلى 5°م · تجميد −18°م أو أقل · حفظ ساخن 63°م أو أعلى) ويُعدَّل لكل جهاز وفق اشتراطات البلدية المعتمدة لديك. القراءة خارج المدى لا تُسجَّل بلا إجراء تصحيحي، والسجل المطبوع جاهز للتفتيش ويُصدَّر Excel/CSV.</div>
    </div>);
}
