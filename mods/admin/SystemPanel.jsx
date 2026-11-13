/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useRef, useEffect } from 'react';
import { cloud, KEYS, bfKey, kb, authApi } from '../../storage';
import { Settings, Check, Clock, HardDrive, Download, ShieldCheck, Upload, X, ShieldAlert, RefreshCw, Trash2, FileBarChart } from 'lucide-react';
import { CloudHealth, Field, MfaPolicyCard, Modal, NationalAddressFields, PhotoField, ROLES, fmtNA, isoD, lockedThru, money, naClean, naErr, naHas, nowISO, periodLocked, snapAll, snapPut, today, uid, verifyBackup, logAudit } from '../../App.jsx';

export function SystemPanel({ org, ops, me, commit, commitOrg, say }) {
  const [hist, setHist] = useState({ closings: [] });
  const [working, setWorking] = useState(false);
  const [c, setC] = useState(() => ({ ...(org.company || {}) }));
  const fileRef = useRef();
  const set = (k, v) => setC(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const h = await cloud.get(KEYS.hist, { closings: [] });
      setHist(h && Array.isArray(h.closings) ? h : { closings: [] });
    })();
  }, []);

  const cutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return isoD(d); })();
  const oldOnes = (ops.closings || []).filter(x => x.date < cutoff);

  const archiveOld = async () => {
    // v28.1: موقوفة — كانت تُخرج إيرادات الإغلاقات المؤرشفة من الدفاتر وتحذف ما يزيد عن 800 إغلاق
    return say('أرشفة الإغلاقات موقوفة مؤقتًا لأنها تُخرج إيرادات الفترات السابقة من الدفاتر. بياناتك باقية كما هي.', 'no');
    // eslint-disable-next-line no-unreachable
    if (oldOnes.length === 0) return say('لا توجد إغلاقات أقدم من 90 يوماً', 'no');
    setWorking(true);
    try {
      const cur = await cloud.get(KEYS.hist, { closings: [] });
      const prev = (cur && Array.isArray(cur.closings)) ? cur.closings : [];
      const ids = oldOnes.map(x => x.id);
      const okStore = await cloud.set(KEYS.hist, { closings: [...oldOnes, ...prev].slice(0, 800), updatedAt: nowISO() });
      if (!okStore) { setWorking(false); return say('تعذّر حفظ الأرشيف — أعد المحاولة', 'no'); }
      await commit(d => ({
        ...d,
        closings: (d.closings || []).filter(x => x.date >= cutoff),
        transfers: (d.transfers || []).filter(t => !ids.includes(t.closingId))
      }), {
        actionType: 'update', targetType: 'system_settings', targetId: 'archive',
        title: 'أرشف إغلاقات قديمة', details: `${oldOnes.length} إغلاق أقدم من ${cutoff}`
      });
      const after = await cloud.get(KEYS.hist, { closings: [] });
      setHist(after && Array.isArray(after.closings) ? after : { closings: [] });
      say(`تمت أرشفة ${oldOnes.length} إغلاق — بيانات التشغيل أصبحت أخف`);
    } catch { say('تعذّرت الأرشفة — أعد المحاولة', 'no'); }
    setWorking(false);
  };

  // v29.2 — حذف كل بيانات الإغلاق اليومي (لمسؤول النظام فقط): الإغلاقات + توريداتها + تنبيهاتها
  //   + صور توثيقها في أرشيف المستندات + أرشيف الإغلاقات القديم. قبل الحذف: لقطة أمان محلية
  //   وملف تنزيل بكل ما سيُحذف (قابل للرجوع إليه). القيود المحاسبية للإغلاقات مشتقّة حسابيًا فتزول معها.
  const isSysAdmin = !!ROLES[me.role]?.admin;
  const [wipe, setWipe] = useState({ open: false, text: '', busy: false, done: null });
  // v34.17: اختيار الفرع — حذف إغلاقات فرع واحد أو كل الفروع
  const [wBr, setWBr] = useState('all');
  const wBrName = wBr === 'all' ? 'كل الفروع' : (((org.branches || []).find(b => b.id === wBr)) || { name: wBr }).name;
  const wClosings = (ops.closings || []).filter(c => wBr === 'all' || c.branchId === wBr);
  const wIds = new Set(wClosings.map(x => x.id));
  const wTransfers = (ops.transfers || []).filter(t => t.closingId && wIds.has(t.closingId));
  const wNotes = (ops.notifications || []).filter(n => n.closingId && wIds.has(n.closingId));
  const wLocked = wClosings.filter(x => periodLocked(org, x.date));
  const WIPE_WORD = 'احذف الإغلاقات';
  const wipeClosings = async () => {
    if (!isSysAdmin) return say('هذا الإجراء لمسؤول النظام فقط', 'no');
    if (wipe.text.trim() !== WIPE_WORD) return say('اكتب «' + WIPE_WORD + '» للتأكيد', 'no');
    if (wLocked.length) return say('يوجد ' + wLocked.length + ' إغلاق في فترة مقفلة — افتح الفترة أولًا من «الإقفال الشهري»', 'no');
    setWipe(w => ({ ...w, busy: true }));
    try {
      // 1) أرشيف المستندات: صور توثيق الإغلاقات في مستند كل فرع + المركز
      const bIds = wBr === 'all' ? [...(org.branches || []).map(b => b.id), 'hq'] : [wBr];
      const arch = {};
      for (const b of bIds) {
        const doc = await cloud.get(bfKey(b), { items: [] });
        const items = (doc && Array.isArray(doc.items)) ? doc.items : [];
        const gone = items.filter(it => (it.closingId && wIds.has(it.closingId)) || (it.source === 'closing' && (wBr === 'all' || it.branchId === wBr)));
        if (gone.length) arch[b] = { keep: items.filter(it => !gone.includes(it)), gone };
      }
      const h = await cloud.get(KEYS.hist, { closings: [] });
      const histAll = (h && Array.isArray(h.closings)) ? h.closings : [];
      const histClosings = histAll.filter(c => wBr === 'all' || c.branchId === wBr);
      // 2) ملف بكل ما سيُحذف + لقطة أمان محلية — قبل أي كتابة
      const removed = { meta: { app: 'rms8', kind: 'deleted-closings', at: nowISO(), by: me?.name || '' },
        closings: wClosings, transfers: wTransfers, notifications: wNotes, histClosings,
        archive: Object.fromEntries(Object.entries(arch).map(([b, v]) => [b, v.gone])) };
      try {
        const blob = new Blob([JSON.stringify(removed)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'الإغلاقات-المحذوفة-' + (wBr === 'all' ? 'كل-الفروع' : wBrName.replace(/\s+/g, '-')) + '-' + today() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch { }
      try { await snapPut('pre-wipe-closings-' + nowISO().slice(0, 19).replace(/[:T]/g, '-'), { at: nowISO(), by: me?.name || '', org, ops, preWipe: true }); } catch { }
      // 3) الحذف من بيانات التشغيل (مستندات الفروع) — كتابة موجَّهة عبر البوابة المركزية
      const ok = await commit(d => ({
        ...d,
        closings: wBr === 'all' ? [] : (d.closings || []).filter(c => c.branchId !== wBr),
        transfers: (d.transfers || []).filter(t => !(t.closingId && wIds.has(t.closingId))),
        notifications: (d.notifications || []).filter(n => !(n.closingId && wIds.has(n.closingId)))
      }), { actionType: 'delete', targetType: 'daily_closing', targetId: 'all', need: 'edit',
        title: 'حذف بيانات الإغلاق اليومي — ' + wBrName, details: wBrName + ' · ' + wClosings.length + ' إغلاق · ' + wTransfers.length + ' توريد · ' + wNotes.length + ' تنبيه' });
      if (!ok) { setWipe(w => ({ ...w, busy: false })); return; }
      // 4) الأرشيف وأرشيف الإغلاقات القديم
      let archDone = 0, archFail = 0;
      for (const [b, v] of Object.entries(arch)) {
        if (await cloud.set(bfKey(b), { items: v.keep })) archDone += v.gone.length; else archFail++;
      }
      let histOk = true;
      const histKeep = histAll.filter(c => !histClosings.includes(c));
      if (histClosings.length) histOk = !!(await cloud.set(KEYS.hist, { closings: histKeep, updatedAt: nowISO() }));
      if (histOk) setHist({ closings: histKeep });
      setWipe({ open: false, text: '', busy: false, done: { closings: wClosings.length, transfers: wTransfers.length, notes: wNotes.length, archDone, archFail, hist: histOk ? histClosings.length : -1 } });
      say(archFail || !histOk ? 'حُذفت الإغلاقات — بقيت أجزاء من الأرشيف لم تُحذف، أعد المحاولة' : 'حُذفت بيانات الإغلاق اليومي — ' + wBrName + ' ✓');
    } catch (e) {
      setWipe(w => ({ ...w, busy: false }));
      say('تعذّر الحذف — لم يكتمل، تحقق من الاتصال وأعد المحاولة', 'no');
    }
  };

  // v29.8 — حذف كل البيانات المحاسبية (لمسؤول النظام فقط) تمهيدًا لإعادة الرفع من جديد:
  //   الإغلاقات وتوريداتها وتنبيهاتها وصورها · فواتير الموردين · السدادات · القيود اليدوية والمستوردة ·
  //   أوامر الصرف · تسويات التطبيقات · التسويات البنكية · الأرصدة الافتتاحية · قيد إقفال السنة · دفعات ميزان (تُعلَّم ملغاة).
  //   الرواتب والسلف اختيارية. يبقى: الشركة والفروع والمستخدمون والموظفون والموردون ودليل الحسابات والأصول والمخزون والإعدادات.
  const [acWipe, setAcWipe] = useState({ open: false, text: '', busy: false, payroll: false, done: null });
  const AC_WORD = 'احذف البيانات المحاسبية';
  const acCols = ['invoices', 'closingInvPays', 'journalManual', 'disbursements', 'appSettlements', 'bankRecs'];
  const acPayCols = ['ledgerEntries', 'advances'];
  const acCount = (k) => (ops[k] || []).length;
  const acAllTransfers = ops.transfers || [];
  const acObLines = ((org.openingBalances || {}).lines || []).filter(l => (l.debit || 0) || (l.credit || 0)).length;
  const acLockedNow = lockedThru(org);
  const wipeAccounting = async () => {
    if (!isSysAdmin) return say('هذا الإجراء لمسؤول النظام فقط', 'no');
    if (acWipe.text.trim() !== AC_WORD) return say('اكتب «' + AC_WORD + '» للتأكيد', 'no');
    if (acLockedNow) return say('الفترات مقفلة حتى ' + acLockedNow + ' — افتح الإقفال أولًا من المحاسبة ← الإقفال (فتح موثّق)، ثم أعد المحاولة', 'no');
    setAcWipe(w => ({ ...w, busy: true }));
    try {
      const cols = [...acCols, ...(acWipe.payroll ? acPayCols : [])];
      // 1) صور توثيق الإغلاقات في الأرشيف + أرشيف الإغلاقات القديم (كما في أداة حذف الإغلاقات)
      const bIds = [...(org.branches || []).map(b => b.id), 'hq'];
      const arch = {};
      for (const b of bIds) {
        const doc = await cloud.get(bfKey(b), { items: [] });
        const items = (doc && Array.isArray(doc.items)) ? doc.items : [];
        const gone = items.filter(it => it.source === 'closing' || (it.closingId && wIds.has(it.closingId)));
        if (gone.length) arch[b] = { keep: items.filter(it => !gone.includes(it)), gone };
      }
      const h = await cloud.get(KEYS.hist, { closings: [] });
      const histClosings = (h && Array.isArray(h.closings)) ? h.closings : [];
      // 2) ملف بكل ما سيُحذف + لقطة أمان محلية — قبل أي كتابة
      const removed = { meta: { app: 'rms8', kind: 'deleted-accounting', at: nowISO(), by: me?.name || '', payroll: !!acWipe.payroll },
        closings: wClosings, transfers: acAllTransfers, notifications: wNotes, histClosings,
        ...Object.fromEntries(cols.map(k => [k, ops[k] || []])),
        openingBalances: org.openingBalances || null, yearEnd: org.yearEnd || null, mizanBatches: (org.mizanCfg || {}).batches || [],
        archive: Object.fromEntries(Object.entries(arch).map(([b, v]) => [b, v.gone])) };
      try {
        const blob = new Blob([JSON.stringify(removed)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'البيانات-المحاسبية-المحذوفة-' + today() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch { }
      try { await snapPut('pre-wipe-accounting-' + nowISO().slice(0, 19).replace(/[:T]/g, '-'), { at: nowISO(), by: me?.name || '', org, ops, preWipe: true }); } catch { }
      // 3) بيانات التشغيل (المركز + الفروع)
      const ok = await commit(d => ({
        ...d,
        closings: [], transfers: [],
        notifications: (d.notifications || []).filter(n => !(n.closingId && wIds.has(n.closingId))),
        ...Object.fromEntries(cols.map(k => [k, []]))
      }), { actionType: 'delete', targetType: 'journal_entry', targetId: 'accounting-all', need: 'edit',
        title: 'حذف كل البيانات المحاسبية (تمهيدًا لإعادة الرفع)',
        details: [wClosings.length + ' إغلاق', acAllTransfers.length + ' توريد', ...cols.map(k => acCount(k) + ' ' + k), acObLines + ' سطر افتتاحي'].join(' · ') });
      if (!ok) { setAcWipe(w => ({ ...w, busy: false })); return; }
      // 4) إعدادات المنشأة: الأرصدة الافتتاحية وقيد إقفال السنة ودفعات ميزان (تبقى خريطة الربط لإعادة الاستيراد)
      const okOrg = await commitOrg(d => ({
        ...d,
        openingBalances: { ...(d.openingBalances || {}), enabled: false, lines: [] },
        yearEnd: d.yearEnd ? { ...d.yearEnd, enabled: false } : d.yearEnd,
        mizanCfg: d.mizanCfg ? { ...d.mizanCfg, batches: (d.mizanCfg.batches || []).map(b => b.undoneAt ? b : { ...b, undoneAt: nowISO(), undoneBy: (me?.name || '') + ' — حذف شامل' }) } : d.mizanCfg
      }), { actionType: 'delete', targetType: 'tax_settings', targetId: 'accounting-all', need: 'edit', title: 'مسح الأرصدة الافتتاحية وإقفال السنة ودفعات ميزان', details: acObLines + ' سطر افتتاحي' });
      // 5) الأرشيف
      let archDone = 0, archFail = 0;
      for (const [b, v] of Object.entries(arch)) { if (await cloud.set(bfKey(b), { items: v.keep })) archDone += v.gone.length; else archFail++; }
      let histOk = true;
      if (histClosings.length) histOk = !!(await cloud.set(KEYS.hist, { closings: [], updatedAt: nowISO() }));
      if (histOk) setHist({ closings: [] });
      setAcWipe({ open: false, text: '', busy: false, payroll: false, done: { okOrg, archFail, histOk } });
      say(!okOrg ? 'حُذفت السجلات — لكن تعذّر مسح الأرصدة الافتتاحية؛ أعد تشغيل الأداة لإكمالها' : (archFail || !histOk) ? 'حُذفت البيانات المحاسبية — بقي جزء من الأرشيف، أعد المحاولة' : 'حُذفت كل البيانات المحاسبية ✓ — المنصة جاهزة لإعادة الرفع');
    } catch (e) {
      setAcWipe(w => ({ ...w, busy: false }));
      say('تعذّر الحذف — لم يكتمل، تحقق من الاتصال وأعد المحاولة', 'no');
    }
  };

  const saveCompany = async () => {
    if (naErr(c.na)) return say('العنوان الوطني: ' + naErr(c.na), 'no');
    const na = naClean(c.na);
    await commitOrg(d => ({ ...d, company: { ...c, na, ...(naHas(na) ? { address: fmtNA(na) } : {}) } }), {
      actionType: 'update', targetType: 'system_settings', targetId: 'company',
      title: 'حدّث بيانات الشركة', details: c.name
    });
    say('تم حفظ بيانات الشركة');
  };

  // v15.24 — مهلة انتهاء الجلسة التلقائية (معطّلة افتراضياً — تفعيل صريح من الإدارة)
  const [sessD, setSessD] = useState(() => { const s = org.sessionCfg || {}; return { enabled: !!s.enabled, minutes: String(s.minutes || 15), onTimeout: s.onTimeout || 'logout' }; });
  const saveSess = async () => {
    const mins = Math.max(1, Math.min(480, Number(sessD.minutes) || 15));
    const ok = await commitOrg(d => ({ ...d, sessionCfg: { enabled: !!sessD.enabled, minutes: mins, onTimeout: sessD.onTimeout || 'logout' } }), {
      actionType: 'update', targetType: 'system_settings', targetId: 'sessionCfg', need: 'edit',
      title: sessD.enabled ? 'فعّل مهلة انتهاء الجلسة' : 'أوقف مهلة انتهاء الجلسة',
      details: sessD.enabled ? ('خمول ' + mins + ' دقيقة ثم تحذير دقيقة ثم ' + (sessD.onTimeout === 'lock' ? 'قفل بدخول سريع' : 'خروج كامل')) : ''
    });
    if (!ok) return;
    setSessD(s => ({ ...s, minutes: String(mins) }));
    say(sessD.enabled
      ? 'فُعّلت مهلة الجلسة: بعد ' + mins + ' دقيقة خمول ← ' + (sessD.onTimeout === 'lock' ? 'قفل الشاشة (عودة برقم سري/بصمة)' : 'خروج كامل') + ' ✓'
      : 'أُوقفت مهلة انتهاء الجلسة');
  };

  // v8.5: حالات النسخ والاستعادة المحصّنة
  const [vReport, setVReport] = useState(null);       // تقرير فحص نسخة
  const [restoreArm, setRestoreArm] = useState(null); // {data, report, text} تأكيد الاستعادة
  const [snaps, setSnaps] = useState([]);
  const verifyRef = useRef();
  const reloadSnaps = () => snapAll().then(a => setSnaps(a.sort((x, y) => (y.key || '').localeCompare(x.key || '')))).catch(() => setSnaps([]));
  useEffect(() => { reloadSnaps(); }, []);
  const lastDl = (org.backupMeta || {}).lastDownloadAt || '';
  const dlAgeDays = lastDl ? Math.floor((Date.now() - new Date(lastDl).getTime()) / 864e5) : null;

  const backup = async () => {
    const meta = {
      app: 'rms8', appVersion: 'v8.5', exportedAt: nowISO(), by: me?.name || '',
      counts: { branches: (org.branches || []).length, users: (org.users || []).length, closings: (ops.closings || []).length }
    };
    const blob = new Blob([JSON.stringify({ meta, org, ops, hist, exportedAt: meta.exportedAt }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `نسخة-احتياطية-${today()}.json`; a.click();
    await commitOrg(d => ({ ...d, backupMeta: { lastDownloadAt: nowISO(), by: me?.name || '' } }), {
      actionType: 'update', targetType: 'system_settings', targetId: 'backup',
      title: 'نزّل نسخة احتياطية كاملة', details: (ops.closings || []).length + ' إغلاق'
    });
    URL.revokeObjectURL(url);
    say('تم تنزيل النسخة الاحتياطية الكاملة');
  };

  const readJson = (f) => new Promise((res) => {
    const rd = new FileReader();
    rd.onload = () => { try { res(JSON.parse(String(rd.result))); } catch { res(null); } };
    rd.onerror = () => res(null);
    rd.readAsText(f);
  });
  // فحص نسخة دون أي تغيير — «تجربة الاستعادة» قبل الحاجة إليها
  const verifyFile = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const data = await readJson(f);
    setVReport({ name: f.name, ...(data ? verifyBackup(data) : { ok: false, err: 'الملف ليس JSON صالحًا' }) });
  };
  // الاستعادة: فحص ← عرض ← تأكيد كتابي ← لقطة أمان ← استبدال موثق
  // v28.1: الاستعادة موقوفة من الواجهة — غير ذرّية وتُطلق هجرة قديمة قد تكتب بيانات مجمّدة فوق الحالية
  const RESTORE_OFF = 'الاستعادة من الواجهة موقوفة مؤقتًا لأنها قد تكتب بيانات قديمة فوق الحالية. «فحص نسخة» ما زال متاحًا، وللاستعادة الطارئة تواصل مع المطوّر.';
  const restore = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    return say(RESTORE_OFF, 'no');
    // eslint-disable-next-line no-unreachable
    const data = await readJson(f);
    const rep = data ? verifyBackup(data) : { ok: false, err: 'الملف ليس JSON صالحًا' };
    if (!rep.ok) return say('النسخة مرفوضة: ' + rep.err, 'no');
    setRestoreArm({ data, report: rep, name: f.name, text: '' });
  };
  const doRestore = async () => {
    const ra = restoreArm;
    return say(RESTORE_OFF, 'no');
    // eslint-disable-next-line no-unreachable
    if (!ra || ra.text.trim() !== 'استعادة') return say('اكتب كلمة «استعادة» للتأكيد', 'no');
    try { await snapPut('pre-restore-' + nowISO().slice(0, 19).replace(/[:T]/g, '-'), { at: nowISO(), by: me?.name || '', org, ops, preRestore: true }); } catch { }
    const o2 = { ...ra.data.org }; delete o2.migratedV9; delete o2.membersSyncedV9;
    await cloud.set(KEYS.org, o2);                      // v9: بلا علم الهجرة — التحديث يعيد تقسيمها للمستندات
    if (ra.data.ops) await cloud.set(KEYS.ops, ra.data.ops);
    if (ra.data.hist) await cloud.set(KEYS.hist, ra.data.hist);
    try {
      await logAudit({ id: uid('lg'), at: Date.now(), timestamp: nowISO(), userName: me?.name || '', userRole: me?.role || '',
        title: 'استعاد نسخة احتياطية كاملة', details: ra.name + ' · ' + (ra.report.exportedAt || '').slice(0, 10) + ' · ' + ra.report.counts.closings + ' إغلاق' });   // v40.0: السجل المحصّن
    } catch { }
    setRestoreArm(null); reloadSnaps();
    say('تمت الاستعادة ووُثّقت — حدّث الصفحة لعرض البيانات المستعادة');
  };
  const restoreSnap = (sn) => (sn ? say(RESTORE_OFF, 'no') : null) || setRestoreArm({ data: { org: sn.org, ops: sn.ops }, report: verifyBackup({ org: sn.org, ops: sn.ops }), name: 'لقطة محلية ' + sn.key, text: '' });
  const downloadSnap = (sn) => {
    const blob = new Blob([JSON.stringify({ meta: { app: 'rms8', exportedAt: sn.at, by: sn.by, source: 'local-snapshot' }, org: sn.org, ops: sn.ops }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `لقطة-${sn.key}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  };

  const stats = [
    ['الفروع', (org.branches || []).length], ['المستخدمون', (org.users || []).length],
    ['الموظفون', (org.employees || []).length], ['الإغلاقات', (ops.closings || []).length],
    ['سندات التحويل', (ops.transfers || []).length], ['فواتير الموردين', (ops.invoices || []).length]
  ];
  const sizes = [
    ['بيانات المنشأة', kb(org)], ['بيانات التشغيل', kb(ops)],
    ['الأرشيف التاريخي', kb(hist)], ['إصدار البيانات', ops.rev || 0]
  ];

  return (
    <div className="grid g2">
      <div className="card">
        <div className="card-t" style={{ marginBottom: 14 }}><Settings size={15} color="var(--brass)" />بيانات المنشأة</div>
        <Field label="اسم الشركة"><input className="inp" value={c.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="النشاط"><input className="inp" value={c.activity} onChange={e => set('activity', e.target.value)} /></Field>
        <div className="grid g2">
          <Field label="الرقم الضريبي"><input className="inp n" value={c.taxNumber} onChange={e => set('taxNumber', e.target.value)} /></Field>
          <Field label="السجل التجاري"><input className="inp n" value={c.commercialReg} onChange={e => set('commercialReg', e.target.value)} /></Field>
        </div>
        <div className="grid g2">
          <Field label="الهاتف"><input className="inp n" value={c.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="البريد الإلكتروني"><input className="inp" type="email" style={{ direction: 'ltr', textAlign: 'right' }} value={c.email || ''} onChange={e => set('email', e.target.value)} /></Field>
        </div>
        <NationalAddressFields value={c.na} legacy={c.address} onChange={na => set('na', na)} />
        {!naHas(c.na) && !!c.address && <Field label="العنوان القديم (نص حر) — يُستبدل بالحقول أعلاه"><input className="inp" value={c.address} onChange={e => set('address', e.target.value)} /></Field>}
        <Field label="شعار المنشأة (يظهر في الإيصالات)">
          <PhotoField value={c.logoUrl} onChange={v => set('logoUrl', v)} say={say} />
        </Field>
        <button className="btn pri" onClick={saveCompany}><Check size={14} />حفظ بيانات المنشأة</button>

        {authApi.enabled && <MfaPolicyCard org={org} me={me} commitOrg={commitOrg} say={say} />}

        {/* v15.24 — مهلة انتهاء الجلسة */}
        <div className="card" style={{ marginTop: 12, background: 'var(--ink)' }}>
          <div className="card-t" style={{ marginBottom: 8 }}><Clock size={15} color="var(--brass)" />مهلة انتهاء الجلسة التلقائية</div>
          <div className="note" style={{ marginBottom: 10 }}>
            عند التفعيل: أي مستخدم يترك المنصّة بلا نشاط للمدة المحددة يظهر له تحذير لمدة دقيقة
            (مع زر «متابعة الجلسة»)، فإن لم يستجب يُسجَّل خروجه تلقائياً — حماية مهمة للأجهزة
            المشتركة كأجهزة الكاشير. <b>معطّلة افتراضياً.</b>
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 12.5, paddingBottom: 10 }}>
              <input type="checkbox" checked={sessD.enabled} onChange={e => setSessD(s => ({ ...s, enabled: e.target.checked }))} />
              تفعيل مهلة الجلسة
            </label>
            <Field label="مدة الخمول (بالدقائق)" style={{ width: 150 }}>
              <input className="inp n" inputMode="numeric" value={sessD.minutes} disabled={!sessD.enabled}
                onChange={e => setSessD(s => ({ ...s, minutes: e.target.value.replace(/[^\d]/g, '') }))} />
            </Field>
            <Field label="عند انتهاء المهلة" style={{ width: 260 }}>
              <select className="sel" value={sessD.onTimeout} disabled={!sessD.enabled}
                onChange={e => setSessD(s => ({ ...s, onTimeout: e.target.value }))}>
                <option value="logout">تسجيل خروج كامل</option>
                <option value="lock">قفل الشاشة — عودة بالدخول السريع (رقم سري/بصمة)</option>
              </select>
            </Field>
            <button className="btn pri" style={{ marginBottom: 1 }} onClick={saveSess}><Check size={14} />حفظ إعداد الجلسة</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gap: 12, alignContent: 'start' }}>
        {ROLES[me.role]?.admin && <CloudHealth org={org} say={say} commit={commit} me={me} />}
        <div className="card">
          <div className="card-h">
            <div className="card-t"><HardDrive size={15} color="var(--brass)" />النسخ الاحتياطي والاستعادة</div>
            {dlAgeDays === null
              ? <span className="badge b-rose">لم تُنزّل نسخة بعد — نزّل الأولى الآن</span>
              : dlAgeDays > 7
                ? <span className="badge b-amber">آخر تنزيل قبل {dlAgeDays} يومًا — يُنصح أسبوعيًا</span>
                : <span className="badge b-mint">آخر تنزيل قبل {dlAgeDays} يومًا ✓ {((org.backupMeta || {}).by) ? '· ' + org.backupMeta.by : ''}</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 12, lineHeight: 1.9 }}>
            المنصة مستضافة استضافة ثابتة بلا خادم مجدول — لذا الحماية «التلقائية» هي <b>لقطات يومية محلية</b> على
            أجهزة الإدارة (أدناه)، والحماية الخارجية هي <b>النسخة الملفية</b>: نزّلها أسبوعيًا واحفظها خارج الجهاز.
            وزر «فحص نسخة» يجري تجربة استعادة حقيقية دون أي تغيير: يقرأ الملف ويشغّل المحرك المحاسبي عليه ويثبت توازنه.
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button className="btn pri" onClick={backup}><Download size={14} />تنزيل نسخة احتياطية</button>
            <button className="btn" onClick={() => verifyRef.current?.click()}><ShieldCheck size={14} />فحص نسخة (تجربة استعادة)</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={14} />استعادة من ملف</button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={restore} />
            <input ref={verifyRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={verifyFile} />
          </div>
          {vReport && (
            <div className="card" style={{ marginTop: 12, background: 'var(--ink)', borderColor: vReport.ok ? 'rgba(79,178,134,.45)' : 'rgba(217,84,77,.45)' }}>
              <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="card-t" style={{ fontSize: 14 }}>{vReport.ok ? '✅ النسخة سليمة وقابلة للاستعادة' : '❌ النسخة غير صالحة'}</div>
                <button className="btn sm gh" onClick={() => setVReport(null)}><X size={13} /></button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 2 }}>
                الملف: <span className="num">{vReport.name}</span>
                {vReport.ok ? <>
                  {vReport.exportedAt ? <> · صادرة بتاريخ <span className="num">{(vReport.exportedAt || '').slice(0, 10)}</span></> : null}
                  <br />المحتوى: <b>{vReport.counts.branches}</b> فرع · <b>{vReport.counts.users}</b> مستخدمًا · <b>{vReport.counts.closings}</b> إغلاقًا · <b>{vReport.counts.suppliers}</b> موردًا · <b>{vReport.counts.assets}</b> أصلًا
                  <br />المحاسبة: <b>{vReport.counts.entries}</b> قيدًا — {vReport.balanced ? <b style={{ color: 'var(--mint)' }}>متوازنة ✓ (إجمالي {money(vReport.totalDebit)})</b> : <b style={{ color: 'var(--rose)' }}>غير متوازنة!</b>}
                </> : <><br /><span style={{ color: 'var(--rose)' }}>{vReport.err}</span></>}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-h">
            <div className="card-t"><Clock size={15} color="var(--brass)" />اللقطات اليومية المحلية (هذا الجهاز)</div>
            <span className={'badge ' + (snaps.some(x => x.key === 'day-' + today()) ? 'b-mint' : 'b-dim')}>
              {snaps.some(x => x.key === 'day-' + today()) ? 'لقطة اليوم محفوظة ✓' : 'ستُحفظ تلقائيًا عند فتح المنصة'}</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 10, lineHeight: 1.8 }}>
            تُحفظ لقطة كاملة تلقائيًا أول دخول كل يوم على أجهزة أدوار الإدارة (يُحتفظ بآخر 7 أيام) —
            ولقطة أمان إضافية قبل كل استعادة. محلية على هذا الجهاز فقط.
          </div>
          {snaps.length === 0 ? <div className="empty">لا لقطات محفوظة على هذا الجهاز بعد.</div> : (
            <div className="tw"><table className="tb">
              <thead><tr><th>اللقطة</th><th>وقتها</th><th>محتواها</th><th /></tr></thead>
              <tbody>{snaps.slice(0, 10).map(sn => (
                <tr key={sn.key}>
                  <td><span className="num" style={{ fontSize: 11 }}>{sn.key}</span> {sn.preRestore && <span className="badge b-amber" style={{ fontSize: 8.5 }}>أمان ما قبل استعادة</span>}</td>
                  <td className="num" style={{ fontSize: 11 }}>{(sn.at || '').slice(0, 16).replace('T', ' ')}</td>
                  <td style={{ fontSize: 11, color: 'var(--dim)' }}>{((sn.ops || {}).closings || []).length} إغلاقًا · {((sn.org || {}).users || []).length} مستخدمًا</td>
                  <td><div className="row" style={{ gap: 5 }}>
                    <button className="btn sm gh" onClick={() => downloadSnap(sn)}><Download size={12} /></button>
                    <button className="btn sm" onClick={() => restoreSnap(sn)}>استعادة</button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>

        {restoreArm && (
          <Modal title="تأكيد الاستعادة — إجراء جوهري" icon={ShieldAlert} onClose={() => setRestoreArm(null)}
            foot={<>
              <button className="btn gh" onClick={() => setRestoreArm(null)}>إلغاء</button>
              <button className="btn no" disabled={restoreArm.text.trim() !== 'استعادة'} onClick={doRestore}><Check size={14} />استبدال البيانات الآن</button>
            </>}>
            <div className="note" style={{ marginBottom: 10 }}>
              ستحل النسخة <b>{restoreArm.name}</b> محل بيانات المنصة الحالية <b>لدى جميع المستخدمين</b>.
              قبل الاستبدال تُحفظ لقطة أمان من الوضع الحالي على هذا الجهاز، ويُوثَّق الإجراء في سجل التدقيق باسمك.
            </div>
            <div style={{ fontSize: 12, lineHeight: 2, marginBottom: 10 }}>
              فحص النسخة: {restoreArm.report.balanced ? <b style={{ color: 'var(--mint)' }}>محاسبتها متوازنة ✓</b> : <b style={{ color: 'var(--rose)' }}>غير متوازنة!</b>}
              · <b>{restoreArm.report.counts.closings}</b> إغلاقًا مقابل <b>{(ops.closings || []).length}</b> حاليًا
              · <b>{restoreArm.report.counts.users}</b> مستخدمًا مقابل <b>{(org.users || []).length}</b>
            </div>
            <Field label="اكتب كلمة «استعادة» للتأكيد">
              <input className="inp" value={restoreArm.text} onChange={e => setRestoreArm(r => ({ ...r, text: e.target.value }))} placeholder="استعادة" />
            </Field>
          </Modal>
        )}
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><HardDrive size={15} color="var(--brass)" />الصيانة وتخفيف البيانات</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 12 }}>
            نقل الإغلاقات الأقدم من 90 يوماً إلى أرشيف منفصل يقلّل حجم المزامنة اللحظية ويسرّع المنصة لدى الجميع.
            الأرشيف يبقى متاحاً للاسترجاع ضمن النسخة الاحتياطية.
          </div>
          <div className="grid g4" style={{ gap: 9, marginBottom: 12 }}>
            {sizes.map(([k, v]) => (
              <div key={k} className="mono-b" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{k}</span>
                <span className="num" style={{ fontSize: 16, color: 'var(--brass)' }}>
                  {k === 'إصدار البيانات' ? v : v + ' ك.ب'}
                </span>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn" disabled={working} onClick={archiveOld}>
              {working ? <RefreshCw size={14} className="spin" /> : <HardDrive size={14} />}
              أرشفة {oldOnes.length} إغلاق قديم
            </button>
            <span className="badge b-dim">
              الأرشيف يضم <span className="num">{(hist?.closings || []).length}</span> إغلاق
            </span>
          </div>
        </div>
        {isSysAdmin && (
          <div className="card" style={{ borderColor: 'rgba(217,84,77,.45)' }}>
            <div className="card-t" style={{ marginBottom: 10, color: '#D9544D' }}><Trash2 size={15} />حذف كل بيانات الإغلاق اليومي</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 10 }}>
              يحذف نهائيًا إغلاقات الفرع المختار (أو كل الفروع)، مع توريداتها وتنبيهاتها وصور توثيقها في أرشيف المستندات.
              قيود الإيراد والمصروفات المشتقّة من الإغلاقات تختفي من المحاسبة والتقارير فورًا.
              قبل الحذف يُنزَّل تلقائيًا ملف بكل ما سيُحذف للرجوع إليه.
            </div>
            <Field label="الفرع" style={{ maxWidth: 320 }}><select className="sel" value={wBr} disabled={wipe.busy} onChange={e => { setWBr(e.target.value); setWipe(w => ({ ...w, open: false, text: '', done: null })); }}>
              <option value="all">كل الفروع</option>{(org.branches || []).map(b => <option key={b.id} value={b.id}>{b.name} ({(ops.closings || []).filter(c => c.branchId === b.id).length} إغلاق)</option>)}</select></Field>
            <div className="grid g4" style={{ gap: 9, marginBottom: 10 }}>
              {[['الإغلاقات', wClosings.length], ['التوريدات المرتبطة', wTransfers.length], ['التنبيهات المرتبطة', wNotes.length], ['في فترة مقفلة', wLocked.length]].map(([k, v]) => (
                <div key={k} className="mono-b" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{k}</span>
                  <span className="num" style={{ fontSize: 16, color: k === 'في فترة مقفلة' && v ? '#D9544D' : 'var(--brass)' }}>{v}</span>
                </div>
              ))}
            </div>
            {wipe.done && (
              <div className="note" style={{ marginBottom: 10 }}>
                ✓ حُذف {wipe.done.closings} إغلاق و{wipe.done.transfers} توريد و{wipe.done.notes} تنبيه، و{wipe.done.archDone} صورة من الأرشيف
                {wipe.done.hist > 0 ? ' و' + wipe.done.hist + ' إغلاق من الأرشيف القديم' : ''}.
                {(wipe.done.archFail > 0 || wipe.done.hist < 0) && <b style={{ color: '#D9544D' }}> بقي جزء من الأرشيف لم يُحذف — أعد المحاولة.</b>}
              </div>
            )}
            {!wipe.open ? (
              <button className="btn" style={{ color: '#D9544D', borderColor: 'rgba(217,84,77,.5)' }} disabled={wipe.busy} onClick={() => setWipe(w => ({ ...w, open: true, text: '' }))}>
                <Trash2 size={14} />{wClosings.length ? 'حذف ' + wClosings.length + ' إغلاق — ' + wBrName + ' — وكل ما يرتبط بها' : 'تنظيف صور الإغلاقات المتبقية في الأرشيف'}
              </button>
            ) : (
              <div className="grid" style={{ gap: 9 }}>
                <div style={{ fontSize: 12, color: 'var(--txt)' }}>للتأكيد اكتب: <b>{WIPE_WORD}</b></div>
                <input className="inp" value={wipe.text} onChange={e => setWipe(w => ({ ...w, text: e.target.value }))} placeholder={WIPE_WORD} disabled={wipe.busy} />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" style={{ background: '#D9544D', color: '#fff', borderColor: '#D9544D' }} disabled={wipe.busy || wipe.text.trim() !== WIPE_WORD} onClick={wipeClosings}>
                    {wipe.busy ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}حذف نهائي
                  </button>
                  <button className="btn gh" disabled={wipe.busy} onClick={() => setWipe(w => ({ ...w, open: false, text: '' }))}>إلغاء</button>
                </div>
              </div>
            )}
          </div>
        )}
        {isSysAdmin && (
          <div className="card" style={{ borderColor: 'rgba(217,84,77,.6)' }}>
            <div className="card-t" style={{ marginBottom: 10, color: '#D9544D' }}><Trash2 size={15} />حذف كل البيانات المحاسبية (لإعادة الرفع من جديد)</div>
            <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 10 }}>
              يحذف نهائيًا: الإغلاقات اليومية وتوريداتها وصورها، فواتير الموردين، السدادات، القيود اليدوية والمستوردة، أوامر الصرف، تسويات التطبيقات والبنوك، الأرصدة الافتتاحية،
              وتُعلَّم دفعات ميزان ملغاة (تبقى خريطة الربط لإعادة الاستيراد).
              <b> يبقى:</b> الشركة والفروع والمستخدمون والموظفون والموردون ودليل الحسابات والأصول والمخزون والإعدادات.
              قبل الحذف يُنزَّل تلقائيًا ملف بكل ما سيُحذف. نزّل نسخة احتياطية كاملة أولًا.
            </div>
            <div className="grid g4" style={{ gap: 9, marginBottom: 10 }}>
              {[['إغلاقات', wClosings.length], ['توريدات', acAllTransfers.length], ['فواتير موردين', acCount('invoices')], ['سدادات', acCount('closingInvPays')],
                ['قيود يدوية/مستوردة', acCount('journalManual')], ['أوامر صرف', acCount('disbursements')], ['أسطر افتتاحية', acObLines], ['مقفل حتى', acLockedNow || '—']].map(([k, v]) => (
                <div key={k} className="mono-b" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{k}</span>
                  <span className="num" style={{ fontSize: 16, color: k === 'مقفل حتى' && acLockedNow ? '#D9544D' : 'var(--brass)' }}>{v}</span>
                </div>
              ))}
            </div>
            {acLockedNow && <div className="note" style={{ marginBottom: 10, borderColor: 'rgba(217,84,77,.5)' }}>الفترات مقفلة حتى {acLockedNow} — افتح الإقفال أولًا من المحاسبة ← الإقفال، ثم عد إلى هنا.</div>}
            {acWipe.done && (
              <div className="note" style={{ marginBottom: 10 }}>
                ✓ حُذفت البيانات المحاسبية.{!acWipe.done.okOrg && <b style={{ color: '#D9544D' }}> لم تُمسح الأرصدة الافتتاحية — أعد تشغيل الأداة.</b>}
                {(acWipe.done.archFail > 0 || !acWipe.done.histOk) && <b style={{ color: '#D9544D' }}> بقي جزء من الأرشيف — أعد المحاولة.</b>}
                {' '}الخطوة التالية: أعد الاستيراد من «دمج بيانات ميزان».
              </div>
            )}
            {!acWipe.open ? (
              <button className="btn" style={{ color: '#D9544D', borderColor: 'rgba(217,84,77,.5)' }} disabled={acWipe.busy} onClick={() => setAcWipe(w => ({ ...w, open: true, text: '' }))}>
                <Trash2 size={14} />حذف كل البيانات المحاسبية
              </button>
            ) : (
              <div className="grid" style={{ gap: 9 }}>
                <label className="row" style={{ gap: 8, fontSize: 12.5, alignItems: 'center' }}>
                  <input type="checkbox" checked={acWipe.payroll} onChange={e => setAcWipe(w => ({ ...w, payroll: e.target.checked }))} disabled={acWipe.busy} />
                  حذف قيود الرواتب ({acCount('ledgerEntries')}) والسلف ({acCount('advances')}) أيضًا — اتركه غير محدد إن كانت الرواتب تُدار من المنصة ولن تُعاد من ميزان
                </label>
                <div style={{ fontSize: 12, color: 'var(--txt)' }}>للتأكيد اكتب: <b>{AC_WORD}</b></div>
                <input className="inp" value={acWipe.text} onChange={e => setAcWipe(w => ({ ...w, text: e.target.value }))} placeholder={AC_WORD} disabled={acWipe.busy} />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" style={{ background: '#D9544D', color: '#fff', borderColor: '#D9544D' }} disabled={acWipe.busy || acWipe.text.trim() !== AC_WORD || !!acLockedNow} onClick={wipeAccounting}>
                    {acWipe.busy ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}حذف نهائي
                  </button>
                  <button className="btn gh" disabled={acWipe.busy} onClick={() => setAcWipe(w => ({ ...w, open: false, text: '' }))}>إلغاء</button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="card">
          <div className="card-t" style={{ marginBottom: 12 }}><FileBarChart size={15} color="var(--brass)" />حجم قاعدة البيانات</div>
          <div className="grid g3" style={{ gap: 9 }}>
            {stats.map(([k, v]) => (
              <div key={k} className="mono-b" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{k}</span>
                <span className="num" style={{ fontSize: 18, color: 'var(--brass)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
