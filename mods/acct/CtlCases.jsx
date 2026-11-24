/* v54.1 — المرحلة 2: «سجل حالات الرقابة» — الفحص المحاسبي المستمر ودورة حياة كل حالة (اكتشاف ← إسناد ← مراجعة ← تصحيح ← اعتماد ← حل ← إعادة تحقق ← إغلاق).
   لا يعدّل أي سجل مالي: التصحيح يتم من شاشته الأصلية أو عبر إجراء، ثم يعيد الفحص التحقق. الأخطاء التقنية خارج هذا السجل. */
import React, { useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, AlertTriangle, ListChecks } from 'lucide-react';
import { CTL_SEV, CTL_ST, CTL_OPEN, CTL_CAT, CTL_FLOW, ctlScan, caseSync, caseMove, Kpi, DocLink, money, today, newAction, jeOwner } from '../../App.jsx';

const refLink = (r) => !r ? null : r.kind === 'inv' ? { inv: r.id } : r.kind === 'je' ? { e: 'man:' + r.id } : r.kind === 'acc' ? { acc: r.id } : null;

export function CtlCases({ org, ops, me, myBranches, commit, say }) {
  const issues = useMemo(() => { try { return ctlScan(org, ops, { today: today() }); } catch (e) { return []; } }, [org, ops]);
  const cases = ops.ctlCases || [];
  const pend = useMemo(() => caseSync(cases, issues, { at: new Date().toISOString(), by: 'system' }).res, [cases, issues]);
  const [fs, setFs] = useState('open'); const [fv, setFv] = useState(''); const [fc, setFc] = useState(''); const [open, setOpen] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const brIds = new Set((myBranches || []).map(b => b.id)); const allBr = (myBranches || []).length >= (org.branches || []).length;
  const mine = cases.filter(c => allBr || !c.branchId || brIds.has(c.branchId));
  const td = today();
  const shown = mine.filter(c => (fs === 'open' ? CTL_OPEN.includes(c.status) : fs === 'all' ? true : c.status === fs) && (!fv || c.sev === fv) && (!fc || c.cat === fc))
    .sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.sev) - ['critical', 'high', 'medium', 'low'].indexOf(b.sev) || String(a.due).localeCompare(String(b.due)));
  const openC = mine.filter(c => CTL_OPEN.includes(c.status));
  const brn = (id) => !id ? 'المركز / الشركة' : (((org.branches || []).find(b => b.id === id)) || {}).name || id;
  const sync = async () => {
    setBusy(true); let R = null;
    const ok = await commit(d => { const r = caseSync(d.ctlCases || [], issues, { at: new Date().toISOString(), by: (me && me.name) || 'system' }); R = r.res; return { ...d, ctlCases: r.list }; },
      { actionType: 'update', targetType: 'settings', targetId: 'ctl-cases', title: 'شغّل الفحص الرقابي وسجّل الحالات', details: issues.length + ' نتيجة' });
    setBusy(false); if (ok !== false && R) say('سُجّل الفحص ✓ — جديدة ' + R.created + ' · أُعيد فتحها ' + R.reopened + ' · تحققت ' + R.verified + ' · عولجت بانتظار التأكيد ' + R.cleared);
  };
  const upd = async (c, patch, title) => { const ok = await commit(d => ({ ...d, ctlCases: (d.ctlCases || []).map(x => x.id === c.id ? { ...x, ...patch(x) } : x) }), { actionType: 'update', targetType: 'settings', targetId: c.no, title, details: c.title.slice(0, 160) }); return ok !== false; };
  const move = async (c, to) => { const r = caseMove(c, to, me, note); if (r.err) return say(r.err, 'no'); if (await upd(c, () => r.c, 'نقل حالة رقابية إلى «' + CTL_ST[to][1] + '»')) { setNote(''); say('حُدّثت الحالة ✓'); } };
  const assign = async (c, owner, due) => { if (await upd(c, (x) => ({ owner, due, ...(x.status === 'new' && owner ? { status: 'assigned' } : {}), history: [...(x.history || []), { at: new Date().toISOString(), st: x.status === 'new' && owner ? 'assigned' : x.status, by: (me && me.name) || '', note: 'المسؤول: ' + owner + ' · الموعد: ' + due }] }), 'أسند حالة رقابية')) say('أُسندت ✓'); };
  const toAction = async (c) => { const key = 'case|' + c.key; if ((ops.actions || []).some(a => a.srcKey === key && a.status !== 'dismissed')) return say('يوجد إجراء لهذه الحالة', 'no');
    const rec = newAction(me, { src: 'check', srcKey: key, title: c.no + ' — ' + c.title, detail: c.evidence + '\nالحل المقترح: ' + c.fix, branchId: c.branchId || undefined, due: c.due, assignee: c.owner || undefined });
    const ok = await commit(d => ({ ...d, actions: [rec, ...(d.actions || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'حوّل حالة رقابية إلى إجراء', details: c.no }); if (ok !== false) say('أُنشئ إجراء ✓'); };
  return (
    <div className="grid" style={{ gap: 14 }} data-ctlcases>
      <div className="card">
        <div className="card-t"><ShieldCheck size={15} color="var(--brass)" />سجل حالات الرقابة المحاسبية <small style={{ color: 'var(--dim)', fontWeight: 400 }}>فحص حتمي للدفاتر — لا يعدّل أي سجل مالي</small></div>
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 12.5 }} data-ctlpend>
          <span>الفحص الآن: <b className="num">{issues.length}</b> نتيجة — جديدة غير مسجّلة <b className="num">{pend.created}</b>، ستُعاد فتحًا <b className="num">{pend.reopened}</b>، ستتحقق <b className="num">{pend.verified}</b></span>
          <button className="btn sm pri" data-ctlsync disabled={busy} onClick={sync}><RefreshCw size={13} />{busy ? 'جارٍ…' : 'تشغيل الفحص وتسجيل الحالات'}</button></div>
        <div className="hint" style={{ marginTop: 4 }}>الأخطاء التقنية للتطبيق (سجل أخطاء الأجهزة) منفصلة عن هذا السجل.</div>
      </div>
      <div className="grid g4">
        <Kpi label="حالات مفتوحة" value={openC.length} icon={ListChecks} />
        <Kpi label="حرجة وعالية مفتوحة" value={openC.filter(c => c.sev === 'critical' || c.sev === 'high').length} icon={AlertTriangle} color="#D9544D" />
        <Kpi label="متأخرة عن موعدها" value={openC.filter(c => c.due && c.due < td).length} color="#D9A83E" />
        <Kpi label="الأثر المالي المفتوح" value={money(openC.reduce((a, c) => a + (Number(c.impact) || 0), 0))} sub="تقدير من الدليل" />
      </div>
      <div className="card">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <select className="sel" aria-label="الحالة" style={{ maxWidth: 200 }} value={fs} onChange={e => setFs(e.target.value)}><option value="open">المفتوحة</option><option value="all">الكل</option>{Object.keys(CTL_ST).map(k => <option key={k} value={k}>{CTL_ST[k][1]}</option>)}</select>
          <select className="sel" aria-label="الخطورة" style={{ maxWidth: 160 }} value={fv} onChange={e => setFv(e.target.value)}><option value="">كل الخطورات</option>{Object.keys(CTL_SEV).map(k => <option key={k} value={k}>{CTL_SEV[k][1]}</option>)}</select>
          <select className="sel" aria-label="الفئة" style={{ maxWidth: 220 }} value={fc} onChange={e => setFc(e.target.value)}><option value="">كل الفئات</option>{Object.keys(CTL_CAT).map(k => <option key={k} value={k}>{CTL_CAT[k]}</option>)}</select>
        </div>
        <div className="tw" style={{ marginTop: 8 }}><table className="tb" style={{ fontSize: 12 }} data-ctltable><thead><tr><th>المرجع</th><th>الفئة</th><th>الخطورة</th><th>الوصف</th><th>الفرع</th><th>الأثر</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th></tr></thead>
          <tbody>{shown.slice(0, 300).map(c => <React.Fragment key={c.id}>
            <tr data-case={c.cat} style={{ cursor: 'pointer' }} onClick={() => { setOpen(open === c.id ? '' : c.id); setNote(''); }}>
              <td className="num">{c.no}{(c.occurrences || 1) > 1 && <small> ×{c.occurrences}</small>}</td><td>{CTL_CAT[c.cat] || c.cat}</td><td><span className={'badge ' + CTL_SEV[c.sev][0]}>{CTL_SEV[c.sev][1]}</span></td>
              <td>{c.title}{c.cleared && <div><span className="badge b-mint" style={{ fontSize: 9 }}>عولجت؟ أكّد بالحل</span></div>}</td><td>{brn(c.branchId)}</td><td className="num">{c.impact ? money(c.impact) : '—'}</td>
              <td>{c.owner || '—'}</td><td className="num" style={{ color: CTL_OPEN.includes(c.status) && c.due < td ? 'var(--rose)' : undefined }}>{c.due}</td><td><span className={'badge ' + CTL_ST[c.status][0]} title={CTL_ST[c.status][2]}>{CTL_ST[c.status][1]}</span></td></tr>
            {open === c.id && <tr data-casex><td colSpan={9} style={{ background: 'var(--ink)', lineHeight: 1.9 }}>
              <div><b>الدليل:</b> {c.evidence} {refLink(c.ref) && <DocLink to={refLink(c.ref)} title="فتح المصدر">· فتح المصدر</DocLink>}</div>
              <div><b>الحل المقترح:</b> {c.fix}</div><div><b>المصدر:</b> {c.module === 'anomalies' ? 'الأنماط الشاذة' : 'الفحص المحاسبي'} · اكتُشفت {String(c.detectedAt).slice(0, 10)} · آخر ظهور {String(c.lastSeenAt || '').slice(0, 10)}</div>
              {c.verify && <div><b>إعادة التحقق:</b> {c.verify.result === 'pass' ? 'نجحت' : 'فشلت'} — {c.verify.note}</div>}
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <input className="inp" style={{ maxWidth: 180 }} aria-label="المسؤول" defaultValue={c.owner} id={'ow-' + c.id} placeholder="المسؤول" />
                <input type="date" className="inp" style={{ maxWidth: 160 }} aria-label="الموعد" defaultValue={c.due} id={'du-' + c.id} />
                <button className="btn sm gh" data-caseassign onClick={() => assign(c, document.getElementById('ow-' + c.id).value.trim(), document.getElementById('du-' + c.id).value || c.due)}>حفظ الإسناد</button>
                <button className="btn sm gh" onClick={() => toAction(c)}>إنشاء إجراء</button></div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <input className="inp" style={{ maxWidth: 320 }} aria-label="ملاحظة القرار" value={note} onChange={e => setNote(e.target.value)} placeholder="ملاحظة / سبب القرار" />
                {(CTL_FLOW[c.status] || []).map(to => <button key={to} className="btn sm" data-casemove={to} disabled={['verified', 'closed', 'false_positive'].includes(to) && !jeOwner(me)} onClick={() => move(c, to)}>{CTL_ST[to][1]}</button>)}</div>
              <table className="tb" style={{ fontSize: 11, marginTop: 6 }}><tbody>{(c.history || []).slice().reverse().map((h, i) => <tr key={i}><td className="num">{String(h.at).replace('T', ' ').slice(0, 16)}</td><td>{(CTL_ST[h.st] || [])[1] || h.st}</td><td>{h.by}</td><td>{h.note}</td></tr>)}</tbody></table>
            </td></tr>}
          </React.Fragment>)}
            {!shown.length && <tr><td colSpan={9}><div className="empty">{cases.length ? 'لا حالات بهذا التصفية' : 'لم يُسجَّل فحص بعد — اضغط «تشغيل الفحص وتسجيل الحالات»'}</div></td></tr>}</tbody></table></div>
      </div>
    </div>);
}
