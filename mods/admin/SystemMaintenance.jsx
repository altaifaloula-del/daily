/* v38.5 — صيانة النظام: حالة الخدمات، فحوص سلامة البيانات الآلية، وسجل أخطاء الأجهزة المركزي
   • الفحوص تعمل تلقائيًا عند فتح الشاشة على بيانات المنصّة نفسها (بلا تعديل) وتعرض لكل خلل مكانه وطريقة علاجه.
   • سجل الأخطاء: كل خطأ يقع على أي جهاز (بعد الدخول) يصل هنا مجمّعًا حسب نوعه — بلا بيانات تشغيل. */
import React, { useState, useEffect, useMemo } from 'react';
import { cloud, KEYS, brKey } from '../../storage';
import { ShieldCheck, RefreshCw, Trash2, AlertTriangle, Check, Server, Bug, Activity, HardDrive } from 'lucide-react';
import { archKey, archivePlan, nowISO, printA4, uid, dtLocal, posSplitBranch, posUnsplitBranch, posSplitOn } from '../../App.jsx';   // v41.7 + v52.7
import { clrCompare, clrLoad, clrOn, clrSeed, clrState, logAudit, clrRead, clrViewStats } from '../../App.jsx';   // v41.9 + v42.2
import { posrOn, posrCompare, posrLoad, posrSeed, posrState, posrRepair } from '../../App.jsx';   // v56.4 (POS 2a) سجلات فواتير نقطة البيع
import { MKT_BR_CV, mktBrOn } from '../../App.jsx';
import { loyPiiOn, loyPiiPlan, loyPiiCopy, loyPiiStrip, lypReleaseOk } from '../../App.jsx';
import { eclOn, eclAccs, eclAllowOk } from '../../App.jsx';
import { budVOn, ppOn } from '../../App.jsx';   // v56.41 الدفعة 6
import { impOn, impAccOk, impLossOk } from '../../App.jsx';   // v56.43 الدفعة 10
import { depBrRanges, depBrFrom, depBrToggle } from '../../App.jsx';   // v56.48 توزيع الإهلاك على الفروع
import { lrUnpaidOn } from '../../App.jsx';   // v56.44 الدفعة 9   // v56.40 الدفعة 7 (E6)   // v56.37 فصل أسماء عملاء الولاء
import { grrOn, mkcCompare, lytCompare, grrLoad, grrSeed, grrState, mkmOn, mkmCompare, mkmViolations, mkmSeed, mkmSrcOn } from '../../App.jsx';
import { posGlOpen, posGlRanges, posGlCheck } from '../../App.jsx';
import { loyMonthAdj, posLoyOpening, posMisLoyRanges, posMisLoyFrom, posGlNote, jeOwner, posGlFrom } from '../../App.jsx';   // v56.33 (الدفعة 2 — P1/P2)
import { ctlBarOn } from '../../App.jsx';
import { DS_BLOCKED, dsRanges, dsRouteOpen, dsLive, dsMapOf, dsAccOk } from '../../App.jsx';
import { cvApprRanges } from '../../App.jsx';
import { mktCtlOn } from '../../App.jsx';   // v56.35 ضوابط التسويق   // v56.32 اعتماد سندات الصرف   // v56.29 أوامر الصرف   // v56.23 (G2) شريط التحكم   // v56.18 (POS 6a) أثر فواتير نقطة البيع في قيد الإغلاق   // v56.17 (GROWTH 2) سجلات الموافقة والولاء المحمية   // v56.12 (GROWTH G1) سجلات التسويق في الفروع
import { DsPreCard, DsDupCard } from '../acct/DsBatch11.jsx';   // v56.45 الدفعة 11
import { WhtCard } from '../acct/WhtCard.jsx';   // v56.47 (E7) ضريبة الاستقطاع
import { WorkflowsCard } from './Workflows.jsx';   // v49.5 MQ-059
import { FL_START, flOn, flScope, flCompare, flLoad, flPost, FL_GROUPS, flLvl, flUnclassified, flCorrect, flReadOn } from '../../App.jsx';   // v56.9 D1 دفتر القيود المخزّن
import { fjCompare, fjLoad, fjOn, fjState, fpLockedTo, fpLoad, fmLoad, fmSet, fjSeed, FD_KINDS, fdCompare, fdLoad, fdSeed } from '../../App.jsx';   // v49.0 المرحلة 01
import { dataFootprint, recipeRaw, APP_CV, APP_VER, CloudHealth, ERRLOG_KEY, MAIN_WH, ROLES, SIG_BADGE, SIG_NAME, buildAccounting, finStrictOn, loadRelease, loadSignoffs, sigVerify, branchBanks, cashForecast, complianceItems, entityList, vatStatus, countedClosing, isoD, money, purKey, q3, qrFs, snapAll, stockByWh, today, whName, whOf } from '../../App.jsx';

const ST = { ok: ['b-mint', 'سليم'], warn: ['b-amber', 'تنبيه'], bad: ['b-rose', 'خلل'] };
const daysAgo = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return isoD(x); };
const serverBase = () => { const E = import.meta.env || {}; try { return E.VITE_AI_ENDPOINT ? new URL(E.VITE_AI_ENDPOINT).origin : ''; } catch { return ''; } };

/** فحوص سلامة البيانات — دالة نقية على org/ops (تُختبر آليًا) */
export function integrityChecks(org, ops, ctl) {
  const out = []; const add = (id, st, title, detail, items, fix) => out.push({ id, st, title, detail, items: items || [], fix: fix || '' });
  const brIds = new Set((org.branches || []).map(b => b.id));
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  // 1) توازن القيود
  let A = null;
  try {
    A = buildAccounting(org, ops);
    const diff = Math.round((A.totalDebit - A.totalCredit) * 100) / 100;
    const bad = A.entries.filter(e => !e.balanced);
    add('tb', A.balanced ? 'ok' : 'bad', 'توازن القيود وميزان المراجعة', A.balanced ? 'المدين = الدائن في ' + A.entries.length + ' قيدًا' : 'فرق ' + money(diff) + ' · ' + bad.length + ' قيد غير متوازن',
      bad.slice(0, 5).map(e => (e.date || '') + ' — ' + (e.title || e.id)), 'افتح القيد من «المحاسبة ← القيود اليومية» وصحّح سطوره');
    // v56.7 (C4): فروق الهللات — تشخيص فقط ما دام التطابق التام غير مفعّل
    if (!A.strictHal && A.halIssues) add('hal', 'warn', 'فروق تقريب بالهللات', A.halIssues + ' قيدًا متوازنًا بسماح 0.01 لا بالهللات تمامًا',
      A.entries.filter(e => e.halDiff !== 0 || e.subHal > 0).slice(0, 5).map(e => (e.date || '') + ' — ' + (e.title || e.id) + ' (' + (e.halDiff ? 'فرق ' + e.halDiff + ' هللة' : 'كسر أدق من الهللة') + ')'),
      'راجعها قبل تفعيل «التطابق التام بالهللات» من بطاقته في هذه الصفحة');
    if ((A.unknownCodes || []).length) add('codes', 'warn', 'حسابات غير معرّفة في الدليل', A.unknownCodes.length + ' رمز', A.unknownCodes.slice(0, 8), 'أضِفها إلى دليل الحسابات أو صحّح القيود التي تستخدمها');
  } catch (e) { add('tb', 'bad', 'توازن القيود وميزان المراجعة', 'تعذّر بناء القيود: ' + String(e.message || e).slice(0, 120), [], 'أبلغ الدعم الفني بهذه الرسالة'); }
  // 2) إغلاقات عالقة
  const stuck = (ops.closings || []).filter(c => c.status === 'submitted' && (c.date || '') < daysAgo(2));
  add('closings', stuck.length ? 'warn' : 'ok', 'إغلاقات بانتظار التدقيق أكثر من يومين', stuck.length ? stuck.length + ' إغلاق' : 'لا شيء', stuck.slice(0, 5).map(c => (c.branchName || brName(c.branchId)) + ' · ' + c.date), 'اعتمدها أو أعدها للتصحيح من «التدقيق والاعتماد»');
  // 3) أرصدة مخزون سالبة
  try {
    const SB = stockByWh(org, ops); const items = org.items || []; const neg = [];
    Object.entries(SB.byWh || {}).forEach(([w, m]) => Object.entries(m).forEach(([id, q]) => { if (q < -0.0005) neg.push(whName(org, w) + ' · ' + ((items.find(x => x.id === id) || {}).name || id) + ' (' + q3(q) + ')'); }));
    add('stock', neg.length ? 'bad' : 'ok', 'أرصدة مخزون سالبة', neg.length ? neg.length + ' صنف' : 'لا أرصدة سالبة', neg.slice(0, 6), 'صرف أو هدر سُجّل قبل الوارد — سجّل الوارد الناقص أو اعتمد جردًا للمستودع');
  } catch { }
  // 4) فواتير موردين مكررة
  const seen = new Map(), dups = [];
  (ops.invoices || []).forEach(i => { const k = purKey(i); if (!k) return; if (seen.has(k)) dups.push((i.supplierName || '') + ' · رقم ' + i.invoiceNo); else seen.set(k, i); });
  add('dupinv', dups.length ? 'bad' : 'ok', 'فواتير موردين مكررة (نفس المورد والرقم)', dups.length ? dups.length + ' فاتورة' : 'لا تكرار', dups.slice(0, 5), 'احذف النسخة المكررة من «المشتريات ← فواتير الموردين» بعد التأكد');
  // 4ب) v46.8 إغلاقات مكررة: نفس المعرّف مرتين (يُضاعف الإيراد في القيود)، أو فرعٌ ويومٌ بإغلاقين غير مرفوضين.
  //     نموذج الإغلاق يمنع التكرار في الواجهة فقط؛ هذا الفحص يكشف ما يصل للبيانات من مسار آخر (مزامنة، استيراد، جهاز قديم).
  const clIds = new Map(), clDay = new Map(), dupCl = [];
  (ops.closings || []).forEach(c => {
    if (!c || !c.id) return;
    if (clIds.has(c.id)) { dupCl.push('معرّف مكرر · ' + (c.branchName || brName(c.branchId)) + ' · ' + (c.date || '')); return; }
    clIds.set(c.id, 1);
    if (c.status === 'rejected') return;
    const k = c.branchId + '|' + c.date;
    if (clDay.has(k)) dupCl.push((c.branchName || brName(c.branchId)) + ' · ' + (c.date || '') + ' · إغلاقان لليوم نفسه'); else clDay.set(k, 1);
  });
  add('dupclose', dupCl.length ? 'bad' : 'ok', 'إغلاقات مكررة (نفس الفرع واليوم أو نفس المعرّف)', dupCl.length ? dupCl.length + ' حالة' : 'لا تكرار', dupCl.slice(0, 5), 'راجع الإغلاقين من «الإغلاق اليومي ← السجل» وارفض المكرر منهما');
  // 5) سجلات يتيمة (فرع محذوف)
  const orph = [];
  [['closings', 'إغلاق'], ['whMoves', 'حركة مستودع'], ['attendanceEvents', 'حضور'], ['posOrders', 'فاتورة نقطة بيع'], ['transfers', 'توريد']].forEach(([c, ar]) => {
    const n = (ops[c] || []).filter(x => x.branchId && !brIds.has(x.branchId)).length; if (n) orph.push(n + ' ' + ar);
  });
  const emps = (org.employees || []).filter(e => e.status !== 'terminated' && e.branchId && !brIds.has(e.branchId)).length; if (emps) orph.push(emps + ' موظف');
  add('orphans', orph.length ? 'warn' : 'ok', 'سجلات مرتبطة بفرع غير موجود', orph.length ? orph.join('، ') : 'لا شيء', [], 'أعد تفعيل الفرع أو انقل السجلات لفرع قائم');
  // 6) وصفات بمكوّنات محذوفة
  const itemIds = new Set((org.items || []).map(i => i.id));
  // v40.7: يشمل التحضيرات — مرجع لصنف أو تحضيرة محذوفة، أو وصفة دائرية، في المنتجات والتحضيرات
  const brokenRec = [...(org.products || []), ...(org.preps || [])].filter(p => { const R = recipeRaw(org, p.parts); return (p.parts || []).some(pt => pt.itemId && !itemIds.has(pt.itemId)) || R.cycle || R.missing.length > 0 || Object.keys(R.raw).some(id => !itemIds.has(id)); });
  add('recipes', brokenRec.length ? 'warn' : 'ok', 'وصفات بمكوّن محذوف (صنف أو تحضيرة) أو دائرية', brokenRec.length ? brokenRec.length + ' منتج' : 'كل المكوّنات موجودة', brokenRec.slice(0, 5).map(p => p.name), 'عدّل الوصفة من «المخزون ← الوصفات والتكلفة» — التكلفة النظرية ناقصة حتى تصحيحها');
  // 7) طلبات معلّقة قديمة
  const old = daysAgo(3), pend = [];
  const w = (ops.wasteRequests || []).filter(r => r.status === 'pending' && (r.date || '') < old).length; if (w) pend.push(w + ' هدر');
  const cs = (ops.countSessions || []).filter(s => (s.status === 'submitted' || s.status === 'recount') && (s.date || '') < old).length; if (cs) pend.push(cs + ' جرد');
  const po = (ops.purchaseOrders || []).filter(p => p.status === 'pending' && String(p.date || p.at || '').slice(0, 10) < old).length; if (po) pend.push(po + ' أمر شراء');
  const tr = (ops.transfers || []).filter(t => t.status === 'pending' && (t.date || '') < old).length; if (tr) pend.push(tr + ' توريد نقدي');
  add('pending', pend.length ? 'warn' : 'ok', 'طلبات بانتظار القرار أكثر من 3 أيام', pend.length ? pend.join('، ') : 'لا شيء', [], 'تظهر في إشعارات المعتمدين — اعتمدها أو ارفضها');
  // 8) فروع بلا إغلاق حديث
  const lastBy = {}; (ops.closings || []).filter(countedClosing).forEach(c => { if (!lastBy[c.branchId] || c.date > lastBy[c.branchId]) lastBy[c.branchId] = c.date; });
  const silent = (org.branches || []).filter(b => b.isActive !== false && lastBy[b.id] && lastBy[b.id] < daysAgo(3)).map(b => b.name + ' (آخر إغلاق ' + lastBy[b.id] + ')');
  add('silent', silent.length ? 'warn' : 'ok', 'فروع توقفت إغلاقاتها أكثر من 3 أيام', silent.length ? silent.length + ' فرع' : 'كل الفروع تُغلق بانتظام', silent.slice(0, 6), 'تأكد من تشغيل الفرع أو إدخال إغلاقاته المتأخرة');
  // 15) v40.0 — الاعتمادات الموقّعة: معتمد بلا توقيع موثّق (بعد بدء التوقيع) أو عُدّلت أرقامه بعد اعتماده
  if (ctl && ctl.sigs) {
    const bad = [], legacy = [];
    const scan = (kind, list, label) => (list || []).forEach(x => { const v = sigVerify(kind, x, ctl.sigs, ctl.cutover);
      if (v.st === 'tampered' || v.st === 'unsigned') bad.push(label(x) + ' — ' + SIG_BADGE[v.st][1] + (v.stage ? ' (' + (SIG_NAME[v.stage] || v.stage) + ')' : ''));
      else if (v.st === 'legacy') legacy.push(x.id); });
    const brN = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || '';
    scan('closing', ops.closings, x => 'إغلاق ' + brN(x.branchId) + ' ' + x.date);
    scan('waste', ops.wasteRequests, x => 'هدر ' + (x.date || '') + ' ' + money(x.value || 0));
    scan('count', ops.countSessions, x => 'جرد ' + (x.date || ''));
    scan('po', ops.purchaseOrders, x => 'أمر شراء ' + (x.poNo || x.id));
    add('signoffs', bad.length ? 'bad' : 'ok', 'الاعتمادات الموقّعة (هوية + بصمة الأرقام)', bad.length ? bad.length + ' اعتماد بلا توقيع موثّق أو عُدّل بعد اعتماده' : 'كل الاعتمادات منذ ' + (ctl.cutover || 'بدء التوقيع') + ' موقّعة ومطابقة' + (legacy.length ? ' · ' + legacy.length + ' اعتماد أقدم من بدء التوقيع' : ''),
      bad.slice(0, 8), bad.length ? 'اعتماد غير موثّق يعني تعديلًا خارج الواجهة أو من نسخة قديمة، وتغيّر البصمة يعني تعديل أرقام بعد الاعتماد — راجع السجل وأعد التدقيق' : '');
  }
  // 9–12) v38.9 — الالتزامات النظامية والسيولة (ضمن المراجعة والرقابة)
  if (A) {
    const td = today(), cfg = org.cashflowCfg || {};
    // 9) ضريبة القيمة المضافة: التسجيل، والإقرارات المتأخرة، والفترة المنتهية غير المقفلة
    try {
      const V = vatStatus(org, ops, A, td, cfg);
      const taxNo = entityList(org).some(e => String(e.taxNumber || '').trim());
      if (!V.on) add('vat', taxNo ? 'bad' : 'ok', 'ضريبة القيمة المضافة', taxNo ? 'للمنشأة رقم ضريبي والضريبة غير مفعّلة — المبيعات تُسجَّل بلا ضريبة مخرجات' : 'المنشأة غير مسجلة ضريبيًا', [], taxNo ? 'فعّلها من «المحاسبة ← الضريبة» بتاريخ التسجيل الفعلي' : '');
      else {
        const late = V.unpaid.filter(u => u.due < td), soon = V.unpaid.filter(u => u.due >= td);
        const ended = V.end && V.end < td;
        const st = late.length ? 'bad' : (ended || !V.months) ? 'warn' : 'ok';
        const det = late.length ? late.length + ' إقرار تجاوز موعد السداد' : ended ? 'فترة انتهت ولم تُقفل' : !V.months ? 'دورية الإقرار غير محددة' : 'الإقرارات منتظمة' + (soon.length ? ' · ' + soon.length + ' بانتظار السداد' : '');
        add('vat', st, 'ضريبة القيمة المضافة — الإقرار والسداد', det,
          [...late.map(u => u.from + ' ← ' + u.to + ': ' + money(u.rem) + ' (استحق ' + u.due + ')'), ...soon.map(u => u.from + ' ← ' + u.to + ': ' + money(u.rem) + ' يستحق ' + u.due), ...(ended ? ['الفترة ' + V.start + ' ← ' + V.end + ' — تُقدَّم وتُسدَّد قبل ' + V.due] : [])],
          late.length ? 'سدّد من «المحاسبة ← الضريبة» — غرامة التأخير 5% عن كل شهر أو جزء منه' : ended ? 'أقفل الفترة من «المحاسبة ← الضريبة»' : !V.months ? 'حدّد الدورية من «التدفق النقدي ← الإعداد» أو أقفل أول فترة' : '');
      }
    } catch { }
    // 10) التأمينات الاجتماعية: رصيد 2202 بعد موعد التحويل (15 من الشهر التالي)
    try {
      const bal = Math.round(-((A.accounts.find(a => a.code === '2202') || {}).balance || 0) * 100) / 100;
      const lm = [...new Set((ops.ledgerEntries || []).filter(x => x.kind === 'salary_payout').map(x => x.month))].sort().pop();
      const due = lm ? (() => { const [y, m] = lm.split('-').map(Number); return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10); })() : '';
      if ((org.gosiCfg || {}).enabled || bal > 0.004) add('gosi', bal > 0.004 && due && due < td ? 'bad' : 'ok', 'التأمينات الاجتماعية المستحقة', bal > 0.004 ? money(bal) + (due ? (due < td ? ' — تجاوزت موعد ' + due : ' — تُحوَّل قبل ' + due) : '') : 'لا رصيد مستحق', [], bal > 0.004 && due < td ? 'حوّلها للتأمينات وسجّل السداد بقيد من 2202' : '');
    } catch { }
    // 11) الزكاة: موعد الإقرار والسداد (120 يومًا من نهاية السنة المالية)
    try {
      const fy = cfg.fyEnd || ((org.yearEnd || {}).closeDate ? String(org.yearEnd.closeDate).slice(5, 10) : '');
      if (/^\d\d-\d\d$/.test(fy)) {
        const y = Number(td.slice(0, 4)); const cand = [y - 1, y].map(x => x + '-' + fy).filter(x => x < td).sort().pop();
        if (cand) { const d = new Date(cand + 'T12:00:00'); d.setDate(d.getDate() + 120); const due = isoD(d);
          const has = (cfg.sched || []).some(s => s.kind === 'zakat' && s.date >= cand);
          const left = Math.round((Date.parse(due) - Date.parse(td)) / 864e5);
          add('zakat', has || left < 0 ? 'ok' : left <= 30 ? 'bad' : 'warn', 'الزكاة — السنة المنتهية ' + cand, has ? 'مجدولة في التدفق النقدي' : left < 0 ? 'انقضى موعد ' + due + ' — تحقق من تقديم الإقرار' : 'الإقرار والسداد قبل ' + due + ' (متبقٍّ ' + left + ' يومًا)', [], has ? '' : 'احسبها من «المحاسبة ← الزكاة» وأضفها التزامًا مجدولًا في «التدفق النقدي ← الإعداد»'); }
      } else add('zakat', 'warn', 'الزكاة — نهاية السنة المالية', 'غير محددة — لا يمكن تتبّع موعد الإقرار', [], 'حدّدها من «التدفق النقدي ← الإعداد» أو بإقفال السنة من المحاسبة');
    } catch { }
    // 13) v39.1 — الوثائق الرسمية وعقود الإيجار: منتهية أو فات موعد إشعار المؤجر
    try {
      const C = complianceItems(org, ops, { A, today: td }).items.filter(x => x.cat === 'doc' || x.cat === 'lease');
      const bad = C.filter(x => x.sev === 'bad'), warn = C.filter(x => x.sev === 'warn' && x.cat === 'doc');
      if ((org.documents || []).length) add('docs', bad.length ? 'bad' : warn.length ? 'warn' : 'ok', 'الوثائق الرسمية وعقود الإيجار', bad.length ? bad.length + ' بند عاجل' : warn.length ? warn.length + ' وثيقة تنتهي قريبًا' : 'كل الوثائق سارية',
        [...bad, ...warn].slice(0, 6).map(x => x.title + ' — ' + x.sub), bad.length || warn.length ? 'جدّدها وحدّث تاريخها في «المستندات والأرشيف ← مركز المستندات»' : '');
      else add('docs', 'warn', 'الوثائق الرسمية', 'لا وثائق مسجّلة — السجل التجاري والرخص وعقود الإيجار بلا تتبّع لانتهائها', [], 'سجّلها في «مركز المستندات» بتواريخ انتهائها');
    } catch { }
    // 14) v39.1 — التسوية البنكية: كل بنك بحركة يحتاج مذكرة تسوية عن الشهر المنتهي
    try {
      const pm = (() => { const d = new Date(td + 'T12:00:00'); d.setDate(0); return isoD(d); })();
      const accs = ['1201', ...branchBanks(org).map(b => b.code)];
      const late = accs.filter(code => A.entries.some(e => (e.date || '') <= pm && (e.date || '') > daysAgo(120) && e.lines.some(l => l.code === code)))
        .filter(code => !(ops.bankRecs || []).some(r => (r.acc || '1201') === code && (r.date || '') >= pm));
      add('bankrec', late.length ? 'warn' : 'ok', 'التسوية البنكية الشهرية', late.length ? late.length + ' بنك بلا تسوية حتى ' + pm : 'البنوك مسوّاة حتى ' + pm,
        late.map(c => c === '1201' ? 'البنك التجميعي (1201)' : ((branchBanks(org).find(b => b.code === c) || {}).name || c)), late.length ? 'ارفع كشف الشهر في «المحاسبة ← التسوية البنكية» واحفظ مذكرة التسوية' : '');
    } catch { }
    // 12) السيولة: عجز متوقع خلال 13 أسبوعًا
    try {
      const C = cashForecast(org, ops, { A, today: td });
      const w = C.weeks.find(x => x.bal < -0.004), wl = C.weeks.find(x => x.balLo < -0.004);
      add('cash', w && w.k < 4 ? 'bad' : (w || wl) ? 'warn' : 'ok', 'السيولة — التدفق النقدي المتوقع', w ? 'عجز متوقع في الأسبوع ' + (w.k + 1) + ' (' + money(w.bal) + ')' : wl ? 'عجز في الحالة المتحفظة بالأسبوع ' + (wl.k + 1) : 'لا عجز متوقع خلال 13 أسبوعًا · أدنى رصيد ' + money(C.min.v),
        C.notes.filter(n => n.sev === 'bad').map(n => n.msg).slice(0, 4), (w || wl) ? 'راجع «التقارير ← التدفق النقدي» ودبّر السيولة مبكرًا' : '');
    } catch { }
  }
  return out;
}

/** تجميع سجلات الأخطاء حسب نوعها */
export function groupErrors(rows) {
  const G = {};
  rows.forEach(r => { const g = G[r.sig] = G[r.sig] || { sig: r.sig, msg: r.msg, where: r.where, stack: r.stack, n: 0, first: r.at, last: r.at, users: new Set(), branches: new Set(), vers: new Set(), devices: new Set(), ids: [] };
    g.n++; g.ids.push(r.id); if (r.at < g.first) g.first = r.at; if (r.at > g.last) g.last = r.at;
    if (r.email) g.users.add(r.email); if (r.branchId) g.branches.add(r.branchId); if (r.v) g.vers.add(r.v); if (r.device) g.devices.add(r.device); });
  return Object.values(G).map(g => ({ ...g, users: [...g.users], branches: [...g.branches], vers: [...g.vers], devices: [...g.devices] })).sort((a, b) => b.last.localeCompare(a.last));
}

export function SystemMaintenance({ org, ops, me, commit, commitOrg, say }) {
  // v40.0: التوقيعات وتاريخ بدء التوقيع من Firestore (القواعد تحدد ما يُقرأ)
  const [ctl, setCtl] = useState(null);
  const [rel, setRel] = useState(null);
  const [legacyN, setLegacyN] = useState(null);
  useEffect(() => { let dead = false; (async () => { const r = await loadRelease(); const sg = await loadSignoffs(me, (org.branches || []).map(b => b.id), true);
    if (!dead) { setRel(r); if (sg) setCtl({ sigs: sg, cutover: (r && r.cutover) || '' }); }
    try { const pu = await cloud.get(KEYS.pulse, { presence: {}, audit: [] }); if (!dead) setLegacyN(((pu || {}).audit || []).length); } catch { } })(); return () => { dead = true; }; }, [me, org.branches]);
  const checks = useMemo(() => integrityChecks(org, ops, ctl), [org, ops, ctl]);
  const isAdm = !!(ROLES[me && me.role] || {}).admin;
  const migrate = async () => {
    if (!window.confirm('ترحيل سجل التدقيق القديم (' + legacyN + ' إدخال) إلى السجل المحصّن موسومًا «قديم — هوية غير موثّقة»، ثم تفريغه من مستند النبض. متابعة؟')) return;
    setBusy(true);
    try {
      const F = await qrFs(); if (!F) { setBusy(false); return say('قاعدة البيانات السحابية غير مفعّلة', 'no'); }
      const pu = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || { presence: {}, audit: [] };
      const list = pu.audit || []; const s2 = (v, n) => String(v == null ? '' : v).slice(0, n);
      for (let i = 0; i < list.length; i += 400) { const b = F.writeBatch(F.db);
        list.slice(i, i + 400).forEach(e => b.set(F.doc(F.collection(F.db, 'audit_log')), { at: F.serverTimestamp(), email: 'legacy', role: s2(e.userRole, 40), userName: s2(e.userName, 120), title: s2(e.title || e.actionType || 'عملية', 200),
          details: s2((e.branchName ? e.branchName + ' · ' : '') + (e.details || ''), 1000), actionType: s2(e.actionType, 40), targetType: s2(e.targetType, 40), targetId: s2(e.targetId, 300), cv: APP_CV, legacy: true, origAt: s2(e.timestamp || (e.at ? new Date(e.at).toISOString() : ''), 40) }));
        await b.commit(); }
      for (let i = 0; i < 4; i++) { const cur = (await cloud.get(KEYS.pulse, { presence: {}, audit: [] })) || {}; if ((await cloud.setIfUnchanged(KEYS.pulse, { ...cur, audit: [] })) === 'ok') break; }
      setLegacyN(0); say('رُحّل ' + list.length + ' إدخال إلى السجل المحصّن وفُرّغ النبض ✓');
    } catch (e) { say('تعذّر الترحيل: ' + (/permission/i.test(String(e && e.message)) ? 'للمدير فقط' : 'تحقق من الاتصال'), 'no'); }
    setBusy(false);
  };
  const [srv, setSrv] = useState(null);
  const [errs, setErrs] = useState(null);
  const [open, setOpen] = useState(null);
  const [snapOk, setSnapOk] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  // v41.7 — أرشفة فواتير نقطة البيع القديمة: كتابة الأرشيف ← التحقق قراءةً ← الحذف من التشغيل
  const AP = useMemo(() => archivePlan(org, ops), [org, ops]);
  const [arcBusy, setArcBusy] = useState(false);
  const doArchive = async () => {
    if (!AP.n || !window.confirm('أرشفة ' + AP.n + ' فاتورة نقطة بيع (أشهر مقفلة أقدم من ' + AP.cutoff + ')؟\n\nتُنسخ إلى أرشيف سحابي لكل فرع وسنة وتُتحقق ثم تُزال من بيانات التشغيل اليومية. الإغلاقات والقيود لا تتغير.')) return;
    setArcBusy(true); let done = 0;
    try {
      for (const g of AP.groups) {
        const set = new Set(g.ids), recs = (ops.posOrders || []).filter(o => set.has(o.id));
        const cur = (await cloud.get(g.key, { orders: [] })) || { orders: [] }; const have = new Set((cur.orders || []).map(o => o.id));
        const merged = [...(cur.orders || []), ...recs.filter(o => !have.has(o.id))];
        if (!(await cloud.set(g.key, { orders: merged, branchId: g.branchId, year: g.year, updatedAt: nowISO() }))) throw new Error('تعذّر حفظ أرشيف ' + g.branch + ' ' + g.year);
        const back = (await cloud.get(g.key, null)) || {}; const bh = new Set((back.orders || []).map(o => o.id));
        if (!g.ids.every(id => bh.has(id))) throw new Error('التحقق من أرشيف ' + g.branch + ' ' + g.year + ' لم يكتمل — لم يُحذف شيء منه');
        const log = { id: uid('ar'), at: nowISO(), by: me?.name || '', branchId: g.branchId, branch: g.branch, year: g.year, n: g.n, from: g.from, to: g.to, total: g.total, key: g.key };
        const ok = await commit(d => ({ ...d, posOrders: (d.posOrders || []).filter(o => !set.has(o.id)), archLog: [log, ...(d.archLog || [])] }),
          { actionType: 'update', targetType: 'system_settings', targetId: g.key, title: 'أرشف فواتير نقطة البيع', details: g.branch + ' · ' + g.year + ' · ' + g.n + ' فاتورة · ' + money(g.total) });
        if (ok === false) throw new Error('تعذّر تحديث بيانات التشغيل — الأرشيف محفوظ ولم يُحذف شيء'); done += g.n;
      }
      say('أُرشفت ' + done + ' فاتورة ✓ — تبقى للاطلاع من «الأرشيف»');
    } catch (e) { say((e && e.message) || 'توقفت الأرشفة', 'no'); } finally { setArcBusy(false); }
  };
  const viewArch = async (l) => { const a = (await cloud.get(l.key, null)) || {}; const os = (a.orders || []).slice().sort((x, y) => String(x.at || x.date).localeCompare(String(y.at || y.date)));
    printA4(org, 'أرشيف فواتير نقطة البيع — ' + (l.branch || l.branchId) + ' ' + l.year, os.length + ' فاتورة', `<table><thead><tr><th>الرقم</th><th>التاريخ</th><th>الإجمالي</th><th>الضريبة</th><th>الحالة</th><th>الكاشير</th></tr></thead><tbody>${os.map(o => `<tr><td>${o.no || o.id}</td><td class="n">${dtLocal(o.at || o.date)}</td><td class="n">${money(o.total || 0)}</td><td class="n">${money(o.vat || 0)}</td><td>${o.status === 'void' ? 'ملغاة' : 'مدفوعة'}</td><td>${o.by || ''}</td></tr>`).join('')}</tbody></table>`) || say('اسمح بالنوافذ المنبثقة للطباعة', 'no'); };
  const [busy, setBusy] = useState(false);
  const local = (() => { try { return JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); } catch { return []; } })();
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || {}).name || id;
  const syncErrs = [[KEYS.core, 'المستند المركزي'], [KEYS.org, 'الإعدادات'], ...(org.branches || []).map(b => [brKey(b.id), 'فرع ' + b.name])].map(([k, l]) => ({ l, e: cloud.readErr(k) })).filter(x => x.e);

  const pingServer = async () => {
    const base = serverBase(); if (!base) return setSrv({ st: 'warn', t: 'رابط الخادم غير مضبوط في إعدادات النشر' });
    setSrv({ st: 'run', t: 'جارٍ الفحص…' }); const t0 = Date.now();
    try { const r = await fetch(base + '/api/health', { cache: 'no-store' }); const ms = Date.now() - t0;
      setSrv(r.ok ? { st: ms > 8000 ? 'warn' : 'ok', t: (ms > 8000 ? 'يعمل لكنه كان نائمًا — ' : 'يعمل — ') + (ms / 1000).toFixed(1) + ' ث' } : { st: 'bad', t: 'يرد بخطأ HTTP ' + r.status }); }
    catch { setSrv({ st: 'bad', t: 'لا يستجيب' }); }
  };
  const loadErrors = async () => {
    setErrs({ loading: true });
    try {
      const F = await qrFs(); if (!F) return setErrs({ err: 'قاعدة البيانات السحابية غير مفعّلة' });
      const q = F.query(F.collection(F.db, 'client_errors'), F.orderBy('at', 'desc'), F.limit(500));
      const s = await F.getDocs(q);
      const rows = s.docs.map(d => { const x = d.data(); return { id: d.id, ...x, at: x.at && x.at.toDate ? x.at.toDate().toISOString() : String(x.at || '') }; });
      setErrs({ rows, groups: groupErrors(rows) });
    } catch (e) { setErrs({ err: /permission/i.test(String(e && e.message)) ? 'قراءة السجل لمسؤول النظام فقط' : 'تعذّر تحميل السجل' }); }
  };
  const delGroup = async (g) => {
    if (!window.confirm('حذف ' + g.n + ' سجل لهذا الخطأ؟ (بعد إصلاحه أو التأكد أنه غير مهم)')) return;
    setBusy(true);
    try { const F = await qrFs(); for (let i = 0; i < g.ids.length; i += 400) { const b = F.writeBatch(F.db); g.ids.slice(i, i + 400).forEach(id => b.delete(F.doc(F.db, 'client_errors', id))); await b.commit(); } say('حُذفت السجلات ✓'); await loadErrors(); }
    catch { say('تعذّر الحذف', 'no'); }
    setBusy(false);
  };
  useEffect(() => { pingServer(); loadErrors(); snapAll().then(a => setSnapOk(a.some(x => x.key === 'day-' + today()))).catch(() => setSnapOk(false)); }, []);   // eslint-disable-line

  const bad = checks.filter(c => c.st === 'bad').length, warn = checks.filter(c => c.st === 'warn').length;
  const errN = errs && errs.groups ? errs.groups.filter(g => g.last >= daysAgo(7)).length : null;
  const svc = [
    { k: 'الإصدار', st: 'ok', t: APP_VER },
    { k: 'خادم المنصّة (التحليل الذكي والفوترة)', st: srv ? srv.st : 'run', t: srv ? srv.t : '…', act: <button className="btn sm gh" onClick={pingServer}><RefreshCw size={12} /></button> },
    { k: 'المزامنة مع قاعدة البيانات', st: syncErrs.length ? 'bad' : 'ok', t: syncErrs.length ? syncErrs.length + ' مستند يتعذّر قراءته: ' + syncErrs.map(x => x.l).join('، ') : 'كل المستندات تُقرأ' },
    { k: 'اللقطة اليومية (هذا الجهاز)', st: snapOk == null ? 'run' : snapOk ? 'ok' : 'warn', t: snapOk == null ? '…' : snapOk ? 'محفوظة اليوم' : 'لم تُحفظ اليوم بعد' },
    { k: 'أخطاء الأجهزة (آخر 7 أيام)', st: errN == null ? 'run' : errN ? 'warn' : 'ok', t: errN == null ? '…' : errN ? errN + ' نوع خطأ' : 'لا أخطاء' }
  ];
  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid g4">
        {[['خلل', bad, '#D9544D'], ['تنبيه', warn, '#E0A458'], ['فحص سليم', checks.length - bad - warn, '#4FB286'], ['أنواع أخطاء الأجهزة (7 أيام)', errN == null ? '…' : errN, '#5B93C4']].map(([l, v, c]) => (
          <div key={l} className="kpi" style={{ borderInlineStartColor: c }}><div className="kpi-l">{l}</div><div className="kpi-v num">{v}</div></div>))}
      </div>

      {/* v40.0 — أساس الرقابة: الإصدار الإلزامي وسجل التدقيق */}
      <div className="card">
        <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />أساس الرقابة</div></div>
        <div className="mt-list">
          <div className={'mt-row ' + (rel && rel.minCv ? 'ok' : 'warn')}><span className={'mt-dot ' + (rel && rel.minCv ? 'ok' : 'warn')} /><span className="mt-k">التحديث الإجباري</span>
            <span className="mt-t">{rel == null ? 'غير متاح (ليس وضع Firestore)' : rel.minCv ? 'الحد الأدنى v' + Math.floor(rel.minCv / 10000) + '.' + Math.floor(rel.minCv % 10000 / 100) + (rel.minCv % 100 ? '.' + (rel.minCv % 100) : '') + ' · هذا الجهاز ' + APP_VER + ' — الأجهزة الأقدم لا تحفظ' : 'لم يُفعَّل بعد — يُفعَّل تلقائيًا عند دخول المدير بهذا الإصدار'}</span></div>
          <div className={'mt-row ' + (rel && rel.cutover ? 'ok' : 'warn')}><span className={'mt-dot ' + (rel && rel.cutover ? 'ok' : 'warn')} /><span className="mt-k">بدء التوقيع الموثّق</span>
            <span className="mt-t">{rel && rel.cutover ? 'منذ ' + rel.cutover + ' — كل اعتماد بعده يحمل توقيعًا ببصمة الأرقام' : '—'}</span></div>
          <div className={'mt-row ' + (rel == null || legacyN ? 'warn' : 'ok')}><span className={'mt-dot ' + (rel == null || legacyN ? 'warn' : 'ok')} /><span className="mt-k">سجل التدقيق</span>
            <span className="mt-t">{rel == null ? 'غير متاح (ليس وضع Firestore) — السجل محلي غير محصّن' : legacyN ? legacyN + ' إدخال في السجل القديم (قابل للعبث ومقروء للفروع) — رحّله' : 'محصّن: لا يُعدَّل ولا يُحذف، ولا يقرؤه موظفو الفروع'}</span>
            {legacyN > 0 && isAdm && <button className="btn sm pri" disabled={busy} onClick={migrate}>ترحيل وتفريغ</button>}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><Server size={15} color="var(--brass)" />حالة الخدمات</div></div>
        <div className="mt-list">{svc.map(s => <div key={s.k} className={'mt-row ' + s.st}><span className={'mt-dot ' + s.st} /><span className="mt-k">{s.k}</span><span className="mt-t">{s.t}</span>{s.act || null}</div>)}</div>
      </div>

      <div className="card">
        <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />فحوص سلامة البيانات</div>
          <span className={'badge ' + (bad ? 'b-rose' : warn ? 'b-amber' : 'b-mint')}>{bad ? bad + ' خلل' : warn ? warn + ' تنبيه' : 'كل الفحوص سليمة'}</span></div>
        <div className="mt-list">{checks.map(c => (
          <div key={c.id} className={'mt-check ' + c.st}>
            <button type="button" className="mt-ch" onClick={() => setOpen(open === c.id ? null : c.id)}>
              <span className={'badge ' + ST[c.st][0]}>{ST[c.st][1]}</span><b>{c.title}</b><span className="mt-t">{c.detail}</span>
            </button>
            {open === c.id && c.st !== 'ok' && <div className="mt-det">
              {c.items.length > 0 && <ul>{c.items.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              {c.fix && <div className="note">العلاج: {c.fix}</div>}
            </div>}
          </div>))}</div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn sm" onClick={() => setShowDocs(v => !v)}><HardDrive size={13} />{showDocs ? 'إخفاء' : 'فحص مستندات قاعدة البيانات وأحجامها'}</button>
        </div>
      </div>
      {showDocs && <CloudHealth org={org} say={say} commit={commit} me={me} auto />}
      <ClosingRecordsCard org={org} ops={ops} me={me} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <PosRecordsCard org={org} ops={ops} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <MktBranchCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <GrowthRecordsCard org={org} ops={ops} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <LoyPiiCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <PosGlCard org={org} ops={ops} me={me} commit={commit} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <CtlBarCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <EclCfgCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <Batch6Card org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <ImpairCfgCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <DepBrCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <LateRetCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <DsRouteCard org={org} ops={ops} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <DsPreCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <DsDupCard org={org} ops={ops} me={me} commit={commit} say={say} canPost={jeOwner(me) || ['accountant', 'finance_department'].includes(me && me.role)} />
      <CvApprCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <WhtCard org={org} ops={ops} me={me} commitOrg={commitOrg} say={say} />
      <MktCtlCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <FinStrictCard org={org} ops={ops} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <LedgerCard org={org} ops={ops} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <JournalRecordsCard org={org} ops={ops} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <WorkflowsCard org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
      <PosSplitCard org={org} ops={ops} me={me} say={say} isAdm={isAdm} commit={commit} />
      <div className="card">
        <div className="card-h"><div className="card-t"><HardDrive size={15} color="var(--brass)" />أرشفة فواتير نقطة البيع القديمة</div>{isAdm && AP.n > 0 && <button className="btn sm pri" disabled={arcBusy} onClick={doArchive}>{arcBusy ? 'جارٍ الأرشفة…' : 'أرشفة ' + AP.n + ' فاتورة'}</button>}</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>قرارك: الفواتير التفصيلية الأقدم من 12 شهرًا (قبل {AP.cutoff}) وفي أشهر مقفلة محاسبيًا فقط. الإغلاقات والقيود لا تُمس.{AP.unlocked ? ' · ' + AP.unlocked + ' فاتورة قديمة في أشهر غير مقفلة لا تُؤرشَف حتى تُقفل.' : ''}</div>
        {AP.groups.length ? <div className="me-list">{AP.groups.map(g => <div key={g.key} className="me-row"><span className="me-a"><b>{g.branch} — {g.year}</b><small>{g.from} إلى {g.to} · {money(g.total)}</small></span><span className="me-b"><b className="num">{g.n}</b><small>فاتورة</small></span></div>)}</div> : <div className="empty">لا فواتير مستحقة للأرشفة الآن.</div>}
        {(ops.archLog || []).length > 0 && <><div className="lbl" style={{ margin: '8px 0 4px' }}>الأرشيف</div><div className="me-list">{(ops.archLog || []).slice(0, 12).map(l => <div key={l.id} className="me-row"><span className="me-a"><b>{l.branch || l.branchId} — {l.year}</b><small>{l.n} فاتورة · {l.from} إلى {l.to} · {l.by} · {String(l.at).slice(0, 10)}</small></span><span className="me-b"><button className="btn sm gh" onClick={() => viewArch(l)}>عرض</button></span></div>)}</div></>}
      </div>
      {(() => { const F = dataFootprint(ops); const kb = (b) => (b >= 1048576 ? (Math.round(b / 104857.6) / 10) + ' MB' : Math.round(b / 1024) + ' KB');
        const AR = { notifications: 'التنبيهات', hrSignDocs: 'مستندات التوقيع (الموارد البشرية)', branchPartners: 'شركاء الفروع', hrCorrective: 'الإجراءات التصحيحية', mktCampaigns: 'الحملات التسويقية', closings: 'الإغلاقات اليومية', posOrders: 'فواتير نقطة البيع', stockMoves: 'حركات المخزون (الرئيسي)', whMoves: 'حركات مستودعات الفروع', ledgerEntries: 'قيود الحسابات الجارية', invoices: 'فواتير الموردين',
          purchaseOrders: 'أوامر الشراء', attendanceEvents: 'سجل الحضور', productSales: 'مبيعات المنتجات المستوردة', posImports: 'أيام نقطة البيع المستوردة', transfers: 'التحويلات', actions: 'الإجراءات', posShifts: 'ورديات نقطة البيع', salesInvoices: 'فواتير المبيعات', journalEntries: 'القيود اليدوية' };
        return <div className="card">
          <div className="card-h"><div className="card-t"><HardDrive size={15} color="var(--brass)" />حجم البيانات ونموها</div></div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>الإجمالي المحمَّل على الأجهزة <b className="num">{kb(F.tot.bytes)}</b> · ينمو <b className="num">{kb(F.tot.growth)}</b> شهريًا (متوسط {F.months.slice().reverse().join('، ')}) · بعد 12 شهرًا بالمعدل الحالي ≈ <b className="num">{kb(F.tot.proj12)}</b></div>
          <div className="tbl-wrap"><table className="tb tb-fp"><thead><tr><th>المجموعة</th><th>السجلات</th><th>الحجم</th><th>نمو شهري</th><th>بعد 12 شهرًا</th><th>أقدم سجل</th></tr></thead>
            <tbody>{F.rows.slice(0, 12).map(r => <tr key={r.key}><td>{AR[r.key] || r.key}</td><td className="num">{r.n.toLocaleString('en-US')}</td><td className="num">{kb(r.bytes)}</td><td className="num">{r.growth ? kb(r.growth) : '—'}</td><td className="num">{kb(r.proj12)}</td><td className="num">{r.oldest || '—'}</td></tr>)}</tbody></table></div>
          <div className="note" style={{ marginTop: 8 }}>قياس فعلي لما تحمله الأجهزة من بيانات التشغيل؛ النمو من تواريخ السجلات نفسها. الأرشفة (نقل القديم إلى أرشيف لا يُحمَّل يوميًا) قرارٌ يحدّد: ما يُؤرشَف، ومن أي عمر، ومدة الاحتفاظ النظامية — ولا تُنفَّذ قبل اعتماده.</div>
        </div>; })()}

      <div className="card">
        <div className="card-h"><div className="card-t"><Bug size={15} color="var(--brass)" />سجل أخطاء الأجهزة</div>
          <button className="btn sm gh" disabled={errs && errs.loading} onClick={loadErrors}><RefreshCw size={12} />تحديث</button></div>
        {!errs || errs.loading ? <div className="empty">جارٍ التحميل…</div> : errs.err ? <div className="note">{errs.err}</div>
          : !errs.groups.length ? <div className="empty">لا أخطاء مسجّلة من أي جهاز ✓</div> : <div className="mt-list">{errs.groups.map(g => (
            <div key={g.sig} className="mt-err">
              <div className="mt-err-h"><b className="mt-msg" dir="ltr">{g.msg}</b><span className="badge b-amber num">×{g.n}</span></div>
              <small>{g.where ? 'في: ' + g.where + ' · ' : ''}آخر مرة <span className="dt">{dtLocal(g.last)}</span> · {g.users.length} مستخدم{g.branches.length ? ' · ' + g.branches.map(brName).join('، ') : ''} · {g.vers.join('، ')}</small>
              <details><summary>التفاصيل التقنية</summary><pre dir="ltr">{(g.stack || '').slice(0, 1500)}</pre><small dir="ltr">{g.devices.join(' | ')}</small></details>
              <div className="row" style={{ gap: 6, marginTop: 4 }}><button className="btn sm gh" disabled={busy} onClick={() => delGroup(g)}><Trash2 size={12} />حذف بعد المعالجة</button></div>
            </div>))}</div>}
        <div className="note" style={{ marginTop: 8 }}>تصل هنا أخطاء كل الأجهزة بعد تسجيل الدخول — مجمّعة حسب نوعها، بلا أي بيانات مالية. أخطاء الشبكة المؤقتة لا تُسجَّل. أرسل نوع الخطأ للدعم الفني لإصلاحه.</div>
        {local.length > 0 && <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer', fontSize: 12.5 }}>أخطاء هذا الجهاز ({local.length})</summary>
          <div className="mt-list" style={{ marginTop: 6 }}>{local.slice(0, 10).map((x, i) => <div key={i} className="mt-err"><b dir="ltr" className="mt-msg">{x.msg}</b><small>{dtLocal(x.at || '')} · {x.where} · {x.v}</small></div>)}</div></details>}
      </div>
    </div>);
}

/* v56.4 — MUKTASAB POS الدفعة 2a: فواتير نقطة البيع سجلات مستقلة محمية (نسخ موازٍ — docs/pos/POS_DATABASE_DESIGN.md)
   المستند يبقى المصدر؛ التفعيل ينسخ كل فاتورة جديدة/إلغاء بالخلفية، و«نسخ الفواتير القائمة» للتاريخ، و«مطابقة» تكشف أي فرق. */
/* v56.9 (D1) + v56.10 (D2) — دفتر القيود المخزّن: القيد الافتتاحي وقيود الإغلاقات المعتمدة من 2026-01-01 تُحفظ مرة برقم ثابت JV-<السنة>-<تسلسل>.
   معطّل افتراضيًا. الترحيل يدوي هنا (الناقص فقط، بترتيب التاريخ)، والمطابقة تكشف الناقص والمختلف والزائد. القراءة تبقى من المحرك. */
function LedgerCard({ org, ops, commitOrg, say, isAdm }) {
  const on = flOn(org); const [busy, setBusy] = useState(''); const [rep, setRep] = useState(null);
  const lvl = flLvl(org);
  const { scope, uncl } = useMemo(() => { try { const A = buildAccounting(org, ops); return { scope: flScope(ops, A, lvl), uncl: flUnclassified(A) }; } catch { return { scope: [], uncl: [] }; } }, [org, ops, lvl]);
  // v56.11 (D3): توسيع النطاق مجموعةً بعد مجموعة بالترتيب المعتمد — فقط بعد مطابقة كاملة للمستوى الحالي
  const widen = async () => {
    if (!isAdm || lvl >= FL_GROUPS.length) return;
    if (!rep || !rep.ok) return say('طابق المستوى الحالي أولًا حتى «✓ متطابق»', 'no');
    const g = FL_GROUPS[lvl];
    if (!window.confirm('إضافة «' + g.label + '» إلى الدفتر المخزّن؟ بعدها «مطابقة» ثم «ترحيل الناقص».')) return;
    const ok = await commitOrg(o => ({ ...o, ledger: { ...(o.ledger || {}), lvl: lvl + 1 } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'ledger', title: 'وسّع نطاق الدفتر المخزّن', details: g.label });
    if (ok) { setRep(null); say('أُضيفت: ' + g.label); }
  };
  // v56.14 (D4 — قرار المالك): ميزان المراجعة والقوائم من الدفتر — بعد ضم المجموعات الست ومطابقة كاملة فقط؛ والعودة فورية
  const rd = flReadOn(org);
  const setRead = async (v) => {
    if (!isAdm) return;
    if (v && !(lvl === FL_GROUPS.length && rep && rep.ok)) return say('ضمّ المجموعات الست وطابق حتى «✓ متطابق» أولًا', 'no');
    if (v && !window.confirm('ميزان المراجعة والقوائم المالية (للفترات من ' + FL_START + ') ستُقرأ من الدفتر المخزّن بأرقامه الثابتة. بقية التقارير والإقرار الضريبي من المحرك كما هي. متابعة؟')) return;
    const ok = await commitOrg(o => ({ ...o, ledger: { ...(o.ledger || {}), read: !!v, ...(v ? { readAt: nowISO() } : { readOffAt: nowISO() }) } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'ledger', title: v ? 'حوّل قراءة الميزان والقوائم إلى الدفتر المخزّن' : 'أعاد قراءة الميزان والقوائم إلى المحرك' });
    if (ok) say(v ? 'الميزان والقوائم من الدفتر المخزّن ✓' : 'عادت القراءة إلى المحرك');
  };
  const correct = async () => {
    const n = (rep.pairs || []).length + rep.extra.length;
    if (!window.confirm('تصحيح ' + n + ' قيدًا: يُعكس كل قيد مرحّل تغيّر مصدره (أو زال) بقيد عكسي برقم جديد، ثم يُرحَّل القيد الصحيح بالإصدار التالي.\nلا يُعدَّل ولا يُحذف أي قيد. الفترات المقفلة لا تُصحَّح حتى تُفتح.')) return;
    setBusy('fix'); const r = await flCorrect(rep, fpLockedTo(org), (i, t) => setBusy('fix ' + i + '/' + t)); setBusy('');
    if (r.err) return say(r.err, 'no');
    await logAudit({ actionType: 'update', targetType: 'system_settings', targetId: 'ledger', title: 'صحّح قيودًا في الدفتر المخزّن بقيود عكسية', details: 'عكس ' + r.rev + ' · إصدار جديد ' + r.neu + (r.locked ? ' · في فترة مقفلة ' + r.locked : '') + (r.fail ? ' · تعذّر ' + r.fail + ' (' + r.lastErr + ')' : '') });
    say('عُكس ' + r.rev + ' ورُحّل ' + r.neu + ' بالإصدار التالي' + (r.locked ? ' · ' + r.locked + ' في فترة مقفلة لم تُصحَّح' : '') + (r.fail ? ' · تعذّر ' + r.fail : ''), r.fail || r.locked ? 'no' : 'ok'); check();
  };
  const toggle = async () => {
    if (!isAdm) return;
    const ok = await commitOrg(o => ({ ...o, ledger: on ? { ...(o.ledger || {}), on: false, offAt: nowISO() } : { ...(o.ledger || {}), on: true, since: (o.ledger || {}).since || nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'ledger', title: on ? 'أوقف دفتر القيود المخزّن' : 'فعّل دفتر القيود المخزّن' });
    if (ok) { setRep(null); say(on ? 'أُوقف الدفتر المخزّن — القيود المحفوظة باقية' : 'فُعّل — اضغط «مطابقة» ثم «ترحيل الناقص»'); }
  };
  const check = async () => {
    setBusy('check'); const recs = await flLoad(); setBusy('');
    if (recs == null) return say('المطابقة تعمل في وضع Firestore فقط', 'no');
    if (recs.err) return say('تعذّر قراءة الدفتر: ' + recs.err, 'no');
    setRep(flCompare(scope, recs));
  };
  const post = async () => {
    if (!rep || !rep.missing.length) return;
    const lk = fpLockedTo(org), old = rep.missing.filter(e => String(e.date) <= lk).length;
    if (!window.confirm('ترحيل ' + rep.missing.length + ' قيدًا إلى الدفتر المخزّن بأرقام ثابتة؟' + (old ? '\n' + old + ' منها في فترة مقفلة — تحتاج نافذة الترحيل مفتوحة.' : '') + '\nالقيد المرحّل لا يُعدَّل ولا يُحذف.')) return;
    setBusy('post'); const r = await flPost(rep.missing, lk, (i, t) => setBusy('post ' + i + '/' + t)); setBusy('');
    if (r.err) return say(r.err, 'no');
    await logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'ledger', title: 'رحّل قيود الإغلاقات إلى الدفتر المخزّن', details: r.ok + ' قيدًا' + (r.first ? ' (' + r.first + ' … ' + r.last + ')' : '') + (r.fail ? ' · تعذّر ' + r.fail + ' (' + r.lastErr + ')' : '') });
    say(r.fail ? 'رُحّل ' + r.ok + ' وتعذّر ' + r.fail + ' (' + r.lastErr + ')' : 'رُحّل ' + r.ok + ' قيدًا ✓' + (r.skip ? ' (' + r.skip + ' مرحّل مسبقًا)' : ''), r.fail ? 'no' : 'ok'); check();
  };
  const why0 = (e) => e.opening ? 'القيد الافتتاحي — لم يُرحَّل بعد (يُرحَّل أولًا)' : 'لم يُرحَّل بعد';
  const row = (e, why) => <div key={e.id || e.src} className="me-row"><span className="me-a"><b>{(e.date || '') + ' — ' + (e.title || e.src || '')}</b><small>{why}</small></span></div>;
  return (
    <div className="card" data-ledger>
      <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />دفتر القيود المخزّن (أرقام ثابتة)</div>
        <span className={'badge ' + (rd ? 'b-mint' : on ? 'b-sky' : 'b-dim')}>{rd ? 'الميزان والقوائم من الدفتر' : on ? 'مفعّل — القراءة من المحرك' : 'غير مفعّل'}</span></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        كل قيد يُحفظ <b>مرة واحدة برقم ثابت</b> مثل JV-2026-000001 يبدأ من 1 كل سنة، ولا يُعدَّل محتواه ولا يُحذف. <b>الترحيل من الخادم وحده</b>: يجمع السطور بالهللات ويتحقق من الصلاحية والفترة قبل الكتابة.
        النطاق الآن: <b>القيد الافتتاحي بأرصدة 2025-12-31</b> + المجموعات المفعّلة من {FL_START} ({scope.length} قيدًا):
        <span data-ledger-groups style={{ display: 'block', margin: '4px 0' }}>{FL_GROUPS.map((g, i) => <span key={g.id} style={{ display: 'block', color: i < lvl ? 'var(--mint)' : 'var(--dim)' }}>{i < lvl ? '✓' : '○'} {i + 1}. {g.label}</span>)}</span>
        {uncl.length > 0 && <span style={{ display: 'block', color: 'var(--amber)' }}>⚠ {uncl.length} قيدًا من مصدر غير مصنّف لا يدخل الدفتر بعد (مثل: {uncl.slice(0, 2).map(e => e.src || e.id).join('، ')}).</span>}
        بعد التفعيل يُرحَّل قيد كل إغلاق <b>تلقائيًا عند تدقيقه</b>، و«ترحيل الناقص» يلحق بما تعذّر. التقارير ما زالت من المحرك حتى تثبت المطابقة.
      </div>
      {isAdm && <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={'btn sm' + (on ? ' gh' : ' pri')} disabled={!!busy} onClick={toggle}>{on ? 'إيقاف' : 'تفعيل'}</button>
        {on && <button className="btn sm" disabled={!!busy} onClick={check}><RefreshCw size={13} />{busy === 'check' ? 'جارٍ المطابقة…' : 'مطابقة'}</button>}
        {on && rep && ((rep.pairs || []).length + rep.extra.length) > 0 && <button className="btn sm" disabled={!!busy} onClick={correct}>{busy.startsWith('fix') ? 'جارٍ التصحيح… ' + busy.slice(4) : 'تصحيح بقيد عكسي (' + ((rep.pairs || []).length + rep.extra.length) + ')'}</button>}
        {on && rep && rep.ok && lvl < FL_GROUPS.length && <button className="btn sm" disabled={!!busy} onClick={widen}>إضافة: {FL_GROUPS[lvl].label}</button>}
        {on && !rd && rep && rep.ok && lvl === FL_GROUPS.length && <button className="btn sm pri" disabled={!!busy} onClick={() => setRead(true)}>القراءة من الدفتر</button>}
        {on && rd && <button className="btn sm gh" disabled={!!busy} onClick={() => setRead(false)}>إعادة القراءة إلى المحرك</button>}
        {on && rep && rep.missing.length > 0 && <button className="btn sm pri" disabled={!!busy} onClick={post}>{busy.startsWith('post') ? 'جارٍ الترحيل… ' + busy.slice(5) : 'ترحيل الناقص (' + rep.missing.length + ')'}</button>}
      </div>}
      {rep && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: rep.ok ? 'var(--mint)' : 'var(--amber)' }}>
          {rep.ok ? '✓ متطابق: ' + rep.total + ' قيدًا في المحرك = ' + rep.recs + ' في الدفتر' : 'ناقص ' + rep.missing.length + ' · مختلف ' + rep.differ.length + ' · زائد ' + rep.extra.length + (rep.bad.length ? ' · لا يتطابق بالهللة ' + rep.bad.length : '')}
        </div>
        {!rep.ok && <div className="me-list" style={{ marginTop: 6 }}>
          {rep.differ.slice(0, 10).map(e => row(e, 'تغيّر مصدره بعد الترحيل — «تصحيح بقيد عكسي»'))}
          {rep.bad.slice(0, 10).map(e => row(e, 'لا يتطابق بالهللة — لا يُرحَّل حتى يُصحَّح'))}
          {rep.extra.slice(0, 10).map(r => row(r, 'لم يعد له مصدر معتمد (' + (r.no || '') + ') — «تصحيح بقيد عكسي» يعكسه'))}
          {rep.missing.slice(0, 5).map(e => row(e, why0(e)))}
        </div>}
      </div>}
    </div>);
}

/* v56.7 (C4 — A2) — التطابق التام بالهللات: القيد متوازن فقط إذا تساوى المدين والدائن بالهللة الصحيحة.
   معطّل افتراضيًا؛ البطاقة تعرض أثر التفعيل قبله، والإيقاف يعيد السماح السابق (0.01) فورًا. */
function FinStrictCard({ org, ops, commitOrg, say, isAdm }) {
  const on = finStrictOn(org); const [busy, setBusy] = useState(false);
  const R = useMemo(() => { try { const A = buildAccounting({ ...org, finStrict: { on: true } }, ops);
    return { n: A.entries.length, bad: A.entries.filter(e => e.halDiff !== 0 || e.subHal > 0) }; } catch (e) { return { err: String(e.message || e).slice(0, 120) }; } }, [org, ops]);
  const toggle = async () => {
    if (!isAdm) return;
    if (!on && R.bad && R.bad.length && !window.confirm(R.bad.length + ' قيدًا سيظهر غير متوازن بعد التفعيل. هل تريد المتابعة؟')) return;
    setBusy(true);
    const ok = await commitOrg(o => ({ ...o, finStrict: on ? { ...(o.finStrict || {}), on: false, offAt: nowISO() } : { ...(o.finStrict || {}), on: true, since: nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'finStrict', title: on ? 'أوقف التطابق التام بالهللات' : 'فعّل التطابق التام بالهللات' });
    setBusy(false); if (ok) say(on ? 'عاد سماح التوازن 0.01 لكل قيد' : 'فُعّل التطابق التام بالهللات ✓');
  };
  return (
    <div className="card" data-finstrict>
      <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />التطابق التام بالهللات في القيود</div>
        <span className={'badge ' + (on ? 'b-mint' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        حاليًا يُعدّ القيد متوازنًا إذا كان الفرق أقل من هللة واحدة. عند التفعيل يجب أن يتساوى المدين والدائن <b>بالهللة تمامًا</b>،
        ولا يحمل أي سطر كسرًا أدق من الهللة — فلا تتراكم فروق التقريب دون أن تظهر.
      </div>
      {R.err ? <div style={{ fontSize: 12, color: 'var(--rose)' }}>تعذّر الفحص: {R.err}</div>
        : <div style={{ fontSize: 13, fontWeight: 700, color: R.bad.length ? 'var(--amber)' : 'var(--mint)', marginBottom: 8 }}>
          {R.bad.length ? R.bad.length + ' من ' + R.n + ' قيدًا لا يتطابق بالهللة' : '✓ كل القيود (' + R.n + ') متطابقة بالهللة'}</div>}
      {!R.err && R.bad.length > 0 && <div className="me-list" style={{ marginBottom: 8 }}>
        {R.bad.slice(0, 10).map((e, i) => <div key={i} className="me-row"><span className="me-a"><b>{(e.date || '') + ' — ' + (e.title || e.id || '')}</b>
          <small>{e.halDiff ? 'فرق ' + e.halDiff + ' هللة' : ''}{e.halDiff && e.subHal ? ' · ' : ''}{e.subHal ? e.subHal + ' سطر بكسر أدق من الهللة' : ''}</small></span></div>)}
      </div>}
      {isAdm && <button className={'btn sm' + (on ? ' gh' : ' pri')} disabled={busy || !!R.err} onClick={toggle}>{on ? 'إيقاف التطابق التام' : 'تفعيل التطابق التام'}</button>}
    </div>);
}

/* v56.12 (GROWTH G1): مدير الفرع يرى ويسجّل موافقات وبيانات عملاء فرعه — معطّل افتراضيًا، ولا يُفعَّل قبل أن يمنع الحد الأدنى للإصدار
   الأجهزة الأقدم (تمحو هذه السجلات من مستند الفرع لأنها لا تعرفها). الإيقاف آمن: السجلات تبقى وتُقرأ، والجديد يعود للمركز. */
function MktBranchCard({ org, commitOrg, say, isAdm }) {
  const on = mktBrOn(org); const [rel, setRel] = useState(null);
  useEffect(() => { loadRelease().then(r => setRel(r || { minCv: 0 })).catch(() => setRel({ minCv: 0 })); }, []);
  const ready = !!rel && (rel.minCv || 0) >= MKT_BR_CV;
  const toggle = async () => {
    if (!isAdm) return; if (!on && !ready) return say('ارفع الحد الأدنى للإصدار أولًا (يُرفع تلقائيًا عند دخول مسؤول النظام بالإصدار الجديد ثم إعادة فتح الصفحة)', 'no');
    if (!on && !window.confirm('تفعيل سجلات التسويق في الفروع؟\nالموافقات وبيانات العملاء والإحالات الجديدة تُحفظ في مستند فرع العميل، فيراها موظفو ذلك الفرع ويراها المركز كلها. (تنبيه: دفتر نقاط الولاء — الجوالات والأسماء — ما زال مشتركًا بين الفروع حتى دفعة سجلات الولاء.) لا يُنقل ولا يُحذف شيء قائم.')) return;
    const ok = await commitOrg(o => ({ ...o, mktBranch: on ? { ...(o.mktBranch || {}), on: false, offAt: nowISO() } : { ...(o.mktBranch || {}), on: true, since: (o.mktBranch || {}).since || nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'mktBranch', title: on ? 'أوقف سجلات التسويق في الفروع' : 'فعّل سجلات التسويق في الفروع' });
    if (ok) say(on ? 'أُوقف — السجلات القائمة تبقى وتُقرأ، والجديد يُحفظ مركزيًا' : 'فُعّل ✓');
  };
  return (<div className="card" data-mktbr>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />سجلات التسويق في الفروع (مدير الفرع يرى عملاء فرعه)</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      عند التفعيل تُحفظ الموافقات التسويقية وبيانات العميل والإحالات الجديدة برقم فرع العميل. الحملات ودمج الملفات تبقى للمركز. <b>توصية المراجعة الأمنية: لا تفعّله قبل دفعة «سجلات الموافقة المحمية»</b> — في مستند الفرع يستطيع أي موظف في الفرع تقنيًا تعديل سجل الموافقة أو حذفه، وإلغاء الاشتراك المسجّل في فرع لا يظهر لفرع آخر.
      {!ready && <div data-mktbr-wait>يتطلب أن يكون الحد الأدنى للإصدار {Math.floor(MKT_BR_CV / 10000)}.{Math.floor(MKT_BR_CV / 100) % 100} فأعلى (الحالي: {rel ? rel.minCv || 0 : '…'}).</div>}</div>
    {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} disabled={!on && !ready} onClick={toggle} data-mktbr-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
  </div>);
}
/* v56.17 (GROWTH 2): الموافقات التسويقية وحركات الولاء سجلات للإضافة فقط يحرسها الخادم — نسخ موازٍ، معطّل افتراضيًا.
   المصدر لا يتغير؛ التفعيل ينسخ الجديد، و«نسخ التاريخ» ينسخ القائم، و«مطابقة» تكشف الناقص والمختلف والزائد. */
/* v56.18 (POS 6a — قرارات المالك): قيد إيراد الوردية من فواتير نقطة البيع: الضريبة من الفواتير، المبيعات بالإجمالي والخصومات في 4104،
   والولاء التزام 2106. معطّل افتراضيًا، ويسري من تاريخ يختاره المالك فقط (لا يغيّر قيودًا سابقة). الإغلاق غير المطابق لفواتيره يبقى كما كان. */
function PosGlCard({ org, ops, me, commit, commitOrg, say, isAdm }) {
  const on = posGlOpen(org); const R = posGlRanges(org); const [from, setFrom] = useState(today()); const [rows, setRows] = useState(null);
  const pv = Number((org.loyaltyCfg || {}).ptValue) || 0; const lk = fpLockedTo(org) || '';
  const lastTo = R.reduce((a, r) => (r.to && r.to > a ? r.to : a), '');
  const toggle = async () => {
    if (!isAdm) return;
    if (!on) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return say('اختر تاريخ البدء', 'no');
      if (lk && from <= lk) return say('تاريخ البدء داخل فترة مقفلة (حتى ' + lk + ')', 'no');
      if (lastTo && from <= lastTo) return say('تاريخ البدء يجب أن يكون بعد نهاية التفعيل السابق (' + lastTo + ')', 'no');
      if (!window.confirm('تفعيل قيد الإيراد من فواتير نقطة البيع من ' + from + '؟\nالإغلاقات من هذا التاريخ: الضريبة من الفواتير، المبيعات بالإجمالي والخصومات في 4104، ونقاط الولاء التزام في 2106 بقيمة النقطة المحفوظة في كل فاتورة (والأقدم بـ ' + pv + ').\nتنبيه: إن كان لدى العملاء رصيد نقاط قائم قبل هذا التاريخ فلا التزام افتتاحي له بعد — انتظر قرار معالجته.')) return;
    } else {
      const to = today(); if (lk && to <= lk) return say('لا إيقاف بتاريخ داخل فترة مقفلة', 'no');
      if (!window.confirm('إيقاف من اليوم؟ الإغلاقات حتى اليوم تبقى بقيد نقطة البيع (لا تُعاد كتابتها)، وما بعده بالطريقة السابقة.')) return;
    }
    const ok = await commitOrg(o => { const rs = posGlRanges(o).map(r => ({ ...r }));
      if (on) { const x = rs.find(r => !r.to); if (x) { x.to = today(); x.offAt = nowISO(); } }
      else rs.push({ from, pv, at: nowISO() });
      return { ...o, posGl: { ...(o.posGl || {}), ranges: rs, pv: (o.posGl || {}).pv != null ? o.posGl.pv : pv } }; },   // (التحقق المستقل) لا يحذف الشروح ونطاقات الولاء
      { actionType: 'settings', targetType: 'system_settings', targetId: 'posGl', title: on ? 'أوقف قيد الإيراد من فواتير نقطة البيع' : 'فعّل قيد الإيراد من فواتير نقطة البيع', details: on ? 'حتى ' + today() : 'من ' + from + ' · قيمة النقطة ' + pv });
    if (ok) { setRows(null); say(on ? 'أُوقف من الغد — القيود السابقة كما هي' : 'فُعّل من ' + from + ' ✓'); }
  };
  const cnt = (k) => (rows || []).filter(r => r.st === k).length;
  // v56.33 P2: شرح الإغلاق غير المطابق بمستند (يرفع منع قفل الشهر)، وقيد حركة الولاء وحدها من تاريخ يختاره المالك
  const noteFor = async (r) => { const t = window.prompt('شرح عدم المطابقة ورقم المستند المؤيِّد:', posGlNote(org, r.id)); if (t === null) return;
    const ok = await commitOrg(o => ({ ...o, posGl: { ...(o.posGl || {}), notes: { ...((o.posGl || {}).notes || {}), [r.id]: String(t).trim() || undefined } } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'posGl.notes', title: 'شرح إغلاق لا يطابق فواتير نقطة البيع', details: r.branchName + ' ' + r.date + ' — ' + String(t).trim() });
    if (ok) say('حُفظ الشرح ✓'); };
  const misFrom = posMisLoyFrom(org); const [mFrom, setMFrom] = useState(today());
  const setMis = async () => { if (!isAdm) return;
    if (!misFrom) { const lastTo = posMisLoyRanges(org).reduce((a, r) => (r.to && r.to > a ? r.to : a), ''); if (lastTo && mFrom <= lastTo) return say('تاريخ البدء بعد نهاية التفعيل السابق (' + lastTo + ')', 'no'); if (mFrom < today()) return say('تاريخ البدء لا يسبق اليوم', 'no'); if (lk && mFrom <= lk) return say('تاريخ البدء داخل فترة مقفلة', 'no');
      if (!window.confirm('من ' + mFrom + ': الإغلاق غير المطابق يُضاف إليه قيد حركة الولاء وحدها من الفواتير (منح: مدين 4101 دائن 2106 · استبدال: مدين 2106 دائن 4101). ما قبله كما هو.')) return; }
    const ok = await commitOrg(o => { const rs = posMisLoyRanges(o).map(r => ({ ...r }));
      if (misFrom) { const x = rs.find(r => !r.to); if (x) { x.to = today(); x.offAt = nowISO(); } } else rs.push({ from: mFrom, at: nowISO() });
      const g = { ...(o.posGl || {}), misLoyRanges: rs }; delete g.misLoy; return { ...o, posGl: g }; }, { actionType: 'settings', targetType: 'system_settings', targetId: 'posGl.misLoy', title: misFrom ? 'أوقف قيد الولاء للإغلاق غير المطابق' : 'فعّل قيد الولاء للإغلاق غير المطابق', details: misFrom ? '' : 'من ' + mFrom });
    if (ok) say(misFrom ? 'أُوقف' : 'فُعّل من ' + mFrom + ' ✓'); };
  // v56.33 P1: رصيد النقاط القائم قبل التفعيل — معاينة ثم قيد تسوية بموافقة المالك
  const [op, setOp] = useState(null); const [opDr, setOpDr] = useState('');
  // (التحقق المستقل) القطع = بداية أول نطاق لقيد نقطة البيع (لا الأخير) — فلا تُحتسب نقاط نطاق سابق مرتين
  const cutoff = R.reduce((a, r) => (!a || r.from < a ? r.from : a), '') || today();
  const preview = async () => { const doc = await cloud.get(KEYS.loy, null).catch(() => null); setOp(posLoyOpening(org, doc || {}, cutoff, { orders: ops.posOrders || [], promos: org.posPromos || [] })); };
  const opDone = (ops.journalManual || []).some(j => j.loyOpen && j.status !== 'rejected');
  const opPosted = (ops.journalManual || []).some(j => j.loyOpen && (!j.status || j.status === 'posted'));   // (التحقق المستقل) التسوية الشهرية بعد اعتماده
  const postOpening = async () => {
    if (!op || !(op.amt > 0)) return; if (!opDr) return say('اختر حساب الطرف المدين (الأرباح المبقاة إن كان المبلغ جوهريًا، أو إيراد الفترة)', 'no');
    if (!R.length) return say('فعّل قيد نقطة البيع أولًا (يُنشئ حساب 2106)', 'no'); if (opDone) return say('قيد التسوية مسجّل سابقًا', 'no');
    if (!window.confirm('إنشاء قيد تسوية التزام الولاء القائم: مدين ' + opDr + ' / دائن 2106 بمبلغ ' + op.amt + ' بتاريخ اليوم؟')) return;
    const direct = jeOwner(me), dt = today(); if (lk && dt.slice(0, 7) <= lk) return say('اليوم داخل فترة مقفلة', 'no');
    const rec = { id: uid('jm'), date: dt, title: 'تسوية التزام الولاء القائم قبل ' + cutoff + ' (' + op.pts + ' نقطة × ' + op.pv + ')', loyOpen: { pts: op.pts, pv: op.pv, cutoff, rate: op.rate }, opening: false, by: me.name, byId: me.id || '', createdAt: nowISO(),
      status: direct ? 'posted' : 'pending', ...(direct ? { approvedBy: me.name, approvedAt: nowISO() } : {}), lines: [{ code: opDr, debit: op.amt, credit: 0 }, { code: '2106', debit: 0, credit: op.amt }] };
    const ok = await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'قيد تسوية التزام الولاء القائم (قرار المجلس P1)', details: op.pts + ' نقطة · ' + op.amt + ' ر.س · مدين ' + opDr });
    if (ok !== false) say(direct ? 'سُجّل قيد التسوية ✓' : 'أُرسل قيد التسوية للاعتماد ✓'); };
  // v56.34 (الدفعة 3 — ولاء 6ب): تسوية شهرية من سجل النقاط (المنتهية، المناسبات، جوائز الكتالوج) — معاينة ثم قيد بموافقة المالك، مرة لكل شهر
  const [lm, setLm] = useState(() => { const d = new Date(); d.setDate(0); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
  const [la, setLa] = useState(null); const [promoAcc, setPromoAcc] = useState('');
  const expAccs = useMemo(() => buildAccounting(org, {}).accounts.filter(a => a.kind === 'exp').map(a => ({ code: String(a.code), name: a.name })), [org]);
  const lmDone = (ops.journalManual || []).some(j => j.loyMonth === lm && j.status !== 'rejected');
  const first6a = R.reduce((a, r) => (!a || r.from < a ? r.from : a), '');
  // v56.47 النقاط اليدوية (قرار المالك) — (التحقق المستقل) سجل نطاقات بالأشهر لا يُمحى: الإيقاف يغلق النطاق، فيبقى انتهاء ما قُيِّد مصروفًا عكسًا له
  const manR = ((org.posGl || {}).manLoyRanges) || []; const manOpen = manR.find(r => !r.to); const manFrom = manOpen ? manOpen.from : '';
  const manOn = manR.some(r => lm >= r.from && (!r.to || lm <= r.to)); const manLastTo = manR.reduce((a, r) => (r.to && r.to > a ? r.to : a), '');
  const lmPrev = async () => { const doc = await cloud.get(KEYS.loy, null).catch(() => null); setLa(loyMonthAdj(org, doc || {}, lm, { orders: ops.posOrders || [], promos: org.posPromos || [], from: first6a, manOn, manRanges: manR })); };
  const manToggle = async () => { if (!isAdm) return; const m0 = today().slice(0, 7);
    if (!manFrom && manLastTo && m0 <= manLastTo) return say('أُوقف هذا الشهر — يُعاد التفعيل من الشهر التالي', 'no');
    if (!manFrom && !window.confirm('النقاط اليدوية (هدية أو تصحيح من شاشة الولاء) تُقيَّد في التسوية الشهرية من شهر ' + m0 + ': مدين الحساب الترويجي / دائن 2106، والتصحيح السالب يعكسه. الأشهر السابقة كما هي.')) return;
    const ok = await commitOrg(o => { const g = { ...(o.posGl || {}) }; const rs = (g.manLoyRanges || []).map(r => ({ ...r }));
      if (manFrom) { const x = rs.find(r => !r.to); if (x) { x.to = m0; x.offAt = nowISO(); } } else rs.push({ from: m0, at: nowISO() }); g.manLoyRanges = rs; return { ...o, posGl: g }; },
      { actionType: 'settings', targetType: 'system_settings', targetId: 'posGl.manLoyRanges', title: manFrom ? 'أوقف قيد النقاط اليدوية' : 'فعّل قيد النقاط اليدوية مصروف تسويق', details: manFrom ? '' : 'من ' + m0 });
    if (ok) { setLa(null); say(manFrom ? 'أُوقف' : 'فُعّل من ' + m0 + ' ✓'); } };
  const lmPost = async () => {
    if (!la) return; if (!R.length || lm < first6a.slice(0, 7)) return say('الشهر قبل تفعيل قيد نقطة البيع — لا التزام ولاء في الدفاتر له', 'no');
    const nowM = today().slice(0, 7); if (lm >= nowM) return say('التسوية لشهر منتهٍ فقط — حتى لا تسقط حركات بقية الشهر', 'no');
    const [yy, mm0] = lm.split('-').map(Number); const lastD = lm + '-' + String(new Date(yy, mm0, 0).getDate()).padStart(2, '0');
    if (!R.some(r => r.from <= lastD && (!r.to || r.to >= lm + '-01'))) return say('الشهر يقع في فجوة بين نطاقات قيد نقطة البيع — لا تسوية له', 'no');
    if (!opPosted) return say('سجّل أولًا قيد رصيد النقاط القائم (أعلاه) واعتمده — وإلا أطفأت التسوية التزامًا لم يُسجَّل', 'no');
    if (lmDone) return say('تسوية هذا الشهر مسجّلة سابقًا', 'no'); if (lk && lm <= lk) return say('الشهر مقفل', 'no');
    if ((la.occ || la.expOcc || la.man) && !promoAcc) return say('اختر حساب المصروف الترويجي لنقاط المناسبات والنقاط اليدوية', 'no');
    const L = []; const pair = (dr, cr, a) => { if (!a) return; if (a < 0) { [dr, cr] = [cr, dr]; a = -a; } L.push({ code: dr, debit: a, credit: 0 }, { code: cr, debit: 0, credit: a }); };   // بلا مبالغ سالبة
    pair('2106', '4101', la.exp); pair('2106', '4101', la.rw); pair(promoAcc, '2106', la.occ); pair('2106', promoAcc, la.expOcc);   // P5: انتهاء نقاط المناسبات يعكس المصروف
    pair(promoAcc, '2106', la.man || 0);   // v56.47: النقاط اليدوية مصروف تسويق (السالب يعكسه)
    if (!L.length) return say('لا حركات تحتاج تسوية في هذا الشهر', 'no');
    const lastDay = (() => { const [y, m] = lm.split('-').map(Number); return lm + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0'); })();
    if (!window.confirm('قيد تسوية الولاء لشهر ' + lm + ' بتاريخ ' + lastDay + ':\nمنتهية ' + la.exp + ' · منتهية من المناسبات ' + la.expOcc + ' · جوائز ' + la.rw + ' · مناسبات ' + la.occ + (la.man ? ' · يدوية ' + la.man : ''))) return;
    const direct = jeOwner(me);
    const rec = { id: uid('jm'), date: lastDay, title: 'تسوية الولاء الشهرية ' + lm + ' (منتهية ' + la.expPts + ' · جوائز ' + la.rwPts + ' · مناسبات ' + la.occPts + ' نقطة)', loyMonth: lm, opening: false, by: me.name, byId: me.id || '', createdAt: nowISO(),
      status: direct ? 'posted' : 'pending', ...(direct ? { approvedBy: me.name, approvedAt: nowISO() } : {}), lines: L };
    const ok = await commit(d => ({ ...d, journalManual: [rec, ...(d.journalManual || [])] }), { actionType: 'create', targetType: 'journal_entry', targetId: rec.id, need: 'post', title: 'تسوية الولاء الشهرية (قرارات المجلس P5/P6/P7)', details: lm + ' · منتهية ' + la.exp + ' · جوائز ' + la.rw + ' · مناسبات ' + la.occ });
    if (ok !== false) say(direct ? 'سُجّلت تسوية ' + lm + ' ✓' : 'أُرسلت تسوية ' + lm + ' للاعتماد ✓'); };
  return (<div className="card" data-posgl>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />قيد إيراد الوردية من فواتير نقطة البيع (الضريبة، الخصومات، التزام الولاء)</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل من ' + posGlRanges(org).find(r => !r.to).from : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بقرارك: ضريبة كل فاتورة بدل النسبة الثابتة · المبيعات بالإجمالي والعروض والخصم اليدوي في <b>4104</b> · نقاط الولاء الممنوحة <b>التزام 2106</b> (النقاط × قيمة النقطة بعد الضريبة) ويُطفئه الاستبدال.
      {!pv && <div style={{ color: 'var(--amber)' }}>قيمة النقطة غير مضبوطة في إعداد الولاء ⇒ لن يُسجَّل التزام للنقاط.</div>}
      <div style={{ color: 'var(--amber)' }} data-posgl-warn>لا تفعّله إن كان لدى العملاء رصيد نقاط قائم قبل قرار معالجته (افتتاحي في الأرباح المبقاة أم إيراد الفترة) — وإلا صار 2106 مدينًا عند استبداله.</div>
      <div>نقاط المناسبات وجوائز الكتالوج وانتهاء النقاط: خارج هذه الدفعة حتى قرارك.</div>
      {R.filter(r => r.to).map((r, i) => <div key={i}>نطاق سابق: {r.from} ← {r.to}</div>)}</div>
    {isAdm && !on && <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}><label style={{ fontSize: 12 }}>يسري من <input className="inp" type="date" aria-label="تاريخ بدء قيد نقطة البيع" value={from} onChange={e => setFrom(e.target.value)} /></label></div>}
    {rows && <div data-posgl-rep style={{ fontSize: 12, marginTop: 6 }}>إغلاقات في النطاق: {rows.length} · مطابقة لفواتيرها: {cnt('ok')} · غير مطابقة: {cnt('diff')} · بلا فواتير نقطة بيع: {cnt('none')}
      {rows.filter(r => r.st === 'diff').slice(0, 20).map(r => <div key={r.id} className="me-row" data-posgl-diff><span className="me-a"><b>{r.branchName} — {r.date}</b><small>الإغلاق {r.tot} · الفواتير {r.pos} ({r.n}) — بقي القيد بالطريقة السابقة{posGlNote(org, r.id) ? ' · الشرح: ' + posGlNote(org, r.id) : ' · بلا شرح (يمنع قفل الشهر)'}</small></span>
        {isAdm && <button className="btn sm gh" data-posgl-note onClick={() => noteFor(r)}>{posGlNote(org, r.id) ? 'تعديل الشرح' : 'شرح بمستند'}</button>}</div>)}</div>}
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-posgl-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
      {R.length > 0 && <button className="btn sm gh" onClick={() => setRows(posGlCheck(org, ops))} data-posgl-check>فحص المطابقة</button>}
    </div>
    <div data-posgl-mis style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 12 }}>
      <b>الإغلاق غير المطابق (قرار المجلس P2):</b> لا يُمنع اعتماده، ويُضاف إليه قيد حركة الولاء وحدها من الفواتير فيبقى 2106 مطابقًا لسجل النقاط؛ ويمنع قفل الشهر حتى يُصحَّح أو يُشرح بمستند.
      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={'badge ' + (misFrom ? 'b-sky' : 'b-dim')}>{misFrom ? 'قيد الولاء مفعّل من ' + misFrom : 'قيد الولاء غير مفعّل'}</span>
        {isAdm && !misFrom && <input className="inp" type="date" aria-label="بدء قيد الولاء للإغلاق غير المطابق" value={mFrom} min={today()} onChange={e => setMFrom(e.target.value)} />}
        {isAdm && <button className={'btn sm ' + (misFrom ? 'gh' : '')} onClick={setMis} data-posgl-mistoggle>{misFrom ? 'إيقاف' : 'تفعيل'}</button>}</div></div>
    <div data-posgl-open style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 12 }}>
      <b>رصيد النقاط القائم قبل {cutoff} (قرار المجلس P1):</b> يُحسب آليًا = النقاط × قيمة النقطة بعد استبعاد الضريبة، ويُسجَّل بقيد تسوية واحد بتاريخ اليوم بعد موافقتك — لا يُفتح شهر مقفل ولا يُعدَّل قيد سابق. الجوهرية يقدّرها المحاسب المختص.
      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn sm gh" onClick={preview} data-posgl-openprev>معاينة</button>
        {op && <span data-posgl-openres>{op.pts} نقطة{op.rwOpen ? ' (منها ' + op.rwOpen + ' لجوائز لم تُسلَّم)' : ''} × {op.pv} ÷ (1 + {op.rate}%) = <b className="num">{op.amt}</b> ر.س <small style={{ color: 'var(--dim)' }}>(قيمة النقطة من إعداد الولاء{(org.posGl || {}).pv != null ? ' — لقطة يوم التفعيل' : ' الحالي'})</small></span>}
        {R.length > 1 && <span className="badge b-amber" data-posgl-gap>تعدد نطاقات التفعيل: نقاط الفترات الفاصلة بين النطاقات لا يغطيها هذا القيد — تُعالج بقرار</span>}
        {opDone && <span className="badge b-sky">القيد مسجّل</span>}
        {op && op.amt > 0 && isAdm && !opDone && <><select className="sel" aria-label="الطرف المدين لقيد التسوية" value={opDr} onChange={e => setOpDr(e.target.value)} data-posgl-opendr>
          <option value="">— الطرف المدين —</option><option value="3201">3201 الأرباح المبقاة (إن كان جوهريًا — تصحيح خطأ سابق)</option><option value="4101">4101 إيراد الفترة (إن لم يكن جوهريًا)</option></select>
          <button className="btn sm pri" onClick={postOpening} data-posgl-openpost>إنشاء قيد التسوية</button></>}</div></div>
    <div data-loymonth style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 12 }}>
      <b>تسوية الولاء الشهرية (6ب — قرارات المجلس):</b> ما لا يأتي من الفواتير، لشهر منتهٍ بعد قيد الرصيد القائم: النقاط المنتهية ← إيراد (مدين 2106 دائن 4101)، ومنتهية المناسبات ← عكس المصروف · جوائز الكتالوج ← إيراد عند تسليمها (استعمال الكوبون أو انتهاؤه) · نقاط المناسبات (عيد الميلاد والإحالة) ← مصروف ترويجي تختاره (دائن 2106). انتهاء الصلاحية خيار في «التسويق ← إعداد الولاء» (0 = لا تنتهي). ضريبة الجوائز بانتظار رأي المختص.
      <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="inp" type="month" aria-label="شهر تسوية الولاء" value={lm} onChange={e => { setLm(e.target.value); setLa(null); }} />
        <button className="btn sm gh" onClick={lmPrev} data-loymonth-prev>معاينة</button>
        {la && <span data-loymonth-res>منتهية {la.expPts} = <b className="num">{la.exp}</b> · منتهية من المناسبات {la.expOccPts} = <b className="num">{la.expOcc}</b> · جوائز مُسلَّمة {la.rwPts} = <b className="num">{la.rw}</b> · مناسبات {la.occPts} = <b className="num">{la.occ}</b> ر.س{la.man != null ? <> · يدوية {la.manNetPts} = <b className="num" data-loymonth-man>{la.man}</b></> : la.manPts > 0 ? ' · ⚠ ' + la.manPts + ' تعديل يدوي للنقاط خارج التسوية' : ''}</span>}
        {isAdm && <button className={'btn sm ' + (manFrom ? 'gh' : '')} data-loyman-toggle onClick={manToggle}>{manFrom ? 'إيقاف قيد النقاط اليدوية (مفعّل من ' + manFrom + ')' : 'تفعيل قيد النقاط اليدوية مصروف تسويق'}</button>}
        {lmDone && <span className="badge b-sky">مسجّلة</span>}
        {la && isAdm && !lmDone && <>{(la.occ || la.expOcc || la.man) ? <select className="sel" aria-label="حساب المصروف الترويجي" value={promoAcc} onChange={e => setPromoAcc(e.target.value)} data-loymonth-acc><option value="">— حساب المصروف الترويجي —</option>{expAccs.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select> : null}
          <button className="btn sm pri" onClick={lmPost} data-loymonth-post>إنشاء قيد التسوية</button></>}</div></div>
  </div>);
}

/* v56.44 — الدفعة 9 (H1): التأخر عن المباشرة بعد استنفاد الرصيد غياب بلا أجر بدل الرصيد السالب — بقرار المجلس وفق نظام العمل ولائحة تنظيم العمل */
function LateRetCard({ org, commitOrg, say, isAdm }) {
  const on = lrUnpaidOn(org);
  const flip = async () => { if (!isAdm) return; const ok = await commitOrg(o => ({ ...o, lateRet: { ...(o.lateRet || {}), unpaid: !on, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'lateRet', title: on ? 'أوقف الغياب بلا أجر للتأخر عن المباشرة' : 'فعّل الغياب بلا أجر للتأخر عن المباشرة' });
    if (ok) say(on ? 'أُوقف — للمباشرات الجديدة: الخصم من الرصيد ولو صار سالبًا؛ وما اعتُمد يبقى كما هو ويبقى ظاهرًا للرواتب' : 'فُعّل — للمباشرات الجديدة ✓'); };
  return (<div className="card" data-lrcfg>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />التأخر عن المباشرة بعد الإجازة</div><span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>بقرار المجلس وفق نظام العمل ولائحة تنظيم العمل النموذجية: أيام التأخر تُخصم من رصيد السنوية بقدر المتاح، وما زاد عليه <b>غياب بلا أجر</b> بدل الرصيد السالب.
      لا خصم آلي من الراتب: يظهر في «الإجازات» و«الرواتب» ليراجعه مُعدّ الرواتب، وتنبيه بحدود المادة 80 (إنذار كتابي عند 10 أيام متصلة أو 20 متفرقة في السنة، ويجيز الفصل فوق 15 متصلة أو 30 متفرقة) بلا أي إجراء آلي. يسري على المباشرات الجديدة؛ والكسر في الرصيد لا يغطي يومًا. إن كانت لائحتكم المعتمدة تنص على غير ذلك فأوقفه.</div>
    {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={flip} data-lrcfg-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
  </div>);
}

/* v56.43 — الدفعة 10 (E8): هبوط قيمة الأصول — التفعيل وحسابا الخسارة (5xxx) ومجمع الهبوط (17xx غير 1701 و1791) من الدليل */
function ImpairCfgCard({ org, commitOrg, say, isAdm }) {
  const on = impOn(org); const c = (org && org.impair) || {}; const [f, setF] = useState({ loss: c.lossAcc || '', acc: c.accAcc || '' });
  const accs = useMemo(() => buildAccounting(org, {}).accounts.map(a => ({ code: String(a.code), name: a.name })), [org]);
  const save = async (turn) => { if (!isAdm) return; const nx = turn === undefined ? on : turn;
    if (nx && (!impLossOk(f.loss) || !impAccOk(f.acc))) return say('اختر حساب خسارة الهبوط (5xxx) وحساب مجمع الهبوط (17xx غير 1701 و1791)', 'no');
    const ok = await commitOrg(o => ({ ...o, impair: { ...(o.impair || {}), on: nx, lossAcc: f.loss, accAcc: f.acc, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'impair', title: nx ? 'فعّل هبوط قيمة الأصول' : 'أوقف هبوط قيمة الأصول', details: f.loss + ' / ' + f.acc });
    if (ok) say(nx ? 'فُعّل — يظهر في «المحاسبة ← الأصول والإهلاك» ✓' : 'أُوقف — ما اعتُمد يبقى'); };
  return (<div className="card" data-impcfg>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />هبوط قيمة الأصول الثابتة</div><span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>بقرار المجلس (القسم 27): يُدخل المحاسب الهبوط بمبلغه ومستنده ويعتمده غيره، والعكس مسموح في حدوده، والإهلاك بعده للمستقبل فقط، واختبار المؤشرات سنويًا. اختر الحسابين من الدليل (أضفهما إن لم يوجدا: مجمع خسائر الهبوط 17xx، وخسارة الهبوط 5xxx).</div>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
      <select className="sel" aria-label="حساب خسارة الهبوط" value={f.loss} disabled={!isAdm} onChange={e => setF({ ...f, loss: e.target.value })} data-impcfg-loss><option value="">— خسارة الهبوط —</option>{accs.filter(a => impLossOk(a.code)).map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select>
      <select className="sel" aria-label="حساب مجمع الهبوط" value={f.acc} disabled={!isAdm} onChange={e => setF({ ...f, acc: e.target.value })} data-impcfg-acc><option value="">— مجمع الهبوط —</option>{accs.filter(a => impAccOk(a.code)).map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select>
      {isAdm && on && <button className="btn sm gh" onClick={() => save()}>حفظ الحسابين</button>}
      {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={() => save(!on)} data-impcfg-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
    </div>
  </div>);
}

/* v56.48 — توزيع الإهلاك وهبوط القيمة على الفروع (قرار المجلس): سجل نطاقات بالأشهر لا يُمحى، يسري من الشهر الجاري غير المقفل */
function DepBrCard({ org, commitOrg, say, isAdm }) {
  const from = depBrFrom(org), rs = depBrRanges(org);
  const funded = (org.assets || []).filter(a => !a.disposedDate && Number(a.cost) > 0 && a.fund && a.fund !== 'none');
  const withBr = funded.filter(a => a.branchId).length;
  const toggle = async () => { if (!isAdm) return; const m0 = today().slice(0, 7);
    const pre = depBrToggle(org, m0, nowISO()); if (pre.err) return say(pre.err, 'no');
    if (pre.on && !window.confirm('توزيع الإهلاك على الفروع من شهر ' + m0 + ': إهلاك كل أصل له مركز تكلفة فرع يُقيَّد في قيد لفرعه، والباقي في قيد المركز الرئيسي، والإجمالي نفسه. الأشهر السابقة وتقارير الفروع الماضية كما هي.')) return;
    let err = ''; const ok = await commitOrg(o => { const r = depBrToggle(o, m0, nowISO()); if (r.err) { err = r.err; return o; } return { ...o, depBranch: { ...(o.depBranch || {}), ranges: r.ranges } }; },
      { actionType: 'settings', targetType: 'system_settings', targetId: 'depBranch.ranges', title: from ? 'أوقف توزيع الإهلاك على الفروع' : 'فعّل توزيع الإهلاك على الفروع', details: from ? 'حتى ' + m0 : 'من ' + m0 });
    if (err) return say(err, 'no'); if (ok) say(from ? 'أُوقف — ما بعد ' + m0 + ' على المركز الرئيسي' : 'فُعّل من ' + m0 + ' ✓'); };
  return (<div className="card" data-depbr>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />توزيع الإهلاك وهبوط القيمة على الفروع</div>
      <span className={'badge ' + (from ? 'b-sky' : 'b-dim')} data-depbr-st>{from ? 'مفعّل من ' + from : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بقرار المجلس: من شهر التفعيل يُقسَم قيد الإهلاك الشهري بحسب مركز تكلفة الأصل — الأصل الذي له فرع يُقيَّد إهلاكه في قيد لذلك الفرع فيظهر في قائمة دخل الفرع، والأصول بلا فرع تبقى في قيد المركز الرئيسي، والإجمالي لا يتغير. وقيد هبوط القيمة واستبعاد الأصل بعد التفعيل يحملان فرع الأصل كذلك.
      يسري من الشهر الجاري فقط (ولا يُفعَّل في فترة مقفلة)، فلا يتغير قيد إهلاك شهر سابق ولا تقارير الفروع الماضية. الإيقاف يغلق النطاق ولا يمحوه.
      <div style={{ color: 'var(--amber)' }} data-depbr-hint>قبل التفعيل عبّئ «مركز التكلفة» لكل أصل من «المحاسبة ← الأصول والإهلاك» (تعديل الأصل) — الأصل بلا مركز تكلفة يبقى على المركز الرئيسي. الأصول المرسملة القائمة: {funded.length}، منها بمركز تكلفة فرع: {withBr}.</div>
      {rs.length > 0 && <div data-depbr-ranges>السجل: {rs.map(r => r.from + (r.to ? ' ← ' + r.to : ' ← مستمر')).join(' · ')}</div>}
    </div>
    {isAdm && <button className={'btn sm ' + (from ? 'gh' : 'pri')} onClick={toggle} data-depbr-toggle>{from ? 'إيقاف' : 'تفعيل'}</button>}
  </div>);
}

/* v56.41 — الدفعة 6 (E5 وT4): الموازنات بالإصدارات، والمصروفات المدفوعة مقدمًا — مفتاحان مستقلان معطّلان افتراضيًا */
function Batch6Card({ org, commitOrg, say, isAdm }) {
  const bOn = budVOn(org), pOn = ppOn(org);
  const flip = async (key, on, title) => { if (!isAdm) return;
    const ok = await commitOrg(o => ({ ...o, [key]: { ...(o[key] || {}), on: !on, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: key, title: (on ? 'أوقف ' : 'فعّل ') + title });
    if (ok) say(on ? 'أُوقف — ما اعتُمد يبقى كما هو' : 'فُعّل ✓'); };
  return (<div className="card" data-batch6>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />الموازنات بالإصدارات · المصروفات المدفوعة مقدمًا</div></div>
    <div className="me-row"><span className="me-a"><b>الموازنات بالإصدارات</b><small>لكل سنة إصدارات بالحساب والشهر والفرع؛ يعدّها المحاسب ويعتمدها المالك أو الإدارة المالية غير المُعدّ؛ التعديل إصدار جديد؛ التجاوز ينبّه. الموازنة الحالية تبقى «إصدارًا صفريًا» بلا نقل. (المحاسبة ← الموازنة)</small></span>
      <span className="row" style={{ gap: 6 }}><span className={'badge ' + (bOn ? 'b-sky' : 'b-dim')}>{bOn ? 'مفعّل' : 'غير مفعّل'}</span>{isAdm && <button className={'btn sm ' + (bOn ? 'gh' : 'pri')} onClick={() => flip('budgetV', bOn, 'الموازنات بالإصدارات')} data-budv-toggle>{bOn ? 'إيقاف' : 'تفعيل'}</button>}</span></div>
    <div className="me-row"><span className="me-a"><b>المصروفات المدفوعة مقدمًا</b><small>الإيجار وما شابهه لعدة أشهر: أصل متداول يُطفأ شهريًا بعد اعتماد غير المنشئ. (المحاسبة ← الأصول والإهلاك)</small></span>
      <span className="row" style={{ gap: 6 }}><span className={'badge ' + (pOn ? 'b-sky' : 'b-dim')}>{pOn ? 'مفعّل' : 'غير مفعّل'}</span>{isAdm && <button className={'btn sm ' + (pOn ? 'gh' : 'pri')} onClick={() => flip('prepaid', pOn, 'المصروفات المدفوعة مقدمًا')} data-pp-toggle>{pOn ? 'إيقاف' : 'تفعيل'}</button>}</span></div>
  </div>);
}

/* v56.40 — الدفعة 7 (E6): مخصص الخسائر الائتمانية — التفعيل وحسابا المصروف والمخصص من الدليل (لا أرقام ثابتة في الكود) */
function EclCfgCard({ org, commitOrg, say, isAdm }) {
  const on = eclOn(org); const ac = eclAccs(org); const [f, setF] = useState({ exp: ac.exp, allow: ac.allow });
  const A0 = useMemo(() => buildAccounting(org, {}), [org]); const accs = A0.accounts.map(a => ({ code: String(a.code), name: a.name }));
  const exps = accs.filter(a => /^5\d+$/.test(a.code)), allows = accs.filter(a => eclAllowOk(a.code, A0));   // فرعي من 13xx غير 1380 وغير النقد
  const save = async (turn) => { if (!isAdm) return; const nextOn = turn === undefined ? on : turn;
    if (nextOn && (!f.exp || !f.allow || f.exp === f.allow)) return say('اختر حساب المصروف وحساب المخصص من الدليل', 'no');
    const ok = await commitOrg(o => ({ ...o, ecl: { ...(o.ecl || {}), on: nextOn, expAcc: f.exp, allowAcc: f.allow, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'ecl', title: nextOn ? 'فعّل مخصص الخسائر الائتمانية' : 'أوقف مخصص الخسائر الائتمانية', details: 'المصروف ' + f.exp + ' · المخصص ' + f.allow });
    if (ok) say(nextOn ? 'فُعّل — يظهر في «المحاسبة ← العملاء والذمم المدينة» ✓' : 'أُوقف — القيود المعتمدة تبقى كما هي'); };
  return (<div className="card" data-eclcfg>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />مخصص الخسائر الائتمانية للذمم المدينة</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بقرار المجلس: مخصص محدد لكل عميل بدليل، يعتمده غير منشئه، والشطب على المخصص. أعمار الذمم من تاريخ الاستحقاق. اختر الحسابين من دليل الحسابات
      (إن لم يوجدا أضفهما من «دليل الحسابات»: حساب مقابل للذمم فرعي من 13xx غير 1380، ومصروف 5xxx). يُثبَّت الحسابان على كل مستند عند اعتماده، فتغييرهما لاحقًا لا يمس قيدًا سابقًا.</div>
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <select className="sel" aria-label="حساب مصروف الخسائر الائتمانية" value={f.exp} disabled={!isAdm} onChange={e => setF({ ...f, exp: e.target.value })} data-eclcfg-exp><option value="">— حساب المصروف —</option>{exps.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select>
      <select className="sel" aria-label="حساب مخصص الخسائر الائتمانية" value={f.allow} disabled={!isAdm} onChange={e => setF({ ...f, allow: e.target.value })} data-eclcfg-allow><option value="">— حساب المخصص —</option>{allows.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select>
      {isAdm && on && <button className="btn sm gh" onClick={() => save()} data-eclcfg-save>حفظ الحسابين</button>}
      {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={() => save(!on)} data-eclcfg-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
    </div>
  </div>);
}

/* v56.23 (G2 — النموذج 2، المرحلة 1): شريط التحكم في المحاسبة — مسار الموقع والإجراءات فوق صف الأقسام. واجهة فقط، لا أثر على البيانات. معطّل افتراضيًا. */
function CtlBarCard({ org, commitOrg, say, isAdm }) {
  const on = ctlBarOn(org);
  const toggle = async () => {
    if (!isAdm) return;
    const ok = await commitOrg(o => ({ ...o, ctlBar: { ...(o.ctlBar || {}), on: !on, at: nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'ctlBar', title: on ? 'أوقف شريط التحكم (رجوع للشكل السابق)' : 'أعاد تشغيل شريط التحكم', details: on ? 'عودة لشريط v56.16' : 'الوضع الافتراضي' });
    if (ok) say(on ? 'أُوقف — عاد الشكل السابق' : 'عاد شريط التحكم ✓');
  };
  return (<div className="card" data-ctlbar-card>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />شريط التحكم في التطبيقات</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل' : 'موقوف (الشكل السابق)'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      الوضع الافتراضي بقرار المالك بعد التجربة. يُظهر سطرًا أعلى المحاسبة والمبيعات والمخزون والموردين والإجازات ومراكز التطبيقات فيه مسار الموقع (التطبيق › المجموعة › القسم الحالي) وأزرار الإجراء، وصفًّا بأقسام المجموعة الحالية، ومرشحات تقارير المحاسبة، ويكبّر الأزرار للمس. يسري على وضع العرض «قوائم».
      تغيير في الشكل فقط — لا يمس أي قيد أو رصيد، ويمكن إيقافه في أي وقت. يسري على كل مستخدمي المنشأة.</div>
    {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-ctlbar-toggle>{on ? 'الرجوع إلى الشكل السابق' : 'إعادة التشغيل'}</button>}
  </div>);
}

/* v56.29 (توجيه المجلس بتفويض المالك): أوامر الصرف من الخزينة — منع سداد الموردين والضريبة والرواتب منها، واعتماد بغير المنشئ.
   معطّل افتراضيًا، ويسري من تاريخ لا يسبق اليوم ولا يقع في فترة مقفلة (فلا يتغير قيد سابق ولا الدفتر المخزّن). مع مراجعة قراءة فقط للأوامر الماضية. */
function DsRouteCard({ org, ops, commitOrg, say, isAdm }) {
  const on = dsRouteOpen(org); const R = dsRanges(org); const [from, setFrom] = useState(today()); const lk = fpLockedTo(org) || '';
  const lastTo = R.reduce((a, r) => (r.to && r.to > a ? r.to : a), '');
  const start0 = (R.find(r => !r.to) || R[0] || {}).from || '9999-12-31';
  const past = (ops.disbursements || []).filter(x => dsLive(x) && DS_BLOCKED[x.category] && String(x.date || '') < start0);
  const byCat = Object.keys(DS_BLOCKED).map(c => { const L = past.filter(x => x.category === c); return { c, n: L.length, amt: Math.round(L.reduce((t, x) => t + (Number(x.amount) || 0), 0) * 100) / 100 }; });
  const toggle = async () => {
    if (!isAdm) return;
    if (!on) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return say('اختر تاريخ البدء', 'no');
      if (from < today()) return say('تاريخ البدء لا يسبق اليوم — حتى لا يُعاد تصنيف أوامر مرحّلة', 'no');
      if (lk && from <= lk) return say('تاريخ البدء داخل فترة مقفلة (حتى ' + lk + ')', 'no');
      if (lastTo && from <= lastTo) return say('تاريخ البدء يجب أن يكون بعد نهاية التفعيل السابق (' + lastTo + ')', 'no');
      if (!window.confirm('تفعيل ضوابط أوامر الصرف من ' + from + '؟\nمن هذا التاريخ: لا يُصرف سداد الموردين ولا الضريبة ولا الرواتب من أوامر الصرف (بل من شاشاتها)، والأمر الجديد يعتمده غير منشئه.\nالأوامر السابقة تبقى كما هي.')) return;
    } else if (!window.confirm('إيقاف من اليوم؟ الأوامر حتى اليوم تبقى كما سُجّلت.')) return;
    const ok = await commitOrg(o => { const rs = dsRanges(o).map(r => ({ ...r }));
      if (on) { const x = rs.find(r => !r.to); if (x) { x.to = today(); x.offAt = nowISO(); } } else rs.push({ from, at: nowISO() });
      return { ...o, dsRoute: { ...(o.dsRoute || {}), ranges: rs } }; },
      { actionType: 'settings', targetType: 'system_settings', targetId: 'dsRoute', title: on ? 'أوقف ضوابط أوامر الصرف' : 'فعّل ضوابط أوامر الصرف', details: on ? 'حتى ' + today() : 'من ' + from });
    if (ok) say(on ? 'أُوقفت — الأوامر السابقة كما هي' : 'فُعّلت من ' + from + ' ✓');
  };
  return (<div className="card" data-dsroute>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />ضوابط أوامر الصرف من الخزينة الرئيسية</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّلة من ' + (R.find(r => !r.to) || {}).from : 'غير مفعّلة'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بتوجيه المجلس: كل أمر صرف يُقيَّد اليوم مصروفًا على 5901 أيًّا كان بنده — فسداد المورد والضريبة والرواتب منه يضخّم المصروف ويُبقي الالتزام مفتوحًا.
      عند التفعيل: هذه البنود الثلاثة تُصرف من شاشاتها ({Object.values(DS_BLOCKED).join(' · ')})، والأمر الجديد «بانتظار الاعتماد» يعتمده غير منشئه (المالك يرحّل أمره مباشرة كالقيد اليدوي).
      <div>الإيجارات والصيانة والمصاريف الإدارية وتوريد المواد الخام تبقى على 5901 حتى قرارك في خريطة الحسابات.</div>
      {R.filter(r => r.to).map((r, i) => <div key={i}>نطاق سابق: {r.from} ← {r.to}</div>)}</div>
    {past.length > 0 && <div data-dsroute-past style={{ fontSize: 12, marginBottom: 8 }}><b>مراجعة الأوامر الماضية (قراءة فقط — لا تعديل):</b> أوامر مرحّلة على 5901 لبنود لها شاشات مخصصة:
      {byCat.filter(x => x.n).map(x => <div key={x.c} className="me-row"><span className="me-a"><b>{x.c}</b><small>{x.n} أمر · {x.amt.toLocaleString('en', { minimumFractionDigits: 2 })} ر.س — قارنها بسجلها في شاشتها؛ أي تصحيح بقيد يدوي معتمد بعد قرارك</small></span></div>)}</div>}
    {isAdm && !on && <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}><label style={{ fontSize: 12 }}>يسري من <input className="inp" type="date" aria-label="تاريخ بدء ضوابط أوامر الصرف" value={from} min={today()} onChange={e => setFrom(e.target.value)} /></label></div>}
    {isAdm && <div className="row" style={{ marginTop: 8 }}><button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-dsroute-toggle>{on ? 'إيقاف' : 'تفعيل'}</button></div>}
    <DsMapEditor org={org} commitOrg={commitOrg} say={say} isAdm={isAdm} />
  </div>);
}
/* v56.30 (قرار المالك: «أوامر الصرف تسجل حسب بنود الصرف»): حساب لكل بند مسموح — يختاره المالك من الدليل (مصروف أو مخزون).
   يُثبَّت على الأمر الجديد وقت إنشائه داخل نطاق الضوابط؛ تغيير الخريطة لا يمس أمرًا مسجلًا. */
const DS_ITEMS = ['إيجارات الفروع', 'صيانة وتشغيل', 'مصاريف إدارية', 'توريد مواد خام مركزي'];
function DsMapEditor({ org, commitOrg, say, isAdm }) {
  const M = dsMapOf(org); const accs = useMemo(() => buildAccounting(org, {}).accounts.filter(dsAccOk).map(a => ({ code: String(a.code), name: a.name })).sort((x, y) => x.code.localeCompare(y.code)), [org]);
  const set = async (item, code) => {
    if (!isAdm) return;
    const ok = await commitOrg(o => ({ ...o, dsRoute: { ...(o.dsRoute || {}), map: { ...((o.dsRoute || {}).map || {}), [item]: code || undefined } } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'dsRoute.map', title: 'حساب بند أمر الصرف', details: item + ' ← ' + (code || '5901 (عام)') });
    if (ok) say('«' + item + '» ← ' + (code || '5901') + ' — يسري على الأوامر الجديدة فقط');
  };
  return (<div data-dsmap style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
    <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>حساب كل بند (بقرارك: تُسجَّل أوامر الصرف حسب بنودها)</div>
    <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 6 }}>يُثبَّت الحساب على الأمر لحظة إنشائه داخل نطاق الضوابط — تغيير الاختيار لاحقًا لا يغيّر أمرًا مسجلًا. بلا اختيار ⇒ 5901 كما كان. لإضافة حساب جديد (مثل «مصروف الإيجار») أضفه أولًا في دليل الحسابات.</div>
    {DS_ITEMS.map(it => <div key={it} className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
      <span style={{ minWidth: 150, fontSize: 12.5 }}>{it}</span>
      <select className="sel" style={{ minWidth: 240 }} aria-label={'حساب بند ' + it} data-dsmap-item={it} disabled={!isAdm} value={M[it] || ''} onChange={e => set(it, e.target.value)}>
        <option value="">5901 — مصروفات الخزينة (عام)</option>
        {accs.filter(a => a.code !== '5901').map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
      </select>
      {it === 'توريد مواد خام مركزي' && !/^16/.test(String(M[it] || '')) && <span className="hint" data-dsmap-raw style={{ color: 'var(--amber)' }}>بإجابتك (توجد مشتريات نقدية بلا فاتورة) يوصي المجلس بحساب المستودع 16xx</span>}</div>)}
  </div>);
}

/* v56.32 (الدفعة 1ب — قرار المجلس T9): اعتماد سندات الصرف بغير منشئها. معطّل افتراضيًا، ويسري من تاريخ لا يسبق اليوم ولا يقع في فترة مقفلة. */
function CvApprCard({ org, commitOrg, say, isAdm }) {
  const R = cvApprRanges(org); const open0 = R.find(r => !r.to); const on = !!open0; const [from, setFrom] = useState(today()); const lk = fpLockedTo(org) || '';
  const lastTo = R.reduce((a, r) => (r.to && r.to > a ? r.to : a), '');
  const toggle = async () => {
    if (!isAdm) return;
    if (!on) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return say('اختر تاريخ البدء', 'no');
      if (from < today()) return say('تاريخ البدء لا يسبق اليوم', 'no');
      if (lk && from <= lk) return say('تاريخ البدء داخل فترة مقفلة (حتى ' + lk + ')', 'no');
      if (lastTo && from <= lastTo) return say('تاريخ البدء يجب أن يكون بعد نهاية التفعيل السابق (' + lastTo + ')', 'no');
      if (!window.confirm('تفعيل اعتماد سندات الصرف من ' + from + '؟\nسند الصرف الجديد «بانتظار الاعتماد» بلا أثر حتى يعتمده غير منشئه (سند المالك مباشر بوسم). السندات السابقة كما هي.')) return;
    } else if (!window.confirm('إيقاف من اليوم؟ السندات المسجلة تبقى كما هي.')) return;
    const ok = await commitOrg(o => { const rs = cvApprRanges(o).map(r => ({ ...r }));
      if (on) { const x = rs.find(r => !r.to); if (x) { x.to = today(); x.offAt = nowISO(); } } else rs.push({ from, at: nowISO() });
      return { ...o, cvAppr: { ...(o.cvAppr || {}), ranges: rs } }; },
      { actionType: 'settings', targetType: 'system_settings', targetId: 'cvAppr', title: on ? 'أوقف اعتماد سندات الصرف' : 'فعّل اعتماد سندات الصرف', details: on ? 'حتى ' + today() : 'من ' + from });
    if (ok) say(on ? 'أُوقف — السندات المسجلة كما هي' : 'فُعّل من ' + from + ' ✓');
  };
  return (<div className="card" data-cvappr>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />اعتماد سندات الصرف</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل من ' + open0.from : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بقرار المجلس: سند الصرف الجديد يُحفظ «بانتظار الاعتماد» بلا قيد ولا سداد فاتورة ولا سلفة، حتى يعتمده المحاسب أو الإدارة المالية أو المالك غير منشئه (ويُفحص متبقي الفواتير عند الاعتماد). سند المالك يُرحَّل مباشرة بوسم «رحّله المالك بنفسه». سندات القبض والتحويل والمقاصّة بلا تغيير.
      {R.filter(r => r.to).map((r, i) => <div key={i}>نطاق سابق: {r.from} ← {r.to}</div>)}</div>
    {isAdm && !on && <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}><label style={{ fontSize: 12 }}>يسري من <input className="inp" type="date" aria-label="تاريخ بدء اعتماد سندات الصرف" value={from} min={today()} onChange={e => setFrom(e.target.value)} /></label></div>}
    {isAdm && <div className="row" style={{ marginTop: 8 }}><button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-cvappr-toggle>{on ? 'إيقاف' : 'تفعيل'}</button></div>}
  </div>);
}

/* v56.35 (الدفعة 4 — قرارا المجلس M3/M4): ضوابط التسويق — معطّلة افتراضيًا. لا أثر على أي قيد أو بيانات. */
function MktCtlCard({ org, commitOrg, say, isAdm }) {
  const on = mktCtlOn(org);
  const toggle = async () => { if (!isAdm) return;
    const ok = await commitOrg(o => ({ ...o, mktCtl: { ...(o.mktCtl || {}), on: !on, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'mktCtl', title: on ? 'أوقف ضوابط التسويق' : 'فعّل ضوابط التسويق', details: on ? '' : 'تصدير المركز والموافقين؛ اعتماد ثانٍ للتراجع الذي يمس النقاط' });
    if (ok) say(on ? 'أُوقفت ضوابط التسويق' : 'فُعّلت ضوابط التسويق ✓'); };
  return (<div className="card" data-mktctl>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />ضوابط التسويق (حماية بيانات العملاء)</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّلة' : 'غير مفعّلة'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      بقرار المجلس: تصدير أرقام العملاء للمركز وحده (المدير أو المالك) والموافقين على التسويق فقط؛ وتصدير غير الموافقين للمالك وحده بسبب إلزامي يُسجَّل في سجل التدقيق قبل التنزيل.
      والتراجع عن دمج ملفي عميل يحرّك نقاطًا يصبح طلبًا يعتمده شخص غير صاحبه (التراجع بلا نقاط يكفيه اعتماد واحد).</div>
    {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-mktctl-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
  </div>);
}

/* v56.37 — فصل أسماء عملاء الولاء عن الدفتر المشترك (مراجعة الأمن، توصية مقبولة من المالك) */
function LoyPiiCard({ org, commitOrg, say, isAdm }) {
  const on = loyPiiOn(org); const st = (org && org.loyPii) || {}; const [busy, setBusy] = useState(''); const [plan, setPlan] = useState(null); const [cp, setCp] = useState(null);
  const toggle = async () => { if (!isAdm) return;
    if (on && st.strippedAt) return say('حُذفت الأسماء من الدفتر المشترك — لا يُوقف الفصل وإلا اختفت الأسماء من الشاشات', 'no');
    if (on && !window.confirm('إيقاف الفصل؟\nالأسماء المسجّلة منذ التفعيل محفوظة في سجلات الفروع لكنها لن تظهر في الشاشات حتى تعيد التفعيل.')) return;
    if (!on && !window.confirm('فصل أسماء عملاء الولاء؟\nالنقاط تبقى مشتركة بين الفروع كما هي؛ والاسم الجديد يُحفظ في سجل الفرع الذي جرت فيه الحركة، فلا يراه إلا ذلك الفرع والمركز.')) return;
    const ok = await commitOrg(o => ({ ...o, loyPii: { ...(o.loyPii || {}), on: !on, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'loyPii', title: on ? 'أوقف فصل أسماء عملاء الولاء' : 'فعّل فصل أسماء عملاء الولاء' });
    if (ok) say(on ? 'أُوقف الفصل' : 'فُعّل — الأسماء الجديدة تُحفظ في سجل كل فرع. اضغط «معاينة» لنقل الأسماء القائمة'); };
  const preview = async () => { setBusy('prev'); const d = await cloud.get(KEYS.loy, null).catch(() => null); setBusy(''); setPlan(loyPiiPlan(d || {})); setCp(null); };
  const copy = async () => { if (!isAdm || !on) return; setBusy('copy'); const d = await cloud.get(KEYS.loy, null).catch(() => null); const r = await loyPiiCopy(d || {}); setBusy(''); setCp(r);
    await logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'loyPii', title: 'نقل أسماء عملاء الولاء إلى سجلات الفروع', details: r.plan.names + ' اسمًا إلى ' + r.plan.docs + ' سجلًا' + (r.fail || r.miss ? ' · تعذّر ' + r.fail + ' سجل · ناقص ' + r.miss : '') });
    say(r.fail || r.miss ? 'نُقل جزئيًا — ناقص ' + r.miss + '، أعد المحاولة' : 'نُقلت الأسماء ✓ — الدفتر المشترك لم يتغير بعد', r.fail || r.miss ? 'no' : 'ok'); };
  const strip = async () => { if (!isAdm || !on || !cp || cp.fail || cp.miss) return;
    if (!(await lypReleaseOk())) return say('ارفع الإصدار الإلزامي أولًا: افتح المنصة بحساب المدير بهذا الإصدار ليُحدَّث كل جهاز — وإلا أعاد جهاز قديم الأسماء إلى الدفتر المشترك', 'no');
    if (!window.confirm('حذف ' + (plan ? plan.nMem + plan.nTx : '') + ' اسمًا من الدفتر المشترك؟\nالأسماء محفوظة في سجلات الفروع، والنقاط لا تتغير. بعد الحذف لا يُوقف الفصل.')) return;
    setBusy('strip'); const r = await loyPiiStrip(); setBusy(''); if (r.err) return say(r.err, 'no');
    await commitOrg(o => ({ ...o, loyPii: { ...(o.loyPii || {}), strippedAt: nowISO() } }), { actionType: 'migrate', targetType: 'system_settings', targetId: 'loyPii', title: 'حذف أسماء عملاء الولاء من الدفتر المشترك', details: r.n + ' اسمًا' });
    say('حُذفت الأسماء من الدفتر المشترك ✓'); preview(); };
  return (<div className="card" data-lypii>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />أسماء عملاء الولاء في سجل كل فرع</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? (st.strippedAt ? 'مفعّل · نُقلت الأسماء' : 'مفعّل') : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      اليوم يرى كل عضو أسماء كل عملاء الولاء. مع الفصل: <b>النقاط تبقى مشتركة</b> (يكسب العميل ويستبدل في أي فرع برقم جواله)، و<b>الاسم</b> يُحفظ في سجل الفرع الذي تعامل فيه العميل فلا يراه إلا ذلك الفرع والمركز.
      الخطوات: تفعيل ← معاينة ← نقل الأسماء القائمة ← حذفها من الدفتر المشترك (بعد أن يُلزَم كل جهاز بهذا الإصدار). يبقى رقم الجوال والنقاط مشتركين لأن الاستبدال في أي فرع يحتاجهما. بعد الحذف أعد «المعاينة» دوريًا: «فيه أسماء» يعني جهازًا لم يُحدَّث.</div>
    {plan && <div className="me-row" data-lypii-plan><span className="me-a"><b>في الدفتر المشترك</b><small>أسماء أعضاء {plan.nMem} · أسماء في الحركات {plan.nTx} · تُنقل {plan.names} إلى {plan.docs} سجلًا</small></span><span className={'badge ' + (plan.nMem + plan.nTx ? 'b-amber' : 'b-mint')}>{plan.nMem + plan.nTx ? 'فيه أسماء' : 'بلا أسماء'}</span></div>}
    {cp && <div className="me-row" data-lypii-copy><span className="me-a"><b>النقل</b><small>سجلات {cp.ok}{cp.fail ? ' · تعذّر ' + cp.fail : ''} · ناقص بعد التحقق {cp.miss}</small></span><span className={'badge ' + (cp.fail || cp.miss ? 'b-rose' : 'b-mint')}>{cp.fail || cp.miss ? 'غير مكتمل' : 'مكتمل'}</span></div>}
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-lypii-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
      <button className="btn sm gh" disabled={!!busy} onClick={preview} data-lypii-prev>{busy === 'prev' ? 'جارٍ…' : 'معاينة'}</button>
      {isAdm && on && plan && plan.names > 0 && <button className="btn sm gh" disabled={!!busy} onClick={copy} data-lypii-copybtn>{busy === 'copy' ? 'جارٍ…' : 'نقل الأسماء'}</button>}
      {isAdm && on && cp && !cp.fail && !cp.miss && plan && (plan.nMem + plan.nTx) > 0 && <button className="btn sm no" disabled={!!busy} onClick={strip} data-lypii-strip>{busy === 'strip' ? 'جارٍ…' : 'حذف الأسماء من الدفتر المشترك'}</button>}
    </div>
  </div>);
}

function GrowthRecordsCard({ org, ops, commitOrg, say, isAdm }) {
  const on = grrOn(org); const [busy, setBusy] = useState(''); const [rep, setRep] = useState(null);
  const check = async () => {
    const mmOn = mkmOn(org);   // v56.36: سجلات الدمج حين تُفعَّل ضوابط التسويق أيضًا
    setBusy('check'); const [mc, ly, loy, mm] = await Promise.all([grrLoad('mkt_consents', 'branchId', [], true), grrLoad('loy_tx', 'br', [], true), cloud.get(KEYS.loy, { tx: [] }).catch(() => null), mmOn ? grrLoad('mkt_merges', '', [], true) : Promise.resolve([])]); setBusy('');
    if (!mc || !ly || !mm) return say('السجلات المحمية تعمل على قاعدة Firestore فقط', 'no');
    if (mc.err || ly.err || mm.err) return say('تعذّرت قراءة السجلات (' + (mc.err || ly.err || mm.err) + ') — قد تكون القواعد لم تُنشر بعد', 'no');
    setRep({ mc: mkcCompare(ops.mktConsents || [], mc), ly: lytCompare((loy && loy.tx) || [], ly), ...(mmOn ? { mm: mkmCompare(ops.mktMerges || [], mm), mmBad: mkmViolations(ops.mktMerges || []) } : {}) });
  };
  const toggle = async () => {
    if (!isAdm) return;
    if (!on && !window.confirm('تفعيل نسخ الموافقات التسويقية وحركات الولاء إلى سجلات يحرسها الخادم؟\nالسجل لا يُعدَّل ولا يُحذف، ولا يتغير شيء في البيع أو التسويق اليومي.')) return;
    const ok = await commitOrg(o => ({ ...o, growthRecords: on ? { ...(o.growthRecords || {}), on: false, offAt: nowISO() } : { ...(o.growthRecords || {}), on: true, since: (o.growthRecords || {}).since || nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'growthRecords', title: on ? 'أوقف نسخ سجلات الموافقة والولاء المحمية' : 'فعّل نسخ سجلات الموافقة والولاء المحمية' });
    if (ok) say(on ? 'أُوقف النسخ — السجلات الموجودة تبقى' : 'فُعّل — اضغط «مطابقة» ثم «نسخ التاريخ»');
  };
  const seed = async () => {
    const bad = new Set(((rep && rep.mmBad) || []).map(x => x.id)); const mmMiss = ((rep && rep.mm && rep.mm.missing) || []).filter(x => !bad.has(x.id));   // المخالف لا يُنسخ أبدًا
    if (!isAdm || !on || !rep) return; const n = rep.mc.missing.length + rep.ly.missing.length + mmMiss.length; if (!n) return say('لا ناقص', 'ok');
    if (!window.confirm('نسخ ' + rep.mc.missing.length + ' موافقة و' + rep.ly.missing.length + ' حركة ولاء' + (mmMiss.length ? ' و' + mmMiss.length + ' سجل دمج' : '') + ' إلى السجلات المحمية؟ (لا يُحذف ولا يتغير شيء في المصدر)')) return;
    setBusy('seed'); const a0 = await grrSeed('mkc', rep.mc.missing, (i, t) => setBusy('موافقات ' + i + '/' + t)); const b0 = await grrSeed('lyt', rep.ly.missing, (i, t) => setBusy('ولاء ' + i + '/' + t));
    const m = mmMiss.length ? await mkmSeed(mmMiss, (i, t) => setBusy('دمج ' + i + '/' + t)) : { ok: 0, fail: 0, total: 0 }; setBusy('');
    if (a0.err || b0.err || m.err) return say(a0.err || b0.err || m.err, 'no');
    const a = { ...a0, ok: a0.ok + m.ok, fail: a0.fail + m.fail, lastErr: a0.lastErr || m.lastErr }, b = b0;
    await logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'growthRecords', title: 'نسخ الموافقات وحركات الولاء إلى السجلات المحمية', details: 'موافقات ' + a0.ok + '/' + a0.total + ' · ولاء ' + b.ok + '/' + b.total + (m.total ? ' · دمج ' + m.ok + '/' + m.total : '') + ((a.fail || b.fail) ? ' · تعذّر ' + (a.fail + b.fail) + ' (' + (a.lastErr || b.lastErr) + ')' : '') });
    say((a.fail || b.fail) ? 'نُسخ ' + (a.ok + b.ok) + ' وتعذّر ' + (a.fail + b.fail) : 'نُسخ ' + (a.ok + b.ok) + ' سجلًا ✓', (a.fail || b.fail) ? 'no' : 'ok'); check();
  };
  /* v56.39: مصدر الدمج على الخادم — يُفعَّل بعد مطابقة لا ناقص فيها (غير المخالف)، فلا يسقط دمج تاريخي من الحساب */
  const srcOn = mkmSrcOn(org);
  const toggleSrc = async () => { if (!isAdm) return;
    if (!srcOn) { if (!rep || !rep.mm) return say('اضغط «مطابقة» أولًا', 'no');
      const bad = new Set((rep.mmBad || []).map(x => x.id)); const miss = rep.mm.missing.filter(x => !bad.has(x.id)).length; if (miss) return say('انسخ التاريخ أولًا: ' + miss + ' سجل دمج ناقص', 'no'); if (rep.mm.differ.length) return say(rep.mm.differ.length + ' سجل دمج يختلف عن الخادم — راجعه قبل التفعيل', 'no');
      if (!window.confirm('جعل الخادم مصدر الدمج؟\nكل دمج أو طلب تراجع أو اعتماد أو رفض يُسجَّل في الخادم أولًا، ويرفض الخادم اعتماد صاحب الطلب لطلبه والتراجع بلا طلب عن دمج نقل نقاطًا — فلا تقع العملية أصلًا.' + (bad.size ? '\nتنبيه: ' + bad.size + ' سجل مخالف في المصدر لن يُعتدّ به.' : ''))) return; }
    const ok = await commitOrg(o => ({ ...o, mkmSrc: { ...(o.mkmSrc || {}), on: !srcOn, at: nowISO() } }), { actionType: 'settings', targetType: 'system_settings', targetId: 'mkmSrc', title: srcOn ? 'أوقف مصدر الدمج على الخادم' : 'فعّل مصدر الدمج على الخادم' });
    if (ok) say(srcOn ? 'أُوقف — عاد المصدر المركزي' : 'فُعّل — الخادم مصدر الدمج ✓'); };
  const st = grrState(); const line = (t, r) => r && <div className="me-row"><span className="me-a"><b>{t}</b><small>في المصدر {r.total} · في السجلات {r.recs} · ناقص {r.missing.length} · مختلف {r.differ.length} · زائد {r.extra.length}</small></span><span className={'badge ' + (r.ok ? 'b-mint' : 'b-amber')}>{r.ok ? 'مطابق' : 'غير مطابق'}</span></div>;
  return (<div className="card" data-grr>
    <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />الموافقات التسويقية وحركات الولاء سجلات محمية</div>
      <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'النسخ مفعّل' : 'غير مفعّل'}</span></div>
    <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
      كل موافقة أو إلغاء اشتراك وكل حركة نقاط تُنسخ إلى سجل يحرسه الخادم: <b>يُضاف ولا يُعدَّل ولا يُحذف</b>، والكاتب والوقت من الخادم. المصدر يبقى كما هو في هذه المرحلة.
      {srcOn && <div data-grr-mkmsrc-on><b>الخادم مصدر الدمج:</b> ما يمر عبر الشاشة لا يقع إن رفضه الخادم (اعتماد صاحب الطلب لطلبه، أو تراجع بلا طلب عن دمج نقل نقاطًا)، ولا يُعتدّ بسجل لا يطابق الخادم.</div>}
      {mkmOn(org) && !srcOn && <div data-grr-mkm>ومع ضوابط التسويق تُنسخ سجلات دمج ملفات العملاء أيضًا: يرفض الخادم تسجيل اعتماد صاحب طلب التراجع أو رفضه بنفسه، والتراجع بلا طلب عن دمج نقل نقاطًا — فتظهر المخالفة في المطابقة. المنع الفعلي للعملية نفسها عند نقل المصدر إلى الخادم (مرحلة لاحقة).</div>}
      {on && st.at ? <div>منذ فتح الصفحة: نُسخ {st.ok}{st.fail ? ' · تعذّر ' + st.fail + ' (' + st.lastErr + ')' : ''}</div> : null}</div>
    {rep && <div data-grr-rep>{line('الموافقات التسويقية', rep.mc)}{line('حركات الولاء', rep.ly)}{rep.mm && line('دمج ملفات العملاء', rep.mm)}{rep.mmBad && rep.mmBad.length > 0 && <div className="me-row" data-grr-mkmbad><span className="me-a"><b>مخالف لفصل المهام في المصدر</b><small>{rep.mmBad.length} سجل (اعتماد أو رفض بيد صاحب الطلب، أو تراجع بلا طلب عن دمج نقل نقاطًا) — لا يُنسخ، ويستحق المراجعة</small></span><span className="badge b-rose">مخالف</span></div>}</div>}
    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {isAdm && <button className={'btn sm ' + (on ? 'gh' : 'pri')} onClick={toggle} data-grr-toggle>{on ? 'إيقاف' : 'تفعيل'}</button>}
      <button className="btn sm gh" disabled={!!busy} onClick={check} data-grr-check>{busy === 'check' ? 'جارٍ…' : 'مطابقة'}</button>
      {isAdm && mkmOn(org) && <button className={'btn sm ' + (srcOn ? 'gh' : 'pri')} disabled={!!busy} onClick={toggleSrc} data-grr-mkmsrc>{srcOn ? 'إيقاف مصدر الدمج على الخادم' : 'الخادم مصدر الدمج'}</button>}
      {isAdm && on && rep && <button className="btn sm gh" disabled={!!busy} onClick={seed} data-grr-seed>{busy && busy !== 'check' ? busy : 'نسخ التاريخ'}</button>}
    </div>
  </div>);
}
function PosRecordsCard({ org, ops, commitOrg, say, isAdm }) {
  const on = posrOn(org);
  const [busy, setBusy] = useState(''); const [rep, setRep] = useState(null);
  const orders = ops.posOrders || [];
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || { name: id }).name;
  const check = async () => {
    setBusy('check'); const recs = await posrLoad([], true); setBusy('');
    if (!recs) return say('السجلات المستقلة تعمل على قاعدة Firestore فقط', 'no');
    if (recs.err) return say('تعذّرت قراءة السجلات (' + recs.err + ') — قد تكون القواعد لم تُنشر بعد', 'no');
    setRep(posrCompare(orders, recs));
  };
  const toggle = async () => {
    if (!isAdm) return;
    if (!on && !window.confirm('تفعيل نسخ كل فاتورة نقطة بيع إلى سجل مستقل يحرسه الخادم؟\nمستندات الفروع تبقى المصدر، ولا يتغير شيء في البيع اليومي. السجل لا تُعدَّل أرقامه ولا يُحذف.')) return;
    const ok = await commitOrg(o => ({ ...o, posRecords: on ? { ...(o.posRecords || {}), on: false, offAt: nowISO() } : { ...(o.posRecords || {}), on: true, since: (o.posRecords || {}).since || nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'posRecords', title: on ? 'أوقف نسخ فواتير نقطة البيع إلى السجلات المستقلة' : 'فعّل نسخ فواتير نقطة البيع إلى السجلات المستقلة' });
    if (ok) say(on ? 'أُوقف النسخ — السجلات الموجودة تبقى' : 'فُعّل النسخ — اضغط «نسخ الفواتير القائمة» ثم «مطابقة»');
  };
  const seed = async () => {
    if (!isAdm || !on) return;
    const todo = rep ? [...rep.missing, ...rep.differ.filter(o => o.status === 'void')] : orders;
    if (!window.confirm('نسخ ' + todo.length + ' فاتورة إلى السجلات المستقلة؟ (لا يُحذف ولا يتغير شيء في مستندات الفروع؛ ما في فترة مقفلة يُتخطى)')) return;
    setBusy('seed'); const r = await posrSeed(todo, fpLockedTo(org), (i, t) => setBusy('seed ' + i + '/' + t)); setBusy('');
    if (r.err) return say(r.err, 'no');
    await logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'posRecords', title: 'نسخ فواتير نقطة البيع إلى السجلات المستقلة', details: r.ok + ' من ' + r.total + (r.locked ? ' · فترة مقفلة ' + r.locked : '') + (r.fail ? ' · تعذّر ' + r.fail + ' (' + r.lastErr + ')' : '') });
    say(r.fail ? 'نُسخ ' + r.ok + ' وتعذّر ' + r.fail + ' (' + r.lastErr + ')' : 'نُسخت ' + r.ok + ' فاتورة ✓' + (r.locked ? ' · تُخطّي ' + r.locked + ' في فترة مقفلة' : ''), r.fail ? 'no' : 'ok');
    check();
  };
  // v56.6 (قرار المالك): إصلاح سجل «مختلف» من الفاتورة الأصلية — لمسؤول النظام، بسبب مكتوب، ويُسجَّل في سجل التدقيق
  const repair = async (o) => {
    if (!isAdm) return;
    const why = window.prompt('سبب إصلاح سجل الفاتورة ' + (o.no || o.id) + ' (يُحفظ في السجل وفي سجل التدقيق):'); if (!why || why.trim().length < 5) return say('اكتب سببًا واضحًا (5 أحرف على الأقل)', 'no');
    setBusy('fix'); const r = await posrRepair(o, why.trim()); setBusy('');
    if (r.err) return say('تعذّر الإصلاح (' + r.err + ')', 'no');
    await logAudit({ actionType: 'update', targetType: 'pos_order', targetId: o.id, title: 'أصلح سجل فاتورة نقطة بيع محميًا', details: (o.no || o.id) + ' · ' + why.trim().slice(0, 300) });
    say('أُصلح سجل الفاتورة ' + (o.no || o.id) + ' ✓'); check();
  };
  const st = posrState();
  const row = (o, why, fix) => <div key={o.id} className="me-row"><span className="me-a"><b>{brName(o.branchId)} — {o.no || o.id} · {o.date || ''}</b><small>{why}</small></span>
    {fix && isAdm && <button className="btn sm gh" disabled={!!busy} onClick={() => repair(o)}>إصلاح</button>}</div>;
  return (
    <div className="card" data-posr>
      <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />فواتير نقطة البيع سجلات مستقلة (حماية على مستوى الخادم)</div>
        <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'النسخ مفعّل' : 'غير مفعّل'}</span></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        كل فاتورة تُنسخ إلى سجل مستقل يحرسه الخادم: <b>أرقامها لا تُعدَّل ولا تُحذف</b>، والإلغاء والمرتجع لمدير الفرع فقط، ولا كتابة في فترة مقفلة.
        في هذه المرحلة يبقى مستند الفرع هو المصدر، والمطابقة تكشف أي فرق.
      </div>
      {isAdm && <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={'btn sm' + (on ? ' gh' : ' pri')} disabled={!!busy} onClick={toggle}>{on ? 'إيقاف النسخ' : 'تفعيل النسخ'}</button>
        {on && <button className="btn sm" disabled={!!busy} onClick={seed}>{busy.startsWith('seed') ? 'جارٍ النسخ… ' + busy.slice(5) : (rep ? 'نسخ الناقص' : 'نسخ الفواتير القائمة')}</button>}
        <button className="btn sm" disabled={!!busy} onClick={check}><RefreshCw size={13} />{busy === 'check' ? 'جارٍ المطابقة…' : 'مطابقة'}</button>
      </div>}
      {(st.ok > 0 || st.fail > 0) && <div style={{ fontSize: 12, marginTop: 8 }}>في هذه الجلسة: نُسخ {st.ok}{st.fail ? ' · تعذّر ' + st.fail + ' (' + st.lastErr + ')' : ''}</div>}
      {rep && <div style={{ marginTop: 10 }}>
        <div className={'note ' + (rep.ok ? 'ok' : 'warn')}>{rep.ok ? '✓ مطابقة كاملة: ' + rep.total + ' فاتورة و' + rep.recs + ' سجلًا' : 'فروق: ناقص ' + rep.missing.length + ' · مختلف ' + rep.differ.length}{rep.extra.length ? ' · سجلات بلا فاتورة في المستند (مؤرشفة) ' + rep.extra.length : ''}</div>
        {rep.differ.slice(0, 8).map(o => row(o, 'مختلف عن السجل (الأرقام أو حالة الإلغاء)', true))}
        {rep.missing.slice(0, 8).map(o => row(o, 'لا سجل له بعد'))}
      </div>}
    </div>);
}

/* v41.9 — الإغلاقات سجلات مستقلة (المرحلة الأولى: نسخ مطابق) — تفعيل، ترحيل أول، ومطابقة */
function ClosingRecordsCard({ org, ops, me, commitOrg, say, isAdm }) {
  const on = clrOn(org), reading = clrRead(org);
  const [busy, setBusy] = useState(''); const [rep, setRep] = useState(null);
  // v42.2: القراءة من السجلات — لا تُفعَّل إلا بعد مطابقة نظيفة في هذه الجلسة، والإيقاف متاح دائمًا للتراجع
  const toggleRead = async () => {
    if (!isAdm || !on) return;
    if (!reading && !(rep && rep.ok)) return say('اضغط «مطابقة» أولًا — القراءة من السجلات لا تُفعَّل إلا بعد مطابقة كاملة بلا فروق', 'no');
    if (!reading && !window.confirm('تحويل قراءة الإغلاقات إلى السجلات المستقلة المحمية؟\nالسجل يصبح المصدر لأرقام الإغلاق وحالته واعتماده؛ أي تعديل في مستند الفرع لا يظهر. يبقى مستند الفرع نسخة احتياطية، والإيقاف متاح في أي وقت.')) return;
    const ok = await commitOrg(o => ({ ...o, closingRecords: { ...(o.closingRecords || {}), read: !reading, ...(reading ? { readOffAt: nowISO() } : { readSince: nowISO() }) } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'closingRecords', title: reading ? 'أعاد قراءة الإغلاقات إلى مستندات الفروع' : 'حوّل قراءة الإغلاقات إلى السجلات المستقلة المحمية' });
    if (ok) say(reading ? 'عادت القراءة إلى مستندات الفروع' : 'أصبحت السجلات المستقلة مصدر الإغلاقات ✓');
  };
  const vs = clrViewStats();
  const brName = (id) => ((org.branches || []).find(b => b.id === id) || { name: id }).name;
  const check = async () => {
    setBusy('check'); const recs = await clrLoad([], true); setBusy('');
    if (!recs) return say('السجلات المستقلة تعمل على قاعدة Firestore فقط', 'no');
    if (recs.err) return say('تعذّرت قراءة السجلات (' + recs.err + ') — قد تكون القواعد لم تُنشر بعد', 'no');
    setRep(clrCompare(ops.closings || [], recs));
  };
  const toggle = async () => {
    if (!isAdm) return;
    if (!on && !window.confirm('تفعيل نسخ كل إغلاق إلى سجل مستقل تحرسه القواعد؟\nمستند الفرع يبقى المصدر في هذه المرحلة، ولا يتغير شيء في العمل اليومي.')) return;
    const ok = await commitOrg(o => ({ ...o, closingRecords: on ? { ...(o.closingRecords || {}), on: false, offAt: nowISO() } : { ...(o.closingRecords || {}), on: true, since: (o.closingRecords || {}).since || nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'closingRecords', title: on ? 'أوقف نسخ الإغلاقات إلى السجلات المستقلة' : 'فعّل نسخ الإغلاقات إلى السجلات المستقلة' });
    if (ok) say(on ? 'أُوقف النسخ' : 'فُعّل النسخ — اضغط «ترحيل الإغلاقات الحالية» ثم «مطابقة»');
  };
  const seed = async () => {
    if (!isAdm || !on) return;
    const n = (ops.closings || []).length;
    if (!window.confirm('نسخ ' + n + ' إغلاقًا إلى السجلات المستقلة؟ (لا يُحذف ولا يتغير شيء في مستندات الفروع)')) return;
    setBusy('seed'); const r = await clrSeed(ops.closings || [], (i, t) => setBusy('seed ' + i + '/' + t)); setBusy('');
    if (r.err) return say(r.err, 'no');
    await logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'closingRecords', title: 'رحّل الإغلاقات إلى السجلات المستقلة', details: r.ok + ' من ' + r.total + (r.fail ? ' · تعذّر ' + r.fail + ' (' + r.lastErr + ')' : '') });
    say(r.fail ? 'نُسخ ' + r.ok + ' وتعذّر ' + r.fail + ' (' + r.lastErr + ')' : 'نُسخت ' + r.ok + ' إغلاقًا ✓', r.fail ? 'no' : 'ok');
    check();
  };
  const st = clrState();
  const row = (c, why) => <div key={c.id} className="me-row"><span className="me-a"><b>{brName(c.branchId)} — {c.date || ''}</b><small>{why}</small></span></div>;
  return (
    <div className="card" data-clr>
      <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />الإغلاقات سجلات مستقلة (حماية على مستوى الخادم)</div>
        <span className={'badge ' + (reading ? 'b-mint' : on ? 'b-sky' : 'b-dim')}>{reading ? 'المصدر: السجلات المحمية' : on ? 'النسخ مفعّل' : 'غير مفعّل'}</span></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        كل إغلاق يُنسخ إلى سجل مستقل يرى الخادم حالته: <b>الفرع لا يكتب «معتمد» ولا يعدّل إغلاقًا معتمدًا</b>، والاعتماد والرفض لا يُقبلان إلا بتوقيع موثّق
        للمدقق نفسه وبالأرقام نفسها. في هذه المرحلة يبقى مستند الفرع هو المصدر، والمطابقة تكشف أي فرق؛ وبعد ثبات المطابقة تتحول القراءة إلى السجلات.
      </div>
      {isAdm && <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={'btn sm' + (on ? ' gh' : ' pri')} disabled={!!busy} onClick={toggle}>{on ? 'إيقاف النسخ' : 'تفعيل النسخ'}</button>
        {on && <button className="btn sm" disabled={!!busy} onClick={seed}>{busy.startsWith('seed') ? 'جارٍ الترحيل… ' + busy.slice(5) : 'ترحيل الإغلاقات الحالية'}</button>}
        <button className="btn sm" disabled={!!busy} onClick={check}><RefreshCw size={13} />{busy === 'check' ? 'جارٍ المطابقة…' : 'مطابقة'}</button>
        {on && <button className={'btn sm' + (reading ? ' gh' : ' pri')} disabled={!!busy || (!reading && !(rep && rep.ok))} onClick={toggleRead}
          title={!reading && !(rep && rep.ok) ? 'يتاح بعد مطابقة كاملة بلا فروق' : ''}>{reading ? 'إعادة القراءة إلى مستندات الفروع' : 'القراءة من السجلات المحمية'}</button>}
      </div>}
      {reading && vs.at > 0 && <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.9 }}>
        يُعرض الآن <b>{vs.fromRec}</b> إغلاقًا من السجلات المحمية
        {vs.fixed > 0 && <> · <span style={{ color: 'var(--rose)' }}><b>{vs.fixed}</b> مختلف في مستند الفرع (المعروض قيمة السجل)</span></>}
        {vs.unrec > 0 && <> · <span style={{ color: 'var(--amber)' }}><b>{vs.unrec}</b> بلا سجل{vs.demoted > 0 ? ' (منها ' + vs.demoted + ' «معتمد» عُرض مرحّلًا)' : ''}</span></>}
        {vs.badDigest > 0 && <> · <span style={{ color: 'var(--rose)' }}><b>{vs.badDigest}</b> أرقامه لا تطابق بصمة اعتماده</span></>}
      </div>}
      {st.at > 0 && <div style={{ fontSize: 11.5, color: st.fail ? 'var(--rose)' : 'var(--dim)', marginTop: 8 }}>هذا الجهاز: نُسخ {st.ok}{st.fail ? ' · تعذّر ' + st.fail + ' (' + st.lastErr + ')' : ''}</div>}
      {rep && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: rep.ok ? 'var(--mint)' : 'var(--rose)' }}>
          {rep.ok ? '✓ متطابقة: ' + rep.total + ' إغلاقًا في مستندات الفروع = ' + rep.recs + ' سجلًا مستقلًا' : 'غير متطابقة: ناقص ' + rep.missing.length + ' · مختلف ' + rep.differ.length + ' · زائد ' + rep.extra.length}
        </div>
        {!rep.ok && <div className="me-list" style={{ marginTop: 6 }}>
          {rep.differ.slice(0, 15).map(c => row(c, 'مختلف عن سجله المستقل — عُدّل في مستند الفرع دون المرور بالسجل'))}
          {rep.missing.slice(0, 15).map(c => row(c, 'لا سجل مستقل له — شغّل «ترحيل الإغلاقات الحالية»'))}
          {rep.extra.slice(0, 15).map(c => row(c, 'سجل مستقل بلا إغلاق في مستند الفرع (حُذف أو أُرشف)'))}
        </div>}
      </div>}
    </div>
  );
}

/* v49.0 — المرحلة 01 (قرار G1-ب): القيود اليدوية سجلات مستقلة يحرسها الخادم — تفعيل النسخ ومطابقة (ناقص · مختلف · زائد)
   ترحيل القيود القديمة وتحويل القراءة خطوتان لاحقتان تتطلبان موافقة المالك (G4). */
function JournalRecordsCard({ org, ops, commitOrg, say, isAdm }) {
  const on = fjOn(org);
  const [busy, setBusy] = useState(''); const [rep, setRep] = useState(null); const [mig, setMig] = useState(null);
  // G4: نافذة الترحيل — تُفتح لساعات محدودة، والترحيل يكتب الناقص فقط ثم تُعاد المطابقة
  const winSet = async (open) => {
    if (!isAdm || !on) return;
    if (open && !window.confirm('فتح نافذة ترحيل القيود القديمة لمدة 6 ساعات؟\nخلالها فقط يستطيع المدير نسخ القيود الناقصة بحالتها الأصلية، ثم تُغلق تلقائيًا. لا يُحذف ولا يتغير أي قيد.')) return;
    setBusy('win'); const r = await fmSet(open); setBusy('');
    if (r.err) return say('تعذّر ' + (open ? 'فتح' : 'إغلاق') + ' النافذة (' + r.err + ')', 'no');
    await logAudit({ actionType: 'settings', targetType: 'system_settings', targetId: 'finMigration', title: open ? 'فتح نافذة ترحيل القيود القديمة (6 ساعات)' : 'أغلق نافذة ترحيل القيود' });
    setMig(await fmLoad()); say(open ? 'فُتحت النافذة ✓ — اضغط «مطابقة» ثم «ترحيل القيود الناقصة»' : 'أُغلقت النافذة ✓');
  };
  const missN = rep ? rep.missing.length + Object.values(rep.docs || {}).reduce((a, x) => a + x.missing.length, 0) : 0;
  const seed = async () => {
    if (!isAdm || !rep || !missN) return;
    if (!window.confirm('نسخ ' + missN + ' مستندًا ناقصًا (قيود وفواتير وسندات) إلى السجلات المحمية بحالتها الأصلية؟ (لا يتغير شيء في البيانات الحالية)')) return;
    setBusy('seed'); const r = await fjSeed(rep.missing, (i, t) => setBusy('seed ' + i + '/' + t));
    if (r.err) { setBusy(''); return say(r.err, 'no'); }
    for (const k of Object.keys(rep.docs || {})) { if (!rep.docs[k].missing.length) continue;
      const q = await fdSeed(k, rep.docs[k].missing, (i, t) => setBusy('seed ' + k + ' ' + i + '/' + t));
      if (!q.err) { r.ok += q.ok; r.fail += q.fail; r.total += q.total; if (q.lastErr) r.lastErr = q.lastErr; } }
    setBusy('');
    await logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'finRecords', title: 'رحّل القيود اليدوية القديمة إلى السجلات المحمية', details: r.ok + ' من ' + r.total + (r.fail ? ' · تعذّر ' + r.fail + ' (' + r.lastErr + ')' : '') });
    say(r.fail ? 'نُسخ ' + r.ok + ' وتعذّر ' + r.fail + ' (' + r.lastErr + ')' : 'نُسخ ' + r.ok + ' قيدًا ✓ — أُعيدت المطابقة', r.fail ? 'no' : 'ok');
    check();
  };
  const toggle = async () => {
    if (!isAdm) return;
    if (!on && !window.confirm('تفعيل نسخ كل قيد يدوي وفاتورة وسند إلى سجل مستقل يحرسه الخادم؟\nالبيانات الحالية تبقى المصدر ولا يتغير شيء في الدفاتر؛ النسخ إضافي ويمكن إيقافه.')) return;
    const ok = await commitOrg(o => ({ ...o, finRecords: on ? { ...(o.finRecords || {}), on: false, offAt: nowISO() } : { ...(o.finRecords || {}), on: true, since: (o.finRecords || {}).since || nowISO() } }),
      { actionType: 'settings', targetType: 'system_settings', targetId: 'finRecords', title: on ? 'أوقف نسخ القيود اليدوية إلى السجلات المستقلة' : 'فعّل نسخ القيود اليدوية إلى السجلات المستقلة' });
    if (ok) say(on ? 'أُوقف النسخ' : 'فُعّل النسخ — القيود الجديدة تُنسخ من الآن، واضغط «مطابقة» للمتابعة');
  };
  const check = async () => {
    setBusy('check'); const recs = await fjLoad(); setBusy('');
    if (!recs) return say('السجلات المستقلة تعمل على قاعدة Firestore فقط', 'no');
    if (recs.err) return say('تعذّرت قراءة السجلات (' + recs.err + ') — قد تكون القواعد لم تُنشر بعد', 'no');
    const lk = await fpLoad(); setMig(await fmLoad());
    // v49.0 الخطوة 6: الفواتير والسندات في المطابقة نفسها
    const drecs = await fdLoad(); const docs = {};
    if (drecs && !drecs.err) Object.keys(FD_KINDS).forEach(k => { docs[k] = fdCompare(k, ops[FD_KINDS[k].col] || [], drecs); });
    const j = fjCompare(ops.journalManual || [], recs);
    setRep({ ...j, jeOk: j.ok, ok: j.ok && Object.values(docs).every(x => x.ok) && !(drecs && drecs.err), docs, docsErr: drecs && drecs.err, lockApp: fpLockedTo(org), lockSrv: lk && !lk.err ? lk.lockedTo : '?' });
  };
  const st = fjState();
  const row = (j, why) => <div key={j.id} className="me-row"><span className="me-a"><b>{(j.title || j.id) + ' — ' + (j.date || '')}</b><small>{why}</small></span></div>;
  return (
    <div className="card" data-fjrec>
      <div className="card-h"><div className="card-t"><ShieldCheck size={15} color="var(--brass)" />القيود والفواتير والسندات سجلات مستقلة (حماية على مستوى الخادم)</div>
        <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'النسخ مفعّل' : 'غير مفعّل'}</span></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        كل قيد يدوي وفاتورة وسند يُنسخ إلى سجل مستقل يفرض الخادم قواعده: <b>لا مستند جديد في فترة مقفلة، ولا يعتمد المحاسب قيده، ولا يتغير محتوى مستند بعد إنشائه (السداد وحده يتغير)، ولا يُحذف قيد معتمد ولا فاتورة مبيعات ولا سند</b>.
        في هذه المرحلة تبقى القيود الحالية هي المصدر، والمطابقة تكشف الناقص والمختلف والزائد. القيود القديمة تُرحَّل عبر «نافذة الترحيل» المؤقتة (6 ساعات، للمدير فقط)، وتحويل القراءة إلى السجلات خطوة لاحقة بموافقة المالك.
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {isAdm && <button className={'btn sm' + (on ? ' gh' : ' pri')} disabled={!!busy} onClick={toggle} data-fjtoggle>{on ? 'إيقاف النسخ' : 'تفعيل النسخ'}</button>}
        {isAdm && on && mig && !mig.err && <button className={'btn sm' + (mig.open ? ' gh' : '')} disabled={!!busy} onClick={() => winSet(!mig.open)} data-fjwin>{mig.open ? 'إغلاق نافذة الترحيل' : 'فتح نافذة الترحيل (6 ساعات)'}</button>}
        {isAdm && on && mig && mig.open && missN > 0 && <button className="btn sm pri" disabled={!!busy} onClick={seed} data-fjseed>{busy.startsWith('seed') ? 'جارٍ الترحيل… ' + busy.slice(5) : 'ترحيل الناقص (' + missN + ')'}</button>}
        <button className="btn sm" disabled={!!busy} onClick={check} data-fjcheck><RefreshCw size={13} />{busy === 'check' ? 'جارٍ المطابقة…' : 'مطابقة'}</button>
      </div>
      {st.at > 0 && <div style={{ fontSize: 11.5, color: st.fail ? 'var(--rose)' : 'var(--dim)', marginTop: 8 }}>هذا الجهاز: نُسخ {st.ok}{st.fail ? ' · تعذّر ' + st.fail + ' (' + st.lastErr + ')' : ''}{st.skip ? ' · لم يُنسخ ' + st.skip + ' تعديلًا على قيد قائم' : ''}</div>}
      {rep && <div style={{ marginTop: 10 }} data-fjrep>
        <div style={{ fontSize: 13, fontWeight: 700, color: rep.ok ? 'var(--mint)' : 'var(--rose)' }}>
          {rep.ok ? '✓ كل السجلات متطابقة' : 'غير متطابقة — التفاصيل أدناه'}
        </div>
        <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.9 }} data-fjkinds>
          {[['القيود اليدوية', { ok: rep.jeOk, total: rep.total, recs: rep.recs, missing: rep.missing, differ: rep.differ, extra: rep.extra }], ...Object.keys(rep.docs || {}).map(k => [FD_KINDS[k].ar, rep.docs[k]])].map(([n, x]) =>
            <div key={n} style={{ color: x.ok ? 'var(--mint)' : 'var(--rose)' }}>{n}: {x.ok ? '✓ ' + x.total + ' = ' + x.recs : 'ناقص ' + x.missing.length + ' · مختلف ' + x.differ.length + ' · زائد ' + x.extra.length}</div>)}
          {rep.docsErr && <div style={{ color: 'var(--rose)' }}>تعذّرت قراءة سجلات الفواتير والسندات ({rep.docsErr})</div>}
        </div>
        {mig && mig.open && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--amber)' }} data-fjmig>نافذة الترحيل مفتوحة حتى {new Date(mig.until).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</div>}
        <div style={{ fontSize: 12, marginTop: 4, color: rep.lockApp === rep.lockSrv ? 'var(--dim)' : 'var(--rose)' }} data-fjlock>
          إقفال الفترات: التطبيق حتى {rep.lockApp === '0000-00-00' ? 'لا قفل' : rep.lockApp} · الخادم حتى {rep.lockSrv === '0000-00-00' ? 'لا قفل' : rep.lockSrv}{rep.lockApp === rep.lockSrv ? ' ✓' : ' — غير متطابق (يُصحَّح بإعادة حفظ القفل من المدير)'}
        </div>
        {!rep.jeOk && <div className="me-list" style={{ marginTop: 6 }}>
          {rep.differ.slice(0, 15).map(j => row(j, 'مختلف عن سجله المستقل — عُدّل محتواه أو حالته خارج المسار المحمي'))}
          {rep.missing.slice(0, 15).map(j => row(j, 'لا سجل مستقل له — قيد سابق للتفعيل أو تعذّر نسخه'))}
          {rep.extra.slice(0, 15).map(r => row({ id: r.id, date: r.date, title: r.id }, 'سجل مستقل بلا قيد مقابل (حُذف من الوثيقة)'))}
        </div>}
      </div>}
    </div>
  );
}

/* v52.7 — G3 الخيار A (قرار المالك): فصل فواتير نقطة البيع إلى مستند شهري لكل فرع — بفرع واحد في كل مرة، مع تحقق وتراجع */
function PosSplitCard({ org, ops, me, say, isAdm, commit }) {
  const brs = (org.branches || []); const [st, setSt] = useState(null); const [busy, setBusy] = useState('');
  const counts = useMemo(() => { const m = {}; (ops.posOrders || []).forEach(o => { m[o.branchId] = (m[o.branchId] || 0) + 1; }); return m; }, [ops.posOrders]);
  const check = async () => { setBusy('check'); const out = {};
    for (const b of brs) { const r = await cloud.tryGet(brKey(b.id)); out[b.id] = r.denied ? 'denied' : r.failed ? 'failed' : posSplitOn(r.value) ? 'split' : 'single'; }
    setSt(out); setBusy(''); };
  const log = (b, title, details) => logAudit({ actionType: 'migrate', targetType: 'system_settings', targetId: 'pos_split:' + b.id, branchName: b.name, title, details });
  const run = async (b, undo) => {
    const msg = undo ? 'التراجع عن فصل فواتير «' + b.name + '»؟\n\nتعود كل فواتير الفرع إلى مستنده الواحد كما كانت. المستندات الشهرية تبقى كما هي (لا حذف).'
      : 'فصل فواتير نقطة البيع لفرع «' + b.name + '» (' + (counts[b.id] || 0) + ' فاتورة) إلى مستند لكل شهر؟\n\n• نزّل نسخة احتياطية أولًا (أعلى هذه الصفحة).\n• تُكتب الأشهر ثم يُتحقق منها بإعادة القراءة (العدد والمجموع لكل شهر)، ولا يتغير مستند الفرع إن فشل التحقق.\n• يمكن التراجع لاحقًا.\n• بعده يُفضَّل رفع «الحد الأدنى للإصدار» كي لا تكتب أجهزة بإصدار قديم.';
    if (!window.confirm(msg)) return;
    setBusy(b.id);
    try { const r = undo ? await posUnsplitBranch(b.id) : await posSplitBranch(b.id);
      if (!r.ok) { say(r.err || 'تعذّر', 'no'); return; }
      if (!r.already) await log(b, undo ? 'تراجع عن فصل فواتير نقطة البيع' : 'فصل فواتير نقطة البيع إلى مستندات شهرية', undo ? (r.n || 0) + ' فاتورة عادت لمستند الفرع' : (r.n || 0) + ' فاتورة · ' + (r.months || 0) + ' شهر · بواسطة ' + ((me || {}).name || ''));
      say(r.already ? 'لا تغيير — الفرع ' + (undo ? 'غير مفصول' : 'مفصول') + ' أصلًا' : undo ? 'تم التراجع لفرع ' + b.name : 'فُصلت فواتير ' + b.name + ': ' + r.n + ' فاتورة في ' + r.months + ' شهر ✓');
      await check();
    } finally { setBusy(''); }
  };
  const ST = { split: ['b-mint', 'مفصول شهريًا'], single: ['b-dim', 'مستند واحد'], failed: ['b-amber', 'تعذّرت القراءة'], denied: ['b-rose', 'لا صلاحية'] };
  return (<div className="card" data-possplit>
    <div className="card-h"><div className="card-t"><HardDrive size={15} color="var(--brass)" />فصل فواتير نقطة البيع شهريًا (G3)</div>
      {isAdm && <button className="btn sm" disabled={!!busy} onClick={check}>{busy === 'check' ? 'جارٍ الفحص…' : 'فحص الحالة'}</button>}</div>
    <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>قرارك (G3 — الخيار A): فواتير كل فرع في مستند لكل شهر، فلا يُعاد رفع فواتير السنة كلها مع كل حفظ. ابدأ بالمنشأة التجريبية ثم بفرع واحد هنا. كل الشاشات والتقارير تعمل كما هي.</div>
    {!isAdm && <div className="note">لمدير النظام فقط.</div>}
    {isAdm && <div className="me-list">{brs.map(b => { const s = st && st[b.id]; return <div key={b.id} className="me-row" data-posbr={b.id}>
      <span className="me-a"><b>{b.name}</b><small><span className="num">{counts[b.id] || 0}</span> فاتورة محمّلة{s ? <> · <span className={'badge ' + ST[s][0]}>{ST[s][1]}</span></> : null}</small></span>
      {s === 'single' && <button className="btn sm pri" disabled={!!busy} onClick={() => run(b, false)}>{busy === b.id ? 'جارٍ الفصل…' : 'فصل شهريًا'}</button>}
      {s === 'split' && <button className="btn sm gh" disabled={!!busy} onClick={() => run(b, true)}>{busy === b.id ? 'جارٍ…' : 'تراجع'}</button>}
    </div>; })}</div>}
  </div>);
}

