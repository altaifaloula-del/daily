/* v56.50 — «الرسائل»: دفعات رسائل للعملاء (حملة تسويقية · إشعار ولاء · تذكير استحقاق الآجل) — معطّلة افتراضيًا (org.mkt.comms.sendOn).
   الدفعة في ops.commsJobs (المستند المركزي): مسودة ← بانتظار الاعتماد ← معتمدة (المالك أو المدير العام، لا المنشئ) ← أُرسلت/فشلت (رد الخادم).
   الجمهور والتكلفة بالأجزاء من commsAudience، والأرقام مقنّعة في الواجهة؛ والخادم يعيد الحساب من بياناته ولا يثق بالمتصفح.
   المحوّل الوحيد الآن «تجريبي» لا يرسل شيئًا — الإرسال الفعلي يتطلب اختيار مزوّد وحساب باسم المنشأة واسم مرسل مسجّل (قرارا المجلس M1/M2). */
import React, { useState, useMemo } from 'react';
import { Field, Modal, makeXlsx, nowISO, uid, logAudit, commsCfgOf, smsParts, COMMS_KINDS, COMMS_JOB_ST, commsSendOn, commsCanApprove, commsFilterOf, commsJobErr, commsAudience, commsJobMove, commsNextNo, commsApi, mktCanExport, dtLocal } from '../../App.jsx';
import { MessageSquare, Download } from 'lucide-react';

const dl = (name, rows) => { try { const blob = makeXlsx([{ name: name.slice(0, 30), rows }]); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name + '.xlsx'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch { /* */ } };
const SK = { noConsent: 'بلا موافقة', optOut: 'طلبوا الإيقاف', cap: 'بلغوا الحد الشهري', invalid: 'رقم غير صالح', noPhone: 'بلا جوال' };

function AudienceBox({ A }) {
  if (!A) return null; const sk = Object.entries(A.skipped).filter(([, v]) => v > 0);
  return (<div className="card" data-cmsaud style={{ background: 'var(--ink)', marginTop: 8 }}>
    <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}><b>المستلمون: <span className="num" data-cmsn>{A.n}</span></b><span>التكلفة التقديرية: <b className="num" data-cmsparts>{A.parts}</b> رسالة SMS (أجزاء)</span>
      {A.quiet && <span className="badge b-amber">ساعات الهدوء الآن — يُؤجَّل الإرسال</span>}</div>
    {sk.length > 0 && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>استُبعد: {sk.map(([k, v]) => SK[k] + ' ' + v).join(' · ')}</div>}
    {A.sample.length > 0 && <table className="tb" style={{ fontSize: 12, marginTop: 6 }} data-cmssample><thead><tr><th>عيّنة (الأرقام مقنّعة)</th><th>الاسم</th><th style={{ textAlign: 'end' }}>الأجزاء</th></tr></thead>
      <tbody>{A.sample.map((s, i) => <tr key={i}><td className="num" dir="ltr" style={{ textAlign: 'start' }}>{s.m}</td><td>{s.name || '—'}</td><td className="num" style={{ textAlign: 'end' }}>{s.parts}</td></tr>)}</tbody></table>}
    {!A.n && <div className="empty">لا مستلمين بهذه الشروط.</div>}
  </div>);
}

export function CommsJobs({ org, ops, loy, me, commit, say, canApp }) {
  const C = commsCfgOf(org); const on = commsSendOn(org); const tpls = C.templates.filter(t => t.ch === 'sms');
  const jobs = ((ops && ops.commsJobs) || []).slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const [f, setF] = useState(null); const [prev, setPrev] = useState(null); const [busy, setBusy] = useState('');
  const tplName = (id) => (C.templates.find(t => t.id === id) || {}).name || '—';
  const fAud = useMemo(() => (f && f.tplId ? commsAudience(org, ops, loy, { ...f, filter: commsFilterOf(f.kind, f.filter) }, Date.now()) : null), [f, org, ops, loy]);
  const save = async () => {
    const job = { kind: f.kind, ch: 'sms', tplId: f.tplId, filter: commsFilterOf(f.kind, f.filter) }; const e = commsJobErr(org, job); if (e) return say(e, 'no');
    const A = commsAudience(org, ops, loy, job, Date.now());
    const rec = { id: uid('cj'), no: commsNextNo(ops), ...job, est: { n: A.n, parts: A.parts }, status: 'draft', by: me.name, byId: me.id || '', ...(me.email ? { byEmail: String(me.email).toLowerCase() } : {}), at: nowISO() };
    const ok = await commit(d => ({ ...d, commsJobs: [rec, ...(d.commsJobs || [])] }), { actionType: 'create', targetType: 'settings', targetId: rec.id, title: 'أنشأ دفعة رسائل', details: rec.no + ' · ' + COMMS_KINDS[rec.kind] + ' · ' + A.n + ' مستلم · ' + A.parts + ' جزء' });
    if (ok !== false) { setF(null); say('حُفظت الدفعة ' + rec.no + ' مسودة'); } };
  const move = async (j, to, title) => {
    let at = nowISO(); const pre = commsJobMove(j, to, me, at); if (pre.err) return say(pre.err, 'no'); let err = ''; let srv = null;
    // الاعتماد في الخادم (المراجعة الأمنية): يرفض المنشئ ويبصم المحتوى المعتمد في سجل لا يكتبه غيره — ثم تُحدَّث الحالة هنا
    if (to === 'approved') { setBusy(j.id); try { srv = await commsApi(j.id, 'approve'); } catch (e) { setBusy(''); return say(e.message || 'تعذّر الاعتماد', 'no'); } setBusy(''); at = srv.approvedAt || at; }
    // الإرسال للاعتماد يُسجَّل في الخادم (بريد المُرسِل وبصمة المحتوى) — منه يُعرف من لا يحق له الاعتماد؛ السجل الموجود سابقًا (dup) يكفي
    if (to === 'pending') { setBusy(j.id); try { await commsApi(j.id, 'submit'); } catch (e) { if (e.code !== 'dup') { setBusy(''); return say(e.message || 'تعذّر الإرسال للاعتماد', 'no'); } } setBusy(''); }
    // يُعاد الفحص على أحدث نسخة (حالة تغيّرت من مستخدم آخر ⇒ لا تغيير)
    const ok = await commit(d => { const x = (d.commsJobs || []).find(y => y.id === j.id); const r = commsJobMove(x, to, me, at); if (r.err) { err = r.err; return d; }
      const nx = srv ? { ...r.next, approvedBy: srv.approvedBy || r.next.approvedBy, approvedById: srv.approvedById || r.next.approvedById } : r.next;
      return { ...d, commsJobs: (d.commsJobs || []).map(y => y.id === j.id ? nx : y) }; }, { actionType: to === 'approved' ? 'approve' : 'update', targetType: 'settings', targetId: j.id, title, details: j.no + ' · ' + COMMS_KINDS[j.kind] });
    if (ok === false || err) return say(err || 'لم يُحفظ', 'no'); say(title + ' — ' + j.no); };
  const exp = (j) => {
    if (!commsCanApprove(me) || !mktCanExport(org, me)) return say('تصدير المستلمين للمعتمد (المالك أو المدير العام) وحده', 'no');
    const A = commsAudience(org, ops, loy, j, Date.now());
    // لا تنزيل قبل نجاح التسجيل في سجل التدقيق (M3)
    return logAudit({ actionType: 'export', targetType: 'customer', targetId: 'comms:' + j.id, title: 'صدّر مستلمي دفعة رسائل', details: j.no + ' · ' + COMMS_KINDS[j.kind] + ' · ' + A.n + ' رقم' })
      .then(ok => { if (ok === false) return say('تعذّر تسجيل التصدير في سجل التدقيق — لم يُنزَّل الملف', 'no');
        dl('مستلمو_' + j.no, [['الجوال', 'الاسم', 'الأجزاء', 'النص'], ...A.list.map(x => [x.phone, x.name, x.parts, x.text])]); }); };
  const send = async (j) => {
    if (!on) return say('مسار الإرسال غير مفعّل — يفعّله مسؤول النظام من «إعدادات التواصل»', 'no');
    if (!commsCanApprove(me)) return say('الإرسال للمالك أو المدير العام', 'no');
    setBusy(j.id);
    try { const r = await commsApi(j.id); const res = r.result || {};
      const ok = await commit(d => ({ ...d, commsJobs: (d.commsJobs || []).map(y => y.id === j.id ? { ...y, status: 'sent', sentAt: res.at || nowISO(), sentBy: me.name, result: res } : y) }), { actionType: 'update', targetType: 'settings', targetId: j.id, title: res.dry ? 'إرسال تجريبي لدفعة رسائل (بلا إرسال فعلي)' : 'أرسل دفعة رسائل', details: j.no + ' · ' + (res.n || 0) + ' مستلم · نجح ' + (res.ok || 0) + ' · فشل ' + (res.fail || 0) });
      if (ok !== false) say((res.dry ? 'تجريبي — لم تُرسل أي رسالة فعلًا: ' : 'أُرسلت: ') + (res.n || 0) + ' مستلم · ' + (res.parts || 0) + ' جزء'); }
    catch (e) {
      if (e.result) await commit(d => ({ ...d, commsJobs: (d.commsJobs || []).map(y => y.id === j.id ? { ...y, status: 'failed', sentAt: nowISO(), sentBy: me.name, result: e.result } : y) }), { actionType: 'update', targetType: 'settings', targetId: j.id, title: 'فشل إرسال دفعة رسائل', details: j.no });
      say(e.message || 'تعذّر الإرسال', 'no'); }
    finally { setBusy(''); } };
  const F = f ? f.filter || {} : {}; const setFl = (k, v) => setF(x => ({ ...x, filter: { ...(x.filter || {}), [k]: v } }));
  const num = (v) => String(v || '').replace(/\D/g, '');
  return (<div className="grid" style={{ gap: 12 }} data-cms>
    <div className="card" style={{ borderColor: 'rgba(217,164,65,.5)' }}><div className="note" data-cmsoff>
      مسار الإرسال {on ? <b>مفعّل بالمحوّل التجريبي</b> : <b>غير مفعّل</b>}. <b>لا تُرسل أي رسالة فعلًا الآن</b> — «الإرسال التجريبي» يحسب الجمهور في الخادم ويسجّل ما كان سيُرسل فقط.
      الإرسال الفعلي يتطلب اختيار مزوّد رسائل سعودي مرخّص، وحسابًا باسم المنشأة، واسم مرسل مسجّل، ثم إضافة المفتاح في إعدادات الخادم (لا يُحفظ في المتصفح).
      الحملات للموافقين صراحةً فقط وبالحد الشهري، وتذكير الآجل رسالة خدمية، وكلها تحترم ساعات الهدوء (بتوقيت الرياض) وطلب الإيقاف، ويعتمدها المالك أو المدير العام لا منشئها.</div></div>
    <div className="card" data-cmslist>
      <div className="row" style={{ alignItems: 'center', marginBottom: 8 }}><div className="card-t" style={{ margin: 0 }}>دفعات الرسائل</div>
        {canApp && <button className="btn sm pri" style={{ marginInlineStart: 'auto' }} data-cmsnew onClick={() => setF({ kind: 'campaign', tplId: (tpls[0] || {}).id || '', filter: {} })}>دفعة جديدة</button>}</div>
      {!tpls.length && <div className="note" style={{ marginBottom: 8 }}>أضف قالب رسالة لقناة SMS من «إعدادات التواصل» أولًا.</div>}
      {!jobs.length && <div className="empty">لا دفعات بعد.</div>}
      {jobs.map(j => { const st = COMMS_JOB_ST[j.status] || COMMS_JOB_ST.draft; const canA = commsCanApprove(me, j); const mine = j.byId ? j.byId === me.id : j.by === me.name;
        return <div key={j.id} className="card" data-cmsjob={j.no} style={{ background: 'var(--ink)', marginBottom: 8 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{COMMS_KINDS[j.kind]}</b><span className="num" style={{ fontSize: 11, color: 'var(--dim)' }}>{j.no}</span><span className={'badge ' + st.c} data-cmsst>{st.ar}{j.rejected ? ' (مرفوضة)' : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>القالب: {tplName(j.tplId)} · تقدير: <span className="num">{(j.est || {}).n || 0}</span> مستلم / <span className="num">{(j.est || {}).parts || 0}</span> جزء · أنشأها {j.by}{j.approvedBy ? ' · اعتمدها ' + j.approvedBy : ''}</span>
            <span style={{ marginInlineStart: 'auto' }} />
            <button className="btn sm gh" data-cmsprev onClick={() => setPrev(j)}>معاينة الجمهور</button>
            {j.status === 'draft' && (mine || canApp) && <button className="btn sm pri" data-cmssubmit disabled={busy === j.id} onClick={() => move(j, 'pending', 'أرسل دفعة رسائل للاعتماد')}>إرسال للاعتماد</button>}
            {j.status === 'pending' && canA && <><button className="btn sm pri" data-cmsapprove disabled={busy === j.id} onClick={() => move(j, 'approved', 'اعتمد دفعة رسائل')}>اعتماد</button><button className="btn sm gh" data-cmsreject onClick={() => move(j, 'rejected', 'رفض دفعة رسائل')}>رفض</button></>}
            {j.status === 'pending' && !canA && <span style={{ fontSize: 11, color: 'var(--faint)' }} data-cmswait>{mine ? 'لا يعتمد المنشئ دفعته — ' : ''}بانتظار المالك أو المدير العام</span>}
            {j.status === 'approved' && commsCanApprove(me) && <button className="btn sm pri" data-cmssend disabled={busy === j.id} title={on ? '' : 'مسار الإرسال غير مفعّل'} onClick={() => send(j)}>{busy === j.id ? 'جارٍ…' : 'إرسال تجريبي (بلا إرسال فعلي)'}</button>}
            {['pending', 'approved'].includes(j.status) && commsCanApprove(me) && mktCanExport(org, me) && <button className="btn sm gh" data-cmsexp onClick={() => exp(j)}><Download size={12} />المستلمون Excel</button>}
            {['draft', 'pending', 'approved'].includes(j.status) && (mine || canA) && <button className="btn sm gh" onClick={() => move(j, 'cancelled', 'ألغى دفعة رسائل')}>إلغاء</button>}</div>
          {j.result && <div style={{ fontSize: 12, marginTop: 4 }} data-cmsres>{j.result.dry ? 'تجريبي (لم تُرسل رسائل): ' : 'النتيجة: '}<span className="num">{j.result.n || 0}</span> مستلم · نجح <span className="num">{j.result.ok || 0}</span> · فشل <span className="num">{j.result.fail || 0}</span>{j.sentAt ? ' · ' + dtLocal(j.sentAt) : ''}</div>}
        </div>; })}
    </div>
    {f && <Modal title="دفعة رسائل جديدة" icon={MessageSquare} onClose={() => setF(null)} wide foot={<><button className="btn gh" onClick={() => setF(null)}>إلغاء</button><button className="btn pri" data-cmssave onClick={save}>حفظ مسودة</button></>}>
      <div data-cmsform>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Field label="النوع"><select className="sel" aria-label="نوع الرسائل" value={f.kind} onChange={e => setF(x => ({ ...x, kind: e.target.value, filter: {} }))}>{Object.entries(COMMS_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="القالب (SMS)"><select className="sel" aria-label="قالب الرسالة" value={f.tplId} onChange={e => setF(x => ({ ...x, tplId: e.target.value }))}><option value="">—</option>{tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          {f.kind === 'loy' && <><Field label="رصيد نقاط لا يقل عن"><input className="inp n" inputMode="numeric" aria-label="أدنى رصيد" value={F.minPts == null ? '' : String(F.minPts)} onChange={e => setFl('minPts', num(e.target.value) === '' ? null : Number(num(e.target.value)))} /></Field>
            <Field label="نقاط تنتهي خلال (يومًا)"><input className="inp n" inputMode="numeric" aria-label="تنتهي خلال" value={F.expDays == null ? '' : String(F.expDays)} onChange={e => setFl('expDays', num(e.target.value) === '' ? null : Number(num(e.target.value)))} /></Field>
            <label className="row" style={{ gap: 4, alignSelf: 'end' }}><input type="checkbox" aria-label="ميلاد اليوم" checked={!!F.bday} onChange={e => setFl('bday', e.target.checked)} />عيد ميلاده اليوم</label></>}
          {f.kind === 'ar' && <><Field label="المستحق خلال (يومًا)"><input className="inp n" inputMode="numeric" aria-label="مستحق خلال" value={F.dueDays == null ? '3' : String(F.dueDays)} onChange={e => setFl('dueDays', num(e.target.value) === '' ? 0 : Number(num(e.target.value)))} /></Field>
            <label className="row" style={{ gap: 4, alignSelf: 'end' }}><input type="checkbox" aria-label="المتأخر فقط" checked={!!F.overdueOnly} onChange={e => setFl('overdueOnly', e.target.checked)} />المتأخر فقط</label></>}
        </div>
        <div className="note" style={{ marginTop: 6 }}>{f.kind === 'campaign' ? 'الحملة تصل للموافقين صراحةً على الرسائل فقط، بلا من طلب الإيقاف، وبحد ' + C.maxPerMonth + ' رسائل تسويقية للرقم شهريًا (الحملات وإشعارات الولاء معًا).' : f.kind === 'loy' ? 'إشعار الولاء يصل لأعضاء الولاء الموافقين فقط، ويُحسب مع الحملات ضمن حد ' + C.maxPerMonth + ' رسائل تسويقية للرقم شهريًا. انتهاء النقاط يتطلب ضبط مدة صلاحية النقاط في إعداد الولاء.' : 'تذكير الاستحقاق رسالة خدمية لعملاء الآجل (فواتير المبيعات وفواتير الكاشير المرحّلة) بمتبقٍّ أكبر من صفر — لا تحتاج موافقة تسويقية لكنها تحترم الإيقاف. المتغيرات {amount} و{due}.'}</div>
        {f.tplId && (() => { const t = C.templates.find(x => x.id === f.tplId); const one = t ? smsParts(t.body + (C.optOutText ? '\n' + C.optOutText : '')) : null; return one ? <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>القالب مع نص الإيقاف: <span className="num">{one.chars}</span> حرفًا تقريبًا قبل المتغيرات</div> : null; })()}
        <AudienceBox A={fAud} />
        {fAud && !fAud.capChecked && <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }} data-cmscapnote>الحد الشهري لكل رقم يُطبَّق عند الإرسال في الخادم من سجل الإرسال، فقد يقل العدد الفعلي.</div>}
      </div>
    </Modal>}
    {prev && <Modal title={'معاينة الجمهور — ' + prev.no} icon={MessageSquare} onClose={() => setPrev(null)} wide>
      <div className="note">محسوبة الآن من البيانات الحالية، والخادم يعيد حسابها عند الإرسال.</div>
      <AudienceBox A={commsAudience(org, ops, loy, prev, Date.now())} />
    </Modal>}
  </div>);
}
