/* نُقل من App.jsx (v38.3) — يُحمَّل عند فتح التطبيق فقط */
import React, { useState, useMemo } from 'react';
import { Bell, AlertTriangle, Settings, Check, Clock, Sparkles, ChevronLeft } from 'lucide-react';
import { DOC_LABEL, Field, Kpi, ROLES, buildAccounting, buildPartners, countedClosing, customerAging, defaultHrPolicies, defaultTrainingPrograms, deficitCfg, deficitPatterns, expiringTraining, hrEmpStats, hrScoreFor, isoD, missingRequiredTraining, money, overdueSignDocs, stockByWh, sum, supplierAging, today } from '../../App.jsx';

export function AlertsCenter({ org, ops, me, myBranches, scoped, setTab, openAcctView, openInvView, commitOrg, say }) {
  const dcf = deficitCfg(org);
  const canCfg = !!(ROLES[me?.role]?.admin || ROLES[me?.role]?.approver);
  const [dEdit, setDEdit] = useState(null);
  const A = useMemo(() => buildAccounting(org, ops), [org, ops]);
  const sups = useMemo(() => buildPartners(org, ops).filter(p => p.type === 'supplier'), [org, ops]);
  const [catF, setCatF] = useState('all');
  const [sevF, setSevF] = useState('all');
  const td = today(); const ym = td.slice(0, 7);
  const r2 = (n) => Math.round(n * 100) / 100;
  const dd = (a, b) => { const x = Date.parse(a), y = Date.parse(b); return (isNaN(x) || isNaN(y)) ? 0 : Math.floor((y - x) / 86400000); };
  const accByCode = {}; A.accounts.forEach(a => { accByCode[a.code] = a; });
  const goAcct = (v) => { setTab('acct'); openAcctView && openAcctView(v); };
  const AL = [];
  const push = (sev, cat, title, detail, action) => AL.push({ sev, cat, title, detail, action });

  // موردون
  const aged = sups.map(p => ({ p, ...supplierAging(p, td) }));
  const over90 = r2(sum(aged, r => r.b90)), over60 = r2(sum(aged, r => r.b60));
  const n90 = aged.filter(r => r.b90 > 0.004).length;
  if (over90 > 0.004) push('high', 'suppliers', 'ذمم موردين متأخرة أكثر من 90 يومًا', money(over90) + ' على ' + n90 + ' مورد — أولوية سداد.', { label: 'الأعمار', go: () => goAcct('apage') });
  if (over60 > 0.004) push('mid', 'suppliers', 'ذمم في شريحة 61–90 يومًا', money(over60) + ' تقترب من التأخّر الحرج.', { label: 'الأعمار', go: () => goAcct('apage') });
  const credSup = aged.filter(r => r.credit > 0.004);
  if (credSup.length) push('low', 'suppliers', credSup.length + ' مورد برصيد دفعة مقدمة', 'دفعتَ أكثر من المستحق — استرجاع أو خصم لاحق.', { label: 'الأعمار', go: () => goAcct('apage') });

  // عملاء وذمم مدينة (v12.2)
  const arAged = buildPartners(org, ops).filter(p => p.type === 'customer').map(p => { const ag = customerAging(p, td); const lim = Number(((org.partners || []).find(x => x.id === p.id) || {}).creditLimit) || 0; return { p, ...ag, lim, over: lim > 0 && ag.total > lim + 0.004 }; });
  const ar90 = r2(sum(arAged, r => r.b90)), arN90 = arAged.filter(r => r.b90 > 0.004).length;
  if (ar90 > 0.004) push('high', 'customers', 'ذمم عملاء متأخرة أكثر من 90 يومًا', money(ar90) + ' على ' + arN90 + ' عميل — أولوية تحصيل.', { label: 'أعمار العملاء', go: () => goAcct('arage') });
  const arOver = arAged.filter(r => r.over);
  if (arOver.length) push('high', 'customers', arOver.length + ' عميل تجاوز حد الائتمان', 'راجع حدودهم قبل بيع آجل إضافي.', { label: 'أعمار العملاء', go: () => goAcct('arage') });

  // موازنة
  const budgetOn = !!(org.budget && org.budget.enabled);
  if (budgetOn) {
    const monAgg = {}; A.entries.forEach(e => { if ((e.date || '').slice(0, 7) === ym && !e.closing) e.lines.forEach(l => { const x = monAgg[l.code] || (monAgg[l.code] = { d: 0, c: 0 }); x.d += l.debit; x.c += l.credit; }); });
    (org.budget.lines || []).forEach(l => {
      const a = accByCode[l.code]; if (!a || a.kind !== 'exp') return;
      const x = monAgg[l.code] || { d: 0, c: 0 }; const actual = r2(x.d - x.c);
      if (actual > (l.amount || 0) + 0.005) push('mid', 'budget', 'تجاوز موازنة: ' + a.name, 'الفعلي ' + money(actual) + ' مقابل موازنة ' + money(l.amount) + ' هذا الشهر.', { label: 'الموازنة', go: () => goAcct('bud') });
    });
  } else push('low', 'budget', 'الموازنة غير مفعّلة', 'فعّلها لمقارنة الأداء بالمخطّط والتنبيه عند التجاوز.', { label: 'تفعيل', go: () => goAcct('bud') });

  // نقد وسيولة
  A.accounts.filter(a => a.cash && a.balance < -0.004).forEach(a => push('high', 'cash', 'رصيد نقدي سالب: ' + a.name, money(a.balance) + ' — راجع القيود أو مصدر التمويل.', { label: 'دليل الحسابات', go: () => goAcct('coa') }));
  const totLiab = sum(A.accounts.filter(a => a.kind === 'liab'), a => a.balance);
  const totAssets = sum(A.accounts.filter(a => a.kind === 'asset'), a => a.balance);
  const netFixed = ((accByCode['1701'] || {}).balance || 0) + ((accByCode['1791'] || {}).balance || 0);
  const curAssets = r2(totAssets - netFixed);
  if (totLiab > 0.005 && curAssets / totLiab < 1) push('mid', 'cash', 'النسبة الجارية دون 1', 'الأصول المتداولة ' + money(curAssets) + ' أقل من الخصوم ' + money(totLiab) + '.', { label: 'التحليل', go: () => goAcct('anl') });
  const recs = (ops.bankRecs || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const bankMoved = A.entries.some(e => e.lines.some(l => l.code === '1201'));
  if (bankMoved) { const last = recs[recs.length - 1];
    if (!last) push('low', 'cash', 'لم تُجرِ تسوية بنكية بعد', 'طابِق رصيد البنك الدفتري مع كشفك الفعلي.', { label: 'التسوية', go: () => goAcct('bank') });
    else if (dd(last.date, td) > 30) push('mid', 'cash', 'آخر تسوية بنكية قبل ' + dd(last.date, td) + ' يومًا', 'راجع مطابقة البنك دوريًا.', { label: 'التسوية', go: () => goAcct('bank') }); }

  // مخزون
  const stockBal = stockByWh(org, ops).total;   // v29.9: كل المستودعات
  const low = (org.items || []).filter(it => (Number(it.minQty) || 0) > 0 && (stockBal[it.id] || 0) < (Number(it.minQty) || 0));
  if (low.length) push('mid', 'inventory', low.length + ' صنف تحت حد الأمان', low.slice(0, 4).map(it => it.name).join('، ') + (low.length > 4 ? '…' : '') + ' — أعِد التزويد.', { label: 'المخزون', go: () => setTab('inv') });
  if ((org.items || []).length && (ops.stockMoves || []).length && !(org.invValuation && org.invValuation.enabled)) push('low', 'inventory', 'رسملة المخزون غير مفعّلة', 'فعّلها لتظهر تكلفة البضاعة المباعة والمخزون بدقّة.', { label: 'المخزون', go: () => setTab('inv') });

  // ضريبة
  if (org.taxCfg && org.taxCfg.enabled) {
    let out = 0, inn = 0; A.entries.forEach(e => { if (e.vat) { out += e.vat.out; inn += e.vat.inn; } });
    const vatDue = r2(out - inn);
    if (vatDue > 0.004) push('mid', 'tax', 'صافي ضريبة مستحقة (تقديري)', money(vatDue) + ' — راجع مسودة الإقرار.', { label: 'الضريبة', go: () => goAcct('vat') });
  }

  // تشغيل
  const pendingApp = (ops.closings || []).filter(c => c.status === 'submitted').length;
  if (pendingApp > 0) push('mid', 'ops', pendingApp + ' إغلاق بانتظار الاعتماد', 'راجعها واعتمدها لتُرحَّل نهائيًا.', { label: 'الاعتماد', go: () => setTab('approve') });
  const defs = (ops.closings || []).filter(c => countedClosing(c) && (c.variance || 0) < 0 && dd(c.date, td) >= 0 && dd(c.date, td) <= 7);
  const defsBig = defs.filter(c => (c.variance || 0) < -dcf.max);
  if (defsBig.length) push('high', 'ops', defsBig.length + ' عجز تجاوز الحد (' + money(dcf.max) + ') خلال أسبوع', defsBig.slice(0, 4).map(c => (c.branchName || '') + ' ' + money(Math.abs(c.variance))).join('، ') + (defsBig.length > 4 ? '…' : ''), { label: 'الاعتماد', go: () => setTab('approve') });
  deficitPatterns(org, ops.closings, (myBranches || []).map(b => b.id), td).forEach(x => push('high', 'ops', 'عجز متكرر — ' + x.branchName, x.n + ' حالات خلال ' + dcf.days + ' أيام بإجمالي ' + money(Math.abs(x.total)) + ' — راجع الكاشير والإجراءات.', { label: 'الاعتماد', go: () => setTab('approve') }));
  if (defs.length && !defsBig.length) push('low', 'ops', defs.length + ' عجز صندوق خلال أسبوع', 'إجمالي ' + money(r2(sum(defs, c => c.variance))) + ' — راقب الفروع.', { label: 'المقارنة', go: () => setTab('compare') });
  const unjust = (ops.advances || []).filter(a => a.isUnjustified).length;
  if (unjust > 0) push('mid', 'ops', unjust + ' سلفة غير مبررة', 'راجعها في شاشة الرواتب والسلف.', { label: 'الرواتب', go: () => setTab('payroll') });

  // إعداد/حوكمة
  const assetsDone = (A.assetRows || []).filter(a => a.done && !a.disposed).length;
  if (assetsDone > 0) push('low', 'setup', assetsDone + ' أصل اكتمل إهلاكه', 'راجعها للاستبعاد أو إعادة التقييم.', { label: 'الأصول', go: () => goAcct('ast') });
  const hasActivity = (ops.closings || []).some(countedClosing) || (ops.invoices || []).length > 0;
  if (hasActivity && !(org.openingBalances && (org.openingBalances.lines || []).length)) push('low', 'setup', 'الأرصدة الافتتاحية غير مُدخلة', 'أدخِل أرصدة ما قبل المنصة لدقّة المركز المالي.', { label: 'الأرصدة', go: () => goAcct('ob') });
  // v11.7 — انتهاء صلاحية الوثائق الرسمية
  const docRemind = Number((org.docCfg && org.docCfg.remindDays) != null ? org.docCfg.remindDays : 45) || 45;
  (org.documents || []).forEach(dc => {
    if (!dc.expiryDate) return; const dl = dd(td, dc.expiryDate);
    if (dl < 0) push('high', 'setup', 'وثيقة منتهية: ' + DOC_LABEL(dc.type), (dc.number ? dc.number + ' · ' : '') + 'انتهت في ' + dc.expiryDate + ' — جدّدها فورًا.', { label: 'الوثائق', go: () => setTab('docs') });
    else if (dl <= docRemind) push('mid', 'setup', 'وثيقة تنتهي قريبًا: ' + DOC_LABEL(dc.type), (dc.number ? dc.number + ' · ' : '') + 'تنتهي في ' + dc.expiryDate + ' (' + dl + ' يومًا).', { label: 'الوثائق', go: () => setTab('docs') });
  });

  // م9 (v26.0) — تنبيهات الموارد البشرية (م1–م8) ضمن فروعي
  try {
    const hrBranches = (myBranches || []).filter(b => b.isActive !== false);
    const hrIds = hrBranches.map(b => b.id);
    const hrEmps = (org.employees || []).filter(e => e.isActive !== false && hrIds.includes(e.branchId));
    // مستندات الموظفين (م1)
    let expDocs = 0, soonDocs = 0;
    hrEmps.forEach(e => (e.docs || []).forEach(dc => { if (!dc.expiryDate) return; const dl = dd(td, dc.expiryDate); if (dl < 0) expDocs++; else if (dl <= 30) soonDocs++; }));
    if (expDocs) push('high', 'hr', expDocs + ' مستند موظف منتهي الصلاحية', 'هوية/إقامة/عقد/شهادة انتهت — جدّدها من البيانات الرئيسية.', { label: 'البيانات الرئيسية', go: () => setTab('people') });
    if (soonDocs) push('mid', 'hr', soonDocs + ' مستند موظف ينتهي خلال 30 يومًا', 'راجع مستندات الموظفين قبل انتهائها.', { label: 'البيانات الرئيسية', go: () => setTab('people') });
    // غياب متكرر هذا الشهر (م3/م4)
    const repeatAbs = hrEmps.map(e => ({ e, st: hrEmpStats(org, ops, e, ym + '-01', ym + '-31') })).filter(x => x.st.absent >= 3);
    if (repeatAbs.length) push('high', 'hr', repeatAbs.length + ' موظف بغياب متكرر هذا الشهر (3 ورديات فأكثر)', repeatAbs.slice(0, 4).map(x => x.e.name + ' (' + x.st.absent + ')').join('، ') + (repeatAbs.length > 4 ? '…' : ''), { label: 'الأداء والتقييم', go: () => setTab('kpi') });
    // طلبات معلّقة (م4/م8)
    const pendRw = (ops.rewardRequests || []).filter(r => hrIds.includes(r.branchId) && r.status === 'pending').length;
    if (pendRw) push('mid', 'hr', pendRw + ' طلب مكافأة/جزاء بانتظار الاعتماد', 'لا أثر على الرواتب حتى يُعتمد.', { label: 'المكافآت', go: () => setTab('rewards') });
    const pendSw = (ops.shiftSwapRequests || []).filter(r => hrIds.includes(r.branchId) && r.status === 'pending').length;
    const pendTr = (ops.branchTransferRequests || []).filter(r => hrIds.includes(r.branchId) && r.status === 'pending').length;
    if (pendSw + pendTr) push('mid', 'hr', (pendSw ? pendSw + ' طلب تبديل وردية' : '') + (pendSw && pendTr ? ' و' : '') + (pendTr ? pendTr + ' طلب نقل موظف' : '') + ' بانتظار البتّ', 'راجعها في محرّك الورديات.', { label: 'محرّك الورديات', go: () => setTab('shiftengine') });
    // ورديات بلا تغطية غدًا (م4)
    const tmr = new Date(td + 'T00:00:00'); tmr.setDate(tmr.getDate() + 1); const tds = isoD(tmr); const twd = tmr.getDay();
    const addD = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return isoD(d); };
    const uncovered = [];
    hrBranches.forEach(b => {
      (ops.shiftTemplates || []).filter(t => t.branchId === b.id && (t.days || []).includes(twd)).forEach(t => {
        const covered = (ops.shiftAssignments || []).some(a => a.branchId === b.id && (a.shiftIds || []).some((sid, di) => sid === t.id && addD(a.weekStart, di) === tds));
        if (!covered) uncovered.push(b.name + ' — ' + t.name);
      });
    });
    if (uncovered.length) push('mid', 'hr', uncovered.length + ' وردية بلا تغطية غدًا', uncovered.slice(0, 3).join('، ') + (uncovered.length > 3 ? '…' : ''), { label: 'التعيين الأسبوعي', go: () => setTab('shiftengine') });
    // موظفون بلا PIN ولا بطاقة (م3)
    const noPin = hrEmps.filter(e => !(ops.hrPins || []).some(p => p.employeeId === e.id && (p.pinHash || p.badgeHash))).length;
    if (noPin) push('low', 'hr', noPin + ' موظف بلا رقم PIN ولا بطاقة QR', 'لن يستطيعوا تسجيل الحضور من جهاز الفرع.', { label: 'أرقام PIN', go: () => setTab('attendance') });
    // م10 (v27.0) — إقرارات/إشعارات بانتظار توقيع الموظف تجاوزت مهلة التذكير (hrPolicies.signReminderDays)
    const overdueSign = overdueSignDocs(org, ops, hrIds, td);
    if (overdueSign.length) {
      const sd = Number((org.hrPolicies || {}).signReminderDays != null ? org.hrPolicies.signReminderDays : defaultHrPolicies().signReminderDays) || 0;
      push('mid', 'hr', overdueSign.length + ' إقرار/إشعار بانتظار توقيع الموظف منذ أكثر من ' + sd + ' أيام', [...new Set(overdueSign.map(x => x.employeeName))].slice(0, 4).join('، ') + (overdueSign.length > 4 ? '…' : '') + ' — يوقّعون من كشك الفرع بعد التحقق بـPIN.', { label: 'التوقيع الإلكتروني', go: () => setTab('esign') });
    }
    // م20 (v27.6) — إجراءات تأديبية بانتظار الاعتماد + مقترحات خطط تحسين الأداء
    const pendCorr = (ops.hrCorrective || []).filter(c => hrIds.includes(c.branchId) && c.status === 'pending').length;
    if (pendCorr) push('mid', 'hr', pendCorr + ' إجراء تأديبي بانتظار الاعتماد المركزي', 'راجعها في الإجراءات التصحيحية.', { label: 'الإجراءات التصحيحية', go: () => setTab('corrective') });
    const _polC = { ...defaultHrPolicies(), ...(org.hrPolicies || {}) }; const _pipTh = Number(_polC.pipTriggerScore) || 60;
    const _actPip = new Set((ops.hrPips || []).filter(p => p.status === 'active').map(p => p.employeeId));
    const _lowN = hrEmps.filter(e => { const sc = hrScoreFor(org, ops, e, td.slice(0, 7)).score; return sc != null && sc < _pipTh && !_actPip.has(e.id); }).length;
    if (_lowN) push('low', 'hr', _lowN + ' موظف بدرجة أداء دون العتبة (' + _pipTh + ') بلا خطة تحسين نشطة', 'افتح خطة تحسين أداء أو راجع إجراءاتهم.', { label: 'خطط تحسين الأداء', go: () => setTab('corrective') });
    // م19 (v27.7) — شهادات منتهية/قريبة + نقص تدريب إلزامي
    const _progs = (org.trainingPrograms && org.trainingPrograms.length) ? org.trainingPrograms : defaultTrainingPrograms();
    const _trAlertDays = Number((org.hrPolicies || {}).trainingExpiryAlertDays) || 30;
    const _trRecs = (ops.hrTraining || []).filter(r => hrIds.includes(r.branchId));
    const _expTr = expiringTraining(_trRecs, _trAlertDays, td);
    if (_expTr.length) push('mid', 'hr', _expTr.length + ' شهادة تدريب منتهية أو تنتهي خلال ' + _trAlertDays + ' يومًا', [...new Set(_expTr.map(x => x.employeeName))].slice(0, 4).join('، ') + ' — جدّدها في التدريب والشهادات.', { label: 'التدريب والشهادات', go: () => setTab('training') });
    let _missN = 0; hrEmps.forEach(e => { _missN += missingRequiredTraining(_progs, _trRecs, e, td).length; });
    if (_missN) push('mid', 'hr', _missN + ' تدريب إلزامي ناقص لدى موظفي فروعك', 'راجع مصفوفة الامتثال في التدريب والشهادات.', { label: 'مصفوفة الامتثال', go: () => setTab('training') });
  } catch (e) { }

  const sevRank = { high: 0, mid: 1, low: 2 };
  AL.sort((a, b) => sevRank[a.sev] - sevRank[b.sev]);
  const counts = { high: AL.filter(a => a.sev === 'high').length, mid: AL.filter(a => a.sev === 'mid').length, low: AL.filter(a => a.sev === 'low').length };
  const catMap = { suppliers: 'موردون', customers: 'عملاء', budget: 'موازنة', cash: 'نقد وسيولة', inventory: 'مخزون', tax: 'ضريبة', ops: 'تشغيل', setup: 'إعداد', hr: 'موارد بشرية' };
  const cats = [['all', 'كل الفئات'], ['suppliers', 'موردون'], ['customers', 'عملاء'], ['budget', 'موازنة'], ['cash', 'نقد وسيولة'], ['inventory', 'مخزون'], ['tax', 'ضريبة'], ['ops', 'تشغيل'], ['setup', 'إعداد'], ['hr', 'موارد بشرية']];
  const sevCls = { high: 'b-rose', mid: 'b-amber', low: 'b-dim' }, sevTxt = { high: 'عاجل', mid: 'متابعة', low: 'اقتراح' };
  const shown = AL.filter(a => (catF === 'all' || a.cat === catF) && (sevF === 'all' || a.sev === sevF));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="abar">
        <div className="abar-id"><span className="abar-ic"><Bell size={17} /></span>مركز التنبيهات<small>قائمة إجراءات حيّة — تختفي تلقائيًا عند حلّها · {td}</small></div>
      </div>

      <div className="card dcfg">
        <div className="card-h">
          <div className="card-t"><AlertTriangle size={15} color="var(--rose)" />تنبيه عجز الصناديق</div>
          {canCfg && !dEdit && <button className="btn sm gh" onClick={() => setDEdit({ max: String(dcf.max), repeat: String(dcf.repeat), days: String(dcf.days) })}><Settings size={13} />تعديل</button>}
        </div>
        {!dEdit ? (
          <div className="dcfg-r">
            <span>تنبيه فوري عند عجز أكبر من <b className="num">{money(dcf.max)}</b> ر.س</span>
            <span>وتنبيه «عجز متكرر» عند <b className="num">{dcf.repeat}</b> حالات عجز أو أكثر — بأي مبلغ — في الفرع خلال <b className="num">{dcf.days}</b> أيام</span>
          </div>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="حد العجز (ر.س)" style={{ width: 140 }}><input className="inp n" inputMode="decimal" value={dEdit.max} onChange={e => setDEdit(v => ({ ...v, max: e.target.value }))} /></Field>
            <Field label="عدد حالات التكرار" style={{ width: 140 }}><input className="inp n" inputMode="numeric" value={dEdit.repeat} onChange={e => setDEdit(v => ({ ...v, repeat: e.target.value }))} /></Field>
            <Field label="خلال (أيام)" style={{ width: 120 }}><input className="inp n" inputMode="numeric" value={dEdit.days} onChange={e => setDEdit(v => ({ ...v, days: e.target.value }))} /></Field>
            <button className="btn pri" onClick={async () => {
              const mx = Number(String(dEdit.max).replace(/[^\d.]/g, '')), rp = parseInt(dEdit.repeat, 10), dy = parseInt(dEdit.days, 10);
              if (!(mx >= 0) || !(rp >= 2 && rp <= 20) || !(dy >= 2 && dy <= 60)) return say && say('الحد ≥ 0، التكرار بين 2 و20، والأيام بين 2 و60', 'no');
              await commitOrg(d => ({ ...d, alertCfg: { ...(d.alertCfg || {}), deficitMax: mx, deficitRepeat: rp, deficitDays: dy } }), { actionType: 'update', targetType: 'alert_settings', targetId: 'deficit', need: 'edit', title: 'عدّل إعداد تنبيه العجز', details: 'الحد ' + mx + ' · التكرار ' + rp + ' خلال ' + dy + ' أيام' });
              setDEdit(null); say && say('حُفظ إعداد تنبيه العجز ✓');
            }}><Check size={14} />حفظ</button>
            <button className="btn gh" onClick={() => setDEdit(null)}>إلغاء</button>
          </div>
        )}
      </div>

      <div className="grid g4">
        <Kpi label="إجمالي التنبيهات" value={String(AL.length)} sub="عبر كل الوحدات" icon={Bell} color="#C8A24A" />
        <Kpi label="عاجل" value={String(counts.high)} sub="يتطلب إجراءً الآن" icon={AlertTriangle} color={counts.high ? '#D9544D' : '#4FB286'} />
        <Kpi label="متابعة" value={String(counts.mid)} sub="راقبه هذا الأسبوع" icon={Clock} color={counts.mid ? '#E0A458' : '#4FB286'} />
        <Kpi label="اقتراح" value={String(counts.low)} sub="تحسينات وإعداد" icon={Sparkles} color="#5B93C4" />
      </div>

      <div className="card">
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', marginInlineEnd: 2 }}>الأولوية:</span>
          {[['all', 'الكل'], ['high', 'عاجل'], ['mid', 'متابعة'], ['low', 'اقتراح']].map(([k, l]) => (
            <button key={k} className={'btn sm' + (sevF === k ? ' pri' : ' gh')} onClick={() => setSevF(k)}>{l}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--dim)', marginInlineEnd: 2 }}>الفئة:</span>
          {cats.map(([k, l]) => (
            <button key={k} className={'btn sm' + (catF === k ? ' pri' : ' gh')} onClick={() => setCatF(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gap: 8 }}>
        {shown.map((a, i) => (
          <div key={i} className="card" style={{ borderInlineStart: '3px solid ' + (a.sev === 'high' ? 'var(--rose)' : a.sev === 'mid' ? 'var(--amber)' : 'var(--dim)') }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="row" style={{ gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={'badge ' + sevCls[a.sev]} style={{ fontSize: 9.5 }}>{sevTxt[a.sev]}</span>
                  <span className="badge b-dim" style={{ fontSize: 9.5 }}>{catMap[a.cat]}</span>
                  <b style={{ fontSize: 13 }}>{a.title}</b>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>{a.detail}</div>
              </div>
              {a.action && <button className="btn sm" onClick={a.action.go}>{a.action.label}<ChevronLeft size={13} /></button>}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="card"><div className="empty">{AL.length === 0 ? 'لا تنبيهات — كل شيء ضمن المسار ✓' : 'لا تنبيهات ضمن هذا التصنيف.'}</div></div>
        )}
      </div>

      <div className="note">التنبيهات مشتقّة حيًّا من بياناتك وتختفي تلقائيًا عند معالجة سببها — لا حاجة لإغلاقها يدويًا. العتبات المعتمدة: تأخّر الموردين 90 يومًا، أي عجز صندوق خلال أسبوع، المخزون تحت حد الأمان المعرّف لكل صنف، وتقادم التسوية البنكية بعد 30 يومًا.</div>
    </div>
  );
}
