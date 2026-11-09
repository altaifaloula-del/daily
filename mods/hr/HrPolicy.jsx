/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Compass, QrCode, UserCog, Check, RefreshCw, Building2 } from 'lucide-react';
import { Field, HR_WEEK_DAYS, Modal, Num, defaultHrPolicies, hrQrWindowCode, nowISO, qrSvg, uid } from '../../App.jsx';

export function HrPolicy({ org, me, commitOrg, say }) {
  const [view, setView] = useState('general');
  const policies = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) };
  const [pf, setPf] = useState(policies);
  const branches = org.branches || [];
  const depts = org.departments || [];
  const emps = org.employees || [];
  const [geoF, setGeoF] = useState({}); // {branchId: {lat, lng, radiusMeters}} — تعديلات محلية غير محفوظة بعد
  const [qrModalFor, setQrModalFor] = useState(null); // branch object
  const [, tick] = useState(0);

  useEffect(() => {
    if (!qrModalFor) return;
    const t = setInterval(() => tick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [qrModalFor]);

  const geoOf = (b) => geoF[b.id] || b.geofence || { lat: '', lng: '', radiusMeters: 100 };
  const setGeoField = (b, k, v) => setGeoF(g => ({ ...g, [b.id]: { ...geoOf(b), [k]: v } }));
  const useMyLocation = (b) => {
    if (!navigator.geolocation) return say('المتصفح لا يدعم تحديد الموقع', 'no');
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeoF(g => ({ ...g, [b.id]: { ...geoOf(b), lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) } })),
      () => say('تعذّر الحصول على الموقع — تحقّق من إذن الموقع بالمتصفح', 'no')
    );
  };
  const saveGeo = async (b) => {
    const g = geoOf(b);
    if (g.lat === '' || g.lng === '' || !g.radiusMeters) return say('أدخل خط العرض وخط الطول ونصف قطر السماح', 'no');
    await commitOrg(d => ({
      ...d, branches: (d.branches || []).map(x => x.id === b.id ? { ...x, geofence: { lat: +g.lat, lng: +g.lng, radiusMeters: +g.radiusMeters, updatedAt: nowISO() } } : x)
    }), { actionType: 'update', targetType: 'branch', targetId: b.id, branchName: b.name, title: 'ضبط جيوفنس الحضور للفرع', details: b.name + ' — نصف قطر ' + g.radiusMeters + 'م' });
    say('حُفظ جيوفنس الفرع ✓');
  };

  const savePolicies = async () => {
    const w = pf.scoreWeights || {};
    const sum = (Number(w.attendance) || 0) + (Number(w.quality) || 0) + (Number(w.tasks) || 0) + (Number(w.discipline) || 0);
    if (pf.scoreWeightsEnabled && sum !== 100) return say('مجموع أوزان الدرجة النهائية يجب أن يساوي 100 (المجموع الحالي ' + sum + ')', 'no');
    await commitOrg(d => ({ ...d, hrPolicies: { ...pf } }),
      { actionType: 'update', targetType: 'settings', targetId: 'hrPolicies', title: 'حفظ سياسات الدوام العامة', details: pf.workHoursPerDay + ' ساعات/يوم · سماحية تأخير ' + pf.lateToleranceMinutes + 'د' });
    say('حُفظت السياسات ✓');
  };

  const rotateToken = async (b) => {
    if (!window.confirm('توليد رمز حضور جديد لفرع «' + b.name + '»؟ الرمز القديم يتوقف فورًا عن العمل.')) return;
    const secret = uid('qr') + Math.random().toString(36).slice(2, 10);
    await commitOrg(d => ({
      ...d, branches: (d.branches || []).map(x => x.id === b.id ? { ...x, qrToken: { secret, rotateMinutes: (x.qrToken && x.qrToken.rotateMinutes) || 3, rotatedAt: nowISO() } } : x)
    }), { actionType: 'update', targetType: 'branch', targetId: b.id, branchName: b.name, title: 'توليد رمز حضور جديد للفرع', details: b.name });
    say('تولّد رمز جديد للفرع ✓');
  };
  const setRotateMinutes = async (b, mins) => {
    await commitOrg(d => ({
      ...d, branches: (d.branches || []).map(x => x.id === b.id ? { ...x, qrToken: { ...(x.qrToken || {}), rotateMinutes: mins } } : x)
    }), { actionType: 'update', targetType: 'branch', targetId: b.id, branchName: b.name, title: 'ضبط مدة تدوير رمز الحضور', details: b.name + ' — كل ' + mins + ' د' });
  };

  const setDeptHead = async (dId, headEmployeeId) => {
    await commitOrg(d => ({ ...d, departments: (d.departments || []).map(x => x.id === dId ? { ...x, headEmployeeId: headEmployeeId || '' } : x) }),
      { actionType: 'update', targetType: 'user_account', targetId: dId, title: 'تعيين رئيس قسم', details: (depts.find(x => x.id === dId) || {}).name || '' });
    say('حُفظ ✓');
  };
  const setEmpManager = async (eId, managerId) => {
    if (managerId === eId) return say('لا يمكن أن يكون الموظف مديرًا لنفسه', 'no');
    await commitOrg(d => ({ ...d, employees: (d.employees || []).map(x => x.id === eId ? { ...x, managerId: managerId || '' } : x) }),
      { actionType: 'update', targetType: 'user_account', targetId: eId, title: 'تعيين المدير المباشر لموظف', details: (emps.find(x => x.id === eId) || {}).name || '' });
    say('حُفظ ✓');
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card" style={{ padding: '8px 12px' }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={'btn sm' + (view === 'general' ? ' pri' : ' gh')} onClick={() => setView('general')}><ShieldCheck size={13} />سياسات الدوام</button>
          <button className={'btn sm' + (view === 'geo' ? ' pri' : ' gh')} onClick={() => setView('geo')}><Compass size={13} />جيوفنس الفروع</button>
          <button className={'btn sm' + (view === 'qr' ? ' pri' : ' gh')} onClick={() => setView('qr')}><QrCode size={13} />رمز حضور الفرع</button>
          <button className={'btn sm' + (view === 'mgr' ? ' pri' : ' gh')} onClick={() => setView('mgr')}><UserCog size={13} />المدير المباشر</button>
        </div>
      </div>

      {view === 'general' && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><ShieldCheck size={15} color="var(--brass)" />سياسات الدوام العامة</div>
          <div className="grid g2">
            <Num label="ساعات الدوام القياسية يوميًا" value={pf.workHoursPerDay} onChange={v => setPf(f => ({ ...f, workHoursPerDay: v }))} />
            <Num label="سماحية التأخير (دقائق) قبل احتساب تأخير" value={pf.lateToleranceMinutes} onChange={v => setPf(f => ({ ...f, lateToleranceMinutes: v }))} />
            <Num label="تنبيه بالإقرارات غير الموقَّعة بعد (أيام) من إصدارها" value={pf.signReminderDays} onChange={v => setPf(f => ({ ...f, signReminderDays: v }))} hint="م10 — إقرارات استلام الراتب وإشعارات المكافآت/الجزاءات التي لم يوقّعها الموظف من كشك الفرع" />
          </div>
          <Field label="أيام الإجازة الأسبوعية الافتراضية">
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {HR_WEEK_DAYS.map(d => (
                <label key={d.v} className="row" style={{ gap: 5, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={(pf.weeklyOffDays || []).includes(d.v)}
                    onChange={e => setPf(f => ({ ...f, weeklyOffDays: e.target.checked ? [...(f.weeklyOffDays || []), d.v] : (f.weeklyOffDays || []).filter(x => x !== d.v) }))} />
                  {d.ar}
                </label>
              ))}
            </div>
          </Field>
          <div className="card" style={{ marginTop: 10, background: 'rgba(200,162,74,.05)' }}>
            <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={pf.overtimeEnabled} onChange={e => setPf(f => ({ ...f, overtimeEnabled: e.target.checked }))} />
              تفعيل احتساب العمل الإضافي
            </label>
            {pf.overtimeEnabled && <div style={{ marginTop: 8 }}>
              <Num label="الحد الأقصى لساعات الإضافي شهريًا" value={pf.overtimeMaxHoursPerMonth} onChange={v => setPf(f => ({ ...f, overtimeMaxHoursPerMonth: v }))} />
            </div>}
          </div>
          <div className="card" style={{ marginTop: 10, background: 'rgba(200,162,74,.05)' }}>
            <label className="row" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={pf.scoreWeightsEnabled} onChange={e => setPf(f => ({ ...f, scoreWeightsEnabled: e.target.checked }))} />
              تفعيل أوزان الدرجة النهائية المقترحة (لمراحل التقييم والمكافآت القادمة — لا تُستخدم في أي احتساب حاليًا)
            </label>
            <div className="note" style={{ margin: '6px 0 10px' }}>هذه الأوزان تمهيدية فقط لمراحل م6-م8 (دفتر النقاط، التقييم، المكافآت)، وتبقى معطّلة افتراضيًا حتى تراجعها وتفعّلها بنفسك. يجب أن يساوي مجموعها 100.</div>
            <div className="grid g2">
              <Num label="الحضور والانضباط" value={pf.scoreWeights?.attendance} onChange={v => setPf(f => ({ ...f, scoreWeights: { ...f.scoreWeights, attendance: v } }))} />
              <Num label="جودة الأداء" value={pf.scoreWeights?.quality} onChange={v => setPf(f => ({ ...f, scoreWeights: { ...f.scoreWeights, quality: v } }))} />
              <Num label="إنجاز المهام" value={pf.scoreWeights?.tasks} onChange={v => setPf(f => ({ ...f, scoreWeights: { ...f.scoreWeights, tasks: v } }))} />
              <Num label="الالتزام والسلوك" value={pf.scoreWeights?.discipline} onChange={v => setPf(f => ({ ...f, scoreWeights: { ...f.scoreWeights, discipline: v } }))} />
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn pri" onClick={savePolicies}><Check size={14} />حفظ السياسات</button>
          </div>
        </div>
      )}

      {view === 'geo' && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 6 }}><Compass size={15} color="var(--brass)" />جيوفنس الحضور لكل فرع</div>
          <div className="note" style={{ marginBottom: 10 }}>يحدّد هذا نطاق الموقع الجغرافي المسموح به لتسجيل الحضور من الفرع في مرحلة م3 القادمة. اضبط إحداثيات مركز كل فرع ونصف قطر السماح بالأمتار.</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الفرع</th><th>خط العرض</th><th>خط الطول</th><th>نصف القطر (م)</th><th /></tr></thead>
              <tbody>
                {branches.map(b => {
                  const g = geoOf(b);
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{b.name}{b.geofence && <div style={{ fontSize: 9.5, color: 'var(--faint)', fontWeight: 400 }}>محفوظ مسبقًا</div>}</td>
                      <td><input className="inp n" style={{ width: 110 }} value={g.lat} onChange={e => setGeoField(b, 'lat', e.target.value)} placeholder="21.543" /></td>
                      <td><input className="inp n" style={{ width: 110 }} value={g.lng} onChange={e => setGeoField(b, 'lng', e.target.value)} placeholder="39.172" /></td>
                      <td><input className="inp n" style={{ width: 90 }} value={g.radiusMeters} onChange={e => setGeoField(b, 'radiusMeters', e.target.value)} /></td>
                      <td>
                        <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                          <button className="btn sm gh" onClick={() => useMyLocation(b)}><Compass size={13} />موقعي الحالي</button>
                          <button className="btn sm pri" onClick={() => saveGeo(b)}><Check size={13} />حفظ</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {branches.length === 0 && <tr><td colSpan={5}><div className="empty">لا توجد فروع بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'qr' && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 6 }}><QrCode size={15} color="var(--brass)" />رمز حضور الفرع (QR مدوَّر)</div>
          <div className="note" style={{ marginBottom: 10 }}>كل فرع يحصل على سرّ خاص به يُولَّد منه رمز QR يتغيّر تلقائيًا كل عدة دقائق. هذه الشاشة تُجهِّز السرّ وتعرضه للمعاينة فقط — التحقّق الفعلي عند مسح الرمز لتسجيل حضور موظف يُبنى في مرحلة م3 القادمة.</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الفرع</th><th>الحالة</th><th>يتجدّد كل</th><th /></tr></thead>
              <tbody>
                {branches.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{b.name}</td>
                    <td>{b.qrToken?.secret ? <span className="badge b-mint">مُفعَّل</span> : <span className="badge b-dim">لم يُولَّد بعد</span>}</td>
                    <td>
                      <select className="inp sel" style={{ width: 100 }} value={(b.qrToken && b.qrToken.rotateMinutes) || 3} onChange={e => setRotateMinutes(b, +e.target.value)}>
                        {[1, 2, 3, 5, 10].map(m => <option key={m} value={m}>{m} دقائق</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end' }}>
                        {b.qrToken?.secret && <button className="btn sm gh" onClick={() => setQrModalFor(b)}><QrCode size={13} />عرض الرمز</button>}
                        <button className="btn sm gh" onClick={() => rotateToken(b)}><RefreshCw size={13} />{b.qrToken?.secret ? 'تجديد الرمز' : 'توليد رمز'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {branches.length === 0 && <tr><td colSpan={4}><div className="empty">لا توجد فروع بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'mgr' && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><Building2 size={15} color="var(--brass)" />رئيس كل قسم</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>القسم</th><th>رئيس القسم</th></tr></thead>
                <tbody>
                  {depts.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{d.name}</td>
                      <td>
                        <select className="inp sel" value={d.headEmployeeId || ''} onChange={e => setDeptHead(d.id, e.target.value)}>
                          <option value="">— بلا رئيس قسم —</option>
                          {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {depts.length === 0 && <tr><td colSpan={2}><div className="empty">لا توجد أقسام بعد — أضِفها من «البيانات الرئيسية».</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-t" style={{ marginBottom: 10 }}><UserCog size={15} color="var(--brass)" />المدير المباشر لكل موظف</div>
            <div className="tw">
              <table className="tb">
                <thead><tr><th>الموظف</th><th>يرفع تقاريره إلى</th></tr></thead>
                <tbody>
                  {emps.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}</td>
                      <td>
                        <select className="inp sel" value={e.managerId || ''} onChange={ev => setEmpManager(e.id, ev.target.value)}>
                          <option value="">— بلا مدير مباشر —</option>
                          {emps.filter(x => x.id !== e.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {emps.length === 0 && <tr><td colSpan={2}><div className="empty">لا يوجد موظفون بعد.</div></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="note" style={{ marginTop: 8 }}>تسلسل الاعتماد هذا اختياري ولا يُستخدم في أي منطق حاليًا — يُستثمَر لاحقًا في مراحل التقييم واعتماد المكافآت/الجزاءات (م7-م8).</div>
          </div>
        </div>
      )}

      {qrModalFor && (() => {
        const b = branches.find(x => x.id === qrModalFor.id) || qrModalFor;
        const rotateMinutes = (b.qrToken && b.qrToken.rotateMinutes) || 3;
        const code = b.qrToken?.secret ? hrQrWindowCode(b.qrToken.secret, rotateMinutes, b.id) : '';
        const payload = 'HRQR:' + b.id + ':' + code;
        const msLeft = ((rotateMinutes * 60000) - (Date.now() % (rotateMinutes * 60000)));
        const secLeft = Math.max(0, Math.round(msLeft / 1000));
        return (
          <Modal title={'رمز حضور — ' + b.name} icon={QrCode} onClose={() => setQrModalFor(null)}
            foot={<button className="btn gh" onClick={() => setQrModalFor(null)}>إغلاق</button>}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#fff', padding: 10, borderRadius: 12, border: '1px solid var(--frame-o)' }}
                dangerouslySetInnerHTML={{ __html: qrSvg(payload, { ecl: 1, px: 220 }) }} />
              <div className="note" style={{ marginTop: 10 }}>يتجدّد الرمز تلقائيًا خلال {secLeft} ثانية — معاينة فقط، غير مُستخدَم حاليًا: تسجيل الحضور المعتمد يتم من شاشة «الحضور الموثَّق» على جهاز الفرع برقم PIN (بقرار الإدارة، بلا مسح من جوال الموظف).</div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
