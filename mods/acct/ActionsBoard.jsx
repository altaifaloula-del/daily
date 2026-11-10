/* v38.7 — «الإجراءات والتوصيات»: كل تنبيه أو توصية يصير إجراءً له مسؤول وموعد وحالة، ويُقاس أثره بعد الإنجاز
   تظهر في «مركز التحليل» للمركز، وفي «الإغلاق اليومي ← إجراءات الفرع» لفريق الفرع (إجراءات فروعه فقط). */
import React, { useMemo, useState } from 'react';
import { ListChecks, Plus, Check, X, Play, MessageSquare, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { ACT_KIND, ACT_SRC, ACT_ST, Field, Kpi, Modal, ROLES, actionEffect, arDate, money, newAction, nowISO, rolePost, today } from '../../App.jsx';

const fmtM = (kind, v) => v == null ? '—' : /rate/.test(kind) ? v + '%' : money(v);
export const canEditAction = (me, a) => { const R = ROLES[me?.role] || {};
  return (R.scope === 'all' && rolePost(me?.role)) || a.assignee === me?.name || a.createdBy === me?.name
    || ((me?.role === 'branch_manager' || me?.role === 'regional_manager') && !!a.branchId); };

export function ActionsBoard({ org, ops, me, myBranches, commit, say }) {
  const ids = new Set((myBranches || []).map(b => b.id)); const central = (ROLES[me?.role] || {}).scope === 'all';
  const all = (ops.actions || []).filter(a => central || (a.branchId && ids.has(a.branchId)) || a.assignee === me?.name);
  const [tab, setTab] = useState('active');
  const [mine, setMine] = useState(false);
  const [f, setF] = useState(null);       // نموذج إجراء يدوي
  const [st, setSt] = useState(null);     // تغيير حالة: { a, to, note }
  const [nt, setNt] = useState(null);     // ملاحظة: { a, text }
  const td = today();
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
  const users = (org.users || []).filter(u => u.isActive !== false && u.name);
  const eff = useMemo(() => Object.fromEntries(all.filter(a => a.status === 'done' && a.metric).map(a => [a.id, actionEffect(org, ops, a)])), [org, ops]);   // eslint-disable-line
  const overdue = (a) => (a.status === 'open' || a.status === 'doing') && a.due && a.due < td;
  const shown = all.filter(a => (tab === 'active' ? (a.status === 'open' || a.status === 'doing') : tab === 'done' ? a.status === 'done' : tab === 'dismissed' ? a.status === 'dismissed' : true) && (!mine || a.assignee === me?.name))
    .sort((x, y) => (overdue(y) - overdue(x)) || String(x.due || '9').localeCompare(String(y.due || '9')) || String(y.at).localeCompare(String(x.at)));
  const doneM = all.filter(a => eff[a.id] && !eff[a.id].pending && !eff[a.id].nodata);
  const meta = (a, title, details) => ({ actionType: 'update', targetType: 'settings', targetId: a.id, branchName: brName(a.branchId), title, details: (a.title + (details ? ' · ' + details : '')).slice(0, 180) });

  const create = async () => {
    if (!String(f.title || '').trim()) return say('اكتب عنوان الإجراء', 'no');
    const rec = newAction(me, { src: 'manual', title: f.title.trim(), detail: f.detail || '', branchId: f.branchId || '', assignee: f.assignee || '', due: f.due || '' });
    const ok = await commit(d => ({ ...d, actions: [rec, ...(d.actions || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, branchName: brName(rec.branchId), title: 'أنشأ إجراءً', details: rec.title + (rec.assignee ? ' · المسؤول ' + rec.assignee : '') });
    if (ok) { setF(null); say('أُنشئ الإجراء ✓'); }
  };
  const move = async () => {
    const { a, to, note } = st;
    if ((to === 'done' || to === 'dismissed') && !String(note || '').trim()) return say(to === 'done' ? 'اكتب ما الذي نُفّذ' : 'اكتب سبب الاستبعاد', 'no');
    const n = note ? [{ at: nowISO(), by: me.name, text: String(note).trim().slice(0, 500), status: to }] : [];
    const ok = await commit(d => ({ ...d, actions: (d.actions || []).map(x => x.id !== a.id ? x : { ...x, status: to, notes: [...(x.notes || []), ...n], ...(to === 'done' ? { doneAt: nowISO(), doneBy: me.name } : {}), ...(to === 'doing' && !x.startedAt ? { startedAt: nowISO() } : {}) }) }),
      meta(a, to === 'done' ? 'أنجز إجراءً' : to === 'dismissed' ? 'استبعد إجراءً' : to === 'doing' ? 'بدأ تنفيذ إجراء' : 'أعاد فتح إجراء', note));
    if (ok) { setSt(null); say(to === 'done' ? 'سُجّل الإنجاز ✓' + (a.metric ? ' — يُقاس الأثر بعد أسبوع' : '') : 'حُدّث الإجراء ✓'); }
  };
  const addNote = async () => {
    const { a, text } = nt; if (!String(text || '').trim()) return;
    const ok = await commit(d => ({ ...d, actions: (d.actions || []).map(x => x.id !== a.id ? x : { ...x, notes: [...(x.notes || []), { at: nowISO(), by: me.name, text: String(text).trim().slice(0, 500) }] }) }), meta(a, 'أضاف ملاحظة على إجراء', text));
    if (ok) setNt(null);
  };
  const reassign = async (a, assignee, due) => {
    await commit(d => ({ ...d, actions: (d.actions || []).map(x => x.id !== a.id ? x : { ...x, assignee, ...(due ? { due } : {}) }) }), meta(a, 'عدّل مسؤول/موعد إجراء', (assignee || '—') + (due ? ' · ' + due : '')));
  };

  const cnt = (s) => all.filter(a => a.status === s).length;
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        <Kpi label="مفتوحة وقيد التنفيذ" value={String(cnt('open') + cnt('doing'))} sub={all.filter(a => a.assignee === me?.name && (a.status === 'open' || a.status === 'doing')).length + ' مسندة إليك'} icon={ListChecks} color="#E0A458" />
        <Kpi label="متأخرة عن موعدها" value={String(all.filter(overdue).length)} sub="تجاوزت الموعد ولم تُنجز" icon={Clock} color={all.some(overdue) ? '#D9544D' : '#4FB286'} />
        <Kpi label="منجزة" value={String(cnt('done'))} sub={doneM.length + ' قيس أثرها'} icon={Check} color="#4FB286" />
        <Kpi label="تحسّن بعد الإنجاز" value={doneM.length ? doneM.filter(a => eff[a.id].better).length + '/' + doneM.length : '—'} sub="عاد الرقم نصف المسافة نحو المعتاد على الأقل" icon={TrendingUp} color="#5B93C4" />
      </div>
      <div className="card">
        <div className="card-h"><div className="card-t"><ListChecks size={15} color="var(--brass)" />الإجراءات والتوصيات</div>
          <button className="btn sm pri" onClick={() => setF({ title: '', detail: '', branchId: central ? '' : ((myBranches || [])[0] || {}).id || '', assignee: '', due: '' })}><Plus size={13} />إجراء جديد</button></div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[['active', 'الجارية'], ['done', 'المنجزة'], ['dismissed', 'المستبعدة'], ['all', 'الكل']].map(([k, l]) => <button key={k} className={'btn sm' + (tab === k ? ' pri' : ' gh')} onClick={() => setTab(k)}>{l}</button>)}
          <label className="row" style={{ gap: 5, fontSize: 12.5 }}><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />المسندة إليّ فقط</label>
        </div>
        {!shown.length ? <div className="empty">{all.length ? 'لا إجراءات في هذا التصنيف.' : 'لا إجراءات بعد — حوّل نمطًا شاذًا أو توصية ذكية إلى إجراء، أو أنشئ إجراءً يدويًا.'}</div> : <div className="act-list">
          {shown.map(a => { const e = eff[a.id]; const can = canEditAction(me, a); const od = overdue(a); return (
            <div key={a.id} className={'act-item ' + a.status + (od ? ' late' : '')}>
              <div className="act-h"><b>{a.title}</b><span className={'badge ' + ACT_ST[a.status][0]}>{ACT_ST[a.status][1]}</span></div>
              {a.detail && <div className="act-d">{a.detail}</div>}
              <div className="act-meta">
                <span className="badge b-dim">{ACT_SRC[a.src] || a.src}</span>
                {a.branchId && <span className="badge b-dim">{brName(a.branchId)}</span>}
                <span>المسؤول: {can && (a.status === 'open' || a.status === 'doing') ? <select className="act-sel" value={a.assignee || ''} onChange={ev => reassign(a, ev.target.value)}><option value="">—</option>{users.filter(u => !a.branchId || !u.branchId || u.branchId === a.branchId || (ROLES[u.role] || {}).scope === 'all').map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select> : <b>{a.assignee || '—'}</b>}</span>
                <span className={od ? 'act-late' : ''}>الموعد: {can && (a.status === 'open' || a.status === 'doing') ? <input type="date" className="act-sel" value={a.due || ''} onChange={ev => reassign(a, a.assignee || '', ev.target.value)} /> : <span className="dt">{a.due ? arDate(a.due) : '—'}</span>}{od ? ' — متأخر' : ''}</span>
              </div>
              {a.metric && <div className="act-m">
                <span>{(ACT_KIND[a.metric.kind] || {}).ar}: عند الإنشاء <b className="num">{fmtM(a.metric.kind, a.metric.before)}</b> · المعتاد <b className="num">{fmtM(a.metric.kind, a.metric.normal)}</b></span>
                {e && (e.pending ? <span className="badge b-dim">يُقاس الأثر في <span className="dt">{arDate(e.ready)}</span></span>
                  : e.nodata ? <span className="badge b-dim">لا بيانات كافية للقياس</span>
                    : <span className={'badge ' + (e.better ? 'b-mint' : e.worse ? 'b-rose' : 'b-amber')}>{e.better ? <TrendingUp size={11} /> : <TrendingDown size={11} />} الآن {fmtM(a.metric.kind, e.now)} — {e.better ? 'تحسّن' : e.worse ? 'ساء' : 'تحسّن غير كافٍ'}</span>)}
              </div>}
              {(a.notes || []).length > 0 && <div className="act-notes">{a.notes.slice(-3).map((n, i) => <div key={i}><b>{n.by}</b> <span className="dt">{arDate(n.at)}</span>: {n.text}</div>)}</div>}
              {can && <div className="act-btns">
                {a.status === 'open' && <button className="btn sm gh" onClick={() => setSt({ a, to: 'doing', note: '' })}><Play size={12} />بدء التنفيذ</button>}
                {(a.status === 'open' || a.status === 'doing') && <button className="btn sm pri" onClick={() => setSt({ a, to: 'done', note: '' })}><Check size={12} />إنجاز</button>}
                {(a.status === 'open' || a.status === 'doing') && <button className="btn sm gh" onClick={() => setSt({ a, to: 'dismissed', note: '' })}><X size={12} />استبعاد</button>}
                {(a.status === 'done' || a.status === 'dismissed') && <button className="btn sm gh" onClick={() => setSt({ a, to: 'open', note: '' })}>إعادة فتح</button>}
                <button className="btn sm gh" onClick={() => setNt({ a, text: '' })}><MessageSquare size={12} />ملاحظة</button>
              </div>}
            </div>); })}
        </div>}
      </div>
      <div className="note">مصادر الإجراءات: زر «حوّل إلى إجراء» في «الأنماط الشاذة»، وفي توصيات «المركز الذكي»، أو إجراء يدوي. الإجراء الناتج عن نمط شاذ يُقاس أثره تلقائيًا بعد أسبوع من إنجازه مقابل المعتاد. المسؤول يصله إشعار، والمتأخر يظهر أولًا.</div>

      {f && <Modal title="إجراء جديد" icon={Plus} onClose={() => setF(null)} foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" onClick={create}><Check size={14} />إنشاء</button></>}>
        <Field label="العنوان"><input className="inp" value={f.title} onChange={e => setF(x => ({ ...x, title: e.target.value }))} placeholder="مثال: مراجعة جدول تشغيل المطبخ في فرع النسيم" /></Field>
        <Field label="التفاصيل"><textarea className="inp" rows={3} value={f.detail} onChange={e => setF(x => ({ ...x, detail: e.target.value }))} /></Field>
        <div className="grid g3">
          <Field label="الفرع"><select className="inp sel" value={f.branchId} onChange={e => setF(x => ({ ...x, branchId: e.target.value }))}>{central && <option value="">— عام —</option>}{(myBranches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="المسؤول"><select className="inp sel" value={f.assignee} onChange={e => setF(x => ({ ...x, assignee: e.target.value }))}><option value="">—</option>{users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}</select></Field>
          <Field label="الموعد"><input type="date" className="inp" value={f.due} onChange={e => setF(x => ({ ...x, due: e.target.value }))} /></Field>
        </div>
      </Modal>}
      {st && <Modal title={{ doing: 'بدء التنفيذ', done: 'إنجاز الإجراء', dismissed: 'استبعاد الإجراء', open: 'إعادة فتح' }[st.to]} icon={st.to === 'done' ? Check : st.to === 'dismissed' ? X : Play} onClose={() => setSt(null)}
        foot={<><button className="btn gh" onClick={() => setSt(null)}>إلغاء</button><button className="btn pri" onClick={move}>تأكيد</button></>}>
        <div className="note" style={{ marginBottom: 8 }}>{st.a.title}</div>
        <Field label={st.to === 'done' ? 'ما الذي نُفّذ؟ (إلزامي)' : st.to === 'dismissed' ? 'سبب الاستبعاد (إلزامي)' : 'ملاحظة (اختياري)'}><textarea className="inp" rows={3} value={st.note} onChange={e => setSt(x => ({ ...x, note: e.target.value }))} /></Field>
        {st.to === 'done' && st.a.metric && <div className="note"><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> يُقاس الأثر بعد أسبوع: {(ACT_KIND[st.a.metric.kind] || {}).ar} الآن مقابل المعتاد {fmtM(st.a.metric.kind, st.a.metric.normal)}.</div>}
      </Modal>}
      {nt && <Modal title="ملاحظة على الإجراء" icon={MessageSquare} onClose={() => setNt(null)} foot={<><button className="btn gh" onClick={() => setNt(null)}>إلغاء</button><button className="btn pri" onClick={addNote}>حفظ</button></>}>
        <Field label="الملاحظة"><textarea className="inp" rows={3} value={nt.text} onChange={e => setNt(x => ({ ...x, text: e.target.value }))} /></Field>
      </Modal>}
    </div>);
}
