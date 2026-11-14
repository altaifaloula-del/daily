/* v40.9 — «ضبط حسابات الدفع»: تغيير آيبان الموظف أو المورد طلبٌ يعتمده شخص آخر من المالية/الإدارة
   المحرك في النواة (ibanStatus/requestIban/ibanApply)؛ الفصل بين الطالب والمعتمد تفرضه قواعد Firestore (ثابت 21). */
import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, ShieldCheck, Info, Lock, Check, X, RefreshCw } from 'lucide-react';
import { IBAN_APPROVERS, IBAN_ST, Kpi, ROLES, ibanApply, ibanMask, ibanStatus, loadIbanSigs, requestIban, sigFailMsg, signoff } from '../../App.jsx';

export function IbanControl({ org, me, commitOrg, say }) {
  const central = (ROLES[me?.role] || {}).scope === 'all';
  const [sigs, setSigs] = useState(undefined);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [flt, setFlt] = useState('issues');
  useEffect(() => { let on = true; loadIbanSigs().then(x => { if (on) setSigs(x); }); return () => { on = false; }; }, [tick]);
  const S = useMemo(() => (sigs === undefined ? null : ibanStatus(org, sigs)), [org, sigs]);
  if (!central) return <div className="card"><div className="empty"><Lock size={16} /> ضبط حسابات الدفع للإدارة المالية المركزية.</div></div>;
  if (!S) return <div className="card"><div className="empty">جارٍ التحقق من التوقيعات…</div></div>;
  const canApprove = IBAN_APPROVERS.includes(me?.role) || !!(ROLES[me?.role] || {}).admin;
  const mine = (r) => (me?.email && r.byEmail === me.email) || r.by === me?.name;
  const pend = S.reqs.filter(r => !r.decision), decided = S.reqs.filter(r => r.decision);
  const unv = S.payees.filter(p => p.st === 'unverified' && p.iban);
  const bad = S.payees.filter(p => ['unverified', 'changed', 'na'].includes(p.st));
  const decide = async (r, stage) => { setBusy(true);
    try { if (S.cloud) { const sg = await signoff('iban', stage, { id: r.ent, iban: r.iban }, { branchId: '', subRef: r.sigSubmit }); if (!sg.ok) return say(sigFailMsg(sg, stage === 'approve' ? 'اعتماد الآيبان' : 'رفض الآيبان'), 'no'); }
      else { if (mine(r)) return say('يعتمده شخص آخر غير طالبه', 'no');
        const ok = await commitOrg(d => ({ ...d, ibanReqs: (d.ibanReqs || []).map(x => x.id === r.id ? { ...x, localDecision: stage, localBy: me.name } : x) }), { actionType: 'update', targetType: 'user_account', targetId: r.ent, title: stage === 'approve' ? 'اعتمد آيبان' : 'رفض آيبان', details: r.name + ' · ' + ibanMask(r.iban) }); if (ok === false) return; }
      say(stage === 'approve' ? 'اعتُمد ✓ — يُستخدم في الدفع فورًا، ويُطبَّق على السجل عند «تطبيق القرارات»' : 'رُفض الطلب'); setTick(t => t + 1);
    } finally { setBusy(false); } };
  const verifyAll = async () => { if (!unv.length) return; setBusy(true); let n = 0;
    try { for (const p of unv) { const r = await requestIban(me, commitOrg, p, p.iban); if (!r.ok) { say(r.msg || 'تعذّر الطلب', 'no'); break; } n++; } } finally { setBusy(false); setTick(t => t + 1); }
    if (n) say('أُرسل ' + n + ' طلب توثيق — يعتمدها شخص آخر من المالية/الإدارة'); };
  const apply = async () => { if (!decided.length) return;
    const ok = await commitOrg(d => ibanApply(d, decided), { actionType: 'update', targetType: 'user_account', targetId: 'ibanReqs', title: 'طبّق قرارات حسابات الدفع', details: decided.filter(r => r.decision === 'approve' && r.valid).length + ' معتمد · ' + decided.filter(r => r.decision === 'reject').length + ' مرفوض' });
    if (ok !== false) { say('طُبّقت القرارات على السجلات ✓'); setTick(t => t + 1); } };
  const list = flt === 'issues' ? S.payees.filter(p => p.st !== 'ok' && p.st !== 'none') : S.payees.filter(p => p.iban || p.pending || p.approved);
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div><h2 style={{ fontSize: 17 }}>ضبط حسابات الدفع</h2><div style={{ fontSize: 12, color: 'var(--dim)' }}>آيبان الموظفين والموردين لا يتغيّر إلا بطلب يعتمده شخص آخر — وملف حماية الأجور لا يُصدَر بآيبان غير موثّق</div></div>
        <div className="rp-seg"><button className="btn sm gh" onClick={() => setTick(t => t + 1)} disabled={busy}><RefreshCw size={13} />تحديث</button>
          {decided.length > 0 && commitOrg && <button className="btn sm pri" onClick={apply} disabled={busy}><Check size={13} />تطبيق القرارات ({decided.length})</button>}</div>
      </div>
      {sigs === 'err' && <div className="cf-note warn"><span className="badge b-rose">تنبيه</span><span>تعذّرت قراءة التوقيعات — لا تُعرض حالة توثيق حتى يعود الاتصال</span></div>}
      {sigs === null && <div className="cf-note info"><span className="badge b-dim">معلومة</span><span>خارج السحابة: القرار يُحفظ في الطلب نفسه ولا توقيع موثّق — الضبط الكامل يعمل على المنصة السحابية</span></div>}
      <div className="grid g3">
        <Kpi label="طلبات بانتظار الاعتماد" value={String(pend.length)} sub={canApprove ? 'يعتمدها غير طالبها' : 'يعتمدها المالية أو الإدارة'} icon={Landmark} color={pend.length ? '#E0A458' : '#4FB286'} />
        <Kpi label="حسابات غير موثّقة" value={String(bad.length)} sub={S.payees.filter(p => p.st === 'changed').length ? S.payees.filter(p => p.st === 'changed').length + ' مخالف لآخر اعتماد' : 'تحتاج طلب توثيق واعتمادًا'} icon={ShieldCheck} color={bad.length ? '#D9544D' : '#4FB286'} />
        <Kpi label="حسابات موثّقة" value={String(S.payees.filter(p => p.st === 'ok' || p.st === 'approved').length)} sub={'من ' + S.payees.filter(p => p.iban).length + ' بآيبان'} icon={ShieldCheck} color="#4FB286" />
      </div>
      {pend.length > 0 && <div className="card"><div className="card-t" style={{ marginBottom: 6 }}>طلبات بانتظار الاعتماد</div>
        <div className="me-list">{pend.map(r => <div key={r.id} className="me-row">
          <span className="me-a"><b>{r.name}</b><small>{r.ent.startsWith('emp:') ? 'موظف' : 'مورد'} · {r.oldIban ? 'من ' + ibanMask(r.oldIban) + ' إلى' : 'توثيق'} <b className="num" dir="ltr">{r.iban}</b></small><small>طلبه {r.by} · {String(r.at).slice(0, 16).replace('T', ' ')} — طابِقه مع خطاب البنك أو شهادة الآيبان قبل الاعتماد</small></span>
          <span className="me-b">{mine(r) ? <small>بانتظار شخص آخر</small> : canApprove ? <span className="sv-go"><button className="btn sm pri" disabled={busy} onClick={() => decide(r, 'approve')}><Check size={12} />اعتماد</button><button className="btn sm gh" disabled={busy} onClick={() => decide(r, 'reject')}><X size={12} />رفض</button></span> : <small>للمالية أو الإدارة</small>}</span>
        </div>)}</div></div>}
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <div className="rp-seg"><button className={'btn sm' + (flt === 'issues' ? ' pri' : ' gh')} onClick={() => setFlt('issues')}>تحتاج إجراء</button><button className={'btn sm' + (flt === 'all' ? ' pri' : ' gh')} onClick={() => setFlt('all')}>الكل</button></div>
          {unv.length > 0 && commitOrg && <button className="btn sm" disabled={busy} onClick={verifyAll}><ShieldCheck size={13} />طلب توثيق غير الموثّقة ({unv.length})</button>}
        </div>
        {!list.length ? <div className="empty">{flt === 'issues' ? 'كل حسابات الدفع موثّقة ✓' : 'لا آيبانات مسجلة'}</div> :
          <div className="me-list">{list.map(p => <div key={p.ent} className="me-row">
            <span className="me-a"><b>{p.name}</b><small>{p.type === 'emp' ? 'موظف' : 'مورد'} · <span className="num" dir="ltr">{p.iban || '—'}</span>{p.approved && p.st === 'approved' ? ' ← المعتمد ' + ibanMask(p.approved.iban) : ''}</small></span>
            <span className="me-b"><span className={'badge ' + IBAN_ST[p.st][0]}>{IBAN_ST[p.st][1]}</span></span></div>)}</div>}
      </div>
      <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> <b>لماذا؟</b> تغيير حساب المستفيد أشهر طرق اختلاس المدفوعات. هنا: التغيير طلب موقّع باسم طالبه، ويعتمده شخص آخر (المكتب الرئيسي أو الإدارة العامة أو المالية أو مسؤول النظام) بالآيبان نفسه — والخادم يرفض أن يعتمد الطالب طلبه حتى لو كان مسؤول النظام.
        الآيبانات المسجلة قبل هذا الإصدار «غير موثّقة» حتى تمر بالمسار مرة واحدة (طلب توثيق ثم اعتماد). أي تعديل للآيبان خارج المسار يظهر «مخالف لآخر اعتماد»، وملف حماية الأجور يُمنع حتى يُوثَّق.</div>
    </div>);
}
