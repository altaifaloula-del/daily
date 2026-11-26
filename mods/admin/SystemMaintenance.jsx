/* v38.5 — صيانة النظام: حالة الخدمات، فحوص سلامة البيانات الآلية، وسجل أخطاء الأجهزة المركزي
   • الفحوص تعمل تلقائيًا عند فتح الشاشة على بيانات المنصّة نفسها (بلا تعديل) وتعرض لكل خلل مكانه وطريقة علاجه.
   • سجل الأخطاء: كل خطأ يقع على أي جهاز (بعد الدخول) يصل هنا مجمّعًا حسب نوعه — بلا بيانات تشغيل. */
import React, { useState, useEffect, useMemo } from 'react';
import { cloud, KEYS, brKey } from '../../storage';
import { ShieldCheck, RefreshCw, Trash2, AlertTriangle, Check, Server, Bug, Activity, HardDrive } from 'lucide-react';
import { archKey, archivePlan, nowISO, printA4, uid, dtLocal, posSplitBranch, posUnsplitBranch, posSplitOn } from '../../App.jsx';   // v41.7 + v52.7
import { clrCompare, clrLoad, clrOn, clrSeed, clrState, logAudit, clrRead, clrViewStats } from '../../App.jsx';   // v41.9 + v42.2
import { posrOn, posrCompare, posrLoad, posrSeed, posrState, posrRepair } from '../../App.jsx';   // v56.4 (POS 2a) سجلات فواتير نقطة البيع
import { WorkflowsCard } from './Workflows.jsx';   // v49.5 MQ-059
import { FL_START, flOn, flScope, flCompare, flLoad, flPost } from '../../App.jsx';   // v56.9 D1 دفتر القيود المخزّن
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
  const scope = useMemo(() => { try { return flScope(ops, buildAccounting(org, ops)); } catch { return []; } }, [org, ops]);
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
        <span className={'badge ' + (on ? 'b-sky' : 'b-dim')}>{on ? 'مفعّل — القراءة من المحرك' : 'غير مفعّل'}</span></div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.9, marginBottom: 8 }}>
        كل قيد يُحفظ <b>مرة واحدة برقم ثابت</b> مثل JV-2026-000001 يبدأ من 1 كل سنة، ولا يُعدَّل محتواه ولا يُحذف — والخادم يرفض أي تعديل.
        النطاق الآن: <b>القيد الافتتاحي بأرصدة 2025-12-31</b> + <b>قيود الإغلاقات المعتمدة من {FL_START}</b> ({scope.length} قيدًا).
        بعد التفعيل يُرحَّل قيد كل إغلاق <b>تلقائيًا عند تدقيقه</b>، و«ترحيل الناقص» يلحق بما تعذّر. التقارير ما زالت من المحرك حتى تثبت المطابقة.
      </div>
      {isAdm && <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className={'btn sm' + (on ? ' gh' : ' pri')} disabled={!!busy} onClick={toggle}>{on ? 'إيقاف' : 'تفعيل'}</button>
        {on && <button className="btn sm" disabled={!!busy} onClick={check}><RefreshCw size={13} />{busy === 'check' ? 'جارٍ المطابقة…' : 'مطابقة'}</button>}
        {on && rep && rep.missing.length > 0 && <button className="btn sm pri" disabled={!!busy} onClick={post}>{busy.startsWith('post') ? 'جارٍ الترحيل… ' + busy.slice(5) : 'ترحيل الناقص (' + rep.missing.length + ')'}</button>}
      </div>}
      {rep && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: rep.ok ? 'var(--mint)' : 'var(--amber)' }}>
          {rep.ok ? '✓ متطابق: ' + rep.total + ' قيدًا في المحرك = ' + rep.recs + ' في الدفتر' : 'ناقص ' + rep.missing.length + ' · مختلف ' + rep.differ.length + ' · زائد ' + rep.extra.length + (rep.bad.length ? ' · لا يتطابق بالهللة ' + rep.bad.length : '')}
        </div>
        {!rep.ok && <div className="me-list" style={{ marginTop: 6 }}>
          {rep.differ.slice(0, 10).map(e => row(e, 'تغيّر مصدره بعد الترحيل — التصحيح بقيد عكسي في الدفعة القادمة'))}
          {rep.bad.slice(0, 10).map(e => row(e, 'لا يتطابق بالهللة — لا يُرحَّل حتى يُصحَّح'))}
          {rep.extra.slice(0, 10).map(r => row(r, 'قيد مخزّن لم يعد له مصدر معتمد (' + (r.no || '') + ')'))}
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

