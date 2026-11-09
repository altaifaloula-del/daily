/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, ShieldCheck, Clock, Camera, Lock, Trash2, QrCode, Check } from 'lucide-react';
import { Field, Modal, ROLES, arDT, escH, haversineMeters, nowISO, openDocWin, qrSvg, sha, today, uid } from '../../App.jsx';

export function Attendance({ org, ops, me, myBranches, commit, say }) {
  const isCashier = me.role === 'cashier';
  const events = ops.attendanceEvents || [];
  const pinRecOf = (empId) => ((ops.hrPins || []).find(p => p.employeeId === empId)) || null;
  const pinHashOf = (empId) => (pinRecOf(empId) || {}).pinHash || '';
  const badgeHashOf = (empId) => (pinRecOf(empId) || {}).badgeHash || '';
  const branches = myBranches || [];

  const [view, setView] = useState('kiosk');
  const [branchId, setBranchId] = useState((branches[0] || {}).id || '');
  useEffect(() => {
    if (!branches.find(b => b.id === branchId)) setBranchId((branches[0] || {}).id || '');
  }, [branches, branchId]);
  const branch = branches.find(b => b.id === branchId) || null;

  const emps = (org.employees || []).filter(e => e.isActive !== false && branch && e.branchId === branch.id);

  const lastEventToday = (empId) => {
    const d = today();
    return events
      .filter(ev => ev.employeeId === empId && (ev.at || '').slice(0, 10) === d)
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0] || null;
  };
  const nextType = (empId) => (lastEventToday(empId)?.type === 'in' ? 'out' : 'in');

  // --- كشك تسجيل الحضور ---
  const [pinFor, setPinFor] = useState(null);
  const [pinVal, setPinVal] = useState('');
  const [busy, setBusy] = useState(false);

  // v24.1: تسجيل الحدث نفسه مشترك بين مسار PIN ومسار بطاقة QR
  const recordEvent = async (emp, via) => {
    const type = nextType(emp.id);
    const rec = {
      id: uid('att'), branchId: branch.id, branchName: branch.name, employeeId: emp.id, employeeName: emp.name,
      type, at: nowISO(), via: via || 'pin', recordedBy: me.id, recordedByName: me.name,
      lat: null, lng: null, distanceMeters: null, withinGeofence: null
    };
    const finish = async (pos) => {
      if (pos) {
        rec.lat = +pos.coords.latitude.toFixed(6);
        rec.lng = +pos.coords.longitude.toFixed(6);
        if (branch.geofence && branch.geofence.lat !== '' && branch.geofence.lat != null) {
          rec.distanceMeters = haversineMeters(rec.lat, rec.lng, branch.geofence.lat, branch.geofence.lng);
          rec.withinGeofence = rec.distanceMeters <= (branch.geofence.radiusMeters || 100);
        }
      }
      const ok = await commit(d => ({ ...d, attendanceEvents: [rec, ...(d.attendanceEvents || [])] }), {
        actionType: 'update', targetType: 'attendance', targetId: rec.id, branchName: branch.name,
        title: (type === 'in' ? 'تسجيل حضور موظف' : 'تسجيل انصراف موظف') + (via === 'badge' ? ' (بطاقة QR)' : ''),
        details: emp.name + (rec.withinGeofence === false ? ' — خارج نطاق الفرع (' + rec.distanceMeters + 'م)' : '')
      });
      setBusy(false); setPinFor(null); setPinVal('');
      if (ok) say((type === 'in' ? 'سُجِّل الحضور' : 'سُجِّل الانصراف') + ' — ' + emp.name + ' ✓' +
        (rec.withinGeofence === false ? ' (تنبيه: خارج نطاق الفرع)' : ''));
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => finish(pos), () => finish(null), { timeout: 8000 });
    } else finish(null);
  };
  const doCheck = async () => {
    if (!pinFor || !branch || busy) return;
    if (!/^\d{4,6}$/.test(pinVal)) return say('أدخل رقم PIN المكوّن من 4 إلى 6 أرقام', 'no');
    setBusy(true);
    const hash = await sha(pinVal);
    if (!pinHashOf(pinFor.id) || pinHashOf(pinFor.id) !== hash) {
      setBusy(false); setPinVal('');
      return say('رقم PIN غير صحيح', 'no');
    }
    await recordEvent(pinFor, 'pin');
  };

  // --- v24.1: بطاقة QR الشخصية للموظف — يمسحها جهاز الفرع (كاميرا أو ماسح USB) بدل كتابة PIN ---
  const [scanBuf, setScanBuf] = useState('');
  const handleBadge = async (raw) => {
    if (!branch || busy) return;
    const t = String(raw || '').trim();
    setScanBuf('');
    const m = t.match(/^ATT:([^:]+):(.+)$/);
    if (!m) return say('رمز غير معروف — ليست بطاقة حضور صالحة', 'no');
    const emp = emps.find(e => e.id === m[1]);
    if (!emp) return say('البطاقة لموظف ليس ضمن هذا الفرع', 'no');
    setBusy(true);
    const h = await sha(m[2]);
    if (!badgeHashOf(emp.id) || badgeHashOf(emp.id) !== h) { setBusy(false); return say('بطاقة ملغاة أو غير صالحة — أعد إصدارها من مدير الفرع', 'no'); }
    await recordEvent(emp, 'badge');
  };
  const [cam, setCam] = useState(false);
  const videoRef = useRef(null); const streamRef = useRef(null); const rafRef = useRef(0);
  const stopCam = () => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current);
    try { ((streamRef.current && streamRef.current.getTracks()) || []).forEach(t => t.stop()); } catch { }
    streamRef.current = null; setCam(false);
  };
  const loadJsQR = () => new Promise((res, rej) => {
    if (window.jsQR) return res(window.jsQR);
    const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    sc.onload = () => res(window.jsQR); sc.onerror = () => rej(new Error('jsqr')); document.head.appendChild(sc);
  });
  const startCam = async () => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return say('المتصفح لا يدعم الكاميرا — استخدم ماسح USB أو رقم PIN', 'no');
    setCam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      const v = videoRef.current; if (!v) { stopCam(); return; }
      v.srcObject = stream; await v.play();
      let detector = null;
      if ('BarcodeDetector' in window) { try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; } }
      let jsQR = null;
      if (!detector) { try { jsQR = await loadJsQR(); } catch { stopCam(); return say('تعذّر تحميل قارئ QR — تحقّق من الاتصال أو استخدم ماسح USB / رقم PIN', 'no'); } }
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let lastTry = 0;
      const tick = async () => {
        if (!streamRef.current) return;
        const now = Date.now();
        if (now - lastTry > 250 && v.readyState >= 2) {
          lastTry = now; let text = '';
          try {
            if (detector) { const codes = await detector.detect(v); text = ((codes || [])[0] || {}).rawValue || ''; }
            else { canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0); const img = ctx.getImageData(0, 0, canvas.width, canvas.height); const r = jsQR(img.data, img.width, img.height); text = r ? r.data : ''; }
          } catch { }
          if (text) { stopCam(); handleBadge(text); return; }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) { stopCam(); say('تعذّر فتح الكاميرا — اسمح بالوصول للكاميرا أو استخدم ماسح USB / رقم PIN', 'no'); }
  };
  useEffect(() => () => stopCam(), []); // eslint-disable-line

  // --- ضبط أرقام PIN للموظفين ---
  const [pinSetFor, setPinSetFor] = useState(null);
  const [np1, setNp1] = useState('');
  const [np2, setNp2] = useState('');
  const savePin = async () => {
    if (!pinSetFor) return;
    if (!/^\d{4,6}$/.test(np1)) return say('رقم PIN يجب أن يكون 4 إلى 6 أرقام', 'no');
    if (np1 !== np2) return say('رقما PIN غير متطابقين', 'no');
    const hash = await sha(np1);
    await commit(d => { const prev = (d.hrPins || []).find(p => p.employeeId === pinSetFor.id) || {}; return { ...d, hrPins: [...(d.hrPins || []).filter(p => p.employeeId !== pinSetFor.id), { id: prev.id || uid('pin'), branchId: pinSetFor.branchId, employeeId: pinSetFor.id, badgeHash: prev.badgeHash || '', pinHash: hash, updatedAt: nowISO() }] }; },
      { actionType: 'update', targetType: 'user_account', targetId: pinSetFor.id, title: 'ضبط رقم PIN للحضور', details: pinSetFor.name });
    say('حُفظ رقم PIN ✓');
    setPinSetFor(null); setNp1(''); setNp2('');
  };
  const clearPin = async (e) => {
    if (!window.confirm('إلغاء رقم PIN الحالي لـ«' + e.name + '»؟ لن يستطيع تسجيل حضوره حتى يُضبط رقم جديد.')) return;
    await commit(d => ({ ...d, hrPins: (d.hrPins || []).map(p => p.employeeId === e.id ? { ...p, pinHash: '', updatedAt: nowISO() } : p).filter(p => p.pinHash || p.badgeHash) }),
      { actionType: 'update', targetType: 'user_account', targetId: e.id, title: 'إلغاء رقم PIN للحضور', details: e.name });
    say('أُلغي رقم PIN ✓');
  };
  // v24.1: إصدار/تجديد بطاقة QR — السرّ يُطبع مرة واحدة على البطاقة ولا يُخزَّن إلا مُجزَّأً في مستند الفرع؛ التجديد يُلغي البطاقة السابقة
  const issueBadge = async (e) => {
    if (badgeHashOf(e.id) && !window.confirm('إصدار بطاقة جديدة لـ«' + e.name + '»؟ البطاقة الحالية ستتوقف فورًا عن العمل.')) return;
    const w = openDocWin('width=520,height=720');   // تُفتح قبل أي انتظار كي لا يحجبها المتصفح
    // v27.13: النافذة لا تبقى فارغة أبدًا — رسالة فورية، ثم البطاقة أو سبب الفشل صريحًا
    const showMsg = (msg, err) => { try { if (w) { w.document.open(); w.document.write('<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقة حضور</title></head><body style="font-family:Tahoma,sans-serif;padding:28px;text-align:center;font-size:14px;color:' + (err ? '#b00' : '#333') + '">' + escH(msg) + '</body></html>'); w.document.close(); } } catch (_) { } };
    if (w) showMsg('جارٍ إصدار البطاقة…');
    try {
      const secret = uid('b').slice(2) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const hash = await sha(secret);
      const ok = await commit(d => { const prev = (d.hrPins || []).find(p => p.employeeId === e.id) || {}; return { ...d, hrPins: [...(d.hrPins || []).filter(p => p.employeeId !== e.id), { id: prev.id || uid('pin'), branchId: e.branchId, employeeId: e.id, pinHash: prev.pinHash || '', badgeHash: hash, badgeIssuedAt: nowISO(), updatedAt: nowISO() }] }; },
        { actionType: 'update', targetType: 'user_account', targetId: e.id, branchName: branch ? branch.name : '', title: 'إصدار بطاقة QR للحضور', details: e.name });
      if (!ok) { showMsg('تعذّر حفظ البطاقة — تحقّق من الصلاحية أو الاتصال ثم أعِد المحاولة.', true); say('تعذّر إصدار البطاقة — لم تُحفظ', 'no'); return; }
      const payload = 'ATT:' + e.id + ':' + secret;
      const co = (org.company || {}).name || '';
      const svg = qrSvg(payload, { ecl: 2, px: 240 });
      const html = '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقة حضور — ' + escH(e.name) + '</title>' +
        '<style>body{font-family:Tahoma,sans-serif;margin:0;padding:24px;display:flex;justify-content:center}.card{width:320px;border:2px solid #8C6F2C;border-radius:14px;padding:18px;text-align:center}' +
        '.co{font-size:12px;color:#5a4a1e;font-weight:700}.nm{font-size:20px;font-weight:800;margin:8px 0 2px}.br{font-size:12px;color:#666;margin-bottom:10px}.code{font-family:monospace;font-size:9px;color:#888;word-break:break-all;margin-top:8px;direction:ltr}.hint{font-size:10.5px;color:#666;margin-top:8px}@media print{body{padding:0}}</style></head><body><div class="card">' +
        '<div class="co">' + escH(co) + '</div><div class="nm">' + escH(e.name) + '</div><div class="br">' + escH(branch ? branch.name : '') + ' · بطاقة حضور</div>' +
        (svg || '<div style="color:#b00;font-size:12px">تعذّر توليد رمز QR — استخدم الرمز النصّي أدناه.</div>') + '<div class="code">' + escH(payload) + '</div><div class="hint">امسح البطاقة على جهاز الفرع لتسجيل الحضور/الانصراف. البطاقة شخصية — لا تُعِرها لأحد.</div></div>' +
        '<script>setTimeout(function(){window.print()},400)<\/script></body></html>';
      if (w) { w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (_) { } }, 400); } else say('اسمح بالنوافذ المنبثقة لطباعة البطاقة', 'no');
      say('صدرت بطاقة QR لـ' + e.name + ' ✓');
    } catch (err) {
      showMsg('تعذّر إصدار البطاقة: ' + (err && err.message ? err.message : 'خطأ غير متوقع'), true);
      say('تعذّر إصدار البطاقة: ' + (err && err.message ? err.message : 'خطأ غير متوقع'), 'no');
    }
  };

  // --- v26.1: حذف حدث حضور خاطئ (مدير الفرع/المركز) — بسبب موثَّق في سجل التدقيق ---
  const canFixLog = me.role === 'branch_manager' || (ROLES[me.role] || {}).scope === 'all';
  const delEvent = async (ev) => {
    const reason = window.prompt('سبب حذف حدث «' + (ev.type === 'in' ? 'حضور' : 'انصراف') + '» لـ' + ev.employeeName + ' (' + arDT(ev.at) + ')؟');
    if (reason == null) return;
    if (!String(reason).trim()) return say('السبب إلزامي لحذف حدث حضور', 'no');
    const ok = await commit(d => ({ ...d, attendanceEvents: (d.attendanceEvents || []).filter(x => x.id !== ev.id) }),
      { actionType: 'delete', targetType: 'attendance', targetId: ev.id, branchName: ev.branchName, title: 'حذف حدث حضور', details: ev.employeeName + ' · ' + (ev.type === 'in' ? 'حضور' : 'انصراف') + ' · ' + arDT(ev.at) + ' — السبب: ' + String(reason).trim() });
    if (ok) say('حُذف الحدث وسُجِّل السبب في التدقيق');
  };
  // --- سجل الحضور ---
  const [logBranch, setLogBranch] = useState('');
  const [logEmp, setLogEmp] = useState('');
  const [logFrom, setLogFrom] = useState(today());
  const [logTo, setLogTo] = useState(today());
  const branchIds = branches.map(b => b.id);
  const logRows = events
    .filter(ev => branchIds.includes(ev.branchId))
    .filter(ev => !logBranch || ev.branchId === logBranch)
    .filter(ev => !logEmp || ev.employeeId === logEmp)
    .filter(ev => (!logFrom || (ev.at || '') >= logFrom) && (!logTo || (ev.at || '').slice(0, 10) <= logTo))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  if (!branch && branches.length === 0) {
    return <div className="card"><div className="empty">لا يوجد فرع مُسند لحسابك — راجع مسؤول النظام.</div></div>;
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {!isCashier && (
        <div className="card" style={{ padding: '8px 12px' }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <button className={'btn sm' + (view === 'kiosk' ? ' pri' : ' gh')} onClick={() => setView('kiosk')}><Fingerprint size={13} />تسجيل حضور/انصراف</button>
              <button className={'btn sm' + (view === 'pin' ? ' pri' : ' gh')} onClick={() => setView('pin')}><ShieldCheck size={13} />أرقام PIN</button>
              <button className={'btn sm' + (view === 'log' ? ' pri' : ' gh')} onClick={() => setView('log')}><Clock size={13} />سجل الحضور</button>
            </div>
            {branches.length > 1 && (
              <select className="inp sel" style={{ width: 180 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {view === 'kiosk' && branch && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 4 }}><Fingerprint size={15} color="var(--brass)" />تسجيل الحضور — {branch.name}</div>
          <div className="note" style={{ marginBottom: 10 }}>امسح بطاقة QR الخاصة بك (بالكاميرا أو بماسح USB)، أو اختر اسمك ثم أدخل رقم PIN — يُحدَّد الحضور أو الانصراف تلقائيًا.</div>
          <div className="card" style={{ marginBottom: 12, padding: 12, border: '1px solid var(--frame-o)' }}>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="مسح بطاقة QR (ماسح USB أو لصق الرمز)" style={{ flex: 1, minWidth: 220 }}>
                <input className="inp" autoFocus value={scanBuf} onChange={e => setScanBuf(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleBadge(scanBuf); }} placeholder="وجّه الماسح للبطاقة…" />
              </Field>
              <button className="btn pri" disabled={busy} onClick={startCam}><Camera size={14} />فتح الكاميرا</button>
            </div>
          </div>
          <div className="grid g3">
            {emps.map(e => {
              const nt = nextType(e.id);
              return (
                <button key={e.id} className="card" style={{ padding: 12, textAlign: 'center', cursor: 'pointer', border: '1px solid var(--frame-o)' }}
                  onClick={() => { setPinFor(e); setPinVal(''); }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{e.name}</div>
                  <div style={{ marginTop: 6 }}>
                    <span className={'badge ' + (nt === 'in' ? 'b-mint' : 'b-amber')}>{nt === 'in' ? 'تسجيل حضور' : 'تسجيل انصراف'}</span>
                  </div>
                  {!pinHashOf(e.id) && !badgeHashOf(e.id) && <div style={{ fontSize: 9.5, color: 'var(--rose)', marginTop: 4 }}>لا يوجد رقم PIN ولا بطاقة — راجع مدير الفرع</div>}
                </button>
              );
            })}
            {emps.length === 0 && <div className="empty">لا يوجد موظفون في هذا الفرع بعد — أضِفهم من «البيانات الرئيسية».</div>}
          </div>
        </div>
      )}

      {view === 'pin' && !isCashier && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 6 }}><ShieldCheck size={15} color="var(--brass)" />أرقام PIN للحضور</div>
          <div className="note" style={{ marginBottom: 10 }}>رقم PIN من 4 إلى 6 أرقام، أو بطاقة QR شخصية تُطبع ويمسحها جهاز الفرع — كلاهما لتسجيل الحضور من جهاز الفرع فقط، لا لتسجيل الدخول للنظام. إعادة إصدار البطاقة تُلغي السابقة فورًا.</div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الموظف</th><th>PIN</th><th>بطاقة QR</th><th /></tr></thead>
              <tbody>
                {emps.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{e.name}</td>
                    <td>{pinHashOf(e.id) ? <span className="badge b-mint">مُفعَّل</span> : <span className="badge b-dim">غير مُفعَّل</span>}</td>
                    <td>{badgeHashOf(e.id) ? <span className="badge b-mint">صادرة</span> : <span className="badge b-dim">لا توجد</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button className="btn sm gh" onClick={() => { setPinSetFor(e); setNp1(''); setNp2(''); }}><Lock size={13} />{pinHashOf(e.id) ? 'إعادة ضبط' : 'ضبط رقم PIN'}</button>
                        {pinHashOf(e.id) && <button className="btn sm gh" onClick={() => clearPin(e)}><Trash2 size={13} />إلغاء</button>}
                        <button className="btn sm gh" onClick={() => issueBadge(e)}><QrCode size={13} />{badgeHashOf(e.id) ? 'إعادة إصدار البطاقة' : 'بطاقة QR'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {emps.length === 0 && <tr><td colSpan={4}><div className="empty">لا يوجد موظفون في هذا الفرع بعد.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'log' && !isCashier && (
        <div className="card">
          <div className="card-t" style={{ marginBottom: 10 }}><Clock size={15} color="var(--brass)" />سجل الحضور</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {branches.length > 1 && (
              <select className="inp sel" style={{ width: 160 }} value={logBranch} onChange={e => setLogBranch(e.target.value)}>
                <option value="">كل الفروع</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <select className="inp sel" style={{ width: 160 }} value={logEmp} onChange={e => setLogEmp(e.target.value)}>
              <option value="">كل الموظفين</option>
              {(org.employees || []).filter(e => branchIds.includes(e.branchId)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input className="inp" type="date" style={{ width: 140 }} value={logFrom} onChange={e => setLogFrom(e.target.value)} />
            <input className="inp" type="date" style={{ width: 140 }} value={logTo} onChange={e => setLogTo(e.target.value)} />
          </div>
          <div className="tw">
            <table className="tb">
              <thead><tr><th>الوقت</th><th>الموظف</th><th>الفرع</th><th>النوع</th><th>الطريقة</th><th>الموقع</th>{canFixLog && <th />}</tr></thead>
              <tbody>
                {logRows.map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontSize: 12 }}>{arDT(ev.at)}</td>
                    <td style={{ fontWeight: 600, fontSize: 12.5 }}>{ev.employeeName}</td>
                    <td style={{ fontSize: 12 }}>{ev.branchName}</td>
                    <td><span className={'badge ' + (ev.type === 'in' ? 'b-mint' : 'b-amber')}>{ev.type === 'in' ? 'حضور' : 'انصراف'}</span></td>
                    <td><span className="badge b-dim">{ev.via === 'badge' ? 'بطاقة QR' : 'PIN'}</span></td>
                    <td>
                      {ev.withinGeofence === true && <span className="badge b-mint">ضمن النطاق</span>}
                      {ev.withinGeofence === false && <span className="badge b-rose">خارج النطاق ({ev.distanceMeters}م)</span>}
                      {ev.withinGeofence == null && <span className="badge b-dim">—</span>}
                    </td>
                    {canFixLog && <td><button className="btn sm gh" title="حذف حدث خاطئ" onClick={() => delEvent(ev)}><Trash2 size={13} /></button></td>}
                  </tr>
                ))}
                {logRows.length === 0 && <tr><td colSpan={canFixLog ? 7 : 6}><div className="empty">لا توجد سجلات حضور ضمن هذه الفلاتر.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cam && (
        <Modal title="مسح بطاقة QR" icon={Camera} onClose={stopCam} foot={<button className="btn gh" onClick={stopCam}>إغلاق</button>}>
          <div style={{ textAlign: 'center' }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', maxWidth: 380, borderRadius: 12, background: '#000' }} />
            <div className="note" style={{ marginTop: 8 }}>وجّه الكاميرا نحو بطاقة الموظف — يُسجَّل الحضور فور قراءتها.</div>
          </div>
        </Modal>
      )}
      {pinFor && (
        <Modal title={'تسجيل ' + (nextType(pinFor.id) === 'in' ? 'حضور' : 'انصراف') + ' — ' + pinFor.name} icon={Fingerprint} onClose={() => { setPinFor(null); setPinVal(''); }}
          foot={<>
            <button className="btn gh" onClick={() => { setPinFor(null); setPinVal(''); }}>إلغاء</button>
            <button className="btn pri" disabled={busy} onClick={doCheck}><Check size={14} />{busy ? 'جارٍ...' : 'تأكيد'}</button>
          </>}>
          <Field label="رقم PIN">
            <input className="inp" type="password" inputMode="numeric" maxLength={6} autoFocus value={pinVal}
              onChange={e => setPinVal(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') doCheck(); }} placeholder="••••" />
          </Field>
        </Modal>
      )}

      {pinSetFor && (
        <Modal title={'ضبط رقم PIN — ' + pinSetFor.name} icon={Lock} onClose={() => setPinSetFor(null)}
          foot={<>
            <button className="btn gh" onClick={() => setPinSetFor(null)}>إلغاء</button>
            <button className="btn pri" onClick={savePin}><Check size={14} />حفظ</button>
          </>}>
          <div className="grid" style={{ gap: 10 }}>
            <Field label="رقم PIN الجديد (4-6 أرقام)">
              <input className="inp" type="password" inputMode="numeric" maxLength={6} autoFocus value={np1} onChange={e => setNp1(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            </Field>
            <Field label="تأكيد رقم PIN">
              <input className="inp" type="password" inputMode="numeric" maxLength={6} value={np2} onChange={e => setNp2(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
